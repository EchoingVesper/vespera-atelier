/**
 * @file ManualIngestionTrigger.ts
 * @description Provides a user-initiated mechanism to start the ingestion process.
 */

import { IngestionProcessor } from './IngestionProcessor';
import { Notice } from 'obsidian';

/**
 * Interface for ingestion result status
 */
interface IngestionResult {
    success: boolean;
    filePath: string;
    message?: string;
    error?: Error;
}

export class ManualIngestionTrigger {
    private ingestionProcessor: IngestionProcessor;

    constructor(ingestionProcessor: IngestionProcessor) {
        this.ingestionProcessor = ingestionProcessor;
        console.log("ManualIngestionTrigger initialized");
    }

    /**
     * Triggers the ingestion process for a specified set of files.
     * This method would typically be called from a UI element (e.g., a button in a modal)
     * or a command palette action.
     * @param filePaths An array of absolute file paths to ingest.
     */
    public async triggerIngestion(filePaths: string[]): Promise<void> {
        if (!filePaths || filePaths.length === 0) {
            console.warn("Manual ingestion trigger received no file paths.");
            return;
        }

        console.log(`Manual ingestion triggered for ${filePaths.length} file(s):`, filePaths);

        for (const filePath of filePaths) {
            try {
                await this.initiateIngestionProcess(filePath);
            } catch (error) {
                console.error(`Error during manual ingestion of ${filePath}:`, error);
                // Potentially notify the user of the failure for this specific file
            }
        }
        console.log("Manual ingestion process completed for all specified files.");
        // Potentially notify the user of overall completion/status
    }

    /**
     * Initiates the ingestion process for a single file.
     * This method interacts with the IngestionProcessor to start the ingestion workflow.
     * @param filePath The absolute path of the file to ingest.
     * @returns A promise that resolves to an IngestionResult object.
     */
    private async initiateIngestionProcess(filePath: string): Promise<IngestionResult> {
        console.log(`Initiating ingestion process for: ${filePath}`);
        
        try {
            // Validate the file path
            if (!filePath || filePath.trim() === '') {
                throw new Error('Invalid file path: Path cannot be empty');
            }
            
            // Process the file using the IngestionProcessor
            await this.ingestionProcessor.processFile(filePath);
            
            // Return success result
            return {
                success: true,
                filePath,
                message: `Successfully ingested: ${filePath}`
            };
        } catch (error) {
            console.error(`Error during ingestion of ${filePath}:`, error);
            
            // Return failure result
            return {
                success: false,
                filePath,
                message: `Failed to ingest: ${filePath}`,
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }
    
    /**
     * Shows a notification to the user about the ingestion status.
     * @param result The result of the ingestion process.
     */
    private showNotification(result: IngestionResult): void {
        if (result.success) {
            new Notice(`✅ ${result.message}`);
        } else {
            new Notice(`❌ ${result.message}: ${result.error?.message || 'Unknown error'}`);
        }
    }
}