/**
 * Claude Code Provider for Vespera Forge chat system
 * Uses the official Claude Code TypeScript SDK with file context integration
 */
import { ChatProvider } from './BaseProvider';
import { ProviderTemplate, ProviderConfig, ProviderStatus } from '../types/provider';
import { ChatMessage, ChatResponse, ChatChunk, HistoryContextOptions } from '../types/chat';
import { FileContextManager, ContextualMessage } from '../context';

// Dynamic import for ES module compatibility
const query = async () => {
  const { query } = await import('@anthropic-ai/claude-code');
  return query;
};

export class ClaudeCodeProvider extends ChatProvider {
  private connectionStatus: ProviderStatus = ProviderStatus.Disconnected;
  private fileContextManager?: FileContextManager;
  private historyManager?: any; // ChatHistoryManager - will be injected

  constructor(template: ProviderTemplate, config: ProviderConfig) {
    super(template, config);
    
    // Initialize file context manager if enabled in config
    if (this.config['fileContextEnabled'] !== false) {
      this.initializeFileContext();
    }
  }

  /**
   * Initialize file context manager with configuration
   */
  private initializeFileContext(): void {
    try {
      const contextConfig = {
        enabled: this.config['fileContextEnabled'] !== false,
        autoCollect: this.config['fileContextAutoCollect'] !== false,
        contextOptions: {
          includeActiveFile: this.config['fileContextIncludeActiveFile'] !== false,
          includeSelection: this.config['fileContextIncludeSelection'] !== false,
          includeCursorArea: this.config['fileContextIncludeCursorArea'] !== false,
          includeOpenTabs: this.config['fileContextIncludeOpenTabs'] === true,
          cursorContextLines: parseInt(this.config['fileContextCursorLines']) || 10,
          maxFileSize: parseInt(this.config['fileContextMaxFileSize']) || 10000,
          maxTotalSize: parseInt(this.config['fileContextMaxTotalSize']) || 50000,
          excludePatterns: this.config['fileContextExcludePatterns'] || [
            '**/.git/**',
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/*.min.js',
            '**/*.bundle.js'
          ]
        }
      };
      
      this.fileContextManager = new FileContextManager(contextConfig);
      console.log('[ClaudeCodeProvider] File context manager initialized');
    } catch (error) {
      console.error('[ClaudeCodeProvider] Failed to initialize file context:', error);
      // Continue without file context if initialization fails
      this.fileContextManager = undefined;
    }
  }

  async connect(): Promise<void> {
    try {
      // Claude Code SDK doesn't need explicit connection setup
      // Just validate that we can import the SDK and set status
      this.connectionStatus = ProviderStatus.Connected;
      this.emitStatusChange(ProviderStatus.Connected);
      console.log('[ClaudeCodeProvider] Connected successfully');
    } catch (error) {
      this.emitStatusChange(ProviderStatus.Error, `Connection failed: ${error}`);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.connectionStatus = ProviderStatus.Disconnected;
      this.emitStatusChange(ProviderStatus.Disconnected);
      console.log('[ClaudeCodeProvider] Disconnected successfully');
    } catch (error) {
      this.emitError(new Error(`Disconnect failed: ${error}`));
      throw error;
    }
  }

  async sendMessage(message: ChatMessage): Promise<ChatResponse> {
    if (this.connectionStatus !== ProviderStatus.Connected) {
      throw new Error('Provider not connected');
    }

    try {
      // Use Claude Code SDK without streaming for simple responses
      const claudeQuery = await query();
      const messages: string[] = [];
      
      for await (const sdkMessage of claudeQuery({
        prompt: message.content,
        options: {
          maxTurns: this.config['maxTurns'] || 1,
          customSystemPrompt: this.config['systemPrompt'] || "You are Claude, a helpful AI assistant.",
          allowedTools: (this.config['allowedTools'] || "Read,Write,Bash").split(',')
        }
      })) {
        if (sdkMessage.type === "result" && sdkMessage.subtype === "success") {
          messages.push(sdkMessage.result);
        }
      }

      const responseContent = messages.join('\n') || 'No response received';
      
      return this.createResponse(responseContent, {
        model: 'claude-sonnet-4',
        provider: 'claude-code',
        finish_reason: 'completed'
      });
    } catch (error) {
      this.emitError(new Error(`Send message failed: ${error}`));
      throw error;
    }
  }

  async *streamMessage(message: ChatMessage): AsyncIterable<ChatChunk> {
    if (this.connectionStatus !== ProviderStatus.Connected) {
      throw new Error('Provider not connected');
    }

    try {
      console.log('[ClaudeCodeProvider] Starting streaming with message:', message.content?.substring(0, 100));
      
      // Prepare contextual message if file context is enabled
      let contextualMessage: ContextualMessage | null = null;
      let messageToSend = message.content;
      
      if (this.fileContextManager?.isEnabled()) {
        try {
          console.log('[ClaudeCodeProvider] Collecting file context...');
          contextualMessage = await this.fileContextManager.createContextualMessage(message.content);
          
          if (contextualMessage.hasContext) {
            messageToSend = contextualMessage.contextualContent;
            console.log('[ClaudeCodeProvider] Using contextual message with context:', contextualMessage.contextSummary);
            
            // Yield a context info chunk if enabled
            if (this.config['showContextInfo'] !== false) {
              yield {
                content: `📁 **Context:** ${contextualMessage.contextSummary}\n\n`,
                done: false,
                metadata: {
                  provider: 'claude-code',
                  contextInfo: true
                }
              };
            }
          } else {
            console.log('[ClaudeCodeProvider] No context collected:', contextualMessage.contextSummary);
          }
        } catch (error) {
          console.error('[ClaudeCodeProvider] Context collection failed:', error);
          // Continue with original message if context collection fails
        }
      }
      
      console.log('[ClaudeCodeProvider] Environment check:', {
        CLAUDE_CODE_SSE_PORT: process.env['CLAUDE_CODE_SSE_PORT'],
        ENABLE_IDE_INTEGRATION: process.env['ENABLE_IDE_INTEGRATION'],
        NODE_ENV: process.env['NODE_ENV']
      });
      
      const claudeQuery = await query();
      
      // Configure allowed tools based on config
      let allowedTools: string[] = [];
      const toolsConfig = this.config['allowedTools'];
      if (toolsConfig === 'All') {
        // Let Claude Code use all default tools
        allowedTools = [];
      } else if (typeof toolsConfig === 'string' && toolsConfig) {
        allowedTools = toolsConfig.split(',').map(tool => tool.trim());
      }
      
      const queryOptions = {
        maxTurns: this.config['maxTurns'] || 1,
        customSystemPrompt: this.config['systemPrompt'] || "You are Claude, a helpful AI assistant. You have access to file context when relevant.",
        allowedTools: allowedTools
      };
      
      console.log('[ClaudeCodeProvider] Query options:', queryOptions);
      console.log('[ClaudeCodeProvider] Message length:', messageToSend.length);
      
      const queryIterator = claudeQuery({
        prompt: messageToSend,
        options: queryOptions
      });
      
      console.log('[ClaudeCodeProvider] Created query iterator');
      
      let messageCount = 0;
      let hasResponse = false;
      
      for await (const sdkMessage of queryIterator) {
        messageCount++;
        console.log(`[ClaudeCodeProvider] Received SDK message ${messageCount}:`, sdkMessage.type);
        
        if (sdkMessage.type === "result" && sdkMessage.subtype === "success") {
          console.log('[ClaudeCodeProvider] Success result:', sdkMessage.result);
          hasResponse = true;
          yield {
            content: sdkMessage.result,
            done: true,
            metadata: {
              provider: 'claude-code',
              model: 'claude-sonnet-4',
              finish_reason: 'completed'
            }
          };
          return;
        } else if (sdkMessage.type === "assistant") {
          // Skip assistant messages - we'll use the final result instead to avoid duplication
          const content = sdkMessage.message?.content?.[0];
          if (content && typeof content === 'object' && 'text' in content) {
            console.log('[ClaudeCodeProvider] Assistant content:', content.text.substring(0, 100));
            // Don't yield here - wait for the final result to avoid duplication
          }
        } else if (sdkMessage.type === "result") {
          // Handle error results
          console.log('[ClaudeCodeProvider] Error result:', sdkMessage.subtype);
          yield {
            content: `Error: ${sdkMessage.subtype || 'Unknown error'}`,
            done: true,
            metadata: {
              provider: 'claude-code',
              error: true
            }
          };
          return;
        }
      }
      
      console.log(`[ClaudeCodeProvider] Finished iterating, received ${messageCount} messages, hasResponse: ${hasResponse}`);
      
      // Final completion chunk if we had assistant messages
      if (hasResponse) {
        yield {
          content: '',
          done: true,
          metadata: {
            provider: 'claude-code',
            model: 'claude-sonnet-4',
            finish_reason: 'completed'
          }
        };
      } else {
        yield {
          content: 'No response received from Claude Code SDK',
          done: true,
          metadata: {
            provider: 'claude-code',
            finish_reason: 'no_response'
          }
        };
      }

    } catch (error) {
      console.error('[ClaudeCodeProvider] Streaming failed:', error);
      yield {
        content: `Streaming failed: ${error}`,
        done: true,
        metadata: {
          provider: 'claude-code',
          error: true
        }
      };
      this.emitError(new Error(`Stream message failed: ${error}`));
    }
  }

  // Override status to use local connection status
  override getStatus(): ProviderStatus {
    return this.connectionStatus;
  }

  // Additional helper methods specific to Claude Code
  public async testConnection(): Promise<boolean> {
    try {
      // Simple test query to verify Claude Code SDK is working
      const claudeQuery = await query();
      let hasResponse = false;
      for await (const message of claudeQuery({
        prompt: "Hello, this is a connection test. Please respond with 'Connected'.",
        options: {
          maxTurns: 1,
          customSystemPrompt: "Respond only with the word 'Connected'."
        }
      })) {
        if (message.type === "result" && message.subtype === "success") {
          hasResponse = true;
          break;
        }
      }
      return hasResponse;
    } catch (error) {
      console.error('[ClaudeCodeProvider] Connection test failed:', error);
      return false;
    }
  }

  public updateAllowedTools(tools: string[]): void {
    this.config['allowedTools'] = tools.join(',');
    this.eventEmitter.emit('configUpdated', this.config);
  }

  public updateSystemPrompt(systemPrompt: string): void {
    this.config['systemPrompt'] = systemPrompt;
    this.eventEmitter.emit('configUpdated', this.config);
  }

  public updateMaxTurns(maxTurns: number): void {
    this.config['maxTurns'] = maxTurns;
    this.eventEmitter.emit('configUpdated', this.config);
  }

  /**
   * Enable or disable file context collection
   */
  public setFileContextEnabled(enabled: boolean): void {
    this.config['fileContextEnabled'] = enabled;
    
    if (enabled && !this.fileContextManager) {
      this.initializeFileContext();
    } else if (!enabled && this.fileContextManager) {
      this.fileContextManager.setEnabled(false);
    } else if (this.fileContextManager) {
      this.fileContextManager.setEnabled(enabled);
    }
    
    this.eventEmitter.emit('configUpdated', this.config);
    console.log(`[ClaudeCodeProvider] File context ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get current file context status
   */
  public getFileContextStatus(): { enabled: boolean; hasContext: boolean } {
    return {
      enabled: this.fileContextManager?.isEnabled() || false,
      hasContext: this.fileContextManager !== undefined
    };
  }

  /**
   * Update file context configuration
   */
  public updateFileContextConfig(options: any): void {
    if (this.fileContextManager) {
      this.fileContextManager.updateConfig(options);
      
      // Update provider config to persist changes
      Object.keys(options).forEach(key => {
        this.config[key] = options[key];
      });
      
      this.eventEmitter.emit('configUpdated', this.config);
      console.log('[ClaudeCodeProvider] File context configuration updated');
    }
  }

  /**
   * Force collect file context (for debugging/testing)
   */
  public async collectContextNow(): Promise<any[]> {
    if (this.fileContextManager) {
      return await this.fileContextManager.collectContextNow();
    }
    return [];
  }

  /**
   * Override dispose to clean up file context manager
   */
  public override dispose(): void {
    if (this.fileContextManager) {
      this.fileContextManager.dispose();
      this.fileContextManager = undefined;
    }
    super.dispose();
    console.log('[ClaudeCodeProvider] Provider disposed with file context cleanup');
  }

  /**
   * Set the history manager for conversation context
   */
  public setHistoryManager(historyManager: any): void {
    this.historyManager = historyManager;
    console.log('[ClaudeCodeProvider] History manager connected for conversation context');
  }

  /**
   * Build conversation context from history
   */
  private buildConversationContext(sessionId: string, currentMessage: string): string {
    if (!this.historyManager || !sessionId) {
      return currentMessage;
    }

    try {
      const options: HistoryContextOptions = {
        maxMessages: this.config['conversationContextMessages'] || 6,
        maxTokens: this.config['conversationContextTokens'] || 2000,
        includeSystemMessages: false,
        messageTypes: ['user', 'assistant'],
        prioritizeRecent: true
      };

      // Get conversation context from history manager
      const conversationHistory = this.historyManager.buildConversationContext(sessionId, options);
      
      if (!conversationHistory) {
        return currentMessage;
      }

      // Build contextualized message
      let contextMessage = '';
      
      if (this.config['includeConversationHistory'] !== false) {
        contextMessage += conversationHistory + '\n\n';
        console.log(`[ClaudeCodeProvider] Added conversation context: ${conversationHistory.length} characters`);
      }

      contextMessage += `Current message: ${currentMessage}`;
      
      return contextMessage;
      
    } catch (error) {
      console.error('[ClaudeCodeProvider] Failed to build conversation context:', error);
      return currentMessage;
    }
  }

  /**
   * Enhanced streaming with conversation context
   */
  public async *streamMessageWithContext(message: ChatMessage): AsyncIterable<ChatChunk> {
    if (this.connectionStatus !== ProviderStatus.Connected) {
      throw new Error('Provider not connected');
    }

    try {
      console.log('[ClaudeCodeProvider] Starting contextual streaming with message:', message.content?.substring(0, 100));
      
      // Build conversation context
      let contextualContent = message.content;
      if (message.sessionId && this.config['useConversationContext'] !== false) {
        contextualContent = this.buildConversationContext(message.sessionId, message.content);
      }
      
      // Prepare contextual message if file context is enabled
      let contextualMessage: ContextualMessage | null = null;
      let messageToSend = contextualContent;
      
      if (this.fileContextManager?.isEnabled()) {
        try {
          console.log('[ClaudeCodeProvider] Collecting file context...');
          contextualMessage = await this.fileContextManager.createContextualMessage(contextualContent);
          
          if (contextualMessage.hasContext) {
            messageToSend = contextualMessage.contextualContent;
            console.log('[ClaudeCodeProvider] Using contextual message with context:', contextualMessage.contextSummary);
            
            // Yield a context info chunk if enabled
            if (this.config['showContextInfo'] !== false) {
              yield {
                content: `🧠 **Conversation Context + File Context**: ${contextualMessage.contextSummary}\n\n`,
                done: false,
                metadata: {
                  provider: 'claude-code',
                  contextInfo: true,
                  hasConversationHistory: message.sessionId ? true : false
                }
              };
            }
          } else {
            console.log('[ClaudeCodeProvider] No file context collected, using conversation context only');
            if (this.config['showContextInfo'] !== false && message.sessionId) {
              yield {
                content: `🧠 **Conversation Context**: Using recent conversation history\n\n`,
                done: false,
                metadata: {
                  provider: 'claude-code',
                  contextInfo: true,
                  hasConversationHistory: true
                }
              };
            }
          }
        } catch (error) {
          console.error('[ClaudeCodeProvider] Context collection failed:', error);
          // Continue with conversation context only
        }
      } else if (message.sessionId && this.config['showContextInfo'] !== false) {
        // Show conversation context info even when file context is disabled
        yield {
          content: `🧠 **Conversation Context**: Using recent conversation history\n\n`,
          done: false,
          metadata: {
            provider: 'claude-code',
            contextInfo: true,
            hasConversationHistory: true
          }
        };
      }
      
      // Continue with original streaming logic
      const claudeQuery = await query();
      
      // Configure allowed tools based on config
      let allowedTools: string[] = [];
      const toolsConfig = this.config['allowedTools'];
      if (toolsConfig === 'All') {
        allowedTools = [];
      } else if (typeof toolsConfig === 'string' && toolsConfig) {
        allowedTools = toolsConfig.split(',').map(tool => tool.trim());
      }
      
      const queryOptions = {
        maxTurns: this.config['maxTurns'] || 1,
        customSystemPrompt: this.config['systemPrompt'] || "You are Claude, a helpful AI assistant. You have access to conversation history and file context when relevant.",
        allowedTools: allowedTools
      };
      
      console.log('[ClaudeCodeProvider] Query options with context:', queryOptions);
      console.log('[ClaudeCodeProvider] Final message length:', messageToSend.length);
      
      const queryIterator = claudeQuery({
        prompt: messageToSend,
        options: queryOptions
      });
      
      let messageCount = 0;
      let hasResponse = false;
      
      for await (const sdkMessage of queryIterator) {
        messageCount++;
        console.log(`[ClaudeCodeProvider] Received SDK message ${messageCount}:`, sdkMessage.type);
        
        if (sdkMessage.type === "result" && sdkMessage.subtype === "success") {
          console.log('[ClaudeCodeProvider] Success result:', sdkMessage.result);
          hasResponse = true;
          yield {
            content: sdkMessage.result,
            done: true,
            metadata: {
              provider: 'claude-code',
              model: 'claude-sonnet-4',
              finish_reason: 'completed',
              usedContext: true,
              conversationHistory: !!message.sessionId,
              fileContext: contextualMessage?.hasContext || false
            }
          };
          return;
        } else if (sdkMessage.type === "assistant") {
          // Skip assistant messages - we'll use the final result instead to avoid duplication
          const content = sdkMessage.message?.content?.[0];
          if (content && typeof content === 'object' && 'text' in content) {
            console.log('[ClaudeCodeProvider] Assistant content:', content.text.substring(0, 100));
          }
        } else if (sdkMessage.type === "result") {
          console.log('[ClaudeCodeProvider] Error result:', sdkMessage.subtype);
          yield {
            content: `Error: ${sdkMessage.subtype || 'Unknown error'}`,
            done: true,
            metadata: {
              provider: 'claude-code',
              error: true
            }
          };
          return;
        }
      }
      
      console.log(`[ClaudeCodeProvider] Finished contextual streaming, received ${messageCount} messages, hasResponse: ${hasResponse}`);
      
      if (!hasResponse) {
        yield {
          content: 'No response received from Claude Code SDK',
          done: true,
          metadata: {
            provider: 'claude-code',
            finish_reason: 'no_response'
          }
        };
      }

    } catch (error) {
      console.error('[ClaudeCodeProvider] Contextual streaming failed:', error);
      yield {
        content: `Contextual streaming failed: ${error}`,
        done: true,
        metadata: {
          provider: 'claude-code',
          error: true
        }
      };
      this.emitError(new Error(`Stream message with context failed: ${error}`));
    }
  }
}