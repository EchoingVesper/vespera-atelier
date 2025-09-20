//! Metrics collection and reporting for Vespera Bindery
//!
//! Provides structured metrics collection for monitoring system performance,
//! usage patterns, and health indicators.

use metrics::{counter, gauge, histogram, register_counter, register_gauge, register_histogram};
use std::sync::Arc;
use std::time::{Duration, Instant};

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

        // CRDT metrics
        register_counter!("bindery_crdt_operations_total", "Total CRDT operations");
        register_histogram!("bindery_crdt_operation_duration_seconds", "CRDT operation duration");
        register_gauge!("bindery_crdt_documents_active", "Active CRDT documents");
        register_counter!("bindery_crdt_sync_operations_total", "Total CRDT sync operations");
        register_histogram!("bindery_crdt_sync_duration_seconds", "CRDT sync duration");

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

        // Role management metrics
        register_counter!("bindery_role_assignments_total", "Total role assignments");
        register_gauge!("bindery_roles_active", "Active roles");

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
    /// Record a database operation
    pub fn record_database_operation(operation: &str, duration: Duration, success: bool) {
        let labels = [("operation", operation.to_string())];

        counter!("bindery_database_operations_total", &labels).increment(1);
        histogram!("bindery_database_operation_duration_seconds", &labels)
            .record(duration.as_secs_f64());

        if !success {
            counter!("bindery_errors_total", [("component", "database"), ("operation", operation)])
                .increment(1);
        }
    }

    /// Update database connection count
    pub fn set_database_connections(count: u64) {
        gauge!("bindery_database_connections_active").set(count as f64);
    }

    /// Record a CRDT operation
    pub fn record_crdt_operation(operation: &str, document_type: &str, duration: Duration, success: bool) {
        let labels = [
            ("operation", operation.to_string()),
            ("document_type", document_type.to_string()),
        ];

        counter!("bindery_crdt_operations_total", &labels).increment(1);
        histogram!("bindery_crdt_operation_duration_seconds", &labels)
            .record(duration.as_secs_f64());

        if !success {
            counter!("bindery_errors_total", [
                ("component", "crdt"),
                ("operation", operation),
                ("document_type", document_type)
            ]).increment(1);
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

    /// Record task completion
    pub fn record_task_completed(task_type: &str, duration: Duration, success: bool) {
        let labels = [("task_type", task_type.to_string())];

        if success {
            counter!("bindery_tasks_completed_total", &labels).increment(1);
        } else {
            counter!("bindery_tasks_failed_total", &labels).increment(1);
        }

        histogram!("bindery_task_execution_duration_seconds", &labels)
            .record(duration.as_secs_f64());

        if !success {
            counter!("bindery_errors_total", [("component", "task_management"), ("task_type", task_type)])
                .increment(1);
        }
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

/// Convenience macro for creating a metrics timer
#[macro_export]
macro_rules! metrics_timer {
    ($operation:expr, $component:expr) => {
        $crate::observability::metrics::MetricsTimer::new($operation, $component)
    };
}