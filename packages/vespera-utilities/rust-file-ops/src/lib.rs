//! Vespera File Operations Library
//!
//! High-performance file operations library with precise string editing capabilities.
//! Provides both Rust library API and Python bindings for MCP servers.
//!
//! # Features
//!
//! - **Exact String Replacement**: Fast, Unicode-safe string replacement operations
//! - **Multi-Edit Support**: Sequential edit operations with comprehensive result tracking
//! - **Performance Optimized**: Memory-efficient algorithms for large files
//! - **Python Bindings**: Seamless integration with Python MCP servers
//! - **Error Handling**: Comprehensive error types with rich context information
//!
//! # Library API
//!
//! The core library provides a clean, type-safe API for file editing operations.
//! See the individual modules for detailed documentation.
//!
//! # Python API
//!
//! Python bindings are available for all file operations, making this library
//! suitable for integration into Python-based MCP servers.

// Core library modules
pub mod error;
pub mod types;
pub mod edit;
pub mod io;

// Re-export core types for convenience
pub use error::{EditError, Result};
pub use types::{
    EditOperation, EditResult, MultiEditResult, PerformanceMetrics,
    SingleOperationResult, EditConfig,
};
pub use edit::{
    StringMatcher, Match, MatchConfig, SingleEditor, MultiEditor,
    replace_string, replace_first, replace_all, apply_multiple_edits,
};
pub use io::{FileReader, FileWriter};

// Python bindings (when pyo3 feature is enabled)
#[cfg(feature = "python-bindings")]
use pyo3::prelude::*;

// Legacy imports for Python bindings
#[cfg(feature = "python-bindings")]
use std::{fs, path::Path};

// Standard library imports for public API
use std::path::Path as StdPath;

// =============================================================================
// Public File Editing API
// =============================================================================

/// Edit a file with a single string replacement operation
///
/// This is the main high-level API for editing files. It reads the file,
/// applies the edit operation, and writes the result back atomically.
///
/// # Arguments
/// * `path` - Path to the file to edit
/// * `operation` - The edit operation to perform
/// * `config` - Optional configuration (uses default if None)
///
/// # Returns
/// * `EditResult` containing the operation results and statistics
///
/// # Example
/// ```no_run
/// use vespera_file_ops::{edit_file, EditOperation};
/// 
/// let operation = EditOperation::new("old_text", "new_text", false);
/// let result = edit_file("example.txt", &operation, None).unwrap();
/// println!("Made {} replacements", result.replacements_made);
/// ```
pub fn edit_file(
    path: impl AsRef<StdPath>,
    operation: &EditOperation,
    config: Option<EditConfig>,
) -> Result<EditResult> {
    let config = config.unwrap_or_default();
    let path_ref = path.as_ref();

    // Read file content
    let reader = FileReader::with_config(path_ref, config.clone())?;
    let content = reader.read_for_editing()?;

    // Apply edit operation
    let editor = SingleEditor::new();
    let result = editor.apply_edit(&content, operation)?;

    // Write result back to file if changes were made
    if result.changed {
        let mut writer = FileWriter::with_config(path_ref, config)?;
        writer.write_edit_result(&result.content)?;
    }

    Ok(result)
}

/// Edit a file with multiple sequential string replacement operations
///
/// Applies multiple edit operations in sequence, where each operation
/// works on the result of the previous operation. All operations are
/// atomic - either all succeed or the file remains unchanged.
///
/// # Arguments
/// * `path` - Path to the file to edit
/// * `operations` - Slice of edit operations to perform in order
/// * `config` - Optional configuration (uses default if None)
///
/// # Returns
/// * `MultiEditResult` containing results for all operations
///
/// # Example
/// ```no_run
/// use vespera_file_ops::{multi_edit_file, EditOperation};
/// 
/// let operations = vec![
///     EditOperation::new("old1", "new1", true),
///     EditOperation::new("old2", "new2", false),
/// ];
/// let result = multi_edit_file("example.txt", &operations, None).unwrap();
/// println!("Total replacements: {}", result.total_replacements);
/// ```
pub fn multi_edit_file(
    path: impl AsRef<StdPath>,
    operations: &[EditOperation],
    config: Option<EditConfig>,
) -> Result<MultiEditResult> {
    let config = config.unwrap_or_default();
    let path_ref = path.as_ref();

    if operations.is_empty() {
        // Read content for empty operations case
        let reader = FileReader::with_config(path_ref, config)?;
        let content = reader.read_for_editing()?;
        return Ok(MultiEditResult::new(content, 0));
    }

    // Read file content
    let reader = FileReader::with_config(path_ref, config.clone())?;
    let content = reader.read_for_editing()?;

    // Apply multi-edit operations
    let editor = MultiEditor::new();
    let result = editor.apply_edits(&content, operations)?;

    // Write result back to file if changes were made
    if result.changed {
        let mut writer = FileWriter::with_config(path_ref, config)?;
        writer.write_edit_result(&result.content)?;
    }

    Ok(result)
}

/// Edit a file with atomic write safety
///
/// Like `edit_file` but uses atomic writes with temporary files to ensure
/// the original file is never corrupted, even if the operation fails.
///
/// # Arguments
/// * `path` - Path to the file to edit
/// * `operation` - The edit operation to perform
/// * `config` - Optional configuration (uses default if None)
///
/// # Returns
/// * `EditResult` containing the operation results and statistics
pub fn edit_file_atomic(
    path: impl AsRef<StdPath>,
    operation: &EditOperation,
    config: Option<EditConfig>,
) -> Result<EditResult> {
    let config = config.unwrap_or_default();
    let path_ref = path.as_ref();

    // Read file content
    let reader = FileReader::with_config(path_ref, config.clone())?;
    let content = reader.read_for_editing()?;

    // Apply edit operation
    let editor = SingleEditor::new();
    let result = editor.apply_edit(&content, operation)?;

    // Write result back atomically if changes were made
    if result.changed {
        io::writer::write_atomic_safe(path_ref, &result.content, config.max_file_size)?;
    }

    Ok(result)
}

/// Edit a file with multiple operations using atomic writes
///
/// Like `multi_edit_file` but uses atomic writes with temporary files.
///
/// # Arguments
/// * `path` - Path to the file to edit
/// * `operations` - Slice of edit operations to perform in order
/// * `config` - Optional configuration (uses default if None)
///
/// # Returns
/// * `MultiEditResult` containing results for all operations
pub fn multi_edit_file_atomic(
    path: impl AsRef<StdPath>,
    operations: &[EditOperation],
    config: Option<EditConfig>,
) -> Result<MultiEditResult> {
    let config = config.unwrap_or_default();
    let path_ref = path.as_ref();

    if operations.is_empty() {
        // Read content for empty operations case
        let reader = FileReader::with_config(path_ref, config)?;
        let content = reader.read_for_editing()?;
        return Ok(MultiEditResult::new(content, 0));
    }

    // Read file content
    let reader = FileReader::with_config(path_ref, config.clone())?;
    let content = reader.read_for_editing()?;

    // Apply multi-edit operations
    let editor = MultiEditor::new();
    let result = editor.apply_edits(&content, operations)?;

    // Write result back atomically if changes were made
    if result.changed {
        io::writer::write_atomic_safe(path_ref, &result.content, config.max_file_size)?;
    }

    Ok(result)
}

/// Preview what an edit operation would do without modifying the file
///
/// Useful for testing edit operations before applying them.
///
/// # Arguments
/// * `path` - Path to the file to preview
/// * `operation` - The edit operation to preview
/// * `config` - Optional configuration (uses default if None)
///
/// # Returns
/// * `EditResult` containing what the operation would produce
pub fn preview_edit(
    path: impl AsRef<StdPath>,
    operation: &EditOperation,
    config: Option<EditConfig>,
) -> Result<EditResult> {
    let config = config.unwrap_or_default();
    let path_ref = path.as_ref();

    // Read file content
    let reader = FileReader::with_config(path_ref, config)?;
    let content = reader.read_for_editing()?;

    // Preview edit operation (doesn't write to file)
    let editor = SingleEditor::new();
    editor.preview_edit(&content, operation)
}

/// Preview what multiple edit operations would do without modifying the file
///
/// # Arguments
/// * `path` - Path to the file to preview
/// * `operations` - Slice of edit operations to preview
/// * `config` - Optional configuration (uses default if None)
///
/// # Returns
/// * `MultiEditResult` containing what the operations would produce
pub fn preview_multi_edit(
    path: impl AsRef<StdPath>,
    operations: &[EditOperation],
    config: Option<EditConfig>,
) -> Result<MultiEditResult> {
    let config = config.unwrap_or_default();
    let path_ref = path.as_ref();

    // Read file content
    let reader = FileReader::with_config(path_ref, config)?;
    let content = reader.read_for_editing()?;

    // Preview multi-edit operations (doesn't write to file)
    let editor = MultiEditor::new();
    editor.preview_edits(&content, operations)
}

// =============================================================================
// Python Bindings
// =============================================================================

#[cfg(feature = "python-bindings")]
mod python_bindings {
    use super::*;
    
    /// Read file content as bytes
    #[pyfunction]
    pub fn read_file(path: &str) -> PyResult<Vec<u8>> {
        fs::read(path).map_err(|e| pyo3::exceptions::PyIOError::new_err(e.to_string()))
    }

    /// Read file content as string
    #[pyfunction] 
    pub fn read_file_string(path: &str) -> PyResult<String> {
        fs::read_to_string(path).map_err(|e| pyo3::exceptions::PyIOError::new_err(e.to_string()))
    }

    /// Read file content line by line
    #[pyfunction]
    pub fn read_file_lines(path: &str) -> PyResult<Vec<String>> {
        let content = fs::read_to_string(path).map_err(|e| pyo3::exceptions::PyIOError::new_err(e.to_string()))?;
        Ok(content.lines().map(String::from).collect())
    }

    /// Write bytes to file
    #[pyfunction]
    pub fn write_file(path: &str, content: &[u8]) -> PyResult<()> {
        fs::write(path, content).map_err(|e| pyo3::exceptions::PyIOError::new_err(e.to_string()))
    }

    /// Write string to file
    #[pyfunction]
    pub fn write_file_string(path: &str, content: &str) -> PyResult<()> {
        fs::write(path, content).map_err(|e| pyo3::exceptions::PyIOError::new_err(e.to_string()))
    }

    /// Append content to file
    #[pyfunction]
    pub fn append_file(path: &str, content: &str) -> PyResult<()> {
        use std::io::Write;
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
            .map_err(|e| pyo3::exceptions::PyIOError::new_err(e.to_string()))?;
        
        file.write_all(content.as_bytes())
            .map_err(|e| pyo3::exceptions::PyIOError::new_err(e.to_string()))
    }

    /// Write file atomically (safe replacement)
    #[pyfunction]
    pub fn write_file_atomic(path: &str, content: &str) -> PyResult<()> {
        let path = Path::new(path);
        let temp_path = path.with_extension("tmp");
        
        // Write to temp file first
        fs::write(&temp_path, content).map_err(|e| pyo3::exceptions::PyIOError::new_err(e.to_string()))?;
        
        // Atomically rename
        fs::rename(&temp_path, path).map_err(|e| pyo3::exceptions::PyIOError::new_err(e.to_string()))
    }

    /// Find files using glob patterns
    #[pyfunction]
    pub fn glob_files(directory: &str, pattern: &str) -> PyResult<Vec<String>> {
        use walkdir::WalkDir;
        use globset::Glob;
        
        let glob = Glob::new(pattern)
            .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?
            .compile_matcher();
        
        let mut results = Vec::new();
        for entry in WalkDir::new(directory).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() && glob.is_match(entry.path()) {
                results.push(entry.path().display().to_string());
            }
        }
        
        Ok(results)
    }

    /// Get file information
    #[pyfunction]
    pub fn get_file_info(path: &str) -> PyResult<(u64, bool, bool)> {
        let metadata = fs::metadata(path).map_err(|e| pyo3::exceptions::PyIOError::new_err(e.to_string()))?;
        Ok((metadata.len(), metadata.is_file(), metadata.is_dir()))
    }
}

/// Python module definition for MCP file operations
#[cfg(feature = "python-bindings")]
#[pymodule]
fn vespera_file_ops(m: &Bound<'_, PyModule>) -> PyResult<()> {
    use python_bindings::*;
    
    // File reading operations
    m.add_function(wrap_pyfunction!(read_file, m)?)?;
    m.add_function(wrap_pyfunction!(read_file_string, m)?)?;
    m.add_function(wrap_pyfunction!(read_file_lines, m)?)?;
    
    // File writing operations  
    m.add_function(wrap_pyfunction!(write_file, m)?)?;
    m.add_function(wrap_pyfunction!(write_file_string, m)?)?;
    m.add_function(wrap_pyfunction!(append_file, m)?)?;
    m.add_function(wrap_pyfunction!(write_file_atomic, m)?)?;
    
    // Utility functions
    m.add_function(wrap_pyfunction!(glob_files, m)?)?;
    m.add_function(wrap_pyfunction!(get_file_info, m)?)?;
    
    Ok(())
}