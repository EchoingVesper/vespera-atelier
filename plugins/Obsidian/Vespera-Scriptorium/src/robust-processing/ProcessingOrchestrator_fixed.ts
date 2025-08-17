// ProcessingOrchestrator_fixed.ts - This contains the optimized version of the processChunkBatch method
// Import this file's content to replace the equivalent method in ProcessingOrchestrator.ts

// Placeholder class to contain the methods for syntax validation purposes.
// This class is not intended for actual use and should be replaced with the
// methods being integrated into the main ProcessingOrchestrator class.
import { DocumentChunk, ProcessingOptions, ProcessingProgress, ProcessingCheckpoint, ChunkResult } from './index'; // Assuming these types are exported from index.ts
import { DEFAULT_PROCESSING_OPTIONS } from './DEFAULT_PROCESSING_OPTIONS_fixed'; // Assuming this is the correct import path
import { OutputManager } from './OutputManager'; // Corrected import
import { FileStatus } from '../ui/OutputFilesView'; // Corrected import path for FileStatus

class ProcessingOrchestratorFixedPlaceholder {
  // Placeholder properties that are accessed by the methods
  private isCancelled: boolean = false;
  private isPaused: boolean = false;
  private processedChunksCache: Map<string, any> = new Map(); // Use a more specific type if known
  private activeCheckpointId: string | null = null;
  private adaptiveBatchingMetrics: any = {}; // Use a more specific type if known
  private outputFilesManager: OutputManager | null = null; // Assuming this property exists

  // Placeholder methods that are called by the provided methods
  private async handleCancelledOrPausedProcessing(chunks: DocumentChunk[], checkpoint: ProcessingCheckpoint | null): Promise<void> {
    // Placeholder implementation
  }

  private async processChunk(chunk: DocumentChunk, options: ProcessingOptions, progress: ProcessingProgress, checkpoint: ProcessingCheckpoint | null): Promise<ChunkResult> {
    // Placeholder implementation
    return {
      chunkId: chunk.id,
      content: 'placeholder content',
      success: true,
      error: undefined,
      retries: 0,
      processingTime: 100,
      tokensGenerated: 'placeholder content'.length, // Add tokensGenerated property
      metadata: {
        ...chunk.metadata,
        tokens: 'placeholder content'.length // Also store in metadata.tokens for consistency
      }
    };
  }

  private checkAndOptimizeMemory(options: ProcessingOptions): void {
    // Placeholder implementation
  }


  /**
   * Process a batch of chunks
   *
   * Processes chunks sequentially instead of in parallel to avoid memory issues.
   * This sacrifices speed for stability until the core issue is fixed.
   *
   * @param chunks Chunks to process
   * @param options Processing options
   * @param progress Processing progress tracking object
   * @param checkpoint Processing checkpoint for state persistence
   * @returns Promise resolving to an array of chunk results
   */
  private async processChunkBatch(
    chunks: DocumentChunk[],
    options: ProcessingOptions,
    progress: ProcessingProgress,
    checkpoint: ProcessingCheckpoint | null
  ): Promise<ChunkResult[]> {
    // Process chunks sequentially instead of in parallel for stability
    const results: ChunkResult[] = [];

    // Process chunks one by one to avoid overwhelming LM Studio
    for (const chunk of chunks) {
      // Check if cancelled
      if (this.isCancelled || this.isPaused) {
        await this.handleCancelledOrPausedProcessing([chunk], checkpoint);
        break;
      }

      try {
        const result = await this.processChunk(chunk, options, progress, checkpoint);
        results.push(result);

        // Update progress
        if (options.progressCallback) {
          progress.currentChunk++;
          progress.progress = Math.round((progress.currentChunk / progress.totalChunks) * 100);
          progress.stats.completedChunks += result.success ? 1 : 0;
          progress.stats.failedChunks += result.success ? 0 : 1;
          progress.stats.retries += result.retries;

          // Update average chunk time
          const totalChunksProcessed = progress.stats.completedChunks;
          progress.stats.averageChunkTime =
            (progress.stats.averageChunkTime * (totalChunksProcessed - 1) + result.processingTime) / totalChunksProcessed;

          // Update estimated time remaining
          const remainingChunks = progress.totalChunks - progress.stats.completedChunks;
          progress.estimatedTimeRemaining = remainingChunks * progress.stats.averageChunkTime;

          options.progressCallback(progress);
        }

        // Add a small delay between chunks to prevent flooding the API
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check and optimize memory after each chunk
        if (options.collectPerformanceMetrics !== false) {
          this.checkAndOptimizeMemory(options);
        }
      } catch (error) {
        console.error(`Error processing chunk:`, error);

        // Add failed result to maintain chunk count
        results.push({
          chunkId: chunk.id,
          content: '',
          success: false,
          error: String(error),
          retries: 0,
          processingTime: 0,
          tokensGenerated: 0, // No tokens generated in error case
          metadata: { ...chunk.metadata }
        });
      }
    }

    return results;
  }

  /**
   * Assemble partial results into a complete document
   *
   * Uses a more memory-efficient implementation for assembling chunks.
   *
   * @param results Chunk results to assemble
   * @returns Assembled complete document
   */
  private assemblePartialResults(results: ChunkResult[]): string {
    // Early return for empty results
    if (results.length === 0) return '';

    // Create a map of index to content for quick lookups
    const contentMap = new Map<number, string>();

    // Filter out failed chunks and populate the map
    for (const result of results) {
      if (result.success && result.metadata?.index !== undefined) {
        contentMap.set(result.metadata.index, result.content);
      }
    }

    // Get the maximum index
    const indices = Array.from(contentMap.keys());
    if (indices.length === 0) return '';

    const maxIndex = Math.max(...indices);

    // Build the string efficiently
    const parts: string[] = [];
    for (let i = 0; i <= maxIndex; i++) {
      const content = contentMap.get(i);
      if (content) {
        parts.push(content);
      }
    }

    return parts.join('\n\n');
  }

  /**
   * Cleanup resources to free memory
   */
  cleanupResources(): void {
    // Clear the cache to free memory
    this.processedChunksCache.clear();

    // Reset state
    this.isCancelled = false;
    this.isPaused = false;
    this.activeCheckpointId = null;

    // Reset metrics
    this.adaptiveBatchingMetrics = {
      averageProcessingTime: 0,
      errorRate: 0,
      chunksProcessed: 0,
      errors: 0,
      lastUpdated: Date.now(),
      currentBatchSize: DEFAULT_PROCESSING_OPTIONS.batchSize!,
      batchSizeHistory: []
    };

    // Suggest garbage collection if available
    if (global && typeof global.gc === 'function') {
      try {
        global.gc();
      } catch (e) {
        console.warn('Failed to trigger manual garbage collection', e);
      }
    }
  }
}