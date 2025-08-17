# Refactoring the Chunker

## Current Implementation

Based on the error logs, the current chunking implementation in Vespera Scriptorium seems to have the following issues:

1. Chunks are created without consistent IDs
2. The chunking logic is tightly coupled with other processing steps
3. There's no clear separation of concerns between chunking and metadata assignment

To address these issues, we need to refactor the chunking process to be more modular, maintainable, and robust.

## Proposed Chunker Class

Create a dedicated `Chunker` class to handle all chunking-related operations:

```typescript
/**
 * Chunker class for splitting documents into chunks
 */
export class Chunker {
  private settings: ChunkerSettings;
  
  /**
   * Creates a new Chunker instance
   * @param settings - Chunker settings
   */
  constructor(settings: ChunkerSettings = defaultChunkerSettings) {
    this.settings = settings;
  }
  
  /**
   * Splits a document into chunks
   * @param document - Document content to split
   * @param options - Chunking options to override default settings
   * @returns Array of document chunks
   */
  public chunkDocument(document: string, options?: Partial<ChunkerOptions>): DocumentChunk[] {
    // Apply options over default settings
    const mergedOptions = this.getMergedOptions(options);
    
    // Choose the appropriate splitting strategy
    const strategy = this.getChunkingStrategy(mergedOptions.strategy);
    
    // Split the document using the selected strategy
    const rawChunks = strategy.splitDocument(document, mergedOptions);
    
    // Process the raw chunks to add metadata and IDs
    const processedChunks = this.processChunks(rawChunks, mergedOptions);
    
    // Log chunking results
    this.logChunkingResults(document, processedChunks);
    
    return processedChunks;
  }
  
  /**
   * Gets merged options by applying override options to settings
   * @param options - Override options
   * @returns Merged chunking options
   */
  private getMergedOptions(options?: Partial<ChunkerOptions>): ChunkerOptions {
    return {
      ...this.settings.defaultOptions,
      ...options
    };
  }
  
  /**
   * Gets the appropriate chunking strategy based on the strategy name
   * @param strategyName - Name of the strategy to use
   * @returns Chunking strategy implementation
   */
  private getChunkingStrategy(strategyName: string): ChunkingStrategy {
    switch (strategyName) {
      case 'recursive':
        return new RecursiveChunkingStrategy();
      case 'sentence':
        return new SentenceChunkingStrategy();
      case 'paragraph':
        return new ParagraphChunkingStrategy();
      case 'fixed':
        return new FixedLengthChunkingStrategy();
      case 'langchain':
        return new LangChainChunkingStrategy();
      default:
        // Default to the most reliable strategy
        return new RecursiveChunkingStrategy();
    }
  }
  
  /**
   * Process raw chunks to add metadata and IDs
   * @param rawChunks - Raw chunks from splitting strategy
   * @param options - Chunking options
   * @returns Processed document chunks
   */
  private processChunks(rawChunks: string[], options: ChunkerOptions): DocumentChunk[] {
    return rawChunks.map((content, index) => {
      // Generate a unique ID for the chunk
      const id = this.generateChunkId(content, index);
      
      // Create the chunk object with metadata
      return {
        id,
        content,
        position: index,
        // Add additional metadata
        metadata: {
          chunkIndex: index,
          totalChunks: rawChunks.length,
          chunkLength: content.length,
          strategy: options.strategy,
          timestamp: new Date().toISOString()
        }
      };
    });
  }
  
  /**
   * Generate a unique ID for a chunk
   * @param content - Chunk content
   * @param index - Chunk index
   * @returns Unique chunk ID
   */
  private generateChunkId(content: string, index: number): string {
    const prefix = 'chunk';
    const timestamp = Date.now();
    const contentHash = this.hashContent(content);
    
    return `${prefix}-${timestamp}-${index}-${contentHash}`;
  }
  
  /**
   * Generate a simple hash of the content
   * @param content - Content to hash
   * @returns Content hash
   */
  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).substring(0, 8);
  }
  
  /**
   * Log information about the chunking process
   * @param document - Original document
   * @param chunks - Processed chunks
   */
  private logChunkingResults(document: string, chunks: DocumentChunk[]): void {
    console.info(`Document chunked into ${chunks.length} chunks`);
    console.debug(`Original document length: ${document.length} characters`);
    console.debug(`Average chunk size: ${Math.round(document.length / chunks.length)} characters`);
    
    // Log the first few chunk IDs for debugging
    if (chunks.length > 0) {
      const chunkIdsToShow = Math.min(3, chunks.length);
      console.debug(`First ${chunkIdsToShow} chunk IDs:`, 
        chunks.slice(0, chunkIdsToShow).map(chunk => chunk.id)
      );
    }
  }
}
```

## Chunking Strategies

Create an interface and implementations for different chunking strategies:

```typescript
/**
 * Interface for chunking strategies
 */
interface ChunkingStrategy {
  /**
   * Split a document into chunks
   * @param document - Document to split
   * @param options - Chunking options
   * @returns Array of raw chunks
   */
  splitDocument(document: string, options: ChunkerOptions): string[];
}

/**
 * Recursive text splitting strategy
 */
class RecursiveChunkingStrategy implements ChunkingStrategy {
  splitDocument(document: string, options: ChunkerOptions): string[] {
    // Implementation of recursive text splitting
    // This is a more sophisticated approach that recursively splits
    // text based on different separators (newlines, paragraphs, sentences)
    
    const { chunkSize, chunkOverlap } = options;
    
    // Array of separators from largest to smallest
    const separators = [
      "\n\n\n", // Multiple paragraph breaks
      "\n\n",   // Paragraph breaks
      "\n",     // Line breaks
      ". ",     // Sentences
      ", ",     // Clauses
      " ",      // Words
      ""        // Characters
    ];
    
    return this.recursiveSplit(document, separators, 0, chunkSize, chunkOverlap);
  }
  
  private recursiveSplit(
    text: string, 
    separators: string[], 
    separatorIndex: number, 
    chunkSize: number, 
    chunkOverlap: number
  ): string[] {
    // Base case: if text is short enough, return it as a single chunk
    if (text.length <= chunkSize) {
      return [text];
    }
    
    // If we've tried all separators, use the last one
    if (separatorIndex >= separators.length - 1) {
      return this.splitByCharacters(text, chunkSize, chunkOverlap);
    }
    
    // Try to split by current separator
    const separator = separators[separatorIndex];
    const segments = text.split(separator);
    
    // If splitting produced only one segment, try next separator
    if (segments.length === 1) {
      return this.recursiveSplit(text, separators, separatorIndex + 1, chunkSize, chunkOverlap);
    }
    
    // Process segments
    const chunks: string[] = [];
    let currentChunk = '';
    
    for (const segment of segments) {
      // Skip empty segments
      if (!segment.trim()) continue;
      
      // If adding this segment exceeds chunk size, process current chunk and start a new one
      if (currentChunk && (currentChunk.length + separator.length + segment.length > chunkSize)) {
        // If current chunk is too large, recursively split it
        if (currentChunk.length > chunkSize) {
          chunks.push(...this.recursiveSplit(
            currentChunk, 
            separators, 
            separatorIndex + 1, 
            chunkSize, 
            chunkOverlap
          ));
        } else {
          chunks.push(currentChunk);
        }
        
        // Start a new chunk with overlap
        if (chunkOverlap === 0) {
          currentChunk = segment;
        } else {
          // Create overlap by including the end of the previous chunk
          const overlapStart = Math.max(0, currentChunk.length - chunkOverlap);
          currentChunk = currentChunk.substring(overlapStart) + separator + segment;
          
          // If the overlap itself exceeds chunk size, we need another strategy
          if (currentChunk.length > chunkSize) {
            currentChunk = segment;
          }
        }
      } else {
        // Add separator if this isn't the first segment in the chunk
        if (currentChunk) {
          currentChunk += separator;
        }
        currentChunk += segment;
      }
    }
    
    // Add the last chunk if not empty
    if (currentChunk) {
      // If final chunk is too large, recursively split it
      if (currentChunk.length > chunkSize) {
        chunks.push(...this.recursiveSplit(
          currentChunk, 
          separators, 
          separatorIndex + 1, 
          chunkSize, 
          chunkOverlap
        ));
      } else {
        chunks.push(currentChunk);
      }
    }
    
    return chunks;
  }
  
  private splitByCharacters(text: string, chunkSize: number, chunkOverlap: number): string[] {
    const chunks: string[] = [];
    
    for (let i = 0; i < text.length; i += (chunkSize - chunkOverlap)) {
      // Ensure we don't go past the end of the text
      const end = Math.min(i + chunkSize, text.length);
      chunks.push(text.substring(i, end));
      
      // If we've reached the end, break
      if (end === text.length) break;
    }
    
    return chunks;
  }
}

/**
 * LangChain chunking strategy adapter
 */
class LangChainChunkingStrategy implements ChunkingStrategy {
  splitDocument(document: string, options: ChunkerOptions): string[] {
    // Import LangChain text splitter
    try {
      const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
      
      // Create splitter with options
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: options.chunkSize,
        chunkOverlap: options.chunkOverlap,
      });
      
      // Split the document
      const result = splitter.splitText(document);
      
      return result;
    } catch (error) {
      console.error("Error using LangChain text splitter:", error);
      
      // Fall back to recursive strategy
      const fallback = new RecursiveChunkingStrategy();
      return fallback.splitDocument(document, options);
    }
  }
}

// Implement other strategies (SentenceChunkingStrategy, ParagraphChunkingStrategy, FixedLengthChunkingStrategy)
```

## Types and Interfaces

Define the necessary types and interfaces:

```typescript
/**
 * Settings for the Chunker
 */
export interface ChunkerSettings {
  defaultOptions: ChunkerOptions;
}

/**
 * Default chunker settings
 */
export const defaultChunkerSettings: ChunkerSettings = {
  defaultOptions: {
    chunkSize: 1000,
    chunkOverlap: 200,
    strategy: 'recursive',
    preserveHeaders: true,
    respectCodeBlocks: true,
    minChunkSize: 100
  }
};

/**
 * Options for document chunking
 */
export interface ChunkerOptions {
  chunkSize: number;
  chunkOverlap: number;
  strategy: string;
  preserveHeaders: boolean;
  respectCodeBlocks: boolean;
  minChunkSize: number;
}

/**
 * Represents a chunk of a document
 */
export interface DocumentChunk {
  id: string;
  content: string;
  position: number;
  metadata: ChunkMetadata;
}

/**
 * Metadata for a document chunk
 */
export interface ChunkMetadata {
  chunkIndex: number;
  totalChunks: number;
  chunkLength: number;
  strategy: string;
  timestamp: string;
}
```

## Integration

Update the main plugin file to use the new Chunker class:

```typescript
// In the plugin class
import { Chunker, ChunkerSettings } from './chunker/Chunker';

// Initialize chunker in onload
onload() {
  // Initialize other components...
  
  // Initialize chunker
  this.chunker = new Chunker({
    defaultOptions: {
      chunkSize: this.settings.chunkSize,
      chunkOverlap: this.settings.chunkOverlap,
      strategy: this.settings.chunkingStrategy,
      preserveHeaders: this.settings.preserveHeaders,
      respectCodeBlocks: this.settings.respectCodeBlocks,
      minChunkSize: this.settings.minChunkSize
    }
  });
}

// Update document processing to use the new chunker
async processFile(file: TFile): Promise<void> {
  try {
    // Read the file content
    const content = await this.app.vault.read(file);
    
    // Chunk the document using the new chunker
    const chunks = this.chunker.chunkDocument(content, {
      // Optionally override settings for this file
    });
    
    // Process chunks with LLM
    await this.processChunksWithLLM(chunks, {
      fileName: file.path,
      // Other options...
    });
  } catch (error) {
    console.error(`Error processing file ${file.path}:`, error);
    new Notice(`Error processing file: ${error.message}`);
  }
}
```

## Settings UI

Update the settings tab to include chunking options:

```typescript
// In the settings tab class
display(): void {
  const { containerEl } = this;
  containerEl.empty();
  
  // Add Chunking section
  containerEl.createEl('h2', { text: 'Document Chunking' });
  
  new Setting(containerEl)
    .setName('Chunking Strategy')
    .setDesc('Choose how documents are split into chunks')
    .addDropdown(dropdown => dropdown
      .addOption('recursive', 'Recursive (Most accurate)')
      .addOption('langchain', 'LangChain')
      .addOption('paragraph', 'By Paragraphs')
      .addOption('sentence', 'By Sentences')
      .addOption('fixed', 'Fixed Length')
      .setValue(this.plugin.settings.chunkingStrategy)
      .onChange(async (value) => {
        this.plugin.settings.chunkingStrategy = value;
        await this.plugin.saveSettings();
        
        // Update chunker settings
        this.plugin.chunker = new Chunker({
          defaultOptions: {
            ...this.plugin.chunker.settings.defaultOptions,
            strategy: value
          }
        });
      }));
  
  new Setting(containerEl)
    .setName('Chunk Size')
    .setDesc('Maximum size of each chunk in characters')
    .addSlider(slider => slider
      .setLimits(100, 4000, 100)
      .setValue(this.plugin.settings.chunkSize)
      .setDynamicTooltip()
      .onChange(async (value) => {
        this.plugin.settings.chunkSize = value;
        await this.plugin.saveSettings();
        
        // Update chunker settings
        this.plugin.chunker = new Chunker({
          defaultOptions: {
            ...this.plugin.chunker.settings.defaultOptions,
            chunkSize: value
          }
        });
      }));
  
  new Setting(containerEl)
    .setName('Chunk Overlap')
    .setDesc('Number of characters to overlap between chunks')
    .addSlider(slider => slider
      .setLimits(0, 1000, 50)
      .setValue(this.plugin.settings.chunkOverlap)
      .setDynamicTooltip()
      .onChange(async (value) => {
        this.plugin.settings.chunkOverlap = value;
        await this.plugin.saveSettings();
        
        // Update chunker settings
        this.plugin.chunker = new Chunker({
          defaultOptions: {
            ...this.plugin.chunker.settings.defaultOptions,
            chunkOverlap: value
          }
        });
      }));
  
  new Setting(containerEl)
    .setName('Preserve Headers')
    .setDesc('Keep Markdown headers with their content when chunking')
    .addToggle(toggle => toggle
      .setValue(this.plugin.settings.preserveHeaders)
      .onChange(async (value) => {
        this.plugin.settings.preserveHeaders = value;
        await this.plugin.saveSettings();
        
        // Update chunker settings
        this.plugin.chunker = new Chunker({
          defaultOptions: {
            ...this.plugin.chunker.settings.defaultOptions,
            preserveHeaders: value
          }
        });
      }));
  
  new Setting(containerEl)
    .setName('Respect Code Blocks')
    .setDesc('Keep code blocks intact when chunking')
    .addToggle(toggle => toggle
      .setValue(this.plugin.settings.respectCodeBlocks)
      .onChange(async (value) => {
        this.plugin.settings.respectCodeBlocks = value;
        await this.plugin.saveSettings();
        
        // Update chunker settings
        this.plugin.chunker = new Chunker({
          defaultOptions: {
            ...this.plugin.chunker.settings.defaultOptions,
            respectCodeBlocks: value
          }
        });
      }));
}
```

## Implementation Steps

1. Create a new folder `src/chunker` to house the chunking code
2. Implement the `Chunker` class in `src/chunker/Chunker.ts`
3. Implement different chunking strategies in separate files
4. Define types and interfaces in `src/chunker/types.ts`
5. Update the main plugin file to use the new chunker
6. Update the settings tab to include chunking options
7. Test the chunker with different documents and settings

## Best Practices

1. **Separation of Concerns**: Keep chunking logic separate from other processing
2. **Strategy Pattern**: Use the strategy pattern to support different chunking algorithms
3. **Consistent ID Generation**: Ensure every chunk has a unique, consistent ID
4. **Robust Metadata**: Include comprehensive metadata with each chunk
5. **Configurable Options**: Allow users to configure chunking behavior
6. **Fallback Mechanisms**: Include fallback options when preferred strategies fail
7. **Performance Logging**: Log performance metrics for optimization

## Return to [Chunking Process](./README.md)
