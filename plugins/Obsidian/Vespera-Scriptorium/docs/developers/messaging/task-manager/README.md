# Task Manager

**Last Updated:** 2025-05-25

## Overview

The Task Manager handles task creation, delegation, execution, and tracking for the A2A communication layer. It enables agents to create tasks, assign them to specific services, track their progress, and handle task completion or failure.

## Features

- **Task Creation**: Create tasks with parameters and metadata
- **Task Assignment**: Assign tasks to specific services based on capabilities
- **Task Execution**: Execute tasks using registered handlers
- **Task Tracking**: Track task status and progress
- **Retry Mechanism**: Automatic retry with exponential backoff for failed tasks
- **Event-Based Notifications**: Event emitter for task lifecycle events

## Usage

### Initialization

```typescript
import { TaskManager, ServiceManager } from '../core/messaging';

// Create a task manager
const taskManager = new TaskManager({
  serviceId: serviceManager.getServiceId(), // Use the service ID from the Service Manager
  capabilities: ['document-processing', 'text-extraction'],
  maxConcurrentTasks: 10,
  taskTimeout: 60000, // 60 seconds
  retryStrategy: {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2
  }
});

// Initialize the task manager
await taskManager.initialize();
```

### Task Handlers

```typescript
// Register a task handler
taskManager.registerTaskHandler('process-document', async (task) => {
  const { documentId, format } = task.parameters;
  
  // Process the document
  console.log(`Processing document ${documentId} in ${format} format`);
  
  // Return the result
  return {
    success: true,
    extractedText: 'Document content...',
    metadata: {
      pageCount: 5,
      wordCount: 1250
    }
  };
});
```

### Creating Tasks

```typescript
// Create a task
const taskId = await taskManager.createTask(
  'process-document',
  {
    documentId: 'doc-123',
    format: 'pdf'
  },
  {
    priority: 1,
    timeout: 120000,
    metadata: {
      source: 'user-upload',
      filename: 'document.pdf'
    },
    assignTo: 'specific-service-id' // Optional
  }
);

console.log(`Created task: ${taskId}`);
```

### Requesting Tasks

```typescript
// Request a task to be performed by a service with specific capabilities
const result = await taskManager.requestTask(
  'analyze-image',
  {
    imageId: 'img-456',
    analysisType: 'object-detection'
  },
  {
    requiredCapabilities: ['image-analysis', 'object-detection'],
    timeout: 30000
  }
);

console.log('Task result:', result);
```

### Task Lifecycle Management

```typescript
// Update a task's status
await taskManager.updateTask(taskId, TaskStatus.IN_PROGRESS, {
  progress: 50,
  statusMessage: 'Processing page 3 of 5'
});

// Complete a task with results
await taskManager.completeTask(taskId, {
  extractedText: 'Document content...',
  metadata: {
    pageCount: 5,
    wordCount: 1250
  }
}, {
  processingTime: 5000,
  metrics: {
    cpuUsage: 0.75,
    memoryUsage: 256
  }
});

// Fail a task with error
await taskManager.failTask(taskId, {
  code: 'DOCUMENT_PROCESSING_ERROR',
  message: 'Failed to process document',
  retryable: true
}, {
  partialResult: {
    extractedPages: 2
  }
});

// Cancel a task
await taskManager.cancelTask(taskId, 'User requested cancellation');
```

### Event Handling

```typescript
// Listen for task events
taskManager.on('taskCreated', (taskId, payload) => {
  console.log(`Task created: ${taskId}`);
});

taskManager.on('taskUpdated', (taskId, payload) => {
  console.log(`Task updated: ${taskId}, status: ${payload.status}`);
});

taskManager.on('taskCompleted', (taskId, payload) => {
  console.log(`Task completed: ${taskId}`);
});

taskManager.on('taskFailed', (taskId, payload) => {
  console.log(`Task failed: ${taskId}, error: ${payload.error.message}`);
});
```

### Cleanup

```typescript
// Shutdown the task manager
await taskManager.shutdown();
```

## API Reference

### `TaskManager`

The main class for task management.

#### Constructor

```typescript
constructor(options: TaskManagerOptions)
```

- `options`: Configuration options for the task manager
  - `serviceId`: ID of the service running this task manager
  - `capabilities`: Array of capabilities this service provides
  - `maxConcurrentTasks`: Maximum number of concurrent tasks
  - `taskTimeout`: Default timeout for tasks in milliseconds
  - `retryStrategy`: Configuration for task retry behavior
  - `natsClient`: Optional NATS client instance

#### Methods

- `initialize(): Promise<void>` - Initialize the task manager
- `shutdown(): Promise<void>` - Shutdown the task manager
- `registerTaskHandler(taskType: string, handler: (task: TaskInfo) => Promise<unknown>): void` - Register a handler for a specific task type
- `createTask(taskType: string, parameters: Record<string, unknown>, options?: TaskOptions): Promise<string>` - Create a new task
- `updateTask(taskId: string, status: TaskStatus, options?: UpdateOptions): Promise<void>` - Update a task's status
- `completeTask(taskId: string, result: unknown, options?: CompleteOptions): Promise<void>` - Complete a task with results
- `failTask(taskId: string, error: ErrorPayload, options?: FailOptions): Promise<void>` - Fail a task with error
- `cancelTask(taskId: string, reason?: string, force?: boolean): Promise<void>` - Cancel a task
- `requestTask(taskType: string, parameters: Record<string, unknown>, options?: RequestOptions): Promise<unknown>` - Request a task to be performed
- `getTask(taskId: string): TaskInfo | undefined` - Get information about a specific task
- `getAllTasks(): TaskInfo[]` - Get information about all tasks
- `getActiveTasks(): TaskInfo[]` - Get information about active tasks

#### Events

- `taskCreated` - Emitted when a task is created
- `taskUpdated` - Emitted when a task is updated
- `taskCompleted` - Emitted when a task is completed
- `taskFailed` - Emitted when a task fails
- `taskCancelled` - Emitted when a task is cancelled
- `taskAssigned` - Emitted when a task is assigned
- `taskRequested` - Emitted when a task is requested
- `error` - Emitted when an error occurs

## Task Status

The task manager tracks the status of each task:

```typescript
export enum TaskStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  BLOCKED = 'BLOCKED'
}
```

## Task Information

The task manager maintains information about each task:

```typescript
export interface TaskInfo {
  taskId: string;
  taskType: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
  priority: number;
  parameters: Record<string, unknown>;
  result?: unknown;
  error?: ErrorPayload;
  progress?: number;
  metadata?: Record<string, unknown>;
  timeout?: number;
  dependencies?: string[];
  retryCount?: number;
}
```

## Best Practices

1. **Task Types**: Use specific, descriptive task types
2. **Parameters**: Include all necessary parameters for task execution
3. **Timeouts**: Set appropriate timeouts based on task complexity
4. **Error Handling**: Provide detailed error information for failed tasks
5. **Idempotency**: Design task handlers to be idempotent
6. **Progress Updates**: Provide regular progress updates for long-running tasks
7. **Retry Strategy**: Configure retry strategy based on task criticality
8. **Event Handling**: Listen for task events to react to task lifecycle changes

## Implementation Details

The Task Manager uses NATS publish/subscribe for task creation, delegation, and status updates. It manages task execution using registered handlers and provides automatic retry for failed tasks with exponential backoff.

### Key Files

- `src/core/messaging/taskManager.ts` - Main implementation
- `tests/unit/messaging/taskManager.test.ts` - Unit tests
- `tests/integration/messaging/messageFlow.test.ts` - Integration tests
