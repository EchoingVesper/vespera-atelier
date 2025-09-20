//! # Fallback Service for External API Failures
//!
//! Provides fallback mechanisms when external embedding services are unavailable.
//! Implements graceful degradation strategies to maintain system functionality.

use anyhow::Result;
use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use tracing::{info, warn};
use uuid::Uuid;

use super::{DocumentChunk, SearchResult, DocumentMetadata};

/// Fallback strategy configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FallbackConfig {
    /// Enable mock embeddings as fallback
    pub enable_mock_embeddings: bool,
    /// Enable keyword-based search as fallback
    pub enable_keyword_search: bool,
    /// Enable cached results as fallback
    pub enable_cached_results: bool,
    /// Maximum age for cached results in seconds
    pub cache_max_age_seconds: u64,
    /// Enable fuzzy string matching
    pub enable_fuzzy_matching: bool,
    /// Fuzzy matching threshold (0.0-1.0)
    pub fuzzy_threshold: f64,
}

impl Default for FallbackConfig {
    fn default() -> Self {
        Self {
            enable_mock_embeddings: true,
            enable_keyword_search: true,
            enable_cached_results: true,
            cache_max_age_seconds: 3600, // 1 hour
            enable_fuzzy_matching: true,
            fuzzy_threshold: 0.6,
        }
    }
}

/// Fallback embedding service
pub struct FallbackEmbeddingService {
    config: FallbackConfig,
    cached_embeddings: HashMap<String, (Vec<f32>, std::time::Instant)>,
    document_index: HashMap<Uuid, Vec<DocumentChunk>>,
    keyword_index: HashMap<String, Vec<(Uuid, String)>>, // word -> [(doc_id, chunk_id)]
}

impl FallbackEmbeddingService {
    /// Create a new fallback service
    pub fn new(config: FallbackConfig) -> Self {
        info!("Initializing fallback embedding service");
        
        Self {
            config,
            cached_embeddings: HashMap::new(),
            document_index: HashMap::new(),
            keyword_index: HashMap::new(),
        }
    }

    /// Generate mock embedding for text
    pub async fn generate_mock_embedding(&self, text: &str) -> Result<Vec<f32>> {
        if !self.config.enable_mock_embeddings {
            return Err(anyhow::anyhow!("Mock embeddings disabled"));
        }

        // Generate deterministic mock embeddings based on text hash
        let mut mock_embedding = vec![0.0; 384]; // Standard embedding size
        let hash = self.simple_hash(text);

        for (i, val) in mock_embedding.iter_mut().enumerate() {
            *val = ((hash.wrapping_add(i as u64)) % 1000) as f32 / 1000.0;
        }

        // Normalize the vector
        let norm = mock_embedding.iter().map(|x| x * x).sum::<f32>().sqrt();
        if norm > 0.0 {
            for val in mock_embedding.iter_mut() {
                *val /= norm;
            }
        }

        Ok(mock_embedding)
    }

    /// Simple hash function for consistent mock embeddings
    fn simple_hash(&self, text: &str) -> u64 {
        text.bytes().fold(0u64, |acc, b| {
            acc.wrapping_mul(31).wrapping_add(b as u64)
        })
    }

    /// Index document chunks for keyword search
    pub async fn index_chunk_for_fallback(&mut self, chunk: &DocumentChunk) -> Result<()> {
        // Store the chunk
        self.document_index
            .entry(chunk.document_id)
            .or_insert_with(Vec::new)
            .push(chunk.clone());

        // Build keyword index
        if self.config.enable_keyword_search {
            let words = self.extract_keywords(&chunk.content);
            for word in words {
                self.keyword_index
                    .entry(word.to_lowercase())
                    .or_insert_with(Vec::new)
                    .push((chunk.document_id, chunk.id.clone()));
            }
        }

        info!("Indexed chunk {} for fallback search", chunk.id);
        Ok(())
    }

    /// Extract keywords from text for indexing
    fn extract_keywords(&self, text: &str) -> Vec<String> {
        text.split_whitespace()
            .filter(|word| word.len() > 2) // Filter out very short words
            .map(|word| {
                // Remove punctuation and convert to lowercase
                word.chars()
                    .filter(|c| c.is_alphanumeric())
                    .collect::<String>()
                    .to_lowercase()
            })
            .filter(|word| !word.is_empty())
            .collect()
    }

    /// Perform keyword-based search as fallback
    pub async fn keyword_search(
        &self,
        query: &str,
        limit: usize,
    ) -> Result<Vec<SearchResult>> {
        if !self.config.enable_keyword_search {
            return Err(anyhow::anyhow!("Keyword search disabled"));
        }

        let query_words = self.extract_keywords(query);
        let mut scores: HashMap<(Uuid, String), f32> = HashMap::new();

        // Score chunks based on keyword matches
        for query_word in &query_words {
            if let Some(matches) = self.keyword_index.get(query_word) {
                for (doc_id, chunk_id) in matches {
                    let key = (*doc_id, chunk_id.clone());
                    *scores.entry(key).or_insert(0.0) += 1.0;
                }
            }

            // Fuzzy matching
            if self.config.enable_fuzzy_matching {
                for (indexed_word, matches) in &self.keyword_index {
                    let similarity = self.fuzzy_similarity(query_word, indexed_word);
                    if similarity >= self.config.fuzzy_threshold as f32 {
                        for (doc_id, chunk_id) in matches {
                            let key = (*doc_id, chunk_id.clone());
                            *scores.entry(key).or_insert(0.0) += similarity * 0.5; // Reduced weight for fuzzy matches
                        }
                    }
                }
            }
        }

        // Convert to search results
        let mut results = Vec::new();
        for ((doc_id, chunk_id), score) in scores {
            if let Some(chunks) = self.document_index.get(&doc_id) {
                if let Some(chunk) = chunks.iter().find(|c| c.id == chunk_id) {
                    // Create dummy metadata (in real implementation, this would be retrieved)
                    let metadata = DocumentMetadata {
                        id: doc_id,
                        title: format!("Document {}", doc_id),
                        document_type: super::DocumentType::Text,
                        source_path: None,
                        content_hash: String::new(),
                        indexed_at: chrono::Utc::now(),
                        updated_at: chrono::Utc::now(),
                        tags: Vec::new(),
                        project_id: None,
                    };

                    results.push(SearchResult {
                        document_id: doc_id,
                        chunk_id: chunk_id.clone(),
                        content: chunk.content.clone(),
                        score: score / query_words.len() as f32, // Normalize by query length
                        metadata,
                        highlights: self.find_highlights(&chunk.content, &query_words),
                    });
                }
            }
        }

        // Sort by score descending
        results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        
        // Limit results
        results.truncate(limit);
        
        warn!("Performed fallback keyword search, found {} results", results.len());
        Ok(results)
    }

    /// Calculate fuzzy similarity between two strings
    fn fuzzy_similarity(&self, a: &str, b: &str) -> f32 {
        if a == b {
            return 1.0;
        }

        // Simple Levenshtein distance-based similarity
        let len_a = a.len();
        let len_b = b.len();
        
        if len_a == 0 || len_b == 0 {
            return 0.0;
        }

        let max_len = len_a.max(len_b);
        let distance = self.levenshtein_distance(a, b);
        
        1.0 - (distance as f32 / max_len as f32)
    }

    /// Calculate Levenshtein distance between two strings
    fn levenshtein_distance(&self, a: &str, b: &str) -> usize {
        let a_chars: Vec<char> = a.chars().collect();
        let b_chars: Vec<char> = b.chars().collect();
        let len_a = a_chars.len();
        let len_b = b_chars.len();

        if len_a == 0 {
            return len_b;
        }
        if len_b == 0 {
            return len_a;
        }

        let mut matrix = vec![vec![0; len_b + 1]; len_a + 1];

        // Initialize first row and column
        for i in 0..=len_a {
            matrix[i][0] = i;
        }
        for j in 0..=len_b {
            matrix[0][j] = j;
        }

        // Fill the matrix
        for i in 1..=len_a {
            for j in 1..=len_b {
                let cost = if a_chars[i - 1] == b_chars[j - 1] { 0 } else { 1 };
                
                matrix[i][j] = [
                    matrix[i - 1][j] + 1,     // deletion
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j - 1] + cost, // substitution
                ].iter().min().unwrap().clone();
            }
        }

        matrix[len_a][len_b]
    }

    /// Find text highlights for search results
    fn find_highlights(&self, content: &str, query_words: &[String]) -> Vec<super::TextHighlight> {
        let mut highlights = Vec::new();
        let content_lower = content.to_lowercase();

        for word in query_words {
            let word_lower = word.to_lowercase();
            let mut start = 0;
            
            while let Some(pos) = content_lower[start..].find(&word_lower) {
                let absolute_pos = start + pos;
                let end_pos = absolute_pos + word.len();
                
                if end_pos <= content.len() {
                    highlights.push(super::TextHighlight {
                        start: absolute_pos,
                        end: end_pos,
                        text: content[absolute_pos..end_pos].to_string(),
                    });
                }
                
                start = absolute_pos + 1;
            }
        }

        highlights
    }

    /// Get cached embedding if available and not expired
    pub async fn get_cached_embedding(&self, text: &str) -> Option<Vec<f32>> {
        if !self.config.enable_cached_results {
            return None;
        }

        if let Some((embedding, timestamp)) = self.cached_embeddings.get(text) {
            let age = timestamp.elapsed().as_secs();
            if age < self.config.cache_max_age_seconds {
                return Some(embedding.clone());
            }
        }
        
        None
    }

    /// Cache an embedding
    pub async fn cache_embedding(&mut self, text: String, embedding: Vec<f32>) {
        if self.config.enable_cached_results {
            self.cached_embeddings.insert(text, (embedding, std::time::Instant::now()));
        }
    }

    /// Clear expired cache entries
    pub async fn cleanup_cache(&mut self) {
        if !self.config.enable_cached_results {
            return;
        }

        let now = std::time::Instant::now();
        self.cached_embeddings.retain(|_, (_, timestamp)| {
            now.duration_since(*timestamp).as_secs() < self.config.cache_max_age_seconds
        });
    }

    /// Get fallback service statistics
    pub async fn get_stats(&self) -> FallbackStats {
        FallbackStats {
            cached_embeddings: self.cached_embeddings.len(),
            indexed_documents: self.document_index.len(),
            indexed_keywords: self.keyword_index.len(),
            cache_hit_rate: 0.0, // TODO: Track this in production
            fallback_requests: 0, // TODO: Track this in production
        }
    }

    /// Health check for fallback service
    pub async fn health_check(&self) -> Result<()> {
        // Test mock embedding generation
        if self.config.enable_mock_embeddings {
            let _ = self.generate_mock_embedding("health check test").await?;
        }

        // Test keyword search if we have indexed data
        if self.config.enable_keyword_search && !self.keyword_index.is_empty() {
            let _ = self.keyword_search("test", 1).await?;
        }

        Ok(())
    }
}

/// Statistics for the fallback service
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FallbackStats {
    pub cached_embeddings: usize,
    pub indexed_documents: usize,
    pub indexed_keywords: usize,
    pub cache_hit_rate: f64,
    pub fallback_requests: u64,
}

/// Fallback strategy selector
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FallbackStrategy {
    /// Use mock embeddings for semantic-like search
    MockEmbeddings,
    /// Use keyword-based search
    KeywordSearch,
    /// Use cached results
    CachedResults,
    /// Combine multiple strategies
    Hybrid(Vec<FallbackStrategy>),
    /// No fallback - fail fast
    None,
}

impl Default for FallbackStrategy {
    fn default() -> Self {
        FallbackStrategy::Hybrid(vec![
            FallbackStrategy::CachedResults,
            FallbackStrategy::MockEmbeddings,
            FallbackStrategy::KeywordSearch,
        ])
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[tokio::test]
    async fn test_mock_embedding_generation() {
        let config = FallbackConfig::default();
        let service = FallbackEmbeddingService::new(config);
        
        let embedding1 = service.generate_mock_embedding("test text").await.unwrap();
        let embedding2 = service.generate_mock_embedding("test text").await.unwrap();
        let embedding3 = service.generate_mock_embedding("different text").await.unwrap();
        
        assert_eq!(embedding1.len(), 384);
        assert_eq!(embedding1, embedding2); // Same input should give same output
        assert_ne!(embedding1, embedding3); // Different input should give different output
        
        // Check normalization
        let norm: f32 = embedding1.iter().map(|x| x * x).sum::<f32>().sqrt();
        assert!((norm - 1.0).abs() < 0.001); // Should be normalized
    }

    #[tokio::test]
    async fn test_keyword_search() {
        let config = FallbackConfig::default();
        let mut service = FallbackEmbeddingService::new(config);
        
        let doc_id = Uuid::new_v4();
        let chunk = DocumentChunk {
            id: "chunk1".to_string(),
            document_id: doc_id,
            content: "Rust programming language is awesome".to_string(),
            chunk_index: 0,
            total_chunks: 1,
            start_char: 0,
            end_char: 37,
            metadata: HashMap::new(),
        };
        
        service.index_chunk_for_fallback(&chunk).await.unwrap();
        
        let results = service.keyword_search("Rust programming", 5).await.unwrap();
        assert_eq!(results.len(), 1);
        assert!(results[0].score > 0.0);
        assert_eq!(results[0].content, chunk.content);
    }

    #[tokio::test]
    async fn test_fuzzy_similarity() {
        let config = FallbackConfig::default();
        let service = FallbackEmbeddingService::new(config);
        
        assert_eq!(service.fuzzy_similarity("test", "test"), 1.0);
        assert!(service.fuzzy_similarity("test", "tests") > 0.7);
        assert!(service.fuzzy_similarity("test", "best") > 0.6);
        assert!(service.fuzzy_similarity("test", "xyz") < 0.3);
    }

    #[tokio::test]
    async fn test_levenshtein_distance() {
        let config = FallbackConfig::default();
        let service = FallbackEmbeddingService::new(config);
        
        assert_eq!(service.levenshtein_distance("test", "test"), 0);
        assert_eq!(service.levenshtein_distance("test", "tests"), 1);
        assert_eq!(service.levenshtein_distance("test", "best"), 1);
        assert_eq!(service.levenshtein_distance("test", "xyz"), 4);
    }

    #[tokio::test]
    async fn test_cache_functionality() {
        let config = FallbackConfig::default();
        let mut service = FallbackEmbeddingService::new(config);
        
        let embedding = vec![1.0, 2.0, 3.0];
        let text = "test text".to_string();
        
        // Should be None initially
        assert!(service.get_cached_embedding(&text).await.is_none());
        
        // Cache the embedding
        service.cache_embedding(text.clone(), embedding.clone()).await;
        
        // Should now return the cached embedding
        let cached = service.get_cached_embedding(&text).await;
        assert!(cached.is_some());
        assert_eq!(cached.unwrap(), embedding);
    }
}