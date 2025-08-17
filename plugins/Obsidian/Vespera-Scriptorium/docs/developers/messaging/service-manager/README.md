# Service Manager

**Last Updated:** 2025-05-25

## Overview

The Service Manager handles service discovery, registration, and health monitoring for the A2A communication layer. It enables agents to discover and communicate with each other based on capabilities and service types.

## Features

- **Service Registration**: Register services with capabilities and metadata
- **Service Discovery**: Discover services based on capabilities and service types
- **Health Monitoring**: Heartbeat mechanism for service health tracking
- **Event-Based Notifications**: Event emitter for service status changes
- **Automatic Cleanup**: Remove inactive services automatically

## Usage

### Initialization

```typescript
import { ServiceManager } from '../core/messaging';

// Create a service manager
const serviceManager = new ServiceManager({
  serviceType: 'document-processor',
  capabilities: ['text-extraction', 'image-analysis'],
  heartbeatInterval: 30000, // 30 seconds
  heartbeatTimeout: 90000, // 90 seconds
  metadata: {
    version: '1.0.0',
    description: 'Document processing service'
  }
});

// Initialize the service manager
await serviceManager.initialize();
```

### Service Discovery

```typescript
// Find services by capability
const textProcessors = serviceManager.findServicesByCapability('text-processing');

// Find services by type
const imageProcessors = serviceManager.findServicesByType('image-processor');

// Get a specific service
const service = serviceManager.getService('service-123');

// Check if a service is available
const isAvailable = serviceManager.isServiceAvailable('service-123');
```

### Event Handling

```typescript
// Listen for service discovery events
serviceManager.on('serviceDiscovered', (serviceInfo) => {
  console.log(`Discovered service: ${serviceInfo.serviceId} (${serviceInfo.serviceType})`);
  // Handle the new service
});

// Listen for service status changes
serviceManager.on('statusChange', (serviceId, status) => {
  console.log(`Service ${serviceId} status changed to ${status}`);
  // Handle the status change
});

// Listen for service removal
serviceManager.on('serviceRemoved', (serviceId) => {
  console.log(`Service ${serviceId} was removed`);
  // Handle the service removal
});
```

### Cleanup

```typescript
// Shutdown the service manager
await serviceManager.shutdown();
```

## API Reference

### `ServiceManager`

The main class for service discovery and management.

#### Constructor

```typescript
constructor(options: ServiceManagerOptions)
```

- `options`: Configuration options for the service manager
  - `serviceType`: Type of service (e.g., 'document-processor')
  - `capabilities`: Array of capabilities this service provides
  - `heartbeatInterval`: Interval for sending heartbeats in milliseconds
  - `heartbeatTimeout`: Timeout for considering a service offline in milliseconds
  - `metadata`: Additional metadata for the service
  - `natsClient`: Optional NATS client instance

#### Methods

- `initialize(): Promise<void>` - Initialize the service manager
- `shutdown(): Promise<void>` - Shutdown the service manager
- `getServiceId(): string` - Get the ID of this service
- `getService(serviceId: string): ServiceInfo | undefined` - Get information about a specific service
- `getAllServices(): ServiceInfo[]` - Get information about all known services
- `findServicesByType(serviceType: string): ServiceInfo[]` - Find services by type
- `findServicesByCapability(capability: string): ServiceInfo[]` - Find services by capability
- `isServiceAvailable(serviceId: string): boolean` - Check if a service is available

#### Events

- `serviceDiscovered` - Emitted when a new service is discovered
- `statusChange` - Emitted when a service's status changes
- `serviceRemoved` - Emitted when a service is removed
- `error` - Emitted when an error occurs

## Service Status

The service manager tracks the status of each service:

```typescript
export const SERVICE_STATUS = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
  DEGRADED: 'DEGRADED',
  STARTING: 'STARTING',
  STOPPING: 'STOPPING',
} as const;

export type ServiceStatus = typeof SERVICE_STATUS[keyof typeof SERVICE_STATUS];
```

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

1. **Capabilities**: Define specific, granular capabilities for your service
2. **Heartbeats**: Use appropriate heartbeat intervals based on service criticality
3. **Event Handling**: Listen for service discovery events to react to changes
4. **Error Handling**: Handle errors from the service manager gracefully
5. **Cleanup**: Always call shutdown() when done to unregister your service

## Implementation Details

The Service Manager uses NATS publish/subscribe for service registration and discovery. It sends heartbeat messages periodically to indicate service health and automatically removes services that haven't sent heartbeats within the timeout period.

### Key Files

- `src/core/messaging/serviceManager.ts` - Main implementation
- `tests/unit/messaging/serviceManager.test.ts` - Unit tests
