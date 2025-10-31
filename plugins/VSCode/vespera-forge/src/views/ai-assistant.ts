/**
 * AI Assistant WebView Provider - Auxiliary panel for AI chat
 * This is a simplified version focused on chat functionality in the right sidebar
 */

import * as vscode from 'vscode';
import { VesperaChatSystem } from '../chat';
import { BinderyService } from '../services/bindery';
import { TemplateInitializer } from '../services/template-initializer';

interface ChatChannel {
  id: string;
  title: string;
  templateId: string;
  type: 'user-chat' | 'agent-task';
  status: 'active' | 'idle' | 'archived';
  lastActivity?: Date;
  messageCount?: number;
}

export class AIAssistantWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vespera-forge.aiAssistant';

  private _view?: vscode.WebviewView;
  private _chatSystem?: VesperaChatSystem;
  private _activeChannel?: any; // Current active channel
  private _channels: ChatChannel[] = [];
  private _binderyService?: BinderyService;

  private _connectionCheckInterval?: NodeJS.Timeout;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext,
    binderyService?: BinderyService
  ) {
    // Store reference globally for commands
    (global as any).vesperaAIAssistantProvider = this;

    // Use provided bindery service instance
    this._binderyService = binderyService;

    if (this._binderyService) {
      console.log('[AIAssistant] Bindery service provided at construction');
    } else {
      console.log('[AIAssistant] Bindery service not yet available, will wait for connection');
      // Set up listener for when Bindery becomes available
      this.setupBinderyConnectionListener();
    }
  }

  private setupBinderyConnectionListener() {
    // Check periodically if Bindery service becomes available
    this._connectionCheckInterval = setInterval(() => {
      const globalService = (global as any).binderyServiceInstance;
      if (!this._binderyService && globalService) {
        this._binderyService = globalService;
        console.log('[AIAssistant] Bindery service now available from global');

        // Try loading channels now that Bindery is available
        if (this._view?.visible) {
          this.loadChannels();
        }

        // Stop checking
        if (this._connectionCheckInterval) {
          clearInterval(this._connectionCheckInterval);
          this._connectionCheckInterval = undefined;
        }
      }
    }, 500);

    // Clean up after 30 seconds
    setTimeout(() => {
      if (this._connectionCheckInterval) {
        clearInterval(this._connectionCheckInterval);
        this._connectionCheckInterval = undefined;
      }
    }, 30000);
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
          // Load channels when view becomes visible (if Bindery is ready)
          this.loadChannelsWhenReady();
        } else {
          this._chatSystem.handleViewHidden();
        }
      }
    });

    console.log('[AIAssistant] AI Assistant panel initialized');

    // Note: Don't load channels here - wait for 'ready' message from webview
    // The webview will send 'ready' when its JavaScript is fully loaded
  }

  private async loadChannelsWhenReady() {
    // Check if Bindery service is available
    if (!this._binderyService) {
      console.warn('[AIAssistant] Cannot load channels - Bindery service not available');
      return;
    }

    // Load channels - the loadChannels method will handle connection initialization
    await this.loadChannels();
  }

  private async initializeChatSystem() {
    try {
      // Ensure directory structure exists BEFORE initializing chat system
      // This prevents ENOENT errors when ChatTemplateRegistry tries to load templates
      const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
      if (workspaceUri) {
        const templateInitializer = new TemplateInitializer();
        await templateInitializer.ensureDirectoryStructure(workspaceUri);
      }

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
      case 'selectChannel':
        await this.switchChannel(message.channel);
        break;
      case 'createChannel':
        await this.createChannel(message.name, message.type);
        break;
      case 'refreshChannels':
        console.log('[AIAssistant] Refresh channels command received');
        await this.loadChannelsWhenReady();
        break;
      case 'ready':
        console.log('[AIAssistant] Webview ready, loading initial data');
        // Webview is now ready to receive messages - load channels
        await this.loadChannelsWhenReady();
        break;
      case 'loadProviders':
        await this.loadProviders();
        break;
      case 'updateChannelProvider':
        await this.updateChannelProvider(
          message.channelId,
          message.providerId,
          message.model
        );
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

  /**
   * Wait for Bindery to be connected, with timeout
   */
  private async waitForConnection(timeoutMs: number = 5000): Promise<boolean> {
    if (!this._binderyService) {
      return false;
    }

    // Already connected?
    if (this._binderyService.isConnected()) {
      return true;
    }

    // Get current status
    const connectionInfo = this._binderyService.getConnectionInfo();
    console.log('[AIAssistant] Current connection status:', connectionInfo.status);

    // If disconnected, try to initialize
    if (connectionInfo.status === 'disconnected') {
      console.log('[AIAssistant] Bindery disconnected, attempting to initialize...');
      const initResult = await this._binderyService.initialize();
      if (!initResult.success) {
        console.error('[AIAssistant] Failed to initialize Bindery:', initResult.error);
        return false;
      }
    }

    // Wait for status to become 'connected' or timeout
    return new Promise<boolean>((resolve) => {
      const timeoutHandle = setTimeout(() => {
        this._binderyService?.removeListener('statusChanged', statusListener);
        console.warn('[AIAssistant] Timeout waiting for Bindery connection');
        resolve(false);
      }, timeoutMs);

      const statusListener = (info: any) => {
        console.log('[AIAssistant] Connection status changed:', info.status);
        if (info.status === 'connected') {
          clearTimeout(timeoutHandle);
          this._binderyService?.removeListener('statusChanged', statusListener);
          resolve(true);
        } else if (info.status === 'error' || info.status === 'no_workspace') {
          clearTimeout(timeoutHandle);
          this._binderyService?.removeListener('statusChanged', statusListener);
          resolve(false);
        }
      };

      this._binderyService?.on('statusChanged', statusListener);

      // Double-check connection status in case it changed before we added the listener
      if (this._binderyService?.isConnected()) {
        clearTimeout(timeoutHandle);
        this._binderyService.removeListener('statusChanged', statusListener);
        resolve(true);
      }
    });
  }

  private async loadChannels(): Promise<void> {
    if (!this._binderyService) {
      console.warn('[AIAssistant] Bindery service not available for loading channels');
      return;
    }

    // Wait for connection to be ready (with 5 second timeout)
    const connected = await this.waitForConnection(5000);
    if (!connected) {
      console.warn('[AIAssistant] Could not establish Bindery connection, sending empty state');
      this._channels = [];
      this.sendChannelsToWebview();
      return;
    }

    console.log('[AIAssistant] Bindery connected, loading channels...');

    try {
      const listResult = await this._binderyService.listCodeices();
      console.log('[AIAssistant] listCodeices result:', listResult);

      if (!listResult.success || !listResult.data) {
        this._channels = [];
        this.sendChannelsToWebview();
        return;
      }

      // Phase 17: list_codices now returns full codex objects, not just IDs
      const codices = listResult.data;

      this._channels = codices
        .filter((codex: any) => {
          return codex.template_id === 'ai-chat' ||
                 codex.template_id === 'task-orchestrator' ||
                 codex.template_id === 'task-code-writer';
        })
        .map((codex: any) => {
          const isChat = codex.template_id === 'ai-chat';
          const status = this.determineStatus(codex);

          return {
            id: codex.id,
            title: codex.title || 'Untitled',
            templateId: codex.template_id,
            type: isChat ? 'user-chat' : 'agent-task',
            status,
            lastActivity: codex.updated_at ? new Date(codex.updated_at) : undefined,
            messageCount: this.getMessageCount(codex),
            provider_id: codex.content?.provider_id || '',
            model: codex.content?.model || ''
          } as ChatChannel;
        });

      console.log('[AIAssistant] Loaded', this._channels.length, 'channels:', this._channels);
      this.sendChannelsToWebview();

      // Restore previously selected channel if any
      const selectedChannelId = this._context.workspaceState.get<string>('vespera.aiAssistant.selectedChannelId');
      if (selectedChannelId) {
        const channel = this._channels.find(ch => ch.id === selectedChannelId);
        if (channel) {
          console.log('[AIAssistant] Restoring previously selected channel:', channel.title);
          await this.switchChannel(channel);
        }
      }
    } catch (error) {
      console.error('[AIAssistant] Failed to load channels:', error);
      this._channels = [];
      this.sendChannelsToWebview();
    }
  }

  private determineStatus(codex: any): 'active' | 'idle' | 'archived' {
    if (codex.content?.status === 'archived' || codex.metadata?.archived) {
      return 'archived';
    }

    const lastActivity = codex.updated_at ? new Date(codex.updated_at) : new Date(codex.created_at);
    const hoursSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60);

    if (hoursSinceActivity > 1) {
      return 'idle';
    }

    return 'active';
  }

  private getMessageCount(codex: any): number {
    try {
      const messages = codex.content?.messages || [];
      return Array.isArray(messages) ? messages.length : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Load available providers from Bindery backend
   */
  private async loadProviders(): Promise<void> {
    if (!this._binderyService) {
      console.warn('[AIAssistant] Bindery service not available for loading providers');
      return;
    }

    try {
      console.log('[AIAssistant] Loading providers from Bindery...');
      const result = await this._binderyService.sendRequest<any>('provider.list', {});

      if (!result.success) {
        console.warn('[AIAssistant] Failed to load providers:', result.error);
        this.sendMessageToWebview({
          command: 'updateProviderList',
          providers: []
        });
        return;
      }

      if (!result.data) {
        console.warn('[AIAssistant] No provider data returned');
        this.sendMessageToWebview({
          command: 'updateProviderList',
          providers: []
        });
        return;
      }

      const providers = result.data.providers || [];
      console.log('[AIAssistant] Loaded providers:', providers);

      this.sendMessageToWebview({
        command: 'updateProviderList',
        providers: providers.map((p: any) => ({
          id: p.codex_id,
          name: p.display_name || p.provider_type,
          type: p.provider_type
        }))
      });
    } catch (error) {
      console.error('[AIAssistant] Error loading providers:', error);
      this.sendMessageToWebview({
        command: 'updateProviderList',
        providers: []
      });
    }
  }

  /**
   * Update channel Codex with selected provider and model
   */
  private async updateChannelProvider(
    channelId: string,
    providerId: string,
    model: string
  ): Promise<void> {
    if (!this._binderyService) {
      console.warn('[AIAssistant] Bindery service not available for updating channel');
      return;
    }

    try {
      console.log('[AIAssistant] Updating channel provider:', { channelId, providerId, model });

      // Get the current channel Codex
      const getResult = await this._binderyService.getCodex(channelId);
      if (!getResult.success) {
        console.error('[AIAssistant] Failed to get channel Codex:', getResult.error);
        return;
      }

      if (!getResult.data) {
        console.error('[AIAssistant] No data returned for channel Codex');
        return;
      }

      const codex = getResult.data;

      // Update provider_id and model fields
      const updatedContent = {
        ...codex.content,
        provider_id: providerId,
        model: model
      };

      // Send update request
      const updateResult = await this._binderyService.updateCodex(channelId, {
        content: updatedContent
      });

      if (!updateResult.success) {
        console.error('[AIAssistant] Failed to update channel provider:', updateResult.error);
        vscode.window.showErrorMessage(
          `Failed to update channel provider: ${updateResult.error?.message || 'Unknown error'}`
        );
        return;
      }

      console.log('[AIAssistant] Channel provider updated successfully');

      // Update local channel data
      const channel = this._channels.find(ch => ch.id === channelId);
      if (channel) {
        (channel as any).provider_id = providerId;
        (channel as any).model = model;
      }
    } catch (error) {
      console.error('[AIAssistant] Error updating channel provider:', error);
      vscode.window.showErrorMessage(
        `Error updating channel provider: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private sendChannelsToWebview() {
    if (this._view) {
      const channelData = this._channels.map(ch => ({
        ...ch,
        lastActivity: ch.lastActivity?.toISOString()
      }));
      console.log('[AIAssistant] Sending', channelData.length, 'channels to webview');
      this._view.webview.postMessage({
        command: 'updateChannels',
        channels: channelData,
        selectedChannelId: this._activeChannel?.id // Include selected channel ID for visual highlighting
      });
    } else {
      console.warn('[AIAssistant] Cannot send channels to webview - view not available');
    }
  }

  private async createChannel(name?: string, type?: 'user-chat' | 'agent-task'): Promise<void> {
    if (!this._binderyService) {
      vscode.window.showErrorMessage('Bindery service not available. Please try again.');
      return;
    }

    // Prompt for channel name if not provided
    if (!name) {
      name = await vscode.window.showInputBox({
        prompt: 'Enter a name for the new chat channel',
        placeHolder: 'My Chat Channel',
        validateInput: (value) => {
          return value.trim().length === 0 ? 'Channel name cannot be empty' : undefined;
        }
      });

      if (!name) {
        // User cancelled
        return;
      }
    }

    // Default to user-chat if not specified
    if (!type) {
      type = 'user-chat';
    }

    console.log('[AIAssistant] Creating channel:', name, 'type:', type);

    try {
      const templateId = type === 'user-chat' ? 'ai-chat' : 'task-orchestrator';
      const result = await this._binderyService.createCodex(name, templateId);

      if (!result.success) {
        const error = 'error' in result ? result.error : { message: 'Unknown error' };
        throw new Error(error.message);
      }

      const codexId = result.data;
      console.log('[AIAssistant] Created codex with ID:', codexId);

      await this._binderyService.updateCodex(codexId, {
        content: {
          messages: [],
          summary: '',
          channel_name: name,
          channel_type: type,
          status: 'active'
        }
      });

      console.log('[AIAssistant] Updated codex content');

      // Reload channels
      await this.loadChannels();

      // Auto-select the newly created channel
      const newChannel = this._channels.find(ch => ch.id === codexId);
      if (newChannel) {
        console.log('[AIAssistant] Auto-selecting newly created channel:', newChannel.title);
        await this.switchChannel(newChannel);
      }

      vscode.window.showInformationMessage(`Created channel: ${name}`);
    } catch (error) {
      console.error('[AIAssistant] Failed to create channel:', error);
      vscode.window.showErrorMessage(`Failed to create channel: ${error}`);
    }
  }

  public refresh() {
    console.log('[AIAssistant] Refresh requested');
    this.loadChannelsWhenReady();
    this.updateWebviewContent();
  }

  public dispose() {
    console.log('[AIAssistant] Disposing AI Assistant view');

    // Clean up connection check interval
    if (this._connectionCheckInterval) {
      clearInterval(this._connectionCheckInterval);
      this._connectionCheckInterval = undefined;
    }

    // Remove all event listeners from Bindery service to prevent memory leaks
    if (this._binderyService) {
      this._binderyService.removeAllListeners('statusChanged');
      console.log('[AIAssistant] Removed all statusChanged listeners from Bindery');
    }

    // Dispose chat system
    if (this._chatSystem) {
      this._chatSystem.dispose();
      this._chatSystem = undefined;
    }

    this._view = undefined;
    this._binderyService = undefined;
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

    // Persist selected channel ID to workspace state
    await this._context.workspaceState.update('vespera.aiAssistant.selectedChannelId', channel.id);
    console.log('[AIAssistant] Persisted selected channel ID to workspace state:', channel.id);

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
            * {
                box-sizing: border-box;
            }

            body {
                font-family: var(--vscode-font-family);
                background: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
                margin: 0;
                padding: 0;
                height: 100vh;
                overflow: hidden;
            }

            /* Side-by-side layout */
            .main-container {
                display: flex;
                height: 100vh;
            }

            /* Channel list sidebar */
            .channel-list {
                width: 200px;
                background: var(--vscode-sideBar-background);
                border-right: 1px solid var(--vscode-panel-border);
                display: flex;
                flex-direction: column;
            }

            .channel-list-header {
                padding: 8px 12px;
                border-bottom: 1px solid var(--vscode-panel-border);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .channel-list-title {
                font-weight: bold;
                font-size: 11px;
                text-transform: uppercase;
                color: var(--vscode-foreground);
                opacity: 0.8;
            }

            .channel-list-actions {
                display: flex;
                gap: 4px;
            }

            .icon-btn {
                background: none;
                border: none;
                color: var(--vscode-foreground);
                cursor: pointer;
                padding: 2px 4px;
                border-radius: 3px;
                font-size: 14px;
            }

            .icon-btn:hover {
                background: var(--vscode-list-hoverBackground);
            }

            .channels-container {
                flex: 1;
                overflow-y: auto;
            }

            .channel-section {
                padding: 8px 0;
            }

            .channel-section-title {
                padding: 4px 12px;
                font-size: 11px;
                font-weight: bold;
                color: var(--vscode-descriptionForeground);
                text-transform: uppercase;
            }

            .channel-item {
                padding: 6px 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 13px;
            }

            .channel-item:hover {
                background: var(--vscode-list-hoverBackground);
            }

            .channel-item.selected {
                background: var(--vscode-list-activeSelectionBackground);
                color: var(--vscode-list-activeSelectionForeground);
            }

            .channel-icon {
                font-size: 14px;
                flex-shrink: 0;
            }

            .channel-name {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .channel-status {
                font-size: 10px;
            }

            .empty-channels {
                padding: 20px 12px;
                text-align: center;
                color: var(--vscode-descriptionForeground);
                font-size: 12px;
            }

            /* Chat panel */
            .chat-panel {
                flex: 1;
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
                gap: 12px;
            }

            .chat-title {
                font-weight: bold;
                font-size: 14px;
                flex-shrink: 0;
            }

            .chat-controls {
                display: flex;
                align-items: center;
                gap: 8px;
                flex: 1;
            }

            .control-group {
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .control-label {
                font-size: 11px;
                color: var(--vscode-descriptionForeground);
                text-transform: uppercase;
            }

            .control-select {
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                padding: 3px 6px;
                font-size: 12px;
                border-radius: 2px;
                cursor: pointer;
                min-width: 120px;
            }

            .control-select:focus {
                outline: 1px solid var(--vscode-focusBorder);
                outline-offset: -1px;
            }

            .control-select:disabled {
                opacity: 0.5;
                cursor: not-allowed;
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
        <div class="main-container">
            <!-- Channel List Sidebar -->
            <div class="channel-list">
                <div class="channel-list-header">
                    <div class="channel-list-title">CHAT CHANNELS</div>
                    <div class="channel-list-actions">
                        <button class="icon-btn" onclick="createChannel()" title="Create Channel">➕</button>
                        <button class="icon-btn" onclick="refreshChannels()" title="Refresh">⟳</button>
                    </div>
                </div>
                <div class="channels-container" id="channelsContainer">
                    <div class="empty-channels">No channels yet<br>Click + to create</div>
                </div>
            </div>

            <!-- Chat Panel -->
            <div class="chat-panel">
                <div class="chat-header">
                    <div class="chat-title" id="channelTitle">🤖 ${channelName}</div>
                    <div class="chat-controls">
                        <div class="control-group">
                            <label class="control-label">Provider:</label>
                            <select class="control-select" id="providerSelect" onchange="onProviderChange()">
                                <option value="">Loading...</option>
                            </select>
                        </div>
                        <div class="control-group">
                            <label class="control-label">Model:</label>
                            <input type="text" class="control-select" id="modelInput" placeholder="e.g., claude-sonnet-4" />
                        </div>
                    </div>
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
            </div>
        </div>

        <script>
            const vscode = acquireVsCodeApi();
            const messagesContainer = document.getElementById('messages');
            const messageInput = document.getElementById('messageInput');
            const sendBtn = document.getElementById('sendBtn');
            const channelsContainer = document.getElementById('channelsContainer');
            const providerSelect = document.getElementById('providerSelect');
            const modelInput = document.getElementById('modelInput');

            let channels = [];
            let selectedChannelId = null;
            let providers = [];
            let currentChannel = null;

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

            function updateChannels(channelData) {
                console.log('[Webview] Received updateChannels:', channelData);
                channels = channelData;
                renderChannels();
            }

            function renderChannels() {
                console.log('[Webview] Rendering', channels.length, 'channels');
                if (channels.length === 0) {
                    channelsContainer.innerHTML = '<div class="empty-channels">No channels yet<br>Click + to create</div>';
                    return;
                }

                const userChats = channels.filter(ch => ch.type === 'user-chat');
                const agentTasks = channels.filter(ch => ch.type === 'agent-task');

                let html = '';

                if (userChats.length > 0) {
                    html += '<div class="channel-section"><div class="channel-section-title">User Chats</div>';
                    userChats.forEach(channel => {
                        const statusIcon = channel.status === 'active' ? '🟢' :
                                         channel.status === 'idle' ? '🟡' : '⚪';
                        const isSelected = channel.id === selectedChannelId ? 'selected' : '';
                        html += \`<div class="channel-item \${isSelected}" onclick="selectChannel('\${channel.id}')">
                            <span class="channel-icon">💬</span>
                            <span class="channel-name">\${channel.title}</span>
                            <span class="channel-status">\${statusIcon}</span>
                        </div>\`;
                    });
                    html += '</div>';
                }

                if (agentTasks.length > 0) {
                    html += '<div class="channel-section"><div class="channel-section-title">Agent Tasks</div>';
                    agentTasks.forEach(channel => {
                        const statusIcon = channel.status === 'active' ? '🟢' :
                                         channel.status === 'idle' ? '🟡' : '⚪';
                        const isSelected = channel.id === selectedChannelId ? 'selected' : '';
                        html += \`<div class="channel-item \${isSelected}" onclick="selectChannel('\${channel.id}')">
                            <span class="channel-icon">⚡</span>
                            <span class="channel-name">\${channel.title}</span>
                            <span class="channel-status">\${statusIcon}</span>
                        </div>\`;
                    });
                    html += '</div>';
                }

                channelsContainer.innerHTML = html;
            }

            function selectChannel(channelId) {
                const channel = channels.find(ch => ch.id === channelId);
                if (channel) {
                    selectedChannelId = channelId;
                    currentChannel = channel;
                    vscode.postMessage({ command: 'selectChannel', channel: channel });
                    renderChannels();
                    updateProviderControls();
                }
            }

            // Load providers from backend
            function loadProviders() {
                console.log('[Webview] Loading providers...');
                vscode.postMessage({ command: 'loadProviders' });
            }

            // Update provider dropdown with loaded providers
            function updateProviderList(providerList) {
                console.log('[Webview] Received providers:', providerList);
                providers = providerList;

                providerSelect.innerHTML = '<option value="">-- Select Provider --</option>';
                providers.forEach(provider => {
                    const option = document.createElement('option');
                    option.value = provider.id;
                    option.textContent = provider.name || provider.id;
                    providerSelect.appendChild(option);
                });

                // Restore current channel's provider if available
                if (currentChannel && currentChannel.provider_id) {
                    providerSelect.value = currentChannel.provider_id;
                }
            }

            // Update controls when channel is selected
            function updateProviderControls() {
                if (!currentChannel) {
                    providerSelect.value = '';
                    modelInput.value = '';
                    providerSelect.disabled = true;
                    modelInput.disabled = true;
                    return;
                }

                providerSelect.disabled = false;
                modelInput.disabled = false;

                // Load from channel data
                providerSelect.value = currentChannel.provider_id || '';
                modelInput.value = currentChannel.model || '';
            }

            // Handle provider selection change
            function onProviderChange() {
                const providerId = providerSelect.value;
                console.log('[Webview] Provider changed to:', providerId);

                if (currentChannel && selectedChannelId) {
                    // Update channel with new provider_id
                    vscode.postMessage({
                        command: 'updateChannelProvider',
                        channelId: selectedChannelId,
                        providerId: providerId,
                        model: modelInput.value
                    });
                }
            }

            // Handle model input change
            modelInput.addEventListener('change', function() {
                console.log('[Webview] Model changed to:', this.value);

                if (currentChannel && selectedChannelId) {
                    // Update channel with new model
                    vscode.postMessage({
                        command: 'updateChannelProvider',
                        channelId: selectedChannelId,
                        providerId: providerSelect.value,
                        model: this.value
                    });
                }
            });

            function createChannel() {
                console.log('[Webview] Create channel button clicked');
                // Send message to extension - will prompt for name
                vscode.postMessage({ command: 'createChannel', type: 'user-chat' });
            }

            function refreshChannels() {
                console.log('[Webview] Refresh channels button clicked');
                vscode.postMessage({ command: 'refreshChannels' });
            }

            window.addEventListener('message', event => {
                const message = event.data;
                console.log('[Webview] Received message:', message.command);
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
                    case 'updateProviderList':
                        updateProviderList(message.providers);
                        break;
                    case 'updateChannels':
                        updateChannels(message.channels);
                        break;
                }
            });

            // Initialize: Load providers on webview startup
            loadProviders();

            vscode.postMessage({ command: 'ready' });
        </script>
    </body>
    </html>`;
  }
}
