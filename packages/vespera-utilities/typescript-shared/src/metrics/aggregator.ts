/**
 * Metric aggregation and statistical analysis functions
 *
 * Provides utilities for calculating averages, percentiles, and grouping metrics
 */

import { PerformanceMetrics, MetricsSummary } from './types.js';

/**
 * Calculate average of an array of numbers
 *
 * @param values - Array of numeric values
 * @returns Average value, or 0 if array is empty
 */
export function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Calculate a specific percentile from an array of numbers
 *
 * @param values - Array of numeric values (will be sorted internally)
 * @param percentile - Percentile to calculate (0-100)
 * @returns Percentile value, or 0 if array is empty
 *
 * @example
 * ```typescript
 * const durations = [10, 20, 30, 40, 50];
 * const p95 = calculatePercentile(durations, 95); // 48
 * const median = calculatePercentile(durations, 50); // 30
 * ```
 */
export function calculatePercentile(
  values: number[],
  percentile: number,
): number {
  if (values.length === 0) return 0;
  if (percentile < 0 || percentile > 100) {
    throw new Error('Percentile must be between 0 and 100');
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) {
    return sorted[lower];
  }

  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Calculate minimum value from array
 */
export function calculateMin(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.min(...values);
}

/**
 * Calculate maximum value from array
 */
export function calculateMax(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values);
}

/**
 * Calculate standard deviation
 *
 * @param values - Array of numeric values
 * @returns Standard deviation, or 0 if array is empty
 */
export function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;

  const avg = calculateAverage(values);
  const squareDiffs = values.map((value) => Math.pow(value - avg, 2));
  const avgSquareDiff = calculateAverage(squareDiffs);

  return Math.sqrt(avgSquareDiff);
}

/**
 * Group metrics by operation name
 *
 * @param metrics - Array of performance metrics
 * @returns Map of operation name to array of metrics
 *
 * @example
 * ```typescript
 * const metrics = collector.getMetrics();
 * const grouped = groupByOperation(metrics);
 *
 * for (const [operation, opMetrics] of grouped.entries()) {
 *   console.log(`${operation}: ${opMetrics.length} operations`);
 * }
 * ```
 */
export function groupByOperation(
  metrics: PerformanceMetrics[],
): Map<string, PerformanceMetrics[]> {
  const grouped = new Map<string, PerformanceMetrics[]>();

  for (const metric of metrics) {
    const existing = grouped.get(metric.operationName) ?? [];
    existing.push(metric);
    grouped.set(metric.operationName, existing);
  }

  return grouped;
}

/**
 * Group metrics by success status
 *
 * @param metrics - Array of performance metrics
 * @returns Object with successful and failed metrics
 */
export function groupBySuccess(metrics: PerformanceMetrics[]): {
  successful: PerformanceMetrics[];
  failed: PerformanceMetrics[];
} {
  const successful: PerformanceMetrics[] = [];
  const failed: PerformanceMetrics[] = [];

  for (const metric of metrics) {
    if (metric.success) {
      successful.push(metric);
    } else {
      failed.push(metric);
    }
  }

  return { successful, failed };
}

/**
 * Group metrics by time window
 *
 * @param metrics - Array of performance metrics
 * @param windowSizeMs - Size of time window in milliseconds
 * @returns Map of window start time to metrics in that window
 *
 * @example
 * ```typescript
 * const metrics = collector.getMetrics();
 * // Group into 5-minute windows
 * const windows = groupByTimeWindow(metrics, 5 * 60 * 1000);
 * ```
 */
export function groupByTimeWindow(
  metrics: PerformanceMetrics[],
  windowSizeMs: number,
): Map<number, PerformanceMetrics[]> {
  const windows = new Map<number, PerformanceMetrics[]>();

  for (const metric of metrics) {
    const windowStart = Math.floor(metric.startTime / windowSizeMs) * windowSizeMs;
    const existing = windows.get(windowStart) ?? [];
    existing.push(metric);
    windows.set(windowStart, existing);
  }

  return windows;
}

/**
 * Calculate summary statistics for an array of metrics
 *
 * @param operationName - Name of the operation
 * @param metrics - Array of performance metrics for this operation
 * @returns Summary statistics
 *
 * @example
 * ```typescript
 * const metrics = collector.getMetrics({ operationName: 'file-read' });
 * const summary = summarizeMetrics('file-read', metrics);
 * console.log(`Average duration: ${summary.averageDuration}ms`);
 * console.log(`Success rate: ${summary.successRate}%`);
 * ```
 */
export function summarizeMetrics(
  operationName: string,
  metrics: PerformanceMetrics[],
): MetricsSummary {
  if (metrics.length === 0) {
    return {
      operationName,
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      successRate: 0,
      averageDuration: 0,
      minDuration: 0,
      maxDuration: 0,
      p50Duration: 0,
      p95Duration: 0,
      p99Duration: 0,
      timeRange: { start: 0, end: 0 },
    };
  }

  const durations = metrics.map((m) => m.duration);
  const memoryValues = metrics
    .filter((m) => m.memoryUsed !== undefined)
    .map((m) => m.memoryUsed!);

  const successfulOps = metrics.filter((m) => m.success).length;
  const failedOps = metrics.length - successfulOps;

  const startTimes = metrics.map((m) => m.startTime);
  const endTimes = metrics.map((m) => m.endTime);

  return {
    operationName,
    totalOperations: metrics.length,
    successfulOperations: successfulOps,
    failedOperations: failedOps,
    successRate: (successfulOps / metrics.length) * 100,
    averageDuration: calculateAverage(durations),
    minDuration: calculateMin(durations),
    maxDuration: calculateMax(durations),
    p50Duration: calculatePercentile(durations, 50),
    p95Duration: calculatePercentile(durations, 95),
    p99Duration: calculatePercentile(durations, 99),
    totalMemoryUsed:
      memoryValues.length > 0
        ? memoryValues.reduce((acc, val) => acc + val, 0)
        : undefined,
    averageMemoryUsed:
      memoryValues.length > 0 ? calculateAverage(memoryValues) : undefined,
    timeRange: {
      start: calculateMin(startTimes),
      end: calculateMax(endTimes),
    },
  };
}

/**
 * Find outliers in metrics using IQR (Interquartile Range) method
 *
 * @param metrics - Array of performance metrics
 * @param multiplier - IQR multiplier for outlier detection (default: 1.5)
 * @returns Array of metrics that are statistical outliers
 *
 * @example
 * ```typescript
 * const metrics = collector.getMetrics({ operationName: 'api-call' });
 * const outliers = findOutliers(metrics);
 * console.log(`Found ${outliers.length} outlier operations`);
 * ```
 */
export function findOutliers(
  metrics: PerformanceMetrics[],
  multiplier = 1.5,
): PerformanceMetrics[] {
  if (metrics.length < 4) return []; // Need at least 4 points for IQR

  const durations = metrics.map((m) => m.duration);
  const q1 = calculatePercentile(durations, 25);
  const q3 = calculatePercentile(durations, 75);
  const iqr = q3 - q1;

  const lowerBound = q1 - multiplier * iqr;
  const upperBound = q3 + multiplier * iqr;

  return metrics.filter(
    (m) => m.duration < lowerBound || m.duration > upperBound,
  );
}

/**
 * Calculate moving average over a window of metrics
 *
 * @param values - Array of numeric values
 * @param windowSize - Size of moving average window
 * @returns Array of moving averages
 *
 * @example
 * ```typescript
 * const durations = metrics.map(m => m.duration);
 * const smoothed = calculateMovingAverage(durations, 5);
 * ```
 */
export function calculateMovingAverage(
  values: number[],
  windowSize: number,
): number[] {
  if (windowSize <= 0) {
    throw new Error('Window size must be positive');
  }

  const result: number[] = [];

  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = values.slice(start, i + 1);
    result.push(calculateAverage(window));
  }

  return result;
}