//! # RAG (Retrieval-Augmented Generation) Module
//!
//! This module provides comprehensive RAG capabilities for Vespera Bindery,
//! including document indexing, semantic search, and code analysis.
//!
//! ## Architecture
//!
//! The RAG system integrates with the core Bindery functionality through:
//! - Document chunking and embedding generation
//! - Vector database for semantic search
//! - Code analysis for hallucination detection
//! - Project-aware .vespera folder management

use std::path::{Path, PathBuf};
use std::collections::HashMap;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

pub mod service;
pub mod embeddings;
pub mod chunker;
pub mod code_analyzer;
pub mod project_manager;

#[cfg(any(feature = "embeddings-local", feature = "embeddings-onnx", feature = "embeddings-api"))]
pub mod embeddings_impl;

pub use service::RAGService;
pub use embeddings::{EmbeddingService, EmbeddingModel};
pub use chunker::{DocumentChunker, ChunkStrategy};
pub use code_analyzer::{CodeAnalyzer, CodeAnalysis};
pub use project_manager::{ProjectManager, ProjectConfig};

/// Configuration for the RAG system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RAGConfig {
    /// Embedding model to use
    pub embedding_model: EmbeddingModel,

    /// Maximum chunk size in tokens
    pub max_chunk_size: usize,

    /// Chunk overlap in tokens
    pub chunk_overlap: usize,

    /// Enable code analysis features
    pub enable_code_analysis: bool,

    /// Enable automatic project detection
    pub auto_detect_projects: bool,

    /// Custom .vespera folder location (if not in project root)
    pub vespera_folder_override: Option<PathBuf>,
}

impl Default for RAGConfig {
    fn default() -> Self {
        Self {
            embedding_model: EmbeddingModel::default(),
            max_chunk_size: 512,
            chunk_overlap: 50,
            enable_code_analysis: true,
            auto_detect_projects: true,
            vespera_folder_override: None,
        }
    }
}

/// Document metadata for RAG indexing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentMetadata {
    pub id: Uuid,
    pub title: String,
    pub document_type: DocumentType,
    pub source_path: Option<PathBuf>,
    pub content_hash: String,
    pub indexed_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub tags: Vec<String>,
    pub project_id: Option<Uuid>,
}

/// Types of documents that can be indexed
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum DocumentType {
    Text,
    Code,
    Markdown,
    Documentation,
    Configuration,
    Data,
}

impl DocumentType {
    /// Determine document type from file extension
    pub fn from_extension(ext: &str) -> Self {
        match ext.to_lowercase().as_str() {
            "py" | "rs" | "js" | "ts" | "java" | "cpp" | "c" | "go" => DocumentType::Code,
            "md" | "mdx" => DocumentType::Markdown,
            "rst" | "adoc" => DocumentType::Documentation,
            "json" | "yaml" | "yml" | "toml" | "ini" => DocumentType::Configuration,
            "csv" | "tsv" | "jsonl" => DocumentType::Data,
            _ => DocumentType::Text,
        }
    }
}

/// A chunk of a document after splitting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentChunk {
    pub id: String,
    pub document_id: Uuid,
    pub content: String,
    pub chunk_index: usize,
    pub total_chunks: usize,
    pub start_char: usize,
    pub end_char: usize,
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Search result from the RAG system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub document_id: Uuid,
    pub chunk_id: String,
    pub content: String,
    pub score: f32,
    pub metadata: DocumentMetadata,
    pub highlights: Vec<TextHighlight>,
}

/// Text highlight in search results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextHighlight {
    pub start: usize,
    pub end: usize,
    pub text: String,
}

/// Statistics about the RAG system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RAGStats {
    pub total_documents: usize,
    pub total_chunks: usize,
    pub total_embeddings: usize,
    pub index_size_bytes: u64,
    pub last_indexed: Option<DateTime<Utc>>,
    pub projects_tracked: usize,
}

/// Health status of the RAG system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RAGHealthStatus {
    pub status: HealthStatus,
    pub components: HashMap<String, ComponentHealth>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum HealthStatus {
    Healthy,
    Degraded,
    Unhealthy,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentHealth {
    pub status: HealthStatus,
    pub message: Option<String>,
    pub last_check: DateTime<Utc>,
}

/// Trait for vector storage backends
pub trait VectorStorage: Send + Sync {
    /// Store an embedding with metadata
    fn store_embedding(
        &self,
        id: &str,
        embedding: &[f32],
        metadata: HashMap<String, serde_json::Value>,
    ) -> Result<()>;

    /// Search for similar embeddings
    fn search(
        &self,
        query_embedding: &[f32],
        limit: usize,
        filter: Option<HashMap<String, serde_json::Value>>,
    ) -> Result<Vec<(String, f32, HashMap<String, serde_json::Value>)>>;

    /// Delete an embedding by ID
    fn delete(&self, id: &str) -> Result<bool>;

    /// Get statistics about the storage
    fn stats(&self) -> Result<HashMap<String, serde_json::Value>>;
}

/// Initialize the RAG system for a project
pub async fn initialize(project_path: &Path, config: RAGConfig) -> Result<RAGService> {
    RAGService::new(project_path, config).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_document_type_from_extension() {
        assert_eq!(DocumentType::from_extension("py"), DocumentType::Code);
        assert_eq!(DocumentType::from_extension("rs"), DocumentType::Code);
        assert_eq!(DocumentType::from_extension("md"), DocumentType::Markdown);
        assert_eq!(DocumentType::from_extension("json"), DocumentType::Configuration);
        assert_eq!(DocumentType::from_extension("txt"), DocumentType::Text);
    }

    #[test]
    fn test_rag_config_default() {
        let config = RAGConfig::default();
        assert_eq!(config.max_chunk_size, 512);
        assert_eq!(config.chunk_overlap, 50);
        assert!(config.enable_code_analysis);
        assert!(config.auto_detect_projects);
    }
}