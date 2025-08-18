# Load Balancing System

The load balancing system distributes workloads across multiple service instances to optimize resource utilization,
maximize throughput, minimize response time, and ensure high availability.

## Overview

The LoadBalancer class provides intelligent request routing with:

- Dynamic service discovery
- Health-aware routing
- Load-based distribution
- Automatic failover
- Configurable routing strategies

## Usage Example

```typescript
import { loadBalancer, RoutingStrategy } from '../core/messaging/loadBalancer';

// Configure load balancer
loadBalancer.setRoutingStrategy(RoutingStrategy.LEAST_CONNECTIONS);
loadBalancer.setMaxConnectionsPerService(100);

// Register a service instance
loadBalancer.registerService({
  serviceId: 'document-processor-1',
  serviceType: 'document-processor',
  capabilities: ['text-extraction', 'image-analysis'],
  loadFactor: 0.5
});

// Find best service for a task
const bestService = loadBalancer.findOptimalService('document-processor', {
  requiredCapabilities: ['text-extraction'],
  priority: 'high'
});

// Report load metrics
loadBalancer.reportLoadMetrics({
  activeConnections: 25,
  cpuUsage: 0.4,
  memoryUsage: 0.3,
  queueDepth: 10
});

// Important: Access connection status as a property, not a method
if (loadBalancer.isConnected) {
  // Perform operations that require connection
  loadBalancer.broadcastLoadUpdate();
}
```

## Events

- `serviceRegistered`: When a new service is registered
- `serviceRemoved`: When a service is removed
- `routingDecision`: When a routing decision is made
- `loadUpdated`: When load metrics are updated

## Implementation Notes

1. The `isConnected` property is a boolean property, not a method. Always access it as:

   ```typescript
   if (loadBalancer.isConnected) {
     // Connected
   }
   ```

   Not as:

   ```typescript
   // INCORRECT - will cause TypeScript errors
   if (loadBalancer.isConnected()) {
     // This will not work
   }
   ```

2. When implementing custom load metrics reporting, ensure all numeric values are properly typed:

   ```typescript
   // Correct implementation
   reportLoadMetrics(metrics: Partial<ServiceLoadMetrics>): void {
     // Implementation
   }
   ```

**Last Updated**: 2025-05-27
