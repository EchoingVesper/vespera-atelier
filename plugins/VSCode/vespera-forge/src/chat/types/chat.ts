/**
 * Core chat type definitions for Vespera Forge chat system
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  threadId: string;
  sessionId: string;
  metadata?: {
    provider?: string;
    model?: string;
    tokens?: number;
    duration?: number;
    error?: string;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
    finish_reason?: string;
    temperature?: number;
    max_tokens?: number;
    contextInfo?: boolean;
    streaming?: boolean;
    exportable?: boolean;
  };
}

export interface ChatThread {
  id: string;
  title?: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  providerId: string;
  sessionId: string;
  metadata: Record<string, any>;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  lastActivity: Date;
  providerId: string;
  messageCount: number;
  isActive: boolean;
  isPinned: boolean;
  tags: string[];
  metadata: {
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    model?: string;
    customSettings?: Record<string, any>;
    workspace?: string;
    project?: string;
  };
}

export interface ChatHistory {
  sessions: Map<string, ChatSession>;
  messages: Map<string, ChatMessage[]>; // sessionId -> messages[]
  totalMessages: number;
  totalSessions: number;
  oldestMessage?: Date;
  newestMessage?: Date;
  storageVersion: string;
}

export interface SessionSummary {
  id: string;
  title: string;
  messageCount: number;
  lastActivity: Date;
  isActive: boolean;
  isPinned: boolean;
  provider: string;
  model?: string;
  tags: string[];
}

export interface ChatResponse {
  id: string;
  content: string;
  role: 'assistant';
  timestamp: Date;
  metadata?: {
    model: string;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
    finish_reason: string;
  };
}

export interface ChatChunk {
  content: string;
  done: boolean;
  metadata?: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export type ChatStreamEventType = 'start' | 'chunk' | 'complete' | 'error';

export interface ChatStreamEvent {
  type: ChatStreamEventType;
  messageId?: string;
  chunk?: ChatChunk;
  error?: string;
}

export interface SessionFilter {
  providerId?: string;
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  pinned?: boolean;
  active?: boolean;
  searchText?: string;
  minMessages?: number;
  maxMessages?: number;
}

export interface SessionExportOptions {
  sessionIds: string[];
  includeMetadata: boolean;
  includeSystemMessages: boolean;
  format: 'json' | 'markdown' | 'csv';
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface SessionImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  sessionIds: string[];
}

export interface SessionSearchResult {
  sessionId: string;
  messageId: string;
  content: string;
  timestamp: Date;
  context: string; // surrounding text
  relevanceScore: number;
}

export interface HistoryContextOptions {
  maxMessages?: number;
  maxTokens?: number;
  includeSystemMessages?: boolean;
  messageTypes?: ('user' | 'assistant' | 'system')[];
  prioritizeRecent?: boolean;
  includeMetadata?: boolean;
}

export type SessionEventType = 'created' | 'updated' | 'deleted' | 'activated' | 'pinned' | 'unpinned';

export interface SessionEvent {
  type: SessionEventType;
  sessionId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}