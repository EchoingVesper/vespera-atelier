/**
 * Persistence Manager
 * Handles atomic writes and checkpointing for fault tolerance.
 * @module PersistenceManager
 */

import { App, TFile, normalizePath, Notice } from "obsidian";
import { DocumentChunk } from "./AdaptiveChunker";
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Status of a processing checkpoint
 */
export enum CheckpointStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PAUSED = 'paused'
}

/**
 * Information about a processing checkpoint
 */
export interface CheckpointInfo {
  /**
   * Unique identifier for the checkpoint
   */
  id: string;
  
  /**
   * Document name
   */
  documentName: string;
  
  /**
   * Timestamp when the checkpoint was created
   */
  timestamp: Date;
  
  /**
   * Progress percentage (0-100)
   */
  progress: number;
  
  /**
   * Status of the checkpoint
   */
  status: CheckpointStatus;
  
  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Processing checkpoint
 */
export interface ProcessingCheckpoint {
  /**
   * Unique identifier for the checkpoint
   */
  id: string;
  
  /**
   * Document identifier
   */
  documentId: string;
  
  /**
   * Document name
   */
  documentName: string;
  
  /**
   * Timestamp when the checkpoint was created
   */
  timestamp: Date;
  
  /**
   * Timestamp when the checkpoint was last updated
   */
  lastUpdated?: Date;
  
  /**
   * IDs of completed chunks
   */
  completedChunks: string[];
  
  /**
   * IDs of pending chunks
   */
  pendingChunks: string[];
  
  /**
   * Map of failed chunks and their errors
   */
  failedChunks: Record<string, { error: string, attempts: number }>;
  
  /**
   * Map of chunk IDs to their partial results
   */
  partialResults: Record<string, string>;
  
  /**
   * Processing statistics
   */
  processingStats: {
    /**
     * When processing started
     */
    startTime: Date;
    
    /**
     * Total number of chunks
     */
    totalChunks: number;
    
    /**
     * Number of completed chunks
     */
    completedChunks: number;
    
    /**
     * Average time to process a chunk in milliseconds
     */
    averageChunkProcessingTime: number;
    
    /**
     * Estimated time remaining in milliseconds
     */
    estimatedTimeRemaining: number;
  };
  
  /**
   * Status of the checkpoint
   */
  status: CheckpointStatus;
  
  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;

  /**
   * Original chunks saved in the checkpoint
   */
  originalChunks: DocumentChunk[];
}

/**
 * Assembled document
 */
export interface AssembledDocument {
  /**
   * Unique identifier for the document
   */
  id: string;
  
  /**
   * Document content
   */
  content: string;
  
  /**
   * Document metadata
   */
  metadata: {
    /**
     * Document name
     */
    documentName: string;
    
    /**
     * Source document path
     */
    sourcePath: string;
    
    /**
     * When the document was created
     */
    createdAt: Date;
    
    /**
     * When the document was last modified
     */
    modifiedAt: Date;
    
    /**
     * Additional metadata
     */
    [key: string]: any;
  };
  
  /**
   * Processing statistics
   */
  processingStats: {
    /**
     * Total processing time in milliseconds
     */
    totalProcessingTime: number;
    
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
     * Additional statistics
     */
    [key: string]: any;
  };
}

/**
 * Options for the Persistence Manager
 */
export interface PersistenceManagerOptions {
  /**
   * Working directory for checkpoints and partial results
   * @default 'vespera-processing'
   */
  workingDirectory?: string;
  
  /**
   * Whether to use atomic writes
   * @default true
   */
  useAtomicWrites?: boolean;
  
  /**
   * Strategy for atomic writes
   * @default 'rename'
   */
  atomicWriteStrategy?: 'rename' | 'temp-file';
  
  /**
   * Whether to compress checkpoint files
   * @default false
   */
  compressCheckpoints?: boolean;
  
  /**
   * Maximum number of checkpoints to keep
   * @default 10
   */
  maxCheckpoints?: number;
  
  /**
   * Whether to clean up completed checkpoints
   * @default true
   */
  cleanupCompletedCheckpoints?: boolean;
}

/**
 * Default options for the Persistence Manager
 */
const DEFAULT_PERSISTENCE_OPTIONS: PersistenceManagerOptions = {
  workingDirectory: '.vespera-scriptorium/processing',
  useAtomicWrites: true,
  atomicWriteStrategy: 'rename',
  compressCheckpoints: false,
  maxCheckpoints: 10,
  cleanupCompletedCheckpoints: true
};

/**
 * Persistence Manager class
 * Responsible for atomic writes and checkpointing
 */
export class PersistenceManager {
  private app: App;
  private options: PersistenceManagerOptions;
  private activeLocks: Set<string> = new Set();
  
  /**
   * Create a new PersistenceManager instance
   * 
   * @param app Obsidian App instance
   * @param options Persistence options
   */
  constructor(app: App, options: PersistenceManagerOptions = {}) {
    this.app = app;
    this.options = { ...DEFAULT_PERSISTENCE_OPTIONS, ...options };
  }
  
  /**
   * Initialize the persistence manager
   * Creates necessary directories
   * 
   * @returns Promise resolving when initialization is complete
   */
  public async initialize(): Promise<void> {
    await this.ensureWorkingDirectory();
  }
  
  /**
   * Save a processing checkpoint
   * 
   * @param checkpoint Checkpoint to save
   * @returns Promise resolving to the checkpoint ID
   */
  public async saveCheckpoint(checkpoint: ProcessingCheckpoint): Promise<string> {
    // Ensure the checkpoint has an ID
    if (!checkpoint.id) {
      checkpoint.id = uuidv4();
    }
    
    // Update the timestamp
    checkpoint.timestamp = new Date();
    
    // Create the checkpoint path
    const checkpointPath = this.getCheckpointPath(checkpoint.id);
    
    // Serialize the checkpoint
    const serializedCheckpoint = JSON.stringify(checkpoint, null, 2);
    
    // Write the checkpoint file atomically
    await this.atomicWrite(checkpointPath, serializedCheckpoint);
    
    // Clean up old checkpoints if needed
    if (this.options.maxCheckpoints && this.options.maxCheckpoints > 0) {
      await this.cleanupOldCheckpoints();
    }
    
    return checkpoint.id;
  }
  
  /**
   * Load a processing checkpoint
   * 
   * @param checkpointId Checkpoint ID
   * @returns Promise resolving to the loaded checkpoint
   */
  public async loadCheckpoint(checkpointId: string): Promise<ProcessingCheckpoint> {
    const checkpointPath = this.getCheckpointPath(checkpointId);
    
    try {
      // Check if the checkpoint file exists
      const exists = await this.app.vault.adapter.exists(checkpointPath);
      if (!exists) {
        throw new Error(`Checkpoint ${checkpointId} not found`);
      }
      
      // Read the checkpoint file
      const serializedCheckpoint = await this.app.vault.adapter.read(checkpointPath);
      
      // Parse the checkpoint
      const checkpoint = JSON.parse(serializedCheckpoint) as ProcessingCheckpoint;
      
      return checkpoint;
    } catch (error) {
      console.error(`Error loading checkpoint ${checkpointId}:`, error);
      throw new Error(`Failed to load checkpoint: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Save a partial result for a chunk
   * 
   * @param chunkId Chunk ID
   * @param documentId Document ID
   * @param result Partial result
   * @returns Promise resolving when the result is saved
   */
  public async savePartialResult(chunkId: string, documentId: string, result: string): Promise<void> {
    // Create the partial result path
    const partialResultPath = this.getPartialResultPath(documentId, chunkId);
    
    // Ensure the directory exists
    await this.ensureDirectoryExists(path.dirname(partialResultPath));
    
    // Write the partial result file atomically
    await this.atomicWrite(partialResultPath, result);
  }
  
  /**
   * Load a partial result for a chunk
   * 
   * @param chunkId Chunk ID
   * @param documentId Document ID
   * @returns Promise resolving to the partial result or null if not found
   */
  public async loadPartialResult(chunkId: string, documentId: string): Promise<string | null> {
    const partialResultPath = this.getPartialResultPath(documentId, chunkId);
    
    try {
      // Check if the partial result file exists
      const exists = await this.app.vault.adapter.exists(partialResultPath);
      if (!exists) {
        return null;
      }
      
      // Read the partial result file
      return await this.app.vault.adapter.read(partialResultPath);
    } catch (error) {
      console.error(`Error loading partial result for chunk ${chunkId}:`, error);
      return null;
    }
  }
  
  /**
   * Save a completed document
   * 
   * @param document Assembled document
   * @param outputPath Output path (relative to vault root)
   * @returns Promise resolving to the output path
   */
  public async saveCompletedDocument(document: AssembledDocument, outputPath: string): Promise<string> {
    // Normalize the output path
    const normalizedPath = normalizePath(outputPath);
    
    // Ensure the directory exists
    await this.ensureDirectoryExists(path.dirname(normalizedPath));
    
    // Write the document file atomically
    await this.atomicWrite(normalizedPath, document.content);
    
    // If the checkpoint is completed, clean it up if configured to do so
    if (this.options.cleanupCompletedCheckpoints) {
      await this.cleanupCompletedCheckpoint(document.id);
    }
    
    return normalizedPath;
  }
  
  /**
   * List available checkpoints
   * 
   * @returns Promise resolving to an array of checkpoint info
   */
  public async listAvailableCheckpoints(): Promise<CheckpointInfo[]> {
    const checkpointsDir = this.getCheckpointsDirectory();
    
    try {
      // Check if the checkpoints directory exists
      const exists = await this.app.vault.adapter.exists(checkpointsDir);
      if (!exists) {
        return [];
      }
      
      // List files in the checkpoints directory
      const files = await this.app.vault.adapter.list(checkpointsDir);
      
      // Filter for JSON files
      const checkpointFiles = files.files.filter(file => file.endsWith('.json'));
      
      // Load checkpoint info for each file
      const checkpoints: CheckpointInfo[] = [];
      
      for (const file of checkpointFiles) {
        try {
          // Extract checkpoint ID from filename
          const checkpointId = path.basename(file, '.json');
          
          // Load the checkpoint
          const checkpoint = await this.loadCheckpoint(checkpointId);
          
          // Create checkpoint info
          const info: CheckpointInfo = {
            id: checkpoint.id,
            documentName: checkpoint.documentName,
            timestamp: new Date(checkpoint.timestamp),
            progress: checkpoint.processingStats.totalChunks > 0 ? 
              (checkpoint.processingStats.completedChunks / checkpoint.processingStats.totalChunks) * 100 : 0,
            status: checkpoint.status,
            metadata: checkpoint.metadata
          };
          
          checkpoints.push(info);
        } catch (error) {
          console.error(`Error loading checkpoint info for ${file}:`, error);
        }
      }
      
      // Sort by timestamp (newest first)
      return checkpoints.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      console.error('Error listing checkpoints:', error);
      return [];
    }
  }
  
  /**
   * Delete a checkpoint
   * 
   * @param checkpointId Checkpoint ID
   * @returns Promise resolving when the checkpoint is deleted
   */
  public async deleteCheckpoint(checkpointId: string): Promise<void> {
    const checkpointPath = this.getCheckpointPath(checkpointId);
    
    try {
      // Check if the checkpoint file exists
      const exists = await this.app.vault.adapter.exists(checkpointPath);
      if (!exists) {
        return;
      }
      
      // Delete the checkpoint file
      await this.app.vault.adapter.remove(checkpointPath);
      
      // Try to load the checkpoint to get the document ID
      let documentId: string | null = null;
      try {
        const checkpoint = await this.loadCheckpoint(checkpointId);
        documentId = checkpoint.documentId;
      } catch (error) {
        // Ignore errors, we'll try to clean up anyway
      }
      
      // If we have a document ID, clean up partial results
      if (documentId) {
        const partialResultsDir = this.getPartialResultsDirectory(documentId);
        
        try {
          // Check if the partial results directory exists
          const exists = await this.app.vault.adapter.exists(partialResultsDir);
          if (exists) {
            // Delete the partial results directory
            await this.app.vault.adapter.rmdir(partialResultsDir, true);
          }
        } catch (error) {
          console.error(`Error cleaning up partial results for ${documentId}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error deleting checkpoint ${checkpointId}:`, error);
      throw new Error(`Failed to delete checkpoint: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Create a new processing checkpoint
   * 
   * @param documentId Document ID
   * @param documentName Document name
   * @param chunks Array of document chunks
   * @returns Promise resolving to the created checkpoint
   */
  public async createProcessingCheckpoint(
    documentId: string,
    documentName: string,
    chunks: DocumentChunk[]
  ): Promise<ProcessingCheckpoint> {
    // Create a new checkpoint
    const checkpoint: ProcessingCheckpoint = {
      id: uuidv4(),
      documentId,
      documentName,
      timestamp: new Date(),
      completedChunks: [],
      pendingChunks: chunks.map(chunk => chunk.id),
      failedChunks: {},
      partialResults: {},
      processingStats: {
        startTime: new Date(),
        totalChunks: chunks.length,
        completedChunks: 0,
        averageChunkProcessingTime: 0,
        estimatedTimeRemaining: 0
      },
      status: CheckpointStatus.ACTIVE,
      originalChunks: chunks
    };
    
    // Save the checkpoint
    await this.saveCheckpoint(checkpoint);
    
    return checkpoint;
  }
  
  /**
   * Update a processing checkpoint
   * 
   * @param checkpoint Checkpoint to update
   * @returns Promise resolving to the updated checkpoint
   */
  public async updateProcessingCheckpoint(checkpoint: ProcessingCheckpoint): Promise<ProcessingCheckpoint> {
    // Update the timestamp
    checkpoint.timestamp = new Date();
    
    // Update processing stats
    checkpoint.processingStats.completedChunks = checkpoint.completedChunks.length;
    
    // Calculate estimated time remaining
    if (checkpoint.processingStats.completedChunks > 0) {
      const elapsedTime = new Date().getTime() - checkpoint.processingStats.startTime.getTime();
      checkpoint.processingStats.averageChunkProcessingTime = 
        elapsedTime / checkpoint.processingStats.completedChunks;
      
      const remainingChunks = checkpoint.processingStats.totalChunks - checkpoint.processingStats.completedChunks;
      checkpoint.processingStats.estimatedTimeRemaining = 
        remainingChunks * checkpoint.processingStats.averageChunkProcessingTime;
    }
    
    // Save the checkpoint
    await this.saveCheckpoint(checkpoint);
    
    return checkpoint;
  }
  
  /**
   * Mark a chunk as completed in a checkpoint
   * 
   * @param checkpointId Checkpoint ID
   * @param chunkId Chunk ID
   * @param result Chunk result
   * @returns Promise resolving to the updated checkpoint
   */
  public async markChunkCompleted(
    checkpointId: string,
    chunkId: string,
    result: string
  ): Promise<ProcessingCheckpoint> {
    // Load the checkpoint
    const checkpoint = await this.loadCheckpoint(checkpointId);
    
    // Remove the chunk from pending
    checkpoint.pendingChunks = checkpoint.pendingChunks.filter(id => id !== chunkId);
    
    // Add the chunk to completed
    if (!checkpoint.completedChunks.includes(chunkId)) {
      checkpoint.completedChunks.push(chunkId);
    }
    
    // Remove the chunk from failed if it was there
    if (chunkId in checkpoint.failedChunks) {
      delete checkpoint.failedChunks[chunkId];
    }
    
    // Save the partial result
    await this.savePartialResult(chunkId, checkpoint.documentId, result);
    
    // Update the checkpoint
    checkpoint.partialResults[chunkId] = result;
    
    // Update and save the checkpoint
    return await this.updateProcessingCheckpoint(checkpoint);
  }
  
  /**
   * Mark a chunk as failed in a checkpoint
   * 
   * @param checkpointId Checkpoint ID
   * @param chunkId Chunk ID
   * @param error Error message
   * @returns Promise resolving to the updated checkpoint
   */
  public async markChunkFailed(
    checkpointId: string,
    chunkId: string,
    error: string
  ): Promise<ProcessingCheckpoint> {
    // Load the checkpoint
    const checkpoint = await this.loadCheckpoint(checkpointId);
    
    // Update the failed chunks
    if (chunkId in checkpoint.failedChunks) {
      checkpoint.failedChunks[chunkId].attempts += 1;
      checkpoint.failedChunks[chunkId].error = error;
    } else {
      checkpoint.failedChunks[chunkId] = {
        error,
        attempts: 1
      };
    }
    
    // Update and save the checkpoint
    return await this.updateProcessingCheckpoint(checkpoint);
  }
  
  /**
   * Complete a checkpoint
   * 
   * @param checkpointId Checkpoint ID
   * @param status Completion status
   * @returns Promise resolving to the updated checkpoint
   */
  public async completeCheckpoint(
    checkpointId: string,
    status: CheckpointStatus.COMPLETED | CheckpointStatus.FAILED | CheckpointStatus.CANCELLED
  ): Promise<ProcessingCheckpoint> {
    // Load the checkpoint
    const checkpoint = await this.loadCheckpoint(checkpointId);
    
    // Update the status
    checkpoint.status = status;
    
    // Update and save the checkpoint
    return await this.updateProcessingCheckpoint(checkpoint);
  }
  
  /**
   * Ensure the working directory exists
   * 
   * @returns Promise resolving when the directory exists
   */
  private async ensureWorkingDirectory(): Promise<void> {
    const workingDir = this.getWorkingDirectory();
    const checkpointsDir = this.getCheckpointsDirectory();
    const partialResultsDir = path.join(workingDir, 'partial-results');
    const completedDir = path.join(workingDir, 'completed');
    
    // Ensure the working directory exists
    await this.ensureDirectoryExists(workingDir);
    
    // Ensure the checkpoints directory exists
    await this.ensureDirectoryExists(checkpointsDir);
    
    // Ensure the partial results directory exists
    await this.ensureDirectoryExists(partialResultsDir);
    
    // Ensure the completed directory exists
    await this.ensureDirectoryExists(completedDir);
  }
  
  /**
   * Ensure a directory exists
   * 
   * @param dirPath Directory path
   * @returns Promise resolving when the directory exists
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      // Check if the directory exists
      const exists = await this.app.vault.adapter.exists(dirPath);
      
      if (!exists) {
        // Create the directory
        await this.app.vault.createFolder(dirPath);
      }
    } catch (error) {
      console.error(`Error ensuring directory ${dirPath} exists:`, error);
      throw new Error(`Failed to create directory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get the working directory path
   * 
   * @returns Working directory path
   */
  private getWorkingDirectory(): string {
    return normalizePath(this.options.workingDirectory || DEFAULT_PERSISTENCE_OPTIONS.workingDirectory!);
  }
  
  /**
   * Get the checkpoints directory path
   * 
   * @returns Checkpoints directory path
   */
  private getCheckpointsDirectory(): string {
    return path.join(this.getWorkingDirectory(), 'checkpoints');
  }
  
  /**
   * Get the partial results directory path for a document
   * 
   * @param documentId Document ID
   * @returns Partial results directory path
   */
  private getPartialResultsDirectory(documentId: string): string {
    return path.join(this.getWorkingDirectory(), 'partial-results', documentId);
  }
  
  /**
   * Get the checkpoint file path
   * 
   * @param checkpointId Checkpoint ID
   * @returns Checkpoint file path
   */
  private getCheckpointPath(checkpointId: string): string {
    return path.join(this.getCheckpointsDirectory(), `${checkpointId}.json`);
  }
  
  /**
   * Get the partial result file path
   * 
   * @param documentId Document ID
   * @param chunkId Chunk ID
   * @returns Partial result file path
   */
  private getPartialResultPath(documentId: string, chunkId: string): string {
    return path.join(this.getPartialResultsDirectory(documentId), `${chunkId}.txt`);
  }
  
  /**
   * Write a file atomically
   * 
   * @param filePath File path
   * @param content File content
   * @returns Promise resolving when the file is written
   */
  private async atomicWrite(filePath: string, content: string): Promise<void> {
    if (!this.options.useAtomicWrites) {
      // Simple write if atomic writes are disabled
      await this.app.vault.adapter.write(filePath, content);
      return;
    }
    
    // Acquire a lock for the file
    await this.acquireLock(filePath);
    
    try {
      if (this.options.atomicWriteStrategy === 'temp-file') {
        // Write to a temporary file first
        const tempPath = `${filePath}.tmp`;
        await this.app.vault.adapter.write(tempPath, content);
        
        // Check if the target file exists
        const exists = await this.app.vault.adapter.exists(filePath);
        
        if (exists) {
          // Remove the existing file
          await this.app.vault.adapter.remove(filePath);
        }
        
        // Rename the temporary file to the target file
        // Note: Obsidian's adapter doesn't have a rename method, so we need to use a workaround
        const tempContent = await this.app.vault.adapter.read(tempPath);
        await this.app.vault.adapter.write(filePath, tempContent);
        await this.app.vault.adapter.remove(tempPath);
      } else {
        // Default strategy: direct write
        // This is less atomic but simpler
        await this.app.vault.adapter.write(filePath, content);
      }
    } finally {
      // Release the lock
      this.releaseLock(filePath);
    }
  }
  
  /**
   * Acquire a lock for a resource
   * 
   * @param resourceId Resource ID
   * @returns Promise resolving when the lock is acquired
   */
  private async acquireLock(resourceId: string): Promise<void> {
    // Simple in-memory lock
    // In a real implementation, we would use file-based locking
    
    // Wait until the lock is available
    while (this.activeLocks.has(resourceId)) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Acquire the lock
    this.activeLocks.add(resourceId);
  }
  
  /**
   * Release a lock for a resource
   * 
   * @param resourceId Resource ID
   */
  private releaseLock(resourceId: string): void {
    // Release the lock
    this.activeLocks.delete(resourceId);
  }
  
  /**
   * Clean up old checkpoints
   * 
   * @returns Promise resolving when cleanup is complete
   */
  private async cleanupOldCheckpoints(): Promise<void> {
    // Get all checkpoints
    const checkpoints = await this.listAvailableCheckpoints();
    
    // If we have more checkpoints than the maximum, delete the oldest ones
    if (checkpoints.length > (this.options.maxCheckpoints || DEFAULT_PERSISTENCE_OPTIONS.maxCheckpoints!)) {
      // Sort by timestamp (oldest first)
      const sortedCheckpoints = checkpoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      // Calculate how many to delete
      const deleteCount = sortedCheckpoints.length - (this.options.maxCheckpoints || DEFAULT_PERSISTENCE_OPTIONS.maxCheckpoints!);
      
      // Delete the oldest checkpoints
      for (let i = 0; i < deleteCount; i++) {
        await this.deleteCheckpoint(sortedCheckpoints[i].id);
      }
    }
  }
  
  /**
   * Clean up a completed checkpoint
   * 
   * @param documentId Document ID
   * @returns Promise resolving when cleanup is complete
   */
  private async cleanupCompletedCheckpoint(documentId: string): Promise<void> {
    // Get all checkpoints
    const checkpoints = await this.listAvailableCheckpoints();
    
    // Find checkpoints for this document
    const documentCheckpoints = checkpoints.filter(cp => 
      cp.metadata && cp.metadata.documentId === documentId && 
      (cp.status === CheckpointStatus.COMPLETED || cp.status === CheckpointStatus.FAILED)
    );
    
    // Delete the checkpoints
    for (const checkpoint of documentCheckpoints) {
      await this.deleteCheckpoint(checkpoint.id);
    }
    
    // Clean up partial results
    const partialResultsDir = this.getPartialResultsDirectory(documentId);
    
    try {
      // Check if the partial results directory exists
      const exists = await this.app.vault.adapter.exists(partialResultsDir);
      if (exists) {
        // Delete the partial results directory
        await this.app.vault.adapter.rmdir(partialResultsDir, true);
      }
    } catch (error) {
      console.error(`Error cleaning up partial results for ${documentId}:`, error);
    }
  }
}

/**
 * Create a persistence manager instance
 * 
 * @param app Obsidian App instance
 * @param options Persistence options
 * @returns Persistence manager instance
 */
export function createPersistenceManager(app: App, options: PersistenceManagerOptions = {}): PersistenceManager {
  return new PersistenceManager(app, options);
}