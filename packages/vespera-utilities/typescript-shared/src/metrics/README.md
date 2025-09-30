# Metrics Module

High-resolution performance monitoring and analysis for TypeScript applications.

Converted from Rust `PerformanceMetrics` implementation in `rust-file-ops`.

## Features

- **High-Resolution Timing**: Uses `performance.now()` for microsecond precision
- **Memory Tracking**: Tracks heap usage using `performance.memory` (when available)
- **RAII-Style Timers**: Automatic timing with `OperationTimer` class
- **Flexible Aggregation**: Statistical analysis with percentiles, averages, and outlier detection
- **Size-Limited Storage**: Automatic cleanup of old metrics
- **Zero Dependencies**: Pure TypeScript implementation

## Quick Start

```typescript
import { MetricsCollector, OperationTimer, timeOperation } from '@vespera/typescript-shared/metrics';

// Create collector
const collector = new MetricsCollector();

// Method 1: RAII-style timer
const timer = new OperationTimer('file-read', collector);
try {
  await readFile('data.txt');
  timer.end(true); // success
} catch (error) {
  timer.end(false, 'READ_ERROR');
}

// Method 2: Async helper function
const result = await timeOperation(
  'api-call',
  async () => fetch('https://api.example.com/data'),
  collector,
  { endpoint: '/data' }
);

// Method 3: Manual timing with startOperation
const endTimer = collector.startOperation('database-query', { table: 'users' });
const rows = await db.query('SELECT * FROM users');
endTimer(true);

// Get summary statistics
const summary = collector.getSummary('file-read');
console.log(`Average: ${summary.averageDuration}ms`);
console.log(`P95: ${summary.p95Duration}ms`);
console.log(`Success Rate: ${summary.successRate}%`);
```

## Core Components

### MetricsCollector

In-memory storage and retrieval of performance metrics with automatic cleanup.

```typescript
const collector = new MetricsCollector({
  maxMetrics: 10000,      // Maximum metrics to store
  autoCleanup: true,      // Auto-cleanup when limit reached
  maxAge: 3600000,        // Max age in ms (1 hour)
  trackMemory: true       // Track memory usage
});

// Record metric manually
collector.recordMetric({
  operationName: 'computation',
  startTime: 1000,
  endTime: 1100,
  duration: 100,
  success: true,
  memoryUsed: 1024
});

// Query metrics
const metrics = collector.getMetrics({
  operationName: 'file-read',
  success: true,
  minDuration: 100,
  limit: 10
});

// Get all operation summaries
const summaries = collector.getAllSummaries();
for (const [operation, summary] of summaries.entries()) {
  console.log(`${operation}: ${summary.averageDuration}ms avg`);
}
```

### OperationTimer

RAII-style timer that automatically tracks timing and memory usage.

```typescript
// Basic usage
const timer = new OperationTimer('operation-name', collector);
performOperation();
timer.end(true);

// With metadata
const timer = new OperationTimer('api-call', collector, {
  endpoint: '/users',
  method: 'GET'
});
const response = await fetch('/users');
timer.end(response.ok, response.ok ? undefined : 'HTTP_ERROR');

// Check elapsed time without ending
console.log(`Elapsed: ${timer.elapsed()}ms`);
```

### Aggregator Functions

Statistical analysis functions for metric aggregation.

```typescript
import {
  calculateAverage,
  calculatePercentile,
  findOutliers,
  groupByOperation,
  summarizeMetrics
} from '@vespera/typescript-shared/metrics';

const metrics = collector.getMetrics({ operationName: 'api-call' });
const durations = metrics.map(m => m.duration);

// Basic statistics
const avg = calculateAverage(durations);
const p50 = calculatePercentile(durations, 50); // median
const p95 = calculatePercentile(durations, 95);
const p99 = calculatePercentile(durations, 99);

// Find slow operations
const outliers = findOutliers(metrics);
console.log(`Found ${outliers.length} outlier operations`);

// Group by operation
const grouped = groupByOperation(collector.getMetrics());
for (const [operation, opMetrics] of grouped.entries()) {
  const summary = summarizeMetrics(operation, opMetrics);
  console.log(`${operation}:`, summary);
}
```

## Advanced Usage

### Filtering Metrics

```typescript
// Filter by duration range
const slow = collector.getMetrics({
  minDuration: 100,
  maxDuration: 1000
});

// Filter by time range
const recent = collector.getMetrics({
  startTime: Date.now() - 3600000, // Last hour
  limit: 100
});

// Filter by regex pattern
const fileOps = collector.getMetrics({
  operationNamePattern: /^file-/
});

// Filter by metadata
const userQueries = collector.getMetrics({
  operationName: 'db-query',
  metadata: { table: 'users' }
});
```

### Time Window Analysis

```typescript
import { groupByTimeWindow } from '@vespera/typescript-shared/metrics';

const metrics = collector.getMetrics();

// Group into 5-minute windows
const windows = groupByTimeWindow(metrics, 5 * 60 * 1000);

for (const [windowStart, windowMetrics] of windows.entries()) {
  const avg = calculateAverage(windowMetrics.map(m => m.duration));
  console.log(`Window ${new Date(windowStart)}: ${avg}ms avg`);
}
```

### Exporting and Importing Metrics

```typescript
// Export to JSON
const json = collector.exportJSON({ operationName: 'api-call' });
await fs.writeFile('metrics.json', json);

// Import from JSON
const json = await fs.readFile('metrics.json', 'utf-8');
collector.importJSON(json);
```

### Moving Average Smoothing

```typescript
import { calculateMovingAverage } from '@vespera/typescript-shared/metrics';

const durations = metrics.map(m => m.duration);
const smoothed = calculateMovingAverage(durations, 10); // 10-point moving average
```

## Real-World Examples

### API Endpoint Monitoring

```typescript
const collector = new MetricsCollector();

app.use(async (req, res, next) => {
  const timer = new OperationTimer(
    `api-${req.method}-${req.path}`,
    collector,
    { method: req.method, path: req.path }
  );

  res.on('finish', () => {
    timer.end(res.statusCode < 400, res.statusCode >= 400 ? `HTTP_${res.statusCode}` : undefined);
  });

  next();
});

// Periodically log summary
setInterval(() => {
  const summaries = collector.getAllSummaries();
  for (const [endpoint, summary] of summaries.entries()) {
    console.log(`${endpoint}: ${summary.averageDuration}ms avg, ${summary.successRate}% success`);
  }
}, 60000); // Every minute
```

### Database Query Profiling

```typescript
class Database {
  constructor(private collector: MetricsCollector) {}

  async query<T>(sql: string, params?: any[]): Promise<T[]> {
    return timeOperation(
      'db-query',
      async () => {
        // Execute query
        return await this.executeQuery(sql, params);
      },
      this.collector,
      { sql: sql.substring(0, 100) } // First 100 chars
    );
  }

  getSlowQueries(threshold: number = 100): PerformanceMetrics[] {
    return this.collector.getMetrics({
      operationName: 'db-query',
      minDuration: threshold
    });
  }
}
```

### File Operations Monitoring

```typescript
class FileService {
  constructor(private collector: MetricsCollector) {}

  async readFile(path: string): Promise<string> {
    const timer = new OperationTimer('file-read', this.collector, { path });

    try {
      const content = await fs.readFile(path, 'utf-8');
      timer.end(true);
      return content;
    } catch (error) {
      timer.end(false, error instanceof Error ? error.code : 'UNKNOWN');
      throw error;
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    return timeOperation(
      'file-write',
      async () => fs.writeFile(path, content),
      this.collector,
      { path, size: content.length }
    );
  }

  getFileOpStats() {
    return {
      reads: this.collector.getSummary('file-read'),
      writes: this.collector.getSummary('file-write')
    };
  }
}
```

## Memory Tracking

Memory tracking is automatically enabled when `performance.memory` is available (Chromium-based browsers, Node.js with `--expose-gc`).

```typescript
const collector = new MetricsCollector({ trackMemory: true });

const timer = new OperationTimer('memory-intensive', collector);
const data = new Array(1000000).fill(0);
timer.end(true);

const metrics = collector.getMetrics({ operationName: 'memory-intensive' });
console.log(`Memory used: ${metrics[0].memoryUsed} bytes`);
```

## Performance Considerations

- **Storage Limit**: Default limit is 10,000 metrics. Adjust based on your needs.
- **Auto Cleanup**: Automatically removes old metrics when limit is reached.
- **Memory Overhead**: Each metric takes ~200-300 bytes of memory.
- **Timing Precision**: `performance.now()` provides microsecond precision.

## API Reference

See TypeScript definitions for complete API documentation with JSDoc comments.

## License

Part of Vespera Atelier - AGPL-3.0