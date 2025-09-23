/// Error types for Vespera Bindery

use std::fmt;
use serde::{Deserialize, Serialize};
use tracing::{error, warn};

/// Result type for Bindery operations
pub type BinderyResult<T> = Result<T, BinderyError>;

/// Error types that can occur in Vespera Bindery operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BinderyError {
    /// Not found error (Codex, template, role, etc.)
    NotFound(String),

    /// Invalid input or parameters
    InvalidInput(String),

    /// Permission denied for operation
    PermissionDenied(String),

    /// Configuration error
    ConfigurationError(String),

    /// Template-related errors
    TemplateNotFound(crate::templates::TemplateId),
    TemplateParseError(String),
    TemplateValidationError(String),
    TemplateLoadError(String),
    TemplateRegistrationError(String),

    /// CRDT operation errors
    CrdtOperationError(String),
    CrdtConflictError(String),
    CrdtStateError(String),
    CrdtError(String),
    InvalidOperation(String),

    /// Task execution errors
    ExecutionError(String),
    ExecutionTimeout(String),
    RoleValidationError(String),

    /// Hook system errors
    HookError(String),
    HookConditionError(String),
    HookActionError(String),

    /// Synchronization errors
    SyncError(String),
    NetworkError(String),
    ProtocolError(String),

    /// Storage and I/O errors
    IoError(String),
    SerializationError(String),
    DeserializationError(String),
    CompressionError(String),
    DecompressionError(String),

    /// Database errors
    DatabaseError(String),
    DatabaseConnectionError(String),
    DatabaseQueryError(String),
    DatabaseTransactionError(String),
    DatabaseMigrationError(String),

    /// RAG (Retrieval-Augmented Generation) errors
    RagError(String),
    RagIndexError(String),
    RagSearchError(String),
    RagEmbeddingError(String),
    RagChunkingError(String),
    RagDocumentError(String),
    RagProjectError(String),
    RagAnalysisError(String),

    /// Code analysis errors
    CodeAnalysisError(String),
    CodeParsingError(String),
    UnsupportedLanguage(String),

    /// Internal system errors
    InternalError(String),

    /// Not yet implemented functionality
    NotImplemented(String),
}

impl fmt::Display for BinderyError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            BinderyError::NotFound(msg) => write!(f, "Not found: {}", msg),
            BinderyError::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
            BinderyError::PermissionDenied(msg) => write!(f, "Permission denied: {}", msg),
            BinderyError::ConfigurationError(msg) => write!(f, "Configuration error: {}", msg),

            BinderyError::TemplateNotFound(template_id) => write!(f, "Template not found: {}", template_id),
            BinderyError::TemplateParseError(msg) => write!(f, "Template parse error: {}", msg),
            BinderyError::TemplateValidationError(msg) => write!(f, "Template validation error: {}", msg),
            BinderyError::TemplateLoadError(msg) => write!(f, "Template load error: {}", msg),
            BinderyError::TemplateRegistrationError(msg) => write!(f, "Template registration error: {}", msg),

            BinderyError::CrdtOperationError(msg) => write!(f, "CRDT operation error: {}", msg),
            BinderyError::CrdtConflictError(msg) => write!(f, "CRDT conflict error: {}", msg),
            BinderyError::CrdtStateError(msg) => write!(f, "CRDT state error: {}", msg),
            BinderyError::CrdtError(msg) => write!(f, "CRDT error: {}", msg),
            BinderyError::InvalidOperation(msg) => write!(f, "Invalid operation: {}", msg),

            BinderyError::ExecutionError(msg) => write!(f, "Execution error: {}", msg),
            BinderyError::ExecutionTimeout(msg) => write!(f, "Execution timeout: {}", msg),
            BinderyError::RoleValidationError(msg) => write!(f, "Role validation error: {}", msg),

            BinderyError::HookError(msg) => write!(f, "Hook error: {}", msg),
            BinderyError::HookConditionError(msg) => write!(f, "Hook condition error: {}", msg),
            BinderyError::HookActionError(msg) => write!(f, "Hook action error: {}", msg),

            BinderyError::SyncError(msg) => write!(f, "Synchronization error: {}", msg),
            BinderyError::NetworkError(msg) => write!(f, "Network error: {}", msg),
            BinderyError::ProtocolError(msg) => write!(f, "Protocol error: {}", msg),

            BinderyError::IoError(msg) => write!(f, "I/O error: {}", msg),
            BinderyError::SerializationError(msg) => write!(f, "Serialization error: {}", msg),
            BinderyError::DeserializationError(msg) => write!(f, "Deserialization error: {}", msg),
            BinderyError::CompressionError(msg) => write!(f, "Compression error: {}", msg),
            BinderyError::DecompressionError(msg) => write!(f, "Decompression error: {}", msg),

            BinderyError::DatabaseError(msg) => write!(f, "Database error: {}", msg),
            BinderyError::DatabaseConnectionError(msg) => write!(f, "Database connection error: {}", msg),
            BinderyError::DatabaseQueryError(msg) => write!(f, "Database query error: {}", msg),
            BinderyError::DatabaseTransactionError(msg) => write!(f, "Database transaction error: {}", msg),
            BinderyError::DatabaseMigrationError(msg) => write!(f, "Database migration error: {}", msg),

            BinderyError::RagError(msg) => write!(f, "RAG error: {}", msg),
            BinderyError::RagIndexError(msg) => write!(f, "RAG index error: {}", msg),
            BinderyError::RagSearchError(msg) => write!(f, "RAG search error: {}", msg),
            BinderyError::RagEmbeddingError(msg) => write!(f, "RAG embedding error: {}", msg),
            BinderyError::RagChunkingError(msg) => write!(f, "RAG chunking error: {}", msg),
            BinderyError::RagDocumentError(msg) => write!(f, "RAG document error: {}", msg),
            BinderyError::RagProjectError(msg) => write!(f, "RAG project error: {}", msg),
            BinderyError::RagAnalysisError(msg) => write!(f, "RAG analysis error: {}", msg),

            BinderyError::CodeAnalysisError(msg) => write!(f, "Code analysis error: {}", msg),
            BinderyError::CodeParsingError(msg) => write!(f, "Code parsing error: {}", msg),
            BinderyError::UnsupportedLanguage(msg) => write!(f, "Unsupported language: {}", msg),

            BinderyError::InternalError(msg) => write!(f, "Internal error: {}", msg),
            BinderyError::NotImplemented(msg) => write!(f, "Not implemented: {}", msg),
        }
    }
}

impl std::error::Error for BinderyError {}

impl BinderyError {
    /// Log the error with appropriate level based on error type
    pub fn log_error(&self, component: &str, operation: &str) {
        match self {
            // High severity errors - these are serious issues
            BinderyError::DatabaseConnectionError(_) |
            BinderyError::DatabaseTransactionError(_) |
            BinderyError::InternalError(_) |
            BinderyError::CrdtStateError(_) => {
                error!(
                    error = %self,
                    component = component,
                    operation = operation,
                    severity = "high",
                    "Critical error occurred"
                );
            }

            // Medium severity errors - operational issues
            BinderyError::DatabaseError(_) |
            BinderyError::ExecutionError(_) |
            BinderyError::SyncError(_) |
            BinderyError::NetworkError(_) |
            BinderyError::RagError(_) |
            BinderyError::TemplateLoadError(_) => {
                error!(
                    error = %self,
                    component = component,
                    operation = operation,
                    severity = "medium",
                    "Operational error occurred"
                );
            }

            // Low severity errors - user input or expected failures
            BinderyError::NotFound(_) |
            BinderyError::InvalidInput(_) |
            BinderyError::PermissionDenied(_) |
            BinderyError::TemplateNotFound(_) |
            BinderyError::NotImplemented(_) => {
                warn!(
                    error = %self,
                    component = component,
                    operation = operation,
                    severity = "low",
                    "Expected error occurred"
                );
            }

            // Everything else gets medium severity
            _ => {
                error!(
                    error = %self,
                    component = component,
                    operation = operation,
                    severity = "medium",
                    "Error occurred"
                );
            }
        }
    }

    /// Get the error category for metrics collection
    pub fn error_category(&self) -> &'static str {
        match self {
            BinderyError::NotFound(_) => "not_found",
            BinderyError::InvalidInput(_) => "invalid_input",
            BinderyError::PermissionDenied(_) => "permission_denied",
            BinderyError::ConfigurationError(_) => "configuration",

            BinderyError::TemplateNotFound(_) |
            BinderyError::TemplateParseError(_) |
            BinderyError::TemplateValidationError(_) |
            BinderyError::TemplateLoadError(_) |
            BinderyError::TemplateRegistrationError(_) => "template",

            BinderyError::CrdtOperationError(_) |
            BinderyError::CrdtConflictError(_) |
            BinderyError::CrdtStateError(_) |
            BinderyError::CrdtError(_) |
            BinderyError::InvalidOperation(_) => "crdt",

            BinderyError::ExecutionError(_) |
            BinderyError::ExecutionTimeout(_) |
            BinderyError::RoleValidationError(_) => "execution",

            BinderyError::HookError(_) |
            BinderyError::HookConditionError(_) |
            BinderyError::HookActionError(_) => "hook",

            BinderyError::SyncError(_) |
            BinderyError::NetworkError(_) |
            BinderyError::ProtocolError(_) => "sync",

            BinderyError::IoError(_) |
            BinderyError::SerializationError(_) |
            BinderyError::DeserializationError(_) |
            BinderyError::CompressionError(_) |
            BinderyError::DecompressionError(_) => "io",

            BinderyError::DatabaseError(_) |
            BinderyError::DatabaseConnectionError(_) |
            BinderyError::DatabaseQueryError(_) |
            BinderyError::DatabaseTransactionError(_) |
            BinderyError::DatabaseMigrationError(_) => "database",

            BinderyError::RagError(_) |
            BinderyError::RagIndexError(_) |
            BinderyError::RagSearchError(_) |
            BinderyError::RagEmbeddingError(_) |
            BinderyError::RagChunkingError(_) |
            BinderyError::RagDocumentError(_) |
            BinderyError::RagProjectError(_) |
            BinderyError::RagAnalysisError(_) => "rag",

            BinderyError::CodeAnalysisError(_) |
            BinderyError::CodeParsingError(_) |
            BinderyError::UnsupportedLanguage(_) => "code_analysis",

            BinderyError::InternalError(_) => "internal",
            BinderyError::NotImplemented(_) => "not_implemented",
        }
    }

    /// Check if this error should be retried
    pub fn is_retryable(&self) -> bool {
        match self {
            // Network and temporary database issues can be retried
            BinderyError::NetworkError(_) |
            BinderyError::DatabaseConnectionError(_) |
            BinderyError::ExecutionTimeout(_) => true,

            // Most other errors should not be retried
            _ => false,
        }
    }

    /// Get recommended retry delay in milliseconds
    pub fn retry_delay_ms(&self) -> Option<u64> {
        if self.is_retryable() {
            match self {
                BinderyError::NetworkError(_) => Some(1000), // 1 second
                BinderyError::DatabaseConnectionError(_) => Some(5000), // 5 seconds
                BinderyError::ExecutionTimeout(_) => Some(2000), // 2 seconds
                _ => Some(1000),
            }
        } else {
            None
        }
    }
}

// Conversions from common error types

impl From<std::io::Error> for BinderyError {
    fn from(err: std::io::Error) -> Self {
        BinderyError::IoError(err.to_string())
    }
}

impl From<serde_json::Error> for BinderyError {
    fn from(err: serde_json::Error) -> Self {
        BinderyError::SerializationError(err.to_string())
    }
}

impl From<uuid::Error> for BinderyError {
    fn from(err: uuid::Error) -> Self {
        BinderyError::InvalidInput(format!("UUID error: {}", err))
    }
}

impl From<tokio::time::error::Elapsed> for BinderyError {
    fn from(_: tokio::time::error::Elapsed) -> Self {
        BinderyError::ExecutionTimeout("Operation timed out".to_string())
    }
}

impl From<serde_yaml::Error> for BinderyError {
    fn from(err: serde_yaml::Error) -> Self {
        BinderyError::SerializationError(format!("YAML error: {}", err))
    }
}

impl From<json5::Error> for BinderyError {
    fn from(err: json5::Error) -> Self {
        BinderyError::SerializationError(format!("JSON5 error: {}", err))
    }
}

impl From<sqlx::Error> for BinderyError {
    fn from(err: sqlx::Error) -> Self {
        match err {
            sqlx::Error::RowNotFound => {
                BinderyError::NotFound("Database row not found".to_string())
            }
            sqlx::Error::Database(db_err) => {
                BinderyError::DatabaseQueryError(format!("Database error: {}", db_err))
            }
            sqlx::Error::Io(io_err) => {
                BinderyError::DatabaseConnectionError(format!("I/O error: {}", io_err))
            }
            sqlx::Error::PoolTimedOut => {
                BinderyError::DatabaseConnectionError("Connection pool timed out".to_string())
            }
            sqlx::Error::PoolClosed => {
                BinderyError::DatabaseConnectionError("Connection pool is closed".to_string())
            }
            sqlx::Error::WorkerCrashed => {
                BinderyError::DatabaseConnectionError("Database worker crashed".to_string())
            }
            _ => {
                BinderyError::DatabaseError(format!("SQLx error: {}", err))
            }
        }
    }
}

#[cfg(feature = "regex")]
impl From<regex::Error> for BinderyError {
    fn from(err: regex::Error) -> Self {
        BinderyError::InvalidInput(format!("Regex error: {}", err))
    }
}

// Helper macros for creating errors

#[macro_export]
macro_rules! bindery_error {
    ($variant:ident, $($arg:tt)*) => {
        $crate::errors::BinderyError::$variant(format!($($arg)*))
    };
}

#[macro_export]
macro_rules! bindery_bail {
    ($variant:ident, $($arg:tt)*) => {
        return Err($crate::bindery_error!($variant, $($arg)*));
    };
}

// Result extension methods

pub trait BinderyResultExt<T> {
    /// Convert the error to a NotFound error with context
    fn not_found(self, context: &str) -> BinderyResult<T>;

    /// Convert the error to an InvalidInput error with context
    fn invalid_input(self, context: &str) -> BinderyResult<T>;

    /// Convert the error to an ExecutionError with context
    fn execution_error(self, context: &str) -> BinderyResult<T>;

    /// Convert the error to a DatabaseError with context
    fn database_error(self, context: &str) -> BinderyResult<T>;

    /// Convert the error to a RagError with context
    fn rag_error(self, context: &str) -> BinderyResult<T>;

    /// Convert the error to a TemplateError with context
    fn template_error(self, context: &str) -> BinderyResult<T>;

    /// Log the error and return it
    fn log_error(self, component: &str, operation: &str) -> BinderyResult<T>;

    /// Log the error and record metrics, then return it
    fn log_and_metric(self, component: &str, operation: &str) -> BinderyResult<T>;
}

impl<T, E> BinderyResultExt<T> for Result<T, E>
where
    E: fmt::Display,
{
    fn not_found(self, context: &str) -> BinderyResult<T> {
        self.map_err(|e| BinderyError::NotFound(format!("{}: {}", context, e)))
    }

    fn invalid_input(self, context: &str) -> BinderyResult<T> {
        self.map_err(|e| BinderyError::InvalidInput(format!("{}: {}", context, e)))
    }

    fn execution_error(self, context: &str) -> BinderyResult<T> {
        self.map_err(|e| BinderyError::ExecutionError(format!("{}: {}", context, e)))
    }

    fn database_error(self, context: &str) -> BinderyResult<T> {
        self.map_err(|e| BinderyError::DatabaseError(format!("{}: {}", context, e)))
    }

    fn rag_error(self, context: &str) -> BinderyResult<T> {
        self.map_err(|e| BinderyError::RagError(format!("{}: {}", context, e)))
    }

    fn template_error(self, context: &str) -> BinderyResult<T> {
        self.map_err(|e| BinderyError::TemplateLoadError(format!("{}: {}", context, e)))
    }

    fn log_error(self, component: &str, operation: &str) -> BinderyResult<T> {
        self.map_err(|e| {
            let error_msg = format!("{}: {} - {}", component, operation, e);
            error!("{}", error_msg);
            BinderyError::InternalError(error_msg)
        })
    }

    fn log_and_metric(self, component: &str, operation: &str) -> BinderyResult<T> {
        self.map_err(|e| {
            let error_msg = format!("{}: {} - {}", component, operation, e);
            error!("{}", error_msg);

            // TODO: Record error metrics
            // BinderyMetrics::record_error(component, e.error_category());

            BinderyError::InternalError(error_msg)
        })
    }
}