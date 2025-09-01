//! File system monitoring for real-time change detection
//! 
//! Provides efficient file system watching capabilities for MCP server
//! integration with automatic change detection and notification.

use crate::error::{FileOpError, FileOpResult};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};
use walkdir::WalkDir;

/// File system change event
#[derive(Debug, Clone)]
pub enum FileEvent {
    Created { path: PathBuf },
    Modified { path: PathBuf, size: u64 },
    Deleted { path: PathBuf },
    Renamed { from: PathBuf, to: PathBuf },
}

/// File system watcher for monitoring changes
pub struct FileWatcher {
    watched_paths: Vec<PathBuf>,
    last_scan: SystemTime,
}

impl FileWatcher {
    /// Create a new file watcher
    pub fn new() -> Self {
        Self {
            watched_paths: Vec::new(),
            last_scan: SystemTime::now(),
        }
    }
    
    /// Add path to watch list
    pub fn watch(&mut self, path: impl AsRef<Path>) -> FileOpResult<()> {
        let path = path.as_ref().to_path_buf();
        
        if !path.exists() {
            return Err(FileOpError::NotFound {
                path: path.display().to_string(),
            });
        }
        
        self.watched_paths.push(path);
        Ok(())
    }
    
    /// Remove path from watch list
    pub fn unwatch(&mut self, path: impl AsRef<Path>) {
        let path = path.as_ref();
        self.watched_paths.retain(|p| p != path);
    }
    
    /// Poll for changes since last check
    pub fn poll_changes(&mut self) -> FileOpResult<Vec<FileEvent>> {
        let current_time = SystemTime::now();
        let mut events = Vec::new();
        
        for watch_path in &self.watched_paths {
            if watch_path.is_file() {
                // Check single file
                if let Ok(metadata) = watch_path.metadata() {
                    if let Ok(modified) = metadata.modified() {
                        if modified > self.last_scan {
                            events.push(FileEvent::Modified {
                                path: watch_path.clone(),
                                size: metadata.len(),
                            });
                        }
                    }
                }
            } else if watch_path.is_dir() {
                // Check directory recursively
                for entry in WalkDir::new(watch_path)
                    .into_iter()
                    .filter_map(|e| e.ok())
                {
                    let path = entry.path();
                    if let Ok(metadata) = path.metadata() {
                        if let Ok(modified) = metadata.modified() {
                            if modified > self.last_scan {
                                events.push(FileEvent::Modified {
                                    path: path.to_path_buf(),
                                    size: metadata.len(),
                                });
                            }
                        }
                    }
                }
            }
        }
        
        self.last_scan = current_time;
        Ok(events)
    }
    
    /// Get list of watched paths
    pub fn watched_paths(&self) -> &[PathBuf] {
        &self.watched_paths
    }
    
    /// Clear all watched paths
    pub fn clear(&mut self) {
        self.watched_paths.clear();
        self.last_scan = SystemTime::now();
    }
}

impl Default for FileWatcher {
    fn default() -> Self {
        Self::new()
    }
}

/// File metadata snapshot for change detection
#[derive(Debug, Clone)]
pub struct FileSnapshot {
    pub path: PathBuf,
    pub size: u64,
    pub modified: SystemTime,
    pub is_file: bool,
}

impl FileSnapshot {
    /// Create snapshot from path
    pub fn from_path(path: impl AsRef<Path>) -> FileOpResult<Self> {
        let path = path.as_ref().to_path_buf();
        let metadata = path.metadata()
            .map_err(|e| FileOpError::from_io_with_path(e, path.display().to_string()))?;
        
        Ok(Self {
            path: path.clone(),
            size: metadata.len(),
            modified: metadata.modified()
                .map_err(|e| FileOpError::from_io_with_path(e, path.display().to_string()))?,
            is_file: metadata.is_file(),
        })
    }
    
    /// Check if snapshot differs from current file state
    pub fn has_changed(&self) -> bool {
        if let Ok(current) = Self::from_path(&self.path) {
            self.size != current.size || self.modified != current.modified
        } else {
            true // File was deleted
        }
    }
}

/// Directory scanner for batch file operations
pub struct DirectoryScanner {
    patterns: Vec<globset::Glob>,
}

impl DirectoryScanner {
    /// Create new scanner
    pub fn new() -> Self {
        Self {
            patterns: Vec::new(),
        }
    }
    
    /// Add glob pattern to include
    pub fn include(&mut self, pattern: &str) -> FileOpResult<()> {
        let glob = globset::Glob::new(pattern)?;
        self.patterns.push(glob);
        Ok(())
    }
    
    /// Scan directory with patterns
    pub fn scan(&self, path: impl AsRef<Path>) -> FileOpResult<Vec<PathBuf>> {
        let mut results = Vec::new();
        
        if self.patterns.is_empty() {
            // No patterns, return all files
            for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
                if entry.file_type().is_file() {
                    results.push(entry.path().to_path_buf());
                }
            }
        } else {
            // Match against patterns
            let globset = globset::GlobSetBuilder::new()
                .extend(self.patterns.iter())
                .build()?;
            
            for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
                let path = entry.path();
                if entry.file_type().is_file() && globset.is_match(path) {
                    results.push(path.to_path_buf());
                }
            }
        }
        
        Ok(results)
    }
}

impl Default for DirectoryScanner {
    fn default() -> Self {
        Self::new()
    }
}