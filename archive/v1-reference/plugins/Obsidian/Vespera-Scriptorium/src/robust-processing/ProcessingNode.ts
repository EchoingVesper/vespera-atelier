/**
 * Processing Node
 * Represents a single, configurable step in the document processing workflow.
 * @module ProcessingNode
 */

import { DocumentChunk } from './AdaptiveChunker';
import { ChunkResult } from './ProcessingOrchestrator'; // Assuming ChunkResult is suitable, or define a more generic one if needed
import { v4 as uuidv4 } from 'uuid';

/**
 * Defines the signature for a processing function that a ProcessingNode can execute.
 * @param chunk The document chunk to process.
 * @param options Optional parameters specific to the processing function.
 * @returns A promise that resolves to the processed content (string) or a more structured result.
 */
export type ProcessingFunction<T_Input = DocumentChunk, T_Output = string, T_Options = any> = 
  (chunk: T_Input, options?: T_Options) => Promise<T_Output>;

export interface ProcessingNodeOptions<T_ProcOptions = any> {
  /**
   * A unique identifier for this node instance, if needed for logging or tracking.
   */
  nodeId?: string;
  /**
   * Options to be passed to the processing function.
   */
  processingFunctionOptions?: T_ProcOptions;
  // Future: Add options for error handling strategies, retry policies etc.
}

/**
 * The ProcessingNode class is responsible for applying a specific processing step
 * to a document chunk. It is designed to be flexible and adaptable to various
 * types of processing tasks (e.g., LLM calls, classification, data extraction, transformations).
 */
export class ProcessingNode<T_ChunkInput extends DocumentChunk = DocumentChunk, T_ProcOutput = string, T_ProcOptions = any> {
  protected nodeId: string; // Changed private to protected
  private processingFunction: ProcessingFunction<T_ChunkInput, T_ProcOutput, T_ProcOptions>;
  private options: ProcessingNodeOptions<T_ProcOptions>;

  /**
   * Creates an instance of ProcessingNode.
   * @param processingFunction The core function that defines the processing logic of this node.
   * @param options Configuration options for the node.
   */
  constructor(
    processingFunction: ProcessingFunction<T_ChunkInput, T_ProcOutput, T_ProcOptions>,
    options: Partial<ProcessingNodeOptions<T_ProcOptions>> = {}
  ) {
    this.nodeId = options.nodeId || `proc-node-${uuidv4()}`;
    this.processingFunction = processingFunction;
    this.options = {
      ...options,
    };
  }

  /**
   * Executes the configured processing function on the given document chunk.
   * @param chunk The document chunk to be processed.
   * @returns A promise that resolves to a ChunkResult, containing the outcome of the processing.
   */
  public async process(chunk: T_ChunkInput): Promise<ChunkResult> {
    const startTime = Date.now();
    try {
      console.log(`[${this.nodeId}] Starting processing for chunk: ${chunk.id}`);
      const processedContent = await this.processingFunction(chunk, this.options.processingFunctionOptions);
      const endTime = Date.now();
      console.log(`[${this.nodeId}] Finished processing for chunk: ${chunk.id}. Duration: ${endTime - startTime}ms`);
      
      // Assuming ChunkResult is the standard output format.
      // If T_ProcOutput is not a simple string, adapt this mapping.
      return {
        chunkId: chunk.id,
        content: typeof processedContent === 'string' ? processedContent : JSON.stringify(processedContent),
        success: true,
        retries: 0, // Basic, to be enhanced with actual retry logic
        processingTime: endTime - startTime,
        tokensGenerated: typeof processedContent === 'string' ? Math.round(processedContent.length / 4) : 0, // Rough estimate
        metadata: {
          ...(chunk.metadata || {}),
          processingNodeId: this.nodeId,
          processingTimeMs: endTime - startTime,
          // Add any other relevant metadata from the processing function if T_ProcOutput is an object
        },
      };
    } catch (error: any) {
      const endTime = Date.now();
      console.error(`[${this.nodeId}] Error processing chunk ${chunk.id}:`, error);
      return {
        chunkId: chunk.id,
        content: chunk.content, // Or empty string, depending on error handling strategy
        success: false,
        error: error.message || 'Unknown processing error',
        retries: 0, // Basic
        processingTime: endTime - startTime,
        tokensGenerated: 0,
        metadata: {
          ...(chunk.metadata || {}),
          processingNodeId: this.nodeId,
          processingTimeMs: endTime - startTime,
          errorDetails: error.stack,
        },
      };
    }
  }

  /**
   * Updates the processing function for this node instance.
   * This allows for dynamic changes in node behavior if necessary.
   * @param newProcessingFunction The new processing function to use.
   */
  public setProcessingFunction(newProcessingFunction: ProcessingFunction<T_ChunkInput, T_ProcOutput, T_ProcOptions>): void {
    this.processingFunction = newProcessingFunction;
    console.log(`[${this.nodeId}] Processing function updated.`);
  }

  /**
   * Updates the options for the processing function.
   * @param newOptions The new options to be passed to the processing function.
   */
  public setProcessingFunctionOptions(newOptions: T_ProcOptions): void {
    this.options.processingFunctionOptions = newOptions;
    console.log(`[${this.nodeId}] Processing function options updated.`);
  }
}

// Example Usage (for testing purposes):
async function exampleProcessingTask(chunk: DocumentChunk, options?: { prefix?: string }): Promise<string> {
  // Simulate some processing, e.g., an API call or complex computation
  await new Promise(resolve => setTimeout(resolve, 50)); 
  if (chunk.content.includes('error_trigger')) {
    throw new Error('Simulated processing error');
  }
  return `${options?.prefix || 'Processed:'} ${chunk.content.toUpperCase()}`;
}

async function testProcessingNode() {
  const node = new ProcessingNode<DocumentChunk, string, { prefix?: string }>(
    exampleProcessingTask,
    { processingFunctionOptions: { prefix: '[ExampleNode]' } }
  );

  const sampleChunk: DocumentChunk = {
    id: uuidv4(),
    content: 'This is a test chunk.',
    metadata: { 
      id: uuidv4(),
      index: 0,
      sourceDocument: 'test.txt', 
      startPosition: 0, 
      endPosition: 20, 
      chunkNumber: 1, 
      totalChunks: 1, 
      estimatedTokens: 5, 
      timestamp: Date.now(), 
      custom: {} 
    },
  };

  const errorChunk: DocumentChunk = {
    id: uuidv4(),
    content: 'This chunk contains an error_trigger.',
    metadata: { 
      id: uuidv4(),
      index: 0,
      sourceDocument: 'test.txt', 
      startPosition: 0, 
      endPosition: 20, 
      chunkNumber: 1, 
      totalChunks: 1, 
      estimatedTokens: 7, 
      timestamp: Date.now(), 
      custom: {} 
    },
  };

  const result1 = await node.process(sampleChunk);
  console.log('Result 1:', JSON.stringify(result1, null, 2));

  const result2 = await node.process(errorChunk);
  console.log('Result 2:', JSON.stringify(result2, null, 2));
}

// if (require.main === module) {
//   testProcessingNode();
// }