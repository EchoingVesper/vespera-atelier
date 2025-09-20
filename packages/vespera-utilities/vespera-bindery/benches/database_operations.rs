//! Database Operations Benchmarks
//!
//! This benchmark suite measures the performance of database operations
//! including task management, queries, inserts, updates, and deletes.

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};
use std::time::Duration;
use tokio::runtime::Runtime;
use uuid::Uuid;
use chrono::Utc;

use vespera_bindery::{
    database::{Database, TaskInput, TaskSummary, TaskDashboard},
};

/// Generate test data for database operations
struct DatabaseBenchmarkGenerator {
    runtime: Runtime,
}

impl DatabaseBenchmarkGenerator {
    fn new() -> Self {
        let runtime = Runtime::new().expect("Failed to create async runtime");
        Self { runtime }
    }

    fn generate_task_input(&self, index: usize, parent_id: Option<String>) -> TaskInput {
        TaskInput {
            title: format!("Benchmark Task {}", index),
            description: Some(format!("Description for benchmark task {}", index)),
            priority: Some(["low", "medium", "high", "urgent"][index % 4].to_string()),
            project_id: Some(format!("project_{}", index % 5)),
            parent_id,
            tags: vec![
                format!("tag_{}", index % 10),
                format!("category_{}", index % 3),
            ],
            labels: serde_json::json!({
                "environment": ["dev", "staging", "prod"][index % 3],
                "component": format!("component_{}", index % 8)
            }),
            subtasks: vec![], // We'll handle subtasks separately to avoid deep recursion
        }
    }

    fn generate_task_inputs(&self, count: usize) -> Vec<TaskInput> {
        let mut tasks = Vec::with_capacity(count);

        for i in 0..count {
            let parent_id = if i > 0 && i % 5 == 0 {
                // Some tasks have parents (every 5th task)
                Some(format!("task_{}", i - (i % 5)))
            } else {
                None
            };

            tasks.push(self.generate_task_input(i, parent_id));
        }

        tasks
    }

    async fn setup_database_with_data(&self, task_count: usize) -> Database {
        let db = Database::new_in_memory().await.expect("Failed to create in-memory database");
        db.init_schema().await.expect("Failed to initialize schema");

        // Insert test data
        let tasks = self.generate_task_inputs(task_count);
        for task in tasks {
            db.create_task(&task).await.expect("Failed to create task");
        }

        db
    }
}

/// Benchmark task creation operations
fn benchmark_task_creation(c: &mut Criterion) {
    let generator = DatabaseBenchmarkGenerator::new();
    let mut group = c.benchmark_group("database_task_creation");

    for count in [1, 10, 100, 1000].iter() {
        group.throughput(Throughput::Elements(*count as u64));

        group.bench_with_input(
            BenchmarkId::new("create_tasks", count),
            count,
            |b, &count| {
                b.to_async(&generator.runtime).iter_batched(
                    || async {
                        let db = Database::new_in_memory().await.expect("Failed to create database");
                        db.init_schema().await.expect("Failed to initialize schema");
                        let tasks = generator.generate_task_inputs(count);
                        (db, tasks)
                    },
                    |(db, tasks)| async move {
                        for task in tasks {
                            black_box(db.create_task(&task).await.expect("Failed to create task"));
                        }
                    },
                    criterion::BatchSize::SmallInput,
                );
            },
        );
    }

    group.finish();
}

/// Benchmark task querying operations
fn benchmark_task_queries(c: &mut Criterion) {
    let generator = DatabaseBenchmarkGenerator::new();
    let mut group = c.benchmark_group("database_task_queries");

    for task_count in [100, 1000, 10000].iter() {
        group.throughput(Throughput::Elements(*task_count as u64));

        // Benchmark list_tasks with different limits
        for limit in [10, 50, 100].iter() {
            group.bench_with_input(
                BenchmarkId::new(format!("list_tasks_limit_{}", limit), task_count),
                task_count,
                |b, &task_count| {
                    b.to_async(&generator.runtime).iter_batched(
                        || generator.setup_database_with_data(task_count),
                        |db| async move {
                            black_box(
                                db.list_tasks(Some(*limit), None)
                                    .await
                                    .expect("Failed to list tasks")
                            );
                        },
                        criterion::BatchSize::SmallInput,
                    );
                },
            );
        }

        // Benchmark dashboard queries
        group.bench_with_input(
            BenchmarkId::new("get_dashboard", task_count),
            task_count,
            |b, &task_count| {
                b.to_async(&generator.runtime).iter_batched(
                    || generator.setup_database_with_data(task_count),
                    |db| async move {
                        black_box(
                            db.get_task_dashboard(None)
                                .await
                                .expect("Failed to get dashboard")
                        );
                    },
                    criterion::BatchSize::SmallInput,
                );
            },
        );
    }

    group.finish();
}

/// Benchmark task update operations
fn benchmark_task_updates(c: &mut Criterion) {
    let generator = DatabaseBenchmarkGenerator::new();
    let mut group = c.benchmark_group("database_task_updates");

    for task_count in [100, 1000, 5000].iter() {
        group.throughput(Throughput::Elements(*task_count as u64));

        group.bench_with_input(
            BenchmarkId::new("update_tasks", task_count),
            task_count,
            |b, &task_count| {
                b.to_async(&generator.runtime).iter_batched(
                    || async {
                        let db = generator.setup_database_with_data(task_count).await;
                        let tasks = db.list_tasks(Some(task_count as i32), None)
                            .await
                            .expect("Failed to list tasks");
                        (db, tasks)
                    },
                    |(db, tasks)| async move {
                        for (i, task) in tasks.iter().enumerate() {
                            let new_title = format!("Updated Task {}", i);
                            let new_status = ["todo", "in_progress", "done"][i % 3];

                            black_box(
                                db.update_task(&task.id, Some(&new_title), Some(new_status))
                                    .await
                                    .expect("Failed to update task")
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

/// Benchmark task deletion operations
fn benchmark_task_deletions(c: &mut Criterion) {
    let generator = DatabaseBenchmarkGenerator::new();
    let mut group = c.benchmark_group("database_task_deletions");

    for task_count in [100, 1000, 5000].iter() {
        group.throughput(Throughput::Elements(*task_count as u64));

        group.bench_with_input(
            BenchmarkId::new("delete_tasks", task_count),
            task_count,
            |b, &task_count| {
                b.to_async(&generator.runtime).iter_batched(
                    || async {
                        let db = generator.setup_database_with_data(task_count).await;
                        let tasks = db.list_tasks(Some(task_count as i32), None)
                            .await
                            .expect("Failed to list tasks");
                        (db, tasks)
                    },
                    |(db, tasks)| async move {
                        for task in tasks {
                            black_box(
                                db.delete_task(&task.id)
                                    .await
                                    .expect("Failed to delete task")
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

/// Benchmark concurrent database operations
fn benchmark_concurrent_operations(c: &mut Criterion) {
    let generator = DatabaseBenchmarkGenerator::new();
    let mut group = c.benchmark_group("database_concurrent_operations");

    for concurrent_tasks in [5, 10, 20].iter() {
        group.bench_with_input(
            BenchmarkId::new("concurrent_inserts", concurrent_tasks),
            concurrent_tasks,
            |b, &concurrent_tasks| {
                b.to_async(&generator.runtime).iter_batched(
                    || async {
                        let db = Database::new_in_memory().await.expect("Failed to create database");
                        db.init_schema().await.expect("Failed to initialize schema");
                        db
                    },
                    |db| async move {
                        let mut handles = Vec::new();

                        for i in 0..concurrent_tasks {
                            let db_clone = db;
                            let task_input = generator.generate_task_input(i, None);

                            let handle = tokio::spawn(async move {
                                for j in 0..10 {
                                    let mut task = task_input.clone();
                                    task.title = format!("{} - Iteration {}", task.title, j);
                                    black_box(
                                        db_clone.create_task(&task)
                                            .await
                                            .expect("Failed to create task")
                                    );
                                }
                            });

                            handles.push(handle);
                        }

                        // Wait for all concurrent operations to complete
                        for handle in handles {
                            handle.await.expect("Task failed");
                        }
                    },
                    criterion::BatchSize::SmallInput,
                );
            },
        );
    }

    group.finish();
}

/// Benchmark database connection pool performance
fn benchmark_connection_pool(c: &mut Criterion) {
    let generator = DatabaseBenchmarkGenerator::new();
    let mut group = c.benchmark_group("database_connection_pool");

    group.bench_function("pool_metrics", |b| {
        b.to_async(&generator.runtime).iter_batched(
            || generator.setup_database_with_data(100),
            |db| async move {
                black_box(db.get_pool_metrics().await);
                black_box(db.is_pool_healthy().await);
            },
            criterion::BatchSize::SmallInput,
        );
    });

    group.bench_function("pool_stress_test", |b| {
        b.to_async(&generator.runtime).iter_batched(
            || generator.setup_database_with_data(10),
            |db| async move {
                let mut handles = Vec::new();

                // Simulate heavy pool usage
                for i in 0..50 {
                    let db_clone = db;
                    let handle = tokio::spawn(async move {
                        black_box(db_clone.list_tasks(Some(10), None).await);
                        black_box(db_clone.get_task_dashboard(None).await);
                    });
                    handles.push(handle);
                }

                for handle in handles {
                    handle.await.expect("Pool stress test failed");
                }
            },
            criterion::BatchSize::SmallInput,
        );
    });

    group.finish();
}

/// Benchmark complex queries with hierarchical data
fn benchmark_hierarchical_queries(c: &mut Criterion) {
    let generator = DatabaseBenchmarkGenerator::new();
    let mut group = c.benchmark_group("database_hierarchical_queries");

    for depth in [2, 5, 10].iter() {
        group.bench_with_input(
            BenchmarkId::new("hierarchical_tasks", depth),
            depth,
            |b, &depth| {
                b.to_async(&generator.runtime).iter_batched(
                    || async {
                        let db = Database::new_in_memory().await.expect("Failed to create database");
                        db.init_schema().await.expect("Failed to initialize schema");

                        // Create hierarchical structure
                        let mut parent_id: Option<String> = None;

                        for level in 0..depth {
                            let task_input = generator.generate_task_input(level, parent_id.clone());
                            let task_id = db.create_task(&task_input)
                                .await
                                .expect("Failed to create task");

                            // Create children at each level
                            for child in 0..5 {
                                let child_input = generator.generate_task_input(
                                    level * 10 + child,
                                    Some(task_id.clone())
                                );
                                db.create_task(&child_input)
                                    .await
                                    .expect("Failed to create child task");
                            }

                            parent_id = Some(task_id);
                        }

                        db
                    },
                    |db| async move {
                        // Query all root tasks and their children
                        black_box(
                            db.list_tasks(None, None)
                                .await
                                .expect("Failed to list hierarchical tasks")
                        );

                        // Query dashboard which aggregates hierarchical data
                        black_box(
                            db.get_task_dashboard(None)
                                .await
                                .expect("Failed to get hierarchical dashboard")
                        );
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
        .sample_size(50)
        .warm_up_time(Duration::from_secs(5));
    targets =
        benchmark_task_creation,
        benchmark_task_queries,
        benchmark_task_updates,
        benchmark_task_deletions,
        benchmark_concurrent_operations,
        benchmark_connection_pool,
        benchmark_hierarchical_queries
);

criterion_main!(benches);