/**
 * Navigator Webview Provider
 * Provides the left sidebar navigator view
 */
import * as vscode from 'vscode';
import { VesperaLogger } from '../core/logging/VesperaLogger';
import { BinderyService } from '../services/bindery';

export class NavigatorWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vesperaForge.navigatorView';

  private _view?: vscode.WebviewView;
  private _disposables: vscode.Disposable[] = [];
  private _sessionId: string;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly binderyService: BinderyService,
    private readonly logger?: VesperaLogger,
    private readonly onCodexSelected?: (codexId: string) => void
  ) {
    this._sessionId = `vespera_navigator_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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
  <div id="root"></div>

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

      default:
        this.logger?.debug('Unhandled navigator message', { type: message.type });
    }
  }

  private async sendInitialState(): Promise<void> {
    if (!this._view) return;

    try {
      // Check if Bindery is connected
      if (!this.binderyService.isConnected()) {
        this.logger?.warn('Bindery not connected, attempting to initialize...');
        const initResult = await this.binderyService.initialize();
        if (!initResult.success) {
          this.logger?.error('Failed to initialize Bindery', initResult.error);
          // Send empty state
          this._view.webview.postMessage({
            type: 'initialState',
            payload: { codices: [], templates: [] }
          });
          return;
        }
        // Wait a bit for connection to fully establish after initialization
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Verify connection is ready before making requests
      if (!this.binderyService.isConnected()) {
        this.logger?.warn('Connection not ready yet, sending empty state');
        this._view.webview.postMessage({
          type: 'initialState',
          payload: { codices: [], templates: [] }
        });
        return;
      }

      // Load codices from Bindery
      const codicesResult = await this.binderyService.listCodeices();

      // Default templates until Bindery supports template management
      const defaultTemplates = [
        { id: 'note', name: 'Note', description: 'Simple note or document' },
        { id: 'task', name: 'Task', description: 'Task or todo item' },
        { id: 'project', name: 'Project', description: 'Project container' },
        { id: 'character', name: 'Character', description: 'Character profile' },
        { id: 'scene', name: 'Scene', description: 'Scene or chapter' },
        { id: 'location', name: 'Location', description: 'Place or setting' }
      ];

      const codexData = {
        codices: codicesResult.success ? codicesResult.data : [],
        templates: defaultTemplates
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
      const result = await this.binderyService.createCodex(
        payload.title,
        payload.templateId || 'default'
      );

      if (this._view) {
        if (result.success) {
          this._view.webview.postMessage({
            type: 'response',
            id: messageId,
            success: true,
            result: { id: result.data, ...payload }
          });

          // Refresh the navigator to show the new codex
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

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  public dispose(): void {
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
