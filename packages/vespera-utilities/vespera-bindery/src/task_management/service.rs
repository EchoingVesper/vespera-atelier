/// Task Service - Codex-based task persistence and CRDT operations
///
/// This service replaces the Python TaskService with a Rust implementation
/// that treats tasks as Codex entries with full CRDT collaborative editing support.

use super::{
    TaskStatus, TaskPriority, TaskRelation, TaskInput, TaskUpdateInput,
    TaskTree, TaskSummary, TaskDashboard, TaskExecutionResult,
    DependencyAnalysis
};
use crate::codex::{Codex, CodexManagerExt};
use crate::CodexId;
use crate::CodexManager;
use crate::templates::{TemplateId, TemplateValue};
use crate::errors::{BinderyError, BinderyResult};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::Utc;

/// Task service for managing task-based Codex entries
#[derive(Debug)]
pub struct TaskService {
    codex_manager: Arc<CodexManager>,
    task_template_id: TemplateId,
    execution_history: Arc<RwLock<HashMap<CodexId, Vec<TaskExecutionResult>>>>,
}

impl TaskService {
    /// Create a new task service
    pub fn new(codex_manager: Arc<CodexManager>) -> Self {
        Self {
            codex_manager,
            task_template_id: TemplateId::new("vespera.templates.hierarchical_task"),
            execution_history: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Create a new task as a Codex entry
    pub async fn create_task(&self, input: TaskInput) -> BinderyResult<CodexId> {
        // Create the main task Codex
        let task_id = self.codex_manager
            .create_codex_ext(input.title.clone(), self.task_template_id.clone())
            .await?;

        // Initialize task content using CRDT operations
        self.initialize_task_content(&task_id, &input).await?;

        // Create subtasks if provided
        for subtask_input in input.subtasks {
            let mut subtask_input = subtask_input;
            subtask_input.parent_id = Some(task_id.clone());
            Box::pin(self.create_task(subtask_input)).await?;
        }

        Ok(task_id)
    }

    /// Get a task by ID
    pub async fn get_task(&self, task_id: &CodexId) -> BinderyResult<Option<Codex>> {
        self.codex_manager.get_codex_ext(task_id).await
    }

    /// Update task fields using CRDT operations
    pub async fn update_task(&self, input: TaskUpdateInput) -> BinderyResult<()> {
        let _codex = self.codex_manager.get_codex_ext(&input.task_id).await?
            .ok_or_else(|| BinderyError::NotFound(format!("Task {}", input.task_id)))?;

        let mut updates = HashMap::new();

        if let Some(title) = input.title {
            updates.insert("title".to_string(), TemplateValue::Text(title));
        }

        if let Some(description) = input.description {
            updates.insert("description".to_string(), TemplateValue::Text(description));
        }

        if let Some(status) = input.status {
            let status_json = serde_json::to_string(&status)
                .map_err(|e| BinderyError::SerializationError(format!("Failed to serialize task status: {}", e)))?;
            updates.insert("status".to_string(), TemplateValue::Enum(status_json));
        }

        if let Some(priority) = input.priority {
            let priority_json = serde_json::to_string(&priority)
                .map_err(|e| BinderyError::SerializationError(format!("Failed to serialize task priority: {}", e)))?;
            updates.insert("priority".to_string(), TemplateValue::Enum(priority_json));
        }

        if let Some(assignee) = input.assignee {
            updates.insert("assignee".to_string(), TemplateValue::Text(assignee));
        }

        if let Some(due_date) = input.due_date {
            updates.insert("due_date".to_string(),
                TemplateValue::DateTime(due_date));
        }

        if let Some(role) = input.role {
            updates.insert("assigned_role".to_string(), TemplateValue::Text(role));
        }

        // Apply updates via CRDT metadata layer
        self.codex_manager.update_codex_fields(&input.task_id, updates).await?;

        Ok(())
    }

    /// Delete a task and optionally its subtasks
    pub fn delete_task<'a>(&'a self, task_id: &'a CodexId, delete_subtasks: bool) -> std::pin::Pin<Box<dyn std::future::Future<Output = BinderyResult<()>> + Send + 'a>> {
        Box::pin(async move {
        if delete_subtasks {
            // Get all child tasks and delete them first
            let children = self.get_child_tasks(task_id).await?;
            for child_id in children {
                self.delete_task(&child_id, true).await?;
            }
        }

        // Remove from execution history
        self.execution_history.write().await.remove(task_id);

        // Delete the Codex entry
        self.codex_manager.delete_codex_ext(task_id).await?;

        Ok(())
        })
    }

    /// List tasks with filtering
    pub async fn list_tasks(
        &self,
        project_id: Option<&str>,
        status_filter: Option<TaskStatus>,
        priority_filter: Option<TaskPriority>,
        assignee: Option<&str>,
        parent_id: Option<&CodexId>,
        limit: usize,
    ) -> BinderyResult<Vec<TaskSummary>> {
        // Use Codex manager to find task Codices
        let all_codices = self.codex_manager
            .list_codices_by_template(&self.task_template_id)
            .await?;

        let mut tasks = Vec::new();

        for codex in all_codices {
            // Check if this Codex matches our filters
            if let Some(summary) = self.codex_to_task_summary(&codex).await? {
                let matches = self.matches_filters(
                    &summary,
                    project_id,
                    status_filter.as_ref(),
                    priority_filter.as_ref(),
                    assignee,
                    parent_id,
                );

                if matches {
                    tasks.push(summary);
                }
            }

            if tasks.len() >= limit {
                break;
            }
        }

        // Sort by creation date descending
        tasks.sort_by(|a, b| b.created_at.cmp(&a.created_at));

        Ok(tasks)
    }

    /// Get task tree starting from a root task
    pub async fn get_task_tree(
        &self,
        task_id: &CodexId,
        max_depth: usize,
    ) -> BinderyResult<Option<TaskTree>> {
        if let Some(crdt) = self.codex_manager.get_codex(task_id).await {
            let codex = self.crdt_to_codex(&crdt).await?;
            if let Some(summary) = self.codex_to_task_summary(&codex).await? {
                let tree = self.build_task_tree_recursive(&summary, 0, max_depth).await?;
                return Ok(Some(tree));
            }
        }

        Ok(None)
    }

    /// Add a dependency between tasks
    pub async fn add_task_dependency(
        &self,
        task_id: &CodexId,
        depends_on_task_id: &CodexId,
        dependency_type: TaskRelation,
    ) -> BinderyResult<()> {
        // Use Codex reference system to create the relationship
        self.codex_manager.add_codex_reference(
            task_id,
            depends_on_task_id,
            &self.relation_to_reference_type(dependency_type),
            None,
        ).await?;

        Ok(())
    }

    /// Analyze task dependencies
    pub async fn analyze_task_dependencies(
        &self,
        task_id: &CodexId,
    ) -> BinderyResult<DependencyAnalysis> {
        let codex = self.codex_manager.get_codex(task_id).await
            .ok_or_else(|| BinderyError::NotFound(format!("Task {}", task_id)))?;

        let references = codex.reference_layer.elements();

        let mut depends_on = Vec::new();
        let mut blocks = Vec::new();

        for reference in references {
            match &reference.reference_type {
                crate::crdt::ReferenceType::DependsOn => depends_on.push(reference.to_codex_id),
                crate::crdt::ReferenceType::Custom(ref_type) if ref_type == "blocks" => blocks.push(reference.to_codex_id),
                _ => {}
            }
        }

        // Find tasks that depend on this one
        let blocking_tasks = self.find_tasks_depending_on(task_id).await?;
        let is_blocked = self.check_if_blocked(task_id).await?;

        let dependency_depth = depends_on.len(); // Calculate before moving

        Ok(DependencyAnalysis {
            task_id: task_id.clone(),
            depends_on,
            blocks,
            is_blocked,
            blocking_tasks,
            dependency_depth, // TODO: Calculate actual graph depth with cycle detection
            critical_path: false, // TODO: Implement critical path analysis using dependency graph
        })
    }

    /// Get task dashboard statistics
    pub async fn get_task_dashboard(&self, project_id: Option<&str>) -> BinderyResult<TaskDashboard> {
        let tasks = self.list_tasks(project_id, None, None, None, None, 1000).await?;

        let total_tasks = tasks.len();
        let mut status_breakdown = HashMap::new();
        let mut priority_breakdown = HashMap::new();
        let mut project_breakdown = HashMap::new();

        for task in &tasks {
            *status_breakdown.entry(task.status.clone()).or_insert(0) += 1;
            *priority_breakdown.entry(task.priority.clone()).or_insert(0) += 1;

            if let Some(ref proj_id) = task.project_id {
                *project_breakdown.entry(proj_id.clone()).or_insert(0usize) += 1;
            }
        }

        // Get recent tasks (last 10)
        let mut recent_tasks = tasks.clone();
        recent_tasks.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        recent_tasks.truncate(10);

        // Get overdue tasks
        let now = Utc::now();
        let overdue_tasks: Vec<TaskSummary> = tasks.iter()
            .filter(|task| {
                if let Some(due_date) = task.due_date {
                    due_date < now && task.status != TaskStatus::Done
                } else {
                    false
                }
            })
            .cloned()
            .collect();

        // Get upcoming tasks (due within 7 days)
        let week_from_now = now + chrono::Duration::days(7);
        let upcoming_tasks: Vec<TaskSummary> = tasks.iter()
            .filter(|task| {
                if let Some(due_date) = task.due_date {
                    due_date >= now && due_date <= week_from_now && task.status != TaskStatus::Done
                } else {
                    false
                }
            })
            .cloned()
            .collect();

        // Calculate completion rate
        let completed_tasks = status_breakdown.get(&TaskStatus::Done).copied().unwrap_or(0);
        let completion_rate = if total_tasks > 0 {
            completed_tasks as f64 / total_tasks as f64
        } else {
            0.0
        };

        Ok(TaskDashboard {
            total_tasks,
            status_breakdown,
            priority_breakdown,
            project_breakdown,
            recent_tasks,
            overdue_tasks,
            completion_rate,
            avg_completion_time_hours: None, // TODO: Calculate average completion time from execution history
        })
    }

    /// Record task execution result
    pub async fn record_execution(&self, result: TaskExecutionResult) -> BinderyResult<()> {
        let mut history = self.execution_history.write().await;
        history.entry(result.task_id.clone())
            .or_insert_with(Vec::new)
            .push(result);
        Ok(())
    }

    /// Get execution history for a task
    pub async fn get_execution_history(&self, task_id: &CodexId) -> Vec<TaskExecutionResult> {
        self.execution_history.read().await
            .get(task_id)
            .cloned()
            .unwrap_or_default()
    }

    // Private helper methods

    async fn initialize_task_content(&self, task_id: &CodexId, input: &TaskInput) -> BinderyResult<()> {
        let mut content = HashMap::new();

        content.insert("status".to_string(), TemplateValue::Enum("todo".to_string()));

        if let Some(priority) = &input.priority {
            let priority_json = serde_json::to_string(priority)
                .map_err(|e| BinderyError::SerializationError(format!("Failed to serialize task priority: {}", e)))?;
            content.insert("priority".to_string(), TemplateValue::Enum(priority_json));
        } else {
            content.insert("priority".to_string(), TemplateValue::Enum("normal".to_string()));
        }

        if let Some(description) = &input.description {
            content.insert("description".to_string(), TemplateValue::Text(description.clone()));
        }

        if let Some(project_id) = &input.project_id {
            content.insert("project_id".to_string(), TemplateValue::Text(project_id.clone()));
        }

        if let Some(assignee) = &input.assignee {
            content.insert("assignee".to_string(), TemplateValue::Text(assignee.clone()));
        }

        if let Some(due_date) = input.due_date {
            content.insert("due_date".to_string(), TemplateValue::DateTime(due_date));
        }

        if let Some(parent_id) = &input.parent_id {
            content.insert("parent_id".to_string(), TemplateValue::Text(parent_id.to_string()));
        }

        content.insert("tags".to_string(),
            TemplateValue::Array(input.tags.iter().map(|t| TemplateValue::Text(t.clone())).collect()));

        let labels_json = serde_json::to_value(&input.labels)
            .map_err(|e| BinderyError::SerializationError(format!("Failed to serialize task labels: {}", e)))?;
        content.insert("labels".to_string(), TemplateValue::Object(labels_json));

        content.insert("created_at".to_string(), TemplateValue::DateTime(Utc::now()));
        content.insert("updated_at".to_string(), TemplateValue::DateTime(Utc::now()));

        self.codex_manager.update_codex_fields(task_id, content).await?;

        Ok(())
    }

    /// Convert VesperaCRDT to Codex for task operations
    async fn crdt_to_codex(&self, crdt: &Arc<crate::crdt::VesperaCRDT>) -> BinderyResult<Codex> {
        use crate::types::{CodexContent, TemplateFieldValue};
        use std::collections::HashMap;

        // Extract title from metadata layer or use default
        let title = crdt.metadata_layer.get(&"title".to_string())
            .and_then(|template_value| match template_value {
                crate::crdt::TemplateValue::Text { value, .. } => Some(value.clone()),
                _ => None
            })
            .unwrap_or_else(|| format!("Task {}", crdt.codex_id));

        // Convert metadata layer to template fields
        let mut template_fields = HashMap::new();
        let metadata_snapshot = crdt.metadata_layer.snapshot();
        for (key, value) in metadata_snapshot {
            let field_value = match value {
                crate::crdt::TemplateValue::Text { value: text, .. } => {
                    TemplateFieldValue::Text { value: text }
                }
                _ => continue, // Skip non-text values for now
            };
            template_fields.insert(key, field_value);
        }

        let content = CodexContent {
            template_fields,
            content_sections: HashMap::new(),
            attachments: Vec::new(),
        };

        Ok(Codex {
            id: crdt.codex_id.clone(),
            title,
            content_type: "task".to_string(),
            template_id: self.task_template_id.clone(),
            created_at: crdt.created_at,
            updated_at: crdt.updated_at,
            content,
        })
    }

    async fn codex_to_task_summary(&self, codex: &Codex) -> BinderyResult<Option<TaskSummary>> {
        // Extract task fields from Codex content
        let content = &codex.content;

        let status_str = content.template_fields.get("status")
            .and_then(|field_value| match field_value {
                crate::types::TemplateFieldValue::Text { value } => Some(value.as_str()),
                _ => None
            })
            .unwrap_or("todo");
        let status = serde_json::from_str(&format!("\"{}\"", status_str))
            .unwrap_or(TaskStatus::Todo);

        let priority_str = content.template_fields.get("priority")
            .and_then(|field_value| match field_value {
                crate::types::TemplateFieldValue::Text { value } => Some(value.as_str()),
                _ => None
            })
            .unwrap_or("normal");
        let priority = serde_json::from_str(&format!("\"{}\"", priority_str))
            .unwrap_or(TaskPriority::Normal);

        let assignee = content.template_fields.get("assignee")
            .and_then(|field_value| match field_value {
                crate::types::TemplateFieldValue::Text { value } => Some(value.clone()),
                _ => None
            });

        let project_id = content.template_fields.get("project_id")
            .and_then(|field_value| match field_value {
                crate::types::TemplateFieldValue::Text { value } => Some(value.clone()),
                _ => None
            });

        let parent_id = content.template_fields.get("parent_id")
            .and_then(|field_value| match field_value {
                crate::types::TemplateFieldValue::Text { value } => value.parse().ok(),
                _ => None
            });

        let due_date = content.template_fields.get("due_date")
            .and_then(|field_value| match field_value {
                crate::types::TemplateFieldValue::Text { value } => value.parse().ok(),
                _ => None
            });

        let tags = content.template_fields.get("tags")
            .and_then(|field_value| match field_value {
                crate::types::TemplateFieldValue::Text { value } => Some(value.split(',').map(|s| s.trim().to_string()).collect()),
                _ => None
            })
            .unwrap_or_default();

        // Count child tasks
        let child_count = self.get_child_tasks(&codex.id).await?.len();

        Ok(Some(TaskSummary {
            id: codex.id.clone(),
            title: codex.title.clone(),
            status,
            priority,
            assignee,
            project_id,
            parent_id,
            child_count,
            created_at: codex.created_at,
            updated_at: codex.updated_at,
            due_date,
            tags,
            progress: None, // TODO: Calculate progress from task completion status
        }))
    }

    fn matches_filters(
        &self,
        task: &TaskSummary,
        project_id: Option<&str>,
        status_filter: Option<&TaskStatus>,
        priority_filter: Option<&TaskPriority>,
        assignee: Option<&str>,
        parent_id: Option<&CodexId>,
    ) -> bool {
        if let Some(proj) = project_id {
            if task.project_id.as_deref() != Some(proj) {
                return false;
            }
        }

        if let Some(status) = status_filter {
            if &task.status != status {
                return false;
            }
        }

        if let Some(priority) = priority_filter {
            if &task.priority != priority {
                return false;
            }
        }

        if let Some(user) = assignee {
            if task.assignee.as_deref() != Some(user) {
                return false;
            }
        }

        if let Some(parent) = parent_id {
            if task.parent_id.as_ref() != Some(parent) {
                return false;
            }
        }

        true
    }

    fn get_child_tasks<'a>(&'a self, parent_id: &'a CodexId) -> std::pin::Pin<Box<dyn std::future::Future<Output = BinderyResult<Vec<CodexId>>> + Send + 'a>> {
        Box::pin(async move {
            // Find all tasks where parent_id matches
            let all_tasks = self.list_tasks(None, None, None, None, Some(parent_id), 1000).await?;
            Ok(all_tasks.into_iter().map(|t| t.id).collect())
        })
    }

    fn build_task_tree_recursive<'a>(
        &'a self,
        task: &'a TaskSummary,
        current_depth: usize,
        max_depth: usize,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = BinderyResult<TaskTree>> + Send + 'a>> {
        Box::pin(async move {
        let mut children = Vec::new();

        if current_depth < max_depth {
            let child_ids = self.get_child_tasks(&task.id).await?;

            for child_id in child_ids {
                if let Some(crdt) = self.codex_manager.get_codex(&child_id).await {
                    let codex = self.crdt_to_codex(&crdt).await?;
                    if let Some(child_summary) = self.codex_to_task_summary(&codex).await? {
                        let child_tree = self.build_task_tree_recursive(&child_summary, current_depth + 1, max_depth).await?;
                        children.push(child_tree);
                    }
                }
            }
        }

        Ok(TaskTree {
            task: task.clone(),
            children,
            depth: current_depth,
            is_expanded: true, // Default to expanded for initial view
        })
        })
    }

    fn relation_to_reference_type(&self, relation: TaskRelation) -> String {
        match relation {
            TaskRelation::DependsOn => "depends_on".to_string(),
            TaskRelation::Blocks => "blocks".to_string(),
            TaskRelation::RelatesTo => "relates_to".to_string(),
            TaskRelation::DuplicateOf => "duplicate_of".to_string(),
            TaskRelation::ParentChild => "parent_child".to_string(),
        }
    }

    async fn find_tasks_depending_on(&self, task_id: &CodexId) -> BinderyResult<Vec<CodexId>> {
        // TODO: Implement reverse dependency lookup by scanning all tasks for references to this task_id
        // For now, return empty list as placeholder
        let _ = task_id; // Suppress unused parameter warning
        Ok(Vec::new())
    }

    async fn check_if_blocked(&self, task_id: &CodexId) -> BinderyResult<bool> {
        // TODO: Check if any dependencies are incomplete by querying task status
        // For now, assume not blocked as placeholder
        let _ = task_id; // Suppress unused parameter warning
        Ok(false)
    }
}