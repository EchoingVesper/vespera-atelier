# Data Exchange

**Last Updated:** 2025-05-25

## Overview

The Data Exchange component facilitates data sharing between agents in the A2A communication layer. It provides request/response patterns for data exchange and supports streaming for large data transfers with chunking capabilities.

## Features

- **Data Requests**: Request data from other agents
- **Data Providers**: Register handlers for providing data
- **Streaming Support**: Stream large data sets with chunking
- **Type Safety**: TypeScript interfaces for data handling
- **Error Handling**: Comprehensive error handling with timeouts
- **Event-Based Notifications**: Event emitter for data exchange events

## Usage

### Initialization

```typescript
import { DataExchange, ServiceManager } from '../core/messaging';

// Create a data exchange
const dataExchange = new DataExchange({
  serviceId: serviceManager.getServiceId(), // Use the service ID from the Service Manager
  capabilities: ['data-provider', 'document-analysis'],
  maxConcurrentRequests: 10,
  requestTimeout: 30000, // 30 seconds
  streamChunkSize: 64 * 1024 // 64KB
});

// Initialize the data exchange
await dataExchange.initialize();
```

### Data Providers

```typescript
// Register a data provider
dataExchange.registerDataProvider('user-profile', async (parameters, requestId) => {
  const { userId } = parameters;
  
  // Fetch user profile
  console.log(`Fetching profile for user ${userId}`);
  
  // Return the data
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
  
  // Fetch document content
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

### Event Handling

```typescript
// Listen for data exchange events
dataExchange.on('dataRequested', (requestId, dataType) => {
  console.log(`Data requested: ${dataType} (${requestId})`);
});

dataExchange.on('dataResponded', (requestId, data) => {
  console.log(`Data response received: ${requestId}`);
});

dataExchange.on('streamStarted', (requestId, dataType) => {
  console.log(`Stream started: ${dataType} (${requestId})`);
});

dataExchange.on('streamChunkReceived', (requestId, chunkIndex, isLast) => {
  console.log(`Stream chunk received: ${requestId} (${chunkIndex}${isLast ? ', last' : ''})`);
});

dataExchange.on('streamEnded', (requestId, success) => {
  console.log(`Stream ended: ${requestId} (${success ? 'success' : 'failure'})`);
});
```

### Cleanup

```typescript
// Shutdown the data exchange
await dataExchange.shutdown();
```

## API Reference

### `DataExchange`

The main class for data exchange operations.

#### Constructor

```typescript
constructor(options: DataExchangeOptions)
```

- `options`: Configuration options for the data exchange
  - `serviceId`: ID of the service running this data exchange
  - `capabilities`: Array of capabilities this service provides
  - `maxConcurrentRequests`: Maximum number of concurrent requests
  - `requestTimeout`: Default timeout for requests in milliseconds
  - `streamChunkSize`: Default chunk size for streaming in bytes
  - `natsClient`: Optional NATS client instance

#### Methods

- `initialize(): Promise<void>` - Initialize the data exchange
- `shutdown(): Promise<void>` - Shutdown the data exchange
- `registerDataProvider<T, P>(dataType: string, handler: DataProviderHandler<T, P>): void` - Register a data provider
- `registerStreamProvider<T, P>(dataType: string, handler: StreamProviderHandler<T, P>): void` - Register a stream provider
- `requestData<T, P>(dataType: string, parameters: P, options?: RequestOptions): Promise<T>` - Request data from another agent
- `requestStream<T, P>(dataType: string, parameters: P, onChunk: (chunk: T, index: number, isLast: boolean) => Promise<void>, options?: RequestOptions): Promise<void>` - Request a data stream

#### Events

- `dataRequested` - Emitted when data is requested
- `dataResponded` - Emitted when data is responded
- `streamStarted` - Emitted when a stream starts
- `streamChunkReceived` - Emitted when a stream chunk is received
- `streamEnded` - Emitted when a stream ends
- `error` - Emitted when an error occurs

## Data Provider Handlers

```typescript
// Data provider handler
export interface DataProviderHandler<T = unknown, P = unknown> {
  (parameters: P, requestId: string): Promise<T>;
}

// Stream provider handler
export interface StreamProviderHandler<T = unknown, P = unknown> {
  (parameters: P, requestId: string, onChunk: (chunk: T, index: number) => Promise<void>): Promise<void>;
}
```

## Stream Information

The data exchange maintains information about each stream:

```typescript
export interface StreamInfo {
  requestId: string;
  dataType: string;
  totalChunks?: number;
  totalSize?: number;
  format?: string;
  compression?: string;
  chunks: Map<number, unknown>;
  startTime: string;
  endTime?: string;
  complete: boolean;
  error?: ErrorPayload;
}
```

## Best Practices

1. **Data Types**: Use specific, descriptive data types
2. **Parameters**: Include all necessary parameters for data requests
3. **Timeouts**: Set appropriate timeouts based on data size and complexity
4. **Chunking**: Use appropriate chunk sizes for streaming large data
5. **Error Handling**: Handle data request errors gracefully
6. **Type Safety**: Use TypeScript generics for type-safe data handling
7. **Correlation IDs**: Use correlation IDs for tracking related requests
8. **Streaming**: Use streaming for large data transfers to avoid memory issues

## Implementation Details

The Data Exchange uses NATS publish/subscribe for data requests and responses. It supports both simple request/response patterns and streaming for large data sets with chunking. It provides type-safe interfaces for data providers and consumers.

### Key Files

- `src/core/messaging/dataExchange.ts` - Main implementation
- `tests/unit/messaging/dataExchange.test.ts` - Unit tests
- `tests/integration/messaging/messageFlow.test.ts` - Integration tests
