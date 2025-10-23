/**
 * File Operations Security Layer
 * 
 * High-performance security validation and monitoring for all file operations
 * with enterprise-grade audit logging and threat detection.
 */

import * as path from 'path';
import { SecurityEnhancedVesperaCoreServices } from '../core/security/SecurityEnhancedCoreServices';
import { RustFileOpsSecurityWrapper, FileOperationContext, SecurityValidationResult } from '../rust-file-ops/security-wrapper';
import { 
  VesperaSecurityEvent, 
  SecurityEventContext,
  VesperaSecurityErrorCode
} from '../types/security';
import { VesperaSecurityError } from '../core/security/VesperaSecurityErrors';

export interface FileSecurityPolicy {
  allowedDirectories: string[];
  blockedDirectories: string[];
  allowedExtensions: string[];
  blockedExtensions: string[];
  maxFileSize: number;
  requireContentScan: boolean;
  enableRealTimeMonitoring: boolean;
}

export interface FileOperationAudit {
  operationId: string;
  timestamp: number;
  operation: string;
  path: string;
  userId?: string;
  sessionId?: string;
  result: 'allowed' | 'blocked' | 'error';
  threats?: string[];
  validationTime: number;
  metadata?: Record<string, any>;
}

/**
 * Comprehensive file operations security manager
 */
export class FileOperationsSecurityManager {
  private static instance: FileOperationsSecurityManager | null = null;
  private securityWrapper: RustFileOpsSecurityWrapper | null = null;
  private securityServices: SecurityEnhancedVesperaCoreServices | null = null;
  private policy: FileSecurityPolicy;
  private auditLog: FileOperationAudit[] = [];
  private readonly MAX_AUDIT_LOG_SIZE = 10000;

  // Performance metrics
  private metrics = {
    totalOperations: 0,
    blockedOperations: 0,
    averageValidationTime: 0,
    threatDetections: 0,
    lastReset: Date.now()
  };

  private constructor(policy: FileSecurityPolicy) {
    this.policy = policy;
  }

  /**
   * Initialize file operations security manager
   */
  public static async initialize(policy?: Partial<FileSecurityPolicy>): Promise<FileOperationsSecurityManager> {
    if (FileOperationsSecurityManager.instance) {
      return FileOperationsSecurityManager.instance;
    }

    const defaultPolicy: FileSecurityPolicy = {
      allowedDirectories: [
        '/home/aya/dev/monorepo/vespera-atelier',
        '/tmp/vespera-temp',
        '/var/tmp/vespera'
      ],
      blockedDirectories: [
        '/etc',
        '/sys',
        '/proc',
        '/root',
        '/home/*/.*' // Hidden directories
      ],
      allowedExtensions: ['.ts', '.js', '.json', '.md', '.txt', '.yaml', '.yml', '.toml', '.rs', '.py'],
      blockedExtensions: ['.exe', '.dll', '.so', '.dylib', '.sh', '.bat', '.cmd'],
      maxFileSize: 50 * 1024 * 1024, // 50MB
      requireContentScan: true,
      enableRealTimeMonitoring: true
    };

    const finalPolicy = { ...defaultPolicy, ...policy };
    const manager = new FileOperationsSecurityManager(finalPolicy);

    try {
      // Initialize security wrapper
      manager.securityWrapper = await RustFileOpsSecurityWrapper.initialize();
      
      // Get security services
      manager.securityServices = SecurityEnhancedVesperaCoreServices.getInstance();
      
      // console.log('FileOperationsSecurityManager initialized with policy:', JSON.stringify(finalPolicy));
    } catch (error) {
      console.warn('FileOperationsSecurityManager initialized with reduced security:', error);
    }

    FileOperationsSecurityManager.instance = manager;
    return manager;
  }

  /**
   * Validate file operation with comprehensive security checks
   */
  public async validateFileOperation(
    operation: 'read' | 'write' | 'append' | 'delete' | 'list' | 'stat',
    filePath: string,
    content?: string,
    context?: { userId?: string; sessionId?: string; metadata?: Record<string, any> }
  ): Promise<SecurityValidationResult & { audit: FileOperationAudit }> {
    const startTime = performance.now();
    const operationId = this.generateOperationId();
    
    try {
      // Increment metrics
      this.metrics.totalOperations++;

      // Build operation context
      const operationContext: FileOperationContext = {
        operation,
        path: filePath,
        content,
        userId: context?.userId,
        sessionId: context?.sessionId,
        metadata: context?.metadata
      };

      // Policy-based validation
      const policyValidation = this.validateAgainstPolicy(operation, filePath, content);
      if (!policyValidation.allowed) {
        const audit = this.createAudit(operationId, operation, filePath, 'blocked', 
          policyValidation.threats, performance.now() - startTime, context);
        
        this.metrics.blockedOperations++;
        this.addToAuditLog(audit);
        
        const validationResult: SecurityValidationResult & { audit: FileOperationAudit } = {
          allowed: policyValidation.allowed,
          sanitizedPath: policyValidation.sanitizedPath,
          threats: policyValidation.threats.map(threat => ({
            type: 'policy-violation',
            severity: 'HIGH' as any, // ThreatSeverity.HIGH
            blocked: true,
            location: threat
          })),
          validationTime: performance.now() - startTime,
          audit
        };
        return validationResult;
      }

      // Security wrapper validation
      let wrapperValidation: SecurityValidationResult;
      if (this.securityWrapper) {
        wrapperValidation = await this.securityWrapper.validateFileOperation(operationContext);
      } else {
        // Fallback validation
        wrapperValidation = {
          allowed: true,
          sanitizedPath: filePath,
          sanitizedContent: content,
          threats: [],
          validationTime: 0
        };
      }

      const totalValidationTime = performance.now() - startTime;
      
      // Update metrics
      this.updateValidationMetrics(totalValidationTime, wrapperValidation.threats.length);

      // Create audit record
      const result = wrapperValidation.allowed ? 'allowed' : 'blocked';
      const threats = [...policyValidation.threats, ...wrapperValidation.threats.map(t => t.type)];
      const audit = this.createAudit(operationId, operation, filePath, result, threats, 
        totalValidationTime, context);

      if (!wrapperValidation.allowed) {
        this.metrics.blockedOperations++;
      }

      this.addToAuditLog(audit);

      // Log security events for blocked operations
      if (!wrapperValidation.allowed && this.policy.enableRealTimeMonitoring) {
        await this.logSecurityEvent(VesperaSecurityEvent.THREAT_DETECTED, {
          timestamp: Date.now(),
          metadata: {
            operationId,
            operation,
            path: filePath,
            threats,
            validationTime: totalValidationTime
          }
        });
      }

      return {
        ...wrapperValidation,
        audit
      };

    } catch (error) {
      const validationTime = performance.now() - startTime;
      const audit = this.createAudit(operationId, operation, filePath, 'error', 
        ['validation_error'], validationTime, context);
      
      this.metrics.blockedOperations++;
      this.addToAuditLog(audit);

      await this.logSecurityEvent(VesperaSecurityEvent.SECURITY_BREACH, {
        timestamp: Date.now(),
        metadata: {
          operationId,
          operation,
          path: filePath,
          error: error instanceof Error ? error.message : String(error)
        }
      });

      throw new VesperaSecurityError(
        `File operation validation failed: ${error instanceof Error ? error.message : String(error)}`,
        VesperaSecurityErrorCode.THREAT_DETECTED,
        undefined,
        { operationId, operation, path: filePath }
      );
    }
  }

  /**
   * Batch validate file operations for high throughput
   */
  public async validateBatchFileOperations(
    operations: Array<{
      operation: 'read' | 'write' | 'append' | 'delete' | 'list' | 'stat';
      path: string;
      content?: string;
      context?: { userId?: string; sessionId?: string; metadata?: Record<string, any> };
    }>
  ): Promise<Array<SecurityValidationResult & { audit: FileOperationAudit }>> {
    const batchStartTime = performance.now();
    
    // Process in parallel for optimal performance
    const results = await Promise.all(
      operations.map(op => 
        this.validateFileOperation(op.operation, op.path, op.content, op.context)
      )
    );

    const batchTime = performance.now() - batchStartTime;

    // Log batch metrics
    await this.logSecurityEvent(VesperaSecurityEvent.SECURITY_BREACH, {
      timestamp: Date.now(),
      metadata: {
        action: 'batch_file_validation',
        batchSize: operations.length,
        batchTime,
        averageTimePerOperation: batchTime / operations.length,
        blockedOperations: results.filter(r => !r.allowed).length
      }
    });

    return results;
  }

  /**
   * Policy-based validation (fast path)
   */
  private validateAgainstPolicy(
    _operation: string, 
    filePath: string, 
    content?: string
  ): { allowed: boolean; threats: string[]; sanitizedPath?: string } {
    const threats: string[] = [];
    
    // Directory validation
    const isInAllowedDir = this.policy.allowedDirectories.some(dir => 
      filePath.startsWith(path.resolve(dir))
    );
    
    const isInBlockedDir = this.policy.blockedDirectories.some(dir => {
      const pattern = new RegExp(dir.replace(/\*/g, '.*'));
      return pattern.test(filePath);
    });

    if (isInBlockedDir) {
      threats.push('blocked_directory');
    }

    if (!isInAllowedDir && !isInBlockedDir) {
      threats.push('unauthorized_directory');
    }

    // Extension validation
    const ext = path.extname(filePath).toLowerCase();
    if (this.policy.blockedExtensions.includes(ext)) {
      threats.push('blocked_extension');
    }

    if (this.policy.allowedExtensions.length > 0 && !this.policy.allowedExtensions.includes(ext)) {
      threats.push('unauthorized_extension');
    }

    // Content size validation
    if (content && content.length > this.policy.maxFileSize) {
      threats.push('file_too_large');
    }

    return {
      allowed: threats.length === 0,
      threats,
      sanitizedPath: path.normalize(filePath)
    };
  }

  /**
   * Create audit record
   */
  private createAudit(
    operationId: string,
    operation: string,
    path: string,
    result: 'allowed' | 'blocked' | 'error',
    threats: string[],
    validationTime: number,
    context?: { userId?: string; sessionId?: string; metadata?: Record<string, any> }
  ): FileOperationAudit {
    return {
      operationId,
      timestamp: Date.now(),
      operation,
      path,
      userId: context?.userId,
      sessionId: context?.sessionId,
      result,
      threats: threats.length > 0 ? threats : undefined,
      validationTime,
      metadata: context?.metadata
    };
  }

  /**
   * Add to audit log with size management
   */
  private addToAuditLog(audit: FileOperationAudit): void {
    this.auditLog.push(audit);
    
    // Manage audit log size
    if (this.auditLog.length > this.MAX_AUDIT_LOG_SIZE) {
      this.auditLog = this.auditLog.slice(-this.MAX_AUDIT_LOG_SIZE + 1000); // Keep recent 9000
    }
  }

  /**
   * Update performance metrics
   */
  private updateValidationMetrics(validationTime: number, threatCount: number): void {
    // Running average calculation
    const totalOps = this.metrics.totalOperations;
    this.metrics.averageValidationTime = 
      (this.metrics.averageValidationTime * (totalOps - 1) + validationTime) / totalOps;
    
    this.metrics.threatDetections += threatCount;
  }

  /**
   * Log security event
   */
  private async logSecurityEvent(event: VesperaSecurityEvent, context: SecurityEventContext): Promise<void> {
    if (this.securityServices?.securityAuditLogger) {
      try {
        await this.securityServices.securityAuditLogger.logSecurityEvent(event, context);
      } catch (error) {
        console.warn('Failed to log security event:', error);
      }
    }
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `fileop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get security metrics
   */
  public getSecurityMetrics(): {
    totalOperations: number;
    blockedOperations: number;
    blockRate: number;
    averageValidationTime: number;
    threatDetections: number;
    auditLogSize: number;
    uptime: number;
  } {
    return {
      ...this.metrics,
      blockRate: this.metrics.totalOperations > 0 ? 
        (this.metrics.blockedOperations / this.metrics.totalOperations) * 100 : 0,
      auditLogSize: this.auditLog.length,
      uptime: Date.now() - this.metrics.lastReset
    };
  }

  /**
   * Export audit log
   */
  public exportAuditLog(startTime?: number, endTime?: number): FileOperationAudit[] {
    let filtered = this.auditLog;
    
    if (startTime || endTime) {
      filtered = this.auditLog.filter(audit => {
        if (startTime && audit.timestamp < startTime) return false;
        if (endTime && audit.timestamp > endTime) return false;
        return true;
      });
    }
    
    return [...filtered]; // Return copy
  }

  /**
   * Update security policy
   */
  public updatePolicy(policy: Partial<FileSecurityPolicy>): void {
    this.policy = { ...this.policy, ...policy };
    
    this.logSecurityEvent(VesperaSecurityEvent.SECURITY_BREACH, {
      timestamp: Date.now(),
      metadata: {
        action: 'security_policy_updated',
        newPolicy: policy
      }
    });
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      totalOperations: 0,
      blockedOperations: 0,
      averageValidationTime: 0,
      threatDetections: 0,
      lastReset: Date.now()
    };
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    if (this.securityWrapper) {
      this.securityWrapper.dispose();
    }
    
    this.auditLog.length = 0;
    FileOperationsSecurityManager.instance = null;
  }
}

/**
 * Factory function for easy access
 */
export async function createFileOperationsSecurityManager(
  policy?: Partial<FileSecurityPolicy>
): Promise<FileOperationsSecurityManager> {
  return FileOperationsSecurityManager.initialize(policy);
}