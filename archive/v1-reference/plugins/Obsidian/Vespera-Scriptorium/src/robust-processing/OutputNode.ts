import { App, normalizePath } from 'obsidian';
import * as path from 'path';
import { ProcessingNode, ProcessingNodeOptions, ProcessingFunction } from './ProcessingNode';
import { ChunkResult } from './ProcessingOrchestrator';
import { OutputManager, OutputOptions, DEFAULT_OUTPUT_OPTIONS, OutputFormat } from './OutputManager';
import { DocumentChunk } from './AdaptiveChunker'; // Added import

// T_ProcOptions for ProcessingNode, specific to OutputNode's processing function
export interface OutputNodeProcessingOptions extends OutputOptions { 
    // Currently, this directly uses OutputManager's OutputOptions.
    // Add any OutputNode-specific processing options here if needed in the future.
}

/**
 * A wrapper for an array of ChunkResult objects, conforming to DocumentChunk for ProcessingNode compatibility.
 * The 'content' field can be a summary or placeholder, 'id' and 'metadata' should be appropriately set.
 */
export interface OutputTriggerChunk extends DocumentChunk {
    results: ChunkResult[];
}

/**
 * OutputNode is a specialized processing node responsible for taking an array of ChunkResult objects
 * (wrapped in an OutputTriggerChunk) and using an OutputManager to handle the final output operations,
 * such as writing to a file.
 */
export class OutputNode extends ProcessingNode<OutputTriggerChunk, void, OutputNodeProcessingOptions> {
    private outputManager: OutputManager;
    private app: App; // Store app instance

    constructor(
        appInstance: App, 
        nodeOpts: Partial<ProcessingNodeOptions<OutputNodeProcessingOptions>> = {}
    ) {
        const outputProcessingFunc: ProcessingFunction<OutputTriggerChunk, void, OutputNodeProcessingOptions> =
            async (triggerChunk, funcOptions) => {
                const nodeId = this.nodeId; // Capture nodeId for logging
                const resultsInput = triggerChunk.results; // Extract the actual array of results

                if (!resultsInput || resultsInput.length === 0) {
                    console.warn(`[${nodeId}] OutputNode received no results to process via OutputTriggerChunk.`);
                    return;
                }
                console.info(`[${nodeId}] OutputNode received ${resultsInput.length} chunk results for final output.`);

                try {
                    const aggregatedContent = resultsInput.map(chunk => chunk.content).join('\n\n---\n\n');
                    
                    const targetDir = funcOptions?.targetLocation || DEFAULT_OUTPUT_OPTIONS.targetLocation;
                    const baseFileNameTemplate = funcOptions?.filenameTemplate || DEFAULT_OUTPUT_OPTIONS.filenameTemplate;
                    const outputFormat = funcOptions?.format || DEFAULT_OUTPUT_OPTIONS.format;

                    let resolvedFileName = baseFileNameTemplate;
                    // Basic template replacement for documentName
                    if (baseFileNameTemplate.includes('{documentName}')) {
                        // Try to get documentName from the OutputTriggerChunk's metadata, or fall back to resultsInput
                        let docName = triggerChunk.metadata?.sourceDocument || 
                                      resultsInput.find(c => c.metadata?.sourceDocument)?.metadata?.sourceDocument || 
                                      'processed_document';
                        const docNameWithoutExt = docName.includes('.') ? docName.substring(0, docName.lastIndexOf('.')) : docName;
                        resolvedFileName = baseFileNameTemplate.replace('{documentName}', docNameWithoutExt);
                    }
                    // Ensure the filename has the correct extension for the format
                    const currentExt = path.extname(resolvedFileName);
                    const expectedExt = `.${outputFormat}`;
                    if (currentExt.toLowerCase() !== expectedExt.toLowerCase()) {
                        resolvedFileName = resolvedFileName.replace(currentExt, '') + expectedExt;
                    }

                    const fullPath = normalizePath(path.join(targetDir, resolvedFileName));
                    
                    const vault = this.app.vault;
                    const parentDir = path.dirname(fullPath);
                    if (!(await vault.adapter.exists(parentDir))) {
                        await vault.adapter.mkdir(parentDir);
                    }

                    // Pass the determined outputFormat to saveFile if OutputManager supports it
                    await this.outputManager.saveFile(fullPath, aggregatedContent, outputFormat);

                    console.info(`[${nodeId}] OutputNode successfully processed and saved output to ${fullPath}.`);
                } catch (error: any) {
                    console.error(`[${nodeId}] Error during output processing in OutputNode:`, error.message, error.stack);
                    throw error;
                }
            };

        super(outputProcessingFunc, nodeOpts); 
        this.app = appInstance;
        this.outputManager = new OutputManager(this.app);
    }

    /**
     * Creates a new instance of OutputNode.
     * @param app The Obsidian App instance.
     * @param options Configuration options for the OutputNode.
     * @returns A new instance of OutputNode.
     */
    static create(app: App, options: Partial<ProcessingNodeOptions<OutputNodeProcessingOptions>> = {}): OutputNode {
        return new OutputNode(app, options);
    }
}