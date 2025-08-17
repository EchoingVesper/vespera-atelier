# NATS Client

**Last Updated:** 2025-05-25

## Overview

The NATS client provides the core messaging functionality for the A2A communication layer. It handles connection management, message publishing, subscription handling, and request/reply patterns.

## Features

- **Publish/Subscribe**: Send and receive messages using topics
- **Request/Reply**: Synchronous request/response pattern
- **Connection Management**: Automatic reconnection with exponential backoff
- **Type Safety**: TypeScript interfaces for message handling
- **Error Handling**: Comprehensive error handling and logging

## Usage

### Initialization

```typescript
import { natsClient } from '../core/messaging';

// Connect to NATS server
await natsClient.connect({
  servers: 'nats://localhost:4222',
  name: 'my-service',
  timeout: 5000,
  maxReconnectAttempts: 10,
  pingInterval: 30000,
  debug: true
});
```

### Publishing Messages

```typescript
import { MessageType, Message } from '../core/messaging';

// Create a message
const message: Message<{ data: string }> = {
  type: MessageType.DATA_REQUEST,
  headers: {
    correlationId: 'corr-123',
    messageId: 'msg-456',
    timestamp: new Date().toISOString(),
    source: 'my-service'
  },
  payload: {
    data: 'Hello, world!'
  }
};

// Publish the message
await natsClient.publish('my.topic', message);
```

### Subscribing to Messages

```typescript
// Subscribe to a topic
const subscriptionId = await natsClient.subscribe('my.topic', async (message) => {
  console.log('Received message:', message);
  // Process the message
});

// Unsubscribe when done
await natsClient.unsubscribe(subscriptionId);
```

### Request/Reply Pattern

```typescript
// Send a request and wait for a response
const response = await natsClient.request('service.request', message, {
  timeout: 5000
});

console.log('Received response:', response);
```

### Cleanup

```typescript
// Disconnect from NATS
await natsClient.disconnect();
```

## API Reference

### `NatsClient`

The main class for interacting with the NATS server.

#### Constructor

```typescript
constructor(options: NatsClientOptions)
```

- `options`: Configuration options for the NATS client
  - `servers`: NATS server URL(s)
  - `name`: Client name
  - `timeout`: Connection timeout in milliseconds
  - `maxReconnectAttempts`: Maximum number of reconnection attempts
  - `pingInterval`: Ping interval in milliseconds
  - `debug`: Enable debug logging

#### Methods

- `connect(options?: Partial<NatsClientOptions>): Promise<void>` - Connect to the NATS server
- `disconnect(): Promise<void>` - Disconnect from the NATS server
- `isConnected(): boolean` - Check if connected to the NATS server
- `publish(subject: string, message: unknown): Promise<void>` - Publish a message to a subject
- `subscribe(subject: string, callback: MessageCallback): Promise<string>` - Subscribe to a subject
- `unsubscribe(subscriptionId: string): Promise<void>` - Unsubscribe from a subject
- `request(subject: string, message: unknown, options?: RequestOptions): Promise<unknown>` - Send a request and wait for a response

## Error Handling

The NATS client includes comprehensive error handling for connection issues, message publishing failures, and subscription errors:

```typescript
try {
  await natsClient.publish('my.topic', message);
} catch (error) {
  console.error('Failed to publish message:', error);
  // Handle the error
}
```

## Best Practices

1. **Connection Management**: Always check if connected before publishing messages
2. **Error Handling**: Use try/catch blocks for all NATS operations
3. **Cleanup**: Always disconnect when done to release resources
4. **Timeouts**: Set appropriate timeouts for requests
5. **Subject Naming**: Use hierarchical subject names (e.g., `service.operation.entity`)
6. **Message Validation**: Validate messages before publishing

## Implementation Details

The NATS client is implemented using the official NATS.js client library and provides a simplified interface for the A2A communication layer. It handles connection management, reconnection, and message serialization/deserialization.

### Key Files

- `src/core/messaging/natsClient.ts` - Main implementation
- `tests/unit/messaging/natsClient.test.ts` - Unit tests
