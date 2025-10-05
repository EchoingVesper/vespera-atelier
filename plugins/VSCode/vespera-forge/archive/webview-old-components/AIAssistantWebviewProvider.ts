/**
 * AI Assistant Webview Provider
 * Provides the right sidebar AI assistant chat view
 */
import * as vscode from 'vscode';
import { VesperaLogger } from '../core/logging/VesperaLogger';

export class AIAssistantWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vesperaForge.aiAssistantView';

  private _view?: vscode.WebviewView;
  private _disposables: vscode.Disposable[] = [];
  private _sessionId: string;
  private _activeCodexId?: string;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logger?: VesperaLogger
  ) {
    this._sessionId = `vespera_ai_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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

    this.logger?.info('AI Assistant WebView resolved successfully', {
      sessionId: this._sessionId
    });
  }

  public setActiveCodex(codexId: string): void {
    this._activeCodexId = codexId;
    if (this._view) {
      this._view.webview.postMessage({
        type: 'setActiveCodex',
        payload: { codexId }
      });
    }
  }

  private getHtmlContent(webview: vscode.Webview): string {
    // Get URIs for script
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'ai-assistant.js')
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

  <title>AI Assistant</title>

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
          this.logger?.error('Error handling AI assistant message', error);

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
    this.logger?.debug('Received message from AI assistant', { type: message.type });

    switch (message.type) {
      case 'ready':
        // AI assistant is ready, send initial state
        await this.sendInitialState();
        break;

      case 'ai.message':
        // User sent a message to AI
        await this.handleAIMessage(message.id, message.payload);
        break;

      case 'ai.clearHistory':
        // Clear conversation history
        await this.handleClearHistory(message.id);
        break;

      default:
        this.logger?.debug('Unhandled AI assistant message', { type: message.type });
    }
  }

  private async sendInitialState(): Promise<void> {
    if (!this._view) return;

    // TODO: Load actual assistants and context from storage
    const mockData = {
      activeCodexId: this._activeCodexId,
      assistants: [],
      context: {}
    };

    this._view.webview.postMessage({
      type: 'initialState',
      payload: mockData
    });
  }

  private async handleAIMessage(messageId: string, payload: any): Promise<void> {
    // TODO: Implement actual AI message handling
    this.logger?.debug('AI message', payload);

    // Mock AI response
    const response = "I understand you're working on that. Let me help you think through it.";

    if (this._view) {
      this._view.webview.postMessage({
        type: 'ai.response',
        id: messageId,
        payload: { response }
      });
    }
  }

  private async handleClearHistory(messageId: string): Promise<void> {
    // TODO: Implement history clearing
    this.logger?.debug('Clear AI history');

    if (this._view) {
      this._view.webview.postMessage({
        type: 'response',
        id: messageId,
        success: true
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
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
