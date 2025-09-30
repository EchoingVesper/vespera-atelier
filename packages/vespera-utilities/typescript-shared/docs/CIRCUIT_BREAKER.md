# Circuit Breaker Module

TypeScript implementation of the Circuit Breaker pattern for preventing cascading failures in distributed systems.

## Overview

The Circuit Breaker pattern protects your application from failing external services by:

1. **Closed State**: Normal operation, requests pass through
2. **Open State**: Service is failing, requests fail fast without calling the service
3. **Half-Open State**: Testing if the service has recovered

## Quick Start

```typescript
import { CircuitBreaker } from '@vespera/typescript-shared';

const breaker = new CircuitBreaker({
  failureThreshold: 5,
  recoveryTimeout: 30000,
  requestTimeout: 5000,
});

// Wrap any async operation
const data = await breaker.execute(async () => {
  const response = await fetch('https://api.example.com/data');
  if (!response.ok) throw new Error('API error');
  return response.json();
});
```

## Core Features

### State Machine

- **Closed → Open**: After `failureThreshold` consecutive failures
- **Open → Half-Open**: After `recoveryTimeout` milliseconds
- **Half-Open → Closed**: After `successThreshold` consecutive successes
- **Half-Open → Open**: On any failure during half-open state

### Automatic Retries

Built-in retry logic with exponential backoff:

```typescript
const breaker = new CircuitBreaker({
  maxRetries: 3,
  initialBackoff: 100,
  backoffMultiplier: 2.0,
  maxBackoff: 30000,
});
```

Retry delays: 100ms → 200ms → 400ms

### Timeout Support

Requests automatically timeout using `Promise.race()`:

```typescript
const breaker = new CircuitBreaker({
  requestTimeout: 5000, // 5 seconds
});
```

### Statistics & Monitoring

```typescript
const stats = breaker.getStats();
console.log({
  state: stats.state,
  failureRate: stats.failureRate,
  totalRequests: stats.totalRequests,
  stateTransitions: stats.stateTransitions,
});
```

### State Change Callbacks

```typescript
const breaker = new CircuitBreaker({
  onStateChange: (oldState, newState) => {
    console.log(`Circuit: ${oldState} → ${newState}`);
    if (newState === CircuitState.Open) {
      alertMonitoring('Service down!');
    }
  },
});
```

## Predefined Policies

### Aggressive Policy

Best for critical services where availability is paramount:

```typescript
const breaker = new CircuitBreaker(
  CircuitBreakerPolicies.aggressive()
);
```

**Configuration:**
- Failure threshold: 3
- Recovery timeout: 60s
- Request timeout: 5s
- Max retries: 1
- Success threshold: 5

### Normal Policy (Default)

Balanced approach for most use cases:

```typescript
const breaker = new CircuitBreaker(
  CircuitBreakerPolicies.normal()
);
```

**Configuration:**
- Failure threshold: 5
- Recovery timeout: 30s
- Request timeout: 30s
- Max retries: 3
- Success threshold: 3

### Lenient Policy

For non-critical services or development:

```typescript
const breaker = new CircuitBreaker(
  CircuitBreakerPolicies.lenient()
);
```

**Configuration:**
- Failure threshold: 10
- Recovery timeout: 10s
- Request timeout: 60s
- Max retries: 5
- Success threshold: 2

### Strict Policy

For canary deployments and health checks:

```typescript
const breaker = new CircuitBreaker(
  CircuitBreakerPolicies.strict()
);
```

**Configuration:**
- Failure threshold: 2
- Recovery timeout: 120s
- Request timeout: 3s
- Max retries: 0
- Success threshold: 10

### Fast Recovery Policy

For services with transient failures:

```typescript
const breaker = new CircuitBreaker(
  CircuitBreakerPolicies.fastRecovery()
);
```

**Configuration:**
- Failure threshold: 5
- Recovery timeout: 5s
- Request timeout: 10s
- Max retries: 2
- Success threshold: 1

## Custom Policies

### API-Specific Policy

```typescript
const breaker = new CircuitBreaker(
  createApiPolicy('https://api.example.com', {
    failureThreshold: 5,
    requestTimeout: 10000,
  })
);
```

### Service Characteristic Policy

```typescript
const breaker = new CircuitBreaker(
  createCustomPolicy({
    latency: 'high',       // low | medium | high
    reliability: 'low',     // high | medium | low
    importance: 'critical', // critical | high | medium | low
  })
);
```

## Real-World Usage

### Resilient Fetch Wrapper

```typescript
import { CircuitBreaker, CircuitBreakerPolicies } from '@vespera/typescript-shared';

class ApiClient {
  private breaker: CircuitBreaker;

  constructor() {
    this.breaker = new CircuitBreaker(
      CircuitBreakerPolicies.normal()
    );
  }

  async get<T>(url: string): Promise<T> {
    return this.breaker.execute(async () => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    });
  }

  async post<T>(url: string, data: any): Promise<T> {
    return this.breaker.execute(async () => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    });
  }

  getHealth() {
    return this.breaker.getStats();
  }
}
```

### Multiple Service Protection

```typescript
class MicroserviceClient {
  private userBreaker: CircuitBreaker;
  private paymentBreaker: CircuitBreaker;
  private analyticsBreaker: CircuitBreaker;

  constructor() {
    // Critical services - strict policy
    this.userBreaker = new CircuitBreaker({
      ...CircuitBreakerPolicies.strict(),
      serviceName: 'user-service',
    });

    this.paymentBreaker = new CircuitBreaker({
      ...CircuitBreakerPolicies.aggressive(),
      serviceName: 'payment-service',
    });

    // Non-critical - lenient policy
    this.analyticsBreaker = new CircuitBreaker({
      ...CircuitBreakerPolicies.lenient(),
      serviceName: 'analytics-service',
    });
  }

  async getUser(id: string) {
    return this.userBreaker.execute(async () => {
      const response = await fetch(`/api/users/${id}`);
      return response.json();
    });
  }

  async processPayment(amount: number) {
    return this.paymentBreaker.execute(async () => {
      const response = await fetch('/api/payments', {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });
      return response.json();
    });
  }

  async trackEvent(event: string) {
    // Non-critical, fail silently
    try {
      await this.analyticsBreaker.execute(async () => {
        await fetch('/api/analytics', {
          method: 'POST',
          body: JSON.stringify({ event }),
        });
      });
    } catch {
      // Log but don't fail
    }
  }

  getHealthStatus() {
    return {
      user: this.userBreaker.getStats(),
      payment: this.paymentBreaker.getStats(),
      analytics: this.analyticsBreaker.getStats(),
    };
  }
}
```

## Error Handling

```typescript
import { CircuitBreakerError } from '@vespera/typescript-shared';

try {
  const data = await breaker.execute(async () => {
    return await fetchData();
  });
} catch (error) {
  if (error instanceof CircuitBreakerError) {
    // Circuit is open
    console.error('Service unavailable:', error.message);
    console.log('Stats:', error.stats);
    console.log('Current state:', error.state);
  } else {
    // Other error
    console.error('Operation failed:', error);
  }
}
```

## Manual Control

For testing or maintenance:

```typescript
// Force circuit open
breaker.forceOpen();

// Force circuit closed
breaker.forceClosed();

// Reset all statistics
breaker.reset();

// Check current state
const state = breaker.getState();
```

## Configuration Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `failureThreshold` | number | 5 | Failures before opening circuit |
| `recoveryTimeout` | number | 30000 | Time (ms) before trying half-open |
| `requestTimeout` | number | 30000 | Timeout (ms) for individual requests |
| `maxRetries` | number | 3 | Maximum retry attempts |
| `initialBackoff` | number | 100 | Initial backoff delay (ms) |
| `maxBackoff` | number | 30000 | Maximum backoff delay (ms) |
| `backoffMultiplier` | number | 2.0 | Backoff multiplier (exponential) |
| `successThreshold` | number | 3 | Successes to close from half-open |
| `serviceName` | string | 'default' | Service name for logging |
| `onStateChange` | function | undefined | State change callback |

## Statistics Reference

```typescript
interface CircuitBreakerStats {
  state: CircuitState;           // Current state
  failureCount: number;          // Current failure count
  successCount: number;          // Current success count
  totalRequests: number;         // Total requests processed
  failedRequests: number;        // Total failed requests
  lastFailureTime: number | null; // Last failure timestamp
  lastSuccessTime: number | null; // Last success timestamp
  stateTransitions: number;      // Total state changes
  failureRate: number;           // Failure rate (0-100%)
}
```

## Best Practices

1. **Use appropriate policies**: Match the policy to your service's characteristics
2. **Monitor state changes**: Set up alerts for circuit opens
3. **Set reasonable timeouts**: Balance responsiveness and reliability
4. **Handle CircuitBreakerError**: Provide fallback behavior when circuit is open
5. **Per-service breakers**: Use separate breakers for different services
6. **Log statistics**: Track failure rates and state transitions
7. **Test failure scenarios**: Verify behavior during outages
8. **Consider retry costs**: Balance retries with user experience

## Implementation Details

- Based on Rust implementation from `vespera-bindery`
- Uses `Promise.race()` for timeout support
- Thread-safe state management
- Exponential backoff with configurable multiplier
- Comprehensive validation of configuration
- No external dependencies

## Examples

See `examples/circuit-breaker-example.ts` for comprehensive usage examples including:

- Basic API call protection
- Policy usage
- State monitoring
- Multiple service protection
- Custom policies
- Retry with backoff
- Timeout handling
- Manual control
- Real-world fetch wrapper

## Migration from Other Libraries

### From node-circuit-breaker

```typescript
// Before
const breaker = CircuitBreaker(asyncFunction, {
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
});

// After
const breaker = new CircuitBreaker({
  requestTimeout: 5000,
  failureThreshold: 5,
  recoveryTimeout: 30000
});
await breaker.execute(asyncFunction);
```

### From opossum

```typescript
// Before
const breaker = new CircuitBreaker(asyncFunction, {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
});

// After
const breaker = new CircuitBreaker({
  requestTimeout: 3000,
  failureThreshold: 5,
  recoveryTimeout: 30000
});
await breaker.execute(asyncFunction);
```

## License

AGPL-3.0