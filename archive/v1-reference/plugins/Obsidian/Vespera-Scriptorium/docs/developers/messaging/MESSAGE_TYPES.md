# A2A Message Types

This document describes the message types used in the Agent-to-Agent (A2A) communication layer of the Protocol-Based Architecture.

## Overview

The A2A communication layer uses a message-based architecture to enable communication between agents. Messages are sent over the NATS messaging system and follow a standardized format with headers and typed payloads.

## Message Structure

All messages follow this common structure:

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
```

## Message Categories

Messages are organized into the following categories:

1. **System Messages** - For service management and health monitoring
2. **Task Management Messages** - For coordinating tasks between agents
3. **Storage Operation Messages** - For distributed data storage
4. **Data Exchange Messages** - For requesting and sharing data
5. **Error Messages** - For error reporting and handling

## System Messages

### HEARTBEAT

Used to indicate that a service is alive and healthy.

```typescript
// MessageType.HEARTBEAT = 'system.heartbeat'
interface HeartbeatPayload {
  timestamp: string;
  status: ServiceStatus;
  metrics?: Record<string, number>;
  serviceType?: string;
  capabilities?: string[];
}
```

### REGISTER

Used when a service joins the network.

```typescript
// MessageType.REGISTER = 'system.register'
interface RegistrationPayload {
  agentId: string;
  capabilities: string[];
  metadata?: Record<string, unknown>;
}
```

### UNREGISTER

Used when a service leaves the network.

```typescript
// MessageType.UNREGISTER = 'system.unregister'
interface UnregistrationPayload {
  agentId: string;
}
```

### SERVICE_STATUS_CHANGE

Used to notify other services about a status change.

```typescript
// MessageType.SERVICE_STATUS_CHANGE = 'system.service.status.change'
interface ServiceStatusChangePayload {
  serviceId: string;
  status: ServiceStatus;
  timestamp: string;
  reason?: string;
}
```

## Task Management Messages

### TASK_CREATE

Used to create a new task for an agent to process.

```typescript
// MessageType.TASK_CREATE = 'task.create'
interface TaskCreatePayload extends BaseTaskPayload {
  parameters: Record<string, unknown>;
  priority?: number;
  timeout?: number;
  assignTo?: string; // Optional service ID to assign the task to
  dueDate?: string; // ISO timestamp for when the task should be completed
  dependencies?: string[]; // List of task IDs that must be completed before this task
}
```

### TASK_UPDATE

Used to update the status or details of an existing task.

```typescript
// MessageType.TASK_UPDATE = 'task.update'
interface TaskUpdatePayload extends BaseTaskPayload {
  status: TaskStatus;
  progress?: number; // 0-100 percentage
  statusMessage?: string;
  estimatedCompletion?: string; // ISO timestamp
  updatedParameters?: Record<string, unknown>;
}
```

### TASK_COMPLETE

Used to mark a task as completed with results.

```typescript
// MessageType.TASK_COMPLETE = 'task.complete'
interface TaskCompletePayload extends BaseTaskPayload {
  result: unknown;
  processingTime?: number; // In milliseconds
  metrics?: Record<string, number>;
}
```

### TASK_FAIL

Used to mark a task as failed with error details.

```typescript
// MessageType.TASK_FAIL = 'task.fail'
interface TaskFailPayload extends BaseTaskPayload {
  error: ErrorPayload;
  partialResult?: unknown;
  retryable: boolean;
  attemptCount?: number;
}
```

### TASK_REQUEST

Used to request a specific agent to perform a task.

```typescript
// MessageType.TASK_REQUEST = 'task.request'
interface TaskRequestPayload extends BaseTaskPayload {
  parameters: Record<string, unknown>;
  priority?: number;
  timeout?: number;
  requiredCapabilities?: string[];
}
```

### TASK_CANCEL

Used to cancel a task that is in progress or pending.

```typescript
// MessageType.TASK_CANCEL = 'task.cancel'
interface TaskCancelPayload extends BaseTaskPayload {
  reason?: string;
  force?: boolean;
}
```

### TASK_ASSIGN

Used to assign a task to a specific service.

```typescript
// MessageType.TASK_ASSIGN = 'task.assign'
interface TaskAssignPayload extends BaseTaskPayload {
  assignedTo: string; // Service ID
  assignedBy: string; // Service ID that made the assignment
  reason?: string;
}
```

## Storage Operation Messages

### STORAGE_SET

Used to store data in the distributed storage system.

```typescript
// MessageType.STORAGE_SET = 'storage.set'
interface StorageSetPayload extends BaseStoragePayload {
  value: unknown;
  ttl?: number; // Time to live in milliseconds
  options?: {
    overwrite?: boolean;
    ifNotExists?: boolean;
    ifVersion?: number;
  };
}
```

### STORAGE_GET

Used to retrieve data from the distributed storage system.

```typescript
// MessageType.STORAGE_GET = 'storage.get'
interface StorageGetPayload extends BaseStoragePayload {
  includeMetadata?: boolean;
  version?: number; // Specific version to retrieve
}
```

### STORAGE_REQUEST

Used to request specific data from another agent.

```typescript
// MessageType.STORAGE_REQUEST = 'storage.request'
interface StorageRequestPayload extends BaseStoragePayload {
  requesterId: string;
  priority?: number;
  timeout?: number;
}
```

### STORAGE_DELETE

Used to delete data from the distributed storage system.

```typescript
// MessageType.STORAGE_DELETE = 'storage.delete'
interface StorageDeletePayload extends BaseStoragePayload {
  options?: {
    ifExists?: boolean;
    ifVersion?: number;
  };
}
```

### STORAGE_LIST

Used to list keys in the distributed storage system.

```typescript
// MessageType.STORAGE_LIST = 'storage.list'
interface StorageListPayload {
  namespace?: string;
  pattern?: string; // Glob pattern for matching keys
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}
```

## Data Exchange Messages

### DATA_REQUEST

Used to request data from another agent.

```typescript
// MessageType.DATA_REQUEST = 'data.request'
interface DataRequestPayload extends BaseDataPayload {
  dataType: string;
  parameters: Record<string, unknown>;
  priority?: number;
  timeout?: number;
}
```

### DATA_RESPONSE

Used to respond to a data request with the requested information.

```typescript
// MessageType.DATA_RESPONSE = 'data.response'
interface DataResponsePayload extends BaseDataPayload {
  data: unknown;
  processingTime?: number; // In milliseconds
  format?: string; // Data format (e.g., 'json', 'binary', 'text')
}
```

### DATA_STREAM_START

Used to start a data stream.

```typescript
// MessageType.DATA_STREAM_START = 'data.stream.start'
interface DataStreamStartPayload extends BaseDataPayload {
  dataType: string;
  totalChunks?: number;
  totalSize?: number;
  format?: string;
  compression?: string;
}
```

### DATA_STREAM_CHUNK

Used to send a chunk of data in a stream.

```typescript
// MessageType.DATA_STREAM_CHUNK = 'data.stream.chunk'
interface DataStreamChunkPayload extends BaseDataPayload {
  chunkIndex: number;
  data: unknown;
  isLast: boolean;
  checksum?: string;
}
```

### DATA_STREAM_END

Used to end a data stream.

```typescript
// MessageType.DATA_STREAM_END = 'data.stream.end'
interface DataStreamEndPayload extends BaseDataPayload {
  totalChunks: number;
  totalSize: number;
  checksum?: string;
  error?: ErrorPayload;
}
```

## Error Messages

### ERROR

Used for general error reporting.

```typescript
// MessageType.ERROR = 'error'
interface ErrorPayload {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
  source?: string; // Component that generated the error
  timestamp?: string; // ISO timestamp when the error occurred
  severity?: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  correlationId?: string; // For tracking related errors
  suggestedAction?: string; // Recommended action to resolve the error
  errorType?: string; // Classification of error (e.g., 'NETWORK', 'TIMEOUT', 'VALIDATION')
}
```

### ERROR_RETRY

Used when an operation should be retried.

```typescript
// MessageType.ERROR_RETRY = 'error.retry'
// Uses the same ErrorPayload as ERROR, but with retryable=true
```

### ERROR_TIMEOUT

Used when an operation times out.

```typescript
// MessageType.ERROR_TIMEOUT = 'error.timeout'
// Uses the same ErrorPayload as ERROR, but with errorType='TIMEOUT'
```

## Usage Examples

### Creating and Completing a Task

```typescript
// Create a task
const taskId = await taskManager.createTask('document.process', {
  documentId: 'doc-123',
  processingType: 'ocr'
});

// Complete a task
await taskManager.completeTask(taskId, {
  text: 'Extracted text from document',
  confidence: 0.95
});
```

### Storing and Retrieving Data

```typescript
// Store data
await storageManager.setValue('user.preferences', {
  theme: 'dark',
  fontSize: 14
}, {
  namespace: 'settings'
});

// Retrieve data
const preferences = await storageManager.getValue('user.preferences', {
  namespace: 'settings'
});
```

### Requesting Data

```typescript
// Request data
const weatherData = await dataExchange.requestData('weather.forecast', {
  location: 'New York',
  days: 5
});

// Register a data provider
dataExchange.registerDataProvider('document.summary', async (parameters) => {
  const { documentId } = parameters;
  // Process the document and generate a summary
  return {
    summary: 'This is a summary of the document',
    keyPoints: ['Point 1', 'Point 2']
  };
});
```

## Error Handling

### Retry Mechanism

The A2A communication layer includes a built-in retry mechanism for failed operations:

```typescript
// Configure retry strategy
const retryStrategy = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffFactor: 2 // Exponential backoff
};

// Task manager with retry
const taskManager = new TaskManager({
  serviceId: 'my-service',
  capabilities: ['document.processing'],
  retryStrategy
});
```

### Error Propagation

Errors are propagated through the system using the ERROR message type:

```typescript
// Handle errors
try {
  await taskManager.createTask('document.process', { documentId: 'doc-123' });
} catch (error) {
  // Send error message
  await natsClient.publish('error', {
    type: MessageType.ERROR,
    headers: {
      correlationId: 'corr-123',
      messageId: 'msg-456',
      timestamp: new Date().toISOString(),
      source: 'my-service'
    },
    payload: {
      code: 'TASK_CREATION_FAILED',
      message: error.message,
      details: error,
      retryable: true
    }
  });
}
```

## Best Practices

1. **Use Correlation IDs**: Always include a correlation ID in message headers to track related messages.

2. **Include Timestamps**: Include timestamps in all messages for debugging and monitoring.

3. **Set TTL for Time-Sensitive Messages**: Use the `ttl` header field for time-sensitive messages.

4. **Handle Errors Gracefully**: Always include error handling and retry mechanisms.

5. **Use Type Guards**: Use the provided type guards to ensure type safety when processing messages.

6. **Validate Messages**: Validate incoming messages before processing them.

7. **Monitor Message Flow**: Set up monitoring to track message flow and detect issues.

8. **Use Request/Reply Pattern**: For synchronous operations, use the request/reply pattern.

9. **Use Streaming for Large Data**: For large data transfers, use the streaming messages.

10. **Document Message Types**: Keep this documentation up-to-date as new message types are added.

## Future Enhancements

1. **Message Persistence**: Add support for persisting messages for reliability.
2. **Load Balancing**: Implement load balancing for task distribution.
3. **Message Prioritization**: Add support for prioritizing messages.
4. **Rate Limiting**: Implement rate limiting to prevent overloading services.
5. **Message Encryption**: Add support for encrypting sensitive messages.
