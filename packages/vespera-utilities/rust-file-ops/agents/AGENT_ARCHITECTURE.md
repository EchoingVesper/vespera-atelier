# Agent Architecture: System Design

## Objective
Design the complete architecture for the rust-file-ops library based on research findings, behavioral specifications, and test requirements.

## Inputs to Review

### Research Documents
- `/research/string_matching_research.md` - Myers diff algorithm, rope structures
- `/research/rust_patterns_research.md` - Rust idioms, error handling
- `/research/testing_strategies_research.md` - Testing approaches

### Specifications
- `/specs/*.feature` - 133 behavioral scenarios
- `/tests/` - Test structure showing expected API
- `ARCHITECTURE_DECISION_001.md` - Library architecture decision

## Deliverables Required

### 1. Module Structure Design
```
src/
├── lib.rs           # Public API surface
├── edit/
│   ├── mod.rs       # Edit module organization
│   ├── operation.rs # EditOperation types
│   ├── single.rs    # Single edit implementation
│   ├── multi.rs     # Multi-edit implementation
│   └── matcher.rs   # String matching engine
├── error.rs         # Error types with thiserror
├── rope/
│   ├── mod.rs       # Rope wrapper around Ropey
│   └── adapter.rs   # Rope<->String conversions
├── unicode/
│   ├── mod.rs       # Unicode utilities
│   ├── normalize.rs # NFC normalization
│   └── boundary.rs  # Character boundary handling
├── io/
│   ├── mod.rs       # File I/O operations
│   ├── reader.rs    # Efficient file reading
│   └── writer.rs    # Atomic file writing
└── chunking/        # Document chunking (Phase 2 prep)
    └── mod.rs       # Placeholder for future
```

### 2. Public API Design
```rust
// Clean, minimal public API
pub struct EditOperation {
    pub old_string: String,
    pub new_string: String,
    pub replace_all: bool,
}

pub enum EditError {
    StringNotFound { ... },
    MultipleMatches { ... },
    EncodingError { ... },
    IoError { ... },
}

pub fn edit_file(path: &Path, operation: EditOperation) -> Result<EditResult>;
pub fn multi_edit_file(path: &Path, operations: Vec<EditOperation>) -> Result<MultiEditResult>;
```

### 3. Internal Architecture
- Myers diff for string matching
- Ropey for text representation
- Atomic file operations with temp files
- UTF-8 validation and NFC normalization
- Memory-mapped files for large files (>8MB)

### 4. Error Handling Strategy
- Use `thiserror` for error definitions
- Structured errors with context
- Programmatic error handling for library consumers
- Clear error recovery paths

### 5. Performance Strategy
- Lazy loading for large files
- Streaming for files >100MB
- Memory mapping for 8-100MB files
- Pre-allocation for known sizes
- SIMD for string searching (memchr)

### 6. Testing Strategy
- Unit tests for internal modules
- Integration tests for public API
- Property tests for invariants
- Benchmarks for performance
- Fuzzing for edge cases

## Architecture Document
Create `ARCHITECTURE.md` with:
1. System overview
2. Module responsibilities
3. Data flow diagrams
4. API documentation
5. Error handling philosophy
6. Performance characteristics
7. Extension points

## Implementation Roadmap
Create `IMPLEMENTATION_PLAN.md` with:
1. Core types (EditOperation, EditError)
2. String matching engine
3. Single edit implementation
4. Multi-edit implementation
5. File I/O layer
6. Unicode handling
7. Integration and testing

## Success Criteria
- Clean separation of concerns
- Minimal public API surface
- Extensible for future features (chunking)
- Performance targets achievable
- All behavioral specs satisfiable
- Test scaffolding aligns with design