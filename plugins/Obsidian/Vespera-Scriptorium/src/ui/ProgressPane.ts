import { ItemView, WorkspaceLeaf, Plugin } from 'obsidian';

export interface ProgressOptions {
  id: string;
  title: string;
  total: number;
  current?: number;
  message?: string;
}

export interface ProgressUpdate {
  current?: number;
  total?: number;
  message?: string;
  increment?: number;
}

/**
 * View for displaying progress of operations
 */
export class ProgressPane extends ItemView {
  private progressItems: Map<string, {
    element: HTMLElement,
    options: ProgressOptions
  }> = new Map();

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return 'vespera-progress-pane';
  }

  getDisplayText(): string {
    return 'Progress';
  }

  getIcon(): string {
    return 'loader';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.createEl('h2', { text: 'Progress' });
    container.createDiv({ cls: 'progress-items-container' });
  }

  /**
   * Create a new progress item
   */
  createProgressItem(options: ProgressOptions): void {
    const container = this.containerEl.querySelector('.progress-items-container');
    if (!container) return;

    const itemEl = container.createDiv({ cls: 'progress-item' });
    
    const header = itemEl.createDiv({ cls: 'progress-header' });
    header.createEl('h3', { text: options.title });
    
    const progressBar = itemEl.createDiv({ cls: 'progress-bar-container' });
    const bar = progressBar.createDiv({ cls: 'progress-bar' });
    
    const current = options.current || 0;
    const percent = Math.round((current / options.total) * 100);
    bar.style.width = `${percent}%`;
    
    const statusEl = itemEl.createDiv({ cls: 'progress-status' });
    statusEl.createSpan({ 
      text: `${current}/${options.total}`,
      cls: 'progress-count'
    });
    
    if (options.message) {
      statusEl.createSpan({ 
        text: options.message,
        cls: 'progress-message'
      });
    }
    
    this.progressItems.set(options.id, {
      element: itemEl,
      options
    });
  }

  /**
   * Update an existing progress item
   */
  updateProgressItem(id: string, update: ProgressUpdate): void {
    const item = this.progressItems.get(id);
    if (!item) return;
    
    const options = item.options;
    
    // Update current progress
    if (update.increment) {
      options.current = (options.current || 0) + update.increment;
    } else if (update.current !== undefined) {
      options.current = update.current;
    }
    
    // Update total if provided
    if (update.total !== undefined) {
      options.total = update.total;
    }
    
    // Update message if provided
    if (update.message !== undefined) {
      options.message = update.message;
    }
    
    // Update UI
    const element = item.element;
    
    // Update progress bar
    const bar = element.querySelector('.progress-bar');
    if (bar) {
      const percent = Math.round(((options.current || 0) / options.total) * 100);
      (bar as HTMLElement).style.width = `${percent}%`;
    }
    
    // Update count
    const count = element.querySelector('.progress-count');
    if (count) {
      count.textContent = `${options.current}/${options.total}`;
    }
    
    // Update message
    const message = element.querySelector('.progress-message');
    if (message && options.message) {
      message.textContent = options.message;
    }
  }

  /**
   * Remove a progress item
   */
  removeProgressItem(id: string): void {
    const item = this.progressItems.get(id);
    if (!item) return;
    
    item.element.remove();
    this.progressItems.delete(id);
  }

  /**
   * Clear all progress items
   */
  clearProgressItems(): void {
    const container = this.containerEl.querySelector('.progress-items-container');
    if (container) {
      container.empty();
    }
    this.progressItems.clear();
  }
}

/**
 * Manager for progress operations
 */
export class ProgressManager {
  private plugin: Plugin;
  private progressPane: ProgressPane | null = null;

  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  /**
   * Set the progress pane instance
   */
  setProgressPane(pane: ProgressPane): void {
    this.progressPane = pane;
  }

  /**
   * Create a new progress item
   */
  createProgressItem(options: ProgressOptions): void {
    if (this.progressPane) {
      this.progressPane.createProgressItem(options);
    }
  }

  /**
   * Update an existing progress item
   */
  updateProgressItem(id: string, update: ProgressUpdate): void {
    if (this.progressPane) {
      this.progressPane.updateProgressItem(id, update);
    }
  }

  /**
   * Remove a progress item
   */
  removeProgressItem(id: string): void {
    if (this.progressPane) {
      this.progressPane.removeProgressItem(id);
    }
  }

  /**
   * Clear all progress items
   */
  clearProgressItems(): void {
    if (this.progressPane) {
      this.progressPane.clearProgressItems();
    }
  }
}

/**
 * Register the progress pane with the plugin
 */
export function registerProgressPane(plugin: Plugin): ProgressManager {
  const progressManager = new ProgressManager(plugin);
  
  plugin.registerView(
    'vespera-progress-pane',
    (leaf) => {
      const pane = new ProgressPane(leaf);
      progressManager.setProgressPane(pane);
      return pane;
    }
  );
  
  plugin.addRibbonIcon('loader', 'Progress', () => {
    activateView(plugin);
  });
  
  return progressManager;
}

/**
 * Activate the progress pane view
 */
export async function activateView(plugin: Plugin): Promise<void> {
  const { workspace } = plugin.app;
  
  let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType('vespera-progress-pane')[0];
  
  if (!leaf) {
    leaf = workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({
        type: 'vespera-progress-pane',
        active: true,
      });
    } else {
      return; // Exit if no leaf is available
    }
  }
  
  workspace.revealLeaf(leaf);
}