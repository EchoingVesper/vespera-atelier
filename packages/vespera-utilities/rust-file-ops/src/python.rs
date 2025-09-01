//! Python bindings for Rust file operations
//! 
//! Exposes all Rust file operation functionality to Python via PyO3
//! with proper error handling and type conversions.

use pyo3::prelude::*;
use pyo3::exceptions::{PyIOError, PyValueError, PyRuntimeError};
use pyo3::types::{PyDict, PyList, PyString};
use std::collections::HashMap;
use std::path::PathBuf;

use crate::error::FileOpError;
use crate::io::{reader, writer};
use crate::search::{text, glob};

/// Python exception type for file operation errors
#[pyclass(extends=pyo3::exceptions::PyException)]
pub struct PyFileOpError {
    #[pyo3(get)]
    pub error_type: String,
    #[pyo3(get)]
    pub message: String,
    #[pyo3(get)]
    pub path: Option<String>,
}

#[pymethods]
impl PyFileOpError {
    #[new]
    fn new(error_type: String, message: String, path: Option<String>) -> Self {
        Self {
            error_type,
            message,
            path,
        }
    }
    
    fn __str__(&self) -> String {
        if let Some(ref path) = self.path {
            format!("{}: {} ({})", self.error_type, self.message, path)
        } else {
            format!("{}: {}", self.error_type, self.message)
        }
    }
}

impl From<FileOpError> for PyErr {
    fn from(error: FileOpError) -> Self {
        match error {
            FileOpError::NotFound { path } => PyIOError::new_err(format!("File not found: {}", path)),
            FileOpError::PermissionDenied { path } => PyIOError::new_err(format!("Permission denied: {}", path)),
            FileOpError::InvalidPath { path } => PyValueError::new_err(format!("Invalid path: {}", path)),
            FileOpError::InvalidPattern { pattern, reason } => PyValueError::new_err(format!("Invalid pattern '{}': {}", pattern, reason)),
            FileOpError::EncodingError { path, reason } => PyValueError::new_err(format!("Encoding error in '{}': {}", path, reason)),
            FileOpError::TooLarge { size, max } => PyValueError::new_err(format!("File too large: {} bytes (max: {})", size, max)),
            _ => PyRuntimeError::new_err(error.to_string()),
        }
    }
}

// File Reading Operations

/// Read file content as bytes
#[pyfunction]
pub fn read_file(path: &str) -> PyResult<Vec<u8>> {
    reader::read_to_bytes(path).map_err(Into::into)
}

/// Read file content as string
#[pyfunction] 
pub fn read_file_string(path: &str) -> PyResult<String> {
    reader::read_to_string(path).map_err(Into::into)
}

/// Read file content in chunks with callback
#[pyfunction]
pub fn read_file_chunked(path: &str, chunk_size: usize, callback: PyObject) -> PyResult<()> {
    let reader = crate::io::FileReader::new(path).map_err(PyErr::from)?;
    
    Python::with_gil(|py| {
        reader.read_chunks(chunk_size, |chunk| {
            let py_bytes = pyo3::types::PyBytes::new(py, chunk);
            callback.call1(py, (py_bytes,))?;
            Ok(())
        }).map_err(PyErr::from)
    })
}

/// Read file lines as list
#[pyfunction]
pub fn read_file_lines(path: &str) -> PyResult<Vec<String>> {
    reader::read_lines(path).map_err(Into::into)
}

// File Writing Operations

/// Write bytes to file
#[pyfunction]
pub fn write_file(path: &str, content: &[u8]) -> PyResult<()> {
    writer::write_bytes(path, content).map_err(Into::into)
}

/// Write string to file
#[pyfunction]
pub fn write_file_string(path: &str, content: &str) -> PyResult<()> {
    writer::write_string(path, content).map_err(Into::into)
}

/// Append content to file
#[pyfunction]
pub fn append_file(path: &str, content: &str) -> PyResult<()> {
    let mut writer = crate::io::FileWriter::new(path).map_err(PyErr::from)?;
    writer.append_string(content).map_err(Into::into)
}

/// Write file atomically (safe replacement)
#[pyfunction]
pub fn write_file_atomic(path: &str, content: &str) -> PyResult<()> {
    writer::write_atomic(path, content).map_err(Into::into)
}

// File Editing Operations

/// Replace text in file using regex
#[pyfunction]
pub fn replace_in_file(path: &str, pattern: &str, replacement: &str, max_replacements: Option<usize>) -> PyResult<usize> {
    let content = reader::read_to_string(path).map_err(PyErr::from)?;
    
    let regex = regex::Regex::new(pattern)
        .map_err(|e| PyValueError::new_err(format!("Invalid regex: {}", e)))?;
    
    // For simplicity, ignore max_replacements for now
    let new_content = regex.replace_all(&content, replacement).to_string();
    let count = regex.find_iter(&content).count();
    
    if count > 0 {
        writer::write_string(path, &new_content).map_err(PyErr::from)?;
    }
    
    Ok(count)
}

/// Edit specific lines in file
#[pyfunction]
pub fn edit_file_lines(path: &str, line_edits: HashMap<usize, String>) -> PyResult<()> {
    let lines = reader::read_lines(path).map_err(PyErr::from)?;
    let mut new_lines = lines;
    
    for (line_num, new_content) in line_edits {
        if line_num > 0 && line_num <= new_lines.len() {
            new_lines[line_num - 1] = new_content;
        }
    }
    
    let mut writer = crate::io::FileWriter::new(path).map_err(PyErr::from)?;
    writer.write_lines(new_lines).map_err(Into::into)
}

// Directory Operations

/// List directory contents
#[pyfunction]
pub fn list_directory(path: &str, recursive: Option<bool>) -> PyResult<Vec<String>> {
    let path = std::path::Path::new(path);
    let mut entries = Vec::new();
    
    if recursive.unwrap_or(false) {
        for entry in walkdir::WalkDir::new(path).into_iter() {
            match entry {
                Ok(entry) => entries.push(entry.path().display().to_string()),
                Err(_) => continue,
            }
        }
    } else {
        for entry in std::fs::read_dir(path).map_err(|e| PyIOError::new_err(e.to_string()))? {
            match entry {
                Ok(entry) => entries.push(entry.path().display().to_string()),
                Err(_) => continue,
            }
        }
    }
    
    Ok(entries)
}

/// Create directory (with parents)
#[pyfunction]
pub fn create_directory(path: &str) -> PyResult<()> {
    std::fs::create_dir_all(path)
        .map_err(|e| PyIOError::new_err(e.to_string()))
}

/// Remove file or directory
#[pyfunction]
pub fn remove_path(path: &str) -> PyResult<()> {
    let path = std::path::Path::new(path);
    if path.is_file() {
        std::fs::remove_file(path)
            .map_err(|e| PyIOError::new_err(e.to_string()))
    } else if path.is_dir() {
        std::fs::remove_dir_all(path)
            .map_err(|e| PyIOError::new_err(e.to_string()))
    } else {
        Err(PyIOError::new_err("Path does not exist"))
    }
}

// Search Operations

/// Search for text in file
#[pyfunction]
pub fn search_text(pattern: &str, file_path: &str, case_insensitive: Option<bool>) -> PyResult<Vec<PyObject>> {
    let searcher = text::TextSearcher::new()
        .case_insensitive(case_insensitive.unwrap_or(false));
    
    let matches = searcher.search_file(pattern, file_path).map_err(PyErr::from)?;
    
    Python::with_gil(|py| {
        let result = matches.into_iter().map(|m| {
            let dict = PyDict::new(py);
            dict.set_item("file_path", m.file_path.display().to_string())?;
            dict.set_item("line_number", m.line_number)?;
            dict.set_item("line_content", m.line_content)?;
            dict.set_item("match_start", m.match_start)?;
            dict.set_item("match_end", m.match_end)?;
            Ok(dict.into())
        }).collect::<PyResult<Vec<_>>>()?;
        
        Ok(result)
    })
}

/// Search for text in directory
#[pyfunction]
pub fn search_files(pattern: &str, directory: &str, include_patterns: Option<Vec<String>>, exclude_patterns: Option<Vec<String>>, case_insensitive: Option<bool>) -> PyResult<Vec<PyObject>> {
    let mut searcher = text::TextSearcher::new()
        .case_insensitive(case_insensitive.unwrap_or(false));
    
    if let Some(includes) = include_patterns {
        for include in includes {
            searcher = searcher.include_files(include);
        }
    }
    
    if let Some(excludes) = exclude_patterns {
        for exclude in excludes {
            searcher = searcher.exclude_files(exclude);
        }
    }
    
    let matches = searcher.search_directory(pattern, directory).map_err(PyErr::from)?;
    
    Python::with_gil(|py| {
        let result = matches.into_iter().map(|m| {
            let dict = PyDict::new(py);
            dict.set_item("file_path", m.file_path.display().to_string())?;
            dict.set_item("line_number", m.line_number)?;
            dict.set_item("line_content", m.line_content)?;
            dict.set_item("match_start", m.match_start)?;
            dict.set_item("match_end", m.match_end)?;
            Ok(dict.into())
        }).collect::<PyResult<Vec<_>>>()?;
        
        Ok(result)
    })
}

/// Find files using glob patterns
#[pyfunction]
pub fn glob_files(directory: &str, include_patterns: Vec<String>, exclude_patterns: Option<Vec<String>>) -> PyResult<Vec<String>> {
    let mut builder = glob::GlobMatcherBuilder::new()
        .include_many(include_patterns);
    
    if let Some(excludes) = exclude_patterns {
        builder = builder.exclude_many(excludes);
    }
    
    let matcher = builder.build().map_err(PyErr::from)?;
    let files = matcher.find_files(directory).map_err(PyErr::from)?;
    
    Ok(files.into_iter().map(|p| p.display().to_string()).collect())
}

// File System Monitoring

/// Watch directory for changes (simplified polling version)
#[pyfunction]
pub fn watch_directory(directory: &str, callback: PyObject) -> PyResult<()> {
    let mut watcher = crate::io::FileWatcher::new();
    watcher.watch(directory).map_err(PyErr::from)?;
    
    // Simple polling loop - in production might want to use inotify/similar
    loop {
        let events = watcher.poll_changes().map_err(PyErr::from)?;
        
        if !events.is_empty() {
            Python::with_gil(|py| {
                let py_events = events.into_iter().map(|event| {
                    let dict = PyDict::new(py);
                    match event {
                        crate::io::watcher::FileEvent::Created { path } => {
                            dict.set_item("type", "created")?;
                            dict.set_item("path", path.display().to_string())?;
                        },
                        crate::io::watcher::FileEvent::Modified { path, size } => {
                            dict.set_item("type", "modified")?;
                            dict.set_item("path", path.display().to_string())?;
                            dict.set_item("size", size)?;
                        },
                        crate::io::watcher::FileEvent::Deleted { path } => {
                            dict.set_item("type", "deleted")?;
                            dict.set_item("path", path.display().to_string())?;
                        },
                        crate::io::watcher::FileEvent::Renamed { from, to } => {
                            dict.set_item("type", "renamed")?;
                            dict.set_item("from", from.display().to_string())?;
                            dict.set_item("to", to.display().to_string())?;
                        },
                    }
                    Ok(dict.into())
                }).collect::<PyResult<Vec<_>>>()?;
                
                callback.call1(py, (py_events,))?;
                Ok::<(), PyErr>(())
            })?;
        }
        
        std::thread::sleep(std::time::Duration::from_millis(500));
    }
}

// Utility Functions

/// Get file information
#[pyfunction]
pub fn get_file_info(path: &str) -> PyResult<PyObject> {
    let path = std::path::Path::new(path);
    let metadata = path.metadata().map_err(|e| PyIOError::new_err(e.to_string()))?;
    
    Python::with_gil(|py| {
        let info = PyDict::new(py);
        info.set_item("size", metadata.len())?;
        info.set_item("is_file", metadata.is_file())?;
        info.set_item("is_dir", metadata.is_dir())?;
        info.set_item("readonly", metadata.permissions().readonly())?;
        
        if let Ok(modified) = metadata.modified() {
            if let Ok(duration) = modified.duration_since(std::time::UNIX_EPOCH) {
                info.set_item("modified_timestamp", duration.as_secs())?;
            }
        }
        
        Ok(info.into())
    })
}

/// Compute file hash (SHA256)
#[pyfunction]
pub fn compute_file_hash(path: &str) -> PyResult<String> {
    use std::io::Read;
    use sha2::{Digest, Sha256};
    
    let mut file = std::fs::File::open(path)
        .map_err(|e| PyIOError::new_err(e.to_string()))?;
    
    let mut hasher = Sha256::new();
    let mut buffer = [0; 8192];
    
    loop {
        let bytes_read = file.read(&mut buffer)
            .map_err(|e| PyIOError::new_err(e.to_string()))?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }
    
    let hash = hasher.finalize();
    Ok(format!("{:x}", hash))
}