//! Core data structures for the rust-file-ops library
//!
//! This module defines the fundamental types used throughout the library,
//! including operation configurations, results, and metadata structures.
//! All types are designed for library use with proper visibility modifiers
//! and derive appropriate traits for debugging, cloning, and comparison.

use std::time::Duration;

/// Configuration for a single string replacement operation
///
/// This struct defines what text to find, what to replace it with, and
/// whether to replace all occurrences or just the first one.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EditOperation {
    /// The exact string to search for (literal matching, no regex)
    pub old_string: String,
    
    /// The replacement string
    pub new_string: String,
    
    /// If true, replace all occurrences; if false, replace only first
    pub replace_all: bool,
}

impl EditOperation {
    /// Create a new edit operation
    pub fn new(
        old_string: impl Into<String>,
        new_string: impl Into<String>,
        replace_all: bool,
    ) -> Self {
        Self {
            old_string: old_string.into(),
            new_string: new_string.into(),
            replace_all,
        }
    }
    
    /// Create an operation that replaces only the first occurrence
    pub fn replace_first(old_string: impl Into<String>, new_string: impl Into<String>) -> Self {
        Self::new(old_string, new_string, false)
    }
    
    /// Create an operation that replaces all occurrences
    pub fn replace_all_occurrences(old_string: impl Into<String>, new_string: impl Into<String>) -> Self {
        Self::new(old_string, new_string, true)
    }
    
    /// Get the length difference this operation would cause per replacement
    pub fn length_delta(&self) -> i32 {
        self.new_string.len() as i32 - self.old_string.len() as i32
    }
    
    /// Check if this operation would change the text
    pub fn is_noop(&self) -> bool {
        self.old_string == self.new_string
    }
    
    /// Validate the operation parameters
    pub fn validate(&self) -> crate::error::Result<()> {
        use crate::error::EditError;
        
        if self.old_string.is_empty() {
            return Err(EditError::EmptyPattern);
        }
        
        // Additional validations could go here
        Ok(())
    }
}

/// Performance and diagnostic information
///
/// This struct tracks various metrics about the editing operation
/// for performance monitoring and optimization.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct PerformanceMetrics {
    /// Time spent processing
    pub processing_time: Duration,
    
    /// Peak memory usage during operation (bytes)
    pub peak_memory_bytes: usize,
    
    /// Number of string allocations made
    pub allocations_count: usize,
    
    /// Size of original content (bytes)
    pub original_size_bytes: usize,
    
    /// Size of final content (bytes) 
    pub final_size_bytes: usize,
    
    /// Number of search operations performed
    pub search_operations: usize,
    
    /// Total bytes searched through
    pub bytes_searched: usize,
}

impl PerformanceMetrics {
    /// Create new empty metrics
    pub fn new() -> Self {
        Self::default()
    }
    
    /// Calculate the size change in bytes
    pub fn size_delta(&self) -> i32 {
        self.final_size_bytes as i32 - self.original_size_bytes as i32
    }
    
    /// Calculate processing speed in bytes per second
    pub fn bytes_per_second(&self) -> f64 {
        if self.processing_time.as_secs_f64() > 0.0 {
            self.original_size_bytes as f64 / self.processing_time.as_secs_f64()
        } else {
            0.0
        }
    }
    
    /// Get processing time in microseconds for compatibility
    pub fn processing_time_micros(&self) -> u64 {
        self.processing_time.as_micros() as u64
    }
}

/// Detailed information about a single operation within a multi-edit
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SingleOperationResult {
    /// The original operation that was performed
    pub operation: EditOperation,
    
    /// Number of replacements made by this specific operation
    pub replacements_made: usize,
    
    /// Byte positions where replacements occurred
    pub replacement_positions: Vec<usize>,
    
    /// Whether this operation found any matches
    pub found_matches: bool,
    
    /// Whether this operation made any changes
    pub made_changes: bool,
    
    /// Performance metrics for this specific operation
    pub metrics: PerformanceMetrics,
    
    /// Any warnings or notes about this operation
    pub warnings: Vec<String>,
}

impl SingleOperationResult {
    /// Create a new single operation result
    pub fn new(operation: EditOperation) -> Self {
        Self {
            operation,
            replacements_made: 0,
            replacement_positions: Vec::new(),
            found_matches: false,
            made_changes: false,
            metrics: PerformanceMetrics::new(),
            warnings: Vec::new(),
        }
    }
    
    /// Mark this operation as successful with the given number of replacements
    pub fn with_replacements(mut self, count: usize, positions: Vec<usize>) -> Self {
        self.replacements_made = count;
        self.replacement_positions = positions;
        self.found_matches = count > 0;
        self.made_changes = count > 0 && !self.operation.is_noop();
        self
    }
    
    /// Add a warning message to this operation result
    pub fn with_warning(mut self, warning: impl Into<String>) -> Self {
        self.warnings.push(warning.into());
        self
    }
}

/// Result of a single edit operation
///
/// Contains the modified text, statistics about what was changed,
/// and performance metrics.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EditResult {
    /// Number of replacements made
    pub replacements_made: usize,
    
    /// The modified text content
    pub content: String,
    
    /// Performance metrics
    pub metrics: PerformanceMetrics,
    
    /// Whether any changes were made
    pub changed: bool,
    
    /// Byte positions where replacements occurred
    pub replacement_positions: Vec<usize>,
    
    /// The original operation that was performed
    pub operation: EditOperation,
    
    /// Any warnings generated during the operation
    pub warnings: Vec<String>,
}

impl EditResult {
    /// Create a new edit result
    pub fn new(operation: EditOperation, content: String) -> Self {
        Self {
            replacements_made: 0,
            content,
            metrics: PerformanceMetrics::new(),
            changed: false,
            replacement_positions: Vec::new(),
            operation,
            warnings: Vec::new(),
        }
    }
    
    /// Create a successful edit result
    pub fn success(
        operation: EditOperation,
        content: String,
        replacements_made: usize,
        positions: Vec<usize>,
    ) -> Self {
        let changed = replacements_made > 0 && !operation.is_noop();
        Self {
            replacements_made,
            content,
            metrics: PerformanceMetrics::new(),
            changed,
            replacement_positions: positions,
            operation,
            warnings: Vec::new(),
        }
    }
    
    /// Create a no-change result when no matches were found
    pub fn no_changes(operation: EditOperation, content: String) -> Self {
        Self {
            replacements_made: 0,
            content,
            metrics: PerformanceMetrics::new(),
            changed: false,
            replacement_positions: Vec::new(),
            operation,
            warnings: Vec::new(),
        }
    }
    
    /// Add performance metrics to this result
    pub fn with_metrics(mut self, metrics: PerformanceMetrics) -> Self {
        self.metrics = metrics;
        self
    }
    
    /// Add a warning to this result
    pub fn with_warning(mut self, warning: impl Into<String>) -> Self {
        self.warnings.push(warning.into());
        self
    }
    
    /// Check if the operation was successful (found matches)
    pub fn was_successful(&self) -> bool {
        self.replacements_made > 0
    }
}

/// Result of multiple sequential edit operations  
///
/// Contains the final text after all operations, aggregate statistics,
/// and detailed results for each individual operation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MultiEditResult {
    /// Total number of replacements across all operations
    pub total_replacements: usize,
    
    /// Number of operations that found matches
    pub successful_operations: usize,
    
    /// The final modified text content
    pub content: String,
    
    /// Detailed results for each operation
    pub operation_results: Vec<SingleOperationResult>,
    
    /// Combined performance metrics
    pub metrics: PerformanceMetrics,
    
    /// Whether any changes were made across all operations
    pub changed: bool,
    
    /// Total number of operations attempted
    pub total_operations: usize,
    
    /// Any warnings generated during the multi-edit process
    pub warnings: Vec<String>,
}

impl MultiEditResult {
    /// Create a new multi-edit result
    pub fn new(content: String, operations_count: usize) -> Self {
        Self {
            total_replacements: 0,
            successful_operations: 0,
            content,
            operation_results: Vec::with_capacity(operations_count),
            metrics: PerformanceMetrics::new(),
            changed: false,
            total_operations: operations_count,
            warnings: Vec::new(),
        }
    }
    
    /// Add a single operation result
    pub fn add_operation_result(mut self, result: SingleOperationResult) -> Self {
        self.total_replacements += result.replacements_made;
        if result.found_matches {
            self.successful_operations += 1;
        }
        if result.made_changes {
            self.changed = true;
        }
        
        // Merge warnings
        for warning in &result.warnings {
            self.warnings.push(warning.clone());
        }
        
        self.operation_results.push(result);
        self
    }
    
    /// Finalize the result with combined metrics
    pub fn with_combined_metrics(mut self, metrics: PerformanceMetrics) -> Self {
        self.metrics = metrics;
        self
    }
    
    /// Add a warning to the multi-edit result
    pub fn with_warning(mut self, warning: impl Into<String>) -> Self {
        self.warnings.push(warning.into());
        self
    }
    
    /// Get the number of operations that made no changes
    pub fn failed_operations(&self) -> usize {
        self.total_operations - self.successful_operations
    }
    
    /// Get the success rate as a percentage
    pub fn success_rate(&self) -> f64 {
        if self.total_operations > 0 {
            (self.successful_operations as f64 / self.total_operations as f64) * 100.0
        } else {
            0.0
        }
    }
    
    /// Check if all operations were successful
    pub fn all_operations_successful(&self) -> bool {
        self.successful_operations == self.total_operations
    }
    
    /// Check if any operations were successful
    pub fn any_operations_successful(&self) -> bool {
        self.successful_operations > 0
    }
}

/// Configuration options for edit operations
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EditConfig {
    /// Maximum file size to process (bytes)
    pub max_file_size: u64,
    
    /// Timeout for individual operations
    pub operation_timeout: Duration,
    
    /// Whether to validate UTF-8 encoding
    pub validate_utf8: bool,
    
    /// Whether to normalize Unicode before processing
    pub normalize_unicode: bool,
    
    /// Maximum memory usage limit (bytes)
    pub max_memory_usage: usize,
    
    /// Whether to track detailed performance metrics
    pub track_performance: bool,
}

impl Default for EditConfig {
    fn default() -> Self {
        Self {
            max_file_size: 100 * 1024 * 1024, // 100MB
            operation_timeout: Duration::from_secs(30),
            validate_utf8: true,
            normalize_unicode: false,
            max_memory_usage: 256 * 1024 * 1024, // 256MB
            track_performance: true,
        }
    }
}

impl EditConfig {
    /// Create a new configuration with default values
    pub fn new() -> Self {
        Self::default()
    }
    
    /// Set the maximum file size
    pub fn with_max_file_size(mut self, size: u64) -> Self {
        self.max_file_size = size;
        self
    }
    
    /// Set the operation timeout
    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.operation_timeout = timeout;
        self
    }
    
    /// Enable or disable UTF-8 validation
    pub fn with_utf8_validation(mut self, validate: bool) -> Self {
        self.validate_utf8 = validate;
        self
    }
    
    /// Enable or disable Unicode normalization
    pub fn with_unicode_normalization(mut self, normalize: bool) -> Self {
        self.normalize_unicode = normalize;
        self
    }
    
    /// Set the maximum memory usage limit
    pub fn with_max_memory(mut self, bytes: usize) -> Self {
        self.max_memory_usage = bytes;
        self
    }
    
    /// Enable or disable performance tracking
    pub fn with_performance_tracking(mut self, track: bool) -> Self {
        self.track_performance = track;
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_edit_operation_creation() {
        let op = EditOperation::new("old", "new", true);
        assert_eq!(op.old_string, "old");
        assert_eq!(op.new_string, "new");
        assert_eq!(op.replace_all, true);
    }
    
    #[test]
    fn test_edit_operation_helpers() {
        let op1 = EditOperation::replace_first("old", "new");
        assert_eq!(op1.replace_all, false);
        
        let op2 = EditOperation::replace_all_occurrences("old", "new");
        assert_eq!(op2.replace_all, true);
    }
    
    #[test]
    fn test_length_delta() {
        let op = EditOperation::new("abc", "abcdef", false);
        assert_eq!(op.length_delta(), 3);
        
        let op2 = EditOperation::new("abcdef", "abc", false);
        assert_eq!(op2.length_delta(), -3);
    }
    
    #[test]
    fn test_is_noop() {
        let op1 = EditOperation::new("same", "same", false);
        assert!(op1.is_noop());
        
        let op2 = EditOperation::new("old", "new", false);
        assert!(!op2.is_noop());
    }
    
    #[test]
    fn test_performance_metrics() {
        let mut metrics = PerformanceMetrics::new();
        metrics.original_size_bytes = 100;
        metrics.final_size_bytes = 120;
        
        assert_eq!(metrics.size_delta(), 20);
    }
    
    #[test]
    fn test_edit_result_creation() {
        let op = EditOperation::new("old", "new", false);
        let result = EditResult::new(op.clone(), "content".to_string());
        
        assert_eq!(result.operation, op);
        assert_eq!(result.content, "content");
        assert!(!result.changed);
    }
    
    #[test]
    fn test_multi_edit_result() {
        let mut result = MultiEditResult::new("final content".to_string(), 2);
        
        let op1 = EditOperation::new("a", "b", false);
        let single_result1 = SingleOperationResult::new(op1).with_replacements(1, vec![0]);
        
        result = result.add_operation_result(single_result1);
        
        assert_eq!(result.total_replacements, 1);
        assert_eq!(result.successful_operations, 1);
        assert!(result.changed);
    }
    
    #[test]
    fn test_edit_config() {
        let config = EditConfig::new()
            .with_max_file_size(50 * 1024 * 1024)
            .with_timeout(Duration::from_secs(10))
            .with_utf8_validation(false);
            
        assert_eq!(config.max_file_size, 50 * 1024 * 1024);
        assert_eq!(config.operation_timeout, Duration::from_secs(10));
        assert!(!config.validate_utf8);
    }
}