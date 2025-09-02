/**
 * Chat WebView Provider for VS Code integration
 */
import * as vscode from 'vscode';
import { ChatEventRouter } from '../../events/ChatEventRouter';
import { ChatConfigurationManager } from '../../core/ConfigurationManager';
import { ChatTemplateRegistry } from '../../core/TemplateRegistry';
import { 
  WebViewMessage, 
  WebViewResponse, 
  WebViewMessageType,
  ConfigureProviderRequest,
  RemoveProviderRequest,
  SetDefaultProviderRequest,
  TestProviderConnectionRequest,
  RequestProviderTemplateRequest,
  ValidateProviderConfigRequest
} from '../../types/webview';
import { getNonce, getChatWebViewContent } from './HtmlGenerator';

export class ChatWebViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vesperaForge.chatView';
  
  private _view?: vscode.WebviewView;
  private _disposables: vscode.Disposable[] = [];
  
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly eventRouter: ChatEventRouter,
    private readonly configManager: ChatConfigurationManager,
    private readonly templateRegistry: ChatTemplateRegistry
  ) {}
  
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void | Thenable<void> {
    this._view = webviewView;
    
    // Configure webview
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };
    
    // Set initial content
    this.updateWebviewContent();
    
    // Setup message handling
    this.setupMessageHandling();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Handle webview disposal
    webviewView.onDidDispose(() => {
      this.dispose();
    });
  }
  
  private updateWebviewContent(): void {
    if (this._view) {
      this._view.webview.html = getChatWebViewContent(
        this._view.webview,
        this.context.extensionUri
      );
    }
  }
  
  private setupMessageHandling(): void {
    if (!this._view) return;
    
    this._view.webview.onDidReceiveMessage(
      async (message: WebViewMessage) => {
        try {
          console.log(`[ChatWebView] Received message: ${message.type}`, message.data);
          const response = await this.handleMessage(message);
          
          // Send response back to webview
          if (message.requestId) {
            await this._view!.webview.postMessage({
              ...response,
              requestId: message.requestId
            });
          }
        } catch (error) {
          console.error('[ChatWebView] Error handling message:', error);
          
          if (message.requestId) {
            await this._view!.webview.postMessage({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              requestId: message.requestId
            });
          }
        }
      },
      null,
      this._disposables
    );
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
        
      default:
        return {
          success: false,
          error: `Unknown message type: ${message.type}`
        };
    }
  }
  
  private async handleSendMessage(data: any): Promise<WebViewResponse> {
    // TODO: Implement actual message sending logic
    console.log('[ChatWebView] Sending message:', data);
    
    // Emit chat event
    this.eventRouter.emit({
      type: 'chatMessageSent',
      data: {
        messageId: `msg_${Date.now()}`,
        content: data.content,
        provider: data.providerId || 'unknown'
      }
    });
    
    return {
      success: true,
      data: {
        messageId: `msg_${Date.now()}`,
        timestamp: new Date().toISOString()
      }
    };
  }
  
  private async handleSwitchProvider(data: any): Promise<WebViewResponse> {
    // TODO: Implement provider switching logic
    console.log('[ChatWebView] Switching provider to:', data.providerId);
    
    this.eventRouter.emit({
      type: 'chatProviderChanged',
      data: {
        from: data.currentProviderId,
        to: data.providerId
      }
    });
    
    return { success: true };
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
      
      // TODO: Implement actual connection test with provider
      // For now, simulate a connection test
      await new Promise(resolve => setTimeout(resolve, 1000));
      const testPassed = Math.random() > 0.2; // 80% success rate for demo
      
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
    // TODO: Implement history clearing logic
    console.log('[ChatWebView] Clearing chat history');
    
    return { success: true };
  }
  
  private async handleExportHistory(): Promise<WebViewResponse> {
    // TODO: Implement history export logic
    console.log('[ChatWebView] Exporting chat history');
    
    return { 
      success: true,
      data: { 
        exported: true,
        format: 'json' 
      }
    };
  }
  
  private async handleUpdateSettings(data: any): Promise<WebViewResponse> {
    // TODO: Implement settings update logic
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
    // TODO: Get actual providers from provider manager
    const mockProviders = [
      {
        id: 'openai',
        name: 'OpenAI GPT-4',
        status: 'connected',
        enabled: true
      },
      {
        id: 'anthropic',
        name: 'Anthropic Claude',
        status: 'disconnected',
        enabled: true
      }
    ];
    
    return {
      success: true,
      data: { providers: mockProviders }
    };
  }
  
  private async handleRequestHistory(): Promise<WebViewResponse> {
    // TODO: Get actual chat history
    const mockHistory = {
      messages: [],
      totalCount: 0
    };
    
    return {
      success: true,
      data: mockHistory
    };
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
  
  public reveal(): void {
    if (this._view) {
      this._view.show?.(true);
    }
  }
  
  public dispose(): void {
    this._disposables.forEach(d => d.dispose());
    this._disposables.length = 0;
  }
}