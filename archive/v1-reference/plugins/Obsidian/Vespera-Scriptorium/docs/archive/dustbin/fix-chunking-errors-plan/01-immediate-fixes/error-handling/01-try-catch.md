# Adding Try-Catch Blocks

## Current Implementation

Based on the error logs, it appears that the plugin is not consistently using try-catch blocks to handle errors during document processing. This can lead to unhandled exceptions that crash the plugin, particularly during memory-intensive operations.

## Key Functions Requiring Try-Catch Blocks

The following key functions should be updated to include proper error handling:

1. `processChunksWithLLM` - Main processing function
2. `assembleDocument` - Document assembly function
3. `sortChunksByPosition` - Chunk sorting function
4. LLM client calls - API calls to LM Studio

## Implementation

### 1. Update processChunksWithLLM with try-catch

```typescript
/**
 * Process document chunks with the LLM, with comprehensive error handling
 * @param chunks - Array of document chunks to process
 * @param options - Processing options
 * @returns Processed document or null if processing failed
 */
async processChunksWithLLM(chunks: Chunk[], options: ProcessingOptions): Promise<ProcessedDocument | null> {
  try {
    // Record starting time and metadata
    const startTime = Date.now();
    const metadata = {
      fileName: options.fileName,
      chunkCount: chunks.length,
      timestamp: new Date().toISOString(),
      configuration: options
    };
    
    console.info(`[${new Date().toISOString()}] [INFO] Starting summarization for ${options.fileName} with ${chunks.length} chunks`, metadata);
    
    // Initialize tracking variables
    const processedChunks: ProcessedChunk[] = [];
    const failedChunks: Record<string, string> = {};
    
    // Process each chunk with individual error handling
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        // Process the chunk
        const processedChunk = await this.processChunk(chunk, options);
        processedChunks.push(processedChunk);
      } catch (chunkError) {
        // Log the error and continue with next chunk
        console.error(`Error processing chunk ${chunk.id || i}:`, chunkError);
        
        // Record the failure
        failedChunks[chunk.id || `chunk-${i}`] = chunkError.message || 'Unknown error';
        
        // Notify user but continue processing
        new Notice(`Error processing chunk ${i+1} of ${chunks.length}. Continuing with next chunk.`, 3000);
      }
      
      // Report progress
      if (options.progressCallback) {
        options.progressCallback(i + 1, chunks.length);
      }
    }
    
    // Abort if no chunks were processed successfully
    if (processedChunks.length === 0) {
      const error = new Error('No chunks were processed successfully');
      
      // Save error information for reporting
      this.saveErrorInfo(options.fileName, {
        error: error.message,
        failedChunks,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
    
    // Assemble the document with error handling
    try {
      const document = this.assembleDocument(processedChunks, options);
      
      // Record processing metrics
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      console.info(`[${new Date().toISOString()}] [INFO] Completed summarization for ${options.fileName} in ${processingTime}ms. Processed ${processedChunks.length}/${chunks.length} chunks.`);
      
      // Save document with metadata
      const documentWithMetadata = {
        ...document,
        metadata: {
          ...metadata,
          processingTime,
          successfulChunks: processedChunks.length,
          failedChunks: Object.keys(failedChunks).length
        }
      };
      
      return documentWithMetadata;
    } catch (assemblyError) {
      console.error(`Error assembling document for ${options.fileName}:`, assemblyError);
      
      // Save partial results if possible
      this.savePartialResults(options.fileName, processedChunks, failedChunks);
      
      // Notify user
      new Notice(`Error assembling document ${options.fileName}. Partial results saved.`, 5000);
      
      // Save error information
      this.saveErrorInfo(options.fileName, {
        error: assemblyError.message,
        stage: 'assembly',
        timestamp: new Date().toISOString(),
        processedChunks: processedChunks.length,
        failedChunks: Object.keys(failedChunks).length
      });
      
      // Return null to indicate failure
      return null;
    }
  } catch (error) {
    // Handle any other errors
    console.error(`Unexpected error during processing of ${options.fileName}:`, error);
    
    // Notify user
    new Notice(`Unexpected error during processing: ${error.message}`, 5000);
    
    // Save error information
    this.saveErrorInfo(options.fileName, {
      error: error.message,
      stage: 'processing',
      timestamp: new Date().toISOString()
    });
    
    // Return null to indicate failure
    return null;
  }
}
```

### 2. Update assembleDocument with try-catch

```typescript
/**
 * Assemble processed chunks into a final document, with robust error handling
 * @param processedChunks - Array of processed chunks
 * @param options - Assembly options
 * @returns Assembled document
 */
assembleDocument(processedChunks: ProcessedChunk[], options: AssemblyOptions): ProcessedDocument {
  try {
    // Sort chunks by position to ensure correct order
    let sortedChunks: ProcessedChunk[];
    
    try {
      sortedChunks = this.sortChunksByPosition(processedChunks);
    } catch (sortError) {
      console.error('Error sorting chunks:', sortError);
      
      // Fall back to unsorted chunks if sorting fails
      sortedChunks = [...processedChunks];
      
      // Add warning to the result
      console.warn('Using unsorted chunks due to sorting error');
    }
    
    // Combine chunk contents
    let combinedContent = '';
    const chunkIds = [];
    
    for (const chunk of sortedChunks) {
      // Add chunk content to combined content
      combinedContent += chunk.content;
      
      // Track chunk IDs for reference
      chunkIds.push(chunk.id);
    }
    
    // Create the assembled document
    const document: ProcessedDocument = {
      id: options.documentId || `doc-${Date.now()}`,
      documentId: options.fileName,
      documentName: options.fileName,
      timestamp: new Date().toISOString(),
      content: combinedContent,
      chunkIds: chunkIds,
      completedChunks: chunkIds
    };
    
    return document;
  } catch (error) {
    console.error('Error in assembleDocument:', error);
    
    // Create an error object with the stack trace
    const enhancedError = new Error(`Document assembly failed: ${error.message}`);
    enhancedError.stack = error.stack;
    
    // Add context to the error
    Object.assign(enhancedError, {
      context: {
        chunkCount: processedChunks.length,
        options: options
      }
    });
    
    throw enhancedError;
  }
}
```

### 3. Update sortChunksByPosition with try-catch

```typescript
/**
 * Sorts chunks by their position, with robust error handling
 * @param chunks - Array of chunks to sort
 * @returns Sorted array of chunks
 */
sortChunksByPosition(chunks: Chunk[]): Chunk[] {
  try {
    // First, assign temporary IDs to any chunks missing them
    const chunksWithIds = chunks.map((chunk, index) => {
      if (!chunk.id) {
        // Create a deep copy to avoid modifying the original
        const chunkCopy = { ...chunk };
        // Assign a temporary ID based on index
        chunkCopy.id = `temp-chunk-${index}`;
        
        // Log this as a debug message
        console.debug(`Assigning temporary ID ${chunkCopy.id} to chunk at index ${index}`);
        
        return chunkCopy;
      }
      return chunk;
    });
    
    let warningCount = 0;
    const maxWarnings = 5; // Limit the number of warnings to avoid log spam
    
    // Sort the chunks with comprehensive error handling
    return chunksWithIds.sort((a, b) => {
      try {
        // If position is missing, fall back to index-based ordering
        const posA = a.position !== undefined ? a.position : 0;
        const posB = b.position !== undefined ? b.position : 0;
        
        // If positions are the same, use IDs to ensure stable sorting
        if (posA === posB) {
          return a.id.localeCompare(b.id);
        }
        
        return posA - posB;
      } catch (sortError) {
        // Log only a limited number of warnings
        if (warningCount < maxWarnings) {
          console.warn(`Error comparing chunks during sorting: ${sortError.message}`);
          warningCount++;
        } else if (warningCount === maxWarnings) {
          console.warn(`Suppressed additional chunk sorting warnings`);
          warningCount++;
        }
        
        // Default to 0 (no change in order) for error cases
        return 0;
      }
    });
  } catch (error) {
    console.error('Error in sortChunksByPosition:', error);
    
    // Return the original array if sorting fails
    console.warn('Returning unsorted chunks due to sorting error');
    return [...chunks];
  }
}
```

### 4. Add error handling to LLM client calls

```typescript
/**
 * Process a single chunk with the LLM, with robust error handling
 * @param chunk - The chunk to process
 * @param options - Processing options
 * @returns Processed chunk
 */
async processChunk(chunk: Chunk, options: ProcessingOptions): Promise<ProcessedChunk> {
  const maxRetries = 3;
  let retryCount = 0;
  let lastError: Error | null = null;
  
  while (retryCount < maxRetries) {
    try {
      // Prepare the prompt for the LLM
      const prompt = this.preparePrompt(chunk, options);
      
      // Call the LLM with timeout
      const response = await Promise.race([
        this.llmClient.complete(prompt),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('LLM request timed out')), options.timeout || 30000)
        )
      ]);
      
      // Process the response
      if (!response || !response.text) {
        throw new Error('Empty response from LLM');
      }
      
      // Return the processed chunk
      return {
        id: chunk.id,
        position: chunk.position,
        content: response.text,
        originalChunk: chunk.id
      };
    } catch (error) {
      lastError = error;
      
      // Log the retry attempt
      console.warn(`Error processing chunk ${chunk.id}, attempt ${retryCount + 1}/${maxRetries}:`, error.message);
      
      // Increment retry count
      retryCount++;
      
      // Wait before retrying (with exponential backoff)
      if (retryCount < maxRetries) {
        const backoffMs = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }
  
  // If all retries failed, throw the last error
  if (lastError) {
    throw new Error(`Failed to process chunk after ${maxRetries} attempts: ${lastError.message}`);
  }
  
  // This should never happen, but TypeScript needs it
  throw new Error('Unexpected error in processChunk');
}
```

### 5. Helper Functions for Error Handling

```typescript
/**
 * Saves error information for reporting and debugging
 * @param fileName - Name of the document being processed
 * @param errorInfo - Information about the error
 */
private saveErrorInfo(fileName: string, errorInfo: any): void {
  try {
    // Create a unique error ID
    const errorId = `error-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Create the error log file name
    const errorFileName = `${fileName.replace(/\.[^/.]+$/, '')}-error-${errorId}.json`;
    
    // Save the error information to the output directory
    const errorPath = path.join(this.settings.outputDirectory, errorFileName);
    
    // Write the error information to the file
    fs.writeFileSync(errorPath, JSON.stringify(errorInfo, null, 2));
    
    console.info(`Error information saved to ${errorPath}`);
  } catch (saveError) {
    console.error('Error saving error information:', saveError);
  }
}

/**
 * Saves partial results when document assembly fails
 * @param fileName - Name of the document being processed
 * @param processedChunks - Array of successfully processed chunks
 * @param failedChunks - Record of chunks that failed processing
 */
private savePartialResults(
  fileName: string, 
  processedChunks: ProcessedChunk[], 
  failedChunks: Record<string, string>
): void {
  try {
    // Create a partial results ID
    const partialId = `partial-${Date.now()}`;
    
    // Create the partial results file name
    const partialFileName = `${fileName.replace(/\.[^/.]+$/, '')}-partial-${partialId}.json`;
    
    // Save the partial results to the output directory
    const partialPath = path.join(this.settings.outputDirectory, partialFileName);
    
    // Prepare the partial results
    const partialResults = {
      id: partialId,
      documentId: fileName,
      documentName: fileName,
      timestamp: new Date().toISOString(),
      status: 'partial',
      processedChunks: processedChunks,
      failedChunks: failedChunks
    };
    
    // Write the partial results to the file
    fs.writeFileSync(partialPath, JSON.stringify(partialResults, null, 2));
    
    console.info(`Partial results saved to ${partialPath}`);
  } catch (saveError) {
    console.error('Error saving partial results:', saveError);
  }
}
```

## Implementation Steps

1. Update the `processChunksWithLLM` function with comprehensive try-catch blocks
2. Update the `assembleDocument` function with error handling
3. Update the `sortChunksByPosition` function with robust error handling
4. Add error handling to LLM client calls
5. Implement helper functions for saving error information and partial results

## Best Practices

1. **Log Errors Completely**: Include all relevant information in error logs
2. **Retry Operations**: Use retry logic for transient errors, particularly network calls
3. **Save Partial Results**: Always save partial results when errors occur
4. **Provide User Feedback**: Notify users of errors with clear, actionable messages
5. **Fail Gracefully**: Return sensible defaults or partial results rather than crashing
6. **Limit Warning Noise**: Suppress repeated warnings to avoid log spam
7. **Use Timeouts**: Apply timeouts to external calls to prevent hanging
8. **Structured Error Objects**: Include context with errors to aid debugging

## Return to [Error Handling](./README.md)
