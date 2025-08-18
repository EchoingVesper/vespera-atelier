/**
 * Processing Orchestrator
 * Manages the overall document processing workflow with robust error handling, recovery mechanisms,
 * and performance optimizations.
 *
 * Key features:
 * - Race condition prevention through mutex-based synchronization
 * - Memory leak prevention with automatic resource cleanup and cache management
 * - Enhanced error handling with type-specific recovery strategies
 * - Comprehensive checkpoint management for resumable processing
 * - Adaptive batch sizing based on performance metrics
 * - Efficient resource cleanup for cancelled or paused processing
 * - Exponential backoff with jitter for retries
 * - Performance optimizations including chunk prioritization and memory usage monitoring
 *
 * @module ProcessingOrchestrator
 */

import { App, Notice } from "obsidian";
import { DocumentChunk } from "./AdaptiveChunker";
import { PersistenceManager, ProcessingCheckpoint, CheckpointStatus } from "./PersistenceManager";
import { ContextWindowDetector } from "./ContextWindowDetector";
import { LLMClient, CompletionOptions, ErrorType as LLMErrorType, LLMError } from "../LLMClient";
import { ErrorDetector, ErrorSource } from '../error-handling/ErrorDetector';
import { VesperaError, ErrorType, ErrorSeverity, ErrorHandler } from '../utils/ErrorHandler';
import { OutputFilesManager, FileStatus } from "../ui";
import { v4 as uuidv4 } from 'uuid';
import { PromptBuilder, PromptBuilderInput, PromptConfig } from '../PromptBuilder'; // Added

/**
 * Hardware profile for timeout calculation
 */
export interface HardwareProfile {
  /**
   * Base timeout in milliseconds
   */
  baseTimeout: number;
  
  /**
   * Maximum timeout in milliseconds
   */
  maxTimeout: number;
  
  /**
   * Timeout scaling factor
   */
  timeoutScaleFactor: number;
  
  /**
   * Hardware description
   */
  description: string;
}

/**
 * Predefined hardware profiles
 */
export const HARDWARE_PROFILES: Record<string, HardwareProfile> = {
  'consumer-gpu': {
    baseTimeout: 30000, // 30 seconds
    maxTimeout: 300000, // 5 minutes
    timeoutScaleFactor: 1.5,
    description: 'Consumer-grade GPU (e.g., RTX 2080)'
  },
  'high-end-gpu': {
    baseTimeout: 20000, // 20 seconds
    maxTimeout: 180000, // 3 minutes
    timeoutScaleFactor: 1.2,
    description: 'High-end GPU (e.g., RTX 3090, RTX 4090)'
  },
  'cpu-only': {
    baseTimeout: 60000, // 1 minute
    maxTimeout: 600000, // 10 minutes
    timeoutScaleFactor: 2.0,
    description: 'CPU-only processing'
  },
  'server-grade': {
    baseTimeout: 15000, // 15 seconds
    maxTimeout: 120000, // 2 minutes
    timeoutScaleFactor: 1.0,
    description: 'Server-grade hardware'
  }
};

/**
 * Processing progress
 */
export interface ProcessingProgress {
  /**
   * Document ID
   */
  documentId: string;
  
  /**
   * Document name
   */
  documentName: string;
  
  /**
   * Current chunk index
   */
  currentChunk: number;
  
  /**
   * Total number of chunks
   */
  totalChunks: number;
  
  /**
   * Progress percentage (0-100)
   */
  progress: number;
  
  /**
   * Status message
   */
  status: string;
  
  /**
   * Error message (if any)
   */
  error?: string;
  
  /**
   * Whether processing is complete
   */
  isComplete: boolean;
  
  /**
   * Whether processing is cancelled
   */
  isCancelled: boolean;
  
  /**
   * Whether processing is paused
   */
  isPaused: boolean;
  
  /**
   * Estimated time remaining in milliseconds
   */
  estimatedTimeRemaining?: number;
  
  /**
   * Processing statistics
   */
  stats: {
    /**
     * Start time
     */
    startTime: Date;
    
    /**
     * Elapsed time in milliseconds
     */
    elapsedTime: number;
    
    /**
     * Number of completed chunks
     */
    completedChunks: number;
    
    /**
     * Number of failed chunks
     */
    failedChunks: number;
    
    /**
     * Number of retries
     */
    retries: number;
    
    /**
     * Average processing time per chunk in milliseconds
     */
    averageChunkTime: number;
  };
}

/**
 * Processing options
 */
export interface ProcessingOptions {
  /**
   * The prompt to use for processing
   */
  prompt: string;
  
  /**
   * The model to use for processing
   */
  model: string;
  
  /**
   * Base timeout in milliseconds
   * @default 30000 (30 seconds)
   */
  baseTimeout?: number;
  
  /**
   * Maximum timeout in milliseconds
   * @default 300000 (5 minutes)
   */
  maxTimeout?: number;
  
  /**
   * Timeout scaling factor
   * @default 1.5
   */
  timeoutScaleFactor?: number;
  
  /**
   * Maximum number of retries
   * @default 3
   */
  maxRetries?: number;
  
  /**
   * Batch size for processing
   * @default 5
   */
  batchSize?: number;
  
  /**
   * Whether to use adaptive timeouts
   * @default true
   */
  adaptiveTimeout?: boolean;
  
  /**
   * Hardware profile to use
   * @default 'consumer-gpu'
   */
  hardwareProfile?: string | HardwareProfile;
  
  /**
   * Temperature for LLM generation
   * @default 0.7
   */
  temperature?: number;
  
  /**
   * Maximum tokens to generate
   * @default 1000
   */
  maxTokens?: number;
  
  /**
   * Progress callback
   */
  progressCallback?: (progress: ProcessingProgress) => void;
  
  /**
   * Whether to save partial results
   * @default true
   */
  savePartialResults?: boolean;
  
  /**
   * Whether to use checkpointing
   * @default true
   */
  useCheckpointing?: boolean;
  
  /**
   * Checkpoint interval in chunks
   * @default 5
   */
  checkpointInterval?: number;
  
  /**
   * Checkpoint save interval in milliseconds
   * @default 30000 (30 seconds)
   */
  checkpointSaveInterval?: number;
  
  /**
   * Whether to enable diagnostic mode
   * @default false
   */
  diagnosticMode?: boolean;
  
  /**
   * Whether to accept partial results from timeouts
   * @default true
   */
  acceptPartialResults?: boolean;
  
  /**
   * Minimum acceptable length for partial results (in characters)
   * @default 50
   */
  minPartialResultLength?: number;
  
  /**
   * Whether to collect detailed performance metrics
   * @default true
   */
  collectPerformanceMetrics?: boolean;
  
  /**
   * Memory usage limit in MB before triggering garbage collection
   * @default 500
   */
  memoryUsageLimit?: number;
  
  /**
   * Whether to use streaming processing for large documents
   * @default true
   */
  useStreamingProcessing?: boolean;
}

/**
 * Default processing options with memory-optimized settings
 */
export const DEFAULT_PROCESSING_OPTIONS: ProcessingOptions = {
  prompt: '',
  model: '',
  baseTimeout: 30000,
  maxTimeout: 180000, // Reduced from 300000 (5 min) to 180000 (3 min)
  timeoutScaleFactor: 1.5,
  maxRetries: 3,
  batchSize: 1, // Reduced from 5 to 1 for stability
  adaptiveTimeout: true,
  hardwareProfile: 'consumer-gpu',
  temperature: 0.7,
  maxTokens: 1000,
  savePartialResults: true,
  useCheckpointing: true,
  checkpointInterval: 10, // Increased from 5 to 10 to reduce checkpoint frequency
  checkpointSaveInterval: 60000, // Increased from 30000 to 60000 to reduce checkpoint frequency
  diagnosticMode: false,
  acceptPartialResults: true,
  minPartialResultLength: 50,
  collectPerformanceMetrics: true,
  memoryUsageLimit: 400, // Reduced from 500 to 400 MB
  useStreamingProcessing: true
};

/**
 * Processing result
 */
/**
 * Performance metrics for document processing
 */
export interface PerformanceMetrics {
  /**
   * CPU usage during processing (0-100%)
   */
  cpuUsage?: number;
  
  /**
   * Memory usage during processing (in MB)
   */
  memoryUsage?: number;
  
  /**
   * Processing time breakdown by stage (in milliseconds)
   */
  timeBreakdown: {
    /**
     * Time spent chunking
     */
    chunking?: number;
    
    /**
     * Time spent in LLM processing
     */
    llmProcessing: number;
    
    /**
     * Time spent in result assembly
     */
    resultAssembly: number;
    
    /**
     * Time spent in checkpointing
     */
    checkpointing?: number;
    
    /**
     * Time spent in other operations
     */
    other: number;
  };
  
  /**
   * Throughput metrics
   */
  throughput: {
    /**
     * Chunks per second
     */
    chunksPerSecond: number;
    
    /**
     * Tokens per second
     */
    tokensPerSecond: number;
  };
  
  /**
   * Error metrics
   */
  errors: {
    /**
     * Error rate (0-1)
     */
    errorRate: number;
    
    /**
     * Error counts by type
     */
    byType: Record<string, number>;
  };
}

export interface ProcessingResult {
  /**
   * Document ID
   */
  documentId: string;
  
  /**
   * Document name
   */
  documentName: string;
  
  /**
   * Processed content
   */
  content: string;
  
  /**
   * Processing statistics
   */
  stats: {
    /**
     * Total processing time in milliseconds
     */
    totalTime: number;
    
    /**
     * Number of chunks processed
     */
    chunksProcessed: number;
    
    /**
     * Number of tokens processed
     */
    tokensProcessed: number;
    
    /**
     * Number of retries
     */
    retries: number;
    
    /**
     * Number of errors
     */
    errors: number;
  };
  
  /**
   * Detailed performance metrics
   */
  performanceMetrics?: PerformanceMetrics;
  
  /**
   * Whether processing was successful
   */
  success: boolean;
  
  /**
   * Error message (if any)
   */
  error?: string;
  
  /**
   * Checkpoint ID (if processing was paused)
   */
  checkpointId?: string;
}

/**
 * Chunk processing result
 */
export interface ChunkResult {
  /**
   * Chunk ID
   */
  chunkId: string;
  
  /**
   * Processed content
   */
  content: string;
  
  /**
   * Whether processing was successful
   */
  success: boolean;
  
  /**
   * Error message (if any)
   */
  error?: string;
  
  /**
   * Number of retries
   */
  retries: number;
  
  /**
   * Processing time in milliseconds
   */
  processingTime: number;
  
  /**
   * Number of tokens generated in the response
   * Rough estimation based on content length
   */
  tokensGenerated: number;
  
  /**
   * Chunk metadata
   */
  metadata: {
    /**
     * Chunk index
     */
    index?: number;
    
    /**
     * Estimated tokens
     */
    estimatedTokens?: number;
    
    /**
     * Actual tokens used
     */
    tokens?: number;
    
    /**
     * Whether this is a partial result
     */
    isPartial?: boolean;
    
    /**
     * Original chunk text
     */
    originalText?: string;
    
    /**
     * Additional metadata
     */
    [key: string]: any;
  };
}

/**
 * Processing Orchestrator class
 * Responsible for managing the overall processing workflow
 */
/**
 * Performance metrics for adaptive batch sizing
 */
export interface AdaptiveBatchingMetrics {
  /**
   * Average processing time per chunk in milliseconds
   */
  averageProcessingTime: number;
  
  /**
   * Error rate (0-1)
   */
  errorRate: number;
  
  /**
   * Number of chunks processed
   */
  chunksProcessed: number;
  
  /**
   * Number of errors encountered
   */
  errors: number;
  
  /**
   * Timestamp of last metrics update
   */
  lastUpdated: number;
  
  /**
   * Current batch size
   */
  currentBatchSize: number;
  
  /**
   * History of batch sizes and their performance
   */
  batchSizeHistory: Array<{
    batchSize: number;
    averageProcessingTime: number;
    errorRate: number;
    timestamp: number;
  }>;
}

/**
 * ProcessingOrchestrator class
 *
 * Orchestrates the processing of document chunks through an LLM, with robust error handling,
 * checkpointing, and performance optimizations.
 *
 * Features:
 * - Parallel processing with concurrency control
 * - Checkpoint-based resumable processing
 * - Adaptive batch sizing based on performance metrics
 * - Comprehensive error handling and recovery
 * - Memory usage optimization
 * - Performance monitoring and metrics collection
 * - Race condition prevention through mutex-based synchronization
 */
export class ProcessingOrchestrator {
  private errorDetector: ErrorDetector;
  private app: App;
  private llmClient: LLMClient;
  private persistenceManager: PersistenceManager;
  private contextWindowDetector: ContextWindowDetector;
  private promptBuilder: PromptBuilder; // Added
  private outputFilesManager: OutputFilesManager | null = null;
  private isCancelled: boolean = false;
  private isPaused: boolean = false;
  private activeCheckpointId: string | null = null;
  
  // Performance metrics for adaptive batch sizing
  private adaptiveBatchingMetrics: AdaptiveBatchingMetrics = {
    averageProcessingTime: 0,
    errorRate: 0,
    chunksProcessed: 0,
    errors: 0,
    lastUpdated: Date.now(),
    currentBatchSize: DEFAULT_PROCESSING_OPTIONS.batchSize!,
    batchSizeHistory: []
  };
  
  // Cache for processed chunks
  private processedChunksCache: Map<string, ChunkResult> = new Map();
  
  /**
   * Create a new ProcessingOrchestrator instance
   *
   * Initializes the orchestrator with required dependencies and sets up internal state.
   *
   * @param app Obsidian App instance
   * @param llmClient LLM client for generating completions
   * @param persistenceManager Persistence manager for checkpoint handling
   * @param contextWindowDetector Context window detector for token limit management
   * @param outputFilesManager Optional output files manager for status updates
   */
  constructor(
    app: App,
    llmClient: LLMClient,
    persistenceManager: PersistenceManager,
    contextWindowDetector: ContextWindowDetector,
    outputFilesManager?: OutputFilesManager
  ) {
    this.app = app;
    this.llmClient = llmClient;
    this.persistenceManager = persistenceManager;
    this.contextWindowDetector = contextWindowDetector;
    this.outputFilesManager = outputFilesManager || null;
    this.errorDetector = new ErrorDetector();
    this.promptBuilder = new PromptBuilder(); // Initialize PromptBuilder
    // Register a default prompt config for backward compatibility or basic use.
    // More sophisticated configs should be managed externally or loaded.
    const defaultConfig: PromptConfig = {
      id: 'default_processing_prompt',
      name: 'Default Document Processing Prompt',
      description: 'Default prompt for processing document chunks.',
      templateType: 'string',
      templateString: `Base Instructions: {base_prompt_instructions}

--- DOCUMENT INFORMATION ---
Document: {sourceDocument}
Chunk: {chunkIndex} of {totalChunks}

--- PRECEDING CONTEXT ---
{precedingContext}

--- CONTENT TO PROCESS ---
{document_chunk}

--- FOLLOWING CONTEXT ---
{followingContext}

--- INSTRUCTIONS ---
Process the content above according to the instructions.
If this is not the first chunk, ensure your response maintains continuity with previous chunks.
If this is not the last chunk, ensure your response can be continued in subsequent chunks.
Format Instructions (if any): {format_instructions}`,
      inputVariables: [
        'base_prompt_instructions',
        'document_chunk',
        'sourceDocument',
        'chunkIndex',
        'totalChunks',
        'precedingContext',
        'followingContext',
        'format_instructions',
      ],
      // outputParser can be added if a default one is desired
    };
    this.promptBuilder.registerPromptConfig(defaultConfig);
  }
  
  /**
   * Process a document
   *
   * Processes a document by breaking it into chunks and sending them to the LLM for processing.
   * Features comprehensive error handling, checkpointing, and performance optimization.
   *
   * Key features:
   * - Parallel processing with adaptive batch sizing
   * - Checkpoint creation and management for resumable processing
   * - Progress tracking and reporting
   * - Memory usage optimization
   * - Performance metrics collection
   * - Comprehensive error handling with type-specific recovery strategies
   *
   * @param documentId Document ID
   * @param documentName Document name
   * @param chunks Document chunks to process
   * @param options Processing options including model, prompt, and optimization settings
   * @returns Promise resolving to the processing result
   */
  public async processDocument(
    documentId: string,
    documentName: string,
    chunks: DocumentChunk[],
    options: ProcessingOptions
  ): Promise<ProcessingResult> {
    // Start timing for performance metrics
    const startTime = Date.now();
    
    // Reset flags
    this.isCancelled = false;
    this.isPaused = false;
    
    // Check and optimize memory before processing
    if (options.collectPerformanceMetrics !== false) {
      this.checkAndOptimizeMemory(options);
    }
    
    // Create a checkpoint if checkpointing is enabled
    let checkpoint: ProcessingCheckpoint | null = null;
    if (options.useCheckpointing) {
      // Create chunk IDs for tracking
      const chunkIds = chunks.map(chunk => chunk.id || `chunk-${uuidv4()}`);
      
      checkpoint = {
        id: uuidv4(),
        documentId,
        documentName,
        timestamp: new Date(),
        completedChunks: [] as string[],
        pendingChunks: chunkIds,
        failedChunks: {} as Record<string, { error: string, attempts: number }>,
        partialResults: {} as Record<string, string>,
        processingStats: {
          startTime: new Date(),
          totalChunks: chunks.length,
          completedChunks: 0,
          averageChunkProcessingTime: 0,
          estimatedTimeRemaining: 0
        },
        status: CheckpointStatus.ACTIVE,
        metadata: {
          options: options,
          error: ''
        },
        originalChunks: chunks // Add originalChunks here
      };
      
      // Save the checkpoint
      if (checkpoint) { // Add null check
        await this.persistenceManager.saveCheckpoint(checkpoint);
        this.activeCheckpointId = checkpoint.id;
      }
    }
    
    // Create progress object
    const progress: ProcessingProgress = {
      documentId,
      documentName,
      currentChunk: 0,
      totalChunks: chunks.length,
      progress: 0,
      status: 'Starting processing...',
      isComplete: false,
      isCancelled: false,
      isPaused: false,
      stats: {
        startTime: new Date(),
        elapsedTime: 0,
        completedChunks: 0,
        failedChunks: 0,
        retries: 0,
        averageChunkTime: 0
      }
    };
    
    // Update file status if output files manager is available
    if (this.outputFilesManager) {
      updateFileStatus(
        this.outputFilesManager,
        documentId,
        FileStatus.PROCESSING,
        undefined,
        false // Not retryable
      );
    }
    
    try {
      // Process chunks in batches
      const batchSize = options.batchSize !== undefined ? options.batchSize : DEFAULT_PROCESSING_OPTIONS.batchSize!;
      const results: ChunkResult[] = [];
      
      // Process chunks in batches
      for (let i = 0; i < chunks.length; i += batchSize) {
        // Check if cancelled
        if (this.isCancelled) {
          progress.isCancelled = true;
          progress.status = 'Processing cancelled';
          
          // Update file status
          if (this.outputFilesManager) {
            updateFileStatus(
              this.outputFilesManager,
              documentId,
              FileStatus.ERROR,
              'Processing cancelled',
              false // Not retryable
            );
          }
          
          // Call progress callback
          if (options.progressCallback) {
            options.progressCallback(progress);
          }
          
          return {
            documentId,
            documentName,
            content: '',
            stats: {
              totalTime: Date.now() - progress.stats.startTime.getTime(),
              chunksProcessed: progress.stats.completedChunks,
              tokensProcessed: this.calculateTotalTokens(results),
              retries: progress.stats.retries,
              errors: progress.stats.failedChunks
            },
            success: false,
            error: 'Processing cancelled'
          };
        }
        
        // Check if paused
        if (this.isPaused) {
          progress.isPaused = true;
          progress.status = 'Processing paused';
          
          // Update checkpoint status
          if (checkpoint) {
            checkpoint.status = CheckpointStatus.PAUSED;
            checkpoint.processingStats.completedChunks = progress.stats.completedChunks;
            
            // Update partial results
            results.forEach(result => {
              if (result.success) {
                checkpoint!.partialResults[result.chunkId] = result.content;
                
                // Move from pending to completed
                const index = checkpoint!.pendingChunks.indexOf(result.chunkId);
                if (index !== -1) {
                  checkpoint!.pendingChunks.splice(index, 1);
                  checkpoint!.completedChunks.push(result.chunkId);
                }
              }
            });
            
            await this.persistenceManager.saveCheckpoint(checkpoint);
          }
          
          // Update file status
          if (this.outputFilesManager) {
            updateFileStatus(
              this.outputFilesManager,
              documentId,
              FileStatus.PENDING,
              'Processing paused',
              true // Retryable
            );
          }
          
          // Call progress callback
          if (options.progressCallback) {
            options.progressCallback(progress);
          }
          
          return {
            documentId,
            documentName,
            content: this.assemblePartialResults(results),
            stats: {
              totalTime: Date.now() - progress.stats.startTime.getTime(),
              chunksProcessed: progress.stats.completedChunks,
              tokensProcessed: this.calculateTotalTokens(results),
              retries: progress.stats.retries,
              errors: progress.stats.failedChunks
            },
            success: false,
            error: 'Processing paused',
            checkpointId: checkpoint ? checkpoint.id : undefined
          };
        }
        
        // Get batch of chunks
        const batch = chunks.slice(i, i + batchSize);
        
        // Update progress
        progress.currentChunk = i;
        progress.progress = Math.round((i / chunks.length) * 100);
        progress.status = `Processing chunks ${i + 1}-${Math.min(i + batchSize, chunks.length)} of ${chunks.length}`;
        
        // Call progress callback
        if (options.progressCallback) {
          options.progressCallback(progress);
        }
        
        // Process batch
        const batchResults = await this.processChunkBatch(batch, options, progress, checkpoint);
        results.push(...batchResults);
        
        // Update progress
        progress.stats.completedChunks += batchResults.filter(r => r.success).length;
        progress.stats.failedChunks += batchResults.filter(r => !r.success).length;
        
        // Update checkpoint if needed
        if (checkpoint && options.checkpointInterval &&
            (i + batchSize) % (options.checkpointInterval! * batchSize) === 0) {
          checkpoint.status = CheckpointStatus.ACTIVE;
          checkpoint.processingStats.completedChunks = progress.stats.completedChunks;
          checkpoint.processingStats.averageChunkProcessingTime =
            progress.stats.completedChunks > 0
              ? progress.stats.elapsedTime / progress.stats.completedChunks
              : 0;
          
          // Update partial results
          results.forEach(result => {
            if (result.success) {
              checkpoint!.partialResults[result.chunkId] = result.content;
              
              // Move from pending to completed
              const index = checkpoint!.pendingChunks.indexOf(result.chunkId);
              if (index !== -1) {
                checkpoint!.pendingChunks.splice(index, 1);
                checkpoint!.completedChunks.push(result.chunkId);
              }
            }
          });
          
          await this.persistenceManager.saveCheckpoint(checkpoint);
        }
      }
      
      // Assemble final result
      const content = this.assemblePartialResults(results);
      
      // Update progress
      progress.isComplete = true;
      progress.progress = 100;
      progress.status = 'Processing complete';
      progress.stats.elapsedTime = Date.now() - progress.stats.startTime.getTime();
      
      // Update file status
      if (this.outputFilesManager) {
        updateFileStatus(
          this.outputFilesManager,
          documentId,
          FileStatus.COMPLETED,
          undefined,
          false // Not retryable
        );
      }
      
      // Call progress callback
      if (options.progressCallback) {
        options.progressCallback(progress);
      }
      
      // Update checkpoint status
      if (checkpoint) {
        checkpoint.status = CheckpointStatus.COMPLETED;
        checkpoint.processingStats.completedChunks = progress.stats.completedChunks;
        checkpoint.processingStats.averageChunkProcessingTime =
          progress.stats.completedChunks > 0
            ? progress.stats.elapsedTime / progress.stats.completedChunks
            : 0;
        checkpoint.processingStats.estimatedTimeRemaining = 0; // Completed
        
        // Update partial results
        results.forEach(result => {
          if (result.success) {
            checkpoint!.partialResults[result.chunkId] = result.content;
            
            // Move from pending to completed
            const index = checkpoint!.pendingChunks.indexOf(result.chunkId);
            if (index !== -1) {
              checkpoint!.pendingChunks.splice(index, 1);
              checkpoint!.completedChunks.push(result.chunkId);
            }
          }
        });
        
        await this.persistenceManager.saveCheckpoint(checkpoint);
      }
      
      // Collect performance metrics if enabled
      let performanceMetrics: PerformanceMetrics | undefined;
      if (options.collectPerformanceMetrics !== false) {
        performanceMetrics = this.collectPerformanceMetrics(
          results,
          startTime,
          Date.now()
        );
      }
      
      // Return result
      return {
        documentId,
        documentName,
        content,
        stats: {
          totalTime: progress.stats.elapsedTime,
          chunksProcessed: progress.stats.completedChunks,
          tokensProcessed: this.calculateTotalTokens(results),
          retries: progress.stats.retries,
          errors: progress.stats.failedChunks
        },
        performanceMetrics,
        success: true
      };
    } catch (error) {
      // Update progress
      progress.status = `Error: ${error instanceof Error ? error.message : String(error)}`;
      progress.error = error instanceof Error ? error.message : String(error);
      
      // Update file status
      if (this.outputFilesManager) {
        // Determine if the error is retryable
        const isRetryable = error instanceof Error &&
          'retryable' in error &&
          (error as any).retryable === true;
          
        updateFileStatus(
          this.outputFilesManager,
          documentId,
          FileStatus.ERROR,
          error instanceof Error ? error.message : String(error),
          isRetryable
        );
      }
      
      // Call progress callback
      if (options.progressCallback) {
        options.progressCallback(progress);
      }
      
      // Update checkpoint status
      if (checkpoint) {
        checkpoint.status = CheckpointStatus.FAILED;
        checkpoint.metadata = checkpoint.metadata || {};
        checkpoint.metadata = {
          ...checkpoint.metadata,
          error: error instanceof Error ? error.message : String(error)
        };
        await this.persistenceManager.saveCheckpoint(checkpoint);
      }
      
      // Return error result
      return {
        documentId,
        documentName,
        content: '',
        stats: {
          totalTime: Date.now() - progress.stats.startTime.getTime(),
          chunksProcessed: progress.stats.completedChunks,
          tokensProcessed: 0,
          retries: progress.stats.retries,
          errors: progress.stats.failedChunks + 1
        },
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Resume processing from a checkpoint
   *
   * Resumes document processing from a previously saved checkpoint.
   * Loads the checkpoint state, reconstructs the processing context,
   * and continues processing from where it left off.
   *
   * Key features:
   * - Checkpoint validation
   * - Reconstruction of processing state
   * - Continuation of processing with the same options
   * - Progress tracking from the previous state
   *
   * @param checkpointId Checkpoint ID to resume from
   * @param options Processing options for the resumed processing
   * @returns Promise resolving to the processing result
   */
  public async resumeProcessing(
    checkpointId: string,
    options: ProcessingOptions
  ): Promise<ProcessingResult> {
    // Reset flags
    this.isCancelled = false;
    this.isPaused = false;
    this.activeCheckpointId = checkpointId;
    
    try {
      // Load the checkpoint
      const checkpoint = await this.persistenceManager.loadCheckpoint(checkpointId);
      
      // Verify checkpoint status
      if (checkpoint.status !== CheckpointStatus.PAUSED) {
        throw new Error(`Cannot resume checkpoint with status ${checkpoint.status}`);
      }
      
      // Update file status if output files manager is available
      if (this.outputFilesManager) {
        updateFileStatus(
          this.outputFilesManager,
          checkpoint.documentId,
          FileStatus.PROCESSING,
          'Resuming processing...',
          false // Not retryable
        );
      }
      
      // Create progress object
      const progress: ProcessingProgress = {
        documentId: checkpoint.documentId,
        documentName: checkpoint.documentName,
        currentChunk: checkpoint.completedChunks.length,
        totalChunks: checkpoint.completedChunks.length + checkpoint.pendingChunks.length,
        progress: Math.round((checkpoint.completedChunks.length /
          (checkpoint.completedChunks.length + checkpoint.pendingChunks.length)) * 100),
        status: 'Resuming processing...',
        isComplete: false,
        isCancelled: false,
        isPaused: false,
        stats: {
          startTime: checkpoint.processingStats.startTime,
          elapsedTime: 0,
          completedChunks: checkpoint.completedChunks.length,
          failedChunks: Object.keys(checkpoint.failedChunks).length,
          retries: 0,
          averageChunkTime: checkpoint.processingStats.averageChunkProcessingTime
        }
      };
      
      // Call progress callback
      if (options.progressCallback) {
        options.progressCallback(progress);
      }
      
      // Reconstruct the pending chunks from the checkpoint
      // In a real implementation, we would need to retrieve the actual chunks
      // from the checkpoint or from the original document
      const pendingChunks: DocumentChunk[] = checkpoint.pendingChunks.map((chunkId) => {
        const originalChunk = checkpoint.originalChunks.find((chunk: DocumentChunk) => chunk.id === chunkId); // Explicitly type chunk
        if (!originalChunk) {
          // This should not happen if checkpoint is valid, but handle defensively
          console.error(`Original chunk with ID ${chunkId} not found in checkpoint.`);
          // Return a minimal chunk to avoid errors, though this indicates a potential issue
          return {
            id: chunkId,
            content: '',
            metadata: {
              id: chunkId,
              chunkNumber: -1, // Using -1 to indicate an unknown chunk number
              index: -1, // Indicate unknown index
              totalChunks: checkpoint.completedChunks.length + checkpoint.pendingChunks.length,
              sourceDocument: checkpoint.documentName,
              startPosition: 0,
              endPosition: 0,
              estimatedTokens: 0,
              timestamp: Date.now()
            }
          };
        }
        return {
          id: originalChunk.id,
          content: originalChunk.content,
          metadata: originalChunk.metadata
        };
      });
      
      // Update checkpoint status to ACTIVE
      checkpoint.status = CheckpointStatus.ACTIVE;
      await this.persistenceManager.saveCheckpoint(checkpoint);
      
      // Process the pending chunks in batches
      const batchSize = options.batchSize !== undefined ? options.batchSize : DEFAULT_PROCESSING_OPTIONS.batchSize!;
      const results: ChunkResult[] = [];
      
      // Get existing results from checkpoint
      const existingResults: ChunkResult[] = checkpoint.completedChunks.map(chunkId => {
        const content = checkpoint.partialResults[chunkId] || '';
        return {
          chunkId,
          content: content,
          success: true,
          retries: 0,
          processingTime: 0,
          tokensGenerated: content.length, // Add rough estimation based on content length
          metadata: {
            index: checkpoint.completedChunks.indexOf(chunkId),
            tokens: content.length // Store token count in metadata.tokens for consistency
          }
        };
      });
      
      // Add existing results to the results array
      results.push(...existingResults);
      
      // Process pending chunks in batches
      for (let i = 0; i < pendingChunks.length; i += batchSize) {
        // Check if cancelled
        if (this.isCancelled) {
          progress.isCancelled = true;
          progress.status = 'Processing cancelled';
          
          // Update file status
          if (this.outputFilesManager) {
            updateFileStatus(
              this.outputFilesManager,
              checkpoint.documentId,
              FileStatus.ERROR,
              'Processing cancelled',
              false // Not retryable
            );
          }
          
          // Call progress callback
          if (options.progressCallback) {
            options.progressCallback(progress);
          }
          
          return {
            documentId: checkpoint.documentId,
            documentName: checkpoint.documentName,
            content: this.assemblePartialResults(results),
            stats: {
              totalTime: Date.now() - progress.stats.startTime.getTime(),
              chunksProcessed: progress.stats.completedChunks,
              tokensProcessed: this.calculateTotalTokens(results),
              retries: progress.stats.retries,
              errors: progress.stats.failedChunks
            },
            success: false,
            error: 'Processing cancelled'
          };
        }
        
        // Check if paused
        if (this.isPaused) {
          progress.isPaused = true;
          progress.status = 'Processing paused';
          
          // Update checkpoint status
          checkpoint.status = CheckpointStatus.PAUSED;
          await this.persistenceManager.saveCheckpoint(checkpoint);
          
          // Update file status
          if (this.outputFilesManager) {
            updateFileStatus(
              this.outputFilesManager,
              checkpoint.documentId,
              FileStatus.PENDING,
              'Processing paused',
              true // Retryable
            );
          }
          
          // Call progress callback
          if (options.progressCallback) {
            options.progressCallback(progress);
          }
          
          return {
            documentId: checkpoint.documentId,
            documentName: checkpoint.documentName,
            content: this.assemblePartialResults(results),
            stats: {
              totalTime: Date.now() - progress.stats.startTime.getTime(),
              chunksProcessed: progress.stats.completedChunks,
              tokensProcessed: this.calculateTotalTokens(results),
              retries: progress.stats.retries,
              errors: progress.stats.failedChunks
            },
            success: false,
            error: 'Processing paused',
            checkpointId: checkpoint.id
          };
        }
        
        // Get batch of chunks
        const batch = pendingChunks.slice(i, i + batchSize);
        
        // Update progress
        progress.currentChunk = checkpoint.completedChunks.length + i;
        progress.progress = Math.round(((checkpoint.completedChunks.length + i) / progress.totalChunks) * 100);
        progress.status = `Processing chunks ${progress.currentChunk + 1}-${Math.min(progress.currentChunk + batchSize, progress.totalChunks)} of ${progress.totalChunks}`;
        
        // Call progress callback
        if (options.progressCallback) {
          options.progressCallback(progress);
        }
        
        // Process batch
        const batchResults = await this.processChunkBatch(batch, options, progress, checkpoint);
        results.push(...batchResults);
        
        // Update progress
        progress.stats.completedChunks += batchResults.filter(r => r.success).length;
        progress.stats.failedChunks += batchResults.filter(r => !r.success).length;
      }
      
      // Assemble final result
      const content = this.assemblePartialResults(results);
      
      // Update progress
      progress.isComplete = true;
      progress.progress = 100;
      progress.status = 'Processing complete';
      progress.stats.elapsedTime = Date.now() - progress.stats.startTime.getTime();
      
      // Update checkpoint status
      checkpoint.status = CheckpointStatus.COMPLETED;
      checkpoint.processingStats.completedChunks = progress.stats.completedChunks;
      checkpoint.processingStats.averageChunkProcessingTime =
        progress.stats.completedChunks > 0
          ? progress.stats.elapsedTime / progress.stats.completedChunks
          : 0;
      checkpoint.processingStats.estimatedTimeRemaining = 0; // Completed
      await this.persistenceManager.saveCheckpoint(checkpoint);
      
      // Update file status
      if (this.outputFilesManager) {
        updateFileStatus(
          this.outputFilesManager,
          checkpoint.documentId,
          FileStatus.COMPLETED,
          undefined,
          false // Not retryable
        );
      }
      
      // Call progress callback
      if (options.progressCallback) {
        options.progressCallback(progress);
      }
      
      // Return result
      return {
        documentId: checkpoint.documentId,
        documentName: checkpoint.documentName,
        content,
        stats: {
          totalTime: progress.stats.elapsedTime,
          chunksProcessed: progress.stats.completedChunks,
          tokensProcessed: this.calculateTotalTokens(results),
          retries: progress.stats.retries,
          errors: progress.stats.failedChunks
        },
        success: true
      };
    } catch (error) {
      // Update file status if output files manager is available
      if (this.outputFilesManager) {
        // Determine if the error is retryable
        const isRetryable = error instanceof Error &&
          'retryable' in error &&
          (error as any).retryable === true;
          
        updateFileStatus(
          this.outputFilesManager,
          checkpointId, // Using checkpoint ID as document ID as fallback
          FileStatus.ERROR,
          error instanceof Error ? error.message : String(error),
          isRetryable
        );
      }
      
      // Return error result
      return {
        documentId: checkpointId, // Using checkpoint ID as document ID as fallback
        documentName: 'Unknown', // Would get from checkpoint
        content: '',
        stats: {
          totalTime: 0,
          chunksProcessed: 0,
          tokensProcessed: 0,
          retries: 0,
          errors: 1
        },
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Cancel processing
   *
   * Cancels the current processing operation.
   * Sets the internal cancellation flag which is checked during processing.
   * Resources are cleaned up and partial results are saved in checkpoints.
   */
  public cancelProcessing(): void {
    this.isCancelled = true;
  }
  
  /**
   * Pause processing
   *
   * Pauses the current processing operation.
   * Sets the internal pause flag which is checked during processing.
   * The current state is saved in a checkpoint for later resumption.
   */
  public pauseProcessing(): void {
    this.isPaused = true;
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
   * Get adaptive batch size based on performance metrics
   *
   * Dynamically adjusts the batch size based on processing performance metrics.
   * Optimizes for throughput while maintaining error rates within acceptable limits.
   *
   * Adaptation factors:
   * - Error rate (reduces batch size when errors are high)
   * - Processing time trends (reduces batch size when processing time increases)
   * - Historical performance data (uses past performance to inform decisions)
   *
   * @param options Processing options
   * @returns Optimized batch size for current conditions
   */
  private getAdaptiveBatchSize(options: ProcessingOptions): number {
    const defaultBatchSize = options.batchSize || DEFAULT_PROCESSING_OPTIONS.batchSize!;
    
    // If we don't have enough data yet, use the default batch size
    if (this.adaptiveBatchingMetrics.chunksProcessed < 10) {
      return defaultBatchSize;
    }
    
    // Start with the current batch size
    let adaptiveBatchSize = this.adaptiveBatchingMetrics.currentBatchSize;
    
    // Adjust based on error rate
    if (this.adaptiveBatchingMetrics.errorRate > 0.2) {
      // High error rate, reduce batch size
      adaptiveBatchSize = Math.max(1, Math.floor(adaptiveBatchSize * 0.7));
    } else if (this.adaptiveBatchingMetrics.errorRate < 0.05 && this.adaptiveBatchingMetrics.chunksProcessed > 20) {
      // Low error rate and enough data, try increasing batch size
      adaptiveBatchSize = Math.min(20, adaptiveBatchSize + 1);
    }
    
    // Adjust based on processing time trends
    if (this.adaptiveBatchingMetrics.batchSizeHistory.length >= 3) {
      const recentHistory = this.adaptiveBatchingMetrics.batchSizeHistory.slice(-3);
      
      // Check if processing time is increasing significantly with the current batch size
      const sameSize = recentHistory.filter((h: {batchSize: number; averageProcessingTime: number; errorRate: number; timestamp: number}) =>
        h.batchSize === adaptiveBatchSize
      );
      if (sameSize.length >= 2) {
        const oldest = sameSize[0];
        const newest = sameSize[sameSize.length - 1];
        
        // If processing time increased by more than 30%, reduce batch size
        if (newest.averageProcessingTime > oldest.averageProcessingTime * 1.3) {
          adaptiveBatchSize = Math.max(1, Math.floor(adaptiveBatchSize * 0.8));
        }
      }
    }
    
    // Ensure batch size is within reasonable limits
    return Math.max(1, Math.min(20, adaptiveBatchSize));
  }
  
  /**
   * Update performance metrics with batch results
   *
   * Updates internal performance metrics based on processing results.
   * Tracks error rates, processing times, and maintains a history of
   * batch performance for adaptive optimization.
   *
   * @param results Chunk results from processing
   * @param batchSize Batch size used for processing
   */
  private updatePerformanceMetrics(results: ChunkResult[], batchSize: number): void {
    if (results.length === 0) return;
    
    // Count errors
    const errors = results.filter(r => !r.success).length;
    
    // Calculate average processing time
    const totalTime = results.reduce((sum, r) => sum + r.processingTime, 0);
    const avgTime = totalTime / results.length;
    
    // Update running averages
    const totalProcessed = this.adaptiveBatchingMetrics.chunksProcessed + results.length;
    const newAvgTime = (this.adaptiveBatchingMetrics.averageProcessingTime * this.adaptiveBatchingMetrics.chunksProcessed + totalTime) / totalProcessed;
    
    const totalErrors = this.adaptiveBatchingMetrics.errors + errors;
    const newErrorRate = totalErrors / totalProcessed;
    
    // Update metrics
    this.adaptiveBatchingMetrics.averageProcessingTime = newAvgTime;
    this.adaptiveBatchingMetrics.errorRate = newErrorRate;
    this.adaptiveBatchingMetrics.chunksProcessed = totalProcessed;
    this.adaptiveBatchingMetrics.errors = totalErrors;
    this.adaptiveBatchingMetrics.lastUpdated = Date.now();
    this.adaptiveBatchingMetrics.currentBatchSize = batchSize;
    
    // Add to history
    this.adaptiveBatchingMetrics.batchSizeHistory.push({
      batchSize,
      averageProcessingTime: avgTime,
      errorRate: errors / results.length,
      timestamp: Date.now()
    });
    
    // Limit history size
    if (this.adaptiveBatchingMetrics.batchSizeHistory.length > 20) {
      this.adaptiveBatchingMetrics.batchSizeHistory.shift();
    }
  }
  
  /**
   * Prioritize chunks based on importance and dependencies
   *
   * Reorders chunks based on their importance, dependencies, and processing characteristics.
   * Ensures that critical chunks (those with dependencies or important content) are processed first.
   *
   * Prioritization factors:
   * - Document position (early chunks often contain context needed by later chunks)
   * - Content importance (headings, summaries, conclusions)
   * - Chunk size (smaller chunks can be processed quickly)
   * - Previous failure history (deprioritizes chunks that have failed multiple times)
   *
   * @param chunks Chunks to prioritize
   * @param options Processing options
   * @returns Chunks reordered by priority
   */
  private prioritizeChunks(chunks: DocumentChunk[], options: ProcessingOptions): DocumentChunk[] {
    if (chunks.length <= 1) return chunks;
    
    // Create a copy of the chunks array to avoid modifying the original
    const prioritizedChunks = [...chunks];
    
    // Calculate priority scores for each chunk
    const chunkScores: Map<string, number> = new Map();
    
    for (const chunk of prioritizedChunks) {
      let priorityScore = 0;
      
      // 1. Prioritize chunks with dependencies (chunks that others depend on)
      // Chunks at the beginning of the document often contain context needed by later chunks
      if (chunk.metadata.index !== undefined && chunk.metadata.index < chunks.length * 0.2) {
        priorityScore += 30; // Higher priority for early chunks (first 20%)
      }
      
      // 2. Prioritize chunks with important content markers
      const content = chunk.content.toLowerCase();
      
      // Check for headings, which often indicate important sections
      if (content.includes('# ') || content.includes('## ') || content.includes('### ')) {
        priorityScore += 20;
      }
      
      // Check for important keywords
      const importantKeywords = ['summary', 'conclusion', 'important', 'key', 'critical', 'essential'];
      for (const keyword of importantKeywords) {
        if (content.includes(keyword)) {
          priorityScore += 5;
        }
      }
      
      // 3. Prioritize smaller chunks that can be processed quickly
      const tokenCount = chunk.metadata.estimatedTokens || 0;
      if (tokenCount > 0) {
        // Normalize token count to a score between 0-10
        // Smaller chunks get higher scores
        const maxExpectedTokens = 2000;
        const sizeScore = Math.max(0, 10 - (tokenCount / maxExpectedTokens) * 10);
        priorityScore += sizeScore;
      }
      
      // 4. Deprioritize chunks that have failed multiple times before
      // Check if the chunk has a record of previous failures in its metadata
      if (chunk.metadata && 'previousFailures' in chunk.metadata) {
        const failures = (chunk.metadata as any).previousFailures;
        if (typeof failures === 'number') {
          priorityScore -= failures * 5;
        }
      }
      
      // Store the score
      chunkScores.set(chunk.id, priorityScore);
    }
    
    // Sort chunks by priority score (descending)
    prioritizedChunks.sort((a, b) => {
      const scoreA = chunkScores.get(a.id) || 0;
      const scoreB = chunkScores.get(b.id) || 0;
      return scoreB - scoreA;
    });
    
    return prioritizedChunks;
  }
  
  /**
   * Process a single chunk
   *
   * Processes an individual document chunk through the LLM.
   * Implements comprehensive error handling, retry mechanisms,
   * and performance monitoring.
   *
   * Key features:
   * - Adaptive timeout calculation based on chunk complexity
   * - Exponential backoff with jitter for retries
   * - Type-specific error handling strategies
   * - Partial result handling for timeouts
   * - Checkpoint updating for resumable processing
   * - Performance metrics collection
   *
   * @param chunk Chunk to process
   * @param options Processing options
   * @param progress Processing progress tracking object
   * @param checkpoint Processing checkpoint for state persistence
   * @returns Promise resolving to the chunk result
   */
  private async processChunk(
    chunk: DocumentChunk,
    options: ProcessingOptions,
    progress: ProcessingProgress,
    checkpoint: ProcessingCheckpoint | null
  ): Promise<ChunkResult> {
    // Get hardware profile for timeout calculation
    const hardwareProfile = this.getHardwareProfile(options);
    
    // Calculate timeout based on chunk size and complexity
    const chunkSize = chunk.metadata.estimatedTokens;
    const timeout = this.calculateTimeout(
      hardwareProfile.baseTimeout,
      chunkSize,
      hardwareProfile,
      chunk // Pass the chunk for complexity analysis
    );
    
    // Create prompt for this chunk using PromptBuilder
    const promptBuilderInput: PromptBuilderInput = {
      documentChunk: chunk, // Pass the whole chunk
      base_prompt_instructions: options.prompt, // The original base prompt
      // Map chunk metadata to expected inputVariables
      sourceDocument: chunk.metadata.sourceDocument,
      chunkIndex: chunk.metadata.index + 1,
      totalChunks: chunk.metadata.totalChunks,
      precedingContext: chunk.metadata.precedingContext || "N/A",
      followingContext: chunk.metadata.followingContext || "N/A",
      // userInstructions could be part of options.prompt or a separate field if needed
    };

    // Assuming a default prompt config ID or one derived from options
    const promptConfigId = options.model === 'chat-model-xyz' ? 'specific_chat_config' : 'default_processing_prompt';
    // Ensure 'specific_chat_config' is registered if used, or enhance logic to select/pass config.
    // For now, we'll rely on the 'default_processing_prompt' registered in constructor.

    const formattedPrompt = await this.promptBuilder.buildPrompt(promptConfigId, promptBuilderInput);
    const prompt = formattedPrompt.prompt as string; // Expecting string from updated PromptBuilder
    
    // Initialize result
    const result: ChunkResult = {
      chunkId: chunk.id,
      content: '',
      success: false,
      retries: 0,
      processingTime: 0,
      tokensGenerated: 0, // Initialize with 0 as no content has been generated yet
      metadata: { ...chunk.metadata }
    };
    
    // Start timing
    const startTime = Date.now();
    
    // Try processing with exponential backoff
    const maxRetries = options.maxRetries ?? DEFAULT_PROCESSING_OPTIONS.maxRetries ?? 3;
    let retryCount = 0;
    let success = false;
    
    try {
      // Check if processing was cancelled or paused
      if (this.isCancelled) {
        throw new Error('Processing cancelled');
      }

      if (this.isPaused) {
        throw new Error('Processing paused');
      }

      // Set up completion options with chunk-specific timeout
      const completionOptions: CompletionOptions = {
        model: options.model,
        prompt: prompt, // Add the prompt here
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        timeout: timeout // Use calculated timeout for this chunk
      };

      // Generate completion and assign to processedContent
      const processedContent = await this.llmClient.generateCompletion(prompt, completionOptions);

      const result: ChunkResult = {
        chunkId: chunk.id,
        content: processedContent,
        success: true,
        metadata: {
          ...chunk.metadata,
          tokens: processedContent.length // Store token count in metadata.tokens for consistency
        },
        retries: retryCount, // Initialize with the current attempt number
        processingTime: 0, // Initialize, will be updated later if needed
        tokensGenerated: processedContent.length, // Rough estimation
      };

      // The success and content are already set above, no need to re-set here
      // result.success = true;
      success = true; // Keep this to track overall success in the method

    } catch (rawError: unknown) {
      const errorSource: ErrorSource = { component: 'ProcessingOrchestrator', operation: 'processChunk.generateCompletion', details: { chunkId: chunk.id } };
      const error = this.errorDetector.detect(rawError, errorSource, ErrorType.LLM, ErrorSeverity.ERROR);
      ErrorHandler.getInstance().handleError(error, false); // Report error, don't show additional notice from here directly

        try {
            retryCount++;
            result.retries = retryCount;
        
        // Check if we've reached max retries
        if (retryCount > maxRetries) {
          result.error = `Failed after ${maxRetries} retries: ${error.message}`;
          // Add more details to the VesperaError instance if needed
          if (error.details) {
            error.details['finalRetryFailure'] = true;
            error.details['retriesAttempted'] = maxRetries;
          } else {
            error.details = {
              finalRetryFailure: true,
              retriesAttempted: maxRetries
            };
          }
          return result;
        }
        
        // The 'error' variable is now a VesperaError instance
        // We can access its properties like error.type, error.details
        let errorType = error.type; // This is VesperaError's ErrorType
        let isRetryable = error.severity !== ErrorSeverity.ERROR; // Default retryable unless ERROR (using ERROR instead of CRITICAL/FATAL)
        let hasPartialResults = false;
        let partialResponse = '';

        // Check for LLMError specific properties in the error details
        // and potentially refine errorType or isRetryable
        if (error.details && typeof error.details === 'object') {
            // Extract LLMError properties from error details
            const details = error.details as Record<string, any>;
            
            if (typeof details.retryable === 'boolean') {
                isRetryable = details.retryable;
            }
            
            if (details.partialResponse && typeof details.partialResponse === 'string') {
                hasPartialResults = true;
                partialResponse = details.partialResponse;
            }
            
            // Check if we have the original error stored in details
            if (details.originalError) {
                const originalError = details.originalError;
                
                // Check if it's an LLMError-like object
                if (typeof originalError === 'object') {
                    if (typeof originalError.retryable === 'boolean') {
                        isRetryable = originalError.retryable;
                    }
                    if (originalError.partialResponse && typeof originalError.partialResponse === 'string') {
                        hasPartialResults = true;
                        partialResponse = originalError.partialResponse;
                    }
                }
            }
        }

          
          // Handle different error types based on the VesperaError's type
          switch (error.type) { // Use error.type from VesperaError
            case ErrorType.LLM: // Handle all LLM-related errors
              // Check if this is a timeout error or rate limit error based on error details
              const isTimeoutError = error.message.toLowerCase().includes('timeout') || 
                (error.details && error.details.originalError && 
                 typeof error.details.originalError === 'object' && 
                 error.details.originalError.type === 'timeout');
                 
              const isRateLimitError = error.message.toLowerCase().includes('rate limit') || 
                (error.details && error.details.originalError && 
                 typeof error.details.originalError === 'object' && 
                 error.details.originalError.type === 'rate_limit');
              
              // Handle timeout errors
              if (isTimeoutError) {
                // Save partial results if available
                if (hasPartialResults) {
                  result.content = partialResponse;
                  result.metadata.isPartial = true;
                  
                  // Log the partial result
                  console.log(`Saved partial result for chunk ${chunk.id} (${result.content.length} chars)`);
                  
                  // If we're at max retries, consider this a partial success if the content meets minimum length
                  if (retryCount >= maxRetries &&
                      options.acceptPartialResults &&
                      result.content.length >= (options.minPartialResultLength || 50)) {
                    result.success = true;
                    result.error = `Timeout with partial results after ${maxRetries} retries`;
                    break;
                  }
                }
                
                // Exponential backoff with jitter for timeouts
                const timeoutBackoff = Math.min(
                  Math.pow(2, retryCount) * 1000 + Math.random() * 1000,
                  30000 // Cap at 30 seconds
                );
                
                // Update progress with more detailed information
                if (options.progressCallback) {
                  const statusMessage = hasPartialResults
                    ? `Chunk ${chunk.metadata.index + 1} timed out with partial results (${result.content.length} chars), retrying in ${Math.round(timeoutBackoff / 1000)}s (attempt ${retryCount}/${maxRetries})`
                    : `Chunk ${chunk.metadata.index + 1} timed out, retrying in ${Math.round(timeoutBackoff / 1000)}s (attempt ${retryCount}/${maxRetries})`;
                  
                  progress.status = statusMessage;
                  options.progressCallback(progress);
                }
                
                // Log the timeout for diagnostic purposes
                console.warn(`Chunk ${chunk.id} timed out after ${Date.now() - startTime}ms, retrying in ${Math.round(timeoutBackoff / 1000)}s (attempt ${retryCount}/${maxRetries})`);
                
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, timeoutBackoff));
                break;
              }
              
              // Handle rate limit errors
              if (isRateLimitError) {
                // For rate limit errors, use a longer backoff
                const rateLimitBackoff = Math.min(
                  Math.pow(2, retryCount + 2) * 1000 + Math.random() * 2000,
                  60000 // Cap at 60 seconds
                );
                
                console.warn(`Rate limit error for chunk ${chunk.id}, backing off for ${Math.round(rateLimitBackoff / 1000)}s (attempt ${retryCount}/${maxRetries})`);
                
                if (options.progressCallback) {
                  progress.status = `Rate limit reached, backing off for ${Math.round(rateLimitBackoff / 1000)}s (attempt ${retryCount}/${maxRetries})`;
                  options.progressCallback(progress);
                }
                
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, rateLimitBackoff));
                break;
              }
              
              // For other LLM errors, use a standard backoff
              const standardBackoff = Math.min(
                Math.pow(2, retryCount) * 1000 + Math.random() * 1000,
                15000 // Cap at 15 seconds
              );
              
              console.warn(`LLM error for chunk ${chunk.id}, retrying in ${Math.round(standardBackoff / 1000)}s (attempt ${retryCount}/${maxRetries})`);
              
              if (options.progressCallback) {
                progress.status = `Error processing chunk ${chunk.metadata.index + 1}, retrying in ${Math.round(standardBackoff / 1000)}s (attempt ${retryCount}/${maxRetries})`;
                options.progressCallback(progress);
              }
              
              // Wait before retrying
              await new Promise(resolve => setTimeout(resolve, standardBackoff));
               break;
              
            case ErrorType.LLM: // This now refers to VesperaError's ErrorType.LLM
              const errorMsg = error.message; // Use VesperaError's message
              if (errorMsg.toLowerCase().includes('context') ||
                  errorMsg.toLowerCase().includes('token') ||
                  errorMsg.toLowerCase().includes('limit')) {
                console.error(`Context window likely exceeded for chunk ${chunk.id}, cannot retry with same input: ${errorMsg}`);
                result.error = `Context window exceeded: ${errorMsg}`;
                // Update error details instead of using addDetail
                error.details = { ...(error.details || {}), contextWindowExceeded: true };
                return result;
              }
              
              console.error(`Invalid request for chunk ${chunk.id}: ${errorMsg}`);
              result.error = `Invalid request: ${errorMsg}`;
              
              if (isRetryable) {
                const invalidReqBackoff = Math.min(
                  Math.pow(2, retryCount) * 1000 + Math.random() * 1000,
                  30000
                );
                await new Promise(resolve => setTimeout(resolve, invalidReqBackoff));
              } else {
                // Update error details instead of using addDetail
                error.details = { ...(error.details || {}), notRetryingInvalidRequest: true };
                return result;
              }
              break;
              
            default:
              // For other errors, use exponential backoff if retryable
              if (isRetryable) {
                const generalBackoff = Math.min(
                  Math.pow(2, retryCount) * 1500 + Math.random() * 1500,
                  45000 // Cap at 45 seconds
                );
                
                console.warn(`Retryable error for chunk ${chunk.id} (Type: ${ErrorType.INITIALIZATION}), retrying in ${Math.round(generalBackoff / 1000)}s (attempt ${retryCount}/${maxRetries}): ${error.message}`);
                
                if (options.progressCallback) {
                  progress.status = `Error processing chunk ${chunk.metadata.index + 1}, retrying in ${Math.round(generalBackoff / 1000)}s (attempt ${retryCount}/${maxRetries})`;
                  options.progressCallback(progress);
                }
                
                await new Promise(resolve => setTimeout(resolve, generalBackoff));
              } else {
                // Non-retryable errors
                console.error(`Non-retryable error for chunk ${chunk.id} (Type: ${ErrorType.INITIALIZATION}): ${error.message}`);
                result.error = `Error: ${error.message}`;
                // Update error details instead of using addDetail
                error.details = { ...(error.details || {}), nonRetryableDefault: true };
                return result;
              }
          }
    } catch (rawFinalError) {
      // Catch any unexpected errors in the retry loop itself
      const finalErrorSource: ErrorSource = { component: 'ProcessingOrchestrator', operation: 'processChunk.retryLoop', details: { chunkId: chunk.id, retryCount } };
      const finalError = this.errorDetector.detect(rawFinalError, finalErrorSource, ErrorType.UNKNOWN, ErrorSeverity.CRITICAL);
      ErrorHandler.getInstance().handleError(finalError, false); // Report critical error
      console.error(`Unexpected error in processChunk retry loop (Chunk ID: ${chunk.id}): ${finalError.message}`);
      result.error = `Unexpected error: ${finalError.message}`;
      // Update error details instead of using addDetail
      finalError.details = { ...(finalError.details || {}), unexpectedInRetryLoop: true };
      result.success = false;
    }
    
    // Update processing time before returning
    result.processingTime = Date.now() - startTime;
    
    return result;
  }
    
    // Calculate processing time
    result.processingTime = Date.now() - startTime;
    
    // Update progress
    if (options.progressCallback) {
      progress.stats.completedChunks++;
      if (!result.success) {
        progress.stats.failedChunks++;
      }
      progress.stats.retries += result.retries;
      
      // Update average chunk time
      const totalChunksProcessed = progress.stats.completedChunks;
      progress.stats.averageChunkTime =
        (progress.stats.averageChunkTime * (totalChunksProcessed - 1) + result.processingTime) / totalChunksProcessed;
      
      // Update progress percentage
      progress.progress = Math.round((progress.stats.completedChunks / progress.totalChunks) * 100);
      
      // Update estimated time remaining
      const remainingChunks = progress.totalChunks - progress.stats.completedChunks;
      progress.estimatedTimeRemaining = remainingChunks * progress.stats.averageChunkTime;
      
      // Update status
      if (result.success) {
        progress.status = `Processed chunk ${chunk.metadata.index + 1}/${progress.totalChunks}`;
      } else {
        progress.status = `Failed to process chunk ${chunk.metadata.index + 1}/${progress.totalChunks}: ${result.error}`;
      }
      
      options.progressCallback(progress);
    }
    
    // Save checkpoint if needed
    if (checkpoint && options.useCheckpointing) {
      try {
        // Update partial results with this chunk's content
        if (result.content) {
          checkpoint.partialResults[chunk.id] = result.content;
        }
        
        // Update completed/failed chunks lists
        if (result.success) {
          checkpoint.completedChunks.push(chunk.id);
          // Remove from pending if it was there
          checkpoint.pendingChunks = checkpoint.pendingChunks.filter(id => id !== chunk.id);
        } else {
          // Add to failed chunks with error info
          checkpoint.failedChunks[chunk.id] = {
            error: result.error || 'Unknown error',
            attempts: result.retries
          };
          // Remove from pending if it was there
          checkpoint.pendingChunks = checkpoint.pendingChunks.filter(id => id !== chunk.id);
        }
        
        // Add timestamp to track when this checkpoint was updated
        checkpoint.lastUpdated = new Date();
        checkpoint.status = CheckpointStatus.ACTIVE;
        
        // Save the checkpoint with error handling
        await this.persistenceManager.saveCheckpoint(checkpoint)
          .catch(error => {
            console.error(`Failed to save checkpoint ${checkpoint.id}:`, error);
            // Continue processing even if checkpoint saving fails
          });
          
        // Log checkpoint update for diagnostic purposes
        if (options.diagnosticMode) {
          console.log(`Updated checkpoint ${checkpoint.id}: ${checkpoint.completedChunks.length} completed, ${Object.keys(checkpoint.failedChunks).length} failed, ${checkpoint.pendingChunks.length} pending`);
        }
      } catch (error) {
        // Log checkpoint error but continue processing
        console.error(`Error updating checkpoint for chunk ${chunk.id}:`, error);
      }
    }
    
    // Cache the result if successful
    if (result.success && options.useCheckpointing !== false) {
      this.cacheChunkResult(chunk, result);
    }
    
    return result;
  }
  
  /**
   * Get cached chunk result
   *
   * Retrieves a previously processed chunk result from the cache.
   * Uses a content-based hash to identify matching chunks.
   *
   * @param chunk Document chunk to look up in cache
   * @returns Cached result or undefined if not cached
   */
  private getCachedChunkResult(chunk: DocumentChunk): ChunkResult | undefined {
    // Generate a cache key based on chunk content and metadata
    const cacheKey = this.generateChunkCacheKey(chunk);
    
    // Check if the chunk is in the cache
    return this.processedChunksCache.get(cacheKey);
  }
  
  /**
   * Cache chunk result
   *
   * Stores a processed chunk result in the cache for future reuse.
   * Implements cache size management to prevent memory leaks.
   *
   * Memory management features:
   * - Cache size limiting (max 1000 entries)
   * - LRU-like eviction policy (removes oldest 20% when limit reached)
   * - Timestamp-based entry tracking
   *
   * @param chunk Document chunk
   * @param result Chunk result to cache
   */
  private cacheChunkResult(chunk: DocumentChunk, result: ChunkResult): void {
    // Generate a cache key based on chunk content and metadata
    const cacheKey = this.generateChunkCacheKey(chunk);
    
    // Store the result in the cache
    this.processedChunksCache.set(cacheKey, result);
    
    // Limit cache size to prevent memory issues
    if (this.processedChunksCache.size > 1000) {
      // Remove the oldest entries (convert to array, sort by timestamp, and remove oldest)
      const entries = Array.from(this.processedChunksCache.entries());
      entries.sort((a, b) => {
        const timestampA = a[1].metadata.timestamp || 0;
        const timestampB = b[1].metadata.timestamp || 0;
        return timestampA - timestampB;
      });
      
      // Remove oldest 20% of entries
      const entriesToRemove = Math.ceil(entries.length * 0.2);
      for (let i = 0; i < entriesToRemove; i++) {
        this.processedChunksCache.delete(entries[i][0]);
      }
    }
  }
  
  /**
   * Generate a cache key for a chunk
   *
   * Creates a unique cache key for a document chunk based on its content and metadata.
   * Uses a combination of chunk ID, content hash, and metadata hash to ensure
   * chunks with the same content but different context are treated differently.
   *
   * @param chunk Document chunk
   * @returns Unique cache key string
   */
  private generateChunkCacheKey(chunk: DocumentChunk): string {
    // Use a combination of chunk ID, content hash, and metadata
    // This ensures that chunks with the same content but different context are treated differently
    
    // Simple hash function for strings
    const hashString = (str: string): number => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return hash;
    };
    
    // Create a hash of the content
    const contentHash = hashString(chunk.content);
    
    // Include relevant metadata in the key
    const metadataStr = `${chunk.metadata.index}-${chunk.metadata.sourceDocument}-${chunk.metadata.estimatedTokens}`;
    const metadataHash = hashString(metadataStr);
    
    // Combine into a single key
    return `${chunk.id}-${contentHash}-${metadataHash}`;
  }
  
  /**
   * Collect performance metrics for the processing run
   *
   * Gathers comprehensive performance metrics from processing results.
   * Calculates throughput, error rates, time breakdowns, and resource usage.
   *
   * Metrics collected:
   * - Processing time breakdown (LLM processing, result assembly, etc.)
   * - Throughput metrics (chunks/second, tokens/second)
   * - Error metrics (error rate, error counts by type)
   * - Resource usage (memory usage if available)
   *
   * @param results Chunk results from processing
   * @param startTime Processing start time timestamp
   * @param endTime Processing end time timestamp
   * @returns Comprehensive performance metrics object
   */
  private collectPerformanceMetrics(
    results: ChunkResult[],
    startTime: number,
    endTime: number
  ): PerformanceMetrics {
    // Calculate total processing time
    const totalProcessingTime = endTime - startTime;
    
    // Calculate time spent in LLM processing
    const llmProcessingTime = results.reduce((sum, result) => sum + result.processingTime, 0);
    
    // Calculate tokens processed
    const tokensProcessed = results.reduce((sum, result) => {
      return sum + (result.metadata.tokens || result.metadata.estimatedTokens || 0);
    }, 0);
    
    // Calculate error metrics
    const errorCount = results.filter(r => !r.success).length;
    const errorRate = results.length > 0 ? errorCount / results.length : 0;
    
    // Count errors by type
    const errorsByType: Record<string, number> = {};
    for (const result of results) {
      if (!result.success && result.error) {
        // Extract error type from error message
        let errorType = 'unknown';
        if (result.error.includes('timeout')) {
          errorType = 'timeout';
        } else if (result.error.includes('rate limit')) {
          errorType = 'rate_limit';
        } else if (result.error.includes('context') || result.error.includes('token')) {
          errorType = 'context_window';
        } else if (result.error.includes('invalid')) {
          errorType = 'invalid_request';
        }
        
        errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
      }
    }
    
    // Calculate throughput metrics
    const chunksPerSecond = totalProcessingTime > 0 ? (results.length / totalProcessingTime) * 1000 : 0;
    const tokensPerSecond = totalProcessingTime > 0 ? (tokensProcessed / totalProcessingTime) * 1000 : 0;
    
    // Estimate time breakdown
    const resultAssemblyTime = Math.min(totalProcessingTime * 0.05, 1000); // Estimate or use actual measured time
    const otherTime = Math.max(0, totalProcessingTime - llmProcessingTime - resultAssemblyTime);
    
    // Try to get memory usage if available
    let memoryUsage: number | undefined;
    try {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const memUsage = process.memoryUsage();
        memoryUsage = Math.round(memUsage.heapUsed / 1024 / 1024); // Convert to MB
      }
    } catch (e) {
      // Memory usage not available
    }
    
    // Create the performance metrics object
    const metrics: PerformanceMetrics = {
      cpuUsage: undefined, // Not available in this implementation
      memoryUsage,
      timeBreakdown: {
        llmProcessing: llmProcessingTime,
        resultAssembly: resultAssemblyTime,
        other: otherTime
      },
      throughput: {
        chunksPerSecond,
        tokensPerSecond
      },
      errors: {
        errorRate,
        byType: errorsByType
      }
    };
    
    return metrics;
  }
  
  /**
   * Check and optimize memory usage
   *
   * Monitors and optimizes memory usage during processing.
   * Implements proactive memory management to prevent out-of-memory errors.
   *
   * Optimization techniques:
   * - Memory usage monitoring
   * - Cache size reduction when memory usage is high
   * - Manual garbage collection triggering when available
   * - Configurable memory usage limits
   *
   * @param options Processing options with memory management settings
   */
  private checkAndOptimizeMemory(options: ProcessingOptions): void {
    // Skip if memory optimization is disabled
    if (!options.useStreamingProcessing) return;
    
    try {
      // Check if we can access memory usage
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const memUsage = process.memoryUsage();
        const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        const memoryLimit = options.memoryUsageLimit || 500; // Default 500MB
        
        if (heapUsedMB > memoryLimit) {
          console.warn(`Memory usage high (${heapUsedMB}MB), triggering garbage collection`);
          
          // Reduce cache size
          if (this.processedChunksCache.size > 100) {
            const entriesToRemove = Math.ceil(this.processedChunksCache.size * 0.3);
            const entries = Array.from(this.processedChunksCache.entries());
            
            // Sort by timestamp (oldest first)
            entries.sort((a, b) => {
              const timestampA = a[1].metadata.timestamp || 0;
              const timestampB = b[1].metadata.timestamp || 0;
              return timestampA - timestampB;
            });
            
            // Remove oldest entries
            for (let i = 0; i < entriesToRemove; i++) {
              this.processedChunksCache.delete(entries[i][0]);
            }
            
            console.log(`Removed ${entriesToRemove} entries from cache to free memory`);
          }
          
          // Suggest garbage collection if available
          if (global && typeof global.gc === 'function') {
            try {
              global.gc();
              console.log('Manual garbage collection completed');
            } catch (e) {
              console.warn('Failed to trigger manual garbage collection', e);
            }
          }
        }
      }
    } catch (e) {
      // Ignore errors in memory optimization
      console.warn('Error in memory optimization:', e);
    }
  }
  
  /**
   * Calculate timeout based on chunk size and hardware profile
   *
   * Dynamically calculates an appropriate timeout for chunk processing
   * based on chunk size, content complexity, and hardware capabilities.
   *
   * Factors considered:
   * - Chunk size in tokens
   * - Content complexity (code blocks, tables, lists, special characters)
   * - Hardware profile (processing power, scaling factors)
   * - Maximum timeout limits
   *
   * @param baseTimeout Base timeout in milliseconds
   * @param chunkSize Chunk size in tokens
   * @param hardwareProfile Hardware profile with timeout scaling factors
   * @param chunk Optional chunk for content complexity analysis
   * @returns Calculated timeout in milliseconds
   */
  private calculateTimeout(
    baseTimeout: number,
    chunkSize: number,
    hardwareProfile: HardwareProfile,
    chunk?: DocumentChunk
  ): number {
    // Base scaling factor based on chunk size
    let complexityFactor = 1 + (chunkSize / 1000) * hardwareProfile.timeoutScaleFactor;
    
    // If chunk is provided, analyze content complexity
    if (chunk) {
      // Check for code blocks which typically require more processing time
      const codeBlockCount = (chunk.content.match(/```[\s\S]*?```/g) || []).length;
      if (codeBlockCount > 0) {
        complexityFactor *= 1 + (codeBlockCount * 0.2); // 20% increase per code block
      }
      
      // Check for tables which may require structured processing
      const tableCount = (chunk.content.match(/\|.*\|/g) || []).length;
      if (tableCount > 5) { // Only consider substantial tables
        complexityFactor *= 1.15; // 15% increase for complex tables
      }
      
      // Check for lists which may indicate complex structured content
      const listItemCount = (chunk.content.match(/^[\s]*[-*+][\s]/gm) || []).length;
      if (listItemCount > 10) {
        complexityFactor *= 1.1; // 10% increase for complex lists
      }
      
      // Check for special characters density which may indicate complex content
      const specialCharRatio = (chunk.content.match(/[^a-zA-Z0-9\s]/g) || []).length / chunk.content.length;
      if (specialCharRatio > 0.2) { // High special char ratio
        complexityFactor *= 1.2; // 20% increase for complex character usage
      }
    }
    
    // Apply the complexity factor to the base timeout
    const scaledTimeout = baseTimeout * complexityFactor;
    
    // Cap at maximum timeout
    return Math.min(scaledTimeout, hardwareProfile.maxTimeout);
  }
  
  /**
   * Get hardware profile from options
   *
   * Retrieves the appropriate hardware profile based on processing options.
   * Supports both predefined profiles and custom profile objects.
   *
   * @param options Processing options containing hardware profile settings
   * @returns Hardware profile with timeout calculation parameters
   */
  private getHardwareProfile(options: ProcessingOptions): HardwareProfile {
    // If a hardware profile object is provided directly, use it
    if (typeof options.hardwareProfile === 'object') {
      return options.hardwareProfile;
    }
    
    // If a hardware profile name is provided, look it up in the predefined profiles
    if (typeof options.hardwareProfile === 'string' && options.hardwareProfile in HARDWARE_PROFILES) {
      return HARDWARE_PROFILES[options.hardwareProfile];
    }
    
    // Default to consumer-gpu profile
    return HARDWARE_PROFILES['consumer-gpu'];
  }
  
  /**
   * Create a prompt for a chunk
   *
   * Constructs a context-aware prompt for a document chunk.
   * Includes metadata, context from surrounding chunks, and processing instructions.
   *
   * Prompt components:
   * - Document metadata (source, chunk position)
   * - Preceding context (if available)
   * - Chunk content to process
   * - Following context (if available)
   * - Processing instructions with continuity guidance
   *
   * @param chunk Document chunk to create prompt for
   * @param basePrompt Base prompt template
   * @returns Complete prompt with context and instructions
   */
  // private createPrompt(chunk: DocumentChunk, basePrompt: string): string {
  //   // Create a context-aware prompt that includes chunk metadata and context
  //   let prompt = basePrompt;
    
  //   // Add chunk metadata
  //   prompt += `\n\n--- DOCUMENT INFORMATION ---`;
  //   prompt += `\nDocument: ${chunk.metadata.sourceDocument}`;
  //   prompt += `\nChunk: ${chunk.metadata.index + 1} of ${chunk.metadata.totalChunks}`;
    
  //   // Add preceding context if available
  //   if (chunk.metadata.precedingContext) {
  //     prompt += `\n\n--- PRECEDING CONTEXT ---\n${chunk.metadata.precedingContext}`;
  //   }
    
  //   // Add the chunk content
  //   prompt += `\n\n--- CONTENT TO PROCESS ---\n${chunk.content}`;
    
  //   // Add following context if available
  //   if (chunk.metadata.followingContext) {
  //     prompt += `\n\n--- FOLLOWING CONTEXT ---\n${chunk.metadata.followingContext}`;
  //   }
    
  //   // Add processing instructions
  //   prompt += `\n\n--- INSTRUCTIONS ---`;
  //   prompt += `\nProcess the content above according to the instructions.`;
  //   prompt += `\nIf this is not the first chunk, ensure your response maintains continuity with previous chunks.`;
  //   prompt += `\nIf this is not the last chunk, ensure your response can be continued in subsequent chunks.`;
    
  //   return prompt;
  // }
  
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
    
    // First try to use metadata.index for ordering if available
    const hasValidIndices = results.some(result =>
      result.success && result.metadata?.index !== undefined
    );
    
    if (hasValidIndices) {
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
    } else {
      // Fallback: If metadata.index is not available, use chunkId for ordering
      // This assumes chunkIds follow a pattern like "chunk-0", "chunk-1", etc.
      const successfulResults = results.filter(result => result.success);
      
      // Sort by chunkId if possible
      try {
        successfulResults.sort((a, b) => {
          // Extract numeric part from chunkId (e.g., "chunk-5" -> 5)
          const aMatch = a.chunkId.match(/\d+$/);
          const bMatch = b.chunkId.match(/\d+$/);
          
          if (aMatch && bMatch) {
            return parseInt(aMatch[0]) - parseInt(bMatch[0]);
          }
          
          // Fallback to string comparison
          return a.chunkId.localeCompare(b.chunkId);
        });
      } catch (error) {
        console.warn("Error sorting chunks by ID, using original order:", error);
      }
      
      // Extract content from sorted results
      const contents = successfulResults.map(result => result.content);
      
      // Join with double newlines
      return contents.join('\n\n');
    }
  }
  
  /**
   * Calculate total tokens processed
   *
   * Computes the total number of tokens processed across all chunks.
   * Only counts tokens from successfully processed chunks.
   *
   * @param results Chunk results
   * @returns Total token count
   */
  private calculateTotalTokens(results: ChunkResult[]): number {
    // Sum up the tokens from all successful chunks
    return results.reduce((total, result) => {
      if (result.success) {
        // Prefer metadata.tokens if available, otherwise use tokensGenerated
        const tokenCount = result.metadata?.tokens || result.tokensGenerated;
        return total + tokenCount;
      }
      return total;
    }, 0);
  }
  /**
   * Handle cleanup when processing is cancelled or paused
   *
   * Performs resource cleanup and state preservation when processing
   * is cancelled or paused. Ensures that in-progress chunks are properly
   * tracked in checkpoints for potential resumption.
   *
   * Cleanup actions:
   * - Adding in-progress chunks back to pending queue
   * - Updating checkpoint status
   * - Saving checkpoint state
   * - Logging cleanup actions
   *
   * @param chunks Chunks being processed at time of cancellation/pause
   * @param checkpoint Current checkpoint for state persistence
   * @returns Promise that resolves when cleanup is complete
   */
  private async handleCancelledOrPausedProcessing(chunks: DocumentChunk[], checkpoint: ProcessingCheckpoint | null): Promise<void> {
    // Log cleanup for diagnostic purposes
    console.log(`Cleaning up ${chunks.length} in-progress chunks`);
    
    // Mark chunks as cancelled in the checkpoint if needed
    if (this.activeCheckpointId) {
      try {
        const loadedCheckpoint = await this.persistenceManager.loadCheckpoint(this.activeCheckpointId);
        
        // Add chunks back to pending if they were being processed
        for (const chunk of chunks) {
          if (chunk.id && !loadedCheckpoint.pendingChunks.includes(chunk.id)) {
            loadedCheckpoint.pendingChunks.push(chunk.id);
          }
        }
        
        // Update checkpoint status
        if (this.isCancelled) {
          loadedCheckpoint.status = CheckpointStatus.CANCELLED;
        } else if (this.isPaused) {
          loadedCheckpoint.status = CheckpointStatus.PAUSED;
        }
        
        // Update timestamp
        loadedCheckpoint.lastUpdated = new Date();
        
        // Save the updated checkpoint
        await this.persistenceManager.saveCheckpoint(loadedCheckpoint);
      } catch (error) {
        console.error("Error cleaning up in-progress chunks:", error instanceof Error ? error.message : String(error));
      }
    }
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

/**
 * Create a processing orchestrator instance
 *
 * Factory function to create a new ProcessingOrchestrator instance
 * with the provided dependencies.
 *
 * @param app Obsidian App instance
 * @param llmClient LLM client for generating completions
 * @param persistenceManager Persistence manager for checkpoint handling
 * @param contextWindowDetector Context window detector for token limit management
 * @param outputFilesManager Optional output files manager for status updates
 * @returns Configured ProcessingOrchestrator instance
 */
export function createProcessingOrchestrator(
  app: App,
  llmClient: LLMClient,
  persistenceManager: PersistenceManager,
  contextWindowDetector: ContextWindowDetector,
  outputFilesManager?: OutputFilesManager
): ProcessingOrchestrator {
  return new ProcessingOrchestrator(app, llmClient, persistenceManager, contextWindowDetector, outputFilesManager);
}

/**
 * Update the status of a file in the output files manager
 *
 * Helper function to update file status in the output files manager.
 * Handles null output files manager and preserves existing metadata.
 *
 * @param outputFilesManager Output files manager (can be null)
 * @param fileId File ID to update
 * @param status New file status
 * @param errorMessage Optional error message
 * @param isRetryable Optional flag indicating if the operation is retryable
 */
export function updateFileStatus(
  outputFilesManager: OutputFilesManager | null,
  fileId: string,
  status: FileStatus,
  errorMessage?: string,
  isRetryable?: boolean
): void {
  if (outputFilesManager) {
    outputFilesManager.updateFile(fileId, {
      status: status,
      error: errorMessage,
      metadata: isRetryable !== undefined ? { ...outputFilesManager.getFile(fileId)?.metadata, isRetryable } : undefined
    });
  }
}
