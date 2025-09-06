/**
 * Vespera Forge Security Infrastructure
 * 
 * Comprehensive security scaffolding with enterprise-grade components:
 * - Rate limiting with token buckets and circuit breakers
 * - GDPR-compliant consent management with encrypted storage
 * - Multi-layer input sanitization with threat detection
 * - Security audit logging with real-time alerting
 * - Seamless integration with VesperaCoreServices
 */

import * as vscode from 'vscode';

// ============================================================================
// Core Security Services
// ============================================================================

export { VesperaSecurityManager, SecurityEventBus } from './VesperaSecurityManager';
export { SecurityEnhancedVesperaCoreServices } from './SecurityEnhancedCoreServices';
export type { SecurityEnhancedCoreServicesConfig, SecurityEnhancedCoreStats } from './SecurityEnhancedCoreServices';

// ============================================================================
// Security Errors
// ============================================================================

export {
  VesperaSecurityError,
  VesperaRateLimitError,
  VesperaConsentError,
  VesperaSanitizationError,
  VesperaThreatError,
  VesperaCSPError,
  VesperaCircuitBreakerError
} from './VesperaSecurityErrors';

// ============================================================================
// Rate Limiting
// ============================================================================

export { VesperaRateLimiter, DEFAULT_TOKEN_BUCKET_CONFIG, DEFAULT_CIRCUIT_BREAKER_CONFIG } from './rate-limiting/VesperaRateLimiter';
export { TokenBucket } from './rate-limiting/TokenBucket';
export { CircuitBreaker, type CircuitBreakerStats } from './rate-limiting/CircuitBreaker';

// ============================================================================
// Consent Management
// ============================================================================

export { VesperaConsentManager } from './consent/VesperaConsentManager';
export { ConsentStore } from './consent/ConsentStore';
export { ConsentUI, type ConsentUIResponse } from './consent/ConsentUI';

// ============================================================================
// Input Sanitization
// ============================================================================

export { 
  VesperaInputSanitizer, 
  DEFAULT_CSP_CONFIG, 
  DEFAULT_THREAT_DETECTION_CONFIG 
} from './sanitization/VesperaInputSanitizer';

// ============================================================================
// Security Audit Logging
// ============================================================================

export { 
  VesperaSecurityAuditLogger,
  type SecurityAuditEntry,
  type SecurityAlert
} from './audit/VesperaSecurityAuditLogger';

// ============================================================================
// Configuration and Defaults
// ============================================================================

export {
  DEFAULT_SECURITY_CONFIG,
  DEFAULT_TOKEN_BUCKET,
  DEFAULT_CIRCUIT_BREAKER,
  DEFAULT_RATE_LIMIT_RULES,
  DEFAULT_CONSENT_PURPOSES,
  DEFAULT_THREAT_PATTERNS,
  DEFAULT_SANITIZATION_RULES,
  DEFAULT_CSP,
  DEFAULT_THREAT_DETECTION,
  createRateLimitRule,
  createConsentPurpose,
  createSanitizationRule,
  createDevelopmentSecurityConfig,
  createProductionSecurityConfig
} from './SecurityDefaults';

// ============================================================================
// Types (re-exported from main types file)
// ============================================================================

export type {
  // Configuration types
  SecurityConfiguration,
  RateLimitingConfiguration,
  ConsentConfiguration,
  SanitizationConfiguration,
  AuditConfiguration,
  
  // Rate limiting types
  TokenBucketConfig,
  TokenBucketState,
  RateLimitRule,
  RateLimitAction,
  RateLimitContext,
  RateLimitResult,
  CircuitBreakerConfig,
  CircuitBreakerState,
  
  // Consent management types
  ConsentRecord,
  ConsentPurpose,
  ConsentPurposeGrant,
  ConsentEvidence,
  ConsentConditions,
  ConsentSource,
  ConsentStatus,
  ConsentCategory,
  ConsentMethod,
  LegalBasis,
  
  // Input sanitization types
  SanitizationRule,
  SanitizationScope,
  SanitizationProcessor,
  SanitizationResult,
  ProcessorConfig,
  ThreatPattern,
  DetectedThreat,
  ThreatType,
  ThreatSeverity,
  ThreatAction,
  CSPConfiguration,
  ThreatDetectionConfig,
  
  // Security events and audit
  VesperaSecurityEvent,
  SecurityEventContext,
  ThreatInfo,
  SecurityMetrics,
  
  // Service interfaces
  VesperaRateLimiterInterface,
  VesperaConsentManagerInterface,
  VesperaInputSanitizerInterface,
  SecurityAuditLoggerInterface,
  
  // Error codes
  VesperaSecurityErrorCode
} from '../../types/security';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Quick initialization helper for development environments
 */
export async function initializeDevelopmentSecurity(
  context: vscode.ExtensionContext,
  baseConfig: any = {}
): Promise<import('./SecurityEnhancedCoreServices').SecurityEnhancedVesperaCoreServices> {
  const { createDevelopmentSecurityConfig } = await import('./SecurityDefaults');
  const { SecurityEnhancedVesperaCoreServices } = await import('./SecurityEnhancedCoreServices');
  
  return SecurityEnhancedVesperaCoreServices.initialize(context, {
    ...baseConfig,
    security: createDevelopmentSecurityConfig()
  });
}

/**
 * Quick initialization helper for production environments
 */
export async function initializeProductionSecurity(
  context: vscode.ExtensionContext,
  baseConfig: any = {}
): Promise<import('./SecurityEnhancedCoreServices').SecurityEnhancedVesperaCoreServices> {
  const { createProductionSecurityConfig } = await import('./SecurityDefaults');
  const { SecurityEnhancedVesperaCoreServices } = await import('./SecurityEnhancedCoreServices');
  
  return SecurityEnhancedVesperaCoreServices.initialize(context, {
    ...baseConfig,
    security: createProductionSecurityConfig()
  });
}

/**
 * Check if security services are properly initialized
 */
export function isSecurityInitialized(): boolean {
  try {
    const { SecurityEnhancedVesperaCoreServices } = require('./SecurityEnhancedCoreServices');
    return SecurityEnhancedVesperaCoreServices.isInitialized();
  } catch (error) {
    return false;
  }
}

/**
 * Get security service instance (throws if not initialized)
 */
export function getSecurityServices(): import('./SecurityEnhancedCoreServices').SecurityEnhancedVesperaCoreServices {
  const { SecurityEnhancedVesperaCoreServices } = require('./SecurityEnhancedCoreServices');
  return SecurityEnhancedVesperaCoreServices.getInstance();
}

// ============================================================================
// Version Information
// ============================================================================

export const SECURITY_INFRASTRUCTURE_VERSION = '1.0.0';
export const SUPPORTED_SECURITY_FEATURES = [
  'rate-limiting',
  'consent-management', 
  'input-sanitization',
  'security-audit-logging',
  'threat-detection',
  'circuit-breakers',
  'gdpr-compliance',
  'real-time-alerts'
] as const;

// ============================================================================
// Module Documentation
// ============================================================================

/**
 * @fileoverview
 * 
 * Vespera Forge Security Infrastructure
 * =====================================
 * 
 * This module provides enterprise-grade security scaffolding for VS Code extensions,
 * built on top of the existing VesperaCoreServices infrastructure.
 * 
 * ## Key Features
 * 
 * ### 🔒 Rate Limiting
 * - Token bucket algorithm with burst allowance
 * - Circuit breakers for fault tolerance
 * - Memory-safe resource management
 * - Configurable rules and scopes
 * 
 * ### 📝 Consent Management
 * - GDPR-compliant consent tracking
 * - Encrypted storage with audit trails
 * - Non-intrusive UI integration
 * - Right to be forgotten support
 * 
 * ### 🛡️ Input Sanitization  
 * - Multi-layer defense against XSS, injection attacks
 * - DOMPurify integration for HTML sanitization
 * - Schema validation for structured data
 * - Real-time threat detection and blocking
 * 
 * ### 📊 Security Audit Logging
 * - Comprehensive security event tracking
 * - Real-time alerting and notifications
 * - Compliance reporting and data export
 * - Performance metrics and analytics
 * 
 * ## Quick Start
 * 
 * ```typescript
 * import { initializeDevelopmentSecurity } from './core/security';
 * 
 * // Initialize security services
 * const securityServices = await initializeDevelopmentSecurity(context);
 * 
 * // Use rate limiting
 * const rateLimitResult = await securityServices.rateLimiter.checkRateLimit({
 *   resourceId: 'api.chat.message',
 *   userId: 'user123'
 * });
 * 
 * // Check consent
 * const hasConsent = securityServices.consentManager.hasConsent('user123', 'analytics');
 * 
 * // Sanitize input
 * const sanitized = await securityServices.inputSanitizer.sanitize(
 *   userInput, 
 *   SanitizationScope.WEBVIEW
 * );
 * ```
 * 
 * ## Architecture Integration
 * 
 * The security infrastructure seamlessly integrates with:
 * - VesperaCoreServices (logging, error handling, memory management)
 * - VS Code extension APIs (storage, notifications, webviews)
 * - Existing application architecture patterns
 * 
 * ## Performance Considerations
 * 
 * - All security operations are asynchronous and non-blocking
 * - Memory-safe design with automatic resource cleanup
 * - Configurable performance vs security trade-offs
 * - Development vs production configuration profiles
 * 
 * ## Security Guarantees
 * 
 * - Input sanitization prevents XSS and injection attacks
 * - Rate limiting prevents DoS and abuse scenarios
 * - Consent management ensures GDPR compliance
 * - Audit logging provides complete security visibility
 * - Circuit breakers prevent cascading failures
 * 
 * ## Testing Support
 * 
 * Comprehensive testing utilities are available in `src/test/security/`:
 * - Mock services and test doubles
 * - Performance testing helpers
 * - Security assertion utilities
 * - Automated cleanup management
 */