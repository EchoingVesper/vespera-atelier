/**
 * Agent Progress Notifier
 * 
 * Specialized notification system for tracking long-running operations,
 * agent completions, task milestones, and providing real-time progress updates.
 */

import * as vscode from 'vscode';
import { VesperaLogger } from '../core/logging/VesperaLogger';
import { VesperaErrorHandler } from '../core/error-handling/VesperaErrorHandler';
import { SecurityEnhancedVesperaCoreServices } from '../core/security/SecurityEnhancedCoreServices';
import { 
  SecureNotificationManager, 
  NotificationLevel, 
  NotificationType, 
  NotificationAction 
} from './SecureNotificationManager';

export enum OperationStatus {
  STARTED = 'started',
  PROGRESS = 'progress', 
  MILESTONE = 'milestone',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum AgentType {
  RESEARCH = 'research',
  SECURITY = 'security',
  IMPLEMENTATION = 'implementation',
  TESTING = 'testing',
  DOCUMENTATION = 'documentation',
  ANALYSIS = 'analysis',
  COORDINATION = 'coordination'
}

export interface LongRunningOperation {
  id: string;
  name: string;
  description: string;
  agentType: AgentType;
  phase?: string;
  expectedDuration?: number; // milliseconds
  startTime: number;
  endTime?: number;
  status: OperationStatus;
  progress: number; // 0-100
  milestones: OperationMilestone[];
  currentAction?: string;
  metrics?: OperationMetrics;
}

export interface OperationMilestone {
  id: string;
  name: string;
  description: string;
  targetProgress: number; // 0-100
  completed: boolean;
  completedAt?: number;
  duration?: number;
}

export interface OperationMetrics {
  filesProcessed?: number;
  linesAnalyzed?: number;
  testsRun?: number;
  errorsFound?: number;
  tasksCompleted?: number;
  apiCalls?: number;
}

export interface AgentProgressUpdate {
  operationId: string;
  status: OperationStatus;
  progress: number;
  currentAction?: string;
  milestone?: string;
  metrics?: Partial<OperationMetrics>;
  message?: string;
  data?: any;
}

export interface ProgressNotificationConfig {
  enabled: boolean;
  showStartNotifications: boolean;
  showMilestoneNotifications: boolean;
  showCompletionNotifications: boolean;
  showFailureNotifications: boolean;
  progressUpdateInterval: number; // milliseconds
  longRunningThreshold: number; // milliseconds
  timeBasedNotifications: {
    enabled: boolean;
    intervals: number[]; // milliseconds - notify at these intervals
  };
  agentTypes: {
    [key in AgentType]: {
      enabled: boolean;
      notificationLevel: NotificationLevel;
      showInToast: boolean;
    };
  };
}

export class AgentProgressNotifier implements vscode.Disposable {
  private static instance: AgentProgressNotifier;
  private initialized = false;
  private activeOperations: Map<string, LongRunningOperation> = new Map();
  private progressTimers: Map<string, NodeJS.Timeout> = new Map();
  private timeBasedNotificationTrackers: Map<string, Set<number>> = new Map();
  private disposables: vscode.Disposable[] = [];
  private config: ProgressNotificationConfig;

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly coreServices: SecurityEnhancedVesperaCoreServices,
    private readonly notificationManager: SecureNotificationManager,
    private readonly logger: VesperaLogger,
    private readonly errorHandler: VesperaErrorHandler
  ) {
    this.config = this.getDefaultConfig();
  }

  /**
   * Initialize the agent progress notifier
   */
  public static async initialize(
    context: vscode.ExtensionContext,
    coreServices: SecurityEnhancedVesperaCoreServices,
    notificationManager: SecureNotificationManager
  ): Promise<AgentProgressNotifier> {
    if (AgentProgressNotifier.instance) {
      return AgentProgressNotifier.instance;
    }

    const logger = coreServices.logger.createChild('AgentProgressNotifier');
    const instance = new AgentProgressNotifier(
      context,
      coreServices,
      notificationManager,
      logger,
      coreServices.errorHandler
    );

    await instance.initializeInternal();
    AgentProgressNotifier.instance = instance;
    
    return instance;
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): AgentProgressNotifier {
    if (!AgentProgressNotifier.instance?.initialized) {
      throw new Error('AgentProgressNotifier not initialized');
    }
    return AgentProgressNotifier.instance;
  }

  /**
   * Internal initialization
   */
  private async initializeInternal(): Promise<void> {
    try {
      this.logger.info('Initializing AgentProgressNotifier');

      // Load configuration
      await this.loadConfiguration();

      // Setup cleanup intervals
      this.setupPeriodicCleanup();

      // Register disposal
      this.context.subscriptions.push(this);

      this.initialized = true;
      this.logger.info('AgentProgressNotifier initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize AgentProgressNotifier', error);
      throw error;
    }
  }

  /**
   * Start tracking a long-running operation
   */
  public async startOperation(
    id: string,
    name: string,
    description: string,
    agentType: AgentType,
    options: {
      phase?: string;
      expectedDuration?: number;
      milestones?: Omit<OperationMilestone, 'completed' | 'completedAt'>[];
      showStartNotification?: boolean;
    } = {}
  ): Promise<void> {
    try {
      const operation: LongRunningOperation = {
        id,
        name,
        description,
        agentType,
        phase: options.phase,
        expectedDuration: options.expectedDuration,
        startTime: Date.now(),
        status: OperationStatus.STARTED,
        progress: 0,
        milestones: (options.milestones || []).map(m => ({
          ...m,
          completed: false
        })),
        metrics: {}
      };

      this.activeOperations.set(id, operation);
      
      // Setup time-based notification tracking
      if (this.config.timeBasedNotifications.enabled) {
        this.timeBasedNotificationTrackers.set(id, new Set());
        this.setupTimeBasedNotifications(operation);
      }

      this.logger.info('Long-running operation started', {
        operationId: id,
        name,
        agentType,
        expectedDuration: options.expectedDuration
      });

      // Show start notification if enabled
      if ((options.showStartNotification ?? this.config.showStartNotifications) &&
          this.isAgentTypeEnabled(agentType)) {
        await this.notificationManager.notify({
          title: 'Agent Operation Started',
          message: `${name}: ${description}`,
          type: NotificationType.AGENT_COMPLETION,
          level: this.getNotificationLevel(agentType),
          data: { operationId: id, agentType, phase: options.phase },
          showInToast: this.shouldShowInToast(agentType),
          actions: [
            {
              id: 'view_progress',
              label: 'View Progress',
              callback: () => this.showProgressDetails(id)
            }
          ]
        });
      }

      // Setup progress monitoring
      this.setupProgressMonitoring(operation);

    } catch (error) {
      this.logger.error('Failed to start operation tracking', error, { operationId: id });
      await this.errorHandler.handleError(error as Error);
    }
  }

  /**
   * Update operation progress
   */
  public async updateProgress(update: AgentProgressUpdate): Promise<void> {
    try {
      const operation = this.activeOperations.get(update.operationId);
      if (!operation) {
        this.logger.warn('Operation not found for progress update', {
          operationId: update.operationId
        });
        return;
      }

      const previousProgress = operation.progress;
      const previousStatus = operation.status;

      // Update operation
      operation.progress = Math.max(0, Math.min(100, update.progress));
      operation.status = update.status;
      operation.currentAction = update.currentAction;
      
      if (update.metrics) {
        operation.metrics = { ...operation.metrics, ...update.metrics };
      }

      // Handle milestone completion
      if (update.milestone) {
        await this.handleMilestoneCompletion(operation, update.milestone);
      }

      // Handle status changes
      if (update.status !== previousStatus) {
        await this.handleStatusChange(operation, previousStatus);
      }

      // Handle significant progress changes
      const progressDelta = operation.progress - previousProgress;
      if (progressDelta >= 25) { // 25% or more progress
        await this.handleProgressMilestone(operation, progressDelta);
      }

      this.logger.debug('Operation progress updated', {
        operationId: update.operationId,
        progress: operation.progress,
        status: operation.status,
        currentAction: operation.currentAction
      });

    } catch (error) {
      this.logger.error('Failed to update operation progress', error, {
        operationId: update.operationId
      });
    }
  }

  /**
   * Complete an operation
   */
  public async completeOperation(
    operationId: string,
    message?: string,
    metrics?: OperationMetrics,
    showNotification = true
  ): Promise<void> {
    try {
      const operation = this.activeOperations.get(operationId);
      if (!operation) {
        this.logger.warn('Operation not found for completion', { operationId });
        return;
      }

      const duration = Date.now() - operation.startTime;
      operation.endTime = Date.now();
      operation.status = OperationStatus.COMPLETED;
      operation.progress = 100;
      
      if (metrics) {
        operation.metrics = { ...operation.metrics, ...metrics };
      }

      this.logger.info('Operation completed', {
        operationId,
        name: operation.name,
        duration,
        agentType: operation.agentType
      });

      // Show completion notification
      if (showNotification && 
          this.config.showCompletionNotifications &&
          this.isAgentTypeEnabled(operation.agentType)) {
        
        const durationText = this.formatDuration(duration);
        const metricsText = this.formatMetrics(operation.metrics);
        
        await this.notificationManager.notify({
          title: 'Agent Operation Completed',
          message: `${operation.name} completed successfully${durationText}${metricsText}${message ? `. ${message}` : ''}`,
          type: NotificationType.AGENT_COMPLETION,
          level: this.getNotificationLevel(operation.agentType),
          data: { 
            operationId, 
            duration, 
            metrics: operation.metrics,
            phase: operation.phase
          },
          showInToast: this.shouldShowInToast(operation.agentType),
          actions: [
            {
              id: 'view_results',
              label: 'View Results',
              callback: () => this.showOperationResults(operationId)
            },
            {
              id: 'view_metrics',
              label: 'View Metrics',
              callback: () => this.showOperationMetrics(operationId)
            }
          ]
        });
      }

      // Cleanup operation
      await this.cleanupOperation(operationId);

    } catch (error) {
      this.logger.error('Failed to complete operation', error, { operationId });
    }
  }

  /**
   * Fail an operation
   */
  public async failOperation(
    operationId: string,
    error: string,
    details?: any,
    showNotification = true
  ): Promise<void> {
    try {
      const operation = this.activeOperations.get(operationId);
      if (!operation) {
        this.logger.warn('Operation not found for failure', { operationId });
        return;
      }

      const duration = Date.now() - operation.startTime;
      operation.endTime = Date.now();
      operation.status = OperationStatus.FAILED;

      this.logger.warn('Operation failed', {
        operationId,
        name: operation.name,
        duration,
        error,
        agentType: operation.agentType
      });

      // Show failure notification
      if (showNotification && 
          this.config.showFailureNotifications &&
          this.isAgentTypeEnabled(operation.agentType)) {
        
        const durationText = this.formatDuration(duration);
        
        await this.notificationManager.notify({
          title: 'Agent Operation Failed',
          message: `${operation.name} failed${durationText}: ${error}`,
          type: NotificationType.ERROR,
          level: NotificationLevel.IMPORTANT,
          data: { 
            operationId, 
            error, 
            details, 
            duration,
            phase: operation.phase
          },
          showInToast: true,
          actions: [
            {
              id: 'view_error',
              label: 'View Error Details',
              callback: () => this.showErrorDetails(operationId, error, details)
            },
            {
              id: 'retry_operation',
              label: 'Retry',
              callback: () => this.retryOperation(operationId)
            }
          ]
        });
      }

      // Cleanup operation
      await this.cleanupOperation(operationId);

    } catch (err) {
      this.logger.error('Failed to handle operation failure', err, { operationId });
    }
  }

  /**
   * Cancel an operation
   */
  public async cancelOperation(operationId: string, reason?: string): Promise<void> {
    try {
      const operation = this.activeOperations.get(operationId);
      if (!operation) {
        this.logger.warn('Operation not found for cancellation', { operationId });
        return;
      }

      const duration = Date.now() - operation.startTime;
      operation.endTime = Date.now();
      operation.status = OperationStatus.CANCELLED;

      this.logger.info('Operation cancelled', {
        operationId,
        name: operation.name,
        duration,
        reason
      });

      // Cleanup operation
      await this.cleanupOperation(operationId);

    } catch (error) {
      this.logger.error('Failed to cancel operation', error, { operationId });
    }
  }

  /**
   * Get active operations
   */
  public getActiveOperations(): LongRunningOperation[] {
    return Array.from(this.activeOperations.values());
  }

  /**
   * Get operation by ID
   */
  public getOperation(operationId: string): LongRunningOperation | undefined {
    return this.activeOperations.get(operationId);
  }

  /**
   * Handle milestone completion
   */
  private async handleMilestoneCompletion(
    operation: LongRunningOperation,
    milestoneName: string
  ): Promise<void> {
    const milestone = operation.milestones.find(m => m.name === milestoneName);
    if (!milestone || milestone.completed) {
      return;
    }

    milestone.completed = true;
    milestone.completedAt = Date.now();
    
    if (milestone.id) {
      milestone.duration = milestone.completedAt - operation.startTime;
    }

    this.logger.debug('Milestone completed', {
      operationId: operation.id,
      milestone: milestoneName,
      progress: operation.progress
    });

    // Show milestone notification if enabled
    if (this.config.showMilestoneNotifications &&
        this.isAgentTypeEnabled(operation.agentType)) {
      
      await this.notificationManager.notify({
        title: 'Agent Milestone Reached',
        message: `${operation.name}: ${milestone.description}`,
        type: NotificationType.TASK_PROGRESS,
        level: NotificationLevel.INFO,
        data: { 
          operationId: operation.id,
          milestone: milestoneName,
          progress: operation.progress
        },
        showInToast: false // Milestone notifications are less intrusive
      });
    }
  }

  /**
   * Handle operation status changes
   */
  private async handleStatusChange(
    operation: LongRunningOperation,
    previousStatus: OperationStatus
  ): Promise<void> {
    // Log status change
    this.logger.debug('Operation status changed', {
      operationId: operation.id,
      previousStatus,
      newStatus: operation.status,
      progress: operation.progress
    });

    // Handle specific status transitions
    if (operation.status === OperationStatus.PROGRESS && previousStatus === OperationStatus.STARTED) {
      // Operation moved from started to active progress
      this.logger.debug('Operation entered active progress phase', {
        operationId: operation.id
      });
    }
  }

  /**
   * Handle progress milestones (25%, 50%, 75%, etc.)
   */
  private async handleProgressMilestone(
    operation: LongRunningOperation,
    progressDelta: number
  ): Promise<void> {
    this.logger.debug('Significant progress made', {
      operationId: operation.id,
      progress: operation.progress,
      progressDelta
    });

    // Could show progress notifications for major milestones
    if (operation.progress >= 50 && operation.progress < 75) {
      // Halfway point
      const duration = Date.now() - operation.startTime;
      const estimatedTotal = operation.expectedDuration || (duration * 2);
      const eta = new Date(Date.now() + (estimatedTotal - duration)).toLocaleTimeString();
      
      if (this.isAgentTypeEnabled(operation.agentType)) {
        await this.notificationManager.notify({
          title: 'Agent Progress Update',
          message: `${operation.name} is 50% complete. ETA: ${eta}`,
          type: NotificationType.TASK_PROGRESS,
          level: NotificationLevel.INFO,
          data: { operationId: operation.id, progress: operation.progress, eta },
          showInToast: false
        });
      }
    }
  }

  /**
   * Setup time-based notifications
   */
  private setupTimeBasedNotifications(operation: LongRunningOperation): void {
    if (!this.config.timeBasedNotifications.enabled) {
      return;
    }

    for (const interval of this.config.timeBasedNotifications.intervals) {
      setTimeout(async () => {
        const op = this.activeOperations.get(operation.id);
        if (!op || op.status === OperationStatus.COMPLETED || 
            op.status === OperationStatus.FAILED || 
            op.status === OperationStatus.CANCELLED) {
          return;
        }

        const tracker = this.timeBasedNotificationTrackers.get(operation.id);
        if (!tracker || tracker.has(interval)) {
          return;
        }

        tracker.add(interval);
        
        const elapsed = Date.now() - op.startTime;
        const elapsedText = this.formatDuration(elapsed);
        
        if (this.isAgentTypeEnabled(op.agentType)) {
          await this.notificationManager.notify({
            title: 'Long-Running Operation Update',
            message: `${op.name} has been running for ${elapsedText} (${op.progress}% complete)`,
            type: NotificationType.TASK_PROGRESS,
            level: NotificationLevel.INFO,
            data: { operationId: op.id, elapsed, progress: op.progress },
            showInToast: true,
            actions: [
              {
                id: 'check_progress',
                label: 'Check Progress',
                callback: () => this.showProgressDetails(op.id)
              }
            ]
          });
        }
      }, interval);
    }
  }

  /**
   * Setup progress monitoring
   */
  private setupProgressMonitoring(operation: LongRunningOperation): void {
    if (this.config.progressUpdateInterval <= 0) {
      return;
    }

    const timer = setInterval(() => {
      const op = this.activeOperations.get(operation.id);
      if (!op || op.status === OperationStatus.COMPLETED || 
          op.status === OperationStatus.FAILED || 
          op.status === OperationStatus.CANCELLED) {
        clearInterval(timer);
        this.progressTimers.delete(operation.id);
        return;
      }

      // Could emit progress events here for UI updates
      this.logger.debug('Progress monitoring heartbeat', {
        operationId: op.id,
        progress: op.progress,
        status: op.status,
        currentAction: op.currentAction
      });
    }, this.config.progressUpdateInterval);

    this.progressTimers.set(operation.id, timer);
  }

  /**
   * Cleanup operation resources
   */
  private async cleanupOperation(operationId: string): Promise<void> {
    const timer = this.progressTimers.get(operationId);
    if (timer) {
      clearTimeout(timer);
      this.progressTimers.delete(operationId);
    }

    this.timeBasedNotificationTrackers.delete(operationId);
    
    // Keep completed operations for a while for reference
    setTimeout(() => {
      this.activeOperations.delete(operationId);
    }, 300000); // 5 minutes
  }

  /**
   * Check if agent type is enabled for notifications
   */
  private isAgentTypeEnabled(agentType: AgentType): boolean {
    return this.config.enabled && this.config.agentTypes[agentType]?.enabled;
  }

  /**
   * Get notification level for agent type
   */
  private getNotificationLevel(agentType: AgentType): NotificationLevel {
    return this.config.agentTypes[agentType]?.notificationLevel || NotificationLevel.INFO;
  }

  /**
   * Check if should show in toast for agent type
   */
  private shouldShowInToast(agentType: AgentType): boolean {
    return this.config.agentTypes[agentType]?.showInToast ?? false;
  }

  /**
   * Format duration for display
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return ` in ${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return ` in ${minutes}m ${seconds % 60}s`;
    } else {
      return ` in ${seconds}s`;
    }
  }

  /**
   * Format metrics for display
   */
  private formatMetrics(metrics?: OperationMetrics): string {
    if (!metrics) return '';

    const parts: string[] = [];
    if (metrics.filesProcessed) parts.push(`${metrics.filesProcessed} files`);
    if (metrics.linesAnalyzed) parts.push(`${metrics.linesAnalyzed} lines`);
    if (metrics.testsRun) parts.push(`${metrics.testsRun} tests`);
    if (metrics.tasksCompleted) parts.push(`${metrics.tasksCompleted} tasks`);

    return parts.length > 0 ? ` (${parts.join(', ')})` : '';
  }

  /**
   * Show progress details
   */
  private async showProgressDetails(operationId: string): Promise<void> {
    const operation = this.activeOperations.get(operationId);
    if (!operation) return;

    // This would typically open a webview or output channel
    this.logger.info('Progress details requested', { operationId });
  }

  /**
   * Show operation results
   */
  private async showOperationResults(operationId: string): Promise<void> {
    this.logger.info('Operation results requested', { operationId });
  }

  /**
   * Show operation metrics
   */
  private async showOperationMetrics(operationId: string): Promise<void> {
    this.logger.info('Operation metrics requested', { operationId });
  }

  /**
   * Show error details
   */
  private async showErrorDetails(operationId: string, error: string, details?: any): Promise<void> {
    this.logger.info('Error details requested', { operationId, error });
  }

  /**
   * Retry operation
   */
  private async retryOperation(operationId: string): Promise<void> {
    this.logger.info('Operation retry requested', { operationId });
  }

  /**
   * Load configuration
   */
  private async loadConfiguration(): Promise<void> {
    const workspaceConfig = vscode.workspace.getConfiguration('vesperaForge.notifications.agentProgress');
    
    this.config = {
      ...this.getDefaultConfig(),
      enabled: workspaceConfig.get('enabled', this.config.enabled),
      showStartNotifications: workspaceConfig.get('showStartNotifications', this.config.showStartNotifications),
      showMilestoneNotifications: workspaceConfig.get('showMilestoneNotifications', this.config.showMilestoneNotifications),
      showCompletionNotifications: workspaceConfig.get('showCompletionNotifications', this.config.showCompletionNotifications),
      progressUpdateInterval: workspaceConfig.get('progressUpdateInterval', this.config.progressUpdateInterval)
    };
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): ProgressNotificationConfig {
    return {
      enabled: true,
      showStartNotifications: false,
      showMilestoneNotifications: true,
      showCompletionNotifications: true,
      showFailureNotifications: true,
      progressUpdateInterval: 30000, // 30 seconds
      longRunningThreshold: 60000, // 1 minute
      timeBasedNotifications: {
        enabled: true,
        intervals: [300000, 600000, 1800000] // 5 minutes, 10 minutes, 30 minutes
      },
      agentTypes: {
        [AgentType.RESEARCH]: {
          enabled: true,
          notificationLevel: NotificationLevel.INFO,
          showInToast: false
        },
        [AgentType.SECURITY]: {
          enabled: true,
          notificationLevel: NotificationLevel.IMPORTANT,
          showInToast: true
        },
        [AgentType.IMPLEMENTATION]: {
          enabled: true,
          notificationLevel: NotificationLevel.IMPORTANT,
          showInToast: true
        },
        [AgentType.TESTING]: {
          enabled: true,
          notificationLevel: NotificationLevel.INFO,
          showInToast: false
        },
        [AgentType.DOCUMENTATION]: {
          enabled: true,
          notificationLevel: NotificationLevel.INFO,
          showInToast: false
        },
        [AgentType.ANALYSIS]: {
          enabled: true,
          notificationLevel: NotificationLevel.INFO,
          showInToast: false
        },
        [AgentType.COORDINATION]: {
          enabled: true,
          notificationLevel: NotificationLevel.IMPORTANT,
          showInToast: true
        }
      }
    };
  }

  /**
   * Setup periodic cleanup
   */
  private setupPeriodicCleanup(): void {
    const cleanupInterval = setInterval(() => {
      try {
        const now = Date.now();
        const oneHourAgo = now - 3600000;

        // Remove old completed operations
        for (const [id, operation] of this.activeOperations.entries()) {
          if (operation.endTime && operation.endTime < oneHourAgo &&
              (operation.status === OperationStatus.COMPLETED ||
               operation.status === OperationStatus.FAILED ||
               operation.status === OperationStatus.CANCELLED)) {
            this.activeOperations.delete(id);
            this.logger.debug('Cleaned up old operation', { operationId: id });
          }
        }
      } catch (error) {
        this.logger.warn('Progress notifier cleanup failed', { error });
      }
    }, 300000); // Run every 5 minutes

    this.disposables.push(new vscode.Disposable(() => {
      clearInterval(cleanupInterval);
    }));
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    // Clear all timers
    for (const timer of this.progressTimers.values()) {
      clearTimeout(timer);
    }
    this.progressTimers.clear();

    this.disposables.forEach(d => d.dispose());
    this.disposables.length = 0;
    
    this.activeOperations.clear();
    this.timeBasedNotificationTrackers.clear();
    
    this.initialized = false;
    AgentProgressNotifier.instance = undefined as any;
    
    this.logger.info('AgentProgressNotifier disposed');
  }
}