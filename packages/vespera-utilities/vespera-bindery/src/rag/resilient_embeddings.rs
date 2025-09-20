//! # Resilient Embeddings Service
//!
//! Provides a high-level embedding service with circuit breaker protection,
//! retry logic, fallback mechanisms, and health monitoring.

use std::sync::Arc;
use anyhow::{Result, Context};
use tracing::{info, warn, error, debug};

use super::{
    circuit_breaker::{CircuitBreaker, CircuitBreakerConfig, CircuitBreakerRegistry},
    fallback_service::{FallbackEmbeddingService, FallbackConfig, FallbackStrategy},
    embeddings_impl::{UnifiedEmbedder, EmbeddingConfig, EmbeddingProvider},
    EmbeddingModel,
};

/// Resilient embedding service that combines circuit breakers, retries, and fallbacks
pub struct ResilientEmbeddingService {
    primary_embedder: Option<UnifiedEmbedder>,
    fallback_service: FallbackEmbeddingService,
    circuit_breaker_registry: Arc<CircuitBreakerRegistry>,
    embedding_config: EmbeddingConfig,
    fallback_config: FallbackConfig,
    fallback_strategy: FallbackStrategy,
}

impl ResilientEmbeddingService {
    /// Create a new resilient embedding service
    pub async fn new(
        embedding_model: EmbeddingModel,
        circuit_breaker_config: CircuitBreakerConfig,
        fallback_config: FallbackConfig,
        fallback_strategy: FallbackStrategy,
    ) -> Result<Self> {
        info!("Initializing resilient embedding service with model: {:?}", embedding_model);
        
        // Create circuit breaker registry
        let circuit_breaker_registry = Arc::new(CircuitBreakerRegistry::new(circuit_breaker_config));
        
        // Create fallback service
        let fallback_service = FallbackEmbeddingService::new(fallback_config.clone());
        
        // Create embedding config based on model
        let embedding_config = match &embedding_model {
            EmbeddingModel::LocalModel(model_name) => EmbeddingConfig {
                provider: EmbeddingProvider::Local,
                model_name: model_name.clone(),
                ..Default::default()
            },
            EmbeddingModel::OpenAI(model_name) => EmbeddingConfig {
                provider: EmbeddingProvider::OpenAI,
                model_name: model_name.clone(),
                ..Default::default()
            },
            EmbeddingModel::Cohere(model_name) => EmbeddingConfig {
                provider: EmbeddingProvider::Cohere,
                model_name: model_name.clone(),
                ..Default::default()
            },
            EmbeddingModel::Mock => {
                // For mock, we don't need a real embedder
                return Ok(Self {
                    primary_embedder: None,
                    fallback_service,
                    circuit_breaker_registry,
                    embedding_config: EmbeddingConfig::default(),
                    fallback_config,
                    fallback_strategy,
                });
            }
        };
        
        // Try to create primary embedder
        let primary_embedder = match UnifiedEmbedder::new(embedding_config.clone()).await {
            Ok(embedder) => {
                info!("Primary embedder initialized successfully");
                Some(embedder)
            }
            Err(e) => {
                warn!("Failed to initialize primary embedder: {}. Will rely on fallbacks.", e);
                None
            }
        };
        
        Ok(Self {
            primary_embedder,
            fallback_service,
            circuit_breaker_registry,
            embedding_config,
            fallback_config,
            fallback_strategy,
        })
    }
    
    /// Generate embeddings with circuit breaker protection and fallbacks
    pub async fn embed(&self, texts: &[String]) -> Result<Vec<Vec<f32>>> {
        debug!("Generating embeddings for {} texts", texts.len());
        
        // Try primary embedder first if available
        if let Some(ref embedder) = self.primary_embedder {
            match self.embed_with_circuit_breaker(embedder, texts).await {
                Ok(embeddings) => {
                    debug!("Primary embedder succeeded");
                    return Ok(embeddings);
                }
                Err(e) => {
                    warn!("Primary embedder failed: {}. Attempting fallback.", e);
                }
            }
        }
        
        // Fallback to configured strategy
        self.embed_with_fallback(texts).await
    }
    
    /// Generate embedding for a single text
    pub async fn embed_single(&self, text: &str) -> Result<Vec<f32>> {
        let embeddings = self.embed(&[text.to_string()]).await?;
        embeddings.into_iter().next()
            .ok_or_else(|| anyhow::anyhow!("No embedding generated"))
    }
    
    /// Embed using primary embedder with circuit breaker protection
    async fn embed_with_circuit_breaker(
        &self,
        embedder: &UnifiedEmbedder,
        texts: &[String],
    ) -> Result<Vec<Vec<f32>>> {
        let service_name = format!("{:?}", self.embedding_config.provider);
        let circuit_breaker = self.circuit_breaker_registry
            .get_breaker(&service_name)
            .await
            .context("Failed to get circuit breaker")?;
        
        circuit_breaker.execute(|| {
            let embedder = embedder.clone();
            let texts = texts.to_vec();
            Box::pin(async move {
                embedder.embed(&texts).await
            })
        }).await
    }
    
    /// Embed using fallback strategies
    async fn embed_with_fallback(&self, texts: &[String]) -> Result<Vec<Vec<f32>>> {
        match &self.fallback_strategy {
            FallbackStrategy::MockEmbeddings => {
                debug!("Using mock embeddings fallback");
                let mut embeddings = Vec::new();
                for text in texts {
                    let embedding = self.fallback_service.generate_mock_embedding(text).await?;
                    embeddings.push(embedding);
                }
                Ok(embeddings)
            }
            FallbackStrategy::CachedResults => {
                debug!("Using cached results fallback");
                let mut embeddings = Vec::new();
                for text in texts {
                    if let Some(cached) = self.fallback_service.get_cached_embedding(text).await {
                        embeddings.push(cached);
                    } else {
                        // If no cache, fall back to mock
                        let embedding = self.fallback_service.generate_mock_embedding(text).await?;
                        embeddings.push(embedding);
                    }
                }
                Ok(embeddings)
            }
            FallbackStrategy::KeywordSearch => {
                // Keyword search doesn't generate embeddings, use mock instead
                debug!("Keyword search fallback requested, using mock embeddings");
                let mut embeddings = Vec::new();
                for text in texts {
                    let embedding = self.fallback_service.generate_mock_embedding(text).await?;
                    embeddings.push(embedding);
                }
                Ok(embeddings)
            }
            FallbackStrategy::Hybrid(strategies) => {
                debug!("Using hybrid fallback strategy");
                for strategy in strategies {
                    match strategy {
                        FallbackStrategy::CachedResults => {
                            let mut all_cached = true;
                            let mut embeddings = Vec::new();
                            
                            for text in texts {
                                if let Some(cached) = self.fallback_service.get_cached_embedding(text).await {
                                    embeddings.push(cached);
                                } else {
                                    all_cached = false;
                                    break;
                                }
                            }
                            
                            if all_cached {
                                return Ok(embeddings);
                            }
                        }
                        FallbackStrategy::MockEmbeddings => {
                            let mut embeddings = Vec::new();
                            for text in texts {
                                let embedding = self.fallback_service.generate_mock_embedding(text).await?;
                                embeddings.push(embedding);
                            }
                            return Ok(embeddings);
                        }
                        _ => continue,
                    }
                }
                
                // If all hybrid strategies failed, use mock as final fallback
                warn!("All hybrid strategies failed, using mock embeddings");
                let mut embeddings = Vec::new();
                for text in texts {
                    let embedding = self.fallback_service.generate_mock_embedding(text).await?;
                    embeddings.push(embedding);
                }
                Ok(embeddings)
            }
            FallbackStrategy::None => {
                error!("No fallback strategy configured and primary embedder failed");
                Err(anyhow::anyhow!("No fallback strategy available"))
            }
        }
    }
    
    /// Get health status for all components
    pub async fn health_check(&self) -> Result<ResilientHealthStatus> {
        let mut status = ResilientHealthStatus {
            overall_healthy: true,
            primary_embedder_healthy: false,
            fallback_healthy: false,
            circuit_breakers: Vec::new(),
            last_check: chrono::Utc::now(),
        };
        
        // Check primary embedder
        if let Some(ref embedder) = self.primary_embedder {
            match embedder.embed_single("health check").await {
                Ok(_) => {
                    status.primary_embedder_healthy = true;
                    info!("Primary embedder health check passed");
                }
                Err(e) => {
                    warn!("Primary embedder health check failed: {}", e);
                    status.overall_healthy = false;
                }
            }
        }
        
        // Check fallback service
        match self.fallback_service.health_check().await {
            Ok(_) => {
                status.fallback_healthy = true;
                info!("Fallback service health check passed");
            }
            Err(e) => {
                warn!("Fallback service health check failed: {}", e);
                // Don't mark overall as unhealthy if fallback fails, as we might have primary
            }
        }
        
        // Get circuit breaker health
        if let Ok(cb_health) = self.circuit_breaker_registry.get_health_status().await {
            status.circuit_breakers = cb_health;
            
            // Mark unhealthy if any circuit breaker is unhealthy
            if status.circuit_breakers.iter().any(|cb| !cb.is_healthy) {
                status.overall_healthy = false;
            }
        }
        
        // Overall health requires at least one working embedding method
        if !status.primary_embedder_healthy && !status.fallback_healthy {
            status.overall_healthy = false;
        }
        
        Ok(status)
    }
    
    /// Get comprehensive metrics
    pub async fn get_metrics(&self) -> Result<ResilientMetrics> {
        let circuit_breaker_metrics = self.circuit_breaker_registry
            .get_all_metrics()
            .await
            .unwrap_or_default();
        
        let fallback_stats = self.fallback_service.get_stats().await;
        
        Ok(ResilientMetrics {
            has_primary_embedder: self.primary_embedder.is_some(),
            embedding_model: format!("{:?}", self.embedding_config.provider),
            circuit_breaker_metrics,
            fallback_stats,
            fallback_strategy: format!("{:?}", self.fallback_strategy),
        })
    }
    
    /// Reset all circuit breakers
    pub async fn reset_circuit_breakers(&self) -> Result<()> {
        self.circuit_breaker_registry.reset_all().await
    }
    
    /// Get circuit breaker registry for advanced operations
    pub fn get_circuit_breaker_registry(&self) -> Arc<CircuitBreakerRegistry> {
        Arc::clone(&self.circuit_breaker_registry)
    }
    
    /// Update fallback strategy at runtime
    pub fn update_fallback_strategy(&mut self, strategy: FallbackStrategy) {
        info!("Updating fallback strategy to: {:?}", strategy);
        self.fallback_strategy = strategy;
    }
}

/// Health status for the resilient embedding service
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ResilientHealthStatus {
    pub overall_healthy: bool,
    pub primary_embedder_healthy: bool,
    pub fallback_healthy: bool,
    pub circuit_breakers: Vec<super::circuit_breaker::CircuitBreakerHealth>,
    pub last_check: chrono::DateTime<chrono::Utc>,
}

/// Comprehensive metrics for the resilient embedding service
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ResilientMetrics {
    pub has_primary_embedder: bool,
    pub embedding_model: String,
    pub circuit_breaker_metrics: std::collections::HashMap<String, super::circuit_breaker::CircuitBreakerMetrics>,
    pub fallback_stats: super::fallback_service::FallbackStats,
    pub fallback_strategy: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;
    
    #[tokio::test]
    async fn test_resilient_service_with_mock() {
        let circuit_breaker_config = CircuitBreakerConfig {
            failure_threshold: 3,
            recovery_timeout: Duration::from_millis(100),
            request_timeout: Duration::from_millis(1000),
            max_retries: 2,
            initial_backoff: Duration::from_millis(10),
            max_backoff: Duration::from_millis(1000),
            backoff_multiplier: 2.0,
            success_threshold: 2,
        };
        
        let fallback_config = FallbackConfig::default();
        let fallback_strategy = FallbackStrategy::MockEmbeddings;
        
        let service = ResilientEmbeddingService::new(
            EmbeddingModel::Mock,
            circuit_breaker_config,
            fallback_config,
            fallback_strategy,
        ).await.unwrap();
        
        // Test embedding generation
        let texts = vec!["test text 1".to_string(), "test text 2".to_string()];
        let embeddings = service.embed(&texts).await.unwrap();
        
        assert_eq!(embeddings.len(), 2);
        assert_eq!(embeddings[0].len(), 384);
        assert_eq!(embeddings[1].len(), 384);
        
        // Test single embedding
        let single_embedding = service.embed_single("single test").await.unwrap();
        assert_eq!(single_embedding.len(), 384);
    }
    
    #[tokio::test]
    async fn test_health_check() {
        let circuit_breaker_config = CircuitBreakerConfig::default();
        let fallback_config = FallbackConfig::default();
        let fallback_strategy = FallbackStrategy::MockEmbeddings;
        
        let service = ResilientEmbeddingService::new(
            EmbeddingModel::Mock,
            circuit_breaker_config,
            fallback_config,
            fallback_strategy,
        ).await.unwrap();
        
        let health = service.health_check().await.unwrap();
        assert!(health.fallback_healthy);
        // For mock model, we don't have a primary embedder
    }
    
    #[tokio::test]
    async fn test_metrics() {
        let circuit_breaker_config = CircuitBreakerConfig::default();
        let fallback_config = FallbackConfig::default();
        let fallback_strategy = FallbackStrategy::MockEmbeddings;
        
        let service = ResilientEmbeddingService::new(
            EmbeddingModel::Mock,
            circuit_breaker_config,
            fallback_config,
            fallback_strategy,
        ).await.unwrap();
        
        let metrics = service.get_metrics().await.unwrap();
        assert!(!metrics.has_primary_embedder); // Mock doesn't create primary embedder
        assert_eq!(metrics.embedding_model, "Local");
    }
}