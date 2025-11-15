//! LLM provider trait and provider type enum

use super::streaming::StreamingResponse;
use super::types::{ChatRequest, ChatResponse, ProviderCapabilities};
use crate::codex::Codex;
use anyhow::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

/// Trait for LLM providers
#[async_trait]
pub trait LlmProvider: Send + Sync {
    /// Send a chat message and get a streaming response
    async fn send_message_streaming(&self, request: ChatRequest) -> Result<StreamingResponse>;

    /// Send a chat message and get a complete response (non-streaming)
    async fn send_message(&self, request: ChatRequest) -> Result<ChatResponse>;

    /// Get provider capabilities
    fn capabilities(&self) -> ProviderCapabilities;

    /// Validate provider configuration
    async fn validate_config(&self) -> Result<()>;

    /// Get provider name
    fn name(&self) -> &str;
}

/// Provider type configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ProviderType {
    /// Claude Code CLI - uses Claude Max subscription (PRIORITY)
    /// Spawns `claude` CLI process, requires authentication via `claude login`
    ClaudeCode {
        model: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        cli_path: Option<String>,
        #[serde(default = "default_max_turns")]
        max_turns: u32,
        #[serde(skip_serializing_if = "Option::is_none")]
        custom_system_prompt: Option<String>,
        #[serde(default)]
        allowed_tools: Vec<String>,
    },
    /// Direct Anthropic REST API - uses API key (SECONDARY)
    Anthropic {
        api_key: String,
        model: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        base_url: Option<String>,
    },
    /// OpenAI REST API - uses API key (SECONDARY)
    OpenAI {
        api_key: String,
        model: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        base_url: Option<String>,
    },
    /// Ollama local LLM server (PRIORITY for cost-effective tasks)
    Ollama {
        model: String,
        #[serde(default = "default_ollama_endpoint")]
        endpoint: String,
    },
}

fn default_max_turns() -> u32 {
    1
}

fn default_ollama_endpoint() -> String {
    "http://localhost:11434/v1".to_string()
}

impl ProviderType {
    /// Create provider from Codex template fields
    pub async fn from_codex(codex: &Codex) -> Result<Self> {
        use crate::types::TemplateFieldValue;

        // Helper function to get string value from template field
        let get_string = |field_name: &str| -> Option<String> {
            codex.content.template_fields.get(field_name).and_then(|v| {
                match v {
                    TemplateFieldValue::Text { value } => Some(value.clone()),
                    _ => None,
                }
            })
        };

        // Helper function to get structured value
        let get_structured = |field_name: &str| -> Option<serde_json::Value> {
            codex.content.template_fields.get(field_name).and_then(|v| {
                match v {
                    TemplateFieldValue::Structured { value } => Some(value.clone()),
                    _ => None,
                }
            })
        };

        let provider_type = get_string("provider_type")
            .ok_or_else(|| anyhow::anyhow!("Missing provider_type in Codex template fields"))?;

        match provider_type.as_str() {
            "claude-code" => {
                let model = get_string("model")
                    .unwrap_or_else(|| "claude-sonnet-4.5-20250929".to_string());

                let cli_path = get_string("cli_path");

                let max_turns = get_structured("max_turns")
                    .and_then(|v| v.as_u64())
                    .map(|n| n as u32)
                    .unwrap_or(1);

                let custom_system_prompt = get_string("system_prompt_override");

                let allowed_tools = get_structured("available_tools")
                    .and_then(|v| v.as_array().map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str().map(|s| s.to_string()))
                            .collect()
                    }))
                    .unwrap_or_default();

                Ok(Self::ClaudeCode {
                    model,
                    cli_path,
                    max_turns,
                    custom_system_prompt,
                    allowed_tools,
                })
            }
            "ollama" => {
                let model = get_string("model")
                    .ok_or_else(|| anyhow::anyhow!("Missing model for Ollama provider"))?;

                let endpoint = get_string("endpoint")
                    .unwrap_or_else(|| "http://localhost:11434/v1".to_string());

                Ok(Self::Ollama { model, endpoint })
            }
            "anthropic" => {
                let api_key = get_string("api_key_ref")
                    .ok_or_else(|| anyhow::anyhow!("Missing api_key_ref for Anthropic provider"))?;

                let model = get_string("model")
                    .unwrap_or_else(|| "claude-sonnet-4.5-20250929".to_string());

                let base_url = get_string("base_url");

                Ok(Self::Anthropic {
                    api_key,
                    model,
                    base_url,
                })
            }
            "openai" => {
                let api_key = get_string("api_key_ref")
                    .ok_or_else(|| anyhow::anyhow!("Missing api_key_ref for OpenAI provider"))?;

                let model = get_string("model")
                    .unwrap_or_else(|| "gpt-4-turbo-preview".to_string());

                let base_url = get_string("base_url");

                Ok(Self::OpenAI {
                    api_key,
                    model,
                    base_url,
                })
            }
            _ => Err(anyhow::anyhow!("Unknown provider type: {}", provider_type)),
        }
    }

    /// Get the model name for this provider
    pub fn model(&self) -> &str {
        match self {
            Self::ClaudeCode { model, .. } => model,
            Self::Anthropic { model, .. } => model,
            Self::OpenAI { model, .. } => model,
            Self::Ollama { model, .. } => model,
        }
    }
}
