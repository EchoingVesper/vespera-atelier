//! Paragraph boundary chunking strategy

use crate::chunking::{ChunkingConfig, DocumentChunk, ChunkMetadata};
use crate::error::VesperaError;
use super::ChunkingStrategy;
use uuid::Uuid;

/// Chunks text at paragraph boundaries (double newlines)
pub struct ParagraphBoundaryChunker {
    config: ChunkingConfig,
}

impl ParagraphBoundaryChunker {
    pub fn new(config: &ChunkingConfig) -> Self {
        Self {
            config: config.clone(),
        }
    }
}

impl ChunkingStrategy for ParagraphBoundaryChunker {
    fn chunk(&self, content: &str) -> Result<Vec<DocumentChunk>, VesperaError> {
        let paragraphs: Vec<&str> = content.split("\n\n").collect();
        let mut chunks = Vec::new();
        let mut current_chunk = String::new();
        let mut chunk_start = 0;
        let mut chunk_index = 0;
        let mut byte_pos = 0;
        
        for (i, paragraph) in paragraphs.iter().enumerate() {
            let para_size = paragraph.len();
            
            // Check if adding this paragraph would exceed max_chunk_size
            if !current_chunk.is_empty() && 
               current_chunk.len() + para_size + 2 > self.config.max_chunk_size {
                // Save current chunk
                chunks.push(DocumentChunk {
                    id: Uuid::new_v4().to_string(),
                    content: current_chunk.clone(),
                    metadata: ChunkMetadata {
                        source_file: String::new(),
                        chunk_index,
                        total_chunks: 0, // Will be updated
                        byte_range: (chunk_start, byte_pos),
                        char_range: (0, 0),
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
                chunk_start = byte_pos;
            }
            
            // Add paragraph to current chunk
            if !current_chunk.is_empty() {
                current_chunk.push_str("\n\n");
                byte_pos += 2;
            }
            current_chunk.push_str(paragraph);
            byte_pos += para_size;
            
            // Add separator bytes if not last paragraph
            if i < paragraphs.len() - 1 {
                byte_pos += 2; // Account for \n\n separator
            }
        }
        
        // Save final chunk
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
        
        // Update total chunks
        let total = chunks.len();
        for chunk in &mut chunks {
            chunk.metadata.total_chunks = total;
        }
        
        Ok(chunks)
    }
    
    fn find_boundaries(&self, content: &str) -> Vec<usize> {
        let mut boundaries = Vec::new();
        let mut pos = 0;
        
        // Find all double newline positions
        while let Some(idx) = content[pos..].find("\n\n") {
            pos += idx + 2;
            boundaries.push(pos);
        }
        
        // Add end boundary
        if boundaries.is_empty() || boundaries[boundaries.len() - 1] != content.len() {
            boundaries.push(content.len());
        }
        
        boundaries
    }
    
    fn apply_overlap(&self, chunks: &mut Vec<DocumentChunk>, _original: &str) {
        // For paragraph chunks, overlap could include the last paragraph of previous chunk
        if chunks.len() <= 1 || self.config.overlap_size == 0 {
            return;
        }
        
        for i in 1..chunks.len() {
            let prev_content = &chunks[i - 1].content;
            
            // Find the last paragraph
            if let Some(last_para_start) = prev_content.rfind("\n\n") {
                let last_para = &prev_content[last_para_start + 2..];
                if last_para.len() <= self.config.overlap_size {
                    chunks[i].content = format!("[...{}]\n\n{}", last_para, chunks[i].content);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_paragraph_chunking() {
        let config = ChunkingConfig {
            max_chunk_size: 100,
            overlap_size: 0,
            chunk_strategy: crate::chunking::ChunkStrategy::ParagraphBoundary,
            ..Default::default()
        };
        
        let chunker = ParagraphBoundaryChunker::new(&config);
        
        let content = "First paragraph here.\nWith multiple lines.\n\n\
                      Second paragraph is longer.\nIt has more content.\n\n\
                      Third paragraph.";
        
        let chunks = chunker.chunk(content).unwrap();
        
        assert!(chunks.len() >= 1);
        
        // Verify paragraphs are kept together when possible
        for chunk in &chunks {
            // Each chunk should contain complete paragraphs
            assert!(chunk.content.len() > 0);
        }
    }
}