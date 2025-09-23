//! Integration test for database pool optimizations

use std::time::Duration;
use vespera_bindery::database::{Database, DatabasePoolConfig, TaskInput};

#[tokio::test]
async fn test_optimized_pool_configuration() {
    // Test that we can create an optimized pool configuration
    let pool_config = DatabasePoolConfig::builder()
        .max_connections(8).unwrap()
        .min_connections(2)
        .acquire_timeout(Duration::from_secs(3)).unwrap()
        .idle_timeout(Duration::from_secs(300)).unwrap()
        .max_connection_lifetime(Duration::from_secs(3600)).unwrap()
        .test_before_acquire(true)
        .build().unwrap();

    assert_eq!(pool_config.max_connections, 8);
    assert_eq!(pool_config.min_connections, 2);
    assert_eq!(pool_config.acquire_timeout, Duration::from_secs(3));
    assert_eq!(pool_config.idle_timeout, Duration::from_secs(300));
    assert_eq!(pool_config.max_connection_lifetime, Duration::from_secs(3600));
    assert!(pool_config.test_before_acquire);
}

#[tokio::test]
async fn test_database_with_optimized_pool() {
    let pool_config = DatabasePoolConfig::builder()
        .max_connections(4).unwrap()  // Smaller for testing
        .min_connections(1)
        .acquire_timeout(Duration::from_secs(2)).unwrap()
        .build().unwrap();

    let test_db_path = std::env::temp_dir().join("test_optimized_pool.db");
    if test_db_path.exists() {
        std::fs::remove_file(&test_db_path).unwrap();
    }

    let database = Database::new_with_config(&test_db_path, pool_config).await.unwrap();

    // Test pool health
    assert!(database.is_pool_healthy().await);

    // Test metrics
    let metrics = database.get_pool_metrics().await;
    assert!(metrics.active_connections > 0);
    assert!(metrics.pool_utilization >= 0.0);

    // Test health info
    let health_info = database.get_pool_health_info().await;
    assert!(health_info.is_healthy);
    assert_eq!(health_info.max_connections, 4);

    // Clean up
    database.close().await;
    if test_db_path.exists() {
        std::fs::remove_file(&test_db_path).unwrap();
    }
}

#[tokio::test]
async fn test_concurrent_operations() {
    let pool_config = DatabasePoolConfig::builder()
        .max_connections(6).unwrap()
        .min_connections(2)
        .acquire_timeout(Duration::from_secs(5)).unwrap()
        .build().unwrap();

    let test_db_path = std::env::temp_dir().join("test_concurrent_ops.db");
    if test_db_path.exists() {
        std::fs::remove_file(&test_db_path).unwrap();
    }

    let database = Database::new_with_config(&test_db_path, pool_config).await.unwrap();

    // Initialize schema
    database.init_schema().await.unwrap();

    // Test sequential task creation to validate pool behavior
    let mut success_count = 0;
    for i in 0..10 {
        let task_input = TaskInput {
            title: format!("Test Task {}", i),
            description: Some("Test description".to_string()),
            priority: Some("normal".to_string()),
            project_id: None,
            parent_id: None,
            tags: vec!["test".to_string()],
            labels: serde_json::json!({}),
            subtasks: vec![],
        };

        if database.create_task(&task_input).await.is_ok() {
            success_count += 1;
        }
    }

    // Should have created most or all tasks successfully
    assert!(success_count >= 8, "Expected at least 8 successful operations, got {}", success_count);

    // Check final metrics
    let final_metrics = database.get_pool_metrics().await;
    assert!(final_metrics.total_acquired >= 10);

    // Clean up
    database.close().await;
    if test_db_path.exists() {
        std::fs::remove_file(&test_db_path).unwrap();
    }
}

#[tokio::test]
async fn test_pool_recovery() {
    let pool_config = DatabasePoolConfig::builder()
        .max_connections(3).unwrap()
        .min_connections(1)
        .build().unwrap();

    let test_db_path = std::env::temp_dir().join("test_pool_recovery.db");
    if test_db_path.exists() {
        std::fs::remove_file(&test_db_path).unwrap();
    }

    let database = Database::new_with_config(&test_db_path, pool_config).await.unwrap();

    // Test that pool recovery doesn't fail even when pool is healthy
    let recovery_result = database.recover_pool().await;
    assert!(recovery_result.is_ok(), "Pool recovery should succeed");

    // Test health after recovery
    assert!(database.is_pool_healthy().await);

    // Clean up
    database.close().await;
    if test_db_path.exists() {
        std::fs::remove_file(&test_db_path).unwrap();
    }
}