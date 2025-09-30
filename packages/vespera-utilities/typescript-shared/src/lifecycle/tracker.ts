/**
 * @fileoverview Resource tracking with memory monitoring and stale resource detection
 * @module @vespera/typescript-shared/lifecycle
 *
 * Provides advanced resource lifecycle tracking with:
 * - Named resource registration and management
 * - Memory usage estimation and monitoring
 * - Stale resource detection and cleanup
 * - Resource age and usage statistics
 *
 * @example
 * ```typescript
 * const tracker = new ResourceTracker();
 *
 * // Register resources
 * tracker.registerResource('db-connection', dbConnection, 1024 * 1024); // 1MB
 * tracker.registerResource('cache', cache, 512 * 1024); // 512KB
 *
 * // Monitor memory
 * const stats = tracker.getMemoryStats();
 * console.log(`Total memory: ${stats.totalBytes / 1024 / 1024}MB`);
 *
 * // Clean up stale resources (unused for >1 hour)
 * const cleaned = await tracker.cleanupStaleResources(60 * 60 * 1000);
 * console.log(`Cleaned ${cleaned.length} stale resources`);
 * ```
 */

import { EnhancedDisposable, BaseDisposable } from './disposable';

/**
 * Tracked resource with metadata.
 *
 * @interface TrackedResource
 */
interface TrackedResource {
  /** Unique name/identifier for the resource */
  name: string;

  /** The disposable resource being tracked */
  resource: EnhancedDisposable;

  /** Estimated memory usage in bytes (if known) */
  estimatedBytes?: number;

  /** When the resource was registered */
  registeredAt: number;

  /** When the resource was last accessed/used */
  lastAccessedAt: number;

  /** Custom metadata for the resource */
  metadata?: Record<string, unknown>;
}

/**
 * Memory usage statistics.
 *
 * @interface MemoryStats
 */
export interface MemoryStats {
  /** Total number of tracked resources */
  totalResources: number;

  /** Number of disposed resources still tracked */
  disposedResources: number;

  /** Number of active (not disposed) resources */
  activeResources: number;

  /** Total estimated memory usage in bytes */
  totalBytes: number;

  /** Memory usage by resource name */
  byResource: Record<
    string,
    {
      bytes: number;
      disposed: boolean;
      age: number;
      lastAccessed: number;
    }
  >;
}

/**
 * Information about a stale resource.
 *
 * @interface StaleResourceInfo
 */
export interface StaleResourceInfo {
  /** Resource name */
  name: string;

  /** Age in milliseconds since registration */
  age: number;

  /** Time since last access in milliseconds */
  timeSinceLastAccess: number;

  /** Estimated memory in bytes */
  estimatedBytes?: number;
}

/**
 * Resource tracker for managing named disposable resources with memory monitoring.
 *
 * Provides advanced lifecycle tracking:
 * - Named resource registration and retrieval
 * - Memory usage estimation and monitoring
 * - Stale resource detection (by age or last access)
 * - Automatic disposal of stale resources
 * - Resource statistics and reporting
 *
 * @class ResourceTracker
 * @extends {BaseDisposable}
 *
 * @example
 * ```typescript
 * // Create tracker
 * const tracker = new ResourceTracker(10);
 *
 * // Register resources with memory estimates
 * const conn = new DatabaseConnection();
 * tracker.registerResource('primary-db', conn, 2 * 1024 * 1024);
 *
 * // Access resources
 * const resource = tracker.getResource('primary-db');
 * tracker.touchResource('primary-db');
 *
 * // Monitor memory
 * const stats = tracker.getMemoryStats();
 * console.log(`Active: ${stats.activeResources}`);
 *
 * // Clean up stale resources
 * const cleaned = await tracker.cleanupStaleResources(30 * 60 * 1000);
 *
 * // Dispose tracker
 * await tracker.dispose();
 * ```
 */
export class ResourceTracker extends BaseDisposable {
  private resources: Map<string, TrackedResource> = new Map();

  /**
   * Creates a new resource tracker.
   *
   * @param disposalPriority - Optional disposal priority
   */
  constructor(disposalPriority: number = 0) {
    super(disposalPriority);
  }

  /**
   * Register a disposable resource for tracking.
   *
   * @param name - Unique name/identifier for the resource
   * @param resource - Disposable resource to track
   * @param estimatedBytes - Optional estimated memory usage in bytes
   * @param metadata - Optional custom metadata
   * @throws Error if resource with same name already registered
   * @throws Error if tracker is disposed
   *
   * @example
   * ```typescript
   * const cache = new CacheService();
   * tracker.registerResource(
   *   'user-cache',
   *   cache,
   *   10 * 1024 * 1024, // 10MB
   *   { maxSize: 1000, ttl: 3600 }
   * );
   * ```
   */
  public registerResource(
    name: string,
    resource: EnhancedDisposable,
    estimatedBytes?: number,
    metadata?: Record<string, unknown>
  ): void {
    this.ensureNotDisposed('resource registration');

    if (this.resources.has(name)) {
      throw new Error(`Resource '${name}' is already registered`);
    }

    const now = Date.now();
    this.resources.set(name, {
      name,
      resource,
      estimatedBytes,
      registeredAt: now,
      lastAccessedAt: now,
      metadata,
    });
  }

  /**
   * Get a tracked resource by name.
   *
   * Automatically updates last-accessed time for stale resource detection.
   *
   * @param name - Resource name
   * @returns The tracked resource, or undefined if not found
   *
   * @example
   * ```typescript
   * const cache = tracker.getResource('user-cache');
   * if (cache) {
   *   // Use cache...
   * }
   * ```
   */
  public getResource(name: string): EnhancedDisposable | undefined {
    const tracked = this.resources.get(name);
    if (tracked) {
      // Update last accessed time
      tracked.lastAccessedAt = Date.now();
      return tracked.resource;
    }
    return undefined;
  }

  /**
   * Get metadata for a tracked resource.
   *
   * @param name - Resource name
   * @returns Resource metadata, or undefined if not found
   */
  public getMetadata(name: string): Record<string, unknown> | undefined {
    return this.resources.get(name)?.metadata;
  }

  /**
   * Update last-accessed time for a resource.
   *
   * Use when resource is used but not retrieved via getResource().
   *
   * @param name - Resource name
   * @returns true if resource exists and was touched, false otherwise
   *
   * @example
   * ```typescript
   * // Mark resource as recently used
   * tracker.touchResource('user-cache');
   * ```
   */
  public touchResource(name: string): boolean {
    const tracked = this.resources.get(name);
    if (tracked) {
      tracked.lastAccessedAt = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Check if a resource is registered.
   *
   * @param name - Resource name
   * @returns true if resource is registered
   */
  public hasResource(name: string): boolean {
    return this.resources.has(name);
  }

  /**
   * Get all registered resource names.
   *
   * @returns Array of resource names
   */
  public getResourceNames(): string[] {
    return Array.from(this.resources.keys());
  }

  /**
   * Dispose a specific resource and remove from tracking.
   *
   * @param name - Resource name
   * @returns Promise resolving to true if disposed, false if not found
   * @throws Error if disposal fails
   *
   * @example
   * ```typescript
   * // Dispose specific resource
   * await tracker.disposeResource('user-cache');
   * // Resource is disposed and removed from tracking
   * ```
   */
  public async disposeResource(name: string): Promise<boolean> {
    this.ensureNotDisposed('resource disposal');

    const tracked = this.resources.get(name);
    if (!tracked) {
      return false;
    }

    try {
      if (!tracked.resource.isDisposed) {
        await tracked.resource.dispose();
      }
      this.resources.delete(name);
      return true;
    } catch (error) {
      // Re-throw with context
      throw new Error(
        `Failed to dispose resource '${name}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get memory usage statistics.
   *
   * @returns Detailed memory statistics
   *
   * @example
   * ```typescript
   * const stats = tracker.getMemoryStats();
   * console.log(`Active resources: ${stats.activeResources}/${stats.totalResources}`);
   * console.log(`Total memory: ${(stats.totalBytes / 1024 / 1024).toFixed(2)}MB`);
   *
   * // Check per-resource memory
   * Object.entries(stats.byResource).forEach(([name, info]) => {
   *   console.log(`${name}: ${info.bytes} bytes, age: ${info.age}ms`);
   * });
   * ```
   */
  public getMemoryStats(): MemoryStats {
    let totalBytes = 0;
    let disposedCount = 0;
    const byResource: MemoryStats['byResource'] = {};
    const now = Date.now();

    this.resources.forEach((tracked) => {
      const bytes = tracked.estimatedBytes || 0;
      totalBytes += bytes;

      if (tracked.resource.isDisposed) {
        disposedCount++;
      }

      byResource[tracked.name] = {
        bytes,
        disposed: tracked.resource.isDisposed,
        age: now - tracked.registeredAt,
        lastAccessed: now - tracked.lastAccessedAt,
      };
    });

    return {
      totalResources: this.resources.size,
      disposedResources: disposedCount,
      activeResources: this.resources.size - disposedCount,
      totalBytes,
      byResource,
    };
  }

  /**
   * Find stale resources based on last access time.
   *
   * A resource is stale if it hasn't been accessed within the threshold.
   *
   * @param maxIdleTime - Maximum idle time in milliseconds
   * @param includeDisposed - Whether to include already-disposed resources
   * @returns Array of stale resource information
   *
   * @example
   * ```typescript
   * // Find resources idle for >1 hour
   * const stale = tracker.findStaleResources(60 * 60 * 1000);
   * stale.forEach(info => {
   *   console.log(`Stale: ${info.name}, idle: ${info.timeSinceLastAccess}ms`);
   * });
   * ```
   */
  public findStaleResources(
    maxIdleTime: number,
    includeDisposed: boolean = false
  ): StaleResourceInfo[] {
    const now = Date.now();
    const stale: StaleResourceInfo[] = [];

    this.resources.forEach((tracked) => {
      // Skip disposed resources unless explicitly included
      if (tracked.resource.isDisposed && !includeDisposed) {
        return;
      }

      const timeSinceLastAccess = now - tracked.lastAccessedAt;
      if (timeSinceLastAccess > maxIdleTime) {
        stale.push({
          name: tracked.name,
          age: now - tracked.registeredAt,
          timeSinceLastAccess,
          estimatedBytes: tracked.estimatedBytes,
        });
      }
    });

    return stale;
  }

  /**
   * Clean up stale resources by disposing and removing them.
   *
   * Resources that haven't been accessed within maxIdleTime are:
   * 1. Disposed (if not already disposed)
   * 2. Removed from tracking
   *
   * @param maxIdleTime - Maximum idle time in milliseconds
   * @returns Promise resolving to array of cleaned resource info
   * @throws Error if tracker is disposed
   *
   * @example
   * ```typescript
   * // Clean resources idle for >30 minutes
   * const cleaned = await tracker.cleanupStaleResources(30 * 60 * 1000);
   *
   * if (cleaned.length > 0) {
   *   const totalBytes = cleaned.reduce((sum, r) => sum + (r.estimatedBytes || 0), 0);
   *   console.log(`Cleaned ${cleaned.length} resources, freed ${totalBytes} bytes`);
   * }
   * ```
   */
  public async cleanupStaleResources(
    maxIdleTime: number
  ): Promise<StaleResourceInfo[]> {
    this.ensureNotDisposed('stale resource cleanup');

    const stale = this.findStaleResources(maxIdleTime, false);
    const cleaned: StaleResourceInfo[] = [];
    const errors: Error[] = [];

    for (const info of stale) {
      try {
        const success = await this.disposeResource(info.name);
        if (success) {
          cleaned.push(info);
        }
      } catch (error) {
        // Collect errors but continue cleanup
        errors.push(
          error instanceof Error
            ? error
            : new Error(`Failed to cleanup '${info.name}': ${String(error)}`)
        );
      }
    }

    // If any errors occurred, throw aggregate error
    if (errors.length > 0) {
      const errorMessages = errors.map((e) => e.message).join('; ');
      throw new Error(
        `Cleanup completed with ${errors.length} error(s): ${errorMessages}`
      );
    }

    return cleaned;
  }

  /**
   * Remove all disposed resources from tracking.
   *
   * Useful for cleaning up tracking after resources have been
   * disposed externally.
   *
   * @returns Number of disposed resources removed
   */
  public pruneDisposedResources(): number {
    const disposedNames: string[] = [];

    this.resources.forEach((tracked, name) => {
      if (tracked.resource.isDisposed) {
        disposedNames.push(name);
      }
    });

    disposedNames.forEach((name) => this.resources.delete(name));
    return disposedNames.length;
  }

  /**
   * Dispose tracker and all tracked resources.
   *
   * All tracked resources are disposed in parallel.
   * Tracker is marked disposed even if some resources fail.
   *
   * @throws Error if any resources fail to dispose
   */
  protected async onDispose(): Promise<void> {
    const errors: Error[] = [];

    // Dispose all tracked resources in parallel
    const disposalPromises = Array.from(this.resources.values()).map(
      async (tracked) => {
        try {
          if (!tracked.resource.isDisposed) {
            await tracked.resource.dispose();
          }
        } catch (error) {
          errors.push(
            error instanceof Error
              ? error
              : new Error(
                  `Failed to dispose '${tracked.name}': ${String(error)}`
                )
          );
        }
      }
    );

    await Promise.all(disposalPromises);

    // Clear tracking
    this.resources.clear();

    // If any errors occurred, throw aggregate error
    if (errors.length > 0) {
      const errorMessages = errors.map((e) => e.message).join('; ');
      throw new Error(
        `ResourceTracker disposal completed with ${errors.length} error(s): ${errorMessages}`
      );
    }
  }

  /**
   * Get number of tracked resources.
   */
  public get count(): number {
    return this.resources.size;
  }

  /**
   * Get number of active (not disposed) resources.
   */
  public get activeCount(): number {
    return Array.from(this.resources.values()).filter(
      (tracked) => !tracked.resource.isDisposed
    ).length;
  }
}