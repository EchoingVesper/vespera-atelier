//! Security validation for file operations
//!
//! Provides validation to prevent directory traversal attacks and ensure
//! file operations are performed within allowed boundaries.

use crate::error::{EditError, Result};
use std::path::{Path, PathBuf};

/// Validates a path to ensure it's safe for file operations
///
/// Prevents:
/// - Directory traversal attacks using ../
/// - Absolute paths outside the allowed directory
/// - Symbolic link exploitation
/// - Hidden file access (optional)
pub fn validate_path(path: &Path, base_dir: Option<&Path>) -> Result<PathBuf> {
    // Check for directory traversal patterns
    let path_str = path.to_string_lossy();
    if path_str.contains("../") || path_str.contains("..\\") {
        return Err(EditError::SecurityViolation {
            path: path.display().to_string(),
            reason: "Path contains directory traversal sequence".to_string(),
        });
    }
    
    // Canonicalize the path to resolve any symlinks and relative components
    let canonical_path = path.canonicalize().map_err(|e| EditError::IoError {
        path: path.display().to_string(),
        operation: "canonicalizing path".to_string(),
        source: e,
    })?;
    
    // If a base directory is provided, ensure the path is within it
    if let Some(base) = base_dir {
        let canonical_base = base.canonicalize().map_err(|e| EditError::IoError {
            path: base.display().to_string(),
            operation: "canonicalizing base directory".to_string(),
            source: e,
        })?;
        
        if !canonical_path.starts_with(&canonical_base) {
            return Err(EditError::SecurityViolation {
                path: canonical_path.display().to_string(),
                reason: format!(
                    "Path is outside allowed directory: {}",
                    canonical_base.display()
                ),
            });
        }
    }
    
    // Check if path points to a directory (we only operate on files)
    if canonical_path.is_dir() {
        return Err(EditError::NotAFile {
            path: canonical_path.display().to_string(),
        });
    }
    
    Ok(canonical_path)
}

/// Validates that a path doesn't contain dangerous characters
pub fn validate_path_characters(path: &Path) -> Result<()> {
    let path_str = path.to_string_lossy();
    
    // Check for null bytes
    if path_str.contains('\0') {
        return Err(EditError::SecurityViolation {
            path: path.display().to_string(),
            reason: "Path contains null bytes".to_string(),
        });
    }
    
    // Check for control characters
    if path_str.chars().any(|c| c.is_control() && c != '\n' && c != '\r' && c != '\t') {
        return Err(EditError::SecurityViolation {
            path: path.display().to_string(),
            reason: "Path contains control characters".to_string(),
        });
    }
    
    Ok(())
}

/// Configuration for path security validation
#[derive(Debug, Clone)]
pub struct SecurityConfig {
    /// Base directory to restrict operations to
    pub base_dir: Option<PathBuf>,
    /// Whether to allow hidden files (starting with .)
    pub allow_hidden: bool,
    /// Whether to follow symbolic links
    pub follow_symlinks: bool,
    /// Maximum path depth allowed
    pub max_depth: Option<usize>,
}

impl Default for SecurityConfig {
    fn default() -> Self {
        Self {
            base_dir: None,
            allow_hidden: true,
            follow_symlinks: false,
            max_depth: Some(32), // Reasonable default to prevent deep recursion
        }
    }
}

impl SecurityConfig {
    /// Create a new security configuration with a base directory
    pub fn with_base_dir(base_dir: impl Into<PathBuf>) -> Self {
        Self {
            base_dir: Some(base_dir.into()),
            ..Default::default()
        }
    }
    
    /// Validate a path according to this security configuration
    pub fn validate_path(&self, path: &Path) -> Result<PathBuf> {
        // Basic character validation
        validate_path_characters(path)?;
        
        // Check for hidden files if not allowed
        if !self.allow_hidden {
            if let Some(name) = path.file_name() {
                if name.to_string_lossy().starts_with('.') {
                    return Err(EditError::SecurityViolation {
                        path: path.display().to_string(),
                        reason: "Hidden files are not allowed".to_string(),
                    });
                }
            }
        }
        
        // Check path depth
        if let Some(max_depth) = self.max_depth {
            let depth = path.components().count();
            if depth > max_depth {
                return Err(EditError::SecurityViolation {
                    path: path.display().to_string(),
                    reason: format!("Path depth {} exceeds maximum {}", depth, max_depth),
                });
            }
        }
        
        // Validate against base directory and traversal attacks
        validate_path(path, self.base_dir.as_deref())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::env;
    
    #[test]
    fn test_directory_traversal_detection() {
        let paths = vec![
            "../etc/passwd",
            "../../root/.ssh/id_rsa",
            "some/path/../../../etc/shadow",
            "normal/../../../path",
        ];
        
        for path_str in paths {
            let path = Path::new(path_str);
            let result = validate_path(path, None);
            assert!(result.is_err(), "Should reject path: {}", path_str);
            
            if let Err(EditError::SecurityViolation { reason, .. }) = result {
                assert!(reason.contains("traversal"), "Should mention traversal for: {}", path_str);
            }
        }
    }
    
    #[test]
    fn test_valid_paths() {
        let temp_dir = env::temp_dir();
        let test_file = temp_dir.join("test_security_valid.txt");
        
        // Create a test file
        fs::write(&test_file, "test content").unwrap();
        
        // Should accept valid paths
        let result = validate_path(&test_file, Some(&temp_dir));
        assert!(result.is_ok(), "Should accept valid path within base dir");
        
        // Clean up
        fs::remove_file(&test_file).ok();
    }
    
    #[test]
    fn test_path_outside_base() {
        let temp_dir = env::temp_dir();
        let other_dir = env::home_dir().unwrap_or_else(|| PathBuf::from("/"));
        
        // Try to access a file outside the base directory
        let outside_file = other_dir.join("outside.txt");
        
        let result = validate_path(&outside_file, Some(&temp_dir));
        assert!(result.is_err(), "Should reject path outside base directory");
    }
    
    #[test]
    fn test_null_byte_detection() {
        let path = Path::new("test\0file.txt");
        let result = validate_path_characters(path);
        assert!(result.is_err(), "Should reject path with null bytes");
    }
    
    #[test]
    fn test_security_config() {
        let config = SecurityConfig::with_base_dir("/tmp")
            .allow_hidden(false)
            .follow_symlinks(false)
            .max_depth(Some(5));
        
        // Test hidden file rejection
        let hidden_path = Path::new("/tmp/.hidden_file");
        let result = config.validate_path(hidden_path);
        assert!(result.is_err(), "Should reject hidden files when not allowed");
        
        // Test max depth
        let deep_path = Path::new("/tmp/a/b/c/d/e/f/g/h/i/j/file.txt");
        let result = config.validate_path(deep_path);
        assert!(result.is_err(), "Should reject paths exceeding max depth");
    }
}

// Extension methods for SecurityConfig builder pattern
impl SecurityConfig {
    pub fn allow_hidden(mut self, allow: bool) -> Self {
        self.allow_hidden = allow;
        self
    }
    
    pub fn follow_symlinks(mut self, follow: bool) -> Self {
        self.follow_symlinks = follow;
        self
    }
    
    pub fn max_depth(mut self, depth: Option<usize>) -> Self {
        self.max_depth = depth;
        self
    }
}