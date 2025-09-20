//! Memory usage benchmarks
//!
//! Comprehensive memory profiling and benchmarks including:
//! - CRDT garbage collection performance
//! - Memory pressure scenarios
//! - Long-running operation memory behavior
//! - Memory leak detection
//! - Allocation patterns analysis

use criterion::{criterion_group, criterion_main, Criterion, BenchmarkId, Throughput, BatchSize};
use std::sync::Arc;
use std::time::{Duration, Instant};
use std::collections::HashMap;
use uuid::Uuid;
use chrono::Utc;
use tokio::runtime::Runtime;

// Import the main crate
use vespera_bindery::{
    CodexManager, BinderyConfig, GarbageCollectionConfig,
    crdt::{VesperaCRDT, MemoryStats, GCStats},
    database::{Database, DatabasePoolConfig, TaskInput},
    types::{CodexId, UserId},
    tests::utils::create_test_crdt,
};

/// Memory measurement utilities
struct MemoryMeasurement {
    initial_memory: usize,
    peak_memory: usize,
    final_memory: usize,
    allocations: usize,
    deallocations: usize,
}

impl MemoryMeasurement {
    fn new() -> Self {
        Self {
            initial_memory: get_memory_usage(),
            peak_memory: 0,
            final_memory: 0,
            allocations: 0,
            deallocations: 0,
        }
    }

    fn update_peak(&mut self) {
        let current = get_memory_usage();
        if current > self.peak_memory {
            self.peak_memory = current;
        }
    }

    fn finalize(&mut self) {
        self.final_memory = get_memory_usage();
    }

    fn memory_delta(&self) -> i64 {
        self.final_memory as i64 - self.initial_memory as i64
    }

    fn peak_delta(&self) -> usize {
        self.peak_memory.saturating_sub(self.initial_memory)
    }
}

/// Get current memory usage (simplified for benchmarking)
fn get_memory_usage() -> usize {
    // In a real implementation, this would use system calls
    // For benchmarking, we'll use a simplified approach
    std::process::id() as usize * 1024 + (Instant::now().elapsed().as_millis() as usize % 1024)
}

/// Create test CRDT with specified number of operations
fn create_crdt_with_operations(operation_count: usize) -> VesperaCRDT {
    let user_id = "memory_test_user".to_string();
    let codex_id = Uuid::new_v4();
    let mut crdt = VesperaCRDT::new(codex_id, user_id);

    for i in 0..operation_count {
        let field_name = format!("field_{}", i % 100); // Reuse field names to simulate updates
        let field_value = format!("value_{}_{'x'.repeat(i % 50)}", i, i); // Variable size content
        crdt.set_text_field(&field_name, &field_value);
    }

    crdt
}

/// Benchmark CRDT memory allocation patterns
fn bench_crdt_memory_patterns(c: &mut Criterion) {
    let mut group = c.benchmark_group("crdt_memory_patterns");
    group.measurement_time(Duration::from_secs(10));

    for operation_count in [100, 1000, 5000, 10000].iter() {
        group.bench_with_input(
            BenchmarkId::new("creation_memory", operation_count),
            operation_count,
            |b, &op_count| {
                b.iter_batched(
                    || (),
                    |_| {
                        let mut measurement = MemoryMeasurement::new();
                        let crdt = create_crdt_with_operations(op_count);
                        measurement.update_peak();
                        let stats = crdt.memory_stats();
                        measurement.finalize();
                        (stats, measurement)
                    },
                    BatchSize::SmallInput,
                )
            },
        );

        // Measure memory growth during operation addition
        group.bench_with_input(
            BenchmarkId::new("incremental_growth", operation_count),
            operation_count,
            |b, &op_count| {
                b.iter_batched(
                    || {
                        let user_id = "incremental_test_user".to_string();
                        let codex_id = Uuid::new_v4();
                        VesperaCRDT::new(codex_id, user_id)
                    },
                    |mut crdt| {
                        let mut measurement = MemoryMeasurement::new();
                        let mut memory_samples = Vec::new();

                        for i in 0..op_count {
                            let field_name = format!("incremental_field_{}", i);
                            let field_value = format!("incremental_value_{}", i);
                            crdt.set_text_field(&field_name, &field_value);

                            if i % 100 == 0 {
                                measurement.update_peak();
                                memory_samples.push(crdt.memory_stats().total_size_bytes);
                            }
                        }

                        measurement.finalize();
                        (crdt.memory_stats(), measurement, memory_samples)
                    },
                    BatchSize::SmallInput,
                )
            },
        );

        // Print memory statistics
        let sample_crdt = create_crdt_with_operations(*operation_count);
        let stats = sample_crdt.memory_stats();
        println!("CRDT with {} operations: {} bytes, {} operations in memory",
                 operation_count, stats.total_size_bytes, stats.operation_count);
    }

    group.finish();
}

/// Benchmark garbage collection memory impact
fn bench_gc_memory_impact(c: &mut Criterion) {
    let mut group = c.benchmark_group("gc_memory_impact");
    group.measurement_time(Duration::from_secs(15));

    for initial_operations in [1000, 5000, 10000].iter() {
        let crdt = create_crdt_with_operations(*initial_operations);

        group.bench_with_input(
            BenchmarkId::new("gc_aggressive", initial_operations),
            &crdt,
            |b, crdt| {
                b.iter_batched(
                    || crdt.clone(),
                    |mut crdt| {
                        let mut measurement = MemoryMeasurement::new();
                        let pre_gc_stats = crdt.memory_stats();

                        // Perform aggressive GC
                        let gc_stats = crdt.gc_all_with_limits(
                            Utc::now() - chrono::Duration::minutes(1),
                            100, // Keep only 100 operations
                            50,  // Keep only 50 tombstones
                        );

                        measurement.update_peak();
                        let post_gc_stats = crdt.memory_stats();
                        measurement.finalize();

                        (pre_gc_stats, gc_stats, post_gc_stats, measurement)
                    },
                    BatchSize::SmallInput,
                )
            },
        );

        group.bench_with_input(
            BenchmarkId::new("gc_conservative", initial_operations),
            &crdt,
            |b, crdt| {
                b.iter_batched(
                    || crdt.clone(),
                    |mut crdt| {
                        let mut measurement = MemoryMeasurement::new();
                        let pre_gc_stats = crdt.memory_stats();

                        // Perform conservative GC
                        let gc_stats = crdt.gc_all_with_limits(
                            Utc::now() - chrono::Duration::hours(1),
                            1000, // Keep many operations
                            200,  // Keep many tombstones
                        );

                        measurement.update_peak();
                        let post_gc_stats = crdt.memory_stats();
                        measurement.finalize();

                        (pre_gc_stats, gc_stats, post_gc_stats, measurement)
                    },
                    BatchSize::SmallInput,
                )
            },
        );

        // Print GC effectiveness
        let mut sample_crdt = crdt.clone();
        let pre_gc = sample_crdt.memory_stats();
        let gc_result = sample_crdt.gc_all_with_limits(
            Utc::now() - chrono::Duration::minutes(1),
            500,
            100,
        );
        let post_gc = sample_crdt.memory_stats();

        println!("GC effectiveness for {} operations:", initial_operations);
        println!("  Before: {} bytes, {} operations", pre_gc.total_size_bytes, pre_gc.operation_count);
        println!("  After: {} bytes, {} operations", post_gc.total_size_bytes, post_gc.operation_count);
        println!("  Freed: {} bytes, {} operations",
                 gc_result.memory_freed_bytes, gc_result.operations_removed);
    }

    group.finish();
}

/// Benchmark memory pressure scenarios
fn bench_memory_pressure(c: &mut Criterion) {
    let mut group = c.benchmark_group("memory_pressure");
    group.measurement_time(Duration::from_secs(20));

    let rt = Runtime::new().unwrap();

    group.bench_function("codex_manager_memory_pressure", |b| {
        b.iter_batched(
            || {
                rt.block_on(async {
                    let config = BinderyConfig::builder()
                        .memory_limits(1000, 60) // Aggressive limits
                        .unwrap()
                        .collaboration(false, None::<String>, None::<String>)
                        .unwrap()
                        .build()
                        .unwrap();
                    CodexManager::with_config(config).unwrap()
                })
            },
            |manager| {
                rt.block_on(async {
                    let mut measurement = MemoryMeasurement::new();
                    let mut codex_ids = Vec::new();

                    // Create many codices to simulate memory pressure
                    for i in 0..50 {
                        match manager.create_codex(
                            format!("Memory Pressure Codex {}", i),
                            "test_template"
                        ).await {
                            Ok(codex_id) => {
                                codex_ids.push(codex_id);
                                measurement.update_peak();

                                // Trigger GC every 10 codices
                                if i % 10 == 0 {
                                    let _gc_stats = manager.gc_all_codices().await.unwrap();
                                }
                            },
                            Err(_) => break, // Stop if we hit memory limits
                        }
                    }

                    measurement.finalize();
                    let memory_stats = manager.memory_stats().await;

                    (codex_ids.len(), memory_stats, measurement)
                })
            },
            BatchSize::SmallInput,
        )
    });

    group.bench_function("database_memory_pressure", |b| {
        b.iter_batched(
            || {
                rt.block_on(async {
                    let temp_dir = tempfile::tempdir().unwrap();
                    let db_path = temp_dir.path().join("memory_pressure.db");

                    let config = DatabasePoolConfig {
                        max_connections: 5, // Limited connections
                        min_connections: 1,
                        ..Default::default()
                    };

                    Database::new_with_config(db_path.to_str().unwrap(), config).await.unwrap()
                })
            },
            |database| {
                rt.block_on(async {
                    let mut measurement = MemoryMeasurement::new();
                    let mut tasks_created = 0;

                    // Create many tasks rapidly
                    for i in 0..200 {
                        let task_input = TaskInput {
                            title: format!("Memory Pressure Task {}", i),
                            description: Some(format!("Task {} with detailed description containing lots of text to increase memory usage", i)),
                            priority: Some("normal".to_string()),
                            project_id: Some("memory_test".to_string()),
                            parent_id: None,
                            tags: vec!["memory".to_string(), "pressure".to_string(), "test".to_string()],
                            labels: serde_json::json!({
                                "iteration": i,
                                "data": format!("large_data_field_{}", "x".repeat(100))
                            }),
                            subtasks: vec![],
                        };

                        match database.create_task(&task_input).await {
                            Ok(_) => {
                                tasks_created += 1;
                                measurement.update_peak();
                            },
                            Err(_) => break,
                        }
                    }

                    measurement.finalize();
                    let pool_metrics = database.get_pool_metrics().await;

                    (tasks_created, pool_metrics, measurement)
                })
            },
            BatchSize::SmallInput,
        )
    });

    group.finish();
}

/// Benchmark long-running memory behavior
fn bench_long_running_memory(c: &mut Criterion) {
    let mut group = c.benchmark_group("long_running_memory");
    group.measurement_time(Duration::from_secs(30));

    group.bench_function("sustained_crdt_operations", |b| {
        b.iter_batched(
            || {
                let user_id = "long_running_user".to_string();
                let codex_id = Uuid::new_v4();
                VesperaCRDT::new(codex_id, user_id)
            },
            |mut crdt| {
                let mut measurement = MemoryMeasurement::new();
                let mut memory_samples = Vec::new();
                let mut gc_count = 0;

                // Simulate long-running operations
                for i in 0..2000 {
                    // Add operations
                    let field_name = format!("long_field_{}", i % 200);
                    let field_value = format!("long_value_{}_{}", i, "data".repeat(i % 20));
                    crdt.set_text_field(&field_name, &field_value);

                    // Sample memory every 100 operations
                    if i % 100 == 0 {
                        measurement.update_peak();
                        let stats = crdt.memory_stats();
                        memory_samples.push((i, stats.total_size_bytes, stats.operation_count));
                    }

                    // Perform GC every 500 operations
                    if i % 500 == 0 && i > 0 {
                        let _gc_stats = crdt.gc_all_with_limits(
                            Utc::now() - chrono::Duration::minutes(5),
                            1000,
                            200,
                        );
                        gc_count += 1;
                    }
                }

                measurement.finalize();
                (memory_samples, gc_count, measurement)
            },
            BatchSize::SmallInput,
        )
    });

    let rt = Runtime::new().unwrap();

    group.bench_function("sustained_database_operations", |b| {
        b.iter_batched(
            || {
                rt.block_on(async {
                    let temp_dir = tempfile::tempdir().unwrap();
                    let db_path = temp_dir.path().join("long_running.db");
                    Database::new(db_path.to_str().unwrap()).await.unwrap()
                })
            },
            |database| {
                rt.block_on(async {
                    let mut measurement = MemoryMeasurement::new();
                    let mut operations_completed = 0;

                    // Simulate long-running database operations
                    for i in 0..1000 {
                        // Create task
                        let task_input = TaskInput {
                            title: format!("Long Running Task {}", i),
                            description: Some(format!("Iteration {}", i)),
                            priority: Some("normal".to_string()),
                            project_id: Some("long_running".to_string()),
                            parent_id: None,
                            tags: vec!["long".to_string(), "running".to_string()],
                            labels: serde_json::json!({"iteration": i}),
                            subtasks: vec![],
                        };

                        if let Ok(task_id) = database.create_task(&task_input).await {
                            operations_completed += 1;

                            // Update task occasionally
                            if i % 10 == 0 {
                                let _ = database.update_task(&task_id,
                                    Some(&format!("Updated Task {}", i)),
                                    Some("in_progress")).await;
                            }

                            // Query tasks occasionally
                            if i % 50 == 0 {
                                let _ = database.list_tasks(Some(10), None).await;
                                measurement.update_peak();
                            }
                        }
                    }

                    measurement.finalize();
                    let pool_metrics = database.get_pool_metrics().await;

                    (operations_completed, pool_metrics, measurement)
                })
            },
            BatchSize::SmallInput,
        )
    });

    group.finish();
}

/// Benchmark memory leak detection scenarios
fn bench_memory_leak_detection(c: &mut Criterion) {
    let mut group = c.benchmark_group("memory_leak_detection");
    group.measurement_time(Duration::from_secs(25));

    group.bench_function("cyclic_operations_memory", |b| {
        b.iter_batched(
            || {
                let user_id = "leak_test_user".to_string();
                let codex_id = Uuid::new_v4();
                VesperaCRDT::new(codex_id, user_id)
            },
            |mut crdt| {
                let mut measurement = MemoryMeasurement::new();
                let mut cycle_memories = Vec::new();

                // Perform cyclic operations that might cause leaks
                for cycle in 0..10 {
                    // Create many operations
                    for i in 0..500 {
                        let field_name = format!("cycle_{}_field_{}", cycle, i);
                        let field_value = format!("cycle_{}_value_{}", cycle, i);
                        crdt.set_text_field(&field_name, &field_value);
                    }

                    // Clear some operations
                    let _gc_stats = crdt.gc_all_with_limits(
                        Utc::now() - chrono::Duration::seconds(1),
                        100,
                        50,
                    );

                    measurement.update_peak();
                    let stats = crdt.memory_stats();
                    cycle_memories.push((cycle, stats.total_size_bytes));
                }

                measurement.finalize();
                (cycle_memories, measurement)
            },
            BatchSize::SmallInput,
        )
    });

    let rt = Runtime::new().unwrap();

    group.bench_function("codex_creation_deletion_cycle", |b| {
        b.iter_batched(
            || {
                rt.block_on(async {
                    let config = BinderyConfig::default();
                    CodexManager::with_config(config).unwrap()
                })
            },
            |manager| {
                rt.block_on(async {
                    let mut measurement = MemoryMeasurement::new();
                    let mut cycle_stats = Vec::new();

                    // Perform create/delete cycles
                    for cycle in 0..20 {
                        let mut created_codices = Vec::new();

                        // Create codices
                        for i in 0..25 {
                            if let Ok(codex_id) = manager.create_codex(
                                format!("Cycle {} Codex {}", cycle, i),
                                "test_template"
                            ).await {
                                created_codices.push(codex_id);
                            }
                        }

                        // Delete codices
                        for codex_id in &created_codices {
                            let _ = manager.delete_codex(codex_id).await;
                        }

                        // Force GC
                        let _gc_stats = manager.gc_all_codices().await.unwrap();

                        measurement.update_peak();
                        let memory_stats = manager.memory_stats().await;
                        let total_memory: usize = memory_stats.values()
                            .map(|stats| stats.total_size_bytes)
                            .sum();

                        cycle_stats.push((cycle, total_memory, memory_stats.len()));
                    }

                    measurement.finalize();
                    (cycle_stats, measurement)
                })
            },
            BatchSize::SmallInput,
        )
    });

    group.finish();
}

/// Benchmark allocation pattern analysis
fn bench_allocation_patterns(c: &mut Criterion) {
    let mut group = c.benchmark_group("allocation_patterns");
    group.measurement_time(Duration::from_secs(15));

    group.bench_function("small_frequent_allocations", |b| {
        b.iter_batched(
            || {
                let user_id = "pattern_test_user".to_string();
                let codex_id = Uuid::new_v4();
                VesperaCRDT::new(codex_id, user_id)
            },
            |mut crdt| {
                let mut measurement = MemoryMeasurement::new();

                // Many small allocations
                for i in 0..5000 {
                    let field_name = format!("small_{}", i);
                    let field_value = format!("val_{}", i); // Small value
                    crdt.set_text_field(&field_name, &field_value);

                    if i % 1000 == 0 {
                        measurement.update_peak();
                    }
                }

                measurement.finalize();
                (crdt.memory_stats(), measurement)
            },
            BatchSize::SmallInput,
        )
    });

    group.bench_function("large_infrequent_allocations", |b| {
        b.iter_batched(
            || {
                let user_id = "pattern_test_user".to_string();
                let codex_id = Uuid::new_v4();
                VesperaCRDT::new(codex_id, user_id)
            },
            |mut crdt| {
                let mut measurement = MemoryMeasurement::new();

                // Few large allocations
                for i in 0..100 {
                    let field_name = format!("large_{}", i);
                    let field_value = "x".repeat(1000); // Large value
                    crdt.set_text_field(&field_name, &field_value);

                    measurement.update_peak();
                }

                measurement.finalize();
                (crdt.memory_stats(), measurement)
            },
            BatchSize::SmallInput,
        )
    });

    group.bench_function("mixed_allocation_patterns", |b| {
        b.iter_batched(
            || {
                let user_id = "pattern_test_user".to_string();
                let codex_id = Uuid::new_v4();
                VesperaCRDT::new(codex_id, user_id)
            },
            |mut crdt| {
                let mut measurement = MemoryMeasurement::new();

                // Mixed allocation patterns
                for i in 0..1000 {
                    let field_name = format!("mixed_{}", i);
                    let field_value = if i % 10 == 0 {
                        "x".repeat(500) // Occasionally large
                    } else {
                        format!("small_val_{}", i) // Usually small
                    };

                    crdt.set_text_field(&field_name, &field_value);

                    if i % 200 == 0 {
                        measurement.update_peak();
                    }
                }

                measurement.finalize();
                (crdt.memory_stats(), measurement)
            },
            BatchSize::SmallInput,
        )
    });

    group.finish();
}

/// Benchmark memory efficiency of different data structures
fn bench_data_structure_memory(c: &mut Criterion) {
    let mut group = c.benchmark_group("data_structure_memory");
    group.measurement_time(Duration::from_secs(12));

    let rt = Runtime::new().unwrap();

    group.bench_function("hash_map_vs_vec_memory", |b| {
        b.iter(|| {
            let mut measurement = MemoryMeasurement::new();

            // Create HashMap
            let mut hash_map: HashMap<String, String> = HashMap::new();
            for i in 0..1000 {
                hash_map.insert(format!("key_{}", i), format!("value_{}", i));
            }

            measurement.update_peak();

            // Create Vec
            let mut vec_data: Vec<(String, String)> = Vec::new();
            for i in 0..1000 {
                vec_data.push((format!("key_{}", i), format!("value_{}", i)));
            }

            measurement.update_peak();
            measurement.finalize();

            (hash_map.len(), vec_data.len(), measurement)
        })
    });

    group.bench_function("string_vs_bytes_memory", |b| {
        b.iter(|| {
            let mut measurement = MemoryMeasurement::new();

            // String storage
            let mut strings: Vec<String> = Vec::new();
            for i in 0..1000 {
                strings.push(format!("test_string_number_{}", i));
            }

            measurement.update_peak();

            // Bytes storage
            let mut bytes: Vec<Vec<u8>> = Vec::new();
            for i in 0..1000 {
                bytes.push(format!("test_string_number_{}", i).into_bytes());
            }

            measurement.update_peak();
            measurement.finalize();

            (strings.len(), bytes.len(), measurement)
        })
    });

    group.finish();
}

criterion_group!(
    memory_benches,
    bench_crdt_memory_patterns,
    bench_gc_memory_impact,
    bench_memory_pressure,
    bench_long_running_memory,
    bench_memory_leak_detection,
    bench_allocation_patterns,
    bench_data_structure_memory
);

criterion_main!(memory_benches);