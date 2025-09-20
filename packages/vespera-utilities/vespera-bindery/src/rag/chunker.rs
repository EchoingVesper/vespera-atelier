//! # Document Chunker
//!
//! Intelligent document chunking for optimal RAG performance.
//! Implements multiple strategies based on document type.

use anyhow::Result;
use regex::Regex;

/// Strategies for chunking documents
#[derive(Debug, Clone, Copy)]
pub enum ChunkStrategy {
    /// Split by paragraphs (double newlines)
    Paragraph,
    /// Split by Markdown headers and sections
    Markdown,
    /// Split by code structure (functions, classes)
    Code,
    /// Fixed-size chunks with overlap
    FixedSize,
    /// Split by sentences
    Sentence,
}

/// Document chunker with configurable strategies
pub struct DocumentChunker {
    max_chunk_size: usize,
    chunk_overlap: usize,
}

impl DocumentChunker {
    /// Create a new document chunker
    pub fn new(max_chunk_size: usize, chunk_overlap: usize) -> Self {
        Self {
            max_chunk_size,
            chunk_overlap,
        }
    }

    /// Chunk a document using the specified strategy
    pub fn chunk(&self, content: &str, strategy: ChunkStrategy) -> Result<Vec<String>> {
        match strategy {
            ChunkStrategy::Paragraph => self.chunk_by_paragraph(content),
            ChunkStrategy::Markdown => self.chunk_by_markdown(content),
            ChunkStrategy::Code => self.chunk_by_code(content),
            ChunkStrategy::FixedSize => self.chunk_fixed_size(content),
            ChunkStrategy::Sentence => self.chunk_by_sentence(content),
        }
    }

    /// Chunk by paragraphs (double newline separated)
    fn chunk_by_paragraph(&self, content: &str) -> Result<Vec<String>> {
        let paragraphs: Vec<&str> = content.split("\n\n").collect();
        self.merge_small_chunks(paragraphs)
    }

    /// Chunk by Markdown structure
    fn chunk_by_markdown(&self, content: &str) -> Result<Vec<String>> {
        let mut chunks = Vec::new();
        let mut current_section = String::new();
        let mut current_header = String::new();

        let header_regex = Regex::new(r"^(#{1,6})\s+(.+)$")?;

        for line in content.lines() {
            if let Some(_captures) = header_regex.captures(line) {
                // Save previous section if it exists
                if !current_section.trim().is_empty() {
                    chunks.push(current_section.clone());
                }

                // Start new section with header
                current_header = line.to_string();
                current_section = format!("{}\n", line);
            } else {
                // Add line to current section
                current_section.push_str(line);
                current_section.push('\n');

                // Check if section is getting too large
                if current_section.len() > self.max_chunk_size {
                    chunks.push(current_section.clone());
                    current_section = current_header.clone();
                    if !current_header.is_empty() {
                        current_section.push('\n');
                    }
                }
            }
        }

        // Add final section
        if !current_section.trim().is_empty() {
            chunks.push(current_section);
        }

        Ok(chunks)
    }

    /// Chunk code by structure (functions, classes, etc.)
    fn chunk_by_code(&self, content: &str) -> Result<Vec<String>> {
        let mut chunks = Vec::new();
        let mut current_chunk = String::new();
        let mut in_function = false;
        let mut indent_level = 0;

        // Patterns for common code structures
        let function_patterns = [
            Regex::new(r"^(async\s+)?def\s+\w+")?,     // Python
            Regex::new(r"^(pub\s+)?(async\s+)?fn\s+")?, // Rust
            Regex::new(r"^(async\s+)?function\s+")?,    // JavaScript
            Regex::new(r"^class\s+\w+")?,               // Class definitions
            Regex::new(r"^(public|private|protected)?\s*(static\s+)?\w+\s+\w+\s*\(")?, // Java/C#
        ];

        for line in content.lines() {
            let trimmed = line.trim_start();
            let current_indent = line.len() - trimmed.len();

            // Check if this is a new function/class
            let is_new_structure = function_patterns.iter().any(|p| p.is_match(trimmed));

            if is_new_structure && !current_chunk.trim().is_empty() {
                // Save previous chunk
                chunks.push(current_chunk.clone());
                current_chunk = String::new();
                in_function = true;
                indent_level = current_indent;
            } else if in_function && current_indent <= indent_level && !trimmed.is_empty() {
                // End of current function/class
                if !current_chunk.trim().is_empty() {
                    chunks.push(current_chunk.clone());
                    current_chunk = String::new();
                }
                in_function = false;
            }

            current_chunk.push_str(line);
            current_chunk.push('\n');

            // Check size limit
            if current_chunk.len() > self.max_chunk_size {
                chunks.push(current_chunk.clone());
                current_chunk = String::new();
                in_function = false;
            }
        }

        // Add final chunk
        if !current_chunk.trim().is_empty() {
            chunks.push(current_chunk);
        }

        // If no structured chunks found, fall back to fixed size
        if chunks.is_empty() {
            return self.chunk_fixed_size(content);
        }

        Ok(chunks)
    }

    /// Fixed-size chunking with overlap
    fn chunk_fixed_size(&self, content: &str) -> Result<Vec<String>> {
        let mut chunks = Vec::new();
        let chars: Vec<char> = content.chars().collect();
        let total_chars = chars.len();

        let mut start = 0;
        while start < total_chars {
            let end = std::cmp::min(start + self.max_chunk_size, total_chars);

            // Try to find a good break point (sentence or paragraph end)
            let mut actual_end = end;
            if end < total_chars {
                // Look for sentence end
                for i in (start + self.max_chunk_size / 2..end).rev() {
                    if chars[i] == '.' || chars[i] == '!' || chars[i] == '?' {
                        if i + 1 < total_chars && chars[i + 1].is_whitespace() {
                            actual_end = i + 1;
                            break;
                        }
                    }
                }
            }

            let chunk: String = chars[start..actual_end].iter().collect();
            chunks.push(chunk);

            // Move to next chunk with overlap
            if actual_end >= total_chars {
                break;
            }
            start = actual_end.saturating_sub(self.chunk_overlap);
        }

        Ok(chunks)
    }

    /// Chunk by sentences
    fn chunk_by_sentence(&self, content: &str) -> Result<Vec<String>> {
        // Simple sentence splitting regex
        let sentence_regex = Regex::new(r"[.!?]+\s+")?;

        let mut chunks = Vec::new();
        let mut current_chunk = String::new();

        // Split by sentence boundaries but keep the delimiters
        let mut last_end = 0;
        for mat in sentence_regex.find_iter(content) {
            let sentence = &content[last_end..mat.end()];

            if current_chunk.len() + sentence.len() > self.max_chunk_size {
                if !current_chunk.trim().is_empty() {
                    chunks.push(current_chunk.clone());
                    current_chunk = String::new();
                }
            }

            current_chunk.push_str(sentence);
            last_end = mat.end();
        }

        // Add remaining content
        if last_end < content.len() {
            current_chunk.push_str(&content[last_end..]);
        }

        if !current_chunk.trim().is_empty() {
            chunks.push(current_chunk);
        }

        Ok(chunks)
    }

    /// Merge small chunks to avoid too many tiny pieces
    fn merge_small_chunks(&self, pieces: Vec<&str>) -> Result<Vec<String>> {
        let mut chunks = Vec::new();
        let mut current_chunk = String::new();

        for piece in pieces {
            if current_chunk.len() + piece.len() + 2 > self.max_chunk_size {
                if !current_chunk.trim().is_empty() {
                    chunks.push(current_chunk.clone());
                }
                current_chunk = piece.to_string();
            } else {
                if !current_chunk.is_empty() {
                    current_chunk.push_str("\n\n");
                }
                current_chunk.push_str(piece);
            }
        }

        if !current_chunk.trim().is_empty() {
            chunks.push(current_chunk);
        }

        Ok(chunks)
    }

    /// Adaptive chunking that selects strategy based on content
    pub fn chunk_adaptive(&self, content: &str) -> Result<Vec<String>> {
        // Detect content type and choose strategy
        let strategy = self.detect_strategy(content);
        self.chunk(content, strategy)
    }

    /// Detect the best chunking strategy for content
    fn detect_strategy(&self, content: &str) -> ChunkStrategy {
        // Check for code indicators
        let code_indicators = ["def ", "fn ", "class ", "import ", "function ", "const ", "let ", "var "];
        let code_count = code_indicators.iter()
            .filter(|&indicator| content.contains(indicator))
            .count();

        if code_count >= 3 {
            return ChunkStrategy::Code;
        }

        // Check for Markdown headers
        if content.contains("\n# ") || content.contains("\n## ") || content.contains("\n### ") {
            return ChunkStrategy::Markdown;
        }

        // Check for paragraph structure
        if content.contains("\n\n") {
            return ChunkStrategy::Paragraph;
        }

        // Default to sentence chunking
        ChunkStrategy::Sentence
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_paragraph_chunking() {
        let chunker = DocumentChunker::new(200, 20);
        let content = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.";

        let chunks = chunker.chunk(content, ChunkStrategy::Paragraph).unwrap();
        assert_eq!(chunks.len(), 1); // Should merge small paragraphs
    }

    #[test]
    fn test_markdown_chunking() {
        let chunker = DocumentChunker::new(200, 20);
        let content = "# Header 1\n\nContent 1\n\n## Header 2\n\nContent 2";

        let chunks = chunker.chunk(content, ChunkStrategy::Markdown).unwrap();
        assert_eq!(chunks.len(), 2);
    }

    #[test]
    fn test_code_chunking() {
        let chunker = DocumentChunker::new(200, 20);
        let content = "def function1():\n    return 1\n\ndef function2():\n    return 2";

        let chunks = chunker.chunk(content, ChunkStrategy::Code).unwrap();
        assert_eq!(chunks.len(), 2);
    }

    #[test]
    fn test_fixed_size_chunking() {
        let chunker = DocumentChunker::new(50, 10);
        let content = "a".repeat(200);

        let chunks = chunker.chunk(&content, ChunkStrategy::FixedSize).unwrap();
        assert!(chunks.len() > 1);

        // Check overlap
        for i in 1..chunks.len() {
            let prev_end = &chunks[i - 1][chunks[i - 1].len().saturating_sub(10)..];
            let curr_start = &chunks[i][..10.min(chunks[i].len())];
            assert_eq!(prev_end, curr_start);
        }
    }

    #[test]
    fn test_adaptive_strategy_detection() {
        let chunker = DocumentChunker::new(200, 20);

        // Test code detection
        let code = "def foo():\n    pass\n\nclass Bar:\n    pass";
        assert!(matches!(chunker.detect_strategy(code), ChunkStrategy::Code));

        // Test Markdown detection
        let markdown = "# Title\n\nContent\n\n## Subtitle";
        assert!(matches!(chunker.detect_strategy(markdown), ChunkStrategy::Markdown));

        // Test paragraph detection
        let paragraphs = "Para 1.\n\nPara 2.\n\nPara 3.";
        assert!(matches!(chunker.detect_strategy(paragraphs), ChunkStrategy::Paragraph));
    }
}