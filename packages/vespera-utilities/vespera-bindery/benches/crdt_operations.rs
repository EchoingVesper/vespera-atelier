//! CRDT Operations Benchmarks
//!
//! This benchmark suite measures the performance of core CRDT operations
//! to detect performance regressions in collaborative editing functionality.

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};
use std::collections::HashMap;
use std::time::Duration;
use uuid::Uuid;
use chrono::Utc;

use vespera_bindery::{
    crdt::{
        VesperaCRDT, CRDTOperation, OperationType, OperationPool,
        LWWMap, ORSet, YTextCRDT,
        LWWMapStats, ORSetStats,
    },
    types::{CodexId, UserId, OperationId, VectorClock, Template},
    BinderyResult,
};

/// Generate test data for CRDT operations
struct BenchmarkDataGenerator {
    user_ids: Vec<UserId>,
    codex_ids: Vec<CodexId>,
}

impl BenchmarkDataGenerator {
    fn new() -> Self {
        let mut user_ids = Vec::new();
        let mut codex_ids = Vec::new();

        // Generate test users and codices
        for i in 0..10 {
            user_ids.push(UserId::new_v4());
            codex_ids.push(CodexId::new_v4());
        }

        Self { user_ids, codex_ids }
    }

    fn create_test_template() -> Template {
        Template {
            id: Uuid::new_v4(),
            name: "benchmark_template".to_string(),
            version: "1.0.0".to_string(),
            description: Some("Template for benchmarking".to_string()),
            fields: HashMap::new(),
            metadata: HashMap::new(),
        }
    }

    fn generate_crdt_operations(&self, count: usize) -> Vec<CRDTOperation> {
        let mut operations = Vec::with_capacity(count);
        let template = Self::create_test_template();

        for i in 0..count {
            let user_id = self.user_ids[i % self.user_ids.len()];
            let operation_id = OperationId::new_v4();
            let mut vector_clock = VectorClock::new();
            vector_clock.increment(&user_id);

            let operation_type = match i % 4 {
                0 => OperationType::TextInsert {
                    position: i % 1000,
                    content: format!("Text content {}", i),
                },
                1 => OperationType::TextDelete {
                    position: i % 1000,
                    length: (i % 10) + 1,
                },
                2 => OperationType::MetadataUpdate {
                    key: format!("key_{}", i % 50),
                    value: serde_json::Value::String(format!("value_{}", i)),
                },
                _ => OperationType::ReferenceAdd {
                    reference: format!("ref_{}", i),
                },
            };

            operations.push(CRDTOperation {
                id: operation_id,
                user_id,
                timestamp: Utc::now(),
                vector_clock,
                operation_type,
                causally_ready: true,
            });
        }

        operations
    }

    fn create_test_crdt(&self) -> VesperaCRDT {
        let template = Self::create_test_template();
        VesperaCRDT::new(
            self.codex_ids[0],
            self.user_ids[0],
            template,
        ).expect("Failed to create test CRDT")
    }

    fn create_lww_map_with_data(&self, size: usize) -> LWWMap<String, serde_json::Value> {
        let mut map = LWWMap::new();
        let user_id = self.user_ids[0];

        for i in 0..size {
            let key = format!("key_{}", i);
            let value = serde_json::Value::String(format!("value_{}", i));
            let timestamp = Utc::now();
            map.insert(key, value, user_id, timestamp);
        }

        map
    }

    fn create_or_set_with_data(&self, size: usize) -> ORSet<String> {
        let mut set = ORSet::new();
        let user_id = self.user_ids[0];

        for i in 0..size {
            let element = format!("element_{}", i);
            set.add(element, user_id);
        }

        set
    }
}

/// Benchmark single CRDT operation application
fn benchmark_single_operation_apply(c: &mut Criterion) {
    let generator = BenchmarkDataGenerator::new();
    let mut group = c.benchmark_group("crdt_single_operation");

    for size in [1, 10, 100].iter() {
        group.throughput(Throughput::Elements(*size as u64));

        group.bench_with_input(
            BenchmarkId::new("apply_operation", size),
            size,
            |b, &size| {
                b.iter_batched(
                    || {
                        let crdt = generator.create_test_crdt();
                        let operations = generator.generate_crdt_operations(size);
                        (crdt, operations)
                    },
                    |(mut crdt, operations)| {
                        for operation in operations {
                            black_box(crdt.apply_operation(operation).unwrap());
                        }
                    },
                    criterion::BatchSize::SmallInput,
                );
            },
        );
    }

    group.finish();
}

/// Benchmark CRDT merge operations
fn benchmark_crdt_merge(c: &mut Criterion) {
    let generator = BenchmarkDataGenerator::new();
    let mut group = c.benchmark_group("crdt_merge");

    for size in [10, 100, 1000].iter() {
        group.throughput(Throughput::Elements(*size as u64));

        group.bench_with_input(
            BenchmarkId::new("merge_crdts", size),
            size,
            |b, &size| {
                b.iter_batched(
                    || {
                        let mut crdt1 = generator.create_test_crdt();
                        let mut crdt2 = generator.create_test_crdt();

                        // Apply different operations to each CRDT
                        let ops1 = generator.generate_crdt_operations(size / 2);
                        let ops2 = generator.generate_crdt_operations(size / 2);

                        for op in ops1 {
                            crdt1.apply_operation(op).unwrap();
                        }
                        for op in ops2 {
                            crdt2.apply_operation(op).unwrap();
                        }

                        (crdt1, crdt2)
                    },
                    |(mut crdt1, crdt2)| {
                        black_box(crdt1.merge(&crdt2).unwrap());
                    },
                    criterion::BatchSize::SmallInput,
                );
            },
        );
    }

    group.finish();
}

/// Benchmark LWW-Map operations
fn benchmark_lww_map_operations(c: &mut Criterion) {
    let generator = BenchmarkDataGenerator::new();
    let mut group = c.benchmark_group("lww_map_operations");

    // Benchmark insertions
    for size in [100, 1000, 10000].iter() {
        group.throughput(Throughput::Elements(*size as u64));

        group.bench_with_input(
            BenchmarkId::new("insert", size),
            size,
            |b, &size| {
                b.iter_batched(
                    || {
                        let mut map = LWWMap::new();
                        let user_id = generator.user_ids[0];
                        (map, user_id)
                    },
                    |(mut map, user_id)| {
                        for i in 0..size {
                            let key = format!("key_{}", i);
                            let value = serde_json::Value::Number(i.into());
                            black_box(map.insert(key, value, user_id, Utc::now()));
                        }
                    },
                    criterion::BatchSize::SmallInput,
                );
            },
        );
    }

    // Benchmark merges
    for size in [100, 1000, 5000].iter() {
        group.bench_with_input(
            BenchmarkId::new("merge", size),
            size,
            |b, &size| {
                b.iter_batched(
                    || {
                        let map1 = generator.create_lww_map_with_data(size);
                        let map2 = generator.create_lww_map_with_data(size);
                        (map1, map2)
                    },
                    |(mut map1, map2)| {
                        black_box(map1.merge(&map2));
                    },
                    criterion::BatchSize::SmallInput,
                );
            },
        );
    }

    group.finish();
}

/// Benchmark OR-Set operations
fn benchmark_or_set_operations(c: &mut Criterion) {
    let generator = BenchmarkDataGenerator::new();
    let mut group = c.benchmark_group("or_set_operations");

    // Benchmark additions
    for size in [100, 1000, 10000].iter() {
        group.throughput(Throughput::Elements(*size as u64));

        group.bench_with_input(
            BenchmarkId::new("add", size),
            size,
            |b, &size| {
                b.iter_batched(
                    || {
                        let mut set = ORSet::new();
                        let user_id = generator.user_ids[0];
                        (set, user_id)
                    },
                    |(mut set, user_id)| {
                        for i in 0..size {
                            let element = format!("element_{}", i);
                            black_box(set.add(element, user_id));
                        }
                    },
                    criterion::BatchSize::SmallInput,
                );
            },
        );
    }

    // Benchmark merges
    for size in [100, 1000, 5000].iter() {
        group.bench_with_input(
            BenchmarkId::new("merge", size),
            size,
            |b, &size| {
                b.iter_batched(
                    || {
                        let set1 = generator.create_or_set_with_data(size);
                        let set2 = generator.create_or_set_with_data(size);
                        (set1, set2)
                    },
                    |(mut set1, set2)| {
                        black_box(set1.merge(&set2));
                    },
                    criterion::BatchSize::SmallInput,
                );
            },
        );
    }

    group.finish();
}

/// Benchmark operation pooling efficiency
fn benchmark_operation_pool(c: &mut Criterion) {
    let generator = BenchmarkDataGenerator::new();
    let mut group = c.benchmark_group("operation_pool");

    for pool_size in [100, 1000, 10000].iter() {
        group.bench_with_input(
            BenchmarkId::new("pool_usage", pool_size),
            pool_size,
            |b, &pool_size| {
                b.iter_batched(
                    || {
                        let mut pool = OperationPool::new(pool_size);
                        let operations = generator.generate_crdt_operations(pool_size / 2);
                        (pool, operations)
                    },
                    |(mut pool, operations)| {
                        // Simulate pool usage pattern
                        for operation in operations {
                            if let Some(mut pooled_op) = pool.get() {
                                // Modify the pooled operation
                                pooled_op.id = operation.id;
                                pooled_op.user_id = operation.user_id;
                                pooled_op.operation_type = operation.operation_type;
                                black_box(pool.return_to_pool(pooled_op));
                            } else {
                                // Pool is empty, use the new operation directly
                                black_box(pool.return_to_pool(operation));
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

/// Benchmark memory usage patterns
fn benchmark_memory_patterns(c: &mut Criterion) {
    let generator = BenchmarkDataGenerator::new();
    let mut group = c.benchmark_group("memory_patterns");

    // Benchmark memory cleanup efficiency
    group.bench_function("memory_cleanup", |b| {
        b.iter_batched(
            || {
                let mut crdt = generator.create_test_crdt();
                let operations = generator.generate_crdt_operations(1000);

                // Apply operations to create memory pressure
                for operation in operations {
                    crdt.apply_operation(operation).unwrap();
                }

                crdt
            },
            |mut crdt| {
                // Simulate memory cleanup
                black_box(crdt.get_memory_stats());
                black_box(crdt.compact_memory());
            },
            criterion::BatchSize::SmallInput,
        );
    });

    group.finish();
}

criterion_group!(
    name = benches;
    config = Criterion::default()
        .measurement_time(Duration::from_secs(30))
        .sample_size(100)
        .warm_up_time(Duration::from_secs(3));
    targets =
        benchmark_single_operation_apply,
        benchmark_crdt_merge,
        benchmark_lww_map_operations,
        benchmark_or_set_operations,
        benchmark_operation_pool,
        benchmark_memory_patterns
);

criterion_main!(benches);