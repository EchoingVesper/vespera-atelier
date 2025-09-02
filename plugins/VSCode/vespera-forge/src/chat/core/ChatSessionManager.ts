/**
 * Chat Session Manager - Handles chat session lifecycle and management
 * Provides session creation, switching, and organization
 */

import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { 
  ChatSession, 
  SessionSummary,
  SessionFilter,
  SessionEvent,
  SessionEventType,
  SessionExportOptions,
  SessionImportResult
} from '../types/chat';
import { ChatHistoryManager } from './ChatHistoryManager';

export class ChatSessionManager extends EventEmitter {
  private static readonly STORAGE_KEY = 'vespera-forge.chat.sessions';
  private static readonly DEFAULT_SESSION_TITLE = 'New Chat';
  private static readonly MAX_SESSIONS = 100;

  private sessions: Map<string, ChatSession> = new Map();
  private activeSessionId?: string;
  private context: vscode.ExtensionContext;
  private historyManager: ChatHistoryManager;

  constructor(context: vscode.ExtensionContext, historyManager: ChatHistoryManager) {
    super();
    this.context = context;
    this.historyManager = historyManager;
    this.loadSessions();
  }

  /**
   * Load sessions from VS Code global state
   */
  private loadSessions(): void {
    try {
      const storedSessions = this.context.globalState.get<Record<string, any>>(
        ChatSessionManager.STORAGE_KEY, 
        {}
      );

      for (const [sessionId, sessionData] of Object.entries(storedSessions)) {
        this.sessions.set(sessionId, {
          ...sessionData,
          createdAt: new Date(sessionData.createdAt),
          updatedAt: new Date(sessionData.updatedAt),
          lastActivity: new Date(sessionData.lastActivity)
        });
      }

      // Find the most recently active session
      if (this.sessions.size > 0) {
        const mostRecent = Array.from(this.sessions.values())
          .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime())[0];
        if (mostRecent) {
          this.activeSessionId = mostRecent.id;
          mostRecent.isActive = true;
        }
      }

      console.log(`[ChatSessionManager] Loaded ${this.sessions.size} sessions`);
    } catch (error) {
      console.error('[ChatSessionManager] Failed to load sessions:', error);
    }
  }

  /**
   * Save sessions to VS Code global state
   */
  private async saveSessions(): Promise<void> {
    try {
      const sessionsObject: Record<string, ChatSession> = {};
      
      for (const [sessionId, session] of this.sessions) {
        sessionsObject[sessionId] = session;
      }

      await this.context.globalState.update(ChatSessionManager.STORAGE_KEY, sessionsObject);
      console.log(`[ChatSessionManager] Saved ${this.sessions.size} sessions`);
    } catch (error) {
      console.error('[ChatSessionManager] Failed to save sessions:', error);
      throw error;
    }
  }

  /**
   * Create a new chat session
   */
  async createSession(
    providerId: string, 
    title?: string,
    metadata: Record<string, any> = {}
  ): Promise<ChatSession> {
    // Enforce session limit
    if (this.sessions.size >= ChatSessionManager.MAX_SESSIONS) {
      await this.removeOldestInactiveSession();
    }

    const now = new Date();
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session: ChatSession = {
      id: sessionId,
      title: title || this.generateSessionTitle(),
      createdAt: now,
      updatedAt: now,
      lastActivity: now,
      providerId,
      messageCount: 0,
      isActive: false,
      isPinned: false,
      tags: [],
      metadata: {
        workspace: vscode.workspace.workspaceFolders?.[0]?.name,
        ...metadata
      }
    };

    this.sessions.set(sessionId, session);
    await this.saveSessions();
    
    this.emitSessionEvent('created', sessionId, { providerId });
    console.log(`[ChatSessionManager] Created session: ${sessionId} (${session.title})`);
    
    return session;
  }

  /**
   * Generate a contextual session title
   */
  private generateSessionTitle(): string {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    const workspace = vscode.workspace.workspaceFolders?.[0]?.name;
    const sessionCount = this.sessions.size + 1;
    
    if (workspace) {
      return `${workspace} Chat ${sessionCount} - ${timeString}`;
    }
    
    return `${ChatSessionManager.DEFAULT_SESSION_TITLE} ${sessionCount} - ${timeString}`;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): ChatSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get the currently active session
   */
  getActiveSession(): ChatSession | undefined {
    return this.activeSessionId ? this.sessions.get(this.activeSessionId) : undefined;
  }

  /**
   * Get active session ID
   */
  getActiveSessionId(): string | undefined {
    return this.activeSessionId;
  }

  /**
   * Switch to a different session
   */
  async switchToSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`[ChatSessionManager] Session not found: ${sessionId}`);
      return false;
    }

    // Deactivate current session
    if (this.activeSessionId) {
      const currentSession = this.sessions.get(this.activeSessionId);
      if (currentSession) {
        currentSession.isActive = false;
      }
    }

    // Activate new session
    session.isActive = true;
    session.lastActivity = new Date();
    this.activeSessionId = sessionId;

    await this.saveSessions();
    this.emitSessionEvent('activated', sessionId);
    
    console.log(`[ChatSessionManager] Switched to session: ${sessionId} (${session.title})`);
    return true;
  }

  /**
   * Update session metadata
   */
  async updateSession(
    sessionId: string, 
    updates: Partial<Pick<ChatSession, 'title' | 'tags' | 'metadata'>>
  ): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    if (updates.title) {
      session.title = updates.title;
    }
    
    if (updates.tags) {
      session.tags = updates.tags;
    }
    
    if (updates.metadata) {
      session.metadata = { ...session.metadata, ...updates.metadata };
    }

    session.updatedAt = new Date();
    session.lastActivity = new Date();

    await this.saveSessions();
    this.emitSessionEvent('updated', sessionId, updates);
    
    return true;
  }

  /**
   * Update session message count
   */
  async updateSessionMessageCount(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.messageCount = this.historyManager.getSessionMessageCount(sessionId);
      session.lastActivity = new Date();
      await this.saveSessions();
    }
  }

  /**
   * Pin/unpin a session
   */
  async toggleSessionPin(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.isPinned = !session.isPinned;
    session.updatedAt = new Date();

    await this.saveSessions();
    this.emitSessionEvent(session.isPinned ? 'pinned' : 'unpinned', sessionId);
    
    return session.isPinned;
  }

  /**
   * Delete a session and its history
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Don't delete pinned sessions without explicit confirmation
    if (session.isPinned) {
      const response = await vscode.window.showWarningMessage(
        `Session "${session.title}" is pinned. Are you sure you want to delete it?`,
        'Delete', 'Cancel'
      );
      
      if (response !== 'Delete') {
        return false;
      }
    }

    // Remove session
    this.sessions.delete(sessionId);
    
    // Clear session history
    await this.historyManager.clearSessionHistory(sessionId);

    // If this was the active session, switch to another one
    if (this.activeSessionId === sessionId) {
      await this.switchToMostRecentSession();
    }

    await this.saveSessions();
    this.emitSessionEvent('deleted', sessionId);
    
    console.log(`[ChatSessionManager] Deleted session: ${sessionId} (${session.title})`);
    return true;
  }

  /**
   * Switch to the most recently used session
   */
  private async switchToMostRecentSession(): Promise<void> {
    const sessions = Array.from(this.sessions.values())
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

    if (sessions.length > 0) {
      await this.switchToSession(sessions[0]!.id);
    } else {
      this.activeSessionId = undefined;
    }
  }

  /**
   * Get session summaries with optional filtering
   */
  getSessionSummaries(filter?: SessionFilter): SessionSummary[] {
    let sessions = Array.from(this.sessions.values());

    // Apply filters
    if (filter) {
      if (filter.providerId) {
        sessions = sessions.filter(s => s.providerId === filter.providerId);
      }
      
      if (filter.tags && filter.tags.length > 0) {
        sessions = sessions.filter(s => 
          filter.tags!.some(tag => s.tags.includes(tag))
        );
      }
      
      if (filter.pinned !== undefined) {
        sessions = sessions.filter(s => s.isPinned === filter.pinned);
      }
      
      if (filter.active !== undefined) {
        sessions = sessions.filter(s => s.isActive === filter.active);
      }
      
      if (filter.searchText) {
        const searchTerm = filter.searchText.toLowerCase();
        sessions = sessions.filter(s => 
          s.title.toLowerCase().includes(searchTerm) ||
          s.tags.some(tag => tag.toLowerCase().includes(searchTerm))
        );
      }
      
      if (filter.dateRange) {
        sessions = sessions.filter(s => 
          s.lastActivity >= filter.dateRange!.start && 
          s.lastActivity <= filter.dateRange!.end
        );
      }
      
      if (filter.minMessages !== undefined) {
        sessions = sessions.filter(s => s.messageCount >= filter.minMessages!);
      }
      
      if (filter.maxMessages !== undefined) {
        sessions = sessions.filter(s => s.messageCount <= filter.maxMessages!);
      }
    }

    // Convert to summaries and sort by last activity
    return sessions
      .map(session => ({
        id: session.id,
        title: session.title,
        messageCount: session.messageCount,
        lastActivity: session.lastActivity,
        isActive: session.isActive,
        isPinned: session.isPinned,
        provider: session.providerId,
        model: session.metadata.model,
        tags: [...session.tags]
      }))
      .sort((a, b) => {
        // Pinned sessions first
        if (a.isPinned !== b.isPinned) {
          return a.isPinned ? -1 : 1;
        }
        // Then active session
        if (a.isActive !== b.isActive) {
          return a.isActive ? -1 : 1;
        }
        // Then by last activity
        return b.lastActivity.getTime() - a.lastActivity.getTime();
      });
  }

  /**
   * Export sessions
   */
  async exportSessions(options: SessionExportOptions): Promise<string> {
    const sessions = options.sessionIds.map(id => this.sessions.get(id)).filter(Boolean) as ChatSession[];
    
    if (sessions.length === 0) {
      throw new Error('No valid sessions found to export');
    }

    return await this.historyManager.exportSessions(options.sessionIds, options.format === 'markdown' ? 'markdown' : 'json');
  }

  /**
   * Import sessions from JSON data
   */
  async importSessions(jsonData: string): Promise<SessionImportResult> {
    const result: SessionImportResult = {
      imported: 0,
      skipped: 0,
      errors: [],
      sessionIds: []
    };

    try {
      const data = JSON.parse(jsonData);
      
      if (!data.sessions || !Array.isArray(data.sessions)) {
        throw new Error('Invalid import data format');
      }

      for (const sessionData of data.sessions) {
        try {
          const session = sessionData.session;
          const messages = sessionData.messages || [];

          // Check if session already exists
          if (this.sessions.has(session.id)) {
            result.skipped++;
            continue;
          }

          // Import session
          const importedSession: ChatSession = {
            ...session,
            createdAt: new Date(session.createdAt),
            updatedAt: new Date(session.updatedAt),
            lastActivity: new Date(session.lastActivity),
            isActive: false, // Never import as active
            messageCount: messages.length
          };

          this.sessions.set(session.id, importedSession);

          // Import messages
          for (const message of messages) {
            await this.historyManager.addMessage({
              ...message,
              timestamp: new Date(message.timestamp)
            });
          }

          result.imported++;
          result.sessionIds.push(session.id);
          
        } catch (error) {
          result.errors.push(`Failed to import session: ${error}`);
        }
      }

      await this.saveSessions();
      
    } catch (error) {
      result.errors.push(`Failed to parse import data: ${error}`);
    }

    return result;
  }

  /**
   * Remove oldest inactive session to make room for new ones
   */
  private async removeOldestInactiveSession(): Promise<void> {
    const inactiveSessions = Array.from(this.sessions.values())
      .filter(s => !s.isActive && !s.isPinned)
      .sort((a, b) => a.lastActivity.getTime() - b.lastActivity.getTime());

    if (inactiveSessions.length > 0) {
      const oldest = inactiveSessions[0];
      if (oldest) {
        await this.deleteSession(oldest.id);
        console.log(`[ChatSessionManager] Auto-removed oldest inactive session: ${oldest.title}`);
      }
    }
  }

  /**
   * Get session statistics
   */
  getStatistics() {
    const sessions = Array.from(this.sessions.values());
    const now = new Date();
    
    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => s.isActive).length,
      pinnedSessions: sessions.filter(s => s.isPinned).length,
      totalMessages: sessions.reduce((sum, s) => sum + s.messageCount, 0),
      oldestSession: sessions.reduce((oldest, s) => 
        !oldest || s.createdAt < oldest.createdAt ? s : oldest, null as ChatSession | null
      ),
      newestSession: sessions.reduce((newest, s) => 
        !newest || s.createdAt > newest.createdAt ? s : newest, null as ChatSession | null
      ),
      providerDistribution: this.getProviderDistribution(),
      recentActivity: sessions.filter(s => 
        now.getTime() - s.lastActivity.getTime() < 24 * 60 * 60 * 1000 // Last 24 hours
      ).length
    };
  }

  /**
   * Get distribution of sessions by provider
   */
  private getProviderDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    for (const session of this.sessions.values()) {
      distribution[session.providerId] = (distribution[session.providerId] || 0) + 1;
    }
    
    return distribution;
  }

  /**
   * Clear all sessions
   */
  async clearAllSessions(): Promise<void> {
    const confirmed = await vscode.window.showWarningMessage(
      'This will delete all chat sessions and their history. This action cannot be undone.',
      'Delete All', 'Cancel'
    );

    if (confirmed === 'Delete All') {
      this.sessions.clear();
      this.activeSessionId = undefined;
      await this.historyManager.clearAllHistory();
      await this.saveSessions();
      
      console.log('[ChatSessionManager] Cleared all sessions');
    }
  }

  /**
   * Emit session event
   */
  private emitSessionEvent(type: SessionEventType, sessionId: string, metadata?: Record<string, any>): void {
    const event: SessionEvent = {
      type,
      sessionId,
      timestamp: new Date(),
      metadata
    };

    this.emit('sessionEvent', event);
    this.emit(type, event);
  }

  /**
   * Dispose of the session manager
   */
  dispose(): void {
    this.saveSessions().catch(error => {
      console.error('[ChatSessionManager] Failed to save sessions during dispose:', error);
    });
    
    this.removeAllListeners();
  }
}