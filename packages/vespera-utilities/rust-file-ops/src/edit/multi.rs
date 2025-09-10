//! Multi-edit sequential operations
//!
//! This module implements sequential multi-edit operations where each edit
//! operates on the result of the previous edit. All operations are atomic -
//! either all succeed or all fail. The module tracks cumulative statistics
//! and handles overlapping edits correctly.
//!
//! Key features:
//! - Sequential operation processing (each edit operates on result of previous)
//! - Atomic operations (all succeed or all fail)
//! - Comprehensive result tracking for each operation
//! - Cumulative performance metrics
//! - Overlap detection and handling

use crate::edit::single::SingleEditor;
use crate::error::{EditError, Result};
use crate::types::{
    EditOperation, MultiEditResult, SingleOperationResult, PerformanceMetrics,
};
use std::time::Instant;

/// Multi-edit engine for sequential string replacement operations
pub struct MultiEditor {
    single_editor: SingleEditor,
}

impl MultiEditor {
    /// Create a new multi-edit engine
    pub fn new() -> Self {
        Self {
            single_editor: SingleEditor::new(),
        }
    }

    /// Apply multiple edit operations sequentially
    ///
    /// Each operation is applied to the result of the previous operation.
    /// Operations are processed in the order they are provided.
    /// If any operation fails, the entire multi-edit fails and no changes are made.
    pub fn apply_edits(&self, content: &str, operations: &[EditOperation]) -> Result<MultiEditResult> {
        let start_time = Instant::now();
        let original_size = content.len();

        if operations.is_empty() {
            return Ok(MultiEditResult::new(content.to_string(), 0));
        }

        // Validate all operations first (fail fast)
        for (i, operation) in operations.iter().enumerate() {
            operation.validate().map_err(|e| {
                EditError::InvalidOperation {
                    reason: format!("Operation {} failed validation: {}", i, e),
                    suggestion: Some("Check operation parameters".to_string()),
                }
            })?;
        }

        // Apply operations sequentially
        let mut current_content = content.to_string();
        let mut result = MultiEditResult::new(current_content.clone(), operations.len());
        let mut cumulative_metrics = PerformanceMetrics::new();
        cumulative_metrics.original_size_bytes = original_size;

        for (i, operation) in operations.iter().enumerate() {
            // Apply single operation
            match self.single_editor.apply_edit(&current_content, operation) {
                Ok(edit_result) => {
                    // Update current content for next operation
                    current_content = edit_result.content;

                    // Convert EditResult to SingleOperationResult
                    let operation_result = SingleOperationResult::new(operation.clone())
                        .with_replacements(
                            edit_result.replacements_made,
                            edit_result.replacement_positions,
                        );

                    // Merge performance metrics
                    cumulative_metrics = self.merge_metrics(&cumulative_metrics, &edit_result.metrics);

                    // Add to multi-edit result
                    result = result.add_operation_result(operation_result);
                }
                Err(e) => {
                    // Operation failed - return error with context
                    return Err(EditError::InvalidOperation {
                        reason: format!(
                            "Operation {} of {} failed: {}",
                            i + 1,
                            operations.len(),
                            e
                        ),
                        suggestion: Some("Check the operation parameters and input text".to_string()),
                    });
                }
            }
        }

        // Finalize result
        cumulative_metrics.processing_time = start_time.elapsed();
        cumulative_metrics.final_size_bytes = current_content.len();
        result.content = current_content;

        Ok(result.with_combined_metrics(cumulative_metrics))
    }

    /// Apply edits with early termination on first failure
    ///
    /// Unlike apply_edits, this continues processing even if individual operations
    /// fail, collecting all results. Useful for best-effort scenarios.
    pub fn apply_edits_best_effort(
        &self,
        content: &str,
        operations: &[EditOperation],
    ) -> Result<MultiEditResult> {
        let start_time = Instant::now();
        let original_size = content.len();

        if operations.is_empty() {
            return Ok(MultiEditResult::new(content.to_string(), 0));
        }

        let mut current_content = content.to_string();
        let mut result = MultiEditResult::new(current_content.clone(), operations.len());
        let mut cumulative_metrics = PerformanceMetrics::new();
        cumulative_metrics.original_size_bytes = original_size;

        for (i, operation) in operations.iter().enumerate() {
            match self.single_editor.apply_edit(&current_content, operation) {
                Ok(edit_result) => {
                    // Update current content for next operation
                    current_content = edit_result.content;

                    // Convert EditResult to SingleOperationResult
                    let operation_result = SingleOperationResult::new(operation.clone())
                        .with_replacements(
                            edit_result.replacements_made,
                            edit_result.replacement_positions,
                        );

                    // Merge performance metrics
                    cumulative_metrics = self.merge_metrics(&cumulative_metrics, &edit_result.metrics);

                    // Add to multi-edit result
                    result = result.add_operation_result(operation_result);
                }
                Err(e) => {
                    // Create a failed operation result
                    let operation_result = SingleOperationResult::new(operation.clone())
                        .with_warning(format!("Operation {} failed: {}", i + 1, e));

                    result = result.add_operation_result(operation_result);

                    // Add warning to overall result
                    result = result.with_warning(format!(
                        "Operation {} of {} failed but continuing with best effort",
                        i + 1,
                        operations.len()
                    ));
                }
            }
        }

        // Finalize result
        cumulative_metrics.processing_time = start_time.elapsed();
        cumulative_metrics.final_size_bytes = current_content.len();
        result.content = current_content;

        Ok(result.with_combined_metrics(cumulative_metrics))
    }

    /// Validate all operations without applying them
    pub fn validate_operations(&self, operations: &[EditOperation]) -> Result<()> {
        for (i, operation) in operations.iter().enumerate() {
            operation.validate().map_err(|e| {
                EditError::InvalidOperation {
                    reason: format!("Operation {} validation failed: {}", i + 1, e),
                    suggestion: Some("Check operation parameters".to_string()),
                }
            })?;
        }
        Ok(())
    }

    /// Preview what the multi-edit would produce without applying changes
    pub fn preview_edits(&self, content: &str, operations: &[EditOperation]) -> Result<MultiEditResult> {
        // For preview, we perform the actual operations but could be extended
        // to provide additional preview-specific information
        self.apply_edits(content, operations)
    }

    /// Count total replacements that would be made across all operations
    pub fn count_total_replacements(&self, content: &str, operations: &[EditOperation]) -> Result<usize> {
        let mut current_content = content.to_string();
        let mut total_replacements = 0;

        for operation in operations {
            let count = self.single_editor.count_replacements(&current_content, operation)?;
            total_replacements += count;

            // Apply the operation to get the content for the next operation
            if count > 0 {
                let edit_result = self.single_editor.apply_edit(&current_content, operation)?;
                current_content = edit_result.content;
            }
        }

        Ok(total_replacements)
    }

    /// Analyze operations for potential conflicts or overlaps
    pub fn analyze_operations(&self, content: &str, operations: &[EditOperation]) -> Result<OperationAnalysis> {
        let mut analysis = OperationAnalysis {
            total_operations: operations.len(),
            estimated_replacements: 0,
            estimated_final_size: content.len(),
            potential_conflicts: Vec::new(),
            size_delta: 0,
        };

        let mut current_content = content.to_string();

        for (i, operation) in operations.iter().enumerate() {
            // Count replacements for this operation
            let count = self.single_editor.count_replacements(&current_content, operation)?;
            analysis.estimated_replacements += count;

            // Calculate size impact
            let operation_delta = operation.length_delta() * count as i32;
            analysis.size_delta += operation_delta;

            // Check for potential conflicts with subsequent operations
            for (j, later_op) in operations.iter().enumerate().skip(i + 1) {
                if self.operations_may_conflict(operation, later_op) {
                    analysis.potential_conflicts.push(OperationConflict {
                        operation1_index: i,
                        operation2_index: j,
                        conflict_type: ConflictType::PotentialOverlap,
                        description: format!(
                            "Operations {} and {} may interact unpredictably",
                            i + 1,
                            j + 1
                        ),
                    });
                }
            }

            // Update current content for next analysis
            if count > 0 {
                let edit_result = self.single_editor.apply_edit(&current_content, operation)?;
                current_content = edit_result.content;
            }
        }

        analysis.estimated_final_size = (content.len() as i32 + analysis.size_delta) as usize;

        Ok(analysis)
    }

    /// Check if two operations might conflict
    fn operations_may_conflict(&self, op1: &EditOperation, op2: &EditOperation) -> bool {
        // Basic heuristics for conflict detection
        
        // If one operation's old_string contains the other's old_string
        if op1.old_string.contains(&op2.old_string) || op2.old_string.contains(&op1.old_string) {
            return true;
        }

        // If one operation's new_string contains the other's old_string
        if op1.new_string.contains(&op2.old_string) || op2.new_string.contains(&op1.old_string) {
            return true;
        }

        // More sophisticated conflict detection could be added here

        false
    }

    /// Merge performance metrics from individual operations
    fn merge_metrics(&self, cumulative: &PerformanceMetrics, operation: &PerformanceMetrics) -> PerformanceMetrics {
        PerformanceMetrics {
            processing_time: cumulative.processing_time + operation.processing_time,
            peak_memory_bytes: std::cmp::max(cumulative.peak_memory_bytes, operation.peak_memory_bytes),
            allocations_count: cumulative.allocations_count + operation.allocations_count,
            original_size_bytes: cumulative.original_size_bytes, // Keep original
            final_size_bytes: operation.final_size_bytes,        // Use latest
            search_operations: cumulative.search_operations + operation.search_operations,
            bytes_searched: cumulative.bytes_searched + operation.bytes_searched,
        }
    }
}

impl Default for MultiEditor {
    fn default() -> Self {
        Self::new()
    }
}

/// Analysis of multi-edit operations
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OperationAnalysis {
    /// Total number of operations to be performed
    pub total_operations: usize,
    /// Estimated total number of replacements
    pub estimated_replacements: usize,
    /// Estimated final content size
    pub estimated_final_size: usize,
    /// Potential conflicts between operations
    pub potential_conflicts: Vec<OperationConflict>,
    /// Total size change (positive = growth, negative = shrink)
    pub size_delta: i32,
}

/// Information about a potential conflict between operations
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OperationConflict {
    /// Index of the first operation
    pub operation1_index: usize,
    /// Index of the second operation
    pub operation2_index: usize,
    /// Type of conflict
    pub conflict_type: ConflictType,
    /// Human-readable description
    pub description: String,
}

/// Types of conflicts that can occur between operations
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConflictType {
    /// Operations may have overlapping effects
    PotentialOverlap,
    /// One operation may affect the target of another
    DependentModification,
    /// Operations may cancel each other out
    Cancellation,
}

/// Convenience function to apply multiple operations sequentially
pub fn apply_multiple_edits(
    content: &str,
    operations: &[EditOperation],
) -> Result<MultiEditResult> {
    let editor = MultiEditor::new();
    editor.apply_edits(content, operations)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sequential_edits() {
        let operations = vec![
            EditOperation::new("hello", "hi", false),
            EditOperation::new("world", "everyone", false),
        ];

        let result = apply_multiple_edits("hello world", &operations).unwrap();
        assert_eq!(result.content, "hi everyone");
        assert_eq!(result.total_replacements, 2);
        assert_eq!(result.successful_operations, 2);
        assert!(result.changed);
    }

    #[test]
    fn test_chained_replacements() {
        // Test where the result of one operation affects the next
        let operations = vec![
            EditOperation::new("a", "ab", true),
            EditOperation::new("ab", "abc", true),
        ];

        let result = apply_multiple_edits("a a a", &operations).unwrap();
        // First: "a a a" -> "ab ab ab"
        // Second: "ab ab ab" -> "abc abc abc"
        assert_eq!(result.content, "abc abc abc");
        assert_eq!(result.total_replacements, 6); // 3 + 3
    }

    #[test]
    fn test_no_operations() {
        let operations = vec![];
        let result = apply_multiple_edits("hello world", &operations).unwrap();
        
        assert_eq!(result.content, "hello world");
        assert_eq!(result.total_replacements, 0);
        assert!(!result.changed);
        assert_eq!(result.total_operations, 0);
    }

    #[test]
    fn test_failed_operation() {
        let operations = vec![
            EditOperation::new("hello", "hi", false),
            EditOperation::new("", "replacement", false), // This should fail
        ];

        let result = apply_multiple_edits("hello world", &operations);
        assert!(result.is_err());
    }

    #[test]
    fn test_best_effort_mode() {
        let editor = MultiEditor::new();
        let operations = vec![
            EditOperation::new("hello", "hi", false),
            EditOperation::new("", "replacement", false), // This should fail
            EditOperation::new("world", "everyone", false),
        ];

        let result = editor.apply_edits_best_effort("hello world", &operations).unwrap();
        
        // Should have warnings about the failed operation
        assert!(!result.warnings.is_empty());
        // First and last operations should work
        assert!(result.total_replacements >= 1);
        assert!(!result.all_operations_successful());
    }

    #[test]
    fn test_operation_validation() {
        let editor = MultiEditor::new();
        let operations = vec![
            EditOperation::new("hello", "hi", false),
            EditOperation::new("", "replacement", false), // Invalid
        ];

        let result = editor.validate_operations(&operations);
        assert!(result.is_err());
    }

    #[test]
    fn test_count_total_replacements() {
        let editor = MultiEditor::new();
        let operations = vec![
            EditOperation::new("a", "b", true),
            EditOperation::new("b", "c", true),
        ];

        let count = editor.count_total_replacements("a a a", &operations).unwrap();
        // First operation: 3 replacements (a->b)
        // Second operation: 3 replacements (b->c) 
        assert_eq!(count, 6);
    }

    #[test]
    fn test_operation_analysis() {
        let editor = MultiEditor::new();
        let operations = vec![
            EditOperation::new("short", "a much longer replacement", true),
            EditOperation::new("test", "x", true),
        ];

        let analysis = editor.analyze_operations("short test short", &operations).unwrap();
        assert_eq!(analysis.total_operations, 2);
        assert!(analysis.size_delta != 0); // Should show size change
        assert!(analysis.estimated_final_size != "short test short".len());
    }

    #[test]
    fn test_conflict_detection() {
        let editor = MultiEditor::new();
        let operations = vec![
            EditOperation::new("abc", "def", false),
            EditOperation::new("def", "ghi", false), // Depends on first operation
        ];

        let analysis = editor.analyze_operations("abc test", &operations).unwrap();
        assert!(!analysis.potential_conflicts.is_empty());
    }

    #[test]
    fn test_metrics_aggregation() {
        let operations = vec![
            EditOperation::new("a", "bb", true),
            EditOperation::new("b", "c", true),
        ];

        let result = apply_multiple_edits("a a a", &operations).unwrap();
        
        // Should have combined metrics from both operations
        assert!(result.metrics.search_operations >= 2);
        assert!(result.metrics.allocations_count >= 2);
        assert_eq!(result.metrics.original_size_bytes, 5); // "a a a"
    }

    #[test]
    fn test_empty_content() {
        let operations = vec![
            EditOperation::new("hello", "hi", false),
        ];

        let result = apply_multiple_edits("", &operations).unwrap();
        assert_eq!(result.content, "");
        assert_eq!(result.total_replacements, 0);
        assert!(!result.changed);
    }
}