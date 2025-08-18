---
trigger: glob
globs: *.{ts,js}
---

# A2A Messaging Code Examples

## Message Type Definitions

```typescript
// Example of proper message type definition
export interface TaskCreatePayload extends BaseTaskPayload {
  parameters: Record<string, unknown>;
  priority?: number;
  timeout?: number;
  assignTo?: string;
  dueDate?: string;
  dependencies?: string[];
}
```

## Type Guards Implementation

```typescript
// Example of proper type guard implementation
export function isTaskCreateMessage(msg: Message): msg is Message<TaskCreatePayload> {
  return msg.type === MessageType.TASK_CREATE;
}
```

## Event Emitter Pattern

```typescript
// Example of proper event emitter implementation
export class ServiceManager extends EventEmitter {
  private services: Map<string, ServiceInfo> = new Map();
  
  constructor(private natsClient: NatsClient) {
    super();
    this.setupSubscriptions();
  }
  
  private setupSubscriptions(): void {
    this.natsClient.subscribe('system.register', this.handleRegistration.bind(this));
    this.natsClient.subscribe('system.heartbeat', this.handleHeartbeat.bind(this));
  }
  
  private handleRegistration(msg: Message<RegistrationPayload>): void {
    // Implementation...
    this.emit('service.registered', serviceInfo);
  }
}
```

## Error Handling

```typescript
// Example of proper error handling
try {
  await this.natsClient.publish(subject, message);
} catch (error) {
  const errorPayload: ErrorPayload = {
    code: 'NATS_PUBLISH_ERROR',
    message: 'Failed to publish message',
    details: error,
    source: 'NatsClient',
    timestamp: new Date().toISOString(),
    severity: 'ERROR',
    retryable: true
  };
  
  this.emit('error', errorPayload);
  throw new NatsPublishError(errorPayload);
}
```

## Last Updated: 2025-05-25
