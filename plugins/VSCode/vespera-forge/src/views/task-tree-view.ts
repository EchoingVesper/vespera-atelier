/**
 * Task Tree View - TreeDataProvider implementation for hierarchical task display
 * Provides a native VS Code tree view with task status icons, context menus, and real-time updates
 */

import * as vscode from 'vscode';
import { getBinderyService } from '../services/bindery';
import { VesperaEvents } from '../utils/events';
import {
  TaskSummary,
  TaskStatus,
  TaskPriority,
  CodexId,
  BinderyConnectionStatus
} from '../types/bindery';

export class TaskTreeItem extends vscode.TreeItem {
  public task?: TaskSummary;
  public children?: TaskTreeItem[];
  public isEmptyState?: boolean;

  constructor(task: TaskSummary, collapsibleState?: vscode.TreeItemCollapsibleState);
  constructor(label: string, isEmptyState: boolean);
  constructor(taskOrLabel: TaskSummary | string, collapsibleStateOrEmpty?: vscode.TreeItemCollapsibleState | boolean) {
    if (typeof taskOrLabel === 'string') {
      // Empty state constructor
      super(taskOrLabel, vscode.TreeItemCollapsibleState.None);
      this.isEmptyState = collapsibleStateOrEmpty as boolean;
      this.contextValue = 'empty-state';
      this.iconPath = new vscode.ThemeIcon('info');
      this.tooltip = taskOrLabel;
    } else {
      // Normal task constructor
      super(taskOrLabel.title, collapsibleStateOrEmpty as vscode.TreeItemCollapsibleState);
      this.task = taskOrLabel;
      this.isEmptyState = false;
    }
  }
}

export class TaskTreeDataProvider implements vscode.TreeDataProvider<TaskTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TaskTreeItem | undefined | null | void> = new vscode.EventEmitter<TaskTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TaskTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private taskCache: Map<CodexId, TaskSummary> = new Map();
  private _rootTasks: TaskSummary[] = [];
  private currentProjectId?: string;
  private refreshTimer?: NodeJS.Timeout;

  constructor() {
    // Listen for Bindery connection changes
    const binderyService = getBinderyService();
    binderyService.on('statusChanged', (info) => {
      if (info.status === BinderyConnectionStatus.Connected) {
        this.refresh();
      } else if (info.status === BinderyConnectionStatus.Disconnected) {
        this.clearCache();
      }
    });

    // Listen for cross-component task events
    VesperaEvents.onTaskChange(() => {
      console.log('[TaskTree] 🔄 Received task change event, refreshing...');
      this.refresh();
    }, 'TaskTreeDataProvider');

    // Auto-refresh every 30 seconds when connected
    this.startAutoRefresh();
  }

  getTreeItem(element: TaskTreeItem): vscode.TreeItem {
    // Handle empty state items
    if (element.isEmptyState) {
      return element;
    }
    
    const task = element.task!;
    
    // Set task icon based on status
    element.iconPath = this.getTaskIcon(task.status, task.priority);
    
    // Set description with status and priority
    element.description = `${task.status}${task.priority !== TaskPriority.Normal ? ` • ${task.priority}` : ''}`;
    
    // Set tooltip with detailed information
    element.tooltip = this.getTaskTooltip(task);
    
    // Set context value for context menu commands
    element.contextValue = this.getContextValue(task);

    // Set command to open task details when clicked
    element.command = {
      command: 'vespera-forge.openTaskDetails',
      title: 'Open Task Details',
      arguments: [task.id]
    };

    return element;
  }

  async getChildren(element?: TaskTreeItem): Promise<TaskTreeItem[]> {
    const binderyService = getBinderyService();
    
    if (!binderyService.isConnected()) {
      return [new TaskTreeItem('Not connected to Bindery. Initialize the extension first.', true)];
    }

    try {
      if (!element || element.isEmptyState) {
        // Get root tasks (tasks without parents)
        // WORKAROUND: Backend has parent_id storage/retrieval issues
        // Try to get task tree structure first, then fall back to filtering
        
        try {
          // First, try to get all task trees (root tasks with their hierarchies)
          const allTasks = await binderyService.listTasks({
            ...(this.currentProjectId && { project_id: this.currentProjectId }),
            limit: 100
          });
          
          if (allTasks.success && allTasks.data.length > 0) {
            // Debug: Log all tasks and their parent_id values
            console.log('[TaskTree] 🔍 All tasks from backend:', allTasks.data.map(t => ({
              id: t.id,
              title: t.title, 
              parent_id: t.parent_id,
              hasParent: !!t.parent_id
            })));
            
            // Build a map of potential parent-child relationships from task tree API
            const taskMap = new Map<string, TaskSummary>();
            const childrenMap = new Map<string, Set<string>>();
            const parentMap = new Map<string, string>();
            
            // Cache all tasks first
            for (const task of allTasks.data) {
              taskMap.set(task.id, task);
            }
            
            // Try to get hierarchical structure using task tree API for each task
            for (const task of allTasks.data) {
              try {
                const treeResult = await binderyService.getTaskTree(task.id, 1);
                if (treeResult.success && treeResult.data.children.length > 0) {
                  // This task has children, so it's a parent
                  const childIds = new Set<string>();
                  for (const child of treeResult.data.children) {
                    childIds.add(child.task.id);
                    parentMap.set(child.task.id, task.id);
                  }
                  childrenMap.set(task.id, childIds);
                }
              } catch (error) {
                // Ignore errors for individual tasks
                console.warn(`[TaskTree] Failed to get tree for task ${task.id}:`, error);
              }
            }
            
            // Find root tasks (tasks that are not children of other tasks)
            const rootTasks = allTasks.data.filter(task => {
              const isRootByParentId = !task.parent_id;
              const isRootByHierarchy = !parentMap.has(task.id);
              const isRoot = isRootByParentId || isRootByHierarchy;
              
              console.log(`[TaskTree] Task "${task.title}" parent_id: ${task.parent_id}, inHierarchy: ${parentMap.has(task.id)} -> isRoot: ${isRoot}`);
              return isRoot;
            });
            
            console.log('[TaskTree] 📋 Root tasks after filtering:', rootTasks.map(t => t.title));
            
            this._rootTasks = rootTasks;
            this.updateCache(allTasks.data);
            
            if (rootTasks.length === 0) {
              // Return empty state message
              return [new TaskTreeItem('No tasks available. Use Ctrl+Shift+P → "Create Content" to add tasks.', true)];
            }
            
            return rootTasks.map(task => this.createTaskTreeItem(task));
          }
        } catch (error) {
          console.error('[TaskTree] Error in enhanced root task loading:', error);
          // Fall back to simple approach
        }
        return [new TaskTreeItem('Failed to load tasks. Check connection to Bindery.', true)];
      } else {
        // Get subtasks for the given task
        if (!element.task) return [];
        const taskId = element.task.id;
        
        // Try to get from task tree structure first
        const treeResult = await binderyService.getTaskTree(taskId, 2);
        if (treeResult.success && treeResult.data.children.length > 0) {
          const childTasks = treeResult.data.children.map(child => child.task);
          this.updateCache(childTasks);
          return childTasks.map(task => this.createTaskTreeItem(task));
        }
        
        // Fallback to list tasks with parent filter
        const result = await binderyService.listTasks({
          parent_id: taskId,
          ...(this.currentProjectId && { project_id: this.currentProjectId }),
          limit: 100
        });

        if (result.success) {
          this.updateCache(result.data);
          return result.data.map(task => this.createTaskTreeItem(task));
        }
        return [];
      }
    } catch (error) {
      console.error('Error loading task children:', error);
      return [];
    }
  }

  private createTaskTreeItem(task: TaskSummary): TaskTreeItem {
    const collapsibleState = task.child_count > 0 ? 
      vscode.TreeItemCollapsibleState.Collapsed : 
      vscode.TreeItemCollapsibleState.None;
    
    return new TaskTreeItem(task, collapsibleState);
  }

  private getTaskIcon(status: TaskStatus, priority: TaskPriority): vscode.ThemeIcon {
    // Status-based icons with priority colors
    const iconMap: Record<TaskStatus, string> = {
      [TaskStatus.Todo]: 'circle-outline',
      [TaskStatus.Doing]: 'sync~spin',
      [TaskStatus.Review]: 'eye',
      [TaskStatus.Done]: 'check',
      [TaskStatus.Blocked]: 'error',
      [TaskStatus.Cancelled]: 'x',
      [TaskStatus.Archived]: 'archive'
    };

    // Priority-based colors
    const colorMap: Record<TaskPriority, vscode.ThemeColor> = {
      [TaskPriority.Critical]: new vscode.ThemeColor('errorForeground'),
      [TaskPriority.High]: new vscode.ThemeColor('notificationsWarningIcon.foreground'),
      [TaskPriority.Normal]: new vscode.ThemeColor('foreground'),
      [TaskPriority.Low]: new vscode.ThemeColor('descriptionForeground'),
      [TaskPriority.Someday]: new vscode.ThemeColor('disabledForeground')
    };

    return new vscode.ThemeIcon(iconMap[status] || 'circle-outline', colorMap[priority]);
  }

  private getTaskTooltip(task: TaskSummary): vscode.MarkdownString {
    const tooltip = new vscode.MarkdownString();
    tooltip.appendMarkdown(`**${task.title}**\n\n`);
    tooltip.appendMarkdown(`**Status:** ${task.status}\n`);
    tooltip.appendMarkdown(`**Priority:** ${task.priority}\n`);
    
    if (task.assignee) {
      tooltip.appendMarkdown(`**Assignee:** ${task.assignee}\n`);
    }
    
    if (task.due_date) {
      const dueDate = new Date(task.due_date);
      tooltip.appendMarkdown(`**Due:** ${dueDate.toLocaleDateString()}\n`);
    }
    
    if (task.tags && task.tags.length > 0) {
      tooltip.appendMarkdown(`**Tags:** ${task.tags.join(', ')}\n`);
    }
    
    tooltip.appendMarkdown(`\n**Created:** ${new Date(task.created_at).toLocaleString()}`);
    tooltip.appendMarkdown(`\n**Updated:** ${new Date(task.updated_at).toLocaleString()}`);
    
    if (task.child_count > 0) {
      tooltip.appendMarkdown(`\n**Subtasks:** ${task.child_count}`);
    }

    return tooltip;
  }

  private getContextValue(task: TaskSummary): string {
    const parts = ['task'];
    
    parts.push(`status-${task.status}`);
    parts.push(`priority-${task.priority}`);
    
    if (task.child_count > 0) {
      parts.push('has-children');
    }
    
    return parts.join('-');
  }

  private updateCache(tasks: TaskSummary[]): void {
    for (const task of tasks) {
      this.taskCache.set(task.id, task);
    }
  }

  private clearCache(): void {
    this.taskCache.clear();
    this._rootTasks = [];
    this._onDidChangeTreeData.fire();
  }

  private startAutoRefresh(): void {
    this.refreshTimer = setInterval(() => {
      const binderyService = getBinderyService();
      if (binderyService.isConnected()) {
        this.refresh();
      }
    }, 120000); // Refresh every 2 minutes
  }

  // Public methods for external control

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  public refreshTask(taskId: CodexId): void {
    // Remove from cache to force refresh
    this.taskCache.delete(taskId);
    this._onDidChangeTreeData.fire();
  }

  public setProject(projectId?: string): void {
    if (this.currentProjectId !== projectId) {
      if (projectId !== undefined) {
        this.currentProjectId = projectId;
      } else {
        delete (this as any).currentProjectId;
      }
      this.clearCache();
    }
  }

  public getTask(taskId: CodexId): TaskSummary | undefined {
    return this.taskCache.get(taskId);
  }

  public dispose(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    this._onDidChangeTreeData.dispose();
  }
}

/**
 * Task tree view context menu commands
 */
export function registerTaskTreeCommands(context: vscode.ExtensionContext, taskTreeProvider: TaskTreeDataProvider): void {
  // Create new subtask
  context.subscriptions.push(
    vscode.commands.registerCommand('vespera-forge.createSubtask', async (taskTreeItem: TaskTreeItem) => {
      if (!taskTreeItem.task) return;
      const task = taskTreeItem.task;
      
      const title = await vscode.window.showInputBox({
        prompt: 'Enter subtask title',
        placeHolder: 'New subtask...'
      });

      if (!title) return;

      const binderyService = getBinderyService();
      const result = await binderyService.createTask({
        title,
        description: '',
        parent_id: task.id,
        tags: [],
        labels: {},
        subtasks: []
      });

      if (result.success) {
        taskTreeProvider.refresh();
        vscode.window.showInformationMessage(`Subtask "${title}" created successfully.`);
        
        // Emit task creation event for cross-component sync
        console.log(`[TaskTree] 📡 Emitting taskCreated event for subtask: ${result.data}`);
        VesperaEvents.taskCreated(result.data, title);
      } else {
        vscode.window.showErrorMessage(`Failed to create subtask: ${result.error.message}`);
      }
    })
  );

  // Complete task
  context.subscriptions.push(
    vscode.commands.registerCommand('vespera-forge.completeTask', async (taskTreeItem: TaskTreeItem) => {
      if (!taskTreeItem.task) return;
      const task = taskTreeItem.task;
      
      const binderyService = getBinderyService();
      const result = await binderyService.updateTask({
        task_id: task.id,
        status: TaskStatus.Done
      });

      if (result.success) {
        taskTreeProvider.refresh();
        vscode.window.showInformationMessage(`Task "${task.title}" completed.`);
      } else {
        vscode.window.showErrorMessage(`Failed to complete task: ${result.error.message}`);
      }
    })
  );

  // Delete task
  context.subscriptions.push(
    vscode.commands.registerCommand('vespera-forge.deleteTask', async (taskTreeItem: TaskTreeItem) => {
      if (!taskTreeItem.task) return;
      const task = taskTreeItem.task;
      
      const choice = await vscode.window.showWarningMessage(
        `Are you sure you want to delete "${task.title}"?`,
        { modal: true },
        'Delete',
        'Cancel'
      );

      if (choice !== 'Delete') return;

      const binderyService = getBinderyService();
      const result = await binderyService.deleteTask(task.id, false);

      if (result.success) {
        taskTreeProvider.refresh();
        vscode.window.showInformationMessage(`Task "${task.title}" deleted.`);
      } else {
        vscode.window.showErrorMessage(`Failed to delete task: ${result.error.message}`);
      }
    })
  );

  // Open task details
  context.subscriptions.push(
    vscode.commands.registerCommand('vespera-forge.openTaskDetails', async (taskId: CodexId) => {
      // This will be handled by the task dashboard webview
      vscode.commands.executeCommand('vespera-forge.openTaskDashboard', taskId);
    })
  );

  // Refresh task tree
  context.subscriptions.push(
    vscode.commands.registerCommand('vespera-forge.refreshTaskTree', () => {
      taskTreeProvider.refresh();
    })
  );
}