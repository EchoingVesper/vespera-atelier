# Comprehensive Testing Strategies for File Editing Operations

## Executive Summary

This document presents a comprehensive research analysis of testing strategies for file editing operations in Rust, covering property-based testing, fuzzing, benchmarking, and integration testing approaches. The research focuses on ensuring correctness, performance, and reliability of text editing functionality through systematic testing methodologies.

## Table of Contents

1. [Property-Based Testing](#property-based-testing)
2. [Fuzzing Strategies](#fuzzing-strategies)
3. [Benchmark Methodology](#benchmark-methodology)
4. [Test Case Generation](#test-case-generation)
5. [Integration Testing Patterns](#integration-testing-patterns)
6. [Memory Safety and Leak Detection](#memory-safety-and-leak-detection)
7. [Recommended Testing Architecture](#recommended-testing-architecture)
8. [Implementation Examples](#implementation-examples)

---

## Property-Based Testing

### Overview

Property-based testing uses the `proptest` crate to verify that invariants hold across a wide range of randomly generated inputs. This approach is particularly effective for string operations and file editing where traditional example-based tests may miss edge cases.

### Key Properties for File Editing Operations

#### 1. Edit Preservation Properties
```rust
// Property: Non-matched content should remain unchanged
fn prop_edit_preserves_unmatched_content(original: String, pattern: String, replacement: String) {
    let result = edit_text(&original, &pattern, &replacement);
    // All content not matching pattern should remain identical
    // This requires careful implementation to verify
}

// Property: Multiple edits should be commutative when non-overlapping
fn prop_non_overlapping_edits_commutative(
    text: String, 
    edit1: (String, String), 
    edit2: (String, String)
) {
    // Assuming edits don't overlap, order shouldn't matter
}
```

#### 2. UTF-8 and Encoding Properties
```rust
// Property: UTF-8 boundary preservation
fn prop_edit_preserves_utf8_boundaries(text: String, pattern: String, replacement: String) {
    let result = edit_text(&text, &pattern, &replacement);
    assert!(String::from_utf8(result.into_bytes()).is_ok());
}

// Property: Character boundary respect
fn prop_edit_respects_char_boundaries(text: String, start: usize, end: usize) {
    // Edits should never split Unicode scalar values
    if text.is_char_boundary(start) && text.is_char_boundary(end) {
        // Edit operation should succeed
    }
}
```

#### 3. Idempotency Properties
```rust
// Property: Applying the same edit twice should be idempotent for certain operations
fn prop_replace_idempotent(text: String, pattern: String, replacement: String) {
    let once = edit_text(&text, &pattern, &replacement);
    let twice = edit_text(&once, &pattern, &replacement);
    // For non-overlapping replacements, should be identical
    assert_eq!(once, twice);
}
```

### Proptest Generators

#### String Generation Strategies
```rust
use proptest::prelude::*;

// Generate Unicode-heavy test strings
fn unicode_string_strategy() -> BoxedStrategy<String> {
    prop::collection::vec(
        prop::char::range('\u{0000}', '\u{10FFFF}'),
        0..1000
    ).prop_map(|chars| chars.into_iter().collect())
    .boxed()
}

// Generate ASCII with special characters
fn ascii_with_specials() -> BoxedStrategy<String> {
    prop::string::string_regex(r"[a-zA-Z0-9\n\r\t\x00-\x1F]*")
        .unwrap()
        .boxed()
}

// Generate potentially problematic patterns
fn edge_case_patterns() -> BoxedStrategy<String> {
    prop_oneof![
        Just("".to_string()),              // Empty string
        Just("\n".to_string()),            // Newline only
        Just("\r\n".to_string()),          // CRLF
        Just("\u{FEFF}".to_string()),      // BOM
        Just("𝕳𝖊𝖑𝖑𝖔".to_string()),          // Mathematical symbols
        Just("🦀🔥".to_string()),            // Emojis
    ].boxed()
}
```

### Testing Framework Integration
```rust
#[cfg(test)]
mod property_tests {
    use super::*;
    use proptest::prelude::*;

    proptest! {
        #[test]
        fn prop_edit_maintains_valid_utf8(
            text in unicode_string_strategy(),
            pattern in edge_case_patterns(),
            replacement in unicode_string_strategy()
        ) {
            let result = edit_text(&text, &pattern, &replacement);
            prop_assert!(result.is_valid_utf8());
        }

        #[test]
        fn prop_edit_length_bounds(
            text in prop::string::string_regex(r".{0,1000}").unwrap(),
            pattern in prop::string::string_regex(r".{1,50}").unwrap(),
            replacement in prop::string::string_regex(r".{0,100}").unwrap()
        ) {
            let original_len = text.len();
            let result = edit_text(&text, &pattern, &replacement);
            // Length should be within reasonable bounds
            prop_assert!(result.len() <= original_len + 10000); // Prevent pathological growth
        }
    }
}
```

---

## Fuzzing Strategies

### Overview

Fuzzing with `cargo-fuzz` provides coverage-guided testing to discover edge cases and potential crashes. The libFuzzer backend generates inputs that maximize code coverage.

### Fuzz Target Design

#### Basic String Operations
```rust
// fuzz/fuzz_targets/edit_operations.rs
#![no_main]
use libfuzzer_sys::fuzz_target;
use file_ops::{edit_text, EditError};

fuzz_target!(|data: &[u8]| {
    if let Ok(input) = std::str::from_utf8(data) {
        if input.len() > 10000 {
            return; // Avoid timeout on very large inputs
        }
        
        // Split input into components
        let parts: Vec<&str> = input.splitn(3, '\x00').collect();
        if parts.len() == 3 {
            let (text, pattern, replacement) = (parts[0], parts[1], parts[2]);
            
            // Test the edit operation
            let _ = edit_text(text, pattern, replacement);
        }
    }
});
```

#### Complex Multi-Edit Operations
```rust
// fuzz/fuzz_targets/multi_edit.rs
#![no_main]
use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    if data.len() < 4 {
        return;
    }
    
    let num_edits = data[0] as usize % 10; // Limit to 10 edits
    let mut remaining = &data[1..];
    
    if let Ok(mut text) = String::from_utf8(remaining[..remaining.len()/2].to_vec()) {
        remaining = &remaining[remaining.len()/2..];
        
        // Apply multiple edits
        for _ in 0..num_edits {
            if remaining.len() < 6 {
                break;
            }
            
            let pattern_len = remaining[0] as usize % (remaining.len() / 3);
            let repl_len = remaining[1] as usize % (remaining.len() / 3);
            
            if pattern_len + repl_len + 2 > remaining.len() {
                break;
            }
            
            if let (Ok(pattern), Ok(replacement)) = (
                String::from_utf8(remaining[2..2+pattern_len].to_vec()),
                String::from_utf8(remaining[2+pattern_len..2+pattern_len+repl_len].to_vec())
            ) {
                text = edit_text(&text, &pattern, &replacement);
                remaining = &remaining[2+pattern_len+repl_len..];
            }
        }
    }
});
```

### Coverage-Guided Fuzzing Setup

#### Cargo.toml Configuration
```toml
[package.metadata.fuzz]
targets = [
    "edit_operations",
    "multi_edit", 
    "unicode_edge_cases",
    "large_file_operations"
]

[[bin]]
name = "edit_operations"
path = "fuzz/fuzz_targets/edit_operations.rs"
```

#### Fuzzing Commands
```bash
# Initialize fuzzing
cargo fuzz init

# Run specific fuzz target
cargo fuzz run edit_operations

# Run with specific corpus
cargo fuzz run edit_operations fuzz/corpus/edit_operations

# Generate coverage report
cargo fuzz coverage edit_operations

# Minimize crash case
cargo fuzz fmt edit_operations crash-file

# Run with maximum memory and timeout limits
cargo fuzz run edit_operations -- -max_len=10000 -timeout=30
```

### Structured Fuzzing with arbitrary

```rust
// Use arbitrary for structured fuzzing
use arbitrary::{Arbitrary, Unstructured};

#[derive(Debug, Arbitrary)]
struct EditOperation {
    text: String,
    pattern: String, 
    replacement: String,
    #[arbitrary(with = |u: &mut Unstructured| u.int_in_range(0..=2))]
    operation_type: u8, // 0: replace, 1: insert, 2: delete
}

fuzz_target!(|op: EditOperation| {
    match op.operation_type {
        0 => { let _ = replace_text(&op.text, &op.pattern, &op.replacement); }
        1 => { let _ = insert_text(&op.text, &op.pattern, &op.replacement); }
        2 => { let _ = delete_text(&op.text, &op.pattern); }
        _ => unreachable!(),
    }
});
```

---

## Benchmark Methodology

### Criterion.rs Best Practices

#### Micro-benchmarks for Core Operations
```rust
use criterion::{criterion_group, criterion_main, Criterion, BenchmarkId};

fn bench_edit_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("edit_operations");
    
    // Test different input sizes
    for size in [100, 1000, 10_000, 100_000].iter() {
        let text = "a".repeat(*size);
        let pattern = "a";
        let replacement = "b";
        
        group.bench_with_input(
            BenchmarkId::new("simple_replace", size),
            &(*size, &text, pattern, replacement),
            |b, &(size, text, pattern, replacement)| {
                b.iter(|| edit_text(text, pattern, replacement))
            },
        );
    }
    
    group.finish();
}

fn bench_unicode_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("unicode_operations");
    
    let unicode_text = "Hello 世界! 🦀 Rust 🔥".repeat(1000);
    let patterns = ["世界", "🦀", "🔥"];
    let replacements = ["World", "crab", "fire"];
    
    for (i, &pattern) in patterns.iter().enumerate() {
        group.bench_function(
            BenchmarkId::new("unicode_replace", i),
            |b| b.iter(|| edit_text(&unicode_text, pattern, replacements[i]))
        );
    }
    
    group.finish();
}

criterion_group!(benches, bench_edit_operations, bench_unicode_operations);
criterion_main!(benches);
```

#### Statistical Configuration
```rust
fn configure_criterion() -> Criterion {
    Criterion::default()
        .significance_level(0.1)        // 10% significance level
        .measurement_time(Duration::from_secs(10))
        .warm_up_time(Duration::from_secs(3))
        .sample_size(100)               // Number of samples
        .confidence_level(0.95)         // 95% confidence interval
        .noise_threshold(0.05)          // 5% noise threshold
}
```

#### Memory Usage Benchmarking
```rust
use std::alloc::{GlobalAlloc, Layout, System};
use std::sync::atomic::{AtomicUsize, Ordering};

struct TrackingAllocator;

static ALLOCATED: AtomicUsize = AtomicUsize::new(0);

unsafe impl GlobalAlloc for TrackingAllocator {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        let ret = System.alloc(layout);
        if !ret.is_null() {
            ALLOCATED.fetch_add(layout.size(), Ordering::SeqCst);
        }
        ret
    }

    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        System.dealloc(ptr, layout);
        ALLOCATED.fetch_sub(layout.size(), Ordering::SeqCst);
    }
}

#[global_allocator]
static GLOBAL: TrackingAllocator = TrackingAllocator;

fn bench_memory_usage(c: &mut Criterion) {
    c.bench_function("memory_tracking", |b| {
        b.iter_custom(|iters| {
            let start = std::time::Instant::now();
            let start_memory = ALLOCATED.load(Ordering::SeqCst);
            
            for _ in 0..iters {
                let text = "test".repeat(1000);
                let result = edit_text(&text, "test", "replaced");
                std::hint::black_box(result);
            }
            
            let end_memory = ALLOCATED.load(Ordering::SeqCst);
            println!("Memory used: {} bytes", end_memory.saturating_sub(start_memory));
            
            start.elapsed()
        });
    });
}
```

---

## Test Case Generation

### Edge Case Identification

#### Unicode and Encoding Edge Cases
```rust
mod edge_cases {
    // Zero-width characters
    const ZERO_WIDTH_CHARS: &[&str] = &[
        "\u{200B}", // Zero-width space
        "\u{FEFF}", // Byte order mark
        "\u{200C}", // Zero-width non-joiner
        "\u{200D}", // Zero-width joiner
    ];
    
    // Combining characters
    const COMBINING_CHARS: &[&str] = &[
        "e\u{0301}", // e with acute accent
        "a\u{0308}", // a with diaeresis
        "o\u{0302}", // o with circumflex
    ];
    
    // Surrogate pairs and high code points
    const HIGH_UNICODE: &[&str] = &[
        "𝕳𝖊𝖑𝖑𝖔", // Mathematical bold
        "🦀🔥💯",   // Emojis
        "𐍈𐍅𐌰𐌹𐌻",   // Gothic script
    ];
    
    // Line ending variations
    const LINE_ENDINGS: &[&str] = &["\n", "\r\n", "\r", "\u{2028}", "\u{2029}"];
    
    // Pathological cases
    const PATHOLOGICAL: &[&str] = &[
        "",                    // Empty string
        " ",                   // Single space
        "a".repeat(100_000).as_str(), // Very long string
        "\0\x01\x02",         // Control characters
    ];
}
```

#### Test Case Generator
```rust
use rand::{Rng, SeedableRng};
use rand::distributions::{Distribution, Uniform};

pub struct TestCaseGenerator {
    rng: rand::rngs::StdRng,
    unicode_dist: Uniform<u32>,
}

impl TestCaseGenerator {
    pub fn new(seed: u64) -> Self {
        Self {
            rng: rand::rngs::StdRng::seed_from_u64(seed),
            unicode_dist: Uniform::new(0, 0x110000),
        }
    }
    
    pub fn generate_unicode_string(&mut self, min_len: usize, max_len: usize) -> String {
        let len = self.rng.gen_range(min_len..=max_len);
        (0..len)
            .filter_map(|_| {
                let code_point = self.unicode_dist.sample(&mut self.rng);
                char::from_u32(code_point)
            })
            .collect()
    }
    
    pub fn generate_mixed_content(&mut self) -> String {
        let mut content = String::new();
        
        // Add some normal ASCII
        content.push_str("The quick brown fox jumps over the lazy dog.\n");
        
        // Add Unicode content
        content.push_str(&self.generate_unicode_string(10, 50));
        content.push('\n');
        
        // Add edge case characters
        for &edge_case in edge_cases::ZERO_WIDTH_CHARS {
            content.push_str(edge_case);
        }
        
        // Add line ending variations
        for &line_ending in edge_cases::LINE_ENDINGS {
            content.push_str("Line");
            content.push_str(line_ending);
        }
        
        content
    }
    
    pub fn generate_edit_scenario(&mut self) -> (String, String, String) {
        let text = self.generate_mixed_content();
        let pattern_start = self.rng.gen_range(0..text.len().min(100));
        let pattern_len = self.rng.gen_range(1..=(text.len() - pattern_start).min(20));
        
        if let Some(pattern) = text.get(pattern_start..pattern_start + pattern_len) {
            let replacement = self.generate_unicode_string(0, 50);
            (text, pattern.to_string(), replacement)
        } else {
            // Fallback if slicing fails
            (text, "test".to_string(), "replacement".to_string())
        }
    }
}
```

### Large File Testing Strategy

```rust
mod large_file_tests {
    use std::fs::File;
    use std::io::{Write, BufWriter};
    use tempfile::TempDir;
    
    pub struct LargeFileTestCase {
        pub size: usize,
        pub pattern_frequency: f64,
        pub unicode_ratio: f64,
    }
    
    impl LargeFileTestCase {
        pub fn generate_test_file(&self, temp_dir: &TempDir) -> std::io::Result<std::path::PathBuf> {
            let file_path = temp_dir.path().join("large_test_file.txt");
            let file = File::create(&file_path)?;
            let mut writer = BufWriter::new(file);
            
            let mut generator = TestCaseGenerator::new(42); // Fixed seed for reproducibility
            let chunk_size = 8192; // 8KB chunks
            let total_chunks = self.size / chunk_size;
            
            for chunk in 0..total_chunks {
                let content = if generator.rng.gen::<f64>() < self.unicode_ratio {
                    generator.generate_unicode_string(chunk_size / 4, chunk_size)
                } else {
                    "a".repeat(chunk_size)
                };
                
                writer.write_all(content.as_bytes())?;
                
                if chunk % 100 == 0 {
                    println!("Generated chunk {}/{}", chunk, total_chunks);
                }
            }
            
            writer.flush()?;
            Ok(file_path)
        }
    }
    
    #[test]
    #[ignore] // Expensive test, run with --ignored
    fn test_large_file_operations() {
        let temp_dir = TempDir::new().unwrap();
        let test_case = LargeFileTestCase {
            size: 100_000_000, // 100MB
            pattern_frequency: 0.01,
            unicode_ratio: 0.1,
        };
        
        let file_path = test_case.generate_test_file(&temp_dir).unwrap();
        let content = std::fs::read_to_string(&file_path).unwrap();
        
        let start = std::time::Instant::now();
        let result = edit_text(&content, "pattern", "replacement");
        let duration = start.elapsed();
        
        println!("Large file edit took: {:?}", duration);
        assert!(!result.is_empty());
    }
}
```

---

## Integration Testing Patterns

### Cross-Platform File Operations

```rust
mod integration_tests {
    use std::path::{Path, PathBuf};
    use tempfile::{TempDir, NamedTempFile};
    
    #[test]
    fn test_cross_platform_line_endings() {
        let test_cases = vec![
            ("unix", "line1\nline2\nline3\n"),
            ("windows", "line1\r\nline2\r\nline3\r\n"), 
            ("classic_mac", "line1\rline2\rline3\r"),
            ("mixed", "line1\nline2\r\nline3\r"),
        ];
        
        for (name, content) in test_cases {
            let mut temp_file = NamedTempFile::new().unwrap();
            temp_file.write_all(content.as_bytes()).unwrap();
            
            let result = edit_file(temp_file.path(), "line2", "REPLACED").unwrap();
            
            // Verify line endings are preserved appropriately
            match name {
                "unix" => assert!(result.contains("REPLACED\n")),
                "windows" => assert!(result.contains("REPLACED\r\n")),
                "classic_mac" => assert!(result.contains("REPLACED\r")),
                "mixed" => assert!(result.contains("REPLACED")), // Should handle mixed gracefully
                _ => unreachable!(),
            }
        }
    }
    
    #[cfg(target_family = "unix")]
    #[test]
    fn test_unix_permissions() {
        use std::os::unix::fs::PermissionsExt;
        
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test_file.txt");
        
        std::fs::write(&file_path, "original content").unwrap();
        
        // Set specific permissions
        let mut permissions = std::fs::metadata(&file_path).unwrap().permissions();
        permissions.set_mode(0o644);
        std::fs::set_permissions(&file_path, permissions).unwrap();
        
        // Perform edit
        edit_file(&file_path, "original", "modified").unwrap();
        
        // Verify permissions are preserved
        let new_permissions = std::fs::metadata(&file_path).unwrap().permissions();
        assert_eq!(new_permissions.mode() & 0o777, 0o644);
    }
    
    #[cfg(target_family = "windows")]
    #[test]
    fn test_windows_file_attributes() {
        use std::os::windows::fs::MetadataExt;
        
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test_file.txt");
        
        std::fs::write(&file_path, "original content").unwrap();
        
        let original_attrs = std::fs::metadata(&file_path).unwrap().file_attributes();
        
        edit_file(&file_path, "original", "modified").unwrap();
        
        let new_attrs = std::fs::metadata(&file_path).unwrap().file_attributes();
        assert_eq!(original_attrs, new_attrs);
    }
}
```

### Real-World File Testing

```rust
mod real_world_tests {
    use std::collections::HashMap;
    
    struct RealWorldTestSuite {
        test_files: HashMap<String, Vec<u8>>,
    }
    
    impl RealWorldTestSuite {
        pub fn new() -> Self {
            let mut suite = Self {
                test_files: HashMap::new(),
            };
            
            // Add various real-world file types
            suite.add_test_file("source_code.rs", include_bytes!("../src/lib.rs"));
            suite.add_test_file("json_config.json", br#"{"key": "value", "nested": {"array": [1, 2, 3]}}"#);
            suite.add_test_file("markdown.md", b"# Header\n\nSome **bold** text with [links](http://example.com).");
            suite.add_test_file("xml_data.xml", b"<?xml version=\"1.0\"?><root><item>data</item></root>");
            
            // Add edge case files
            suite.add_test_file("empty.txt", b"");
            suite.add_test_file("single_char.txt", b"a");
            suite.add_test_file("all_unicode.txt", "🦀🔥💯🎯🚀".as_bytes());
            
            suite
        }
        
        fn add_test_file(&mut self, name: &str, content: &[u8]) {
            self.test_files.insert(name.to_string(), content.to_vec());
        }
        
        pub fn run_all_tests(&self) {
            for (filename, content) in &self.test_files {
                println!("Testing file: {}", filename);
                self.test_file_operations(filename, content);
            }
        }
        
        fn test_file_operations(&self, filename: &str, content: &[u8]) {
            if let Ok(text) = String::from_utf8(content.clone()) {
                // Test basic operations
                let result = edit_text(&text, "test", "TEST");
                assert!(String::from_utf8(result.into_bytes()).is_ok());
                
                // Test with empty replacement
                let result = edit_text(&text, "nonexistent", "");
                assert_eq!(result, text);
                
                // Test with Unicode patterns
                if text.contains("🦀") {
                    let result = edit_text(&text, "🦀", "crab");
                    assert!(!result.contains("🦀"));
                    assert!(result.contains("crab"));
                }
            }
        }
    }
    
    #[test]
    fn test_real_world_files() {
        let suite = RealWorldTestSuite::new();
        suite.run_all_tests();
    }
}
```

---

## Memory Safety and Leak Detection

### Miri Integration

```rust
// Run with: cargo +nightly miri test
#[cfg(miri)]
mod miri_tests {
    use super::*;
    
    #[test]
    fn miri_edit_operations() {
        let text = "Hello, world!";
        let result = edit_text(text, "world", "Rust");
        assert_eq!(result, "Hello, Rust!");
        
        // Test with potentially problematic operations
        let text = "a".repeat(1000);
        let result = edit_text(&text, "a", "");
        assert!(result.is_empty());
    }
    
    #[test]
    fn miri_unicode_operations() {
        let text = "Hello 世界 🦀";
        let result = edit_text(text, "🦀", "Rust");
        assert_eq!(result, "Hello 世界 Rust");
    }
}
```

### Valgrind Integration

```bash
# Install valgrind
sudo apt-get install valgrind

# Run tests with valgrind
cargo test --target x86_64-unknown-linux-gnu
valgrind --tool=memcheck --leak-check=full ./target/debug/deps/test_binary

# Automated valgrind testing
#!/bin/bash
cargo test --no-run
for binary in target/debug/deps/test_*[^.]*; do
    if [[ -x "$binary" ]]; then
        echo "Running valgrind on $binary"
        valgrind --tool=memcheck --leak-check=full --error-exitcode=1 "$binary"
    fi
done
```

### Custom Memory Tracking

```rust
use std::sync::atomic::{AtomicUsize, Ordering};
use std::alloc::{GlobalAlloc, Layout, System};

pub struct LeakDetector {
    allocated: AtomicUsize,
    deallocated: AtomicUsize,
    allocation_count: AtomicUsize,
}

impl LeakDetector {
    pub const fn new() -> Self {
        Self {
            allocated: AtomicUsize::new(0),
            deallocated: AtomicUsize::new(0), 
            allocation_count: AtomicUsize::new(0),
        }
    }
    
    pub fn current_usage(&self) -> usize {
        self.allocated.load(Ordering::SeqCst) - self.deallocated.load(Ordering::SeqCst)
    }
    
    pub fn allocation_count(&self) -> usize {
        self.allocation_count.load(Ordering::SeqCst)
    }
    
    pub fn reset(&self) {
        self.allocated.store(0, Ordering::SeqCst);
        self.deallocated.store(0, Ordering::SeqCst);
        self.allocation_count.store(0, Ordering::SeqCst);
    }
}

static LEAK_DETECTOR: LeakDetector = LeakDetector::new();

pub struct TrackingAllocator;

unsafe impl GlobalAlloc for TrackingAllocator {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        let ptr = System.alloc(layout);
        if !ptr.is_null() {
            LEAK_DETECTOR.allocated.fetch_add(layout.size(), Ordering::SeqCst);
            LEAK_DETECTOR.allocation_count.fetch_add(1, Ordering::SeqCst);
        }
        ptr
    }

    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        System.dealloc(ptr, layout);
        LEAK_DETECTOR.deallocated.fetch_add(layout.size(), Ordering::SeqCst);
    }
}

#[cfg(test)]
mod leak_detection_tests {
    use super::*;
    
    #[test] 
    fn test_no_memory_leaks() {
        LEAK_DETECTOR.reset();
        let initial_usage = LEAK_DETECTOR.current_usage();
        
        {
            let text = "test content".repeat(1000);
            let result = edit_text(&text, "content", "data");
            drop(result);
        }
        
        // Allow for some allocator overhead
        let final_usage = LEAK_DETECTOR.current_usage();
        assert!(final_usage <= initial_usage + 1024, 
                "Memory leak detected: {} bytes", final_usage - initial_usage);
    }
}
```

---

## Recommended Testing Architecture

### Test Organization Structure

```
tests/
├── unit/                    # Unit tests for individual functions
│   ├── mod.rs
│   ├── edit_operations.rs
│   ├── unicode_handling.rs
│   └── validation.rs
├── integration/             # Integration tests
│   ├── mod.rs
│   ├── file_operations.rs
│   ├── cross_platform.rs
│   └── real_world_files.rs
├── property/                # Property-based tests
│   ├── mod.rs
│   ├── edit_properties.rs
│   └── invariants.rs
├── performance/             # Performance regression tests
│   ├── mod.rs
│   └── benchmarks.rs
└── regression/              # Regression tests from bug reports
    ├── mod.rs
    └── github_issues.rs

fuzz/
├── fuzz_targets/
│   ├── edit_operations.rs
│   ├── multi_edit.rs
│   ├── unicode_edge_cases.rs
│   └── large_file_ops.rs
└── corpus/                  # Seed inputs for fuzzing

benches/
├── micro_benchmarks.rs      # Micro-benchmarks
├── macro_benchmarks.rs      # End-to-end benchmarks  
└── memory_benchmarks.rs     # Memory usage benchmarks
```

### Continuous Integration Integration

```yaml
# .github/workflows/comprehensive-testing.yml
name: Comprehensive Testing

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run unit tests
        run: cargo test --lib
  
  property-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run property-based tests  
        run: cargo test --test property
        env:
          PROPTEST_CASES: 10000
  
  integration-tests:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v3
      - name: Run integration tests
        run: cargo test --test integration
  
  fuzzing:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install cargo-fuzz
        run: cargo install cargo-fuzz
      - name: Run fuzzing (short)
        run: |
          cargo fuzz run edit_operations -- -max_total_time=300
          cargo fuzz run multi_edit -- -max_total_time=300
  
  miri:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install Miri
        run: |
          rustup toolchain install nightly --component miri
          rustup override set nightly
      - name: Run Miri
        run: cargo miri test
  
  benchmarks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run benchmarks
        run: |
          cargo bench --bench micro_benchmarks
          cargo bench --bench macro_benchmarks
      - name: Store benchmark results
        uses: benchmark-action/github-action-benchmark@v1
        with:
          tool: 'cargo'
          output-file-path: target/criterion/report/index.html
```

### Test Configuration

```toml
# Cargo.toml test configuration
[dev-dependencies]
proptest = "1.0"
criterion = { version = "0.5", features = ["html_reports"] }
tempfile = "3.0"
arbitrary = { version = "1.0", features = ["derive"] }

[[bench]]
name = "micro_benchmarks"
harness = false

[[bench]] 
name = "macro_benchmarks"
harness = false

[[bench]]
name = "memory_benchmarks" 
harness = false

[package.metadata.fuzz]
targets = [
    "edit_operations",
    "multi_edit",
    "unicode_edge_cases",
    "large_file_ops"
]
```

---

## Implementation Examples

### Complete Test Suite Template

```rust
// tests/comprehensive_test_suite.rs
use proptest::prelude::*;
use criterion::{criterion_group, criterion_main, Criterion};
use file_ops::*;

// Property-based test examples
mod property_tests {
    use super::*;
    
    proptest! {
        #![proptest_config(ProptestConfig::with_cases(10000))]
        
        #[test]
        fn prop_edit_preserves_length_invariant(
            text in prop::string::string_regex(r".{0,1000}").unwrap(),
            pattern in prop::string::string_regex(r".{1,10}").unwrap(),
            replacement in prop::string::string_regex(r".{0,20}").unwrap()
        ) {
            let original_count = text.matches(&pattern).count();
            let result = edit_text(&text, &pattern, &replacement);
            let new_count = result.matches(&pattern).count();
            
            // If replacement doesn't contain the pattern, count should be 0
            if !replacement.contains(&pattern) {
                prop_assert_eq!(new_count, 0);
            }
        }
        
        #[test] 
        fn prop_edit_idempotent_when_no_matches(
            text in prop::string::string_regex(r"[^x]{0,100}").unwrap(),
            replacement in prop::string::string_regex(r".{0,20}").unwrap()
        ) {
            let pattern = "x"; // Pattern that won't match
            let result1 = edit_text(&text, pattern, &replacement);
            let result2 = edit_text(&result1, pattern, &replacement);
            prop_assert_eq!(result1, result2);
        }
    }
}

// Fuzz testing integration
#[cfg(fuzzing)]
mod fuzz_integration {
    use super::*;
    
    pub fn fuzz_edit_operations(data: &[u8]) {
        if let Ok(input) = std::str::from_utf8(data) {
            let parts: Vec<&str> = input.splitn(3, '\x00').collect();
            if parts.len() == 3 {
                let _ = edit_text(parts[0], parts[1], parts[2]);
            }
        }
    }
}

// Benchmark integration  
fn bench_comprehensive(c: &mut Criterion) {
    let mut group = c.benchmark_group("comprehensive");
    
    // Test realistic scenarios
    let scenarios = vec![
        ("small_file", "content ".repeat(100), "content", "modified"),
        ("medium_file", "line\n".repeat(10000), "line", "row"),
        ("unicode_heavy", "Hello 世界! ".repeat(1000), "世界", "World"),
    ];
    
    for (name, text, pattern, replacement) in scenarios {
        group.bench_function(name, |b| {
            b.iter(|| edit_text(&text, pattern, replacement))
        });
    }
    
    group.finish();
}

criterion_group!(benches, bench_comprehensive);
criterion_main!(benches);
```

---

## Conclusion

This comprehensive testing strategy provides multiple layers of verification for file editing operations:

1. **Property-based testing** ensures invariants hold across diverse inputs
2. **Fuzzing** discovers edge cases and potential crashes through coverage-guided exploration  
3. **Benchmarking** provides performance regression detection and optimization targets
4. **Integration testing** validates real-world usage patterns and cross-platform compatibility
5. **Memory safety testing** prevents leaks and undefined behavior

The combination of these approaches provides confidence in the correctness, performance, and reliability of file editing operations across the full spectrum of possible inputs and usage scenarios.

### Key Recommendations

1. **Start with property-based tests** to define and verify core invariants
2. **Implement continuous fuzzing** in CI/CD pipelines for ongoing security
3. **Use statistical benchmarking** with Criterion for reliable performance measurement
4. **Generate comprehensive edge cases** including Unicode, encoding, and platform-specific scenarios
5. **Integrate memory safety tools** (Miri, Valgrind) into regular testing workflows
6. **Maintain test corpus** from real-world files and bug reports for regression testing

This multi-faceted approach ensures robust, performant, and reliable file editing functionality suitable for production use.