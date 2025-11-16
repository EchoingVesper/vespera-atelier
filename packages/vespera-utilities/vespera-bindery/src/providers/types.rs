//! Phase 17 Provider Types
//!
//! This module makes the richer PR #85 types available for use in Phase 17 providers,
//! enabling gradual migration from simple string parameters to structured types.
//!
//! Migration Strategy:
//! 1. Phase 17.5 Task 4: Make types available, add optional trait methods
//! 2. Future tasks: Gradually migrate call sites to use structured types
//! 3. Eventually: Deprecate simple parameter methods in favor of structured types
//!
//! ## Provider Feature Matrix (Phase 17.5 Tasks 5-6)
//!
//! | Provider          | Streaming | Tools | System Prompt | Max Tokens | Context Length |
//! |-------------------|-----------|-------|---------------|------------|----------------|
//! | ClaudeCodeProvider| ✅        | ✅    | ✅            | 4096-8192  | 200,000        |
//! | OllamaProvider    | ✅        | ❌    | ✅            | 2048-4096  | 4,096-8,192    |
//!
//! ### Claude Code CLI (ClaudeCodeProvider)
//! - **Streaming**: Full support via stream-json format
//! - **Tools**: Full support - extracts tool_use content blocks to ToolCall structs
//! - **System Prompt**: Supported via --system-prompt flag
//! - **Max Tokens**: Configurable, defaults to 4096
//! - **Context**: 200K tokens (Claude Sonnet 4.5)
//!
//! ### Ollama (OllamaProvider)
//! - **Streaming**: Full support via newline-delimited JSON
//! - **Tools**: Not supported (model-dependent, most don't have it)
//! - **System Prompt**: Supported via system field in API
//! - **Max Tokens**: Configurable, defaults to 2048
//! - **Context**: Configurable context_window, defaults to 4096
//!
//! Use `provider.capabilities()` for runtime feature detection.

use super::{ProviderResponse, ProviderUsage};
use futures::Stream;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::pin::Pin;

// ============================================================================
// Core LLM Types (formerly from src/llm/types.rs)
// ============================================================================

/// Role in a chat conversation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ChatRole {
    System,
    User,
    Assistant,
    Tool,
}

/// A single message in a chat conversation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: ChatRole,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

impl ChatMessage {
    pub fn system(content: impl Into<String>) -> Self {
        Self {
            role: ChatRole::System,
            content: content.into(),
            name: None,
            tool_call_id: None,
        }
    }

    pub fn user(content: impl Into<String>) -> Self {
        Self {
            role: ChatRole::User,
            content: content.into(),
            name: None,
            tool_call_id: None,
        }
    }

    pub fn assistant(content: impl Into<String>) -> Self {
        Self {
            role: ChatRole::Assistant,
            content: content.into(),
            name: None,
            tool_call_id: None,
        }
    }
}

/// Request to send to an LLM provider
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequest {
    pub messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_prompt: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub tools: Vec<ToolDefinition>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop_sequences: Option<Vec<String>>,
}

/// Complete response from an LLM provider (non-streaming)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    pub content: String,
    pub finish_reason: FinishReason,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub tool_calls: Vec<ToolCall>,
    pub usage: UsageStats,
}

/// Token usage statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageStats {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

/// Reason why the model stopped generating
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FinishReason {
    Stop,
    Length,
    ToolCalls,
    ContentFilter,
    Error,
}

/// Definition of a tool/function the model can call
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
}

/// A tool call made by the model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: HashMap<String, serde_json::Value>,
}

/// Provider capabilities
#[derive(Debug, Clone)]
pub struct ProviderCapabilities {
    pub supports_streaming: bool,
    pub supports_tools: bool,
    pub supports_system_prompt: bool,
    pub max_tokens: u32,
    pub max_context_length: u32,
}

// ============================================================================
// Streaming Types (formerly from src/llm/streaming.rs)
// ============================================================================

/// A streaming response from an LLM provider
pub struct StreamingResponse {
    /// Stream of chat chunks
    pub stream: Pin<Box<dyn Stream<Item = Result<ChatChunk, anyhow::Error>> + Send>>,
    /// Metadata about the response
    pub metadata: ResponseMetadata,
}

/// Metadata about a streaming response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseMetadata {
    pub model: String,
    pub provider: String,
    pub request_id: Option<String>,
}

/// A single chunk in a streaming response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatChunk {
    /// Text delta (new text added in this chunk)
    pub delta: String,
    /// Finish reason if this is the final chunk
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finish_reason: Option<FinishReason>,
    /// Tool calls made in this chunk
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub tool_calls: Vec<ToolCall>,
    /// Token usage (usually only in final chunk)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage: Option<UsageStats>,
}

impl ChatChunk {
    /// Create a simple text delta chunk
    pub fn text(delta: impl Into<String>) -> Self {
        Self {
            delta: delta.into(),
            finish_reason: None,
            tool_calls: Vec::new(),
            usage: None,
        }
    }

    /// Create a final chunk with finish reason
    pub fn finish(reason: FinishReason, usage: UsageStats) -> Self {
        Self {
            delta: String::new(),
            finish_reason: Some(reason),
            tool_calls: Vec::new(),
            usage: Some(usage),
        }
    }

    /// Check if this is the final chunk
    pub fn is_final(&self) -> bool {
        self.finish_reason.is_some()
    }
}

// ============================================================================
// Type Conversion Utilities
// ============================================================================

/// Convert PR #85 UsageStats to Phase 17 ProviderUsage
pub fn usage_stats_to_provider_usage(stats: &UsageStats) -> ProviderUsage {
    ProviderUsage {
        input_tokens: stats.prompt_tokens as usize,
        output_tokens: stats.completion_tokens as usize,
        cost_usd: None, // Not tracked in PR #85 UsageStats
    }
}

/// Convert PR #85 ChatResponse to Phase 17 ProviderResponse
pub fn chat_response_to_provider_response(
    response: ChatResponse,
    session_id: Option<String>,
) -> ProviderResponse {
    let usage = Some(usage_stats_to_provider_usage(&response.usage));

    let mut metadata = HashMap::new();
    metadata.insert(
        "finish_reason".to_string(),
        serde_json::to_value(&response.finish_reason).unwrap_or(serde_json::Value::Null),
    );

    // Store tool calls in metadata if present
    if !response.tool_calls.is_empty() {
        metadata.insert(
            "tool_calls".to_string(),
            serde_json::to_value(&response.tool_calls).unwrap_or(serde_json::Value::Null),
        );
    }

    ProviderResponse {
        text: response.content,
        session_id,
        usage,
        metadata,
    }
}

/// Convert simple Phase 17 parameters to PR #85 ChatRequest
pub fn simple_params_to_chat_request(
    message: &str,
    system_prompt: Option<&str>,
    max_tokens: Option<u32>,
    temperature: Option<f32>,
) -> ChatRequest {
    let messages = vec![ChatMessage::user(message)];

    ChatRequest {
        messages,
        system_prompt: system_prompt.map(|s| s.to_string()),
        tools: Vec::new(), // No tool support in simple parameters
        max_tokens,
        temperature,
        stop_sequences: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_usage_stats_conversion() {
        let stats = UsageStats {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
        };

        let provider_usage = usage_stats_to_provider_usage(&stats);

        assert_eq!(provider_usage.input_tokens, 100);
        assert_eq!(provider_usage.output_tokens, 50);
        assert_eq!(provider_usage.cost_usd, None);
    }

    #[test]
    fn test_chat_response_conversion() {
        let chat_response = ChatResponse {
            content: "Hello there!".to_string(),
            finish_reason: FinishReason::Stop,
            tool_calls: Vec::new(),
            usage: UsageStats {
                prompt_tokens: 10,
                completion_tokens: 5,
                total_tokens: 15,
            },
        };

        let provider_response = chat_response_to_provider_response(
            chat_response,
            Some("session-123".to_string()),
        );

        assert_eq!(provider_response.text, "Hello there!");
        assert_eq!(provider_response.session_id, Some("session-123".to_string()));
        assert!(provider_response.usage.is_some());

        let usage = provider_response.usage.unwrap();
        assert_eq!(usage.input_tokens, 10);
        assert_eq!(usage.output_tokens, 5);
    }

    #[test]
    fn test_simple_params_conversion() {
        let request = simple_params_to_chat_request(
            "Hello",
            Some("You are helpful"),
            Some(100),
            Some(0.7),
        );

        assert_eq!(request.messages.len(), 1);
        assert_eq!(request.messages[0].content, "Hello");
        assert_eq!(request.system_prompt, Some("You are helpful".to_string()));
        assert_eq!(request.max_tokens, Some(100));
        assert_eq!(request.temperature, Some(0.7));
    }
}
