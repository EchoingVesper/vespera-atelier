/**
 * Notification Configuration Manager
 * 
 * Centralized configuration management for all notification systems with
 * user preferences, per-server settings, quiet hours, and smart batching.
 */

import * as vscode from 'vscode';
import { VesperaLogger } from '../core/logging/VesperaLogger';
import { VesperaErrorHandler } from '../core/error-handling/VesperaErrorHandler';
import { SecurityEnhancedVesperaCoreServices } from '../core/security/SecurityEnhancedCoreServices';
import { 
  NotificationConfig,
  NotificationLevel,
  NotificationType
} from './SecureNotificationManager';

export interface GlobalNotificationConfig extends NotificationConfig {
  // Global overrides
  masterEnabled: boolean;
  emergencyOverride: boolean;
  developmentMode: boolean;
  
  // Advanced features
  contextualAdaptation: {
    enabled: boolean;
    workingHoursOnly: boolean;
    focusModeIntegration: boolean;
    adaptToPresence: boolean;
  };
  
  // Smart features
  intelligentBatching: {
    enabled: boolean;
    similarEventWindow: number; // milliseconds
    maxBatchSize: number;
    urgencyBreaksThrough: boolean;
  };
  
  // Accessibility
  accessibility: {
    highContrast: boolean;
    reducedMotion: boolean;
    screenReaderFriendly: boolean;
    audioDescriptions: boolean;
  };
}

export interface ServerSpecificConfig {
  serverId: string;
  serverName: string;
  enabled: boolean;
  overrides: {
    notificationLevel: NotificationLevel;
    showInToast: boolean;
    playSound: boolean;
    quietHoursOverride: boolean;
  };
  channelOverrides: {
    [channelId: string]: {
      enabled: boolean;
      level: NotificationLevel;
      keywords: string[];
    };
  };
  userOverrides: {
    [userId: string]: {
      enabled: boolean;
      level: NotificationLevel;
      dmEnabled: boolean;
    };
  };
}

export interface UserPreferences {
  userId: string;
  preferences: {
    defaultNotificationLevel: NotificationLevel;
    preferredDeliveryMethod: 'vscode' | 'os-toast' | 'both';
    workingHours: {
      enabled: boolean;
      startTime: string;
      endTime: string;
      timezone: string;
    };
    focusMode: {
      enabled: boolean;
      allowCritical: boolean;
      allowMentions: boolean;
      customKeywords: string[];
    };
    deviceSpecific: {
      desktop: Partial<NotificationConfig>;
      mobile: Partial<NotificationConfig>;
    };
  };
}

export interface NotificationProfile {
  id: string;
  name: string;
  description: string;
  config: Partial<GlobalNotificationConfig>;
  conditions: ProfileCondition[];
  priority: number;
  isDefault: boolean;
}

export interface ProfileCondition {
  type: 'time' | 'presence' | 'workload' | 'location' | 'custom';
  parameters: Record<string, any>;
  enabled: boolean;
}

export interface NotificationAnalytics {
  totalNotificationsSent: number;
  notificationsByType: Record<NotificationType, number>;
  notificationsByLevel: Record<NotificationLevel, number>;
  dismissalRate: number;
  actionClickRate: number;
  quietHoursActivations: number;
  profileSwitches: number;
  userSatisfactionScore: number;
  performanceMetrics: {
    averageDeliveryTime: number;
    successRate: number;
    errorRate: number;
  };
}

export class NotificationConfigManager implements vscode.Disposable {
  private static instance: NotificationConfigManager;
  private initialized = false;
  private globalConfig: GlobalNotificationConfig;
  private serverConfigs: Map<string, ServerSpecificConfig> = new Map();
  private userPreferences: UserPreferences;
  private notificationProfiles: Map<string, NotificationProfile> = new Map();
  private activeProfileId: string = 'default';
  private analytics: NotificationAnalytics;
  private disposables: vscode.Disposable[] = [];
  private configChangeListeners: Set<(config: GlobalNotificationConfig) => void> = new Set();

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly coreServices: SecurityEnhancedVesperaCoreServices,
    private readonly logger: VesperaLogger,
    private readonly errorHandler: VesperaErrorHandler
  ) {
    this.globalConfig = this.getDefaultGlobalConfig();
    this.userPreferences = this.getDefaultUserPreferences();
    this.analytics = this.getDefaultAnalytics();
  }

  /**
   * Initialize the notification configuration manager
   */
  public static async initialize(
    context: vscode.ExtensionContext,
    coreServices: SecurityEnhancedVesperaCoreServices
  ): Promise<NotificationConfigManager> {
    if (NotificationConfigManager.instance) {
      return NotificationConfigManager.instance;
    }

    const logger = coreServices.logger.createChild('NotificationConfigManager');
    const instance = new NotificationConfigManager(
      context,
      coreServices,
      logger,
      coreServices.errorHandler
    );

    await instance.initializeInternal();
    NotificationConfigManager.instance = instance;
    
    return instance;
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): NotificationConfigManager {
    if (!NotificationConfigManager.instance?.initialized) {
      throw new Error('NotificationConfigManager not initialized');
    }
    return NotificationConfigManager.instance;
  }

  /**
   * Internal initialization
   */
  private async initializeInternal(): Promise<void> {
    try {
      this.logger.info('Initializing NotificationConfigManager');

      // Load all configurations
      await this.loadAllConfigurations();

      // Initialize default profiles
      this.initializeDefaultProfiles();

      // Setup configuration change watchers
      this.setupConfigurationWatchers();

      // Setup periodic analytics collection
      this.setupAnalyticsCollection();

      // Register disposal
      this.context.subscriptions.push(this);

      this.initialized = true;
      this.logger.info('NotificationConfigManager initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize NotificationConfigManager', error);
      throw error;
    }
  }

  /**
   * Get merged notification configuration
   */
  public getEffectiveConfig(): GlobalNotificationConfig {
    // Start with global config
    let effectiveConfig = { ...this.globalConfig };

    // Apply active profile if any
    const activeProfile = this.notificationProfiles.get(this.activeProfileId);
    if (activeProfile) {
      effectiveConfig = this.mergeConfigs(effectiveConfig, activeProfile.config);
    }

    // Apply contextual adaptations
    if (effectiveConfig.contextualAdaptation.enabled) {
      effectiveConfig = this.applyContextualAdaptations(effectiveConfig);
    }

    return effectiveConfig;
  }

  /**
   * Get server-specific configuration
   */
  public getServerConfig(serverId: string): ServerSpecificConfig | undefined {
    return this.serverConfigs.get(serverId);
  }

  /**
   * Get user preferences
   */
  public getUserPreferences(): UserPreferences {
    return { ...this.userPreferences };
  }

  /**
   * Update global configuration
   */
  public async updateGlobalConfig(
    updates: Partial<GlobalNotificationConfig>
  ): Promise<void> {
    try {
      const previousConfig = { ...this.globalConfig };
      this.globalConfig = { ...this.globalConfig, ...updates };

      // Validate configuration
      this.validateConfiguration(this.globalConfig);

      // Save to storage
      await this.saveGlobalConfiguration();

      // Notify listeners
      this.notifyConfigurationChange(this.globalConfig);

      // Track configuration change
      await this.trackConfigurationChange('global', previousConfig, this.globalConfig);

      this.logger.info('Global notification configuration updated', {
        masterEnabled: this.globalConfig.masterEnabled,
        emergencyOverride: this.globalConfig.emergencyOverride
      });

    } catch (error) {
      this.logger.error('Failed to update global configuration', error);
      await this.errorHandler.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Update server-specific configuration
   */
  public async updateServerConfig(
    serverId: string,
    updates: Partial<ServerSpecificConfig>
  ): Promise<void> {
    try {
      const existingConfig = this.serverConfigs.get(serverId) || this.getDefaultServerConfig(serverId);
      const newConfig = { ...existingConfig, ...updates };

      this.serverConfigs.set(serverId, newConfig);
      await this.saveServerConfiguration(serverId, newConfig);

      this.logger.info('Server notification configuration updated', {
        serverId,
        enabled: newConfig.enabled,
        overrideLevel: newConfig.overrides.notificationLevel
      });

    } catch (error) {
      this.logger.error('Failed to update server configuration', error, { serverId });
      await this.errorHandler.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Update user preferences
   */
  public async updateUserPreferences(
    updates: Partial<UserPreferences['preferences']>
  ): Promise<void> {
    try {
      this.userPreferences.preferences = { 
        ...this.userPreferences.preferences, 
        ...updates 
      };

      await this.saveUserPreferences();

      this.logger.info('User preferences updated', {
        userId: this.userPreferences.userId,
        defaultLevel: this.userPreferences.preferences.defaultNotificationLevel,
        workingHoursEnabled: this.userPreferences.preferences.workingHours.enabled
      });

    } catch (error) {
      this.logger.error('Failed to update user preferences', error);
      throw error;
    }
  }

  /**
   * Create notification profile
   */
  public async createProfile(profile: Omit<NotificationProfile, 'id'>): Promise<string> {
    const profileId = `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullProfile: NotificationProfile = {
      id: profileId,
      ...profile
    };

    this.notificationProfiles.set(profileId, fullProfile);
    await this.saveNotificationProfiles();

    this.logger.info('Notification profile created', {
      profileId,
      name: profile.name,
      isDefault: profile.isDefault
    });

    return profileId;
  }

  /**
   * Activate notification profile
   */
  public async activateProfile(profileId: string): Promise<void> {
    const profile = this.notificationProfiles.get(profileId);
    if (!profile) {
      throw new Error(`Notification profile not found: ${profileId}`);
    }

    // Check profile conditions
    if (!this.evaluateProfileConditions(profile)) {
      this.logger.warn('Profile conditions not met for activation', { profileId });
      return;
    }

    const previousProfileId = this.activeProfileId;
    this.activeProfileId = profileId;

    // Save active profile
    await this.context.globalState.update('activeNotificationProfile', profileId);

    // Update analytics
    this.analytics.profileSwitches++;

    this.logger.info('Notification profile activated', {
      profileId,
      profileName: profile.name,
      previousProfileId
    });

    // Notify configuration change
    this.notifyConfigurationChange(this.getEffectiveConfig());
  }

  /**
   * Get all notification profiles
   */
  public getProfiles(): NotificationProfile[] {
    return Array.from(this.notificationProfiles.values());
  }

  /**
   * Get active profile
   */
  public getActiveProfile(): NotificationProfile | undefined {
    return this.notificationProfiles.get(this.activeProfileId);
  }

  /**
   * Enable quiet hours
   */
  public async enableQuietHours(
    startTime: string,
    endTime: string,
    allowCritical = true
  ): Promise<void> {
    await this.updateGlobalConfig({
      quietHours: {
        enabled: true,
        startTime,
        endTime,
        allowCritical
      }
    });

    this.analytics.quietHoursActivations++;
    
    this.logger.info('Quiet hours enabled', { startTime, endTime, allowCritical });
  }

  /**
   * Disable quiet hours
   */
  public async disableQuietHours(): Promise<void> {
    await this.updateGlobalConfig({
      quietHours: {
        ...this.globalConfig.quietHours,
        enabled: false
      }
    });

    this.logger.info('Quiet hours disabled');
  }

  /**
   * Check if currently in quiet hours
   */
  public isInQuietHours(): boolean {
    const config = this.getEffectiveConfig();
    if (!config.quietHours.enabled) {
      return false;
    }

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const start = config.quietHours.startTime;
    const end = config.quietHours.endTime;
    
    if (start <= end) {
      return currentTime >= start && currentTime <= end;
    } else {
      // Overnight quiet hours (e.g., 22:00 to 08:00)
      return currentTime >= start || currentTime <= end;
    }
  }

  /**
   * Enable emergency override
   */
  public async enableEmergencyOverride(duration?: number): Promise<void> {
    await this.updateGlobalConfig({
      emergencyOverride: true
    });

    // Auto-disable after duration if specified
    if (duration) {
      setTimeout(async () => {
        await this.updateGlobalConfig({
          emergencyOverride: false
        });
      }, duration);
    }

    this.logger.warn('Emergency override enabled', { duration });
  }

  /**
   * Disable emergency override
   */
  public async disableEmergencyOverride(): Promise<void> {
    await this.updateGlobalConfig({
      emergencyOverride: false
    });

    this.logger.info('Emergency override disabled');
  }

  /**
   * Get notification analytics
   */
  public getAnalytics(): NotificationAnalytics {
    return { ...this.analytics };
  }

  /**
   * Reset analytics
   */
  public async resetAnalytics(): Promise<void> {
    this.analytics = this.getDefaultAnalytics();
    await this.context.globalState.update('notificationAnalytics', this.analytics);
    
    this.logger.info('Notification analytics reset');
  }

  /**
   * Track notification event for analytics
   */
  public trackNotificationEvent(
    type: NotificationType,
    level: NotificationLevel,
    delivered: boolean,
    dismissed: boolean = false,
    actionClicked: boolean = false,
    deliveryTime: number = 0
  ): void {
    this.analytics.totalNotificationsSent++;
    this.analytics.notificationsByType[type] = (this.analytics.notificationsByType[type] || 0) + 1;
    this.analytics.notificationsByLevel[level] = (this.analytics.notificationsByLevel[level] || 0) + 1;

    if (dismissed) {
      this.analytics.dismissalRate = 
        (this.analytics.dismissalRate * (this.analytics.totalNotificationsSent - 1) + 1) / 
        this.analytics.totalNotificationsSent;
    }

    if (actionClicked) {
      this.analytics.actionClickRate = 
        (this.analytics.actionClickRate * (this.analytics.totalNotificationsSent - 1) + 1) / 
        this.analytics.totalNotificationsSent;
    }

    if (delivered) {
      const oldAvg = this.analytics.performanceMetrics.averageDeliveryTime;
      const count = this.analytics.totalNotificationsSent;
      this.analytics.performanceMetrics.averageDeliveryTime = 
        (oldAvg * (count - 1) + deliveryTime) / count;
    }

    // Periodically save analytics
    if (this.analytics.totalNotificationsSent % 10 === 0) {
      this.saveAnalytics();
    }
  }

  /**
   * Add configuration change listener
   */
  public onConfigurationChange(
    listener: (config: GlobalNotificationConfig) => void
  ): vscode.Disposable {
    this.configChangeListeners.add(listener);
    
    return new vscode.Disposable(() => {
      this.configChangeListeners.delete(listener);
    });
  }

  /**
   * Export configuration for backup
   */
  public exportConfiguration(): {
    global: GlobalNotificationConfig;
    servers: Record<string, ServerSpecificConfig>;
    user: UserPreferences;
    profiles: NotificationProfile[];
    analytics: NotificationAnalytics;
  } {
    return {
      global: this.globalConfig,
      servers: Object.fromEntries(this.serverConfigs.entries()),
      user: this.userPreferences,
      profiles: Array.from(this.notificationProfiles.values()),
      analytics: this.analytics
    };
  }

  /**
   * Import configuration from backup
   */
  public async importConfiguration(config: {
    global?: GlobalNotificationConfig;
    servers?: Record<string, ServerSpecificConfig>;
    user?: UserPreferences;
    profiles?: NotificationProfile[];
    analytics?: NotificationAnalytics;
  }): Promise<void> {
    try {
      if (config.global) {
        this.validateConfiguration(config.global);
        this.globalConfig = config.global;
        await this.saveGlobalConfiguration();
      }

      if (config.servers) {
        this.serverConfigs.clear();
        for (const [serverId, serverConfig] of Object.entries(config.servers)) {
          this.serverConfigs.set(serverId, serverConfig);
          await this.saveServerConfiguration(serverId, serverConfig);
        }
      }

      if (config.user) {
        this.userPreferences = config.user;
        await this.saveUserPreferences();
      }

      if (config.profiles) {
        this.notificationProfiles.clear();
        for (const profile of config.profiles) {
          this.notificationProfiles.set(profile.id, profile);
        }
        await this.saveNotificationProfiles();
      }

      if (config.analytics) {
        this.analytics = config.analytics;
        await this.saveAnalytics();
      }

      this.logger.info('Notification configuration imported successfully');
      
      // Notify configuration change
      this.notifyConfigurationChange(this.getEffectiveConfig());

    } catch (error) {
      this.logger.error('Failed to import configuration', error);
      throw error;
    }
  }

  /**
   * Merge configuration objects
   */
  private mergeConfigs(
    base: GlobalNotificationConfig,
    override: Partial<GlobalNotificationConfig>
  ): GlobalNotificationConfig {
    return {
      ...base,
      ...override,
      levels: { ...base.levels, ...override.levels },
      types: { ...base.types, ...override.types },
      privacy: { ...base.privacy, ...override.privacy },
      quietHours: { ...base.quietHours, ...override.quietHours },
      rateLimiting: { ...base.rateLimiting, ...override.rateLimiting },
      contextualAdaptation: { ...base.contextualAdaptation, ...override.contextualAdaptation },
      intelligentBatching: { ...base.intelligentBatching, ...override.intelligentBatching },
      accessibility: { ...base.accessibility, ...override.accessibility }
    };
  }

  /**
   * Apply contextual adaptations to configuration
   */
  private applyContextualAdaptations(config: GlobalNotificationConfig): GlobalNotificationConfig {
    const adaptedConfig = { ...config };

    // Check working hours
    if (config.contextualAdaptation.workingHoursOnly) {
      const workingHours = this.userPreferences.preferences.workingHours;
      if (workingHours.enabled && !this.isInWorkingHours()) {
        // Reduce notification levels during non-working hours
        adaptedConfig.levels.info = false;
        adaptedConfig.levels.debug = false;
      }
    }

    // Check focus mode
    const focusMode = this.userPreferences.preferences.focusMode;
    if (focusMode.enabled) {
      // Only allow critical and mentions during focus mode
      adaptedConfig.levels.info = false;
      adaptedConfig.levels.debug = false;
      
      if (!focusMode.allowCritical) {
        adaptedConfig.levels.critical = false;
      }
    }

    return adaptedConfig;
  }

  /**
   * Check if currently in working hours
   */
  private isInWorkingHours(): boolean {
    const workingHours = this.userPreferences.preferences.workingHours;
    if (!workingHours.enabled) {
      return true;
    }

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    return currentTime >= workingHours.startTime && currentTime <= workingHours.endTime;
  }

  /**
   * Evaluate profile conditions
   */
  private evaluateProfileConditions(profile: NotificationProfile): boolean {
    return profile.conditions.every(condition => {
      if (!condition.enabled) return true;

      switch (condition.type) {
        case 'time':
          return this.evaluateTimeCondition(condition.parameters);
        case 'presence':
          return this.evaluatePresenceCondition(condition.parameters);
        case 'workload':
          return this.evaluateWorkloadCondition(condition.parameters);
        default:
          return true;
      }
    });
  }

  /**
   * Evaluate time-based condition
   */
  private evaluateTimeCondition(params: Record<string, any>): boolean {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const startTime = this.parseTime(params['startTime']);
    const endTime = this.parseTime(params['endTime']);

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  /**
   * Parse time string to minutes since midnight
   */
  private parseTime(timeString: string): number {
    const parts = timeString.split(':').map(Number);
    const hours = parts[0] || 0;
    const minutes = parts[1] || 0;
    return hours * 60 + minutes;
  }

  /**
   * Evaluate presence condition
   */
  private evaluatePresenceCondition(_params: Record<string, any>): boolean {
    // Would integrate with presence detection
    return true;
  }

  /**
   * Evaluate workload condition
   */
  private evaluateWorkloadCondition(_params: Record<string, any>): boolean {
    // Would integrate with workload detection
    return true;
  }

  /**
   * Validate configuration
   */
  private validateConfiguration(config: GlobalNotificationConfig): void {
    // Validate quiet hours
    if (config.quietHours.enabled) {
      const timePattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timePattern.test(config.quietHours.startTime) || 
          !timePattern.test(config.quietHours.endTime)) {
        throw new Error('Invalid quiet hours time format. Use HH:MM format.');
      }
    }

    // Validate rate limiting
    if (config.rateLimiting.enabled && config.rateLimiting.maxPerMinute <= 0) {
      throw new Error('Rate limiting maxPerMinute must be positive.');
    }
  }

  /**
   * Initialize default profiles
   */
  private initializeDefaultProfiles(): void {
    // Default profile
    this.notificationProfiles.set('default', {
      id: 'default',
      name: 'Default',
      description: 'Standard notification settings',
      config: {},
      conditions: [],
      priority: 0,
      isDefault: true
    });

    // Focus mode profile
    this.notificationProfiles.set('focus', {
      id: 'focus',
      name: 'Focus Mode',
      description: 'Minimal notifications for focused work',
      config: {
        levels: {
          critical: true,
          important: false,
          success: false,
          info: false,
          debug: false
        },
        osToastEnabled: false
      },
      conditions: [],
      priority: 100,
      isDefault: false
    });

    // Meeting profile
    this.notificationProfiles.set('meeting', {
      id: 'meeting',
      name: 'Meeting Mode',
      description: 'Silent notifications during meetings',
      config: {
        enabled: false,
        emergencyOverride: true
      },
      conditions: [
        {
          type: 'time',
          parameters: { startTime: '09:00', endTime: '17:00' },
          enabled: false
        }
      ],
      priority: 200,
      isDefault: false
    });
  }

  /**
   * Setup configuration watchers
   */
  private setupConfigurationWatchers(): void {
    // Watch VS Code configuration changes
    const configWatcher = vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('vesperaForge.notifications')) {
        this.loadAllConfigurations();
      }
    });

    this.disposables.push(configWatcher);
  }

  /**
   * Setup analytics collection
   */
  private setupAnalyticsCollection(): void {
    const analyticsInterval = setInterval(() => {
      this.saveAnalytics();
    }, 300000); // Save every 5 minutes

    this.disposables.push(new vscode.Disposable(() => {
      clearInterval(analyticsInterval);
    }));
  }

  /**
   * Notify configuration change listeners
   */
  private notifyConfigurationChange(config: GlobalNotificationConfig): void {
    for (const listener of this.configChangeListeners) {
      try {
        listener(config);
      } catch (error) {
        this.logger.warn('Configuration change listener error', { error });
      }
    }
  }

  /**
   * Track configuration change for analytics
   */
  private async trackConfigurationChange(
    type: string,
    previousConfig: any,
    newConfig: any
  ): Promise<void> {
    try {
      await this.coreServices.securityAuditLogger.logSecurityEvent(
        'security_breach' as any, // Using as generic event
        {
          timestamp: Date.now(),
          metadata: {
            action: 'notification_config_changed',
            configType: type,
            hasChanges: JSON.stringify(previousConfig) !== JSON.stringify(newConfig)
          }
        }
      );
    } catch (error) {
      this.logger.warn('Failed to track configuration change', { error });
    }
  }

  /**
   * Load all configurations
   */
  private async loadAllConfigurations(): Promise<void> {
    await Promise.all([
      this.loadGlobalConfiguration(),
      this.loadServerConfigurations(),
      this.loadUserPreferences(),
      this.loadNotificationProfiles(),
      this.loadAnalytics()
    ]);

    // Load active profile
    const activeProfileId = this.context.globalState.get<string>('activeNotificationProfile');
    if (activeProfileId && this.notificationProfiles.has(activeProfileId)) {
      this.activeProfileId = activeProfileId;
    }
  }

  /**
   * Load global configuration
   */
  private async loadGlobalConfiguration(): Promise<void> {
    const workspaceConfig = vscode.workspace.getConfiguration('vesperaForge.notifications');
    const storedConfig = this.context.globalState.get<GlobalNotificationConfig>('globalNotificationConfig');
    
    this.globalConfig = {
      ...this.getDefaultGlobalConfig(),
      ...storedConfig,
      // Override with workspace settings
      enabled: workspaceConfig.get('enabled', this.globalConfig.enabled),
      osToastEnabled: workspaceConfig.get('osToastEnabled', this.globalConfig.osToastEnabled)
    };
  }

  /**
   * Save global configuration
   */
  private async saveGlobalConfiguration(): Promise<void> {
    await this.context.globalState.update('globalNotificationConfig', this.globalConfig);
  }

  /**
   * Load server configurations
   */
  private async loadServerConfigurations(): Promise<void> {
    const storedConfigs = this.context.globalState.get<Record<string, ServerSpecificConfig>>('serverNotificationConfigs', {});
    
    this.serverConfigs.clear();
    for (const [serverId, config] of Object.entries(storedConfigs)) {
      this.serverConfigs.set(serverId, config);
    }
  }

  /**
   * Save server configuration
   */
  private async saveServerConfiguration(serverId: string, config: ServerSpecificConfig): Promise<void> {
    const allConfigs = this.context.globalState.get<Record<string, ServerSpecificConfig>>('serverNotificationConfigs', {});
    allConfigs[serverId] = config;
    await this.context.globalState.update('serverNotificationConfigs', allConfigs);
  }

  /**
   * Load user preferences
   */
  private async loadUserPreferences(): Promise<void> {
    const storedPreferences = this.context.globalState.get<UserPreferences>('userNotificationPreferences');
    
    if (storedPreferences) {
      this.userPreferences = {
        ...this.getDefaultUserPreferences(),
        ...storedPreferences
      };
    }
  }

  /**
   * Save user preferences
   */
  private async saveUserPreferences(): Promise<void> {
    await this.context.globalState.update('userNotificationPreferences', this.userPreferences);
  }

  /**
   * Load notification profiles
   */
  private async loadNotificationProfiles(): Promise<void> {
    const storedProfiles = this.context.globalState.get<NotificationProfile[]>('notificationProfiles');
    
    if (storedProfiles) {
      this.notificationProfiles.clear();
      for (const profile of storedProfiles) {
        this.notificationProfiles.set(profile.id, profile);
      }
    }
  }

  /**
   * Save notification profiles
   */
  private async saveNotificationProfiles(): Promise<void> {
    const profileArray = Array.from(this.notificationProfiles.values());
    await this.context.globalState.update('notificationProfiles', profileArray);
  }

  /**
   * Load analytics
   */
  private async loadAnalytics(): Promise<void> {
    const storedAnalytics = this.context.globalState.get<NotificationAnalytics>('notificationAnalytics');
    
    if (storedAnalytics) {
      this.analytics = {
        ...this.getDefaultAnalytics(),
        ...storedAnalytics
      };
    }
  }

  /**
   * Save analytics
   */
  private async saveAnalytics(): Promise<void> {
    await this.context.globalState.update('notificationAnalytics', this.analytics);
  }

  /**
   * Get default global configuration
   */
  private getDefaultGlobalConfig(): GlobalNotificationConfig {
    return {
      // Base notification config
      enabled: true,
      osToastEnabled: true,
      levels: {
        critical: true,
        important: true,
        success: true,
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
        [NotificationType.TASK_UPDATE]: {
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
        [NotificationType.AGENT_STATUS]: {
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
      },

      // Extended properties
      masterEnabled: true,
      emergencyOverride: false,
      developmentMode: false,

      contextualAdaptation: {
        enabled: true,
        workingHoursOnly: false,
        focusModeIntegration: true,
        adaptToPresence: false
      },

      intelligentBatching: {
        enabled: true,
        similarEventWindow: 30000, // 30 seconds
        maxBatchSize: 5,
        urgencyBreaksThrough: true
      },

      accessibility: {
        highContrast: false,
        reducedMotion: false,
        screenReaderFriendly: true,
        audioDescriptions: false
      }
    };
  }

  /**
   * Get default server configuration
   */
  private getDefaultServerConfig(serverId: string): ServerSpecificConfig {
    return {
      serverId,
      serverName: 'Unknown Server',
      enabled: true,
      overrides: {
        notificationLevel: NotificationLevel.INFO,
        showInToast: false,
        playSound: false,
        quietHoursOverride: false
      },
      channelOverrides: {},
      userOverrides: {}
    };
  }

  /**
   * Get default user preferences
   */
  private getDefaultUserPreferences(): UserPreferences {
    return {
      userId: 'default',
      preferences: {
        defaultNotificationLevel: NotificationLevel.INFO,
        preferredDeliveryMethod: 'both',
        workingHours: {
          enabled: false,
          startTime: '09:00',
          endTime: '17:00',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        focusMode: {
          enabled: false,
          allowCritical: true,
          allowMentions: true,
          customKeywords: []
        },
        deviceSpecific: {
          desktop: {},
          mobile: {}
        }
      }
    };
  }

  /**
   * Get default analytics
   */
  private getDefaultAnalytics(): NotificationAnalytics {
    return {
      totalNotificationsSent: 0,
      notificationsByType: {
        [NotificationType.AGENT_COMPLETION]: 0,
        [NotificationType.TASK_PROGRESS]: 0,
        [NotificationType.TASK_UPDATE]: 0,
        [NotificationType.TASK_SERVER_EVENT]: 0,
        [NotificationType.AGENT_STATUS]: 0,
        [NotificationType.CHAT_MESSAGE]: 0,
        [NotificationType.SECURITY_ALERT]: 0,
        [NotificationType.SYSTEM_STATUS]: 0,
        [NotificationType.ERROR]: 0
      },
      notificationsByLevel: {
        [NotificationLevel.CRITICAL]: 0,
        [NotificationLevel.IMPORTANT]: 0,
        [NotificationLevel.SUCCESS]: 0,
        [NotificationLevel.INFO]: 0,
        [NotificationLevel.DEBUG]: 0
      },
      dismissalRate: 0,
      actionClickRate: 0,
      quietHoursActivations: 0,
      profileSwitches: 0,
      userSatisfactionScore: 0,
      performanceMetrics: {
        averageDeliveryTime: 0,
        successRate: 1.0,
        errorRate: 0
      }
    };
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables.length = 0;
    
    this.serverConfigs.clear();
    this.notificationProfiles.clear();
    this.configChangeListeners.clear();
    
    this.initialized = false;
    NotificationConfigManager.instance = undefined as any;
    
    this.logger.info('NotificationConfigManager disposed');
  }
}