/**
 * Security Test Utilities
 * 
 * Utility functions and mock objects for testing security components.
 * Provides test doubles and helpers for comprehensive security testing.
 */

import * as vscode from 'vscode';
import { VesperaLogger } from '../../core/logging/VesperaLogger';

// Security services
import { VesperaRateLimiter } from '../../core/security/rate-limiting/VesperaRateLimiter';
import { VesperaInputSanitizer } from '../../core/security/sanitization/VesperaInputSanitizer';

// Types
import {
  SecurityConfiguration,
  ConsentPurpose,
  ConsentRecord,
  ConsentSource,
  ConsentStatus,
  ConsentCategory,
  ConsentMethod,
  RateLimitRule,
  RateLimitContext,
  SanitizationRule,
  SanitizationScope,
  ThreatType,
  ThreatSeverity,
  ThreatAction,
  VesperaSecurityEvent,
  SecurityEventContext
} from '../../types/security';

import { 
  createDevelopmentSecurityConfig,
  createConsentPurpose,
  createRateLimitRule,
  createSanitizationRule
} from '../../core/security/SecurityDefaults';

// ============================================================================
// Mock Extension Context
// ============================================================================

export class MockExtensionContext implements vscode.ExtensionContext {
  readonly subscriptions: vscode.Disposable[] = [];
  readonly workspaceState = new MockMemento();
  readonly globalState = new MockMemento();
  readonly secrets = new MockSecretStorage();
  readonly extensionUri = vscode.Uri.file('/test/extension');
  readonly extensionPath = '/test/extension';
  readonly environmentVariableCollection = {} as any;
  readonly storageUri = vscode.Uri.file('/test/storage');
  readonly globalStorageUri = vscode.Uri.file('/test/global');
  readonly logUri = vscode.Uri.file('/test/logs');
  readonly extension = {} as any;
  readonly extensionMode = vscode.ExtensionMode.Test;
  readonly languageModelAccessInformation = {} as any;
  readonly storagePath = '/test/storage';
  readonly globalStoragePath = '/test/global';
  readonly logPath = '/test/logs';

  asAbsolutePath(relativePath: string): string {
    return `/test/extension/${relativePath}`;
  }
}

export class MockMemento implements vscode.Memento {
  private storage = new Map<string, any>();
  
  keys(): readonly string[] {
    return Array.from(this.storage.keys());
  }

  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  get<T>(key: string, defaultValue?: T): T | undefined {
    return this.storage.has(key) ? this.storage.get(key) : defaultValue;
  }

  async update(key: string, value: any): Promise<void> {
    if (value === undefined) {
      this.storage.delete(key);
    } else {
      this.storage.set(key, value);
    }
  }

  setKeysForSync(keys: readonly string[]): void {
    // Mock implementation - in real VS Code this would sync keys across instances
    // For testing, we just store the keys for potential future reference
    (this as any).__syncKeys = [...keys];
  }

  // Test helpers
  clear(): void {
    this.storage.clear();
  }

  getAll(): Record<string, any> {
    return Object.fromEntries(this.storage.entries());
  }
}

export class MockSecretStorage implements vscode.SecretStorage {
  private storage = new Map<string, string>();
  private _onDidChange = new vscode.EventEmitter<vscode.SecretStorageChangeEvent>();

  get onDidChange(): vscode.Event<vscode.SecretStorageChangeEvent> {
    return this._onDidChange.event;
  }

  async get(key: string): Promise<string | undefined> {
    return this.storage.get(key);
  }

  async store(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
    this._onDidChange.fire({ key });
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
    this._onDidChange.fire({ key });
  }

  dispose(): void {
    this._onDidChange.dispose();
  }

  // Test helpers
  clear(): void {
    this.storage.clear();
  }
}

// ============================================================================
// Mock Loggers and Services
// ============================================================================

export class MockLogger implements Pick<VesperaLogger, 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'createChild'> {
  public logs: Array<{ level: string; message: string; data?: any; error?: any }> = [];

  debug(message: string, data?: any): void {
    this.logs.push({ level: 'debug', message, data });
  }

  info(message: string, data?: any): void {
    this.logs.push({ level: 'info', message, data });
  }

  warn(message: string, messageOrData?: any, data?: any): void {
    this.logs.push({ level: 'warn', message, data: data || messageOrData });
  }

  error(message: string, error?: any, data?: any): void {
    this.logs.push({ level: 'error', message, error, data });
  }

  fatal(message: string, error?: any, data?: any): void {
    this.logs.push({ level: 'fatal', message, error, data });
  }

  createChild(_name: string): VesperaLogger {
    // For testing purposes, return this mock logger cast to VesperaLogger
    // This satisfies the interface requirement while preserving test functionality
    const child = new MockLogger();
    child.logs = this.logs; // Share logs with parent for testing
    return child as unknown as VesperaLogger;
  }

  // Test helpers
  clearLogs(): void {
    this.logs = [];
  }

  getLogsByLevel(level: string): typeof this.logs {
    return this.logs.filter(log => log.level === level);
  }

  hasLogWithMessage(message: string): boolean {
    return this.logs.some(log => log.message.includes(message));
  }
}

export class MockErrorHandler {
  public handledErrors: Array<{ error: Error; context?: any }> = [];

  async handleError(error: Error, context?: any): Promise<void> {
    this.handledErrors.push({ error, context });
  }

  // Test helpers
  clearErrors(): void {
    this.handledErrors = [];
  }

  getLastError(): { error: Error; context?: any } | undefined {
    return this.handledErrors[this.handledErrors.length - 1];
  }
}

export class MockContextManager {
  public resources = new Map<string, vscode.Disposable>();
  private disposed = false;

  registerResource(resource: vscode.Disposable, _name: string, id: string): void {
    this.resources.set(id, resource);
  }

  dispose(): void {
    for (const resource of this.resources.values()) {
      resource.dispose();
    }
    this.resources.clear();
    this.disposed = true;
  }

  // Test helpers
  isDisposed(): boolean {
    return this.disposed;
  }

  getResourceCount(): number {
    return this.resources.size;
  }
}

// ============================================================================
// Test Configuration Factories
// ============================================================================

export function createTestSecurityConfig(overrides: Partial<SecurityConfiguration> = {}): SecurityConfiguration {
  const baseConfig = createDevelopmentSecurityConfig();
  return {
    ...baseConfig,
    ...overrides,
    rateLimiting: overrides.rateLimiting ? 
      { ...baseConfig.rateLimiting, ...overrides.rateLimiting } : 
      baseConfig.rateLimiting,
    consent: overrides.consent ? 
      { ...baseConfig.consent, ...overrides.consent } : 
      baseConfig.consent,
    sanitization: overrides.sanitization ? 
      { ...baseConfig.sanitization, ...overrides.sanitization } : 
      baseConfig.sanitization,
    audit: overrides.audit ? 
      { ...baseConfig.audit, ...overrides.audit } : 
      baseConfig.audit
  };
}

export function createTestConsentPurposes(): ConsentPurpose[] {
  return [
    createConsentPurpose('test-essential', 'Test Essential', 'Essential test functionality', {
      category: ConsentCategory.ESSENTIAL,
      required: true,
      retentionDays: 30
    }),
    createConsentPurpose('test-analytics', 'Test Analytics', 'Test analytics data', {
      category: ConsentCategory.ANALYTICS,
      required: false,
      retentionDays: 90
    }),
    createConsentPurpose('test-optional', 'Test Optional', 'Optional test features', {
      category: ConsentCategory.FUNCTIONAL,
      required: false,
      retentionDays: 60
    })
  ];
}

export function createTestRateLimitRules(): RateLimitRule[] {
  return [
    createRateLimitRule('test-fast', 'Test Fast Limit', 'test.fast', {
      capacity: 5,
      refillRate: 1,
      refillInterval: 1000
    }, {
      priority: 100,
      actions: [{ type: 'reject', threshold: 90 }]
    }),
    createRateLimitRule('test-slow', 'Test Slow Limit', 'test.slow', {
      capacity: 100,
      refillRate: 10,
      refillInterval: 1000
    }, {
      priority: 50
    })
  ];
}

export function createTestSanitizationRules(): SanitizationRule[] {
  return [
    createSanitizationRule(
      'test-basic',
      'Test Basic Sanitization',
      SanitizationScope.USER_INPUT,
      [
        {
          type: 'regex-replace',
          config: {
            regexReplace: {
              patterns: [
                { pattern: /<script>/gi, replacement: '' },
                { pattern: /javascript:/gi, replacement: '' }
              ]
            }
          }
        }
      ],
      {
        priority: 100,
        threatPatterns: [
          {
            id: 'test-xss',
            type: ThreatType.XSS,
            pattern: /<script>/gi,
            severity: ThreatSeverity.HIGH,
            action: ThreatAction.BLOCK
          }
        ]
      }
    )
  ];
}

// ============================================================================
// Test Data Factories
// ============================================================================

export function createTestConsentRecord(overrides: Partial<ConsentRecord> = {}): ConsentRecord {
  return {
    id: `test_consent_${Date.now()}`,
    userId: 'test-user',
    purposes: [
      {
        purposeId: 'test-essential',
        granted: true,
        timestamp: Date.now()
      }
    ],
    timestamp: Date.now(),
    version: '1.0',
    source: ConsentSource.EXPLICIT,
    evidence: {
      userAgent: 'Test Agent',
      timestamp: Date.now(),
      method: ConsentMethod.UI_INTERACTION,
      metadata: {},
      checksum: 'test-checksum'
    },
    status: ConsentStatus.ACTIVE,
    ...overrides
  };
}

export function createTestRateLimitContext(overrides: Partial<RateLimitContext> = {}): RateLimitContext {
  return {
    resourceId: 'test.resource',
    userId: 'test-user',
    sessionId: 'test-session',
    metadata: {},
    ...overrides
  };
}

export function createTestSecurityEvent(
  event: VesperaSecurityEvent = VesperaSecurityEvent.THREAT_DETECTED,
  overrides: Partial<SecurityEventContext> = {}
): { event: VesperaSecurityEvent; context: SecurityEventContext } {
  return {
    event,
    context: {
      timestamp: Date.now(),
      userId: 'test-user',
      resourceId: 'test-resource',
      metadata: {},
      ...overrides
    }
  };
}

// ============================================================================
// Test Service Factories
// ============================================================================

export async function createTestSecurityServices(
  config: Partial<SecurityConfiguration> = {}
): Promise<{
  context: MockExtensionContext;
  logger: MockLogger;
  errorHandler: MockErrorHandler;
  contextManager: MockContextManager;
  securityConfig: SecurityConfiguration;
}> {
  const context = new MockExtensionContext();
  const logger = new MockLogger();
  const errorHandler = new MockErrorHandler();
  const contextManager = new MockContextManager();
  
  const securityConfig = createTestSecurityConfig({
    ...config,
    rateLimiting: {
      enabled: true,
      rules: createTestRateLimitRules(),
      globalDefaults: { capacity: 10, refillRate: 2, refillInterval: 1000 },
      ...config.rateLimiting
    },
    consent: {
      enabled: true,
      purposes: createTestConsentPurposes(),
      uiMode: 'hybrid',
      retention: { activeConsentDays: 30, auditLogDays: 90 },
      encryption: { enabled: false, algorithm: 'test' }, // Disable encryption for tests
      ...config.consent
    },
    sanitization: {
      enabled: true,
      rules: createTestSanitizationRules(),
      strictMode: false,
      csp: { defaultSrc: ["'self'"] } as any,
      threatDetection: { patterns: [], enableRealTimeDetection: false, alertThresholds: { low: 1, medium: 1, high: 1, critical: 1 } },
      ...config.sanitization
    }
  });

  return {
    context,
    logger,
    errorHandler,
    contextManager,
    securityConfig
  };
}

// ============================================================================
// Test Assertions and Matchers
// ============================================================================

export class SecurityTestAssertions {
  /**
   * Assert that a rate limit was exceeded
   */
  static assertRateLimitExceeded(logs: MockLogger['logs']): void {
    const rateLimitLogs = logs.filter(log => 
      log.message.includes('rate limit') || log.message.includes('Rate limit')
    );
    
    if (rateLimitLogs.length === 0) {
      throw new Error('Expected rate limit exceeded log, but none found');
    }
  }

  /**
   * Assert that a threat was detected
   */
  static assertThreatDetected(logs: MockLogger['logs'], threatType?: ThreatType): void {
    const threatLogs = logs.filter(log => 
      log.message.includes('threat') || log.message.includes('Threat')
    );
    
    if (threatLogs.length === 0) {
      throw new Error('Expected threat detection log, but none found');
    }

    if (threatType) {
      const specificThreatLogs = threatLogs.filter(log => 
        log.data?.threatType === threatType || 
        JSON.stringify(log.data).includes(threatType)
      );
      
      if (specificThreatLogs.length === 0) {
        throw new Error(`Expected ${threatType} threat detection log, but none found`);
      }
    }
  }

  /**
   * Assert that consent was properly managed
   */
  static assertConsentManaged(logs: MockLogger['logs'], action: 'granted' | 'withdrawn'): void {
    const consentLogs = logs.filter(log => 
      log.message.toLowerCase().includes('consent') && 
      log.message.toLowerCase().includes(action)
    );
    
    if (consentLogs.length === 0) {
      throw new Error(`Expected consent ${action} log, but none found`);
    }
  }

  /**
   * Assert that sanitization was applied
   */
  static assertSanitizationApplied(logs: MockLogger['logs']): void {
    const sanitizationLogs = logs.filter(log => 
      log.message.includes('sanitiz') || log.message.includes('Sanitiz')
    );
    
    if (sanitizationLogs.length === 0) {
      throw new Error('Expected sanitization log, but none found');
    }
  }

  /**
   * Assert that security audit event was logged
   */
  static assertSecurityEventLogged(logs: MockLogger['logs'], event: VesperaSecurityEvent): void {
    const securityEventLogs = logs.filter(log => 
      log.message.includes('Security event') || 
      log.data?.event === event
    );
    
    if (securityEventLogs.length === 0) {
      throw new Error(`Expected security event ${event} to be logged, but none found`);
    }
  }
}

// ============================================================================
// Performance Testing Utilities
// ============================================================================

export class SecurityPerformanceTestUtils {
  /**
   * Test rate limiter performance under load
   */
  static async testRateLimiterPerformance(
    rateLimiter: VesperaRateLimiter,
    requestCount: number,
    concurrency: number = 10
  ): Promise<{
    totalTime: number;
    averageResponseTime: number;
    successCount: number;
    rejectionCount: number;
    throughput: number;
  }> {
    const startTime = Date.now();
    const promises: Promise<any>[] = [];
    let successCount = 0;
    let rejectionCount = 0;

    // Create batches of concurrent requests
    const batchSize = concurrency;
    const batchCount = Math.ceil(requestCount / batchSize);

    for (let batch = 0; batch < batchCount; batch++) {
      const batchPromises: Promise<any>[] = [];
      const requestsInBatch = Math.min(batchSize, requestCount - (batch * batchSize));

      for (let i = 0; i < requestsInBatch; i++) {
        const promise = rateLimiter.checkRateLimit(
          createTestRateLimitContext({ resourceId: `test.performance.${batch}.${i}` })
        ).then(result => {
          if (result.allowed) {
            successCount++;
          } else {
            rejectionCount++;
          }
          return result;
        });
        
        batchPromises.push(promise);
      }

      promises.push(...batchPromises);
      
      // Wait for batch to complete before starting next batch
      await Promise.all(batchPromises);
    }

    const totalTime = Date.now() - startTime;
    const averageResponseTime = totalTime / requestCount;
    const throughput = requestCount / (totalTime / 1000); // requests per second

    return {
      totalTime,
      averageResponseTime,
      successCount,
      rejectionCount,
      throughput
    };
  }

  /**
   * Test input sanitizer performance
   */
  static async testSanitizerPerformance(
    sanitizer: VesperaInputSanitizer,
    inputs: string[],
    scope: SanitizationScope
  ): Promise<{
    totalTime: number;
    averageResponseTime: number;
    threatsDetected: number;
    inputsBlocked: number;
  }> {
    const startTime = Date.now();
    let threatsDetected = 0;
    let inputsBlocked = 0;

    const promises = inputs.map(async (input) => {
      const result = await sanitizer.sanitize(input, scope);
      threatsDetected += result.threats.length;
      if (result.blocked) inputsBlocked++;
      return result;
    });

    await Promise.all(promises);

    const totalTime = Date.now() - startTime;
    const averageResponseTime = totalTime / inputs.length;

    return {
      totalTime,
      averageResponseTime,
      threatsDetected,
      inputsBlocked
    };
  }
}

// ============================================================================
// Test Cleanup Utilities
// ============================================================================

export class SecurityTestCleanup {
  private disposables: vscode.Disposable[] = [];

  /**
   * Register a disposable for cleanup
   */
  register(disposable: vscode.Disposable): void {
    this.disposables.push(disposable);
  }

  /**
   * Clean up all registered disposables
   */
  async cleanup(): Promise<void> {
    for (const disposable of this.disposables) {
      try {
        await disposable.dispose();
      } catch (error) {
        console.warn('Error during test cleanup:', error);
      }
    }
    this.disposables = [];
  }
}

/**
 * Create a test cleanup utility for automatic resource management
 */
export function createSecurityTestCleanup(): SecurityTestCleanup {
  return new SecurityTestCleanup();
}