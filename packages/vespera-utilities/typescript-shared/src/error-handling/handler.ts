/**
 * Error Handler
 *
 * Strategy-based error handling with retry logic.
 * Based on VS Code extension pattern (plugins/VSCode/vespera-forge/src/core/error-handling/).
 */

import { VesperaError, normalizeError } from './errors.js';
import type {
  ErrorHandlingStrategy,
  ErrorCategory,
  RetryMetadata
} from './types.js';

/**
 * Default error handling strategies by category
 */
const DEFAULT_STRATEGIES: Record<ErrorCategory, ErrorHandlingStrategy> = {
  template: {
    shouldLog: true,
    shouldNotifyUser: true,
    shouldThrow: true,
    shouldRetry: false
  },
  network: {
    shouldLog: true,
    shouldNotifyUser: true,
    shouldThrow: false,
    shouldRetry: true,
    maxRetries: 3,
    retryDelay: 1000,
    exponentialBackoff: true
  },
  validation: {
    shouldLog: true,
    shouldNotifyUser: true,
    shouldThrow: true,
    shouldRetry: false
  },
  authentication: {
    shouldLog: true,
    shouldNotifyUser: true,
    shouldThrow: true,
    shouldRetry: false
  },
  permission: {
    shouldLog: true,
    shouldNotifyUser: true,
    shouldThrow: true,
    shouldRetry: false
  },
  not_found: {
    shouldLog: true,
    shouldNotifyUser: true,
    shouldThrow: true,
    shouldRetry: false
  },
  conflict: {
    shouldLog: true,
    shouldNotifyUser: true,
    shouldThrow: true,
    shouldRetry: false
  },
  internal: {
    shouldLog: true,
    shouldNotifyUser: true,
    shouldThrow: true,
    shouldRetry: false
  },
  external: {
    shouldLog: true,
    shouldNotifyUser: true,
    shouldThrow: false,
    shouldRetry: true,
    maxRetries: 2,
    retryDelay: 2000,
    exponentialBackoff: true
  },
  timeout: {
    shouldLog: true,
    shouldNotifyUser: true,
    shouldThrow: false,
    shouldRetry: true,
    maxRetries: 2,
    retryDelay: 1000,
    exponentialBackoff: false
  },
  rate_limit: {
    shouldLog: true,
    shouldNotifyUser: true,
    shouldThrow: false,
    shouldRetry: true,
    maxRetries: 1,
    retryDelay: 5000,
    exponentialBackoff: false
  },
  unknown: {
    shouldLog: true,
    shouldNotifyUser: true,
    shouldThrow: true,
    shouldRetry: false
  }
};

/**
 * Logger interface for error handler
 */
export interface Logger {
  error(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
}

/**
 * User notifier interface for error handler
 */
export interface UserNotifier {
  showError(message: string, actions?: { label: string; callback: () => void }[]): void;
  showWarning(message: string): void;
}

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  logger?: Logger;
  notifier?: UserNotifier;
  strategies?: Partial<Record<ErrorCategory, ErrorHandlingStrategy>>;
}

/**
 * Error handler with strategy-based handling
 */
export class ErrorHandler {
  private strategies: Record<ErrorCategory, ErrorHandlingStrategy>;
  private logger?: Logger;
  private notifier?: UserNotifier;
  private retryAttempts: Map<string, number> = new Map();

  constructor(config: ErrorHandlerConfig = {}) {
    this.logger = config.logger;
    this.notifier = config.notifier;
    this.strategies = { ...DEFAULT_STRATEGIES, ...config.strategies };
  }

  /**
   * Handle an error with automatic strategy selection
   */
  async handleError(
    error: unknown,
    operation: string = 'operation'
  ): Promise<RetryMetadata | void> {
    const vesperaError = normalizeError(error, operation);
    const strategy = this.getStrategy(vesperaError.category());

    return this.handleErrorWithStrategy(vesperaError, strategy, operation);
  }

  /**
   * Handle an error with a specific strategy override
   */
  async handleErrorWithStrategy(
    error: VesperaError,
    strategyOverride: Partial<ErrorHandlingStrategy>,
    operation: string = 'operation'
  ): Promise<RetryMetadata | void> {
    const baseStrategy = this.getStrategy(error.category());
    const strategy = { ...baseStrategy, ...strategyOverride };

    // Log error if configured
    if (strategy.shouldLog && this.logger) {
      this.logger.error(error.message, {
        category: error.category(),
        operation,
        errorCode: error.errorCode(),
        recoverable: error.isRecoverable(),
        context: error.context,
        stack: error.stack
      });
    }

    // Notify user if configured
    if (strategy.shouldNotifyUser && this.notifier) {
      this.notifier.showError(error.userMessage());
    }

    // Handle retry logic
    if (strategy.shouldRetry && error.isRecoverable()) {
      const retryKey = `${operation}:${error.errorCode()}`;
      const attempts = this.retryAttempts.get(retryKey) || 0;
      const maxRetries = strategy.maxRetries || 3;

      if (attempts < maxRetries) {
        this.retryAttempts.set(retryKey, attempts + 1);

        const retryDelay = this.calculateRetryDelay(
          strategy.retryDelay || 1000,
          attempts,
          strategy.exponentialBackoff || false
        );

        return {
          shouldRetry: true,
          retryAfter: retryDelay,
          attemptsRemaining: maxRetries - attempts - 1
        };
      } else {
        // Max retries exceeded, clear attempts and treat as non-retryable
        this.retryAttempts.delete(retryKey);
        if (this.logger) {
          this.logger.warn('Max retry attempts exceeded', {
            operation,
            attempts,
            maxRetries
          });
        }
      }
    }

    // Throw error if configured
    if (strategy.shouldThrow) {
      throw error;
    }
  }

  /**
   * Clear retry attempts for an operation (call after successful retry)
   */
  clearRetryAttempts(operation: string, errorCode: string): void {
    const retryKey = `${operation}:${errorCode}`;
    this.retryAttempts.delete(retryKey);
  }

  /**
   * Set a custom strategy for an error category
   */
  setStrategy(category: ErrorCategory, strategy: ErrorHandlingStrategy): void {
    this.strategies[category] = strategy;
  }

  /**
   * Get the strategy for an error category
   */
  getStrategy(category: ErrorCategory): ErrorHandlingStrategy {
    return this.strategies[category] || this.strategies.unknown;
  }

  /**
   * Calculate retry delay with optional exponential backoff
   */
  private calculateRetryDelay(
    baseDelay: number,
    attempt: number,
    exponentialBackoff: boolean
  ): number {
    if (!exponentialBackoff) {
      return baseDelay;
    }

    // Exponential backoff: baseDelay * (2 ^ attempt)
    const exponentialDelay = baseDelay * Math.pow(2, attempt);

    // Add jitter (±20%) to prevent thundering herd
    const jitter = exponentialDelay * 0.2 * (Math.random() * 2 - 1);

    return Math.floor(exponentialDelay + jitter);
  }
}

/**
 * Create a default console-based logger
 */
export function createConsoleLogger(): Logger {
  return {
    error(message: string, context?: Record<string, unknown>) {
      console.error('[ERROR]', message, context);
    },
    warn(message: string, context?: Record<string, unknown>) {
      console.warn('[WARN]', message, context);
    },
    info(message: string, context?: Record<string, unknown>) {
      console.info('[INFO]', message, context);
    }
  };
}

/**
 * Create a no-op logger (for testing or when logging is disabled)
 */
export function createNoOpLogger(): Logger {
  return {
    error() {},
    warn() {},
    info() {}
  };
}