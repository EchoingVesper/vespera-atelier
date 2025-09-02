---
title: UI Components API Reference
category: reference
complexity: intermediate
last_updated: 2025-01-09
---

# UI Components API Reference

## Overview

Vespera Forge implements native VS Code UI components that integrate seamlessly with the editor's design system while providing sophisticated task orchestration capabilities.

## Architecture Overview

```typescript
// Core UI component structure
interface VesperaForgeContext {
  extensionContext: vscode.ExtensionContext;
  contentProvider: BinderyContentProvider;
  config: VesperaForgeConfig;
  isInitialized: boolean;
}

// Component initialization
function initializeViews(context: vscode.ExtensionContext): ViewContext {
  const treeDataProvider = new TaskTreeDataProvider();
  const dashboardProvider = new TaskDashboardProvider(context.extensionUri);
  const statusBarManager = new StatusBarManager(context);
  
  return { treeDataProvider, dashboardProvider, statusBarManager };
}
```

## Task Tree View Component

### TaskTreeDataProvider Class

The tree view implements VS Code's native `TreeDataProvider` interface for optimal performance.

```typescript
export class TaskTreeDataProvider implements vscode.TreeDataProvider<TaskTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TaskTreeItem | undefined | null | void>;
  readonly onDidChangeTreeData: vscode.Event<TaskTreeItem | undefined | null | void>;
  
  private taskCache: Map<CodexId, TaskSummary>;
  private rootTasks: TaskSummary[];
  private currentProjectId?: string;
  
  constructor();
}
```

### Core Methods

#### `getTreeItem(element: TaskTreeItem): vscode.TreeItem`

Converts task data into VS Code tree item representation.

**Parameters**:
- `element`: Task tree item to render

**Returns**: `vscode.TreeItem` with configured properties

**Implementation**:
```typescript
getTreeItem(element: TaskTreeItem): vscode.TreeItem {
  const task = element.task;
  
  // Configure visual representation
  element.iconPath = this.getTaskIcon(task.status, task.priority);
  element.description = `${task.status}${task.priority !== TaskPriority.Normal ? ` • ${task.priority}` : ''}`;
  element.tooltip = this.getTaskTooltip(task);
  element.contextValue = this.getContextValue(task);
  
  // Set click action
  element.command = {
    command: 'vespera-forge.openTaskDetails',
    title: 'Open Task Details',
    arguments: [task.id]
  };
  
  return element;
}
```

#### `getChildren(element?: TaskTreeItem): Promise<TaskTreeItem[]>`

Provides hierarchical task data with lazy loading.

**Parameters**:
- `element`: Parent item (undefined for root level)

**Returns**: `Promise<TaskTreeItem[]>`

**Implementation**:
```typescript
async getChildren(element?: TaskTreeItem): Promise<TaskTreeItem[]> {
  const binderyService = getBinderyService();
  
  if (!binderyService.isConnected()) {
    return [];
  }

  try {
    if (!element) {
      // Load root tasks
      const result = await binderyService.listTasks({
        parent_id: undefined,
        project_id: this.currentProjectId,
        limit: 100
      });

      if (result.success) {
        this.rootTasks = result.data;
        this.updateCache(result.data);
        return result.data.map(task => this.createTaskTreeItem(task));
      }
    } else {
      // Load subtasks
      const taskId = element.task.id;
      const treeResult = await binderyService.getTaskTree(taskId, 2);
      
      if (treeResult.success && treeResult.data.children.length > 0) {
        const childTasks = treeResult.data.children.map(child => child.task);
        this.updateCache(childTasks);
        return childTasks.map(task => this.createTaskTreeItem(task));
      }
    }
    
    return [];
  } catch (error) {
    console.error('Error loading task children:', error);
    return [];
  }
}
```

### Visual Customization Methods

#### `getTaskIcon(status: TaskStatus, priority: TaskPriority): vscode.ThemeIcon`

Generates status-appropriate icons with priority-based coloring.

**Parameters**:
- `status`: Task status for icon selection
- `priority`: Task priority for color selection

**Returns**: `vscode.ThemeIcon`

**Implementation**:
```typescript
private getTaskIcon(status: TaskStatus, priority: TaskPriority): vscode.ThemeIcon {
  const iconMap: Record<TaskStatus, string> = {
    [TaskStatus.Todo]: 'circle-outline',
    [TaskStatus.Doing]: 'sync~spin',      // Animated spinner
    [TaskStatus.Review]: 'eye',
    [TaskStatus.Done]: 'check',
    [TaskStatus.Blocked]: 'error',
    [TaskStatus.Cancelled]: 'x',
    [TaskStatus.Archived]: 'archive'
  };

  const colorMap: Record<TaskPriority, vscode.ThemeColor> = {
    [TaskPriority.Critical]: new vscode.ThemeColor('errorForeground'),
    [TaskPriority.High]: new vscode.ThemeColor('notificationsWarningIcon.foreground'),
    [TaskPriority.Normal]: new vscode.ThemeColor('foreground'),
    [TaskPriority.Low]: new vscode.ThemeColor('descriptionForeground'),
    [TaskPriority.Someday]: new vscode.ThemeColor('disabledForeground')
  };

  return new vscode.ThemeIcon(iconMap[status] || 'circle-outline', colorMap[priority]);
}
```

#### `getTaskTooltip(task: TaskSummary): vscode.MarkdownString`

Creates rich tooltips with comprehensive task information.

**Parameters**:
- `task`: Task data for tooltip content

**Returns**: `vscode.MarkdownString`

**Implementation**:
```typescript
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
    const isOverdue = dueDate < new Date();
    tooltip.appendMarkdown(`**Due:** ${dueDate.toLocaleDateString()}${isOverdue ? ' ⚠️' : ''}\n`);
  }
  
  if (task.tags.length > 0) {
    tooltip.appendMarkdown(`**Tags:** ${task.tags.map(tag => `\`${tag}\``).join(', ')}\n`);
  }
  
  tooltip.appendMarkdown(`\n---\n`);
  tooltip.appendMarkdown(`Created: ${new Date(task.created_at).toLocaleString()}\n`);
  tooltip.appendMarkdown(`Updated: ${new Date(task.updated_at).toLocaleString()}`);
  
  if (task.child_count > 0) {
    tooltip.appendMarkdown(`\nSubtasks: ${task.child_count}`);
  }

  return tooltip;
}
```

### Public Control Methods

#### `refresh(): void`

Triggers complete tree view refresh.

**Usage**:
```typescript
const treeProvider = new TaskTreeDataProvider();
treeProvider.refresh(); // Refreshes entire tree
```

#### `refreshTask(taskId: CodexId): void`

Refreshes specific task and its subtree.

**Parameters**:
- `taskId`: Task to refresh

**Usage**:
```typescript
treeProvider.refreshTask('task_123456'); // Refreshes single task
```

#### `setProject(projectId?: string): void`

Changes project scope for task filtering.

**Parameters**:
- `projectId`: Project filter (undefined for all projects)

**Usage**:
```typescript
treeProvider.setProject('ecommerce-project'); // Filter by project
treeProvider.setProject(undefined); // Show all projects
```

### TaskTreeItem Class

```typescript
export class TaskTreeItem extends vscode.TreeItem {
  public task: TaskSummary;
  public children?: TaskTreeItem[];

  constructor(task: TaskSummary, collapsibleState?: vscode.TreeItemCollapsibleState) {
    super(task.title, collapsibleState);
    this.task = task;
    
    // Automatic collapsible state based on child count
    if (!collapsibleState) {
      this.collapsibleState = task.child_count > 0 ? 
        vscode.TreeItemCollapsibleState.Collapsed : 
        vscode.TreeItemCollapsibleState.None;
    }
  }
}
```

## Task Dashboard WebView Component

### TaskDashboardProvider Class

Implements VS Code WebView interface for rich dashboard functionality.

```typescript
export class TaskDashboardProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _extensionUri: vscode.Uri;
  
  constructor(extensionUri: vscode.Uri) {
    this._extensionUri = extensionUri;
  }
}
```

### Core WebView Methods

#### `resolveWebviewView(): void`

Initializes WebView with HTML content and message handling.

**Implementation**:
```typescript
resolveWebviewView(
  webviewView: vscode.WebviewView,
  context: vscode.WebviewViewResolveContext,
  _token: vscode.CancellationToken
): void {
  this._view = webviewView;
  
  // Configure WebView security
  webviewView.webview.options = {
    enableScripts: true,
    localResourceRoots: [this._extensionUri]
  };

  // Set HTML content with proper CSP
  webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
  
  // Setup bidirectional communication
  this.setupMessageHandling(webviewView.webview);
  
  // Initial data load
  this.updateDashboardData();
}
```

#### `getHtmlForWebview(webview: vscode.Webview): string`

Generates secure HTML with proper resource handling.

**Parameters**:
- `webview`: WebView instance for resource URI generation

**Returns**: HTML string with embedded CSS/JS

**Implementation**:
```typescript
private getHtmlForWebview(webview: vscode.Webview): string {
  // Generate secure resource URIs
  const styleResetUri = webview.asWebviewUri(
    vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css')
  );
  const styleVSCodeUri = webview.asWebviewUri(
    vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css')
  );
  const styleDashboardUri = webview.asWebviewUri(
    vscode.Uri.joinPath(this._extensionUri, 'media', 'dashboard.css')
  );
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(this._extensionUri, 'media', 'dashboard.js')
  );

  // Security nonce for inline scripts
  const nonce = this.getNonce();

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" 
          content="default-src 'none'; 
                   style-src ${webview.cspSource} 'unsafe-inline'; 
                   script-src 'nonce-${nonce}';
                   img-src ${webview.cspSource} https:;">
    
    <link href="${styleResetUri}" rel="stylesheet">
    <link href="${styleVSCodeUri}" rel="stylesheet">
    <link href="${styleDashboardUri}" rel="stylesheet">
    
    <title>Task Dashboard</title>
</head>
<body>
    <div id="dashboard-container">
        <div id="loading-indicator" class="loading">
            <div class="spinner"></div>
            <span>Loading task data...</span>
        </div>
        <div id="dashboard-content" style="display: none;">
            <!-- Dynamic content populated via JavaScript -->
        </div>
        <div id="error-container" style="display: none;">
            <div class="error-message">
                <h3>Unable to load task data</h3>
                <p id="error-details"></p>
                <button id="retry-button">Retry</button>
            </div>
        </div>
    </div>
    
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
```

### Message Passing System

#### `setupMessageHandling(webview: vscode.Webview): void`

Establishes bidirectional communication between WebView and extension.

**Implementation**:
```typescript
private setupMessageHandling(webview: vscode.Webview): void {
  webview.onDidReceiveMessage(async (message) => {
    switch (message.type) {
      case 'ready':
        // WebView loaded and ready for data
        await this.updateDashboardData();
        break;
        
      case 'createTask':
        await this.handleCreateTask(message.data);
        break;
        
      case 'updateTaskStatus':
        await this.handleUpdateTaskStatus(message.taskId, message.status);
        break;
        
      case 'deleteTask':
        await this.handleDeleteTask(message.taskId);
        break;
        
      case 'refreshData':
        await this.updateDashboardData();
        break;
        
      case 'openTask':
        await vscode.commands.executeCommand('vespera-forge.openTaskDetails', message.taskId);
        break;
        
      case 'exportTasks':
        await this.handleExportTasks(message.format);
        break;
        
      default:
        console.warn('Unknown message type:', message.type);
    }
  }, null, this._disposables);
}
```

### Data Update Methods

#### `updateDashboardData(): Promise<void>`

Refreshes dashboard with latest task data.

**Implementation**:
```typescript
private async updateDashboardData(): Promise<void> {
  if (!this._view) return;

  try {
    const binderyService = getBinderyService();
    
    // Fetch dashboard metrics
    const dashboardResult = await binderyService.getTaskDashboard();
    
    if (dashboardResult.success) {
      // Send data to WebView
      this._view.webview.postMessage({
        type: 'dashboardData',
        data: dashboardResult.data
      });
      
      // Fetch recent tasks for activity feed
      const recentResult = await binderyService.listTasks({ limit: 10 });
      if (recentResult.success) {
        this._view.webview.postMessage({
          type: 'recentTasks',
          data: recentResult.data
        });
      }
      
    } else {
      // Handle error state
      this._view.webview.postMessage({
        type: 'error',
        message: dashboardResult.error?.message || 'Unknown error occurred'
      });
    }
  } catch (error) {
    console.error('Dashboard update failed:', error);
    this._view?.webview.postMessage({
      type: 'error',
      message: 'Failed to load dashboard data'
    });
  }
}
```

### Task Management Handlers

#### `handleCreateTask(data: any): Promise<void>`

Processes task creation requests from dashboard.

**Parameters**:
- `data`: Task creation form data

**Implementation**:
```typescript
private async handleCreateTask(data: any): Promise<void> {
  try {
    const binderyService = getBinderyService();
    
    // Validate and transform form data
    const taskInput: TaskInput = {
      title: data.title?.trim() || '',
      description: data.description || '',
      priority: data.priority || TaskPriority.Normal,
      tags: data.tags ? data.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      labels: data.labels || {},
      subtasks: [],
      parent_id: data.parentId || undefined,
      due_date: data.dueDate || undefined
    };
    
    // Validate required fields
    if (!taskInput.title) {
      this._view?.webview.postMessage({
        type: 'createTaskError',
        message: 'Task title is required'
      });
      return;
    }
    
    // Create task
    const result = await binderyService.createTask(taskInput);
    
    if (result.success) {
      // Notify success
      this._view?.webview.postMessage({
        type: 'createTaskSuccess',
        taskId: result.data
      });
      
      // Refresh dashboard data
      await this.updateDashboardData();
      
      // Notify tree view to refresh
      vscode.commands.executeCommand('vespera-forge.refreshTaskTree');
      
    } else {
      this._view?.webview.postMessage({
        type: 'createTaskError',
        message: result.error?.message || 'Failed to create task'
      });
    }
    
  } catch (error) {
    console.error('Create task error:', error);
    this._view?.webview.postMessage({
      type: 'createTaskError',
      message: 'Unexpected error occurred'
    });
  }
}
```

## Status Bar Component

### StatusBarManager Class

Manages VS Code status bar integration for connection and task status.

```typescript
export class StatusBarManager {
  private connectionStatusItem: vscode.StatusBarItem;
  private taskCountItem: vscode.StatusBarItem;
  private quickActionItem: vscode.StatusBarItem;
  private _disposables: vscode.Disposable[] = [];
  
  constructor(context: vscode.ExtensionContext) {
    this.initializeStatusBarItems();
    context.subscriptions.push(...this._disposables);
  }
}
```

### Status Bar Item Management

#### `initializeStatusBarItems(): void`

Creates and configures status bar items.

**Implementation**:
```typescript
private initializeStatusBarItems(): void {
  // Connection status (left side, high priority)
  this.connectionStatusItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left, 
    100
  );
  this.connectionStatusItem.command = 'vespera-forge.openTaskDashboard';
  this.connectionStatusItem.text = '$(debug-disconnect) Bindery Offline';
  this.connectionStatusItem.tooltip = 'Click to open Vespera Forge dashboard';
  
  // Task count (left side, medium priority)
  this.taskCountItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left, 
    99
  );
  this.taskCountItem.command = 'vespera-forge.openTaskTree';
  this.taskCountItem.tooltip = 'Active tasks - click to open task tree';
  
  // Quick actions (right side)
  this.quickActionItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right, 
    100
  );
  this.quickActionItem.command = 'vespera-forge.createTask';
  this.quickActionItem.text = '$(add) New Task';
  this.quickActionItem.tooltip = 'Create new task';
  
  // Add to disposables for cleanup
  this._disposables.push(
    this.connectionStatusItem,
    this.taskCountItem,
    this.quickActionItem
  );
  
  // Show all items
  this.connectionStatusItem.show();
  this.taskCountItem.show();
  this.quickActionItem.show();
}
```

### Dynamic Status Updates

#### `updateConnectionStatus(info: BinderyConnectionInfo): void`

Updates connection status indicator based on backend state.

**Parameters**:
- `info`: Current connection information

**Implementation**:
```typescript
updateConnectionStatus(info: BinderyConnectionInfo): void {
  switch (info.status) {
    case BinderyConnectionStatus.Connected:
      this.connectionStatusItem.text = '$(check) Bindery Connected';
      this.connectionStatusItem.backgroundColor = undefined;
      this.connectionStatusItem.tooltip = 
        `Connected to Bindery ${info.version?.version || 'unknown'}\nProcess ID: ${info.process_id}`;
      break;
      
    case BinderyConnectionStatus.Connecting:
      this.connectionStatusItem.text = '$(sync~spin) Connecting...';
      this.connectionStatusItem.backgroundColor = 
        new vscode.ThemeColor('statusBarItem.warningBackground');
      this.connectionStatusItem.tooltip = 'Connecting to Bindery backend...';
      break;
      
    case BinderyConnectionStatus.Disconnected:
      this.connectionStatusItem.text = '$(debug-disconnect) Bindery Offline';
      this.connectionStatusItem.backgroundColor = 
        new vscode.ThemeColor('statusBarItem.errorBackground');
      this.connectionStatusItem.tooltip = 'Bindery backend not connected (using mock mode)';
      break;
      
    case BinderyConnectionStatus.Error:
      this.connectionStatusItem.text = '$(error) Bindery Error';
      this.connectionStatusItem.backgroundColor = 
        new vscode.ThemeColor('statusBarItem.errorBackground');
      this.connectionStatusItem.tooltip = 
        `Connection error: ${info.last_error || 'Unknown error'}\nClick to retry connection`;
      break;
  }
}
```

#### `updateTaskCounts(): Promise<void>`

Refreshes task counter with current statistics.

**Implementation**:
```typescript
async updateTaskCounts(): Promise<void> {
  try {
    const binderyService = getBinderyService();
    const dashboardResult = await binderyService.getTaskDashboard();
    
    if (dashboardResult.success) {
      const data = dashboardResult.data;
      const activeTasks = data.total_tasks - (data.status_breakdown.Done || 0) - (data.status_breakdown.Archived || 0);
      const urgentTasks = (data.priority_breakdown.Critical || 0) + (data.priority_breakdown.High || 0);
      
      // Update task count display
      this.taskCountItem.text = `$(checklist) ${activeTasks} tasks`;
      
      // Enhanced tooltip with breakdown
      const tooltip = [
        `${activeTasks} active tasks`,
        `${data.status_breakdown.Done || 0} completed`,
        '',
        'Priority Breakdown:',
        `Critical: ${data.priority_breakdown.Critical || 0}`,
        `High: ${data.priority_breakdown.High || 0}`,
        `Normal: ${data.priority_breakdown.Normal || 0}`,
        `Low: ${data.priority_breakdown.Low || 0}`
      ].join('\n');
      
      this.taskCountItem.tooltip = tooltip;
      
      // Change color for urgent tasks
      if (urgentTasks > 0) {
        this.taskCountItem.backgroundColor = 
          new vscode.ThemeColor('statusBarItem.warningBackground');
      } else {
        this.taskCountItem.backgroundColor = undefined;
      }
      
      this.taskCountItem.show();
    } else {
      this.taskCountItem.hide();
    }
  } catch (error) {
    console.error('Failed to update task counts:', error);
    this.taskCountItem.hide();
  }
}
```

## Component Integration and Coordination

### ViewContext Interface

```typescript
interface ViewContext {
  treeDataProvider: TaskTreeDataProvider;
  dashboardProvider: TaskDashboardProvider;
  statusBarManager: StatusBarManager;
}
```

### UICoordinator Class

Manages inter-component communication and synchronized updates.

```typescript
export class UICoordinator {
  private treeProvider: TaskTreeDataProvider;
  private dashboardProvider: TaskDashboardProvider;
  private statusBarManager: StatusBarManager;
  private binderyService: BinderyService;
  
  constructor(viewContext: ViewContext) {
    this.treeProvider = viewContext.treeDataProvider;
    this.dashboardProvider = viewContext.dashboardProvider;
    this.statusBarManager = viewContext.statusBarManager;
    this.binderyService = getBinderyService();
    
    this.setupEventListeners();
    this.startPeriodicRefresh();
  }
  
  private setupEventListeners(): void {
    // Connection status changes
    this.binderyService.on('statusChanged', (info) => {
      this.statusBarManager.updateConnectionStatus(info);
      
      if (info.status === BinderyConnectionStatus.Connected) {
        this.refreshAllComponents();
      } else if (info.status === BinderyConnectionStatus.Disconnected) {
        // Handle offline mode
        this.treeProvider.clearCache();
      }
    });
    
    // Task-specific updates (if implemented)
    this.binderyService.on('taskUpdated', (taskId: CodexId) => {
      this.treeProvider.refreshTask(taskId);
      this.dashboardProvider.refresh();
      this.statusBarManager.updateTaskCounts();
    });
  }
  
  private startPeriodicRefresh(): void {
    setInterval(async () => {
      if (this.binderyService.isConnected()) {
        await this.statusBarManager.updateTaskCounts();
        // Optional: refresh tree and dashboard less frequently
      }
    }, 30000); // Every 30 seconds
  }
  
  public refreshAllComponents(): void {
    this.treeProvider.refresh();
    this.dashboardProvider.refresh();
    this.statusBarManager.updateTaskCounts();
  }
}
```

## Event-Driven Architecture

### Component Events

```typescript
// Custom events for component communication
interface VesperaForgeEvents {
  'taskCreated': (taskId: CodexId) => void;
  'taskUpdated': (taskId: CodexId) => void;
  'taskDeleted': (taskId: CodexId) => void;
  'connectionChanged': (status: BinderyConnectionStatus) => void;
  'dashboardRefresh': () => void;
  'treeRefresh': () => void;
}

// Event emitter for component coordination
class VesperaEventBus extends EventEmitter {
  emit<K extends keyof VesperaForgeEvents>(
    event: K, 
    ...args: Parameters<VesperaForgeEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
  
  on<K extends keyof VesperaForgeEvents>(
    event: K, 
    listener: VesperaForgeEvents[K]
  ): this {
    return super.on(event, listener);
  }
}

// Global event bus instance
export const vesperaEventBus = new VesperaEventBus();
```

### Component Registration

```typescript
export function initializeViews(context: vscode.ExtensionContext): ViewContext {
  // Create components
  const treeDataProvider = new TaskTreeDataProvider();
  const dashboardProvider = new TaskDashboardProvider(context.extensionUri);
  const statusBarManager = new StatusBarManager(context);
  
  // Register tree view
  vscode.window.createTreeView('vesperaForgeTaskTree', {
    treeDataProvider: treeDataProvider,
    showCollapseAll: true,
    canSelectMany: true
  });
  
  // Register dashboard webview
  vscode.window.registerWebviewViewProvider(
    'vespera-forge.taskDashboard', 
    dashboardProvider
  );
  
  // Create coordinator for component synchronization
  const coordinator = new UICoordinator({ 
    treeDataProvider, 
    dashboardProvider, 
    statusBarManager 
  });
  
  return { treeDataProvider, dashboardProvider, statusBarManager, coordinator };
}
```

## Command Registration

### Tree View Commands

```typescript
export function registerTaskTreeCommands(context: vscode.ExtensionContext): void {
  const commands = [
    {
      command: 'vespera-forge.createSubtask',
      handler: async (taskItem: TaskTreeItem) => {
        // Implementation for subtask creation
      }
    },
    {
      command: 'vespera-forge.completeTask',
      handler: async (taskItem: TaskTreeItem) => {
        // Implementation for task completion
      }
    },
    {
      command: 'vespera-forge.deleteTask',
      handler: async (taskItem: TaskTreeItem) => {
        // Implementation for task deletion
      }
    },
    {
      command: 'vespera-forge.refreshTaskTree',
      handler: () => {
        vesperaEventBus.emit('treeRefresh');
      }
    }
  ];
  
  commands.forEach(({ command, handler }) => {
    context.subscriptions.push(
      vscode.commands.registerCommand(command, handler)
    );
  });
}
```

## Accessibility and Theming

### Accessibility Support

```typescript
// ARIA support for tree view
class AccessibleTaskTreeItem extends TaskTreeItem {
  constructor(task: TaskSummary, collapsibleState?: vscode.TreeItemCollapsibleState) {
    super(task, collapsibleState);
    
    // Enhanced accessibility properties
    this.accessibilityInformation = {
      label: `${task.title}. Status: ${task.status}. Priority: ${task.priority}. ${task.child_count > 0 ? `${task.child_count} subtasks.` : ''}`,
      role: 'treeitem'
    };
  }
}

// Screen reader announcements
function announceTaskUpdate(taskId: CodexId, action: string): void {
  vscode.window.showInformationMessage(
    `Task ${action}`,
    { modal: false }
  );
}
```

### Theme Integration

```typescript
// Theme-aware color management
class ThemeManager {
  static getTaskColors() {
    return {
      critical: new vscode.ThemeColor('errorForeground'),
      high: new vscode.ThemeColor('notificationsWarningIcon.foreground'),
      normal: new vscode.ThemeColor('foreground'),
      low: new vscode.ThemeColor('descriptionForeground'),
      someday: new vscode.ThemeColor('disabledForeground')
    };
  }
  
  static getStatusColors() {
    return {
      done: new vscode.ThemeColor('testing.iconPassed'),
      doing: new vscode.ThemeColor('notificationsInfoIcon.foreground'),
      blocked: new vscode.ThemeColor('errorForeground'),
      cancelled: new vscode.ThemeColor('disabledForeground')
    };
  }
}
```

---

The UI Components API provides comprehensive interfaces for building rich, native VS Code integrations with full accessibility support, theme integration, and event-driven architecture for responsive user interfaces.