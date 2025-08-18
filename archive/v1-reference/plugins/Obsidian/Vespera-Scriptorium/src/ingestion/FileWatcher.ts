/**
 * @file FileWatcher.ts
 * @description Monitors specified directories or files for changes and triggers the ingestion process.
 */

import { Events, TAbstractFile, Vault } from 'obsidian';
// For non-Obsidian environments, we could use a library like 'chokidar'
// import * as chokidar from 'chokidar';

import { IngestionProcessor } from './IngestionProcessor';

export class FileWatcher extends Events { // Extending Obsidian's Events for event handling
    private watchingPaths: Set<string>;
    private vault: Vault;
    private ingestionProcessor: IngestionProcessor;
    private fileEventHandlers: Map<string, () => void>;

    constructor(vault: Vault, ingestionProcessor: IngestionProcessor) {
        super(); // Initialize Events
        this.watchingPaths = new Set<string>();
        this.vault = vault;
        this.ingestionProcessor = ingestionProcessor;
        this.fileEventHandlers = new Map();
        console.log("FileWatcher initialized");
    }

    /**
     * Starts watching the specified paths for file changes.
     * @param paths An array of absolute file or directory paths to watch.
     */
    public startWatching(paths: string[]): void {
        paths.forEach(path => {
            if (!this.watchingPaths.has(path)) {
                this.watchingPaths.add(path);
                
                // Register event handlers for Obsidian vault events
                const modifyHandler = this.registerVaultEvent('modify', path);
                const createHandler = this.registerVaultEvent('create', path);
                const deleteHandler = this.registerVaultEvent('delete', path);
                
                // Store handlers for later removal
                this.fileEventHandlers.set(`${path}:modify`, modifyHandler);
                this.fileEventHandlers.set(`${path}:create`, createHandler);
                this.fileEventHandlers.set(`${path}:delete`, deleteHandler);
                
                console.log(`Started watching: ${path}`);
            }
        });
    }

    /**
     * Registers an event handler for a specific vault event and path.
     * @param eventType The type of event to watch for ('modify', 'create', 'delete')
     * @param watchPath The path to watch
     * @returns A function that can be called to unregister the event handler
     */
    private registerVaultEvent(eventType: string, watchPath: string): () => void {
        // Create a handler function that checks if the file path matches our watched path
        const handler = (file: TAbstractFile): void => {
            // Check if the file path matches or is within the watched path
            if (file.path === watchPath ||
                (watchPath.endsWith('/') && file.path.startsWith(watchPath)) ||
                file.path.startsWith(watchPath + '/')) {
                this.onFileChange(file.path, eventType as 'create' | 'modify' | 'delete');
            }
        };
        
        // Register the event handler with Obsidian's vault
        // Using 'any' to bypass TypeScript's strict event type checking
        // since Obsidian's API might have different event types than what we're using
        (this.vault as any).on(eventType, handler);
        
        // Return a function that can be called to unregister this handler
        return () => {
            (this.vault as any).off(eventType, handler);
        };
    }

    /**
     * Stops watching all currently monitored paths.
     */
    public stopWatching(): void {
        this.watchingPaths.forEach(path => {
            // Unregister all event handlers for this path
            ['modify', 'create', 'delete'].forEach(eventType => {
                const handlerKey = `${path}:${eventType}`;
                const unregisterHandler = this.fileEventHandlers.get(handlerKey);
                if (unregisterHandler) {
                    unregisterHandler();
                    this.fileEventHandlers.delete(handlerKey);
                }
            });
            console.log(`Stopped watching: ${path}`);
        });
        this.watchingPaths.clear();
    }

    /**
     * Handles detected file changes.
     * @param filePath The path of the file that changed.
     * @param eventType The type of change (e.g., 'create', 'modify', 'delete').
     */
    /**
     * Handles detected file changes.
     * @param filePath The path of the file that changed.
     * @param eventType The type of change (e.g., 'create', 'modify', 'delete').
     */
    private onFileChange(filePath: string, eventType: 'create' | 'modify' | 'delete'): void {
        console.log(`File change detected: ${filePath}, Event: ${eventType}`);
        
        // Filter out temporary files or files that should be ignored
        if (this.shouldIgnoreFile(filePath)) {
            console.log(`Ignoring file: ${filePath}`);
            return;
        }

        if (eventType === 'delete') {
            // Handle deletion, e.g., remove from index or mark as deleted
            console.log(`File deleted: ${filePath}. Further processing might be needed.`);
            // Emit an event that can be listened to by other components
            this.trigger('file-deleted', filePath);
            return;
        }
        
        // For create or modify events, trigger ingestion
        this.triggerIngestion(filePath);
    }

    /**
     * Determines if a file should be ignored based on its path or other criteria.
     * @param filePath The path of the file to check.
     * @returns True if the file should be ignored, false otherwise.
     */
    private shouldIgnoreFile(filePath: string): boolean {
        // Ignore temporary files
        if (filePath.includes('.tmp') || filePath.endsWith('~')) {
            return true;
        }
        
        // Ignore hidden files (starting with .)
        const fileName = filePath.split('/').pop();
        if (fileName && fileName.startsWith('.')) {
            return true;
        }
        
        // Add more ignore rules as needed
        
        return false;
    }

    /**
     * Triggers the ingestion process for a given file.
     * @param filePath The path of the file to ingest.
     */
    private triggerIngestion(filePath: string): void {
        console.log(`Triggering ingestion for: ${filePath}`);
        
        try {
            // Process the file using the IngestionProcessor
            this.ingestionProcessor.processFile(filePath);
            
            // Also emit an event that can be listened to by other components
            this.trigger('file-ingested', filePath);
        } catch (error) {
            console.error(`Error triggering ingestion for ${filePath}:`, error);
            this.trigger('ingestion-error', { filePath, error });
        }
    }
}