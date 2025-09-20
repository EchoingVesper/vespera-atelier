/// Tests for task and role executors
///
/// These tests verify that the executor implementations properly integrate
/// with the task and role management systems.

#[cfg(test)]
mod tests {
    use crate::task_management::{TaskExecutor, TaskService, TaskInput, TaskPriority, ExecutionContext};
    use crate::role_management::{RoleManager, RoleExecutor, Role, ToolGroup};
    use crate::codex::{Codex, CodexContent};
    use crate::CodexManager;
    use crate::errors::BinderyResult;
    use std::sync::Arc;
    use std::collections::HashMap;
    use uuid::Uuid;

    /// Helper function to create a test codex manager
    async fn create_test_codex_manager() -> BinderyResult<Arc<CodexManager>> {
        let manager = CodexManager::new()?;
        Ok(Arc::new(manager))
    }

    /// Helper function to create a test task
    fn create_test_task() -> Codex {
        let id = Uuid::new_v4();
        let mut template_fields = HashMap::new();
        template_fields.insert("description".to_string(), serde_json::Value::String("Test task for executor".to_string()));
        template_fields.insert("task_type".to_string(), serde_json::Value::String("general".to_string()));
        template_fields.insert("assigned_role".to_string(), serde_json::Value::String("default_agent".to_string()));

        Codex {
            id,
            title: "Test Task".to_string(),
            content: CodexContent {
                template_fields,
                crdt_operations: Vec::new(),
            },
            metadata: crate::CodexMetadata {
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
                created_by: "test_user".to_string(),
                template_id: Some("task".to_string()),
                tags: vec!["test".to_string()],
                references: Vec::new(),
                version: 1,
                content_hash: "test_hash".to_string(),
            },
        }
    }

    /// Test TaskExecutor basic functionality
    #[tokio::test]
    async fn test_task_executor_basic() -> BinderyResult<()> {
        let codex_manager = create_test_codex_manager().await?;
        let task_service = Arc::new(TaskService::new(codex_manager));
        let role_manager = Arc::new(RoleManager::new().await?);
        let executor = TaskExecutor::new(task_service.clone(), role_manager);

        // Create a test task
        let task = create_test_task();
        let task_id = task.id;

        // Store the task in the service first (mock storage)
        // In a real implementation, this would be handled by the task service

        // Test dry run functionality
        let dry_run_result = executor.dry_run(&task_id).await;

        // The dry run should fail because the task doesn't exist in storage
        // but we can verify the executor is properly structured
        assert!(dry_run_result.is_err());

        Ok(())
    }

    /// Test RoleExecutor basic functionality
    #[tokio::test]
    async fn test_role_executor_basic() -> BinderyResult<()> {
        let role_manager = RoleManager::new().await?;
        let executor = RoleExecutor::new();

        // Get the default role
        let role = role_manager.get_role("default_agent").await
            .expect("Default role should exist");

        // Create a test task
        let task = create_test_task();

        // Test execution with role constraints
        let result = executor.execute_with_role(&role, &task).await?;

        // Verify the execution completed
        assert!(result.success);
        assert!(result.output.is_some());
        assert!(result.error.is_none());
        assert!(result.tools_used.contains(&"general_execution".to_string()));

        Ok(())
    }

    /// Test RoleExecutor with file operations
    #[tokio::test]
    async fn test_role_executor_file_operations() -> BinderyResult<()> {
        let role_manager = RoleManager::new().await?;
        let executor = RoleExecutor::new();

        // Get a role with file operations capability
        let role = role_manager.get_role("frontend_developer").await
            .expect("Frontend developer role should exist");

        // Create a file operation task
        let id = Uuid::new_v4();
        let mut template_fields = HashMap::new();
        template_fields.insert("description".to_string(), serde_json::Value::String("Read a file".to_string()));
        template_fields.insert("task_type".to_string(), serde_json::Value::String("file_operation".to_string()));
        template_fields.insert("operation".to_string(), serde_json::Value::String("read".to_string()));
        template_fields.insert("file_path".to_string(), serde_json::Value::String("./Cargo.toml".to_string()));

        let task = Codex {
            id,
            title: "File Read Task".to_string(),
            content: CodexContent {
                template_fields,
                crdt_operations: Vec::new(),
            },
            metadata: crate::CodexMetadata {
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
                created_by: "test_user".to_string(),
                template_id: Some("task".to_string()),
                tags: vec!["test".to_string()],
                references: Vec::new(),
                version: 1,
                content_hash: "test_hash".to_string(),
            },
        };

        // Test file operation execution
        let result = executor.execute_with_role(&role, &task).await?;

        // Verify the execution completed successfully
        assert!(result.success);
        assert!(result.output.is_some());
        assert!(result.tools_used.contains(&"file_operations".to_string()));
        assert!(result.files_accessed.contains(&"./Cargo.toml".to_string()));

        Ok(())
    }

    /// Test RoleExecutor with permission validation
    #[tokio::test]
    async fn test_role_executor_permission_denied() -> BinderyResult<()> {
        let role_manager = RoleManager::new().await?;
        let executor = RoleExecutor::new();

        // Get a role with limited capabilities
        let role = role_manager.get_role("security_auditor").await
            .expect("Security auditor role should exist");

        // Create a command execution task (security auditor shouldn't have ProcessExecution)
        let id = Uuid::new_v4();
        let mut template_fields = HashMap::new();
        template_fields.insert("description".to_string(), serde_json::Value::String("Execute a command".to_string()));
        template_fields.insert("task_type".to_string(), serde_json::Value::String("command_execution".to_string()));
        template_fields.insert("command".to_string(), serde_json::Value::String("ls".to_string()));

        let task = Codex {
            id,
            title: "Command Task".to_string(),
            content: CodexContent {
                template_fields,
                crdt_operations: Vec::new(),
            },
            metadata: crate::CodexMetadata {
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
                created_by: "test_user".to_string(),
                template_id: Some("task".to_string()),
                tags: vec!["test".to_string()],
                references: Vec::new(),
                version: 1,
                content_hash: "test_hash".to_string(),
            },
        };

        // Test that execution fails due to insufficient permissions
        let result = executor.execute_with_role(&role, &task).await?;

        // The security_auditor doesn't have ProcessExecution capability, so it should fail
        assert!(!result.success);
        assert!(result.error.is_some());
        assert!(result.error.as_ref().unwrap().contains("process execution"));

        Ok(())
    }

    /// Test RoleExecutor context-based execution
    #[tokio::test]
    async fn test_role_executor_context_execution() -> BinderyResult<()> {
        let role_manager = RoleManager::new().await?;
        let executor = RoleExecutor::new();

        // Get the default role
        let role = role_manager.get_role("default_agent").await
            .expect("Default role should exist");

        // Test simple context execution
        let result = executor.execute_with_context(&role, "Simple task context").await?;

        assert!(result.success);
        assert!(result.output.is_some());
        assert!(result.output.as_ref().unwrap().contains("default_agent"));

        Ok(())
    }

    /// Test role capability validation
    #[tokio::test]
    async fn test_role_capability_validation() -> BinderyResult<()> {
        let role_manager = RoleManager::new().await?;

        // Test that roles have expected capabilities
        let default_role = role_manager.get_role("default_agent").await
            .expect("Default role should exist");

        assert!(default_role.has_capability(&ToolGroup::Development));
        assert!(default_role.has_capability(&ToolGroup::FileOperations));

        let frontend_role = role_manager.get_role("frontend_developer").await
            .expect("Frontend developer role should exist");

        assert!(frontend_role.has_capability(&ToolGroup::NetworkAccess));
        assert!(frontend_role.has_capability(&ToolGroup::PackageManagement));

        let security_role = role_manager.get_role("security_auditor").await
            .expect("Security auditor role should exist");

        assert!(security_role.has_capability(&ToolGroup::Security));
        assert!(!security_role.has_capability(&ToolGroup::ProcessExecution));

        Ok(())
    }
}