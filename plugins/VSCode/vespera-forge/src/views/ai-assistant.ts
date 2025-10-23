/**
 * AI Assistant WebView Provider - Auxiliary panel for AI chat
 * This is a simplified version focused on chat functionality in the right sidebar
 */

import * as vscode from 'vscode';
import { VesperaChatSystem } from '../chat';

export class AIAssistantWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vespera-forge.aiAssistant';

  private _view?: vscode.WebviewView;
  private _chatSystem?: VesperaChatSystem;
  private _activeChannel?: any; // Current active channel

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext
  ) {
    // Store reference globally for commands
    (global as any).vesperaAIAssistantProvider = this;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    // Configure webview
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    // Initialize chat system
    this.initializeChatSystem();

    // Set initial HTML content
    this.updateWebviewContent();

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(
      async (message) => {
        await this.handleWebviewMessage(message);
      },
      undefined,
      this._context.subscriptions
    );

    // Handle disposal
    webviewView.onDidDispose(() => {
      this._view = undefined;
      this._chatSystem?.dispose();
    });

    // Handle visibility changes
    webviewView.onDidChangeVisibility(() => {
      if (this._chatSystem) {
        if (webviewView.visible) {
          this._chatSystem.handleViewVisible();
        } else {
          this._chatSystem.handleViewHidden();
        }
      }
    });

    console.log('[AIAssistant] AI Assistant panel initialized');
  }

  private async initializeChatSystem() {
    try {
      // Initialize chat system in embedded mode (skip webview registration since we're already a webview)
      this._chatSystem = new VesperaChatSystem(this._extensionUri, this._context, {
        skipWebviewRegistration: true,
        skipCommandRegistration: true  // Commands are registered by extension.ts
      });
      await this._chatSystem.initialize();

      // Note: Provider initialization is now handled by Bindery backend
      // The chat system will use the default Claude Code provider
      console.log('[AIAssistant] Chat system initialized (providers managed by Bindery)');
    } catch (error) {
      console.error('[AIAssistant] Failed to initialize chat system:', error);
      vscode.window.showErrorMessage(`Failed to initialize AI Assistant: ${error}`);
    }
  }

  private async handleWebviewMessage(message: any) {
    switch (message.command) {
      case 'sendMessage':
        await this.handleSendMessage(message.text);
        break;
      case 'requestClearHistory':
        // Show confirmation dialog on extension side (not in webview sandbox)
        const confirmed = await vscode.window.showWarningMessage(
          'Clear chat history?',
          { modal: true },
          'Clear'
        );
        if (confirmed === 'Clear') {
          await this.clearHistory();
        }
        break;
      case 'clearHistory':
        await this.clearHistory();
        break;
      case 'ready':
        await this.updateWebviewContent();
        break;
    }
  }

  private async handleSendMessage(text: string) {
    if (!this._chatSystem || !text?.trim()) {
      return;
    }

    try {
      this.sendMessageToWebview({
        command: 'addMessage',
        message: {
          id: `user_${Date.now()}`,
          role: 'user',
          content: text.trim(),
          timestamp: new Date().toISOString()
        }
      });

      const userMessage = {
        id: `user_${Date.now()}`,
        role: 'user' as const,
        content: text.trim(),
        timestamp: new Date(),
        threadId: 'default'
      };

      const responseId = `assistant_${Date.now()}`;
      let responseContent = '';

      this.sendMessageToWebview({
        command: 'addMessage',
        message: {
          id: responseId,
          role: 'assistant',
          content: '',
          timestamp: new Date().toISOString(),
          streaming: true
        }
      });

      for await (const chunk of this._chatSystem.streamMessage(userMessage)) {
        if (chunk.content && !chunk.done) {
          responseContent += chunk.content;
          this.sendMessageToWebview({
            command: 'updateMessage',
            messageId: responseId,
            content: responseContent,
            streaming: true
          });
        } else if (chunk.done) {
          if (chunk.content) {
            responseContent += chunk.content;
          }
          this.sendMessageToWebview({
            command: 'updateMessage',
            messageId: responseId,
            content: responseContent || 'No response received',
            streaming: false
          });
          break;
        }
      }
    } catch (error) {
      console.error('[AIAssistant] Error sending message:', error);
      vscode.window.showErrorMessage(`Chat error: ${error}`);
    }
  }

  private sendMessageToWebview(message: any) {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  public async clearHistory() {
    try {
      if (this._chatSystem) {
        await this._chatSystem.clearHistory();
        this.sendMessageToWebview({ command: 'clearHistory' });
        vscode.window.showInformationMessage('Chat history cleared.');
      }
    } catch (error) {
      console.error('[AIAssistant] Failed to clear history:', error);
      vscode.window.showErrorMessage(`Failed to clear history: ${error}`);
    }
  }

  public refresh() {
    this.updateWebviewContent();
  }

  public dispose() {
    if (this._chatSystem) {
      this._chatSystem.dispose();
      this._chatSystem = undefined;
    }
    this._view = undefined;
  }

  private async updateWebviewContent() {
    if (!this._view) {
      return;
    }

    this._view.webview.html = this.getChatInterfaceHtml();
  }

  /**
   * Switch to a different chat channel
   */
  public async switchChannel(channel: any): Promise<void> {
    this._activeChannel = channel;
    console.log('[AIAssistant] Switched to channel:', channel.title);

    // Clear current chat history UI
    this.sendMessageToWebview({
      command: 'clearHistory'
    });

    // Update header with channel name
    this.sendMessageToWebview({
      command: 'updateChannelInfo',
      channelName: channel.title,
      channelStatus: channel.status
    });

    // TODO: Load messages from channel Codex
    // const messages = await this.loadChannelMessages(channel.id);
    // for (const msg of messages) {
    //   this.sendMessageToWebview({ command: 'addMessage', message: msg });
    // }
  }

  /**
   * Get the active channel
   */
  public getActiveChannel(): any | undefined {
    return this._activeChannel;
  }

  private getChatInterfaceHtml(): string {
    const channelName = this._activeChannel?.title || 'AI Assistant';

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AI Assistant</title>
        <style>
            body {
                font-family: var(--vscode-font-family);
                background: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
                margin: 0;
                padding: 0;
                height: 100vh;
                display: flex;
                flex-direction: column;
            }

            .chat-header {
                background: var(--vscode-sideBar-background);
                color: var(--vscode-sideBar-foreground);
                padding: 10px 15px;
                border-bottom: 1px solid var(--vscode-panel-border);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .chat-title {
                font-weight: bold;
                font-size: 14px;
            }

            .action-btn {
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 4px 8px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
            }

            .action-btn:hover {
                background: var(--vscode-button-hoverBackground);
            }

            .messages-container {
                flex: 1;
                overflow-y: auto;
                padding: 15px;
                display: flex;
                flex-direction: column;
                gap: 15px;
            }

            .message {
                max-width: 90%;
                padding: 10px 12px;
                border-radius: 8px;
                line-height: 1.4;
                font-size: 13px;
            }

            .message.user {
                align-self: flex-end;
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
            }

            .message.assistant {
                align-self: flex-start;
                background: var(--vscode-textBlockQuote-background);
                border-left: 4px solid var(--vscode-textBlockQuote-border);
            }

            .message-time {
                font-size: 10px;
                opacity: 0.7;
                margin-top: 5px;
            }

            .streaming-indicator {
                display: inline-block;
                width: 8px;
                height: 8px;
                background: var(--vscode-progressBar-background);
                border-radius: 50%;
                margin-left: 5px;
                animation: pulse 1.5s infinite;
            }

            @keyframes pulse {
                0%, 100% { opacity: 0.4; }
                50% { opacity: 1; }
            }

            .input-container {
                border-top: 1px solid var(--vscode-panel-border);
                padding: 12px 15px;
                display: flex;
                gap: 10px;
                align-items: flex-end;
            }

            .message-input {
                flex: 1;
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                border-radius: 4px;
                padding: 8px 12px;
                font-family: inherit;
                font-size: 13px;
                resize: none;
                min-height: 20px;
                max-height: 100px;
            }

            .message-input:focus {
                border-color: var(--vscode-focusBorder);
                outline: none;
            }

            .send-btn {
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
                font-weight: bold;
            }

            .send-btn:hover:not(:disabled) {
                background: var(--vscode-button-hoverBackground);
            }

            .send-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }

            .empty-state {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: var(--vscode-descriptionForeground);
                text-align: center;
                padding: 30px;
            }

            .empty-icon {
                font-size: 48px;
                margin-bottom: 20px;
                opacity: 0.6;
            }

            .empty-state h3 {
                margin: 0 0 12px 0;
                font-size: 18px;
            }

            .empty-state p {
                margin: 0;
                line-height: 1.5;
            }
        </style>
    </head>
    <body>
        <div class="chat-header">
            <div class="chat-title" id="channelTitle">🤖 ${channelName}</div>
            <button class="action-btn" onclick="clearHistory()">Clear</button>
        </div>

        <div class="messages-container" id="messages">
            <div class="empty-state">
                <div class="empty-icon">💬</div>
                <h3>AI Assistant</h3>
                <p>Ask me anything!</p>
            </div>
        </div>

        <div class="input-container">
            <textarea
                class="message-input"
                id="messageInput"
                placeholder="Type your message..."
                rows="1"
            ></textarea>
            <button class="send-btn" id="sendBtn" onclick="sendMessage()">Send</button>
        </div>

        <script>
            const vscode = acquireVsCodeApi();
            const messagesContainer = document.getElementById('messages');
            const messageInput = document.getElementById('messageInput');
            const sendBtn = document.getElementById('sendBtn');

            messageInput.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = Math.min(this.scrollHeight, 100) + 'px';
            });

            messageInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });

            function sendMessage() {
                const text = messageInput.value.trim();
                if (!text) return;

                vscode.postMessage({
                    command: 'sendMessage',
                    text: text
                });

                messageInput.value = '';
                messageInput.style.height = 'auto';
                sendBtn.disabled = true;
                sendBtn.textContent = 'Sending...';
            }

            function addMessage(message) {
                const emptyState = messagesContainer.querySelector('.empty-state');
                if (emptyState) {
                    emptyState.remove();
                }

                const messageEl = document.createElement('div');
                messageEl.className = 'message ' + message.role;
                messageEl.id = message.id;

                const content = document.createElement('div');
                content.textContent = message.content;
                messageEl.appendChild(content);

                const time = document.createElement('div');
                time.className = 'message-time';
                time.textContent = new Date(message.timestamp).toLocaleTimeString();
                if (message.streaming) {
                    const indicator = document.createElement('span');
                    indicator.className = 'streaming-indicator';
                    time.appendChild(indicator);
                }
                messageEl.appendChild(time);

                messagesContainer.appendChild(messageEl);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }

            function updateMessage(messageId, content, streaming) {
                const messageEl = document.getElementById(messageId);
                if (messageEl) {
                    const contentEl = messageEl.firstChild;
                    contentEl.textContent = content;

                    const timeEl = messageEl.querySelector('.message-time');
                    const indicator = timeEl.querySelector('.streaming-indicator');
                    if (!streaming && indicator) {
                        indicator.remove();
                    }
                }

                if (!streaming) {
                    sendBtn.disabled = false;
                    sendBtn.textContent = 'Send';
                }

                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }

            function clearHistory() {
                // Request confirmation from extension host (confirm() is blocked in webview sandbox)
                vscode.postMessage({ command: 'requestClearHistory' });
            }

            function updateChannelInfo(channelName, channelStatus) {
                const titleEl = document.getElementById('channelTitle');
                if (titleEl) {
                    const statusIcon = channelStatus === 'active' ? '🟢' :
                                     channelStatus === 'idle' ? '🟡' :
                                     channelStatus === 'archived' ? '⚪' : '';
                    titleEl.textContent = \`\${statusIcon} \${channelName}\`;
                }
            }

            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.command) {
                    case 'addMessage':
                        addMessage(message.message);
                        break;
                    case 'updateMessage':
                        updateMessage(message.messageId, message.content, message.streaming);
                        break;
                    case 'clearHistory':
                        messagesContainer.innerHTML = \`
                            <div class="empty-state">
                                <div class="empty-icon">💬</div>
                                <h3>AI Assistant</h3>
                                <p>Ask me anything!</p>
                            </div>
                        \`;
                        break;
                    case 'updateChannelInfo':
                        updateChannelInfo(message.channelName, message.channelStatus);
                        break;
                }
            });

            vscode.postMessage({ command: 'ready' });
        </script>
    </body>
    </html>`;
  }
}
