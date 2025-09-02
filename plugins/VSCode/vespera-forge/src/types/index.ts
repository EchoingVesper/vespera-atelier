/**
 * Core types for Vespera Forge VS Code extension
 */

import * as vscode from 'vscode';

/**
 * Configuration interface for Vespera Forge
 */
export interface VesperaForgeConfig {
  enableAutoStart: boolean;
  rustBinderyPath: string;
}

/**
 * Content type enum for different content structures
 */
export enum ContentType {
  Task = 'task',
  Note = 'note',
  Project = 'project',
  Template = 'template'
}

/**
 * Base interface for content items
 */
export interface ContentItem {
  id: string;
  type: ContentType;
  title: string;
  content: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Task-specific content item
 */
export interface TaskItem extends ContentItem {
  type: ContentType.Task;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: string;
  dueDate?: Date;
  dependencies: string[];
}

/**
 * Task status enumeration
 */
export enum TaskStatus {
  Pending = 'pending',
  InProgress = 'in-progress',
  Completed = 'completed',
  Blocked = 'blocked'
}

/**
 * Task priority enumeration
 */
export enum TaskPriority {
  Low = 'low',
  Normal = 'normal',
  High = 'high',
  Critical = 'critical'
}

/**
 * Provider interface for content management
 */
export interface ContentProvider {
  getContent(id: string): Promise<ContentItem | undefined>;
  getAllContent(): Promise<ContentItem[]>;
  createContent(item: Omit<ContentItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<ContentItem>;
  updateContent(id: string, updates: Partial<ContentItem>): Promise<ContentItem>;
  deleteContent(id: string): Promise<boolean>;
}

/**
 * Event types for extension communication
 */
export enum EventType {
  ContentCreated = 'content-created',
  ContentUpdated = 'content-updated',
  ContentDeleted = 'content-deleted',
  TaskStatusChanged = 'task-status-changed'
}

/**
 * Event payload interface
 */
export interface EventPayload {
  type: EventType;
  data: any;
  timestamp: Date;
}

/**
 * Extension context interface
 */
export interface VesperaForgeContext {
  extensionContext: vscode.ExtensionContext;
  contentProvider: ContentProvider;
  config: VesperaForgeConfig;
  isInitialized: boolean;
}

/**
 * Command handler type
 */
export type CommandHandler = (context: VesperaForgeContext, ...args: any[]) => Promise<void> | void;

/**
 * Rust Bindery integration interface (placeholder for future implementation)
 */
export interface RustBinderyInterface {
  initialize(path: string): Promise<boolean>;
  syncContent(content: ContentItem[]): Promise<void>;
  subscribeToChanges(callback: (changes: any[]) => void): Promise<void>;
  disconnect(): Promise<void>;
}