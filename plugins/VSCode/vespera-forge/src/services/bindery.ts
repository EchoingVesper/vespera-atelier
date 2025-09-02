/**
 * Bindery Service Layer - Abstracts communication with Rust Bindery backend
 * 
 * This service provides a high-level TypeScript API for interacting with the
 * Rust Bindery backend, handling serialization, error recovery, and connection management.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as vscode from 'vscode';

import {
  BinderyConfig,
  BinderyConnectionStatus,
  BinderyConnectionInfo,
  BinderyRequest,
  BinderyResponse,
  BinderyResult,
  BinderyError,
  CodexId,
  TaskInput,
  TaskUpdateInput,
  TaskSummary,
  TaskTree,
  TaskDashboard,
  TaskExecutionResult,
  DependencyAnalysis,
  Role,
  RoleExecutionResult,
  Codex,
  HookAgent,
  TimedAgent,
  HookTriggerInput,
  VersionInfo
} from '../types/bindery';

interface BinderyServiceConfig {
  binderyPath?: string;
  workspaceRoot?: string;
  enableLogging?: boolean;
  connectionTimeout?: number; // milliseconds
  maxRetries?: number;
  retryDelay?: number; // milliseconds
}

interface PendingRequest {
  resolve: (result: any) => void;
  reject: (error: BinderyError) => void;
  timeout: NodeJS.Timeout;
}

export class BinderyService extends EventEmitter {
  private process: ChildProcess | null = null;
  private connectionInfo: BinderyConnectionInfo;
  private config: BinderyServiceConfig;
  private requestId = 0;
  private pendingRequests = new Map<number, PendingRequest>();
  private buffer = '';
  private isConnecting = false;

  constructor(config: Partial<BinderyServiceConfig> = {}) {
    super();
    
    this.config = {
      binderyPath: config.binderyPath || undefined,
      workspaceRoot: config.workspaceRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd(),
      enableLogging: config.enableLogging ?? true,
      connectionTimeout: config.connectionTimeout ?? 5000,
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000
    };

    this.connectionInfo = {
      status: BinderyConnectionStatus.Disconnected
    };
  }

  /**
   * Initialize connection to Bindery backend
   */
  public async initialize(): Promise<BinderyResult<VersionInfo>> {
    if (this.isConnecting) {
      return { success: false, error: { code: -1, message: 'Already connecting' } };
    }

    if (this.connectionInfo.status === BinderyConnectionStatus.Connected) {
      return { success: false, error: { code: -1, message: 'Already connected' } };
    }

    try {
      this.isConnecting = true;
      this.connectionInfo.status = BinderyConnectionStatus.Connecting;
      this.emit('statusChanged', this.connectionInfo);

      const binderyPath = await this.findBinderyExecutable();
      if (!binderyPath) {
        throw new Error('Bindery executable not found');
      }

      await this.startBinderyProcess(binderyPath);
      
      // Temporarily mark as connected to allow version check
      this.connectionInfo.status = BinderyConnectionStatus.Connected;
      const versionInfo = await this.getVersionInfo();
      
      this.connectionInfo = {
        status: BinderyConnectionStatus.Connected,
        version: versionInfo.success ? versionInfo.data : undefined,
        connected_at: new Date().toISOString(),
        process_id: this.process?.pid || undefined
      };

      this.emit('statusChanged', this.connectionInfo);
      this.log('Bindery connection established', this.connectionInfo);

      return versionInfo;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.connectionInfo = {
        status: BinderyConnectionStatus.Error,
        last_error: errorMessage
      };
      
      this.emit('statusChanged', this.connectionInfo);
      this.log('Failed to initialize Bindery:', error);
      
      return { 
        success: false, 
        error: { code: -1, message: errorMessage } 
      };
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Disconnect from Bindery backend
   */
  public async disconnect(): Promise<void> {
    if (this.process) {
      // Cancel all pending requests
      for (const [id, request] of this.pendingRequests.entries()) {
        clearTimeout(request.timeout);
        request.reject({ code: -1, message: 'Connection closed' });
      }
      this.pendingRequests.clear();

      // Terminate process gracefully
      this.process.kill('SIGTERM');
      
      // Force kill after timeout
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
      }, 3000);

      this.process = null;
    }

    this.connectionInfo = {
      status: BinderyConnectionStatus.Disconnected
    };
    
    this.emit('statusChanged', this.connectionInfo);
    this.log('Bindery connection closed');
  }

  /**
   * Get current connection status
   */
  public getConnectionInfo(): BinderyConnectionInfo {
    return { ...this.connectionInfo };
  }

  /**
   * Check if connected to Bindery
   */
  public isConnected(): boolean {
    return this.connectionInfo.status === BinderyConnectionStatus.Connected;
  }

  // Task Management API

  /**
   * Create a new task
   */
  public async createTask(input: TaskInput): Promise<BinderyResult<CodexId>> {
    return this.sendRequest('create_task', { task_input: input });
  }

  /**
   * Get task by ID
   */
  public async getTask(taskId: CodexId): Promise<BinderyResult<TaskSummary>> {
    return this.sendRequest('get_task', { task_id: taskId });
  }

  /**
   * Update existing task
   */
  public async updateTask(input: TaskUpdateInput): Promise<BinderyResult<TaskSummary>> {
    return this.sendRequest('update_task', { update_input: input });
  }

  /**
   * Delete task
   */
  public async deleteTask(taskId: CodexId, deleteSubtasks = false): Promise<BinderyResult<boolean>> {
    return this.sendRequest('delete_task', { 
      task_id: taskId, 
      delete_subtasks: deleteSubtasks 
    });
  }

  /**
   * List tasks with optional filtering
   */
  public async listTasks(filters: {
    project_id?: string;
    parent_id?: CodexId;
    status_filter?: string;
    priority_filter?: string;
    assignee?: string;
    limit?: number;
  } = {}): Promise<BinderyResult<TaskSummary[]>> {
    return this.sendRequest('list_tasks', filters);
  }

  /**
   * Get task dashboard with statistics
   */
  public async getTaskDashboard(projectId?: string): Promise<BinderyResult<TaskDashboard>> {
    return this.sendRequest('get_task_dashboard', { 
      project_id: projectId || null 
    });
  }

  /**
   * Create hierarchical task tree
   */
  public async createTaskTree(
    treeTitle: string,
    treeDescription: string,
    subtasks: TaskInput[],
    projectId?: string
  ): Promise<BinderyResult<CodexId>> {
    return this.sendRequest('create_task_tree', {
      tree_title: treeTitle,
      tree_description: treeDescription,
      subtasks,
      project_id: projectId || null
    });
  }

  /**
   * Get task tree structure
   */
  public async getTaskTree(
    taskId: CodexId,
    maxDepth = 5
  ): Promise<BinderyResult<TaskTree>> {
    return this.sendRequest('get_task_tree', {
      task_id: taskId,
      max_depth: maxDepth
    });
  }

  /**
   * Execute task with role
   */
  public async executeTask(
    taskId: CodexId,
    dryRun = false
  ): Promise<BinderyResult<TaskExecutionResult>> {
    return this.sendRequest('execute_task', {
      task_id: taskId,
      dry_run: dryRun
    });
  }

  /**
   * Complete task with output
   */
  public async completeTask(
    taskId: CodexId,
    output?: string,
    artifacts?: string[]
  ): Promise<BinderyResult<TaskSummary>> {
    return this.sendRequest('complete_task', {
      task_id: taskId,
      output: output || null,
      artifacts: artifacts || null
    });
  }

  /**
   * Analyze task dependencies
   */
  public async analyzeTaskDependencies(
    taskId: CodexId
  ): Promise<BinderyResult<DependencyAnalysis>> {
    return this.sendRequest('analyze_task_dependencies', {
      task_id: taskId
    });
  }

  // Role Management API

  /**
   * List available roles
   */
  public async listRoles(): Promise<BinderyResult<Role[]>> {
    return this.sendRequest('list_roles', {});
  }

  /**
   * Assign role to task
   */
  public async assignRoleToTask(
    taskId: CodexId,
    roleName: string
  ): Promise<BinderyResult<void>> {
    return this.sendRequest('assign_role_to_task', {
      task_id: taskId,
      role_name: roleName
    });
  }

  // Codex Management API

  /**
   * Create new Codex
   */
  public async createCodex(
    title: string,
    templateId: string
  ): Promise<BinderyResult<CodexId>> {
    return this.sendRequest('create_codex', {
      title,
      template_id: templateId
    });
  }

  /**
   * Get Codex by ID
   */
  public async getCodex(codexId: CodexId): Promise<BinderyResult<Codex>> {
    return this.sendRequest('get_codex', { codex_id: codexId });
  }

  /**
   * List all Codices
   */
  public async listCodeices(): Promise<BinderyResult<CodexId[]>> {
    return this.sendRequest('list_codices', {});
  }

  /**
   * Delete Codex
   */
  public async deleteCodex(codexId: CodexId): Promise<BinderyResult<boolean>> {
    return this.sendRequest('delete_codex', { codex_id: codexId });
  }

  // Hook System API

  /**
   * Get hook agent status
   */
  public async getHookAgentStatus(): Promise<BinderyResult<{
    hook_agents: HookAgent[];
    timed_agents: TimedAgent[];
  }>> {
    return this.sendRequest('get_hook_agent_status', {});
  }

  /**
   * Trigger hook agent
   */
  public async triggerHookAgent(input: HookTriggerInput): Promise<BinderyResult<any>> {
    return this.sendRequest('trigger_hook_agent', { input_data: input });
  }

  // Utility Methods

  /**
   * Get Bindery version information
   */
  public async getVersionInfo(): Promise<BinderyResult<VersionInfo>> {
    return this.sendRequest('version_info', {});
  }

  /**
   * Hot reload Bindery server (development only)
   */
  public async hotReload(): Promise<BinderyResult<void>> {
    return this.sendRequest('hot_reload_server', {});
  }

  // Private Implementation

  private async findBinderyExecutable(): Promise<string | null> {
    this.log(`Workspace root: ${this.config.workspaceRoot}`);
    
    // Priority order for finding Bindery executable
    const searchPaths = [
      this.config.binderyPath,
      path.join(this.config.workspaceRoot || '', '../../../packages/vespera-utilities/vespera-bindery/target/debug/bindery-server'),
      path.join(this.config.workspaceRoot || '', '../../../packages/vespera-utilities/vespera-bindery/target/release/bindery-server'),
      // Also try from the monorepo root directly
      '/home/aya/dev/monorepo/vespera-atelier/packages/vespera-utilities/vespera-bindery/target/debug/bindery-server',
      'bindery-server' // PATH lookup
    ].filter(Boolean);

    this.log(`Searching for Bindery in paths:`, searchPaths);

    for (const binderyPath of searchPaths) {
      try {
        if (binderyPath && binderyPath !== 'bindery-server') {
          this.log(`Checking path: ${binderyPath}`);
          await fs.access(binderyPath!, fs.constants.F_OK | fs.constants.X_OK);
          this.log(`Found Bindery at: ${binderyPath}`);
          return binderyPath!;
        }
      } catch (error) {
        this.log(`Path not found: ${binderyPath} - ${error}`);
      }
    }

    // For now, we'll create a mock server for development
    this.log('Bindery executable not found, using mock mode');
    return null;
  }

  private async startBinderyProcess(binderyPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = ['--json-rpc'];
      this.process = spawn(binderyPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: this.config.workspaceRoot
      });

      this.process.on('error', (error) => {
        this.log('Bindery process error:', error);
        reject(error);
      });

      this.process.on('exit', (code, signal) => {
        this.log(`Bindery process exited with code ${code}, signal ${signal}`);
        this.connectionInfo.status = BinderyConnectionStatus.Disconnected;
        this.emit('statusChanged', this.connectionInfo);
      });

      // Handle stdout (JSON-RPC responses)
      this.process.stdout!.on('data', (data) => {
        this.handleProcessData(data);
      });

      // Handle stderr (logging)
      this.process.stderr!.on('data', (data) => {
        this.log('Bindery stderr:', data.toString());
      });

      // Give process time to start
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          resolve();
        } else {
          reject(new Error('Process failed to start'));
        }
      }, 1000);
    });
  }

  private handleProcessData(data: Buffer): void {
    this.buffer += data.toString();
    
    // Process complete JSON lines
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line in buffer
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const response: BinderyResponse = JSON.parse(line);
          this.handleResponse(response);
        } catch (error) {
          this.log('Failed to parse Bindery response:', line, error);
        }
      }
    }
  }

  private handleResponse(response: BinderyResponse): void {
    this.log('Received response:', JSON.stringify(response));
    
    const request = this.pendingRequests.get(response.id);
    if (!request) {
      this.log('Received response for unknown request ID:', response.id);
      return;
    }

    this.pendingRequests.delete(response.id);
    clearTimeout(request.timeout);

    if (response.error) {
      this.log('Response contains error:', response.error);
      request.reject(response.error);
    } else {
      this.log('Response successful, result:', response.result);
      request.resolve(response.result);
    }
  }

  private async sendRequest<T>(method: string, params?: any): Promise<BinderyResult<T>> {
    this.log(`Sending request: ${method}, connected: ${this.isConnected()}, status: ${this.connectionInfo.status}`);
    
    if (!this.isConnected()) {
      this.log(`Request ${method} failed - not connected. Status: ${this.connectionInfo.status}`);
      return { 
        success: false, 
        error: { code: -1, message: 'Not connected to Bindery' } 
      };
    }

    // For development - return mock data if no process
    if (!this.process) {
      return this.handleMockRequest(method, params);
    }

    const requestId = ++this.requestId;
    const request = {
      jsonrpc: "2.0",
      method,
      params,
      id: requestId
    } as BinderyRequest;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        resolve({ 
          success: false, 
          error: { code: -1, message: 'Request timeout' } 
        });
      }, this.config.connectionTimeout);

      const pendingRequest: PendingRequest = {
        resolve: (result: T) => {
          resolve({ success: true, data: result });
        },
        reject: (error: BinderyError) => {
          resolve({ success: false, error });
        },
        timeout
      };

      this.pendingRequests.set(requestId, pendingRequest);

      try {
        const requestJson = JSON.stringify(request);
        this.log('Writing to Bindery stdin:', requestJson);
        this.process!.stdin!.write(requestJson + '\n');
      } catch (error) {
        this.pendingRequests.delete(requestId);
        clearTimeout(timeout);
        resolve({ 
          success: false, 
          error: { 
            code: -1, 
            message: error instanceof Error ? error.message : String(error)
          } 
        });
      }
    });
  }

  // Mock implementation for development
  private async handleMockRequest<T>(method: string, params?: any): Promise<BinderyResult<T>> {
    this.log(`Mock request: ${method}`, params);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    switch (method) {
      case 'version_info':
        return {
          success: true,
          data: {
            version: '0.1.0-mock',
            build_target: 'x86_64-unknown-linux-gnu',
            build_profile: 'debug',
            features: 'mock'
          } as any
        };

      case 'get_task_dashboard':
        return {
          success: true,
          data: {
            total_tasks: 0,
            status_breakdown: {},
            priority_breakdown: {},
            recent_tasks: [],
            overdue_tasks: [],
            upcoming_tasks: [],
            project_breakdown: {},
            completion_rate: 0,
            average_completion_time: null
          } as any
        };

      case 'list_roles':
        return {
          success: true,
          data: [] as any
        };

      default:
        return {
          success: false,
          error: { code: -1, message: `Mock: Method ${method} not implemented` }
        };
    }
  }

  private log(...args: any[]): void {
    if (this.config.enableLogging) {
      console.log('[BinderyService]', ...args);
    }
  }
}

// Singleton instance for extension-wide use
let binderyServiceInstance: BinderyService | null = null;

/**
 * Get or create the global Bindery service instance
 */
export function getBinderyService(config?: Partial<BinderyServiceConfig>): BinderyService {
  if (!binderyServiceInstance) {
    binderyServiceInstance = new BinderyService(config);
  }
  return binderyServiceInstance;
}

/**
 * Dispose of the global Bindery service instance
 */
export async function disposeBinderyService(): Promise<void> {
  if (binderyServiceInstance) {
    await binderyServiceInstance.disconnect();
    binderyServiceInstance = null;
  }
}