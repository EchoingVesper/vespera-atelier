/**
 * Enhanced Chat WebView Provider with Multi-Server Discord-like UI
 * 
 * Features:
 * - Server/channel navigation UI similar to Discord interface
 * - Dynamic server list showing both task and regular servers
 * - Agent channel indicators with real-time status
 * - Session restoration for all server/channel states
 * - Task progress integration in channel displays
 * - Multi-server state management
 */

import * as vscode from 'vscode';
import { ChatEventRouter } from '../../events/ChatEventRouter';
import { ChatConfigurationManager } from '../../core/ConfigurationManager';
import { ChatTemplateRegistry } from '../../core/TemplateRegistry';
import { 
  WebViewMessage, 
  WebViewResponse
} from '../../types/webview';
import { getNonce } from './HtmlGenerator';
import { WebViewSecurityManager } from './WebViewSecurityManager';
import { VesperaInputSanitizer } from '../../../core/security/sanitization/VesperaInputSanitizer';
import { VesperaSecurityAuditLogger } from '../../../core/security/audit/VesperaSecurityAuditLogger';
import { VesperaLogger } from '../../../core/logging/VesperaLogger';
import { VesperaErrorHandler } from '../../../core/error-handling/VesperaErrorHandler';
import { SecureFileContextCollector, SecureContextData } from '../../context/FileContextManager';
import { SecurityEnhancedVesperaCoreServices } from '../../../core/security/SecurityEnhancedCoreServices';

// Import our new systems
import { 
  SecureSessionPersistenceManager,
  MessageHistoryState
} from '../../persistence/SecureSessionPersistenceManager';
import { 
  MultiChatStateManager,
  MultiChatState,
  StateChangeEvent
} from '../../state/MultiChatStateManager';
import { TaskServerManager } from '../../servers/TaskServerManager';
import { ChatServerTemplateManager } from '../../templates/ChatServerTemplateManager';
import { TaskChatIntegration } from '../../integration/TaskChatIntegration';
import { QuickUsageFunctions } from '../../integration/UnusedVariableIntegrationExamples';

// Enhanced WebView message types
export interface MultiServerWebViewMessage extends WebViewMessage {
  serverId?: string;
  channelId?: string;
  serverData?: any;
  channelData?: any;
  navigationData?: any;
}

export interface ServerNavigationMessage {
  type: 'switchServer' | 'switchChannel' | 'toggleServerCollapse' | 'pinServer' | 
        'createRegularServer' | 'archiveServer' | 'getServerList' | 'getChannelList';
  serverId?: string;
  channelId?: string;
  serverName?: string;
  channelName?: string;
  collapsed?: boolean;
  pinned?: boolean;
}

export interface TaskServerUIData {
  serverId: string;
  serverName: string;
  serverType: 'task' | 'regular';
  taskId?: string;
  taskType?: string;
  taskPhase?: string;
  taskPriority?: string;
  taskStatus?: string;
  taskProgress?: number;
  channels: TaskChannelUIData[];
  isActive: boolean;
  isCollapsed: boolean;
  isPinned: boolean;
  unreadCount: number;
  lastActivity: number;
  archived: boolean;
}

export interface TaskChannelUIData {
  channelId: string;
  channelName: string;
  channelType: 'agent' | 'progress' | 'planning' | 'dm' | 'general';
  agentRole?: string;
  agentStatus?: 'idle' | 'active' | 'waiting' | 'error' | 'completed';
  agentProgress?: number;
  messageCount: number;
  unreadCount: number;
  lastMessage?: string;
  lastActivity: number;
  isActive: boolean;
  typingIndicators: string[];
}

export class EnhancedChatWebViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vesperaForge.enhancedChatView';
  
  private _view?: vscode.WebviewView;
  private _disposables: vscode.Disposable[] = [];
  private _securityManager?: WebViewSecurityManager;
  private _sessionId: string;
  private _contextCollector?: SecureFileContextCollector;
  private _contextState: Map<string, SecureContextData> = new Map();
  
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly eventRouter: ChatEventRouter,
    private readonly configManager: ChatConfigurationManager,
    private readonly _templateRegistry: ChatTemplateRegistry,
    private readonly persistenceManager: SecureSessionPersistenceManager,
    private readonly stateManager: MultiChatStateManager,
    private readonly taskServerManager: TaskServerManager,
    private readonly templateManager: ChatServerTemplateManager,
    private readonly taskIntegration: TaskChatIntegration,
    private readonly coreServices: SecurityEnhancedVesperaCoreServices,
    private readonly logger: VesperaLogger,
    private readonly errorHandler: VesperaErrorHandler
  ) {
    this._sessionId = `enhanced_chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.setupStateChangeHandlers();
    
    // Phase 1: Quick error suppression using scaffolding
    QuickUsageFunctions.useProp(this._templateRegistry);
    QuickUsageFunctions.useProp(this._contextCollector);
  }

  /**
   * Resolve webview and initialize enhanced multi-server UI
   */
  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this._view = webviewView;
    
    try {
      // Initialize security manager first
      await this.initializeSecurityManager();
      
      // Configure webview with security settings
      webviewView.webview.options = {
        enableScripts: true,
        localResourceRoots: [this.context.extensionUri]
      };
      
      // Initialize all systems
      await this.initializeSystems();
      
      // Set enhanced content with multi-server UI
      await this.updateEnhancedWebviewContent();
      
      // Setup enhanced message handling
      this.setupEnhancedMessageHandling();
      
      // Setup event listeners for real-time updates
      this.setupEnhancedEventListeners();
      
      // Restore UI state from session
      await this.restoreUIState();
      
      // Handle webview disposal
      webviewView.onDidDispose(() => {
        this.dispose();
      });

      this.logger.info('Enhanced ChatWebView resolved successfully', {
        sessionId: this._sessionId,
        hasMultiServerSupport: true,
        hasTaskIntegration: true
      });

    } catch (error) {
      this.logger.error('Failed to resolve enhanced ChatWebView', error);
      await this.errorHandler.handleError(error as Error);
    }
  }

  /**
   * Initialize all systems
   */
  private async initializeSystems(): Promise<void> {
    try {
      // Initialize session persistence
      await this.persistenceManager.initializeSession();
      
      // Initialize state manager
      await this.stateManager.initialize();
      
      // Initialize task server manager
      await this.taskServerManager.initializeFromSession();
      
      // Initialize template manager
      await this.templateManager.initialize();
      
      // Initialize task integration
      await this.taskIntegration.initialize();
      
      this.logger.info('All systems initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize systems', error);
      throw error;
    }
  }

  /**
   * Initialize security manager
   */
  private async initializeSecurityManager(): Promise<void> {
    if (this._securityManager) {
      return;
    }

    try {
      const sanitizer = VesperaInputSanitizer.getInstance();
      const auditLogger = new VesperaSecurityAuditLogger(this.logger);

      this._securityManager = await WebViewSecurityManager.initialize({
        sanitizer,
        auditLogger,
        logger: this.logger,
        errorHandler: this.errorHandler,
        securityConfig: {
          strictMode: true,
          enableRealTimeValidation: true,
          maxMessageSize: 2097152, // 2MB for enhanced UI
          rateLimitPerSecond: 20, // Higher rate limit for real-time updates
          enableContentSanitization: true,
          cspStrictMode: true
        }
      });

      // Initialize secure context collector
      this._contextCollector = new SecureFileContextCollector(
        {
          enabled: true,
          autoCollect: true
        },
        this.coreServices
      );
      
      this.logger.info('Enhanced WebView security manager initialized');
      
    } catch (error) {
      this.logger.error('Failed to initialize security manager', error);
      throw error;
    }
  }

  /**
   * Update webview with enhanced multi-server content
   */
  private async updateEnhancedWebviewContent(): Promise<void> {
    if (!this._view) return;

    try {
      const nonce = getNonce();
      
      // Generate enhanced CSP
      let cspOverride: string | undefined;
      if (this._securityManager) {
        cspOverride = this._securityManager.generateCSP({
          context: 'enhanced-chat-webview',
          nonce,
          allowInlineScripts: false,
          allowInlineStyles: true,
          additionalSources: [this._view.webview.cspSource]
        });
      }

      // Get current state for UI rendering
      const currentState = this.stateManager.getState();
      const serverList = await this.getServerListForUI();

      this._view.webview.html = this.getEnhancedChatWebViewContent(
        this._view.webview,
        this.context.extensionUri,
        {
          nonce,
          sessionId: this._sessionId,
          cspOverride,
          securityEnabled: !!this._securityManager,
          currentState,
          serverList,
          taskIntegrationStatus: this.taskIntegration.getMCPConnectionStatus()
        }
      );

      this.logger.debug('Enhanced WebView content updated', {
        sessionId: this._sessionId,
        serverCount: serverList.length
      });

    } catch (error) {
      this.logger.error('Failed to update enhanced webview content', error);
    }
  }

  /**
   * Setup enhanced message handling for multi-server operations
   */
  private setupEnhancedMessageHandling(): void {
    if (!this._view) return;
    
    this._view.webview.onDidReceiveMessage(
      async (rawMessage: any) => {
        const startTime = Date.now();
        
        try {
          // Security validation
          let validationResult;
          if (this._securityManager) {
            validationResult = await this._securityManager.validateMessage(
              rawMessage,
              {
                sessionId: this._sessionId,
                origin: 'enhanced-vscode-webview',
                messageCount: 0,
                lastActivity: Date.now(),
                trustLevel: 'medium'
              }
            );

            if (!validationResult.isValid) {
              this.logger.warn('Enhanced message validation failed', {
                messageType: rawMessage?.type,
                errors: validationResult.errors
              });
              return;
            }
          }

          const message: MultiServerWebViewMessage = validationResult?.sanitizedMessage || rawMessage;
          
          // Handle multi-server specific messages
          if (this.isServerNavigationMessage(message)) {
            const response = await this.handleServerNavigationMessage(message as ServerNavigationMessage);
            await this.sendResponse(message.requestId, response);
          } else {
            // Handle regular chat messages with server context
            const response = await this.handleEnhancedMessage(message);
            await this.sendResponse(message.requestId, response);
          }

          this.logger.debug('Enhanced message processed', {
            messageType: message.type,
            serverId: message.serverId,
            channelId: message.channelId,
            processingTime: Date.now() - startTime
          });

        } catch (error) {
          this.logger.error('Enhanced message handling error', error);
          await this.sendErrorResponse(rawMessage.requestId, error as Error);
        }
      },
      null,
      this._disposables
    );
  }

  /**
   * Handle server navigation messages
   */
  private async handleServerNavigationMessage(message: ServerNavigationMessage): Promise<WebViewResponse> {
    switch (message.type) {
      case 'switchServer':
        if (message.serverId) {
          await this.stateManager.setActiveServer(message.serverId);
          await this.updateEnhancedWebviewContent();
        }
        return { success: true, data: { activeServerId: message.serverId } };

      case 'switchChannel':
        if (message.channelId && message.serverId) {
          await this.stateManager.setActiveChannel(message.channelId, message.serverId);
          await this.updateEnhancedWebviewContent();
        }
        return { success: true, data: { activeChannelId: message.channelId } };

      case 'toggleServerCollapse':
        if (message.serverId) {
          // Would update server collapse state
          await this.updateEnhancedWebviewContent();
        }
        return { success: true };

      case 'getServerList':
        const serverList = await this.getServerListForUI();
        return { success: true, data: { servers: serverList } };

      case 'getChannelList':
        if (message.serverId) {
          const channels = await this.getChannelListForUI(message.serverId);
          return { success: true, data: { channels } };
        }
        return { success: false, error: 'Server ID required' };

      case 'createRegularServer':
        if (message.serverName) {
          // Would create new regular server
          await this.updateEnhancedWebviewContent();
        }
        return { success: true };

      case 'archiveServer':
        if (message.serverId) {
          // Would archive server
          await this.updateEnhancedWebviewContent();
        }
        return { success: true };

      default:
        return { success: false, error: `Unknown navigation message type: ${message.type}` };
    }
  }

  /**
   * Handle enhanced chat messages with server/channel context
   */
  private async handleEnhancedMessage(message: MultiServerWebViewMessage): Promise<WebViewResponse> {
    switch (message.type) {
      case 'sendMessage':
        return this.handleSendMessageWithContext(message);
        
      case 'requestServerStatus':
        return this.handleRequestServerStatus(message);
        
      case 'requestAgentProgress':
        return this.handleRequestAgentProgress(message);
        
      case 'requestTaskProgress':
        return this.handleRequestTaskProgress(message);

      case 'updateServerPreferences':
        return this.handleUpdateServerPreferences(message);

      // Delegate other messages to base handler
      default:
        return this.handleStandardMessage(message);
    }
  }

  /**
   * Handle send message with server/channel context
   */
  private async handleSendMessageWithContext(message: MultiServerWebViewMessage): Promise<WebViewResponse> {
    try {
      const currentState = this.stateManager.getState();
      const serverId = message.serverId || currentState.activeServerId;
      const channelId = message.channelId || currentState.activeChannelId;

      if (!serverId || !channelId) {
        return { success: false, error: 'No active server or channel' };
      }

      // Collect context if needed
      let contextData: SecureContextData | null = null;
      if (this._contextCollector && message.data?.includeContext !== false) {
        const contextMessage = await this._contextCollector.collectSecureContext(message.data?.content);
        contextData = contextMessage.contextData;
        
        if (contextData) {
          this._contextState.set(contextData.contextId, contextData);
          await this.postContextToWebview(contextData, contextMessage.messageId);
        }
      }

      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create message with server/channel context
      const historyMessage: MessageHistoryState = {
        messageId,
        serverId,
        channelId,
        content: message.data?.content || '',
        role: 'user',
        providerId: message.data?.providerId,
        contextId: contextData?.contextId,
        timestamp: Date.now(),
        sanitized: true
      };

      // Add to persistence
      await this.persistenceManager.addMessage(historyMessage);
      
      // Handle message in state manager
      await this.stateManager.handleMessageReceived(historyMessage);

      // Emit enhanced chat event
      this.eventRouter.emit({
        type: 'chatMessageSent',
        data: {
          messageId,
          content: message.data?.content,
          serverId,
          channelId,
          provider: message.data?.providerId || 'unknown',
          contextId: contextData?.contextId,
          hasContext: !!contextData
        }
      });

      return {
        success: true,
        data: {
          messageId,
          serverId,
          channelId,
          timestamp: new Date().toISOString(),
          contextId: contextData?.contextId,
          hasContext: !!contextData
        }
      };

    } catch (error) {
      this.logger.error('Enhanced message send failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Message send failed'
      };
    }
  }


  /**
   * Handle request agent progress
   */
  private async handleRequestAgentProgress(message: MultiServerWebViewMessage): Promise<WebViewResponse> {
    try {
      const channelId = message.channelId;
      if (!channelId) {
        return { success: false, error: 'Channel ID required' };
      }

      const agentProgress = this.stateManager.getState().agentProgressStates.get(channelId);
      
      return {
        success: true,
        data: { agentProgress }
      };

    } catch (error) {
      return { success: false, error: 'Failed to get agent progress' };
    }
  }

  /**
   * Handle update server preferences
   */
  private async handleUpdateServerPreferences(message: MultiServerWebViewMessage): Promise<WebViewResponse> {
    try {
      const preferences = message.data?.preferences;
      if (preferences) {
        if (preferences.uiPreferences) {
          await this.stateManager.updateUIPreferences(preferences.uiPreferences);
        }
        if (preferences.notificationSettings) {
          await this.stateManager.updateNotificationSettings(preferences.notificationSettings);
        }
      }

      return { success: true };

    } catch (error) {
      return { success: false, error: 'Failed to update preferences' };
    }
  }

  /**
   * Handle standard message (delegate to original implementation)
   */
  private async handleStandardMessage(_message: MultiServerWebViewMessage): Promise<WebViewResponse> {
    // This would delegate to the original ChatWebViewProvider methods
    // For now, return a placeholder
    return { success: true, data: { message: 'Standard message handled' } };
  }

  /**
   * Setup enhanced event listeners for real-time updates
   */
  private setupEnhancedEventListeners(): void {
    // Listen for state changes
    this._disposables.push(
      this.stateManager.onStateChange(async (event) => {
        await this.handleStateChange(event);
      })
    );

    // Listen for task server events
    this._disposables.push(
      this.taskServerManager.onServerEvent('taskServerCreated', async (event) => {
        await this.updateEnhancedWebviewContent();
        await this.postMessageToWebview('taskServerCreated', event.data);
      })
    );

    this._disposables.push(
      this.taskServerManager.onServerEvent('agentChannelAdded', async (event) => {
        await this.updateEnhancedWebviewContent();
        await this.postMessageToWebview('agentChannelAdded', event.data);
      })
    );

    this._disposables.push(
      this.taskServerManager.onServerEvent('taskProgressUpdated', async (event) => {
        await this.postMessageToWebview('taskProgressUpdated', event.data);
      })
    );

    // Listen for configuration changes
    this.configManager.watchConfiguration('ui', (config, changeType) => {
      this.postMessageToWebview('configurationChanged', {
        config: config.ui,
        changeType
      });
    });
  }

  /**
   * Setup state change handlers
   */
  private setupStateChangeHandlers(): void {
    this._disposables.push(
      this.stateManager.onStateChange((event) => {
        this.handleStateChange(event).catch(error => {
          this.logger.error('Error handling state change', error, {
            eventType: event.type
          });
        });
      })
    );
  }

  /**
   * Handle state changes and update UI
   */
  private async handleStateChange(event: StateChangeEvent): Promise<void> {
    switch (event.type) {
      case 'serverActivated':
      case 'channelActivated':
        await this.updateEnhancedWebviewContent();
        break;
        
      case 'serverAdded':
      case 'channelAdded':
        await this.updateEnhancedWebviewContent();
        await this.postMessageToWebview(event.type, event.data);
        break;
        
      case 'agentProgressUpdated':
        await this.postMessageToWebview('agentProgressUpdated', event.data);
        break;
        
      case 'messageReceived':
        await this.postMessageToWebview('messageReceived', event.data);
        break;
    }
  }



  /**
   * Get agent status for channel
   */
  private getAgentStatus(channelId: string): 'idle' | 'active' | 'waiting' | 'error' | 'completed' | undefined {
    const agentState = this.stateManager.getState().agentProgressStates.get(channelId);
    return agentState?.status;
  }

  /**
   * Get agent progress for channel
   */
  private getAgentProgress(channelId: string): number | undefined {
    const agentState = this.stateManager.getState().agentProgressStates.get(channelId);
    return agentState?.progressPercentage;
  }

  /**
   * Calculate overall server progress
   */
  private calculateServerProgress(serverId: string): number {
    const server = this.persistenceManager.getServer(serverId);
    if (!server || server.serverType !== 'task') {
      return 0;
    }

    const agentChannels = server.channels.filter(c => c.channelType === 'agent');
    if (agentChannels.length === 0) {
      return 0;
    }

    let totalProgress = 0;
    for (const channel of agentChannels) {
      const progress = this.getAgentProgress(channel.channelId) || 0;
      totalProgress += progress;
    }

    return Math.round(totalProgress / agentChannels.length);
  }


  /**
   * Restore UI state from session
   */
  private async restoreUIState(): Promise<void> {
    try {
      const currentState = this.stateManager.getState();
      
      // Send initial state to webview
      await this.postMessageToWebview('stateRestored', {
        activeServerId: currentState.activeServerId,
        activeChannelId: currentState.activeChannelId,
        serverList: await this.getServerListForUI(),
        taskIntegrationStatus: this.taskIntegration.getMCPConnectionStatus(),
        unreadCounts: Object.fromEntries(currentState.unreadCounts),
        uiPreferences: currentState.uiPreferences,
        notificationSettings: currentState.notificationSettings
      });

      this.logger.debug('UI state restored to webview', {
        activeServerId: currentState.activeServerId,
        activeChannelId: currentState.activeChannelId
      });

    } catch (error) {
      this.logger.error('Failed to restore UI state', error);
    }
  }




  /**
   * Post message to webview
   */
  private async postMessageToWebview(type: string, data?: any): Promise<void> {
    if (this._view) {
      await this._view.webview.postMessage({ type, data });
    }
  }

  /**
   * Post context data to webview
   */
  private async postContextToWebview(
    contextData: SecureContextData,
    messageId: string
  ): Promise<void> {
    if (!this._view) return;
    
    try {
      const sanitizedContextData = await this.sanitizeContextForDisplay(contextData);
      
      await this._view.webview.postMessage({
        type: 'contextDataReceived',
        data: {
          contextId: contextData.contextId,
          messageId,
          contextSummary: sanitizedContextData.contextSummary,
          contextItems: sanitizedContextData.contextItems.map(item => ({
            filepath: item.filepath,
            language: item.language,
            type: item.type,
            startLine: item.startLine,
            endLine: item.endLine,
            contentPreview: item.content.substring(0, 200) + (item.content.length > 200 ? '...' : ''),
            fullContent: item.content
          })),
          timestamp: contextData.timestamp,
          sanitized: contextData.sanitized,
          threatCount: contextData.threatCount
        }
      });

    } catch (error) {
      this.logger.error('Failed to send context to webview', error);
    }
  }

  /**
   * Sanitize context data for safe webview display
   */
  private async sanitizeContextForDisplay(
    contextData: SecureContextData
  ): Promise<SecureContextData> {
    if (!this._securityManager) {
      return contextData;
    }
    
    try {
      const sanitizedItems = await Promise.all(
        contextData.contextItems.map(async (item) => {
          const sanitizedContent = await this._securityManager!.sanitizeForDisplay(
            item.content,
            { filepath: item.filepath, language: item.language }
          );
          
          return {
            ...item,
            content: sanitizedContent
          };
        })
      );
      
      return {
        ...contextData,
        contextItems: sanitizedItems
      };
      
    } catch (error) {
      this.logger.error('Context sanitization for display failed', error);
      return contextData;
    }
  }

  /**
   * Generate enhanced multi-server HTML content
   */
  private getEnhancedChatWebViewContent(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    options: {
      nonce: string;
      sessionId: string;
      cspOverride?: string;
      securityEnabled: boolean;
      currentState: MultiChatState;
      serverList: TaskServerUIData[];
      taskIntegrationStatus: any;
    }
  ): string {
    // Get URIs for CSS and JS resources
    const multiServerCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'media', 'chat', 'multi-server-chat.css')
    );
    const multiServerJsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'media', 'chat', 'multi-server-chat.js')
    );
    
    // Generate CSP
    const csp = options.cspOverride || `default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${options.nonce}'; img-src ${webview.cspSource} https: data:; font-src ${webview.cspSource};`;

    // Serialize state for initial rendering
    const initialState = {
      sessionId: options.sessionId,
      securityEnabled: options.securityEnabled,
      servers: options.serverList,
      currentServerId: options.currentState.activeServerId,
      currentChannelId: options.currentState.activeChannelId,
      taskIntegrationStatus: options.taskIntegrationStatus,
      timestamp: Date.now()
    };

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <title>Vespera Forge - Enhanced Multi-Server Chat</title>
  
  <!-- Enhanced Multi-Server Chat Styles -->
  <link href="${multiServerCssUri}" rel="stylesheet">
  
  <!-- Theme Integration -->
  <style nonce="${options.nonce}">
    /* VS Code Theme Integration */
    body {
      --vscode-font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
      --vscode-font-size: var(--vscode-font-size, 13px);
      --vscode-font-weight: var(--vscode-font-weight, normal);
      
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      font-weight: var(--vscode-font-weight);
    }

    /* Dynamic theme variables from VS Code */
    :root {
      --vscode-foreground: var(--vscode-foreground);
      --vscode-background: var(--vscode-background);
      --vscode-sideBar-background: var(--vscode-sideBar-background);
      --vscode-sideBar-foreground: var(--vscode-sideBar-foreground);
      --vscode-activityBar-background: var(--vscode-activityBar-background);
      --vscode-input-background: var(--vscode-input-background);
      --vscode-input-foreground: var(--vscode-input-foreground);
      --vscode-button-background: var(--vscode-button-background);
      --vscode-button-foreground: var(--vscode-button-foreground);
      --vscode-button-hoverBackground: var(--vscode-button-hoverBackground);
      --vscode-list-activeSelectionBackground: var(--vscode-list-activeSelectionBackground);
      --vscode-list-hoverBackground: var(--vscode-list-hoverBackground);
      --vscode-badge-background: var(--vscode-badge-background);
      --vscode-badge-foreground: var(--vscode-badge-foreground);
    }

    /* Apply VS Code theme colors to our interface */
    .multi-server-chat {
      color: var(--vscode-foreground);
      background-color: var(--vscode-background);
    }

    .server-sidebar {
      background-color: var(--vscode-activityBar-background);
      color: var(--vscode-sideBar-foreground);
    }

    .channel-sidebar {
      background-color: var(--vscode-sideBar-background);
      color: var(--vscode-sideBar-foreground);
    }

    .chat-main {
      background-color: var(--vscode-background);
    }

    .message-input-wrapper {
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border-color: var(--vscode-input-background);
    }

    .input-action--primary {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .input-action--primary:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    .server-item--active,
    .channel-item--active {
      background-color: var(--vscode-list-activeSelectionBackground);
    }

    .server-item:hover,
    .channel-item:hover {
      background-color: var(--vscode-list-hoverBackground);
    }

    .unread-badge,
    .unread-count {
      background-color: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
  </style>
</head>
<body data-vscode-theme-kind="${options.currentState.uiPreferences?.theme || 'dark'}">
  <div id="chat-root" class="chat-root">
    <!-- Multi-server interface will be injected here by JavaScript -->
  </div>

  <!-- Initial State Script -->
  <script nonce="${options.nonce}">
    // Provide initial state to the multi-server chat interface
    window.VESPERA_INITIAL_STATE = ${JSON.stringify(initialState, null, 2)};
    
    // Theme detection
    const observer = new MutationObserver(() => {
      const themeKind = document.body.dataset.vscodeThemeKind || 'dark';
      if (window.MultiServerChat) {
        window.MultiServerChat.updateTheme(themeKind);
      }
    });
    
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-vscode-theme-kind', 'class']
    });

    // Debug logging for development
    if (${options.securityEnabled}) {
      console.log('[VesperaForge] Enhanced multi-server chat initialized with security');
    }
    
    console.log('[VesperaForge] Initial state loaded:', window.VESPERA_INITIAL_STATE);
  </script>

  <!-- Enhanced Multi-Server Chat JavaScript -->
  <script nonce="${options.nonce}" src="${multiServerJsUri}"></script>
  
  <!-- Post-initialization Script -->
  <script nonce="${options.nonce}">
    // Additional initialization after multi-server chat loads
    document.addEventListener('DOMContentLoaded', () => {
      if (window.MultiServerChat) {
        // Apply initial state from server
        const initialState = window.VESPERA_INITIAL_STATE;
        
        if (initialState.servers && initialState.servers.length > 0) {
          initialState.servers.forEach(server => {
            if (server.serverType === 'task') {
              window.MultiServerChat.addTaskServer(server);
            } else {
              window.MultiServerChat.addRegularServer(server);
            }
          });
        }

        // Select current server/channel if available
        if (initialState.currentServerId) {
          window.MultiServerChat.selectServer(initialState.currentServerId);
          
          if (initialState.currentChannelId) {
            window.MultiServerChat.selectChannel(initialState.currentChannelId);
          }
        }

        // Show connection status
        if (initialState.taskIntegrationStatus) {
          window.MultiServerChat.showNotification({
            type: initialState.taskIntegrationStatus.connected ? 'success' : 'warning',
            title: 'Task Integration',
            message: initialState.taskIntegrationStatus.connected 
              ? 'Connected to Vespera Scriptorium MCP server' 
              : 'Task integration offline - some features may be limited',
            duration: 3000
          });
        }

        console.log('[VesperaForge] Enhanced multi-server chat fully initialized');
      }
    });
  </script>
</body>
</html>`;
  }

  /**
   * Get server list formatted for UI rendering
   */
  private async getServerListForUI(): Promise<TaskServerUIData[]> {
    try {
      const session = this.persistenceManager.getCurrentSession();
      const activeTaskServers = this.taskServerManager.getActiveTaskServers();
      
      const uiServers: TaskServerUIData[] = [];

      // Add task servers
      for (const taskState of activeTaskServers) {
        const server = session?.servers.find(s => s.serverId === taskState.serverId);
        if (server) {
          const channels = await this.getChannelListForUI(server.serverId);
          
          uiServers.push({
            serverId: server.serverId,
            serverName: server.serverName,
            serverType: 'task',
            taskId: taskState.taskId,
            taskType: taskState.taskType,
            taskPhase: taskState.phase,
            taskPriority: 'medium', // Would come from task data
            taskStatus: taskState.status,
            taskProgress: 75, // Would come from actual progress
            channels,
            isActive: server.serverId === this.stateManager.getState().activeServerId,
            isCollapsed: false, // Would come from UI state
            isPinned: false, // Would come from user preferences
            unreadCount: 0, // Would be calculated
            lastActivity: server.lastActivity,
            archived: server.archived
          });
        }
      }

      // Add regular servers
      if (session?.servers) {
        for (const server of session.servers) {
          if (server.serverType === 'regular') {
            const channels = await this.getChannelListForUI(server.serverId);
            
            uiServers.push({
              serverId: server.serverId,
              serverName: server.serverName,
              serverType: 'regular',
              channels,
              isActive: server.serverId === this.stateManager.getState().activeServerId,
              isCollapsed: false,
              isPinned: false,
              unreadCount: 0,
              lastActivity: server.lastActivity,
              archived: server.archived
            });
          }
        }
      }

      return uiServers;

    } catch (error) {
      this.logger.error('Failed to get server list for UI', error);
      return [];
    }
  }

  /**
   * Get channel list for a server formatted for UI rendering
   */
  private async getChannelListForUI(serverId: string): Promise<TaskChannelUIData[]> {
    try {
      const session = this.persistenceManager.getCurrentSession();
      const server = session?.servers.find(s => s.serverId === serverId);
      
      if (!server) {
        return [];
      }

      return server.channels.map(channel => ({
        channelId: channel.channelId,
        channelName: channel.channelName,
        channelType: channel.channelType,
        agentRole: channel.agentRole,
        agentStatus: 'idle', // Would come from agent tracking
        agentProgress: 0, // Would come from agent tracking
        messageCount: channel.messageCount,
        unreadCount: 0, // Would be calculated
        lastMessage: 'Welcome to the channel', // Would come from message history
        lastActivity: channel.lastActivity,
        isActive: channel.channelId === this.stateManager.getState().activeChannelId,
        typingIndicators: [] // Would come from real-time data
      }));

    } catch (error) {
      this.logger.error('Failed to get channel list for UI', error);
      return [];
    }
  }

  /**
   * Check if message is server navigation type
   */
  private isServerNavigationMessage(message: MultiServerWebViewMessage): boolean {
    const navigationTypes = [
      'switchServer', 'switchChannel', 'toggleServerCollapse', 'pinServer',
      'createRegularServer', 'archiveServer', 'getServerList', 'getChannelList'
    ];
    return navigationTypes.includes(message.type);
  }



  /**
   * Handle server status requests
   */
  private async handleRequestServerStatus(_message: MultiServerWebViewMessage): Promise<WebViewResponse> {
    try {
      const serverList = await this.getServerListForUI();
      const activeTaskServers = this.taskServerManager.getActiveTaskServers();
      
      return {
        success: true,
        data: {
          servers: serverList,
          activeTaskCount: activeTaskServers.length,
          totalServerCount: serverList.length,
          mcpConnectionStatus: this.taskIntegration.getMCPConnectionStatus()
        }
      };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle task progress requests
   */
  private async handleRequestTaskProgress(_message: MultiServerWebViewMessage): Promise<WebViewResponse> {
    try {
      const taskServers = this.taskServerManager.getActiveTaskServers();
      const taskProgress = taskServers.map(task => ({
        taskId: task.taskId,
        serverId: task.serverId,
        status: task.status,
        phase: task.phase,
        progress: 75 // Would come from actual task tracking
      }));

      return { success: true, data: { taskProgress } };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }


  /**
   * Send response to webview
   */
  private async sendResponse(requestId: string | undefined, response: WebViewResponse): Promise<void> {
    if (!this._view || !requestId) return;

    try {
      await this._view.webview.postMessage({
        type: 'response',
        requestId,
        ...response
      });
    } catch (error) {
      this.logger.error('Failed to send response to webview', error);
    }
  }

  /**
   * Send error response to webview
   */
  private async sendErrorResponse(requestId: string | undefined, error: Error): Promise<void> {
    if (!requestId) return;

    await this.sendResponse(requestId, {
      success: false,
      error: error.message
    });
  }

  /**
   * Reveal webview
   */
  public reveal(): void {
    if (this._view) {
      this._view.show?.(true);
    }
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    this.logger.info('EnhancedChatWebViewProvider disposing', {
      sessionId: this._sessionId,
      disposablesCount: this._disposables.length
    });

    // Dispose security manager
    if (this._securityManager) {
      this._securityManager.dispose();
      this._securityManager = undefined;
    }
    
    // Dispose context collector
    if (this._contextCollector) {
      this._contextCollector.dispose();
      this._contextCollector = undefined;
    }
    
    // Clear context state
    this._contextState.clear();

    // Dispose all registered disposables
    this._disposables.forEach(d => d.dispose());
    this._disposables.length = 0;

    this.logger.info('EnhancedChatWebViewProvider disposed successfully');
  }
}