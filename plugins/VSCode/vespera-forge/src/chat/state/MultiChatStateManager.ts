/**
 * Multi-Chat State Manager for Enhanced Session Persistence
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

// State management interfaces
export interface MultiChatState {
  activeServerId?: string;
  activeChannelId?: string;
  serverNavigationState: ServerNavigationState;
  channelStates: Map<string, ChannelViewState>;
  agentProgressStates: Map<string, AgentProgressState>;
  unreadCounts: Map<string, number>;
  notificationSettings: NotificationSettings;
  uiPreferences: UIPreferences;
}

export interface ServerNavigationState {
  expandedServers: Set<string>;
  collapsedServers: Set<string>;
  pinnedServers: Set<string>;
  serverOrder: string[];
  lastAccessedServer?: string;
  navigationHistory: string[];
}

export interface ChannelViewState {
  channelId: string;
  serverId: string;
  isVisible: boolean;
  scrollPosition: number;
  inputText: string;
  mentionState?: MentionState;
  lastReadMessageId?: string;
  typingIndicators: Set<string>;
}

export interface AgentProgressState {
  agentRole: string;
  channelId: string;
  taskId: string;
  status: 'idle' | 'active' | 'waiting' | 'error' | 'completed';
  currentAction?: string;
  progressPercentage: number;
  lastUpdate: number;
  messageQueue: string[];
  errorMessages: string[];
}

export interface MentionState {
  mentionSuggestions: string[];
  activeMention?: string;
  mentionPosition: number;
}

export interface NotificationSettings {
  enableTaskProgress: boolean;
  enableAgentActivity: boolean;
  enableNewMessages: boolean;
  enableMentions: boolean;
  soundEnabled: boolean;
  desktopNotifications: boolean;
  quietHours: QuietHoursConfig;
}

export interface QuietHoursConfig {
  enabled: boolean;
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
}

export interface UIPreferences {
  theme: 'light' | 'dark' | 'auto';
  density: 'compact' | 'comfortable' | 'spacious';
  showAvatars: boolean;
  showTimestamps: boolean;
  groupMessages: boolean;
  showChannelList: boolean;
  showMemberList: boolean;
  fontSize: number;
  messagePreview: boolean;
}

export interface StateChangeEvent {
  type: 'serverAdded' | 'serverRemoved' | 'channelAdded' | 'channelRemoved' | 
        'serverActivated' | 'channelActivated' | 'agentProgressUpdated' | 
        'messageReceived' | 'preferencesUpdated';
  serverId?: string;
  channelId?: string;
  data?: any;
}

export class MultiChatStateManager {
  private currentState: MultiChatState;
  private stateChangeHandlers: Map<string, (event: StateChangeEvent) => void> = new Map();
  private stateUpdateTimer?: NodeJS.Timeout;
  private readonly STATE_SAVE_INTERVAL = 30000; // 30 seconds
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly persistenceManager: SecureSessionPersistenceManager,
    private readonly taskServerManager: TaskServerManager,
    private readonly logger: VesperaLogger,
    private readonly errorHandler: VesperaErrorHandler
  ) {
    // Initialize with default state
    this.currentState = this.createDefaultState();
    
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
      this.currentState = this.createDefaultState();
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
    if (this.currentState.activeServerId === serverId) {
      return;
    }

    const previousServerId = this.currentState.activeServerId;
    this.currentState.activeServerId = serverId;
    this.currentState.activeChannelId = undefined; // Reset channel when switching servers

    // Update navigation state
    this.currentState.serverNavigationState.lastAccessedServer = serverId;
    this.addToNavigationHistory(serverId);

    // Save state change
    await this.saveCurrentState();

    // Emit state change event
    this.emitStateChange({
      type: 'serverActivated',
      serverId,
      data: { previousServerId }
    });

    this.logger.debug('Active server changed', {
      fromServerId: previousServerId,
      toServerId: serverId
    });
  }

  /**
   * Set active channel
   */
  public async setActiveChannel(channelId: string, serverId?: string): Promise<void> {
    if (this.currentState.activeChannelId === channelId) {
      return;
    }

    const previousChannelId = this.currentState.activeChannelId;
    this.currentState.activeChannelId = channelId;

    // Set server if provided
    if (serverId && serverId !== this.currentState.activeServerId) {
      await this.setActiveServer(serverId);
    }

    // Update channel view state
    const channelState = this.currentState.channelStates.get(channelId);
    if (channelState) {
      channelState.isVisible = true;
      channelState.lastReadMessageId = undefined; // Will be set when messages are read
    }

    // Clear unread count for this channel
    this.currentState.unreadCounts.set(channelId, 0);

    // Save state change
    await this.saveCurrentState();

    // Emit state change event
    this.emitStateChange({
      type: 'channelActivated',
      channelId,
      serverId: serverId || this.currentState.activeServerId,
      data: { previousChannelId }
    });

    this.logger.debug('Active channel changed', {
      fromChannelId: previousChannelId,
      toChannelId: channelId,
      serverId: serverId || this.currentState.activeServerId
    });
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
      this.emitStateChange({
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
      // Create channel view state
      const channelViewState: ChannelViewState = {
        channelId: channel.channelId,
        serverId,
        isVisible: false,
        scrollPosition: 0,
        inputText: '',
        typingIndicators: new Set()
      };

      this.currentState.channelStates.set(channel.channelId, channelViewState);

      // Initialize unread count
      this.currentState.unreadCounts.set(channel.channelId, 0);

      // If this is an agent channel, initialize agent progress state
      if (channel.channelType === 'agent' && channel.agentRole) {
        const session = this.persistenceManager.getCurrentSession();
        const taskServerState = session?.taskServerStates.find(t => t.serverId === serverId);
        
        if (taskServerState) {
          const agentProgressState: AgentProgressState = {
            agentRole: channel.agentRole,
            channelId: channel.channelId,
            taskId: taskServerState.taskId,
            status: 'idle',
            progressPercentage: 0,
            lastUpdate: Date.now(),
            messageQueue: [],
            errorMessages: []
          };

          this.currentState.agentProgressStates.set(channel.channelId, agentProgressState);
        }
      }

      // Save state
      await this.saveCurrentState();

      // Emit event
      this.emitStateChange({
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
    const currentState = this.currentState.agentProgressStates.get(channelId);
    if (!currentState) {
      this.logger.warn('Agent progress state not found', { channelId });
      return;
    }

    // Update state
    const updatedState = {
      ...currentState,
      ...update,
      lastUpdate: Date.now()
    };

    this.currentState.agentProgressStates.set(channelId, updatedState);

    // Save state
    await this.saveCurrentState();

    // Emit event
    this.emitStateChange({
      type: 'agentProgressUpdated',
      channelId,
      data: { previousState: currentState, newState: updatedState }
    });

    this.logger.debug('Agent progress updated', {
      channelId,
      agentRole: updatedState.agentRole,
      status: updatedState.status,
      progress: updatedState.progressPercentage
    });
  }

  /**
   * Handle new message received
   */
  public async handleMessageReceived(message: MessageHistoryState): Promise<void> {
    try {
      // Update unread count if not in active channel
      if (this.currentState.activeChannelId !== message.channelId) {
        const currentCount = this.currentState.unreadCounts.get(message.channelId) || 0;
        this.currentState.unreadCounts.set(message.channelId, currentCount + 1);
      }

      // Update channel state
      const channelState = this.currentState.channelStates.get(message.channelId);
      if (channelState) {
        // If in active channel, mark as read
        if (this.currentState.activeChannelId === message.channelId) {
          channelState.lastReadMessageId = message.messageId;
        }
      }

      // Save state
      await this.saveCurrentState();

      // Emit event
      this.emitStateChange({
        type: 'messageReceived',
        channelId: message.channelId,
        serverId: message.serverId,
        data: { message }
      });

      this.logger.debug('Message received handled', {
        messageId: message.messageId,
        channelId: message.channelId,
        isActiveChannel: this.currentState.activeChannelId === message.channelId
      });

    } catch (error) {
      this.logger.error('Failed to handle message received', error, {
        messageId: message.messageId
      });
    }
  }

  /**
   * Update UI preferences
   */
  public async updateUIPreferences(preferences: Partial<UIPreferences>): Promise<void> {
    this.currentState.uiPreferences = {
      ...this.currentState.uiPreferences,
      ...preferences
    };

    await this.saveCurrentState();

    this.emitStateChange({
      type: 'preferencesUpdated',
      data: { preferences: this.currentState.uiPreferences }
    });

    this.logger.debug('UI preferences updated', { preferences });
  }

  /**
   * Update notification settings
   */
  public async updateNotificationSettings(settings: Partial<NotificationSettings>): Promise<void> {
    this.currentState.notificationSettings = {
      ...this.currentState.notificationSettings,
      ...settings
    };

    await this.saveCurrentState();

    this.emitStateChange({
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
    const key = `handler_${Date.now()}_${Math.random()}`;
    this.stateChangeHandlers.set(key, handler);
    
    return new vscode.Disposable(() => {
      this.stateChangeHandlers.delete(key);
    });
  }

  /**
   * Cleanup archived servers
   */
  public async cleanupArchivedServers(): Promise<void> {
    try {
      const session = this.persistenceManager.getCurrentSession();
      if (!session) return;

      const archivedServers = session.servers.filter(s => s.archived);
      const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago

      for (const server of archivedServers) {
        if (server.lastActivity < cutoffTime) {
          // Remove from navigation state
          const index = this.currentState.serverNavigationState.serverOrder.indexOf(server.serverId);
          if (index > -1) {
            this.currentState.serverNavigationState.serverOrder.splice(index, 1);
          }

          // Remove channel states
          for (const channel of server.channels) {
            this.currentState.channelStates.delete(channel.channelId);
            this.currentState.unreadCounts.delete(channel.channelId);
            this.currentState.agentProgressStates.delete(channel.channelId);
          }

          this.logger.info('Archived server cleaned up', {
            serverId: server.serverId,
            lastActivity: server.lastActivity
          });
        }
      }

      await this.saveCurrentState();

    } catch (error) {
      this.logger.error('Failed to cleanup archived servers', error);
    }
  }

  /**
   * Create default state
   */
  private createDefaultState(): MultiChatState {
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
   * Restore state from session
   */
  private async restoreStateFromSession(): Promise<void> {
    const session = this.persistenceManager.getCurrentSession();
    if (!session) {
      this.logger.debug('No session to restore state from');
      return;
    }

    // Restore server navigation
    this.currentState.serverNavigationState.serverOrder = 
      session.servers.map(s => s.serverId);

    // Restore user preferences
    if (session.userPreferences) {
      this.currentState.serverNavigationState.collapsedServers = 
        new Set(session.userPreferences.collapsedServers);
      
      if (session.userPreferences.notificationSettings) {
        this.currentState.notificationSettings = {
          ...this.currentState.notificationSettings,
          ...session.userPreferences.notificationSettings
        };
      }
    }

    // Restore active server/channel
    if (session.activeServerId) {
      this.currentState.activeServerId = session.activeServerId;
    }
    if (session.activeChannelId) {
      this.currentState.activeChannelId = session.activeChannelId;
    }

    // Initialize channel states
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
        
        this.currentState.channelStates.set(channel.channelId, channelViewState);
        this.currentState.unreadCounts.set(channel.channelId, 0);
      }
    }

    // Initialize agent progress states
    for (const taskState of session.taskServerStates) {
      for (const agentChannelId of taskState.agentChannels) {
        const channelState = session.servers
          .find(s => s.serverId === taskState.serverId)
          ?.channels.find(c => c.channelId === agentChannelId);
        
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

          this.currentState.agentProgressStates.set(agentChannelId, agentProgressState);
        }
      }
    }

    this.logger.info('State restored from session', {
      servers: session.servers.length,
      channelStates: this.currentState.channelStates.size,
      agentStates: this.currentState.agentProgressStates.size
    });
  }

  /**
   * Save current state to session
   */
  private async saveCurrentState(): Promise<void> {
    try {
      const session = this.persistenceManager.getCurrentSession();
      if (!session) {
        this.logger.warn('No current session to save state to');
        return;
      }

      // Update session with current state
      session.activeServerId = this.currentState.activeServerId;
      session.activeChannelId = this.currentState.activeChannelId;
      
      // Update user preferences
      session.userPreferences = {
        ...session.userPreferences,
        collapsedServers: Array.from(this.currentState.serverNavigationState.collapsedServers),
        notificationSettings: {
          taskProgress: this.currentState.notificationSettings.enableTaskProgress,
          agentActivity: this.currentState.notificationSettings.enableAgentActivity,
          newMessages: this.currentState.notificationSettings.enableNewMessages
        }
      };

      // Save session
      await this.persistenceManager.saveSession(session);

    } catch (error) {
      this.logger.error('Failed to save current state to session', error);
    }
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
    this.disposables.push(
      this.taskServerManager.onServerEvent('taskServerCreated', async (event) => {
        if (event.data?.server) {
          await this.addServer(event.data.server);
        }
      }),
      
      this.taskServerManager.onServerEvent('agentChannelAdded', async (event) => {
        if (event.data?.channel && event.serverId) {
          await this.addChannel(event.data.channel, event.serverId);
        }
      }),
      
      this.taskServerManager.onServerEvent('taskProgressUpdated', async (event) => {
        const taskState = this.taskServerManager.getTaskServer(event.taskId);
        if (taskState) {
          // Update all agent channels for this task
          for (const channelId of taskState.agentChannels) {
            const agentUpdate = event.data?.agentUpdates?.find((u: any) => u.channelId === channelId);
            if (agentUpdate) {
              await this.updateAgentProgress(channelId, {
                status: agentUpdate.status,
                currentAction: agentUpdate.currentAction,
                progressPercentage: event.data.progress || 0
              });
            }
          }
        }
      })
    );
  }

  /**
   * Setup periodic state saving
   */
  private setupPeriodicStateSaving(): void {
    this.stateUpdateTimer = setInterval(async () => {
      await this.saveCurrentState();
    }, this.STATE_SAVE_INTERVAL);
  }

  /**
   * Add server to navigation history
   */
  private addToNavigationHistory(serverId: string): void {
    const history = this.currentState.serverNavigationState.navigationHistory;
    
    // Remove if already exists
    const index = history.indexOf(serverId);
    if (index > -1) {
      history.splice(index, 1);
    }
    
    // Add to front
    history.unshift(serverId);
    
    // Keep only last 10
    if (history.length > 10) {
      history.splice(10);
    }
  }

  /**
   * Emit state change event
   */
  private emitStateChange(event: StateChangeEvent): void {
    for (const handler of this.stateChangeHandlers.values()) {
      try {
        handler(event);
      } catch (error) {
        this.logger.error('State change handler error', error, {
          eventType: event.type
        });
      }
    }
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    if (this.stateUpdateTimer) {
      clearInterval(this.stateUpdateTimer);
      this.stateUpdateTimer = undefined;
    }
    
    this.disposables.forEach(d => d.dispose());
    this.disposables.length = 0;
    
    this.stateChangeHandlers.clear();
    
    this.logger.info('MultiChatStateManager disposed');
  }
}