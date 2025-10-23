//! # LLM Provider Module
//!
//! Provides integrations with various LLM providers for AI chat and task execution.
//! Supports multiple provider types with a unified interface:
//! - Claude Code CLI (uses Claude Max subscription)
//! - Anthropic REST API
//! - OpenAI REST API
//! - Ollama (local LLMs)
//!
//! All providers implement the `LlmProvider` trait for consistent behavior.

pub mod provider;
pub mod streaming;
pub mod types;
pub mod claude_code;
pub mod ollama;
pub mod vault;

pub use provider::{LlmProvider, ProviderType};
pub use streaming::{StreamingResponse, ChatChunk};
pub use types::{
    ChatMessage, ChatRequest, ChatResponse, ChatRole,
    ToolCall, ToolDefinition, FinishReason, ProviderCapabilities
};
pub use claude_code::ClaudeCodeProvider;
pub use ollama::OllamaProvider;
pub use vault::SecretVault;
