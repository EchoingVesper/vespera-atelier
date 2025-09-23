#!/usr/bin/env rust-script

//! Database Pool Optimization Test
//!
//! This script demonstrates the optimized database connection pool
//! configuration for high-throughput scenarios.

use std::path::PathBuf;
use std::time::Duration;
use vespera_bindery::database::{Database, DatabasePoolConfig};
use vespera_bindery::task_management::TaskInput;
use tokio;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    println!("🔧 Testing Database Pool Optimizations for Vespera Bindery");
    println!("==========================================================");

    // Create optimized pool configuration
    let pool_config = DatabasePoolConfig::builder()
        .max_connections(8)?                                    // Optimized for SQLite
        .min_connections(2)?                                    // Keep connections warm
        .acquire_timeout(Duration::from_secs(3))?               // Fast timeout
        .idle_timeout(Duration::from_secs(300))?                // 5 minutes
        .max_connection_lifetime(Duration::from_secs(3600))?    // 1 hour
        .test_before_acquire(true)
        .build()?;

    println!("✅ Pool Configuration:");
    println!("   Max Connections: {}", pool_config.max_connections);
    println!("   Min Connections: {}", pool_config.min_connections);
    println!("   Acquire Timeout: {:?}", pool_config.acquire_timeout);
    println!("   Idle Timeout: {:?}", pool_config.idle_timeout);
    println!("   Max Lifetime: {:?}", pool_config.max_connection_lifetime);
    println!("   Test Before Acquire: {}", pool_config.test_before_acquire);

    // Create test database
    let test_db_path = std::env::temp_dir().join("bindery_pool_test.db");
    if test_db_path.exists() {
        std::fs::remove_file(&test_db_path)?;
    }

    println!("\n🗃️  Creating optimized database: {:?}", test_db_path);
    let database = Database::new_with_config(&test_db_path, pool_config).await?;

    // Test pool health
    println!("\n🔍 Testing Pool Health:");
    let is_healthy = database.is_pool_healthy().await;
    println!("   Pool Healthy: {}", is_healthy);

    if !is_healthy {
        println!("   🔧 Attempting pool recovery...");
        database.recover_pool().await?;
        let is_healthy_after = database.is_pool_healthy().await;
        println!("   Pool Healthy After Recovery: {}", is_healthy_after);
    }

    // Get initial metrics
    println!("\n📊 Initial Pool Metrics:");
    let initial_metrics = database.get_pool_metrics().await;
    println!("   Active Connections: {}", initial_metrics.active_connections);
    println!("   Total Connections: {}", initial_metrics.total_connections);
    println!("   Pool Utilization: {:.1}%", initial_metrics.pool_utilization);
    println!("   Average Acquisition Time: {:.2}ms", initial_metrics.average_acquisition_time_ms);

    // Perform high-throughput test
    println!("\n🚀 High-Throughput Test: Creating 50 tasks concurrently");
    let start_time = std::time::Instant::now();

    let mut handles = Vec::new();
    for i in 0..50 {
        let db = &database;
        let task_input = TaskInput {
            title: format!("Performance Test Task {}", i),
            description: Some(format!("Testing database performance under load - task {}", i)),
            priority: Some("normal".to_string()),
            project_id: Some("perf-test".to_string()),
            parent_id: None,
            tags: vec!["performance".to_string(), "test".to_string()],
            labels: serde_json::json!({"test_batch": i / 10}),
            subtasks: vec![],
        };

        let handle = tokio::spawn(async move {
            db.create_task(&task_input).await
        });
        handles.push(handle);
    }

    // Wait for all tasks to complete
    let mut success_count = 0;
    let mut error_count = 0;

    for handle in handles {
        match handle.await {
            Ok(Ok(_)) => success_count += 1,
            Ok(Err(_)) => error_count += 1,
            Err(_) => error_count += 1,
        }
    }

    let duration = start_time.elapsed();
    println!("   ✅ Test completed in: {:?}", duration);
    println!("   ✅ Successful tasks: {}", success_count);
    println!("   ❌ Failed tasks: {}", error_count);
    println!("   📈 Throughput: {:.1} tasks/second", success_count as f64 / duration.as_secs_f64());

    // Get final metrics
    println!("\n📊 Final Pool Metrics:");
    let final_metrics = database.get_pool_metrics().await;
    println!("   Active Connections: {}", final_metrics.active_connections);
    println!("   Total Acquired: {}", final_metrics.total_acquired);
    println!("   Total Failures: {}", final_metrics.total_acquisition_failures);
    println!("   Pool Utilization: {:.1}%", final_metrics.pool_utilization);
    println!("   Average Acquisition Time: {:.2}ms", final_metrics.average_acquisition_time_ms);

    let success_rate = if final_metrics.total_acquired > 0 {
        ((final_metrics.total_acquired - final_metrics.total_acquisition_failures) as f64
            / final_metrics.total_acquired as f64) * 100.0
    } else {
        0.0
    };
    println!("   Success Rate: {:.1}%", success_rate);

    // Get comprehensive health information
    println!("\n🏥 Pool Health Information:");
    let health_info = database.get_pool_health_info().await;
    println!("   Status: {:?}", health_info.status);
    println!("   Total Queries: {}", health_info.total_queries);
    println!("   Slow Queries: {}", health_info.slow_query_count);
    println!("   Deadlocks: {}", health_info.deadlock_count);

    if !health_info.recommendations.is_empty() {
        println!("   💡 Recommendations:");
        for rec in &health_info.recommendations {
            println!("     - {}", rec);
        }
    }

    // Get query performance metrics
    println!("\n⚡ Query Performance Metrics:");
    let perf_metrics = database.get_query_performance_metrics().await;
    println!("   Total Queries: {}", perf_metrics.total_queries);
    println!("   Average Duration: {:.2}ms", perf_metrics.avg_query_duration_ms);
    println!("   Slow Queries: {}", perf_metrics.queries_over_threshold);
    println!("   Cache Hit Rate: {:.1}%", perf_metrics.cache_hit_rate);
    println!("   Deadlocks Detected: {}", perf_metrics.deadlocks_detected);

    // Test database maintenance
    println!("\n🔧 Testing Database Maintenance:");
    let maintenance_report = database.perform_maintenance().await?;
    println!("   VACUUM Performed: {}", maintenance_report.vacuum_performed);
    println!("   ANALYZE Performed: {}", maintenance_report.analyze_performed);
    println!("   Indices Optimized: {}", maintenance_report.indices_optimized);
    println!("   Maintenance Duration: {}ms", maintenance_report.maintenance_duration_ms);

    if !maintenance_report.errors.is_empty() {
        println!("   ⚠️  Maintenance Errors:");
        for error in &maintenance_report.errors {
            println!("     - {}", error);
        }
    }

    // Test task retrieval performance
    println!("\n📋 Testing Task Retrieval Performance:");
    let retrieval_start = std::time::Instant::now();
    let tasks = database.list_tasks(None, None).await?;
    let retrieval_duration = retrieval_start.elapsed();

    println!("   Retrieved {} tasks in {:?}", tasks.len(), retrieval_duration);
    if !tasks.is_empty() {
        println!("   Average retrieval time per task: {:?}", retrieval_duration / tasks.len() as u32);
    }

    // Cleanup
    database.close().await;
    println!("\n✅ Pool optimization test completed successfully!");
    println!("\n📝 Summary:");
    println!("   - Pool configuration optimized for SQLite with WAL mode");
    println!("   - Reduced connection count to match SQLite's threading model");
    println!("   - Enhanced SQLite pragmas for better performance");
    println!("   - Comprehensive health monitoring and recovery");
    println!("   - Detailed metrics collection for production monitoring");

    // Clean up test database
    if test_db_path.exists() {
        std::fs::remove_file(&test_db_path)?;
    }

    Ok(())
}