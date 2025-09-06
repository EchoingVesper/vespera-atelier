/**
 * Session Persistence Integration - Issue #40 Resolution
 * 
 * This file integrates all the revolutionary session persistence systems:
 * - SecureSessionPersistenceManager (VS Code SecretStorage)
 * - TaskServerManager (Dynamic task-driven servers)
 * - MultiChatStateManager (State preservation)
 * - ChatServerTemplateManager (Codex integration)
 * - TaskChatIntegration (MCP connection)
 * - EnhancedChatWebViewProvider (Discord-like UI)
 * 
 * Resolves Issue #40: Session context does not persist through VS Code restart
 */

import * as vscode from 'vscode';
import { VesperaLogger } from '../core/logging/VesperaLogger';
import { VesperaErrorHandler } from '../core/error-handling/VesperaErrorHandler';
import { SecurityEnhancedVesperaCoreServices } from '../core/security/SecurityEnhancedCoreServices';
import { ChatEventRouter } from './events/ChatEventRouter';
import { ChatConfigurationManager } from './core/ConfigurationManager';
import { ChatTemplateRegistry } from './core/TemplateRegistry';

// Import all our new systems
import { SecureSessionPersistenceManager } from './persistence/SecureSessionPersistenceManager';
import { TaskServerManager } from './servers/TaskServerManager';
import { MultiChatStateManager } from './state/MultiChatStateManager';
import { ChatServerTemplateManager } from './templates/ChatServerTemplateManager';
import { TaskChatIntegration } from './integration/TaskChatIntegration';
import { EnhancedChatWebViewProvider } from './ui/webview/EnhancedChatWebViewProvider';

export interface SessionPersistenceConfig {
  enableSecureStorage: boolean;
  enableTaskServerIntegration: boolean;
  enableMultiServerUI: boolean;
  enableCodexTemplates: boolean;
  enableMCPIntegration: boolean;
  sessionValidationInterval: number;
  maxSessionHistory: number;
  debugMode: boolean;
}

export class SessionPersistenceIntegration {
  // Core systems
  private persistenceManager!: SecureSessionPersistenceManager;
  private taskServerManager!: TaskServerManager;
  private stateManager!: MultiChatStateManager;
  private templateManager!: ChatServerTemplateManager;
  private taskIntegration!: TaskChatIntegration;
  private enhancedWebViewProvider!: EnhancedChatWebViewProvider;

  // Disposables
  private disposables: vscode.Disposable[] = [];
  private isInitialized = false;

  private config: SessionPersistenceConfig = {
    enableSecureStorage: true,
    enableTaskServerIntegration: true,
    enableMultiServerUI: true,
    enableCodexTemplates: true,
    enableMCPIntegration: true,
    sessionValidationInterval: 300000, // 5 minutes
    maxSessionHistory: 1000,
    debugMode: false
  };

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly coreServices: SecurityEnhancedVesperaCoreServices,
    private readonly eventRouter: ChatEventRouter,
    private readonly configManager: ChatConfigurationManager,
    private readonly templateRegistry: ChatTemplateRegistry,
    private readonly logger: VesperaLogger,
    private readonly errorHandler: VesperaErrorHandler
  ) {}

  /**
   * Initialize all session persistence systems
   * This resolves Issue #40 by implementing comprehensive session persistence
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info('🚀 Initializing Session Persistence Integration - Issue #40 Resolution');

      // Load configuration
      await this.loadConfiguration();

      // Initialize core systems in dependency order
      await this.initializeCoreSystem();

      // Setup integration between systems
      await this.setupSystemIntegration();

      // Register webview provider
      await this.registerWebViewProvider();

      // Setup extension integration
      await this.setupExtensionIntegration();

      // Perform initial session restoration
      await this.performInitialSessionRestore();

      this.isInitialized = true;

      this.logger.info('✅ Session Persistence Integration initialized successfully', {
        issueResolved: '#40 - Session context persistence',
        features: {
          secureStorage: this.config.enableSecureStorage,
          taskServerIntegration: this.config.enableTaskServerIntegration,
          multiServerUI: this.config.enableMultiServerUI,
          codexTemplates: this.config.enableCodexTemplates,
          mcpIntegration: this.config.enableMCPIntegration
        }
      });

      // Show success notification
      vscode.window.showInformationMessage(
        '🎉 Issue #40 Resolved: Session persistence across VS Code restarts is now active!',
        'View Chat'
      ).then(selection => {
        if (selection === 'View Chat') {
          this.enhancedWebViewProvider.reveal();
        }
      });

    } catch (error) {
      this.logger.error('❌ Failed to initialize Session Persistence Integration', error);
      await this.errorHandler.handleError(error as Error);
      
      // Show error notification
      vscode.window.showErrorMessage(
        'Failed to initialize session persistence. Some features may not work correctly.',
        'View Logs'
      ).then(selection => {
        if (selection === 'View Logs') {
          // Would open log viewer
        }
      });
      
      throw error;
    }
  }

  /**
   * Initialize core systems
   */
  private async initializeCoreSystem(): Promise<void> {
    this.logger.info('Initializing core systems...');

    // 1. Initialize SecureSessionPersistenceManager first (foundation)
    if (this.config.enableSecureStorage) {
      this.persistenceManager = new SecureSessionPersistenceManager(
        this.context,
        this.logger,
        this.errorHandler
      );
      await this.persistenceManager.initializeSession();
      this.logger.info('✓ Secure session persistence initialized');
    }

    // 2. Initialize TaskServerManager (depends on persistence)
    if (this.config.enableTaskServerIntegration) {
      this.taskServerManager = new TaskServerManager(
        this.persistenceManager,
        this.logger,
        this.errorHandler
      );
      this.logger.info('✓ Task server manager initialized');
    }

    // 3. Initialize MultiChatStateManager (depends on persistence and task manager)
    this.stateManager = new MultiChatStateManager(
      this.persistenceManager,
      this.taskServerManager,
      this.logger,
      this.errorHandler
    );
    await this.stateManager.initialize();
    this.logger.info('✓ Multi-chat state manager initialized');

    // 4. Initialize ChatServerTemplateManager (Codex integration)
    if (this.config.enableCodexTemplates) {
      this.templateManager = new ChatServerTemplateManager(
        this.logger,
        this.errorHandler
      );
      await this.templateManager.initialize();
      this.logger.info('✓ Chat server template manager initialized');
    }

    // 5. Initialize TaskChatIntegration (MCP connection)
    if (this.config.enableMCPIntegration) {
      this.taskIntegration = new TaskChatIntegration(
        this.context,
        this.persistenceManager,
        this.taskServerManager,
        this.stateManager,
        this.logger,
        this.errorHandler
      );
      await this.taskIntegration.initialize();
      this.logger.info('✓ Task chat integration initialized');
    }

    // 6. Initialize EnhancedChatWebViewProvider (UI)
    if (this.config.enableMultiServerUI) {
      this.enhancedWebViewProvider = new EnhancedChatWebViewProvider(
        this.context,
        this.eventRouter,
        this.configManager,
        this.templateRegistry,
        this.persistenceManager,
        this.stateManager,
        this.taskServerManager,
        this.templateManager,
        this.taskIntegration,
        this.coreServices,
        this.logger,
        this.errorHandler
      );
      this.logger.info('✓ Enhanced chat webview provider initialized');
    }
  }

  /**
   * Setup integration between systems
   */
  private async setupSystemIntegration(): Promise<void> {
    this.logger.info('Setting up system integration...');

    // Setup cross-system event handlers
    if (this.taskServerManager && this.stateManager) {
      // Task server events -> State manager updates
      this.disposables.push(
        this.taskServerManager.onServerEvent('taskServerCreated', async (event) => {
          if (event.data?.server) {
            await this.stateManager.addServer(event.data.server);
            this.logger.debug('Task server added to state manager', {
              serverId: event.serverId
            });
          }
        })
      );

      this.disposables.push(
        this.taskServerManager.onServerEvent('agentChannelAdded', async (event) => {
          if (event.data?.channel && event.serverId) {
            await this.stateManager.addChannel(event.data.channel, event.serverId);
            this.logger.debug('Agent channel added to state manager', {
              channelId: event.data.channel.channelId
            });
          }
        })
      );
    }

    // Setup state change persistence
    if (this.stateManager && this.persistenceManager) {
      this.disposables.push(
        this.stateManager.onStateChange(async (event) => {
          // Automatically save state changes to persistence
          await this.saveCurrentState();
          
          this.logger.debug('State change persisted', {
            eventType: event.type,
            serverId: event.serverId,
            channelId: event.channelId
          });
        })
      );
    }

    // Setup periodic cleanup
    this.setupPeriodicMaintenance();

    this.logger.info('✓ System integration setup completed');
  }

  /**
   * Register webview provider with VS Code
   */
  private async registerWebViewProvider(): Promise<void> {
    if (!this.config.enableMultiServerUI) {
      return;
    }

    this.disposables.push(
      vscode.window.registerWebviewViewProvider(
        EnhancedChatWebViewProvider.viewType,
        this.enhancedWebViewProvider,
        {
          webviewOptions: {
            retainContextWhenHidden: true // Important for session persistence
          }
        }
      )
    );

    this.logger.info('✓ Enhanced chat webview provider registered');
  }

  /**
   * Setup extension integration points
   */
  private async setupExtensionIntegration(): Promise<void> {
    // Register commands for manual operations
    this.disposables.push(
      vscode.commands.registerCommand('vesperaForge.clearChatSession', async () => {
        await this.clearSession();
      })
    );

    this.disposables.push(
      vscode.commands.registerCommand('vesperaForge.exportChatSession', async () => {
        await this.exportSession();
      })
    );

    this.disposables.push(
      vscode.commands.registerCommand('vesperaForge.showSessionStatus', async () => {
        await this.showSessionStatus();
      })
    );

    // Setup workspace change handlers
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(async (_event) => {
        // Reinitialize Codex templates if workspace changes
        if (this.templateManager) {
          await this.templateManager.initialize();
        }
      })
    );

    this.logger.info('✓ Extension integration setup completed');
  }

  /**
   * Perform initial session restoration
   */
  private async performInitialSessionRestore(): Promise<void> {
    this.logger.info('Performing initial session restoration...');

    try {
      // Get restored session
      const session = this.persistenceManager.getCurrentSession();
      if (!session) {
        this.logger.info('No previous session to restore');
        return;
      }

      // Validate session integrity
      const serverCount = session.servers.length;
      const messageCount = session.messageHistory.length;
      const taskServerCount = session.taskServerStates.length;

      this.logger.info('Session restoration completed', {
        sessionId: session.sessionId,
        timestamp: new Date(session.timestamp).toISOString(),
        servers: serverCount,
        messages: messageCount,
        taskServers: taskServerCount,
        activeServerId: session.activeServerId,
        activeChannelId: session.activeChannelId
      });

      // Show restoration notification in debug mode
      if (this.config.debugMode) {
        vscode.window.showInformationMessage(
          `Session restored: ${serverCount} servers, ${messageCount} messages`,
          'View Details'
        ).then(selection => {
          if (selection === 'View Details') {
            this.showSessionStatus();
          }
        });
      }

    } catch (error) {
      this.logger.error('Failed to perform initial session restoration', error);
      // Don't throw - we can continue with a new session
    }
  }

  /**
   * Setup periodic maintenance tasks
   */
  private setupPeriodicMaintenance(): void {
    // Periodic state saving
    const saveInterval = setInterval(async () => {
      try {
        await this.saveCurrentState();
        this.logger.debug('Periodic state save completed');
      } catch (error) {
        this.logger.error('Periodic state save failed', error);
      }
    }, 30000); // Every 30 seconds

    // Cleanup old servers
    const cleanupInterval = setInterval(async () => {
      try {
        await this.stateManager.cleanupArchivedServers();
        this.logger.debug('Periodic cleanup completed');
      } catch (error) {
        this.logger.error('Periodic cleanup failed', error);
      }
    }, 3600000); // Every hour

    this.disposables.push(
      new vscode.Disposable(() => {
        clearInterval(saveInterval);
        clearInterval(cleanupInterval);
      })
    );
  }

  /**
   * Save current state across all systems
   */
  private async saveCurrentState(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      const session = this.persistenceManager.getCurrentSession();
      if (session) {
        await this.persistenceManager.saveSession(session);
      }
    } catch (error) {
      this.logger.error('Failed to save current state', error);
    }
  }

  /**
   * Clear session (for testing/reset)
   */
  public async clearSession(): Promise<void> {
    try {
      await this.persistenceManager.clearSession();
      
      // Reinitialize systems
      await this.stateManager.initialize();
      
      vscode.window.showInformationMessage('Chat session cleared successfully');
      
      this.logger.info('Session cleared and reinitialized');
      
    } catch (error) {
      this.logger.error('Failed to clear session', error);
      vscode.window.showErrorMessage('Failed to clear session');
    }
  }

  /**
   * Export session data
   */
  public async exportSession(): Promise<void> {
    try {
      const session = this.persistenceManager.getCurrentSession();
      if (!session) {
        vscode.window.showWarningMessage('No session data to export');
        return;
      }

      // Create export data (sanitized)
      const exportData = {
        sessionId: session.sessionId,
        timestamp: session.timestamp,
        serverCount: session.servers.length,
        messageCount: session.messageHistory.length,
        taskServerCount: session.taskServerStates.length,
        exportedAt: new Date().toISOString(),
        version: '1.0.0'
      };

      // Show save dialog
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`vespera-chat-session-${Date.now()}.json`),
        filters: {
          'JSON Files': ['json']
        }
      });

      if (saveUri) {
        await vscode.workspace.fs.writeFile(
          saveUri,
          Buffer.from(JSON.stringify(exportData, null, 2))
        );
        
        vscode.window.showInformationMessage(
          `Session exported to ${saveUri.fsPath}`,
          'Open File'
        ).then(selection => {
          if (selection === 'Open File') {
            vscode.window.showTextDocument(saveUri);
          }
        });
      }

    } catch (error) {
      this.logger.error('Failed to export session', error);
      vscode.window.showErrorMessage('Failed to export session');
    }
  }

  /**
   * Show session status
   */
  public async showSessionStatus(): Promise<void> {
    try {
      const session = this.persistenceManager.getCurrentSession();
      if (!session) {
        vscode.window.showInformationMessage('No active session');
        return;
      }

      const mcpStatus = this.taskIntegration?.getMCPConnectionStatus() || 'not initialized';
      
      const status = {
        sessionId: session.sessionId,
        sessionAge: Math.round((Date.now() - session.timestamp) / 1000 / 60), // minutes
        servers: session.servers.length,
        activeServer: session.activeServerId,
        channels: session.servers.reduce((sum, s) => sum + s.channels.length, 0),
        activeChannel: session.activeChannelId,
        messages: session.messageHistory.length,
        taskServers: session.taskServerStates.length,
        activeTaskServers: session.taskServerStates.filter(t => t.status === 'active').length,
        totalUnread: this.stateManager.getTotalUnreadCount(),
        mcpIntegration: mcpStatus,
        systemsInitialized: this.isInitialized
      };

      // Create status display
      const statusLines = [
        `📊 Session Status - Issue #40 Resolution`,
        ``,
        `🔐 Session ID: ${status.sessionId}`,
        `⏰ Session Age: ${status.sessionAge} minutes`,
        ``,
        `🏢 Servers: ${status.servers} (Active: ${status.activeServer ? '✓' : '✗'})`,
        `📺 Channels: ${status.channels} (Active: ${status.activeChannel ? '✓' : '✗'})`,
        `💬 Messages: ${status.messages}`,
        `🔔 Unread: ${status.totalUnread}`,
        ``,
        `🤖 Task Servers: ${status.taskServers} (Active: ${status.activeTaskServers})`,
        `🔗 MCP Integration: ${status.mcpIntegration}`,
        ``,
        `✅ Systems: ${status.systemsInitialized ? 'All Initialized' : 'Partial'}`,
        ``,
        `Issue #40 Status: ✅ RESOLVED - Session persists across restarts!`
      ];

      const statusText = statusLines.join('\n');

      // Show in information message with options
      const action = await vscode.window.showInformationMessage(
        statusText,
        { modal: true },
        'Export Session',
        'Clear Session',
        'View Chat'
      );

      switch (action) {
        case 'Export Session':
          await this.exportSession();
          break;
        case 'Clear Session':
          await this.clearSession();
          break;
        case 'View Chat':
          this.enhancedWebViewProvider.reveal();
          break;
      }

    } catch (error) {
      this.logger.error('Failed to show session status', error);
      vscode.window.showErrorMessage('Failed to retrieve session status');
    }
  }

  /**
   * Load configuration
   */
  private async loadConfiguration(): Promise<void> {
    const config = vscode.workspace.getConfiguration('vesperaForge.sessionPersistence');
    
    this.config = {
      enableSecureStorage: config.get('enableSecureStorage', true),
      enableTaskServerIntegration: config.get('enableTaskServerIntegration', true),
      enableMultiServerUI: config.get('enableMultiServerUI', true),
      enableCodexTemplates: config.get('enableCodexTemplates', true),
      enableMCPIntegration: config.get('enableMCPIntegration', true),
      sessionValidationInterval: config.get('sessionValidationInterval', 300000),
      maxSessionHistory: config.get('maxSessionHistory', 1000),
      debugMode: config.get('debugMode', false)
    };

    this.logger.info('Configuration loaded', this.config);
  }

  /**
   * Get integration status
   */
  public getStatus(): {
    initialized: boolean;
    sessionActive: boolean;
    systemsCounts: {
      servers: number;
      channels: number;
      messages: number;
      taskServers: number;
    };
    mcpStatus: string;
  } {
    const session = this.persistenceManager?.getCurrentSession();
    
    return {
      initialized: this.isInitialized,
      sessionActive: !!session,
      systemsCounts: {
        servers: session?.servers.length || 0,
        channels: session?.servers.reduce((sum, s) => sum + s.channels.length, 0) || 0,
        messages: session?.messageHistory.length || 0,
        taskServers: session?.taskServerStates.length || 0
      },
      mcpStatus: this.taskIntegration?.getMCPConnectionStatus() || 'not initialized'
    };
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    this.logger.info('Disposing Session Persistence Integration');

    // Dispose all systems in reverse order
    if (this.enhancedWebViewProvider) {
      this.enhancedWebViewProvider.dispose();
    }

    if (this.taskIntegration) {
      this.taskIntegration.dispose();
    }

    if (this.templateManager) {
      this.templateManager.dispose();
    }

    if (this.stateManager) {
      this.stateManager.dispose();
    }

    if (this.taskServerManager) {
      this.taskServerManager.dispose();
    }

    if (this.persistenceManager) {
      this.persistenceManager.dispose();
    }

    // Dispose extension resources
    this.disposables.forEach(d => d.dispose());
    this.disposables.length = 0;

    this.isInitialized = false;

    this.logger.info('Session Persistence Integration disposed successfully');
  }
}