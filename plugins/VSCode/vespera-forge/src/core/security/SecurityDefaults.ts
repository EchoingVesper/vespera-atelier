/**
 * Security Configuration Defaults
 * 
 * Default configurations and helper functions for security services.
 * Provides sensible defaults that can be overridden in specific environments.
 */

import {
  SecurityConfiguration,
  RateLimitRule,
  RateLimitAction,
  TokenBucketConfig,
  CircuitBreakerConfig,
  ConsentPurpose,
  ConsentCategory,
  LegalBasis,
  SanitizationRule,
  SanitizationScope,
  SanitizationProcessor,
  ThreatPattern,
  ThreatType,
  ThreatSeverity,
  ThreatAction,
  CSPConfiguration,
  ThreatDetectionConfig
} from '../../types/security';

// ============================================================================
// Rate Limiting Defaults
// ============================================================================

export const DEFAULT_TOKEN_BUCKET: TokenBucketConfig = {
  capacity: 100,
  refillRate: 10, // 10 tokens per second
  refillInterval: 1000, // 1 second
  initialTokens: 100,
  burstAllowance: 20
};

export const DEFAULT_CIRCUIT_BREAKER: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeout: 30000, // 30 seconds
  monitoringPeriod: 10000, // 10 seconds
  halfOpenMaxCalls: 3
};

export const DEFAULT_RATE_LIMIT_RULES: RateLimitRule[] = [
  {
    id: 'chat-messages',
    name: 'Chat Message Rate Limit',
    pattern: /^chat\.message/,
    scope: 'user',
    bucket: {
      capacity: 50,
      refillRate: 5, // 5 messages per second
      refillInterval: 1000,
      initialTokens: 50,
      burstAllowance: 10
    },
    actions: [
      { type: 'log', threshold: 50 },
      { type: 'delay', threshold: 80, config: { delayMs: 1000 } },
      { type: 'reject', threshold: 95 }
    ],
    enabled: true,
    priority: 100
  },
  {
    id: 'api-requests',
    name: 'API Request Rate Limit',
    pattern: /^api\./,
    scope: 'global',
    bucket: {
      capacity: 1000,
      refillRate: 50, // 50 requests per second
      refillInterval: 1000,
      initialTokens: 1000,
      burstAllowance: 100
    },
    actions: [
      { type: 'log', threshold: 70 },
      { type: 'circuit-break', threshold: 90, config: { circuitBreakerDurationMs: 60000 } }
    ],
    enabled: true,
    priority: 90
  },
  {
    id: 'file-operations',
    name: 'File Operation Rate Limit',
    pattern: /^file\./,
    scope: 'session',
    bucket: {
      capacity: 200,
      refillRate: 20, // 20 file ops per second
      refillInterval: 1000,
      initialTokens: 200,
      burstAllowance: 50
    },
    actions: [
      { type: 'log', threshold: 60 },
      { type: 'delay', threshold: 85, config: { delayMs: 2000 } },
      { type: 'reject', threshold: 95 }
    ],
    enabled: true,
    priority: 80
  }
];

// ============================================================================
// Consent Management Defaults
// ============================================================================

export const DEFAULT_CONSENT_PURPOSES: ConsentPurpose[] = [
  {
    id: 'essential-functionality',
    name: 'Essential Functionality',
    description: 'Core extension functionality including command execution and UI display',
    category: ConsentCategory.ESSENTIAL,
    required: true,
    dataTypes: ['user-commands', 'ui-state', 'error-logs'],
    retentionPeriod: 365 * 24 * 60 * 60 * 1000, // 1 year
    thirdParties: [],
    legalBasis: LegalBasis.LEGITIMATE_INTERESTS
  },
  {
    id: 'usage-analytics',
    name: 'Usage Analytics',
    description: 'Anonymized usage statistics to improve the extension',
    category: ConsentCategory.ANALYTICS,
    required: false,
    dataTypes: ['usage-metrics', 'performance-data', 'feature-usage'],
    retentionPeriod: 730 * 24 * 60 * 60 * 1000, // 2 years
    thirdParties: ['Microsoft Application Insights'],
    legalBasis: LegalBasis.CONSENT
  },
  {
    id: 'error-reporting',
    name: 'Error Reporting',
    description: 'Automatic error reporting to help diagnose and fix issues',
    category: ConsentCategory.FUNCTIONAL,
    required: false,
    dataTypes: ['error-reports', 'stack-traces', 'system-info'],
    retentionPeriod: 90 * 24 * 60 * 60 * 1000, // 90 days
    thirdParties: ['Error Monitoring Service'],
    legalBasis: LegalBasis.CONSENT
  },
  {
    id: 'personalization',
    name: 'Personalization',
    description: 'Customize the extension experience based on your preferences',
    category: ConsentCategory.PREFERENCES,
    required: false,
    dataTypes: ['user-preferences', 'usage-patterns', 'customization-settings'],
    retentionPeriod: 1095 * 24 * 60 * 60 * 1000, // 3 years
    thirdParties: [],
    legalBasis: LegalBasis.CONSENT
  },
  {
    id: 'chat-history',
    name: 'Chat History',
    description: 'Store chat conversations for context and continuity',
    category: ConsentCategory.FUNCTIONAL,
    required: false,
    dataTypes: ['chat-messages', 'conversation-history', 'user-inputs'],
    retentionPeriod: 180 * 24 * 60 * 60 * 1000, // 180 days
    thirdParties: [],
    legalBasis: LegalBasis.CONSENT
  }
];

// ============================================================================
// Input Sanitization Defaults
// ============================================================================

export const DEFAULT_THREAT_PATTERNS: ThreatPattern[] = [
  {
    id: 'xss-script-tag',
    type: ThreatType.XSS,
    pattern: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    severity: ThreatSeverity.CRITICAL,
    action: ThreatAction.BLOCK
  },
  {
    id: 'xss-javascript-protocol',
    type: ThreatType.XSS,
    pattern: /javascript:/gi,
    severity: ThreatSeverity.HIGH,
    action: ThreatAction.SANITIZE
  },
  {
    id: 'xss-event-handlers',
    type: ThreatType.XSS,
    pattern: /on\w+\s*=/gi,
    severity: ThreatSeverity.HIGH,
    action: ThreatAction.SANITIZE
  },
  {
    id: 'xss-data-attributes',
    type: ThreatType.XSS,
    pattern: /data-[^=]*=.*javascript:/gi,
    severity: ThreatSeverity.HIGH,
    action: ThreatAction.SANITIZE
  },
  {
    id: 'path-traversal',
    type: ThreatType.PATH_TRAVERSAL,
    pattern: /\.\.[\/\\]/g,
    severity: ThreatSeverity.HIGH,
    action: ThreatAction.BLOCK
  },
  {
    id: 'command-injection-basic',
    type: ThreatType.COMMAND_INJECTION,
    pattern: /[;&|`$(){}]/g,
    severity: ThreatSeverity.CRITICAL,
    action: ThreatAction.BLOCK
  },
  {
    id: 'sql-injection-basic',
    type: ThreatType.SQL_INJECTION,
    pattern: /(union|select|insert|update|delete|drop|create|alter)\s/gi,
    severity: ThreatSeverity.HIGH,
    action: ThreatAction.SANITIZE
  },
  {
    id: 'html-injection',
    type: ThreatType.HTML_INJECTION,
    pattern: /<(iframe|embed|object|form|input|textarea)\b[^>]*>/gi,
    severity: ThreatSeverity.MEDIUM,
    action: ThreatAction.SANITIZE
  }
];

export const DEFAULT_SANITIZATION_RULES: SanitizationRule[] = [
  {
    id: 'webview-content',
    name: 'WebView Content Sanitization',
    scope: SanitizationScope.WEBVIEW,
    priority: 100,
    enabled: true,
    processors: [
      {
        type: 'dompurify',
        config: {
          domPurify: {
            allowedTags: ['p', 'div', 'span', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'code', 'pre'],
            allowedAttributes: {
              'a': ['href', 'title'],
              'code': ['class'],
              'pre': ['class']
            },
            stripIgnoreTag: true,
            stripIgnoreTagBody: ['script', 'style']
          }
        }
      }
    ],
    threatPatterns: DEFAULT_THREAT_PATTERNS.filter(p => 
      p.type === ThreatType.XSS || p.type === ThreatType.HTML_INJECTION
    )
  },
  {
    id: 'user-input',
    name: 'User Input Sanitization',
    scope: SanitizationScope.USER_INPUT,
    priority: 90,
    enabled: true,
    processors: [
      {
        type: 'encoding',
        config: {
          encoding: {
            type: 'html',
            decode: false
          }
        }
      },
      {
        type: 'regex-replace',
        config: {
          regexReplace: {
            patterns: [
              { pattern: /[<>]/g, replacement: '' },
              { pattern: /javascript:/gi, replacement: '' }
            ]
          }
        }
      }
    ],
    threatPatterns: DEFAULT_THREAT_PATTERNS
  },
  {
    id: 'configuration',
    name: 'Configuration Sanitization',
    scope: SanitizationScope.CONFIGURATION,
    priority: 95,
    enabled: true,
    processors: [
      {
        type: 'schema-validation',
        config: {
          schema: {
            type: 'json-schema',
            definition: {
              type: 'object',
              properties: {
                settings: { type: 'object' },
                preferences: { type: 'object' }
              }
            }
          }
        }
      }
    ],
    threatPatterns: DEFAULT_THREAT_PATTERNS.filter(p => 
      p.type === ThreatType.COMMAND_INJECTION || p.type === ThreatType.PATH_TRAVERSAL
    )
  },
  {
    id: 'message-validation',
    name: 'Message Validation',
    scope: SanitizationScope.MESSAGE,
    priority: 85,
    enabled: true,
    processors: [
      {
        type: 'schema-validation',
        config: {
          schema: {
            type: 'json-schema',
            definition: {
              type: 'object',
              required: ['type', 'content'],
              properties: {
                type: { type: 'string' },
                content: { type: 'string', maxLength: 10000 }
              }
            }
          }
        }
      }
    ],
    threatPatterns: []
  }
];

export const DEFAULT_CSP: CSPConfiguration = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", "data:", "https:"],
  connectSrc: ["'self'"],
  fontSrc: ["'self'"],
  mediaSrc: ["'self'"],
  objectSrc: ["'none'"],
  childSrc: ["'self'"],
  frameAncestors: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  upgradeInsecureRequests: true
};

export const DEFAULT_THREAT_DETECTION: ThreatDetectionConfig = {
  patterns: DEFAULT_THREAT_PATTERNS,
  enableRealTimeDetection: true,
  alertThresholds: {
    low: 10,
    medium: 5,
    high: 2,
    critical: 1
  }
};

// ============================================================================
// Complete Security Configuration
// ============================================================================

export const DEFAULT_SECURITY_CONFIG: SecurityConfiguration = {
  enabled: true,
  rateLimiting: {
    enabled: true,
    rules: DEFAULT_RATE_LIMIT_RULES,
    globalDefaults: DEFAULT_TOKEN_BUCKET,
    circuitBreaker: DEFAULT_CIRCUIT_BREAKER
  },
  consent: {
    enabled: true,
    purposes: DEFAULT_CONSENT_PURPOSES,
    uiMode: 'hybrid',
    retention: {
      activeConsentDays: 365,
      auditLogDays: 2555 // 7 years for GDPR compliance
    },
    encryption: {
      enabled: true,
      algorithm: 'AES-256-GCM'
    }
  },
  sanitization: {
    enabled: true,
    rules: DEFAULT_SANITIZATION_RULES,
    strictMode: true,
    csp: DEFAULT_CSP,
    threatDetection: DEFAULT_THREAT_DETECTION
  },
  audit: {
    enabled: true,
    retention: 90 * 24 * 60 * 60 * 1000, // 90 days
    includePII: false,
    exportFormat: 'json',
    realTimeAlerts: true
  }
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a custom rate limit rule
 */
export function createRateLimitRule(
  id: string,
  name: string,
  pattern: string | RegExp,
  bucket: Partial<TokenBucketConfig>,
  options: {
    scope?: RateLimitRule['scope'];
    actions?: RateLimitAction[];
    priority?: number;
  } = {}
): RateLimitRule {
  return {
    id,
    name,
    pattern,
    scope: options.scope || 'resource',
    bucket: { ...DEFAULT_TOKEN_BUCKET, ...bucket },
    actions: options.actions || [
      { type: 'log', threshold: 50 },
      { type: 'reject', threshold: 90 }
    ],
    enabled: true,
    priority: options.priority || 50
  };
}

/**
 * Create a custom consent purpose
 */
export function createConsentPurpose(
  id: string,
  name: string,
  description: string,
  options: {
    category?: ConsentCategory;
    required?: boolean;
    dataTypes?: string[];
    retentionDays?: number;
    thirdParties?: string[];
    legalBasis?: LegalBasis;
  } = {}
): ConsentPurpose {
  return {
    id,
    name,
    description,
    category: options.category || ConsentCategory.FUNCTIONAL,
    required: options.required || false,
    dataTypes: options.dataTypes || [],
    retentionPeriod: (options.retentionDays || 365) * 24 * 60 * 60 * 1000,
    thirdParties: options.thirdParties || [],
    legalBasis: options.legalBasis || LegalBasis.CONSENT
  };
}

/**
 * Create a custom sanitization rule
 */
export function createSanitizationRule(
  id: string,
  name: string,
  scope: SanitizationScope,
  processors: SanitizationProcessor[],
  options: {
    priority?: number;
    threatPatterns?: ThreatPattern[];
    enabled?: boolean;
  } = {}
): SanitizationRule {
  return {
    id,
    name,
    scope,
    priority: options.priority || 50,
    enabled: options.enabled !== false,
    processors,
    threatPatterns: options.threatPatterns || []
  };
}

/**
 * Create a development security configuration (less restrictive)
 */
export function createDevelopmentSecurityConfig(): SecurityConfiguration {
  return {
    ...DEFAULT_SECURITY_CONFIG,
    rateLimiting: {
      ...DEFAULT_SECURITY_CONFIG.rateLimiting!,
      rules: DEFAULT_RATE_LIMIT_RULES.map(rule => ({
        ...rule,
        bucket: {
          ...rule.bucket,
          capacity: rule.bucket.capacity * 2, // Double capacity for dev
          refillRate: rule.bucket.refillRate * 2 // Double refill rate for dev
        }
      }))
    },
    sanitization: {
      ...DEFAULT_SECURITY_CONFIG.sanitization!,
      strictMode: false // Less strict in development
    },
    audit: {
      ...DEFAULT_SECURITY_CONFIG.audit!,
      retention: 7 * 24 * 60 * 60 * 1000, // Only keep 7 days in dev
      realTimeAlerts: false // Disable alerts in development
    }
  };
}

/**
 * Create a production security configuration (more restrictive)
 */
export function createProductionSecurityConfig(): SecurityConfiguration {
  return {
    ...DEFAULT_SECURITY_CONFIG,
    rateLimiting: {
      ...DEFAULT_SECURITY_CONFIG.rateLimiting!,
      rules: DEFAULT_RATE_LIMIT_RULES.map(rule => ({
        ...rule,
        bucket: {
          ...rule.bucket,
          capacity: Math.floor(rule.bucket.capacity * 0.8), // Reduce capacity for prod
          burstAllowance: Math.floor((rule.bucket.burstAllowance || 0) * 0.5) // Reduce burst for prod
        }
      }))
    },
    sanitization: {
      ...DEFAULT_SECURITY_CONFIG.sanitization!,
      strictMode: true,
      csp: {
        ...DEFAULT_CSP,
        scriptSrc: DEFAULT_CSP.scriptSrc.filter(src => src !== "'unsafe-inline'"), // Remove unsafe-inline in prod
        styleSrc: DEFAULT_CSP.styleSrc.filter(src => src !== "'unsafe-inline'") // Remove unsafe-inline in prod
      }
    },
    audit: {
      ...DEFAULT_SECURITY_CONFIG.audit!,
      retention: 365 * 24 * 60 * 60 * 1000, // Keep 1 year in prod
      includePII: false, // Never include PII in prod
      realTimeAlerts: true
    }
  };
}