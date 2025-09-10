//! Edit operations module
//!
//! This module contains the core editing functionality including:
//! - String matching and pattern finding
//! - Single and multi-edit operations
//! - Text manipulation utilities
//!
//! The module is organized to support both simple single-file editing
//! and complex multi-operation editing workflows.

pub mod matcher;
pub mod single;
pub mod multi;

// Re-export key types for convenience
pub use matcher::{Match, MatchConfig, StringMatcher};
pub use single::{SingleEditor, replace_string, replace_first, replace_all};
pub use multi::{
    MultiEditor, OperationAnalysis, OperationConflict, ConflictType,
    apply_multiple_edits,
};