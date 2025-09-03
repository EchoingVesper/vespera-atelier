/**
 * Status Bar Integration - Connection status, task counts, and health monitoring
 * Provides quick access to features with visual indicators
 */

import * as vscode from 'vscode';
import { getBinderyService } from '../services/bindery';
import {
  BinderyConnectionStatus,
  BinderyConnectionInfo,
  TaskDashboard
} from '../types/bindery';

export class VesperaStatusBarManager {
  private connectionStatusItem: vscode.StatusBarItem;
  private taskCountItem: vscode.StatusBarItem;
  private quickActionsItem: vscode.StatusBarItem;
  
  private currentConnectionInfo?: BinderyConnectionInfo;
  private currentDashboard?: TaskDashboard;
  private refreshTimer?: NodeJS.Timeout;

  constructor(private context: vscode.ExtensionContext) {
    // Create status bar items
    this.connectionStatusItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    
    this.taskCountItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      99
    );
    
    this.quickActionsItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      98
    );

    // Configure initial state
    this.setupStatusItems();
    
    // Listen for Bindery connection changes
    const binderyService = getBinderyService();
    binderyService.on('statusChanged', (info) => {
      this.currentConnectionInfo = info;
      this.updateConnectionStatus();
      
      if (info.status === BinderyConnectionStatus.Connected) {
        this.startPeriodicRefresh();
      } else {
        this.stopPeriodicRefresh();
        this.clearTaskData();
      }
    });

    // Register status bar items
    context.subscriptions.push(
      this.connectionStatusItem,
      this.taskCountItem,
      this.quickActionsItem
    );

    // Initial state
    this.updateConnectionStatus();
    this.updateTaskCounts();
    this.updateQuickActions();
  }

  private setupStatusItems(): void {
    // Connection status item
    this.connectionStatusItem.command = 'vespera-forge.toggleConnection';
    this.connectionStatusItem.tooltip = 'Click to toggle Vespera Forge connection';
    
    // Task count item
    this.taskCountItem.command = 'vespera-forge.openTaskDashboard';
    this.taskCountItem.tooltip = 'Click to open Task Dashboard';
    
    // Quick actions item
    this.quickActionsItem.command = 'vespera-forge.showQuickActions';
    this.quickActionsItem.tooltip = 'Click for quick actions';
  }

  private updateConnectionStatus(): void {
    if (!this.currentConnectionInfo) {
      this.currentConnectionInfo = getBinderyService().getConnectionInfo();
    }

    const info = this.currentConnectionInfo;
    let icon: string;
    let color: vscode.ThemeColor | undefined;
    let text: string;

    switch (info.status) {
      case BinderyConnectionStatus.Connected:
        icon = '$(plug)';
        color = new vscode.ThemeColor('statusBarItem.prominentForeground');
        text = 'Vespera Connected';
        break;
      
      case BinderyConnectionStatus.Connecting:
        icon = '$(sync~spin)';
        color = new vscode.ThemeColor('statusBarItem.warningForeground');
        text = 'Vespera Connecting...';
        break;
      
      case BinderyConnectionStatus.Error:
        icon = '$(error)';
        color = new vscode.ThemeColor('statusBarItem.errorForeground');
        text = 'Vespera Error';
        break;
      
      case BinderyConnectionStatus.Disconnected:
      default:
        icon = '$(debug-disconnect)';
        color = new vscode.ThemeColor('statusBarItem.remoteForeground');
        text = 'Vespera Disconnected';
        break;
    }

    this.connectionStatusItem.text = `${icon} ${text}`;
    this.connectionStatusItem.color = color;
    
    // Update tooltip with more details
    let tooltip = `Vespera Forge Status: ${info.status}`;
    if (info.version) {
      tooltip += `\nVersion: ${info.version.version}`;
    }
    if (info.connected_at) {
      tooltip += `\nConnected: ${new Date(info.connected_at).toLocaleString()}`;
    }
    if (info.last_error) {
      tooltip += `\nLast Error: ${info.last_error}`;
    }
    this.connectionStatusItem.tooltip = tooltip;

    this.connectionStatusItem.show();
  }

  private updateTaskCounts(): void {
    if (!this.currentDashboard || !getBinderyService().isConnected()) {
      this.taskCountItem.hide();
      return;
    }

    const dashboard = this.currentDashboard;
    const totalTasks = dashboard.total_tasks;
    const doneTasks = dashboard.status_breakdown.done || 0;
    const doingTasks = dashboard.status_breakdown.doing || 0;
    const overdueTasks = dashboard.overdue_tasks.length;

    // Primary display: active/total tasks
    let icon = '$(list-unordered)';
    let text = `${doingTasks}/${totalTasks}`;
    
    // Show warning if there are overdue tasks
    if (overdueTasks > 0) {
      icon = '$(warning)';
      text = `${doingTasks}/${totalTasks} (${overdueTasks} overdue)`;
    }

    this.taskCountItem.text = `${icon} ${text}`;
    this.taskCountItem.color = overdueTasks > 0 ? 
      new vscode.ThemeColor('statusBarItem.warningForeground') : 
      undefined;

    // Detailed tooltip
    const completionRate = Math.round(dashboard.completion_rate * 100);
    let tooltip = `Task Overview:\n`;
    tooltip += `• Total: ${totalTasks}\n`;
    tooltip += `• Doing: ${doingTasks}\n`;
    tooltip += `• Done: ${doneTasks}\n`;
    tooltip += `• Completion Rate: ${completionRate}%\n`;
    
    if (overdueTasks > 0) {
      tooltip += `• Overdue: ${overdueTasks}\n`;
    }
    
    const upcomingTasks = dashboard.upcoming_tasks.length;
    if (upcomingTasks > 0) {
      tooltip += `• Upcoming: ${upcomingTasks}\n`;
    }
    
    tooltip += '\nClick to open Task Dashboard';
    this.taskCountItem.tooltip = tooltip;

    this.taskCountItem.show();
  }

  private updateQuickActions(): void {
    const isConnected = getBinderyService().isConnected();
    
    if (!isConnected) {
      this.quickActionsItem.text = '$(gear) Configure';
      this.quickActionsItem.tooltip = 'Configure Vespera Forge';
      this.quickActionsItem.command = 'vespera-forge.configure';
    } else {
      this.quickActionsItem.text = '$(add) New';
      this.quickActionsItem.tooltip = 'Create new task (click for more options)';
      this.quickActionsItem.command = 'vespera-forge.showQuickActions';
    }

    this.quickActionsItem.show();
  }

  private async refreshDashboardData(): Promise<void> {
    const binderyService = getBinderyService();
    
    if (!binderyService.isConnected()) {
      return;
    }

    try {
      const result = await binderyService.getTaskDashboard();
      if (result.success) {
        this.currentDashboard = result.data;
        this.updateTaskCounts();
      }
    } catch (error) {
      console.error('Failed to refresh dashboard data for status bar:', error);
    }
  }

  private startPeriodicRefresh(): void {
    this.stopPeriodicRefresh();
    
    // Refresh dashboard data every 60 seconds
    this.refreshTimer = setInterval(() => {
      this.refreshDashboardData();
    }, 60000);
    
    // Initial refresh
    this.refreshDashboardData();
  }

  private stopPeriodicRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  private clearTaskData(): void {
    this.currentDashboard = undefined;
    this.updateTaskCounts();
    this.updateQuickActions();
  }

  // Public methods for external control

  public show(): void {
    this.connectionStatusItem.show();
    if (getBinderyService().isConnected()) {
      this.taskCountItem.show();
      this.quickActionsItem.show();
    }
  }

  public hide(): void {
    this.connectionStatusItem.hide();
    this.taskCountItem.hide();
    this.quickActionsItem.hide();
  }

  public refresh(): void {
    this.updateConnectionStatus();
    this.refreshDashboardData();
    this.updateQuickActions();
  }

  public dispose(): void {
    this.stopPeriodicRefresh();
    this.connectionStatusItem.dispose();
    this.taskCountItem.dispose();
    this.quickActionsItem.dispose();
  }
}

/**
 * Register status bar related commands
 */
export function registerStatusBarCommands(
  context: vscode.ExtensionContext,
  statusBarManager: VesperaStatusBarManager
): void {
  
  // Toggle connection command
  context.subscriptions.push(
    vscode.commands.registerCommand('vespera-forge.toggleConnection', async () => {
      const binderyService = getBinderyService();
      
      if (binderyService.isConnected()) {
        await binderyService.disconnect();
        vscode.window.showInformationMessage('Disconnected from Vespera Forge');
      } else {
        const result = await binderyService.initialize();
        if (result.success) {
          vscode.window.showInformationMessage('Connected to Vespera Forge');
        } else {
          vscode.window.showErrorMessage(`Failed to connect: ${result.error.message}`);
        }
      }
    })
  );

  // Quick actions menu
  context.subscriptions.push(
    vscode.commands.registerCommand('vespera-forge.showQuickActions', async () => {
      const binderyService = getBinderyService();
      
      if (!binderyService.isConnected()) {
        vscode.commands.executeCommand('vespera-forge.configure');
        return;
      }

      const actions = [
        {
          label: '$(add) New Task',
          description: 'Create a new task',
          command: 'vespera-forge.createTask'
        },
        {
          label: '$(list-unordered) Task Dashboard',
          description: 'Open task dashboard',
          command: 'vespera-forge.openTaskDashboard'
        },
        {
          label: '$(list-tree) Task Tree',
          description: 'Open task tree view',
          command: 'vespera-forge.focusTaskTree'
        },
        {
          label: '$(refresh) Refresh Data',
          description: 'Refresh all task data',
          command: 'vespera-forge.refreshAllData'
        },
        {
          label: '$(gear) Settings',
          description: 'Open Vespera Forge settings',
          command: 'vespera-forge.openSettings'
        }
      ];

      const selected = await vscode.window.showQuickPick(actions, {
        placeHolder: 'Choose an action'
      });

      if (selected) {
        vscode.commands.executeCommand(selected.command);
      }
    })
  );

  // Create task command
  context.subscriptions.push(
    vscode.commands.registerCommand('vespera-forge.createTask', async () => {
      const title = await vscode.window.showInputBox({
        prompt: 'Enter task title',
        placeHolder: 'New task title...'
      });

      if (!title) return;

      const priority = await vscode.window.showQuickPick([
        { label: 'Critical', value: 'critical' },
        { label: 'High', value: 'high' },
        { label: 'Normal', value: 'normal' },
        { label: 'Low', value: 'low' },
        { label: 'Someday', value: 'someday' }
      ], {
        placeHolder: 'Select task priority'
      });

      if (!priority) return;

      const binderyService = getBinderyService();
      const result = await binderyService.createTask({
        title,
        priority: priority.value as any,
        description: '',
        tags: [],
        labels: {},
        subtasks: []
      });

      if (result.success) {
        vscode.window.showInformationMessage(`Task "${title}" created successfully`);
        statusBarManager.refresh();
        vscode.commands.executeCommand('vespera-forge.refreshTaskTree');
      } else {
        vscode.window.showErrorMessage(`Failed to create task: ${result.error.message}`);
      }
    })
  );

  // Focus task tree
  context.subscriptions.push(
    vscode.commands.registerCommand('vespera-forge.focusTaskTree', () => {
      vscode.commands.executeCommand('vesperaForgeTaskTree.focus');
    })
  );

  // Refresh all data
  context.subscriptions.push(
    vscode.commands.registerCommand('vespera-forge.refreshAllData', () => {
      statusBarManager.refresh();
      vscode.commands.executeCommand('vespera-forge.refreshTaskTree');
      vscode.commands.executeCommand('vespera-forge.refreshTaskDashboard');
      vscode.window.showInformationMessage('Refreshed all Vespera Forge data');
    })
  );

  // Open settings
  context.subscriptions.push(
    vscode.commands.registerCommand('vespera-forge.openSettings', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', 'vesperaForge');
    })
  );

  // Configure Vespera Forge
  context.subscriptions.push(
    vscode.commands.registerCommand('vespera-forge.configure', async () => {
      const actions = [
        {
          label: '$(play) Initialize Connection',
          description: 'Initialize connection to Vespera Forge',
          action: 'initialize'
        },
        {
          label: '$(settings-gear) Open Settings',
          description: 'Open extension settings',
          action: 'settings'
        },
        {
          label: '$(question) Help & Documentation',
          description: 'Open help and documentation',
          action: 'help'
        }
      ];

      const selected = await vscode.window.showQuickPick(actions, {
        placeHolder: 'How would you like to configure Vespera Forge?'
      });

      if (!selected) return;

      switch (selected.action) {
        case 'initialize':
          vscode.commands.executeCommand('vespera-forge.initialize');
          break;
        case 'settings':
          vscode.commands.executeCommand('workbench.action.openSettings', 'vesperaForge');
          break;
        case 'help':
          vscode.env.openExternal(vscode.Uri.parse('https://github.com/vespera-atelier/vespera-atelier'));
          break;
      }
    })
  );
}