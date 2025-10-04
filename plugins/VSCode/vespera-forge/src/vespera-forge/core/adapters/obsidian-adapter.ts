/**
 * Obsidian Platform Adapter
 * Handles Obsidian-specific API interactions and plugin communication
 */

import { PlatformAdapter, Context, UserRole, WorkflowStage, CollaborationMode, DeviceType } from '../types';

export class ObsidianAdapter implements PlatformAdapter {
  public readonly type = 'obsidian' as const;
  public api: any;
  private messageCallbacks: ((message: any) => void)[] = [];
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(obsidianApi?: any) {
    // Initialize Obsidian API
    this.api = obsidianApi || this.acquireObsidianAPI();
    this.setupEventHandling();
  }

  private acquireObsidianAPI(): any {
    // In Obsidian plugin context, the API is passed to the plugin
    // This is a fallback for development/testing
    if (typeof window !== 'undefined' && (window as any).obsidian) {
      return (window as any).obsidian;
    }
    
    // Mock API for development
    return {
      vault: {
        getAbstractFileByPath: (path: string) => null,
        read: (file: any) => Promise.resolve(''),
        write: (file: any, content: string) => Promise.resolve()
      },
      workspace: {
        getActiveFile: () => null,
        openLinkText: (text: string, path: string) => Promise.resolve()
      },
      notice: (message: string, timeout?: number) => {
        console.log('Obsidian Notice:', message);
      }
    };
  }

  private setupEventHandling(): void {
    // Obsidian uses an event system
    if (this.api?.workspace?.on) {
      // Set up workspace event listeners
      this.api.workspace.on('active-leaf-change', (leaf: any) => {
        this.emitEvent('active-leaf-change', leaf);
      });
      
      this.api.workspace.on('file-open', (file: any) => {
        this.emitEvent('file-open', file);
      });
    }
  }

  private emitEvent(eventName: string, data: any): void {
    const listeners = this.eventListeners.get(eventName) || [];
    listeners.forEach(listener => listener(data));
  }

  sendMessage(message: any): void {
    // Obsidian doesn't have a direct message system like VS Code
    // Instead, we use events or direct API calls
    this.emitEvent('message', message);
  }

  onMessage(callback: (message: any) => void): void {
    this.addEventListener('message', callback);
  }

  addEventListener(eventName: string, callback: Function): void {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, []);
    }
    this.eventListeners.get(eventName)!.push(callback);
  }

  removeEventListener(eventName: string, callback: Function): void {
    const listeners = this.eventListeners.get(eventName);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  getTheme(): string {
    if (typeof document !== 'undefined') {
      const body = document.body;
      if (body.classList.contains('theme-dark')) {
        return 'dark';
      } else if (body.classList.contains('theme-light')) {
        return 'light';
      }
    }
    return 'light';
  }

  async openFile(path: string): Promise<void> {
    try {
      if (this.api?.workspace?.openLinkText) {
        await this.api.workspace.openLinkText('', path, false);
      }
    } catch (error) {
      console.error('Failed to open file:', error);
      throw error;
    }
  }

  async saveFile(path: string, content: string): Promise<void> {
    try {
      if (this.api?.vault) {
        const file = this.api.vault.getAbstractFileByPath(path);
        if (file) {
          await this.api.vault.write(file, content);
        } else {
          // Create new file
          await this.api.vault.create(path, content);
        }
      }
    } catch (error) {
      console.error('Failed to save file:', error);
      throw error;
    }
  }

  showNotification(message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
    if (this.api?.notice) {
      const timeout = type === 'error' ? 8000 : 3000;
      this.api.notice(message, timeout);
    }
  }

  // Obsidian-specific methods
  async getActiveFile(): Promise<any> {
    return this.api?.workspace?.getActiveFile() || null;
  }

  async readFile(file: any): Promise<string> {
    if (this.api?.vault?.read) {
      return await this.api.vault.read(file);
    }
    return '';
  }

  async writeFile(file: any, content: string): Promise<void> {
    if (this.api?.vault?.write) {
      await this.api.vault.write(file, content);
    }
  }

  getVault(): any {
    return this.api?.vault;
  }

  getWorkspace(): any {
    return this.api?.workspace;
  }

  // File system operations
  async createFile(path: string, content: string): Promise<void> {
    if (this.api?.vault?.create) {
      await this.api.vault.create(path, content);
    }
  }

  async deleteFile(file: any): Promise<void> {
    if (this.api?.vault?.delete) {
      await this.api.vault.delete(file);
    }
  }

  async fileExists(path: string): Promise<boolean> {
    if (this.api?.vault?.getAbstractFileByPath) {
      const file = this.api.vault.getAbstractFileByPath(path);
      return file !== null;
    }
    return false;
  }

  // Context detection for Obsidian
  getCurrentContext(): Context {
    // In a real implementation, this would detect the current context
    // from Obsidian workspace, opened files, vault structure, etc.
    return {
      role: UserRole.WRITER,
      workflowStage: WorkflowStage.CREATION,
      collaborationMode: CollaborationMode.SOLO,
      deviceType: DeviceType.DESKTOP
    };
  }

  // Obsidian-specific styling
  applyObsidianStyling(): void {
    if (typeof document !== 'undefined') {
      // Apply Obsidian-specific CSS variables and classes
      document.documentElement.style.setProperty('--obsidian-font-family', 'var(--font-text)');
      document.documentElement.style.setProperty('--obsidian-font-size', 'var(--font-text-size)');
      
      // Add Obsidian specific classes
      document.body.classList.add('obsidian-plugin');
    }
  }

  // Handle Obsidian plugin lifecycle
  onload(): void {
    console.log('Vespera Forge Obsidian Adapter loaded');
    this.applyObsidianStyling();
  }

  onunload(): void {
    console.log('Vespera Forge Obsidian Adapter unloaded');
    // Clean up event listeners
    this.eventListeners.clear();
  }

  // Obsidian command registration
  registerCommand(commandId: string, callback: Function): void {
    if (this.api?.addCommand) {
      this.api.addCommand({
        id: commandId,
        name: commandId,
        callback: callback
      });
    }
  }

  // Obsidian settings
  async loadSettings(): Promise<any> {
    // In a real implementation, this would load from Obsidian settings
    return {};
  }

  async saveSettings(settings: any): Promise<void> {
    // In a real implementation, this would save to Obsidian settings
  }

  // Obsidian modals
  openModal(content: string): void {
    // In a real implementation, this would open an Obsidian modal
    console.log('Opening modal with content:', content);
  }

  // Obsidian workspace management
  getLeaves(): any[] {
    return this.api?.workspace?.getLeaves() || [];
  }

  getLeaf(type?: string): any {
    return this.api?.workspace?.getLeaf(type);
  }

  splitLeaf(): any {
    return this.api?.workspace?.splitActiveLeaf();
  }
}