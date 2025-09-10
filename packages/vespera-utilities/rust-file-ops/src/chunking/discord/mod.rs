//! Discord-specific chunking functionality
//! 
//! Parses HTML exports from Discord Chat Exporter (Tyrrrz/DiscordChatExporter)
//! and chunks them intelligently for LLM processing.

use crate::error::VesperaError;
use crate::chunking::{DocumentChunk, ChunkingConfig, ChunkMetadata};
use chrono::{DateTime, Utc};
use scraper::{Html, Selector};
use std::collections::HashSet;

/// Parse and chunk a Discord HTML export preserving conversation structure
pub fn chunk_discord_export(
    html_content: &str,
    preserve_conversations: bool,
    max_tokens_per_chunk: usize,
) -> Result<Vec<ConversationChunk>, VesperaError> {
    // Parse the HTML
    let document = Html::parse_document(html_content);
    
    // Extract all messages
    let messages = parse_messages(&document)?;
    
    // Group into conversation chunks
    let chunks = if preserve_conversations {
        group_by_conversation(&messages, max_tokens_per_chunk)?
    } else {
        group_by_size(&messages, max_tokens_per_chunk)?
    };
    
    Ok(chunks)
}

/// Parse individual messages from the HTML document
fn parse_messages(document: &Html) -> Result<Vec<DiscordMessage>, VesperaError> {
    let mut messages = Vec::new();
    
    // Selectors for Discord Chat Exporter format
    let container_selector = Selector::parse(".chatlog__message-container")
        .map_err(|e| VesperaError::InvalidInput { 
            message: format!("Invalid selector: {}", e),
            context: None 
        })?;
    
    let author_selector = Selector::parse(".chatlog__author")
        .map_err(|e| VesperaError::InvalidInput { 
            message: format!("Invalid selector: {}", e),
            context: None 
        })?;
    
    let timestamp_selector = Selector::parse(".chatlog__timestamp")
        .map_err(|e| VesperaError::InvalidInput { 
            message: format!("Invalid selector: {}", e),
            context: None 
        })?;
    
    let content_selector = Selector::parse(".chatlog__content")
        .map_err(|e| VesperaError::InvalidInput { 
            message: format!("Invalid selector: {}", e),
            context: None 
        })?;
    
    // Parse each message container
    for element in document.select(&container_selector) {
        let id = element.value()
            .attr("data-message-id")
            .unwrap_or("unknown")
            .to_string();
        
        let author = element.select(&author_selector)
            .next()
            .map(|e| e.text().collect::<String>())
            .unwrap_or_else(|| "Unknown".to_string());
        
        let timestamp = element.select(&timestamp_selector)
            .next()
            .and_then(|e| e.value().attr("title"))
            .unwrap_or("Unknown time")
            .to_string();
        
        let content = element.select(&content_selector)
            .next()
            .map(|e| e.text().collect::<String>())
            .unwrap_or_default();
        
        // Check for reply
        let reply_to = element.select(&Selector::parse(".chatlog__reply").unwrap())
            .next()
            .and_then(|_| {
                element.select(&Selector::parse(".chatlog__reply-link").unwrap())
                    .next()
                    .and_then(|e| e.value().attr("onclick"))
                    .and_then(|onclick| {
                        // Extract message ID from onclick="scrollToMessage(event, 'ID')"
                        onclick.split('\'')
                            .nth(1)
                            .map(|s| s.to_string())
                    })
            });
        
        messages.push(DiscordMessage {
            id,
            author,
            timestamp,
            content,
            attachments: vec![], // TODO: Parse attachments
            reply_to,
        });
    }
    
    Ok(messages)
}

/// Group messages by conversation boundaries
fn group_by_conversation(
    messages: &[DiscordMessage],
    max_tokens: usize,
) -> Result<Vec<ConversationChunk>, VesperaError> {
    let mut chunks = Vec::new();
    let mut current_messages = Vec::new();
    let mut current_size = 0;
    let mut participants = HashSet::new();
    
    for (i, message) in messages.iter().enumerate() {
        // Estimate tokens (rough: 1 token ≈ 4 characters)
        let message_size = message.content.len() / 4;
        
        // Check for conversation break
        let is_break = if i > 0 {
            // Time gap detection would go here if we had parsed timestamps
            // For now, use simple heuristics
            current_size + message_size > max_tokens
        } else {
            false
        };
        
        if is_break && !current_messages.is_empty() {
            // Save current chunk
            let chunk = ConversationChunk {
                messages: current_messages.clone(),
                participants: participants.iter().cloned().collect(),
                time_range: (
                    current_messages.first().unwrap().timestamp.clone(),
                    current_messages.last().unwrap().timestamp.clone(),
                ),
                detected_topics: vec![], // TODO: Topic detection
                continuation_context: None,
            };
            chunks.push(chunk);
            
            // Reset for next chunk
            current_messages.clear();
            participants.clear();
            current_size = 0;
        }
        
        // Add message to current chunk
        current_messages.push(message.clone());
        participants.insert(message.author.clone());
        current_size += message_size;
    }
    
    // Add final chunk
    if !current_messages.is_empty() {
        chunks.push(ConversationChunk {
            messages: current_messages.clone(),
            participants: participants.iter().cloned().collect(),
            time_range: (
                current_messages.first().unwrap().timestamp.clone(),
                current_messages.last().unwrap().timestamp.clone(),
            ),
            detected_topics: vec![],
            continuation_context: None,
        });
    }
    
    Ok(chunks)
}

/// Simple size-based grouping
fn group_by_size(
    messages: &[DiscordMessage],
    max_tokens: usize,
) -> Result<Vec<ConversationChunk>, VesperaError> {
    // Simplified implementation - just use conversation grouping for now
    group_by_conversation(messages, max_tokens)
}

/// Parse Discord HTML exports into structured data
pub fn parse_discord_html(_path: &str) -> Result<DiscordChatLog, VesperaError> {
    todo!("Discord HTML parsing implementation")
}

/// A chunk of Discord conversation
#[derive(Debug, Clone)]
pub struct ConversationChunk {
    pub messages: Vec<DiscordMessage>,
    pub participants: Vec<String>,
    pub time_range: (String, String), // Simplified for now
    pub detected_topics: Vec<String>,
    pub continuation_context: Option<String>,
}

/// Structured Discord chat log
#[derive(Debug, Clone)]
pub struct DiscordChatLog {
    pub messages: Vec<DiscordMessage>,
    pub participants: Vec<String>,
    pub date_range: (String, String),
    pub total_messages: usize,
}

/// A single Discord message
#[derive(Debug, Clone)]
pub struct DiscordMessage {
    pub id: String,
    pub author: String,
    pub timestamp: String,
    pub content: String,
    pub attachments: Vec<String>,
    pub reply_to: Option<String>,
}