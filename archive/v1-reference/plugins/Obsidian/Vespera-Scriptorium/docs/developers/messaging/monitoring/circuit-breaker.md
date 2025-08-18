# Circuit Breaker Pattern Implementation

The Circuit Breaker pattern is implemented to prevent cascading failures in the A2A messaging system by temporarily disabling operations when a failure threshold is reached.

## Overview

The circuit breaker monitors operations and transitions between three states:
- **CLOSED**: Normal operation, requests flow through
- **OPEN**: Circuit is open, requests fail fast to prevent system overload
- **HALF_OPEN**: Testing if the system has recovered

## Components

### CircuitBreaker Class

The main implementation providing circuit breaker functionality for protecting operations.

#### Constructor Options

```typescript
interface CircuitBreakerOptions {
  failureThreshold: number;           // Number of failures before opening
  resetTimeout: number;               // Time in ms to wait before attempting reset
  halfOpenSuccessThreshold: number;   // Successes needed to close from half-open
  monitorInterval?: number;           // Interval for checking state transitions
  timeout?: number;                   // Timeout for operations
  enableLogging?: boolean;            // Whether to log state changes
}
```

#### Key Methods

- `execute<T>(fn: () => Promise<T>): Promise<T>` - Execute a function with circuit protection
- `getState(): CircuitState` - Get current circuit state
- `forceState(state: CircuitState): void` - Force circuit into specific state
- `reset(): void` - Reset circuit to closed state
- `getMetrics()` - Get current metrics and statistics

#### Usage Example

```typescript
import { CircuitBreaker, CircuitState } from '../core/messaging/circuitBreaker';

// Create a circuit breaker
const circuit = new CircuitBreaker('my-service', {
  failureThreshold: 5,
  resetTimeout: 30000,
  halfOpenSuccessThreshold: 3
});

// Execute operations with protection
try {
  const result = await circuit.execute(async () => {
    return await riskyOperation();
  });
  console.log('Operation succeeded:', result);
} catch (error) {
  console.error('Operation failed or circuit is open:', error);
}

// Monitor state changes
circuit.on('stateChanged', (from, to, circuitId) => {
  console.log(`Circuit ${circuitId} changed from ${from} to ${to}`);
});
```

### CircuitBreakerRegistry Class

Manages multiple circuit breakers in a centralized registry.

#### Key Methods

- `getOrCreate(id: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker`
- `get(id: string): CircuitBreaker | undefined`
- `remove(id: string): boolean`
- `resetAll(): void`

#### Usage Example

```typescript
import { circuitBreakerRegistry } from '../core/messaging/circuitBreaker';

// Get or create a circuit breaker
const dbCircuit = circuitBreakerRegistry.getOrCreate('database', {
  failureThreshold: 10,
  resetTimeout: 60000
});

const apiCircuit = circuitBreakerRegistry.getOrCreate('external-api', {
  failureThreshold: 3,
  resetTimeout: 30000
});
```

**Last Updated**: 2025-05-26
