/**
 * Navigator Webview Provider
 * Phase 16b Stage 1 - Added ProjectService integration
 * Provides the left sidebar navigator view with project management
 */
import * as vscode from 'vscode';
import { VesperaLogger } from '../core/logging/VesperaLogger';
import { BinderyService } from '../services/bindery';
import { BinderyConnectionStatus, BinderyConnectionInfo } from '../types/bindery';
import { TemplateInitializer } from '../services/template-initializer';

export class NavigatorWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vesperaForge.navigatorView';

  private _view?: vscode.WebviewView;
  private _disposables: vscode.Disposable[] = [];
  private _sessionId: string;
  private _templateInitializer: TemplateInitializer;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly binderyService: BinderyService,
    private readonly logger?: VesperaLogger,
    private readonly onCodexSelected?: (codexId: string) => void
  ) {
    this._sessionId = `vespera_navigator_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this._templateInitializer = new TemplateInitializer(logger);
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

      // Phase 17: Workspace initialization
      case 'workspace:initialize':
        await this.handleWorkspaceInitialize(message.id, message.payload);
        break;

      // Phase 17: Context management
      case 'context:setActive':
        await this.handleContextSetActive(message.id, message.payload);
        break;

      case 'context:create':
        await this.handleContextCreate(message.id, message.payload);
        break;

      case 'context:delete':
        await this.handleContextDelete(message.id, message.payload);
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
      // Phase 17: Check workspace state using WorkspaceDiscovery
      const { findWorkspaceVespera } = await import('../services/WorkspaceDiscovery');
      const discoveryResult = await findWorkspaceVespera();

      // Determine workspace state
      let workspaceState: 'no-folder' | 'no-vespera' | 'initialized';

      if (!discoveryResult.found) {
        // Check if it's because no folder is open vs .vespera/ doesn't exist
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
          workspaceState = 'no-folder';
        } else {
          workspaceState = 'no-vespera';
        }

        // Send workspace state to frontend
        this.logger?.info('Workspace not initialized, sending state:', { workspaceState });
        this._view.webview.postMessage({
          type: 'workspaceState',
          payload: { state: workspaceState }
        });
        return;
      }

      // Workspace is initialized (.vespera/ exists)
      workspaceState = 'initialized';
      this.logger?.info('Workspace initialized:', { name: discoveryResult.metadata?.name });

      // Phase 17: Load contexts from workspace metadata
      const crypto = await import('crypto');
      const { DEFAULT_CONTEXT_TYPES, ContextStatus } = await import('../types/context');

      const contextTypes = discoveryResult.metadata?.context_types || ['general'];
      const workspaceId = discoveryResult.metadata?.id || 'unknown';

      // Create IContext objects from context types
      // CRITICAL: Use deterministic IDs (workspace + type) so they're stable across reloads
      const contexts = contextTypes.map((typeId: string) => {
        const typeDef = DEFAULT_CONTEXT_TYPES.find(t => t.id === typeId);
        const now = new Date();

        // Generate deterministic context ID from workspace ID + type
        // This ensures the same context has the same ID across reloads
        const deterministicId = crypto
          .createHash('sha256')
          .update(`${workspaceId}-${typeId}`)
          .digest('hex')
          .substring(0, 32);
        const contextId = `ctx-${deterministicId}`;

        return {
          id: contextId,
          name: typeDef?.name || typeId,
          project_id: workspaceId, // Phase 17: workspace ID is the project ID
          type: typeId,
          description: typeDef?.description,
          status: ContextStatus.Active,
          metadata: {
            createdAt: now,
            updatedAt: now,
            version: '1.0.0',
            tags: [],
            icon: typeDef?.icon
          },
          settings: {
            enabledAutomation: typeDef?.defaultSettings?.enabledAutomation || false,
            color: typeDef?.defaultSettings?.customSettings?.['color'],
            icon: typeDef?.icon,
            customSettings: typeDef?.defaultSettings?.customSettings || {}
          }
        };
      });

      this.logger?.info('Loaded contexts from workspace.json', {
        count: contexts.length,
        types: contextTypes
      });

      // Wait for connection to be ready (with 5 second timeout)
      const connected = await this.waitForConnection(5000);
      if (!connected) {
        this.logger?.warn('Could not establish Bindery connection, sending contexts but empty codices');
        this._view.webview.postMessage({
          type: 'initialState',
          payload: {
            codices: [],
            templates: [],
            contexts // Send contexts even if Bindery not connected
          }
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

      // Load codices from Bindery - list_codices now returns full objects
      const codicesResult = await this.binderyService.listCodeices();

      let codices: any[] = [];
      if (codicesResult.success && codicesResult.data.length > 0) {
        this.logger?.info('Processing codex objects', {
          count: codicesResult.data.length
        });

        // Transform codex objects to UI format (no need to fetch individually)
        codices = codicesResult.data.map((data: any) => {
          // Transform flat Bindery response to UI's expected structure
          // Phase 17: project_id is now context_id (workspace IS the project)
          const contextId = data.project_id || data.metadata?.project_id || data.metadata?.projectId || data.metadata?.context_id || data.metadata?.contextId;

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
              // Phase 17: Use contextId (project_id field from backend stores the context ID)
              contextId: contextId,
              context_id: contextId, // Also include snake_case for compatibility
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
          { id: 'character', name: 'Character', description: 'Character profile', icon: '👤' },
          { id: 'scene', name: 'Scene', description: 'Scene or chapter', icon: '🎬' },
          { id: 'location', name: 'Location', description: 'Place or setting', icon: '🗺️' }
        ];
      }

      const codexData = {
        codices,
        templates,
        contexts // Phase 17: Include contexts from workspace.json
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

      // Phase 17: contextId is optional (can be null for codices without a specific context)
      const contextId = payload.contextId || null;

      this.logger?.info('Creating codex', {
        title,
        templateId: payload.templateId,
        contextId,
        payloadReceived: payload
      });

      // Phase 17: createCodex no longer requires projectId
      // The workspace folder IS the project
      const result = await this.binderyService.createCodex(
        title,
        payload.templateId || 'default',
        contextId  // Pass context ID (optional)
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
   * Phase 17 Part 2: Workspace and Context message handlers
   */

  private async handleWorkspaceInitialize(messageId: string, payload: any): Promise<void> {
    this.logger?.info('Initializing workspace with context types', { contextTypes: payload.contextTypes });

    try {
      // Get workspace folder
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0 || !workspaceFolders[0]) {
        throw new Error('No workspace folder open');
      }

      const workspaceUri = workspaceFolders[0].uri;
      const workspacePath = workspaceUri.fsPath;
      const vesperaPath = vscode.Uri.joinPath(workspaceUri, '.vespera');

      // Import required Node.js modules
      const fs = await import('fs');
      const path = await import('path');
      const crypto = await import('crypto');

      // 1. Create .vespera/ directory
      this.logger?.debug('Creating .vespera directory', { path: vesperaPath.fsPath });
      await fs.promises.mkdir(vesperaPath.fsPath, { recursive: true });

      // 2. Generate workspace metadata
      const workspaceName = path.basename(workspacePath);
      const workspaceId = crypto.randomUUID();
      const now = new Date().toISOString();

      const metadata = {
        id: workspaceId,
        name: workspaceName,
        version: '1.0.0',
        created_at: now,
        settings: {
          auto_sync: true,
          template_path: '.vespera/templates',
          enable_rag: false,
          enable_graph: false
        },
        // Phase 17: Store selected context types
        context_types: payload.contextTypes || ['general']
      };

      // 3. Write workspace.json
      const workspaceJsonPath = vscode.Uri.joinPath(vesperaPath, 'workspace.json');
      this.logger?.debug('Writing workspace.json', { path: workspaceJsonPath.fsPath });
      await fs.promises.writeFile(
        workspaceJsonPath.fsPath,
        JSON.stringify(metadata, null, 2),
        'utf-8'
      );

      // 4. Initialize template directories
      this.logger?.info('Initializing templates');
      await this._templateInitializer.initializeTemplates(workspaceUri);

      // 5. Send success response
      this.logger?.info('Workspace initialized successfully', {
        id: workspaceId,
        name: workspaceName,
        contextTypes: payload.contextTypes
      });

      if (this._view) {
        this._view.webview.postMessage({
          type: 'response',
          id: messageId,
          success: true,
          result: {
            workspaceId,
            workspaceName,
            vesperaPath: vesperaPath.fsPath
          }
        });

        // 6. Refresh Navigator to show initialized state
        await this.sendInitialState();
      }
    } catch (error) {
      this.logger?.error('Error initializing workspace', error);
      if (this._view) {
        this._view.webview.postMessage({
          type: 'response',
          id: messageId,
          success: false,
          error: error instanceof Error ? error.message : 'Failed to initialize workspace'
        });
      }
    }
  }

  private async handleContextSetActive(messageId: string, payload: any): Promise<void> {
    this.logger?.debug('Setting active context:', { contextId: payload.contextId });

    // TODO: Implement context activation
    // For now, this is just for frontend filtering - no backend state needed yet

    if (this._view) {
      this._view.webview.postMessage({
        type: 'response',
        id: messageId,
        success: true
      });
    }
  }

  private async handleContextCreate(messageId: string, _payload: any): Promise<void> {
    this.logger?.info('Creating new context');

    try {
      // TODO: Implement context creation
      // 1. Show context creation dialog
      // 2. Add context to workspace.json
      // 3. Create context-specific templates
      // 4. Refresh Navigator

      this.logger?.warn('Context creation not yet implemented');

      if (this._view) {
        this._view.webview.postMessage({
          type: 'response',
          id: messageId,
          success: false,
          error: 'Context creation not yet implemented'
        });
      }
    } catch (error) {
      this.logger?.error('Error creating context', error);
      if (this._view) {
        this._view.webview.postMessage({
          type: 'response',
          id: messageId,
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create context'
        });
      }
    }
  }

  private async handleContextDelete(messageId: string, payload: any): Promise<void> {
    this.logger?.info('Deleting context:', { contextId: payload.contextId });

    try {
      // TODO: Implement context deletion
      // 1. Confirm with user
      // 2. Remove from workspace.json
      // 3. Optionally archive codices
      // 4. Refresh Navigator

      this.logger?.warn('Context deletion not yet implemented');

      if (this._view) {
        this._view.webview.postMessage({
          type: 'response',
          id: messageId,
          success: false,
          error: 'Context deletion not yet implemented'
        });
      }
    } catch (error) {
      this.logger?.error('Error deleting context', error);
      if (this._view) {
        this._view.webview.postMessage({
          type: 'response',
          id: messageId,
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete context'
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
