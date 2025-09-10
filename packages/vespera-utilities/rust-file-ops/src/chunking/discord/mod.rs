//! Discord-specific chunking functionality
//! 
//! Parses HTML exports from Discord Chat Exporter (Tyrrrz/DiscordChatExporter)
//! and chunks them intelligently for LLM processing.

use crate::error::VesperaError;
use chrono::{DateTime, Utc, NaiveDateTime};
use scraper::{Html, Selector, ElementRef};
use std::collections::HashSet;
use serde::{Deserialize, Serialize};

pub mod examples;

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
    
    let attachment_selector = Selector::parse(".chatlog__attachment")
        .map_err(|e| VesperaError::InvalidInput { 
            message: format!("Invalid selector: {}", e),
            context: None 
        })?;
    
    let system_selector = Selector::parse(".chatlog__system-notification-content")
        .map_err(|e| VesperaError::InvalidInput { 
            message: format!("Invalid selector: {}", e),
            context: None 
        })?;
    
    let reactions_selector = Selector::parse(".chatlog__reactions")
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
        
        // Determine message type
        let message_type = if element.select(&system_selector).next().is_some() {
            MessageType::System
        } else if element.select(&Selector::parse(".chatlog__reply").unwrap()).next().is_some() {
            MessageType::Reply
        } else {
            MessageType::Regular
        };
        
        // Parse author - system messages don't have authors in the same way
        let author = if message_type == MessageType::System {
            "System".to_string()
        } else {
            element.select(&author_selector)
                .next()
                .map(|e| e.text().collect::<String>().trim().to_string())
                .unwrap_or_else(|| "Unknown".to_string())
        };
        
        // Parse timestamp
        let timestamp_raw = element.select(&timestamp_selector)
            .next()
            .and_then(|e| e.value().attr("title"))
            .unwrap_or("Unknown time")
            .to_string();
        
        let timestamp = parse_discord_timestamp(&timestamp_raw)?;
        
        // Parse content
        let content = if message_type == MessageType::System {
            element.select(&system_selector)
                .next()
                .map(|e| e.text().collect::<String>().trim().to_string())
                .unwrap_or_default()
        } else {
            element.select(&content_selector)
                .next()
                .map(|e| e.text().collect::<String>().trim().to_string())
                .unwrap_or_default()
        };
        
        // Parse attachments
        let attachments = parse_attachments(&element, &attachment_selector)?;
        
        // Parse reactions
        let reactions = parse_reactions(&element, &reactions_selector)?;
        
        // Check for reply
        let reply_to = if message_type == MessageType::Reply {
            element.select(&Selector::parse(".chatlog__reply-link").unwrap())
                .next()
                .and_then(|e| e.value().attr("onclick"))
                .and_then(|onclick| {
                    // Extract message ID from onclick="scrollToMessage(event, 'ID')"
                    onclick.split('\'')
                        .nth(1)
                        .map(|s| s.to_string())
                })
        } else {
            None
        };
        
        messages.push(DiscordMessage {
            id,
            author,
            timestamp,
            timestamp_raw,
            content,
            attachments,
            reactions,
            reply_to,
            message_type,
        });
    }
    
    Ok(messages)
}

/// Parse Discord timestamp format: "Monday, September 23, 2024 5:39 AM"
fn parse_discord_timestamp(timestamp_str: &str) -> Result<DateTime<Utc>, VesperaError> {
    // Discord Chat Exporter format variations we've seen:
    // "Monday, September 23, 2024 5:39 AM" (2024 format with day name, no seconds)
    // "Friday, September 10, 2021 2:48:25 PM" (older format with seconds)
    let formats = [
        "%A, %B %d, %Y %I:%M %p",        // Monday, September 23, 2024 5:39 AM (no seconds)
        "%A, %B %d, %Y %I:%M:%S %p",     // Friday, September 10, 2021 2:48:25 PM (with seconds)
        "%B %d, %Y %I:%M %p",            // September 23, 2024 5:39 AM (no day name, no seconds)
        "%B %d, %Y %I:%M:%S %p",         // September 10, 2021 2:48:25 PM (no day name)
        "%m/%d/%Y %I:%M:%S %p",          // US numeric format
        "%Y-%m-%d %H:%M:%S",             // ISO-like format
        "%Y-%m-%dT%H:%M:%S%.fZ",         // Full ISO format
    ];
    
    for format in &formats {
        if let Ok(naive_dt) = NaiveDateTime::parse_from_str(timestamp_str, format) {
            return Ok(DateTime::from_naive_utc_and_offset(naive_dt, Utc));
        }
    }
    
    // If all parsing fails, return a default timestamp (Unix epoch) and log the error
    eprintln!("Warning: Failed to parse timestamp '{}', using default", timestamp_str);
    Ok(DateTime::from_timestamp(0, 0).unwrap())
}

/// Parse attachments from a message element
fn parse_attachments(element: &ElementRef, attachment_selector: &Selector) -> Result<Vec<Attachment>, VesperaError> {
    let mut attachments = Vec::new();
    
    for attachment_element in element.select(attachment_selector) {
        // Try to get filename from various possible locations
        let filename = attachment_element
            .select(&Selector::parse(".chatlog__attachment-name").unwrap())
            .next()
            .map(|e| e.text().collect::<String>())
            .or_else(|| {
                attachment_element.value().attr("title").map(|s| s.to_string())
            })
            .or_else(|| {
                attachment_element.select(&Selector::parse("a").unwrap())
                    .next()
                    .and_then(|e| e.value().attr("download"))
                    .map(|s| s.to_string())
            })
            .unwrap_or_else(|| "unknown_attachment".to_string());
        
        // Get URL from link or src attribute
        let url = attachment_element
            .select(&Selector::parse("a").unwrap())
            .next()
            .and_then(|e| e.value().attr("href"))
            .or_else(|| attachment_element.value().attr("src"))
            .unwrap_or("")
            .to_string();
        
        // Try to determine file type from filename or URL
        let file_type = filename.split('.').last()
            .map(|ext| ext.to_lowercase())
            .filter(|ext| !ext.is_empty());
        
        // Look for file size information
        let size = attachment_element
            .select(&Selector::parse(".chatlog__attachment-size").unwrap())
            .next()
            .map(|e| e.text().collect::<String>());
        
        attachments.push(Attachment {
            filename,
            url,
            file_type,
            size,
        });
    }
    
    Ok(attachments)
}

/// Parse reactions from a message element
fn parse_reactions(element: &ElementRef, reactions_selector: &Selector) -> Result<Vec<Reaction>, VesperaError> {
    let mut reactions = Vec::new();
    
    for reactions_container in element.select(reactions_selector) {
        // Each reaction is typically in a .chatlog__reaction element
        let reaction_selector = Selector::parse(".chatlog__reaction")
            .map_err(|e| VesperaError::InvalidInput { 
                message: format!("Invalid reaction selector: {}", e),
                context: None 
            })?;
        
        for reaction_element in reactions_container.select(&reaction_selector) {
            // Get emoji (usually in an img tag or as text)
            let emoji = reaction_element
                .select(&Selector::parse("img").unwrap())
                .next()
                .and_then(|img| img.value().attr("alt"))
                .map(|s| s.to_string())
                .unwrap_or_else(|| {
                    // Fallback to text content for Unicode emojis
                    let text = reaction_element.text().collect::<String>();
                    let trimmed = text.trim();
                    if trimmed.is_empty() { 
                        "❓".to_string()
                    } else { 
                        trimmed.to_string()
                    }
                });
            
            // Get count from the reaction element
            let count_text = reaction_element.text().collect::<String>();
            let count = count_text
                .chars()
                .filter(|c| c.is_ascii_digit())
                .collect::<String>()
                .parse::<usize>()
                .unwrap_or(1);
            
            // For now, we can't easily extract individual users from the HTML,
            // so we'll leave this empty. In a full implementation, you might
            // need to parse tooltip data or make additional API calls.
            let users = Vec::new();
            
            reactions.push(Reaction {
                emoji,
                count,
                users,
            });
        }
    }
    
    Ok(reactions)
}

/// Group messages by conversation boundaries
fn group_by_conversation(
    messages: &[DiscordMessage],
    max_tokens: usize,
) -> Result<Vec<ConversationChunk>, VesperaError> {
    if messages.is_empty() {
        return Ok(vec![]);
    }
    
    let mut chunks = Vec::new();
    let mut current_messages = Vec::new();
    let mut current_size = 0;
    let mut participants = HashSet::new();
    
    // Time gap threshold for conversation breaks (15 minutes)
    let time_gap_threshold = chrono::Duration::minutes(15);
    
    for (i, message) in messages.iter().enumerate() {
        // Estimate tokens (rough: 1 token ≈ 4 characters)
        let message_size = estimate_message_tokens(message);
        
        // Check for conversation break
        let is_break = if i > 0 && !current_messages.is_empty() {
            let last_message: &DiscordMessage = current_messages.last().unwrap();
            let time_gap = message.timestamp.signed_duration_since(last_message.timestamp);
            
            // Break on: size limit exceeded, large time gap, or topic shift
            current_size + message_size > max_tokens ||
            time_gap > time_gap_threshold ||
            is_topic_shift(last_message, message)
        } else {
            false
        };
        
        if is_break && !current_messages.is_empty() {
            // Save current chunk
            let chunk = ConversationChunk {
                messages: current_messages.clone(),
                participants: participants.iter().cloned().collect(),
                time_range: (
                    current_messages.first().unwrap().timestamp,
                    current_messages.last().unwrap().timestamp,
                ),
                detected_topics: detect_topics(&current_messages),
                continuation_context: generate_continuation_context(&current_messages),
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
                current_messages.first().unwrap().timestamp,
                current_messages.last().unwrap().timestamp,
            ),
            detected_topics: detect_topics(&current_messages),
            continuation_context: generate_continuation_context(&current_messages),
        });
    }
    
    Ok(chunks)
}

/// Estimate token count for a message (including metadata)
fn estimate_message_tokens(message: &DiscordMessage) -> usize {
    let mut tokens = 0;
    
    // Content tokens (rough: 1 token ≈ 4 characters)
    tokens += message.content.len() / 4;
    
    // Author name
    tokens += message.author.len() / 4;
    
    // Timestamp representation
    tokens += 5; // Rough estimate for timestamp
    
    // Attachments
    for attachment in &message.attachments {
        tokens += attachment.filename.len() / 4 + 10; // Filename + metadata
    }
    
    // Reactions
    tokens += message.reactions.len() * 2; // Rough estimate per reaction
    
    // Reply context
    if message.reply_to.is_some() {
        tokens += 10; // Reply metadata
    }
    
    // System message overhead
    if message.message_type == MessageType::System {
        tokens += 5;
    }
    
    tokens.max(1) // Minimum 1 token per message
}

/// Detect potential topic shifts between messages
fn is_topic_shift(prev_message: &DiscordMessage, current_message: &DiscordMessage) -> bool {
    // Simple heuristics for topic shifts:
    
    // 1. System messages often indicate context changes
    if current_message.message_type == MessageType::System {
        return true;
    }
    
    // 2. Long messages after short ones might be topic changes
    let prev_length = prev_message.content.len();
    let current_length = current_message.content.len();
    if prev_length < 50 && current_length > 200 {
        return true;
    }
    
    // 3. Questions often start new topics
    if current_message.content.trim_start().starts_with('?') ||
       current_message.content.contains("what") ||
       current_message.content.contains("how") ||
       current_message.content.contains("why") ||
       current_message.content.contains("when") ||
       current_message.content.contains("where") {
        return true;
    }
    
    // 4. Attachments might indicate topic changes
    if !current_message.attachments.is_empty() && prev_message.attachments.is_empty() {
        return true;
    }
    
    false
}

/// Basic topic detection for a chunk of messages
fn detect_topics(messages: &[DiscordMessage]) -> Vec<String> {
    let mut topics = Vec::new();
    
    // Combine all text content
    let combined_text: String = messages
        .iter()
        .map(|m| &m.content)
        .filter(|content| !content.is_empty())
        .cloned()
        .collect::<Vec<_>>()
        .join(" ");
    
    // Simple keyword-based topic detection
    let text_lower = combined_text.to_lowercase();
    
    if text_lower.contains("code") || text_lower.contains("programming") || text_lower.contains("bug") {
        topics.push("Programming".to_string());
    }
    if text_lower.contains("meeting") || text_lower.contains("schedule") {
        topics.push("Scheduling".to_string());
    }
    if text_lower.contains("game") || text_lower.contains("play") {
        topics.push("Gaming".to_string());
    }
    if text_lower.contains("music") || text_lower.contains("song") {
        topics.push("Music".to_string());
    }
    if text_lower.contains("work") || text_lower.contains("project") {
        topics.push("Work".to_string());
    }
    
    // Check for attachments indicating media topics
    let has_images = messages.iter().any(|m| {
        m.attachments.iter().any(|a| {
            a.file_type.as_ref().map_or(false, |t| {
                matches!(t.as_str(), "jpg" | "jpeg" | "png" | "gif" | "webp")
            })
        })
    });
    if has_images {
        topics.push("Images/Media".to_string());
    }
    
    if topics.is_empty() {
        topics.push("General".to_string());
    }
    
    topics
}

/// Generate continuation context for chunk transitions
fn generate_continuation_context(messages: &[DiscordMessage]) -> Option<String> {
    if messages.is_empty() {
        return None;
    }
    
    let last_few_messages: Vec<String> = messages
        .iter()
        .rev()
        .take(3)
        .rev()
        .map(|m| format!("{}: {}", m.author, 
            if m.content.len() > 100 { 
                format!("{}...", &m.content[..100])
            } else {
                m.content.clone()
            }
        ))
        .collect();
    
    if last_few_messages.is_empty() {
        None
    } else {
        Some(format!("Previous context:\n{}", last_few_messages.join("\n")))
    }
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
pub fn parse_discord_html(path: &str) -> Result<DiscordChatLog, VesperaError> {
    // Read the HTML file
    let html_content = std::fs::read_to_string(path)
        .map_err(|e| VesperaError::IoError {
            path: path.to_string(),
            operation: "read_file".to_string(),
            source: e,
        })?;
    
    // Parse the HTML
    let document = Html::parse_document(&html_content);
    
    // Extract all messages
    let messages = parse_messages(&document)?;
    
    if messages.is_empty() {
        return Ok(DiscordChatLog {
            messages,
            participants: vec![],
            date_range: (
                DateTime::from_timestamp(0, 0).unwrap(),
                DateTime::from_timestamp(0, 0).unwrap()
            ),
            total_messages: 0,
        });
    }
    
    // Extract participants
    let mut participants: HashSet<String> = messages
        .iter()
        .map(|m| m.author.clone())
        .filter(|author| author != "System")
        .collect();
    
    let participants: Vec<String> = participants.drain().collect();
    
    // Determine date range
    let date_range = (
        messages.first().unwrap().timestamp,
        messages.last().unwrap().timestamp,
    );
    
    let total_messages = messages.len();
    
    Ok(DiscordChatLog {
        messages,
        participants,
        date_range,
        total_messages,
    })
}

/// A chunk of Discord conversation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationChunk {
    pub messages: Vec<DiscordMessage>,
    pub participants: Vec<String>,
    pub time_range: (DateTime<Utc>, DateTime<Utc>),
    pub detected_topics: Vec<String>,
    pub continuation_context: Option<String>,
}

/// Structured Discord chat log
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscordChatLog {
    pub messages: Vec<DiscordMessage>,
    pub participants: Vec<String>,
    pub date_range: (DateTime<Utc>, DateTime<Utc>),
    pub total_messages: usize,
}

/// Message type classification
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MessageType {
    Regular,
    System,
    Reply,
}

/// Discord attachment information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub filename: String,
    pub url: String,
    pub file_type: Option<String>,
    pub size: Option<String>,
}

/// Discord reaction information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reaction {
    pub emoji: String,
    pub count: usize,
    pub users: Vec<String>,
}

/// A single Discord message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscordMessage {
    pub id: String,
    pub author: String,
    pub timestamp: DateTime<Utc>,
    pub timestamp_raw: String, // Original timestamp string for fallback
    pub content: String,
    pub attachments: Vec<Attachment>,
    pub reactions: Vec<Reaction>,
    pub reply_to: Option<String>,
    pub message_type: MessageType,
}