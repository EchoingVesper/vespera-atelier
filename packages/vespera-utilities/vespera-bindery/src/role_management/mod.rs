/// Role Management System for Vespera Bindery
/// 
/// This module migrates the existing Python role system to Rust, providing
/// capability-restricted task execution with file pattern matching.

pub mod manager;
pub mod definitions;
pub mod executor;

pub use manager::RoleManager;
// Note: Role struct is defined below, so we don't import it from definitions
pub use executor::RoleExecutor;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Tool group enumeration defining capability categories
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ToolGroup {
    FileOperations,
    ProcessExecution,
    NetworkAccess,
    SystemInfo,
    DatabaseAccess,
    WebScraping,
    ApiCalls,
    GitOperations,
    PackageManagement,
    Testing,
    Deployment,
    Monitoring,
    Security,
    AiLlm,
    Development,
}

/// Role definition with capabilities and restrictions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Role {
    pub name: String,
    pub description: String,
    pub capabilities: Vec<ToolGroup>,
    pub file_restrictions: FileRestrictions,
    pub execution_context: ExecutionContext,
    pub metadata: HashMap<String, serde_json::Value>,
}

/// File access restrictions for roles
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileRestrictions {
    pub allowed_read_patterns: Vec<String>,
    pub allowed_write_patterns: Vec<String>,
    pub denied_patterns: Vec<String>,
    pub working_directory_restrictions: Vec<String>,
}

/// Execution context configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionContext {
    pub max_execution_time: Option<u64>, // seconds
    pub max_memory_usage: Option<u64>,   // MB
    pub network_access: bool,
    pub subprocess_allowed: bool,
    pub environment_variables: HashMap<String, String>,
}

/// Role execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoleExecutionResult {
    pub success: bool,
    pub output: Option<String>,
    pub error: Option<String>,
    pub duration: std::time::Duration,
    pub files_accessed: Vec<String>,
    pub tools_used: Vec<String>,
    pub exit_code: Option<i32>,
}

impl Default for FileRestrictions {
    fn default() -> Self {
        Self {
            allowed_read_patterns: vec!["**/*".to_string()],
            allowed_write_patterns: vec!["**/*".to_string()],
            denied_patterns: vec![
                "/etc/**".to_string(),
                "/root/**".to_string(),
                "/home/*/.ssh/**".to_string(),
                "**/*.key".to_string(),
                "**/*.pem".to_string(),
                "**/id_rsa*".to_string(),
                "**/id_ed25519*".to_string(),
            ],
            working_directory_restrictions: vec!["./".to_string()],
        }
    }
}

impl Default for ExecutionContext {
    fn default() -> Self {
        Self {
            max_execution_time: Some(300), // 5 minutes
            max_memory_usage: Some(512),   // 512MB
            network_access: false,
            subprocess_allowed: false,
            environment_variables: HashMap::new(),
        }
    }
}

impl Role {
    /// Create a new role with basic defaults
    pub fn new(name: String, description: String, capabilities: Vec<ToolGroup>) -> Self {
        Self {
            name,
            description,
            capabilities,
            file_restrictions: FileRestrictions::default(),
            execution_context: ExecutionContext::default(),
            metadata: HashMap::new(),
        }
    }

    /// Check if role has a specific capability
    pub fn has_capability(&self, capability: &ToolGroup) -> bool {
        self.capabilities.contains(capability)
    }

    /// Check if role can access a file path
    pub fn can_access_file(&self, path: &str, write_access: bool) -> bool {
        // Check denied patterns first
        for pattern in &self.file_restrictions.denied_patterns {
            if glob_match(pattern, path) {
                return false;
            }
        }

        // Check allowed patterns
        let patterns = if write_access {
            &self.file_restrictions.allowed_write_patterns
        } else {
            &self.file_restrictions.allowed_read_patterns
        };

        patterns.iter().any(|pattern| glob_match(pattern, path))
    }
}

// Simple glob matching implementation
fn glob_match(pattern: &str, text: &str) -> bool {
    let pattern = pattern.replace("**", "*");
    let regex_pattern = pattern
        .replace(".", "\\.")
        .replace("*", ".*")
        .replace("?", ".");
    
    if let Ok(regex) = regex::Regex::new(&format!("^{}$", regex_pattern)) {
        regex.is_match(text)
    } else {
        false
    }
}