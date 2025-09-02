//! Tree layer CRDT for hierarchical document structure

use std::collections::{HashMap, HashSet, VecDeque};
use serde::{Deserialize, Serialize};
use crate::{BinderyResult, types::CodexId};

/// CRDT for hierarchical tree structure of Codices
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