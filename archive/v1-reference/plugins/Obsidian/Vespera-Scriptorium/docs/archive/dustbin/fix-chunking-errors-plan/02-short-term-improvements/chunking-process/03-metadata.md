# Chunk Metadata Improvements

## Current Implementation

The current chunk metadata implementation appears to be minimal or inconsistent, which contributes to issues during document assembly. Robust metadata is essential for proper sorting, assembly, and recovery from errors.

## Enhanced Chunk Metadata Structure

### Core Requirements for Chunk Metadata

An effective chunk metadata system should:

1. Include **position information** for sorting and assembly
2. Track **relationships** between chunks (preceding and following chunks)
3. Include **document context** for proper attribution
4. Provide **timing information** for debugging and optimization
5. Store **content statistics** for analysis and validation
6. Track **processing history** for audit and recovery

### Proposed Metadata Implementation

```typescript
/**
 * Enhanced metadata for document chunks
 */
export interface ChunkMetadata {
  // Core identification
  chunkIndex: number;          // Position in the original document
  totalChunks: number;         // Total number of chunks in the document
  
  // Document context
  documentId?: string;         // ID of the parent document
  documentTitle?: string;      // Title of the parent document
  documentPath?: string;       // Path to the parent document
  
  // Content information
  chunkLength: number;         // Length of the chunk content in characters
  contentHash: string;         // Hash of the chunk content for validation
  startOffset?: number;        // Start position in the original document
  endOffset?: number;          // End position in the original document
  
  // Chunk relationships
  previousChunkId?: string;    // ID of the previous chunk
  nextChunkId?: string;        // ID of the next chunk
  
  // Processing information
  strategy: string;            // Chunking strategy used
  timestamp: string;           // When the chunk was created
  processingStatus?: string;   // Current processing status (pending, processed, failed)
  processingTime?: number;     // Time taken to process this chunk
  retryCount?: number;         // Number of processing retries
  
  // Content classification
  containsCode?: boolean;      // Whether the chunk contains code blocks
  containsHeaders?: boolean;   // Whether the chunk contains headers
  contentType?: string;        // Type of content (text, code, mixed)
  
  // Custom properties
  [key: string]: any;          // Additional custom properties
}
```

## Metadata Generation Implementation

```typescript
/**
 * Utility class for generating and managing chunk metadata
 */
export class ChunkMetadataGenerator {
  /**
   * Generates metadata for a chunk
   * @param content - Chunk content
   * @param index - Chunk index
   * @param totalChunks - Total number of chunks
   * @param options - Additional options
   * @returns Chunk metadata
   */
  generateMetadata(
    content: string,
    index: number,
    totalChunks: number,
    options: MetadataOptions = {}
  ): ChunkMetadata {
    // Calculate content hash
    const contentHash = this.hashContent(content);
    
    // Analyze content
    const contentAnalysis = this.analyzeContent(content);
    
    // Create basic metadata
    const metadata: ChunkMetadata = {
      chunkIndex: index,
      totalChunks: totalChunks,
      chunkLength: content.length,
      contentHash: contentHash,
      strategy: options.strategy || 'default',
      timestamp: new Date().toISOString(),
      processingStatus: 'pending',
      ...contentAnalysis
    };
    
    // Add document context if available
    if (options.documentId) {
      metadata.documentId = options.documentId;
    }
    
    if (options.documentTitle) {
      metadata.documentTitle = options.documentTitle;
    }
    
    if (options.documentPath) {
      metadata.documentPath = options.documentPath;
    }
    
    // Add chunk relationships if available
    if (index > 0) {
      metadata.previousChunkId = options.getChunkId?.(index - 1) || `chunk-${index - 1}`;
    }
    
    if (index < totalChunks - 1) {
      metadata.nextChunkId = options.getChunkId?.(index + 1) || `chunk-${index + 1}`;
    }
    
    // Add content offsets if available
    if (options.startOffset !== undefined) {
      metadata.startOffset = options.startOffset;
    }
    
    if (options.endOffset !== undefined) {
      metadata.endOffset = options.endOffset;
    }
    
    return metadata;
  }
  
  /**
   * Analyzes chunk content to extract additional metadata
   * @param content - Chunk content
   * @returns Content analysis results
   */
  private analyzeContent(content: string): Partial<ChunkMetadata> {
    // Initialize analysis results
    const analysis: Partial<ChunkMetadata> = {};
    
    // Check for code blocks
    analysis.containsCode = this.containsCodeBlocks(content);
    
    // Check for headers
    analysis.containsHeaders = this.containsHeaders(content);
    
    // Determine content type
    if (analysis.containsCode && !analysis.containsHeaders) {
      analysis.contentType = 'code';
    } else if (!analysis.containsCode && analysis.containsHeaders) {
      analysis.contentType = 'headers';
    } else if (analysis.containsCode && analysis.containsHeaders) {
      analysis.contentType = 'mixed';
    } else {
      analysis.contentType = 'text';
    }
    
    return analysis;
  }
  
  /**
   * Checks if content contains code blocks
   * @param content - Content to check
   * @returns True if content contains code blocks
   */
  private containsCodeBlocks(content: string): boolean {
    // Check for markdown code blocks
    return /```[\s\S]*?```/.test(content) || /`[^`\n]+`/.test(content);
  }
  
  /**
   * Checks if content contains markdown headers
   * @param content - Content to check
   * @returns True if content contains headers
   */
  private containsHeaders(content: string): boolean {
    // Check for markdown headers
    return /^#{1,6}\s.+$/m.test(content);
  }
  
  /**
   * Generates a hash of the content
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
   * Updates chunk metadata after processing
   * @param metadata - Original metadata
   * @param updateOptions - Update options
   * @returns Updated metadata
   */
  updateMetadata(
    metadata: ChunkMetadata,
    updateOptions: MetadataUpdateOptions
  ): ChunkMetadata {
    // Create a copy of the metadata
    const updatedMetadata = { ...metadata };
    
    // Update processing status
    if (updateOptions.processingStatus) {
      updatedMetadata.processingStatus = updateOptions.processingStatus;
    }
    
    // Update processing time
    if (updateOptions.processingTime !== undefined) {
      updatedMetadata.processingTime = updateOptions.processingTime;
    }
    
    // Update retry count
    if (updateOptions.retryCount !== undefined) {
      updatedMetadata.retryCount = updateOptions.retryCount;
    }
    
    // Update custom properties
    if (updateOptions.customProperties) {
      Object.assign(updatedMetadata, updateOptions.customProperties);
    }
    
    return updatedMetadata;
  }
}
```

## Types and Interfaces

```typescript
/**
 * Options for generating chunk metadata
 */
export interface MetadataOptions {
  /**
   * Chunking strategy used
   */
  strategy?: string;
  
  /**
   * ID of the parent document
   */
  documentId?: string;
  
  /**
   * Title of the parent document
   */
  documentTitle?: string;
  
  /**
   * Path to the parent document
   */
  documentPath?: string;
  
  /**
   * Function to get chunk ID for a given index
   */
  getChunkId?: (index: number) => string;
  
  /**
   * Start position in the original document
   */
  startOffset?: number;
  
  /**
   * End position in the original document
   */
  endOffset?: number;
}

/**
 * Options for updating chunk metadata
 */
export interface MetadataUpdateOptions {
  /**
   * Processing status
   */
  processingStatus?: string;
  
  /**
   * Processing time in milliseconds
   */
  processingTime?: number;
  
  /**
   * Number of processing retries
   */
  retryCount?: number;
  
  /**
   * Custom properties to add to metadata
   */
  customProperties?: Record<string, any>;
}
```

## Integration with Chunker Class

Update the Chunker class to use the metadata generator:

```typescript
import { ChunkMetadataGenerator } from './ChunkMetadataGenerator';

export class Chunker {
  private settings: ChunkerSettings;
  private idGenerator: ChunkIdGenerator;
  private metadataGenerator: ChunkMetadataGenerator;
  
  constructor(settings: ChunkerSettings = defaultChunkerSettings) {
    this.settings = settings;
    this.idGenerator = new ChunkIdGenerator({
      prefix: settings.idPrefix || 'chunk',
      useTruncatedContent: settings.useTruncatedContentForHashing || true
    });
    this.metadataGenerator = new ChunkMetadataGenerator();
  }
  
  // In the processChunks method
  private processChunks(rawChunks: string[], options: ChunkerOptions): DocumentChunk[] {
    // Create a function to get chunk ID for a given index
    const getChunkId = (index: number) => {
      if (index < 0 || index >= rawChunks.length) return undefined;
      
      const content = rawChunks[index];
      return this.idGenerator.generateId(content, index, options.documentId);
    };
    
    return rawChunks.map((content, index) => {
      // Generate a unique ID for the chunk
      const id = getChunkId(index) as string;
      
      // Generate metadata
      const metadata = this.metadataGenerator.generateMetadata(
        content,
        index,
        rawChunks.length,
        {
          strategy: options.strategy,
          documentId: options.documentId,
          documentTitle: options.documentTitle,
          documentPath: options.documentPath,
          getChunkId
        }
      );
      
      // Create the chunk object
      return {
        id,
        content,
        position: index,
        metadata
      };
    });
  }
  
  // Add a method to update chunk metadata
  public updateChunkMetadata(
    chunk: DocumentChunk,
    updateOptions: MetadataUpdateOptions
  ): DocumentChunk {
    // Update the metadata
    const updatedMetadata = this.metadataGenerator.updateMetadata(
      chunk.metadata,
      updateOptions
    );
    
    // Return an updated chunk
    return {
      ...chunk,
      metadata: updatedMetadata
    };
  }
}
```

## Metadata Validation and Recovery

Add utility functions to validate and recover metadata:

```typescript
/**
 * Validates chunk metadata
 * @param chunk - Chunk to validate
 * @returns Validation result
 */
export function validateMetadata(chunk: DocumentChunk): MetadataValidationResult {
  const issues: string[] = [];
  
  // Check required fields
  if (chunk.metadata.chunkIndex === undefined) {
    issues.push('Missing chunkIndex');
  }
  
  if (chunk.metadata.totalChunks === undefined) {
    issues.push('Missing totalChunks');
  }
  
  if (!chunk.metadata.timestamp) {
    issues.push('Missing timestamp');
  }
  
  // Validate relationships
  if (chunk.metadata.previousChunkId && chunk.metadata.chunkIndex === 0) {
    issues.push('First chunk should not have previousChunkId');
  }
  
  if (chunk.metadata.nextChunkId && chunk.metadata.chunkIndex === chunk.metadata.totalChunks - 1) {
    issues.push('Last chunk should not have nextChunkId');
  }
  
  // Validate content hash
  const hasher = new ChunkMetadataGenerator();
  const expectedHash = hasher['hashContent'](chunk.content);
  
  if (chunk.metadata.contentHash && chunk.metadata.contentHash !== expectedHash) {
    issues.push('Content hash mismatch');
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

/**
 * Repairs chunk metadata
 * @param chunks - Array of chunks
 * @param options - Repair options
 * @returns Array of chunks with repaired metadata
 */
export function repairMetadata(
  chunks: DocumentChunk[],
  options: MetadataRepairOptions = {}
): DocumentChunk[] {
  const metadataGenerator = new ChunkMetadataGenerator();
  
  // First pass: update basic metadata
  const repairedChunks = chunks.map((chunk, index) => {
    // Generate a function to get chunk ID
    const getChunkId = (idx: number) => {
      if (idx < 0 || idx >= chunks.length) return undefined;
      return chunks[idx].id;
    };
    
    // Generate new metadata
    const newMetadata = metadataGenerator.generateMetadata(
      chunk.content,
      index,
      chunks.length,
      {
        ...options,
        getChunkId
      }
    );
    
    // Preserve existing metadata values that should not be changed
    const preservedMetadata: Partial<ChunkMetadata> = {};
    
    if (options.preserveFields) {
      options.preserveFields.forEach(field => {
        if (chunk.metadata[field] !== undefined) {
          preservedMetadata[field] = chunk.metadata[field];
        }
      });
    }
    
    // Merge preserved and new metadata
    const mergedMetadata = {
      ...newMetadata,
      ...preservedMetadata
    };
    
    // Return the chunk with repaired metadata
    return {
      ...chunk,
      metadata: mergedMetadata
    };
  });
  
  // Second pass: update relationships
  return repairedChunks.map((chunk, index) => {
    const metadata = { ...chunk.metadata };
    
    // Update previous chunk relationship
    if (index > 0) {
      metadata.previousChunkId = repairedChunks[index - 1].id;
    } else {
      delete metadata.previousChunkId;
    }
    
    // Update next chunk relationship
    if (index < repairedChunks.length - 1) {
      metadata.nextChunkId = repairedChunks[index + 1].id;
    } else {
      delete metadata.nextChunkId;
    }
    
    return {
      ...chunk,
      metadata
    };
  });
}

/**
 * Result of metadata validation
 */
export interface MetadataValidationResult {
  isValid: boolean;
  issues: string[];
}

/**
 * Options for metadata repair
 */
export interface MetadataRepairOptions extends MetadataOptions {
  /**
   * Fields to preserve from original metadata
   */
  preserveFields?: string[];
}
```

## Using Metadata for Advanced Functions

### 1. Efficient Document Assembly with Link Traversal

Metadata with relationship links enables efficient document assembly without sorting:

```typescript
/**
 * Assembles a document using chunk relationship links
 * @param chunks - Array of chunks
 * @param startChunkId - ID of the first chunk
 * @returns Assembled document
 */
export function assembleDocumentWithLinks(
  chunks: DocumentChunk[],
  startChunkId?: string
): string {
  // Create a map of chunks by ID for efficient lookup
  const chunksById = new Map<string, DocumentChunk>();
  chunks.forEach(chunk => chunksById.set(chunk.id, chunk));
  
  // Find the first chunk
  let currentChunkId: string | undefined;
  
  if (startChunkId && chunksById.has(startChunkId)) {
    // Use specified start chunk
    currentChunkId = startChunkId;
  } else {
    // Find the chunk with the lowest index
    let lowestIndex = Number.MAX_SAFE_INTEGER;
    let lowestChunkId: string | undefined;
    
    chunks.forEach(chunk => {
      if (chunk.metadata.chunkIndex < lowestIndex) {
        lowestIndex = chunk.metadata.chunkIndex;
        lowestChunkId = chunk.id;
      }
    });
    
    currentChunkId = lowestChunkId;
  }
  
  // Traverse chunks using relationship links
  const assembledParts: string[] = [];
  const visitedChunks = new Set<string>();
  
  while (currentChunkId && chunksById.has(currentChunkId) && !visitedChunks.has(currentChunkId)) {
    // Get current chunk
    const currentChunk = chunksById.get(currentChunkId)!;
    
    // Add content to assembled parts
    assembledParts.push(currentChunk.content);
    
    // Mark as visited to avoid infinite loops
    visitedChunks.add(currentChunkId);
    
    // Move to next chunk
    currentChunkId = currentChunk.metadata.nextChunkId;
  }
  
  // Join all parts
  return assembledParts.join('\n');
}
```

### 2. Intelligent Chunk Selection for Processing

Metadata can be used to prioritize chunks for processing:

```typescript
/**
 * Sorts chunks by processing priority
 * @param chunks - Array of chunks
 * @returns Prioritized array of chunks
 */
export function prioritizeChunks(chunks: DocumentChunk[]): DocumentChunk[] {
  // Create a scoring function for chunks
  const getChunkScore = (chunk: DocumentChunk): number => {
    let score = 0;
    
    // Prioritize headers (more important for context)
    if (chunk.metadata.containsHeaders) {
      score += 10;
    }
    
    // Deprioritize code (often less important for summaries)
    if (chunk.metadata.containsCode) {
      score -= 5;
    }
    
    // Prioritize earlier chunks
    score -= chunk.metadata.chunkIndex * 0.1;
    
    // Prioritize shorter chunks (faster to process)
    score -= chunk.metadata.chunkLength * 0.001;
    
    return score;
  };
  
  // Sort chunks by score (highest first)
  return [...chunks].sort((a, b) => getChunkScore(b) - getChunkScore(a));
}
```

### 3. Content Integrity Validation

Metadata can be used to validate content integrity:

```typescript
/**
 * Validates the integrity of chunks
 * @param chunks - Array of chunks
 * @returns Validation results
 */
export function validateChunksIntegrity(chunks: DocumentChunk[]): ChunksValidationResult {
  const metadataGenerator = new ChunkMetadataGenerator();
  const issues: ChunkIntegrityIssue[] = [];
  
  // Check each chunk
  chunks.forEach((chunk, index) => {
    // Validate content hash
    const expectedHash = metadataGenerator['hashContent'](chunk.content);
    
    if (chunk.metadata.contentHash && chunk.metadata.contentHash !== expectedHash) {
      issues.push({
        chunkId: chunk.id,
        issue: 'Content hash mismatch',
        description: `Expected ${expectedHash}, got ${chunk.metadata.contentHash}`
      });
    }
    
    // Validate index
    if (chunk.metadata.chunkIndex !== index) {
      issues.push({
        chunkId: chunk.id,
        issue: 'Index mismatch',
        description: `Expected ${index}, got ${chunk.metadata.chunkIndex}`
      });
    }
    
    // Validate relationships
    if (index > 0) {
      const prevChunk = chunks[index - 1];
      
      if (chunk.metadata.previousChunkId && chunk.metadata.previousChunkId !== prevChunk.id) {
        issues.push({
          chunkId: chunk.id,
          issue: 'Previous chunk ID mismatch',
          description: `Expected ${prevChunk.id}, got ${chunk.metadata.previousChunkId}`
        });
      }
    }
    
    if (index < chunks.length - 1) {
      const nextChunk = chunks[index + 1];
      
      if (chunk.metadata.nextChunkId && chunk.metadata.nextChunkId !== nextChunk.id) {
        issues.push({
          chunkId: chunk.id,
          issue: 'Next chunk ID mismatch',
          description: `Expected ${nextChunk.id}, got ${chunk.metadata.nextChunkId}`
        });
      }
    }
  });
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

interface ChunksValidationResult {
  isValid: boolean;
  issues: ChunkIntegrityIssue[];
}

interface ChunkIntegrityIssue {
  chunkId: string;
  issue: string;
  description: string;
}
```

## Implementation Steps

1. Create a new file `src/chunker/ChunkMetadataGenerator.ts` with the metadata generator implementation
2. Update the `Chunker` class to use the metadata generator
3. Add metadata validation and repair functions
4. Implement utility functions that leverage metadata for enhanced functionality
5. Update document assembly to use metadata for more efficient processing
6. Test the metadata system with various document types

## Best Practices

1. **Complete Metadata**: Include comprehensive metadata for every chunk
2. **Relationships Between Chunks**: Track relationships between chunks to enable efficient traversal
3. **Content Validation**: Include content hashes for validating integrity
4. **Processing History**: Track processing status and history for debugging
5. **Document Context**: Include document context for proper attribution
6. **Smart Analysis**: Analyze content to classify chunks and aid in prioritization
7. **Efficiency**: Use metadata to make document assembly and processing more efficient

## Return to [Chunking Process](./README.md)
