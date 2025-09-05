/**
 * Comprehensive type definitions for Vespera Forge VS Code extension
 * 
 * Includes core infrastructure types, enhanced error handling, memory management,
 * and all service interfaces for type-safe development.
 */

import * as vscode from 'vscode';
import type { 
  VesperaError, 
  VesperaErrorCode, 
  VesperaSeverity, 
  VesperaErrorCategory 
} from '@/core/error-handling/VesperaErrors';
import type { LogLevel } from '@/core/logging/VesperaLogger';

// =============================================================================
// CORE INFRASTRUCTURE TYPES
// =============================================================================

/**
 * Base disposable resource interface
 */
export interface DisposableResource {
  dispose(): void | Promise<void>;
  readonly isDisposed: boolean;
  readonly disposalPriority?: number;
}

/**
 * Enhanced service interface with lifecycle management
 */
export interface ServiceInterface extends DisposableResource {
  start?(): void | Promise<void>;
  stop?(): void | Promise<void>;
  readonly isRunning?: boolean;
  readonly uptime?: number;
}

/**
 * Resource metadata for tracking and management
 */
export interface ResourceMetadata {
  id: string;
  type: string;
  createdAt: number;
  lastAccessedAt?: number;
  size?: number;
  tags?: string[];
}

/**
 * Memory monitoring statistics
 */
export interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  registeredResources: number;
  peakUsage?: number;
  checksPerformed?: number;
}

// =============================================================================
// ERROR HANDLING TYPES
// =============================================================================

/**
 * Error handling strategy configuration
 */
export interface ErrorHandlingStrategy {
  shouldLog: boolean;
  shouldNotifyUser: boolean;
  shouldThrow: boolean;
  shouldRetry: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Retry operation metadata
 */
export interface RetryMetadata {
  shouldRetry: boolean;
  maxRetries: number;
  retryDelay: number;
  currentAttempt?: number;
}

/**
 * Error context for debugging and telemetry
 */
export interface ErrorContext {
  operation?: string;
  component?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

// =============================================================================
// LOGGING TYPES
// =============================================================================

/**
 * Structured log entry
 */
export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
  source: string;
  sessionId: string;
  correlationId?: string;
}

/**
 * Logger configuration
 */
export interface LoggerConfiguration {
  level: LogLevel;
  enableConsole: boolean;
  enableVSCodeOutput: boolean;
  enableFile: boolean;
  filePath?: string;
  maxFileSize?: number;
  maxFiles?: number;
  enableStructuredLogging: boolean;
  enableTelemetry: boolean;
  correlationIdHeader?: string;
}

// =============================================================================
// WEBVIEW AND UI TYPES
// =============================================================================

/**
 * WebView message interface
 */
export interface WebViewMessage<T = any> {
  type: string;
  payload: T;
  requestId?: string;
  timestamp?: number;
}

/**
 * WebView response interface
 */
export interface WebViewResponse<T = any> {
  type: string;
  payload: T;
  requestId?: string;
  success: boolean;
  error?: string;
}

/**
 * WebView provider configuration
 */
export interface WebViewProviderConfig {
  enableScripts?: boolean;
  retainContextWhenHidden?: boolean;
  localResourceRoots?: vscode.Uri[];
  portMapping?: Array<{ webviewPort: number; extensionHostPort: number; }>;
}

// =============================================================================
// VIEW CONTEXT TYPES
// =============================================================================

/**
 * Enhanced view context entry with lifecycle tracking
 */
export interface ViewContextEntry {
  chatPanelProvider?: ServiceInterface;
  taskDashboardProvider?: ServiceInterface;
  statusBarManager?: ServiceInterface;
  taskTreeProvider?: ServiceInterface;
  createdAt: number;
  lastAccessedAt: number;
  metadata?: ResourceMetadata;
}

/**
 * View context statistics
 */
export interface ViewContextStats {
  totalContexts: number;
  activeProviders: number;
  memoryUsage: MemoryStats;
  oldestContext?: number;
  newestContext?: number;
}

// =============================================================================
// CORE SERVICE TYPES
// =============================================================================

/**
 * Core services configuration
 */
export interface CoreServicesConfig {
  logging?: Partial<LoggerConfiguration>;
  telemetry?: {
    enabled?: boolean;
    endpoint?: string;
    apiKey?: string;
  };
  memoryMonitoring?: {
    enabled?: boolean;
    thresholdMB?: number;
    checkIntervalMs?: number;
  };
  errorHandling?: {
    strategies?: Partial<Record<VesperaErrorCode, Partial<ErrorHandlingStrategy>>>;
    globalHandling?: boolean;
  };
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  healthy: boolean;
  services: Record<string, { 
    healthy: boolean; 
    error?: string; 
    uptime?: number;
    metadata?: Record<string, any>;
  }>;
  stats: {
    memory: MemoryStats;
    errors: {
      total: number;
      byCategory: Record<VesperaErrorCategory, number>;
    };
    uptime: number;
  };
}

// =============================================================================
// ENHANCED EXISTING TYPES
// =============================================================================

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
 * Enhanced extension context interface with core services integration
 */
export interface VesperaForgeContext {
  extensionContext: vscode.ExtensionContext;
  contentProvider: ContentProvider;
  config: VesperaForgeConfig;
  isInitialized: boolean;
  
  // Core services (optional for backward compatibility)
  coreServices?: {
    logger?: import('@/core/logging/VesperaLogger').VesperaLogger;
    errorHandler?: import('@/core/error-handling/VesperaErrorHandler').VesperaErrorHandler;
    contextManager?: import('@/core/memory-management/VesperaContextManager').VesperaContextManager;
    telemetryService?: import('@/core/telemetry/VesperaTelemetryService').VesperaTelemetryService;
  };
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

// =============================================================================
// UTILITY TYPES AND TYPE GUARDS
// =============================================================================

/**
 * Type guard utilities for runtime type checking
 */
export namespace TypeGuards {
  /**
   * Check if an object implements DisposableResource
   */
  export function isDisposableResource(obj: any): obj is DisposableResource {
    return obj &&
      typeof obj.dispose === 'function' &&
      typeof obj.isDisposed === 'boolean';
  }

  /**
   * Check if an object implements ServiceInterface
   */
  export function isServiceInterface(obj: any): obj is ServiceInterface {
    return isDisposableResource(obj) &&
      ('start' in obj ? typeof obj.start === 'function' : true) &&
      ('stop' in obj ? typeof obj.stop === 'function' : true) &&
      ('isRunning' in obj ? typeof obj.isRunning === 'boolean' : true);
  }

  /**
   * Check if an error is a VesperaError
   */
  export function isVesperaError(error: any): error is VesperaError {
    return error &&
      error.name === 'VesperaError' &&
      typeof error.code === 'number' &&
      typeof error.severity === 'string' &&
      typeof error.category === 'string';
  }

  /**
   * Check if an object is a valid WebViewMessage
   */
  export function isWebViewMessage<T = any>(obj: any): obj is WebViewMessage<T> {
    return obj &&
      typeof obj.type === 'string' &&
      obj.payload !== undefined;
  }

  /**
   * Check if an object is a valid LogEntry
   */
  export function isLogEntry(obj: any): obj is LogEntry {
    return obj &&
      typeof obj.timestamp === 'number' &&
      typeof obj.level === 'number' &&
      typeof obj.message === 'string' &&
      typeof obj.source === 'string' &&
      typeof obj.sessionId === 'string';
  }
}

/**
 * Utility type for making all properties of T optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Utility type for making specific properties required
 */
export type RequireProps<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Utility type for creating a type-safe event emitter
 */
export type EventMap = Record<string, any>;

export interface TypedEventEmitter<T extends EventMap> {
  on<K extends keyof T>(event: K, listener: (data: T[K]) => void): void;
  emit<K extends keyof T>(event: K, data: T[K]): void;
  off<K extends keyof T>(event: K, listener: (data: T[K]) => void): void;
}

/**
 * Promise utility types
 */
export type PromiseValue<T> = T extends Promise<infer U> ? U : T;

export type AsyncReturnType<T extends (...args: any) => Promise<any>> = 
  T extends (...args: any) => Promise<infer R> ? R : never;

/**
 * Configuration validation utility type
 */
export type ConfigValidator<T> = (config: unknown) => config is T;

/**
 * Resource cleanup utility type
 */
export type CleanupFunction = () => void | Promise<void>;

/**
 * Type-safe key-value store interface
 */
export interface TypedKeyValueStore<T extends Record<string, any>> {
  get<K extends keyof T>(key: K): Promise<T[K] | undefined>;
  set<K extends keyof T>(key: K, value: T[K]): Promise<void>;
  delete<K extends keyof T>(key: K): Promise<boolean>;
  has<K extends keyof T>(key: K): Promise<boolean>;
  clear(): Promise<void>;
  keys(): Promise<Array<keyof T>>;
}

// =============================================================================
// MIGRATION AND COMPATIBILITY TYPES
// =============================================================================

/**
 * Legacy context type for backward compatibility
 * @deprecated Use VesperaForgeContext with coreServices instead
 */
export interface LegacyVesperaContext {
  extensionContext: vscode.ExtensionContext;
  contentProvider: ContentProvider;
  config: VesperaForgeConfig;
  isInitialized: boolean;
  _viewContext?: any; // Legacy view context storage
}

/**
 * Migration helper type for converting legacy contexts
 */
export type ContextMigration<T> = {
  from: LegacyVesperaContext;
  to: VesperaForgeContext;
  migrator: (legacy: LegacyVesperaContext) => Promise<VesperaForgeContext>;
};

// =============================================================================
// DEVELOPMENT AND DEBUG TYPES
// =============================================================================

/**
 * Development mode configuration
 */
export interface DevelopmentConfig {
  enableDebugLogging: boolean;
  enablePerformanceMetrics: boolean;
  enableMemoryTracking: boolean;
  mockExternalServices: boolean;
  validateTypeGuards: boolean;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  operationName: string;
  startTime: number;
  endTime: number;
  duration: number;
  memoryBefore?: MemoryStats;
  memoryAfter?: MemoryStats;
  metadata?: Record<string, any>;
}

/**
 * Debug information interface
 */
export interface DebugInfo {
  version: string;
  buildTime: string;
  environment: 'development' | 'production';
  features: string[];
  services: Record<string, { status: 'active' | 'inactive' | 'error'; version?: string; }>;
  memoryStats: MemoryStats;
  errorCounts: Record<VesperaErrorCategory, number>;
}