# Implementing Memory Checks

## Introduction

Now that we have implemented memory monitoring and established thresholds, we need to integrate memory checks into the document processing workflow. This will allow the plugin to avoid operations that would cause memory issues and provide appropriate feedback to users.

## Key Processing Functions to Update

Based on the logs, the following functions should be updated to include memory checks:

1. `processChunksWithLLM` - The main function that processes chunks with the LLM
2. `assembleDocument` - The function that assembles the processed chunks into a final document
3. Any other memory-intensive operations in the processing pipeline

## Memory Check Implementation

### 1. Add Memory Checks to processChunksWithLLM

```typescript
/**
 * Process document chunks with the LLM, with memory monitoring
 * @param chunks - Array of document chunks to process
 * @param options - Processing options
 * @returns Processed document
 */
async processChunksWithLLM(chunks: Chunk[], options: ProcessingOptions): Promise<ProcessedDocument> {
  // Memory check before starting
  if (!this.memoryMonitor.canProcessChunks(chunks.length)) {
    // Notify user and abort
    new Notice('Cannot process document: Memory usage too high. Try processing a smaller document or restart Obsidian.');
    throw new Error('Memory limit exceeded before processing');
  }
  
  // Record starting memory
  this.memoryMonitor.addCheckpoint('process-start');
  
  // Process chunks with periodic memory checks
  const processedChunks: ProcessedChunk[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    // Check memory before processing each chunk
    if (this.memoryMonitor.isOverLimit()) {
      // Save progress and abort
      new Notice(`Processing aborted after ${i} chunks due to high memory usage. Partial results saved.`);
      break;
    }
    
    // Process chunk with the LLM
    this.memoryMonitor.addCheckpoint(`chunk-start-${i}`);
    
    try {
      const processedChunk = await this.processChunk(chunks[i], options);
      processedChunks.push(processedChunk);
      
      // Check memory after processing
      this.memoryMonitor.addCheckpoint(`chunk-end-${i}`);
      const chunkMemoryUsage = this.memoryMonitor.getDifference(`chunk-start-${i}`, `chunk-end-${i}`);
      
      // If this chunk used too much memory, warn for future chunks
      if (chunkMemoryUsage > this.memoryMonitor.perChunkLimit) {
        console.warn(`Chunk ${i} used ${chunkMemoryUsage}MB of memory, which exceeds the per-chunk limit of ${this.memoryMonitor.perChunkLimit}MB`);
      }
      
      // Free up memory where possible
      this.memoryMonitor.clearCheckpoints([`chunk-start-${i}`, `chunk-end-${i}`]);
      
    } catch (error) {
      console.error(`Error processing chunk ${i}:`, error);
      
      // Record the failure and continue with next chunk
      this.failedChunks.push({
        chunkId: chunks[i].id,
        error: error.message
      });
    }
    
    // Optional: Add a small delay to allow garbage collection
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Final memory usage report
  this.memoryMonitor.addCheckpoint('process-end');
  const totalMemoryUsed = this.memoryMonitor.getDifference('process-start', 'process-end');
  console.info(`Total memory used during processing: ${totalMemoryUsed}MB`);
  
  // Assemble document if we have processed chunks
  if (processedChunks.length > 0) {
    try {
      return this.assembleDocument(processedChunks, options);
    } catch (error) {
      console.error('Error assembling document:', error);
      throw error;
    }
  } else {
    throw new Error('No chunks were successfully processed');
  }
}
```

### 2. Add Memory Checks to assembleDocument

```typescript
/**
 * Assemble processed chunks into a final document, with memory monitoring
 * @param processedChunks - Array of processed chunks
 * @param options - Assembly options
 * @returns Assembled document
 */
assembleDocument(processedChunks: ProcessedChunk[], options: AssemblyOptions): ProcessedDocument {
  // Memory check before starting
  if (!this.memoryMonitor.canAssembleDocument(processedChunks.length)) {
    // Notify user and abort
    new Notice('Cannot assemble document: Memory usage too high. Try processing a smaller document or restart Obsidian.');
    throw new Error('Memory limit exceeded before assembly');
  }
  
  // Record starting memory
  this.memoryMonitor.addCheckpoint('assembly-start');
  
  try {
    // Sort chunks by position to ensure correct order
    const sortedChunks = this.sortChunksByPosition(processedChunks);
    
    // Memory check after sorting (sorting can be memory intensive)
    if (this.memoryMonitor.isOverLimit()) {
      throw new Error('Memory limit exceeded during chunk sorting');
    }
    
    // Assemble the document
    // ... existing assembly logic ...
    
    // Record final memory
    this.memoryMonitor.addCheckpoint('assembly-end');
    const assemblyMemoryUsed = this.memoryMonitor.getDifference('assembly-start', 'assembly-end');
    console.info(`Memory used during assembly: ${assemblyMemoryUsed}MB`);
    
    return assembledDocument;
  } catch (error) {
    console.error('Error during document assembly:', error);
    
    // Try to free memory
    this.memoryMonitor.clearCheckpoints();
    
    throw error;
  }
}
```

### 3. Add Helper Methods to MemoryMonitor

```typescript
/**
 * Checks if the plugin can process the given number of chunks
 * @param chunkCount - Number of chunks to process
 * @returns True if processing can proceed
 */
canProcessChunks(chunkCount: number): boolean {
  if (!this.enabled) return true;
  
  // Estimate memory needed based on chunk count
  const estimatedMemoryPerChunk = this.perChunkLimit;
  const estimatedTotalMemory = chunkCount * estimatedMemoryPerChunk;
  
  // Get current memory usage
  const currentMemory = this.getCurrentMemoryUsage();
  const projectedMemory = currentMemory + estimatedTotalMemory;
  
  // Check if projected memory exceeds threshold
  if (projectedMemory > this.criticalThreshold) {
    console.warn(`Estimated memory usage for ${chunkCount} chunks exceeds limit: ${projectedMemory}MB > ${this.criticalThreshold}MB`);
    return false;
  }
  
  // If approaching limit, warn but allow
  if (projectedMemory > this.warningThreshold) {
    console.warn(`Estimated memory usage approaching limit: ${projectedMemory}MB > ${this.warningThreshold}MB`);
  }
  
  return true;
}

/**
 * Checks if document assembly can proceed
 * @param chunkCount - Number of chunks to assemble
 * @returns True if assembly can proceed
 */
canAssembleDocument(chunkCount: number): boolean {
  if (!this.enabled) return true;
  
  // Assembly typically uses less memory per chunk than processing
  const estimatedMemoryForAssembly = chunkCount * (this.perChunkLimit / 2);
  
  // Get current memory usage
  const currentMemory = this.getCurrentMemoryUsage();
  const projectedMemory = currentMemory + estimatedMemoryForAssembly;
  
  // Check if projected memory exceeds threshold
  if (projectedMemory > this.criticalThreshold) {
    console.warn(`Estimated memory usage for document assembly exceeds limit: ${projectedMemory}MB > ${this.criticalThreshold}MB`);
    return false;
  }
  
  // If approaching limit, warn but allow
  if (projectedMemory > this.warningThreshold) {
    console.warn(`Estimated memory usage for document assembly approaching limit: ${projectedMemory}MB > ${this.warningThreshold}MB`);
  }
  
  return true;
}

/**
 * Clears specific checkpoints or all if none specified
 * @param checkpointsToKeep - Array of checkpoint labels to keep
 */
clearCheckpoints(checkpointsToKeep: string[] = ['initial']): void {
  // Get the values of the checkpoints to keep
  const keepValues = new Map<string, number>();
  
  checkpointsToKeep.forEach(label => {
    const value = this.memoryCheckpoints.get(label);
    if (value !== undefined) {
      keepValues.set(label, value);
    }
  });
  
  // Clear all checkpoints
  this.memoryCheckpoints.clear();
  
  // Restore the ones to keep
  keepValues.forEach((value, label) => {
    this.memoryCheckpoints.set(label, value);
  });
}
```

### 4. Update the UI Modal for Feedback

Add feedback to the UI modal to inform users about memory usage:

```typescript
/**
 * Updates the modal with memory usage information
 * @param modal - The modal element to update
 * @param currentChunk - The current chunk being processed
 * @param totalChunks - The total number of chunks
 */
updateModalWithMemoryInfo(modal: HTMLElement, currentChunk: number, totalChunks: number): void {
  const memoryInfo = this.memoryMonitor.getMemorySummary();
  
  // Find or create the memory info container
  let memoryInfoEl = modal.querySelector('.memory-info');
  if (!memoryInfoEl) {
    memoryInfoEl = modal.createEl('div', { cls: 'memory-info' });
  }
  
  // Update the content
  let memoryStatusClass = 'memory-normal';
  if (memoryInfo.isCritical) {
    memoryStatusClass = 'memory-critical';
  } else if (memoryInfo.isWarning) {
    memoryStatusClass = 'memory-warning';
  }
  
  memoryInfoEl.innerHTML = `
    <div class="memory-status ${memoryStatusClass}">
      <span>Memory Usage: ${memoryInfo.current} MB</span>
      <span>Peak: ${memoryInfo.peak} MB</span>
      <div class="memory-bar">
        <div class="memory-bar-fill" style="width: ${(memoryInfo.current / this.memoryMonitor.criticalThreshold) * 100}%"></div>
      </div>
    </div>
  `;
  
  // Add styles if needed
  const style = document.head.querySelector('style#memory-monitor-styles');
  if (!style) {
    const styleEl = document.head.createEl('style');
    styleEl.id = 'memory-monitor-styles';
    styleEl.textContent = `
      .memory-info {
        margin-top: 10px;
        font-size: 0.9em;
      }
      .memory-status {
        padding: 5px;
        border-radius: 3px;
        margin-bottom: 5px;
      }
      .memory-normal {
        background-color: rgba(0, 255, 0, 0.1);
      }
      .memory-warning {
        background-color: rgba(255, 255, 0, 0.1);
      }
      .memory-critical {
        background-color: rgba(255, 0, 0, 0.1);
      }
      .memory-bar {
        height: 5px;
        background-color: rgba(0, 0, 0, 0.1);
        border-radius: 2px;
        margin-top: 3px;
      }
      .memory-bar-fill {
        height: 100%;
        background-color: var(--interactive-accent);
        border-radius: 2px;
        transition: width 0.5s ease-in-out;
      }
    `;
    document.head.appendChild(styleEl);
  }
}
```

## Implementation Steps

1. Add the memory check methods to the MemoryMonitor class
2. Update the processChunksWithLLM function to include memory checks
3. Update the assembleDocument function to include memory checks
4. Add UI updates to show memory usage during processing
5. Ensure error handling redirects users appropriately when memory limits are reached

## Best Practices

1. **Fail Early**: Check memory before starting an operation, not just during
2. **Be Transparent**: Show memory usage information to users during processing
3. **Save Progress**: If memory limits are reached, save partial results when possible
4. **Clear References**: Actively clear references to large objects when they're no longer needed
5. **Provide Guidance**: When memory limits are reached, provide clear guidance on how to proceed

## Return to [Memory Limits](./README.md)
