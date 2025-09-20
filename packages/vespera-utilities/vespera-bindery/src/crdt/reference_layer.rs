//! Reference layer CRDT using Observed-Remove Set (OR-Set) semantics
//!
//! This module implements an Observed-Remove Set (OR-Set) for managing cross-document
//! references. The OR-Set is ideal for managing collections where both additions and
//! removals need to be synchronized across distributed replicas.
//!
//! # OR-Set Algorithm
//!
//! The Observed-Remove Set uses unique tags to track additions and removals:
//!
//! ## Core Concepts
//!
//! - **Add Tags**: Each addition operation creates a unique tag
//! - **Remove Operations**: Remove specific tags rather than elements directly
//! - **Element Presence**: An element exists if it has at least one non-removed tag
//! - **Causal Consistency**: Removes can only affect observed additions
//!
//! ## Mathematical Properties
//!
//! The OR-Set satisfies all CRDT requirements:
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
//! ### Causality Preservation
//! Remove operations only affect add operations that were observed at the time
//! of removal, ensuring that concurrent adds are never lost.
//!
//! ## Algorithm Details
//!
//! ### Add Operation
//! 1. Generate unique tag (UUID + timestamp + user)
//! 2. Associate tag with element in elements map
//! 3. Element becomes visible if any non-removed tags exist
//!
//! ### Remove Operation
//! 1. Collect all current tags for the element
//! 2. Add all collected tags to removed_tags set
//! 3. Element becomes invisible when all tags are removed
//!
//! ### Merge Operation
//! 1. Merge all element tags from both sets
//! 2. Merge all removed tags from both sets
//! 3. Update element visibility based on remaining non-removed tags
//!
//! # Performance Characteristics
//!
//! - **Add Operation**: O(1) average case
//! - **Remove Operation**: O(t) where t is the number of tags for the element
//! - **Contains Check**: O(t) where t is the number of tags for the element
//! - **Merge Operation**: O(n + m) where n, m are the sizes of sets being merged
//! - **Space Complexity**: O(n + r) where n is elements with tags, r is removed tags
//!
//! # Memory Management
//!
//! The OR-Set includes sophisticated memory management:
//! - Removed tags are stored separately for conflict resolution
//! - Garbage collection can clean up old removed tags safely
//! - Empty element entries are automatically cleaned up
//! - Memory usage is proportional to total operations (until GC)
//!
//! # Usage Example
//!
//! ```rust
//! use vespera_bindery::crdt::reference_layer::ORSet;
//!
//! let mut references = ORSet::new();
//!
//! // Add some references
//! let tag1 = references.add("doc1->doc2".to_string());
//! let tag2 = references.add("doc1->doc3".to_string());
//!
//! assert!(references.contains(&"doc1->doc2".to_string()));
//! assert!(references.contains(&"doc1->doc3".to_string()));
//!
//! // Remove a reference
//! references.remove(&"doc1->doc2".to_string());
//! assert!(!references.contains(&"doc1->doc2".to_string()));
//! assert!(references.contains(&"doc1->doc3".to_string()));
//!
//! // Concurrent add of the same reference will be preserved
//! references.add_with_tag("doc1->doc2".to_string(), tag1); // This won't work as tag1 is removed
//! let new_tag = references.add("doc1->doc2".to_string()); // This creates a new tag and succeeds
//! assert!(references.contains(&"doc1->doc2".to_string()));
//! ```
//!
//! # Reference Semantics
//!
//! The reference layer is specifically designed for managing relationships between
//! documents in a collaborative environment:
//!
//! - **Cross-Document Links**: References between different Codex documents
//! - **Bidirectional Awareness**: References can be queried from both directions
//! - **Type Safety**: References include type information for semantic relationships
//! - **Context Preservation**: Optional context helps maintain link meaning

use std::collections::{HashMap, HashSet};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use crate::types::UserId;

/// Observed-Remove Set for managing cross-Codex references
///
/// The ORSet provides a distributed set data structure that handles both additions
/// and removals correctly in the presence of concurrent operations. Unlike simpler
/// sets, the OR-Set ensures that concurrent additions are never lost due to removals.
///
/// # Design Philosophy
///
/// The OR-Set is built around the principle that "adds win over removes" when
/// operations are concurrent. This is achieved by:
/// - Tagging each add operation with a unique identifier
/// - Only removing specific tags (not elements directly)
/// - Preserving elements that have non-removed tags
///
/// # Conflict Resolution Strategy
///
/// The OR-Set handles conflicts through tag-based tracking:
/// 1. **Add-Add**: No conflict, both additions are preserved
/// 2. **Remove-Remove**: No conflict, element remains removed
/// 3. **Add-Remove**: Add wins if it's concurrent or after the remove
/// 4. **Remove-Add**: Remove only affects previously observed adds
///
/// # Causality and Observability
///
/// The "Observed-Remove" property ensures that:
/// - A remove operation can only affect add operations that were visible
///   when the remove was executed
/// - Concurrent adds after a remove are preserved
/// - The system maintains causal consistency
///
/// # Memory Optimization
///
/// The implementation includes several memory optimizations:
/// - Elements with no active tags are automatically removed
/// - Garbage collection for old removed tags
/// - Efficient storage using HashSet for tag collections
/// - Automatic shrinking of collections when appropriate
///
/// # Type Parameters
///
/// - `T`: Element type (must be hashable, cloneable, and serializable)
///
/// # Example
///
/// ```rust
/// use vespera_bindery::crdt::reference_layer::ORSet;
///
/// let mut set_a = ORSet::new();
/// let mut set_b = ORSet::new();
///
/// // Concurrent operations on different replicas
/// let tag1 = set_a.add("element1".to_string());
/// let tag2 = set_b.add("element1".to_string()); // Same element, different tag
///
/// // One replica removes the element
/// set_a.remove(&"element1".to_string()); // Removes tag1
///
/// // Merge the sets
/// set_a.merge(&set_b);
///
/// // Element still exists because tag2 was not removed
/// assert!(set_a.contains(&"element1".to_string()));
/// ```
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
    ///
    /// Creates a new unique tag for the element and adds it to the set.
    /// Even if the element already exists, this creates an additional tag,
    /// providing resilience against concurrent remove operations.
    ///
    /// # Algorithm
    ///
    /// 1. Generate unique ORTag with timestamp and operation ID
    /// 2. Add tag to element's tag set (create if element is new)
    /// 3. Element becomes visible in the set
    ///
    /// # Idempotency Note
    ///
    /// While the OR-Set itself provides idempotency at the merge level,
    /// calling `add` multiple times for the same element will create
    /// multiple tags. This is intentional behavior that provides
    /// additional resilience.
    ///
    /// # Parameters
    ///
    /// - `element`: The element to add to the set
    ///
    /// # Returns
    ///
    /// Returns the unique ORTag created for this add operation.
    /// This tag can be used for debugging or explicit removal.
    ///
    /// # Example
    ///
    /// ```rust
    /// let mut set = ORSet::new();
    /// let tag = set.add("my_element".to_string());
    ///
    /// assert!(set.contains(&"my_element".to_string()));
    /// println!("Added with tag: {:?}", tag.operation_id);
    /// ```
    pub fn add(&mut self, element: T) -> ORTag {
        let tag = ORTag {
            operation_id: Uuid::new_v4(),
            user_id: "system".to_string(), // TODO: Get user ID from operation context
            timestamp: Utc::now(),
        };

        self.elements.entry(element).or_insert_with(HashSet::new).insert(tag.clone());
        tag
    }

    /// Add an element using borrowed reference to avoid clones in hot paths
    pub fn add_borrowed(&mut self, element: &T) -> ORTag {
        let tag = ORTag {
            operation_id: Uuid::new_v4(),
            user_id: "system".to_string(), // TODO: Get user ID from operation context
            timestamp: Utc::now(),
        };

        self.elements.entry(element.clone()).or_insert_with(HashSet::new).insert(tag.clone());
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
    ///
    /// Removes an element by marking all of its current tags as removed.
    /// This implements the "observed-remove" property: only tags that
    /// are currently visible can be removed.
    ///
    /// # Algorithm
    ///
    /// 1. **Tag Collection**: Gather all current tags for the element
    /// 2. **Tombstone Creation**: Add all tags to the removed_tags set
    /// 3. **Element Removal**: Remove element from elements map
    /// 4. **Tag Return**: Return the list of removed tags
    ///
    /// # Observed-Remove Semantics
    ///
    /// The key property is that only "observed" additions can be removed:
    /// - If an element is added concurrently with this remove, it survives
    /// - Only tags visible at the time of removal are affected
    /// - Future additions of the same element create new tags
    ///
    /// # Conflict Resolution
    ///
    /// When this remove conflicts with concurrent operations:
    /// - **Concurrent Add**: The add operation survives (creates new tag)
    /// - **Concurrent Remove**: Both removes are applied (idempotent)
    /// - **Later Add**: Later add creates element with new tag
    ///
    /// # Performance
    ///
    /// - Time Complexity: O(t) where t is the number of tags for the element
    /// - Space Complexity: O(t) for storing removed tags
    ///
    /// # Parameters
    ///
    /// - `element`: The element to remove from the set
    ///
    /// # Returns
    ///
    /// Returns a vector of all tags that were removed. An empty vector
    /// indicates the element was not present in the set.
    ///
    /// # Example
    ///
    /// ```rust
    /// let mut set = ORSet::new();
    /// set.add("element".to_string());
    /// set.add("element".to_string()); // Same element, different tag
    ///
    /// let removed_tags = set.remove(&"element".to_string());
    /// assert_eq!(removed_tags.len(), 2); // Both tags were removed
    /// assert!(!set.contains(&"element".to_string()));
    /// ```
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
    ///
    /// Merges all operations from another OR-Set into this one. This is the
    /// core synchronization operation that ensures eventual consistency
    /// between distributed replicas.
    ///
    /// # Algorithm
    ///
    /// The merge process has three phases:
    ///
    /// ## Phase 1: Element Merging
    /// 1. For each element in the other set:
    ///    - Add all its tags to local element (if not removed)
    ///    - Skip tags that are in local removed_tags set
    ///
    /// ## Phase 2: Removed Tags Merging
    /// 1. Union all removed tags from both sets
    /// 2. Update local removed_tags set
    ///
    /// ## Phase 3: Cleanup
    /// 1. Remove elements that have all tags marked as removed
    /// 2. Update internal consistency
    ///
    /// # Mathematical Properties
    ///
    /// The merge operation satisfies:
    /// - **Commutativity**: `A.merge(B)` ≡ `B.merge(A)` (same final state)
    /// - **Associativity**: `(A ∪ B) ∪ C` ≡ `A ∪ (B ∪ C)`
    /// - **Idempotency**: `A ∪ A` ≡ `A`
    ///
    /// # Convergence Guarantee
    ///
    /// After merging, both sets will contain:
    /// - All elements that have at least one non-removed tag
    /// - All removed tags from both original sets
    /// - Identical visible state regardless of operation order
    ///
    /// # Performance
    ///
    /// - Time Complexity: O(n + m + r) where:
    ///   - n = elements in this set
    ///   - m = elements in other set
    ///   - r = removed tags in both sets
    /// - Space Complexity: O(k) where k = unique elements across both sets
    ///
    /// # Parameters
    ///
    /// - `other`: The OR-Set to merge from
    ///
    /// # Returns
    ///
    /// Returns `ORSetMergeResult` containing statistics about the merge:
    /// - Number of elements added
    /// - Number of elements removed
    /// - Number of removed tags merged
    ///
    /// # Example
    ///
    /// ```rust
    /// let mut set_a = ORSet::new();
    /// let mut set_b = ORSet::new();
    ///
    /// // Different operations on each set
    /// set_a.add("shared".to_string());
    /// set_a.add("unique_a".to_string());
    /// set_b.add("shared".to_string());
    /// set_b.add("unique_b".to_string());
    ///
    /// // Merge sets
    /// let result = set_a.merge(&set_b);
    ///
    /// // Result contains elements from both sets
    /// assert!(set_a.contains(&"shared".to_string()));
    /// assert!(set_a.contains(&"unique_a".to_string()));
    /// assert!(set_a.contains(&"unique_b".to_string()));
    ///
    /// println!("Added {} new elements", result.added_elements);
    /// ```
    pub fn merge(&mut self, other: &ORSet<T>) -> ORSetMergeResult {
        let mut added_elements = 0;
        
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
        
        let removed_elements = elements_to_remove.len();
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
    
    /// Clean up all resources and shrink collections
    pub fn cleanup(&mut self) {
        // Clear elements and nested HashSets
        for (_, mut tags) in self.elements.drain() {
            tags.clear();
            tags.shrink_to_fit();
        }
        self.elements.shrink_to_fit();

        // Clear removed tags
        self.removed_tags.clear();
        self.removed_tags.shrink_to_fit();
    }
    
    /// Shrink collections to fit their contents
    pub fn shrink_to_fit(&mut self) {
        self.elements.shrink_to_fit();
        self.removed_tags.shrink_to_fit();
        
        for tags in self.elements.values_mut() {
            tags.shrink_to_fit();
        }
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

/// Implement Drop to ensure proper cleanup of ORSet resources
impl<T> Drop for ORSet<T>
where
    T: Clone + Eq + std::hash::Hash + Serialize + std::fmt::Debug,
{
    fn drop(&mut self) {
        self.cleanup();
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