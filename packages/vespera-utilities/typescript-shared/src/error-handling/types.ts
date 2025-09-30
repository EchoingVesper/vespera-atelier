/**
 * Error Handling Types
 *
 * Type definitions for error handling strategies and responses.
 */

/**
 * Error categories for logging and metrics
 */
export type ErrorCategory =
  | 'template'
  | 'network'
  | 'validation'
  | 'authentication'
  | 'permission'
  | 'not_found'
  | 'conflict'
  | 'internal'
  | 'external'
  | 'timeout'
  | 'rate_limit'
  | 'unknown';

/**
 * Error handling strategy configuration
 */
export interface ErrorHandlingStrategy {
  /** Whether to log the error */
  shouldLog: boolean;
  /** Whether to show notification to user */
  shouldNotifyUser: boolean;
  /** Whether to throw the error after handling */
  shouldThrow: boolean;
  /** Whether to attempt retry */
  shouldRetry: boolean;
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Delay between retries in milliseconds */
  retryDelay?: number;
  /** Whether to use exponential backoff for retries */
  exponentialBackoff?: boolean;
}

/**
 * Retry metadata returned from error handler
 */
export interface RetryMetadata {
  /** Whether the operation should be retried */
  shouldRetry: boolean;
  /** Delay before retry in milliseconds */
  retryAfter: number;
  /** Number of retries attempted so far */
  attemptsRemaining: number;
}

/**
 * Standard error response format
 */
export interface ErrorResponse {
  /** Always false for errors */
  success: false;
  /** Human-readable error message */
  error: string;
  /** Machine-readable error code (snake_case) */
  error_code: string;
  /** Operation that failed */
  operation: string;
  /** Additional error context */
  context?: Record<string, unknown>;
  /** Actionable suggestions for recovery */
  suggestions?: string[];
}

/**
 * Error context for debugging
 */
export interface ErrorContext {
  /** File path if applicable */
  filePath?: string;
  /** Operation identifier */
  operationId?: string;
  /** User ID if applicable */
  userId?: string;
  /** Additional context data */
  [key: string]: unknown;
}