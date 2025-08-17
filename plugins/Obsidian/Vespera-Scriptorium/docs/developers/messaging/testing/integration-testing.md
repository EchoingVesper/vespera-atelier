# A2A Messaging Integration Testing Guide

This guide provides best practices and common patterns for testing the A2A messaging system components to prevent
common type errors and integration issues.

## Overview

Integration testing for the A2A messaging system requires careful attention to:

- Type consistency between components
- Proper mocking of NATS client and services
- Handling of asynchronous operations
- Validation of message payloads
- Testing of error scenarios

## Common Type Issues and Solutions

### 1. Property vs Method Access

When testing components that expose boolean properties, ensure you access them as properties, not methods:

```typescript
// CORRECT: Access as property
expect(component.isConnected).toBe(true);

// INCORRECT: Will cause TypeScript errors
expect(component.isConnected()).toBe(true);
```

### 2. Date vs String Handling

When working with timestamps in messages, ensure proper conversion between Date objects and ISO strings:

```typescript
// CORRECT: Convert Date to ISO string
const message = {
  timestamp: new Date().toISOString(),
  // other properties...
};

// INCORRECT: Will cause type errors
const message = {
  timestamp: new Date(), // Should be converted to ISO string
  // other properties...
};
```

### 3. Required Message Properties

Always include all required properties in message payloads, especially when creating test fixtures:

```typescript
// CORRECT: Include all required properties
const dataRequestPayload: DataRequestPayload = {
  requestId: 'req-123',  // Required property
  dataType: 'document',
  parameters: { id: 'doc-456' }
};

// INCORRECT: Missing required property
const dataRequestPayload: DataRequestPayload = {
  // Missing requestId
  dataType: 'document',
  parameters: { id: 'doc-456' }
};
```

### 4. Namespace Parameters in Storage Operations

When testing storage operations, always include the required namespace parameter:

```typescript
// CORRECT: Include namespace parameter
await storageManager.set('key', 'value', 'test-namespace');

// INCORRECT: Missing namespace parameter
await storageManager.set('key', 'value');
```

### 5. Proper Type Casting for Message Type Breakdowns

When testing metrics collection, ensure proper type casting for message type breakdowns:

```typescript
// CORRECT: Proper type handling
const messageTypes: Record<MessageType, number> = {} as Record<MessageType, number>;
messageTypes[MessageType.HEARTBEAT] = 5;
messageTypes[MessageType.TASK_CREATE] = 3;

// INCORRECT: Improper type handling
const messageTypes = {};
messageTypes[MessageType.HEARTBEAT] = 5;
```

## Mock Setup Best Practices

### NATS Client Mocking

```typescript
// Create a properly typed mock
const mockNatsClient = {
  isConnected: true,
  publish: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn().mockImplementation((subject, callback) => {
    // Store callback for later use in tests
    subscriptions[subject] = callback;
    return { unsubscribe: jest.fn() };
  }),
  // other methods...
};
```

### Service Manager Mocking

```typescript
// Create a properly typed mock
const mockServiceManager = {
  serviceId: 'test-service',
  registerService: jest.fn().mockResolvedValue(undefined),
  discoverServices: jest.fn().mockResolvedValue([
    {
      serviceId: 'service-1',
      serviceType: 'document-processor',
      capabilities: ['text-extraction'],
      status: ServiceStatus.ONLINE
    }
  ]),
  // other methods...
};
```

## Test Structure Pattern

```typescript
describe('A2A Messaging Integration', () => {
  let serviceManager: ServiceManager;
  let taskManager: TaskManager;
  let natsClient: NatsClient;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create properly typed mocks
    natsClient = createMockNatsClient();
    
    // Initialize components with mocks
    serviceManager = new ServiceManager({ natsClient, serviceId: 'test-service' });
    taskManager = new TaskManager({ 
      natsClient, 
      serviceManager,
      serviceId: 'test-service'
    });
  });
  
  test('should create and track tasks', async () => {
    // Test implementation
  });
  
  // Additional tests...
});
```

## Common Testing Scenarios

### 1. Message Publishing and Subscription

```typescript
test('should publish and receive messages', async () => {
  // Setup subscription
  let receivedMessage: any = null;
  mockNatsClient.subscribe.mockImplementation((subject, callback) => {
    if (subject === 'test.subject') {
      // Store callback
      subscriptions[subject] = callback;
    }
    return { unsubscribe: jest.fn() };
  });
  
  // Publish message
  await natsClient.publish('test.subject', { type: MessageType.HEARTBEAT, payload: {} });
  
  // Simulate message receipt
  subscriptions['test.subject']({ type: MessageType.HEARTBEAT, payload: {} });
  
  // Assertions
  expect(mockNatsClient.publish).toHaveBeenCalledWith(
    'test.subject',
    expect.objectContaining({ type: MessageType.HEARTBEAT })
  );
});
```

### 2. Task Creation and Execution

```typescript
test('should create and execute tasks', async () => {
  // Setup task handler
  taskManager.registerTaskHandler('test-task', jest.fn().mockResolvedValue({ success: true }));
  
  // Create task
  const taskId = await taskManager.createTask('test-task', { param1: 'value1' });
  
  // Simulate task message
  const taskMessage = {
    type: MessageType.TASK_CREATE,
    payload: {
      taskId,
      taskType: 'test-task',
      parameters: { param1: 'value1' },
      sender: 'test-service',
      timestamp: new Date().toISOString()
    }
  };
  
  // Trigger task handler via subscription
  subscriptions['task.create'](taskMessage);
  
  // Assertions
  expect(taskManager.getTaskStatus(taskId)).toBe(TaskStatus.COMPLETED);
});
```

## Testing Timeouts and Failures

```typescript
test('should handle operation timeouts', async () => {
  // Mock a timeout
  mockNatsClient.publish.mockImplementation(() => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new Error('Operation timed out'));
      }, 50);
    });
  });
  
  // Attempt operation with timeout
  await expect(natsClient.publish('test.subject', { 
    type: MessageType.HEARTBEAT, 
    payload: {} 
  })).rejects.toThrow('Operation timed out');
});
```

**Last Updated**: 2025-05-27
