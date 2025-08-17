# A2A Messaging System

**Last Updated:** 2025-05-25

## Overview

The Agent-to-Agent (A2A) Messaging System provides a robust communication layer for distributed agents within the Vespera-Scriptorium plugin. It enables agents to discover each other, exchange messages, manage tasks, share data, and coordinate activities in a reliable and type-safe manner.

## Architecture

The A2A Messaging System is built on a publish/subscribe architecture using NATS as the message broker. It consists of several core components:

1. **NATS Client**: Core messaging functionality for connection management and message transport
2. **Service Manager**: Service discovery and health monitoring
3. **Task Manager**: Task creation, delegation, execution, and tracking
4. **Storage Manager**: Distributed key-value storage operations
5. **Data Exchange**: Data sharing and streaming between agents
6. **Message Types**: Message structure, validation, and type guards

![A2A Architecture](../assets/a2a-architecture.png)

## Component Documentation

Detailed documentation for each component is available:

- [NATS Client](./nats-client/README.md)
- [Service Manager](./service-manager/README.md)
- [Task Manager](./task-manager/README.md)
- [Storage Manager](./storage-manager/README.md)
- [Data Exchange](./data-exchange/README.md)
- [Message Types](./message-types/README.md)

## Getting Started

### Prerequisites

- NATS Server (v2.9.0+)
- TypeScript (v4.5.0+)
- Node.js (v16.0.0+)

### Installation

1. Install the required dependencies:

```bash
npm install nats uuid eventemitter3
```

2. Configure the NATS connection in your `a2a-config.json`:

```json
{
  "nats": {
    "servers": "nats://localhost:4222",
    "name": "vespera-agent",
    "timeout": 5000,
    "maxReconnectAttempts": 10,
    "pingInterval": 30000,
    "debug": false
  }
}
```

3. Initialize the messaging system:

```typescript
import { 
  natsClient, 
  ServiceManager, 
  TaskManager, 
  StorageManager, 
  DataExchange 
} from './core/messaging';

// Initialize NATS client
await natsClient.connect();

// Initialize service manager
const serviceManager = new ServiceManager({
  serviceType: 'document-processor',
  capabilities: ['text-extraction', 'image-analysis']
});
await serviceManager.initialize();

// Initialize task manager
const taskManager = new TaskManager({
  serviceId: serviceManager.getServiceId(),
  capabilities: ['document-processing']
});
await taskManager.initialize();

// Initialize storage manager
const storageManager = new StorageManager({
  serviceId: serviceManager.getServiceId()
});
await storageManager.initialize();

// Initialize data exchange
const dataExchange = new DataExchange({
  serviceId: serviceManager.getServiceId(),
  capabilities: ['data-provider']
});
await dataExchange.initialize();
```

## Message Flow

The A2A Messaging System follows a consistent message flow pattern:

1. **Service Discovery**: Agents register with the system and discover each other
2. **Task Creation**: Agents create tasks and assign them to capable services
3. **Task Execution**: Services execute tasks and report progress/results
4. **Data Exchange**: Agents request and share data as needed
5. **Storage Operations**: Agents store and retrieve shared state

![Message Flow](../assets/message-flow.png)

## Security

The A2A Messaging System includes several security features:

- **Authentication**: JWT-based authentication for agent identity verification
- **Authorization**: Role-based access control for message operations
- **Encryption**: Message payload encryption for sensitive data
- **Validation**: Message validation to prevent malformed messages

## Monitoring

The system provides monitoring capabilities through events and metrics:

- **Events**: All components emit events for monitoring and debugging
- **Metrics**: Performance metrics for message throughput, latency, and error rates
- **Logging**: Comprehensive logging for troubleshooting

## Best Practices

1. **Message Types**: Use the appropriate message type for each operation
2. **Error Handling**: Handle errors gracefully with proper error messages
3. **Timeouts**: Set appropriate timeouts for operations
4. **Correlation**: Use correlation IDs to track related messages
5. **Cleanup**: Always shut down components when done
6. **Type Safety**: Use TypeScript interfaces and type guards
7. **Testing**: Write unit and integration tests for message flows

## Implementation Examples

### Task Management Example

```typescript
// Register a task handler
taskManager.registerTaskHandler('process-document', async (task) => {
  const { documentId } = task.parameters;
  
  // Process the document
  console.log(`Processing document ${documentId}`);
  
  // Return the result
  return {
    success: true,
    extractedText: 'Document content...'
  };
});

// Create a task
const taskId = await taskManager.createTask(
  'process-document',
  {
    documentId: 'doc-123'
  }
);

// Monitor task status
taskManager.on('taskCompleted', (taskId, result) => {
  console.log(`Task ${taskId} completed with result:`, result);
});
```

### Data Exchange Example

```typescript
// Register a data provider
dataExchange.registerDataProvider('user-profile', async (parameters) => {
  const { userId } = parameters;
  
  // Fetch user profile
  console.log(`Fetching profile for user ${userId}`);
  
  // Return the data
  return {
    userId,
    name: 'John Doe',
    email: 'john.doe@example.com'
  };
});

// Request data
const userProfile = await dataExchange.requestData('user-profile', {
  userId: 'user-123'
});

console.log('User profile:', userProfile);
```

## Future Enhancements

1. **Message Persistence**: Store messages for reliability and replay
2. **Load Balancing**: Distribute tasks evenly across available services
3. **Message Prioritization**: Prioritize critical messages
4. **Circuit Breakers**: Prevent cascading failures
5. **Advanced Monitoring**: Enhanced metrics and visualization
6. **Schema Validation**: JSON Schema validation for message payloads

## Troubleshooting

### Common Issues

1. **Connection Failures**: Check NATS server availability and connection settings
2. **Message Timeouts**: Verify service availability and increase timeout values
3. **Type Errors**: Ensure message payloads match expected interfaces
4. **Missing Handlers**: Register appropriate handlers for all message types
5. **Memory Leaks**: Clean up subscriptions and event listeners

### Debugging

Enable debug mode in the NATS client for detailed logging:

```typescript
await natsClient.connect({
  debug: true
});
```

## References

- [NATS Documentation](https://docs.nats.io/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Event Emitter Documentation](https://github.com/primus/eventemitter3)
- [UUID Documentation](https://github.com/uuidjs/uuid)
