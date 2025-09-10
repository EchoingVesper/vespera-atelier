//! Core chunk processing functionality

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

/// A single chunk of a document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentChunk {
    /// Unique identifier for this chunk
    pub id: String,
    
    /// The actual content of the chunk
    pub content: String,
    
    /// Metadata about the chunk
    pub metadata: ChunkMetadata,
    
    /// Optional embeddings for semantic search (if computed)
    pub embeddings: Option<Vec<f32>>,
}

/// Metadata associated with a document chunk
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChunkMetadata {
    /// Path to the source file
    pub source_file: String,
    
    /// Index of this chunk (0-based)
    pub chunk_index: usize,
    
    /// Total number of chunks in the document
    pub total_chunks: usize,
    
    /// Byte range in the original document
    pub byte_range: (usize, usize),
    
    /// Character range in the original document
    pub char_range: (usize, usize),
    
    /// Timestamp range for chat logs (ISO 8601 format)
    pub timestamp_range: Option<(String, String)>,
    
    /// Participants in this chunk (for conversations)
    pub participants: Vec<String>,
    
    /// Topics or keywords detected in this chunk
    pub topics: Vec<String>,
    
    /// ID of the parent chunk (for hierarchical chunking)
    pub parent_chunk: Option<String>,
    
    /// IDs of child chunks
    pub child_chunks: Vec<String>,
}

/// Interactive chunk processor for managing document processing sessions
#[derive(Debug)]
pub struct ChunkProcessor {
    /// All chunks in the document
    pub chunks: Vec<DocumentChunk>,
    
    /// Current position in the chunk list
    pub current_index: usize,
    
    /// Processed data extracted from chunks
    pub processed_data: HashMap<String, ProcessedInfo>,
}

/// Information extracted from a processed chunk
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessedInfo {
    /// Relevance score (0.0 to 1.0)
    pub relevance_score: f32,
    
    /// Extracted data from the chunk
    pub extracted_data: Option<ExtractedData>,
    
    /// Whether human review was requested
    pub needs_review: bool,
    
    /// Any refinements added by human or LLM
    pub refinements: Vec<String>,
}

/// Data extracted from a chunk
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedData {
    /// Key-value pairs of extracted information
    pub fields: HashMap<String, serde_json::Value>,
    
    /// Confidence score for the extraction
    pub confidence: f32,
    
    /// Source span in the original chunk
    pub source_span: Option<(usize, usize)>,
}

/// Request for human review of a chunk
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewRequest {
    /// ID of the chunk needing review
    pub chunk_id: String,
    
    /// Reason for requesting review
    pub reason: String,
    
    /// Specific questions for the reviewer
    pub questions: Vec<String>,
    
    /// Context from surrounding chunks
    pub context: Option<String>,
}

impl ChunkProcessor {
    /// Create a new chunk processor
    pub fn new(chunks: Vec<DocumentChunk>) -> Self {
        Self {
            chunks,
            current_index: 0,
            processed_data: HashMap::new(),
        }
    }
    
    /// Get the next chunk to process
    pub fn next_chunk(&mut self) -> Option<&DocumentChunk> {
        if self.current_index < self.chunks.len() {
            let chunk = &self.chunks[self.current_index];
            self.current_index += 1;
            Some(chunk)
        } else {
            None
        }
    }
    
    /// Mark a chunk as relevant with a score
    pub fn mark_relevant(&mut self, chunk_id: &str, relevance_score: f32) {
        let entry = self.processed_data.entry(chunk_id.to_string())
            .or_insert_with(|| ProcessedInfo {
                relevance_score: 0.0,
                extracted_data: None,
                needs_review: false,
                refinements: Vec::new(),
            });
        entry.relevance_score = relevance_score.clamp(0.0, 1.0);
    }
    
    /// Store extracted data for a chunk
    pub fn extract_data(&mut self, chunk_id: &str, extracted: ExtractedData) {
        let entry = self.processed_data.entry(chunk_id.to_string())
            .or_insert_with(|| ProcessedInfo {
                relevance_score: 0.0,
                extracted_data: None,
                needs_review: false,
                refinements: Vec::new(),
            });
        entry.extracted_data = Some(extracted);
    }
    
    /// Request human review for a chunk
    pub fn request_human_review(&self, chunk_id: &str, reason: &str) -> ReviewRequest {
        // Find the chunk
        let chunk = self.chunks.iter()
            .find(|c| c.id == chunk_id);
        
        // Get context from surrounding chunks
        let context = if let Some(chunk) = chunk {
            let idx = chunk.metadata.chunk_index;
            let mut context_parts = Vec::new();
            
            // Add previous chunk summary if available
            if idx > 0 {
                if let Some(prev) = self.chunks.iter().find(|c| c.metadata.chunk_index == idx - 1) {
                    context_parts.push(format!("Previous: {}...", &prev.content[..prev.content.len().min(100)]));
                }
            }
            
            // Add next chunk summary if available
            if let Some(next) = self.chunks.iter().find(|c| c.metadata.chunk_index == idx + 1) {
                context_parts.push(format!("Next: {}...", &next.content[..next.content.len().min(100)]));
            }
            
            if !context_parts.is_empty() {
                Some(context_parts.join("\n"))
            } else {
                None
            }
        } else {
            None
        };
        
        ReviewRequest {
            chunk_id: chunk_id.to_string(),
            reason: reason.to_string(),
            questions: vec![
                "Is this content relevant to the extraction goal?".to_string(),
                "Are there any important details that might have been missed?".to_string(),
            ],
            context,
        }
    }
    
    /// Add a refinement to a processed chunk
    pub fn append_refinement(&mut self, chunk_id: &str, refinement: String) {
        let entry = self.processed_data.entry(chunk_id.to_string())
            .or_insert_with(|| ProcessedInfo {
                relevance_score: 0.0,
                extracted_data: None,
                needs_review: false,
                refinements: Vec::new(),
            });
        entry.refinements.push(refinement);
    }
    
    /// Get progress statistics
    pub fn get_progress(&self) -> (usize, usize) {
        (self.current_index, self.chunks.len())
    }
    
    /// Reset to beginning
    pub fn reset(&mut self) {
        self.current_index = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_chunk(id: &str, index: usize) -> DocumentChunk {
        DocumentChunk {
            id: id.to_string(),
            content: format!("Test content for chunk {}", index),
            metadata: ChunkMetadata {
                source_file: "test.txt".to_string(),
                chunk_index: index,
                total_chunks: 3,
                byte_range: (index * 100, (index + 1) * 100),
                char_range: (index * 100, (index + 1) * 100),
                timestamp_range: None,
                participants: vec![],
                topics: vec![],
                parent_chunk: None,
                child_chunks: vec![],
            },
            embeddings: None,
        }
    }

    #[test]
    fn test_chunk_processor_iteration() {
        let chunks = vec![
            create_test_chunk("chunk1", 0),
            create_test_chunk("chunk2", 1),
            create_test_chunk("chunk3", 2),
        ];
        
        let mut processor = ChunkProcessor::new(chunks);
        
        assert_eq!(processor.get_progress(), (0, 3));
        
        let chunk1 = processor.next_chunk();
        assert!(chunk1.is_some());
        assert_eq!(chunk1.unwrap().id, "chunk1");
        assert_eq!(processor.get_progress(), (1, 3));
        
        let chunk2 = processor.next_chunk();
        assert!(chunk2.is_some());
        assert_eq!(chunk2.unwrap().id, "chunk2");
        
        let chunk3 = processor.next_chunk();
        assert!(chunk3.is_some());
        assert_eq!(chunk3.unwrap().id, "chunk3");
        
        let none = processor.next_chunk();
        assert!(none.is_none());
    }

    #[test]
    fn test_mark_relevant() {
        let chunks = vec![create_test_chunk("chunk1", 0)];
        let mut processor = ChunkProcessor::new(chunks);
        
        processor.mark_relevant("chunk1", 0.85);
        
        let info = processor.processed_data.get("chunk1").unwrap();
        assert_eq!(info.relevance_score, 0.85);
        
        // Test clamping
        processor.mark_relevant("chunk1", 1.5);
        let info = processor.processed_data.get("chunk1").unwrap();
        assert_eq!(info.relevance_score, 1.0);
    }

    #[test]
    fn test_extract_data() {
        let chunks = vec![create_test_chunk("chunk1", 0)];
        let mut processor = ChunkProcessor::new(chunks);
        
        let mut fields = HashMap::new();
        fields.insert("name".to_string(), serde_json::Value::String("Alice".to_string()));
        fields.insert("age".to_string(), serde_json::Value::Number(serde_json::Number::from(30)));
        
        let extracted = ExtractedData {
            fields,
            confidence: 0.9,
            source_span: Some((10, 50)),
        };
        
        processor.extract_data("chunk1", extracted);
        
        let info = processor.processed_data.get("chunk1").unwrap();
        assert!(info.extracted_data.is_some());
        assert_eq!(info.extracted_data.as_ref().unwrap().confidence, 0.9);
    }
}