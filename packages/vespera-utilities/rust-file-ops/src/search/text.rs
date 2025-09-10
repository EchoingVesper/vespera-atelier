//! High-performance text search using ripgrep-style algorithms
//! 
//! Provides fast text search across files with regex support,
//! parallel processing, and memory-efficient streaming.

use crate::error::{EditError, Result};
use crate::io::reader::FileReader;
use grep::regex::RegexMatcherBuilder;
use grep::searcher::{Searcher, SearcherBuilder};
use grep::searcher::sinks::UTF8;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use walkdir::WalkDir;
use aho_corasick::AhoCorasick;

// Type aliases for compatibility
type FileOpError = EditError;
type FileOpResult<T> = Result<T>;

/// Text search result
#[derive(Debug, Clone)]
pub struct SearchMatch {
    pub file_path: PathBuf,
    pub line_number: u64,
    pub line_content: String,
    pub match_start: usize,
    pub match_end: usize,
}

/// Text searcher with regex and multi-pattern support
pub struct TextSearcher {
    case_insensitive: bool,
    whole_words: bool,
    max_results: Option<usize>,
    include_patterns: Vec<String>,
    exclude_patterns: Vec<String>,
}

impl TextSearcher {
    /// Create new text searcher
    pub fn new() -> Self {
        Self {
            case_insensitive: false,
            whole_words: false,
            max_results: None,
            include_patterns: Vec::new(),
            exclude_patterns: Vec::new(),
        }
    }
    
    /// Set case insensitive search
    pub fn case_insensitive(mut self, enabled: bool) -> Self {
        self.case_insensitive = enabled;
        self
    }
    
    /// Set whole words matching
    pub fn whole_words(mut self, enabled: bool) -> Self {
        self.whole_words = enabled;
        self
    }
    
    /// Set maximum number of results
    pub fn max_results(mut self, max: usize) -> Self {
        self.max_results = Some(max);
        self
    }
    
    /// Add file pattern to include
    pub fn include_files(mut self, pattern: String) -> Self {
        self.include_patterns.push(pattern);
        self
    }
    
    /// Add file pattern to exclude
    pub fn exclude_files(mut self, pattern: String) -> Self {
        self.exclude_patterns.push(pattern);
        self
    }
    
    /// Search for text in a single file
    pub fn search_file(&self, pattern: &str, file_path: impl AsRef<Path>) -> FileOpResult<Vec<SearchMatch>> {
        let file_path = file_path.as_ref();
        let reader = FileReader::new(file_path)?;
        
        // Create regex matcher
        let mut builder = grep::regex::RegexMatcherBuilder::new();
        builder.case_insensitive(self.case_insensitive);
        builder.whole_word(self.whole_words);
        
        let matcher = builder.build(pattern)
            .map_err(|e| FileOpError::InvalidPattern {
                pattern: pattern.to_string(),
                reason: e.to_string(),
            })?;
        
        // Collect matches
        let matches = Arc::new(Mutex::new(Vec::new()));
        let matches_clone = Arc::clone(&matches);
        let file_path_buf = file_path.to_path_buf();
        
        let mut searcher = SearcherBuilder::new()
            .line_number(true)
            .build();
        
        // Read file content
        let content = reader.read_bytes()?;
        
        searcher.search_slice(&matcher, &content, UTF8(|lnum, line| {
            let mut matches_guard = matches_clone.lock().unwrap();
            
            // Find match positions within the line
            if let Ok(regex_matcher) = matcher.find_iter(line.as_bytes(), |m| {
                matches_guard.push(SearchMatch {
                    file_path: file_path_buf.clone(),
                    line_number: lnum,
                    line_content: line.to_string(),
                    match_start: m.start(),
                    match_end: m.end(),
                });
                true
            }) {
                let _ = regex_matcher;
            }
            
            Ok(true)
        })).map_err(|e| FileOpError::internal(e.to_string()))?;
        
        let matches = matches.lock().unwrap().clone();
        Ok(matches)
    }
    
    /// Search for text across multiple files in directory
    pub fn search_directory(&self, pattern: &str, dir_path: impl AsRef<Path>) -> FileOpResult<Vec<SearchMatch>> {
        let dir_path = dir_path.as_ref();
        let mut all_matches = Vec::new();
        
        // Build file filter
        let include_glob = if !self.include_patterns.is_empty() {
            Some(self.build_globset(&self.include_patterns)?)
        } else {
            None
        };
        
        let exclude_glob = if !self.exclude_patterns.is_empty() {
            Some(self.build_globset(&self.exclude_patterns)?)
        } else {
            None
        };
        
        // Walk directory and search files
        for entry in WalkDir::new(dir_path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            let file_path = entry.path();
            
            // Apply include/exclude filters
            if let Some(ref include) = include_glob {
                if !include.is_match(file_path) {
                    continue;
                }
            }
            
            if let Some(ref exclude) = exclude_glob {
                if exclude.is_match(file_path) {
                    continue;
                }
            }
            
            // Search file
            match self.search_file(pattern, file_path) {
                Ok(mut matches) => {
                    all_matches.append(&mut matches);
                    
                    // Check max results limit
                    if let Some(max) = self.max_results {
                        if all_matches.len() >= max {
                            all_matches.truncate(max);
                            break;
                        }
                    }
                },
                Err(_) => {
                    // Skip files that can't be searched (binary, permission issues, etc.)
                    continue;
                }
            }
        }
        
        Ok(all_matches)
    }
    
    /// Search for multiple patterns using Aho-Corasick algorithm
    pub fn search_multiple_patterns(&self, patterns: &[String], file_path: impl AsRef<Path>) -> FileOpResult<Vec<SearchMatch>> {
        let file_path = file_path.as_ref();
        let reader = FileReader::new(file_path)?;
        let content = reader.read_string()?;
        
        // Build Aho-Corasick automaton
        let mut builder = aho_corasick::AhoCorasickBuilder::new();
        if self.case_insensitive {
            builder.ascii_case_insensitive(true);
        }
        
        let ac = builder.build(patterns)
            .map_err(|e| FileOpError::InvalidPattern {
                pattern: patterns.join(", "),
                reason: e.to_string(),
            })?;
        
        let mut matches = Vec::new();
        let lines: Vec<&str> = content.lines().collect();
        
        for (line_num, line) in lines.iter().enumerate() {
            for mat in ac.find_iter(line) {
                matches.push(SearchMatch {
                    file_path: file_path.to_path_buf(),
                    line_number: (line_num + 1) as u64,
                    line_content: line.to_string(),
                    match_start: mat.start(),
                    match_end: mat.end(),
                });
                
                // Check max results
                if let Some(max) = self.max_results {
                    if matches.len() >= max {
                        return Ok(matches);
                    }
                }
            }
        }
        
        Ok(matches)
    }
    
    /// Build globset from patterns
    fn build_globset(&self, patterns: &[String]) -> FileOpResult<globset::GlobSet> {
        let mut builder = globset::GlobSetBuilder::new();
        
        for pattern in patterns {
            let glob = globset::Glob::new(pattern)
                .map_err(|e| FileOpError::InvalidPattern {
                    pattern: pattern.clone(),
                    reason: e.to_string(),
                })?;
            builder.add(glob);
        }
        
        builder.build()
            .map_err(|e| FileOpError::internal(e.to_string()))
    }
}

impl Default for TextSearcher {
    fn default() -> Self {
        Self::new()
    }
}

/// Convenience function for simple text search
pub fn search_text_in_file(pattern: &str, file_path: impl AsRef<Path>) -> FileOpResult<Vec<SearchMatch>> {
    let searcher = TextSearcher::new();
    searcher.search_file(pattern, file_path)
}

/// Convenience function for directory text search
pub fn search_text_in_directory(pattern: &str, dir_path: impl AsRef<Path>) -> FileOpResult<Vec<SearchMatch>> {
    let searcher = TextSearcher::new();
    searcher.search_directory(pattern, dir_path)
}

/// Search statistics
#[derive(Debug, Clone)]
pub struct SearchStats {
    pub files_searched: usize,
    pub matches_found: usize,
    pub total_lines: usize,
    pub search_time_ms: u64,
}

/// Advanced searcher with statistics and parallel processing
pub struct AdvancedTextSearcher {
    searcher: TextSearcher,
}

impl AdvancedTextSearcher {
    /// Create new advanced searcher
    pub fn new() -> Self {
        Self {
            searcher: TextSearcher::new(),
        }
    }
    
    /// Configure the underlying searcher
    pub fn configure<F>(mut self, config: F) -> Self
    where
        F: FnOnce(TextSearcher) -> TextSearcher,
    {
        self.searcher = config(self.searcher);
        self
    }
    
    /// Search with statistics tracking
    pub fn search_with_stats(&self, pattern: &str, dir_path: impl AsRef<Path>) -> FileOpResult<(Vec<SearchMatch>, SearchStats)> {
        let start_time = std::time::Instant::now();
        let matches = self.searcher.search_directory(pattern, dir_path)?;
        let elapsed = start_time.elapsed();
        
        let stats = SearchStats {
            files_searched: 0, // TODO: Track this
            matches_found: matches.len(),
            total_lines: 0,    // TODO: Track this
            search_time_ms: elapsed.as_millis() as u64,
        };
        
        Ok((matches, stats))
    }
}

impl Default for AdvancedTextSearcher {
    fn default() -> Self {
        Self::new()
    }
}