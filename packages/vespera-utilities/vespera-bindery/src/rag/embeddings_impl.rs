//! # Real Embedding Model Implementations
//!
//! Provides actual embedding generation using local models and APIs

use anyhow::{Result, Context};
use std::path::Path;

#[cfg(feature = "embeddings-api")]
use serde::{Deserialize, Serialize};

/// Configuration for embedding providers
#[derive(Debug, Clone)]
pub struct EmbeddingConfig {
    pub provider: EmbeddingProvider,
    pub model_name: String,
    pub cache_dir: Option<String>,
    pub api_key: Option<String>,
    pub api_base_url: Option<String>,
    pub max_batch_size: usize,
}

#[derive(Debug, Clone)]
pub enum EmbeddingProvider {
    Local,      // Use local Candle model
    ONNX,       // Use ONNX Runtime
    OpenAI,     // Use OpenAI API
    Cohere,     // Use Cohere API
    HuggingFace, // Use HuggingFace Inference API
}

impl Default for EmbeddingConfig {
    fn default() -> Self {
        Self {
            provider: EmbeddingProvider::Local,
            model_name: "sentence-transformers/all-MiniLM-L6-v2".to_string(),
            cache_dir: None,
            api_key: None,
            api_base_url: None,
            max_batch_size: 32,
        }
    }
}

// ============================================================================
// Local Embeddings using Candle
// ============================================================================

#[cfg(feature = "embeddings-local")]
pub mod local {
    use super::*;
    use candle_core::{Device, Tensor, DType};
    use candle_nn::VarBuilder;
    use candle_transformers::models::bert::{BertModel, Config as BertConfig};
    use hf_hub::api::tokio::Api;
    use tokenizers::Tokenizer;
    use std::sync::Arc;
    use tokio::sync::RwLock;

    pub struct LocalEmbedder {
        model: Arc<RwLock<BertModel>>,
        tokenizer: Arc<Tokenizer>,
        device: Device,
        config: EmbeddingConfig,
    }

    impl LocalEmbedder {
        pub async fn new(config: EmbeddingConfig) -> Result<Self> {
            let device = Device::cuda_if_available(0).unwrap_or(Device::Cpu);

            // Download model from HuggingFace Hub
            let api = Api::new()?;
            let repo = api.model(config.model_name.clone());

            // Get model files
            let model_file = repo.get("model.safetensors").await?;
            let config_file = repo.get("config.json").await?;
            let tokenizer_file = repo.get("tokenizer.json").await?;

            // Load configuration
            let config_content = std::fs::read_to_string(&config_file)?;
            let bert_config: BertConfig = serde_json::from_str(&config_content)?;

            // Load model weights
            let vb = unsafe {
                VarBuilder::from_mmaped_safetensors(&[model_file], DType::F32, &device)?
            };
            let model = BertModel::load(vb, &bert_config)?;

            // Load tokenizer
            let tokenizer = Tokenizer::from_file(&tokenizer_file)
                .map_err(|e| anyhow::anyhow!("Failed to load tokenizer: {}", e))?;

            Ok(Self {
                model: Arc::new(RwLock::new(model)),
                tokenizer: Arc::new(tokenizer),
                device,
                config,
            })
        }

        pub async fn embed(&self, texts: &[String]) -> Result<Vec<Vec<f32>>> {
            let mut embeddings = Vec::new();

            for batch in texts.chunks(self.config.max_batch_size) {
                let batch_embeddings = self.embed_batch(batch).await?;
                embeddings.extend(batch_embeddings);
            }

            Ok(embeddings)
        }

        async fn embed_batch(&self, texts: &[String]) -> Result<Vec<Vec<f32>>> {
            // Tokenize texts
            let encodings = texts
                .iter()
                .map(|text| {
                    self.tokenizer.encode(text.as_str(), true)
                        .map_err(|e| anyhow::anyhow!("Tokenization failed: {}", e))
                })
                .collect::<Result<Vec<_>>>()?;

            // Prepare input tensors
            let max_len = encodings.iter().map(|e| e.len()).max().unwrap_or(0);

            let mut input_ids = Vec::new();
            let mut attention_mask = Vec::new();

            for encoding in &encodings {
                let mut ids = encoding.get_ids().to_vec();
                let mut mask = vec![1u32; ids.len()];

                // Pad to max length
                ids.resize(max_len, 0);
                mask.resize(max_len, 0);

                input_ids.extend(ids);
                attention_mask.extend(mask);
            }

            // Create tensors
            let input_ids = Tensor::from_vec(
                input_ids,
                &[texts.len(), max_len],
                &self.device
            )?;

            let attention_mask = Tensor::from_vec(
                attention_mask,
                &[texts.len(), max_len],
                &self.device
            )?;

            // Forward pass
            let model = self.model.read().await;
            let output = model.forward(&input_ids, &attention_mask)?;

            // Mean pooling
            let embeddings = self.mean_pooling(&output, &attention_mask)?;

            // Convert to Vec<Vec<f32>>
            let embeddings_vec = embeddings.to_vec2::<f32>()?;

            Ok(embeddings_vec)
        }

        fn mean_pooling(&self, output: &Tensor, attention_mask: &Tensor) -> Result<Tensor> {
            // Expand attention mask for all hidden dimensions
            let mask_expanded = attention_mask
                .unsqueeze(2)?
                .broadcast_as(output.shape())?;

            // Apply mask and sum
            let sum_embeddings = (output * &mask_expanded)?.sum(1)?;

            // Count non-masked tokens
            let sum_mask = mask_expanded.sum(1)?.clamp(1e-9, f64::INFINITY)?;

            // Compute mean
            let mean = sum_embeddings.broadcast_div(&sum_mask)?;

            Ok(mean)
        }
    }
}

// ============================================================================
// ONNX Runtime Embeddings
// ============================================================================

#[cfg(feature = "embeddings-onnx")]
pub mod onnx {
    use super::*;
    use ort::{Session, SessionBuilder, Value, CUDAExecutionProvider};
    use tokenizers::Tokenizer;
    use std::sync::Arc;
    use hf_hub::api::tokio::Api;

    pub struct ONNXEmbedder {
        session: Arc<Session>,
        tokenizer: Arc<Tokenizer>,
        config: EmbeddingConfig,
    }

    impl ONNXEmbedder {
        pub async fn new(config: EmbeddingConfig) -> Result<Self> {
            // Download model from HuggingFace Hub
            let api = Api::new()?;
            let repo = api.model(config.model_name.clone());

            // Get ONNX model and tokenizer
            let model_file = repo.get("model.onnx").await?;
            let tokenizer_file = repo.get("tokenizer.json").await?;

            // Create ONNX session
            let session = SessionBuilder::new()?
                .with_execution_providers([CUDAExecutionProvider::default().into()])?
                .with_model_from_file(&model_file)?;

            // Load tokenizer
            let tokenizer = Tokenizer::from_file(&tokenizer_file)
                .map_err(|e| anyhow::anyhow!("Failed to load tokenizer: {}", e))?;

            Ok(Self {
                session: Arc::new(session),
                tokenizer: Arc::new(tokenizer),
                config,
            })
        }

        pub async fn embed(&self, texts: &[String]) -> Result<Vec<Vec<f32>>> {
            let mut embeddings = Vec::new();

            for batch in texts.chunks(self.config.max_batch_size) {
                let batch_embeddings = self.embed_batch(batch).await?;
                embeddings.extend(batch_embeddings);
            }

            Ok(embeddings)
        }

        async fn embed_batch(&self, texts: &[String]) -> Result<Vec<Vec<f32>>> {
            // Tokenize texts
            let encodings = texts
                .iter()
                .map(|text| {
                    self.tokenizer.encode(text.as_str(), true)
                        .map_err(|e| anyhow::anyhow!("Tokenization failed: {}", e))
                })
                .collect::<Result<Vec<_>>>()?;

            // Prepare inputs
            let max_len = encodings.iter().map(|e| e.len()).max().unwrap_or(0);
            let batch_size = texts.len();

            let mut input_ids = vec![0i64; batch_size * max_len];
            let mut attention_mask = vec![0i64; batch_size * max_len];

            for (i, encoding) in encodings.iter().enumerate() {
                let ids = encoding.get_ids();
                for (j, &id) in ids.iter().enumerate() {
                    input_ids[i * max_len + j] = id as i64;
                    attention_mask[i * max_len + j] = 1;
                }
            }

            // Create ONNX tensors
            let input_ids_array = ndarray::Array::from_shape_vec(
                (batch_size, max_len),
                input_ids
            )?;

            let attention_mask_array = ndarray::Array::from_shape_vec(
                (batch_size, max_len),
                attention_mask
            )?;

            // Run inference
            let outputs = self.session.run(vec![
                Value::from_array(input_ids_array)?,
                Value::from_array(attention_mask_array)?,
            ])?;

            // Extract embeddings
            let embeddings = outputs[0]
                .try_extract::<f32>()?
                .view()
                .to_owned()
                .into_shape((batch_size, outputs[0].shape()[1]))?;

            // Convert to Vec<Vec<f32>>
            Ok(embeddings
                .outer_iter()
                .map(|row| row.to_vec())
                .collect())
        }
    }
}

// ============================================================================
// API-based Embeddings (OpenAI, Cohere, etc.)
// ============================================================================

#[cfg(feature = "embeddings-api")]
pub mod api {
    use super::*;
    use reqwest::Client;
    use std::env;

    #[derive(Serialize)]
    struct OpenAIRequest {
        input: Vec<String>,
        model: String,
    }

    #[derive(Deserialize)]
    struct OpenAIResponse {
        data: Vec<OpenAIEmbedding>,
    }

    #[derive(Deserialize)]
    struct OpenAIEmbedding {
        embedding: Vec<f32>,
    }

    #[derive(Serialize)]
    struct CohereRequest {
        texts: Vec<String>,
        model: String,
        input_type: String,
    }

    #[derive(Deserialize)]
    struct CohereResponse {
        embeddings: Vec<Vec<f32>>,
    }

    pub struct APIEmbedder {
        client: Client,
        config: EmbeddingConfig,
        api_key: String,
    }

    impl APIEmbedder {
        pub async fn new(config: EmbeddingConfig) -> Result<Self> {
            // Load API key from config or environment
            let api_key = config.api_key.clone()
                .or_else(|| match config.provider {
                    EmbeddingProvider::OpenAI => env::var("OPENAI_API_KEY").ok(),
                    EmbeddingProvider::Cohere => env::var("COHERE_API_KEY").ok(),
                    EmbeddingProvider::HuggingFace => env::var("HF_API_KEY").ok(),
                    _ => None,
                })
                .ok_or_else(|| anyhow::anyhow!("API key not found"))?;

            Ok(Self {
                client: Client::new(),
                config,
                api_key,
            })
        }

        pub async fn embed(&self, texts: &[String]) -> Result<Vec<Vec<f32>>> {
            match self.config.provider {
                EmbeddingProvider::OpenAI => self.embed_openai(texts).await,
                EmbeddingProvider::Cohere => self.embed_cohere(texts).await,
                _ => Err(anyhow::anyhow!("Unsupported API provider")),
            }
        }

        async fn embed_openai(&self, texts: &[String]) -> Result<Vec<Vec<f32>>> {
            let url = self.config.api_base_url.as_ref()
                .map(|s| s.as_str())
                .unwrap_or("https://api.openai.com/v1/embeddings");

            let mut all_embeddings = Vec::new();

            // Process in batches
            for batch in texts.chunks(self.config.max_batch_size) {
                let request = OpenAIRequest {
                    input: batch.to_vec(),
                    model: self.config.model_name.clone(),
                };

                let response = self.client
                    .post(url)
                    .header("Authorization", format!("Bearer {}", self.api_key))
                    .json(&request)
                    .send()
                    .await?
                    .json::<OpenAIResponse>()
                    .await?;

                for embedding in response.data {
                    all_embeddings.push(embedding.embedding);
                }
            }

            Ok(all_embeddings)
        }

        async fn embed_cohere(&self, texts: &[String]) -> Result<Vec<Vec<f32>>> {
            let url = self.config.api_base_url.as_ref()
                .map(|s| s.as_str())
                .unwrap_or("https://api.cohere.ai/v1/embed");

            let mut all_embeddings = Vec::new();

            // Process in batches
            for batch in texts.chunks(self.config.max_batch_size) {
                let request = CohereRequest {
                    texts: batch.to_vec(),
                    model: self.config.model_name.clone(),
                    input_type: "search_document".to_string(),
                };

                let response = self.client
                    .post(url)
                    .header("Authorization", format!("Bearer {}", self.api_key))
                    .json(&request)
                    .send()
                    .await?
                    .json::<CohereResponse>()
                    .await?;

                all_embeddings.extend(response.embeddings);
            }

            Ok(all_embeddings)
        }
    }
}

// ============================================================================
// Unified Embedder Interface
// ============================================================================

pub struct UnifiedEmbedder {
    #[cfg(feature = "embeddings-local")]
    local_embedder: Option<local::LocalEmbedder>,

    #[cfg(feature = "embeddings-onnx")]
    onnx_embedder: Option<onnx::ONNXEmbedder>,

    #[cfg(feature = "embeddings-api")]
    api_embedder: Option<api::APIEmbedder>,

    config: EmbeddingConfig,
}

impl UnifiedEmbedder {
    pub async fn new(config: EmbeddingConfig) -> Result<Self> {
        let mut embedder = Self {
            #[cfg(feature = "embeddings-local")]
            local_embedder: None,
            #[cfg(feature = "embeddings-onnx")]
            onnx_embedder: None,
            #[cfg(feature = "embeddings-api")]
            api_embedder: None,
            config: config.clone(),
        };

        match config.provider {
            #[cfg(feature = "embeddings-local")]
            EmbeddingProvider::Local => {
                embedder.local_embedder = Some(local::LocalEmbedder::new(config).await?);
            }

            #[cfg(feature = "embeddings-onnx")]
            EmbeddingProvider::ONNX => {
                embedder.onnx_embedder = Some(onnx::ONNXEmbedder::new(config).await?);
            }

            #[cfg(feature = "embeddings-api")]
            EmbeddingProvider::OpenAI | EmbeddingProvider::Cohere | EmbeddingProvider::HuggingFace => {
                embedder.api_embedder = Some(api::APIEmbedder::new(config).await?);
            }

            #[allow(unreachable_patterns)]
            _ => return Err(anyhow::anyhow!("Embedding provider not supported or not compiled in")),
        }

        Ok(embedder)
    }

    pub async fn embed(&self, texts: &[String]) -> Result<Vec<Vec<f32>>> {
        match self.config.provider {
            #[cfg(feature = "embeddings-local")]
            EmbeddingProvider::Local => {
                self.local_embedder.as_ref()
                    .ok_or_else(|| anyhow::anyhow!("Local embedder not initialized"))?
                    .embed(texts)
                    .await
            }

            #[cfg(feature = "embeddings-onnx")]
            EmbeddingProvider::ONNX => {
                self.onnx_embedder.as_ref()
                    .ok_or_else(|| anyhow::anyhow!("ONNX embedder not initialized"))?
                    .embed(texts)
                    .await
            }

            #[cfg(feature = "embeddings-api")]
            EmbeddingProvider::OpenAI | EmbeddingProvider::Cohere | EmbeddingProvider::HuggingFace => {
                self.api_embedder.as_ref()
                    .ok_or_else(|| anyhow::anyhow!("API embedder not initialized"))?
                    .embed(texts)
                    .await
            }

            #[allow(unreachable_patterns)]
            _ => Err(anyhow::anyhow!("Embedding provider not supported")),
        }
    }

    pub async fn embed_single(&self, text: &str) -> Result<Vec<f32>> {
        let embeddings = self.embed(&[text.to_string()]).await?;
        embeddings.into_iter().next()
            .ok_or_else(|| anyhow::anyhow!("No embedding generated"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[cfg(feature = "embeddings-api")]
    async fn test_openai_embeddings() {
        dotenvy::dotenv().ok();

        if env::var("OPENAI_API_KEY").is_err() {
            println!("Skipping OpenAI test - no API key");
            return;
        }

        let config = EmbeddingConfig {
            provider: EmbeddingProvider::OpenAI,
            model_name: "text-embedding-3-small".to_string(),
            ..Default::default()
        };

        let embedder = UnifiedEmbedder::new(config).await.unwrap();
        let embeddings = embedder.embed(&[
            "Hello world".to_string(),
            "Rust programming language".to_string(),
        ]).await.unwrap();

        assert_eq!(embeddings.len(), 2);
        assert!(!embeddings[0].is_empty());
    }

    #[tokio::test]
    #[cfg(feature = "embeddings-local")]
    async fn test_local_embeddings() {
        let config = EmbeddingConfig {
            provider: EmbeddingProvider::Local,
            model_name: "sentence-transformers/all-MiniLM-L6-v2".to_string(),
            ..Default::default()
        };

        // This test requires model download, so we'll skip in CI
        if std::env::var("CI").is_ok() {
            println!("Skipping local embedding test in CI");
            return;
        }

        let embedder = UnifiedEmbedder::new(config).await.unwrap();
        let embeddings = embedder.embed(&[
            "Hello world".to_string(),
            "Rust programming language".to_string(),
        ]).await.unwrap();

        assert_eq!(embeddings.len(), 2);
        assert!(!embeddings[0].is_empty());
    }
}