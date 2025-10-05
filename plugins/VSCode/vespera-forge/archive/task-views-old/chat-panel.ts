/**
 * Chat Panel WebView Provider - Full implementation connecting to VesperaChatSystem
 * Integrates the comprehensive chat system with VS Code views
 */

import * as vscode from 'vscode';
import { VesperaChatSystem } from '../chat';
import { CLAUDE_CODE_TEMPLATE, createDefaultConfig } from '../chat/templates/providers/index';
import { ProviderConfig } from '../chat/types/provider';

export class ChatPanelWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vespera-forge.chatPanel';
  
  private _view?: vscode.WebviewView;
  private _chatSystem?: VesperaChatSystem;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext
  ) {}

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

    console.log('[ChatPanel] Chat panel initialized');
  }

  /**
   * Initialize the chat system with Claude Code provider as default
   */
  private async initializeChatSystem() {
    try {
      // Create chat system instance
      this._chatSystem = new VesperaChatSystem(this._extensionUri, this._context);
      await this._chatSystem.initialize();
      
      // Get saved configuration from ConfigurationManager first
      const configManager = this._chatSystem.getConfigurationManager();
      const savedProviderEntry = configManager.getConfiguration().providers['claude-code'];
      
      console.log('[ChatPanel] Loaded saved claude-code provider entry:', JSON.stringify(savedProviderEntry, null, 2));
      
      // Extract the actual config or use defaults
      let providerConfig: ProviderConfig;
      if (savedProviderEntry && savedProviderEntry.config) {
        console.log('[ChatPanel] Using saved provider config');
        providerConfig = savedProviderEntry.config;
      } else {
        console.log('[ChatPanel] No saved config found, using defaults');
        providerConfig = createDefaultConfig(CLAUDE_CODE_TEMPLATE);
      }
      
      // Create provider with saved configuration (or defaults if none exist)
      const claudeProvider = await this._chatSystem.createAndRegisterProvider('claude-code', CLAUDE_CODE_TEMPLATE, providerConfig);
      
      // Connect the provider
      await claudeProvider.connect();
      
      // Set as active provider (this also sets up event listeners as fallback)
      await this._chatSystem.setActiveProvider('claude-code', claudeProvider);
      
      console.log('[ChatPanel] Chat system initialized with Claude Code provider');
    } catch (error) {
      console.error('[ChatPanel] Failed to initialize chat system:', error);
      vscode.window.showErrorMessage(`Failed to initialize chat system: ${error}`);
    }
  }

  /**
   * Handle messages from the webview
   */
  private async handleWebviewMessage(message: any) {
    switch (message.command) {
      case 'sendMessage':
        await this.handleSendMessage(message.text);
        break;
      case 'openProviderConfig':
        await this.openProviderConfiguration();
        break;
      case 'clearHistory':
        await this.clearHistory();
        break;
      case 'toggleFileContext':
        await this.toggleFileContext();
        break;
      case 'showContextInfo':
        await this.showContextInfo();
        break;
      case 'ready':
        await this.updateWebviewContent();
        break;
      // Session management commands
      case 'createSession':
        await this.createNewSession(message.title);
        break;
      case 'switchSession':
        await this.switchSession(message.sessionId);
        break;
      case 'updateSessionTitle':
        await this.updateSessionTitle(message.sessionId, message.title);
        break;
      case 'toggleSessionPin':
        await this.toggleSessionPin(message.sessionId);
        break;
      case 'deleteSession':
        await this.deleteSession(message.sessionId);
        break;
      case 'exportSessions':
        await this.exportSessions(message.sessionIds, message.format);
        break;
      case 'importSessions':
        await this.importSessions(message.data);
        break;
      case 'searchMessages':
        await this.searchMessages(message.query);
        break;
      case 'loadSessionHistory':
        await this.loadSessionHistory(message.sessionId);
        break;
    }
  }

  /**
   * Handle sending a message through the chat system
   */
  private async handleSendMessage(text: string) {
    if (!this._chatSystem || !text?.trim()) {
      return;
    }

    try {
      // Add user message to UI
      this.sendMessageToWebview({
        command: 'addMessage',
        message: {
          id: `user_${Date.now()}`,
          role: 'user',
          content: text.trim(),
          timestamp: new Date().toISOString()
        }
      });

      // Send to chat system and stream response
      const userMessage = {
        id: `user_${Date.now()}`,
        role: 'user' as const,
        content: text.trim(),
        timestamp: new Date(),
        threadId: 'default'
      };

      const responseId = `assistant_${Date.now()}`;
      let responseContent = '';

      // Start assistant message
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

      // Stream the response
      for await (const chunk of this._chatSystem.streamMessage(userMessage)) {
        // Handle ChatChunk format: { content: string, done: boolean, metadata?: any }
        if (chunk.content && !chunk.done) {
          responseContent += chunk.content;
          this.sendMessageToWebview({
            command: 'updateMessage',
            messageId: responseId,
            content: responseContent,
            streaming: true
          });
        } else if (chunk.done) {
          // Final chunk - may or may not have content
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
        } else if (chunk.metadata?.error) {
          this.sendMessageToWebview({
            command: 'updateMessage',
            messageId: responseId,
            content: chunk.content || 'An error occurred',
            streaming: false,
            error: true
          });
          break;
        }
      }
    } catch (error) {
      console.error('[ChatPanel] Error sending message:', error);
      vscode.window.showErrorMessage(`Chat error: ${error}`);
    }
  }

  /**
   * Send a message to the webview
   */
  private sendMessageToWebview(message: any) {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  /**
   * Open provider configuration panel
   */
  public async openProviderConfiguration() {
    // Get current configuration from chat system
    let currentConfig = null;
    if (this._chatSystem) {
      try {
        // Get the current claude-code provider configuration
        const provider = this._chatSystem.getProvider('claude-code');
        if (provider) {
          currentConfig = provider.getConfig();
          console.log('[ChatPanel] Loading current config for UI:', JSON.stringify(currentConfig, null, 2));
        }
      } catch (error) {
        console.error('[ChatPanel] Failed to get current config:', error);
      }
    }

    const panel = vscode.window.createWebviewPanel(
      'vesperaChatConfig',
      'Chat Provider Configuration',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [this._extensionUri]
      }
    );

    panel.webview.html = this.getConfigurationHtml(currentConfig);
    
    panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'saveConfig':
            await this.saveProviderConfiguration(message.config);
            panel.dispose();
            break;
          case 'testConnection':
            await this.testProviderConnection(message.providerId);
            break;
        }
      },
      undefined,
      this._context.subscriptions
    );
  }

  /**
   * Save provider configuration
   */
  private async saveProviderConfiguration(config: any) {
    try {
      if (this._chatSystem) {
        await this._chatSystem.updateConfiguration(config);
        vscode.window.showInformationMessage('Chat provider configuration saved successfully!');
        this.updateWebviewContent(); // Refresh the chat panel
      }
    } catch (error) {
      console.error('[ChatPanel] Failed to save configuration:', error);
      vscode.window.showErrorMessage(`Failed to save configuration: ${error}`);
    }
  }

  /**
   * Test provider connection
   */
  private async testProviderConnection(providerId: string) {
    try {
      if (this._chatSystem) {
        const result = await this._chatSystem.testConnection(providerId);
        if (result) {
          vscode.window.showInformationMessage('Provider connection test successful!');
        } else {
          vscode.window.showWarningMessage('Provider connection test failed.');
        }
      }
    } catch (error) {
      console.error('[ChatPanel] Connection test failed:', error);
      vscode.window.showErrorMessage(`Connection test failed: ${error}`);
    }
  }

  /**
   * Clear chat history
   */
  public async clearHistory() {
    try {
      if (this._chatSystem) {
        await this._chatSystem.clearHistory();
        this.sendMessageToWebview({ command: 'clearHistory' });
        vscode.window.showInformationMessage('Chat history cleared.');
      }
    } catch (error) {
      console.error('[ChatPanel] Failed to clear history:', error);
      vscode.window.showErrorMessage(`Failed to clear history: ${error}`);
    }
  }

  /**
   * Toggle file context collection
   */
  private async toggleFileContext() {
    try {
      if (this._chatSystem) {
        const provider = this._chatSystem.getProvider('claude-code');
        if (provider && typeof provider.getFileContextStatus === 'function') {
          const status = provider.getFileContextStatus();
          const newState = !status.enabled;
          
          provider.setFileContextEnabled(newState);
          
          this.sendMessageToWebview({ 
            command: 'fileContextToggled', 
            enabled: newState 
          });
          
          vscode.window.showInformationMessage(
            `File context ${newState ? 'enabled' : 'disabled'}`
          );
        }
      }
    } catch (error) {
      console.error('[ChatPanel] Failed to toggle file context:', error);
      vscode.window.showErrorMessage(`Failed to toggle file context: ${error}`);
    }
  }

  /**
   * Show current context information
   */
  private async showContextInfo() {
    try {
      if (this._chatSystem) {
        const provider = this._chatSystem.getProvider('claude-code');
        if (provider && typeof provider.collectContextNow === 'function') {
          const contextItems = await provider.collectContextNow();
          
          if (contextItems.length === 0) {
            vscode.window.showInformationMessage('No file context available from current editor state.');
            return;
          }

          const contextSummary = contextItems.map((item: any) => {
            let summary = `• ${item.type.toUpperCase()}: ${item.filepath}`;
            if (item.startLine && item.endLine) {
              summary += ` (lines ${item.startLine}-${item.endLine})`;
            }
            summary += ` - ${Math.round(item.content.length / 100) / 10}k chars`;
            return summary;
          }).join('\n');

          this.sendMessageToWebview({
            command: 'showContextInfo',
            contextSummary: `Current file context:\n${contextSummary}`
          });
        }
      }
    } catch (error) {
      console.error('[ChatPanel] Failed to show context info:', error);
      vscode.window.showErrorMessage(`Failed to show context info: ${error}`);
    }
  }

  /**
   * Refresh the chat panel
   */
  public refresh() {
    this.updateWebviewContent();
  }

  /**
   * Dispose of the chat panel
   */
  public dispose() {
    if (this._chatSystem) {
      this._chatSystem.dispose();
      this._chatSystem = undefined;
    }
    this._view = undefined;
  }

  // Session Management Methods
  
  /**
   * Create a new chat session
   */
  private async createNewSession(title?: string): Promise<void> {
    if (!this._chatSystem) {
      return;
    }

    try {
      const session = await this._chatSystem.createSession('claude-code', title);
      await this._chatSystem.switchToSession(session.id);
      
      this.sendMessageToWebview({
        command: 'sessionCreated',
        session: {
          id: session.id,
          title: session.title,
          isActive: true,
          isPinned: session.isPinned,
          messageCount: session.messageCount,
          lastActivity: session.lastActivity.toISOString()
        }
      });
      
      // Clear current messages and load session history
      this.sendMessageToWebview({ command: 'clearMessages' });
      await this.loadSessionHistory(session.id);
      
      vscode.window.showInformationMessage(`New session "${session.title}" created`);
    } catch (error) {
      console.error('[ChatPanel] Failed to create session:', error);
      vscode.window.showErrorMessage(`Failed to create session: ${error}`);
    }
  }

  /**
   * Switch to a different session
   */
  private async switchSession(sessionId: string): Promise<void> {
    if (!this._chatSystem) {
      return;
    }

    try {
      const success = await this._chatSystem.switchToSession(sessionId);
      if (success) {
        const session = this._chatSystem.getActiveSession();
        if (session) {
          this.sendMessageToWebview({
            command: 'sessionSwitched',
            sessionId: session.id,
            title: session.title
          });
          
          // Clear current messages and load session history
          this.sendMessageToWebview({ command: 'clearMessages' });
          await this.loadSessionHistory(sessionId);
        }
      }
    } catch (error) {
      console.error('[ChatPanel] Failed to switch session:', error);
      vscode.window.showErrorMessage(`Failed to switch session: ${error}`);
    }
  }

  /**
   * Update session title
   */
  private async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    if (!this._chatSystem) {
      return;
    }

    try {
      const success = await this._chatSystem.updateSessionTitle(sessionId, title);
      if (success) {
        this.sendMessageToWebview({
          command: 'sessionTitleUpdated',
          sessionId,
          title
        });
      }
    } catch (error) {
      console.error('[ChatPanel] Failed to update session title:', error);
      vscode.window.showErrorMessage(`Failed to update session title: ${error}`);
    }
  }

  /**
   * Toggle session pin status
   */
  private async toggleSessionPin(sessionId: string): Promise<void> {
    if (!this._chatSystem) {
      return;
    }

    try {
      const isPinned = await this._chatSystem.toggleSessionPin(sessionId);
      this.sendMessageToWebview({
        command: 'sessionPinToggled',
        sessionId,
        isPinned
      });
    } catch (error) {
      console.error('[ChatPanel] Failed to toggle session pin:', error);
      vscode.window.showErrorMessage(`Failed to toggle session pin: ${error}`);
    }
  }

  /**
   * Delete a session
   */
  private async deleteSession(sessionId: string): Promise<void> {
    if (!this._chatSystem) {
      return;
    }

    try {
      const success = await this._chatSystem.deleteSession(sessionId);
      if (success) {
        this.sendMessageToWebview({
          command: 'sessionDeleted',
          sessionId
        });
        
        // If this was the active session, load the new active session
        const activeSession = this._chatSystem.getActiveSession();
        if (activeSession) {
          this.sendMessageToWebview({ command: 'clearMessages' });
          await this.loadSessionHistory(activeSession.id);
        }
      }
    } catch (error) {
      console.error('[ChatPanel] Failed to delete session:', error);
      vscode.window.showErrorMessage(`Failed to delete session: ${error}`);
    }
  }

  /**
   * Export sessions
   */
  private async exportSessions(sessionIds: string[], format: 'json' | 'markdown' = 'json'): Promise<void> {
    if (!this._chatSystem) {
      return;
    }

    try {
      const exportedData = await this._chatSystem.exportSessions(sessionIds, format);
      const fileName = `chat-export-${new Date().toISOString().split('T')[0]}.${format}`;
      
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(fileName),
        filters: format === 'json' 
          ? { 'JSON Files': ['json'] }
          : { 'Markdown Files': ['md'] }
      });

      if (uri) {
        await vscode.workspace.fs.writeFile(uri, Buffer.from(exportedData, 'utf8'));
        vscode.window.showInformationMessage(`Sessions exported to ${uri.fsPath}`);
      }
    } catch (error) {
      console.error('[ChatPanel] Failed to export sessions:', error);
      vscode.window.showErrorMessage(`Failed to export sessions: ${error}`);
    }
  }

  /**
   * Import sessions
   */
  private async importSessions(data: string): Promise<void> {
    if (!this._chatSystem) {
      return;
    }

    try {
      const result = await this._chatSystem.importSessions(data);
      
      this.sendMessageToWebview({
        command: 'sessionsImported',
        result
      });
      
      const message = `Import completed: ${result.imported} sessions imported, ${result.skipped} skipped`;
      if (result.errors.length > 0) {
        vscode.window.showWarningMessage(`${message}. ${result.errors.length} errors occurred.`);
      } else {
        vscode.window.showInformationMessage(message);
      }
    } catch (error) {
      console.error('[ChatPanel] Failed to import sessions:', error);
      vscode.window.showErrorMessage(`Failed to import sessions: ${error}`);
    }
  }

  /**
   * Search messages
   */
  private async searchMessages(query: string): Promise<void> {
    if (!this._chatSystem) {
      return;
    }

    try {
      const results = this._chatSystem.searchMessages(query);
      
      this.sendMessageToWebview({
        command: 'searchResults',
        query,
        results: results.map(r => ({
          sessionId: r.sessionId,
          messageId: r.messageId,
          content: r.content.substring(0, 200) + (r.content.length > 200 ? '...' : ''),
          context: r.context,
          timestamp: r.timestamp.toISOString(),
          relevanceScore: r.relevanceScore
        }))
      });
    } catch (error) {
      console.error('[ChatPanel] Failed to search messages:', error);
      vscode.window.showErrorMessage(`Failed to search messages: ${error}`);
    }
  }

  /**
   * Load session history
   */
  private async loadSessionHistory(sessionId: string): Promise<void> {
    if (!this._chatSystem) {
      return;
    }

    try {
      const messages = this._chatSystem.getSessionSummaries().find(s => s.id === sessionId);
      if (messages) {
        // Send session messages to webview
        // Note: In a real implementation, you'd want to get the actual messages
        // This is a placeholder that shows the session info
        this.sendMessageToWebview({
          command: 'sessionHistoryLoaded',
          sessionId,
          messageCount: messages.messageCount
        });
      }
    } catch (error) {
      console.error('[ChatPanel] Failed to load session history:', error);
    }
  }

  /**
   * Update the webview content
   */
  private async updateWebviewContent() {
    if (!this._view) {
      return;
    }

    if (this._chatSystem) {
      this._view.webview.html = this.getChatInterfaceHtml();
      
      // Send current session data to webview
      const activeSession = this._chatSystem.getActiveSession();
      const sessions = this._chatSystem.getSessionSummaries();
      
      this.sendMessageToWebview({
        command: 'initialize',
        activeSessionId: activeSession?.id,
        sessions: sessions.map(s => ({
          id: s.id,
          title: s.title,
          messageCount: s.messageCount,
          lastActivity: s.lastActivity.toISOString(),
          isActive: s.isActive,
          isPinned: s.isPinned,
          provider: s.provider
        }))
      });
    } else {
      this._view.webview.html = this.getLoadingHtml();
    }
  }

  /**
   * Get loading HTML while chat system initializes
   */
  private getLoadingHtml(): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Vespera Chat</title>
        <style>
            body { 
                font-family: var(--vscode-font-family); 
                background: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
                margin: 0; 
                padding: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
            }
            .loading {
                text-align: center;
                color: var(--vscode-descriptionForeground);
            }
            .spinner {
                border: 3px solid var(--vscode-progressBar-background);
                border-top: 3px solid var(--vscode-progressBar-background);
                border-radius: 50%;
                width: 30px;
                height: 30px;
                animation: spin 1s linear infinite;
                margin: 0 auto 15px;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    </head>
    <body>
        <div class="loading">
            <div class="spinner"></div>
            <p>Initializing Chat System...</p>
            <small>Setting up Claude Code provider</small>
        </div>
    </body>
    </html>`;
  }

  /**
   * Get the main chat interface HTML with session management
   */
  private getChatInterfaceHtml(): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Vespera Chat</title>
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

            /* Session Header */
            .session-header {
                background: var(--vscode-titleBar-activeBackground);
                color: var(--vscode-titleBar-activeForeground);
                padding: 8px 12px;
                border-bottom: 1px solid var(--vscode-panel-border);
                display: flex;
                justify-content: space-between;
                align-items: center;
                min-height: 32px;
            }
            
            .session-info {
                display: flex;
                align-items: center;
                gap: 8px;
                flex: 1;
            }
            
            .session-selector {
                background: var(--vscode-dropdown-background);
                color: var(--vscode-dropdown-foreground);
                border: 1px solid var(--vscode-dropdown-border);
                border-radius: 3px;
                padding: 4px 8px;
                font-size: 12px;
                max-width: 200px;
                cursor: pointer;
            }
            
            .session-actions {
                display: flex;
                gap: 4px;
            }
            
            .session-btn {
                background: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
                border: none;
                padding: 4px 6px;
                border-radius: 2px;
                cursor: pointer;
                font-size: 10px;
                line-height: 1;
            }
            
            .session-btn:hover {
                background: var(--vscode-button-secondaryHoverBackground);
            }
            
            .session-btn.primary {
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
            }
            
            .session-btn.primary:hover {
                background: var(--vscode-button-hoverBackground);
            }

            /* Chat Header */
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
            
            .chat-actions {
                display: flex;
                gap: 6px;
            }
            
            .action-btn {
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 4px 8px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
                white-space: nowrap;
            }
            
            .action-btn:hover {
                background: var(--vscode-button-hoverBackground);
            }

            /* Sessions Panel */
            .sessions-panel {
                display: none;
                background: var(--vscode-sideBar-background);
                border-bottom: 1px solid var(--vscode-panel-border);
                max-height: 200px;
                overflow-y: auto;
            }
            
            .sessions-panel.visible {
                display: block;
            }
            
            .session-list {
                padding: 8px;
            }
            
            .session-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 6px 8px;
                margin: 2px 0;
                border-radius: 3px;
                cursor: pointer;
                font-size: 12px;
                border: 1px solid transparent;
            }
            
            .session-item:hover {
                background: var(--vscode-list-hoverBackground);
            }
            
            .session-item.active {
                background: var(--vscode-list-activeSelectionBackground);
                color: var(--vscode-list-activeSelectionForeground);
                border-color: var(--vscode-focusBorder);
            }
            
            .session-item.pinned {
                border-left: 3px solid var(--vscode-charts-yellow);
            }
            
            .session-details {
                flex: 1;
                min-width: 0;
            }
            
            .session-name {
                font-weight: 500;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .session-meta {
                font-size: 10px;
                opacity: 0.7;
                margin-top: 2px;
            }
            
            .session-controls {
                display: flex;
                gap: 4px;
                opacity: 0;
                transition: opacity 0.2s;
            }
            
            .session-item:hover .session-controls {
                opacity: 1;
            }
            
            .session-control-btn {
                background: none;
                border: none;
                color: var(--vscode-icon-foreground);
                cursor: pointer;
                padding: 2px;
                border-radius: 2px;
                font-size: 10px;
            }
            
            .session-control-btn:hover {
                background: var(--vscode-toolbar-hoverBackground);
            }

            /* Search Panel */
            .search-panel {
                display: none;
                background: var(--vscode-input-background);
                border-bottom: 1px solid var(--vscode-panel-border);
                padding: 8px 12px;
            }
            
            .search-panel.visible {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .search-input {
                flex: 1;
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                border-radius: 3px;
                padding: 6px 8px;
                font-size: 12px;
            }
            
            .search-results {
                max-height: 150px;
                overflow-y: auto;
                background: var(--vscode-list-inactiveSelectionBackground);
                border-radius: 3px;
                margin-top: 4px;
                display: none;
            }
            
            .search-result {
                padding: 8px 12px;
                border-bottom: 1px solid var(--vscode-panel-border);
                cursor: pointer;
                font-size: 11px;
            }
            
            .search-result:hover {
                background: var(--vscode-list-hoverBackground);
            }
            
            .search-result-content {
                font-weight: 500;
                margin-bottom: 4px;
            }
            
            .search-result-meta {
                opacity: 0.7;
                font-size: 10px;
            }

            /* Messages Container */
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
            
            .message.system {
                align-self: center;
                background: var(--vscode-editor-inlayHintBackground);
                color: var(--vscode-editor-inlayHintForeground);
                font-style: italic;
                font-size: 12px;
                max-width: 95%;
            }
            
            .message.error {
                background: var(--vscode-inputValidation-errorBackground);
                border-left: 4px solid var(--vscode-inputValidation-errorBorder);
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

            /* Input Container */
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

            /* Empty State */
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
                margin: 0 0 20px 0;
                line-height: 1.5;
                max-width: 400px;
            }

            /* Context Info */
            .context-info {
                background: var(--vscode-editor-inlayHintBackground);
                border: 1px solid var(--vscode-editor-inlayHintBorder);
                border-radius: 6px;
                padding: 8px 12px;
                margin: 10px 15px;
                font-size: 11px;
                color: var(--vscode-editor-inlayHintForeground);
                font-family: var(--vscode-editor-font-family);
                white-space: pre-line;
            }
            
            .context-enabled {
                background: var(--vscode-button-background) !important;
                color: var(--vscode-button-foreground) !important;
            }

            /* Session Stats */
            .session-stats {
                position: absolute;
                top: 100%;
                right: 0;
                background: var(--vscode-menu-background);
                border: 1px solid var(--vscode-menu-border);
                border-radius: 4px;
                padding: 8px 12px;
                font-size: 11px;
                z-index: 1000;
                min-width: 200px;
                display: none;
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            }
            
            .session-stats.visible {
                display: block;
            }
            
            .stats-item {
                display: flex;
                justify-content: space-between;
                margin: 4px 0;
            }
            
            /* Responsive */
            @media (max-width: 400px) {
                .session-header {
                    flex-direction: column;
                    align-items: stretch;
                    gap: 8px;
                }
                
                .session-selector {
                    max-width: none;
                }
                
                .chat-actions {
                    flex-wrap: wrap;
                }
            }
        </style>
    </head>
    <body>
        <!-- Session Header -->
        <div class="session-header">
            <div class="session-info">
                <select class="session-selector" id="sessionSelector">
                    <option value="">Select Session...</option>
                </select>
                <span class="session-meta" id="sessionMeta">No active session</span>
            </div>
            <div class="session-actions">
                <button class="session-btn primary" onclick="createNewSession()" title="Create New Session">✚ New</button>
                <button class="session-btn" onclick="toggleSessionsPanel()" title="Show/Hide Sessions">📋 Sessions</button>
                <button class="session-btn" onclick="toggleSearchPanel()" title="Search Messages">🔍 Search</button>
                <button class="session-btn" onclick="showSessionStats()" title="Session Statistics">📊 Stats</button>
            </div>
        </div>

        <!-- Sessions Panel -->
        <div class="sessions-panel" id="sessionsPanel">
            <div class="session-list" id="sessionList">
                <div class="empty-state">
                    <p>No sessions available</p>
                </div>
            </div>
        </div>

        <!-- Search Panel -->
        <div class="search-panel" id="searchPanel">
            <input type="text" class="search-input" id="searchInput" placeholder="Search messages..." />
            <button class="session-btn" onclick="performSearch()">Search</button>
            <button class="session-btn" onclick="clearSearch()">Clear</button>
            <div class="search-results" id="searchResults"></div>
        </div>
        
        <!-- Chat Header -->
        <div class="chat-header">
            <div class="chat-title">💬 Claude Code Chat</div>
            <div class="chat-actions">
                <button class="action-btn" onclick="toggleFileContext()" id="contextToggle">📁 Context</button>
                <button class="action-btn" onclick="showContextInfo()">📋 Info</button>
                <button class="action-btn" onclick="openProviderConfig()">⚙️ Configure</button>
                <button class="action-btn" onclick="clearHistory()">🗑️ Clear</button>
                <button class="action-btn" onclick="exportSessions()">💾 Export</button>
            </div>
        </div>
        
        <!-- Messages Container -->
        <div class="messages-container" id="messages">
            <div class="empty-state">
                <div class="empty-icon">🤖</div>
                <h3>Welcome to Claude Code Chat!</h3>
                <p>Start a conversation with Claude using your Claude Max subscription.<br>
                Claude has access to powerful tools like file operations, web search, and more.</p>
                <small>Create a new session or select an existing one to get started.</small>
            </div>
        </div>
        
        <!-- Input Container -->
        <div class="input-container">
            <textarea 
                class="message-input" 
                id="messageInput" 
                placeholder="Type your message... (Press Shift+Enter for new line, Enter to send)"
                rows="1"
            ></textarea>
            <button class="send-btn" id="sendBtn" onclick="sendMessage()">Send</button>
        </div>

        <!-- Session Stats Popup -->
        <div class="session-stats" id="sessionStats">
            <div class="stats-item">
                <span>Total Sessions:</span>
                <span id="totalSessions">0</span>
            </div>
            <div class="stats-item">
                <span>Total Messages:</span>
                <span id="totalMessages">0</span>
            </div>
            <div class="stats-item">
                <span>Active Session:</span>
                <span id="activeSessionName">None</span>
            </div>
        </div>

        <script>
            const vscode = acquireVsCodeApi();
            const messagesContainer = document.getElementById('messages');
            const messageInput = document.getElementById('messageInput');
            const sendBtn = document.getElementById('sendBtn');
            const sessionSelector = document.getElementById('sessionSelector');
            const sessionMeta = document.getElementById('sessionMeta');
            const sessionsList = document.getElementById('sessionList');
            const sessionsPanel = document.getElementById('sessionsPanel');
            const searchPanel = document.getElementById('searchPanel');
            const searchInput = document.getElementById('searchInput');
            const searchResults = document.getElementById('searchResults');
            const sessionStats = document.getElementById('sessionStats');
            
            let sessions = [];
            let activeSessionId = null;
            let messages = [];

            // Initialize
            document.addEventListener('DOMContentLoaded', () => {
                setupEventListeners();
            });

            function setupEventListeners() {
                // Auto-resize textarea
                messageInput.addEventListener('input', function() {
                    this.style.height = 'auto';
                    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
                });

                // Handle Enter key
                messageInput.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                    }
                });

                // Session selector change
                sessionSelector.addEventListener('change', function() {
                    if (this.value) {
                        switchToSession(this.value);
                    }
                });

                // Search input
                searchInput.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        performSearch();
                    }
                });

                // Click outside to close panels
                document.addEventListener('click', function(e) {
                    if (!sessionStats.contains(e.target) && !e.target.closest('[onclick*="showSessionStats"]')) {
                        sessionStats.classList.remove('visible');
                    }
                });
            }

            // Session Management Functions
            function createNewSession() {
                const title = prompt('Enter session title (optional):');
                vscode.postMessage({
                    command: 'createSession',
                    title: title || undefined
                });
            }

            function switchToSession(sessionId) {
                vscode.postMessage({
                    command: 'switchSession',
                    sessionId: sessionId
                });
            }

            function toggleSessionsPanel() {
                sessionsPanel.classList.toggle('visible');
                if (searchPanel.classList.contains('visible')) {
                    searchPanel.classList.remove('visible');
                }
            }

            function toggleSearchPanel() {
                searchPanel.classList.toggle('visible');
                if (sessionsPanel.classList.contains('visible')) {
                    sessionsPanel.classList.remove('visible');
                }
                if (searchPanel.classList.contains('visible')) {
                    searchInput.focus();
                }
            }

            function performSearch() {
                const query = searchInput.value.trim();
                if (query) {
                    vscode.postMessage({
                        command: 'searchMessages',
                        query: query
                    });
                }
            }

            function clearSearch() {
                searchInput.value = '';
                searchResults.innerHTML = '';
                searchResults.style.display = 'none';
            }

            function showSessionStats() {
                sessionStats.classList.toggle('visible');
            }

            function updateSessionTitle(sessionId, newTitle) {
                const title = prompt('Enter new session title:', newTitle);
                if (title !== null && title !== newTitle) {
                    vscode.postMessage({
                        command: 'updateSessionTitle',
                        sessionId: sessionId,
                        title: title
                    });
                }
            }

            function toggleSessionPin(sessionId) {
                vscode.postMessage({
                    command: 'toggleSessionPin',
                    sessionId: sessionId
                });
            }

            function deleteSession(sessionId) {
                const session = sessions.find(s => s.id === sessionId);
                if (session && confirm(\`Delete session "\${session.title}"? This cannot be undone.\`)) {
                    vscode.postMessage({
                        command: 'deleteSession',
                        sessionId: sessionId
                    });
                }
            }

            // Message Functions
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
                // Remove empty state if it exists
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
                
                messages.push(message);
            }

            function updateMessage(messageId, content, streaming, error) {
                const messageEl = document.getElementById(messageId);
                if (messageEl) {
                    const contentEl = messageEl.firstChild;
                    contentEl.textContent = content;
                    
                    if (error) {
                        messageEl.classList.add('error');
                    }
                    
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

            function clearMessages() {
                messages = [];
                messagesContainer.innerHTML = \`
                    <div class="empty-state">
                        <div class="empty-icon">🤖</div>
                        <h3>Session cleared!</h3>
                        <p>Start a new conversation with Claude.</p>
                    </div>
                \`;
            }

            // UI Update Functions
            function updateSessionsList(sessionsList) {
                sessions = sessionsList;
                
                // Update selector
                sessionSelector.innerHTML = '<option value="">Select Session...</option>';
                sessions.forEach(session => {
                    const option = document.createElement('option');
                    option.value = session.id;
                    option.textContent = \`\${session.isPinned ? '📌 ' : ''}\${session.title}\`;
                    if (session.isActive) {
                        option.selected = true;
                        activeSessionId = session.id;
                    }
                    sessionSelector.appendChild(option);
                });

                // Update sessions panel
                const sessionListEl = document.getElementById('sessionList');
                if (sessions.length === 0) {
                    sessionListEl.innerHTML = \`
                        <div class="empty-state">
                            <p>No sessions available</p>
                            <button class="session-btn primary" onclick="createNewSession()">Create First Session</button>
                        </div>
                    \`;
                } else {
                    sessionListEl.innerHTML = '';
                    sessions.forEach(session => {
                        const sessionEl = document.createElement('div');
                        sessionEl.className = \`session-item \${session.isActive ? 'active' : ''} \${session.isPinned ? 'pinned' : ''}\`;
                        sessionEl.innerHTML = \`
                            <div class="session-details" onclick="switchToSession('\${session.id}')">
                                <div class="session-name">\${session.isPinned ? '📌 ' : ''}\${session.title}</div>
                                <div class="session-meta">\${session.messageCount} messages • \${new Date(session.lastActivity).toLocaleDateString()}</div>
                            </div>
                            <div class="session-controls">
                                <button class="session-control-btn" onclick="updateSessionTitle('\${session.id}', '\${session.title}')" title="Rename">✏️</button>
                                <button class="session-control-btn" onclick="toggleSessionPin('\${session.id}')" title="\${session.isPinned ? 'Unpin' : 'Pin'}">📌</button>
                                <button class="session-control-btn" onclick="deleteSession('\${session.id}')" title="Delete">🗑️</button>
                            </div>
                        \`;
                        sessionListEl.appendChild(sessionEl);
                    });
                }

                // Update active session info
                const activeSession = sessions.find(s => s.isActive);
                if (activeSession) {
                    sessionMeta.textContent = \`\${activeSession.messageCount} messages • \${activeSession.provider}\`;
                } else {
                    sessionMeta.textContent = 'No active session';
                }

                // Update stats
                document.getElementById('totalSessions').textContent = sessions.length;
                document.getElementById('totalMessages').textContent = sessions.reduce((sum, s) => sum + s.messageCount, 0);
                document.getElementById('activeSessionName').textContent = activeSession ? activeSession.title : 'None';
            }

            function showSearchResults(query, results) {
                searchResults.innerHTML = '';
                
                if (results.length === 0) {
                    searchResults.innerHTML = \`<div class="search-result">No results found for "\${query}"</div>\`;
                } else {
                    results.forEach(result => {
                        const resultEl = document.createElement('div');
                        resultEl.className = 'search-result';
                        resultEl.innerHTML = \`
                            <div class="search-result-content">\${result.context}</div>
                            <div class="search-result-meta">
                                Session: \${sessions.find(s => s.id === result.sessionId)?.title || 'Unknown'} • 
                                \${new Date(result.timestamp).toLocaleString()}
                            </div>
                        \`;
                        resultEl.onclick = () => switchToSession(result.sessionId);
                        searchResults.appendChild(resultEl);
                    });
                }
                
                searchResults.style.display = 'block';
            }

            // Provider functions
            function openProviderConfig() {
                vscode.postMessage({ command: 'openProviderConfig' });
            }

            function clearHistory() {
                if (confirm('Clear current session history?')) {
                    vscode.postMessage({ command: 'clearHistory' });
                }
            }

            function toggleFileContext() {
                vscode.postMessage({ command: 'toggleFileContext' });
            }

            function showContextInfo() {
                vscode.postMessage({ command: 'showContextInfo' });
            }

            function exportSessions() {
                const selectedSessions = sessions.filter(s => s.isActive);
                const sessionIds = selectedSessions.map(s => s.id);
                vscode.postMessage({
                    command: 'exportSessions',
                    sessionIds: sessionIds,
                    format: 'json'
                });
            }

            function showContextInfoOverlay(contextSummary) {
                // Remove existing context info if any
                const existingInfo = document.querySelector('.context-info');
                if (existingInfo) {
                    existingInfo.remove();
                }

                // Add context info overlay
                const contextDiv = document.createElement('div');
                contextDiv.className = 'context-info';
                contextDiv.textContent = contextSummary;
                
                messagesContainer.insertBefore(contextDiv, messagesContainer.firstChild);

                // Auto-remove after 10 seconds
                setTimeout(() => {
                    if (contextDiv.parentNode) {
                        contextDiv.remove();
                    }
                }, 10000);
            }

            function updateContextToggleButton(enabled) {
                const button = document.getElementById('contextToggle');
                if (button) {
                    if (enabled) {
                        button.classList.add('context-enabled');
                        button.textContent = '📁 Context ON';
                        button.title = 'File context is enabled - Click to disable';
                    } else {
                        button.classList.remove('context-enabled');
                        button.textContent = '📁 Context OFF';
                        button.title = 'File context is disabled - Click to enable';
                    }
                }
            }

            // Listen for messages from the extension
            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.command) {
                    case 'initialize':
                        updateSessionsList(message.sessions || []);
                        activeSessionId = message.activeSessionId;
                        break;
                    case 'addMessage':
                        addMessage(message.message);
                        break;
                    case 'updateMessage':
                        updateMessage(message.messageId, message.content, message.streaming, message.error);
                        break;
                    case 'clearMessages':
                    case 'clearHistory':
                        clearMessages();
                        break;
                    case 'fileContextToggled':
                        updateContextToggleButton(message.enabled);
                        break;
                    case 'showContextInfo':
                        showContextInfoOverlay(message.contextSummary);
                        break;
                    case 'sessionCreated':
                        // Refresh sessions list
                        vscode.postMessage({ command: 'ready' });
                        break;
                    case 'sessionSwitched':
                        activeSessionId = message.sessionId;
                        break;
                    case 'searchResults':
                        showSearchResults(message.query, message.results);
                        break;
                }
            });

            // Notify extension that webview is ready
            vscode.postMessage({ command: 'ready' });
        </script>
    </body>
    </html>`;
  }

  /**
   * Get configuration panel HTML
   */
  private getConfigurationHtml(currentConfig?: any): string {
    // Extract current values or use defaults
    const systemPrompt = currentConfig?.systemPrompt || 'You are Claude, a helpful AI assistant.';
    const maxTurns = currentConfig?.maxTurns || 5;
    const allowedTools = currentConfig?.allowedTools || 'Read,Write,Bash,Grep,Glob';
    const enableThinking = currentConfig?.enableThinking || false;
    const enableToolVisibility = currentConfig?.enableToolVisibility !== false; // default to true
    const fileContextEnabled = currentConfig?.fileContextEnabled !== false; // default to true
    const fileContextIncludeSelection = currentConfig?.fileContextIncludeSelection !== false;
    const fileContextIncludeCursorArea = currentConfig?.fileContextIncludeCursorArea !== false;
    const fileContextIncludeOpenTabs = currentConfig?.fileContextIncludeOpenTabs === true;
    const fileContextCursorLines = currentConfig?.fileContextCursorLines || 10;
    const fileContextMaxFileSize = currentConfig?.fileContextMaxFileSize || 10000;
    const fileContextMaxTotalSize = currentConfig?.fileContextMaxTotalSize || 50000;
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Chat Provider Configuration</title>
        <style>
            body { 
                font-family: var(--vscode-font-family); 
                background: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
                margin: 0; 
                padding: 30px;
                line-height: 1.6;
            }
            .config-header {
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: 1px solid var(--vscode-panel-border);
            }
            .config-form {
                display: flex;
                flex-direction: column;
                gap: 20px;
                max-width: 600px;
            }
            .form-group {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .form-group label {
                font-weight: bold;
                font-size: 14px;
            }
            .form-group input, .form-group textarea, .form-group select {
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                border-radius: 4px;
                padding: 8px 12px;
                font-family: inherit;
                font-size: 13px;
            }
            .form-group textarea {
                min-height: 80px;
                resize: vertical;
            }
            .form-group small {
                color: var(--vscode-descriptionForeground);
                font-size: 12px;
            }
            .form-actions {
                display: flex;
                gap: 12px;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid var(--vscode-panel-border);
            }
            .btn {
                padding: 10px 20px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                font-weight: bold;
            }
            .btn-primary {
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
            }
            .btn-primary:hover {
                background: var(--vscode-button-hoverBackground);
            }
            .btn-secondary {
                background: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
            }
            .btn-secondary:hover {
                background: var(--vscode-button-secondaryHoverBackground);
            }
            .provider-info {
                background: var(--vscode-textBlockQuote-background);
                border-left: 4px solid var(--vscode-textBlockQuote-border);
                padding: 15px;
                margin-bottom: 20px;
                border-radius: 4px;
            }
            .provider-info h4 {
                margin: 0 0 8px 0;
                color: var(--vscode-textPreformat-foreground);
            }
        </style>
    </head>
    <body>
        <div class="config-header">
            <h2>🔧 Chat Provider Configuration</h2>
            <p>Configure your AI chat providers for Vespera Forge</p>
        </div>

        <div class="provider-info">
            <h4>📱 Claude Code Provider</h4>
            <p>Uses your Claude Max subscription with the official Claude Code TypeScript SDK. 
            No additional API costs required!</p>
        </div>

        <form class="config-form" id="configForm">
            <div class="form-group">
                <label for="systemPrompt">System Prompt</label>
                <textarea id="systemPrompt" name="systemPrompt" placeholder="You are Claude, a helpful AI assistant.">${systemPrompt}</textarea>
                <small>Define Claude's role and behavior</small>
            </div>

            <div class="form-group">
                <label for="maxTurns">Max Conversation Turns</label>
                <input type="number" id="maxTurns" name="maxTurns" value="${maxTurns}" min="1" max="20">
                <small>Maximum number of back-and-forth exchanges (1-20)</small>
            </div>

            <div class="form-group">
                <label for="allowedTools">Available Tools</label>
                <select id="allowedTools" name="allowedTools">
                    <option value="Read,Write,Bash,Grep,Glob"${allowedTools === 'Read,Write,Bash,Grep,Glob' ? ' selected' : ''}>File Operations + Search (Default)</option>
                    <option value="Read,Write,Bash"${allowedTools === 'Read,Write,Bash' ? ' selected' : ''}>Basic File Operations</option>
                    <option value="Read,Write"${allowedTools === 'Read,Write' ? ' selected' : ''}>File Access Only</option>
                    <option value="Read,Bash,WebSearch"${allowedTools === 'Read,Bash,WebSearch' ? ' selected' : ''}>Files + Web Search</option>
                    <option value="All"${allowedTools === 'All' ? ' selected' : ''}>All Available Tools</option>
                </select>
                <small>Select which tools Claude can use during conversations</small>
            </div>

            <div class="form-group">
                <label>
                    <input type="checkbox" id="enableThinking" name="enableThinking"${enableThinking ? ' checked' : ''}> 
                    Show Thinking Process
                </label>
                <small>Display Claude's internal reasoning as it works through problems</small>
            </div>

            <div class="form-group">
                <label>
                    <input type="checkbox" id="enableToolVisibility" name="enableToolVisibility"${enableToolVisibility ? ' checked' : ''}> 
                    Show Tool Usage
                </label>
                <small>Display when Claude is using tools like file operations or web search</small>
            </div>

            <hr style="margin: 30px 0; border: 1px solid var(--vscode-panel-border);">
            <h3 style="color: var(--vscode-textPreformat-foreground); margin-bottom: 20px;">📁 File Context Settings</h3>

            <div class="form-group">
                <label>
                    <input type="checkbox" id="fileContextEnabled" name="fileContextEnabled"${fileContextEnabled ? ' checked' : ''}> 
                    Enable File Context Collection
                </label>
                <small>Automatically include relevant file content, selections, and cursor area in conversations</small>
            </div>

            <div class="form-group">
                <label>
                    <input type="checkbox" id="fileContextIncludeSelection" name="fileContextIncludeSelection"${fileContextIncludeSelection ? ' checked' : ''}> 
                    Include Selected Text
                </label>
                <small>Include currently selected text with surrounding context (highest priority)</small>
            </div>

            <div class="form-group">
                <label>
                    <input type="checkbox" id="fileContextIncludeCursorArea" name="fileContextIncludeCursorArea"${fileContextIncludeCursorArea ? ' checked' : ''}> 
                    Include Cursor Area
                </label>
                <small>Include lines around the cursor position</small>
            </div>

            <div class="form-group">
                <label>
                    <input type="checkbox" id="fileContextIncludeOpenTabs" name="fileContextIncludeOpenTabs"${fileContextIncludeOpenTabs ? ' checked' : ''}> 
                    Include Open Tabs
                </label>
                <small>Include content from other open editor tabs (use sparingly)</small>
            </div>

            <div class="form-group">
                <label for="fileContextCursorLines">Cursor Context Lines</label>
                <input type="number" id="fileContextCursorLines" name="fileContextCursorLines" value="${fileContextCursorLines}" min="5" max="50">
                <small>Number of lines to include around cursor position (5-50)</small>
            </div>

            <div class="form-group">
                <label for="fileContextMaxFileSize">Max File Size (chars)</label>
                <input type="number" id="fileContextMaxFileSize" name="fileContextMaxFileSize" value="${fileContextMaxFileSize}" min="1000" max="50000" step="1000">
                <small>Maximum characters per file to include (1k-50k)</small>
            </div>

            <div class="form-group">
                <label for="fileContextMaxTotalSize">Max Total Context (chars)</label>
                <input type="number" id="fileContextMaxTotalSize" name="fileContextMaxTotalSize" value="${fileContextMaxTotalSize}" min="5000" max="200000" step="5000">
                <small>Maximum total context size across all files (5k-200k)</small>
            </div>
        </form>

        <div class="form-actions">
            <button class="btn btn-primary" onclick="saveConfig()">💾 Save Configuration</button>
            <button class="btn btn-secondary" onclick="testConnection()">🧪 Test Connection</button>
        </div>

        <script>
            const vscode = acquireVsCodeApi();

            function saveConfig() {
                const form = document.getElementById('configForm');
                const formData = new FormData(form);
                
                const config = {
                    providerId: 'claude-code',
                    systemPrompt: formData.get('systemPrompt'),
                    maxTurns: parseInt(formData.get('maxTurns')),
                    allowedTools: formData.get('allowedTools'),
                    enableThinking: document.getElementById('enableThinking').checked,
                    enableToolVisibility: document.getElementById('enableToolVisibility').checked,
                    // File context settings
                    fileContextEnabled: document.getElementById('fileContextEnabled').checked,
                    fileContextIncludeSelection: document.getElementById('fileContextIncludeSelection').checked,
                    fileContextIncludeCursorArea: document.getElementById('fileContextIncludeCursorArea').checked,
                    fileContextIncludeOpenTabs: document.getElementById('fileContextIncludeOpenTabs').checked,
                    fileContextCursorLines: parseInt(formData.get('fileContextCursorLines')),
                    fileContextMaxFileSize: parseInt(formData.get('fileContextMaxFileSize')),
                    fileContextMaxTotalSize: parseInt(formData.get('fileContextMaxTotalSize'))
                };

                vscode.postMessage({
                    command: 'saveConfig',
                    config: config
                });
            }

            function testConnection() {
                vscode.postMessage({
                    command: 'testConnection',
                    providerId: 'claude-code'
                });
            }
        </script>
    </body>
    </html>`;
  }
}

/**
 * Register chat panel commands
 */
export function registerChatPanelCommands(
  context: vscode.ExtensionContext, 
  chatProvider: ChatPanelWebviewProvider
) {
  // Open chat panel command
  context.subscriptions.push(
    vscode.commands.registerCommand('vespera-forge.openChatPanel', () => {
      vscode.commands.executeCommand('vespera-forge.chatPanel.focus');
      console.log('[ChatPanel] Chat panel opened by user');
    })
  );

  // Configure chat providers command
  context.subscriptions.push(
    vscode.commands.registerCommand('vespera-forge.configureChatProviders', () => {
      chatProvider.openProviderConfiguration();
    })
  );

  // Clear chat history command - handled by main command system

  // Export chat history command - handled by main command system as exportChatSessions
}