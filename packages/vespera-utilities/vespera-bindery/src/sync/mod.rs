//! Network synchronization for real-time collaboration

use std::sync::Arc;
use crate::{BinderyResult, BinderyConfig, types::CodexId, crdt::VesperaCRDT};

// Sub-modules for synchronization
pub mod protocol;
pub mod conflict;
pub mod offline;

// Re-export commonly used types
pub use protocol::{SyncProtocol, SyncMessage};
pub use conflict::{ConflictResolver, ConflictResolution};
pub use offline::{OfflineManager, OfflineQueue};

/// Manager for real-time synchronization
#[derive(Debug)]
pub struct SyncManager {
    config: BinderyConfig,
    /// Active Codex registrations using weak references to prevent circular dependencies
    registered_codices: std::sync::RwLock<std::collections::HashMap<CodexId, std::sync::Weak<VesperaCRDT>>>,
    /// Active connections that need cleanup
    active_connections: std::sync::RwLock<std::collections::HashMap<String, ConnectionHandle>>,
}

/// Handle for an active network connection
#[derive(Debug)]
pub struct ConnectionHandle {
    pub connection_id: String,
    pub peer_id: Option<String>,
    pub connected_at: chrono::DateTime<chrono::Utc>,
    /// Channel sender for cleanup signals
    pub cleanup_sender: Option<tokio::sync::oneshot::Sender<()>>,
}

impl SyncManager {
    /// Create a new sync manager
    pub fn new(config: BinderyConfig) -> BinderyResult<Self> {
        Ok(Self {
            config,
            registered_codices: std::sync::RwLock::new(std::collections::HashMap::new()),
            active_connections: std::sync::RwLock::new(std::collections::HashMap::new()),
        })
    }
    
    /// Register a Codex for synchronization using weak references to prevent cycles
    pub async fn register_codex(&self, codex_id: CodexId, crdt: Arc<VesperaCRDT>) -> BinderyResult<()> {
        let weak_ref = Arc::downgrade(&crdt);
        
        {
            let mut registered = self.registered_codices.write()
                .map_err(|_| crate::BinderyError::InternalError("Lock poisoned".to_string()))?;
            registered.insert(codex_id, weak_ref);
        }
        
        // TODO: Start actual synchronization for this Codex
        Ok(())
    }
    
    /// Unregister a Codex from synchronization
    pub async fn unregister_codex(&self, codex_id: &CodexId) -> BinderyResult<()> {
        {
            let mut registered = self.registered_codices.write()
                .map_err(|_| crate::BinderyError::InternalError("Lock poisoned".to_string()))?;
            registered.remove(codex_id);
        }
        
        // TODO: Stop synchronization for this Codex
        Ok(())
    }
    
    /// Clean up dead weak references
    pub fn cleanup_dead_references(&self) -> usize {
        let mut cleaned = 0;
        
        if let Ok(mut registered) = self.registered_codices.write() {
            registered.retain(|_, weak_ref| {
                let is_alive = weak_ref.upgrade().is_some();
                if !is_alive {
                    cleaned += 1;
                }
                is_alive
            });
        }
        
        cleaned
    }
    
    /// Register a new network connection
    pub fn register_connection(&self, connection_id: String, peer_id: Option<String>) -> BinderyResult<()> {
        let handle = ConnectionHandle {
            connection_id: connection_id.clone(),
            peer_id,
            connected_at: chrono::Utc::now(),
            cleanup_sender: None, // TODO: Implement cleanup channel
        };
        
        let mut connections = self.active_connections.write()
            .map_err(|_| crate::BinderyError::InternalError("Lock poisoned".to_string()))?;
        connections.insert(connection_id, handle);
        
        Ok(())
    }
    
    /// Unregister and clean up a network connection
    pub fn unregister_connection(&self, connection_id: &str) -> BinderyResult<bool> {
        let mut connections = self.active_connections.write()
            .map_err(|_| crate::BinderyError::InternalError("Lock poisoned".to_string()))?;
        
        if let Some(mut handle) = connections.remove(connection_id) {
            // Signal cleanup if channel exists
            if let Some(sender) = handle.cleanup_sender.take() {
                let _ = sender.send(()); // Ignore if receiver is gone
            }
            Ok(true)
        } else {
            Ok(false)
        }
    }
    
    /// Get statistics about active connections and registrations
    pub fn get_stats(&self) -> SyncManagerStats {
        let registered_count = self.registered_codices.read()
            .map(|r| r.len())
            .unwrap_or(0);
            
        let active_connections = self.active_connections.read()
            .map(|c| c.len())
            .unwrap_or(0);
        
        SyncManagerStats {
            registered_codices: registered_count,
            active_connections,
        }
    }
    
    /// Start synchronization
    pub async fn start(&self) -> BinderyResult<()> {
        // TODO: Implement sync startup
        Ok(())
    }
    
    /// Stop synchronization and clean up all resources
    pub async fn stop(&self) -> BinderyResult<()> {
        // Clean up all active connections
        let connection_ids: Vec<String> = {
            let connections = self.active_connections.read()
                .map_err(|_| crate::BinderyError::InternalError("Lock poisoned".to_string()))?;
            connections.keys().cloned().collect()
        };
        
        for connection_id in connection_ids {
            let _ = self.unregister_connection(&connection_id);
        }
        
        // Clean up all Codex registrations
        {
            let mut registered = self.registered_codices.write()
                .map_err(|_| crate::BinderyError::InternalError("Lock poisoned".to_string()))?;
            registered.clear();
        }
        
        // TODO: Implement additional sync shutdown logic
        Ok(())
    }
}

/// Statistics about the sync manager's resource usage
#[derive(Debug, Clone)]
pub struct SyncManagerStats {
    pub registered_codices: usize,
    pub active_connections: usize,
}

/// Implement Drop to ensure cleanup
impl Drop for SyncManager {
    fn drop(&mut self) {
        // Best effort cleanup on drop
        let _ = futures::executor::block_on(self.stop());
    }
}