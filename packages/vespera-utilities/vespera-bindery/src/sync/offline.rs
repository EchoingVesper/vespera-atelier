//! Offline-first synchronization support

use std::collections::VecDeque;
use serde::{Deserialize, Serialize};
use crate::{BinderyResult, crdt::CRDTOperation};

/// Manager for offline operations and queuing
#[derive(Debug)]
pub struct OfflineManager {
    queue: OfflineQueue,
}

impl OfflineManager {
    /// Create a new offline manager
    pub fn new() -> Self {
        Self {
            queue: OfflineQueue::new(),
        }
    }
    
    /// Queue an operation for later synchronization
    pub fn queue_operation(&mut self, operation: CRDTOperation) {
        self.queue.push(operation);
    }
    
    /// Get all queued operations
    pub fn get_queued_operations(&self) -> Vec<&CRDTOperation> {
        self.queue.iter().collect()
    }
    
    /// Clear queued operations (after successful sync)
    pub fn clear_queue(&mut self) {
        self.queue.clear();
    }
}

/// Queue for offline operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfflineQueue {
    operations: VecDeque<CRDTOperation>,
    max_size: usize,
}

impl OfflineQueue {
    /// Create a new offline queue
    pub fn new() -> Self {
        Self {
            operations: VecDeque::new(),
            max_size: 1000, // Default max queue size
        }
    }
    
    /// Push an operation to the queue
    pub fn push(&mut self, operation: CRDTOperation) {
        self.operations.push_back(operation);
        
        // Remove oldest operations if queue is full
        while self.operations.len() > self.max_size {
            self.operations.pop_front();
        }
    }
    
    /// Pop an operation from the queue
    pub fn pop(&mut self) -> Option<CRDTOperation> {
        self.operations.pop_front()
    }
    
    /// Get iterator over operations
    pub fn iter(&self) -> impl Iterator<Item = &CRDTOperation> {
        self.operations.iter()
    }
    
    /// Clear all operations
    pub fn clear(&mut self) {
        self.operations.clear();
    }
    
    /// Get queue size
    pub fn len(&self) -> usize {
        self.operations.len()
    }
    
    /// Check if queue is empty
    pub fn is_empty(&self) -> bool {
        self.operations.is_empty()
    }
}

impl Default for OfflineManager {
    fn default() -> Self {
        Self::new()
    }
}

impl Default for OfflineQueue {
    fn default() -> Self {
        Self::new()
    }
}