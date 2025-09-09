//! Single string replacement operations
//!
//! This module implements high-performance single string replacement functionality.
//! It uses the matcher from matcher.rs to find strings and performs replacements
//! while preserving exact whitespace and character boundaries.
//!
//! Key features:
//! - Exact string matching and replacement (not regex)
//! - UTF-8 character boundary safety
//! - Efficient memory usage for large texts
//! - Detailed result statistics and performance metrics
//! - Support for replace_all flag

use crate::edit::matcher::{StringMatcher, MatchConfig};
use crate::error::{EditError, Result};
use crate::types::{EditOperation, EditResult, PerformanceMetrics};
use std::time::Instant;

/// Core single string replacement engine
pub struct SingleEditor {
    // Note: matcher configuration is created dynamically per operation
}

impl SingleEditor {
    /// Create a new single editor
    pub fn new() -> Self {
        Self {}
    }

    /// Create a single editor with custom matcher configuration
    pub fn with_matcher_config(_config: MatchConfig) -> Self {
        // Configuration is applied per operation, not stored in the editor
        Self {}
    }

    /// Perform a single string replacement operation
    pub fn apply_edit(&self, content: &str, operation: &EditOperation) -> Result<EditResult> {
        let start_time = Instant::now();
        let original_size = content.len();

        // Validate the operation
        operation.validate()?;

        // Configure matcher for this operation
        let matcher_config = MatchConfig {
            max_matches: if operation.replace_all { 0 } else { 1 },
            find_all: operation.replace_all,
            case_sensitive: true,
        };
        let matcher = StringMatcher::with_config(matcher_config);

        // Find all matches
        let matches = matcher.find_all(content, &operation.old_string)?;

        if matches.is_empty() {
            // No matches found - return original content unchanged
            let metrics = PerformanceMetrics {
                processing_time: start_time.elapsed(),
                peak_memory_bytes: original_size,
                allocations_count: 1,
                original_size_bytes: original_size,
                final_size_bytes: original_size,
                search_operations: 1,
                bytes_searched: original_size,
            };

            return Ok(EditResult::no_changes(operation.clone(), content.to_string())
                .with_metrics(metrics));
        }

        // Perform replacements
        let (new_content, replacement_count) = Self::apply_replacements(
            content,
            &matches,
            &operation.old_string,
            &operation.new_string,
        )?;

        // Calculate metrics
        let final_size = new_content.len();
        let metrics = PerformanceMetrics {
            processing_time: start_time.elapsed(),
            peak_memory_bytes: std::cmp::max(original_size, final_size),
            allocations_count: 2, // Original content + new content
            original_size_bytes: original_size,
            final_size_bytes: final_size,
            search_operations: 1,
            bytes_searched: original_size,
        };

        // Extract positions
        let positions: Vec<usize> = matches.iter().map(|m| m.start).collect();

        Ok(EditResult::success(
            operation.clone(),
            new_content,
            replacement_count,
            positions,
        ).with_metrics(metrics))
    }

    /// Apply replacements at the found match positions
    fn apply_replacements(
        content: &str,
        matches: &[crate::edit::matcher::Match],
        old_string: &str,
        new_string: &str,
    ) -> Result<(String, usize)> {
        if matches.is_empty() {
            return Ok((content.to_string(), 0));
        }

        // Calculate the final size to pre-allocate string buffer
        let old_len = old_string.len();
        let new_len = new_string.len();
        let size_delta = (new_len as i64 - old_len as i64) * matches.len() as i64;
        let final_size = (content.len() as i64 + size_delta) as usize;

        let mut result = String::with_capacity(final_size);
        let mut last_end = 0;

        // Process matches from left to right
        for m in matches {
            // Verify the match is what we expect
            let matched_text = &content[m.start..m.end];
            if matched_text != old_string {
                return Err(EditError::Internal {
                    details: format!(
                        "Match verification failed: expected '{}', found '{}'",
                        old_string, matched_text
                    ),
                    context: Some(format!("Position {}-{}", m.start, m.end)),
                });
            }

            // Add text before this match
            result.push_str(&content[last_end..m.start]);

            // Add the replacement text
            result.push_str(new_string);

            // Move past this match
            last_end = m.end;
        }

        // Add remaining text after the last match
        result.push_str(&content[last_end..]);

        Ok((result, matches.len()))
    }

    /// Count how many replacements would be made without performing them
    pub fn count_replacements(&self, content: &str, operation: &EditOperation) -> Result<usize> {
        operation.validate()?;

        let matcher_config = MatchConfig {
            max_matches: if operation.replace_all { 0 } else { 1 },
            find_all: operation.replace_all,
            case_sensitive: true,
        };
        let matcher = StringMatcher::with_config(matcher_config);

        matcher.count_matches(content, &operation.old_string)
    }

    /// Preview what the edit result would be (for debugging/testing)
    pub fn preview_edit(&self, content: &str, operation: &EditOperation) -> Result<EditResult> {
        // This is essentially the same as apply_edit but could be extended
        // with additional preview-specific functionality in the future
        self.apply_edit(content, operation)
    }
}

impl Default for SingleEditor {
    fn default() -> Self {
        Self::new()
    }
}

/// Convenience function to perform a single string replacement
pub fn replace_string(
    content: &str,
    old_string: &str,
    new_string: &str,
    replace_all: bool,
) -> Result<EditResult> {
    let editor = SingleEditor::new();
    let operation = EditOperation::new(old_string, new_string, replace_all);
    editor.apply_edit(content, &operation)
}

/// Convenience function to replace only the first occurrence
pub fn replace_first(
    content: &str,
    old_string: &str,
    new_string: &str,
) -> Result<EditResult> {
    replace_string(content, old_string, new_string, false)
}

/// Convenience function to replace all occurrences
pub fn replace_all(
    content: &str,
    old_string: &str,
    new_string: &str,
) -> Result<EditResult> {
    replace_string(content, old_string, new_string, true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_single_replacement() {
        let editor = SingleEditor::new();
        let operation = EditOperation::new("hello", "hi", false);
        let result = editor.apply_edit("hello world hello", &operation).unwrap();

        assert_eq!(result.content, "hi world hello");
        assert_eq!(result.replacements_made, 1);
        assert!(result.changed);
        assert_eq!(result.replacement_positions, vec![0]);
    }

    #[test]
    fn test_replace_all() {
        let editor = SingleEditor::new();
        let operation = EditOperation::new("hello", "hi", true);
        let result = editor.apply_edit("hello world hello", &operation).unwrap();

        assert_eq!(result.content, "hi world hi");
        assert_eq!(result.replacements_made, 2);
        assert!(result.changed);
        assert_eq!(result.replacement_positions, vec![0, 12]);
    }

    #[test]
    fn test_no_matches() {
        let editor = SingleEditor::new();
        let operation = EditOperation::new("xyz", "abc", false);
        let result = editor.apply_edit("hello world", &operation).unwrap();

        assert_eq!(result.content, "hello world");
        assert_eq!(result.replacements_made, 0);
        assert!(!result.changed);
        assert!(result.replacement_positions.is_empty());
    }

    #[test]
    fn test_empty_pattern() {
        let editor = SingleEditor::new();
        let operation = EditOperation::new("", "replacement", false);
        let result = editor.apply_edit("hello", &operation);

        assert!(matches!(result, Err(EditError::EmptyPattern)));
    }

    #[test]
    fn test_noop_operation() {
        let editor = SingleEditor::new();
        let operation = EditOperation::new("hello", "hello", true);
        let result = editor.apply_edit("hello world hello", &operation).unwrap();

        // Should find matches but not make changes
        assert_eq!(result.content, "hello world hello");
        assert_eq!(result.replacements_made, 2);
        assert!(!result.changed); // No actual changes despite matches
    }

    #[test]
    fn test_utf8_replacement() {
        let editor = SingleEditor::new();
        let operation = EditOperation::new("🌍", "🌎", false);
        let result = editor.apply_edit("Hello 🌍 world", &operation).unwrap();

        assert_eq!(result.content, "Hello 🌎 world");
        assert_eq!(result.replacements_made, 1);
        assert!(result.changed);
    }

    #[test]
    fn test_size_change_tracking() {
        let editor = SingleEditor::new();
        let operation = EditOperation::new("hi", "hello there", false);
        let result = editor.apply_edit("hi world", &operation).unwrap();

        assert_eq!(result.content, "hello there world");
        assert_eq!(result.metrics.original_size_bytes, 8);
        assert_eq!(result.metrics.final_size_bytes, 17);
        assert_eq!(result.metrics.size_delta(), 9);
    }

    #[test]
    fn test_count_replacements() {
        let editor = SingleEditor::new();
        let operation = EditOperation::new("test", "replacement", true);
        let count = editor.count_replacements("test test test", &operation).unwrap();

        assert_eq!(count, 3);
    }

    #[test]
    fn test_overlapping_matches_prevention() {
        // Test that overlapping matches are handled correctly
        let editor = SingleEditor::new();
        let operation = EditOperation::new("aa", "aaa", true);
        let result = editor.apply_edit("aaaa", &operation).unwrap();

        // Should match at positions 0 and 2, not 1 (which would overlap)
        assert_eq!(result.content, "aaaaaa");
        assert_eq!(result.replacements_made, 2);
    }

    #[test]
    fn test_convenience_functions() {
        let result = replace_first("hello world hello", "hello", "hi").unwrap();
        assert_eq!(result.content, "hi world hello");
        assert_eq!(result.replacements_made, 1);

        let result = replace_all("hello world hello", "hello", "hi").unwrap();
        assert_eq!(result.content, "hi world hi");
        assert_eq!(result.replacements_made, 2);
    }
}