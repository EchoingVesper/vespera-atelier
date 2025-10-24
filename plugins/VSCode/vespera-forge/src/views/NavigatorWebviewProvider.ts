/**
 * Navigator Webview Provider
 * Phase 16b Stage 1 - Added ProjectService integration
 * Provides the left sidebar navigator view with project management
 */
import * as vscode from 'vscode';
import { VesperaLogger } from '../core/logging/VesperaLogger';
import { BinderyService } from '../services/bindery';
import { ProjectService } from '../services/ProjectService';
import { BinderyConnectionStatus, BinderyConnectionInfo } from '../types/bindery';
import { TemplateInitializer } from '../services/template-initializer';

export class NavigatorWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vesperaForge.navigatorView';

  private _view?: vscode.WebviewView;
  private _disposables: vscode.Disposable[] = [];
  private _sessionId: string;
  private _templateInitializer: TemplateInitializer;
  private _projectService?: ProjectService;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly binderyService: BinderyService,
    private readonly logger?: VesperaLogger,
    private readonly onCodexSelected?: (codexId: string) => void,
    projectService?: ProjectService
  ) {
    this._sessionId = `vespera_navigator_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this._templateInitializer = new TemplateInitializer(logger);
    this._projectService = projectService;
  }

  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this._view = webviewView;

    // Configure webview options
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview'),
        this.context.extensionUri
      ]
    };

    // Set HTML content
    webviewView.webview.html = this.getHtmlContent(webviewView.webview);

    // Setup message handling
    this.setupMessageHandling(webviewView.webview);

    // Handle webview disposal
    webviewView.onDidDispose(() => {
      this.dispose();
    }, null, this._disposables);

    // Handle view state changes to send focus commands
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible && this._view) {
        // Send focus command when view becomes visible
        this._view.webview.postMessage({
          type: 'focus'
        });
      }
    }, null, this._disposables);

    this.logger?.info('Navigator WebView resolved successfully', {
      sessionId: this._sessionId
    });
  }

  private getHtmlContent(webview: vscode.Webview): string {
    // Get URIs for script
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'navigator.js')
    );

    // Generate nonce for CSP
    const nonce = this.getNonce();

    // Build HTML with strict CSP
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- Content Security Policy -->
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    script-src 'nonce-${nonce}' ${webview.cspSource};
    style-src ${webview.cspSource} 'unsafe-inline';
    font-src ${webview.cspSource};
    img-src ${webview.cspSource} data: https:;
    connect-src ${webview.cspSource} https:;
  ">

  <title>Codex Navigator</title>

  <!-- Styles will be injected by webpack style-loader -->
</head>
<body>
  <div id="root" tabindex="0" style="outline: none;"></div>

  <!-- React app bundle -->
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private setupMessageHandling(webview: vscode.Webview): void {
    webview.onDidReceiveMessage(
      async (message) => {
        try {
          await this.handleMessage(message);
        } catch (error) {
          this.logger?.error('Error handling navigator message', error);

          // Send error back to webview
          webview.postMessage({
            type: 'error',
            id: message.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      },
      null,
      this._disposables
    );
  }

  private async handleMessage(message: any): Promise<void> {
    this.logger?.debug('Received message from navigator', { type: message.type });

    switch (message.type) {
      case 'ready':
        // Navigator is ready, send initial data
        await this.sendInitialState();
        break;

      case 'codex.selected':
        // User selected a codex, notify the editor panel
        if (this.onCodexSelected) {
          this.onCodexSelected(message.payload.codexId);
        }
        // Also open the editor panel if not already open
        await vscode.commands.executeCommand('vespera-forge.openEditor');
        break;

      case 'codex.create':
        // Request to create a new codex
        await this.handleCodexCreate(message.id, message.payload);
        break;

      case 'codex.delete':
        // Request to delete a codex
        await this.handleCodexDelete(message.id, message.payload);
        break;

      case 'command':
        // Execute VS Code command
        if (message.payload?.command) {
          await vscode.commands.executeCommand(message.payload.command);
        }
        break;

      // Phase 16b Stage 1: Project management messages
      case 'project:list':
        await this.handleProjectList(message.id);
        break;

      case 'project:get':
        await this.handleProjectGet(message.id, message.payload);
        break;

      case 'project:setActive':
        await this.handleProjectSetActive(message.id, message.payload);
        break;

      case 'project:create':
        await this.handleProjectCreate(message.id, message.payload);
        break;

      case 'project:delete':
        await this.handleProjectDelete(message.id, message.payload);
        break;

      case 'project:createWizard':
        // Phase 16b Stage 2 will implement the creation wizard
        // For now, just log that it was requested
        this.logger?.info('Project creation wizard requested (not yet implemented)');
        break;

      default:
        this.logger?.debug('Unhandled navigator message', { type: message.type });
    }
  }

  /**
   * Wait for Bindery to be connected, with timeout
   */
  private async waitForConnection(timeoutMs: number = 5000): Promise<boolean> {
    // Already connected?
    if (this.binderyService.isConnected()) {
      return true;
    }

    // Get current status
    const connectionInfo = this.binderyService.getConnectionInfo();
    this.logger?.debug('Current connection status', { status: connectionInfo.status });

    // If disconnected, try to initialize
    if (connectionInfo.status === BinderyConnectionStatus.Disconnected) {
      this.logger?.info('Bindery disconnected, attempting to initialize...');
      const initResult = await this.binderyService.initialize();
      if (!initResult.success) {
        this.logger?.error('Failed to initialize Bindery', initResult.error);
        return false;
      }
    }

    // Wait for status to become 'connected' or timeout
    return new Promise<boolean>((resolve) => {
      const timeoutHandle = setTimeout(() => {
        this.binderyService.removeListener('statusChanged', statusListener);
        this.logger?.warn('Timeout waiting for Bindery connection');
        resolve(false);
      }, timeoutMs);

      const statusListener = (info: BinderyConnectionInfo) => {
        this.logger?.debug('Connection status changed', { status: info.status });
        if (info.status === BinderyConnectionStatus.Connected) {
          clearTimeout(timeoutHandle);
          this.binderyService.removeListener('statusChanged', statusListener);
          resolve(true);
        } else if (info.status === BinderyConnectionStatus.Error || info.status === BinderyConnectionStatus.NoWorkspace) {
          clearTimeout(timeoutHandle);
          this.binderyService.removeListener('statusChanged', statusListener);
          resolve(false);
        }
      };

      this.binderyService.on('statusChanged', statusListener);

      // Double-check connection status in case it changed before we added the listener
      if (this.binderyService.isConnected()) {
        clearTimeout(timeoutHandle);
        this.binderyService.removeListener('statusChanged', statusListener);
        resolve(true);
      }
    });
  }

  public async sendInitialState(): Promise<void> {
    if (!this._view) return;

    try {
      // Check if workspace folder is open
      const connectionInfo = this.binderyService.getConnectionInfo();
      if (connectionInfo.status === BinderyConnectionStatus.NoWorkspace) {
        this.logger?.info('No workspace folder open, prompting user');
        this._view.webview.postMessage({
          type: 'noWorkspace',
          payload: {
            message: connectionInfo.last_error || 'Please open a folder to use Vespera Forge',
            action: 'openFolder'
          }
        });
        return;
      }

      // Wait for connection to be ready (with 5 second timeout)
      const connected = await this.waitForConnection(5000);
      if (!connected) {
        this.logger?.warn('Could not establish Bindery connection, sending empty state');
        this._view.webview.postMessage({
          type: 'initialState',
          payload: { codices: [], templates: [] }
        });
        return;
      }

      // Always ensure directory structure and initialize templates
      // initializeTemplates() is idempotent - it checks if each file exists before creating
      const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
      if (workspaceUri) {
        this.logger?.info('Initializing .vespera templates...');
        await this._templateInitializer.initializeTemplates(workspaceUri);
        this.logger?.info('Templates initialized successfully');
      }

      // Load codices from Bindery - first get IDs, then fetch full objects
      const codicesIdsResult = await this.binderyService.listCodeices();

      let codices: any[] = [];
      if (codicesIdsResult.success && codicesIdsResult.data.length > 0) {
        this.logger?.info('Fetching full codex objects', {
          idCount: codicesIdsResult.data.length
        });

        // Fetch full codex objects for each ID
        const codexPromises = codicesIdsResult.data.map(id =>
          this.binderyService.getCodex(id)
        );
        const codexResults = await Promise.all(codexPromises);

        // Extract successful results and transform to UI format
        codices = codexResults
          .filter(result => result.success)
          .map(result => {
            const data = result.data as any;
            // Transform flat Bindery response to UI's expected structure
            return {
              id: data.id,
              name: data.title,
              templateId: data.template_id,
              tags: data.tags || [],
              relationships: data.relationships || [],
              createdAt: data.created_at ? new Date(data.created_at) : new Date(),
              updatedAt: data.updated_at ? new Date(data.updated_at) : new Date(),
              metadata: {
                id: data.id,
                title: data.title,
                template_id: data.template_id,
                created_at: data.created_at,
                updated_at: data.updated_at,
                projectId: data.project_id || data.metadata?.projectId,
                status: data.metadata?.status,
                priority: data.metadata?.priority,
                assignedTo: data.metadata?.assignedTo
              },
              content: data.content || { fields: {} }
            };
          });

        this.logger?.info('Loaded full codex objects', {
          count: codices.length
        });
      }

      // Load templates from .vespera/templates directory
      let templates: Array<{ id: string; name: string; description: string; icon?: string }> = [];
      if (workspaceUri) {
        templates = await this._templateInitializer.loadTemplates(workspaceUri);
        this.logger?.info('Loaded templates for Navigator', {
          count: templates.length,
          templateIds: templates.map(t => t.id)
        });
      }

      // Fallback to default templates if none loaded
      if (templates.length === 0) {
        this.logger?.warn('No templates loaded, using defaults');
        templates = [
          { id: 'note', name: 'Note', description: 'Simple note or document', icon: '📝' },
          { id: 'task', name: 'Task', description: 'Task or todo item', icon: '✓' },
          { id: 'project', name: 'Project', description: 'Project container', icon: '📁' },
          { id: 'character', name: 'Character', description: 'Character profile', icon: '👤' },
          { id: 'scene', name: 'Scene', description: 'Scene or chapter', icon: '🎬' },
          { id: 'location', name: 'Location', description: 'Place or setting', icon: '🗺️' }
        ];
      }

      const codexData = {
        codices,
        templates
      };

      this._view.webview.postMessage({
        type: 'initialState',
        payload: codexData
      });
    } catch (error) {
      this.logger?.error('Error loading initial state', error);
      this._view.webview.postMessage({
        type: 'initialState',
        payload: { codices: [], templates: [] }
      });
    }
  }

  private async handleCodexCreate(messageId: string, payload: any): Promise<void> {
    this.logger?.debug('Create codex', payload);

    try {
      // Generate default title if not provided: "New [TemplateName]"
      let title = payload.title;
      if (!title && payload.templateId) {
        // Find template name from loaded templates
        const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
        if (workspaceUri) {
          const templates = await this._templateInitializer.loadTemplates(workspaceUri);
          const template = templates.find(t => t.id === payload.templateId);
          const templateName = template?.name || payload.templateId;
          title = `New ${templateName}`;
        } else {
          // Fallback to capitalizing template ID
          const templateName = payload.templateId.charAt(0).toUpperCase() + payload.templateId.slice(1);
          title = `New ${templateName}`;
        }
      }

      this.logger?.info('Creating codex', { title, templateId: payload.templateId });

      const result = await this.binderyService.createCodex(
        title,
        payload.templateId || 'default'
      );

      if (this._view) {
        if (result.success) {
          this._view.webview.postMessage({
            type: 'response',
            id: messageId,
            success: true,
            result: { id: result.data, title, templateId: payload.templateId }
          });

          // Refresh the navigator to show the new codex
          await this.sendInitialState();

          // Send message to select and edit the new codex
          this._view.webview.postMessage({
            type: 'codex.created',
            payload: {
              id: result.data,
              title,
              templateId: payload.templateId,
              editMode: true // Signal to enter edit mode
            }
          });
        } else {
          this._view.webview.postMessage({
            type: 'response',
            id: messageId,
            success: false,
            error: result.error.message
          });
        }
      }
    } catch (error) {
      this.logger?.error('Error creating codex', error);
      if (this._view) {
        this._view.webview.postMessage({
          type: 'response',
          id: messageId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  private async handleCodexDelete(messageId: string, payload: any): Promise<void> {
    this.logger?.debug('Delete codex', payload);

    try {
      const result = await this.binderyService.deleteCodex(payload.codexId);

      if (this._view) {
        if (result.success) {
          this._view.webview.postMessage({
            type: 'response',
            id: messageId,
            success: true
          });

          // Refresh the navigator to reflect the deletion
          await this.sendInitialState();
        } else {
          this._view.webview.postMessage({
            type: 'response',
            id: messageId,
            success: false,
            error: result.error.message
          });
        }
      }
    } catch (error) {
      this.logger?.error('Error deleting codex', error);
      if (this._view) {
        this._view.webview.postMessage({
          type: 'response',
          id: messageId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  /**
   * Phase 16b Stage 1: Project message handlers
   */

  private async handleProjectList(messageId?: string): Promise<void> {
    if (!this._projectService) {
      this.logger?.warn('ProjectService not available');
      if (this._view && messageId) {
        this._view.webview.postMessage({
          type: 'project:error',
          id: messageId,
          payload: { error: 'Project service not available' }
        });
      }
      return;
    }

    try {
      const projects = await this._projectService.listProjects();
      if (this._view) {
        this._view.webview.postMessage({
          type: 'project:list:response',
          id: messageId,
          payload: { projects }
        });
      }
    } catch (error) {
      this.logger?.error('Error listing projects', error);
      if (this._view && messageId) {
        this._view.webview.postMessage({
          type: 'project:error',
          id: messageId,
          payload: { error: error instanceof Error ? error.message : 'Failed to list projects' }
        });
      }
    }
  }

  private async handleProjectGet(messageId: string, payload: any): Promise<void> {
    if (!this._projectService) {
      if (this._view) {
        this._view.webview.postMessage({
          type: 'project:error',
          id: messageId,
          payload: { error: 'Project service not available' }
        });
      }
      return;
    }

    try {
      const project = await this._projectService.getProject(payload.projectId);
      if (this._view) {
        this._view.webview.postMessage({
          type: 'project:get:response',
          id: messageId,
          payload: { project: project || null }
        });
      }
    } catch (error) {
      this.logger?.error('Error getting project', error);
      if (this._view) {
        this._view.webview.postMessage({
          type: 'project:error',
          id: messageId,
          payload: { error: error instanceof Error ? error.message : 'Failed to get project' }
        });
      }
    }
  }

  private async handleProjectSetActive(messageId: string, payload: any): Promise<void> {
    if (!this._projectService) {
      if (this._view) {
        this._view.webview.postMessage({
          type: 'project:error',
          id: messageId,
          payload: { error: 'Project service not available' }
        });
      }
      return;
    }

    try {
      const projectId = payload.projectId;
      if (projectId) {
        await this._projectService.setActiveProject(projectId);
        const project = await this._projectService.getProject(projectId);
        // Notify webview of active project change
        if (this._view) {
          this._view.webview.postMessage({
            type: 'project:activeChanged',
            payload: { project }
          });
        }
      } else {
        // Clear active project
        this._projectService.clearActiveProject();
        if (this._view) {
          this._view.webview.postMessage({
            type: 'project:activeChanged',
            payload: { project: null }
          });
        }
      }
    } catch (error) {
      this.logger?.error('Error setting active project', error);
      if (this._view) {
        this._view.webview.postMessage({
          type: 'project:error',
          id: messageId,
          payload: { error: error instanceof Error ? error.message : 'Failed to set active project' }
        });
      }
    }
  }

  private async handleProjectCreate(messageId: string, payload: any): Promise<void> {
    if (!this._projectService) {
      if (this._view) {
        this._view.webview.postMessage({
          type: 'project:error',
          id: messageId,
          payload: { error: 'Project service not available' }
        });
      }
      return;
    }

    try {
      const project = await this._projectService.createProject(payload);
      if (this._view) {
        this._view.webview.postMessage({
          type: 'project:created',
          id: messageId,
          payload: { project }
        });

        // Notify that projects list changed
        this._view.webview.postMessage({
          type: 'project:projectsChanged',
          payload: {}
        });
      }
    } catch (error) {
      this.logger?.error('Error creating project', error);
      if (this._view) {
        this._view.webview.postMessage({
          type: 'project:error',
          id: messageId,
          payload: { error: error instanceof Error ? error.message : 'Failed to create project' }
        });
      }
    }
  }

  private async handleProjectDelete(messageId: string, payload: any): Promise<void> {
    if (!this._projectService) {
      if (this._view) {
        this._view.webview.postMessage({
          type: 'project:error',
          id: messageId,
          payload: { error: 'Project service not available' }
        });
      }
      return;
    }

    try {
      const success = await this._projectService.deleteProject(payload.projectId);
      if (this._view) {
        this._view.webview.postMessage({
          type: 'project:deleted',
          id: messageId,
          payload: { success }
        });

        // Notify that projects list changed
        this._view.webview.postMessage({
          type: 'project:projectsChanged',
          payload: {}
        });
      }
    } catch (error) {
      this.logger?.error('Error deleting project', error);
      if (this._view) {
        this._view.webview.postMessage({
          type: 'project:error',
          id: messageId,
          payload: { error: error instanceof Error ? error.message : 'Failed to delete project' }
        });
      }
    }
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  public dispose(): void {
    this.logger?.info('Disposing Navigator view');

    // Remove all event listeners from Bindery service to prevent memory leaks
    this.binderyService.removeAllListeners('statusChanged');
    this.logger?.debug('Removed all statusChanged listeners from Bindery');

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
