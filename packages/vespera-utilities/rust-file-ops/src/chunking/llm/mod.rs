//! LLM integration support for document chunking

use crate::error::VesperaError;
use crate::chunking::DocumentChunk;
use std::collections::HashMap;
use serde::{Deserialize, Serialize};

/// Prepare a chunk for LLM processing
pub fn prepare_for_llm(
    _chunk: &DocumentChunk,
    _context_window: usize,
    _include_metadata: bool,
) -> Result<LLMInput, VesperaError> {
    todo!("LLM preparation implementation")
}

/// Input prepared for LLM processing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMInput {
    pub content: String,
    pub metadata: Option<HashMap<String, String>>,
    pub token_count: usize,
}

/// Session for tracking LLM processing
#[derive(Debug)]
pub struct LLMProcessingSession {
    pub chunks_processed: Vec<String>,
    pub chunks_pending: Vec<String>,
    pub extracted_data: HashMap<String, serde_json::Value>,
}