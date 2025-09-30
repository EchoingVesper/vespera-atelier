/**
 * Performance and diagnostic metrics for operations
 *
 * Converted from Rust PerformanceMetrics in rust-file-ops
 * Tracks timing, memory usage, and success/failure of operations
 */

/**
 * Core performance metrics for a single operation
 *
 * @example
 * ```typescript
 * const metrics: PerformanceMetrics = {
 *   operationName: 'file-read',
 *   startTime: 1234567890.123,
 *   endTime: 1234567891.456,
 *   duration: 1.333,
 *   memoryUsed: 1024,
 *   success: true
 * };
 * ```
 */
export interface PerformanceMetrics {
  /** Name of the operation being measured */
  operationName: string;

  /** Start timestamp (performance.now() in milliseconds) */
  startTime: number;

  /** End timestamp (performance.now() in milliseconds) */
  endTime: number;

  /** Duration in milliseconds */
  duration: number;

  /** Memory used during operation in bytes (if available) */
  memoryUsed?: number;

  /** Whether the operation completed successfully */
  success: boolean;

  /** Error code if operation failed */
  errorCode?: string;

  /** Additional context data */
  metadata?: Record<string, unknown>;
}

/**
 * Aggregated metrics summary for multiple operations
 *
 * @example
 * ```typescript
 * const summary = collector.getSummary('file-read');
 * console.log(`Average: ${summary.averageDuration}ms`);
 * console.log(`Success Rate: ${summary.successRate}%`);
 * ```
 */
export interface MetricsSummary {
  /** Operation name */
  operationName: string;

  /** Total number of operations recorded */
  totalOperations: number;

  /** Number of successful operations */
  successfulOperations: number;

  /** Number of failed operations */
  failedOperations: number;

  /** Success rate as percentage (0-100) */
  successRate: number;

  /** Average duration in milliseconds */
  averageDuration: number;

  /** Minimum duration in milliseconds */
  minDuration: number;

  /** Maximum duration in milliseconds */
  maxDuration: number;

  /** 50th percentile (median) duration in milliseconds */
  p50Duration: number;

  /** 95th percentile duration in milliseconds */
  p95Duration: number;

  /** 99th percentile duration in milliseconds */
  p99Duration: number;

  /** Total memory used across all operations in bytes */
  totalMemoryUsed?: number;

  /** Average memory used per operation in bytes */
  averageMemoryUsed?: number;

  /** Time range of metrics */
  timeRange: {
    start: number;
    end: number;
  };
}

/**
 * Filter criteria for querying metrics
 *
 * @example
 * ```typescript
 * const filter: MetricsFilter = {
 *   operationName: 'file-read',
 *   success: true,
 *   minDuration: 100,
 *   startTime: Date.now() - 3600000 // Last hour
 * };
 * const metrics = collector.getMetrics(filter);
 * ```
 */
export interface MetricsFilter {
  /** Filter by operation name (exact match) */
  operationName?: string;

  /** Filter by operation name pattern (regex) */
  operationNamePattern?: RegExp;

  /** Filter by success status */
  success?: boolean;

  /** Filter by minimum duration (ms) */
  minDuration?: number;

  /** Filter by maximum duration (ms) */
  maxDuration?: number;

  /** Filter by start time (timestamp) */
  startTime?: number;

  /** Filter by end time (timestamp) */
  endTime?: number;

  /** Limit number of results */
  limit?: number;

  /** Metadata filters (AND logic) */
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for metrics collection
 */
export interface MetricsCollectorConfig {
  /** Maximum number of metrics to store in memory */
  maxMetrics?: number;

  /** Automatically clean up old metrics when limit is reached */
  autoCleanup?: boolean;

  /** Maximum age of metrics in milliseconds before cleanup */
  maxAge?: number;

  /** Whether to track memory usage (requires performance.memory API) */
  trackMemory?: boolean;
}

/**
 * Default configuration for metrics collector
 */
export const DEFAULT_METRICS_CONFIG: Required<MetricsCollectorConfig> = {
  maxMetrics: 10000,
  autoCleanup: true,
  maxAge: 3600000, // 1 hour
  trackMemory: true,
};