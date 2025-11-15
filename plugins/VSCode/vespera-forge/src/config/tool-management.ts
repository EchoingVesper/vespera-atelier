/**
 * Secure Tool Management Configuration
 * 
 * Manages Claude Code tool overrides with enterprise-grade security validation
 * and performance monitoring. Enables secure replacement of default tools with
 * high-performance rust-file-ops while maintaining security compliance.
 */

import { SecurityEnhancedVesperaCoreServices } from '../core/security/SecurityEnhancedCoreServices';
import { FileOperationsSecurityManager } from '../security/file-operations-security';
import { 
  VesperaSecurityEvent, 
  SecurityEventContext,
  VesperaSecurityErrorCode 
} from '../types/security';
import { VesperaSecurityError } from '../core/security/VesperaSecurityErrors';

export interface ToolOverrideConfig {
  toolName: string;
  enabled: boolean;
  securityLevel: 'strict' | 'standard' | 'permissive';
  performanceMode: 'optimal' | 'balanced' | 'secure';
  auditLevel: 'minimal' | 'standard' | 'comprehensive';
  rollbackOnFailure: boolean;
  validationTimeout: number; // ms
  metadata?: Record<string, any>;
}

export interface ToolManagementPolicy {
  allowedTools: string[];
  blockedTools: string[];
  requireSecurityValidation: boolean;
  requirePerformanceValidation: boolean;
  enableRollback: boolean;
  maxOverrides: number;
  auditAllChanges: boolean;
}

export interface ToolOverrideResult {
  success: boolean;
  toolName: string;
  previousState?: ToolOverrideConfig;
  validationTime: number;
  securityViolations: string[];
  performanceImpact?: {
    baselineLatency: number;
    newLatency: number;
    improvement: number; // percentage
  };
  rollbackAvailable: boolean;
}

/**
 * Secure tool management for Claude Code SDK integration
 */
export class SecureToolManager {
  private static instance: SecureToolManager | null = null;
  private securityServices: SecurityEnhancedVesperaCoreServices | null = null;
  private fileSecurityManager: FileOperationsSecurityManager | null = null;
  
  private activeOverrides = new Map<string, ToolOverrideConfig>();
  private rollbackConfigs = new Map<string, ToolOverrideConfig>();
  private policy: ToolManagementPolicy;
  
  // Performance tracking
  private performanceBaselines = new Map<string, number>();
  private overrideMetrics = {
    totalOverrides: 0,
    successfulOverrides: 0,
    rollbacks: 0,
    securityViolations: 0,
    averageValidationTime: 0
  };

  private constructor(policy: ToolManagementPolicy) {
    this.policy = policy;
  }

  /**
   * Initialize secure tool manager
   */
  public static async initialize(policy?: Partial<ToolManagementPolicy>): Promise<SecureToolManager> {
    if (SecureToolManager.instance) {
      return SecureToolManager.instance;
    }

    const defaultPolicy: ToolManagementPolicy = {
      allowedTools: [
        'Read', 'Write', 'Edit', 'MultiEdit', 'Glob', 'Grep',
        'mcp__vespera-scriptorium__mcp_read_file',
        'mcp__vespera-scriptorium__mcp_write_file',
        'mcp__vespera-scriptorium__mcp_list_files'
      ],
      blockedTools: [
        'Bash', // Security risk - block system commands
        'WebFetch' // Block web access for security
      ],
      requireSecurityValidation: true,
      requirePerformanceValidation: true,
      enableRollback: true,
      maxOverrides: 50,
      auditAllChanges: true
    };

    const finalPolicy = { ...defaultPolicy, ...policy };
    const manager = new SecureToolManager(finalPolicy);

    try {
      // Initialize security services
      manager.securityServices = SecurityEnhancedVesperaCoreServices.getInstance();
      manager.fileSecurityManager = await FileOperationsSecurityManager.initialize();
      
      // console.log('SecureToolManager initialized with policy:', JSON.stringify(finalPolicy));
    } catch (error) {
      console.warn('SecureToolManager initialized with reduced security:', error);
    }

    SecureToolManager.instance = manager;
    return manager;
  }

  /**
   * Override Claude Code tool with security validation
   */
  public async overrideTool(
    toolName: string, 
    config: Omit<ToolOverrideConfig, 'toolName'>
  ): Promise<ToolOverrideResult> {
    const startTime = performance.now();
    const fullConfig: ToolOverrideConfig = { ...config, toolName };

    try {
      // Security validation
      const securityValidation = await this.validateToolOverride(toolName, fullConfig);
      if (securityValidation.violations.length > 0) {
        this.overrideMetrics.securityViolations++;
        await this.logSecurityEvent(VesperaSecurityEvent.THREAT_DETECTED, {
          timestamp: Date.now(),
          metadata: {
            action: 'tool_override_blocked',
            toolName,
            violations: securityValidation.violations,
            config: fullConfig
          }
        });

        return {
          success: false,
          toolName,
          validationTime: performance.now() - startTime,
          securityViolations: securityValidation.violations,
          rollbackAvailable: false
        };
      }

      // Performance baseline measurement
      const baseline = await this.measureToolPerformance(toolName);
      this.performanceBaselines.set(toolName, baseline);

      // Store rollback configuration
      const existingConfig = this.activeOverrides.get(toolName);
      if (existingConfig && this.policy.enableRollback) {
        this.rollbackConfigs.set(toolName, existingConfig);
      }

      // Apply override
      const overrideResult = await this.applyToolOverride(toolName, fullConfig);
      
      if (overrideResult.success) {
        // Store active override
        this.activeOverrides.set(toolName, fullConfig);
        
        // Performance validation
        let performanceImpact;
        if (this.policy.requirePerformanceValidation) {
          performanceImpact = await this.validateToolPerformance(toolName, baseline);
          
          // Rollback if performance degrades significantly (>50% slower)
          if (performanceImpact.improvement < -50 && fullConfig.rollbackOnFailure) {
            await this.rollbackTool(toolName);
            this.overrideMetrics.rollbacks++;
            
            return {
              success: false,
              toolName,
              validationTime: performance.now() - startTime,
              securityViolations: [],
              performanceImpact,
              rollbackAvailable: false
            };
          }
        }

        // Update metrics
        this.overrideMetrics.totalOverrides++;
        this.overrideMetrics.successfulOverrides++;
        this.updateValidationMetrics(performance.now() - startTime);

        // Audit logging
        if (this.policy.auditAllChanges) {
          await this.logSecurityEvent(VesperaSecurityEvent.SECURITY_BREACH, {
            timestamp: Date.now(),
            metadata: {
              action: 'tool_override_successful',
              toolName,
              config: fullConfig,
              performanceImpact,
              validationTime: performance.now() - startTime
            }
          });
        }

        return {
          success: true,
          toolName,
          previousState: existingConfig,
          validationTime: performance.now() - startTime,
          securityViolations: [],
          performanceImpact,
          rollbackAvailable: this.rollbackConfigs.has(toolName)
        };
      } else {
        return {
          success: false,
          toolName,
          validationTime: performance.now() - startTime,
          securityViolations: ['override_application_failed'],
          rollbackAvailable: this.rollbackConfigs.has(toolName)
        };
      }

    } catch (error) {
      await this.logSecurityEvent(VesperaSecurityEvent.SECURITY_BREACH, {
        timestamp: Date.now(),
        metadata: {
          action: 'tool_override_error',
          toolName,
          error: error instanceof Error ? error.message : String(error)
        }
      });

      throw new VesperaSecurityError(
        `Tool override failed for ${toolName}: ${error instanceof Error ? error.message : String(error)}`,
        VesperaSecurityErrorCode.UNAUTHORIZED_ACCESS,
        undefined,
        { toolName, config: fullConfig }
      );
    }
  }

  /**
   * Disable Claude Code default tool securely
   */
  public async disableDefaultTool(toolName: string): Promise<ToolOverrideResult> {
    return this.overrideTool(toolName, {
      enabled: false,
      securityLevel: 'strict',
      performanceMode: 'secure',
      auditLevel: 'comprehensive',
      rollbackOnFailure: true,
      validationTimeout: 5000,
      metadata: {
        action: 'disable_default_tool',
        reason: 'security_policy'
      }
    });
  }

  /**
   * Enable high-performance rust-file-ops replacement
   */
  public async enableRustFileOps(): Promise<{
    readTool: ToolOverrideResult;
    writeTool: ToolOverrideResult;
    listTool: ToolOverrideResult;
  }> {
    const rustConfig: Omit<ToolOverrideConfig, 'toolName'> = {
      enabled: true,
      securityLevel: 'standard',
      performanceMode: 'optimal',
      auditLevel: 'standard',
      rollbackOnFailure: true,
      validationTimeout: 3000,
      metadata: {
        provider: 'rust-file-ops',
        version: '1.0.0',
        features: ['high-throughput', 'memory-safe', 'async-io']
      }
    };

    const [readTool, writeTool, listTool] = await Promise.all([
      this.overrideTool('mcp__vespera-scriptorium__mcp_read_file', rustConfig),
      this.overrideTool('mcp__vespera-scriptorium__mcp_write_file', rustConfig),
      this.overrideTool('mcp__vespera-scriptorium__mcp_list_files', rustConfig)
    ]);

    return { readTool, writeTool, listTool };
  }

  /**
   * Rollback tool override
   */
  public async rollbackTool(toolName: string): Promise<ToolOverrideResult> {
    const rollbackConfig = this.rollbackConfigs.get(toolName);
    if (!rollbackConfig) {
      throw new VesperaSecurityError(
        `No rollback configuration available for tool: ${toolName}`,
        VesperaSecurityErrorCode.UNAUTHORIZED_ACCESS,
        undefined,
        { toolName }
      );
    }

    const result = await this.applyToolOverride(toolName, rollbackConfig);
    
    if (result.success) {
      this.activeOverrides.set(toolName, rollbackConfig);
      this.rollbackConfigs.delete(toolName);
      this.overrideMetrics.rollbacks++;

      await this.logSecurityEvent(VesperaSecurityEvent.SECURITY_BREACH, {
        timestamp: Date.now(),
        metadata: {
          action: 'tool_rollback_successful',
          toolName,
          restoredConfig: rollbackConfig
        }
      });
    }

    return {
      success: result.success,
      toolName,
      validationTime: 0, // Rollback doesn't need validation
      securityViolations: [],
      rollbackAvailable: false
    };
  }

  /**
   * Get current tool overrides
   */
  public getActiveOverrides(): Map<string, ToolOverrideConfig> {
    return new Map(this.activeOverrides);
  }

  /**
   * Get tool management metrics
   */
  public getMetrics(): typeof this.overrideMetrics & {
    activeOverrides: number;
    availableRollbacks: number;
    successRate: number;
  } {
    return {
      ...this.overrideMetrics,
      activeOverrides: this.activeOverrides.size,
      availableRollbacks: this.rollbackConfigs.size,
      successRate: this.overrideMetrics.totalOverrides > 0 ?
        (this.overrideMetrics.successfulOverrides / this.overrideMetrics.totalOverrides) * 100 : 0
    };
  }

  /**
   * Security validation for tool override
   */
  private async validateToolOverride(
    toolName: string, 
    config: ToolOverrideConfig
  ): Promise<{ allowed: boolean; violations: string[] }> {
    const violations: string[] = [];

    // Policy validation
    if (!this.policy.allowedTools.includes(toolName)) {
      violations.push(`Tool ${toolName} not in allowed list`);
    }

    if (this.policy.blockedTools.includes(toolName)) {
      violations.push(`Tool ${toolName} is explicitly blocked`);
    }

    if (this.activeOverrides.size >= this.policy.maxOverrides) {
      violations.push(`Maximum overrides limit (${this.policy.maxOverrides}) reached`);
    }

    // Security level validation
    if (config.securityLevel === 'permissive' && this.policy.requireSecurityValidation) {
      violations.push('Permissive security level not allowed with security validation enabled');
    }

    // File operations specific validation
    if (toolName.includes('file') && this.fileSecurityManager) {
      // Additional file-specific security checks could go here
    }

    return {
      allowed: violations.length === 0,
      violations
    };
  }

  /**
   * Measure tool performance baseline
   */
  private async measureToolPerformance(toolName: string): Promise<number> {
    const startTime = performance.now();
    
    // Log performance measurement for specific tool
    this.securityServices?.logger?.debug(`Measuring performance for tool: ${toolName}`);
    
    // Simulate tool operation to measure baseline
    try {
      // This would measure actual tool performance in real implementation
      await new Promise(resolve => setTimeout(resolve, Math.random() * 50)); // Simulate 0-50ms
      return performance.now() - startTime;
    } catch {
      return 100; // Default baseline
    }
  }

  /**
   * Validate tool performance after override
   */
  private async validateToolPerformance(
    toolName: string, 
    baseline: number
  ): Promise<{ baselineLatency: number; newLatency: number; improvement: number }> {
    const newLatency = await this.measureToolPerformance(toolName);
    const improvement = ((baseline - newLatency) / baseline) * 100;
    
    return {
      baselineLatency: baseline,
      newLatency,
      improvement
    };
  }

  /**
   * Apply tool override (mock implementation)
   */
  private async applyToolOverride(
    toolName: string, 
    config: ToolOverrideConfig
  ): Promise<{ success: boolean }> {
    // In real implementation, this would use Claude Code SDK to override tools
    console.log(`Applying tool override for ${toolName}:`, config);
    
    // Simulate override application
    return { success: true };
  }

  /**
   * Update validation metrics
   */
  private updateValidationMetrics(validationTime: number): void {
    const totalOverrides = this.overrideMetrics.totalOverrides;
    this.overrideMetrics.averageValidationTime = 
      (this.overrideMetrics.averageValidationTime * (totalOverrides - 1) + validationTime) / totalOverrides;
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
   * Update policy
   */
  public updatePolicy(policy: Partial<ToolManagementPolicy>): void {
    this.policy = { ...this.policy, ...policy };
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.activeOverrides.clear();
    this.rollbackConfigs.clear();
    this.performanceBaselines.clear();
    SecureToolManager.instance = null;
  }
}

/**
 * Factory function for easy access
 */
export async function createSecureToolManager(
  policy?: Partial<ToolManagementPolicy>
): Promise<SecureToolManager> {
  return SecureToolManager.initialize(policy);
}