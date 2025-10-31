// Ollama Local Provider
//
// Communicates with local Ollama server via HTTP REST API.
//
// Endpoint: POST http://localhost:11434/api/generate
// Protocol: HTTP JSON
//
// Streaming response format: Newline-delimited JSON
// Each line: {"model":"...","response":"...", "done":false}
// Final line: {"done":true}

use super::{Provider, ProviderResponse, ProviderUsage, StreamChunk};
use anyhow::{anyhow, Context, Result};
use async_trait::async_trait;
use futures::{Stream, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::io::AsyncBufReadExt;
use tracing::{debug, error, info, warn};

/// Ollama provider configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaConfig {
    /// Ollama server base URL
    pub base_url: String,
    /// Model name (e.g., llama2, mistral, codellama)
    pub model: String,
    /// API endpoint to use (/api/generate or /api/chat)
    pub api_endpoint: String,
    /// Temperature (0.0-2.0)
    pub temperature: Option<f32>,
    /// Max tokens to generate
    pub max_tokens: Option<usize>,
    /// System prompt
    pub system_prompt: Option<String>,
    /// Context window size
    pub context_window: Option<usize>,
    /// Request timeout in seconds
    pub timeout: Option<u64>,
}

impl Default for OllamaConfig {
    fn default() -> Self {
        Self {
            base_url: "http://localhost:11434".to_string(),
            model: "llama2".to_string(),
            api_endpoint: "/api/generate".to_string(),
            temperature: Some(0.7),
            max_tokens: Some(2048),
            system_prompt: None,
            context_window: Some(4096),
            timeout: Some(120),
        }
    }
}

/// Ollama provider implementation
pub struct OllamaProvider {
    config: OllamaConfig,
    client: reqwest::Client,
}

impl OllamaProvider {
    /// Create a new Ollama provider with configuration
    pub fn new(config: OllamaConfig) -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(config.timeout.unwrap_or(120)))
            .build()
            .expect("Failed to build HTTP client");

        Self { config, client }
    }

    /// Build request payload for Ollama API
    fn build_request_payload(
        &self,
        message: &str,
        system_prompt: Option<&str>,
        stream: bool,
    ) -> OllamaRequest {
        let mut options = HashMap::new();

        if let Some(temp) = self.config.temperature {
            options.insert("temperature".to_string(), serde_json::json!(temp));
        }
        if let Some(max_tokens) = self.config.max_tokens {
            options.insert("num_predict".to_string(), serde_json::json!(max_tokens));
        }

        OllamaRequest {
            model: self.config.model.clone(),
            prompt: message.to_string(),
            system: system_prompt.or(self.config.system_prompt.as_deref()).map(|s| s.to_string()),
            stream,
            options: if options.is_empty() { None } else { Some(options) },
        }
    }

    /// Process non-streaming response from Ollama
    async fn process_response(&self, url: String, payload: OllamaRequest) -> Result<ProviderResponse> {
        let response = self
            .client
            .post(&url)
            .json(&payload)
            .send()
            .await
            .context("Failed to send request to Ollama")?;

        let ollama_response: OllamaResponse = response
            .json()
            .await
            .context("Failed to parse Ollama response")?;

        let mut metadata = HashMap::new();
        metadata.insert("model".to_string(), serde_json::json!(ollama_response.model));
        metadata.insert("done".to_string(), serde_json::json!(ollama_response.done));

        // Extract usage information
        let usage = ollama_response.eval_count.map(|output_tokens| {
            ProviderUsage {
                input_tokens: ollama_response.prompt_eval_count.unwrap_or(0),
                output_tokens,
                cost_usd: None, // Ollama is free/local
            }
        });

        Ok(ProviderResponse {
            text: ollama_response.response,
            session_id: None, // Ollama doesn't provide session IDs
            usage,
            metadata,
        })
    }

    /// Process streaming response from Ollama
    async fn process_stream_response(
        &self,
        url: String,
        payload: OllamaRequest,
    ) -> Result<Box<dyn Stream<Item = Result<StreamChunk>> + Unpin + Send>> {
        let response = self
            .client
            .post(&url)
            .json(&payload)
            .send()
            .await
            .context("Failed to send streaming request to Ollama")?;

        use futures::StreamExt as FuturesStreamExt;
        let stream = response.bytes_stream();
        let reader = tokio_util::io::StreamReader::new(stream.map(|result| {
            result.map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
        }));

        let mut lines = tokio::io::BufReader::new(reader).lines();

        let stream = async_stream::stream! {
            loop {
                match lines.next_line().await {
                    Ok(Some(line)) => {
                        match serde_json::from_str::<OllamaStreamChunk>(&line) {
                            Ok(chunk) => {
                                let response_text = chunk.response.clone();
                                let is_done = chunk.done;
                                yield Ok(StreamChunk {
                                    chunk_type: "ollama".to_string(),
                                    text: Some(response_text),
                                    is_final: is_done,
                                    metadata: Some(serde_json::to_value(chunk).unwrap_or_default()),
                                });
                            }
                            Err(e) => {
                                yield Err(anyhow!("Failed to parse stream chunk: {}", e));
                            }
                        }
                    }
                    Ok(None) => break,
                    Err(e) => {
                        yield Err(e.into());
                        break;
                    }
                }
            }
        }
        .boxed();

        Ok(Box::new(stream))
    }
}

#[async_trait]
impl Provider for OllamaProvider {
    async fn send_message(
        &self,
        message: &str,
        system_prompt: Option<&str>,
        stream: bool,
    ) -> Result<ProviderResponse> {
        info!("Sending message to Ollama (model: {})", self.config.model);

        let url = format!("{}{}", self.config.base_url, self.config.api_endpoint);
        let payload = self.build_request_payload(message, system_prompt, false);

        let response = if stream {
            // For streaming, we need to collect all chunks
            warn!("Streaming requested but send_message doesn't support it, use send_message_stream");
            self.process_response(url, payload).await?
        } else {
            self.process_response(url, payload).await?
        };

        info!("Received response from Ollama: {} characters", response.text.len());

        Ok(response)
    }

    async fn send_message_stream(
        &self,
        message: &str,
        system_prompt: Option<&str>,
    ) -> Result<Box<dyn Stream<Item = Result<StreamChunk>> + Unpin + Send>> {
        info!("Sending message to Ollama with streaming (model: {})", self.config.model);

        let url = format!("{}{}", self.config.base_url, self.config.api_endpoint);
        let payload = self.build_request_payload(message, system_prompt, true);

        self.process_stream_response(url, payload).await
    }

    async fn health_check(&self) -> Result<bool> {
        debug!("Performing health check on Ollama");

        // Check if Ollama server is running by hitting /api/tags endpoint
        let url = format!("{}/api/tags", self.config.base_url);

        match self.client.get(&url).send().await {
            Ok(response) => {
                if response.status().is_success() {
                    info!("Ollama health check passed");
                    Ok(true)
                } else {
                    warn!("Ollama health check failed: HTTP {}", response.status());
                    Ok(false)
                }
            }
            Err(e) => {
                warn!("Ollama health check failed: {}", e);
                Ok(false)
            }
        }
    }

    fn provider_type(&self) -> &str {
        "ollama"
    }

    fn display_name(&self) -> &str {
        "Ollama Local"
    }
}

// Ollama API request/response types

#[derive(Debug, Clone, Serialize)]
struct OllamaRequest {
    model: String,
    prompt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<String>,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    options: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Deserialize)]
struct OllamaResponse {
    model: String,
    response: String,
    done: bool,
    #[serde(default)]
    prompt_eval_count: Option<usize>,
    #[serde(default)]
    eval_count: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OllamaStreamChunk {
    response: String,
    done: bool,
    #[serde(flatten)]
    extra: HashMap<String, serde_json::Value>,
}
