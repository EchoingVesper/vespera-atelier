/**
 * Circuit Breaker Usage Examples
 *
 * This file demonstrates various ways to use the circuit breaker module.
 */

import {
  CircuitBreaker,
  CircuitBreakerPolicies,
  CircuitState,
  CircuitBreakerError,
  createApiPolicy,
  createCustomPolicy,
} from '../src/circuit-breaker/index.js';

// ============================================================================
// Example 1: Basic API Call Protection
// ============================================================================

async function basicExample() {
  const breaker = new CircuitBreaker({
    failureThreshold: 5,
    recoveryTimeout: 30000,
    requestTimeout: 5000,
  });

  try {
    const data = await breaker.execute(async () => {
      const response = await fetch('https://api.example.com/data');
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      return response.json();
    });

    console.log('API call succeeded:', data);
  } catch (error) {
    if (error instanceof CircuitBreakerError) {
      console.error('Circuit is open:', error.message);
      console.error('Stats:', error.stats);
    } else {
      console.error('API call failed:', error);
    }
  }
}

// ============================================================================
// Example 2: Using Predefined Policies
// ============================================================================

async function policyExample() {
  // Aggressive policy - fails fast, recovers slowly
  const aggressiveBreaker = new CircuitBreaker(
    CircuitBreakerPolicies.aggressive()
  );

  // Normal policy (default)
  const normalBreaker = new CircuitBreaker(
    CircuitBreakerPolicies.normal()
  );

  // Lenient policy - allows more failures
  const lenientBreaker = new CircuitBreaker(
    CircuitBreakerPolicies.lenient()
  );

  // Fast recovery policy
  const fastRecoveryBreaker = new CircuitBreaker(
    CircuitBreakerPolicies.fastRecovery()
  );

  // Use the breakers based on your needs
  await normalBreaker.execute(async () => {
    // Your operation here
    return 'success';
  });
}

// ============================================================================
// Example 3: State Change Monitoring
// ============================================================================

async function monitoringExample() {
  const breaker = new CircuitBreaker({
    failureThreshold: 3,
    recoveryTimeout: 10000,
    requestTimeout: 5000,
    onStateChange: (oldState, newState) => {
      console.log(`Circuit breaker state changed: ${oldState} -> ${newState}`);

      if (newState === CircuitState.Open) {
        // Alert your monitoring system
        console.error('ALERT: Circuit breaker opened!');
      } else if (newState === CircuitState.Closed) {
        console.info('Circuit breaker recovered');
      }
    },
  });

  // Simulate some operations
  for (let i = 0; i < 5; i++) {
    try {
      await breaker.execute(async () => {
        // Simulate API that fails
        throw new Error('API unavailable');
      });
    } catch (error) {
      console.log(`Attempt ${i + 1} failed`);
    }
  }

  // Get stats
  const stats = breaker.getStats();
  console.log('Circuit Breaker Stats:', {
    state: stats.state,
    failureRate: `${stats.failureRate.toFixed(2)}%`,
    totalRequests: stats.totalRequests,
    failedRequests: stats.failedRequests,
    stateTransitions: stats.stateTransitions,
  });
}

// ============================================================================
// Example 4: Multiple Service Protection with API Policy
// ============================================================================

class ApiClient {
  private userServiceBreaker: CircuitBreaker;
  private paymentServiceBreaker: CircuitBreaker;
  private analyticsBreaker: CircuitBreaker;

  constructor() {
    // User service - critical, use strict policy
    this.userServiceBreaker = new CircuitBreaker(
      createApiPolicy('https://api.example.com/users', {
        ...CircuitBreakerPolicies.strict(),
        serviceName: 'user-service',
      })
    );

    // Payment service - critical, use aggressive policy
    this.paymentServiceBreaker = new CircuitBreaker(
      createApiPolicy('https://api.example.com/payments', {
        ...CircuitBreakerPolicies.aggressive(),
        serviceName: 'payment-service',
      })
    );

    // Analytics - non-critical, use lenient policy
    this.analyticsBreaker = new CircuitBreaker(
      createApiPolicy('https://api.example.com/analytics', {
        ...CircuitBreakerPolicies.lenient(),
        serviceName: 'analytics-service',
      })
    );
  }

  async getUser(userId: string) {
    return this.userServiceBreaker.execute(async () => {
      const response = await fetch(`https://api.example.com/users/${userId}`);
      if (!response.ok) throw new Error('User fetch failed');
      return response.json();
    });
  }

  async processPayment(amount: number) {
    return this.paymentServiceBreaker.execute(async () => {
      const response = await fetch('https://api.example.com/payments', {
        method: 'POST',
        body: JSON.stringify({ amount }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Payment failed');
      return response.json();
    });
  }

  async trackEvent(event: string) {
    // Analytics is non-critical, fail silently
    try {
      return await this.analyticsBreaker.execute(async () => {
        const response = await fetch('https://api.example.com/analytics', {
          method: 'POST',
          body: JSON.stringify({ event }),
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error('Analytics failed');
        return response.json();
      });
    } catch (error) {
      // Log but don't fail the main operation
      console.warn('Analytics tracking failed:', error);
      return null;
    }
  }

  // Get health status of all services
  getHealthStatus() {
    return {
      userService: this.userServiceBreaker.getStats(),
      paymentService: this.paymentServiceBreaker.getStats(),
      analytics: this.analyticsBreaker.getStats(),
    };
  }
}

// ============================================================================
// Example 5: Custom Policy Based on Service Characteristics
// ============================================================================

async function customPolicyExample() {
  // High latency, unreliable, critical service
  const slowUnreliableBreaker = new CircuitBreaker(
    createCustomPolicy({
      latency: 'high',
      reliability: 'low',
      importance: 'critical',
    })
  );

  // Low latency, reliable, non-critical service
  const fastReliableBreaker = new CircuitBreaker(
    createCustomPolicy({
      latency: 'low',
      reliability: 'high',
      importance: 'low',
    })
  );

  await slowUnreliableBreaker.execute(async () => {
    // Your slow, unreliable operation
    return 'data';
  });
}

// ============================================================================
// Example 6: Retry with Exponential Backoff
// ============================================================================

async function retryExample() {
  const breaker = new CircuitBreaker({
    failureThreshold: 5,
    recoveryTimeout: 30000,
    requestTimeout: 10000,
    maxRetries: 3, // Retry up to 3 times
    initialBackoff: 100, // Start with 100ms
    backoffMultiplier: 2.0, // Double each time (100ms -> 200ms -> 400ms)
    maxBackoff: 5000, // Cap at 5 seconds
  });

  let attemptCount = 0;

  try {
    const result = await breaker.execute(async () => {
      attemptCount++;
      console.log(`Attempt ${attemptCount}`);

      // Simulate intermittent failure
      if (Math.random() < 0.7) {
        throw new Error('Temporary failure');
      }

      return 'Success!';
    });

    console.log('Operation succeeded:', result);
  } catch (error) {
    console.error('All retry attempts failed:', error);
  }
}

// ============================================================================
// Example 7: Circuit Breaker with Timeout
// ============================================================================

async function timeoutExample() {
  const breaker = new CircuitBreaker({
    requestTimeout: 3000, // 3 second timeout
    failureThreshold: 3,
  });

  try {
    await breaker.execute(async () => {
      // Simulate slow operation
      await new Promise(resolve => setTimeout(resolve, 5000));
      return 'This will timeout';
    });
  } catch (error) {
    console.error('Request timed out:', error);
  }
}

// ============================================================================
// Example 8: Manual Circuit Control (Testing/Maintenance)
// ============================================================================

async function manualControlExample() {
  const breaker = new CircuitBreaker({
    failureThreshold: 5,
    recoveryTimeout: 30000,
  });

  // Force circuit open for maintenance
  breaker.forceOpen();
  console.log('Circuit forced open, state:', breaker.getState());

  try {
    await breaker.execute(async () => 'data');
  } catch (error) {
    console.log('Request rejected (circuit is open)');
  }

  // Force circuit closed after maintenance
  breaker.forceClosed();
  console.log('Circuit forced closed, state:', breaker.getState());

  // Reset all stats
  breaker.reset();
  console.log('Circuit reset to initial state');
}

// ============================================================================
// Example 9: Real-World Fetch Wrapper
// ============================================================================

class ResilientFetch {
  private breaker: CircuitBreaker;

  constructor(serviceName: string, policy = CircuitBreakerPolicies.normal()) {
    this.breaker = new CircuitBreaker({
      ...policy,
      serviceName,
    });
  }

  async get<T = any>(url: string, options?: RequestInit): Promise<T> {
    return this.breaker.execute(async () => {
      const response = await fetch(url, {
        ...options,
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    });
  }

  async post<T = any>(url: string, data: any, options?: RequestInit): Promise<T> {
    return this.breaker.execute(async () => {
      const response = await fetch(url, {
        ...options,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    });
  }

  getStats() {
    return this.breaker.getStats();
  }

  getState() {
    return this.breaker.getState();
  }
}

// Usage
async function resilientFetchExample() {
  const api = new ResilientFetch('my-api', CircuitBreakerPolicies.normal());

  try {
    const users = await api.get('https://api.example.com/users');
    console.log('Users:', users);

    const newUser = await api.post('https://api.example.com/users', {
      name: 'John Doe',
      email: 'john@example.com',
    });
    console.log('Created user:', newUser);

    // Check health
    const stats = api.getStats();
    console.log('API Health:', {
      state: api.getState(),
      failureRate: stats.failureRate.toFixed(2) + '%',
    });
  } catch (error) {
    console.error('API call failed:', error);
  }
}

// ============================================================================
// Run Examples
// ============================================================================

async function main() {
  console.log('=== Circuit Breaker Examples ===\n');

  // Comment/uncomment to run specific examples
  // await basicExample();
  // await policyExample();
  // await monitoringExample();
  // await customPolicyExample();
  // await retryExample();
  // await timeoutExample();
  // await manualControlExample();
  // await resilientFetchExample();
}

// Uncomment to run
// main().catch(console.error);

export {
  ApiClient,
  ResilientFetch,
};