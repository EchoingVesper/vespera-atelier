/**
 * Vespera Forge WebView Provider
 * Hosts the React-based three-panel UI framework in a VS Code webview
 */
import * as vscode from 'vscode';
import { VesperaLogger } from '../core/logging/VesperaLogger';

export class VesperaForgeWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vesperaForge.mainView';

  private _view?: vscode.WebviewView;
  private _disposables: vscode.Disposable[] = [];
  private _sessionId: string;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logger?: VesperaLogger
  ) {
    this._sessionId = `vespera_forge_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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

    this.logger?.info('Vespera Forge WebView resolved successfully', {
      sessionId: this._sessionId
    });
  }

  private getHtmlContent(webview: vscode.Webview): string {
    // Get URIs for script
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'index.js')
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

  <title>Vespera Forge</title>

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
          this.logger?.error('Error handling webview message', error);

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
    this.logger?.debug('Received message from webview', { type: message.type });

    switch (message.type) {
      case 'ready':
        // Webview is ready, send initial state
        await this.sendInitialState();
        break;

      case 'openFile':
        await this.handleOpenFile(message.payload);
        break;

      case 'saveFile':
        await this.handleSaveFile(message.id, message.payload);
        break;

      case 'showNotification':
        this.handleShowNotification(message.payload);
        break;

      case 'showInformationMessage':
        await this.handleShowInformationMessage(message.id, message.payload);
        break;

      case 'showErrorMessage':
        await this.handleShowErrorMessage(message.id, message.payload);
        break;

      case 'getWorkspaceFolders':
        await this.handleGetWorkspaceFolders(message.id);
        break;

      // Codex operations
      case 'codex.create':
        await this.handleCodexCreate(message.id, message.payload);
        break;

      case 'codex.update':
        await this.handleCodexUpdate(message.id, message.payload);
        break;

      case 'codex.delete':
        await this.handleCodexDelete(message.id, message.payload);
        break;

      case 'codex.list':
        await this.handleCodexList(message.id, message.payload);
        break;

      default:
        this.logger?.warn('Unknown message type', { type: message.type });
    }
  }

  private async sendInitialState(): Promise<void> {
    if (!this._view) return;

    const workspaceFolders = vscode.workspace.workspaceFolders?.map(folder => ({
      name: folder.name,
      uri: folder.uri.fsPath
    })) || [];

    this._view.webview.postMessage({
      type: 'initialState',
      payload: {
        workspaceFolders,
        theme: this.getCurrentTheme(),
        sessionId: this._sessionId
      }
    });
  }

  private getCurrentTheme(): string {
    const theme = vscode.window.activeColorTheme;
    switch (theme.kind) {
      case vscode.ColorThemeKind.Dark:
      case vscode.ColorThemeKind.HighContrast:
        return 'dark';
      case vscode.ColorThemeKind.Light:
        return 'light';
      default:
        return 'dark';
    }
  }

  // File operations
  private async handleOpenFile(payload: { path: string }): Promise<void> {
    const uri = vscode.Uri.file(payload.path);
    await vscode.window.showTextDocument(uri);
  }

  private async handleSaveFile(messageId: string, payload: { path: string; content: string }): Promise<void> {
    try {
      const uri = vscode.Uri.file(payload.path);
      const encoder = new TextEncoder();
      await vscode.workspace.fs.writeFile(uri, encoder.encode(payload.content));

      this._view?.webview.postMessage({
        type: 'response',
        id: messageId,
        success: true
      });
    } catch (error) {
      this._view?.webview.postMessage({
        type: 'response',
        id: messageId,
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save file'
      });
    }
  }

  // Notification handlers
  private handleShowNotification(payload: { message: string; type: 'info' | 'warning' | 'error' }): void {
    switch (payload.type) {
      case 'info':
        vscode.window.showInformationMessage(payload.message);
        break;
      case 'warning':
        vscode.window.showWarningMessage(payload.message);
        break;
      case 'error':
        vscode.window.showErrorMessage(payload.message);
        break;
    }
  }

  private async handleShowInformationMessage(messageId: string, payload: { message: string; items: string[] }): Promise<void> {
    const result = await vscode.window.showInformationMessage(payload.message, ...payload.items);

    this._view?.webview.postMessage({
      type: 'response',
      id: messageId,
      result
    });
  }

  private async handleShowErrorMessage(messageId: string, payload: { message: string; items: string[] }): Promise<void> {
    const result = await vscode.window.showErrorMessage(payload.message, ...payload.items);

    this._view?.webview.postMessage({
      type: 'response',
      id: messageId,
      result
    });
  }

  private async handleGetWorkspaceFolders(messageId: string): Promise<void> {
    const folders = vscode.workspace.workspaceFolders?.map(folder => folder.uri.fsPath) || [];

    this._view?.webview.postMessage({
      type: 'response',
      id: messageId,
      result: folders
    });
  }

  // Codex operations (TODO: Implement actual Codex integration)
  private async handleCodexCreate(messageId: string, payload: any): Promise<void> {
    // TODO: Integrate with Bindery backend
    this.logger?.info('Codex create requested', { payload });

    this._view?.webview.postMessage({
      type: 'response',
      id: messageId,
      success: true,
      result: { id: `codex_${Date.now()}`, ...payload }
    });
  }

  private async handleCodexUpdate(messageId: string, payload: any): Promise<void> {
    // TODO: Integrate with Bindery backend
    this.logger?.info('Codex update requested', { payload });

    this._view?.webview.postMessage({
      type: 'response',
      id: messageId,
      success: true,
      result: payload
    });
  }

  private async handleCodexDelete(messageId: string, payload: any): Promise<void> {
    // TODO: Integrate with Bindery backend
    this.logger?.info('Codex delete requested', { payload });

    this._view?.webview.postMessage({
      type: 'response',
      id: messageId,
      success: true
    });
  }

  private async handleCodexList(messageId: string, payload: any): Promise<void> {
    // TODO: Integrate with Bindery backend
    this.logger?.info('Codex list requested', { payload });

    // Return empty list for now
    this._view?.webview.postMessage({
      type: 'response',
      id: messageId,
      success: true,
      result: []
    });
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
    this.logger?.info('Disposing Vespera Forge WebView', { sessionId: this._sessionId });

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      disposable?.dispose();
    }

    this._view = undefined;
  }
}
