/**
 * Circuit Breaker Implementation
 * 
 * Prevents cascading failures by tracking failures and opening the circuit
 * when failure thresholds are exceeded. Supports automatic recovery with
 * half-open state for health checks.
 */

import * as vscode from 'vscode';
import { VesperaLogger } from '../../logging/VesperaLogger';
import { CircuitBreakerConfig, CircuitBreakerState } from '../../../types/security';

export interface CircuitBreakerStats {
  state: CircuitBreakerState;
  failures: number;
  successes: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  halfOpenCalls: number;
  totalCalls: number;
  failureRate: number;
  uptime: number;
  nextRetryTime: number;
}

/**
 * Circuit breaker for fault tolerance and resilience
 */
export class CircuitBreaker implements vscode.Disposable {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private lastSuccessTime = 0;
  private halfOpenCalls = 0;
  private totalCalls = 0;
  private readonly logger: VesperaLogger;
  private disposed = false;
  private readonly createdAt = Date.now();

  // Health monitoring
  private healthCheckTimer?: NodeJS.Timeout;
  private stateChangeListeners: Array<(newState: CircuitBreakerState, oldState: CircuitBreakerState) => void> = [];

  constructor(
    private config: CircuitBreakerConfig,
    logger: VesperaLogger,
    private name: string = 'unnamed'
  ) {
    this.logger = logger.createChild(`CircuitBreaker:${name}`);
    this.logger.info('CircuitBreaker created', { config, name });
    
    this.startHealthMonitoring();
  }

  /**
   * Check if a request is allowed through the circuit breaker
   */
  isRequestAllowed(): boolean {
    if (this.disposed) {
      this.logger.warn('Request check on disposed circuit breaker');
      return false;
    }

    const now = Date.now();
    this.totalCalls++;

    switch (this.state) {
      case CircuitBreakerState.CLOSED:
        return true;

      case CircuitBreakerState.OPEN:
        // Check if recovery timeout has passed
        if (now - this.lastFailureTime >= this.config.recoveryTimeout) {
          this.transitionToHalfOpen();
          return true;
        }
        return false;

      case CircuitBreakerState.HALF_OPEN:
        if (this.halfOpenCalls < this.config.halfOpenMaxCalls) {
          this.halfOpenCalls++;
          return true;
        }
        return false;

      default:
        this.logger.error('Invalid circuit breaker state', { state: this.state });
        return false;
    }
  }

  /**
   * Record a successful operation
   */
  recordSuccess(): void {
    if (this.disposed) return;

    this.successes++;
    this.lastSuccessTime = Date.now();

    this.logger.debug('Success recorded', { 
      state: this.state, 
      successes: this.successes,
      halfOpenCalls: this.halfOpenCalls 
    });

    switch (this.state) {
      case CircuitBreakerState.HALF_OPEN:
        // Check if we've had enough successful calls to close the circuit
        if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
          this.transitionToClosed();
        }
        break;
        
      case CircuitBreakerState.CLOSED:
        // Gradual recovery: reduce failure count on success
        if (this.failures > 0) {
          this.failures = Math.max(0, this.failures - 1);
          this.logger.debug('Failure count reduced due to success', { failures: this.failures });
        }
        break;
    }
  }

  /**
   * Record a failed operation
   */
  recordFailure(): void {
    if (this.disposed) return;

    this.failures++;
    this.lastFailureTime = Date.now();

    this.logger.debug('Failure recorded', { 
      state: this.state, 
      failures: this.failures,
      threshold: this.config.failureThreshold 
    });

    switch (this.state) {
      case CircuitBreakerState.CLOSED:
        if (this.failures >= this.config.failureThreshold) {
          this.transitionToOpen();
        }
        break;
        
      case CircuitBreakerState.HALF_OPEN:
        // Any failure in half-open state immediately opens the circuit
        this.transitionToOpen();
        break;
    }
  }

  /**
   * Get time remaining until retry is allowed (in milliseconds)
   */
  getRetryAfter(): number {
    if (this.disposed || this.state !== CircuitBreakerState.OPEN) {
      return 0;
    }
    
    const elapsed = Date.now() - this.lastFailureTime;
    return Math.max(0, this.config.recoveryTimeout - elapsed);
  }

  /**
   * Get comprehensive circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    const now = Date.now();
    const failureRate = this.totalCalls > 0 
      ? this.failures / this.totalCalls 
      : 0;
    
    const nextRetryTime = this.state === CircuitBreakerState.OPEN
      ? this.lastFailureTime + this.config.recoveryTimeout
      : 0;

    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      halfOpenCalls: this.halfOpenCalls,
      totalCalls: this.totalCalls,
      failureRate,
      uptime: now - this.createdAt,
      nextRetryTime
    };
  }

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Force circuit breaker to specific state (for testing/manual control)
   */
  forceState(newState: CircuitBreakerState): void {
    if (this.disposed) return;
    
    const oldState = this.state;
    this.state = newState;
    
    switch (newState) {
      case CircuitBreakerState.CLOSED:
        this.failures = 0;
        this.halfOpenCalls = 0;
        break;
      case CircuitBreakerState.HALF_OPEN:
        this.halfOpenCalls = 0;
        break;
    }
    
    this.logger.warn('Circuit breaker state forced', { 
      from: oldState, 
      to: newState,
      name: this.name 
    });
    
    this.notifyStateChange(newState, oldState);
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    if (this.disposed) return;
    
    const oldStats = this.getStats();
    
    this.state = CircuitBreakerState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = 0;
    this.lastSuccessTime = 0;
    this.halfOpenCalls = 0;
    this.totalCalls = 0;
    
    this.logger.info('Circuit breaker reset', { 
      name: this.name,
      oldStats 
    });
  }

  /**
   * Add listener for state changes
   */
  onStateChange(listener: (newState: CircuitBreakerState, oldState: CircuitBreakerState) => void): vscode.Disposable {
    this.stateChangeListeners.push(listener);
    
    return {
      dispose: () => {
        const index = this.stateChangeListeners.indexOf(listener);
        if (index >= 0) {
          this.stateChangeListeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Check if circuit breaker is healthy
   */
  isHealthy(): boolean {
    const stats = this.getStats();
    
    // Consider healthy if:
    // - Not in OPEN state, or
    // - In OPEN state but close to recovery time, or
    // - Low failure rate overall
    return !this.disposed && (
      this.state !== CircuitBreakerState.OPEN ||
      this.getRetryAfter() < 1000 || // Less than 1 second to retry
      stats.failureRate < 0.5 // Overall failure rate < 50%
    );
  }

  /**
   * Get a health check result
   */
  getHealthCheck(): {
    healthy: boolean;
    state: CircuitBreakerState;
    retryAfter: number;
    failureRate: number;
    uptime: number;
  } {
    const stats = this.getStats();
    return {
      healthy: this.isHealthy(),
      state: this.state,
      retryAfter: this.getRetryAfter(),
      failureRate: stats.failureRate,
      uptime: stats.uptime
    };
  }

  /**
   * Transition to CLOSED state
   */
  private transitionToClosed(): void {
    const oldState = this.state;
    this.state = CircuitBreakerState.CLOSED;
    this.failures = 0; // Reset failure count
    this.halfOpenCalls = 0;
    
    this.logger.info('Circuit breaker closed', { 
      name: this.name,
      successes: this.successes,
      recoveryTime: Date.now() - this.lastFailureTime
    });
    
    this.notifyStateChange(CircuitBreakerState.CLOSED, oldState);
  }

  /**
   * Transition to OPEN state
   */
  private transitionToOpen(): void {
    const oldState = this.state;
    this.state = CircuitBreakerState.OPEN;
    this.halfOpenCalls = 0;
    
    this.logger.warn('Circuit breaker opened', { 
      name: this.name,
      failures: this.failures,
      threshold: this.config.failureThreshold,
      recoveryTimeoutMs: this.config.recoveryTimeout
    });
    
    this.notifyStateChange(CircuitBreakerState.OPEN, oldState);
  }

  /**
   * Transition to HALF_OPEN state
   */
  private transitionToHalfOpen(): void {
    const oldState = this.state;
    this.state = CircuitBreakerState.HALF_OPEN;
    this.halfOpenCalls = 0;
    
    this.logger.info('Circuit breaker transitioning to half-open', { 
      name: this.name,
      timeInOpenState: Date.now() - this.lastFailureTime
    });
    
    this.notifyStateChange(CircuitBreakerState.HALF_OPEN, oldState);
  }

  /**
   * Notify all listeners of state change
   */
  private notifyStateChange(newState: CircuitBreakerState, oldState: CircuitBreakerState): void {
    for (const listener of this.stateChangeListeners) {
      try {
        listener(newState, oldState);
      } catch (error) {
        this.logger.error('State change listener failed', error);
      }
    }
  }

  /**
   * Start health monitoring timer
   */
  private startHealthMonitoring(): void {
    if (this.disposed) return;
    
    // Monitor every monitoring period
    this.healthCheckTimer = setInterval(() => {
      if (!this.disposed) {
        this.performHealthCheck();
      }
    }, this.config.monitoringPeriod);
    
    this.logger.debug('Health monitoring started', { 
      period: this.config.monitoringPeriod 
    });
  }

  /**
   * Perform periodic health check
   */
  private performHealthCheck(): void {
    const stats = this.getStats();
    
    // Log health status periodically
    if (stats.totalCalls > 0 && stats.totalCalls % 100 === 0) {
      this.logger.debug('Circuit breaker health check', {
        name: this.name,
        ...stats
      });
    }
    
    // Auto-recovery logic could be added here if needed
    // For example, gradually reducing failure count over time
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
      this.logger.debug('Health monitoring stopped');
    }
  }

  /**
   * Dispose the circuit breaker and cleanup resources
   */
  dispose(): void {
    if (this.disposed) return;
    
    this.stopHealthMonitoring();
    this.stateChangeListeners.length = 0;
    this.disposed = true;
    
    this.logger.info('CircuitBreaker disposed', { 
      name: this.name,
      finalStats: this.getStats() 
    });
  }
}