/**
 * Editor Panel Provider
 * Provides the main editor area panel with Editor + AI Assistant
 */
import * as vscode from 'vscode';
import { VesperaLogger } from '../core/logging/VesperaLogger';

export class EditorPanelProvider {
  private static currentPanel: EditorPanelProvider | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _activeCodexId?: string;

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
    private readonly logger?: VesperaLogger
  ) {
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

    EditorPanelProvider.currentPanel = new EditorPanelProvider(panel, context, logger);

    if (codexId) {
      EditorPanelProvider.currentPanel.setActiveCodex(codexId);
    }

    return EditorPanelProvider.currentPanel;
  }

  public setActiveCodex(codexId: string): void {
    this._activeCodexId = codexId;
    this._panel.webview.postMessage({
      type: 'setActiveCodex',
      payload: { codexId }
    });
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
    // TODO: Load actual data from storage
    const mockData = {
      codexId: this._activeCodexId,
      templates: [],
      assistants: []
    };

    this._panel.webview.postMessage({
      type: 'initialState',
      payload: mockData
    });
  }

  private async handleCodexUpdate(messageId: string, payload: any): Promise<void> {
    // TODO: Implement codex update
    this.logger?.debug('Update codex', payload);

    this._panel.webview.postMessage({
      type: 'response',
      id: messageId,
      success: true,
      result: payload
    });
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
    EditorPanelProvider.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
