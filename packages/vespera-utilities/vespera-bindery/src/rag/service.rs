//! # RAG Service
//!
//! Main orchestrator for Retrieval-Augmented Generation capabilities,
//! integrating document indexing, semantic search, and hallucination detection.

use std::path::{Path, PathBuf};
use std::collections::HashMap;
use std::fs;
use anyhow::{Result, Context};
use uuid::Uuid;
use chrono::Utc;
use tokio::sync::RwLock;
use std::sync::Arc;
use sha2::{Sha256, Digest};

use super::{
    RAGConfig, DocumentMetadata, DocumentType, DocumentChunk, SearchResult,
    RAGStats, RAGHealthStatus, HealthStatus, ComponentHealth,
    ProjectManager,
    DocumentChunker, ChunkStrategy,
    EmbeddingService,
    CodeAnalyzer,
};

/// Main RAG service integrating all components
pub struct RAGService {
    pub(crate) config: RAGConfig,
    pub project_manager: Arc<ProjectManager>,
    pub(crate) chunker: Arc<DocumentChunker>,
    pub(crate) embedding_service: Arc<RwLock<EmbeddingService>>,
    pub(crate) code_analyzer: Option<Arc<CodeAnalyzer>>,
    pub(crate) documents: Arc<RwLock<HashMap<Uuid, DocumentMetadata>>>,
    pub(crate) project_path: PathBuf,
    pub(crate) vespera_path: PathBuf,
}

impl RAGService {
    /// Create a new RAG service for a project
    pub async fn new(project_path: &Path, config: RAGConfig) -> Result<Self> {
        let canonical_path = project_path.canonicalize()
            .with_context(|| format!("Failed to canonicalize project path: {:?}", project_path))?;

        // Initialize project manager
        let project_manager = Arc::new(ProjectManager::new());

        // Initialize or get project
        let project = project_manager
            .initialize_project(&canonical_path, None)
            .await?;

        let vespera_path = if let Some(override_path) = &config.vespera_folder_override {
            override_path.clone()
        } else {
            project.vespera_path.clone()
        };

        // Create RAG subdirectories
        let rag_path = vespera_path.join("rag");
        fs::create_dir_all(&rag_path)?;
        fs::create_dir_all(rag_path.join("documents"))?;
        fs::create_dir_all(rag_path.join("embeddings"))?;
        fs::create_dir_all(rag_path.join("indices"))?;

        // Initialize components
        let chunker = Arc::new(DocumentChunker::new(
            config.max_chunk_size,
            config.chunk_overlap,
        ));

        let embedding_service = Arc::new(RwLock::new(
            EmbeddingService::new(config.embedding_model.clone(), &vespera_path).await?
        ));

        let code_analyzer = if config.enable_code_analysis {
            Some(Arc::new(CodeAnalyzer::new()))
        } else {
            None
        };

        // Load existing documents index
        let documents = Arc::new(RwLock::new(Self::load_documents_index(&vespera_path)?));

        Ok(Self {
            config,
            project_manager,
            chunker,
            embedding_service,
            code_analyzer,
            documents,
            project_path: canonical_path,
            vespera_path,
        })
    }

    /// Load documents index from storage
    fn load_documents_index(vespera_path: &Path) -> Result<HashMap<Uuid, DocumentMetadata>> {
        let index_path = vespera_path.join("rag/documents/index.json");
        if index_path.exists() {
            let content = fs::read_to_string(&index_path)?;
            Ok(serde_json::from_str(&content)?)
        } else {
            Ok(HashMap::new())
        }
    }

    /// Save documents index to storage
    async fn save_documents_index(&self) -> Result<()> {
        let documents = self.documents.read().await;
        let index_path = self.vespera_path.join("rag/documents/index.json");
        let content = serde_json::to_string_pretty(&*documents)?;
        fs::write(&index_path, content)?;
        Ok(())
    }

    /// Calculate content hash for deduplication
    fn calculate_content_hash(content: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(content.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    /// Index a document into the RAG system
    pub async fn index_document(
        &self,
        title: String,
        content: String,
        document_type: DocumentType,
        source_path: Option<PathBuf>,
        tags: Vec<String>,
    ) -> Result<Uuid> {
        let document_id = Uuid::new_v4();
        let content_hash = Self::calculate_content_hash(&content);
        let now = Utc::now();

        // Check if document with same hash already exists
        {
            let documents = self.documents.read().await;
            for (_, doc) in documents.iter() {
                if doc.content_hash == content_hash {
                    // Document already indexed, return existing ID
                    return Ok(doc.id);
                }
            }
        }

        // Get current project
        let project = self.project_manager
            .get_project_by_path(&self.project_path)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Project not found"))?;

        // Create document metadata
        let metadata = DocumentMetadata {
            id: document_id,
            title: title.clone(),
            document_type,
            source_path: source_path.clone(),
            content_hash,
            indexed_at: now,
            updated_at: now,
            tags,
            project_id: Some(project.id),
        };

        // Choose chunking strategy based on document type
        let strategy = match document_type {
            DocumentType::Code => ChunkStrategy::Code,
            DocumentType::Markdown | DocumentType::Documentation => ChunkStrategy::Markdown,
            _ => ChunkStrategy::Paragraph,
        };

        // Chunk the document
        let chunks = self.chunker.chunk(&content, strategy)?;

        // Generate embeddings for each chunk
        let mut embedding_service = self.embedding_service.write().await;
        for (i, chunk_content) in chunks.iter().enumerate() {
            let chunk = DocumentChunk {
                id: format!("{}_chunk_{}", document_id, i),
                document_id,
                content: chunk_content.clone(),
                chunk_index: i,
                total_chunks: chunks.len(),
                start_char: 0, // TODO: Calculate actual character positions in original document
                end_char: chunk_content.len(),
                metadata: HashMap::new(),
            };

            // Store chunk and embedding
            embedding_service.index_chunk(&chunk).await?;
        }

        // Save document content to disk
        let doc_path = self.vespera_path.join(format!("rag/documents/{}.json", document_id));
        let doc_data = serde_json::json!({
            "metadata": metadata,
            "content": content,
            "chunks": chunks.len(),
        });
        fs::write(&doc_path, serde_json::to_string_pretty(&doc_data)?)?;

        // Analyze code if applicable
        if document_type == DocumentType::Code {
            if let Some(analyzer) = &self.code_analyzer {
                if let Some(path) = &source_path {
                    if let Some(analysis) = analyzer.analyze_file(path)? {
                        // Store analysis results
                        let analysis_path = self.vespera_path
                            .join(format!("rag/documents/{}_analysis.json", document_id));
                        fs::write(&analysis_path, serde_json::to_string_pretty(&analysis)?)?;
                    }
                }
            }
        }

        // Update documents index
        {
            let mut documents = self.documents.write().await;
            documents.insert(document_id, metadata);
        }

        self.save_documents_index().await?;

        Ok(document_id)
    }

    /// Index a file from the filesystem
    pub async fn index_file(&self, file_path: &Path) -> Result<Uuid> {
        let canonical_path = file_path.canonicalize()?;

        // Read file content
        let content = fs::read_to_string(&canonical_path)
            .with_context(|| format!("Failed to read file: {:?}", canonical_path))?;

        // Determine document type from extension
        let document_type = file_path
            .extension()
            .and_then(|ext| ext.to_str())
            .map(DocumentType::from_extension)
            .unwrap_or(DocumentType::Text);

        // Extract title from filename
        let title = file_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Untitled")
            .to_string();

        // Auto-generate tags based on path components
        let tags = canonical_path
            .components()
            .filter_map(|c| {
                if let std::path::Component::Normal(s) = c {
                    s.to_str().map(|s| s.to_string())
                } else {
                    None
                }
            })
            .collect();

        self.index_document(title, content, document_type, Some(canonical_path), tags).await
    }

    /// Index all files in a directory
    pub async fn index_directory(
        &self,
        dir_path: &Path,
        recursive: bool,
    ) -> Result<Vec<Uuid>> {
        let mut indexed_ids = Vec::new();

        // Get project settings for patterns
        let project = self.project_manager
            .get_project_by_path(&self.project_path)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Project not found"))?;

        let patterns = &project.settings.index_patterns;
        let ignore_patterns = &project.settings.ignore_patterns;

        // Walk directory and index matching files
        self.index_directory_recursive(
            dir_path,
            recursive,
            patterns,
            ignore_patterns,
            &mut indexed_ids,
        ).await?;

        Ok(indexed_ids)
    }

    async fn index_directory_recursive(
        &self,
        path: &Path,
        recursive: bool,
        patterns: &[String],
        ignore_patterns: &[String],
        indexed_ids: &mut Vec<Uuid>,
    ) -> Result<()> {
        // Check if path should be ignored
        let path_str = path.to_string_lossy();
        for ignore_pattern in ignore_patterns {
            if glob::Pattern::new(ignore_pattern)?.matches(&path_str) {
                return Ok(());
            }
        }

        if path.is_file() {
            // Check if file matches patterns
            for pattern in patterns {
                if glob::Pattern::new(pattern)?.matches(&path_str) {
                    match self.index_file(path).await {
                        Ok(id) => indexed_ids.push(id),
                        Err(e) => eprintln!("Failed to index {}: {}", path_str, e),
                    }
                    break;
                }
            }
        } else if path.is_dir() && recursive {
            if let Ok(entries) = fs::read_dir(path) {
                for entry in entries.flatten() {
                    Box::pin(self.index_directory_recursive(
                        &entry.path(),
                        recursive,
                        patterns,
                        ignore_patterns,
                        indexed_ids,
                    )).await?;
                }
            }
        }

        Ok(())
    }

    /// Search for documents using semantic similarity
    pub async fn search(
        &self,
        query: &str,
        limit: usize,
        filter_types: Option<Vec<DocumentType>>,
    ) -> Result<Vec<SearchResult>> {
        let embedding_service = self.embedding_service.read().await;
        let raw_results = embedding_service.search(query, limit * 2).await?; // Get more to filter

        let documents = self.documents.read().await;
        let mut results = Vec::new();

        for (chunk_id, score, chunk_content) in raw_results {
            // Extract document ID from chunk ID
            let doc_id_str = chunk_id.split("_chunk_").next().unwrap_or(&chunk_id);
            if let Ok(doc_id) = Uuid::parse_str(doc_id_str) {
                if let Some(metadata) = documents.get(&doc_id) {
                    // Apply type filter
                    if let Some(ref types) = filter_types {
                        if !types.contains(&metadata.document_type) {
                            continue;
                        }
                    }

                    results.push(SearchResult {
                        document_id: doc_id,
                        chunk_id: chunk_id.clone(),
                        content: chunk_content,
                        score,
                        metadata: metadata.clone(),
                        highlights: Vec::new(), // TODO: Implement query term highlighting in search results
                    });

                    if results.len() >= limit {
                        break;
                    }
                }
            }
        }

        Ok(results)
    }

    /// Get document by ID
    pub async fn get_document(&self, document_id: Uuid) -> Result<Option<(DocumentMetadata, String)>> {
        let documents = self.documents.read().await;

        if let Some(metadata) = documents.get(&document_id) {
            // Load document content from disk
            let doc_path = self.vespera_path.join(format!("rag/documents/{}.json", document_id));
            if doc_path.exists() {
                let content = fs::read_to_string(&doc_path)?;
                let doc_data: serde_json::Value = serde_json::from_str(&content)?;
                if let Some(content) = doc_data.get("content").and_then(|v| v.as_str()) {
                    return Ok(Some((metadata.clone(), content.to_string())));
                }
            }
        }

        Ok(None)
    }

    /// Delete a document
    pub async fn delete_document(&self, document_id: Uuid) -> Result<bool> {
        let mut documents = self.documents.write().await;

        if documents.remove(&document_id).is_some() {
            // Delete document file
            let doc_path = self.vespera_path.join(format!("rag/documents/{}.json", document_id));
            if doc_path.exists() {
                fs::remove_file(&doc_path)?;
            }

            // Delete analysis file if exists
            let analysis_path = self.vespera_path
                .join(format!("rag/documents/{}_analysis.json", document_id));
            if analysis_path.exists() {
                fs::remove_file(&analysis_path)?;
            }

            // Delete embeddings
            let mut embedding_service = self.embedding_service.write().await;
            embedding_service.delete_document(document_id).await?;

            // Save updated index
            drop(documents); // Release the lock before calling save
            self.save_documents_index().await?;

            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// Get statistics about the RAG system
    pub async fn get_stats(&self) -> Result<RAGStats> {
        let documents = self.documents.read().await;
        let embedding_service = self.embedding_service.read().await;
        let embedding_stats = embedding_service.get_stats().await?;

        // Calculate index size
        let rag_path = self.vespera_path.join("rag");
        let index_size = Self::calculate_directory_size(&rag_path)?;

        // Find last indexed time
        let last_indexed = documents
            .values()
            .map(|d| d.indexed_at)
            .max();

        // Count projects
        let projects = self.project_manager.get_all_projects().await;

        Ok(RAGStats {
            total_documents: documents.len(),
            total_chunks: embedding_stats.total_embeddings,
            total_embeddings: embedding_stats.total_embeddings,
            index_size_bytes: index_size,
            last_indexed,
            projects_tracked: projects.len(),
        })
    }

    fn calculate_directory_size(path: &Path) -> Result<u64> {
        let mut size = 0;

        if path.is_file() {
            size += path.metadata()?.len();
        } else if path.is_dir() {
            if let Ok(entries) = fs::read_dir(path) {
                for entry in entries.flatten() {
                    size += Self::calculate_directory_size(&entry.path())?;
                }
            }
        }

        Ok(size)
    }

    /// Get health status of the RAG system
    pub async fn health_check(&self) -> Result<RAGHealthStatus> {
        let mut components = HashMap::new();
        let now = Utc::now();
        let mut overall_status = HealthStatus::Healthy;

        // Check documents index
        {
            let documents = self.documents.read().await;
            components.insert(
                "documents".to_string(),
                ComponentHealth {
                    status: HealthStatus::Healthy,
                    message: Some(format!("{} documents indexed", documents.len())),
                    last_check: now,
                },
            );
        }

        // Check embedding service
        {
            let embedding_service = self.embedding_service.read().await;
            match embedding_service.health_check().await {
                Ok(_) => {
                    components.insert(
                        "embeddings".to_string(),
                        ComponentHealth {
                            status: HealthStatus::Healthy,
                            message: Some("Embedding service operational".to_string()),
                            last_check: now,
                        },
                    );
                }
                Err(e) => {
                    components.insert(
                        "embeddings".to_string(),
                        ComponentHealth {
                            status: HealthStatus::Unhealthy,
                            message: Some(format!("Embedding service error: {}", e)),
                            last_check: now,
                        },
                    );
                    overall_status = HealthStatus::Degraded;
                }
            }
        }

        // Check storage
        let storage_health = if self.vespera_path.exists() {
            ComponentHealth {
                status: HealthStatus::Healthy,
                message: Some(format!("Storage path: {:?}", self.vespera_path)),
                last_check: now,
            }
        } else {
            overall_status = HealthStatus::Unhealthy;
            ComponentHealth {
                status: HealthStatus::Unhealthy,
                message: Some("Storage path does not exist".to_string()),
                last_check: now,
            }
        };
        components.insert("storage".to_string(), storage_health);

        Ok(RAGHealthStatus {
            status: overall_status,
            components,
            timestamp: now,
        })
    }

    /// Re-index all documents (useful after model changes)
    pub async fn reindex_all(&self) -> Result<usize> {
        let documents = self.documents.read().await;
        let doc_ids: Vec<Uuid> = documents.keys().copied().collect();
        drop(documents);

        let mut reindexed = 0;
        for doc_id in doc_ids {
            // Load document content
            let doc_path = self.vespera_path.join(format!("rag/documents/{}.json", doc_id));
            if doc_path.exists() {
                let content = fs::read_to_string(&doc_path)?;
                let doc_data: serde_json::Value = serde_json::from_str(&content)?;

                if let Some(content) = doc_data.get("content").and_then(|v| v.as_str()) {
                    // Re-chunk and re-embed
                    let documents = self.documents.read().await;
                    if let Some(metadata) = documents.get(&doc_id) {
                        let strategy = match metadata.document_type {
                            DocumentType::Code => ChunkStrategy::Code,
                            DocumentType::Markdown | DocumentType::Documentation => ChunkStrategy::Markdown,
                            _ => ChunkStrategy::Paragraph,
                        };

                        let chunks = self.chunker.chunk(content, strategy)?;

                        let mut embedding_service = self.embedding_service.write().await;

                        // Delete old embeddings
                        embedding_service.delete_document(doc_id).await?;

                        // Create new embeddings
                        for (i, chunk_content) in chunks.iter().enumerate() {
                            let chunk = DocumentChunk {
                                id: format!("{}_chunk_{}", doc_id, i),
                                document_id: doc_id,
                                content: chunk_content.clone(),
                                chunk_index: i,
                                total_chunks: chunks.len(),
                                start_char: 0,
                                end_char: chunk_content.len(),
                                metadata: HashMap::new(),
                            };

                            embedding_service.index_chunk(&chunk).await?;
                        }

                        reindexed += 1;
                    }
                }
            }
        }

        Ok(reindexed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_rag_service_creation() {
        let temp_dir = TempDir::new().unwrap();
        let config = RAGConfig::default();

        let service = RAGService::new(temp_dir.path(), config).await.unwrap();
        assert!(service.vespera_path.exists());
        assert!(service.vespera_path.join("rag").exists());
    }

    #[tokio::test]
    async fn test_document_indexing() {
        let temp_dir = TempDir::new().unwrap();
        let config = RAGConfig::default();
        let service = RAGService::new(temp_dir.path(), config).await.unwrap();

        let doc_id = service
            .index_document(
                "Test Document".to_string(),
                "This is a test document content.".to_string(),
                DocumentType::Text,
                None,
                vec!["test".to_string()],
            )
            .await
            .unwrap();

        // Verify document was indexed
        let (metadata, content) = service.get_document(doc_id).await.unwrap().unwrap();
        assert_eq!(metadata.title, "Test Document");
        assert_eq!(content, "This is a test document content.");
    }

    #[tokio::test]
    async fn test_document_search() {
        let temp_dir = TempDir::new().unwrap();
        let config = RAGConfig::default();
        let service = RAGService::new(temp_dir.path(), config).await.unwrap();

        // Index multiple documents
        let _doc1 = service
            .index_document(
                "Rust Programming".to_string(),
                "Rust is a systems programming language focused on safety.".to_string(),
                DocumentType::Text,
                None,
                vec![],
            )
            .await
            .unwrap();

        let _doc2 = service
            .index_document(
                "Python Guide".to_string(),
                "Python is a high-level programming language.".to_string(),
                DocumentType::Text,
                None,
                vec![],
            )
            .await
            .unwrap();

        // Search for documents
        let results = service.search("programming language", 10, None).await.unwrap();
        assert!(!results.is_empty());
    }
}