# Message Types

**Last Updated:** 2025-05-25

## Overview

The Message Types component defines the structure, validation, and type guards for all messages in the A2A communication layer. It provides a consistent interface for message creation, validation, and handling across the entire system.

## Features

- **Message Type Definitions**: Enum of all supported message types
- **Message Interfaces**: TypeScript interfaces for all message types
- **Type Guards**: Runtime type checking for messages
- **Error Handling**: Standardized error message format
- **Validation**: Message validation utilities

## Message Structure

All messages in the A2A communication layer follow a consistent structure:

```typescript
export interface Message<T = unknown> {
  type: MessageType;
  headers: MessageHeaders;
  payload: T;
}

export interface MessageHeaders {
  messageId: string;
  correlationId?: string;
  timestamp: string;
  source: string;
  target?: string;
  replyTo?: string;
  ttl?: number;
  priority?: number;
  contentType?: string;
  contentEncoding?: string;
  metadata?: Record<string, unknown>;
}
```

## Message Types

The system supports various message types, organized by functional category:

```typescript
export enum MessageType {
  // System Messages
  HEARTBEAT = 'system.heartbeat',
  REGISTER = 'system.register',
  UNREGISTER = 'system.unregister',
  DISCOVERY = 'system.discovery',
  
  // Task Management
  TASK_CREATE = 'task.create',
  TASK_UPDATE = 'task.update',
  TASK_COMPLETE = 'task.complete',
  TASK_FAIL = 'task.fail',
  TASK_CANCEL = 'task.cancel',
  TASK_ASSIGN = 'task.assign',
  TASK_REQUEST = 'task.request',
  TASK_RESPONSE = 'task.response',
  
  // Storage Operations
  STORAGE_SET = 'storage.set',
  STORAGE_GET = 'storage.get',
  STORAGE_DELETE = 'storage.delete',
  STORAGE_LIST = 'storage.list',
  STORAGE_RESPONSE = 'storage.response',
  
  // Data Exchange
  DATA_REQUEST = 'data.request',
  DATA_RESPONSE = 'data.response',
  DATA_STREAM_START = 'data.stream.start',
  DATA_STREAM_CHUNK = 'data.stream.chunk',
  DATA_STREAM_END = 'data.stream.end',
  
  // Error Messages
  ERROR = 'error'
}
```

## Usage

### Creating Messages

```typescript
import { MessageType, createMessage } from '../core/messaging/types';

// Create a task creation message
const taskMessage = createMessage(
  MessageType.TASK_CREATE,
  {
    taskType: 'process-document',
    parameters: {
      documentId: 'doc-123',
      format: 'pdf'
    },
    priority: 1
  },
  {
    source: 'document-service',
    correlationId: 'corr-123',
    metadata: {
      initiatedBy: 'user-456'
    }
  }
);

// Create a storage set message
const storageMessage = createMessage(
  MessageType.STORAGE_SET,
  {
    key: 'user-preferences',
    value: {
      theme: 'dark',
      fontSize: 14
    },
    namespace: 'settings',
    ttl: 3600000
  },
  {
    source: 'user-service'
  }
);

// Create an error message
const errorMessage = createMessage(
  MessageType.ERROR,
  {
    code: 'DOCUMENT_NOT_FOUND',
    message: 'The requested document was not found',
    details: {
      documentId: 'doc-123'
    }
  },
  {
    source: 'document-service',
    correlationId: 'corr-123'
  }
);
```

### Type Guards

```typescript
import { isTaskMessage, isErrorMessage, isStorageMessage, isDataMessage } from '../core/messaging/types';

// Check if a message is a task message
if (isTaskMessage(message)) {
  console.log('Task type:', message.payload.taskType);
}

// Check if a message is an error message
if (isErrorMessage(message)) {
  console.log('Error code:', message.payload.code);
  console.log('Error message:', message.payload.message);
}

// Check if a message is a storage message
if (isStorageMessage(message)) {
  console.log('Storage operation on key:', message.payload.key);
}

// Check if a message is a data message
if (isDataMessage(message)) {
  console.log('Data type:', message.payload.dataType);
}

// Check specific message types
if (message.type === MessageType.TASK_CREATE) {
  console.log('Creating task:', message.payload.taskType);
}
```

### Message Validation

```typescript
import { validateMessage, ValidationError } from '../core/messaging/types';

try {
  // Validate a message
  validateMessage(message);
  console.log('Message is valid');
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Invalid message:', error.message);
    console.error('Validation errors:', error.errors);
  }
}
```

## API Reference

### Message Creation

```typescript
function createMessage<T>(
  type: MessageType,
  payload: T,
  options?: Partial<MessageHeaders>
): Message<T>
```

### Type Guards

```typescript
function isTaskMessage(message: Message<unknown>): message is TaskMessage
function isErrorMessage(message: Message<unknown>): message is ErrorMessage
function isStorageMessage(message: Message<unknown>): message is StorageMessage
function isDataMessage(message: Message<unknown>): message is DataMessage
```

### Message Validation

```typescript
function validateMessage(message: Message<unknown>): void
function validateTaskMessage(message: TaskMessage): void
function validateErrorMessage(message: ErrorMessage): void
function validateStorageMessage(message: StorageMessage): void
function validateDataMessage(message: DataMessage): void
```

## Message Type Interfaces

### Task Messages

```typescript
export interface TaskCreateMessage extends Message<TaskCreatePayload> {
  type: MessageType.TASK_CREATE;
}

export interface TaskCreatePayload {
  taskType: string;
  parameters: Record<string, unknown>;
  priority?: number;
  timeout?: number;
  metadata?: Record<string, unknown>;
  assignTo?: string;
  dependencies?: string[];
}

export interface TaskUpdateMessage extends Message<TaskUpdatePayload> {
  type: MessageType.TASK_UPDATE;
}

export interface TaskUpdatePayload {
  taskId: string;
  status: TaskStatus;
  progress?: number;
  statusMessage?: string;
  metadata?: Record<string, unknown>;
}

// Additional task message interfaces...
```

### Storage Messages

```typescript
export interface StorageSetMessage extends Message<StorageSetPayload> {
  type: MessageType.STORAGE_SET;
}

export interface StorageSetPayload {
  key: string;
  value: unknown;
  namespace?: string;
  ttl?: number;
  metadata?: Record<string, unknown>;
  ifNotExists?: boolean;
  ifVersion?: number;
  overwrite?: boolean;
}

export interface StorageGetMessage extends Message<StorageGetPayload> {
  type: MessageType.STORAGE_GET;
}

export interface StorageGetPayload {
  key: string;
  namespace?: string;
  version?: number;
  includeMetadata?: boolean;
}

// Additional storage message interfaces...
```

### Data Messages

```typescript
export interface DataRequestMessage extends Message<DataRequestPayload> {
  type: MessageType.DATA_REQUEST;
}

export interface DataRequestPayload {
  dataType: string;
  parameters: Record<string, unknown>;
  timeout?: number;
  metadata?: Record<string, unknown>;
}

export interface DataResponseMessage extends Message<DataResponsePayload> {
  type: MessageType.DATA_RESPONSE;
}

export interface DataResponsePayload {
  requestId: string;
  data: unknown;
  metadata?: Record<string, unknown>;
}

// Additional data message interfaces...
```

### Error Messages

```typescript
export interface ErrorMessage extends Message<ErrorPayload> {
  type: MessageType.ERROR;
}

export interface ErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retryable?: boolean;
  source?: string;
  timestamp?: string;
  requestId?: string;
  correlationId?: string;
  stackTrace?: string;
}
```

## Best Practices

1. **Message Types**: Use the appropriate message type for each operation
2. **Type Guards**: Use type guards to ensure type safety at runtime
3. **Validation**: Validate messages before processing them
4. **Error Handling**: Use standardized error messages for error reporting
5. **Headers**: Include all relevant information in message headers
6. **Correlation**: Use correlation IDs to track related messages
7. **Metadata**: Use metadata for additional context
8. **Timestamps**: Include accurate timestamps in all messages

## Implementation Details

The Message Types component is implemented using TypeScript interfaces and type guards. It provides a consistent structure for all messages in the A2A communication layer and ensures type safety at both compile time and runtime.

### Key Files

- `src/core/messaging/types.ts` - Main implementation
- `tests/unit/messaging/messageTypes.test.ts` - Unit tests
