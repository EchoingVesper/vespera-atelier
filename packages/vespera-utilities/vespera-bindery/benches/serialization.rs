//! MessagePack serialization benchmarks
//!
//! Comprehensive benchmarks comparing serialization formats:
//! - JSON vs MessagePack vs Bincode performance
//! - Compression ratio analysis
//! - Memory usage impact
//! - Real-world CRDT data serialization

use criterion::{criterion_group, criterion_main, Criterion, BenchmarkId, Throughput, BatchSize};
use std::collections::HashMap;
use std::time::Duration;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};

// Import the main crate
use vespera_bindery::{
    crdt::{VesperaCRDT, CRDTOperation, OperationType, TemplateValue},
    types::{CodexId, UserId, VectorClock},
    task_management::{TaskInput, TaskStatus, TaskPriority},
    database::TaskSummary,
};

/// Test data structures for serialization benchmarks
#[derive(Serialize, Deserialize, Clone, Debug)]
struct BenchmarkData {
    id: Uuid,
    title: String,
    description: Option<String>,
    metadata: HashMap<String, String>,
    tags: Vec<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    nested_data: NestedData,
    large_text: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct NestedData {
    values: Vec<f64>,
    flags: HashMap<String, bool>,
    complex_structure: ComplexStructure,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct ComplexStructure {
    matrix: Vec<Vec<i32>>,
    operations: Vec<MockOperation>,
    references: Vec<Uuid>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct MockOperation {
    id: Uuid,
    operation_type: String,
    timestamp: DateTime<Utc>,
    user_id: String,
    payload: serde_json::Value,
}

/// Generate test data for benchmarking
fn generate_benchmark_data(size: usize) -> Vec<BenchmarkData> {
    let mut data = Vec::with_capacity(size);

    for i in 0..size {
        let item = BenchmarkData {
            id: Uuid::new_v4(),
            title: format!("Benchmark Item {}", i),
            description: if i % 3 == 0 {
                Some(format!("Description for item {} with additional details and information", i))
            } else {
                None
            },
            metadata: {
                let mut meta = HashMap::new();
                meta.insert("type".to_string(), "benchmark".to_string());
                meta.insert("index".to_string(), i.to_string());
                meta.insert("category".to_string(), format!("cat_{}", i % 5));
                meta
            },
            tags: vec![
                format!("tag_{}", i % 10),
                "benchmark".to_string(),
                "performance".to_string(),
            ],
            created_at: Utc::now(),
            updated_at: Utc::now(),
            nested_data: NestedData {
                values: (0..20).map(|x| x as f64 * 0.5).collect(),
                flags: {
                    let mut flags = HashMap::new();
                    flags.insert("active".to_string(), i % 2 == 0);
                    flags.insert("verified".to_string(), i % 3 == 0);
                    flags.insert("featured".to_string(), i % 5 == 0);
                    flags
                },
                complex_structure: ComplexStructure {
                    matrix: vec![
                        vec![1, 2, 3, 4, 5],
                        vec![6, 7, 8, 9, 10],
                        vec![11, 12, 13, 14, 15],
                    ],
                    operations: (0..5).map(|j| MockOperation {
                        id: Uuid::new_v4(),
                        operation_type: format!("op_type_{}", j),
                        timestamp: Utc::now(),
                        user_id: format!("user_{}", j),
                        payload: serde_json::json!({
                            "operation_id": j,
                            "data": format!("payload_data_{}", j),
                            "metadata": {
                                "version": 1,
                                "source": "benchmark"
                            }
                        }),
                    }).collect(),
                    references: (0..10).map(|_| Uuid::new_v4()).collect(),
                },
            },
            large_text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(20),
        };

        data.push(item);
    }

    data
}

/// Generate CRDT data for realistic benchmarks
fn generate_crdt_operations(count: usize) -> Vec<CRDTOperation> {
    let mut operations = Vec::with_capacity(count);

    for i in 0..count {
        let operation = CRDTOperation {
            id: format!("op_{}", i),
            operation_type: match i % 4 {
                0 => OperationType::SetText {
                    field: format!("field_{}", i % 10),
                    value: TemplateValue::Text {
                        value: format!("text_value_{}", i),
                        timestamp: Utc::now(),
                        user_id: format!("user_{}", i % 5),
                    },
                },
                1 => OperationType::SetMetadata {
                    key: format!("meta_key_{}", i),
                    value: format!("meta_value_{}", i),
                },
                2 => OperationType::AddReference {
                    field: format!("ref_field_{}", i % 7),
                    target_codex: Uuid::new_v4(),
                    reference_type: crate::crdt::ReferenceType::CrossReference,
                },
                3 => OperationType::RemoveReference {
                    field: format!("ref_field_{}", i % 7),
                    target_codex: Uuid::new_v4(),
                },
                _ => unreachable!(),
            },
            timestamp: Utc::now(),
            user_id: format!("user_{}", i % 5),
            vector_clock: VectorClock::new(),
        };

        operations.push(operation);
    }

    operations
}

/// Benchmark JSON serialization
fn bench_json_serialization(c: &mut Criterion) {
    let mut group = c.benchmark_group("json_serialization");

    for size in [10, 100, 1000, 5000].iter() {
        let data = generate_benchmark_data(*size);
        let data_size = std::mem::size_of_val(&data);

        group.throughput(Throughput::Bytes(data_size as u64));
        group.bench_with_input(
            BenchmarkId::new("serialize", size),
            &data,
            |b, data| {
                b.iter_batched(
                    || data.clone(),
                    |data| serde_json::to_vec(&data).unwrap(),
                    BatchSize::SmallInput,
                )
            },
        );

        let serialized = serde_json::to_vec(&data).unwrap();
        group.bench_with_input(
            BenchmarkId::new("deserialize", size),
            &serialized,
            |b, serialized| {
                b.iter_batched(
                    || serialized.clone(),
                    |serialized| serde_json::from_slice::<Vec<BenchmarkData>>(&serialized).unwrap(),
                    BatchSize::SmallInput,
                )
            },
        );
    }

    group.finish();
}

/// Benchmark MessagePack serialization
fn bench_messagepack_serialization(c: &mut Criterion) {
    let mut group = c.benchmark_group("messagepack_serialization");

    for size in [10, 100, 1000, 5000].iter() {
        let data = generate_benchmark_data(*size);
        let data_size = std::mem::size_of_val(&data);

        group.throughput(Throughput::Bytes(data_size as u64));
        group.bench_with_input(
            BenchmarkId::new("serialize", size),
            &data,
            |b, data| {
                b.iter_batched(
                    || data.clone(),
                    |data| rmp_serde::to_vec(&data).unwrap(),
                    BatchSize::SmallInput,
                )
            },
        );

        let serialized = rmp_serde::to_vec(&data).unwrap();
        group.bench_with_input(
            BenchmarkId::new("deserialize", size),
            &serialized,
            |b, serialized| {
                b.iter_batched(
                    || serialized.clone(),
                    |serialized| rmp_serde::from_slice::<Vec<BenchmarkData>>(&serialized).unwrap(),
                    BatchSize::SmallInput,
                )
            },
        );
    }

    group.finish();
}

/// Benchmark Bincode serialization
fn bench_bincode_serialization(c: &mut Criterion) {
    let mut group = c.benchmark_group("bincode_serialization");

    for size in [10, 100, 1000, 5000].iter() {
        let data = generate_benchmark_data(*size);
        let data_size = std::mem::size_of_val(&data);

        group.throughput(Throughput::Bytes(data_size as u64));
        group.bench_with_input(
            BenchmarkId::new("serialize", size),
            &data,
            |b, data| {
                b.iter_batched(
                    || data.clone(),
                    |data| bincode::serialize(&data).unwrap(),
                    BatchSize::SmallInput,
                )
            },
        );

        let serialized = bincode::serialize(&data).unwrap();
        group.bench_with_input(
            BenchmarkId::new("deserialize", size),
            &serialized,
            |b, serialized| {
                b.iter_batched(
                    || serialized.clone(),
                    |serialized| bincode::deserialize::<Vec<BenchmarkData>>(&serialized).unwrap(),
                    BatchSize::SmallInput,
                )
            },
        );
    }

    group.finish();
}

/// Benchmark compression ratios
fn bench_compression_ratios(c: &mut Criterion) {
    let mut group = c.benchmark_group("compression_analysis");
    group.measurement_time(Duration::from_secs(10));

    for size in [100, 1000, 5000].iter() {
        let data = generate_benchmark_data(*size);

        group.bench_with_input(
            BenchmarkId::new("json_size", size),
            &data,
            |b, data| {
                b.iter(|| {
                    let serialized = serde_json::to_vec(data).unwrap();
                    serialized.len()
                })
            },
        );

        group.bench_with_input(
            BenchmarkId::new("messagepack_size", size),
            &data,
            |b, data| {
                b.iter(|| {
                    let serialized = rmp_serde::to_vec(data).unwrap();
                    serialized.len()
                })
            },
        );

        group.bench_with_input(
            BenchmarkId::new("bincode_size", size),
            &data,
            |b, data| {
                b.iter(|| {
                    let serialized = bincode::serialize(data).unwrap();
                    serialized.len()
                })
            },
        );

        // Print actual size comparison
        let json_size = serde_json::to_vec(&data).unwrap().len();
        let msgpack_size = rmp_serde::to_vec(&data).unwrap().len();
        let bincode_size = bincode::serialize(&data).unwrap().len();

        println!("Size comparison for {} items:", size);
        println!("  JSON: {} bytes", json_size);
        println!("  MessagePack: {} bytes ({:.1}% of JSON)", msgpack_size, (msgpack_size as f64 / json_size as f64) * 100.0);
        println!("  Bincode: {} bytes ({:.1}% of JSON)", bincode_size, (bincode_size as f64 / json_size as f64) * 100.0);
    }

    group.finish();
}

/// Benchmark CRDT operations serialization
fn bench_crdt_operations_serialization(c: &mut Criterion) {
    let mut group = c.benchmark_group("crdt_operations_serialization");

    for size in [50, 500, 2000].iter() {
        let operations = generate_crdt_operations(*size);
        let data_size = std::mem::size_of_val(&operations);

        group.throughput(Throughput::Bytes(data_size as u64));

        // JSON serialization of CRDT operations
        group.bench_with_input(
            BenchmarkId::new("json_serialize", size),
            &operations,
            |b, operations| {
                b.iter_batched(
                    || operations.clone(),
                    |operations| serde_json::to_vec(&operations).unwrap(),
                    BatchSize::SmallInput,
                )
            },
        );

        // MessagePack serialization of CRDT operations
        group.bench_with_input(
            BenchmarkId::new("messagepack_serialize", size),
            &operations,
            |b, operations| {
                b.iter_batched(
                    || operations.clone(),
                    |operations| rmp_serde::to_vec(&operations).unwrap(),
                    BatchSize::SmallInput,
                )
            },
        );

        // Bincode serialization of CRDT operations
        group.bench_with_input(
            BenchmarkId::new("bincode_serialize", size),
            &operations,
            |b, operations| {
                b.iter_batched(
                    || operations.clone(),
                    |operations| bincode::serialize(&operations).unwrap(),
                    BatchSize::SmallInput,
                )
            },
        );

        // Deserialization benchmarks
        let json_data = serde_json::to_vec(&operations).unwrap();
        let msgpack_data = rmp_serde::to_vec(&operations).unwrap();
        let bincode_data = bincode::serialize(&operations).unwrap();

        group.bench_with_input(
            BenchmarkId::new("json_deserialize", size),
            &json_data,
            |b, data| {
                b.iter_batched(
                    || data.clone(),
                    |data| serde_json::from_slice::<Vec<CRDTOperation>>(&data).unwrap(),
                    BatchSize::SmallInput,
                )
            },
        );

        group.bench_with_input(
            BenchmarkId::new("messagepack_deserialize", size),
            &msgpack_data,
            |b, data| {
                b.iter_batched(
                    || data.clone(),
                    |data| rmp_serde::from_slice::<Vec<CRDTOperation>>(&data).unwrap(),
                    BatchSize::SmallInput,
                )
            },
        );

        group.bench_with_input(
            BenchmarkId::new("bincode_deserialize", size),
            &bincode_data,
            |b, data| {
                b.iter_batched(
                    || data.clone(),
                    |data| bincode::deserialize::<Vec<CRDTOperation>>(&data).unwrap(),
                    BatchSize::SmallInput,
                )
            },
        );

        // Size analysis for CRDT operations
        println!("CRDT operations size comparison for {} operations:", size);
        println!("  JSON: {} bytes", json_data.len());
        println!("  MessagePack: {} bytes ({:.1}% of JSON)", msgpack_data.len(), (msgpack_data.len() as f64 / json_data.len() as f64) * 100.0);
        println!("  Bincode: {} bytes ({:.1}% of JSON)", bincode_data.len(), (bincode_data.len() as f64 / json_data.len() as f64) * 100.0);
    }

    group.finish();
}

/// Benchmark task data serialization (real-world scenario)
fn bench_task_serialization(c: &mut Criterion) {
    let mut group = c.benchmark_group("task_serialization");

    // Generate realistic task data
    let tasks: Vec<TaskSummary> = (0..1000).map(|i| TaskSummary {
        id: Uuid::new_v4().to_string(),
        title: format!("Task {}: Complete feature implementation", i),
        status: match i % 4 {
            0 => "todo".to_string(),
            1 => "in_progress".to_string(),
            2 => "completed".to_string(),
            3 => "blocked".to_string(),
            _ => unreachable!(),
        },
        priority: match i % 3 {
            0 => "low".to_string(),
            1 => "medium".to_string(),
            2 => "high".to_string(),
            _ => unreachable!(),
        },
        created_at: Utc::now(),
        updated_at: Utc::now(),
        parent_id: if i % 5 == 0 { Some(format!("parent_{}", i / 5)) } else { None },
        child_count: i as i64 % 10,
        tags: if i % 3 == 0 {
            Some(vec!["feature".to_string(), "urgent".to_string()])
        } else {
            None
        },
    }).collect();

    let data_size = std::mem::size_of_val(&tasks);
    group.throughput(Throughput::Bytes(data_size as u64));

    // Serialize tasks with different formats
    group.bench_function("tasks_json_serialize", |b| {
        b.iter_batched(
            || tasks.clone(),
            |tasks| serde_json::to_vec(&tasks).unwrap(),
            BatchSize::SmallInput,
        )
    });

    group.bench_function("tasks_messagepack_serialize", |b| {
        b.iter_batched(
            || tasks.clone(),
            |tasks| rmp_serde::to_vec(&tasks).unwrap(),
            BatchSize::SmallInput,
        )
    });

    group.bench_function("tasks_bincode_serialize", |b| {
        b.iter_batched(
            || tasks.clone(),
            |tasks| bincode::serialize(&tasks).unwrap(),
            BatchSize::SmallInput,
        )
    });

    // Deserialize tasks
    let json_tasks = serde_json::to_vec(&tasks).unwrap();
    let msgpack_tasks = rmp_serde::to_vec(&tasks).unwrap();
    let bincode_tasks = bincode::serialize(&tasks).unwrap();

    group.bench_function("tasks_json_deserialize", |b| {
        b.iter_batched(
            || json_tasks.clone(),
            |data| serde_json::from_slice::<Vec<TaskSummary>>(&data).unwrap(),
            BatchSize::SmallInput,
        )
    });

    group.bench_function("tasks_messagepack_deserialize", |b| {
        b.iter_batched(
            || msgpack_tasks.clone(),
            |data| rmp_serde::from_slice::<Vec<TaskSummary>>(&data).unwrap(),
            BatchSize::SmallInput,
        )
    });

    group.bench_function("tasks_bincode_deserialize", |b| {
        b.iter_batched(
            || bincode_tasks.clone(),
            |data| bincode::deserialize::<Vec<TaskSummary>>(&data).unwrap(),
            BatchSize::SmallInput,
        )
    });

    // Print size comparison for tasks
    println!("Task data size comparison for 1000 tasks:");
    println!("  JSON: {} bytes", json_tasks.len());
    println!("  MessagePack: {} bytes ({:.1}% of JSON)", msgpack_tasks.len(), (msgpack_tasks.len() as f64 / json_tasks.len() as f64) * 100.0);
    println!("  Bincode: {} bytes ({:.1}% of JSON)", bincode_tasks.len(), (bincode_tasks.len() as f64 / json_tasks.len() as f64) * 100.0);

    group.finish();
}

/// Benchmark memory impact of different serialization formats
fn bench_memory_impact(c: &mut Criterion) {
    let mut group = c.benchmark_group("memory_impact");
    group.measurement_time(Duration::from_secs(15));

    let large_dataset = generate_benchmark_data(10000);

    group.bench_function("memory_json_roundtrip", |b| {
        b.iter(|| {
            let serialized = serde_json::to_vec(&large_dataset).unwrap();
            let _deserialized: Vec<BenchmarkData> = serde_json::from_slice(&serialized).unwrap();
            serialized.len()
        })
    });

    group.bench_function("memory_messagepack_roundtrip", |b| {
        b.iter(|| {
            let serialized = rmp_serde::to_vec(&large_dataset).unwrap();
            let _deserialized: Vec<BenchmarkData> = rmp_serde::from_slice(&serialized).unwrap();
            serialized.len()
        })
    });

    group.bench_function("memory_bincode_roundtrip", |b| {
        b.iter(|| {
            let serialized = bincode::serialize(&large_dataset).unwrap();
            let _deserialized: Vec<BenchmarkData> = bincode::deserialize(&serialized).unwrap();
            serialized.len()
        })
    });

    group.finish();
}

/// Benchmark streaming serialization for large datasets
fn bench_streaming_serialization(c: &mut Criterion) {
    let mut group = c.benchmark_group("streaming_serialization");
    group.measurement_time(Duration::from_secs(10));

    // Create a very large dataset that would benefit from streaming
    let huge_dataset = generate_benchmark_data(20000);

    // Note: For streaming, we'd typically use different APIs
    // For this benchmark, we'll simulate the effect with chunked processing

    group.bench_function("chunked_json_processing", |b| {
        b.iter(|| {
            let chunk_size = 1000;
            let mut total_size = 0;

            for chunk in huge_dataset.chunks(chunk_size) {
                let serialized = serde_json::to_vec(&chunk).unwrap();
                total_size += serialized.len();
            }

            total_size
        })
    });

    group.bench_function("chunked_messagepack_processing", |b| {
        b.iter(|| {
            let chunk_size = 1000;
            let mut total_size = 0;

            for chunk in huge_dataset.chunks(chunk_size) {
                let serialized = rmp_serde::to_vec(&chunk).unwrap();
                total_size += serialized.len();
            }

            total_size
        })
    });

    group.bench_function("monolithic_json_processing", |b| {
        b.iter(|| {
            let serialized = serde_json::to_vec(&huge_dataset).unwrap();
            serialized.len()
        })
    });

    group.bench_function("monolithic_messagepack_processing", |b| {
        b.iter(|| {
            let serialized = rmp_serde::to_vec(&huge_dataset).unwrap();
            serialized.len()
        })
    });

    group.finish();
}

criterion_group!(
    serialization_benches,
    bench_json_serialization,
    bench_messagepack_serialization,
    bench_bincode_serialization,
    bench_compression_ratios,
    bench_crdt_operations_serialization,
    bench_task_serialization,
    bench_memory_impact,
    bench_streaming_serialization
);

criterion_main!(serialization_benches);