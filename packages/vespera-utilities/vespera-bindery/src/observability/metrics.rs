//! Metrics collection and reporting for Vespera Bindery
//!
//! Provides structured metrics collection for monitoring system performance,
//! usage patterns, and health indicators. Includes comprehensive alerting
//! system with configurable thresholds and severity levels.

use metrics::{counter, gauge, histogram, register_counter, register_gauge, register_histogram};
use std::sync::{Arc, Mutex, atomic::{AtomicU64, Ordering}, OnceLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use tracing::{warn, error, info, debug};
use crate::{BinderyError, BinderyResult};

/// Central metrics collector for the Bindery service
#[derive(Clone)]
pub struct MetricsCollector {
    service_name: String,
}

impl MetricsCollector {
    /// Create a new metrics collector
    pub fn new(service_name: impl Into<String>) -> Self {
        let collector = Self {
            service_name: service_name.into(),
        };

        // Register core metrics
        collector.register_metrics();
        collector
    }

    /// Register all metrics with the metrics system
    fn register_metrics(&self) {
        // Database metrics
        register_counter!("bindery_database_operations_total", "Total database operations");
        register_histogram!("bindery_database_operation_duration_seconds", "Database operation duration");
        register_gauge!("bindery_database_connections_active", "Active database connections");
        register_gauge!("bindery_database_connections_max", "Maximum database connections in pool");
        register_gauge!("bindery_database_connection_pool_utilization_percent", "Database connection pool utilization percentage");
        register_counter!("bindery_database_query_timeouts_total", "Total database query timeouts");
        register_histogram!("bindery_database_query_rows_affected", "Number of rows affected by database queries");
        register_counter!("bindery_database_deadlocks_total", "Total database deadlocks detected");
        register_gauge!("bindery_database_transaction_depth", "Current transaction nesting depth");

        // CRDT metrics
        register_counter!("bindery_crdt_operations_total", "Total CRDT operations");
        register_histogram!("bindery_crdt_operation_duration_seconds", "CRDT operation duration");
        register_gauge!("bindery_crdt_documents_active", "Active CRDT documents");
        register_counter!("bindery_crdt_sync_operations_total", "Total CRDT sync operations");
        register_histogram!("bindery_crdt_sync_duration_seconds", "CRDT sync duration");
        register_gauge!("bindery_crdt_memory_usage_bytes", "CRDT memory usage in bytes");
        register_counter!("bindery_crdt_gc_operations_total", "Total CRDT garbage collection operations");
        register_histogram!("bindery_crdt_gc_duration_seconds", "CRDT garbage collection duration");
        register_gauge!("bindery_crdt_vector_clock_size", "Size of CRDT vector clocks");
        register_counter!("bindery_crdt_conflicts_total", "Total CRDT conflicts detected");
        register_histogram!("bindery_crdt_operation_size_bytes", "Size of CRDT operations in bytes");
        register_gauge!("bindery_crdt_document_size_bytes", "Size of CRDT documents in bytes");

        // RAG system metrics
        register_counter!("bindery_rag_embeddings_generated_total", "Total embeddings generated");
        register_histogram!("bindery_rag_embedding_generation_duration_seconds", "Embedding generation duration");
        register_counter!("bindery_rag_searches_total", "Total vector searches");
        register_histogram!("bindery_rag_search_duration_seconds", "Vector search duration");
        register_gauge!("bindery_rag_documents_indexed", "Number of indexed documents");

        // Task management metrics
        register_counter!("bindery_tasks_created_total", "Total tasks created");
        register_counter!("bindery_tasks_completed_total", "Total tasks completed");
        register_counter!("bindery_tasks_failed_total", "Total tasks failed");
        register_histogram!("bindery_task_execution_duration_seconds", "Task execution duration");
        register_gauge!("bindery_tasks_active", "Active tasks");
        register_counter!("bindery_task_timeouts_total", "Total task execution timeouts");
        register_counter!("bindery_task_retries_total", "Total task retry attempts");
        register_gauge!("bindery_task_queue_size", "Number of tasks in execution queue");
        register_histogram!("bindery_task_queue_wait_duration_seconds", "Time tasks wait in queue before execution");

        // Role management metrics
        register_counter!("bindery_role_assignments_total", "Total role assignments");
        register_gauge!("bindery_roles_active", "Active roles");
        register_counter!("bindery_role_permission_checks_total", "Total role permission checks");
        register_counter!("bindery_role_permission_denials_total", "Total role permission denials");
        register_histogram!("bindery_role_execution_duration_seconds", "Duration of role-based executions");

        // Circuit breaker metrics
        register_gauge!("bindery_circuit_breaker_state", "Circuit breaker state (0=closed, 1=open, 2=half-open)");
        register_counter!("bindery_circuit_breaker_state_changes_total", "Total circuit breaker state transitions");
        register_counter!("bindery_circuit_breaker_failures_total", "Total circuit breaker failures");
        register_counter!("bindery_circuit_breaker_successes_total", "Total circuit breaker successes");
        register_histogram!("bindery_circuit_breaker_request_duration_seconds", "Circuit breaker request duration");
        register_gauge!("bindery_circuit_breaker_failure_rate_percent", "Circuit breaker failure rate percentage");

        // Migration system metrics
        register_counter!("bindery_migrations_executed_total", "Total migrations executed");
        register_counter!("bindery_migrations_failed_total", "Total migration failures");
        register_counter!("bindery_migrations_rolled_back_total", "Total migration rollbacks");
        register_histogram!("bindery_migration_duration_seconds", "Migration execution duration");
        register_gauge!("bindery_migration_version", "Current migration version");

        // System metrics
        register_gauge!("bindery_memory_usage_bytes", "Memory usage in bytes");
        register_gauge!("bindery_cpu_usage_percent", "CPU usage percentage");
        register_counter!("bindery_errors_total", "Total errors");
        register_histogram!("bindery_request_duration_seconds", "Request duration");
    }
}

/// Bindery-specific metrics interface
pub struct BinderyMetrics;

impl BinderyMetrics {
    /// Record a database operation with detailed metrics
    pub fn record_database_operation(operation: &str, duration: Duration, success: bool) {
        Self::record_database_operation_detailed(operation, duration, success, 0, false);
    }

    /// Record a database operation with detailed performance metrics
    pub fn record_database_operation_detailed(
        operation: &str,
        duration: Duration,
        success: bool,
        rows_affected: i64,
        is_slow_query: bool
    ) {
        let labels = [("operation", operation.to_string())];

        counter!("bindery_database_operations_total", &labels).increment(1);
        histogram!("bindery_database_operation_duration_seconds", &labels)
            .record(duration.as_secs_f64());

        if rows_affected > 0 {
            histogram!("bindery_database_query_rows_affected", &labels)
                .record(rows_affected as f64);
        }

        if is_slow_query {
            counter!("bindery_database_slow_queries_total", &labels).increment(1);
        }

        if !success {
            counter!("bindery_errors_total", [("component", "database"), ("operation", operation)])
                .increment(1);
        }
    }

    /// Record database pool performance metrics
    pub fn record_database_pool_metrics(
        active_connections: u32,
        max_connections: u32,
        pool_utilization: f64,
        acquisition_time: Duration
    ) {
        gauge!("bindery_database_connections_active").set(active_connections as f64);
        gauge!("bindery_database_connections_max").set(max_connections as f64);
        gauge!("bindery_database_connection_pool_utilization_percent").set(pool_utilization * 100.0);
        histogram!("bindery_database_connection_acquisition_duration_seconds")
            .record(acquisition_time.as_secs_f64());
    }

    /// Record database maintenance operations
    pub fn record_database_maintenance(
        operation: &str,
        duration: Duration,
        success: bool,
        items_processed: usize
    ) {
        let labels = [("maintenance_type", operation.to_string())];

        counter!("bindery_database_maintenance_operations_total", &labels).increment(1);
        histogram!("bindery_database_maintenance_duration_seconds", &labels)
            .record(duration.as_secs_f64());

        if items_processed > 0 {
            histogram!("bindery_database_maintenance_items_processed", &labels)
                .record(items_processed as f64);
        }

        if !success {
            counter!("bindery_database_maintenance_failures_total", &labels).increment(1);
        }
    }

    /// Record database query timeouts
    pub fn record_database_timeout(operation: &str) {
        counter!("bindery_database_query_timeouts_total", [("operation", operation)])
            .increment(1);
    }

    /// Record database deadlocks
    pub fn record_database_deadlock(operation: &str) {
        counter!("bindery_database_deadlocks_total", [("operation", operation)])
            .increment(1);
    }

    /// Update database connection count (deprecated - use record_database_pool_metrics instead)
    pub fn set_database_connections(count: u64) {
        gauge!("bindery_database_connections_active").set(count as f64);
    }

    /// Record a CRDT operation with enhanced metrics
    pub fn record_crdt_operation(operation: &str, document_type: &str, duration: Duration, success: bool) {
        Self::record_crdt_operation_detailed(operation, document_type, duration, success, 0, 0, false);
    }

    /// Record a CRDT operation with detailed performance metrics
    pub fn record_crdt_operation_detailed(
        operation: &str,
        document_type: &str,
        duration: Duration,
        success: bool,
        operation_size_bytes: usize,
        conflicts_resolved: usize,
        memory_pressure: bool
    ) {
        let labels = [
            ("operation", operation.to_string()),
            ("document_type", document_type.to_string()),
        ];

        counter!("bindery_crdt_operations_total", &labels).increment(1);
        histogram!("bindery_crdt_operation_duration_seconds", &labels)
            .record(duration.as_secs_f64());

        if operation_size_bytes > 0 {
            histogram!("bindery_crdt_operation_size_bytes", &labels)
                .record(operation_size_bytes as f64);
        }

        if conflicts_resolved > 0 {
            counter!("bindery_crdt_conflicts_total", &labels).increment(conflicts_resolved as u64);
        }

        if memory_pressure {
            counter!("bindery_crdt_memory_pressure_operations_total", &labels).increment(1);
        }

        if !success {
            counter!("bindery_errors_total", [
                ("component", "crdt"),
                ("operation", operation),
                ("document_type", document_type)
            ]).increment(1);
        }
    }

    /// Record CRDT memory usage metrics
    pub fn record_crdt_memory_metrics(
        documents_active: usize,
        total_memory_bytes: usize,
        operation_log_size: usize,
        vector_clock_size: usize
    ) {
        gauge!("bindery_crdt_documents_active").set(documents_active as f64);
        gauge!("bindery_crdt_memory_usage_bytes").set(total_memory_bytes as f64);
        gauge!("bindery_crdt_operation_log_size").set(operation_log_size as f64);
        gauge!("bindery_crdt_vector_clock_size").set(vector_clock_size as f64);
    }

    /// Record CRDT garbage collection metrics
    pub fn record_crdt_gc_operation(
        gc_type: &str,
        duration: Duration,
        items_collected: usize,
        memory_freed_bytes: usize,
        success: bool
    ) {
        let labels = [("gc_type", gc_type.to_string())];

        counter!("bindery_crdt_gc_operations_total", &labels).increment(1);
        histogram!("bindery_crdt_gc_duration_seconds", &labels)
            .record(duration.as_secs_f64());

        if items_collected > 0 {
            histogram!("bindery_crdt_gc_items_collected", &labels)
                .record(items_collected as f64);
        }

        if memory_freed_bytes > 0 {
            histogram!("bindery_crdt_gc_memory_freed_bytes", &labels)
                .record(memory_freed_bytes as f64);
        }

        if !success {
            counter!("bindery_crdt_gc_failures_total", &labels).increment(1);
        }
    }

    /// Update active CRDT document count
    pub fn set_crdt_documents_active(count: u64) {
        gauge!("bindery_crdt_documents_active").set(count as f64);
    }

    /// Record CRDT sync operation
    pub fn record_crdt_sync(operation: &str, peer_count: usize, duration: Duration, success: bool) {
        let labels = [
            ("operation", operation.to_string()),
            ("peer_count", peer_count.to_string()),
        ];

        counter!("bindery_crdt_sync_operations_total", &labels).increment(1);
        histogram!("bindery_crdt_sync_duration_seconds", &labels)
            .record(duration.as_secs_f64());

        if !success {
            counter!("bindery_errors_total", [("component", "crdt_sync"), ("operation", operation)])
                .increment(1);
        }
    }

    /// Record RAG embedding generation
    pub fn record_rag_embedding_generation(provider: &str, count: u64, duration: Duration, success: bool) {
        let labels = [("provider", provider.to_string())];

        counter!("bindery_rag_embeddings_generated_total", &labels).increment(count);
        histogram!("bindery_rag_embedding_generation_duration_seconds", &labels)
            .record(duration.as_secs_f64());

        if !success {
            counter!("bindery_errors_total", [("component", "rag_embeddings"), ("provider", provider)])
                .increment(1);
        }
    }

    /// Record RAG search operation
    pub fn record_rag_search(query_type: &str, result_count: usize, duration: Duration, success: bool) {
        let labels = [
            ("query_type", query_type.to_string()),
            ("result_count", result_count.to_string()),
        ];

        counter!("bindery_rag_searches_total", &labels).increment(1);
        histogram!("bindery_rag_search_duration_seconds", &labels)
            .record(duration.as_secs_f64());

        if !success {
            counter!("bindery_errors_total", [("component", "rag_search"), ("query_type", query_type)])
                .increment(1);
        }
    }

    /// Update indexed document count
    pub fn set_rag_documents_indexed(count: u64) {
        gauge!("bindery_rag_documents_indexed").set(count as f64);
    }

    /// Record task creation
    pub fn record_task_created(task_type: &str) {
        let labels = [("task_type", task_type.to_string())];
        counter!("bindery_tasks_created_total", &labels).increment(1);
    }

    /// Record task completion with enhanced metrics
    pub fn record_task_completed(task_type: &str, duration: Duration, success: bool) {
        Self::record_task_completed_detailed(task_type, duration, success, 0, 0, Duration::ZERO);
    }

    /// Record task completion with detailed performance metrics
    pub fn record_task_completed_detailed(
        task_type: &str,
        duration: Duration,
        success: bool,
        retry_count: usize,
        subtasks_created: usize,
        queue_wait_time: Duration
    ) {
        let labels = [("task_type", task_type.to_string())];

        if success {
            counter!("bindery_tasks_completed_total", &labels).increment(1);
        } else {
            counter!("bindery_tasks_failed_total", &labels).increment(1);
        }

        histogram!("bindery_task_execution_duration_seconds", &labels)
            .record(duration.as_secs_f64());

        if retry_count > 0 {
            counter!("bindery_task_retries_total", &labels).increment(retry_count as u64);
        }

        if subtasks_created > 0 {
            histogram!("bindery_task_subtasks_created", &labels)
                .record(subtasks_created as f64);
        }

        if queue_wait_time > Duration::ZERO {
            histogram!("bindery_task_queue_wait_duration_seconds", &labels)
                .record(queue_wait_time.as_secs_f64());
        }

        if !success {
            counter!("bindery_errors_total", [("component", "task_management"), ("task_type", task_type)])
                .increment(1);
        }
    }

    /// Record task queue metrics
    pub fn record_task_queue_metrics(queue_size: usize, active_tasks: usize) {
        gauge!("bindery_task_queue_size").set(queue_size as f64);
        gauge!("bindery_tasks_active").set(active_tasks as f64);
    }

    /// Record task timeout
    pub fn record_task_timeout(task_type: &str) {
        counter!("bindery_task_timeouts_total", [("task_type", task_type)])
            .increment(1);
    }

    /// Update active task count
    pub fn set_tasks_active(count: u64) {
        gauge!("bindery_tasks_active").set(count as f64);
    }

    /// Record role assignment
    pub fn record_role_assignment(role_name: &str, success: bool) {
        let labels = [("role_name", role_name.to_string())];
        counter!("bindery_role_assignments_total", &labels).increment(1);

        if !success {
            counter!("bindery_errors_total", [("component", "role_management"), ("role", role_name)])
                .increment(1);
        }
    }

    /// Update active role count
    pub fn set_roles_active(count: u64) {
        gauge!("bindery_roles_active").set(count as f64);
    }

    /// Update memory usage
    pub fn set_memory_usage(bytes: u64) {
        gauge!("bindery_memory_usage_bytes").set(bytes as f64);
    }

    /// Update CPU usage
    pub fn set_cpu_usage(percent: f64) {
        gauge!("bindery_cpu_usage_percent").set(percent);
    }

    /// Record a general error
    pub fn record_error(component: &str, error_type: &str) {
        counter!("bindery_errors_total", [
            ("component", component),
            ("error_type", error_type)
        ]).increment(1);
    }

    /// Record request duration
    pub fn record_request(endpoint: &str, method: &str, status: u16, duration: Duration) {
        let labels = [
            ("endpoint", endpoint.to_string()),
            ("method", method.to_string()),
            ("status", status.to_string()),
        ];

        histogram!("bindery_request_duration_seconds", &labels)
            .record(duration.as_secs_f64());
    }
}

/// Timer for automatic duration measurement
pub struct MetricsTimer {
    start: Instant,
    operation: String,
    component: String,
}

impl MetricsTimer {
    /// Create a new metrics timer
    pub fn new(operation: impl Into<String>, component: impl Into<String>) -> Self {
        Self {
            start: Instant::now(),
            operation: operation.into(),
            component: component.into(),
        }
    }

    /// Complete the timer and record metrics
    pub fn complete(self, success: bool) {
        let duration = self.start.elapsed();

        match self.component.as_str() {
            "database" => BinderyMetrics::record_database_operation(&self.operation, duration, success),
            "crdt" => BinderyMetrics::record_crdt_operation(&self.operation, "generic", duration, success),
            "rag" => match self.operation.as_str() {
                op if op.contains("embedding") => {
                    BinderyMetrics::record_rag_embedding_generation("unknown", 1, duration, success)
                }
                op if op.contains("search") => {
                    BinderyMetrics::record_rag_search("unknown", 0, duration, success)
                }
                _ => {}
            },
            "task" => BinderyMetrics::record_task_completed(&self.operation, duration, success),
            _ => {
                // Record as a generic operation
                tracing::debug!(
                    operation = %self.operation,
                    component = %self.component,
                    duration_ms = duration.as_millis(),
                    success = success,
                    "Operation completed"
                );
            }
        }
    }
}

impl Drop for MetricsTimer {
    fn drop(&mut self) {
        // Auto-complete as success if not explicitly completed
        let duration = self.start.elapsed();
        tracing::trace!(
            operation = %self.operation,
            component = %self.component,
            duration_ms = duration.as_millis(),
            "MetricsTimer dropped without explicit completion"
        );
    }
}

/// Performance metrics aggregator for trend analysis
#[derive(Debug, Clone)]
pub struct PerformanceAggregator {
    database_metrics: Arc<Mutex<Vec<DatabaseMetricSample>>>,
    crdt_metrics: Arc<Mutex<Vec<CRDTMetricSample>>>,
    task_metrics: Arc<Mutex<Vec<TaskMetricSample>>>,
    max_samples: usize,
}

#[derive(Debug, Clone)]
pub struct DatabaseMetricSample {
    pub timestamp: SystemTime,
    pub operation_type: String,
    pub duration_ms: u64,
    pub rows_affected: i64,
    pub pool_utilization: f64,
    pub success: bool,
}

#[derive(Debug, Clone)]
pub struct CRDTMetricSample {
    pub timestamp: SystemTime,
    pub operation_type: String,
    pub document_type: String,
    pub duration_ms: u64,
    pub operation_size_bytes: usize,
    pub memory_usage_bytes: usize,
    pub conflicts_resolved: usize,
}

#[derive(Debug, Clone)]
pub struct TaskMetricSample {
    pub timestamp: SystemTime,
    pub task_type: String,
    pub duration_ms: u64,
    pub queue_wait_ms: u64,
    pub retry_count: usize,
    pub success: bool,
}

impl PerformanceAggregator {
    pub fn new(max_samples: usize) -> Self {
        Self {
            database_metrics: Arc::new(Mutex::new(Vec::new())),
            crdt_metrics: Arc::new(Mutex::new(Vec::new())),
            task_metrics: Arc::new(Mutex::new(Vec::new())),
            max_samples,
        }
    }

    pub fn record_database_sample(&self, sample: DatabaseMetricSample) {
        if let Ok(mut metrics) = self.database_metrics.lock() {
            metrics.push(sample);
            if metrics.len() > self.max_samples {
                metrics.remove(0);
            }
        }
    }

    pub fn record_crdt_sample(&self, sample: CRDTMetricSample) {
        if let Ok(mut metrics) = self.crdt_metrics.lock() {
            metrics.push(sample);
            if metrics.len() > self.max_samples {
                metrics.remove(0);
            }
        }
    }

    pub fn record_task_sample(&self, sample: TaskMetricSample) {
        if let Ok(mut metrics) = self.task_metrics.lock() {
            metrics.push(sample);
            if metrics.len() > self.max_samples {
                metrics.remove(0);
            }
        }
    }

    pub fn get_performance_trends(&self) -> PerformanceTrends {
        let database_samples = self.database_metrics.lock()
            .map(|m| m.clone())
            .unwrap_or_default();

        let crdt_samples = self.crdt_metrics.lock()
            .map(|m| m.clone())
            .unwrap_or_default();

        let task_samples = self.task_metrics.lock()
            .map(|m| m.clone())
            .unwrap_or_default();

        PerformanceTrends {
            database_avg_duration_ms: Self::calculate_avg_duration(&database_samples),
            database_success_rate: Self::calculate_success_rate(&database_samples),
            crdt_avg_duration_ms: Self::calculate_avg_crdt_duration(&crdt_samples),
            crdt_avg_memory_usage_mb: Self::calculate_avg_memory_usage(&crdt_samples),
            task_avg_duration_ms: Self::calculate_avg_task_duration(&task_samples),
            task_success_rate: Self::calculate_task_success_rate(&task_samples),
            sample_count: database_samples.len() + crdt_samples.len() + task_samples.len(),
        }
    }

    fn calculate_avg_duration(samples: &[DatabaseMetricSample]) -> f64 {
        if samples.is_empty() {
            return 0.0;
        }
        samples.iter().map(|s| s.duration_ms as f64).sum::<f64>() / samples.len() as f64
    }

    fn calculate_success_rate(samples: &[DatabaseMetricSample]) -> f64 {
        if samples.is_empty() {
            return 0.0;
        }
        let successful = samples.iter().filter(|s| s.success).count();
        (successful as f64 / samples.len() as f64) * 100.0
    }

    fn calculate_avg_crdt_duration(samples: &[CRDTMetricSample]) -> f64 {
        if samples.is_empty() {
            return 0.0;
        }
        samples.iter().map(|s| s.duration_ms as f64).sum::<f64>() / samples.len() as f64
    }

    fn calculate_avg_memory_usage(samples: &[CRDTMetricSample]) -> f64 {
        if samples.is_empty() {
            return 0.0;
        }
        let total_mb = samples.iter()
            .map(|s| s.memory_usage_bytes as f64 / 1024.0 / 1024.0)
            .sum::<f64>();
        total_mb / samples.len() as f64
    }

    fn calculate_avg_task_duration(samples: &[TaskMetricSample]) -> f64 {
        if samples.is_empty() {
            return 0.0;
        }
        samples.iter().map(|s| s.duration_ms as f64).sum::<f64>() / samples.len() as f64
    }

    fn calculate_task_success_rate(samples: &[TaskMetricSample]) -> f64 {
        if samples.is_empty() {
            return 0.0;
        }
        let successful = samples.iter().filter(|s| s.success).count();
        (successful as f64 / samples.len() as f64) * 100.0
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceTrends {
    pub database_avg_duration_ms: f64,
    pub database_success_rate: f64,
    pub crdt_avg_duration_ms: f64,
    pub crdt_avg_memory_usage_mb: f64,
    pub task_avg_duration_ms: f64,
    pub task_success_rate: f64,
    pub sample_count: usize,
}

/// Convenience macro for creating a metrics timer
#[macro_export]
macro_rules! metrics_timer {
    ($operation:expr, $component:expr) => {
        $crate::observability::metrics::MetricsTimer::new($operation, $component)
    };
}

/// Global performance aggregator instance
static PERFORMANCE_AGGREGATOR: std::sync::OnceLock<PerformanceAggregator> = std::sync::OnceLock::new();

/// Get the global performance aggregator
pub fn get_performance_aggregator() -> &'static PerformanceAggregator {
    PERFORMANCE_AGGREGATOR.get_or_init(|| PerformanceAggregator::new(1000))
}

/// Initialize the performance monitoring system
pub fn init_performance_monitoring(max_samples: usize) -> BinderyResult<()> {
    PERFORMANCE_AGGREGATOR.set(PerformanceAggregator::new(max_samples))
        .map_err(|_| BinderyError::ConfigurationError(
            "Performance monitoring already initialized".to_string()
        ))?;

    info!("Performance monitoring initialized with {} max samples", max_samples);
    Ok(())
}