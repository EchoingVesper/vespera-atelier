# String Matching Research for Precise Text Editing

## Executive Summary

This research examines string matching algorithms and techniques for implementing precise text editing operations that preserve whitespace exactly and handle Unicode edge cases. The findings are based on analysis of VS Code's implementation, xi-editor's rope data structure, the Myers diff algorithm, and best practices for handling text processing edge cases.

## Key Findings

1. **VS Code uses a piece tree data structure** for efficient text operations with exact preservation
2. **Myers diff algorithm** provides optimal minimal edit sequences with O(ND) complexity
3. **Rope data structures** excel at handling large texts with frequent insertions/deletions
4. **Unicode normalization and whitespace handling** require careful attention to edge cases

## 1. Diff Algorithms Analysis

### Myers Diff Algorithm (Recommended)

The Myers algorithm is the gold standard for text diffing and is used by Git as its default algorithm.

**Key Characteristics:**
- **Complexity**: O(ND) where N is the sum of input lengths, D is the edit distance
- **Quality**: Produces minimal edit sequences (shortest edit scripts)
- **Behavior**: Greedy algorithm that prefers deletions before insertions
- **Graph-based**: Models editing as pathfinding through a 2D grid

**How It Works:**
1. Models the diff problem as finding the shortest path in a graph
2. Each position (x,y) represents having processed x characters from string A and y from string B
3. Moving right = deletion, moving down = insertion, diagonal = match (free)
4. Uses breadth-first search to find minimal edit distance
5. Backtracks to reconstruct the actual edit sequence

**Implementation Benefits:**
- Produces human-readable diffs that align with intuitive expectations
- Handles large files efficiently
- Well-tested and battle-proven (used in Git, many editors)
- Available implementations in multiple languages

**Code Example (Conceptual):**
```rust
fn myers_diff(a: &str, b: &str) -> Vec<Edit> {
    let n = a.len();
    let m = b.len();
    
    // Build edit graph
    // Find shortest path from (0,0) to (n,m)
    // Backtrack to get edit sequence
    
    // Returns: Vec<Edit> where Edit = Delete(pos) | Insert(pos, text) | Keep(len)
}
```

### Alternative Algorithms Comparison

| Algorithm | Time Complexity | Space | Quality | Use Case |
|-----------|----------------|-------|---------|----------|
| Myers | O(ND) | O(D²) | Optimal minimal | General text diffing |
| Hunt-McIlroy | O(N log N + D²) | O(N) | Good | Large files, few changes |
| Patience | O(N log N) | O(N) | Good unique lines | Code with unique landmarks |
| Histogram | O(N log N) | O(N) | Similar to patience | Code diffing |

**Recommendation**: Use Myers for precise text editing operations due to its optimality and predictable behavior.

## 2. Text Editor Implementation Analysis

### VS Code's Approach

VS Code uses a sophisticated **Piece Tree** data structure for text representation.

**Key Implementation Details:**

**Piece Tree Structure:**
- Text is stored in immutable chunks (pieces)
- Red-black tree organizes pieces by offset
- Enables efficient insertions/deletions without copying large text blocks
- Preserves original text and edits separately

**String Edit Operations:**
```typescript
interface IValidatedEditOperation {
    range: Range;
    rangeOffset: number;
    rangeLength: number;
    text: string;
    eolCount: number;
    firstLineLength: number;
    lastLineLength: number;
    forceMoveMarkers: boolean;
}
```

**Whitespace Preservation:**
- Normalizes line endings to buffer's EOL preference
- Preserves original whitespace within lines exactly
- Handles mixed line endings (CRLF/LF) consistently
- Tracks text encoding and BOM preservation

**Unicode Handling:**
- Atomic unit is Unicode scalar values (Rust chars)
- All operations work with char indices, not byte indices
- Properly handles surrogate pairs and combining characters
- Tracks whether text might contain RTL or unusual line terminators

### xi-editor's Rope Implementation

Xi-editor pioneered many modern text editor data structures.

**Rope Characteristics:**
- Tree of text chunks with automatic rebalancing
- Efficient for large documents with frequent edits
- UTF-8 native with proper Unicode handling
- Each node stores text metrics (line counts, byte length)

**Diff Implementation:**
```rust
// Line-hash based diff for performance
pub struct LineHashDiff;

impl Diff<RopeInfo> for LineHashDiff {
    fn compute_delta(base: &Rope, target: &Rope) -> RopeDelta {
        // 1. Scan for common prefix/suffix
        // 2. Hash lines above minimum size threshold
        // 3. Find matching lines between documents
        // 4. Extend matches forward/backward
        // 5. Use longest increasing subsequence
        // 6. Return delta with copy/insert operations
    }
}
```

**Key Features:**
- O(n+m) performance for typical text editing workloads
- Handles whitespace-only lines intelligently
- Produces high-quality diffs comparable to suffix arrays
- Orders of magnitude faster than more complex algorithms

## 3. Rust Rope Implementation: Ropey

Ropey is the most mature rope implementation for Rust text editing.

**Key Characteristics:**
- UTF-8 native, all operations use char indices
- B-tree based implementation for cache efficiency
- Optimized for typical text editing patterns
- Comprehensive slicing and iteration APIs

**API Design:**
```rust
use ropey::Rope;

// Create and edit
let mut rope = Rope::from_str("Hello world");
rope.insert(6, "beautiful ");

// Precise replacement
fn replace_range(rope: &mut Rope, start: usize, end: usize, text: &str) {
    rope.remove(start..end);
    rope.insert(start, text);
}

// Preserve exact whitespace
fn exact_string_replace(rope: &mut Rope, old: &str, new: &str) -> Result<bool, Error> {
    // Find exact match with byte-perfect comparison
    if let Some(start) = find_exact_match(rope, old) {
        let end = start + old.chars().count();
        rope.remove(start..end);
        rope.insert(start, new);
        Ok(true)
    } else {
        Ok(false)
    }
}
```

**Performance Profile:**
- Insert/delete: O(log n) amortized
- Random access: O(log n)
- Sequential access: O(1) amortized
- Memory overhead: ~2-4x raw text size

## 4. Edge Cases and Unicode Considerations

### Critical Edge Cases to Handle

**1. Unicode Normalization**
```rust
// Different byte sequences can represent the same visual text
let composed = "é"; // Single code point U+00E9
let decomposed = "e\u{0301}"; // e + combining acute accent

// MUST normalize for exact comparison
use unicode_normalization::UnicodeNormalization;

fn normalize_for_comparison(s: &str) -> String {
    s.nfc().collect::<String>()
}
```

**2. Line Ending Variations**
```rust
enum LineEnding {
    LF,    // Unix: \n
    CRLF,  // Windows: \r\n
    CR,    // Classic Mac: \r (rare)
}

fn preserve_line_endings(original: &str, replacement: &str) -> String {
    let line_ending = detect_line_ending(original);
    normalize_line_endings(replacement, line_ending)
}
```

**3. Whitespace Preservation**
```rust
// Preserve exact whitespace including:
// - Tabs vs spaces
// - Trailing whitespace
// - Multiple consecutive spaces
// - Zero-width spaces (U+200B)
// - Non-breaking spaces (U+00A0)

fn exact_whitespace_match(rope: &Rope, pattern: &str) -> Option<usize> {
    // Byte-for-byte comparison, no normalization
    rope.bytes()
        .windows(pattern.len())
        .position(|window| window == pattern.as_bytes())
}
```

**4. Multi-byte Character Boundaries**
```rust
// Never split in the middle of a UTF-8 sequence
fn safe_char_boundary(text: &str, byte_pos: usize) -> usize {
    // Adjust to valid char boundary
    let mut pos = byte_pos.min(text.len());
    while pos > 0 && !text.is_char_boundary(pos) {
        pos -= 1;
    }
    pos
}
```

**5. Bidirectional Text (RTL/LTR)**
```rust
// Right-to-left text requires special handling
fn detect_rtl_content(text: &str) -> bool {
    text.chars().any(|c| {
        matches!(unicode_bidi::BidiClass::of(c), 
                 unicode_bidi::BidiClass::RightToLeft |
                 unicode_bidi::BidiClass::ArabicLetter)
    })
}
```

### Recommended Handling Strategies

**1. Input Validation**
```rust
fn validate_edit_input(text: &str) -> Result<(), EditError> {
    // Check for valid UTF-8 (usually guaranteed by &str)
    // Detect problematic sequences
    // Warn about unusual characters that might cause issues
    Ok(())
}
```

**2. Exact Match Strategy**
```rust
fn find_exact_string_match(
    text: &str, 
    pattern: &str, 
    start_pos: usize
) -> Option<usize> {
    // 1. No normalization - byte-exact matching
    // 2. Respect character boundaries
    // 3. Handle case sensitivity explicitly
    // 4. Document assumptions clearly
    
    if start_pos >= text.len() {
        return None;
    }
    
    let search_text = &text[start_pos..];
    search_text.find(pattern)
        .map(|pos| start_pos + pos)
}
```

**3. Error Recovery**
```rust
#[derive(Debug)]
enum EditError {
    PatternNotFound,
    InvalidUtf8,
    CharBoundaryViolation,
    InvalidRange,
}

fn safe_replace_with_recovery(
    rope: &mut Rope,
    old: &str,
    new: &str
) -> Result<bool, EditError> {
    // Validate inputs
    // Find exact match
    // Apply edit with rollback capability
    // Return detailed error information
}
```

## 5. Implementation Recommendations

### Primary Algorithm Choice

**Use Myers Diff Algorithm** for the core diffing operations:
- Optimal results for typical text editing scenarios
- Well-understood behavior and edge cases
- Available high-quality implementations
- Predictable performance characteristics

### Data Structure Recommendation

**Use Ropey for Text Representation**:
- Mature, well-tested Rust implementation
- Excellent Unicode support
- Performance optimized for text editing
- Rich API for common operations

### Implementation Architecture

```rust
pub struct PreciseTextEditor {
    rope: Rope,
    line_ending: LineEnding,
    preserve_whitespace: bool,
    unicode_normalization: NormalizationForm,
}

impl PreciseTextEditor {
    pub fn exact_replace(
        &mut self,
        old_text: &str,
        new_text: &str
    ) -> Result<Vec<EditOperation>, EditError> {
        // 1. Find all exact matches
        let matches = self.find_all_exact_matches(old_text)?;
        
        // 2. Create edit operations
        let ops = matches.into_iter()
            .map(|pos| EditOperation::Replace {
                range: pos..pos + old_text.chars().count(),
                text: new_text.to_string(),
            })
            .collect();
        
        // 3. Apply edits (in reverse order to maintain positions)
        for op in ops.iter().rev() {
            self.apply_edit(op)?;
        }
        
        Ok(ops)
    }
    
    fn find_all_exact_matches(&self, pattern: &str) -> Result<Vec<usize>, EditError> {
        let mut matches = Vec::new();
        let text = self.rope.to_string();
        let mut start = 0;
        
        while let Some(pos) = self.find_exact_match(&text, pattern, start) {
            matches.push(pos);
            start = pos + 1; // Move past this match
        }
        
        Ok(matches)
    }
}
```

### Testing Strategy

**Comprehensive Edge Case Testing:**
```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_unicode_normalization_equivalence() {
        let composed = "é";
        let decomposed = "e\u{0301}";
        // Test that both forms are handled correctly
    }
    
    #[test]
    fn test_mixed_line_endings() {
        let text = "line1\nline2\r\nline3\r";
        // Test preservation of original line ending style
    }
    
    #[test]
    fn test_whitespace_preservation() {
        let text = "  \t  spaced  \t  ";
        // Test exact whitespace matching
    }
    
    #[test]
    fn test_bidirectional_text() {
        let text = "Hello שלום World";
        // Test RTL text handling
    }
    
    #[test]
    fn test_zero_width_characters() {
        let text = "word\u{200B}break";
        // Test zero-width space handling
    }
}
```

## 6. Performance Considerations

### Algorithm Complexity Analysis

| Operation | Rope (Ropey) | String | Piece Tree |
|-----------|--------------|--------|------------|
| Insert | O(log n) | O(n) | O(log n) |
| Delete | O(log n) | O(n) | O(log n) |
| Replace | O(log n) | O(n) | O(log n) |
| Search | O(n) | O(n) | O(n) |
| Random Access | O(log n) | O(1) | O(log n) |

### Memory Usage

- **Rope**: 2-4x text size overhead, efficient for large documents
- **String**: 1x text size, inefficient for large edits  
- **Piece Tree**: Variable overhead, excellent for undo/redo

### Optimization Strategies

1. **Batch Operations**: Group multiple edits to reduce overhead
2. **Incremental Updates**: Only recompute affected regions
3. **Caching**: Cache frequently accessed text ranges
4. **Lazy Evaluation**: Defer expensive operations when possible

## 7. Conclusion and Next Steps

### Key Takeaways

1. **Myers algorithm** provides optimal diff quality for text editing
2. **Rope data structures** are ideal for frequent text modifications
3. **Unicode and whitespace edge cases** require careful, explicit handling
4. **VS Code's approach** demonstrates production-ready techniques

### Implementation Roadmap

1. **Phase 1**: Implement basic Myers diff with Ropey integration
2. **Phase 2**: Add comprehensive Unicode and whitespace handling
3. **Phase 3**: Optimize for performance and memory usage
4. **Phase 4**: Extensive edge case testing and validation

### Further Research

- Investigate Git's patience and histogram algorithms for code diffing
- Study modern editors like Zed for latest innovations
- Explore incremental parsing for syntax-aware diffing
- Consider parallel processing for very large files

---

**Note**: This research document should be moved to the target location:
`/home/aya/Development/rust-editing-enhancement/packages/vespera-utilities/rust-file-ops/research/string_matching_research.md`