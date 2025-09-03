/**
 * Vespera Forge Security Types
 * 
 * Comprehensive type definitions for the security infrastructure including
 * rate limiting, consent management, input sanitization, and audit systems.
 */

import * as vscode from 'vscode';

// ============================================================================
// Base Security Configuration
// ============================================================================

export interface SecurityConfiguration {
  enabled: boolean;
  rateLimiting?: RateLimitingConfiguration;
  consent?: ConsentConfiguration;
  sanitization?: SanitizationConfiguration;
  audit?: AuditConfiguration;
}

export interface RateLimitingConfiguration {
  enabled: boolean;
  rules: RateLimitRule[];
  globalDefaults: TokenBucketConfig;
  circuitBreaker?: CircuitBreakerConfig;
}

export interface ConsentConfiguration {
  enabled: boolean;
  purposes: ConsentPurpose[];
  uiMode: 'status-bar' | 'panel' | 'modal' | 'hybrid';
  retention: {
    activeConsentDays: number;
    auditLogDays: number;
  };
  encryption: {
    enabled: boolean;
    algorithm: string;
  };
}

export interface SanitizationConfiguration {
  enabled: boolean;
  rules: SanitizationRule[];
  strictMode: boolean;
  csp: CSPConfiguration;
  threatDetection: ThreatDetectionConfig;
}

export interface AuditConfiguration {
  enabled: boolean;
  retention: number;
  includePII: boolean;
  exportFormat: 'json' | 'csv' | 'xml';
  realTimeAlerts: boolean;
}

// ============================================================================
// Security Events
// ============================================================================

export enum VesperaSecurityEvent {
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  CONSENT_GRANTED = 'consent_granted',
  CONSENT_WITHDRAWN = 'consent_withdrawn',
  THREAT_DETECTED = 'threat_detected',
  CSP_VIOLATION = 'csp_violation',
  SANITIZATION_APPLIED = 'sanitization_applied',
  SECURITY_BREACH = 'security_breach',
  CIRCUIT_BREAKER_OPENED = 'circuit_breaker_opened',
  CIRCUIT_BREAKER_CLOSED = 'circuit_breaker_closed'
}

export interface SecurityEventContext {
  timestamp: number;
  userId?: string;
  resourceId?: string;
  threat?: ThreatInfo;
  metadata?: Record<string, any>;
}

export interface ThreatInfo {
  type: 'xss' | 'injection' | 'csrf' | 'dos' | 'path_traversal' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  patterns: string[];
  blocked: boolean;
}

// ============================================================================
// Rate Limiting Types
// ============================================================================

export interface TokenBucketConfig {
  capacity: number;           // Maximum tokens
  refillRate: number;        // Tokens per second
  refillInterval: number;    // Milliseconds between refills
  initialTokens?: number;    // Starting token count
  burstAllowance?: number;   // Additional burst capacity
}

export interface TokenBucketState {
  tokens: number;
  lastRefill: number;
  totalRequests: number;
  rejectedRequests: number;
  burstTokensUsed: number;
}

export interface RateLimitRule {
  id: string;
  name: string;
  pattern: string | RegExp;
  scope: 'global' | 'user' | 'resource' | 'session';
  bucket: TokenBucketConfig;
  actions: RateLimitAction[];
  enabled: boolean;
  priority: number;
}

export interface RateLimitAction {
  type: 'log' | 'delay' | 'reject' | 'circuit-break' | 'notify';
  threshold: number;
  config?: {
    delayMs?: number;
    circuitBreakerDurationMs?: number;
    notificationLevel?: 'info' | 'warning' | 'error';
  };
}

export interface RateLimitContext {
  resourceId: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface RateLimitResult {
  allowed: boolean;
  rule?: RateLimitRule;
  remainingTokens?: number;
  retryAfter?: number;
  actions: RateLimitAction[];
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  halfOpenMaxCalls: number;
}

export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

// ============================================================================
// Consent Management Types
// ============================================================================

export interface ConsentRecord {
  id: string;
  userId: string;
  purposes: ConsentPurposeGrant[];
  timestamp: number;
  version: string;
  source: ConsentSource;
  evidence: ConsentEvidence;
  status: ConsentStatus;
  expiresAt?: number;
}

export interface ConsentPurpose {
  id: string;
  name: string;
  description: string;
  category: ConsentCategory;
  required: boolean;
  dataTypes: string[];
  retentionPeriod: number;
  thirdParties: string[];
  legalBasis: LegalBasis;
}

export interface ConsentPurposeGrant {
  purposeId: string;
  granted: boolean;
  timestamp: number;
  conditions?: ConsentConditions;
}

export interface ConsentEvidence {
  userAgent: string;
  ipAddress?: string;
  timestamp: number;
  method: ConsentMethod;
  metadata: Record<string, any>;
  checksum: string;
}

export enum ConsentSource {
  EXPLICIT = 'explicit',
  IMPLIED = 'implied',
  LEGITIMATE_INTEREST = 'legitimate_interest',
  LEGAL_OBLIGATION = 'legal_obligation'
}

export enum ConsentStatus {
  ACTIVE = 'active',
  WITHDRAWN = 'withdrawn',
  EXPIRED = 'expired',
  INVALID = 'invalid'
}

export enum ConsentCategory {
  ESSENTIAL = 'essential',
  FUNCTIONAL = 'functional',
  ANALYTICS = 'analytics',
  MARKETING = 'marketing',
  PREFERENCES = 'preferences'
}

export enum ConsentMethod {
  UI_INTERACTION = 'ui_interaction',
  API_CALL = 'api_call',
  CONFIGURATION = 'configuration',
  IMPORT = 'import'
}

export enum LegalBasis {
  CONSENT = 'consent',
  CONTRACT = 'contract',
  LEGAL_OBLIGATION = 'legal_obligation',
  VITAL_INTERESTS = 'vital_interests',
  PUBLIC_TASK = 'public_task',
  LEGITIMATE_INTERESTS = 'legitimate_interests'
}

export interface ConsentConditions {
  expiryDate?: number;
  restrictions?: string[];
  purposes?: string[];
  dataMinimization?: boolean;
}

// ============================================================================
// Input Sanitization Types
// ============================================================================

export interface SanitizationRule {
  id: string;
  name: string;
  scope: SanitizationScope;
  priority: number;
  enabled: boolean;
  processors: SanitizationProcessor[];
  threatPatterns: ThreatPattern[];
}

export enum SanitizationScope {
  WEBVIEW = 'webview',
  MESSAGE = 'message',
  CONFIGURATION = 'configuration',
  FILE_CONTENT = 'file_content',
  USER_INPUT = 'user_input'
}

export interface SanitizationProcessor {
  type: 'dompurify' | 'schema-validation' | 'regex-replace' | 'encoding' | 'custom';
  config: ProcessorConfig;
}

export interface ProcessorConfig {
  domPurify?: {
    allowedTags?: string[];
    allowedAttributes?: Record<string, string[]>;
    stripIgnoreTag?: boolean;
    stripIgnoreTagBody?: string[];
  };
  schema?: {
    type: 'json-schema' | 'joi' | 'zod';
    definition: any;
  };
  regexReplace?: {
    patterns: Array<{ pattern: string | RegExp; replacement: string; flags?: string }>;
  };
  encoding?: {
    type: 'html' | 'url' | 'base64';
    decode?: boolean;
  };
  custom?: {
    functionName: string;
    parameters: Record<string, any>;
  };
}

export interface ThreatPattern {
  id: string;
  type: ThreatType;
  pattern: string | RegExp;
  severity: ThreatSeverity;
  action: ThreatAction;
}

export enum ThreatType {
  XSS = 'xss',
  SQL_INJECTION = 'sql_injection',
  SCRIPT_INJECTION = 'script_injection',
  HTML_INJECTION = 'html_injection',
  PATH_TRAVERSAL = 'path_traversal',
  COMMAND_INJECTION = 'command_injection'
}

export enum ThreatSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ThreatAction {
  LOG = 'log',
  SANITIZE = 'sanitize',
  BLOCK = 'block',
  ALERT = 'alert'
}

export interface SanitizationResult {
  original: any;
  sanitized: any;
  threats: DetectedThreat[];
  applied: string[]; // Applied processor IDs
  blocked: boolean;
}

export interface DetectedThreat {
  pattern: ThreatPattern;
  matches: string[];
  severity: ThreatSeverity;
  location: string;
}

export interface CSPConfiguration {
  defaultSrc: string[];
  scriptSrc: string[];
  styleSrc: string[];
  imgSrc: string[];
  connectSrc: string[];
  fontSrc: string[];
  mediaSrc: string[];
  objectSrc: string[];
  childSrc: string[];
  frameAncestors: string[];
  baseUri: string[];
  formAction: string[];
  upgradeInsecureRequests: boolean;
  reportUri?: string;
}

export interface ThreatDetectionConfig {
  patterns: ThreatPattern[];
  enableRealTimeDetection: boolean;
  alertThresholds: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

// ============================================================================
// Security Error Types
// ============================================================================

export enum VesperaSecurityErrorCode {
  RATE_LIMIT_EXCEEDED = 3001,
  CONSENT_REQUIRED = 3002,
  CONSENT_WITHDRAWN = 3003,
  CONSENT_INVALID_PURPOSE = 3004,
  INPUT_SANITIZATION_FAILED = 3005,
  XSS_ATTACK_DETECTED = 3006,
  CSP_VIOLATION = 3007,
  UNAUTHORIZED_ACCESS = 3008,
  DATA_BREACH_DETECTED = 3009,
  THREAT_DETECTED = 3010,
  CIRCUIT_BREAKER_OPEN = 3011
}

export interface SecurityMetrics {
  rateLimiting: {
    requestsBlocked: number;
    circuitBreakerActivations: number;
    averageTokenConsumption: number;
  };
  consent: {
    activeConsents: number;
    withdrawalEvents: number;
    complianceScore: number;
  };
  sanitization: {
    threatsBlocked: number;
    cspViolations: number;
    sanitizationEvents: number;
  };
}

// ============================================================================
// Service Interfaces
// ============================================================================

export interface VesperaRateLimiterInterface extends vscode.Disposable {
  checkRateLimit(context: RateLimitContext): Promise<RateLimitResult>;
  getStats(): {
    totalBuckets: number;
    totalRequests: number;
    totalRejections: number;
    bucketStats: Array<{ key: string; stats: TokenBucketState & { 
      capacity: number; 
      refillRate: number;
      rejectionRate: number;
    } }>;
  };
}

export interface VesperaConsentManagerInterface extends vscode.Disposable {
  hasConsent(userId: string, purposeId: string): boolean;
  requestConsent(userId: string, purposeIds: string[], context?: Record<string, any>): Promise<ConsentRecord>;
  withdrawConsent(userId: string, purposeIds: string[]): Promise<void>;
  getUserConsents(userId: string): ConsentRecord[];
  exportUserData(userId: string): Promise<{
    consents: ConsentRecord[];
    purposes: ConsentPurpose[];
    auditTrail: ConsentRecord[];
  }>;
}

export interface VesperaInputSanitizerInterface extends vscode.Disposable {
  sanitize(input: any, scope: SanitizationScope, context?: Record<string, any>): Promise<SanitizationResult>;
  generateCSPPolicy(options: {
    context: string;
    allowedSources?: string[];
    strictMode?: boolean;
  }): string;
  validateMessage(message: any, schemaId: string): Promise<boolean>;
}

export interface SecurityAuditLoggerInterface extends vscode.Disposable {
  logSecurityEvent(event: VesperaSecurityEvent, context: SecurityEventContext): Promise<void>;
  getSecurityMetrics(): Promise<SecurityMetrics>;
  exportAuditLog(startTime: number, endTime: number): Promise<any[]>;
}