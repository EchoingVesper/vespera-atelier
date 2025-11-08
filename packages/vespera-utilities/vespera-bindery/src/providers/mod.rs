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
    /// Send a message to the provider and get a response
    async fn send_message(
        &self,
        message: &str,
        model: Option<&str>,  // Model override (uses provider default if None)
        system_prompt: Option<&str>,
        stream: bool,
    ) -> Result<ProviderResponse, anyhow::Error>;

    /// Send a message with streaming response
    async fn send_message_stream(
        &self,
        message: &str,
        model: Option<&str>,  // Model override (uses provider default if None)
        system_prompt: Option<&str>,
    ) -> Result<Box<dyn futures::Stream<Item = Result<StreamChunk, anyhow::Error>> + Unpin + Send>, anyhow::Error>;

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
