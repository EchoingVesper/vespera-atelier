/**
 * High-resolution operation timer with RAII-style pattern
 *
 * Automatically tracks timing and memory usage for operations.
 * Constructor starts the timer, end() method records to collector.
 */

import { PerformanceMetrics } from './types.js';
import { MetricsCollector } from './collector.js';

/**
 * RAII-style timer for measuring operation performance
 *
 * @example
 * ```typescript
 * const collector = new MetricsCollector();
 *
 * // Automatic timing
 * const timer = new OperationTimer('file-read', collector);
 * try {
 *   await readFile('data.txt');
 *   timer.end(true); // success
 * } catch (error) {
 *   timer.end(false, 'READ_ERROR');
 * }
 *
 * // With metadata
 * const timer2 = new OperationTimer('db-query', collector, { table: 'users' });
 * const result = await query();
 * timer2.end(true);
 * ```
 */
export class OperationTimer {
  private readonly operationName: string;
  private readonly collector?: MetricsCollector;
  private readonly startTime: number;
  private readonly startMemory?: number;
  private readonly metadata?: Record<string, unknown>;
  private ended = false;

  /**
   * Create and start a new operation timer
   *
   * @param operationName - Name of the operation being measured
   * @param collector - Optional metrics collector to record results to
   * @param metadata - Optional metadata to attach to metrics
   */
  constructor(
    operationName: string,
    collector?: MetricsCollector,
    metadata?: Record<string, unknown>,
  ) {
    this.operationName = operationName;
    this.collector = collector;
    this.metadata = metadata;
    this.startTime = performance.now();
    this.startMemory = this.getMemoryUsage();
  }

  /**
   * End the timer and record metrics
   *
   * @param success - Whether the operation completed successfully
   * @param errorCode - Optional error code if operation failed
   * @param additionalMetadata - Additional metadata to merge with initial metadata
   * @returns The recorded performance metrics
   */
  end(
    success: boolean,
    errorCode?: string,
    additionalMetadata?: Record<string, unknown>,
  ): PerformanceMetrics {
    if (this.ended) {
      throw new Error(
        `Timer for operation '${this.operationName}' has already ended`,
      );
    }

    this.ended = true;
    const endTime = performance.now();
    const duration = endTime - this.startTime;
    const endMemory = this.getMemoryUsage();

    const metrics: PerformanceMetrics = {
      operationName: this.operationName,
      startTime: this.startTime,
      endTime,
      duration,
      success,
      errorCode,
      metadata: {
        ...this.metadata,
        ...additionalMetadata,
      },
    };

    // Calculate memory usage if available
    if (this.startMemory !== undefined && endMemory !== undefined) {
      metrics.memoryUsed = Math.max(0, endMemory - this.startMemory);
    }

    // Record to collector if provided
    if (this.collector) {
      this.collector.recordMetric(metrics);
    }

    return metrics;
  }

  /**
   * Get current memory usage in bytes
   *
   * Uses performance.memory API if available (Chromium-based browsers/Node.js with --expose-gc)
   * Returns undefined if memory tracking is not available
   */
  private getMemoryUsage(): number | undefined {
    // @ts-expect-error - performance.memory is not in standard types but exists in some environments
    if (typeof performance.memory !== 'undefined') {
      // @ts-expect-error - performance.memory is not in standard types
      return performance.memory.usedJSHeapSize as number;
    }

    // Node.js process.memoryUsage() if available
    if (
      typeof process !== 'undefined' &&
      typeof process.memoryUsage === 'function'
    ) {
      return process.memoryUsage().heapUsed;
    }

    return undefined;
  }

  /**
   * Get elapsed time since timer started (without ending the timer)
   *
   * @returns Elapsed time in milliseconds
   */
  elapsed(): number {
    return performance.now() - this.startTime;
  }

  /**
   * Check if timer has been ended
   */
  isEnded(): boolean {
    return this.ended;
  }
}

/**
 * Utility function to time an async operation
 *
 * @example
 * ```typescript
 * const result = await timeOperation(
 *   'api-call',
 *   async () => fetch('https://api.example.com/data'),
 *   collector,
 *   { endpoint: '/data' }
 * );
 * ```
 */
export async function timeOperation<T>(
  operationName: string,
  operation: () => Promise<T>,
  collector?: MetricsCollector,
  metadata?: Record<string, unknown>,
): Promise<T> {
  const timer = new OperationTimer(operationName, collector, metadata);

  try {
    const result = await operation();
    timer.end(true);
    return result;
  } catch (error) {
    const errorCode =
      error instanceof Error ? error.constructor.name : 'UNKNOWN_ERROR';
    timer.end(false, errorCode);
    throw error;
  }
}

/**
 * Utility function to time a synchronous operation
 *
 * @example
 * ```typescript
 * const result = timeOperationSync(
 *   'computation',
 *   () => expensiveCalculation(),
 *   collector
 * );
 * ```
 */
export function timeOperationSync<T>(
  operationName: string,
  operation: () => T,
  collector?: MetricsCollector,
  metadata?: Record<string, unknown>,
): T {
  const timer = new OperationTimer(operationName, collector, metadata);

  try {
    const result = operation();
    timer.end(true);
    return result;
  } catch (error) {
    const errorCode =
      error instanceof Error ? error.constructor.name : 'UNKNOWN_ERROR';
    timer.end(false, errorCode);
    throw error;
  }
}