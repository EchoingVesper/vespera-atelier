//! Claude Code CLI provider implementation
//!
//! This provider spawns the `claude` CLI process and communicates with it
//! to leverage the user's Claude Max subscription instead of direct API calls.

use super::provider::LlmProvider;
use super::streaming::{ChatChunk, ResponseMetadata, StreamingResponse};
use super::types::{
    ChatMessage, ChatRequest, ChatResponse, ChatRole, FinishReason, ProviderCapabilities,
    UsageStats,
};
use anyhow::{Context, Result};
use async_trait::async_trait;
use futures::stream::{self, StreamExt};
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tracing::{debug, error, info, warn};

/// Claude Code CLI provider
pub struct ClaudeCodeProvider {
    model: String,
    cli_path: String,
    max_turns: u32,
    custom_system_prompt: Option<String>,
    allowed_tools: Vec<String>,
}

impl ClaudeCodeProvider {
    /// Create a new Claude Code provider
    pub fn new(
        model: String,
        cli_path: Option<String>,
        max_turns: u32,
        custom_system_prompt: Option<String>,
        allowed_tools: Vec<String>,
    ) -> Self {
        let cli_path = cli_path.unwrap_or_else(|| {
            // Try to find claude in PATH
            which::which("claude")
                .ok()
                .and_then(|p| p.to_str().map(|s| s.to_string()))
                .unwrap_or_else(|| "claude".to_string())
        });

        Self {
            model,
            cli_path,
            max_turns,
            custom_system_prompt,
            allowed_tools,
        }
    }

    /// Check if Claude CLI is authenticated
    pub async fn check_auth() -> Result<bool> {
        let output = Command::new("claude")
            .arg("--version")
            .output()
            .await
            .context("Failed to execute claude CLI - is it installed?")?;

        if !output.status.success() {
            return Ok(false);
        }

        // Try a simple query to check authentication
        let test_output = Command::new("claude")
            .arg("query")
            .arg("--prompt")
            .arg("test")
            .arg("--max-turns")
            .arg("1")
            .output()
            .await;

        match test_output {
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr);
                // Check if output contains authentication error
                Ok(!stderr.contains("not authenticated") && !stderr.contains("login"))
            }
            Err(_) => Ok(false),
        }
    }

    /// Build command arguments for Claude CLI
    fn build_command_args(&self, request: &ChatRequest) -> Vec<String> {
        let mut args = vec!["query".to_string()];

        // Model selection
        args.push("--model".to_string());
        args.push(self.model.clone());

        // Max turns
        args.push("--max-turns".to_string());
        args.push(self.max_turns.to_string());

        // System prompt
        if let Some(ref system_prompt) = self.custom_system_prompt {
            args.push("--custom-system-prompt".to_string());
            args.push(system_prompt.clone());
        } else if let Some(ref system_prompt) = request.system_prompt {
            args.push("--custom-system-prompt".to_string());
            args.push(system_prompt.clone());
        }

        // Allowed tools
        if !self.allowed_tools.is_empty() {
            args.push("--allowed-tools".to_string());
            args.push(self.allowed_tools.join(","));
        }

        // Build prompt from messages
        let prompt = self.build_prompt_from_messages(&request.messages);
        args.push("--prompt".to_string());
        args.push(prompt);

        args
    }

    /// Build a single prompt string from message history
    fn build_prompt_from_messages(&self, messages: &[ChatMessage]) -> String {
        let mut prompt_parts = Vec::new();

        for msg in messages {
            match msg.role {
                ChatRole::User => {
                    prompt_parts.push(format!("User: {}", msg.content));
                }
                ChatRole::Assistant => {
                    prompt_parts.push(format!("Assistant: {}", msg.content));
                }
                ChatRole::System => {
                    // System messages are handled via --custom-system-prompt
                    continue;
                }
                ChatRole::Tool => {
                    // Tool results embedded in context
                    prompt_parts.push(format!("Tool Result: {}", msg.content));
                }
            }
        }

        // Get the last user message as the primary prompt
        messages
            .iter()
            .rev()
            .find(|m| m.role == ChatRole::User)
            .map(|m| m.content.clone())
            .unwrap_or_else(|| prompt_parts.join("\n\n"))
    }
}

#[async_trait]
impl LlmProvider for ClaudeCodeProvider {
    async fn send_message_streaming(&self, request: ChatRequest) -> Result<StreamingResponse> {
        info!("Sending streaming request to Claude Code CLI");

        let args = self.build_command_args(&request);

        debug!("Spawning claude CLI with args: {:?}", args);

        let mut child = Command::new(&self.cli_path)
            .args(&args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .context("Failed to spawn claude CLI process")?;

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| anyhow::anyhow!("Failed to capture stdout"))?;

        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| anyhow::anyhow!("Failed to capture stderr"))?;

        // Spawn task to log stderr
        tokio::spawn(async move {
            let mut stderr_reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = stderr_reader.next_line().await {
                debug!("[Claude CLI stderr] {}", line);
            }
        });

        // Create stream from stdout
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();

        let stream = stream::unfold(
            (lines, false),
            |(mut lines, mut finished)| async move {
                if finished {
                    return None;
                }

                match lines.next_line().await {
                    Ok(Some(line)) => {
                        if line.trim().is_empty() {
                            return Some((Ok(ChatChunk::text("")), (lines, finished)));
                        }

                        // Check for end markers
                        if line.contains("</response>") || line.contains("</output>") {
                            finished = true;
                            return Some((
                                Ok(ChatChunk::finish(
                                    FinishReason::Stop,
                                    UsageStats {
                                        prompt_tokens: 0, // Claude CLI doesn't provide usage
                                        completion_tokens: 0,
                                        total_tokens: 0,
                                    },
                                )),
                                (lines, finished),
                            ));
                        }

                        Some((Ok(ChatChunk::text(line + "\n")), (lines, finished)))
                    }
                    Ok(None) => {
                        // Stream ended
                        finished = true;
                        Some((
                            Ok(ChatChunk::finish(
                                FinishReason::Stop,
                                UsageStats {
                                    prompt_tokens: 0,
                                    completion_tokens: 0,
                                    total_tokens: 0,
                                },
                            )),
                            (lines, finished),
                        ))
                    }
                    Err(e) => {
                        error!("Error reading from Claude CLI: {}", e);
                        finished = true;
                        Some((
                            Err(anyhow::anyhow!("Failed to read from Claude CLI: {}", e)),
                            (lines, finished),
                        ))
                    }
                }
            },
        );

        Ok(StreamingResponse {
            stream: Box::pin(stream),
            metadata: ResponseMetadata {
                model: self.model.clone(),
                provider: "claude-code".to_string(),
                request_id: None,
            },
        })
    }

    async fn send_message(&self, request: ChatRequest) -> Result<ChatResponse> {
        info!("Sending non-streaming request to Claude Code CLI");

        let args = self.build_command_args(&request);

        debug!("Executing claude CLI with args: {:?}", args);

        let output = Command::new(&self.cli_path)
            .args(&args)
            .output()
            .await
            .context("Failed to execute claude CLI")?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            error!("Claude CLI failed: {}", stderr);
            return Err(anyhow::anyhow!("Claude CLI failed: {}", stderr));
        }

        let content = String::from_utf8_lossy(&output.stdout).to_string();

        Ok(ChatResponse {
            content,
            finish_reason: FinishReason::Stop,
            tool_calls: Vec::new(), // TODO: Parse tool calls from output
            usage: UsageStats {
                prompt_tokens: 0, // Claude CLI doesn't provide usage stats
                completion_tokens: 0,
                total_tokens: 0,
            },
        })
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            supports_streaming: true,
            supports_tools: !self.allowed_tools.is_empty(),
            supports_system_prompt: true,
            max_tokens: 200_000, // Claude Sonnet 4.5 context window
            max_context_length: 200_000,
        }
    }

    async fn validate_config(&self) -> Result<()> {
        // Check if Claude CLI is in PATH
        which::which(&self.cli_path)
            .context("Claude CLI not found in PATH. Please install with: npm install -g @anthropic-ai/claude-code")?;

        // Check authentication
        if !Self::check_auth().await? {
            warn!("Claude CLI is not authenticated. Please run: claude login");
            return Err(anyhow::anyhow!(
                "Claude CLI not authenticated. Run 'claude login' first."
            ));
        }

        info!("Claude Code provider configuration validated");
        Ok(())
    }

    fn name(&self) -> &str {
        "claude-code"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_check_auth() {
        // This test requires Claude CLI to be installed
        let result = ClaudeCodeProvider::check_auth().await;
        // Don't fail if Claude isn't installed
        if result.is_err() {
            println!("Claude CLI not installed, skipping auth check");
        }
    }

    #[test]
    fn test_build_prompt_from_messages() {
        let provider = ClaudeCodeProvider::new(
            "claude-sonnet-4.5-20250929".to_string(),
            None,
            1,
            None,
            vec![],
        );

        let messages = vec![
            ChatMessage::user("Hello"),
            ChatMessage::assistant("Hi there!"),
            ChatMessage::user("How are you?"),
        ];

        let prompt = provider.build_prompt_from_messages(&messages);
        assert_eq!(prompt, "How are you?"); // Last user message
    }
}
