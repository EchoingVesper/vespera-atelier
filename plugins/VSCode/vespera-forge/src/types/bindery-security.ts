/**
 * Bindery Security Types
 * 
 * Security type definitions specifically for Bindery service integration
 * with process isolation, JSON-RPC validation, and RAG content protection.
 */

import { BinderyRequest, BinderyResponse } from './bindery';
import { SecurityEventContext, ThreatSeverity } from './security';

export interface BinderySecurityConfig {
  enableProcessIsolation: boolean;
  enableJsonRpcValidation: boolean;
  enableContentProtection: boolean;
  maxProcessMemoryMB: number;
  maxExecutionTimeMs: number;
  allowedBinderyPaths: string[];
  blockedBinderyPaths: string[];
  requireSandbox: boolean;
  auditAllOperations: boolean;
  rateLimiting: {
    enabled: boolean;
    maxRequestsPerMinute: number;
    maxConcurrentRequests: number;
  };
}

export interface BinderyProcessSecurity {
  processId?: number;
  isolationLevel: 'none' | 'basic' | 'strict';
  memoryLimit: number; // bytes
  cpuLimit: number; // percentage
  networkAccess: boolean;
  fileSystemAccess: {
    readOnly: boolean;
    allowedPaths: string[];
    blockedPaths: string[];
  };
  environmentVariables: Record<string, string>;
}

export interface JsonRpcSecurityValidation {
  requestValidation: {
    maxPayloadSize: number; // bytes
    allowedMethods: string[];
    blockedMethods: string[];
    requireAuth: boolean;
    validateParameters: boolean;
  };
  responseValidation: {
    validateStructure: boolean;
    sanitizeContent: boolean;
    maxResponseSize: number; // bytes
    timeoutMs: number;
  };
}

export interface BinderySecurityAudit {
  auditId: string;
  timestamp: number;
  operation: 'request' | 'response' | 'process_start' | 'process_end' | 'validation' | 'security_event';
  binderyMethod?: string;
  processId?: number;
  requestId?: number;
  securityValidation: {
    passed: boolean;
    threats: BinderySecurityThreat[];
    validationTime: number;
    sanitizationApplied: boolean;
  };
  processMetrics?: {
    memoryUsageMB: number;
    cpuUsagePercent: number;
    executionTimeMs: number;
    networkRequests: number;
    fileOperations: number;
  };
  result: 'success' | 'blocked' | 'error' | 'timeout';
  errorDetails?: string;
}

export interface BinderySecurityThreat {
  type: 'json_injection' | 'process_escape' | 'resource_exhaustion' | 'unauthorized_access' | 'data_exfiltration';
  severity: ThreatSeverity;
  description: string;
  location: string;
  blocked: boolean;
  remediation?: string;
}

export interface BinderyContentProtection {
  enableContentSanitization: boolean;
  enableDataLossProtection: boolean;
  sensitiveDataPatterns: RegExp[];
  allowedContentTypes: string[];
  blockedContentTypes: string[];
  maxContentSize: number; // bytes
  ragProtection: {
    enableContextValidation: boolean;
    maxContextTokens: number;
    validateSourceAttribution: boolean;
    blockSensitiveContent: boolean;
  };
}

export interface SecureBinderyRequest extends BinderyRequest {
  security?: {
    userId?: string;
    sessionId?: string;
    timestamp: number;
    checksum?: string;
    nonce?: string;
  };
}

export interface SecureBinderyResponse extends BinderyResponse {
  security?: {
    validationPassed: boolean;
    threats: BinderySecurityThreat[];
    sanitized: boolean;
    processingTime: number;
  };
}

export interface BinderySecurityMetrics {
  requests: {
    total: number;
    blocked: number;
    sanitized: number;
    errors: number;
    averageValidationTime: number;
  };
  processes: {
    totalStarted: number;
    currentRunning: number;
    terminatedBySecurity: number;
    memoryViolations: number;
    timeoutViolations: number;
    averageLifetime: number;
  };
  threats: {
    totalDetected: number;
    byType: Record<string, number>;
    bySeverity: Record<ThreatSeverity, number>;
    blocked: number;
    mitigated: number;
  };
  performance: {
    averageRequestTime: number;
    averageResponseTime: number;
    securityOverhead: number; // percentage
    throughputRequests: number; // per second
  };
}

export interface BinderyRateLimitConfig {
  windowMs: number;
  maxRequests: number;
  maxConcurrent: number;
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
  keyGenerator?: (request: BinderyRequest) => string;
}

export interface BinderySecurityContext extends SecurityEventContext {
  binderyMethod?: string;
  requestId?: number;
  processId?: number;
  isolationLevel?: string;
  validationResults?: {
    requestValid: boolean;
    responseValid: boolean;
    contentProtected: boolean;
  };
}