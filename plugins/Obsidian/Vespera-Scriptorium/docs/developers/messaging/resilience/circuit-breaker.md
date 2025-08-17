# Circuit Breaker System

The circuit breaker system prevents cascading failures by temporarily disabling operations that are likely to fail,
allowing the system to recover and reducing the impact of failures on the overall A2A messaging infrastructure.

## Overview

The CircuitBreaker class implements the Circuit Breaker pattern with:

- Configurable failure thresholds
- Automatic state transitions
- Timeout-based recovery
- Half-open state testing
- Failure tracking and metrics

## Usage Example

```typescript
import { CircuitBreaker } from '../core/messaging/circuitBreaker';

// Create a circuit breaker with custom options
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,           // Number of failures before opening
  resetTimeout: 30000,           // 30 seconds before trying again
  halfOpenSuccessThreshold: 3,   // Successes needed to close circuit
  monitorInterval: 5000,         // Check circuit state every 5 seconds
  timeout: 2000                  // Operation timeout
});

// Wrap an operation with circuit breaker
async function sendMessage(message) {
  return circuitBreaker.execute(async () => {
    // Operation that might fail
    return await natsClient.publish(message.subject, message.payload);
  });
}

// Check circuit state
if (circuitBreaker.isOpen()) {
  console.log('Circuit is open, operations will fail fast');
}

// Reset circuit manually if needed
circuitBreaker.reset();
```

## Events

- `open`: When the circuit transitions to open state
- `close`: When the circuit transitions to closed state
- `halfOpen`: When the circuit transitions to half-open state
- `success`: When an operation succeeds
- `failure`: When an operation fails

## Implementation Notes

1. When creating a CircuitBreaker instance, use proper option merging to avoid duplicate parameter specifications:

   ```typescript
   // CORRECT: Proper option merging
   constructor(options: CircuitBreakerOptions) {
     // Create a new object by spreading defaults and provided options
     this.options = { ...DEFAULT_OPTIONS, ...options };
   }
   ```

   Not as:

   ```typescript
   // INCORRECT: Duplicate parameter specifications
   constructor(options: CircuitBreakerOptions) {
     // This creates duplicate properties if options contains the same keys as DEFAULT_OPTIONS
     this.options = DEFAULT_OPTIONS;
     this.options.failureThreshold = options.failureThreshold || DEFAULT_OPTIONS.failureThreshold;
     this.options.resetTimeout = options.resetTimeout || DEFAULT_OPTIONS.resetTimeout;
     // etc...
   }
   ```

2. When implementing custom circuit breakers, ensure all timeouts are properly typed as numbers:

   ```typescript
   // Correct implementation
   setTimeout(() => this.attemptReset(), this.options.resetTimeout);
   ```

**Last Updated**: 2025-05-27
