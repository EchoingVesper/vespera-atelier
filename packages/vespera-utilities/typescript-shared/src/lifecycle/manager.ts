/**
 * @fileoverview Coordinated disposal management with hooks, priorities, and error handling
 * @module @vespera/typescript-shared/lifecycle
 *
 * Provides centralized management of multiple disposable resources with:
 * - Priority-based disposal ordering
 * - Lifecycle hooks (before/after/error)
 * - Comprehensive error handling
 * - Statistics tracking
 *
 * @example
 * ```typescript
 * const manager = new DisposalManager();
 *
 * const conn1 = manager.add(new DatabaseConnection());
 * const conn2 = manager.add(new CacheService());
 *
 * manager.addHook({
 *   beforeDispose: () => console.log('Shutting down...'),
 *   afterDispose: () => console.log('Cleanup complete')
 * });
 *
 * const result = await manager.dispose();
 * console.log(`Disposed ${result.successful} resources`);
 * ```
 */

import {
  EnhancedDisposable,
  DisposalHooks,
  DisposalResult,
} from './disposable';

/**
 * Statistics about resources managed by DisposalManager.
 *
 * @interface DisposalStats
 */
export interface DisposalStats {
  /** Total number of managed disposables */
  totalDisposables: number;

  /** Number already disposed */
  disposed: number;

  /** Number pending disposal */
  pending: number;

  /** Distribution of resources by priority level */
  priorityDistribution: Record<number, number>;

  /** Number of registered hooks */
  hooks: number;
}

/**
 * Coordinated disposal manager with hooks, priorities, and comprehensive error handling.
 *
 * Manages multiple disposable resources with:
 * - Centralized disposal coordination
 * - Priority-based disposal ordering (higher priority disposed first)
 * - Lifecycle hooks for before/after/error events
 * - Parallel disposal with error isolation
 * - Statistics and monitoring
 *
 * @class DisposalManager
 * @implements {EnhancedDisposable}
 *
 * @example
 * ```typescript
 * // Create manager
 * const manager = new DisposalManager();
 *
 * // Add high-priority resource (UI component)
 * const ui = manager.add(new UIComponent()); // priority: 100
 *
 * // Add medium-priority resource (service)
 * const service = manager.add(new DataService()); // priority: 50
 *
 * // Add hooks for lifecycle events
 * manager.addHook({
 *   beforeDispose: async () => {
 *     await saveState();
 *   },
 *   afterDispose: () => {
 *     console.log('Shutdown complete');
 *   }
 * });
 *
 * // Dispose all resources in priority order (UI first, then service)
 * const result = await manager.dispose();
 * console.log(`Success: ${result.successful}, Failed: ${result.failed}`);
 * ```
 */
export class DisposalManager {
  private _disposed = false;
  private disposables: EnhancedDisposable[] = [];
  private hooks: DisposalHooks[] = [];
  public readonly disposalPriority: number = 0;

  /**
   * Creates a new disposal manager.
   *
   * @param disposalPriority - Optional priority if this manager is itself managed
   */
  constructor(disposalPriority: number = 0) {
    this.disposalPriority = disposalPriority;
  }

  /**
   * Add a disposable resource to the manager.
   *
   * The resource will be disposed when manager.dispose() is called,
   * ordered by its disposalPriority (higher first).
   *
   * @template T - Type of disposable resource
   * @param disposable - Resource to manage
   * @returns The added resource (for chaining)
   * @throws Error if manager is already disposed
   *
   * @example
   * ```typescript
   * const conn = manager.add(new DatabaseConnection());
   * // conn is now managed - will be disposed with manager
   * ```
   */
  public add<T extends EnhancedDisposable>(disposable: T): T {
    if (this._disposed) {
      throw new Error('Cannot add disposables to disposed manager');
    }

    this.disposables.push(disposable);
    return disposable;
  }

  /**
   * Add multiple disposables at once.
   *
   * @template T - Type of disposable resources
   * @param disposables - Array of resources to manage
   * @returns The added resources array (for chaining)
   * @throws Error if manager is already disposed
   *
   * @example
   * ```typescript
   * const [conn1, conn2, conn3] = manager.addAll([
   *   new DatabaseConnection(),
   *   new CacheService(),
   *   new LogService()
   * ]);
   * ```
   */
  public addAll<T extends EnhancedDisposable>(disposables: T[]): T[] {
    if (this._disposed) {
      throw new Error('Cannot add disposables to disposed manager');
    }

    disposables.forEach((disposable) => this.disposables.push(disposable));
    return disposables;
  }

  /**
   * Add a disposal hook for lifecycle events.
   *
   * Hooks are called in registration order:
   * - beforeDispose: Before any resources are disposed
   * - afterDispose: After all resources are disposed
   * - onDisposeError: When any error occurs during disposal
   *
   * @param hook - Lifecycle hooks to register
   * @throws Error if manager is already disposed
   *
   * @example
   * ```typescript
   * manager.addHook({
   *   beforeDispose: async () => {
   *     await saveState();
   *   },
   *   afterDispose: () => {
   *     console.log('All resources cleaned up');
   *   },
   *   onDisposeError: (error) => {
   *     logError('Disposal failed', error);
   *   }
   * });
   * ```
   */
  public addHook(hook: DisposalHooks): void {
    if (this._disposed) {
      throw new Error('Cannot add hooks to disposed manager');
    }

    this.hooks.push(hook);
  }

  /**
   * Remove a specific disposable from management.
   *
   * Useful for conditional cleanup or early disposal of specific resources.
   *
   * @template T - Type of disposable resource
   * @param disposable - Resource to remove
   * @returns true if resource was found and removed, false otherwise
   *
   * @example
   * ```typescript
   * const cache = manager.add(new CacheService());
   * // Later, dispose cache early and remove from manager
   * await cache.dispose();
   * manager.remove(cache); // No longer managed
   * ```
   */
  public remove<T extends EnhancedDisposable>(disposable: T): boolean {
    if (this._disposed) {
      return false;
    }

    const index = this.disposables.indexOf(disposable);
    if (index !== -1) {
      this.disposables.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Check if a disposable is managed by this manager.
   *
   * @template T - Type of disposable resource
   * @param disposable - Resource to check
   * @returns true if resource is currently managed
   */
  public has<T extends EnhancedDisposable>(disposable: T): boolean {
    return this.disposables.includes(disposable);
  }

  /**
   * Get current statistics about managed resources.
   *
   * @returns Statistics object with counts and distributions
   *
   * @example
   * ```typescript
   * const stats = manager.getStats();
   * console.log(`Managing ${stats.totalDisposables} resources`);
   * console.log(`Priority distribution:`, stats.priorityDistribution);
   * // { 100: 2, 50: 5, 0: 3 } - 2 high-priority, 5 medium, 3 default
   * ```
   */
  public getStats(): DisposalStats {
    const disposed = this.disposables.filter((d) => d.isDisposed).length;
    const priorityDistribution: Record<number, number> = {};

    this.disposables.forEach((d) => {
      const priority = d.disposalPriority || 0;
      priorityDistribution[priority] = (priorityDistribution[priority] || 0) + 1;
    });

    return {
      totalDisposables: this.disposables.length,
      disposed,
      pending: this.disposables.length - disposed,
      priorityDistribution,
      hooks: this.hooks.length,
    };
  }

  /**
   * Dispose all managed resources with comprehensive error handling.
   *
   * Disposal process:
   * 1. Execute all beforeDispose hooks
   * 2. Sort resources by priority (higher first)
   * 3. Dispose all resources in parallel (errors isolated)
   * 4. Execute all afterDispose hooks
   * 5. Return detailed result
   *
   * Resources are disposed in priority order but execution is parallel
   * within each priority group for performance. Errors in one resource
   * don't prevent disposal of others.
   *
   * @returns Promise resolving to detailed disposal result
   *
   * @example
   * ```typescript
   * const result = await manager.dispose();
   *
   * if (result.failed > 0) {
   *   console.error(`Failed to dispose ${result.failed} resources`);
   *   result.errors.forEach(err => console.error(err));
   * }
   *
   * console.log(`Disposed ${result.successful} resources in ${result.totalTime}ms`);
   * ```
   */
  public async dispose(): Promise<DisposalResult> {
    // Idempotent - return empty result if already disposed
    if (this._disposed) {
      return {
        successful: 0,
        failed: 0,
        totalTime: 0,
        errors: [],
      };
    }

    this._disposed = true;
    const startTime = Date.now();
    const errors: Error[] = [];

    // Execute before disposal hooks
    for (const hook of this.hooks) {
      if (hook.beforeDispose) {
        try {
          await hook.beforeDispose();
        } catch (error) {
          const hookError =
            error instanceof Error ? error : new Error(String(error));
          errors.push(hookError);

          if (hook.onDisposeError) {
            try {
              await hook.onDisposeError(hookError);
            } catch (hookErrorHandlerError) {
              // Silently ignore errors in error handlers
            }
          }
        }
      }
    }

    // Sort disposables by priority (higher priority disposed first)
    const sortedDisposables = [...this.disposables].sort(
      (a, b) => (b.disposalPriority || 0) - (a.disposalPriority || 0)
    );

    // Dispose all disposables in parallel with error isolation
    const disposalResults = await Promise.allSettled(
      sortedDisposables.map(async (disposable) => {
        if (!disposable.isDisposed) {
          await disposable.dispose();
        }
      })
    );

    // Collect disposal failures
    const failures = disposalResults.filter(
      (result) => result.status === 'rejected'
    ) as PromiseRejectedResult[];

    failures.forEach((failure) => {
      const error =
        failure.reason instanceof Error
          ? failure.reason
          : new Error(String(failure.reason));
      errors.push(error);
    });

    // Execute after disposal hooks
    for (const hook of this.hooks) {
      if (hook.afterDispose) {
        try {
          await hook.afterDispose();
        } catch (error) {
          const hookError =
            error instanceof Error ? error : new Error(String(error));
          errors.push(hookError);

          if (hook.onDisposeError) {
            try {
              await hook.onDisposeError(hookError);
            } catch (hookErrorHandlerError) {
              // Silently ignore errors in error handlers
            }
          }
        }
      }
    }

    // Clear references
    this.disposables = [];
    this.hooks = [];

    const totalTime = Date.now() - startTime;
    return {
      successful: disposalResults.length - failures.length,
      failed: failures.length,
      totalTime,
      errors,
    };
  }

  /**
   * Force dispose a specific resource immediately.
   *
   * Bypasses normal disposal order and removes from manager.
   * Useful for early cleanup of specific resources.
   *
   * @template T - Type of disposable resource
   * @param disposable - Resource to force dispose
   * @returns Promise resolving to true if successful, false otherwise
   *
   * @example
   * ```typescript
   * const cache = manager.add(new CacheService());
   * // Later, need to dispose cache immediately
   * const success = await manager.forceDispose(cache);
   * // cache is disposed and removed from manager
   * ```
   */
  public async forceDispose<T extends EnhancedDisposable>(
    disposable: T
  ): Promise<boolean> {
    if (!this.disposables.includes(disposable)) {
      return false;
    }

    try {
      if (!disposable.isDisposed) {
        await disposable.dispose();
      }

      // Remove from managed list
      this.remove(disposable);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Dispose all resources of a specific priority level.
   *
   * Useful for staged shutdown (e.g., dispose UI first, then services).
   *
   * @param priority - Priority level to dispose
   * @returns Promise resolving to disposal result for that priority
   *
   * @example
   * ```typescript
   * // Dispose high-priority resources (UI components) first
   * await manager.disposePriority(100);
   *
   * // Then dispose medium-priority resources (services)
   * await manager.disposePriority(50);
   *
   * // Finally dispose remaining resources
   * await manager.dispose();
   * ```
   */
  public async disposePriority(priority: number): Promise<DisposalResult> {
    const targetDisposables = this.disposables.filter(
      (d) => (d.disposalPriority || 0) === priority
    );

    if (targetDisposables.length === 0) {
      return {
        successful: 0,
        failed: 0,
        totalTime: 0,
        errors: [],
      };
    }

    const startTime = Date.now();
    const errors: Error[] = [];

    const results = await Promise.allSettled(
      targetDisposables.map(async (disposable) => {
        if (!disposable.isDisposed) {
          await disposable.dispose();
        }
        // Remove from managed list
        this.remove(disposable);
      })
    );

    const failures = results.filter(
      (r) => r.status === 'rejected'
    ) as PromiseRejectedResult[];

    failures.forEach((failure) => {
      const error =
        failure.reason instanceof Error
          ? failure.reason
          : new Error(String(failure.reason));
      errors.push(error);
    });

    return {
      successful: results.length - failures.length,
      failed: failures.length,
      totalTime: Date.now() - startTime,
      errors,
    };
  }

  /**
   * Check if manager has been disposed.
   */
  public get isDisposed(): boolean {
    return this._disposed;
  }

  /**
   * Get number of managed disposables.
   */
  public get count(): number {
    return this.disposables.length;
  }
}