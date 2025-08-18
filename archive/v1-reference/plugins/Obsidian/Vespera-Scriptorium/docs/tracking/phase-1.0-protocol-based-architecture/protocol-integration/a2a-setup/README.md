# A2A Protocol Setup

**Last Updated:** 2025-05-25

This directory contains the implementation details for the Agent-to-Agent (A2A) protocol, which enables communication and task delegation between agents in the Vespera Scriptorium architecture.

## Architecture Overview

The A2A protocol is built on a message-passing architecture with the following components:

1. **NATS Client**: Core messaging client for publish/subscribe and request/reply patterns
2. **Service Manager**: Handles service discovery, registration, and health monitoring
3. **Task Manager**: Manages task lifecycle, delegation, and retry mechanisms
4. **Storage Manager**: Provides distributed key-value storage operations
5. **Data Exchange**: Facilitates data sharing between agents with streaming support

## Configuration

### 1. `a2a-config.json`

```json
{
  "messageBroker": {
    "type": "nats",
    "url": "nats://localhost:4222",
    "reconnectAttempts": 10,
    "pingInterval": 30000
  },
  "serviceDiscovery": {
    "enabled": true,
    "heartbeatInterval": 30000,
    "heartbeatTimeout": 90000
  },
  "agents": [
    "ingestion-agent",
    "processing-agent",
    "llm-agent",
    "output-agent",
    "orchestration-agent"
  ]
}
```

### 2. Agent Configuration

Each agent requires a configuration file (e.g., `ingestion-agent.config.json`):

```json
{
  "agentId": "ingestion-001",
  "capabilities": ["document-ingest", "chunking"],
  "endpoints": {
    "http": "http://localhost:3001",
    "ws": "ws://localhost:3001/ws"
  },
  "heartbeatInterval": 30
}
```

## Implementation

### Core Classes

1. **NatsClient**
   - Handles message sending/receiving
   - Manages subscriptions
   - Implements request/response pattern
   - Handles connection management and reconnection

2. **ServiceManager**
   - Maintains service registry
   - Handles service discovery
   - Manages service heartbeats
   - Tracks service capabilities and metadata

3. **TaskManager**
   - Creates and tracks tasks
   - Handles task delegation and assignment
   - Manages task timeouts and retries
   - Provides event-based notifications

4. **StorageManager**
   - Provides distributed key-value storage
   - Supports namespaces and versioning
   - Handles TTL for cached values
   - Implements request/response for remote values

5. **DataExchange**
   - Facilitates data sharing between agents
   - Supports request/response pattern
   - Implements data streaming with chunking
   - Handles errors and timeouts

### Example Usage

```typescript
// Initialize components
await natsClient.connect({
  servers: config.messageBroker.url
});

// Initialize service manager
const serviceManager = new ServiceManager({
  serviceType: 'ingestion-agent',
  capabilities: ['document-ingest', 'chunking'],
  heartbeatInterval: config.serviceDiscovery.heartbeatInterval
});

await serviceManager.initialize();

// Initialize task manager
const taskManager = new TaskManager({
  serviceId: serviceManager.getServiceId(),
  capabilities: ['document-ingest', 'chunking']
});

await taskManager.initialize();

// Register task handler
taskManager.registerTaskHandler('process-document', async (task) => {
  const { documentId, format } = task.parameters;
  // Process document...
  return { success: true, chunks: [...] };
});

// Create a task for another agent
const taskId = await taskManager.createTask('process-chunk', {
  chunkId: '123',
  processType: 'extraction'
}, {
  timeout: 30000
});

// Or request a task to be performed
const result = await taskManager.requestTask('process-chunk', {
  chunkId: '123',
  processType: 'extraction'
}, {
  requiredCapabilities: ['chunk-processing'],
  timeout: 30000
});
```

## Message Format

```typescript
interface Message<T = unknown> {
  type: MessageType;
  headers: MessageHeaders;
  payload: T;
}

interface MessageHeaders {
  correlationId: string;
  messageId: string;
  timestamp: string;
  source: string;
  destination?: string;
  replyTo?: string;
  ttl?: number; // Time to live in milliseconds
}

enum MessageType {
  // System messages
  HEARTBEAT = 'system.heartbeat',
  REGISTER = 'system.register',
  UNREGISTER = 'system.unregister',
  SERVICE_STATUS_CHANGE = 'system.service.status.change',
  
  // Task management
  TASK_CREATE = 'task.create',
  TASK_UPDATE = 'task.update',
  TASK_COMPLETE = 'task.complete',
  TASK_FAIL = 'task.fail',
  TASK_REQUEST = 'task.request',
  TASK_CANCEL = 'task.cancel',
  TASK_ASSIGN = 'task.assign',
  
  // Storage operations
  STORAGE_SET = 'storage.set',
  STORAGE_GET = 'storage.get',
  STORAGE_REQUEST = 'storage.request',
  STORAGE_DELETE = 'storage.delete',
  STORAGE_LIST = 'storage.list',
  
  // Data exchange
  DATA_REQUEST = 'data.request',
  DATA_RESPONSE = 'data.response',
  DATA_STREAM_START = 'data.stream.start',
  DATA_STREAM_CHUNK = 'data.stream.chunk',
  DATA_STREAM_END = 'data.stream.end',
  
  // Error handling
  ERROR = 'error',
  ERROR_RETRY = 'error.retry',
  ERROR_TIMEOUT = 'error.timeout'
}
```

## Error Handling

- **Enhanced Error Payloads**: Detailed error information with error codes and severity levels
- **Timeouts**: Configurable timeouts for all operations with dedicated timeout messages
- **Retries**: Automatic retry with exponential backoff for failed tasks and operations
- **Error Type Guards**: TypeScript type guards for runtime type checking of error messages
- **Correlation IDs**: Error tracking with correlation IDs for related errors

## Monitoring

- Message metrics (throughput, latency, errors)
- Agent health status
- Task execution statistics
- Queue depths and backpressure indicators

## Security

- Message encryption (TLS for transport) - *Planned*
- Authentication using JWT - *Planned*
- Role-based access control for agents - *Planned*
- Message signing and verification - *Planned*

## Best Practices

1. **Type Safety**: Use TypeScript interfaces and type guards for message handling
2. **Idempotency**: Design message handlers to be idempotent
3. **Timeouts**: Always set appropriate timeouts for operations
4. **Retries**: Use the built-in retry mechanisms with exponential backoff
5. **Correlation IDs**: Include correlation IDs in all messages for tracing
6. **Error Handling**: Use the enhanced error payloads for detailed error information
7. **Event-Based Architecture**: Use the event emitters for loosely coupled components
8. **Service Discovery**: Leverage the service discovery for dynamic agent capabilities
9. **Documentation**: Refer to the MESSAGE_TYPES.md for detailed message format documentation
10. **Testing**: Write unit and integration tests for message handlers
