/**
 * Chat Session Persistence Module
 * 
 * Handles all session-related data persistence operations including:
 * - Session state saving and loading
 * - State restoration from persistent storage
 * - User preference persistence
 * - Cross-session data management
 * 
 * This module isolates all persistence logic from the main state manager,
 * providing a clean interface for session management operations.
 */

// import * as vscode from 'vscode'; // Not used in this module
import { VesperaLogger } from '../../core/logging/VesperaLogger';
import { 
  SecureSessionPersistenceManager,
  ServerState,
  ChannelState
} from '../persistence/SecureSessionPersistenceManager';
import { 
  MultiChatState,
  ServerNavigationState,
  ChannelViewState,
  AgentProgressState,
  NotificationSettings
} from './MultiChatStateTypes';

/**
 * Manages all session persistence operations for the multi-chat state system
 */
export class ChatSessionPersistence {
  private readonly STATE_SAVE_INTERVAL = 30000; // 30 seconds
  private stateUpdateTimer?: NodeJS.Timeout;

  constructor(
    private readonly persistenceManager: SecureSessionPersistenceManager,
    private readonly logger: VesperaLogger
  ) {}

  /**
   * Initialize periodic state saving
   */
  public setupPeriodicStateSaving(saveCallback: () => Promise<void>): void {
    this.stateUpdateTimer = setInterval(async () => {
      try {
        await saveCallback();
      } catch (error) {
        this.logger.error('Periodic state save failed', error);
      }
    }, this.STATE_SAVE_INTERVAL);
  }

  /**
   * Restore complete state from session
   */
  public async restoreStateFromSession(): Promise<Partial<MultiChatState>> {
    const session = this.persistenceManager.getCurrentSession();
    if (!session) {
      this.logger.debug('No session to restore state from');
      return {};
    }

    const restoredState: Partial<MultiChatState> = {};

    try {
      // Restore server navigation
      restoredState.serverNavigationState = this.restoreServerNavigationState(session);

      // Restore user preferences
      restoredState.notificationSettings = this.restoreNotificationSettings(session);
      
      // Restore active server/channel
      restoredState.activeServerId = session.activeServerId;
      restoredState.activeChannelId = session.activeChannelId;

      // Initialize channel states
      restoredState.channelStates = this.restoreChannelStates(session);
      restoredState.unreadCounts = this.initializeUnreadCounts(session);

      // Initialize agent progress states
      restoredState.agentProgressStates = this.restoreAgentProgressStates(session);

      this.logger.info('State restored from session', {
        servers: session.servers.length,
        channelStates: restoredState.channelStates?.size || 0,
        agentStates: restoredState.agentProgressStates?.size || 0
      });

      return restoredState;

    } catch (error) {
      this.logger.error('Failed to restore state from session', error);
      throw error;
    }
  }

  /**
   * Save current state to session
   */
  public async saveCurrentState(currentState: MultiChatState): Promise<void> {
    try {
      const session = this.persistenceManager.getCurrentSession();
      if (!session) {
        this.logger.warn('No current session to save state to');
        return;
      }

      // Update session with current state
      session.activeServerId = currentState.activeServerId;
      session.activeChannelId = currentState.activeChannelId;
      
      // Update user preferences
      session.userPreferences = {
        ...session.userPreferences,
        collapsedServers: Array.from(currentState.serverNavigationState.collapsedServers),
        notificationSettings: {
          taskProgress: currentState.notificationSettings.enableTaskProgress,
          agentActivity: currentState.notificationSettings.enableAgentActivity,
          newMessages: currentState.notificationSettings.enableNewMessages
        }
      };

      // Save session
      await this.persistenceManager.saveSession(session);

    } catch (error) {
      this.logger.error('Failed to save current state to session', error);
      throw error;
    }
  }

  /**
   * Initialize channel states from session data
   */
  public initializeChannelStatesFromServer(server: ServerState): Map<string, ChannelViewState> {
    const channelStates = new Map<string, ChannelViewState>();
    
    for (const channel of server.channels) {
      const channelViewState: ChannelViewState = {
        channelId: channel.channelId,
        serverId: server.serverId,
        isVisible: false,
        scrollPosition: 0,
        inputText: '',
        typingIndicators: new Set()
      };
      
      channelStates.set(channel.channelId, channelViewState);
    }

    return channelStates;
  }

  /**
   * Initialize agent progress state for agent channel
   */
  public initializeAgentProgressState(
    channel: ChannelState, 
    _serverId: string, 
    taskId: string
  ): AgentProgressState | null {
    if (channel.channelType !== 'agent' || !channel.agentRole) {
      return null;
    }

    return {
      agentRole: channel.agentRole,
      channelId: channel.channelId,
      taskId,
      status: 'idle',
      progressPercentage: 0,
      lastUpdate: Date.now(),
      messageQueue: [],
      errorMessages: []
    };
  }

  /**
   * Clean up archived servers from state
   */
  public async cleanupArchivedServers(
    currentState: MultiChatState,
    cutoffDays: number = 7
  ): Promise<string[]> {
    try {
      const session = this.persistenceManager.getCurrentSession();
      if (!session) return [];

      const archivedServers = session.servers.filter(s => s.archived);
      const cutoffTime = Date.now() - (cutoffDays * 24 * 60 * 60 * 1000);
      const cleanedServerIds: string[] = [];

      for (const server of archivedServers) {
        if (server.lastActivity < cutoffTime) {
          // Remove from navigation state
          const index = currentState.serverNavigationState.serverOrder.indexOf(server.serverId);
          if (index > -1) {
            currentState.serverNavigationState.serverOrder.splice(index, 1);
          }

          // Remove channel states
          for (const channel of server.channels) {
            currentState.channelStates.delete(channel.channelId);
            currentState.unreadCounts.delete(channel.channelId);
            currentState.agentProgressStates.delete(channel.channelId);
          }

          cleanedServerIds.push(server.serverId);
          
          this.logger.info('Archived server cleaned up', {
            serverId: server.serverId,
            lastActivity: server.lastActivity
          });
        }
      }

      if (cleanedServerIds.length > 0) {
        await this.saveCurrentState(currentState);
      }

      return cleanedServerIds;

    } catch (error) {
      this.logger.error('Failed to cleanup archived servers', error);
      return [];
    }
  }

  /**
   * Dispose persistence resources
   */
  public dispose(): void {
    if (this.stateUpdateTimer) {
      clearInterval(this.stateUpdateTimer);
      this.stateUpdateTimer = undefined;
    }
  }

  // Private helper methods

  private restoreServerNavigationState(session: any): ServerNavigationState {
    const navigationState: ServerNavigationState = {
      expandedServers: new Set(),
      collapsedServers: new Set(),
      pinnedServers: new Set(),
      serverOrder: session.servers.map((s: ServerState) => s.serverId),
      navigationHistory: []
    };

    // Restore collapsed servers from user preferences
    if (session.userPreferences?.collapsedServers) {
      navigationState.collapsedServers = new Set(session.userPreferences.collapsedServers);
    }

    return navigationState;
  }

  private restoreNotificationSettings(session: any): NotificationSettings {
    const defaultSettings: NotificationSettings = {
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
    };

    if (session.userPreferences?.notificationSettings) {
      return {
        ...defaultSettings,
        enableTaskProgress: session.userPreferences.notificationSettings.taskProgress ?? defaultSettings.enableTaskProgress,
        enableAgentActivity: session.userPreferences.notificationSettings.agentActivity ?? defaultSettings.enableAgentActivity,
        enableNewMessages: session.userPreferences.notificationSettings.newMessages ?? defaultSettings.enableNewMessages
      };
    }

    return defaultSettings;
  }

  private restoreChannelStates(session: any): Map<string, ChannelViewState> {
    const channelStates = new Map<string, ChannelViewState>();

    for (const server of session.servers) {
      for (const channel of server.channels) {
        const channelViewState: ChannelViewState = {
          channelId: channel.channelId,
          serverId: server.serverId,
          isVisible: channel.channelId === session.activeChannelId,
          scrollPosition: 0,
          inputText: '',
          typingIndicators: new Set()
        };
        
        channelStates.set(channel.channelId, channelViewState);
      }
    }

    return channelStates;
  }

  private initializeUnreadCounts(session: any): Map<string, number> {
    const unreadCounts = new Map<string, number>();

    for (const server of session.servers) {
      for (const channel of server.channels) {
        unreadCounts.set(channel.channelId, 0);
      }
    }

    return unreadCounts;
  }

  private restoreAgentProgressStates(session: any): Map<string, AgentProgressState> {
    const agentProgressStates = new Map<string, AgentProgressState>();

    for (const taskState of session.taskServerStates) {
      for (const agentChannelId of taskState.agentChannels) {
        const channelState = session.servers
          .find((s: ServerState) => s.serverId === taskState.serverId)
          ?.channels.find((c: ChannelState) => c.channelId === agentChannelId);
        
        if (channelState && channelState.agentRole) {
          const agentProgressState: AgentProgressState = {
            agentRole: channelState.agentRole,
            channelId: agentChannelId,
            taskId: taskState.taskId,
            status: taskState.status === 'active' ? 'idle' : 'completed',
            progressPercentage: taskState.status === 'completed' ? 100 : 0,
            lastUpdate: Date.now(),
            messageQueue: [],
            errorMessages: []
          };

          agentProgressStates.set(agentChannelId, agentProgressState);
        }
      }
    }

    return agentProgressStates;
  }
}