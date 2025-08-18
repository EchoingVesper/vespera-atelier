import { ItemView, WorkspaceLeaf, Plugin, TFile } from 'obsidian';

/**
 * Status of an output file
 */
export enum FileStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  ERROR = 'error'
}

/**
 * Interface for output file data
 */
export interface OutputFile {
  id: string;
  name: string;
  path: string;
  status: FileStatus;
  file?: TFile;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Manager for tabs in the output files view
 */
export class TabManager {
  private container: HTMLElement;
  private tabsEl: HTMLElement;
  private contentEl: HTMLElement;
  private tabs: Map<string, {
    tabEl: HTMLElement,
    contentEl: HTMLElement,
    active: boolean
  }> = new Map();
  private activeTabId: string | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    
    // Create tabs container
    this.tabsEl = container.createDiv({ cls: 'tabs-container' });
    
    // Create content container
    this.contentEl = container.createDiv({ cls: 'tabs-content' });
  }

  /**
   * Add a new tab
   */
  addTab(id: string, title: string, content: HTMLElement): void {
    // Create tab element
    const tabEl = this.tabsEl.createDiv({ cls: 'tab' });
    tabEl.textContent = title;
    tabEl.addEventListener('click', () => this.activateTab(id));
    
    // Add content element
    content.addClass('tab-content');
    content.style.display = 'none';
    this.contentEl.appendChild(content);
    
    // Store tab data
    this.tabs.set(id, {
      tabEl,
      contentEl: content,
      active: false
    });
    
    // Activate if first tab
    if (this.tabs.size === 1) {
      this.activateTab(id);
    }
  }

  /**
   * Activate a tab
   */
  activateTab(id: string): void {
    // Deactivate current active tab
    if (this.activeTabId) {
      const activeTab = this.tabs.get(this.activeTabId);
      if (activeTab) {
        activeTab.tabEl.removeClass('active');
        activeTab.contentEl.style.display = 'none';
        activeTab.active = false;
      }
    }
    
    // Activate new tab
    const tab = this.tabs.get(id);
    if (tab) {
      tab.tabEl.addClass('active');
      tab.contentEl.style.display = 'block';
      tab.active = true;
      this.activeTabId = id;
    }
  }

  /**
   * Remove a tab
   */
  removeTab(id: string): void {
    const tab = this.tabs.get(id);
    if (!tab) return;
    
    // Remove elements
    tab.tabEl.remove();
    tab.contentEl.remove();
    
    // Remove from map
    this.tabs.delete(id);
    
    // If active tab was removed, activate another tab
    if (this.activeTabId === id) {
      this.activeTabId = null;
      if (this.tabs.size > 0) {
        const nextKey = this.tabs.keys().next().value;
        if (nextKey !== undefined) {
          this.activateTab(nextKey);
        }
      }
    }
  }

  /**
   * Clear all tabs
   */
  clearTabs(): void {
    this.tabsEl.empty();
    this.contentEl.empty();
    this.tabs.clear();
    this.activeTabId = null;
  }
}

/**
 * View for displaying output files
 */
export class OutputFilesView extends ItemView {
  private files: Map<string, OutputFile> = new Map();
  private tabManager!: TabManager;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return 'vespera-output-files';
  }

  getDisplayText(): string {
    return 'Output Files';
  }

  getIcon(): string {
    return 'file-text';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    
    container.createEl('h2', { text: 'Output Files' });
    
    // Create tab manager
    this.tabManager = new TabManager(container as HTMLElement);
    
    // Create "All Files" tab
    const allFilesContent = container.createDiv();
    this.tabManager.addTab('all', 'All Files', allFilesContent);
    
    // Create status tabs
    const statusTabs = {
      [FileStatus.PENDING]: container.createDiv(),
      [FileStatus.PROCESSING]: container.createDiv(),
      [FileStatus.COMPLETED]: container.createDiv(),
      [FileStatus.ERROR]: container.createDiv()
    };
    
    this.tabManager.addTab('pending', 'Pending', statusTabs[FileStatus.PENDING]);
    this.tabManager.addTab('processing', 'Processing', statusTabs[FileStatus.PROCESSING]);
    this.tabManager.addTab('completed', 'Completed', statusTabs[FileStatus.COMPLETED]);
    this.tabManager.addTab('error', 'Errors', statusTabs[FileStatus.ERROR]);
    
    // Render existing files
    this.renderFiles();
  }

  /**
   * Add a new output file
   */
  addFile(file: OutputFile): void {
    this.files.set(file.id, file);
    this.renderFiles();
  }

  /**
   * Update an existing output file
   */
  updateFile(id: string, updates: Partial<OutputFile>): void {
    const file = this.files.get(id);
    if (!file) return;
    
    // Update file data
    Object.assign(file, updates);
    
    // Re-render files
    this.renderFiles();
  }

  /**
   * Remove an output file
   */
  removeFile(id: string): void {
    this.files.delete(id);
    this.renderFiles();
  }

  /**
   * Clear all output files
   */
  clearFiles(): void {
    this.files.clear();
    this.renderFiles();
  }

  /**
   * Render all files
   */
  private renderFiles(): void {
    // Get tab content elements
    const allFilesEl = this.containerEl.querySelector('.tab-content');
    const pendingFilesEl = this.containerEl.querySelectorAll('.tab-content')[1];
    const processingFilesEl = this.containerEl.querySelectorAll('.tab-content')[2];
    const completedFilesEl = this.containerEl.querySelectorAll('.tab-content')[3];
    const errorFilesEl = this.containerEl.querySelectorAll('.tab-content')[4];
    
    if (!allFilesEl || !pendingFilesEl || !processingFilesEl || !completedFilesEl || !errorFilesEl) {
      return;
    }
    
    // Clear content
    allFilesEl.empty();
    pendingFilesEl.empty();
    processingFilesEl.empty();
    completedFilesEl.empty();
    errorFilesEl.empty();
    
    // Group files by status
    const filesByStatus = {
      [FileStatus.PENDING]: [] as OutputFile[],
      [FileStatus.PROCESSING]: [] as OutputFile[],
      [FileStatus.COMPLETED]: [] as OutputFile[],
      [FileStatus.ERROR]: [] as OutputFile[]
    };
    
    // Add files to groups
    this.files.forEach(file => {
      filesByStatus[file.status].push(file);
    });
    
    // Render files in each tab
    this.renderFileList(allFilesEl as HTMLElement, Array.from(this.files.values()));
    this.renderFileList(pendingFilesEl as HTMLElement, filesByStatus[FileStatus.PENDING]);
    this.renderFileList(processingFilesEl as HTMLElement, filesByStatus[FileStatus.PROCESSING]);
    this.renderFileList(completedFilesEl as HTMLElement, filesByStatus[FileStatus.COMPLETED]);
    this.renderFileList(errorFilesEl as HTMLElement, filesByStatus[FileStatus.ERROR]);
  }

  /**
   * Render a list of files
   */
  private renderFileList(container: HTMLElement, files: OutputFile[]): void {
    if (files.length === 0) {
      container.createEl('p', { text: 'No files to display.' });
      return;
    }
    
    const list = container.createEl('ul', { cls: 'file-list' });
    
    files.forEach(file => {
      const item = list.createEl('li', { cls: `file-item status-${file.status}` });
      
      const header = item.createDiv({ cls: 'file-header' });
      
      header.createEl('span', { 
        text: file.name,
        cls: 'file-name'
      });
      
      header.createEl('span', { 
        text: file.status,
        cls: 'file-status'
      });
      
      if (file.file) {
        const openButton = header.createEl('button', { 
          text: 'Open',
          cls: 'file-open-button'
        });
        openButton.addEventListener('click', () => {
          this.app.workspace.openLinkText(file.path, '');
        });
      }
      
      if (file.error) {
        item.createEl('p', { 
          text: file.error,
          cls: 'file-error'
        });
      }
    });
  }
}

/**
 * Manager for output files
 */
export class OutputFilesManager {
  private plugin: Plugin;
  private view: OutputFilesView | null = null;
  private files: Map<string, OutputFile> = new Map();

  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  /**
   * Set the output files view instance
   */
  setView(view: OutputFilesView): void {
    this.view = view;
    
    // Add existing files to view
    this.files.forEach(file => {
      if (this.view) {
        this.view.addFile(file);
      }
    });
  }

  /**
   * Add a new output file
   */
  addFile(file: OutputFile): void {
    this.files.set(file.id, file);
    
    if (this.view) {
      this.view.addFile(file);
    }
  }

  /**
   * Update an existing output file
   */
  updateFile(id: string, updates: Partial<OutputFile>): void {
    const file = this.files.get(id);
    if (!file) return;
    
    // Update file data
    Object.assign(file, updates);
    
    if (this.view) {
      this.view.updateFile(id, updates);
    }
  }

  /**
   * Remove an output file
   */
  removeFile(id: string): void {
    this.files.delete(id);
    
    if (this.view) {
      this.view.removeFile(id);
    }
  }

  /**
   * Clear all output files
   */
  clearFiles(): void {
    this.files.clear();
    
    if (this.view) {
      this.view.clearFiles();
    }
  }

  /**
   * Get all output files
   */
  getFiles(): OutputFile[] {
    return Array.from(this.files.values());
  }

  /**
   * Get a specific output file
   */
  getFile(id: string): OutputFile | undefined {
    return this.files.get(id);
  }
}

/**
 * Register the output files view with the plugin
 */
export function registerOutputFilesView(plugin: Plugin): OutputFilesManager {
  const outputFilesManager = new OutputFilesManager(plugin);
  
  plugin.registerView(
    'vespera-output-files',
    (leaf) => {
      const view = new OutputFilesView(leaf);
      outputFilesManager.setView(view);
      return view;
    }
  );
  
  plugin.addRibbonIcon('file-text', 'Output Files', () => {
    activateView(plugin);
  });
  
  return outputFilesManager;
}

/**
 * Activate the output files view
 */
async function activateView(plugin: Plugin): Promise<void> {
  const { workspace } = plugin.app;
  
  let leaf = workspace.getLeavesOfType('vespera-output-files')[0];
  
  if (!leaf) {
    const rightLeaf = workspace.getRightLeaf(false);
    if (rightLeaf) {
      leaf = rightLeaf;
      await leaf.setViewState({
        type: 'vespera-output-files',
        active: true,
      });
    }
  }
  
  if (leaf) {
    workspace.revealLeaf(leaf);
  }
}