//! Adapter to bridge PR #85 LlmProvider → Phase 17 Provider
//!
//! This adapter wraps a PR #85 LlmProvider and implements the Phase 17 Provider trait,
//! allowing PR #85 providers to be used within the Phase 17 provider system without
//! breaking existing Phase 17 functionality.

use super::types::{chat_response_to_phase17, phase17_to_chat_request};
use crate::llm::provider::LlmProvider;
use crate::providers::{Provider, ProviderResponse, StreamChunk};
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use futures::Stream;
use futures::StreamExt;
use std::sync::Arc;

/// Adapter that wraps a PR #85 LlmProvider and implements Phase 17 Provider trait
pub struct LlmProviderAdapter {
    /// The underlying PR #85 LlmProvider
    inner: Arc<dyn LlmProvider>,
    /// Provider type identifier
    provider_type: String,
    /// Display name for the provider
    display_name: String,
}

impl LlmProviderAdapter {
    /// Create a new adapter wrapping a PR #85 LlmProvider
    pub fn new(
        provider: Arc<dyn LlmProvider>,
        provider_type: String,
        display_name: String,
    ) -> Self {
        Self {
            inner: provider,
            provider_type,
            display_name,
        }
    }
}

#[async_trait]
impl Provider for LlmProviderAdapter {
    async fn send_message(
        &self,
        message: &str,
        model: Option<&str>,
        session_id: Option<&str>,
        system_prompt: Option<&str>,
        stream: bool,
    ) -> Result<ProviderResponse> {
        // Note: model parameter is ignored here - PR #85 providers use configured model
        // TODO: Add model override support in future iteration
        let _ = model;

        if stream {
            // For streaming requests, we need to collect the stream
            // This is a compatibility shim - Phase 17 expects full response even with stream=true
            // TODO: Revisit this in Task 4 when integrating streaming properly
            return Err(anyhow!(
                "Streaming via send_message not yet supported in adapter. Use send_message_stream instead."
            ));
        }

        // Convert Phase 17 parameters to PR #85 ChatRequest
        let request = phase17_to_chat_request(message, system_prompt, None, None);

        // Send to PR #85 provider
        let response = self.inner.send_message(request).await?;

        // Convert back to Phase 17 ProviderResponse
        Ok(chat_response_to_phase17(
            response,
            session_id.map(|s| s.to_string()),
        ))
    }

    async fn send_message_stream(
        &self,
        message: &str,
        model: Option<&str>,
        session_id: Option<&str>,
        system_prompt: Option<&str>,
    ) -> Result<Box<dyn Stream<Item = Result<StreamChunk>> + Unpin + Send>> {
        // Note: model parameter is ignored here - PR #85 providers use configured model
        // TODO: Add model override support in future iteration
        let _ = model;

        // Convert Phase 17 parameters to PR #85 ChatRequest
        let request = phase17_to_chat_request(message, system_prompt, None, None);

        // Get streaming response from PR #85 provider
        let streaming_response = self.inner.send_message_streaming(request).await?;

        // Extract the stream from StreamingResponse and convert ChatChunk to StreamChunk
        let stream = streaming_response.stream.map(|result| {
            result.map(|chat_chunk| {
                // Convert ChatChunk to StreamChunk
                let is_final = chat_chunk.is_final();

                // Build metadata
                let mut metadata_map = serde_json::Map::new();
                if let Some(finish_reason) = &chat_chunk.finish_reason {
                    metadata_map.insert(
                        "finish_reason".to_string(),
                        serde_json::to_value(finish_reason).unwrap_or(serde_json::Value::Null),
                    );
                }
                if !chat_chunk.tool_calls.is_empty() {
                    metadata_map.insert(
                        "tool_calls".to_string(),
                        serde_json::to_value(&chat_chunk.tool_calls).unwrap_or(serde_json::Value::Null),
                    );
                }
                if let Some(usage) = &chat_chunk.usage {
                    metadata_map.insert(
                        "usage".to_string(),
                        serde_json::to_value(usage).unwrap_or(serde_json::Value::Null),
                    );
                }

                StreamChunk {
                    chunk_type: "assistant".to_string(),
                    text: Some(chat_chunk.delta),
                    is_final,
                    metadata: if metadata_map.is_empty() {
                        None
                    } else {
                        Some(serde_json::Value::Object(metadata_map))
                    },
                }
            })
        });

        Ok(Box::new(stream))
    }

    async fn health_check(&self) -> Result<bool> {
        // Use PR #85's validate_config as a health check proxy
        match self.inner.validate_config().await {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    fn provider_type(&self) -> &str {
        &self.provider_type
    }

    fn display_name(&self) -> &str {
        &self.display_name
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::llm::provider::LlmProvider;
    use crate::llm::streaming::{ChatChunk, ResponseMetadata, StreamingResponse};
    use crate::llm::types::{ChatRequest, ChatResponse, FinishReason, ProviderCapabilities, UsageStats};
    use futures::stream;

    // Mock PR #85 LlmProvider for testing
    struct MockLlmProvider {
        response_text: String,
    }

    #[async_trait]
    impl LlmProvider for MockLlmProvider {
        async fn send_message_streaming(&self, _request: ChatRequest) -> Result<StreamingResponse> {
            // Create a mock streaming response with proper StreamingResponse structure
            let chunks = vec![
                Ok(ChatChunk {
                    delta: self.response_text.clone(),
                    finish_reason: Some(FinishReason::Stop),
                    tool_calls: Vec::new(),
                    usage: Some(UsageStats {
                        prompt_tokens: 10,
                        completion_tokens: 5,
                        total_tokens: 15,
                    }),
                }),
            ];

            Ok(StreamingResponse {
                stream: Box::pin(stream::iter(chunks)),
                metadata: ResponseMetadata {
                    model: "mock-model".to_string(),
                    provider: "mock-provider".to_string(),
                    request_id: None,
                },
            })
        }

        async fn send_message(&self, _request: ChatRequest) -> Result<ChatResponse> {
            Ok(ChatResponse {
                content: self.response_text.clone(),
                finish_reason: FinishReason::Stop,
                tool_calls: Vec::new(),
                usage: UsageStats {
                    prompt_tokens: 10,
                    completion_tokens: 5,
                    total_tokens: 15,
                },
            })
        }

        fn capabilities(&self) -> ProviderCapabilities {
            ProviderCapabilities {
                supports_streaming: true,
                supports_tools: false,
                supports_system_prompt: true,
                max_tokens: 4096,
                max_context_length: 100000,
            }
        }

        async fn validate_config(&self) -> Result<()> {
            Ok(())
        }

        fn name(&self) -> &str {
            "mock-provider"
        }
    }

    #[tokio::test]
    async fn test_adapter_send_message() {
        let mock_provider = Arc::new(MockLlmProvider {
            response_text: "Hello from mock!".to_string(),
        });

        let adapter = LlmProviderAdapter::new(
            mock_provider,
            "mock".to_string(),
            "Mock Provider".to_string(),
        );

        let response = adapter
            .send_message("Hello", None, Some("session-123"), None, false)
            .await
            .expect("send_message should succeed");

        assert_eq!(response.text, "Hello from mock!");
        assert_eq!(response.session_id, Some("session-123".to_string()));
        assert!(response.usage.is_some());
    }

    #[tokio::test]
    async fn test_adapter_health_check() {
        let mock_provider = Arc::new(MockLlmProvider {
            response_text: "test".to_string(),
        });

        let adapter = LlmProviderAdapter::new(
            mock_provider,
            "mock".to_string(),
            "Mock Provider".to_string(),
        );

        let healthy = adapter.health_check().await.expect("health_check should succeed");
        assert!(healthy);
    }

    #[tokio::test]
    async fn test_adapter_provider_type() {
        let mock_provider = Arc::new(MockLlmProvider {
            response_text: "test".to_string(),
        });

        let adapter = LlmProviderAdapter::new(
            mock_provider,
            "claude-code".to_string(),
            "Claude Code".to_string(),
        );

        assert_eq!(adapter.provider_type(), "claude-code");
        assert_eq!(adapter.display_name(), "Claude Code");
    }
}
