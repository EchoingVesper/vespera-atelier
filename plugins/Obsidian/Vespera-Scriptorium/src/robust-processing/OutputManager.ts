/**
 * Output Manager
 * Handles flexible output options and format conversions.
 * @module OutputManager
 */

import { App, normalizePath } from "obsidian";
import { AssembledDocument } from "./DocumentAssembler";
import * as path from 'path';

/**
 * Output format
 */
export enum OutputFormat {
  MARKDOWN = 'markdown',
  HTML = 'html',
  TEXT = 'text',
  JSON = 'json'
}

/**
 * Output options
 */
export interface OutputOptions {
  /**
   * Output format
   * @default OutputFormat.MARKDOWN
   */
  format: OutputFormat;
  
  /**
   * Whether to consolidate output into a single file
   * @default true
   */
  consolidate: boolean;
  
  /**
   * Whether to include metadata
   * @default true
   */
  includeMetadata: boolean;
  
  /**
   * Whether to include processing statistics
   * @default true
   */
  includeProcessingStats: boolean;
  
  /**
   * Target location for output files
   * @default 'output'
   */
  targetLocation: string;
  
  /**
   * Template for file naming
   * @default '{documentName}-processed'
   */
  filenameTemplate: string;
  
  /**
   * Whether to create a table of contents
   * @default true
   */
  createTableOfContents: boolean;
  
  /**
   * Whether to include original document references
   * @default true
   */
  includeReferences: boolean;
}

/**
 * Default output options
 */
export const DEFAULT_OUTPUT_OPTIONS: OutputOptions = {
  format: OutputFormat.MARKDOWN,
  consolidate: true,
  includeMetadata: true,
  includeProcessingStats: true,
  targetLocation: 'output',
  filenameTemplate: '{documentName}-processed',
  createTableOfContents: true,
  includeReferences: true
};

/**
 * Output history entry
 */
export interface OutputHistory {
  /**
   * Document ID
   */
  documentId: string;
  
  /**
   * Output options used
   */
  options: OutputOptions;
  
  /**
   * Timestamp
   */
  timestamp: Date;
}

/**
 * Output result
 */
export interface OutputResult {
  /**
   * Path to the output file(s)
   */
  outputPaths: string[];
  
  /**
   * Format used
   */
  format: OutputFormat;
  
  /**
   * Whether output was consolidated
   */
  consolidated: boolean;
  
  /**
   * Timestamp
   */
  timestamp: Date;
}

/**
 * Document section
 */
export interface DocumentSection {
  /**
   * Section title
   */
  title: string;
  
  /**
   * Section content
   */
  content: string;
}

/**
 * Format templates
 */
export interface FormatTemplates {
  /**
   * Header template
   */
  header: (doc: AssembledDocument) => string;
  
  /**
   * Section start template
   */
  sectionStart: (section: DocumentSection) => string;
  
  /**
   * Section end template
   */
  sectionEnd: (section: DocumentSection) => string;
  
  /**
   * Footer template
   */
  footer: (doc: AssembledDocument) => string;
}

/**
 * Output Manager class
 * Responsible for handling output options and format conversions
 */
export class OutputManager {
  private app: App;
  private outputHistory: OutputHistory[] = [];
  private formatTemplates: Record<OutputFormat, FormatTemplates>;

  /**
   * Saves content to a specified file path.
   * @param filePath The absolute path where the file should be saved.
   * @param content The content to write to the file.
   * @param format Optional. The format of the content (e.g., markdown, html). Currently not used for direct saving but can be for future enhancements.
   */
  public async saveFile(filePath: string, content: string, format?: OutputFormat): Promise<void> {
    try {
      const normalizedFilePath = normalizePath(filePath);
      // Ensure parent directory exists (though OutputNode already does this, it's good practice here too)
      const parentDir = path.dirname(normalizedFilePath);
      if (!(await this.app.vault.adapter.exists(parentDir))) {
        await this.app.vault.adapter.mkdir(parentDir);
        console.info(`[OutputManager] Created directory: ${parentDir}`);
      }

      await this.app.vault.adapter.write(normalizedFilePath, content);
      console.info(`[OutputManager] Successfully saved file to ${normalizedFilePath}`);
      // Optionally, add to output history or perform other actions based on format
    } catch (error: any) {
      console.error(`[OutputManager] Error saving file to ${filePath}:`, error.message, error.stack);
      throw error; // Re-throw the error to be handled by the caller
    }
  }
  
  /**
   * Create a new OutputManager instance
   * 
   * @param app Obsidian App instance
   */
  constructor(app: App) {
    this.app = app;
    
    // Initialize format templates
    this.formatTemplates = {
      [OutputFormat.MARKDOWN]: {
        header: (doc) => `---
title: ${doc.metadata.documentName}
source: ${doc.metadata.sourcePath}
date: ${doc.metadata.createdAt.toISOString()}
---

# ${doc.metadata.documentName}

`,
        sectionStart: (section) => `## ${section.title}\n\n`,
        sectionEnd: (section) => '\n\n',
        footer: (doc) => `\n\n*Processed with Vespera Scriptorium*`
      },
      [OutputFormat.HTML]: {
        header: (doc) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${doc.metadata.documentName}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; }
    h2 { color: #444; margin-top: 30px; }
    .metadata { background: #f5f5f5; padding: 10px; border-radius: 5px; margin-bottom: 20px; }
    .stats { background: #f0f0f0; padding: 10px; border-radius: 5px; margin-top: 30px; }
  </style>
</head>
<body>
  <h1>${doc.metadata.documentName}</h1>
  ${doc.metadata ? `<div class="metadata">
    <p><strong>Source:</strong> ${doc.metadata.sourcePath}</p>
    <p><strong>Date:</strong> ${doc.metadata.createdAt.toISOString()}</p>
  </div>` : ''}
`,
        sectionStart: (section) => `<h2>${section.title}</h2>\n<div class="section">`,
        sectionEnd: (section) => '</div>\n',
        footer: (doc) => `${doc.processingStats ? `<div class="stats">
    <p><strong>Processing Time:</strong> ${doc.processingStats.totalProcessingTime}ms</p>
    <p><strong>Chunks Processed:</strong> ${doc.processingStats.chunksProcessed}</p>
    <p><strong>Tokens Processed:</strong> ${doc.processingStats.tokensProcessed}</p>
  </div>` : ''}
  <footer>
    <p><em>Processed with Vespera Scriptorium</em></p>
  </footer>
</body>
</html>`
      },
      [OutputFormat.TEXT]: {
        header: (doc) => `${doc.metadata.documentName.toUpperCase()}\n${'='.repeat(doc.metadata.documentName.length)}\n\nSource: ${doc.metadata.sourcePath}\nDate: ${doc.metadata.createdAt.toISOString()}\n\n`,
        sectionStart: (section) => `${section.title.toUpperCase()}\n${'-'.repeat(section.title.length)}\n\n`,
        sectionEnd: (section) => '\n\n',
        footer: (doc) => `\n\nProcessed with Vespera Scriptorium`
      },
      [OutputFormat.JSON]: {
        header: (doc) => `{
  "document": {
    "title": "${doc.metadata.documentName}",
    "metadata": ${JSON.stringify(doc.metadata, null, 2)},
`,
        sectionStart: (section) => `  "${section.title}": `,
        sectionEnd: (section) => ',\n',
        footer: (doc) => `  "processingStats": ${JSON.stringify(doc.processingStats, null, 2)}
}}`
      }
    };
  }
  
  /**
   * Save output
   * 
   * @param document Assembled document
   * @param options Output options
   * @returns Promise resolving to output result
   */
  public async saveOutput(
    document: AssembledDocument,
    options: Partial<OutputOptions> = {}
  ): Promise<OutputResult> {
    // Merge options with defaults
    const mergedOptions = { ...DEFAULT_OUTPUT_OPTIONS, ...options };
    
    // Create output
    let outputPaths: string[] = [];
    
    if (mergedOptions.consolidate) {
      // Create consolidated output
      const outputContent = this.createConsolidatedOutput(document, mergedOptions);
      const outputPath = this.getOutputPath(document, mergedOptions);
      
      // Ensure the directory exists
      await this.ensureDirectoryExists(path.dirname(outputPath));
      
      // Write the file
      await this.app.vault.adapter.write(outputPath, outputContent);
      
      outputPaths.push(outputPath);
    } else {
      // Create segmented output
      const segmentedOutput = this.createSegmentedOutput(document, mergedOptions);
      
      // Write each segment
      for (const [segmentName, content] of Object.entries(segmentedOutput)) {
        const outputPath = this.getSegmentOutputPath(document, segmentName, mergedOptions);
        
        // Ensure the directory exists
        await this.ensureDirectoryExists(path.dirname(outputPath));
        
        // Write the file
        await this.app.vault.adapter.write(outputPath, content);
        
        outputPaths.push(outputPath);
      }
    }
    
    // Add to output history
    this.outputHistory.push({
      documentId: document.id,
      options: mergedOptions,
      timestamp: new Date()
    });
    
    // Return output result
    return {
      outputPaths,
      format: mergedOptions.format,
      consolidated: mergedOptions.consolidate,
      timestamp: new Date()
    };
  }
  
  /**
   * Create consolidated output
   * 
   * @param document Assembled document
   * @param options Output options
   * @returns Consolidated output content
   */
  public createConsolidatedOutput(
    document: AssembledDocument,
    options: OutputOptions
  ): string {
    const templates = this.formatTemplates[options.format];
    
    // Start with header
    let content = templates.header(document);
    
    // Add table of contents if enabled
    if (options.createTableOfContents) {
      content += this.createTableOfContents(document, options);
    }
    
    // Add document content
    content += document.content;
    
    // Add footer
    content += templates.footer(document);
    
    return content;
  }
  
  /**
   * Create segmented output
   * 
   * @param document Assembled document
   * @param options Output options
   * @returns Map of segment name to content
   */
  public createSegmentedOutput(
    document: AssembledDocument,
    options: OutputOptions
  ): Record<string, string> {
    const templates = this.formatTemplates[options.format];
    const segments: Record<string, string> = {};
    
    // Split content into sections
    const sections = this.splitIntoSections(document.content);
    
    // Create main file with metadata and table of contents
    let mainContent = templates.header(document);
    
    // Add table of contents if enabled
    if (options.createTableOfContents) {
      mainContent += this.createTableOfContents(document, options);
    }
    
    // Add references to sections
    for (const section of sections) {
      mainContent += `## ${section.title}\n\n`;
      mainContent += `See [${section.title}](${this.getSegmentFileName(document, section.title, options)})\n\n`;
    }
    
    // Add footer
    mainContent += templates.footer(document);
    
    // Add main file to segments
    segments['main'] = mainContent;
    
    // Create a file for each section
    for (const section of sections) {
      let sectionContent = templates.header(document);
      sectionContent += templates.sectionStart(section);
      sectionContent += section.content;
      sectionContent += templates.sectionEnd(section);
      
      // Add reference back to main file
      sectionContent += `\n\n[Back to main document](${this.getSegmentFileName(document, 'main', options)})\n\n`;
      
      // Add footer
      sectionContent += templates.footer(document);
      
      // Add section to segments
      segments[section.title] = sectionContent;
    }
    
    return segments;
  }
  
  /**
   * Infer user preferences from output history
   * 
   * @param history Output history
   * @returns Inferred output options
   */
  public inferUserPreferences(history: OutputHistory[] = this.outputHistory): OutputOptions {
    if (history.length === 0) {
      return DEFAULT_OUTPUT_OPTIONS;
    }
    
    // Count frequency of different options
    const formatCounts: Record<OutputFormat, number> = {
      [OutputFormat.MARKDOWN]: 0,
      [OutputFormat.HTML]: 0,
      [OutputFormat.TEXT]: 0,
      [OutputFormat.JSON]: 0
    };
    
    const consolidateCounts: Record<string, number> = { 'true': 0, 'false': 0 };
    const includeMetadataCounts: Record<string, number> = { 'true': 0, 'false': 0 };
    const includeProcessingStatsCounts: Record<string, number> = { 'true': 0, 'false': 0 };
    const createTableOfContentsCounts: Record<string, number> = { 'true': 0, 'false': 0 };
    const includeReferencesCounts: Record<string, number> = { 'true': 0, 'false': 0 };
    
    const targetLocationCounts: Record<string, number> = {};
    const filenameTemplateCounts: Record<string, number> = {};
    
    // Count occurrences of each option
    for (const entry of history) {
      formatCounts[entry.options.format]++;
      consolidateCounts[String(entry.options.consolidate)]++;
      includeMetadataCounts[String(entry.options.includeMetadata)]++;
      includeProcessingStatsCounts[String(entry.options.includeProcessingStats)]++;
      createTableOfContentsCounts[String(entry.options.createTableOfContents)]++;
      includeReferencesCounts[String(entry.options.includeReferences)]++;
      
      targetLocationCounts[entry.options.targetLocation] = (targetLocationCounts[entry.options.targetLocation] || 0) + 1;
      filenameTemplateCounts[entry.options.filenameTemplate] = (filenameTemplateCounts[entry.options.filenameTemplate] || 0) + 1;
    }
    
    // Find the most frequent options
    const format = this.getMostFrequent(formatCounts);
    const consolidate = this.getMostFrequent(consolidateCounts) === 'true';
    const includeMetadata = this.getMostFrequent(includeMetadataCounts) === 'true';
    const includeProcessingStats = this.getMostFrequent(includeProcessingStatsCounts) === 'true';
    const createTableOfContents = this.getMostFrequent(createTableOfContentsCounts) === 'true';
    const includeReferences = this.getMostFrequent(includeReferencesCounts) === 'true';
    
    const targetLocation = this.getMostFrequent(targetLocationCounts) || DEFAULT_OUTPUT_OPTIONS.targetLocation;
    const filenameTemplate = this.getMostFrequent(filenameTemplateCounts) || DEFAULT_OUTPUT_OPTIONS.filenameTemplate;
    
    return {
      format,
      consolidate,
      includeMetadata,
      includeProcessingStats,
      targetLocation,
      filenameTemplate,
      createTableOfContents,
      includeReferences
    };
  }
  
  /**
   * Get the most frequent value in a record
   * 
   * @param counts Record of counts
   * @returns Most frequent value
   */
  private getMostFrequent<T extends string | number | symbol>(counts: Record<T, number>): T {
    let maxCount = 0;
    let maxValue: T | null = null;
    
    for (const [value, count] of Object.entries(counts) as [T, number][]) {
      if (count > maxCount) {
        maxCount = count;
        maxValue = value;
      }
    }
    
    return maxValue as T;
  }
  
  /**
   * Split content into sections
   * 
   * @param content Document content
   * @returns Array of sections
   */
  private splitIntoSections(content: string): DocumentSection[] {
    // Split by level 2 headings (##)
    const sections: DocumentSection[] = [];
    const lines = content.split('\n');
    
    let currentSection: DocumentSection | null = null;
    
    for (const line of lines) {
      // Check if line is a level 2 heading
      const headingMatch = line.match(/^##\s+(.+)$/);
      
      if (headingMatch) {
        // Save previous section if exists
        if (currentSection) {
          sections.push(currentSection);
        }
        
        // Start new section
        currentSection = {
          title: headingMatch[1],
          content: ''
        };
      } else if (currentSection) {
        // Add line to current section
        currentSection.content += line + '\n';
      }
    }
    
    // Add the last section
    if (currentSection) {
      sections.push(currentSection);
    }
    
    // If no sections were found, create a default one
    if (sections.length === 0) {
      sections.push({
        title: 'Content',
        content
      });
    }
    
    return sections;
  }
  
  /**
   * Create table of contents
   * 
   * @param document Assembled document
   * @param options Output options
   * @returns Table of contents content
   */
  private createTableOfContents(document: AssembledDocument, options: OutputOptions): string {
    // Extract headings from content
    const headings = this.extractHeadings(document.content);
    
    if (headings.length === 0) {
      return '';
    }
    
    let toc = '';
    
    switch (options.format) {
      case OutputFormat.MARKDOWN:
        toc = '## Table of Contents\n\n';
        
        for (const heading of headings) {
          const indent = '  '.repeat(heading.level - 1);
          toc += `${indent}- [${heading.text}](#${this.slugify(heading.text)})\n`;
        }
        
        toc += '\n';
        break;
        
      case OutputFormat.HTML:
        toc = '<h2>Table of Contents</h2>\n<nav class="toc">\n<ul>\n';
        
        for (const heading of headings) {
          const indent = '  '.repeat(heading.level);
          toc += `${indent}<li><a href="#${this.slugify(heading.text)}">${heading.text}</a></li>\n`;
        }
        
        toc += '</ul>\n</nav>\n\n';
        break;
        
      case OutputFormat.TEXT:
        toc = 'TABLE OF CONTENTS\n----------------\n\n';
        
        for (const heading of headings) {
          const indent = '  '.repeat(heading.level - 1);
          toc += `${indent}* ${heading.text}\n`;
        }
        
        toc += '\n';
        break;
        
      case OutputFormat.JSON:
        // For JSON, we'll include the TOC in the document structure
        break;
    }
    
    return toc;
  }
  
  /**
   * Extract headings from content
   * 
   * @param content Document content
   * @returns Array of headings
   */
  private extractHeadings(content: string): Array<{ level: number, text: string }> {
    const headings: Array<{ level: number, text: string }> = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      // Match heading lines (# Heading)
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      
      if (match) {
        headings.push({
          level: match[1].length,
          text: match[2]
        });
      }
    }
    
    return headings;
  }
  
  /**
   * Convert a string to a slug
   * 
   * @param text Text to slugify
   * @returns Slugified text
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove non-word chars
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }
  
  /**
   * Get output path for a document
   * 
   * @param document Assembled document
   * @param options Output options
   * @returns Output path
   */
  private getOutputPath(document: AssembledDocument, options: OutputOptions): string {
    // Get file extension based on format
    const extension = this.getFileExtension(options.format);
    
    // Replace placeholders in filename template
    const fileName = options.filenameTemplate
      .replace('{documentName}', document.metadata.documentName)
      .replace('{date}', new Date().toISOString().split('T')[0]);
    
    // Combine with target location
    return normalizePath(`${options.targetLocation}/${fileName}.${extension}`);
  }
  
  /**
   * Get output path for a segment
   * 
   * @param document Assembled document
   * @param segmentName Segment name
   * @param options Output options
   * @returns Output path
   */
  private getSegmentOutputPath(
    document: AssembledDocument,
    segmentName: string,
    options: OutputOptions
  ): string {
    // Get file extension based on format
    const extension = this.getFileExtension(options.format);
    
    // Replace placeholders in filename template
    const baseFileName = options.filenameTemplate
      .replace('{documentName}', document.metadata.documentName)
      .replace('{date}', new Date().toISOString().split('T')[0]);
    
    // Add segment name
    const fileName = segmentName === 'main'
      ? baseFileName
      : `${baseFileName}-${this.slugify(segmentName)}`;
    
    // Combine with target location
    return normalizePath(`${options.targetLocation}/${fileName}.${extension}`);
  }
  
  /**
   * Get segment file name
   * 
   * @param document Assembled document
   * @param segmentName Segment name
   * @param options Output options
   * @returns Segment file name
   */
  private getSegmentFileName(
    document: AssembledDocument,
    segmentName: string,
    options: OutputOptions
  ): string {
    // Get file extension based on format
    const extension = this.getFileExtension(options.format);
    
    // Replace placeholders in filename template
    const baseFileName = options.filenameTemplate
      .replace('{documentName}', document.metadata.documentName)
      .replace('{date}', new Date().toISOString().split('T')[0]);
    
    // Add segment name
    const fileName = segmentName === 'main'
      ? baseFileName
      : `${baseFileName}-${this.slugify(segmentName)}`;
    
    return `${fileName}.${extension}`;
  }
  
  /**
   * Get file extension for a format
   * 
   * @param format Output format
   * @returns File extension
   */
  private getFileExtension(format: OutputFormat): string {
    switch (format) {
      case OutputFormat.MARKDOWN:
        return 'md';
      case OutputFormat.HTML:
        return 'html';
      case OutputFormat.TEXT:
        return 'txt';
      case OutputFormat.JSON:
        return 'json';
      default:
        return 'md';
    }
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
}

/**
 * Create an output manager instance
 * 
 * @param app Obsidian App instance
 * @returns Output manager instance
 */
export function createOutputManager(app: App): OutputManager {
  return new OutputManager(app);
}