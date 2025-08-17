# Basic Memory Monitoring

## Current State

Currently, the Vespera Scriptorium plugin doesn't appear to have any memory monitoring in place. This makes it difficult to detect when memory usage is becoming problematic and take preventive actions.

## Implementation

We'll create a `MemoryMonitor` class to track memory usage during document processing:

```typescript
/**
 * Class for monitoring memory usage during document processing
 */
class MemoryMonitor {
  private initialMemory: number;
  private memoryCheckpoints: Map<string, number>;
  private memoryThreshold: number;
  private warningThreshold: number;
  
  /**
   * Creates a new MemoryMonitor instance
   * @param memoryThreshold - Maximum memory usage in MB before operations are restricted
   * @param warningThreshold - Memory usage in MB at which warnings are issued
   */
  constructor(memoryThreshold = 2048, warningThreshold = 1536) {
    this.initialMemory = this.getCurrentMemoryUsage();
    this.memoryCheckpoints = new Map<string, number>();
    this.memoryThreshold = memoryThreshold;
    this.warningThreshold = warningThreshold;
    
    // Store initial memory usage
    this.addCheckpoint('initial');
  }
  
  /**
   * Gets the current memory usage in MB
   * @returns Current memory usage in MB
   */
  getCurrentMemoryUsage(): number {
    // Use performance.memory if available (Chrome)
    if (performance && 'memory' in performance) {
      // @ts-ignore - TypeScript doesn't know about performance.memory
      return Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
    }
    
    // Fallback for other browsers/environments
    if (process && process.memoryUsage) {
      const { heapUsed } = process.memoryUsage();
      return Math.round(heapUsed / (1024 * 1024));
    }
    
    // If we can't get memory usage, return a default value
    console.warn('Unable to determine memory usage');
    return 0;
  }
  
  /**
   * Adds a memory usage checkpoint with the given label
   * @param label - Label for the checkpoint
   * @returns Current memory usage in MB
   */
  addCheckpoint(label: string): number {
    const memory = this.getCurrentMemoryUsage();
    this.memoryCheckpoints.set(label, memory);
    console.debug(`Memory checkpoint "${label}": ${memory} MB`);
    return memory;
  }
  
  /**
   * Gets the difference in memory usage between two checkpoints
   * @param from - Starting checkpoint label
   * @param to - Ending checkpoint label
   * @returns Memory difference in MB
   */
  getDifference(from: string, to: string): number {
    const fromMemory = this.memoryCheckpoints.get(from);
    const toMemory = this.memoryCheckpoints.get(to);
    
    if (fromMemory === undefined || toMemory === undefined) {
      console.warn(`Cannot calculate memory difference: checkpoints "${from}" or "${to}" not found`);
      return 0;
    }
    
    return toMemory - fromMemory;
  }
  
  /**
   * Checks if memory usage exceeds the warning threshold
   * @returns True if memory usage exceeds the warning threshold
   */
  isApproachingLimit(): boolean {
    const currentMemory = this.getCurrentMemoryUsage();
    return currentMemory >= this.warningThreshold;
  }
  
  /**
   * Checks if memory usage exceeds the maximum threshold
   * @returns True if memory usage exceeds the maximum threshold
   */
  isOverLimit(): boolean {
    const currentMemory = this.getCurrentMemoryUsage();
    return currentMemory >= this.memoryThreshold;
  }
  
  /**
   * Gets a summary of memory usage during the current session
   * @returns Summary object with initial, current, and peak memory usage
   */
  getMemorySummary() {
    const currentMemory = this.getCurrentMemoryUsage();
    const peakMemory = Math.max(...Array.from(this.memoryCheckpoints.values()));
    
    return {
      initial: this.initialMemory,
      current: currentMemory,
      peak: peakMemory,
      change: currentMemory - this.initialMemory,
      isWarning: this.isApproachingLimit(),
      isCritical: this.isOverLimit()
    };
  }
  
  /**
   * Clears all checkpoints except the initial one
   */
  clearCheckpoints(): void {
    const initialMemory = this.memoryCheckpoints.get('initial');
    this.memoryCheckpoints.clear();
    if (initialMemory !== undefined) {
      this.memoryCheckpoints.set('initial', initialMemory);
    }
  }
}
```

## Usage in the Plugin

To use this class in the plugin:

1. Create a new file `src/utils/MemoryMonitor.ts` with the above class implementation
2. Import and instantiate the class in the main plugin file:

```typescript
import { MemoryMonitor } from './utils/MemoryMonitor';

// In the plugin class constructor or onload method
this.memoryMonitor = new MemoryMonitor();
```

3. Add memory checkpoints around critical operations:

```typescript
// Before processing chunks
this.memoryMonitor.addCheckpoint('before-processing');

// Process chunks
const result = await this.processChunks(chunks);

// After processing chunks
this.memoryMonitor.addCheckpoint('after-processing');
const memoryUsed = this.memoryMonitor.getDifference('before-processing', 'after-processing');
console.info(`Memory used during processing: ${memoryUsed} MB`);
```

4. Check for memory issues before operations:

```typescript
// Before starting a memory-intensive operation
if (this.memoryMonitor.isOverLimit()) {
  // Show error to user
  new Notice('Cannot process document: Memory usage too high. Please restart Obsidian.');
  return;
}

if (this.memoryMonitor.isApproachingLimit()) {
  // Show warning to user
  new Notice('Warning: Memory usage is high. Consider saving your work and restarting Obsidian.');
}

// Proceed with operation
```

## Browser Compatibility Considerations

The memory monitoring functionality uses browser-specific APIs that may not be available in all environments. The implementation includes fallbacks, but it's important to test in the Obsidian environment to ensure it works as expected.

## Next Steps

After implementing the basic memory monitoring, we'll need to:

1. Set appropriate thresholds based on testing
2. Add memory checks to key processing functions
3. Test thoroughly with various document sizes

## Return to [Memory Limits](./README.md)
