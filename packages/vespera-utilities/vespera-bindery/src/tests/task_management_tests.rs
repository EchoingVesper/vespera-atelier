//! Tests for Task Management functionality
//!
//! This module tests task creation, management, execution, hierarchies,
//! and dependency analysis.

use std::collections::HashMap;
use std::sync::Arc;
use chrono::{DateTime, Utc, Duration};
use uuid::Uuid;

use crate::{
    task_management::{
        TaskManager, TaskService, TaskExecutor, TaskStatus, TaskPriority, TaskRelation,
        TaskInput, TaskUpdateInput, TaskTree, TaskSummary, TaskDashboard,
        TaskExecutionResult, ExecutionStatus, DependencyAnalysis
    },
    types::CodexId,
    tests::utils::{create_mock_task_input, TestFixture, PerformanceTest},
    BinderyConfig, CodexManager,
    role_management::RoleManager,
    hook_system::HookManager,
};

#[cfg(test)]
mod task_models_tests {
    use super::*;

    #[tokio::test]
    async fn test_task_status_serialization() {
        let statuses = vec![
            TaskStatus::Todo,
            TaskStatus::Doing,
            TaskStatus::Review,
            TaskStatus::Done,
            TaskStatus::Blocked,
            TaskStatus::Cancelled,
            TaskStatus::Done,
        ];

        for status in statuses {
            let json_str = serde_json::to_string(&status).expect("Should serialize status");
            let deserialized: TaskStatus = serde_json::from_str(&json_str).expect("Should deserialize status");
            assert_eq!(status, deserialized, "Status should roundtrip");
        }
    }

    #[tokio::test]
    async fn test_task_priority_serialization() {
        let priorities = vec![
            TaskPriority::Critical,
            TaskPriority::High,
            TaskPriority::Normal,
            TaskPriority::Low,
        ];

        for priority in priorities {
            let json_str = serde_json::to_string(&priority).expect("Should serialize priority");
            let deserialized: TaskPriority = serde_json::from_str(&json_str).expect("Should deserialize priority");
            assert_eq!(priority, deserialized, "Priority should roundtrip");
        }
    }

    #[tokio::test]
    async fn test_task_relation_types() {
        let relations = vec![
            TaskRelation::ParentChild,
            TaskRelation::DependsOn,
            TaskRelation::Blocks,
            TaskRelation::RelatesTo,
            TaskRelation::DuplicateOf,
        ];

        for relation in relations {
            let json_str = serde_json::to_string(&relation).expect("Should serialize relation");
            let deserialized: TaskRelation = serde_json::from_str(&json_str).expect("Should deserialize relation");
            assert_eq!(relation, deserialized, "Relation should roundtrip");
        }
    }

    #[tokio::test]
    async fn test_task_input_creation() {
        let task_input = create_mock_task_input("Test Task");

        assert_eq!(task_input.title, "Test Task");
        assert_eq!(task_input.description, Some("Test task: Test Task".to_string()));
        assert_eq!(task_input.priority, Some(TaskPriority::Normal));
        assert!(task_input.due_date.is_none());
        assert!(task_input.labels.is_empty());
    }

    #[tokio::test]
    async fn test_task_input_with_subtasks() {
        let mut task_input = TaskInput {
            title: "Parent Task".to_string(),
            description: Some("A task with subtasks".to_string()),
            priority: Some(TaskPriority::High),
            project_id: Some("project_1".to_string()),
            parent_id: None,
            assignee: Some("user1".to_string()),
            due_date: Some(Utc::now() + Duration::days(7)),
            role: None,
            tags: vec!["urgent".to_string(), "feature".to_string()],
            labels: {
                let mut labels = HashMap::new();
                labels.insert("type".to_string(), "feature".to_string());
                labels.insert("component".to_string(), "backend".to_string());
                labels
            },
            subtasks: vec![
                TaskInput {
                    title: "Subtask 1".to_string(),
                    description: Some("First subtask".to_string()),
                    priority: Some(TaskPriority::Normal),
                    project_id: Some("project_1".to_string()),
                    parent_id: None, // Will be set when parent is created
                    assignee: Some("user2".to_string()),
                    due_date: Some(Utc::now() + Duration::days(3)),
                    role: None,
                    tags: vec!["subtask".to_string()],
                    labels: HashMap::new(),
                    subtasks: vec![],
                },
                TaskInput {
                    title: "Subtask 2".to_string(),
                    description: Some("Second subtask".to_string()),
                    priority: Some(TaskPriority::Low),
                    project_id: Some("project_1".to_string()),
                    parent_id: None,
                    assignee: Some("user3".to_string()),
                    due_date: Some(Utc::now() + Duration::days(5)),
                    role: None,
                    tags: vec!["subtask".to_string()],
                    labels: HashMap::new(),
                    subtasks: vec![],
                },
            ],
        };

        assert_eq!(task_input.subtasks.len(), 2);
        assert_eq!(task_input.tags.len(), 2);
        assert_eq!(task_input.labels.len(), 2);

        // Test serialization with complex structure
        let json_str = serde_json::to_string(&task_input).expect("Should serialize complex task input");
        let deserialized: TaskInput = serde_json::from_str(&json_str).expect("Should deserialize complex task input");

        assert_eq!(deserialized.title, task_input.title);
        assert_eq!(deserialized.subtasks.len(), 2);
        assert_eq!(deserialized.subtasks[0].title, "Subtask 1");
        assert_eq!(deserialized.subtasks[1].title, "Subtask 2");
    }
}

#[cfg(test)]
mod task_execution_tests {
    use super::*;

    #[tokio::test]
    async fn test_execution_status_lifecycle() {
        let statuses = vec![
            ExecutionStatus::Running,
            ExecutionStatus::Running,
            ExecutionStatus::Completed,
            ExecutionStatus::Failed,
            ExecutionStatus::Failed,
        ];

        for status in statuses {
            let json_str = serde_json::to_string(&status).expect("Should serialize execution status");
            let deserialized: ExecutionStatus = serde_json::from_str(&json_str).expect("Should deserialize execution status");
            assert_eq!(status, deserialized, "Execution status should roundtrip");
        }
    }

    #[tokio::test]
    async fn test_task_execution_result() {
        let task_id = Uuid::new_v4();
        let started_at = Utc::now();
        let completed_at = started_at + Duration::minutes(30);
        let duration_ms = 30 * 60 * 1000; // 30 minutes in milliseconds

        let execution_result = TaskExecutionResult {
            task_id,
            execution_id: "exec_123".to_string(),
            status: ExecutionStatus::Completed,
            output: Some("Task completed successfully".to_string()),
            error: None,
            started_at,
            completed_at: Some(completed_at),
            duration_ms: Some(duration_ms),
        };

        assert_eq!(execution_result.task_id, task_id);
        assert_eq!(execution_result.status, ExecutionStatus::Completed);
        assert!(execution_result.output.is_some());
        assert!(execution_result.error.is_none());
        assert_eq!(execution_result.duration_ms, Some(duration_ms));

        // Test serialization
        let json_str = serde_json::to_string(&execution_result).expect("Should serialize execution result");
        let deserialized: TaskExecutionResult = serde_json::from_str(&json_str).expect("Should deserialize execution result");

        assert_eq!(deserialized.task_id, execution_result.task_id);
        assert_eq!(deserialized.status, execution_result.status);
        assert_eq!(deserialized.duration_ms, execution_result.duration_ms);
    }

    #[tokio::test]
    async fn test_failed_execution_result() {
        let task_id = Uuid::new_v4();
        let started_at = Utc::now();

        let execution_result = TaskExecutionResult {
            task_id,
            execution_id: "exec_456".to_string(),
            status: ExecutionStatus::Failed,
            output: None,
            error: Some("Compilation error: missing semicolon".to_string()),
            started_at,
            completed_at: Some(started_at + Duration::minutes(5)),
            duration_ms: Some(5 * 60 * 1000), // 5 minutes
        };

        assert_eq!(execution_result.status, ExecutionStatus::Failed);
        assert!(execution_result.output.is_none());
        assert!(execution_result.error.is_some());
        assert!(execution_result.error.as_ref().unwrap().contains("Compilation error"));
    }
}

#[cfg(test)]
mod task_summary_tests {
    use super::*;

    #[tokio::test]
    async fn test_task_summary_creation() {
        let task_id = Uuid::new_v4();
        let parent_id = Uuid::new_v4();
        let created_at = Utc::now();
        let updated_at = created_at + Duration::hours(2);
        let due_date = created_at + Duration::days(7);

        let task_summary = TaskSummary {
            id: task_id,
            title: "Implement feature X".to_string(),
            status: TaskStatus::Doing,
            priority: TaskPriority::High,
            assignee: Some("developer1".to_string()),
            project_id: Some("proj_123".to_string()),
            parent_id: Some(parent_id),
            child_count: 3,
            created_at,
            updated_at,
            due_date: Some(due_date),
            tags: vec!["feature".to_string(), "backend".to_string(), "urgent".to_string()],
            progress: Some(0.5),
        };

        assert_eq!(task_summary.id, task_id);
        assert_eq!(task_summary.title, "Implement feature X");
        assert_eq!(task_summary.status, TaskStatus::Doing);
        assert_eq!(task_summary.priority, TaskPriority::High);
        assert_eq!(task_summary.child_count, 3);
        assert_eq!(task_summary.tags.len(), 3);

        // Test serialization
        let json_str = serde_json::to_string(&task_summary).expect("Should serialize task summary");
        let deserialized: TaskSummary = serde_json::from_str(&json_str).expect("Should deserialize task summary");

        assert_eq!(deserialized.id, task_summary.id);
        assert_eq!(deserialized.title, task_summary.title);
        assert_eq!(deserialized.tags, task_summary.tags);
    }

    #[tokio::test]
    async fn test_task_tree_structure() {
        let parent_id = Uuid::new_v4();
        let child1_id = Uuid::new_v4();
        let child2_id = Uuid::new_v4();
        let grandchild_id = Uuid::new_v4();

        let created_at = Utc::now();

        let task_tree = TaskTree {
            task: TaskSummary {
                id: parent_id,
                title: "Parent Task".to_string(),
                status: TaskStatus::Doing,
                priority: TaskPriority::High,
                assignee: Some("lead".to_string()),
                project_id: Some("proj_123".to_string()),
                parent_id: None,
                child_count: 2,
                created_at,
                updated_at: created_at,
                due_date: None,
                tags: vec!["epic".to_string()],
                progress: Some(0.33),
            },
            children: vec![
                TaskTree {
                    task: TaskSummary {
                        id: child1_id,
                        title: "Child Task 1".to_string(),
                        status: TaskStatus::Done,
                        priority: TaskPriority::Normal,
                        assignee: Some("dev1".to_string()),
                        project_id: Some("proj_123".to_string()),
                        parent_id: Some(parent_id),
                        child_count: 1,
                        created_at,
                        updated_at: created_at + Duration::hours(1),
                        due_date: None,
                        tags: vec!["feature".to_string()],
                        progress: Some(1.0),
                    },
                    children: vec![
                        TaskTree {
                            task: TaskSummary {
                                id: grandchild_id,
                                title: "Grandchild Task".to_string(),
                                status: TaskStatus::Done,
                                priority: TaskPriority::Low,
                                assignee: Some("dev1".to_string()),
                                project_id: Some("proj_123".to_string()),
                                parent_id: Some(child1_id),
                                child_count: 0,
                                created_at,
                                updated_at: created_at + Duration::hours(2),
                                due_date: None,
                                tags: vec!["subtask".to_string()],
                                progress: Some(1.0),
                            },
                            children: vec![],
                            depth: 2,
                            is_expanded: false,
                        }
                    ],
                    depth: 1,
                    is_expanded: true,
                },
                TaskTree {
                    task: TaskSummary {
                        id: child2_id,
                        title: "Child Task 2".to_string(),
                        status: TaskStatus::Todo,
                        priority: TaskPriority::Normal,
                        assignee: Some("dev2".to_string()),
                        project_id: Some("proj_123".to_string()),
                        parent_id: Some(parent_id),
                        child_count: 0,
                        created_at,
                        updated_at: created_at,
                        due_date: Some(created_at + Duration::days(3)),
                        tags: vec!["feature".to_string()],
                        progress: Some(0.0),
                    },
                    children: vec![],
                    depth: 1,
                    is_expanded: false,
                },
            ],
            depth: 0,
            is_expanded: true,
        };

        assert_eq!(task_tree.depth, 0);
        assert_eq!(task_tree.children.len(), 2);
        assert_eq!(task_tree.children[0].depth, 1);
        assert_eq!(task_tree.children[0].children.len(), 1);
        assert_eq!(task_tree.children[0].children[0].depth, 2);
        assert_eq!(task_tree.children[1].children.len(), 0);

        // Test serialization
        let json_str = serde_json::to_string(&task_tree).expect("Should serialize task tree");
        let deserialized: TaskTree = serde_json::from_str(&json_str).expect("Should deserialize task tree");

        assert_eq!(deserialized.task.id, task_tree.task.id);
        assert_eq!(deserialized.children.len(), 2);
        assert_eq!(deserialized.children[0].children.len(), 1);
    }
}

#[cfg(test)]
mod task_dashboard_tests {
    use super::*;

    #[tokio::test]
    async fn test_task_dashboard_creation() {
        let mut status_breakdown = HashMap::new();
        status_breakdown.insert(TaskStatus::Todo, 5);
        status_breakdown.insert(TaskStatus::Doing, 3);
        status_breakdown.insert(TaskStatus::Review, 2);
        status_breakdown.insert(TaskStatus::Done, 10);
        status_breakdown.insert(TaskStatus::Blocked, 1);

        let mut priority_breakdown = HashMap::new();
        priority_breakdown.insert(TaskPriority::Critical, 1);
        priority_breakdown.insert(TaskPriority::High, 4);
        priority_breakdown.insert(TaskPriority::Normal, 12);
        priority_breakdown.insert(TaskPriority::Low, 3);

        let mut project_breakdown = HashMap::new();
        project_breakdown.insert("project_1".to_string(), 15);
        project_breakdown.insert("project_2".to_string(), 6);

        let dashboard = TaskDashboard {
            total_tasks: 21,
            status_breakdown,
            priority_breakdown,
            recent_tasks: vec![
                TaskSummary {
                    id: Uuid::new_v4(),
                    title: "Recent Task 1".to_string(),
                    status: TaskStatus::Doing,
                    priority: TaskPriority::High,
                    assignee: Some("dev1".to_string()),
                    project_id: Some("project_1".to_string()),
                    parent_id: None,
                    child_count: 0,
                    created_at: Utc::now() - Duration::hours(2),
                    updated_at: Utc::now() - Duration::hours(1),
                    due_date: Some(Utc::now() + Duration::days(2)),
                    tags: vec!["urgent".to_string()],
                    progress: Some(0.25),
                },
            ],
            overdue_tasks: vec![],
            project_breakdown,
            completion_rate: 0.476, // 10 done out of 21 total
            avg_completion_time_hours: Some(24.0),
        };

        assert_eq!(dashboard.total_tasks, 21);
        assert_eq!(dashboard.status_breakdown[&TaskStatus::Done], 10);
        assert_eq!(dashboard.priority_breakdown[&TaskPriority::Normal], 12);
        assert_eq!(dashboard.recent_tasks.len(), 1);
        assert_eq!(dashboard.project_breakdown["project_1"], 15);
        assert!((dashboard.completion_rate - 0.476).abs() < 0.001);
        assert_eq!(dashboard.avg_completion_time_hours, Some(24.0));

        // Test serialization
        let json_str = serde_json::to_string(&dashboard).expect("Should serialize dashboard");
        let deserialized: TaskDashboard = serde_json::from_str(&json_str).expect("Should deserialize dashboard");

        assert_eq!(deserialized.total_tasks, dashboard.total_tasks);
        assert_eq!(deserialized.status_breakdown.len(), 5);
        assert_eq!(deserialized.recent_tasks.len(), 1);
    }
}

#[cfg(test)]
mod dependency_analysis_tests {
    use super::*;

    #[tokio::test]
    async fn test_dependency_analysis() {
        let task_id = Uuid::new_v4();
        let dep1_id = Uuid::new_v4();
        let dep2_id = Uuid::new_v4();
        let blocked1_id = Uuid::new_v4();
        let blocked2_id = Uuid::new_v4();
        let blocking_id = Uuid::new_v4();

        let analysis = DependencyAnalysis {
            task_id,
            depends_on: vec![dep1_id, dep2_id],
            blocks: vec![blocked1_id, blocked2_id],
            is_blocked: true,
            blocking_tasks: vec![blocking_id],
            dependency_depth: 3,
            critical_path: true,
        };

        assert_eq!(analysis.task_id, task_id);
        assert_eq!(analysis.depends_on.len(), 2);
        assert_eq!(analysis.blocks.len(), 2);
        assert!(analysis.is_blocked);
        assert_eq!(analysis.blocking_tasks.len(), 1);
        assert_eq!(analysis.dependency_depth, 3);
        assert!(analysis.critical_path);

        // Test serialization
        let json_str = serde_json::to_string(&analysis).expect("Should serialize dependency analysis");
        let deserialized: DependencyAnalysis = serde_json::from_str(&json_str).expect("Should deserialize dependency analysis");

        assert_eq!(deserialized.task_id, analysis.task_id);
        assert_eq!(deserialized.depends_on, analysis.depends_on);
        assert_eq!(deserialized.blocks, analysis.blocks);
        assert_eq!(deserialized.is_blocked, analysis.is_blocked);
    }

    #[tokio::test]
    async fn test_simple_dependency_analysis() {
        let task_id = Uuid::new_v4();

        let simple_analysis = DependencyAnalysis {
            task_id,
            depends_on: vec![],
            blocks: vec![],
            is_blocked: false,
            blocking_tasks: vec![],
            dependency_depth: 0,
            critical_path: false,
        };

        assert_eq!(simple_analysis.task_id, task_id);
        assert!(simple_analysis.depends_on.is_empty());
        assert!(simple_analysis.blocks.is_empty());
        assert!(!simple_analysis.is_blocked);
        assert!(simple_analysis.blocking_tasks.is_empty());
        assert_eq!(simple_analysis.dependency_depth, 0);
        assert!(!simple_analysis.critical_path);
    }
}

#[cfg(test)]
mod task_manager_tests {
    use super::*;

    #[tokio::test]
    async fn test_task_manager_creation() {
        let fixture = TestFixture::new().expect("Should create fixture");

        // Test that TaskManager can be created with configuration
        // Note: These are placeholder tests since the actual implementations
        // may not be complete yet

        let config = fixture.config.clone();
        // Create required dependencies for TaskManager
        let codex_manager = Arc::new(CodexManager::with_config(config).expect("Should create CodexManager"));
        let role_manager = Arc::new(RoleManager::default());
        let hook_manager = Arc::new(HookManager::new(codex_manager.clone()));

        // Create TaskManager with all required dependencies
        let _task_manager = TaskManager::new(codex_manager, role_manager, hook_manager);
    }

    #[tokio::test]
    async fn test_task_service_creation() {
        // Test TaskService creation with CodexManager
        let config = BinderyConfig::default();
        let codex_manager = Arc::new(CodexManager::with_config(config).expect("Should create CodexManager"));
        let _service = TaskService::new(codex_manager);

        // If we get here, the service was created successfully
        // Note: The actual service functionality may not be fully implemented yet
    }
}

#[cfg(test)]
mod performance_tests {
    use super::*;

    #[tokio::test]
    async fn test_task_serialization_performance() {
        let perf_test = PerformanceTest::new("task serialization");

        // Create a complex task structure
        let mut subtasks = Vec::new();
        for i in 0..100 {
            subtasks.push(TaskInput {
                title: format!("Subtask {}", i),
                description: Some(format!("Description for subtask {}", i)),
                priority: Some(TaskPriority::Normal),
                project_id: Some("project_1".to_string()),
                parent_id: None,
                assignee: Some(format!("user_{}", i % 5)),
                due_date: Some(Utc::now() + Duration::days(i as i64)),
                role: None,
                tags: vec![format!("tag_{}", i), "performance".to_string()],
                labels: {
                    let mut labels = HashMap::new();
                    labels.insert("index".to_string(), i.to_string());
                    labels
                },
                subtasks: vec![],
            });
        }

        let complex_task = TaskInput {
            title: "Complex Task".to_string(),
            description: Some("A task with many subtasks".to_string()),
            priority: Some(TaskPriority::High),
            project_id: Some("project_1".to_string()),
            parent_id: None,
            assignee: Some("project_manager".to_string()),
            due_date: Some(Utc::now() + Duration::days(30)),
            role: None,
            tags: vec!["epic".to_string(), "performance".to_string()],
            labels: HashMap::new(),
            subtasks,
        };

        // Test serialization performance
        for _ in 0..100 {
            let _json_str = serde_json::to_string(&complex_task).expect("Should serialize");
        }

        perf_test.assert_duration_under(std::time::Duration::from_millis(500));
    }

    #[tokio::test]
    async fn test_dashboard_calculation_performance() {
        let perf_test = PerformanceTest::new("dashboard calculation");

        // Create many task summaries
        let mut tasks = Vec::new();
        for i in 0..1000 {
            tasks.push(TaskSummary {
                id: Uuid::new_v4(),
                title: format!("Task {}", i),
                status: match i % 5 {
                    0 => TaskStatus::Todo,
                    1 => TaskStatus::Doing,
                    2 => TaskStatus::Review,
                    3 => TaskStatus::Done,
                    _ => TaskStatus::Blocked,
                },
                priority: match i % 4 {
                    0 => TaskPriority::Critical,
                    1 => TaskPriority::High,
                    2 => TaskPriority::Normal,
                    _ => TaskPriority::Low,
                },
                assignee: Some(format!("user_{}", i % 10)),
                project_id: Some(format!("project_{}", i % 5)),
                parent_id: None,
                child_count: 0,
                created_at: Utc::now() - Duration::days((i % 30) as i64),
                updated_at: Utc::now() - Duration::hours((i % 24) as i64),
                due_date: if i % 3 == 0 { Some(Utc::now() + Duration::days(i as i64)) } else { None },
                tags: vec![format!("tag_{}", i % 20)],
                progress: Some((i % 11) as f64 / 10.0),
            });
        }

        // Simulate dashboard calculation
        let mut status_breakdown = HashMap::new();
        let mut priority_breakdown = HashMap::new();
        let mut project_breakdown = HashMap::new();

        for task in &tasks {
            *status_breakdown.entry(task.status.clone()).or_insert(0) += 1;
            *priority_breakdown.entry(task.priority.clone()).or_insert(0) += 1;
            if let Some(project_id) = &task.project_id {
                *project_breakdown.entry(project_id.clone()).or_insert(0) += 1;
            }
        }

        let done_count = status_breakdown.get(&TaskStatus::Done).copied().unwrap_or(0);
        let completion_rate = done_count as f64 / tasks.len() as f64;

        // Create dashboard
        let _dashboard = TaskDashboard {
            total_tasks: tasks.len(),
            status_breakdown,
            priority_breakdown,
            recent_tasks: tasks.into_iter().take(10).collect(),
            overdue_tasks: vec![],
            project_breakdown,
            completion_rate,
            avg_completion_time_hours: Some(48.0),
        };

        perf_test.assert_duration_under(std::time::Duration::from_millis(100));
    }
}

#[cfg(test)]
mod edge_case_tests {
    use super::*;

    #[tokio::test]
    async fn test_empty_task_input() {
        let empty_task = TaskInput {
            title: "".to_string(),
            description: None,
            priority: None,
            project_id: None,
            parent_id: None,
            assignee: None,
            due_date: None,
            role: None,
            tags: vec![],
            labels: HashMap::new(),
            subtasks: vec![],
        };

        // Test that empty task can be serialized
        let json_str = serde_json::to_string(&empty_task).expect("Should serialize empty task");
        let deserialized: TaskInput = serde_json::from_str(&json_str).expect("Should deserialize empty task");

        assert_eq!(deserialized.title, "");
        assert!(deserialized.description.is_none());
        assert!(deserialized.tags.is_empty());
        assert!(deserialized.subtasks.is_empty());
    }

    #[tokio::test]
    async fn test_circular_dependency_detection() {
        // Test data for circular dependency scenarios
        let task_a = Uuid::new_v4();
        let task_b = Uuid::new_v4();
        let task_c = Uuid::new_v4();

        // Simulate A depends on B, B depends on C, C depends on A (circular)
        let analysis_a = DependencyAnalysis {
            task_id: task_a,
            depends_on: vec![task_b],
            blocks: vec![task_c],
            is_blocked: true,
            blocking_tasks: vec![task_c],
            dependency_depth: 3, // Should be detected as problematic
            critical_path: true,
        };

        // This test just verifies the data structure can represent such scenarios
        // Actual circular dependency detection would be in the business logic
        assert_eq!(analysis_a.dependency_depth, 3);
        assert!(analysis_a.critical_path);
        assert!(analysis_a.is_blocked);
    }

    #[tokio::test]
    async fn test_task_with_unicode_content() {
        let unicode_task = TaskInput {
            title: "🚀 Unicode Task: こんにちは世界 🌟".to_string(),
            description: Some("Description with émojis and açcénts 🎉".to_string()),
            priority: Some(TaskPriority::High),
            project_id: Some("🏗️ Project Unicode".to_string()),
            parent_id: None,
            assignee: Some("👨‍💻 Developer".to_string()),
            due_date: None,
            role: None,
            tags: vec!["🏷️ unicode".to_string(), "🧪 test".to_string()],
            labels: {
                let mut labels = HashMap::new();
                labels.insert("🔑 type".to_string(), "🚀 feature".to_string());
                labels
            },
            subtasks: vec![],
        };

        // Test Unicode serialization
        let json_str = serde_json::to_string(&unicode_task).expect("Should serialize unicode task");
        let deserialized: TaskInput = serde_json::from_str(&json_str).expect("Should deserialize unicode task");

        assert_eq!(deserialized.title, unicode_task.title);
        assert_eq!(deserialized.description, unicode_task.description);
        assert_eq!(deserialized.assignee, unicode_task.assignee);
        assert_eq!(deserialized.tags, unicode_task.tags);
    }
}
