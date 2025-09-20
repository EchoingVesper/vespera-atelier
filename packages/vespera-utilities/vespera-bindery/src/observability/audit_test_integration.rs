//! Integration tests for audit logging system
//!
//! This module contains comprehensive tests to verify that audit logging
//! works correctly across all security-sensitive operations.

#[cfg(test)]
mod tests {
    use super::super::audit::*;
    use crate::role_management::{RoleExecutor, Role, ToolGroup, ExecutionContext};
    use crate::migration::MigrationManager;
    use std::collections::HashSet;
    use tempfile::TempDir;
    use chrono::Utc;
    use tokio;

    /// Helper function to create a test audit logger
    async fn setup_test_audit_logger() -> (AuditLogger, TempDir) {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let audit_db_path = temp_dir.path().join("test_audit.db");

        let config = AuditConfig {
            audit_db_path,
            enable_hash_chaining: true,
            max_events: Some(1000),
            retention_days: Some(30),
            enable_compression: false,
            batch_size: 100,
        };

        let logger = AuditLogger::new(config).await.expect("Failed to create audit logger");
        (logger, temp_dir)
    }

    /// Helper function to create a test user context
    fn create_test_user_context() -> UserContext {
        UserContext {
            user_id: Some("test_user".to_string()),
            session_id: Some("test_session_123".to_string()),
            source_ip: Some("127.0.0.1".to_string()),
            user_agent: Some("audit_test_client".to_string()),
        }
    }

    /// Test basic audit event logging
    #[tokio::test]
    async fn test_basic_audit_event_logging() {
        let (logger, _temp_dir) = setup_test_audit_logger().await;
        let user_context = create_test_user_context();

        // Create a simple audit event
        let outcome = OperationOutcome {
            success: true,
            result_code: Some(200),
            error_message: None,
            duration_ms: 150,
            records_affected: Some(1),
        };

        let event = create_role_execution_event(
            user_context,
            "test_role",
            "task_123",
            outcome,
            vec!["read".to_string(), "write".to_string()],
        );

        // Log the event
        logger.log_event(event).await.expect("Failed to log audit event");

        // Verify the event was stored
        let stats = logger.get_stats().await.expect("Failed to get audit stats");
        assert_eq!(stats.total_events, 1);
        assert_eq!(stats.successful_operations, 1);
        assert_eq!(stats.failed_operations, 0);
    }

    /// Test role execution audit integration
    #[tokio::test]
    async fn test_role_execution_audit_integration() {
        let (logger, _temp_dir) = setup_test_audit_logger().await;
        let audit_logger = std::sync::Arc::new(logger);

        // Create a role executor with audit logging
        let executor = RoleExecutor::with_audit_logger(audit_logger.clone());

        // Create a test role
        let mut capabilities = HashSet::new();
        capabilities.insert(ToolGroup::FileOperations);

        let role = Role {
            name: "test_file_role".to_string(),
            description: "Test role for file operations".to_string(),
            capabilities,
            execution_context: ExecutionContext {
                max_memory_usage: Some(512),
                max_execution_time: Some(30),
                subprocess_allowed: false,
                network_access: false,
                file_patterns: vec!["*.txt".to_string()],
            },
        };

        let user_context = create_test_user_context();

        // Test command execution with audit logging
        let result = executor.execute_command(
            &role,
            "echo",
            &["Hello, audit world!"],
            user_context.clone(),
        ).await;

        // This should fail due to role capabilities, but should be audited
        assert!(result.is_err());

        // Check that audit events were created
        let stats = audit_logger.get_stats().await.expect("Failed to get audit stats");
        assert!(stats.total_events > 0);
        assert!(stats.failed_operations > 0); // Command should have failed due to permissions
    }

    /// Test migration audit integration
    #[tokio::test]
    async fn test_migration_audit_integration() {
        let (audit_logger, _temp_dir) = setup_test_audit_logger().await;
        let audit_logger_arc = std::sync::Arc::new(audit_logger);

        // Create a test database
        let temp_db_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_db_dir.path().join("test_migration.db");
        let migrations_dir = temp_db_dir.path().join("migrations");
        std::fs::create_dir(&migrations_dir).expect("Failed to create migrations dir");

        // Create a test migration file
        let migration_content = r#"
CREATE TABLE test_table (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Down
DROP TABLE test_table;
"#;

        let migration_file = migrations_dir.join("V001__create_test_table.sql");
        std::fs::write(&migration_file, migration_content).expect("Failed to write migration file");

        // Create database pool
        let database_url = format!("sqlite:{}", db_path.display());
        let pool = sqlx::SqlitePool::connect(&database_url)
            .await
            .expect("Failed to connect to test database");

        // Create migration manager with audit logging
        let migration_manager = MigrationManager::new_with_audit(
            pool,
            migrations_dir,
            audit_logger_arc.clone(),
        ).await.expect("Failed to create migration manager");

        let user_context = create_test_user_context();

        // Run migrations
        let results = migration_manager.migrate(Some(user_context.clone())).await
            .expect("Failed to run migrations");

        assert_eq!(results.len(), 1);
        assert!(results[0].success);

        // Check that migration events were audited
        let stats = audit_logger_arc.get_stats().await.expect("Failed to get audit stats");
        assert!(stats.total_events >= 2); // At least attempt + completion events

        // Verify operation types
        assert!(stats.operation_type_breakdown.contains_key("migration"));
    }

    /// Test audit event querying and filtering
    #[tokio::test]
    async fn test_audit_event_querying() {
        let (logger, _temp_dir) = setup_test_audit_logger().await;
        let user_context = create_test_user_context();

        // Create multiple audit events with different operation types
        let operations = vec![
            ("role_execution", "execute_task"),
            ("migration", "migrate_up"),
            ("file_access", "access_granted"),
            ("command_execution", "execute_command"),
        ];

        for (op_type, action) in operations {
            let outcome = OperationOutcome {
                success: true,
                result_code: Some(200),
                error_message: None,
                duration_ms: 100,
                records_affected: Some(1),
            };

            let mut event = AuditEvent {
                id: uuid::Uuid::new_v4().to_string(),
                timestamp: Utc::now(),
                user_context: user_context.clone(),
                operation: Operation {
                    operation_type: op_type.to_string(),
                    action: action.to_string(),
                    resource: format!("test_resource_{}", op_type),
                    details: std::collections::HashMap::new(),
                },
                security_context: SecurityContext {
                    roles: vec!["test_role".to_string()],
                    permissions: vec!["test_permission".to_string()],
                    security_level: Some("high".to_string()),
                    auth_method: None,
                },
                outcome,
                previous_hash: None,
                event_hash: String::new(),
                metadata: std::collections::HashMap::new(),
            };

            logger.log_event(event).await.expect("Failed to log audit event");
        }

        // Test filtering by operation type
        let role_events = logger.query_events(AuditQueryFilter {
            operation_type: Some("role_execution".to_string()),
            ..Default::default()
        }).await.expect("Failed to query role execution events");

        assert_eq!(role_events.len(), 1);
        assert_eq!(role_events[0].operation.operation_type, "role_execution");

        // Test filtering by user
        let user_events = logger.query_events(AuditQueryFilter {
            user_id: Some("test_user".to_string()),
            ..Default::default()
        }).await.expect("Failed to query user events");

        assert_eq!(user_events.len(), 4); // All events are for test_user

        // Test filtering by success status
        let successful_events = logger.query_events(AuditQueryFilter {
            success: Some(true),
            ..Default::default()
        }).await.expect("Failed to query successful events");

        assert_eq!(successful_events.len(), 4); // All events were successful
    }

    /// Test hash chain integrity validation
    #[tokio::test]
    async fn test_hash_chain_validation() {
        let (logger, _temp_dir) = setup_test_audit_logger().await;
        let user_context = create_test_user_context();

        // Create a series of audit events
        for i in 0..5 {
            let outcome = OperationOutcome {
                success: true,
                result_code: Some(200),
                error_message: None,
                duration_ms: 100 + i * 10,
                records_affected: Some(1),
            };

            let event = create_role_execution_event(
                user_context.clone(),
                &format!("test_role_{}", i),
                &format!("task_{}", i),
                outcome,
                vec!["read".to_string()],
            );

            logger.log_event(event).await.expect("Failed to log audit event");
        }

        // Validate hash chain integrity
        let is_valid = logger.validate_hash_chain().await.expect("Failed to validate hash chain");
        assert!(is_valid, "Hash chain should be valid");

        // Verify in stats
        let stats = logger.get_stats().await.expect("Failed to get audit stats");
        assert!(stats.hash_chain_valid, "Hash chain should be reported as valid in stats");
    }

    /// Test audit event retention and cleanup
    #[tokio::test]
    async fn test_audit_retention_cleanup() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let audit_db_path = temp_dir.path().join("test_retention_audit.db");

        // Create audit logger with short retention for testing
        let config = AuditConfig {
            audit_db_path,
            enable_hash_chaining: false, // Disable for simpler testing
            max_events: Some(3), // Very small limit for testing
            retention_days: None, // Test max_events cleanup only
            enable_compression: false,
            batch_size: 100,
        };

        let logger = AuditLogger::new(config).await.expect("Failed to create audit logger");
        let user_context = create_test_user_context();

        // Create more events than the max_events limit
        for i in 0..5 {
            let outcome = OperationOutcome {
                success: true,
                result_code: Some(200),
                error_message: None,
                duration_ms: 100,
                records_affected: Some(1),
            };

            let event = create_role_execution_event(
                user_context.clone(),
                "cleanup_test_role",
                &format!("task_{}", i),
                outcome,
                vec!["read".to_string()],
            );

            logger.log_event(event).await.expect("Failed to log audit event");
        }

        // Run cleanup
        let deleted_count = logger.cleanup_old_events().await.expect("Failed to cleanup old events");

        // Should have deleted excess events to stay within limit
        assert_eq!(deleted_count, 2); // 5 - 3 = 2 deleted

        // Verify final count
        let stats = logger.get_stats().await.expect("Failed to get audit stats");
        assert_eq!(stats.total_events, 3); // Should be at the limit
    }

    /// Test configuration validation
    #[tokio::test]
    async fn test_audit_config_validation() {
        use crate::observability::validate_audit_config;
        use std::path::PathBuf;

        // Test valid configuration
        let valid_config = AuditConfig {
            audit_db_path: PathBuf::from("/tmp/audit.db"),
            enable_hash_chaining: true,
            max_events: Some(1000),
            retention_days: Some(30),
            enable_compression: true,
            batch_size: 100,
        };
        assert!(validate_audit_config(&valid_config).is_ok());

        // Test invalid path (relative)
        let invalid_path_config = AuditConfig {
            audit_db_path: PathBuf::from("relative/audit.db"),
            ..valid_config.clone()
        };
        assert!(validate_audit_config(&invalid_path_config).is_err());

        // Test invalid max_events (zero)
        let invalid_max_events_config = AuditConfig {
            max_events: Some(0),
            ..valid_config.clone()
        };
        assert!(validate_audit_config(&invalid_max_events_config).is_err());

        // Test invalid batch_size (zero)
        let invalid_batch_size_config = AuditConfig {
            batch_size: 0,
            ..valid_config.clone()
        };
        assert!(validate_audit_config(&invalid_batch_size_config).is_err());
    }

    /// Test audit statistics generation
    #[tokio::test]
    async fn test_audit_statistics() {
        let (logger, _temp_dir) = setup_test_audit_logger().await;
        let user_context = create_test_user_context();

        // Create events with different outcomes and users
        let test_cases = vec![
            ("user_1", true, "role_execution"),
            ("user_1", false, "migration"),
            ("user_2", true, "file_access"),
            ("user_2", true, "role_execution"),
            ("user_3", false, "command_execution"),
        ];

        for (user_id, success, op_type) in test_cases {
            let mut user_ctx = user_context.clone();
            user_ctx.user_id = Some(user_id.to_string());

            let outcome = OperationOutcome {
                success,
                result_code: Some(if success { 200 } else { 500 }),
                error_message: if success { None } else { Some("Test error".to_string()) },
                duration_ms: 100,
                records_affected: Some(1),
            };

            let mut event = AuditEvent {
                id: uuid::Uuid::new_v4().to_string(),
                timestamp: Utc::now(),
                user_context: user_ctx,
                operation: Operation {
                    operation_type: op_type.to_string(),
                    action: "test_action".to_string(),
                    resource: "test_resource".to_string(),
                    details: std::collections::HashMap::new(),
                },
                security_context: SecurityContext {
                    roles: vec!["test_role".to_string()],
                    permissions: vec!["test_permission".to_string()],
                    security_level: Some("medium".to_string()),
                    auth_method: None,
                },
                outcome,
                previous_hash: None,
                event_hash: String::new(),
                metadata: std::collections::HashMap::new(),
            };

            logger.log_event(event).await.expect("Failed to log audit event");
        }

        // Get and verify statistics
        let stats = logger.get_stats().await.expect("Failed to get audit stats");

        assert_eq!(stats.total_events, 5);
        assert_eq!(stats.successful_operations, 3);
        assert_eq!(stats.failed_operations, 2);

        // Check operation type breakdown
        assert_eq!(stats.operation_type_breakdown.get("role_execution"), Some(&2));
        assert_eq!(stats.operation_type_breakdown.get("migration"), Some(&1));
        assert_eq!(stats.operation_type_breakdown.get("file_access"), Some(&1));
        assert_eq!(stats.operation_type_breakdown.get("command_execution"), Some(&1));

        // Check user breakdown
        assert_eq!(stats.user_breakdown.get("user_1"), Some(&2));
        assert_eq!(stats.user_breakdown.get("user_2"), Some(&2));
        assert_eq!(stats.user_breakdown.get("user_3"), Some(&1));

        // Check time range
        assert!(stats.first_event_time.is_some());
        assert!(stats.last_event_time.is_some());
    }
}