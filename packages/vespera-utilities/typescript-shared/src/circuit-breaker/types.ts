/**
 * Circuit Breaker Types
 *
 * Type definitions for circuit breaker pattern implementation.
 */

/**
 * Circuit breaker states
 */
export enum CircuitState {
  /** Circuit is closed - requests pass through normally */
  Closed = 'closed',
  /** Circuit is open - requests fail fast */
  Open = 'open',
  /** Circuit is half-open - testing if service has recovered */
  HalfOpen = 'half_open',
}

/**
 * Configuration options for circuit breaker
 */
export interface CircuitBreakerOptions {
  /** Number of failures before opening the circuit (default: 5) */
  failureThreshold?: number;

  /** Time to wait before transitioning from Open to HalfOpen (ms, default: 30000) */
  recoveryTimeout?: number;

  /** Timeout for individual requests (ms, default: 30000) */
  requestTimeout?: number;

  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;

  /** Initial backoff delay for retries (ms, default: 100) */
  initialBackoff?: number;

  /** Maximum backoff delay (ms, default: 30000) */
  maxBackoff?: number;

  /** Backoff multiplier for exponential backoff (default: 2.0) */
  backoffMultiplier?: number;

  /** Success threshold for transitioning from HalfOpen to Closed (default: 3) */
  successThreshold?: number;

  /** Callback fired when state changes */
  onStateChange?: (oldState: CircuitState, newState: CircuitState) => void;

  /** Service name for logging/metrics */
  serviceName?: string;
}

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  /** Current circuit state */
  state: CircuitState;

  /** Current failure count in the window */
  failureCount: number;

  /** Current success count in half-open state */
  successCount: number;

  /** Total requests processed */
  totalRequests: number;

  /** Total failed requests */
  failedRequests: number;

  /** Timestamp of last failure (ms) */
  lastFailureTime: number | null;

  /** Timestamp of last success (ms) */
  lastSuccessTime: number | null;

  /** Number of state transitions */
  stateTransitions: number;

  /** Current failure rate (0-100) */
  failureRate: number;
}

/**
 * Circuit breaker event types
 */
export type CircuitBreakerEvent =
  | { type: 'state_change'; oldState: CircuitState; newState: CircuitState }
  | { type: 'success'; duration: number }
  | { type: 'failure'; error: Error; duration: number }
  | { type: 'timeout'; duration: number }
  | { type: 'rejected'; reason: string };

/**
 * Circuit breaker error
 */
export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly state: CircuitState,
    public readonly stats: CircuitBreakerStats
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}