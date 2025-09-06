/**
 * Task Dashboard WebView - Interactive dashboard with task metrics and management
 * Provides HTML-based dashboard with charts, quick actions, and theme-aware design
 */

import * as vscode from 'vscode';
import { getBinderyService } from '../services/bindery';
import { VesperaEvents } from '../utils/events';
import {
  TaskDashboard,
  TaskPriority,
  CodexId,
  BinderyConnectionStatus
} from '../types/bindery';

export class TaskDashboardWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vespera-forge.taskDashboard';
  
  private _view?: vscode.WebviewView;
  private _selectedTaskId?: CodexId;
  private _dashboardData?: TaskDashboard;
  private _refreshTimer?: NodeJS.Timeout;

  constructor(private readonly _extensionUri: vscode.Uri) {
    // Listen for Bindery connection changes
    const binderyService = getBinderyService();
    binderyService.on('statusChanged', (info) => {
      if (info.status === BinderyConnectionStatus.Connected) {
        this.refresh();
      } else if (info.status === BinderyConnectionStatus.Disconnected) {
        delete (this as any)._dashboardData;
        this.updateWebview();
      }
    });

    // Listen for cross-component task events
    VesperaEvents.onTaskChange(() => {
      console.log('[Dashboard] 🔄 Received task change event, refreshing...');
      this.refreshData();
    }, 'TaskDashboardWebviewProvider');

    // Auto-refresh every 2 minutes when connected
    this.startAutoRefresh();
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'refresh':
          this.refresh();
          break;
        case 'createTask':
          this.handleCreateTask(data.title, data.priority);
          break;
        case 'updateTask':
          this.handleUpdateTask(data.taskId, data.updates);
          break;
        case 'deleteTask':
          this.handleDeleteTask(data.taskId);
          break;
        case 'openTask':
          this.handleOpenTask(data.taskId);
          break;
        case 'filterTasks':
          this.handleFilterTasks(data.filters);
          break;
      }
    });

    this.updateWebview();
    this.refresh();
  }

  public async refresh(): Promise<void> {
    const binderyService = getBinderyService();
    
    if (!binderyService.isConnected()) {
      delete (this as any)._dashboardData;
      this.updateWebview();
      return;
    }

    try {
      const result = await binderyService.getTaskDashboard();
      if (result.success) {
        this._dashboardData = result.data;
        this.updateWebview();
      }
    } catch (error) {
      console.error('Failed to refresh task dashboard:', error);
    }
  }

  private updateWebview(): void {
    console.log(`[TaskDashboard] updateWebview called, _view exists:`, !!this._view);
    if (this._view) {
      console.log(`[TaskDashboard] Setting webview HTML`);
      this._view.webview.html = this.getHtmlForWebview(this._view.webview);
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    // Get theme colors for consistent styling
    const colorTheme = vscode.window.activeColorTheme;
    const isDark = colorTheme.kind === vscode.ColorThemeKind.Dark;
    
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'dashboard.css'));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'dashboard.js'));

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Task Dashboard</title>
        <link href="${styleUri}" rel="stylesheet">
        <style>
          :root {
            --vscode-background: ${isDark ? '#1e1e1e' : '#ffffff'};
            --vscode-foreground: ${isDark ? '#cccccc' : '#333333'};
            --vscode-button-background: ${isDark ? '#0e639c' : '#007acc'};
            --vscode-button-hover: ${isDark ? '#1177bb' : '#005a9e'};
            --vscode-input-background: ${isDark ? '#3c3c3c' : '#ffffff'};
            --vscode-input-border: ${isDark ? '#3c3c3c' : '#cecece'};
            --vscode-card-background: ${isDark ? '#252526' : '#f8f8f8'};
            --vscode-border: ${isDark ? '#3c3c3c' : '#e0e0e0'};
          }
        </style>
    </head>
    <body>
        <div class="dashboard-container">
            <header class="dashboard-header">
                <h2>Task Dashboard</h2>
                <button id="refresh-btn" class="refresh-button" title="Refresh Dashboard">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M13.651 4.737A6.991 6.991 0 0 0 8 2C4.69 2 2 4.691 2 8s2.69 6 6 6a6.97 6.97 0 0 0 5.651-2.737l-1.141-1.141A5.505 5.505 0 0 1 8 12.5a4.5 4.5 0 1 1 0-9 5.505 5.505 0 0 1 4.51 2.359L11 7h4V3l-1.349 1.737z"/>
                    </svg>
                </button>
            </header>

            ${this.renderConnectionStatus()}
            
            ${this._dashboardData ? this.renderDashboard() : this.renderNoData()}
        </div>

        <script src="${scriptUri}"></script>
        <script>
            const vscode = acquireVsCodeApi();
            
            // Chart rendering library (simple lightweight implementation)
            ${this.getChartLibrary()}
            
            // Dashboard interactions
            ${this.getDashboardScript()}
        </script>
    </body>
    </html>`;
  }

  private renderConnectionStatus(): string {
    const binderyService = getBinderyService();
    const connectionInfo = binderyService.getConnectionInfo();

    const statusClass = connectionInfo.status === BinderyConnectionStatus.Connected ? 'connected' : 
                       connectionInfo.status === BinderyConnectionStatus.Connecting ? 'connecting' : 
                       connectionInfo.status === BinderyConnectionStatus.Error ? 'error' : 'disconnected';

    return `
    <div class="connection-status ${statusClass}">
        <div class="status-indicator"></div>
        <span class="status-text">${connectionInfo.status}</span>
        ${connectionInfo.last_error ? `<span class="error-text">${connectionInfo.last_error}</span>` : ''}
    </div>`;
  }

  private renderNoData(): string {
    const binderyService = getBinderyService();
    
    if (!binderyService.isConnected()) {
      return `
      <div class="no-data">
        <h3>Bindery Not Connected</h3>
        <p>Connect to Bindery to view and manage tasks.</p>
        <button onclick="initializeBindery()" class="primary-button">Initialize Connection</button>
      </div>`;
    }

    return `
    <div class="no-data">
      <h3>Loading Dashboard...</h3>
      <p>Fetching task data from Bindery...</p>
    </div>`;
  }

  private renderDashboard(): string {
    console.log(`[TaskDashboard] renderDashboard called, _dashboardData:`, this._dashboardData);
    if (!this._dashboardData) return '';

    const data = this._dashboardData;
    console.log(`[TaskDashboard] Data total_tasks: ${data.total_tasks}`);
    
    // Show empty state if no tasks exist
    if (data.total_tasks === 0) {
      console.log(`[TaskDashboard] Rendering empty state`);
      return `
      <div class="no-data">
        <h3>No Tasks Yet</h3>
        <p>Get started by creating your first task.</p>
        <div class="action-buttons">
          <button onclick="createNewTask()" class="primary-button">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a.5.5 0 0 1 .5.5v6h6a.5.5 0 0 1 0 1h-6v6a.5.5 0 0 1-1 0v-6h-6a.5.5 0 0 1 0-1h6v-6A.5.5 0 0 1 8 1z"/>
            </svg>
            Create First Task
          </button>
          <button onclick="openSettings()" class="secondary-button">
            Configure Settings
          </button>
        </div>
      </div>`;
    }
    
    return `
    <div class="dashboard-content">
        <!-- Summary Cards -->
        <div class="summary-grid">
            <div class="summary-card">
                <div class="summary-number">${data.total_tasks}</div>
                <div class="summary-label">Total Tasks</div>
            </div>
            <div class="summary-card">
                <div class="summary-number">${Math.round(data.completion_rate * 100)}%</div>
                <div class="summary-label">Completion Rate</div>
            </div>
            <div class="summary-card">
                <div class="summary-number">${data.overdue_tasks.length}</div>
                <div class="summary-label">Overdue</div>
            </div>
            <div class="summary-card">
                <div class="summary-number">${data.upcoming_tasks.length}</div>
                <div class="summary-label">Upcoming</div>
            </div>
        </div>

        <!-- Charts Section -->
        <div class="charts-section">
            <div class="chart-container">
                <h3>Status Breakdown</h3>
                <canvas id="status-chart" width="300" height="200"></canvas>
            </div>
            <div class="chart-container">
                <h3>Priority Breakdown</h3>
                <canvas id="priority-chart" width="300" height="200"></canvas>
            </div>
        </div>

        <!-- Quick Actions -->
        <div class="quick-actions">
            <h3>Quick Actions</h3>
            <div class="action-buttons">
                <button onclick="createNewTask()" class="action-button">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 1a.5.5 0 0 1 .5.5v6h6a.5.5 0 0 1 0 1h-6v6a.5.5 0 0 1-1 0v-6h-6a.5.5 0 0 1 0-1h6v-6A.5.5 0 0 1 8 1z"/>
                    </svg>
                    New Task
                </button>
                <button onclick="openTaskTree()" class="action-button">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zM2.5 2a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zm6.5.5A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zM1 10.5A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zm6.5.5A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3z"/>
                    </svg>
                    Task Tree
                </button>
                <button onclick="openSettings()" class="action-button">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
                        <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
                    </svg>
                    Settings
                </button>
            </div>
        </div>

        <!-- Recent Tasks -->
        ${this.renderRecentTasks()}
        
        <!-- Task Lists -->
        ${this.renderTaskLists()}
    </div>

    <script>
        // Initialize charts after DOM is loaded
        setTimeout(() => {
            renderCharts(${JSON.stringify(data)});
        }, 100);
    </script>`;
  }

  private renderRecentTasks(): string {
    if (!this._dashboardData?.recent_tasks.length) return '';

    return `
    <div class="recent-tasks">
        <h3>Recent Tasks</h3>
        <div class="task-list">
            ${this._dashboardData.recent_tasks.slice(0, 5).map(task => `
            <div class="task-item" onclick="openTask('${task.id}')">
                <div class="task-status status-${task.status}"></div>
                <div class="task-content">
                    <div class="task-title">${task.title}</div>
                    <div class="task-meta">
                        <span class="task-priority priority-${task.priority}">${task.priority}</span>
                        <span class="task-date">${new Date(task.updated_at).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>
            `).join('')}
        </div>
    </div>`;
  }

  private renderTaskLists(): string {
    if (!this._dashboardData) return '';

    const { overdue_tasks, upcoming_tasks } = this._dashboardData;
    
    return `
    <div class="task-lists">
        ${overdue_tasks.length > 0 ? `
        <div class="task-list-section">
            <h3 class="overdue-title">Overdue Tasks (${overdue_tasks.length})</h3>
            <div class="task-list">
                ${overdue_tasks.slice(0, 5).map(task => `
                <div class="task-item urgent" onclick="openTask('${task.id}')">
                    <div class="task-status status-${task.status}"></div>
                    <div class="task-content">
                        <div class="task-title">${task.title}</div>
                        <div class="task-meta">
                            <span class="task-priority priority-${task.priority}">${task.priority}</span>
                            ${task.due_date ? `<span class="task-due-date">Due: ${new Date(task.due_date).toLocaleDateString()}</span>` : ''}
                        </div>
                    </div>
                </div>
                `).join('')}
            </div>
        </div>` : ''}

        ${upcoming_tasks.length > 0 ? `
        <div class="task-list-section">
            <h3>Upcoming Tasks (${upcoming_tasks.length})</h3>
            <div class="task-list">
                ${upcoming_tasks.slice(0, 5).map(task => `
                <div class="task-item" onclick="openTask('${task.id}')">
                    <div class="task-status status-${task.status}"></div>
                    <div class="task-content">
                        <div class="task-title">${task.title}</div>
                        <div class="task-meta">
                            <span class="task-priority priority-${task.priority}">${task.priority}</span>
                            ${task.due_date ? `<span class="task-due-date">Due: ${new Date(task.due_date).toLocaleDateString()}</span>` : ''}
                        </div>
                    </div>
                </div>
                `).join('')}
            </div>
        </div>` : ''}
    </div>`;
  }

  private getChartLibrary(): string {
    return `
    function renderCharts(data) {
        renderDonutChart('status-chart', data.status_breakdown, [
            '#007acc', '#28a745', '#dc3545', '#ffc107', '#6c757d', '#17a2b8', '#6f42c1'
        ]);
        renderDonutChart('priority-chart', data.priority_breakdown, [
            '#dc3545', '#fd7e14', '#28a745', '#6c757d', '#adb5bd'
        ]);
    }

    function renderDonutChart(canvasId, data, colors) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 20;
        const innerRadius = radius * 0.5;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const entries = Object.entries(data).filter(([_, value]) => value > 0);
        const total = entries.reduce((sum, [_, value]) => sum + value, 0);
        
        if (total === 0) {
            // Draw empty state
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.stroke();
            
            ctx.fillStyle = '#666';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '14px var(--vscode-font-family)';
            ctx.fillText('No data', centerX, centerY);
            return;
        }
        
        let currentAngle = -Math.PI / 2;
        
        entries.forEach(([label, value], index) => {
            const sliceAngle = (value / total) * 2 * Math.PI;
            const color = colors[index % colors.length];
            
            // Draw slice
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
            
            // Draw inner circle (donut hole)
            ctx.beginPath();
            ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
            ctx.fillStyle = 'var(--vscode-background)';
            ctx.fill();
            
            currentAngle += sliceAngle;
        });
        
        // Draw legend
        const legendX = canvas.width - 120;
        let legendY = 20;
        
        entries.forEach(([label, value], index) => {
            const color = colors[index % colors.length];
            
            // Legend color box
            ctx.fillStyle = color;
            ctx.fillRect(legendX, legendY, 12, 12);
            
            // Legend text
            ctx.fillStyle = 'var(--vscode-foreground)';
            ctx.font = '11px var(--vscode-font-family)';
            ctx.textAlign = 'left';
            ctx.fillText(\`\${label}: \${value}\`, legendX + 16, legendY + 9);
            
            legendY += 16;
        });
    }`;
  }

  private getDashboardScript(): string {
    return `
    // Dashboard interactions
    document.getElementById('refresh-btn').addEventListener('click', () => {
        vscode.postMessage({ type: 'refresh' });
    });

    function createNewTask() {
        vscode.postMessage({ type: 'createTask', title: 'New Task', priority: 'normal' });
    }

    function openTask(taskId) {
        vscode.postMessage({ type: 'openTask', taskId: taskId });
    }

    function openTaskTree() {
        vscode.postMessage({ type: 'openTaskTree' });
    }

    function openSettings() {
        vscode.postMessage({ type: 'openSettings' });
    }

    function initializeBindery() {
        vscode.postMessage({ type: 'initializeBindery' });
    }`;
  }

  // Message handlers

  private async handleCreateTask(title: string, priority: string): Promise<void> {
    const binderyService = getBinderyService();
    const result = await binderyService.createTask({
      title,
      priority: priority as TaskPriority,
      description: '',
      tags: [],
      labels: {},
      subtasks: []
    });

    if (result.success) {
      this.refresh();
      vscode.window.showInformationMessage(`Task "${title}" created successfully.`);
      
      // Emit task creation event for cross-component sync
      console.log(`[Dashboard] 📡 Emitting taskCreated event for task: ${result.data}`);
      VesperaEvents.taskCreated(result.data, title);
    } else {
      vscode.window.showErrorMessage(`Failed to create task: ${result.error.message}`);
    }
  }

  private async handleUpdateTask(taskId: CodexId, updates: any): Promise<void> {
    const binderyService = getBinderyService();
    const result = await binderyService.updateTask({
      task_id: taskId,
      ...updates
    });

    if (result.success) {
      this.refresh();
      vscode.window.showInformationMessage('Task updated successfully.');
      
      // Emit task update event for cross-component sync
      console.log(`[Dashboard] 📡 Emitting taskUpdated event for task: ${taskId}`);
      VesperaEvents.taskUpdated(taskId, 'Task updated from dashboard');
    } else {
      vscode.window.showErrorMessage(`Failed to update task: ${result.error.message}`);
    }
  }

  private async handleDeleteTask(taskId: CodexId): Promise<void> {
    const choice = await vscode.window.showWarningMessage(
      'Are you sure you want to delete this task?',
      { modal: true },
      'Delete',
      'Cancel'
    );

    if (choice !== 'Delete') return;

    const binderyService = getBinderyService();
    const result = await binderyService.deleteTask(taskId, false);

    if (result.success) {
      this.refresh();
      vscode.window.showInformationMessage('Task deleted successfully.');
      
      // Emit task deletion event for cross-component sync
      console.log(`[Dashboard] 📡 Emitting taskDeleted event for task: ${taskId}`);
      VesperaEvents.taskDeleted(taskId);
    } else {
      vscode.window.showErrorMessage(`Failed to delete task: ${result.error.message}`);
    }
  }

  private async handleOpenTask(taskId: CodexId): Promise<void> {
    // Store selected task for detailed view
    this._selectedTaskId = taskId;
    
    // Could open in a new webview or update current view
    vscode.commands.executeCommand('vespera-forge.focusTaskInTree', taskId);
  }

  private async handleFilterTasks(_filters: any): Promise<void> {
    // Implement task filtering logic
    this.refresh();
  }

  private startAutoRefresh(): void {
    this._refreshTimer = setInterval(() => {
      const binderyService = getBinderyService();
      if (binderyService.isConnected() && this._view?.visible) {
        this.refresh();
      }
    }, 120000); // Refresh every 2 minutes when visible
  }

  public dispose(): void {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
    }
  }

  // Public methods

  public show(): void {
    if (this._view) {
      this._view.show();
    }
  }

  public refreshData(): void {
    this.refresh();
  }

  public selectTask(taskId: CodexId): void {
    this._selectedTaskId = taskId;
    this.updateWebview();
  }
}