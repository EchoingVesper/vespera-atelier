//! Ollama provider implementation
//!
//! Provides integration with Ollama for local LLM execution.
//! Ollama uses an OpenAI-compatible API, making integration straightforward.

use super::provider::LlmProvider;
use super::streaming::{ChatChunk, ResponseMetadata, StreamingResponse};
use super::types::{
    ChatMessage, ChatRequest, ChatResponse, FinishReason, ProviderCapabilities, UsageStats,
};
use anyhow::{Context, Result};
use async_trait::async_trait;
use futures::stream::{self, StreamExt};
use serde::{Deserialize, Serialize};
use tracing::{debug, info};

/// Ollama provider for local LLMs
pub struct OllamaProvider {
    model: String,
    endpoint: String,
    client: reqwest::Client,
}

/// Ollama chat request format
#[derive(Debug, Serialize)]
struct OllamaChatRequest {
    model: String,
    messages: Vec<OllamaMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    options: Option<OllamaOptions>,
    stream: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct OllamaMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct OllamaOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    num_predict: Option<i32>, // max_tokens equivalent
}

/// Ollama chat response format (non-streaming)
#[derive(Debug, Deserialize)]
struct OllamaChatResponse {
    message: OllamaMessage,
    done: bool,
    #[serde(default)]
    total_duration: u64,
    #[serde(default)]
    prompt_eval_count: u32,
    #[serde(default)]
    eval_count: u32,
}

/// Ollama streaming chunk format
#[derive(Debug, Deserialize)]
struct OllamaStreamChunk {
    message: OllamaMessage,
    done: bool,
    #[serde(default)]
    prompt_eval_count: u32,
    #[serde(default)]
    eval_count: u32,
}

impl OllamaProvider {
    /// Create a new Ollama provider
    pub fn new(model: String, endpoint: String) -> Self {
        Self {
            model,
            endpoint,
            client: reqwest::Client::new(),
        }
    }

    /// Convert our ChatMessage to Ollama format
    fn convert_messages(messages: &[ChatMessage]) -> Vec<OllamaMessage> {
        messages
            .iter()
            .map(|msg| OllamaMessage {
                role: format!("{:?}", msg.role).to_lowercase(),
                content: msg.content.clone(),
            })
            .collect()
    }

    /// Check if Ollama server is running
    pub async fn check_server(&self) -> Result<bool> {
        let url = format!("{}/api/tags", self.endpoint);
        let response = self.client.get(&url).send().await;

        match response {
            Ok(resp) => Ok(resp.status().is_success()),
            Err(_) => Ok(false),
        }
    }
}

#[async_trait]
impl LlmProvider for OllamaProvider {
    async fn send_message_streaming(&self, request: ChatRequest) -> Result<StreamingResponse> {
        info!("Sending streaming request to Ollama: {}", self.model);

        let url = format!("{}/api/chat", self.endpoint);

        let ollama_request = OllamaChatRequest {
            model: self.model.clone(),
            messages: Self::convert_messages(&request.messages),
            options: Some(OllamaOptions {
                temperature: request.temperature,
                num_predict: request.max_tokens.map(|t| t as i32),
            }),
            stream: true,
        };

        debug!("Ollama request: {:?}", ollama_request);

        let response = self
            .client
            .post(&url)
            .json(&ollama_request)
            .send()
            .await
            .context("Failed to send request to Ollama")?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!(
                "Ollama request failed with status {}: {}",
                status,
                error_text
            ));
        }

        let stream = response.bytes_stream();

        let mapped_stream = stream.map(|result| {
            result
                .context("Failed to read chunk from Ollama")
                .and_then(|bytes| {
                    let chunk: OllamaStreamChunk =
                        serde_json::from_slice(&bytes).context("Failed to parse Ollama chunk")?;

                    if chunk.done {
                        Ok(ChatChunk::finish(
                            FinishReason::Stop,
                            UsageStats {
                                prompt_tokens: chunk.prompt_eval_count,
                                completion_tokens: chunk.eval_count,
                                total_tokens: chunk.prompt_eval_count + chunk.eval_count,
                            },
                        ))
                    } else {
                        Ok(ChatChunk::text(chunk.message.content))
                    }
                })
        });

        Ok(StreamingResponse {
            stream: Box::pin(mapped_stream),
            metadata: ResponseMetadata {
                model: self.model.clone(),
                provider: "ollama".to_string(),
                request_id: None,
            },
        })
    }

    async fn send_message(&self, request: ChatRequest) -> Result<ChatResponse> {
        info!("Sending non-streaming request to Ollama: {}", self.model);

        let url = format!("{}/api/chat", self.endpoint);

        let ollama_request = OllamaChatRequest {
            model: self.model.clone(),
            messages: Self::convert_messages(&request.messages),
            options: Some(OllamaOptions {
                temperature: request.temperature,
                num_predict: request.max_tokens.map(|t| t as i32),
            }),
            stream: false,
        };

        debug!("Ollama request: {:?}", ollama_request);

        let response = self
            .client
            .post(&url)
            .json(&ollama_request)
            .send()
            .await
            .context("Failed to send request to Ollama")?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!(
                "Ollama request failed with status {}: {}",
                status,
                error_text
            ));
        }

        let ollama_response: OllamaChatResponse = response
            .json()
            .await
            .context("Failed to parse Ollama response")?;

        Ok(ChatResponse {
            content: ollama_response.message.content,
            finish_reason: FinishReason::Stop,
            tool_calls: Vec::new(), // Ollama doesn't support tool calls yet
            usage: UsageStats {
                prompt_tokens: ollama_response.prompt_eval_count,
                completion_tokens: ollama_response.eval_count,
                total_tokens: ollama_response.prompt_eval_count + ollama_response.eval_count,
            },
        })
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            supports_streaming: true,
            supports_tools: false, // Ollama doesn't support tool calling yet
            supports_system_prompt: true,
            max_tokens: 4096, // Default, varies by model
            max_context_length: 4096,
        }
    }

    async fn validate_config(&self) -> Result<()> {
        if !self.check_server().await? {
            return Err(anyhow::anyhow!(
                "Cannot connect to Ollama server at {}. Is Ollama running?",
                self.endpoint
            ));
        }

        info!("Ollama provider configuration validated");
        Ok(())
    }

    fn name(&self) -> &str {
        "ollama"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_ollama_connection() {
        let provider = OllamaProvider::new(
            "llama3:latest".to_string(),
            "http://localhost:11434".to_string(),
        );

        // Don't fail if Ollama isn't running
        let result = provider.check_server().await;
        if result.is_err() || result.unwrap() == false {
            println!("Ollama not running, skipping connection test");
        }
    }
}
