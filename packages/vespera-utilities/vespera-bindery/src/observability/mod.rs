//! Observability module for structured logging, tracing, metrics, and audit logging
//!
//! This module provides comprehensive logging and monitoring capabilities
//! for the Vespera Bindery service, including:
//! - Structured logging with tracing
//! - OpenTelemetry integration
//! - Metrics collection
//! - Request tracing
//! - Performance monitoring
//! - Comprehensive audit logging for security-sensitive operations

pub mod config;
pub mod instrumentation;
pub mod metrics;
pub mod audit;

pub use config::{LoggingConfig, ObservabilityConfig, init_logging, init_observability};
pub use instrumentation::{instrument_database, instrument_crdt, instrument_rag};
pub use metrics::{MetricsCollector, BinderyMetrics};

// Re-export audit logging functionality
pub use audit::{
    AuditLogger, AuditEvent, AuditConfig, AuditQueryFilter, AuditStats,
    UserContext, Operation, SecurityContext, OperationOutcome,
    create_role_execution_event, create_migration_event, create_config_change_event,
    create_auth_failure_event
};

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

/// Creates a new span for audit operations
#[macro_export]
macro_rules! audit_span {
    ($operation:expr) => {
        tracing::info_span!("audit_operation", operation = $operation, component = "audit")
    };
    ($operation:expr, %$($field:ident),+ $(,)?) => {
        tracing::info_span!("audit_operation", operation = $operation, component = "audit", $($field),+)
    };
    ($operation:expr, $($field:expr),+ $(,)?) => {
        tracing::info_span!("audit_operation", operation = $operation, component = "audit", $($field),+)
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

/// Initialize audit logging for the system
///
/// This function sets up audit logging with the provided configuration
/// and returns an AuditLogger instance that can be shared across components.
pub async fn init_audit_logging(config: AuditConfig) -> Result<std::sync::Arc<AuditLogger>, crate::errors::BinderyError> {
    info!("Initializing audit logging with config: {:?}", config);

    let audit_logger = AuditLogger::new(config).await?;
    let audit_logger = std::sync::Arc::new(audit_logger);

    info!("Audit logging initialized successfully");
    Ok(audit_logger)
}

/// Create a default audit configuration for development
pub fn default_audit_config() -> AuditConfig {
    use std::path::PathBuf;

    AuditConfig {
        audit_db_path: PathBuf::from("audit.db"),
        enable_hash_chaining: true,
        max_events: Some(100_000), // Smaller for development
        retention_days: Some(30),  // 1 month for development
        enable_compression: false, // Disable for easier debugging
        batch_size: 100,
    }
}

/// Create an audit configuration for production use
pub fn production_audit_config(audit_db_path: std::path::PathBuf) -> AuditConfig {
    AuditConfig {
        audit_db_path,
        enable_hash_chaining: true,
        max_events: Some(1_000_000), // 1M events for production
        retention_days: Some(365),   // 1 year retention
        enable_compression: true,    // Enable compression to save space
        batch_size: 1000,           // Larger batches for better performance
    }
}

/// Log a security event to the audit trail
///
/// This is a convenience function for logging security-sensitive operations
/// when a full audit logger instance is not readily available.
pub async fn log_security_event(
    audit_logger: Option<&std::sync::Arc<AuditLogger>>,
    event: AuditEvent,
) {
    if let Some(logger) = audit_logger {
        if let Err(e) = logger.log_event(event).await {
            error!("Failed to log security event to audit trail: {}", e);
        }
    } else {
        warn!("Audit logger not available, security event not logged");
    }
}

/// Validate audit configuration before use
pub fn validate_audit_config(config: &AuditConfig) -> Result<(), crate::errors::BinderyError> {
    // Validate audit database path
    if !config.audit_db_path.is_absolute() {
        return Err(crate::errors::BinderyError::ConfigurationError(
            "audit_db_path must be an absolute path".to_string()
        ));
    }

    // Check if parent directory exists or can be created
    if let Some(parent) = config.audit_db_path.parent() {
        if !parent.exists() {
            info!("Audit database parent directory does not exist and will be created: {:?}", parent);
        }
    }

    // Validate retention settings
    if let Some(max_events) = config.max_events {
        if max_events == 0 {
            return Err(crate::errors::BinderyError::ConfigurationError(
                "max_events must be greater than 0 when specified".to_string()
            ));
        }

        if max_events > 10_000_000 {
            return Err(crate::errors::BinderyError::ConfigurationError(
                "max_events should not exceed 10,000,000 for performance reasons".to_string()
            ));
        }
    }

    if let Some(retention_days) = config.retention_days {
        if retention_days == 0 {
            return Err(crate::errors::BinderyError::ConfigurationError(
                "retention_days must be greater than 0 when specified".to_string()
            ));
        }

        if retention_days > 3650 { // 10 years
            return Err(crate::errors::BinderyError::ConfigurationError(
                "retention_days should not exceed 3650 (10 years) for practical reasons".to_string()
            ));
        }
    }

    // Validate batch size
    if config.batch_size == 0 {
        return Err(crate::errors::BinderyError::ConfigurationError(
            "batch_size must be greater than 0".to_string()
        ));
    }

    if config.batch_size > 10000 {
        return Err(crate::errors::BinderyError::ConfigurationError(
            "batch_size should not exceed 10,000 for memory reasons".to_string()
        ));
    }

    Ok(())
}