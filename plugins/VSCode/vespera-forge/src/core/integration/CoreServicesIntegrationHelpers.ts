/**
 * Core Services Integration Helpers
 * 
 * Provides helper functions for integrating with SecurityEnhancedCoreServices
 * for logging, telemetry, and audit trail functionality.
 */

import { SecurityEnhancedVesperaCoreServices } from '../security/SecurityEnhancedCoreServices';

export interface SecurityEventData {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  message: string;
  source: string;
  timestamp: number;
  details?: any;
}

export interface TelemetryEventData {
  [key: string]: any;
}

/**
 * Log a security event using the core services
 */
export async function logSecurityEvent(
  coreServices: SecurityEnhancedVesperaCoreServices,
  eventData: SecurityEventData,
  _metadata: Record<string, any>,
  source: string
): Promise<void> {
  try {
    // Use regular logging instead of security audit for non-security events
    coreServices.logger.info('Event logged', {
      type: eventData.type,
      category: eventData.category,
      severity: eventData.severity,
      source: eventData.source,
      message: eventData.message
    });
  } catch (error) {
    // Fallback to logger if logging fails
    coreServices.logger.warn('Failed to log event', {
      error,
      eventType: eventData.type,
      source 
    });
  }
}

/**
 * Track an event using the core services telemetry
 */
export function trackEvent(
  coreServices: SecurityEnhancedVesperaCoreServices,
  eventName: string,
  eventData: TelemetryEventData,
  source: string
): void {
  try {
    if (coreServices.telemetryService) {
      // Note: telemetryService might not have a direct trackEvent method
      // This is a scaffolded implementation
      coreServices.logger.debug('Telemetry event tracked', {
        eventName,
        eventData,
        source,
        timestamp: Date.now()
      });
    }
  } catch (error) {
    coreServices.logger.warn('Failed to track telemetry event', { 
      error,
      eventName,
      source 
    });
  }
}

/**
 * Log a performance metric using core services
 */
export function logPerformanceMetric(
  coreServices: SecurityEnhancedVesperaCoreServices,
  metricName: string,
  value: number,
  unit: string,
  source: string
): void {
  try {
    coreServices.logger.debug('Performance metric', {
      metric: metricName,
      value,
      unit,
      source,
      timestamp: Date.now()
    });
  } catch (error) {
    coreServices.logger.warn('Failed to log performance metric', { 
      error,
      metricName,
      source 
    });
  }
}

/**
 * Log an audit event for compliance tracking
 */
export async function logAuditEvent(
  coreServices: SecurityEnhancedVesperaCoreServices,
  action: string,
  resource: string,
  result: 'success' | 'failure',
  details: Record<string, any>,
  source: string
): Promise<void> {
  try {
    const eventData: SecurityEventData = {
      type: 'audit_event',
      severity: result === 'failure' ? 'medium' : 'low',
      category: 'audit',
      message: `Action '${action}' on '${resource}' resulted in '${result}'`,
      source,
      timestamp: Date.now(),
      details: {
        action,
        resource,
        result,
        ...details
      }
    };

    await logSecurityEvent(coreServices, eventData, { auditEvent: true }, source);
  } catch (error) {
    coreServices.logger.warn('Failed to log audit event', { 
      error,
      action,
      resource,
      source 
    });
  }
}