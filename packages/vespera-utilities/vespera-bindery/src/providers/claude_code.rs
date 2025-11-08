// Claude Code CLI Provider
//
// Spawns Claude Code CLI in non-interactive mode and communicates via stream-json format.
//
// Command: claude code --print --output-format stream-json --verbose
// Protocol: Newline-delimited JSON over stdio
//
// Event types:
// - {"type":"system","subtype":"init"} - Session initialization
// - {"type":"assistant","message":{...}} - Response content
// - {"type":"result","subtype":"success"} - Final result with metrics

use super::{Provider, ProviderResponse, ProviderUsage, StreamChunk};
use anyhow::{anyhow, Context, Result};
use async_trait::async_trait;
use futures::{Stream, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tracing::{debug, error, info, warn};

/// Claude Code CLI provider configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeCodeConfig {
    /// Path to Claude CLI executable
    pub executable_path: String,
    /// Model to use (e.g., claude-sonnet-4)
    pub model: Option<String>,
    /// System prompt override
    pub system_prompt: Option<String>,
    /// Maximum tokens in response
    pub max_tokens: Option<usize>,
    /// Temperature (0.0-1.0)
    pub temperature: Option<f32>,
    /// Request timeout in seconds
    pub timeout: Option<u64>,
}

impl Default for ClaudeCodeConfig {
    fn default() -> Self {
        Self {
            executable_path: "/usr/local/bin/claude".to_string(),
            model: Some("claude-sonnet-4".to_string()),
            system_prompt: None,
            max_tokens: Some(4096),
            temperature: Some(0.7),
            timeout: Some(120),
        }
    }
}

/// Claude Code CLI provider implementation
pub struct ClaudeCodeProvider {
    config: ClaudeCodeConfig,
}

impl ClaudeCodeProvider {
    /// Create a new Claude Code provider with configuration
    pub fn new(config: ClaudeCodeConfig) -> Self {
        Self { config }
    }

    /// Spawn Claude Code CLI process with stream-json output
    fn spawn_process(&self, message: &str, system_prompt: Option<&str>) -> Result<Child> {
        let mut cmd = Command::new(&self.config.executable_path);

        cmd.arg("code")
            .arg("--print")
            .arg("--output-format")
            .arg("stream-json")
            .arg("--verbose");

        // Add model if specified
        if let Some(ref model) = self.config.model {
            cmd.arg("--model").arg(model);
        }

        // Add system prompt if provided
        if let Some(prompt) = system_prompt.or(self.config.system_prompt.as_deref()) {
            cmd.arg("--system-prompt").arg(prompt);
        }

        // Configure stdio
        cmd.stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        debug!(
            "Spawning Claude Code CLI: {} code --print --output-format stream-json --verbose",
            self.config.executable_path
        );

        let mut child = cmd.spawn().context("Failed to spawn Claude Code CLI process")?;

        // Capture and log stderr for debugging
        if let Some(stderr) = child.stderr.take() {
            tokio::spawn(async move {
                let mut reader = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    eprintln!("Debug: Claude CLI stderr: {}", line);
                    warn!("Claude CLI stderr: {}", line);
                }
            });
        }

        // Write message to stdin
        if let Some(mut stdin) = child.stdin.take() {
            let message = message.to_string();
            tokio::spawn(async move {
                if let Err(e) = stdin.write_all(message.as_bytes()).await {
                    error!("Failed to write message to stdin: {}", e);
                }
                if let Err(e) = stdin.shutdown().await {
                    error!("Failed to close stdin: {}", e);
                }
            });
        }

        Ok(child)
    }

    /// Parse stream-json event from Claude Code CLI output
    fn parse_event(line: &str) -> Result<Option<ClaudeCodeEvent>> {
        // Skip the tip message
        if line.starts_with("Tip:") {
            return Ok(None);
        }

        // Skip empty lines
        if line.trim().is_empty() {
            return Ok(None);
        }

        let event: ClaudeCodeEvent = serde_json::from_str(line)
            .with_context(|| {
                eprintln!("Debug: Failed to parse JSON from Claude CLI: {}", line);
                format!("Failed to parse event: {}", line)
            })?;

        Ok(Some(event))
    }

    /// Process stream-json output and extract response
    async fn process_stream(stdout: ChildStdout) -> Result<ProviderResponse> {
        let mut reader = BufReader::new(stdout).lines();
        let mut response_text = String::new();
        let mut session_id: Option<String> = None;
        let mut usage: Option<ProviderUsage> = None;
        let mut metadata = HashMap::new();

        while let Some(line) = reader.next_line().await? {
            eprintln!("Debug: Claude CLI stdout: {}", line);
            if let Some(event) = Self::parse_event(&line)? {
                match event {
                    ClaudeCodeEvent::System { subtype, session_id: sid, .. } => {
                        debug!("System event: {}", subtype);
                        session_id = Some(sid);
                    }
                    ClaudeCodeEvent::Assistant { message, .. } => {
                        // Extract text from assistant message content
                        for content_block in &message.content {
                            if content_block.r#type == "text" {
                                if let Some(text) = &content_block.text {
                                    response_text.push_str(text);
                                }
                            }
                        }
                    }
                    ClaudeCodeEvent::Result {
                        result,
                        total_cost_usd,
                        usage: result_usage,
                        session_id: sid,
                        ..
                    } => {
                        debug!("Final result received");
                        session_id = session_id.or(Some(sid));

                        // Use the result text as final response
                        response_text = result;

                        // Extract usage information
                        usage = Some(ProviderUsage {
                            input_tokens: result_usage.input_tokens,
                            output_tokens: result_usage.output_tokens,
                            cost_usd: Some(total_cost_usd),
                        });

                        metadata.insert("cost_usd".to_string(), serde_json::json!(total_cost_usd));
                        metadata.insert("usage".to_string(), serde_json::to_value(&result_usage)?);
                    }
                }
            }
        }

        Ok(ProviderResponse {
            text: response_text,
            session_id,
            usage,
            metadata,
        })
    }
}

#[async_trait]
impl Provider for ClaudeCodeProvider {
    async fn send_message(
        &self,
        message: &str,
        system_prompt: Option<&str>,
        _stream: bool, // TODO: Implement streaming
    ) -> Result<ProviderResponse> {
        info!("Sending message to Claude Code CLI");

        let mut child = self.spawn_process(message, system_prompt)?;

        // Get stdout for reading response
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| anyhow!("Failed to capture stdout"))?;

        // Process the stream-json output
        let response = Self::process_stream(stdout).await?;

        // Wait for process to complete
        let status = child.wait().await?;
        if !status.success() {
            return Err(anyhow!("Claude Code CLI exited with error: {}", status));
        }

        info!(
            "Received response from Claude Code CLI: {} characters",
            response.text.len()
        );

        Ok(response)
    }

    async fn send_message_stream(
        &self,
        message: &str,
        system_prompt: Option<&str>,
    ) -> Result<Box<dyn Stream<Item = Result<StreamChunk>> + Unpin + Send>> {
        info!("Sending message to Claude Code CLI (streaming)");

        let mut child = self.spawn_process(message, system_prompt)?;

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| anyhow!("Failed to capture stdout"))?;

        let mut lines = BufReader::new(stdout).lines();

        let stream = async_stream::stream! {
            loop {
                match lines.next_line().await {
                    Ok(Some(line)) => {
                        match Self::parse_event(&line) {
                            Ok(Some(event)) => {
                                match Self::event_to_chunk(event) {
                                    Ok(chunk) => yield Ok(chunk),
                                    Err(e) => yield Err(e),
                                }
                            }
                            Ok(None) => {
                                // Skip this line (e.g., "Tip:" message)
                            }
                            Err(e) => {
                                yield Err(e);
                            }
                        }
                    }
                    Ok(None) => break,
                    Err(e) => {
                        yield Err(e.into());
                        break;
                    }
                }
            }
        }
        .boxed();

        Ok(Box::new(stream))
    }

    async fn health_check(&self) -> Result<bool> {
        debug!("Performing health check on Claude Code CLI");

        // Simple ping test
        let test_message = "ping";
        match self.send_message(test_message, None, false).await {
            Ok(_) => {
                info!("Claude Code CLI health check passed");
                Ok(true)
            }
            Err(e) => {
                warn!("Claude Code CLI health check failed: {}", e);
                Ok(false)
            }
        }
    }

    fn provider_type(&self) -> &str {
        "claude-code-cli"
    }

    fn display_name(&self) -> &str {
        "Claude Code CLI"
    }
}

impl ClaudeCodeProvider {
    /// Convert Claude Code event to stream chunk
    fn event_to_chunk(event: ClaudeCodeEvent) -> Result<StreamChunk> {
        match event {
            ClaudeCodeEvent::System { subtype, .. } => Ok(StreamChunk {
                chunk_type: format!("system.{}", subtype),
                text: None,
                is_final: false,
                metadata: None,
            }),
            ClaudeCodeEvent::Assistant { message, .. } => {
                let mut text = String::new();
                for content_block in &message.content {
                    if content_block.r#type == "text" {
                        if let Some(t) = &content_block.text {
                            text.push_str(t);
                        }
                    }
                }
                Ok(StreamChunk {
                    chunk_type: "assistant".to_string(),
                    text: Some(text),
                    is_final: false,
                    metadata: Some(serde_json::to_value(message)?),
                })
            }
            ClaudeCodeEvent::Result { result, .. } => Ok(StreamChunk {
                chunk_type: "result".to_string(),
                text: Some(result),
                is_final: true,
                metadata: None,
            }),
        }
    }
}

// Claude Code CLI event types from stream-json output

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type")]
enum ClaudeCodeEvent {
    #[serde(rename = "system")]
    System {
        subtype: String,
        session_id: String,
        #[serde(flatten)]
        extra: HashMap<String, Value>,
    },
    #[serde(rename = "assistant")]
    Assistant {
        message: AssistantMessage,
        session_id: String,
    },
    #[serde(rename = "result")]
    Result {
        subtype: String,
        result: String,
        session_id: String,
        total_cost_usd: f64,
        usage: ResultUsage,
        #[serde(flatten)]
        extra: HashMap<String, Value>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AssistantMessage {
    content: Vec<ContentBlock>,
    #[serde(flatten)]
    extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ContentBlock {
    r#type: String,
    text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ResultUsage {
    input_tokens: usize,
    output_tokens: usize,
    #[serde(flatten)]
    extra: HashMap<String, Value>,
}
