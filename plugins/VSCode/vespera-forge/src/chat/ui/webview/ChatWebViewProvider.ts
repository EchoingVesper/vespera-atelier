/**
 * Chat WebView Provider for VS Code integration with comprehensive security
 */
import * as vscode from 'vscode';
import { ChatEventRouter } from '../../events/ChatEventRouter';
import { ChatConfigurationManager } from '../../core/ConfigurationManager';
import { ChatTemplateRegistry } from '../../core/TemplateRegistry';
import { 
  WebViewMessage, 
  WebViewResponse, 
  ConfigureProviderRequest,
  RemoveProviderRequest,
  SetDefaultProviderRequest,
  TestProviderConnectionRequest,
  RequestProviderTemplateRequest,
  ValidateProviderConfigRequest
} from '../../types/webview';
import { ChatMessage } from '../../types/chat';
import { getNonce, getChatWebViewContent } from './HtmlGenerator';
import { WebViewSecurityManager } from './WebViewSecurityManager';
import { VesperaInputSanitizer } from '../../../core/security/sanitization/VesperaInputSanitizer';
import { VesperaSecurityAuditLogger } from '../../../core/security/audit/VesperaSecurityAuditLogger';
import { VesperaLogger } from '../../../core/logging/VesperaLogger';
import { VesperaErrorHandler } from '../../../core/error-handling/VesperaErrorHandler';
import { SecureFileContextCollector, SecureContextData } from '../../context/FileContextManager';
import { SecurityEnhancedVesperaCoreServices } from '../../../core/security/SecurityEnhancedCoreServices';

export class ChatWebViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vesperaForge.chatView';
  
  private _view?: vscode.WebviewView;
  private _disposables: vscode.Disposable[] = [];
  private _securityManager?: WebViewSecurityManager;
  private _sessionId: string;
  private _contextCollector?: SecureFileContextCollector;
  private _contextState: Map<string, SecureContextData> = new Map();
  private _coreServices?: SecurityEnhancedVesperaCoreServices;
  private _messageHistory: ChatMessage[] = [];
  private readonly _maxHistorySize = 1000;
  
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly eventRouter: ChatEventRouter,
    private readonly configManager: ChatConfigurationManager,
    private readonly templateRegistry: ChatTemplateRegistry,
    private readonly logger?: VesperaLogger,
    private readonly errorHandler?: VesperaErrorHandler,
    coreServices?: SecurityEnhancedVesperaCoreServices
  ) {
    this._sessionId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this._coreServices = coreServices;
  }

  /**
   * Initialize security manager for this WebView
   */
  private async initializeSecurityManager(): Promise<void> {
    if (this._securityManager || !this.logger || !this.errorHandler) {
      return;
    }

    try {
      // Initialize required security components
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
          maxMessageSize: 1048576, // 1MB
          rateLimitPerSecond: 10,
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
        this._coreServices
      );
      
      this.logger.info('WebView security manager and context collector initialized', { 
        sessionId: this._sessionId,
        viewType: ChatWebViewProvider.viewType,
        hasContextCollector: !!this._contextCollector
      });
    } catch (error) {
      this.logger?.error('Failed to initialize security manager', error);
      throw error;
    }
  }
  
  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this._view = webviewView;
    
    // Initialize security manager first
    await this.initializeSecurityManager();
    
    // Configure webview with security settings
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };
    
    // Set initial content with security enhancements
    await this.updateWebviewContent();
    
    // Setup secure message handling
    this.setupSecureMessageHandling();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Handle webview disposal
    webviewView.onDidDispose(() => {
      this.dispose();
    });

    this.logger?.info('ChatWebView resolved successfully', {
      sessionId: this._sessionId,
      securityEnabled: !!this._securityManager
    });
  }
  
  private async updateWebviewContent(): Promise<void> {
    if (this._view) {
      const nonce = getNonce();
      
      // Generate secure CSP if security manager is available
      let cspOverride: string | undefined;
      if (this._securityManager) {
        cspOverride = this._securityManager.generateCSP({
          context: 'chat-webview',
          nonce,
          allowInlineScripts: false,
          allowInlineStyles: true, // VS Code themes require this
          additionalSources: [this._view.webview.cspSource]
        });
      }

      this._view.webview.html = getChatWebViewContent(
        this._view.webview,
        this.context.extensionUri,
        {
          nonce,
          sessionId: this._sessionId,
          cspOverride,
          securityEnabled: !!this._securityManager
        }
      );

      this.logger?.debug('WebView content updated', {
        sessionId: this._sessionId,
        hasCustomCSP: !!cspOverride
      });
    }
  }
  
  private setupSecureMessageHandling(): void {
    if (!this._view) return;
    
    this._view.webview.onDidReceiveMessage(
      async (rawMessage: any) => {
        const startTime = Date.now();
        let validationResult;
        
        try {
          this.logger?.debug('Raw message received', { 
            sessionId: this._sessionId,
            messageType: rawMessage?.type,
            hasData: !!rawMessage?.data
          });

          // Security validation and sanitization
          if (this._securityManager) {
            validationResult = await this._securityManager.validateMessage(
              rawMessage,
              {
                sessionId: this._sessionId,
                origin: 'vscode-webview',
                messageCount: 0,
                lastActivity: Date.now(),
                trustLevel: 'medium'
              }
            );

            if (!validationResult.isValid) {
              this.logger?.warn('Message validation failed', {
                sessionId: this._sessionId,
                messageType: rawMessage?.type,
                errors: validationResult.errors,
                threats: validationResult.threats.length,
                blocked: validationResult.blocked
              });

              if (rawMessage.requestId) {
                await this._view!.webview.postMessage({
                  success: false,
                  error: validationResult.blocked 
                    ? 'Message blocked by security policy'
                    : 'Message validation failed',
                  requestId: rawMessage.requestId,
                  securityInfo: {
                    threats: validationResult.threats.length,
                    errors: validationResult.errors.slice(0, 3) // Limit error details
                  }
                });
              }
              return;
            }
          }

          // Use sanitized message if available
          const message: WebViewMessage = validationResult?.sanitizedMessage || rawMessage;
          
          this.logger?.info('Processing validated message', {
            sessionId: this._sessionId,
            messageType: message.type,
            sanitized: !!validationResult?.sanitizedMessage,
            threats: validationResult?.threats.length || 0
          });

          const response = await this.handleMessage(message);
          
          // Send response back to webview with security info
          if (message.requestId) {
            const secureResponse = await this.prepareSecureResponse(response, validationResult);
            await this._view!.webview.postMessage({
              ...secureResponse,
              requestId: message.requestId
            });
          }

          this.logger?.debug('Message processed successfully', {
            sessionId: this._sessionId,
            messageType: message.type,
            processingTime: Date.now() - startTime,
            success: response.success
          });

        } catch (error) {
          this.logger?.error('Message handling error', error, {
            sessionId: this._sessionId,
            messageType: rawMessage?.type,
            processingTime: Date.now() - startTime
          });

          if (this.errorHandler) {
            await this.errorHandler.handleError(error as Error);
          }
          
          if (rawMessage.requestId) {
            await this._view!.webview.postMessage({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              requestId: rawMessage.requestId
            });
          }
        }
      },
      null,
      this._disposables
    );
  }

  /**
   * Prepare response with security considerations
   */
  private async prepareSecureResponse(
    response: WebViewResponse,
    validationResult?: any
  ): Promise<WebViewResponse> {
    // Add security metadata if enabled
    if (this._securityManager && validationResult) {
      const securityInfo = {
        sessionId: this._sessionId,
        validated: true,
        sanitized: !!validationResult.sanitizedMessage,
        threatCount: validationResult.threats.length,
        processingTime: Date.now()
      };
      
      return {
        ...response,
        _security: securityInfo
      };
    }

    return response;
  }
  
  private async handleMessage(message: WebViewMessage): Promise<WebViewResponse> {
    switch (message.type) {
      case 'sendMessage':
        return this.handleSendMessage(message.data);
        
      case 'switchProvider':
        return this.handleSwitchProvider(message.data);
        
      case 'configureProvider':
        return this.handleConfigureProvider(message.data);
        
      case 'removeProvider':
        return this.handleRemoveProvider(message.data);
        
      case 'setDefaultProvider':
        return this.handleSetDefaultProvider(message.data);
        
      case 'testProviderConnection':
        return this.handleTestProviderConnection(message.data);
        
      case 'requestAvailableProviders':
        return this.handleRequestAvailableProviders();
        
      case 'requestProviderTemplate':
        return this.handleRequestProviderTemplate(message.data);
        
      case 'validateProviderConfig':
        return this.handleValidateProviderConfig(message.data);
        
      case 'clearHistory':
        return this.handleClearHistory();
        
      case 'exportHistory':
        return this.handleExportHistory();
        
      case 'updateSettings':
        return this.handleUpdateSettings(message.data);
        
      case 'requestProviders':
        return this.handleRequestProviders();
        
      case 'requestHistory':
        return this.handleRequestHistory();
        
      case 'requestContextDetails':
        return this.handleRequestContextDetails(message.data);
        
      case 'toggleContextVisibility':
        return this.handleToggleContextVisibility(message.data);
        
      default:
        return {
          success: false,
          error: `Unknown message type: ${message.type}`
        };
    }
  }
  
  private async handleSendMessage(data: any): Promise<WebViewResponse> {
    try {
      this.logger?.info('Processing secure message send', { 
        sessionId: this._sessionId,
        hasContent: !!data.content,
        providerId: data.providerId 
      });
      
      // Collect secure context separately from message
      let contextData: SecureContextData | null = null;
      if (this._contextCollector && data.includeContext !== false) {
        const contextMessage = await this._contextCollector.collectSecureContext(data.content);
        contextData = contextMessage.contextData;
        
        // Store context for later display
        if (contextData) {
          this._contextState.set(contextData.contextId, contextData);
          
          // Send context data to webview separately
          await this.postContextToWebview(contextData, contextMessage.messageId);
        }
      }
      
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Emit chat event with separated context
      this.eventRouter.emit({
        type: 'chatMessageSent',
        data: {
          messageId,
          content: data.content, // Pure user message without context injection
          provider: data.providerId || 'unknown'
        }
      });
      
      return {
        success: true,
        data: {
          messageId,
          timestamp: new Date().toISOString(),
          contextId: contextData?.contextId,
          hasContext: !!contextData
        }
      };
    } catch (error) {
      this.logger?.error('Secure message send failed', error, { sessionId: this._sessionId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Message send failed'
      };
    }
  }
  
  private async handleSwitchProvider(data: any): Promise<WebViewResponse> {
    try {
      console.log('[ChatWebView] Switching provider to:', data.providerId);
      
      // Validate that the target provider exists and is enabled
      const config = this.configManager.getConfiguration();
      const targetProvider = config.providers[data.providerId];
      
      if (!targetProvider) {
        return { 
          success: false, 
          error: `Provider '${data.providerId}' not found` 
        };
      }
      
      if (!targetProvider.enabled) {
        return { 
          success: false, 
          error: `Provider '${data.providerId}' is disabled` 
        };
      }
      
      // Update configuration to set new default provider
      await this.configManager.updateConfiguration('user', {
        providers: {
          ...config.providers,
          [data.currentProviderId]: {
            ...config.providers[data.currentProviderId],
            isDefault: false
          },
          [data.providerId]: {
            ...config.providers[data.providerId],
            isDefault: true
          }
        }
      });
      
      // Emit provider change event
      this.eventRouter.emit({
        type: 'chatProviderChanged',
        data: {
          from: data.currentProviderId,
          to: data.providerId
        }
      });
      
      // Update webview with new provider information
      await this._updateWebViewState();
      
      return { success: true };
    } catch (error) {
      this.logger?.error('Failed to switch provider', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  private async handleConfigureProvider(data: ConfigureProviderRequest): Promise<WebViewResponse> {
    try {
      console.log('[ChatWebView] Configuring provider:', data.providerId);
      
      await this.configManager.configureProvider(
        data.providerId, 
        data.config, 
        data.scope || 'user'
      );
      
      this.eventRouter.emit({
        type: 'chatConfigUpdated',
        data: {
          providerId: data.providerId,
          changes: data.config
        }
      });
      
      return { 
        success: true,
        data: { 
          providerId: data.providerId,
          message: 'Provider configured successfully'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to configure provider'
      };
    }
  }
  
  private async handleRemoveProvider(data: RemoveProviderRequest): Promise<WebViewResponse> {
    try {
      console.log('[ChatWebView] Removing provider:', data.providerId);
      
      await this.configManager.removeProvider(data.providerId, data.scope || 'user');
      
      this.eventRouter.emit({
        type: 'chatProviderDisconnected',
        data: { providerId: data.providerId }
      });
      
      return { 
        success: true,
        data: { 
          providerId: data.providerId,
          message: 'Provider removed successfully'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove provider'
      };
    }
  }
  
  private async handleSetDefaultProvider(data: SetDefaultProviderRequest): Promise<WebViewResponse> {
    try {
      console.log('[ChatWebView] Setting default provider:', data.providerId);
      
      await this.configManager.setDefaultProvider(data.providerId, data.scope || 'user');
      
      this.eventRouter.emit({
        type: 'chatProviderChanged',
        data: { 
          to: data.providerId
        }
      });
      
      return { 
        success: true,
        data: { 
          providerId: data.providerId,
          message: 'Default provider updated'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set default provider'
      };
    }
  }
  
  private async handleTestProviderConnection(data: TestProviderConnectionRequest): Promise<WebViewResponse> {
    try {
      console.log('[ChatWebView] Testing provider connection:', data.providerId);
      
      const template = this.templateRegistry.getTemplate(data.providerId);
      if (!template) {
        throw new Error(`Provider template not found: ${data.providerId}`);
      }
      
      // Basic validation first
      const validationResult = await this.handleValidateProviderConfig({
        providerId: data.providerId,
        config: data.config
      });
      
      if (!validationResult.success) {
        return {
          success: false,
          error: `Configuration invalid: ${validationResult.error}`
        };
      }
      
      // Perform actual connection test with provider
      const testPassed = await this.testProviderConnection(data.providerId, data.config);
      
      return {
        success: true,
        data: {
          connected: testPassed,
          message: testPassed ? 'Connection successful' : 'Connection failed - check your configuration'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }
  
  private async handleRequestAvailableProviders(): Promise<WebViewResponse> {
    try {
      const availableProviders = this.configManager.getAvailableProviders();
      const configuredProviders = this.configManager.getConfiguredProviders();
      
      return {
        success: true,
        data: {
          available: availableProviders,
          configured: configuredProviders
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get providers'
      };
    }
  }
  
  private async handleRequestProviderTemplate(data: RequestProviderTemplateRequest): Promise<WebViewResponse> {
    try {
      const template = this.templateRegistry.getTemplate(data.providerId);
      if (!template) {
        throw new Error(`Provider template not found: ${data.providerId}`);
      }
      
      // Get existing configuration for this provider if any
      const existingConfig = this.configManager.getProviderConfig(data.providerId);
      const decryptedConfig = existingConfig 
        ? await this.configManager.getDecryptedProviderConfig(data.providerId)
        : {};
      
      return {
        success: true,
        data: {
          template,
          existingConfig: decryptedConfig || {}
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get provider template'
      };
    }
  }
  
  private async handleValidateProviderConfig(data: ValidateProviderConfigRequest): Promise<WebViewResponse> {
    try {
      const template = this.templateRegistry.getTemplate(data.providerId);
      if (!template) {
        throw new Error(`Provider template not found: ${data.providerId}`);
      }
      
      // Use the same validation logic from ConfigurationManager
      const validationErrors: Record<string, string> = {};
      
      // Check required fields
      for (const field of template.ui_schema.config_fields) {
        if (field.required && (!data.config[field.name] || data.config[field.name] === '')) {
          validationErrors[field.name] = `${field.label} is required`;
          continue;
        }
        
        if (data.config[field.name] && field.validation) {
          const value = data.config[field.name];
          const validation = field.validation;
          
          if (validation.pattern && typeof value === 'string') {
            const regex = new RegExp(validation.pattern);
            if (!regex.test(value)) {
              validationErrors[field.name] = validation.message || `Invalid ${field.label.toLowerCase()} format`;
            }
          }
          
          if (validation.min !== undefined && typeof value === 'number' && value < validation.min) {
            validationErrors[field.name] = validation.message || `${field.label} must be at least ${validation.min}`;
          }
          
          if (validation.max !== undefined && typeof value === 'number' && value > validation.max) {
            validationErrors[field.name] = validation.message || `${field.label} must be at most ${validation.max}`;
          }
          
          if (validation.options && !validation.options.includes(value)) {
            validationErrors[field.name] = validation.message || `Invalid ${field.label.toLowerCase()} selection`;
          }
        }
      }
      
      return {
        success: Object.keys(validationErrors).length === 0,
        data: {
          valid: Object.keys(validationErrors).length === 0,
          errors: validationErrors
        },
        error: Object.keys(validationErrors).length > 0 ? 'Validation failed' : undefined
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Validation failed'
      };
    }
  }
  
  private async handleClearHistory(): Promise<WebViewResponse> {
    try {
      console.log('[ChatWebView] Clearing chat history');
      
      // Clear message history
      this._messageHistory = [];
      
      // Persist cleared history to VS Code global state
      await this.context.globalState.update(`chat_history_${this._sessionId}`, []);
      
      // Notify webview of cleared history
      await this.postMessageToWebview('historyCleared', { sessionId: this._sessionId });
      
      this.logger?.info('Chat history cleared', { sessionId: this._sessionId });
      
      return { success: true };
    } catch (error) {
      this.logger?.error('Failed to clear chat history', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  private async handleExportHistory(): Promise<WebViewResponse> {
    try {
      console.log('[ChatWebView] Exporting chat history');
      
      const exportData = {
        sessionId: this._sessionId,
        exportDate: new Date().toISOString(),
        messageCount: this._messageHistory.length,
        messages: this._messageHistory.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          provider: msg.metadata?.provider || 'unknown'
        }))
      };
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `chat-history-${timestamp}.json`;
      
      // Show save dialog
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(filename),
        filters: {
          'JSON files': ['json'],
          'All files': ['*']
        }
      });
      
      if (!saveUri) {
        return { success: false, error: 'Export cancelled by user' };
      }
      
      // Write file
      const content = JSON.stringify(exportData, null, 2);
      await vscode.workspace.fs.writeFile(saveUri, Buffer.from(content, 'utf8'));
      
      this.logger?.info('Chat history exported', { 
        filename: saveUri.fsPath,
        messageCount: this._messageHistory.length 
      });
      
      return { 
        success: true,
        data: { 
          exported: true,
          filename: saveUri.fsPath,
          messageCount: this._messageHistory.length
        }
      };
    } catch (error) {
      this.logger?.error('Failed to export chat history', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  private async handleUpdateSettings(data: any): Promise<WebViewResponse> {
    console.log('[ChatWebView] Updating settings:', data);
    
    // Update configuration through configuration manager
    try {
      await this.configManager.updateConfiguration('user', data);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update settings'
      };
    }
  }
  
  private async handleRequestProviders(): Promise<WebViewResponse> {
    try {
      const config = this.configManager.getConfiguration();
      
      const providers = Object.entries(config.providers).map(([id, providerConfig]) => ({
        id,
        name: providerConfig.config['name'] || id,
        status: providerConfig.enabled ? 'available' : 'disabled',
        enabled: providerConfig.enabled,
        isDefault: providerConfig.isDefault || false,
        providerType: providerConfig.config['provider_type'] || 'unknown',
        capabilities: providerConfig.config['capabilities'] || {}
      }));
      
      this.logger?.debug('Retrieved providers', { 
        providerCount: providers.length,
        enabledCount: providers.filter(p => p.enabled).length 
      });
      
      return {
        success: true,
        data: { 
          providers,
          totalCount: providers.length,
          enabledCount: providers.filter(p => p.enabled).length
        }
      };
    } catch (error) {
      this.logger?.error('Failed to get providers', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  private async handleRequestHistory(): Promise<WebViewResponse> {
    try {
      // Load history from persistent storage if not already loaded
      if (this._messageHistory.length === 0) {
        const storedHistory = this.context.globalState.get<ChatMessage[]>(`chat_history_${this._sessionId}`);
        if (storedHistory && Array.isArray(storedHistory)) {
          // Limit history size to prevent memory issues
          this._messageHistory = storedHistory.slice(-this._maxHistorySize);
        }
      }
      
      const history = {
        messages: this._messageHistory.map(msg => ({
          id: `${msg.timestamp}_${msg.role}`,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          provider: msg.metadata?.provider || 'unknown'
        })),
        totalCount: this._messageHistory.length,
        sessionId: this._sessionId
      };
      
      this.logger?.debug('Retrieved chat history', { 
        messageCount: history.totalCount,
        sessionId: this._sessionId 
      });
      
      return {
        success: true,
        data: history
      };
    } catch (error) {
      this.logger?.error('Failed to get chat history', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        data: {
          messages: [],
          totalCount: 0,
          sessionId: this._sessionId
        }
      };
    }
  }
  
  /**
   * Handle request for detailed context information
   */
  private async handleRequestContextDetails(data: any): Promise<WebViewResponse> {
    try {
      const contextId = data.contextId;
      const contextData = this._contextState.get(contextId);
      
      if (!contextData) {
        return {
          success: false,
          error: 'Context data not found'
        };
      }
      
      // Return detailed context information
      return {
        success: true,
        data: {
          contextId,
          contextItems: contextData.contextItems,
          contextSummary: contextData.contextSummary,
          timestamp: contextData.timestamp,
          sanitized: contextData.sanitized,
          threatCount: contextData.threatCount
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get context details'
      };
    }
  }
  
  /**
   * Handle context visibility toggle
   */
  private async handleToggleContextVisibility(data: any): Promise<WebViewResponse> {
    try {
      // Store visibility preference in VS Code settings
      const contextVisibilityKey = `contextVisibility_${data.contextId}`;
      await this.context.globalState.update(contextVisibilityKey, data.visible);
      
      this.logger?.debug('Context visibility toggled', {
        contextId: data.contextId,
        visible: data.visible
      });
      
      return {
        success: true,
        data: {
          contextId: data.contextId,
          visible: data.visible
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to toggle context visibility'
      };
    }
  }
  
  private setupEventListeners(): void {
    // Listen for configuration changes
    this.configManager.watchConfiguration('ui', (config, changeType) => {
      console.log('[ChatWebView] Configuration changed:', changeType);
      this.postMessageToWebview('configurationChanged', {
        config: config.ui,
        changeType
      });
    });
    
    // Listen for provider events
    this.eventRouter.on('chatProviderConnected', (data) => {
      this.postMessageToWebview('providerConnected', data);
    });
    
    this.eventRouter.on('chatProviderDisconnected', (data) => {
      this.postMessageToWebview('providerDisconnected', data);
    });
  }
  
  private async postMessageToWebview(type: string, data?: any): Promise<void> {
    if (this._view) {
      await this._view.webview.postMessage({ type, data });
    }
  }
  
  /**
   * Send context data to webview for separate display
   */
  private async postContextToWebview(
    contextData: SecureContextData,
    messageId: string
  ): Promise<void> {
    if (!this._view) return;
    
    try {
      // Sanitize context data for webview display
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
            fullContent: item.content // For collapsible display
          })),
          timestamp: contextData.timestamp,
          sanitized: contextData.sanitized,
          threatCount: contextData.threatCount
        }
      });
      
      this.logger?.debug('Context data sent to webview', {
        contextId: contextData.contextId,
        itemCount: contextData.contextItems.length
      });
      
    } catch (error) {
      this.logger?.error('Failed to send context to webview', error, {
        contextId: contextData.contextId
      });
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
      // Create sanitized copy
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
      this.logger?.error('Context sanitization for display failed', error);
      return contextData; // Fail-open for context display
    }
  }

  /**
   * Test connection to a provider
   * @deprecated Providers are now managed by Bindery backend
   */
  private async testProviderConnection(providerId: string, config: any): Promise<boolean> {
    try {
      // TODO: Implement provider connection test via Bindery
      this.logger?.warn('[ChatWebViewProvider] testProviderConnection is deprecated - use Bindery backend');
      return false;
    } catch (error) {
      this.logger?.error(`Provider connection test failed for ${providerId}`, error);
      return false;
    }
  }

  /**
   * Update webview state after configuration or provider changes
   */
  private async _updateWebViewState(): Promise<void> {
    if (!this._view) return;
    
    try {
      const config = this.configManager.getConfiguration();
      
      // Get current default provider
      const defaultProvider = Object.entries(config.providers).find(([_, provider]) => provider.isDefault);
      
      await this.postMessageToWebview('stateUpdate', {
        providers: Object.entries(config.providers).map(([id, provider]) => ({
          id,
          enabled: provider.enabled,
          isDefault: provider.isDefault,
          name: provider.config['name'] || id
        })),
        currentProvider: defaultProvider ? defaultProvider[0] : null,
        configuration: config.ui
      });
      
      this.logger?.debug('Webview state updated', {
        providersCount: Object.keys(config.providers).length,
        defaultProvider: defaultProvider ? defaultProvider[0] : null
      });
      
    } catch (error) {
      this.logger?.error('Failed to update webview state', error);
    }
  }
  
  public reveal(): void {
    if (this._view) {
      this._view.show?.(true);
    }
  }
  
  public dispose(): void {
    this.logger?.info('ChatWebViewProvider disposing', {
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

    this.logger?.info('ChatWebViewProvider disposed successfully', {
      sessionId: this._sessionId,
      contextStatesCleared: this._contextState.size
    });
  }
}