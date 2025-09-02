//! Reference layer CRDT using Observed-Remove Set (OR-Set) semantics

use std::collections::{HashMap, HashSet};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use crate::types::UserId;

/// Observed-Remove Set for managing cross-Codex references
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ORSet<T>
where
    T: Clone + Eq + std::hash::Hash + Serialize + std::fmt::Debug,
{
    /// Elements with their unique add tags
    elements: HashMap<T, HashSet<ORTag>>,
    
    /// Removed tags (tombstones)
    removed_tags: HashSet<ORTag>,
}

/// Unique tag for OR-Set operations
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct ORTag {
    /// Unique identifier for this operation
    pub operation_id: Uuid,
    
    /// User who performed the operation
    pub user_id: UserId,
    
    /// Timestamp of the operation
    pub timestamp: DateTime<Utc>,
}

impl<T> ORSet<T>
where
    T: Clone + Eq + std::hash::Hash + Serialize + std::fmt::Debug,
{
    /// Create a new OR-Set
    pub fn new() -> Self {
        Self {
            elements: HashMap::new(),
            removed_tags: HashSet::new(),
        }
    }
    
    /// Add an element to the set
    pub fn add(&mut self, element: T) -> ORTag {
        let tag = ORTag {
            operation_id: Uuid::new_v4(),
            user_id: "system".to_string(), // TODO: Get from context
            timestamp: Utc::now(),
        };
        
        self.elements.entry(element).or_insert_with(HashSet::new).insert(tag.clone());
        tag
    }
    
    /// Add an element with explicit tag (for synchronization)
    pub fn add_with_tag(&mut self, element: T, tag: ORTag) -> bool {
        // Only add if the tag hasn't been removed
        if !self.removed_tags.contains(&tag) {
            self.elements.entry(element).or_insert_with(HashSet::new).insert(tag);
            true
        } else {
            false
        }
    }
    
    /// Remove an element from the set
    pub fn remove(&mut self, element: &T) -> Vec<ORTag> {
        if let Some(tags) = self.elements.get(element) {
            let tags_to_remove: Vec<ORTag> = tags.clone().into_iter().collect();
            
            // Add all tags to removed set
            for tag in &tags_to_remove {
                self.removed_tags.insert(tag.clone());
            }
            
            // Remove element
            self.elements.remove(element);
            
            tags_to_remove
        } else {
            Vec::new()
        }
    }
    
    /// Remove specific tags (for synchronization)
    pub fn remove_tags(&mut self, element: &T, tags: &[ORTag]) -> bool {
        let mut any_removed = false;
        
        if let Some(element_tags) = self.elements.get_mut(element) {
            for tag in tags {
                if element_tags.remove(tag) {
                    self.removed_tags.insert(tag.clone());
                    any_removed = true;
                }
            }
            
            // Remove element if no tags left
            if element_tags.is_empty() {
                self.elements.remove(element);
            }
        }
        
        // Always add to removed_tags for future synchronization
        for tag in tags {
            self.removed_tags.insert(tag.clone());
        }
        
        any_removed
    }
    
    /// Check if the set contains an element
    pub fn contains(&self, element: &T) -> bool {
        if let Some(tags) = self.elements.get(element) {
            // Element exists if it has tags that haven't been removed
            tags.iter().any(|tag| !self.removed_tags.contains(tag))
        } else {
            false
        }
    }
    
    /// Get all elements in the set
    pub fn iter(&self) -> impl Iterator<Item = &T> {
        self.elements.iter().filter_map(|(element, tags)| {
            // Include element if it has any non-removed tags
            if tags.iter().any(|tag| !self.removed_tags.contains(tag)) {
                Some(element)
            } else {
                None
            }
        })
    }
    
    /// Get all elements as a vector
    pub fn elements(&self) -> Vec<&T> {
        self.iter().collect()
    }
    
    /// Get the number of elements
    pub fn len(&self) -> usize {
        self.iter().count()
    }
    
    /// Check if the set is empty
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
    
    /// Get tags for a specific element
    pub fn get_tags(&self, element: &T) -> Vec<&ORTag> {
        if let Some(tags) = self.elements.get(element) {
            tags.iter().filter(|tag| !self.removed_tags.contains(tag)).collect()
        } else {
            Vec::new()
        }
    }
    
    /// Clear the set
    pub fn clear(&mut self) {
        // Remove all existing tags
        for tags in self.elements.values() {
            for tag in tags {
                self.removed_tags.insert(tag.clone());
            }
        }
        
        self.elements.clear();
    }
    
    /// Merge with another OR-Set
    pub fn merge(&mut self, other: &ORSet<T>) -> ORSetMergeResult {
        let mut added_elements = 0;
        let mut removed_elements = 0;
        
        // Merge elements
        for (element, tags) in &other.elements {
            for tag in tags {
                if !self.removed_tags.contains(tag) {
                    let element_tags = self.elements.entry(element.clone()).or_insert_with(HashSet::new);
                    if element_tags.insert(tag.clone()) {
                        added_elements += 1;
                    }
                }
            }
        }
        
        // Merge removed tags
        let initial_removed_count = self.removed_tags.len();
        for removed_tag in &other.removed_tags {
            self.removed_tags.insert(removed_tag.clone());
        }
        
        // Remove elements whose tags are now all removed
        let mut elements_to_remove = Vec::new();
        for (element, tags) in &self.elements {
            if tags.iter().all(|tag| self.removed_tags.contains(tag)) {
                elements_to_remove.push(element.clone());
            }
        }
        
        removed_elements = elements_to_remove.len();
        for element in elements_to_remove {
            self.elements.remove(&element);
        }
        
        ORSetMergeResult {
            added_elements,
            removed_elements,
            added_removed_tags: self.removed_tags.len() - initial_removed_count,
        }
    }
    
    /// Create a snapshot of current elements
    pub fn snapshot(&self) -> HashSet<T> {
        self.iter().cloned().collect()
    }
    
    /// Get statistics about the set
    pub fn stats(&self) -> ORSetStats {
        let total_elements = self.elements.len();
        let active_elements = self.len();
        let total_tags = self.elements.values().map(|tags| tags.len()).sum();
        let removed_tags = self.removed_tags.len();
        
        ORSetStats {
            active_elements,
            total_elements,
            total_tags,
            removed_tags,
        }
    }
    
    /// Garbage collect old removed tags
    pub fn gc_removed_tags(&mut self, cutoff: DateTime<Utc>) -> usize {
        let initial_count = self.removed_tags.len();
        self.removed_tags.retain(|tag| tag.timestamp > cutoff);
        initial_count - self.removed_tags.len()
    }
    
    /// Validate set integrity
    pub fn validate(&self) -> Result<(), String> {
        // Check that all elements have at least one non-removed tag
        for (element, tags) in &self.elements {
            if !tags.iter().any(|tag| !self.removed_tags.contains(tag)) {
                return Err(format!("Element {:?} has no active tags", element));
            }
        }
        
        Ok(())
    }
    
    /// Get the difference between this set and another
    pub fn difference(&self, other: &ORSet<T>) -> (Vec<T>, Vec<T>) {
        let self_elements: HashSet<_> = self.snapshot();
        let other_elements: HashSet<_> = other.snapshot();
        
        let only_in_self: Vec<T> = self_elements.difference(&other_elements).cloned().collect();
        let only_in_other: Vec<T> = other_elements.difference(&self_elements).cloned().collect();
        
        (only_in_self, only_in_other)
    }
    
    /// Get the intersection with another set
    pub fn intersection(&self, other: &ORSet<T>) -> Vec<T> {
        let self_elements: HashSet<_> = self.snapshot();
        let other_elements: HashSet<_> = other.snapshot();
        
        self_elements.intersection(&other_elements).cloned().collect()
    }
    
    /// Get the union with another set
    pub fn union(&self, other: &ORSet<T>) -> Vec<T> {
        let self_elements: HashSet<_> = self.snapshot();
        let other_elements: HashSet<_> = other.snapshot();
        
        self_elements.union(&other_elements).cloned().collect()
    }
}

/// Result of merging two OR-Sets
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ORSetMergeResult {
    pub added_elements: usize,
    pub removed_elements: usize,
    pub added_removed_tags: usize,
}

/// Statistics for OR-Set
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ORSetStats {
    pub active_elements: usize,
    pub total_elements: usize,
    pub total_tags: usize,
    pub removed_tags: usize,
}

impl<T> Default for ORSet<T>
where
    T: Clone + Eq + std::hash::Hash + Serialize + std::fmt::Debug,
{
    fn default() -> Self {
        Self::new()
    }
}

impl<T> PartialEq for ORSet<T>
where
    T: Clone + Eq + std::hash::Hash + Serialize + std::fmt::Debug,
{
    fn eq(&self, other: &Self) -> bool {
        // Two OR-Sets are equal if they have the same active elements
        let self_elements: HashSet<_> = self.snapshot();
        let other_elements: HashSet<_> = other.snapshot();
        self_elements == other_elements
    }
}

// Implement IntoIterator for easier usage
impl<T> IntoIterator for ORSet<T>
where
    T: Clone + Eq + std::hash::Hash + Serialize + std::fmt::Debug,
{
    type Item = T;
    type IntoIter = std::vec::IntoIter<T>;
    
    fn into_iter(self) -> Self::IntoIter {
        self.snapshot().into_iter().collect::<Vec<_>>().into_iter()
    }
}