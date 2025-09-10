//! Integration tests for Discord HTML chunking
//! 
//! These tests work with real Discord HTML exports to verify the chunking
//! functionality works correctly with actual data.

use vespera_file_ops::chunking::discord::{chunk_discord_export, parse_discord_html};
use std::fs;
use std::path::Path;

/// Test with a real Discord HTML export file
#[test]
#[ignore] // Use `cargo test -- --ignored` to run this test
fn test_real_discord_export() {
    // Path to Discord logs - adjust as needed
    let log_dir = Path::new("/home/aya/Projects/discord-chat-logs");
    
    if !log_dir.exists() {
        eprintln!("Discord logs directory not found at {:?}", log_dir);
        eprintln!("Skipping test - place Discord HTML exports in the directory to test");
        return;
    }
    
    // Find the smallest HTML file for quick testing
    let mut html_files: Vec<_> = fs::read_dir(log_dir)
        .expect("Failed to read directory")
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            entry.path().extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| ext.eq_ignore_ascii_case("html"))
                .unwrap_or(false)
        })
        .collect();
    
    if html_files.is_empty() {
        eprintln!("No HTML files found in {:?}", log_dir);
        return;
    }
    
    // Sort by size and take the smallest
    html_files.sort_by_key(|entry| {
        entry.metadata().map(|m| m.len()).unwrap_or(u64::MAX)
    });
    
    let test_file = &html_files[0];
    let file_path = test_file.path();
    let file_size = test_file.metadata().unwrap().len();
    
    println!("Testing with file: {:?} ({:.2} MB)", 
             file_path.file_name().unwrap(),
             file_size as f64 / 1024.0 / 1024.0);
    
    // Read and parse the file
    let html_content = fs::read_to_string(&file_path)
        .expect("Failed to read HTML file");
    
    // Test parsing
    let chat_log = parse_discord_html(file_path.to_str().unwrap())
        .expect("Failed to parse Discord HTML");
    
    println!("Parsed {} messages", chat_log.total_messages);
    println!("Participants: {:?}", chat_log.participants);
    println!("Date range: {} to {}", 
             chat_log.date_range.0.format("%Y-%m-%d"),
             chat_log.date_range.1.format("%Y-%m-%d"));
    
    assert!(chat_log.total_messages > 0, "Should parse at least one message");
    assert!(!chat_log.participants.is_empty(), "Should have at least one participant");
    
    // Test chunking
    let chunks = chunk_discord_export(&html_content, true, 2000)
        .expect("Failed to chunk Discord export");
    
    println!("Created {} chunks", chunks.len());
    
    assert!(!chunks.is_empty(), "Should create at least one chunk");
    
    // Verify chunk properties
    for (i, chunk) in chunks.iter().enumerate() {
        println!("Chunk {}: {} messages, {} participants, topics: {:?}",
                 i + 1,
                 chunk.messages.len(),
                 chunk.participants.len(),
                 chunk.detected_topics);
        
        assert!(!chunk.messages.is_empty(), "Chunk should have messages");
        assert!(!chunk.participants.is_empty(), "Chunk should have participants");
        
        // Verify time range makes sense
        assert!(chunk.time_range.1 >= chunk.time_range.0, 
                "End time should be after start time");
    }
    
    // Verify all messages are accounted for
    let total_chunked_messages: usize = chunks.iter()
        .map(|c| c.messages.len())
        .sum();
    
    println!("Total messages in chunks: {}", total_chunked_messages);
    println!("Original message count: {}", chat_log.messages.len());
    
    assert_eq!(total_chunked_messages, chat_log.messages.len(),
               "All messages should be in chunks");
}

/// Test conversation boundary detection
#[test]
#[ignore]
fn test_conversation_boundaries() {
    let log_dir = Path::new("/home/aya/Projects/discord-chat-logs");
    if !log_dir.exists() {
        return;
    }
    
    // Find a file
    let html_file = fs::read_dir(log_dir)
        .unwrap()
        .filter_map(|e| e.ok())
        .find(|e| e.path().extension().map_or(false, |ext| ext == "html"))
        .expect("No HTML files found");
    
    let html_content = fs::read_to_string(html_file.path())
        .expect("Failed to read file");
    
    // Test with different token limits to see how chunking behaves
    let token_limits = [500, 1000, 2000, 4000];
    
    for limit in &token_limits {
        let chunks = chunk_discord_export(&html_content, true, *limit)
            .expect("Failed to chunk");
        
        println!("With {} token limit: {} chunks", limit, chunks.len());
        
        // Analyze chunk sizes
        let avg_messages: f64 = chunks.iter()
            .map(|c| c.messages.len() as f64)
            .sum::<f64>() / chunks.len() as f64;
        
        println!("  Average messages per chunk: {:.1}", avg_messages);
        
        // Check for reasonable chunk sizes
        for chunk in &chunks {
            // Estimate tokens
            let estimated_tokens: usize = chunk.messages.iter()
                .map(|m| m.content.len() / 4) // Rough estimate
                .sum();
            
            // Should not significantly exceed limit (allow 20% overflow for message integrity)
            assert!(estimated_tokens <= limit * 120 / 100,
                    "Chunk exceeds token limit by too much");
        }
    }
}

/// Test topic detection
#[test]
#[ignore]
fn test_topic_detection() {
    let log_dir = Path::new("/home/aya/Projects/discord-chat-logs");
    if !log_dir.exists() {
        return;
    }
    
    let html_file = fs::read_dir(log_dir)
        .unwrap()
        .filter_map(|e| e.ok())
        .find(|e| e.path().extension().map_or(false, |ext| ext == "html"))
        .expect("No HTML files found");
    
    let html_content = fs::read_to_string(html_file.path())
        .expect("Failed to read file");
    
    let chunks = chunk_discord_export(&html_content, true, 2000)
        .expect("Failed to chunk");
    
    // Count topic occurrences
    let mut topic_counts = std::collections::HashMap::new();
    for chunk in &chunks {
        for topic in &chunk.detected_topics {
            *topic_counts.entry(topic.clone()).or_insert(0) += 1;
        }
    }
    
    println!("Topic distribution:");
    for (topic, count) in topic_counts.iter() {
        println!("  {}: {} chunks", topic, count);
    }
    
    // Every chunk should have at least one topic
    for chunk in &chunks {
        assert!(!chunk.detected_topics.is_empty(),
                "Every chunk should have at least one topic");
    }
}

/// Test with a small sample HTML to verify parsing works
#[test]
fn test_sample_discord_html() {
    // Create a minimal Discord HTML structure for testing
    let sample_html = r#"
    <!DOCTYPE html>
    <html>
    <body>
        <div class="chatlog__message-group">
            <div id="chatlog__message-container-123" class="chatlog__message-container" data-message-id="123">
                <div class="chatlog__message">
                    <div class="chatlog__message-primary">
                        <div class="chatlog__header">
                            <span class="chatlog__author" data-user-id="456">TestUser</span>
                            <span class="chatlog__timestamp" title="Friday, December 15, 2023 10:30:00 AM">
                                12/15/2023 10:30 AM
                            </span>
                        </div>
                        <div class="chatlog__content">
                            This is a test message about our story project.
                        </div>
                    </div>
                </div>
            </div>
            <div id="chatlog__message-container-124" class="chatlog__message-container" data-message-id="124">
                <div class="chatlog__message">
                    <div class="chatlog__message-primary">
                        <div class="chatlog__header">
                            <span class="chatlog__author" data-user-id="789">AnotherUser</span>
                            <span class="chatlog__timestamp" title="Friday, December 15, 2023 10:31:00 AM">
                                12/15/2023 10:31 AM
                            </span>
                        </div>
                        <div class="chatlog__content">
                            Yes, let's discuss the character development!
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
    "#;
    
    // Test chunking
    let chunks = chunk_discord_export(sample_html, true, 100)
        .expect("Failed to chunk sample HTML");
    
    assert_eq!(chunks.len(), 1, "Should create one chunk for small sample");
    assert_eq!(chunks[0].messages.len(), 2, "Should have 2 messages");
    assert_eq!(chunks[0].participants.len(), 2, "Should have 2 participants");
    
    // Check message content
    assert!(chunks[0].messages[0].content.contains("test message"));
    assert!(chunks[0].messages[1].content.contains("character development"));
    
    // Check topic detection
    assert!(chunks[0].detected_topics.contains(&"Work".to_string()) ||
            chunks[0].detected_topics.contains(&"General".to_string()));
}