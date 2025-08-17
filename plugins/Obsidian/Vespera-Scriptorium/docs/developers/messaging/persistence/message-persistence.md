# Message Persistence System

The message persistence system ensures reliable message delivery by handling message storage, retry logic, and recovery
mechanisms for the A2A messaging infrastructure.

## Overview

The MessagePersistence class provides robust message handling with:

- Durable message storage
- Configurable retry policies
- Dead letter handling
- Message recovery
- Transaction support

## Usage Example

```typescript
import { messagePersistence, RetryPolicy } from '../core/messaging/messagePersistence';

// Configure persistence
messagePersistence.setRetryPolicy(RetryPolicy.EXPONENTIAL_BACKOFF);
messagePersistence.setMaxRetries(5);
messagePersistence.setStoragePath('./message-store');

// Store a message for retry
await messagePersistence.storeForRetry({
  id: 'msg-123',
  type: MessageType.TASK_CREATE,
  payload: { taskId: 'task-456', parameters: { /* ... */ } },
  subject: 'task.create',
  timestamp: new Date().toISOString(),
  sender: 'agent-1',
  recipient: 'task-manager'
});

// Process retry queue
await messagePersistence.processRetryQueue();

// Check if a message exists
const exists = await messagePersistence.messageExists('msg-123');

// Important: Access connection status as a property, not a method
if (messagePersistence.isConnected) {
  // Perform operations that require connection
  await messagePersistence.synchronizeStorage();
}
```

## Events

- `messageStored`: When a message is stored
- `messageRetried`: When a message retry is attempted
- `messageDeadLettered`: When a message is moved to dead letter queue
- `retryQueueProcessed`: When the retry queue is processed

## Implementation Notes

1. The `isConnected` property is a boolean property, not a method. Always access it as:

   ```typescript
   if (messagePersistence.isConnected) {
     // Connected
   }
   ```

   Not as:

   ```typescript
   // INCORRECT - will cause TypeScript errors
   if (messagePersistence.isConnected()) {
     // This will not work
   }
   ```

2. When working with message timestamps, ensure they are properly formatted as ISO strings:

   ```typescript
   // Correct
   const message = {
     timestamp: new Date().toISOString(),
     // other properties...
   };
   
   // INCORRECT - will cause type errors
   const message = {
     timestamp: new Date(), // Should be converted to ISO string
     // other properties...
   };
   ```

**Last Updated**: 2025-05-27
