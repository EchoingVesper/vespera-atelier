/**
 * Comprehensive example of the metrics module
 *
 * Demonstrates high-resolution timing, memory tracking, and metric analysis
 */

import {
  MetricsCollector,
  OperationTimer,
  timeOperation,
  timeOperationSync,
  calculatePercentile,
  findOutliers,
  groupByOperation,
} from '../src/metrics/index.js';

// Create a metrics collector
const collector = new MetricsCollector({
  maxMetrics: 1000,
  autoCleanup: true,
  maxAge: 3600000, // 1 hour
  trackMemory: true,
});

/**
 * Example 1: RAII-style timing with OperationTimer
 */
async function example1_RAIIStyleTiming() {
  console.log('\n=== Example 1: RAII-Style Timing ===');

  // Simulate file read operation
  const timer = new OperationTimer('file-read', collector, { path: 'data.txt' });

  // Simulate some work
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));

  // Check elapsed time without ending
  console.log(`Elapsed so far: ${timer.elapsed().toFixed(2)}ms`);

  // Simulate more work
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 50));

  // End the timer and record metric
  const metric = timer.end(true);
  console.log(`Operation completed in ${metric.duration.toFixed(2)}ms`);
  if (metric.memoryUsed !== undefined) {
    console.log(`Memory used: ${metric.memoryUsed} bytes`);
  }
}

/**
 * Example 2: Using timeOperation helper for async operations
 */
async function example2_TimeOperationHelper() {
  console.log('\n=== Example 2: Time Operation Helper ===');

  // Simulate API call
  const result = await timeOperation(
    'api-call',
    async () => {
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 150));
      return { data: 'API response', status: 200 };
    },
    collector,
    { endpoint: '/users', method: 'GET' },
  );

  console.log('API call result:', result);
}

/**
 * Example 3: Using timeOperationSync for synchronous operations
 */
function example3_SynchronousOperation() {
  console.log('\n=== Example 3: Synchronous Operation ===');

  const result = timeOperationSync(
    'computation',
    () => {
      // Simulate expensive computation
      let sum = 0;
      for (let i = 0; i < 1000000; i++) {
        sum += Math.sqrt(i);
      }
      return sum;
    },
    collector,
  );

  console.log(`Computation result: ${result}`);
}

/**
 * Example 4: Manual timing with startOperation
 */
async function example4_ManualTiming() {
  console.log('\n=== Example 4: Manual Timing ===');

  const endTimer = collector.startOperation('database-query', { table: 'users' });

  try {
    // Simulate database query
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 200));

    // Success
    const metric = endTimer(true);
    console.log(`Query completed in ${metric.duration.toFixed(2)}ms`);
  } catch (error) {
    // Error
    endTimer(false, 'DB_ERROR');
    throw error;
  }
}

/**
 * Example 5: Recording multiple operations and analyzing metrics
 */
async function example5_MultipleOperations() {
  console.log('\n=== Example 5: Multiple Operations ===');

  // Record various file operations
  for (let i = 0; i < 20; i++) {
    await timeOperation(
      'file-read',
      async () => {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.random() * 100),
        );
      },
      collector,
      { size: Math.floor(Math.random() * 10000) },
    );
  }

  // Record some write operations
  for (let i = 0; i < 15; i++) {
    await timeOperation(
      'file-write',
      async () => {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.random() * 150),
        );
      },
      collector,
      { size: Math.floor(Math.random() * 20000) },
    );
  }

  // Simulate some failures
  for (let i = 0; i < 5; i++) {
    const timer = new OperationTimer('file-read', collector);
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 50));
    timer.end(false, 'ENOENT');
  }

  console.log(`Total metrics collected: ${collector.size()}`);
}

/**
 * Example 6: Querying and filtering metrics
 */
function example6_QueryingMetrics() {
  console.log('\n=== Example 6: Querying Metrics ===');

  // Get all file-read metrics
  const readMetrics = collector.getMetrics({ operationName: 'file-read' });
  console.log(`File read operations: ${readMetrics.length}`);

  // Get only successful operations
  const successfulReads = collector.getMetrics({
    operationName: 'file-read',
    success: true,
  });
  console.log(`Successful reads: ${successfulReads.length}`);

  // Get slow operations (> 50ms)
  const slowOps = collector.getMetrics({ minDuration: 50 });
  console.log(`Slow operations (>50ms): ${slowOps.length}`);

  // Get operations matching pattern
  const fileOps = collector.getMetrics({
    operationNamePattern: /^file-/,
  });
  console.log(`File operations: ${fileOps.length}`);

  // Get most recent 10 operations
  const recent = collector.getMetrics({ limit: 10 });
  console.log(`Most recent 10 operations:`, recent.map((m) => m.operationName));
}

/**
 * Example 7: Summary statistics
 */
function example7_SummaryStatistics() {
  console.log('\n=== Example 7: Summary Statistics ===');

  // Get summary for file-read operations
  const readSummary = collector.getSummary('file-read');
  console.log('\nFile Read Summary:');
  console.log(`  Total Operations: ${readSummary.totalOperations}`);
  console.log(`  Success Rate: ${readSummary.successRate.toFixed(2)}%`);
  console.log(`  Average Duration: ${readSummary.averageDuration.toFixed(2)}ms`);
  console.log(`  Min Duration: ${readSummary.minDuration.toFixed(2)}ms`);
  console.log(`  Max Duration: ${readSummary.maxDuration.toFixed(2)}ms`);
  console.log(`  P50 (Median): ${readSummary.p50Duration.toFixed(2)}ms`);
  console.log(`  P95: ${readSummary.p95Duration.toFixed(2)}ms`);
  console.log(`  P99: ${readSummary.p99Duration.toFixed(2)}ms`);

  // Get summaries for all operations
  console.log('\nAll Operation Summaries:');
  const allSummaries = collector.getAllSummaries();
  Array.from(allSummaries.entries()).forEach(([operation, summary]) => {
    console.log(
      `  ${operation}: ${summary.averageDuration.toFixed(2)}ms avg, ${summary.successRate.toFixed(2)}% success`,
    );
  });
}

/**
 * Example 8: Advanced analysis - finding outliers
 */
function example8_OutlierDetection() {
  console.log('\n=== Example 8: Outlier Detection ===');

  const readMetrics = collector.getMetrics({ operationName: 'file-read' });

  // Find outlier operations (statistical anomalies)
  const outliers = findOutliers(readMetrics);
  console.log(`Found ${outliers.length} outlier operations`);

  if (outliers.length > 0) {
    console.log('Outlier durations:');
    outliers.forEach((metric) => {
      console.log(
        `  ${metric.duration.toFixed(2)}ms (${metric.success ? 'success' : 'failed'})`,
      );
    });
  }
}

/**
 * Example 9: Grouping and aggregation
 */
function example9_GroupingMetrics() {
  console.log('\n=== Example 9: Grouping Metrics ===');

  // Group all metrics by operation
  const allMetrics = collector.getMetrics();
  const grouped = groupByOperation(allMetrics);

  console.log('Operations by frequency:');
  const sorted = Array.from(grouped.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5);

  sorted.forEach(([operation, metrics]) => {
    const durations = metrics.map((m) => m.duration);
    const avg =
      durations.reduce((sum, d) => sum + d, 0) / durations.length;
    console.log(
      `  ${operation}: ${metrics.length} ops, ${avg.toFixed(2)}ms avg`,
    );
  });
}

/**
 * Example 10: Percentile analysis
 */
function example10_PercentileAnalysis() {
  console.log('\n=== Example 10: Percentile Analysis ===');

  const readMetrics = collector.getMetrics({ operationName: 'file-read' });
  const durations = readMetrics.map((m) => m.duration);

  console.log('Duration distribution:');
  const percentiles = [10, 25, 50, 75, 90, 95, 99];
  percentiles.forEach((p) => {
    const value = calculatePercentile(durations, p);
    console.log(`  P${p}: ${value.toFixed(2)}ms`);
  });
}

/**
 * Example 11: Export and import metrics
 */
function example11_ExportImport() {
  console.log('\n=== Example 11: Export/Import ===');

  // Export all file-read metrics to JSON
  const json = collector.exportJSON({ operationName: 'file-read' });
  console.log(`Exported JSON length: ${json.length} characters`);

  // Create new collector and import
  const newCollector = new MetricsCollector();
  newCollector.importJSON(json);
  console.log(`Imported ${newCollector.size()} metrics`);
}

/**
 * Example 12: Real-time monitoring simulation
 */
async function example12_RealTimeMonitoring() {
  console.log('\n=== Example 12: Real-Time Monitoring ===');

  console.log('Simulating real-time operations...');

  // Simulate operations for 2 seconds
  const startTime = Date.now();
  let operationCount = 0;

  const interval = setInterval(() => {
    // Random operation
    const operations = ['file-read', 'file-write', 'api-call'];
    const operation =
      operations[Math.floor(Math.random() * operations.length)];

    timeOperation(
      operation,
      async () => {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.random() * 50),
        );
      },
      collector,
    );

    operationCount++;
  }, 50);

  // Wait 2 seconds
  await new Promise((resolve) => setTimeout(resolve, 2000));
  clearInterval(interval);

  const elapsed = Date.now() - startTime;
  console.log(
    `Processed ${operationCount} operations in ${elapsed}ms (${(operationCount / (elapsed / 1000)).toFixed(2)} ops/sec)`,
  );

  // Show current stats
  const summaries = collector.getAllSummaries();
  console.log('\nCurrent operation statistics:');
  Array.from(summaries.entries()).forEach(([operation, summary]) => {
    console.log(
      `  ${operation}: ${summary.totalOperations} ops, ${summary.averageDuration.toFixed(2)}ms avg`,
    );
  });
}

/**
 * Run all examples
 */
async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║        Metrics Module - Comprehensive Example Suite          ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  await example1_RAIIStyleTiming();
  await example2_TimeOperationHelper();
  example3_SynchronousOperation();
  await example4_ManualTiming();
  await example5_MultipleOperations();
  example6_QueryingMetrics();
  example7_SummaryStatistics();
  example8_OutlierDetection();
  example9_GroupingMetrics();
  example10_PercentileAnalysis();
  example11_ExportImport();
  await example12_RealTimeMonitoring();

  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                    All Examples Complete                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`\nFinal metrics count: ${collector.size()}`);
  console.log(`Operations tracked: ${collector.getOperationNames().join(', ')}`);
}

// Run examples if this file is executed directly
// Note: Uncomment the following line to run examples
// main().catch(console.error);

export { main };