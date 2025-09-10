# Rust File Ops Enhancement Requirements

## Executive Summary

The rust-file-ops package needs significant enhancements to support the VS Code Vespera Forge extension integration. While it currently provides basic file operations and Python bindings, it lacks the precise editing capabilities required for AI agent task execution with TypeScript/lint error prevention.

## Current Capabilities

### ✅ Already Implemented
1. **Reading Operations**
   - Read file as bytes/string
   - Read file lines
   - Chunked reading with callbacks
   - Memory-mapped reading for large files

2. **Writing Operations**
   - Write bytes/string to file
   - Append to file
   - Atomic file writing (write to temp, then rename)

3. **Basic Editing** (Limited)
   - `replace_in_file`: Regex-based find/replace (all occurrences)
   - `edit_file_lines`: Replace entire lines by line number

4. **Search Operations**
   - Text search with regex
   - Directory-wide search
   - Glob pattern matching

5. **File System Operations**
   - Create/remove directories
   - List directory contents
   - File info and SHA256 hashing
   - Basic file watching

## Critical Missing Features

### ✅ Priority 1: Precise Scope-Limited Editing (COMPLETED - Phase 1)

**Current Gap**: ~~No ability to replace specific text occurrences or limit edits to precise file regions.~~ **RESOLVED in PR #69**

**Implemented Features** (matching Claude Code's Edit/MultiEdit):
```rust
pub struct EditOperation {
    pub old_string: String,      // Exact text to find
    pub new_string: String,      // Replacement text
    pub replace_all: bool,       // Replace all occurrences or just first
    pub line_range: Option<(usize, usize)>, // Optional line range restriction
}

pub fn edit_file(path: &str, operations: Vec<EditOperation>) -> Result<EditResult>
pub fn multi_edit_file(path: &str, edits: Vec<EditOperation>) -> Result<MultiEditResult>
```

**Delivered Capabilities**:
- ✅ Exact string matching including whitespace/indentation (Myers diff algorithm)
- ✅ Support for single vs all occurrence replacement via `replace_all` flag
- ✅ Sequential application of multiple edits (MultiEdit)
- ✅ Detailed error information with `StringNotFound` and `MultipleMatches` errors
- ✅ UTF-8 encoding preservation with character boundary safety
- ✅ Atomic file operations with rollback on failure
- ✅ 41 comprehensive unit tests covering edge cases
- ✅ Performance benchmarks showing 3-10x speedup over Node.js
- ✅ Security validation to prevent directory traversal
- ✅ Python bindings updated with `EditOperation` API

### 🔴 Priority 2: Node.js Bindings (Currently Python-only)

**Current Gap**: Only Python bindings exist via PyO3. VS Code extension needs Node.js bindings.

**Required Implementation**:
```javascript
// Native Node.js addon using N-API or neon
const rustFileOps = require('vespera-file-ops');

// Async/Promise-based API
await rustFileOps.editFile(path, {
  oldString: "const foo = bar",
  newString: "const foo = baz",
  replaceAll: false
});

// Multi-edit support
await rustFileOps.multiEdit(path, [
  { oldString: "foo", newString: "bar", replaceAll: true },
  { oldString: "baz", newString: "qux", replaceAll: false }
]);
```

**Technology Options**:
1. **Neon** (Rust-native Node bindings) - Recommended
2. **N-API** (Node's stable C API)
3. **WASM** (WebAssembly) - Portable but slower

### 🔴 Priority 3: TypeScript/Lint Error Detection Hooks

**Current Gap**: No ability to validate edited files for TypeScript/lint errors.

**Required Features**:
```rust
pub struct ValidationConfig {
    pub check_typescript: bool,
    pub check_eslint: bool,
    pub tsconfig_path: Option<String>,
    pub eslint_config_path: Option<String>,
}

pub fn validate_file_after_edit(
    path: &str,
    validation_config: &ValidationConfig
) -> Result<ValidationResult>

pub struct ValidationResult {
    pub typescript_errors: Vec<TSError>,
    pub lint_errors: Vec<LintError>,
    pub is_valid: bool,
}
```

**Integration Points**:
- Run TypeScript compiler API
- Execute ESLint programmatically
- Block task completion if errors found
- Return detailed error locations and messages

### ✅ Priority 4: Intelligent Document Chunking for LLM Processing (COMPLETED - Phase 2)

**Current Gap**: ~~No ability to intelligently chunk large documents for local LLM processing with limited context windows.~~ **RESOLVED - Discord extraction with local LLM integration implemented**

**Use Case**: Processing large Discord chat logs (8MB+ HTML files) to extract fiction project development ideas, requiring:
- Smart chunking that preserves conversation context
- Natural conversation break detection
- Metadata preservation across chunks
- Interactive LLM querying with human confirmation
- Incremental data organization and appending

**Required Features**:
```rust
pub struct ChunkingConfig {
    pub max_chunk_size: usize,        // Target size in tokens/chars
    pub overlap_size: usize,          // Overlap between chunks for context
    pub chunk_strategy: ChunkStrategy,
    pub preserve_metadata: bool,
    pub format: DocumentFormat,
}

pub enum ChunkStrategy {
    FixedSize,                        // Simple size-based splitting
    SentenceBoundary,                 // Split at sentence endings
    ParagraphBoundary,                // Split at paragraph breaks
    ConversationBreak,                // Smart detection of conversation boundaries
    HTMLStructureAware,               // Preserve HTML structure (for Discord logs)
    SemanticSimilarity,               // Group semantically related content
}

pub struct DocumentChunk {
    pub id: String,                   // Unique chunk identifier
    pub content: String,              // Chunk content
    pub metadata: ChunkMetadata,
    pub embeddings: Option<Vec<f32>>, // For semantic search
}

pub struct ChunkMetadata {
    pub source_file: String,
    pub chunk_index: usize,
    pub total_chunks: usize,
    pub byte_range: (usize, usize),
    pub timestamp_range: Option<(String, String)>, // For chat logs
    pub participants: Vec<String>,    // For conversation tracking
    pub topics: Vec<String>,          // Extracted topics/keywords
    pub parent_chunk: Option<String>, // For hierarchical chunking
    pub child_chunks: Vec<String>,
}

// Main chunking API
pub fn chunk_document(
    path: &str,
    config: ChunkingConfig
) -> Result<Vec<DocumentChunk>>

// Specialized for Discord HTML exports
pub fn chunk_discord_export(
    path: &str,
    preserve_conversations: bool,
    max_tokens_per_chunk: usize
) -> Result<Vec<ConversationChunk>>

pub struct ConversationChunk {
    pub messages: Vec<DiscordMessage>,
    pub participants: Vec<String>,
    pub time_range: (DateTime, DateTime),
    pub detected_topics: Vec<String>,
    pub continuation_context: Option<String>, // Context from previous chunk
}

// Interactive processing support
pub struct ChunkProcessor {
    pub chunks: Vec<DocumentChunk>,
    pub current_index: usize,
    pub processed_data: HashMap<String, ProcessedInfo>,
}

impl ChunkProcessor {
    pub fn next_chunk(&mut self) -> Option<&DocumentChunk>
    pub fn mark_relevant(&mut self, chunk_id: &str, relevance_score: f32)
    pub fn extract_data(&mut self, chunk_id: &str, extracted: ExtractedData)
    pub fn request_human_review(&self, chunk_id: &str) -> ReviewRequest
    pub fn append_refinement(&mut self, original_id: &str, refinement: String)
}
```

**Discord-Specific Features**:
```rust
// Parse Discord HTML exports
pub fn parse_discord_html(path: &str) -> Result<DiscordChatLog>

pub struct DiscordChatLog {
    pub messages: Vec<DiscordMessage>,
    pub participants: HashSet<String>,
    pub date_range: (DateTime, DateTime),
    pub total_messages: usize,
    pub attachments: Vec<Attachment>,
}

pub struct DiscordMessage {
    pub id: String,
    pub author: String,
    pub timestamp: DateTime,
    pub content: String,
    pub attachments: Vec<String>,
    pub reactions: Vec<Reaction>,
    pub reply_to: Option<String>,
    pub thread_id: Option<String>,
}

// Intelligent conversation detection
pub fn detect_conversation_boundaries(
    messages: &[DiscordMessage],
    time_gap_threshold: Duration,
    topic_similarity_threshold: f32
) -> Vec<ConversationBoundary>

// Extract and organize fiction project data
pub struct FictionProjectExtractor {
    pub story_elements: Vec<StoryElement>,
    pub character_notes: HashMap<String, CharacterInfo>,
    pub world_building: Vec<WorldBuildingNote>,
    pub plot_points: Vec<PlotPoint>,
    pub revision_history: HashMap<String, Vec<Revision>>,
}
```

**LLM Integration Support**:
```rust
// Prepare chunks for LLM processing
pub fn prepare_for_llm(
    chunk: &DocumentChunk,
    context_window: usize,
    include_metadata: bool
) -> LLMInput

// Track LLM processing state
pub struct LLMProcessingSession {
    pub chunks_processed: Vec<String>,
    pub chunks_pending: Vec<String>,
    pub extracted_data: HashMap<String, Value>,
    pub human_confirmations: Vec<Confirmation>,
    pub processing_history: Vec<ProcessingEvent>,
}

// Support incremental refinement
pub fn merge_extracted_data(
    original: &ExtractedData,
    refinement: &ExtractedData,
    merge_strategy: MergeStrategy
) -> ExtractedData

pub enum MergeStrategy {
    Append,           // Add new info without removing old
    Override,         // Replace old with new
    Versioned,        // Keep both with version tracking
    Contextual,       // Smart merge based on content
}
```

### 🟡 Priority 5: Enhanced Error Handling

**Current Gap**: Basic error types don't provide enough context for debugging.

**Required Enhancements**:
```rust
pub enum EditError {
    StringNotFound { 
        search_string: String,
        file_path: String,
        similar_matches: Vec<String>, // Suggest similar strings
    },
    MultipleMatches {
        search_string: String,
        locations: Vec<LineLocation>,
        file_path: String,
    },
    ValidationFailed {
        typescript_errors: Vec<String>,
        lint_errors: Vec<String>,
    },
}
```

### 🟡 Priority 6: Performance Optimizations

**Current Gap**: Not optimized for rapid successive edits common in AI agents.

**Required Features**:
- File content caching between edits
- Incremental validation (only check changed parts)
- Batch edit operations
- Parallel file processing

## Implementation Plan

### ✅ Phase 1: Core Editing Enhancement (COMPLETED)
1. ✅ Implement precise string matching algorithm (Myers diff)
2. ✅ Add EditOperation struct and edit_file function
3. ✅ Implement multi_edit_file with sequential application
4. ✅ Add comprehensive tests for edge cases (41 tests)

### ✅ Phase 2: Document Chunking System (COMPLETED)
1. ✅ Implement base chunking strategies (fixed, sentence, paragraph)
2. ✅ Add Discord HTML parser for chat log processing
3. ✅ Implement conversation boundary detection
4. ✅ Create chunk metadata system
5. ✅ Add LLM preparation utilities
6. ✅ Ollama integration for local LLM processing
7. ✅ Story element extraction (characters, plot, world-building, themes)

### 🚧 Phase 3: Discord Extraction Enhancement (IN PROGRESS)
**New capabilities being added:**
1. **Interactive Confidence System**
   - Confidence scoring (0.0-1.0) for relevance
   - User query for uncertain elements (0.3-0.7 range)
   - Pattern learning from user decisions
   - Batch review interface

2. **VS Code Discord-like Interface**
   - Channel-based agent interactions
   - Persistent conversation history
   - Interactive review messages
   - Archive and search functionality

3. **Story Element Staging**
   - Staging area for extracted elements
   - Evolution tracking (how concepts changed over time)
   - Conflict detection and resolution
   - Repurposing old ideas for other projects

4. **Advanced Processing**
   - NSFW content handling via local LLMs
   - Incremental data organization
   - Export to multiple formats (story bible, timeline, idea bank)

### Phase 4: Node.js Bindings (Week 3)
1. Set up Neon project structure
2. Create JavaScript API wrapper for file ops
3. Add chunking API bindings
4. Implement async/Promise interface
5. Add TypeScript definitions (.d.ts files)
6. Create npm package configuration

### Phase 4: Validation Integration (Week 4)
1. Integrate TypeScript Compiler API
2. Add ESLint programmatic API
3. Implement validation hooks
4. Create configuration system
5. Add validation result types

### Phase 5: Testing & Integration (Week 5)
1. Comprehensive unit tests
2. Integration tests with VS Code extension
3. Discord log processing tests
4. Performance benchmarking
5. Documentation and examples

## Success Criteria

1. **Functional Requirements**
   - [x] Exact string replacement matching Claude Code's Edit tool
   - [x] Multi-edit operations applying in sequence
   - [x] Intelligent document chunking with conversation detection
   - [x] Discord HTML chat log parsing and processing
   - [x] LLM-ready chunk preparation with metadata
   - [ ] Node.js bindings with async/Promise API
   - [ ] TypeScript/ESLint validation hooks
   - [x] Detailed error messages with suggestions

2. **Performance Requirements**
   - [ ] 3-15x faster than Node.js fs operations
   - [ ] < 100ms for typical file edit
   - [ ] < 500ms for validation check
   - [ ] < 1s to chunk 8MB HTML file
   - [ ] Memory usage < 50MB for 10MB file
   - [ ] Stream processing for files > 100MB

3. **Quality Requirements**
   - [ ] 100% test coverage for critical paths
   - [ ] TypeScript definitions for all APIs
   - [ ] Comprehensive error handling
   - [ ] Thread-safe operations

## Example Usage (After Enhancement)

### Rust API
```rust
use vespera_file_ops::{edit_file, EditOperation, ValidationConfig};

let edits = vec![
    EditOperation {
        old_string: "const oldName = value".to_string(),
        new_string: "const newName = value".to_string(),
        replace_all: false,
        line_range: Some((10, 50)),
    }
];

let result = edit_file("src/main.rs", edits)?;

// Validate after edit
let validation = ValidationConfig {
    check_typescript: true,
    check_eslint: true,
    ..Default::default()
};

let validation_result = validate_file_after_edit("src/main.ts", &validation)?;
if !validation_result.is_valid {
    // Block task completion
    return Err(EditError::ValidationFailed { ... });
}
```

### Node.js API
```javascript
const { editFile, validateFile } = require('vespera-file-ops');

// Precise editing
const result = await editFile('src/component.tsx', {
  oldString: 'interface Props {',
  newString: 'interface ComponentProps {',
  replaceAll: false
});

// Validation
const validation = await validateFile('src/component.tsx', {
  checkTypescript: true,
  checkEslint: true,
  tsconfigPath: './tsconfig.json'
});

if (!validation.isValid) {
  throw new Error(`Validation failed: ${validation.errors}`);
}
```

## Dependencies

### New Rust Dependencies
```toml
[dependencies]
# For Node.js bindings
neon = "0.10"
neon-runtime = "0.10"

# For TypeScript/ESLint integration
swc_core = "0.40"  # Fast TS parsing
tree-sitter = "0.20"  # Syntax tree analysis

# For document chunking
scraper = "0.18"  # HTML parsing (Discord logs)
chrono = "0.4"    # DateTime handling
tiktoken-rs = "0.5"  # Token counting for LLMs
similar = "2.3"   # Text similarity detection
rayon = "1.7"     # Parallel processing

[dev-dependencies]
criterion = "0.5"  # Benchmarking
proptest = "1.0"   # Property-based testing
```

### Node.js Package Dependencies
```json
{
  "devDependencies": {
    "typescript": "^5.0.0",
    "eslint": "^8.0.0",
    "@types/node": "^20.0.0"
  }
}
```

## Risk Mitigation

1. **Compatibility Risk**: Ensure edits preserve file encoding, line endings
2. **Performance Risk**: Benchmark against real-world VS Code usage patterns
3. **Integration Risk**: Test with actual VS Code extension early
4. **Validation Risk**: Handle TypeScript/ESLint version differences gracefully

## Phase 3 Discord Extraction API (BMAD-METHOD Spec)

Following the BMAD-METHOD approach for spec-driven development:

### API Specification
```typescript
interface DiscordExtractionAPI {
  // Core extraction with confidence
  extractWithConfidence(
    file: string,
    config: ExtractionConfig
  ): AsyncIterator<ExtractionResult>
  
  // Interactive review
  reviewUncertain(
    element: StoryElement,
    confidence: number
  ): Promise<UserDecision>
  
  // Pattern learning
  learnFromDecision(
    element: StoryElement,
    decision: UserDecision
  ): void
  
  // Staging management
  stageElement(
    element: StoryElement,
    category: 'keep' | 'maybe' | 'discard' | 'repurpose'
  ): void
  
  // Evolution tracking
  trackEvolution(
    concept: string,
    timeline: ConceptEvolution[]
  ): void
}
```

### Channel-Based UI Integration
```typescript
interface ChannelAPI {
  // Channel lifecycle
  createChannel(purpose: ExtractionPurpose): Channel
  archiveChannel(channelId: string): void
  reopenChannel(channelId: string): Channel
  
  // Message handling
  postToChannel(channelId: string, message: ChannelMessage): void
  waitForResponse(channelId: string): Promise<UserResponse>
  
  // Batch operations
  batchReview(items: ReviewItem[]): Promise<BatchDecision>
}
```

## Conclusion

These enhancements have transformed rust-file-ops from a basic file operations library into a comprehensive, high-performance file manipulation and content extraction system.

**Completed (Phases 1-2):**
- ✅ Precise editing matching Claude Code's Edit tool (41 tests, 3-10x performance gain)
- ✅ Intelligent Discord HTML chunking with conversation preservation
- ✅ Local LLM integration (Ollama) for privacy-preserving analysis
- ✅ Story element extraction (characters, plot, world-building, themes)
- ✅ Python bindings for all new functionality

**In Progress (Phase 3):**
- 🚧 Interactive confidence-based review system
- 🚧 Discord-like channel interface for agent interactions
- 🚧 Story element staging and evolution tracking
- 🚧 Pattern learning from user decisions
- 🚧 BMAD-METHOD spec-driven development

The system now enables robust, error-free code generation while providing powerful tools for mining creative content from conversation logs with complete privacy preservation.