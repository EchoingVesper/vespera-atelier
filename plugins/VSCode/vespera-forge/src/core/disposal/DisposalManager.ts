/**
 * Vespera Forge - Enhanced Disposal System
 * 
 * Coordinated disposal management with hooks, priorities, and error handling.
 */

import * as vscode from 'vscode';
import { VesperaLogger } from '../logging/VesperaLogger';

export interface EnhancedDisposable {
  dispose(): void | Promise<void>;
  readonly isDisposed: boolean;
  readonly disposalPriority?: number; // Higher numbers disposed first
}

export interface DisposalHook {
  beforeDispose?(): void | Promise<void>;
  afterDispose?(): void | Promise<void>;
  onDisposeError?(error: Error): void | Promise<void>;
}

export interface DisposalResult {
  successful: number;
  failed: number;
  totalTime: number;
  errors: Error[];
}

/**
 * Coordinated disposal manager with hooks, priorities, and comprehensive error handling
 */
export class DisposalManager implements vscode.Disposable {
  private disposed = false;
  private disposables: EnhancedDisposable[] = [];
  private hooks: DisposalHook[] = [];
  private logger: VesperaLogger;
  private disposalStartTime?: number;

  constructor(logger: VesperaLogger) {
    this.logger = logger;
  }

  /**
   * Add a disposable resource to the manager
   */
  public add<T extends EnhancedDisposable>(disposable: T): T {
    if (this.disposed) {
      throw new Error('Cannot add disposables to disposed manager');
    }

    this.disposables.push(disposable);
    this.logger.debug(`Added disposable: ${disposable.constructor.name}`, {
      totalDisposables: this.disposables.length,
      priority: disposable.disposalPriority
    });
    return disposable;
  }

  /**
   * Add multiple disposables at once
   */
  public addAll<T extends EnhancedDisposable>(disposables: T[]): T[] {
    if (this.disposed) {
      throw new Error('Cannot add disposables to disposed manager');
    }

    disposables.forEach(disposable => this.disposables.push(disposable));
    this.logger.debug(`Added ${disposables.length} disposables`, {
      totalDisposables: this.disposables.length
    });
    return disposables;
  }

  /**
   * Add a disposal hook for lifecycle events
   */
  public addHook(hook: DisposalHook): void {
    if (this.disposed) {
      throw new Error('Cannot add hooks to disposed manager');
    }

    this.hooks.push(hook);
    this.logger.debug('Added disposal hook', { totalHooks: this.hooks.length });
  }

  /**
   * Remove a specific disposable (useful for conditional cleanup)
   */
  public remove<T extends EnhancedDisposable>(disposable: T): boolean {
    if (this.disposed) {
      return false;
    }

    const index = this.disposables.indexOf(disposable);
    if (index !== -1) {
      this.disposables.splice(index, 1);
      this.logger.debug(`Removed disposable: ${disposable.constructor.name}`, {
        totalDisposables: this.disposables.length
      });
      return true;
    }
    return false;
  }

  /**
   * Check if a disposable is managed by this manager
   */
  public has<T extends EnhancedDisposable>(disposable: T): boolean {
    return this.disposables.includes(disposable);
  }

  /**
   * Get current statistics about managed resources
   */
  public getStats(): {
    totalDisposables: number;
    disposed: number;
    pending: number;
    priorityDistribution: Record<number, number>;
    hooks: number;
  } {
    const disposed = this.disposables.filter(d => d.isDisposed).length;
    const priorityDistribution: Record<number, number> = {};

    this.disposables.forEach(d => {
      const priority = d.disposalPriority || 0;
      priorityDistribution[priority] = (priorityDistribution[priority] || 0) + 1;
    });

    return {
      totalDisposables: this.disposables.length,
      disposed,
      pending: this.disposables.length - disposed,
      priorityDistribution,
      hooks: this.hooks.length
    };
  }

  /**
   * Dispose all managed resources with comprehensive error handling
   */
  public async dispose(): Promise<DisposalResult> {
    if (this.disposed) {
      return {
        successful: 0,
        failed: 0,
        totalTime: 0,
        errors: []
      };
    }

    this.disposed = true;
    this.disposalStartTime = Date.now();
    const errors: Error[] = [];

    this.logger.info('Starting disposal process', { 
      disposableCount: this.disposables.length,
      hookCount: this.hooks.length 
    });

    // Execute before disposal hooks
    for (const hook of this.hooks) {
      if (hook.beforeDispose) {
        try {
          await hook.beforeDispose();
          this.logger.debug('Before disposal hook executed successfully');
        } catch (error) {
          const hookError = error instanceof Error ? error : new Error(String(error));
          errors.push(hookError);
          this.logger.error('Error in beforeDispose hook', hookError);
          
          if (hook.onDisposeError) {
            try {
              await hook.onDisposeError(hookError);
            } catch (hookErrorHandlerError) {
              this.logger.error('Error in hook error handler', hookErrorHandlerError);
            }
          }
        }
      }
    }

    // Sort disposables by priority (higher priority disposed first)
    const sortedDisposables = [...this.disposables].sort((a, b) => 
      (b.disposalPriority || 0) - (a.disposalPriority || 0)
    );

    this.logger.debug('Disposing resources by priority', {
      priorities: sortedDisposables.map(d => ({ 
        name: d.constructor.name, 
        priority: d.disposalPriority || 0 
      }))
    });

    // Dispose all disposables
    const disposalResults = await Promise.allSettled(
      sortedDisposables.map(async (disposable, index) => {
        try {
          if (!disposable.isDisposed) {
            await disposable.dispose();
            this.logger.debug(`Disposed (${index + 1}/${sortedDisposables.length}): ${disposable.constructor.name}`);
          } else {
            this.logger.debug(`Already disposed: ${disposable.constructor.name}`);
          }
        } catch (error) {
          const disposalError = error instanceof Error ? error : new Error(String(error));
          this.logger.error(`Failed to dispose ${disposable.constructor.name}`, disposalError);
          throw disposalError;
        }
      })
    );

    // Collect disposal failures
    const failures = disposalResults.filter(result => result.status === 'rejected') as PromiseRejectedResult[];
    failures.forEach(failure => {
      if (failure.reason instanceof Error) {
        errors.push(failure.reason);
      } else {
        errors.push(new Error(String(failure.reason)));
      }
    });

    if (failures.length > 0) {
      this.logger.warn(`${failures.length} disposables failed to dispose properly`, {
        totalAttempted: disposalResults.length,
        successful: disposalResults.length - failures.length
      });
    }

    // Execute after disposal hooks
    for (const hook of this.hooks) {
      if (hook.afterDispose) {
        try {
          await hook.afterDispose();
          this.logger.debug('After disposal hook executed successfully');
        } catch (error) {
          const hookError = error instanceof Error ? error : new Error(String(error));
          errors.push(hookError);
          this.logger.error('Error in afterDispose hook', hookError);
          
          if (hook.onDisposeError) {
            try {
              await hook.onDisposeError(hookError);
            } catch (hookErrorHandlerError) {
              this.logger.error('Error in hook error handler', hookErrorHandlerError);
            }
          }
        }
      }
    }

    // Clear references
    this.disposables = [];
    this.hooks = [];

    const totalTime = Date.now() - this.disposalStartTime;
    const result: DisposalResult = {
      successful: disposalResults.length - failures.length,
      failed: failures.length,
      totalTime,
      errors
    };
    
    this.logger.info('Disposal process completed', result);
    return result;
  }

  /**
   * Force dispose a specific resource immediately (bypass normal disposal order)
   */
  public async forceDispose<T extends EnhancedDisposable>(disposable: T): Promise<boolean> {
    if (!this.disposables.includes(disposable)) {
      this.logger.warn(`Attempting to force dispose unmanaged resource: ${disposable.constructor.name}`);
      return false;
    }

    try {
      if (!disposable.isDisposed) {
        await disposable.dispose();
        this.logger.debug(`Force disposed: ${disposable.constructor.name}`);
      }

      // Remove from managed list
      this.remove(disposable);
      return true;
    } catch (error) {
      this.logger.error(`Failed to force dispose ${disposable.constructor.name}`, error);
      return false;
    }
  }

  /**
   * Dispose all resources of a specific priority level
   */
  public async disposePriority(priority: number): Promise<DisposalResult> {
    const targetDisposables = this.disposables.filter(d => (d.disposalPriority || 0) === priority);
    
    if (targetDisposables.length === 0) {
      return {
        successful: 0,
        failed: 0,
        totalTime: 0,
        errors: []
      };
    }

    const startTime = Date.now();
    const errors: Error[] = [];

    this.logger.info(`Disposing ${targetDisposables.length} resources with priority ${priority}`);

    const results = await Promise.allSettled(
      targetDisposables.map(async disposable => {
        try {
          if (!disposable.isDisposed) {
            await disposable.dispose();
            this.logger.debug(`Disposed priority ${priority}: ${disposable.constructor.name}`);
          }
          // Remove from managed list
          this.remove(disposable);
        } catch (error) {
          const disposalError = error instanceof Error ? error : new Error(String(error));
          this.logger.error(`Failed to dispose priority ${priority} resource: ${disposable.constructor.name}`, disposalError);
          throw disposalError;
        }
      })
    );

    const failures = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
    failures.forEach(failure => {
      if (failure.reason instanceof Error) {
        errors.push(failure.reason);
      } else {
        errors.push(new Error(String(failure.reason)));
      }
    });

    const result: DisposalResult = {
      successful: results.length - failures.length,
      failed: failures.length,
      totalTime: Date.now() - startTime,
      errors
    };

    this.logger.info(`Priority ${priority} disposal completed`, result);
    return result;
  }

  public get isDisposed(): boolean {
    return this.disposed;
  }

  public get count(): number {
    return this.disposables.length;
  }
}