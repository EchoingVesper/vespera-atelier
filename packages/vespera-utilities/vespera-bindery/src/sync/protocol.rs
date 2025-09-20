//! Network protocol for CRDT synchronization

use serde::{Deserialize, Serialize};
use crate::{types::{CodexId, UserId}, crdt::CRDTOperation};

/// Synchronization protocol implementation
#[derive(Debug)]
pub struct SyncProtocol {
    // TODO: Add protocol state
}

impl SyncProtocol {
    /// Create a new sync protocol instance
    pub fn new() -> Self {
        Self {}
    }
}

/// Messages sent over the network for synchronization
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum SyncMessage {
    /// Sync request from a peer
    SyncRequest {
        codex_id: CodexId,
        vector_clock: crate::types::VectorClock,
    },
    
    /// Response with missing operations
    SyncResponse {
        codex_id: CodexId,
        operations: Vec<CRDTOperation>,
    },
    
    /// Real-time operation broadcast
    OperationBroadcast {
        operation: CRDTOperation,
    },
    
    /// Heartbeat message
    Heartbeat {
        user_id: UserId,
        timestamp: chrono::DateTime<chrono::Utc>,
    },
    
    /// Error message
    Error {
        message: String,
        error_code: Option<u32>,
    },
}

impl Default for SyncProtocol {
    fn default() -> Self {
        Self::new()
    }
}