//! Example usage of the Discord parser
//! 
//! This module provides examples of how to use the Discord chunking functionality.

use super::*;
use chrono::{DateTime, Utc};

/// Create a sample Discord message for testing
pub fn create_sample_message(
    id: &str,
    author: &str,
    content: &str,
    timestamp: DateTime<Utc>,
) -> DiscordMessage {
    DiscordMessage {
        id: id.to_string(),
        author: author.to_string(),
        timestamp,
        timestamp_raw: timestamp.format("%A, %B %d, %Y %I:%M:%S %p").to_string(),
        content: content.to_string(),
        attachments: vec![],
        reactions: vec![],
        reply_to: None,
        message_type: MessageType::Regular,
    }
}

/// Create a sample Discord message with attachments
pub fn create_message_with_attachment(
    id: &str,
    author: &str,
    content: &str,
    timestamp: DateTime<Utc>,
    filename: &str,
    url: &str,
) -> DiscordMessage {
    let attachment = Attachment {
        filename: filename.to_string(),
        url: url.to_string(),
        file_type: filename.split('.').last().map(|s| s.to_lowercase()),
        size: Some("1.2 MB".to_string()),
    };

    DiscordMessage {
        id: id.to_string(),
        author: author.to_string(),
        timestamp,
        timestamp_raw: timestamp.format("%A, %B %d, %Y %I:%M:%S %p").to_string(),
        content: content.to_string(),
        attachments: vec![attachment],
        reactions: vec![],
        reply_to: None,
        message_type: MessageType::Regular,
    }
}

/// Create a sample system message
pub fn create_system_message(
    id: &str,
    content: &str,
    timestamp: DateTime<Utc>,
) -> DiscordMessage {
    DiscordMessage {
        id: id.to_string(),
        author: "System".to_string(),
        timestamp,
        timestamp_raw: timestamp.format("%A, %B %d, %Y %I:%M:%S %p").to_string(),
        content: content.to_string(),
        attachments: vec![],
        reactions: vec![],
        reply_to: None,
        message_type: MessageType::System,
    }
}

/// Create a sample reply message
pub fn create_reply_message(
    id: &str,
    author: &str,
    content: &str,
    timestamp: DateTime<Utc>,
    reply_to_id: &str,
) -> DiscordMessage {
    DiscordMessage {
        id: id.to_string(),
        author: author.to_string(),
        timestamp,
        timestamp_raw: timestamp.format("%A, %B %d, %Y %I:%M:%S %p").to_string(),
        content: content.to_string(),
        attachments: vec![],
        reactions: vec![],
        reply_to: Some(reply_to_id.to_string()),
        message_type: MessageType::Reply,
    }
}

/// Example of parsing a simple Discord HTML export
pub fn example_html_content() -> &'static str {
    r#"
<!DOCTYPE html>
<html>
<head>
    <title>Discord Chat Export</title>
</head>
<body>
    <div class="chatlog__message-container" data-message-id="123456789">
        <div class="chatlog__author">Alice</div>
        <div class="chatlog__timestamp" title="Friday, September 10, 2021 2:48:25 PM"></div>
        <div class="chatlog__content">Hello everyone! How's everyone doing today?</div>
    </div>
    
    <div class="chatlog__message-container" data-message-id="123456790">
        <div class="chatlog__author">Bob</div>
        <div class="chatlog__timestamp" title="Friday, September 10, 2021 2:50:15 PM"></div>
        <div class="chatlog__content">Hi Alice! I'm doing great, thanks for asking.</div>
        <div class="chatlog__reactions">
            <div class="chatlog__reaction">👍 2</div>
        </div>
    </div>
    
    <div class="chatlog__message-container" data-message-id="123456791">
        <div class="chatlog__system-notification-content">Alice started a voice call</div>
        <div class="chatlog__timestamp" title="Friday, September 10, 2021 2:52:00 PM"></div>
    </div>
    
    <div class="chatlog__message-container" data-message-id="123456792">
        <div class="chatlog__author">Charlie</div>
        <div class="chatlog__timestamp" title="Friday, September 10, 2021 3:15:30 PM"></div>
        <div class="chatlog__reply">
            <div class="chatlog__reply-link" onclick="scrollToMessage(event, '123456789')">Reply to Alice</div>
        </div>
        <div class="chatlog__content">@Alice That sounds like a great idea!</div>
        <div class="chatlog__attachment">
            <a href="https://discord.com/example.png" download="example.png">
                <div class="chatlog__attachment-name">example.png</div>
                <div class="chatlog__attachment-size">256 KB</div>
            </a>
        </div>
    </div>
</body>
</html>
    "#
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Datelike, Timelike};

    #[test]
    fn test_discord_timestamp_parsing() {
        let timestamp_str = "Friday, September 10, 2021 2:48:25 PM";
        let parsed = parse_discord_timestamp(timestamp_str).unwrap();
        
        // Verify the parsed timestamp makes sense
        assert_eq!(parsed.year(), 2021);
        assert_eq!(parsed.month(), 9);
        assert_eq!(parsed.day(), 10);
        assert_eq!(parsed.hour(), 14); // 2 PM in 24-hour format
        assert_eq!(parsed.minute(), 48);
        assert_eq!(parsed.second(), 25);
    }

    #[test]
    fn test_message_token_estimation() {
        let timestamp = DateTime::from_timestamp(1631286505, 0).unwrap();
        let message = create_sample_message(
            "123",
            "Alice",
            "This is a test message with some content to estimate tokens for.",
            timestamp,
        );
        
        let tokens = estimate_message_tokens(&message);
        assert!(tokens > 0);
        assert!(tokens > 10); // Should be more than just a few tokens
    }

    #[test]
    fn test_sample_html_parsing() {
        let html_content = example_html_content();
        let document = Html::parse_document(html_content);
        let messages = parse_messages(&document).unwrap();
        
        assert!(!messages.is_empty());
        assert_eq!(messages.len(), 4);
        
        // Check first message
        assert_eq!(messages[0].author, "Alice");
        assert_eq!(messages[0].content, "Hello everyone! How's everyone doing today?");
        assert_eq!(messages[0].message_type, MessageType::Regular);
        
        // Check system message
        assert_eq!(messages[2].message_type, MessageType::System);
        assert_eq!(messages[2].content, "Alice started a voice call");
        
        // Check reply message
        assert_eq!(messages[3].message_type, MessageType::Reply);
        assert_eq!(messages[3].reply_to, Some("123456789".to_string()));
        
        // Check reactions
        assert!(!messages[1].reactions.is_empty());
        
        // Check attachments
        assert!(!messages[3].attachments.is_empty());
        assert_eq!(messages[3].attachments[0].filename, "example.png");
    }

    #[test]
    fn test_conversation_chunking() {
        let base_time = DateTime::from_timestamp(1631286505, 0).unwrap();
        let messages = vec![
            create_sample_message("1", "Alice", "Hello!", base_time),
            create_sample_message("2", "Bob", "Hi Alice!", base_time + chrono::Duration::minutes(1)),
            create_sample_message("3", "Charlie", "Hey everyone!", base_time + chrono::Duration::minutes(2)),
            // Long gap - should trigger new chunk
            create_sample_message("4", "Alice", "Anyone there?", base_time + chrono::Duration::hours(1)),
            create_sample_message("5", "Bob", "Yes, I'm here!", base_time + chrono::Duration::hours(1) + chrono::Duration::minutes(1)),
        ];
        
        let chunks = group_by_conversation(&messages, 1000).unwrap();
        
        // Should create multiple chunks due to time gap
        assert!(chunks.len() >= 2);
        
        // First chunk should have first 3 messages
        assert_eq!(chunks[0].messages.len(), 3);
        
        // Check participants
        assert!(chunks[0].participants.contains(&"Alice".to_string()));
        assert!(chunks[0].participants.contains(&"Bob".to_string()));
        assert!(chunks[0].participants.contains(&"Charlie".to_string()));
        
        // Check detected topics
        assert!(!chunks[0].detected_topics.is_empty());
    }
}