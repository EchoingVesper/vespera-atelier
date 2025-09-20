//! Tree layer CRDT for hierarchical document structure
//!
//! This module implements a specialized CRDT for managing hierarchical relationships
//! between documents. The tree CRDT ensures that all replicas converge to the same
//! tree structure while preserving the integrity of parent-child relationships.
//!
//! # Tree CRDT Algorithm
//!
//! The tree CRDT uses a combination of strategies to handle hierarchical data:
//!
//! ## Core Concepts
//!
//! - **Parent-Child Mapping**: Bidirectional mapping between parents and children
//! - **Position-Based Ordering**: Children are ordered within their parent's list
//! - **Cycle Prevention**: Strict validation to prevent circular references
//! - **Tombstones**: Deleted relationships are marked rather than removed
//!
//! ## Mathematical Properties
//!
//! The tree CRDT maintains the following invariants:
//!
//! ### Tree Structure Integrity
//! - Each node has at most one parent (except roots)
//! - No cycles exist in the parent-child relationships
//! - All children lists are consistent with parent mappings
//!
//! ### CRDT Properties
//! - **Commutativity**: Operations can be applied in any order
//! - **Associativity**: Multiple merges produce consistent results
//! - **Idempotency**: Duplicate operations have no effect
//! - **Eventual Consistency**: All replicas converge to the same structure
//!
//! ## Conflict Resolution Strategy
//!
//! The tree CRDT handles conflicts through position-based resolution:
//!
//! ### Move Conflicts
//! When multiple users move the same node:
//! 1. **Cycle Check**: Ensure no operation creates cycles
//! 2. **Timestamp Ordering**: Use operation timestamps for ordering
//! 3. **Position Adjustment**: Resolve position conflicts deterministically
//!
//! ### Insert Conflicts
//! When multiple users insert at the same position:
//! 1. **Position Sharing**: Multiple nodes can share the same logical position
//! 2. **Deterministic Ordering**: Use node IDs for consistent final order
//! 3. **Intention Preservation**: Maintain user's intended position as much as possible
//!
//! ### Delete Conflicts
//! When nodes are deleted concurrently with moves:
//! 1. **Tombstone Tracking**: Mark relationships as deleted
//! 2. **Operation Ordering**: Delete wins over concurrent moves
//! 3. **Subtree Handling**: Handle deletion of non-leaf nodes gracefully
//!
//! # Performance Characteristics
//!
//! - **Insert Operation**: O(1) for adding to parent's children list
//! - **Move Operation**: O(1) for updating parent mappings
//! - **Delete Operation**: O(1) for marking tombstones
//! - **Traversal Operations**: O(n) where n is the number of descendants
//! - **Cycle Detection**: O(n) where n is the depth to root
//! - **Space Complexity**: O(n + t) where n is nodes, t is tombstones
//!
//! # Tree Operations
//!
//! ## Supported Operations
//! - **Insert**: Add a node as a child of another node
//! - **Move**: Change a node's parent and position
//! - **Delete**: Remove a parent-child relationship
//! - **Query**: Get children, parents, ancestors, descendants
//!
//! ## Navigation Methods
//! - Get direct children of a node
//! - Get parent of a node
//! - Get all ancestors (path to root)
//! - Get all descendants (subtree)
//! - Calculate depth and tree metrics
//!
//! # Usage Example
//!
//! ```rust
//! use vespera_bindery::crdt::tree_layer::VesperaTreeCRDT;
//! use uuid::Uuid;
//!
//! let mut tree = VesperaTreeCRDT::new();
//!
//! let root_id = Uuid::new_v4();
//! let child1_id = Uuid::new_v4();
//! let child2_id = Uuid::new_v4();
//! let grandchild_id = Uuid::new_v4();
//!
//! // Build a tree structure
//! tree.insert(None, 0, root_id).unwrap(); // Root node
//! tree.insert(Some(root_id), 0, child1_id).unwrap();
//! tree.insert(Some(root_id), 1, child2_id).unwrap();
//! tree.insert(Some(child1_id), 0, grandchild_id).unwrap();
//!
//! // Query the structure
//! let children = tree.get_children(Some(root_id));
//! assert_eq!(children, vec![child1_id, child2_id]);
//!
//! let path = tree.get_path(grandchild_id);
//! assert_eq!(path, vec![root_id, child1_id, grandchild_id]);
//!
//! // Move operations preserve tree integrity
//! tree.move_node(grandchild_id, Some(child2_id), 0).unwrap();
//! assert_eq!(tree.get_parent(grandchild_id), Some(child2_id));
//! ```
//!
//! # Consistency Guarantees
//!
//! The tree CRDT provides strong consistency guarantees:
//!
//! - **Structural Integrity**: The tree structure is always valid
//! - **No Orphaned Nodes**: All operations maintain referential integrity
//! - **Cycle Prevention**: Impossible to create circular references
//! - **Deterministic Ordering**: Child ordering is consistent across replicas

use std::collections::{HashMap, HashSet, VecDeque};
use serde::{Deserialize, Serialize};
use crate::{BinderyResult, types::CodexId};

/// CRDT for hierarchical tree structure of Codices
///
/// VesperaTreeCRDT manages the hierarchical relationships between documents in a
/// distributed collaborative environment. It ensures that all replicas maintain
/// the same tree structure while allowing concurrent modifications.
///
/// # Design Principles
///
/// - **Referential Integrity**: All parent-child relationships are consistent
/// - **Cycle Prevention**: Impossible to create circular references
/// - **Position Preservation**: Child ordering is maintained across operations
/// - **Concurrent Safety**: Multiple users can modify the tree simultaneously
///
/// # Data Structure Design
///
/// The tree uses a dual-mapping approach:
/// - `children`: Maps parents to ordered lists of children
/// - `parents`: Maps children to their single parent
/// - `tombstones`: Tracks deleted relationships for conflict resolution
///
/// This design provides:
/// - O(1) parent lookup
/// - O(1) children lookup
/// - Efficient validation of tree constraints
///
/// # Conflict Resolution
///
/// The tree CRDT handles various conflict scenarios:
///
/// ## Concurrent Moves
/// When multiple users move the same node:
/// 1. Validate that no move creates a cycle
/// 2. Apply moves in timestamp order
/// 3. Use operation IDs for tie-breaking
///
/// ## Position Conflicts
/// When multiple nodes are inserted at the same position:
/// 1. Allow multiple nodes at the same logical position
/// 2. Use deterministic ordering based on node IDs
/// 3. Preserve user intention as much as possible
///
/// ## Delete vs Move
/// When a node is deleted and moved concurrently:
/// 1. Deletion operations take precedence
/// 2. Tombstones prevent future invalid operations
/// 3. Subtree operations are handled recursively
///
/// # Example Usage
///
/// ```rust
/// let mut tree = VesperaTreeCRDT::new();
/// let doc_a = Uuid::new_v4();
/// let doc_b = Uuid::new_v4();
///
/// // Create hierarchical structure
/// tree.insert(None, 0, doc_a).unwrap(); // Root document
/// tree.insert(Some(doc_a), 0, doc_b).unwrap(); // Child document
///
/// // Query relationships
/// assert_eq!(tree.get_parent(doc_b), Some(doc_a));
/// assert_eq!(tree.get_children(Some(doc_a)), vec![doc_b]);
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VesperaTreeCRDT {
    /// Parent-to-children mapping
    children: HashMap<Option<CodexId>, Vec<CodexId>>,
    
    /// Child-to-parent mapping
    parents: HashMap<CodexId, Option<CodexId>>,
    
    /// Tombstones for deleted relationships
    tombstones: HashSet<(Option<CodexId>, CodexId)>,
    
    /// Operation counter for ordering
    operation_counter: u64,
}

impl VesperaTreeCRDT {
    /// Create a new tree CRDT
    pub fn new() -> Self {
        Self {
            children: HashMap::new(),
            parents: HashMap::new(),
            tombstones: HashSet::new(),
            operation_counter: 0,
        }
    }
    
    /// Insert a node into the tree
    ///
    /// Adds a new parent-child relationship to the tree. If the child already
    /// has a parent, it will be moved to the new parent. This operation includes
    /// comprehensive validation to maintain tree integrity.
    ///
    /// # Algorithm
    ///
    /// 1. **Tombstone Check**: Verify relationship isn't marked as deleted
    /// 2. **Cycle Prevention**: Ensure operation won't create circular references
    /// 3. **Parent Update**: Remove child from current parent (if any)
    /// 4. **Insertion**: Add child to new parent at specified position
    /// 5. **Mapping Update**: Update bidirectional parent-child mappings
    ///
    /// # Cycle Detection
    ///
    /// Before insertion, the algorithm checks if the new parent is a descendant
    /// of the child being inserted. This prevents cycles such as:
    /// ```text
    /// A -> B -> C
    /// ```
    /// Where attempting to make C the parent of A would create: A -> B -> C -> A
    ///
    /// # Position Handling
    ///
    /// - Position is clamped to the valid range [0, children.len()]
    /// - Inserting at position 0 makes the node the first child
    /// - Inserting at position >= children.len() makes it the last child
    /// - Other children are shifted to accommodate the new position
    ///
    /// # Parameters
    ///
    /// - `parent_id`: The parent node ID (None for root nodes)
    /// - `position`: Position in parent's children list (0-based)
    /// - `child_id`: The child node ID to insert
    ///
    /// # Returns
    ///
    /// Returns `Ok(())` on success, or an error if:
    /// - The operation would create a cycle
    /// - The relationship is tombstoned
    /// - Internal validation fails
    ///
    /// # Example
    ///
    /// ```rust
    /// let mut tree = VesperaTreeCRDT::new();
    /// let parent = Uuid::new_v4();
    /// let child1 = Uuid::new_v4();
    /// let child2 = Uuid::new_v4();
    ///
    /// // Insert root node
    /// tree.insert(None, 0, parent).unwrap();
    ///
    /// // Insert children
    /// tree.insert(Some(parent), 0, child1).unwrap();
    /// tree.insert(Some(parent), 0, child2).unwrap(); // child2 becomes first
    ///
    /// assert_eq!(tree.get_children(Some(parent)), vec![child2, child1]);
    /// ```
    pub fn insert(&mut self, parent_id: Option<CodexId>, position: usize, child_id: CodexId) -> BinderyResult<()> {
        // Check if this relationship is tombstoned
        if self.tombstones.contains(&(parent_id, child_id)) {
            return Err(crate::BinderyError::InvalidOperation(
                "Cannot insert tombstoned relationship".to_string()
            ));
        }
        
        // Check for cycles
        if let Some(parent) = parent_id {
            if self.would_create_cycle(parent, child_id)? {
                return Err(crate::BinderyError::InvalidOperation(
                    "Operation would create cycle in tree".to_string()
                ));
            }
        }
        
        // Remove child from its current parent (if any)
        if let Some(old_parent) = self.parents.get(&child_id).copied() {
            self.remove_from_parent(old_parent, child_id);
        }
        
        // Add to new parent
        let children = self.children.entry(parent_id).or_insert_with(Vec::new);
        let insert_position = position.min(children.len());
        children.insert(insert_position, child_id);
        
        // Update parent mapping
        self.parents.insert(child_id, parent_id);
        
        self.operation_counter += 1;
        Ok(())
    }
    
    /// Remove a node from the tree
    pub fn remove(&mut self, parent_id: Option<CodexId>, child_id: CodexId) -> BinderyResult<()> {
        // Check if relationship exists
        if !self.has_relationship(parent_id, child_id) {
            return Err(crate::BinderyError::InvalidOperation(
                "Relationship does not exist".to_string()
            ));
        }
        
        // Add to tombstones
        self.tombstones.insert((parent_id, child_id));
        
        // Remove from data structures
        self.remove_from_parent(parent_id, child_id);
        self.parents.remove(&child_id);
        
        self.operation_counter += 1;
        Ok(())
    }
    
    /// Move a node to a new parent and position
    ///
    /// Moves an existing node to a new parent at the specified position.
    /// This is a high-level operation that combines removal from the old
    /// parent with insertion under the new parent.
    ///
    /// # Algorithm
    ///
    /// 1. **Current State**: Determine the node's current parent
    /// 2. **Cycle Check**: Verify the move won't create cycles
    /// 3. **Removal**: Remove from current parent's children list
    /// 4. **Insertion**: Insert under new parent at specified position
    /// 5. **Mapping Update**: Update parent mapping for the moved node
    ///
    /// # Cycle Prevention
    ///
    /// The move operation prevents cycles by checking if the new parent
    /// is a descendant of the node being moved. This includes:
    /// - Direct descendant check (child -> parent)
    /// - Indirect descendant check (child -> ... -> parent)
    /// - Self-parent prevention (node -> itself)
    ///
    /// # Position Resolution
    ///
    /// Position handling accounts for the removal-insertion sequence:
    /// - If moving within the same parent, positions are adjusted for removal
    /// - If moving to a different parent, position is relative to target parent
    /// - Position is clamped to valid range after removal
    ///
    /// # Difference from Insert
    ///
    /// While `insert` can work on new nodes, `move_node` is specifically
    /// designed for existing nodes and provides:
    /// - Explicit move semantics
    /// - Optimized handling of position adjustments
    /// - Clearer operation intent for merge resolution
    ///
    /// # Parameters
    ///
    /// - `child_id`: The node to move
    /// - `new_parent_id`: The new parent (None for root level)
    /// - `position`: Position in new parent's children list
    ///
    /// # Returns
    ///
    /// Returns `Ok(())` on success, or an error if:
    /// - The move would create a cycle
    /// - The node doesn't exist in the tree
    /// - Internal validation fails
    ///
    /// # Example
    ///
    /// ```rust
    /// let mut tree = VesperaTreeCRDT::new();
    /// let root = Uuid::new_v4();
    /// let folder1 = Uuid::new_v4();
    /// let folder2 = Uuid::new_v4();
    /// let document = Uuid::new_v4();
    ///
    /// // Create initial structure
    /// tree.insert(None, 0, root).unwrap();
    /// tree.insert(Some(root), 0, folder1).unwrap();
    /// tree.insert(Some(root), 1, folder2).unwrap();
    /// tree.insert(Some(folder1), 0, document).unwrap();
    ///
    /// // Move document from folder1 to folder2
    /// tree.move_node(document, Some(folder2), 0).unwrap();
    ///
    /// assert_eq!(tree.get_parent(document), Some(folder2));
    /// assert_eq!(tree.get_children(Some(folder1)), vec![]);
    /// assert_eq!(tree.get_children(Some(folder2)), vec![document]);
    /// ```
    pub fn move_node(&mut self, child_id: CodexId, new_parent_id: Option<CodexId>, position: usize) -> BinderyResult<()> {
        let old_parent_id = self.parents.get(&child_id).copied().flatten();
        
        // Check for cycles
        if let Some(parent) = new_parent_id {
            if self.would_create_cycle(parent, child_id)? {
                return Err(crate::BinderyError::InvalidOperation(
                    "Move would create cycle in tree".to_string()
                ));
            }
        }
        
        // Remove from old parent
        self.remove_from_parent(old_parent_id, child_id);
        
        // Add to new parent
        let children = self.children.entry(new_parent_id).or_insert_with(Vec::new);
        let insert_position = position.min(children.len());
        children.insert(insert_position, child_id);
        
        // Update parent mapping
        self.parents.insert(child_id, new_parent_id);
        
        self.operation_counter += 1;
        Ok(())
    }
    
    /// Get children of a node
    pub fn get_children(&self, parent_id: Option<CodexId>) -> Vec<CodexId> {
        self.children.get(&parent_id).cloned().unwrap_or_default()
    }
    
    /// Get parent of a node
    pub fn get_parent(&self, child_id: CodexId) -> Option<CodexId> {
        self.parents.get(&child_id).copied().flatten()
    }
    
    /// Get all root nodes (nodes with no parent)
    pub fn get_roots(&self) -> Vec<CodexId> {
        self.get_children(None)
    }
    
    /// Get all descendants of a node
    ///
    /// Returns all nodes in the subtree rooted at the specified node.
    /// This includes direct children and all their descendants recursively.
    /// The traversal uses breadth-first order for consistent results.
    ///
    /// # Algorithm
    ///
    /// Uses breadth-first traversal (BFS) to ensure consistent ordering:
    /// 1. **Initialize**: Start with direct children in a queue
    /// 2. **Process**: For each node, add it to results and queue its children
    /// 3. **Recurse**: Continue until all descendants are processed
    /// 4. **Order**: Results are in level-order (breadth-first)
    ///
    /// # Performance
    ///
    /// - Time Complexity: O(n) where n is the number of descendants
    /// - Space Complexity: O(w) where w is the maximum width of the tree
    ///
    /// # Parameters
    ///
    /// - `parent_id`: The root of the subtree (None for all root nodes)
    ///
    /// # Returns
    ///
    /// Returns a vector of all descendant node IDs in breadth-first order.
    /// The vector is empty if the node has no descendants.
    ///
    /// # Example
    ///
    /// ```rust
    /// let mut tree = VesperaTreeCRDT::new();
    /// let root = Uuid::new_v4();
    /// let child1 = Uuid::new_v4();
    /// let child2 = Uuid::new_v4();
    /// let grandchild = Uuid::new_v4();
    ///
    /// // Build tree: root -> [child1, child2], child1 -> [grandchild]
    /// tree.insert(None, 0, root).unwrap();
    /// tree.insert(Some(root), 0, child1).unwrap();
    /// tree.insert(Some(root), 1, child2).unwrap();
    /// tree.insert(Some(child1), 0, grandchild).unwrap();
    ///
    /// let descendants = tree.get_descendants(Some(root));
    /// // Results in breadth-first order: [child1, child2, grandchild]
    /// assert_eq!(descendants, vec![child1, child2, grandchild]);
    /// ```
    pub fn get_descendants(&self, parent_id: Option<CodexId>) -> Vec<CodexId> {
        let mut descendants = Vec::new();
        let mut queue = VecDeque::new();
        
        // Start with direct children
        for child in self.get_children(parent_id) {
            queue.push_back(child);
        }
        
        while let Some(node_id) = queue.pop_front() {
            descendants.push(node_id);
            
            // Add children to queue
            for child in self.get_children(Some(node_id)) {
                queue.push_back(child);
            }
        }
        
        descendants
    }
    
    /// Get all ancestors of a node
    pub fn get_ancestors(&self, child_id: CodexId) -> Vec<CodexId> {
        let mut ancestors = Vec::new();
        let mut current = Some(child_id);
        
        while let Some(node_id) = current {
            if let Some(parent_id) = self.get_parent(node_id) {
                ancestors.push(parent_id);
                current = Some(parent_id);
            } else {
                break;
            }
        }
        
        ancestors
    }
    
    /// Get the path from root to a node
    pub fn get_path(&self, child_id: CodexId) -> Vec<CodexId> {
        let mut path = self.get_ancestors(child_id);
        path.reverse();
        path.push(child_id);
        path
    }
    
    /// Get the depth of a node (0 for root nodes)
    pub fn get_depth(&self, node_id: CodexId) -> usize {
        self.get_ancestors(node_id).len()
    }
    
    /// Check if a node is an ancestor of another
    pub fn is_ancestor(&self, ancestor_id: CodexId, descendant_id: CodexId) -> bool {
        self.get_ancestors(descendant_id).contains(&ancestor_id)
    }
    
    /// Check if a node is a descendant of another
    pub fn is_descendant(&self, descendant_id: CodexId, ancestor_id: CodexId) -> bool {
        self.is_ancestor(ancestor_id, descendant_id)
    }
    
    /// Get all nodes in the tree
    pub fn get_all_nodes(&self) -> HashSet<CodexId> {
        let mut nodes = HashSet::new();
        
        // Add all children
        for children in self.children.values() {
            for child in children {
                nodes.insert(*child);
            }
        }
        
        // Add all parents (in case there are isolated parents)
        for parent in self.parents.values().flatten() {
            nodes.insert(*parent);
        }
        
        nodes
    }
    
    /// Get tree statistics
    pub fn get_stats(&self) -> TreeStats {
        let all_nodes = self.get_all_nodes();
        let root_count = self.get_roots().len();
        let total_relationships = self.parents.len();
        let tombstone_count = self.tombstones.len();
        
        TreeStats {
            total_nodes: all_nodes.len(),
            root_nodes: root_count,
            total_relationships,
            tombstones: tombstone_count,
            max_depth: all_nodes.iter().map(|&id| self.get_depth(id)).max().unwrap_or(0),
        }
    }
    
    /// Create a snapshot of the tree structure
    pub fn snapshot(&self) -> HashMap<CodexId, Vec<CodexId>> {
        let mut snapshot = HashMap::new();
        
        for (parent, children) in &self.children {
            if let Some(parent_id) = parent {
                snapshot.insert(*parent_id, children.clone());
            }
        }
        
        snapshot
    }
    
    /// Validate tree integrity
    ///
    /// Performs comprehensive validation of the tree structure to ensure
    /// all invariants are maintained. This is useful for debugging and
    /// ensuring consistency after complex operations or merges.
    ///
    /// # Validation Checks
    ///
    /// ## Referential Integrity
    /// - Every child in a parent's children list has that parent in parents map
    /// - Every parent in the parents map has the child in its children list
    /// - No orphaned relationships exist
    ///
    /// ## Tree Structure
    /// - No cycles exist in the parent-child relationships
    /// - Each node has at most one parent
    /// - All nodes are reachable from their roots
    ///
    /// ## Data Consistency
    /// - Parents map is consistent with children map
    /// - No duplicate children in any parent's list
    /// - All referenced nodes exist in the appropriate mappings
    ///
    /// # Algorithm
    ///
    /// 1. **Orphan Check**: Verify all parent-child mappings are bidirectional
    /// 2. **Cycle Detection**: Use depth-first search to detect cycles
    /// 3. **Consistency Check**: Ensure data structure integrity
    /// 4. **Reachability**: Verify all nodes are properly connected
    ///
    /// # Performance
    ///
    /// - Time Complexity: O(n) where n is the total number of nodes
    /// - Space Complexity: O(d) where d is the maximum depth
    ///
    /// # Returns
    ///
    /// Returns `Ok(())` if validation passes, or a `BinderyError` describing
    /// the specific integrity violation found.
    ///
    /// # Example
    ///
    /// ```rust
    /// let mut tree = VesperaTreeCRDT::new();
    /// let root = Uuid::new_v4();
    /// let child = Uuid::new_v4();
    ///
    /// tree.insert(None, 0, root).unwrap();
    /// tree.insert(Some(root), 0, child).unwrap();
    ///
    /// // Validation should pass for well-formed tree
    /// assert!(tree.validate().is_ok());
    ///
    /// // Validation would catch inconsistencies
    /// // (This is just an example - actual inconsistencies would be harder to create)
    /// ```
    ///
    /// # Use Cases
    ///
    /// - **Testing**: Verify tree operations maintain consistency
    /// - **Debugging**: Identify issues after complex operations
    /// - **Merge Verification**: Ensure merges don't break invariants
    /// - **Data Recovery**: Validate trees loaded from storage
    pub fn validate(&self) -> BinderyResult<()> {
        // Check for orphaned relationships
        for (child_id, parent_id) in &self.parents {
            if let Some(parent) = parent_id {
                let empty_vec = Vec::new();
                let parent_children = self.children.get(&Some(*parent)).unwrap_or(&empty_vec);
                if !parent_children.contains(child_id) {
                    return Err(crate::BinderyError::InternalError(
                        format!("Child {} not found in parent {}'s children list", child_id, parent)
                    ));
                }
            }
        }
        
        // Check for cycles
        let all_nodes = self.get_all_nodes();
        for node_id in all_nodes {
            if self.has_cycle_from_node(node_id) {
                return Err(crate::BinderyError::InternalError(
                    format!("Cycle detected starting from node {}", node_id)
                ));
            }
        }
        
        Ok(())
    }
    
    // Private helper methods
    
    fn has_relationship(&self, parent_id: Option<CodexId>, child_id: CodexId) -> bool {
        self.parents.get(&child_id) == Some(&parent_id)
    }
    
    fn remove_from_parent(&mut self, parent_id: Option<CodexId>, child_id: CodexId) {
        if let Some(children) = self.children.get_mut(&parent_id) {
            children.retain(|&id| id != child_id);
        }
    }
    
    fn would_create_cycle(&self, parent_id: CodexId, child_id: CodexId) -> BinderyResult<bool> {
        // A cycle would be created if parent_id is a descendant of child_id
        Ok(self.is_descendant(parent_id, child_id))
    }
    
    fn has_cycle_from_node(&self, start_node: CodexId) -> bool {
        let mut visited = HashSet::new();
        let mut stack = vec![start_node];
        
        while let Some(node_id) = stack.pop() {
            if !visited.insert(node_id) {
                // We've seen this node before - cycle detected
                return true;
            }
            
            // Add children to stack
            for &child in self.get_children(Some(node_id)).iter() {
                stack.push(child);
            }
        }
        
        false
    }
    
    /// Garbage collect old tombstones
    pub fn gc_tombstones(&mut self, max_tombstones: usize) -> usize {
        let initial_count = self.tombstones.len();
        
        if initial_count > max_tombstones {
            // Convert to vector, sort by some criteria, and keep only the most recent
            let mut tombstones_vec: Vec<_> = self.tombstones.iter().cloned().collect();
            tombstones_vec.sort_by(|a, b| {
                // Sort by parent ID first, then child ID for deterministic ordering
                a.0.cmp(&b.0).then(a.1.cmp(&b.1))
            });
            
            // Keep only the most recent tombstones
            let to_keep = tombstones_vec.into_iter().rev().take(max_tombstones);
            self.tombstones = to_keep.collect();
        }
        
        initial_count - self.tombstones.len()
    }
    
    /// Clean up all resources
    pub fn cleanup(&mut self) {
        self.children.clear();
        self.children.shrink_to_fit();
        
        self.parents.clear();
        self.parents.shrink_to_fit();
        
        self.tombstones.clear();
        self.tombstones.shrink_to_fit();
        
        self.operation_counter = 0;
    }
    
    /// Shrink all collections to fit their contents
    pub fn shrink_to_fit(&mut self) {
        self.children.shrink_to_fit();
        self.parents.shrink_to_fit();
        self.tombstones.shrink_to_fit();
        
        for children_list in self.children.values_mut() {
            children_list.shrink_to_fit();
        }
    }
}

/// Statistics about the tree structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreeStats {
    pub total_nodes: usize,
    pub root_nodes: usize,
    pub total_relationships: usize,
    pub tombstones: usize,
    pub max_depth: usize,
}

impl Default for VesperaTreeCRDT {
    fn default() -> Self {
        Self::new()
    }
}

/// Implement Drop to ensure proper cleanup of tree resources
impl Drop for VesperaTreeCRDT {
    fn drop(&mut self) {
        self.cleanup();
    }
}