//! Error handling for file operations
//! 
//! Provides comprehensive error types for the rust-file-ops library.
//! Designed as library errors (not application errors) with structured data
//! for programmatic access and rich context information.

use thiserror::Error;
use std::io;

/// Specialized Result type for this library
pub type Result<T> = std::result::Result<T, EditError>;

/// Legacy alias for backward compatibility
pub type FileOpResult<T> = Result<T>;

/// Legacy type alias for backward compatibility
pub type FileOpError = EditError;

/// Comprehensive error types for all failure scenarios in file editing operations
#[derive(Error, Debug)]
pub enum EditError {
    /// String pattern not found during search operation
    #[error("String pattern not found: '{pattern}' (searched {bytes_searched} bytes)")]
    StringNotFound {
        pattern: String,
        bytes_searched: usize,
        context: Option<String>,
    },
    
    /// Multiple matches found when expecting exactly one
    #[error("Multiple matches found for pattern '{pattern}': found {count} occurrences")]
    MultipleMatches {
        pattern: String,
        count: usize,
        positions: Vec<usize>,
    },
    
    /// Text encoding errors with detailed position information
    #[error("Invalid UTF-8 encoding at byte position {position}: {details}")]
    EncodingError {
        position: usize,
        details: String,
        file_path: Option<String>,
    },
    
    /// I/O operation failures with enhanced context
    #[error("I/O error on '{path}': {operation} - {source}")]
    IoError {
        path: String,
        operation: String,
        #[source]
        source: io::Error,
    },
    
    /// File too large for in-memory processing
    #[error("File too large for processing: {size} bytes (max: {max_size})")]
    FileTooLarge {
        size: u64,
        max_size: u64,
        file_path: String,
    },
    
    /// Empty pattern provided (invalid operation)
    #[error("Empty search pattern is not allowed")]
    EmptyPattern,
    
    /// File system related errors with detailed context
    #[error("File not found: {path}")]
    FileNotFound { 
        path: String,
        context: Option<String>,
    },
    
    #[error("Permission denied accessing file: {path} - {operation}")]
    PermissionDenied { 
        path: String,
        operation: String,
    },
    
    /// Unicode normalization errors
    #[error("Unicode normalization failed: {details}")]
    UnicodeNormalization { 
        details: String,
        input_sample: Option<String>,
    },
    
    /// Memory and resource errors
    #[error("Out of memory during operation (requested: {requested} bytes)")]
    OutOfMemory { 
        requested: usize,
        operation: String,
    },
    
    #[error("Operation timeout after {seconds} seconds during {operation}")]
    Timeout { 
        seconds: u64,
        operation: String,
    },
    
    /// Invalid operation parameters
    #[error("Invalid operation: {reason}")]
    InvalidOperation {
        reason: String,
        suggestion: Option<String>,
    },
    
    /// Pattern validation errors
    #[error("Search pattern invalid: {pattern} - {reason}")]
    InvalidPattern { 
        pattern: String, 
        reason: String,
    },
    
    /// Legacy file operation errors (for backward compatibility)
    #[error("Directory not empty: {path}")]
    DirectoryNotEmpty { path: String },
    
    #[error("Concurrent access conflict: {path}")]
    ConcurrencyError { path: String },
    
    #[error("Insufficient disk space for operation on: {path}")]
    InsufficientSpace { path: String },
    
    /// Internal consistency errors (should not occur in normal usage)
    #[error("Internal error: {details} (please report this bug)")]
    Internal { 
        details: String,
        context: Option<String>,
    },
}

// Implement From traits for common error types
impl From<std::io::Error> for EditError {
    fn from(error: std::io::Error) -> Self {
        EditError::IoError {
            path: "unknown".to_string(),
            operation: "io operation".to_string(),
            source: error,
        }
    }
}

impl From<globset::Error> for EditError {
    fn from(error: globset::Error) -> Self {
        EditError::InvalidPattern {
            pattern: "unknown".to_string(),
            reason: error.to_string(),
        }
    }
}

impl From<regex::Error> for EditError {
    fn from(error: regex::Error) -> Self {
        EditError::InvalidPattern {
            pattern: "unknown".to_string(),
            reason: error.to_string(),
        }
    }
}

impl EditError {
    /// Create a new string not found error
    pub fn string_not_found(
        pattern: impl Into<String>, 
        bytes_searched: usize,
        context: Option<String>
    ) -> Self {
        Self::StringNotFound {
            pattern: pattern.into(),
            bytes_searched,
            context,
        }
    }
    
    /// Create a new multiple matches error
    pub fn multiple_matches(
        pattern: impl Into<String>,
        count: usize,
        positions: Vec<usize>
    ) -> Self {
        Self::MultipleMatches {
            pattern: pattern.into(),
            count,
            positions,
        }
    }
    
    /// Create a new encoding error
    pub fn encoding_error(
        position: usize,
        details: impl Into<String>,
        file_path: Option<String>
    ) -> Self {
        Self::EncodingError {
            position,
            details: details.into(),
            file_path,
        }
    }
    
    /// Create a new I/O error with context
    pub fn io_error(
        path: impl Into<String>,
        operation: impl Into<String>,
        source: io::Error
    ) -> Self {
        Self::IoError {
            path: path.into(),
            operation: operation.into(),
            source,
        }
    }
    
    /// Create a new file too large error
    pub fn file_too_large(size: u64, max_size: u64, file_path: impl Into<String>) -> Self {
        Self::FileTooLarge {
            size,
            max_size,
            file_path: file_path.into(),
        }
    }
    
    /// Create a new file not found error
    pub fn file_not_found(path: impl Into<String>, context: Option<String>) -> Self {
        Self::FileNotFound {
            path: path.into(),
            context,
        }
    }
    
    /// Create a new permission denied error
    pub fn permission_denied(path: impl Into<String>, operation: impl Into<String>) -> Self {
        Self::PermissionDenied {
            path: path.into(),
            operation: operation.into(),
        }
    }
    
    /// Create a new Unicode normalization error
    pub fn unicode_normalization(details: impl Into<String>, input_sample: Option<String>) -> Self {
        Self::UnicodeNormalization {
            details: details.into(),
            input_sample,
        }
    }
    
    /// Create a new out of memory error
    pub fn out_of_memory(requested: usize, operation: impl Into<String>) -> Self {
        Self::OutOfMemory {
            requested,
            operation: operation.into(),
        }
    }
    
    /// Create a new timeout error
    pub fn timeout(seconds: u64, operation: impl Into<String>) -> Self {
        Self::Timeout {
            seconds,
            operation: operation.into(),
        }
    }
    
    /// Create a new invalid operation error
    pub fn invalid_operation(reason: impl Into<String>, suggestion: Option<String>) -> Self {
        Self::InvalidOperation {
            reason: reason.into(),
            suggestion,
        }
    }
    
    /// Create a new internal error
    pub fn internal(details: impl Into<String>, context: Option<String>) -> Self {
        Self::Internal {
            details: details.into(),
            context,
        }
    }
    
    /// Convert IO error with path context
    pub fn from_io_with_path(error: io::Error, path: impl Into<String>) -> Self {
        let path_str = path.into();
        match error.kind() {
            io::ErrorKind::NotFound => Self::FileNotFound { 
                path: path_str, 
                context: None 
            },
            io::ErrorKind::PermissionDenied => Self::PermissionDenied { 
                path: path_str,
                operation: "access".to_string(),
            },
            _ => Self::IoError {
                path: path_str,
                operation: "unknown".to_string(),
                source: error,
            },
        }
    }
    
    /// Check if error indicates a transient condition that might be retryable
    pub fn is_retryable(&self) -> bool {
        matches!(self, 
            EditError::Timeout { .. } |
            EditError::OutOfMemory { .. } |
            EditError::ConcurrencyError { .. } |
            EditError::InsufficientSpace { .. }
        )
    }
    
    /// Get user-facing error message (simplified for end users)
    pub fn user_message(&self) -> String {
        match self {
            EditError::StringNotFound { pattern, .. } => {
                format!("Could not find the text '{}'", pattern)
            },
            EditError::MultipleMatches { pattern, count, .. } => {
                format!("Found {} matches for '{}', expected only one", count, pattern)
            },
            EditError::EncodingError { .. } => {
                "File contains invalid text encoding".to_string()
            },
            EditError::FileTooLarge { size, max_size, .. } => {
                format!("File is too large ({} bytes, maximum {} bytes)", size, max_size)
            },
            EditError::EmptyPattern => {
                "Search pattern cannot be empty".to_string()
            },
            EditError::FileNotFound { path, .. } => {
                format!("File not found: {}", path)
            },
            EditError::PermissionDenied { path, .. } => {
                format!("Permission denied: {}", path)
            },
            _ => self.to_string(),
        }
    }
    
    /// Get file path if error is file-related
    pub fn file_path(&self) -> Option<&str> {
        match self {
            EditError::IoError { path, .. } |
            EditError::FileTooLarge { file_path: path, .. } |
            EditError::FileNotFound { path, .. } |
            EditError::PermissionDenied { path, .. } |
            EditError::DirectoryNotEmpty { path } |
            EditError::ConcurrencyError { path } |
            EditError::InsufficientSpace { path } => Some(path),
            EditError::EncodingError { file_path, .. } => file_path.as_deref(),
            _ => None,
        }
    }
}

/// Legacy implementation for backward compatibility
#[allow(dead_code)]
impl EditError {
    /// Legacy: Create a new internal error (redirects to new API)
    pub fn internal_legacy(message: impl Into<String>) -> Self {
        Self::internal(message, None)
    }
    
    /// Legacy: Create an invalid path error
    pub fn invalid_path(path: impl Into<String>) -> Self {
        Self::InvalidOperation {
            reason: format!("Invalid file path: {}", path.into()),
            suggestion: Some("Please check the file path is correct".to_string()),
        }
    }
}