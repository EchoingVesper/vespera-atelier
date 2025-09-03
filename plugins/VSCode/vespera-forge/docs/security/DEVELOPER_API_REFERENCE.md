# Developer API Reference

**Version**: 1.0  
**Date**: September 2025  
**Status**: Production Ready  

## 📋 Overview

This comprehensive API reference provides detailed documentation for integrating with the Vespera Forge security infrastructure, including TypeScript interfaces, usage examples, and best practices.

## 🏗️ Core Architecture

### SecurityEnhancedVesperaCoreServices

The main entry point for all security functionality, extending the base `VesperaCoreServices` with security capabilities.

```typescript
interface SecurityEnhancedCoreServices extends VesperaCoreServices {
  security: VesperaSecurityManager;
  rateLimiter?: VesperaRateLimiterInterface;
  consentManager?: VesperaConsentManagerInterface;
  inputSanitizer?: VesperaInputSanitizerInterface;
  securityAuditLogger?: SecurityAuditLoggerInterface;
}
```

#### Initialization

```typescript
import { 
  SecurityEnhancedVesperaCoreServices,
  createDevelopmentSecurityConfig,
  createProductionSecurityConfig 
} from './core/security';

// Development initialization
const devServices = await SecurityEnhancedVesperaCoreServices.initialize(context, {
  base: baseCoreServicesConfig,
  security: createDevelopmentSecurityConfig()
});

// Production initialization  
const prodServices = await SecurityEnhancedVesperaCoreServices.initialize(context, {
  base: baseCoreServicesConfig,
  security: createProductionSecurityConfig()
});

// Custom configuration
const customServices = await SecurityEnhancedVesperaCoreServices.initialize(context, {
  base: baseCoreServicesConfig,
  security: {
    enabled: true,
    rateLimiting: {
      enabled: true,
      rules: customRateLimitRules,
      globalDefaults: customTokenBucketConfig
    },
    consent: {
      enabled: true,
      purposes: customConsentPurposes,
      uiMode: 'hybrid'
    }
  }
});
```

## 🚦 Rate Limiting API

### VesperaRateLimiter Interface

```typescript
interface VesperaRateLimiterInterface extends vscode.Disposable {
  checkRateLimit(context: RateLimitContext): Promise<RateLimitResult>;
  updateRules(rules: RateLimitRule[]): Promise<void>;
  getStats(): RateLimitStats;
  clearBucket(bucketId: string): Promise<void>;
}
```

### Rate Limiting Types

```typescript
interface RateLimitContext {
  resourceId: string;           // Resource identifier (e.g., 'api.chat.message')
  userId?: string;              // User identifier for user-scoped limits
  sessionId?: string;           // Session identifier for session-scoped limits
  metadata?: Record<string, any>; // Additional context data
}

interface RateLimitResult {
  allowed: boolean;             // Whether the request is allowed
  rule: RateLimitRule | null;   // The rule that was applied (if any)
  tokensRemaining: number;      // Remaining tokens in bucket
  retryAfter?: number;          // Milliseconds to wait before retry
  metadata?: {
    bucketId: string;           // Internal bucket identifier
    ruleId: string;             // Rule identifier that was matched
  };
}

interface RateLimitRule {
  id: string;                   // Unique rule identifier
  name: string;                 // Human-readable name
  pattern: string | RegExp;     // Resource pattern to match
  scope: 'global' | 'user' | 'session' | 'resource'; // Scope of rate limiting
  bucket: TokenBucketConfig;    // Token bucket configuration
  actions: RateLimitAction[];   // Actions to take at different thresholds
  enabled: boolean;             // Whether the rule is active
  priority: number;             // Rule evaluation priority (higher = first)
}
```

### Token Bucket Configuration

```typescript
interface TokenBucketConfig {
  capacity: number;             // Maximum tokens in bucket
  refillRate: number;          // Tokens added per refillInterval
  refillInterval: number;      // Milliseconds between refills
  initialTokens?: number;      // Starting token count
  burstAllowance?: number;     // Additional burst capacity
}
```

### Usage Examples

#### Basic Rate Limiting

```typescript
// Check if a user can send a chat message
const rateLimitResult = await coreServices.checkRateLimit({
  resourceId: 'chat.message',
  userId: getCurrentUserId()
});

if (rateLimitResult.allowed) {
  await processChatMessage(message);
} else {
  const waitTime = rateLimitResult.retryAfter || 1000;
  vscode.window.showWarningMessage(
    `Rate limit exceeded. Please wait ${waitTime}ms before trying again.`
  );
}
```

#### Custom Rate Limit Rules

```typescript
import { createRateLimitRule } from './core/security';

// Create a custom rule for file operations
const fileOperationRule = createRateLimitRule(
  'file-heavy-ops',
  'Heavy File Operations',
  /^file\.(create|delete|move)/,
  {
    capacity: 10,
    refillRate: 1, // 1 operation per second
    refillInterval: 1000
  },
  {
    scope: 'user',
    actions: [
      { type: 'log', threshold: 70 },
      { type: 'delay', threshold: 90, config: { delayMs: 2000 } },
      { type: 'reject', threshold: 95 }
    ],
    priority: 80
  }
);

// Update the rate limiter with the new rule
await coreServices.rateLimiter?.updateRules([fileOperationRule]);
```

#### Advanced Rate Limiting with Circuit Breaker

```typescript
// Rate limiting with automatic circuit breaker for external API calls
const apiCallRule = createRateLimitRule(
  'external-api',
  'External API Calls',
  /^api\.external/,
  {
    capacity: 100,
    refillRate: 10,
    refillInterval: 1000
  },
  {
    scope: 'global',
    actions: [
      { 
        type: 'circuit-break', 
        threshold: 90, 
        config: { 
          circuitBreakerDurationMs: 60000,
          failureThreshold: 5,
          recoveryTimeout: 30000
        } 
      }
    ]
  }
);
```

## ✅ Consent Management API

### VesperaConsentManager Interface

```typescript
interface VesperaConsentManagerInterface extends vscode.Disposable {
  requestConsent(purposes: string[]): Promise<ConsentUIResponse>;
  hasConsent(userId: string, purposeId: string): Promise<boolean>;
  grantConsent(userId: string, purposeId: string, evidence: ConsentEvidence): Promise<void>;
  withdrawConsent(userId: string, purposes?: string[]): Promise<void>;
  exportConsentData(userId: string): Promise<ConsentRecord[]>;
  getConsentHistory(userId: string, purposeId?: string): Promise<ConsentRecord[]>;
}
```

### Consent Types

```typescript
interface ConsentPurpose {
  id: string;                   // Unique purpose identifier
  name: string;                 // Display name
  description: string;          // Detailed description
  category: ConsentCategory;    // Purpose category
  required: boolean;            // Whether consent is required
  dataTypes: string[];          // Types of data processed
  retentionPeriod: number;      // Data retention period (ms)
  thirdParties: string[];       // Third parties with data access
  legalBasis: LegalBasis;       // Legal basis for processing
}

enum ConsentCategory {
  ESSENTIAL = 'essential',      // Essential functionality
  FUNCTIONAL = 'functional',    // Enhanced functionality
  ANALYTICS = 'analytics',      // Usage analytics
  MARKETING = 'marketing',      // Marketing communications
  PREFERENCES = 'preferences'   // User preferences
}

enum LegalBasis {
  CONSENT = 'consent',          // Article 6(1)(a) - Consent
  CONTRACT = 'contract',        // Article 6(1)(b) - Contract performance
  LEGAL_OBLIGATION = 'legal_obligation', // Article 6(1)(c) - Legal obligation
  VITAL_INTERESTS = 'vital_interests',   // Article 6(1)(d) - Vital interests
  PUBLIC_TASK = 'public_task',          // Article 6(1)(e) - Public task
  LEGITIMATE_INTERESTS = 'legitimate_interests' // Article 6(1)(f) - Legitimate interests
}

interface ConsentRecord {
  id: string;
  userId: string;
  purposeId: string;
  granted: boolean;
  timestamp: number;
  expiresAt?: number;
  evidence: ConsentEvidence;
  conditions?: ConsentConditions;
}

interface ConsentEvidence {
  method: ConsentMethod;        // How consent was obtained
  ipAddress?: string;           // IP address when consent given
  userAgent?: string;           // User agent string
  consentString?: string;       // Consent record string
  witnessId?: string;           // Witness identifier for verbal consent
}
```

### Usage Examples

#### Basic Consent Management

```typescript
// Request consent for analytics before collecting data
const consentResponse = await coreServices.consentManager?.requestConsent(['usage-analytics']);

if (consentResponse?.granted) {
  // User granted consent, proceed with analytics collection
  await collectUsageAnalytics(userAction);
} else {
  // User declined consent, skip analytics
  console.log('User declined analytics consent');
}
```

#### Checking Existing Consent

```typescript
// Check if user has already consented to error reporting
const hasErrorReportingConsent = await coreServices.consentManager?.hasConsent(
  getCurrentUserId(), 
  'error-reporting'
);

if (hasErrorReportingConsent) {
  // Send error report
  await sendErrorReport(error);
}
```

#### Custom Consent Purposes

```typescript
import { createConsentPurpose } from './core/security';

// Create a custom consent purpose for AI model training
const aiTrainingPurpose = createConsentPurpose(
  'ai-model-training',
  'AI Model Training',
  'Use your interactions to improve our AI models',
  {
    category: ConsentCategory.ANALYTICS,
    required: false,
    dataTypes: ['user-interactions', 'conversation-data'],
    retentionDays: 730, // 2 years
    thirdParties: ['AI Training Service'],
    legalBasis: LegalBasis.CONSENT
  }
);

// Register the new purpose with the consent manager
await coreServices.consentManager?.registerPurpose(aiTrainingPurpose);
```

#### Consent Withdrawal (Right to be Forgotten)

```typescript
// Withdraw consent for specific purposes
await coreServices.consentManager?.withdrawConsent(
  getCurrentUserId(), 
  ['usage-analytics', 'error-reporting']
);

// Withdraw all consent (complete data deletion)
await coreServices.consentManager?.withdrawConsent(getCurrentUserId());
```

#### Data Export (Data Portability)

```typescript
// Export all consent data for a user (GDPR Article 20)
const consentData = await coreServices.consentManager?.exportConsentData(getCurrentUserId());

// Convert to JSON for download
const exportData = {
  userId: getCurrentUserId(),
  exportDate: new Date().toISOString(),
  consentRecords: consentData,
  format: 'GDPR-compliant-export-v1.0'
};

// Provide download to user
const blob = new Blob([JSON.stringify(exportData, null, 2)], 
  { type: 'application/json' });
```

## 🛡️ Input Sanitization API

### VesperaInputSanitizer Interface

```typescript
interface VesperaInputSanitizerInterface extends vscode.Disposable {
  sanitize(input: string, scope: SanitizationScope): Promise<SanitizationResult>;
  validateSchema(data: unknown, schemaName: string): Promise<ValidationResult>;
  detectThreats(input: string): Promise<DetectedThreat[]>;
  generateCSP(context: CSPContext): Promise<string>;
  registerSchema(name: string, schema: ValidationSchema): void;
}
```

### Sanitization Types

```typescript
enum SanitizationScope {
  WEBVIEW = 'webview',          // HTML content for webviews
  USER_INPUT = 'user_input',    // General user input
  CONFIGURATION = 'configuration', // Configuration data
  MESSAGE = 'message',          // Message content
  FILE_PATH = 'file_path',      // File paths and names
  URL = 'url'                   // URLs and URIs
}

interface SanitizationResult {
  sanitized: string;            // Sanitized input
  threats: DetectedThreat[];    // Detected threats
  processed: boolean;           // Whether processing was applied
  safe: boolean;                // Whether result is safe to use
  processingTime: number;       // Processing time in milliseconds
  metadata?: {
    originalLength: number;     // Original input length
    sanitizedLength: number;    // Sanitized input length
    rulesApplied: string[];     // Rules that were applied
  };
}

interface DetectedThreat {
  id: string;                   // Threat identifier
  type: ThreatType;            // Type of threat
  severity: ThreatSeverity;    // Severity level
  pattern: string;             // Pattern that detected the threat
  matches: string[];           // Matching strings
  confidence: number;          // Confidence score (0-1)
  action: ThreatAction;        // Recommended action
}

enum ThreatType {
  XSS = 'xss',
  SQL_INJECTION = 'sql_injection',
  COMMAND_INJECTION = 'command_injection',
  PATH_TRAVERSAL = 'path_traversal',
  HTML_INJECTION = 'html_injection',
  SCRIPT_INJECTION = 'script_injection',
  CSRF = 'csrf',
  XXE = 'xxe'
}

enum ThreatSeverity {
  LOW = 'low',
  MEDIUM = 'medium', 
  HIGH = 'high',
  CRITICAL = 'critical'
}
```

### Usage Examples

#### Basic Input Sanitization

```typescript
// Sanitize user input before processing
const userMessage = '<script>alert("xss")</script>Hello world!';

const sanitizationResult = await coreServices.inputSanitizer?.sanitize(
  userMessage,
  SanitizationScope.USER_INPUT
);

if (sanitizationResult?.safe) {
  await processMessage(sanitizationResult.sanitized);
} else {
  // Handle unsafe input
  console.warn('Potentially unsafe input detected:', sanitizationResult?.threats);
  await handleUnsafeInput(sanitizationResult);
}
```

#### WebView Content Sanitization

```typescript
// Sanitize HTML content for webview display
const htmlContent = `
  <div>
    <h1>User Profile</h1>
    <script>maliciousCode()</script>
    <p onclick="alert('xss')">Click me</p>
  </div>
`;

const webviewResult = await coreServices.inputSanitizer?.sanitize(
  htmlContent,
  SanitizationScope.WEBVIEW
);

// Safe to inject into webview
webview.html = `
  <!DOCTYPE html>
  <html>
    <body>
      ${webviewResult?.sanitized}
    </body>
  </html>
`;
```

#### Schema Validation

```typescript
// Register a schema for configuration validation
const configSchema = {
  type: 'object',
  required: ['apiKey', 'endpoint'],
  properties: {
    apiKey: { type: 'string', minLength: 20 },
    endpoint: { type: 'string', format: 'uri' },
    timeout: { type: 'number', minimum: 1000, maximum: 30000 }
  },
  additionalProperties: false
};

coreServices.inputSanitizer?.registerSchema('apiConfig', configSchema);

// Validate configuration data
const userConfig = getUserConfiguration();
const validationResult = await coreServices.inputSanitizer?.validateSchema(
  userConfig,
  'apiConfig'
);

if (validationResult?.valid) {
  await saveConfiguration(validationResult.value);
} else {
  // Handle validation errors
  vscode.window.showErrorMessage(
    `Configuration errors: ${validationResult?.errors.join(', ')}`
  );
}
```

#### Threat Detection

```typescript
// Detect threats without sanitization
const suspiciousInput = "'; DROP TABLE users; --";

const threats = await coreServices.inputSanitizer?.detectThreats(suspiciousInput);

if (threats && threats.length > 0) {
  const criticalThreats = threats.filter(t => t.severity === ThreatSeverity.CRITICAL);
  
  if (criticalThreats.length > 0) {
    // Block input immediately
    throw new VesperaThreatError('Critical threat detected', criticalThreats);
  }
  
  // Log threats for monitoring
  await coreServices.securityAuditLogger?.logThreatDetection(threats);
}
```

#### Custom Sanitization Rules

```typescript
import { createSanitizationRule } from './core/security';

// Create a custom rule for API responses
const apiResponseRule = createSanitizationRule(
  'api-response',
  'API Response Sanitization',
  SanitizationScope.MESSAGE,
  [
    {
      type: 'schema-validation',
      config: {
        schema: {
          type: 'json-schema',
          definition: apiResponseSchema
        }
      }
    },
    {
      type: 'regex-replace',
      config: {
        regexReplace: {
          patterns: [
            { pattern: /\b\d{16}\b/g, replacement: '[CARD-NUMBER]' }, // Mask credit card numbers
            { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN]' } // Mask SSNs
          ]
        }
      }
    }
  ],
  {
    priority: 85,
    threatPatterns: customThreatPatterns
  }
);
```

## 📊 Security Audit Logging API

### SecurityAuditLogger Interface

```typescript
interface SecurityAuditLoggerInterface extends vscode.Disposable {
  logSecurityEvent(entry: SecurityAuditEntry): Promise<void>;
  logThreatDetection(threats: DetectedThreat[]): Promise<void>;
  logConsentEvent(event: ConsentAuditEvent): Promise<void>;
  getSecurityMetrics(): Promise<SecurityMetrics>;
  generateComplianceReport(timeframe: TimeRange): Promise<ComplianceReport>;
  subscribeToAlerts(callback: SecurityAlertCallback): vscode.Disposable;
  exportAuditLogs(filter: AuditLogFilter): Promise<string>;
}
```

### Audit Types

```typescript
interface SecurityAuditEntry {
  id: string;                   // Unique entry identifier
  timestamp: number;            // Event timestamp
  event: VesperaSecurityEvent; // Event type
  userId?: string;              // User identifier
  resourceId?: string;          // Resource identifier
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>; // Event-specific details
  source: string;               // Source component
  sessionId?: string;           // Session identifier
}

interface SecurityMetrics {
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

interface SecurityAlert {
  id: string;
  type: 'threat_detected' | 'rate_limit_exceeded' | 'consent_violation' | 'system_breach';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  context: SecurityEventContext;
  acknowledged: boolean;
}
```

### Usage Examples

#### Basic Audit Logging

```typescript
// Log a custom security event
await coreServices.securityAuditLogger?.logSecurityEvent({
  id: generateUniqueId(),
  timestamp: Date.now(),
  event: VesperaSecurityEvent.SECURITY_BREACH,
  userId: getCurrentUserId(),
  resourceId: 'admin.settings',
  severity: 'high',
  details: {
    action: 'unauthorized_access_attempt',
    source: 'settings_panel',
    blocked: true
  },
  source: 'VesperaSettingsManager'
});
```

#### Security Metrics Collection

```typescript
// Get comprehensive security metrics
const metrics = await coreServices.securityAuditLogger?.getSecurityMetrics();

// Display metrics in status bar or dashboard
const securityScore = calculateSecurityScore(metrics);
vscode.window.setStatusBarMessage(`Security Score: ${securityScore}/100`);

// Alert on suspicious patterns
if (metrics.sanitization.threatsBlocked > 10) {
  vscode.window.showWarningMessage('High number of security threats detected. Review logs.');
}
```

#### Real-time Security Alerts

```typescript
// Subscribe to security alerts
const alertSubscription = coreServices.securityAuditLogger?.subscribeToAlerts(
  async (alert: SecurityAlert) => {
    if (alert.severity === 'critical') {
      // Immediate action for critical alerts
      vscode.window.showErrorMessage(
        `Critical Security Alert: ${alert.message}`,
        'View Details', 'Acknowledge'
      ).then(action => {
        if (action === 'View Details') {
          showSecurityAlertDetails(alert);
        } else if (action === 'Acknowledge') {
          acknowledgeAlert(alert.id);
        }
      });
    } else {
      // Log non-critical alerts
      console.log(`Security Alert [${alert.severity}]: ${alert.message}`);
    }
  }
);

// Clean up subscription when done
context.subscriptions.push(alertSubscription);
```

#### Compliance Reporting

```typescript
// Generate GDPR compliance report
const complianceReport = await coreServices.securityAuditLogger?.generateComplianceReport({
  startDate: Date.now() - (30 * 24 * 60 * 60 * 1000), // Last 30 days
  endDate: Date.now(),
  includePersonalData: false
});

// Export compliance report
const reportData = JSON.stringify(complianceReport, null, 2);
const reportBlob = new Blob([reportData], { type: 'application/json' });

// Save or display report
vscode.workspace.fs.writeFile(
  vscode.Uri.file('compliance-report.json'),
  Buffer.from(await reportBlob.text())
);
```

## 🔧 Configuration API

### Security Configuration Types

```typescript
interface SecurityConfiguration {
  enabled: boolean;
  rateLimiting?: RateLimitingConfiguration;
  consent?: ConsentConfiguration;
  sanitization?: SanitizationConfiguration;
  audit?: AuditConfiguration;
}

interface RateLimitingConfiguration {
  enabled: boolean;
  rules: RateLimitRule[];
  globalDefaults: TokenBucketConfig;
  circuitBreaker?: CircuitBreakerConfig;
  strictMode?: boolean;
}

interface ConsentConfiguration {
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
  gdprCompliance?: {
    dataPortability: boolean;
    rightToBeForgitten: boolean;
    consentWithdrawal: boolean;
  };
}

interface SanitizationConfiguration {
  enabled: boolean;
  rules: SanitizationRule[];
  strictMode: boolean;
  csp: CSPConfiguration;
  threatDetection: ThreatDetectionConfig;
  mlThreatDetection?: {
    enabled: boolean;
    modelPath: string;
    confidenceThreshold: number;
  };
}
```

### Configuration Helpers

```typescript
// Pre-built configuration functions
import {
  createDevelopmentSecurityConfig,
  createProductionSecurityConfig,
  createRateLimitRule,
  createConsentPurpose,
  createSanitizationRule
} from './core/security';

// Create a custom security configuration
const customConfig: SecurityConfiguration = {
  enabled: true,
  rateLimiting: {
    enabled: true,
    rules: [
      createRateLimitRule(
        'custom-api',
        'Custom API Calls',
        /^custom\./,
        { capacity: 50, refillRate: 5, refillInterval: 1000 },
        { scope: 'user', priority: 90 }
      )
    ],
    globalDefaults: { capacity: 100, refillRate: 10, refillInterval: 1000 },
    strictMode: true
  },
  consent: {
    enabled: true,
    purposes: [
      createConsentPurpose(
        'feature-analytics',
        'Feature Usage Analytics',
        'Track which features are used to improve the extension',
        {
          category: ConsentCategory.ANALYTICS,
          retentionDays: 365,
          required: false
        }
      )
    ],
    uiMode: 'hybrid',
    retention: {
      activeConsentDays: 365,
      auditLogDays: 2555 // 7 years
    },
    encryption: {
      enabled: true,
      algorithm: 'AES-256-GCM'
    }
  }
};
```

## 🧪 Testing Utilities

### Security Test Helpers

```typescript
// Test utilities for security components
export class SecurityTestHelpers {
  
  /**
   * Create a mock security configuration for testing
   */
  static createMockSecurityConfig(): SecurityConfiguration {
    return {
      enabled: true,
      rateLimiting: {
        enabled: true,
        rules: [],
        globalDefaults: { capacity: 10, refillRate: 1, refillInterval: 1000 }
      },
      consent: {
        enabled: true,
        purposes: [],
        uiMode: 'modal',
        retention: { activeConsentDays: 30, auditLogDays: 90 },
        encryption: { enabled: false, algorithm: 'none' }
      },
      sanitization: {
        enabled: true,
        rules: [],
        strictMode: false,
        csp: { defaultSrc: ["'self'"] },
        threatDetection: { patterns: [], enableRealTimeDetection: false }
      }
    };
  }

  /**
   * Create a mock extension context for testing
   */
  static createMockExtensionContext(): vscode.ExtensionContext {
    return {
      subscriptions: [],
      workspaceState: new MockMemento(),
      globalState: new MockMemento(),
      extensionPath: '/mock/extension/path',
      // ... other mock properties
    } as vscode.ExtensionContext;
  }

  /**
   * Wait for security services to be ready
   */
  static async waitForSecurityReady(
    services: SecurityEnhancedVesperaCoreServices,
    timeout: number = 5000
  ): Promise<void> {
    const start = Date.now();
    while (!services.security.isInitialized()) {
      if (Date.now() - start > timeout) {
        throw new Error('Security services failed to initialize within timeout');
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Simulate malicious input for testing
   */
  static getMaliciousInputSamples(): Record<string, string> {
    return {
      xssScript: '<script>alert("xss")</script>',
      sqlInjection: "'; DROP TABLE users; --",
      pathTraversal: '../../../etc/passwd',
      commandInjection: '`rm -rf /`',
      htmlInjection: '<iframe src="javascript:alert(1)"></iframe>',
      jsProtocol: '<a href="javascript:alert(1)">click</a>'
    };
  }
}
```

### Security Test Patterns

```typescript
describe('Security Integration Tests', () => {
  let coreServices: SecurityEnhancedVesperaCoreServices;
  let context: vscode.ExtensionContext;

  beforeEach(async () => {
    context = SecurityTestHelpers.createMockExtensionContext();
    coreServices = await SecurityEnhancedVesperaCoreServices.initialize(context, {
      base: getTestCoreServicesConfig(),
      security: SecurityTestHelpers.createMockSecurityConfig()
    });
    
    await SecurityTestHelpers.waitForSecurityReady(coreServices);
  });

  afterEach(async () => {
    await coreServices.dispose();
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits correctly', async () => {
      const rule = createRateLimitRule(
        'test-rule',
        'Test Rule', 
        /^test/,
        { capacity: 2, refillRate: 1, refillInterval: 1000 },
        { scope: 'global' }
      );
      
      await coreServices.rateLimiter?.updateRules([rule]);

      // First two requests should succeed
      const result1 = await coreServices.checkRateLimit({ resourceId: 'test.action' });
      const result2 = await coreServices.checkRateLimit({ resourceId: 'test.action' });
      
      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);

      // Third request should be rejected
      const result3 = await coreServices.checkRateLimit({ resourceId: 'test.action' });
      expect(result3.allowed).toBe(false);
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize XSS attacks', async () => {
      const maliciousInput = SecurityTestHelpers.getMaliciousInputSamples().xssScript;
      
      const result = await coreServices.sanitizeInput(
        maliciousInput,
        SanitizationScope.WEBVIEW
      );

      expect(result.sanitized).not.toContain('<script>');
      expect(result.threats).toHaveLength(1);
      expect(result.threats[0].type).toBe(ThreatType.XSS);
      expect(result.safe).toBe(true);
    });

    it('should detect multiple threat types', async () => {
      const samples = SecurityTestHelpers.getMaliciousInputSamples();
      
      for (const [threatName, input] of Object.entries(samples)) {
        const threats = await coreServices.inputSanitizer?.detectThreats(input);
        expect(threats).toBeDefined();
        expect(threats!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Consent Management', () => {
    it('should handle consent requests properly', async () => {
      // Mock the consent UI to always grant consent
      const mockUI = jest.spyOn(coreServices.consentManager as any, 'showConsentDialog')
        .mockResolvedValue({
          granted: true,
          purposes: ['test-purpose'],
          timestamp: Date.now(),
          evidence: { method: ConsentMethod.UI_DIALOG }
        });

      const response = await coreServices.requestConsent(['test-purpose']);
      
      expect(response.granted).toBe(true);
      expect(response.purposes).toContain('test-purpose');
      
      // Verify consent is stored
      const hasConsent = await coreServices.consentManager?.hasConsent('test-user', 'test-purpose');
      expect(hasConsent).toBe(true);
      
      mockUI.mockRestore();
    });
  });
});
```

## 🔍 Error Handling

### Security Error Types

```typescript
// Security-specific error types
export class VesperaSecurityError extends Error {
  constructor(
    message: string,
    public code?: VesperaSecurityErrorCode,
    public severity?: 'low' | 'medium' | 'high' | 'critical',
    public metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'VesperaSecurityError';
  }
}

export class VesperaRateLimitError extends VesperaSecurityError {
  constructor(
    message: string,
    public retryAfter: number,
    public ruleId: string
  ) {
    super(message, VesperaSecurityErrorCode.RATE_LIMIT_EXCEEDED, 'medium', {
      retryAfter,
      ruleId
    });
    this.name = 'VesperaRateLimitError';
  }
}

export class VesperaThreatError extends VesperaSecurityError {
  constructor(
    message: string,
    public threats: DetectedThreat[]
  ) {
    super(message, VesperaSecurityErrorCode.THREAT_DETECTED, 'high', { threats });
    this.name = 'VesperaThreatError';
  }
}
```

### Error Handling Patterns

```typescript
// Error handling in extension code
try {
  const result = await coreServices.checkRateLimit({
    resourceId: 'api.sensitive.action',
    userId: getCurrentUserId()
  });
  
  if (!result.allowed) {
    // Handle rate limit gracefully
    const waitTime = result.retryAfter || 5000;
    vscode.window.showInformationMessage(
      `Please wait ${Math.ceil(waitTime / 1000)} seconds before trying again.`
    );
    return;
  }
  
  // Proceed with action
  await performSensitiveAction();
  
} catch (error) {
  if (error instanceof VesperaRateLimitError) {
    // Rate limit specific handling
    vscode.window.showWarningMessage(
      `Rate limit exceeded. Retry in ${Math.ceil(error.retryAfter / 1000)}s`
    );
  } else if (error instanceof VesperaThreatError) {
    // Threat specific handling
    vscode.window.showErrorMessage(
      'Security threat detected. Action blocked for your protection.'
    );
    
    // Log threat for security team
    await coreServices.securityAuditLogger?.logThreatDetection(error.threats);
  } else {
    // General error handling
    coreServices.errorHandler.handleError(error);
  }
}
```

## 📚 Best Practices

### Integration Best Practices

1. **Initialize Early**: Initialize security services as early as possible in your extension lifecycle.

```typescript
export async function activate(context: vscode.ExtensionContext) {
  // Initialize security services first
  const coreServices = await SecurityEnhancedVesperaCoreServices.initialize(context, config);
  
  // Then register commands and other extension features
  registerCommands(context, coreServices);
}
```

2. **Graceful Degradation**: Always provide fallbacks when security services are unavailable.

```typescript
// Good: Graceful degradation
const rateLimitResult = await coreServices.rateLimiter?.checkRateLimit(context) ?? 
  { allowed: true, rule: null, tokensRemaining: Infinity };

// Bad: Assuming services are always available
const rateLimitResult = await coreServices.rateLimiter.checkRateLimit(context);
```

3. **Consent Before Data Collection**: Always check consent before collecting any user data.

```typescript
// Check consent before analytics
const hasAnalyticsConsent = await coreServices.consentManager?.hasConsent(
  userId, 
  'usage-analytics'
);

if (hasAnalyticsConsent) {
  await trackUserAction(action);
}
```

4. **Sanitize All External Input**: Sanitize any input from external sources.

```typescript
// Sanitize before processing
const sanitizationResult = await coreServices.inputSanitizer?.sanitize(
  externalInput,
  SanitizationScope.USER_INPUT
);

if (sanitizationResult?.safe) {
  await processInput(sanitizationResult.sanitized);
}
```

### Performance Best Practices

1. **Cache Security Decisions**: Cache consent and rate limit decisions where appropriate.

```typescript
class ConsentCache {
  private cache = new Map<string, { hasConsent: boolean; expires: number }>();
  
  async hasConsent(userId: string, purposeId: string): Promise<boolean> {
    const key = `${userId}:${purposeId}`;
    const cached = this.cache.get(key);
    
    if (cached && cached.expires > Date.now()) {
      return cached.hasConsent;
    }
    
    const hasConsent = await this.consentManager.hasConsent(userId, purposeId);
    this.cache.set(key, {
      hasConsent,
      expires: Date.now() + 5 * 60 * 1000 // 5 minutes
    });
    
    return hasConsent;
  }
}
```

2. **Batch Security Operations**: Batch multiple security operations when possible.

```typescript
// Batch multiple consent checks
const consentChecks = await Promise.all([
  coreServices.consentManager?.hasConsent(userId, 'analytics'),
  coreServices.consentManager?.hasConsent(userId, 'error-reporting'),
  coreServices.consentManager?.hasConsent(userId, 'personalization')
]);

const [hasAnalytics, hasErrorReporting, hasPersonalization] = consentChecks;
```

### Security Best Practices

1. **Principle of Least Privilege**: Only request consent for data you actually need.

2. **Defense in Depth**: Layer multiple security controls for critical operations.

3. **Fail Secure**: When security checks fail, err on the side of caution.

4. **Regular Updates**: Keep threat patterns and security rules updated.

---

**Next Steps**: Review the [Operational Procedures](./OPERATIONAL_PROCEDURES.md) for ongoing maintenance and monitoring, then see the [User Security Guide](./USER_SECURITY_GUIDE.md) for end-user documentation.