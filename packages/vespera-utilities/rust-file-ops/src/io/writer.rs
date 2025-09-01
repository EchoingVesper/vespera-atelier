//! High-performance file writing with atomic operations and safety guarantees
//! 
//! Provides unified interface for writing files with automatic flushing,
//! atomic operations, and error recovery.

use crate::error::{FileOpError, FileOpResult};
use crate::io::strategy::FileStrategy;
use std::fs;
use std::io::{Write, BufWriter};
use std::path::{Path, PathBuf};

pub struct FileWriter {
    strategy: FileStrategy,
    path: PathBuf,
}

impl FileWriter {
    /// Create a new file writer
    pub fn new(path: impl AsRef<Path>) -> FileOpResult<Self> {
        let path = path.as_ref().to_path_buf();
        
        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)
                    .map_err(|e| FileOpError::from_io_with_path(e, parent.display().to_string()))?;
            }
        }
        
        let strategy = FileStrategy::optimal_for_write(&path)?;
        
        Ok(Self { strategy, path })
    }
    
    /// Write bytes to file
    pub fn write_bytes(&mut self, data: &[u8]) -> FileOpResult<()> {
        match &mut self.strategy {
            FileStrategy::Buffered { writer: Some(writer), .. } => {
                writer.write_all(data)
                    .map_err(|e| FileOpError::from_io_with_path(e, self.path.display().to_string()))?;
                writer.flush()
                    .map_err(|e| FileOpError::from_io_with_path(e, self.path.display().to_string()))?;
                Ok(())
            },
            _ => Err(FileOpError::internal("Invalid writer state")),
        }
    }
    
    /// Write string to file
    pub fn write_string(&mut self, content: &str) -> FileOpResult<()> {
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
            .map_err(|e| FileOpError::from_io_with_path(e, self.path.display().to_string()))?;
        
        file.write_all(data)
            .map_err(|e| FileOpError::from_io_with_path(e, self.path.display().to_string()))?;
        
        file.flush()
            .map_err(|e| FileOpError::from_io_with_path(e, self.path.display().to_string()))?;
        
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
}

/// Atomic file writer that writes to temporary file then moves
pub struct AtomicFileWriter {
    temp_path: PathBuf,
    final_path: PathBuf,
    writer: BufWriter<fs::File>,
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
                    .map_err(|e| FileOpError::from_io_with_path(e, parent.display().to_string()))?;
            }
        }
        
        let file = fs::File::create(&temp_path)
            .map_err(|e| FileOpError::from_io_with_path(e, temp_path.display().to_string()))?;
        
        let writer = BufWriter::new(file);
        
        Ok(Self {
            temp_path,
            final_path,
            writer,
        })
    }
    
    /// Write data to temporary file
    pub fn write(&mut self, data: &[u8]) -> FileOpResult<()> {
        self.writer.write_all(data)
            .map_err(|e| FileOpError::from_io_with_path(e, self.temp_path.display().to_string()))?;
        Ok(())
    }
    
    /// Write string to temporary file
    pub fn write_str(&mut self, content: &str) -> FileOpResult<()> {
        self.write(content.as_bytes())
    }
    
    /// Commit the atomic write (flush and rename)
    pub fn commit(self) -> FileOpResult<()> {
        // Flush all data and close file
        self.writer.into_inner()
            .map_err(|e| FileOpError::from_io_with_path(e.error(), self.temp_path.display().to_string()))?;
        
        // Atomically move temp file to final location
        fs::rename(&self.temp_path, &self.final_path)
            .map_err(|e| FileOpError::from_io_with_path(e, self.final_path.display().to_string()))?;
        
        Ok(())
    }
    
    /// Cancel the write and clean up temporary file
    pub fn cancel(self) -> FileOpResult<()> {
        // Writer will be dropped automatically
        
        if self.temp_path.exists() {
            fs::remove_file(&self.temp_path)
                .map_err(|e| FileOpError::from_io_with_path(e, self.temp_path.display().to_string()))?;
        }
        
        Ok(())
    }
}

impl Drop for AtomicFileWriter {
    fn drop(&mut self) {
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