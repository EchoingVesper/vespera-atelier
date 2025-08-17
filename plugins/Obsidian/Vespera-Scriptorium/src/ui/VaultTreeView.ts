import { ItemView, WorkspaceLeaf } from 'obsidian';
import { TreeNode } from './treeUtils';
import { VaultTreeViewAdapter, VaultTreeViewOptions } from './VaultTreeViewAdapter';

/**
 * VaultTreeView (Vespera Scriptorium)
 *
 * UI component for rendering a hierarchical, accessible, tree of vault files and folders.
 * Styled to match Obsidian's native file explorer (Vault pane), using row selection and toggling.
 *
 * This class extends ItemView for use in Obsidian's workspace and delegates most functionality
 * to VaultTreeViewAdapter for code reuse between workspace views and modals.
 *
 * @module UI/VaultTreeView
 */

/**
 * View for displaying the vault file structure as a tree
 */
export class VaultTreeView extends ItemView {
  private adapter: VaultTreeViewAdapter;
  public focusTreeContainer?: HTMLElement;
  
  constructor(leaf: WorkspaceLeaf, options: VaultTreeViewOptions = {}) {
    super(leaf);
    this.adapter = new VaultTreeViewAdapter(this.app, options);
  }

  getViewType(): string {
    return 'vespera-vault-tree';
  }

  getDisplayText(): string {
    return 'Vault Tree';
  }

  getIcon(): string {
    return 'folder';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    
    // Create refresh button
    const refreshButton = container.createEl('button', { 
      text: 'Refresh',
      cls: 'vault-tree-refresh',
      attr: {
        "aria-label": "Refresh tree view"
      }
    });
    refreshButton.addEventListener('click', () => this.refreshTree());
    
    // Render the tree using the adapter
    this.adapter.render(container as HTMLElement);
    
    // Store reference to focus container
    this.focusTreeContainer = this.adapter.focusTreeContainer;
    
    // Initial tree render
    await this.refreshTree();
  }

  /**
   * Refresh the tree view
   */
  async refreshTree(): Promise<void> {
    await this.adapter.refreshTree();
  }

  /**
   * Delegate methods to adapter
   */
  setSelected(paths: string[]) {
    this.adapter.setSelected(paths);
  }

  setExpanded(path: string, expanded: boolean): void {
    this.adapter.setExpanded(path, expanded);
  }

  getSelectedPaths(): string[] {
    return this.adapter.getSelectedPaths();
  }

  handleKeyboard(e: KeyboardEvent): void {
    this.adapter.handleKeyboard(e);
  }
}