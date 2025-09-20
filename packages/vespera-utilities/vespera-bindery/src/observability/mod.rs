//! Observability module for structured logging, tracing, and metrics
//!
//! This module provides comprehensive logging and monitoring capabilities
//! for the Vespera Bindery service, including:
//! - Structured logging with tracing
//! - OpenTelemetry integration
//! - Metrics collection
//! - Request tracing
//! - Performance monitoring

pub mod config;
pub mod instrumentation;
pub mod metrics;

pub use config::{LoggingConfig, ObservabilityConfig, init_logging, init_observability};
pub use instrumentation::{instrument_database, instrument_crdt, instrument_rag};
pub use metrics::{MetricsCollector, BinderyMetrics};

/// Re-export commonly used tracing items
pub use tracing::{debug, error, info, trace, warn, instrument, Instrument, Span};

/// Creates a new span for database operations
#[macro_export]
macro_rules! db_span {
    ($operation:expr) => {
        tracing::info_span!("database_operation", operation = $operation, component = "database")
    };
    ($operation:expr, %$($field:ident),+ $(,)?) => {
        tracing::info_span!("database_operation", operation = $operation, component = "database", $($field),+)
    };
    ($operation:expr, $($field:expr),+ $(,)?) => {
        tracing::info_span!("database_operation", operation = $operation, component = "database", $($field),+)
    };
}

/// Creates a new span for CRDT operations
#[macro_export]
macro_rules! crdt_span {
    ($operation:expr) => {
        tracing::info_span!("crdt_operation", operation = $operation, component = "crdt")
    };
    ($operation:expr, %$($field:ident),+ $(,)?) => {
        tracing::info_span!("crdt_operation", operation = $operation, component = "crdt", $($field),+)
    };
    ($operation:expr, $($field:expr),+ $(,)?) => {
        tracing::info_span!("crdt_operation", operation = $operation, component = "crdt", $($field),+)
    };
}

/// Creates a new span for RAG system operations
#[macro_export]
macro_rules! rag_span {
    ($operation:expr) => {
        tracing::info_span!("rag_operation", operation = $operation, component = "rag")
    };
    ($operation:expr, %$($field:ident),+ $(,)?) => {
        tracing::info_span!("rag_operation", operation = $operation, component = "rag", $($field),+)
    };
    ($operation:expr, $($field:expr),+ $(,)?) => {
        tracing::info_span!("rag_operation", operation = $operation, component = "rag", $($field),+)
    };
}

/// Creates a new span for task management operations
#[macro_export]
macro_rules! task_span {
    ($operation:expr) => {
        tracing::info_span!("task_operation", operation = $operation, component = "task_management")
    };
    ($operation:expr, %$($field:ident),+ $(,)?) => {
        tracing::info_span!("task_operation", operation = $operation, component = "task_management", $($field),+)
    };
    ($operation:expr, $($field:expr),+ $(,)?) => {
        tracing::info_span!("task_operation", operation = $operation, component = "task_management", $($field),+)
    };
}

/// Creates a new span for role management operations
#[macro_export]
macro_rules! role_span {
    ($operation:expr) => {
        tracing::info_span!("role_operation", operation = $operation, component = "role_management")
    };
    ($operation:expr, %$($field:ident),+ $(,)?) => {
        tracing::info_span!("role_operation", operation = $operation, component = "role_management", $($field),+)
    };
    ($operation:expr, $($field:expr),+ $(,)?) => {
        tracing::info_span!("role_operation", operation = $operation, component = "role_management", $($field),+)
    };
}

/// Error logging with context
pub fn log_error_with_context<E: std::fmt::Display>(
    error: E,
    context: &str,
    component: &str,
) {
    tracing::error!(
        error = %error,
        context = context,
        component = component,
        "Operation failed"
    );
}

/// Performance timer for operations
pub struct PerformanceTimer {
    start: std::time::Instant,
    operation: String,
    component: String,
}

impl PerformanceTimer {
    pub fn new(operation: &str, component: &str) -> Self {
        tracing::debug!(
            operation = operation,
            component = component,
            "Starting operation"
        );

        Self {
            start: std::time::Instant::now(),
            operation: operation.to_string(),
            component: component.to_string(),
        }
    }
}

impl Drop for PerformanceTimer {
    fn drop(&mut self) {
        let duration = self.start.elapsed();
        tracing::info!(
            operation = %self.operation,
            component = %self.component,
            duration_ms = duration.as_millis(),
            "Operation completed"
        );
    }
}