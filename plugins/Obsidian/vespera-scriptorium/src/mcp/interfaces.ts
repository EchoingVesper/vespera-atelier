/**
 * MCP Client Interfaces for Obsidian Plugin
 * 
 * Defines TypeScript interfaces for Model Context Protocol communication,
 * connection handling, and error recovery mechanisms.
 */

export interface MCPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

export interface MCPRequest extends MCPMessage {
  method: string;
  params?: any;
}

export interface MCPResponse extends MCPMessage {
  result?: any;
  error?: MCPError;
}

export interface MCPNotification extends MCPMessage {
  method: string;
  params?: any;
}

// Transport layer interfaces
export interface MCPTransport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(message: MCPMessage): Promise<void>;
  onMessage(callback: (message: MCPMessage) => void): void;
  onError(callback: (error: Error) => void): void;
  onDisconnect(callback: () => void): void;
  isConnected(): boolean;
}

export interface MCPTransportConfig {
  type: 'stdio' | 'websocket' | 'sse';
  endpoint?: string;
  command?: string;
  args?: string[];
  timeout?: number;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

// Connection management interfaces
export interface MCPConnectionConfig {
  transport: MCPTransportConfig;
  clientInfo: {
    name: string;
    version: string;
  };
  capabilities?: MCPCapabilities;
  timeout?: number;
  heartbeatInterval?: number;
}

export interface MCPCapabilities {
  tools?: ToolCapability[];
  resources?: ResourceCapability[];
  prompts?: PromptCapability[];
  logging?: LoggingCapability;
}

export interface ToolCapability {
  name: string;
  description?: string;
  inputSchema?: any;
}

export interface ResourceCapability {
  uri: string;
  name?: string;
  description?: string;
}

export interface PromptCapability {
  name: string;
  description?: string;
  arguments?: PromptArgument[];
}

export interface PromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

export interface LoggingCapability {
  level: 'debug' | 'info' | 'warn' | 'error';
}

// Connection state and lifecycle
export enum MCPConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

export interface MCPConnectionInfo {
  state: MCPConnectionState;
  serverInfo?: {
    name: string;
    version: string;
  };
  capabilities?: MCPCapabilities;
  lastError?: Error;
  connectTime?: Date;
  reconnectAttempts?: number;
}

// Event system interfaces
export interface MCPEventEmitter {
  on(event: MCPEvent, listener: (...args: any[]) => void): void;
  off(event: MCPEvent, listener: (...args: any[]) => void): void;
  emit(event: MCPEvent, ...args: any[]): void;
}

export type MCPEvent = 
  | 'connect' 
  | 'disconnect' 
  | 'error' 
  | 'message' 
  | 'state-change'
  | 'tool-call'
  | 'resource-update'
  | 'notification';

// Request/Response handling
export interface MCPRequestOptions {
  timeout?: number;
  retries?: number;
  priority?: 'low' | 'normal' | 'high';
}

export interface MCPPendingRequest {
  id: string | number;
  method: string;
  timestamp: number;
  timeout?: number;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
}

// Tool invocation interfaces
export interface ToolInvocation {
  name: string;
  arguments: any;
  callId?: string;
}

export interface ToolResult {
  content?: any;
  isError?: boolean;
  error?: string;
}

// Resource interfaces
export interface ResourceRequest {
  uri: string;
}

export interface ResourceResponse {
  uri: string;
  mimeType?: string;
  content: any;
  metadata?: any;
}

// Error handling and recovery
export interface MCPErrorHandler {
  handleConnectionError(error: Error): Promise<boolean>; // return true to retry
  handleRequestError(error: MCPError, request: MCPRequest): Promise<any>;
  handleUnexpectedResponse(response: MCPResponse): void;
  handleTimeout(requestId: string | number): void;
}

export interface MCPRetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryableErrors: number[]; // MCP error codes that should trigger retry
}

// Client configuration
export interface MCPClientConfig {
  connection: MCPConnectionConfig;
  errorHandler?: MCPErrorHandler;
  retryConfig?: MCPRetryConfig;
  debug?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

// Client interface
export interface IMCPClient {
  // Connection management
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getConnectionInfo(): MCPConnectionInfo;
  
  // Request/response
  request(method: string, params?: any, options?: MCPRequestOptions): Promise<any>;
  
  // Tool invocation
  invokeTool(name: string, arguments: any): Promise<ToolResult>;
  
  // Resource access
  getResource(uri: string): Promise<ResourceResponse>;
  
  // Event handling
  on(event: MCPEvent, listener: (...args: any[]) => void): void;
  off(event: MCPEvent, listener: (...args: any[]) => void): void;
  
  // Capabilities
  getServerCapabilities(): MCPCapabilities | undefined;
  
  // Lifecycle
  dispose(): Promise<void>;
}

// Vespera-specific interfaces extending base MCP
export interface VesperaMCPClient extends IMCPClient {
  // Task management
  createTask(taskData: any): Promise<any>;
  updateTask(taskId: string, updates: any): Promise<any>;
  deleteTask(taskId: string): Promise<any>;
  getTasks(filters?: any): Promise<any[]>;
  
  // Role management
  getRoles(): Promise<any[]>;
  assignRole(taskId: string, roleName: string): Promise<any>;
  
  // Project management
  createProject(projectData: any): Promise<any>;
  getProjects(): Promise<any[]>;
  
  // Real-time subscriptions
  subscribeToTaskUpdates(callback: (task: any) => void): Promise<void>;
  subscribeToRoleChanges(callback: (role: any) => void): Promise<void>;
  unsubscribeFromTaskUpdates(): Promise<void>;
  unsubscribeFromRoleChanges(): Promise<void>;
}

// Obsidian-specific integration interfaces
export interface ObsidianMCPIntegration {
  // Vault integration
  syncVaultWithTasks(): Promise<void>;
  exportTasksToNotes(): Promise<void>;
  importNotesAsTasks(): Promise<void>;
  
  // UI integration
  showTaskInModal(taskId: string): Promise<void>;
  updateStatusBar(status: string): void;
  showNotification(message: string, type: 'info' | 'warn' | 'error'): void;
  
  // Context integration
  getCurrentNoteContext(): any;
  getSelectedText(): string | null;
  getActiveProject(): string | null;
}

// Configuration validation
export interface MCPConfigValidator {
  validateTransportConfig(config: MCPTransportConfig): string[];
  validateConnectionConfig(config: MCPConnectionConfig): string[];
  validateClientConfig(config: MCPClientConfig): string[];
}

// Logging interface
export interface MCPLogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, error?: Error, ...args: any[]): void;
}

// Health monitoring
export interface MCPHealthMonitor {
  getConnectionHealth(): {
    isHealthy: boolean;
    latency?: number;
    lastHeartbeat?: Date;
    errorRate?: number;
  };
  startHealthCheck(): void;
  stopHealthCheck(): void;
}