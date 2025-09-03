//! # Vespera Bindery
//!
//! A high-performance Rust library for collaborative Codex management with CRDT-based real-time editing.
//!
//! Vespera Bindery is the core content management system for the Vespera Atelier ecosystem. 
//! It provides conflict-free replicated data types (CRDTs) for real-time collaborative editing 
//! of structured documents called "Codices".
//!
//! ## Features
//!
//! - **Real-time Collaboration**: Google Drive-level multi-user editing
//! - **Offline-first**: Full functionality without internet connection
//! - **Conflict-free**: Mathematical guarantees prevent merge conflicts
//! - **Template-aware**: CRDT operations understand structured content
//! - **Cross-platform**: Dual bindings for Node.js (NAPI-RS) and Python (PyO3)
//!
//! ## Architecture
//!
//! The library is built around a hybrid CRDT structure that combines different CRDT types
//! for optimal performance across various use cases:
//!
//! ```rust,ignore
//! pub struct VesperaCRDT {
//!     text_layer: YTextCRDT,           // Text editing within template fields
//!     tree_layer: VesperaTreeCRDT,     // Hierarchical Codex relationships  
//!     metadata_layer: LWWMap,          // Template metadata (last-writer-wins)
//!     reference_layer: ORSet,          // Cross-Codex references
//!     operation_log: Vec<CRDTOperation>, // Git-like operation history
//! }
//! ```
//!
//! ## Usage
//!
//! ### Basic Codex Creation
//!
//! ```rust,ignore
//! use vespera_bindery::{CodexManager, Template};
//!
//! let manager = CodexManager::new()?;
//! let template = Template::load("react-component")?;
//! let codex = manager.create_codex("MyComponent", template)?;
//! ```
//!
//! ### Real-time Collaboration
//!
//! ```rust,ignore
//! use vespera_bindery::{VesperaCRDT, CollaborationSession};
//!
//! let mut crdt = VesperaCRDT::new();
//! let session = CollaborationSession::connect("ws://localhost:8080").await?;
//! 
//! // Edit operations are automatically synchronized
//! crdt.edit_text("title", "New Component Name");
//! session.broadcast_operation(crdt.last_operation()).await?;
//! ```

use std::collections::HashMap;
use std::sync::{Arc, Weak};

use anyhow::Result;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// Re-export commonly used types
pub use uuid::Uuid as CodexId;
pub use chrono::{DateTime, Utc};

// Core modules
pub mod crdt;
pub mod codex;
pub mod sync;

// New modules for task and role management
pub mod task_management;
pub mod role_management;
pub mod hook_system;
pub mod templates;
pub mod migration;
pub mod database;

// Conditional binding modules
#[cfg(feature = "nodejs")]
pub mod bindings;

// Test modules
#[cfg(test)]
pub mod tests;

// Error types
pub mod errors;
pub use errors::{BinderyError, BinderyResult};

// Core types
pub mod types;
pub use types::{
    CodexMetadata, CodexContent, TemplateId, ProjectId, UserId,
    VectorClock, OperationId, ContentHash
};

// Re-export commonly used task management types
pub use task_management::{
    TaskManager, TaskService, TaskStatus, TaskPriority, TaskInput, 
    TaskUpdateInput, TaskSummary, TaskDashboard
};

// Re-export role management types  
pub use role_management::{RoleManager, Role, ToolGroup};

// Re-export hook system types
pub use hook_system::{HookManager, HookAgent, TimedAgent};

/// The main entry point for Vespera Bindery functionality.
///
/// `CodexManager` provides high-level operations for managing Codices,
/// including creation, modification, synchronization, and collaboration.
#[derive(Debug)]
pub struct CodexManager {
    inner: Arc<CodexManagerInner>,
}

#[derive(Debug)]
struct CodexManagerInner {
    codices: tokio::sync::RwLock<HashMap<CodexId, Arc<crdt::VesperaCRDT>>>,
    templates: Arc<templates::TemplateRegistry>,
    task_manager: Option<Arc<TaskManager>>,
    role_manager: Arc<RoleManager>,
    hook_manager: Arc<HookManager>,
    sync_manager: Option<Arc<sync::SyncManager>>,
    config: BinderyConfig,
}

/// Configuration options for Vespera Bindery
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BinderyConfig {
    /// Base directory for storing Codex files
    pub storage_path: Option<std::path::PathBuf>,
    
    /// Enable real-time collaboration features
    pub collaboration_enabled: bool,
    
    /// Maximum number of operations to keep in memory per Codex
    pub max_operations_in_memory: usize,
    
    /// Enable automatic garbage collection of old CRDT operations
    pub auto_gc_enabled: bool,
    
    /// Interval for automatic garbage collection (in seconds)
    pub gc_interval_seconds: u64,
    
    /// Enable compression for stored operations
    pub compression_enabled: bool,
    
    /// User ID for this instance (for collaboration)
    pub user_id: Option<UserId>,
    
    /// Project ID for this instance
    pub project_id: Option<ProjectId>,
}

impl Default for BinderyConfig {
    fn default() -> Self {
        Self {
            storage_path: None,
            collaboration_enabled: false,
            max_operations_in_memory: 1000,
            auto_gc_enabled: true,
            gc_interval_seconds: 300, // 5 minutes
            compression_enabled: true,
            user_id: None,
            project_id: None,
        }
    }
}

impl CodexManager {
    /// Create a new CodexManager with default configuration
    pub fn new() -> Result<Self> {
        Self::with_config(BinderyConfig::default())
    }
    
    /// Create a new CodexManager with custom configuration  
    pub fn with_config(config: BinderyConfig) -> Result<Self> {
        let templates = Arc::new(templates::TemplateRegistry::new());
        
        let sync_manager = if config.collaboration_enabled {
            Some(Arc::new(sync::SyncManager::new(config.clone())?))
        } else {
            None
        };

        // For now, create stub managers to avoid circular dependencies
        // In production, these would be properly initialized
        let inner = CodexManagerInner {
            codices: tokio::sync::RwLock::new(HashMap::new()),
            templates,
            task_manager: None, // TODO: Initialize properly after architecture refactor
            role_manager: Arc::new(RoleManager::default()),
            hook_manager: Arc::new(HookManager::default()),
            sync_manager,
            config,
        };
        
        Ok(Self {
            inner: Arc::new(inner),
        })
    }
    
    /// Create a new Codex with the specified title and template
    pub async fn create_codex(&self, title: impl Into<String>, template_id: impl Into<TemplateId>) -> BinderyResult<CodexId> {
        let id = Uuid::new_v4();
        let title = title.into();
        let template_id = template_id.into();
        
        // Verify template exists
        let template_registry_id = templates::TemplateId::new(&template_id);
        self.inner.templates.get(&template_registry_id)
            .ok_or_else(|| BinderyError::TemplateNotFound(template_registry_id))?;
        
        let created_by = "system".to_string(); // TODO: Get from context
        let crdt = Arc::new(crdt::VesperaCRDT::new(id, created_by));
        
        {
            let mut codices = self.inner.codices.write().await;
            codices.insert(id, crdt.clone());
        }
        
        // If collaboration is enabled, register with sync manager
        if let Some(sync_manager) = &self.inner.sync_manager {
            sync_manager.register_codex(id, crdt).await?;
        }
        
        Ok(id)
    }
    
    /// Get an existing Codex by ID
    pub async fn get_codex(&self, id: &CodexId) -> Option<Arc<crdt::VesperaCRDT>> {
        let codices = self.inner.codices.read().await;
        codices.get(id).cloned()
    }
    
    /// List all Codex IDs
    pub async fn list_codices(&self) -> Vec<CodexId> {
        let codices = self.inner.codices.read().await;
        codices.keys().copied().collect()
    }
    
    /// Delete a Codex
    pub async fn delete_codex(&self, id: &CodexId) -> Result<bool> {
        let mut codices = self.inner.codices.write().await;
        let removed = codices.remove(id).is_some();
        
        // If collaboration is enabled, unregister from sync manager
        if let Some(sync_manager) = &self.inner.sync_manager {
            sync_manager.unregister_codex(id).await?;
        }
        
        Ok(removed)
    }
    
    /// Enable collaboration for this CodexManager
    pub async fn enable_collaboration(&mut self) -> Result<()> {
        if self.inner.sync_manager.is_some() {
            return Ok(()); // Already enabled
        }
        
        let sync_manager = Arc::new(sync::SyncManager::new(self.inner.config.clone())?);
        
        // Register all existing codices with the sync manager
        {
            let codices = self.inner.codices.read().await;
            for (id, crdt) in codices.iter() {
                sync_manager.register_codex(*id, crdt.clone()).await?;
            }
        }
        
        // This is a bit tricky due to Arc, but we need to update the config and sync_manager
        // In a real implementation, we might need a different approach
        // For now, we'll return an error suggesting recreation
        Err(BinderyError::ConfigurationError(
            "Collaboration must be enabled during creation. Please recreate CodexManager with collaboration_enabled: true".to_string()
        ).into())
    }
    
    /// Get the current configuration
    pub fn config(&self) -> &BinderyConfig {
        &self.inner.config
    }
    
    /// Perform garbage collection on all managed Codices
    pub async fn gc_all_codices(&self) -> Result<CodexManagerGCStats> {
        let mut total_stats = CodexManagerGCStats::default();
        
        {
            let codices = self.inner.codices.read().await;
            
            for crdt in codices.values() {
                // Use a cutoff of 1 hour for garbage collection
                let cutoff = chrono::Utc::now() - chrono::Duration::hours(1);
                
                // We need to get a mutable reference, but we can't due to the Arc
                // In a real implementation, we'd need interior mutability
                // For now, we'll track this as a design issue to fix
                total_stats.codices_processed += 1;
                
                // TODO: Implement interior mutability for CRDT GC
                // let stats = crdt.gc_all(cutoff);
                // total_stats.merge(stats);
            }
        }
        
        Ok(total_stats)
    }
    
    /// Get memory usage statistics for all Codices
    pub async fn memory_stats(&self) -> HashMap<CodexId, crdt::MemoryStats> {
        let codices = self.inner.codices.read().await;
        
        codices.iter()
            .map(|(id, crdt)| (*id, crdt.memory_stats()))
            .collect()
    }
    
    /// Clean up all resources and shut down the manager
    pub async fn shutdown(&mut self) -> Result<()> {
        // Stop sync manager first
        if let Some(sync_manager) = &self.inner.sync_manager {
            sync_manager.stop().await?;
        }
        
        // Clear all Codices (this will trigger Drop implementations)
        {
            let mut codices = self.inner.codices.write().await;
            codices.clear();
        }
        
        Ok(())
    }
}

/// Statistics from garbage collection across all Codices
#[derive(Debug, Default)]
pub struct CodexManagerGCStats {
    pub codices_processed: usize,
    pub total_operations_removed: usize,
    pub total_tombstones_removed: usize,
    pub total_fields_cleaned: usize,
}

// Version information
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
pub const BUILD_TARGET: &str = env!("BUILD_TARGET");
pub const BUILD_PROFILE: &str = env!("BUILD_PROFILE");

/// Get version information for this build
pub fn version_info() -> HashMap<String, String> {
    let mut info = HashMap::new();
    info.insert("version".to_string(), VERSION.to_string());
    info.insert("build_target".to_string(), BUILD_TARGET.to_string());
    info.insert("build_profile".to_string(), BUILD_PROFILE.to_string());
    info.insert("features".to_string(), get_enabled_features());
    info
}

fn get_enabled_features() -> String {
    let mut features = Vec::new();
    
    #[cfg(feature = "nodejs")]
    features.push("nodejs");
    
    #[cfg(feature = "python")]
    features.push("python");
    
    #[cfg(feature = "yjs-compat")]
    features.push("yjs-compat");
    
    #[cfg(feature = "p2p-sync")]
    features.push("p2p-sync");
    
    #[cfg(feature = "relay-sync")]
    features.push("relay-sync");
    
    features.join(",")
}