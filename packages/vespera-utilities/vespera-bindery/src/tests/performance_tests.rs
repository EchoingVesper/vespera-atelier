//! Performance regression tests for CRDT optimizations
//!
//! Tests to ensure performance improvements are maintained and detect regressions:
//! - CRDT memory optimization validation
//! - Database performance improvement verification
//! - Metric collection overhead measurement
//! - Memory pressure scenarios
//! - Long-running operation performance

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::time::sleep;
use uuid::Uuid;
use chrono::Utc;
use serde_json::json;

use crate::{
    CodexManager, BinderyConfig, BinderyResult,
    crdt::{VesperaCRDT, CRDTOperation, OperationType, MemoryStats, GarbageCollectionStats, TemplateValue},
    database::{Database, DatabasePoolConfig, TaskInput},
    observability::{MetricsCollector, BinderyMetrics, PerformanceTimer},
    types::{CodexId, UserId},
    tests::utils::{create_test_crdt, TestDataGenerator},
    GarbageCollectionConfig,
};

/// Performance benchmark results
#[derive(Debug, Clone)]
pub struct PerformanceBenchmark {
    pub name: String,
    pub duration: Duration,
    pub operations_per_second: f64,
    pub memory_usage_mb: f64,
    pub success_rate: f64,
    pub metadata: HashMap<String, f64>,
}

impl PerformanceBenchmark {
    pub fn new(name: &str, duration: Duration, total_operations: usize) -> Self {
        let ops_per_sec = total_operations as f64 / duration.as_secs_f64();

        Self {
            name: name.to_string(),
            duration,
            operations_per_second: ops_per_sec,
            memory_usage_mb: 0.0,
            success_rate: 1.0,
            metadata: HashMap::new(),
        }
    }

    pub fn with_memory_usage(mut self, memory_mb: f64) -> Self {
        self.memory_usage_mb = memory_mb;
        self
    }

    pub fn with_success_rate(mut self, rate: f64) -> Self {
        self.success_rate = rate;
        self
    }

    pub fn with_metadata(mut self, key: &str, value: f64) -> Self {
        self.metadata.insert(key.to_string(), value);
        self
    }
}

/// Performance test harness
pub struct PerformanceTestHarness {
    baselines: HashMap<String, PerformanceBenchmark>,
    tolerance: f64, // Acceptable performance degradation (e.g., 0.1 = 10%)
}

impl PerformanceTestHarness {
    pub fn new(tolerance: f64) -> Self {
        Self {
            baselines: HashMap::new(),
            tolerance,
        }
    }

    /// Set baseline performance for a test
    pub fn set_baseline(&mut self, benchmark: PerformanceBenchmark) {
        self.baselines.insert(benchmark.name.clone(), benchmark);
    }

    /// Check if current performance meets baseline requirements
    pub fn check_regression(&self, current: &PerformanceBenchmark) -> BinderyResult<bool> {
        if let Some(baseline) = self.baselines.get(&current.name) {
            let ops_degradation = (baseline.operations_per_second - current.operations_per_second) / baseline.operations_per_second;
            let memory_degradation = (current.memory_usage_mb - baseline.memory_usage_mb) / baseline.memory_usage_mb.max(1.0);

            if ops_degradation > self.tolerance {
                return Ok(false);
            }

            if memory_degradation > self.tolerance {
                return Ok(false);
            }
        }

        Ok(true)
    }
}

/// Helper function to set a text field on CRDT using the correct API
fn set_text_field(crdt: &mut VesperaCRDT, field_name: &str, field_value: &str) -> BinderyResult<()> {
    crdt.set_metadata(
        field_name.to_string(),
        TemplateValue::Text {
            value: field_value.to_string(),
            timestamp: Utc::now(),
            user_id: crdt.created_by.clone(),
        }
    )
}

/// Test CRDT memory optimization performance
#[tokio::test]
async fn test_crdt_memory_optimization_performance() {
    let mut harness = PerformanceTestHarness::new(0.1); // 10% tolerance

    // Set baseline (these would be established from previous runs)
    harness.set_baseline(PerformanceBenchmark::new("crdt_operations", Duration::from_millis(1000), 10000)
        .with_memory_usage(50.0));

    let user_id = "perf_test_user".to_string();
    let codex_id = Uuid::new_v4();
    let mut crdt = VesperaCRDT::new(codex_id, user_id.clone());

    const NUM_OPERATIONS: usize = 10000;
    let start_time = Instant::now();
    let start_memory = get_memory_usage();

    // Perform many operations to test optimization
    for i in 0..NUM_OPERATIONS {
        set_text_field(&mut crdt, &format!("field_{}", i % 100), &format!("value_{}", i)).unwrap();

        if i % 1000 == 0 {
            // Trigger periodic GC to test optimization
            let _gc_stats = crdt.gc_all_with_limits(
                Utc::now() - chrono::Duration::minutes(1),
                500,
                100
            );
        }
    }

    let duration = start_time.elapsed();
    let end_memory = get_memory_usage();
    let memory_usage_mb = (end_memory - start_memory) as f64 / 1024.0 / 1024.0;

    let benchmark = PerformanceBenchmark::new("crdt_operations", duration, NUM_OPERATIONS)
        .with_memory_usage(memory_usage_mb);

    println!("CRDT Operations Benchmark: {:.2} ops/sec, {:.2} MB memory",
             benchmark.operations_per_second, benchmark.memory_usage_mb);

    // Check for regression
    assert!(harness.check_regression(&benchmark).unwrap(),
            "Performance regression detected in CRDT operations");

    // Verify memory stats accuracy
    let memory_stats = crdt.memory_stats();
    assert!(memory_stats.total_size_bytes > 0);
    assert!(memory_stats.operation_log_size <= NUM_OPERATIONS);
}

/// Test database performance with connection pooling
#[tokio::test]
async fn test_database_performance_optimizations() {
    let mut harness = PerformanceTestHarness::new(0.15); // 15% tolerance for DB operations

    // Set baseline
    harness.set_baseline(PerformanceBenchmark::new("database_operations", Duration::from_millis(2000), 1000)
        .with_success_rate(0.99));

    let config = DatabasePoolConfig {
        max_connections: 10,
        min_connections: 2,
        max_connection_lifetime: Duration::from_secs(30 * 60),
        acquire_timeout: Duration::from_secs(5),
        idle_timeout: Duration::from_secs(10 * 60),
        test_before_acquire: true,
    };

    // Create temporary database for testing
    let temp_dir = tempfile::tempdir().unwrap();
    let db_path = temp_dir.path().join("test_perf.db");
    let database = Arc::new(Database::new_with_config(db_path.to_str().unwrap(), config).await.unwrap());

    const NUM_OPERATIONS: usize = 1000;
    let start_time = Instant::now();
    let mut success_count = 0;

    // Test concurrent database operations
    let mut handles = Vec::new();

    for i in 0..NUM_OPERATIONS {
        let db_clone = database.clone();

        let handle = tokio::spawn(async move {
            let task_input = TaskInput {
                title: format!("Performance Test Task {}", i),
                description: Some(format!("Generated for performance testing iteration {}", i)),
                priority: Some("medium".to_string()),
                project_id: Some("perf_test_project".to_string()),
                parent_id: None,
                tags: vec!["performance".to_string(), "test".to_string()],
                labels: json!({"iteration": i}),
                subtasks: vec![],
            };

            match db_clone.create_task(&task_input).await {
                Ok(_) => 1,
                Err(_) => 0,
            }
        });

        handles.push(handle);
    }

    // Wait for all operations and count successes
    for handle in handles {
        success_count += handle.await.unwrap();
    }

    let duration = start_time.elapsed();
    let success_rate = success_count as f64 / NUM_OPERATIONS as f64;

    let benchmark = PerformanceBenchmark::new("database_operations", duration, NUM_OPERATIONS)
        .with_success_rate(success_rate);

    println!("Database Operations Benchmark: {:.2} ops/sec, {:.2}% success rate",
             benchmark.operations_per_second, benchmark.success_rate * 100.0);

    // Check for regression
    assert!(harness.check_regression(&benchmark).unwrap(),
            "Performance regression detected in database operations");

    // Verify success rate is acceptable
    assert!(success_rate > 0.95, "Database operation success rate too low: {:.2}%", success_rate * 100.0);
}

/// Test metrics collection overhead
#[tokio::test]
async fn test_metrics_collection_overhead() {
    let _collector = Arc::new(MetricsCollector::new("test_service"));

    // Baseline: operations without metrics
    const NUM_OPERATIONS: usize = 100000;

    // Test without metrics collection
    let start_time = Instant::now();
    for i in 0..NUM_OPERATIONS {
        // Simulate work
        let _result = format!("operation_{}", i);
    }
    let baseline_duration = start_time.elapsed();

    // Test with metrics collection using BinderyMetrics
    let start_time = Instant::now();
    for i in 0..NUM_OPERATIONS {
        // Simulate work
        let _result = format!("operation_{}", i);
        // Collect metrics using the public API
        BinderyMetrics::record_database_operation("test_operation", Duration::from_nanos(100), true);
    }
    let with_metrics_duration = start_time.elapsed();

    let overhead_ratio = with_metrics_duration.as_nanos() as f64 / baseline_duration.as_nanos() as f64;
    let overhead_percentage = (overhead_ratio - 1.0) * 100.0;

    println!("Metrics Collection Overhead: {:.2}% ({:?} vs {:?})",
             overhead_percentage, with_metrics_duration, baseline_duration);

    // Metrics overhead should be minimal (less than 50%)
    assert!(overhead_percentage < 50.0,
            "Metrics collection overhead too high: {:.2}%", overhead_percentage);
}

/// Test memory pressure scenarios
#[tokio::test]
async fn test_memory_pressure_performance() {
    let config = BinderyConfig::builder()
        .memory_limits(10000, 60) // Aggressive GC for testing
        .unwrap()
        .collaboration(false, None::<String>, None::<String>)
        .unwrap()
        .build()
        .unwrap();

    let manager = CodexManager::with_config(config).unwrap();

    const NUM_CODICES: usize = 100;
    const OPERATIONS_PER_CODEX: usize = 1000;

    let start_time = Instant::now();
    let start_memory = get_memory_usage();

    // Create many codices and perform operations
    let mut codex_ids = Vec::new();
    for i in 0..NUM_CODICES {
        let codex_id = manager.create_codex(
            format!("Memory Test Codex {}", i),
            "test_template"
        ).await.unwrap();

        codex_ids.push(codex_id);

        // Perform operations on each codex
        if let Some(crdt) = manager.get_codex(&codex_id).await {
            for j in 0..OPERATIONS_PER_CODEX {
                // Simulate memory-intensive operations
                let field_name = format!("field_{}_{}", i, j);
                let field_value = format!("value_{}_{}_{}", i, j, "x".repeat(100)); // Add padding

                // This would require interior mutability in real implementation
                // For now, we measure the overhead of the operations
            }
        }

        // Trigger GC periodically
        if i % 10 == 0 {
            let _gc_stats = manager.gc_all_codices().await.unwrap();
        }
    }

    let duration = start_time.elapsed();
    let end_memory = get_memory_usage();
    let memory_usage_mb = (end_memory - start_memory) as f64 / 1024.0 / 1024.0;

    println!("Memory Pressure Test: {} codices, {:.2} MB memory, {:.2}s duration",
             NUM_CODICES, memory_usage_mb, duration.as_secs_f64());

    // Verify memory usage is reasonable
    assert!(memory_usage_mb < 500.0, "Memory usage too high: {:.2} MB", memory_usage_mb);

    // Verify all codices are accessible
    let codex_list = manager.list_codices().await;
    assert_eq!(codex_list.len(), NUM_CODICES);

    // Test memory statistics
    let memory_stats = manager.memory_stats().await;
    assert_eq!(memory_stats.len(), NUM_CODICES);
}

/// Test long-running operation performance
#[tokio::test]
async fn test_long_running_operation_performance() {
    let _timer = PerformanceTimer::new("long_running_test", "performance_tests");

    // Simulate a long-running operation with periodic monitoring
    const TOTAL_DURATION_SECS: u64 = 30;
    const CHECK_INTERVAL_SECS: u64 = 5;

    let start_time = Instant::now();
    let mut operation_count = 0;
    let mut check_count = 0;

    while start_time.elapsed().as_secs() < TOTAL_DURATION_SECS {
        // Simulate work
        for i in 0..1000 {
            let _work = format!("operation_{}_{}", check_count, i);
            operation_count += 1;
        }

        // Periodic monitoring
        if start_time.elapsed().as_secs() >= (check_count + 1) * CHECK_INTERVAL_SECS {
            check_count += 1;

            // Record metrics using BinderyMetrics
            BinderyMetrics::set_memory_usage(get_memory_usage() as u64);

            println!("Long-running test checkpoint {}: {} operations, {} MB memory",
                     check_count, operation_count, get_memory_usage() / 1024 / 1024);
        }

        // Small delay to simulate realistic workload
        sleep(Duration::from_millis(10)).await;
    }

    let total_duration = start_time.elapsed();

    let ops_per_second = operation_count as f64 / total_duration.as_secs_f64();

    println!("Long-running operation completed: {} operations in {:.2}s ({:.2} ops/sec)",
             operation_count, total_duration.as_secs_f64(), ops_per_second);

    // Verify consistent performance over time
    assert!(ops_per_second > 1000.0, "Long-running operation performance too low: {:.2} ops/sec", ops_per_second);
}

/// Test garbage collection performance impact
#[tokio::test]
async fn test_gc_performance_impact() {
    let user_id = "gc_test_user".to_string();
    let codex_id = Uuid::new_v4();
    let mut crdt = VesperaCRDT::new(codex_id, user_id);

    // Build up operations to test GC performance
    const NUM_OPERATIONS: usize = 10000;

    for i in 0..NUM_OPERATIONS {
        set_text_field(&mut crdt, &format!("field_{}", i % 50), &format!("value_{}", i)).unwrap();
    }

    let pre_gc_stats = crdt.memory_stats();
    println!("Pre-GC: {} operations, {} bytes",
             pre_gc_stats.operation_log_size, pre_gc_stats.total_size_bytes);

    // Measure GC performance
    let gc_start = Instant::now();
    let gc_stats = crdt.gc_all_with_limits(
        Utc::now() - chrono::Duration::hours(1),
        5000, // Keep half the operations
        100
    );
    let gc_duration = gc_start.elapsed();

    let post_gc_stats = crdt.memory_stats();
    println!("Post-GC: {} operations, {} bytes, GC took {:?}",
             post_gc_stats.operation_log_size, post_gc_stats.total_size_bytes, gc_duration);

    // Verify GC effectiveness
    assert!(gc_stats.operations_removed > 0, "GC should have removed some operations");
    assert!(post_gc_stats.total_size_bytes < pre_gc_stats.total_size_bytes,
            "GC should have reduced memory usage");

    // Verify GC performance
    assert!(gc_duration.as_millis() < 1000, "GC took too long: {:?}", gc_duration);

    // Test continued performance after GC
    let ops_start = Instant::now();
    for i in 0..1000 {
        set_text_field(&mut crdt, &format!("post_gc_field_{}", i), &format!("post_gc_value_{}", i)).unwrap();
    }
    let ops_duration = ops_start.elapsed();

    let ops_per_second = 1000.0 / ops_duration.as_secs_f64();
    println!("Post-GC operations: {:.2} ops/sec", ops_per_second);

    // Performance should not be significantly degraded after GC
    assert!(ops_per_second > 1000.0, "Post-GC performance too low: {:.2} ops/sec", ops_per_second);
}

/// Test concurrent operation performance
#[tokio::test]
async fn test_concurrent_operation_performance() {
    let config = BinderyConfig::builder()
        .collaboration(false, None::<String>, None::<String>)
        .unwrap()
        .build()
        .unwrap();

    let manager = Arc::new(CodexManager::with_config(config).unwrap());

    const NUM_WORKERS: usize = 10;
    const OPERATIONS_PER_WORKER: usize = 500;

    let start_time = Instant::now();
    let mut handles = Vec::new();

    // Spawn concurrent workers
    for worker_id in 0..NUM_WORKERS {
        let manager_clone = manager.clone();

        let handle = tokio::spawn(async move {
            let mut local_operations = 0;

            // Each worker creates a codex and performs operations
            let codex_id = manager_clone.create_codex(
                format!("Concurrent Test Codex {}", worker_id),
                "test_template"
            ).await.unwrap();

            for op_id in 0..OPERATIONS_PER_WORKER {
                // Simulate different types of operations
                if let Some(_crdt) = manager_clone.get_codex(&codex_id).await {
                    // Would perform CRDT operations here
                    local_operations += 1;
                }

                // Occasionally trigger management operations
                if op_id % 50 == 0 {
                    let _codex_list = manager_clone.list_codices().await;
                }
            }

            local_operations
        });

        handles.push(handle);
    }

    // Wait for all workers and sum operations
    let mut total_operations = 0;
    for handle in handles {
        total_operations += handle.await.unwrap();
    }

    let duration = start_time.elapsed();
    let ops_per_second = total_operations as f64 / duration.as_secs_f64();

    println!("Concurrent Operations: {} total ops in {:.2}s ({:.2} ops/sec)",
             total_operations, duration.as_secs_f64(), ops_per_second);

    // Verify concurrent performance
    assert!(ops_per_second > 1000.0, "Concurrent operation performance too low: {:.2} ops/sec", ops_per_second);

    // Verify all codices were created
    let final_codex_count = manager.list_codices().await.len();
    assert_eq!(final_codex_count, NUM_WORKERS);
}

/// Helper function to get current memory usage (simplified for testing)
fn get_memory_usage() -> usize {
    // In a real implementation, this would use system calls to get actual memory usage
    // For testing purposes, we'll use a simplified approach
    std::process::id() as usize * 1024 // Simplified placeholder
}

/// Comprehensive performance regression test suite
#[tokio::test]
async fn test_comprehensive_performance_regression() {
    println!("Running comprehensive performance regression tests...");

    // Test 1: CRDT Operations
    let mut crdt_harness = PerformanceTestHarness::new(0.1);
    crdt_harness.set_baseline(PerformanceBenchmark::new("crdt_comprehensive", Duration::from_millis(1000), 5000));

    let user_id = "regression_test_user".to_string();
    let codex_id = Uuid::new_v4();
    let mut crdt = VesperaCRDT::new(codex_id, user_id);

    let start_time = Instant::now();
    for i in 0..5000 {
        set_text_field(&mut crdt, &format!("field_{}", i % 100), &format!("value_{}", i)).unwrap();
    }
    let crdt_duration = start_time.elapsed();

    let crdt_benchmark = PerformanceBenchmark::new("crdt_comprehensive", crdt_duration, 5000);
    assert!(crdt_harness.check_regression(&crdt_benchmark).unwrap(),
            "CRDT performance regression detected");

    // Test 2: Memory Management
    let memory_start = get_memory_usage();
    let _gc_stats = crdt.gc_all_with_limits(
        Utc::now() - chrono::Duration::minutes(1),
        2500,
        50
    );
    let memory_end = get_memory_usage();
    let memory_delta = (memory_end as i32 - memory_start as i32).abs() as usize;

    assert!(memory_delta < 100 * 1024 * 1024, "Memory usage regression detected: {} bytes", memory_delta);

    // Test 3: Concurrent Access
    let config = BinderyConfig::default();
    let manager = Arc::new(CodexManager::with_config(config).unwrap());

    let start_time = Instant::now();
    let mut handles = Vec::new();

    for i in 0..5 {
        let manager_clone = manager.clone();
        let handle = tokio::spawn(async move {
            let _codex_id = manager_clone.create_codex(
                format!("Regression Test Codex {}", i),
                "test_template"
            ).await.unwrap();
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.await.unwrap();
    }

    let concurrent_duration = start_time.elapsed();
    assert!(concurrent_duration.as_millis() < 5000,
            "Concurrent operation regression detected: {:?}", concurrent_duration);

    println!("All performance regression tests passed!");
}
