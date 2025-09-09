/**
 * Chat State Validation Module
 * 
 * Handles all state validation and sanitization operations including:
 * - State structure validation
 * - Data type checking and conversion
 * - State sanitization and cleanup
 * - Error detection and reporting
 * 
 * This module ensures data integrity and consistency across all state operations.
 */

import { VesperaLogger } from '../../core/logging/VesperaLogger';
import { 
  MultiChatState,
  ServerNavigationState,
  ChannelViewState,
  AgentProgressState,
  NotificationSettings,
  UIPreferences,
  StateValidationError,
  StateValidationResult,
  QuietHoursConfig
} from './MultiChatStateTypes';

/**
 * Validates and sanitizes multi-chat state data
 */
export class ChatStateValidation {
  
  constructor(private readonly logger: VesperaLogger) {}

  /**
   * Validate complete multi-chat state
   */
  public validateState(state: Partial<MultiChatState>): StateValidationResult {
    const errors: StateValidationError[] = [];
    const sanitizedState: Partial<MultiChatState> = {};

    try {
      // Validate and sanitize server navigation state
      if (state.serverNavigationState) {
        const navResult = this.validateServerNavigationState(state.serverNavigationState);
        errors.push(...navResult.errors);
        if (navResult.sanitizedState) {
          sanitizedState.serverNavigationState = navResult.sanitizedState;
        }
      }

      // Validate active server and channel IDs
      if (state.activeServerId !== undefined) {
        const serverIdResult = this.validateServerId(state.activeServerId);
        errors.push(...serverIdResult.errors);
        if (serverIdResult.isValid) {
          sanitizedState.activeServerId = state.activeServerId;
        }
      }

      if (state.activeChannelId !== undefined) {
        const channelIdResult = this.validateChannelId(state.activeChannelId);
        errors.push(...channelIdResult.errors);
        if (channelIdResult.isValid) {
          sanitizedState.activeChannelId = state.activeChannelId;
        }
      }

      // Validate channel states
      if (state.channelStates) {
        const channelStatesResult = this.validateChannelStates(state.channelStates);
        errors.push(...channelStatesResult.errors);
        if (channelStatesResult.sanitizedState) {
          sanitizedState.channelStates = channelStatesResult.sanitizedState;
        }
      }

      // Validate agent progress states
      if (state.agentProgressStates) {
        const agentStatesResult = this.validateAgentProgressStates(state.agentProgressStates);
        errors.push(...agentStatesResult.errors);
        if (agentStatesResult.sanitizedState) {
          sanitizedState.agentProgressStates = agentStatesResult.sanitizedState;
        }
      }

      // Validate unread counts
      if (state.unreadCounts) {
        const unreadResult = this.validateUnreadCounts(state.unreadCounts);
        errors.push(...unreadResult.errors);
        if (unreadResult.sanitizedState) {
          sanitizedState.unreadCounts = unreadResult.sanitizedState;
        }
      }

      // Validate notification settings
      if (state.notificationSettings) {
        const notificationResult = this.validateNotificationSettings(state.notificationSettings);
        errors.push(...notificationResult.errors);
        if (notificationResult.sanitizedState) {
          sanitizedState.notificationSettings = notificationResult.sanitizedState;
        }
      }

      // Validate UI preferences
      if (state.uiPreferences) {
        const uiResult = this.validateUIPreferences(state.uiPreferences);
        errors.push(...uiResult.errors);
        if (uiResult.sanitizedState) {
          sanitizedState.uiPreferences = uiResult.sanitizedState;
        }
      }

      const isValid = errors.filter(e => e.severity === 'error').length === 0;

      if (errors.length > 0) {
        this.logger.debug('State validation completed with issues', {
          errorCount: errors.filter(e => e.severity === 'error').length,
          warningCount: errors.filter(e => e.severity === 'warning').length
        });
      }

      return {
        isValid,
        errors,
        sanitizedState: isValid ? sanitizedState : undefined
      };

    } catch (error) {
      this.logger.error('State validation failed', error);
      return {
        isValid: false,
        errors: [{
          field: 'state',
          message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'error'
        }]
      };
    }
  }

  /**
   * Create default state with all required fields
   */
  public createDefaultState(): MultiChatState {
    return {
      serverNavigationState: {
        expandedServers: new Set(),
        collapsedServers: new Set(),
        pinnedServers: new Set(),
        serverOrder: [],
        navigationHistory: []
      },
      channelStates: new Map(),
      agentProgressStates: new Map(),
      unreadCounts: new Map(),
      notificationSettings: {
        enableTaskProgress: true,
        enableAgentActivity: true,
        enableNewMessages: true,
        enableMentions: true,
        soundEnabled: true,
        desktopNotifications: true,
        quietHours: {
          enabled: false,
          startTime: '22:00',
          endTime: '08:00'
        }
      },
      uiPreferences: {
        theme: 'auto',
        density: 'comfortable',
        showAvatars: true,
        showTimestamps: true,
        groupMessages: true,
        showChannelList: true,
        showMemberList: false,
        fontSize: 14,
        messagePreview: true
      }
    };
  }

  /**
   * Sanitize state by removing invalid entries and fixing corrupted data
   */
  public sanitizeState(state: MultiChatState): MultiChatState {
    const validationResult = this.validateState(state);
    
    if (validationResult.isValid && validationResult.sanitizedState) {
      return { ...state, ...validationResult.sanitizedState };
    }

    // If validation fails completely, return default state
    this.logger.warn('State severely corrupted, returning default state');
    return this.createDefaultState();
  }

  // Private validation methods

  private validateServerNavigationState(navState: ServerNavigationState): {
    errors: StateValidationError[];
    sanitizedState?: ServerNavigationState;
  } {
    const errors: StateValidationError[] = [];
    const sanitized: ServerNavigationState = {
      expandedServers: new Set(),
      collapsedServers: new Set(),
      pinnedServers: new Set(),
      serverOrder: [],
      navigationHistory: []
    };

    // Validate sets
    if (navState.expandedServers instanceof Set) {
      sanitized.expandedServers = new Set([...navState.expandedServers].filter(id => typeof id === 'string'));
    } else if (Array.isArray(navState.expandedServers)) {
      sanitized.expandedServers = new Set((navState.expandedServers as any[]).filter((id: any) => typeof id === 'string'));
    }

    if (navState.collapsedServers instanceof Set) {
      sanitized.collapsedServers = new Set([...navState.collapsedServers].filter(id => typeof id === 'string'));
    } else if (Array.isArray(navState.collapsedServers)) {
      sanitized.collapsedServers = new Set((navState.collapsedServers as any[]).filter((id: any) => typeof id === 'string'));
    }

    if (navState.pinnedServers instanceof Set) {
      sanitized.pinnedServers = new Set([...navState.pinnedServers].filter(id => typeof id === 'string'));
    } else if (Array.isArray(navState.pinnedServers)) {
      sanitized.pinnedServers = new Set((navState.pinnedServers as any[]).filter((id: any) => typeof id === 'string'));
    }

    // Validate arrays
    if (Array.isArray(navState.serverOrder)) {
      sanitized.serverOrder = navState.serverOrder.filter(id => typeof id === 'string');
    } else {
      errors.push({
        field: 'serverNavigationState.serverOrder',
        message: 'Server order must be an array',
        severity: 'error'
      });
    }

    if (Array.isArray(navState.navigationHistory)) {
      sanitized.navigationHistory = navState.navigationHistory
        .filter(id => typeof id === 'string')
        .slice(0, 10); // Limit to 10 items
    } else {
      errors.push({
        field: 'serverNavigationState.navigationHistory',
        message: 'Navigation history must be an array',
        severity: 'warning'
      });
    }

    // Validate optional fields
    if (navState.lastAccessedServer !== undefined) {
      if (typeof navState.lastAccessedServer === 'string') {
        sanitized.lastAccessedServer = navState.lastAccessedServer;
      } else {
        errors.push({
          field: 'serverNavigationState.lastAccessedServer',
          message: 'Last accessed server must be a string',
          severity: 'warning'
        });
      }
    }

    return { errors, sanitizedState: sanitized };
  }

  private validateChannelStates(channelStates: Map<string, ChannelViewState>): {
    errors: StateValidationError[];
    sanitizedState?: Map<string, ChannelViewState>;
  } {
    const errors: StateValidationError[] = [];
    const sanitized = new Map<string, ChannelViewState>();

    if (!(channelStates instanceof Map)) {
      errors.push({
        field: 'channelStates',
        message: 'Channel states must be a Map',
        severity: 'error'
      });
      return { errors };
    }

    for (const [channelId, channelState] of channelStates) {
      if (typeof channelId !== 'string') {
        errors.push({
          field: `channelStates[${channelId}]`,
          message: 'Channel ID must be a string',
          severity: 'error'
        });
        continue;
      }

      const sanitizedChannelState = this.sanitizeChannelViewState(channelState);
      if (sanitizedChannelState) {
        sanitized.set(channelId, sanitizedChannelState);
      } else {
        errors.push({
          field: `channelStates[${channelId}]`,
          message: 'Invalid channel state structure',
          severity: 'error'
        });
      }
    }

    return { errors, sanitizedState: sanitized };
  }

  private validateAgentProgressStates(agentStates: Map<string, AgentProgressState>): {
    errors: StateValidationError[];
    sanitizedState?: Map<string, AgentProgressState>;
  } {
    const errors: StateValidationError[] = [];
    const sanitized = new Map<string, AgentProgressState>();

    if (!(agentStates instanceof Map)) {
      errors.push({
        field: 'agentProgressStates',
        message: 'Agent progress states must be a Map',
        severity: 'error'
      });
      return { errors };
    }

    const validStatuses = ['idle', 'active', 'waiting', 'error', 'completed'];

    for (const [channelId, agentState] of agentStates) {
      if (typeof channelId !== 'string') {
        errors.push({
          field: `agentProgressStates[${channelId}]`,
          message: 'Channel ID must be a string',
          severity: 'error'
        });
        continue;
      }

      const sanitizedAgentState = this.sanitizeAgentProgressState(agentState, validStatuses);
      if (sanitizedAgentState) {
        sanitized.set(channelId, sanitizedAgentState);
      } else {
        errors.push({
          field: `agentProgressStates[${channelId}]`,
          message: 'Invalid agent progress state structure',
          severity: 'error'
        });
      }
    }

    return { errors, sanitizedState: sanitized };
  }

  private validateUnreadCounts(unreadCounts: Map<string, number>): {
    errors: StateValidationError[];
    sanitizedState?: Map<string, number>;
  } {
    const errors: StateValidationError[] = [];
    const sanitized = new Map<string, number>();

    if (!(unreadCounts instanceof Map)) {
      errors.push({
        field: 'unreadCounts',
        message: 'Unread counts must be a Map',
        severity: 'error'
      });
      return { errors };
    }

    for (const [channelId, count] of unreadCounts) {
      if (typeof channelId !== 'string') {
        errors.push({
          field: `unreadCounts[${channelId}]`,
          message: 'Channel ID must be a string',
          severity: 'error'
        });
        continue;
      }

      const sanitizedCount = Math.max(0, Math.floor(Number(count) || 0));
      sanitized.set(channelId, sanitizedCount);

      if (sanitizedCount !== count) {
        errors.push({
          field: `unreadCounts[${channelId}]`,
          message: 'Unread count sanitized to non-negative integer',
          severity: 'warning'
        });
      }
    }

    return { errors, sanitizedState: sanitized };
  }

  private validateNotificationSettings(settings: NotificationSettings): {
    errors: StateValidationError[];
    sanitizedState?: NotificationSettings;
  } {
    const errors: StateValidationError[] = [];
    const sanitized: NotificationSettings = {
      enableTaskProgress: Boolean(settings.enableTaskProgress),
      enableAgentActivity: Boolean(settings.enableAgentActivity),
      enableNewMessages: Boolean(settings.enableNewMessages),
      enableMentions: Boolean(settings.enableMentions),
      soundEnabled: Boolean(settings.soundEnabled),
      desktopNotifications: Boolean(settings.desktopNotifications),
      quietHours: this.validateQuietHours(settings.quietHours)
    };

    return { errors, sanitizedState: sanitized };
  }

  private validateUIPreferences(preferences: UIPreferences): {
    errors: StateValidationError[];
    sanitizedState?: UIPreferences;
  } {
    const errors: StateValidationError[] = [];
    
    const validThemes = ['light', 'dark', 'auto'];
    const validDensities = ['compact', 'comfortable', 'spacious'];

    const sanitized: UIPreferences = {
      theme: validThemes.includes(preferences.theme) ? preferences.theme : 'auto',
      density: validDensities.includes(preferences.density) ? preferences.density : 'comfortable',
      showAvatars: Boolean(preferences.showAvatars),
      showTimestamps: Boolean(preferences.showTimestamps),
      groupMessages: Boolean(preferences.groupMessages),
      showChannelList: Boolean(preferences.showChannelList),
      showMemberList: Boolean(preferences.showMemberList),
      fontSize: Math.min(24, Math.max(10, Math.floor(Number(preferences.fontSize) || 14))),
      messagePreview: Boolean(preferences.messagePreview)
    };

    if (sanitized.fontSize !== preferences.fontSize) {
      errors.push({
        field: 'uiPreferences.fontSize',
        message: 'Font size constrained to 10-24 range',
        severity: 'warning'
      });
    }

    return { errors, sanitizedState: sanitized };
  }

  private validateServerId(serverId: string): { isValid: boolean; errors: StateValidationError[] } {
    const errors: StateValidationError[] = [];
    
    if (typeof serverId !== 'string' || serverId.length === 0) {
      errors.push({
        field: 'activeServerId',
        message: 'Server ID must be a non-empty string',
        severity: 'error'
      });
      return { isValid: false, errors };
    }

    return { isValid: true, errors };
  }

  private validateChannelId(channelId: string): { isValid: boolean; errors: StateValidationError[] } {
    const errors: StateValidationError[] = [];
    
    if (typeof channelId !== 'string' || channelId.length === 0) {
      errors.push({
        field: 'activeChannelId',
        message: 'Channel ID must be a non-empty string',
        severity: 'error'
      });
      return { isValid: false, errors };
    }

    return { isValid: true, errors };
  }

  private sanitizeChannelViewState(state: ChannelViewState): ChannelViewState | null {
    if (typeof state.channelId !== 'string' || typeof state.serverId !== 'string') {
      return null;
    }

    return {
      channelId: state.channelId,
      serverId: state.serverId,
      isVisible: Boolean(state.isVisible),
      scrollPosition: Math.max(0, Number(state.scrollPosition) || 0),
      inputText: String(state.inputText || ''),
      mentionState: state.mentionState, // Optional, let it pass through
      lastReadMessageId: typeof state.lastReadMessageId === 'string' ? state.lastReadMessageId : undefined,
      typingIndicators: state.typingIndicators instanceof Set ? state.typingIndicators : new Set()
    };
  }

  private sanitizeAgentProgressState(state: AgentProgressState, validStatuses: string[]): AgentProgressState | null {
    if (typeof state.channelId !== 'string' || typeof state.taskId !== 'string' || typeof state.agentRole !== 'string') {
      return null;
    }

    return {
      agentRole: state.agentRole,
      channelId: state.channelId,
      taskId: state.taskId,
      status: validStatuses.includes(state.status) ? state.status : 'idle',
      currentAction: typeof state.currentAction === 'string' ? state.currentAction : undefined,
      progressPercentage: Math.min(100, Math.max(0, Number(state.progressPercentage) || 0)),
      lastUpdate: Number(state.lastUpdate) || Date.now(),
      messageQueue: Array.isArray(state.messageQueue) ? state.messageQueue.filter(m => typeof m === 'string') : [],
      errorMessages: Array.isArray(state.errorMessages) ? state.errorMessages.filter(m => typeof m === 'string') : []
    };
  }

  private validateQuietHours(quietHours: QuietHoursConfig): QuietHoursConfig {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    
    return {
      enabled: Boolean(quietHours.enabled),
      startTime: timeRegex.test(quietHours.startTime) ? quietHours.startTime : '22:00',
      endTime: timeRegex.test(quietHours.endTime) ? quietHours.endTime : '08:00'
    };
  }
}