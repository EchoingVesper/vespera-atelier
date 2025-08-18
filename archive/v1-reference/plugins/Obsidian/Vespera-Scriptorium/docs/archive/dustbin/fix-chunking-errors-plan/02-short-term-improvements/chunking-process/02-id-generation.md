# Robust ID Generation

## Current Implementation

The current implementation appears to have inconsistent or missing ID generation for chunks, as evidenced by the "Chunk ID missing during sorting" warnings in the logs. This leads to memory issues during document assembly when the system cannot properly track and organize chunks.

## Improved ID Generation Strategy

### Core Requirements for Chunk IDs

An effective chunk ID system should:

1. Generate **globally unique** IDs for each chunk
2. Be **deterministic** for the same content when needed
3. Include **position information** to aid in sorting
4. Have **minimal collision risk**
5. Be **reasonably compact**

### Proposed ID Generation Implementation

```typescript
/**
 * Utility class for generating and managing chunk IDs
 */
export class ChunkIdGenerator {
  private prefix: string;
  private useTruncatedContent: boolean;
  
  /**
   * Creates a new ChunkIdGenerator
   * @param options - Generator options
   */
  constructor(options: ChunkIdGeneratorOptions = {}) {
    this.prefix = options.prefix || 'chunk';
    this.useTruncatedContent = options.useTruncatedContent ?? true;
  }
  
  /**
   * Generates a unique ID for a chunk
   * @param content - Chunk content
   * @param position - Chunk position
   * @param documentId - Optional document identifier
   * @returns Unique chunk ID
   */
  generateId(content: string, position: number, documentId?: string): string {
    // Create components for the ID
    const timestampComponent = Date.now().toString(36);
    const positionComponent = position.toString().padStart(5, '0');
    const contentHash = this.hashContent(content);
    const documentComponent = documentId ? this.hashString(documentId) : '';
    
    // Assemble the ID
    return [
      this.prefix,
      timestampComponent,
      positionComponent,
      contentHash,
      documentComponent
    ].filter(Boolean).join('-');
  }
  
  /**
   * Generates a deterministic ID based solely on content and position
   * This will produce the same ID for the same content and position
   * @param content - Chunk content
   * @param position - Chunk position
   * @param documentId - Optional document identifier
   * @returns Deterministic chunk ID
   */
  generateDeterministicId(content: string, position: number, documentId?: string): string {
    // Create components for the ID
    const positionComponent = position.toString().padStart(5, '0');
    const contentHash = this.hashContent(content);
    const documentComponent = documentId ? this.hashString(documentId) : '';
    
    // Assemble the ID
    return [
      this.prefix,
      'det',
      positionComponent,
      contentHash,
      documentComponent
    ].filter(Boolean).join('-');
  }
  
  /**
   * Parses position information from a chunk ID
   * @param id - Chunk ID to parse
   * @returns Position number or -1 if not found
   */
  parsePosition(id: string): number {
    try {
      // Split the ID into components
      const components = id.split('-');
      
      // Position should be the third component (index 2)
      if (components.length >= 3) {
        const positionStr = components[2];
        const position = parseInt(positionStr, 10);
        return isNaN(position) ? -1 : position;
      }
      
      return -1;
    } catch (error) {
      console.warn(`Error parsing position from chunk ID ${id}:`, error);
      return -1;
    }
  }
  
  /**
   * Validates a chunk ID format
   * @param id - Chunk ID to validate
   * @returns True if the ID format is valid
   */
  isValidId(id: string): boolean {
    if (!id) return false;
    
    // Check format: should have at least 3 components
    const components = id.split('-');
    if (components.length < 3) return false;
    
    // First component should be the prefix
    if (components[0] !== this.prefix) return false;
    
    // Third component should be a number (position)
    const position = parseInt(components[2], 10);
    if (isNaN(position)) return false;
    
    return true;
  }
  
  /**
   * Generates a hash of the content
   * @param content - Content to hash
   * @returns Content hash
   */
  private hashContent(content: string): string {
    // For deterministic hashing, use a simpler approach
    let hash = 0;
    
    // If using truncated content, only hash the first and last parts
    const textToHash = this.useTruncatedContent
      ? this.getTruncatedContent(content)
      : content;
    
    for (let i = 0; i < textToHash.length; i++) {
      const char = textToHash.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash).toString(16).substring(0, 8);
  }
  
  /**
   * Hashes a string using a fast algorithm
   * @param str - String to hash
   * @returns Hashed string
   */
  private hashString(str: string): string {
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash).toString(16).substring(0, 6);
  }
  
  /**
   * Gets a truncated version of content for hashing
   * Takes the first 100 and last 100 characters
   * @param content - Full content
   * @returns Truncated content
   */
  private getTruncatedContent(content: string): string {
    if (content.length <= 200) return content;
    
    const firstPart = content.substring(0, 100);
    const lastPart = content.substring(content.length - 100);
    
    return firstPart + lastPart;
  }
}
```

## Types and Interfaces

```typescript
/**
 * Options for the ChunkIdGenerator
 */
export interface ChunkIdGeneratorOptions {
  /**
   * Prefix for chunk IDs
   * @default 'chunk'
   */
  prefix?: string;
  
  /**
   * Whether to use truncated content for hashing (faster)
   * @default true
   */
  useTruncatedContent?: boolean;
}
```

## Verification and Recovery Functions

Add utility functions to verify and recover missing chunk IDs:

```typescript
/**
 * Verifies that all chunks have valid IDs
 * @param chunks - Array of chunks to verify
 * @param idGenerator - ChunkIdGenerator instance
 * @returns Array with verification results
 */
export function verifyChunkIds(chunks: DocumentChunk[], idGenerator: ChunkIdGenerator): VerificationResult {
  const missingIds: number[] = [];
  const invalidIds: number[] = [];
  
  chunks.forEach((chunk, index) => {
    if (!chunk.id) {
      missingIds.push(index);
    } else if (!idGenerator.isValidId(chunk.id)) {
      invalidIds.push(index);
    }
  });
  
  return {
    isValid: missingIds.length === 0 && invalidIds.length === 0,
    missingIds,
    invalidIds,
    totalChunks: chunks.length
  };
}

/**
 * Ensures all chunks have valid IDs, generating them if missing
 * @param chunks - Array of chunks to ensure IDs for
 * @param documentId - Optional document identifier
 * @param idGenerator - ChunkIdGenerator instance
 * @returns Array of chunks with valid IDs
 */
export function ensureChunkIds(
  chunks: DocumentChunk[], 
  documentId?: string,
  idGenerator: ChunkIdGenerator = new ChunkIdGenerator()
): DocumentChunk[] {
  return chunks.map((chunk, index) => {
    // If chunk has no ID or invalid ID, generate a new one
    if (!chunk.id || !idGenerator.isValidId(chunk.id)) {
      return {
        ...chunk,
        id: idGenerator.generateId(chunk.content, index, documentId)
      };
    }
    return chunk;
  });
}

/**
 * Results of chunk ID verification
 */
export interface VerificationResult {
  isValid: boolean;
  missingIds: number[];
  invalidIds: number[];
  totalChunks: number;
}
```

## Integration with Chunker Class

Update the Chunker class to use the new ID generator:

```typescript
import { ChunkIdGenerator } from './ChunkIdGenerator';

export class Chunker {
  private settings: ChunkerSettings;
  private idGenerator: ChunkIdGenerator;
  
  constructor(settings: ChunkerSettings = defaultChunkerSettings) {
    this.settings = settings;
    this.idGenerator = new ChunkIdGenerator({
      prefix: settings.idPrefix || 'chunk',
      useTruncatedContent: settings.useTruncatedContentForHashing || true
    });
  }
  
  // In the processChunks method
  private processChunks(rawChunks: string[], options: ChunkerOptions): DocumentChunk[] {
    return rawChunks.map((content, index) => {
      // Generate a unique ID for the chunk using the dedicated generator
      const id = this.idGenerator.generateId(content, index, options.documentId);
      
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
  
  // Add a verification method
  public verifyChunkIds(chunks: DocumentChunk[]): VerificationResult {
    return verifyChunkIds(chunks, this.idGenerator);
  }
  
  // Add a method to ensure all chunks have IDs
  public ensureChunkIds(chunks: DocumentChunk[], documentId?: string): DocumentChunk[] {
    return ensureChunkIds(chunks, documentId, this.idGenerator);
  }
}
```

## Recovery Mechanism in Document Assembly

Update the `sortChunksByPosition` function to recover from missing IDs:

```typescript
/**
 * Sorts chunks by their position, with robust ID handling
 * @param chunks - Array of chunks to sort
 * @param idGenerator - ChunkIdGenerator instance
 * @returns Sorted array of chunks
 */
function sortChunksByPosition(
  chunks: DocumentChunk[],
  idGenerator: ChunkIdGenerator = new ChunkIdGenerator()
): DocumentChunk[] {
  try {
    // First, ensure all chunks have IDs
    const chunksWithIds = ensureChunkIds(chunks, undefined, idGenerator);
    
    // Extract position information from IDs or metadata
    const chunksWithPositions = chunksWithIds.map(chunk => {
      let position = -1;
      
      // Try to get position from metadata
      if (chunk.metadata && chunk.metadata.chunkIndex !== undefined) {
        position = chunk.metadata.chunkIndex;
      }
      
      // If that fails, try to extract from ID
      if (position === -1 && chunk.id) {
        position = idGenerator.parsePosition(chunk.id);
      }
      
      // If all else fails, use position property
      if (position === -1 && chunk.position !== undefined) {
        position = chunk.position;
      }
      
      // Return the chunk with extracted position
      return {
        ...chunk,
        extractedPosition: position
      };
    });
    
    // Now sort by the extracted position
    return chunksWithPositions
      .sort((a, b) => {
        // Compare extracted positions
        const posA = a.extractedPosition;
        const posB = b.extractedPosition;
        
        // If positions are different, sort by position
        if (posA !== posB) {
          return posA - posB;
        }
        
        // If positions are the same, sort by ID as a tiebreaker
        return a.id.localeCompare(b.id);
      })
      .map(({ extractedPosition, ...chunk }) => chunk); // Remove the temporary property
  } catch (error) {
    console.error('Error in sortChunksByPosition:', error);
    
    // Return the original array if sorting fails
    console.warn('Returning original chunk order due to sorting error');
    return [...chunks];
  }
}
```

## Performance Considerations

When working with large documents, the ID generation and content hashing might become performance bottlenecks. Consider these optimizations:

```typescript
/**
 * Optimized version of the ChunkIdGenerator for large documents
 */
export class OptimizedChunkIdGenerator extends ChunkIdGenerator {
  private contentHashCache: Map<string, string> = new Map();
  
  /**
   * Generates a hash of the content with caching
   * @param content - Content to hash
   * @returns Content hash
   */
  protected hashContent(content: string): string {
    // Use truncated content as cache key
    const truncatedContent = this.getTruncatedContent(content);
    
    // Check cache
    if (this.contentHashCache.has(truncatedContent)) {
      return this.contentHashCache.get(truncatedContent)!;
    }
    
    // Generate hash
    const hash = super.hashContent(content);
    
    // Cache the result
    this.contentHashCache.set(truncatedContent, hash);
    
    return hash;
  }
  
  /**
   * Clears the content hash cache
   */
  public clearCache(): void {
    this.contentHashCache.clear();
  }
}
```

## Ensuring Backward Compatibility

To ensure backward compatibility with existing chunks that might have different ID formats:

```typescript
/**
 * Legacy ID format handler
 */
export class LegacyIdHandler {
  /**
   * Checks if an ID uses the legacy format
   * @param id - Chunk ID to check
   * @returns True if the ID uses the legacy format
   */
  public static isLegacyId(id: string): boolean {
    // Add logic to detect your specific legacy ID format
    return id.startsWith('legacy-') || !id.includes('-');
  }
  
  /**
   * Extracts position from a legacy ID
   * @param id - Legacy chunk ID
   * @returns Position or -1 if not found
   */
  public static extractPositionFromLegacyId(id: string): number {
    // Add logic to extract position from legacy IDs
    // This will depend on your specific legacy format
    
    try {
      // Example: Extract number from 'chunk123'
      if (id.match(/^chunk\d+$/)) {
        return parseInt(id.replace('chunk', ''), 10);
      }
      
      return -1;
    } catch (error) {
      console.warn(`Error extracting position from legacy ID ${id}:`, error);
      return -1;
    }
  }
  
  /**
   * Converts a legacy ID to the new format
   * @param id - Legacy chunk ID
   * @param content - Chunk content
   * @param position - Chunk position
   * @param idGenerator - ChunkIdGenerator instance
   * @returns Converted ID in the new format
   */
  public static convertLegacyId(
    id: string,
    content: string,
    position: number,
    idGenerator: ChunkIdGenerator
  ): string {
    // Generate a new ID using the current format
    return idGenerator.generateId(content, position);
  }
}
```

## Implementation Steps

1. Create a new file `src/chunker/ChunkIdGenerator.ts` with the ID generator implementation
2. Create utility functions for verification and recovery in `src/chunker/utils.ts`
3. Update the Chunker class to use the new ID generator
4. Update the `sortChunksByPosition` function to use the robust ID handling
5. Implement backward compatibility for legacy ID formats if needed
6. Add tests to verify the ID generation and recovery mechanism

## Best Practices

1. **Never Assume IDs Exist**: Always verify and ensure IDs are present before operations that require them
2. **Parse Position Information Safely**: Handle errors when parsing position from IDs
3. **Use Fallback Mechanisms**: Have multiple ways to determine chunk positions
4. **Cache Where Appropriate**: Use caching for computationally expensive operations like content hashing
5. **Log ID Issues**: Keep track of missing or invalid IDs for debugging
6. **Be Backward Compatible**: Handle legacy ID formats gracefully
7. **Use Immutable Approach**: Create new objects rather than modifying existing ones

## Return to [Chunking Process](./README.md)
