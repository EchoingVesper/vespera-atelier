# Graceful Degradation

## Current Implementation

Currently, the plugin appears to fail completely when errors occur during processing, particularly when memory issues arise. A more robust approach is to implement graceful degradation strategies that allow the plugin to continue functioning, albeit with reduced capabilities, when errors occur.

## Graceful Degradation Strategies

### 1. Implement Progressive Processing

```typescript
/**
 * Process document chunks with progressive processing
 * @param chunks - Array of document chunks to process
 * @param options - Processing options
 * @returns Processed document or partial document
 */
async processDocumentProgressively(chunks: Chunk[], options: ProcessingOptions): Promise<ProcessedDocument> {
  // Initialize tracking variables
  const processedChunks: ProcessedChunk[] = [];
  const failedChunks: Record<string, string> = {};
  let batchSize = options.initialBatchSize || 5;
  
  // Create a unique document ID
  const documentId = `doc-${Date.now()}`;
  
  // Initialize the document result
  const documentResult: ProcessedDocument = {
    id: documentId,
    documentId: options.fileName,
    documentName: options.fileName,
    timestamp: new Date().toISOString(),
    completedChunks: [],
    pendingChunks: chunks.map(chunk => chunk.id),
    failedChunks: {},
    partialResults: {},
    status: 'in_progress'
  };
  
  // Save initial state
  this.saveDocumentState(documentResult);
  
  // Process chunks in batches
  for (let i = 0; i < chunks.length; i += batchSize) {
    try {
      // Get the current batch
      const batch = chunks.slice(i, i + batchSize);
      
      // Process the batch
      const processedBatch = await this.processBatch(batch, options);
      
      // Add to processed chunks
      processedChunks.push(...processedBatch.processed);
      
      // Record failed chunks
      for (const [chunkId, error] of Object.entries(processedBatch.failed)) {
        failedChunks[chunkId] = error;
      }
      
      // Update document state
      documentResult.completedChunks = processedChunks.map(chunk => chunk.id);
      documentResult.pendingChunks = chunks
        .slice(i + batchSize)
        .map(chunk => chunk.id);
      documentResult.failedChunks = failedChunks;
      
      // Add partial results to the document
      for (const chunk of processedBatch.processed) {
        documentResult.partialResults[chunk.id] = chunk.content;
      }
      
      // Save updated state
      this.saveDocumentState(documentResult);
      
      // Adjust batch size based on success rate
      if (processedBatch.processed.length < batch.length / 2) {
        // More than half of chunks failed, reduce batch size
        batchSize = Math.max(1, Math.floor(batchSize / 2));
        console.warn(`Reducing batch size to ${batchSize} due to high failure rate`);
      }
      
    } catch (batchError) {
      console.error(`Error processing batch starting at index ${i}:`, batchError);
      
      // If a batch fails completely, try processing chunks individually
      if (batchSize > 1) {
        batchSize = 1;
        i -= batchSize; // Retry this batch with smaller size
        console.warn('Switching to individual chunk processing due to batch failure');
        continue;
      }
      
      // Record failed chunks
      for (const chunk of chunks.slice(i, i + batchSize)) {
        failedChunks[chunk.id] = batchError.message;
      }
      
      // Update document state
      documentResult.failedChunks = failedChunks;
      
      // Save updated state
      this.saveDocumentState(documentResult);
    }
    
    // Report progress
    if (options.progressCallback) {
      const progress = Math.min(100, Math.round((i + batchSize) / chunks.length * 100));
      options.progressCallback(progress, `Processed ${i + batchSize}/${chunks.length} chunks`);
    }
  }
  
  // Try to assemble the document from processed chunks
  if (processedChunks.length > 0) {
    try {
      // Sort and assemble processed chunks
      const assembledDocument = this.assembleDocument(processedChunks, options);
      
      // Update final state
      documentResult.content = assembledDocument.content;
      documentResult.status = 'completed';
      
      // Save final state
      this.saveDocumentState(documentResult);
      
      return documentResult;
    } catch (assemblyError) {
      console.error('Error assembling document:', assemblyError);
      
      // Set document status to partial
      documentResult.status = 'partial';
      documentResult.error = assemblyError.message;
      
      // Save final state
      this.saveDocumentState(documentResult);
      
      return documentResult;
    }
  } else {
    // No chunks were processed successfully
    documentResult.status = 'failed';
    documentResult.error = 'No chunks were processed successfully';
    
    // Save final state
    this.saveDocumentState(documentResult);
    
    return documentResult;
  }
}
```

### 2. Implement Memory-Adaptive Processing

```typescript
/**
 * Process document with memory-adaptive strategy
 * @param document - Document to process
 * @param options - Processing options
 * @returns Processed document or partial document
 */
async processDocumentAdaptively(document: string, options: ProcessingOptions): Promise<ProcessedDocument> {
  // Initialize memory monitor
  const memoryMonitor = this.memoryMonitor;
  
  // Start with a reasonable chunk size
  let chunkSize = options.initialChunkSize || 1000;
  
  // Create document ID
  const documentId = `doc-${Date.now()}`;
  
  // Create result object
  const documentResult: ProcessedDocument = {
    id: documentId,
    documentId: options.fileName,
    documentName: options.fileName,
    timestamp: new Date().toISOString(),
    completedChunks: [],
    pendingChunks: [],
    failedChunks: {},
    partialResults: {},
    status: 'in_progress'
  };
  
  try {
    // First attempt: Try processing with initial chunk size
    console.info(`Attempting to process with chunk size: ${chunkSize}`);
    
    // Create chunks
    let chunks = this.chunkDocument(document, chunkSize);
    
    // Save the generated chunks
    documentResult.pendingChunks = chunks.map(chunk => chunk.id);
    this.saveDocumentState(documentResult);
    
    // Check if we can process these chunks
    if (!memoryMonitor.canProcessChunks(chunks.length)) {
      // Need to adjust chunk size
      while (chunks.length > 1 && !memoryMonitor.canProcessChunks(chunks.length)) {
        // Increase chunk size to reduce number of chunks
        chunkSize = Math.floor(chunkSize * 1.5);
        console.warn(`Increasing chunk size to ${chunkSize} to reduce memory usage`);
        
        // Re-chunk the document
        chunks = this.chunkDocument(document, chunkSize);
      }
      
      // Update pending chunks
      documentResult.pendingChunks = chunks.map(chunk => chunk.id);
      this.saveDocumentState(documentResult);
    }
    
    // Process the chunks
    return await this.processDocumentProgressively(chunks, options);
    
  } catch (error) {
    console.error('Error during adaptive processing:', error);
    
    // Check if this is a memory error
    if (error instanceof MemoryLimitError || error.message.includes('memory')) {
      // Try to process a subset of the document if it's too large
      if (document.length > 5000) {
        console.warn('Document is too large for processing, trying a subset');
        
        // Process just the first part of the document
        const subset = document.substring(0, Math.min(document.length, 5000));
        
        // Create chunks from subset
        const subsetChunks = this.chunkDocument(subset, chunkSize * 2);
        
        // Update pending chunks
        documentResult.pendingChunks = subsetChunks.map(chunk => chunk.id);
        documentResult.status = 'partial';
        documentResult.error = 'Document was too large to process in full';
        this.saveDocumentState(documentResult);
        
        // Process the subset
        try {
          const subsetResult = await this.processDocumentProgressively(subsetChunks, options);
          
          // Copy results from subset
          documentResult.completedChunks = subsetResult.completedChunks;
          documentResult.partialResults = subsetResult.partialResults;
          documentResult.content = subsetResult.content;
          documentResult.status = 'partial';
          
          // Save final state
          this.saveDocumentState(documentResult);
          
          return documentResult;
        } catch (subsetError) {
          console.error('Error processing document subset:', subsetError);
          
          // Set status to failed
          documentResult.status = 'failed';
          documentResult.error = subsetError.message;
          
          // Save final state
          this.saveDocumentState(documentResult);
          
          return documentResult;
        }
      }
    }
    
    // Handle other errors
    documentResult.status = 'failed';
    documentResult.error = error.message;
    
    // Save final state
    this.saveDocumentState(documentResult);
    
    return documentResult;
  }
}
```

### 3. Implement Recovery from Previous State

```typescript
/**
 * Recover processing from a previous state
 * @param documentId - ID of the document to recover
 * @param options - Processing options
 * @returns Updated document state
 */
async recoverProcessing(documentId: string, options: ProcessingOptions): Promise<ProcessedDocument> {
  try {
    // Load the document state
    const documentState = await this.loadDocumentState(documentId);
    
    if (!documentState) {
      throw new Error(`Document state not found for ID: ${documentId}`);
    }
    
    // Check if there are pending chunks
    if (documentState.pendingChunks.length === 0) {
      // Nothing to recover, document is already complete or failed
      return documentState;
    }
    
    // Log recovery attempt
    console.info(`Recovering processing for document ${documentState.documentName} (${documentState.id})`);
    console.info(`${documentState.completedChunks.length} chunks completed, ${documentState.pendingChunks.length} pending`);
    
    // Load the original document to get the pending chunks
    const originalDocument = await this.getOriginalDocument(documentState.documentName);
    
    if (!originalDocument) {
      throw new Error(`Original document not found: ${documentState.documentName}`);
    }
    
    // Get the pending chunks from the original document
    const pendingChunkIds = documentState.pendingChunks;
    const allChunks = this.chunkDocument(originalDocument, options.initialChunkSize || 1000);
    
    // Filter for only the pending chunks
    const pendingChunks = allChunks.filter(chunk => pendingChunkIds.includes(chunk.id));
    
    if (pendingChunks.length === 0) {
      throw new Error('No pending chunks found for recovery');
    }
    
    // Process the pending chunks
    const recoveryResult = await this.processDocumentProgressively(pendingChunks, options);
    
    // Merge the recovery result with the existing state
    const mergedResult: ProcessedDocument = {
      ...documentState,
      completedChunks: [
        ...documentState.completedChunks,
        ...recoveryResult.completedChunks
      ],
      pendingChunks: recoveryResult.pendingChunks,
      failedChunks: {
        ...documentState.failedChunks,
        ...recoveryResult.failedChunks
      },
      partialResults: {
        ...documentState.partialResults,
        ...recoveryResult.partialResults
      }
    };
    
    // Check if all processing is complete
    if (mergedResult.pendingChunks.length === 0) {
      // Try to assemble the final document
      try {
        // Get all the processed chunks
        const processedChunks = Object.entries(mergedResult.partialResults).map(([id, content]) => ({
          id,
          content,
          position: allChunks.findIndex(chunk => chunk.id === id)
        }));
        
        // Assemble the document
        const assembledDocument = this.assembleDocument(processedChunks, options);
        
        // Update final state
        mergedResult.content = assembledDocument.content;
        mergedResult.status = 'completed';
        
        // Save final state
        this.saveDocumentState(mergedResult);
      } catch (assemblyError) {
        console.error('Error assembling recovered document:', assemblyError);
        
        // Set status to partial
        mergedResult.status = 'partial';
        mergedResult.error = assemblyError.message;
        
        // Save final state
        this.saveDocumentState(mergedResult);
      }
    } else {
      // Still has pending chunks
      mergedResult.status = 'in_progress';
      
      // Save updated state
      this.saveDocumentState(mergedResult);
    }
    
    return mergedResult;
  } catch (error) {
    console.error('Error during recovery process:', error);
    throw error;
  }
}
```

### 4. Helper Methods for Document State Management

```typescript
/**
 * Save document processing state
 * @param documentState - Current document state
 */
private saveDocumentState(documentState: ProcessedDocument): void {
  try {
    // Create file path
    const filePath = path.join(
      this.settings.outputDirectory,
      `${documentState.id}.json`
    );
    
    // Write state to file
    fs.writeFileSync(filePath, JSON.stringify(documentState, null, 2));
    
    console.debug(`Document state saved to ${filePath}`);
  } catch (error) {
    console.error('Error saving document state:', error);
  }
}

/**
 * Load document processing state
 * @param documentId - ID of the document to load
 * @returns Document state or null if not found
 */
private async loadDocumentState(documentId: string): Promise<ProcessedDocument | null> {
  try {
    // Create file path
    const filePath = path.join(
      this.settings.outputDirectory,
      `${documentId}.json`
    );
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    // Read state from file
    const stateJson = fs.readFileSync(filePath, 'utf8');
    const state = JSON.parse(stateJson) as ProcessedDocument;
    
    return state;
  } catch (error) {
    console.error(`Error loading document state for ${documentId}:`, error);
    return null;
  }
}

/**
 * Get the original document content
 * @param fileName - Name of the document
 * @returns Document content or null if not found
 */
private async getOriginalDocument(fileName: string): Promise<string | null> {
  try {
    // Get the file from Obsidian vault
    const file = this.app.vault.getAbstractFileByPath(fileName);
    
    if (!file || !(file instanceof TFile)) {
      return null;
    }
    
    // Read the file content
    const content = await this.app.vault.read(file);
    
    return content;
  } catch (error) {
    console.error(`Error reading original document ${fileName}:`, error);
    return null;
  }
}
```

## Integration with UI

Add a recovery option to the processing modal:

```typescript
// In the modal creation function
createProcessingModal(files: TFile[]): Modal {
  const modal = new Modal(this.app);
  modal.titleEl.setText('Process Files');
  
  // Add file selection UI
  // ...
  
  // Add recovery option
  const recoverySection = modal.contentEl.createDiv({ cls: 'vs-recovery-section' });
  recoverySection.createEl('h3', { text: 'Recovery Options' });
  
  const recoveryToggle = new Setting(recoverySection)
    .setName('Check for incomplete processing')
    .setDesc('Look for previously interrupted processing tasks for the selected files')
    .addToggle(toggle => toggle
      .setValue(true)
      .onChange(value => {
        this.checkForRecovery = value;
      }));
  
  // Add confirmation button
  const confirmBtn = modal.contentEl.createEl('button', {
    text: 'Process Files',
    cls: 'mod-cta'
  });
  
  confirmBtn.addEventListener('click', async () => {
    modal.close();
    
    const selectedFiles = this.getSelectedFiles();
    
    // Check for recovery if enabled
    if (this.checkForRecovery) {
      for (const file of selectedFiles) {
        const recoveryState = await this.findRecoveryState(file.path);
        
        if (recoveryState) {
          // Ask user if they want to recover
          const recover = await this.showRecoveryPrompt(file.name, recoveryState);
          
          if (recover) {
            // Recover processing
            await this.recoverProcessing(recoveryState.id, {
              fileName: file.path,
              // Other options...
            });
            continue; // Skip normal processing
          }
        }
        
        // Normal processing
        await this.processFile(file);
      }
    } else {
      // Process all files normally
      for (const file of selectedFiles) {
        await this.processFile(file);
      }
    }
  });
  
  return modal;
}

/**
 * Find recovery state for a file
 * @param filePath - Path to the file
 * @returns Recovery state or null if not found
 */
private async findRecoveryState(filePath: string): Promise<ProcessedDocument | null> {
  try {
    // Get list of all state files
    const stateFiles = fs.readdirSync(this.settings.outputDirectory)
      .filter(file => file.endsWith('.json'));
    
    // Check each state file for the given file path
    for (const stateFile of stateFiles) {
      try {
        const statePath = path.join(this.settings.outputDirectory, stateFile);
        const stateJson = fs.readFileSync(statePath, 'utf8');
        const state = JSON.parse(stateJson) as ProcessedDocument;
        
        // Check if this state is for the given file and is incomplete
        if (state.documentName === filePath &&
            (state.status === 'in_progress' || state.status === 'partial')) {
          return state;
        }
      } catch (readError) {
        console.warn(`Error reading state file ${stateFile}:`, readError);
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error finding recovery state:', error);
    return null;
  }
}

/**
 * Show recovery prompt to the user
 * @param fileName - Name of the file
 * @param state - Recovery state
 * @returns User's decision to recover or not
 */
private async showRecoveryPrompt(fileName: string, state: ProcessedDocument): Promise<boolean> {
  return new Promise(resolve => {
    const modal = new Modal(this.app);
    modal.titleEl.setText('Recovery Available');
    
    modal.contentEl.createEl('p', {
      text: `Previous processing for "${fileName}" was interrupted.`
    });
    
    modal.contentEl.createEl('p', {
      text: `${state.completedChunks.length} chunks were processed, ${state.pendingChunks.length} chunks remain.`
    });
    
    modal.contentEl.createEl('p', {
      text: 'Would you like to resume the previous processing?'
    });
    
    const buttonContainer = modal.contentEl.createDiv({ cls: 'vs-button-container' });
    
    const resumeBtn = buttonContainer.createEl('button', {
      text: 'Resume',
      cls: 'mod-cta'
    });
    
    const startOverBtn = buttonContainer.createEl('button', {
      text: 'Start Over'
    });
    
    resumeBtn.addEventListener('click', () => {
      modal.close();
      resolve(true);
    });
    
    startOverBtn.addEventListener('click', () => {
      modal.close();
      resolve(false);
    });
    
    modal.open();
  });
}
```

## Implementation Steps

1. Implement the progressive processing method
2. Implement the memory-adaptive processing method
3. Implement the recovery system
4. Add helper methods for document state management
5. Update the UI to support recovery options
6. Test thoroughly with different error scenarios

## Best Practices

1. **Always Save State**: Regularly save processing state to enable recovery
2. **Adapt to Conditions**: Adjust processing parameters based on available resources
3. **Fallback Mechanisms**: Provide multiple fallback options when errors occur
4. **User Control**: Give users options to control recovery and degradation
5. **Partial Results**: Always provide partial results rather than nothing
6. **Clear Communication**: Clearly indicate when degraded functionality is in use
7. **Automatic Recovery**: Attempt to automatically recover when possible
8. **Resource Monitoring**: Continuously monitor resource usage to predict issues

## Return to [Error Handling](./README.md)
