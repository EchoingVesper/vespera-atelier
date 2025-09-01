//! File operation strategy selection based on file size and access patterns
//! 
//! Automatically chooses optimal I/O strategy for different file sizes and use cases:
//! - Small files (< 1MB): Buffered I/O
//! - Medium files (1MB - 16MB): Memory mapping  
//! - Large files (> 16MB): Streaming with chunks

use crate::error::{FileOpError, FileOpResult};
use memmap2::Mmap;
use std::fs::File;
use std::io::{BufReader, BufWriter};
use std::path::Path;

/// File size thresholds for strategy selection
pub const SMALL_FILE_THRESHOLD: u64 = 1024 * 1024;        // 1MB
pub const MEDIUM_FILE_THRESHOLD: u64 = 16 * 1024 * 1024;  // 16MB
pub const CHUNK_SIZE: usize = 8 * 1024 * 1024;            // 8MB chunks

/// File access strategy based on size and usage patterns
pub enum FileStrategy {
    /// Buffered I/O for small files
    Buffered {
        reader: Option<BufReader<File>>,
        writer: Option<BufWriter<File>>,
    },
    
    /// Memory-mapped access for medium files
    MemoryMapped {
        file: File,
        mmap: Mmap,
    },
    
    /// Streaming access with chunks for large files
    Streaming {
        file: File,
        mmap: Mmap,
        chunk_size: usize,
        current_offset: usize,
    },
}

impl FileStrategy {
    /// Create optimal strategy for reading a file
    pub fn optimal_for_read(path: impl AsRef<Path>) -> FileOpResult<Self> {
        let path = path.as_ref();
        let file = File::open(path)
            .map_err(|e| FileOpError::from_io_with_path(e, path.display().to_string()))?;
        
        let metadata = file.metadata()
            .map_err(|e| FileOpError::from_io_with_path(e, path.display().to_string()))?;
        
        let size = metadata.len();
        
        match size {
            0..SMALL_FILE_THRESHOLD => Ok(Self::Buffered {
                reader: Some(BufReader::new(file)),
                writer: None,
            }),
            
            SMALL_FILE_THRESHOLD..MEDIUM_FILE_THRESHOLD => {
                let mmap = unsafe { 
                    Mmap::map(&file)
                        .map_err(|e| FileOpError::from_io_with_path(e, path.display().to_string()))?
                };
                Ok(Self::MemoryMapped { file, mmap })
            },
            
            _ => {
                let mmap = unsafe {
                    Mmap::map(&file)
                        .map_err(|e| FileOpError::from_io_with_path(e, path.display().to_string()))?
                };
                Ok(Self::Streaming {
                    file,
                    mmap,
                    chunk_size: CHUNK_SIZE,
                    current_offset: 0,
                })
            }
        }
    }
    
    /// Create optimal strategy for writing a file
    pub fn optimal_for_write(path: impl AsRef<Path>) -> FileOpResult<Self> {
        let path = path.as_ref();
        let file = File::create(path)
            .map_err(|e| FileOpError::from_io_with_path(e, path.display().to_string()))?;
        
        Ok(Self::Buffered {
            reader: None,
            writer: Some(BufWriter::new(file)),
        })
    }
    
    /// Get the underlying file reference
    pub fn file(&self) -> &File {
        match self {
            Self::Buffered { reader: Some(reader), .. } => reader.get_ref(),
            Self::Buffered { writer: Some(writer), .. } => writer.get_ref(), 
            Self::MemoryMapped { file, .. } => file,
            Self::Streaming { file, .. } => file,
            _ => panic!("Invalid FileStrategy state"),
        }
    }
    
    /// Get memory-mapped data if available
    pub fn mmap(&self) -> Option<&Mmap> {
        match self {
            Self::MemoryMapped { mmap, .. } => Some(mmap),
            Self::Streaming { mmap, .. } => Some(mmap),
            _ => None,
        }
    }
    
    /// Check if strategy is suitable for large file operations
    pub fn is_large_file(&self) -> bool {
        matches!(self, Self::Streaming { .. })
    }
    
    /// Get recommended chunk size for processing
    pub fn chunk_size(&self) -> usize {
        match self {
            Self::Streaming { chunk_size, .. } => *chunk_size,
            _ => CHUNK_SIZE,
        }
    }
}

/// File size classification for strategy hints
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum FileSizeClass {
    Small,    // < 1MB
    Medium,   // 1MB - 16MB  
    Large,    // > 16MB
}

impl FileSizeClass {
    /// Classify file size
    pub fn from_size(size: u64) -> Self {
        match size {
            0..SMALL_FILE_THRESHOLD => Self::Small,
            SMALL_FILE_THRESHOLD..MEDIUM_FILE_THRESHOLD => Self::Medium,
            _ => Self::Large,
        }
    }
    
    /// Get recommended strategy for size class
    pub fn recommended_strategy(&self) -> &'static str {
        match self {
            Self::Small => "buffered",
            Self::Medium => "memory_mapped", 
            Self::Large => "streaming",
        }
    }
}