//! Tests for Role Management functionality
//!
//! This module tests role definitions, capability restrictions, file access controls,
//! execution context validation, and role-based task execution.

use std::collections::HashMap;
use std::time::Duration;

use crate::{
    role_management::{
        RoleManager, Role, ToolGroup, FileRestrictions, ExecutionContext,
        RoleExecutionResult, RoleExecutor
    },
    tests::utils::{create_mock_role, TestFixture},
};

#[cfg(test)]
mod tool_group_tests {
    use super::*;

    #[tokio::test]
    async fn test_tool_group_serialization() {
        let tool_groups = vec![
            ToolGroup::FileOperations,
            ToolGroup::ProcessExecution,
            ToolGroup::NetworkAccess,
            ToolGroup::SystemInfo,
            ToolGroup::DatabaseAccess,
            ToolGroup::WebScraping,
            ToolGroup::ApiCalls,
            ToolGroup::GitOperations,
            ToolGroup::PackageManagement,
            ToolGroup::Testing,
            ToolGroup::Deployment,
            ToolGroup::Monitoring,
            ToolGroup::Security,
            ToolGroup::AiLlm,
            ToolGroup::Development,
        ];

        for tool_group in tool_groups {
            let json_str = serde_json::to_string(&tool_group).expect("Should serialize tool group");
            let deserialized: ToolGroup = serde_json::from_str(&json_str).expect("Should deserialize tool group");
            assert_eq!(tool_group, deserialized, "Tool group should roundtrip");
        }
    }

    #[tokio::test]
    async fn test_tool_group_equality() {
        assert_eq!(ToolGroup::FileOperations, ToolGroup::FileOperations);
        assert_ne!(ToolGroup::FileOperations, ToolGroup::NetworkAccess);

        // Test that tool groups can be used in hash sets/maps
        let mut tool_set = std::collections::HashSet::new();
        tool_set.insert(ToolGroup::FileOperations);
        tool_set.insert(ToolGroup::GitOperations);
        tool_set.insert(ToolGroup::FileOperations); // Duplicate

        assert_eq!(tool_set.len(), 2, "Should have only unique tool groups");
        assert!(tool_set.contains(&ToolGroup::FileOperations));
        assert!(tool_set.contains(&ToolGroup::GitOperations));
        assert!(!tool_set.contains(&ToolGroup::NetworkAccess));
    }
}

#[cfg(test)]
mod file_restrictions_tests {
    use super::*;

    #[tokio::test]
    async fn test_file_restrictions_default() {
        let restrictions = FileRestrictions::default();

        assert!(!restrictions.allowed_read_patterns.is_empty());
        assert!(!restrictions.allowed_write_patterns.is_empty());
        assert!(!restrictions.denied_patterns.is_empty());
        assert!(!restrictions.working_directory_restrictions.is_empty());

        // Check that security-sensitive patterns are denied by default
        assert!(restrictions.denied_patterns.contains(&"/etc/**".to_string()));
        assert!(restrictions.denied_patterns.contains(&"/root/**".to_string()));
        assert!(restrictions.denied_patterns.contains(&"**/*.key".to_string()));
        assert!(restrictions.denied_patterns.contains(&"**/*.pem".to_string()));
    }

    #[tokio::test]
    async fn test_file_restrictions_serialization() {
        let restrictions = FileRestrictions {
            allowed_read_patterns: vec!["src/**".to_string(), "docs/**".to_string()],
            allowed_write_patterns: vec!["target/**".to_string(), "build/**".to_string()],
            denied_patterns: vec!["/etc/**".to_string(), "**/*.secret".to_string()],
            working_directory_restrictions: vec!["./project/**".to_string()],
        };

        let json_str = serde_json::to_string(&restrictions).expect("Should serialize file restrictions");
        let deserialized: FileRestrictions = serde_json::from_str(&json_str).expect("Should deserialize file restrictions");

        assert_eq!(deserialized.allowed_read_patterns, restrictions.allowed_read_patterns);
        assert_eq!(deserialized.allowed_write_patterns, restrictions.allowed_write_patterns);
        assert_eq!(deserialized.denied_patterns, restrictions.denied_patterns);
        assert_eq!(deserialized.working_directory_restrictions, restrictions.working_directory_restrictions);
    }
}

#[cfg(test)]
mod execution_context_tests {
    use super::*;

    #[tokio::test]
    async fn test_execution_context_default() {
        let context = ExecutionContext::default();

        assert_eq!(context.max_execution_time, Some(300)); // 5 minutes
        assert_eq!(context.max_memory_usage, Some(512));   // 512MB
        assert!(!context.network_access);
        assert!(!context.subprocess_allowed);
        assert!(context.environment_variables.is_empty());
    }

    #[tokio::test]
    async fn test_execution_context_custom() {
        let mut env_vars = HashMap::new();
        env_vars.insert("NODE_ENV".to_string(), "development".to_string());
        env_vars.insert("API_KEY".to_string(), "test_key".to_string());

        let context = ExecutionContext {
            max_execution_time: Some(600), // 10 minutes
            max_memory_usage: Some(1024),  // 1GB
            network_access: true,
            subprocess_allowed: true,
            environment_variables: env_vars.clone(),
        };

        assert_eq!(context.max_execution_time, Some(600));
        assert_eq!(context.max_memory_usage, Some(1024));
        assert!(context.network_access);
        assert!(context.subprocess_allowed);
        assert_eq!(context.environment_variables.len(), 2);
        assert_eq!(context.environment_variables["NODE_ENV"], "development");

        // Test serialization
        let json_str = serde_json::to_string(&context).expect("Should serialize execution context");
        let deserialized: ExecutionContext = serde_json::from_str(&json_str).expect("Should deserialize execution context");

        assert_eq!(deserialized.max_execution_time, context.max_execution_time);
        assert_eq!(deserialized.environment_variables, context.environment_variables);
    }

    #[tokio::test]
    async fn test_execution_context_unlimited() {
        let context = ExecutionContext {
            max_execution_time: None, // Unlimited
            max_memory_usage: None,   // Unlimited
            network_access: true,
            subprocess_allowed: true,
            environment_variables: HashMap::new(),
        };

        assert!(context.max_execution_time.is_none());
        assert!(context.max_memory_usage.is_none());
        assert!(context.network_access);
        assert!(context.subprocess_allowed);
    }
}

#[cfg(test)]
mod role_tests {
    use super::*;

    #[tokio::test]
    async fn test_role_creation() {
        let capabilities = vec![
            ToolGroup::FileOperations,
            ToolGroup::GitOperations,
            ToolGroup::Development,
        ];

        let role = Role::new(
            "rust-developer".to_string(),
            "A role for Rust development tasks".to_string(),
            capabilities.clone(),
        );

        assert_eq!(role.name, "rust-developer");
        assert_eq!(role.description, "A role for Rust development tasks");
        assert_eq!(role.capabilities, capabilities);
        assert!(role.metadata.is_empty());
    }

    #[tokio::test]
    async fn test_role_capability_checking() {
        let role = create_mock_role("developer", vec![
            ToolGroup::FileOperations,
            ToolGroup::GitOperations,
            ToolGroup::Testing,
        ]);

        assert!(role.has_capability(&ToolGroup::FileOperations));
        assert!(role.has_capability(&ToolGroup::GitOperations));
        assert!(role.has_capability(&ToolGroup::Testing));
        assert!(!role.has_capability(&ToolGroup::NetworkAccess));
        assert!(!role.has_capability(&ToolGroup::DatabaseAccess));
    }

    #[tokio::test]
    async fn test_role_file_access() {
        let mut file_restrictions = FileRestrictions::default();
        file_restrictions.allowed_read_patterns = vec![
            "src/**".to_string(),
            "tests/**".to_string(),
            "Cargo.toml".to_string(),
        ];
        file_restrictions.allowed_write_patterns = vec![
            "target/**".to_string(),
            "src/**".to_string(),
        ];
        file_restrictions.denied_patterns = vec![
            "**/.env".to_string(),
            "**/secrets/**".to_string(),
        ];

        let role = Role {
            name: "rust-developer".to_string(),
            description: "Rust developer role".to_string(),
            capabilities: vec![ToolGroup::FileOperations],
            file_restrictions,
            execution_context: ExecutionContext::default(),
            metadata: HashMap::new(),
        };

        // Test read access
        assert!(role.can_access_file("src/main.rs", false));
        assert!(role.can_access_file("tests/integration_test.rs", false));
        assert!(role.can_access_file("Cargo.toml", false));
        assert!(!role.can_access_file("README.md", false)); // Not in allowed patterns

        // Test write access
        assert!(role.can_access_file("target/debug/app", true));
        assert!(role.can_access_file("src/lib.rs", true));
        assert!(!role.can_access_file("tests/test.rs", true)); // Not in write patterns

        // Test denied patterns (should override allowed patterns)
        assert!(!role.can_access_file(".env", false));
        assert!(!role.can_access_file("secrets/api_key.txt", false));
        assert!(!role.can_access_file("src/.env", false));
    }

    #[tokio::test]
    async fn test_role_with_metadata() {
        let mut metadata = HashMap::new();
        metadata.insert("version".to_string(), serde_json::json!("1.0.0"));
        metadata.insert("author".to_string(), serde_json::json!("team@example.com"));
        metadata.insert("tags".to_string(), serde_json::json!(["development", "rust"]));

        let role = Role {
            name: "advanced-developer".to_string(),
            description: "Advanced developer with metadata".to_string(),
            capabilities: vec![ToolGroup::Development, ToolGroup::Testing],
            file_restrictions: FileRestrictions::default(),
            execution_context: ExecutionContext::default(),
            metadata,
        };

        assert_eq!(role.metadata.len(), 3);
        assert_eq!(role.metadata["version"], serde_json::json!("1.0.0"));
        assert_eq!(role.metadata["author"], serde_json::json!("team@example.com"));

        // Test serialization with metadata
        let json_str = serde_json::to_string(&role).expect("Should serialize role with metadata");
        let deserialized: Role = serde_json::from_str(&json_str).expect("Should deserialize role with metadata");

        assert_eq!(deserialized.name, role.name);
        assert_eq!(deserialized.metadata.len(), 3);
        assert_eq!(deserialized.metadata["version"], role.metadata["version"]);
    }
}

#[cfg(test)]
mod role_execution_result_tests {
    use super::*;

    #[tokio::test]
    async fn test_successful_execution_result() {
        let result = RoleExecutionResult {
            success: true,
            output: Some("Build completed successfully".to_string()),
            error: None,
            duration: Duration::from_secs(45),
            files_accessed: vec![
                "src/main.rs".to_string(),
                "Cargo.toml".to_string(),
                "target/debug/app".to_string(),
            ],
            tools_used: vec![
                "cargo".to_string(),
                "rustc".to_string(),
            ],
            exit_code: Some(0),
        };

        assert!(result.success);
        assert!(result.output.is_some());
        assert!(result.error.is_none());
        assert_eq!(result.duration, Duration::from_secs(45));
        assert_eq!(result.files_accessed.len(), 3);
        assert_eq!(result.tools_used.len(), 2);
        assert_eq!(result.exit_code, Some(0));

        // Test serialization
        let json_str = serde_json::to_string(&result).expect("Should serialize execution result");
        let deserialized: RoleExecutionResult = serde_json::from_str(&json_str).expect("Should deserialize execution result");

        assert_eq!(deserialized.success, result.success);
        assert_eq!(deserialized.files_accessed, result.files_accessed);
        assert_eq!(deserialized.tools_used, result.tools_used);
    }

    #[tokio::test]
    async fn test_failed_execution_result() {
        let result = RoleExecutionResult {
            success: false,
            output: Some("Build failed with errors".to_string()),
            error: Some("error: could not compile `main` due to previous error".to_string()),
            duration: Duration::from_secs(12),
            files_accessed: vec![
                "src/main.rs".to_string(),
                "Cargo.toml".to_string(),
            ],
            tools_used: vec!["cargo".to_string()],
            exit_code: Some(1),
        };

        assert!(!result.success);
        assert!(result.output.is_some());
        assert!(result.error.is_some());
        assert_eq!(result.exit_code, Some(1));
        assert!(result.error.as_ref().unwrap().contains("could not compile"));
    }

    #[tokio::test]
    async fn test_execution_result_with_no_output() {
        let result = RoleExecutionResult {
            success: true,
            output: None,
            error: None,
            duration: Duration::from_millis(500),
            files_accessed: vec![],
            tools_used: vec!["echo".to_string()],
            exit_code: Some(0),
        };

        assert!(result.success);
        assert!(result.output.is_none());
        assert!(result.error.is_none());
        assert!(result.files_accessed.is_empty());
        assert_eq!(result.tools_used.len(), 1);
    }
}

#[cfg(test)]
mod role_manager_tests {
    use super::*;

    #[tokio::test]
    async fn test_role_manager_creation() {
        let manager = RoleManager::default();

        // Test that manager can be created
        // Note: Actual implementation may vary
        assert_eq!(format!("{:?}", manager).contains("RoleManager"), true);
    }

    #[tokio::test]
    async fn test_role_manager_with_custom_config() {
        let fixture = TestFixture::new().expect("Should create fixture");
        let config = fixture.config.clone();

        // Test creating role manager with configuration
        // Note: RoleManager::new() is async and doesn't take config
        let result = RoleManager::new().await;
        assert!(result.is_ok(), "RoleManager creation should succeed with default roles");

        let _manager = result.unwrap();
        // Additional tests would go here once the manager is implemented
    }
}

#[cfg(test)]
mod glob_pattern_tests {
    use super::*;

    fn create_test_role_with_patterns(read_patterns: Vec<String>, write_patterns: Vec<String>) -> Role {
        let mut file_restrictions = FileRestrictions::default();
        file_restrictions.allowed_read_patterns = read_patterns;
        file_restrictions.allowed_write_patterns = write_patterns;

        Role {
            name: "test-role".to_string(),
            description: "Test role for pattern matching".to_string(),
            capabilities: vec![ToolGroup::FileOperations],
            file_restrictions,
            execution_context: ExecutionContext::default(),
            metadata: HashMap::new(),
        }
    }

    #[tokio::test]
    async fn test_simple_glob_patterns() {
        let role = create_test_role_with_patterns(
            vec!["file.txt".to_string(), "*.txt".to_string(), "src/*".to_string()],
            vec![],
        );

        // Exact matches
        assert!(role.can_access_file("file.txt", false));
        assert!(!role.can_access_file("other.txt", false));

        // Wildcard matches
        assert!(role.can_access_file("document.txt", false));
        assert!(!role.can_access_file("file.rs", false));

        // Directory patterns
        assert!(role.can_access_file("src/main.rs", false));
        assert!(role.can_access_file("src/lib.rs", false));
        assert!(!role.can_access_file("tests/test.rs", false));
    }

    #[tokio::test]
    async fn test_recursive_glob_patterns() {
        let role = create_test_role_with_patterns(
            vec!["src/**".to_string(), "**/*.rs".to_string()],
            vec![],
        );

        // Double wildcard patterns
        assert!(role.can_access_file("src/main.rs", false));
        assert!(role.can_access_file("src/modules/auth.rs", false));
        assert!(role.can_access_file("src/deep/nested/file.rs", false));
        assert!(!role.can_access_file("tests/test.rs", false)); // Not in src/**

        // Root recursive patterns
        assert!(role.can_access_file("lib.rs", false)); // matches **/*.rs
        assert!(!role.can_access_file("Cargo.toml", false)); // doesn't match **/*.rs
    }

    #[tokio::test]
    async fn test_security_sensitive_patterns() {
        let role = Role::new(
            "test-role".to_string(),
            "Test role".to_string(),
            vec![ToolGroup::FileOperations],
        );

        // Test that default denied patterns work
        assert!(!role.can_access_file("/etc/passwd", false));
        assert!(!role.can_access_file("/root/.bashrc", false));
        assert!(!role.can_access_file("/home/user/.ssh/id_rsa", false));
        assert!(!role.can_access_file("config/api.key", false));
        assert!(!role.can_access_file("secrets/database.pem", false));
        assert!(!role.can_access_file("/home/user/.ssh/id_ed25519", false));
    }

    #[tokio::test]
    async fn test_complex_file_access_scenarios() {
        let mut file_restrictions = FileRestrictions::default();
        file_restrictions.allowed_read_patterns = vec![
            "project/**".to_string(),
            "*.md".to_string(),
            "config/*.yml".to_string(),
        ];
        file_restrictions.allowed_write_patterns = vec![
            "project/target/**".to_string(),
            "project/build/**".to_string(),
            "logs/*.log".to_string(),
        ];
        file_restrictions.denied_patterns = vec![
            "**/secrets/**".to_string(),
            "**/.env*".to_string(),
            "project/config/prod.yml".to_string(), // Specific production config
        ];

        let role = Role {
            name: "ci-worker".to_string(),
            description: "CI/CD worker role".to_string(),
            capabilities: vec![ToolGroup::FileOperations, ToolGroup::Testing],
            file_restrictions,
            execution_context: ExecutionContext::default(),
            metadata: HashMap::new(),
        };

        // Test read permissions
        assert!(role.can_access_file("project/src/main.rs", false));
        assert!(role.can_access_file("README.md", false));
        assert!(role.can_access_file("config/dev.yml", false));
        assert!(!role.can_access_file("other/file.rs", false));

        // Test write permissions
        assert!(role.can_access_file("project/target/debug/app", true));
        assert!(role.can_access_file("project/build/artifacts/lib.so", true));
        assert!(role.can_access_file("logs/build.log", true));
        assert!(!role.can_access_file("project/src/main.rs", true)); // Not in write patterns

        // Test denied patterns override
        assert!(!role.can_access_file("project/secrets/api_key.txt", false));
        assert!(!role.can_access_file("project/.env", false));
        assert!(!role.can_access_file("project/config/prod.yml", false));
        assert!(!role.can_access_file("config/.env.local", false));
    }
}

#[cfg(test)]
mod role_serialization_tests {
    use super::*;

    #[tokio::test]
    async fn test_complete_role_serialization() {
        let mut metadata = HashMap::new();
        metadata.insert("department".to_string(), serde_json::json!("engineering"));
        metadata.insert("level".to_string(), serde_json::json!("senior"));

        let mut env_vars = HashMap::new();
        env_vars.insert("RUST_LOG".to_string(), "debug".to_string());
        env_vars.insert("CARGO_TARGET_DIR".to_string(), "./target".to_string());

        let role = Role {
            name: "senior-rust-developer".to_string(),
            description: "Senior Rust developer with extensive permissions".to_string(),
            capabilities: vec![
                ToolGroup::FileOperations,
                ToolGroup::GitOperations,
                ToolGroup::Testing,
                ToolGroup::Development,
                ToolGroup::PackageManagement,
            ],
            file_restrictions: FileRestrictions {
                allowed_read_patterns: vec![
                    "src/**".to_string(),
                    "tests/**".to_string(),
                    "examples/**".to_string(),
                    "*.toml".to_string(),
                    "*.md".to_string(),
                ],
                allowed_write_patterns: vec![
                    "src/**".to_string(),
                    "tests/**".to_string(),
                    "target/**".to_string(),
                    "docs/**".to_string(),
                ],
                denied_patterns: vec![
                    "**/secrets/**".to_string(),
                    "**/.env*".to_string(),
                    "**/id_*".to_string(),
                ],
                working_directory_restrictions: vec![
                    "./".to_string(),
                    "../shared-libs/".to_string(),
                ],
            },
            execution_context: ExecutionContext {
                max_execution_time: Some(1800), // 30 minutes
                max_memory_usage: Some(2048),   // 2GB
                network_access: true,
                subprocess_allowed: true,
                environment_variables: env_vars,
            },
            metadata,
        };

        // Test serialization
        let json_str = serde_json::to_string_pretty(&role).expect("Should serialize complete role");

        // Verify JSON contains expected fields
        assert!(json_str.contains("senior-rust-developer"));
        assert!(json_str.contains("file_operations"));
        assert!(json_str.contains("allowed_read_patterns"));
        assert!(json_str.contains("max_execution_time"));
        assert!(json_str.contains("environment_variables"));

        // Test deserialization
        let deserialized: Role = serde_json::from_str(&json_str).expect("Should deserialize complete role");

        assert_eq!(deserialized.name, role.name);
        assert_eq!(deserialized.description, role.description);
        assert_eq!(deserialized.capabilities, role.capabilities);
        assert_eq!(deserialized.file_restrictions.allowed_read_patterns, role.file_restrictions.allowed_read_patterns);
        assert_eq!(deserialized.execution_context.max_execution_time, role.execution_context.max_execution_time);
        assert_eq!(deserialized.metadata, role.metadata);
    }

    #[tokio::test]
    async fn test_role_yaml_serialization() {
        let role = create_mock_role("test-role", vec![
            ToolGroup::FileOperations,
            ToolGroup::Testing,
        ]);

        // Test YAML serialization (if serde_yaml is available)
        let yaml_str = serde_yaml::to_string(&role).expect("Should serialize to YAML");
        assert!(yaml_str.contains("name: test-role"));
        assert!(yaml_str.contains("file_operations"));

        let deserialized: Role = serde_yaml::from_str(&yaml_str).expect("Should deserialize from YAML");
        assert_eq!(deserialized.name, role.name);
        assert_eq!(deserialized.capabilities, role.capabilities);
    }
}

#[cfg(test)]
mod integration_tests {
    use super::*;

    #[tokio::test]
    async fn test_role_based_workflow() {
        // Create different roles for different purposes
        let developer_role = create_mock_role("developer", vec![
            ToolGroup::FileOperations,
            ToolGroup::GitOperations,
            ToolGroup::Development,
            ToolGroup::Testing,
        ]);

        let ci_role = create_mock_role("ci-worker", vec![
            ToolGroup::FileOperations,
            ToolGroup::Testing,
            ToolGroup::PackageManagement,
        ]);

        let readonly_role = create_mock_role("auditor", vec![
            ToolGroup::SystemInfo,
        ]);

        // Test capability differences
        assert!(developer_role.has_capability(&ToolGroup::GitOperations));
        assert!(!ci_role.has_capability(&ToolGroup::GitOperations));
        assert!(!readonly_role.has_capability(&ToolGroup::FileOperations));

        assert!(ci_role.has_capability(&ToolGroup::PackageManagement));
        assert!(!readonly_role.has_capability(&ToolGroup::PackageManagement));

        assert!(readonly_role.has_capability(&ToolGroup::SystemInfo));
        assert!(!ci_role.has_capability(&ToolGroup::SystemInfo));
    }

    #[tokio::test]
    async fn test_role_permission_escalation_prevention() {
        // Create a restricted role
        let mut restricted_restrictions = FileRestrictions::default();
        restricted_restrictions.allowed_read_patterns = vec!["public/**".to_string()];
        restricted_restrictions.allowed_write_patterns = vec!["tmp/**".to_string()];
        restricted_restrictions.denied_patterns = vec![
            "/etc/**".to_string(),
            "/root/**".to_string(),
            "**/secrets/**".to_string(),
            "**/.ssh/**".to_string(),
            "**/config/prod/**".to_string(),
        ];

        let restricted_role = Role {
            name: "restricted-worker".to_string(),
            description: "Heavily restricted role".to_string(),
            capabilities: vec![ToolGroup::FileOperations],
            file_restrictions: restricted_restrictions,
            execution_context: ExecutionContext {
                max_execution_time: Some(60), // 1 minute
                max_memory_usage: Some(128),  // 128MB
                network_access: false,
                subprocess_allowed: false,
                environment_variables: HashMap::new(),
            },
            metadata: HashMap::new(),
        };

        // Test that restricted role cannot access sensitive files
        assert!(!restricted_role.can_access_file("/etc/passwd", false));
        assert!(!restricted_role.can_access_file("/root/.bashrc", false));
        assert!(!restricted_role.can_access_file("app/secrets/api_key.txt", false));
        assert!(!restricted_role.can_access_file("/home/user/.ssh/id_rsa", false));
        assert!(!restricted_role.can_access_file("config/prod/database.yml", false));

        // Test that it can only access allowed areas
        assert!(restricted_role.can_access_file("public/readme.txt", false));
        assert!(!restricted_role.can_access_file("private/data.txt", false));
        assert!(restricted_role.can_access_file("tmp/work_file.txt", true));
        assert!(!restricted_role.can_access_file("public/readme.txt", true)); // No write to public

        // Test execution limits
        assert_eq!(restricted_role.execution_context.max_execution_time, Some(60));
        assert_eq!(restricted_role.execution_context.max_memory_usage, Some(128));
        assert!(!restricted_role.execution_context.network_access);
        assert!(!restricted_role.execution_context.subprocess_allowed);
    }
}