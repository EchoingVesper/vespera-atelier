//! High-performance file reading with automatic strategy optimization
//! 
//! Provides unified interface for reading files with optimal performance
//! based on file size and access patterns.

use crate::error::{EditError, Result};
use crate::io::strategy::{FileStrategy, FileSizeClass};
use crate::types::EditConfig;
// use std::io::Read; // Not needed for current implementation
use std::path::Path;

// Legacy type aliases for compatibility
type FileOpError = EditError;
type FileOpResult<T> = Result<T>;

pub struct FileReader {
    strategy: FileStrategy,
    path: String,
    config: EditConfig,
}

impl FileReader {
    /// Create a new file reader with optimal strategy
    pub fn new(path: impl AsRef<Path>) -> FileOpResult<Self> {
        Self::with_config(path, EditConfig::default())
    }

    /// Create a new file reader with custom configuration
    pub fn with_config(path: impl AsRef<Path>, config: EditConfig) -> FileOpResult<Self> {
        let path_ref = path.as_ref();
        
        // Check file size against configuration limits
        let metadata = std::fs::metadata(path_ref)
            .map_err(|e| EditError::from_io_with_path(e, path_ref.display().to_string()))?;
        
        if metadata.len() > config.max_file_size {
            return Err(EditError::file_too_large(
                metadata.len(),
                config.max_file_size,
                path_ref.display().to_string(),
            ));
        }
        
        let strategy = FileStrategy::optimal_for_read(path_ref)?;
        
        Ok(Self {
            strategy,
            path: path_ref.display().to_string(),
            config,
        })
    }
    
    /// Read entire file content as bytes
    pub fn read_bytes(&self) -> FileOpResult<Vec<u8>> {
        match &self.strategy {
            FileStrategy::Buffered { reader: Some(_reader), .. } => {
                // For buffered reads, we'll read through the file system for now
                // A more optimized version could use the BufReader directly
                std::fs::read(&self.path)
                    .map_err(|e| EditError::from_io_with_path(e, &self.path))
            },
            
            FileStrategy::MemoryMapped { mmap, .. } => {
                Ok(mmap.to_vec())
            },
            
            FileStrategy::Streaming { mmap, .. } => {
                // For streaming, still return all data but could be optimized
                // for partial reading in the future
                Ok(mmap.to_vec())
            },
            
            _ => Err(EditError::internal("Invalid reader state", None)),
        }
    }
    
    /// Read file content as UTF-8 string
    pub fn read_string(&self) -> FileOpResult<String> {
        let bytes = self.read_bytes()?;
        
        if self.config.validate_utf8 {
            match String::from_utf8(bytes) {
                Ok(mut content) => {
                    if self.config.normalize_unicode {
                        // Basic Unicode normalization (could be enhanced with unicode-normalization crate)
                        content = content.chars().collect::<String>();
                    }
                    Ok(content)
                }
                Err(e) => {
                    let error_pos = e.utf8_error().valid_up_to();
                    Err(EditError::encoding_error(
                        error_pos,
                        format!("Invalid UTF-8 at position {}: {}", error_pos, e.utf8_error()),
                        Some(self.path.clone()),
                    ))
                }
            }
        } else {
            // Use lossy conversion if UTF-8 validation is disabled
            Ok(String::from_utf8_lossy(&bytes).into_owned())
        }
    }
    
    /// Read file content line by line
    pub fn read_lines(&self) -> FileOpResult<Vec<String>> {
        match &self.strategy {
            FileStrategy::Buffered { reader: Some(_reader), .. } => {
                let content = self.read_string()?;
                Ok(content.lines().map(String::from).collect())
            },
            
            FileStrategy::MemoryMapped { mmap, .. } |
            FileStrategy::Streaming { mmap, .. } => {
                let content = std::str::from_utf8(mmap)
                    .map_err(|e| EditError::encoding_error(
                        e.valid_up_to(),
                        format!("Invalid UTF-8: {}", e),
                        Some(self.path.clone()),
                    ))?;
                Ok(content.lines().map(String::from).collect())
            },
            
            _ => Err(EditError::internal("Invalid reader state", None)),
        }
    }
    
    /// Read file in chunks with callback for processing
    pub fn read_chunks<F>(&self, chunk_size: usize, mut callback: F) -> FileOpResult<()>
    where
        F: FnMut(&[u8]) -> FileOpResult<()>,
    {
        match &self.strategy {
            FileStrategy::Buffered { reader: Some(_reader), .. } => {
                // For simplicity, read entire file and chunk it
                let bytes = self.read_bytes()?;
                for chunk in bytes.chunks(chunk_size) {
                    callback(chunk)?;
                }
                Ok(())
            },
            
            FileStrategy::MemoryMapped { mmap, .. } |
            FileStrategy::Streaming { mmap, .. } => {
                for chunk in mmap.chunks(chunk_size) {
                    callback(chunk)?;
                }
                Ok(())
            },
            
            _ => Err(EditError::internal("Invalid reader state", None)),
        }
    }
    
    /// Get file size and classification
    pub fn file_info(&self) -> FileOpResult<(u64, FileSizeClass)> {
        let metadata = self.strategy.file().metadata()
            .map_err(|e| FileOpError::from_io_with_path(e, &self.path))?;
        
        let size = metadata.len();
        let class = FileSizeClass::from_size(size);
        
        Ok((size, class))
    }
    
    /// Check if file exists and is readable
    pub fn is_readable(&self) -> bool {
        Path::new(&self.path).exists() && 
        self.strategy.file().metadata().is_ok()
    }
    
    /// Get the file path
    pub fn path(&self) -> &str {
        &self.path
    }

    /// Get the configuration
    pub fn config(&self) -> &EditConfig {
        &self.config
    }

    /// Read file content optimized for editing operations
    pub fn read_for_editing(&self) -> FileOpResult<String> {
        let content = self.read_string()?;
        
        // Check memory usage limit
        if content.len() > self.config.max_memory_usage {
            return Err(EditError::out_of_memory(
                content.len(),
                "reading file for editing",
            ));
        }
        
        Ok(content)
    }

    /// Check if file is suitable for in-memory editing based on configuration
    pub fn is_suitable_for_editing(&self) -> FileOpResult<bool> {
        let (size, _) = self.file_info()?;
        
        Ok(size <= self.config.max_file_size as u64 && 
           size as usize <= self.config.max_memory_usage)
    }
}

/// Convenience function for reading file content as string
pub fn read_to_string(path: impl AsRef<Path>) -> FileOpResult<String> {
    let reader = FileReader::new(path)?;
    reader.read_string()
}

/// Convenience function for reading file content as bytes  
pub fn read_to_bytes(path: impl AsRef<Path>) -> FileOpResult<Vec<u8>> {
    let reader = FileReader::new(path)?;
    reader.read_bytes()
}

/// Convenience function for reading file lines
pub fn read_lines(path: impl AsRef<Path>) -> FileOpResult<Vec<String>> {
    let reader = FileReader::new(path)?;
    reader.read_lines()
}

/// Convenience function for reading file content optimized for editing
pub fn read_for_editing(path: impl AsRef<Path>) -> FileOpResult<String> {
    let reader = FileReader::new(path)?;
    reader.read_for_editing()
}

/// Convenience function for reading file with custom configuration
pub fn read_with_config(path: impl AsRef<Path>, config: EditConfig) -> FileOpResult<String> {
    let reader = FileReader::with_config(path, config)?;
    reader.read_for_editing()
}