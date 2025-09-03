//! Fast glob pattern matching for file filtering
//! 
//! Provides efficient glob pattern matching capabilities for
//! file filtering in search operations.

use crate::error::{FileOpError, FileOpResult};
use globset::{Glob, GlobBuilder, GlobSet, GlobSetBuilder};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

/// Glob matcher for file pattern matching
pub struct GlobMatcher {
    include_set: Option<GlobSet>,
    exclude_set: Option<GlobSet>,
    case_insensitive: bool,
}

impl GlobMatcher {
    /// Create new glob matcher
    pub fn new() -> Self {
        Self {
            include_set: None,
            exclude_set: None,
            case_insensitive: false,
        }
    }
    
    /// Set case insensitive matching
    pub fn case_insensitive(mut self, enabled: bool) -> Self {
        self.case_insensitive = enabled;
        self
    }
    
    /// Add include patterns
    pub fn include_patterns(mut self, patterns: &[String]) -> FileOpResult<Self> {
        if !patterns.is_empty() {
            self.include_set = Some(self.build_globset(patterns)?);
        }
        Ok(self)
    }
    
    /// Add exclude patterns
    pub fn exclude_patterns(mut self, patterns: &[String]) -> FileOpResult<Self> {
        if !patterns.is_empty() {
            self.exclude_set = Some(self.build_globset(patterns)?);
        }
        Ok(self)
    }
    
    /// Check if path matches include/exclude rules
    pub fn is_match(&self, path: impl AsRef<Path>) -> bool {
        let path = path.as_ref();
        
        // Check exclude patterns first
        if let Some(ref exclude) = self.exclude_set {
            if exclude.is_match(path) {
                return false;
            }
        }
        
        // Check include patterns
        if let Some(ref include) = self.include_set {
            include.is_match(path)
        } else {
            // No include patterns means include all (except excluded)
            true
        }
    }
    
    /// Find all matching files in directory
    pub fn find_files(&self, directory: impl AsRef<Path>) -> FileOpResult<Vec<PathBuf>> {
        let directory = directory.as_ref();
        let mut matching_files = Vec::new();
        
        for entry in WalkDir::new(directory)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            let path = entry.path();
            if self.is_match(path) {
                matching_files.push(path.to_path_buf());
            }
        }
        
        Ok(matching_files)
    }
    
    /// Find matching directories
    pub fn find_directories(&self, directory: impl AsRef<Path>) -> FileOpResult<Vec<PathBuf>> {
        let directory = directory.as_ref();
        let mut matching_dirs = Vec::new();
        
        for entry in WalkDir::new(directory)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_dir())
        {
            let path = entry.path();
            if self.is_match(path) {
                matching_dirs.push(path.to_path_buf());
            }
        }
        
        Ok(matching_dirs)
    }
    
    /// Build globset from patterns
    fn build_globset(&self, patterns: &[String]) -> FileOpResult<GlobSet> {
        let mut builder = GlobSetBuilder::new();
        
        for pattern in patterns {
            let mut glob_builder = GlobBuilder::new(pattern);
            glob_builder.case_insensitive(self.case_insensitive);
            
            let glob = glob_builder.build()
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

impl Default for GlobMatcher {
    fn default() -> Self {
        Self::new()
    }
}

/// Builder for creating glob matchers with fluent API
pub struct GlobMatcherBuilder {
    include_patterns: Vec<String>,
    exclude_patterns: Vec<String>,
    case_insensitive: bool,
}

impl GlobMatcherBuilder {
    /// Create new builder
    pub fn new() -> Self {
        Self {
            include_patterns: Vec::new(),
            exclude_patterns: Vec::new(),
            case_insensitive: false,
        }
    }
    
    /// Add include pattern
    pub fn include(mut self, pattern: impl Into<String>) -> Self {
        self.include_patterns.push(pattern.into());
        self
    }
    
    /// Add multiple include patterns
    pub fn include_many<I, S>(mut self, patterns: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        self.include_patterns.extend(patterns.into_iter().map(Into::into));
        self
    }
    
    /// Add exclude pattern
    pub fn exclude(mut self, pattern: impl Into<String>) -> Self {
        self.exclude_patterns.push(pattern.into());
        self
    }
    
    /// Add multiple exclude patterns
    pub fn exclude_many<I, S>(mut self, patterns: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        self.exclude_patterns.extend(patterns.into_iter().map(Into::into));
        self
    }
    
    /// Set case insensitive matching
    pub fn case_insensitive(mut self, enabled: bool) -> Self {
        self.case_insensitive = enabled;
        self
    }
    
    /// Build the glob matcher
    pub fn build(self) -> FileOpResult<GlobMatcher> {
        GlobMatcher::new()
            .case_insensitive(self.case_insensitive)
            .include_patterns(&self.include_patterns)?
            .exclude_patterns(&self.exclude_patterns)
    }
}

impl Default for GlobMatcherBuilder {
    fn default() -> Self {
        Self::new()
    }
}

/// Predefined glob patterns for common file types
pub struct CommonPatterns;

impl CommonPatterns {
    /// Source code files
    pub fn source_code() -> Vec<String> {
        vec![
            "*.rs".to_string(),
            "*.py".to_string(),
            "*.js".to_string(),
            "*.ts".to_string(),
            "*.jsx".to_string(),
            "*.tsx".to_string(),
            "*.c".to_string(),
            "*.cpp".to_string(),
            "*.h".to_string(),
            "*.hpp".to_string(),
            "*.java".to_string(),
            "*.go".to_string(),
            "*.rb".to_string(),
            "*.php".to_string(),
            "*.cs".to_string(),
            "*.swift".to_string(),
        ]
    }
    
    /// Configuration files
    pub fn config_files() -> Vec<String> {
        vec![
            "*.toml".to_string(),
            "*.yaml".to_string(),
            "*.yml".to_string(),
            "*.json".to_string(),
            "*.xml".to_string(),
            "*.ini".to_string(),
            "*.conf".to_string(),
            "*.cfg".to_string(),
            "*.env".to_string(),
        ]
    }
    
    /// Documentation files
    pub fn documentation() -> Vec<String> {
        vec![
            "*.md".to_string(),
            "*.rst".to_string(),
            "*.txt".to_string(),
            "*.adoc".to_string(),
            "README*".to_string(),
            "CHANGELOG*".to_string(),
            "LICENSE*".to_string(),
        ]
    }
    
    /// Hidden files and directories
    pub fn hidden() -> Vec<String> {
        vec![
            ".*".to_string(),
            ".*/".to_string(),
        ]
    }
    
    /// Version control files
    pub fn version_control() -> Vec<String> {
        vec![
            ".git/**".to_string(),
            ".svn/**".to_string(),
            ".hg/**".to_string(),
            ".bzr/**".to_string(),
        ]
    }
    
    /// Build artifacts
    pub fn build_artifacts() -> Vec<String> {
        vec![
            "target/**".to_string(),
            "build/**".to_string(),
            "dist/**".to_string(),
            "out/**".to_string(),
            "*.o".to_string(),
            "*.so".to_string(),
            "*.dll".to_string(),
            "*.exe".to_string(),
        ]
    }
}

/// Convenience function for simple glob matching
pub fn glob_files(directory: impl AsRef<Path>, pattern: &str) -> FileOpResult<Vec<PathBuf>> {
    let matcher = GlobMatcherBuilder::new()
        .include(pattern)
        .build()?;
    
    matcher.find_files(directory)
}

/// Convenience function for multiple patterns
pub fn glob_files_multi(directory: impl AsRef<Path>, patterns: &[String]) -> FileOpResult<Vec<PathBuf>> {
    let matcher = GlobMatcherBuilder::new()
        .include_many(patterns.iter().cloned())
        .build()?;
    
    matcher.find_files(directory)
}