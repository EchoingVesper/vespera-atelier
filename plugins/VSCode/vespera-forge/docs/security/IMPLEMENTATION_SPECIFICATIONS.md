# Vespera Forge Security Implementation Specifications

**Version**: 1.0  
**Date**: September 2025  
**Author**: Security Architecture Agent  

## 1. Implementation Overview

This document provides detailed implementation specifications for the Vespera Forge security architecture, including TypeScript interfaces, class definitions, configuration schemas, and integration patterns.

## 2. Core Security Types and Interfaces

### 2.1 Base Security Types

```typescript
// src/core/types/security.ts

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

// Security event types
export enum VesperaSecurityEvent {
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  CONSENT_GRANTED = 'consent_granted',
  CONSENT_WITHDRAWN = 'consent_withdrawn',
  THREAT_DETECTED = 'threat_detected',
  CSP_VIOLATION = 'csp_violation',
  SANITIZATION_APPLIED = 'sanitization_applied',
  SECURITY_BREACH = 'security_breach'
}

export interface SecurityEventContext {
  timestamp: number;
  userId?: string;
  resourceId?: string;
  threat?: ThreatInfo;
  metadata?: Record<string, any>;
}

export interface ThreatInfo {
  type: 'xss' | 'injection' | 'csrf' | 'dos' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  patterns: string[];
  blocked: boolean;
}
```

## 3. Rate Limiting Implementation

### 3.1 Token Bucket Implementation

```typescript
// src/core/security/rate-limiting/TokenBucket.ts

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

export class TokenBucket implements vscode.Disposable {
  private state: TokenBucketState;
  private refillTimer?: NodeJS.Timeout;
  private readonly logger: VesperaLogger;

  constructor(
    private config: TokenBucketConfig,
    logger: VesperaLogger
  ) {
    this.logger = logger.createChild('TokenBucket');
    this.state = {
      tokens: config.initialTokens ?? config.capacity,
      lastRefill: Date.now(),
      totalRequests: 0,
      rejectedRequests: 0,
      burstTokensUsed: 0
    };

    this.startRefillTimer();
  }

  /**
   * Attempt to consume tokens
   * @param tokens Number of tokens to consume (default: 1)
   * @returns true if tokens were consumed, false if insufficient
   */
  consume(tokens: number = 1): boolean {
    this.state.totalRequests++;
    
    // Refill tokens if necessary
    this.refill();

    // Check if we have enough tokens (including burst allowance)
    const availableTokens = this.state.tokens + 
      Math.max(0, (this.config.burstAllowance || 0) - this.state.burstTokensUsed);

    if (availableTokens >= tokens) {
      // Consume from main bucket first, then burst
      const mainTokensUsed = Math.min(tokens, this.state.tokens);
      const burstTokensUsed = tokens - mainTokensUsed;

      this.state.tokens -= mainTokensUsed;
      this.state.burstTokensUsed += burstTokensUsed;

      this.logger.debug('Tokens consumed', { 
        requested: tokens, 
        mainUsed: mainTokensUsed,
        burstUsed: burstTokensUsed,
        remaining: this.state.tokens 
      });

      return true;
    }

    this.state.rejectedRequests++;
    this.logger.debug('Token consumption rejected', { 
      requested: tokens, 
      available: availableTokens,
      rejectionRate: this.state.rejectedRequests / this.state.totalRequests 
    });

    return false;
  }

  /**
   * Get current bucket statistics
   */
  getStats(): TokenBucketState & { 
    capacity: number; 
    refillRate: number;
    rejectionRate: number;
  } {
    return {
      ...this.state,
      capacity: this.config.capacity,
      refillRate: this.config.refillRate,
      rejectionRate: this.state.totalRequests > 0 
        ? this.state.rejectedRequests / this.state.totalRequests 
        : 0
    };
  }

  private refill(): void {
    const now = Date.now();
    const timeSinceRefill = now - this.state.lastRefill;
    const tokensToAdd = Math.floor((timeSinceRefill / 1000) * this.config.refillRate);

    if (tokensToAdd > 0) {
      this.state.tokens = Math.min(
        this.config.capacity, 
        this.state.tokens + tokensToAdd
      );
      
      // Recover burst allowance over time
      const burstRecovery = Math.floor(tokensToAdd * 0.1); // 10% of refill goes to burst recovery
      this.state.burstTokensUsed = Math.max(0, this.state.burstTokensUsed - burstRecovery);
      
      this.state.lastRefill = now;
    }
  }

  private startRefillTimer(): void {
    this.refillTimer = setInterval(() => {
      this.refill();
    }, this.config.refillInterval);
  }

  dispose(): void {
    if (this.refillTimer) {
      clearInterval(this.refillTimer);
      this.refillTimer = undefined;
    }
  }
}
```

### 3.2 Rate Limiter Service

```typescript
// src/core/security/rate-limiting/VesperaRateLimiter.ts

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

export class VesperaRateLimiter implements vscode.Disposable {
  private static instance: VesperaRateLimiter;
  
  private buckets = new Map<string, TokenBucket>();
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private rules: RateLimitRule[] = [];
  
  private constructor(
    private contextManager: VesperaContextManager,
    private logger: VesperaLogger,
    private errorHandler: VesperaErrorHandler,
    private config: RateLimitingConfiguration
  ) {
    this.rules = config.rules.sort((a, b) => b.priority - a.priority);
    this.logger = logger.createChild('RateLimiter');
  }

  public static async initialize(config: {
    contextManager: VesperaContextManager;
    logger: VesperaLogger;
    errorHandler: VesperaErrorHandler;
    rules: RateLimitRule[];
  }): Promise<VesperaRateLimiter> {
    if (!VesperaRateLimiter.instance) {
      VesperaRateLimiter.instance = new VesperaRateLimiter(
        config.contextManager,
        config.logger,
        config.errorHandler,
        { enabled: true, rules: config.rules, globalDefaults: DEFAULT_TOKEN_BUCKET_CONFIG }
      );
    }
    return VesperaRateLimiter.instance;
  }

  /**
   * Check rate limit for a resource
   */
  async checkRateLimit(context: RateLimitContext): Promise<RateLimitResult> {
    // Find matching rule
    const rule = this.findMatchingRule(context.resourceId);
    if (!rule || !rule.enabled) {
      return { allowed: true, actions: [] };
    }

    // Check circuit breaker first
    const circuitBreaker = this.getCircuitBreaker(rule.id);
    if (circuitBreaker && !circuitBreaker.isRequestAllowed()) {
      return {
        allowed: false,
        rule,
        retryAfter: circuitBreaker.getRetryAfter(),
        actions: [{ type: 'circuit-break', threshold: 0 }]
      };
    }

    // Get or create bucket
    const bucketKey = this.generateBucketKey(rule, context);
    const bucket = this.getOrCreateBucket(bucketKey, rule.bucket);

    // Attempt to consume token
    const allowed = bucket.consume(1);
    const stats = bucket.getStats();

    if (!allowed) {
      // Handle rate limit exceeded
      await this.handleRateLimitExceeded(rule, context, stats);
      
      return {
        allowed: false,
        rule,
        remainingTokens: stats.tokens,
        retryAfter: this.calculateRetryAfter(rule.bucket),
        actions: this.determineActions(rule, stats)
      };
    }

    return {
      allowed: true,
      rule,
      remainingTokens: stats.tokens,
      actions: []
    };
  }

  private findMatchingRule(resourceId: string): RateLimitRule | undefined {
    return this.rules.find(rule => {
      if (typeof rule.pattern === 'string') {
        return resourceId.includes(rule.pattern);
      } else {
        return rule.pattern.test(resourceId);
      }
    });
  }

  private generateBucketKey(rule: RateLimitRule, context: RateLimitContext): string {
    switch (rule.scope) {
      case 'global':
        return `global:${rule.id}`;
      case 'user':
        return `user:${context.userId || 'anonymous'}:${rule.id}`;
      case 'session':
        return `session:${context.sessionId || 'default'}:${rule.id}`;
      case 'resource':
        return `resource:${context.resourceId}:${rule.id}`;
      default:
        return `default:${rule.id}`;
    }
  }

  private getOrCreateBucket(key: string, config: TokenBucketConfig): TokenBucket {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = new TokenBucket(config, this.logger);
      this.buckets.set(key, bucket);
      
      // Register for cleanup
      this.contextManager.registerResource(
        bucket,
        'TokenBucket',
        `token-bucket-${key}`
      );
    }
    return bucket;
  }

  private getCircuitBreaker(ruleId: string): CircuitBreaker | undefined {
    return this.circuitBreakers.get(ruleId);
  }

  private calculateRetryAfter(config: TokenBucketConfig): number {
    return Math.ceil(1000 / config.refillRate); // Time to get one token
  }

  private determineActions(rule: RateLimitRule, stats: TokenBucketState): RateLimitAction[] {
    const rejectionRate = stats.rejectedRequests / stats.totalRequests;
    
    return rule.actions.filter(action => {
      return rejectionRate >= (action.threshold / 100);
    });
  }

  private async handleRateLimitExceeded(
    rule: RateLimitRule, 
    context: RateLimitContext, 
    stats: TokenBucketState
  ): Promise<void> {
    this.logger.warn('Rate limit exceeded', {
      rule: rule.id,
      resource: context.resourceId,
      stats
    });

    // Trigger security event
    await this.errorHandler.handleError(new VesperaSecurityError(
      `Rate limit exceeded for ${context.resourceId}`,
      VesperaSecurityErrorCode.RATE_LIMIT_EXCEEDED,
      VesperaSeverity.MEDIUM,
      { 
        context: { 
          rule: rule.id, 
          resourceId: context.resourceId,
          rejectionRate: stats.rejectedRequests / stats.totalRequests
        } 
      }
    ));

    // Update circuit breaker if configured
    const circuitBreaker = this.circuitBreakers.get(rule.id);
    if (circuitBreaker) {
      circuitBreaker.recordFailure();
    }
  }

  /**
   * Get rate limiting statistics
   */
  getStats(): {
    totalBuckets: number;
    totalRequests: number;
    totalRejections: number;
    bucketStats: Array<{ key: string; stats: ReturnType<TokenBucket['getStats']> }>;
  } {
    let totalRequests = 0;
    let totalRejections = 0;
    const bucketStats: Array<{ key: string; stats: ReturnType<TokenBucket['getStats']> }> = [];

    for (const [key, bucket] of this.buckets.entries()) {
      const stats = bucket.getStats();
      totalRequests += stats.totalRequests;
      totalRejections += stats.rejectedRequests;
      bucketStats.push({ key, stats });
    }

    return {
      totalBuckets: this.buckets.size,
      totalRequests,
      totalRejections,
      bucketStats
    };
  }

  dispose(): void {
    for (const bucket of this.buckets.values()) {
      bucket.dispose();
    }
    this.buckets.clear();
    
    for (const breaker of this.circuitBreakers.values()) {
      breaker.dispose();
    }
    this.circuitBreakers.clear();
  }
}
```

### 3.3 Circuit Breaker Implementation

```typescript
// src/core/security/rate-limiting/CircuitBreaker.ts

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

export class CircuitBreaker implements vscode.Disposable {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failures = 0;
  private lastFailureTime = 0;
  private halfOpenCalls = 0;
  private readonly logger: VesperaLogger;

  constructor(
    private config: CircuitBreakerConfig,
    logger: VesperaLogger
  ) {
    this.logger = logger.createChild('CircuitBreaker');
  }

  isRequestAllowed(): boolean {
    const now = Date.now();

    switch (this.state) {
      case CircuitBreakerState.CLOSED:
        return true;

      case CircuitBreakerState.OPEN:
        if (now - this.lastFailureTime >= this.config.recoveryTimeout) {
          this.state = CircuitBreakerState.HALF_OPEN;
          this.halfOpenCalls = 0;
          this.logger.info('Circuit breaker transitioning to half-open');
          return true;
        }
        return false;

      case CircuitBreakerState.HALF_OPEN:
        return this.halfOpenCalls < this.config.halfOpenMaxCalls;

      default:
        return false;
    }
  }

  recordSuccess(): void {
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.halfOpenCalls++;
      if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        this.state = CircuitBreakerState.CLOSED;
        this.failures = 0;
        this.logger.info('Circuit breaker closed after successful recovery');
      }
    } else if (this.state === CircuitBreakerState.CLOSED) {
      this.failures = Math.max(0, this.failures - 1); // Gradual recovery
    }
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitBreakerState.CLOSED && 
        this.failures >= this.config.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
      this.logger.warn('Circuit breaker opened', { failures: this.failures });
    } else if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.OPEN;
      this.logger.warn('Circuit breaker returned to open from half-open');
    }
  }

  getRetryAfter(): number {
    if (this.state === CircuitBreakerState.OPEN) {
      const elapsed = Date.now() - this.lastFailureTime;
      return Math.max(0, this.config.recoveryTimeout - elapsed);
    }
    return 0;
  }

  getState(): {
    state: CircuitBreakerState;
    failures: number;
    lastFailureTime: number;
    halfOpenCalls: number;
  } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      halfOpenCalls: this.halfOpenCalls
    };
  }

  dispose(): void {
    // Clean up any resources if needed
  }
}
```

## 4. Consent Management Implementation

### 4.1 Consent Data Models

```typescript
// src/core/security/consent/ConsentModels.ts

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
```

### 4.2 Consent Manager Service

```typescript
// src/core/security/consent/VesperaConsentManager.ts

export class VesperaConsentManager implements vscode.Disposable {
  private static instance: VesperaConsentManager;
  
  private consentStore: ConsentStore;
  private consentUI: ConsentUI;
  private purposeRegistry: Map<string, ConsentPurpose> = new Map();
  private activeConsents: Map<string, ConsentRecord> = new Map();
  
  private constructor(
    private storage: vscode.Memento,
    private logger: VesperaLogger,
    private config: ConsentConfiguration
  ) {
    this.logger = logger.createChild('ConsentManager');
    this.consentStore = new ConsentStore(storage, logger, config.encryption);
    this.consentUI = new ConsentUI(config.uiMode, logger);
    
    this.initializePurposes(config.purposes);
  }

  public static async initialize(config: {
    storage: vscode.Memento;
    logger: VesperaLogger;
    purposes: ConsentPurpose[];
  }): Promise<VesperaConsentManager> {
    if (!VesperaConsentManager.instance) {
      const consentConfig: ConsentConfiguration = {
        enabled: true,
        purposes: config.purposes,
        uiMode: 'hybrid',
        retention: {
          activeConsentDays: 365,
          auditLogDays: 2555 // 7 years for GDPR compliance
        },
        encryption: {
          enabled: true,
          algorithm: 'AES-256-GCM'
        }
      };
      
      VesperaConsentManager.instance = new VesperaConsentManager(
        config.storage,
        config.logger,
        consentConfig
      );
      
      await VesperaConsentManager.instance.loadExistingConsents();
    }
    return VesperaConsentManager.instance;
  }

  /**
   * Check if consent is granted for a specific purpose
   */
  hasConsent(userId: string, purposeId: string): boolean {
    const consentKey = `${userId}:${purposeId}`;
    const consent = this.activeConsents.get(consentKey);
    
    if (!consent || consent.status !== ConsentStatus.ACTIVE) {
      return false;
    }
    
    // Check expiry
    if (consent.expiresAt && consent.expiresAt < Date.now()) {
      this.expireConsent(consent.id);
      return false;
    }
    
    // Find the specific purpose grant
    const purposeGrant = consent.purposes.find(p => p.purposeId === purposeId);
    return purposeGrant?.granted === true;
  }

  /**
   * Request consent for specific purposes
   */
  async requestConsent(
    userId: string, 
    purposeIds: string[],
    context?: Record<string, any>
  ): Promise<ConsentRecord> {
    this.logger.info('Requesting consent', { userId, purposeIds });
    
    // Validate purposes
    const purposes = purposeIds.map(id => this.purposeRegistry.get(id))
      .filter((p): p is ConsentPurpose => p !== undefined);
    
    if (purposes.length !== purposeIds.length) {
      throw new VesperaSecurityError(
        'Invalid consent purposes requested',
        VesperaSecurityErrorCode.CONSENT_INVALID_PURPOSE,
        VesperaSeverity.HIGH,
        { context: { requestedPurposes: purposeIds } }
      );
    }
    
    // Show consent UI and wait for user response
    const userResponse = await this.consentUI.requestConsent(purposes, context);
    
    // Create consent record
    const consentRecord: ConsentRecord = {
      id: this.generateConsentId(),
      userId,
      purposes: userResponse.purposes.map(p => ({
        purposeId: p.id,
        granted: p.granted,
        timestamp: Date.now(),
        conditions: p.conditions
      })),
      timestamp: Date.now(),
      version: '1.0',
      source: ConsentSource.EXPLICIT,
      evidence: this.createEvidence(ConsentMethod.UI_INTERACTION, context),
      status: ConsentStatus.ACTIVE,
      expiresAt: this.calculateExpiryDate(purposes)
    };
    
    // Store consent
    await this.storeConsent(consentRecord);
    
    // Update active consents cache
    this.updateActiveConsents(consentRecord);
    
    return consentRecord;
  }

  /**
   * Withdraw consent for specific purposes
   */
  async withdrawConsent(userId: string, purposeIds: string[]): Promise<void> {
    this.logger.info('Withdrawing consent', { userId, purposeIds });
    
    for (const purposeId of purposeIds) {
      const consentKey = `${userId}:${purposeId}`;
      const consent = this.activeConsents.get(consentKey);
      
      if (consent) {
        // Update consent status
        consent.status = ConsentStatus.WITHDRAWN;
        
        // Create withdrawal record
        const withdrawalRecord: ConsentRecord = {
          ...consent,
          id: this.generateConsentId(),
          timestamp: Date.now(),
          evidence: this.createEvidence(ConsentMethod.UI_INTERACTION, { 
            action: 'withdrawal',
            originalConsentId: consent.id 
          })
        };
        
        await this.storeConsent(withdrawalRecord);
        this.activeConsents.delete(consentKey);
        
        // Trigger data deletion if required
        await this.handleDataDeletion(userId, purposeId);
      }
    }
  }

  /**
   * Get all active consents for a user
   */
  getUserConsents(userId: string): ConsentRecord[] {
    return Array.from(this.activeConsents.values())
      .filter(consent => consent.userId === userId && consent.status === ConsentStatus.ACTIVE);
  }

  /**
   * Export user data for GDPR compliance
   */
  async exportUserData(userId: string): Promise<{
    consents: ConsentRecord[];
    purposes: ConsentPurpose[];
    auditTrail: ConsentRecord[];
  }> {
    const userConsents = this.getUserConsents(userId);
    const auditTrail = await this.consentStore.getAuditTrail(userId);
    const relevantPurposes = Array.from(this.purposeRegistry.values())
      .filter(purpose => 
        userConsents.some(consent => 
          consent.purposes.some(p => p.purposeId === purpose.id)
        )
      );
    
    return {
      consents: userConsents,
      purposes: relevantPurposes,
      auditTrail
    };
  }

  private initializePurposes(purposes: ConsentPurpose[]): void {
    for (const purpose of purposes) {
      this.purposeRegistry.set(purpose.id, purpose);
    }
    this.logger.debug('Initialized consent purposes', { count: purposes.length });
  }

  private async loadExistingConsents(): Promise<void> {
    const storedConsents = await this.consentStore.loadAllConsents();
    
    for (const consent of storedConsents) {
      if (consent.status === ConsentStatus.ACTIVE && 
          (!consent.expiresAt || consent.expiresAt > Date.now())) {
        this.updateActiveConsents(consent);
      }
    }
    
    this.logger.info('Loaded existing consents', { count: this.activeConsents.size });
  }

  private updateActiveConsents(consent: ConsentRecord): void {
    for (const purpose of consent.purposes) {
      if (purpose.granted) {
        const key = `${consent.userId}:${purpose.purposeId}`;
        this.activeConsents.set(key, consent);
      }
    }
  }

  private async storeConsent(consent: ConsentRecord): Promise<void> {
    await this.consentStore.store(consent);
    this.logger.debug('Consent stored', { consentId: consent.id });
  }

  private generateConsentId(): string {
    return `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createEvidence(method: ConsentMethod, metadata?: Record<string, any>): ConsentEvidence {
    const evidence = {
      userAgent: 'VS Code Extension',
      timestamp: Date.now(),
      method,
      metadata: metadata || {},
      checksum: ''
    };
    
    evidence.checksum = this.calculateChecksum(evidence);
    return evidence;
  }

  private calculateChecksum(evidence: Omit<ConsentEvidence, 'checksum'>): string {
    const data = JSON.stringify(evidence);
    // Simple checksum - in production, use proper cryptographic hash
    return Buffer.from(data).toString('base64').substr(0, 16);
  }

  private calculateExpiryDate(purposes: ConsentPurpose[]): number | undefined {
    const maxRetention = Math.max(...purposes.map(p => p.retentionPeriod));
    return maxRetention > 0 ? Date.now() + maxRetention : undefined;
  }

  private async expireConsent(consentId: string): Promise<void> {
    const consent = Array.from(this.activeConsents.values())
      .find(c => c.id === consentId);
    
    if (consent) {
      consent.status = ConsentStatus.EXPIRED;
      await this.storeConsent(consent);
      
      // Remove from active consents
      for (const purpose of consent.purposes) {
        const key = `${consent.userId}:${purpose.purposeId}`;
        this.activeConsents.delete(key);
      }
      
      this.logger.info('Consent expired', { consentId });
    }
  }

  private async handleDataDeletion(userId: string, purposeId: string): Promise<void> {
    const purpose = this.purposeRegistry.get(purposeId);
    if (purpose && purpose.category !== ConsentCategory.ESSENTIAL) {
      // Trigger data deletion workflow
      this.logger.info('Triggering data deletion', { userId, purposeId });
      // Implementation would depend on specific data storage systems
    }
  }

  dispose(): void {
    this.consentUI.dispose();
    this.consentStore.dispose();
    this.activeConsents.clear();
  }
}
```

## 5. Input Sanitization Implementation

### 5.1 Core Sanitization Service

```typescript
// src/core/security/sanitization/VesperaInputSanitizer.ts

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

export class VesperaInputSanitizer implements vscode.Disposable {
  private static instance: VesperaInputSanitizer;
  
  private rules: Map<SanitizationScope, SanitizationRule[]> = new Map();
  private domPurifyAdapter: DOMPurifyAdapter;
  private schemaValidator: SchemaValidator;
  private cspManager: CSPManager;
  
  private constructor(
    private logger: VesperaLogger,
    private errorHandler: VesperaErrorHandler,
    private config: SanitizationConfiguration
  ) {
    this.logger = logger.createChild('InputSanitizer');
    this.domPurifyAdapter = new DOMPurifyAdapter(logger);
    this.schemaValidator = new SchemaValidator(logger);
    this.cspManager = new CSPManager(config.csp, logger);
    
    this.initializeRules(config.rules);
  }

  public static async initialize(config: {
    logger: VesperaLogger;
    errorHandler: VesperaErrorHandler;
    rules: SanitizationRule[];
  }): Promise<VesperaInputSanitizer> {
    if (!VesperaInputSanitizer.instance) {
      const sanitizationConfig: SanitizationConfiguration = {
        enabled: true,
        rules: config.rules,
        strictMode: true,
        csp: DEFAULT_CSP_CONFIG,
        threatDetection: DEFAULT_THREAT_DETECTION_CONFIG
      };
      
      VesperaInputSanitizer.instance = new VesperaInputSanitizer(
        config.logger,
        config.errorHandler,
        sanitizationConfig
      );
    }
    return VesperaInputSanitizer.instance;
  }

  /**
   * Sanitize input based on scope and rules
   */
  async sanitize(
    input: any,
    scope: SanitizationScope,
    context?: Record<string, any>
  ): Promise<SanitizationResult> {
    const startTime = Date.now();
    const rules = this.getRulesForScope(scope);
    
    let sanitized = input;
    const threats: DetectedThreat[] = [];
    const applied: string[] = [];
    let blocked = false;

    this.logger.debug('Starting sanitization', { scope, rulesCount: rules.length });

    // Apply rules in priority order
    for (const rule of rules) {
      if (!rule.enabled) continue;

      try {
        // Detect threats first
        const detectedThreats = this.detectThreats(sanitized, rule.threatPatterns, scope.toString());
        threats.push(...detectedThreats);

        // Check if we should block based on threats
        const criticalThreats = detectedThreats.filter(t => t.severity === ThreatSeverity.CRITICAL);
        if (criticalThreats.length > 0 && this.config.strictMode) {
          blocked = true;
          this.logger.warn('Input blocked due to critical threats', { 
            threats: criticalThreats.length,
            rule: rule.id 
          });
          break;
        }

        // Apply processors
        for (const processor of rule.processors) {
          sanitized = await this.applyProcessor(sanitized, processor, scope, context);
          applied.push(`${rule.id}:${processor.type}`);
        }

      } catch (error) {
        this.logger.error('Sanitization rule failed', error, { rule: rule.id });
        await this.errorHandler.handleError(new VesperaSecurityError(
          `Sanitization rule ${rule.id} failed`,
          VesperaSecurityErrorCode.INPUT_SANITIZATION_FAILED,
          VesperaSeverity.HIGH,
          { context: { rule: rule.id, scope, error: error.message } }
        ));
      }
    }

    const result: SanitizationResult = {
      original: input,
      sanitized: blocked ? null : sanitized,
      threats,
      applied,
      blocked
    };

    // Log sanitization event
    await this.logSanitizationEvent(scope, result, Date.now() - startTime);

    return result;
  }

  /**
   * Generate Content Security Policy for WebView
   */
  generateCSPPolicy(options: {
    context: string;
    allowedSources?: string[];
    strictMode?: boolean;
  }): string {
    return this.cspManager.generatePolicy(options);
  }

  /**
   * Validate message against schema
   */
  async validateMessage(message: any, schemaId: string): Promise<boolean> {
    try {
      return await this.schemaValidator.validate(message, schemaId);
    } catch (error) {
      this.logger.error('Message validation failed', error);
      return false;
    }
  }

  private initializeRules(rules: SanitizationRule[]): void {
    for (const rule of rules) {
      const scopeRules = this.rules.get(rule.scope) || [];
      scopeRules.push(rule);
      scopeRules.sort((a, b) => b.priority - a.priority);
      this.rules.set(rule.scope, scopeRules);
    }
    
    this.logger.info('Sanitization rules initialized', { 
      totalRules: rules.length,
      scopes: Array.from(this.rules.keys())
    });
  }

  private getRulesForScope(scope: SanitizationScope): SanitizationRule[] {
    return this.rules.get(scope) || [];
  }

  private detectThreats(
    input: any, 
    patterns: ThreatPattern[], 
    location: string
  ): DetectedThreat[] {
    const threats: DetectedThreat[] = [];
    const inputString = typeof input === 'string' ? input : JSON.stringify(input);

    for (const pattern of patterns) {
      const matches = this.findMatches(inputString, pattern.pattern);
      if (matches.length > 0) {
        threats.push({
          pattern,
          matches,
          severity: pattern.severity,
          location
        });
      }
    }

    return threats;
  }

  private findMatches(input: string, pattern: string | RegExp): string[] {
    if (typeof pattern === 'string') {
      return input.includes(pattern) ? [pattern] : [];
    } else {
      const matches = input.match(pattern);
      return matches ? Array.from(matches) : [];
    }
  }

  private async applyProcessor(
    input: any,
    processor: SanitizationProcessor,
    scope: SanitizationScope,
    context?: Record<string, any>
  ): Promise<any> {
    switch (processor.type) {
      case 'dompurify':
        return this.domPurifyAdapter.sanitize(input, processor.config.domPurify);
        
      case 'schema-validation':
        if (processor.config.schema) {
          const isValid = await this.schemaValidator.validate(input, processor.config.schema);
          if (!isValid) {
            throw new Error('Schema validation failed');
          }
        }
        return input;
        
      case 'regex-replace':
        return this.applyRegexReplace(input, processor.config.regexReplace);
        
      case 'encoding':
        return this.applyEncoding(input, processor.config.encoding);
        
      case 'custom':
        return this.applyCustomProcessor(input, processor.config.custom, context);
        
      default:
        this.logger.warn('Unknown processor type', { type: processor.type });
        return input;
    }
  }

  private applyRegexReplace(input: any, config?: ProcessorConfig['regexReplace']): any {
    if (!config || typeof input !== 'string') return input;

    let result = input;
    for (const { pattern, replacement, flags } of config.patterns) {
      const regex = typeof pattern === 'string' ? new RegExp(pattern, flags) : pattern;
      result = result.replace(regex, replacement);
    }
    return result;
  }

  private applyEncoding(input: any, config?: ProcessorConfig['encoding']): any {
    if (!config || typeof input !== 'string') return input;

    switch (config.type) {
      case 'html':
        return config.decode ? this.htmlDecode(input) : this.htmlEncode(input);
      case 'url':
        return config.decode ? decodeURIComponent(input) : encodeURIComponent(input);
      case 'base64':
        return config.decode ? 
          Buffer.from(input, 'base64').toString('utf8') : 
          Buffer.from(input, 'utf8').toString('base64');
      default:
        return input;
    }
  }

  private htmlEncode(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  private htmlDecode(input: string): string {
    return input
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'");
  }

  private async applyCustomProcessor(
    input: any, 
    config?: ProcessorConfig['custom'], 
    context?: Record<string, any>
  ): Promise<any> {
    if (!config) return input;

    // In a real implementation, this would load and execute custom sanitization functions
    this.logger.warn('Custom processor not implemented', { functionName: config.functionName });
    return input;
  }

  private async logSanitizationEvent(
    scope: SanitizationScope,
    result: SanitizationResult,
    processingTime: number
  ): Promise<void> {
    this.logger.info('Sanitization completed', {
      scope,
      threatsDetected: result.threats.length,
      processorsApplied: result.applied.length,
      blocked: result.blocked,
      processingTime
    });

    if (result.threats.length > 0) {
      await this.errorHandler.handleError(new VesperaSecurityError(
        `Threats detected during sanitization`,
        VesperaSecurityErrorCode.THREAT_DETECTED,
        this.getSeverityFromThreats(result.threats),
        {
          context: {
            scope,
            threats: result.threats.map(t => ({
              type: t.pattern.type,
              severity: t.severity,
              matchCount: t.matches.length
            }))
          }
        }
      ));
    }
  }

  private getSeverityFromThreats(threats: DetectedThreat[]): VesperaSeverity {
    const maxSeverity = Math.max(...threats.map(t => {
      switch (t.severity) {
        case ThreatSeverity.LOW: return 1;
        case ThreatSeverity.MEDIUM: return 2;
        case ThreatSeverity.HIGH: return 3;
        case ThreatSeverity.CRITICAL: return 4;
        default: return 0;
      }
    }));

    switch (maxSeverity) {
      case 4: return VesperaSeverity.CRITICAL;
      case 3: return VesperaSeverity.HIGH;
      case 2: return VesperaSeverity.MEDIUM;
      case 1: return VesperaSeverity.LOW;
      default: return VesperaSeverity.LOW;
    }
  }

  dispose(): void {
    this.domPurifyAdapter.dispose();
    this.schemaValidator.dispose();
    this.cspManager.dispose();
    this.rules.clear();
  }
}
```

## 6. Configuration Integration

### 6.1 Enhanced Configuration Schema

```typescript
// src/core/types/configuration.ts

export interface VesperaForgeConfiguration {
  // Existing configuration
  enableAutoStart: boolean;
  rustBinderyPath: string;
  chat: ChatConfiguration;
  
  // New security configuration
  security: SecurityConfiguration;
}

// Update package.json configuration schema
const PACKAGE_JSON_CONFIGURATION = {
  "configuration": {
    "title": "Vespera Forge",
    "properties": {
      // ... existing properties
      
      "vesperaForge.security.enabled": {
        "type": "boolean",
        "default": true,
        "description": "Enable security features"
      },
      "vesperaForge.security.rateLimiting.enabled": {
        "type": "boolean", 
        "default": true,
        "description": "Enable rate limiting"
      },
      "vesperaForge.security.consent.enabled": {
        "type": "boolean",
        "default": true,
        "description": "Enable consent management"
      },
      "vesperaForge.security.sanitization.enabled": {
        "type": "boolean",
        "default": true,
        "description": "Enable input sanitization"
      },
      "vesperaForge.security.audit.enabled": {
        "type": "boolean",
        "default": true,
        "description": "Enable security audit logging"
      }
    }
  }
};
```

## 7. Integration with Existing Services

### 7.1 Enhanced Extension Activation

```typescript
// Updated src/extension.ts integration

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  try {
    // Initialize core services with security configuration
    const coreConfig: VesperaCoreServicesConfig & { security: SecurityConfiguration } = {
      logging: {
        level: isDevelopment() ? 1 : 2,
        enableConsole: true,
        enableVSCodeOutput: true,
        enableStructuredLogging: true
      },
      memoryMonitoring: {
        enabled: true,
        thresholdMB: 150,
        checkIntervalMs: 30000
      },
      telemetry: {
        enabled: true
      },
      security: {
        enabled: getConfig().get('security.enabled', true),
        rateLimiting: {
          enabled: getConfig().get('security.rateLimiting.enabled', true),
          rules: await loadRateLimitRules(),
          globalDefaults: DEFAULT_RATE_LIMIT_CONFIG
        },
        consent: {
          enabled: getConfig().get('security.consent.enabled', true),
          purposes: await loadConsentPurposes(),
          uiMode: 'hybrid',
          retention: {
            activeConsentDays: 365,
            auditLogDays: 2555
          },
          encryption: {
            enabled: true,
            algorithm: 'AES-256-GCM'
          }
        },
        sanitization: {
          enabled: getConfig().get('security.sanitization.enabled', true),
          rules: await loadSanitizationRules(),
          strictMode: true,
          csp: DEFAULT_CSP_CONFIG,
          threatDetection: DEFAULT_THREAT_DETECTION_CONFIG
        },
        audit: {
          enabled: getConfig().get('security.audit.enabled', true),
          retention: 90 * 24 * 60 * 60 * 1000, // 90 days
          includePII: false,
          exportFormat: 'json',
          realTimeAlerts: true
        }
      }
    };

    const coreServices = await SecurityEnhancedVesperaCoreServices.initialize(context, coreConfig);
    // ... rest of activation logic
  } catch (error) {
    // Enhanced error handling for security initialization failures
  }
}
```

## 8. Testing Specifications

### 8.1 Security Test Suite Structure

```typescript
// tests/security/SecurityTestSuite.ts

describe('Security Architecture', () => {
  let coreServices: SecurityEnhancedCoreServices;
  
  beforeEach(async () => {
    coreServices = await createTestSecurityServices();
  });
  
  afterEach(async () => {
    await coreServices.dispose();
  });

  describe('Rate Limiting', () => {
    it('should enforce token bucket limits', async () => {
      const rateLimiter = coreServices.rateLimiter;
      const context = { resourceId: 'test-resource', userId: 'test-user' };
      
      // Configure low limit for testing
      const rule: RateLimitRule = {
        id: 'test-rule',
        name: 'Test Rule',
        pattern: 'test-resource',
        scope: 'resource',
        bucket: { capacity: 2, refillRate: 1, refillInterval: 1000 },
        actions: [{ type: 'reject', threshold: 100 }],
        enabled: true,
        priority: 1
      };
      
      // Should allow first two requests
      let result = await rateLimiter.checkRateLimit(context);
      expect(result.allowed).toBe(true);
      
      result = await rateLimiter.checkRateLimit(context);
      expect(result.allowed).toBe(true);
      
      // Third request should be rejected
      result = await rateLimiter.checkRateLimit(context);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should trigger circuit breaker after sustained failures', async () => {
      // Test circuit breaker functionality
    });
  });

  describe('Consent Management', () => {
    it('should block processing without required consent', async () => {
      const consentManager = coreServices.consentManager;
      const userId = 'test-user';
      const purposeId = 'analytics';
      
      // Should not have consent initially
      expect(consentManager.hasConsent(userId, purposeId)).toBe(false);
      
      // Grant consent
      await consentManager.requestConsent(userId, [purposeId]);
      
      // Should now have consent
      expect(consentManager.hasConsent(userId, purposeId)).toBe(true);
    });

    it('should honor consent withdrawal immediately', async () => {
      // Test consent withdrawal
    });

    it('should expire consent after configured period', async () => {
      // Test consent expiration
    });
  });

  describe('Input Sanitization', () => {
    it('should prevent XSS attacks', async () => {
      const sanitizer = coreServices.inputSanitizer;
      const maliciousInput = '<script>alert("xss")</script>';
      
      const result = await sanitizer.sanitize(
        maliciousInput,
        SanitizationScope.WEBVIEW
      );
      
      expect(result.blocked || result.sanitized !== maliciousInput).toBe(true);
      expect(result.threats.length).toBeGreaterThan(0);
      expect(result.threats[0].pattern.type).toBe(ThreatType.XSS);
    });

    it('should validate configuration schemas', async () => {
      // Test schema validation
    });

    it('should enforce CSP policies', async () => {
      // Test CSP policy enforcement
    });
  });

  describe('Integration', () => {
    it('should integrate with existing error handling', async () => {
      // Test error handling integration
    });

    it('should maintain memory safety', async () => {
      // Test memory management
    });

    it('should provide comprehensive audit trails', async () => {
      // Test audit logging
    });
  });
});
```

This implementation specification provides a comprehensive foundation for integrating enterprise-grade security into the Vespera Forge VS Code extension while maintaining seamless compatibility with the existing VesperaCoreServices infrastructure.