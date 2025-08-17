# Service Discovery

**Last Updated:** 2025-05-25

## Overview

The Service Discovery component of the A2A messaging system enables agents to register their capabilities and discover other agents based on service types and capabilities. It provides a robust mechanism for dynamic service registration, health monitoring, and discovery in a distributed environment.

## Features

- **Service Registration**: Register services with capabilities and metadata
- **Service Discovery**: Discover services based on capabilities and service types
- **Health Monitoring**: Heartbeat mechanism for service health tracking
- **Event-Based Notifications**: Event emitter for service status changes
- **Automatic Cleanup**: Remove inactive services automatically

## Service Manager Configuration

The Service Manager can be configured with the following options:

```typescript
export interface ServiceManagerOptions {
  /** Type/category of the service */
  serviceType: string;
  
  /** List of capabilities provided by the service */
  capabilities?: string[];
  
  /** Interval between heartbeats in ms (default: 30000) */
  heartbeatInterval?: number;
  
  /** Time before considering a service offline in ms (default: 90000) */
  heartbeatTimeout?: number;
  
  /** Additional service metadata */
  metadata?: Record<string, unknown>;
  
  /** Custom NATS client instance */
  natsClient?: NatsClient;
  
  /** Logger instance */
  logger?: Logger;
  
  /** Enable debug logging (default: false) */
  debug?: boolean;
  
  /** Service version */
  version?: string;
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `serviceType` | string | - | Type/category of the service (required) |
| `capabilities` | string[] | [] | List of capabilities provided by the service |
| `heartbeatInterval` | number | 30000 | Interval between heartbeats in ms |
| `heartbeatTimeout` | number | 90000 | Time before considering a service offline |
| `metadata` | object | {} | Additional service metadata |
| `natsClient` | NatsClient | global natsClient | Custom NATS client instance |
| `logger` | Logger | console | Logger instance |
| `debug` | boolean | false | Enable debug logging |
| `version` | string | '0.0.0' | Service version |

## Monitoring and Metrics

The service manager provides the following metrics:

- Service uptime
- Memory usage
- CPU usage
- Message rates
- Error counts

These can be accessed via the service metadata and used for monitoring and alerting.

## Service Discovery Process

### Registration

When a service starts, it registers itself with the system by publishing a registration message:

```typescript
// Register service
await serviceManager.initialize();
```

This sends a registration message with the service's type, capabilities, and metadata to the `system.register` subject.

### Discovery

Services can discover each other using the following methods:

```typescript
// Find services by capability
const textProcessors = serviceManager.findServicesByCapability('text-processing');

// Find services by type
const imageProcessors = serviceManager.findServicesByType('image-processor');
```

### Health Monitoring

Services send periodic heartbeat messages to indicate they are still active:

```typescript
// Heartbeat is sent automatically by the service manager
// The interval is configured via the heartbeatInterval option
```

If a service doesn't send a heartbeat within the configured timeout period, it is considered offline and removed from the registry.

## Service Information

The service manager maintains information about each service:

```typescript
export interface ServiceInfo {
  serviceId: string;
  serviceType: string;
  capabilities: string[];
  lastSeen: number;
  metadata: Record<string, unknown>;
  status: ServiceStatus;
  version?: string;
  host?: {
    hostname?: string;
    ip?: string;
    pid?: number;
  };
  metrics?: {
    memory?: number;
    cpu?: number;
    uptime?: number;
    queueLength?: number;
  };
}
```

## Best Practices

1. **Service Types**: Use specific, descriptive service types
2. **Capabilities**: Define granular capabilities for precise service discovery
3. **Heartbeats**: Configure appropriate heartbeat intervals based on service criticality
4. **Metadata**: Include useful metadata for service discovery and monitoring
5. **Error Handling**: Handle service discovery errors gracefully
6. **Cleanup**: Always call shutdown() when done to unregister your service

## Implementation Details

The Service Discovery component uses NATS publish/subscribe for service registration and discovery. It maintains a local registry of services and automatically removes services that haven't sent heartbeats within the timeout period.

### Key Files

- `src/core/messaging/serviceManager.ts` - Main implementation
- `tests/unit/messaging/serviceManager.test.ts` - Unit tests
