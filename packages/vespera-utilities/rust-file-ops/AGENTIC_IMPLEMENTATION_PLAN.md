# Agentic Implementation Plan for rust-file-ops Enhancement

## Overview

This document outlines the agent-based implementation strategy for enhancing rust-file-ops with precise editing, document chunking, Node.js bindings, and validation hooks.

## Agent Workflow Pattern

Each phase follows this **spec-driven** pattern:
```
[Setup] → [Research] → [Spec Design] → [Architecture] → [Implementation] → [Testing] → [Documentation] → [Closure]
   ↓         ↓             ↓               ↓                ↓                ↓              ↓              ↓
Worktree  Parallel    Test Specs      Review &         Parallel          Verify        Update        PR & Issue
Branch    Research    Before Code     Architect      Atomic Agents       Specs         Docs         Updates
```

### Spec-Driven Development Benefits

1. **Test-First Approach**: Write test specifications before implementation
2. **Clear Success Criteria**: Every agent knows exactly what to build
3. **Parallel Test Writing**: Tests can be written while implementation proceeds
4. **Reduce Rework**: Catch design issues before coding
5. **Living Documentation**: Specs serve as behavior documentation

## Phase 1: Core Editing Enhancement (Week 1)

### 1.1 Setup Agent
**Sequential - 1 agent**
```bash
# Create feature branch and worktree
git worktree add -b feature/rust-file-ops-editing ../rust-editing-enhancement
cd ../rust-editing-enhancement
```
- Create tracking issue from #57
- Set up project structure

### 1.2 Research Agents
**Parallel - 3 agents**

**Agent A: String Matching Research**
- Research text diffing algorithms (Myers, Hunt-McIlroy)
- Study VS Code's edit implementation
- Investigate rope data structures for efficient editing
- Research: https://github.com/microsoft/vscode source

**Agent B: Rust Best Practices**
- Research Rust string manipulation patterns
- Study similar projects (xi-editor, helix)
- Error handling patterns for edit operations
- Research: https://github.com/xi-editor/xi-editor

**Agent C: Testing Strategies**
- Property-based testing for edit operations
- Fuzzing strategies for edge cases
- Benchmark methodology for performance validation
- Research quickcheck and proptest crates

### 1.3 Spec-Driven Test Design Agents
**Parallel - 2 agents** (NEW - Before Architecture)

**Agent SPEC-A: Behavioral Specifications**
- Write Gherkin-style scenarios for edit operations
- Define expected behaviors for edge cases
- Create test specifications BEFORE implementation
- Example specs:
```gherkin
Feature: Precise String Editing
  Scenario: Edit preserves whitespace
    Given a file with "  const foo = bar  "
    When I replace "foo" with "baz"
    Then the file contains "  const baz = bar  "
```

**Agent SPEC-B: Test Scaffolding**
- Create test files with empty implementations
- Set up property-based test templates
- Define performance benchmarks criteria
- Create integration test harness
```rust
#[test]
fn test_edit_preserves_whitespace() {
    todo!("Implementation pending")
}
```

### 1.4 Architecture Agent
**Sequential - 1 agent** (Now incorporates test specs)
- Review all research findings
- **Review test specifications and adjust design**
- Design EditOperation trait system
- Create error type hierarchy
- Design caching strategy for repeated edits
- Write architectural decision record (ADR)
- **Ensure architecture satisfies all test specs**

### 1.5 Implementation Agents
**Parallel then Sequential - 6 agents**

**Parallel Group 1 (3 agents):**

**Agent D: Core Edit Types**
```rust
// src/edit/mod.rs
pub struct EditOperation { ... }
pub enum EditError { ... }
pub trait Editable { ... }
```

**Agent E: String Matching Engine**
```rust
// src/edit/matcher.rs
pub fn find_exact_match(haystack: &str, needle: &str) -> Option<Range>
pub fn find_all_matches(haystack: &str, needle: &str) -> Vec<Range>
```

**Agent F: File Reader Enhancement**
```rust
// src/io/reader.rs enhancement
pub fn read_with_line_mapping(path: &str) -> (String, LineMap)
```

**Sequential Group 2 (3 agents - depends on Group 1):**

**Agent G: Single Edit Implementation**
```rust
// src/edit/single.rs
pub fn edit_file(path: &str, operation: EditOperation) -> Result<EditResult>
```

**Agent H: Multi-Edit Implementation**
```rust
// src/edit/multi.rs
pub fn multi_edit_file(path: &str, operations: Vec<EditOperation>) -> Result<MultiEditResult>
```

**Agent I: Python Bindings Update**
```rust
// src/python.rs additions
#[pyfunction]
pub fn py_edit_file(path: &str, old: &str, new: &str, all: bool) -> PyResult<usize>
```

### 1.6 Testing Agents
**Parallel - 4 agents**

**Agent J: Unit Tests**
- Test exact string matching
- Test whitespace preservation
- Test encoding preservation
- Test error cases

**Agent K: Integration Tests**
- Test file editing end-to-end
- Test multi-edit sequences
- Test large file handling

**Agent L: Property Tests**
```rust
#[proptest]
fn edit_preserves_non_matched_content(content: String, edit: EditOp) { ... }
```

**Agent M: Benchmarks**
```rust
#[bench]
fn bench_edit_small_file(b: &mut Bencher) { ... }
fn bench_edit_large_file(b: &mut Bencher) { ... }
```

### 1.7 Documentation Agent
**Sequential - 1 agent**
- Update README with edit examples
- Add API documentation
- Create migration guide from regex replace
- Document error handling patterns

### 1.8 Closure Agent
**Sequential - 1 agent**
- Run final test suite
- Create PR for review
- Update issue #57 with progress
- Merge worktree if approved

---

## Phase 2: Document Chunking System (Week 2)

### 2.1 Setup Agent
```bash
git worktree add -b feature/document-chunking ../rust-chunking
```

### 2.2 Research Agents
**Parallel - 4 agents**

**Agent N: Chunking Algorithms**
- LangChain text splitters analysis
- Semantic chunking strategies
- Token counting methods (tiktoken, GPT tokenizers)
- Research: https://github.com/langchain-ai/langchain

**Agent O: Discord HTML Structure**
- Analyze DiscordChatExporter output format
- Study HTML parsing with scraper crate
- Message threading and reply chains
- Research: https://github.com/Tyrrrz/DiscordChatExporter

**Agent P: LLM Context Management**
- Context window optimization strategies
- Overlap techniques for continuity
- Metadata preservation methods
- Research RAG patterns

**Agent Q: Conversation Detection**
- Time-based segmentation algorithms
- Topic modeling for similarity
- Speaker turn detection
- Research NLP conversation analysis

### 2.3 Spec-Driven Test Design Agents
**Parallel - 2 agents** (NEW - Before Architecture)

**Agent SPEC-C: Chunking Behavior Specs**
```gherkin
Feature: Discord Log Chunking
  Scenario: Preserve conversation context
    Given a Discord log with 1000 messages
    When chunked with 500 token limit
    Then no conversation is split mid-topic
    And each chunk has overlap context
```

**Agent SPEC-D: LLM Processing Specs**
```gherkin
Feature: LLM-Ready Chunks
  Scenario: Fiction project extraction
    Given a chunk with story discussion
    When processed for extraction
    Then character names are identified
    And plot points are preserved
    And revisions link to originals
```

### 2.4 Architecture Agent
- Design chunk data model
- Plan Discord parser architecture
- Design LLM preparation pipeline
- Create processing state machine

### 2.5 Implementation Agents
**Parallel then Sequential - 8 agents**

**Parallel Group 1 (4 agents):**

**Agent R: Chunk Data Models**
```rust
// src/chunking/models.rs
pub struct DocumentChunk { ... }
pub struct ChunkMetadata { ... }
pub enum ChunkStrategy { ... }
```

**Agent S: Basic Chunking Strategies**
```rust
// src/chunking/strategies/basic.rs
pub fn chunk_by_size(doc: &str, size: usize) -> Vec<Chunk>
pub fn chunk_by_sentence(doc: &str, max_size: usize) -> Vec<Chunk>
pub fn chunk_by_paragraph(doc: &str, max_size: usize) -> Vec<Chunk>
```

**Agent T: HTML Parser**
```rust
// src/chunking/parsers/html.rs
pub fn parse_html_document(html: &str) -> Document
```

**Agent U: Token Counter**
```rust
// src/chunking/tokens.rs
pub fn count_tokens(text: &str, model: TokenModel) -> usize
```

**Sequential Group 2 (4 agents - depends on Group 1):**

**Agent V: Discord Parser**
```rust
// src/chunking/parsers/discord.rs
pub fn parse_discord_export(html: &str) -> DiscordChatLog
pub fn extract_messages(doc: Document) -> Vec<DiscordMessage>
```

**Agent W: Conversation Detector**
```rust
// src/chunking/strategies/conversation.rs
pub fn detect_conversation_breaks(messages: &[Message]) -> Vec<Boundary>
```

**Agent X: LLM Preparation**
```rust
// src/chunking/llm.rs
pub fn prepare_for_llm(chunk: &Chunk, window: usize) -> LLMInput
```

**Agent Y: Processing Session**
```rust
// src/chunking/session.rs
pub struct ChunkProcessor { ... }
impl ChunkProcessor {
    pub fn process_interactively(&mut self) -> ProcessResult
}
```

### 2.6 Testing Agents
**Parallel - 3 agents**

**Agent Z: Chunking Tests**
- Test various chunking strategies
- Test boundary detection accuracy
- Test metadata preservation

**Agent AA: Discord Tests**
- Test with real Discord exports
- Test conversation detection
- Test message extraction

**Agent AB: Performance Tests**
- Benchmark 8MB file chunking
- Memory usage profiling
- Parallel processing tests

---

## Phase 3: Node.js Bindings (Week 3)

### 3.1 Setup Agent
```bash
git worktree add -b feature/nodejs-bindings ../rust-nodejs
npm init
npm install --save-dev neon-cli
```

### 3.2 Research Agents
**Parallel - 3 agents**

**Agent AC: Neon Framework**
- Study Neon best practices
- Research async/Promise patterns
- Error handling in Node bindings
- Research: https://github.com/neon-bindings/neon

**Agent AD: Node.js Native Addons**
- N-API vs Neon comparison
- Performance optimization techniques
- Memory management patterns

**Agent AE: TypeScript Definitions**
- .d.ts generation strategies
- Type mapping Rust→TypeScript
- npm package structure

### 3.3 Implementation Agents
**Sequential - 5 agents**

**Agent AF: Neon Project Setup**
```javascript
// native/src/lib.rs
use neon::prelude::*;
fn edit_file(mut cx: FunctionContext) -> JsResult<JsObject> { ... }
```

**Agent AG: Core Bindings**
- File operations bindings
- Edit operations bindings
- Error mapping

**Agent AH: Chunking Bindings**
- Document chunking bindings
- Discord parsing bindings
- LLM preparation bindings

**Agent AI: JavaScript Wrapper**
```javascript
// index.js
class RustFileOps {
  async editFile(path, operations) { ... }
  async chunkDocument(path, config) { ... }
}
```

**Agent AJ: TypeScript Definitions**
```typescript
// index.d.ts
export interface EditOperation { ... }
export class RustFileOps { ... }
```

---

## Phase 4: Validation Integration (Week 4)

### 4.1 Research Agents
**Parallel - 2 agents**

**Agent AK: TypeScript Compiler API**
- Programmatic compilation
- Error extraction
- tsconfig.json handling

**Agent AL: ESLint API**
- Programmatic linting
- Rule configuration
- Error formatting

### 4.2 Implementation Agents
**Sequential - 3 agents**

**Agent AM: TypeScript Integration**
```rust
// src/validation/typescript.rs
pub fn check_typescript(path: &str, tsconfig: &str) -> Vec<TSError>
```

**Agent AN: ESLint Integration**
```rust
// src/validation/eslint.rs
pub fn check_eslint(path: &str, config: &str) -> Vec<LintError>
```

**Agent AO: Validation Hooks**
```rust
// src/validation/mod.rs
pub fn validate_after_edit(path: &str, config: ValidationConfig) -> ValidationResult
```

---

## Phase 5: Integration & Testing (Week 5)

### 5.1 Integration Agents
**Parallel - 3 agents**

**Agent AP: VS Code Extension Integration**
- Update extension to use rust-file-ops
- Replace existing file operations
- Add chunking features

**Agent AQ: Template System Integration**
- Hook validation into template system
- Block task completion on errors
- Add error reporting UI

**Agent AR: Performance Optimization**
- Profile full system
- Optimize hot paths
- Implement caching

### 5.2 Final Testing Agents
**Parallel - 2 agents**

**Agent AS: End-to-End Tests**
- Full workflow testing
- Discord log processing test
- VS Code integration test

**Agent AT: Documentation**
- Complete API documentation
- Usage examples
- Performance benchmarks
- Migration guide

---

## Parallelization Opportunities

### Maximum Parallel Agents by Phase:
- **Phase 1**: Up to 5 agents (Research: 3, Spec Design: 2, Testing: 4)
- **Phase 2**: Up to 4 agents (Research: 4, Spec Design: 2, Implementation Group 1: 4)
- **Phase 3**: Up to 3 agents (Research: 3)
- **Phase 4**: Up to 2 agents (Research: 2)
- **Phase 5**: Up to 3 agents (Integration: 3)

### Critical Path:
1. Phase 1 Setup → Research → Architecture → Implementation Group 1
2. Phase 1 Implementation Group 2 (depends on Group 1)
3. Phase 2 can start in parallel with Phase 1 testing
4. Phase 3 depends on Phase 1 & 2 core features
5. Phase 4 can parallel with Phase 3 after bindings structure exists
6. Phase 5 requires all previous phases

## Success Metrics

### Per-Agent Success Criteria:
- **Research Agents**: Comprehensive findings document with links
- **Architecture Agents**: ADR with clear decisions and rationale
- **Implementation Agents**: Working code with inline documentation
- **Testing Agents**: >90% code coverage, all tests passing
- **Documentation Agents**: Complete user and API docs

### Phase Checkpoints:
- **Phase 1**: Edit operations working with Python bindings
- **Phase 2**: Chunking system processing Discord logs successfully
- **Phase 3**: Node.js package installable and functional
- **Phase 4**: Validation blocking on TypeScript/lint errors
- **Phase 5**: Full system integrated with VS Code extension

## Risk Mitigation

### Agent Failure Handling:
1. **Blocked Agent**: Identify dependencies, spawn research agent
2. **Failed Implementation**: Rollback, re-architect, retry
3. **Test Failures**: Debug agent to identify root cause
4. **Performance Issues**: Profiling agent to identify bottlenecks

### Coordination Points:
- Daily status check on parallel agents
- Architecture review before implementation
- Code review after each implementation agent
- Integration test after each phase

## Tools & Resources

### Required Tools:
- **Rust**: rustc, cargo, rustfmt, clippy
- **Node.js**: node, npm, neon-cli
- **Testing**: pytest (Python), jest (Node.js), cargo test
- **Profiling**: cargo bench, flamegraph, heaptrack

### Key Documentation:
- [Neon Guide](https://neon-bindings.com/docs/introduction)
- [PyO3 Guide](https://pyo3.rs)
- [Discord HTML Structure](https://github.com/Tyrrrz/DiscordChatExporter/wiki)
- [TypeScript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)

## Agent Communication Protocol

### Information Passing:
```yaml
agent_output:
  agent_id: "A"
  phase: "1.2"
  status: "complete"
  artifacts:
    - research_findings.md
    - recommended_approach.md
  dependencies_for_next:
    - string_matching_algorithm: "myers_diff"
    - error_handling_pattern: "result_type"
  notes: "Found edge case with Unicode normalization"
```

### Coordination File:
Each phase maintains a `PHASE_N_STATUS.md` file tracking:
- Agent completion status
- Discovered blockers
- Key decisions made
- Artifacts produced

## Example Parallel Agent Execution

### Day 1 - Phase 1 Start (5 parallel agents possible)
```
Morning:
├── Agent 1.1: Setup worktree and branch
└── (Completes in 15 min)

Afternoon (all parallel):
├── Agent A: String matching research
├── Agent B: Rust best practices research  
├── Agent C: Testing strategies research
├── Agent SPEC-A: Write behavioral specs
└── Agent SPEC-B: Create test scaffolding

Evening:
└── Agent 1.4: Architecture (uses all research + specs)
```

### Day 2 - Phase 1 Implementation (3-4 parallel)
```
Morning (parallel):
├── Agent D: Core edit types
├── Agent E: String matching engine
└── Agent F: File reader enhancement

Afternoon (sequential, depends on morning):
├── Agent G: Single edit implementation
├── Agent H: Multi-edit implementation
└── Agent I: Python bindings update

Evening (parallel testing):
├── Agent J: Unit tests
├── Agent K: Integration tests
├── Agent L: Property tests
└── Agent M: Benchmarks
```

This demonstrates how proper parallelization can complete Phase 1 in just 2 days instead of a full week.

## Conclusion

This agentic approach maximizes parallelization while maintaining quality through:
1. **Spec-driven development** with tests defined before code
2. Clear separation of concerns
3. Well-defined dependencies  
4. Comprehensive testing at each stage
5. Documentation throughout
6. Rollback capability via git worktrees

The plan allows for up to 5 parallel agents in peak phases, reducing the 5-week timeline to potentially 3-4 weeks with efficient agent utilization. The spec-driven approach ensures that all agents have clear success criteria and reduces the risk of rework.