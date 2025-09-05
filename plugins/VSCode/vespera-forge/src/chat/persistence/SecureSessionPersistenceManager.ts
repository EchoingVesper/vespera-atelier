/**
 * Secure Session Persistence Manager for VS Code Chat Sessions
 * Resolves Issue #40: Session context does not persist through VS Code restart
 * 
 * Features:
 * - VS Code SecretStorage integration for encrypted session data
 * - Multi-server/channel state management 
 * - File context restoration with secure path validation
 * - Message history preservation with content sanitization
 * - Task-server state tracking for dynamic server lifecycle management
 */

import * as vscode from 'vscode';
import { VesperaLogger } from '../../core/logging/VesperaLogger';
import { VesperaErrorHandler } from '../../core/error-handling/VesperaErrorHandler';
import { VesperaInputSanitizer } from '../../core/security/sanitization/VesperaInputSanitizer';
import { SanitizationScope } from '../../types/security';

// Session data interfaces
export interface ChatSession {
  sessionId: string;
  timestamp: number;
  servers: ServerState[];
  activeServerId?: string;
  activeChannelId?: string;
  fileContexts: FileContextState[];
  messageHistory: MessageHistoryState[];
  taskServerStates: TaskServerState[];
  userPreferences: SessionUserPreferences;
}

export interface ServerState {
  serverId: string;
  serverName: string;
  serverType: 'task' | 'regular';
  taskId?: string; // For task-spawned servers
  channels: ChannelState[];
  createdAt: number;
  lastActivity: number;
  archived: boolean;
}

export interface ChannelState {
  channelId: string;
  channelName: string;
  channelType: 'agent' | 'progress' | 'planning' | 'dm' | 'general';
  agentRole?: string; // For agent channels
  messageCount: number;
  lastMessage?: string;
  lastActivity: number;
}

export interface TaskServerState {
  taskId: string;
  serverId: string;
  taskType: string;
  phase?: string;
  agentChannels: string[];
  progressChannelId?: string;
  planningChannelId?: string;
  status: 'active' | 'completed' | 'archived';
  createdAt: number;
  completedAt?: number;
}

export interface FileContextState {
  contextId: string;
  filePaths: string[];
  contextSummary: string;
  timestamp: number;
  associatedMessageId?: string;
  sanitized: boolean;
  threatCount: number;
}

export interface MessageHistoryState {
  messageId: string;
  serverId: string;
  channelId: string;
  content: string;
  role: 'user' | 'assistant';
  providerId?: string;
  contextId?: string;
  timestamp: number;
  sanitized: boolean;
}

export interface SessionUserPreferences {
  defaultServerId?: string;
  collapsedServers: string[];
  hiddenChannels: string[];
  notificationSettings: {
    taskProgress: boolean;
    agentActivity: boolean;
    newMessages: boolean;
  };
}

export interface SessionSecurityMetadata {
  encryptionVersion: string;
  lastValidation: number;
  integrityHash: string;
  accessCount: number;
  lastAccess: number;
}

export class SecureSessionPersistenceManager {
  private static readonly STORAGE_KEY = 'vesperaForge.chatSession';
  private static readonly SECURITY_KEY = 'vesperaForge.sessionSecurity';
  private static readonly MAX_HISTORY_MESSAGES = 1000;
  private static readonly MAX_FILE_CONTEXTS = 100;
  private static readonly SESSION_VALIDATION_INTERVAL = 300000; // 5 minutes

  private sessionValidationTimer?: NodeJS.Timeout;
  private currentSession?: ChatSession;
  private securityMetadata?: SessionSecurityMetadata;
  
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logger: VesperaLogger,
    private readonly errorHandler: VesperaErrorHandler
  ) {
    this.setupPeriodicValidation();
  }

  /**
   * Initialize session persistence and restore previous session if available
   */
  public async initializeSession(): Promise<ChatSession> {
    try {
      this.logger.info('Initializing secure session persistence');

      // Try to restore previous session
      const restoredSession = await this.restoreSession();
      
      if (restoredSession) {
        this.logger.info('Session restored successfully', {
          sessionId: restoredSession.sessionId,
          servers: restoredSession.servers.length,
          taskServers: restoredSession.taskServerStates.length,
          messageHistory: restoredSession.messageHistory.length
        });
        
        this.currentSession = restoredSession;
        return restoredSession;
      }

      // Create new session if restoration failed
      const newSession = await this.createNewSession();
      this.currentSession = newSession;
      
      this.logger.info('New session created', {
        sessionId: newSession.sessionId
      });

      return newSession;
      
    } catch (error) {
      this.logger.error('Session initialization failed', error);
      await this.errorHandler.handleError(error as Error);
      
      // Create minimal session as fallback
      const fallbackSession = await this.createFallbackSession();
      this.currentSession = fallbackSession;
      return fallbackSession;
    }
  }

  /**
   * Save current session state securely
   */
  public async saveSession(session: ChatSession): Promise<void> {
    try {
      // Update current session reference
      this.currentSession = { ...session, timestamp: Date.now() };
      
      // Sanitize session data before storage
      const sanitizedSession = await this.sanitizeSessionData(this.currentSession);
      
      // Encrypt session data
      const encryptedData = await this.encryptSessionData(sanitizedSession);
      
      // Store in VS Code SecretStorage
      await this.context.secrets.store(SecureSessionPersistenceManager.STORAGE_KEY, encryptedData);
      
      // Update security metadata
      await this.updateSecurityMetadata(sanitizedSession);
      
      this.logger.debug('Session saved successfully', {
        sessionId: session.sessionId,
        servers: session.servers.length,
        messages: session.messageHistory.length
      });
      
    } catch (error) {
      this.logger.error('Session save failed', error, {
        sessionId: session.sessionId
      });
      throw error;
    }
  }

  /**
   * Add server to current session
   */
  public async addServer(server: ServerState): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    // Validate server data
    await this.validateServerState(server);
    
    // Add to current session
    this.currentSession.servers.push(server);
    
    // If this is a task server, add task state tracking
    if (server.serverType === 'task' && server.taskId) {
      const taskServerState: TaskServerState = {
        taskId: server.taskId,
        serverId: server.serverId,
        taskType: 'unknown', // Will be updated by task integration
        agentChannels: server.channels
          .filter(c => c.channelType === 'agent')
          .map(c => c.channelId),
        status: 'active',
        createdAt: Date.now()
      };
      
      this.currentSession.taskServerStates.push(taskServerState);
    }
    
    await this.saveSession(this.currentSession);
    
    this.logger.info('Server added to session', {
      serverId: server.serverId,
      serverType: server.serverType,
      taskId: server.taskId
    });
  }

  /**
   * Add channel to existing server
   */
  public async addChannel(serverId: string, channel: ChannelState): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    const server = this.currentSession.servers.find(s => s.serverId === serverId);
    if (!server) {
      throw new Error(`Server not found: ${serverId}`);
    }

    // Validate channel data
    await this.validateChannelState(channel);
    
    // Add channel to server
    server.channels.push(channel);
    server.lastActivity = Date.now();
    
    // Update task server state if this is an agent channel
    if (server.serverType === 'task' && channel.channelType === 'agent') {
      const taskState = this.currentSession.taskServerStates.find(t => t.serverId === serverId);
      if (taskState) {
        taskState.agentChannels.push(channel.channelId);
      }
    }
    
    await this.saveSession(this.currentSession);
    
    this.logger.info('Channel added to server', {
      serverId,
      channelId: channel.channelId,
      channelType: channel.channelType
    });
  }

  /**
   * Archive completed task server
   */
  public async archiveTaskServer(taskId: string): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    // Find and archive task server
    const taskState = this.currentSession.taskServerStates.find(t => t.taskId === taskId);
    if (taskState) {
      taskState.status = 'archived';
      taskState.completedAt = Date.now();
    }
    
    // Archive the server itself
    const server = this.currentSession.servers.find(s => s.serverId === taskState?.serverId);
    if (server) {
      server.archived = true;
      server.lastActivity = Date.now();
    }
    
    await this.saveSession(this.currentSession);
    
    this.logger.info('Task server archived', {
      taskId,
      serverId: taskState?.serverId
    });
  }

  /**
   * Add direct message to history (converts to MessageHistoryState)
   */
  public async addDirectMessage(dmData: { messageId: string; content: string; fromUserId: string; toUserId: string; timestamp: number; }): Promise<void> {
    const messageState: MessageHistoryState = {
      messageId: dmData.messageId,
      serverId: `dm-${dmData.fromUserId}-${dmData.toUserId}`,
      channelId: `dm-${dmData.fromUserId}-${dmData.toUserId}`,
      content: dmData.content,
      role: 'user',
      timestamp: dmData.timestamp,
      sanitized: false
    };
    await this.addMessage(messageState);
  }

  /**
   * Add message to history
   */
  public async addMessage(message: MessageHistoryState): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    // Sanitize message content
    const sanitizedMessage = await this.sanitizeMessage(message);
    
    // Add to history
    this.currentSession.messageHistory.push(sanitizedMessage);
    
    // Trim history if too large
    if (this.currentSession.messageHistory.length > SecureSessionPersistenceManager.MAX_HISTORY_MESSAGES) {
      this.currentSession.messageHistory = this.currentSession.messageHistory
        .slice(-SecureSessionPersistenceManager.MAX_HISTORY_MESSAGES);
    }
    
    // Update server/channel activity
    const server = this.currentSession.servers.find(s => s.serverId === message.serverId);
    if (server) {
      server.lastActivity = Date.now();
      const channel = server.channels.find(c => c.channelId === message.channelId);
      if (channel) {
        channel.messageCount++;
        channel.lastMessage = message.content.substring(0, 100);
        channel.lastActivity = Date.now();
      }
    }
    
    await this.saveSession(this.currentSession);
  }

  /**
   * Add file context to session
   */
  public async addFileContext(fileContext: FileContextState): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    // Validate file paths for security
    const validatedContext = await this.validateFileContext(fileContext);
    
    // Add to session
    this.currentSession.fileContexts.push(validatedContext);
    
    // Trim contexts if too many
    if (this.currentSession.fileContexts.length > SecureSessionPersistenceManager.MAX_FILE_CONTEXTS) {
      this.currentSession.fileContexts = this.currentSession.fileContexts
        .slice(-SecureSessionPersistenceManager.MAX_FILE_CONTEXTS);
    }
    
    await this.saveSession(this.currentSession);
  }

  /**
   * Get current session
   */
  public getCurrentSession(): ChatSession | undefined {
    return this.currentSession;
  }

  /**
   * Get server by ID
   */
  public getServer(serverId: string): ServerState | undefined {
    return this.currentSession?.servers.find(s => s.serverId === serverId);
  }

  /**
   * Get task server states
   */
  public getTaskServerStates(): TaskServerState[] {
    return this.currentSession?.taskServerStates || [];
  }

  /**
   * Get message history for channel
   */
  public getChannelHistory(serverId: string, channelId: string): MessageHistoryState[] {
    if (!this.currentSession) {
      return [];
    }
    
    return this.currentSession.messageHistory.filter(
      m => m.serverId === serverId && m.channelId === channelId
    );
  }

  /**
   * Clear session data (for testing or reset)
   */
  public async clearSession(): Promise<void> {
    try {
      await this.context.secrets.delete(SecureSessionPersistenceManager.STORAGE_KEY);
      await this.context.secrets.delete(SecureSessionPersistenceManager.SECURITY_KEY);
      
      this.currentSession = undefined;
      this.securityMetadata = undefined;
      
      this.logger.info('Session cleared successfully');
      
    } catch (error) {
      this.logger.error('Failed to clear session', error);
      throw error;
    }
  }

  /**
   * Restore session from secure storage
   */
  private async restoreSession(): Promise<ChatSession | null> {
    try {
      const encryptedData = await this.context.secrets.get(SecureSessionPersistenceManager.STORAGE_KEY);
      if (!encryptedData) {
        this.logger.debug('No previous session found');
        return null;
      }

      // Validate security metadata first
      const securityValid = await this.validateSecurityMetadata();
      if (!securityValid) {
        this.logger.warn('Session security validation failed, creating new session');
        await this.clearSession();
        return null;
      }

      // Decrypt session data
      const sessionData = await this.decryptSessionData(encryptedData);
      
      // Validate session integrity
      const validSession = await this.validateSessionIntegrity(sessionData);
      if (!validSession) {
        this.logger.warn('Session integrity validation failed');
        await this.clearSession();
        return null;
      }

      return sessionData;
      
    } catch (error) {
      this.logger.error('Session restoration failed', error);
      await this.clearSession();
      return null;
    }
  }

  /**
   * Create new empty session
   */
  private async createNewSession(): Promise<ChatSession> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newSession: ChatSession = {
      sessionId,
      timestamp: Date.now(),
      servers: [],
      fileContexts: [],
      messageHistory: [],
      taskServerStates: [],
      userPreferences: {
        collapsedServers: [],
        hiddenChannels: [],
        notificationSettings: {
          taskProgress: true,
          agentActivity: true,
          newMessages: true
        }
      }
    };

    await this.saveSession(newSession);
    return newSession;
  }

  /**
   * Create minimal fallback session
   */
  private async createFallbackSession(): Promise<ChatSession> {
    const sessionId = `fallback_${Date.now()}`;
    
    return {
      sessionId,
      timestamp: Date.now(),
      servers: [],
      fileContexts: [],
      messageHistory: [],
      taskServerStates: [],
      userPreferences: {
        collapsedServers: [],
        hiddenChannels: [],
        notificationSettings: {
          taskProgress: false,
          agentActivity: false,
          newMessages: false
        }
      }
    };
  }

  /**
   * Encrypt session data for secure storage
   */
  private async encryptSessionData(session: ChatSession): Promise<string> {
    // Use VS Code's built-in encryption through SecretStorage
    // The data is automatically encrypted when stored
    return JSON.stringify(session);
  }

  /**
   * Decrypt session data from storage
   */
  private async decryptSessionData(encryptedData: string): Promise<ChatSession> {
    // VS Code SecretStorage automatically decrypts
    return JSON.parse(encryptedData) as ChatSession;
  }

  /**
   * Sanitize session data before storage
   */
  private async sanitizeSessionData(session: ChatSession): Promise<ChatSession> {
    const sanitizer = VesperaInputSanitizer.getInstance();
    
    // Sanitize message history
    const sanitizedMessages = await Promise.all(
      session.messageHistory.map(async (msg) => {
        const sanitizedContent = await sanitizer.sanitize(msg.content, SanitizationScope.MESSAGE);
        return {
          ...msg,
          content: sanitizedContent.sanitized,
          sanitized: true
        };
      })
    );
    
    // Sanitize server names
    const sanitizedServers = await Promise.all(
      session.servers.map(async (server) => {
        const sanitizedServerName = await sanitizer.sanitize(server.serverName, SanitizationScope.USER_INPUT);
        return {
          ...server,
          serverName: sanitizedServerName.sanitized,
          channels: await Promise.all(server.channels.map(async (channel) => {
            const sanitizedChannelName = await sanitizer.sanitize(channel.channelName, SanitizationScope.USER_INPUT);
            const sanitizedLastMessage = channel.lastMessage 
              ? await sanitizer.sanitize(channel.lastMessage, SanitizationScope.MESSAGE)
              : null;
            return {
              ...channel,
              channelName: sanitizedChannelName.sanitized,
              lastMessage: sanitizedLastMessage?.sanitized
            };
          }))
        };
      })
    );
    
    return {
      ...session,
      servers: sanitizedServers,
      messageHistory: sanitizedMessages
    };
  }

  /**
   * Validate server state data
   */
  private async validateServerState(server: ServerState): Promise<void> {
    if (!server.serverId || !server.serverName) {
      throw new Error('Invalid server state: missing required fields');
    }
    
    if (!['task', 'regular'].includes(server.serverType)) {
      throw new Error('Invalid server type');
    }
    
    if (server.serverType === 'task' && !server.taskId) {
      throw new Error('Task server must have taskId');
    }
  }

  /**
   * Validate channel state data
   */
  private async validateChannelState(channel: ChannelState): Promise<void> {
    if (!channel.channelId || !channel.channelName) {
      throw new Error('Invalid channel state: missing required fields');
    }
    
    const validTypes = ['agent', 'progress', 'planning', 'dm', 'general'];
    if (!validTypes.includes(channel.channelType)) {
      throw new Error('Invalid channel type');
    }
    
    if (channel.channelType === 'agent' && !channel.agentRole) {
      throw new Error('Agent channel must have agentRole');
    }
  }

  /**
   * Validate file context for security
   */
  private async validateFileContext(context: FileContextState): Promise<FileContextState> {
    // Validate file paths are within allowed directories
    const validatedPaths = await Promise.all(
      context.filePaths.map(async (path) => {
        // Basic path validation
        if (!path || path.includes('..') || path.includes('<') || path.includes('>')) {
          throw new Error(`Invalid file path: ${path}`);
        }
        return path;
      })
    );
    
    return {
      ...context,
      filePaths: validatedPaths,
      sanitized: true
    };
  }

  /**
   * Sanitize message before adding to history
   */
  private async sanitizeMessage(message: MessageHistoryState): Promise<MessageHistoryState> {
    const sanitizer = VesperaInputSanitizer.getInstance();
    
    const sanitizedContent = await sanitizer.sanitize(message.content, SanitizationScope.MESSAGE, { 
      preserveFormatting: true 
    });
    
    return {
      ...message,
      content: sanitizedContent.sanitized,
      sanitized: true
    };
  }

  /**
   * Validate security metadata
   */
  private async validateSecurityMetadata(): Promise<boolean> {
    try {
      const metadataStr = await this.context.secrets.get(SecureSessionPersistenceManager.SECURITY_KEY);
      if (!metadataStr) {
        return false;
      }
      
      const metadata: SessionSecurityMetadata = JSON.parse(metadataStr);
      
      // Check if validation is still valid
      const timeSinceValidation = Date.now() - metadata.lastValidation;
      if (timeSinceValidation > SecureSessionPersistenceManager.SESSION_VALIDATION_INTERVAL) {
        return false;
      }
      
      this.securityMetadata = metadata;
      return true;
      
    } catch (error) {
      this.logger.error('Security metadata validation failed', error);
      return false;
    }
  }

  /**
   * Update security metadata
   */
  private async updateSecurityMetadata(session: ChatSession): Promise<void> {
    const metadata: SessionSecurityMetadata = {
      encryptionVersion: '1.0',
      lastValidation: Date.now(),
      integrityHash: await this.calculateIntegrityHash(session),
      accessCount: (this.securityMetadata?.accessCount || 0) + 1,
      lastAccess: Date.now()
    };
    
    await this.context.secrets.store(
      SecureSessionPersistenceManager.SECURITY_KEY,
      JSON.stringify(metadata)
    );
    
    this.securityMetadata = metadata;
  }

  /**
   * Calculate integrity hash for session
   */
  private async calculateIntegrityHash(session: ChatSession): Promise<string> {
    const crypto = await import('crypto');
    const sessionString = JSON.stringify({
      sessionId: session.sessionId,
      timestamp: session.timestamp,
      serverCount: session.servers.length,
      messageCount: session.messageHistory.length
    });
    
    return crypto.createHash('sha256').update(sessionString).digest('hex');
  }

  /**
   * Validate session integrity
   */
  private async validateSessionIntegrity(session: ChatSession): Promise<boolean> {
    if (!this.securityMetadata) {
      return false;
    }
    
    const currentHash = await this.calculateIntegrityHash(session);
    return currentHash === this.securityMetadata.integrityHash;
  }

  /**
   * Setup periodic validation
   */
  private setupPeriodicValidation(): void {
    this.sessionValidationTimer = setInterval(async () => {
      try {
        if (this.currentSession) {
          await this.saveSession(this.currentSession);
          this.logger.debug('Periodic session validation completed');
        }
      } catch (error) {
        this.logger.error('Periodic session validation failed', error);
      }
    }, SecureSessionPersistenceManager.SESSION_VALIDATION_INTERVAL);
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    if (this.sessionValidationTimer) {
      clearInterval(this.sessionValidationTimer);
      this.sessionValidationTimer = undefined;
    }
    
    this.logger.info('SecureSessionPersistenceManager disposed');
  }
}