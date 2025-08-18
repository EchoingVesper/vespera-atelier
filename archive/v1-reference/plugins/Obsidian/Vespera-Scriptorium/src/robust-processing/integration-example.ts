/**
 * Integration Example
 * Demonstrates how to integrate the robust document processing system into the main plugin.
 * @module integration-example
 */

import { App, Notice, TFile } from 'obsidian';
import { LLMClient, ProviderType } from '../LLMClient';
import { 
  initializeRobustProcessingSystem,
  ProcessingOptions,
  OutputOptions,
  OutputFormat,
  AssemblyOptions,
  CheckpointInfo
} from './index';

/**
 * Process a document with the robust document processing system
 * 
 * @param app Obsidian App instance
 * @param llmClient LLM client
 * @param file File to process
 * @param prompt Prompt to use for processing
 * @param model Model to use for processing
 * @returns Promise resolving when processing is complete
 */
export async function processDocumentWithRobustSystem(
  app: App,
  llmClient: LLMClient,
  file: TFile,
  prompt: string,
  model: string
): Promise<void> {
  try {
    // Initialize the robust processing system
    const system = initializeRobustProcessingSystem(app);
    
    // Read the file content
    const content = await app.vault.read(file);
    
    // Get provider type from model name (this is a workaround since provider is private)
    // In a real implementation, you might want to add a getProviderType method to LLMClient
    const providerType = model.includes('ollama') ? 
      ProviderType.OLLAMA : ProviderType.LM_STUDIO;
    
    // Create a temporary provider for context window detection
    // This is a workaround since we can't access the provider directly
    const { OllamaProvider, LMStudioProvider } = require('../providers');
    const tempProvider = providerType === ProviderType.OLLAMA ?
      new OllamaProvider({ type: ProviderType.OLLAMA }) :
      new LMStudioProvider({ type: ProviderType.LM_STUDIO });
    
    // Detect context window size
    const contextWindow = await system.contextWindowDetector.detectContextWindow(
      tempProvider,
      model
    );
    
    // Create processing options
    const processingOptions: ProcessingOptions = {
      prompt,
      model,
      baseTimeout: 30000,
      maxTimeout: 300000,
      timeoutScaleFactor: 1.5,
      maxRetries: 3,
      batchSize: 5,
      adaptiveTimeout: true,
      hardwareProfile: 'consumer-gpu',
      temperature: 0.7,
      maxTokens: 1000,
      progressCallback: (progress) => {
        // Update progress in UI
        const progressPercent = Math.round(progress.progress);
        new Notice(`Processing ${file.name}: ${progressPercent}% complete`);
      },
      savePartialResults: true,
      useCheckpointing: true,
      checkpointInterval: 5
    };
    
    // Create assembly options
    const assemblyOptions: AssemblyOptions = {
      preserveChunkBoundaries: false,
      resolveReferences: true,
      detectRedundancies: true,
      optimizeForCoherence: true,
      similarityThreshold: 0.8,
      includeMetadata: true,
      includeProcessingStats: true
    };
    
    // Create output options
    const outputOptions: OutputOptions = {
      format: OutputFormat.MARKDOWN,
      consolidate: true,
      includeMetadata: true,
      includeProcessingStats: true,
      targetLocation: 'output',
      filenameTemplate: `${file.basename}-processed`,
      createTableOfContents: true,
      includeReferences: true
    };
    
    // Split the document into chunks
    const chunks = await system.adaptiveChunker.splitDocument(
      content,
      file.name,
      {
        contextWindow,
        safetyMarginPercent: 15,
        minChunkSize: 100,
        maxChunkSize: 8192,
        promptOverhead: 500,
        contentAwareChunking: true,
        preserveParagraphs: true,
        preserveSentences: true,
        includeMetadata: true,
        contextSize: 100
      }
    );
    
    // Process the document
    const result = await system.processingOrchestrator.processDocument(
      file.path,
      file.name,
      chunks,
      processingOptions
    );
    
    // If processing was successful, assemble the document
    if (result.success) {
      // Assemble the document
      const assembledDocument = system.documentAssembler.assembleDocument(
        result.content,
        file.name,
        file.path,
        result.stats,
        assemblyOptions
      );
      
      // Save the output
      const outputResult = await system.outputManager.saveOutput(
        assembledDocument,
        outputOptions
      );
      
      // Show success message
      new Notice(`Successfully processed ${file.name} and saved to ${outputResult.outputPaths.join(', ')}`);
    } else {
      // Show error message
      new Notice(`Error processing ${file.name}: ${result.error}`);
      
      // If processing was paused, show resume option
      if (result.checkpointId) {
        new Notice(`Processing was paused. Use resumeProcessing() to continue.`);
      }
    }
  } catch (error) {
    console.error('Error processing document:', error);
    new Notice(`Error processing document: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Resume processing from a checkpoint
 * 
 * @param app Obsidian App instance
 * @param checkpointId Checkpoint ID
 * @returns Promise resolving when processing is complete
 */
export async function resumeProcessingFromCheckpoint(
  app: App,
  checkpointId: string
): Promise<void> {
  try {
    // Initialize the robust processing system
    const system = initializeRobustProcessingSystem(app);
    
    // Load the checkpoint
    const checkpoint = await system.persistenceManager.loadCheckpoint(checkpointId);
    
    // Create processing options
    const processingOptions: ProcessingOptions = {
      prompt: checkpoint.metadata?.prompt || 'Summarize the content',
      model: checkpoint.metadata?.model || 'default',
      progressCallback: (progress) => {
        // Update progress in UI
        const progressPercent = Math.round(progress.progress);
        new Notice(`Resuming processing: ${progressPercent}% complete`);
      }
    };
    
    // Resume processing
    const result = await system.processingOrchestrator.resumeProcessing(
      checkpointId,
      processingOptions
    );
    
    // If processing was successful, assemble the document
    if (result.success) {
      // Create assembly options
      const assemblyOptions: AssemblyOptions = {
        preserveChunkBoundaries: false,
        resolveReferences: true,
        detectRedundancies: true,
        optimizeForCoherence: true,
        similarityThreshold: 0.8,
        includeMetadata: true,
        includeProcessingStats: true
      };
      
      // Create output options
      const outputOptions: OutputOptions = {
        format: OutputFormat.MARKDOWN,
        consolidate: true,
        includeMetadata: true,
        includeProcessingStats: true,
        targetLocation: 'output',
        filenameTemplate: `${checkpoint.documentName}-processed`,
        createTableOfContents: true,
        includeReferences: true
      };
      
      // Assemble the document
      const assembledDocument = system.documentAssembler.assembleDocument(
        result.content,
        checkpoint.documentName,
        checkpoint.documentId,
        result.stats,
        assemblyOptions
      );
      
      // Save the output
      const outputResult = await system.outputManager.saveOutput(
        assembledDocument,
        outputOptions
      );
      
      // Show success message
      new Notice(`Successfully resumed processing ${checkpoint.documentName} and saved to ${outputResult.outputPaths.join(', ')}`);
    } else {
      // Show error message
      new Notice(`Error resuming processing: ${result.error}`);
      
      // If processing was paused again, show resume option
      if (result.checkpointId) {
        new Notice(`Processing was paused again. Use resumeProcessing() to continue.`);
      }
    }
  } catch (error) {
    console.error('Error resuming processing:', error);
    new Notice(`Error resuming processing: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * List available checkpoints
 * 
 * @param app Obsidian App instance
 * @returns Promise resolving to an array of checkpoint info
 */
export async function listAvailableCheckpoints(app: App): Promise<CheckpointInfo[]> {
  try {
    // Initialize the robust processing system
    const system = initializeRobustProcessingSystem(app);
    
    // List available checkpoints
    const checkpoints = await system.persistenceManager.listAvailableCheckpoints();
    
    // Log checkpoints
    console.log('Available checkpoints:', checkpoints);
    
    // Show checkpoints in UI
    if (checkpoints.length === 0) {
      new Notice('No checkpoints available');
    } else {
      new Notice(`Found ${checkpoints.length} checkpoints. See console for details.`);
    }
    
    return checkpoints;
  } catch (error) {
    console.error('Error listing checkpoints:', error);
    new Notice(`Error listing checkpoints: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/**
 * Delete a checkpoint
 * 
 * @param app Obsidian App instance
 * @param checkpointId Checkpoint ID
 * @returns Promise resolving when the checkpoint is deleted
 */
export async function deleteCheckpoint(app: App, checkpointId: string): Promise<void> {
  try {
    // Initialize the robust processing system
    const system = initializeRobustProcessingSystem(app);
    
    // Delete the checkpoint
    await system.persistenceManager.deleteCheckpoint(checkpointId);
    
    // Show success message
    new Notice(`Successfully deleted checkpoint ${checkpointId}`);
  } catch (error) {
    console.error('Error deleting checkpoint:', error);
    new Notice(`Error deleting checkpoint: ${error instanceof Error ? error.message : String(error)}`);
  }
}