/**
 * Vespera Security Error Classes
 * 
 * Extends the existing VesperaError system to provide comprehensive error handling
 * for security-related issues including rate limiting, consent, and input sanitization.
 */

import { VesperaError, VesperaSeverity } from '../error-handling/VesperaErrors';
import { VesperaSecurityErrorCode } from '../../types/security';

/**
 * Base security error class
 */
export class VesperaSecurityError extends VesperaError {
  constructor(
    message: string,
    code: VesperaSecurityErrorCode,
    severity: VesperaSeverity = VesperaSeverity.MEDIUM,
    details?: any
  ) {
    super(message, code, severity, details);
    this.name = 'VesperaSecurityError';
  }
}

/**
 * Rate limiting specific error
 */
export class VesperaRateLimitError extends VesperaSecurityError {
  public readonly retryAfter: number;
  public readonly remainingTokens: number;

  constructor(
    message: string,
    retryAfter: number,
    remainingTokens: number,
    details?: any
  ) {
    super(message, VesperaSecurityErrorCode.RATE_LIMIT_EXCEEDED, VesperaSeverity.MEDIUM, details);
    this.name = 'VesperaRateLimitError';
    this.retryAfter = retryAfter;
    this.remainingTokens = remainingTokens;
  }
}

/**
 * Consent management specific error
 */
export class VesperaConsentError extends VesperaSecurityError {
  public readonly userId: string;
  public readonly purposeIds: string[];

  constructor(
    message: string,
    code: VesperaSecurityErrorCode,
    userId: string,
    purposeIds: string[],
    severity: VesperaSeverity = VesperaSeverity.HIGH,
    details?: any
  ) {
    super(message, code, severity, details);
    this.name = 'VesperaConsentError';
    this.userId = userId;
    this.purposeIds = purposeIds;
  }
}

/**
 * Input sanitization specific error
 */
export class VesperaSanitizationError extends VesperaSecurityError {
  public readonly threatType: string;
  public readonly inputLength: number;
  public readonly sanitizedLength: number;

  constructor(
    message: string,
    threatType: string,
    inputLength: number,
    sanitizedLength: number,
    severity: VesperaSeverity = VesperaSeverity.HIGH,
    details?: any
  ) {
    super(message, VesperaSecurityErrorCode.INPUT_SANITIZATION_FAILED, severity, details);
    this.name = 'VesperaSanitizationError';
    this.threatType = threatType;
    this.inputLength = inputLength;
    this.sanitizedLength = sanitizedLength;
  }
}

/**
 * Threat detection specific error
 */
export class VesperaThreatError extends VesperaSecurityError {
  public readonly threatType: string;
  public readonly patterns: string[];
  public readonly blocked: boolean;

  constructor(
    message: string,
    threatType: string,
    patterns: string[],
    blocked: boolean,
    severity: VesperaSeverity = VesperaSeverity.CRITICAL,
    details?: any
  ) {
    super(message, VesperaSecurityErrorCode.THREAT_DETECTED, severity, details);
    this.name = 'VesperaThreatError';
    this.threatType = threatType;
    this.patterns = patterns;
    this.blocked = blocked;
  }
}

/**
 * CSP violation error
 */
export class VesperaCSPError extends VesperaSecurityError {
  public readonly violationType: string;
  public readonly blockedUri: string;
  public readonly sourceFile: string;

  constructor(
    message: string,
    violationType: string,
    blockedUri: string,
    sourceFile: string,
    details?: any
  ) {
    super(message, VesperaSecurityErrorCode.CSP_VIOLATION, VesperaSeverity.HIGH, details);
    this.name = 'VesperaCSPError';
    this.violationType = violationType;
    this.blockedUri = blockedUri;
    this.sourceFile = sourceFile;
  }
}

/**
 * Circuit breaker specific error
 */
export class VesperaCircuitBreakerError extends VesperaSecurityError {
  public readonly circuitState: string;
  public readonly retryAfter: number;
  public readonly failureCount: number;

  constructor(
    message: string,
    circuitState: string,
    retryAfter: number,
    failureCount: number,
    details?: any
  ) {
    super(message, VesperaSecurityErrorCode.CIRCUIT_BREAKER_OPEN, VesperaSeverity.MEDIUM, details);
    this.name = 'VesperaCircuitBreakerError';
    this.circuitState = circuitState;
    this.retryAfter = retryAfter;
    this.failureCount = failureCount;
  }
}

/**
 * Credential migration specific error with retry information
 */
export class VesperaCredentialMigrationError extends VesperaSecurityError {
  public readonly retryAfter: number;
  public readonly remainingTokens: number;
  public readonly migrationStep: string;

  constructor(
    message: string,
    retryAfter: number,
    remainingTokens: number,
    details?: any
  ) {
    super(message, VesperaSecurityErrorCode.RATE_LIMIT_EXCEEDED, VesperaSeverity.MEDIUM, details);
    this.name = 'VesperaCredentialMigrationError';
    this.retryAfter = retryAfter;
    this.remainingTokens = remainingTokens;
    this.migrationStep = details?.migrationStep || 'unknown';
  }
}