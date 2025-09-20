//! Task Management and Role Validation Benchmarks
//!
//! This benchmark suite measures the performance of task execution,
//! role validation, and workflow orchestration operations.

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};
use std::time::Duration;
use std::collections::HashMap;
use std::path::PathBuf;
use tokio::runtime::Runtime;
use uuid::Uuid;
use chrono::Utc;

use vespera_bindery::{
    task_management::{
        TaskManager, TaskService, TaskExecutor, ExecutionContext,
        TaskStatus, TaskPriority, TaskRelation, TaskInput, TaskUpdateInput,
        TaskTree, TaskSummary, TaskDashboard, TaskExecutionResult,
        DependencyAnalysis, ExecutionStatus,
    },
    role_management::{
        RoleManager, RoleExecutor, Role, RoleDefinition, Capability,
        RoleExecutionResult, ExecutionRuntime, ToolGroup, RoleContext,
    },
    types::{CodexId, UserId, Template},
    codex::{Codex, CodexManager},
    BinderyResult,
};

/// Generate test data for task management and role validation
struct TaskBenchmarkGenerator {
    runtime: Runtime,
    user_ids: Vec<UserId>,
    codex_ids: Vec<CodexId>,
}

impl TaskBenchmarkGenerator {
    fn new() -> Self {
        let runtime = Runtime::new().expect("Failed to create async runtime");
        let mut user_ids = Vec::new();
        let mut codex_ids = Vec::new();

        // Generate test users and codices
        for _ in 0..10 {
            user_ids.push(UserId::new_v4());
            codex_ids.push(CodexId::new_v4());
        }

        Self {
            runtime,
            user_ids,
            codex_ids,
        }
    }

    fn generate_task_input(&self, index: usize, parent_id: Option<CodexId>) -> TaskInput {
        TaskInput {
            title: format!("Benchmark Task {}", index),
            description: Some(format!("Description for benchmark task {}", index)),
            priority: match index % 4 {
                0 => TaskPriority::Low,
                1 => TaskPriority::Medium,
                2 => TaskPriority::High,
                _ => TaskPriority::Urgent,
            },
            status: TaskStatus::Todo,
            assignee: Some(self.user_ids[index % self.user_ids.len()]),
            parent_id,
            dependencies: vec![],
            labels: {
                let mut labels = HashMap::new();
                labels.insert("category".to_string(), serde_json::Value::String(
                    format!("category_{}", index % 5)
                ));
                labels.insert("component".to_string(), serde_json::Value::String(
                    format!("component_{}", index % 3)
                ));
                labels
            },
            metadata: {
                let mut metadata = HashMap::new();
                metadata.insert("estimated_hours".to_string(), serde_json::Value::Number(
                    ((index % 40) + 1).into()
                ));
                metadata.insert("complexity".to_string(), serde_json::Value::String(
                    ["simple", "moderate", "complex"][index % 3].to_string()
                ));
                metadata
            },
            template_id: Some(Uuid::new_v4()),
        }
    }

    fn generate_task_inputs(&self, count: usize) -> Vec<TaskInput> {
        let mut tasks = Vec::with_capacity(count);

        for i in 0..count {
            let parent_id = if i > 0 && i % 7 == 0 {
                // Some tasks have parents (every 7th task)
                Some(self.codex_ids[i % self.codex_ids.len()])
            } else {
                None
            };

            tasks.push(self.generate_task_input(i, parent_id));
        }

        tasks
    }

    fn create_test_template(&self) -> Template {
        Template {
            id: Uuid::new_v4(),
            name: "task_template".to_string(),
            version: "1.0.0".to_string(),
            description: Some("Template for task benchmarking".to_string()),
            fields: {
                let mut fields = HashMap::new();
                fields.insert("title".to_string(), serde_json::json!({
                    "type": "string",
                    "required": true
                }));
                fields.insert("description".to_string(), serde_json::json!({
                    "type": "text",
                    "required": false
                }));
                fields.insert("priority".to_string(), serde_json::json!({
                    "type": "enum",
                    "values": ["low", "medium", "high", "urgent"]
                }));
                fields
            },
            metadata: HashMap::new(),
        }
    }

    fn generate_role_definitions(&self) -> Vec<RoleDefinition> {
        vec![
            RoleDefinition {
                name: "file_operations".to_string(),
                description: "Role for file system operations".to_string(),
                capabilities: vec![
                    Capability::FileRead,
                    Capability::FileWrite,
                    Capability::DirectoryAccess,
                ],
                tool_groups: vec![ToolGroup::FileOperations],
                file_patterns: vec![
                    "*.txt".to_string(),
                    "*.md".to_string(),
                    "*.json".to_string(),
                ],
                restrictions: HashMap::new(),
            },
            RoleDefinition {
                name: "data_processing".to_string(),
                description: "Role for data analysis and processing".to_string(),
                capabilities: vec![
                    Capability::DataProcessing,
                    Capability::FileRead,
                    Capability::NetworkAccess,
                ],
                tool_groups: vec![ToolGroup::DataProcessing, ToolGroup::Analysis],
                file_patterns: vec![
                    "*.csv".to_string(),
                    "*.json".to_string(),
                    "*.parquet".to_string(),
                ],
                restrictions: {
                    let mut restrictions = HashMap::new();
                    restrictions.insert("max_memory_mb".to_string(), serde_json::Value::Number(1024.into()));
                    restrictions.insert("max_cpu_percent".to_string(), serde_json::Value::Number(50.into()));
                    restrictions
                },
            },
            RoleDefinition {
                name: "command_execution".to_string(),
                description: "Role for executing system commands".to_string(),
                capabilities: vec![
                    Capability::CommandExecution,
                    Capability::ProcessManagement,
                ],
                tool_groups: vec![ToolGroup::SystemCommands],
                file_patterns: vec!["*".to_string()],
                restrictions: {
                    let mut restrictions = HashMap::new();
                    restrictions.insert("allowed_commands".to_string(), serde_json::json!([
                        "ls", "cat", "grep", "find", "wc"
                    ]));
                    restrictions
                },
            },
            RoleDefinition {
                name: "network_operations".to_string(),
                description: "Role for network requests and API calls".to_string(),
                capabilities: vec![
                    Capability::NetworkAccess,
                    Capability::ApiAccess,
                ],
                tool_groups: vec![ToolGroup::NetworkOperations],
                file_patterns: vec![],
                restrictions: {
                    let mut restrictions = HashMap::new();
                    restrictions.insert("allowed_domains".to_string(), serde_json::json!([
                        "api.example.com", "data.service.com"
                    ]));
                    restrictions.insert("rate_limit_per_minute".to_string(), serde_json::Value::Number(60.into()));
                    restrictions
                },
            },
        ]
    }

    async fn setup_task_manager(&self, task_count: usize) -> TaskManager {
        let template = self.create_test_template();
        let codex_manager = CodexManager::new(PathBuf::from("/tmp/benchmark_codex"));

        let task_manager = TaskManager::new(codex_manager)
            .await
            .expect("Failed to create task manager");

        // Create test tasks
        let task_inputs = self.generate_task_inputs(task_count);
        for task_input in task_inputs {
            task_manager.create_task(task_input)
                .await
                .expect("Failed to create task");
        }

        task_manager
    }

    async fn setup_role_manager(&self) -> RoleManager {
        let role_definitions = self.generate_role_definitions();
        let mut role_manager = RoleManager::new();

        for role_def in role_definitions {
            role_manager.register_role(role_def)
                .expect("Failed to register role");
        }

        role_manager
    }
}

/// Benchmark task creation operations
fn benchmark_task_creation(c: &mut Criterion) {
    let generator = TaskBenchmarkGenerator::new();
    let mut group = c.benchmark_group("task_creation");

    for count in [1, 10, 100, 1000].iter() {
        group.throughput(Throughput::Elements(*count as u64));

        group.bench_with_input(
            BenchmarkId::new("create_tasks", count),
            count,
            |b, &count| {
                b.to_async(&generator.runtime).iter_batched(
                    || async {
                        let template = generator.create_test_template();
                        let codex_manager = CodexManager::new(PathBuf::from("/tmp/benchmark_codex"));
                        let task_manager = TaskManager::new(codex_manager)
                            .await
                            .expect("Failed to create task manager");
                        let task_inputs = generator.generate_task_inputs(count);
                        (task_manager, task_inputs)
                    },
                    |(task_manager, task_inputs)| async move {
                        for task_input in task_inputs {
                            black_box(
                                task_manager.create_task(task_input)
                                    .await
                                    .expect("Failed to create task")
                            );
                        }
                    },
                    criterion::BatchSize::SmallInput,
                );
            },
        );
    }

    group.finish();
}

/// Benchmark task tree operations
fn benchmark_task_tree_operations(c: &mut Criterion) {
    let generator = TaskBenchmarkGenerator::new();
    let mut group = c.benchmark_group("task_tree_operations");

    for depth in [2, 5, 10].iter() {
        group.bench_with_input(
            BenchmarkId::new("create_task_tree", depth),
            depth,
            |b, &depth| {
                b.to_async(&generator.runtime).iter_batched(
                    || async {
                        let template = generator.create_test_template();
                        let codex_manager = CodexManager::new(PathBuf::from("/tmp/benchmark_codex"));
                        let task_manager = TaskManager::new(codex_manager)
                            .await
                            .expect("Failed to create task manager");

                        // Generate hierarchical task structure
                        let mut task_inputs = Vec::new();
                        for level in 0..depth {
                            for i in 0..5 {
                                let parent_id = if level > 0 {
                                    Some(generator.codex_ids[0])
                                } else {
                                    None
                                };
                                task_inputs.push(generator.generate_task_input(level * 5 + i, parent_id));
                            }
                        }

                        (task_manager, task_inputs)
                    },
                    |(task_manager, task_inputs)| async move {
                        black_box(
                            task_manager.create_task_tree(task_inputs)
                                .await
                                .expect("Failed to create task tree")
                        );
                    },
                    criterion::BatchSize::SmallInput,
                );
            },
        );
    }

    group.finish();
}

/// Benchmark task execution operations
fn benchmark_task_execution(c: &mut Criterion) {
    let generator = TaskBenchmarkGenerator::new();
    let mut group = c.benchmark_group("task_execution");

    for task_count in [10, 50, 100].iter() {
        group.throughput(Throughput::Elements(*task_count as u64));

        group.bench_with_input(
            BenchmarkId::new("execute_tasks", task_count),
            task_count,
            |b, &task_count| {
                b.to_async(&generator.runtime).iter_batched(
                    || generator.setup_task_manager(task_count),
                    |task_manager| async move {
                        let task_list = task_manager.list_tasks(None, None)
                            .await
                            .expect("Failed to list tasks");

                        for task_summary in task_list.iter().take(10) {
                            black_box(
                                task_manager.execute_task(&task_summary.id)
                                    .await
                                    .expect("Failed to execute task")
                            );
                        }
                    },
                    criterion::BatchSize::SmallInput,
                );
            },
        );
    }

    group.finish();
}

/// Benchmark task dependency analysis
fn benchmark_dependency_analysis(c: &mut Criterion) {
    let generator = TaskBenchmarkGenerator::new();
    let mut group = c.benchmark_group("dependency_analysis");

    for task_count in [50, 200, 500].iter() {
        group.throughput(Throughput::Elements(*task_count as u64));

        group.bench_with_input(
            BenchmarkId::new("analyze_dependencies", task_count),
            task_count,
            |b, &task_count| {
                b.to_async(&generator.runtime).iter_batched(
                    || async {
                        let task_manager = generator.setup_task_manager(task_count).await;

                        // Add some dependencies between tasks
                        let task_list = task_manager.list_tasks(None, None)
                            .await
                            .expect("Failed to list tasks");

                        for i in 1..task_list.len().min(20) {
                            task_manager.add_task_dependency(
                                &task_list[i].id,
                                &task_list[i - 1].id
                            )
                            .await
                            .expect("Failed to add dependency");
                        }

                        task_manager
                    },
                    |task_manager| async move {
                        let task_list = task_manager.list_tasks(None, None)
                            .await
                            .expect("Failed to list tasks");

                        for task_summary in task_list.iter().take(10) {
                            black_box(
                                task_manager.analyze_task_dependencies(&task_summary.id)
                                    .await
                                    .expect("Failed to analyze dependencies")
                            );
                        }
                    },
                    criterion::BatchSize::SmallInput,
                );
            },
        );
    }

    group.finish();
}

/// Benchmark role validation operations
fn benchmark_role_validation(c: &mut Criterion) {
    let generator = TaskBenchmarkGenerator::new();
    let mut group = c.benchmark_group("role_validation");

    for validation_count in [10, 100, 1000].iter() {
        group.throughput(Throughput::Elements(*validation_count as u64));

        group.bench_with_input(
            BenchmarkId::new("validate_role_capabilities", validation_count),
            validation_count,
            |b, &validation_count| {
                b.to_async(&generator.runtime).iter_batched(
                    || async {
                        let role_manager = generator.setup_role_manager().await;
                        let task_manager = generator.setup_task_manager(10).await;
                        let task_list = task_manager.list_tasks(None, None)
                            .await
                            .expect("Failed to list tasks");
                        let roles = role_manager.list_roles();
                        (role_manager, task_list, roles)
                    },
                    |(role_manager, task_list, roles)| async move {
                        for i in 0..validation_count {
                            let task = &task_list[i % task_list.len()];
                            let role = &roles[i % roles.len()];

                            // Get the task codex for validation
                            if let Ok(Some(task_codex)) = task_manager.get_task(&task.id).await {
                                black_box(
                                    role_manager.validate_task_for_role(&task_codex, role)
                                        .await
                                        .unwrap_or_default()
                                );
                            }
                        }
                    },
                    criterion::BatchSize::SmallInput,
                );
            },
        );
    }

    group.finish();
}

/// Benchmark role execution operations
fn benchmark_role_execution(c: &mut Criterion) {
    let generator = TaskBenchmarkGenerator::new();
    let mut group = c.benchmark_group("role_execution");

    for execution_count in [5, 25, 50].iter() {
        group.throughput(Throughput::Elements(*execution_count as u64));

        group.bench_with_input(
            BenchmarkId::new("execute_with_roles", execution_count),
            execution_count,
            |b, &execution_count| {
                b.to_async(&generator.runtime).iter_batched(
                    || async {
                        let role_manager = generator.setup_role_manager().await;
                        let task_manager = generator.setup_task_manager(10).await;
                        let task_list = task_manager.list_tasks(None, None)
                            .await
                            .expect("Failed to list tasks");
                        let roles = role_manager.list_roles();
                        (role_manager, task_list, roles)
                    },
                    |(role_manager, task_list, roles)| async move {
                        for i in 0..execution_count {
                            let task = &task_list[i % task_list.len()];
                            let role_name = &roles[i % roles.len()].name;

                            // Get the task codex for execution
                            if let Ok(Some(task_codex)) = task_manager.get_task(&task.id).await {
                                black_box(
                                    role_manager.execute_task_with_role(&task_codex, role_name)
                                        .await
                                        .unwrap_or_default()
                                );
                            }
                        }
                    },
                    criterion::BatchSize::SmallInput,
                );
            },
        );
    }

    group.finish();
}

/// Benchmark file access validation
fn benchmark_file_access_validation(c: &mut Criterion) {
    let generator = TaskBenchmarkGenerator::new();
    let mut group = c.benchmark_group("file_access_validation");

    let test_files = vec![
        "/tmp/test.txt",
        "/tmp/data.csv",
        "/tmp/config.json",
        "/tmp/script.py",
        "/tmp/document.md",
        "/tmp/binary.exe",
        "/tmp/secret.key",
    ];

    group.bench_function("validate_file_patterns", |b| {
        b.to_async(&generator.runtime).iter_batched(
            || generator.setup_role_manager(),
            |role_manager| async move {
                let roles = role_manager.list_roles();
                let role_executor = RoleExecutor::new();

                for role in &roles {
                    for file_path in &test_files {
                        for &write_access in &[true, false] {
                            black_box(
                                role_executor.validate_file_access(role, file_path, write_access)
                                    .await
                                    .unwrap_or_default()
                            );
                        }
                    }
                }
            },
            criterion::BatchSize::SmallInput,
        );
    });

    group.finish();
}

/// Benchmark task dashboard generation
fn benchmark_task_dashboard(c: &mut Criterion) {
    let generator = TaskBenchmarkGenerator::new();
    let mut group = c.benchmark_group("task_dashboard");

    for task_count in [100, 500, 1000].iter() {
        group.throughput(Throughput::Elements(*task_count as u64));

        group.bench_with_input(
            BenchmarkId::new("generate_dashboard", task_count),
            task_count,
            |b, &task_count| {
                b.to_async(&generator.runtime).iter_batched(
                    || generator.setup_task_manager(task_count),
                    |task_manager| async move {
                        black_box(
                            task_manager.get_task_dashboard(None)
                                .await
                                .expect("Failed to generate dashboard")
                        );
                    },
                    criterion::BatchSize::SmallInput,
                );
            },
        );
    }

    group.finish();
}

/// Benchmark concurrent task operations
fn benchmark_concurrent_operations(c: &mut Criterion) {
    let generator = TaskBenchmarkGenerator::new();
    let mut group = c.benchmark_group("concurrent_task_operations");

    for concurrent_count in [5, 10, 20].iter() {
        group.bench_with_input(
            BenchmarkId::new("concurrent_task_creation", concurrent_count),
            concurrent_count,
            |b, &concurrent_count| {
                b.to_async(&generator.runtime).iter_batched(
                    || async {
                        let template = generator.create_test_template();
                        let codex_manager = CodexManager::new(PathBuf::from("/tmp/benchmark_codex"));
                        let task_manager = TaskManager::new(codex_manager)
                            .await
                            .expect("Failed to create task manager");
                        task_manager
                    },
                    |task_manager| async move {
                        let mut handles = Vec::new();

                        for i in 0..concurrent_count {
                            let task_manager_clone = task_manager.clone();
                            let task_input = generator.generate_task_input(i, None);

                            let handle = tokio::spawn(async move {
                                for j in 0..5 {
                                    let mut task = task_input.clone();
                                    task.title = format!("{} - Iteration {}", task.title, j);
                                    black_box(
                                        task_manager_clone.create_task(task)
                                            .await
                                            .expect("Failed to create task")
                                    );
                                }
                            });

                            handles.push(handle);
                        }

                        for handle in handles {
                            handle.await.expect("Concurrent task creation failed");
                        }
                    },
                    criterion::BatchSize::SmallInput,
                );
            },
        );
    }

    group.finish();
}

criterion_group!(
    name = benches;
    config = Criterion::default()
        .measurement_time(Duration::from_secs(60))
        .sample_size(30)
        .warm_up_time(Duration::from_secs(5));
    targets =
        benchmark_task_creation,
        benchmark_task_tree_operations,
        benchmark_task_execution,
        benchmark_dependency_analysis,
        benchmark_role_validation,
        benchmark_role_execution,
        benchmark_file_access_validation,
        benchmark_task_dashboard,
        benchmark_concurrent_operations
);

criterion_main!(benches);