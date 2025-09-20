/// Role Manager - Centralized role definition and validation system
/// 
/// This manager loads role definitions and provides runtime validation
/// for capability-restricted task execution.

use super::{Role, ToolGroup, FileRestrictions, ExecutionContext, RoleExecutionResult};
use crate::codex::Codex;
use crate::errors::{BinderyError, BinderyResult};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde_yaml;
use std::path::Path;

/// Role manager for loading and validating roles
#[derive(Debug)]
pub struct RoleManager {
    roles: Arc<RwLock<HashMap<String, Role>>>,
}

impl RoleManager {
    /// Create a new role manager and load default roles
    pub async fn new() -> BinderyResult<Self> {
        let manager = Self {
            roles: Arc::new(RwLock::new(HashMap::new())),
        };

        // Load default roles
        manager.load_default_roles().await?;

        Ok(manager)
    }

    /// Create a default role manager for testing/development
    pub fn default() -> Self {
        Self {
            roles: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Load roles from a YAML file
    pub async fn load_roles_from_file<P: AsRef<Path>>(&self, path: P) -> BinderyResult<()> {
        let content = tokio::fs::read_to_string(path).await
            .map_err(|e| BinderyError::IoError(e.to_string()))?;

        let roles_data: HashMap<String, serde_yaml::Value> = serde_yaml::from_str(&content)
            .map_err(|e| BinderyError::InvalidInput(format!("Invalid YAML: {}", e)))?;

        let mut roles = self.roles.write().await;

        for (role_name, role_data) in roles_data {
            let role = self.parse_role_definition(&role_name, role_data)?;
            roles.insert(role_name, role);
        }

        Ok(())
    }

    /// Get a role by name
    pub async fn get_role(&self, name: &str) -> Option<Role> {
        self.roles.read().await.get(name).cloned()
    }

    /// Check if a role exists
    pub async fn role_exists(&self, name: &str) -> bool {
        self.roles.read().await.contains_key(name)
    }

    /// List all available roles
    pub async fn list_roles(&self) -> Vec<Role> {
        self.roles.read().await.values().cloned().collect()
    }

    /// Execute a task with a specific role
    pub async fn execute_task_with_role(&self, task: &Codex, role_name: &str) -> BinderyResult<String> {
        let role = self.get_role(role_name).await
            .ok_or_else(|| BinderyError::NotFound(format!("Role '{}'", role_name)))?;

        // Validate task requirements against role capabilities
        self.validate_task_for_role(task, &role).await?;

        // Execute the task (simplified for now - would integrate with actual execution system)
        let result = self.execute_with_restrictions(task, &role).await?;

        if result.success {
            Ok(result.output.unwrap_or_else(|| "Task completed successfully".to_string()))
        } else {
            Err(BinderyError::ExecutionError(
                result.error.unwrap_or_else(|| "Task execution failed".to_string())
            ))
        }
    }

    /// Validate that a task can be executed by a role
    pub async fn validate_task_for_role(&self, task: &Codex, role: &Role) -> BinderyResult<()> {
        // Check if task requires capabilities the role doesn't have
        let required_capabilities = self.extract_required_capabilities(task);
        
        for capability in required_capabilities {
            if !role.has_capability(&capability) {
                return Err(BinderyError::PermissionDenied(
                    format!("Role '{}' lacks required capability: {:?}", role.name, capability)
                ));
            }
        }

        // Validate file access patterns if task specifies file operations
        if let Some(file_patterns) = self.extract_file_patterns(task) {
            for (path, write_access) in file_patterns {
                if !role.can_access_file(&path, write_access) {
                    return Err(BinderyError::PermissionDenied(
                        format!("Role '{}' cannot access file: {}", role.name, path)
                    ));
                }
            }
        }

        Ok(())
    }

    /// Add or update a role definition
    pub async fn add_role(&self, role: Role) -> BinderyResult<()> {
        let mut roles = self.roles.write().await;
        roles.insert(role.name.clone(), role);
        Ok(())
    }

    /// Remove a role definition
    pub async fn remove_role(&self, name: &str) -> BinderyResult<bool> {
        let mut roles = self.roles.write().await;
        Ok(roles.remove(name).is_some())
    }

    // Private helper methods

    async fn load_default_roles(&self) -> BinderyResult<()> {
        let default_roles = vec![
            Role {
                name: "default_agent".to_string(),
                description: "Basic agent with limited file and system access".to_string(),
                capabilities: vec![
                    ToolGroup::FileOperations,
                    ToolGroup::SystemInfo,
                    ToolGroup::Development,
                ],
                file_restrictions: FileRestrictions {
                    allowed_read_patterns: vec!["./src/**".to_string(), "./docs/**".to_string()],
                    allowed_write_patterns: vec!["./src/**".to_string(), "./target/**".to_string()],
                    denied_patterns: FileRestrictions::default().denied_patterns,
                    working_directory_restrictions: vec!["./".to_string()],
                },
                execution_context: ExecutionContext::default(),
                metadata: HashMap::new(),
            },

            Role {
                name: "frontend_developer".to_string(),
                description: "Frontend development with web technologies access".to_string(),
                capabilities: vec![
                    ToolGroup::FileOperations,
                    ToolGroup::ProcessExecution,
                    ToolGroup::NetworkAccess,
                    ToolGroup::PackageManagement,
                    ToolGroup::Testing,
                    ToolGroup::Development,
                ],
                file_restrictions: FileRestrictions {
                    allowed_read_patterns: vec![
                        "./src/**".to_string(),
                        "./public/**".to_string(),
                        "./tests/**".to_string(),
                        "./package.json".to_string(),
                        "./tsconfig.json".to_string(),
                    ],
                    allowed_write_patterns: vec![
                        "./src/**".to_string(),
                        "./public/**".to_string(),
                        "./tests/**".to_string(),
                        "./dist/**".to_string(),
                        "./node_modules/**".to_string(),
                    ],
                    denied_patterns: FileRestrictions::default().denied_patterns,
                    working_directory_restrictions: vec!["./".to_string()],
                },
                execution_context: ExecutionContext {
                    max_execution_time: Some(600), // 10 minutes
                    network_access: true,
                    subprocess_allowed: true,
                    ..ExecutionContext::default()
                },
                metadata: HashMap::new(),
            },

            Role {
                name: "backend_developer".to_string(),
                description: "Backend development with database and API access".to_string(),
                capabilities: vec![
                    ToolGroup::FileOperations,
                    ToolGroup::ProcessExecution,
                    ToolGroup::DatabaseAccess,
                    ToolGroup::ApiCalls,
                    ToolGroup::Testing,
                    ToolGroup::Development,
                ],
                file_restrictions: FileRestrictions {
                    allowed_read_patterns: vec![
                        "./src/**".to_string(),
                        "./tests/**".to_string(),
                        "./Cargo.toml".to_string(),
                        "./requirements.txt".to_string(),
                    ],
                    allowed_write_patterns: vec![
                        "./src/**".to_string(),
                        "./tests/**".to_string(),
                        "./target/**".to_string(),
                        "./migrations/**".to_string(),
                    ],
                    denied_patterns: FileRestrictions::default().denied_patterns,
                    working_directory_restrictions: vec!["./".to_string()],
                },
                execution_context: ExecutionContext {
                    max_execution_time: Some(900), // 15 minutes
                    network_access: true,
                    subprocess_allowed: true,
                    ..ExecutionContext::default()
                },
                metadata: HashMap::new(),
            },

            Role {
                name: "devops_engineer".to_string(),
                description: "DevOps with deployment and monitoring capabilities".to_string(),
                capabilities: vec![
                    ToolGroup::FileOperations,
                    ToolGroup::ProcessExecution,
                    ToolGroup::NetworkAccess,
                    ToolGroup::Deployment,
                    ToolGroup::Monitoring,
                    ToolGroup::GitOperations,
                    ToolGroup::PackageManagement,
                ],
                file_restrictions: FileRestrictions {
                    allowed_read_patterns: vec![
                        "./**".to_string(),
                        "/etc/nginx/**".to_string(),
                        "/var/log/**".to_string(),
                    ],
                    allowed_write_patterns: vec![
                        "./deploy/**".to_string(),
                        "./docker/**".to_string(),
                        "./k8s/**".to_string(),
                        "/tmp/**".to_string(),
                    ],
                    denied_patterns: vec![
                        "/etc/passwd".to_string(),
                        "/etc/shadow".to_string(),
                        "**/*.key".to_string(),
                        "**/*.pem".to_string(),
                    ],
                    working_directory_restrictions: vec!["./".to_string(), "/tmp/".to_string()],
                },
                execution_context: ExecutionContext {
                    max_execution_time: Some(1800), // 30 minutes
                    network_access: true,
                    subprocess_allowed: true,
                    ..ExecutionContext::default()
                },
                metadata: HashMap::new(),
            },

            Role {
                name: "security_auditor".to_string(),
                description: "Security analysis with restricted modification access".to_string(),
                capabilities: vec![
                    ToolGroup::FileOperations,
                    ToolGroup::Security,
                    ToolGroup::SystemInfo,
                    ToolGroup::NetworkAccess,
                    ToolGroup::Testing,
                ],
                file_restrictions: FileRestrictions {
                    allowed_read_patterns: vec!["./**".to_string()],
                    allowed_write_patterns: vec![
                        "./security-reports/**".to_string(),
                        "./tmp/**".to_string(),
                    ],
                    denied_patterns: vec![
                        "/etc/**".to_string(),
                        "/root/**".to_string(),
                        "/home/*/.ssh/**".to_string(),
                        "**/*.key".to_string(),
                        "**/*.pem".to_string(),
                        "**/id_rsa*".to_string(),
                    ],
                    working_directory_restrictions: vec!["./".to_string()],
                },
                execution_context: ExecutionContext {
                    max_execution_time: Some(1200), // 20 minutes
                    network_access: true,
                    subprocess_allowed: false, // Restricted subprocess access
                    ..ExecutionContext::default()
                },
                metadata: HashMap::new(),
            },
        ];

        let mut roles = self.roles.write().await;
        for role in default_roles {
            roles.insert(role.name.clone(), role);
        }

        Ok(())
    }

    fn parse_role_definition(&self, name: &str, data: serde_yaml::Value) -> BinderyResult<Role> {
        // Convert YAML to Role struct (simplified implementation)
        let description = data.get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let capabilities = data.get("capabilities")
            .and_then(|v| v.as_sequence())
            .map(|seq| {
                seq.iter()
                    .filter_map(|v| v.as_str())
                    .filter_map(|s| self.parse_tool_group(s))
                    .collect()
            })
            .unwrap_or_default();

        Ok(Role {
            name: name.to_string(),
            description,
            capabilities,
            file_restrictions: FileRestrictions::default(), // TODO: Parse from YAML
            execution_context: ExecutionContext::default(),  // TODO: Parse from YAML
            metadata: HashMap::new(),
        })
    }

    fn parse_tool_group(&self, s: &str) -> Option<ToolGroup> {
        match s {
            "file_operations" => Some(ToolGroup::FileOperations),
            "process_execution" => Some(ToolGroup::ProcessExecution),
            "network_access" => Some(ToolGroup::NetworkAccess),
            "system_info" => Some(ToolGroup::SystemInfo),
            "database_access" => Some(ToolGroup::DatabaseAccess),
            "web_scraping" => Some(ToolGroup::WebScraping),
            "api_calls" => Some(ToolGroup::ApiCalls),
            "git_operations" => Some(ToolGroup::GitOperations),
            "package_management" => Some(ToolGroup::PackageManagement),
            "testing" => Some(ToolGroup::Testing),
            "deployment" => Some(ToolGroup::Deployment),
            "monitoring" => Some(ToolGroup::Monitoring),
            "security" => Some(ToolGroup::Security),
            "ai_llm" => Some(ToolGroup::AiLlm),
            "development" => Some(ToolGroup::Development),
            _ => None,
        }
    }

    fn extract_required_capabilities(&self, task: &Codex) -> Vec<ToolGroup> {
        // Analyze task content to determine required capabilities
        // This is a simplified implementation - would analyze task description,
        // attached files, commands, etc.
        
        let mut capabilities = vec![ToolGroup::Development]; // Always require basic development

        // Check task content for capability hints
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
                
                if desc_lower.contains("git") {
                    capabilities.push(ToolGroup::GitOperations);
                }
            }
        }

        capabilities
    }

    fn extract_file_patterns(&self, task: &Codex) -> Option<Vec<(String, bool)>> {
        // Extract file patterns from task content
        // Return tuples of (path_pattern, requires_write_access)
        
        // This is a simplified implementation
        let mut patterns = Vec::new();
        
        // Check for code references
        if let Some(code_refs) = task.content.template_fields.get("code_references") {
            if let Some(refs_array) = code_refs.as_array() {
                for ref_val in refs_array {
                    if let Some(path) = ref_val.as_str() {
                        patterns.push((path.to_string(), false)); // Read access
                    }
                }
            }
        }

        // Check for source references that might be files
        if let Some(source_refs) = task.content.template_fields.get("source_references") {
            if let Some(refs_array) = source_refs.as_array() {
                for ref_val in refs_array {
                    if let Some(path) = ref_val.as_str() {
                        if path.starts_with("file://") {
                            let file_path = path.strip_prefix("file://").unwrap_or(path);
                            patterns.push((file_path.to_string(), false)); // Read access
                        }
                    }
                }
            }
        }

        if patterns.is_empty() {
            None
        } else {
            Some(patterns)
        }
    }

    async fn execute_with_restrictions(&self, task: &Codex, role: &Role) -> BinderyResult<RoleExecutionResult> {
        // This is a placeholder for actual task execution
        // In reality, this would integrate with the task execution system
        // and enforce role restrictions during execution
        
        let start_time = std::time::Instant::now();
        
        // Simulate task execution
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        
        let duration = start_time.elapsed();
        
        Ok(RoleExecutionResult {
            success: true,
            output: Some(format!("Task '{}' executed successfully with role '{}'", task.title, role.name)),
            error: None,
            duration,
            files_accessed: vec![],
            tools_used: role.capabilities.iter().map(|c| format!("{:?}", c)).collect(),
            exit_code: Some(0),
        })
    }
}