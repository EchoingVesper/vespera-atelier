//! CRDT (Conflict-free Replicated Data Type) implementations for Vespera Bindery
//!
//! This module contains the core CRDT implementations that enable real-time collaborative
//! editing of Codices. The hybrid CRDT approach combines different CRDT types optimized
//! for specific use cases.

use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

use crate::{
    BinderyResult, 
    types::{CodexId, UserId, OperationId, VectorClock, TemplateId},
    types::Template,
};

// Sub-modules for different CRDT layers
pub mod text_layer;
pub mod tree_layer;
pub mod metadata_layer;
pub mod reference_layer;

// Re-export CRDT implementations
pub use text_layer::YTextCRDT;
pub use tree_layer::VesperaTreeCRDT;
pub use metadata_layer::LWWMap;
pub use reference_layer::ORSet;

/// The main CRDT structure that orchestrates all CRDT layers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VesperaCRDT {
    /// Codex identifier
    pub codex_id: CodexId,
    
    /// Text editing within template fields
    pub text_layer: YTextCRDT,
    
    /// Hierarchical Codex relationships and structure
    pub tree_layer: VesperaTreeCRDT,
    
    /// Template metadata with last-writer-wins semantics
    pub metadata_layer: LWWMap<String, TemplateValue>,
    
    /// Cross-Codex references with add-only semantics
    pub reference_layer: ORSet<CodexReference>,
    
    /// Operation log for Git-like history
    pub operation_log: Vec<CRDTOperation>,
    
    /// Current vector clock
    pub vector_clock: VectorClock,
    
    /// Creation metadata
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
    
    /// Last update metadata
    pub updated_at: DateTime<Utc>,
    pub updated_by: UserId,
}

/// A unified CRDT operation that can affect any layer
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CRDTOperation {
    /// Unique operation ID
    pub id: OperationId,
    
    /// Operation type and data
    pub operation: OperationType,
    
    /// User who performed the operation
    pub user_id: UserId,
    
    /// Timestamp of the operation
    pub timestamp: DateTime<Utc>,
    
    /// Vector clock at time of operation
    pub vector_clock: VectorClock,
    
    /// Parent operations this depends on
    pub parents: Vec<OperationId>,
    
    /// Layer this operation affects
    pub layer: CRDTLayer,
}

/// Types of operations across all CRDT layers
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type")]
pub enum OperationType {
    /// Text operations (text_layer)
    TextInsert { field_id: String, position: usize, content: String },
    TextDelete { field_id: String, position: usize, length: usize },
    TextFormat { field_id: String, position: usize, length: usize, format: TextFormat },
    
    /// Tree operations (tree_layer)
    TreeInsert { parent_id: Option<CodexId>, position: usize, child_id: CodexId },
    TreeDelete { parent_id: Option<CodexId>, child_id: CodexId },
    TreeMove { child_id: CodexId, old_parent_id: Option<CodexId>, new_parent_id: Option<CodexId>, position: usize },
    
    /// Metadata operations (metadata_layer)
    MetadataSet { key: String, value: TemplateValue },
    MetadataDelete { key: String },
    
    /// Reference operations (reference_layer)
    ReferenceAdd { reference: CodexReference },
    ReferenceRemove { reference: CodexReference },
}

/// CRDT layer identifier
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CRDTLayer {
    Text,
    Tree,
    Metadata,
    Reference,
}

/// Text formatting information
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TextFormat {
    pub bold: Option<bool>,
    pub italic: Option<bool>,
    pub underline: Option<bool>,
    pub strikethrough: Option<bool>,
    pub color: Option<String>,
    pub background_color: Option<String>,
    pub font_size: Option<f32>,
    pub font_family: Option<String>,
}

/// Template value with CRDT semantics
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type")]
pub enum TemplateValue {
    /// Simple text value
    Text { value: String, timestamp: DateTime<Utc>, user_id: UserId },
    
    /// Rich text with CRDT operations
    RichText { content_id: String }, // References text_layer content
    
    /// Structured data (JSON)
    Structured { value: serde_json::Value, timestamp: DateTime<Utc>, user_id: UserId },
    
    /// Reference to another Codex
    Reference { codex_id: CodexId, timestamp: DateTime<Utc>, user_id: UserId },
    
    /// List of values (OR-Set semantics)
    List { items: HashMap<Uuid, (TemplateValue, DateTime<Utc>, UserId)> },
    
    /// Key-value mapping (LWW-Map semantics)
    Map { entries: HashMap<String, (TemplateValue, DateTime<Utc>, UserId)> },
}

/// Cross-Codex reference
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct CodexReference {
    /// Source Codex ID
    pub from_codex_id: CodexId,
    
    /// Target Codex ID
    pub to_codex_id: CodexId,
    
    /// Reference type
    pub reference_type: ReferenceType,
    
    /// Optional context or label
    pub context: Option<String>,
}

/// Type of reference between Codices
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum ReferenceType {
    /// Parent-child relationship
    Child,
    
    /// Dependency relationship
    DependsOn,
    
    /// Generic reference
    References,
    
    /// Related content
    Related,
    
    /// Custom reference type
    Custom(String),
}

impl VesperaCRDT {
    /// Create a new CRDT for a Codex
    pub fn new(codex_id: CodexId, created_by: UserId) -> Self {
        let now = Utc::now();
        let mut vector_clock = VectorClock::new();
        vector_clock.insert(created_by.clone(), 0);
        
        Self {
            codex_id,
            text_layer: YTextCRDT::new(),
            tree_layer: VesperaTreeCRDT::new(),
            metadata_layer: LWWMap::new(),
            reference_layer: ORSet::new(),
            operation_log: Vec::new(),
            vector_clock,
            created_at: now,
            created_by: created_by.clone(),
            updated_at: now,
            updated_by: created_by,
        }
    }
    
    /// Create a new CRDT with template initialization
    pub fn new_with_template(
        codex_id: CodexId, 
        title: &str, 
        template: &Template
    ) -> BinderyResult<Self> {
        let created_by = "system".to_string(); // TODO: Get from context
        let mut crdt = Self::new(codex_id, created_by.clone());
        
        // Initialize with template metadata
        crdt.set_metadata("title".to_string(), TemplateValue::Text {
            value: title.to_string(),
            timestamp: Utc::now(),
            user_id: created_by.clone(),
        })?;
        
        crdt.set_metadata("template_id".to_string(), TemplateValue::Text {
            value: template.id.clone(),
            timestamp: Utc::now(),
            user_id: created_by,
        })?;
        
        // TODO: Initialize template fields
        
        Ok(crdt)
    }
    
    /// Apply an operation to this CRDT
    pub fn apply_operation(&mut self, operation: CRDTOperation) -> BinderyResult<()> {
        // Update vector clock
        let user_clock = self.vector_clock.entry(operation.user_id.clone()).or_insert(0);
        *user_clock = (*user_clock).max(
            operation.vector_clock.get(&operation.user_id).copied().unwrap_or(0)
        );
        
        // Apply operation to appropriate layer
        match &operation.operation {
            OperationType::TextInsert { field_id, position, content } => {
                self.text_layer.insert(field_id, *position, content)?;
            }
            OperationType::TextDelete { field_id, position, length } => {
                self.text_layer.delete(field_id, *position, *length)?;
            }
            OperationType::MetadataSet { key, value } => {
                self.metadata_layer.set(key.clone(), value.clone());
            }
            OperationType::ReferenceAdd { reference } => {
                self.reference_layer.add(reference.clone());
            }
            OperationType::ReferenceRemove { reference } => {
                self.reference_layer.remove(reference);
            }
            _ => {
                // TODO: Implement other operation types
                return Err(crate::BinderyError::NotImplemented(
                    format!("Operation type not yet implemented: {:?}", operation.operation)
                ));
            }
        }
        
        // Add to operation log
        self.operation_log.push(operation.clone());
        
        // Update timestamps
        self.updated_at = operation.timestamp;
        self.updated_by = operation.user_id;
        
        Ok(())
    }
    
    /// Generate a new operation
    pub fn create_operation(
        &mut self,
        operation: OperationType,
        user_id: UserId,
    ) -> CRDTOperation {
        let operation_id = Uuid::new_v4();
        let timestamp = Utc::now();
        
        // Increment user's clock
        let user_clock = self.vector_clock.entry(user_id.clone()).or_insert(0);
        *user_clock += 1;
        
        // Determine layer
        let layer = match &operation {
            OperationType::TextInsert { .. } | 
            OperationType::TextDelete { .. } | 
            OperationType::TextFormat { .. } => CRDTLayer::Text,
            
            OperationType::TreeInsert { .. } | 
            OperationType::TreeDelete { .. } | 
            OperationType::TreeMove { .. } => CRDTLayer::Tree,
            
            OperationType::MetadataSet { .. } | 
            OperationType::MetadataDelete { .. } => CRDTLayer::Metadata,
            
            OperationType::ReferenceAdd { .. } | 
            OperationType::ReferenceRemove { .. } => CRDTLayer::Reference,
        };
        
        CRDTOperation {
            id: operation_id,
            operation,
            user_id,
            timestamp,
            vector_clock: self.vector_clock.clone(),
            parents: Vec::new(), // TODO: Compute dependencies
            layer,
        }
    }
    
    /// Set metadata value
    pub fn set_metadata(&mut self, key: String, value: TemplateValue) -> BinderyResult<()> {
        let user_id = self.updated_by.clone(); // TODO: Get from context
        let operation = self.create_operation(
            OperationType::MetadataSet { key, value },
            user_id,
        );
        self.apply_operation(operation)
    }
    
    /// Get metadata value
    pub fn get_metadata(&self, key: &str) -> Option<&TemplateValue> {
        self.metadata_layer.get(&key.to_string())
    }
    
    /// Insert text at position
    pub fn insert_text(&mut self, field_id: String, position: usize, content: String) -> BinderyResult<()> {
        let user_id = self.updated_by.clone(); // TODO: Get from context
        let operation = self.create_operation(
            OperationType::TextInsert { field_id, position, content },
            user_id,
        );
        self.apply_operation(operation)
    }
    
    /// Delete text at position
    pub fn delete_text(&mut self, field_id: String, position: usize, length: usize) -> BinderyResult<()> {
        let user_id = self.updated_by.clone(); // TODO: Get from context
        let operation = self.create_operation(
            OperationType::TextDelete { field_id, position, length },
            user_id,
        );
        self.apply_operation(operation)
    }
    
    /// Add reference to another Codex
    pub fn add_reference(&mut self, reference: CodexReference) -> BinderyResult<()> {
        let user_id = self.updated_by.clone(); // TODO: Get from context
        let operation = self.create_operation(
            OperationType::ReferenceAdd { reference },
            user_id,
        );
        self.apply_operation(operation)
    }
    
    /// Get all references from this Codex
    pub fn get_references(&self) -> Vec<&CodexReference> {
        self.reference_layer.iter().collect()
    }
    
    /// Get the current state as a snapshot
    pub fn snapshot(&self) -> CRDTSnapshot {
        CRDTSnapshot {
            codex_id: self.codex_id,
            vector_clock: self.vector_clock.clone(),
            metadata: self.metadata_layer.clone(),
            references: self.reference_layer.clone(),
            text_content: self.text_layer.snapshot(),
            tree_structure: self.tree_layer.snapshot(),
            operation_count: self.operation_log.len(),
            updated_at: self.updated_at,
        }
    }
    
    /// Merge with another CRDT state
    pub fn merge(&mut self, other: &VesperaCRDT) -> BinderyResult<Vec<OperationId>> {
        if self.codex_id != other.codex_id {
            return Err(crate::BinderyError::CrdtError(
                "Cannot merge CRDTs with different Codex IDs".to_string()
            ));
        }
        
        let mut applied_operations = Vec::new();
        
        // Apply operations from other that we haven't seen
        for operation in &other.operation_log {
            if !self.operation_log.iter().any(|op| op.id == operation.id) {
                self.apply_operation(operation.clone())?;
                applied_operations.push(operation.id);
            }
        }
        
        Ok(applied_operations)
    }
}

/// Snapshot of CRDT state for serialization/debugging
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CRDTSnapshot {
    pub codex_id: CodexId,
    pub vector_clock: VectorClock,
    pub metadata: LWWMap<String, TemplateValue>,
    pub references: ORSet<CodexReference>,
    pub text_content: HashMap<String, String>, // field_id -> content
    pub tree_structure: HashMap<CodexId, Vec<CodexId>>, // parent -> children
    pub operation_count: usize,
    pub updated_at: DateTime<Utc>,
}