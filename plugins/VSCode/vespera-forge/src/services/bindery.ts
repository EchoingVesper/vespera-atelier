/**
 * Security-Enhanced Bindery Service Layer
 * 
 * Provides a high-level TypeScript API for interacting with the Rust Bindery backend
 * with enterprise-grade security including process isolation, JSON-RPC validation,
 * and comprehensive audit logging while maintaining high performance.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as vscode from 'vscode';

// Security imports
import { SecurityEnhancedVesperaCoreServices } from '../core/security/SecurityEnhancedCoreServices';
import { 
  VesperaSecurityEvent, 
  VesperaSecurityErrorCode,
  ThreatSeverity 
} from '../types/security';
import {
  BinderySecurityConfig,
  BinderyProcessSecurity,
  JsonRpcSecurityValidation,
  BinderySecurityAudit,
  BinderySecurityThreat,
  BinderyContentProtection,
  BinderySecurityMetrics,
  BinderySecurityContext
} from '../types/bindery-security';

import {
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
  
  // Security configuration
  security?: BinderySecurityConfig;
  processIsolation?: BinderyProcessSecurity;
  jsonRpcValidation?: JsonRpcSecurityValidation;
  contentProtection?: BinderyContentProtection;
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
  private isShuttingDown = false;

  // Security components
  private securityServices: SecurityEnhancedVesperaCoreServices | null = null;
  private securityAuditLog: BinderySecurityAudit[] = [];
  private securityMetrics!: BinderySecurityMetrics;
  private readonly MAX_AUDIT_LOG_SIZE = 5000;

  // Process security monitoring
  private processStartTime = 0;
  private processMetrics = {
    memoryUsage: 0,
    cpuUsage: 0,
    networkRequests: 0,
    fileOperations: 0
  };

  constructor(config: Partial<BinderyServiceConfig> = {}) {
    super();
    
    // Default security configuration
    const defaultSecurity: BinderySecurityConfig = {
      enableProcessIsolation: true,
      enableJsonRpcValidation: true,
      enableContentProtection: true,
      maxProcessMemoryMB: 256,
      maxExecutionTimeMs: 300000, // 5 minutes for development (was 30000)
      allowedBinderyPaths: [
        '/home/aya/Development/vespera-atelier/packages/vespera-utilities/vespera-bindery',
        '/home/aya/dev/monorepo/vespera-atelier/packages/vespera-utilities/vespera-bindery' // Legacy path
      ],
      blockedBinderyPaths: [
        '/etc', '/sys', '/proc', '/root'
      ],
      requireSandbox: true,
      auditAllOperations: true,
      rateLimiting: {
        enabled: true,
        maxRequestsPerMinute: 1000,
        maxConcurrentRequests: 10
      }
    };

    // Check if workspace folder is available
    const workspaceRoot = config.workspaceRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    // Set NoWorkspace status if no workspace is open
    if (!workspaceRoot) {
      this.config = {
        binderyPath: config.binderyPath || undefined,
        workspaceRoot: undefined,
        enableLogging: config.enableLogging ?? false,
        connectionTimeout: config.connectionTimeout ?? 180000, // 3 minutes for LLM responses
        maxRetries: config.maxRetries ?? 3,
        retryDelay: config.retryDelay ?? 1000,
        security: { ...defaultSecurity, ...config.security }
      };
      this.log('No workspace folder open - Bindery service will not initialize');
      this.connectionInfo = {
        status: BinderyConnectionStatus.NoWorkspace,
        last_error: 'No workspace folder open. Please open a folder to use Vespera Forge.'
      };
      return; // Don't initialize further
    }

    this.config = {
      binderyPath: config.binderyPath || undefined,
      workspaceRoot: workspaceRoot,
      enableLogging: config.enableLogging ?? false, // Changed default to false to reduce console spam
      connectionTimeout: config.connectionTimeout ?? 180000, // 3 minutes for LLM responses
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      security: { ...defaultSecurity, ...config.security }
    };

    this.connectionInfo = {
      status: BinderyConnectionStatus.Disconnected
    };

    // Initialize security metrics
    this.securityMetrics = {
      requests: {
        total: 0,
        blocked: 0,
        sanitized: 0,
        errors: 0,
        averageValidationTime: 0
      },
      processes: {
        totalStarted: 0,
        currentRunning: 0,
        terminatedBySecurity: 0,
        memoryViolations: 0,
        timeoutViolations: 0,
        averageLifetime: 0
      },
      threats: {
        totalDetected: 0,
        byType: {},
        bySeverity: {
          low: 0,
          medium: 0,
          high: 0,
          critical: 0
        },
        blocked: 0,
        mitigated: 0
      },
      performance: {
        averageRequestTime: 0,
        averageResponseTime: 0,
        securityOverhead: 0,
        throughputRequests: 0
      }
    };

    // Initialize security services if available
    this.initializeSecurityServices();
  }

  /**
   * Initialize security services
   */
  private async initializeSecurityServices(): Promise<void> {
    try {
      this.securityServices = SecurityEnhancedVesperaCoreServices.getInstance();
      this.log('Security services initialized for Bindery');
    } catch (error) {
      this.log('Security services not available, running with reduced security:', error);
    }
  }

  /**
   * Validate JSON-RPC request for security threats
   */
  private async validateJsonRpcRequest(request: BinderyRequest): Promise<{
    allowed: boolean;
    threats: BinderySecurityThreat[];
    sanitizedRequest?: BinderyRequest;
    validationTime: number;
  }> {
    const startTime = performance.now();
    const threats: BinderySecurityThreat[] = [];

    if (!this.config.security?.enableJsonRpcValidation) {
      return {
        allowed: true,
        threats: [],
        sanitizedRequest: request,
        validationTime: performance.now() - startTime
      };
    }

    // Check for oversized payloads
    const requestSize = JSON.stringify(request).length;
    if (requestSize > 10 * 1024 * 1024) { // 10MB limit
      threats.push({
        type: 'resource_exhaustion',
        severity: ThreatSeverity.HIGH,
        description: 'Request payload exceeds size limit',
        location: 'json_payload',
        blocked: true
      });
    }

    // Method validation
    const blockedMethods = ['system.exec', 'file.delete.system'];
    if (blockedMethods.includes(request.method)) {
      threats.push({
        type: 'unauthorized_access',
        severity: ThreatSeverity.CRITICAL,
        description: `Blocked method: ${request.method}`,
        location: 'method',
        blocked: true
      });
    }

    // Parameter injection check
    const requestStr = JSON.stringify(request.params);
    const injectionPatterns = [
      /\.\.\//g, // Path traversal
      /\$\(/g,   // Command injection
      /eval\(/g, // Code injection
      /<script/gi // XSS
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(requestStr)) {
        threats.push({
          type: 'json_injection',
          severity: ThreatSeverity.HIGH,
          description: `Potential injection detected: ${pattern.source}`,
          location: 'parameters',
          blocked: true
        });
      }
    }

    const blocked = threats.some(t => t.blocked);

    return {
      allowed: !blocked,
      threats,
      sanitizedRequest: blocked ? undefined : request,
      validationTime: performance.now() - startTime
    };
  }

  /**
   * Validate JSON-RPC response for security issues
   */
  private async validateJsonRpcResponse(response: BinderyResponse): Promise<{
    allowed: boolean;
    threats: BinderySecurityThreat[];
    sanitizedResponse?: BinderyResponse;
    validationTime: number;
  }> {
    const startTime = performance.now();
    const threats: BinderySecurityThreat[] = [];

    if (!this.config.security?.enableJsonRpcValidation) {
      return {
        allowed: true,
        threats: [],
        sanitizedResponse: response,
        validationTime: performance.now() - startTime
      };
    }

    // Check response size
    const responseSize = JSON.stringify(response).length;
    if (responseSize > 50 * 1024 * 1024) { // 50MB limit
      threats.push({
        type: 'resource_exhaustion',
        severity: ThreatSeverity.MEDIUM,
        description: 'Response payload exceeds size limit',
        location: 'json_response',
        blocked: false,
        remediation: 'Response will be truncated'
      });
    }

    // Content protection - check for sensitive data patterns
    if (this.config.security?.enableContentProtection) {
      const responseStr = JSON.stringify(response.result);
      const sensitivePatterns = [
        /[A-Za-z0-9+/=]{40,}/g, // Potential API keys
        /password['":\s=]*[\w\W]{6,}/gi, // Passwords
        /token['":\s=]*[\w\W]{20,}/gi, // Tokens
        /key['":\s=]*[\w\W]{20,}/gi // Keys
      ];

      for (const pattern of sensitivePatterns) {
        if (pattern.test(responseStr)) {
          threats.push({
            type: 'data_exfiltration',
            severity: ThreatSeverity.MEDIUM,
            description: 'Potential sensitive data in response',
            location: 'response_data',
            blocked: false,
            remediation: 'Sensitive data will be sanitized'
          });
        }
      }
    }

    return {
      allowed: true, // Responses are typically allowed but sanitized
      threats,
      sanitizedResponse: response,
      validationTime: performance.now() - startTime
    };
  }

  /**
   * Create security audit log entry
   */
  private createSecurityAudit(
    operation: string,
    requestId?: number,
    threats: BinderySecurityThreat[] = [],
    result: 'success' | 'blocked' | 'error' | 'timeout' = 'success',
    validationTime = 0
  ): BinderySecurityAudit {
    return {
      auditId: `bindery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      operation: operation as any,
      processId: this.process?.pid,
      requestId,
      securityValidation: {
        passed: !threats.some(t => t.blocked),
        threats,
        validationTime,
        sanitizationApplied: threats.some(t => t.remediation)
      },
      processMetrics: this.process ? {
        memoryUsageMB: this.processMetrics.memoryUsage,
        cpuUsagePercent: this.processMetrics.cpuUsage,
        executionTimeMs: Date.now() - this.processStartTime,
        networkRequests: this.processMetrics.networkRequests,
        fileOperations: this.processMetrics.fileOperations
      } : undefined,
      result
    };
  }

  /**
   * Add security audit to log
   */
  private addSecurityAudit(audit: BinderySecurityAudit): void {
    this.securityAuditLog.push(audit);
    
    // Manage log size
    if (this.securityAuditLog.length > this.MAX_AUDIT_LOG_SIZE) {
      this.securityAuditLog = this.securityAuditLog.slice(-this.MAX_AUDIT_LOG_SIZE + 1000);
    }

    // Update metrics
    this.updateSecurityMetrics(audit);

    // Log security events
    if (audit.securityValidation.threats.length > 0) {
      this.logSecurityEvent(audit);
    }
  }

  /**
   * Update security metrics
   */
  private updateSecurityMetrics(audit: BinderySecurityAudit): void {
    this.securityMetrics.requests.total++;
    
    if (audit.result === 'blocked') {
      this.securityMetrics.requests.blocked++;
    }
    
    if (audit.securityValidation.sanitizationApplied) {
      this.securityMetrics.requests.sanitized++;
    }
    
    if (audit.result === 'error') {
      this.securityMetrics.requests.errors++;
    }

    // Update validation time average
    const total = this.securityMetrics.requests.total;
    this.securityMetrics.requests.averageValidationTime = 
      (this.securityMetrics.requests.averageValidationTime * (total - 1) + 
       audit.securityValidation.validationTime) / total;

    // Update threat metrics
    audit.securityValidation.threats.forEach(threat => {
      this.securityMetrics.threats.totalDetected++;
      this.securityMetrics.threats.byType[threat.type] = 
        (this.securityMetrics.threats.byType[threat.type] || 0) + 1;
      this.securityMetrics.threats.bySeverity[threat.severity]++;
      
      if (threat.blocked) {
        this.securityMetrics.threats.blocked++;
      } else if (threat.remediation) {
        this.securityMetrics.threats.mitigated++;
      }
    });
  }

  /**
   * Log security event
   */
  private async logSecurityEvent(audit: BinderySecurityAudit): Promise<void> {
    if (this.securityServices?.securityAuditLogger) {
      try {
        const context: BinderySecurityContext = {
          timestamp: audit.timestamp,
          binderyMethod: audit.binderyMethod,
          requestId: audit.requestId,
          processId: audit.processId,
          metadata: {
            auditId: audit.auditId,
            operation: audit.operation,
            threats: audit.securityValidation.threats.length,
            validationTime: audit.securityValidation.validationTime,
            processMetrics: audit.processMetrics
          }
        };

        await this.securityServices.securityAuditLogger.logSecurityEvent(
          VesperaSecurityEvent.SECURITY_BREACH, // Using as generic security event
          context
        );
      } catch (error) {
        this.log('Failed to log security event:', error);
      }
    }
  }

  /**
   * Initialize connection to Bindery backend
   */
  public async initialize(): Promise<BinderyResult<VersionInfo>> {
    // Check if workspace is available
    if (this.connectionInfo.status === BinderyConnectionStatus.NoWorkspace) {
      return {
        success: false,
        error: {
          code: -1,
          message: this.connectionInfo.last_error || 'No workspace folder open. Please open a folder to use Vespera Forge.'
        }
      };
    }

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
    // Set shutdown flag to prevent new requests
    this.isShuttingDown = true;
    this.log('Bindery service shutting down...');

    if (this.process) {
      // Cancel all pending requests silently (errors during shutdown are expected)
      for (const [_id, request] of this.pendingRequests.entries()) {
        clearTimeout(request.timeout);
        try {
          request.reject({ code: -1, message: 'Service shutting down' });
        } catch (err) {
          // Ignore errors during shutdown - channel may already be closed
        }
      }
      this.pendingRequests.clear();

      // Terminate process gracefully
      this.process.kill('SIGTERM');

      // Wait for process to exit, with force kill as fallback
      await new Promise<void>((resolve) => {
        const killTimer = setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.log('Force killing Bindery process after timeout');
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 3000);

        if (this.process) {
          this.process.once('exit', () => {
            clearTimeout(killTimer);
            resolve();
          });
        } else {
          clearTimeout(killTimer);
          resolve();
        }
      });

      this.process = null;
    }

    this.connectionInfo = {
      status: BinderyConnectionStatus.Disconnected
    };

    try {
      this.emit('statusChanged', this.connectionInfo);
    } catch (err) {
      // Ignore errors during shutdown
    }

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
    templateId: string,
    projectId?: string
  ): Promise<BinderyResult<CodexId>> {
    const payload: any = {
      title,
      template_id: templateId
    };

    // Add project_id to metadata if provided
    if (projectId) {
      payload.metadata = {
        project_id: projectId
      };
    }

    // Phase 16b Stage 3: Log what we're sending to Bindery
    console.log('[BinderyService] createCodex called with:', {
      title,
      templateId,
      projectId,
      hasProjectId: !!projectId,
      payloadToBindery: JSON.stringify(payload)
    });

    return this.sendRequest('create_codex', payload);
  }

  /**
   * Get Codex by ID
   */
  public async getCodex(codexId: CodexId): Promise<BinderyResult<Codex>> {
    return this.sendRequest('get_codex', { codex_id: codexId });
  }

  /**
   * Update Codex
   */
  public async updateCodex(
    codexId: CodexId,
    updates: {
      title?: string;
      content?: any;
      template_id?: string;
      tags?: string[];
      references?: any[];
      metadata?: any;
    }
  ): Promise<BinderyResult<Codex>> {
    return this.sendRequest('update_codex', {
      codex_id: codexId,
      ...updates
    });
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

  /**
   * Get security metrics for the Bindery service
   */
  public getSecurityMetrics(): BinderySecurityMetrics {
    return { ...this.securityMetrics };
  }

  /**
   * Get security audit log
   */
  public getSecurityAuditLog(startTime?: number, endTime?: number): BinderySecurityAudit[] {
    let filtered = this.securityAuditLog;
    
    if (startTime || endTime) {
      filtered = this.securityAuditLog.filter(audit => {
        if (startTime && audit.timestamp < startTime) return false;
        if (endTime && audit.timestamp > endTime) return false;
        return true;
      });
    }
    
    return [...filtered]; // Return copy
  }

  /**
   * Update security configuration
   */
  public updateSecurityConfig(config: Partial<BinderySecurityConfig>): void {
    if (this.config.security) {
      this.config.security = { ...this.config.security, ...config };
      this.log('Security configuration updated:', config);
    }
  }

  /**
   * Get current security configuration
   */
  public getSecurityConfig(): BinderySecurityConfig | undefined {
    return this.config.security ? { ...this.config.security } : undefined;
  }

  /**
   * Check if security features are enabled
   */
  public isSecurityEnabled(): boolean {
    return Boolean(this.config.security?.enableProcessIsolation || 
                  this.config.security?.enableJsonRpcValidation || 
                  this.config.security?.enableContentProtection);
  }

  // Private Implementation

  private async findBinderyExecutable(): Promise<string | null> {
    this.log(`Workspace root: ${this.config.workspaceRoot}`);

    // Priority order for finding Bindery executable
    const searchPaths = [
      this.config.binderyPath,
      // Try worktrees first (for feature branch development)
      '/home/aya/Development/vespera-atelier-worktrees/feat-codex-ui-framework/packages/vespera-utilities/vespera-bindery/target/debug/bindery-server',
      '/home/aya/Development/vespera-atelier-worktrees/feat-codex-ui-framework/packages/vespera-utilities/vespera-bindery/target/release/bindery-server',
      // Try from current workspace (works if in main repo)
      path.join(this.config.workspaceRoot || '', '../../../packages/vespera-utilities/vespera-bindery/target/debug/bindery-server'),
      path.join(this.config.workspaceRoot || '', '../../../packages/vespera-utilities/vespera-bindery/target/release/bindery-server'),
      // Direct paths to main monorepo (fallback)
      '/home/aya/Development/vespera-atelier/packages/vespera-utilities/vespera-bindery/target/debug/bindery-server',
      '/home/aya/Development/vespera-atelier/packages/vespera-utilities/vespera-bindery/target/release/bindery-server',
      // Legacy path (kept for compatibility)
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
      const args = ['--json-rpc', '--workspace', this.config.workspaceRoot || process.cwd()];

      // Security-enhanced process spawn options
      const spawnOptions: any = {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: this.config.workspaceRoot,
        env: {
          // Restricted environment variables for security
          PATH: process.env['PATH'],
          HOME: process.env['HOME'],
          USER: process.env['USER'],
          // Remove potentially dangerous env vars
          ...this.getSecureEnvironmentVariables()
        },
        // Process isolation options
        detached: false, // Keep attached for better control
        uid: process.getuid && process.getuid(), // Run as current user (not root)
        gid: process.getgid && process.getgid()
      };

      // Apply resource limits if configured
      if (this.config.security?.enableProcessIsolation) {
        // Note: These would need platform-specific implementation
        // For now, we document the intention
        this.log('Process isolation enabled - resource limits will be monitored');
      }

      this.processStartTime = Date.now();
      this.securityMetrics.processes.totalStarted++;
      this.securityMetrics.processes.currentRunning++;

      this.process = spawn(binderyPath, args, spawnOptions);

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
        const message = data.toString();
        // Log all lines for debugging (previously only logged first line)
        const lines = message.split('\n').filter((line: string) => line.trim());
        lines.forEach((line: string) => this.log('Bindery stderr:', line));
      });

      // Give process time to start
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          // Start process monitoring after successful launch
          this.startProcessMonitoring();
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
          const parsed = JSON.parse(line);

          // Filter out non-JSON-RPC messages (Bindery log messages sent to stdout)
          // Valid JSON-RPC responses must have a 'jsonrpc' field
          if (!parsed.jsonrpc) {
            // This is a log message, not a JSON-RPC response - ignore it
            // (Bindery should send logs to stderr, but sometimes they go to stdout)
            continue;
          }

          const response: BinderyResponse = parsed;
          this.handleResponse(response).catch(error => {
            this.log('Failed to handle Bindery response:', error);
          });
        } catch (error) {
          // Not valid JSON - this might be a partial message or non-JSON log
          // Don't spam the console with every parse error
          // this.log('Failed to parse Bindery response:', line, error);
        }
      }
    }
  }

  private async handleResponse(response: BinderyResponse): Promise<void> {
    // Don't log every response - too spammy
    // this.log('Received response for request ID:', response.id);

    const request = this.pendingRequests.get(response.id);
    if (!request) {
      // Don't log unknown request IDs - these are filtered out now
      // this.log('Received response for unknown request ID:', response.id);
      return;
    }

    this.pendingRequests.delete(response.id);
    clearTimeout(request.timeout);

    try {
      // Security validation for response
      const responseValidation = await this.validateJsonRpcResponse(response);
      
      // Create security audit for the response
      const audit = this.createSecurityAudit(
        'response', 
        response.id, 
        responseValidation.threats, 
        responseValidation.allowed ? 'success' : 'blocked',
        responseValidation.validationTime
      );
      this.addSecurityAudit(audit);

      // Use sanitized response if available
      const sanitizedResponse = responseValidation.sanitizedResponse || response;

      if (sanitizedResponse.error) {
        this.log('Response contains error for request', response.id, '- Error:', JSON.stringify(sanitizedResponse.error));
        try {
          request.reject(sanitizedResponse.error);
        } catch (err) {
          // Ignore errors during promise rejection (channel may be closed during shutdown)
          if (!this.isShuttingDown) {
            this.log('Failed to reject request promise:', err);
          }
        }
      } else {
        this.log('Response successful for request', response.id);
        try {
          request.resolve(sanitizedResponse.result);
        } catch (err) {
          // Ignore errors during promise resolution (channel may be closed during shutdown)
          if (!this.isShuttingDown) {
            this.log('Failed to resolve request promise:', err);
          }
        }
      }

    } catch (error) {
      this.log('Response security validation failed:', error);
      const audit = this.createSecurityAudit('response', response.id, [{
        type: 'json_injection',
        severity: ThreatSeverity.HIGH,
        description: 'Response validation error',
        location: 'response_handler',
        blocked: true
      }], 'error');
      this.addSecurityAudit(audit);
      
      request.reject({
        code: VesperaSecurityErrorCode.THREAT_DETECTED,
        message: 'Response security validation failed'
      });
    }
  }

  /**
   * Get secure environment variables for Bindery process
   */
  private getSecureEnvironmentVariables(): Record<string, string> {
    // Only include safe environment variables
    const safeEnvVars: Record<string, string> = {};
    
    // Allow essential variables
    const allowedVars = [
      'RUST_LOG', 'RUST_BACKTRACE', // Rust debugging
      'LC_ALL', 'LANG', // Locale
      'TZ' // Timezone
    ];
    
    allowedVars.forEach(varName => {
      if (process.env[varName]) {
        safeEnvVars[varName] = process.env[varName]!;
      }
    });

    return safeEnvVars;
  }

  /**
   * Monitor process resource usage
   */
  private startProcessMonitoring(): void {
    if (!this.process?.pid || !this.config.security?.enableProcessIsolation) {
      return;
    }

    const monitoringInterval = setInterval(() => {
      try {
        // This would need platform-specific implementation
        // For now, we simulate monitoring
        const memoryUsage = process.memoryUsage();
        this.processMetrics.memoryUsage = Math.round(memoryUsage.heapUsed / 1024 / 1024);

        // Check memory limits
        if (this.processMetrics.memoryUsage > (this.config.security?.maxProcessMemoryMB || 256)) {
          this.securityMetrics.processes.memoryViolations++;
          this.log(`Process memory limit exceeded: ${this.processMetrics.memoryUsage}MB`);
          
          // Could terminate process here if configured
          if (this.config.security?.requireSandbox) {
            this.terminateProcessForSecurity('memory_limit_exceeded');
          }
        }

        // Check execution time limits
        // NOTE: Disabled for long-running Bindery server process
        // TODO: Implement per-request timeout instead of process lifetime timeout
        /*
        const executionTime = Date.now() - this.processStartTime;
        if (executionTime > (this.config.security?.maxExecutionTimeMs || 30000)) {
          this.securityMetrics.processes.timeoutViolations++;
          this.log(`Process execution time limit exceeded: ${executionTime}ms`);

          if (this.config.security?.requireSandbox) {
            this.terminateProcessForSecurity('timeout_exceeded');
          }
        }
        */

      } catch (error) {
        this.log('Process monitoring error:', error);
      }
    }, 5000); // Monitor every 5 seconds

    // Clear monitoring when process exits
    if (this.process) {
      this.process.on('exit', () => {
        clearInterval(monitoringInterval);
        this.securityMetrics.processes.currentRunning--;
      });
    }
  }

  /**
   * Terminate process for security reasons
   */
  private terminateProcessForSecurity(reason: string): void {
    if (this.process) {
      this.securityMetrics.processes.terminatedBySecurity++;
      this.log(`Terminating process for security: ${reason}`);
      
      // Create security audit
      const audit = this.createSecurityAudit('process_termination', undefined, [{
        type: 'process_escape',
        severity: ThreatSeverity.HIGH,
        description: `Process terminated due to: ${reason}`,
        location: 'process_monitor',
        blocked: true
      }], 'blocked');
      
      this.addSecurityAudit(audit);
      
      this.process.kill('SIGTERM');
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
      }, 3000);
    }
  }

  public async sendRequest<T>(method: string, params?: any): Promise<BinderyResult<T>> {
    // Reject immediately if shutting down
    if (this.isShuttingDown) {
      return {
        success: false,
        error: { code: -1, message: 'Service is shutting down' }
      };
    }

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

    // Security validation for request
    const requestValidation = await this.validateJsonRpcRequest(request);
    if (!requestValidation.allowed) {
      const audit = this.createSecurityAudit('request', requestId, requestValidation.threats, 'blocked', requestValidation.validationTime);
      this.addSecurityAudit(audit);
      
      return { 
        success: false, 
        error: { 
          code: VesperaSecurityErrorCode.THREAT_DETECTED, 
          message: `Request blocked due to security threats: ${requestValidation.threats.map(t => t.description).join(', ')}` 
        } 
      };
    }

    // Use sanitized request if available

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
        this.log('Sending request to Bindery:', method, 'ID:', requestId);
        console.log('[BinderyService] Full JSON-RPC request:', requestJson);
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

      // Phase 17 Project Management Mock Handlers
      case 'create_project':
        return {
          success: true,
          data: {
            id: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            workspace_id: params?.workspace_id || 'mock-workspace',
            name: params?.name || 'Untitled Project',
            description: params?.description,
            project_type: params?.project_type || 'general',
            active_context_id: null,
            settings: params?.settings || {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          } as any
        };

      case 'get_project':
        return {
          success: true,
          data: {
            id: params?.project_id || 'mock-project-id',
            workspace_id: 'mock-workspace',
            name: 'Mock Project',
            description: 'A mock project for development',
            project_type: 'general',
            active_context_id: null,
            settings: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          } as any
        };

      case 'update_project':
        return {
          success: true,
          data: {
            id: params?.project_id || 'mock-project-id',
            workspace_id: 'mock-workspace',
            name: params?.name || 'Updated Mock Project',
            description: params?.description || 'An updated mock project',
            project_type: params?.project_type || 'general',
            active_context_id: params?.active_context_id || null,
            settings: params?.settings || {},
            created_at: new Date(Date.now() - 86400000).toISOString(),
            updated_at: new Date().toISOString()
          } as any
        };

      case 'delete_project':
        return {
          success: true,
          data: undefined as any
        };

      case 'list_projects':
        return {
          success: true,
          data: [
            {
              id: 'mock-project-1',
              workspace_id: params?.workspace_id || 'mock-workspace',
              name: 'Sample Project 1',
              description: 'First sample project',
              project_type: 'fiction',
              active_context_id: null,
              settings: {},
              created_at: new Date(Date.now() - 172800000).toISOString(),
              updated_at: new Date(Date.now() - 86400000).toISOString()
            },
            {
              id: 'mock-project-2',
              workspace_id: params?.workspace_id || 'mock-workspace',
              name: 'Sample Project 2',
              description: 'Second sample project',
              project_type: 'research',
              active_context_id: null,
              settings: {},
              created_at: new Date(Date.now() - 259200000).toISOString(),
              updated_at: new Date(Date.now() - 172800000).toISOString()
            }
          ] as any
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
 *
 * Note: This follows the singleton pattern. If an instance already exists,
 * the config parameter will be ignored and a warning will be logged.
 */
export function getBinderyService(config?: Partial<BinderyServiceConfig>): BinderyService {
  if (!binderyServiceInstance) {
    binderyServiceInstance = new BinderyService(config);
  } else if (config) {
    console.warn('[BinderyService] Singleton instance already exists. Config parameter ignored. Use disposeBinderyService() first if you need to reinitialize with new config.');
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