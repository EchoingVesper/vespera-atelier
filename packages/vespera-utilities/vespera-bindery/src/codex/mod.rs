//! Codex management and template system

use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use crate::{BinderyResult, CodexId, templates::TemplateId, types::CodexContent};
use chrono::{DateTime, Utc};

// Sub-modules for Codex functionality
pub mod format;
pub mod template;
pub mod versioning;

// Re-export commonly used types
pub use template::{TemplateRegistry, TemplateLoader};
pub use format::{CodexFormat, CodexSerializer};
pub use versioning::{VersionManager, CodexVersion};

/// Core Codex structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Codex {
    pub id: CodexId,
    pub title: String,
    pub content_type: String,
    pub template_id: TemplateId,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub content: CodexContent,
}

/// Codex manager extensions for task management
pub trait CodexManagerExt {
    /// Create a new Codex
    async fn create_codex_ext(&self, title: String, template_id: TemplateId) -> BinderyResult<CodexId>;

    /// Get a Codex by ID  
    async fn get_codex_ext(&self, id: &CodexId) -> BinderyResult<Option<Codex>>;

    /// Update Codex fields
    async fn update_codex_fields(&self, id: &CodexId, fields: HashMap<String, crate::templates::TemplateValue>) -> BinderyResult<()>;

    /// Delete a Codex
    async fn delete_codex_ext(&self, id: &CodexId) -> BinderyResult<()>;

    /// List Codices by template
    async fn list_codices_by_template(&self, template_id: &TemplateId) -> BinderyResult<Vec<Codex>>;

    /// Add a reference between Codices
    async fn add_codex_reference(&self, from_id: &CodexId, to_id: &CodexId, ref_type: &str, context: Option<String>) -> BinderyResult<()>;
}

impl CodexManagerExt for crate::CodexManager {
    async fn create_codex_ext(&self, title: String, template_id: TemplateId) -> BinderyResult<CodexId> {
        // Placeholder - integrate with existing create_codex method
        Ok(CodexId::new_v4())
    }

    async fn get_codex_ext(&self, _id: &CodexId) -> BinderyResult<Option<Codex>> {
        // Placeholder implementation
        Ok(None)
    }

    async fn update_codex_fields(&self, _id: &CodexId, _fields: HashMap<String, crate::templates::TemplateValue>) -> BinderyResult<()> {
        // Placeholder implementation
        Ok(())
    }

    async fn delete_codex_ext(&self, _id: &CodexId) -> BinderyResult<()> {
        // Placeholder implementation
        Ok(())
    }

    async fn list_codices_by_template(&self, _template_id: &TemplateId) -> BinderyResult<Vec<Codex>> {
        // Placeholder implementation
        Ok(Vec::new())
    }

    async fn add_codex_reference(&self, _from_id: &CodexId, _to_id: &CodexId, _ref_type: &str, _context: Option<String>) -> BinderyResult<()> {
        // Placeholder implementation
        Ok(())
    }
}

