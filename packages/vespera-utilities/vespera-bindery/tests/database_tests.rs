//! Database tests for Vespera Bindery
//!
//! Comprehensive test suite for the database module, relocated from src/database.rs

use vespera_bindery::database::*;
use serde_json;

/// Create a nested task input for testing recursion depth
fn create_nested_task_input(depth: usize, title_prefix: &str) -> TaskInput {
    if depth == 0 {
        return TaskInput {
            title: format!("{}_depth_{}", title_prefix, depth),
            description: Some(format!("Task at depth {}", depth)),
            priority: Some("normal".to_string()),
            project_id: None,
            parent_id: None,
            tags: vec![format!("depth_{}", depth)],
            labels: serde_json::json!({}),
            subtasks: vec![],
        };
    }

    TaskInput {
        title: format!("{}_depth_{}", title_prefix, depth),
        description: Some(format!("Task at depth {}", depth)),
        priority: Some("normal".to_string()),
        project_id: None,
        parent_id: None,
        tags: vec![format!("depth_{}", depth)],
        labels: serde_json::json!({}),
        subtasks: vec![create_nested_task_input(depth - 1, title_prefix)],
    }
}

#[tokio::test]
async fn test_task_creation_depth_limit_success() {
    // Test that tasks can be created up to the maximum depth
    let db = Database::new_in_memory().await.expect("Failed to create in-memory database");

    // Create a task with exactly MAX_TASK_DEPTH levels (should succeed)
    let task_input = create_nested_task_input(MAX_TASK_DEPTH, "test_max_depth");

    let result = db.create_task(&task_input).await;
    assert!(result.is_ok(), "Task creation should succeed at max depth");

    let task_id = result.unwrap();
    assert!(!task_id.is_empty(), "Task ID should not be empty");
}

#[tokio::test]
async fn test_task_creation_depth_limit_exceeded() {
    // Test that tasks fail gracefully when depth is exceeded
    let db = Database::new_in_memory().await.expect("Failed to create in-memory database");

    // Create a task with MAX_TASK_DEPTH + 1 levels (should fail)
    let task_input = create_nested_task_input(MAX_TASK_DEPTH + 1, "test_exceed_depth");

    let result = db.create_task(&task_input).await;
    assert!(result.is_err(), "Task creation should fail when depth is exceeded");

    let error = result.err().unwrap();
    let error_msg = error.to_string();
    assert!(error_msg.contains("Task recursion depth exceeded"),
            "Error message should mention depth exceeded: {}", error_msg);
    assert!(error_msg.contains(&MAX_TASK_DEPTH.to_string()),
            "Error message should include max depth value: {}", error_msg);
    assert!(error_msg.contains(&(MAX_TASK_DEPTH + 1).to_string()),
            "Error message should include current depth: {}", error_msg);
}

#[tokio::test]
async fn test_task_creation_depth_limit_boundary() {
    // Test boundary conditions around the depth limit
    let db = Database::new_in_memory().await.expect("Failed to create in-memory database");

    // Test depth = MAX_TASK_DEPTH - 1 (should succeed)
    let task_input_under = create_nested_task_input(MAX_TASK_DEPTH - 1, "test_under_limit");
    let result_under = db.create_task(&task_input_under).await;
    assert!(result_under.is_ok(), "Task creation should succeed one level under max depth");

    // Test depth = MAX_TASK_DEPTH (should succeed)
    let task_input_at = create_nested_task_input(MAX_TASK_DEPTH, "test_at_limit");
    let result_at = db.create_task(&task_input_at).await;
    assert!(result_at.is_ok(), "Task creation should succeed at exactly max depth");

    // Test depth = MAX_TASK_DEPTH + 1 (should fail)
    let task_input_over = create_nested_task_input(MAX_TASK_DEPTH + 1, "test_over_limit");
    let result_over = db.create_task(&task_input_over).await;
    assert!(result_over.is_err(), "Task creation should fail when exceeding max depth");
}

#[tokio::test]
async fn test_task_creation_with_multiple_subtasks_at_depth() {
    // Test that multiple subtasks at the same level work correctly
    let db = Database::new_in_memory().await.expect("Failed to create in-memory database");

    let task_input = TaskInput {
        title: "Parent task with multiple subtasks".to_string(),
        description: Some("Testing multiple subtasks".to_string()),
        priority: Some("high".to_string()),
        project_id: None,
        parent_id: None,
        tags: vec!["multiple_subtasks".to_string()],
        labels: serde_json::json!({}),
        subtasks: vec![
            create_nested_task_input(MAX_TASK_DEPTH - 1, "subtask_1"),
            create_nested_task_input(MAX_TASK_DEPTH - 1, "subtask_2"),
            create_nested_task_input(MAX_TASK_DEPTH - 1, "subtask_3"),
        ],
    };

    let result = db.create_task(&task_input).await;
    assert!(result.is_ok(), "Task creation with multiple deep subtasks should succeed");
}

#[tokio::test]
async fn test_task_creation_zero_depth() {
    // Test that tasks with no subtasks work correctly (depth = 0)
    let db = Database::new_in_memory().await.expect("Failed to create in-memory database");

    let task_input = TaskInput {
        title: "Simple task no subtasks".to_string(),
        description: Some("Task with no subtasks".to_string()),
        priority: Some("normal".to_string()),
        project_id: None,
        parent_id: None,
        tags: vec!["simple".to_string()],
        labels: serde_json::json!({}),
        subtasks: vec![],
    };

    let result = db.create_task(&task_input).await;
    assert!(result.is_ok(), "Simple task creation should succeed");

    let task_id = result.unwrap();
    assert!(!task_id.is_empty(), "Task ID should not be empty");
}

#[tokio::test]
async fn test_create_task_with_depth_function_directly() {
    // Test the create_task_with_depth function directly
    let db = Database::new_in_memory().await.expect("Failed to create in-memory database");

    let task_input = TaskInput {
        title: "Direct depth test".to_string(),
        description: Some("Testing direct depth function".to_string()),
        priority: Some("normal".to_string()),
        project_id: None,
        parent_id: None,
        tags: vec!["direct_test".to_string()],
        labels: serde_json::json!({}),
        subtasks: vec![],
    };

    // Test at maximum allowed depth
    let result_max = db.create_task_with_depth(&task_input, MAX_TASK_DEPTH).await;
    assert!(result_max.is_ok(), "Task creation at max depth should succeed");

    // Test beyond maximum allowed depth
    let result_over = db.create_task_with_depth(&task_input, MAX_TASK_DEPTH + 1).await;
    assert!(result_over.is_err(), "Task creation beyond max depth should fail");

    let error = result_over.err().unwrap();
    let error_msg = error.to_string();
    assert!(error_msg.contains("Task recursion depth exceeded"),
            "Error should mention recursion depth: {}", error_msg);
}

// =====================================================
// Circular Reference Detection Tests
// =====================================================

#[tokio::test]
async fn test_circular_reference_self_parent() {
    // Test that a task cannot be its own parent
    let db = Database::new_in_memory().await.expect("Failed to create in-memory database");

    // Create a simple task
    let task_input = TaskInput {
        title: "Test task".to_string(),
        description: Some("Task for self-parent test".to_string()),
        priority: Some("normal".to_string()),
        project_id: None,
        parent_id: None,
        tags: vec!["self_parent_test".to_string()],
        labels: serde_json::json!({}),
        subtasks: vec![],
    };

    let task_id = db.create_task(&task_input).await.expect("Task creation should succeed");

    // Try to set the task as its own parent
    let result = db.update_task_parent(&task_id, Some(&task_id)).await;
    assert!(result.is_err(), "Setting task as its own parent should fail");

    let error = result.err().unwrap();
    let error_msg = error.to_string();
    assert!(error_msg.contains("circular reference"),
            "Error should mention circular reference: {}", error_msg);
    assert!(error_msg.contains("cannot be its own ancestor"),
            "Error should mention ancestor relationship: {}", error_msg);
}

#[tokio::test]
async fn test_circular_reference_two_task_cycle() {
    // Test A -> B -> A cycle
    let db = Database::new_in_memory().await.expect("Failed to create in-memory database");

    // Create task A
    let task_a_input = TaskInput {
        title: "Task A".to_string(),
        description: Some("First task in cycle test".to_string()),
        priority: Some("normal".to_string()),
        project_id: None,
        parent_id: None,
        tags: vec!["cycle_test".to_string()],
        labels: serde_json::json!({}),
        subtasks: vec![],
    };
    let task_a_id = db.create_task(&task_a_input).await.expect("Task A creation should succeed");

    // Create task B with A as parent
    let task_b_input = TaskInput {
        title: "Task B".to_string(),
        description: Some("Second task in cycle test".to_string()),
        priority: Some("normal".to_string()),
        project_id: None,
        parent_id: Some(task_a_id.clone()),
        tags: vec!["cycle_test".to_string()],
        labels: serde_json::json!({}),
        subtasks: vec![],
    };
    let task_b_id = db.create_task(&task_b_input).await.expect("Task B creation should succeed");

    // Try to set A's parent to B (would create A -> B -> A cycle)
    let result = db.update_task_parent(&task_a_id, Some(&task_b_id)).await;
    assert!(result.is_err(), "Creating A -> B -> A cycle should fail");

    let error = result.err().unwrap();
    let error_msg = error.to_string();
    assert!(error_msg.contains("circular reference"),
            "Error should mention circular reference: {}", error_msg);
}

#[tokio::test]
async fn test_circular_reference_three_task_cycle() {
    // Test A -> B -> C -> A cycle
    let db = Database::new_in_memory().await.expect("Failed to create in-memory database");

    // Create task A
    let task_a_input = TaskInput {
        title: "Task A".to_string(),
        description: Some("First task in three-task cycle".to_string()),
        priority: Some("normal".to_string()),
        project_id: None,
        parent_id: None,
        tags: vec!["three_cycle_test".to_string()],
        labels: serde_json::json!({}),
        subtasks: vec![],
    };
    let task_a_id = db.create_task(&task_a_input).await.expect("Task A creation should succeed");

    // Create task B with A as parent
    let task_b_input = TaskInput {
        title: "Task B".to_string(),
        description: Some("Second task in three-task cycle".to_string()),
        priority: Some("normal".to_string()),
        project_id: None,
        parent_id: Some(task_a_id.clone()),
        tags: vec!["three_cycle_test".to_string()],
        labels: serde_json::json!({}),
        subtasks: vec![],
    };
    let task_b_id = db.create_task(&task_b_input).await.expect("Task B creation should succeed");

    // Create task C with B as parent
    let task_c_input = TaskInput {
        title: "Task C".to_string(),
        description: Some("Third task in three-task cycle".to_string()),
        priority: Some("normal".to_string()),
        project_id: None,
        parent_id: Some(task_b_id.clone()),
        tags: vec!["three_cycle_test".to_string()],
        labels: serde_json::json!({}),
        subtasks: vec![],
    };
    let task_c_id = db.create_task(&task_c_input).await.expect("Task C creation should succeed");

    // Try to set A's parent to C (would create A -> B -> C -> A cycle)
    let result = db.update_task_parent(&task_a_id, Some(&task_c_id)).await;
    assert!(result.is_err(), "Creating A -> B -> C -> A cycle should fail");

    let error = result.err().unwrap();
    let error_msg = error.to_string();
    assert!(error_msg.contains("circular reference"),
            "Error should mention circular reference: {}", error_msg);
}

#[tokio::test]
async fn test_circular_reference_descendant_as_parent() {
    // Test moving a task to be under its own descendant
    let db = Database::new_in_memory().await.expect("Failed to create in-memory database");

    // Create hierarchy: A -> B -> C -> D
    let task_a_input = TaskInput {
        title: "Task A (Root)".to_string(),
        description: Some("Root task".to_string()),
        priority: Some("normal".to_string()),
        project_id: None,
        parent_id: None,
        tags: vec!["descendant_test".to_string()],
        labels: serde_json::json!({}),
        subtasks: vec![],
    };
    let task_a_id = db.create_task(&task_a_input).await.expect("Task A creation should succeed");

    let task_b_input = TaskInput {
        title: "Task B (Child of A)".to_string(),
        description: Some("Child of A".to_string()),
        priority: Some("normal".to_string()),
        project_id: None,
        parent_id: Some(task_a_id.clone()),
        tags: vec!["descendant_test".to_string()],
        labels: serde_json::json!({}),
        subtasks: vec![],
    };
    let task_b_id = db.create_task(&task_b_input).await.expect("Task B creation should succeed");

    let task_c_input = TaskInput {
        title: "Task C (Child of B)".to_string(),
        description: Some("Child of B".to_string()),
        priority: Some("normal".to_string()),
        project_id: None,
        parent_id: Some(task_b_id.clone()),
        tags: vec!["descendant_test".to_string()],
        labels: serde_json::json!({}),
        subtasks: vec![],
    };
    let task_c_id = db.create_task(&task_c_input).await.expect("Task C creation should succeed");

    let task_d_input = TaskInput {
        title: "Task D (Child of C)".to_string(),
        description: Some("Child of C".to_string()),
        priority: Some("normal".to_string()),
        project_id: None,
        parent_id: Some(task_c_id.clone()),
        tags: vec!["descendant_test".to_string()],
        labels: serde_json::json!({}),
        subtasks: vec![],
    };
    let task_d_id = db.create_task(&task_d_input).await.expect("Task D creation should succeed");

    // Try to move A under D (A would become child of its own descendant)
    let result = db.update_task_parent(&task_a_id, Some(&task_d_id)).await;
    assert!(result.is_err(), "Moving task under its own descendant should fail");

    let error = result.err().unwrap();
    let error_msg = error.to_string();
    assert!(error_msg.contains("circular reference"),
            "Error should mention circular reference: {}", error_msg);
}

#[tokio::test]
async fn test_circular_reference_valid_reparenting() {
    // Test that valid reparenting operations work correctly
    let db = Database::new_in_memory().await.expect("Failed to create in-memory database");

    // Create two separate hierarchies: A -> B and C -> D
    let task_a_input = TaskInput {
        title: "Task A".to_string(),
        description: Some("Root of first hierarchy".to_string()),
        priority: Some("normal".to_string()),
        project_id: None,
        parent_id: None,
        tags: vec!["valid_reparent_test".to_string()],
        labels: serde_json::json!({}),
        subtasks: vec![],
    };
    let task_a_id = db.create_task(&task_a_input).await.expect("Task A creation should succeed");

    let task_b_input = TaskInput {
        title: "Task B".to_string(),
        description: Some("Child of A".to_string()),
        priority: Some("normal".to_string()),
        project_id: None,
        parent_id: Some(task_a_id.clone()),
        tags: vec!["valid_reparent_test".to_string()],
        labels: serde_json::json!({}),
        subtasks: vec![],
    };
    let task_b_id = db.create_task(&task_b_input).await.expect("Task B creation should succeed");

    let task_c_input = TaskInput {
        title: "Task C".to_string(),
        description: Some("Root of second hierarchy".to_string()),
        priority: Some("normal".to_string()),
        project_id: None,
        parent_id: None,
        tags: vec!["valid_reparent_test".to_string()],
        labels: serde_json::json!({}),
        subtasks: vec![],
    };
    let task_c_id = db.create_task(&task_c_input).await.expect("Task C creation should succeed");

    let task_d_input = TaskInput {
        title: "Task D".to_string(),
        description: Some("Child of C".to_string()),
        priority: Some("normal".to_string()),
        project_id: None,
        parent_id: Some(task_c_id.clone()),
        tags: vec!["valid_reparent_test".to_string()],
        labels: serde_json::json!({}),
        subtasks: vec![],
    };
    let task_d_id = db.create_task(&task_d_input).await.expect("Task D creation should succeed");

    // Move B from A to C (should work - no cycle)
    let result = db.update_task_parent(&task_b_id, Some(&task_c_id)).await;
    assert!(result.is_ok(), "Moving B from A to C should succeed");
    assert!(result.unwrap(), "Update should return true for successful change");

    // Move D from C to A (should work - no cycle)
    let result = db.update_task_parent(&task_d_id, Some(&task_a_id)).await;
    assert!(result.is_ok(), "Moving D from C to A should succeed");
    assert!(result.unwrap(), "Update should return true for successful change");

    // Make B a root task (remove parent)
    let result = db.update_task_parent(&task_b_id, None).await;
    assert!(result.is_ok(), "Making B a root task should succeed");
    assert!(result.unwrap(), "Update should return true for successful change");
}

#[tokio::test]
async fn test_circular_reference_nonexistent_parent() {
    // Test behavior with non-existent parent IDs
    let db = Database::new_in_memory().await.expect("Failed to create in-memory database");

    // Create a task
    let task_input = TaskInput {
        title: "Test task".to_string(),
        description: Some("Task for non-existent parent test".to_string()),
        priority: Some("normal".to_string()),
        project_id: None,
        parent_id: None,
        tags: vec!["nonexistent_parent_test".to_string()],
        labels: serde_json::json!({}),
        subtasks: vec![],
    };
    let task_id = db.create_task(&task_input).await.expect("Task creation should succeed");

    // Try to set parent to a non-existent task ID
    let fake_parent_id = "non-existent-task-id";
    let result = db.update_task_parent(&task_id, Some(fake_parent_id)).await;

    // This should succeed since we don't validate parent existence in cycle detection
    // (The database foreign key constraint would handle that)
    assert!(result.is_ok(), "Setting non-existent parent should be allowed by cycle detection");
}

#[tokio::test]
async fn test_get_ancestor_ids_function() {
    // Test the get_ancestor_ids function directly
    let db = Database::new_in_memory().await.expect("Failed to create in-memory database");

    // Create hierarchy: A -> B -> C -> D
    let task_a_input = TaskInput {
        title: "Task A".to_string(),
        description: Some("Root task".to_string()),
        priority: Some("normal".to_string()),
        project_id: None,
        parent_id: None,
        tags: vec!["ancestor_test".to_string()],
        labels: serde_json::json!({}),
        subtasks: vec![],
    };
    let task_a_id = db.create_task(&task_a_input).await.expect("Task A creation should succeed");

    let task_b_input = TaskInput {
        title: "Task B".to_string(),
        description: Some("Child of A".to_string()),
        priority: Some("normal".to_string()),
        project_id: None,
        parent_id: Some(task_a_id.clone()),
        tags: vec!["ancestor_test".to_string()],
        labels: serde_json::json!({}),
        subtasks: vec![],
    };
    let task_b_id = db.create_task(&task_b_input).await.expect("Task B creation should succeed");

    let task_c_input = TaskInput {
        title: "Task C".to_string(),
        description: Some("Child of B".to_string()),
        priority: Some("normal".to_string()),
        project_id: None,
        parent_id: Some(task_b_id.clone()),
        tags: vec!["ancestor_test".to_string()],
        labels: serde_json::json!({}),
        subtasks: vec![],
    };
    let task_c_id = db.create_task(&task_c_input).await.expect("Task C creation should succeed");

    let task_d_input = TaskInput {
        title: "Task D".to_string(),
        description: Some("Child of C".to_string()),
        priority: Some("normal".to_string()),
        project_id: None,
        parent_id: Some(task_c_id.clone()),
        tags: vec!["ancestor_test".to_string()],
        labels: serde_json::json!({}),
        subtasks: vec![],
    };
    let task_d_id = db.create_task(&task_d_input).await.expect("Task D creation should succeed");

    // Test ancestors of D should be [C, B, A]
    let ancestors_d = db.get_ancestor_ids(&task_d_id).await.expect("Should get ancestors of D");
    assert_eq!(ancestors_d.len(), 3, "D should have 3 ancestors");
    assert!(ancestors_d.contains(&task_c_id), "D's ancestors should include C");
    assert!(ancestors_d.contains(&task_b_id), "D's ancestors should include B");
    assert!(ancestors_d.contains(&task_a_id), "D's ancestors should include A");

    // Test ancestors of B should be [A]
    let ancestors_b = db.get_ancestor_ids(&task_b_id).await.expect("Should get ancestors of B");
    assert_eq!(ancestors_b.len(), 1, "B should have 1 ancestor");
    assert!(ancestors_b.contains(&task_a_id), "B's ancestor should be A");

    // Test ancestors of A should be empty (root)
    let ancestors_a = db.get_ancestor_ids(&task_a_id).await.expect("Should get ancestors of A");
    assert_eq!(ancestors_a.len(), 0, "A should have no ancestors (root task)");
}

#[tokio::test]
async fn test_would_create_cycle_function() {
    // Test the would_create_cycle function directly
    let db = Database::new_in_memory().await.expect("Failed to create in-memory database");

    // Create hierarchy: A -> B -> C
    let task_a_input = TaskInput {
        title: "Task A".to_string(),
        description: Some("Root task".to_string()),
        priority: Some("normal".to_string()),
        project_id: None,
        parent_id: None,
        tags: vec!["cycle_check_test".to_string()],
        labels: serde_json::json!({}),
        subtasks: vec![],
    };
    let task_a_id = db.create_task(&task_a_input).await.expect("Task A creation should succeed");

    let task_b_input = TaskInput {
        title: "Task B".to_string(),
        description: Some("Child of A".to_string()),
        priority: Some("normal".to_string()),
        project_id: None,
        parent_id: Some(task_a_id.clone()),
        tags: vec!["cycle_check_test".to_string()],
        labels: serde_json::json!({}),
        subtasks: vec![],
    };
    let task_b_id = db.create_task(&task_b_input).await.expect("Task B creation should succeed");

    let task_c_input = TaskInput {
        title: "Task C".to_string(),
        description: Some("Child of B".to_string()),
        priority: Some("normal".to_string()),
        project_id: None,
        parent_id: Some(task_b_id.clone()),
        tags: vec!["cycle_check_test".to_string()],
        labels: serde_json::json!({}),
        subtasks: vec![],
    };
    let task_c_id = db.create_task(&task_c_input).await.expect("Task C creation should succeed");

    // Test that A -> C would create cycle (A is already ancestor of C)
    let would_cycle = db.would_create_cycle(&task_a_id, &task_c_id).await
        .expect("Should check cycle for A -> C");
    assert!(would_cycle, "Setting A's parent to C should create cycle");

    // Test that B -> C would create cycle (B is already ancestor of C)
    let would_cycle = db.would_create_cycle(&task_b_id, &task_c_id).await
        .expect("Should check cycle for B -> C");
    assert!(would_cycle, "Setting B's parent to C should create cycle");

    // Test that C -> B would not create cycle (C is not ancestor of B)
    let would_cycle = db.would_create_cycle(&task_c_id, &task_b_id).await
        .expect("Should check cycle for C -> B");
    assert!(!would_cycle, "Setting C's parent to B should not create cycle");

    // Test self-parenting
    let would_cycle = db.would_create_cycle(&task_a_id, &task_a_id).await
        .expect("Should check self-parenting cycle");
    assert!(would_cycle, "Task cannot be its own parent");
}

// =====================================================
// Transactional Task Creation Tests
// =====================================================

#[tokio::test]
async fn test_transactional_task_creation_success() {
    // Test that transactional task creation works for a normal case
    let db = Database::new_in_memory().await.expect("Failed to create in-memory database");

    let task_input = TaskInput {
        title: "Parent task".to_string(),
        description: Some("Testing transactional creation".to_string()),
        priority: Some("high".to_string()),
        project_id: None,
        parent_id: None,
        tags: vec!["transactional_test".to_string()],
        labels: serde_json::json!({}),
        subtasks: vec![
            TaskInput {
                title: "Subtask 1".to_string(),
                description: Some("First subtask".to_string()),
                priority: Some("normal".to_string()),
                project_id: None,
                parent_id: None, // Will be set automatically
                tags: vec!["subtask".to_string()],
                labels: serde_json::json!({}),
                subtasks: vec![],
            },
            TaskInput {
                title: "Subtask 2".to_string(),
                description: Some("Second subtask".to_string()),
                priority: Some("normal".to_string()),
                project_id: None,
                parent_id: None, // Will be set automatically
                tags: vec!["subtask".to_string()],
                labels: serde_json::json!({}),
                subtasks: vec![],
            },
        ],
    };

    let result = db.create_task_transactional(&task_input).await;
    assert!(result.is_ok(), "Transactional task creation should succeed");

    let parent_id = result.unwrap();
    assert!(!parent_id.is_empty(), "Parent task ID should not be empty");

    // Verify all tasks were created
    let all_tasks = db.list_tasks(None, None).await.expect("Should list all tasks");
    assert_eq!(all_tasks.len(), 1, "Should have 1 root task"); // Only root tasks shown by default

    // Check that subtasks exist with correct parent
    let subtasks = db.list_tasks(None, Some(&parent_id)).await.expect("Should list subtasks");
    assert_eq!(subtasks.len(), 2, "Should have 2 subtasks");
}

#[tokio::test]
async fn test_transactional_rollback_on_depth_exceeded() {
    // Test that exceeding depth limit rolls back the entire transaction
    let db = Database::new_in_memory().await.expect("Failed to create in-memory database");

    // Create a nested task that exceeds the depth limit
    let task_input = create_nested_task_input(MAX_TASK_DEPTH + 1, "rollback_test");

    let result = db.create_task_transactional(&task_input).await;
    assert!(result.is_err(), "Task creation should fail when depth is exceeded");

    // Verify no tasks were created (rollback successful)
    let all_tasks = db.list_tasks(None, None).await.expect("Should list all tasks");
    assert_eq!(all_tasks.len(), 0, "No tasks should exist after rollback");
}

#[tokio::test]
async fn test_transactional_rollback_simulated_failure() {
    // Test rollback behavior with a simulated failure
    // We'll use invalid JSON in labels to trigger a serialization error
    let db = Database::new_in_memory().await.expect("Failed to create in-memory database");

    let task_input = TaskInput {
        title: "Parent task".to_string(),
        description: Some("Testing rollback behavior".to_string()),
        priority: Some("normal".to_string()),
        project_id: None,
        parent_id: None,
        tags: vec!["rollback_test".to_string()],
        labels: serde_json::json!({}),
        subtasks: vec![
            TaskInput {
                title: "Good subtask".to_string(),
                description: Some("This should succeed".to_string()),
                priority: Some("normal".to_string()),
                project_id: None,
                parent_id: None,
                tags: vec!["good".to_string()],
                labels: serde_json::json!({}),
                subtasks: vec![],
            },
            TaskInput {
                title: "Deep nested task that will fail".to_string(),
                description: Some("This will fail due to depth".to_string()),
                priority: Some("normal".to_string()),
                project_id: None,
                parent_id: None,
                tags: vec!["deep".to_string()],
                labels: serde_json::json!({}),
                subtasks: vec![create_nested_task_input(MAX_TASK_DEPTH, "deep_fail")],
            },
        ],
    };

    let result = db.create_task_transactional(&task_input).await;
    assert!(result.is_err(), "Task creation should fail");

    // Verify no tasks were created (including the "good" subtask)
    let all_tasks = db.list_tasks(None, None).await.expect("Should list all tasks");
    assert_eq!(all_tasks.len(), 0, "No tasks should exist after rollback");
}

#[tokio::test]
async fn test_transactional_vs_non_transactional_behavior() {
    // Compare transactional vs non-transactional behavior
    let db = Database::new_in_memory().await.expect("Failed to create in-memory database");

    // First, try non-transactional creation of a task tree where a subtask will fail
    let task_input = TaskInput {
        title: "Non-transactional parent".to_string(),
        description: Some("Testing non-transactional behavior".to_string()),
        priority: Some("normal".to_string()),
        project_id: None,
        parent_id: None,
        tags: vec!["non_transactional_test".to_string()],
        labels: serde_json::json!({}),
        subtasks: vec![
            TaskInput {
                title: "Good subtask".to_string(),
                description: Some("This should succeed".to_string()),
                priority: Some("normal".to_string()),
                project_id: None,
                parent_id: None,
                tags: vec!["good".to_string()],
                labels: serde_json::json!({}),
                subtasks: vec![],
            },
            TaskInput {
                title: "Will fail".to_string(),
                description: Some("This will fail".to_string()),
                priority: Some("normal".to_string()),
                project_id: None,
                parent_id: None,
                tags: vec!["bad".to_string()],
                labels: serde_json::json!({}),
                subtasks: vec![create_nested_task_input(MAX_TASK_DEPTH + 1, "fail")],
            },
        ],
    };

    // Non-transactional creation should fail but leave partial data
    let result = db.create_task_with_depth(&task_input, 0).await;
    assert!(result.is_err(), "Non-transactional creation should fail");

    // Some tasks might have been created before the failure
    let tasks_after_non_transactional = db.list_tasks(Some(10), None).await
        .expect("Should list tasks");
    let non_transactional_count = tasks_after_non_transactional.len();

    // Clean up by creating a fresh database for transactional test
    let db2 = Database::new_in_memory().await.expect("Failed to create second in-memory database");

    // Now try the same with transactional creation
    let result2 = db2.create_task_transactional(&task_input).await;
    assert!(result2.is_err(), "Transactional creation should also fail");

    // But transactional should leave NO partial data
    let tasks_after_transactional = db2.list_tasks(Some(10), None).await
        .expect("Should list tasks");
    assert_eq!(tasks_after_transactional.len(), 0, "Transactional rollback should leave no tasks");

    // Log the difference for visibility in test output
    println!("Non-transactional left {} tasks, transactional left {} tasks",
            non_transactional_count, tasks_after_transactional.len());
}

#[tokio::test]
async fn test_transactional_nested_depth() {
    // Test transactional behavior with complex nested structures
    let db = Database::new_in_memory().await.expect("Failed to create in-memory database");

    let task_input = TaskInput {
        title: "Root task".to_string(),
        description: Some("Complex nested structure".to_string()),
        priority: Some("high".to_string()),
        project_id: None,
        parent_id: None,
        tags: vec!["complex_nested".to_string()],
        labels: serde_json::json!({}),
        subtasks: vec![
            TaskInput {
                title: "Branch 1".to_string(),
                description: Some("First branch".to_string()),
                priority: Some("normal".to_string()),
                project_id: None,
                parent_id: None,
                tags: vec!["branch".to_string()],
                labels: serde_json::json!({}),
                subtasks: vec![
                    create_nested_task_input(MAX_TASK_DEPTH - 2, "branch1_deep"),
                ],
            },
            TaskInput {
                title: "Branch 2".to_string(),
                description: Some("Second branch".to_string()),
                priority: Some("normal".to_string()),
                project_id: None,
                parent_id: None,
                tags: vec!["branch".to_string()],
                labels: serde_json::json!({}),
                subtasks: vec![
                    create_nested_task_input(MAX_TASK_DEPTH - 2, "branch2_deep"),
                ],
            },
        ],
    };

    let result = db.create_task_transactional(&task_input).await;
    assert!(result.is_ok(), "Complex nested structure should succeed within limits");

    let root_id = result.unwrap();

    // Verify the structure was created correctly
    let root_tasks = db.list_tasks(None, None).await.expect("Should list root tasks");
    assert_eq!(root_tasks.len(), 1, "Should have 1 root task");

    let branch_tasks = db.list_tasks(None, Some(&root_id)).await.expect("Should list branches");
    assert_eq!(branch_tasks.len(), 2, "Should have 2 branch tasks");
}