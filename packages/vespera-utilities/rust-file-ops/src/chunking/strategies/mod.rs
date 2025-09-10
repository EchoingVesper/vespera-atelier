//! Chunking strategies for different document types

mod fixed;
mod sentence;
mod paragraph;
mod conversation;

pub use fixed::FixedSizeChunker;
pub use sentence::SentenceBoundaryChunker;
pub use paragraph::ParagraphBoundaryChunker;
pub use conversation::ConversationBreakChunker;

use crate::chunking::{ChunkingConfig, ChunkStrategy, DocumentChunk};
use crate::error::VesperaError;

/// Main entry point for document chunking
pub fn chunk_document(
    content: &str,
    config: &ChunkingConfig,
) -> Result<Vec<DocumentChunk>, VesperaError> {
    match config.chunk_strategy {
        ChunkStrategy::FixedSize => {
            FixedSizeChunker::new(config).chunk(content)
        }
        ChunkStrategy::SentenceBoundary => {
            SentenceBoundaryChunker::new(config).chunk(content)
        }
        ChunkStrategy::ParagraphBoundary => {
            ParagraphBoundaryChunker::new(config).chunk(content)
        }
        ChunkStrategy::ConversationBreak => {
            ConversationBreakChunker::new(config).chunk(content)
        }
        ChunkStrategy::HtmlStructureAware => {
            // For HTML-aware chunking, we'll need to parse the HTML first
            // This will be implemented when we add the scraper dependency
            todo!("HTML structure-aware chunking")
        }
        ChunkStrategy::SemanticSimilarity => {
            // This requires embeddings, which we'll add later
            todo!("Semantic similarity chunking")
        }
    }
}

/// Trait for all chunking strategies
pub trait ChunkingStrategy {
    /// Chunk the content according to the strategy
    fn chunk(&self, content: &str) -> Result<Vec<DocumentChunk>, VesperaError>;
    
    /// Find natural boundaries in the text
    fn find_boundaries(&self, content: &str) -> Vec<usize>;
    
    /// Apply overlap to chunks for context preservation
    fn apply_overlap(&self, chunks: &mut Vec<DocumentChunk>, original: &str);
}