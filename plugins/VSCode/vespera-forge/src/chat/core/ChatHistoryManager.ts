/**
 * Chat History Manager - Handles message persistence and retrieval
 * Provides efficient storage and querying of chat messages across sessions
 */

import * as vscode from 'vscode';
import { 
  ChatMessage, 
  ChatHistory, 
  ChatSession,
  SessionFilter,
  SessionSearchResult,
  HistoryContextOptions 
} from '../types/chat';

export class ChatHistoryManager {
  private static readonly STORAGE_KEY = 'vespera-forge.chat.history';
  private static readonly MESSAGES_KEY = 'vespera-forge.chat.messages';
  private static readonly STORAGE_VERSION = '1.0.0';
  private static readonly MAX_MESSAGES_PER_SESSION = 1000;
  private static readonly MAX_TOTAL_MESSAGES = 10000;

  private history: ChatHistory;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.history = this.loadHistory();
  }

  /**
   * Load chat history from VS Code global state
   */
  private loadHistory(): ChatHistory {
    try {
      const storedHistory = this.context.globalState.get<any>(ChatHistoryManager.STORAGE_KEY);
      const storedMessages = this.context.globalState.get<Record<string, ChatMessage[]>>(ChatHistoryManager.MESSAGES_KEY, {});

      if (!storedHistory) {
        return this.createEmptyHistory();
      }

      // Convert stored data back to Maps
      const sessions = new Map<string, ChatSession>();
      const messages = new Map<string, ChatMessage[]>();

      // Restore sessions
      if (storedHistory.sessions) {
        for (const [sessionId, sessionData] of Object.entries(storedHistory.sessions)) {
          const data = sessionData as any;
          sessions.set(sessionId, {
            ...data,
            createdAt: new Date(data.createdAt),
            updatedAt: new Date(data.updatedAt),
            lastActivity: new Date(data.lastActivity)
          });
        }
      }

      // Restore messages with date conversion
      for (const [sessionId, sessionMessages] of Object.entries(storedMessages)) {
        const convertedMessages = sessionMessages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        messages.set(sessionId, convertedMessages);
      }

      return {
        sessions,
        messages,
        totalMessages: storedHistory.totalMessages || 0,
        totalSessions: storedHistory.totalSessions || 0,
        oldestMessage: storedHistory.oldestMessage ? new Date(storedHistory.oldestMessage) : undefined,
        newestMessage: storedHistory.newestMessage ? new Date(storedHistory.newestMessage) : undefined,
        storageVersion: storedHistory.storageVersion || ChatHistoryManager.STORAGE_VERSION
      };
    } catch (error) {
      console.error('[ChatHistoryManager] Failed to load history:', error);
      return this.createEmptyHistory();
    }
  }

  /**
   * Save chat history to VS Code global state
   */
  private async saveHistory(): Promise<void> {
    try {
      // Convert Maps to objects for storage
      const sessionsObject: Record<string, ChatSession> = {};
      const messagesObject: Record<string, ChatMessage[]> = {};

      for (const [sessionId, session] of this.history.sessions) {
        sessionsObject[sessionId] = session;
      }

      for (const [sessionId, messages] of this.history.messages) {
        messagesObject[sessionId] = messages;
      }

      // Save history metadata
      const historyToSave = {
        sessions: sessionsObject,
        totalMessages: this.history.totalMessages,
        totalSessions: this.history.totalSessions,
        oldestMessage: this.history.oldestMessage,
        newestMessage: this.history.newestMessage,
        storageVersion: this.history.storageVersion
      };

      await Promise.all([
        this.context.globalState.update(ChatHistoryManager.STORAGE_KEY, historyToSave),
        this.context.globalState.update(ChatHistoryManager.MESSAGES_KEY, messagesObject)
      ]);

      console.log(`[ChatHistoryManager] History saved - ${this.history.totalMessages} messages, ${this.history.totalSessions} sessions`);
    } catch (error) {
      console.error('[ChatHistoryManager] Failed to save history:', error);
      throw error;
    }
  }

  /**
   * Create empty history structure
   */
  private createEmptyHistory(): ChatHistory {
    return {
      sessions: new Map(),
      messages: new Map(),
      totalMessages: 0,
      totalSessions: 0,
      storageVersion: ChatHistoryManager.STORAGE_VERSION
    };
  }

  /**
   * Add a message to the history
   */
  async addMessage(message: ChatMessage): Promise<void> {
    const sessionMessages = this.history.messages.get(message.sessionId) || [];
    sessionMessages.push(message);
    
    // Enforce session message limit
    if (sessionMessages.length > ChatHistoryManager.MAX_MESSAGES_PER_SESSION) {
      sessionMessages.shift(); // Remove oldest message
    }
    
    this.history.messages.set(message.sessionId, sessionMessages);
    this.history.totalMessages++;

    // Update history metadata
    if (!this.history.oldestMessage || message.timestamp < this.history.oldestMessage) {
      this.history.oldestMessage = message.timestamp;
    }
    
    if (!this.history.newestMessage || message.timestamp > this.history.newestMessage) {
      this.history.newestMessage = message.timestamp;
    }

    // Clean up if total messages exceed limit
    await this.enforceGlobalMessageLimit();
    await this.saveHistory();
  }

  /**
   * Get messages for a specific session
   */
  getSessionMessages(sessionId: string, limit?: number): ChatMessage[] {
    const messages = this.history.messages.get(sessionId) || [];
    return limit ? messages.slice(-limit) : messages;
  }

  /**
   * Get recent messages across all sessions for context
   */
  getRecentMessages(options: HistoryContextOptions = {}): ChatMessage[] {
    const {
      maxMessages = 50,
      includeSystemMessages = false,
      messageTypes = ['user', 'assistant'],
      prioritizeRecent = true
    } = options;

    const allMessages: ChatMessage[] = [];
    
    for (const messages of this.history.messages.values()) {
      allMessages.push(...messages);
    }

    // Filter by message types
    let filteredMessages = allMessages.filter(msg => 
      messageTypes.includes(msg.role) && 
      (includeSystemMessages || msg.role !== 'system')
    );

    // Sort by timestamp
    filteredMessages.sort((a, b) => 
      prioritizeRecent 
        ? b.timestamp.getTime() - a.timestamp.getTime()
        : a.timestamp.getTime() - b.timestamp.getTime()
    );

    return filteredMessages.slice(0, maxMessages);
  }

  /**
   * Search messages across all sessions
   */
  searchMessages(query: string, sessionId?: string): SessionSearchResult[] {
    const results: SessionSearchResult[] = [];
    const searchTerms = query.toLowerCase().split(' ');

    const sessionsToSearch = sessionId 
      ? [sessionId]
      : Array.from(this.history.messages.keys());

    for (const currentSessionId of sessionsToSearch) {
      const messages = this.history.messages.get(currentSessionId) || [];
      
      for (const message of messages) {
        const content = message.content.toLowerCase();
        let relevanceScore = 0;

        // Calculate relevance score
        for (const term of searchTerms) {
          const termCount = (content.match(new RegExp(term, 'g')) || []).length;
          relevanceScore += termCount;
        }

        if (relevanceScore > 0) {
          // Extract context around the match
          const context = this.extractContext(message.content, searchTerms, 100);
          
          results.push({
            sessionId: currentSessionId,
            messageId: message.id,
            content: message.content,
            timestamp: message.timestamp,
            context,
            relevanceScore
          });
        }
      }
    }

    // Sort by relevance and recency
    return results.sort((a, b) => {
      if (a.relevanceScore !== b.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
  }

  /**
   * Extract context around search terms
   */
  private extractContext(content: string, searchTerms: string[], contextLength: number): string {
    const lowerContent = content.toLowerCase();
    let bestStart = 0;
    let bestScore = 0;

    // Find the best position to extract context
    for (const term of searchTerms) {
      const index = lowerContent.indexOf(term);
      if (index !== -1) {
        const score = searchTerms.reduce((acc, t) => {
          const nearbyIndex = lowerContent.indexOf(t, Math.max(0, index - contextLength));
          return acc + (nearbyIndex !== -1 && nearbyIndex < index + contextLength ? 1 : 0);
        }, 0);

        if (score > bestScore) {
          bestScore = score;
          bestStart = Math.max(0, index - Math.floor(contextLength / 2));
        }
      }
    }

    const extracted = content.substring(bestStart, bestStart + contextLength);
    return bestStart > 0 ? '...' + extracted : extracted;
  }

  /**
   * Get history statistics
   */
  getStatistics() {
    const sessionStats = Array.from(this.history.sessions.values()).map(session => ({
      id: session.id,
      title: session.title,
      messageCount: this.history.messages.get(session.id)?.length || 0,
      lastActivity: session.lastActivity,
      provider: session.providerId
    }));

    return {
      totalSessions: this.history.totalSessions,
      totalMessages: this.history.totalMessages,
      oldestMessage: this.history.oldestMessage,
      newestMessage: this.history.newestMessage,
      sessionStats,
      storageSize: this.calculateStorageSize()
    };
  }

  /**
   * Calculate approximate storage size
   */
  private calculateStorageSize(): number {
    let size = 0;
    
    for (const messages of this.history.messages.values()) {
      for (const message of messages) {
        size += JSON.stringify(message).length;
      }
    }
    
    for (const session of this.history.sessions.values()) {
      size += JSON.stringify(session).length;
    }

    return size;
  }

  /**
   * Clear messages for a specific session
   */
  async clearSessionHistory(sessionId: string): Promise<void> {
    const messages = this.history.messages.get(sessionId) || [];
    this.history.totalMessages -= messages.length;
    this.history.messages.delete(sessionId);
    
    await this.saveHistory();
    console.log(`[ChatHistoryManager] Cleared history for session: ${sessionId}`);
  }

  /**
   * Clear all history
   */
  async clearAllHistory(): Promise<void> {
    this.history = this.createEmptyHistory();
    await this.saveHistory();
    console.log('[ChatHistoryManager] Cleared all chat history');
  }

  /**
   * Export messages for specific sessions
   */
  async exportSessions(sessionIds: string[], format: 'json' | 'markdown' = 'json'): Promise<string> {
    const exportData: any = {
      exportedAt: new Date().toISOString(),
      sessions: [],
      totalMessages: 0
    };

    for (const sessionId of sessionIds) {
      const session = this.history.sessions.get(sessionId);
      const messages = this.history.messages.get(sessionId) || [];
      
      if (session) {
        exportData.sessions.push({
          session,
          messages
        });
        exportData.totalMessages += messages.length;
      }
    }

    if (format === 'json') {
      return JSON.stringify(exportData, null, 2);
    } else {
      return this.formatAsMarkdown(exportData);
    }
  }

  /**
   * Format export data as markdown
   */
  private formatAsMarkdown(exportData: any): string {
    let markdown = `# Chat History Export\n\n`;
    markdown += `**Exported:** ${exportData.exportedAt}\n`;
    markdown += `**Total Messages:** ${exportData.totalMessages}\n`;
    markdown += `**Sessions:** ${exportData.sessions.length}\n\n`;

    for (const sessionData of exportData.sessions) {
      const session = sessionData.session;
      const messages = sessionData.messages;

      markdown += `## ${session.title}\n\n`;
      markdown += `**Session ID:** ${session.id}\n`;
      markdown += `**Provider:** ${session.providerId}\n`;
      markdown += `**Created:** ${session.createdAt}\n`;
      markdown += `**Messages:** ${messages.length}\n\n`;

      for (const message of messages) {
        const timestamp = new Date(message.timestamp).toLocaleString();
        markdown += `### ${message.role.charAt(0).toUpperCase() + message.role.slice(1)} (${timestamp})\n\n`;
        markdown += `${message.content}\n\n`;
        
        if (message.metadata?.usage) {
          markdown += `*Tokens: ${message.metadata.usage.total_tokens}*\n\n`;
        }
      }

      markdown += `---\n\n`;
    }

    return markdown;
  }

  /**
   * Enforce global message limit by removing oldest sessions
   */
  private async enforceGlobalMessageLimit(): Promise<void> {
    if (this.history.totalMessages <= ChatHistoryManager.MAX_TOTAL_MESSAGES) {
      return;
    }

    console.log(`[ChatHistoryManager] Enforcing message limit - current: ${this.history.totalMessages}, max: ${ChatHistoryManager.MAX_TOTAL_MESSAGES}`);

    // Get sessions sorted by last activity (oldest first)
    const sessionsSorted = Array.from(this.history.sessions.entries())
      .sort(([, a], [, b]) => a.lastActivity.getTime() - b.lastActivity.getTime());

    // Remove oldest sessions until we're under the limit
    for (const [sessionId] of sessionsSorted) {
      if (this.history.totalMessages <= ChatHistoryManager.MAX_TOTAL_MESSAGES) {
        break;
      }

      const messages = this.history.messages.get(sessionId) || [];
      this.history.totalMessages -= messages.length;
      this.history.messages.delete(sessionId);
      
      console.log(`[ChatHistoryManager] Removed session ${sessionId} with ${messages.length} messages`);
    }
  }

  /**
   * Build context for Claude Code from conversation history
   */
  buildConversationContext(sessionId: string, options: HistoryContextOptions = {}): string {
    const {
      maxMessages = 10,
      includeSystemMessages = true,
      messageTypes = ['user', 'assistant', 'system']
    } = options;

    const messages = this.getSessionMessages(sessionId, maxMessages)
      .filter(msg => messageTypes.includes(msg.role))
      .filter(msg => includeSystemMessages || msg.role !== 'system');

    if (messages.length === 0) {
      return '';
    }

    let context = 'Previous conversation context:\n\n';
    
    for (const message of messages) {
      const timestamp = message.timestamp.toLocaleTimeString();
      context += `[${timestamp}] ${message.role.toUpperCase()}: ${message.content}\n\n`;
    }

    return context;
  }

  /**
   * Get total message count for a session
   */
  getSessionMessageCount(sessionId: string): number {
    return this.history.messages.get(sessionId)?.length || 0;
  }

  /**
   * Check if session has any messages
   */
  hasSessionMessages(sessionId: string): boolean {
    return this.getSessionMessageCount(sessionId) > 0;
  }

  /**
   * Dispose of the history manager
   */
  dispose(): void {
    // Save any pending changes
    this.saveHistory().catch(error => {
      console.error('[ChatHistoryManager] Failed to save history during dispose:', error);
    });
  }
}