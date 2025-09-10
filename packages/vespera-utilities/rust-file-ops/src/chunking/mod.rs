//! Document chunking module for intelligent text segmentation
//! 
//! This module provides various strategies for breaking large documents
//! into smaller, manageable chunks suitable for LLM processing.

pub mod config;
pub mod processor;
pub mod strategies;
pub mod discord;
pub mod llm;

pub use config::{ChunkingConfig, ChunkStrategy, DocumentFormat};
pub use processor::{ChunkProcessor, DocumentChunk, ChunkMetadata};

// Re-export common functionality
pub use strategies::chunk_document;
pub use discord::{chunk_discord_export, parse_discord_html};