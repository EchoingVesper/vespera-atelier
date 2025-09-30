/**
 * Circuit Breaker Module
 *
 * Implements the circuit breaker pattern to prevent cascading failures
 * when external services are unavailable or degraded.
 *
 * @module circuit-breaker
 *
 * @example Basic usage
 * ```typescript
 * import { CircuitBreaker } from '@vespera/typescript-shared';
 *
 * const breaker = new CircuitBreaker({
 *   failureThreshold: 5,
 *   recoveryTimeout: 30000,
 *   requestTimeout: 5000,
 * });
 *
 * // Wrap API calls
 * const data = await breaker.execute(async () => {
 *   const response = await fetch('https://api.example.com/data');
 *   if (!response.ok) throw new Error('API error');
 *   return response.json();
 * });
 * ```
 *
 * @example Using policies
 * ```typescript
 * import { CircuitBreaker, CircuitBreakerPolicies } from '@vespera/typescript-shared';
 *
 * const breaker = new CircuitBreaker(CircuitBreakerPolicies.aggressive());
 * ```
 *
 * @example State monitoring
 * ```typescript
 * const breaker = new CircuitBreaker({
 *   onStateChange: (oldState, newState) => {
 *     console.log(`Circuit transitioned from ${oldState} to ${newState}`);
 *   }
 * });
 *
 * // Get stats
 * const stats = breaker.getStats();
 * console.log(`Failure rate: ${stats.failureRate}%`);
 * ```
 */

// Core implementation
export { CircuitBreaker } from './breaker.js';

// Types
export {
  CircuitState,
  CircuitBreakerError,
  type CircuitBreakerOptions,
  type CircuitBreakerStats,
  type CircuitBreakerEvent,
} from './types.js';

// Policies
export {
  CircuitBreakerPolicies,
  createCustomPolicy,
  createApiPolicy,
} from './policy.js';