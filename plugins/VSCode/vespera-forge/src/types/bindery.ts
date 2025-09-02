/**
 * TypeScript type definitions for Rust Bindery integration
 * These types mirror the Rust structs for interoperability
 */

import { UUID } from 'crypto';

// Core Bindery Types
export type CodexId = string; // UUID string representation
export type TemplateId = string;
export type ProjectId = string;
export type UserId = string;
export type OperationId = string;
export type ContentHash = string;

// Task Management Types (matching Rust definitions)
export enum TaskStatus {
  Todo = 'todo',
  Doing = 'doing', 
  Review = 'review',
  Done = 'done',
  Blocked = 'blocked',
  Cancelled = 'cancelled',
  Archived = 'archived'
}

export enum TaskPriority {
  Critical = 'critical',
  High = 'high',
  Normal = 'normal',
  Low = 'low',
  Someday = 'someday'
}

export enum TaskRelation {
  ParentChild = 'parent_child',
  DependsOn = 'depends_on',
  Blocks = 'blocks',
  RelatesTo = 'relates_to',
  DuplicateOf = 'duplicate_of'
}

export enum ExecutionStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled'
}

// Task Data Structures
export interface TaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  project_id?: string;
  parent_id?: CodexId;
  assignee?: string;
  due_date?: string; // ISO 8601 string
  tags: string[];
  labels: Record<string, string>;
  subtasks: TaskInput[];
}

export interface TaskUpdateInput {
  task_id: CodexId;
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee?: string;
  due_date?: string; // ISO 8601 string
  role?: string;
}

export interface TaskSummary {
  id: CodexId;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: string;
  project_id?: string;
  parent_id?: CodexId;
  child_count: number;
  created_at: string; // ISO 8601 string
  updated_at: string; // ISO 8601 string
  due_date?: string; // ISO 8601 string
  tags: string[];
}

export interface TaskTree {
  task: TaskSummary;
  children: TaskTree[];
  depth: number;
}

export interface TaskExecutionResult {
  task_id: CodexId;
  execution_id: string;
  status: ExecutionStatus;
  output?: string;
  error?: string;
  started_at: string; // ISO 8601 string
  completed_at?: string; // ISO 8601 string
  role_name?: string;
  metadata: Record<string, any>;
}

export interface TaskDashboard {
  total_tasks: number;
  status_breakdown: Record<TaskStatus, number>;
  priority_breakdown: Record<TaskPriority, number>;
  recent_tasks: TaskSummary[];
  overdue_tasks: TaskSummary[];
  upcoming_tasks: TaskSummary[];
  project_breakdown: Record<string, number>;
  completion_rate: number;
  average_completion_time?: number; // Duration in seconds
}

export interface DependencyAnalysis {
  task_id: CodexId;
  depends_on: CodexId[];
  blocks: CodexId[];
  is_blocked: boolean;
  blocking_tasks: CodexId[];
  dependency_depth: number;
  critical_path: boolean;
}

// Role Management Types
export enum ToolGroup {
  FileOperations = 'file_operations',
  ProcessExecution = 'process_execution',
  NetworkAccess = 'network_access',
  SystemInfo = 'system_info',
  DatabaseAccess = 'database_access',
  WebScraping = 'web_scraping',
  ApiCalls = 'api_calls',
  GitOperations = 'git_operations',
  PackageManagement = 'package_management',
  Testing = 'testing',
  Deployment = 'deployment',
  Monitoring = 'monitoring',
  Security = 'security',
  AiLlm = 'ai_llm',
  Development = 'development'
}

export interface FileRestrictions {
  allowed_read_patterns: string[];
  allowed_write_patterns: string[];
  denied_patterns: string[];
  working_directory_restrictions: string[];
}

export interface ExecutionContext {
  max_execution_time?: number; // seconds
  max_memory_usage?: number; // MB
  network_access: boolean;
  subprocess_allowed: boolean;
  environment_variables: Record<string, string>;
}

export interface Role {
  name: string;
  description: string;
  capabilities: ToolGroup[];
  file_restrictions: FileRestrictions;
  execution_context: ExecutionContext;
  metadata: Record<string, any>;
}

export interface RoleExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  duration: number; // Duration in milliseconds
  files_accessed: string[];
  tools_used: string[];
  exit_code?: number;
}

// Codex and CRDT Types
export interface CodexMetadata {
  id: CodexId;
  title: string;
  template_id: TemplateId;
  created_by: UserId;
  created_at: string; // ISO 8601 string
  updated_at: string; // ISO 8601 string
  version: number;
  tags: string[];
  references: CodexReference[];
}

export interface CodexReference {
  from_id: CodexId;
  to_id: CodexId;
  ref_type: string;
  context?: string;
}

export interface CodexContent {
  fields: Record<string, any>;
  raw_content: string;
}

export interface Codex {
  metadata: CodexMetadata;
  content: CodexContent;
}

// Bindery Configuration
export interface BinderyConfig {
  storage_path?: string;
  collaboration_enabled: boolean;
  max_operations_in_memory: number;
  auto_gc_enabled: boolean;
  gc_interval_seconds: number;
  compression_enabled: boolean;
  user_id?: UserId;
  project_id?: ProjectId;
}

// Hook System Types
export interface HookAgent {
  id: string;
  template_id: TemplateId;
  template_name: string;
  automation_rule: Record<string, any>;
  status: 'active' | 'paused' | 'error';
  last_execution?: string; // ISO 8601 string
  execution_count: number;
  error_count: number;
}

export interface TimedAgent extends HookAgent {
  schedule_config: Record<string, any>;
  next_execution?: string; // ISO 8601 string
}

export interface HookTriggerInput {
  hook_id: string;
  trigger_context: Record<string, any>;
  force_execute?: boolean;
}

// Communication Protocol Types
export interface BinderyRequest<T = any> {
  jsonrpc: string;
  method: string;
  params?: T;
  id: number;
}

export interface BinderyResponse<T = any> {
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface BinderyError {
  code: number;
  message: string;
  details?: any;
}

// Result type for error handling
export type BinderyResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: BinderyError;
};

// Version information
export interface VersionInfo {
  version: string;
  build_target: string;
  build_profile: string;
  features: string;
}

// Connection status
export enum BinderyConnectionStatus {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Error = 'error'
}

export interface BinderyConnectionInfo {
  status: BinderyConnectionStatus;
  version?: VersionInfo;
  last_error?: string;
  connected_at?: string; // ISO 8601 string
  process_id?: number;
}