/**
 * Task Server Manager - Revolutionary Dynamic Task-Driven Server Architecture
 * 
 * Implements the innovative task-driven server system where:
 * - Each major task automatically spawns a "server" in the Discord-like interface
 * - Different agent threads within a task become "channels" within that task's server
 * - Codex system templates for dynamic server/channel management
 * - Regular servers for non-task conversations
 * - Live task monitoring with real-time agent progress visible as channel conversations
 */

import * as vscode from 'vscode';
import { VesperaLogger } from '../../core/logging/VesperaLogger';
import { VesperaErrorHandler } from '../../core/error-handling/VesperaErrorHandler';
import { SecurityEnhancedVesperaCoreServices } from '../../core/security/SecurityEnhancedCoreServices';
import { 
  ServerState, 
  ChannelState, 
  TaskServerState,
  SecureSessionPersistenceManager 
} from '../persistence/SecureSessionPersistenceManager';

// Task server configuration interfaces
export interface TaskServerConfig {
  taskId: string;
  taskTitle: string;
  taskType: string;
  phase?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  expectedAgents: AgentChannelConfig[];
  includeProgressChannel: boolean;
  includePlanningChannel: boolean;
  autoArchiveOnCompletion: boolean;
  templateId?: string;
}

export interface AgentChannelConfig {
  agentRole: string;
  agentName: string;
  capabilities: string[];
  channelTemplate?: string;
}

export interface TaskProgressUpdate {
  taskId: string;
  status: 'initialized' | 'planning' | 'executing' | 'blocked' | 'completed' | 'failed';
  progress: number; // 0-100
  currentPhase?: string;
  agentUpdates: AgentProgressUpdate[];
  messageCount: number;
  lastActivity: number;
}

export interface AgentProgressUpdate {
  agentRole: string;
  channelId: string;
  status: 'idle' | 'active' | 'waiting' | 'error' | 'completed';
  currentAction?: string;
  messagesSent: number;
  lastActivity: number;
}

export interface TaskServerTemplate {
  templateId: string;
  templateName: string;
  taskTypes: string[];
  serverNameTemplate: string;
  channelTemplates: ChannelTemplate[];
  autoCreateChannels: string[];
  permissions: TaskServerPermissions;
}

export interface ChannelTemplate {
  channelType: 'agent' | 'progress' | 'planning' | 'general';
  nameTemplate: string;
  agentRoles?: string[];
  autoCreate: boolean;
  permissions: ChannelPermissions;
}

export interface TaskServerPermissions {
  allowGuestAccess: boolean;
  restrictedRoles: string[];
  adminRoles: string[];
}

export interface ChannelPermissions {
  readRoles: string[];
  writeRoles: string[];
  adminRoles: string[];
}

export class TaskServerManager {
  private activeTaskServers: Map<string, TaskServerState> = new Map();
  private serverTemplates: Map<string, TaskServerTemplate> = new Map();
  private serverEventHandlers: Map<string, (event: TaskServerEvent) => void> = new Map();
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly persistenceManager: SecureSessionPersistenceManager,
    private readonly coreServices: SecurityEnhancedVesperaCoreServices,
    private readonly logger: VesperaLogger,
    private readonly errorHandler: VesperaErrorHandler
  ) {
    this.initializeDefaultTemplates();
  }

  /**
   * Create task server automatically when major task is initiated
   */
  public async createTaskServer(config: TaskServerConfig): Promise<ServerState> {
    try {
      this.logger.info('Creating task server', {
        taskId: config.taskId,
        taskType: config.taskType,
        phase: config.phase
      });

      // Get template for this task type
      const template = await this.getTaskTemplate(config.taskType, config.templateId);
      
      // Generate server name from template
      const serverName = this.generateServerName(template, config);
      
      // Create server state
      const serverId = `task_${config.taskId}_${Date.now()}`;
      const server: ServerState = {
        serverId,
        serverName,
        serverType: 'task',
        taskId: config.taskId,
        channels: [],
        createdAt: Date.now(),
        lastActivity: Date.now(),
        archived: false
      };

      // Create initial channels based on template and config
      const channels = await this.createInitialChannels(template, config);
      server.channels = channels;

      // Create task server state for tracking
      const taskServerState: TaskServerState = {
        taskId: config.taskId,
        serverId,
        taskType: config.taskType,
        phase: config.phase,
        agentChannels: channels
          .filter(c => c.channelType === 'agent')
          .map(c => c.channelId),
        progressChannelId: channels.find(c => c.channelType === 'progress')?.channelId,
        planningChannelId: channels.find(c => c.channelType === 'planning')?.channelId,
        status: 'active',
        createdAt: Date.now()
      };

      // Store in active servers and persistence
      this.activeTaskServers.set(config.taskId, taskServerState);
      await this.persistenceManager.addServer(server);

      // Emit server created event
      this.emitServerEvent({
        type: 'taskServerCreated',
        taskId: config.taskId,
        serverId,
        data: { server, taskState: taskServerState }
      });

      this.logger.info('Task server created successfully', {
        taskId: config.taskId,
        serverId,
        channelCount: channels.length
      });

      return server;

    } catch (error) {
      this.logger.error('Failed to create task server', error, {
        taskId: config.taskId
      });
      await this.errorHandler.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Add agent channel to existing task server
   */
  public async addAgentChannel(
    taskId: string, 
    agentConfig: AgentChannelConfig
  ): Promise<ChannelState> {
    try {
      const taskServerState = this.activeTaskServers.get(taskId);
      if (!taskServerState) {
        throw new Error(`Task server not found: ${taskId}`);
      }

      // Generate channel name
      const channelName = `${agentConfig.agentRole}-${agentConfig.agentName}`;
      const channelId = `agent_${taskId}_${agentConfig.agentRole}_${Date.now()}`;

      // Create agent channel
      const channel: ChannelState = {
        channelId,
        channelName,
        channelType: 'agent',
        agentRole: agentConfig.agentRole,
        messageCount: 0,
        lastActivity: Date.now()
      };

      // Add to task server and persistence
      taskServerState.agentChannels.push(channelId);
      await this.persistenceManager.addChannel(taskServerState.serverId, channel);

      // Emit channel created event
      this.emitServerEvent({
        type: 'agentChannelAdded',
        taskId,
        serverId: taskServerState.serverId,
        data: { channel, agentConfig }
      });

      this.logger.info('Agent channel added', {
        taskId,
        channelId,
        agentRole: agentConfig.agentRole
      });

      return channel;

    } catch (error) {
      this.logger.error('Failed to add agent channel', error, {
        taskId,
        agentRole: agentConfig.agentRole
      });
      throw error;
    }
  }

  /**
   * Update task progress and notify channels
   */
  public async updateTaskProgress(update: TaskProgressUpdate): Promise<void> {
    try {
      const taskServerState = this.activeTaskServers.get(update.taskId);
      if (!taskServerState) {
        this.logger.warn('Task server not found for progress update', {
          taskId: update.taskId
        });
        return;
      }

      // Update task server status
      if (update.status === 'completed') {
        taskServerState.status = 'completed';
        taskServerState.completedAt = Date.now();
      } else if (update.status === 'failed') {
        taskServerState.status = 'completed'; // Archive failed tasks too
        taskServerState.completedAt = Date.now();
      }

      // Update phase if provided
      if (update.currentPhase) {
        taskServerState.phase = update.currentPhase;
      }

      // Emit progress update to all channels
      this.emitServerEvent({
        type: 'taskProgressUpdated',
        taskId: update.taskId,
        serverId: taskServerState.serverId,
        data: update
      });

      // Auto-archive if configured and completed
      if (update.status === 'completed' || update.status === 'failed') {
        const session = this.persistenceManager.getCurrentSession();
        const server = session?.servers.find(s => s.serverId === taskServerState.serverId);
        
        if (server) {
          // Check if auto-archive is enabled (would come from task config)
          await this.archiveTaskServer(update.taskId);
        }
      }

      this.logger.debug('Task progress updated', {
        taskId: update.taskId,
        status: update.status,
        progress: update.progress
      });

    } catch (error) {
      this.logger.error('Failed to update task progress', error, {
        taskId: update.taskId
      });
    }
  }

  /**
   * Archive completed task server
   */
  public async archiveTaskServer(taskId: string): Promise<void> {
    try {
      const taskServerState = this.activeTaskServers.get(taskId);
      if (!taskServerState) {
        throw new Error(`Task server not found: ${taskId}`);
      }

      // Archive in persistence
      await this.persistenceManager.archiveTaskServer(taskId);

      // Remove from active tracking
      this.activeTaskServers.delete(taskId);

      // Emit archive event
      this.emitServerEvent({
        type: 'taskServerArchived',
        taskId,
        serverId: taskServerState.serverId,
        data: { taskServerState }
      });

      this.logger.info('Task server archived', {
        taskId,
        serverId: taskServerState.serverId,
        completedAt: taskServerState.completedAt
      });

    } catch (error) {
      this.logger.error('Failed to archive task server', error, { taskId });
      throw error;
    }
  }

  /**
   * Get active task servers
   */
  public getActiveTaskServers(): TaskServerState[] {
    return Array.from(this.activeTaskServers.values());
  }

  /**
   * Get task server by task ID
   */
  public getTaskServer(taskId: string): TaskServerState | undefined {
    return this.activeTaskServers.get(taskId);
  }

  /**
   * Register server event handler
   */
  public onServerEvent(
    eventType: string, 
    handler: (event: TaskServerEvent) => void
  ): vscode.Disposable {
    const key = `${eventType}_${Date.now()}`;
    this.serverEventHandlers.set(key, handler);
    
    return new vscode.Disposable(() => {
      this.serverEventHandlers.delete(key);
    });
  }

  /**
   * Initialize from restored session
   */
  public async initializeFromSession(): Promise<void> {
    try {
      const session = this.persistenceManager.getCurrentSession();
      if (!session) {
        return;
      }

      // Restore active task servers
      for (const taskState of session.taskServerStates) {
        if (taskState.status === 'active') {
          this.activeTaskServers.set(taskState.taskId, taskState);
        }
      }

      this.logger.info('Task servers initialized from session', {
        activeServers: this.activeTaskServers.size,
        totalTaskStates: session.taskServerStates.length
      });

    } catch (error) {
      this.logger.error('Failed to initialize from session', error);
    }
  }

  /**
   * Generate server name from template and config
   */
  private generateServerName(template: TaskServerTemplate, config: TaskServerConfig): string {
    let name = template.serverNameTemplate;
    
    // Replace template variables
    name = name.replace('{taskTitle}', config.taskTitle);
    name = name.replace('{taskType}', config.taskType);
    name = name.replace('{phase}', config.phase || '');
    name = name.replace('{priority}', config.priority);
    
    return name.trim();
  }

  /**
   * Create initial channels for task server
   */
  private async createInitialChannels(
    template: TaskServerTemplate,
    config: TaskServerConfig
  ): Promise<ChannelState[]> {
    const channels: ChannelState[] = [];
    const timestamp = Date.now();

    // Create channels from template
    for (const channelTemplate of template.channelTemplates) {
      if (!channelTemplate.autoCreate) continue;

      if (channelTemplate.channelType === 'agent') {
        // Create agent channels for expected agents
        for (const agentConfig of config.expectedAgents) {
          if (channelTemplate.agentRoles?.includes(agentConfig.agentRole) || !channelTemplate.agentRoles) {
            const channelId = `agent_${config.taskId}_${agentConfig.agentRole}_${timestamp}`;
            const channelName = channelTemplate.nameTemplate
              .replace('{agentRole}', agentConfig.agentRole)
              .replace('{agentName}', agentConfig.agentName);

            channels.push({
              channelId,
              channelName,
              channelType: 'agent',
              agentRole: agentConfig.agentRole,
              messageCount: 0,
              lastActivity: timestamp
            });
          }
        }
      } else {
        // Create other channel types
        const channelId = `${channelTemplate.channelType}_${config.taskId}_${timestamp}`;
        const channelName = channelTemplate.nameTemplate
          .replace('{taskType}', config.taskType)
          .replace('{phase}', config.phase || '');

        channels.push({
          channelId,
          channelName,
          channelType: channelTemplate.channelType,
          messageCount: 0,
          lastActivity: timestamp
        });
      }
    }

    // Add progress channel if requested
    if (config.includeProgressChannel) {
      channels.push({
        channelId: `progress_${config.taskId}_${timestamp}`,
        channelName: 'Task Progress',
        channelType: 'progress',
        messageCount: 0,
        lastActivity: timestamp
      });
    }

    // Add planning channel if requested
    if (config.includePlanningChannel) {
      channels.push({
        channelId: `planning_${config.taskId}_${timestamp}`,
        channelName: 'Planning & Architecture',
        channelType: 'planning',
        messageCount: 0,
        lastActivity: timestamp
      });
    }

    return channels;
  }

  /**
   * Get task template for task type
   */
  private async getTaskTemplate(
    taskType: string, 
    templateId?: string
  ): Promise<TaskServerTemplate> {
    // Try specific template first
    if (templateId && this.serverTemplates.has(templateId)) {
      return this.serverTemplates.get(templateId)!;
    }

    // Find template by task type
    for (const template of this.serverTemplates.values()) {
      if (template.taskTypes.includes(taskType)) {
        return template;
      }
    }

    // Return default template
    return this.serverTemplates.get('default')!;
  }

  /**
   * Initialize default server templates
   */
  private initializeDefaultTemplates(): void {
    // Default template
    this.serverTemplates.set('default', {
      templateId: 'default',
      templateName: 'Default Task Server',
      taskTypes: ['*'],
      serverNameTemplate: '{taskTitle}',
      channelTemplates: [
        {
          channelType: 'general',
          nameTemplate: 'General Discussion',
          autoCreate: true,
          permissions: {
            readRoles: ['*'],
            writeRoles: ['*'],
            adminRoles: ['admin']
          }
        }
      ],
      autoCreateChannels: ['general'],
      permissions: {
        allowGuestAccess: true,
        restrictedRoles: [],
        adminRoles: ['admin']
      }
    });

    // Phase-specific templates
    this.serverTemplates.set('phase', {
      templateId: 'phase',
      templateName: 'Phase Development Server',
      taskTypes: ['phase1', 'phase2', 'phase3', 'phase4'],
      serverNameTemplate: '{phase}: {taskTitle}',
      channelTemplates: [
        {
          channelType: 'planning',
          nameTemplate: 'Planning & Architecture',
          autoCreate: true,
          permissions: {
            readRoles: ['*'],
            writeRoles: ['architect', 'lead'],
            adminRoles: ['admin']
          }
        },
        {
          channelType: 'agent',
          nameTemplate: '{agentRole} Agent',
          agentRoles: ['SessionPersistenceAgent', 'SecurityEnhancementAgent', 'UIEnhancementAgent'],
          autoCreate: false, // Created dynamically
          permissions: {
            readRoles: ['*'],
            writeRoles: ['{agentRole}', 'admin'],
            adminRoles: ['admin']
          }
        },
        {
          channelType: 'progress',
          nameTemplate: 'Progress Tracking',
          autoCreate: true,
          permissions: {
            readRoles: ['*'],
            writeRoles: ['agent', 'admin'],
            adminRoles: ['admin']
          }
        }
      ],
      autoCreateChannels: ['planning', 'progress'],
      permissions: {
        allowGuestAccess: false,
        restrictedRoles: ['guest'],
        adminRoles: ['admin', 'lead']
      }
    });

    // Research template
    this.serverTemplates.set('research', {
      templateId: 'research',
      templateName: 'Research & Investigation Server',
      taskTypes: ['research', 'investigation', 'analysis'],
      serverNameTemplate: 'Research: {taskTitle}',
      channelTemplates: [
        {
          channelType: 'general',
          nameTemplate: 'Research Discussion',
          autoCreate: true,
          permissions: {
            readRoles: ['*'],
            writeRoles: ['*'],
            adminRoles: ['admin']
          }
        },
        {
          channelType: 'agent',
          nameTemplate: '{agentRole}',
          autoCreate: false,
          permissions: {
            readRoles: ['*'],
            writeRoles: ['{agentRole}', 'admin'],
            adminRoles: ['admin']
          }
        }
      ],
      autoCreateChannels: ['general'],
      permissions: {
        allowGuestAccess: true,
        restrictedRoles: [],
        adminRoles: ['admin']
      }
    });

    this.logger.info('Default task server templates initialized', {
      templateCount: this.serverTemplates.size
    });
  }

  /**
   * Emit server event to handlers
   */
  private emitServerEvent(event: TaskServerEvent): void {
    for (const handler of this.serverEventHandlers.values()) {
      try {
        handler(event);
      } catch (error) {
        this.logger.error('Server event handler error', error, {
          eventType: event.type,
          taskId: event.taskId
        });
      }
    }
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables.length = 0;
    
    this.activeTaskServers.clear();
    this.serverEventHandlers.clear();
    
    this.logger.info('TaskServerManager disposed');
  }
}

// Event interfaces
export interface TaskServerEvent {
  type: 'taskServerCreated' | 'agentChannelAdded' | 'taskProgressUpdated' | 'taskServerArchived';
  taskId: string;
  serverId: string;
  data: any;
}