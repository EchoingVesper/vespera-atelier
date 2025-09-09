/**
 * Task Chat Integration - MCP Task System Connection
 * 
 * Features:
 * - MCP task monitoring integration with vespera-scriptorium
 * - Automatic server spawning on task creation
 * - Agent channel creation when agents are deployed
 * - Task completion handling (server archival, cleanup)
 * - Cross-task navigation and server organization
 * - Real-time task progress synchronization
 */

import * as vscode from 'vscode';
import { VesperaLogger } from '../../core/logging/VesperaLogger';
import { VesperaErrorHandler } from '../../core/error-handling/VesperaErrorHandler';
import { 
  SecureSessionPersistenceManager,
  MessageHistoryState
} from '../persistence/SecureSessionPersistenceManager';
import { 
  TaskServerManager, 
  TaskServerConfig, 
  AgentChannelConfig,
  TaskProgressUpdate,
  AgentProgressUpdate
} from '../servers/TaskServerManager';
import { MultiChatStateManager } from '../state/MultiChatStateManager';

// MCP Integration interfaces
export interface MCPTaskEvent {
  type: 'task_created' | 'task_updated' | 'task_completed' | 'task_failed' | 
        'agent_deployed' | 'agent_progress' | 'agent_completed' | 'agent_error';
  taskId: string;
  taskData?: MCPTaskData;
  agentData?: MCPAgentData;
  progressData?: MCPProgressData;
  timestamp: number;
}

export interface MCPTaskData {
  taskId: string;
  title: string;
  description: string;
  taskType: string;
  phase?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  createdAt: number;
  updatedAt: number;
  expectedAgents: string[];
  dependencies: string[];
  metadata: Record<string, any>;
}

export interface MCPAgentData {
  agentId: string;
  agentRole: string;
  agentName: string;
  taskId: string;
  capabilities: string[];
  status: 'initializing' | 'active' | 'idle' | 'waiting' | 'error' | 'completed';
  deployedAt: number;
  lastActivity: number;
  currentAction?: string;
  progress: number;
  messageCount: number;
  errorDetails?: string;
}

export interface MCPProgressData {
  taskId: string;
  overallProgress: number;
  currentPhase?: string;
  phaseProgress: number;
  agentProgress: Record<string, number>;
  milestones: MCPMilestone[];
  estimatedCompletion?: number;
  blockers: MCPBlocker[];
}

export interface MCPMilestone {
  milestoneId: string;
  name: string;
  completed: boolean;
  completedAt?: number;
  progress: number;
}

export interface MCPBlocker {
  blockerId: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  blockedSince: number;
  resolution?: string;
}

export interface TaskChatMapping {
  taskId: string;
  serverId: string;
  channels: TaskChannelMapping[];
  lastSync: number;
  syncErrors: number;
}

export interface TaskChannelMapping {
  agentRole: string;
  channelId: string;
  agentId?: string;
  lastActivity: number;
  messageCount: number;
}

export interface IntegrationConfig {
  enableAutoServerCreation: boolean;
  enableAgentChannelCreation: boolean;
  enableProgressSync: boolean;
  enableTaskCompletion: boolean;
  syncInterval: number;
  maxSyncErrors: number;
  serverTemplateOverrides: Record<string, string>;
  agentRoleMappings: Record<string, string>;
}

export class TaskChatIntegration {
  private taskMappings: Map<string, TaskChatMapping> = new Map();
  private mcpEventHandlers: Map<string, (event: MCPTaskEvent) => Promise<void>> = new Map();
  private syncTimer?: NodeJS.Timeout;
  private mcpConnectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  private disposables: vscode.Disposable[] = [];
  
  private config: IntegrationConfig = {
    enableAutoServerCreation: true,
    enableAgentChannelCreation: true,
    enableProgressSync: true,
    enableTaskCompletion: true,
    syncInterval: 30000, // 30 seconds
    maxSyncErrors: 5,
    serverTemplateOverrides: {},
    agentRoleMappings: {}
  };

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly persistenceManager: SecureSessionPersistenceManager,
    private readonly taskServerManager: TaskServerManager,
    private readonly stateManager: MultiChatStateManager,
    private readonly logger: VesperaLogger,
    private readonly errorHandler: VesperaErrorHandler
  ) {
    this.setupMCPEventHandlers();
  }

  /**
   * Initialize MCP integration
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing TaskChatIntegration');

      // Load configuration
      await this.loadConfiguration();

      // Connect to MCP server
      await this.connectToMCP();

      // Restore task mappings from session
      await this.restoreTaskMappings();

      // Setup periodic sync
      this.setupPeriodicSync();

      // Setup MCP event monitoring
      await this.setupMCPEventMonitoring();

      this.logger.info('TaskChatIntegration initialized successfully', {
        mcpStatus: this.mcpConnectionStatus,
        taskMappings: this.taskMappings.size,
        syncInterval: this.config.syncInterval
      });

    } catch (error) {
      this.logger.error('Failed to initialize TaskChatIntegration', error);
      this.mcpConnectionStatus = 'error';
      await this.errorHandler.handleError(error as Error);
    }
  }

  /**
   * Handle task created event
   */
  public async handleTaskCreated(taskData: MCPTaskData): Promise<void> {
    try {
      if (!this.config.enableAutoServerCreation) {
        this.logger.debug('Auto server creation disabled', { taskId: taskData.taskId });
        return;
      }

      this.logger.info('Handling task created', {
        taskId: taskData.taskId,
        taskType: taskData.taskType,
        expectedAgents: taskData.expectedAgents.length
      });

      // Create task server configuration
      const serverConfig: TaskServerConfig = {
        taskId: taskData.taskId,
        taskTitle: taskData.title,
        taskType: taskData.taskType,
        phase: taskData.phase,
        priority: taskData.priority,
        expectedAgents: taskData.expectedAgents.map(role => ({
          agentRole: role,
          agentName: this.getAgentName(role),
          capabilities: this.getAgentCapabilities(role)
        })),
        includeProgressChannel: this.config.enableProgressSync,
        includePlanningChannel: true,
        autoArchiveOnCompletion: this.config.enableTaskCompletion,
        templateId: this.config.serverTemplateOverrides[taskData.taskType]
      };

      // Create task server
      const server = await this.taskServerManager.createTaskServer(serverConfig);

      // Create task mapping
      const mapping: TaskChatMapping = {
        taskId: taskData.taskId,
        serverId: server.serverId,
        channels: server.channels.map(channel => ({
          agentRole: channel.agentRole || 'system',
          channelId: channel.channelId,
          lastActivity: Date.now(),
          messageCount: 0
        })),
        lastSync: Date.now(),
        syncErrors: 0
      };

      this.taskMappings.set(taskData.taskId, mapping);

      // Post initial task message to planning channel
      await this.postTaskInitializationMessage(taskData, server.serverId);

      // Save mapping to session
      await this.saveTaskMappings();

      this.logger.info('Task server created successfully', {
        taskId: taskData.taskId,
        serverId: server.serverId,
        channelCount: server.channels.length
      });

    } catch (error) {
      this.logger.error('Failed to handle task created', error, {
        taskId: taskData.taskId
      });
      throw error;
    }
  }

  /**
   * Handle agent deployed event
   */
  public async handleAgentDeployed(agentData: MCPAgentData): Promise<void> {
    try {
      if (!this.config.enableAgentChannelCreation) {
        this.logger.debug('Agent channel creation disabled', { 
          agentId: agentData.agentId 
        });
        return;
      }

      this.logger.info('Handling agent deployed', {
        agentId: agentData.agentId,
        agentRole: agentData.agentRole,
        taskId: agentData.taskId
      });

      const mapping = this.taskMappings.get(agentData.taskId);
      if (!mapping) {
        this.logger.warn('Task mapping not found for agent deployment', {
          taskId: agentData.taskId,
          agentId: agentData.agentId
        });
        return;
      }

      // Check if agent channel already exists
      const existingChannel = mapping.channels.find(c => c.agentRole === agentData.agentRole);
      if (existingChannel) {
        // Update existing channel mapping
        existingChannel.agentId = agentData.agentId;
        existingChannel.lastActivity = Date.now();
      } else {
        // Create new agent channel
        const agentConfig: AgentChannelConfig = {
          agentRole: agentData.agentRole,
          agentName: agentData.agentName,
          capabilities: agentData.capabilities
        };

        const channel = await this.taskServerManager.addAgentChannel(
          agentData.taskId,
          agentConfig
        );

        // Add to mapping
        mapping.channels.push({
          agentRole: agentData.agentRole,
          channelId: channel.channelId,
          agentId: agentData.agentId,
          lastActivity: Date.now(),
          messageCount: 0
        });
      }

      // Update agent progress state
      const channelId = existingChannel?.channelId || 
        (mapping.channels.length > 0 ? mapping.channels[mapping.channels.length - 1]?.channelId : undefined);
      
      if (channelId) {
        await this.stateManager.updateAgentProgress(
          channelId,
          {
            status: 'active',
            currentAction: 'Agent deployed and initializing',
            progressPercentage: 0
          }
        );
      }

      // Post agent deployment message
      await this.postAgentDeploymentMessage(agentData, mapping.serverId);

      // Save mapping
      await this.saveTaskMappings();

      this.logger.info('Agent channel created/updated successfully', {
        agentId: agentData.agentId,
        taskId: agentData.taskId,
        serverId: mapping.serverId
      });

    } catch (error) {
      this.logger.error('Failed to handle agent deployed', error, {
        agentId: agentData.agentId
      });
    }
  }

  /**
   * Handle task progress update
   */
  public async handleTaskProgressUpdate(progressData: MCPProgressData): Promise<void> {
    try {
      if (!this.config.enableProgressSync) {
        return;
      }

      this.logger.debug('Handling task progress update', {
        taskId: progressData.taskId,
        overallProgress: progressData.overallProgress
      });

      const mapping = this.taskMappings.get(progressData.taskId);
      if (!mapping) {
        this.logger.warn('Task mapping not found for progress update', {
          taskId: progressData.taskId
        });
        return;
      }

      // Create agent progress updates
      const agentUpdates: AgentProgressUpdate[] = [];
      for (const [agentRole, progress] of Object.entries(progressData.agentProgress)) {
        const channelMapping = mapping.channels.find(c => c.agentRole === agentRole);
        if (channelMapping) {
          agentUpdates.push({
            agentRole,
            channelId: channelMapping.channelId,
            status: progress >= 100 ? 'completed' : 'active',
            messagesSent: channelMapping.messageCount,
            lastActivity: Date.now()
          });

          // Update individual agent progress
          await this.stateManager.updateAgentProgress(channelMapping.channelId, {
            progressPercentage: progress,
            status: progress >= 100 ? 'completed' : 'active'
          });
        }
      }

      // Create task progress update
      const taskUpdate: TaskProgressUpdate = {
        taskId: progressData.taskId,
        status: this.mapMCPStatusToTaskStatus(progressData.overallProgress, progressData.blockers),
        progress: progressData.overallProgress,
        currentPhase: progressData.currentPhase,
        agentUpdates,
        messageCount: mapping.channels.reduce((sum, c) => sum + c.messageCount, 0),
        lastActivity: Date.now()
      };

      // Update task server progress
      await this.taskServerManager.updateTaskProgress(taskUpdate);

      // Post progress message to progress channel
      await this.postProgressUpdateMessage(progressData, mapping.serverId);

      // Update mapping
      mapping.lastSync = Date.now();
      await this.saveTaskMappings();

    } catch (error) {
      this.logger.error('Failed to handle task progress update', error, {
        taskId: progressData.taskId
      });
    }
  }

  /**
   * Handle task completion
   */
  public async handleTaskCompleted(taskData: MCPTaskData): Promise<void> {
    try {
      if (!this.config.enableTaskCompletion) {
        return;
      }

      this.logger.info('Handling task completed', {
        taskId: taskData.taskId,
        status: taskData.status
      });

      const mapping = this.taskMappings.get(taskData.taskId);
      if (!mapping) {
        this.logger.warn('Task mapping not found for completion', {
          taskId: taskData.taskId
        });
        return;
      }

      // Update all agent progress to completed
      for (const channel of mapping.channels) {
        if (channel.agentRole !== 'system') {
          await this.stateManager.updateAgentProgress(channel.channelId, {
            status: 'completed',
            progressPercentage: 100,
            currentAction: 'Task completed'
          });
        }
      }

      // Create final progress update
      const finalUpdate: TaskProgressUpdate = {
        taskId: taskData.taskId,
        status: taskData.status === 'completed' ? 'completed' : 'failed',
        progress: 100,
        agentUpdates: mapping.channels
          .filter(c => c.agentRole !== 'system')
          .map(c => ({
            agentRole: c.agentRole,
            channelId: c.channelId,
            status: 'completed' as const,
            messagesSent: c.messageCount,
            lastActivity: Date.now()
          })),
        messageCount: mapping.channels.reduce((sum, c) => sum + c.messageCount, 0),
        lastActivity: Date.now()
      };

      await this.taskServerManager.updateTaskProgress(finalUpdate);

      // Post completion message
      await this.postTaskCompletionMessage(taskData, mapping.serverId);

      // Archive the task server
      await this.taskServerManager.archiveTaskServer(taskData.taskId);

      // Remove from active mappings but keep in session history
      this.taskMappings.delete(taskData.taskId);
      await this.saveTaskMappings();

      this.logger.info('Task completion handled successfully', {
        taskId: taskData.taskId,
        status: taskData.status
      });

    } catch (error) {
      this.logger.error('Failed to handle task completed', error, {
        taskId: taskData.taskId
      });
    }
  }

  /**
   * Sync with MCP server
   */
  public async syncWithMCP(): Promise<void> {
    try {
      if (this.mcpConnectionStatus !== 'connected') {
        await this.connectToMCP();
      }

      // Get active tasks from MCP
      const activeTasks = await this.fetchActiveTasks();
      
      // Sync task mappings
      for (const task of activeTasks) {
        const mapping = this.taskMappings.get(task.taskId);
        if (!mapping) {
          // Create missing task server
          await this.handleTaskCreated(task);
        } else {
          // Update existing mapping
          await this.syncTaskMapping(task, mapping);
        }
      }

      // Remove mappings for completed/cancelled tasks
      for (const [taskId, _mapping] of this.taskMappings) {
        const task = activeTasks.find(t => t.taskId === taskId);
        if (!task || task.status === 'completed' || task.status === 'cancelled') {
          await this.handleTaskCompleted(task || { 
            taskId, 
            status: 'completed' 
          } as MCPTaskData);
        }
      }

      this.logger.debug('MCP sync completed', {
        activeTasks: activeTasks.length,
        mappings: this.taskMappings.size
      });

    } catch (error) {
      this.logger.error('MCP sync failed', error);
      this.mcpConnectionStatus = 'error';
      
      // Increment sync errors for all mappings
      for (const mapping of this.taskMappings.values()) {
        mapping.syncErrors++;
        
        // Remove mappings with too many errors
        if (mapping.syncErrors > this.config.maxSyncErrors) {
          this.taskMappings.delete(mapping.taskId);
        }
      }
    }
  }

  /**
   * Get task mapping by task ID
   */
  public getTaskMapping(taskId: string): TaskChatMapping | undefined {
    return this.taskMappings.get(taskId);
  }

  /**
   * Get all task mappings
   */
  public getAllTaskMappings(): TaskChatMapping[] {
    return Array.from(this.taskMappings.values());
  }

  /**
   * Get MCP connection status
   */
  public getMCPConnectionStatus(): string {
    return this.mcpConnectionStatus;
  }

  /**
   * Connect to MCP server
   */
  private async connectToMCP(): Promise<void> {
    try {
      this.mcpConnectionStatus = 'connecting';
      this.logger.info('Connecting to MCP server');

      // This would connect to the actual MCP server
      // For now, simulate connection
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.mcpConnectionStatus = 'connected';
      this.logger.info('Connected to MCP server successfully');

    } catch (error) {
      this.mcpConnectionStatus = 'error';
      this.logger.error('Failed to connect to MCP server', error);
      throw error;
    }
  }

  /**
   * Setup MCP event handlers
   */
  private setupMCPEventHandlers(): void {
    this.mcpEventHandlers.set('task_created', async (event) => {
      if (event.taskData) {
        await this.handleTaskCreated(event.taskData);
      }
    });

    this.mcpEventHandlers.set('agent_deployed', async (event) => {
      if (event.agentData) {
        await this.handleAgentDeployed(event.agentData);
      }
    });

    this.mcpEventHandlers.set('task_updated', async (event) => {
      if (event.progressData) {
        await this.handleTaskProgressUpdate(event.progressData);
      }
    });

    this.mcpEventHandlers.set('task_completed', async (event) => {
      if (event.taskData) {
        await this.handleTaskCompleted(event.taskData);
      }
    });

    this.mcpEventHandlers.set('task_failed', async (event) => {
      if (event.taskData) {
        await this.handleTaskCompleted(event.taskData);
      }
    });
  }

  /**
   * Setup MCP event monitoring
   */
  private async setupMCPEventMonitoring(): Promise<void> {
    // This would setup real MCP event listeners
    // For now, simulate with periodic polling
    this.logger.debug('MCP event monitoring setup completed');
  }

  /**
   * Setup periodic sync
   */
  private setupPeriodicSync(): void {
    this.syncTimer = setInterval(async () => {
      try {
        await this.syncWithMCP();
      } catch (error) {
        this.logger.error('Periodic sync failed', error);
      }
    }, this.config.syncInterval);
  }

  /**
   * Load configuration
   */
  private async loadConfiguration(): Promise<void> {
    const stored = this.context.globalState.get<Partial<IntegrationConfig>>('taskChatIntegration.config');
    if (stored) {
      this.config = { ...this.config, ...stored };
    }
  }


  /**
   * Restore task mappings from session
   */
  private async restoreTaskMappings(): Promise<void> {
    const session = this.persistenceManager.getCurrentSession();
    if (!session) {
      return;
    }

    // Restore mappings for active task servers
    for (const taskState of session.taskServerStates) {
      if (taskState.status === 'active') {
        const server = session.servers.find(s => s.serverId === taskState.serverId);
        if (server) {
          const mapping: TaskChatMapping = {
            taskId: taskState.taskId,
            serverId: taskState.serverId,
            channels: server.channels.map(channel => ({
              agentRole: channel.agentRole || 'system',
              channelId: channel.channelId,
              lastActivity: channel.lastActivity,
              messageCount: channel.messageCount
            })),
            lastSync: Date.now(),
            syncErrors: 0
          };

          this.taskMappings.set(taskState.taskId, mapping);
        }
      }
    }

    this.logger.info('Task mappings restored from session', {
      mappings: this.taskMappings.size
    });
  }

  /**
   * Save task mappings
   */
  private async saveTaskMappings(): Promise<void> {
    // Task mappings are saved through the session persistence manager
    // as part of the task server states
  }

  /**
   * Fetch active tasks from MCP
   */
  private async fetchActiveTasks(): Promise<MCPTaskData[]> {
    // This would fetch from actual MCP server
    // For now, return empty array
    return [];
  }

  /**
   * Sync task mapping with MCP data
   */
  private async syncTaskMapping(_task: MCPTaskData, mapping: TaskChatMapping): Promise<void> {
    // Update mapping with latest task data
    mapping.lastSync = Date.now();
    mapping.syncErrors = 0; // Reset errors on successful sync
  }

  /**
   * Post task initialization message
   */
  private async postTaskInitializationMessage(
    taskData: MCPTaskData,
    serverId: string
  ): Promise<void> {
    const message: MessageHistoryState = {
      messageId: `init_${taskData.taskId}_${Date.now()}`,
      serverId,
      channelId: '', // Would find planning channel
      content: `🚀 Task "${taskData.title}" initialized\n\nType: ${taskData.taskType}\nPriority: ${taskData.priority}\nExpected agents: ${taskData.expectedAgents.length}`,
      role: 'assistant',
      contextId: undefined,
      timestamp: Date.now(),
      sanitized: true
    };

    await this.persistenceManager.addMessage(message);
  }

  /**
   * Post agent deployment message
   */
  private async postAgentDeploymentMessage(
    agentData: MCPAgentData,
    serverId: string
  ): Promise<void> {
    const mapping = this.taskMappings.get(agentData.taskId);
    const channelMapping = mapping?.channels.find(c => c.agentRole === agentData.agentRole);
    
    if (channelMapping) {
      const message: MessageHistoryState = {
        messageId: `agent_deploy_${agentData.agentId}_${Date.now()}`,
        serverId,
        channelId: channelMapping.channelId,
        content: `🤖 ${agentData.agentName} (${agentData.agentRole}) has been deployed and is ready to assist.`,
        role: 'assistant',
        timestamp: Date.now(),
        sanitized: true
      };

      await this.persistenceManager.addMessage(message);
      channelMapping.messageCount++;
    }
  }

  /**
   * Post progress update message
   */
  private async postProgressUpdateMessage(
    progressData: MCPProgressData,
    _serverId: string
  ): Promise<void> {
    // Log progress update for now - future implementation would post to progress channel
    this.logger?.info(`Task Progress Update: ${progressData.overallProgress}%`, {
      taskId: progressData.taskId,
      progress: progressData.overallProgress
    });
  }

  /**
   * Post task completion message
   */
  private async postTaskCompletionMessage(
    taskData: MCPTaskData,
    _serverId: string
  ): Promise<void> {
    // Log task completion for now - future implementation would post to channel
    const emoji = taskData.status === 'completed' ? '✅' : '❌';
    this.logger?.info(`${emoji} Task "${taskData.title}" ${taskData.status}`, {
      taskId: taskData.taskId,
      status: taskData.status,
      title: taskData.title
    });
  }

  /**
   * Map MCP status to task status
   */
  private mapMCPStatusToTaskStatus(
    progress: number, 
    blockers: MCPBlocker[]
  ): 'initialized' | 'planning' | 'executing' | 'blocked' | 'completed' | 'failed' {
    if (blockers.some(b => b.severity === 'critical')) {
      return 'blocked';
    }
    
    if (progress >= 100) {
      return 'completed';
    } else if (progress > 0) {
      return 'executing';
    } else {
      return 'planning';
    }
  }

  /**
   * Get agent name for role
   */
  private getAgentName(role: string): string {
    const mapping = this.config.agentRoleMappings[role];
    return mapping || role.replace(/([A-Z])/g, ' $1').trim();
  }

  /**
   * Get agent capabilities for role
   */
  private getAgentCapabilities(role: string): string[] {
    // This would be configured based on the agent role
    const commonCapabilities = ['chat', 'progress_reporting'];
    const roleSpecificCapabilities: Record<string, string[]> = {
      'SessionPersistenceAgent': ['session_management', 'data_persistence'],
      'SecurityEnhancementAgent': ['security_audit', 'encryption', 'validation'],
      'UIEnhancementAgent': ['ui_design', 'user_experience', 'frontend_development']
    };
    
    return [...commonCapabilities, ...(roleSpecificCapabilities[role] || [])];
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
    
    this.disposables.forEach(d => d.dispose());
    this.disposables.length = 0;
    
    this.taskMappings.clear();
    this.mcpEventHandlers.clear();
    this.mcpConnectionStatus = 'disconnected';
    
    this.logger.info('TaskChatIntegration disposed');
  }
}