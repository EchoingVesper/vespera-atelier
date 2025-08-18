# A2A Messaging System Integration Guide

**Last Updated:** 2025-05-25

## Introduction

This guide provides step-by-step instructions for integrating the Agent-to-Agent (A2A) Messaging System into your
Vespera-Scriptorium plugin components. It covers common integration patterns, best practices, and troubleshooting
tips to help you effectively leverage the messaging infrastructure.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Basic Integration](#basic-integration)
3. [Service Registration](#service-registration)
4. [Task Management](#task-management)
5. [Data Exchange](#data-exchange)
6. [Storage Operations](#storage-operations)
7. [Error Handling](#error-handling)
8. [Testing](#testing)
9. [Advanced Patterns](#advanced-patterns)
10. [Troubleshooting](#troubleshooting)

## Prerequisites

Before integrating the A2A Messaging System, ensure you have:

- NATS Server running (v2.9.0+)
- TypeScript (v4.5.0+)
- Node.js (v16.0.0+)
- Required dependencies installed:

  ```bash
  npm install nats uuid eventemitter3
  ```

## Basic Integration

### Step 1: Import Required Components

```typescript
import { 
  natsClient, 
  ServiceManager, 
  TaskManager, 
  StorageManager, 
  DataExchange,
  MessageType
} from '../core/messaging';
```

### Step 2: Configure and Initialize NATS Client

```typescript
// Load configuration
const config = {
  servers: 'nats://localhost:4222',
  name: 'my-agent',
  timeout: 5000,
  maxReconnectAttempts: 10,
  pingInterval: 30000
};

// Initialize NATS client
try {
  await natsClient.connect(config);
  console.log('Connected to NATS server');
} catch (error) {
  console.error('Failed to connect to NATS server:', error);
  // Handle connection failure
}
```

### Step 3: Create a Base Agent Class

```typescript
import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';

class BaseAgent extends EventEmitter {
  private serviceId: string;
  private serviceManager: ServiceManager;
  private taskManager: TaskManager;
  private storageManager: StorageManager;
  private dataExchange: DataExchange;
  
  constructor(options: {
    serviceType: string;
    capabilities: string[];
    metadata?: Record<string, unknown>;
  }) {
    super();
    
    this.serviceId = `agent-${options.serviceType}-${uuidv4()}`;
    
    // Initialize service manager
    this.serviceManager = new ServiceManager({
      serviceId: this.serviceId,
      serviceType: options.serviceType,
      capabilities: options.capabilities,
      metadata: options.metadata
    });
    
    // Initialize task manager
    this.taskManager = new TaskManager({
      serviceId: this.serviceId,
      capabilities: options.capabilities
    });
    
    // Initialize storage manager
    this.storageManager = new StorageManager({
      serviceId: this.serviceId
    });
    
    // Initialize data exchange
    this.dataExchange = new DataExchange({
      serviceId: this.serviceId,
      capabilities: options.capabilities
    });
  }
  
  async initialize(): Promise<void> {
    // Initialize all components
    await this.serviceManager.initialize();
    await this.taskManager.initialize();
    await this.storageManager.initialize();
    await this.dataExchange.initialize();
    
    console.log(`Agent ${this.serviceId} initialized`);
  }
  
  async shutdown(): Promise<void> {
    // Shutdown all components
    await this.dataExchange.shutdown();
    await this.storageManager.shutdown();
    await this.taskManager.shutdown();
    await this.serviceManager.shutdown();
    
    console.log(`Agent ${this.serviceId} shutdown`);
  }
  
  // Getters for components
  getServiceManager(): ServiceManager {
    return this.serviceManager;
  }
  
  getTaskManager(): TaskManager {
    return this.taskManager;
  }
  
  getStorageManager(): StorageManager {
    return this.storageManager;
  }
  
  getDataExchange(): DataExchange {
    return this.dataExchange;
  }
  
  getServiceId(): string {
    return this.serviceId;
  }
}

export default BaseAgent;
```

### Step 4: Create a Specialized Agent

```typescript
import BaseAgent from './BaseAgent';

class DocumentProcessorAgent extends BaseAgent {
  constructor() {
    super({
      serviceType: 'document-processor',
      capabilities: ['text-extraction', 'image-analysis', 'document-indexing'],
      metadata: {
        version: '1.0.0',
        description: 'Document processing agent'
      }
    });
  }
  
  async initialize(): Promise<void> {
    await super.initialize();
    
    // Register task handlers
    this.registerTaskHandlers();
    
    // Register data providers
    this.registerDataProviders();
    
    console.log('Document processor agent initialized');
  }
  
  private registerTaskHandlers(): void {
    const taskManager = this.getTaskManager();
    
    // Register task handlers
    taskManager.registerTaskHandler('process-document', async (task) => {
      const { documentId, format } = task.parameters;
      
      console.log(`Processing document ${documentId} in ${format} format`);
      
      // Process the document
      // ...
      
      return {
        success: true,
        extractedText: 'Document content...',
        metadata: {
          pageCount: 5,
          wordCount: 1250
        }
      };
    });
  }
  
  private registerDataProviders(): void {
    const dataExchange = this.getDataExchange();
    
    // Register data providers
    dataExchange.registerDataProvider('document-metadata', async (parameters) => {
      const { documentId } = parameters;
      
      console.log(`Providing metadata for document ${documentId}`);
      
      // Fetch document metadata
      // ...
      
      return {
        documentId,
        title: 'Sample Document',
        author: 'John Doe',
        createdAt: '2025-05-20T10:30:00Z',
        tags: ['sample', 'document']
      };
    });
  }
}

export default DocumentProcessorAgent;
```

### Step 5: Use the Agent in Your Application

```typescript
import DocumentProcessorAgent from './agents/DocumentProcessorAgent';

async function main() {
  // Create and initialize the agent
  const agent = new DocumentProcessorAgent();
  
  try {
    await agent.initialize();
    
    // Use the agent
    // ...
    
    // Handle shutdown
    process.on('SIGINT', async () => {
      console.log('Shutting down...');
      await agent.shutdown();
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to initialize agent:', error);
    process.exit(1);
  }
}

main();
```

## Service Registration

Service registration allows your agent to be discovered by other agents in the system.

### Registering a Service

The `ServiceManager` automatically registers your service during initialization, but you can customize the registration:

```typescript
// Get the service manager
const serviceManager = agent.getServiceManager();

// Update service metadata
serviceManager.updateMetadata({
  version: '1.0.1',
  description: 'Updated document processing agent',
  supportedFormats: ['pdf', 'docx', 'txt']
});

// Update service capabilities
serviceManager.updateCapabilities([
  'text-extraction',
  'image-analysis',
  'document-indexing',
  'ocr-processing'
]);
```

### Discovering Services

```typescript
// Find services by capability
const textProcessors = serviceManager.findServicesByCapability('text-processing');
console.log(`Found ${textProcessors.length} text processors`);

// Find services by type
const imageProcessors = serviceManager.findServicesByType('image-processor');
console.log(`Found ${imageProcessors.length} image processors`);

// Listen for service discovery events
serviceManager.on('serviceDiscovered', (serviceInfo) => {
  console.log(`Discovered service: ${serviceInfo.serviceId} (${serviceInfo.serviceType})`);
  // Handle the new service
});
```

## Task Management

Task management enables your agent to create, delegate, and execute tasks.

### Creating Tasks

```typescript
// Get the task manager
const taskManager = agent.getTaskManager();

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
    }
  }
);

console.log(`Created task: ${taskId}`);
```

### Handling Tasks

```typescript
// Register a task handler
taskManager.registerTaskHandler('process-document', async (task) => {
  const { documentId, format } = task.parameters;
  
  console.log(`Processing document ${documentId} in ${format} format`);
  
  // Update task progress
  await taskManager.updateTask(task.taskId, TaskStatus.IN_PROGRESS, {
    progress: 50,
    statusMessage: 'Processing page 3 of 5'
  });
  
  // Process the document
  // ...
  
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

### Monitoring Tasks

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

## Data Exchange

Data exchange allows your agent to share data with other agents.

### Providing Data

```typescript
// Get the data exchange
const dataExchange = agent.getDataExchange();

// Register a data provider
dataExchange.registerDataProvider('user-profile', async (parameters) => {
  const { userId } = parameters;
  
  console.log(`Providing profile for user ${userId}`);
  
  // Fetch user profile
  // ...
  
  return {
    userId,
    name: 'John Doe',
    email: 'john.doe@example.com',
    preferences: {
      theme: 'dark',
      language: 'en'
    }
  };
});

// Register a stream provider for large data sets
dataExchange.registerStreamProvider('document-content', async (parameters, requestId, onChunk) => {
  const { documentId } = parameters;
  
  console.log(`Streaming content for document ${documentId}`);
  
  // Stream the data in chunks
  const chunks = getDocumentChunks(documentId);
  for (let i = 0; i < chunks.length; i++) {
    await onChunk(chunks[i], i);
  }
});
```

### Requesting Data

```typescript
// Request data from another agent
try {
  const userProfile = await dataExchange.requestData('user-profile', {
    userId: 'user-123'
  }, {
    timeout: 5000
  });
  
  console.log('User profile:', userProfile);
} catch (error) {
  console.error('Failed to fetch user profile:', error);
}

// Request a data stream
try {
  await dataExchange.requestStream(
    'document-content',
    { documentId: 'doc-456' },
    async (chunk, index, isLast) => {
      console.log(`Received chunk ${index}${isLast ? ' (last)' : ''}`);
      // Process the chunk
      processDocumentChunk(chunk);
      
      if (isLast) {
        console.log('Document streaming complete');
      }
    },
    { timeout: 60000 }
  );
} catch (error) {
  console.error('Failed to stream document:', error);
}
```

## Storage Operations

Storage operations enable your agent to store and retrieve data in a distributed key-value store.

### Storing Values

```typescript
// Get the storage manager
const storageManager = agent.getStorageManager();

// Store a value
await storageManager.setValue(
  'user-preferences',
  {
    theme: 'dark',
    fontSize: 14,
    language: 'en'
  },
  {
    namespace: 'settings',
    ttl: 3600000, // 1 hour
    metadata: {
      userId: 'user-123',
      lastModified: new Date().toISOString()
    }
  }
);

console.log('User preferences stored');
```

### Retrieving Values

```typescript
// Get a value
const preferences = await storageManager.getValue('user-preferences', {
  namespace: 'settings'
});

console.log('User preferences:', preferences);

// Get a specific version
const oldState = await storageManager.getValue('shared-state', {
  namespace: 'state',
  version: 2 // Get version 2
});

console.log('Old state (version 2):', oldState);
```

### Deleting Values

```typescript
// Delete a value
const deleted = await storageManager.deleteValue('temp-data', {
  namespace: 'cache'
});

console.log('Value deleted:', deleted);
```

## Error Handling

Proper error handling is essential for a robust messaging system.

### Handling Connection Errors

```typescript
try {
  await natsClient.connect(config);
  console.log('Connected to NATS server');
} catch (error) {
  console.error('Failed to connect to NATS server:', error);
  // Implement retry logic or fallback mechanism
}

// Listen for connection events
natsClient.on('connect', () => {
  console.log('Connected to NATS server');
});

natsClient.on('disconnect', () => {
  console.log('Disconnected from NATS server');
});

natsClient.on('error', (error) => {
  console.error('NATS client error:', error);
});

natsClient.on('reconnect', () => {
  console.log('Reconnected to NATS server');
});
```

### Handling Task Errors

```typescript
// Register a task handler with error handling
taskManager.registerTaskHandler('process-document', async (task) => {
  try {
    const { documentId, format } = task.parameters;
    
    console.log(`Processing document ${documentId} in ${format} format`);
    
    // Process the document
    // ...
    
    return {
      success: true,
      extractedText: 'Document content...'
    };
  } catch (error) {
    console.error(`Error processing document: ${error.message}`);
    
    // Fail the task with error details
    throw {
      code: 'DOCUMENT_PROCESSING_ERROR',
      message: error.message,
      details: {
        documentId: task.parameters.documentId,
        error: error.toString()
      },
      retryable: true
    };
  }
});

// Handle task failure events
taskManager.on('taskFailed', (taskId, payload) => {
  console.error(`Task ${taskId} failed:`, payload.error);
  
  // Implement recovery or notification logic
  if (payload.error.retryable) {
    console.log(`Task ${taskId} is retryable, scheduling retry...`);
    // Schedule retry
  } else {
    console.log(`Task ${taskId} failed permanently, notifying user...`);
    // Notify user
  }
});
```

### Handling Data Exchange Errors

```typescript
// Register a data provider with error handling
dataExchange.registerDataProvider('user-profile', async (parameters) => {
  try {
    const { userId } = parameters;
    
    // Fetch user profile
    // ...
    
    return {
      userId,
      name: 'John Doe',
      email: 'john.doe@example.com'
    };
  } catch (error) {
    console.error(`Error providing user profile: ${error.message}`);
    
    // Throw a structured error
    throw {
      code: 'USER_PROFILE_ERROR',
      message: `Failed to retrieve profile for user ${parameters.userId}`,
      details: {
        userId: parameters.userId,
        error: error.toString()
      }
    };
  }
});

// Handle data request errors
try {
  const userProfile = await dataExchange.requestData('user-profile', {
    userId: 'user-123'
  });
  
  console.log('User profile:', userProfile);
} catch (error) {
  console.error('Failed to fetch user profile:', error);
  
  // Implement fallback or retry logic
  if (error.code === 'USER_PROFILE_ERROR') {
    console.log('Using cached profile...');
    // Use cached profile
  } else if (error.code === 'REQUEST_TIMEOUT') {
    console.log('Request timed out, retrying...');
    // Retry the request
  }
}
```

## Testing

Testing is crucial for ensuring the reliability of your messaging integration.

### Unit Testing

```typescript
import { expect } from 'chai';
import { mock, instance, when, verify } from 'ts-mockito';
import { TaskManager, TaskStatus } from '../core/messaging';

describe('DocumentProcessorAgent', () => {
  let agent: DocumentProcessorAgent;
  let mockTaskManager: TaskManager;
  
  beforeEach(() => {
    // Create mocks
    mockTaskManager = mock(TaskManager);
    
    // Create agent with mocked dependencies
    agent = new DocumentProcessorAgent();
    agent['taskManager'] = instance(mockTaskManager);
  });
  
  describe('processDocument', () => {
    it('should process a document and return results', async () => {
      // Arrange
      const taskId = 'task-123';
      const task = {
        taskId,
        taskType: 'process-document',
        parameters: {
          documentId: 'doc-123',
          format: 'pdf'
        }
      };
      
      // Setup mock behavior
      when(mockTaskManager.updateTask(taskId, TaskStatus.IN_PROGRESS, expect.anything()))
        .thenResolve();
      
      // Act
      const result = await agent.processDocument(task);
      
      // Assert
      expect(result).to.have.property('success', true);
      expect(result).to.have.property('extractedText');
      
      // Verify interactions
      verify(mockTaskManager.updateTask(taskId, TaskStatus.IN_PROGRESS, expect.anything()))
        .once();
    });
  });
});
```

### Integration Testing

```typescript
import { expect } from 'chai';
import { natsClient, TaskManager, ServiceManager } from '../core/messaging';

describe('A2A Messaging Integration', () => {
  let serviceManager1: ServiceManager;
  let taskManager1: TaskManager;
  let serviceManager2: ServiceManager;
  let taskManager2: TaskManager;
  
  before(async () => {
    // Connect to NATS
    await natsClient.connect({
      servers: 'nats://localhost:4222',
      name: 'test-client'
    });
    
    // Create service managers
    serviceManager1 = new ServiceManager({
      serviceType: 'test-service-1',
      capabilities: ['test-capability-1']
    });
    
    serviceManager2 = new ServiceManager({
      serviceType: 'test-service-2',
      capabilities: ['test-capability-2']
    });
    
    // Create task managers
    taskManager1 = new TaskManager({
      serviceId: serviceManager1.getServiceId(),
      capabilities: ['test-capability-1']
    });
    
    taskManager2 = new TaskManager({
      serviceId: serviceManager2.getServiceId(),
      capabilities: ['test-capability-2']
    });
    
    // Initialize components
    await serviceManager1.initialize();
    await taskManager1.initialize();
    await serviceManager2.initialize();
    await taskManager2.initialize();
  });
  
  after(async () => {
    // Shutdown components
    await taskManager2.shutdown();
    await serviceManager2.shutdown();
    await taskManager1.shutdown();
    await serviceManager1.shutdown();
    
    // Disconnect from NATS
    await natsClient.disconnect();
  });
  
  it('should discover services', async () => {
    // Wait for service discovery
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify service discovery
    const services1 = serviceManager1.findServicesByType('test-service-2');
    const services2 = serviceManager2.findServicesByType('test-service-1');
    
    expect(services1).to.have.lengthOf(1);
    expect(services2).to.have.lengthOf(1);
  });
  
  it('should create and handle tasks', async () => {
    // Register task handler
    taskManager2.registerTaskHandler('test-task', async (task) => {
      return {
        success: true,
        message: 'Task completed'
      };
    });
    
    // Create a task
    const taskId = await taskManager1.createTask(
      'test-task',
      {
        testParam: 'test-value'
      },
      {
        assignTo: serviceManager2.getServiceId()
      }
    );
    
    // Wait for task completion
    const result = await new Promise((resolve) => {
      taskManager1.on('taskCompleted', (completedTaskId, payload) => {
        if (completedTaskId === taskId) {
          resolve(payload.result);
        }
      });
    });
    
    // Verify result
    expect(result).to.have.property('success', true);
    expect(result).to.have.property('message', 'Task completed');
  });
});
```

## Advanced Patterns

### Publish/Subscribe Pattern

```typescript
// Subscribe to a topic
const subscriptionId = await natsClient.subscribe('events.user-activity', (message) => {
  console.log('Received user activity:', message);
  // Process the message
});

// Publish to a topic
await natsClient.publish('events.user-activity', {
  userId: 'user-123',
  action: 'login',
  timestamp: new Date().toISOString()
});

// Unsubscribe when done
await natsClient.unsubscribe(subscriptionId);
```

### Request/Reply Pattern

```typescript
// Handle requests
const subscriptionId = await natsClient.subscribe('services.user-service.get-profile', async (message, replyTo) => {
  const { userId } = message;
  
  // Fetch user profile
  const profile = await fetchUserProfile(userId);
  
  // Reply with the profile
  if (replyTo) {
    await natsClient.publish(replyTo, profile);
  }
});

// Send a request and wait for a response
const response = await natsClient.request('services.user-service.get-profile', {
  userId: 'user-123'
}, {
  timeout: 5000
});

console.log('User profile:', response);
```

### Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private readonly failureThreshold: number = 3,
    private readonly resetTimeout: number = 30000
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      // Check if reset timeout has elapsed
      const now = Date.now();
      if (now - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await fn();
      
      // Reset on success if half-open
      if (this.state === 'HALF_OPEN') {
        this.reset();
      }
      
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
  
  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
  
  private reset(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }
}

// Usage
const circuitBreaker = new CircuitBreaker();

try {
  const result = await circuitBreaker.execute(async () => {
    return await dataExchange.requestData('user-profile', {
      userId: 'user-123'
    });
  });
  
  console.log('User profile:', result);
} catch (error) {
  console.error('Failed to fetch user profile:', error);
}
```

### Retry Pattern

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
    backoffFactor: number;
  }
): Promise<T> {
  let retries = 0;
  let delay = options.initialDelay;
  
  while (true) {
    try {
      return await fn();
    } catch (error) {
      retries++;
      
      if (retries > options.maxRetries) {
        throw error;
      }
      
      console.log(`Retry ${retries}/${options.maxRetries} after ${delay}ms`);
      
      // Wait for the delay
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Increase delay with exponential backoff
      delay = Math.min(delay * options.backoffFactor, options.maxDelay);
    }
  }
}

// Usage
try {
  const result = await withRetry(
    async () => {
      return await dataExchange.requestData('user-profile', {
        userId: 'user-123'
      });
    },
    {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffFactor: 2
    }
  );
  
  console.log('User profile:', result);
} catch (error) {
  console.error('Failed to fetch user profile after retries:', error);
}
```

## Troubleshooting

### Common Issues and Solutions

1. **Connection Issues**

   **Symptoms**: Unable to connect to NATS server, connection timeouts

   **Solutions**:
   - Verify NATS server is running: `nats-server -a localhost -p 4222`
   - Check network connectivity: `telnet localhost 4222`
   - Verify connection settings: servers, timeout, etc.
   - Check for firewall or network restrictions

2. **Message Delivery Issues**

   **Symptoms**: Messages not being received, timeouts on requests

   **Solutions**:
   - Verify subject names match exactly
   - Check if subscribers are connected and subscribed
   - Increase request timeout for slow operations
   - Verify message format and payload

3. **Task Execution Issues**

   **Symptoms**: Tasks not being executed, stuck in PENDING state

   **Solutions**:
   - Verify task handlers are registered for the task type
   - Check if the assigned service is online
   - Verify the service has the required capabilities
   - Check for errors in task handler implementation

4. **Data Exchange Issues**

   **Symptoms**: Data requests failing, timeouts

   **Solutions**:
   - Verify data providers are registered for the data type
   - Check if the provider service is online
   - Increase request timeout for large data
   - Use streaming for large data sets

5. **Storage Issues**

   **Symptoms**: Unable to store or retrieve values

   **Solutions**:
   - Verify namespace and key names
   - Check if storage service is online
   - Verify persistence adapter is configured correctly
   - Check for storage capacity issues

### Debugging Techniques

1. **Enable Debug Logging**

   ```typescript
   await natsClient.connect({
     debug: true
   });
   ```

2. **Monitor NATS Traffic**

   Use the NATS CLI to monitor message traffic:

   ```bash
   nats sub ">"
   ```

3. **Check Service Status**

   ```typescript
   // Get all services
   const services = serviceManager.getAllServices();
   console.log('Services:', services);
   
   // Check specific service
   const service = serviceManager.getService(serviceId);
   console.log('Service status:', service?.status);
   ```

4. **Check Task Status**

   ```typescript
   // Get all tasks
   const tasks = taskManager.getAllTasks();
   console.log('Tasks:', tasks);
   
   // Check specific task
   const task = taskManager.getTask(taskId);
   console.log('Task status:', task?.status);
   ```

5. **Monitor Events**

   ```typescript
   // Monitor all events
   serviceManager.on('*', (event, ...args) => {
     console.log(`Service event: ${event}`, args);
   });
   
   taskManager.on('*', (event, ...args) => {
     console.log(`Task event: ${event}`, args);
   });
   
   storageManager.on('*', (event, ...args) => {
     console.log(`Storage event: ${event}`, args);
   });
   
   dataExchange.on('*', (event, ...args) => {
     console.log(`Data event: ${event}`, args);
   });
   ```

### Getting Help

If you encounter issues that you cannot resolve:

1. Check the A2A Messaging System documentation
2. Review the NATS documentation at <https://docs.nats.io/>
3. Consult with the Vespera-Scriptorium development team
4. File an issue in the project repository with detailed information about the problem

## Conclusion

This integration guide provides a comprehensive overview of how to integrate and use the A2A Messaging System
in your Vespera-Scriptorium plugin components. By following these patterns and best practices, you can build
robust, scalable, and maintainable agent-to-agent communication.

For more detailed information about each component, refer to the component-specific documentation:

- [NATS Client](./nats-client/README.md)
- [Service Manager](./service-manager/README.md)
- [Task Manager](./task-manager/README.md)
- [Storage Manager](./storage-manager/README.md)
- [Data Exchange](./data-exchange/README.md)
- [Message Types](./message-types/README.md)


## Monitoring Integration

**Last Updated:** 2025-05-26

The A2A messaging system includes comprehensive monitoring capabilities to track performance, health, and operational metrics. This section covers how to integrate monitoring features into your agents.

### Monitoring Components Overview

The monitoring system consists of four main components:

1. **Circuit Breaker**: Prevents cascading failures
2. **Metrics Collector**: Tracks performance metrics
3. **Health Monitor**: Monitors component health
4. **Alert Manager**: Manages alerts and notifications

### Enabling Monitoring

Import and initialize monitoring components:

```typescript
import { 
  circuitBreakerRegistry,
  metricsCollector, 
  healthMonitor, 
  alertManager,
  MetricType,
  HealthStatus,
  ComponentType,
  AlertSeverity,
  AlertTriggerType,
  AlertOperator
} from '../core/messaging';

// Enable monitoring
metricsCollector.startTimers();
healthMonitor.startReporting();
alertManager.startChecking();
```

### Circuit Breaker Integration

Protect critical operations with circuit breakers:

```typescript
// Get or create a circuit breaker for external API calls
const apiCircuit = circuitBreakerRegistry.getOrCreate('external-api', {
  failureThreshold: 5,
  resetTimeout: 30000,
  halfOpenSuccessThreshold: 3
});

// Protect an operation
async function callExternalAPI(data: any): Promise<any> {
  return await apiCircuit.execute(async () => {
    const response = await fetch('https://external-api.com/endpoint', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`API call failed: ${response.status}`);
    }
    
    return await response.json();
  });
}

// Monitor circuit state changes
apiCircuit.on('stateChanged', (from, to, circuitId) => {
  console.log(`Circuit ${circuitId} changed from ${from} to ${to}`);
});
```

### Metrics Collection Integration

Track custom metrics in your agent:

```typescript
class DocumentProcessorAgent extends BaseAgent {
  async processDocument(task: any): Promise<any> {
    const startTime = Date.now();
    
    try {
      // Record that document processing started
      metricsCollector.recordCustomMetric('document.processing.started', 1, {
        documentType: task.parameters.format,
        agent: this.getServiceId()
      });
      
      // Process the document
      const result = await this.performDocumentProcessing(task);
      
      // Record success metrics
      const processingTime = Date.now() - startTime;
      metricsCollector.recordCustomMetric('document.processing.completed', 1, {
        documentType: task.parameters.format,
        agent: this.getServiceId()
      });
      metricsCollector.recordCustomMetric('document.processing.time', processingTime, {
        documentType: task.parameters.format
      });
      
      return result;
    } catch (error) {
      // Record failure metrics
      metricsCollector.recordCustomMetric('document.processing.failed', 1, {
        documentType: task.parameters.format,
        errorType: error.name,
        agent: this.getServiceId()
      });
      
      throw error;
    }
  }
  
  // Override message handling to record metrics
  async handleMessage(message: Message): Promise<void> {
    // Record message received
    metricsCollector.recordMessageReceived(message);
    
    try {
      await super.handleMessage(message);
    } catch (error) {
      // Record message processing failure
      metricsCollector.recordMessageFailed(message, error);
      throw error;
    }
  }
}
```

### Health Monitoring Integration

Register components for health monitoring:

```typescript
class DocumentProcessorAgent extends BaseAgent {
  async initialize(): Promise<void> {
    await super.initialize();
    
    // Register this agent for health monitoring
    healthMonitor.registerComponent({
      componentId: this.getServiceId(),
      componentType: ComponentType.CUSTOM,
      checkFn: this.createHealthCheck(),
      interval: 30000,    // Check every 30 seconds
      timeout: 5000,      // 5 second timeout
      retryCount: 3,      // Retry 3 times
      retryDelay: 1000    // 1 second between retries
    });
    
    // Register NATS client health check
    healthMonitor.registerComponent({
      componentId: 'nats-client',
      componentType: ComponentType.NATS_CLIENT,
      checkFn: HealthMonitor.createNatsHealthCheck(natsClient),
      interval: 30000,
      timeout: 5000,
      retryCount: 3,
      retryDelay: 1000
    });
  }
  
  private createHealthCheck() {
    return async () => {
      try {
        // Check if the agent is functioning properly
        const isConnected = natsClient.isConnected();
        const canProcessDocuments = await this.testDocumentProcessing();
        
        if (!isConnected) {
          return {
            componentId: this.getServiceId(),
            componentType: ComponentType.CUSTOM,
            status: HealthStatus.UNHEALTHY,
            lastChecked: Date.now(),
            message: 'NATS client not connected'
          };
        }
        
        if (!canProcessDocuments) {
          return {
            componentId: this.getServiceId(),
            componentType: ComponentType.CUSTOM,
            status: HealthStatus.DEGRADED,
            lastChecked: Date.now(),
            message: 'Document processing capabilities degraded'
          };
        }
        
        return {
          componentId: this.getServiceId(),
          componentType: ComponentType.CUSTOM,
          status: HealthStatus.HEALTHY,
          lastChecked: Date.now(),
          message: 'Agent is healthy'
        };
      } catch (error) {
        return {
          componentId: this.getServiceId(),
          componentType: ComponentType.CUSTOM,
          status: HealthStatus.UNHEALTHY,
          lastChecked: Date.now(),
          message: `Health check failed: ${error.message}`
        };
      }
    };
  }
  
  private async testDocumentProcessing(): Promise<boolean> {
    try {
      // Perform a lightweight test of document processing capabilities
      // Return true if successful, false if degraded
      return true;
    } catch (error) {
      return false;
    }
  }
}
```

### Alert Management Integration

Set up alerts for your agent:

```typescript
class DocumentProcessorAgent extends BaseAgent {
  async initialize(): Promise<void> {
    await super.initialize();
    
    // Set up alerts
    this.setupAlerts();
  }
  
  private setupAlerts(): void {
    // High failure rate alert
    alertManager.addAlertDefinition({
      id: 'document-processing-high-failure-rate',
      name: 'High Document Processing Failure Rate',
      description: 'Document processing failure rate is too high',
      severity: AlertSeverity.ERROR,
      triggerType: AlertTriggerType.ERROR_RATE,
      condition: {
        operator: AlertOperator.GREATER_THAN,
        threshold: 10.0, // 10% failure rate
        metricTags: { agent: this.getServiceId() }
      },
      notificationChannels: ['console', 'nats'],
      enabled: true,
      autoResolve: true,
      autoResolveAfter: 300000 // 5 minutes
    });
    
    // High processing time alert
    alertManager.addAlertDefinition({
      id: 'document-processing-high-latency',
      name: 'High Document Processing Latency',
      description: 'Document processing is taking too long',
      severity: AlertSeverity.WARNING,
      triggerType: AlertTriggerType.CUSTOM,
      condition: {
        operator: AlertOperator.GREATER_THAN,
        customEvaluator: (data) => {
          const processingTimeMetric = data.metrics['custom.document.processing.time'];
          return processingTimeMetric && processingTimeMetric.avg > 30000; // 30 seconds
        }
      },
      notificationChannels: ['console'],
      enabled: true
    });
    
    // Agent health alert
    alertManager.addAlertDefinition({
      id: 'document-processor-unhealthy',
      name: 'Document Processor Unhealthy',
      description: 'Document processor agent is unhealthy',
      severity: AlertSeverity.CRITICAL,
      triggerType: AlertTriggerType.HEALTH_STATUS,
      condition: {
        operator: AlertOperator.EQUALS,
        healthStatus: HealthStatus.UNHEALTHY,
        componentId: this.getServiceId()
      },
      notificationChannels: ['console', 'nats'],
      enabled: true
    });
    
    // Handle alert events
    alertManager.on('alertTriggered', (alert) => {
      console.log(`🚨 Alert triggered: ${alert.name}`);
      
      // Implement custom alert handling
      this.handleAlert(alert);
    });
  }
  
  private handleAlert(alert: any): void {
    // Implement custom alert handling logic
    switch (alert.definitionId) {
      case 'document-processing-high-failure-rate':
        // Maybe reduce processing load or restart components
        console.log('High failure rate detected, implementing mitigation...');
        break;
      case 'document-processing-high-latency':
        // Maybe optimize processing or scale up
        console.log('High latency detected, optimizing processing...');
        break;
      case 'document-processor-unhealthy':
        // Maybe restart the agent or switch to fallback mode
        console.log('Agent unhealthy, implementing recovery...');
        break;
    }
  }
}
```

### Performance Best Practices

1. **Batch Metric Recording**: For high-frequency operations, consider batching metrics:

```typescript
class MetricsBatcher {
  private pending: Array<{type: string, value: number, tags?: Record<string, string>}> = [];
  private timer: NodeJS.Timeout | null = null;

  recordMetric(type: string, value: number, tags?: Record<string, string>): void {
    this.pending.push({ type, value, tags });
    
    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.flush();
      }, 100); // Batch for 100ms
    }
  }

  private flush(): void {
    for (const metric of this.pending) {
      metricsCollector.recordMetric(metric.type, metric.value, metric.tags);
    }
    this.pending = [];
    this.timer = null;
  }
}
```

2. **Conditional Monitoring**: Enable/disable monitoring based on environment:

```typescript
const isProduction = process.env.NODE_ENV === 'production';
const monitoringConfig = {
  metricsEnabled: isProduction,
  healthCheckInterval: isProduction ? 30000 : 60000,
  alertsEnabled: isProduction
};

if (monitoringConfig.metricsEnabled) {
  metricsCollector.startTimers();
}

if (monitoringConfig.alertsEnabled) {
  alertManager.startChecking();
}
```

3. **Resource Cleanup**: Always clean up monitoring resources:

```typescript
class DocumentProcessorAgent extends BaseAgent {
  async shutdown(): Promise<void> {
    // Stop monitoring
    metricsCollector.stopTimers();
    healthMonitor.stopReporting();
    alertManager.stopChecking();
    
    // Unregister components
    healthMonitor.unregisterComponent(this.getServiceId());
    healthMonitor.unregisterComponent('nats-client');
    
    await super.shutdown();
  }
}
```

### Monitoring Dashboard

Get monitoring snapshots for dashboards or reporting:

```typescript
async function getMonitoringSnapshot() {
  const metrics = metricsCollector.getMetricsSnapshot();
  const health = healthMonitor.getSystemHealthStatus();
  const alerts = alertManager.getAllAlerts();
  
  return {
    timestamp: Date.now(),
    metrics: {
      messagesSent: metrics.metrics[MetricType.MESSAGES_SENT]?.count || 0,
      messagesReceived: metrics.metrics[MetricType.MESSAGES_RECEIVED]?.count || 0,
      messagesFailed: metrics.metrics[MetricType.MESSAGES_FAILED]?.count || 0,
      averageLatency: metricsCollector.getAverageLatency(),
      throughput: metricsCollector.getThroughput()
    },
    health: {
      overallStatus: health.overallStatus,
      healthyComponents: Object.keys(health.components).length - 
                       health.degradedComponents.length - 
                       health.unhealthyComponents.length,
      degradedComponents: health.degradedComponents.length,
      unhealthyComponents: health.unhealthyComponents.length
    },
    alerts: {
      active: alerts.filter(a => a.status === 'ACTIVE').length,
      total: alerts.length
    }
  };
}
```

This monitoring integration provides comprehensive observability into your A2A messaging system, enabling you to track performance, detect issues early, and maintain system reliability.

