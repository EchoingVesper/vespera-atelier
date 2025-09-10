//! Benchmarks for string editing operations
//!
//! Run with: cargo bench

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use vespera_file_ops::{
    edit::{single::SingleEditor, multi::MultiEditor},
    types::{EditOperation, EditConfig},
};

/// Generate test content of specified size
fn generate_content(size: usize, pattern_frequency: usize) -> String {
    let base = "The quick brown fox jumps over the lazy dog. ";
    let pattern = "fox";
    let replacement_base = base.replace(pattern, "cat");
    
    let mut content = String::with_capacity(size);
    let mut counter = 0;
    
    while content.len() < size {
        if counter % pattern_frequency == 0 {
            content.push_str(base);
        } else {
            content.push_str(&replacement_base);
        }
        counter += 1;
    }
    
    content.truncate(size);
    content
}

/// Benchmark single string replacement
fn bench_single_replacement(c: &mut Criterion) {
    let mut group = c.benchmark_group("single_replacement");
    
    for size in [1_000, 10_000, 100_000, 1_000_000] {
        let content = generate_content(size, 10);
        let operation = EditOperation::new("fox", "cat", false);
        let editor = SingleEditor::new();
        
        group.bench_with_input(
            BenchmarkId::from_parameter(size),
            &content,
            |b, content| {
                b.iter(|| {
                    let result = editor.apply_edit(
                        black_box(content),
                        black_box(&operation)
                    );
                    black_box(result)
                });
            }
        );
    }
    
    group.finish();
}

/// Benchmark replace all occurrences
fn bench_replace_all(c: &mut Criterion) {
    let mut group = c.benchmark_group("replace_all");
    
    for size in [1_000, 10_000, 100_000, 1_000_000] {
        let content = generate_content(size, 3); // More frequent pattern
        let operation = EditOperation::new("fox", "cat", true);
        let editor = SingleEditor::new();
        
        group.bench_with_input(
            BenchmarkId::from_parameter(size),
            &content,
            |b, content| {
                b.iter(|| {
                    let result = editor.apply_edit(
                        black_box(content),
                        black_box(&operation)
                    );
                    black_box(result)
                });
            }
        );
    }
    
    group.finish();
}

/// Benchmark multi-edit operations
fn bench_multi_edit(c: &mut Criterion) {
    let mut group = c.benchmark_group("multi_edit");
    
    for size in [1_000, 10_000, 100_000] {
        let content = generate_content(size, 5);
        let operations = vec![
            EditOperation::new("fox", "cat", true),
            EditOperation::new("quick", "slow", true),
            EditOperation::new("brown", "black", true),
            EditOperation::new("lazy", "energetic", true),
        ];
        let editor = MultiEditor::new();
        let config = EditConfig::default();
        
        group.bench_with_input(
            BenchmarkId::from_parameter(size),
            &content,
            |b, content| {
                b.iter(|| {
                    let result = editor.apply_edits(
                        black_box(content),
                        black_box(&operations),
                        black_box(&config)
                    );
                    black_box(result)
                });
            }
        );
    }
    
    group.finish();
}

/// Benchmark UTF-8 vs ASCII operations
fn bench_utf8_vs_ascii(c: &mut Criterion) {
    let mut group = c.benchmark_group("utf8_vs_ascii");
    
    // ASCII content
    let ascii_content = generate_content(10_000, 5);
    let ascii_op = EditOperation::new("fox", "cat", true);
    
    // UTF-8 content with emojis and international characters
    let utf8_content = ascii_content.replace("fox", "🦊").replace("dog", "🐕");
    let utf8_op = EditOperation::new("🦊", "🐱", true);
    
    let editor = SingleEditor::new();
    
    group.bench_function("ascii", |b| {
        b.iter(|| {
            let result = editor.apply_edit(
                black_box(&ascii_content),
                black_box(&ascii_op)
            );
            black_box(result)
        });
    });
    
    group.bench_function("utf8", |b| {
        b.iter(|| {
            let result = editor.apply_edit(
                black_box(&utf8_content),
                black_box(&utf8_op)
            );
            black_box(result)
        });
    });
    
    group.finish();
}

/// Benchmark single character optimization
fn bench_single_char_optimization(c: &mut Criterion) {
    let mut group = c.benchmark_group("single_char");
    
    let content = generate_content(100_000, 1);
    let editor = SingleEditor::new();
    
    // Single character search (optimized path)
    let single_char_op = EditOperation::new("x", "y", true);
    
    // Multi-character search (general path)
    let multi_char_op = EditOperation::new("fox", "cat", true);
    
    group.bench_function("single_char", |b| {
        b.iter(|| {
            let result = editor.apply_edit(
                black_box(&content),
                black_box(&single_char_op)
            );
            black_box(result)
        });
    });
    
    group.bench_function("multi_char", |b| {
        b.iter(|| {
            let result = editor.apply_edit(
                black_box(&content),
                black_box(&multi_char_op)
            );
            black_box(result)
        });
    });
    
    group.finish();
}

/// Benchmark memory usage patterns
fn bench_memory_patterns(c: &mut Criterion) {
    let mut group = c.benchmark_group("memory_patterns");
    
    // Test with different size deltas (growing, shrinking, same size)
    let content = generate_content(100_000, 5);
    let editor = SingleEditor::new();
    
    let grow_op = EditOperation::new("fox", "elephant", true); // Grows content
    let shrink_op = EditOperation::new("fox", "x", true);       // Shrinks content
    let same_op = EditOperation::new("fox", "cat", true);       // Same size
    
    group.bench_function("growing", |b| {
        b.iter(|| {
            let result = editor.apply_edit(
                black_box(&content),
                black_box(&grow_op)
            );
            black_box(result)
        });
    });
    
    group.bench_function("shrinking", |b| {
        b.iter(|| {
            let result = editor.apply_edit(
                black_box(&content),
                black_box(&shrink_op)
            );
            black_box(result)
        });
    });
    
    group.bench_function("same_size", |b| {
        b.iter(|| {
            let result = editor.apply_edit(
                black_box(&content),
                black_box(&same_op)
            );
            black_box(result)
        });
    });
    
    group.finish();
}

criterion_group!(
    benches,
    bench_single_replacement,
    bench_replace_all,
    bench_multi_edit,
    bench_utf8_vs_ascii,
    bench_single_char_optimization,
    bench_memory_patterns
);

criterion_main!(benches);