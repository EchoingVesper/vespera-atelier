/**
 * Document Assembler
 * Handles reassembly of processed chunks with context awareness.
 * @module DocumentAssembler
 */

import { DocumentChunk, ChunkMetadata } from "./AdaptiveChunker";
import { ChunkResult } from "./ProcessingOrchestrator";
import { v4 as uuidv4 } from 'uuid';

/**
 * Assembly options
 */
export interface AssemblyOptions {
  /**
   * Whether to preserve chunk boundaries
   * @default false
   */
  preserveChunkBoundaries: boolean;
  
  /**
   * Whether to resolve references
   * @default true
   */
  resolveReferences: boolean;
  
  /**
   * Whether to detect redundancies
   * @default true
   */
  detectRedundancies: boolean;
  
  /**
   * Whether to optimize for coherence
   * @default true
   */
  optimizeForCoherence: boolean;
  
  /**
   * Similarity threshold for redundancy detection (0-1)
   * @default 0.8
   */
  similarityThreshold: number;
  
  /**
   * Whether to include metadata in the assembled document
   * @default true
   */
  includeMetadata: boolean;
  
  /**
   * Whether to include processing statistics
   * @default true
   */
  includeProcessingStats: boolean;
}

/**
 * Default assembly options
 */
export const DEFAULT_ASSEMBLY_OPTIONS: AssemblyOptions = {
  preserveChunkBoundaries: false,
  resolveReferences: true,
  detectRedundancies: true,
  optimizeForCoherence: true,
  similarityThreshold: 0.8,
  includeMetadata: true,
  includeProcessingStats: true
};

/**
 * Redundant section
 */
export interface RedundantSection {
  /**
   * Index of the first occurrence
   */
  firstIndex: number;
  
  /**
   * Index of the second occurrence
   */
  secondIndex: number;
  
  /**
   * Similarity score (0-1)
   */
  similarity: number;
  
  /**
   * Text of the first occurrence
   */
  firstText: string;
  
  /**
   * Text of the second occurrence
   */
  secondText: string;
}

/**
 * Redundancy report
 */
export interface RedundancyReport {
  /**
   * Redundant sections
   */
  redundantSections: RedundantSection[];
  
  /**
   * Similarity matrix
   */
  similarityMatrix: number[][];
  
  /**
   * Recommendations for handling redundancies
   */
  recommendations: string[];
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
  
  /**
   * Redundancy report
   */
  redundancyReport?: RedundancyReport;
}

/**
 * Document Assembler class
 * Responsible for reassembling processed chunks into a coherent document
 */
export class DocumentAssembler {
  private options: AssemblyOptions;
  
  /**
   * Create a new DocumentAssembler instance
   * 
   * @param options Assembly options
   */
  constructor(options: Partial<AssemblyOptions> = {}) {
    this.options = { ...DEFAULT_ASSEMBLY_OPTIONS, ...options };
  }
  
  /**
   * Assemble a document from processed chunks
   * 
   * @param chunks Processed chunks
   * @param documentName Document name
   * @param sourcePath Source document path
   * @param processingStats Processing statistics
   * @param options Assembly options (overrides instance options)
   * @returns Assembled document
   */
  public assembleDocument(
    chunks: ChunkResult[],
    documentName: string,
    sourcePath: string,
    processingStats: any,
    options: Partial<AssemblyOptions> = {}
  ): AssembledDocument {
    // Merge options
    const mergedOptions = { ...this.options, ...options };
    
    // Sort chunks by position if metadata is available
    const sortedChunks = this.sortChunksByPosition(chunks);
    
    // Assemble the content
    let content = '';
    
    if (mergedOptions.preserveChunkBoundaries) {
      // Assemble with chunk boundaries
      content = this.assembleWithBoundaries(sortedChunks);
    } else {
      // Assemble without chunk boundaries
      content = this.assembleWithoutBoundaries(sortedChunks);
    }
    
    // Resolve references if enabled
    if (mergedOptions.resolveReferences) {
      content = this.resolveReferences(content);
    }
    
    // Detect redundancies if enabled
    let redundancyReport: RedundancyReport | undefined;
    
    if (mergedOptions.detectRedundancies) {
      redundancyReport = this.detectRedundancies(content, mergedOptions.similarityThreshold);
      
      // Remove redundancies
      content = this.removeRedundancies(content, redundancyReport);
    }
    
    // Optimize for coherence if enabled
    if (mergedOptions.optimizeForCoherence) {
      content = this.optimizeCoherence(content);
    }
    
    // Create the assembled document
    const assembledDocument: AssembledDocument = {
      id: uuidv4(),
      content,
      metadata: {
        documentName,
        sourcePath,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      processingStats: {
        totalProcessingTime: processingStats.totalTime || 0,
        chunksProcessed: processingStats.chunksProcessed || chunks.length,
        tokensProcessed: processingStats.tokensProcessed || 0,
        retries: processingStats.retries || 0
      }
    };
    
    // Add redundancy report if available
    if (redundancyReport) {
      assembledDocument.redundancyReport = redundancyReport;
    }
    
    return assembledDocument;
  }
  
  /**
   * Sort chunks by position
   * 
   * @param chunks Processed chunks
   * @returns Sorted chunks
   */
  /**
   * Sort chunks by position with defensive checks to prevent crashes
   *
   * @param chunks Processed chunks
   * @returns Sorted chunks
   */
  /**
   * Sort chunks by position with robust error handling to prevent infinite loops and excessive recursion
   *
   * @param chunks Processed chunks
   * @returns Sorted chunks
   */
  private sortChunksByPosition(chunks: ChunkResult[]): ChunkResult[] {
    // Filter out any undefined or null entries before sorting
    const validChunks = chunks.filter(chunk => chunk !== undefined && chunk !== null);

    // Early return for empty or single-chunk arrays (no sorting needed)
    if (!validChunks || validChunks.length <= 1) {
      return validChunks ? [...validChunks] : [];
    }
    
    // Create a copy of the valid chunks array
    const sortedChunks = [...validChunks];
    
    // Count warning occurrences to avoid excessive logging
    let metadataMissingWarnings = 0;
    let chunkIdMissingWarnings = 0;
    
    // Sort by position if metadata is available
    try {
      sortedChunks.sort((a, b) => {
        // Case 1: Both chunks have metadata
        if (a.metadata && b.metadata) {
          // If start position is available, sort by that
          if (a.metadata.startPosition !== undefined && b.metadata.startPosition !== undefined) {
            return a.metadata.startPosition - b.metadata.startPosition;
          }
          
          // If index is available, sort by that
          if (a.metadata.index !== undefined && b.metadata.index !== undefined) {
            return a.metadata.index - b.metadata.index;
          }
        }
        
        // Case 2: Only one chunk has metadata (prioritize chunks with metadata)
        if (a.metadata && !b.metadata) {
          if (metadataMissingWarnings < 5) {
            console.warn('Chunk metadata missing during sorting, prioritizing chunks with metadata');
            metadataMissingWarnings++;
          }
          return -1; // Place chunk with metadata first
        }
        
        if (!a.metadata && b.metadata) {
          if (metadataMissingWarnings < 5) {
            console.warn('Chunk metadata missing during sorting, prioritizing chunks with metadata');
            metadataMissingWarnings++;
          }
          return 1; // Place chunk with metadata first
        }
        
        // Case 3: Neither chunk has metadata, try using chunk IDs if both are defined
        if (a.chunkId !== null && a.chunkId !== undefined && b.chunkId !== null && b.chunkId !== undefined) {
          try {
            return a.chunkId.localeCompare(b.chunkId);
          } catch (error) {
            if (chunkIdMissingWarnings < 5) {
              console.warn(`Error comparing chunk IDs: ${error instanceof Error ? error.message : 'Unknown error'}`);
              chunkIdMissingWarnings++;
            }
          }
        }

        // Case 4: One or both chunks are missing IDs, use fallback sorting
        if (a.chunkId === null || a.chunkId === undefined || b.chunkId === null || b.chunkId === undefined) {
          if (chunkIdMissingWarnings < 5) {
            console.warn(`Chunk ID missing during sorting for chunk ${a.chunkId} or ${b.chunkId}, using fallback order`);
            chunkIdMissingWarnings++;
          }
          // Fallback: Sort by original index in the input array
          const aIndex = validChunks.indexOf(a);
          const bIndex = validChunks.indexOf(b);
          return aIndex - bIndex;
        }

        // Final fallback: maintain original order (should not be reached if all chunks have IDs or fallback is used)
        return 0;
      });
      
      // Log summary if there were many warnings
      if (metadataMissingWarnings >= 5) {
        console.warn(`Suppressed ${metadataMissingWarnings - 5} additional metadata missing warnings`);
      }
      
      if (chunkIdMissingWarnings >= 5) {
        console.warn(`Suppressed ${chunkIdMissingWarnings - 5} additional chunk ID missing warnings`);
      }
      
      return sortedChunks;
    } catch (error) {
      // If sorting fails completely, log error and return unsorted copy
      console.error(`Fatal error during chunk sorting: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [...validChunks];
    }
  }
  
  /**
   * Assemble content with chunk boundaries
   * 
   * @param chunks Processed chunks
   * @returns Assembled content
   */
  private assembleWithBoundaries(chunks: ChunkResult[]): string {
    let content = '';
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Add chunk header
      content += `\n\n--- Chunk ${i + 1}/${chunks.length} ---\n\n`;
      
      // Add chunk content
      content += chunk.content;
    }
    
    return content.trim();
  }
  
  /**
   * Assemble content without chunk boundaries
   * 
   * @param chunks Processed chunks
   * @returns Assembled content
   */
  private assembleWithoutBoundaries(chunks: ChunkResult[]): string {
    let content = '';
    let lastEndPosition = 0;
    
    for (const chunk of chunks) {
      // If metadata is not available, just append the content
      if (!chunk.metadata || chunk.metadata.startPosition === undefined || chunk.metadata.endPosition === undefined) {
        content += chunk.content + '\n\n';
        continue;
      }
      
      // Get positions from metadata
      const startPosition = chunk.metadata.startPosition;
      const endPosition = chunk.metadata.endPosition;
      
      // Check for gaps or overlaps
      if (startPosition > lastEndPosition) {
        // There's a gap, which shouldn't happen with proper chunking
        console.warn(`Gap detected between positions ${lastEndPosition} and ${startPosition}`);
        content += '\n[...missing content...]\n';
      } else if (startPosition < lastEndPosition) {
        // There's an overlap, which is expected
        const overlapSize = lastEndPosition - startPosition;
        
        // Skip the overlapping part
        if (chunk.content.length > overlapSize) {
          content += chunk.content.substring(overlapSize);
        }
      } else {
        // Perfect continuation
        content += chunk.content;
      }
      
      // Update last end position
      lastEndPosition = endPosition;
    }
    
    return content.trim();
  }
  
  /**
   * Resolve references in the content
   * 
   * @param content Document content
   * @returns Content with resolved references
   */
  private resolveReferences(content: string): string {
    // This is a simplified implementation
    // In a real implementation, we would parse the content and resolve references
    
    // Example: Resolve "see above" references
    content = content.replace(/see above/gi, 'see previous section');
    
    // Example: Resolve "as mentioned earlier" references
    content = content.replace(/as mentioned earlier/gi, 'as previously discussed');
    
    return content;
  }
  
  /**
   * Detect redundancies in the content
   * 
   * @param content Document content
   * @param threshold Similarity threshold (0-1)
   * @returns Redundancy report
   */
  private detectRedundancies(content: string, threshold: number): RedundancyReport {
    // Split content into paragraphs
    const paragraphs = content.split(/\n\s*\n/);
    
    // Calculate similarity matrix
    const similarityMatrix = this.calculateSimilarityMatrix(paragraphs);
    
    // Find redundant sections
    const redundantSections: RedundantSection[] = [];
    
    for (let i = 0; i < paragraphs.length; i++) {
      for (let j = i + 1; j < paragraphs.length; j++) {
        if (similarityMatrix[i][j] > threshold) {
          redundantSections.push({
            firstIndex: i,
            secondIndex: j,
            similarity: similarityMatrix[i][j],
            firstText: paragraphs[i],
            secondText: paragraphs[j]
          });
        }
      }
    }
    
    // Generate recommendations
    const recommendations = this.generateRedundancyRecommendations(redundantSections, paragraphs);
    
    return {
      redundantSections,
      similarityMatrix,
      recommendations
    };
  }
  
  /**
   * Calculate similarity matrix for paragraphs
   * 
   * @param paragraphs Array of paragraphs
   * @returns Similarity matrix
   */
  private calculateSimilarityMatrix(paragraphs: string[]): number[][] {
    const matrix: number[][] = [];
    
    // Initialize matrix
    for (let i = 0; i < paragraphs.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < paragraphs.length; j++) {
        matrix[i][j] = 0;
      }
    }
    
    // Calculate similarity for each pair of paragraphs
    for (let i = 0; i < paragraphs.length; i++) {
      for (let j = i; j < paragraphs.length; j++) {
        if (i === j) {
          matrix[i][j] = 1; // Same paragraph
        } else {
          // Calculate Jaccard similarity
          const similarity = this.calculateJaccardSimilarity(paragraphs[i], paragraphs[j]);
          matrix[i][j] = similarity;
          matrix[j][i] = similarity; // Symmetric
        }
      }
    }
    
    return matrix;
  }
  
  /**
   * Calculate Jaccard similarity between two strings
   * 
   * @param a First string
   * @param b Second string
   * @returns Similarity score (0-1)
   */
  private calculateJaccardSimilarity(a: string, b: string): number {
    // Convert strings to sets of words
    const setA = new Set(a.toLowerCase().split(/\W+/).filter(word => word.length > 0));
    const setB = new Set(b.toLowerCase().split(/\W+/).filter(word => word.length > 0));
    
    // Calculate intersection
    const intersection = new Set([...setA].filter(word => setB.has(word)));
    
    // Calculate union
    const union = new Set([...setA, ...setB]);
    
    // Calculate Jaccard similarity
    return intersection.size / union.size;
  }
  
  /**
   * Generate recommendations for handling redundancies
   * 
   * @param redundantSections Redundant sections
   * @param paragraphs Array of paragraphs
   * @returns Array of recommendations
   */
  private generateRedundancyRecommendations(redundantSections: RedundantSection[], paragraphs: string[]): string[] {
    const recommendations: string[] = [];
    
    if (redundantSections.length === 0) {
      recommendations.push('No redundancies detected.');
      return recommendations;
    }
    
    recommendations.push(`Detected ${redundantSections.length} redundant sections.`);
    
    // Group redundancies by similarity
    const highSimilarity = redundantSections.filter(section => section.similarity > 0.9);
    const mediumSimilarity = redundantSections.filter(section => section.similarity > 0.8 && section.similarity <= 0.9);
    const lowSimilarity = redundantSections.filter(section => section.similarity <= 0.8);
    
    if (highSimilarity.length > 0) {
      recommendations.push(`${highSimilarity.length} sections have high similarity (>90%) and should be merged or removed.`);
    }
    
    if (mediumSimilarity.length > 0) {
      recommendations.push(`${mediumSimilarity.length} sections have medium similarity (80-90%) and should be reviewed.`);
    }
    
    if (lowSimilarity.length > 0) {
      recommendations.push(`${lowSimilarity.length} sections have low similarity (<=80%) and may be false positives.`);
    }
    
    return recommendations;
  }
  
  /**
   * Remove redundancies from the content
   * 
   * @param content Document content
   * @param report Redundancy report
   * @returns Content with redundancies removed
   */
  private removeRedundancies(content: string, report: RedundancyReport): string {
    // Split content into paragraphs
    const paragraphs = content.split(/\n\s*\n/);
    
    // Mark paragraphs to remove (second occurrences of high-similarity pairs)
    const toRemove = new Set<number>();
    
    for (const section of report.redundantSections) {
      if (section.similarity > 0.9) {
        toRemove.add(section.secondIndex);
      }
    }
    
    // Rebuild content without redundant paragraphs
    const filteredParagraphs = paragraphs.filter((_, index) => !toRemove.has(index));
    
    return filteredParagraphs.join('\n\n');
  }
  
  /**
   * Optimize content for coherence
   * 
   * @param content Document content
   * @returns Optimized content
   */
  private optimizeCoherence(content: string): string {
    // This is a simplified implementation
    // In a real implementation, we would use more sophisticated techniques
    
    // Example: Add transition sentences between paragraphs
    const paragraphs = content.split(/\n\s*\n/);
    const enhancedParagraphs: string[] = [];
    
    for (let i = 0; i < paragraphs.length; i++) {
      enhancedParagraphs.push(paragraphs[i]);
      
      // Add transition between paragraphs (except for the last one)
      if (i < paragraphs.length - 1) {
        // Only add transitions between paragraphs that don't already have them
        const currentEndsWithTransition = /(?:therefore|thus|consequently|as a result|in conclusion|to summarize|in summary|finally|in addition|furthermore|moreover|similarly|likewise|in contrast|on the other hand|however|nevertheless|nonetheless|despite this|conversely|meanwhile|subsequently|accordingly|hence)\.?$/i.test(paragraphs[i]);
        const nextStartsWithTransition = /^(?:therefore|thus|consequently|as a result|in conclusion|to summarize|in summary|finally|in addition|furthermore|moreover|similarly|likewise|in contrast|on the other hand|however|nevertheless|nonetheless|despite this|conversely|meanwhile|subsequently|accordingly|hence)/i.test(paragraphs[i + 1]);
        
        if (!currentEndsWithTransition && !nextStartsWithTransition) {
          // Simple heuristic to add an appropriate transition
          if (paragraphs[i].includes('problem') || paragraphs[i].includes('issue') || paragraphs[i].includes('challenge')) {
            enhancedParagraphs.push('Therefore, a solution is needed to address these challenges.');
          } else if (paragraphs[i].includes('advantage') || paragraphs[i].includes('benefit')) {
            enhancedParagraphs.push('Furthermore, these benefits can be leveraged in several ways.');
          } else if (paragraphs[i].includes('example') || paragraphs[i].includes('instance')) {
            enhancedParagraphs.push('Similarly, other examples demonstrate this pattern.');
          } else {
            // Generic transition
            enhancedParagraphs.push('Additionally, the following points are relevant to consider.');
          }
        }
      }
    }
    
    return enhancedParagraphs.join('\n\n');
  }
}

/**
 * Create a document assembler instance
 * 
 * @param options Assembly options
 * @returns Document assembler instance
 */
export function createDocumentAssembler(options: Partial<AssemblyOptions> = {}): DocumentAssembler {
  return new DocumentAssembler(options);
}