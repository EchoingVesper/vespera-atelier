/**
 * Chat Event Handlers Module
 * 
 * Handles all event-driven state updates and task server interactions including:
 * - Task server event processing
 * - Agent progress updates
 * - Message handling and unread count management
 * - State change event emission and subscription
 * 
 * This module isolates all event handling logic, providing clean separation
 * between state management and event-driven updates.
 */

import * as vscode from 'vscode';
import { VesperaLogger } from '../../core/logging/VesperaLogger';
import { TaskServerManager } from '../servers/TaskServerManager';
import { MessageHistoryState } from '../persistence/SecureSessionPersistenceManager';
import { 
  MultiChatState,
  StateChangeEvent,
  AgentProgressState,
  AgentUpdate
} from './MultiChatStateTypes';

/**
 * Handles all event processing and state updates for the multi-chat system
 */
export class ChatEventHandlers {
  private stateChangeHandlers: Map<string, (event: StateChangeEvent) => void> = new Map();
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly taskServerManager: TaskServerManager,
    private readonly logger: VesperaLogger
  ) {}

  /**
   * Setup task server event handlers
   */
  public setupTaskServerEventHandlers(
    onServerAdded: (server: any) => Promise<void>,
    onChannelAdded: (channel: any, serverId: string) => Promise<void>,
    onTaskProgressUpdated: (taskId: string, progress: any) => Promise<void>
  ): void {
    this.disposables.push(
      this.taskServerManager.onServerEvent('taskServerCreated', async (event) => {
        try {
          if (event.data?.server) {
            await onServerAdded(event.data.server);
            this.logger.debug('Task server created event handled', {
              serverId: event.data.server.serverId
            });
          }
        } catch (error) {
          this.logger.error('Failed to handle taskServerCreated event', error, {
            eventData: event.data
          });
        }
      }),
      
      this.taskServerManager.onServerEvent('agentChannelAdded', async (event) => {
        try {
          if (event.data?.channel && event.serverId) {
            await onChannelAdded(event.data.channel, event.serverId);
            this.logger.debug('Agent channel added event handled', {
              channelId: event.data.channel.channelId,
              serverId: event.serverId
            });
          }
        } catch (error) {
          this.logger.error('Failed to handle agentChannelAdded event', error, {
            eventData: event.data,
            serverId: event.serverId
          });
        }
      }),
      
      this.taskServerManager.onServerEvent('taskProgressUpdated', async (event) => {
        try {
          await onTaskProgressUpdated(event.taskId, event.data);
          this.logger.debug('Task progress updated event handled', {
            taskId: event.taskId,
            progress: event.data?.progress
          });
        } catch (error) {
          this.logger.error('Failed to handle taskProgressUpdated event', error, {
            taskId: event.taskId,
            eventData: event.data
          });
        }
      })
    );
  }

  /**
   * Handle agent progress update
   */
  public async handleAgentProgressUpdate(
    currentState: MultiChatState,
    channelId: string,
    update: Partial<AgentProgressState>,
    onStateChanged: (event: StateChangeEvent) => void,
    onStateSaved: () => Promise<void>
  ): Promise<void> {
    try {
      const currentAgentState = currentState.agentProgressStates.get(channelId);
      if (!currentAgentState) {
        this.logger.warn('Agent progress state not found for update', { channelId });
        return;
      }

      const previousState = { ...currentAgentState };
      
      // Update state
      const updatedState = {
        ...currentAgentState,
        ...update,
        lastUpdate: Date.now()
      };

      // Validate status transition
      if (update.status && !this.isValidStatusTransition(currentAgentState.status, update.status)) {
        this.logger.warn('Invalid agent status transition', {
          channelId,
          fromStatus: currentAgentState.status,
          toStatus: update.status
        });
        return;
      }

      // Validate progress percentage
      if (update.progressPercentage !== undefined) {
        updatedState.progressPercentage = Math.min(100, Math.max(0, update.progressPercentage));
      }

      currentState.agentProgressStates.set(channelId, updatedState);

      // Save state
      await onStateSaved();

      // Emit state change event
      onStateChanged({
        type: 'agentProgressUpdated',
        channelId,
        data: { previousState, newState: updatedState }
      });

      this.logger.debug('Agent progress updated', {
        channelId,
        agentRole: updatedState.agentRole,
        status: updatedState.status,
        progress: updatedState.progressPercentage
      });

    } catch (error) {
      this.logger.error('Failed to handle agent progress update', error, {
        channelId,
        update
      });
      throw error;
    }
  }

  /**
   * Handle new message received
   */
  public async handleMessageReceived(
    currentState: MultiChatState,
    message: MessageHistoryState,
    onStateChanged: (event: StateChangeEvent) => void,
    onStateSaved: () => Promise<void>
  ): Promise<void> {
    try {
      let stateModified = false;

      // Update unread count if not in active channel
      if (currentState.activeChannelId !== message.channelId) {
        const currentCount = currentState.unreadCounts.get(message.channelId) || 0;
        currentState.unreadCounts.set(message.channelId, currentCount + 1);
        stateModified = true;
      }

      // Update channel state
      const channelState = currentState.channelStates.get(message.channelId);
      if (channelState) {
        // If in active channel, mark as read
        if (currentState.activeChannelId === message.channelId) {
          channelState.lastReadMessageId = message.messageId;
          stateModified = true;
        }
      }

      if (stateModified) {
        // Save state
        await onStateSaved();

        // Emit event
        onStateChanged({
          type: 'messageReceived',
          channelId: message.channelId,
          serverId: message.serverId,
          data: { message }
        });
      }

      this.logger.debug('Message received handled', {
        messageId: message.messageId,
        channelId: message.channelId,
        isActiveChannel: currentState.activeChannelId === message.channelId,
        stateModified
      });

    } catch (error) {
      this.logger.error('Failed to handle message received', error, {
        messageId: message.messageId,
        channelId: message.channelId
      });
    }
  }

  /**
   * Handle task progress updates from task server
   */
  public async handleTaskProgressUpdated(
    _currentState: MultiChatState,
    taskId: string,
    progressData: any,
    onAgentProgressUpdate: (channelId: string, update: Partial<AgentProgressState>) => Promise<void>
  ): Promise<void> {
    try {
      const taskState = this.taskServerManager.getTaskServer(taskId);
      if (!taskState) {
        this.logger.warn('Task server not found for progress update', { taskId });
        return;
      }

      // Update all agent channels for this task
      const updatePromises: Promise<void>[] = [];

      for (const channelId of taskState.agentChannels) {
        const agentUpdate = progressData?.agentUpdates?.find((u: AgentUpdate) => u.channelId === channelId);
        
        if (agentUpdate) {
          const progressUpdate: Partial<AgentProgressState> = {
            status: agentUpdate.status,
            currentAction: agentUpdate.currentAction,
            progressPercentage: agentUpdate.progress ?? progressData.progress ?? 0
          };

          updatePromises.push(onAgentProgressUpdate(channelId, progressUpdate));
        } else if (progressData.progress !== undefined) {
          // Apply general progress to all agents if no specific update
          updatePromises.push(onAgentProgressUpdate(channelId, {
            progressPercentage: progressData.progress
          }));
        }
      }

      await Promise.all(updatePromises);

      this.logger.debug('Task progress updates applied', {
        taskId,
        channelCount: updatePromises.length,
        progress: progressData.progress
      });

    } catch (error) {
      this.logger.error('Failed to handle task progress update', error, {
        taskId,
        progressData
      });
    }
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
   * Emit state change event to all registered handlers
   */
  public emitStateChange(event: StateChangeEvent): void {
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
   * Handle navigation history updates
   */
  public updateNavigationHistory(
    currentState: MultiChatState,
    serverId: string
  ): void {
    const history = currentState.serverNavigationState.navigationHistory;
    
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

    this.logger.debug('Navigation history updated', {
      serverId,
      historyLength: history.length
    });
  }

  /**
   * Handle server activation with state updates
   */
  public async handleServerActivation(
    currentState: MultiChatState,
    serverId: string,
    onStateChanged: (event: StateChangeEvent) => void,
    onStateSaved: () => Promise<void>
  ): Promise<void> {
    if (currentState.activeServerId === serverId) {
      return;
    }

    const previousServerId = currentState.activeServerId;
    currentState.activeServerId = serverId;
    currentState.activeChannelId = undefined; // Reset channel when switching servers

    // Update navigation state
    currentState.serverNavigationState.lastAccessedServer = serverId;
    this.updateNavigationHistory(currentState, serverId);

    // Save state change
    await onStateSaved();

    // Emit state change event
    onStateChanged({
      type: 'serverActivated',
      serverId,
      data: { previousServerId }
    });

    this.logger.debug('Server activation handled', {
      fromServerId: previousServerId,
      toServerId: serverId
    });
  }

  /**
   * Handle channel activation with state updates
   */
  public async handleChannelActivation(
    currentState: MultiChatState,
    channelId: string,
    serverId: string | undefined,
    onServerActivation: (serverId: string) => Promise<void>,
    onStateChanged: (event: StateChangeEvent) => void,
    onStateSaved: () => Promise<void>
  ): Promise<void> {
    if (currentState.activeChannelId === channelId) {
      return;
    }

    const previousChannelId = currentState.activeChannelId;
    currentState.activeChannelId = channelId;

    // Set server if provided and different
    if (serverId && serverId !== currentState.activeServerId) {
      await onServerActivation(serverId);
    }

    // Update channel view state
    const channelState = currentState.channelStates.get(channelId);
    if (channelState) {
      channelState.isVisible = true;
      channelState.lastReadMessageId = undefined; // Will be set when messages are read
    }

    // Clear unread count for this channel
    currentState.unreadCounts.set(channelId, 0);

    // Save state change
    await onStateSaved();

    // Emit state change event
    onStateChanged({
      type: 'channelActivated',
      channelId,
      serverId: serverId || currentState.activeServerId,
      data: { previousChannelId }
    });

    this.logger.debug('Channel activation handled', {
      fromChannelId: previousChannelId,
      toChannelId: channelId,
      serverId: serverId || currentState.activeServerId
    });
  }

  /**
   * Dispose event handlers
   */
  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables.length = 0;
    
    this.stateChangeHandlers.clear();
    
    this.logger.debug('ChatEventHandlers disposed');
  }

  // Private helper methods

  private isValidStatusTransition(
    fromStatus: AgentProgressState['status'], 
    toStatus: AgentProgressState['status']
  ): boolean {
    // Define valid status transitions
    const validTransitions: Record<string, string[]> = {
      'idle': ['active', 'error'],
      'active': ['idle', 'waiting', 'error', 'completed'],
      'waiting': ['active', 'idle', 'error'],
      'error': ['idle', 'active'],
      'completed': ['idle'] // Can restart
    };

    return validTransitions[fromStatus]?.includes(toStatus) ?? false;
  }
}