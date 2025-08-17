# Storage Manager

**Last Updated:** 2025-05-25

## Overview

The Storage Manager provides distributed key-value storage operations for the A2A communication layer. It enables agents to store, retrieve, and share data across the distributed system with support for namespaces, versioning, and time-to-live (TTL) settings.

## Features

- **Distributed Storage**: Store and retrieve data across distributed agents
- **Namespaces**: Organize data in logical namespaces
- **Versioning**: Track and retrieve specific versions of stored values
- **TTL Support**: Set expiration times for cached values
- **Request/Response**: Request values from other agents when not in local cache
- **Event-Based Notifications**: Event emitter for storage operations

## Usage

### Initialization

```typescript
import { StorageManager, ServiceManager } from '../core/messaging';

// Create a storage manager
const storageManager = new StorageManager({
  serviceId: serviceManager.getServiceId(), // Use the service ID from the Service Manager
  persistenceEnabled: true,
  cacheTTL: 300000, // 5 minutes
  maxCacheSize: 50 * 1024 * 1024 // 50MB
});

// Initialize the storage manager
await storageManager.initialize();
```

### Storing Values

```typescript
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
    },
    overwrite: true // Overwrite if exists
  }
);

// Store a value only if it doesn't exist
try {
  await storageManager.setValue(
    'document-cache',
    documentData,
    {
      namespace: 'cache',
      ifNotExists: true
    }
  );
} catch (error) {
  console.log('Document already exists in cache');
}

// Store a value only if the version matches
try {
  await storageManager.setValue(
    'shared-state',
    newState,
    {
      namespace: 'state',
      ifVersion: 3 // Only update if current version is 3
    }
  );
} catch (error) {
  console.log('Version mismatch, cannot update state');
}
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

// Get value with metadata
const document = await storageManager.getValue('document-123', {
  namespace: 'documents',
  includeMetadata: true
});

console.log('Document:', document);
console.log('Metadata:', document.metadata);
```

### Deleting Values

```typescript
// Delete a value
const deleted = await storageManager.deleteValue('temp-data', {
  namespace: 'cache'
});

console.log('Value deleted:', deleted);

// Delete only if exists
try {
  await storageManager.deleteValue('config', {
    namespace: 'settings',
    ifExists: true
  });
} catch (error) {
  console.log('Config does not exist');
}

// Delete only if version matches
try {
  await storageManager.deleteValue('shared-state', {
    namespace: 'state',
    ifVersion: 5 // Only delete if current version is 5
  });
} catch (error) {
  console.log('Version mismatch, cannot delete state');
}
```

### Listing Keys

```typescript
// List all keys in a namespace
const allKeys = await storageManager.listKeys({
  namespace: 'documents'
});

console.log('All document keys:', allKeys);

// List keys matching a pattern
const userDocs = await storageManager.listKeys({
  namespace: 'documents',
  pattern: 'user-123-*'
});

console.log('User documents:', userDocs);

// List with pagination
const paginatedKeys = await storageManager.listKeys({
  namespace: 'cache',
  limit: 10,
  offset: 20,
  sortBy: 'key',
  sortDirection: 'asc'
});

console.log('Paginated keys:', paginatedKeys);
```

### Event Handling

```typescript
// Listen for storage events
storageManager.on('valueSet', (key, namespace) => {
  console.log(`Value set: ${namespace}:${key}`);
});

storageManager.on('valueGet', (key, namespace) => {
  console.log(`Value retrieved: ${namespace}:${key}`);
});

storageManager.on('valueDeleted', (key, namespace) => {
  console.log(`Value deleted: ${namespace}:${key}`);
});

storageManager.on('keysListed', (namespace, pattern) => {
  console.log(`Keys listed in ${namespace}${pattern ? ` matching ${pattern}` : ''}`);
});

storageManager.on('storageRequested', (key, requesterId, namespace) => {
  console.log(`Storage requested: ${namespace}:${key} by ${requesterId}`);
});
```

### Cleanup

```typescript
// Shutdown the storage manager
await storageManager.shutdown();
```

## API Reference

### `StorageManager`

The main class for distributed storage operations.

#### Constructor

```typescript
constructor(options: StorageManagerOptions)
```

- `options`: Configuration options for the storage manager
  - `serviceId`: ID of the service running this storage manager
  - `persistenceEnabled`: Enable persistent storage
  - `cacheTTL`: Default time-to-live for cached values in milliseconds
  - `maxCacheSize`: Maximum cache size in bytes
  - `natsClient`: Optional NATS client instance

#### Methods

- `initialize(): Promise<void>` - Initialize the storage manager
- `shutdown(): Promise<void>` - Shutdown the storage manager
- `setValue<T>(key: string, value: T, options?: SetOptions): Promise<void>` - Store a value
- `getValue<T>(key: string, options?: GetOptions): Promise<T | null>` - Retrieve a value
- `deleteValue(key: string, options?: DeleteOptions): Promise<boolean>` - Delete a value
- `listKeys(options?: ListOptions): Promise<string[]>` - List keys in a namespace
- `setPersistenceAdapter(adapter: StoragePersistenceAdapter): void` - Set a persistence adapter

#### Events

- `valueSet` - Emitted when a value is set
- `valueGet` - Emitted when a value is retrieved
- `valueDeleted` - Emitted when a value is deleted
- `keysListed` - Emitted when keys are listed
- `storageRequested` - Emitted when a value is requested from another agent
- `error` - Emitted when an error occurs

## Storage Value

The storage manager maintains information about each stored value:

```typescript
export interface StorageValue<T = unknown> {
  value: T;
  metadata?: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
  ttl?: number;
  namespace?: string;
}
```

## Persistence Adapter

For persistent storage, implement the `StoragePersistenceAdapter` interface:

```typescript
export interface StoragePersistenceAdapter {
  persist(key: string, value: StorageValue): Promise<void>;
  retrieve(key: string, version?: number): Promise<StorageValue | null>;
  delete(key: string): Promise<boolean>;
  list(namespace?: string, pattern?: string): Promise<string[]>;
}
```

## Best Practices

1. **Namespaces**: Use meaningful namespaces to organize data
2. **Keys**: Use consistent key naming conventions
3. **TTL**: Set appropriate TTL values based on data volatility
4. **Versioning**: Use versioning for critical data that requires consistency
5. **Metadata**: Include useful metadata with stored values
6. **Error Handling**: Handle storage operation errors gracefully
7. **Persistence**: Implement a persistence adapter for critical data
8. **Caching**: Be mindful of cache size and memory usage

## Implementation Details

The Storage Manager uses NATS publish/subscribe for distributed storage operations. It maintains a local cache of values and can request values from other agents when not found in the local cache. It supports versioning, TTL, and conditional operations.

### Key Files

- `src/core/messaging/storageManager.ts` - Main implementation
- `tests/unit/messaging/storageManager.test.ts` - Unit tests
- `tests/integration/messaging/messageFlow.test.ts` - Integration tests
