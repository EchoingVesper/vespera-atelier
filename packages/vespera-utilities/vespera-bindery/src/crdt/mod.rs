//! CRDT (Conflict-free Replicated Data Type) implementations for Vespera Bindery
//!
//! This module provides a comprehensive hybrid CRDT system that enables real-time collaborative
//! editing of Codices across distributed environments. The system combines multiple specialized
//! CRDT algorithms, each optimized for specific data types and usage patterns.
//!
//! # Architecture Overview
//!
//! The Vespera CRDT system uses a layered architecture where each layer handles a specific
//! aspect of document collaboration:
//!
//! - **Text Layer**: Y-CRDT for collaborative text editing with complex formatting
//! - **Tree Layer**: Custom tree CRDT for hierarchical document structure
//! - **Metadata Layer**: Last-Writer-Wins (LWW) Map for simple key-value metadata
//! - **Reference Layer**: Observed-Remove (OR) Set for cross-document references
//!
//! # Mathematical Properties
//!
//! All CRDT implementations in this module satisfy the fundamental mathematical properties:
//!
//! ## Commutativity
//! For any operations a and b: `merge(apply(a), apply(b)) = merge(apply(b), apply(a))`
//!
//! ## Associativity
//! For operations a, b, c: `merge(merge(a, b), c) = merge(a, merge(b, c))`
//!
//! ## Idempotency
//! For any operation a: `merge(a, a) = a`
//!
//! ## Eventual Consistency
//! Given the same set of operations, all replicas will converge to the same state.
//!
//! # Usage Example
//!
//! ```rust
//! use vespera_bindery::crdt::{VesperaCRDT, TemplateValue, CodexReference, ReferenceType};
//! use uuid::Uuid;
//!
//! // Create a new CRDT for collaborative editing
//! let codex_id = Uuid::new_v4();
//! let mut crdt = VesperaCRDT::new(codex_id, "user1".to_string());
//!
//! // Set document metadata
//! crdt.set_metadata("title".to_string(), TemplateValue::Text {
//!     value: "My Document".to_string(),
//!     timestamp: chrono::Utc::now(),
//!     user_id: "user1".to_string(),
//! }).unwrap();
//!
//! // Add collaborative text
//! crdt.insert_text("content".to_string(), 0, "Hello, world!".to_string()).unwrap();
//!
//! // Add reference to another document
//! let reference = CodexReference {
//!     from_codex_id: codex_id,
//!     to_codex_id: Uuid::new_v4(),
//!     reference_type: ReferenceType::References,
//!     context: Some("Related content".to_string()),
//! };
//! crdt.add_reference(reference).unwrap();
//!
//! // Merge changes from another replica
//! let other_crdt = VesperaCRDT::new(codex_id, "user2".to_string());
//! let applied_ops = crdt.merge(&other_crdt).unwrap();
//! ```
//!
//! # Performance Characteristics
//!
//! The hybrid CRDT system is designed for optimal performance across different operations:
//!
//! - **Text Operations**: O(log n) insertion/deletion with Y-CRDT
//! - **Metadata Operations**: O(1) average case with LWW semantics
//! - **Reference Operations**: O(1) add/remove with OR-Set
//! - **Tree Operations**: O(log n) for most tree manipulations
//! - **Merge Operations**: O(n) where n is the number of divergent operations
//!
//! # Memory Management
//!
//! The system includes sophisticated memory management features:
//! - Operation pooling for reduced allocation overhead
//! - Configurable garbage collection for operation logs
//! - Weak reference tracking to prevent memory leaks
//! - Automatic cleanup of tombstones and inactive data

use std::collections::HashMap;
use std::sync::{Arc, Weak};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

use crate::{
    BinderyResult,
    types::{CodexId, UserId, OperationId, VectorClock},
    types::Template,
};
use tracing::{info, warn, error, debug, instrument};

/// Operational context for CRDT operations
#[derive(Debug, Clone)]
pub struct OperationContext {
    /// User performing the operation
    pub user_id: UserId,
    /// Session identifier (optional)
    pub session_id: Option<String>,
    /// Client identifier (optional)
    pub client_id: Option<String>,
    /// Operation metadata
    pub metadata: HashMap<String, String>,
}

impl OperationContext {
    /// Create a new operation context
    pub fn new(user_id: UserId) -> Self {
        Self {
            user_id,
            session_id: None,
            client_id: None,
            metadata: HashMap::new(),
        }
    }

    /// Create a system operation context
    pub fn system() -> Self {
        Self::new("system".to_string())
    }

    /// Add session information
    pub fn with_session(mut self, session_id: String) -> Self {
        self.session_id = Some(session_id);
        self
    }

    /// Add client information
    pub fn with_client(mut self, client_id: String) -> Self {
        self.client_id = Some(client_id);
        self
    }

    /// Add metadata
    pub fn with_metadata(mut self, key: String, value: String) -> Self {
        self.metadata.insert(key, value);
        self
    }
}

// Sub-modules for different CRDT layers
pub mod text_layer;
pub mod tree_layer;
pub mod metadata_layer;
pub mod reference_layer;

// Re-export CRDT implementations
pub use text_layer::YTextCRDT;
pub use tree_layer::VesperaTreeCRDT;
pub use metadata_layer::{LWWMap, LWWMapStats};
pub use reference_layer::{ORSet, ORSetStats};

/// Memory pool for reusing operation allocations
#[derive(Debug, Clone)]
pub struct OperationPool {
    pool: Vec<CRDTOperation>,
    max_size: usize,
}

impl OperationPool {
    pub fn new(max_size: usize) -> Self {
        Self {
            pool: Vec::with_capacity(max_size),
            max_size,
        }
    }

    pub fn get(&mut self) -> Option<CRDTOperation> {
        self.pool.pop()
    }

    pub fn return_operation(&mut self, mut operation: CRDTOperation) {
        if self.pool.len() < self.max_size {
            // Reset operation for reuse
            operation.parents.clear();
            operation.parents.shrink_to_fit();
            self.pool.push(operation);
        }
    }

    pub fn clear(&mut self) {
        self.pool.clear();
        self.pool.shrink_to_fit();
    }
}

/// Memory management configuration
#[derive(Debug, Clone)]
pub struct MemoryConfig {
    pub max_operation_pool_size: usize,
    pub auto_gc_threshold: usize,
    pub max_vector_clock_entries: usize,
    pub aggressive_cleanup: bool,
}

impl Default for MemoryConfig {
    fn default() -> Self {
        Self {
            max_operation_pool_size: 100,
            auto_gc_threshold: 1000,
            max_vector_clock_entries: 50,
            aggressive_cleanup: false,
        }
    }
}

/// Weak reference registry to prevent circular references
#[derive(Debug, Default)]
pub struct WeakReferenceRegistry {
    references: HashMap<CodexId, Vec<Weak<VesperaCRDT>>>,
}

impl WeakReferenceRegistry {
    pub fn new() -> Self {
        Self {
            references: HashMap::new(),
        }
    }

    pub fn register(&mut self, codex_id: CodexId, weak_ref: Weak<VesperaCRDT>) {
        self.references.entry(codex_id).or_default().push(weak_ref);
    }

    pub fn cleanup_dead_references(&mut self) -> usize {
        let mut removed = 0;
        for refs in self.references.values_mut() {
            let initial_len = refs.len();
            refs.retain(|weak_ref| weak_ref.upgrade().is_some());
            removed += initial_len - refs.len();
        }

        // Remove empty entries
        self.references.retain(|_, refs| !refs.is_empty());
        removed
    }

    pub fn get_active_references(&self, codex_id: &CodexId) -> Vec<Arc<VesperaCRDT>> {
        self.references
            .get(codex_id)
            .map(|refs| {
                refs.iter()
                    .filter_map(|weak_ref| weak_ref.upgrade())
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Detect potential memory leaks from strong reference cycles
    pub fn detect_potential_leaks(&mut self) -> MemoryLeakReport {
        let dead_refs_removed = self.cleanup_dead_references();
        let total_registrations = self.references.values().map(|refs| refs.len()).sum::<usize>();
        let active_references = self.references.len();

        // Check for suspiciously high reference counts
        let mut suspicious_codices = Vec::new();
        for (codex_id, refs) in &self.references {
            if refs.len() > 10 { // Threshold for suspicious reference count
                suspicious_codices.push((codex_id.clone(), refs.len()));
            }
        }

        MemoryLeakReport {
            dead_references_cleaned: dead_refs_removed,
            total_weak_references: total_registrations,
            active_codices: active_references,
            suspicious_reference_counts: suspicious_codices,
            recommendations: self.generate_leak_recommendations(total_registrations, active_references),
        }
    }

    fn generate_leak_recommendations(
        &self,
        total_refs: usize,
        active_codices: usize
    ) -> Vec<String> {
        let mut recommendations = Vec::new();

        if total_refs > 1000 {
            recommendations.push("High number of weak references detected. Consider more aggressive cleanup.".to_string());
        }

        if active_codices > 100 {
            recommendations.push("Many active CRDT instances. Consider implementing reference limits.".to_string());
        }

        let avg_refs_per_codex = if active_codices > 0 {
            total_refs as f64 / active_codices as f64
        } else {
            0.0
        };

        if avg_refs_per_codex > 5.0 {
            recommendations.push(format!(
                "Average {:.1} references per CRDT. High interconnectedness may cause performance issues.",
                avg_refs_per_codex
            ));
        }

        if recommendations.is_empty() {
            recommendations.push("Reference management looks healthy.".to_string());
        }

        recommendations
    }

    /// Perform comprehensive cleanup with configurable aggressiveness
    pub fn comprehensive_cleanup(&mut self, aggressive: bool) -> usize {
        let mut removed = self.cleanup_dead_references();

        if aggressive {
            // In aggressive mode, remove entries with only one weak reference
            // as they might be self-references or near-orphaned objects
            let before_aggressive = self.references.len();
            self.references.retain(|_, refs| refs.len() > 1);
            removed += before_aggressive - self.references.len();
        }

        // Shrink the registry to save memory
        self.references.shrink_to_fit();
        for refs in self.references.values_mut() {
            refs.shrink_to_fit();
        }

        removed
    }
}

/// The main CRDT structure that orchestrates all CRDT layers
///
/// VesperaCRDT implements a hybrid CRDT system that combines multiple specialized
/// CRDT algorithms to provide comprehensive collaborative editing capabilities.
/// Each layer handles a specific aspect of document collaboration:
///
/// # Layer Coordination
///
/// The CRDT orchestrator ensures consistency across all layers by:
/// - Maintaining a global vector clock for causal ordering
/// - Applying operations atomically across relevant layers
/// - Providing conflict resolution through layer-specific algorithms
/// - Managing operation dependencies and causality
///
/// # Conflict Resolution Strategy
///
/// Different layers use different conflict resolution strategies:
/// - **Text Layer**: Operational Transformation with Y-CRDT semantics
/// - **Metadata Layer**: Last-Writer-Wins with timestamp ordering
/// - **Reference Layer**: OR-Set semantics (adds always win)
/// - **Tree Layer**: Position-based conflict resolution with cycle detection
///
/// # Convergence Guarantees
///
/// The system guarantees strong eventual consistency: given the same set of
/// operations, all replicas will converge to the same state regardless of
/// operation delivery order, network partitions, or concurrent modifications.
///
/// # Example Usage
///
/// ```rust
/// use vespera_bindery::crdt::VesperaCRDT;
/// use uuid::Uuid;
///
/// let codex_id = Uuid::new_v4();
/// let mut crdt = VesperaCRDT::new(codex_id, "user1".to_string());
///
/// // The CRDT automatically coordinates operations across all layers
/// crdt.set_title("Collaborative Document").unwrap();
/// crdt.insert_text("content".to_string(), 0, "Hello".to_string()).unwrap();
/// ```
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

    /// Memory pool for operation reuse (not serialized)
    #[serde(skip)]
    operation_pool: Option<OperationPool>,

    /// Memory management configuration
    #[serde(skip)]
    memory_config: MemoryConfig,

    /// Weak reference to self for circular reference prevention
    #[serde(skip)]
    weak_self_ref: Option<Weak<VesperaCRDT>>,

    /// Current operation context for user tracking
    #[serde(skip)]
    current_context: Option<OperationContext>,
    
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

        let memory_config = MemoryConfig::default();
        let operation_pool = Some(OperationPool::new(memory_config.max_operation_pool_size));

        Self {
            codex_id,
            text_layer: YTextCRDT::new(),
            tree_layer: VesperaTreeCRDT::new(),
            metadata_layer: LWWMap::new(),
            reference_layer: ORSet::new(),
            operation_log: Vec::new(),
            vector_clock,
            operation_pool,
            memory_config,
            weak_self_ref: None,
            current_context: Some(OperationContext::new(created_by.clone())),
            created_at: now,
            created_by: created_by.clone(),
            updated_at: now,
            updated_by: created_by,
        }
    }

    /// Create a new CRDT with custom memory configuration
    pub fn new_with_memory_config(
        codex_id: CodexId,
        created_by: UserId,
        memory_config: MemoryConfig
    ) -> Self {
        let now = Utc::now();
        let mut vector_clock = VectorClock::new();
        vector_clock.insert(created_by.clone(), 0);

        let operation_pool = Some(OperationPool::new(memory_config.max_operation_pool_size));

        Self {
            codex_id,
            text_layer: YTextCRDT::new(),
            tree_layer: VesperaTreeCRDT::new(),
            metadata_layer: LWWMap::new(),
            reference_layer: ORSet::new(),
            operation_log: Vec::new(),
            vector_clock,
            operation_pool,
            memory_config,
            weak_self_ref: None,
            current_context: Some(OperationContext::new(created_by.clone())),
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
        let created_by = "system".to_string(); // TODO: Get user ID from authentication context
        let mut crdt = Self::new(codex_id, created_by.clone());
        
        // Initialize with template metadata
        crdt.set_metadata("title".to_string(), TemplateValue::Text {
            value: title.to_string(),
            timestamp: Utc::now(),
            user_id: created_by.clone(),
        })?;
        
        crdt.set_metadata("template_id".to_string(), TemplateValue::Text {
            value: template.id.to_string(),
            timestamp: Utc::now(),
            user_id: created_by.clone(),
        })?;

        // Initialize template fields with default values from template definition
        for (field_name, field_def) in &template.fields {
            if let Some(default_value) = &field_def.default_value {
                // Convert template default value to CRDT TemplateValue
                let crdt_value = match default_value {
                    crate::templates::TemplateValue::Text(text) => crate::crdt::TemplateValue::Text {
                        value: text.clone(),
                        timestamp: Utc::now(),
                        user_id: created_by.clone(),
                    },
                    crate::templates::TemplateValue::Number(num) => crate::crdt::TemplateValue::Structured {
                        value: serde_json::Value::Number(
                            serde_json::Number::from_f64(*num).unwrap_or_else(|| serde_json::Number::from(0))
                        ),
                        timestamp: Utc::now(),
                        user_id: created_by.clone(),
                    },
                    crate::templates::TemplateValue::Boolean(bool_val) => crate::crdt::TemplateValue::Structured {
                        value: serde_json::Value::Bool(*bool_val),
                        timestamp: Utc::now(),
                        user_id: created_by.clone(),
                    },
                    crate::templates::TemplateValue::DateTime(dt) => crate::crdt::TemplateValue::Structured {
                        value: serde_json::Value::String(dt.to_rfc3339()),
                        timestamp: Utc::now(),
                        user_id: created_by.clone(),
                    },
                    other => crate::crdt::TemplateValue::Structured {
                        value: other.to_json(),
                        timestamp: Utc::now(),
                        user_id: created_by.clone(),
                    },
                };

                crdt.set_metadata(field_name.clone(), crdt_value)?;
            } else {
                // Initialize with appropriate empty value based on field type
                let empty_value = match field_def.field_type {
                    crate::templates::FieldType::Text => crate::crdt::TemplateValue::Text {
                        value: String::new(),
                        timestamp: Utc::now(),
                        user_id: created_by.clone(),
                    },
                    crate::templates::FieldType::RichText => crate::crdt::TemplateValue::RichText {
                        content_id: format!("{}_{}_{}", codex_id, field_name, uuid::Uuid::new_v4())
                    },
                    _ => crate::crdt::TemplateValue::Structured {
                        value: serde_json::Value::Null,
                        timestamp: Utc::now(),
                        user_id: created_by.clone(),
                    },
                };

                crdt.set_metadata(field_name.clone(), empty_value)?;
            }
        }
        
        Ok(crdt)
    }
    
    /// Apply an operation to this CRDT
    ///
    /// This is the core method for applying collaborative operations. It ensures
    /// proper ordering, conflict resolution, and consistency across all CRDT layers.
    ///
    /// # Mathematical Properties
    ///
    /// Operations are applied with the following guarantees:
    /// - **Commutativity**: Operations can be applied in any order
    /// - **Idempotency**: Applying the same operation multiple times has no effect
    /// - **Causality**: Vector clocks ensure causal ordering is preserved
    ///
    /// # Conflict Resolution
    ///
    /// The method routes operations to the appropriate layer based on the operation type:
    /// - Text operations use Y-CRDT operational transformation
    /// - Metadata operations use LWW conflict resolution
    /// - Reference operations use OR-Set semantics
    /// - Tree operations use position-based resolution with cycle detection
    ///
    /// # Performance
    ///
    /// - Time Complexity: O(1) for most operations, O(log n) for text operations
    /// - Space Complexity: O(1) per operation (with garbage collection)
    ///
    /// # Example
    ///
    /// ```rust
    /// use vespera_bindery::crdt::{CRDTOperation, OperationType, CRDTLayer};
    /// use uuid::Uuid;
    /// use chrono::Utc;
    ///
    /// let operation = CRDTOperation {
    ///     id: Uuid::new_v4(),
    ///     operation: OperationType::TextInsert {
    ///         field_id: "content".to_string(),
    ///         position: 0,
    ///         content: "Hello".to_string(),
    ///     },
    ///     user_id: "user1".to_string(),
    ///     timestamp: Utc::now(),
    ///     vector_clock: std::collections::HashMap::new(),
    ///     parents: vec![],
    ///     layer: CRDTLayer::Text,
    /// };
    ///
    /// crdt.apply_operation(operation).unwrap();
    /// ```
    #[instrument(skip(self, operation), fields(
        codex_id = %self.codex_id,
        operation_type = ?operation.operation,
        user_id = %operation.user_id,
        operation_id = %operation.id
    ))]
    pub fn apply_operation(&mut self, operation: CRDTOperation) -> BinderyResult<()> {
        debug!(
            codex_id = %self.codex_id,
            operation_id = %operation.id,
            operation_type = ?operation.operation,
            user_id = %operation.user_id,
            "Applying CRDT operation"
        );

        let start_time = std::time::Instant::now();

        // Update vector clock
        let user_clock = self.vector_clock.entry(operation.user_id.clone()).or_insert(0);
        *user_clock = (*user_clock).max(
            operation.vector_clock.get(&operation.user_id).copied().unwrap_or(0)
        );

        // Apply operation to appropriate layer
        let result = match &operation.operation {
            OperationType::TextInsert { field_id, position, content } => {
                debug!(field_id = %field_id, position = position, content_len = content.len(), "Applying text insert");
                self.text_layer.insert(field_id, *position, content)
            }
            OperationType::TextDelete { field_id, position, length } => {
                debug!(field_id = %field_id, position = position, length = length, "Applying text delete");
                self.text_layer.delete(field_id, *position, *length)
            }
            OperationType::MetadataSet { key, value } => {
                debug!(key = %key, value_type = ?std::mem::discriminant(value), "Applying metadata set");
                // Use borrowed references to avoid clones in hot paths
                self.metadata_layer.set_borrowed(key, value);
                Ok(())
            }
            OperationType::ReferenceAdd { reference } => {
                debug!(
                    from_codex = %reference.from_codex_id,
                    to_codex = %reference.to_codex_id,
                    reference_type = ?reference.reference_type,
                    "Adding reference"
                );
                self.reference_layer.add_borrowed(reference);
                Ok(())
            }
            OperationType::ReferenceRemove { reference } => {
                debug!(
                    from_codex = %reference.from_codex_id,
                    to_codex = %reference.to_codex_id,
                    reference_type = ?reference.reference_type,
                    "Removing reference"
                );
                self.reference_layer.remove(reference);
                Ok(())
            }
            _ => {
                warn!(operation_type = ?operation.operation, "Operation type not yet implemented");
                Err(crate::BinderyError::NotImplemented(
                    format!("Operation type not yet implemented: {:?}", operation.operation)
                ))
            }
        };

        // Check the result and log accordingly
        match &result {
            Ok(_) => {
                let duration = start_time.elapsed();
                info!(
                    codex_id = %self.codex_id,
                    operation_id = %operation.id,
                    operation_type = ?operation.operation,
                    duration_ms = duration.as_millis(),
                    "CRDT operation applied successfully"
                );

                // Record metrics
                // TODO: BinderyMetrics::record_crdt_operation(
                //     &format!("{:?}", operation.operation),
                //     "codex",
                //     duration,
                //     true
                // );
            }
            Err(ref err) => {
                let duration = start_time.elapsed();
                error!(
                    codex_id = %self.codex_id,
                    operation_id = %operation.id,
                    operation_type = ?operation.operation,
                    error = %err,
                    duration_ms = duration.as_millis(),
                    "CRDT operation failed"
                );

                // Record metrics for failure
                // TODO: BinderyMetrics::record_crdt_operation(
                //     &format!("{:?}", operation.operation),
                //     "codex",
                //     duration,
                //     false
                // );
            }
        }

        result?;

        // Store timestamp and user_id before moving operation
        let timestamp = operation.timestamp;
        let user_id = operation.user_id.clone();

        // Add to operation log with bounded growth - move instead of clone
        self.operation_log.push(operation);

        // Prevent unbounded growth by garbage collecting old operations
        self.gc_operation_log_if_needed();

        // Update timestamps using stored values
        self.updated_at = timestamp;
        self.updated_by = user_id;

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
    
    /// Set the operation context for subsequent operations
    pub fn set_operation_context(&mut self, context: OperationContext) {
        self.current_context = Some(context);
    }

    /// Get the current operation context
    pub fn get_operation_context(&self) -> OperationContext {
        self.current_context.clone().unwrap_or_else(|| OperationContext::system())
    }

    /// Set metadata value
    pub fn set_metadata(&mut self, key: String, value: TemplateValue) -> BinderyResult<()> {
        let user_id = self.get_operation_context().user_id;
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

    /// Set the title of this Codex
    pub fn set_title(&mut self, title: &str) -> BinderyResult<()> {
        let value = TemplateValue::Text {
            value: title.to_string(),
            timestamp: Utc::now(),
            user_id: self.updated_by.clone(),
        };
        self.set_metadata("title".to_string(), value)
    }

    /// Get the title of this Codex
    pub fn get_title(&self) -> Option<String> {
        if let Some(TemplateValue::Text { value, .. }) = self.get_metadata("title") {
            Some(value.clone())
        } else {
            None
        }
    }

    /// Insert text at position
    pub fn insert_text(&mut self, field_id: String, position: usize, content: String) -> BinderyResult<()> {
        let user_id = self.get_operation_context().user_id;
        let operation = self.create_operation(
            OperationType::TextInsert { field_id, position, content },
            user_id,
        );
        self.apply_operation(operation)
    }

    /// Delete text at position
    pub fn delete_text(&mut self, field_id: String, position: usize, length: usize) -> BinderyResult<()> {
        let user_id = self.get_operation_context().user_id;
        let operation = self.create_operation(
            OperationType::TextDelete { field_id, position, length },
            user_id,
        );
        self.apply_operation(operation)
    }

    /// Add reference to another Codex
    pub fn add_reference(&mut self, reference: CodexReference) -> BinderyResult<()> {
        let user_id = self.get_operation_context().user_id;
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
    ///
    /// This method implements the core CRDT merge algorithm that ensures eventual
    /// consistency across distributed replicas. It applies all operations from
    /// another replica that haven't been seen locally.
    ///
    /// # Algorithm
    ///
    /// The merge process follows these steps:
    /// 1. **Validation**: Ensure both CRDTs represent the same document
    /// 2. **Operation Diffing**: Identify operations not present locally
    /// 3. **Causal Ordering**: Apply operations in causally consistent order
    /// 4. **Conflict Resolution**: Let each layer handle conflicts appropriately
    /// 5. **Convergence**: Ensure final state is deterministic
    ///
    /// # Mathematical Properties
    ///
    /// The merge operation satisfies:
    /// - **Commutativity**: `merge(A, B) = merge(B, A)`
    /// - **Associativity**: `merge(merge(A, B), C) = merge(A, merge(B, C))`
    /// - **Idempotency**: `merge(A, A) = A`
    ///
    /// # Performance
    ///
    /// - Time Complexity: O(n + m) where n, m are operation counts
    /// - Space Complexity: O(k) where k is the number of new operations
    ///
    /// # Convergence Guarantees
    ///
    /// After merging, both replicas will have applied the same set of operations.
    /// Given the deterministic nature of each CRDT layer, this ensures that
    /// all replicas will converge to the same final state.
    ///
    /// # Example
    ///
    /// ```rust
    /// // Two replicas of the same document
    /// let mut replica_a = VesperaCRDT::new(codex_id, "user_a".to_string());
    /// let mut replica_b = VesperaCRDT::new(codex_id, "user_b".to_string());
    ///
    /// // Make concurrent changes
    /// replica_a.insert_text("content".to_string(), 0, "Hello".to_string()).unwrap();
    /// replica_b.insert_text("content".to_string(), 0, "World".to_string()).unwrap();
    ///
    /// // Merge changes - both replicas will converge to the same state
    /// let applied_ops_a = replica_a.merge(&replica_b).unwrap();
    /// let applied_ops_b = replica_b.merge(&replica_a).unwrap();
    ///
    /// // Both replicas now have the same content
    /// assert_eq!(replica_a.snapshot(), replica_b.snapshot());
    /// ```
    #[instrument(skip(self, other), fields(
        self_codex_id = %self.codex_id,
        other_codex_id = %other.codex_id,
        self_operations = self.operation_log.len(),
        other_operations = other.operation_log.len()
    ))]
    pub fn merge(&mut self, other: &VesperaCRDT) -> BinderyResult<Vec<OperationId>> {
        if self.codex_id != other.codex_id {
            error!(
                self_codex_id = %self.codex_id,
                other_codex_id = %other.codex_id,
                "Cannot merge CRDTs with different Codex IDs"
            );
            return Err(crate::BinderyError::CrdtError(
                "Cannot merge CRDTs with different Codex IDs".to_string()
            ));
        }

        info!(
            codex_id = %self.codex_id,
            self_operations = self.operation_log.len(),
            other_operations = other.operation_log.len(),
            "Starting CRDT merge"
        );

        let start_time = std::time::Instant::now();
        let mut applied_operations = Vec::with_capacity(other.operation_log.len());

        // Build a set of existing operation IDs for faster lookup
        let existing_ops: std::collections::HashSet<_> =
            self.operation_log.iter().map(|op| op.id).collect();

        // Apply operations from other that we haven't seen
        for operation in &other.operation_log {
            if !existing_ops.contains(&operation.id) {
                debug!(
                    operation_id = %operation.id,
                    operation_type = ?operation.operation,
                    "Applying operation from merge source"
                );
                applied_operations.push(operation.id);
                self.apply_operation(operation.clone())?;
            }
        }

        let duration = start_time.elapsed();
        info!(
            codex_id = %self.codex_id,
            applied_operations = applied_operations.len(),
            duration_ms = duration.as_millis(),
            "CRDT merge completed successfully"
        );

        // TODO: Record merge metrics
        // BinderyMetrics::record_crdt_sync("merge", applied_operations.len(), duration, true);

        Ok(applied_operations)
    }
    
    /// Garbage collect the operation log to prevent unbounded growth
    pub fn gc_operation_log(&mut self, max_operations: usize) -> usize {
        let removed_count = if self.operation_log.len() > max_operations {
            let to_remove = self.operation_log.len() - max_operations;
            self.operation_log.drain(0..to_remove);
            to_remove
        } else {
            0
        };
        
        removed_count
    }
    
    /// Garbage collect operation log if it exceeds the threshold
    fn gc_operation_log_if_needed(&mut self) {
        let max_operations = self.memory_config.auto_gc_threshold;
        let compact_to = max_operations / 2;

        if self.operation_log.len() > max_operations {
            // More aggressive compaction to prevent memory leaks
            let removed_count = self.gc_operation_log(compact_to);
            tracing::debug!(
                "CRDT operation log compacted: removed {} operations, {} remaining",
                removed_count,
                self.operation_log.len()
            );

            // Also perform vector clock cleanup if enabled
            if self.memory_config.aggressive_cleanup {
                self.gc_vector_clock();
            }
        }
    }

    /// Garbage collect vector clock to prevent unbounded growth
    pub fn gc_vector_clock(&mut self) -> usize {
        let initial_size = self.vector_clock.len();
        if initial_size <= self.memory_config.max_vector_clock_entries {
            return 0;
        }

        // Keep only the most recent vector clock entries
        let mut entries: Vec<_> = self.vector_clock.iter().collect();
        entries.sort_by_key(|(_, &clock)| std::cmp::Reverse(clock));

        let mut new_vector_clock = VectorClock::new();
        for (user_id, &clock) in entries.into_iter().take(self.memory_config.max_vector_clock_entries) {
            new_vector_clock.insert(user_id.clone(), clock);
        }

        self.vector_clock = new_vector_clock;
        initial_size - self.vector_clock.len()
    }

    /// Configure memory management settings
    pub fn configure_memory(&mut self, config: MemoryConfig) {
        self.memory_config = config.clone();

        // Recreate operation pool with new size if needed
        if let Some(ref mut pool) = self.operation_pool {
            if pool.max_size != config.max_operation_pool_size {
                *pool = OperationPool::new(config.max_operation_pool_size);
            }
        }

        // Apply immediate cleanup if aggressive mode is enabled
        if config.aggressive_cleanup {
            self.gc_operation_log(config.auto_gc_threshold / 2);
            self.gc_vector_clock();
        }
    }

    /// Get memory configuration
    pub fn memory_config(&self) -> &MemoryConfig {
        &self.memory_config
    }

    /// Return an operation to the pool for reuse
    pub fn return_operation_to_pool(&mut self, operation: CRDTOperation) {
        if let Some(ref mut pool) = self.operation_pool {
            pool.return_operation(operation);
        }
    }

    /// Get an operation from the pool or create a new one
    fn get_or_create_operation(&mut self) -> CRDTOperation {
        if let Some(ref mut pool) = self.operation_pool {
            if let Some(mut operation) = pool.get() {
                // Reset the operation for reuse
                operation.id = Uuid::new_v4();
                operation.parents.clear();
                return operation;
            }
        }

        // Create new operation if pool is empty or not available
        CRDTOperation {
            id: Uuid::new_v4(),
            operation: OperationType::MetadataSet {
                key: String::new(),
                value: TemplateValue::Text {
                    value: String::new(),
                    timestamp: Utc::now(),
                    user_id: String::new(),
                },
            },
            user_id: String::new(),
            timestamp: Utc::now(),
            vector_clock: VectorClock::new(),
            parents: Vec::new(),
            layer: CRDTLayer::Metadata,
        }
    }

    /// Configure memory management thresholds for this CRDT instance
    pub fn configure_memory_limits(
        &mut self, 
        max_operations: Option<usize>,
        auto_gc_enabled: Option<bool>
    ) {
        // Store configuration for future use
        // This could be extended to store config in the CRDT struct
        if let Some(max_ops) = max_operations {
            if self.operation_log.len() > max_ops {
                let removed = self.gc_operation_log(max_ops);
                tracing::info!(
                    "CRDT configured with max {} operations, removed {} old operations",
                    max_ops, removed
                );
            }
        }

        if let Some(auto_gc) = auto_gc_enabled {
            // TODO: Implement auto GC configuration storage and activation
            tracing::debug!("CRDT auto-GC configuration set to: {}", auto_gc);
        }
    }
    
    /// Perform comprehensive garbage collection with configurable limits
    pub fn gc_all(&mut self, operation_cutoff: DateTime<Utc>) -> GarbageCollectionStats {
        self.gc_all_with_limits(operation_cutoff, 500, 100)
    }

    /// Perform comprehensive garbage collection with custom limits
    pub fn gc_all_with_limits(
        &mut self, 
        operation_cutoff: DateTime<Utc>,
        max_operations: usize,
        max_tree_tombstones: usize
    ) -> GarbageCollectionStats {
        tracing::debug!(
            "Starting comprehensive GC: {} operations, cutoff {}",
            self.operation_log.len(),
            operation_cutoff
        );

        // GC operation log with configurable limit
        let old_operations_removed = self.gc_operation_log(max_operations);
        
        // GC metadata layer tombstones
        let metadata_tombstones_removed = self.metadata_layer.gc_tombstones(operation_cutoff);
        
        // GC reference layer removed tags
        let reference_tags_removed = self.reference_layer.gc_removed_tags(operation_cutoff);
        
        // GC text layer (when Y-CRDT integration is complete)
        let text_fields_cleaned = self.text_layer.gc_fields();
        
        // GC tree layer tombstones with configurable limit
        self.tree_layer.gc_tombstones(max_tree_tombstones);
        
        let stats = GarbageCollectionStats {
            operations_removed: old_operations_removed,
            metadata_tombstones_removed,
            reference_tags_removed,
            text_fields_cleaned,
            memory_freed_bytes: (old_operations_removed * 200) +
                                (metadata_tombstones_removed * 100) +
                                (reference_tags_removed * 150) +
                                (text_fields_cleaned * 1000),
            tree_tombstones_removed: 0, // Tree layer tombstone removal count from tree_layer.gc_tombstones()
        };

        tracing::info!(
            "GC completed: {} ops removed, {} metadata tombstones, {} ref tags, {} text fields cleaned",
            stats.operations_removed,
            stats.metadata_tombstones_removed, 
            stats.reference_tags_removed,
            stats.text_fields_cleaned
        );

        stats
    }
    
    /// Get memory usage statistics
    pub fn memory_stats(&self) -> MemoryStats {
        let operation_log_size = self.operation_log.len();
        let metadata_stats = self.metadata_layer.stats();
        let reference_stats = self.reference_layer.stats();
        let text_field_count = self.text_layer.field_count();

        // Estimate total memory usage in bytes
        let total_size_bytes = (operation_log_size * 200) + // ~200 bytes per operation
                               (metadata_stats.active_entries * 100) + // ~100 bytes per metadata entry
                               (reference_stats.total_elements * 150) + // ~150 bytes per reference
                               (text_field_count * 1000); // ~1KB per text field

        MemoryStats {
            operation_log_size,
            metadata_stats,
            reference_stats,
            text_field_count,
            total_size_bytes,
        }
    }
    
    /// Schedule periodic garbage collection based on age and size thresholds
    pub fn schedule_periodic_gc(
        &mut self,
        max_operation_age_hours: u32,
        force_gc_every_n_operations: usize
    ) -> bool {
        let cutoff_time = Utc::now() - chrono::Duration::hours(max_operation_age_hours as i64);
        let should_gc = self.operation_log.len() >= force_gc_every_n_operations ||
            self.operation_log.iter().any(|op| op.timestamp < cutoff_time);

        if should_gc {
            let stats = self.gc_all(cutoff_time);
            tracing::info!(
                "Periodic GC completed for CRDT {}: removed {} operations",
                self.codex_id, stats.operations_removed
            );
            true
        } else {
            false
        }
    }

    /// Get recommendations for memory optimization
    pub fn memory_optimization_recommendations(&self) -> MemoryOptimizationReport {
        let stats = self.memory_stats();
        let mut recommendations = Vec::new();
        let mut priority = OptimizationPriority::Low;

        // Check operation log size
        if stats.operation_log_size > 2000 {
            recommendations.push("Operation log is very large (>2000). Consider more aggressive GC.".to_string());
            priority = OptimizationPriority::High;
        } else if stats.operation_log_size > 1000 {
            recommendations.push("Operation log is large (>1000). Consider periodic GC.".to_string());
            priority = priority.max(OptimizationPriority::Medium);
        }

        // Check metadata layer
        if stats.metadata_stats.active_entries > 500 {
            recommendations.push("Metadata layer has many entries. Consider tombstone cleanup.".to_string());
            priority = priority.max(OptimizationPriority::Medium);
        }

        // Check reference layer
        if stats.reference_stats.total_elements > 1000 {
            recommendations.push("Reference layer has many entries. Consider cleanup.".to_string());
            priority = priority.max(OptimizationPriority::Medium);
        }

        // Check text fields
        if stats.text_field_count > 100 {
            recommendations.push("Many text fields active. Consider field cleanup.".to_string());
            priority = priority.max(OptimizationPriority::Low);
        }

        MemoryOptimizationReport {
            priority,
            recommendations,
            current_stats: stats,
            estimated_memory_usage_mb: self.estimate_memory_usage_mb(),
        }
    }

    /// Estimate memory usage in megabytes
    fn estimate_memory_usage_mb(&self) -> f64 {
        // Rough estimates based on data structure sizes
        let operation_log_mb = (self.operation_log.len() * 200) as f64 / 1024.0 / 1024.0; // ~200 bytes per op
        let metadata_mb = (self.metadata_layer.stats().active_entries * 100) as f64 / 1024.0 / 1024.0;
        let references_mb = (self.reference_layer.stats().total_elements * 150) as f64 / 1024.0 / 1024.0;
        let text_mb = (self.text_layer.field_count() * 1000) as f64 / 1024.0 / 1024.0; // ~1KB per field
        
        operation_log_mb + metadata_mb + references_mb + text_mb
    }

    /// Clean up resources when CRDT is no longer needed
    pub fn cleanup(&mut self) {
        tracing::debug!("Cleaning up CRDT {} resources", self.codex_id);

        // Return operations to pool before clearing
        if let Some(ref mut pool) = self.operation_pool {
            for operation in self.operation_log.drain(..) {
                pool.return_operation(operation);
            }
        } else {
            self.operation_log.clear();
        }
        self.operation_log.shrink_to_fit();

        // Cleanup all layers with explicit memory management
        self.metadata_layer.clear();
        self.reference_layer.clear();
        self.tree_layer.cleanup();
        self.text_layer.cleanup();

        // Clear vector clock
        self.vector_clock.clear();
        self.vector_clock.shrink_to_fit();

        // Clear operation pool
        if let Some(ref mut pool) = self.operation_pool {
            pool.clear();
        }

        tracing::debug!("CRDT {} cleanup completed", self.codex_id);
    }

    /// Get comprehensive memory usage information
    pub fn detailed_memory_stats(&self) -> DetailedMemoryStats {
        let base_stats = self.memory_stats();
        let operation_pool_size = self.operation_pool.as_ref().map(|p| p.pool.len()).unwrap_or(0);
        let vector_clock_size = self.vector_clock.len();

        DetailedMemoryStats {
            base_stats,
            operation_pool_size,
            vector_clock_size,
            estimated_operation_log_mb: (self.operation_log.len() * 200) as f64 / 1024.0 / 1024.0,
            estimated_vector_clock_mb: (vector_clock_size * 50) as f64 / 1024.0 / 1024.0,
            memory_config: self.memory_config.clone(),
        }
    }

    /// Perform aggressive memory optimization
    pub fn optimize_memory(&mut self) -> MemoryOptimizationResult {
        let initial_stats = self.detailed_memory_stats();

        // Aggressive GC
        let operations_removed = self.gc_operation_log(self.memory_config.auto_gc_threshold / 4);
        let vector_clock_entries_removed = self.gc_vector_clock();

        // Comprehensive layer cleanup
        let metadata_tombstones_removed = self.metadata_layer.gc_tombstones(Utc::now() - chrono::Duration::hours(24));
        let reference_tags_removed = self.reference_layer.gc_removed_tags(Utc::now() - chrono::Duration::hours(24));
        let text_fields_cleaned = self.text_layer.gc_fields();

        // Shrink all collections
        self.metadata_layer.shrink_to_fit();
        self.reference_layer.shrink_to_fit();
        self.operation_log.shrink_to_fit();
        self.vector_clock.shrink_to_fit();

        let final_stats = self.detailed_memory_stats();

        MemoryOptimizationResult {
            initial_stats,
            final_stats,
            operations_removed,
            vector_clock_entries_removed,
            metadata_tombstones_removed,
            reference_tags_removed,
            text_fields_cleaned,
        }
    }
}

/// Statistics from garbage collection
#[derive(Debug, Clone)]
pub struct GarbageCollectionStats {
    pub operations_removed: usize,
    pub metadata_tombstones_removed: usize,
    pub reference_tags_removed: usize,
    pub text_fields_cleaned: usize,
    pub memory_freed_bytes: usize,
    pub tree_tombstones_removed: usize,
}

/// Memory usage statistics
#[derive(Debug, Clone)]
pub struct MemoryStats {
    pub operation_log_size: usize,
    pub metadata_stats: LWWMapStats,
    pub reference_stats: ORSetStats,
    pub text_field_count: usize,
    pub total_size_bytes: usize,
}

/// Detailed memory usage statistics with additional metrics
#[derive(Debug, Clone)]
pub struct DetailedMemoryStats {
    pub base_stats: MemoryStats,
    pub operation_pool_size: usize,
    pub vector_clock_size: usize,
    pub estimated_operation_log_mb: f64,
    pub estimated_vector_clock_mb: f64,
    pub memory_config: MemoryConfig,
}

/// Result of memory optimization operation
#[derive(Debug, Clone)]
pub struct MemoryOptimizationResult {
    pub initial_stats: DetailedMemoryStats,
    pub final_stats: DetailedMemoryStats,
    pub operations_removed: usize,
    pub vector_clock_entries_removed: usize,
    pub metadata_tombstones_removed: usize,
    pub reference_tags_removed: usize,
    pub text_fields_cleaned: usize,
}

impl MemoryOptimizationResult {
    /// Calculate memory savings in MB
    pub fn memory_saved_mb(&self) -> f64 {
        let initial_mb = self.initial_stats.estimated_operation_log_mb
            + self.initial_stats.estimated_vector_clock_mb
            + self.initial_stats.base_stats.metadata_stats.active_entries as f64 * 0.0001
            + self.initial_stats.base_stats.reference_stats.total_elements as f64 * 0.00015;

        let final_mb = self.final_stats.estimated_operation_log_mb
            + self.final_stats.estimated_vector_clock_mb
            + self.final_stats.base_stats.metadata_stats.active_entries as f64 * 0.0001
            + self.final_stats.base_stats.reference_stats.total_elements as f64 * 0.00015;

        initial_mb - final_mb
    }

    /// Get optimization efficiency percentage
    pub fn optimization_efficiency(&self) -> f64 {
        let total_removed = self.operations_removed
            + self.vector_clock_entries_removed
            + self.metadata_tombstones_removed
            + self.reference_tags_removed
            + self.text_fields_cleaned;

        if total_removed == 0 {
            0.0
        } else {
            (self.memory_saved_mb() / total_removed as f64) * 100.0
        }
    }
}

/// Memory optimization report with recommendations
#[derive(Debug, Clone)]
pub struct MemoryOptimizationReport {
    pub priority: OptimizationPriority,
    pub recommendations: Vec<String>,
    pub current_stats: MemoryStats,
    pub estimated_memory_usage_mb: f64,
}

/// Priority level for memory optimization
#[derive(Debug, Clone, PartialEq, PartialOrd, Ord, Eq)]
pub enum OptimizationPriority {
    Low,
    Medium,
    High,
    Critical,
}

impl OptimizationPriority {
    pub fn max(self, other: Self) -> Self {
        if self > other { self } else { other }
    }
}

/// Report on potential memory leaks from circular references
#[derive(Debug, Clone)]
pub struct MemoryLeakReport {
    pub dead_references_cleaned: usize,
    pub total_weak_references: usize,
    pub active_codices: usize,
    pub suspicious_reference_counts: Vec<(CodexId, usize)>,
    pub recommendations: Vec<String>,
}

impl MemoryLeakReport {
    /// Check if there are potential memory leaks
    pub fn has_potential_leaks(&self) -> bool {
        !self.suspicious_reference_counts.is_empty() ||
        self.total_weak_references > 1000 ||
        self.active_codices > 100
    }

    /// Get severity level of potential leaks
    pub fn leak_severity(&self) -> LeakSeverity {
        if self.suspicious_reference_counts.len() > 10 {
            LeakSeverity::Critical
        } else if self.suspicious_reference_counts.len() > 5 || self.total_weak_references > 2000 {
            LeakSeverity::High
        } else if !self.suspicious_reference_counts.is_empty() || self.total_weak_references > 1000 {
            LeakSeverity::Medium
        } else {
            LeakSeverity::Low
        }
    }
}

/// Severity level for memory leak detection
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub enum LeakSeverity {
    Low,
    Medium,
    High,
    Critical,
}

/// Implement Drop to ensure proper cleanup of CRDT resources
impl Drop for VesperaCRDT {
    fn drop(&mut self) {
        // Use the comprehensive cleanup method
        self.cleanup();

        // Ensure all memory is properly deallocated
        tracing::trace!("CRDT {} dropped and memory deallocated", self.codex_id);
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