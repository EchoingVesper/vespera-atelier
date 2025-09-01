//! High-performance text search and pattern matching
//! 
//! Provides blazingly fast text search capabilities using ripgrep-style
//! algorithms with support for regex, glob patterns, and parallel processing.

pub mod text;
pub mod glob;

pub use text::TextSearcher;
pub use glob::GlobMatcher;