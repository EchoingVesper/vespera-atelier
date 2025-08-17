import { App, Notice } from 'obsidian';
import { LLMClient, CompletionOptions } from "../LLMClient";
import { VesperaScriptoriumSettings } from "../SettingsManager";
import { ProgressManager } from "../ui/ProgressPane";
import { ModuleInterface } from "../core";
import { getLogger, LogLevel } from "../utils";

/**
 * LLMProcessingService handles all interactions with the LLM,
 * including processing chunks, managing retries, and handling errors.
 */
export class LLMProcessingService implements ModuleInterface {
  private app: App;
  private settings: VesperaScriptoriumSettings;
  private llmClient: LLMClient;
  private isCancelled: boolean = false;
  private robustProcessingSystem: any = null;

  /**
   * Create a new LLMProcessingService
   *
   * @param app The Obsidian app instance
   * @param settings Plugin settings
   * @param llmClient LLM client instance
   */
  constructor(
    app: App,
    settings: VesperaScriptoriumSettings,
    llmClient: LLMClient
  ) {
    this.app = app;
    this.settings = settings;
    this.llmClient = llmClient;
  }

  /**
   * Initialize the service
   *
   * @param plugin Reference to the main plugin instance
   */
  public initialize(plugin: any): void {
    this.robustProcessingSystem = plugin.robustProcessingSystem;
  }

  /**
   * Set the cancellation flag
   *
   * @param cancelled Whether processing should be cancelled
   */
  public setCancelled(cancelled: boolean): void {
    this.isCancelled = cancelled;
  }

  /**
   * Process text chunks with the LLM
   *
   * @param chunks Array of text chunks
   * @param fileName Name of the file being processed
   * @param prompt User-provided prompt for summarization
   * @param progressManager Progress manager for updates
   * @returns Promise resolving to the summarized content
   */
  public async processChunksWithLLM(
    chunks: string[],
    fileName: string,
    prompt: string,
    progressManager: ProgressManager
  ): Promise<string> {
    const logger = getLogger();

    // Log the configuration settings used for this summarization run
    logger.info(`Starting summarization for ${fileName} with ${chunks.length} chunks`, {
      fileName,
      chunkCount: chunks.length,
      timestamp: new Date().toISOString(),
      configuration: {
        model: this.settings.llm.model,
        temperature: this.settings.llm.temperature,
        maxTokens: this.settings.llm.maxTokens,
        maxRetries: this.settings.llm.maxRetries,
        chunkTimeout: this.settings.llm.chunkTimeout,
        robustProcessingEnabled: this.settings.robustProcessing.enabled,
        baseTimeout: this.settings.robustProcessing.processing.baseTimeout,
        maxTimeout: this.settings.robustProcessing.processing.maxTimeout,
        timeoutScaleFactor: this.settings.robustProcessing.processing.timeoutScaleFactor,
        batchSize: this.settings.robustProcessing.processing.batchSize,
        adaptiveTimeout: this.settings.robustProcessing.processing.adaptiveTimeout
      },
      promptLength: prompt.length
    });
    // If robust processing is enabled and initialized, use it
    if (this.settings.robustProcessing.enabled && this.robustProcessingSystem) {
      try {
        logger.info(`Using robust processing system for ${fileName}`);

        // Create progress item for robust processing
        progressManager.createProgressItem({
          id: `${fileName}-robust-processing`,
          title: `Processing ${fileName} with robust system`,
          total: 100,
          current: 0
        });

        // Create document chunks with metadata
        const documentChunks = chunks.map((content, index) => ({
          id: `chunk-${index}`,
          content,
          index,
          metadata: {
            sourceDocument: fileName,
            startPosition: index,
            endPosition: index + 1,
            precedingContext: index > 0 ? chunks[index - 1].slice(-100) : '',
            followingContext: index < chunks.length - 1 ? chunks[index + 1].slice(0, 100) : ''
          }
        }));

        // Create processing options
        const processingOptions = {
          prompt,
          model: this.settings.llm.model,
          baseTimeout: this.settings.robustProcessing.processing.baseTimeout,
          maxTimeout: this.settings.robustProcessing.processing.maxTimeout,
          timeoutScaleFactor: this.settings.robustProcessing.processing.timeoutScaleFactor,
          maxRetries: this.settings.robustProcessing.processing.maxRetries,
          batchSize: this.settings.robustProcessing.processing.batchSize,
          adaptiveTimeout: this.settings.robustProcessing.processing.adaptiveTimeout,
          hardwareProfile: this.settings.robustProcessing.processing.hardwareProfile,
          temperature: this.settings.llm.temperature,
          maxTokens: this.settings.llm.maxTokens,
          progressCallback: (progress: any) => {
            // Update progress in UI
            const progressPercent = Math.round(progress.progress);
            progressManager.updateProgressItem(`${fileName}-robust-processing`, {
              current: progressPercent,
              message: `Processing ${fileName}: ${progressPercent}% complete`
            });
          },
          savePartialResults: this.settings.robustProcessing.persistence.savePartialResults,
          useCheckpointing: this.settings.robustProcessing.persistence.useCheckpointing,
          checkpointInterval: this.settings.robustProcessing.persistence.checkpointInterval
        };

        try {
          // Process the document
          const result = await this.robustProcessingSystem.processingOrchestrator.processDocument(
            fileName,
            fileName,
            documentChunks,
            processingOptions
          );

          // If processing was successful, assemble the document
          if (result.success) {
            // Create assembly options
            const assemblyOptions = {
              preserveChunkBoundaries: this.settings.robustProcessing.assembly.preserveChunkBoundaries,
              resolveReferences: this.settings.robustProcessing.assembly.resolveReferences,
              detectRedundancies: this.settings.robustProcessing.assembly.detectRedundancies,
              optimizeForCoherence: this.settings.robustProcessing.assembly.optimizeForCoherence,
              similarityThreshold: this.settings.robustProcessing.assembly.similarityThreshold,
              includeMetadata: this.settings.robustProcessing.output.includeMetadata,
              includeProcessingStats: this.settings.robustProcessing.output.includeProcessingStats
            };

            // Assemble the document
            const assembledDocument = this.robustProcessingSystem.documentAssembler.assembleDocument(
              result.content,
              fileName,
              fileName,
              result.stats,
              assemblyOptions
            );

            // Remove progress item
            progressManager.removeProgressItem(`${fileName}-robust-processing`);

            // Return the assembled content
            return assembledDocument.content;
          } else {
            // If processing failed, show error and return error message
            logger.error(`Error processing document with robust system: ${result.error}`, {
              fileName,
              error: result.error,
              timestamp: new Date().toISOString()
            });

            // If processing was paused, show resume option
            if (result.checkpointId) {
              new Notice(`Processing was paused. Use the checkpoint manager to resume processing.`);
            }

            // Remove progress item
            progressManager.removeProgressItem(`${fileName}-robust-processing`);

            return `[ERROR] Failed to process document: ${result.error}`;
          }
        } catch (error) {
          logger.error(`Error during document processing: ${error instanceof Error ? error.message : String(error)}`, {
            fileName,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString()
          });
          throw error;
        } finally {
          // Clean up resources to free memory
          if (this.robustProcessingSystem.processingOrchestrator.cleanupResources) {
            logger.info(`Cleaning up resources for ${fileName}`, {
              fileName,
              timestamp: new Date().toISOString()
            });
            this.robustProcessingSystem.processingOrchestrator.cleanupResources();
          }
        }
      } catch (error) {
        // Remove progress item in case of error
        progressManager.removeProgressItem(`${fileName}-robust-processing`);

        logger.error('Error using robust processing system:', {
          fileName,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        });
        new Notice(`Error using robust processing system: ${error instanceof Error ? error.message : String(error)}`);

        // Fall back to standard processing
        return this.standardProcessChunks(chunks, fileName, prompt, progressManager);
      }
    } else {
      // Use standard processing
      return this.standardProcessChunks(chunks, fileName, prompt, progressManager);
    }
  }

  /**
   * Standard chunk processing method (original implementation)
   * Refactored: Each chunk is processed with a per-chunk timeout (default: 30s, configurable).
   * On timeout, the chunk is logged, skipped, and added to a redo queue for possible retry.
   * Timeout events are logged and user-notified via Notice.
   */
  private async standardProcessChunks(
    chunks: string[],
    fileName: string,
    prompt: string,
    progressManager: ProgressManager
  ): Promise<string> {
    const logger = getLogger();
    try {
      if (chunks.length === 0) {
        logger.info(`No chunks to process for ${fileName}`);
        return '';
      }
      if (chunks.length === 1) {
        logger.info(`Processing single chunk for ${fileName}`, {
          chunkSize: chunks[0].length,
          timestamp: new Date().toISOString()
        });
        try {
          return await this.summarizeChunk(chunks[0], prompt);
        } catch (error) {
          logger.error(`Error processing single chunk for ${fileName}:`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString(),
            chunkSize: chunks[0].length
          });
          // Return empty string on error to prevent breaking assembly
          return "";
        }
      }
      logger.info(`Processing ${chunks.length} chunks for ${fileName} in batches`, {
        chunkCount: chunks.length,
        batchSize: 5,
        timestamp: new Date().toISOString()
      });
      const batchSize = 5;
      const summaries: string[] = [];
      let failedChunks = 0;
      // Per-chunk timeout from settings or fallback (default 30s)
      const perChunkTimeout = (this.settings.llm?.chunkTimeout ?? 30000);
      progressManager.createProgressItem({
        id: `${fileName}-standard-processing`,
        title: `Processing ${fileName}`,
        total: chunks.length,
        current: 0
      });
      for (let i = 0; i < chunks.length; i += batchSize) {
        if (this.isCancelled) {
          logger.info(`Processing cancelled for ${fileName}`, {
            chunksProcessed: i,
            totalChunks: chunks.length,
            timestamp: new Date().toISOString()
          });
          break;
        }
        const batch = chunks.slice(i, i + batchSize);
        const batchPromises = batch.map((chunk, index) => {
          // Wrap each summarizeChunk in a per-chunk timeout
          return Promise.race([
            this.summarizeChunk(chunk, prompt, i + index),
            new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), perChunkTimeout))
          ])
            .then(summary => {
              progressManager.updateProgressItem(`${fileName}-standard-processing`, {
                current: i + index + 1,
                message: `Processing ${fileName}: chunk ${i + index + 1}/${chunks.length}`
              });
              return summary;
            })
            .catch(error => {
              failedChunks++;
              if (error instanceof Error && error.message === 'timeout') {
                logger.error(`Timeout processing chunk ${i + index} of ${fileName}`, {
                  chunkIndex: i + index,
                  fileName,
                  timeout: perChunkTimeout,
                  chunkSize: chunk.length,
                  timestamp: new Date().toISOString()
                });
                new Notice(`Timeout: Chunk ${i + index + 1} in ${fileName} exceeded ${perChunkTimeout / 1000}s and was skipped.`);
                // Return empty string on timeout to prevent error messages in summary
                return "";
              } else {
                logger.error(`Error processing chunk ${i + index} of ${fileName}:`, {
                  chunkIndex: i + index,
                  fileName,
                  error: error instanceof Error ? error.message : String(error),
                  stack: error instanceof Error ? error.stack : undefined,
                  chunkSize: chunk.length,
                  timestamp: new Date().toISOString()
                });
                // Return empty string on error to prevent error messages in summary
                return "";
              }
            });
        });
        try {
          const batchResults = await Promise.all(batchPromises);
          summaries.push(...batchResults);
        } catch (error) {
          logger.error(`Error processing batch for ${fileName}:`, {
            batchIndex: Math.floor(i / batchSize),
            fileName,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString()
          });
          // Push empty strings for the entire batch on batch error to prevent breaking assembly
          const emptyResults = batch.map(() => "");
          summaries.push(...emptyResults);
        }
      }
      logger.info(`Processed ${chunks.length} chunks for ${fileName}: ${chunks.length - failedChunks} succeeded, ${failedChunks} failed`, {
        fileName,
        totalChunks: chunks.length,
        successfulChunks: chunks.length - failedChunks,
        failedChunks,
        timestamp: new Date().toISOString()
      });
      if (this.isCancelled) {
        return `[CANCELLED] Partial summary of ${fileName}:\n\n${summaries.join('\n\n')}`;
      }
      if (summaries.length > 1) {
        const combinedSummaries = summaries.join('\n\n');
        if (combinedSummaries.length < 4000) {
          return combinedSummaries;
        }
        // Recursively summarize the combined summaries if too large
        try {
          return await this.summarizeChunk(combinedSummaries, `Provide a cohesive summary of these section summaries from ${fileName}. ${prompt}`);
        } catch (error) {
          logger.error(`Error summarizing combined summaries for ${fileName}:`, {
            fileName,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString()
          });
          // Return the partial combined summaries on error
          return combinedSummaries;
        }
      }
      const result = summaries[0] || '';
      progressManager.removeProgressItem(`${fileName}-standard-processing`);
      return result;
    } catch (error) {
      progressManager.removeProgressItem(`${fileName}-standard-processing`);
      logger.error(`Error in standardProcessChunks for ${fileName}:`, {
        fileName,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
      throw new Error(`Failed to process chunks: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Summarize a single chunk of text
   *
   * @param chunk Text chunk to summarize
   * @param prompt User-provided prompt for summarization
   * @returns Promise resolving to the summarized content
   */
  private async summarizeChunk(chunk: string, prompt: string, chunkIndex: number = -1, isRetry: boolean = false): Promise<string> {
    // Create a unique ID for this chunk for logging purposes
    // Use the chunkIndex if provided, otherwise generate a random ID
    const chunkId = chunkIndex >= 0 ? `${chunkIndex}` : Math.random().toString(36).substring(2, 10);
    const logger = getLogger();

    // Log chunk processing start
    logger.debug(`Starting chunk ${chunkId} processing${isRetry ? ' (retry)' : ''}`, {
      chunkId,
      chunkSize: chunk.length,
      isRetry,
      timestamp: new Date().toISOString()
    });

    // Calculate a chunk-specific timeout based on the chunk size
    const chunkTimeout = this.calculateChunkTimeout(chunk.length);

    try {
      // Check for cancellation first
      if (this.isCancelled) {
        logger.info(`Chunk ${chunkId}: Processing cancelled`, {
          chunkId,
          timestamp: new Date().toISOString()
        });
        // Return an empty string or a specific cancellation indicator that won't break assembly
        return "";
      }

      // Create completion options
      // Create the full prompt
      const fullPrompt = `${prompt}\n\nContent to summarize:\n${chunk}`;

      // Create completion options
      const options: CompletionOptions = {
        model: this.settings.llm.model,
        prompt: fullPrompt, // Add the fullPrompt here
        temperature: this.settings.llm.temperature,
        maxTokens: this.settings.llm.maxTokens,
        timeout: chunkTimeout
      };

      // Rough estimation of token count (4 chars per token is a common approximation)
      const estimatedTokens = Math.ceil(fullPrompt.length / 4);

      logger.debug(`Chunk ${chunkId}: Estimated tokens: ${estimatedTokens}, Context window: ${this.settings.modelContextWindow}`, {
        chunkId,
        estimatedTokens,
        contextWindow: this.settings.modelContextWindow,
        timestamp: new Date().toISOString()
      });

      // Check if the estimated token count exceeds the model's context window
      if (estimatedTokens > this.settings.modelContextWindow) {
        logger.warn(`Warning: Chunk ${chunkId}: Estimated token count (${estimatedTokens}) exceeds model context window (${this.settings.modelContextWindow})`, {
          chunkId,
          estimatedTokens,
          contextWindow: this.settings.modelContextWindow,
          timestamp: new Date().toISOString()
        });

        // If the chunk is too large, recursively split it and summarize each part
        if (chunk.length > 1000) { // Arbitrary threshold for splitting
          logger.info(`Chunk ${chunkId}: Too large, splitting into smaller chunks`, {
            chunkId,
            chunkSize: chunk.length,
            timestamp: new Date().toISOString()
          });

          // Split the chunk in half
          const midpoint = Math.floor(chunk.length / 2);
          const firstHalf = chunk.substring(0, midpoint);
          const secondHalf = chunk.substring(midpoint);

          // Summarize each half with proper error handling
          let firstSummary: string, secondSummary: string;

          try {
            firstSummary = await this.summarizeChunk(firstHalf, prompt);
          } catch (error) {
            logger.error(`Chunk ${chunkId}: Error summarizing first half:`, {
              chunkId,
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              timestamp: new Date().toISOString()
            });
            // Return empty string on error during recursive split to avoid breaking assembly
            firstSummary = "";
          }

          try {
            secondSummary = await this.summarizeChunk(secondHalf, prompt);
          } catch (error) {
            logger.error(`Chunk ${chunkId}: Error summarizing second half:`, {
              chunkId,
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              timestamp: new Date().toISOString()
            });
            // Return empty string on error during recursive split to avoid breaking assembly
            secondSummary = "";
          }

          // Combine the summaries
          const combinedSummary = `${firstSummary}\n\n${secondSummary}`;

          // If the combined summary is still too large, summarize it again
          if (combinedSummary.length / 4 > this.settings.modelContextWindow / 2) { // Check against half context window to leave space for prompt
            try {
              return await this.summarizeChunk(combinedSummary, "Provide a cohesive summary of these section summaries:");
            } catch (error) {
              logger.error(`Chunk ${chunkId}: Error summarizing combined summary:`, {
                chunkId,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                timestamp: new Date().toISOString()
              });
              // Return partial content or empty string on error during final summary
              return combinedSummary.substring(0, 1000); // Return a truncated version
            }
          }

          return combinedSummary;
        }
      }

      // Generate completion
      logger.debug(`Chunk ${chunkId}: Sending to LLM`, {
        chunkId,
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        timeout: options.timeout,
        timestamp: new Date().toISOString()
      });
      const result = await this.llmClient.generateCompletion(fullPrompt, options);
      logger.debug(`Chunk ${chunkId}: Successfully processed`, {
        chunkId,
        processingTime: Date.now() - new Date().getTime(), // Approximate processing time
        resultLength: result.length,
        timestamp: new Date().toISOString()
      });
      return result;

    } catch (error) {
      logger.error(`Chunk ${chunkId}: Error generating completion:`, {
        chunkId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });

      // Re-throw the error to be handled by the caller (standardProcessChunks or ProcessingOrchestrator)
      // If the LLMClient returns partial content on timeout, that should be handled within LLMClient.generateCompletion
      // and returned as the result, not thrown as an error.
      throw error;
    }
  }

  /**
   * Calculate a timeout value based on chunk size
   *
   * @param chunkLength Length of the chunk in characters
   * @returns Timeout in milliseconds
   */
  private calculateChunkTimeout(chunkLength: number): number {
    // Base timeout from settings
    const baseTimeout = this.settings.robustProcessing.processing.baseTimeout || 30000;

    // Calculate a scaling factor based on chunk size
    // Larger chunks need more time to process
    const scalingFactor = Math.min(3, Math.max(1, chunkLength / 2000));

    // Calculate timeout with a minimum of baseTimeout
    const timeout = Math.round(baseTimeout * scalingFactor);

    // Cap at maximum timeout
    const maxTimeout = this.settings.robustProcessing.processing.maxTimeout || 300000;
    return Math.min(timeout, maxTimeout);
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    // Cancel any ongoing operations
    this.isCancelled = true;
  }
}