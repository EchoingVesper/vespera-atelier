/**
 * Bindery Content Provider - Integrates VS Code extension with Rust Bindery backend
 * 
 * This provider replaces the memory-based content provider with real Bindery operations,
 * supporting tasks, notes, projects, and templates with CRDT collaborative editing.
 */

import * as vscode from 'vscode';
import { 
  ContentProvider, 
  ContentItem, 
  ContentType, 
  TaskItem, 
  TaskStatus, 
  TaskPriority 
} from '../types';
import { 
  BinderyService, 
  getBinderyService 
} from '../services/bindery';
import {
  CodexId,
  TaskInput,
  TaskUpdateInput,
  TaskSummary,
  TaskDashboard,
  TaskStatus as BinderyTaskStatus,
  TaskPriority as BinderyTaskPriority,
  Role,
  Codex
} from '../types/bindery';

interface BinderyContentProviderConfig {
  enableAutoSync: boolean;
  syncInterval: number; // milliseconds
  enableCollaboration: boolean;
  defaultProjectId?: string;
}

class BinderyContentProvider implements ContentProvider {
  private bindery: BinderyService;
  private config: BinderyContentProviderConfig;
  private syncTimer: NodeJS.Timeout | null = null;
  private contentCache = new Map<string, ContentItem>();
  private lastSyncTime: Date | null = null;

  constructor(config: Partial<BinderyContentProviderConfig> = {}) {
    this.config = {
      enableAutoSync: config.enableAutoSync ?? true,
      syncInterval: config.syncInterval ?? 30000, // 30 seconds
      enableCollaboration: config.enableCollaboration ?? false,
      defaultProjectId: config.defaultProjectId || undefined
    };

    this.bindery = getBinderyService({
      enableLogging: true,
      workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    });

    this.setupEventListeners();
  }

  /**
   * Initialize the provider and connect to Bindery
   */
  public async initialize(): Promise<boolean> {
    try {
      const result = await this.bindery.initialize();
      if (!result.success) {
        console.error('Failed to initialize Bindery:', result.error);
        return false;
      }

      console.log('Bindery provider initialized:', result.data);
      
      if (this.config.enableAutoSync) {
        this.startAutoSync();
      }

      return true;
    } catch (error) {
      console.error('Bindery provider initialization error:', error);
      return false;
    }
  }

  /**
   * Dispose of the provider and disconnect from Bindery
   */
  public async dispose(): Promise<void> {
    this.stopAutoSync();
    await this.bindery.disconnect();
    this.contentCache.clear();
  }

  // ContentProvider Interface Implementation

  public async getContent(id: string): Promise<ContentItem | undefined> {
    try {
      // Check cache first
      if (this.contentCache.has(id)) {
        return this.contentCache.get(id);
      }

      // Try to get as task first
      const taskResult = await this.bindery.getTask(id as CodexId);
      if (taskResult.success) {
        const taskItem = this.convertTaskToContentItem(taskResult.data);
        this.contentCache.set(id, taskItem);
        return taskItem;
      }

      // Try to get as Codex
      const codexResult = await this.bindery.getCodex(id as CodexId);
      if (codexResult.success) {
        const contentItem = this.convertCodexToContentItem(codexResult.data);
        this.contentCache.set(id, contentItem);
        return contentItem;
      }

      return undefined;
    } catch (error) {
      console.error('Failed to get content:', id, error);
      return undefined;
    }
  }

  public async getAllContent(): Promise<ContentItem[]> {
    try {
      const items: ContentItem[] = [];

      // Get all tasks
      const tasksResult = await this.bindery.listTasks({
        project_id: this.config.defaultProjectId || undefined,
        limit: 1000
      });

      if (tasksResult.success) {
        for (const task of tasksResult.data) {
          const contentItem = this.convertTaskToContentItem(task);
          this.contentCache.set(contentItem.id, contentItem);
          items.push(contentItem);
        }
      }

      // Get all Codices
      const codicesResult = await this.bindery.listCodeices();
      if (codicesResult.success) {
        for (const codexId of codicesResult.data) {
          const codexResult = await this.bindery.getCodex(codexId);
          if (codexResult.success) {
            const contentItem = this.convertCodexToContentItem(codexResult.data);
            this.contentCache.set(contentItem.id, contentItem);
            items.push(contentItem);
          }
        }
      }

      this.lastSyncTime = new Date();
      return items;
    } catch (error) {
      console.error('Failed to get all content:', error);
      return [];
    }
  }

  public async createContent(item: Omit<ContentItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<ContentItem> {
    try {
      if (item.type === ContentType.Task) {
        return await this.createTaskContent(item as Omit<TaskItem, 'id' | 'createdAt' | 'updatedAt'>);
      } else {
        return await this.createCodexContent(item);
      }
    } catch (error) {
      console.error('Failed to create content:', error);
      throw new Error(`Failed to create content: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public async updateContent(id: string, updates: Partial<ContentItem>): Promise<ContentItem> {
    try {
      const existing = await this.getContent(id);
      if (!existing) {
        throw new Error(`Content not found: ${id}`);
      }

      if (existing.type === ContentType.Task) {
        return await this.updateTaskContent(id, updates as Partial<TaskItem>);
      } else {
        return await this.updateCodexContent(id, updates);
      }
    } catch (error) {
      console.error('Failed to update content:', id, error);
      throw new Error(`Failed to update content: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public async deleteContent(id: string): Promise<boolean> {
    try {
      const existing = await this.getContent(id);
      if (!existing) {
        return false;
      }

      if (existing.type === ContentType.Task) {
        const result = await this.bindery.deleteTask(id as CodexId, false);
        if (result.success) {
          this.contentCache.delete(id);
          return result.data;
        }
        return false;
      } else {
        const result = await this.bindery.deleteCodex(id as CodexId);
        if (result.success) {
          this.contentCache.delete(id);
          return result.data;
        }
        return false;
      }
    } catch (error) {
      console.error('Failed to delete content:', id, error);
      return false;
    }
  }

  // Bindery-specific Methods

  /**
   * Get task dashboard with statistics
   */
  public async getTaskDashboard(): Promise<TaskDashboard | null> {
    try {
      const result = await this.bindery.getTaskDashboard(this.config.defaultProjectId);
      return result.success ? result.data : null;
    } catch (error) {
      console.error('Failed to get task dashboard:', error);
      return null;
    }
  }

  /**
   * Get available roles
   */
  public async getRoles(): Promise<Role[]> {
    try {
      const result = await this.bindery.listRoles();
      return result.success ? result.data : [];
    } catch (error) {
      console.error('Failed to get roles:', error);
      return [];
    }
  }

  /**
   * Execute task with assigned role
   */
  public async executeTask(taskId: string, dryRun = false): Promise<boolean> {
    try {
      const result = await this.bindery.executeTask(taskId as CodexId, dryRun);
      if (result.success) {
        // Refresh cache for the task
        this.contentCache.delete(taskId);
        await this.getContent(taskId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to execute task:', taskId, error);
      return false;
    }
  }

  /**
   * Complete task with output
   */
  public async completeTask(taskId: string, output?: string, artifacts?: string[]): Promise<boolean> {
    try {
      const result = await this.bindery.completeTask(taskId as CodexId, output, artifacts);
      if (result.success) {
        // Update cache
        const updated = this.convertTaskToContentItem(result.data);
        this.contentCache.set(taskId, updated);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to complete task:', taskId, error);
      return false;
    }
  }

  /**
   * Check if connected to Bindery
   */
  public isConnected(): boolean {
    return this.bindery.isConnected();
  }

  /**
   * Get Bindery connection info
   */
  public getConnectionInfo() {
    return this.bindery.getConnectionInfo();
  }

  /**
   * Get sync information including last sync time
   */
  public getSyncInfo() {
    return {
      lastSyncTime: this.lastSyncTime,
      autoSyncEnabled: this.config.enableAutoSync,
      syncInterval: this.config.syncInterval
    };
  }

  // Private Implementation

  private async createTaskContent(item: Omit<TaskItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<ContentItem> {
    const taskInput: TaskInput = {
      title: item.title,
      description: item.content || undefined,
      priority: this.convertToBinderyPriority(item.priority),
      project_id: this.config.defaultProjectId,
      assignee: item.assignee,
      due_date: item.dueDate?.toISOString(),
      tags: item.metadata['tags'] || [],
      labels: item.metadata['labels'] || {},
      subtasks: []
    };

    const result = await this.bindery.createTask(taskInput);
    if (!result.success) {
      throw new Error(result.error.message);
    }

    // Get the created task to return complete data
    const createdTask = await this.bindery.getTask(result.data);
    if (!createdTask.success) {
      throw new Error('Failed to retrieve created task');
    }

    const contentItem = this.convertTaskToContentItem(createdTask.data);
    this.contentCache.set(contentItem.id, contentItem);
    return contentItem;
  }

  private async createCodexContent(item: Omit<ContentItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<ContentItem> {
    const templateId = item.metadata['templateId'] || 'default';
    
    const result = await this.bindery.createCodex(item.title, templateId);
    if (!result.success) {
      throw new Error(result.error.message);
    }

    // Get the created Codex to return complete data
    const createdCodex = await this.bindery.getCodex(result.data);
    if (!createdCodex.success) {
      throw new Error('Failed to retrieve created Codex');
    }

    const contentItem = this.convertCodexToContentItem(createdCodex.data);
    this.contentCache.set(contentItem.id, contentItem);
    return contentItem;
  }

  private async updateTaskContent(id: string, updates: Partial<TaskItem>): Promise<ContentItem> {
    const updateInput: TaskUpdateInput = {
      task_id: id as CodexId,
      title: updates.title,
      description: updates.content,
      status: updates.status ? this.convertToBinderyStatus(updates.status) : undefined,
      priority: updates.priority ? this.convertToBinderyPriority(updates.priority) : undefined,
      assignee: updates.assignee,
      due_date: updates.dueDate?.toISOString()
    };

    const result = await this.bindery.updateTask(updateInput);
    if (!result.success) {
      throw new Error(result.error.message);
    }

    const contentItem = this.convertTaskToContentItem(result.data);
    this.contentCache.set(id, contentItem);
    return contentItem;
  }

  private async updateCodexContent(_id: string, _updates: Partial<ContentItem>): Promise<ContentItem> {
    // For now, we'll need to implement Codex field updates
    // This would involve updating the Codex fields through the Bindery API
    throw new Error('Codex updates not yet implemented');
  }

  // Conversion Helpers

  private convertTaskToContentItem(task: TaskSummary): TaskItem {
    return {
      id: task.id,
      type: ContentType.Task,
      title: task.title,
      content: '', // TaskSummary doesn't include description
      status: this.convertFromBinderyStatus(task.status),
      priority: this.convertFromBinderyPriority(task.priority),
      assignee: task.assignee,
      dueDate: task.due_date ? new Date(task.due_date) : undefined,
      dependencies: [], // Would need separate API call to get dependencies
      metadata: {
        projectId: task.project_id,
        parentId: task.parent_id,
        childCount: task.child_count,
        tags: task.tags
      },
      createdAt: new Date(task.created_at),
      updatedAt: new Date(task.updated_at)
    };
  }

  private convertCodexToContentItem(codex: Codex): ContentItem {
    // Determine content type based on template
    let contentType = ContentType.Note;
    if (codex.metadata.template_id.includes('project')) {
      contentType = ContentType.Project;
    } else if (codex.metadata.template_id.includes('template')) {
      contentType = ContentType.Template;
    }

    return {
      id: codex.metadata.id,
      type: contentType,
      title: codex.metadata.title,
      content: codex.content.raw_content,
      metadata: {
        templateId: codex.metadata.template_id,
        createdBy: codex.metadata.created_by,
        version: codex.metadata.version,
        tags: codex.metadata.tags,
        references: codex.metadata.references,
        fields: codex.content.fields
      },
      createdAt: new Date(codex.metadata.created_at),
      updatedAt: new Date(codex.metadata.updated_at)
    };
  }

  private convertToBinderyStatus(status: TaskStatus): BinderyTaskStatus {
    switch (status) {
      case TaskStatus.Pending: return BinderyTaskStatus.Todo;
      case TaskStatus.InProgress: return BinderyTaskStatus.Doing;
      case TaskStatus.Completed: return BinderyTaskStatus.Done;
      case TaskStatus.Blocked: return BinderyTaskStatus.Blocked;
      default: return BinderyTaskStatus.Todo;
    }
  }

  private convertFromBinderyStatus(status: BinderyTaskStatus): TaskStatus {
    switch (status) {
      case BinderyTaskStatus.Todo: return TaskStatus.Pending;
      case BinderyTaskStatus.Doing: return TaskStatus.InProgress;
      case BinderyTaskStatus.Review: return TaskStatus.InProgress; // Map to closest
      case BinderyTaskStatus.Done: return TaskStatus.Completed;
      case BinderyTaskStatus.Blocked: return TaskStatus.Blocked;
      case BinderyTaskStatus.Cancelled: return TaskStatus.Blocked; // Map to closest
      case BinderyTaskStatus.Archived: return TaskStatus.Completed; // Map to closest
      default: return TaskStatus.Pending;
    }
  }

  private convertToBinderyPriority(priority: TaskPriority): BinderyTaskPriority {
    switch (priority) {
      case TaskPriority.Critical: return BinderyTaskPriority.Critical;
      case TaskPriority.High: return BinderyTaskPriority.High;
      case TaskPriority.Normal: return BinderyTaskPriority.Normal;
      case TaskPriority.Low: return BinderyTaskPriority.Low;
      default: return BinderyTaskPriority.Normal;
    }
  }

  private convertFromBinderyPriority(priority: BinderyTaskPriority): TaskPriority {
    switch (priority) {
      case BinderyTaskPriority.Critical: return TaskPriority.Critical;
      case BinderyTaskPriority.High: return TaskPriority.High;
      case BinderyTaskPriority.Normal: return TaskPriority.Normal;
      case BinderyTaskPriority.Low: return TaskPriority.Low;
      case BinderyTaskPriority.Someday: return TaskPriority.Low; // Map to closest
      default: return TaskPriority.Normal;
    }
  }

  // Auto-sync Implementation

  private setupEventListeners(): void {
    this.bindery.on('statusChanged', (connectionInfo) => {
      console.log('Bindery connection status changed:', connectionInfo);
      
      if (connectionInfo.status === 'connected' && this.config.enableAutoSync) {
        this.startAutoSync();
      } else if (connectionInfo.status === 'disconnected') {
        this.stopAutoSync();
      }
    });
  }

  private startAutoSync(): void {
    if (this.syncTimer) {
      return; // Already running
    }

    this.syncTimer = setInterval(async () => {
      try {
        await this.syncContent();
      } catch (error) {
        console.error('Auto-sync failed:', error);
      }
    }, this.config.syncInterval);

    console.log('Auto-sync started with interval:', this.config.syncInterval);
  }

  private stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      console.log('Auto-sync stopped');
    }
  }

  private async syncContent(): Promise<void> {
    if (!this.bindery.isConnected()) {
      return;
    }

    // For now, just refresh the cache by clearing it
    // In a full implementation, we'd use CRDT operations for incremental sync
    const cacheSize = this.contentCache.size;
    this.contentCache.clear();
    
    console.log(`Synced content cache (cleared ${cacheSize} items)`);
    this.lastSyncTime = new Date();
  }
}

export { BinderyContentProvider };