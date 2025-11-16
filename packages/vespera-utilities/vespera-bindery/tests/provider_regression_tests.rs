//! Phase 17 Provider System Regression Tests
//!
//! Ensures that the Phase 17 provider system (AI Assistant functionality) continues
//! to work correctly after the adapter layer integration (Phase 17.5 Task 2).
//!
//! Test Coverage:
//! 1. Provider trait interface (send_message, send_message_stream, health_check)
//! 2. Provider initialization and configuration
//! 3. Mock provider implementation (validates trait contract)
//! 4. Error handling and fallback behavior
//!
//! These tests focus on the Phase 17 Provider API surface, not the PR #85 LlmProvider.

use vespera_bindery::providers::{Provider, ProviderResponse, ProviderUsage, StreamChunk};
use async_trait::async_trait;
use anyhow::{anyhow, Result};
use futures::{Stream, stream};
use std::collections::HashMap;

/// Mock provider for testing the Provider trait contract
struct MockPhase17Provider {
    provider_type: String,
    display_name: String,
    response_text: String,
    should_fail_health: bool,
}

impl MockPhase17Provider {
    fn new(response_text: String) -> Self {
        Self {
            provider_type: "mock-phase17".to_string(),
            display_name: "Mock Phase 17 Provider".to_string(),
            response_text,
            should_fail_health: false,
        }
    }

    fn with_health_failure(mut self) -> Self {
        self.should_fail_health = true;
        self
    }
}

#[async_trait]
impl Provider for MockPhase17Provider {
    async fn send_message(
        &self,
        message: &str,
        model: Option<&str>,
        session_id: Option<&str>,
        system_prompt: Option<&str>,
        stream: bool,
    ) -> Result<ProviderResponse> {
        if stream {
            return Err(anyhow!("Streaming not supported via send_message. Use send_message_stream."));
        }

        // Build response text that includes request parameters for verification
        let mut response_parts = vec![self.response_text.clone()];
        if let Some(m) = model {
            response_parts.push(format!("[model:{}]", m));
        }
        if let Some(sp) = system_prompt {
            response_parts.push(format!("[system:{}]", sp));
        }

        let full_response = response_parts.join(" ");

        let mut metadata = HashMap::new();
        metadata.insert("request_message".to_string(), serde_json::json!(message));

        Ok(ProviderResponse {
            text: full_response,
            session_id: session_id.map(|s| s.to_string()),
            usage: Some(ProviderUsage {
                input_tokens: 10,
                output_tokens: 5,
                cost_usd: Some(0.0001),
            }),
            metadata,
        })
    }

    async fn send_message_stream(
        &self,
        message: &str,
        model: Option<&str>,
        session_id: Option<&str>,
        system_prompt: Option<&str>,
    ) -> Result<Box<dyn Stream<Item = Result<StreamChunk>> + Unpin + Send>> {
        // Build response text
        let mut response_parts = vec![self.response_text.clone()];
        if let Some(m) = model {
            response_parts.push(format!("[model:{}]", m));
        }
        if let Some(sp) = system_prompt {
            response_parts.push(format!("[system:{}]", sp));
        }

        let full_response = response_parts.join(" ");

        // Create mock streaming chunks
        let chunks = vec![
            Ok(StreamChunk {
                chunk_type: "assistant".to_string(),
                text: Some(full_response.clone()),
                is_final: false,
                metadata: Some(serde_json::json!({
                    "request_message": message,
                })),
            }),
            Ok(StreamChunk {
                chunk_type: "result".to_string(),
                text: None,
                is_final: true,
                metadata: Some(serde_json::json!({
                    "session_id": session_id,
                    "usage": {
                        "input_tokens": 10,
                        "output_tokens": 5,
                    }
                })),
            }),
        ];

        Ok(Box::new(stream::iter(chunks)))
    }

    async fn health_check(&self) -> Result<bool> {
        if self.should_fail_health {
            Err(anyhow!("Health check failed"))
        } else {
            Ok(true)
        }
    }

    fn provider_type(&self) -> &str {
        &self.provider_type
    }

    fn display_name(&self) -> &str {
        &self.display_name
    }
}

// ==================== Test Suite ====================

#[cfg(test)]
mod regression_tests {
    use super::*;
    use futures::StreamExt;

    /// Test 1: Basic message send/receive
    #[tokio::test]
    async fn test_provider_basic_send_message() {
        let provider = MockPhase17Provider::new("Hello from Phase 17!".to_string());

        let response = provider
            .send_message(
                "Test message",
                None,       // no model override
                None,       // no session
                None,       // no system prompt
                false,      // no streaming
            )
            .await
            .expect("send_message should succeed");

        assert_eq!(response.text, "Hello from Phase 17!");
        assert!(response.session_id.is_none());
        assert!(response.usage.is_some());
        assert_eq!(response.usage.unwrap().input_tokens, 10);
    }

    /// Test 2: Message with session ID (conversation continuity)
    #[tokio::test]
    async fn test_provider_with_session_id() {
        let provider = MockPhase17Provider::new("Response".to_string());

        let response = provider
            .send_message(
                "Follow-up message",
                None,
                Some("session-abc123"),  // resume session
                None,
                false,
            )
            .await
            .expect("send_message should succeed");

        assert_eq!(response.session_id, Some("session-abc123".to_string()));
    }

    /// Test 3: Message with model override
    #[tokio::test]
    async fn test_provider_with_model_override() {
        let provider = MockPhase17Provider::new("Response".to_string());

        let response = provider
            .send_message(
                "Test",
                Some("claude-opus-4"),  // model override
                None,
                None,
                false,
            )
            .await
            .expect("send_message should succeed");

        assert!(response.text.contains("[model:claude-opus-4]"));
    }

    /// Test 4: Message with system prompt
    #[tokio::test]
    async fn test_provider_with_system_prompt() {
        let provider = MockPhase17Provider::new("Response".to_string());

        let response = provider
            .send_message(
                "Test",
                None,
                None,
                Some("You are a helpful assistant"),  // system prompt
                false,
            )
            .await
            .expect("send_message should succeed");

        assert!(response.text.contains("[system:You are a helpful assistant]"));
    }

    /// Test 5: Streaming request via send_message should error
    #[tokio::test]
    async fn test_provider_stream_flag_error() {
        let provider = MockPhase17Provider::new("Response".to_string());

        let result = provider
            .send_message(
                "Test",
                None,
                None,
                None,
                true,  // stream=true should error
            )
            .await;

        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Use send_message_stream"));
    }

    /// Test 6: Streaming response
    #[tokio::test]
    async fn test_provider_streaming_response() {
        let provider = MockPhase17Provider::new("Streaming response".to_string());

        let mut stream = provider
            .send_message_stream(
                "Stream test",
                None,
                Some("session-stream"),
                None,
            )
            .await
            .expect("send_message_stream should succeed");

        // Collect all chunks
        let mut chunks = Vec::new();
        while let Some(chunk_result) = stream.next().await {
            chunks.push(chunk_result.expect("Chunk should be Ok"));
        }

        assert_eq!(chunks.len(), 2, "Should have 2 chunks (assistant + result)");

        // Verify first chunk (assistant)
        assert_eq!(chunks[0].chunk_type, "assistant");
        assert!(chunks[0].text.is_some());
        assert!(!chunks[0].is_final);

        // Verify final chunk (result)
        assert_eq!(chunks[1].chunk_type, "result");
        assert!(chunks[1].is_final);
    }

    /// Test 7: Streaming with model and system prompt
    #[tokio::test]
    async fn test_provider_streaming_with_params() {
        let provider = MockPhase17Provider::new("Response".to_string());

        let mut stream = provider
            .send_message_stream(
                "Test",
                Some("claude-sonnet-4"),
                None,
                Some("Be concise"),
            )
            .await
            .expect("send_message_stream should succeed");

        // Get first chunk
        let chunk = stream.next().await
            .expect("Should have at least one chunk")
            .expect("Chunk should be Ok");

        let text = chunk.text.expect("First chunk should have text");
        assert!(text.contains("[model:claude-sonnet-4]"));
        assert!(text.contains("[system:Be concise]"));
    }

    /// Test 8: Health check success
    #[tokio::test]
    async fn test_provider_health_check_success() {
        let provider = MockPhase17Provider::new("Response".to_string());

        let healthy = provider
            .health_check()
            .await
            .expect("health_check should succeed");

        assert!(healthy);
    }

    /// Test 9: Health check failure
    #[tokio::test]
    async fn test_provider_health_check_failure() {
        let provider = MockPhase17Provider::new("Response".to_string())
            .with_health_failure();

        let result = provider.health_check().await;

        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Health check failed"));
    }

    /// Test 10: Provider type and display name
    #[tokio::test]
    async fn test_provider_metadata() {
        let provider = MockPhase17Provider::new("Response".to_string());

        assert_eq!(provider.provider_type(), "mock-phase17");
        assert_eq!(provider.display_name(), "Mock Phase 17 Provider");
    }

    /// Test 11: Usage statistics
    #[tokio::test]
    async fn test_provider_usage_stats() {
        let provider = MockPhase17Provider::new("Response".to_string());

        let response = provider
            .send_message("Test", None, None, None, false)
            .await
            .expect("send_message should succeed");

        let usage = response.usage.expect("Should have usage stats");
        assert_eq!(usage.input_tokens, 10);
        assert_eq!(usage.output_tokens, 5);
        assert_eq!(usage.cost_usd, Some(0.0001));
    }

    /// Test 12: Metadata in response
    #[tokio::test]
    async fn test_provider_response_metadata() {
        let provider = MockPhase17Provider::new("Response".to_string());

        let response = provider
            .send_message("Test message", None, None, None, false)
            .await
            .expect("send_message should succeed");

        assert!(response.metadata.contains_key("request_message"));
        assert_eq!(
            response.metadata.get("request_message"),
            Some(&serde_json::json!("Test message"))
        );
    }

    /// Test 13: Multiple sequential messages (stateless provider)
    #[tokio::test]
    async fn test_provider_multiple_messages() {
        let provider = MockPhase17Provider::new("Response".to_string());

        // First message
        let resp1 = provider
            .send_message("Message 1", None, None, None, false)
            .await
            .expect("First message should succeed");

        // Second message
        let resp2 = provider
            .send_message("Message 2", None, None, None, false)
            .await
            .expect("Second message should succeed");

        // Both should succeed independently
        assert_eq!(resp1.text, "Response");
        assert_eq!(resp2.text, "Response");
    }
}

// ==================== Configuration Tests ====================

#[cfg(test)]
mod config_tests {
    use vespera_bindery::providers::claude_code::ClaudeCodeConfig;
    use vespera_bindery::providers::ollama::OllamaConfig;

    /// Test 14: ClaudeCodeConfig default construction
    #[test]
    fn test_claude_code_config_default() {
        let config = ClaudeCodeConfig::default();

        assert_eq!(config.executable_path, "/usr/local/bin/claude");
        assert_eq!(config.model, Some("claude-sonnet-4".to_string()));
        assert_eq!(config.max_tokens, Some(4096));
        assert_eq!(config.temperature, Some(0.7));
        assert_eq!(config.timeout, Some(120));
    }

    /// Test 15: ClaudeCodeConfig custom construction
    #[test]
    fn test_claude_code_config_custom() {
        let config = ClaudeCodeConfig {
            executable_path: "/custom/path/claude".to_string(),
            model: Some("claude-opus-4".to_string()),
            system_prompt: Some("Be helpful".to_string()),
            max_tokens: Some(8192),
            temperature: Some(0.5),
            timeout: Some(300),
        };

        assert_eq!(config.executable_path, "/custom/path/claude");
        assert_eq!(config.model, Some("claude-opus-4".to_string()));
        assert_eq!(config.system_prompt, Some("Be helpful".to_string()));
        assert_eq!(config.max_tokens, Some(8192));
        assert_eq!(config.temperature, Some(0.5));
        assert_eq!(config.timeout, Some(300));
    }

    /// Test 16: OllamaConfig default construction
    #[test]
    fn test_ollama_config_default() {
        let config = OllamaConfig::default();

        assert_eq!(config.base_url, "http://localhost:11434");
        assert_eq!(config.model, "llama2");
        assert_eq!(config.api_endpoint, "/api/generate");
        assert_eq!(config.temperature, Some(0.7));
        assert_eq!(config.max_tokens, Some(2048));
        assert_eq!(config.context_window, Some(4096));
        assert_eq!(config.timeout, Some(120));
    }

    /// Test 17: OllamaConfig custom construction
    #[test]
    fn test_ollama_config_custom() {
        let config = OllamaConfig {
            base_url: "http://remote-server:11434".to_string(),
            model: "codellama".to_string(),
            api_endpoint: "/api/chat".to_string(),
            temperature: Some(0.3),
            max_tokens: Some(4096),
            system_prompt: Some("You are a coding assistant".to_string()),
            context_window: Some(8192),
            timeout: Some(180),
        };

        assert_eq!(config.base_url, "http://remote-server:11434");
        assert_eq!(config.model, "codellama");
        assert_eq!(config.api_endpoint, "/api/chat");
        assert_eq!(config.temperature, Some(0.3));
        assert_eq!(config.max_tokens, Some(4096));
        assert_eq!(config.system_prompt, Some("You are a coding assistant".to_string()));
        assert_eq!(config.context_window, Some(8192));
        assert_eq!(config.timeout, Some(180));
    }
}

// ==================== Integration-Style Tests ====================
// These test the actual Phase 17 provider implementations without external dependencies

#[cfg(test)]
mod provider_instantiation_tests {
    use vespera_bindery::providers::{ClaudeCodeProvider, OllamaProvider};
    use vespera_bindery::providers::claude_code::ClaudeCodeConfig;
    use vespera_bindery::providers::ollama::OllamaConfig;
    use vespera_bindery::providers::Provider;

    /// Test 18: ClaudeCodeProvider instantiation
    #[test]
    fn test_claude_code_provider_instantiation() {
        let config = ClaudeCodeConfig::default();
        let provider = ClaudeCodeProvider::new(config);

        // Provider trait methods should be accessible
        assert_eq!(provider.provider_type(), "claude-code-cli");
        assert_eq!(provider.display_name(), "Claude Code CLI");
    }

    /// Test 19: OllamaProvider instantiation
    #[test]
    fn test_ollama_provider_instantiation() {
        let config = OllamaConfig::default();
        let provider = OllamaProvider::new(config);

        // Provider trait methods should be accessible
        assert_eq!(provider.provider_type(), "ollama");
        // Display name includes model
        assert!(provider.display_name().contains("Ollama"));
    }

    /// Test 20: ClaudeCodeProvider with custom config
    #[test]
    fn test_claude_code_provider_custom_config() {
        let config = ClaudeCodeConfig {
            executable_path: "/opt/claude/bin/claude".to_string(),
            model: Some("claude-opus-4".to_string()),
            system_prompt: None,
            max_tokens: Some(16384),
            temperature: Some(0.2),
            timeout: Some(600),
        };

        let provider = ClaudeCodeProvider::new(config);
        assert_eq!(provider.provider_type(), "claude-code-cli");
    }

    /// Test 21: OllamaProvider with custom config
    #[test]
    fn test_ollama_provider_custom_config() {
        let config = OllamaConfig {
            base_url: "http://192.168.1.100:11434".to_string(),
            model: "mistral".to_string(),
            api_endpoint: "/api/generate".to_string(),
            temperature: Some(0.9),
            max_tokens: Some(8192),
            system_prompt: Some("Creative writing mode".to_string()),
            context_window: Some(16384),
            timeout: Some(300),
        };

        let provider = OllamaProvider::new(config);
        assert_eq!(provider.provider_type(), "ollama");
    }
}
