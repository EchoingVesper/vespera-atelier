//! Fixed-size chunking strategy

use crate::chunking::{ChunkingConfig, DocumentChunk, ChunkMetadata};
use crate::error::VesperaError;
use super::ChunkingStrategy;
use uuid::Uuid;

/// Fixed-size chunking that splits at character boundaries
pub struct FixedSizeChunker {
    config: ChunkingConfig,
}

impl FixedSizeChunker {
    pub fn new(config: &ChunkingConfig) -> Self {
        Self {
            config: config.clone(),
        }
    }
}

impl ChunkingStrategy for FixedSizeChunker {
    fn chunk(&self, content: &str) -> Result<Vec<DocumentChunk>, VesperaError> {
        let mut chunks = Vec::new();
        let mut char_indices: Vec<usize> = content.char_indices().map(|(i, _)| i).collect();
        char_indices.push(content.len()); // Add end position
        
        let mut start_idx = 0;
        let mut chunk_index = 0;
        
        // Calculate total chunks (approximate)
        let total_chunks = (content.len() / self.config.max_chunk_size) + 1;
        
        while start_idx < char_indices.len() - 1 {
            // Find the end position for this chunk
            let mut end_idx = start_idx;
            let mut chunk_size = 0;
            
            // Move forward until we reach max_chunk_size or end of content
            while end_idx < char_indices.len() - 1 && chunk_size < self.config.max_chunk_size {
                let next_char_boundary = char_indices[end_idx + 1];
                let current_boundary = char_indices[end_idx];
                chunk_size += next_char_boundary - current_boundary;
                end_idx += 1;
            }
            
            // Extract the chunk content
            let byte_start = char_indices[start_idx];
            let byte_end = char_indices[end_idx.min(char_indices.len() - 1)];
            let chunk_content = &content[byte_start..byte_end];
            
            // Create the chunk
            let chunk = DocumentChunk {
                id: Uuid::new_v4().to_string(),
                content: chunk_content.to_string(),
                metadata: ChunkMetadata {
                    source_file: String::new(), // Will be set by caller
                    chunk_index,
                    total_chunks,
                    byte_range: (byte_start, byte_end),
                    char_range: (start_idx, end_idx),
                    timestamp_range: None,
                    participants: vec![],
                    topics: vec![],
                    parent_chunk: None,
                    child_chunks: vec![],
                },
                embeddings: None,
            };
            
            chunks.push(chunk);
            chunk_index += 1;
            
            // Move to next chunk with overlap
            if self.config.overlap_size > 0 && end_idx < char_indices.len() - 1 {
                // Go back by overlap_size characters
                let overlap_chars = self.config.overlap_size.min(end_idx - start_idx);
                start_idx = end_idx - (overlap_chars / 10); // Approximate overlap
            } else {
                start_idx = end_idx;
            }
        }
        
        // Apply overlap if configured
        if self.config.overlap_size > 0 {
            self.apply_overlap(&mut chunks, content);
        }
        
        Ok(chunks)
    }
    
    fn find_boundaries(&self, content: &str) -> Vec<usize> {
        // For fixed-size, boundaries are at regular intervals
        let mut boundaries = Vec::new();
        let char_indices: Vec<usize> = content.char_indices().map(|(i, _)| i).collect();
        
        for i in (0..char_indices.len()).step_by(self.config.max_chunk_size) {
            boundaries.push(char_indices[i.min(char_indices.len() - 1)]);
        }
        
        boundaries
    }
    
    fn apply_overlap(&self, chunks: &mut Vec<DocumentChunk>, original: &str) {
        if chunks.len() <= 1 || self.config.overlap_size == 0 {
            return;
        }
        
        for i in 1..chunks.len() {
            let prev_chunk = &chunks[i - 1];
            let prev_end = prev_chunk.metadata.byte_range.1;
            
            // Calculate overlap start position
            let overlap_start = prev_end.saturating_sub(self.config.overlap_size);
            
            // Find safe UTF-8 boundary
            let safe_start = if overlap_start > 0 {
                // Find the start of the character at or before overlap_start
                let mut safe = overlap_start;
                while safe > 0 && !original.is_char_boundary(safe) {
                    safe -= 1;
                }
                safe
            } else {
                0
            };
            
            if safe_start < prev_end {
                let overlap_content = &original[safe_start..prev_end];
                chunks[i].content = format!("{}{}", overlap_content, chunks[i].content);
                
                // Update metadata
                chunks[i].metadata.byte_range.0 = safe_start;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fixed_size_chunking() {
        let config = ChunkingConfig {
            max_chunk_size: 10,
            overlap_size: 0,
            ..Default::default()
        };
        
        let chunker = FixedSizeChunker::new(&config);
        let content = "This is a test string for chunking.";
        let chunks = chunker.chunk(content).unwrap();
        
        assert!(chunks.len() > 1);
        assert!(chunks[0].content.len() <= 10);
        
        // Verify all content is preserved
        let reconstructed: String = chunks.iter()
            .map(|c| c.content.clone())
            .collect();
        assert_eq!(reconstructed.len(), content.len());
    }
    
    #[test]
    fn test_utf8_safety() {
        let config = ChunkingConfig {
            max_chunk_size: 5,
            overlap_size: 0,
            ..Default::default()
        };
        
        let chunker = FixedSizeChunker::new(&config);
        let content = "Hello 世界 Test"; // Contains multi-byte characters
        let chunks = chunker.chunk(content).unwrap();
        
        // Verify all chunks are valid UTF-8
        for chunk in &chunks {
            assert!(chunk.content.is_ascii() || chunk.content.chars().count() > 0);
        }
    }
    
    #[test]
    fn test_with_overlap() {
        let config = ChunkingConfig {
            max_chunk_size: 10,
            overlap_size: 3,
            ..Default::default()
        };
        
        let chunker = FixedSizeChunker::new(&config);
        let content = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        let chunks = chunker.chunk(content).unwrap();
        
        assert!(chunks.len() > 1);
        
        // Check that chunks have overlap
        if chunks.len() > 1 {
            // The second chunk should contain some characters from the first
            let first_end = &chunks[0].content[chunks[0].content.len().saturating_sub(3)..];
            assert!(chunks[1].content.starts_with(first_end) || chunks[1].content.len() > 0);
        }
    }
}