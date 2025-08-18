/**
 * Core types for A2A (Agent-to-Agent) messaging
 */
import { ServiceStatus } from './serviceManager';

export enum MessageType {
  // System messages
  HEARTBEAT = 'system.heartbeat',
  REGISTER = 'system.register',
  UNREGISTER = 'system.unregister',
  SERVICE_STATUS_CHANGE = 'system.service.status.change',
  
  // Task management
  TASK_CREATE = 'task.create',
  TASK_UPDATE = 'task.update',
  TASK_COMPLETE = 'task.complete',
  TASK_FAIL = 'task.fail',
  TASK_REQUEST = 'task.request',
  TASK_CANCEL = 'task.cancel',
  TASK_ASSIGN = 'task.assign',
  
  // Storage operations
  STORAGE_SET = 'storage.set',
  STORAGE_GET = 'storage.get',
  STORAGE_REQUEST = 'storage.request',
  STORAGE_DELETE = 'storage.delete',
  STORAGE_LIST = 'storage.list',
  
  // Data exchange
  DATA_REQUEST = 'data.request',
  DATA_RESPONSE = 'data.response',
  DATA_STREAM_START = 'data.stream.start',
  DATA_STREAM_CHUNK = 'data.stream.chunk',
  DATA_STREAM_END = 'data.stream.end',
  
  // Error handling
  ERROR = 'error',
  ERROR_RETRY = 'error.retry',
  ERROR_TIMEOUT = 'error.timeout'
}

export interface MessageHeaders {
  [key: string]: string | number | boolean | null | undefined;
  correlationId: string;
  messageId: string;
  timestamp: string;
  source: string;
  destination?: string;
  replyTo?: string;
  ttl?: number; // Time to live in milliseconds
}

export interface Message<T = unknown> {
  type: MessageType;
  headers: MessageHeaders;
  payload: T;
}

// Task Management Interfaces

/**
 * Base interface for all task-related payloads
 */
export interface BaseTaskPayload {
  taskId: string;
  taskType: string;
  metadata?: Record<string, unknown>;
}

/**
 * Payload for creating a new task
 */
export interface TaskCreatePayload extends BaseTaskPayload {
  parameters: Record<string, unknown>;
  priority?: number;
  timeout?: number;
  assignTo?: string; // Optional service ID to assign the task to
  dueDate?: string; // ISO timestamp for when the task should be completed
  dependencies?: string[]; // List of task IDs that must be completed before this task
}

/**
 * Payload for updating an existing task
 */
export interface TaskUpdatePayload extends BaseTaskPayload {
  status: TaskStatus;
  progress?: number; // 0-100 percentage
  statusMessage?: string;
  estimatedCompletion?: string; // ISO timestamp
  updatedParameters?: Record<string, unknown>;
}

/**
 * Payload for completing a task
 */
export interface TaskCompletePayload extends BaseTaskPayload {
  result: unknown;
  processingTime?: number; // In milliseconds
  metrics?: Record<string, number>;
}

/**
 * Payload for a failed task
 */
export interface TaskFailPayload extends BaseTaskPayload {
  error: ErrorPayload;
  partialResult?: unknown;
  retryable: boolean;
  attemptCount?: number;
}

/**
 * Payload for requesting a task to be performed
 */
export interface TaskRequestPayload extends BaseTaskPayload {
  parameters: Record<string, unknown>;
  priority?: number;
  timeout?: number;
  requiredCapabilities?: string[];
}

/**
 * Payload for cancelling a task
 */
export interface TaskCancelPayload extends BaseTaskPayload {
  reason?: string;
  force?: boolean;
}

/**
 * Payload for assigning a task to a specific service
 */
export interface TaskAssignPayload extends BaseTaskPayload {
  assignedTo: string; // Service ID
  assignedBy: string; // Service ID that made the assignment
  reason?: string;
}

/**
 * Task status enum
 */
export enum TaskStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  BLOCKED = 'BLOCKED'
}

/**
 * Enhanced error payload with detailed information for debugging and recovery
 */
export interface ErrorPayload {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
  source?: string; // Component that generated the error
  timestamp?: string; // ISO timestamp when the error occurred
  severity?: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  correlationId?: string; // For tracking related errors
  suggestedAction?: string; // Recommended action to resolve the error
  errorType?: string; // Classification of error (e.g., 'NETWORK', 'TIMEOUT', 'VALIDATION')
}

export interface RegistrationPayload {
  agentId: string;
  capabilities: string[];
  metadata?: Record<string, unknown>;
}

export interface HeartbeatPayload {
  timestamp: string;
  status: ServiceStatus;
  metrics?: Record<string, number>;
  serviceType?: string;
  capabilities?: string[];
}

// Service information interface
export interface ServiceInfo {
  serviceId: string;
  serviceType: string;
  capabilities: string[];
  lastSeen: number;
  metadata: Record<string, unknown>;
  status: ServiceStatus;
  version?: string;
  host?: {
    hostname?: string;
    ip?: string;
    pid?: number;
  };
  metrics?: {
    memory?: number;
    cpu?: number;
    uptime?: number;
    queueLength?: number;
  };
}

// Storage Operation Interfaces

/**
 * Base interface for all storage-related payloads
 */
export interface BaseStoragePayload {
  key: string;
  namespace?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Payload for setting a value in storage
 */
export interface StorageSetPayload extends BaseStoragePayload {
  value: unknown;
  ttl?: number; // Time to live in milliseconds
  options?: {
    overwrite?: boolean;
    ifNotExists?: boolean;
    ifVersion?: number;
  };
}

/**
 * Payload for getting a value from storage
 */
export interface StorageGetPayload extends BaseStoragePayload {
  includeMetadata?: boolean;
  version?: number; // Specific version to retrieve
}

/**
 * Payload for requesting storage data
 */
export interface StorageRequestPayload extends BaseStoragePayload {
  requesterId: string;
  priority?: number;
  timeout?: number;
}

/**
 * Payload for deleting a value from storage
 */
export interface StorageDeletePayload extends BaseStoragePayload {
  options?: {
    ifExists?: boolean;
    ifVersion?: number;
  };
}

/**
 * Payload for listing keys in storage
 */
export interface StorageListPayload {
  namespace?: string;
  pattern?: string; // Glob pattern for matching keys
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

// Data Exchange Interfaces

/**
 * Base interface for all data exchange payloads
 */
export interface BaseDataPayload {
  requestId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Payload for requesting data
 */
export interface DataRequestPayload extends BaseDataPayload {
  dataType: string;
  parameters: Record<string, unknown>;
  priority?: number;
  timeout?: number;
}

/**
 * Payload for responding to a data request
 */
export interface DataResponsePayload extends BaseDataPayload {
  data: unknown;
  processingTime?: number; // In milliseconds
  format?: string; // Data format (e.g., 'json', 'binary', 'text')
}

/**
 * Payload for starting a data stream
 */
export interface DataStreamStartPayload extends BaseDataPayload {
  dataType: string;
  totalChunks?: number;
  totalSize?: number;
  format?: string;
  compression?: string;
}

/**
 * Payload for a data stream chunk
 */
export interface DataStreamChunkPayload extends BaseDataPayload {
  chunkIndex: number;
  data: unknown;
  isLast: boolean;
  checksum?: string;
}

/**
 * Payload for ending a data stream
 */
export interface DataStreamEndPayload extends BaseDataPayload {
  totalChunks: number;
  totalSize: number;
  checksum?: string;
  error?: ErrorPayload;
}

// Type guards
export function isTaskMessage(msg: Message): msg is Message<BaseTaskPayload> {
  return [
    MessageType.TASK_CREATE,
    MessageType.TASK_UPDATE,
    MessageType.TASK_COMPLETE,
    MessageType.TASK_FAIL,
    MessageType.TASK_REQUEST,
    MessageType.TASK_CANCEL,
    MessageType.TASK_ASSIGN
  ].includes(msg.type as MessageType);
}

export function isErrorMessage(msg: Message): msg is Message<ErrorPayload> {
  return [
    MessageType.ERROR,
    MessageType.ERROR_RETRY,
    MessageType.ERROR_TIMEOUT
  ].includes(msg.type as MessageType);
}

export function isHeartbeatMessage(msg: Message): msg is Message<HeartbeatPayload> {
  return msg.type === MessageType.HEARTBEAT;
}

/**
 * Type guard for storage operation messages
 */
export function isStorageMessage(msg: Message): msg is Message<BaseStoragePayload> {
  return [
    MessageType.STORAGE_SET,
    MessageType.STORAGE_GET,
    MessageType.STORAGE_REQUEST,
    MessageType.STORAGE_DELETE,
    MessageType.STORAGE_LIST
  ].includes(msg.type as MessageType);
}

/**
 * Type guard for data exchange messages
 */
export function isDataMessage(msg: Message): msg is Message<BaseDataPayload> {
  return [
    MessageType.DATA_REQUEST,
    MessageType.DATA_RESPONSE,
    MessageType.DATA_STREAM_START,
    MessageType.DATA_STREAM_CHUNK,
    MessageType.DATA_STREAM_END
  ].includes(msg.type as MessageType);
}

/**
 * Type guard for specific task message types
 */
export function isTaskCreateMessage(msg: Message): msg is Message<TaskCreatePayload> {
  return msg.type === MessageType.TASK_CREATE;
}

export function isTaskUpdateMessage(msg: Message): msg is Message<TaskUpdatePayload> {
  return msg.type === MessageType.TASK_UPDATE;
}

export function isTaskCompleteMessage(msg: Message): msg is Message<TaskCompletePayload> {
  return msg.type === MessageType.TASK_COMPLETE;
}

export function isTaskFailMessage(msg: Message): msg is Message<TaskFailPayload> {
  return msg.type === MessageType.TASK_FAIL;
}

export function isTaskRequestMessage(msg: Message): msg is Message<TaskRequestPayload> {
  return msg.type === MessageType.TASK_REQUEST;
}

/**
 * Type guard for specific storage message types
 */
export function isStorageSetMessage(msg: Message): msg is Message<StorageSetPayload> {
  return msg.type === MessageType.STORAGE_SET;
}

export function isStorageGetMessage(msg: Message): msg is Message<StorageGetPayload> {
  return msg.type === MessageType.STORAGE_GET;
}

export function isStorageRequestMessage(msg: Message): msg is Message<StorageRequestPayload> {
  return msg.type === MessageType.STORAGE_REQUEST;
}

/**
 * Type guard for specific data message types
 */
export function isDataRequestMessage(msg: Message): msg is Message<DataRequestPayload> {
  return msg.type === MessageType.DATA_REQUEST;
}

export function isDataResponseMessage(msg: Message): msg is Message<DataResponsePayload> {
  return msg.type === MessageType.DATA_RESPONSE;
}
