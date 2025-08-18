import { TFile, TFolder } from 'obsidian';
import { TreeNode, createTree, sortTree } from './treeUtils';

// Lucide folder and file SVGs (https://lucide.dev/icons)
const FOLDER_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h5l2 3h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>`;
const FILE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;

/**
 * Options for the vault tree view
 */
export interface VaultTreeViewOptions {
  showFiles?: boolean;
  showFolders?: boolean;
  rootPath?: string;
  filter?: (file: TFile | TFolder) => boolean;
  onSelect?: (node: TreeNode) => void;
  selectedPaths?: string[];
  onExpandCollapse?: (node: TreeNode, expanded: boolean) => void;
  rootNodes?: TreeNode[]; // For direct tree initialization in modals
}

/**
 * Standalone implementation of VaultTreeView that doesn't extend ItemView
 * Can be used directly in modals or other contexts without a WorkspaceLeaf
 */
export class VaultTreeViewAdapter {
  private options: VaultTreeViewOptions;
  private treeContainer: HTMLElement | null = null;
  private tree: TreeNode | null = null;
  private selectedPaths: Set<string> = new Set();
  private focusedPath?: string;
  private expanded: Set<string> = new Set();
  private _rootContainer?: HTMLElement;
  public focusTreeContainer?: HTMLElement;
  private app: any;

  constructor(app: any, options: VaultTreeViewOptions = {}) {
    this.app = app;
    this.options = {
      showFiles: true,
      showFolders: true,
      rootPath: '/',
      ...options
    };
    
    if (options.selectedPaths) {
      this.selectedPaths = new Set(options.selectedPaths);
    }
  }

  /**
   * Initialize and render the tree view in the provided container
   */
  render(container: HTMLElement): void {
    this._rootContainer = container;
    container.empty();
    
    // Create tree container with accessibility attributes
    this.treeContainer = container.createDiv({
      cls: "nav-files-container vespera-treeview-root vespera-treeview-card",
      attr: {
        tabindex: "0",
        role: "tree",
        "aria-label": "Vault files and folders",
        "aria-multiselectable": "true"
      }
    });
    
    this.focusTreeContainer = this.treeContainer;
    
    // Focus on mount if not already
    setTimeout(() => {
      if (document.activeElement !== this.treeContainer) this.treeContainer?.focus();
    }, 0);
    
    // Keyboard navigation
    this.treeContainer.addEventListener("keydown", (e) => this.handleKeyboard(e));
    
    // If no focusedPath, focus first visible node
    if (!this.focusedPath) {
      const visible = this.getVisibleNodes();
      if (visible.length > 0) this.focusedPath = visible[0].path;
    }
    
    // Initialize and render tree
    this.refreshTree();
    
    // Footer with instructions
    const footer = container.createDiv({
      cls: "vespera-treeview-footer",
      attr: { "aria-live": "polite", role: "status" }
    });
    footer.textContent = "Right-click, Space, or Enter to select files. Shift+Enter to select folders. Ctrl/Cmd+click for multi-select.";
  }

  /**
   * Refresh the tree view
   */
  async refreshTree(): Promise<void> {
    // If rootNodes are provided directly (for modals), use those
    if (this.options.rootNodes) {
      this.tree = {
        id: 'root',
        name: 'Root',
        path: '/',
        isFolder: true,
        children: this.options.rootNodes
      };
      
      // Sort tree
      if (this.tree) {
        sortTree(this.tree);
      }
      
      // If no focusedPath, focus first visible node
      if (!this.focusedPath && this.tree && this.tree.children && this.tree.children.length > 0) {
        const firstNode = this.getFirstVisibleNode(this.tree.children);
        if (firstNode) {
          this.focusedPath = firstNode.path;
        }
      }
      
      // Render tree
      this.renderTree();
      return;
    }
    
    // Otherwise, build tree from vault files (for ItemView usage)
    if (this.app && this.app.vault) {
      const { vault } = this.app;
      const files: TFile[] = vault.getFiles();
      const folders: TFolder[] = vault.getAllLoadedFiles()
        .filter((f: any) => f instanceof TFolder) as TFolder[];
      
      // Combine files and folders
      let items: (TFile | TFolder)[] = [];
      
      if (this.options.showFolders) {
        items = items.concat(folders);
      }
      
      if (this.options.showFiles) {
        items = items.concat(files);
      }
      
      // Apply filter if provided
      if (this.options.filter) {
        items = items.filter(this.options.filter);
      }
      
      // Create tree
      this.tree = createTree(items, this.options.rootPath);
      
      // Sort tree
      if (this.tree) {
        sortTree(this.tree);
      }
      
      // If no focusedPath, focus first visible node
      if (!this.focusedPath && this.tree && this.tree.children && this.tree.children.length > 0) {
        const firstNode = this.getFirstVisibleNode(this.tree.children);
        if (firstNode) {
          this.focusedPath = firstNode.path;
        }
      }
      
      // Render tree
      this.renderTree();
    }
  }

  /**
   * Get the first visible node in the tree
   */
  private getFirstVisibleNode(nodes: TreeNode[]): TreeNode | null {
    for (const node of nodes) {
      if (this.hasRenderableDescendant(node)) {
        return node;
      }
      if (node.children && node.children.length > 0) {
        const childNode = this.getFirstVisibleNode(node.children);
        if (childNode) return childNode;
      }
    }
    return null;
  }

  /**
   * Render the tree view
   */
  private renderTree(): void {
    if (!this.treeContainer) return;
    
    this.treeContainer.empty();
    
    // If we have rootNodes directly (from options), use those
    if (this.options.rootNodes && this.options.rootNodes.length > 0) {
      this.options.rootNodes.forEach(node => {
        this.renderNode(node, this.treeContainer!, 0);
      });
    }
    // Otherwise use the tree structure if available
    else if (this.tree && this.tree.children) {
      this.tree.children.forEach(child => {
        this.renderNode(child, this.treeContainer!, 0);
      });
    }
    // Display message if no content
    else {
      this.treeContainer.createEl('div', {
        text: 'No items to display.',
        attr: { "aria-live": "polite" }
      });
    }
  }

  /**
   * Get all visible nodes in the tree
   */
  private getVisibleNodes(): TreeNode[] {
    const nodes: TreeNode[] = [];
    if (!this.tree) return nodes;
    
    const traverse = (n: TreeNode) => {
      if (n.isFolder) {
        if (!this.hasRenderableDescendant(n)) return;
        nodes.push(n);
        if (this.expanded.has(n.path) && n.children) {
          n.children.forEach(traverse);
        }
      } else {
        nodes.push(n);
      }
    };
    
    if (this.tree.children) {
      this.tree.children.forEach(traverse);
    }
    
    return nodes;
  }

  /**
   * Check if a node has any renderable descendants
   */
  private hasRenderableDescendant(node: TreeNode): boolean {
    if (!node.isFolder) return true;
    if (!node.children || node.children.length === 0) return false;
    return node.children.some(child => this.hasRenderableDescendant(child));
  }

  /**
   * Render a tree node
   */
  private renderNode(node: TreeNode, parent: HTMLElement, depth: number): void {
    // Skip folders that have no files anywhere in their subtree
    if (node.isFolder && !this.hasRenderableDescendant(node)) {
      return;
    }
    
    if (node.isFolder) {
      const fullySelected = this.isFullySelected(node);
      const partiallySelected = this.isPartiallySelected(node);
      const isFocused = this.focusedPath === node.path;
      
      const folderEl = parent.createDiv({
        cls: [
          "nav-folder",
          this.expanded.has(node.path) ? "" : "is-collapsed",
          fullySelected ? "is-selected" : "",
          partiallySelected ? "is-partial" : "",
          isFocused ? "is-focused" : ""
        ].join(" ").trim(),
        attr: {
          role: "treeitem",
          "aria-expanded": this.expanded.has(node.path) ? "true" : "false",
          "aria-selected": fullySelected ? "true" : partiallySelected ? "mixed" : "false",
          "aria-label": `Folder: ${node.name}`
        }
      });
      
      // Folder title row (clickable for expand/collapse & selection)
      const titleEl = folderEl.createDiv({
        cls: ["nav-folder-title", isFocused ? "is-focused" : ""].join(" ").trim(),
        attr: {
          style: `margin-left: ${depth * 18}px; display: flex; align-items: center; cursor: pointer;`,
          role: "button",
          "aria-label": `Toggle folder ${node.name}`,
          tabindex: isFocused ? "0" : "-1"
        }
      });
      
      // Folder icon
      const iconSpan = titleEl.createSpan({ cls: "nav-folder-icon" });
      iconSpan.innerHTML = FOLDER_ICON;
      iconSpan.style.marginRight = "4px";
      
      // Folder name label
      const labelEl = titleEl.createSpan({
        text: node.name,
        cls: "nav-folder-title-content"
      });
      
      // Row click toggles expand/collapse
      titleEl.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleExpand(node);
        
        // Only re-render the children container, not the whole folder or parent
        if (folderEl.children.length > 1) {
          const childrenEl = folderEl.children[1] as HTMLElement;
          childrenEl.empty();
          if (this.expanded.has(node.path) && node.children && node.children.length > 0) {
            node.children.forEach(child => this.renderNode(child, childrenEl, depth + 1));
          }
        }
        
        // Update collapsed class
        if (this.expanded.has(node.path)) {
          folderEl.removeClass("is-collapsed");
        } else {
          folderEl.addClass("is-collapsed");
        }
      });
      
      // Right-click/Space/Shift+Enter: select all contents (not expand/collapse)
      titleEl.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        this.toggleSelection(node);
        this.focusedPath = node.path;
        if (this._rootContainer) this.renderTree();
      });
      
      titleEl.addEventListener("keydown", (e) => {
        // Spacebar or Shift+Enter: select all contents
        if (e.key === " " || e.key === "Spacebar" || (e.key === "Enter" && e.shiftKey) || (e.code === "NumpadEnter" && e.shiftKey)) {
          e.preventDefault();
          this.toggleSelection(node);
          this.focusedPath = node.path;
          if (this._rootContainer) this.renderTree();
          return;
        }
        
        // Enter (no shift): expand/collapse
        if ((e.key === "Enter" || e.code === "NumpadEnter") && !e.shiftKey) {
          e.preventDefault();
          this.toggleExpand(node);
          this.focusedPath = node.path;
          if (this._rootContainer) this.renderTree();
          return;
        }
        
        // Left/Right arrows: expand/collapse
        else if (e.key === "ArrowRight") {
          if (!this.expanded.has(node.path)) {
            this.expanded.add(node.path);
            if (this._rootContainer) this.renderTree();
          }
        } else if (e.key === "ArrowLeft") {
          if (this.expanded.has(node.path)) {
            this.expanded.delete(node.path);
            if (this._rootContainer) this.renderTree();
          }
        }
      });
      
      // Children container (always present)
      let childrenEl: HTMLElement | undefined;
      if (node.children && node.children.length > 0) {
        childrenEl = folderEl.createDiv({ cls: "nav-folder-children" });
        if (this.expanded.has(node.path)) {
          node.children.forEach(child => this.renderNode(child, childrenEl!, depth + 1));
        }
      }
    } else {
      // FILE NODE
      const isSelected = this.selectedPaths.has(node.path);
      const isFocused = this.focusedPath === node.path;
      
      const fileEl = parent.createDiv({
        cls: ["nav-file", isSelected ? "is-selected" : "", isFocused ? "is-focused" : ""].join(" ").trim(),
        attr: {
          role: "treeitem",
          "aria-selected": isSelected ? "true" : "false",
          "aria-label": `File: ${node.name}${node.extension ? `, ${node.extension.toUpperCase()}` : ""}${node.size ? `, ${node.size} bytes` : ""}`
        }
      });
      
      const titleEl = fileEl.createDiv({
        cls: ["nav-file-title", isFocused ? "is-focused" : ""].join(" ").trim(),
        attr: {
          style: `margin-left: ${depth * 18 + 18}px; display: flex; align-items: center; cursor: pointer;`,
          role: "button",
          "aria-label": `Select file ${node.name}`,
          tabindex: isFocused ? "0" : "-1"
        }
      });
      
      // Icon
      const iconSpan = titleEl.createSpan({ cls: "nav-file-icon" });
      iconSpan.innerHTML = FILE_ICON;
      iconSpan.style.marginRight = "4px";
      
      // Label
      const labelEl = titleEl.createSpan({
        text: node.name,
        cls: "nav-file-title-content"
      });
      
      // File size/type (optional)
      if (node.size !== undefined) {
        const sizeEl = titleEl.createSpan({ text: ` · ${node.size} bytes`, cls: "vespera-file-size" });
      }
      
      if (node.extension) {
        const extEl = titleEl.createSpan({ text: ` · ${node.extension.toUpperCase()}`, cls: "vespera-file-ext" });
      }
      
      // Right-click/Space/Enter/Shift+Enter: select file
      titleEl.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        this.toggleSelection(node);
        this.focusedPath = node.path;
        if (this._rootContainer) this.renderTree();
      });
      
      titleEl.addEventListener("keydown", (e) => {
        // Enter, NumpadEnter, Spacebar: select file (ignore shift for files)
        if (
          e.key === " " ||
          e.key === "Spacebar" ||
          e.key === "Enter" ||
          e.code === "NumpadEnter"
        ) {
          e.preventDefault();
          this.toggleSelection(node);
          this.focusedPath = node.path;
          if (this._rootContainer) this.renderTree();
        }
      });
      
      // Left-click: select file
      titleEl.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleSelection(node);
        this.focusedPath = node.path;
        if (this._rootContainer) this.renderTree();
      });
    }
  }

  /**
   * Toggle expand/collapse state of a node
   */
  private toggleExpand(node: TreeNode) {
    if (this.expanded.has(node.path)) {
      this.expanded.delete(node.path);
      this.options.onExpandCollapse?.(node, false);
    } else {
      this.expanded.add(node.path);
      this.options.onExpandCollapse?.(node, true);
    }
  }

  /**
   * Check if a node is fully selected
   */
  private isFullySelected(node: TreeNode): boolean {
    if (node.isFolder) {
      // Get all file descendants
      const filePaths = this.getAllDescendantFilePaths(node);
      if (filePaths.length === 0) return false;
      return filePaths.every(p => this.selectedPaths.has(p));
    }
    return this.selectedPaths.has(node.path);
  }

  /**
   * Check if a node is partially selected
   */
  private isPartiallySelected(node: TreeNode): boolean {
    if (!node.isFolder || !node.children?.length) return false;
    const filePaths = this.getAllDescendantFilePaths(node);
    if (filePaths.length === 0) return false;
    const selected = filePaths.filter(p => this.selectedPaths.has(p)).length;
    return selected > 0 && selected < filePaths.length;
  }

  /**
   * Get all file paths in a node's subtree
   */
  private getAllDescendantFilePaths(node: TreeNode): string[] {
    if (!node.isFolder) return [node.path];
    if (!node.children || node.children.length === 0) return [];
    return node.children.flatMap(child => this.getAllDescendantFilePaths(child));
  }

  /**
   * Toggle selection of a node
   */
  private toggleSelection(node: TreeNode): void {
    if (node.isFolder) {
      // Toggle all descendants
      const allDescendants = this.getAllDescendantFilePaths(node);
      const allSelected = allDescendants.every(p => this.selectedPaths.has(p));
      
      if (allSelected) {
        // Deselect all descendants
        allDescendants.forEach(p => {
          this.selectedPaths.delete(p);
          
          // Find the corresponding file node and notify via onSelect
          const fileNode = this.findNodeByPath(p);
          if (fileNode && !fileNode.isFolder) {
            this.options.onSelect?.(fileNode);
          }
        });
      } else {
        // Select all descendants
        allDescendants.forEach(p => {
          this.selectedPaths.add(p);
          
          // Find the corresponding file node and notify via onSelect
          const fileNode = this.findNodeByPath(p);
          if (fileNode && !fileNode.isFolder) {
            this.options.onSelect?.(fileNode);
          }
        });
      }
    } else {
      if (this.selectedPaths.has(node.path)) {
        this.selectedPaths.delete(node.path);
      } else {
        this.selectedPaths.add(node.path);
      }
      
      // For individual files, call onSelect as before
      this.options.onSelect?.(node);
    }
  }

  /**
   * Handle keyboard navigation
   */
  handleKeyboard(e: KeyboardEvent): void {
    const visible = this.getVisibleNodes();
    const idx = visible.findIndex(n => n.path === this.focusedPath);
    if (idx === -1) return;
    const node = visible[idx];
    
    // --- Numpad arrow and zero key aliases ---
    // Numpad: 8=Up, 2=Down, 4=Left, 6=Right, 0=Space/Select
    const key = e.key;
    const code = e.code;
    const isNumpad = code.startsWith("Numpad");
    const isEnter = key === "Enter" || code === "NumpadEnter";
    const isSpace = key === " " || key === "Spacebar" || code === "Numpad0";
    const isUp = key === "ArrowUp" || code === "Numpad8";
    const isDown = key === "ArrowDown" || code === "Numpad2";
    const isLeft = key === "ArrowLeft" || code === "Numpad4";
    const isRight = key === "ArrowRight" || code === "Numpad6";
    
    // --- Navigation ---
    if (isDown) {
      if (idx < visible.length - 1) {
        this.focusedPath = visible[idx + 1].path;
        if (this._rootContainer) this.renderTree();
      }
      e.preventDefault();
    } else if (isUp) {
      if (idx > 0) {
        this.focusedPath = visible[idx - 1].path;
        if (this._rootContainer) this.renderTree();
      }
      e.preventDefault();
    } else if (isSpace) {
      this.toggleSelection(node);
      if (this._rootContainer) this.renderTree();
      e.preventDefault();
    } else if (isLeft) {
      if (node.isFolder && this.expanded.has(node.path)) {
        this.expanded.delete(node.path);
        if (this._rootContainer) this.renderTree();
      } else {
        // Move focus to parent folder if possible
        const parent = this.findParentNode(node.path);
        if (parent) {
          this.focusedPath = parent.path;
          if (this._rootContainer) this.renderTree();
        }
      }
      e.preventDefault();
    } else if (isRight) {
      if (node.isFolder && !this.expanded.has(node.path)) {
        this.expanded.add(node.path);
        if (this._rootContainer) this.renderTree();
      } else if (node.isFolder && node.children && node.children.length > 0) {
        // Focus first child
        const next = visible[idx + 1];
        if (next && this.isChildOf(next, node)) {
          this.focusedPath = next.path;
          if (this._rootContainer) this.renderTree();
        }
      }
      e.preventDefault();
    } else if (isEnter) {
      // With Shift: select folder recursively (like spacebar)
      if (e.shiftKey && node.isFolder) {
        this.toggleSelection(node);
        if (this._rootContainer) this.renderTree();
        e.preventDefault();
      }
      // Without Shift: toggle folders, select files
      else if (node.isFolder) {
        // Enter toggles expand/collapse for folders
        if (this.expanded.has(node.path)) {
          this.expanded.delete(node.path);
        } else {
          this.expanded.add(node.path);
        }
        if (this._rootContainer) this.renderTree();
        e.preventDefault();
      } else {
        // Enter selects files (like spacebar)
        this.toggleSelection(node);
        if (this._rootContainer) this.renderTree();
        e.preventDefault();
      }
    }
  }

  /**
   * Find parent node by path
   */
  private findParentNode(path: string): TreeNode | null {
    if (!this.tree) return null;
    let parent: TreeNode | null = null;
    
    const search = (nodes: TreeNode[], ancestor: TreeNode | null) => {
      for (const n of nodes) {
        if (n.path === path) {
          parent = ancestor;
          return true;
        }
        if (n.isFolder && n.children) {
          if (search(n.children, n)) return true;
        }
      }
      return false;
    };
    
    if (this.tree.children) {
      search(this.tree.children, null);
    }
    
    return parent;
  }
  
  /**
   * Find node by path
   */
  private findNodeByPath(path: string): TreeNode | null {
    if (!this.tree) return null;
    let foundNode: TreeNode | null = null;
    
    const search = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        if (n.path === path) {
          foundNode = n;
          return true;
        }
        if (n.isFolder && n.children) {
          if (search(n.children)) return true;
        }
      }
      return false;
    };
    
    if (this.tree.children) {
      search(this.tree.children);
    }
    
    return foundNode;
  }

  /**
   * Check if candidate is a descendant of possibleParent
   */
  private isChildOf(candidate: TreeNode, possibleParent: TreeNode): boolean {
    if (!possibleParent.isFolder || !possibleParent.children) return false;
    for (const child of possibleParent.children) {
      if (child.path === candidate.path) return true;
      if (child.isFolder && this.isChildOf(candidate, child)) return true;
    }
    return false;
  }

  /**
   * Set selected paths
   */
  setSelected(paths: string[]) {
    this.selectedPaths = new Set(paths);
    if (this._rootContainer) this.renderTree();
  }

  /**
   * Set expanded state for a path
   */
  setExpanded(path: string, expanded: boolean): void {
    if (expanded) {
      this.expanded.add(path);
    } else {
      this.expanded.delete(path);
    }
    if (this._rootContainer) this.renderTree();
  }

  /**
   * Get the currently selected paths
   */
  getSelectedPaths(): string[] {
    return Array.from(this.selectedPaths);
  }
}