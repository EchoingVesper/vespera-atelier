/// Task executor - Handles task execution with role-based constraints
///
/// This module provides task execution functionality that integrates
/// with the role management system. It serves as a lower-level execution
/// engine that can be used by TaskManager for actual task processing.

use super::{TaskService, TaskExecutionResult, models::ExecutionStatus};
use crate::role_management::{RoleManager, Role};
use crate::codex::Codex;
use crate::CodexId;
use crate::errors::{BinderyError, BinderyResult};
use crate::observability::{
    instrumentation::TaskInstrumentation,
    metrics::BinderyMetrics,
    instrument,
};
use std::sync::Arc;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use std::time::Instant;
use tracing::{info, warn, error, debug};

/// Task executor for role-based execution
///
/// This executor provides the core logic for executing tasks with role constraints.
/// It validates permissions, manages execution context, and handles error recovery.
#[derive(Debug)]
pub struct TaskExecutor {
    task_service: Arc<TaskService>,
    role_manager: Arc<RoleManager>,
}

/// Execution context for tracking task execution state
#[derive(Debug, Clone)]
pub struct ExecutionContext {
    pub task_id: CodexId,
    pub execution_id: String,
    pub role_name: String,
    pub started_at: DateTime<Utc>,
    pub timeout_duration: Option<std::time::Duration>,
}

impl TaskExecutor {
    /// Create a new task executor
    pub fn new(task_service: Arc<TaskService>, role_manager: Arc<RoleManager>) -> Self {
        Self {
            task_service,
            role_manager,
        }
    }

    /// Execute a task with role constraints
    ///
    /// This is the main execution method that:
    /// 1. Loads the task from storage
    /// 2. Validates role permissions
    /// 3. Executes the task with role restrictions
    /// 4. Records execution results
    #[instrument(skip(self), fields(task_id = %task_id))]
    pub async fn execute(&self, task_id: &CodexId) -> BinderyResult<TaskExecutionResult> {
        let execution_id = Uuid::new_v4().to_string();
        let started_at = Utc::now();

        // Use TaskInstrumentation to wrap the entire execution
        TaskInstrumentation::instrument_task_execution(
            task_id,
            "task_execution",
            None,
            async {
                info!(
                    task_id = %task_id,
                    execution_id = %execution_id,
                    "Starting task execution"
                );

                // Load the task
                let task = match self.task_service.get_task(task_id).await? {
                    Some(task) => task,
                    None => {
                        error!(task_id = %task_id, "Task not found");
                        return Err(BinderyError::NotFound(format!("Task {}", task_id)));
                    }
                };

                // Determine the role for execution
                let role_name = self.extract_role_from_task(&task)?;

                info!(
                    task_id = %task_id,
                    role_name = %role_name,
                    task_title = %task.title,
                    "Task loaded, determined role"
                );

                // Get the role definition
                let role = match self.role_manager.get_role(&role_name).await {
                    Some(role) => role,
                    None => {
                        error!(
                            task_id = %task_id,
                            role_name = %role_name,
                            "Role not found"
                        );
                        return Err(BinderyError::NotFound(format!("Role '{}'", role_name)));
                    }
                };

                debug!(
                    task_id = %task_id,
                    role_name = %role_name,
                    capabilities = ?role.capabilities,
                    "Role loaded with capabilities"
                );

                // Create execution context
                let context = ExecutionContext {
                    task_id: *task_id,
                    execution_id: execution_id.clone(),
                    role_name: role_name.clone(),
                    started_at,
                    timeout_duration: role.execution_context.max_execution_time
                        .map(|secs| std::time::Duration::from_secs(secs)),
                };

                // Execute with timeout handling
                let result = match context.timeout_duration {
                    Some(timeout) => {
                        debug!(
                            task_id = %task_id,
                            timeout_secs = timeout.as_secs(),
                            "Executing task with timeout"
                        );
                        tokio::time::timeout(timeout, self.execute_task_with_role(&task, &role, &context)).await
                            .map_err(|_| {
                                warn!(
                                    task_id = %task_id,
                                    timeout_secs = timeout.as_secs(),
                                    "Task execution timed out"
                                );
                                BinderyError::ExecutionError("Task execution timed out".to_string())
                            })?
                    }
                    None => {
                        debug!(task_id = %task_id, "Executing task without timeout");
                        self.execute_task_with_role(&task, &role, &context).await
                    }
                };

                // Record execution result
                let execution_result = self.create_execution_result(&context, result).await;
                self.task_service.record_execution(execution_result.clone()).await?;

                info!(
                    task_id = %task_id,
                    execution_id = %execution_id,
                    status = ?execution_result.status,
                    duration_ms = ?execution_result.duration_ms,
                    "Task execution completed"
                );

                // Record metrics
                BinderyMetrics::record_task_completed(
                    "task_execution",
                    std::time::Duration::from_millis(execution_result.duration_ms.unwrap_or(0)),
                    matches!(execution_result.status, ExecutionStatus::Completed)
                );

                Ok(execution_result)
            }
        ).await
    }

    /// Execute a task with a specific role
    pub async fn execute_with_role(
        &self,
        task_id: &CodexId,
        role_name: &str,
    ) -> BinderyResult<TaskExecutionResult> {
        // Load the task
        let task = self.task_service.get_task(task_id).await?
            .ok_or_else(|| BinderyError::NotFound(format!("Task {}", task_id)))?;

        // Get the role
        let role = self.role_manager.get_role(role_name).await
            .ok_or_else(|| BinderyError::NotFound(format!("Role '{}'", role_name)))?;

        // Create execution context
        let execution_id = Uuid::new_v4().to_string();
        let context = ExecutionContext {
            task_id: *task_id,
            execution_id: execution_id.clone(),
            role_name: role_name.to_string(),
            started_at: Utc::now(),
            timeout_duration: role.execution_context.max_execution_time
                .map(|secs| std::time::Duration::from_secs(secs)),
        };

        // Execute the task
        let result = self.execute_task_with_role(&task, &role, &context).await;
        let execution_result = self.create_execution_result(&context, result).await;

        // Record the execution
        self.task_service.record_execution(execution_result.clone()).await?;

        Ok(execution_result)
    }

    /// Execute a task in dry-run mode (validation only)
    pub async fn dry_run(&self, task_id: &CodexId) -> BinderyResult<String> {
        let task = self.task_service.get_task(task_id).await?
            .ok_or_else(|| BinderyError::NotFound(format!("Task {}", task_id)))?;

        let role_name = self.extract_role_from_task(&task)?;
        let role = self.role_manager.get_role(&role_name).await
            .ok_or_else(|| BinderyError::NotFound(format!("Role '{}'", role_name)))?;

        // Validate task against role capabilities
        self.role_manager.validate_task_for_role(&task, &role).await?;

        Ok(format!(
            "Dry run successful: Task '{}' can be executed with role '{}'. Required capabilities: {:?}",
            task.title,
            role.name,
            role.capabilities
        ))
    }

    // Private helper methods

    /// Extract the role name from a task's metadata
    fn extract_role_from_task(&self, task: &Codex) -> BinderyResult<String> {
        // Check for role in template fields first
        if let Some(role_value) = task.content.template_fields.get("assigned_role") {
            if let Some(role_str) = role_value.as_str() {
                return Ok(role_str.to_string());
            }
        }

        // Check for role in metadata
        if let Some(role_value) = task.content.template_fields.get("role") {
            if let Some(role_str) = role_value.as_str() {
                return Ok(role_str.to_string());
            }
        }

        // Default role if none specified
        warn!("No role specified for task {}, using default_agent", task.id);
        Ok("default_agent".to_string())
    }

    /// Execute the actual task logic with role constraints
    async fn execute_task_with_role(
        &self,
        task: &Codex,
        role: &Role,
        context: &ExecutionContext,
    ) -> Result<String, BinderyError> {
        let start_time = Instant::now();

        debug!("Executing task {} with role {}", context.task_id, context.role_name);

        // Validate that the role can execute this task
        self.role_manager.validate_task_for_role(task, role).await?;

        // Delegate to role manager for actual execution
        // The role manager handles the capability restrictions and file access controls
        match self.role_manager.execute_task_with_role(task, &role.name).await {
            Ok(output) => {
                let duration = start_time.elapsed();
                info!(
                    "Task {} executed successfully in {:?} with role {}",
                    context.task_id, duration, context.role_name
                );
                Ok(output)
            }
            Err(e) => {
                let duration = start_time.elapsed();
                error!(
                    "Task {} failed after {:?} with role {}: {}",
                    context.task_id, duration, context.role_name, e
                );
                Err(e)
            }
        }
    }

    /// Create an execution result from the execution context and result
    async fn create_execution_result(
        &self,
        context: &ExecutionContext,
        result: Result<String, BinderyError>,
    ) -> TaskExecutionResult {
        let completed_at = Utc::now();
        let duration_ms = (completed_at - context.started_at).num_milliseconds() as u64;

        match result {
            Ok(output) => TaskExecutionResult {
                task_id: context.task_id,
                execution_id: context.execution_id.clone(),
                status: ExecutionStatus::Completed,
                output: Some(output),
                error: None,
                started_at: context.started_at,
                completed_at: Some(completed_at),
                duration_ms: Some(duration_ms),
            },
            Err(error) => TaskExecutionResult {
                task_id: context.task_id,
                execution_id: context.execution_id.clone(),
                status: ExecutionStatus::Failed,
                output: None,
                error: Some(error.to_string()),
                started_at: context.started_at,
                completed_at: Some(completed_at),
                duration_ms: Some(duration_ms),
            },
        }
    }
}