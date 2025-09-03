/**
 * Main Chat Manager - Coordinates all chat system components
 */
import * as vscode from 'vscode';
import { ChatTemplateRegistry } from './TemplateRegistry';
import { ChatConfigurationManager } from './ConfigurationManager';
import { ChatEventRouter } from '../events/ChatEventRouter';
import { ProviderFactory } from '../providers/ProviderFactory';
import { ChatProvider } from '../providers/BaseProvider';
import { ChatMessage, ChatResponse, ChatThread, ChatChunk } from '../types/chat';
import { ProviderTemplate } from '../types/provider';

export interface StreamingCallback {
  onStart?: () => void;
  onChunk?: (chunk: ChatChunk) => void;
  onComplete?: (message: ChatMessage) => void;
  onError?: (error: Error) => void;
}

export class ChatManager {
  private providers = new Map<string, ChatProvider>();
  private activeProviderId?: string;
  private currentThread?: ChatThread;
  private messageHistory: ChatMessage[] = [];
  private streamingCallbacks: StreamingCallback[] = [];
  private isStreaming = false;
  
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly templateRegistry: ChatTemplateRegistry,
    private readonly configManager: ChatConfigurationManager,
    private readonly eventRouter: ChatEventRouter
  ) {
    this.setupEventListeners();
  }
  
  /**
   * Initialize the chat manager
   */
  async initialize(): Promise<void> {
    console.log('[ChatManager] Initializing chat manager...');
    
    // Load providers from templates and configuration
    await this.loadProviders();
    
    // Restore previous session if available
    await this.restoreSession();
    
    console.log('[ChatManager] Chat manager initialized');
  }
  
  /**
   * Send a message using the active provider
   */
  async sendMessage(content: string, providerId?: string): Promise<ChatResponse | null> {
    return this.sendMessageInternal(content, providerId, false);
  }
  
  /**
   * Send a streaming message using the active provider
   */
  async sendStreamingMessage(
    content: string, 
    onChunk: (chunk: ChatChunk) => void,
    providerId?: string
  ): Promise<ChatResponse | null> {
    const streamingCallback: StreamingCallback = {
      onStart: () => {
        this.isStreaming = true;
        this.eventRouter.emit({
          type: 'chatStreamStarted',
          data: { providerId: providerId || this.activeProviderId }
        });
      },
      onChunk: (chunk: ChatChunk) => {
        onChunk(chunk);
        this.eventRouter.emit({
          type: 'chatStreamChunk',
          data: { chunk }
        });
      },
      onComplete: (message: ChatMessage) => {
        this.isStreaming = false;
        this.eventRouter.emit({
          type: 'chatStreamComplete',
          data: { messageId: message.id }
        });
      },
      onError: (error: Error) => {
        this.isStreaming = false;
        this.eventRouter.emit({
          type: 'chatStreamError',
          data: { error: error.message }
        });
      }
    };
    
    this.streamingCallbacks.push(streamingCallback);
    return this.sendMessageInternal(content, providerId, true, streamingCallback);
  }
  
  /**
   * Internal message sending method
   */
  private async sendMessageInternal(
    content: string,
    providerId?: string,
    streaming = false,
    streamingCallback?: StreamingCallback
  ): Promise<ChatResponse | null> {
    const targetProviderId = providerId || this.activeProviderId;
    if (!targetProviderId) {
      throw new Error('No active provider selected');
    }
    
    const provider = this.providers.get(targetProviderId);
    if (!provider) {
      throw new Error(`Provider ${targetProviderId} not found`);
    }
    
    // Create user message
    const userMessage: ChatMessage = {
      id: this.generateMessageId(),
      role: 'user',
      content,
      timestamp: new Date(),
      threadId: this.currentThread?.id || 'default'
    };
    
    // Add to history
    this.addMessageToHistory(userMessage);
    
    // Emit message sent event
    this.eventRouter.emit({
      type: 'chatMessageSent',
      data: {
        messageId: userMessage.id,
        content: userMessage.content,
        provider: targetProviderId
      }
    });
    
    try {
      streamingCallback?.onStart?.();
      
      // Send to provider (streaming or non-streaming)
      let response: ChatResponse;
      
      if (streaming && provider.supportsStreaming?.()) {
        response = await provider.sendStreamingMessage(userMessage, (chunk: ChatChunk) => {
          streamingCallback?.onChunk?.(chunk);
        });
      } else {
        response = await provider.sendMessage(userMessage);
      }
      
      // Create response message
      const responseMessage: ChatMessage = {
        id: response.id,
        role: response.role,
        content: response.content,
        timestamp: response.timestamp,
        threadId: userMessage.threadId,
        metadata: {
          provider: targetProviderId,
          ...response.metadata
        }
      };
      
      // Add to history
      this.addMessageToHistory(responseMessage);
      
      // Emit message received event
      this.eventRouter.emit({
        type: 'chatMessageReceived',
        data: {
          messageId: responseMessage.id,
          content: responseMessage.content,
          provider: targetProviderId
        }
      });
      
      streamingCallback?.onComplete?.(responseMessage);
      
      // Save message history to storage
      await this.saveHistoryToStorage();
      
      return response;
    } catch (error) {
      console.error('[ChatManager] Error sending message:', error);
      
      // Add error message to history
      const errorMessage: ChatMessage = {
        id: this.generateMessageId(),
        role: 'assistant',
        content: 'Sorry, I encountered an error while processing your message.',
        timestamp: new Date(),
        threadId: userMessage.threadId,
        metadata: {
          provider: targetProviderId,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
      
      this.addMessageToHistory(errorMessage);
      
      streamingCallback?.onError?.(error instanceof Error ? error : new Error('Unknown error'));
      throw error;
    }
  }
  
  /**
   * Switch to a different provider
   */
  async switchProvider(providerId: string): Promise<void> {
    if (!this.providers.has(providerId)) {
      throw new Error(`Provider ${providerId} not found`);
    }
    
    const currentProvider = this.activeProviderId;
    this.activeProviderId = providerId;
    
    // Emit provider change event
    this.eventRouter.emit({
      type: 'chatProviderChanged',
      data: {
        from: currentProvider,
        to: providerId
      }
    });
    
    console.log(`[ChatManager] Switched to provider: ${providerId}`);
  }
  
  /**
   * Add or update a provider
   */
  async addProvider(template: ProviderTemplate, config: any): Promise<void> {
    try {
      const provider = ProviderFactory.createProvider(template, config, this.configManager);
      
      // Connect the provider
      await provider.connect();
      
      // Store provider
      this.providers.set(template.template_id, provider);
      
      // Set as active if no active provider
      if (!this.activeProviderId) {
        this.activeProviderId = template.template_id;
      }
      
      // Emit provider connected event
      this.eventRouter.emit({
        type: 'chatProviderConnected',
        data: {
          providerId: template.template_id,
          providerName: template.name
        }
      });
      
      console.log(`[ChatManager] Added provider: ${template.template_id}`);
    } catch (error) {
      console.error(`[ChatManager] Failed to add provider ${template.template_id}:`, error);
      throw error;
    }
  }
  
  /**
   * Remove a provider
   */
  async removeProvider(providerId: string): Promise<void> {
    const provider = this.providers.get(providerId);
    if (provider) {
      await provider.disconnect();
      provider.dispose();
      this.providers.delete(providerId);
      
      // Switch to another provider if this was active
      if (this.activeProviderId === providerId) {
        const remainingProviders = Array.from(this.providers.keys());
        this.activeProviderId = remainingProviders[0];
      }
      
      // Emit provider disconnected event
      this.eventRouter.emit({
        type: 'chatProviderDisconnected',
        data: {
          providerId
        }
      });
      
      console.log(`[ChatManager] Removed provider: ${providerId}`);
    }
  }
  
  /**
   * Get current chat state
   */
  getState() {
    return {
      providers: Array.from(this.providers.entries()).map(([id, provider]) => ({
        id,
        name: provider.getTemplate().name,
        status: provider.getStatus(),
        capabilities: provider.getCapabilities(),
        template: provider.getTemplate()
      })),
      activeProviderId: this.activeProviderId,
      currentThread: this.currentThread,
      messageHistory: [...this.messageHistory]
    };
  }
  
  /**
   * Clear chat history
   */
  async clearHistory(): Promise<void> {
    this.messageHistory = [];
    this.currentThread = {
      id: 'default',
      title: 'Chat',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      providerId: this.activeProviderId || 'unknown',
      metadata: {}
    };
    
    // Clear from storage
    await this.context.globalState.update('chatHistory', []);
    await this.context.globalState.update('currentThread', this.currentThread);
    
    console.log('[ChatManager] Chat history cleared');
  }
  
  /**
   * Export chat history
   */
  exportHistory(format: 'json' | 'markdown' = 'json'): string {
    if (format === 'markdown') {
      return this.exportAsMarkdown();
    }
    
    return JSON.stringify({
      thread: this.currentThread,
      messages: this.messageHistory,
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    }, null, 2);
  }
  
  private async loadProviders(): Promise<void> {
    console.log('[ChatManager] Loading providers from templates with secure configuration...');
    
    const providerTemplates = this.templateRegistry.getTemplatesByCategory('llm_provider');
    const config = this.configManager.getConfiguration();
    
    for (const template of providerTemplates) {
      const providerConfig = config.providers[template.template_id];
      if (providerConfig && providerConfig.enabled) {
        try {
          // Use secure configuration retrieval that handles VS Code SecretStorage
          const decryptedConfig = await this.configManager.getDecryptedProviderConfig(template.template_id);
          if (decryptedConfig) {
            await this.addProvider(template, decryptedConfig);
            console.log(`[ChatManager] Successfully loaded provider ${template.template_id} with secure configuration`);
          } else {
            console.warn(`[ChatManager] No decrypted configuration available for provider ${template.template_id}`);
          }
        } catch (error) {
          console.error(`Failed to load provider ${template.template_id} with secure configuration:`, error);
          vscode.window.showWarningMessage(
            `Failed to load ${template.name || template.template_id} provider. Please reconfigure your API keys.`
          );
        }
      }
    }
  }
  
  private async restoreSession(): Promise<void> {
    console.log('[ChatManager] Restoring session...');
    
    try {
      // Try to load from VS Code storage
      const storedHistory = this.context.globalState.get<ChatMessage[]>('chatHistory', []);
      const storedThread = this.context.globalState.get<ChatThread>('currentThread');
      
      if (storedHistory.length > 0) {
        this.messageHistory = storedHistory.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }
      
      if (storedThread) {
        this.currentThread = {
          ...storedThread,
          createdAt: new Date(storedThread.createdAt),
          updatedAt: new Date(storedThread.updatedAt),
          messages: this.messageHistory
        };
      } else {
        // Create a default thread
        this.currentThread = {
          id: 'default',
          title: 'Chat',
          messages: this.messageHistory,
          createdAt: new Date(),
          updatedAt: new Date(),
          providerId: this.activeProviderId || 'unknown',
          metadata: {}
        };
      }
    } catch (error) {
      console.error('[ChatManager] Failed to restore session:', error);
      // Fallback to default thread
      this.currentThread = {
        id: 'default',
        title: 'Chat',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        providerId: this.activeProviderId || 'unknown',
        metadata: {}
      };
    }
  }
  
  private setupEventListeners(): void {
    // Listen for template changes
    this.eventRouter.on('chatProviderConnected', async (data) => {
      console.log('[ChatManager] Provider connected:', data.providerId);
    });
    
    // Listen for configuration changes
    this.configManager.watchConfiguration('providers', async (config) => {
      await this.reloadProviders(config);
    });
  }
  
  private async reloadProviders(config: any): Promise<void> {
    // TODO: Reload providers when configuration changes
    console.log('[ChatManager] Reloading providers due to configuration change');
  }
  
  private addMessageToHistory(message: ChatMessage): void {
    this.messageHistory.push(message);
    
    // Update current thread
    if (this.currentThread) {
      this.currentThread.messages = [...this.messageHistory];
      this.currentThread.updatedAt = new Date();
    }
    
    // Limit history size
    const maxHistorySize = this.configManager.getConfiguration().advanced.maxHistorySize;
    if (this.messageHistory.length > maxHistorySize) {
      this.messageHistory = this.messageHistory.slice(-maxHistorySize);
    }
  }
  
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private exportAsMarkdown(): string {
    // TODO: Implement markdown export
    const header = `# Chat History\n\nExported: ${new Date().toISOString()}\n\n`;
    const messages = this.messageHistory.map(msg => 
      `## ${msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}\n\n${msg.content}\n`
    ).join('\n');
    
    return header + messages;
  }
  
  /**
   * Save message history to VS Code storage
   */
  private async saveHistoryToStorage(): Promise<void> {
    try {
      await this.context.globalState.update('chatHistory', this.messageHistory);
      if (this.currentThread) {
        await this.context.globalState.update('currentThread', this.currentThread);
      }
    } catch (error) {
      console.error('[ChatManager] Failed to save history to storage:', error);
    }
  }
  
  /**
   * Get streaming status
   */
  getStreamingStatus(): boolean {
    return this.isStreaming;
  }
  
  /**
   * Retry last message
   */
  async retryLastMessage(): Promise<ChatResponse | null> {
    const lastUserMessage = [...this.messageHistory].reverse().find(m => m.role === 'user');
    if (!lastUserMessage) {
      throw new Error('No user message to retry');
    }
    
    // Remove any assistant responses after the last user message
    const userMessageIndex = this.messageHistory.findIndex(m => m.id === lastUserMessage.id);
    this.messageHistory = this.messageHistory.slice(0, userMessageIndex + 1);
    
    return this.sendMessage(lastUserMessage.content);
  }
  
  /**
   * Retry specific message by ID
   */
  async retryMessage(messageId: string): Promise<ChatResponse | null> {
    const messageIndex = this.messageHistory.findIndex(m => m.id === messageId);
    if (messageIndex === -1) {
      throw new Error('Message not found');
    }
    
    const message = this.messageHistory[messageIndex];
    if (message.role !== 'user') {
      throw new Error('Can only retry user messages');
    }
    
    // Remove messages after this one
    this.messageHistory = this.messageHistory.slice(0, messageIndex + 1);
    
    return this.sendMessage(message.content);
  }
  
  /**
   * Dispose of the chat manager
   */
  dispose(): void {
    console.log('[ChatManager] Disposing chat manager...');
    
    // Disconnect all providers
    this.providers.forEach(async (provider) => {
      await provider.disconnect();
      provider.dispose();
    });
    
    this.providers.clear();
    this.messageHistory = [];
    this.currentThread = undefined;
    
    console.log('[ChatManager] Chat manager disposed');
  }
}