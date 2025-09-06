/**
 * Task Server Notification Integration
 * 
 * Integrates with the revolutionary task-server architecture to provide
 * comprehensive notifications for server creation, agent deployment,
 * task completion, and cross-task coordination events.
 */

import * as vscode from 'vscode';
import { VesperaLogger } from '../core/logging/VesperaLogger';
import { VesperaErrorHandler } from '../core/error-handling/VesperaErrorHandler';
import { SecurityEnhancedVesperaCoreServices } from '../core/security/SecurityEnhancedCoreServices';
import { 
  TaskServerManager, 
  TaskServerEvent,
  TaskProgressUpdate
} from '../chat/servers/TaskServerManager';
import { 
  SecureNotificationManager, 
  NotificationLevel, 
  NotificationType
} from './SecureNotificationManager';
import { 
  AgentProgressNotifier,
  AgentType,
  OperationStatus
} from './AgentProgressNotifier';

export enum TaskServerNotificationEvent {
  SERVER_CREATED = 'server_created',
  SERVER_ARCHIVED = 'server_archived',
  AGENT_DEPLOYED = 'agent_deployed',
  AGENT_COMPLETED = 'agent_completed',
  TASK_MILESTONE = 'task_milestone',
  PHASE_COMPLETED = 'phase_completed',
  CROSS_TASK_EVENT = 'cross_task_event',
  SERVER_ERROR = 'server_error'
}

export interface TaskServerNotificationConfig {
  enabled: boolean;
  serverLifecycle: {
    showCreationNotifications: boolean;
    showArchivalNotifications: boolean;
    showMajorTasksOnly: boolean;
  };
  agentEvents: {
    showDeploymentNotifications: boolean;
    showCompletionNotifications: boolean;
    showProgressUpdates: boolean;
  };
  taskProgress: {
    showMilestoneNotifications: boolean;
    showPhaseCompletions: boolean;
    progressThreshold: number; // Only show notifications for progress >= this value
  };
  coordination: {
    showCrossTaskEvents: boolean;
    showMultiPhaseWorkflows: boolean;
  };
  filtering: {
    excludedTaskTypes: string[];
    minimumPriority: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface TaskServerNotification {
  eventType: TaskServerNotificationEvent;
  taskId: string;
  serverId: string;
  taskType?: string;
  phase?: string;
  priority?: string;
  agentRole?: string;
  message: string;
  data?: any;
  timestamp: number;
}

export class TaskServerNotificationIntegration implements vscode.Disposable {
  private static instance: TaskServerNotificationIntegration;
  private initialized = false;
  private config: TaskServerNotificationConfig;
  private disposables: vscode.Disposable[] = [];
  private taskServerSubscription?: vscode.Disposable;
  private activeTaskNotifications: Map<string, Set<string>> = new Map();

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly coreServices: SecurityEnhancedVesperaCoreServices,
    private readonly notificationManager: SecureNotificationManager,
    private readonly agentProgressNotifier: AgentProgressNotifier,
    private readonly taskServerManager: TaskServerManager,
    private readonly logger: VesperaLogger,
    private readonly errorHandler: VesperaErrorHandler
  ) {
    this.config = this.getDefaultConfig();
  }

  /**
   * Initialize the task server notification integration
   */
  public static async initialize(
    context: vscode.ExtensionContext,
    coreServices: SecurityEnhancedVesperaCoreServices,
    notificationManager: SecureNotificationManager,
    agentProgressNotifier: AgentProgressNotifier,
    taskServerManager: TaskServerManager
  ): Promise<TaskServerNotificationIntegration> {
    if (TaskServerNotificationIntegration.instance) {
      return TaskServerNotificationIntegration.instance;
    }

    const logger = coreServices.logger.createChild('TaskServerNotificationIntegration');
    const instance = new TaskServerNotificationIntegration(
      context,
      coreServices,
      notificationManager,
      agentProgressNotifier,
      taskServerManager,
      logger,
      coreServices.errorHandler
    );

    await instance.initializeInternal();
    TaskServerNotificationIntegration.instance = instance;
    
    return instance;
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): TaskServerNotificationIntegration {
    if (!TaskServerNotificationIntegration.instance?.initialized) {
      throw new Error('TaskServerNotificationIntegration not initialized');
    }
    return TaskServerNotificationIntegration.instance;
  }

  /**
   * Internal initialization
   */
  private async initializeInternal(): Promise<void> {
    try {
      this.logger.info('Initializing TaskServerNotificationIntegration');

      // Load configuration
      await this.loadConfiguration();

      // Subscribe to task server events
      this.subscribeToTaskServerEvents();

      // Setup periodic cleanup
      this.setupPeriodicCleanup();

      // Register disposal
      this.context.subscriptions.push(this);

      this.initialized = true;
      this.logger.info('TaskServerNotificationIntegration initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize TaskServerNotificationIntegration', error);
      throw error;
    }
  }

  /**
   * Subscribe to task server events
   */
  private subscribeToTaskServerEvents(): void {
    if (!this.config.enabled) {
      return;
    }

    this.taskServerSubscription = this.taskServerManager.onServerEvent('*', 
      (event: TaskServerEvent) => {
        this.handleTaskServerEvent(event);
      }
    );

    this.disposables.push(this.taskServerSubscription);
    
    this.logger.debug('Subscribed to task server events');
  }

  /**
   * Handle task server events
   */
  private async handleTaskServerEvent(event: TaskServerEvent): Promise<void> {
    try {
      this.logger.debug('Handling task server event', {
        type: event.type,
        taskId: event.taskId,
        serverId: event.serverId
      });

      // Security audit logging for task server events
      await this.coreServices.securityAuditLogger.logSecurityEvent(
        'task_server_event_handled',
        'low',
        {
          eventType: event.type,
          taskId: event.taskId,
          serverId: event.serverId,
          timestamp: Date.now()
        }
      );

      switch (event.type) {
        case 'taskServerCreated':
          await this.handleServerCreated(event);
          break;
        case 'agentChannelAdded':
          await this.handleAgentDeployed(event);
          break;
        case 'taskProgressUpdated':
          await this.handleTaskProgressUpdate(event);
          break;
        case 'taskServerArchived':
          await this.handleServerArchived(event);
          break;
        default:
          this.logger.debug('Unhandled task server event type', { type: event.type });
      }

    } catch (error) {
      this.logger.error('Failed to handle task server event', error, {
        eventType: event.type,
        taskId: event.taskId
      });
      await this.errorHandler.handleError(error as Error);
    }
  }

  /**
   * Handle server creation
   */
  private async handleServerCreated(event: TaskServerEvent): Promise<void> {
    if (!this.config.serverLifecycle.showCreationNotifications) {
      return;
    }

    const { server, taskState } = event.data;
    
    // Check if this task type should show notifications
    if (!this.shouldShowNotificationForTask(taskState)) {
      return;
    }

    const taskType = taskState.taskType;
    const phase = taskState.phase;
    const priority = this.inferPriorityFromTaskType(taskType);
    
    // Track this notification to avoid duplicates
    this.trackNotification(event.taskId, 'server_created');

    this.logger.info('Task server created', {
      taskId: event.taskId,
      serverId: event.serverId,
      taskType,
      phase,
      channelCount: server.channels.length
    });

    const message = `New task server created: ${server.serverName}${phase ? ` (${phase})` : ''}`;
    
    await this.notificationManager.notify({
      title: 'Task Server Created',
      message,
      type: NotificationType.TASK_SERVER_EVENT,
      level: this.getNotificationLevelForPriority(priority),
      data: { 
        taskId: event.taskId,
        serverId: event.serverId,
        taskType,
        phase,
        channelCount: server.channels.length
      },
      showInToast: this.shouldShowInToast(taskType, priority),
      actions: [
        {
          id: 'view_server',
          label: 'View Server',
          callback: () => this.viewTaskServer(event.serverId)
        },
        {
          id: 'track_progress',
          label: 'Track Progress',
          callback: () => this.trackTaskProgress(event.taskId)
        }
      ]
    });

    // Start tracking this task for progress notifications
    if (this.config.taskProgress.showMilestoneNotifications) {
      await this.startTaskProgressTracking(event.taskId, taskType, phase);
    }
  }

  /**
   * Handle agent deployment
   */
  private async handleAgentDeployed(event: TaskServerEvent): Promise<void> {
    if (!this.config.agentEvents.showDeploymentNotifications) {
      return;
    }

    const { channel, agentConfig } = event.data;
    const agentRole = agentConfig.agentRole;
    
    // Check if this notification was already sent
    if (this.wasNotificationSent(event.taskId, `agent_deployed_${agentRole}`)) {
      return;
    }

    this.trackNotification(event.taskId, `agent_deployed_${agentRole}`);

    this.logger.info('Agent deployed to task server', {
      taskId: event.taskId,
      serverId: event.serverId,
      agentRole,
      channelId: channel.channelId
    });

    const agentType = this.mapRoleToAgentType(agentRole);
    const message = `${agentRole} agent deployed to channel: ${channel.channelName}`;
    
    await this.notificationManager.notify({
      title: 'Agent Deployed',
      message,
      type: NotificationType.TASK_SERVER_EVENT,
      level: NotificationLevel.INFO,
      data: { 
        taskId: event.taskId,
        serverId: event.serverId,
        agentRole,
        channelId: channel.channelId,
        agentType
      },
      showInToast: false, // Agent deployments are less intrusive
      actions: [
        {
          id: 'view_channel',
          label: 'View Channel',
          callback: () => this.viewAgentChannel(event.serverId, channel.channelId)
        }
      ]
    });

    // Start tracking this agent's progress
    const operationId = `${event.taskId}_${agentRole}`;
    await this.agentProgressNotifier.startOperation(
      operationId,
      `${agentRole} Agent Task`,
      `Agent working on task: ${event.taskId}`,
      agentType,
      {
        showStartNotification: false // We already showed deployment notification
      }
    );
  }

  /**
   * Handle task progress updates
   */
  private async handleTaskProgressUpdate(event: TaskServerEvent): Promise<void> {
    const update: TaskProgressUpdate = event.data;
    
    this.logger.debug('Task progress update received', {
      taskId: update.taskId,
      status: update.status,
      progress: update.progress,
      currentPhase: update.currentPhase
    });

    // Handle phase completion
    if (update.currentPhase && this.config.taskProgress.showPhaseCompletions) {
      await this.handlePhaseCompletion(event.taskId, update.currentPhase, update);
    }

    // Handle task completion
    if (update.status === 'completed') {
      await this.handleTaskCompletion(event.taskId, update);
    } else if (update.status === 'failed') {
      await this.handleTaskFailure(event.taskId, update);
    }

    // Update agent progress tracking
    await this.updateAgentProgressTracking(event.taskId, update);

    // Show milestone notifications for significant progress
    if (this.config.taskProgress.showMilestoneNotifications &&
        update.progress >= this.config.taskProgress.progressThreshold) {
      await this.handleTaskMilestone(event.taskId, update);
    }
  }

  /**
   * Handle server archival
   */
  private async handleServerArchived(event: TaskServerEvent): Promise<void> {
    if (!this.config.serverLifecycle.showArchivalNotifications) {
      return;
    }

    const { taskServerState } = event.data;
    
    // Check if this notification was already sent
    if (this.wasNotificationSent(event.taskId, 'server_archived')) {
      return;
    }

    this.trackNotification(event.taskId, 'server_archived');

    this.logger.info('Task server archived', {
      taskId: event.taskId,
      serverId: event.serverId,
      completedAt: taskServerState.completedAt
    });

    const duration = taskServerState.completedAt 
      ? this.formatDuration(taskServerState.completedAt - taskServerState.createdAt)
      : '';
    
    await this.notificationManager.notify({
      title: 'Task Server Archived',
      message: `Task completed and server archived${duration}`,
      type: NotificationType.TASK_SERVER_EVENT,
      level: NotificationLevel.INFO,
      data: { 
        taskId: event.taskId,
        serverId: event.serverId,
        duration: taskServerState.completedAt - taskServerState.createdAt
      },
      showInToast: false,
      actions: [
        {
          id: 'view_summary',
          label: 'View Summary',
          callback: () => this.viewTaskSummary(event.taskId)
        }
      ]
    });

    // Cleanup tracking for this task
    this.activeTaskNotifications.delete(event.taskId);
  }

  /**
   * Handle phase completion
   */
  private async handlePhaseCompletion(
    taskId: string,
    phase: string,
    update: TaskProgressUpdate
  ): Promise<void> {
    const notificationKey = `phase_completed_${phase}`;
    if (this.wasNotificationSent(taskId, notificationKey)) {
      return;
    }

    this.trackNotification(taskId, notificationKey);

    await this.notificationManager.notify({
      title: 'Phase Completed',
      message: `${phase} phase completed (${update.progress}% overall progress)`,
      type: NotificationType.TASK_PROGRESS,
      level: NotificationLevel.IMPORTANT,
      data: { 
        taskId,
        phase,
        progress: update.progress,
        messageCount: update.messageCount
      },
      showInToast: true,
      actions: [
        {
          id: 'view_phase_results',
          label: 'View Results',
          callback: () => this.viewPhaseResults(taskId, phase)
        },
        {
          id: 'next_phase',
          label: 'Next Phase',
          callback: () => this.proceedToNextPhase(taskId, phase)
        }
      ]
    });
  }

  /**
   * Handle task completion
   */
  private async handleTaskCompletion(taskId: string, update: TaskProgressUpdate): Promise<void> {
    const notificationKey = 'task_completed';
    if (this.wasNotificationSent(taskId, notificationKey)) {
      return;
    }

    this.trackNotification(taskId, notificationKey);

    const agentSummary = this.formatAgentSummary(update.agentUpdates);
    
    await this.notificationManager.notify({
      title: 'Task Completed Successfully',
      message: `Task completed with ${update.messageCount} total messages${agentSummary}`,
      type: NotificationType.AGENT_COMPLETION,
      level: NotificationLevel.IMPORTANT,
      data: { 
        taskId,
        progress: update.progress,
        messageCount: update.messageCount,
        agentUpdates: update.agentUpdates
      },
      showInToast: true,
      actions: [
        {
          id: 'view_results',
          label: 'View Results',
          callback: () => this.viewTaskResults(taskId)
        },
        {
          id: 'export_conversation',
          label: 'Export Conversation',
          callback: () => this.exportTaskConversation(taskId)
        }
      ]
    });

    // Complete all agent progress tracking
    for (const agentUpdate of update.agentUpdates) {
      const operationId = `${taskId}_${agentUpdate.agentRole}`;
      await this.agentProgressNotifier.completeOperation(
        operationId,
        `Completed as part of task: ${taskId}`,
        { tasksCompleted: 1 },
        false // Don't show completion notification, we already showed task completion
      );
    }
  }

  /**
   * Handle task failure
   */
  private async handleTaskFailure(taskId: string, update: TaskProgressUpdate): Promise<void> {
    const notificationKey = 'task_failed';
    if (this.wasNotificationSent(taskId, notificationKey)) {
      return;
    }

    this.trackNotification(taskId, notificationKey);

    await this.notificationManager.notify({
      title: 'Task Failed',
      message: `Task failed at ${update.progress}% completion`,
      type: NotificationType.ERROR,
      level: NotificationLevel.IMPORTANT,
      data: { 
        taskId,
        progress: update.progress,
        status: update.status
      },
      showInToast: true,
      actions: [
        {
          id: 'view_error_details',
          label: 'View Error Details',
          callback: () => this.viewTaskErrorDetails(taskId)
        },
        {
          id: 'retry_task',
          label: 'Retry Task',
          callback: () => this.retryTask(taskId)
        }
      ]
    });

    // Fail all agent progress tracking
    for (const agentUpdate of update.agentUpdates) {
      if (agentUpdate.status === 'error') {
        const operationId = `${taskId}_${agentUpdate.agentRole}`;
        await this.agentProgressNotifier.failOperation(
          operationId,
          'Task failed',
          { taskId, agentRole: agentUpdate.agentRole },
          false // Don't show individual failure notifications
        );
      }
    }
  }

  /**
   * Handle task milestones
   */
  private async handleTaskMilestone(taskId: string, update: TaskProgressUpdate): Promise<void> {
    // Only show milestone notifications at major progress points
    const milestonePoints = [25, 50, 75, 90];
    const currentMilestone = milestonePoints.find(point => 
      update.progress >= point && update.progress < point + 10
    );

    if (!currentMilestone) {
      return;
    }

    const notificationKey = `milestone_${currentMilestone}`;
    if (this.wasNotificationSent(taskId, notificationKey)) {
      return;
    }

    this.trackNotification(taskId, notificationKey);

    await this.notificationManager.notify({
      title: 'Task Milestone Reached',
      message: `${currentMilestone}% completion milestone reached`,
      type: NotificationType.TASK_PROGRESS,
      level: NotificationLevel.INFO,
      data: { 
        taskId,
        milestone: currentMilestone,
        progress: update.progress
      },
      showInToast: false // Milestones are less intrusive
    });
  }

  /**
   * Start task progress tracking
   */
  private async startTaskProgressTracking(
    taskId: string,
    taskType: string,
    phase?: string
  ): Promise<void> {
    const operationId = `task_${taskId}`;
    const agentType = this.mapTaskTypeToAgentType(taskType);
    
    await this.agentProgressNotifier.startOperation(
      operationId,
      `${taskType} Task`,
      `Task execution: ${taskId}`,
      agentType,
      {
        phase,
        showStartNotification: false // We already showed server creation
      }
    );
  }

  /**
   * Update agent progress tracking
   */
  private async updateAgentProgressTracking(
    taskId: string,
    update: TaskProgressUpdate
  ): Promise<void> {
    const taskOperationId = `task_${taskId}`;
    
    await this.agentProgressNotifier.updateProgress({
      operationId: taskOperationId,
      status: this.mapTaskStatusToOperationStatus(update.status),
      progress: update.progress,
      currentAction: update.currentPhase,
      metrics: { tasksCompleted: 1, apiCalls: update.messageCount }
    });

    // Update individual agent progress
    for (const agentUpdate of update.agentUpdates) {
      const agentOperationId = `${taskId}_${agentUpdate.agentRole}`;
      
      await this.agentProgressNotifier.updateProgress({
        operationId: agentOperationId,
        status: this.mapAgentStatusToOperationStatus(agentUpdate.status),
        progress: Math.min(100, (agentUpdate.messagesSent / Math.max(1, update.messageCount)) * 100),
        currentAction: agentUpdate.currentAction,
        metrics: { apiCalls: agentUpdate.messagesSent }
      });
    }
  }

  /**
   * Check if notification should be shown for task
   */
  private shouldShowNotificationForTask(taskState: any): boolean {
    if (!taskState.taskType) return true;

    // Check excluded task types
    if (this.config.filtering.excludedTaskTypes.includes(taskState.taskType)) {
      return false;
    }

    // Check minimum priority
    const priority = this.inferPriorityFromTaskType(taskState.taskType);
    const priorityLevels = ['low', 'medium', 'high', 'critical'];
    const currentIndex = priorityLevels.indexOf(priority);
    const minimumIndex = priorityLevels.indexOf(this.config.filtering.minimumPriority);
    
    return currentIndex >= minimumIndex;
  }

  /**
   * Check if notification was already sent
   */
  private wasNotificationSent(taskId: string, notificationKey: string): boolean {
    const taskNotifications = this.activeTaskNotifications.get(taskId);
    return taskNotifications?.has(notificationKey) || false;
  }

  /**
   * Track notification as sent
   */
  private trackNotification(taskId: string, notificationKey: string): void {
    if (!this.activeTaskNotifications.has(taskId)) {
      this.activeTaskNotifications.set(taskId, new Set());
    }
    this.activeTaskNotifications.get(taskId)!.add(notificationKey);
  }

  /**
   * Map role to agent type
   */
  private mapRoleToAgentType(role: string): AgentType {
    const roleMap: Record<string, AgentType> = {
      'SecurityEnhancementAgent': AgentType.SECURITY,
      'SessionPersistenceAgent': AgentType.IMPLEMENTATION,
      'UIEnhancementAgent': AgentType.IMPLEMENTATION,
      'ResearchAgent': AgentType.RESEARCH,
      'AnalysisAgent': AgentType.ANALYSIS,
      'TestingAgent': AgentType.TESTING,
      'DocumentationAgent': AgentType.DOCUMENTATION,
      'CoordinationAgent': AgentType.COORDINATION
    };
    
    return roleMap[role] || AgentType.IMPLEMENTATION;
  }

  /**
   * Map task type to agent type
   */
  private mapTaskTypeToAgentType(taskType: string): AgentType {
    if (taskType.toLowerCase().includes('security')) return AgentType.SECURITY;
    if (taskType.toLowerCase().includes('research')) return AgentType.RESEARCH;
    if (taskType.toLowerCase().includes('test')) return AgentType.TESTING;
    if (taskType.toLowerCase().includes('docs')) return AgentType.DOCUMENTATION;
    if (taskType.toLowerCase().includes('analysis')) return AgentType.ANALYSIS;
    return AgentType.IMPLEMENTATION;
  }

  /**
   * Map task status to operation status
   */
  private mapTaskStatusToOperationStatus(status: string): OperationStatus {
    const statusMap: Record<string, OperationStatus> = {
      'initialized': OperationStatus.STARTED,
      'planning': OperationStatus.PROGRESS,
      'executing': OperationStatus.PROGRESS,
      'blocked': OperationStatus.PROGRESS,
      'completed': OperationStatus.COMPLETED,
      'failed': OperationStatus.FAILED
    };
    
    return statusMap[status] || OperationStatus.PROGRESS;
  }

  /**
   * Map agent status to operation status
   */
  private mapAgentStatusToOperationStatus(status: string): OperationStatus {
    const statusMap: Record<string, OperationStatus> = {
      'idle': OperationStatus.STARTED,
      'active': OperationStatus.PROGRESS,
      'waiting': OperationStatus.PROGRESS,
      'error': OperationStatus.FAILED,
      'completed': OperationStatus.COMPLETED
    };
    
    return statusMap[status] || OperationStatus.PROGRESS;
  }

  /**
   * Infer priority from task type
   */
  private inferPriorityFromTaskType(taskType: string): string {
    if (taskType.toLowerCase().includes('critical') || taskType.toLowerCase().includes('security')) {
      return 'critical';
    }
    if (taskType.toLowerCase().includes('urgent') || taskType.toLowerCase().includes('phase')) {
      return 'high';
    }
    if (taskType.toLowerCase().includes('important')) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Get notification level for priority
   */
  private getNotificationLevelForPriority(priority: string): NotificationLevel {
    const levelMap: Record<string, NotificationLevel> = {
      'critical': NotificationLevel.CRITICAL,
      'high': NotificationLevel.IMPORTANT,
      'medium': NotificationLevel.IMPORTANT,
      'low': NotificationLevel.INFO
    };
    
    return levelMap[priority] || NotificationLevel.INFO;
  }

  /**
   * Check if should show in toast
   */
  private shouldShowInToast(taskType: string, priority: string): boolean {
    return priority === 'critical' || priority === 'high' ||
           taskType.toLowerCase().includes('phase');
  }

  /**
   * Format duration
   */
  private formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return ` in ${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return ` in ${minutes}m`;
    } else {
      return ` in ${Math.floor(ms / 1000)}s`;
    }
  }

  /**
   * Format agent summary
   */
  private formatAgentSummary(agentUpdates: any[]): string {
    if (!agentUpdates.length) return '';
    
    const completedAgents = agentUpdates.filter(a => a.status === 'completed').length;
    return ` (${completedAgents}/${agentUpdates.length} agents completed)`;
  }

  // Action callbacks (would integrate with actual UI components)
  private async viewTaskServer(serverId: string): Promise<void> {
    this.logger.info('View task server requested', { serverId });
  }

  private async trackTaskProgress(taskId: string): Promise<void> {
    this.logger.info('Track task progress requested', { taskId });
  }

  private async viewAgentChannel(serverId: string, channelId: string): Promise<void> {
    this.logger.info('View agent channel requested', { serverId, channelId });
  }

  private async viewPhaseResults(taskId: string, phase: string): Promise<void> {
    this.logger.info('View phase results requested', { taskId, phase });
  }

  private async proceedToNextPhase(taskId: string, currentPhase: string): Promise<void> {
    this.logger.info('Proceed to next phase requested', { taskId, currentPhase });
  }

  private async viewTaskResults(taskId: string): Promise<void> {
    this.logger.info('View task results requested', { taskId });
  }

  private async exportTaskConversation(taskId: string): Promise<void> {
    this.logger.info('Export task conversation requested', { taskId });
  }

  private async viewTaskSummary(taskId: string): Promise<void> {
    this.logger.info('View task summary requested', { taskId });
  }

  private async viewTaskErrorDetails(taskId: string): Promise<void> {
    this.logger.info('View task error details requested', { taskId });
  }

  private async retryTask(taskId: string): Promise<void> {
    this.logger.info('Retry task requested', { taskId });
  }

  /**
   * Load configuration
   */
  private async loadConfiguration(): Promise<void> {
    const workspaceConfig = vscode.workspace.getConfiguration('vesperaForge.notifications.taskServer');
    
    this.config = {
      ...this.getDefaultConfig(),
      enabled: workspaceConfig.get('enabled', this.config.enabled)
    };
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): TaskServerNotificationConfig {
    return {
      enabled: true,
      serverLifecycle: {
        showCreationNotifications: true,
        showArchivalNotifications: false,
        showMajorTasksOnly: true
      },
      agentEvents: {
        showDeploymentNotifications: false,
        showCompletionNotifications: true,
        showProgressUpdates: true
      },
      taskProgress: {
        showMilestoneNotifications: true,
        showPhaseCompletions: true,
        progressThreshold: 25
      },
      coordination: {
        showCrossTaskEvents: true,
        showMultiPhaseWorkflows: true
      },
      filtering: {
        excludedTaskTypes: ['debug', 'test'],
        minimumPriority: 'medium'
      }
    };
  }

  /**
   * Setup periodic cleanup
   */
  private setupPeriodicCleanup(): void {
    const cleanupInterval = setInterval(() => {
      try {
        // Clean up old task notification tracking
        
        // This would typically clean based on task completion times
        // For now, we'll clean up after a reasonable time period
        for (const [taskId, notifications] of this.activeTaskNotifications.entries()) {
          // Could add logic to check task completion time and clean accordingly
        }
      } catch (error) {
        this.logger.warn('Task server notification cleanup failed', { error });
      }
    }, 3600000); // Run every hour

    this.disposables.push(new vscode.Disposable(() => {
      clearInterval(cleanupInterval);
    }));
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    if (this.taskServerSubscription) {
      this.taskServerSubscription.dispose();
    }

    this.disposables.forEach(d => d.dispose());
    this.disposables.length = 0;
    
    this.activeTaskNotifications.clear();
    
    this.initialized = false;
    TaskServerNotificationIntegration.instance = undefined as any;
    
    this.logger.info('TaskServerNotificationIntegration disposed');
  }
}