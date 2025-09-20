//! End-to-End Workflow Benchmarks
//!
//! This benchmark suite measures the performance of complete workflows
//! that integrate multiple systems: CRDT operations, database persistence,
//! RAG indexing, task execution, and role validation.

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};
use std::time::Duration;
use std::collections::HashMap;
use std::path::PathBuf;
use tokio::runtime::Runtime;
use uuid::Uuid;
use tempfile::TempDir;
use std::fs;

use vespera_bindery::{
    // Core systems
    codex::{Codex, CodexManager},
    crdt::{VesperaCRDT, CRDTOperation, OperationType},
    database::Database,
    rag::{RAGService, RAGConfig},

    // Task and role management
    task_management::{TaskManager, TaskInput, TaskPriority, TaskStatus},
    role_management::{RoleManager, RoleDefinition, Capability, ToolGroup},

    // Types
    types::{CodexId, UserId, Template},
    BinderyResult,
};

/// Comprehensive benchmark data generator for end-to-end testing
struct E2EBenchmarkGenerator {
    runtime: Runtime,
    user_ids: Vec<UserId>,
}

impl E2EBenchmarkGenerator {
    fn new() -> Self {
        let runtime = Runtime::new().expect("Failed to create async runtime");
        let mut user_ids = Vec::new();

        // Generate test users
        for _ in 0..5 {
            user_ids.push(UserId::new_v4());
        }

        Self { runtime, user_ids }
    }

    fn create_test_directory(&self) -> TempDir {
        TempDir::new().expect("Failed to create temporary directory")
    }

    fn create_test_template(&self) -> Template {
        Template {
            id: Uuid::new_v4(),
            name: "e2e_test_template".to_string(),
            version: "1.0.0".to_string(),
            description: Some("Template for end-to-end benchmarking".to_string()),
            fields: {
                let mut fields = HashMap::new();
                fields.insert("title".to_string(), serde_json::json!({
                    "type": "string",
                    "required": true
                }));
                fields.insert("content".to_string(), serde_json::json!({
                    "type": "text",
                    "required": true
                }));
                fields.insert("tags".to_string(), serde_json::json!({
                    "type": "array",
                    "items": { "type": "string" }
                }));
                fields
            },
            metadata: HashMap::new(),
        }
    }

    fn generate_test_documents(&self, temp_dir: &PathBuf, count: usize) -> Vec<PathBuf> {
        let mut documents = Vec::new();

        for i in 0..count {
            let content = format!(
                r#"# Document {}

This is a test document for end-to-end benchmarking.

## Content

This document contains various types of content to test the full processing pipeline:

- Text processing and indexing
- CRDT synchronization
- Task creation and execution
- Role-based access control

## Code Example

```rust
fn process_document(id: usize) -> String {{
    format!("Processing document {{}}", id)
}}
```

## Data

| Metric | Value |
|--------|-------|
| Document ID | {} |
| Processing Time | {}ms |
| Size | {}KB |

## Tasks

This document should trigger the following automated tasks:
1. Index document content for RAG search
2. Extract metadata and tags
3. Create follow-up tasks based on content analysis
4. Validate access permissions
5. Sync changes via CRDT operations

Document {} - End of content.
"#,
                i, i, (i * 47) % 1000, (i * 13) % 100, i
            );

            let file_path = temp_dir.join(format!("document_{}.md", i));
            fs::write(&file_path, content).expect("Failed to write test document");
            documents.push(file_path);
        }

        documents
    }

    async fn setup_integrated_system(&self, document_count: usize) -> (
        Database,
        RAGService,
        TaskManager,
        RoleManager,
        CodexManager,
        TempDir,
        Vec<PathBuf>,
    ) {
        let temp_dir = self.create_test_directory();
        let temp_path = temp_dir.path().to_path_buf();

        // Setup database
        let database = Database::new_in_memory()
            .await
            .expect("Failed to create database");
        database.init_schema()
            .await
            .expect("Failed to initialize database schema");

        // Setup RAG service
        let rag_config = RAGConfig::default();
        let rag_service = RAGService::new(&temp_path, rag_config)
            .await
            .expect("Failed to create RAG service");

        // Setup codex manager
        let codex_manager = CodexManager::new(temp_path.clone());

        // Setup task manager
        let task_manager = TaskManager::new(codex_manager.clone())
            .await
            .expect("Failed to create task manager");

        // Setup role manager
        let mut role_manager = RoleManager::new();
        let role_definitions = vec![
            RoleDefinition {
                name: "document_processor".to_string(),
                description: "Processes documents for indexing".to_string(),
                capabilities: vec![
                    Capability::FileRead,
                    Capability::DataProcessing,
                ],
                tool_groups: vec![ToolGroup::FileOperations, ToolGroup::DataProcessing],
                file_patterns: vec!["*.md".to_string(), "*.txt".to_string()],
                restrictions: HashMap::new(),
            },
            RoleDefinition {
                name: "task_orchestrator".to_string(),
                description: "Orchestrates task execution workflows".to_string(),
                capabilities: vec![
                    Capability::TaskManagement,
                    Capability::ProcessManagement,
                ],
                tool_groups: vec![ToolGroup::TaskOrchestration],
                file_patterns: vec!["*".to_string()],
                restrictions: HashMap::new(),
            },
        ];

        for role_def in role_definitions {
            role_manager.register_role(role_def)
                .expect("Failed to register role");
        }

        // Generate test documents
        let documents = self.generate_test_documents(&temp_path, document_count);

        (database, rag_service, task_manager, role_manager, codex_manager, temp_dir, documents)
    }
}

/// Benchmark complete document processing workflow
fn benchmark_document_processing_workflow(c: &mut Criterion) {
    let generator = E2EBenchmarkGenerator::new();
    let mut group = c.benchmark_group("e2e_document_processing");

    for doc_count in [5, 20, 50].iter() {
        group.throughput(Throughput::Elements(*doc_count as u64));

        group.bench_with_input(
            BenchmarkId::new("complete_document_workflow", doc_count),
            doc_count,
            |b, &doc_count| {
                b.to_async(&generator.runtime).iter_batched(
                    || generator.setup_integrated_system(doc_count),
                    |(database, mut rag_service, task_manager, role_manager, codex_manager, _temp_dir, documents)| async move {
                        // Step 1: Index documents in RAG system
                        for doc_path in &documents {
                            black_box(
                                rag_service.index_file(doc_path)
                                    .await
                                    .expect("Failed to index document")
                            );
                        }

                        // Step 2: Create tasks for each document
                        for (i, doc_path) in documents.iter().enumerate() {
                            let task_input = TaskInput {
                                title: format!("Process document {}", i),
                                description: Some(format!("Process document at {:?}", doc_path)),
                                priority: TaskPriority::Medium,
                                status: TaskStatus::Todo,
                                assignee: Some(generator.user_ids[i % generator.user_ids.len()]),
                                parent_id: None,
                                dependencies: vec![],
                                labels: {
                                    let mut labels = HashMap::new();
                                    labels.insert("document_id".to_string(),
                                        serde_json::Value::Number(i.into()));
                                    labels.insert("workflow".to_string(),
                                        serde_json::Value::String("document_processing".to_string()));
                                    labels
                                },
                                metadata: HashMap::new(),
                                template_id: Some(Uuid::new_v4()),
                            };

                            black_box(
                                task_manager.create_task(task_input)
                                    .await
                                    .expect("Failed to create task")
                            );
                        }

                        // Step 3: Execute tasks with roles
                        let task_list = task_manager.list_tasks(None, None)
                            .await
                            .expect("Failed to list tasks");

                        for task_summary in task_list.iter().take(doc_count.min(10)) {
                            if let Ok(Some(task_codex)) = task_manager.get_task(&task_summary.id).await {
                                black_box(
                                    role_manager.execute_task_with_role(&task_codex, "document_processor")
                                        .await
                                        .unwrap_or_default()
                                );
                            }
                        }

                        // Step 4: Perform searches to verify indexing
                        let search_queries = vec![
                            "document processing",
                            "CRDT synchronization",
                            "task creation",
                            "benchmarking test",
                        ];

                        for query in search_queries {
                            black_box(
                                rag_service.search(query, 5, None)
                                    .await
                                    .expect("Failed to search documents")
                            );
                        }

                        // Step 5: Generate dashboard and statistics
                        black_box(
                            task_manager.get_task_dashboard(None)
                                .await
                                .expect("Failed to generate dashboard")
                        );

                        black_box(
                            rag_service.get_stats()
                                .await
                                .expect("Failed to get RAG stats")
                        );
                    },
                    criterion::BatchSize::SmallInput,
                );
            },
        );
    }

    group.finish();
}

/// Benchmark collaborative editing workflow with CRDT operations
fn benchmark_collaborative_editing_workflow(c: &mut Criterion) {
    let generator = E2EBenchmarkGenerator::new();
    let mut group = c.benchmark_group("e2e_collaborative_editing");

    for user_count in [2, 5, 10].iter() {
        group.throughput(Throughput::Elements(*user_count as u64));

        group.bench_with_input(
            BenchmarkId::new("collaborative_editing", user_count),
            user_count,
            |b, &user_count| {
                b.to_async(&generator.runtime).iter_batched(
                    || async {
                        let temp_dir = generator.create_test_directory();
                        let template = generator.create_test_template();
                        let codex_manager = CodexManager::new(temp_dir.path().to_path_buf());

                        // Create initial document
                        let codex_id = CodexId::new_v4();
                        let initial_content = "# Collaborative Document\n\nThis document will be edited by multiple users.";

                        let crdt = VesperaCRDT::new(
                            codex_id,
                            generator.user_ids[0],
                            template,
                        ).expect("Failed to create CRDT");

                        (codex_manager, crdt, codex_id, temp_dir)
                    },
                    |(codex_manager, mut crdt, codex_id, _temp_dir)| async move {
                        // Simulate concurrent editing by multiple users
                        let mut operations = Vec::new();

                        for user_idx in 0..user_count {
                            let user_id = generator.user_ids[user_idx % generator.user_ids.len()];

                            // Each user makes several edits
                            for edit_idx in 0..5 {
                                let operation = CRDTOperation {
                                    id: uuid::Uuid::new_v4(),
                                    user_id,
                                    timestamp: chrono::Utc::now(),
                                    vector_clock: {
                                        let mut vc = crate::types::VectorClock::new();
                                        vc.increment(&user_id);
                                        vc
                                    },
                                    operation_type: OperationType::TextInsert {
                                        position: (user_idx * 100 + edit_idx * 10) % 500,
                                        content: format!(
                                            "\n\n## Section by User {} Edit {}\n\nContent added by user {} in edit {}.",
                                            user_idx, edit_idx, user_idx, edit_idx
                                        ),
                                    },
                                    causally_ready: true,
                                };

                                operations.push(operation);
                            }
                        }

                        // Apply operations and measure CRDT performance
                        for operation in operations {
                            black_box(
                                crdt.apply_operation(operation)
                                    .expect("Failed to apply CRDT operation")
                            );
                        }

                        // Simulate merge operations between different CRDT instances
                        let mut crdt2 = VesperaCRDT::new(
                            codex_id,
                            generator.user_ids[1],
                            generator.create_test_template(),
                        ).expect("Failed to create second CRDT");

                        // Add some operations to second CRDT
                        for i in 0..3 {
                            let operation = CRDTOperation {
                                id: uuid::Uuid::new_v4(),
                                user_id: generator.user_ids[1],
                                timestamp: chrono::Utc::now(),
                                vector_clock: {
                                    let mut vc = crate::types::VectorClock::new();
                                    vc.increment(&generator.user_ids[1]);
                                    vc
                                },
                                operation_type: OperationType::MetadataUpdate {
                                    key: format!("merge_test_{}", i),
                                    value: serde_json::Value::String(format!("value_{}", i)),
                                },
                                causally_ready: true,
                            };

                            crdt2.apply_operation(operation)
                                .expect("Failed to apply operation to second CRDT");
                        }

                        // Perform merge operation
                        black_box(
                            crdt.merge(&crdt2)
                                .expect("Failed to merge CRDTs")
                        );

                        // Measure memory and performance statistics
                        black_box(crdt.get_memory_stats());
                        black_box(crdt.compact_memory());
                    },
                    criterion::BatchSize::SmallInput,
                );
            },
        );
    }

    group.finish();
}

/// Benchmark task orchestration with role-based execution
fn benchmark_task_orchestration_workflow(c: &mut Criterion) {
    let generator = E2EBenchmarkGenerator::new();
    let mut group = c.benchmark_group("e2e_task_orchestration");

    for task_count in [10, 50, 100].iter() {
        group.throughput(Throughput::Elements(*task_count as u64));

        group.bench_with_input(
            BenchmarkId::new("task_orchestration", task_count),
            task_count,
            |b, &task_count| {
                b.to_async(&generator.runtime).iter_batched(
                    || async {
                        let (database, rag_service, task_manager, role_manager, codex_manager, temp_dir, _documents)
                            = generator.setup_integrated_system(5).await;

                        // Create a complex task hierarchy
                        let mut parent_tasks = Vec::new();

                        // Create parent tasks
                        for i in 0..5 {
                            let task_input = TaskInput {
                                title: format!("Parent Task {}", i),
                                description: Some(format!("Parent task {} for orchestration test", i)),
                                priority: TaskPriority::High,
                                status: TaskStatus::Todo,
                                assignee: Some(generator.user_ids[i % generator.user_ids.len()]),
                                parent_id: None,
                                dependencies: vec![],
                                labels: {
                                    let mut labels = HashMap::new();
                                    labels.insert("type".to_string(),
                                        serde_json::Value::String("parent".to_string()));
                                    labels.insert("batch".to_string(),
                                        serde_json::Value::Number(i.into()));
                                    labels
                                },
                                metadata: HashMap::new(),
                                template_id: Some(Uuid::new_v4()),
                            };

                            let task_id = task_manager.create_task(task_input)
                                .await
                                .expect("Failed to create parent task");
                            parent_tasks.push(task_id);
                        }

                        (database, rag_service, task_manager, role_manager, codex_manager, parent_tasks, temp_dir)
                    },
                    |(database, rag_service, task_manager, role_manager, codex_manager, parent_tasks, _temp_dir)| async move {
                        // Create child tasks for each parent
                        let mut all_tasks = Vec::new();

                        for (parent_idx, parent_id) in parent_tasks.iter().enumerate() {
                            for child_idx in 0..(task_count / 5).max(1) {
                                let task_input = TaskInput {
                                    title: format!("Child Task {}-{}", parent_idx, child_idx),
                                    description: Some(format!("Child task {}-{} for orchestration", parent_idx, child_idx)),
                                    priority: TaskPriority::Medium,
                                    status: TaskStatus::Todo,
                                    assignee: Some(generator.user_ids[child_idx % generator.user_ids.len()]),
                                    parent_id: Some(*parent_id),
                                    dependencies: vec![],
                                    labels: {
                                        let mut labels = HashMap::new();
                                        labels.insert("type".to_string(),
                                            serde_json::Value::String("child".to_string()));
                                        labels.insert("parent_batch".to_string(),
                                            serde_json::Value::Number(parent_idx.into()));
                                        labels
                                    },
                                    metadata: HashMap::new(),
                                    template_id: Some(Uuid::new_v4()),
                                };

                                let task_id = task_manager.create_task(task_input)
                                    .await
                                    .expect("Failed to create child task");
                                all_tasks.push(task_id);
                            }
                        }

                        // Add dependencies between tasks
                        for i in 1..all_tasks.len().min(20) {
                            black_box(
                                task_manager.add_task_dependency(&all_tasks[i], &all_tasks[i - 1])
                                    .await
                                    .expect("Failed to add dependency")
                            );
                        }

                        // Analyze dependency graph
                        for task_id in all_tasks.iter().take(10) {
                            black_box(
                                task_manager.analyze_task_dependencies(task_id)
                                    .await
                                    .expect("Failed to analyze dependencies")
                            );
                        }

                        // Execute tasks with different roles
                        let roles = role_manager.list_roles();
                        for (task_idx, task_id) in all_tasks.iter().enumerate().take(task_count.min(20)) {
                            let role_name = &roles[task_idx % roles.len()].name;

                            if let Ok(Some(task_codex)) = task_manager.get_task(task_id).await {
                                // Validate role permissions first
                                for role in &roles {
                                    black_box(
                                        role_manager.validate_task_for_role(&task_codex, role)
                                            .await
                                            .unwrap_or_default()
                                    );
                                }

                                // Execute with assigned role
                                black_box(
                                    role_manager.execute_task_with_role(&task_codex, role_name)
                                        .await
                                        .unwrap_or_default()
                                );
                            }
                        }

                        // Generate comprehensive dashboard
                        black_box(
                            task_manager.get_task_dashboard(None)
                                .await
                                .expect("Failed to generate orchestration dashboard")
                        );

                        // Test database performance under load
                        black_box(
                            database.get_pool_metrics()
                                .await
                        );

                        black_box(
                            database.is_pool_healthy()
                                .await
                        );
                    },
                    criterion::BatchSize::SmallInput,
                );
            },
        );
    }

    group.finish();
}

/// Benchmark system recovery and resilience workflows
fn benchmark_system_resilience_workflow(c: &mut Criterion) {
    let generator = E2EBenchmarkGenerator::new();
    let mut group = c.benchmark_group("e2e_system_resilience");

    group.bench_function("error_recovery_workflow", |b| {
        b.to_async(&generator.runtime).iter_batched(
            || generator.setup_integrated_system(10),
            |(database, mut rag_service, task_manager, role_manager, codex_manager, _temp_dir, documents)| async move {
                // Test 1: RAG system health monitoring
                black_box(
                    rag_service.health_check()
                        .await
                        .expect("Failed to check RAG health")
                );

                // Test 2: Database connection resilience
                for _ in 0..5 {
                    black_box(database.get_pool_metrics().await);
                    black_box(database.is_pool_healthy().await);
                }

                // Test 3: Task system error handling
                let invalid_task_input = TaskInput {
                    title: "".to_string(), // Invalid empty title
                    description: None,
                    priority: TaskPriority::Medium,
                    status: TaskStatus::Todo,
                    assignee: None,
                    parent_id: Some(CodexId::new_v4()), // Non-existent parent
                    dependencies: vec![],
                    labels: HashMap::new(),
                    metadata: HashMap::new(),
                    template_id: None,
                };

                // This should handle the error gracefully
                let _result = task_manager.create_task(invalid_task_input).await;

                // Test 4: Role validation with invalid permissions
                let roles = role_manager.list_roles();
                if let Some(role) = roles.first() {
                    let template = generator.create_test_template();
                    let test_codex = Codex::new(
                        CodexId::new_v4(),
                        generator.user_ids[0],
                        template,
                    ).expect("Failed to create test codex");

                    black_box(
                        role_manager.validate_task_for_role(&test_codex, role)
                            .await
                            .unwrap_or_default()
                    );
                }

                // Test 5: System-wide statistics collection
                black_box(
                    task_manager.get_task_dashboard(None)
                        .await
                        .expect("Failed to generate resilience dashboard")
                );

                black_box(
                    rag_service.get_stats()
                        .await
                        .expect("Failed to get resilience RAG stats")
                );
            },
            criterion::BatchSize::SmallInput,
        );
    });

    group.finish();
}

criterion_group!(
    name = benches;
    config = Criterion::default()
        .measurement_time(Duration::from_secs(120))
        .sample_size(20)
        .warm_up_time(Duration::from_secs(10));
    targets =
        benchmark_document_processing_workflow,
        benchmark_collaborative_editing_workflow,
        benchmark_task_orchestration_workflow,
        benchmark_system_resilience_workflow
);

criterion_main!(benches);