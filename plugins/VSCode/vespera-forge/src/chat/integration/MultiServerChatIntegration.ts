/**
 * Multi-Server Chat Integration
 * 
 * Integrates the Discord-like multi-server chat interface with:
 * - Notification system for real-time alerts
 * - Task server management for automatic server creation
 * - Agent progress tracking for channel status updates
 * - Direct message system for private conversations
 * - Session persistence for cross-restart state management
 */

import * as vscode from 'vscode';
import { VesperaLogger } from '../../core/logging/VesperaLogger';
import { VesperaErrorHandler } from '../../core/error-handling/VesperaErrorHandler';

// Import notification system
import { 
  VesperaNotificationSystem,
  NotificationLevel,
  NotificationType
} from '../../notifications/index';
import { AgentType, OperationStatus } from '../../notifications/AgentProgressNotifier';

// Import chat systems
import { TaskServerManager } from '../servers/TaskServerManager';
import { MultiChatStateManager } from '../state/MultiChatStateManager';
import { SecureSessionPersistenceManager } from '../persistence/SecureSessionPersistenceManager';
import { EnhancedChatWebViewProvider } from '../ui/webview/EnhancedChatWebViewProvider';

// Event interfaces
export interface DirectMessageData {
  messageId: string;
  content: string;
  fromUserId: string;
  toUserId: string;
  timestamp: number;
}

export interface MultiServerChatEvent {
  type: 'serverCreated' | 'serverArchived' | 'channelCreated' | 'messageReceived' | 
        'agentStatusChanged' | 'taskProgressUpdated' | 'directMessageReceived';
  serverId?: string;
  channelId?: string;
  taskId?: string;
  agentId?: string;
  data: any;
  timestamp: number;
}

export interface DirectMessageData {
  messageId: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  content: string;
  timestamp: number;
  messageType: 'text' | 'file' | 'system';
  encrypted?: boolean;
}

export interface AgentStatusChangeData {
  agentId: string;
  agentRole: string;
  previousStatus: string;
  currentStatus: 'idle' | 'active' | 'waiting' | 'error' | 'completed';
  progress: number;
  currentAction?: string;
  channelId: string;
  serverId: string;
}

export interface TaskProgressUpdateData {
  taskId: string;
  serverId: string;
  previousProgress: number;
  currentProgress: number;
  previousPhase?: string;
  currentPhase?: string;
  milestone?: string;
  agentUpdates: AgentStatusChangeData[];
}

export class MultiServerChatIntegration implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private eventHandlers: Map<string, (event: MultiServerChatEvent) => void> = new Map();
  private directMessageHandlers: Map<string, (dm: DirectMessageData) => void> = new Map();
  private initialized = false;

  constructor(
    private readonly notificationSystem: VesperaNotificationSystem,
    private readonly taskServerManager: TaskServerManager,
    private readonly stateManager: MultiChatStateManager,
    private readonly persistenceManager: SecureSessionPersistenceManager,
    private readonly webViewProvider: EnhancedChatWebViewProvider,
    private readonly logger: VesperaLogger,
    private readonly errorHandler: VesperaErrorHandler
  ) {}

  /**
   * Initialize multi-server chat integration
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.logger.info('Initializing multi-server chat integration');

      // Setup event listeners for all integrated systems
      this.setupTaskServerEventListeners();
      this.setupNotificationEventListeners();
      this.setupStateChangeEventListeners();
      this.setupAgentProgressEventListeners();
      this.setupDirectMessageEventListeners();

      // Register integration with notification system
      await this.registerNotificationHandlers();

      // Setup real-time update polling
      this.startRealTimeUpdates();

      this.initialized = true;
      this.logger.info('Multi-server chat integration initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize multi-server chat integration', error);
      await this.errorHandler.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Setup task server event listeners
   */
  private setupTaskServerEventListeners(): void {
    // Listen for task server creation
    const taskServerDisposable = this.taskServerManager.onServerEvent('taskServerCreated', (event) => {
      this.handleTaskServerCreated(event);
    });
    this.disposables.push(taskServerDisposable);

    // Listen for agent channel addition
    const agentChannelDisposable = this.taskServerManager.onServerEvent('agentChannelAdded', (event) => {
      this.handleAgentChannelAdded(event);
    });
    this.disposables.push(agentChannelDisposable);

    // Listen for task progress updates
    const progressDisposable = this.taskServerManager.onServerEvent('taskProgressUpdated', (event) => {
      this.handleTaskProgressUpdated(event);
    });
    this.disposables.push(progressDisposable);

    // Listen for task server archival
    const archiveDisposable = this.taskServerManager.onServerEvent('taskServerArchived', (event) => {
      this.handleTaskServerArchived(event);
    });
    this.disposables.push(archiveDisposable);
  }

  /**
   * Setup notification event listeners
   */
  private setupNotificationEventListeners(): void {
    // Listen for notification system events that should trigger chat updates
    // This would be implemented based on the notification system's event interface
  }

  /**
   * Setup state change event listeners
   */
  private setupStateChangeEventListeners(): void {
    // Listen for multi-chat state changes
    const stateDisposable = this.stateManager.onStateChange((change) => {
      this.handleStateChange(change);
    });
    this.disposables.push(stateDisposable);
  }

  /**
   * Setup agent progress event listeners
   */
  private setupAgentProgressEventListeners(): void {
    // This would integrate with the agent progress tracking system
    // to receive real-time agent status updates
  }

  /**
   * Setup direct message event listeners
   */
  private setupDirectMessageEventListeners(): void {
    // Setup handlers for direct message events
  }

  /**
   * Register notification handlers with the notification system
   */
  private async registerNotificationHandlers(): Promise<void> {
    try {
      // Register chat-specific notification types
      await this.notificationSystem.secureNotificationManager.notify({
        title: 'Multi-Server Chat',
        message: 'Enhanced chat system with task integration is ready',
        type: NotificationType.SYSTEM_STATUS,
        level: NotificationLevel.INFO,
        data: {
          chatIntegrationEnabled: true,
          taskServerSupport: true,
          directMessageSupport: true
        },
        showInToast: false
      });

    } catch (error) {
      this.logger.error('Failed to register notification handlers', error);
    }
  }

  /**
   * Start real-time updates for chat interface
   */
  private startRealTimeUpdates(): void {
    // Poll for agent status updates every 5 seconds
    const agentStatusInterval = setInterval(async () => {
      await this.updateAgentStatuses();
    }, 5000);

    // Poll for task progress updates every 10 seconds
    const taskProgressInterval = setInterval(async () => {
      await this.updateTaskProgresses();
    }, 10000);

    // Cleanup intervals on disposal
    this.disposables.push({
      dispose: () => {
        clearInterval(agentStatusInterval);
        clearInterval(taskProgressInterval);
      }
    });
  }

  /**
   * Handle task server created event
   */
  private async handleTaskServerCreated(event: any): Promise<void> {
    try {
      const { taskId, serverId, data } = event;
      
      // Emit multi-server chat event
      this.emitEvent({
        type: 'serverCreated',
        serverId,
        taskId,
        data: data.server,
        timestamp: Date.now()
      });

      // Show notification for new task server
      await this.notificationSystem.secureNotificationManager.notify({
        title: 'New Task Server Created',
        message: `Task server "${data.server.serverName}" has been created`,
        type: NotificationType.TASK_UPDATE,
        level: NotificationLevel.INFO,
        data: {
          taskId,
          serverId,
          serverName: data.server.serverName,
          channelCount: data.server.channels.length
        },
        showInToast: true
      });

      // Update webview with new server
      await this.webViewProvider.reveal();

      this.logger.info('Task server created event handled', { taskId, serverId });

    } catch (error) {
      this.logger.error('Failed to handle task server created event', error);
    }
  }

  /**
   * Handle agent channel added event
   */
  private async handleAgentChannelAdded(event: any): Promise<void> {
    try {
      const { taskId, serverId, data } = event;
      
      // Emit multi-server chat event
      this.emitEvent({
        type: 'channelCreated',
        serverId,
        channelId: data.channel.channelId,
        taskId,
        data: data.channel,
        timestamp: Date.now()
      });

      // Show notification for new agent channel
      await this.notificationSystem.agentProgressNotifier.startOperation(
        `${taskId}_${data.agentConfig.agentRole}`,
        `Agent: ${data.agentConfig.agentRole}`,
        `${data.agentConfig.agentName} - Agent execution`,
        AgentType.COORDINATION,
        {
          expectedDuration: 300000, // 5 minutes
          showStartNotification: true
        }
      );

      this.logger.info('Agent channel added event handled', { 
        taskId, 
        serverId, 
        channelId: data.channel.channelId,
        agentRole: data.agentConfig.agentRole
      });

    } catch (error) {
      this.logger.error('Failed to handle agent channel added event', error);
    }
  }

  /**
   * Handle task progress updated event
   */
  private async handleTaskProgressUpdated(event: any): Promise<void> {
    try {
      const { taskId, serverId, data } = event;
      const progressData = data as TaskProgressUpdateData;
      
      // Emit multi-server chat event
      this.emitEvent({
        type: 'taskProgressUpdated',
        serverId,
        taskId,
        data: progressData,
        timestamp: Date.now()
      });

      // Show milestone notifications
      if (progressData.milestone) {
        await this.notificationSystem.secureNotificationManager.notify({
          title: 'Task Milestone Reached',
          message: `${progressData.milestone} (${progressData.currentProgress}% complete)`,
          type: NotificationType.TASK_UPDATE,
          level: NotificationLevel.INFO,
          data: {
            taskId,
            serverId,
            milestone: progressData.milestone,
            progress: progressData.currentProgress
          },
          showInToast: true
        });
      }

      // Update agent progress notifications
      for (const agentUpdate of progressData.agentUpdates) {
        await this.updateAgentProgressNotification(agentUpdate);
      }

      this.logger.debug('Task progress updated event handled', { 
        taskId, 
        serverId, 
        progress: progressData.currentProgress 
      });

    } catch (error) {
      this.logger.error('Failed to handle task progress updated event', error);
    }
  }

  /**
   * Handle task server archived event
   */
  private async handleTaskServerArchived(event: any): Promise<void> {
    try {
      const { taskId, serverId } = event;
      
      // Emit multi-server chat event
      this.emitEvent({
        type: 'serverArchived',
        serverId,
        taskId,
        data: event.data,
        timestamp: Date.now()
      });

      // Show task completion notification
      await this.notificationSystem.secureNotificationManager.notify({
        title: 'Task Server Archived',
        message: 'Task has been completed and server archived',
        type: NotificationType.TASK_UPDATE,
        level: NotificationLevel.SUCCESS,
        data: {
          taskId,
          serverId,
          completedAt: event.data.taskServerState.completedAt
        },
        showInToast: true
      });

      this.logger.info('Task server archived event handled', { taskId, serverId });

    } catch (error) {
      this.logger.error('Failed to handle task server archived event', error);
    }
  }

  /**
   * Handle state change events
   */
  private async handleStateChange(change: any): Promise<void> {
    try {
      // Handle server/channel switches
      if (change.type === 'activeServerChanged') {
        await this.handleActiveServerChanged(change.serverId);
      } else if (change.type === 'activeChannelChanged') {
        await this.handleActiveChannelChanged(change.channelId, change.serverId);
      }

    } catch (error) {
      this.logger.error('Failed to handle state change', error);
    }
  }

  /**
   * Handle active server changed
   */
  private async handleActiveServerChanged(serverId: string): Promise<void> {
    // Update context for the active server
    // This could trigger agent status updates or channel list refreshes
    this.logger.debug('Active server changed', { serverId });
  }

  /**
   * Handle active channel changed
   */
  private async handleActiveChannelChanged(channelId: string, serverId: string): Promise<void> {
    // Clear unread counts for the selected channel
    // This could trigger message history loading
    this.logger.debug('Active channel changed', { channelId, serverId });
  }

  /**
   * Update agent statuses for all active task servers
   */
  private async updateAgentStatuses(): Promise<void> {
    try {
      const activeTaskServers = this.taskServerManager.getActiveTaskServers();
      
      for (const taskServer of activeTaskServers) {
        // This would query the actual agent status from the MCP system
        // For now, simulate status updates
        await this.simulateAgentStatusUpdate(taskServer);
      }

    } catch (error) {
      this.logger.error('Failed to update agent statuses', error);
    }
  }

  /**
   * Update task progresses for all active task servers
   */
  private async updateTaskProgresses(): Promise<void> {
    try {
      const activeTaskServers = this.taskServerManager.getActiveTaskServers();
      
      for (const taskServer of activeTaskServers) {
        // This would query the actual task progress from the MCP system
        // For now, simulate progress updates
        await this.simulateTaskProgressUpdate(taskServer);
      }

    } catch (error) {
      this.logger.error('Failed to update task progresses', error);
    }
  }

  /**
   * Simulate agent status update (for development)
   */
  private async simulateAgentStatusUpdate(taskServer: any): Promise<void> {
    // Simulate random agent status changes
    const agentStatuses = ['idle', 'active', 'waiting', 'completed'];
    const randomStatus = agentStatuses[Math.floor(Math.random() * agentStatuses.length)];
    
    const agentUpdate: AgentStatusChangeData = {
      agentId: `${taskServer.taskType}_agent`,
      agentRole: taskServer.taskType || 'unknown',
      previousStatus: 'idle',
      currentStatus: randomStatus as any,
      progress: Math.floor(Math.random() * 100),
      currentAction: 'Processing task...',
      channelId: taskServer.agentChannels[0] || 'unknown',
      serverId: taskServer.serverId
    };

    // Emit agent status change event
    this.emitEvent({
      type: 'agentStatusChanged',
      serverId: taskServer.serverId,
      channelId: agentUpdate.channelId,
      agentId: agentUpdate.agentId,
      data: agentUpdate,
      timestamp: Date.now()
    });
  }

  /**
   * Simulate task progress update (for development)
   */
  private async simulateTaskProgressUpdate(taskServer: any): Promise<void> {
    // Simulate random progress updates
    const currentProgress = Math.min(100, Math.floor(Math.random() * 100) + 50);
    
    const progressUpdate: TaskProgressUpdateData = {
      taskId: taskServer.taskId,
      serverId: taskServer.serverId,
      previousProgress: 0,
      currentProgress,
      currentPhase: taskServer.phase,
      agentUpdates: []
    };

    // Add milestone if significant progress
    if (currentProgress >= 75 && currentProgress < 80) {
      progressUpdate.milestone = 'Nearing completion';
    } else if (currentProgress === 100) {
      progressUpdate.milestone = 'Task completed successfully';
    }

    // Emit task progress event
    this.emitEvent({
      type: 'taskProgressUpdated',
      serverId: taskServer.serverId,
      taskId: taskServer.taskId,
      data: progressUpdate,
      timestamp: Date.now()
    });
  }

  /**
   * Update agent progress notification
   */
  private async updateAgentProgressNotification(agentUpdate: AgentStatusChangeData): Promise<void> {
    try {
      await this.notificationSystem.agentProgressNotifier.updateProgress({
        operationId: `${agentUpdate.serverId}_${agentUpdate.agentId}`,
        progress: agentUpdate.progress,
        status: agentUpdate.currentStatus === 'completed' ? OperationStatus.COMPLETED : 
                agentUpdate.currentStatus === 'failed' ? OperationStatus.FAILED : OperationStatus.PROGRESS,
        currentAction: agentUpdate.currentAction || 'Working',
        message: `Agent ${agentUpdate.agentRole}: ${agentUpdate.currentAction || agentUpdate.currentStatus}`
      });

      // Show completion notification
      if (agentUpdate.currentStatus === 'completed') {
        await this.notificationSystem.secureNotificationManager.notify({
          title: 'Agent Completed',
          message: `${agentUpdate.agentRole} agent has completed its task`,
          type: NotificationType.AGENT_STATUS,
          level: NotificationLevel.SUCCESS,
          data: {
            agentId: agentUpdate.agentId,
            agentRole: agentUpdate.agentRole,
            channelId: agentUpdate.channelId,
            serverId: agentUpdate.serverId
          },
          showInToast: true
        });
      }

    } catch (error) {
      this.logger.error('Failed to update agent progress notification', error);
    }
  }

  /**
   * Send direct message
   */
  public async sendDirectMessage(dmData: DirectMessageData): Promise<void> {
    try {
      // Store direct message in persistence
      await this.persistenceManager.addDirectMessage(dmData);

      // Emit direct message event
      this.emitEvent({
        type: 'directMessageReceived',
        data: dmData,
        timestamp: dmData.timestamp
      });

      // Show notification for direct message
      // Create a direct message chat event and handle it
      const directMessageEvent = {
        type: 'direct_message' as const,
        serverId: 'direct_messages',
        channelId: `dm_${dmData.senderId}_${dmData.receiverId}`,
        userId: dmData.senderId,
        timestamp: dmData.timestamp,
        data: {
          messageId: dmData.messageId,
          content: dmData.content,
          senderName: dmData.senderName,
          encrypted: dmData.encrypted || false
        }
      };
      
      await this.notificationSystem.multiChatNotificationManager.handleChatEvent(directMessageEvent);

      this.logger.info('Direct message sent', {
        messageId: dmData.messageId,
        senderId: dmData.senderId,
        receiverId: dmData.receiverId
      });

    } catch (error) {
      this.logger.error('Failed to send direct message', error);
      throw error;
    }
  }

  /**
   * Register event handler
   */
  public onEvent(
    eventType: string, 
    handler: (event: MultiServerChatEvent) => void
  ): vscode.Disposable {
    const handlerId = `${eventType}_${Date.now()}`;
    this.eventHandlers.set(handlerId, handler);
    
    return new vscode.Disposable(() => {
      this.eventHandlers.delete(handlerId);
    });
  }

  /**
   * Register direct message handler
   */
  public onDirectMessage(
    userId: string,
    handler: (dm: DirectMessageData) => void
  ): vscode.Disposable {
    this.directMessageHandlers.set(userId, handler);
    
    return new vscode.Disposable(() => {
      this.directMessageHandlers.delete(userId);
    });
  }

  /**
   * Emit event to all registered handlers
   */
  private emitEvent(event: MultiServerChatEvent): void {
    for (const handler of this.eventHandlers.values()) {
      try {
        handler(event);
      } catch (error) {
        this.logger.error('Event handler error', error, {
          eventType: event.type,
          serverId: event.serverId,
          channelId: event.channelId
        });
      }
    }
  }

  /**
   * Get system status
   */
  public getSystemStatus(): {
    initialized: boolean;
    activeTaskServers: number;
    totalEventHandlers: number;
    lastUpdate: number;
    integrationStatus: {
      notifications: boolean;
      taskServers: boolean;
      stateManager: boolean;
      persistence: boolean;
    };
  } {
    const activeTaskServers = this.taskServerManager.getActiveTaskServers();
    
    return {
      initialized: this.initialized,
      activeTaskServers: activeTaskServers.length,
      totalEventHandlers: this.eventHandlers.size + this.directMessageHandlers.size,
      lastUpdate: Date.now(),
      integrationStatus: {
        notifications: !!this.notificationSystem,
        taskServers: !!this.taskServerManager,
        stateManager: !!this.stateManager,
        persistence: !!this.persistenceManager
      }
    };
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    this.logger.info('MultiServerChatIntegration disposing', {
      disposablesCount: this.disposables.length,
      eventHandlersCount: this.eventHandlers.size
    });

    this.disposables.forEach(d => d.dispose());
    this.disposables.length = 0;
    
    this.eventHandlers.clear();
    this.directMessageHandlers.clear();
    
    this.initialized = false;
    
    this.logger.info('MultiServerChatIntegration disposed successfully');
  }
}