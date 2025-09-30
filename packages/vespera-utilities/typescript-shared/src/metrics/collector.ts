/**
 * Metrics collector with in-memory storage and automatic cleanup
 *
 * Provides storage and retrieval of performance metrics with size limits
 * and automatic cleanup of old metrics.
 */

import {
  PerformanceMetrics,
  MetricsFilter,
  MetricsSummary,
  MetricsCollectorConfig,
  DEFAULT_METRICS_CONFIG,
} from './types.js';
import { summarizeMetrics, groupByOperation } from './aggregator.js';

/**
 * In-memory metrics collector with automatic cleanup
 *
 * @example
 * ```typescript
 * // Create collector with default config
 * const collector = new MetricsCollector();
 *
 * // Record a metric
 * collector.recordMetric({
 *   operationName: 'file-read',
 *   startTime: 1000,
 *   endTime: 1100,
 *   duration: 100,
 *   success: true
 * });
 *
 * // Get metrics for an operation
 * const metrics = collector.getMetrics({ operationName: 'file-read' });
 *
 * // Get summary statistics
 * const summary = collector.getSummary('file-read');
 * console.log(`Average: ${summary.averageDuration}ms`);
 * ```
 */
export class MetricsCollector {
  private metrics: PerformanceMetrics[] = [];
  private readonly config: Required<MetricsCollectorConfig>;

  /**
   * Create a new metrics collector
   *
   * @param config - Optional configuration
   */
  constructor(config?: MetricsCollectorConfig) {
    this.config = { ...DEFAULT_METRICS_CONFIG, ...config };
  }

  /**
   * Record a performance metric
   *
   * Automatically triggers cleanup if storage limit is reached
   *
   * @param metric - The performance metric to record
   */
  recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);

    if (this.config.autoCleanup && this.metrics.length > this.config.maxMetrics) {
      this.cleanup();
    }
  }

  /**
   * Get all metrics matching the filter criteria
   *
   * @param filter - Optional filter criteria
   * @returns Array of matching metrics
   *
   * @example
   * ```typescript
   * // Get all metrics for an operation
   * const metrics = collector.getMetrics({ operationName: 'file-read' });
   *
   * // Get failed operations only
   * const failed = collector.getMetrics({ success: false });
   *
   * // Get slow operations (> 100ms)
   * const slow = collector.getMetrics({ minDuration: 100 });
   *
   * // Get recent metrics with limit
   * const recent = collector.getMetrics({ limit: 10 });
   * ```
   */
  getMetrics(filter?: MetricsFilter): PerformanceMetrics[] {
    let filtered = [...this.metrics];

    if (!filter) {
      return filtered;
    }

    // Filter by operation name (exact match)
    if (filter.operationName) {
      filtered = filtered.filter((m) => m.operationName === filter.operationName);
    }

    // Filter by operation name pattern (regex)
    if (filter.operationNamePattern) {
      filtered = filtered.filter((m) =>
        filter.operationNamePattern!.test(m.operationName),
      );
    }

    // Filter by success status
    if (filter.success !== undefined) {
      filtered = filtered.filter((m) => m.success === filter.success);
    }

    // Filter by duration range
    if (filter.minDuration !== undefined) {
      filtered = filtered.filter((m) => m.duration >= filter.minDuration!);
    }

    if (filter.maxDuration !== undefined) {
      filtered = filtered.filter((m) => m.duration <= filter.maxDuration!);
    }

    // Filter by time range
    if (filter.startTime !== undefined) {
      filtered = filtered.filter((m) => m.startTime >= filter.startTime!);
    }

    if (filter.endTime !== undefined) {
      filtered = filtered.filter((m) => m.endTime <= filter.endTime!);
    }

    // Filter by metadata (AND logic)
    if (filter.metadata) {
      filtered = filtered.filter((m) => {
        if (!m.metadata) return false;

        return Object.entries(filter.metadata!).every(
          ([key, value]) => m.metadata![key] === value,
        );
      });
    }

    // Apply limit
    if (filter.limit !== undefined && filter.limit > 0) {
      filtered = filtered.slice(-filter.limit); // Get most recent N metrics
    }

    return filtered;
  }

  /**
   * Get summary statistics for a specific operation
   *
   * @param operationName - Name of the operation to summarize
   * @param filter - Optional additional filter criteria
   * @returns Summary statistics
   *
   * @example
   * ```typescript
   * const summary = collector.getSummary('file-read');
   * console.log(`Operations: ${summary.totalOperations}`);
   * console.log(`Average: ${summary.averageDuration}ms`);
   * console.log(`P95: ${summary.p95Duration}ms`);
   * console.log(`Success Rate: ${summary.successRate}%`);
   * ```
   */
  getSummary(
    operationName: string,
    filter?: Omit<MetricsFilter, 'operationName'>,
  ): MetricsSummary {
    const metrics = this.getMetrics({
      ...filter,
      operationName,
    });

    return summarizeMetrics(operationName, metrics);
  }

  /**
   * Get summaries for all operations
   *
   * @returns Map of operation name to summary statistics
   *
   * @example
   * ```typescript
   * const summaries = collector.getAllSummaries();
   *
   * for (const [operation, summary] of summaries.entries()) {
   *   console.log(`${operation}: ${summary.averageDuration}ms avg`);
   * }
   * ```
   */
  getAllSummaries(): Map<string, MetricsSummary> {
    const grouped = groupByOperation(this.metrics);
    const summaries = new Map<string, MetricsSummary>();

    Array.from(grouped.entries()).forEach(([operationName, metrics]) => {
      summaries.set(operationName, summarizeMetrics(operationName, metrics));
    });

    return summaries;
  }

  /**
   * Start timing an operation
   *
   * Returns a function to end the timer and record the metric
   *
   * @param operationName - Name of the operation
   * @param metadata - Optional metadata
   * @returns Function to end the timer
   *
   * @example
   * ```typescript
   * const endTimer = collector.startOperation('file-read', { path: 'data.txt' });
   *
   * try {
   *   await readFile('data.txt');
   *   endTimer(true);
   * } catch (error) {
   *   endTimer(false, 'READ_ERROR');
   * }
   * ```
   */
  startOperation(
    operationName: string,
    metadata?: Record<string, unknown>,
  ): (success: boolean, errorCode?: string) => PerformanceMetrics {
    const startTime = performance.now();
    const startMemory = this.getMemoryUsage();

    return (success: boolean, errorCode?: string): PerformanceMetrics => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      const endMemory = this.getMemoryUsage();

      const metric: PerformanceMetrics = {
        operationName,
        startTime,
        endTime,
        duration,
        success,
        errorCode,
        metadata,
      };

      // Calculate memory usage if available
      if (startMemory !== undefined && endMemory !== undefined) {
        metric.memoryUsed = Math.max(0, endMemory - startMemory);
      }

      this.recordMetric(metric);
      return metric;
    };
  }

  /**
   * Clear all stored metrics
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Get the total number of stored metrics
   */
  size(): number {
    return this.metrics.length;
  }

  /**
   * Get the list of unique operation names
   */
  getOperationNames(): string[] {
    const names = new Set(this.metrics.map((m) => m.operationName));
    return Array.from(names).sort();
  }

  /**
   * Remove metrics older than maxAge or exceeding maxMetrics limit
   *
   * Automatically called when autoCleanup is enabled
   */
  private cleanup(): void {
    const now = performance.now();
    const cutoffTime = now - this.config.maxAge;

    // Remove old metrics
    this.metrics = this.metrics.filter((m) => m.startTime >= cutoffTime);

    // If still over limit, remove oldest metrics
    if (this.metrics.length > this.config.maxMetrics) {
      const excess = this.metrics.length - this.config.maxMetrics;
      this.metrics = this.metrics.slice(excess);
    }
  }

  /**
   * Get current memory usage in bytes
   *
   * Uses performance.memory API if available (Chromium-based browsers/Node.js with --expose-gc)
   * Returns undefined if memory tracking is not available or disabled
   */
  private getMemoryUsage(): number | undefined {
    if (!this.config.trackMemory) {
      return undefined;
    }

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
   * Export metrics as JSON
   *
   * @param filter - Optional filter to export subset of metrics
   * @returns JSON string of metrics
   */
  exportJSON(filter?: MetricsFilter): string {
    const metrics = this.getMetrics(filter);
    return JSON.stringify(metrics, null, 2);
  }

  /**
   * Import metrics from JSON
   *
   * @param json - JSON string of metrics array
   */
  importJSON(json: string): void {
    const imported = JSON.parse(json) as PerformanceMetrics[];
    for (const metric of imported) {
      this.recordMetric(metric);
    }
  }
}