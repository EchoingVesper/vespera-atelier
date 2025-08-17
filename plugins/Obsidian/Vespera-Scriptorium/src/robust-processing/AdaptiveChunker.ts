/**
 * Adaptive Chunker
 * Splits text into manageable chunks with dynamic sizing and content-aware boundaries.
 * @module AdaptiveChunker
 */

import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { v4 as uuidv4 } from 'uuid';

/**
 * Interface for adaptive chunking options
 */
export interface AdaptiveChunkingOptions {
  /**
   * The detected context window size of the model
   * @default 4096
   */
  contextWindow: number;
  
  /**
   * Safety margin percentage to stay below context window
   * @default 15
   */
  safetyMarginPercent: number;
  
  /**
   * Minimum chunk size in tokens
   * @default 极客时间
   */
  minChunkSize: number;
  
  /**
   * Maximum chunk size in tokens
   * @default 8192
   */
  maxChunkSize: number;
  
  /**
   * Estimated token overhead for prompts and system messages
   * @default 500
   */
  promptOverhead: number;
  
  /**
   * Whether to use content-aware chunking
   * @default true
   */
  contentAwareChunking: boolean;
  
  /**
   * Whether to preserve paragraphs (don't split within paragraphs)
   * @default true
   */
  preserveParagraphs: boolean;
  
  /**
   * Whether to preserve sentences (don't split within sentences)
   * @default true
   */
  preserveSentences: boolean;
  
  /**
   * The separators to use for splitting text
   * Default separators prioritize splitting at paragraph breaks, then sentences, etc.
   */
  separators?: string[];
  
  /**
   * The amount of overlap between chunks, calculated automatically if not provided
   */
  chunkOverlap?: number;
  
  /**
   * Whether to include metadata with each chunk
   * @default true
   */
  includeMetadata: boolean;
  
  /**
   * The amount of context to include before and after each chunk
   * @default 100
   */
  contextSize: number;

  /**
   * Whether to use deterministic IDs for testing/reproducibility
   * @default false
   */
  deterministicIds?: boolean;
}

/**
 * Default adaptive chunking options
 */
export const DEFAULT_ADAPTIVE_CHUNKING_OPTIONS: AdaptiveChunkingOptions = {
  contextWindow: 4096,
  safetyMarginPercent: 15,
  minChunkSize: 100,
  maxChunkSize: 8192,
  promptOverhead: 500,
  contentAwareChunking: true,
  preserveParagraphs: true,
  preserveSentences: true,
  includeMetadata: true,
  contextSize: 100,
  separators: [
    "\n\n", // Paragraphs
    "\n",   // Line breaks
    ". ",   // Sentences
    "! ",   // Exclamations
    "? ",   // Questions
    ";",    // Semicolons
    ":",    // Colons
    ",",    // Commas
    " ",    // Words
    ""      // Characters
  ]
};

/**
 * Interface for chunk metadata
 */
export interface ChunkMetadata {
  /**
   * Unique identifier for the chunk
   */
  id: string;

  /**
   * Deterministic identifier for testing/reproducibility
   */
  deterministicId?: string;

  /**
   * The chunk number in the sequence of chunks from a single document.
   */
  chunkNumber: number;
  
  /**
   * Index of the chunk in the sequence
   */
  index: number;
  
  /**
   * Total number of chunks
   */
  totalChunks: number;
  
  /**
   * Source document name or identifier
   */
  sourceDocument: string;
  
  /**
   * Start position in the original text
   */
  startPosition: number;
  
  /**
   * End position in the original text
   */
  endPosition: number;
  
  /**
   * Preceding context (text before this chunk)
   */
  precedingContext?: string;
  
  /**
   * Following context (text after this chunk)
   */
  followingContext?: string;
  
  /**
   * Estimated token count
   */
  estimatedTokens: number;
  
  /**
   * Chunk creation timestamp
   */
  timestamp: number;

  /**
   * Optional field for any custom metadata.
   */
  custom?: Record<string, any>;
}

/**
 * Interface for a document chunk
 */
export interface DocumentChunk {
  /**
   * Unique identifier for the chunk
   */
  id: string;
  
  /**
   * The chunk content
   */
  content: string;
  
  /**
   * Chunk metadata
   */
  metadata: ChunkMetadata;
}

/**
 * Adaptive Chunker class
 * Responsible for splitting text into chunks with dynamic sizing and content-aware boundaries
 */
export class AdaptiveChunker {
  private options: AdaptiveChunkingOptions;
  
  /**
   * Create a new AdaptiveChunker instance
   * 
   * @param options Chunking options
   */
  constructor(options: Partial<AdaptiveChunkingOptions> = {}) {
    this.options = { ...DEFAULT_ADAPTIVE_CHUNKING_OPTIONS, ...options };
  }
  
  /**
   * Split a document into chunks
   * 
   * @param content Document content
   * @param documentName Source document name
   * @param options Chunking options (overrides instance options)
   * @returns Promise resolving to an array of document chunks
   */
  public async chunkText(
    text: string, // Changed from content
    documentId: string, // Added documentId parameter
    sourceName: string, // Changed from documentName
    options: Partial<AdaptiveChunkingOptions> = {}
  ): Promise<DocumentChunk[]> {
    // Merge options
    const mergedOptions = { ...this.options, ...options };
    
    // Calculate optimal chunk size based on context window
    const optimalChunkSize = this.calculateOptimalChunkSize(
      mergedOptions.contextWindow,
      mergedOptions.safetyMarginPercent,
      mergedOptions.promptOverhead
    );
    
    // Calculate optimal overlap
    const optimalOverlap = mergedOptions.chunkOverlap || 
      this.calculateOptimalOverlap(optimalChunkSize);
    
    console.log(`Chunking text from ${sourceName} (ID: ${documentId}) with optimal chunk size: ${optimalChunkSize}, overlap: ${optimalOverlap}`);
    
    // Create text splitter with specified options
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: optimalChunkSize * 4, // Convert tokens to approximate characters (4 chars per token)
      chunkOverlap: optimalOverlap * 4, // Convert tokens to approximate characters
      separators: mergedOptions.separators
    });
    
    // Split the text into chunks
    const rawChunks = await splitter.splitText(text); // Changed from content

    // Filter out any undefined or null values from rawChunks
    const filteredChunks = rawChunks.filter(chunk => chunk !== undefined && chunk !== null);
    
    // Convert filtered chunks to DocumentChunk objects with metadata
    const documentChunks: DocumentChunk[] = [];
    
    for (let i = 0; i < filteredChunks.length; i++) {
      const rawChunk = filteredChunks[i];
      
      // Find the position of this chunk in the original text
      const startPosition = text.indexOf(rawChunk); // Changed from content
      
      // If the chunk can't be found (shouldn't happen), use an approximation
      const calculatedStartPosition = startPosition >= 0 ? startPosition : 
        i > 0 ? documentChunks[i-1].metadata.endPosition : 0;
      
      const endPosition = calculatedStartPosition + rawChunk.length;
      
      // Extract context before and after the chunk
      const precedingContext = mergedOptions.includeMetadata ? 
        this.extractPrecedingContext(text, calculatedStartPosition, mergedOptions.contextSize) : undefined; // Changed from content
      
      const followingContext = mergedOptions.includeMetadata ? 
        this.extractFollowingContext(text, endPosition, mergedOptions.contextSize) : undefined; // Changed from content
      
      // Create chunk metadata
      const metadata: ChunkMetadata = {
        id: this.generateDefaultChunkId(),
        index: i,
        totalChunks: rawChunks.length,
        sourceDocument: sourceName, // Changed from documentName
        startPosition: calculatedStartPosition,
        endPosition,
        precedingContext,
        followingContext,
        estimatedTokens: Math.ceil(rawChunk.length / 4), // Rough estimation
        timestamp: Date.now(),
        chunkNumber: 0
      };
      
      // Create document chunk
      const documentChunk: DocumentChunk = {
        id: metadata.id, // Use the generated ID from metadata
        content: rawChunk,
        metadata
      };
      
      documentChunks.push(documentChunk);
    }
    
    return documentChunks;
  }
  
  /**
   * Generates a default unique ID for a chunk.
   * @returns A unique string ID.
   */
  private generateDefaultChunkId(): string {
    return uuidv4();
  }
  
  /**
   * Calculate the optimal chunk size based on context window
   * 
   * @param contextWindow Context window size
   * @param safetyMarginPercent Safety margin percentage
   * @param promptOverhead Prompt overhead in tokens
   * @returns Optimal chunk size in tokens
   */
  public calculateOptimalChunkSize(
    contextWindow: number,
    safetyMarginPercent: number,
    promptOverhead: number
  ): number {
    // Calculate safety margin
    const safetyMargin = Math.ceil(contextWindow * (safetyMarginPercent / 100));
    
    // Calculate maximum safe chunk size
    const maxSafeChunkSize = contextWindow - safetyMargin - promptOverhead;
    
    // Ensure the chunk size is within bounds
    return Math.max(
      this.options.minChunkSize,
      Math.min(maxSafeChunkSize, this.options.maxChunkSize)
    );
  }
  
  /**
   * Calculate the optimal overlap based on chunk size
   * 
   * @param chunkSize Chunk size in tokens
   * @returns Optimal overlap in tokens
   */
  public calculateOptimalOverlap(chunkSize: number): number {
    // For small chunks, use 10% overlap
    if (chunkSize <= 1000) {
      return Math.ceil(chunkSize * 0.1);
    }
    
    // For medium chunks, use 8% overlap
    if (chunkSize <= 4000) {
      return Math.ceil(chunkSize * 0.08);
    }
    
    // For large chunks, use 5% overlap
    return Math.ceil(chunkSize * 0.05);
  }
  
  /**
   * Extract preceding context from the original text
   * 
   * @param content Original text
   * @param position Position in the text
   * @param contextSize Context size in characters
   * @returns Preceding context
   */
  private extractPrecedingContext(content: string, position: number, contextSize: number): string {
    if (position <= 0) {
      return '';
    }
    
    const startPos = Math.max(0, position - contextSize * 4); // 4 chars per token
    return content.substring(startPos, position);
  }
  
  /**
   * Extract following context from the original text
   * 
   * @param content Original text
   * @param position Position in the text
   * @param contextSize Context size in characters
   * @returns Following context
   */
  private extractFollowingContext(content: string, position: number, contextSize: number): string {
    if (position >= content.length) {
      return '';
    }
    
    const endPos = Math.min(content.length, position + contextSize * 4); // 4 chars per token
    return content.substring(position, endPos);
  }
  
  /**
   * Find content-aware boundaries in text
   * 
   * @param text Text to analyze
   * @param approxSize Approximate desired chunk size
   * @returns Array of boundary positions
   */
  private findContentAwareBoundaries(text: string, approxSize: number): number[] {
    const boundaries: number[] = [];
    let currentPos = 0;
    
    while (currentPos < text.length) {
      const targetPos = currentPos + approxSize;
      
      if (targetPos >= text.length) {
        boundaries.push(text.length);
        break;
      }
      
      // Look for paragraph breaks near the target position
      const paragraphBreakPos = this.findNearestMatch(text, targetPos, '\n\n', 0.2);
      if (paragraphBreakPos > currentPos) {
        boundaries.push(paragraphBreakPos);
        currentPos = paragraphBreakPos;
        continue;
      }
      
      // Look for line breaks
      const lineBreakPos = this.findNearestMatch(text, targetPos, '\n', 0.1);
      if (lineBreakPos > currentPos) {
        boundaries.push(lineBreakPos);
        currentPos = lineBreakPos;
        continue;
      }
      
      // Look for sentence boundaries
      const sentenceEndPos = this.findNearestSentenceEnd(text, targetPos, 0.15);
      if (sentenceEndPos > currentPos) {
        boundaries.push(sentenceEndPos);
        currentPos = sentenceEndPos;
        continue;
      }
      
      // If no natural boundary found, use word boundary
      const wordBoundaryPos = this.findNearestWordBoundary(text, targetPos, 0.05);
      if (wordBoundaryPos > currentPos) {
        boundaries.push(wordBoundaryPos);
        currentPos = wordBoundaryPos;
        continue;
      }
      
      // If all else fails, just use the target position
      boundaries.push(targetPos);
      currentPos = targetPos;
    }
    
    return boundaries;
  }
  
  /**
   * Find the nearest match to a target position
   * 
   * @param text Text to search in
   * @param targetPos Target position
   * @param pattern Pattern to match
   * @param maxDeviation Maximum allowed deviation as a fraction of chunk size
   * @returns Position of the match or -1 if not found
   */
  private findNearestMatch(text: string, targetPos: number, pattern: string, maxDeviation: number): number {
    const chunkSize = this.options.maxChunkSize * 4; // Convert to characters
    const maxDistance = Math.ceil(chunkSize * maxDeviation);
    
    // Look forward
    const forwardPos = text.indexOf(pattern, targetPos);
    const forwardDistance = forwardPos !== -1 ? forwardPos - targetPos : Infinity;
    
    // Look backward
    let backwardPos = -1;
    let backwardDistance = Infinity;
    
    let searchPos = targetPos;
    while (searchPos > 0 && targetPos - searchPos < maxDistance) {
      searchPos = text.lastIndexOf(pattern, searchPos - 1);
      if (searchPos !== -1) {
        backwardPos = searchPos + pattern.length;
        backwardDistance = targetPos - backwardPos;
        break;
      }
    }
    
    // Return the closest match within max distance
    if (forwardDistance <= maxDistance && forwardDistance <= backwardDistance) {
      return forwardPos + pattern.length;
    } else if (backwardDistance <= maxDistance) {
      return backwardPos;
    }
    
    return -1;
  }
  
  /**
   * Find the nearest sentence end to a target position
   * 
   * @param text Text to search in
   * @param targetPos Target position
   * @param maxDeviation Maximum allowed deviation as a fraction of chunk size
   * @returns Position of the sentence end or -1 if not found
   */
  private findNearestSentenceEnd(text: string, targetPos: number, maxDeviation: number): number {
    // Look for common sentence ending patterns
    const patterns = ['. ', '! ', '? ', '." ', '!" ', '?" '];
    
    for (const pattern of patterns) {
      const pos = this.findNearestMatch(text, targetPos, pattern, maxDeviation);
      if (pos > 0) {
        return pos;
      }
    }
    
    return -1;
  }
  
  /**
   * Find the nearest word boundary to a target position
   * 
   * @param text Text to search in
   * @param targetPos Target position
   * @param maxDeviation Maximum allowed deviation as a fraction of chunk size
   * @returns Position of the word boundary or -1 if not found
   */
  private findNearestWordBoundary(text: string, targetPos: number, maxDeviation: number): number {
    const chunkSize = this.options.maxChunkSize * 4; // Convert to characters
    const maxDistance = Math.ceil(chunkSize * maxDeviation);
    
    // Look forward for a space
    let forwardPos = -1;
    for (let i = targetPos; i < Math.min(text.length, targetPos + maxDistance); i++) {
      if (text[i] === ' ') {
        forwardPos = i + 1; // Position after the space
        break;
      }
    }
    
    // Look backward for a space
    let backwardPos = -1;
    for (let i = targetPos; i > Math.max(0, targetPos - maxDistance); i--) {
      if (text[i] === ' ') {
        backwardPos = i + 1; // Position after the space
        break;
      }
    }
    
    // Return the closest match
    if (forwardPos !== -1 && backwardPos !== -1) {
      return Math.abs(forwardPos - targetPos) <= Math.abs(backwardPos - targetPos) ? 
        forwardPos : backwardPos;
    } else if (forwardPos !== -1) {
      return forwardPos;
    } else if (backwardPos !== -1) {
      return backwardPos;
    }
    
    return -1;
  }
}

/**
 * Create an adaptive chunker instance
 * 
 * @param options Chunking options
 * @returns Adaptive chunker instance
 */
export function createAdaptiveChunker(options: Partial<AdaptiveChunkingOptions> = {}): AdaptiveChunker {
  return new AdaptiveChunker(options);
}