//! Error types for Vespera Bindery

use thiserror::Error;
use crate::types::{TemplateId, CodexId, UserId, OperationId};

/// Result type alias for Vespera Bindery operations
pub type BinderyResult<T> = Result<T, BinderyError>;

/// Main error type for Vespera Bindery operations
#[derive(Error, Debug)]
pub enum BinderyError {
    /// CRDT operation errors
    #[error("CRDT operation failed: {0}")]
    CrdtError(String),
    
    /// Template-related errors
    #[error("Template not found: {0}")]
    TemplateNotFound(TemplateId),
    
    #[error("Template validation failed: {0}")]
    TemplateValidationError(String),
    
    #[error("Invalid template format: {0}")]
    InvalidTemplateFormat(String),
    
    /// Codex-related errors
    #[error("Codex not found: {0}")]
    CodexNotFound(CodexId),
    
    #[error("Codex validation failed: {0}")]
    CodexValidationError(String),
    
    #[error("Invalid codex format: {0}")]
    InvalidCodexFormat(String),
    
    /// Serialization errors
    #[error("Serialization error: {0}")]
    SerializationError(String),
    
    #[error("Deserialization error: {0}")]
    DeserializationError(String),
    
    /// File system errors
    #[error("File system error: {0}")]
    FileSystemError(String),
    
    #[error("Path does not exist: {0}")]
    PathNotFound(String),
    
    #[error("Permission denied: {0}")]
    PermissionDenied(String),
    
    /// Network and synchronization errors
    #[error("Network error: {0}")]
    NetworkError(String),
    
    #[error("Synchronization failed: {0}")]
    SyncError(String),
    
    #[error("Connection failed: {0}")]
    ConnectionError(String),
    
    #[error("Authentication failed: {0}")]
    AuthenticationError(String),
    
    /// Collaboration errors
    #[error("User not found: {0}")]
    UserNotFound(UserId),
    
    #[error("Operation conflict: {0}")]
    OperationConflict(String),
    
    #[error("Invalid operation: {0}")]
    InvalidOperation(String),
    
    #[error("Operation not found: {0}")]
    OperationNotFound(OperationId),
    
    /// Configuration errors
    #[error("Configuration error: {0}")]
    ConfigurationError(String),
    
    #[error("Invalid configuration: {0}")]
    InvalidConfiguration(String),
    
    /// Binding-specific errors
    #[error("Node.js binding error: {0}")]
    NodeJsBindingError(String),
    
    #[error("Python binding error: {0}")]
    PythonBindingError(String),
    
    /// Generic errors
    #[error("Internal error: {0}")]
    InternalError(String),
    
    #[error("Not implemented: {0}")]
    NotImplemented(String),
    
    #[error("Timeout: {0}")]
    Timeout(String),
    
    /// Wrapped external errors
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    
    #[error("JSON error: {0}")]
    JsonError(#[from] serde_json::Error),
    
    #[error("YAML error: {0}")]
    YamlError(#[from] serde_yaml::Error),
    
    #[error("JSON5 error: {0}")]
    Json5Error(String), // json5 crate doesn't implement std::error::Error
    
    #[error("UUID error: {0}")]
    UuidError(#[from] uuid::Error),
    
    #[error("Async task error: {0}")]
    TaskError(#[from] tokio::task::JoinError),
}

impl From<json5::Error> for BinderyError {
    fn from(err: json5::Error) -> Self {
        Self::Json5Error(err.to_string())
    }
}

impl BinderyError {
    /// Check if this error is recoverable
    pub fn is_recoverable(&self) -> bool {
        match self {
            // Permanent errors that shouldn't be retried
            Self::TemplateNotFound(_) | 
            Self::CodexNotFound(_) |
            Self::UserNotFound(_) |
            Self::PermissionDenied(_) |
            Self::InvalidTemplateFormat(_) |
            Self::InvalidCodexFormat(_) |
            Self::InvalidConfiguration(_) |
            Self::NotImplemented(_) => false,
            
            // Temporary errors that might succeed on retry
            Self::NetworkError(_) |
            Self::ConnectionError(_) |
            Self::SyncError(_) |
            Self::Timeout(_) |
            Self::FileSystemError(_) => true,
            
            // Depends on the specific error
            Self::CrdtError(_) |
            Self::OperationConflict(_) |
            Self::InvalidOperation(_) |
            Self::InternalError(_) => false,
            
            // IO errors might be recoverable
            Self::IoError(io_err) => match io_err.kind() {
                std::io::ErrorKind::NotFound |
                std::io::ErrorKind::PermissionDenied => false,
                std::io::ErrorKind::Interrupted |
                std::io::ErrorKind::WouldBlock |
                std::io::ErrorKind::TimedOut => true,
                _ => false,
            },
            
            // Other errors are generally not recoverable
            _ => false,
        }
    }
    
    /// Get error category for logging/metrics
    pub fn category(&self) -> &'static str {
        match self {
            Self::CrdtError(_) => "crdt",
            Self::TemplateNotFound(_) | 
            Self::TemplateValidationError(_) |
            Self::InvalidTemplateFormat(_) => "template",
            
            Self::CodexNotFound(_) |
            Self::CodexValidationError(_) |
            Self::InvalidCodexFormat(_) => "codex",
            
            Self::SerializationError(_) |
            Self::DeserializationError(_) |
            Self::JsonError(_) |
            Self::YamlError(_) |
            Self::Json5Error(_) => "serialization",
            
            Self::FileSystemError(_) |
            Self::PathNotFound(_) |
            Self::PermissionDenied(_) |
            Self::IoError(_) => "filesystem",
            
            Self::NetworkError(_) |
            Self::SyncError(_) |
            Self::ConnectionError(_) |
            Self::AuthenticationError(_) => "network",
            
            Self::UserNotFound(_) |
            Self::OperationConflict(_) |
            Self::InvalidOperation(_) |
            Self::OperationNotFound(_) => "collaboration",
            
            Self::ConfigurationError(_) |
            Self::InvalidConfiguration(_) => "configuration",
            
            Self::NodeJsBindingError(_) |
            Self::PythonBindingError(_) => "bindings",
            
            Self::InternalError(_) |
            Self::NotImplemented(_) |
            Self::Timeout(_) |
            Self::TaskError(_) |
            Self::UuidError(_) => "internal",
        }
    }
}