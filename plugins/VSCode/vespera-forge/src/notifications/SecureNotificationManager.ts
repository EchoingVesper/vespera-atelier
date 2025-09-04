/**
 * Secure Notification Manager
 * 
 * Core notification system with OS toast integration, configurable levels,
 * privacy protection, and SecurityEnhancedCoreServices integration.
 */

import * as vscode from 'vscode';
import { VesperaLogger } from '../core/logging/VesperaLogger';
import { VesperaErrorHandler } from '../core/error-handling/VesperaErrorHandler';
import { SecurityEnhancedVesperaCoreServices } from '../core/security/SecurityEnhancedCoreServices';
import { VesperaInputSanitizer } from '../core/security/sanitization/VesperaInputSanitizer';
import { VesperaSecurityAuditLogger } from '../core/security/audit/VesperaSecurityAuditLogger';

export enum NotificationLevel {
  CRITICAL = 'critical',
  IMPORTANT = 'important', 
  INFO = 'info',
  DEBUG = 'debug'
}

export enum NotificationType {
  AGENT_COMPLETION = 'agent_completion',
  TASK_PROGRESS = 'task_progress',
  TASK_SERVER_EVENT = 'task_server_event',
  CHAT_MESSAGE = 'chat_message',
  SECURITY_ALERT = 'security_alert',
  SYSTEM_STATUS = 'system_status',
  ERROR = 'error'
}

export interface NotificationConfig {
  enabled: boolean;
  osToastEnabled: boolean;
  levels: {
    critical: boolean;
    important: boolean;
    info: boolean;
    debug: boolean;
  };
  types: {
    [key in NotificationType]: {
      enabled: boolean;
      level: NotificationLevel;
      showInToast: boolean;
      playSound: boolean;
    };
  };
  privacy: {
    enabled: boolean;
    sanitizeContent: boolean;
    hidePersonalInfo: boolean;
    contentFiltering: boolean;
  };
  quietHours: {
    enabled: boolean;
    startTime: string; // HH:MM format
    endTime: string;   // HH:MM format
    allowCritical: boolean;
  };
  rateLimiting: {
    enabled: boolean;
    maxPerMinute: number;
    batchSimilar: boolean;
  };
}

export interface NotificationRequest {
  id?: string;
  title: string;
  message: string;
  type: NotificationType;
  level: NotificationLevel;
  data?: any;
  actions?: NotificationAction[];
  timeout?: number;
  persistent?: boolean;
  showInToast?: boolean;
  playSound?: boolean;
  source?: string;
}

export interface NotificationAction {
  id: string;
  label: string;
  callback: () => void | Promise<void>;
}

export interface NotificationResult {
  id: string;
  delivered: boolean;
  deliveryMethod: ('vscode' | 'os-toast' | 'console')[];
  filteredByPrivacy: boolean;
  filteredByQuietHours: boolean;
  filteredByRateLimit: boolean;
  sanitizedContent?: {
    originalTitle: string;
    originalMessage: string;
    sanitizedTitle: string;
    sanitizedMessage: string;
  };
  timestamp: number;
}

interface PendingNotification {
  request: NotificationRequest;
  timestamp: number;
  attempts: number;
}

export class SecureNotificationManager implements vscode.Disposable {
  private static instance: SecureNotificationManager;
  private initialized = false;
  private config: NotificationConfig;
  private pendingNotifications: Map<string, PendingNotification> = new Map();
  private recentNotifications: Map<string, number> = new Map(); // For rate limiting
  private disposables: vscode.Disposable[] = [];

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly coreServices: SecurityEnhancedVesperaCoreServices,
    private readonly logger: VesperaLogger,
    private readonly errorHandler: VesperaErrorHandler
  ) {
    this.config = this.getDefaultConfig();
  }

  /**
   * Initialize the notification manager
   */
  public static async initialize(
    context: vscode.ExtensionContext,
    coreServices: SecurityEnhancedVesperaCoreServices
  ): Promise<SecureNotificationManager> {
    if (SecureNotificationManager.instance) {
      return SecureNotificationManager.instance;
    }

    const logger = coreServices.logger.createChild('NotificationManager');
    const instance = new SecureNotificationManager(
      context,
      coreServices,
      logger,
      coreServices.errorHandler
    );

    await instance.initializeInternal();
    SecureNotificationManager.instance = instance;
    
    return instance;
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): SecureNotificationManager {
    if (!SecureNotificationManager.instance?.initialized) {
      throw new Error('SecureNotificationManager not initialized');
    }
    return SecureNotificationManager.instance;
  }

  /**
   * Internal initialization
   */
  private async initializeInternal(): Promise<void> {
    try {
      this.logger.info('Initializing SecureNotificationManager');

      // Load configuration
      await this.loadConfiguration();

      // Setup periodic cleanup
      this.setupPeriodicCleanup();

      // Register disposal
      this.context.subscriptions.push(this);

      this.initialized = true;
      this.logger.info('SecureNotificationManager initialized successfully');

      // Log initialization event for security audit
      await this.coreServices.securityAuditLogger.logSecurityEvent(
        'security_breach' as any, // Using as generic event
        {
          timestamp: Date.now(),
          metadata: { 
            action: 'notification_manager_initialized',
            osToastEnabled: this.config.osToastEnabled,
            privacyEnabled: this.config.privacy.enabled
          }
        }
      );

    } catch (error) {
      this.logger.error('Failed to initialize SecureNotificationManager', error);
      throw error;
    }
  }

  /**
   * Send notification with comprehensive security and privacy controls
   */
  public async notify(request: NotificationRequest): Promise<NotificationResult> {
    try {
      const notificationId = request.id || `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const startTime = Date.now();

      this.logger.debug('Processing notification request', {
        id: notificationId,
        type: request.type,
        level: request.level,
        title: this.sanitizeForLogging(request.title)
      });

      // Check if notifications are enabled
      if (!this.config.enabled) {
        this.logger.debug('Notifications disabled', { id: notificationId });
        return this.createResult(notificationId, false, [], false, false, false, startTime);
      }

      // Check level filtering
      if (!this.config.levels[request.level]) {
        this.logger.debug('Notification level disabled', { 
          id: notificationId, 
          level: request.level 
        });
        return this.createResult(notificationId, false, [], false, false, false, startTime);
      }

      // Check type filtering
      const typeConfig = this.config.types[request.type];
      if (!typeConfig?.enabled) {
        this.logger.debug('Notification type disabled', { 
          id: notificationId, 
          type: request.type 
        });
        return this.createResult(notificationId, false, [], false, false, false, startTime);
      }

      // Check quiet hours
      const quietHoursFiltered = this.isInQuietHours(request.level);
      if (quietHoursFiltered) {
        this.logger.debug('Notification filtered by quiet hours', { id: notificationId });
        return this.createResult(notificationId, false, [], false, true, false, startTime);
      }

      // Check rate limiting
      const rateLimitFiltered = this.isRateLimited(request);
      if (rateLimitFiltered) {
        this.logger.debug('Notification rate limited', { id: notificationId });
        return this.createResult(notificationId, false, [], false, false, true, startTime);
      }

      // Apply privacy filtering and sanitization
      const { filteredRequest, privacyFiltered, sanitizedContent } = await this.applyPrivacyFiltering(request);

      // Determine delivery methods
      const deliveryMethods: ('vscode' | 'os-toast' | 'console')[] = [];

      // Always try VS Code notification as primary method
      let vscodeDelivered = false;
      try {
        await this.showVSCodeNotification(filteredRequest);
        deliveryMethods.push('vscode');
        vscodeDelivered = true;
      } catch (error) {
        this.logger.warn('Failed to show VS Code notification', error, { id: notificationId });
      }

      // OS toast notification if enabled and appropriate
      if (this.config.osToastEnabled && 
          (filteredRequest.showInToast ?? typeConfig.showInToast) &&
          this.shouldShowOSToast(request.level, request.type)) {
        try {
          await this.showOSToastNotification(filteredRequest);
          deliveryMethods.push('os-toast');
        } catch (error) {
          this.logger.warn('Failed to show OS toast notification', error, { id: notificationId });
        }
      }

      // Console fallback for critical messages
      if (request.level === NotificationLevel.CRITICAL && deliveryMethods.length === 0) {
        console.error(`CRITICAL: ${filteredRequest.title} - ${filteredRequest.message}`);
        deliveryMethods.push('console');
      }

      // Update rate limiting tracker
      this.updateRateLimitTracker(request);

      // Log successful notification for audit
      if (deliveryMethods.length > 0) {
        await this.logNotificationEvent(notificationId, request, deliveryMethods);
      }

      const result = this.createResult(
        notificationId, 
        deliveryMethods.length > 0, 
        deliveryMethods, 
        privacyFiltered, 
        false, 
        false, 
        startTime,
        sanitizedContent
      );

      this.logger.debug('Notification processed', {
        id: notificationId,
        delivered: result.delivered,
        methods: deliveryMethods,
        processingTime: Date.now() - startTime
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to process notification', error, {
        type: request.type,
        level: request.level
      });
      
      await this.errorHandler.handleError(error as Error);
      
      // Return failure result
      return this.createResult(
        request.id || 'unknown',
        false,
        [],
        false,
        false,
        false,
        Date.now()
      );
    }
  }

  /**
   * Show critical system notification with override capabilities
   */
  public async notifyCritical(
    title: string,
    message: string,
    actions?: NotificationAction[]
  ): Promise<NotificationResult> {
    return this.notify({
      title,
      message,
      type: NotificationType.SYSTEM_STATUS,
      level: NotificationLevel.CRITICAL,
      actions,
      showInToast: true,
      playSound: true,
      persistent: true
    });
  }

  /**
   * Update notification configuration
   */
  public async updateConfiguration(config: Partial<NotificationConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    await this.saveConfiguration();
    
    this.logger.info('Notification configuration updated', {
      enabled: this.config.enabled,
      osToastEnabled: this.config.osToastEnabled,
      privacyEnabled: this.config.privacy.enabled
    });
  }

  /**
   * Get current configuration
   */
  public getConfiguration(): NotificationConfig {
    return { ...this.config };
  }

  /**
   * Check if in quiet hours
   */
  private isInQuietHours(level: NotificationLevel): boolean {
    if (!this.config.quietHours.enabled) {
      return false;
    }

    if (level === NotificationLevel.CRITICAL && this.config.quietHours.allowCritical) {
      return false;
    }

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const start = this.config.quietHours.startTime;
    const end = this.config.quietHours.endTime;
    
    if (start <= end) {
      return currentTime >= start && currentTime <= end;
    } else {
      // Overnight quiet hours (e.g., 22:00 to 08:00)
      return currentTime >= start || currentTime <= end;
    }
  }

  /**
   * Check if notification is rate limited
   */
  private isRateLimited(request: NotificationRequest): boolean {
    if (!this.config.rateLimiting.enabled) {
      return false;
    }

    const key = `${request.type}_${this.sanitizeForLogging(request.title)}`;
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window

    // Clean old entries
    for (const [existingKey, timestamp] of this.recentNotifications.entries()) {
      if (timestamp < windowStart) {
        this.recentNotifications.delete(existingKey);
      }
    }

    // Count recent notifications of this type
    let recentCount = 0;
    const pattern = new RegExp(`^${request.type}_`);
    for (const [existingKey, timestamp] of this.recentNotifications.entries()) {
      if (pattern.test(existingKey) && timestamp >= windowStart) {
        recentCount++;
      }
    }

    return recentCount >= this.config.rateLimiting.maxPerMinute;
  }

  /**
   * Update rate limit tracking
   */
  private updateRateLimitTracker(request: NotificationRequest): void {
    if (this.config.rateLimiting.enabled) {
      const key = `${request.type}_${this.sanitizeForLogging(request.title)}`;
      this.recentNotifications.set(key, Date.now());
    }
  }

  /**
   * Apply privacy filtering and sanitization
   */
  private async applyPrivacyFiltering(request: NotificationRequest): Promise<{
    filteredRequest: NotificationRequest;
    privacyFiltered: boolean;
    sanitizedContent?: {
      originalTitle: string;
      originalMessage: string;
      sanitizedTitle: string;
      sanitizedMessage: string;
    };
  }> {
    if (!this.config.privacy.enabled) {
      return { filteredRequest: request, privacyFiltered: false };
    }

    let filteredRequest = { ...request };
    let privacyFiltered = false;
    let sanitizedContent: any = undefined;

    // Content sanitization using security services
    if (this.config.privacy.sanitizeContent && this.coreServices.inputSanitizer) {
      try {
        const titleResult = await this.coreServices.inputSanitizer.sanitize(
          request.title,
          'user_input' as any
        );
        const messageResult = await this.coreServices.inputSanitizer.sanitize(
          request.message,
          'user_input' as any
        );

        if (titleResult.sanitized !== request.title || messageResult.sanitized !== request.message) {
          sanitizedContent = {
            originalTitle: request.title,
            originalMessage: request.message,
            sanitizedTitle: titleResult.sanitized,
            sanitizedMessage: messageResult.sanitized
          };

          filteredRequest.title = titleResult.sanitized;
          filteredRequest.message = messageResult.sanitized;
          privacyFiltered = true;
        }
      } catch (error) {
        this.logger.warn('Failed to sanitize notification content', error);
      }
    }

    // Hide personal information
    if (this.config.privacy.hidePersonalInfo) {
      filteredRequest.title = this.hidePersonalInfo(filteredRequest.title);
      filteredRequest.message = this.hidePersonalInfo(filteredRequest.message);
      privacyFiltered = true;
    }

    return { filteredRequest, privacyFiltered, sanitizedContent };
  }

  /**
   * Hide personal information patterns
   */
  private hidePersonalInfo(text: string): string {
    return text
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
      .replace(/\b\d{3}-\d{3}-\d{4}\b/g, '[PHONE]')
      .replace(/\b(?:https?:\/\/)?(?:www\.)?[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?:\/\S*)?\b/g, '[URL]')
      .replace(/\b[A-Z]{2,}\d{2,}\b/g, '[ID]');
  }

  /**
   * Show VS Code notification
   */
  private async showVSCodeNotification(request: NotificationRequest): Promise<void> {
    const options: vscode.MessageOptions = {
      modal: request.persistent || request.level === NotificationLevel.CRITICAL
    };

    let showMethod: any;
    switch (request.level) {
      case NotificationLevel.CRITICAL:
        showMethod = vscode.window.showErrorMessage;
        break;
      case NotificationLevel.IMPORTANT:
        showMethod = vscode.window.showWarningMessage;
        break;
      default:
        showMethod = vscode.window.showInformationMessage;
        break;
    }

    const actionLabels = request.actions?.map(a => a.label) || [];
    const result = await showMethod(`${request.title}: ${request.message}`, options, ...actionLabels);

    // Handle action selection
    if (result && request.actions) {
      const action = request.actions.find(a => a.label === result);
      if (action) {
        try {
          await action.callback();
        } catch (error) {
          this.logger.error('Notification action failed', error);
        }
      }
    }
  }

  /**
   * Show OS toast notification
   */
  private async showOSToastNotification(request: NotificationRequest): Promise<void> {
    // VS Code doesn't have direct OS toast API, but we can use system notifications
    // This would typically integrate with native notification systems per platform
    // For now, we'll use VS Code's notification system with enhanced styling
    
    const platform = process.platform;
    const message = `${request.title}\n${request.message}`;

    try {
      // Cross-platform notification approach
      if (platform === 'win32') {
        await this.showWindowsToast(request.title, request.message);
      } else if (platform === 'darwin') {
        await this.showMacOSNotification(request.title, request.message);
      } else if (platform === 'linux') {
        await this.showLinuxNotification(request.title, request.message);
      } else {
        // Fallback to VS Code notification with toast-like behavior
        await this.showVSCodeToastFallback(request);
      }
    } catch (error) {
      this.logger.warn('OS toast notification failed, using VS Code fallback', error);
      await this.showVSCodeToastFallback(request);
    }
  }

  /**
   * Windows toast notification
   */
  private async showWindowsToast(title: string, message: string): Promise<void> {
    // Would integrate with Windows Toast Notification API
    // For security, we'll log this for now and use VS Code as fallback
    this.logger.debug('Windows toast notification requested', { title, message });
  }

  /**
   * macOS notification
   */
  private async showMacOSNotification(title: string, message: string): Promise<void> {
    // Would integrate with macOS Notification Center
    this.logger.debug('macOS notification requested', { title, message });
  }

  /**
   * Linux notification
   */
  private async showLinuxNotification(title: string, message: string): Promise<void> {
    // Would integrate with libnotify or desktop-notify
    this.logger.debug('Linux notification requested', { title, message });
  }

  /**
   * VS Code toast-style fallback
   */
  private async showVSCodeToastFallback(request: NotificationRequest): Promise<void> {
    // Use status bar message for less intrusive toast-like behavior
    const message = `${request.title}: ${request.message}`;
    vscode.window.setStatusBarMessage(message, request.timeout || 5000);
  }

  /**
   * Determine if OS toast should be shown
   */
  private shouldShowOSToast(level: NotificationLevel, type: NotificationType): boolean {
    // Show OS toast for important notifications and specific types
    return level === NotificationLevel.CRITICAL || 
           level === NotificationLevel.IMPORTANT ||
           type === NotificationType.AGENT_COMPLETION ||
           type === NotificationType.SECURITY_ALERT;
  }

  /**
   * Log notification event for audit
   */
  private async logNotificationEvent(
    id: string,
    request: NotificationRequest,
    deliveryMethods: string[]
  ): Promise<void> {
    try {
      await this.coreServices.securityAuditLogger.logSecurityEvent(
        'security_breach' as any, // Using as generic event
        {
          timestamp: Date.now(),
          metadata: {
            action: 'notification_delivered',
            notificationId: id,
            type: request.type,
            level: request.level,
            deliveryMethods,
            title: this.sanitizeForLogging(request.title)
          }
        }
      );
    } catch (error) {
      this.logger.warn('Failed to log notification event', error);
    }
  }

  /**
   * Sanitize content for logging
   */
  private sanitizeForLogging(content: string): string {
    return content.substring(0, 100) + (content.length > 100 ? '...' : '');
  }

  /**
   * Create notification result
   */
  private createResult(
    id: string,
    delivered: boolean,
    deliveryMethods: ('vscode' | 'os-toast' | 'console')[],
    privacyFiltered: boolean,
    quietHoursFiltered: boolean,
    rateLimitFiltered: boolean,
    timestamp: number,
    sanitizedContent?: any
  ): NotificationResult {
    return {
      id,
      delivered,
      deliveryMethod: deliveryMethods,
      filteredByPrivacy: privacyFiltered,
      filteredByQuietHours: quietHoursFiltered,
      filteredByRateLimit: rateLimitFiltered,
      sanitizedContent,
      timestamp
    };
  }

  /**
   * Load configuration from extension settings
   */
  private async loadConfiguration(): Promise<void> {
    const workspaceConfig = vscode.workspace.getConfiguration('vesperaForge.notifications');
    
    // Merge with defaults
    this.config = {
      ...this.getDefaultConfig(),
      enabled: workspaceConfig.get('enabled', this.config.enabled),
      osToastEnabled: workspaceConfig.get('osToastEnabled', this.config.osToastEnabled),
      levels: {
        ...this.config.levels,
        ...workspaceConfig.get('levels', {})
      },
      privacy: {
        ...this.config.privacy,
        ...workspaceConfig.get('privacy', {})
      },
      quietHours: {
        ...this.config.quietHours,
        ...workspaceConfig.get('quietHours', {})
      },
      rateLimiting: {
        ...this.config.rateLimiting,
        ...workspaceConfig.get('rateLimiting', {})
      }
    };

    this.logger.debug('Notification configuration loaded', {
      enabled: this.config.enabled,
      osToastEnabled: this.config.osToastEnabled,
      privacyEnabled: this.config.privacy.enabled
    });
  }

  /**
   * Save configuration to extension settings
   */
  private async saveConfiguration(): Promise<void> {
    const workspaceConfig = vscode.workspace.getConfiguration('vesperaForge.notifications');
    
    await workspaceConfig.update('enabled', this.config.enabled, true);
    await workspaceConfig.update('osToastEnabled', this.config.osToastEnabled, true);
    await workspaceConfig.update('levels', this.config.levels, true);
    await workspaceConfig.update('privacy', this.config.privacy, true);
    await workspaceConfig.update('quietHours', this.config.quietHours, true);
    await workspaceConfig.update('rateLimiting', this.config.rateLimiting, true);
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): NotificationConfig {
    return {
      enabled: true,
      osToastEnabled: true,
      levels: {
        critical: true,
        important: true,
        info: true,
        debug: false
      },
      types: {
        [NotificationType.AGENT_COMPLETION]: {
          enabled: true,
          level: NotificationLevel.IMPORTANT,
          showInToast: true,
          playSound: false
        },
        [NotificationType.TASK_PROGRESS]: {
          enabled: true,
          level: NotificationLevel.INFO,
          showInToast: false,
          playSound: false
        },
        [NotificationType.TASK_SERVER_EVENT]: {
          enabled: true,
          level: NotificationLevel.INFO,
          showInToast: true,
          playSound: false
        },
        [NotificationType.CHAT_MESSAGE]: {
          enabled: true,
          level: NotificationLevel.INFO,
          showInToast: true,
          playSound: false
        },
        [NotificationType.SECURITY_ALERT]: {
          enabled: true,
          level: NotificationLevel.CRITICAL,
          showInToast: true,
          playSound: true
        },
        [NotificationType.SYSTEM_STATUS]: {
          enabled: true,
          level: NotificationLevel.IMPORTANT,
          showInToast: true,
          playSound: false
        },
        [NotificationType.ERROR]: {
          enabled: true,
          level: NotificationLevel.IMPORTANT,
          showInToast: true,
          playSound: false
        }
      },
      privacy: {
        enabled: true,
        sanitizeContent: true,
        hidePersonalInfo: true,
        contentFiltering: true
      },
      quietHours: {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00',
        allowCritical: true
      },
      rateLimiting: {
        enabled: true,
        maxPerMinute: 10,
        batchSimilar: true
      }
    };
  }

  /**
   * Setup periodic cleanup of tracking data
   */
  private setupPeriodicCleanup(): void {
    const cleanupInterval = setInterval(() => {
      try {
        const now = Date.now();
        const fiveMinutesAgo = now - 300000;

        // Clean old rate limiting entries
        for (const [key, timestamp] of this.recentNotifications.entries()) {
          if (timestamp < fiveMinutesAgo) {
            this.recentNotifications.delete(key);
          }
        }

        // Clean old pending notifications
        for (const [key, pending] of this.pendingNotifications.entries()) {
          if (pending.timestamp < fiveMinutesAgo) {
            this.pendingNotifications.delete(key);
          }
        }

      } catch (error) {
        this.logger.warn('Notification cleanup failed', error);
      }
    }, 60000); // Run every minute

    this.disposables.push(new vscode.Disposable(() => {
      clearInterval(cleanupInterval);
    }));
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables.length = 0;
    
    this.pendingNotifications.clear();
    this.recentNotifications.clear();
    
    this.initialized = false;
    SecureNotificationManager.instance = undefined as any;
    
    this.logger.info('SecureNotificationManager disposed');
  }
}