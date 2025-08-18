# A2A Messaging Monitoring System

This directory contains documentation for the monitoring features of the A2A messaging system.

## Components

1. **[Circuit Breaker](circuit-breaker.md)** - Prevents cascading failures through circuit breaking
2. **[Metrics Collector](metrics-collector.md)** - Tracks performance and operational metrics  
3. **[Health Monitor](health-monitor.md)** - Monitors component health status
4. **[Alert Manager](alert-manager.md)** - Manages alerts and notifications

## Integration Guide

### Basic Setup

```typescript
import { 
  circuitBreakerRegistry, 
  metricsCollector, 
  healthMonitor, 
  alertManager 
} from '../core/messaging';

// Enable monitoring
metricsCollector.startTimers();
healthMonitor.startReporting();
alertManager.startChecking();
```

### Best Practices

1. **Configure Circuit Breakers**: Set appropriate thresholds based on system requirements
2. **Monitor Key Metrics**: Track message throughput, latency, and error rates
3. **Set Up Health Checks**: Register all critical components for health monitoring
4. **Define Alert Rules**: Create alerts for critical conditions and performance degradation
5. **Use Tags**: Tag metrics and alerts for better organization and filtering

### Common Monitoring Scenarios

#### High Latency Alert
```typescript
alertManager.addAlertDefinition({
  id: 'high-latency',
  name: 'High Message Latency',
  severity: AlertSeverity.WARNING,
  triggerType: AlertTriggerType.LATENCY,
  condition: { operator: AlertOperator.GREATER_THAN, threshold: 1000 },
  notificationChannels: ['console'],
  enabled: true
});
```

#### Service Health Monitoring
```typescript
healthMonitor.registerComponent({
  componentId: 'nats-client',
  componentType: ComponentType.NATS_CLIENT,
  checkFn: HealthMonitor.createNatsHealthCheck(natsClient),
  interval: 30000,
  timeout: 5000,
  retryCount: 3,
  retryDelay: 1000
});
```

**Last Updated**: 2025-05-26
