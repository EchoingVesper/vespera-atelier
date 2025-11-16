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
//! 5. NEW in Task 4: Structured type methods (send_chat_request, send_chat_request_stream)
//!
//! These tests focus on the Phase 17 Provider API surface, not the PR #85 LlmProvider.

use vespera_bindery::providers::{Provider, ProviderResponse, ProviderUsage, StreamChunk};
use vespera_bindery::providers::types::{ChatRequest, ChatMessage, ChatResponse, ChatRole, FinishReason, UsageStats};
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

// ==================== Structured Type Methods Tests (Task 4) ====================
// Tests for new send_chat_request and send_chat_request_stream methods

#[cfg(test)]
mod structured_type_tests {
    use super::*;
    use futures::StreamExt;

    /// Test 22: send_chat_request with default implementation
    #[tokio::test]
    async fn test_send_chat_request_basic() {
        let provider = MockPhase17Provider::new("Response from chat request".to_string());

        let request = ChatRequest {
            messages: vec![ChatMessage::user("Hello")],
            system_prompt: None,
            tools: Vec::new(),
            max_tokens: None,
            temperature: None,
            stop_sequences: None,
        };

        let response = provider
            .send_chat_request(request, None)
            .await
            .expect("send_chat_request should succeed");

        assert_eq!(response.content, "Response from chat request");
        assert_eq!(response.finish_reason, FinishReason::Stop);
        assert!(response.tool_calls.is_empty());
    }

    /// Test 23: send_chat_request with system prompt
    #[tokio::test]
    async fn test_send_chat_request_with_system_prompt() {
        let provider = MockPhase17Provider::new("Response".to_string());

        let request = ChatRequest {
            messages: vec![ChatMessage::user("Test")],
            system_prompt: Some("Be helpful".to_string()),
            tools: Vec::new(),
            max_tokens: Some(100),
            temperature: Some(0.7),
            stop_sequences: None,
        };

        let response = provider
            .send_chat_request(request, Some("session-456"))
            .await
            .expect("send_chat_request should succeed");

        // Default implementation extracts message and calls send_message
        assert!(response.content.contains("Response"));
        assert_eq!(response.usage.prompt_tokens, 10);
        assert_eq!(response.usage.completion_tokens, 5);
    }

    /// Test 24: send_chat_request with multi-turn conversation
    #[tokio::test]
    async fn test_send_chat_request_multi_turn() {
        let provider = MockPhase17Provider::new("Reply".to_string());

        let request = ChatRequest {
            messages: vec![
                ChatMessage::user("First message"),
                ChatMessage::assistant("First response"),
                ChatMessage::user("Second message"),
            ],
            system_prompt: None,
            tools: Vec::new(),
            max_tokens: None,
            temperature: None,
            stop_sequences: None,
        };

        let response = provider
            .send_chat_request(request, None)
            .await
            .expect("send_chat_request should succeed");

        // Default implementation should extract the last user message
        assert_eq!(response.content, "Reply");
    }

    /// Test 25: send_chat_request_stream basic
    #[tokio::test]
    async fn test_send_chat_request_stream_basic() {
        let provider = MockPhase17Provider::new("Streaming response".to_string());

        let request = ChatRequest {
            messages: vec![ChatMessage::user("Stream test")],
            system_prompt: None,
            tools: Vec::new(),
            max_tokens: None,
            temperature: None,
            stop_sequences: None,
        };

        let streaming_response = provider
            .send_chat_request_stream(request, None)
            .await
            .expect("send_chat_request_stream should succeed");

        // Verify metadata
        assert!(streaming_response.metadata.provider.contains("mock-phase17"));

        // Collect chunks from stream
        let chunks: Vec<_> = streaming_response.stream
            .collect()
            .await;

        assert!(!chunks.is_empty(), "Should have at least one chunk");

        // First chunk should have content
        let first_chunk = chunks[0].as_ref().expect("First chunk should be Ok");
        assert!(!first_chunk.delta.is_empty());
    }

    /// Test 26: send_chat_request_stream with system prompt
    #[tokio::test]
    async fn test_send_chat_request_stream_with_system() {
        let provider = MockPhase17Provider::new("Response".to_string());

        let request = ChatRequest {
            messages: vec![ChatMessage::user("Test")],
            system_prompt: Some("Be concise".to_string()),
            tools: Vec::new(),
            max_tokens: Some(50),
            temperature: Some(0.5),
            stop_sequences: None,
        };

        let streaming_response = provider
            .send_chat_request_stream(request, Some("session-789"))
            .await
            .expect("send_chat_request_stream should succeed");

        // Collect all chunks
        let chunks: Vec<_> = streaming_response.stream
            .collect()
            .await;

        assert!(!chunks.is_empty());

        // At least one chunk should have content
        let has_content = chunks.iter().any(|chunk| {
            chunk.as_ref().map(|c| !c.delta.is_empty()).unwrap_or(false)
        });
        assert!(has_content, "At least one chunk should have content");
    }

    /// Test 27: ChatRequest with empty messages list
    #[tokio::test]
    async fn test_send_chat_request_empty_messages() {
        let provider = MockPhase17Provider::new("Default".to_string());

        let request = ChatRequest {
            messages: vec![], // Empty messages
            system_prompt: Some("System only".to_string()),
            tools: Vec::new(),
            max_tokens: None,
            temperature: None,
            stop_sequences: None,
        };

        let response = provider
            .send_chat_request(request, None)
            .await
            .expect("send_chat_request should succeed with empty messages");

        // Default implementation should handle empty messages gracefully
        assert!(!response.content.is_empty());
    }

    /// Test 28: Verify UsageStats conversion
    #[tokio::test]
    async fn test_send_chat_request_usage_stats() {
        let provider = MockPhase17Provider::new("Test".to_string());

        let request = ChatRequest {
            messages: vec![ChatMessage::user("Usage test")],
            system_prompt: None,
            tools: Vec::new(),
            max_tokens: None,
            temperature: None,
            stop_sequences: None,
        };

        let response = provider
            .send_chat_request(request, None)
            .await
            .expect("send_chat_request should succeed");

        // Verify usage stats are properly converted
        assert_eq!(response.usage.prompt_tokens, 10);
        assert_eq!(response.usage.completion_tokens, 5);
        assert_eq!(response.usage.total_tokens, 15);
    }
}

// ==================== Capabilities Reporting Tests (Task 5) ====================
// Tests for provider capabilities() method

#[cfg(test)]
mod capabilities_tests {
    use super::*;
    use vespera_bindery::providers::types::ProviderCapabilities;

    /// Test 29: Mock provider capabilities (default implementation)
    #[test]
    fn test_mock_provider_capabilities() {
        let provider = MockPhase17Provider::new("Test".to_string());
        let caps = provider.capabilities();

        // Default implementation should return conservative defaults
        assert!(!caps.supports_streaming); // Default is false
        assert!(!caps.supports_tools);     // Default is false
        assert!(caps.supports_system_prompt); // Default is true
        assert_eq!(caps.max_tokens, 4096);
        assert_eq!(caps.max_context_length, 8192);
    }

    /// Test 30: ClaudeCodeProvider capabilities
    #[test]
    fn test_claude_code_provider_capabilities() {
        use vespera_bindery::providers::claude_code::ClaudeCodeConfig;
        use vespera_bindery::providers::ClaudeCodeProvider;

        let config = ClaudeCodeConfig {
            executable_path: "/usr/local/bin/claude".to_string(),
            model: Some("claude-sonnet-4".to_string()),
            system_prompt: None,
            max_tokens: Some(8192),
            temperature: Some(0.7),
            timeout: Some(120),
        };

        let provider = ClaudeCodeProvider::new(config);
        let caps = provider.capabilities();

        // Claude Code CLI supports streaming and tools
        assert!(caps.supports_streaming, "Claude Code should support streaming");
        assert!(caps.supports_tools, "Claude Code should support tools");
        assert!(caps.supports_system_prompt, "Claude Code should support system prompts");
        assert_eq!(caps.max_tokens, 8192); // From config
        assert_eq!(caps.max_context_length, 200000); // Claude Sonnet 4.5 window
    }

    /// Test 31: ClaudeCodeProvider capabilities with default max_tokens
    #[test]
    fn test_claude_code_provider_default_capabilities() {
        use vespera_bindery::providers::claude_code::ClaudeCodeConfig;
        use vespera_bindery::providers::ClaudeCodeProvider;

        let config = ClaudeCodeConfig {
            executable_path: "/usr/local/bin/claude".to_string(),
            model: Some("claude-sonnet-4".to_string()),
            system_prompt: None,
            max_tokens: None, // No max_tokens specified
            temperature: Some(0.7),
            timeout: Some(120),
        };

        let provider = ClaudeCodeProvider::new(config);
        let caps = provider.capabilities();

        // Should use default max_tokens
        assert_eq!(caps.max_tokens, 4096); // Default value
    }

    /// Test 32: OllamaProvider capabilities
    #[test]
    fn test_ollama_provider_capabilities() {
        use vespera_bindery::providers::ollama::OllamaConfig;
        use vespera_bindery::providers::OllamaProvider;

        let config = OllamaConfig {
            base_url: "http://localhost:11434".to_string(),
            model: "llama2".to_string(),
            api_endpoint: "/api/generate".to_string(),
            temperature: Some(0.7),
            max_tokens: Some(4096),
            system_prompt: None,
            context_window: Some(8192),
            timeout: Some(120),
        };

        let provider = OllamaProvider::new(config);
        let caps = provider.capabilities();

        // Ollama supports streaming but not tools
        assert!(caps.supports_streaming, "Ollama should support streaming");
        assert!(!caps.supports_tools, "Ollama should not support tools");
        assert!(caps.supports_system_prompt, "Ollama should support system prompts");
        assert_eq!(caps.max_tokens, 4096); // From config
        assert_eq!(caps.max_context_length, 8192); // From context_window config
    }

    /// Test 33: OllamaProvider capabilities with defaults
    #[test]
    fn test_ollama_provider_default_capabilities() {
        use vespera_bindery::providers::ollama::OllamaConfig;
        use vespera_bindery::providers::OllamaProvider;

        let config = OllamaConfig::default();
        let provider = OllamaProvider::new(config);
        let caps = provider.capabilities();

        // Should use default values
        assert_eq!(caps.max_tokens, 2048); // Ollama default
        assert_eq!(caps.max_context_length, 4096); // Ollama default context_window
    }

    /// Test 34: Runtime feature detection
    #[test]
    fn test_runtime_feature_detection() {
        let provider = MockPhase17Provider::new("Test".to_string());
        let caps = provider.capabilities();

        // Simulate runtime feature detection logic
        if caps.supports_streaming {
            // Use streaming
            assert!(false, "Mock provider shouldn't support streaming");
        } else {
            // Fall back to non-streaming
            assert!(true);
        }

        if caps.supports_tools {
            // Enable tool calling UI
            assert!(false, "Mock provider shouldn't support tools");
        } else {
            // Hide tool calling features
            assert!(true);
        }
    }
}
