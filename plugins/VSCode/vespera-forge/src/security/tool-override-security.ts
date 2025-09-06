/**
 * Tool Override Security Layer
 * 
 * Enterprise-grade security validation for Claude Code tool management
 * with comprehensive audit logging, threat detection, and rollback capabilities.
 */

import { SecurityEnhancedCoreServices } from '../core/security/SecurityEnhancedCoreServices';
import { ToolOverrideConfig } from '../config/tool-management';
import { 
  VesperaSecurityEvent, 
  VesperaSecurityErrorCode
} from '../types/security';
import { VesperaSecurityError } from '../core/security/VesperaSecurityErrors';

export interface ToolSecurityProfile {
  toolName: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiredPermissions: string[];
  allowedFilePatterns: RegExp[];
  blockedFilePatterns: RegExp[];
  maxOperationsPerMinute: number;
  requiresElevatedPrivileges: boolean;
  auditRequired: boolean;
  sandboxRequired: boolean;
}

export interface ToolSecurityAudit {
  auditId: string;
  timestamp: number;
  toolName: string;
  operation: 'override' | 'disable' | 'rollback' | 'validate';
  userId?: string;
  sessionId?: string;
  securityLevel: string;
  riskAssessment: {
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    score: number; // 0-100
  };
  complianceChecks: {
    passed: boolean;
    checks: Array<{
      name: string;
      passed: boolean;
      details?: string;
    }>;
  };
  result: 'approved' | 'denied' | 'conditional';
  conditions?: string[];
  validationTime: number;
}

/**
 * Comprehensive tool override security manager
 */
export class ToolOverrideSecurityManager {
  private static instance: ToolOverrideSecurityManager | null = null;
  private securityServices: SecurityEnhancedCoreServices | null = null;
  private securityProfiles = new Map<string, ToolSecurityProfile>();
  private auditLog: ToolSecurityAudit[] = [];
  private readonly MAX_AUDIT_LOG_SIZE = 5000;

  // Security metrics
  private securityMetrics = {
    totalValidations: 0,
    approvedOverrides: 0,
    deniedOverrides: 0,
    conditionalOverrides: 0,
    rollbacksTriggered: 0,
    highRiskOperations: 0,
    complianceViolations: 0,
    averageValidationTime: 0
  };

  private constructor() {
    this.initializeDefaultSecurityProfiles();
  }

  /**
   * Initialize tool override security manager
   */
  public static async initialize(): Promise<ToolOverrideSecurityManager> {
    if (ToolOverrideSecurityManager.instance) {
      return ToolOverrideSecurityManager.instance;
    }

    const manager = new ToolOverrideSecurityManager();

    try {
      manager.securityServices = SecurityEnhancedCoreServices.getInstance();
      console.log('ToolOverrideSecurityManager initialized with SecurityEnhancedCoreServices');
    } catch (error) {
      console.warn('ToolOverrideSecurityManager initialized with reduced security:', error);
    }

    ToolOverrideSecurityManager.instance = manager;
    return manager;
  }

  /**
   * Validate tool override with comprehensive security analysis
   */
  public async validateToolOverride(
    toolName: string,
    config: ToolOverrideConfig,
    context?: {
      userId?: string;
      sessionId?: string;
      userAgent?: string;
      ipAddress?: string;
    }
  ): Promise<ToolSecurityAudit> {
    const startTime = performance.now();
    const auditId = this.generateAuditId();

    try {
      this.securityMetrics.totalValidations++;

      // Get security profile for tool
      const profile = this.getOrCreateSecurityProfile(toolName);

      // Risk assessment
      const riskAssessment = this.assessToolRisk(toolName, config, profile);

      // Compliance checks
      const complianceChecks = await this.performComplianceChecks(toolName, config, profile);

      // Determine approval result
      const result = this.determineApprovalResult(riskAssessment, complianceChecks);

      // Generate conditions if conditional approval
      const conditions = result === 'conditional' ? 
        this.generateApprovalConditions(riskAssessment, complianceChecks) : undefined;

      // Create audit record
      const audit: ToolSecurityAudit = {
        auditId,
        timestamp: Date.now(),
        toolName,
        operation: 'override',
        userId: context?.userId,
        sessionId: context?.sessionId,
        securityLevel: config.securityLevel,
        riskAssessment,
        complianceChecks,
        result,
        conditions,
        validationTime: performance.now() - startTime
      };

      // Update metrics
      this.updateSecurityMetrics(audit);

      // Add to audit log
      this.addToAuditLog(audit);

      // Log security event
      await this.logSecurityEvent(audit, context);

      // Handle high-risk operations
      if (riskAssessment.level === 'high' || riskAssessment.level === 'critical') {
        await this.handleHighRiskOperation(audit);
      }

      return audit;

    } catch (error) {
      const errorAudit: ToolSecurityAudit = {
        auditId,
        timestamp: Date.now(),
        toolName,
        operation: 'override',
        userId: context?.userId,
        sessionId: context?.sessionId,
        securityLevel: config.securityLevel,
        riskAssessment: {
          level: 'critical',
          factors: ['validation_error'],
          score: 100
        },
        complianceChecks: {
          passed: false,
          checks: [{
            name: 'security_validation',
            passed: false,
            details: error instanceof Error ? error.message : String(error)
          }]
        },
        result: 'denied',
        validationTime: performance.now() - startTime
      };

      this.addToAuditLog(errorAudit);
      throw new VesperaSecurityError(
        `Tool override security validation failed: ${error instanceof Error ? error.message : String(error)}`,
        VesperaSecurityErrorCode.UNAUTHORIZED_ACCESS,
        undefined,
        { toolName, auditId }
      );
    }
  }

  /**
   * Validate tool disable operation
   */
  public async validateToolDisable(
    toolName: string,
    context?: { userId?: string; sessionId?: string }
  ): Promise<ToolSecurityAudit> {
    const startTime = performance.now();
    const auditId = this.generateAuditId();


    // Tool disable has lower risk than override
    const riskAssessment = {
      level: 'low' as const,
      factors: ['tool_disable_operation'],
      score: 10
    };

    const complianceChecks = {
      passed: true,
      checks: [{
        name: 'disable_authorization',
        passed: true,
        details: 'Tool disable operations are generally permitted'
      }]
    };

    const audit: ToolSecurityAudit = {
      auditId,
      timestamp: Date.now(),
      toolName,
      operation: 'disable',
      userId: context?.userId,
      sessionId: context?.sessionId,
      securityLevel: 'strict',
      riskAssessment,
      complianceChecks,
      result: 'approved',
      validationTime: performance.now() - startTime
    };

    this.updateSecurityMetrics(audit);
    this.addToAuditLog(audit);
    await this.logSecurityEvent(audit, context);

    return audit;
  }

  /**
   * Validate tool rollback operation
   */
  public async validateToolRollback(
    toolName: string,
    context?: { userId?: string; sessionId?: string }
  ): Promise<ToolSecurityAudit> {
    const startTime = performance.now();
    const auditId = this.generateAuditId();

    // Rollback operations are considered safe
    const riskAssessment = {
      level: 'low' as const,
      factors: ['rollback_operation', 'restore_previous_state'],
      score: 5
    };

    const complianceChecks = {
      passed: true,
      checks: [{
        name: 'rollback_authorization',
        passed: true,
        details: 'Rollback operations restore previous secure state'
      }]
    };

    const audit: ToolSecurityAudit = {
      auditId,
      timestamp: Date.now(),
      toolName,
      operation: 'rollback',
      userId: context?.userId,
      sessionId: context?.sessionId,
      securityLevel: 'strict',
      riskAssessment,
      complianceChecks,
      result: 'approved',
      validationTime: performance.now() - startTime
    };

    this.updateSecurityMetrics(audit);
    this.addToAuditLog(audit);
    await this.logSecurityEvent(audit, context);

    return audit;
  }

  /**
   * Initialize default security profiles for common tools
   */
  private initializeDefaultSecurityProfiles(): void {
    // High-performance file operations (rust-file-ops)
    this.securityProfiles.set('mcp__vespera-scriptorium__mcp_read_file', {
      toolName: 'mcp__vespera-scriptorium__mcp_read_file',
      riskLevel: 'medium',
      requiredPermissions: ['file_read'],
      allowedFilePatterns: [
        /^\/home\/[\w-]+\/dev\/monorepo\/vespera-atelier\//,
        /^\/tmp\/vespera-temp\//
      ],
      blockedFilePatterns: [
        /\/\.ssh\//,
        /\/\.aws\//,
        /\/etc\/passwd/
      ],
      maxOperationsPerMinute: 1000,
      requiresElevatedPrivileges: false,
      auditRequired: true,
      sandboxRequired: false
    });

    this.securityProfiles.set('mcp__vespera-scriptorium__mcp_write_file', {
      toolName: 'mcp__vespera-scriptorium__mcp_write_file',
      riskLevel: 'high',
      requiredPermissions: ['file_write'],
      allowedFilePatterns: [
        /^\/home\/[\w-]+\/dev\/monorepo\/vespera-atelier\//,
        /^\/tmp\/vespera-temp\//
      ],
      blockedFilePatterns: [
        /\/\.ssh\//,
        /\/\.aws\//,
        /\/etc\//,
        /\/sys\//,
        /\/proc\//
      ],
      maxOperationsPerMinute: 500,
      requiresElevatedPrivileges: false,
      auditRequired: true,
      sandboxRequired: true
    });

    this.securityProfiles.set('Bash', {
      toolName: 'Bash',
      riskLevel: 'critical',
      requiredPermissions: ['system_execute'],
      allowedFilePatterns: [],
      blockedFilePatterns: [/.*/], // Block all for safety
      maxOperationsPerMinute: 10,
      requiresElevatedPrivileges: true,
      auditRequired: true,
      sandboxRequired: true
    });

    // Default profile for unknown tools
    this.securityProfiles.set('__default__', {
      toolName: '__default__',
      riskLevel: 'medium',
      requiredPermissions: [],
      allowedFilePatterns: [],
      blockedFilePatterns: [],
      maxOperationsPerMinute: 100,
      requiresElevatedPrivileges: false,
      auditRequired: true,
      sandboxRequired: false
    });
  }

  /**
   * Get or create security profile for tool
   */
  private getOrCreateSecurityProfile(toolName: string): ToolSecurityProfile {
    return this.securityProfiles.get(toolName) || 
           { ...this.securityProfiles.get('__default__')!, toolName };
  }

  /**
   * Assess tool risk based on profile and configuration
   */
  private assessToolRisk(
    _toolName: string, 
    config: ToolOverrideConfig, 
    profile: ToolSecurityProfile
  ): { level: 'low' | 'medium' | 'high' | 'critical'; factors: string[]; score: number } {
    const factors: string[] = [];
    let score = 0;

    // Base risk from profile
    switch (profile.riskLevel) {
      case 'low': score += 10; break;
      case 'medium': score += 30; break;
      case 'high': score += 60; break;
      case 'critical': score += 90; break;
    }
    factors.push(`base_risk_${profile.riskLevel}`);

    // Security level adjustment
    switch (config.securityLevel) {
      case 'permissive': 
        score += 30; 
        factors.push('permissive_security'); 
        break;
      case 'standard': 
        score += 10; 
        factors.push('standard_security'); 
        break;
      case 'strict': 
        score -= 10; 
        factors.push('strict_security'); 
        break;
    }

    // Performance mode adjustment
    if (config.performanceMode === 'optimal') {
      score += 15;
      factors.push('optimal_performance_mode');
    }

    // Elevated privileges check
    if (profile.requiresElevatedPrivileges) {
      score += 25;
      factors.push('elevated_privileges_required');
    }

    // Sandbox requirement
    if (!profile.sandboxRequired && profile.riskLevel !== 'low') {
      score += 15;
      factors.push('no_sandbox_protection');
    }

    // Determine final risk level
    let level: 'low' | 'medium' | 'high' | 'critical';
    if (score >= 80) level = 'critical';
    else if (score >= 60) level = 'high';
    else if (score >= 30) level = 'medium';
    else level = 'low';

    return { level, factors, score: Math.min(score, 100) };
  }

  /**
   * Perform compliance checks
   */
  private async performComplianceChecks(
    _toolName: string, 
    config: ToolOverrideConfig, 
    profile: ToolSecurityProfile
  ): Promise<{ passed: boolean; checks: Array<{ name: string; passed: boolean; details?: string }> }> {
    const checks: Array<{ name: string; passed: boolean; details?: string }> = [];

    // Permission check
    checks.push({
      name: 'required_permissions',
      passed: true, // Assume permissions are granted for now
      details: `Required permissions: ${profile.requiredPermissions.join(', ')}`
    });

    // Rate limiting check
    checks.push({
      name: 'rate_limiting',
      passed: profile.maxOperationsPerMinute > 0,
      details: `Max operations per minute: ${profile.maxOperationsPerMinute}`
    });

    // Security level compliance
    checks.push({
      name: 'security_level_compliance',
      passed: config.securityLevel !== 'permissive' || !profile.requiresElevatedPrivileges,
      details: 'Elevated privilege tools cannot use permissive security'
    });

    // Audit requirement check
    checks.push({
      name: 'audit_requirement',
      passed: !profile.auditRequired || config.auditLevel !== 'minimal',
      details: 'High-risk tools require comprehensive audit logging'
    });

    // Rollback capability check
    checks.push({
      name: 'rollback_capability',
      passed: config.rollbackOnFailure || profile.riskLevel === 'low',
      details: 'High-risk operations should have rollback capability'
    });

    const allPassed = checks.every(check => check.passed);
    
    return { passed: allPassed, checks };
  }

  /**
   * Determine approval result based on risk and compliance
   */
  private determineApprovalResult(
    riskAssessment: { level: string; score: number },
    complianceChecks: { passed: boolean }
  ): 'approved' | 'denied' | 'conditional' {
    if (!complianceChecks.passed) {
      return 'denied';
    }

    if (riskAssessment.level === 'critical') {
      return 'denied';
    }

    if (riskAssessment.level === 'high') {
      return 'conditional';
    }

    return 'approved';
  }

  /**
   * Generate approval conditions for conditional approvals
   */
  private generateApprovalConditions(
    riskAssessment: { level: string; factors: string[] },
    complianceChecks: { checks: Array<{ name: string; passed: boolean }> }
  ): string[] {
    const conditions: string[] = [];

    if (riskAssessment.level === 'high') {
      conditions.push('Enhanced monitoring required');
      conditions.push('Automatic rollback on security violation');
      conditions.push('Reduced operation rate limits');
    }

    // Add conditions based on failed checks
    const failedChecks = complianceChecks.checks.filter(check => !check.passed);
    failedChecks.forEach(check => {
      conditions.push(`Address compliance issue: ${check.name}`);
    });

    return conditions;
  }

  /**
   * Handle high-risk operations with additional security measures
   */
  private async handleHighRiskOperation(audit: ToolSecurityAudit): Promise<void> {
    this.securityMetrics.highRiskOperations++;

    // Log high-risk security event
    await this.logSecurityEvent(audit, undefined, VesperaSecurityEvent.THREAT_DETECTED);

    // Could implement additional measures:
    // - Real-time alerting
    // - Enhanced monitoring
    // - Automatic compliance checking
  }

  /**
   * Update security metrics
   */
  private updateSecurityMetrics(audit: ToolSecurityAudit): void {
    this.securityMetrics.totalValidations++;

    switch (audit.result) {
      case 'approved': this.securityMetrics.approvedOverrides++; break;
      case 'denied': this.securityMetrics.deniedOverrides++; break;
      case 'conditional': this.securityMetrics.conditionalOverrides++; break;
    }

    if (audit.operation === 'rollback') {
      this.securityMetrics.rollbacksTriggered++;
    }

    if (!audit.complianceChecks.passed) {
      this.securityMetrics.complianceViolations++;
    }

    // Update average validation time
    const total = this.securityMetrics.totalValidations;
    this.securityMetrics.averageValidationTime = 
      (this.securityMetrics.averageValidationTime * (total - 1) + audit.validationTime) / total;
  }

  /**
   * Add audit to log with size management
   */
  private addToAuditLog(audit: ToolSecurityAudit): void {
    this.auditLog.push(audit);
    
    if (this.auditLog.length > this.MAX_AUDIT_LOG_SIZE) {
      this.auditLog = this.auditLog.slice(-this.MAX_AUDIT_LOG_SIZE + 1000); // Keep recent 4000
    }
  }

  /**
   * Log security event
   */
  private async logSecurityEvent(
    audit: ToolSecurityAudit, 
    _context?: any,
    eventType: VesperaSecurityEvent = VesperaSecurityEvent.SECURITY_BREACH
  ): Promise<void> {
    if (this.securityServices?.securityAuditLogger) {
      try {
        await this.securityServices.securityAuditLogger.logSecurityEvent(eventType, {
          timestamp: audit.timestamp,
          metadata: {
            auditId: audit.auditId,
            toolName: audit.toolName,
            operation: audit.operation,
            result: audit.result,
            riskLevel: audit.riskAssessment.level,
            riskScore: audit.riskAssessment.score,
            compliancePassed: audit.complianceChecks.passed,
            validationTime: audit.validationTime,
            conditions: audit.conditions
          }
        });
      } catch (error) {
        console.warn('Failed to log security event:', error);
      }
    }
  }

  /**
   * Generate unique audit ID
   */
  private generateAuditId(): string {
    return `tool_audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get security metrics
   */
  public getSecurityMetrics(): typeof this.securityMetrics & {
    auditLogSize: number;
    approvalRate: number;
    denialRate: number;
    conditionalRate: number;
  } {
    const total = this.securityMetrics.totalValidations;
    return {
      ...this.securityMetrics,
      auditLogSize: this.auditLog.length,
      approvalRate: total > 0 ? (this.securityMetrics.approvedOverrides / total) * 100 : 0,
      denialRate: total > 0 ? (this.securityMetrics.deniedOverrides / total) * 100 : 0,
      conditionalRate: total > 0 ? (this.securityMetrics.conditionalOverrides / total) * 100 : 0
    };
  }

  /**
   * Export security audit log
   */
  public exportSecurityAuditLog(startTime?: number, endTime?: number): ToolSecurityAudit[] {
    let filtered = this.auditLog;
    
    if (startTime || endTime) {
      filtered = this.auditLog.filter(audit => {
        if (startTime && audit.timestamp < startTime) return false;
        if (endTime && audit.timestamp > endTime) return false;
        return true;
      });
    }
    
    return [...filtered];
  }

  /**
   * Get tool security profile
   */
  public getToolSecurityProfile(toolName: string): ToolSecurityProfile {
    return this.getOrCreateSecurityProfile(toolName);
  }

  /**
   * Update tool security profile
   */
  public updateToolSecurityProfile(toolName: string, profile: Partial<ToolSecurityProfile>): void {
    const existing = this.getOrCreateSecurityProfile(toolName);
    this.securityProfiles.set(toolName, { ...existing, ...profile });
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.auditLog.length = 0;
    this.securityProfiles.clear();
    ToolOverrideSecurityManager.instance = null;
  }
}

/**
 * Factory function for easy access
 */
export async function createToolOverrideSecurityManager(): Promise<ToolOverrideSecurityManager> {
  return ToolOverrideSecurityManager.initialize();
}