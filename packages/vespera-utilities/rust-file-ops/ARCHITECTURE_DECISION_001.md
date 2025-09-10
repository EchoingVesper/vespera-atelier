# Architecture Decision Record #001: Library Architecture

## Status
Accepted

## Context
The rust-file-ops component needs to provide file editing capabilities to multiple frontend components (VS Code extension, Obsidian plugin, Python MCP servers). We need to decide whether to structure it as an application or a library.

## Decision
We will implement rust-file-ops as a **library** with the following characteristics:

### Library Structure
```toml
# Cargo.toml
[package]
name = "vespera-file-ops"
version = "0.1.0"
edition = "2021"

[lib]
name = "vespera_file_ops"
crate-type = ["lib", "cdylib", "staticlib"]
# lib = Rust library
# cdylib = C dynamic library (for Node.js/Python bindings)
# staticlib = Static library (for embedding)
```

### Error Handling
- Use **`thiserror`** for error definitions (not `anyhow`)
- Provide structured, programmatic error types
- Allow consuming code to handle errors appropriately

### API Design
- Public API in `src/lib.rs`
- Internal modules not exposed
- Semantic versioning for stability
- Comprehensive documentation

### Testing Strategy
- Unit tests for internal functions
- Integration tests for public API
- Doc tests for all examples
- Property tests for invariants

## Consequences

### Positive
- Clean separation between backend and frontend
- Reusable across multiple projects
- Can be published to crates.io
- Type-safe error handling for consumers
- Multiple binding options (Node.js, Python, C)

### Negative
- More careful API design required
- Breaking changes need version bumps
- Documentation must be comprehensive
- Error types must be well-designed upfront

## Implementation Notes

### What "Idempotency" Means
*Idempotent* operations produce the same result when applied multiple times. For our file editing:
- Applying the same edit twice should equal applying it once
- Example: Replacing "foo" with "bar" - doing it twice shouldn't change "bar" to something else
- This is a key property we'll test for

### Library Best Practices
1. **Minimal Public API**: Only expose what's necessary
2. **Zero Dependencies**: Keep core functionality dependency-free when possible
3. **Feature Flags**: Optional features behind cargo features
4. **Examples**: Provide examples/ directory with common use cases
5. **Benchmarks**: Include benches/ for performance tracking

### Binding Layers
The library will have separate binding layers:
```
vespera-file-ops (core Rust library)
    ├── vespera-file-ops-node (Node.js bindings via Neon)
    ├── vespera-file-ops-py (Python bindings via PyO3)
    └── vespera-file-ops-wasm (WebAssembly for browsers)
```

## Example Library API
```rust
// Public library API
pub use edit::{EditOperation, EditResult, MultiEditResult};
pub use error::{EditError, Result};

// Simple, clean public functions
pub fn edit_file(path: &Path, operation: EditOperation) -> Result<EditResult> {
    // Implementation
}

pub fn multi_edit_file(path: &Path, operations: Vec<EditOperation>) -> Result<MultiEditResult> {
    // Implementation
}
```

## Decision Made By
User observation about library vs application distinction in research documents.

## Date
2025-09-09