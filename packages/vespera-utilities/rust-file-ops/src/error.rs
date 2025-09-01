//! Error handling for file operations
//! 
//! Provides unified error types that can be cleanly exposed to Python
//! while maintaining Rust's error handling best practices.

use thiserror::Error;
use std::io;

pub type FileOpResult<T> = Result<T, FileOpError>;

/// Comprehensive error types for file operations
#[derive(Error, Debug)]
pub enum FileOpError {
    #[error("File not found: {path}")]
    NotFound { path: String },
    
    #[error("Permission denied: {path}")]
    PermissionDenied { path: String },
    
    #[error("File too large: {size} bytes (max: {max})")]
    TooLarge { size: u64, max: u64 },
    
    #[error("Invalid file path: {path}")]
    InvalidPath { path: String },
    
    #[error("Directory not empty: {path}")]
    DirectoryNotEmpty { path: String },
    
    #[error("Search pattern invalid: {pattern} - {reason}")]
    InvalidPattern { pattern: String, reason: String },
    
    #[error("Encoding error in file: {path} - {reason}")]
    EncodingError { path: String, reason: String },
    
    #[error("File operation timeout: {operation} on {path}")]
    Timeout { operation: String, path: String },
    
    #[error("Concurrent access conflict: {path}")]
    ConcurrencyError { path: String },
    
    #[error("Insufficient disk space for operation on: {path}")]
    InsufficientSpace { path: String },
    
    #[error("File system error: {0}")]
    IoError(#[from] io::Error),
    
    #[error("Regex error: {0}")]
    RegexError(#[from] regex::Error),
    
    #[error("Glob pattern error: {0}")]
    GlobError(#[from] globset::Error),
    
    #[error("Internal error: {message}")]
    Internal { message: String },
}

impl FileOpError {
    /// Create a new internal error
    pub fn internal(message: impl Into<String>) -> Self {
        Self::Internal {
            message: message.into(),
        }
    }
    
    /// Create a new invalid path error
    pub fn invalid_path(path: impl Into<String>) -> Self {
        Self::InvalidPath {
            path: path.into(),
        }
    }
    
    /// Create a new encoding error
    pub fn encoding_error(path: impl Into<String>, reason: impl Into<String>) -> Self {
        Self::EncodingError {
            path: path.into(),
            reason: reason.into(),
        }
    }
    
    /// Create a new file too large error
    pub fn too_large(size: u64, max: u64) -> Self {
        Self::TooLarge { size, max }
    }
    
    /// Convert IO error with path context
    pub fn from_io_with_path(error: io::Error, path: impl Into<String>) -> Self {
        let path = path.into();
        match error.kind() {
            io::ErrorKind::NotFound => Self::NotFound { path },
            io::ErrorKind::PermissionDenied => Self::PermissionDenied { path },
            _ => Self::IoError(error),
        }
    }
}