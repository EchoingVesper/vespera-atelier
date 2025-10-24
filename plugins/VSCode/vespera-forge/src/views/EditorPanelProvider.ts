/**
 * Editor Panel Provider
 * Provides the main editor area panel with Editor + AI Assistant
 */
import * as vscode from 'vscode';
import { VesperaLogger } from '../core/logging/VesperaLogger';
import { BinderyService } from '../services/bindery';
import { TemplateInitializer } from '../services/template-initializer';

export class EditorPanelProvider {
  private static currentPanel: EditorPanelProvider | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _activeCodexId?: string;
  private _templateInitializer: TemplateInitializer;

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
    private readonly binderyService: BinderyService,
    private readonly logger?: VesperaLogger
  ) {
    this._templateInitializer = new TemplateInitializer(logger);
    this._panel = panel;

    // Set HTML content
    this._panel.webview.html = this.getHtmlContent(this._panel.webview);

    // Setup message handling
    this.setupMessageHandling();

    // Handle panel disposal
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle visibility changes
    this._panel.onDidChangeViewState(
      () => {
        if (this._panel.visible) {
          this.logger?.debug('Editor panel became visible');
        }
      },
      null,
      this._disposables
    );

    this.logger?.info('Editor panel created');
  }

  public static createOrShow(
    context: vscode.ExtensionContext,
    binderyService: BinderyService,
    logger?: VesperaLogger,
    codexId?: string
  ): EditorPanelProvider {
    const column = vscode.ViewColumn.One;

    // If we already have a panel, show it
    if (EditorPanelProvider.currentPanel) {
      EditorPanelProvider.currentPanel._panel.reveal(column);
      if (codexId) {
        EditorPanelProvider.currentPanel.setActiveCodex(codexId);
      }
      return EditorPanelProvider.currentPanel;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'vesperaForgeEditor',
      'Vespera Forge',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview'),
          context.extensionUri
        ]
      }
    );

    EditorPanelProvider.currentPanel = new EditorPanelProvider(panel, context, binderyService, logger);

    if (codexId) {
      EditorPanelProvider.currentPanel.setActiveCodex(codexId);
    }

    return EditorPanelProvider.currentPanel;
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
    this.logger?.debug('Editor: Current connection status', { status: connectionInfo.status });

    // If disconnected, try to initialize
    if (connectionInfo.status === 'disconnected') {
      this.logger?.info('Editor: Bindery disconnected, attempting to initialize...');
      const initResult = await this.binderyService.initialize();
      if (!initResult.success) {
        this.logger?.error('Editor: Failed to initialize Bindery', initResult.error);
        return false;
      }
    }

    // Wait for status to become 'connected' or timeout
    return new Promise<boolean>((resolve) => {
      const timeoutHandle = setTimeout(() => {
        this.binderyService.removeListener('statusChanged', statusListener);
        this.logger?.warn('Editor: Timeout waiting for Bindery connection');
        resolve(false);
      }, timeoutMs);

      const statusListener = (info: any) => {
        this.logger?.debug('Editor: Connection status changed', { status: info.status });
        if (info.status === 'connected') {
          clearTimeout(timeoutHandle);
          this.binderyService.removeListener('statusChanged', statusListener);
          resolve(true);
        } else if (info.status === 'error' || info.status === 'no_workspace') {
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

  public async setActiveCodex(codexId: string): Promise<void> {
    this._activeCodexId = codexId;

    // Wait for Bindery connection to be ready
    const connected = await this.waitForConnection(5000);
    if (!connected) {
      this.logger?.error('Editor: Could not establish Bindery connection for loading Codex');
      vscode.window.showErrorMessage('Could not connect to Bindery service. Please try again.');
      return;
    }

    // Fetch the actual codex data from Bindery
    try {
      const result = await this.binderyService.getCodex(codexId);
      console.log('[EditorPanelProvider] getCodex result:', JSON.stringify(result, null, 2));

      if (result.success) {
        const data = result.data as any;
        console.log('[EditorPanelProvider] Codex data from Bindery:', JSON.stringify(data, null, 2));

        // Transform to UI format (same as Navigator)
        const codex = {
          id: data.id,
          name: data.title,
          templateId: data.template_id,
          metadata: {
            id: data.id,
            title: data.title,
            template_id: data.template_id,
            created_at: data.created_at,
            updated_at: data.updated_at,
            projectId: data.project_id || data.metadata?.projectId,
            tags: data.tags || [],
            references: data.references || []
          },
          content: data.content || { fields: {} }
        };

        // Load full templates
        const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
        let templates: any[] = [];
        if (workspaceUri) {
          templates = await this._templateInitializer.loadFullTemplates(workspaceUri);
          console.log('[EditorPanelProvider] Loaded templates:', templates.map(t => ({ id: t.id, name: t.name })));
        }

        const message = {
          type: 'setActiveCodex',
          payload: { codex, templates }
        };
        console.log('[EditorPanelProvider] Sending message to webview:', JSON.stringify(message, null, 2));
        this._panel.webview.postMessage(message);

        this.logger?.info('Set active codex in editor', { codexId });
      } else {
        this.logger?.error('Failed to fetch codex for editor', result.error);
        this._panel.webview.postMessage({
          type: 'error',
          error: 'Failed to load codex: ' + result.error.message
        });
      }
    } catch (error) {
      this.logger?.error('Error fetching codex for editor', error);
      this._panel.webview.postMessage({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error loading codex'
      });
    }
  }

  private getHtmlContent(webview: vscode.Webview): string {
    // Get URIs for script
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'editor.js')
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

  <title>Vespera Forge Editor</title>

  <!-- Styles will be injected by webpack style-loader -->
</head>
<body>
  <div id="root"></div>

  <!-- React app bundle -->
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private setupMessageHandling(): void {
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        try {
          await this.handleMessage(message);
        } catch (error) {
          this.logger?.error('Error handling editor panel message', error);

          // Send error back to webview
          this._panel.webview.postMessage({
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
    this.logger?.debug('Received message from editor panel', { type: message.type });

    switch (message.type) {
      case 'ready':
        // Editor panel is ready, send initial state
        await this.sendInitialState();
        break;

      case 'codex.update':
        await this.handleCodexUpdate(message.id, message.payload);
        break;

      case 'ai.message':
        await this.handleAIMessage(message.id, message.payload);
        break;

      case 'openFile':
        await this.handleOpenFile(message.payload);
        break;

      case 'saveFile':
        await this.handleSaveFile(message.id, message.payload);
        break;

      default:
        this.logger?.debug('Unhandled editor panel message', { type: message.type });
    }
  }

  private async sendInitialState(): Promise<void> {
    // Load templates first
    const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
    let templates: Array<{ id: string; name: string; description: string }> = [];
    if (workspaceUri) {
      templates = await this._templateInitializer.loadTemplates(workspaceUri);
    }

    // If we have an active codex, load it
    if (this._activeCodexId) {
      await this.setActiveCodex(this._activeCodexId);
    } else {
      // Send empty state with templates
      this._panel.webview.postMessage({
        type: 'initialState',
        payload: {
          codex: undefined,
          templates,
          assistants: []
        }
      });
    }
  }

  private async handleCodexUpdate(messageId: string, payload: any): Promise<void> {
    this.logger?.debug('Updating codex', { id: payload.id });

    try {
      // Transform UI format to Bindery format
      const binderyPayload = {
        title: payload.name || payload.metadata?.title,
        content: payload.content,
        template_id: payload.templateId || payload.metadata?.template_id,
        tags: payload.metadata?.tags || [],
        references: payload.metadata?.references || []
      };

      // Update codex via Bindery
      const result = await this.binderyService.updateCodex(payload.id, binderyPayload);

      if (result.success) {
        this.logger?.info('Codex updated successfully', { id: payload.id });

        this._panel.webview.postMessage({
          type: 'response',
          id: messageId,
          success: true,
          result: result.data
        });
      } else {
        const errorMsg = typeof result.error === 'string' ? result.error : result.error?.message || 'Update failed';
        throw new Error(errorMsg);
      }
    } catch (error) {
      this.logger?.error('Failed to update codex', error);

      this._panel.webview.postMessage({
        type: 'response',
        id: messageId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async handleAIMessage(messageId: string, payload: any): Promise<void> {
    // TODO: Implement AI message handling
    this.logger?.debug('AI message', payload);

    // Mock AI response
    const response = "I understand you're working on that. Let me help you think through it.";

    this._panel.webview.postMessage({
      type: 'ai.response',
      id: messageId,
      payload: { response }
    });
  }

  private async handleOpenFile(payload: any): Promise<void> {
    const uri = vscode.Uri.file(payload.path);
    await vscode.window.showTextDocument(uri);
  }

  private async handleSaveFile(messageId: string, payload: any): Promise<void> {
    try {
      const uri = vscode.Uri.file(payload.path);
      const content = Buffer.from(payload.content, 'utf8');
      await vscode.workspace.fs.writeFile(uri, content);

      this._panel.webview.postMessage({
        type: 'response',
        id: messageId,
        success: true
      });
    } catch (error) {
      this._panel.webview.postMessage({
        type: 'response',
        id: messageId,
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save file'
      });
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
    this.logger?.info('Disposing Editor panel');
    EditorPanelProvider.currentPanel = undefined;

    // Remove all event listeners from Bindery service to prevent memory leaks
    this.binderyService.removeAllListeners('statusChanged');
    this.logger?.debug('Removed all statusChanged listeners from Bindery');

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
