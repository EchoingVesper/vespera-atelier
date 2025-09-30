/**
 * @fileoverview Core disposable interfaces and base implementation for lifecycle management
 * @module @vespera/typescript-shared/lifecycle
 *
 * Provides enhanced disposable patterns with lifecycle hooks, disposal state tracking,
 * and priority-based cleanup. Based on VS Code extension disposal patterns.
 *
 * @example
 * ```typescript
 * // Create and use a disposable resource
 * const resource = new MyResource();
 *
 * // Use resource...
 *
 * // Dispose when done
 * await resource.dispose();
 * ```
 */

/**
 * Enhanced disposable interface with disposal state tracking and priority support.
 *
 * Extends basic disposal pattern with:
 * - Disposal state flag to prevent double-disposal
 * - Optional priority for coordinated cleanup ordering
 *
 * @interface EnhancedDisposable
 */
export interface EnhancedDisposable {
  /**
   * Dispose the resource and free any held resources.
   * Should be idempotent - safe to call multiple times.
   *
   * @returns Promise that resolves when disposal is complete
   */
  dispose(): void | Promise<void>;

  /**
   * Indicates whether this resource has been disposed.
   * Once true, the resource should not be used.
   */
  readonly isDisposed: boolean;

  /**
   * Optional disposal priority for coordinated cleanup.
   * Higher numbers are disposed first.
   *
   * Typical priorities:
   * - 100+: High priority (UI components, active connections)
   * - 50-99: Medium priority (services, managers)
   * - 0-49: Low priority (caches, background tasks)
   * - undefined/0: Default priority
   */
  readonly disposalPriority?: number;
}

/**
 * Lifecycle hooks for disposal events.
 *
 * Allows observing and reacting to disposal lifecycle:
 * - beforeDispose: Execute before disposal starts
 * - afterDispose: Execute after disposal completes
 * - onDisposeError: Handle errors during disposal
 *
 * @interface DisposalHooks
 *
 * @example
 * ```typescript
 * const hooks: DisposalHooks = {
 *   beforeDispose: async () => {
 *     console.log('Saving state before disposal...');
 *   },
 *   afterDispose: async () => {
 *     console.log('Cleanup complete');
 *   },
 *   onDisposeError: async (error) => {
 *     console.error('Disposal failed:', error);
 *   }
 * };
 * ```
 */
export interface DisposalHooks {
  /**
   * Called before disposal begins.
   * Use for state persistence, logging, or pre-cleanup tasks.
   */
  beforeDispose?(): void | Promise<void>;

  /**
   * Called after disposal completes successfully.
   * Use for final cleanup, notifications, or post-disposal tasks.
   */
  afterDispose?(): void | Promise<void>;

  /**
   * Called when an error occurs during disposal.
   *
   * @param error - The error that occurred during disposal
   */
  onDisposeError?(error: Error): void | Promise<void>;
}

/**
 * Result of a disposal operation with success/failure tracking.
 *
 * @interface DisposalResult
 */
export interface DisposalResult {
  /** Number of resources successfully disposed */
  successful: number;

  /** Number of resources that failed to dispose */
  failed: number;

  /** Total time taken for disposal in milliseconds */
  totalTime: number;

  /** Errors that occurred during disposal */
  errors: Error[];
}

/**
 * Abstract base class for disposable resources with standardized lifecycle management.
 *
 * Provides:
 * - Automatic disposal state tracking
 * - Protection against double-disposal
 * - Disposal-in-progress detection
 * - Resource lifetime tracking
 * - Template method pattern for subclass disposal logic
 *
 * @abstract
 * @class BaseDisposable
 * @implements {EnhancedDisposable}
 *
 * @example
 * ```typescript
 * // Create a disposable resource with medium priority
 * const conn = new DatabaseConnection('connection-string', 50);
 *
 * // Use the resource
 * await conn.query('SELECT * FROM users');
 *
 * // Dispose when done
 * await conn.dispose();
 * ```
 */
export abstract class BaseDisposable implements EnhancedDisposable {
  private _disposed = false;
  private _disposing = false;
  private readonly _createdAt: number;
  public readonly disposalPriority: number;

  /**
   * Creates a new disposable resource.
   *
   * @param disposalPriority - Optional disposal priority (higher = dispose first)
   */
  constructor(disposalPriority: number = 0) {
    this.disposalPriority = disposalPriority;
    this._createdAt = Date.now();
  }

  /**
   * Dispose the resource with error handling and lifecycle management.
   *
   * This method:
   * - Prevents double-disposal
   * - Tracks disposal-in-progress state
   * - Calls template method onDispose()
   * - Ensures resource is marked disposed even on error
   *
   * @returns Promise that resolves when disposal completes
   * @throws Error if disposal fails (after marking resource as disposed)
   */
  public async dispose(): Promise<void> {
    // Idempotent - safe to call multiple times
    if (this._disposed || this._disposing) {
      return;
    }

    this._disposing = true;

    try {
      await this.onDispose();
      this._disposed = true;
    } catch (error) {
      // Mark as disposed even on error to prevent retry loops
      this._disposed = true;
      this._disposing = false;

      // Re-throw for error handling upstream
      throw error instanceof Error
        ? error
        : new Error(`Disposal failed: ${String(error)}`);
    } finally {
      this._disposing = false;
    }
  }

  /**
   * Template method for subclasses to implement disposal logic.
   *
   * Subclasses should override this method to perform cleanup:
   * - Close connections
   * - Release resources
   * - Clear references
   * - Unsubscribe from events
   *
   * @abstract
   * @protected
   * @returns void or Promise<void>
   */
  protected abstract onDispose(): void | Promise<void>;

  /**
   * Check if disposal is currently in progress.
   *
   * @returns true if dispose() is currently executing
   */
  public get isDisposing(): boolean {
    return this._disposing;
  }

  /**
   * Check if resource has been disposed.
   *
   * @returns true if dispose() has been called (successfully or not)
   */
  public get isDisposed(): boolean {
    return this._disposed;
  }

  /**
   * Get resource lifetime in milliseconds.
   *
   * @returns Time elapsed since resource creation
   */
  public get lifetime(): number {
    return Date.now() - this._createdAt;
  }

  /**
   * Get creation timestamp.
   *
   * @returns Unix timestamp when resource was created
   */
  public get createdAt(): number {
    return this._createdAt;
  }

  /**
   * Ensure resource is not disposed before operation.
   *
   * Throws error if resource has been disposed.
   * Use at the start of methods that require active resource.
   *
   * @param operation - Name of operation being attempted (for error message)
   * @throws Error if resource is disposed
   *
   * @example
   * ```typescript
   * public async query(sql: string) {
   *   this.ensureNotDisposed('query');
   *   return await this.connection.execute(sql);
   * }
   * ```
   */
  protected ensureNotDisposed(operation: string = 'operation'): void {
    if (this._disposed) {
      throw new Error(
        `Cannot perform ${operation} on disposed ${this.constructor.name}`
      );
    }
  }
}