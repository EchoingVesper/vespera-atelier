/**
 * Error Classes
 *
 * Hierarchical error classes with categorization and recovery patterns.
 * Based on Bindery Rust implementation (vespera-bindery/src/error.rs).
 */

import type { ErrorCategory, ErrorContext } from './types.js';

/**
 * Base error class for all Vespera errors
 */
export abstract class VesperaError extends Error {
  public readonly context: ErrorContext;
  public readonly timestamp: Date;

  constructor(message: string, context: ErrorContext = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = context;
    this.timestamp = new Date();

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Get the error category for logging and metrics
   */
  abstract category(): ErrorCategory;

  /**
   * Determine if this error is recoverable (can retry)
   */
  abstract isRecoverable(): boolean;

  /**
   * Get a user-friendly error message
   */
  abstract userMessage(): string;

  /**
   * Get the error code for API responses
   */
  errorCode(): string {
    // Convert camelCase/PascalCase to snake_case
    return this.name
      .replace(/Error$/, '')
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
  }

  /**
   * Convert to standard error response format
   */
  toErrorResponse(operation: string, suggestions?: string[]): {
    success: false;
    error: string;
    error_code: string;
    operation: string;
    context?: Record<string, unknown>;
    suggestions?: string[];
  } {
    return {
      success: false,
      error: this.userMessage(),
      error_code: this.errorCode(),
      operation,
      context: this.context,
      suggestions
    };
  }
}

/**
 * Template-related errors
 */
export class TemplateNotFoundError extends VesperaError {
  constructor(public templateId: string, context?: ErrorContext) {
    super(`Template not found: ${templateId}`, context);
  }

  category(): ErrorCategory { return 'template'; }
  isRecoverable(): boolean { return false; }
  userMessage(): string {
    return `Could not find template "${this.templateId}". Please check the template ID and try again.`;
  }
}

export class TemplateValidationError extends VesperaError {
  constructor(message: string, public templateId?: string, context?: ErrorContext) {
    super(message, context);
  }

  category(): ErrorCategory { return 'validation'; }
  isRecoverable(): boolean { return false; }
  userMessage(): string {
    const prefix = this.templateId ? `Template "${this.templateId}": ` : '';
    return `${prefix}${this.message}`;
  }
}

/**
 * Network-related errors
 */
export class NetworkError extends VesperaError {
  constructor(message: string, public statusCode?: number, context?: ErrorContext) {
    super(message, context);
  }

  category(): ErrorCategory { return 'network'; }
  isRecoverable(): boolean { return true; }
  userMessage(): string {
    if (this.statusCode) {
      return `Network error (${this.statusCode}): ${this.message}. Please check your connection and try again.`;
    }
    return `Network error: ${this.message}. Please check your connection and try again.`;
  }
}

export class TimeoutError extends VesperaError {
  constructor(public operation: string, public timeoutMs: number, context?: ErrorContext) {
    super(`Operation "${operation}" timed out after ${timeoutMs}ms`, context);
  }

  category(): ErrorCategory { return 'timeout'; }
  isRecoverable(): boolean { return true; }
  userMessage(): string {
    return `The operation took too long to complete. Please try again.`;
  }
}

/**
 * Authentication and permission errors
 */
export class AuthenticationError extends VesperaError {
  constructor(message: string, context?: ErrorContext) {
    super(message, context);
  }

  category(): ErrorCategory { return 'authentication'; }
  isRecoverable(): boolean { return false; }
  userMessage(): string {
    return `Authentication failed: ${this.message}. Please check your credentials.`;
  }
}

export class PermissionError extends VesperaError {
  constructor(public resource: string, public action: string, context?: ErrorContext) {
    super(`Permission denied: cannot ${action} ${resource}`, context);
  }

  category(): ErrorCategory { return 'permission'; }
  isRecoverable(): boolean { return false; }
  userMessage(): string {
    return `You don't have permission to ${this.action} ${this.resource}.`;
  }
}

/**
 * Resource errors
 */
export class NotFoundError extends VesperaError {
  constructor(public resourceType: string, public resourceId: string, context?: ErrorContext) {
    super(`${resourceType} not found: ${resourceId}`, context);
  }

  category(): ErrorCategory { return 'not_found'; }
  isRecoverable(): boolean { return false; }
  userMessage(): string {
    return `Could not find ${this.resourceType} with ID "${this.resourceId}".`;
  }
}

export class ConflictError extends VesperaError {
  constructor(message: string, context?: ErrorContext) {
    super(message, context);
  }

  category(): ErrorCategory { return 'conflict'; }
  isRecoverable(): boolean { return false; }
  userMessage(): string {
    return `Conflict: ${this.message}. Please refresh and try again.`;
  }
}

/**
 * Validation errors
 */
export class ValidationError extends VesperaError {
  constructor(message: string, public field?: string, context?: ErrorContext) {
    super(message, context);
  }

  category(): ErrorCategory { return 'validation'; }
  isRecoverable(): boolean { return false; }
  userMessage(): string {
    const prefix = this.field ? `Field "${this.field}": ` : '';
    return `${prefix}${this.message}`;
  }
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends VesperaError {
  constructor(public retryAfter: number, context?: ErrorContext) {
    super(`Rate limit exceeded. Retry after ${retryAfter}ms`, context);
  }

  category(): ErrorCategory { return 'rate_limit'; }
  isRecoverable(): boolean { return true; }
  userMessage(): string {
    const seconds = Math.ceil(this.retryAfter / 1000);
    return `Rate limit exceeded. Please wait ${seconds} seconds before trying again.`;
  }
}

/**
 * Internal errors
 */
export class InternalError extends VesperaError {
  constructor(message: string, public originalError?: Error, context?: ErrorContext) {
    super(message, context);
    if (originalError && originalError.stack) {
      this.stack = originalError.stack;
    }
  }

  category(): ErrorCategory { return 'internal'; }
  isRecoverable(): boolean { return false; }
  userMessage(): string {
    return `An internal error occurred. Please try again or contact support if the problem persists.`;
  }
}

/**
 * External service errors
 */
export class ExternalServiceError extends VesperaError {
  constructor(public serviceName: string, message: string, context?: ErrorContext) {
    super(`External service error (${serviceName}): ${message}`, context);
  }

  category(): ErrorCategory { return 'external'; }
  isRecoverable(): boolean { return true; }
  userMessage(): string {
    return `The ${this.serviceName} service is temporarily unavailable. Please try again later.`;
  }
}

/**
 * Helper function to normalize unknown errors into VesperaError
 */
export function normalizeError(error: unknown, operation: string = 'operation'): VesperaError {
  if (error instanceof VesperaError) {
    return error;
  }

  if (error instanceof Error) {
    return new InternalError(error.message, error, { operation });
  }

  if (typeof error === 'string') {
    return new InternalError(error, undefined, { operation });
  }

  return new InternalError(
    'An unknown error occurred',
    undefined,
    { operation, originalError: error }
  );
}