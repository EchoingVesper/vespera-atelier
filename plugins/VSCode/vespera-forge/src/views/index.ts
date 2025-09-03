/**
 * Views module - Exports all view components and utilities
 */

export { TaskTreeDataProvider, TaskTreeItem } from './task-tree-view';
export { TaskDashboardWebviewProvider } from './task-dashboard';
export { VesperaStatusBarManager, registerStatusBarCommands } from './status-bar';
export { ChatPanelWebviewProvider, registerChatPanelCommands } from './chat-panel';

// View initialization helper
import * as vscode from 'vscode';
import { TaskTreeDataProvider, registerTaskTreeCommands } from './task-tree-view';
import { TaskDashboardWebviewProvider } from './task-dashboard';
import { VesperaStatusBarManager, registerStatusBarCommands } from './status-bar';
import { ChatPanelWebviewProvider, registerChatPanelCommands } from './chat-panel';
import { VesperaEvents } from '../utils/events';

export interface VesperaViewContext {
  taskTreeProvider: TaskTreeDataProvider;
  taskDashboardProvider: TaskDashboardWebviewProvider;
  statusBarManager: VesperaStatusBarManager;
  chatPanelProvider: ChatPanelWebviewProvider;
}

/**
 * Initialize all views and return context for extension use
 */
export function initializeViews(context: vscode.ExtensionContext): VesperaViewContext {
  // Create task tree provider
  const taskTreeProvider = new TaskTreeDataProvider();
  
  // Register task tree view
  const taskTreeView = vscode.window.createTreeView('vesperaForgeTaskTree', {
    treeDataProvider: taskTreeProvider,
    showCollapseAll: true,
    canSelectMany: false
  });
  
  // Create task dashboard provider
  const taskDashboardProvider = new TaskDashboardWebviewProvider(context.extensionUri);
  
  // Register dashboard webview
  vscode.window.registerWebviewViewProvider(
    TaskDashboardWebviewProvider.viewType,
    taskDashboardProvider
  );
  
  // Create status bar manager
  const statusBarManager = new VesperaStatusBarManager(context);
  
  // Create chat panel provider
  const chatPanelProvider = new ChatPanelWebviewProvider(context.extensionUri, context);
  
  // Register chat panel webview
  vscode.window.registerWebviewViewProvider(
    ChatPanelWebviewProvider.viewType,
    chatPanelProvider
  );
  
  // Register all view command handlers
  registerTaskTreeCommands(context, taskTreeProvider);
  registerStatusBarCommands(context, statusBarManager);
  registerChatPanelCommands(context, chatPanelProvider);
  registerViewIntegrationCommands(context, {
    taskTreeProvider,
    taskDashboardProvider,
    statusBarManager,
    chatPanelProvider
  });
  
  // Add to disposables
  context.subscriptions.push(
    taskTreeView,
    taskTreeProvider,
    taskDashboardProvider,
    statusBarManager,
    chatPanelProvider
  );
  
  return {
    taskTreeProvider,
    taskDashboardProvider,
    statusBarManager,
    chatPanelProvider
  };
}

/**
 * Register commands that integrate multiple views
 */
function registerViewIntegrationCommands(
  context: vscode.ExtensionContext,
  viewContext: VesperaViewContext
): void {
  const { taskTreeProvider, taskDashboardProvider, statusBarManager, chatPanelProvider } = viewContext;
  
  // Open task dashboard command
  context.subscriptions.push(
    vscode.commands.registerCommand('vespera-forge.openTaskDashboard', (taskId?: string) => {
      // Focus on the dashboard view
      vscode.commands.executeCommand('vespera-forge.taskDashboard.focus');
      
      // If a specific task is provided, select it
      if (taskId) {
        taskDashboardProvider.selectTask(taskId);
      }
      
      // Show the dashboard
      taskDashboardProvider.show();
    })
  );
  
  // Refresh task dashboard command
  context.subscriptions.push(
    vscode.commands.registerCommand('vespera-forge.refreshTaskDashboard', () => {
      taskDashboardProvider.refresh();
    })
  );
  
  // Focus task in tree command
  context.subscriptions.push(
    vscode.commands.registerCommand('vespera-forge.focusTaskInTree', (taskId: string) => {
      // Focus the tree view
      vscode.commands.executeCommand('vesperaForgeTaskTree.focus');
      
      // Refresh to ensure task is visible
      taskTreeProvider.refresh();
      
      // Emit focus event for cross-component sync
      if (taskId) {
        VesperaEvents.taskFocused(taskId, 'Task focused in tree');
      }
    })
  );
  
  // Note: vespera-forge.refreshTaskTree command is registered in registerTaskTreeCommands
  
  // Show all views command
  context.subscriptions.push(
    vscode.commands.registerCommand('vespera-forge.showAllViews', () => {
      // Focus the activity bar
      vscode.commands.executeCommand('workbench.view.extension.vespera-forge');
      
      // Show status bar items
      statusBarManager.show();
      
      // Show dashboard and chat
      taskDashboardProvider.show();
      // Note: ChatPanelWebviewProvider doesn't have show() method, it's a WebviewViewProvider
    })
  );
  
  // Hide all views command
  context.subscriptions.push(
    vscode.commands.registerCommand('vespera-forge.hideAllViews', () => {
      statusBarManager.hide();
    })
  );
  
  // Global refresh command
  context.subscriptions.push(
    vscode.commands.registerCommand('vespera-forge.globalRefresh', () => {
      taskTreeProvider.refresh();
      taskDashboardProvider.refreshData();
      statusBarManager.refresh();
      chatPanelProvider.refresh();
      
      vscode.window.showInformationMessage('All Vespera Forge views refreshed');
    })
  );
}