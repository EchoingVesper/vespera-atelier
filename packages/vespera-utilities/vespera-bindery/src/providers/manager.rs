// Provider Manager
//
// Manages provider lifecycle, loading configurations from Codex entries
// and instantiating the appropriate provider implementations.

use super::{
    claude_code::{ClaudeCodeConfig, ClaudeCodeProvider},
    ollama::{OllamaConfig, OllamaProvider},
    Provider, ProviderResponse, StreamChunk,
};
use crate::database::Database;
use anyhow::{anyhow, Context, Result};
use futures::Stream;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

/// Provider Manager for managing multiple provider instances
pub struct ProviderManager {
    database: Arc<Database>,
    providers: Arc<RwLock<HashMap<String, Arc<Box<dyn Provider>>>>>,
}

impl ProviderManager {
    /// Create a new ProviderManager
    pub fn new(database: Arc<Database>) -> Self {
        Self {
            database,
            providers: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Load all provider Codices from the database
    pub async fn load_providers(&self) -> Result<Vec<String>> {
        info!("Loading providers from database");
        eprintln!("Debug: ProviderManager loading providers from database");

        let mut provider_ids = Vec::new();

        // Query for provider Codices (template_id starting with provider templates)
        let codices = self
            .database
            .list_codices()
            .await
            .context("Failed to list codices")?;

        eprintln!("Debug: Found {} total codices in database", codices.len());

        for codex in codices {
            let template_id_opt = codex.get("template_id").and_then(|v| v.as_str());
            let id_opt = codex.get("id").and_then(|v| v.as_str());

            eprintln!("Debug: Checking codex: id={:?}, template_id={:?}", id_opt, template_id_opt);

            if let Some(template_id) = template_id_opt {
                // Check if this is a provider template
                if template_id == "claude-code-cli" || template_id == "ollama" {
                    eprintln!("Debug: Found provider codex with template_id: {}", template_id);
                    if let Some(id) = id_opt {
                        eprintln!("Debug: Attempting to load provider: {}", id);
                        match self.load_provider(id).await {
                            Ok(_) => {
                                provider_ids.push(id.to_string());
                                info!("Loaded provider: {}", id);
                                eprintln!("Debug: Successfully loaded provider: {}", id);
                            }
                            Err(e) => {
                                error!("Failed to load provider {}: {}", id, e);
                                eprintln!("Debug: Failed to load provider {}: {}", id, e);
                            }
                        }
                    } else {
                        warn!("Provider codex missing id field");
                        eprintln!("Debug: Provider codex missing id field");
                    }
                }
            }
        }

        eprintln!("Debug: Loaded {} providers total", provider_ids.len());
        info!("Loaded {} providers", provider_ids.len());
        Ok(provider_ids)
    }

    /// Load a specific provider by Codex ID
    pub async fn load_provider(&self, codex_id: &str) -> Result<()> {
        debug!("Loading provider from Codex: {}", codex_id);

        // Get Codex from database
        let codex = self
            .database
            .get_codex(codex_id)
            .await
            .context("Failed to get codex")?
            .ok_or_else(|| anyhow!("Codex not found: {}", codex_id))?;

        // Extract template_id to determine provider type
        let template_id = codex
            .get("template_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing template_id in codex"))?;

        // Get content with provider configuration
        let content = codex
            .get("content")
            .ok_or_else(|| anyhow!("Missing content in codex"))?;

        // Get fields from content
        let fields = content
            .get("fields")
            .ok_or_else(|| anyhow!("Missing fields in content"))?;

        // Instantiate the appropriate provider based on template_id
        let provider: Box<dyn Provider> = match template_id {
            "claude-code-cli" => {
                let config = self.parse_claude_code_config(fields)?;
                Box::new(ClaudeCodeProvider::new(config))
            }
            "ollama" => {
                let config = self.parse_ollama_config(fields)?;
                Box::new(OllamaProvider::new(config))
            }
            _ => {
                return Err(anyhow!("Unknown provider template: {}", template_id));
            }
        };

        // Store provider in cache
        let mut providers = self.providers.write().await;
        providers.insert(codex_id.to_string(), Arc::new(provider));

        info!("Loaded provider {} ({})", codex_id, template_id);
        Ok(())
    }

    /// Parse ClaudeCodeConfig from Codex fields
    fn parse_claude_code_config(&self, fields: &Value) -> Result<ClaudeCodeConfig> {
        let executable_path = fields
            .get("executable_path")
            .and_then(|v| v.as_str())
            .unwrap_or("/usr/local/bin/claude")
            .to_string();

        let model = fields.get("model").and_then(|v| v.as_str()).map(|s| s.to_string());

        let system_prompt = fields
            .get("system_prompt")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let max_tokens = fields
            .get("max_tokens")
            .and_then(|v| v.as_u64())
            .map(|n| n as usize);

        let temperature = fields
            .get("temperature")
            .and_then(|v| v.as_f64())
            .map(|f| f as f32);

        let timeout = fields.get("timeout").and_then(|v| v.as_u64());

        Ok(ClaudeCodeConfig {
            executable_path,
            model,
            system_prompt,
            max_tokens,
            temperature,
            timeout,
        })
    }

    /// Parse OllamaConfig from Codex fields
    fn parse_ollama_config(&self, fields: &Value) -> Result<OllamaConfig> {
        let base_url = fields
            .get("base_url")
            .and_then(|v| v.as_str())
            .unwrap_or("http://localhost:11434")
            .to_string();

        let model = fields
            .get("model")
            .and_then(|v| v.as_str())
            .unwrap_or("llama2")
            .to_string();

        let api_endpoint = fields
            .get("api_endpoint")
            .and_then(|v| v.as_str())
            .unwrap_or("/api/generate")
            .to_string();

        let temperature = fields
            .get("temperature")
            .and_then(|v| v.as_f64())
            .map(|f| f as f32);

        let max_tokens = fields
            .get("max_tokens")
            .and_then(|v| v.as_u64())
            .map(|n| n as usize);

        let system_prompt = fields
            .get("system_prompt")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let context_window = fields
            .get("context_window")
            .and_then(|v| v.as_u64())
            .map(|n| n as usize);

        let timeout = fields.get("timeout").and_then(|v| v.as_u64());

        Ok(OllamaConfig {
            base_url,
            model,
            api_endpoint,
            temperature,
            max_tokens,
            system_prompt,
            context_window,
            timeout,
        })
    }

    /// Send a message to a specific provider
    pub async fn send_message(
        &self,
        provider_id: &str,
        message: &str,
        model: Option<&str>,
        session_id: Option<&str>,
        system_prompt: Option<&str>,
        stream: bool,
    ) -> Result<ProviderResponse> {
        debug!("Sending message to provider: {}", provider_id);

        // Get provider from cache
        let providers = self.providers.read().await;
        let provider = providers
            .get(provider_id)
            .ok_or_else(|| anyhow!("Provider not found: {}", provider_id))?;

        // Send message to provider with optional model and session_id
        provider.send_message(message, model, session_id, system_prompt, stream).await
    }

    /// Send a message with streaming to a specific provider
    pub async fn send_message_stream(
        &self,
        provider_id: &str,
        message: &str,
        model: Option<&str>,
        session_id: Option<&str>,
        system_prompt: Option<&str>,
    ) -> Result<Box<dyn Stream<Item = Result<StreamChunk>> + Unpin + Send>> {
        debug!("Sending message to provider with streaming: {}", provider_id);

        // Get provider from cache
        let providers = self.providers.read().await;
        let provider = providers
            .get(provider_id)
            .ok_or_else(|| anyhow!("Provider not found: {}", provider_id))?;

        // Clone Arc to avoid holding read lock across await
        let provider = Arc::clone(provider);
        drop(providers);

        // Send message to provider with optional model and session_id
        provider.send_message_stream(message, model, session_id, system_prompt).await
    }

    /// List all loaded providers
    pub async fn list_providers(&self) -> Result<Vec<String>> {
        let providers = self.providers.read().await;
        Ok(providers.keys().cloned().collect())
    }

    /// Get provider information
    pub async fn get_provider_info(&self, provider_id: &str) -> Result<ProviderInfo> {
        // Get provider from cache
        let providers = self.providers.read().await;
        let provider = providers
            .get(provider_id)
            .ok_or_else(|| anyhow!("Provider not found: {}", provider_id))?;

        // Get Codex metadata
        let codex = self
            .database
            .get_codex(provider_id)
            .await
            .context("Failed to get codex")?
            .ok_or_else(|| anyhow!("Codex not found: {}", provider_id))?;

        let title = codex
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Untitled")
            .to_string();

        Ok(ProviderInfo {
            id: provider_id.to_string(),
            title,
            provider_type: provider.provider_type().to_string(),
            display_name: provider.display_name().to_string(),
        })
    }

    /// Health check for a specific provider
    pub async fn health_check(&self, provider_id: &str) -> Result<bool> {
        debug!("Performing health check on provider: {}", provider_id);

        let providers = self.providers.read().await;
        let provider = providers
            .get(provider_id)
            .ok_or_else(|| anyhow!("Provider not found: {}", provider_id))?;

        provider.health_check().await
    }

    /// Reload a provider (useful after configuration changes)
    pub async fn reload_provider(&self, provider_id: &str) -> Result<()> {
        info!("Reloading provider: {}", provider_id);

        // Remove old instance
        {
            let mut providers = self.providers.write().await;
            providers.remove(provider_id);
        }

        // Load fresh instance
        self.load_provider(provider_id).await
    }

    /// Unload a provider
    pub async fn unload_provider(&self, provider_id: &str) -> Result<()> {
        info!("Unloading provider: {}", provider_id);

        let mut providers = self.providers.write().await;
        providers
            .remove(provider_id)
            .ok_or_else(|| anyhow!("Provider not found: {}", provider_id))?;

        Ok(())
    }
}

/// Provider information for listing
#[derive(Debug, Clone)]
pub struct ProviderInfo {
    pub id: String,
    pub title: String,
    pub provider_type: String,
    pub display_name: String,
}
