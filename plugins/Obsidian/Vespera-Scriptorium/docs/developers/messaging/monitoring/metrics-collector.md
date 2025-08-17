# Metrics Collection System

The metrics collection system tracks message statistics, latency, throughput, and other performance metrics to provide
insights into the A2A messaging system's behavior and health.

## Overview

The MetricsCollector class provides comprehensive metric tracking with:

- Real-time data collection
- Automatic aggregation
- Configurable retention periods
- Multiple metric types
- Time-series data storage

## Usage Example

```typescript
import { metricsCollector, MetricType } from '../core/messaging/metricsCollector';

// Record basic metrics
metricsCollector.recordMetric(MetricType.MESSAGES_SENT, 1);
metricsCollector.recordMetric(MetricType.LATENCY, 150, { service: 'api' });

// Record message-specific metrics
metricsCollector.recordMessageSent(message, latency);
metricsCollector.recordMessageReceived(message, processingTime);

// Record custom metrics
metricsCollector.recordCustomMetric('cpu-usage', 75.5, { host: 'server1' });

// Get performance data
const throughput = metricsCollector.getThroughput(60000); // Last minute
const avgLatency = metricsCollector.getAverageLatency(60000);
const snapshot = metricsCollector.getMetricsSnapshot();
```

## Events

- `metricAdded`: When a new metric data point is recorded
- `metricsAggregated`: When metrics are aggregated
- `metricsReported`: When metrics are reported

## Implementation Notes

1. The `isConnected` property is a boolean property, not a method. Always access it as:

   ```typescript
   if (metricsCollector.isConnected) {
     // Connected
   }
   ```

   Not as:

   ```typescript
   // INCORRECT - will cause TypeScript errors
   if (metricsCollector.isConnected()) {
     // This will not work
   }
   ```

2. When initializing the MetricsCollector, ensure the natsClient is properly typed:

   ```typescript
   // CORRECT: Proper typing for natsClient
   constructor(options: MetricsCollectorOptions) {
     this.natsClient = options.natsClient;
   }
   ```

3. When working with message type breakdowns, ensure proper type casting for Record<MessageType, number>:

   ```typescript
   // CORRECT: Proper type handling for message type breakdowns
   getMessageTypeBreakdown(): Record<MessageType, number> {
     // Create a properly typed result object
     const result: Record<MessageType, number> = {} as Record<MessageType, number>;
     
     // Populate with actual data
     Object.entries(this.messageTypeCount).forEach(([type, count]) => {
       result[type as MessageType] = count;
     });
     
     return result;
   }
   ```

   Not as:

   ```typescript
   // INCORRECT - will cause TypeScript errors
   getMessageTypeBreakdown(): Record<MessageType, number> {
     // Direct return without proper type casting
     return this.messageTypeCount; // Type error if messageTypeCount is not properly typed
   }
   ```

**Last Updated**: 2025-05-27
