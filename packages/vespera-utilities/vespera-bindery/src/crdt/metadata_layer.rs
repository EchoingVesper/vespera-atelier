//! Metadata layer CRDT using Last-Writer-Wins (LWW) semantics

use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use crate::types::UserId;

/// Last-Writer-Wins Map for metadata that needs simple conflict resolution
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
    pub fn set(&mut self, key: K, value: V) -> LWWEntry<V> {
        let entry = LWWEntry {
            value: value.clone(),
            timestamp: Utc::now(),
            user_id: "system".to_string(), // TODO: Get from context
            operation_id: uuid::Uuid::new_v4(),
        };
        
        self.entries.insert(key, entry.clone());
        entry
    }
    
    /// Set a value with explicit timestamp and user (for synchronization)
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
            user_id: "system".to_string(), // TODO: Get from context
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
        let user_id = "system".to_string(); // TODO: Get from context
        
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