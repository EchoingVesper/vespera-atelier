//! Type conversions between Phase 17 and PR #85 provider systems
//!
//! This module provides adapters to translate between:
//! - Phase 17: Simple string messages → ProviderResponse
//! - PR #85: Structured ChatRequest → ChatResponse
//!
//! Strategy: Maintain compatibility with Phase 17 while adding PR #85 capabilities

use crate::llm::types::{ChatMessage, ChatRequest, ChatResponse, ChatRole, UsageStats};
use crate::providers::{ProviderResponse, ProviderUsage};
use std::collections::HashMap;

/// Convert Phase 17 message parameters into PR #85 ChatRequest
pub fn phase17_to_chat_request(
    message: &str,
    system_prompt: Option<&str>,
    max_tokens: Option<u32>,
    temperature: Option<f32>,
) -> ChatRequest {
    let mut messages = Vec::new();

    // Add user message
    messages.push(ChatMessage::user(message));

    ChatRequest {
        messages,
        system_prompt: system_prompt.map(|s| s.to_string()),
        tools: Vec::new(), // No tool support in Phase 17 yet
        max_tokens,
        temperature,
        stop_sequences: None,
    }
}

/// Convert PR #85 ChatResponse into Phase 17 ProviderResponse
pub fn chat_response_to_phase17(
    response: ChatResponse,
    session_id: Option<String>,
) -> ProviderResponse {
    let usage = Some(ProviderUsage {
        input_tokens: response.usage.prompt_tokens as usize,
        output_tokens: response.usage.completion_tokens as usize,
        cost_usd: None, // Not tracked yet
    });

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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::llm::types::FinishReason;

    #[test]
    fn test_phase17_to_chat_request_basic() {
        let request = phase17_to_chat_request("Hello", None, None, None);

        assert_eq!(request.messages.len(), 1);
        assert_eq!(request.messages[0].role, ChatRole::User);
        assert_eq!(request.messages[0].content, "Hello");
        assert_eq!(request.system_prompt, None);
        assert_eq!(request.max_tokens, None);
        assert_eq!(request.temperature, None);
    }

    #[test]
    fn test_phase17_to_chat_request_with_system_prompt() {
        let request = phase17_to_chat_request(
            "Hello",
            Some("You are a helpful assistant"),
            Some(100),
            Some(0.7),
        );

        assert_eq!(request.messages.len(), 1);
        assert_eq!(request.system_prompt, Some("You are a helpful assistant".to_string()));
        assert_eq!(request.max_tokens, Some(100));
        assert_eq!(request.temperature, Some(0.7));
    }

    #[test]
    fn test_chat_response_to_phase17() {
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

        let provider_response = chat_response_to_phase17(chat_response, Some("session-123".to_string()));

        assert_eq!(provider_response.text, "Hello there!");
        assert_eq!(provider_response.session_id, Some("session-123".to_string()));
        assert!(provider_response.usage.is_some());

        let usage = provider_response.usage.unwrap();
        assert_eq!(usage.input_tokens, 10);
        assert_eq!(usage.output_tokens, 5);
    }
}
