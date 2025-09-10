//! Configuration types for document chunking

use serde::{Deserialize, Serialize};

/// Configuration for document chunking operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChunkingConfig {
    /// Target size for each chunk (in characters or tokens)
    pub max_chunk_size: usize,
    
    /// Number of characters/tokens to overlap between chunks for context preservation
    pub overlap_size: usize,
    
    /// Strategy to use for determining chunk boundaries
    pub chunk_strategy: ChunkStrategy,
    
    /// Whether to preserve metadata across chunks
    pub preserve_metadata: bool,
    
    /// Format of the input document
    pub format: DocumentFormat,
}

impl Default for ChunkingConfig {
    fn default() -> Self {
        Self {
            max_chunk_size: 2000,
            overlap_size: 200,
            chunk_strategy: ChunkStrategy::SentenceBoundary,
            preserve_metadata: true,
            format: DocumentFormat::PlainText,
        }
    }
}

/// Strategy for determining chunk boundaries
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ChunkStrategy {
    /// Simple fixed-size splitting at character boundaries
    FixedSize,
    
    /// Split at sentence endings (periods, exclamation marks, question marks)
    SentenceBoundary,
    
    /// Split at paragraph breaks (double newlines)
    ParagraphBoundary,
    
    /// Smart detection of conversation boundaries (for chat logs)
    ConversationBreak,
    
    /// Preserve HTML structure when chunking (for Discord exports)
    HtmlStructureAware,
    
    /// Group semantically related content (requires embeddings)
    SemanticSimilarity,
}

/// Format of the input document
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DocumentFormat {
    /// Plain text file
    PlainText,
    
    /// Markdown formatted text
    Markdown,
    
    /// HTML document
    Html,
    
    /// Discord HTML export
    DiscordHtml,
    
    /// JSON structured data
    Json,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = ChunkingConfig::default();
        assert_eq!(config.max_chunk_size, 2000);
        assert_eq!(config.overlap_size, 200);
        assert_eq!(config.chunk_strategy, ChunkStrategy::SentenceBoundary);
        assert!(config.preserve_metadata);
        assert_eq!(config.format, DocumentFormat::PlainText);
    }

    #[test]
    fn test_config_serialization() {
        let config = ChunkingConfig {
            max_chunk_size: 1500,
            overlap_size: 100,
            chunk_strategy: ChunkStrategy::ConversationBreak,
            preserve_metadata: false,
            format: DocumentFormat::DiscordHtml,
        };

        let json = serde_json::to_string(&config).unwrap();
        let deserialized: ChunkingConfig = serde_json::from_str(&json).unwrap();
        
        assert_eq!(deserialized.max_chunk_size, config.max_chunk_size);
        assert_eq!(deserialized.chunk_strategy, config.chunk_strategy);
        assert_eq!(deserialized.format, config.format);
    }
}