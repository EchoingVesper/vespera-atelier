/**
 * Content providers for Vespera Forge extension
 */

import * as vscode from 'vscode';
import { ContentProvider, ContentItem, ContentType, VesperaForgeConfig } from '@/types';
import { generateId, log, getConfig } from '@/utils';
import { BinderyContentProvider } from './bindery-content';

/**
 * Memory-based content provider for development and testing
 * In production, this will be replaced with Rust Bindery integration
 */
export class MemoryContentProvider implements ContentProvider {
  private content: Map<string, ContentItem> = new Map();

  async getContent(id: string): Promise<ContentItem | undefined> {
    log(`Getting content with id: ${id}`);
    return this.content.get(id);
  }

  async getAllContent(): Promise<ContentItem[]> {
    log(`Getting all content (${this.content.size} items)`);
    return Array.from(this.content.values());
  }

  async createContent(item: Omit<ContentItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<ContentItem> {
    const newItem: ContentItem = {
      ...item,
      id: generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.content.set(newItem.id, newItem);
    log(`Created content item with id: ${newItem.id}, type: ${newItem.type}`);
    
    return newItem;
  }

  async updateContent(id: string, updates: Partial<ContentItem>): Promise<ContentItem> {
    const existing = this.content.get(id);
    if (!existing) {
      throw new Error(`Content with id ${id} not found`);
    }

    const updated: ContentItem = {
      ...existing,
      ...updates,
      id: existing.id, // Ensure ID cannot be changed
      createdAt: existing.createdAt, // Ensure createdAt cannot be changed
      updatedAt: new Date()
    };

    this.content.set(id, updated);
    log(`Updated content item with id: ${id}`);
    
    return updated;
  }

  async deleteContent(id: string): Promise<boolean> {
    const deleted = this.content.delete(id);
    if (deleted) {
      log(`Deleted content item with id: ${id}`);
    } else {
      log(`Failed to delete content item with id: ${id} - not found`);
    }
    return deleted;
  }

  /**
   * Get content by type
   */
  async getContentByType(type: ContentType): Promise<ContentItem[]> {
    log(`Getting content by type: ${type}`);
    return Array.from(this.content.values()).filter(item => item.type === type);
  }

  /**
   * Clear all content (for testing)
   */
  async clearAll(): Promise<void> {
    const count = this.content.size;
    this.content.clear();
    log(`Cleared all content (${count} items)`);
  }

  /**
   * Get content count
   */
  getContentCount(): number {
    return this.content.size;
  }
}

/**
 * Tree data provider for VS Code explorer view
 */
export class VesperaForgeTreeDataProvider implements vscode.TreeDataProvider<ContentItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ContentItem | undefined | null | void> = new vscode.EventEmitter<ContentItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ContentItem | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor(private contentProvider: ContentProvider) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ContentItem): vscode.TreeItem {
    const item = new vscode.TreeItem(element.title, vscode.TreeItemCollapsibleState.None);
    
    item.description = element.type;
    item.tooltip = `${element.title}\nType: ${element.type}\nUpdated: ${element.updatedAt.toLocaleDateString()}`;
    
    // Set icons based on content type
    switch (element.type) {
      case ContentType.Task:
        item.iconPath = new vscode.ThemeIcon('checklist');
        break;
      case ContentType.Note:
        item.iconPath = new vscode.ThemeIcon('note');
        break;
      case ContentType.Project:
        item.iconPath = new vscode.ThemeIcon('project');
        break;
      case ContentType.Template:
        item.iconPath = new vscode.ThemeIcon('template');
        break;
      default:
        item.iconPath = new vscode.ThemeIcon('file');
    }

    // Add context value for context menu
    item.contextValue = `vesperaForgeItem-${element.type}`;
    
    return item;
  }

  async getChildren(element?: ContentItem): Promise<ContentItem[]> {
    if (!element) {
      // Root level - return all content
      return await this.contentProvider.getAllContent();
    }
    
    // For now, no hierarchical structure - return empty array
    return [];
  }
}

/**
 * Initialize all providers
 */
export function initializeProviders(context: vscode.ExtensionContext): {
  contentProvider: ContentProvider;
  treeDataProvider: VesperaForgeTreeDataProvider;
} {
  log('Initializing content providers');
  
  const config = getConfig();
  let contentProvider: ContentProvider;
  
  // Choose provider based on configuration and environment
  if (shouldUseBinderyProvider(config)) {
    log('Using Bindery content provider');
    contentProvider = new BinderyContentProvider({
      enableAutoSync: true,
      syncInterval: 30000,
      enableCollaboration: false,
      defaultProjectId: undefined
    });
  } else {
    log('Using memory content provider (development/fallback mode)');
    contentProvider = new MemoryContentProvider();
  }
  
  const treeDataProvider = new VesperaForgeTreeDataProvider(contentProvider);
  
  // Register tree data provider
  const treeView = vscode.window.createTreeView('vesperaForgeExplorer', {
    treeDataProvider,
    showCollapseAll: true
  });
  
  context.subscriptions.push(treeView);
  
  // Register disposal for Bindery provider
  if (contentProvider instanceof BinderyContentProvider) {
    context.subscriptions.push({
      dispose: () => contentProvider.dispose()
    });
  }
  
  log('Content providers initialized');
  
  return {
    contentProvider,
    treeDataProvider
  };
}

/**
 * Determine whether to use Bindery provider based on configuration and environment
 */
function shouldUseBinderyProvider(config: VesperaForgeConfig): boolean {
  // Always try to use Bindery provider if auto-start is enabled
  if (config.enableAutoStart) {
    return true;
  }
  
  // Check for explicit Bindery path configuration
  if (config.rustBinderyPath && config.rustBinderyPath.trim() !== '') {
    return true;
  }
  
  // Default to memory provider for development
  return false;
}