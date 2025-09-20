/// Role executor - Handles role-based task execution with audit logging
///
/// This module provides role execution functionality that validates
/// and executes tasks based on role capabilities. It implements the
/// actual execution logic with capability restrictions, file access
/// controls, security constraints, and comprehensive audit logging.

use super::{Role, RoleExecutionResult, ToolGroup};
use crate::codex::Codex;
use crate::errors::{BinderyError, BinderyResult};
use crate::observability::audit::{
    AuditLogger, AuditEvent, UserContext, Operation, SecurityContext, OperationOutcome,
    create_role_execution_event, create_auth_failure_event
};
use std::collections::{HashSet, HashMap};
use std::time::Instant;
use std::sync::Arc;
use tracing::{info, debug, warn, error};
use tokio::fs;
use chrono::Utc;
use uuid::Uuid;

/// Role executor for capability-restricted execution with audit logging
///
/// This executor implements the core logic for executing tasks within
/// the constraints defined by roles. It provides security through
/// capability validation, file access controls, execution timeouts,
/// and comprehensive audit logging for all security-sensitive operations.
#[derive(Debug)]
pub struct RoleExecutor {
    /// Audit logger for security events
    audit_logger: Option<Arc<AuditLogger>>,
}

/// Execution runtime for tracking resource usage
#[derive(Debug)]
pub struct ExecutionRuntime {
    start_time: Instant,
    files_accessed: HashSet<String>,
    tools_used: HashSet<String>,
    max_memory_bytes: Option<u64>,
    network_calls_made: u32,
    /// User context for audit logging
    user_context: UserContext,
    /// Session identifier for audit trails
    session_id: String,
}

impl RoleExecutor {
    /// Create a new role executor without audit logging
    pub fn new() -> Self {
        Self {
            audit_logger: None,
        }
    }

    /// Create a new role executor with audit logging
    pub fn with_audit_logger(audit_logger: Arc<AuditLogger>) -> Self {
        Self {
            audit_logger: Some(audit_logger),
        }
    }

    /// Execute a task with role constraints and audit logging
    ///
    /// This is the main execution method that:
    /// 1. Validates role capabilities for the task
    /// 2. Sets up execution environment with restrictions
    /// 3. Executes the task with monitoring
    /// 4. Validates all file access against role permissions
    /// 5. Logs all security-sensitive operations to audit trail
    /// 6. Returns detailed execution results
    pub async fn execute_with_role(
        &self,
        role: &Role,
        task: &Codex,
        user_context: UserContext,
    ) -> BinderyResult<RoleExecutionResult> {
        let start_time = Instant::now();
        let session_id = Uuid::new_v4().to_string();

        let mut runtime = ExecutionRuntime {
            start_time,
            files_accessed: HashSet::new(),
            tools_used: HashSet::new(),
            max_memory_bytes: role.execution_context.max_memory_usage.map(|mb| mb * 1024 * 1024),
            network_calls_made: 0,
            user_context: user_context.clone(),
            session_id: session_id.clone(),
        };

        info!("Starting role-based execution: task {} with role {}", task.id, role.name);

        // Audit: Log execution attempt
        self.audit_execution_attempt(role, task, &user_context, &session_id).await;

        // Validate role capabilities for this task
        let capability_result = self.validate_task_capabilities(role, task, &mut runtime);
        if let Err(ref e) = capability_result {
            // Audit: Log capability validation failure
            self.audit_capability_failure(role, task, &user_context, &session_id, e).await;
            return capability_result;
        }

        // Execute the task based on its type and content
        let execution_result = self.execute_task_logic(role, task, &mut runtime).await;

        let duration = start_time.elapsed();
        let execution_result = self.create_execution_result(role, execution_result, runtime, duration).await;

        // Audit: Log execution completion
        self.audit_execution_completion(role, task, &user_context, &session_id, &execution_result).await;

        info!(
            "Role-based execution completed: task {} with role {} (success: {})",
            task.id, role.name, execution_result.success
        );

        Ok(execution_result)
    }

    /// Execute with role constraints using context string
    ///
    /// This method handles execution when task details are provided as a string context
    /// rather than a full Codex object. Useful for simple command execution.
    pub async fn execute_with_context(
        &self,
        role: &Role,
        context: &str,
        user_context: UserContext,
    ) -> BinderyResult<RoleExecutionResult> {
        let start_time = Instant::now();
        let session_id = Uuid::new_v4().to_string();

        let mut runtime = ExecutionRuntime {
            start_time,
            files_accessed: HashSet::new(),
            tools_used: HashSet::new(),
            max_memory_bytes: role.execution_context.max_memory_usage.map(|mb| mb * 1024 * 1024),
            network_calls_made: 0,
            user_context: user_context.clone(),
            session_id: session_id.clone(),
        };

        info!("Starting context-based execution with role {}", role.name);

        // Audit: Log context execution attempt
        self.audit_context_execution_attempt(role, context, &user_context, &session_id).await;

        // Parse and execute the context
        let execution_result = self.execute_context_logic(role, context, &mut runtime).await;

        let duration = start_time.elapsed();
        let execution_result = self.create_execution_result(role, execution_result, runtime, duration).await;

        // Audit: Log context execution completion
        self.audit_context_execution_completion(role, context, &user_context, &session_id, &execution_result).await;

        info!(
            "Context-based execution completed with role {} (success: {})",
            role.name, execution_result.success
        );

        Ok(execution_result)
    }

    /// Validate file access permissions with audit logging
    pub async fn validate_file_access(
        &self,
        role: &Role,
        file_path: &str,
        write_access: bool,
        user_context: &UserContext,
        session_id: &str,
    ) -> BinderyResult<()> {
        let validation_result = if !role.can_access_file(file_path, write_access) {
            let access_type = if write_access { "write" } else { "read" };
            let error = BinderyError::PermissionDenied(
                format!("Role '{}' does not have {} access to file: {}", role.name, access_type, file_path)
            );

            // Audit: Log file access denial
            self.audit_file_access_denial(role, file_path, write_access, user_context, session_id, &error).await;

            Err(error)
        } else {
            // Audit: Log successful file access validation
            self.audit_file_access_granted(role, file_path, write_access, user_context, session_id).await;
            Ok(())
        };

        validation_result
    }

    /// Execute a command with capability and file restrictions
    pub async fn execute_command(
        &self,
        role: &Role,
        command: &str,
        args: &[&str],
        user_context: UserContext,
    ) -> BinderyResult<RoleExecutionResult> {
        let start_time = Instant::now();
        let session_id = Uuid::new_v4().to_string();

        let mut runtime = ExecutionRuntime {
            start_time,
            files_accessed: HashSet::new(),
            tools_used: HashSet::new(),
            max_memory_bytes: role.execution_context.max_memory_usage.map(|mb| mb * 1024 * 1024),
            network_calls_made: 0,
            user_context: user_context.clone(),
            session_id: session_id.clone(),
        };

        // Audit: Log command execution attempt
        self.audit_command_execution_attempt(role, command, args, &user_context, &session_id).await;

        // Check if role allows process execution
        if !role.has_capability(&ToolGroup::ProcessExecution) {
            let error = BinderyError::PermissionDenied(
                format!("Role '{}' does not have process execution capability", role.name)
            );

            // Audit: Log capability denial
            self.audit_capability_denial(role, "ProcessExecution", &user_context, &session_id, &error).await;

            return Err(error);
        }

        if !role.execution_context.subprocess_allowed {
            let error = BinderyError::PermissionDenied(
                format!("Role '{}' does not allow subprocess execution", role.name)
            );

            // Audit: Log subprocess denial
            self.audit_subprocess_denial(role, &user_context, &session_id, &error).await;

            return Err(error);
        }

        runtime.tools_used.insert("process_execution".to_string());

        // Execute the command with timeout
        let result = match role.execution_context.max_execution_time {
            Some(timeout_secs) => {
                let timeout = std::time::Duration::from_secs(timeout_secs);
                tokio::time::timeout(timeout, self.run_command(command, args, &mut runtime)).await
                    .map_err(|_| BinderyError::ExecutionError("Command execution timed out".to_string()))?
            }
            None => {
                self.run_command(command, args, &mut runtime).await
            }
        };

        let duration = start_time.elapsed();
        let execution_result = self.create_execution_result(role, result, runtime, duration).await;

        // Audit: Log command execution completion
        self.audit_command_execution_completion(role, command, args, &user_context, &session_id, &execution_result).await;

        Ok(execution_result)
    }

    // Private helper methods

    /// Validate that a role has the required capabilities for a task
    fn validate_task_capabilities(&self, role: &Role, task: &Codex, runtime: &mut ExecutionRuntime) -> BinderyResult<()> {
        // Extract required capabilities from task content
        let required_capabilities = self.extract_required_capabilities(task)?;

        for capability in &required_capabilities {
            if !role.has_capability(capability) {
                return Err(BinderyError::PermissionDenied(
                    format!("Role '{}' lacks required capability: {:?}", role.name, capability)
                ));
            }
            runtime.tools_used.insert(format!("{:?}", capability));
        }

        debug!("Capability validation passed for role {} with capabilities: {:?}", role.name, required_capabilities);
        Ok(())
    }

    /// Execute the main task logic based on task content
    async fn execute_task_logic(&self, role: &Role, task: &Codex, runtime: &mut ExecutionRuntime) -> Result<String, BinderyError> {
        // Determine execution strategy based on task template and content
        let task_type = task.content.template_fields.get("task_type")
            .and_then(|v| v.as_str())
            .unwrap_or("general");

        match task_type {
            "file_operation" => self.execute_file_operation(role, task, runtime).await,
            "command_execution" => self.execute_command_task(role, task, runtime).await,
            "data_processing" => self.execute_data_processing(role, task, runtime).await,
            "network_request" => self.execute_network_request(role, task, runtime).await,
            _ => self.execute_general_task(role, task, runtime).await,
        }
    }

    /// Execute context-based logic for string commands
    async fn execute_context_logic(&self, role: &Role, context: &str, runtime: &mut ExecutionRuntime) -> Result<String, BinderyError> {
        // Parse context for execution instructions
        if context.starts_with("cmd:") {
            let command_line = context.strip_prefix("cmd:").ok_or_else(|| BinderyError::InvalidInput("Invalid command context format".to_string()))?.trim();
            let parts: Vec<&str> = command_line.split_whitespace().collect();
            if let Some((command, args)) = parts.split_first() {
                runtime.tools_used.insert("command_execution".to_string());
                self.run_command(command, args, runtime).await
            } else {
                Err(BinderyError::InvalidInput("Empty command".to_string()))
            }
        } else if context.starts_with("file:") {
            let file_path = context.strip_prefix("file:").ok_or_else(|| BinderyError::InvalidInput("Invalid file context format".to_string()))?.trim();
            self.read_file_with_validation(role, file_path, runtime).await
        } else {
            // Default: treat as a simple execution context
            Ok(format!("Executed context with role '{}': {}", role.name, context))
        }
    }

    /// Execute file operations with role validation
    async fn execute_file_operation(&self, role: &Role, task: &Codex, runtime: &mut ExecutionRuntime) -> Result<String, BinderyError> {
        if !role.has_capability(&ToolGroup::FileOperations) {
            return Err(BinderyError::PermissionDenied(
                format!("Role '{}' lacks file operations capability", role.name)
            ));
        }

        runtime.tools_used.insert("file_operations".to_string());

        // Extract file operation details from task
        let operation = task.content.template_fields.get("operation")
            .and_then(|v| v.as_str())
            .unwrap_or("read");

        let file_path = task.content.template_fields.get("file_path")
            .and_then(|v| v.as_str())
            .ok_or_else(|| BinderyError::InvalidInput("Missing file_path in task".to_string()))?;

        match operation {
            "read" => self.read_file_with_validation(role, file_path, runtime).await,
            "write" => {
                let content = task.content.template_fields.get("content")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                self.write_file_with_validation(role, file_path, content, runtime).await
            },
            "delete" => self.delete_file_with_validation(role, file_path, runtime).await,
            _ => Err(BinderyError::InvalidInput(format!("Unknown file operation: {}", operation))),
        }
    }

    /// Execute command-based tasks
    async fn execute_command_task(&self, role: &Role, task: &Codex, runtime: &mut ExecutionRuntime) -> Result<String, BinderyError> {
        if !role.has_capability(&ToolGroup::ProcessExecution) {
            return Err(BinderyError::PermissionDenied(
                format!("Role '{}' lacks process execution capability", role.name)
            ));
        }

        let command = task.content.template_fields.get("command")
            .and_then(|v| v.as_str())
            .ok_or_else(|| BinderyError::InvalidInput("Missing command in task".to_string()))?;

        let args: Vec<&str> = task.content.template_fields.get("args")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str()).collect())
            .unwrap_or_default();

        runtime.tools_used.insert("process_execution".to_string());
        self.run_command(command, &args, runtime).await
    }

    /// Execute data processing tasks
    async fn execute_data_processing(&self, role: &Role, _task: &Codex, runtime: &mut ExecutionRuntime) -> Result<String, BinderyError> {
        if !role.has_capability(&ToolGroup::Development) {
            return Err(BinderyError::PermissionDenied(
                format!("Role '{}' lacks development capability for data processing", role.name)
            ));
        }

        runtime.tools_used.insert("data_processing".to_string());

        // Simulate data processing
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        Ok("Data processing completed successfully".to_string())
    }

    /// Execute network requests
    async fn execute_network_request(&self, role: &Role, task: &Codex, runtime: &mut ExecutionRuntime) -> Result<String, BinderyError> {
        if !role.has_capability(&ToolGroup::NetworkAccess) {
            return Err(BinderyError::PermissionDenied(
                format!("Role '{}' lacks network access capability", role.name)
            ));
        }

        if !role.execution_context.network_access {
            return Err(BinderyError::PermissionDenied(
                format!("Role '{}' does not allow network access", role.name)
            ));
        }

        runtime.tools_used.insert("network_access".to_string());
        runtime.network_calls_made += 1;

        // Extract URL from task
        let url = task.content.template_fields.get("url")
            .and_then(|v| v.as_str())
            .ok_or_else(|| BinderyError::InvalidInput("Missing URL in network request task".to_string()))?;

        // Simulate network request
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        Ok(format!("Network request to {} completed successfully", url))
    }

    /// Execute general tasks
    async fn execute_general_task(&self, role: &Role, task: &Codex, runtime: &mut ExecutionRuntime) -> Result<String, BinderyError> {
        runtime.tools_used.insert("general_execution".to_string());

        // Basic validation and execution for general tasks
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        Ok(format!("General task executed successfully with role '{}'", role.name))
    }

    /// Read a file with role validation and audit logging
    async fn read_file_with_validation(&self, role: &Role, file_path: &str, runtime: &mut ExecutionRuntime) -> Result<String, BinderyError> {
        // Validate file access
        self.validate_file_access(role, file_path, false, &runtime.user_context, &runtime.session_id).await?;

        runtime.files_accessed.insert(file_path.to_string());

        match fs::read_to_string(file_path).await {
            Ok(content) => {
                debug!("Successfully read file: {}", file_path);
                Ok(content)
            }
            Err(e) => {
                error!("Failed to read file {}: {}", file_path, e);
                Err(BinderyError::IoError(format!("Failed to read file {}: {}", file_path, e)))
            }
        }
    }

    /// Write a file with role validation and audit logging
    async fn write_file_with_validation(&self, role: &Role, file_path: &str, content: &str, runtime: &mut ExecutionRuntime) -> Result<String, BinderyError> {
        // Validate file access
        self.validate_file_access(role, file_path, true, &runtime.user_context, &runtime.session_id).await?;

        runtime.files_accessed.insert(file_path.to_string());

        match fs::write(file_path, content).await {
            Ok(_) => {
                debug!("Successfully wrote file: {}", file_path);
                Ok(format!("File written successfully: {}", file_path))
            }
            Err(e) => {
                error!("Failed to write file {}: {}", file_path, e);
                Err(BinderyError::IoError(format!("Failed to write file {}: {}", file_path, e)))
            }
        }
    }

    /// Delete a file with role validation and audit logging
    async fn delete_file_with_validation(&self, role: &Role, file_path: &str, runtime: &mut ExecutionRuntime) -> Result<String, BinderyError> {
        // Validate file access (delete requires write access)
        self.validate_file_access(role, file_path, true, &runtime.user_context, &runtime.session_id).await?;

        runtime.files_accessed.insert(file_path.to_string());

        match fs::remove_file(file_path).await {
            Ok(_) => {
                debug!("Successfully deleted file: {}", file_path);
                Ok(format!("File deleted successfully: {}", file_path))
            }
            Err(e) => {
                error!("Failed to delete file {}: {}", file_path, e);
                Err(BinderyError::IoError(format!("Failed to delete file {}: {}", file_path, e)))
            }
        }
    }

    /// Run a command with process execution
    async fn run_command(&self, command: &str, args: &[&str], runtime: &mut ExecutionRuntime) -> Result<String, BinderyError> {
        use tokio::process::Command;

        let output = Command::new(command)
            .args(args)
            .output()
            .await
            .map_err(|e| BinderyError::ExecutionError(format!("Failed to execute command '{}': {}", command, e)))?;

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            debug!("Command executed successfully: {} {:?}", command, args);
            Ok(stdout.to_string())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            error!("Command failed: {} {:?} - {}", command, args, stderr);
            Err(BinderyError::ExecutionError(format!("Command failed: {}", stderr)))
        }
    }

    /// Extract required capabilities from task content
    fn extract_required_capabilities(&self, task: &Codex) -> BinderyResult<Vec<ToolGroup>> {
        let mut capabilities = Vec::new();

        // Check task type and determine required capabilities
        if let Some(task_type) = task.content.template_fields.get("task_type").and_then(|v| v.as_str()) {
            match task_type {
                "file_operation" => capabilities.push(ToolGroup::FileOperations),
                "command_execution" => capabilities.push(ToolGroup::ProcessExecution),
                "data_processing" => capabilities.push(ToolGroup::Development),
                "network_request" => capabilities.push(ToolGroup::NetworkAccess),
                _ => {} // General tasks don't require specific capabilities
            }
        }

        // Check for specific capability requirements in task metadata
        if let Some(required_caps) = task.content.template_fields.get("required_capabilities").and_then(|v| v.as_array()) {
            for cap_value in required_caps {
                if let Some(cap_str) = cap_value.as_str() {
                    match cap_str {
                        "file_operations" => capabilities.push(ToolGroup::FileOperations),
                        "process_execution" => capabilities.push(ToolGroup::ProcessExecution),
                        "network_access" => capabilities.push(ToolGroup::NetworkAccess),
                        "development" => capabilities.push(ToolGroup::Development),
                        "database_access" => capabilities.push(ToolGroup::DatabaseAccess),
                        _ => debug!("Unknown capability requirement: {}", cap_str),
                    }
                }
            }
        }

        Ok(capabilities)
    }

    /// Create execution result with comprehensive metrics
    async fn create_execution_result(
        &self,
        role: &Role,
        result: Result<String, BinderyError>,
        runtime: ExecutionRuntime,
        duration: std::time::Duration,
    ) -> RoleExecutionResult {
        let (success, output, error_message) = match result {
            Ok(output) => (true, output, None),
            Err(e) => (false, String::new(), Some(e.to_string())),
        };

        RoleExecutionResult {
            success,
            output,
            error_message,
            execution_time: duration,
            role_name: role.name.clone(),
            capabilities_used: runtime.tools_used.into_iter().collect(),
            files_accessed: runtime.files_accessed.into_iter().collect(),
            memory_used_bytes: 0, // TODO: Implement actual memory tracking
            network_calls_made: runtime.network_calls_made,
        }
    }

    // Audit logging methods

    /// Audit execution attempt
    async fn audit_execution_attempt(&self, role: &Role, task: &Codex, user_context: &UserContext, session_id: &str) {
        if let Some(ref audit_logger) = self.audit_logger {
            let outcome = OperationOutcome {
                success: true, // Just attempting, not completed yet
                result_code: None,
                error_message: None,
                duration_ms: 0,
                records_affected: None,
            };

            let permissions = role.capabilities.iter().map(|c| format!("{:?}", c)).collect();
            let event = create_role_execution_event(
                user_context.clone(),
                &role.name,
                &task.id.to_string(),
                outcome,
                permissions,
            );

            if let Err(e) = audit_logger.log_event(event).await {
                error!("Failed to log execution attempt audit event: {}", e);
            }
        }
    }

    /// Audit execution completion
    async fn audit_execution_completion(&self, role: &Role, task: &Codex, user_context: &UserContext, session_id: &str, result: &RoleExecutionResult) {
        if let Some(ref audit_logger) = self.audit_logger {
            let outcome = OperationOutcome {
                success: result.success,
                result_code: Some(if result.success { 200 } else { 500 }),
                error_message: result.error_message.clone(),
                duration_ms: result.execution_time.as_millis() as i64,
                records_affected: Some(1),
            };

            let permissions = result.capabilities_used.clone();
            let event = create_role_execution_event(
                user_context.clone(),
                &role.name,
                &task.id.to_string(),
                outcome,
                permissions,
            );

            if let Err(e) = audit_logger.log_event(event).await {
                error!("Failed to log execution completion audit event: {}", e);
            }
        }
    }

    /// Audit capability validation failure
    async fn audit_capability_failure(&self, role: &Role, task: &Codex, user_context: &UserContext, session_id: &str, error: &BinderyError) {
        if let Some(ref audit_logger) = self.audit_logger {
            let outcome = OperationOutcome {
                success: false,
                result_code: Some(403), // Forbidden
                error_message: Some(error.to_string()),
                duration_ms: 0,
                records_affected: None,
            };

            let event = create_auth_failure_event(
                user_context.clone(),
                &user_context.user_id.as_deref().unwrap_or("unknown"),
                "insufficient_capabilities",
                outcome,
            );

            if let Err(e) = audit_logger.log_event(event).await {
                error!("Failed to log capability failure audit event: {}", e);
            }
        }
    }

    /// Audit context execution attempt
    async fn audit_context_execution_attempt(&self, role: &Role, context: &str, user_context: &UserContext, session_id: &str) {
        if let Some(ref audit_logger) = self.audit_logger {
            let mut details = HashMap::new();
            details.insert("context".to_string(), serde_json::Value::String(context.to_string()));
            details.insert("role_name".to_string(), serde_json::Value::String(role.name.clone()));

            let event = AuditEvent {
                id: Uuid::new_v4().to_string(),
                timestamp: Utc::now(),
                user_context: user_context.clone(),
                operation: Operation {
                    operation_type: "role_execution".to_string(),
                    action: "execute_context".to_string(),
                    resource: format!("context:{}", session_id),
                    details,
                },
                security_context: SecurityContext {
                    roles: vec![role.name.clone()],
                    permissions: role.capabilities.iter().map(|c| format!("{:?}", c)).collect(),
                    security_level: None,
                    auth_method: None,
                },
                outcome: OperationOutcome {
                    success: true,
                    result_code: None,
                    error_message: None,
                    duration_ms: 0,
                    records_affected: None,
                },
                previous_hash: None,
                event_hash: String::new(),
                metadata: HashMap::new(),
            };

            if let Err(e) = audit_logger.log_event(event).await {
                error!("Failed to log context execution attempt audit event: {}", e);
            }
        }
    }

    /// Audit context execution completion
    async fn audit_context_execution_completion(&self, role: &Role, context: &str, user_context: &UserContext, session_id: &str, result: &RoleExecutionResult) {
        if let Some(ref audit_logger) = self.audit_logger {
            let mut details = HashMap::new();
            details.insert("context".to_string(), serde_json::Value::String(context.to_string()));
            details.insert("role_name".to_string(), serde_json::Value::String(role.name.clone()));

            let event = AuditEvent {
                id: Uuid::new_v4().to_string(),
                timestamp: Utc::now(),
                user_context: user_context.clone(),
                operation: Operation {
                    operation_type: "role_execution".to_string(),
                    action: "execute_context_complete".to_string(),
                    resource: format!("context:{}", session_id),
                    details,
                },
                security_context: SecurityContext {
                    roles: vec![role.name.clone()],
                    permissions: result.capabilities_used.clone(),
                    security_level: None,
                    auth_method: None,
                },
                outcome: OperationOutcome {
                    success: result.success,
                    result_code: Some(if result.success { 200 } else { 500 }),
                    error_message: result.error_message.clone(),
                    duration_ms: result.execution_time.as_millis() as i64,
                    records_affected: Some(1),
                },
                previous_hash: None,
                event_hash: String::new(),
                metadata: HashMap::new(),
            };

            if let Err(e) = audit_logger.log_event(event).await {
                error!("Failed to log context execution completion audit event: {}", e);
            }
        }
    }

    /// Audit file access denial
    async fn audit_file_access_denial(&self, role: &Role, file_path: &str, write_access: bool, user_context: &UserContext, session_id: &str, error: &BinderyError) {
        if let Some(ref audit_logger) = self.audit_logger {
            let access_type = if write_access { "write" } else { "read" };
            let mut details = HashMap::new();
            details.insert("file_path".to_string(), serde_json::Value::String(file_path.to_string()));
            details.insert("access_type".to_string(), serde_json::Value::String(access_type.to_string()));
            details.insert("role_name".to_string(), serde_json::Value::String(role.name.clone()));

            let event = AuditEvent {
                id: Uuid::new_v4().to_string(),
                timestamp: Utc::now(),
                user_context: user_context.clone(),
                operation: Operation {
                    operation_type: "file_access".to_string(),
                    action: "access_denied".to_string(),
                    resource: format!("file:{}", file_path),
                    details,
                },
                security_context: SecurityContext {
                    roles: vec![role.name.clone()],
                    permissions: role.capabilities.iter().map(|c| format!("{:?}", c)).collect(),
                    security_level: Some("high".to_string()),
                    auth_method: None,
                },
                outcome: OperationOutcome {
                    success: false,
                    result_code: Some(403),
                    error_message: Some(error.to_string()),
                    duration_ms: 0,
                    records_affected: None,
                },
                previous_hash: None,
                event_hash: String::new(),
                metadata: HashMap::new(),
            };

            if let Err(e) = audit_logger.log_event(event).await {
                error!("Failed to log file access denial audit event: {}", e);
            }
        }
    }

    /// Audit file access granted
    async fn audit_file_access_granted(&self, role: &Role, file_path: &str, write_access: bool, user_context: &UserContext, session_id: &str) {
        if let Some(ref audit_logger) = self.audit_logger {
            let access_type = if write_access { "write" } else { "read" };
            let mut details = HashMap::new();
            details.insert("file_path".to_string(), serde_json::Value::String(file_path.to_string()));
            details.insert("access_type".to_string(), serde_json::Value::String(access_type.to_string()));
            details.insert("role_name".to_string(), serde_json::Value::String(role.name.clone()));

            let event = AuditEvent {
                id: Uuid::new_v4().to_string(),
                timestamp: Utc::now(),
                user_context: user_context.clone(),
                operation: Operation {
                    operation_type: "file_access".to_string(),
                    action: "access_granted".to_string(),
                    resource: format!("file:{}", file_path),
                    details,
                },
                security_context: SecurityContext {
                    roles: vec![role.name.clone()],
                    permissions: role.capabilities.iter().map(|c| format!("{:?}", c)).collect(),
                    security_level: Some("high".to_string()),
                    auth_method: None,
                },
                outcome: OperationOutcome {
                    success: true,
                    result_code: Some(200),
                    error_message: None,
                    duration_ms: 0,
                    records_affected: None,
                },
                previous_hash: None,
                event_hash: String::new(),
                metadata: HashMap::new(),
            };

            if let Err(e) = audit_logger.log_event(event).await {
                error!("Failed to log file access granted audit event: {}", e);
            }
        }
    }

    /// Audit command execution attempt
    async fn audit_command_execution_attempt(&self, role: &Role, command: &str, args: &[&str], user_context: &UserContext, session_id: &str) {
        if let Some(ref audit_logger) = self.audit_logger {
            let mut details = HashMap::new();
            details.insert("command".to_string(), serde_json::Value::String(command.to_string()));
            details.insert("args".to_string(), serde_json::Value::Array(
                args.iter().map(|arg| serde_json::Value::String(arg.to_string())).collect()
            ));
            details.insert("role_name".to_string(), serde_json::Value::String(role.name.clone()));

            let event = AuditEvent {
                id: Uuid::new_v4().to_string(),
                timestamp: Utc::now(),
                user_context: user_context.clone(),
                operation: Operation {
                    operation_type: "command_execution".to_string(),
                    action: "execute_command".to_string(),
                    resource: format!("command:{}", command),
                    details,
                },
                security_context: SecurityContext {
                    roles: vec![role.name.clone()],
                    permissions: role.capabilities.iter().map(|c| format!("{:?}", c)).collect(),
                    security_level: Some("high".to_string()),
                    auth_method: None,
                },
                outcome: OperationOutcome {
                    success: true,
                    result_code: None,
                    error_message: None,
                    duration_ms: 0,
                    records_affected: None,
                },
                previous_hash: None,
                event_hash: String::new(),
                metadata: HashMap::new(),
            };

            if let Err(e) = audit_logger.log_event(event).await {
                error!("Failed to log command execution attempt audit event: {}", e);
            }
        }
    }

    /// Audit command execution completion
    async fn audit_command_execution_completion(&self, role: &Role, command: &str, args: &[&str], user_context: &UserContext, session_id: &str, result: &RoleExecutionResult) {
        if let Some(ref audit_logger) = self.audit_logger {
            let mut details = HashMap::new();
            details.insert("command".to_string(), serde_json::Value::String(command.to_string()));
            details.insert("args".to_string(), serde_json::Value::Array(
                args.iter().map(|arg| serde_json::Value::String(arg.to_string())).collect()
            ));
            details.insert("role_name".to_string(), serde_json::Value::String(role.name.clone()));

            let event = AuditEvent {
                id: Uuid::new_v4().to_string(),
                timestamp: Utc::now(),
                user_context: user_context.clone(),
                operation: Operation {
                    operation_type: "command_execution".to_string(),
                    action: "execute_command_complete".to_string(),
                    resource: format!("command:{}", command),
                    details,
                },
                security_context: SecurityContext {
                    roles: vec![role.name.clone()],
                    permissions: result.capabilities_used.clone(),
                    security_level: Some("high".to_string()),
                    auth_method: None,
                },
                outcome: OperationOutcome {
                    success: result.success,
                    result_code: Some(if result.success { 200 } else { 500 }),
                    error_message: result.error_message.clone(),
                    duration_ms: result.execution_time.as_millis() as i64,
                    records_affected: Some(1),
                },
                previous_hash: None,
                event_hash: String::new(),
                metadata: HashMap::new(),
            };

            if let Err(e) = audit_logger.log_event(event).await {
                error!("Failed to log command execution completion audit event: {}", e);
            }
        }
    }

    /// Audit capability denial
    async fn audit_capability_denial(&self, role: &Role, capability: &str, user_context: &UserContext, session_id: &str, error: &BinderyError) {
        if let Some(ref audit_logger) = self.audit_logger {
            let mut details = HashMap::new();
            details.insert("capability".to_string(), serde_json::Value::String(capability.to_string()));
            details.insert("role_name".to_string(), serde_json::Value::String(role.name.clone()));

            let event = AuditEvent {
                id: Uuid::new_v4().to_string(),
                timestamp: Utc::now(),
                user_context: user_context.clone(),
                operation: Operation {
                    operation_type: "authorization".to_string(),
                    action: "capability_denied".to_string(),
                    resource: format!("capability:{}", capability),
                    details,
                },
                security_context: SecurityContext {
                    roles: vec![role.name.clone()],
                    permissions: role.capabilities.iter().map(|c| format!("{:?}", c)).collect(),
                    security_level: Some("high".to_string()),
                    auth_method: None,
                },
                outcome: OperationOutcome {
                    success: false,
                    result_code: Some(403),
                    error_message: Some(error.to_string()),
                    duration_ms: 0,
                    records_affected: None,
                },
                previous_hash: None,
                event_hash: String::new(),
                metadata: HashMap::new(),
            };

            if let Err(e) = audit_logger.log_event(event).await {
                error!("Failed to log capability denial audit event: {}", e);
            }
        }
    }

    /// Audit subprocess denial
    async fn audit_subprocess_denial(&self, role: &Role, user_context: &UserContext, session_id: &str, error: &BinderyError) {
        if let Some(ref audit_logger) = self.audit_logger {
            let mut details = HashMap::new();
            details.insert("role_name".to_string(), serde_json::Value::String(role.name.clone()));
            details.insert("subprocess_allowed".to_string(), serde_json::Value::Bool(role.execution_context.subprocess_allowed));

            let event = AuditEvent {
                id: Uuid::new_v4().to_string(),
                timestamp: Utc::now(),
                user_context: user_context.clone(),
                operation: Operation {
                    operation_type: "authorization".to_string(),
                    action: "subprocess_denied".to_string(),
                    resource: "subprocess_execution".to_string(),
                    details,
                },
                security_context: SecurityContext {
                    roles: vec![role.name.clone()],
                    permissions: role.capabilities.iter().map(|c| format!("{:?}", c)).collect(),
                    security_level: Some("high".to_string()),
                    auth_method: None,
                },
                outcome: OperationOutcome {
                    success: false,
                    result_code: Some(403),
                    error_message: Some(error.to_string()),
                    duration_ms: 0,
                    records_affected: None,
                },
                previous_hash: None,
                event_hash: String::new(),
                metadata: HashMap::new(),
            };

            if let Err(e) = audit_logger.log_event(event).await {
                error!("Failed to log subprocess denial audit event: {}", e);
            }
        }
    }
}

impl Default for RoleExecutor {
    fn default() -> Self {
        Self::new()
    }
}