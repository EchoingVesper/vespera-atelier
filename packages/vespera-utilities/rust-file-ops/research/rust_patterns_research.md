# Rust Patterns Research for File Editing Operations

## Executive Summary

This research document covers Rust-specific patterns and best practices for implementing high-performance file editing operations. The analysis is based on existing Rust editor projects, string manipulation patterns, error handling strategies, performance optimizations, and API design principles.

## 1. String Manipulation Patterns

### 1.1 String vs &str vs Cow Decision Framework

**String**: Use when you need owned data
- Function returns and data needs to outlive the current scope
- Building strings dynamically (concatenation, formatting)
- Modifying strings in-place
- Example: `String::with_capacity(1024)` for performance-critical string building

**&str**: Use for read-only string data
- Function parameters that don't need ownership
- String literals and temporary references
- Pattern matching and parsing operations
- Zero-copy operations where possible

**Cow<str>**: Use for flexible ownership scenarios
- APIs that can accept both owned and borrowed strings
- Functions that may or may not need to modify the input
- Library APIs where caller decides ownership model
- Example: File path processing that may need normalization

### 1.2 Performance Patterns

```rust
// Pre-allocate capacity for string building
let mut buffer = String::with_capacity(expected_size);

// Use Cow for flexible ownership
fn process_path(path: Cow<str>) -> Cow<str> {
    if needs_normalization(&path) {
        Cow::Owned(normalize_path(&path))
    } else {
        path // No allocation if already normalized
    }
}

// Zero-copy string operations with &str slicing
fn extract_filename(path: &str) -> &str {
    path.rfind('/').map(|i| &path[i+1..]).unwrap_or(path)
}
```

### 1.3 UTF-8 Handling Best Practices

- Always validate UTF-8 at boundaries using `str::from_utf8()`
- Use `String::from_utf8_lossy()` for error recovery scenarios
- Prefer byte operations for non-textual data (using `&[u8]`)
- Use `char_indices()` for safe character-based iteration

## 2. Architecture Patterns from Existing Rust Editors

### 2.1 Helix Editor Architecture Analysis

**Key Patterns:**
- **Functional Core Design**: Immutable primitives with transformation functions
- **Rope Data Structure**: Efficient text manipulation with cheap cloning
- **Transaction-Based Edits**: Atomic operations with undo capability
- **Event-Driven System**: Async hooks with debouncing support

**Code Pattern:**
```rust
// Transaction-based editing (Helix pattern)
pub struct Transaction {
    changes: Vec<Change>,
    selection: Selection,
}

impl Transaction {
    pub fn apply(&self, rope: &Rope) -> Rope {
        // Apply changes immutably
    }
    
    pub fn invert(&self, rope: &Rope) -> Transaction {
        // Generate inverse for undo
    }
}
```

### 2.2 Xi-Editor Patterns

**Key Insights:**
- **Rope-based text editing**: O(log n) insertions and deletions
- **CRDT-friendly operations**: Support for collaborative editing
- **Plugin architecture**: Extensible through well-defined interfaces
- **Frontend-backend separation**: Clean protocol boundaries

### 2.3 Lapce Architecture

**Hybrid Approach:**
- Borrows xi-editor's rope implementation
- Druid widget composition system
- Complete rewrite of frontend-backend communication
- Plugin system designed from ground up

## 3. Error Handling Design Patterns

### 3.1 thiserror vs anyhow Guidelines

**Use thiserror for libraries:**
- Structured error types that callers need to handle differently
- Rich error context with specific error variants
- When error recovery strategies depend on error type
- Public APIs where error details matter

**Use anyhow for applications:**
- Simple error propagation with context
- When callers don't need to handle specific error types
- Rapid prototyping and internal tools
- Error reporting and logging scenarios

### 3.2 Library Error Design Pattern

```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum FileOpError {
    #[error("File not found: {path}")]
    NotFound { path: String },
    
    #[error("Permission denied: {path}")]
    PermissionDenied { path: String },
    
    #[error("File too large: {size} bytes (max: {max})")]
    TooLarge { size: u64, max: u64 },
    
    #[error("Encoding error in file: {path} - {reason}")]
    EncodingError { path: String, reason: String },
    
    #[error("File system error: {0}")]
    IoError(#[from] std::io::Error),
    
    #[error("Regex error: {0}")]
    RegexError(#[from] regex::Error),
}

impl FileOpError {
    pub fn from_io_with_path(error: std::io::Error, path: impl Into<String>) -> Self {
        let path = path.into();
        match error.kind() {
            std::io::ErrorKind::NotFound => Self::NotFound { path },
            std::io::ErrorKind::PermissionDenied => Self::PermissionDenied { path },
            _ => Self::IoError(error),
        }
    }
}
```

### 3.3 Error Recovery Patterns

```rust
// Graceful degradation with fallbacks
pub fn read_file_with_fallback(primary: &str, fallback: &str) -> FileOpResult<String> {
    match fs::read_to_string(primary) {
        Ok(content) => Ok(content),
        Err(_) => fs::read_to_string(fallback)
            .map_err(|e| FileOpError::from_io_with_path(e, fallback))
    }
}

// Partial success patterns
pub struct SearchResults {
    pub matches: Vec<Match>,
    pub errors: Vec<FileOpError>,
    pub partial: bool,
}
```

## 4. Performance Optimization Strategies

### 4.1 Memory Management Patterns

**Pre-allocation Strategy:**
```rust
// Pre-allocate based on expected size
let mut buffer = String::with_capacity(file_size_hint);
let mut results = Vec::with_capacity(expected_matches);
```

**Zero-Copy Operations:**
```rust
// Use string slicing instead of allocation
fn extract_lines(content: &str, start: usize, end: usize) -> Vec<&str> {
    content.lines().skip(start).take(end - start).collect()
}
```

**Memory Mapping for Large Files:**
```rust
use memmap2::Mmap;

pub fn search_large_file(path: &Path, pattern: &str) -> Result<Vec<usize>, FileOpError> {
    let file = File::open(path)?;
    let mmap = unsafe { Mmap::map(&file)? };
    
    // Search in memory-mapped region
    search_bytes(&mmap, pattern.as_bytes())
}
```

### 4.2 SIMD Optimization Patterns

**Using memchr for fast byte searching:**
```rust
use memchr::{memmem, memchr};

pub fn find_pattern_simd(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    memmem::find(haystack, needle)
}

pub fn count_newlines_simd(text: &[u8]) -> usize {
    memchr::memchr_iter(b'\n', text).count()
}
```

**Vectorized operations:**
```rust
// Process chunks in parallel for large files
use rayon::prelude::*;

pub fn process_lines_parallel(content: &str) -> Vec<String> {
    content.par_lines()
        .map(|line| process_line(line))
        .collect()
}
```

### 4.3 String Search Optimizations

**Fast substring search with twoway:**
```rust
use twoway::find_str;

pub fn efficient_substring_search(text: &str, pattern: &str) -> Option<usize> {
    find_str(text, pattern)
}
```

**Multi-pattern matching with aho-corasick:**
```rust
use aho_corasick::AhoCorasick;

pub struct MultiPatternSearcher {
    ac: AhoCorasick,
}

impl MultiPatternSearcher {
    pub fn new(patterns: &[&str]) -> Result<Self, FileOpError> {
        let ac = AhoCorasick::new(patterns)
            .map_err(|e| FileOpError::internal(e.to_string()))?;
        Ok(Self { ac })
    }
    
    pub fn find_all(&self, text: &str) -> Vec<Match> {
        self.ac.find_iter(text)
            .map(|mat| Match::new(mat.start(), mat.end(), mat.pattern()))
            .collect()
    }
}
```

## 5. API Design Best Practices

### 5.1 Rust API Guidelines Application

**Naming Conventions:**
- Use `snake_case` for functions and variables
- Use `PascalCase` for types and traits
- Prefix boolean functions with `is_`, `has_`, or `can_`
- Use `into_` for consuming conversions, `to_` for non-consuming

**Trait Design Patterns:**
```rust
// Extensible operations through traits
pub trait FileProcessor {
    type Output;
    type Error;
    
    fn process(&self, content: &str) -> Result<Self::Output, Self::Error>;
}

// Generic over AsRef for flexible path handling
pub fn read_file_generic<P: AsRef<Path>>(path: P) -> FileOpResult<String> {
    fs::read_to_string(path.as_ref())
        .map_err(|e| FileOpError::from_io_with_path(e, path.as_ref().display().to_string()))
}
```

### 5.2 Builder Pattern for Complex Operations

```rust
pub struct FileSearchBuilder {
    pattern: Option<String>,
    case_sensitive: bool,
    max_results: Option<usize>,
    file_types: Vec<String>,
}

impl FileSearchBuilder {
    pub fn new() -> Self {
        Self {
            pattern: None,
            case_sensitive: true,
            max_results: None,
            file_types: Vec::new(),
        }
    }
    
    pub fn pattern(mut self, pattern: impl Into<String>) -> Self {
        self.pattern = Some(pattern.into());
        self
    }
    
    pub fn case_insensitive(mut self) -> Self {
        self.case_sensitive = false;
        self
    }
    
    pub fn max_results(mut self, max: usize) -> Self {
        self.max_results = Some(max);
        self
    }
    
    pub fn build(self) -> Result<FileSearcher, FileOpError> {
        let pattern = self.pattern.ok_or_else(|| 
            FileOpError::internal("Pattern is required"))?;
            
        Ok(FileSearcher {
            pattern,
            case_sensitive: self.case_sensitive,
            max_results: self.max_results.unwrap_or(1000),
            file_types: self.file_types,
        })
    }
}
```

### 5.3 Zero-Cost Abstractions

```rust
// Generic trait for different string types
pub trait StringLike: AsRef<str> {
    fn as_str(&self) -> &str {
        self.as_ref()
    }
}

impl<T: AsRef<str>> StringLike for T {}

// Zero-cost abstraction over different path representations
pub fn normalize_path<P: AsRef<Path>>(path: P) -> PathBuf {
    path.as_ref().canonicalize().unwrap_or_else(|_| path.as_ref().to_path_buf())
}
```

## 6. Recommended Architecture for File Operations Library

### 6.1 Core Module Structure

```
src/
├── lib.rs              # Public API and re-exports
├── error.rs            # Error types and handling
├── types.rs            # Core data structures
├── io/                 # File I/O operations
│   ├── mod.rs
│   ├── readers.rs      # File reading strategies
│   ├── writers.rs      # File writing strategies
│   └── atomic.rs       # Atomic operations
├── search/             # Search and pattern matching
│   ├── mod.rs
│   ├── patterns.rs     # Pattern compilation
│   ├── engines.rs      # Search engine implementations
│   └── simd.rs         # SIMD optimizations
├── text/               # Text processing utilities
│   ├── mod.rs
│   ├── encoding.rs     # Encoding handling
│   ├── lines.rs        # Line-based operations
│   └── manipulation.rs # Text transformation
└── utils/              # Utility functions
    ├── mod.rs
    ├── paths.rs        # Path manipulation
    └── validation.rs   # Input validation
```

### 6.2 Performance-Critical Path Pattern

```rust
// Hot path optimization with compile-time specialization
pub trait SearchStrategy {
    fn search(&self, text: &str, pattern: &str) -> Vec<usize>;
}

pub struct SIMDSearch;
pub struct RegexSearch;

impl SearchStrategy for SIMDSearch {
    #[inline(always)]
    fn search(&self, text: &str, pattern: &str) -> Vec<usize> {
        // SIMD-optimized implementation
        memchr::memmem::find_iter(text.as_bytes(), pattern.as_bytes())
            .collect()
    }
}

// Runtime strategy selection
pub fn create_searcher(pattern: &str) -> Box<dyn SearchStrategy> {
    if pattern.len() < 64 && is_simple_pattern(pattern) {
        Box::new(SIMDSearch)
    } else {
        Box::new(RegexSearch)
    }
}
```

## 7. Integration with Python via PyO3

### 7.1 Error Handling Across FFI Boundary

```rust
use pyo3::prelude::*;
use pyo3::exceptions::{PyIOError, PyValueError};

impl From<FileOpError> for PyErr {
    fn from(err: FileOpError) -> Self {
        match err {
            FileOpError::NotFound { path } => 
                PyIOError::new_err(format!("File not found: {}", path)),
            FileOpError::PermissionDenied { path } => 
                PyIOError::new_err(format!("Permission denied: {}", path)),
            FileOpError::InvalidPattern { pattern, reason } => 
                PyValueError::new_err(format!("Invalid pattern '{}': {}", pattern, reason)),
            _ => PyIOError::new_err(err.to_string()),
        }
    }
}
```

### 7.2 Memory-Efficient Python Bindings

```rust
// Return Python bytes for binary data
#[pyfunction]
fn read_file_bytes(path: &str) -> PyResult<Vec<u8>> {
    fs::read(path).map_err(FileOpError::from).map_err(PyErr::from)
}

// Use Cow for flexible string returns
#[pyfunction]
fn normalize_text(text: &str) -> PyResult<Cow<str>> {
    Ok(if needs_normalization(text) {
        Cow::Owned(perform_normalization(text))
    } else {
        Cow::Borrowed(text)
    })
}
```

## 8. Testing Strategies

### 8.1 Property-Based Testing

```rust
use proptest::prelude::*;

proptest! {
    #[test]
    fn search_always_finds_substring(text in any::<String>(), pos in 0..100usize) {
        let needle = &text[..pos.min(text.len())];
        if !needle.is_empty() {
            let results = search_text(&text, needle);
            prop_assert!(!results.is_empty());
        }
    }
}
```

### 8.2 Benchmark-Driven Development

```rust
use criterion::{criterion_group, criterion_main, Criterion, BenchmarkId};

fn search_benchmarks(c: &mut Criterion) {
    let mut group = c.benchmark_group("search");
    
    for size in [1_000, 10_000, 100_000] {
        let text = "a".repeat(size);
        group.bench_with_input(
            BenchmarkId::new("simd", size),
            &size,
            |b, _| b.iter(|| search_simd(&text, "aa")),
        );
    }
    
    group.finish();
}

criterion_group!(benches, search_benchmarks);
criterion_main!(benches);
```

## 9. Key Recommendations

### 9.1 Immediate Implementation Priorities

1. **Error Type Hierarchy**: Implement comprehensive error types using thiserror
2. **String Strategy**: Use Cow<str> for public APIs, &str for internal functions
3. **Performance**: Integrate memchr and aho-corasick for fast searching
4. **Memory Management**: Pre-allocate collections with capacity hints
5. **API Design**: Follow Rust API guidelines for naming and trait design

### 9.2 Advanced Optimizations

1. **SIMD Integration**: Use memchr for byte-level operations
2. **Memory Mapping**: For large files (>8MB), use memory mapping
3. **Parallel Processing**: Use rayon for CPU-intensive operations
4. **Benchmarking**: Establish continuous benchmarking with criterion
5. **Property Testing**: Use proptest for edge case discovery

### 9.3 Architecture Decisions

1. **Modular Design**: Separate concerns into focused modules
2. **Trait-Based Extension**: Allow custom implementations through traits
3. **Zero-Cost Abstractions**: Generic over AsRef<str> and AsRef<Path>
4. **Builder Patterns**: For complex configuration scenarios
5. **Immutable Core**: Follow functional programming principles where possible

## 10. Conclusion

This research establishes a foundation for building high-performance, idiomatic Rust file editing operations. The patterns identified from successful Rust editors, combined with performance optimization techniques and proper error handling, provide a robust framework for implementation.

The key insight is balancing performance with ergonomics through careful use of Rust's type system, particularly around string handling and error propagation. The modular architecture allows for incremental optimization while maintaining a clean API surface.

Future development should prioritize establishing the core error handling and string manipulation patterns, then build performance optimizations incrementally with proper benchmarking to validate improvements.