/**
 * Main Chat System Exports
 * Entry point for the Vespera Forge chat system
 */

// Core system components
export { ChatTemplateRegistry } from './core/TemplateRegistry';
export { ChatConfigurationManager } from './core/ConfigurationManager';
export { ChatHistoryManager } from './core/ChatHistoryManager';
export { ChatSessionManager } from './core/ChatSessionManager';

// Event system
export { ChatEventRouter } from './events/ChatEventRouter';

// Provider system - REMOVED: Migrated to Bindery backend
// See: PHASE_14_LLM_ARCHITECTURE.md for details

// UI components
export { ChatWebViewProvider } from './ui/webview/ChatWebViewProvider';

// Types
export * from './types/chat';
export * from './types/provider';
export * from './types/config';
export * from './types/events';
export * from './types/webview';

// Utilities
export { HttpClient } from './utils/HttpClient';
export { Validator } from './utils/validation';
export { CredentialManager } from './utils/encryption';

/**
 * Main Chat System Manager
 * Coordinates all chat system components
 */
import * as vscode from 'vscode';
import { ChatTemplateRegistry } from './core/TemplateRegistry';
import { ChatConfigurationManager } from './core/ConfigurationManager';
import { ChatHistoryManager } from './core/ChatHistoryManager';
import { ChatSessionManager } from './core/ChatSessionManager';
import { ChatEventRouter } from './events/ChatEventRouter';
import { ChatWebViewProvider } from './ui/webview/ChatWebViewProvider';
import { ChatSession, SessionSummary } from './types/chat';

export interface VesperaChatSystemOptions {
  /** Skip webview registration (useful when embedding in another webview) */
  skipWebviewRegistration?: boolean;
  /** Skip command registration (useful when commands are registered elsewhere) */
  skipCommandRegistration?: boolean;
}

export class VesperaChatSystem {
  private templateRegistry: ChatTemplateRegistry;
  private configurationManager: ChatConfigurationManager;
  private historyManager: ChatHistoryManager;
  private sessionManager: ChatSessionManager;
  private eventRouter: ChatEventRouter;
  private webViewProvider: ChatWebViewProvider;
  private disposables: vscode.Disposable[] = [];
  private activeProvider?: any;
  private providers: Map<string, any> = new Map();
  private options: VesperaChatSystemOptions;

  constructor(_extensionUri: vscode.Uri, private _context: vscode.ExtensionContext, options?: VesperaChatSystemOptions) {
    this.options = options || {};

    // Initialize core components in dependency order
    this.eventRouter = new ChatEventRouter();
    this.templateRegistry = new ChatTemplateRegistry(this._context.extensionUri, this.eventRouter);
    this.configurationManager = new ChatConfigurationManager(this._context, this.templateRegistry, this.eventRouter);
    this.historyManager = new ChatHistoryManager(this._context);
    this.sessionManager = new ChatSessionManager(this._context, this.historyManager);
    this.webViewProvider = new ChatWebViewProvider(this._context, this.eventRouter, this.configurationManager, this.templateRegistry);
  }

  /**
   * Initialize the chat system
   */
  async initialize(): Promise<void> {
    console.log('[VesperaChatSystem] Initializing chat system...', { options: this.options });

    try {
      // Initialize template registry first
      await this.templateRegistry.initialize();
      console.log('[VesperaChatSystem] Template registry initialized');

      // Register WebView provider only if not skipped
      if (!this.options.skipWebviewRegistration) {
        this.disposables.push(
          vscode.window.registerWebviewViewProvider(
            ChatWebViewProvider.viewType,
            this.webViewProvider,
            {
              webviewOptions: {
                retainContextWhenHidden: true
              }
            }
          )
        );
        console.log('[VesperaChatSystem] WebView provider registered');
      } else {
        console.log('[VesperaChatSystem] Skipped WebView provider registration (embedded mode)');
      }

      // Register commands only if not skipped
      if (!this.options.skipCommandRegistration) {
        this.registerCommands();
        console.log('[VesperaChatSystem] Commands registered');
      } else {
        console.log('[VesperaChatSystem] Skipped command registration');
      }

      console.log('[VesperaChatSystem] Chat system initialized successfully');
    } catch (error) {
      console.error('[VesperaChatSystem] Failed to initialize chat system:', error);
      throw error;
    }
  }

  /**
   * Register VS Code commands
   */
  private registerCommands(): void {
    // Show chat command
    this.disposables.push(
      vscode.commands.registerCommand('vesperaForge.showChat', () => {
        this.webViewProvider.reveal();
      })
    );

    // Configure chat providers command
    this.disposables.push(
      vscode.commands.registerCommand('vesperaForge.configureChatProviders', async () => {
        await this.showProviderConfigurationDialog();
      })
    );

    // Send message command (can be called from other parts of the extension)
    this.disposables.push(
      vscode.commands.registerCommand('vesperaForge.sendChatMessage', async (message: string) => {
        await this.sendMessage(message);
      })
    );

    // Clear chat history command
    this.disposables.push(
      vscode.commands.registerCommand('vesperaForge.clearChatHistory', async () => {
        const confirmed = await vscode.window.showWarningMessage(
          'Are you sure you want to clear the chat history?',
          'Clear',
          'Cancel'
        );
        
        if (confirmed === 'Clear') {
          await this.clearHistory();
          await vscode.window.showInformationMessage('Chat history cleared successfully');
        }
      })
    );
  }

  /**
   * Get the template registry
   */
  getTemplateRegistry(): ChatTemplateRegistry {
    return this.templateRegistry;
  }

  /**
   * Get the configuration manager
   */
  getConfigurationManager(): ChatConfigurationManager {
    return this.configurationManager;
  }

  /**
   * Get the event router
   */
  getEventRouter(): ChatEventRouter {
    return this.eventRouter;
  }

  /**
   * Get the WebView provider
   */
  getWebViewProvider(): ChatWebViewProvider {
    return this.webViewProvider;
  }

  /**
   * Handle view becoming visible
   */
  handleViewVisible(): void {
    console.log('[VesperaChatSystem] View became visible');
    // Delegate to webview provider if needed
    // this.webViewProvider.handleViewVisible();
  }

  /**
   * Handle view becoming hidden
   */
  handleViewHidden(): void {
    console.log('[VesperaChatSystem] View became hidden');
    // Delegate to webview provider if needed
    // this.webViewProvider.handleViewHidden();
  }

  /**
   * Get webview HTML content
   */
  getWebviewContent(): string {
    console.log('[VesperaChatSystem] Getting webview content');
    // For now, return basic HTML - this can be enhanced later
    return this.getBasicChatHtml();
  }

  /**
   * Refresh the chat system
   */
  refresh(): void {
    console.log('[VesperaChatSystem] Refreshing chat system');
    // Refresh components as needed
    // this.webViewProvider.refresh();
  }

  /**
   * Get basic HTML content for the chat interface
   */
  private getBasicChatHtml(): string {
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
            }
            .chat-container {
                display: flex;
                flex-direction: column;
                height: 100vh;
                max-height: 600px;
            }
            .header {
                background: var(--vscode-titleBar-activeBackground);
                color: var(--vscode-titleBar-activeForeground);
                padding: 10px;
                border-radius: 4px;
                margin-bottom: 15px;
                text-align: center;
            }
            .placeholder {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--vscode-descriptionForeground);
                font-style: italic;
            }
            .footer {
                margin-top: 15px;
                padding: 10px;
                background: var(--vscode-input-background);
                border: 1px solid var(--vscode-input-border);
                border-radius: 4px;
                text-align: center;
            }
        </style>
    </head>
    <body>
        <div class="chat-container">
            <div class="header">
                <h3>🤖 Vespera Chat Assistant</h3>
            </div>
            <div class="placeholder">
                Chat system is initializing...<br>
                Full implementation coming soon!
            </div>
            <div class="footer">
                <small>Use Ctrl+Alt+C to focus this panel</small>
            </div>
        </div>
    </body>
    </html>`;
  }

  /**
   * Create a provider with proper event listener setup
   *
   * @deprecated Legacy provider system removed. Providers are now managed by Bindery backend.
   * See PHASE_14_LLM_ARCHITECTURE.md for the new architecture.
   *
   * TODO: Replace with Bindery Codex-based provider creation
   */
  async createAndRegisterProvider(providerId: string, _template: any, _config: any): Promise<any> {
    console.warn(`[VesperaChatSystem] createAndRegisterProvider is deprecated - providers managed by Bindery`);
    console.log(`[VesperaChatSystem] Provider ID: ${providerId}`);

    // TODO: Create Codex instance via Bindery API
    // const provider = await binderyClient.createCodex({
    //   template_id: 'llm-provider',
    //   template_fields: { provider_type: providerId, ...config }
    // });

    // Stub for now - returns a minimal provider object
    const stubProvider = {
      id: providerId,
      status: 'not-configured',
      // TODO: Implement Bindery integration
    };

    this.providers.set(providerId, stubProvider);
    return stubProvider;
  }

  /**
   * Get a provider by ID
   */
  getProvider(providerId: string): any {
    return this.providers.get(providerId);
  }

  /**
   * Set active provider
   *
   * @deprecated Legacy provider system removed. Providers are now managed by Bindery backend.
   * TODO: Replace with Bindery Codex reference
   */
  async setActiveProvider(providerId: string, provider: any): Promise<void> {
    console.warn(`[VesperaChatSystem] setActiveProvider is deprecated - providers managed by Bindery`);
    console.log(`[VesperaChatSystem] Setting active provider: ${providerId}`);

    // TODO: Set active provider via Bindery API
    // await binderyClient.setActiveProvider(providerId);

    this.providers.set(providerId, provider);
    this.activeProvider = provider;
  }

  /**
   * Stream a message through the active provider with session context
   *
   * @deprecated Legacy provider system removed. Messages are now streamed via Bindery backend.
   * TODO: Replace with Bindery LLM streaming API
   */
  async *streamMessage(_message: any): AsyncIterable<any> {
    console.warn('[VesperaChatSystem] streamMessage is deprecated - use Bindery LLM API');

    // TODO: Replace with Bindery streaming
    // const stream = await binderyClient.llmSendMessageStreaming({
    //   codex_ref: activeProviderCodexRef,
    //   messages: [...history, message],
    //   system_prompt_ref: systemPromptCodexRef
    // });
    //
    // for await (const chunk of stream) {
    //   yield chunk;
    // }

    // Stub: yield a mock response to prevent errors
    yield {
      role: 'assistant',
      content: 'Provider system has been migrated to Bindery backend. Chat functionality will be restored in Phase 14c.',
      done: false
    };
    yield {
      role: 'assistant',
      content: '',
      done: true
    };
  }

  /**
   * Update configuration
   *
   * @deprecated Legacy provider system removed.
   * TODO: Update Codex configuration via Bindery API
   */
  async updateConfiguration(_config: any): Promise<void> {
    console.warn('[VesperaChatSystem] updateConfiguration is deprecated - use Bindery Codex API');
    // TODO: Update provider Codex via Bindery
    // await binderyClient.updateCodex(activeProviderCodexRef, config);
  }

  /**
   * Test connection for a provider
   *
   * @deprecated Legacy provider system removed.
   * TODO: Test connection via Bindery validate_config API
   */
  async testConnection(_providerId?: string): Promise<boolean> {
    console.warn('[VesperaChatSystem] testConnection is deprecated - use Bindery validate_config');
    // TODO: Test provider via Bindery
    // const provider = await binderyClient.getCodex(providerId);
    // return await binderyClient.llmValidateConfig(provider);
    return false;
  }

  /**
   * Clear chat history
   */
  async clearHistory(): Promise<void> {
    console.log('[VesperaChatSystem] Clearing chat history');
    const activeSession = this.sessionManager.getActiveSession();
    if (activeSession) {
      await this.historyManager.clearSessionHistory(activeSession.id);
    }
  }

  // Session Management Methods
  
  /**
   * Create a new chat session
   */
  async createSession(providerId: string, title?: string): Promise<ChatSession> {
    return await this.sessionManager.createSession(providerId, title);
  }

  /**
   * Switch to a different session
   */
  async switchToSession(sessionId: string): Promise<boolean> {
    return await this.sessionManager.switchToSession(sessionId);
  }

  /**
   * Get current active session
   */
  getActiveSession(): ChatSession | undefined {
    return this.sessionManager.getActiveSession();
  }

  /**
   * Get session summaries with optional filtering
   */
  getSessionSummaries(filter?: any): SessionSummary[] {
    return this.sessionManager.getSessionSummaries(filter);
  }

  /**
   * Update session title
   */
  async updateSessionTitle(sessionId: string, title: string): Promise<boolean> {
    return await this.sessionManager.updateSession(sessionId, { title });
  }

  /**
   * Toggle session pin status
   */
  async toggleSessionPin(sessionId: string): Promise<boolean> {
    return await this.sessionManager.toggleSessionPin(sessionId);
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    return await this.sessionManager.deleteSession(sessionId);
  }

  /**
   * Search messages across sessions
   */
  searchMessages(query: string, sessionId?: string) {
    return this.historyManager.searchMessages(query, sessionId);
  }

  /**
   * Export sessions
   */
  async exportSessions(sessionIds: string[], format: 'json' | 'markdown' = 'json'): Promise<string> {
    return await this.sessionManager.exportSessions({
      sessionIds,
      includeMetadata: true,
      includeSystemMessages: true,
      format
    });
  }

  /**
   * Import sessions
   */
  async importSessions(jsonData: string) {
    return await this.sessionManager.importSessions(jsonData);
  }

  /**
   * Get session and history statistics
   */
  getStatistics() {
    return {
      sessions: this.sessionManager.getStatistics(),
      history: this.historyManager.getStatistics()
    };
  }

  /**
   * Show provider configuration dialog
   *
   * @deprecated Legacy provider system removed.
   * TODO: Replace with Codex-based provider configuration UI
   */
  private async showProviderConfigurationDialog(): Promise<void> {
    console.warn('[VesperaChatSystem] showProviderConfigurationDialog is deprecated');

    await vscode.window.showInformationMessage(
      'Provider configuration has been migrated to Codex templates. ' +
      'See .vespera/templates/llm-provider.json5 for configuration options.',
      'OK'
    );

    // TODO: Show Codex-based provider configuration UI
    // - List existing provider Codices
    // - Allow creating/editing provider Codices
    // - Integrate with Bindery backend
  }

  /**
   * Send a message through the command interface
   */
  private async sendMessage(message: string): Promise<void> {
    if (!message?.trim()) {
      const userMessage = await vscode.window.showInputBox({
        prompt: 'Enter your message',
        placeHolder: 'Type your message here...'
      });
      if (!userMessage?.trim()) return;
      message = userMessage;
    }

    try {
      console.log('[VesperaChatSystem] Sending message via command:', message);
      
      if (!this.activeProvider) {
        await vscode.window.showWarningMessage('No chat provider is configured. Please configure a provider first.');
        return;
      }

      // Create a message object
      const chatMessage = {
        id: `user_${Date.now()}`,
        role: 'user' as const,
        content: message.trim(),
        timestamp: new Date(),
        threadId: 'command',
        metadata: { source: 'command' }
      };

      // Stream the response and show progress
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Sending message...',
        cancellable: false
      }, async (progress) => {
        let responseContent = '';
        progress.report({ message: 'Processing...' });
        
        for await (const chunk of await this.streamMessage(chatMessage)) {
          if (chunk.content && !chunk.done) {
            responseContent += chunk.content;
          }
        }

        if (responseContent) {
          // Show response in info dialog for command-based messages
          const truncated = responseContent.length > 200 
            ? responseContent.substring(0, 200) + '...' 
            : responseContent;
          await vscode.window.showInformationMessage(`Response: ${truncated}`, 'View Full Chat');
        }
      });
    } catch (error) {
      console.error('[VesperaChatSystem] Error sending message:', error);
      await vscode.window.showErrorMessage(`Failed to send message: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Dispose of the chat system
   */
  dispose(): void {
    console.log('[VesperaChatSystem] Disposing chat system...');
    
    // Dispose of providers
    for (const [_id, provider] of this.providers) {
      if (typeof provider.dispose === 'function') {
        provider.dispose();
      }
    }
    this.providers.clear();
    this.activeProvider = undefined;
    
    this.disposables.forEach(d => d.dispose());
    this.disposables.length = 0;
    
    // Dispose of managers in reverse dependency order
    this.sessionManager.dispose();
    this.historyManager.dispose();
    this.webViewProvider.dispose();
    this.configurationManager.dispose();
    this.templateRegistry.dispose();
    
    console.log('[VesperaChatSystem] Chat system disposed');
  }
}