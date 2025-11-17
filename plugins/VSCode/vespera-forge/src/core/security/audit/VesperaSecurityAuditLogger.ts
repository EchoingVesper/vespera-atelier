/**
 * Vespera Security Audit Logger
 * 
 * Comprehensive security event logging and audit trail management
 * with real-time alerting and compliance reporting capabilities.
 */

import * as vscode from 'vscode';
import { VesperaLogger } from '../../logging/VesperaLogger';
import { VesperaTelemetryService } from '../../telemetry/VesperaTelemetryService';
import { VesperaEvents } from '../../../utils/events';
import {
  VesperaSecurityEvent,
  SecurityEventContext,
  SecurityMetrics,
  AuditConfiguration,
  SecurityAuditLoggerInterface
} from '../../../types/security';

export interface SecurityAuditEntry {
  id: string;
  timestamp: number;
  event: VesperaSecurityEvent;
  context: SecurityEventContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  details?: Record<string, any>;
  resolved: boolean;
  resolvedAt?: number;
  resolvedBy?: string;
}

export interface SecurityAlert {
  id: string;
  timestamp: number;
  level: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  event: VesperaSecurityEvent;
  context: SecurityEventContext;
  acknowledged: boolean;
  acknowledgedAt?: number;
  acknowledgedBy?: string;
}

/**
 * Security audit logger with real-time monitoring and alerting
 */
export class VesperaSecurityAuditLogger implements SecurityAuditLoggerInterface {
  private auditLog: SecurityAuditEntry[] = [];
  private alerts: SecurityAlert[] = [];
  private disposed = false;
  private isDevelopment = false;
  private suppressNotifications = false;

  /**
   * Check if service is disposed
   */
  public get isDisposed(): boolean {
    return this.disposed;
  }

  // Statistics
  private metrics: SecurityMetrics = {
    rateLimiting: {
      requestsBlocked: 0,
      circuitBreakerActivations: 0,
      averageTokenConsumption: 0,
    },
    consent: {
      activeConsents: 0,
      withdrawalEvents: 0,
      complianceScore: 1.0,
    },
    sanitization: {
      threatsBlocked: 0,
      cspViolations: 0,
      sanitizationEvents: 0,
    },
  };

  // Event counters for trend analysis
  private eventCounters = new Map<VesperaSecurityEvent, number>();
  
  // Alert thresholds
  private alertThresholds = {
    rateLimitExceeded: 10,
    threatDetected: 5,
    cspViolation: 3,
    consentViolation: 1
  };

  constructor(
    private logger: VesperaLogger,
    private telemetryService?: VesperaTelemetryService,
    private config?: AuditConfiguration,
    options?: {
      isDevelopment?: boolean;
      suppressNotifications?: boolean;
    }
  ) {
    this.logger = logger.createChild('SecurityAuditLogger');
    this.isDevelopment = options?.isDevelopment ?? false;
    this.suppressNotifications = options?.suppressNotifications ?? !this.isDevelopment;
    this.initializeEventCounters();

    this.logger.info('SecurityAuditLogger initialized', {
      realTimeAlerts: config?.realTimeAlerts,
      retention: config?.retention,
      includePII: config?.includePII,
      isDevelopment: this.isDevelopment,
      suppressNotifications: this.suppressNotifications
    });
  }

  /**
   * Log a security event
   */
  async logSecurityEvent(event: VesperaSecurityEvent, context: SecurityEventContext): Promise<void> {
    if (this.disposed) return;

    const auditEntry: SecurityAuditEntry = {
      id: this.generateAuditId(),
      timestamp: Date.now(),
      event,
      context,
      severity: this.determineSeverity(event, context),
      source: 'vespera-forge',
      details: this.sanitizeContext(context),
      resolved: false
    };

    // Add to audit log
    this.auditLog.push(auditEntry);
    
    // Update event counters
    const currentCount = this.eventCounters.get(event) || 0;
    this.eventCounters.set(event, currentCount + 1);

    // Update metrics
    this.updateMetrics(event, context);

    // Check for alert conditions
    if (this.config?.realTimeAlerts) {
      await this.checkAlertConditions(auditEntry);
    }

    // Send telemetry if enabled
    if (this.telemetryService?.isEnabled()) {
      this.telemetryService.trackEvent({
        name: `Security.${event}`,
        properties: {
          severity: auditEntry.severity,
          userId: context.userId,
          resourceId: context.resourceId
        },
        measurements: {
          timestamp: context.timestamp
        }
      });
    }

    this.logger.info('Security event logged', {
      eventId: auditEntry.id,
      event,
      severity: auditEntry.severity,
      userId: context.userId,
      resourceId: context.resourceId
    });

    // Cleanup old entries if needed
    await this.performCleanup();
  }

  /**
   * Get security metrics
   */
  async getSecurityMetrics(): Promise<SecurityMetrics> {
    return { ...this.metrics };
  }

  /**
   * Export audit log for compliance
   */
  async exportAuditLog(startTime: number, endTime: number): Promise<SecurityAuditEntry[]> {
    if (this.disposed) return [];

    const filteredLog = this.auditLog.filter(entry => 
      entry.timestamp >= startTime && entry.timestamp <= endTime
    );

    this.logger.info('Audit log exported', {
      startTime,
      endTime,
      entriesCount: filteredLog.length
    });

    return filteredLog.map(entry => ({
      ...entry,
      details: this.config?.includePII ? entry.details : this.stripPII(entry.details)
    }));
  }

  /**
   * Get recent security alerts
   */
  getRecentAlerts(limit: number = 50): SecurityAlert[] {
    return this.alerts
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get unacknowledged alerts
   */
  getUnacknowledgedAlerts(): SecurityAlert[] {
    return this.alerts.filter(alert => !alert.acknowledged);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.acknowledged) {
      alert.acknowledged = true;
      alert.acknowledgedAt = Date.now();
      alert.acknowledgedBy = acknowledgedBy;
      
      this.logger.info('Security alert acknowledged', {
        alertId,
        acknowledgedBy,
        alertLevel: alert.level
      });
      
      return true;
    }
    return false;
  }

  /**
   * Get audit statistics
   */
  getAuditStats(): {
    totalEvents: number;
    eventsLast24h: number;
    alertsGenerated: number;
    unacknowledgedAlerts: number;
    topEvents: Array<{ event: VesperaSecurityEvent; count: number }>;
    severityBreakdown: Record<string, number>;
  } {
    const now = Date.now();
    const last24h = now - (24 * 60 * 60 * 1000);
    
    const eventsLast24h = this.auditLog.filter(entry => entry.timestamp >= last24h).length;
    const unacknowledgedAlerts = this.getUnacknowledgedAlerts().length;
    
    // Top events
    const topEvents = Array.from(this.eventCounters.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([event, count]) => ({ event, count }));

    // Severity breakdown
    const severityBreakdown: Record<string, number> = {};
    for (const entry of this.auditLog) {
      severityBreakdown[entry.severity] = (severityBreakdown[entry.severity] || 0) + 1;
    }

    return {
      totalEvents: this.auditLog.length,
      eventsLast24h,
      alertsGenerated: this.alerts.length,
      unacknowledgedAlerts,
      topEvents,
      severityBreakdown
    };
  }

  /**
   * Search audit log
   */
  searchAuditLog(criteria: {
    event?: VesperaSecurityEvent;
    severity?: string;
    userId?: string;
    resourceId?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): SecurityAuditEntry[] {
    let results = [...this.auditLog];

    if (criteria.event) {
      results = results.filter(entry => entry.event === criteria.event);
    }
    
    if (criteria.severity) {
      results = results.filter(entry => entry.severity === criteria.severity);
    }
    
    if (criteria.userId) {
      results = results.filter(entry => entry.context.userId === criteria.userId);
    }
    
    if (criteria.resourceId) {
      results = results.filter(entry => entry.context.resourceId === criteria.resourceId);
    }
    
    if (criteria.startTime) {
      results = results.filter(entry => entry.timestamp >= criteria.startTime!);
    }
    
    if (criteria.endTime) {
      results = results.filter(entry => entry.timestamp <= criteria.endTime!);
    }

    // Sort by timestamp (newest first)
    results.sort((a, b) => b.timestamp - a.timestamp);
    
    if (criteria.limit) {
      results = results.slice(0, criteria.limit);
    }

    return results;
  }

  /**
   * Generate security report
   */
  async generateSecurityReport(periodDays: number = 30): Promise<{
    summary: {
      totalEvents: number;
      criticalEvents: number;
      alertsGenerated: number;
      complianceScore: number;
    };
    trends: Array<{
      date: string;
      eventCount: number;
      alertCount: number;
    }>;
    topThreats: Array<{
      type: string;
      count: number;
      severity: string;
    }>;
    recommendations: string[];
  }> {
    const startTime = Date.now() - (periodDays * 24 * 60 * 60 * 1000);
    const periodEvents = this.auditLog.filter(entry => entry.timestamp >= startTime);
    
    const criticalEvents = periodEvents.filter(entry => entry.severity === 'critical').length;
    const alertsInPeriod = this.alerts.filter(alert => alert.timestamp >= startTime).length;
    
    // Calculate compliance score (simplified)
    const complianceScore = Math.max(0, 1 - (criticalEvents / Math.max(1, periodEvents.length)));

    // Generate daily trends
    const trends: Array<{ date: string; eventCount: number; alertCount: number }> = [];
    for (let i = 0; i < periodDays; i++) {
      const dayStart = startTime + (i * 24 * 60 * 60 * 1000);
      const dayEnd = dayStart + (24 * 60 * 60 * 1000);
      
      const dayEvents = periodEvents.filter(e => e.timestamp >= dayStart && e.timestamp < dayEnd);
      const dayAlerts = this.alerts.filter(a => a.timestamp >= dayStart && a.timestamp < dayEnd);
      
      trends.push({
        date: new Date(dayStart).toISOString().split('T')[0]!,
        eventCount: dayEvents.length,
        alertCount: dayAlerts.length
      });
    }

    // Top threats
    const threatCounts = new Map<string, { count: number; severity: string }>();
    for (const entry of periodEvents) {
      const threatType = entry.context.threat?.type || 'unknown';
      const existing = threatCounts.get(threatType);
      if (existing) {
        existing.count++;
      } else {
        threatCounts.set(threatType, {
          count: 1,
          severity: entry.severity
        });
      }
    }

    const topThreats = Array.from(threatCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([type, data]) => ({
        type,
        count: data.count,
        severity: data.severity
      }));

    // Generate recommendations
    const recommendations: string[] = [];
    if (criticalEvents > 0) {
      recommendations.push(`${criticalEvents} critical security events detected. Review and address immediately.`);
    }
    if (complianceScore < 0.9) {
      recommendations.push('Compliance score is below 90%. Review security policies and controls.');
    }
    if (this.getUnacknowledgedAlerts().length > 5) {
      recommendations.push('Multiple unacknowledged alerts. Implement alert management procedures.');
    }

    return {
      summary: {
        totalEvents: periodEvents.length,
        criticalEvents,
        alertsGenerated: alertsInPeriod,
        complianceScore
      },
      trends,
      topThreats,
      recommendations
    };
  }

  /**
   * Initialize event counters
   */
  private initializeEventCounters(): void {
    for (const event of Object.values(VesperaSecurityEvent)) {
      this.eventCounters.set(event, 0);
    }
  }

  /**
   * Determine severity based on event and context
   */
  private determineSeverity(event: VesperaSecurityEvent, context: SecurityEventContext): 'low' | 'medium' | 'high' | 'critical' {
    // Base severity by event type
    const baseSeverity: Record<VesperaSecurityEvent, 'low' | 'medium' | 'high' | 'critical'> = {
      // Security threats and violations
      [VesperaSecurityEvent.RATE_LIMIT_EXCEEDED]: 'low',
      [VesperaSecurityEvent.THREAT_DETECTED]: 'high',
      [VesperaSecurityEvent.CSP_VIOLATION]: 'medium',
      [VesperaSecurityEvent.SECURITY_BREACH]: 'critical',

      // System lifecycle events (informational, not security threats)
      [VesperaSecurityEvent.SYSTEM_INITIALIZED]: 'low',
      [VesperaSecurityEvent.SYSTEM_SHUTDOWN]: 'low',
      [VesperaSecurityEvent.COMPONENT_INITIALIZED]: 'low',
      [VesperaSecurityEvent.INITIALIZATION_FAILED]: 'medium',

      // User consent and privacy
      [VesperaSecurityEvent.CONSENT_GRANTED]: 'low',
      [VesperaSecurityEvent.CONSENT_WITHDRAWN]: 'medium',

      // Data protection
      [VesperaSecurityEvent.SANITIZATION_APPLIED]: 'low',

      // Circuit breaker and resilience
      [VesperaSecurityEvent.CIRCUIT_BREAKER_OPENED]: 'medium',
      [VesperaSecurityEvent.CIRCUIT_BREAKER_CLOSED]: 'low',

      // API and external access
      [VesperaSecurityEvent.API_ACCESS]: 'low',
      [VesperaSecurityEvent.API_ERROR]: 'medium'
    };

    let severity = baseSeverity[event] || 'medium';

    // Elevate severity based on threat information
    if (context.threat) {
      switch (context.threat.severity) {
        case 'critical':
          severity = 'critical';
          break;
        case 'high':
          severity = severity === 'low' ? 'medium' : severity;
          break;
      }
    }

    return severity;
  }

  /**
   * Sanitize context to remove sensitive information
   */
  private sanitizeContext(context: SecurityEventContext): Record<string, any> {
    const sanitized = { ...context };
    
    // Remove PII if configured
    if (!this.config?.includePII) {
      delete sanitized.userId;
      if (sanitized.metadata) {
        sanitized.metadata = this.stripPII(sanitized.metadata);
      }
    }

    return sanitized;
  }

  /**
   * Strip PII from metadata
   */
  private stripPII(metadata?: Record<string, any>): Record<string, any> | undefined {
    if (!metadata) return metadata;

    const stripped = { ...metadata };
    const piiFields = ['email', 'phone', 'address', 'ssn', 'password', 'token'];
    
    for (const field of piiFields) {
      if (field in stripped) {
        stripped[field] = '[REDACTED]';
      }
    }

    return stripped;
  }

  /**
   * Update metrics based on event
   */
  private updateMetrics(event: VesperaSecurityEvent, context: SecurityEventContext): void {
    switch (event) {
      case VesperaSecurityEvent.RATE_LIMIT_EXCEEDED:
        this.metrics.rateLimiting.requestsBlocked++;
        break;
        
      case VesperaSecurityEvent.CIRCUIT_BREAKER_OPENED:
        this.metrics.rateLimiting.circuitBreakerActivations++;
        break;
        
      case VesperaSecurityEvent.CONSENT_WITHDRAWN:
        this.metrics.consent.withdrawalEvents++;
        break;
        
      case VesperaSecurityEvent.THREAT_DETECTED:
        if (context.threat?.blocked) {
          this.metrics.sanitization.threatsBlocked++;
        }
        break;
        
      case VesperaSecurityEvent.CSP_VIOLATION:
        this.metrics.sanitization.cspViolations++;
        break;
        
      case VesperaSecurityEvent.SANITIZATION_APPLIED:
        this.metrics.sanitization.sanitizationEvents++;
        break;
    }
  }

  /**
   * Check if alert conditions are met
   */
  private async checkAlertConditions(auditEntry: SecurityAuditEntry): Promise<void> {
    // Check for immediate critical alerts
    if (auditEntry.severity === 'critical') {
      await this.createAlert({
        level: 'critical',
        title: 'Critical Security Event',
        message: `Critical security event detected: ${auditEntry.event}`,
        event: auditEntry.event,
        context: auditEntry.context
      });
      return;
    }

    // Check for threshold-based alerts
    const recentCount = this.getRecentEventCount(auditEntry.event, 60 * 60 * 1000); // Last hour
    
    switch (auditEntry.event) {
      case VesperaSecurityEvent.RATE_LIMIT_EXCEEDED:
        if (recentCount >= this.alertThresholds.rateLimitExceeded) {
          await this.createAlert({
            level: 'warning',
            title: 'High Rate Limiting Activity',
            message: `${recentCount} rate limit violations in the last hour`,
            event: auditEntry.event,
            context: auditEntry.context
          });
        }
        break;
        
      case VesperaSecurityEvent.THREAT_DETECTED:
        if (recentCount >= this.alertThresholds.threatDetected) {
          await this.createAlert({
            level: 'error',
            title: 'Multiple Threats Detected',
            message: `${recentCount} threats detected in the last hour`,
            event: auditEntry.event,
            context: auditEntry.context
          });
        }
        break;
        
      case VesperaSecurityEvent.CSP_VIOLATION:
        if (recentCount >= this.alertThresholds.cspViolation) {
          await this.createAlert({
            level: 'warning',
            title: 'CSP Violations',
            message: `${recentCount} CSP violations in the last hour`,
            event: auditEntry.event,
            context: auditEntry.context
          });
        }
        break;
    }
  }

  /**
   * Get count of recent events
   */
  private getRecentEventCount(event: VesperaSecurityEvent, timeWindowMs: number): number {
    const cutoff = Date.now() - timeWindowMs;
    return this.auditLog.filter(entry => 
      entry.event === event && entry.timestamp >= cutoff
    ).length;
  }

  /**
   * Create a security alert
   */
  private async createAlert(alert: {
    level: 'info' | 'warning' | 'error' | 'critical';
    title: string;
    message: string;
    event: VesperaSecurityEvent;
    context: SecurityEventContext;
  }): Promise<void> {
    const securityAlert: SecurityAlert = {
      id: this.generateAlertId(),
      timestamp: Date.now(),
      ...alert,
      acknowledged: false
    };

    this.alerts.push(securityAlert);

    this.logger.warn('Security alert generated', {
      alertId: securityAlert.id,
      level: alert.level,
      title: alert.title,
      event: alert.event
    });

    // Emit security event to event bus
    const shouldNotifyUser = !this.suppressNotifications && (alert.level === 'critical' || alert.level === 'error');
    VesperaEvents.securityEventLogged(
      alert.event,
      this.mapAlertLevelToSeverity(alert.level),
      alert.message,
      shouldNotifyUser,
      {
        alertId: securityAlert.id,
        title: alert.title,
        context: alert.context
      }
    );

    // Show VS Code notification for high-priority alerts (only if not suppressed)
    if (shouldNotifyUser) {
      const action = alert.level === 'critical' ?
        vscode.window.showErrorMessage :
        vscode.window.showWarningMessage;

      action(
        `Security Alert: ${alert.title}`,
        'View Details',
        'Acknowledge'
      ).then(response => {
        if (response === 'Acknowledge') {
          this.acknowledgeAlert(securityAlert.id, 'user');
        } else if (response === 'View Details') {
          // Could show detailed alert view
          this.logger.info('User requested alert details', { alertId: securityAlert.id });
        }
      });
    } else {
      // In production or when suppressed, only log to file/event bus
      this.logger.debug('Security alert suppressed (notifications disabled)', {
        alertId: securityAlert.id,
        level: alert.level,
        suppressNotifications: this.suppressNotifications,
        isDevelopment: this.isDevelopment
      });
    }
  }

  /**
   * Map alert level to security event severity
   */
  private mapAlertLevelToSeverity(level: 'info' | 'warning' | 'error' | 'critical'): 'low' | 'medium' | 'high' | 'critical' {
    switch (level) {
      case 'info': return 'low';
      case 'warning': return 'medium';
      case 'error': return 'high';
      case 'critical': return 'critical';
    }
  }

  /**
   * Perform cleanup of old audit entries and alerts
   */
  private async performCleanup(): Promise<void> {
    if (!this.config?.retention) return;

    const cutoff = Date.now() - this.config.retention;
    
    const originalAuditCount = this.auditLog.length;
    const originalAlertCount = this.alerts.length;
    
    this.auditLog = this.auditLog.filter(entry => entry.timestamp >= cutoff);
    this.alerts = this.alerts.filter(alert => alert.timestamp >= cutoff);
    
    const auditRemoved = originalAuditCount - this.auditLog.length;
    const alertsRemoved = originalAlertCount - this.alerts.length;
    
    if (auditRemoved > 0 || alertsRemoved > 0) {
      this.logger.debug('Audit cleanup completed', {
        auditEntriesRemoved: auditRemoved,
        alertsRemoved,
        retentionDays: this.config.retention / (24 * 60 * 60 * 1000)
      });
    }
  }

  /**
   * Generate unique audit ID
   */
  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Dispose the audit logger
   */
  dispose(): void {
    if (this.disposed) return;
    
    this.logger.info('SecurityAuditLogger disposing', {
      auditEntries: this.auditLog.length,
      alerts: this.alerts.length,
      unacknowledgedAlerts: this.getUnacknowledgedAlerts().length
    });
    
    // Clear all data
    this.auditLog.length = 0;
    this.alerts.length = 0;
    this.eventCounters.clear();
    
    this.disposed = true;
    this.logger.info('SecurityAuditLogger disposed');
  }
}