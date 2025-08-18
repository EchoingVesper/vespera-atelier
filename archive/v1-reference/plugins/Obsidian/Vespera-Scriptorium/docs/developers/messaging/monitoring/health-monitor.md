# Health Monitoring System

The health monitoring system provides health status tracking, periodic health checks, and degraded state
handling for all A2A messaging components.

## Overview

The HealthMonitor class manages component health by:

- Registering components for monitoring
- Performing periodic health checks
- Tracking health status changes
- Providing system-wide health status

## Health Status Levels

```typescript
enum HealthStatus {
  HEALTHY = 'HEALTHY',     // Component is functioning normally
  DEGRADED = 'DEGRADED',   // Component has reduced functionality
  UNHEALTHY = 'UNHEALTHY', // Component is not functioning
  UNKNOWN = 'UNKNOWN'      // Health status is unknown
}
```

## Usage Example

```typescript
import { healthMonitor, HealthStatus, ComponentType } from '../core/messaging/healthMonitor';

// Register a component for monitoring
const healthCheck = async () => ({
  componentId: 'my-service',
  componentType: ComponentType.CUSTOM,
  status: HealthStatus.HEALTHY,
  lastChecked: Date.now(),
  message: 'Service is operational'
});

healthMonitor.registerComponent({
  componentId: 'my-service',
  componentType: ComponentType.CUSTOM,
  checkFn: healthCheck,
  interval: 30000,    // Check every 30 seconds
  timeout: 5000,      // 5 second timeout
  retryCount: 3,      // Retry 3 times before marking unhealthy
  retryDelay: 1000    // 1 second between retries
});

// Get health status
const componentHealth = healthMonitor.getComponentHealth('my-service');
const systemHealth = healthMonitor.getSystemHealthStatus();
```

## Implementation Notes

1. The `isConnected` property is a boolean property, not a method. Always access it as:

   ```typescript
   if (healthMonitor.isConnected) {
     // Connected
   }
   ```

   Not as:

   ```typescript
   // INCORRECT - will cause TypeScript errors
   if (healthMonitor.isConnected()) {
     // This will not work
   }
   ```

2. When initializing the HealthMonitor, ensure the natsClient is properly typed:

   ```typescript
   // CORRECT: Proper typing for natsClient
   constructor(options: HealthMonitorOptions) {
     this.natsClient = options.natsClient;
   }
   ```

3. When performing arithmetic operations with component counts, ensure proper type handling:

   ```typescript
   // CORRECT: Proper type handling for arithmetic operations
   const healthyCount = Object.values(this.componentHealth)
     .filter(health => health.status === HealthStatus.HEALTHY).length;
   
   const totalCount = Object.keys(this.componentHealth).length;
   
   // Calculate percentage with proper number type handling
   const healthPercentage = totalCount > 0 ? (healthyCount / totalCount) * 100 : 100;
   ```

**Last Updated**: 2025-05-27
