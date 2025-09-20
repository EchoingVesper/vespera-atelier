/// Role executor - Handles role-based task execution
///
/// This module provides role execution functionality that validates
/// and executes tasks based on role capabilities. It implements the
/// actual execution logic with capability restrictions, file access
/// controls, and security constraints.

use super::{Role, RoleExecutionResult, ToolGroup};
use crate::codex::Codex;
use crate::errors::{BinderyError, BinderyResult};
use std::collections::HashSet;
use std::time::Instant;
use tracing::{info, debug};
use tokio::fs;

/// Role executor for capability-restricted execution
///
/// This executor implements the core logic for executing tasks within
/// the constraints defined by roles. It provides security through
/// capability validation, file access controls, and execution timeouts.
#[derive(Debug)]
pub struct RoleExecutor {
    // Currently stateless - all state is passed through parameters
}

/// Execution runtime for tracking resource usage
#[derive(Debug)]
pub struct ExecutionRuntime {
    start_time: Instant,
    files_accessed: HashSet<String>,
    tools_used: HashSet<String>,
    max_memory_bytes: Option<u64>,
    network_calls_made: u32,
}

impl RoleExecutor {
    /// Create a new role executor
    pub fn new() -> Self {
        Self {}
    }

    /// Execute a task with role constraints
    ///
    /// This is the main execution method that:
    /// 1. Validates role capabilities for the task
    /// 2. Sets up execution environment with restrictions
    /// 3. Executes the task with monitoring
    /// 4. Validates all file access against role permissions
    /// 5. Returns detailed execution results
    pub async fn execute_with_role(&self, role: &Role, task: &Codex) -> BinderyResult<RoleExecutionResult> {
        let start_time = Instant::now();
        let mut runtime = ExecutionRuntime {
            start_time,
            files_accessed: HashSet::new(),
            tools_used: HashSet::new(),
            max_memory_bytes: role.execution_context.max_memory_usage.map(|mb| mb * 1024 * 1024),
            network_calls_made: 0,
        };

        info!("Starting role-based execution: task {} with role {}", task.id, role.name);

        // Validate role capabilities for this task
        self.validate_task_capabilities(role, task, &mut runtime)?;

        // Execute the task based on its type and content
        let result = self.execute_task_logic(role, task, &mut runtime).await;

        let duration = start_time.elapsed();
        let execution_result = self.create_execution_result(role, result, runtime, duration).await;

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
    pub async fn execute_with_context(&self, role: &Role, context: &str) -> BinderyResult<RoleExecutionResult> {
        let start_time = Instant::now();
        let mut runtime = ExecutionRuntime {
            start_time,
            files_accessed: HashSet::new(),
            tools_used: HashSet::new(),
            max_memory_bytes: role.execution_context.max_memory_usage.map(|mb| mb * 1024 * 1024),
            network_calls_made: 0,
        };

        info!("Starting context-based execution with role {}", role.name);

        // Parse and execute the context
        let result = self.execute_context_logic(role, context, &mut runtime).await;

        let duration = start_time.elapsed();
        let execution_result = self.create_execution_result(role, result, runtime, duration).await;

        info!(
            "Context-based execution completed with role {} (success: {})",
            role.name, execution_result.success
        );

        Ok(execution_result)
    }

    /// Validate file access permissions
    pub async fn validate_file_access(&self, role: &Role, file_path: &str, write_access: bool) -> BinderyResult<()> {
        if !role.can_access_file(file_path, write_access) {
            let access_type = if write_access { "write" } else { "read" };
            return Err(BinderyError::PermissionDenied(
                format!("Role '{}' does not have {} access to file: {}", role.name, access_type, file_path)
            ));
        }
        Ok(())
    }

    /// Execute a command with capability and file restrictions
    pub async fn execute_command(&self, role: &Role, command: &str, args: &[&str]) -> BinderyResult<RoleExecutionResult> {
        let start_time = Instant::now();
        let mut runtime = ExecutionRuntime {
            start_time,
            files_accessed: HashSet::new(),
            tools_used: HashSet::new(),
            max_memory_bytes: role.execution_context.max_memory_usage.map(|mb| mb * 1024 * 1024),
            network_calls_made: 0,
        };

        // Check if role allows process execution
        if !role.has_capability(&ToolGroup::ProcessExecution) {
            return Err(BinderyError::PermissionDenied(
                format!("Role '{}' does not have process execution capability", role.name)
            ));
        }

        if !role.execution_context.subprocess_allowed {
            return Err(BinderyError::PermissionDenied(
                format!("Role '{}' does not allow subprocess execution", role.name)
            ));
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

        let url = task.content.template_fields.get("url")
            .and_then(|v| v.as_str())
            .ok_or_else(|| BinderyError::InvalidInput("Missing URL in network request task".to_string()))?;

        runtime.tools_used.insert("network_access".to_string());
        runtime.network_calls_made += 1;

        // Simulate network request (in real implementation, would use reqwest or similar)
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        Ok(format!("Network request completed: {}", url))
    }

    /// Execute general tasks
    async fn execute_general_task(&self, role: &Role, task: &Codex, runtime: &mut ExecutionRuntime) -> Result<String, BinderyError> {
        runtime.tools_used.insert("general_execution".to_string());

        // Simulate general task execution
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;

        Ok(format!(
            "General task '{}' executed successfully with role '{}'",
            task.title, role.name
        ))
    }

    /// Read a file with role validation
    async fn read_file_with_validation(&self, role: &Role, file_path: &str, runtime: &mut ExecutionRuntime) -> Result<String, BinderyError> {
        self.validate_file_access(role, file_path, false).await?;

        runtime.files_accessed.insert(file_path.to_string());

        match fs::read_to_string(file_path).await {
            Ok(content) => Ok(format!("Read {} bytes from {}", content.len(), file_path)),
            Err(e) => Err(BinderyError::IoError(format!("Failed to read {}: {}", file_path, e))),
        }
    }

    /// Write a file with role validation
    async fn write_file_with_validation(&self, role: &Role, file_path: &str, content: &str, runtime: &mut ExecutionRuntime) -> Result<String, BinderyError> {
        self.validate_file_access(role, file_path, true).await?;

        runtime.files_accessed.insert(file_path.to_string());

        match fs::write(file_path, content).await {
            Ok(()) => Ok(format!("Wrote {} bytes to {}", content.len(), file_path)),
            Err(e) => Err(BinderyError::IoError(format!("Failed to write {}: {}", file_path, e))),
        }
    }

    /// Delete a file with role validation
    async fn delete_file_with_validation(&self, role: &Role, file_path: &str, runtime: &mut ExecutionRuntime) -> Result<String, BinderyError> {
        self.validate_file_access(role, file_path, true).await?;

        runtime.files_accessed.insert(file_path.to_string());

        match fs::remove_file(file_path).await {
            Ok(()) => Ok(format!("Deleted file {}", file_path)),
            Err(e) => Err(BinderyError::IoError(format!("Failed to delete {}: {}", file_path, e))),
        }
    }

    /// Run a command with monitoring
    async fn run_command(&self, command: &str, args: &[&str], runtime: &mut ExecutionRuntime) -> Result<String, BinderyError> {
        debug!("Executing command: {} {:?}", command, args);

        // Use tokio::process for async command execution
        let output = tokio::process::Command::new(command)
            .args(args)
            .output()
            .await
            .map_err(|e| BinderyError::ExecutionError(format!("Failed to execute command: {}", e)))?;

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            Ok(format!("Command executed successfully: {}", stdout.trim()))
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(BinderyError::ExecutionError(format!("Command failed: {}", stderr.trim())))
        }
    }

    /// Extract required capabilities from task content
    fn extract_required_capabilities(&self, task: &Codex) -> BinderyResult<Vec<ToolGroup>> {
        let mut capabilities = vec![ToolGroup::Development]; // Always require basic development

        // Analyze task content for capability requirements
        if let Some(description) = task.content.template_fields.get("description") {
            if let Some(desc_str) = description.as_str() {
                let desc_lower = desc_str.to_lowercase();

                if desc_lower.contains("file") || desc_lower.contains("read") || desc_lower.contains("write") {
                    capabilities.push(ToolGroup::FileOperations);
                }

                if desc_lower.contains("network") || desc_lower.contains("http") || desc_lower.contains("api") {
                    capabilities.push(ToolGroup::NetworkAccess);
                    capabilities.push(ToolGroup::ApiCalls);
                }

                if desc_lower.contains("database") || desc_lower.contains("sql") {
                    capabilities.push(ToolGroup::DatabaseAccess);
                }

                if desc_lower.contains("test") {
                    capabilities.push(ToolGroup::Testing);
                }

                if desc_lower.contains("deploy") {
                    capabilities.push(ToolGroup::Deployment);
                }

                if desc_lower.contains("command") || desc_lower.contains("execute") || desc_lower.contains("run") {
                    capabilities.push(ToolGroup::ProcessExecution);
                }
            }
        }

        // Check task type for specific capability requirements
        if let Some(task_type) = task.content.template_fields.get("task_type") {
            if let Some(type_str) = task_type.as_str() {
                match type_str {
                    "file_operation" => capabilities.push(ToolGroup::FileOperations),
                    "command_execution" => capabilities.push(ToolGroup::ProcessExecution),
                    "network_request" => {
                        capabilities.push(ToolGroup::NetworkAccess);
                        capabilities.push(ToolGroup::ApiCalls);
                    },
                    "database_query" => capabilities.push(ToolGroup::DatabaseAccess),
                    _ => {}
                }
            }
        }

        // Remove duplicates
        capabilities.sort();
        capabilities.dedup();

        Ok(capabilities)
    }

    /// Create execution result from runtime data
    async fn create_execution_result(
        &self,
        role: &Role,
        result: Result<String, BinderyError>,
        runtime: ExecutionRuntime,
        duration: std::time::Duration,
    ) -> RoleExecutionResult {
        match result {
            Ok(output) => RoleExecutionResult {
                success: true,
                output: Some(output),
                error: None,
                duration,
                files_accessed: runtime.files_accessed.into_iter().collect(),
                tools_used: runtime.tools_used.into_iter().collect(),
                exit_code: Some(0),
            },
            Err(error) => RoleExecutionResult {
                success: false,
                output: None,
                error: Some(error.to_string()),
                duration,
                files_accessed: runtime.files_accessed.into_iter().collect(),
                tools_used: runtime.tools_used.into_iter().collect(),
                exit_code: Some(1),
            },
        }
    }
}