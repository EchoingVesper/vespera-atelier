/**
 * @file IngestionProcessor.ts
 * @description Core component for the ingestion system, coordinating document preparation and processing.
 */

import { MetadataExtractor, ExtractedMetadata } from './MetadataExtractor';
import { TFile, Vault } from 'obsidian';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Interface for documents to be processed
 */
export interface DocumentToProcess {
    filePath: string;
    content: string;
    metadata: ExtractedMetadata;
}

/**
 * Interface for workflow configuration
 */
export interface WorkflowConfig {
    id: string;
    name: string;
    description?: string;
    [key: string]: any;
}

/**
 * Interface for queue configuration
 */
export interface QueueConfig {
    queueName: string;
    priority?: number;
    [key: string]: any;
}

export class IngestionProcessor {
    private metadataExtractor: MetadataExtractor;
    private vault: Vault | null;
    private queueManager: any | null; // Using any for now, would be QueueManager in actual implementation
    private workflowEngine: any | null; // Using any for now, would be WorkflowExecutionEngine in actual implementation
    private isObsidianEnvironment: boolean;
    private defaultWorkflow: WorkflowConfig;
    private defaultQueue: QueueConfig;

    constructor(
        metadataExtractor: MetadataExtractor,
        vault?: Vault,
        queueManager?: any,
        workflowEngine?: any
    ) {
        this.metadataExtractor = metadataExtractor;
        this.vault = vault || null;
        this.isObsidianEnvironment = !!vault;
        this.queueManager = queueManager || null;
        this.workflowEngine = workflowEngine || null;
        
        // Default workflow and queue configurations
        this.defaultWorkflow = {
            id: 'default-processing-workflow',
            name: 'Default Processing Workflow'
        };
        
        this.defaultQueue = {
            queueName: 'ingestion-queue',
            priority: 1
        };
        
        console.log(`IngestionProcessor initialized in ${this.isObsidianEnvironment ? 'Obsidian' : 'standalone'} mode`);
    }

    /**
     * Processes a single file for ingestion.
     * This involves reading the file, extracting metadata, and then initiating the
     * main processing workflow (e.g., by adding to a queue or calling a workflow engine).
     * @param filePath The absolute path of the file to process.
     */
    /**
     * Processes a single file for ingestion.
     * This involves reading the file, extracting metadata, and then initiating the
     * main processing workflow (e.g., by adding to a queue or calling a workflow engine).
     * @param filePath The absolute path of the file to process.
     * @returns A promise that resolves when processing is complete.
     */
    public async processFile(filePath: string): Promise<void> {
        console.log(`IngestionProcessor: Starting processing for ${filePath}`);
        try {
            // Validate file path
            if (!filePath || filePath.trim() === '') {
                throw new Error('Invalid file path: Path cannot be empty');
            }
            
            // Check if file exists
            await this.checkFileExists(filePath);
            
            // Read file content
            const fileContent = await this.readFileContent(filePath);
            
            // Extract metadata
            const metadata = await this.metadataExtractor.extractMetadata(filePath, fileContent);
            
            // Create document object
            const documentToProcess: DocumentToProcess = {
                filePath,
                content: fileContent,
                metadata,
            };
            
            // Log document details (excluding content for brevity)
            console.log(`Document prepared for processing: ${filePath}`, {
                filePath: documentToProcess.filePath,
                metadata: documentToProcess.metadata,
                contentLength: documentToProcess.content.length
            });
            
            // Initiate workflow
            await this.initiateWorkflow(documentToProcess);
            
            console.log(`IngestionProcessor: Successfully processed ${filePath}`);
        } catch (error) {
            console.error(`IngestionProcessor: Error processing file ${filePath}:`, error);
            
            // Handle specific error types
            if (error instanceof Error) {
                if (error.message.includes('not found') || error.message.includes('no such file')) {
                    console.error(`File not found: ${filePath}`);
                    // Could add to a "failed files" list or notify user
                } else if (error.message.includes('permission')) {
                    console.error(`Permission denied for file: ${filePath}`);
                    // Could notify user about permission issues
                } else {
                    console.error(`Unexpected error processing ${filePath}: ${error.message}`);
                }
            }
            
            // Re-throw the error for upstream handling
            throw error;
        }
    }
    
    /**
     * Processes multiple files for ingestion.
     * @param filePaths An array of file paths to process.
     * @returns A promise that resolves to an array of results, including successes and failures.
     */
    public async processFiles(filePaths: string[]): Promise<{
        successful: string[];
        failed: { path: string; error: string }[];
    }> {
        console.log(`IngestionProcessor: Starting batch processing for ${filePaths.length} files`);
        
        const results = {
            successful: [] as string[],
            failed: [] as { path: string; error: string }[]
        };
        
        // Process files sequentially to avoid overwhelming the system
        for (const filePath of filePaths) {
            try {
                await this.processFile(filePath);
                results.successful.push(filePath);
            } catch (error) {
                results.failed.push({
                    path: filePath,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
        
        console.log(`IngestionProcessor: Batch processing complete. Success: ${results.successful.length}, Failed: ${results.failed.length}`);
        return results;
    }
    
    /**
     * Checks if a file exists and is accessible.
     * @param filePath The path of the file to check.
     * @throws Error if the file doesn't exist or isn't accessible.
     */
    private async checkFileExists(filePath: string): Promise<void> {
        try {
            if (this.isObsidianEnvironment && this.vault) {
                const file = this.vault.getAbstractFileByPath(filePath);
                if (!(file instanceof TFile)) {
                    throw new Error(`File not found in Obsidian vault: ${filePath}`);
                }
            } else {
                // Use Node.js fs in non-Obsidian environment
                await fs.promises.access(filePath, fs.constants.F_OK | fs.constants.R_OK);
            }
        } catch (error) {
            console.error(`Error checking file existence: ${filePath}`, error);
            throw new Error(`File not found or not accessible: ${filePath}`);
        }
    }

    /**
     * Reads the content of a file.
     * @param filePath The absolute path of the file to read.
     * @returns A promise that resolves to the string content of the file.
     */
    /**
     * Reads the content of a file.
     * Uses Obsidian API if available, otherwise falls back to Node.js fs.
     * @param filePath The path of the file to read.
     * @returns A promise that resolves to the file content as a string.
     */
    private async readFileContent(filePath: string): Promise<string> {
        console.log(`Reading content for: ${filePath}`);
        
        try {
            if (this.isObsidianEnvironment && this.vault) {
                const file = this.vault.getAbstractFileByPath(filePath);
                if (file instanceof TFile) {
                    return await this.vault.cachedRead(file);
                }
                throw new Error(`File not found or not a TFile: ${filePath}`);
            } else {
                // Use Node.js fs in non-Obsidian environment
                return await fs.promises.readFile(filePath, 'utf8');
            }
        } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
            throw new Error(`Failed to read file content: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Initiates the main processing workflow for the ingested document.
     * This could involve adding the document to a processing queue or directly
     * invoking a workflow execution engine.
     * @param document The document object, including its content and metadata.
     * @param metadata The extracted metadata for the document.
     */
    /**
     * Initiates the main processing workflow for the ingested document.
     * This could involve adding the document to a processing queue or directly
     * invoking a workflow execution engine.
     * @param document The document object, including its content and metadata.
     */
    private async initiateWorkflow(document: DocumentToProcess): Promise<void> {
        console.log(`Initiating workflow for document: ${document.filePath}`);
        
        try {
            // If queue manager is available, enqueue the document
            if (this.queueManager) {
                const queueItem = {
                    type: 'processDocument',
                    payload: document,
                    metadata: {
                        timestamp: new Date().toISOString(),
                        source: 'IngestionProcessor',
                        priority: document.metadata.priority || this.defaultQueue.priority
                    }
                };
                
                await this.queueManager.enqueue(this.defaultQueue.queueName, queueItem);
                console.log(`Document ${document.filePath} enqueued for processing in ${this.defaultQueue.queueName}.`);
                return;
            }
            
            // If workflow engine is available, start workflow directly
            if (this.workflowEngine) {
                await this.workflowEngine.startWorkflow(
                    this.defaultWorkflow.id,
                    document,
                    { source: 'IngestionProcessor' }
                );
                console.log(`Directly started workflow ${this.defaultWorkflow.id} for ${document.filePath}.`);
                return;
            }
            
            // If neither is available, log a warning
            console.warn(`No queue manager or workflow engine configured. Document ${document.filePath} not further processed.`);
            
            // In development/testing mode, simulate processing
            if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
                return new Promise(resolve => setTimeout(() => {
                    console.log(`Simulated workflow initiation complete for ${document.filePath}`);
                    resolve();
                }, 300));
            }
        } catch (error) {
            console.error(`Error initiating workflow for ${document.filePath}:`, error);
            throw new Error(`Failed to initiate workflow: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    /**
     * Sets the default workflow configuration.
     * @param config The workflow configuration.
     */
    public setDefaultWorkflow(config: WorkflowConfig): void {
        this.defaultWorkflow = config;
        console.log(`Default workflow set to: ${config.id}`);
    }
    
    /**
     * Sets the default queue configuration.
     * @param config The queue configuration.
     */
    public setDefaultQueue(config: QueueConfig): void {
        this.defaultQueue = config;
        console.log(`Default queue set to: ${config.queueName}`);
    }
}