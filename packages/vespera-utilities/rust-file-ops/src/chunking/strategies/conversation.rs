//! Conversation break detection for chat logs

use crate::chunking::{ChunkingConfig, DocumentChunk, ChunkMetadata};
use crate::error::VesperaError;
use super::ChunkingStrategy;
use chrono::{DateTime, Duration, Utc};
use regex::Regex;
use uuid::Uuid;

/// Detects natural conversation boundaries in chat logs
pub struct ConversationBreakChunker {
    config: ChunkingConfig,
    time_gap_minutes: i64,
}

impl ConversationBreakChunker {
    pub fn new(config: &ChunkingConfig) -> Self {
        Self {
            config: config.clone(),
            time_gap_minutes: 5, // Default 5-minute gap indicates new conversation
        }
    }
    
    /// Parse a Discord-style timestamp
    fn parse_timestamp(&self, line: &str) -> Option<DateTime<Utc>> {
        // Common Discord timestamp formats:
        // [2024-01-15 10:30:45]
        // 2024-01-15T10:30:45Z
        // Today at 10:30 AM
        
        // Try ISO format first
        if let Ok(dt) = DateTime::parse_from_rfc3339(line) {
            return Some(dt.with_timezone(&Utc));
        }
        
        // Try bracket format [YYYY-MM-DD HH:MM:SS]
        let bracket_re = Regex::new(r"\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]").ok()?;
        if let Some(caps) = bracket_re.captures(line) {
            if let Some(_timestamp_str) = caps.get(1) {
                // Parse the timestamp (would need proper parsing here)
                // For now, return None to keep it simple
                return None;
            }
        }
        
        None
    }
    
    /// Detect if there's a conversation break between two messages
    fn is_conversation_break(&self, prev_line: &str, curr_line: &str) -> bool {
        // Check for time gap
        if let (Some(prev_time), Some(curr_time)) = 
            (self.parse_timestamp(prev_line), self.parse_timestamp(curr_line)) {
            let gap = curr_time - prev_time;
            if gap > Duration::minutes(self.time_gap_minutes) {
                return true;
            }
        }
        
        // Check for topic shift indicators
        let topic_indicators = [
            "anyway", "so", "btw", "by the way", "changing topic",
            "different note", "unrelated", "back to", "regarding",
        ];
        
        let curr_lower = curr_line.to_lowercase();
        for indicator in &topic_indicators {
            if curr_lower.starts_with(indicator) || 
               curr_lower.contains(&format!(" {} ", indicator)) {
                return true;
            }
        }
        
        // Check for participant change pattern (simplified)
        // In real implementation, would track participants more carefully
        
        false
    }
    
    /// Extract participant name from a message line
    fn extract_participant(&self, line: &str) -> Option<String> {
        // Discord format: "Username: message content"
        // Or: "[Timestamp] Username: message"
        
        // Simple extraction - find first colon
        if let Some(colon_pos) = line.find(':') {
            let prefix = &line[..colon_pos];
            
            // Remove timestamp if present
            let name_part = if prefix.starts_with('[') {
                if let Some(bracket_end) = prefix.find(']') {
                    prefix[bracket_end + 1..].trim()
                } else {
                    prefix.trim()
                }
            } else {
                prefix.trim()
            };
            
            if !name_part.is_empty() && name_part.len() < 50 {
                return Some(name_part.to_string());
            }
        }
        
        None
    }
}

impl ChunkingStrategy for ConversationBreakChunker {
    fn chunk(&self, content: &str) -> Result<Vec<DocumentChunk>, VesperaError> {
        let lines: Vec<&str> = content.lines().collect();
        let mut chunks = Vec::new();
        let mut current_chunk_lines = Vec::new();
        let mut current_participants = std::collections::HashSet::new();
        let mut chunk_start_byte = 0;
        let mut chunk_index = 0;
        let mut current_byte_pos = 0;
        
        for i in 0..lines.len() {
            let line = lines[i];
            let line_bytes = line.len() + 1; // +1 for newline
            
            // Check for conversation break
            let is_break = if i > 0 && !current_chunk_lines.is_empty() {
                // Check if we exceed max size
                let current_size: usize = current_chunk_lines.iter()
                    .map(|l: &&str| l.len() + 1)
                    .sum();
                
                if current_size > self.config.max_chunk_size {
                    true
                } else {
                    self.is_conversation_break(lines[i - 1], line)
                }
            } else {
                false
            };
            
            if is_break && !current_chunk_lines.is_empty() {
                // Save current chunk
                let chunk_content = current_chunk_lines.join("\n");
                let participants: Vec<String> = current_participants.iter().cloned().collect();
                
                chunks.push(DocumentChunk {
                    id: Uuid::new_v4().to_string(),
                    content: chunk_content,
                    metadata: ChunkMetadata {
                        source_file: String::new(),
                        chunk_index,
                        total_chunks: 0, // Will be updated
                        byte_range: (chunk_start_byte, current_byte_pos),
                        char_range: (0, 0),
                        timestamp_range: None, // Could be extracted from messages
                        participants,
                        topics: vec![], // Could be extracted with NLP
                        parent_chunk: None,
                        child_chunks: vec![],
                    },
                    embeddings: None,
                });
                
                chunk_index += 1;
                current_chunk_lines.clear();
                current_participants.clear();
                chunk_start_byte = current_byte_pos;
            }
            
            // Add line to current chunk
            current_chunk_lines.push(line);
            
            // Track participant
            if let Some(participant) = self.extract_participant(line) {
                current_participants.insert(participant);
            }
            
            current_byte_pos += line_bytes;
        }
        
        // Save final chunk
        if !current_chunk_lines.is_empty() {
            let chunk_content = current_chunk_lines.join("\n");
            let participants: Vec<String> = current_participants.iter().cloned().collect();
            
            chunks.push(DocumentChunk {
                id: Uuid::new_v4().to_string(),
                content: chunk_content,
                metadata: ChunkMetadata {
                    source_file: String::new(),
                    chunk_index,
                    total_chunks: 0,
                    byte_range: (chunk_start_byte, content.len()),
                    char_range: (0, 0),
                    timestamp_range: None,
                    participants,
                    topics: vec![],
                    parent_chunk: None,
                    child_chunks: vec![],
                },
                embeddings: None,
            });
        }
        
        // Update total chunks
        let total = chunks.len();
        for chunk in &mut chunks {
            chunk.metadata.total_chunks = total;
        }
        
        Ok(chunks)
    }
    
    fn find_boundaries(&self, content: &str) -> Vec<usize> {
        let lines: Vec<&str> = content.lines().collect();
        let mut boundaries = Vec::new();
        let mut byte_pos = 0;
        
        for i in 1..lines.len() {
            byte_pos += lines[i - 1].len() + 1; // +1 for newline
            
            if self.is_conversation_break(lines[i - 1], lines[i]) {
                boundaries.push(byte_pos);
            }
        }
        
        boundaries.push(content.len());
        boundaries
    }
    
    fn apply_overlap(&self, chunks: &mut Vec<DocumentChunk>, _original: &str) {
        // For conversation chunks, overlap means including context from previous conversation
        if chunks.len() <= 1 || self.config.overlap_size == 0 {
            return;
        }
        
        for i in 1..chunks.len() {
            let prev_participants = chunks[i - 1].metadata.participants.clone();
            let prev_last_lines: Vec<&str> = chunks[i - 1].content
                .lines()
                .rev()
                .take(3) // Take last 3 messages as context
                .collect::<Vec<_>>()
                .into_iter()
                .rev()
                .collect();
            
            if !prev_last_lines.is_empty() {
                let context = format!("[Context from previous conversation:]\n{}\n[Continuing:]\n", 
                                    prev_last_lines.join("\n"));
                chunks[i].content = format!("{}{}", context, chunks[i].content);
                
                // Merge participant lists
                for participant in prev_participants {
                    if !chunks[i].metadata.participants.contains(&participant) {
                        chunks[i].metadata.participants.push(participant);
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_participant_extraction() {
        let config = ChunkingConfig::default();
        let chunker = ConversationBreakChunker::new(&config);
        
        assert_eq!(
            chunker.extract_participant("Alice: Hello there!"),
            Some("Alice".to_string())
        );
        
        assert_eq!(
            chunker.extract_participant("[2024-01-15 10:30:45] Bob: How are you?"),
            Some("Bob".to_string())
        );
        
        assert_eq!(
            chunker.extract_participant("This is just a message without a sender"),
            None
        );
    }
    
    #[test]
    fn test_conversation_break_detection() {
        let config = ChunkingConfig::default();
        let chunker = ConversationBreakChunker::new(&config);
        
        // Topic change indicator
        assert!(chunker.is_conversation_break(
            "Alice: That sounds great!",
            "Bob: Anyway, about that other thing..."
        ));
        
        // No break for continuous conversation
        assert!(!chunker.is_conversation_break(
            "Alice: What do you think?",
            "Bob: I think it's a good idea."
        ));
    }
    
    #[test]
    fn test_conversation_chunking() {
        let config = ChunkingConfig {
            max_chunk_size: 100,
            overlap_size: 20,
            chunk_strategy: crate::chunking::ChunkStrategy::ConversationBreak,
            ..Default::default()
        };
        
        let chunker = ConversationBreakChunker::new(&config);
        
        let content = "Alice: Hello!\n\
                      Bob: Hi Alice!\n\
                      Alice: How are you today?\n\
                      Bob: I'm doing well, thanks!\n\
                      Alice: That's great to hear.\n\
                      Bob: Anyway, about the project...\n\
                      Alice: Yes, what about it?\n\
                      Bob: I think we need to revise the plan.";
        
        let chunks = chunker.chunk(content).unwrap();
        
        assert!(chunks.len() >= 1);
        
        // Check that participants are tracked
        for chunk in &chunks {
            assert!(!chunk.metadata.participants.is_empty());
        }
    }
}