/**
 * Memory usage tests for monitoring components
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { metricsCollector } from '../../../src/core/messaging/metricsCollector';
import { healthMonitor } from '../../../src/core/messaging/healthMonitor';
import { alertManager } from '../../../src/core/messaging/alertManager';
import { MemoryProfiler } from './memory-profiler';
import { MetricType } from '../../../src/core/messaging/metricsCollector';

describe('Memory Usage Tests', () => {
  let profiler: MemoryProfiler;

  beforeEach(() => {
    profiler = new MemoryProfiler();
    // Clear all monitoring data
    metricsCollector.clearMetrics();
  });

  afterEach(() => {
    profiler.stopProfiling();
    metricsCollector.stopTimers();
    healthMonitor.stopReporting();
    alertManager.stopChecking();
  });

  it('should not leak memory during high-frequency metric recording', async () => {
    // Set up fake timers to better control timing in the test environment
    vi.useFakeTimers();
    
    try {
      // Start profiling with a smaller sample size for test efficiency
      profiler.startProfiling(50); // Sample every 50ms
      
      // Record metrics in smaller batches to avoid test timeouts
      const TOTAL_METRICS = 5000;
      const BATCH_SIZE = 500;
      
      for (let batch = 0; batch < TOTAL_METRICS / BATCH_SIZE; batch++) {
        for (let i = 0; i < BATCH_SIZE; i++) {
          const metricIndex = batch * BATCH_SIZE + i;
          metricsCollector.recordMetric(MetricType.MESSAGES_SENT, 1, {
            iteration: metricIndex.toString(),
            batch: batch.toString()
          });
        }
        
        // Advance timers and allow for async operations to complete
        vi.advanceTimersByTime(10);
        await vi.runOnlyPendingTimersAsync();
      }
      
      // Allow some time for cleanup and final profiling samples
      vi.advanceTimersByTime(500);
      await vi.runOnlyPendingTimersAsync();
      
      // Stop profiling and get the report
      profiler.stopProfiling();
      const report = profiler.getReport();
      
      console.log('Memory report:', {
        peak: Math.round(report.peak.heapUsed / 1024 / 1024) + 'MB',
        average: Math.round(report.average.heapUsed / 1024 / 1024) + 'MB',
        trend: report.trend,
        samples: report.samples
      });
      
      // Memory trend should not be consistently increasing
      expect(['stable', 'decreasing']).toContain(report.trend);
      
      // Peak memory usage should be reasonable (less than 100MB for this test)
      expect(report.peak.heapUsed).toBeLessThan(100 * 1024 * 1024);
    } finally {
      // Always restore real timers, even if the test fails
      vi.useRealTimers();
    }
  });
});
