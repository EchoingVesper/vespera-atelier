/**
 * Circuit Breaker Implementation
 *
 * Implements circuit breaker pattern to prevent cascading failures
 * when external services are unavailable or degraded.
 *
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker({
 *   failureThreshold: 5,
 *   recoveryTimeout: 30000,
 *   requestTimeout: 5000,
 * });
 *
 * // Wrap API calls
 * const result = await breaker.execute(async () => {
 *   const response = await fetch('https://api.example.com/data');
 *   return response.json();
 * });
 * ```
 */

import {
  CircuitState,
  CircuitBreakerOptions,
  CircuitBreakerStats,
  CircuitBreakerError,
} from './types.js';

/**
 * Circuit breaker configuration with defaults
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  requestTimeout: number;
  maxRetries: number;
  initialBackoff: number;
  maxBackoff: number;
  backoffMultiplier: number;
  successThreshold: number;
  onStateChange?: (oldState: CircuitState, newState: CircuitState) => void;
  serviceName: string;
}

/**
 * Circuit breaker implementation with state machine and timeout support
 */
export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitState = CircuitState.Closed;
  private failureCount = 0;
  private successCount = 0;
  private totalRequests = 0;
  private failedRequests = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private stateTransitions = 0;

  constructor(options: CircuitBreakerOptions = {}) {
    this.config = this.validateAndMergeConfig(options);
  }

  /**
   * Validate and merge user options with defaults
   */
  private validateAndMergeConfig(options: CircuitBreakerOptions): CircuitBreakerConfig {
    const config: CircuitBreakerConfig = {
      failureThreshold: options.failureThreshold ?? 5,
      recoveryTimeout: options.recoveryTimeout ?? 30000,
      requestTimeout: options.requestTimeout ?? 30000,
      maxRetries: options.maxRetries ?? 3,
      initialBackoff: options.initialBackoff ?? 100,
      maxBackoff: options.maxBackoff ?? 30000,
      backoffMultiplier: options.backoffMultiplier ?? 2.0,
      successThreshold: options.successThreshold ?? 3,
      onStateChange: options.onStateChange,
      serviceName: options.serviceName ?? 'default',
    };

    // Validation
    if (config.failureThreshold <= 0) {
      throw new Error('failureThreshold must be greater than 0');
    }
    if (config.failureThreshold > 1000) {
      throw new Error('failureThreshold should not exceed 1000');
    }
    if (config.successThreshold <= 0) {
      throw new Error('successThreshold must be greater than 0');
    }
    if (config.successThreshold > 100) {
      throw new Error('successThreshold should not exceed 100');
    }
    if (config.recoveryTimeout <= 0) {
      throw new Error('recoveryTimeout must be greater than 0');
    }
    if (config.requestTimeout <= 0) {
      throw new Error('requestTimeout must be greater than 0');
    }
    if (config.maxRetries > 10) {
      throw new Error('maxRetries should not exceed 10');
    }
    if (config.initialBackoff <= 0) {
      throw new Error('initialBackoff must be greater than 0');
    }
    if (config.initialBackoff > config.maxBackoff) {
      throw new Error('initialBackoff cannot be greater than maxBackoff');
    }
    if (config.backoffMultiplier <= 1.0) {
      throw new Error('backoffMultiplier must be greater than 1.0');
    }
    if (config.backoffMultiplier > 10.0) {
      throw new Error('backoffMultiplier should not exceed 10.0');
    }

    return config;
  }

  /**
   * Execute an async operation with circuit breaker protection
   *
   * @example
   * ```typescript
   * // Simple API call
   * const data = await breaker.execute(async () => {
   *   const response = await fetch('https://api.example.com/data');
   *   if (!response.ok) throw new Error('API error');
   *   return response.json();
   * });
   *
   * // With error handling
   * try {
   *   const result = await breaker.execute(async () => {
   *     return await someAsyncOperation();
   *   });
   * } catch (error) {
   *   if (error instanceof CircuitBreakerError) {
   *     console.log('Circuit is open, service unavailable');
   *   }
   * }
   * ```
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.shouldRejectRequest()) {
      const error = new CircuitBreakerError(
        `Circuit breaker is OPEN for service: ${this.config.serviceName}`,
        this.state,
        this.getStats()
      );
      throw error;
    }

    // Execute with retries and exponential backoff
    let lastError: Error | null = null;
    let backoff = this.config.initialBackoff;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      this.totalRequests++;

      try {
        // Execute with timeout
        const result = await this.executeWithTimeout(operation, this.config.requestTimeout);

        this.recordSuccess();
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't sleep after the last attempt
        if (attempt < this.config.maxRetries) {
          await this.sleep(backoff);

          // Exponential backoff
          backoff = Math.min(
            backoff * this.config.backoffMultiplier,
            this.config.maxBackoff
          );
        }
      }
    }

    // All retries failed
    this.recordFailure();

    throw new Error(
      `All ${this.config.maxRetries + 1} retry attempts failed for service: ${this.config.serviceName}. Last error: ${lastError?.message}`
    );
  }

  /**
   * Execute operation with timeout using Promise.race()
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Request timeout after ${timeout}ms`));
        }, timeout);
      }),
    ]);
  }

  /**
   * Check if requests should be rejected
   */
  private shouldRejectRequest(): boolean {
    if (this.state === CircuitState.Closed) {
      return false;
    }

    if (this.state === CircuitState.Open) {
      // Check if recovery timeout has passed
      if (this.lastFailureTime !== null) {
        const timeSinceFailure = Date.now() - this.lastFailureTime;
        if (timeSinceFailure >= this.config.recoveryTimeout) {
          this.transitionTo(CircuitState.HalfOpen);
          this.successCount = 0;
          return false;
        }
      }
      return true;
    }

    // HalfOpen state - allow requests through
    return false;
  }

  /**
   * Record a successful operation
   */
  private recordSuccess(): void {
    this.successCount++;
    this.lastSuccessTime = Date.now();

    if (this.state === CircuitState.HalfOpen) {
      if (this.successCount >= this.config.successThreshold) {
        this.transitionTo(CircuitState.Closed);
        this.failureCount = 0;
        this.successCount = 0;
      }
    } else if (this.state === CircuitState.Closed) {
      // Reset failure count on successful requests
      this.failureCount = 0;
    }
  }

  /**
   * Record a failed operation
   */
  private recordFailure(): void {
    this.failureCount++;
    this.failedRequests++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.Closed) {
      if (this.failureCount >= this.config.failureThreshold) {
        this.transitionTo(CircuitState.Open);
      }
    } else if (this.state === CircuitState.HalfOpen) {
      this.transitionTo(CircuitState.Open);
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    if (oldState !== newState) {
      this.state = newState;
      this.stateTransitions++;

      if (this.config.onStateChange) {
        this.config.onStateChange(oldState, newState);
      }
    }
  }

  /**
   * Sleep utility for backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get comprehensive statistics
   */
  getStats(): CircuitBreakerStats {
    const failureRate = this.totalRequests > 0
      ? (this.failedRequests / this.totalRequests) * 100
      : 0;

    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      failedRequests: this.failedRequests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      stateTransitions: this.stateTransitions,
      failureRate,
    };
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    const oldState = this.state;
    this.state = CircuitState.Closed;
    this.failureCount = 0;
    this.successCount = 0;
    this.totalRequests = 0;
    this.failedRequests = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;

    if (oldState !== CircuitState.Closed && this.config.onStateChange) {
      this.config.onStateChange(oldState, CircuitState.Closed);
    }
  }

  /**
   * Force circuit open (for testing/maintenance)
   */
  forceOpen(): void {
    this.transitionTo(CircuitState.Open);
    this.lastFailureTime = Date.now();
  }

  /**
   * Force circuit closed (for testing/maintenance)
   */
  forceClosed(): void {
    this.transitionTo(CircuitState.Closed);
    this.failureCount = 0;
  }

  /**
   * Get service name
   */
  getServiceName(): string {
    return this.config.serviceName;
  }

  /**
   * Get configuration
   */
  getConfig(): Readonly<CircuitBreakerConfig> {
    return { ...this.config };
  }
}