/// Task Manager - High-level task orchestration and lifecycle management
/// 
/// This manager coordinates task operations with role assignments, execution,
/// and the hook system. It provides the main API that will be exposed to
/// the Python MCP server.

use super::{
    TaskService, TaskStatus, TaskPriority, TaskRelation, TaskInput, TaskUpdateInput,
    TaskTree, TaskSummary, TaskDashboard, TaskExecutionResult, ExecutionStatus
};
use crate::{CodexId, CodexManager};
use crate::role_management::RoleManager;
use crate::hook_system::HookManager;
use crate::errors::{BinderyError, BinderyResult};
use std::sync::Arc;
use tokio::sync::{RwLock, Mutex};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use std::collections::HashMap;

/// Task manager coordinating task lifecycle with roles and hooks
#[derive(Debug)]
pub struct TaskManager {
    task_service: Arc<TaskService>,
    role_manager: Arc<RoleManager>,
    hook_manager: Arc<HookManager>,
    active_executions: Arc<RwLock<HashMap<String, TaskExecutionContext>>>,
}

/// Context for tracking active task executions
#[derive(Debug, Clone)]
struct TaskExecutionContext {
    pub task_id: CodexId,
    pub execution_id: String,
    pub status: ExecutionStatus,
    pub role_name: String,
    pub started_at: DateTime<Utc>,
    pub output: Arc<Mutex<String>>,
}

impl TaskManager {
    /// Create a new task manager
    pub fn new(
        codex_manager: Arc<CodexManager>,
        role_manager: Arc<RoleManager>,
        hook_manager: Arc<HookManager>,
    ) -> Self {
        let task_service = Arc::new(TaskService::new(codex_manager));
        
        Self {
            task_service,
            role_manager,
            hook_manager,
            active_executions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Create a new task with hook integration
    pub async fn create_task(&self, input: TaskInput) -> BinderyResult<CodexId> {
        // Pre-creation hooks
        self.hook_manager.trigger_pre_task_create(&input).await?;

        // Create the task
        let task_id = self.task_service.create_task(input.clone()).await?;

        // Post-creation hooks with the actual task ID
        self.hook_manager.trigger_post_task_create(&task_id, &input).await?;

        Ok(task_id)
    }

    /// Create a hierarchical task tree
    pub async fn create_task_tree(
        &self,
        tree_title: String,
        tree_description: String,
        subtasks: Vec<TaskInput>,
        project_id: Option<String>,
    ) -> BinderyResult<CodexId> {
        // Create root task
        let root_input = TaskInput {
            title: tree_title,
            description: Some(tree_description),
            priority: Some(TaskPriority::High),
            project_id,
            parent_id: None,
            assignee: None,
            due_date: None,
            role: None,
            tags: vec!["task_tree".to_string()],
            labels: HashMap::new(),
            subtasks,
        };

        self.create_task(root_input).await
    }

    /// Get a task by ID
    pub async fn get_task(&self, task_id: &CodexId) -> BinderyResult<Option<serde_json::Value>> {
        if let Some(codex) = self.task_service.get_task(task_id).await? {
            // Convert Codex to task-specific JSON representation
            let mut task_json = serde_json::to_value(&codex)?;
            
            // Add execution history
            let execution_history = self.task_service.get_execution_history(task_id).await;
            task_json["execution_history"] = serde_json::to_value(execution_history)?;
            
            Ok(Some(task_json))
        } else {
            Ok(None)
        }
    }

    /// Update a task with hook integration
    pub async fn update_task(&self, input: TaskUpdateInput) -> BinderyResult<()> {
        let old_task = self.task_service.get_task(&input.task_id).await?;

        // Pre-update hooks
        self.hook_manager.trigger_pre_task_update(&input, old_task.as_ref()).await?;

        // Update the task
        self.task_service.update_task(input.clone()).await?;

        // Post-update hooks
        let updated_task = self.task_service.get_task(&input.task_id).await?;
        self.hook_manager.trigger_post_task_update(&input, updated_task.as_ref()).await?;

        Ok(())
    }

    /// Delete a task with cleanup
    pub async fn delete_task(&self, task_id: &CodexId, delete_subtasks: bool) -> BinderyResult<()> {
        // Cancel any active executions
        let mut executions = self.active_executions.write().await;
        executions.retain(|_, ctx| ctx.task_id != *task_id);
        drop(executions);

        // Pre-deletion hooks
        let task = self.task_service.get_task(task_id).await?;
        self.hook_manager.trigger_pre_task_delete(task_id, task.as_ref()).await?;

        // Delete the task
        self.task_service.delete_task(task_id, delete_subtasks).await?;

        // Post-deletion hooks
        self.hook_manager.trigger_post_task_delete(task_id).await?;

        Ok(())
    }

    /// List tasks with filtering
    pub async fn list_tasks(
        &self,
        project_id: Option<String>,
        status_filter: Option<TaskStatus>,
        priority_filter: Option<TaskPriority>, 
        assignee: Option<String>,
        parent_id: Option<CodexId>,
        limit: Option<usize>,
    ) -> BinderyResult<Vec<TaskSummary>> {
        self.task_service.list_tasks(
            project_id.as_deref(),
            status_filter,
            priority_filter,
            assignee.as_deref(),
            parent_id.as_ref(),
            limit.unwrap_or(50),
        ).await
    }

    /// Get task tree structure
    pub async fn get_task_tree(&self, task_id: &CodexId, max_depth: Option<usize>) -> BinderyResult<Option<TaskTree>> {
        self.task_service.get_task_tree(task_id, max_depth.unwrap_or(5)).await
    }

    /// Add task dependency
    pub async fn add_task_dependency(
        &self,
        task_id: &CodexId,
        depends_on_task_id: &CodexId,
        dependency_type: Option<TaskRelation>,
    ) -> BinderyResult<()> {
        let relation = dependency_type.unwrap_or(TaskRelation::DependsOn);
        self.task_service.add_task_dependency(task_id, depends_on_task_id, relation).await
    }

    /// Analyze task dependencies
    pub async fn analyze_task_dependencies(&self, task_id: &CodexId) -> BinderyResult<super::DependencyAnalysis> {
        self.task_service.analyze_task_dependencies(task_id).await
    }

    /// Execute a task with role-based execution
    pub async fn execute_task(&self, task_id: &CodexId, dry_run: bool) -> BinderyResult<String> {
        let task = self.task_service.get_task(task_id).await?
            .ok_or_else(|| BinderyError::NotFound(format!("Task {}", task_id)))?;

        // Determine role for execution
        let role_name = task.content.template_fields.get("assigned_role")
            .and_then(|v| v.as_str())
            .unwrap_or("default_agent")
            .to_string();

        if !self.role_manager.role_exists(&role_name).await {
            return Err(BinderyError::InvalidInput(format!("Role '{}' does not exist", role_name)));
        }

        if dry_run {
            return Ok(format!("Would execute task '{}' with role '{}'", task.title, role_name));
        }

        // Start execution
        let execution_id = Uuid::new_v4().to_string();
        let execution_context = TaskExecutionContext {
            task_id: task_id.clone(),
            execution_id: execution_id.clone(),
            status: ExecutionStatus::Running,
            role_name: role_name.clone(),
            started_at: Utc::now(),
            output: Arc::new(Mutex::new(String::new())),
        };

        self.active_executions.write().await.insert(execution_id.clone(), execution_context);

        // Update task status to in progress
        let update = TaskUpdateInput {
            task_id: task_id.clone(),
            title: None,
            description: None,
            status: Some(TaskStatus::Doing),
            priority: None,
            assignee: None,
            due_date: None,
            role: Some(role_name.clone()),
            labels: None,
            tags: None,
        };
        self.task_service.update_task(update).await?;

        // Execute via role manager (async)
        let task_clone = task.clone();
        let role_manager = self.role_manager.clone();
        let task_service = self.task_service.clone();
        let active_executions = self.active_executions.clone();
        let execution_id_for_task = execution_id.clone();

        tokio::spawn(async move {
            let result = Self::execute_task_with_role(
                &role_manager,
                &task_service,
                &active_executions,
                &task_clone,
                &role_name,
                &execution_id_for_task,
            ).await;

            if let Err(e) = result {
                tracing::error!("Task execution failed: {}", e);
            }
        });

        Ok(execution_id)
    }

    /// Start asynchronous task execution
    pub async fn start_task_execution(&self, task_id: &CodexId, timeout_minutes: Option<u64>) -> BinderyResult<String> {
        // TODO: Implement timeout functionality using timeout_minutes parameter
        if let Some(_timeout) = timeout_minutes {
            tracing::debug!("Task execution timeout configured: {} minutes", _timeout);
        }
        self.execute_task(task_id, false).await
    }

    /// Get execution status
    pub async fn get_execution_status(&self, execution_id: &str) -> BinderyResult<Option<serde_json::Value>> {
        let executions = self.active_executions.read().await;
        
        if let Some(context) = executions.get(execution_id) {
            let output = context.output.lock().await.clone();
            
            Ok(Some(serde_json::json!({
                "execution_id": execution_id,
                "task_id": context.task_id,
                "status": context.status,
                "role_name": context.role_name,
                "started_at": context.started_at,
                "output": output
            })))
        } else {
            // Check if it's in execution history
            let all_tasks = self.task_service.list_tasks(None, None, None, None, None, 1000).await?;
            
            for task_summary in all_tasks {
                let history = self.task_service.get_execution_history(&task_summary.id).await;
                for execution in history {
                    if execution.execution_id == execution_id {
                        return Ok(Some(serde_json::to_value(execution)?));
                    }
                }
            }
            
            Ok(None)
        }
    }

    /// Mark a task as completed
    pub async fn complete_task(
        &self,
        task_id: &CodexId,
        output: Option<String>,
        artifacts: Option<Vec<String>>,
    ) -> BinderyResult<()> {
        // Update task status
        let update = TaskUpdateInput {
            task_id: task_id.clone(),
            title: None,
            description: None,
            status: Some(TaskStatus::Done),
            priority: None,
            assignee: None,
            due_date: None,
            role: None,
            labels: None,
            tags: None,
        };
        self.task_service.update_task(update).await?;

        // Record completion in execution history
        let completion_result = TaskExecutionResult {
            task_id: task_id.clone(),
            execution_id: Uuid::new_v4().to_string(),
            status: ExecutionStatus::Completed,
            output,
            error: None,
            started_at: Utc::now(),
            completed_at: Some(Utc::now()),
            duration_ms: None,
        };

        self.task_service.record_execution(completion_result).await?;

        // Trigger completion hooks
        self.hook_manager.trigger_task_completed(task_id).await?;

        Ok(())
    }

    /// Assign a role to a task
    pub async fn assign_role_to_task(&self, task_id: &CodexId, role_name: String) -> BinderyResult<()> {
        if !self.role_manager.role_exists(&role_name).await {
            return Err(BinderyError::InvalidInput(format!("Role '{}' does not exist", role_name)));
        }

        let update = TaskUpdateInput {
            task_id: task_id.clone(),
            title: None,
            description: None,
            status: None,
            priority: None,
            assignee: None,
            due_date: None,
            role: Some(role_name),
            labels: None,
            tags: None,
        };

        self.task_service.update_task(update).await
    }

    /// Get task dashboard
    pub async fn get_task_dashboard(&self, project_id: Option<String>) -> BinderyResult<TaskDashboard> {
        self.task_service.get_task_dashboard(project_id.as_deref()).await
    }

    /// Find next available task for execution
    pub async fn execute_next_task(&self, project_id: Option<String>) -> BinderyResult<Option<String>> {
        // Find highest priority todo task
        let tasks = self.list_tasks(
            project_id,
            Some(TaskStatus::Todo),
            None,
            None,
            None,
            Some(10),
        ).await?;

        if let Some(task) = tasks.into_iter().find(|t| t.status == TaskStatus::Todo) {
            let execution_id = self.execute_task(&task.id, false).await?;
            Ok(Some(execution_id))
        } else {
            Ok(None)
        }
    }

    // Private helper methods

    async fn execute_task_with_role(
        role_manager: &Arc<RoleManager>,
        task_service: &Arc<TaskService>,
        active_executions: &Arc<RwLock<HashMap<String, TaskExecutionContext>>>,
        task: &crate::codex::Codex,
        role_name: &str,
        execution_id: &str,
    ) -> BinderyResult<()> {
        let start_time = Utc::now();
        
        // Execute the task via role manager
        let result = role_manager.execute_task_with_role(task, role_name).await;
        
        let end_time = Utc::now();
        let status = if result.is_ok() { ExecutionStatus::Completed } else { ExecutionStatus::Failed };
        
        let execution_result = TaskExecutionResult {
            task_id: task.id.clone(),
            execution_id: execution_id.to_string(),
            status: status.clone(),
            output: result.as_ref().ok().map(|s| s.clone()),
            error: result.as_ref().err().map(|e| format!("{}", e)),
            started_at: start_time,
            completed_at: Some(end_time),
            duration_ms: Some((end_time - start_time).num_milliseconds() as u64),
        };

        // Record execution result
        task_service.record_execution(execution_result).await?;

        // Update task status
        let final_status = if result.is_ok() { TaskStatus::Done } else { TaskStatus::Blocked };
        let update = TaskUpdateInput {
            task_id: task.id.clone(),
            title: None,
            description: None,
            status: Some(final_status),
            priority: None,
            assignee: None,
            due_date: None,
            role: None,
            labels: None,
            tags: None,
        };
        task_service.update_task(update).await?;

        // Remove from active executions
        active_executions.write().await.remove(execution_id);

        result.map(|_| ())
    }
}