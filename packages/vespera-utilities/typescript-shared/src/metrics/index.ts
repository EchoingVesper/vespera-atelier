/**
 * Metrics module for performance monitoring and analysis
 *
 * Provides high-resolution timing, memory tracking, and statistical analysis
 * for operation performance metrics.
 *
 * @example
 * ```typescript
 * import { MetricsCollector, OperationTimer, timeOperation } from '@vespera/typescript-shared/metrics';
 *
 * // Create collector
 * const collector = new MetricsCollector();
 *
 * // Using OperationTimer (RAII-style)
 * const timer = new OperationTimer('file-read', collector);
 * try {
 *   await readFile('data.txt');
 *   timer.end(true);
 * } catch (error) {
 *   timer.end(false, 'READ_ERROR');
 * }
 *
 * // Using timeOperation helper
 * const result = await timeOperation(
 *   'api-call',
 *   async () => fetch('https://api.example.com/data'),
 *   collector
 * );
 *
 * // Get summary statistics
 * const summary = collector.getSummary('file-read');
 * console.log(`Average: ${summary.averageDuration}ms`);
 * console.log(`P95: ${summary.p95Duration}ms`);
 * console.log(`Success Rate: ${summary.successRate}%`);
 * ```
 *
 * @module metrics
 */

// Types
export type {
  PerformanceMetrics,
  MetricsSummary,
  MetricsFilter,
  MetricsCollectorConfig,
} from './types.js';

export { DEFAULT_METRICS_CONFIG } from './types.js';

// Collector
export { MetricsCollector } from './collector.js';

// Timer
export { OperationTimer, timeOperation, timeOperationSync } from './timer.js';

// Aggregator functions
export {
  calculateAverage,
  calculatePercentile,
  calculateMin,
  calculateMax,
  calculateStandardDeviation,
  groupByOperation,
  groupBySuccess,
  groupByTimeWindow,
  summarizeMetrics,
  findOutliers,
  calculateMovingAverage,
} from './aggregator.js';