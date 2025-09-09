# vespera-file-ops

High-performance, Unicode-aware file editing library for Rust with exact string replacement capabilities.

## Features

- 🎯 **Precise String Replacement**: Exact string matching with no regex interpretation
- 🌍 **Full Unicode Support**: UTF-8 safe with proper character boundary handling
- ⚡ **High Performance**: Optimized for large files with memory-efficient algorithms
- 🔄 **Multi-Edit Operations**: Sequential batch edits with atomic transactions
- 🛡️ **Safe File Operations**: Atomic writes with automatic rollback on failure
- 📊 **Rich Feedback**: Detailed results with performance metrics
- 🔧 **Flexible Configuration**: Extensive customization options

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
vespera-file-ops = "0.1.0"
```

## Quick Start

### Simple String Replacement

```rust
use vespera_file_ops::{edit_file, EditOperation};
use std::path::Path;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Replace a single occurrence
    let operation = EditOperation::new("old text", "new text");
    let result = edit_file(Path::new("document.txt"), operation, None)?;
    
    println!("Replaced {} occurrences", result.replacements_made);
    Ok(())
}
```

### Replace All Occurrences

```rust
use vespera_file_ops::{edit_file, EditOperation};

let operation = EditOperation::new("foo", "bar").with_replace_all(true);
let result = edit_file(Path::new("code.rs"), operation, None)?;
```

### Multi-Edit Operations

```rust
use vespera_file_ops::{multi_edit_file, EditOperation};

let operations = vec![
    EditOperation::new("const", "let"),
    EditOperation::new("foo", "bar").with_replace_all(true),
    EditOperation::new("old_name", "new_name"),
];

let result = multi_edit_file(Path::new("source.js"), operations, None)?;

for (i, op_result) in result.operation_results.iter().enumerate() {
    println!("Edit {}: {} replacements", i + 1, op_result.replacements_made);
}
```

### Preview Changes

```rust
use vespera_file_ops::{preview_edit, EditOperation};

// Preview without modifying the file
let operation = EditOperation::new("TODO", "DONE");
let result = preview_edit(Path::new("tasks.md"), operation, None)?;

println!("Would replace {} occurrences", result.replacements_made);
```

## Advanced Usage

### Custom Configuration

```rust
use vespera_file_ops::{edit_file, EditOperation, EditConfig};

let config = EditConfig::default()
    .with_max_file_size(100 * 1024 * 1024)  // 100MB limit
    .with_validate_utf8(true)
    .with_normalize_unicode(true);

let operation = EditOperation::new("café", "coffee");
let result = edit_file(Path::new("menu.txt"), operation, Some(config))?;
```

### Atomic File Operations

```rust
use vespera_file_ops::{edit_file_atomic, EditOperation};

// Ensures file is either fully updated or unchanged
let operation = EditOperation::new("version: 1.0", "version: 2.0");
let result = edit_file_atomic(Path::new("config.yaml"), operation, None)?;
```

### Error Handling

```rust
use vespera_file_ops::{edit_file, EditOperation, EditError};

let operation = EditOperation::new("needle", "replacement");
match edit_file(Path::new("haystack.txt"), operation, None) {
    Ok(result) => println!("Success: {} replacements", result.replacements_made),
    Err(EditError::StringNotFound { search_string, .. }) => {
        println!("String '{}' not found", search_string);
    }
    Err(EditError::IoError { path, source }) => {
        println!("Failed to access {}: {}", path, source);
    }
    Err(e) => println!("Edit failed: {}", e),
}
```

## Performance

The library is optimized for various file sizes:

- **Small files (< 1MB)**: Direct string operations
- **Medium files (1-16MB)**: Buffered processing
- **Large files (> 16MB)**: Memory-mapped I/O with streaming

Benchmarks on a typical developer machine:

| File Size | Operation | Time |
|-----------|-----------|------|
| 1 KB | Single replacement | < 1ms |
| 100 KB | Replace all (50 matches) | < 5ms |
| 10 MB | Single replacement | < 50ms |
| 100 MB | Replace all (1000 matches) | < 500ms |

## Unicode Support

Full Unicode support with:
- UTF-8 validation and character boundary preservation
- NFC normalization (optional)
- Grapheme cluster awareness
- Mixed script handling
- Bidirectional text support

```rust
// Safely handles Unicode
let operation = EditOperation::new("😀", "😎");
let result = edit_file(Path::new("emoji.txt"), operation, None)?;

// Preserves combining characters
let operation = EditOperation::new("naïve", "naive");
let result = edit_file(Path::new("text.txt"), operation, None)?;
```

## Architecture

Built as a library-first design with:
- Clean separation of concerns
- Minimal public API surface
- Zero unsafe code in core operations
- Comprehensive error handling
- Extensive test coverage (100+ tests)

## Testing

Run the test suite:

```bash
cargo test
```

Run benchmarks:

```bash
cargo bench
```

Run fuzzing:

```bash
cargo fuzz run edit_fuzzer
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).

## Acknowledgments

- Uses the Myers diff algorithm for optimal string matching
- Inspired by text editor implementations from VS Code and xi-editor
- Built with the Rust community's excellent ecosystem

---

Part of the [Vespera Atelier](https://github.com/EchoingVesper/vespera-atelier) project.