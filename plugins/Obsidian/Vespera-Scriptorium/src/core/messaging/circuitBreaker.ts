/**
 * Circuit breaker pattern implementation for A2A messaging
 * 
 * Prevents cascading failures by temporarily disabling operations
 * when a failure threshold is reached.
 */
import { EventEmitter } from 'events';

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation, requests flow through
  OPEN = 'OPEN',         // Circuit is open, requests fail fast
  HALF_OPEN = 'HALF_OPEN' // Testing if the system has recovered
}

/**
 * Circuit breaker configuration options
 */
export interface CircuitBreakerOptions {
  failureThreshold: number;       // Number of failures before opening the circuit
  resetTimeout: number;           // Time in ms to wait before attempting reset (half-open)
  halfOpenSuccessThreshold: number; // Number of successes needed in half-open state to close
  monitorInterval?: number;       // Interval in ms to check for reset timeout
  timeout?: number;               // Timeout in ms for operations
  enableLogging?: boolean;        // Whether to log circuit state changes
}

/**
 * Circuit breaker events
 */
export interface CircuitBreakerEvents {
  stateChanged: (from: CircuitState, to: CircuitState, circuitId: string) => void;
  failure: (error: Error, circuitId: string) => void;
  success: (circuitId: string) => void;
  timeout: (circuitId: string) => void;
  rejected: (circuitId: string) => void;
}

/**
 * Circuit breaker implementation for preventing cascading failures
 */
export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime: number = 0;
  private monitorInterval: NodeJS.Timeout | null = null;
  private readonly id: string;
  private readonly options: Required<CircuitBreakerOptions>;

  constructor(id: string, options: CircuitBreakerOptions) {
    super();
    this.id = id;
    
    // Set default options with proper merging to avoid duplicate specifications
    const defaultOptions = {
      failureThreshold: 5,
      resetTimeout: 30000, // 30 seconds
      halfOpenSuccessThreshold: 3,
      monitorInterval: 5000, // 5 seconds
      timeout: 10000, // 10 seconds
      enableLogging: false
    };
    
    this.options = { ...defaultOptions, ...options };

    // Start monitoring for state transitions
    this.startMonitoring();
  }

  /**
   * Get the current state of the circuit
   * 
   * @returns The current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get the circuit ID
   * 
   * @returns The circuit ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * Execute a function with circuit breaker protection
   * 
   * @param fn - The function to execute
   * @returns Promise that resolves with the function result or rejects if circuit is open
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // If circuit is open, fail fast
    if (this.state === CircuitState.OPEN) {
      const error = new Error(`Circuit ${this.id} is OPEN`);
      this.emit('rejected', this.id);
      
      if (this.options.enableLogging) {
        console.log(`[CircuitBreaker:${this.id}] Rejected request in OPEN state`);
      }
      
      throw error;
    }

    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const error = new Error(`Circuit ${this.id} operation timed out after ${this.options.timeout}ms`);
        reject(error);
      }, this.options.timeout);
    });

    try {
      // Race between the function and the timeout
      const result = await Promise.race([fn(), timeoutPromise]);
      
      // Record success
      this.recordSuccess();
      return result;
    } catch (error) {
      // Record failure
      this.recordFailure(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Force the circuit into a specific state
   * 
   * @param state - The state to force
   */
  forceState(state: CircuitState): void {
    if (state === this.state) {
      return;
    }

    const previousState = this.state;
    this.state = state;
    
    // Reset counters
    if (state === CircuitState.CLOSED) {
      this.failures = 0;
      this.successes = 0;
    } else if (state === CircuitState.HALF_OPEN) {
      this.successes = 0;
    }

    this.emit('stateChanged', previousState, state, this.id);
    
    if (this.options.enableLogging) {
      console.log(`[CircuitBreaker:${this.id}] State changed from ${previousState} to ${state}`);
    }
  }

  /**
   * Reset the circuit breaker to closed state
   */
  reset(): void {
    const previousState = this.state;
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    
    if (previousState !== CircuitState.CLOSED) {
      this.emit('stateChanged', previousState, CircuitState.CLOSED, this.id);
      
      if (this.options.enableLogging) {
        console.log(`[CircuitBreaker:${this.id}] Reset to CLOSED state`);
      }
    }
  }

  /**
   * Get current metrics for the circuit breaker
   * 
   * @returns Object with current metrics
   */
  getMetrics(): {
    state: CircuitState;
    failures: number;
    successes: number;
    lastFailureTime: number;
    timeSinceLastFailure: number;
  } {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      timeSinceLastFailure: Date.now() - this.lastFailureTime
    };
  }

  /**
   * Start monitoring for state transitions
   * 
   * @private
   */
  private startMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }

    this.monitorInterval = setInterval(() => {
      this.checkStateTransition();
    }, this.options.monitorInterval);
  }

  /**
   * Stop monitoring for state transitions
   */
  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  /**
   * Record a successful operation
   * 
   * @private
   */
  private recordSuccess(): void {
    this.emit('success', this.id);
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      
      if (this.options.enableLogging) {
        console.log(`[CircuitBreaker:${this.id}] Success in HALF_OPEN state (${this.successes}/${this.options.halfOpenSuccessThreshold})`);
      }
      
      // If we've reached the success threshold, close the circuit
      if (this.successes >= this.options.halfOpenSuccessThreshold) {
        this.forceState(CircuitState.CLOSED);
      }
    }
  }

  /**
   * Record a failed operation
   * 
   * @param error - The error that occurred
   * @private
   */
  private recordFailure(error: Error): void {
    this.lastFailureTime = Date.now();
    this.emit('failure', error, this.id);
    
    if (this.state === CircuitState.CLOSED) {
      this.failures++;
      
      if (this.options.enableLogging) {
        console.log(`[CircuitBreaker:${this.id}] Failure in CLOSED state (${this.failures}/${this.options.failureThreshold})`);
      }
      
      // If we've reached the failure threshold, open the circuit
      if (this.failures >= this.options.failureThreshold) {
        this.forceState(CircuitState.OPEN);
      }
    } else if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open state opens the circuit again
      if (this.options.enableLogging) {
        console.log(`[CircuitBreaker:${this.id}] Failure in HALF_OPEN state, reopening circuit`);
      }
      
      this.forceState(CircuitState.OPEN);
    }
  }

  /**
   * Check if a state transition should occur
   * 
   * @private
   */
  private checkStateTransition(): void {
    // If circuit is open and reset timeout has elapsed, transition to half-open
    if (
      this.state === CircuitState.OPEN &&
      Date.now() - this.lastFailureTime > this.options.resetTimeout
    ) {
      if (this.options.enableLogging) {
        console.log(`[CircuitBreaker:${this.id}] Reset timeout elapsed, transitioning to HALF_OPEN`);
      }
      
      this.forceState(CircuitState.HALF_OPEN);
    }
  }
}

/**
 * Circuit breaker registry for managing multiple circuit breakers
 */
export class CircuitBreakerRegistry {
  private circuits: Map<string, CircuitBreaker> = new Map();
  private defaultOptions: CircuitBreakerOptions;

  constructor(defaultOptions: CircuitBreakerOptions) {
    this.defaultOptions = defaultOptions;
  }

  /**
   * Get or create a circuit breaker
   * 
   * @param id - The circuit ID
   * @param options - Optional circuit-specific options
   * @returns The circuit breaker instance
   */
  getOrCreate(id: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
    if (this.circuits.has(id)) {
      return this.circuits.get(id)!;
    }

    const mergedOptions = {
      ...this.defaultOptions,
      ...options
    };

    const circuit = new CircuitBreaker(id, mergedOptions);
    this.circuits.set(id, circuit);
    return circuit;
  }

  /**
   * Get a circuit breaker by ID
   * 
   * @param id - The circuit ID
   * @returns The circuit breaker or undefined if not found
   */
  get(id: string): CircuitBreaker | undefined {
    return this.circuits.get(id);
  }

  /**
   * Check if a circuit breaker exists
   * 
   * @param id - The circuit ID
   * @returns True if the circuit exists
   */
  exists(id: string): boolean {
    return this.circuits.has(id);
  }

  /**
   * Remove a circuit breaker
   * 
   * @param id - The circuit ID
   * @returns True if the circuit was removed
   */
  remove(id: string): boolean {
    if (!this.circuits.has(id)) {
      return false;
    }

    const circuit = this.circuits.get(id)!;
    circuit.stopMonitoring();
    this.circuits.delete(id);
    return true;
  }

  /**
   * Get all circuit breakers
   * 
   * @returns Array of all circuit breakers
   */
  getAll(): CircuitBreaker[] {
    return Array.from(this.circuits.values());
  }

  /**
   * Get all circuit IDs
   * 
   * @returns Array of all circuit IDs
   */
  getAllIds(): string[] {
    return Array.from(this.circuits.keys());
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const circuit of this.circuits.values()) {
      circuit.reset();
    }
  }
}

// Create and export a singleton instance
export const circuitBreakerRegistry = new CircuitBreakerRegistry({
  failureThreshold: 5,
  resetTimeout: 30000,
  halfOpenSuccessThreshold: 3
});
