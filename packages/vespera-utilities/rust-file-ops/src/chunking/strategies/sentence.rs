//! Sentence boundary chunking strategy

use crate::chunking::{ChunkingConfig, DocumentChunk, ChunkMetadata};
use crate::error::VesperaError;
use super::ChunkingStrategy;
// use unicode_segmentation::UnicodeSegmentation; // TODO: Use for better text segmentation
use uuid::Uuid;

/// Chunks text at sentence boundaries for more natural breaks
pub struct SentenceBoundaryChunker {
    config: ChunkingConfig,
}

impl SentenceBoundaryChunker {
    pub fn new(config: &ChunkingConfig) -> Self {
        Self {
            config: config.clone(),
        }
    }
    
    /// Detect if a position is likely a sentence boundary
    fn is_sentence_boundary(&self, text: &str, pos: usize) -> bool {
        if pos >= text.len() {
            return true;
        }
        
        let bytes = text.as_bytes();
        
        // Check for sentence-ending punctuation
        if pos > 0 {
            let prev_char = bytes[pos - 1];
            if matches!(prev_char, b'.' | b'!' | b'?' | b';') {
                // Check if followed by whitespace or end of text
                if pos >= text.len() || bytes[pos].is_ascii_whitespace() {
                    // Additional check: not part of an abbreviation
                    if !self.is_likely_abbreviation(text, pos - 1) {
                        return true;
                    }
                }
            }
        }
        
        false
    }
    
    /// Check if a period is likely part of an abbreviation
    fn is_likely_abbreviation(&self, text: &str, period_pos: usize) -> bool {
        // Common abbreviations
        let abbreviations = ["Mr.", "Mrs.", "Dr.", "Ms.", "Prof.", "Sr.", "Jr.", "Ph.D", "M.D", "B.A", "M.A", "B.S", "M.S"];
        
        for abbr in &abbreviations {
            if period_pos >= abbr.len() - 1 {
                let start = period_pos + 1 - abbr.len();
                if text[start..=period_pos].ends_with(&abbr[..abbr.len()-1]) {
                    return true;
                }
            }
        }
        
        // Check for single letter abbreviations (e.g., "J. Smith")
        if period_pos > 0 {
            let bytes = text.as_bytes();
            if period_pos >= 2 && bytes[period_pos - 1].is_ascii_alphabetic() {
                // Single letter before period
                if period_pos < 3 || bytes[period_pos - 2].is_ascii_whitespace() {
                    return true;
                }
            }
        }
        
        false
    }
}

impl ChunkingStrategy for SentenceBoundaryChunker {
    fn chunk(&self, content: &str) -> Result<Vec<DocumentChunk>, VesperaError> {
        let mut chunks = Vec::new();
        let boundaries = self.find_boundaries(content);
        
        if boundaries.is_empty() {
            // No sentence boundaries found, treat as single chunk
            return Ok(vec![DocumentChunk {
                id: Uuid::new_v4().to_string(),
                content: content.to_string(),
                metadata: ChunkMetadata {
                    source_file: String::new(),
                    chunk_index: 0,
                    total_chunks: 1,
                    byte_range: (0, content.len()),
                    char_range: (0, content.chars().count()),
                    timestamp_range: None,
                    participants: vec![],
                    topics: vec![],
                    parent_chunk: None,
                    child_chunks: vec![],
                },
                embeddings: None,
            }]);
        }
        
        let mut current_chunk = String::new();
        let mut chunk_start = 0;
        let mut chunk_index = 0;
        let mut last_boundary = 0;
        
        for boundary in &boundaries {
            let sentence = &content[last_boundary..*boundary];
            
            // Check if adding this sentence would exceed max_chunk_size
            if !current_chunk.is_empty() && 
               current_chunk.len() + sentence.len() > self.config.max_chunk_size {
                // Save current chunk
                chunks.push(DocumentChunk {
                    id: Uuid::new_v4().to_string(),
                    content: current_chunk.clone(),
                    metadata: ChunkMetadata {
                        source_file: String::new(),
                        chunk_index,
                        total_chunks: 0, // Will be updated later
                        byte_range: (chunk_start, last_boundary),
                        char_range: (0, 0), // Will be calculated if needed
                        timestamp_range: None,
                        participants: vec![],
                        topics: vec![],
                        parent_chunk: None,
                        child_chunks: vec![],
                    },
                    embeddings: None,
                });
                
                chunk_index += 1;
                current_chunk.clear();
                chunk_start = last_boundary;
            }
            
            current_chunk.push_str(sentence);
            last_boundary = *boundary;
        }
        
        // Add remaining content
        if !current_chunk.is_empty() {
            chunks.push(DocumentChunk {
                id: Uuid::new_v4().to_string(),
                content: current_chunk,
                metadata: ChunkMetadata {
                    source_file: String::new(),
                    chunk_index,
                    total_chunks: 0,
                    byte_range: (chunk_start, content.len()),
                    char_range: (0, 0),
                    timestamp_range: None,
                    participants: vec![],
                    topics: vec![],
                    parent_chunk: None,
                    child_chunks: vec![],
                },
                embeddings: None,
            });
        }
        
        // Update total_chunks
        let total = chunks.len();
        for chunk in &mut chunks {
            chunk.metadata.total_chunks = total;
        }
        
        // Apply overlap if configured
        if self.config.overlap_size > 0 {
            self.apply_overlap(&mut chunks, content);
        }
        
        Ok(chunks)
    }
    
    fn find_boundaries(&self, content: &str) -> Vec<usize> {
        let mut boundaries = Vec::new();
        let mut pos = 0;
        
        while pos < content.len() {
            if self.is_sentence_boundary(content, pos) {
                boundaries.push(pos + 1); // Include the punctuation
            }
            pos += 1;
        }
        
        // Ensure we have the end of the content as a boundary
        if boundaries.is_empty() || boundaries[boundaries.len() - 1] != content.len() {
            boundaries.push(content.len());
        }
        
        boundaries
    }
    
    fn apply_overlap(&self, chunks: &mut Vec<DocumentChunk>, original: &str) {
        if chunks.len() <= 1 || self.config.overlap_size == 0 {
            return;
        }
        
        // For sentence-based chunking, overlap means including the last N characters
        // from the previous chunk (preferably complete sentences)
        for i in 1..chunks.len() {
            let prev_chunk = &chunks[i - 1].content;
            
            // Find the last sentence or portion to include as overlap
            let overlap_size = self.config.overlap_size.min(prev_chunk.len());
            let overlap_start = prev_chunk.len().saturating_sub(overlap_size);
            
            // Try to find a sentence boundary within the overlap region
            let mut best_start = overlap_start;
            for pos in overlap_start..prev_chunk.len() {
                if self.is_sentence_boundary(prev_chunk, pos) {
                    best_start = pos + 1;
                    break;
                }
            }
            
            if best_start < prev_chunk.len() {
                let overlap = &prev_chunk[best_start..];
                chunks[i].content = format!("{} {}", overlap, chunks[i].content);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sentence_boundary_detection() {
        let config = ChunkingConfig::default();
        let chunker = SentenceBoundaryChunker::new(&config);
        
        let text = "This is a sentence. This is another! And a third?";
        let boundaries = chunker.find_boundaries(text);
        
        assert_eq!(boundaries.len(), 3);
        assert_eq!(boundaries[0], 19); // After first period
        assert_eq!(boundaries[1], 37); // After exclamation
        assert_eq!(boundaries[2], 51); // End of text
    }
    
    #[test]
    fn test_abbreviation_handling() {
        let config = ChunkingConfig::default();
        let chunker = SentenceBoundaryChunker::new(&config);
        
        let text = "Dr. Smith went to the store. Then Mr. Jones arrived.";
        let boundaries = chunker.find_boundaries(text);
        
        // Should detect boundaries after "store." and at the end
        assert_eq!(boundaries.len(), 2);
        assert!(boundaries.contains(&29)); // After "store."
    }
    
    #[test]
    fn test_sentence_chunking_with_size_limit() {
        let config = ChunkingConfig {
            max_chunk_size: 50,
            overlap_size: 0,
            chunk_strategy: crate::chunking::ChunkStrategy::SentenceBoundary,
            ..Default::default()
        };
        
        let chunker = SentenceBoundaryChunker::new(&config);
        let text = "First sentence here. Second sentence is a bit longer. Third one. Fourth sentence to test chunking.";
        
        let chunks = chunker.chunk(text).unwrap();
        
        assert!(chunks.len() > 1);
        for chunk in &chunks {
            assert!(chunk.content.len() <= 100); // Some buffer for sentence completion
        }
    }
}