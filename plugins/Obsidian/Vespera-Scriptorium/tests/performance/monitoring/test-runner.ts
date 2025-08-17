/**
 * Performance test configuration and utilities
 */

export interface PerformanceTestConfig {
  messageCount: number;
  warmupCount: number;
  concurrentConnections: number;
  testDuration: number;
  memoryProfileInterval: number;
  throughputThresholds: {
    baseline: number;
    withMonitoring: number;
    maxOverheadPercent: number;
  };
}

export const defaultPerfConfig: PerformanceTestConfig = {
  messageCount: 1000,
  warmupCount: 100,
  concurrentConnections: 10,
  testDuration: 30000, // 30 seconds
  memoryProfileInterval: 100, // 100ms
  throughputThresholds: {
    baseline: 100, // minimum 100 msg/s baseline
    withMonitoring: 50, // minimum 50 msg/s with monitoring
    maxOverheadPercent: 50 // max 50% overhead from monitoring
  }
};

export class PerformanceTestRunner {
  constructor(private config: PerformanceTestConfig = defaultPerfConfig) {}

  async runThroughputTest(
    testFn: () => Promise<void>,
    messageCount: number = this.config.messageCount
  ): Promise<{ throughput: number; duration: number }> {
    const startTime = performance.now();
    await testFn();
    const endTime = performance.now();
    
    const duration = endTime - startTime;
    const throughput = messageCount / (duration / 1000);
    
    return { throughput, duration };
  }

  calculateOverhead(baseline: number, monitored: number): number {
    return ((baseline - monitored) / baseline) * 100;
  }

  validateThresholds(results: {
    baseline: number;
    monitored: number;
  }): { passed: boolean; overhead: number; issues: string[] } {
    const issues: string[] = [];
    const overhead = this.calculateOverhead(results.baseline, results.monitored);
    
    if (results.baseline < this.config.throughputThresholds.baseline) {
      issues.push(`Baseline throughput too low: ${results.baseline} < ${this.config.throughputThresholds.baseline}`);
    }
    
    if (results.monitored < this.config.throughputThresholds.withMonitoring) {
      issues.push(`Monitored throughput too low: ${results.monitored} < ${this.config.throughputThresholds.withMonitoring}`);
    }
    
    if (overhead > this.config.throughputThresholds.maxOverheadPercent) {
      issues.push(`Monitoring overhead too high: ${overhead.toFixed(1)}% > ${this.config.throughputThresholds.maxOverheadPercent}%`);
    }
    
    return {
      passed: issues.length === 0,
      overhead,
      issues
    };
  }
}
