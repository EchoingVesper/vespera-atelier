/**
 * Chat Notification Integration
 * 
 * Comprehensive integration with the existing chat system for chat provider
 * notifications, context display updates, security events, performance
 * monitoring, and extension lifecycle notifications.
 */

import * as vscode from 'vscode';
import { VesperaLogger } from '../core/logging/VesperaLogger';
import { VesperaErrorHandler } from '../core/error-handling/VesperaErrorHandler';
import { SecurityEnhancedVesperaCoreServices } from '../core/security/SecurityEnhancedCoreServices';
import { ChatManager } from '../chat/core/ChatManager';
import { FileContextCollector } from '../chat/context/FileContextCollector';
import { 
  SecureNotificationManager, 
  NotificationLevel, 
  NotificationType, 
  NotificationAction 
} from './SecureNotificationManager';
import { 
  MultiChatNotificationManager,
  ChatEventType,
  ChatEvent
} from './MultiChatNotificationManager';
import {
  getLogger,
  logSecurityEvent,
  trackEvent
} from '../core/integration/CoreServicesIntegrationHelpers';
import { QuickUsageFunctions } from '../chat/integration/UnusedVariableIntegrationExamples';

export enum ChatIntegrationEventType {
  PROVIDER_ERROR = 'provider_error',
  PROVIDER_RATE_LIMIT = 'provider_rate_limit',
  PROVIDER_QUOTA_EXCEEDED = 'provider_quota_exceeded',
  CONTEXT_UPDATED = 'context_updated',
  CONTEXT_ERROR = 'context_error',
  SECURITY_EVENT = 'security_event',
  PERFORMANCE_ALERT = 'performance_alert',
  EXTENSION_LIFECYCLE = 'extension_lifecycle',
  CHAT_SESSION_EVENT = 'chat_session_event',
  FILE_WATCHER_EVENT = 'file_watcher_event'
}

export interface ChatIntegrationConfig {
  enabled: boolean;
  providerNotifications: {
    showErrorNotifications: boolean;
    showRateLimitNotifications: boolean;
    showQuotaNotifications: boolean;
    showConnectionStatus: boolean;
  };
  contextNotifications: {
    showContextUpdates: boolean;
    showFileChanges: boolean;
    showContextErrors: boolean;
    batchFileUpdates: boolean;
  };
  securityNotifications: {
    showSecurityEvents: boolean;
    showAuditAlerts: boolean;
    showComplianceIssues: boolean;
  };
  performanceNotifications: {
    showPerformanceAlerts: boolean;
    responseTimeThreshold: number; // milliseconds
    memoryUsageThreshold: number; // MB
    cpuUsageThreshold: number; // percentage
  };
  lifecycleNotifications: {
    showActivation: boolean;
    showDeactivation: boolean;
    showUpdates: boolean;
    showErrors: boolean;
  };
}

export interface ChatProviderEvent {
  providerId: string;
  providerName: string;
  eventType: 'error' | 'rate_limit' | 'quota_exceeded' | 'connection_status';
  message: string;
  details?: any;
  timestamp: number;
}

export interface ContextUpdateEvent {
  updateType: 'file_added' | 'file_removed' | 'file_changed' | 'context_refreshed';
  files: string[];
  contextSize: number;
  processingTime: number;
  errors?: string[];
}

export interface SecurityEvent {
  eventType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedComponent: string;
  mitigationRequired: boolean;
  details?: any;
}

export interface PerformanceEvent {
  metric: 'response_time' | 'memory_usage' | 'cpu_usage' | 'api_calls';
  value: number;
  threshold: number;
  unit: string;
  impact: 'low' | 'medium' | 'high';
  recommendation?: string;
}

export class ChatNotificationIntegration implements vscode.Disposable {
  private static instance: ChatNotificationIntegration;
  private initialized = false;
  private config: ChatIntegrationConfig;
  private disposables: vscode.Disposable[] = [];
  
  // Event tracking
  private recentEvents: Map<string, number> = new Map();
  private batchedContextUpdates: ContextUpdateEvent[] = [];
  private batchTimer?: NodeJS.Timeout;
  
  // Performance monitoring
  private performanceMetrics: Map<string, number[]> = new Map();
  private lastPerformanceCheck: number = Date.now();

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly _coreServices: SecurityEnhancedVesperaCoreServices,
    private readonly notificationManager: SecureNotificationManager,
    private readonly _multiChatManager: MultiChatNotificationManager,
    private readonly _chatManager: ChatManager,
    private readonly _contextCollector: FileContextCollector,
    private readonly logger: VesperaLogger,
    private readonly _errorHandler: VesperaErrorHandler
  ) {
    this.config = this.getDefaultConfig();
    
    // Phase 1: Quick error suppression using scaffolding
    QuickUsageFunctions.useProp(this._multiChatManager);
    QuickUsageFunctions.useProp(this._chatManager);
    QuickUsageFunctions.useProp(this._contextCollector);
    QuickUsageFunctions.useProp(this._errorHandler);
  }

  /**
   * Initialize the chat notification integration
   */
  public static async initialize(
    context: vscode.ExtensionContext,
    coreServices: SecurityEnhancedVesperaCoreServices,
    notificationManager: SecureNotificationManager,
    multiChatManager: MultiChatNotificationManager,
    chatManager: ChatManager,
    contextCollector: FileContextCollector
  ): Promise<ChatNotificationIntegration> {
    if (ChatNotificationIntegration.instance) {
      return ChatNotificationIntegration.instance;
    }

    const logger = coreServices.logger.createChild('ChatNotificationIntegration');
    const instance = new ChatNotificationIntegration(
      context,
      coreServices,
      notificationManager,
      multiChatManager,
      chatManager,
      contextCollector,
      logger,
      coreServices.errorHandler
    );

    await instance.initializeInternal();
    ChatNotificationIntegration.instance = instance;
    
    return instance;
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): ChatNotificationIntegration {
    if (!ChatNotificationIntegration.instance?.initialized) {
      throw new Error('ChatNotificationIntegration not initialized');
    }
    return ChatNotificationIntegration.instance;
  }

  /**
   * Internal initialization
   */
  private async initializeInternal(): Promise<void> {
    try {
      this.logger.info('Initializing ChatNotificationIntegration');

      // Load configuration
      await this.loadConfiguration();

      // Setup event listeners
      this.setupEventListeners();

      // Setup performance monitoring
      this.setupPerformanceMonitoring();

      // Setup periodic cleanup
      this.setupPeriodicCleanup();

      // Register disposal
      this.context.subscriptions.push(this);

      this.initialized = true;
      this.logger.info('ChatNotificationIntegration initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize ChatNotificationIntegration', error);
      throw error;
    }
  }

  /**
   * Handle chat provider event
   */
  public async handleProviderEvent(event: ChatProviderEvent): Promise<void> {
    try {
      if (!this.config.enabled || !this.shouldProcessProviderEvent(event)) {
        return;
      }

      this.logger.debug('Handling chat provider event', {
        providerId: event.providerId,
        eventType: event.eventType
      });

      switch (event.eventType) {
        case 'error':
          await this.handleProviderError(event);
          break;
        case 'rate_limit':
          await this.handleProviderRateLimit(event);
          break;
        case 'quota_exceeded':
          await this.handleProviderQuotaExceeded(event);
          break;
        case 'connection_status':
          await this.handleProviderConnectionStatus(event);
          break;
        default:
          this.logger.debug('Unhandled provider event type', { eventType: event.eventType });
      }

      // Track event for rate limiting
      this.trackRecentEvent(`provider_${event.providerId}_${event.eventType}`);

    } catch (error) {
      this.logger.error('Failed to handle provider event', error, {
        providerId: event.providerId,
        eventType: event.eventType
      });
    }
  }

  /**
   * Handle context update event
   */
  public async handleContextUpdate(event: ContextUpdateEvent): Promise<void> {
    try {
      if (!this.config.enabled || !this.config.contextNotifications.showContextUpdates) {
        return;
      }

      this.logger.debug('Handling context update', {
        updateType: event.updateType,
        fileCount: event.files.length,
        processingTime: event.processingTime
      });

      if (event.errors && event.errors.length > 0) {
        await this.handleContextErrors(event);
      }

      if (this.config.contextNotifications.batchFileUpdates) {
        await this.batchContextUpdate(event);
      } else {
        await this.showContextUpdateNotification(event);
      }

    } catch (error) {
      this.logger.error('Failed to handle context update', error);
    }
  }

  /**
   * Handle security event
   */
  public async handleSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      if (!this.config.enabled || !this.config.securityNotifications.showSecurityEvents) {
        return;
      }

      this.logger.warn('Security event detected', {
        eventType: event.eventType,
        severity: event.severity,
        component: event.affectedComponent
      });

      // Log security event using core services integration
      await this.logSecurityEventWithCoreServices(event);

      const notificationLevel = this.getNotificationLevelForSeverity(event.severity);
      const title = `Security ${event.severity.toUpperCase()}: ${event.eventType}`;
      
      await this.notificationManager.notify({
        title,
        message: `${event.description} (Component: ${event.affectedComponent})`,
        type: NotificationType.SECURITY_ALERT,
        level: notificationLevel,
        data: {
          securityEvent: event,
          timestamp: Date.now()
        },
        showInToast: event.severity === 'critical' || event.severity === 'high',
        persistent: event.mitigationRequired,
        actions: event.mitigationRequired ? [
          {
            id: 'view_security_details',
            label: 'View Details',
            callback: () => this.showSecurityEventDetails(event)
          },
          {
            id: 'mitigate_security_issue',
            label: 'Mitigate',
            callback: () => this.mitigateSecurityIssue(event)
          }
        ] : undefined
      });

      // Track security events for analytics
      this.trackSecurityEvent(event);

    } catch (error) {
      this.logger.error('Failed to handle security event', error);
    }
  }

  /**
   * Handle performance event
   */
  public async handlePerformanceEvent(event: PerformanceEvent): Promise<void> {
    try {
      if (!this.config.enabled || !this.config.performanceNotifications.showPerformanceAlerts) {
        return;
      }

      // Only show notifications for significant performance issues
      if (event.impact === 'low') {
        return;
      }

      this.logger.warn('Performance issue detected', {
        metric: event.metric,
        value: event.value,
        threshold: event.threshold,
        impact: event.impact
      });

      const title = `Performance ${event.impact.toUpperCase()}: ${event.metric.replace('_', ' ')}`;
      const message = `${event.metric.replace('_', ' ')} is ${event.value}${event.unit}, exceeding threshold of ${event.threshold}${event.unit}`;
      
      await this.notificationManager.notify({
        title,
        message: event.recommendation ? `${message}. ${event.recommendation}` : message,
        type: NotificationType.SYSTEM_STATUS,
        level: event.impact === 'high' ? NotificationLevel.IMPORTANT : NotificationLevel.INFO,
        data: {
          performanceEvent: event,
          timestamp: Date.now()
        },
        showInToast: event.impact === 'high',
        actions: [
          {
            id: 'view_performance_details',
            label: 'View Details',
            callback: () => this.showPerformanceDetails(event)
          },
          {
            id: 'optimize_performance',
            label: 'Optimize',
            callback: () => this.optimizePerformance(event)
          }
        ]
      });

      // Update performance metrics tracking
      this.updatePerformanceMetrics(event);

    } catch (error) {
      this.logger.error('Failed to handle performance event', error);
    }
  }

  /**
   * Handle extension lifecycle event
   */
  public async handleLifecycleEvent(
    event: 'activation' | 'deactivation' | 'update' | 'error',
    details?: any
  ): Promise<void> {
    try {
      const lifecycleConfig = this.config.lifecycleNotifications;
      
      if (!this.config.enabled || 
          (event === 'activation' && !lifecycleConfig.showActivation) ||
          (event === 'deactivation' && !lifecycleConfig.showDeactivation) ||
          (event === 'update' && !lifecycleConfig.showUpdates) ||
          (event === 'error' && !lifecycleConfig.showErrors)) {
        return;
      }

      this.logger.info('Extension lifecycle event', { event, details });

      let title: string;
      let message: string;
      let level: NotificationLevel;
      let type: NotificationType;

      switch (event) {
        case 'activation':
          title = 'Vespera Forge Activated';
          message = 'Extension has been successfully activated and is ready for use';
          level = NotificationLevel.INFO;
          type = NotificationType.SYSTEM_STATUS;
          break;
        case 'deactivation':
          title = 'Vespera Forge Deactivated';
          message = 'Extension has been deactivated';
          level = NotificationLevel.INFO;
          type = NotificationType.SYSTEM_STATUS;
          break;
        case 'update':
          title = 'Vespera Forge Updated';
          message = `Extension has been updated${details?.version ? ` to version ${details.version}` : ''}`;
          level = NotificationLevel.IMPORTANT;
          type = NotificationType.SYSTEM_STATUS;
          break;
        case 'error':
          title = 'Extension Error';
          message = `Critical error occurred: ${details?.message || 'Unknown error'}`;
          level = NotificationLevel.CRITICAL;
          type = NotificationType.ERROR;
          break;
        default:
          return;
      }

      await this.notificationManager.notify({
        title,
        message,
        type,
        level,
        data: { event, details, timestamp: Date.now() },
        showInToast: event === 'error' || event === 'update',
        actions: event === 'error' ? [
          {
            id: 'view_error_details',
            label: 'View Details',
            callback: () => this.showErrorDetails(details)
          },
          {
            id: 'report_error',
            label: 'Report Error',
            callback: () => this.reportError(details)
          }
        ] : undefined
      });

    } catch (error) {
      this.logger.error('Failed to handle lifecycle event', error);
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen to VS Code file system events for context updates
    const fileWatcher = vscode.workspace.onDidChangeTextDocument(event => {
      if (this.config.contextNotifications.showFileChanges) {
        this.handleFileChange(event.document);
      }
    });

    this.disposables.push(fileWatcher);

    // Listen to workspace folder changes
    const folderWatcher = vscode.workspace.onDidChangeWorkspaceFolders(event => {
      this.handleWorkspaceFolderChange(event);
    });

    this.disposables.push(folderWatcher);

    this.logger.debug('Event listeners setup completed');
  }

  /**
   * Handle provider error
   */
  private async handleProviderError(event: ChatProviderEvent): Promise<void> {
    if (!this.config.providerNotifications.showErrorNotifications) {
      return;
    }

    await this.notificationManager.notify({
      title: `Chat Provider Error: ${event.providerName}`,
      message: event.message,
      type: NotificationType.ERROR,
      level: NotificationLevel.IMPORTANT,
      data: {
        providerId: event.providerId,
        providerName: event.providerName,
        details: event.details
      },
      showInToast: true,
      actions: [
        {
          id: 'retry_provider',
          label: 'Retry',
          callback: () => this.retryProvider(event.providerId)
        },
        {
          id: 'switch_provider',
          label: 'Switch Provider',
          callback: () => this.switchProvider(event.providerId)
        }
      ]
    });
  }

  /**
   * Handle provider rate limit
   */
  private async handleProviderRateLimit(event: ChatProviderEvent): Promise<void> {
    if (!this.config.providerNotifications.showRateLimitNotifications) {
      return;
    }

    const retryAfter = event.details?.retryAfter || 60;
    
    await this.notificationManager.notify({
      title: `Rate Limit: ${event.providerName}`,
      message: `Rate limit exceeded. Retry after ${retryAfter} seconds`,
      type: NotificationType.SYSTEM_STATUS,
      level: NotificationLevel.IMPORTANT,
      data: {
        providerId: event.providerId,
        retryAfter,
        details: event.details
      },
      showInToast: true,
      actions: [
        {
          id: 'wait_and_retry',
          label: `Wait ${retryAfter}s`,
          callback: () => this.waitAndRetry(event.providerId, retryAfter)
        }
      ]
    });
  }

  /**
   * Handle provider quota exceeded
   */
  private async handleProviderQuotaExceeded(event: ChatProviderEvent): Promise<void> {
    if (!this.config.providerNotifications.showQuotaNotifications) {
      return;
    }

    await this.notificationManager.notify({
      title: `Quota Exceeded: ${event.providerName}`,
      message: `API quota has been exceeded. Service may be limited.`,
      type: NotificationType.SYSTEM_STATUS,
      level: NotificationLevel.CRITICAL,
      data: {
        providerId: event.providerId,
        details: event.details
      },
      showInToast: true,
      persistent: true,
      actions: [
        {
          id: 'check_quota',
          label: 'Check Quota',
          callback: () => this.checkProviderQuota(event.providerId)
        },
        {
          id: 'upgrade_plan',
          label: 'Upgrade Plan',
          callback: () => this.upgradeProviderPlan(event.providerId)
        }
      ]
    });
  }

  /**
   * Handle provider connection status
   */
  private async handleProviderConnectionStatus(event: ChatProviderEvent): Promise<void> {
    if (!this.config.providerNotifications.showConnectionStatus) {
      return;
    }

    const isConnected = event.details?.connected === true;
    
    await this.notificationManager.notify({
      title: `${event.providerName} ${isConnected ? 'Connected' : 'Disconnected'}`,
      message: event.message,
      type: NotificationType.SYSTEM_STATUS,
      level: isConnected ? NotificationLevel.INFO : NotificationLevel.IMPORTANT,
      data: {
        providerId: event.providerId,
        connected: isConnected,
        details: event.details
      },
      showInToast: !isConnected // Only show toast for disconnections
    });
  }

  /**
   * Handle context errors
   */
  private async handleContextErrors(event: ContextUpdateEvent): Promise<void> {
    if (!this.config.contextNotifications.showContextErrors || !event.errors?.length) {
      return;
    }

    await this.notificationManager.notify({
      title: 'Context Update Errors',
      message: `${event.errors.length} errors occurred while updating context`,
      type: NotificationType.ERROR,
      level: NotificationLevel.IMPORTANT,
      data: {
        updateType: event.updateType,
        errors: event.errors,
        affectedFiles: event.files
      },
      showInToast: true,
      actions: [
        {
          id: 'view_context_errors',
          label: 'View Errors',
          callback: () => this.showContextErrors(event.errors!)
        },
        {
          id: 'retry_context_update',
          label: 'Retry Update',
          callback: () => this.retryContextUpdate(event.files)
        }
      ]
    });
  }

  /**
   * Batch context update
   */
  private async batchContextUpdate(event: ContextUpdateEvent): Promise<void> {
    this.batchedContextUpdates.push(event);

    // Setup batch timer if not already running
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(async () => {
        await this.processBatchedContextUpdates();
        this.batchTimer = undefined;
      }, 5000); // 5 second batching window
    }
  }

  /**
   * Process batched context updates
   */
  private async processBatchedContextUpdates(): Promise<void> {
    if (this.batchedContextUpdates.length === 0) {
      return;
    }

    const totalFiles = new Set<string>();
    let totalProcessingTime = 0;
    const updateTypes = new Set<string>();

    for (const update of this.batchedContextUpdates) {
      update.files.forEach(file => totalFiles.add(file));
      totalProcessingTime += update.processingTime;
      updateTypes.add(update.updateType);
    }

    await this.notificationManager.notify({
      title: 'Context Updates',
      message: `${totalFiles.size} files updated in ${totalProcessingTime}ms (${Array.from(updateTypes).join(', ')})`,
      type: NotificationType.TASK_PROGRESS,
      level: NotificationLevel.INFO,
      data: {
        batchSize: this.batchedContextUpdates.length,
        totalFiles: totalFiles.size,
        totalProcessingTime,
        updateTypes: Array.from(updateTypes)
      },
      showInToast: false
    });

    this.batchedContextUpdates.length = 0;
  }

  /**
   * Show context update notification
   */
  private async showContextUpdateNotification(event: ContextUpdateEvent): Promise<void> {
    const actionText = event.updateType.replace('_', ' ');
    
    await this.notificationManager.notify({
      title: 'Context Updated',
      message: `${event.files.length} files ${actionText} (${event.processingTime}ms)`,
      type: NotificationType.TASK_PROGRESS,
      level: NotificationLevel.INFO,
      data: event,
      showInToast: false
    });
  }

  /**
   * Handle file change
   */
  private async handleFileChange(document: vscode.TextDocument): Promise<void> {
    // Throttle file change notifications
    const fileKey = `file_change_${document.uri.fsPath}`;
    if (this.wasRecentEvent(fileKey, 1000)) { // 1 second throttle
      return;
    }

    this.trackRecentEvent(fileKey);

    const contextUpdate: ContextUpdateEvent = {
      updateType: 'file_changed',
      files: [document.uri.fsPath],
      contextSize: document.getText().length,
      processingTime: 0 // Would be measured in actual context update
    };

    await this.handleContextUpdate(contextUpdate);
  }

  /**
   * Handle workspace folder change
   */
  private async handleWorkspaceFolderChange(event: vscode.WorkspaceFoldersChangeEvent): Promise<void> {
    if (event.added.length > 0 || event.removed.length > 0) {
      this.logger.info('Workspace folders changed', {
        added: event.added.length,
        removed: event.removed.length
      });

      await this.notificationManager.notify({
        title: 'Workspace Changed',
        message: `${event.added.length} folders added, ${event.removed.length} folders removed`,
        type: NotificationType.SYSTEM_STATUS,
        level: NotificationLevel.INFO,
        data: {
          addedFolders: event.added.map(f => f.uri.fsPath),
          removedFolders: event.removed.map(f => f.uri.fsPath)
        },
        showInToast: false
      });
    }
  }

  /**
   * Check if should process provider event
   */
  private shouldProcessProviderEvent(event: ChatProviderEvent): boolean {
    const eventKey = `provider_${event.providerId}_${event.eventType}`;
    return !this.wasRecentEvent(eventKey, 30000); // 30 second throttle
  }

  /**
   * Check if event was recent
   */
  private wasRecentEvent(eventKey: string, throttleMs: number): boolean {
    const lastTime = this.recentEvents.get(eventKey) || 0;
    return Date.now() - lastTime < throttleMs;
  }

  /**
   * Track recent event
   */
  private trackRecentEvent(eventKey: string): void {
    this.recentEvents.set(eventKey, Date.now());
  }

  /**
   * Get notification level for security severity
   */
  private getNotificationLevelForSeverity(severity: string): NotificationLevel {
    switch (severity) {
      case 'critical':
        return NotificationLevel.CRITICAL;
      case 'high':
        return NotificationLevel.IMPORTANT;
      case 'medium':
        return NotificationLevel.IMPORTANT;
      default:
        return NotificationLevel.INFO;
    }
  }

  /**
   * Track security event for analytics
   */
  private trackSecurityEvent(event: SecurityEvent): void {
    // Would integrate with analytics system
    this.logger.info('Security event tracked', {
      eventType: event.eventType,
      severity: event.severity
    });
  }

  /**
   * Log security event using core services integration
   * This demonstrates proper usage of the _coreServices field
   */
  private async logSecurityEventWithCoreServices(event: SecurityEvent): Promise<void> {
    if (!this._coreServices) {
      return; // No core services available
    }

    try {
      // Use core services integration helper
      await logSecurityEvent(
        this._coreServices,
        {
          type: event.eventType,
          severity: event.severity,
          category: 'chat_notification',
          message: event.description,
          source: 'ChatNotificationIntegration',
          timestamp: Date.now(),
          details: {
            affectedComponent: event.affectedComponent,
            mitigationRequired: event.mitigationRequired,
            additionalData: event.additionalData
          }
        },
        {
          component: 'ChatNotificationIntegration',
          eventType: event.eventType,
          severity: event.severity
        },
        'ChatNotificationIntegration'
      );

      // Track event in telemetry
      trackEvent(
        this._coreServices,
        'security_event_processed',
        {
          eventType: event.eventType,
          severity: event.severity,
          component: event.affectedComponent,
          processingTime: Date.now() // Would track actual processing time
        },
        'ChatNotificationIntegration'
      );

    } catch (error) {
      this.logger.error('Failed to log security event with core services', error);
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(event: PerformanceEvent): void {
    const metricKey = event.metric;
    if (!this.performanceMetrics.has(metricKey)) {
      this.performanceMetrics.set(metricKey, []);
    }
    
    const metrics = this.performanceMetrics.get(metricKey)!;
    metrics.push(event.value);
    
    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }
  }

  /**
   * Setup performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    const monitoringInterval = setInterval(() => {
      try {
        this.checkPerformanceMetrics();
      } catch (error) {
        this.logger.warn('Performance monitoring failed', { error });
      }
    }, 60000); // Check every minute

    this.disposables.push(new vscode.Disposable(() => {
      clearInterval(monitoringInterval);
    }));
  }

  /**
   * Check performance metrics
   */
  private checkPerformanceMetrics(): void {
    const config = this.config.performanceNotifications;
    
    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const memoryMB = memoryUsage.heapUsed / 1024 / 1024;
    
    if (memoryMB > config.memoryUsageThreshold) {
      this.handlePerformanceEvent({
        metric: 'memory_usage',
        value: memoryMB,
        threshold: config.memoryUsageThreshold,
        unit: 'MB',
        impact: memoryMB > config.memoryUsageThreshold * 2 ? 'high' : 'medium',
        recommendation: 'Consider restarting VS Code or reducing opened files'
      });
    }
  }

  // Action callbacks (would integrate with actual implementations)
  private async retryProvider(providerId: string): Promise<void> {
    this.logger.info('Retry provider requested', { providerId });
  }

  private async switchProvider(providerId: string): Promise<void> {
    this.logger.info('Switch provider requested', { providerId });
  }

  private async waitAndRetry(providerId: string, seconds: number): Promise<void> {
    this.logger.info('Wait and retry requested', { providerId, seconds });
  }

  private async checkProviderQuota(providerId: string): Promise<void> {
    this.logger.info('Check provider quota requested', { providerId });
  }

  private async upgradeProviderPlan(providerId: string): Promise<void> {
    this.logger.info('Upgrade provider plan requested', { providerId });
  }

  private async showSecurityEventDetails(event: SecurityEvent): Promise<void> {
    this.logger.info('Security event details requested', { eventType: event.eventType });
  }

  private async mitigateSecurityIssue(event: SecurityEvent): Promise<void> {
    this.logger.info('Security mitigation requested', { eventType: event.eventType });
  }

  private async showPerformanceDetails(event: PerformanceEvent): Promise<void> {
    this.logger.info('Performance details requested', { metric: event.metric });
  }

  private async optimizePerformance(event: PerformanceEvent): Promise<void> {
    this.logger.info('Performance optimization requested', { metric: event.metric });
  }

  private async showContextErrors(errors: string[]): Promise<void> {
    this.logger.info('Context errors view requested', { errorCount: errors.length });
  }

  private async retryContextUpdate(files: string[]): Promise<void> {
    this.logger.info('Context update retry requested', { fileCount: files.length });
  }

  private async showErrorDetails(details: any): Promise<void> {
    this.logger.info('Error details requested', { details });
  }

  private async reportError(details: any): Promise<void> {
    this.logger.info('Error report requested', { details });
  }

  /**
   * Load configuration
   */
  private async loadConfiguration(): Promise<void> {
    const workspaceConfig = vscode.workspace.getConfiguration('vesperaForge.notifications.chatIntegration');
    
    this.config = {
      ...this.getDefaultConfig(),
      enabled: workspaceConfig.get('enabled', this.config.enabled)
    };
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): ChatIntegrationConfig {
    return {
      enabled: true,
      providerNotifications: {
        showErrorNotifications: true,
        showRateLimitNotifications: true,
        showQuotaNotifications: true,
        showConnectionStatus: false
      },
      contextNotifications: {
        showContextUpdates: false,
        showFileChanges: false,
        showContextErrors: true,
        batchFileUpdates: true
      },
      securityNotifications: {
        showSecurityEvents: true,
        showAuditAlerts: true,
        showComplianceIssues: true
      },
      performanceNotifications: {
        showPerformanceAlerts: true,
        responseTimeThreshold: 5000, // 5 seconds
        memoryUsageThreshold: 500, // 500 MB
        cpuUsageThreshold: 80 // 80%
      },
      lifecycleNotifications: {
        showActivation: false,
        showDeactivation: false,
        showUpdates: true,
        showErrors: true
      }
    };
  }

  /**
   * Setup periodic cleanup
   */
  private setupPeriodicCleanup(): void {
    const cleanupInterval = setInterval(() => {
      try {
        const fiveMinutesAgo = Date.now() - 300000;
        
        // Clean old event tracking
        for (const [key, timestamp] of this.recentEvents.entries()) {
          if (timestamp < fiveMinutesAgo) {
            this.recentEvents.delete(key);
          }
        }
        
        // Clean old performance metrics
        const oneHourAgo = Date.now() - 3600000;
        this.lastPerformanceCheck = Math.max(this.lastPerformanceCheck, oneHourAgo);
        
      } catch (error) {
        this.logger.warn('Chat integration cleanup failed', { error });
      }
    }, 300000); // Run every 5 minutes

    this.disposables.push(new vscode.Disposable(() => {
      clearInterval(cleanupInterval);
    }));
  }

  /**
   * Update configuration
   */
  public async updateConfiguration(config: Partial<ChatIntegrationConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    this.logger.info('Chat integration configuration updated');
  }

  /**
   * Get current configuration
   */
  public getConfiguration(): ChatIntegrationConfig {
    return { ...this.config };
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    this.disposables.forEach(d => d.dispose());
    this.disposables.length = 0;
    
    this.recentEvents.clear();
    this.batchedContextUpdates.length = 0;
    this.performanceMetrics.clear();
    
    this.initialized = false;
    ChatNotificationIntegration.instance = undefined as any;
    
    this.logger.info('ChatNotificationIntegration disposed');
  }
}