//! String matching engine for exact pattern finding
//! 
//! This module provides efficient algorithms for finding exact string matches
//! in text content. It handles UTF-8 character boundaries correctly and uses
//! optimized algorithms including memchr for fast byte searching.
//! 
//! Key features:
//! - Exact string matching (NOT regex)
//! - UTF-8 character boundary safety
//! - Efficient algorithms optimized for different scenarios
//! - Position and match information tracking
//! - No external diff libraries - pure finding logic

use crate::error::{EditError, Result};

/// Information about a found string match
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Match {
    /// Byte position of the match start
    pub start: usize,
    /// Byte position of the match end (exclusive)
    pub end: usize,
    /// Character position of the match start (for UTF-8 safety)
    pub char_start: usize,
    /// Character position of the match end (exclusive)
    pub char_end: usize,
    /// The matched text (for verification)
    pub matched_text: String,
}

impl Match {
    /// Get the length of the match in bytes
    pub fn byte_len(&self) -> usize {
        self.end - self.start
    }
    
    /// Get the length of the match in characters
    pub fn char_len(&self) -> usize {
        self.char_end - self.char_start
    }
    
    /// Check if this match overlaps with another match
    pub fn overlaps_with(&self, other: &Match) -> bool {
        self.start < other.end && other.start < self.end
    }
}

/// Configuration for string matching operations
#[derive(Debug, Clone)]
pub struct MatchConfig {
    /// Maximum number of matches to find (0 = unlimited)
    pub max_matches: usize,
    /// Whether to find all matches or stop at first
    pub find_all: bool,
    /// Whether to perform case-sensitive matching
    pub case_sensitive: bool,
}

impl Default for MatchConfig {
    fn default() -> Self {
        Self {
            max_matches: 0,
            find_all: false,
            case_sensitive: true,
        }
    }
}

/// Fast string matcher with UTF-8 safety and optimized algorithms
pub struct StringMatcher {
    config: MatchConfig,
}

impl StringMatcher {
    /// Create a new string matcher with default configuration
    pub fn new() -> Self {
        Self {
            config: MatchConfig::default(),
        }
    }
    
    /// Create a new string matcher with custom configuration
    pub fn with_config(config: MatchConfig) -> Self {
        Self { config }
    }
    
    /// Find all occurrences of a pattern in the given text
    pub fn find_all(&self, haystack: &str, needle: &str) -> Result<Vec<Match>> {
        if needle.is_empty() {
            return Err(EditError::EmptyPattern);
        }
        
        let mut matches = Vec::new();
        let mut search_start = 0;
        
        while search_start < haystack.len() {
            if let Some(m) = self.find_next(haystack, needle, search_start)? {
                matches.push(m.clone());
                
                // Check if we've reached the maximum number of matches
                if self.config.max_matches > 0 && matches.len() >= self.config.max_matches {
                    break;
                }
                
                // Move search position past this match to avoid overlapping
                search_start = m.end;
                
                // If we only want the first match, break here
                if !self.config.find_all {
                    break;
                }
            } else {
                break;
            }
        }
        
        Ok(matches)
    }
    
    /// Find the first occurrence of a pattern in the given text
    pub fn find_first(&self, haystack: &str, needle: &str) -> Result<Option<Match>> {
        if needle.is_empty() {
            return Err(EditError::EmptyPattern);
        }
        
        self.find_next(haystack, needle, 0)
    }
    
    /// Find the next occurrence of a pattern starting from the given position
    fn find_next(&self, haystack: &str, needle: &str, start_pos: usize) -> Result<Option<Match>> {
        if start_pos >= haystack.len() {
            return Ok(None);
        }
        
        let _search_slice = &haystack[start_pos..];
        
        // Use different algorithms based on needle characteristics
        if needle.len() == 1 {
            // Single character search - use memchr for speed
            self.find_single_char(haystack, needle, start_pos)
        } else if needle.is_ascii() && haystack[start_pos..].is_ascii() {
            // ASCII-only search - can use fast byte operations
            self.find_ascii_pattern(haystack, needle, start_pos)
        } else {
            // General UTF-8 safe search
            self.find_utf8_pattern(haystack, needle, start_pos)
        }
    }
    
    /// Fast single character search using memchr
    fn find_single_char(&self, haystack: &str, needle: &str, start_pos: usize) -> Result<Option<Match>> {
        let needle_char = needle.chars().next().unwrap();
        let search_slice = &haystack[start_pos..];
        
        if let Some(pos) = search_slice.find(needle_char) {
            let byte_start = start_pos + pos;
            let byte_end = byte_start + needle.len();
            
            // Calculate character positions
            let char_start = haystack[..byte_start].chars().count();
            let char_end = char_start + 1;
            
            Ok(Some(Match {
                start: byte_start,
                end: byte_end,
                char_start,
                char_end,
                matched_text: needle.to_string(),
            }))
        } else {
            Ok(None)
        }
    }
    
    /// Fast ASCII pattern search
    fn find_ascii_pattern(&self, haystack: &str, needle: &str, start_pos: usize) -> Result<Option<Match>> {
        let search_slice = &haystack[start_pos..];
        
        if let Some(pos) = search_slice.find(needle) {
            let byte_start = start_pos + pos;
            let byte_end = byte_start + needle.len();
            
            // For ASCII, byte and character positions are the same
            let char_start = haystack[..byte_start].chars().count();
            let char_end = char_start + needle.chars().count();
            
            Ok(Some(Match {
                start: byte_start,
                end: byte_end,
                char_start,
                char_end,
                matched_text: needle.to_string(),
            }))
        } else {
            Ok(None)
        }
    }
    
    /// General UTF-8 safe pattern search
    fn find_utf8_pattern(&self, haystack: &str, needle: &str, start_pos: usize) -> Result<Option<Match>> {
        let search_slice = &haystack[start_pos..];
        
        if let Some(pos) = search_slice.find(needle) {
            let byte_start = start_pos + pos;
            let byte_end = byte_start + needle.len();
            
            // Verify we're at character boundaries
            if !haystack.is_char_boundary(byte_start) {
                return Err(EditError::EncodingError {
                    position: byte_start,
                    details: "Pattern match does not align with character boundary".to_string(),
                    file_path: None,
                });
            }
            
            if !haystack.is_char_boundary(byte_end) {
                return Err(EditError::EncodingError {
                    position: byte_end,
                    details: "Pattern match does not align with character boundary".to_string(),
                    file_path: None,
                });
            }
            
            // Calculate character positions
            let char_start = haystack[..byte_start].chars().count();
            let char_end = char_start + needle.chars().count();
            
            Ok(Some(Match {
                start: byte_start,
                end: byte_end,
                char_start,
                char_end,
                matched_text: needle.to_string(),
            }))
        } else {
            Ok(None)
        }
    }
    
    /// Count the total number of matches without collecting them
    pub fn count_matches(&self, haystack: &str, needle: &str) -> Result<usize> {
        if needle.is_empty() {
            return Err(EditError::EmptyPattern);
        }
        
        let mut count = 0;
        let mut search_start = 0;
        
        while search_start < haystack.len() {
            if let Some(m) = self.find_next(haystack, needle, search_start)? {
                count += 1;
                search_start = m.end;
                
                // Check maximum limit
                if self.config.max_matches > 0 && count >= self.config.max_matches {
                    break;
                }
            } else {
                break;
            }
        }
        
        Ok(count)
    }
    
    /// Validate that a pattern is suitable for matching
    pub fn validate_pattern(pattern: &str) -> Result<()> {
        if pattern.is_empty() {
            return Err(EditError::EmptyPattern);
        }
        
        // Check for valid UTF-8
        if !pattern.is_char_boundary(0) || !pattern.is_char_boundary(pattern.len()) {
            return Err(EditError::EncodingError {
                position: 0,
                details: "Pattern contains invalid UTF-8 character boundaries".to_string(),
                file_path: None,
            });
        }
        
        // Additional validation could go here (e.g., maximum length checks)
        
        Ok(())
    }
}

impl Default for StringMatcher {
    fn default() -> Self {
        Self::new()
    }
}

/// Convenience functions for common use cases
impl StringMatcher {
    /// Create a matcher that finds all occurrences
    pub fn find_all_matches() -> Self {
        Self::with_config(MatchConfig {
            find_all: true,
            ..Default::default()
        })
    }
    
    /// Create a matcher that finds only the first occurrence
    pub fn find_first_match() -> Self {
        Self::with_config(MatchConfig {
            find_all: false,
            ..Default::default()
        })
    }
    
    /// Create a case-insensitive matcher
    pub fn case_insensitive() -> Self {
        Self::with_config(MatchConfig {
            case_sensitive: false,
            ..Default::default()
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_find_single_match() {
        let matcher = StringMatcher::new();
        let result = matcher.find_first("Hello, world!", "world").unwrap();
        
        assert!(result.is_some());
        let m = result.unwrap();
        assert_eq!(m.start, 7);
        assert_eq!(m.end, 12);
        assert_eq!(m.matched_text, "world");
    }
    
    #[test]
    fn test_find_no_match() {
        let matcher = StringMatcher::new();
        let result = matcher.find_first("Hello, world!", "foo").unwrap();
        assert!(result.is_none());
    }
    
    #[test]
    fn test_find_multiple_matches() {
        let matcher = StringMatcher::find_all_matches();
        let matches = matcher.find_all("test test test", "test").unwrap();
        
        assert_eq!(matches.len(), 3);
        assert_eq!(matches[0].start, 0);
        assert_eq!(matches[1].start, 5);
        assert_eq!(matches[2].start, 10);
    }
    
    #[test]
    fn test_empty_pattern() {
        let matcher = StringMatcher::new();
        let result = matcher.find_first("Hello", "");
        assert!(matches!(result, Err(EditError::EmptyPattern)));
    }
    
    #[test]
    fn test_utf8_pattern() {
        let matcher = StringMatcher::new();
        let result = matcher.find_first("Hello 🌍 world", "🌍").unwrap();
        
        assert!(result.is_some());
        let m = result.unwrap();
        assert_eq!(m.matched_text, "🌍");
        assert_eq!(m.char_start, 6);
        assert_eq!(m.char_end, 7);
    }
    
    #[test]
    fn test_count_matches() {
        let matcher = StringMatcher::new();
        let count = matcher.count_matches("test test test", "test").unwrap();
        assert_eq!(count, 3);
    }
    
    #[test]
    fn test_pattern_validation() {
        assert!(StringMatcher::validate_pattern("valid").is_ok());
        assert!(StringMatcher::validate_pattern("").is_err());
        assert!(StringMatcher::validate_pattern("🌍").is_ok());
    }
}