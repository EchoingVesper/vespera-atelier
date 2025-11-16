//! Provider Adapters
//!
//! This module provides adapters to bridge between Phase 17 and PR #85 provider systems,
//! allowing both to coexist without breaking existing Phase 17 functionality.
//!
//! ## Architecture
//!
//! - **Phase 17**: Working provider system in `src/providers/` (KEEP)
//! - **PR #85**: Improved abstractions in `src/llm/` (EXTRACT then DELETE)
//! - **Adapters**: Translation layer for gradual migration
//!
//! ## Usage
//!
//! ```rust,ignore
//! use crate::providers::adapters::LlmProviderAdapter;
//! use crate::llm::provider::LlmProvider;
//! use std::sync::Arc;
//!
//! // Wrap a PR #85 provider
//! let pr85_provider: Arc<dyn LlmProvider> = ...;
//! let phase17_provider = LlmProviderAdapter::new(
//!     pr85_provider,
//!     "claude-code".to_string(),
//!     "Claude Code".to_string(),
//! );
//!
//! // Use it as a Phase 17 provider
//! let response = phase17_provider.send_message("Hello", None, None, None, false).await?;
//! ```

pub mod types;
pub mod llm_to_phase17;

pub use llm_to_phase17::LlmProviderAdapter;
