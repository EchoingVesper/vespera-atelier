/**
 * Memory usage profiler for monitoring components
 */

// Define a type that matches NodeJS.MemoryUsage but is more flexible
type MemoryUsageInfo = {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
};

export class MemoryProfiler {
  private samples: Array<{timestamp: number, usage: MemoryUsageInfo}> = [];
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;

  startProfiling(sampleInterval: number = 1000): void {
    this.samples = [];
    this.isRunning = true;
    
    // Safely get memory usage
    const getMemoryUsage = (): MemoryUsageInfo => {
      try {
        return process.memoryUsage();
      } catch (e) {
        // Fallback for environments where process.memoryUsage might not be available
        return {
          rss: 0,
          heapTotal: 0,
          heapUsed: 0,
          external: 0,
          arrayBuffers: 0
        };
      }
    };
    
    // Take initial sample
    this.samples.push({
      timestamp: Date.now(),
      usage: getMemoryUsage()
    });
    
    this.interval = setInterval(() => {
      if (!this.isRunning) return;
      
      this.samples.push({
        timestamp: Date.now(),
        usage: getMemoryUsage()
      });
    }, sampleInterval);
  }

  stopProfiling(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getReport(): {
    peak: MemoryUsageInfo;
    average: MemoryUsageInfo;
    trend: 'increasing' | 'decreasing' | 'stable';
    samples: number;
  } {
    if (this.samples.length === 0) {
      throw new Error('No memory samples collected');
    }

    // Find the sample with the highest heap usage
    const peakSample = this.samples.reduce((maxSample, currentSample) => 
      currentSample.usage.heapUsed > maxSample.usage.heapUsed ? currentSample : maxSample
    );
    
    const peak = peakSample.usage;

    const average = {
      rss: this.samples.reduce((sum, s) => sum + s.usage.rss, 0) / this.samples.length,
      heapTotal: this.samples.reduce((sum, s) => sum + s.usage.heapTotal, 0) / this.samples.length,
      heapUsed: this.samples.reduce((sum, s) => sum + s.usage.heapUsed, 0) / this.samples.length,
      external: this.samples.reduce((sum, s) => sum + s.usage.external, 0) / this.samples.length,
      arrayBuffers: this.samples.reduce((sum, s) => sum + s.usage.arrayBuffers, 0) / this.samples.length
    };

    // Simple trend analysis
    const midpoint = Math.floor(this.samples.length / 2);
    const firstHalf = this.samples.slice(0, midpoint);
    const secondHalf = this.samples.slice(midpoint);
    
    const firstAvg = firstHalf.reduce((sum, s) => sum + s.usage.heapUsed, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, s) => sum + s.usage.heapUsed, 0) / secondHalf.length;
    
    const trend = secondAvg > firstAvg * 1.1 ? 'increasing' : 
                  secondAvg < firstAvg * 0.9 ? 'decreasing' : 'stable';

    return { peak, average, trend, samples: this.samples.length };
  }
}
