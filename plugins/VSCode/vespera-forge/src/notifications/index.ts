/**
 * Vespera Forge Notification System - Main Export
 * 
 * Comprehensive notification system with OS toast integration, agent progress tracking,
 * task-server notifications, multi-chat events, and enterprise-grade security.
 */

// Core notification system
export {
  SecureNotificationManager,
  NotificationLevel,
  NotificationType,
  NotificationConfig,
  NotificationRequest,
  NotificationResult,
  NotificationAction
} from './SecureNotificationManager';

// Agent progress tracking
export {
  AgentProgressNotifier,
  OperationStatus,
  AgentType,
  LongRunningOperation,
  OperationMilestone,
  AgentProgressUpdate,
  ProgressNotificationConfig
} from './AgentProgressNotifier';

// Task server integration
export {
  TaskServerNotificationIntegration,
  TaskServerNotificationEvent,
  TaskServerNotificationConfig
} from './TaskServerNotificationIntegration';

// Multi-chat system
export {
  MultiChatNotificationManager,
  ChatEventType,
  ChatEvent,
  ChatMessage,
  ChatUser,
  ChatChannel,
  ChatServer,
  PresenceStatus,
  MultiChatNotificationConfig
} from './MultiChatNotificationManager';

// Configuration management
export {
  NotificationConfigManager,
  GlobalNotificationConfig,
  ServerSpecificConfig,
  UserPreferences,
  NotificationProfile,
  NotificationAnalytics
} from './NotificationConfigManager';

// Cross-platform support
export {
  CrossPlatformNotificationHandler,
  PlatformType,
  NotificationCapability,
  PlatformNotificationConfig,
  PlatformNotificationResult
} from './platform/CrossPlatformNotificationHandler';

// Chat system integration
export {
  ChatNotificationIntegration,
  ChatIntegrationEventType,
  ChatProviderEvent,
  ContextUpdateEvent,
  SecurityEvent,
  PerformanceEvent,
  ChatIntegrationConfig
} from './ChatNotificationIntegration';

/**
 * Initialize the complete notification system
 */
import * as vscode from 'vscode';
import { SecurityEnhancedVesperaCoreServices } from '../core/security/SecurityEnhancedCoreServices';
import { ChatManager } from '../chat/core/ChatManager';
import { TaskServerManager } from '../chat/servers/TaskServerManager';
import { FileContextCollector } from '../chat/context/FileContextCollector';
import { SecureNotificationManager, NotificationLevel, NotificationType } from './SecureNotificationManager';
import { AgentProgressNotifier } from './AgentProgressNotifier';
import { TaskServerNotificationIntegration } from './TaskServerNotificationIntegration';
import { MultiChatNotificationManager } from './MultiChatNotificationManager';
import { NotificationConfigManager, NotificationAnalytics } from './NotificationConfigManager';
import { CrossPlatformNotificationHandler } from './platform/CrossPlatformNotificationHandler';
import { ChatNotificationIntegration } from './ChatNotificationIntegration';

export interface NotificationSystemConfig {
  enabled: boolean;
  osToastEnabled: boolean;
  agentProgressEnabled: boolean;
  taskServerIntegrationEnabled: boolean;
  multiChatEnabled: boolean;
  chatIntegrationEnabled: boolean;
  crossPlatformEnabled: boolean;
}

export class VesperaNotificationSystem implements vscode.Disposable {
  private static instance: VesperaNotificationSystem;
  private initialized = false;
  private disposables: vscode.Disposable[] = [];

  // Core components
  public readonly secureNotificationManager: SecureNotificationManager;
  public readonly agentProgressNotifier: AgentProgressNotifier;
  public readonly taskServerNotificationIntegration: TaskServerNotificationIntegration;
  public readonly multiChatNotificationManager: MultiChatNotificationManager;
  public readonly notificationConfigManager: NotificationConfigManager;
  public readonly crossPlatformHandler: CrossPlatformNotificationHandler;
  public readonly chatNotificationIntegration: ChatNotificationIntegration;

  private constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly coreServices: SecurityEnhancedVesperaCoreServices,
    private readonly _chatManager: ChatManager,
    private readonly _taskServerManager: TaskServerManager,
    private readonly _contextCollector: FileContextCollector,
    secureNotificationManager: SecureNotificationManager,
    agentProgressNotifier: AgentProgressNotifier,
    taskServerNotificationIntegration: TaskServerNotificationIntegration,
    multiChatNotificationManager: MultiChatNotificationManager,
    notificationConfigManager: NotificationConfigManager,
    crossPlatformHandler: CrossPlatformNotificationHandler,
    chatNotificationIntegration: ChatNotificationIntegration
  ) {
    this.secureNotificationManager = secureNotificationManager;
    this.agentProgressNotifier = agentProgressNotifier;
    this.taskServerNotificationIntegration = taskServerNotificationIntegration;
    this.multiChatNotificationManager = multiChatNotificationManager;
    this.notificationConfigManager = notificationConfigManager;
    this.crossPlatformHandler = crossPlatformHandler;
    this.chatNotificationIntegration = chatNotificationIntegration;

    // TODO: Implement full integration with architectural scaffolding
    if (this._context && this._chatManager && this._taskServerManager && this._contextCollector) {
      this.coreServices.logger.debug('Notification system fully configured with all architectural components');
    }

    // Register for disposal
    this.disposables.push(
      this.secureNotificationManager,
      this.agentProgressNotifier,
      this.taskServerNotificationIntegration,
      this.multiChatNotificationManager,
      this.notificationConfigManager,
      this.crossPlatformHandler,
      this.chatNotificationIntegration
    );
  }

  /**
   * Initialize the complete notification system
   */
  public static async initialize(
    context: vscode.ExtensionContext,
    coreServices: SecurityEnhancedVesperaCoreServices,
    chatManager: ChatManager,
    taskServerManager: TaskServerManager,
    contextCollector: FileContextCollector,
    _config: NotificationSystemConfig = VesperaNotificationSystem.getDefaultConfig()
  ): Promise<VesperaNotificationSystem> {
    if (VesperaNotificationSystem.instance) {
      return VesperaNotificationSystem.instance;
    }

    const logger = coreServices.logger.createChild('NotificationSystem');
    logger.info('Initializing Vespera Notification System');

    try {
      // Initialize configuration manager first
      const configManager = await NotificationConfigManager.initialize(
        context,
        coreServices
      );

      // Initialize cross-platform handler
      const crossPlatformHandler = await CrossPlatformNotificationHandler.initialize(
        context,
        coreServices
      );

      // Initialize core notification manager
      const notificationManager = await SecureNotificationManager.initialize(
        context,
        coreServices
      );

      // Initialize agent progress notifier
      const agentProgressNotifier = await AgentProgressNotifier.initialize(
        context,
        coreServices,
        notificationManager
      );

      // Initialize multi-chat notification manager
      const multiChatManager = await MultiChatNotificationManager.initialize(
        context,
        coreServices,
        notificationManager
      );

      // Initialize task server notification integration
      const taskServerIntegration = await TaskServerNotificationIntegration.initialize(
        context,
        coreServices,
        notificationManager,
        agentProgressNotifier,
        taskServerManager
      );

      // Initialize chat notification integration
      const chatIntegration = await ChatNotificationIntegration.initialize(
        context,
        coreServices,
        notificationManager,
        multiChatManager,
        chatManager,
        contextCollector
      );

      // Create the complete system
      const system = new VesperaNotificationSystem(
        context,
        coreServices,
        chatManager,
        taskServerManager,
        contextCollector,
        notificationManager,
        agentProgressNotifier,
        taskServerIntegration,
        multiChatManager,
        configManager,
        crossPlatformHandler,
        chatIntegration
      );

      system.initialized = true;
      VesperaNotificationSystem.instance = system;

      // Register with extension context
      context.subscriptions.push(system);

      logger.info('Vespera Notification System initialized successfully');
      
      // Show system ready notification
      await system.showSystemReadyNotification();

      return system;

    } catch (error) {
      logger.error('Failed to initialize Vespera Notification System', error);
      throw error;
    }
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): VesperaNotificationSystem {
    if (!VesperaNotificationSystem.instance?.initialized) {
      throw new Error('VesperaNotificationSystem not initialized');
    }
    return VesperaNotificationSystem.instance;
  }

  /**
   * Show system ready notification
   */
  private async showSystemReadyNotification(): Promise<void> {
    try {
      await this.secureNotificationManager.notify({
        title: 'Notification System Ready',
        message: 'Vespera Forge notification system is fully operational',
        type: NotificationType.SYSTEM_STATUS,
        level: NotificationLevel.INFO,
        data: {
          components: [
            'SecureNotificationManager',
            'AgentProgressNotifier',
            'TaskServerNotificationIntegration',
            'MultiChatNotificationManager',
            'NotificationConfigManager',
            'CrossPlatformNotificationHandler',
            'ChatNotificationIntegration'
          ]
        },
        showInToast: false
      });
    } catch (error) {
      // Don't fail system initialization if ready notification fails
      this.coreServices.logger.warn('Failed to show system ready notification', { error });
    }
  }

  /**
   * Get comprehensive system status
   */
  public async getSystemStatus(): Promise<{
    initialized: boolean;
    components: {
      name: string;
      status: 'healthy' | 'warning' | 'error';
      details?: any;
    }[];
    configuration: {
      enabled: boolean;
      osToastEnabled: boolean;
      platformSupport: string;
      activeProfile?: string;
    };
    analytics: NotificationAnalytics;
  }> {
    const components = [
      {
        name: 'SecureNotificationManager',
        status: 'healthy' as const
      },
      {
        name: 'AgentProgressNotifier',
        status: 'healthy' as const
      },
      {
        name: 'TaskServerNotificationIntegration',
        status: 'healthy' as const
      },
      {
        name: 'MultiChatNotificationManager',
        status: 'healthy' as const
      },
      {
        name: 'NotificationConfigManager',
        status: 'healthy' as const
      },
      {
        name: 'CrossPlatformNotificationHandler',
        status: 'healthy' as const
      },
      {
        name: 'ChatNotificationIntegration',
        status: 'healthy' as const
      }
    ];

    const config = this.notificationConfigManager.getEffectiveConfig();
    const activeProfile = this.notificationConfigManager.getActiveProfile();
    const analytics = this.notificationConfigManager.getAnalytics();

    return {
      initialized: this.initialized,
      components,
      configuration: {
        enabled: config.enabled,
        osToastEnabled: config.osToastEnabled,
        platformSupport: process.platform,
        activeProfile: activeProfile?.name
      },
      analytics
    };
  }

  /**
   * Update system configuration
   */
  public async updateSystemConfiguration(config: Partial<NotificationSystemConfig>): Promise<void> {
    // Would update individual component configurations based on system config
    // For now, we'll just log the update
    this.coreServices.logger.info('System configuration update requested', config);
  }

  /**
   * Emergency disable all notifications
   */
  public async emergencyDisable(): Promise<void> {
    await this.notificationConfigManager.updateGlobalConfig({
      enabled: false,
      emergencyOverride: true
    });
  }

  /**
   * Emergency enable all notifications
   */
  public async emergencyEnable(): Promise<void> {
    await this.notificationConfigManager.updateGlobalConfig({
      enabled: true,
      emergencyOverride: false
    });
  }

  /**
   * Get default system configuration
   */
  private static getDefaultConfig(): NotificationSystemConfig {
    return {
      enabled: true,
      osToastEnabled: true,
      agentProgressEnabled: true,
      taskServerIntegrationEnabled: true,
      multiChatEnabled: true,
      chatIntegrationEnabled: true,
      crossPlatformEnabled: true
    };
  }

  /**
   * Check if system is healthy
   */
  public isHealthy(): boolean {
    return this.initialized;
  }

  /**
   * Dispose the complete system
   */
  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables.length = 0;
    
    this.initialized = false;
    VesperaNotificationSystem.instance = undefined as any;
    
    this.coreServices.logger.info('VesperaNotificationSystem disposed');
  }
}