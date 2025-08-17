/**
 * DocumentAssembler Unit Tests
 *
 * These tests verify that the DocumentAssembler class, specifically the sortChunksByPosition
 * function, correctly handles chunks with mixed invalid/valid IDs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DocumentAssembler } from '../../src/robust-processing/DocumentAssembler';
import { ChunkResult } from '../../src/robust-processing/ProcessingOrchestrator';
import { DocumentChunk, ChunkMetadata } from '../../src/robust-processing/AdaptiveChunker';

describe('DocumentAssembler', () => {
  let assembler: DocumentAssembler;

  beforeEach(() => {
    assembler = new DocumentAssembler();
    // Spy on console.warn to verify warning messages and avoid cluttering test output
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sortChunksByPosition', () => {
    // Use a function to access the private sortChunksByPosition method
    const sortChunks = (chunks: ChunkResult[]) => {
      return (assembler as any).sortChunksByPosition(chunks);
    };

    it('should sort chunks by startPosition when all chunks have metadata', () => {
      const chunks: ChunkResult[] = [
        {
          content: 'Chunk 3',
          chunkId: 'chunk-3',
          success: true,
          retries: 0,
          processingTime: 150,
          tokensGenerated: 50,
          metadata: { startPosition: 300, endPosition: 399, index: 3 }
        },
        {
          content: 'Chunk 1',
          chunkId: 'chunk-1',
          success: true,
          retries: 0,
          processingTime: 100,
          tokensGenerated: 50,
          metadata: { startPosition: 100, endPosition: 199, index: 1 }
        },
        {
          content: 'Chunk 2',
          chunkId: 'chunk-2',
          success: true,
          retries: 0,
          processingTime: 125,
          tokensGenerated: 50,
          metadata: { startPosition: 200, endPosition: 299, index: 2 }
        }
      ];

      const sorted = sortChunks(chunks);

      expect(sorted[0].content).toBe('Chunk 1');
      expect(sorted[1].content).toBe('Chunk 2');
      expect(sorted[2].content).toBe('Chunk 3');
    });

    it('should sort chunks by index if startPosition is not available', () => {
      const chunks: ChunkResult[] = [
        {
          content: 'Chunk 3',
          chunkId: 'chunk-3',
          success: true,
          retries: 0,
          processingTime: 150,
          tokensGenerated: 50,
          metadata: { index: 3 }
        },
        {
          content: 'Chunk 1',
          chunkId: 'chunk-1',
          success: true,
          retries: 0,
          processingTime: 100,
          tokensGenerated: 50,
          metadata: { index: 1 }
        },
        {
          content: 'Chunk 2',
          chunkId: 'chunk-2',
          success: true,
          retries: 0,
          processingTime: 125,
          tokensGenerated: 50,
          metadata: { index: 2 }
        }
      ];

      const sorted = sortChunks(chunks);

      expect(sorted[0].content).toBe('Chunk 1');
      expect(sorted[1].content).toBe('Chunk 2');
      expect(sorted[2].content).toBe('Chunk 3');
    });

    it('should prioritize chunks with metadata over those without', () => {
      const chunks: ChunkResult[] = [
        {
          content: 'No Metadata',
          chunkId: 'chunk-3',
          success: true,
          retries: 0,
          processingTime: 150,
          tokensGenerated: 50,
          metadata: null as any // Setting metadata to null
        },
        {
          content: 'With Metadata',
          chunkId: 'chunk-1',
          success: true,
          retries: 0,
          processingTime: 100,
          tokensGenerated: 50,
          metadata: { startPosition: 100, endPosition: 199, index: 1 }
        },
        {
          content: 'Another Without',
          chunkId: 'chunk-2',
          success: true,
          retries: 0,
          processingTime: 125,
          tokensGenerated: 50,
          metadata: undefined as any // Setting metadata to undefined
        }
      ];

      const sorted = sortChunks(chunks);

      expect(sorted[0].content).toBe('With Metadata');
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Chunk metadata missing'));
    });

    it('should sort chunks by chunkId when neither has metadata', () => {
      const chunks: ChunkResult[] = [
        {
          content: 'Chunk C',
          chunkId: 'chunk-c',
          success: true,
          retries: 0,
          processingTime: 150,
          tokensGenerated: 50,
          metadata: {}
        },
        {
          content: 'Chunk A',
          chunkId: 'chunk-a',
          success: true,
          retries: 0,
          processingTime: 100,
          tokensGenerated: 50,
          metadata: {}
        },
        {
          content: 'Chunk B',
          chunkId: 'chunk-b',
          success: true,
          retries: 0,
          processingTime: 125,
          tokensGenerated: 50,
          metadata: {}
        }
      ];

      const sorted = sortChunks(chunks);

      expect(sorted[0].content).toBe('Chunk A');
      expect(sorted[1].content).toBe('Chunk B');
      expect(sorted[2].content).toBe('Chunk C');
    });

    it('should handle chunks with missing IDs using fallback order', () => {
      const chunks: ChunkResult[] = [
        {
          content: 'Chunk 3',
          chunkId: 'chunk-3',
          success: true,
          retries: 0,
          processingTime: 150,
          tokensGenerated: 50,
          metadata: {}
        },
        {
          content: 'Chunk with missing ID',
          chunkId: 'missing' as any, // Test will mock this as undefined
          success: true,
          retries: 0,
          processingTime: 125,
          tokensGenerated: 50,
          metadata: {}
        },
        {
          content: 'Chunk 1',
          chunkId: 'chunk-1',
          success: true,
          retries: 0,
          processingTime: 100,
          tokensGenerated: 50,
          metadata: {}
        }
      ];

      // Mock the second chunk to have undefined chunkId for testing
      Object.defineProperty(chunks[1], 'chunkId', {
        value: undefined,
        configurable: true
      });

      const sorted = sortChunks(chunks);

      // Should maintain the original order for chunks with missing IDs
      expect(sorted.map((c: ChunkResult) => c.content)).toEqual([
        'Chunk 3',
        'Chunk with missing ID',
        'Chunk 1'
      ]);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Chunk ID missing during sorting'));
    });

    it('should handle mixed valid and null IDs', () => {
      const chunks: ChunkResult[] = [
        {
          content: 'Chunk 2',
          chunkId: 'chunk-2',
          success: true,
          retries: 0,
          processingTime: 125,
          tokensGenerated: 50,
          metadata: {}
        },
        {
          content: 'Chunk with null ID',
          chunkId: 'null-id' as any, // Test will mock this as null
          success: true,
          retries: 0,
          processingTime: 150,
          tokensGenerated: 50,
          metadata: {}
        },
        {
          content: 'Chunk 1',
          chunkId: 'chunk-1',
          success: true,
          retries: 0,
          processingTime: 100,
          tokensGenerated: 50,
          metadata: {}
        }
      ];

      // Mock the second chunk to have null chunkId for testing
      Object.defineProperty(chunks[1], 'chunkId', {
        value: null,
        configurable: true
      });

      const sorted = sortChunks(chunks);

      // Should maintain the original order for chunks with null IDs
      expect(sorted.map((c: ChunkResult) => c.content)).toEqual([
        'Chunk 2',
        'Chunk with null ID',
        'Chunk 1'
      ]);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Chunk ID missing during sorting'));
    });

    it('should handle a complex mix of valid/invalid/missing IDs and metadata', () => {
      const chunks: ChunkResult[] = [
        {
          content: 'Chunk with metadata and ID',
          chunkId: 'chunk-1',
          success: true,
          retries: 0,
          processingTime: 100,
          tokensGenerated: 50,
          metadata: { startPosition: 100, endPosition: 199, index: 1 }
        },
        {
          content: 'Chunk with null ID but metadata',
          chunkId: 'null-id' as any, // Test will mock this as null
          success: true,
          retries: 0,
          processingTime: 120,
          tokensGenerated: 50,
          metadata: { startPosition: 200, endPosition: 299, index: 2 }
        },
        {
          content: 'Chunk with ID but no metadata',
          chunkId: 'chunk-3',
          success: true,
          retries: 0,
          processingTime: 130,
          tokensGenerated: 50,
          metadata: null as any // Explicitly setting metadata to null
        },
        {
          content: 'Chunk with undefined ID and no metadata',
          chunkId: 'undefined-id' as any, // Test will mock this as undefined
          success: true,
          retries: 0,
          processingTime: 140,
          tokensGenerated: 50,
          metadata: undefined as any // Explicitly setting metadata to undefined
        },
        {
          content: 'Chunk with metadata and later startPosition',
          chunkId: 'chunk-5',
          success: true,
          retries: 0,
          processingTime: 150,
          tokensGenerated: 50,
          metadata: { startPosition: 300, endPosition: 399, index: 3 }
        }
      ];

      // Mock null and undefined chunkIds
      Object.defineProperty(chunks[1], 'chunkId', {
        value: null,
        configurable: true
      });

      Object.defineProperty(chunks[3], 'chunkId', {
        value: undefined,
        configurable: true
      });

      const sorted = sortChunks(chunks);

      // Check that all chunks with metadata come first
      expect(sorted[0].content).toBe('Chunk with metadata and ID');
      expect(sorted[1].content).toBe('Chunk with null ID but metadata');
      expect(sorted[2].content).toBe('Chunk with metadata and later startPosition');
      
      // Don't test the exact order of chunks without metadata, just verify they come after
      const chunkWithoutMetadata1 = 'Chunk with ID but no metadata';
      const chunkWithoutMetadata2 = 'Chunk with undefined ID and no metadata';
      
      expect([sorted[3].content, sorted[4].content]).toEqual(
        expect.arrayContaining([chunkWithoutMetadata1, chunkWithoutMetadata2])
      );
      
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Chunk metadata missing'));
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Chunk ID missing'));
    });

    it('should handle undefined/null chunks by filtering them out', () => {
      const chunks: ChunkResult[] = [
        {
          content: 'Chunk 1',
          chunkId: 'chunk-1',
          success: true,
          retries: 0,
          processingTime: 100,
          tokensGenerated: 50,
          metadata: {}
        },
        null as any, // Explicitly add a null chunk to test filtering
        {
          content: 'Chunk 2',
          chunkId: 'chunk-2',
          success: true,
          retries: 0,
          processingTime: 120,
          tokensGenerated: 50,
          metadata: {}
        },
        undefined as any, // Explicitly add an undefined chunk to test filtering
        {
          content: 'Chunk 3',
          chunkId: 'chunk-3',
          success: true,
          retries: 0,
          processingTime: 130,
          tokensGenerated: 50,
          metadata: {}
        }
      ];

      const sorted = sortChunks(chunks);

      expect(sorted.length).toBe(3); // Should filter out null/undefined
      expect(sorted.map((c: ChunkResult) => c.content)).toEqual(['Chunk 1', 'Chunk 2', 'Chunk 3']);
    });

    it('should return empty array for empty input', () => {
      const chunks: ChunkResult[] = [];
      const sorted = sortChunks(chunks);
      expect(sorted).toEqual([]);
    });

    it('should return single chunk array for single input', () => {
      const chunk: ChunkResult = {
        content: 'Single chunk',
        chunkId: 'chunk-1',
        success: true,
        retries: 0,
        processingTime: 100,
        tokensGenerated: 50,
        metadata: {}
      };
      const sorted = sortChunks([chunk]);
      expect(sorted).toEqual([chunk]);
    });

    it('should handle errors in sorting by returning unsorted copy', () => {
      // Create chunks with problematic data that might cause sorting to fail
      const chunks: ChunkResult[] = [
        {
          content: 'Chunk 1',
          chunkId: 'chunk-1',
          success: true,
          retries: 0,
          processingTime: 100,
          tokensGenerated: 50,
          metadata: {}
        },
        {
          content: 'Chunk 2',
          chunkId: 'chunk-2',
          success: true,
          retries: 0,
          processingTime: 120,
          tokensGenerated: 50,
          metadata: {}
        }
      ];

      // Force an error in the sort function
      vi.spyOn(Array.prototype, 'sort').mockImplementationOnce(() => {
        throw new Error('Simulated sorting error');
      });

      const sorted = sortChunks(chunks);

      // Should still return all chunks despite the error
      expect(sorted.length).toBe(2);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Fatal error during chunk sorting'));
    });
  });
});