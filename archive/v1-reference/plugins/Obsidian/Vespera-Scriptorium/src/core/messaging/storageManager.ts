/**
 * Storage Manager for handling storage-related messages in the A2A communication layer
 */
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { 
  Message, 
  MessageType, 
  BaseStoragePayload,
  StorageSetPayload,
  StorageGetPayload,
  StorageRequestPayload,
  StorageDeletePayload,
  StorageListPayload,
  ErrorPayload
} from './types';
import { natsClient, NatsClient } from './natsClient';

// Define event types for the storage manager
export interface StorageManagerEvents {
  valueSet: (key: string, namespace?: string) => void;
  valueGet: (key: string, namespace?: string) => void;
  valueDeleted: (key: string, namespace?: string) => void;
  keysListed: (namespace?: string, pattern?: string) => void;
  storageRequested: (key: string, requesterId: string, namespace?: string) => void;
  error: (error: Error | ErrorPayload) => void;
}

export interface StorageManagerOptions {
  serviceId: string;
  persistenceEnabled?: boolean;
  cacheTTL?: number; // in milliseconds
  maxCacheSize?: number; // in bytes
  natsClient?: NatsClient;
}

export interface StorageValue<T = unknown> {
  value: T;
  metadata?: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
  ttl?: number;
  namespace?: string;
}

export interface StoragePersistenceAdapter {
  persist(key: string, value: StorageValue): Promise<void>;
  retrieve(key: string, version?: number): Promise<StorageValue | null>;
  delete(key: string): Promise<boolean>;
  list(namespace?: string, pattern?: string): Promise<string[]>;
}

/**
 * StorageManager handles storage-related messages and provides an API for distributed storage
 */
export class StorageManager extends EventEmitter {
  private serviceId: string;
  private persistenceEnabled: boolean;
  private cacheTTL: number;
  private maxCacheSize: number;
  private natsClient: NatsClient;
  private storage: Map<string, StorageValue> = new Map();
  private subscriptions: string[] = [];
  private persistenceAdapter?: StoragePersistenceAdapter;

  constructor(options: StorageManagerOptions) {
    super();
    this.serviceId = options.serviceId;
    this.persistenceEnabled = options.persistenceEnabled || false;
    this.cacheTTL = options.cacheTTL || 300000; // 5 minutes
    this.maxCacheSize = options.maxCacheSize || 50 * 1024 * 1024; // 50MB
    this.natsClient = options.natsClient || natsClient;
  }

  /**
   * Initialize the storage manager
   */
  async initialize(): Promise<void> {
    try {
      // Subscribe to storage-related messages
      await this.setupSubscriptions();
      console.log(`Storage manager initialized for service ${this.serviceId}`);
    } catch (error) {
      console.error('Failed to initialize storage manager:', error);
      throw error;
    }
  }

  /**
   * Clean up resources
   */
  async shutdown(): Promise<void> {
    // Unsubscribe from all subscriptions
    await Promise.all(
      this.subscriptions.map(subId => 
        this.natsClient.unsubscribe(subId).catch(console.error)
      )
    );

    // Persist any remaining data if enabled
    if (this.persistenceEnabled && this.persistenceAdapter) {
      await this.persistAll();
    }

    console.log(`Storage manager for service ${this.serviceId} shut down`);
  }

  /**
   * Set up message subscriptions
   */
  private async setupSubscriptions(): Promise<void> {
    // Subscribe to storage set messages
    const setSubId = await this.natsClient.subscribe(
      'storage.set',
      async (msg: Message<StorageSetPayload>) => {
        await this.handleStorageSet(msg);
      }
    );
    this.subscriptions.push(setSubId);

    // Subscribe to storage get messages
    const getSubId = await this.natsClient.subscribe(
      'storage.get',
      async (msg: Message<StorageGetPayload>) => {
        await this.handleStorageGet(msg);
      }
    );
    this.subscriptions.push(getSubId);

    // Subscribe to storage request messages
    const requestSubId = await this.natsClient.subscribe(
      'storage.request',
      async (msg: Message<StorageRequestPayload>) => {
        await this.handleStorageRequest(msg);
      }
    );
    this.subscriptions.push(requestSubId);

    // Subscribe to storage delete messages
    const deleteSubId = await this.natsClient.subscribe(
      'storage.delete',
      async (msg: Message<StorageDeletePayload>) => {
        await this.handleStorageDelete(msg);
      }
    );
    this.subscriptions.push(deleteSubId);

    // Subscribe to storage list messages
    const listSubId = await this.natsClient.subscribe(
      'storage.list',
      async (msg: Message<StorageListPayload>) => {
        await this.handleStorageList(msg);
      }
    );
    this.subscriptions.push(listSubId);

    console.log('Storage manager subscriptions set up');
  }

  /**
   * Set a value in the distributed storage
   */
  async setValue<T>(
    key: string, 
    value: T, 
    options?: {
      namespace?: string;
      ttl?: number;
      metadata?: Record<string, unknown>;
      overwrite?: boolean;
      ifNotExists?: boolean;
      ifVersion?: number;
    }
  ): Promise<void> {
    const namespace = options?.namespace || 'default';
    const fullKey = this.getFullKey(key, namespace);
    const now = new Date().toISOString();
    
    // Check if the key exists
    const existing = this.storage.get(fullKey);
    
    // Handle conditional operations
    if (options?.ifNotExists && existing) {
      throw new Error(`Key already exists: ${fullKey}`);
    }
    
    if (options?.ifVersion !== undefined && existing && existing.version !== options.ifVersion) {
      throw new Error(`Version mismatch for key ${fullKey}`);
    }
    
    if (!options?.overwrite && existing) {
      throw new Error(`Key already exists: ${fullKey}`);
    }
    
    // Create or update storage value
    const storageValue: StorageValue<T> = {
      value,
      metadata: options?.metadata,
      version: existing ? existing.version + 1 : 1,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
      ttl: options?.ttl,
      namespace
    };
    
    // Store the value
    this.storage.set(fullKey, storageValue);
    
    // Publish storage set message
    const payload: StorageSetPayload = {
      key,
      namespace,
      value,
      ttl: options?.ttl,
      metadata: options?.metadata,
      options: {
        overwrite: options?.overwrite,
        ifNotExists: options?.ifNotExists,
        ifVersion: options?.ifVersion
      }
    };
    
    const message: Message<StorageSetPayload> = {
      type: MessageType.STORAGE_SET,
      headers: {
        correlationId: uuidv4(),
        messageId: uuidv4(),
        timestamp: now,
        source: this.serviceId
      },
      payload
    };
    
    await this.natsClient.publish('storage.set', message);
    this.emit('valueSet', key, namespace);
    
    // Set expiration if TTL is provided
    if (options?.ttl) {
      setTimeout(() => {
        this.storage.delete(fullKey);
      }, options.ttl);
    }
  }

  /**
   * Get a value from the distributed storage
   */
  async getValue<T>(
    key: string, 
    options?: {
      namespace?: string;
      includeMetadata?: boolean;
      version?: number;
    }
  ): Promise<T | null> {
    const namespace = options?.namespace || 'default';
    const fullKey = this.getFullKey(key, namespace);
    
    // Check local cache first
    const cachedValue = this.storage.get(fullKey);
    
    if (cachedValue) {
      // Handle version request
      if (options?.version !== undefined && cachedValue.version !== options.version) {
        if (this.persistenceEnabled && this.persistenceAdapter) {
          const persistedValue = await this.persistenceAdapter.retrieve(fullKey, options.version);
          if (persistedValue) {
            return persistedValue.value as T;
          }
        }
        throw new Error(`Version ${options.version} not available for key ${fullKey}`);
      }
      
      // Publish storage get message
      const payload: StorageGetPayload = {
        key,
        namespace,
        includeMetadata: options?.includeMetadata,
        version: options?.version
      };
      
      const message: Message<StorageGetPayload> = {
        type: MessageType.STORAGE_GET,
        headers: {
          correlationId: uuidv4(),
          messageId: uuidv4(),
          timestamp: new Date().toISOString(),
          source: this.serviceId
        },
        payload
      };
      
      await this.natsClient.publish('storage.get', message);
      this.emit('valueGet', key, namespace);
      
      return cachedValue.value as T;
    }
    
    // If not in cache, try to get from other services
    return this.requestValue<T>(key, namespace);
  }

  /**
   * Delete a value from the distributed storage
   */
  async deleteValue(
    key: string, 
    options?: {
      namespace?: string;
      ifExists?: boolean;
      ifVersion?: number;
    }
  ): Promise<boolean> {
    const namespace = options?.namespace || 'default';
    const fullKey = this.getFullKey(key, namespace);
    
    // Check if the key exists
    const existing = this.storage.get(fullKey);
    
    // Handle conditional operations
    if (options?.ifExists && !existing) {
      return false;
    }
    
    if (options?.ifVersion !== undefined && existing && existing.version !== options.ifVersion) {
      throw new Error(`Version mismatch for key ${fullKey}`);
    }
    
    // Delete the value
    const deleted = this.storage.delete(fullKey);
    
    // Publish storage delete message
    const payload: StorageDeletePayload = {
      key,
      namespace,
      options: {
        ifExists: options?.ifExists,
        ifVersion: options?.ifVersion
      }
    };
    
    const message: Message<StorageDeletePayload> = {
      type: MessageType.STORAGE_DELETE,
      headers: {
        correlationId: uuidv4(),
        messageId: uuidv4(),
        timestamp: new Date().toISOString(),
        source: this.serviceId
      },
      payload
    };
    
    await this.natsClient.publish('storage.delete', message);
    this.emit('valueDeleted', key, namespace);
    
    return deleted;
  }

  /**
   * List keys in the distributed storage
   */
  async listKeys(
    options?: {
      namespace?: string;
      pattern?: string;
      limit?: number;
      offset?: number;
      sortBy?: string;
      sortDirection?: 'asc' | 'desc';
    }
  ): Promise<string[]> {
    const namespace = options?.namespace || 'default';
    const pattern = options?.pattern || '*';
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;
    
    // Filter keys by namespace and pattern
    const keys = Array.from(this.storage.keys())
      .filter(key => {
        // Check namespace
        const [keyNamespace] = key.split(':', 1);
        if (keyNamespace !== namespace) {
          return false;
        }
        
        // Check pattern
        const actualKey = key.substring(namespace.length + 1);
        return this.matchesPattern(actualKey, pattern);
      })
      .map(key => key.substring(namespace.length + 1));
    
    // Sort keys if needed
    if (options?.sortBy) {
      keys.sort();
      if (options?.sortDirection === 'desc') {
        keys.reverse();
      }
    }
    
    // Apply pagination
    const paginatedKeys = keys.slice(offset, offset + limit);
    
    // Publish storage list message
    const payload: StorageListPayload = {
      namespace,
      pattern,
      limit,
      offset,
      sortBy: options?.sortBy,
      sortDirection: options?.sortDirection
    };
    
    const message: Message<StorageListPayload> = {
      type: MessageType.STORAGE_LIST,
      headers: {
        correlationId: uuidv4(),
        messageId: uuidv4(),
        timestamp: new Date().toISOString(),
        source: this.serviceId
      },
      payload
    };
    
    await this.natsClient.publish('storage.list', message);
    this.emit('keysListed', namespace, pattern);
    
    return paginatedKeys;
  }

  /**
   * Request a value from other services
   */
  private async requestValue<T>(
    key: string, 
    namespace: string = 'default'
  ): Promise<T | null> {
    const fullKey = this.getFullKey(key, namespace);
    
    // Create request payload
    const payload: StorageRequestPayload = {
      key,
      namespace,
      requesterId: this.serviceId
    };
    
    const message: Message<StorageRequestPayload> = {
      type: MessageType.STORAGE_REQUEST,
      headers: {
        correlationId: uuidv4(),
        messageId: uuidv4(),
        timestamp: new Date().toISOString(),
        source: this.serviceId,
        replyTo: `service.${this.serviceId}.storage.response.${key}`
      },
      payload
    };
    
    // Subscribe to the response
    const responseSubject = `service.${this.serviceId}.storage.response.${key}`;
    const subscription = await this.natsClient.subscribe(responseSubject);
    
    try {
      // Publish request
      await this.natsClient.publish('storage.request', message);
      this.emit('storageRequested', key, this.serviceId, namespace);
      
      // Wait for response with timeout
      const response = await this.natsClient.waitForMessage(subscription, 5000);
      
      if (response) {
        const storageValue = response.payload.value as StorageValue<T>;
        
        // Cache the value
        this.storage.set(fullKey, storageValue);
        
        return storageValue.value;
      }
      
      return null;
    } finally {
      // Unsubscribe
      await this.natsClient.unsubscribe(subscription);
    }
  }

  /**
   * Handle storage set messages
   */
  private async handleStorageSet(msg: Message<StorageSetPayload>): Promise<void> {
    const { key, namespace = 'default', value, ttl, metadata, options } = msg.payload;
    const fullKey = this.getFullKey(key, namespace);
    
    // Check if we already have this key
    const existing = this.storage.get(fullKey);
    
    // Handle conditional operations
    if (options?.ifNotExists && existing) {
      return; // Key already exists, ignore
    }
    
    if (options?.ifVersion !== undefined && existing && existing.version !== options.ifVersion) {
      return; // Version mismatch, ignore
    }
    
    if (!options?.overwrite && existing) {
      return; // Key already exists, ignore
    }
    
    const now = new Date().toISOString();
    
    // Create or update storage value
    const storageValue: StorageValue = {
      value,
      metadata,
      version: existing ? existing.version + 1 : 1,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
      ttl,
      namespace
    };
    
    // Store the value
    this.storage.set(fullKey, storageValue);
    
    // Emit event
    this.emit('valueSet', key, namespace);
    
    // Set expiration if TTL is provided
    if (ttl) {
      setTimeout(() => {
        this.storage.delete(fullKey);
      }, ttl);
    }
  }

  /**
   * Handle storage get messages
   */
  private async handleStorageGet(msg: Message<StorageGetPayload>): Promise<void> {
    const { key, namespace = 'default' } = msg.payload;
    
    // Check if we have this key
    const storageValue = this.storage.get(this.getFullKey(key, namespace));
    if (!storageValue) {
      return; // We don't have this key
    }
    
    // Emit event
    this.emit('valueGet', key, namespace);
  }

  /**
   * Handle storage request messages
   */
  private async handleStorageRequest(msg: Message<StorageRequestPayload>): Promise<void> {
    const { key, namespace = 'default', requesterId } = msg.payload;
    const fullKey = this.getFullKey(key, namespace);
    
    // Check if we have this key
    const storageValue = this.storage.get(fullKey);
    if (!storageValue) {
      return; // We don't have this key
    }
    
    // Send response to the requester
    const responseSubject = `service.${requesterId}.storage.response.${key}`;
    
    const responseMessage: Message<{ key: string; namespace: string; value: StorageValue }> = {
      type: MessageType.STORAGE_SET,
      headers: {
        correlationId: msg.headers.correlationId,
        messageId: uuidv4(),
        timestamp: new Date().toISOString(),
        source: this.serviceId,
        destination: requesterId
      },
      payload: {
        key,
        namespace,
        value: storageValue
      }
    };
    
    await this.natsClient.publish(responseSubject, responseMessage);
    
    // Emit event
    this.emit('storageRequested', key, requesterId, namespace);
  }

  /**
   * Handle storage delete messages
   */
  private async handleStorageDelete(msg: Message<StorageDeletePayload>): Promise<void> {
    const { key, namespace = 'default', options } = msg.payload;
    const fullKey = this.getFullKey(key, namespace);
    
    // Check if we have this key
    const existing = this.storage.get(fullKey);
    if (!existing) {
      return; // We don't have this key
    }
    
    // Handle conditional operations
    if (options?.ifExists && !existing) {
      return; // Key doesn't exist, ignore
    }
    
    if (options?.ifVersion !== undefined && existing.version !== options.ifVersion) {
      return; // Version mismatch, ignore
    }
    
    // Delete the value
    this.storage.delete(fullKey);
    
    // Emit event
    this.emit('valueDeleted', key, namespace);
  }

  /**
   * Handle storage list messages
   */
  private async handleStorageList(msg: Message<StorageListPayload>): Promise<void> {
    const { namespace = 'default', pattern } = msg.payload;
    
    // Emit event
    this.emit('keysListed', namespace, pattern);
  }

  /**
   * Get the full key with namespace
   */
  private getFullKey(key: string, namespace: string): string {
    return `${namespace}:${key}`;
  }

  /**
   * Check if a key matches a pattern
   * Simple glob pattern matching (supports * wildcard)
   */
  private matchesPattern(key: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(key);
  }

  /**
   * Persist all data to storage
   * Used during shutdown
   */
  private async persistAll(): Promise<void> {
    if (!this.persistenceAdapter) {
      return;
    }
    
    const persistPromises: Promise<void>[] = [];
    
    for (const [key, value] of this.storage.entries()) {
      persistPromises.push(this.persistenceAdapter.persist(key, value));
    }
    
    await Promise.all(persistPromises);
  }

  /**
   * Set a persistence adapter
   */
  setPersistenceAdapter(adapter: StoragePersistenceAdapter): void {
    this.persistenceAdapter = adapter;
    this.persistenceEnabled = true;
  }
}

// Singleton instance
export const storageManager = new StorageManager({
  serviceId: `storagemanager-${uuidv4()}`,
});
