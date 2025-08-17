import { TFile, TFolder } from 'obsidian';

/**
 * Interface for a node in a file tree
 */
export interface TreeNode {
  id: string;
  name: string;
  path: string;
  isFolder: boolean;
  children?: TreeNode[];
  parent?: TreeNode;
  data?: any;
  extension?: string;
  size?: number;
  modified?: number;
}

/**
 * Create a tree structure from a list of files and folders
 * @param items List of files and folders
 * @param rootPath Root path for the tree
 * @returns Root node of the tree
 */
export function createTree(
  items: (TFile | TFolder)[],
  rootPath: string = '/'
): TreeNode {
  // Create root node
  const root: TreeNode = {
    id: 'root',
    name: 'Root',
    path: rootPath,
    isFolder: true,
    children: []
  };
  
  // Map to store nodes by path
  const nodeMap = new Map<string, TreeNode>();
  nodeMap.set(rootPath, root);
  
  // First pass: create nodes for all items
  items.forEach(item => {
    const path = item.path;
    const name = item.name;
    const isFolder = item instanceof TFolder;
    
    const node: TreeNode = {
      id: path,
      name,
      path,
      isFolder,
      children: isFolder ? [] : undefined,
      extension: !isFolder ? path.split('.').pop() : undefined,
      size: !isFolder && item instanceof TFile ? item.stat?.size : undefined,
      modified: item instanceof TFile ? item.stat?.mtime : undefined
    };
    
    nodeMap.set(path, node);
  });
  
  // Second pass: build tree structure
  items.forEach(item => {
    const path = item.path;
    const node = nodeMap.get(path);
    
    if (!node) return;
    
    // Get parent path
    const parentPath = getParentPath(path);
    let parent = nodeMap.get(parentPath);
    
    // If parent doesn't exist, use root
    if (!parent) {
      parent = root;
    }
    
    // Add node to parent's children
    if (parent.children) {
      parent.children.push(node);
      node.parent = parent;
    }
  });
  
  return root;
}

/**
 * Get the parent path of a file or folder
 * @param path Path to get parent of
 * @returns Parent path
 */
export function getParentPath(path: string): string {
  const lastSlashIndex = path.lastIndexOf('/');
  if (lastSlashIndex === -1) {
    return '/';
  }
  return path.substring(0, lastSlashIndex) || '/';
}

/**
 * Sort a tree by type (folders first) and then by name
 * @param tree Tree to sort
 * @returns Sorted tree
 */
export function sortTree(tree: TreeNode): TreeNode {
  // Sort children recursively
  if (tree.children) {
    // Sort by type (folders first) and then by name
    tree.children.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });
    
    // Sort children of children
    tree.children.forEach(child => {
      if (child.isFolder) {
        sortTree(child);
      }
    });
  }
  
  return tree;
}

/**
 * Filter a tree based on a predicate function
 * @param tree Tree to filter
 * @param predicate Function to test each node
 * @returns Filtered tree
 */
export function filterTree(
  tree: TreeNode,
  predicate: (node: TreeNode) => boolean
): TreeNode | null {
  // Clone the node
  const node: TreeNode = { ...tree };
  
  // If node has children, filter them recursively
  if (node.children) {
    const filteredChildren = node.children
      .map(child => filterTree(child, predicate))
      .filter(Boolean) as TreeNode[];
    
    node.children = filteredChildren;
  }
  
  // If node passes predicate or has children, return it
  if (predicate(node) || (node.children && node.children.length > 0)) {
    return node;
  }
  
  // Otherwise, return null
  return null;
}

/**
 * Find a node in a tree by path
 * @param tree Tree to search
 * @param path Path to find
 * @returns Found node or undefined
 */
export function findNodeByPath(tree: TreeNode, path: string): TreeNode | undefined {
  // Check if current node matches
  if (tree.path === path) {
    return tree;
  }
  
  // If node has children, search them
  if (tree.children) {
    for (const child of tree.children) {
      const found = findNodeByPath(child, path);
      if (found) {
        return found;
      }
    }
  }
  
  // Not found
  return undefined;
}

/**
 * Walk a tree and apply a function to each node
 * @param tree Tree to walk
 * @param callback Function to apply to each node
 */
export function walkTree(
  tree: TreeNode,
  callback: (node: TreeNode) => void
): void {
  // Apply callback to current node
  callback(tree);
  
  // If node has children, walk them
  if (tree.children) {
    tree.children.forEach(child => {
      walkTree(child, callback);
    });
  }
}

/**
 * Get all leaf nodes (files) from a tree
 * @param tree Tree to get leaves from
 * @returns Array of leaf nodes
 */
export function getLeafNodes(tree: TreeNode): TreeNode[] {
  const leaves: TreeNode[] = [];
  
  walkTree(tree, node => {
    if (!node.isFolder) {
      leaves.push(node);
    }
  });
  
  return leaves;
}

/**
 * Get all folder nodes from a tree
 * @param tree Tree to get folders from
 * @returns Array of folder nodes
 */
export function getFolderNodes(tree: TreeNode): TreeNode[] {
  const folders: TreeNode[] = [];
  
  walkTree(tree, node => {
    if (node.isFolder) {
      folders.push(node);
    }
  });
  
  return folders;
}