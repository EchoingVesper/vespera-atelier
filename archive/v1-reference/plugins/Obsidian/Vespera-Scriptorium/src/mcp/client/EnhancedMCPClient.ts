import { MCPResult, MCPRequestOptions, MCPFileInfo, MCPSearchOptions, MCPClientConfig } from '../types';
import { mcpConfig } from '../config';
import { EventEmitter } from 'events';

// Extend MCPRequestOptions to include cacheTtl
export interface EnhancedMCPRequestOptions extends MCPRequestOptions {
  cacheTtl?: number;
}

// Extend MCPSearchOptions to include cacheTtl
export interface EnhancedMCPSearchOptions extends MCPSearchOptions {
  cacheTtl?: number;
}

// Base client interface that our enhanced client will implement
interface BaseMCPClient {
  ping(): Promise<MCPResult<{ version: string }>>;
  getServerInfo(): Promise<MCPResult<{ name: string; version: string; capabilities: string[] }>>;
  readFile(path: string, options?: MCPRequestOptions): Promise<MCPResult<MCPFileInfo>>;
  writeFile(path: string, content: string, options?: MCPRequestOptions): Promise<MCPResult<MCPFileInfo>>;
  deleteFile(path: string, options?: MCPRequestOptions): Promise<MCPResult<{ path: string }>>;
  searchFiles(options: MCPSearchOptions): Promise<MCPResult<{ results: MCPFileInfo[]; total: number }>>;
  executeCommand<T = any>(command: string, data?: Record<string, any>): Promise<MCPResult<T>>;
}

// Define event types
export interface CircuitOpenEvent {
  operation: string;
  failureCount: number;
  timestamp: number;
}

type EventMap = {
  circuitOpen: [event: CircuitOpenEvent];
  circuitReset: [];
  error: [error: Error];
};

interface EnhancedMCPClientConfig {
  circuitBreaker?: {
    failureThreshold?: number;
    resetTimeout?: number;
    successThreshold?: number;
  };
  cache?: {
    ttl?: number;
    maxSize?: number;
  };
  retry?: {
    maxRetries?: number;
    delay?: number;
  };
  timeout?: number;
  batching?: {
    enabled?: boolean;
    maxBatchSize?: number;
    maxWaitTime?: number;
  };
  metrics?: {
    enabled?: boolean;
    sampleRate?: number;
  };
  [key: string]: any; // Allow additional properties
};

// Enhanced MCP Client with advanced features
// Implements EventEmitter-like interface for custom events
export class EnhancedMCPClient {
  private emitter = new EventEmitter();
  private config: EnhancedMCPClientConfig & MCPClientConfig;
  
  private client: BaseMCPClient;
  private pendingBatch: Array<{
    method: string;
    params: any[];
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
  }> = [];
  
  private batchTimer?: NodeJS.Timeout;
  private readonly BATCH_DELAY_MS = 50; // 50ms batching window
  private cache: Map<string, { data: unknown; expires: number }> = new Map();
  private cacheCleanupInterval?: NodeJS.Timeout;

  private startCacheCleanup(): void {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
    }
    this.cacheCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (entry.expires <= now) {
          this.cache.delete(key);
        }
      }
    }, 60 * 1000); // Run every minute
  }

  // Cache management methods
  private getFromCache<T>(key: string): T | undefined {
    const cached = this.cache.get(key);
    if (!cached) {
      return undefined;
    }
    if (cached.expires < Date.now()) {
      this.cache.delete(key);
      return undefined;
    }
    return cached.data as T;
  }

  private setInCache<T>(key: string, data: T, ttl: number = this.config.cache?.ttl || 300000): void {
    if (!this.config.cache?.enabled) return;
    
    const ttlMs = ttl ?? this.config.cache.ttl ?? 5 * 60 * 1000; // Default 5 minutes
    this.cache.set(key, {
      data,
      expires: Date.now() + ttlMs
    });
  }

  private pendingRequests: Map<string, Promise<any>> = new Map();
  private circuitBreaker = {
    isOpen: false,
    failureCount: 0,
    lastFailure: 0,
    resetTimeout: 30000, // 30 seconds
    failureThreshold: 5,
    successThreshold: 2,
  };

  // Event emitter methods
  public on<K extends keyof EventMap>(
    event: K,
    listener: (...args: EventMap[K]) => void
  ): this {
    this.emitter.on(event, listener as (...args: any[]) => void);
    return this;
  }

  public once<K extends keyof EventMap>(
    event: K,
    listener: (...args: EventMap[K]) => void
  ): this {
    this.emitter.once(event, listener as (...args: any[]) => void);
    return this;
  }

  public off<K extends keyof EventMap>(
    event: K,
    listener: (...args: EventMap[K]) => void
  ): this {
    this.emitter.off(event, listener as (...args: any[]) => void);
    return this;
  }

  private emit<K extends keyof EventMap>(
    event: K,
    ...args: EventMap[K]
  ): boolean {
    return this.emitter.emit(event, ...args);
  }

  public removeAllListeners(event?: keyof EventMap): this {
    this.emitter.removeAllListeners(event);
    return this;
  }

  constructor(client: BaseMCPClient, config?: MCPClientConfig) {
    this.client = client;
    this.config = config || mcpConfig.getConfig();
  }

  // Implement BaseMCPClient methods with enhanced functionality
  async ping(): Promise<MCPResult<{ version: string }>> {
    return this.executeWithCircuitBreaker('ping', () => this.client.ping());
  }

  async getServerInfo(): Promise<MCPResult<{ name: string; version: string; capabilities: string[] }>> {
    return this.executeWithCircuitBreaker('getServerInfo', () => this.client.getServerInfo());
  }

  async readFile(path: string, options?: EnhancedMCPRequestOptions): Promise<MCPResult<MCPFileInfo>> {
    const cacheKey = `readFile:${path}`;
    const cached = this.getFromCache<MCPFileInfo>(cacheKey);
    if (cached) {
      return { 
        success: true, 
        data: cached,
        meta: { duration: 0, timestamp: Date.now() }
      };
    }

    return this.executeWithCircuitBreaker('readFile', async () => {
      const result = await this.client.readFile(path, options);
      if (result.success && result.data) {
        this.setInCache(cacheKey, result.data, options?.cacheTtl);
      }
      return result;
    });
  }

  async writeFile(path: string, content: string, options?: EnhancedMCPRequestOptions): Promise<MCPResult<MCPFileInfo>> {
    return this.executeWithCircuitBreaker('writeFile', () => 
      this.client.writeFile(path, content, options)
    );
  }

  async deleteFile(path: string, options?: EnhancedMCPRequestOptions): Promise<MCPResult<{ path: string }>> {
    return this.executeWithCircuitBreaker('deleteFile', () => 
      this.client.deleteFile(path, options)
    );
  }

  async searchFiles(options: EnhancedMCPSearchOptions): Promise<MCPResult<{ results: MCPFileInfo[]; total: number }>> {
    const cacheKey = `searchFiles:${JSON.stringify(options)}`;
    const cached = this.getFromCache<{ results: MCPFileInfo[]; total: number }>(cacheKey);
    if (cached) {
      return { 
        success: true, 
        data: cached,
        meta: { duration: 0, timestamp: Date.now() }
      };
    }

    return this.executeWithCircuitBreaker('searchFiles', async () => {
      const result = await this.client.searchFiles(options);
      if (result.success && result.data) {
        this.setInCache(cacheKey, result.data, options?.cacheTtl);
      }
      return result;
    });
  }

  async getFileInfo(uri: string): Promise<MCPResult<MCPFileInfo>> {
    const cacheKey = `file:${uri}`;
    const cached = this.getFromCache<MCPFileInfo>(cacheKey);
    if (cached) {
      return { 
        success: true, 
        data: cached,
        meta: {
          duration: 0,
          timestamp: Date.now()
        }
      };
    }

    try {
      const result = await this.client.executeCommand<MCPFileInfo>('getFileInfo', { uri });
      if (result.success && result.data) {
        this.setInCache(cacheKey, result.data);
      }
      return result;
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        meta: {
          duration: 0,
          timestamp: Date.now()
        }
      };
    }
  }

  async listResources(
    serverName: string,
    cursor?: string
  ): Promise<MCPResult<{ results: MCPFileInfo[]; total: number }>> {
    const cacheKey = `list:${serverName}:${cursor || 'initial'}`;
    const cached = this.getFromCache<{ results: MCPFileInfo[]; total: number }>(cacheKey);
    if (cached) {
      return { 
        success: true, 
        data: {
          results: cached.results,
          total: cached.total
        },
        meta: {
          duration: 0,
          timestamp: Date.now()
        }
      };
    }

    try {
      const result = await this.client.executeCommand<{ results: MCPFileInfo[]; total: number }>(
        'listResources',
        { serverName, cursor }
      );
      
      if (result.success && result.data) {
        this.setInCache(cacheKey, {
          results: result.data.results,
          total: result.data.total
        });
      }
      return result;
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        meta: {
          duration: 0,
          timestamp: Date.now()
        }
      };
    }
  }

  async executeCommand<T = any>(command: string, data?: Record<string, any>): Promise<MCPResult<T>> {
    return this.executeWithCircuitBreaker('executeCommand', () => 
      this.client.executeCommand<T>(command, data)
    );
  }

  // Circuit breaker implementation
  private async executeWithCircuitBreaker<T>(
    operation: string,
    action: () => Promise<MCPResult<T>>
  ): Promise<MCPResult<T>> {
    if (this.circuitBreaker.isOpen) {
      const now = Date.now();
      if (now - this.circuitBreaker.lastFailure > this.circuitBreaker.resetTimeout) {
        this.circuitBreaker.isOpen = false;
        this.circuitBreaker.failureCount = 0;
        this.emit('circuitReset');
      } else {
        return {
          success: false,
          error: 'Service unavailable due to circuit breaker being open'
        };
      }
    }

    try {
      const result = await action();
      if (result.success) {
        this.recordSuccess();
      } else {
        this.recordFailure(operation);
      }
      return result;
    } catch (error) {
      this.recordFailure(operation);
      throw error;
    }
  }

  private recordSuccess(): void {
    if (this.circuitBreaker.failureCount > 0) {
      this.circuitBreaker.failureCount--;
      if (this.circuitBreaker.failureCount === 0) {
        this.circuitBreaker.isOpen = false;
        this.emit('circuitReset');
      }
    }
  }

  private recordFailure(operation: string): void {
    this.circuitBreaker.failureCount++;
    const timestamp = Date.now();
    this.circuitBreaker.lastFailure = timestamp;

    if (this.circuitBreaker.failureCount >= this.circuitBreaker.failureThreshold) {
      this.circuitBreaker.isOpen = true;
      this.emit('circuitOpen', {
        operation,
        failureCount: this.circuitBreaker.failureCount,
        timestamp,
        duration: this.circuitBreaker.resetTimeout
      } as CircuitOpenEvent);
    }
  }



  // Public API for cache management
  public clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  private isObject(item: any): boolean {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  private deepMerge(target: any, source: any): any {
    const output = { ...target };
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    return output;
  }

  public updateConfig(updates: Partial<MCPClientConfig>): void {
    this.config = this.deepMerge(this.config, updates);
    
    // Update cache settings if changed
    if (updates.cache) {
      if (updates.cache.enabled && !this.cacheCleanupInterval) {
        this.startCacheCleanup();
      } else if (updates.cache.enabled === false && this.cacheCleanupInterval) {
        clearInterval(this.cacheCleanupInterval);
        this.cacheCleanupInterval = undefined;
      }
    }
  }

  public getConfig(): MCPClientConfig {
    return { ...this.config };
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; hits: number; misses: number } {
    return {
      size: this.cache.size,
      hits: 0, // TODO: Implement hit/miss tracking
      misses: 0
    };
  }
}

// Export a singleton instance
let enhancedMCPClientInstance: EnhancedMCPClient | null = null;

/**
 * Get or create the EnhancedMCPClient instance
 */
export function getEnhancedMCPClient(client: BaseMCPClient): EnhancedMCPClient {
  if (!enhancedMCPClientInstance) {
    enhancedMCPClientInstance = new EnhancedMCPClient(client);
  }
  return enhancedMCPClientInstance;
}

/**
 * Reset the EnhancedMCPClient instance (for testing)
 */
export function resetEnhancedMCPClient(): void {
  enhancedMCPClientInstance = null;
}
