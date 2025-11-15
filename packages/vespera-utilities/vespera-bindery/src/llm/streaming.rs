//! Streaming response types for real-time LLM output

use super::types::{FinishReason, ToolCall, UsageStats};
use futures::Stream;
use serde::{Deserialize, Serialize};
use std::pin::Pin;

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
