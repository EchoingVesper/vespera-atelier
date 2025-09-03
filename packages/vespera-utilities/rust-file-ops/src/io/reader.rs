//! High-performance file reading with automatic strategy optimization
//! 
//! Provides unified interface for reading files with optimal performance
//! based on file size and access patterns.

use crate::error::{FileOpError, FileOpResult};
use crate::io::strategy::{FileStrategy, FileSizeClass};
use std::io::{Read, BufRead};
use std::path::Path;

pub struct FileReader {
    strategy: FileStrategy,
    path: String,
}

impl FileReader {
    /// Create a new file reader with optimal strategy
    pub fn new(path: impl AsRef<Path>) -> FileOpResult<Self> {
        let path_ref = path.as_ref();
        let strategy = FileStrategy::optimal_for_read(path_ref)?;
        
        Ok(Self {
            strategy,
            path: path_ref.display().to_string(),
        })
    }
    
    /// Read entire file content as bytes
    pub fn read_bytes(&self) -> FileOpResult<Vec<u8>> {
        match &self.strategy {
            FileStrategy::Buffered { reader: Some(reader), .. } => {
                let mut reader = reader;
                let mut buffer = Vec::new();
                reader.read_to_end(&mut buffer)
                    .map_err(|e| FileOpError::from_io_with_path(e, &self.path))?;
                Ok(buffer)
            },
            
            FileStrategy::MemoryMapped { mmap, .. } => {
                Ok(mmap.to_vec())
            },
            
            FileStrategy::Streaming { mmap, .. } => {
                // For streaming, still return all data but could be optimized
                // for partial reading in the future
                Ok(mmap.to_vec())
            },
            
            _ => Err(FileOpError::internal("Invalid reader state")),
        }
    }
    
    /// Read file content as UTF-8 string
    pub fn read_string(&self) -> FileOpResult<String> {
        let bytes = self.read_bytes()?;
        String::from_utf8(bytes)
            .map_err(|e| FileOpError::encoding_error(&self.path, e.to_string()))
    }
    
    /// Read file content line by line
    pub fn read_lines(&self) -> FileOpResult<Vec<String>> {
        match &self.strategy {
            FileStrategy::Buffered { reader: Some(reader), .. } => {
                // Need to handle the BufReader properly
                let content = self.read_string()?;
                Ok(content.lines().map(String::from).collect())
            },
            
            FileStrategy::MemoryMapped { mmap, .. } |
            FileStrategy::Streaming { mmap, .. } => {
                let content = std::str::from_utf8(mmap)
                    .map_err(|e| FileOpError::encoding_error(&self.path, e.to_string()))?;
                Ok(content.lines().map(String::from).collect())
            },
            
            _ => Err(FileOpError::internal("Invalid reader state")),
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
            
            _ => Err(FileOpError::internal("Invalid reader state")),
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