//! High-performance file writing with atomic operations and safety guarantees
//! 
//! Provides unified interface for writing files with automatic flushing,
//! atomic operations, and error recovery.

use crate::error::{EditError, Result};
use crate::io::strategy::FileStrategy;
use crate::security::validate_path;
use crate::types::EditConfig;
use std::fs;
use std::io::{Write, BufWriter};
use std::path::{Path, PathBuf};

// Legacy type aliases for compatibility
#[allow(dead_code)]
type FileOpError = EditError;
type FileOpResult<T> = Result<T>;

pub struct FileWriter {
    strategy: FileStrategy,
    path: PathBuf,
    config: EditConfig,
}

impl FileWriter {
    /// Create a new file writer
    pub fn new(path: impl AsRef<Path>) -> FileOpResult<Self> {
        Self::with_config(path, EditConfig::default())
    }

    /// Create a new file writer with custom configuration
    pub fn with_config(path: impl AsRef<Path>, config: EditConfig) -> FileOpResult<Self> {
        let path = path.as_ref();
        
        // Validate path security
        let validated_path = if let Some(ref base_dir) = config.base_dir {
            validate_path(path, Some(base_dir))?
        } else {
            validate_path(path, None)?
        };
        
        // Ensure parent directory exists
        if let Some(parent) = validated_path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)
                    .map_err(|e| EditError::from_io_with_path(e, parent.display().to_string()))?;
            }
        }
        
        let strategy = FileStrategy::optimal_for_write(&validated_path)?;
        
        Ok(Self { strategy, path: validated_path, config })
    }
    
    /// Write bytes to file
    pub fn write_bytes(&mut self, data: &[u8]) -> FileOpResult<()> {
        // Check memory usage limit
        if data.len() > self.config.max_memory_usage {
            return Err(EditError::out_of_memory(
                data.len(),
                "writing data to file",
            ));
        }

        match &mut self.strategy {
            FileStrategy::Buffered { writer: Some(writer), .. } => {
                writer.write_all(data)
                    .map_err(|e| EditError::from_io_with_path(e, self.path.display().to_string()))?;
                writer.flush()
                    .map_err(|e| EditError::from_io_with_path(e, self.path.display().to_string()))?;
                Ok(())
            },
            _ => Err(EditError::internal("Invalid writer state", None)),
        }
    }
    
    /// Write string to file
    pub fn write_string(&mut self, content: &str) -> FileOpResult<()> {
        // Validate UTF-8 if required
        if self.config.validate_utf8 {
            // String is already UTF-8, but we can do additional validation
            if !content.is_ascii() && content.chars().any(|c| c.is_control() && c != '\n' && c != '\r' && c != '\t') {
                return Err(EditError::encoding_error(
                    0,
                    "Content contains potentially problematic control characters".to_string(),
                    Some(self.path.display().to_string()),
                ));
            }
        }
        
        self.write_bytes(content.as_bytes())
    }
    
    /// Write lines to file
    pub fn write_lines<I, S>(&mut self, lines: I) -> FileOpResult<()>
    where
        I: IntoIterator<Item = S>,
        S: AsRef<str>,
    {
        for line in lines {
            self.write_string(line.as_ref())?;
            self.write_string("\n")?;
        }
        Ok(())
    }
    
    /// Append bytes to file
    pub fn append_bytes(&mut self, data: &[u8]) -> FileOpResult<()> {
        // For append operations, we need to reopen in append mode
        use std::fs::OpenOptions;
        
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path)
            .map_err(|e| EditError::from_io_with_path(e, self.path.display().to_string()))?;
        
        file.write_all(data)
            .map_err(|e| EditError::from_io_with_path(e, self.path.display().to_string()))?;
        
        file.flush()
            .map_err(|e| EditError::from_io_with_path(e, self.path.display().to_string()))?;
        
        Ok(())
    }
    
    /// Append string to file
    pub fn append_string(&mut self, content: &str) -> FileOpResult<()> {
        self.append_bytes(content.as_bytes())
    }
    
    /// Get the file path
    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Get the configuration
    pub fn config(&self) -> &EditConfig {
        &self.config
    }

    /// Write content optimized for editing results
    pub fn write_edit_result(&mut self, content: &str) -> FileOpResult<()> {
        // Additional validation for edit results
        if content.len() as u64 > self.config.max_file_size {
            return Err(EditError::file_too_large(
                content.len() as u64,
                self.config.max_file_size,
                self.path.display().to_string(),
            ));
        }

        self.write_string(content)
    }

    /// Check if the writer can handle content of given size
    pub fn can_handle_size(&self, size: usize) -> bool {
        size <= self.config.max_memory_usage && 
        size as u64 <= self.config.max_file_size
    }
}

/// Atomic file writer that writes to temporary file then moves
pub struct AtomicFileWriter {
    temp_path: PathBuf,
    final_path: PathBuf,
    writer: Option<BufWriter<fs::File>>,
}

impl AtomicFileWriter {
    /// Create new atomic writer
    pub fn new(path: impl AsRef<Path>) -> FileOpResult<Self> {
        let final_path = path.as_ref().to_path_buf();
        let temp_path = final_path.with_extension("tmp");
        
        // Ensure parent directory exists
        if let Some(parent) = final_path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)
                    .map_err(|e| EditError::from_io_with_path(e, parent.display().to_string()))?;
            }
        }
        
        let file = fs::File::create(&temp_path)
            .map_err(|e| EditError::from_io_with_path(e, temp_path.display().to_string()))?;
        
        let writer = BufWriter::new(file);
        
        Ok(Self {
            temp_path,
            final_path,
            writer: Some(writer),
        })
    }
    
    /// Write data to temporary file
    pub fn write(&mut self, data: &[u8]) -> FileOpResult<()> {
        if let Some(ref mut writer) = self.writer {
            writer.write_all(data)
                .map_err(|e| EditError::from_io_with_path(e, self.temp_path.display().to_string()))?;
        } else {
            return Err(EditError::internal("Writer already committed or cancelled", None));
        }
        Ok(())
    }
    
    /// Write string to temporary file
    pub fn write_str(&mut self, content: &str) -> FileOpResult<()> {
        self.write(content.as_bytes())
    }
    
    /// Commit the atomic write (flush and rename)
    pub fn commit(mut self) -> FileOpResult<()> {
        // Take the writer and flush it
        if let Some(mut writer) = self.writer.take() {
            use std::io::Write;
            writer.flush()
                .map_err(|e| EditError::from_io_with_path(e, self.temp_path.display().to_string()))?;
            // Drop the writer to close the file
            drop(writer);
        }
        
        // Atomically move temp file to final location
        fs::rename(&self.temp_path, &self.final_path)
            .map_err(|e| EditError::from_io_with_path(e, self.final_path.display().to_string()))?;
        
        // We've successfully committed, so forget self to prevent Drop cleanup
        std::mem::forget(self);
        
        Ok(())
    }
    
    /// Cancel the write and clean up temporary file
    pub fn cancel(self) -> FileOpResult<()> {
        // Writer will be dropped automatically
        
        if self.temp_path.exists() {
            fs::remove_file(&self.temp_path)
                .map_err(|e| EditError::from_io_with_path(e, self.temp_path.display().to_string()))?;
        }
        
        Ok(())
    }
}

impl Drop for AtomicFileWriter {
    fn drop(&mut self) {
        // Close the writer if it's still open
        if let Some(_writer) = self.writer.take() {
            // Writer will be dropped automatically
        }
        
        // Clean up temp file if not committed
        if self.temp_path.exists() {
            let _ = fs::remove_file(&self.temp_path);
        }
    }
}

/// Convenience function for writing string to file
pub fn write_string(path: impl AsRef<Path>, content: &str) -> FileOpResult<()> {
    let mut writer = FileWriter::new(path)?;
    writer.write_string(content)
}

/// Convenience function for writing bytes to file
pub fn write_bytes(path: impl AsRef<Path>, data: &[u8]) -> FileOpResult<()> {
    let mut writer = FileWriter::new(path)?;
    writer.write_bytes(data)
}

/// Convenience function for atomic write
pub fn write_atomic(path: impl AsRef<Path>, content: &str) -> FileOpResult<()> {
    let mut writer = AtomicFileWriter::new(path)?;
    writer.write_str(content)?;
    writer.commit()
}

/// Convenience function for writing edit result with configuration
pub fn write_edit_result(path: impl AsRef<Path>, content: &str, config: EditConfig) -> FileOpResult<()> {
    let mut writer = FileWriter::with_config(path, config)?;
    writer.write_edit_result(content)
}

/// Convenience function for atomic write with size validation
pub fn write_atomic_safe(path: impl AsRef<Path>, content: &str, max_size: u64) -> FileOpResult<()> {
    if content.len() as u64 > max_size {
        return Err(EditError::file_too_large(
            content.len() as u64,
            max_size,
            path.as_ref().display().to_string(),
        ));
    }
    
    write_atomic(path, content)
}