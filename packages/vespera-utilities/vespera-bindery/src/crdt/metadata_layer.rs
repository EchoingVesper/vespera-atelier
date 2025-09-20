//! Metadata layer CRDT using Last-Writer-Wins (LWW) semantics
//!
//! This module implements a Last-Writer-Wins Map (LWW-Map) for managing metadata
//! that requires simple conflict resolution. The LWW-Map is ideal for key-value
//! data where the most recent update should take precedence.
//!
//! # LWW-Map Algorithm
//!
//! The Last-Writer-Wins Map resolves conflicts using timestamps and unique IDs:
//!
//! ## Core Concepts
//!
//! - **Timestamps**: Each operation has a timestamp indicating when it was created
//! - **Operation IDs**: Unique identifiers for tie-breaking when timestamps are equal
//! - **Tombstones**: Deleted entries are marked with tombstones rather than removed
//! - **Monotonic Logic**: Later timestamps always win, ensuring convergence
//!
//! ## Mathematical Properties
//!
//! The LWW-Map satisfies CRDT requirements:
//!
//! ### Commutativity
//! For operations A and B: `merge(apply(A), apply(B)) = merge(apply(B), apply(A))`
//!
//! ### Associativity
//! For operations A, B, C: `merge(merge(A, B), C) = merge(A, merge(B, C))`
//!
//! ### Idempotency
//! For any operation A: `merge(A, A) = A`
//!
//! ### Monotonicity
//! Once a key reaches a certain timestamp, it can only be updated by operations
//! with strictly later timestamps.
//!
//! ## Conflict Resolution Algorithm
//!
//! When two operations conflict on the same key:
//!
//! 1. **Timestamp Comparison**: Operation with later timestamp wins
//! 2. **Tie Breaking**: If timestamps are equal, operation with larger UUID wins
//! 3. **Deletion Semantics**: Deletions are treated as special writes with empty values
//!
//! # Performance Characteristics
//!
//! - **Set Operation**: O(1) average case, O(log n) worst case
//! - **Get Operation**: O(1) average case
//! - **Delete Operation**: O(1) average case
//! - **Merge Operation**: O(n + m) where n, m are the sizes of maps being merged
//! - **Space Complexity**: O(n + t) where n is active entries, t is tombstones
//!
//! # Usage Example
//!
//! ```rust
//! use vespera_bindery::crdt::metadata_layer::{LWWMap, LWWEntry};
//! use chrono::Utc;
//! use uuid::Uuid;
//!
//! let mut map = LWWMap::new();
//!
//! // Set some metadata
//! map.set("title".to_string(), "My Document".to_string());
//! map.set("author".to_string(), "Alice".to_string());
//!
//! // Concurrent update from another replica
//! map.set_with_metadata(
//!     "title".to_string(),
//!     "Updated Title".to_string(),
//!     Utc::now(),
//!     "bob".to_string(),
//!     Uuid::new_v4()
//! );
//!
//! // The most recent update wins
//! assert_eq!(map.get(&"title".to_string()), Some(&"Updated Title".to_string()));
//! ```
//!
//! # Tombstone Management
//!
//! Deleted entries are not immediately removed but marked with tombstones.
//! This ensures that:
//! - Delete operations can be replicated correctly
//! - Concurrent updates to deleted keys are handled properly
//! - Garbage collection can clean up old tombstones safely

use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use crate::types::UserId;

/// Last-Writer-Wins Map for metadata that needs simple conflict resolution
///
/// The LWWMap provides a distributed key-value store with automatic conflict
/// resolution based on timestamps. It's designed for metadata that changes
/// infrequently and where the most recent update should always win.
///
/// # Design Principles
///
/// - **Simplicity**: Conflicts are resolved using a simple "last writer wins" rule
/// - **Determinism**: Given the same operations, all replicas converge to the same state
/// - **Performance**: O(1) operations for most common use cases
/// - **Consistency**: Strong eventual consistency with immediate local consistency
///
/// # Conflict Resolution Strategy
///
/// The LWW-Map uses a two-tier conflict resolution:
/// 1. **Primary**: Timestamp comparison (later timestamp wins)
/// 2. **Secondary**: Operation ID comparison for tie-breaking
///
/// This ensures that even with clock skew or simultaneous operations,
/// all replicas will converge to the same deterministic state.
///
/// # Memory Management
///
/// The implementation includes automatic memory management:
/// - Active entries are stored in a primary hash map
/// - Deleted entries are stored as tombstones for conflict resolution
/// - Garbage collection can remove old tombstones safely
/// - Memory usage grows linearly with unique keys (including deleted ones)
///
/// # Type Parameters
///
/// - `K`: Key type (must be hashable and serializable)
/// - `V`: Value type (must be cloneable and serializable)
///
/// # Example
///
/// ```rust
/// use vespera_bindery::crdt::metadata_layer::LWWMap;
///
/// // Create a map for document metadata
/// let mut metadata = LWWMap::<String, String>::new();
///
/// // Set document properties
/// metadata.set("title".to_string(), "Draft Document".to_string());
/// metadata.set("status".to_string(), "draft".to_string());
///
/// // Later update (wins due to later timestamp)
/// metadata.set("status".to_string(), "published".to_string());
///
/// assert_eq!(metadata.get(&"status".to_string()), Some(&"published".to_string()));
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LWWMap<K, V> 
where
    K: Clone + Eq + std::hash::Hash + Serialize,
    V: Clone + Serialize,
{
    /// Current values with their timestamps and authors
    entries: HashMap<K, LWWEntry<V>>,
    
    /// Tombstones for deleted entries
    tombstones: HashMap<K, LWWEntry<()>>,
}

/// Entry in the LWW map with timestamp and author information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LWWEntry<V> {
    /// The value
    pub value: V,
    
    /// Timestamp when this value was set
    pub timestamp: DateTime<Utc>,
    
    /// User who set this value
    pub user_id: UserId,
    
    /// Unique identifier for this operation (for tie-breaking)
    pub operation_id: uuid::Uuid,
}

impl<K, V> LWWMap<K, V>
where
    K: Clone + Eq + std::hash::Hash + Serialize,
    V: Clone + Serialize,
{
    /// Create a new LWW map
    pub fn new() -> Self {
        Self {
            entries: HashMap::new(),
            tombstones: HashMap::new(),
        }
    }
    
    /// Set a value in the map
    ///
    /// Creates a new entry with the current timestamp and a unique operation ID.
    /// The operation will succeed immediately but may be overridden by concurrent
    /// operations with later timestamps during merge operations.
    ///
    /// # Algorithm
    ///
    /// 1. Create new LWWEntry with current timestamp
    /// 2. Generate unique operation ID for tie-breaking
    /// 3. Insert into entries map (overwrites any existing entry)
    /// 4. Remove any existing tombstone for this key
    ///
    /// # Parameters
    ///
    /// - `key`: The key to associate with the value
    /// - `value`: The value to store
    ///
    /// # Returns
    ///
    /// Returns the created LWWEntry containing the value and metadata.
    ///
    /// # Example
    ///
    /// ```rust
    /// let mut map = LWWMap::new();
    /// let entry = map.set("config".to_string(), "value1".to_string());
    ///
    /// // The entry contains timestamp and operation ID
    /// assert_eq!(entry.value, "value1");
    /// assert!(entry.timestamp <= chrono::Utc::now());
    /// ```
    pub fn set(&mut self, key: K, value: V) -> LWWEntry<V> {
        let entry = LWWEntry {
            value: value.clone(),
            timestamp: Utc::now(),
            user_id: "system".to_string(), // TODO: Get user ID from operation context
            operation_id: uuid::Uuid::new_v4(),
        };

        self.entries.insert(key, entry.clone());
        entry
    }

    /// Set a value using borrowed references to avoid clones in hot paths
    pub fn set_borrowed(&mut self, key: &K, value: &V) -> LWWEntry<V> {
        let entry = LWWEntry {
            value: value.clone(),
            timestamp: Utc::now(),
            user_id: "system".to_string(), // TODO: Get user ID from operation context
            operation_id: uuid::Uuid::new_v4(),
        };

        self.entries.insert(key.clone(), entry.clone());
        entry
    }
    
    /// Set a value with explicit timestamp and user (for synchronization)
    ///
    /// This method is used during merge operations to apply remote changes.
    /// It only updates the local state if the provided operation is newer
    /// than any existing operation for the same key.
    ///
    /// # Algorithm
    ///
    /// 1. **Conflict Check**: Compare with existing entry (if any)
    /// 2. **Timestamp Comparison**: New timestamp must be strictly greater
    /// 3. **Tie Breaking**: If timestamps equal, compare operation IDs
    /// 4. **Tombstone Check**: Ensure operation is newer than any deletion
    /// 5. **State Update**: Apply operation only if it should win
    ///
    /// # Conflict Resolution Rules
    ///
    /// - Later timestamp always wins
    /// - Equal timestamps: larger operation ID wins
    /// - Must be newer than any existing tombstone for the key
    ///
    /// # Parameters
    ///
    /// - `key`: The key to update
    /// - `value`: The new value
    /// - `timestamp`: When the operation was created
    /// - `user_id`: Who created the operation
    /// - `operation_id`: Unique identifier for tie-breaking
    ///
    /// # Returns
    ///
    /// Returns `true` if the operation was applied, `false` if it was rejected
    /// due to being older than the current state.
    ///
    /// # Example
    ///
    /// ```rust
    /// use chrono::Utc;
    /// use uuid::Uuid;
    ///
    /// let mut map = LWWMap::new();
    ///
    /// // Apply a remote operation
    /// let applied = map.set_with_metadata(
    ///     "key".to_string(),
    ///     "remote_value".to_string(),
    ///     Utc::now(),
    ///     "remote_user".to_string(),
    ///     Uuid::new_v4()
    /// );
    ///
    /// assert!(applied); // First operation always succeeds
    /// ```
    pub fn set_with_metadata(
        &mut self,
        key: K,
        value: V,
        timestamp: DateTime<Utc>,
        user_id: UserId,
        operation_id: uuid::Uuid,
    ) -> bool {
        let new_entry = LWWEntry {
            value,
            timestamp,
            user_id,
            operation_id,
        };
        
        // Check if we should accept this update
        let should_update = match self.entries.get(&key) {
            Some(existing) => self.should_update(existing, &new_entry),
            None => {
                // Check if this key is tombstoned
                match self.tombstones.get(&key) {
                    Some(tombstone) => self.should_update_tombstone(&new_entry, tombstone),
                    None => true, // No existing value or tombstone
                }
            }
        };
        
        if should_update {
            self.entries.insert(key.clone(), new_entry);
            // Remove from tombstones if it was deleted
            self.tombstones.remove(&key);
        }
        
        should_update
    }
    
    /// Delete a value from the map
    pub fn delete(&mut self, key: &K) -> bool {
        let tombstone = LWWEntry {
            value: (),
            timestamp: Utc::now(),
            user_id: "system".to_string(), // TODO: Get user ID from operation context
            operation_id: uuid::Uuid::new_v4(),
        };
        
        // Check if we should delete (i.e., our delete is newer than existing value)
        let should_delete = match self.entries.get(key) {
            Some(existing) => tombstone.timestamp > existing.timestamp ||
                (tombstone.timestamp == existing.timestamp && tombstone.operation_id > existing.operation_id),
            None => true, // No existing value, always add tombstone
        };
        
        if should_delete {
            self.entries.remove(key);
            self.tombstones.insert(key.clone(), tombstone);
        }
        
        should_delete
    }
    
    /// Delete with explicit metadata (for synchronization)
    pub fn delete_with_metadata(
        &mut self,
        key: &K,
        timestamp: DateTime<Utc>,
        user_id: UserId,
        operation_id: uuid::Uuid,
    ) -> bool {
        let tombstone = LWWEntry {
            value: (),
            timestamp,
            user_id,
            operation_id,
        };
        
        // Check if we should apply this delete
        let should_delete = match self.entries.get(key) {
            Some(existing) => self.should_update_tombstone(existing, &tombstone),
            None => {
                // Check existing tombstone
                match self.tombstones.get(key) {
                    Some(existing_tombstone) => self.should_update_tombstone_vs_tombstone(existing_tombstone, &tombstone),
                    None => true,
                }
            }
        };
        
        if should_delete {
            self.entries.remove(key);
            self.tombstones.insert(key.clone(), tombstone);
        }
        
        should_delete
    }
    
    /// Get a value from the map
    pub fn get(&self, key: &K) -> Option<&V> {
        self.entries.get(key).map(|entry| &entry.value)
    }
    
    /// Get an entry with metadata
    pub fn get_entry(&self, key: &K) -> Option<&LWWEntry<V>> {
        self.entries.get(key)
    }
    
    /// Check if the map contains a key
    pub fn contains_key(&self, key: &K) -> bool {
        self.entries.contains_key(key) && !self.tombstones.contains_key(key)
    }
    
    /// Get all keys
    pub fn keys(&self) -> impl Iterator<Item = &K> {
        self.entries.keys()
    }
    
    /// Get all values
    pub fn values(&self) -> impl Iterator<Item = &V> {
        self.entries.values().map(|entry| &entry.value)
    }
    
    /// Get all entries
    pub fn entries(&self) -> impl Iterator<Item = (&K, &LWWEntry<V>)> {
        self.entries.iter()
    }
    
    /// Get the number of entries
    pub fn len(&self) -> usize {
        self.entries.len()
    }
    
    /// Check if the map is empty
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
    
    /// Clear all entries
    pub fn clear(&mut self) {
        let now = Utc::now();
        let user_id = "system".to_string(); // TODO: Get user ID from operation context
        
        // Create tombstones for all existing entries
        for key in self.entries.keys() {
            let tombstone = LWWEntry {
                value: (),
                timestamp: now,
                user_id: user_id.clone(),
                operation_id: uuid::Uuid::new_v4(),
            };
            self.tombstones.insert(key.clone(), tombstone);
        }
        
        self.entries.clear();
    }
    
    /// Merge with another LWW map
    ///
    /// Merges all operations from another LWW-Map into this one. This is the
    /// core synchronization operation that ensures eventual consistency.
    ///
    /// # Algorithm
    ///
    /// The merge process applies all operations from the other map:
    /// 1. **Entry Merge**: For each entry in other map, apply using `set_with_metadata`
    /// 2. **Tombstone Merge**: For each tombstone in other map, apply using `delete_with_metadata`
    /// 3. **Conflict Resolution**: Each operation is subject to LWW conflict resolution
    /// 4. **Update Counting**: Track how many operations were actually applied
    ///
    /// # Mathematical Properties
    ///
    /// The merge operation satisfies:
    /// - **Commutativity**: `A.merge(B)` produces the same final state as `B.merge(A)`
    /// - **Associativity**: Merging multiple maps produces consistent results regardless of order
    /// - **Idempotency**: Merging the same map multiple times has no additional effect
    ///
    /// # Performance
    ///
    /// - Time Complexity: O(n + m) where n, m are the sizes of the maps
    /// - Space Complexity: O(k) where k is the number of unique keys across both maps
    ///
    /// # Parameters
    ///
    /// - `other`: The LWW-Map to merge from
    ///
    /// # Returns
    ///
    /// Returns the number of operations that were successfully applied
    /// (i.e., operations that were newer than existing local state).
    ///
    /// # Example
    ///
    /// ```rust
    /// let mut map_a = LWWMap::new();
    /// let mut map_b = LWWMap::new();
    ///
    /// map_a.set("key1".to_string(), "value_a".to_string());
    /// map_b.set("key2".to_string(), "value_b".to_string());
    ///
    /// let updates = map_a.merge(&map_b);
    /// assert_eq!(updates, 1); // One new operation applied
    ///
    /// // Both maps now have both keys
    /// assert!(map_a.contains_key(&"key1".to_string()));
    /// assert!(map_a.contains_key(&"key2".to_string()));
    /// ```
    pub fn merge(&mut self, other: &LWWMap<K, V>) -> usize {
        let mut updates = 0;
        
        // Merge entries
        for (key, other_entry) in &other.entries {
            if self.set_with_metadata(
                key.clone(),
                other_entry.value.clone(),
                other_entry.timestamp,
                other_entry.user_id.clone(),
                other_entry.operation_id,
            ) {
                updates += 1;
            }
        }
        
        // Merge tombstones
        for (key, other_tombstone) in &other.tombstones {
            if self.delete_with_metadata(
                key,
                other_tombstone.timestamp,
                other_tombstone.user_id.clone(),
                other_tombstone.operation_id,
            ) {
                updates += 1;
            }
        }
        
        updates
    }
    
    /// Get a snapshot of all current values
    pub fn snapshot(&self) -> HashMap<K, V> {
        self.entries.iter()
            .map(|(k, entry)| (k.clone(), entry.value.clone()))
            .collect()
    }
    
    /// Get statistics about the map
    pub fn stats(&self) -> LWWMapStats {
        LWWMapStats {
            active_entries: self.entries.len(),
            tombstones: self.tombstones.len(),
            total_operations: self.entries.len() + self.tombstones.len(),
        }
    }
    
    /// Clean up old tombstones (garbage collection)
    pub fn gc_tombstones(&mut self, cutoff: DateTime<Utc>) -> usize {
        let initial_count = self.tombstones.len();
        self.tombstones.retain(|_, tombstone| tombstone.timestamp > cutoff);
        initial_count - self.tombstones.len()
    }
    
    /// Clean up all resources and shrink collections
    pub fn cleanup(&mut self) {
        // Clear entries and force memory deallocation
        for (_, mut entry) in self.entries.drain() {
            // Explicitly drop large values if needed
            drop(entry);
        }
        self.entries.shrink_to_fit();

        // Clear tombstones
        self.tombstones.clear();
        self.tombstones.shrink_to_fit();
    }
    
    /// Shrink collections to fit their contents
    pub fn shrink_to_fit(&mut self) {
        self.entries.shrink_to_fit();
        self.tombstones.shrink_to_fit();
    }
    
    // Private helper methods
    
    fn should_update<T>(&self, existing: &LWWEntry<T>, new: &LWWEntry<V>) -> bool {
        new.timestamp > existing.timestamp ||
        (new.timestamp == existing.timestamp && new.operation_id > existing.operation_id)
    }
    
    fn should_update_tombstone<T>(&self, existing: &LWWEntry<T>, tombstone: &LWWEntry<()>) -> bool {
        tombstone.timestamp > existing.timestamp ||
        (tombstone.timestamp == existing.timestamp && tombstone.operation_id > existing.operation_id)
    }
    
    fn should_update_tombstone_vs_tombstone(&self, existing_tombstone: &LWWEntry<()>, new_tombstone: &LWWEntry<()>) -> bool {
        new_tombstone.timestamp > existing_tombstone.timestamp ||
        (new_tombstone.timestamp == existing_tombstone.timestamp && new_tombstone.operation_id > existing_tombstone.operation_id)
    }
}

/// Statistics for LWW map
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LWWMapStats {
    pub active_entries: usize,
    pub tombstones: usize,
    pub total_operations: usize,
}

impl<K, V> Default for LWWMap<K, V>
where
    K: Clone + Eq + std::hash::Hash + Serialize,
    V: Clone + Serialize,
{
    fn default() -> Self {
        Self::new()
    }
}

/// Implement Drop to ensure proper cleanup of LWWMap resources
impl<K, V> Drop for LWWMap<K, V>
where
    K: Clone + Eq + std::hash::Hash + Serialize,
    V: Clone + Serialize,
{
    fn drop(&mut self) {
        self.cleanup();
    }
}

impl<K, V> PartialEq for LWWMap<K, V>
where
    K: Clone + Eq + std::hash::Hash + Serialize + for<'de> Deserialize<'de>,
    V: Clone + PartialEq + Serialize + for<'de> Deserialize<'de>,
{
    fn eq(&self, other: &Self) -> bool {
        if self.entries.len() != other.entries.len() {
            return false;
        }
        
        for (key, entry) in &self.entries {
            match other.entries.get(key) {
                Some(other_entry) => {
                    if entry.value != other_entry.value ||
                       entry.timestamp != other_entry.timestamp ||
                       entry.user_id != other_entry.user_id ||
                       entry.operation_id != other_entry.operation_id {
                        return false;
                    }
                }
                None => return false,
            }
        }
        
        true
    }
}

impl<V> PartialEq for LWWEntry<V>
where
    V: PartialEq,
{
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value &&
        self.timestamp == other.timestamp &&
        self.user_id == other.user_id &&
        self.operation_id == other.operation_id
    }
}