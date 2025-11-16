// Provider Module
//
// Manages LLM provider processes and communication for the chat backend.
// Supports multiple provider types:
// - Claude Code CLI (stream-json format via stdio)
// - Ollama (HTTP REST API)
//
// Architecture:
// - Each provider implements the Provider trait
// - ProviderManager handles lifecycle (spawn, health, restart)
// - Providers read configuration from Codex entries

pub mod claude_code;
pub mod ollama;
pub mod manager;
pub mod adapters;
pub mod types;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Provider response containing the generated text and metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderResponse {
    /// The generated text response
    pub text: String,
    /// Session ID for multi-turn conversations
    pub session_id: Option<String>,
    /// Usage statistics (tokens, cost, etc.)
    pub usage: Option<ProviderUsage>,
    /// Raw response metadata
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Usage statistics from provider
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderUsage {
    /// Input tokens used
    pub input_tokens: usize,
    /// Output tokens generated
    pub output_tokens: usize,
    /// Total cost in USD (if applicable)
    pub cost_usd: Option<f64>,
}

/// Streaming chunk from provider
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamChunk {
    /// Chunk type (assistant, system, result)
    pub chunk_type: String,
    /// Partial text content
    pub text: Option<String>,
    /// Whether this is the final chunk
    pub is_final: bool,
    /// Additional metadata
    pub metadata: Option<serde_json::Value>,
}

/// Provider trait - all providers must implement this
#[async_trait]
pub trait Provider: Send + Sync {
    // ==================== Legacy Methods (Phase 17) ====================
    // These use simple string parameters for backward compatibility

    /// Send a message to the provider and get a response
    async fn send_message(
        &self,
        message: &str,
        model: Option<&str>,  // Model override (uses provider default if None)
        session_id: Option<&str>,  // Session ID for conversation continuity
        system_prompt: Option<&str>,
        stream: bool,
    ) -> Result<ProviderResponse, anyhow::Error>;

    /// Send a message with streaming response
    async fn send_message_stream(
        &self,
        message: &str,
        model: Option<&str>,  // Model override (uses provider default if None)
        session_id: Option<&str>,  // Session ID for conversation continuity
        system_prompt: Option<&str>,
    ) -> Result<Box<dyn futures::Stream<Item = Result<StreamChunk, anyhow::Error>> + Unpin + Send>, anyhow::Error>;

    // ==================== New Methods (PR #85 Integration) ====================
    // These use structured types for richer functionality

    /// Send a structured chat request (new in Phase 17.5)
    ///
    /// This method uses the richer ChatRequest/ChatResponse types from PR #85,
    /// enabling features like multi-turn conversations, tool calling, etc.
    ///
    /// Default implementation converts to simple parameters and calls send_message().
    /// Providers can override for native support.
    async fn send_chat_request(
        &self,
        request: types::ChatRequest,
        session_id: Option<&str>,
    ) -> Result<types::ChatResponse, anyhow::Error> {
        // Default implementation: Convert ChatRequest to simple parameters
        // Extract the last user message
        let user_message = request.messages.iter()
            .rev()
            .find(|msg| matches!(msg.role, types::ChatRole::User))
            .map(|msg| msg.content.as_str())
            .unwrap_or("");

        // Call legacy send_message
        let response = self.send_message(
            user_message,
            None, // No model override in ChatRequest
            session_id,
            request.system_prompt.as_deref(),
            false, // Non-streaming
        ).await?;

        // Convert ProviderResponse back to ChatResponse
        Ok(types::ChatResponse {
            content: response.text,
            finish_reason: types::FinishReason::Stop, // Assume stop for legacy
            tool_calls: Vec::new(), // No tool calls in legacy
            usage: types::UsageStats {
                prompt_tokens: response.usage.as_ref().map(|u| u.input_tokens as u32).unwrap_or(0),
                completion_tokens: response.usage.as_ref().map(|u| u.output_tokens as u32).unwrap_or(0),
                total_tokens: response.usage.as_ref().map(|u| (u.input_tokens + u.output_tokens) as u32).unwrap_or(0),
            },
        })
    }

    /// Send a structured chat request with streaming (new in Phase 17.5)
    ///
    /// This method uses the richer streaming types from PR #85.
    ///
    /// Default implementation converts to simple parameters and calls send_message_stream().
    /// Providers can override for native support.
    async fn send_chat_request_stream(
        &self,
        request: types::ChatRequest,
        session_id: Option<&str>,
    ) -> Result<types::StreamingResponse, anyhow::Error> {
        // Default implementation: Convert ChatRequest to simple parameters
        let user_message = request.messages.iter()
            .rev()
            .find(|msg| matches!(msg.role, types::ChatRole::User))
            .map(|msg| msg.content.as_str())
            .unwrap_or("");

        // Call legacy send_message_stream
        let stream = self.send_message_stream(
            user_message,
            None,
            session_id,
            request.system_prompt.as_deref(),
        ).await?;

        // Convert StreamChunk stream to ChatChunk stream
        use futures::StreamExt;
        let chat_stream = stream.map(|result| {
            result.map(|chunk| types::ChatChunk {
                delta: chunk.text.unwrap_or_default(),
                finish_reason: if chunk.is_final { Some(types::FinishReason::Stop) } else { None },
                tool_calls: Vec::new(),
                usage: None,
            })
        });

        Ok(types::StreamingResponse {
            stream: Box::pin(chat_stream),
            metadata: types::ResponseMetadata {
                model: "unknown".to_string(),
                provider: self.provider_type().to_string(),
                request_id: None,
            },
        })
    }

    // ==================== Common Methods ====================

    /// Health check - returns true if provider is operational
    async fn health_check(&self) -> Result<bool, anyhow::Error>;

    /// Get provider type identifier
    fn provider_type(&self) -> &str;

    /// Get provider display name
    fn display_name(&self) -> &str;
}

/// Provider configuration loaded from Codex entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    /// Codex ID of the provider configuration
    pub codex_id: Uuid,
    /// Provider type (claude-code-cli, ollama, etc.)
    pub provider_type: String,
    /// Provider-specific configuration
    pub config: serde_json::Value,
}

pub use manager::ProviderManager;
pub use claude_code::ClaudeCodeProvider;
pub use ollama::OllamaProvider;
