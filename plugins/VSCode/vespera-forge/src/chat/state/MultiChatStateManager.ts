/**
 * Multi-Chat State Manager - Main Orchestrator
 * 
 * This is the main state manager that orchestrates all multi-chat functionality by
 * delegating to specialized modules:
 * 
 * - ChatSessionPersistence: Handles session saving/loading and storage management
 * - ChatStateValidation: Validates and sanitizes state data
 * - ChatEventHandlers: Manages event processing and state updates
 * 
 * Features:
 * - Server hierarchy persistence (task-spawned vs regular servers)
 * - Channel state preservation within servers  
 * - Agent progress state restoration for ongoing tasks
 * - Cross-session server navigation state
 * - Dynamic server cleanup for completed/archived tasks
 */

import * as vscode from 'vscode';
import { VesperaLogger } from '../../core/logging/VesperaLogger';
import { VesperaErrorHandler } from '../../core/error-handling/VesperaErrorHandler';
import { 
  SecureSessionPersistenceManager,
  ServerState,
  ChannelState,
  MessageHistoryState
} from '../persistence/SecureSessionPersistenceManager';
import { TaskServerManager } from '../servers/TaskServerManager';
import { ChatSessionPersistence } from './ChatSessionPersistence';
import { ChatStateValidation } from './ChatStateValidation';
import { ChatEventHandlers } from './ChatEventHandlers';
import {
  MultiChatState,
  StateChangeEvent,
  AgentProgressState,
  UIPreferences,
  NotificationSettings
} from './MultiChatStateTypes';

// Re-export types from MultiChatStateTypes for backward compatibility
export {
  MultiChatState,
  ServerNavigationState,
  ChannelViewState,
  AgentProgressState,
  MentionState,
  NotificationSettings,
  QuietHoursConfig,
  UIPreferences,
  StateChangeEvent
} from './MultiChatStateTypes';

export class MultiChatStateManager {
  private currentState: MultiChatState;
  private disposables: vscode.Disposable[] = [];
  
  // Specialized modules
  private readonly sessionPersistence: ChatSessionPersistence;
  private readonly stateValidation: ChatStateValidation;
  private readonly eventHandlers: ChatEventHandlers;

  constructor(
    private readonly persistenceManager: SecureSessionPersistenceManager,
    private readonly taskServerManager: TaskServerManager,
    private readonly logger: VesperaLogger,
    private readonly errorHandler: VesperaErrorHandler
  ) {
    // Initialize specialized modules
    this.sessionPersistence = new ChatSessionPersistence(persistenceManager, logger);
    this.stateValidation = new ChatStateValidation(logger);
    this.eventHandlers = new ChatEventHandlers(taskServerManager, logger);
    
    // Initialize with default state
    this.currentState = this.stateValidation.createDefaultState();
    
    // Setup task server event handlers
    this.setupTaskServerEventHandlers();
    
    // Setup periodic state saving
    this.setupPeriodicStateSaving();
  }

  /**
   * Initialize state manager and restore from session
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing MultiChatStateManager');

      // Restore state from session
      await this.restoreStateFromSession();
      
      // Initialize task server manager from session
      await this.taskServerManager.initializeFromSession();

      // Restore UI state
      await this.restoreUIState();

      this.logger.info('MultiChatStateManager initialized successfully', {
        activeServerId: this.currentState.activeServerId,
        channelStates: this.currentState.channelStates.size,
        agentStates: this.currentState.agentProgressStates.size
      });

    } catch (error) {
      this.logger.error('Failed to initialize MultiChatStateManager', error);
      await this.errorHandler.handleError(error as Error);
      
      // Fall back to default state
      this.currentState = this.stateValidation.createDefaultState();
    }
  }

  /**
   * Get current multi-chat state
   */
  public getState(): MultiChatState {
    return { ...this.currentState };
  }

  /**
   * Set active server
   */
  public async setActiveServer(serverId: string): Promise<void> {
    await this.eventHandlers.handleServerActivation(
      this.currentState,
      serverId,
      (event) => this.eventHandlers.emitStateChange(event),
      () => this.saveCurrentState()
    );
  }

  /**
   * Set active channel
   */
  public async setActiveChannel(channelId: string, serverId?: string): Promise<void> {
    await this.eventHandlers.handleChannelActivation(
      this.currentState,
      channelId,
      serverId,
      (sid) => this.setActiveServer(sid),
      (event) => this.eventHandlers.emitStateChange(event),
      () => this.saveCurrentState()
    );
  }

  /**
   * Add server to state
   */
  public async addServer(server: ServerState): Promise<void> {
    try {
      // Add to navigation state
      if (!this.currentState.serverNavigationState.serverOrder.includes(server.serverId)) {
        this.currentState.serverNavigationState.serverOrder.push(server.serverId);
      }

      // Initialize channel states for all channels in the server
      for (const channel of server.channels) {
        await this.addChannel(channel, server.serverId);
      }

      // If this is the first server, make it active
      if (!this.currentState.activeServerId) {
        await this.setActiveServer(server.serverId);
      }

      // Save state
      await this.saveCurrentState();

      // Emit event
      this.eventHandlers.emitStateChange({
        type: 'serverAdded',
        serverId: server.serverId,
        data: { server }
      });

      this.logger.info('Server added to state', {
        serverId: server.serverId,
        serverType: server.serverType,
        channelCount: server.channels.length
      });

    } catch (error) {
      this.logger.error('Failed to add server to state', error, {
        serverId: server.serverId
      });
      throw error;
    }
  }

  /**
   * Add channel to state
   */
  public async addChannel(channel: ChannelState, serverId: string): Promise<void> {
    try {
      // Create channel view state from session persistence helper
      const channelStates = this.sessionPersistence.initializeChannelStatesFromServer({
        serverId,
        channels: [channel]
      } as ServerState);
      
      const channelViewState = channelStates.get(channel.channelId);
      if (!channelViewState) {
        throw new Error('Failed to create channel view state');
      }

      this.currentState.channelStates.set(channel.channelId, channelViewState);
      this.currentState.unreadCounts.set(channel.channelId, 0);

      // If this is an agent channel, initialize agent progress state
      if (channel.channelType === 'agent' && channel.agentRole) {
        const session = this.persistenceManager.getCurrentSession();
        const taskServerState = session?.taskServerStates.find(t => t.serverId === serverId);
        
        if (taskServerState) {
          const agentProgressState = this.sessionPersistence.initializeAgentProgressState(
            channel,
            serverId,
            taskServerState.taskId
          );
          
          if (agentProgressState) {
            this.currentState.agentProgressStates.set(channel.channelId, agentProgressState);
          }
        }
      }

      // Save state
      await this.saveCurrentState();

      // Emit event
      this.eventHandlers.emitStateChange({
        type: 'channelAdded',
        channelId: channel.channelId,
        serverId,
        data: { channel }
      });

      this.logger.debug('Channel added to state', {
        channelId: channel.channelId,
        serverId,
        channelType: channel.channelType
      });

    } catch (error) {
      this.logger.error('Failed to add channel to state', error, {
        channelId: channel.channelId,
        serverId
      });
      throw error;
    }
  }

  /**
   * Update agent progress state
   */
  public async updateAgentProgress(
    channelId: string,
    update: Partial<AgentProgressState>
  ): Promise<void> {
    await this.eventHandlers.handleAgentProgressUpdate(
      this.currentState,
      channelId,
      update,
      (event) => this.eventHandlers.emitStateChange(event),
      () => this.saveCurrentState()
    );
  }

  /**
   * Handle new message received
   */
  public async handleMessageReceived(message: MessageHistoryState): Promise<void> {
    await this.eventHandlers.handleMessageReceived(
      this.currentState,
      message,
      (event) => this.eventHandlers.emitStateChange(event),
      () => this.saveCurrentState()
    );
  }

  /**
   * Update UI preferences
   */
  public async updateUIPreferences(preferences: Partial<UIPreferences>): Promise<void> {
    // Validate preferences before applying
    const validationResult = this.stateValidation.validateState({ 
      uiPreferences: { ...this.currentState.uiPreferences, ...preferences } 
    });
    
    if (validationResult.sanitizedState?.uiPreferences) {
      this.currentState.uiPreferences = validationResult.sanitizedState.uiPreferences;
    } else {
      this.logger.warn('UI preferences validation failed', { 
        preferences, 
        errors: validationResult.errors 
      });
      return;
    }

    await this.saveCurrentState();

    this.eventHandlers.emitStateChange({
      type: 'preferencesUpdated',
      data: { preferences: this.currentState.uiPreferences }
    });

    this.logger.debug('UI preferences updated', { preferences });
  }

  /**
   * Update notification settings
   */
  public async updateNotificationSettings(settings: Partial<NotificationSettings>): Promise<void> {
    // Validate notification settings before applying
    const validationResult = this.stateValidation.validateState({ 
      notificationSettings: { ...this.currentState.notificationSettings, ...settings } 
    });
    
    if (validationResult.sanitizedState?.notificationSettings) {
      this.currentState.notificationSettings = validationResult.sanitizedState.notificationSettings;
    } else {
      this.logger.warn('Notification settings validation failed', { 
        settings, 
        errors: validationResult.errors 
      });
      return;
    }

    await this.saveCurrentState();

    this.eventHandlers.emitStateChange({
      type: 'preferencesUpdated',
      data: { notificationSettings: this.currentState.notificationSettings }
    });

    this.logger.debug('Notification settings updated', { settings });
  }

  /**
   * Get unread count for channel
   */
  public getUnreadCount(channelId: string): number {
    return this.currentState.unreadCounts.get(channelId) || 0;
  }

  /**
   * Get total unread count across all channels
   */
  public getTotalUnreadCount(): number {
    let total = 0;
    for (const count of this.currentState.unreadCounts.values()) {
      total += count;
    }
    return total;
  }

  /**
   * Register state change handler
   */
  public onStateChange(
    handler: (event: StateChangeEvent) => void
  ): vscode.Disposable {
    return this.eventHandlers.onStateChange(handler);
  }

  /**
   * Cleanup archived servers
   */
  public async cleanupArchivedServers(): Promise<void> {
    const cleanedServerIds = await this.sessionPersistence.cleanupArchivedServers(this.currentState);
    
    if (cleanedServerIds.length > 0) {
      this.logger.info('Archived servers cleanup completed', {
        cleanedCount: cleanedServerIds.length,
        serverIds: cleanedServerIds
      });
    }
  }

  // Default state creation is now handled by ChatStateValidation module

  /**
   * Restore state from session
   */
  private async restoreStateFromSession(): Promise<void> {
    const restoredState = await this.sessionPersistence.restoreStateFromSession();
    
    // Merge restored state with current state
    this.currentState = {
      ...this.currentState,
      ...restoredState
    };
    
    // Validate and sanitize the restored state
    const validationResult = this.stateValidation.validateState(this.currentState);
    if (!validationResult.isValid) {
      this.logger.warn('Restored state validation failed, sanitizing', {
        errors: validationResult.errors
      });
      this.currentState = this.stateValidation.sanitizeState(this.currentState);
    }
  }

  /**
   * Save current state to session
   */
  private async saveCurrentState(): Promise<void> {
    await this.sessionPersistence.saveCurrentState(this.currentState);
  }

  /**
   * Restore UI state to webview
   */
  private async restoreUIState(): Promise<void> {
    // This would send state to webview to restore UI
    // Implementation depends on webview integration
    this.logger.debug('UI state restoration completed', {
      activeServerId: this.currentState.activeServerId,
      activeChannelId: this.currentState.activeChannelId
    });
  }

  /**
   * Setup task server event handlers
   */
  private setupTaskServerEventHandlers(): void {
    this.eventHandlers.setupTaskServerEventHandlers(
      (server) => this.addServer(server),
      (channel, serverId) => this.addChannel(channel, serverId),
      (taskId, progressData) => this.eventHandlers.handleTaskProgressUpdated(
        this.currentState,
        taskId,
        progressData,
        (channelId, update) => this.updateAgentProgress(channelId, update)
      )
    );
  }

  /**
   * Setup periodic state saving
   */
  private setupPeriodicStateSaving(): void {
    this.sessionPersistence.setupPeriodicStateSaving(() => this.saveCurrentState());
  }

  // Navigation history management moved to ChatEventHandlers module

  // State change event emission is now handled by ChatEventHandlers module

  /**
   * Dispose resources
   */
  public dispose(): void {
    // Dispose specialized modules
    this.sessionPersistence.dispose();
    this.eventHandlers.dispose();
    
    this.disposables.forEach(d => d.dispose());
    this.disposables.length = 0;
    
    this.logger.info('MultiChatStateManager disposed');
  }
}