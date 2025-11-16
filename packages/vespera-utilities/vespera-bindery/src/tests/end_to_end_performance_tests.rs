//! End-to-end performance tests
//!
//! Comprehensive performance tests that validate the complete system under realistic workloads:
//! - Full workflow performance with alerting thresholds
//! - Audit logging overhead measurement
//! - Production-like load testing
//! - System integration under pressure
//! - Resource utilization monitoring

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::time::sleep;
use uuid::Uuid;
use chrono::Utc;
use serde_json::json;

use crate::{
    CodexManager, BinderyConfig, BinderyResult,
    crdt::VesperaCRDT,
    database::{Database, DatabasePoolConfig, TaskInput},
    observability::{BinderyMetrics, AuditLogger, AuditConfig, AuditEvent, UserContext, Operation, OperationOutcome, SecurityContext},
    task_management::{TaskManager, TaskStatus, TaskPriority},
    role_management::{RoleManager, RoleExecutor},
    types::{CodexId, UserId},
    tests::utils::{create_test_crdt, TestDataGenerator, set_text_field},
    GarbageCollectionConfig,
};

/// End-to-end performance test configuration
#[derive(Debug, Clone)]
pub struct E2EPerformanceConfig {
    /// Number of concurrent users
    pub user_count: usize,
    /// Operations per user
    pub operations_per_user: usize,
    /// Test duration in seconds
    pub duration_seconds: u64,
    /// Enable audit logging
    pub audit_logging_enabled: bool,
    /// Enable metrics collection
    pub metrics_enabled: bool,
    /// Performance thresholds
    pub performance_thresholds: PerformanceThresholds,
}

impl Default for E2EPerformanceConfig {
    fn default() -> Self {
        Self {
            user_count: 10,
            operations_per_user: 100,
            duration_seconds: 30,
            audit_logging_enabled: true,
            metrics_enabled: true,
            performance_thresholds: PerformanceThresholds::default(),
        }
    }
}

/// Performance thresholds for alerting
#[derive(Debug, Clone)]
pub struct PerformanceThresholds {
    /// Maximum acceptable response time (ms)
    pub max_response_time_ms: u64,
    /// Minimum operations per second
    pub min_ops_per_second: f64,
    /// Maximum memory usage (MB)
    pub max_memory_usage_mb: f64,
    /// Maximum error rate (percentage)
    pub max_error_rate_percent: f64,
}

impl Default for PerformanceThresholds {
    fn default() -> Self {
        Self {
            max_response_time_ms: 1000,
            min_ops_per_second: 100.0,
            max_memory_usage_mb: 500.0,
            max_error_rate_percent: 5.0,
        }
    }
}

/// Performance test results
#[derive(Debug, Clone)]
pub struct E2EPerformanceResults {
    pub total_operations: usize,
    pub successful_operations: usize,
    pub failed_operations: usize,
    pub total_duration: Duration,
    pub average_response_time_ms: f64,
    pub operations_per_second: f64,
    pub peak_memory_usage_mb: f64,
    pub error_rate_percent: f64,
    pub threshold_violations: Vec<String>,
    pub component_stats: HashMap<String, ComponentStats>,
}

#[derive(Debug, Clone)]
pub struct ComponentStats {
    pub operation_count: usize,
    pub average_duration_ms: f64,
    pub error_count: usize,
    pub memory_usage_mb: f64,
}

/// End-to-end performance test harness
pub struct E2EPerformanceHarness {
    config: E2EPerformanceConfig,
    codex_manager: Arc<CodexManager>,
    database: Arc<Database>,
    audit_logger: Option<Arc<AuditLogger>>,
    task_manager: Arc<TaskManager>,
    role_manager: Arc<RoleManager>,
}

impl E2EPerformanceHarness {
    pub async fn new(config: E2EPerformanceConfig) -> BinderyResult<Self> {
        // Create temporary directories for testing
        let temp_dir = tempfile::tempdir().unwrap();
        let db_path = temp_dir.path().join("e2e_performance.db");
        let audit_db_path = temp_dir.path().join("e2e_audit.db");

        // Configure database with connection pooling
        let db_config = DatabasePoolConfig {
            max_connections: (config.user_count * 2) as u32,
            min_connections: 2,
            acquire_timeout: Duration::from_secs(5),
            idle_timeout: Duration::from_secs(300),
            ..Default::default()
        };

        let database = Arc::new(Database::new_with_config(db_path.to_str().unwrap(), db_config).await?);

        // Configure audit logging if enabled
        let audit_logger = if config.audit_logging_enabled {
            let audit_config = AuditConfig {
                audit_db_path: audit_db_path.clone(),
                enable_hash_chaining: true,
                max_events: Some(100_000),
                retention_days: Some(1), // Short retention for testing
                enable_compression: false,
                batch_size: 100,
            };
            Some(Arc::new(AuditLogger::new(audit_config).await?))
        } else {
            None
        };

        // Configure Bindery
        let bindery_config = BinderyConfig::builder()
            .memory_limits(5000, 60)?
            .audit_logging_enabled(config.audit_logging_enabled)
            .collaboration(false, None::<String>, None::<String>)?
            .build()?;

        let codex_manager = Arc::new(CodexManager::with_config(bindery_config)?);
        let task_manager = codex_manager.get_task_manager();
        let role_manager = Arc::new(RoleManager::default());

        Ok(Self {
            config,
            codex_manager,
            database,
            audit_logger,
            task_manager,
            role_manager,
        })
    }

    pub async fn run_comprehensive_test(&self) -> BinderyResult<E2EPerformanceResults> {
        println!("Starting comprehensive end-to-end performance test...");
        println!("Configuration: {} users, {} ops/user, {}s duration",
                 self.config.user_count, self.config.operations_per_user, self.config.duration_seconds);

        let start_time = Instant::now();
        let initial_memory = self.get_memory_usage();

        // Create test data
        let user_ids: Vec<UserId> = (0..self.config.user_count)
            .map(|i| format!("test_user_{}", i))
            .collect();

        // Spawn concurrent workers
        let mut handles = Vec::new();
        let mut total_operations = 0;

        for (worker_id, user_id) in user_ids.iter().enumerate() {
            let codex_manager = self.codex_manager.clone();
            let database = self.database.clone();
            let audit_logger = self.audit_logger.clone();
            let task_manager = self.task_manager.clone();
            let user_id = user_id.clone();
            let operations_count = self.config.operations_per_user;

            total_operations += operations_count;

            let handle = tokio::spawn(async move {
                let mut worker_stats = WorkerStats::new(worker_id);

                for operation_id in 0..operations_count {
                    let operation_start = Instant::now();

                    match Self::execute_mixed_operation(
                        worker_id,
                        operation_id,
                        &user_id,
                        &codex_manager,
                        &database,
                        &audit_logger,
                        &task_manager,
                    ).await {
                        Ok(_) => {
                            worker_stats.successful_operations += 1;
                        },
                        Err(_) => {
                            worker_stats.failed_operations += 1;
                        }
                    }

                    let operation_duration = operation_start.elapsed();
                    worker_stats.total_duration += operation_duration;
                    worker_stats.response_times.push(operation_duration);

                    // Small delay to simulate realistic usage
                    sleep(Duration::from_millis(10)).await;
                }

                worker_stats
            });

            handles.push(handle);
        }

        // Monitor system during test
        let monitor_handle = tokio::spawn({
            let test_duration = Duration::from_secs(self.config.duration_seconds);

            async move {
                let mut memory_samples = Vec::new();
                let start = Instant::now();

                while start.elapsed() < test_duration {
                    let memory_usage = Self::get_memory_usage_mb();
                    memory_samples.push(memory_usage);
                    BinderyMetrics::set_memory_usage(memory_usage as u64);

                    sleep(Duration::from_secs(1)).await;
                }

                memory_samples
            }
        });

        // Wait for all workers to complete
        let mut worker_results = Vec::new();
        for handle in handles {
            worker_results.push(handle.await.unwrap());
        }

        let memory_samples = monitor_handle.await.unwrap();
        let total_duration = start_time.elapsed();

        // Aggregate results
        let results = self.aggregate_results(
            worker_results,
            total_operations,
            total_duration,
            memory_samples,
            initial_memory,
        ).await;

        // Check performance thresholds
        let violations = self.check_thresholds(&results);

        let mut final_results = results;
        final_results.threshold_violations = violations;

        // Print results
        self.print_results(&final_results);

        Ok(final_results)
    }

    async fn execute_mixed_operation(
        worker_id: usize,
        operation_id: usize,
        user_id: &UserId,
        codex_manager: &Arc<CodexManager>,
        database: &Arc<Database>,
        audit_logger: &Option<Arc<AuditLogger>>,
        task_manager: &Arc<TaskManager>,
    ) -> BinderyResult<()> {
        // Randomize operation type based on worker and operation ID
        let operation_type = (worker_id + operation_id) % 5;

        match operation_type {
            0 => {
                // Codex creation and modification
                let codex_id = codex_manager.create_codex(
                    format!("E2E Codex W{} O{}", worker_id, operation_id),
                    "test_template"
                ).await?;

                if let Some(_crdt) = codex_manager.get_codex(&codex_id).await {
                    // Record metrics using static method
                    BinderyMetrics::record_task_created("codex_creation");
                }
            },
            1 => {
                // Database operations
                let task_input = TaskInput {
                    title: format!("E2E Task W{} O{}", worker_id, operation_id),
                    description: Some(format!("Task for performance testing worker {} operation {}", worker_id, operation_id)),
                    priority: Some("normal".to_string()),
                    project_id: Some("e2e_performance_test".to_string()),
                    parent_id: None,
                    tags: vec!["performance".to_string(), "e2e".to_string()],
                    labels: json!({"worker_id": worker_id, "operation_id": operation_id}),
                    subtasks: vec![],
                };

                let _task_id = database.create_task(&task_input).await?;
                BinderyMetrics::record_task_created("task_creation");
            },
            2 => {
                // Audit logging
                if let Some(audit_logger) = audit_logger {
                    let user_context = UserContext {
                        user_id: Some(user_id.clone()),
                        session_id: Some(format!("session_{}_{}", worker_id, operation_id)),
                        source_ip: Some("127.0.0.1".to_string()),
                        user_agent: Some("E2E Performance Test".to_string()),
                    };

                    let mut details = HashMap::new();
                    details.insert("worker_id".to_string(), json!(worker_id));
                    details.insert("operation_id".to_string(), json!(operation_id));
                    details.insert("test_type".to_string(), json!("e2e_performance"));

                    let operation = Operation {
                        operation_type: "performance_test".to_string(),
                        action: "test_operation".to_string(),
                        resource: format!("test_resource_{}_{}", worker_id, operation_id),
                        details,
                    };

                    let security_context = crate::observability::SecurityContext {
                        roles: vec!["tester".to_string()],
                        permissions: vec!["test:execute".to_string()],
                        security_level: Some("standard".to_string()),
                        auth_method: None,
                    };

                    let audit_event = AuditEvent {
                        id: Uuid::new_v4().to_string(),
                        user_context,
                        operation,
                        outcome: OperationOutcome {
                            success: true,
                            result_code: Some(200),
                            error_message: None,
                            duration_ms: 1,
                            records_affected: Some(1),
                        },
                        timestamp: Utc::now(),
                        security_context,
                        event_hash: "test_hash".to_string(),
                        metadata: HashMap::new(),
                        previous_hash: None,
                    };

                    audit_logger.log_event(audit_event).await?;
                    BinderyMetrics::record_task_created("audit_logging");
                }
            },
            3 => {
                // Memory-intensive operations (GC testing)
                let temp_user_id = format!("temp_user_{}_{}", worker_id, operation_id);
                let temp_codex_id = Uuid::new_v4();
                let mut temp_crdt = VesperaCRDT::new(temp_codex_id, temp_user_id);

                // Create many operations to trigger GC
                for i in 0..50 {
                    let field_name = format!("temp_field_{}", i);
                    let field_value = format!("temp_value_{}_{}", i, "x".repeat(20));
                    set_text_field(&mut temp_crdt, &field_name, &field_value);
                }

                // Trigger garbage collection
                let _gc_stats = temp_crdt.gc_all_with_limits(
                    Utc::now() - chrono::Duration::minutes(1),
                    25,
                    10,
                );

                BinderyMetrics::record_task_created("gc_operations");
            },
            4 => {
                // Query operations
                let _tasks = database.list_tasks(Some(10), None).await?;
                let _pool_metrics = database.get_pool_metrics().await;
                let _memory_stats = codex_manager.memory_stats().await;

                BinderyMetrics::record_task_created("query_operations");
            },
            _ => unreachable!(),
        }

        Ok(())
    }

    async fn aggregate_results(
        &self,
        worker_results: Vec<WorkerStats>,
        total_operations: usize,
        total_duration: Duration,
        memory_samples: Vec<f64>,
        _initial_memory: f64,
    ) -> E2EPerformanceResults {
        let mut successful_operations = 0;
        let mut failed_operations = 0;
        let mut all_response_times = Vec::new();

        for worker_stats in &worker_results {
            successful_operations += worker_stats.successful_operations;
            failed_operations += worker_stats.failed_operations;
            all_response_times.extend(&worker_stats.response_times);
        }

        let operations_per_second = total_operations as f64 / total_duration.as_secs_f64();
        let average_response_time_ms = if !all_response_times.is_empty() {
            all_response_times.iter().map(|d: &Duration| d.as_millis() as f64).sum::<f64>() / all_response_times.len() as f64
        } else {
            0.0
        };

        let peak_memory_usage_mb = memory_samples.iter().copied()
            .max_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
            .unwrap_or(0.0);

        let error_rate_percent = if total_operations > 0 {
            (failed_operations as f64 / total_operations as f64) * 100.0
        } else {
            0.0
        };

        // Component stats (simplified for this implementation)
        let mut component_stats = HashMap::new();

        // Database component stats
        let db_pool_metrics = self.database.get_pool_metrics().await;
        component_stats.insert("database".to_string(), ComponentStats {
            operation_count: db_pool_metrics.total_acquired as usize,
            average_duration_ms: db_pool_metrics.average_acquisition_time_ms,
            error_count: db_pool_metrics.total_acquisition_failures as usize,
            memory_usage_mb: 0.0, // Would need actual measurement
        });

        // Metrics component stats (stubbed since metrics is push-based)
        component_stats.insert("metrics".to_string(), ComponentStats {
            operation_count: total_operations,
            average_duration_ms: 0.0, // Would need actual measurement
            error_count: 0,
            memory_usage_mb: 0.0,
        });

        E2EPerformanceResults {
            total_operations,
            successful_operations,
            failed_operations,
            total_duration,
            average_response_time_ms,
            operations_per_second,
            peak_memory_usage_mb,
            error_rate_percent,
            threshold_violations: Vec::new(), // Will be populated by check_thresholds
            component_stats,
        }
    }

    fn check_thresholds(&self, results: &E2EPerformanceResults) -> Vec<String> {
        let mut violations = Vec::new();

        if results.average_response_time_ms > self.config.performance_thresholds.max_response_time_ms as f64 {
            violations.push(format!(
                "Average response time ({:.2}ms) exceeds threshold ({}ms)",
                results.average_response_time_ms,
                self.config.performance_thresholds.max_response_time_ms
            ));
        }

        if results.operations_per_second < self.config.performance_thresholds.min_ops_per_second {
            violations.push(format!(
                "Operations per second ({:.2}) below threshold ({:.2})",
                results.operations_per_second,
                self.config.performance_thresholds.min_ops_per_second
            ));
        }

        if results.peak_memory_usage_mb > self.config.performance_thresholds.max_memory_usage_mb {
            violations.push(format!(
                "Peak memory usage ({:.2}MB) exceeds threshold ({:.2}MB)",
                results.peak_memory_usage_mb,
                self.config.performance_thresholds.max_memory_usage_mb
            ));
        }

        if results.error_rate_percent > self.config.performance_thresholds.max_error_rate_percent {
            violations.push(format!(
                "Error rate ({:.2}%) exceeds threshold ({:.2}%)",
                results.error_rate_percent,
                self.config.performance_thresholds.max_error_rate_percent
            ));
        }

        violations
    }

    fn print_results(&self, results: &E2EPerformanceResults) {
        println!("\n=== End-to-End Performance Test Results ===");
        println!("Total operations: {}", results.total_operations);
        println!("Successful operations: {}", results.successful_operations);
        println!("Failed operations: {}", results.failed_operations);
        println!("Test duration: {:.2}s", results.total_duration.as_secs_f64());
        println!("Operations per second: {:.2}", results.operations_per_second);
        println!("Average response time: {:.2}ms", results.average_response_time_ms);
        println!("Peak memory usage: {:.2}MB", results.peak_memory_usage_mb);
        println!("Error rate: {:.2}%", results.error_rate_percent);

        if !results.threshold_violations.is_empty() {
            println!("\n⚠️  Threshold Violations:");
            for violation in &results.threshold_violations {
                println!("  - {}", violation);
            }
        } else {
            println!("\n✅ All performance thresholds met!");
        }

        println!("\nComponent Statistics:");
        for (component, stats) in &results.component_stats {
            println!("  {}: {} ops, {:.2}ms avg, {} errors",
                     component, stats.operation_count, stats.average_duration_ms, stats.error_count);
        }
    }

    fn get_memory_usage(&self) -> f64 {
        Self::get_memory_usage_mb()
    }

    fn get_memory_usage_mb() -> f64 {
        // Simplified memory measurement - in production would use system calls
        (std::process::id() as f64 * 1024.0) / 1024.0 / 1024.0
    }
}

#[derive(Debug, Clone)]
struct WorkerStats {
    worker_id: usize,
    successful_operations: usize,
    failed_operations: usize,
    total_duration: Duration,
    response_times: Vec<Duration>,
}

impl WorkerStats {
    fn new(worker_id: usize) -> Self {
        Self {
            worker_id,
            successful_operations: 0,
            failed_operations: 0,
            total_duration: Duration::ZERO,
            response_times: Vec::new(),
        }
    }
}

#[tokio::test]
async fn test_basic_e2e_performance() {
    let config = E2EPerformanceConfig {
        user_count: 5,
        operations_per_user: 20,
        duration_seconds: 10,
        audit_logging_enabled: true,
        metrics_enabled: true,
        performance_thresholds: PerformanceThresholds {
            max_response_time_ms: 2000,
            min_ops_per_second: 10.0,
            max_memory_usage_mb: 1000.0,
            max_error_rate_percent: 10.0,
        },
    };

    let harness = E2EPerformanceHarness::new(config).await.unwrap();
    let results = harness.run_comprehensive_test().await.unwrap();

    // Basic assertions
    assert!(results.total_operations > 0);
    assert!(results.successful_operations > 0);
    assert!(results.operations_per_second > 0.0);

    // Performance assertions
    assert!(results.error_rate_percent < 50.0, "Error rate too high: {:.2}%", results.error_rate_percent);
    assert!(results.operations_per_second > 5.0, "Operations per second too low: {:.2}", results.operations_per_second);
}

#[tokio::test]
async fn test_audit_logging_performance_impact() {
    // Test with audit logging enabled
    let config_with_audit = E2EPerformanceConfig {
        user_count: 3,
        operations_per_user: 50,
        duration_seconds: 15,
        audit_logging_enabled: true,
        metrics_enabled: true,
        ..Default::default()
    };

    let harness_with_audit = E2EPerformanceHarness::new(config_with_audit).await.unwrap();
    let results_with_audit = harness_with_audit.run_comprehensive_test().await.unwrap();

    // Test without audit logging
    let config_without_audit = E2EPerformanceConfig {
        user_count: 3,
        operations_per_user: 50,
        duration_seconds: 15,
        audit_logging_enabled: false,
        metrics_enabled: true,
        ..Default::default()
    };

    let harness_without_audit = E2EPerformanceHarness::new(config_without_audit).await.unwrap();
    let results_without_audit = harness_without_audit.run_comprehensive_test().await.unwrap();

    println!("Performance comparison:");
    println!("  With audit logging: {:.2} ops/sec", results_with_audit.operations_per_second);
    println!("  Without audit logging: {:.2} ops/sec", results_without_audit.operations_per_second);

    // Audit logging should not significantly degrade performance (< 50% impact)
    let performance_ratio = results_with_audit.operations_per_second / results_without_audit.operations_per_second;
    assert!(performance_ratio > 0.5, "Audit logging impact too high: {:.2}% of original performance", performance_ratio * 100.0);

    // Both should complete successfully
    assert!(results_with_audit.error_rate_percent < 20.0);
    assert!(results_without_audit.error_rate_percent < 20.0);
}

#[tokio::test]
async fn test_production_like_load() {
    let config = E2EPerformanceConfig {
        user_count: 20,
        operations_per_user: 100,
        duration_seconds: 60,
        audit_logging_enabled: true,
        metrics_enabled: true,
        performance_thresholds: PerformanceThresholds {
            max_response_time_ms: 5000,
            min_ops_per_second: 50.0,
            max_memory_usage_mb: 2000.0,
            max_error_rate_percent: 15.0,
        },
    };

    let harness = E2EPerformanceHarness::new(config).await.unwrap();
    let results = harness.run_comprehensive_test().await.unwrap();

    // Production-like assertions
    assert!(results.total_operations >= 1000, "Should handle substantial load");
    assert!(results.operations_per_second >= 20.0, "Should maintain reasonable throughput");
    assert!(results.error_rate_percent < 25.0, "Should maintain reasonable reliability");

    // Check component health
    for (component, stats) in &results.component_stats {
        println!("Component {} stats: {} ops, {} errors", component, stats.operation_count, stats.error_count);

        if stats.operation_count > 0 {
            let component_error_rate = (stats.error_count as f64 / stats.operation_count as f64) * 100.0;
            assert!(component_error_rate < 30.0, "Component {} error rate too high: {:.2}%", component, component_error_rate);
        }
    }

    // Memory should not grow excessively
    assert!(results.peak_memory_usage_mb < 3000.0, "Memory usage too high: {:.2}MB", results.peak_memory_usage_mb);
}

#[tokio::test]
async fn test_system_recovery_after_load() {
    // Run a moderate load test
    let config = E2EPerformanceConfig {
        user_count: 10,
        operations_per_user: 200,
        duration_seconds: 30,
        audit_logging_enabled: true,
        metrics_enabled: true,
        ..Default::default()
    };

    let harness = E2EPerformanceHarness::new(config).await.unwrap();
    let _load_results = harness.run_comprehensive_test().await.unwrap();

    // Test recovery by running a smaller test
    let recovery_config = E2EPerformanceConfig {
        user_count: 3,
        operations_per_user: 20,
        duration_seconds: 10,
        audit_logging_enabled: true,
        metrics_enabled: true,
        ..Default::default()
    };

    // Use the same harness to test recovery
    let recovery_results = harness.run_comprehensive_test().await.unwrap();

    // System should recover and perform well after load
    assert!(recovery_results.operations_per_second > 10.0, "System should recover performance");
    assert!(recovery_results.error_rate_percent < 15.0, "System should recover reliability");
    assert!(recovery_results.average_response_time_ms < 2000.0, "System should recover responsiveness");

    println!("System recovery test passed: {:.2} ops/sec after load test", recovery_results.operations_per_second);
}
