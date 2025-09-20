//! # Embeddings Service
//!
//! Manages document embeddings for semantic search.
//! Provides an abstraction layer that can work with multiple embedding backends.

use std::path::{Path, PathBuf};
use std::collections::HashMap;
use std::fs;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

use super::DocumentChunk;

#[cfg(any(feature = "embeddings-local", feature = "embeddings-onnx", feature = "embeddings-api"))]
pub use super::embeddings_impl::{UnifiedEmbedder, EmbeddingConfig, EmbeddingProvider};

/// Supported embedding models
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EmbeddingModel {
    /// Local sentence-transformers model
    LocalModel(String),
    /// OpenAI embeddings
    OpenAI(String),
    /// Cohere embeddings
    Cohere(String),
    /// Mock embeddings for testing
    Mock,
}

impl Default for EmbeddingModel {
    fn default() -> Self {
        // Default to mock for now, can be changed to LocalModel once integrated
        EmbeddingModel::Mock
    }
}

/// Statistics about the embedding service
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingStats {
    pub total_embeddings: usize,
    pub total_documents: usize,
    pub index_size_bytes: u64,
    pub model_info: String,
}

/// A stored embedding with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredEmbedding {
    pub id: String,
    pub document_id: Uuid,
    pub embedding: Vec<f32>,
    pub content: String,
    pub metadata: HashMap<String, serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

/// Service for managing document embeddings
pub struct EmbeddingService {
    model: EmbeddingModel,
    storage_path: PathBuf,
    embeddings: HashMap<String, StoredEmbedding>,
    document_index: HashMap<Uuid, Vec<String>>, // Document ID -> Chunk IDs
}

impl EmbeddingService {
    /// Create a new embedding service
    pub async fn new(model: EmbeddingModel, base_path: &Path) -> Result<Self> {
        let storage_path = base_path.join("rag/embeddings");
        fs::create_dir_all(&storage_path)?;

        // Load existing embeddings
        let (embeddings, document_index) = Self::load_embeddings(&storage_path)?;

        Ok(Self {
            model,
            storage_path,
            embeddings,
            document_index,
        })
    }

    /// Load embeddings from storage
    fn load_embeddings(
        storage_path: &Path,
    ) -> Result<(HashMap<String, StoredEmbedding>, HashMap<Uuid, Vec<String>>)> {
        let mut embeddings = HashMap::new();
        let mut document_index = HashMap::new();

        let index_path = storage_path.join("index.json");
        if index_path.exists() {
            let content = fs::read_to_string(&index_path)?;
            let stored: Vec<StoredEmbedding> = serde_json::from_str(&content)?;

            for embedding in stored {
                // Build document index
                document_index
                    .entry(embedding.document_id)
                    .or_insert_with(Vec::new)
                    .push(embedding.id.clone());

                embeddings.insert(embedding.id.clone(), embedding);
            }
        }

        Ok((embeddings, document_index))
    }

    /// Save embeddings to storage
    async fn save_embeddings(&self) -> Result<()> {
        let index_path = self.storage_path.join("index.json");
        let embeddings: Vec<&StoredEmbedding> = self.embeddings.values().collect();
        let content = serde_json::to_string_pretty(&embeddings)?;
        fs::write(&index_path, content)?;
        Ok(())
    }

    /// Generate embedding for text
    async fn generate_embedding(&self, text: &str) -> Result<Vec<f32>> {
        match &self.model {
            EmbeddingModel::Mock => {
                // Generate mock embeddings based on text hash for consistency
                let mut mock_embedding = vec![0.0; 384]; // Common embedding size
                let hash = Self::simple_hash(text);

                for (i, val) in mock_embedding.iter_mut().enumerate() {
                    *val = ((hash + i as u64) % 1000) as f32 / 1000.0;
                }

                Ok(mock_embedding)
            }
            EmbeddingModel::LocalModel(model_name) => {
                #[cfg(any(feature = "embeddings-local", feature = "embeddings-onnx"))]
                {
                    use super::embeddings_impl::{UnifiedEmbedder, EmbeddingConfig, EmbeddingProvider};

                    let config = EmbeddingConfig {
                        provider: EmbeddingProvider::Local,
                        model_name: model_name.clone(),
                        ..Default::default()
                    };

                    let embedder = UnifiedEmbedder::new(config).await?;
                    embedder.embed_single(text).await
                }

                #[cfg(not(any(feature = "embeddings-local", feature = "embeddings-onnx")))]
                anyhow::bail!("Local model embedding not compiled in. Enable 'embeddings-local' or 'embeddings-onnx' feature: {}", model_name)
            }
            EmbeddingModel::OpenAI(model_name) => {
                #[cfg(feature = "embeddings-api")]
                {
                    use super::embeddings_impl::{UnifiedEmbedder, EmbeddingConfig, EmbeddingProvider};

                    let config = EmbeddingConfig {
                        provider: EmbeddingProvider::OpenAI,
                        model_name: model_name.clone(),
                        ..Default::default()
                    };

                    let embedder = UnifiedEmbedder::new(config).await?;
                    embedder.embed_single(text).await
                }

                #[cfg(not(feature = "embeddings-api"))]
                anyhow::bail!("OpenAI embedding not compiled in. Enable 'embeddings-api' feature: {}", model_name)
            }
            EmbeddingModel::Cohere(model_name) => {
                #[cfg(feature = "embeddings-api")]
                {
                    use super::embeddings_impl::{UnifiedEmbedder, EmbeddingConfig, EmbeddingProvider};

                    let config = EmbeddingConfig {
                        provider: EmbeddingProvider::Cohere,
                        model_name: model_name.clone(),
                        ..Default::default()
                    };

                    let embedder = UnifiedEmbedder::new(config).await?;
                    embedder.embed_single(text).await
                }

                #[cfg(not(feature = "embeddings-api"))]
                anyhow::bail!("Cohere embedding not compiled in. Enable 'embeddings-api' feature: {}", model_name)
            }
        }
    }

    /// Simple hash function for mock embeddings
    fn simple_hash(text: &str) -> u64 {
        text.bytes().fold(0u64, |acc, b| acc.wrapping_mul(31).wrapping_add(b as u64))
    }

    /// Index a document chunk
    pub async fn index_chunk(&mut self, chunk: &DocumentChunk) -> Result<()> {
        // Generate embedding
        let embedding = self.generate_embedding(&chunk.content).await?;

        // Create stored embedding
        let stored = StoredEmbedding {
            id: chunk.id.clone(),
            document_id: chunk.document_id,
            embedding,
            content: chunk.content.clone(),
            metadata: chunk.metadata.clone(),
            created_at: Utc::now(),
        };

        // Store in memory
        self.embeddings.insert(chunk.id.clone(), stored);

        // Update document index
        self.document_index
            .entry(chunk.document_id)
            .or_insert_with(Vec::new)
            .push(chunk.id.clone());

        // Save to disk
        self.save_embeddings().await?;

        Ok(())
    }

    /// Search for similar content
    pub async fn search(
        &self,
        query: &str,
        limit: usize,
    ) -> Result<Vec<(String, f32, String)>> {
        // Generate query embedding
        let query_embedding = self.generate_embedding(query).await?;

        // Calculate similarities
        let mut similarities: Vec<(String, f32, String)> = self
            .embeddings
            .values()
            .map(|stored| {
                let similarity = Self::cosine_similarity(&query_embedding, &stored.embedding);
                (stored.id.clone(), similarity, stored.content.clone())
            })
            .collect();

        // Sort by similarity (descending)
        similarities.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        // Return top results
        Ok(similarities.into_iter().take(limit).collect())
    }

    /// Calculate cosine similarity between two vectors
    fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
        if a.len() != b.len() {
            return 0.0;
        }

        let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
        let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
        let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

        if norm_a == 0.0 || norm_b == 0.0 {
            return 0.0;
        }

        dot_product / (norm_a * norm_b)
    }

    /// Delete all embeddings for a document
    pub async fn delete_document(&mut self, document_id: Uuid) -> Result<()> {
        if let Some(chunk_ids) = self.document_index.remove(&document_id) {
            for chunk_id in chunk_ids {
                self.embeddings.remove(&chunk_id);
            }

            self.save_embeddings().await?;
        }

        Ok(())
    }

    /// Get statistics about the embedding service
    pub async fn get_stats(&self) -> Result<EmbeddingStats> {
        let index_path = self.storage_path.join("index.json");
        let index_size = if index_path.exists() {
            index_path.metadata()?.len()
        } else {
            0
        };

        let model_info = match &self.model {
            EmbeddingModel::Mock => "Mock embeddings (testing)".to_string(),
            EmbeddingModel::LocalModel(name) => format!("Local model: {}", name),
            EmbeddingModel::OpenAI(name) => format!("OpenAI: {}", name),
            EmbeddingModel::Cohere(name) => format!("Cohere: {}", name),
        };

        Ok(EmbeddingStats {
            total_embeddings: self.embeddings.len(),
            total_documents: self.document_index.len(),
            index_size_bytes: index_size,
            model_info,
        })
    }

    /// Health check for the embedding service
    pub async fn health_check(&self) -> Result<()> {
        // Test embedding generation
        let test_text = "Health check test";
        let _ = self.generate_embedding(test_text).await?;

        // Check storage is accessible
        if !self.storage_path.exists() {
            anyhow::bail!("Storage path does not exist");
        }

        Ok(())
    }

    /// Re-index with a new model
    pub async fn reindex_with_model(&mut self, new_model: EmbeddingModel) -> Result<usize> {
        self.model = new_model;

        // Collect all existing content
        let chunks: Vec<(String, Uuid, String, HashMap<String, serde_json::Value>)> = self
            .embeddings
            .values()
            .map(|e| (e.id.clone(), e.document_id, e.content.clone(), e.metadata.clone()))
            .collect();

        // Clear existing embeddings
        self.embeddings.clear();
        self.document_index.clear();

        // Re-generate embeddings
        let mut reindexed = 0;
        for (id, doc_id, content, metadata) in chunks {
            let embedding = self.generate_embedding(&content).await?;

            let stored = StoredEmbedding {
                id: id.clone(),
                document_id: doc_id,
                embedding,
                content,
                metadata,
                created_at: Utc::now(),
            };

            self.embeddings.insert(id.clone(), stored);
            self.document_index
                .entry(doc_id)
                .or_insert_with(Vec::new)
                .push(id);

            reindexed += 1;
        }

        self.save_embeddings().await?;

        Ok(reindexed)
    }

    /// Export embeddings to a portable format
    pub async fn export_embeddings(&self, output_path: &Path) -> Result<()> {
        let export_data = serde_json::json!({
            "model": self.model,
            "embeddings": self.embeddings.values().collect::<Vec<_>>(),
            "exported_at": Utc::now(),
        });

        let content = serde_json::to_string_pretty(&export_data)?;
        fs::write(output_path, content)?;

        Ok(())
    }

    /// Import embeddings from a file
    pub async fn import_embeddings(&mut self, input_path: &Path) -> Result<usize> {
        let content = fs::read_to_string(input_path)?;
        let import_data: serde_json::Value = serde_json::from_str(&content)?;

        let embeddings = import_data["embeddings"]
            .as_array()
            .ok_or_else(|| anyhow::anyhow!("Invalid import format"))?;

        let mut imported = 0;
        for embedding_value in embeddings {
            let stored: StoredEmbedding = serde_json::from_value(embedding_value.clone())?;

            self.embeddings.insert(stored.id.clone(), stored.clone());
            self.document_index
                .entry(stored.document_id)
                .or_insert_with(Vec::new)
                .push(stored.id);

            imported += 1;
        }

        self.save_embeddings().await?;

        Ok(imported)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_embedding_service_creation() {
        let temp_dir = TempDir::new().unwrap();
        let service = EmbeddingService::new(EmbeddingModel::Mock, temp_dir.path()).await.unwrap();
        assert_eq!(service.embeddings.len(), 0);
    }

    #[tokio::test]
    async fn test_mock_embeddings() {
        let temp_dir = TempDir::new().unwrap();
        let service = EmbeddingService::new(EmbeddingModel::Mock, temp_dir.path()).await.unwrap();

        let embedding1 = service.generate_embedding("test text 1").await.unwrap();
        let embedding2 = service.generate_embedding("test text 2").await.unwrap();
        let embedding3 = service.generate_embedding("test text 1").await.unwrap(); // Same as first

        assert_eq!(embedding1.len(), 384);
        assert_eq!(embedding2.len(), 384);
        assert_eq!(embedding1, embedding3); // Same text should produce same embedding
        assert_ne!(embedding1, embedding2); // Different text should produce different embeddings
    }

    #[tokio::test]
    async fn test_cosine_similarity() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![1.0, 0.0, 0.0];
        let c = vec![0.0, 1.0, 0.0];

        assert_eq!(EmbeddingService::cosine_similarity(&a, &b), 1.0); // Identical vectors
        assert_eq!(EmbeddingService::cosine_similarity(&a, &c), 0.0); // Orthogonal vectors
    }

    #[tokio::test]
    async fn test_chunk_indexing_and_search() {
        let temp_dir = TempDir::new().unwrap();
        let mut service = EmbeddingService::new(EmbeddingModel::Mock, temp_dir.path()).await.unwrap();

        let doc_id = Uuid::new_v4();

        // Index some chunks
        let chunk1 = DocumentChunk {
            id: "chunk1".to_string(),
            document_id: doc_id,
            content: "Rust programming language".to_string(),
            chunk_index: 0,
            total_chunks: 2,
            start_char: 0,
            end_char: 25,
            metadata: HashMap::new(),
        };

        let chunk2 = DocumentChunk {
            id: "chunk2".to_string(),
            document_id: doc_id,
            content: "Python programming language".to_string(),
            chunk_index: 1,
            total_chunks: 2,
            start_char: 26,
            end_char: 52,
            metadata: HashMap::new(),
        };

        service.index_chunk(&chunk1).await.unwrap();
        service.index_chunk(&chunk2).await.unwrap();

        // Search
        let results = service.search("programming", 2).await.unwrap();
        assert_eq!(results.len(), 2);
    }

    #[tokio::test]
    async fn test_document_deletion() {
        let temp_dir = TempDir::new().unwrap();
        let mut service = EmbeddingService::new(EmbeddingModel::Mock, temp_dir.path()).await.unwrap();

        let doc_id = Uuid::new_v4();

        // Index a chunk
        let chunk = DocumentChunk {
            id: "chunk1".to_string(),
            document_id: doc_id,
            content: "Test content".to_string(),
            chunk_index: 0,
            total_chunks: 1,
            start_char: 0,
            end_char: 12,
            metadata: HashMap::new(),
        };

        service.index_chunk(&chunk).await.unwrap();
        assert_eq!(service.embeddings.len(), 1);

        // Delete document
        service.delete_document(doc_id).await.unwrap();
        assert_eq!(service.embeddings.len(), 0);
    }
}