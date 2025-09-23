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
//! - **Security Audit Logging**: Comprehensive audit trail for security-sensitive operations
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
//!
//! ### Security Audit Logging
//!
//! ```rust,ignore
//! use vespera_bindery::observability::{AuditLogger, AuditConfig, UserContext};
//!
//! // Initialize audit logging
//! let audit_config = AuditConfig::default();
//! let audit_logger = AuditLogger::new(audit_config).await?;
//!
//! // Create role executor with audit logging
//! let executor = RoleExecutor::with_audit_logger(Arc::new(audit_logger));
//!
//! // All security-sensitive operations are automatically audited
//! let user_context = UserContext { /* ... */ };
//! let result = executor.execute_with_role(&role, &task, user_context).await?;
//! ```

use std::collections::HashMap;
use std::sync::Arc;

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

// RAG (Retrieval-Augmented Generation) module
pub mod rag;

// Conditional binding modules
#[cfg(feature = "nodejs")]
pub mod bindings;

// Test modules
#[cfg(test)]
pub mod tests;

// Error types
pub mod errors;
pub use errors::{BinderyError, BinderyResult};

// Observability module with audit logging
pub mod observability;

// Core types
pub mod types;
pub use types::{
    CodexMetadata, CodexContent, ProjectId, UserId,
    VectorClock, OperationId, ContentHash
};

// Re-export template types
pub use templates::TemplateId;

// Re-export commonly used task management types
pub use task_management::{
    TaskManager, TaskService, TaskExecutor, TaskStatus, TaskPriority, TaskInput,
    TaskUpdateInput, TaskSummary, TaskDashboard, TaskExecutionResult, ExecutionContext
};

// Re-export role management types
pub use role_management::{RoleManager, RoleExecutor, Role, ToolGroup, RoleExecutionResult};

// Re-export hook system types
pub use hook_system::{HookManager, HookAgent, TimedAgent};

// Re-export RAG types
pub use rag::{RAGService, RAGConfig, DocumentType, SearchResult, RAGStats};

// Re-export database types
pub use database::{Database, DatabasePoolConfig, PoolMetrics};

// Re-export observability and audit logging types
pub use observability::{
    // Core observability
    MetricsCollector, BinderyMetrics, PerformanceTimer,
    init_logging, init_observability, init_audit_logging,

    // Audit logging
    AuditLogger, AuditEvent, AuditConfig, AuditQueryFilter, AuditStats,
    UserContext, Operation, SecurityContext, OperationOutcome,
    create_role_execution_event, create_migration_event, create_config_change_event,
    create_auth_failure_event,

    // Audit configuration helpers
    default_audit_config, production_audit_config, validate_audit_config,
    log_security_event,
};

// Re-export migration types with audit support
pub use migration::{MigrationManager, MigrationInfo, MigrationResult, MigrationStatus};

/// The main entry point for Vespera Bindery functionality.
///
/// `CodexManager` provides high-level operations for managing Codices,
/// including creation, modification, synchronization, and collaboration.
#[derive(Debug, Clone)]
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

    /// Database path for task and role persistence
    pub database_path: Option<std::path::PathBuf>,

    /// Audit database path for security logging
    pub audit_db_path: Option<std::path::PathBuf>,

    /// Database connection pool configuration
    pub database_pool: database::DatabasePoolConfig,

    /// Audit logging configuration
    pub audit_config: Option<observability::AuditConfig>,

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

    /// Enable security audit logging
    pub audit_logging_enabled: bool,
}

impl Default for BinderyConfig {
    fn default() -> Self {
        Self {
            storage_path: None,
            database_path: None,
            audit_db_path: None,
            database_pool: database::DatabasePoolConfig::default(),
            audit_config: None,
            collaboration_enabled: false,
            max_operations_in_memory: 1000,
            auto_gc_enabled: true,
            gc_interval_seconds: 300, // 5 minutes
            compression_enabled: true,
            user_id: None,
            project_id: None,
            audit_logging_enabled: false,
        }
    }
}

impl BinderyConfig {
    /// Validate the configuration and return any errors
    pub fn validate(&self) -> BinderyResult<()> {
        // Validate memory limits
        if self.max_operations_in_memory == 0 {
            return Err(BinderyError::ConfigurationError(
                "max_operations_in_memory must be greater than 0".to_string()
            ));
        }

        if self.max_operations_in_memory > 1_000_000 {
            return Err(BinderyError::ConfigurationError(
                "max_operations_in_memory should not exceed 1,000,000 for performance reasons".to_string()
            ));
        }

        // Validate GC interval
        if self.gc_interval_seconds < 60 {
            return Err(BinderyError::ConfigurationError(
                "gc_interval_seconds must be at least 60 seconds to avoid performance issues".to_string()
            ));
        }

        if self.gc_interval_seconds > 86400 {
            return Err(BinderyError::ConfigurationError(
                "gc_interval_seconds should not exceed 24 hours (86400 seconds)".to_string()
            ));
        }

        // Validate storage path if provided
        if let Some(ref path) = self.storage_path {
            if !path.is_absolute() {
                return Err(BinderyError::ConfigurationError(
                    "storage_path must be an absolute path".to_string()
                ));
            }
        }

        // Validate database path if provided
        if let Some(ref path) = self.database_path {
            if !path.is_absolute() {
                return Err(BinderyError::ConfigurationError(
                    "database_path must be an absolute path".to_string()
                ));
            }

            // Check if parent directory exists or can be created
            if let Some(parent) = path.parent() {
                if !parent.exists() {
                    // We'll allow this but warn that the directory will be created
                    tracing::info!("Database parent directory does not exist and will be created: {:?}", parent);
                }
            }
        }

        // Validate audit database path if provided
        if let Some(ref path) = self.audit_db_path {
            if !path.is_absolute() {
                return Err(BinderyError::ConfigurationError(
                    "audit_db_path must be an absolute path".to_string()
                ));
            }
        }

        // Validate database pool configuration
        self.database_pool.validate()?;

        // Validate audit configuration if provided
        if let Some(ref audit_config) = self.audit_config {
            observability::validate_audit_config(audit_config)?;
        }

        // If collaboration is enabled, certain fields should be set
        if self.collaboration_enabled {
            if self.user_id.is_none() {
                return Err(BinderyError::ConfigurationError(
                    "user_id must be provided when collaboration is enabled".to_string()
                ));
            }

            if self.project_id.is_none() {
                return Err(BinderyError::ConfigurationError(
                    "project_id must be provided when collaboration is enabled".to_string()
                ));
            }
        }

        Ok(())
    }

    /// Create a new configuration with validation
    pub fn new() -> BinderyResult<Self> {
        let config = Self::default();
        config.validate()?;
        Ok(config)
    }

    /// Builder pattern for safe configuration construction
    pub fn builder() -> BinderyConfigBuilder {
        BinderyConfigBuilder::new()
    }

    /// Validate and set storage path
    pub fn with_storage_path(mut self, path: impl Into<std::path::PathBuf>) -> BinderyResult<Self> {
        let path = path.into();
        if !path.is_absolute() {
            return Err(BinderyError::ConfigurationError(
                "storage_path must be an absolute path".to_string()
            ));
        }
        self.storage_path = Some(path);
        Ok(self)
    }

    /// Validate and set database path
    pub fn with_database_path(mut self, path: impl Into<std::path::PathBuf>) -> BinderyResult<Self> {
        let path = path.into();
        if !path.is_absolute() {
            return Err(BinderyError::ConfigurationError(
                "database_path must be an absolute path".to_string()
            ));
        }
        self.database_path = Some(path);
        Ok(self)
    }

    /// Validate and set audit database path
    pub fn with_audit_db_path(mut self, path: impl Into<std::path::PathBuf>) -> BinderyResult<Self> {
        let path = path.into();
        if !path.is_absolute() {
            return Err(BinderyError::ConfigurationError(
                "audit_db_path must be an absolute path".to_string()
            ));
        }
        self.audit_db_path = Some(path.clone());

        // Also set the audit config if not already set
        if self.audit_config.is_none() {
            self.audit_config = Some(observability::AuditConfig {
                audit_db_path: path,
                ..observability::default_audit_config()
            });
        }

        Ok(self)
    }

    /// Enable collaboration with required fields
    pub fn with_collaboration(
        mut self,
        user_id: impl Into<String>,
        project_id: impl Into<String>
    ) -> Self {
        self.collaboration_enabled = true;
        self.user_id = Some(user_id.into());
        self.project_id = Some(project_id.into());
        self
    }

    /// Enable audit logging with configuration
    pub fn with_audit_logging(mut self, audit_config: observability::AuditConfig) -> BinderyResult<Self> {
        observability::validate_audit_config(&audit_config)?;
        self.audit_config = Some(audit_config);
        self.audit_logging_enabled = true;
        Ok(self)
    }

    /// Set memory limits with validation
    pub fn with_memory_limits(
        mut self,
        max_operations: usize,
        gc_interval_seconds: u64
    ) -> BinderyResult<Self> {
        if max_operations == 0 {
            return Err(BinderyError::ConfigurationError(
                "max_operations_in_memory must be greater than 0".to_string()
            ));
        }

        if gc_interval_seconds < 60 {
            return Err(BinderyError::ConfigurationError(
                "gc_interval_seconds must be at least 60 seconds".to_string()
            ));
        }

        self.max_operations_in_memory = max_operations;
        self.gc_interval_seconds = gc_interval_seconds;
        Ok(self)
    }
}

/// Builder for BinderyConfig with validation
#[derive(Debug, Default)]
pub struct BinderyConfigBuilder {
    storage_path: Option<std::path::PathBuf>,
    database_path: Option<std::path::PathBuf>,
    audit_db_path: Option<std::path::PathBuf>,
    database_pool: Option<database::DatabasePoolConfig>,
    audit_config: Option<observability::AuditConfig>,
    collaboration_enabled: bool,
    max_operations_in_memory: Option<usize>,
    auto_gc_enabled: Option<bool>,
    gc_interval_seconds: Option<u64>,
    compression_enabled: Option<bool>,
    user_id: Option<UserId>,
    project_id: Option<ProjectId>,
    audit_logging_enabled: bool,
}

impl BinderyConfigBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn storage_path(mut self, path: impl Into<std::path::PathBuf>) -> BinderyResult<Self> {
        let path = path.into();
        if !path.is_absolute() {
            return Err(BinderyError::ConfigurationError(
                "storage_path must be an absolute path".to_string()
            ));
        }
        self.storage_path = Some(path);
        Ok(self)
    }

    pub fn database_path(mut self, path: impl Into<std::path::PathBuf>) -> BinderyResult<Self> {
        let path = path.into();
        if !path.is_absolute() {
            return Err(BinderyError::ConfigurationError(
                "database_path must be an absolute path".to_string()
            ));
        }
        self.database_path = Some(path);
        Ok(self)
    }

    pub fn audit_db_path(mut self, path: impl Into<std::path::PathBuf>) -> BinderyResult<Self> {
        let path = path.into();
        if !path.is_absolute() {
            return Err(BinderyError::ConfigurationError(
                "audit_db_path must be an absolute path".to_string()
            ));
        }
        self.audit_db_path = Some(path);
        Ok(self)
    }

    pub fn database_pool(mut self, config: database::DatabasePoolConfig) -> BinderyResult<Self> {
        config.validate()?;
        self.database_pool = Some(config);
        Ok(self)
    }

    pub fn audit_config(mut self, config: observability::AuditConfig) -> BinderyResult<Self> {
        observability::validate_audit_config(&config)?;
        self.audit_config = Some(config);
        self.audit_logging_enabled = true;
        Ok(self)
    }

    pub fn collaboration(
        mut self,
        enabled: bool,
        user_id: Option<impl Into<String>>,
        project_id: Option<impl Into<String>>
    ) -> BinderyResult<Self> {
        if enabled {
            if user_id.is_none() {
                return Err(BinderyError::ConfigurationError(
                    "user_id must be provided when collaboration is enabled".to_string()
                ));
            }
            if project_id.is_none() {
                return Err(BinderyError::ConfigurationError(
                    "project_id must be provided when collaboration is enabled".to_string()
                ));
            }
            self.user_id = user_id.map(|id| id.into());
            self.project_id = project_id.map(|id| id.into());
        }
        self.collaboration_enabled = enabled;
        Ok(self)
    }

    pub fn memory_limits(mut self, max_operations: usize, gc_interval_seconds: u64) -> BinderyResult<Self> {
        if max_operations == 0 {
            return Err(BinderyError::ConfigurationError(
                "max_operations_in_memory must be greater than 0".to_string()
            ));
        }

        if gc_interval_seconds < 60 {
            return Err(BinderyError::ConfigurationError(
                "gc_interval_seconds must be at least 60 seconds".to_string()
            ));
        }

        self.max_operations_in_memory = Some(max_operations);
        self.gc_interval_seconds = Some(gc_interval_seconds);
        Ok(self)
    }

    pub fn auto_gc_enabled(mut self, enabled: bool) -> Self {
        self.auto_gc_enabled = Some(enabled);
        self
    }

    pub fn compression_enabled(mut self, enabled: bool) -> Self {
        self.compression_enabled = Some(enabled);
        self
    }

    pub fn audit_logging_enabled(mut self, enabled: bool) -> Self {
        self.audit_logging_enabled = enabled;
        self
    }

    pub fn build(self) -> BinderyResult<BinderyConfig> {
        let config = BinderyConfig {
            storage_path: self.storage_path,
            database_path: self.database_path,
            audit_db_path: self.audit_db_path,
            database_pool: self.database_pool.unwrap_or_default(),
            audit_config: self.audit_config,
            collaboration_enabled: self.collaboration_enabled,
            max_operations_in_memory: self.max_operations_in_memory.unwrap_or(1000),
            auto_gc_enabled: self.auto_gc_enabled.unwrap_or(true),
            gc_interval_seconds: self.gc_interval_seconds.unwrap_or(300),
            compression_enabled: self.compression_enabled.unwrap_or(true),
            user_id: self.user_id,
            project_id: self.project_id,
            audit_logging_enabled: self.audit_logging_enabled,
        };

        config.validate()?;
        Ok(config)
    }
}

impl CodexManager {
    /// Create a new CodexManager with default configuration
    pub fn new() -> Result<Self> {
        Self::with_config(BinderyConfig::default())
    }

    /// Create a new CodexManager with custom configuration
    pub fn with_config(config: BinderyConfig) -> Result<Self> {
        // Validate configuration before proceeding
        config.validate().map_err(|e| anyhow::anyhow!("Configuration validation failed: {}", e))?;
        let templates = Arc::new(templates::TemplateRegistry::new());

        let sync_manager = if config.collaboration_enabled {
            Some(Arc::new(sync::SyncManager::new(config.clone())?))
        } else {
            None
        };

        // Initialize role and hook managers first
        let role_manager = Arc::new(RoleManager::default());
        let hook_manager = Arc::new(HookManager::default());

        let manager = Self {
            inner: Arc::new(CodexManagerInner {
                codices: tokio::sync::RwLock::new(HashMap::new()),
                templates,
                task_manager: None, // Will be initialized below
                role_manager: role_manager.clone(),
                hook_manager: hook_manager.clone(),
                sync_manager,
                config,
            }),
        };

        // Initialize task manager after CodexManager creation to avoid circular dependency
        // Use a simplified initialization that doesn't require database configuration
        let _task_manager = if manager.inner.config.database_path.is_some() {
            // Create task service with the CodexManager
            let manager_arc = Arc::new(manager.clone());
            let _task_service = Arc::new(task_management::TaskService::new(manager_arc.clone()));
            let task_manager = task_management::TaskManager::new(
                manager_arc,
                role_manager,
                hook_manager,
            );
            Some(Arc::new(task_manager))
        } else {
            // Task management can still work without database for basic operations
            tracing::info!("No database path configured, but task management is available through Codex layer");
            let manager_arc = Arc::new(manager.clone());
            let _task_service = Arc::new(task_management::TaskService::new(manager_arc.clone()));
            let task_manager = task_management::TaskManager::new(
                manager_arc,
                role_manager.clone(),
                hook_manager.clone(),
            );
            Some(Arc::new(task_manager))
        };

        // Note: In the current architecture, we cannot update the task_manager field
        // after construction due to Arc<CodexManagerInner>. The task manager is available
        // through the get_task_manager() method which constructs it on demand.

        Ok(manager)
    }

    /// Create a new Codex with the specified title and template
    pub async fn create_codex(&self, title: impl Into<String>, template_id: impl Into<TemplateId>) -> BinderyResult<CodexId> {
        let id = Uuid::new_v4();
        let title = title.into();
        let template_id = template_id.into();

        // Verify template exists
        let template_registry_id = templates::TemplateId::new(template_id.to_string());
        let _template = self.inner.templates.get(&template_registry_id)
            .ok_or_else(|| BinderyError::TemplateNotFound(template_registry_id))?;

        let created_by = self.inner.config.user_id.clone().unwrap_or_else(|| "system".to_string());
        let mut crdt = crdt::VesperaCRDT::new(id, created_by);

        // Initialize the CRDT with title and template metadata
        // Note: This is a simplified implementation - full template integration would require
        // loading template fields and creating appropriate CRDT structures
        crdt.set_title(&title);

        let crdt = Arc::new(crdt);

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

    /// Get a task manager instance
    ///
    /// This method creates a new TaskManager instance on demand to avoid
    /// circular dependency issues during initialization.
    pub fn get_task_manager(&self) -> Arc<TaskManager> {
        Arc::new(task_management::TaskManager::new(
            Arc::new(self.clone()),
            self.inner.role_manager.clone(),
            self.inner.hook_manager.clone(),
        ))
    }

    /// Perform garbage collection on all managed Codices
    pub async fn gc_all_codices(&self) -> Result<CodexManagerGCStats> {
        self.gc_all_codices_with_config(GarbageCollectionConfig::default()).await
    }

    /// Perform garbage collection on all managed Codices with custom configuration
    pub async fn gc_all_codices_with_config(&self, config: GarbageCollectionConfig) -> Result<CodexManagerGCStats> {
        let mut total_stats = CodexManagerGCStats::default();
        let cutoff = chrono::Utc::now() - chrono::Duration::hours(config.cutoff_hours);
        let mut processed_codices = Vec::new();

        {
            let codices = self.inner.codices.read().await;

            // First pass: collect IDs and check memory usage
            for (id, crdt) in codices.iter() {
                total_stats.codices_processed += 1;
                let memory_stats = crdt.memory_stats();
                total_stats.total_memory_before += memory_stats.total_size_bytes;

                if memory_stats.total_size_bytes > config.memory_threshold_bytes {
                    processed_codices.push(*id);
                }
            }
        }

        // Second pass: perform actual GC with write locks
        for codex_id in processed_codices {
            if let Some(crdt) = {
                let codices = self.inner.codices.read().await;
                codices.get(&codex_id).cloned()
            } {
                // Perform GC operations on the individual CRDT
                let mut crdt_clone = (*crdt).clone();
                let gc_stats = crdt_clone.gc_all_with_limits(
                    cutoff,
                    config.max_operations_per_codex,
                    config.max_tree_tombstones_per_codex
                );

                // Update the CRDT in the map if GC made significant changes
                if gc_stats.operations_removed > 0 || gc_stats.tree_tombstones_removed > 0 {
                    let mut codices = self.inner.codices.write().await;
                    codices.insert(codex_id, Arc::new(crdt_clone));

                    total_stats.operations_removed += gc_stats.operations_removed;
                    total_stats.tree_tombstones_removed += gc_stats.tree_tombstones_removed;
                    total_stats.memory_freed_bytes += gc_stats.memory_freed_bytes;
                }
            }
        }

        // Calculate final memory usage
        {
            let codices = self.inner.codices.read().await;
            for crdt in codices.values() {
                let memory_stats = crdt.memory_stats();
                total_stats.total_memory_after += memory_stats.total_size_bytes;
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

/// Configuration for garbage collection operations
#[derive(Debug, Clone)]
pub struct GarbageCollectionConfig {
    /// How many hours old operations must be to be eligible for GC
    pub cutoff_hours: i64,
    /// Memory threshold in bytes - only GC codices above this size
    pub memory_threshold_bytes: usize,
    /// Maximum operations to keep per codex after GC
    pub max_operations_per_codex: usize,
    /// Maximum tree tombstones to keep per codex after GC
    pub max_tree_tombstones_per_codex: usize,
}

impl Default for GarbageCollectionConfig {
    fn default() -> Self {
        Self {
            cutoff_hours: 1,
            memory_threshold_bytes: 1024 * 1024, // 1MB
            max_operations_per_codex: 500,
            max_tree_tombstones_per_codex: 100,
        }
    }
}

/// Statistics from garbage collection across all Codices
#[derive(Debug, Default)]
pub struct CodexManagerGCStats {
    pub codices_processed: usize,
    pub operations_removed: usize,
    pub tree_tombstones_removed: usize,
    pub memory_freed_bytes: usize,
    pub total_memory_before: usize,
    pub total_memory_after: usize,
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