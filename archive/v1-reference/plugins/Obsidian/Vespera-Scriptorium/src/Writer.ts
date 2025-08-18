/**
 * Writer module
 * Responsible for writing summarized content to files in configurable locations.
 * @module Writer
 */

import { App, TFile, normalizePath, Notice } from "obsidian";
import { VesperaScriptoriumSettings } from "./SettingsManager";
import { getLogger, LogLevel } from "./utils";

/**
 * Interface for Writer configuration
 */
export interface WriterConfig {
  app: App;
  settings: VesperaScriptoriumSettings;
}

/**
 * Interface for summary metadata
 */
export interface SummaryMetadata {
  sourceFile: string;
  date: Date;
  model: string;
  prompt: string;
}

/**
 * Interface for summary content
 */
export interface SummaryContent {
  fileName: string;
  content: string;
  metadata: SummaryMetadata;
}

/**
 * Interface for Writer
 */
export interface Writer {
  /**
   * Write a summary to a file
   * @param summary Summary content to write
   * @returns Promise resolving to the path of the created file
   */
  writeSummary(summary: SummaryContent): Promise<string>;
  
  /**
   * Get the path where a summary will be written
   * @param fileName Original file name
   * @returns The path where the summary will be written
   */
  getSummaryPath(fileName: string): string;
}

/**
 * Writer implementation
 */
class WriterImpl implements Writer {
  private app: App;
  private settings: VesperaScriptoriumSettings;
  
  constructor(config: WriterConfig) {
    this.app = config.app;
    this.settings = config.settings;
  }
  
  /**
   * Write a summary to a file
   * @param summary Summary content to write
   * @returns Promise resolving to the path of the created file
   */
  async writeSummary(summary: SummaryContent): Promise<string> {
    // Get the base summary path
    let basePath = this.getSummaryPath(summary.fileName);
    
    // Check if the file exists and find the next available index
    let summaryPath = await this.findNextAvailableFilePath(basePath);
    
    try {
      // We're now using incremental file naming, so no need for overwrite confirmation
      
      // Create the content with frontmatter
      const content = this.formatSummaryContent(summary);
      
      // Ensure the directory exists
      await this.ensureDirectoryExists(summaryPath);
      
      // Create a backup of the existing file if it exists
      if (await this.app.vault.adapter.exists(summaryPath)) {
        const backupPath = `${summaryPath}.backup`;
        try {
          const existingContent = await this.app.vault.adapter.read(summaryPath);
          await this.app.vault.adapter.write(backupPath, existingContent);
          console.log(`Created backup at ${backupPath}`);
        } catch (backupError) {
          console.warn(`Failed to create backup of ${summaryPath}:`, backupError);
          // Continue with the write operation even if backup fails
        }
      }
      
      // Write the file with atomic write pattern
      const tempPath = `${summaryPath}.tmp`;
      
      // First write to a temporary file
      await this.app.vault.adapter.write(tempPath, content);
      
      // Then rename the temporary file to the target file
      if (await this.app.vault.adapter.exists(tempPath)) {
        // If the target file exists, delete it first
        if (await this.app.vault.adapter.exists(summaryPath)) {
          await this.app.vault.adapter.remove(summaryPath);
        }
        
        // Rename the temporary file to the target file
        // Since Obsidian doesn't have a direct rename method, we need to use the filesystem adapter
        try {
          // For Obsidian's adapter, we need to use the createBinary method
          const tempContent = await this.app.vault.adapter.read(tempPath);
          await this.app.vault.createBinary(summaryPath, new TextEncoder().encode(tempContent));
          await this.app.vault.adapter.remove(tempPath);
        } catch (renameError) {
          console.error(`Failed to rename temporary file ${tempPath} to ${summaryPath}:`, renameError);
          throw new Error(`Failed to complete atomic write: ${renameError instanceof Error ? renameError.message : String(renameError)}`);
        }
      } else {
        throw new Error(`Failed to write temporary file ${tempPath}`);
      }
      
      // Log the actual output filename with detailed information
      const logger = getLogger();
      const fileIndexMatch = summaryPath.match(/_(\d+)\.md$/);
      const fileIndex = fileIndexMatch ? fileIndexMatch[1] : '00';
      logger.info(`Summary output file created: ${summaryPath}`, {
        fileName: summary.fileName,
        outputPath: summaryPath,
        index: fileIndex,
        timestamp: new Date().toISOString(),
        size: content.length
      });
      return summaryPath;
    } catch (error) {
      // Log detailed error information
      console.error(`Failed to write summary to ${summaryPath}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
        summaryPath,
        fileName: summary.fileName
      });
      
      // Throw a user-friendly error
      throw new Error(`Failed to write summary: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get the path where a summary will be written
   * @param fileName Original file name
   * @returns The path where the summary will be written
   */
  getSummaryPath(fileName: string): string {
    // Normalize the input path first to ensure consistent handling
    const normalizedFileName = normalizePath(fileName);
    
    // Extract the base name without extension
    const baseName = normalizedFileName.replace(/\.[^/.]+$/, "");
    
    // Format the file name according to settings
    const formattedName = this.settings.writer.fileNameFormat
      .replace('{original}', baseName.split('/').pop() || baseName);
    
    // Determine the output location
    let outputPath: string;
    
    switch (this.settings.writer.outputLocation) {
      case 'original-location':
        // Get the directory of the original file using proper path handling
        const lastSlashIndex = normalizedFileName.lastIndexOf('/');
        
        // Extract directory path properly
        let directory = '';
        if (lastSlashIndex >= 0) {
          directory = normalizedFileName.substring(0, lastSlashIndex + 1);
        }
        
        // Validate that we have a proper directory path
        if (directory && !directory.endsWith('/')) {
          directory += '/';
        }
        
        // If we have a directory, use it; otherwise use the current directory
        outputPath = directory ? `${directory}${formattedName}.md` : `${formattedName}.md`;
        break;
        
      case 'custom-path':
        // Use the custom path from settings
        const customPath = this.settings.writer.customPath || 'Summaries';
        // Ensure the custom path is normalized
        const normalizedCustomPath = normalizePath(customPath);
        outputPath = `${normalizedCustomPath}/${formattedName}.md`;
        break;
        
      case 'summaries-folder':
      default:
        // Use the default Summaries folder
        outputPath = `Summaries/${formattedName}.md`;
        break;
    }
    
    // Get the incremental file path to prevent overwrites
    const incrementalPath = this.getIncrementalFilePath(outputPath);
    
    // Final normalization to handle any path separators
    return normalizePath(incrementalPath);
  }
  
  /**
   * Get an incremental file path to prevent overwrites
   * @param basePath The base path without incremental suffix
   * @returns The incremental file path
   * @private
   */
  /**
   * Get an incremental file path to prevent overwrites
   * This is a synchronous method that prepares a base path for incremental naming
   * @param basePath The base path without incremental suffix
   * @returns The base path (without incremental suffix)
   * @private
   */
  private getIncrementalFilePath(basePath: string): string {
    // Simply return the base path - the actual incremental naming will be handled
    // in findNextAvailableFilePath which is called from writeSummary
    return basePath;
  }
  
  /**
   * Find the next available file path with incremental naming
   * This is an async method that checks for existing files and returns
   * the next available incremental file path
   * @param basePath The base path without incremental suffix
   * @returns Promise resolving to the next available file path
   * @private
   */
  private async findNextAvailableFilePath(basePath: string): Promise<string> {
    // Remove .md extension to work with the base name
    const basePathWithoutExt = basePath.replace(/\.md$/, '');
    
    // Check if the file already exists
    if (!(await this.app.vault.adapter.exists(basePath))) {
      return basePath; // Return the original path if file doesn't exist
    }
    
    // Find the next available index
    let fileIndex = 0;
    let incrementalPath = '';
    
    do {
      // Format the index with leading zeros (e.g., 00, 01, 02)
      const formattedIndex = fileIndex.toString().padStart(2, '0');
      incrementalPath = `${basePathWithoutExt}_${formattedIndex}.md`;
      fileIndex++;
    } while (await this.app.vault.adapter.exists(incrementalPath));
    
    // Log the incremental file path with index information
    const logger = getLogger();
    const indexMatch = incrementalPath.match(/_(\d+)\.md$/);
    const extractedIndex = indexMatch ? indexMatch[1] : '00';
    logger.debug(`Using incremental file path for summary output: ${incrementalPath}`, {
      basePath,
      incrementalPath,
      index: extractedIndex,
      timestamp: new Date().toISOString()
    });
    return incrementalPath;
  }
  
  /**
   * Format the summary content with frontmatter
   * @param summary Summary content to format
   * @returns Formatted content with frontmatter
   */
  private formatSummaryContent(summary: SummaryContent): string {
    // Start with frontmatter
    let content = '---\n';
    
    // Add metadata if enabled
    if (this.settings.writer.includeMetadata) {
      content += `source: "${summary.metadata.sourceFile}"\n`;
      
      if (this.settings.writer.metadataOptions.includeDate) {
        content += `date: ${summary.metadata.date.toISOString()}\n`;
      }
      
      if (this.settings.writer.metadataOptions.includeModel) {
        content += `model: "${summary.metadata.model}"\n`;
      }
      
      if (this.settings.writer.metadataOptions.includePrompt) {
        // Escape any quotes in the prompt
        const escapedPrompt = summary.metadata.prompt.replace(/"/g, '\\"');
        content += `prompt: "${escapedPrompt}"\n`;
      }
      
      // Add tags for Dataview compatibility
      content += 'tags: [vespera-summary]\n';
    }
    
    // Close frontmatter
    content += '---\n\n';
    
    // Add heading with original file name
    content += `# Summary of ${summary.fileName}\n\n`;
    
    // Add the summary content
    content += summary.content;
    
    return content;
  }
  
  /**
   * Ensure the directory for a file exists
   * @param filePath Path to the file
   */
  private async ensureDirectoryExists(filePath: string): Promise<void> {
    // Normalize the path first to ensure consistent handling
    const normalizedPath = normalizePath(filePath);
    const lastSlashIndex = normalizedPath.lastIndexOf('/');
    
    if (lastSlashIndex <= 0) {
      // No directory part or root directory
      return;
    }
    
    const directory = normalizedPath.substring(0, lastSlashIndex);
    
    // Check if directory exists
    if (!(await this.app.vault.adapter.exists(directory))) {
      try {
        // Create the directory recursively
        await this.app.vault.createFolder(directory);
        
        // Verify the directory was created
        if (!(await this.app.vault.adapter.exists(directory))) {
          throw new Error(`Directory ${directory} was not created successfully`);
        }
        
        const logger = getLogger();
        logger.debug(`Created directory for summary output: ${directory}`);
      } catch (error) {
        // Log detailed error information
        console.error(`Failed to create directory ${directory}:`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString(),
          directory
        });
        
        throw new Error(`Failed to create directory: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  
  /**
   * Recover from a failed write operation
   * @param originalPath Original file path
   * @param backupPath Backup file path
   * @returns Promise resolving to true if recovery was successful
   */
  private async recoverFromFailedWrite(originalPath: string, backupPath: string): Promise<boolean> {
    try {
      // Check if backup exists
      if (await this.app.vault.adapter.exists(backupPath)) {
        // Read backup content
        const backupContent = await this.app.vault.adapter.read(backupPath);
        
        // Write backup content to original file
        await this.app.vault.adapter.write(originalPath, backupContent);
        
        // Remove backup file
        await this.app.vault.adapter.remove(backupPath);
        
        const logger = getLogger();
        logger.info(`Successfully recovered summary file from backup: ${originalPath}`, {
          originalPath,
          backupPath,
          timestamp: new Date().toISOString()
        });
        return true;
      }
    } catch (error) {
      console.error(`Failed to recover from failed write:`, {
        error: error instanceof Error ? error.message : String(error),
        originalPath,
        backupPath,
        timestamp: new Date().toISOString()
      });
    }
    
    return false;
  }
}

/**
 * Create a Writer instance
 * @param config Writer configuration
 * @returns Writer instance
 */
export function createWriter(config: WriterConfig): Writer {
  return new WriterImpl(config);
}
