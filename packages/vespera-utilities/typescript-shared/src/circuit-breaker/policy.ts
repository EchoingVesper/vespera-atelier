/**
 * Circuit Breaker Policies
 *
 * Predefined policies for common use cases.
 */

import { CircuitBreakerOptions } from './types.js';

/**
 * Policy presets for different scenarios
 */
export const CircuitBreakerPolicies = {
  /**
   * Aggressive policy - fails fast, recovers slowly
   *
   * Best for:
   * - Critical services where availability is paramount
   * - Services with high SLA requirements
   * - Protecting against cascading failures
   *
   * @example
   * ```typescript
   * const breaker = new CircuitBreaker(CircuitBreakerPolicies.aggressive());
   * ```
   */
  aggressive: (): CircuitBreakerOptions => ({
    failureThreshold: 3,
    recoveryTimeout: 60000, // 1 minute
    requestTimeout: 5000, // 5 seconds
    maxRetries: 1,
    initialBackoff: 50,
    maxBackoff: 5000,
    backoffMultiplier: 2.0,
    successThreshold: 5,
  }),

  /**
   * Normal policy - balanced approach (default)
   *
   * Best for:
   * - Most production use cases
   * - External API calls
   * - General-purpose service protection
   *
   * @example
   * ```typescript
   * const breaker = new CircuitBreaker(CircuitBreakerPolicies.normal());
   * ```
   */
  normal: (): CircuitBreakerOptions => ({
    failureThreshold: 5,
    recoveryTimeout: 30000, // 30 seconds
    requestTimeout: 30000, // 30 seconds
    maxRetries: 3,
    initialBackoff: 100,
    maxBackoff: 30000,
    backoffMultiplier: 2.0,
    successThreshold: 3,
  }),

  /**
   * Lenient policy - allows more failures, recovers quickly
   *
   * Best for:
   * - Development/testing environments
   * - Services with intermittent failures
   * - Non-critical background jobs
   * - Services that are naturally unreliable
   *
   * @example
   * ```typescript
   * const breaker = new CircuitBreaker(CircuitBreakerPolicies.lenient());
   * ```
   */
  lenient: (): CircuitBreakerOptions => ({
    failureThreshold: 10,
    recoveryTimeout: 10000, // 10 seconds
    requestTimeout: 60000, // 1 minute
    maxRetries: 5,
    initialBackoff: 200,
    maxBackoff: 60000,
    backoffMultiplier: 2.0,
    successThreshold: 2,
  }),

  /**
   * Strict policy - extremely low tolerance
   *
   * Best for:
   * - Canary deployments
   * - Health checks
   * - Services where any failure is critical
   *
   * @example
   * ```typescript
   * const breaker = new CircuitBreaker(CircuitBreakerPolicies.strict());
   * ```
   */
  strict: (): CircuitBreakerOptions => ({
    failureThreshold: 2,
    recoveryTimeout: 120000, // 2 minutes
    requestTimeout: 3000, // 3 seconds
    maxRetries: 0,
    initialBackoff: 100,
    maxBackoff: 10000,
    backoffMultiplier: 2.0,
    successThreshold: 10,
  }),

  /**
   * Fast recovery policy - quick to open and close
   *
   * Best for:
   * - Services with transient failures
   * - Load balancing scenarios
   * - Microservices with multiple instances
   *
   * @example
   * ```typescript
   * const breaker = new CircuitBreaker(CircuitBreakerPolicies.fastRecovery());
   * ```
   */
  fastRecovery: (): CircuitBreakerOptions => ({
    failureThreshold: 5,
    recoveryTimeout: 5000, // 5 seconds
    requestTimeout: 10000, // 10 seconds
    maxRetries: 2,
    initialBackoff: 50,
    maxBackoff: 1000,
    backoffMultiplier: 1.5,
    successThreshold: 1,
  }),
};

/**
 * Create a custom policy based on service characteristics
 *
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker(
 *   createCustomPolicy({
 *     latency: 'high',
 *     reliability: 'low',
 *     importance: 'high'
 *   })
 * );
 * ```
 */
export function createCustomPolicy(options: {
  /** Expected service latency */
  latency?: 'low' | 'medium' | 'high';
  /** Service reliability */
  reliability?: 'high' | 'medium' | 'low';
  /** Importance of the service */
  importance?: 'critical' | 'high' | 'medium' | 'low';
}): CircuitBreakerOptions {
  const { latency = 'medium', reliability = 'medium', importance = 'medium' } = options;

  // Base configuration
  const config: CircuitBreakerOptions = {
    failureThreshold: 5,
    recoveryTimeout: 30000,
    requestTimeout: 30000,
    maxRetries: 3,
    initialBackoff: 100,
    maxBackoff: 30000,
    backoffMultiplier: 2.0,
    successThreshold: 3,
  };

  // Adjust for latency
  if (latency === 'high') {
    config.requestTimeout = 60000;
    config.maxBackoff = 60000;
  } else if (latency === 'low') {
    config.requestTimeout = 5000;
    config.maxBackoff = 5000;
  }

  // Adjust for reliability
  if (reliability === 'low') {
    config.failureThreshold = 10;
    config.maxRetries = 5;
    config.successThreshold = 2;
  } else if (reliability === 'high') {
    config.failureThreshold = 3;
    config.maxRetries = 1;
    config.successThreshold = 5;
  }

  // Adjust for importance
  if (importance === 'critical') {
    config.failureThreshold = 2;
    config.recoveryTimeout = 60000;
    config.successThreshold = 10;
  } else if (importance === 'low') {
    config.failureThreshold = 10;
    config.recoveryTimeout = 10000;
    config.maxRetries = 5;
  }

  return config;
}

/**
 * Helper to create a policy optimized for external API calls
 *
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker(
 *   createApiPolicy('https://api.example.com')
 * );
 * ```
 */
export function createApiPolicy(
  apiUrl: string,
  options?: Partial<CircuitBreakerOptions>
): CircuitBreakerOptions {
  // Extract hostname for service name
  let serviceName = 'api';
  try {
    const url = new URL(apiUrl);
    serviceName = url.hostname;
  } catch {
    // Invalid URL, use default
  }

  return {
    ...CircuitBreakerPolicies.normal(),
    serviceName,
    ...options,
  };
}