import { App, Notice, TFile, Plugin } from 'obsidian';
import { Parser, createParser, ParseResult, ParserError } from "../Parser";
import { VesperaScriptoriumSettings } from "../SettingsManager";
import { FileTreeNode } from "../ui/MultiSelectModal";
import { ProgressManager } from "../ui/ProgressPane";
import { OutputFile, FileStatus, OutputFilesManager } from "../ui/OutputFilesView";
import { LLMProcessingService } from "../services/LLMProcessingService";
import { createWriter, SummaryContent } from "../Writer";

/**
 * DocumentProcessor handles the processing of documents, including parsing,
 * chunking, and coordinating with the LLM service for processing.
 */
export class DocumentProcessor {
  private app: App;
  private settings: VesperaScriptoriumSettings;
  private llmProcessingService: LLMProcessingService;
  private outputFilesManager: OutputFilesManager | null;
  private isCancelled: boolean = false;
  private plugin: Plugin;

  /**
   * Create a new DocumentProcessor instance
   *
   * @param app The Obsidian app instance
   * @param settings Plugin settings
   * @param llmProcessingService LLM processing service
   * @param outputFilesManager Output files manager
   * @param plugin The plugin instance
   */
  constructor(
    app: App,
    settings: VesperaScriptoriumSettings,
    llmProcessingService: LLMProcessingService,
    outputFilesManager: OutputFilesManager | null,
    plugin: Plugin
  ) {
    this.app = app;
    this.settings = settings;
    this.llmProcessingService = llmProcessingService;
    this.outputFilesManager = outputFilesManager;
    this.plugin = plugin;
  }

  /**
   * Set the cancellation flag
   * 
   * @param cancelled Whether processing should be cancelled
   */
  public setCancelled(cancelled: boolean): void {
    this.isCancelled = cancelled;
  }

  /**
   * Process selected files
   * 
   * @param selected Selected file tree nodes
   * @param prompt User-provided prompt for processing
   * @returns Promise that resolves when processing is complete
   */
  public async processSelectedFiles(selected: FileTreeNode[], prompt: string): Promise<void> {
    try {
      new Notice(`Parsing ${selected.length} file(s)...`);
      
      // Create parser instance
      const parser = createParser(this.app.vault, this.settings);
      
      // Convert FileTreeNode[] to TFile[]
      const files: TFile[] = [];
      for (const node of selected) {
        if (!node.isFolder) {
          const file = this.app.vault.getFileByPath(node.path);
          if (file) {
            files.push(file);
          }
        }
      }
      
      if (files.length === 0) {
        new Notice("No valid files selected for parsing.");
        return;
      }
      
      // Parse the files
      const parseResults = await parser.parseFiles(files);
      
      // Log the parse results
      console.log("Parse results:", parseResults);
      new Notice(`Successfully parsed ${parseResults.length} file(s). Chunking text...`);
      
      // Process with Chunker module and LLMClient
      try {
        // Import the Chunker module
        const { splitTextIntoChunks } = await import('../Chunker');
        
        // Reset cancellation flag
        this.isCancelled = false;
        
        // Create a progress manager
        const totalFiles = parseResults.length;
        const progressManager = new ProgressManager(this.plugin);
        
        // Create a progress item
        progressManager.createProgressItem({
          id: 'processing-files',
          title: 'Processing Files',
          total: totalFiles,
          current: 0
        });
        
        // Process each parsed file
        const allResults: { fileName: string, summary: string }[] = [];
        
        for (let i = 0; i < parseResults.length; i++) {
          // Check if cancelled
          if (this.isCancelled) {
            progressManager.updateProgressItem('processing-files', {
              current: i,
              message: 'Operation cancelled'
            });
            break;
          }
          
          const parseResult = parseResults[i];
          
          // Update progress
          progressManager.updateProgressItem('processing-files', {
            current: i,
            message: `Processing file ${i+1}/${totalFiles}: ${parseResult.metadata.fileName}`
          });
          
          // Get chunking options from settings
          const chunkingOptions = {
            chunkSize: this.settings.chunkSize,
            chunkOverlap: this.settings.chunkOverlap,
            modelContextWindow: this.settings.modelContextWindow,
            promptOverhead: 500 // Estimate for prompt overhead
          };
          
          try {
            // Split the text into chunks
            const chunks = await splitTextIntoChunks(parseResult.content, chunkingOptions);
            
            // Process chunks with LLM
            const summary = await this.llmProcessingService.processChunksWithLLM(
              chunks,
              parseResult.metadata.fileName,
              prompt,
              progressManager
            );
            
            // Add to results
            allResults.push({
              fileName: parseResult.metadata.fileName,
              summary
            });
            
            // Update progress
            progressManager.updateProgressItem('processing-files', {
              current: i + 1,
              message: `Completed file ${i+1}/${totalFiles}: ${parseResult.metadata.fileName}`
            });
          } catch (error) {
            console.error(`Error processing file ${parseResult.metadata.fileName}:`, error);
            progressManager.updateProgressItem('processing-files', {
              current: i,
              message: `Error processing ${parseResult.metadata.fileName}: ${error instanceof Error ? error.message : String(error)}`
            });
          }
        }
        
        // Complete progress
        progressManager.removeProgressItem('processing-files');
        
        // Show completion notice
        if (!this.isCancelled) {
          // Use the Writer module to save the results
          try {
            // Create a writer instance
            const writer = createWriter({
              app: this.app,
              settings: this.settings
            });
            
            // Write each summary to a file
            const writtenFiles: string[] = [];
            for (const result of allResults) {
              // Create summary content object
              const summaryContent: SummaryContent = {
                fileName: result.fileName,
                content: result.summary,
                metadata: {
                  sourceFile: result.fileName,
                  date: new Date(),
                  model: this.settings.llm.model,
                  prompt: prompt
                }
              };
              
              // Write the summary to a file
              const filePath = await writer.writeSummary(summaryContent);
              writtenFiles.push(filePath);
              
              // Add to output files list
              if (this.outputFilesManager) {
                const outputFile: OutputFile = {
                  path: filePath,
                  name: `Summary of ${result.fileName}`,
                  metadata: {
                    sourcePath: result.fileName,
                    timestamp: Date.now()
                  },
                  status: FileStatus.COMPLETED,
                  id: `summary-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                };
                this.outputFilesManager.addFile(outputFile);
              }
            }
            
            // Show success notice
            new Notice(`Successfully processed ${allResults.length} file(s) and saved summaries to:\n${writtenFiles.join('\n')}`);
          } catch (error) {
            console.error("Error saving summaries:", error);
            new Notice(`Error saving summaries: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      } catch (error) {
        console.error("Error chunking text:", error);
        new Notice(`Error chunking text: ${error instanceof Error ? error.message : String(error)}`);
      }
    } catch (error) {
      console.error("Error parsing files:", error);
      if (error instanceof ParserError) {
        new Notice(`Parser error: ${error.message}`);
      } else {
        new Notice(`Error parsing files: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Process a checkpoint from the robust processing system
   * 
   * @param checkpointId ID of the checkpoint to process
   * @returns Promise that resolves when processing is complete
   */
  public async processCheckpoint(checkpointId: string, robustProcessingSystem: any): Promise<void> {
    try {
      // Create a progress manager
      const progressManager = new ProgressManager(this.plugin);
      
      // Create a progress item
      progressManager.createProgressItem({
        id: 'resuming-processing',
        title: 'Resuming Processing',
        total: 100,
        current: 0
      });
      
      // Create processing options
      const processingOptions = {
        progressCallback: (progress: any) => {
          // Update progress in UI
          const progressPercent = Math.round(progress.progress);
          progressManager.updateProgressItem('resuming-processing', {
            current: progressPercent,
            message: `Resuming processing: ${progressPercent}% complete`
          });
        }
      };
      
      // Resume processing
      const result = await robustProcessingSystem.processingOrchestrator.resumeProcessing(
        checkpointId,
        processingOptions
      );
      
      // Complete progress
      progressManager.removeProgressItem('resuming-processing');
      
      // If processing was successful, assemble the document
      if (result.success) {
        // Get checkpoint info
        const checkpoint = await robustProcessingSystem.persistenceManager.loadCheckpoint(checkpointId);
        
        // Create assembly options
        const assemblyOptions = {
          preserveChunkBoundaries: this.settings.robustProcessing.assembly.preserveChunkBoundaries,
          resolveReferences: this.settings.robustProcessing.assembly.resolveReferences,
          detectRedundancies: this.settings.robustProcessing.assembly.detectRedundancies,
          optimizeForCoherence: this.settings.robustProcessing.assembly.optimizeForCoherence,
          similarityThreshold: this.settings.robustProcessing.assembly.similarityThreshold,
          includeMetadata: this.settings.robustProcessing.output.includeMetadata,
          includeProcessingStats: this.settings.robustProcessing.output.includeProcessingStats
        };
        
        // Create output options
        const outputOptions = {
          format: this.settings.robustProcessing.output.format,
          consolidate: this.settings.robustProcessing.output.consolidate,
          includeMetadata: this.settings.robustProcessing.output.includeMetadata,
          includeProcessingStats: this.settings.robustProcessing.output.includeProcessingStats,
          targetLocation: this.settings.writer.outputLocation === 'custom-path' ?
            this.settings.writer.customPath : 'summaries',
          filenameTemplate: `${checkpoint.documentName}-processed`,
          createTableOfContents: this.settings.robustProcessing.output.createTableOfContents,
          includeReferences: this.settings.robustProcessing.output.includeReferences
        };
        
        // Assemble the document
        const assembledDocument = robustProcessingSystem.documentAssembler.assembleDocument(
          result.content,
          checkpoint.documentName,
          checkpoint.documentId,
          result.stats,
          assemblyOptions
        );
        
        // Save the output
        const outputResult = await robustProcessingSystem.outputManager.saveOutput(
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
          new Notice(`Processing was paused again. Use the checkpoint manager to continue.`);
        }
      }
    } catch (error) {
      console.error('Error resuming processing:', error);
      new Notice(`Error resuming processing: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete a checkpoint from the robust processing system
   * 
   * @param checkpointId ID of the checkpoint to delete
   * @param robustProcessingSystem Reference to the robust processing system
   */
  public async deleteCheckpoint(checkpointId: string, robustProcessingSystem: any): Promise<void> {
    try {
      // Delete the checkpoint
      await robustProcessingSystem.persistenceManager.deleteCheckpoint(checkpointId);
      
      // Show success message
      new Notice(`Successfully deleted checkpoint ${checkpointId}`);
    } catch (error) {
      console.error('Error deleting checkpoint:', error);
      new Notice(`Error deleting checkpoint: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}