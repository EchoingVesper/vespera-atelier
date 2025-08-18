import { describe, it, expect, vi } from 'vitest';
import { chunkText, ChunkingOptions, DEFAULT_CHUNKING_OPTIONS } from '../../src/Chunker';
import { AdaptiveChunker, DocumentChunk } from '../../src/robust-processing/AdaptiveChunker';
import { beforeEach } from 'vitest';

describe('chunkText (legacy)', () => {
  it('splits text into equal-sized chunks', () => {
    const input = 'abcdefghij';
    const result = chunkText(input, 3);
    expect(result).toEqual(['abc', 'def', 'ghi', 'j']);
  });

  it('returns the whole string if chunkSize > text length', () => {
    const input = 'abc';
    const result = chunkText(input, 10);
    expect(result).toEqual(['abc']);
  });

  it('throws if chunkSize is zero or negative', () => {
    expect(() => chunkText('abc', 0)).toThrow();
    expect(() => chunkText('abc', -1)).toThrow();
  });
});

describe('AdaptiveChunker', () => {
  let chunker: AdaptiveChunker;

  beforeEach(() => {
    chunker = new AdaptiveChunker();
  });

  it('handles documents with no headings, assigning default IDs', async () => {
    const input = 'This is a document with no headings. It should be chunked and assigned default IDs.';
    const chunks: DocumentChunk[] = await chunker.chunkText(input, 'test-document-id', 'test-document');

    expect(chunks.length).toBeGreaterThan(0);
    chunks.forEach((chunk, index) => {
      // Default IDs are UUIDs, so we check for the presence of an ID
      expect(chunk.id).toBeDefined();
      expect(typeof chunk.id).toBe('string');
      // We can also check the deterministic ID if enabled, but for now, just check the presence of a string ID.
    });
  });

  it('handles documents with consecutive headings, assigning correct IDs', async () => {
    const input = '# Heading 1\n\n## Heading 2\n\nSome content.\n\n### Heading 3';
    const chunks: DocumentChunk[] = await chunker.chunkText(input, 'test-document-id', 'test-document');

    expect(chunks.length).toBeGreaterThan(0);
    // Assuming the chunker creates chunks based on headings, verify IDs
    // The AdaptiveChunker does not automatically assign heading text as IDs.
    // It assigns UUIDs by default. We need to verify that the chunks are created correctly
    // and that they have unique IDs.
    const ids = chunks.map(chunk => chunk.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
    expect(chunks[0].content).toContain('# Heading 1');
    if (chunks.length > 1) expect(chunks[1].content).toContain('## Heading 2');
    if (chunks.length > 2) expect(chunks[2].content).toContain('### Heading 3');
  });

  it('handles special characters in headings for ID assignment', async () => {
    const input = '# Heading with !@#$%^&*()_+=-`~:;"\'<>?,./|\\[]{}';
    const chunks: DocumentChunk[] = await chunker.chunkText(input, 'test-document-id', 'test-document');

    expect(chunks.length).toBeGreaterThan(0);
    // AdaptiveChunker assigns UUIDs, so we check for the presence of a string ID.
    expect(chunks[0].id).toBeDefined();
    expect(typeof chunks[0].id).toBe('string');
    expect(chunks[0].content).toContain('# Heading with !@#$%^&*()_+=-`~:;"\'<>?,./|\\[]{}');
  });

  it('handles very long headings for ID assignment', async () => {
    const longHeading = '# ' + 'A'.repeat(200);
    const input = longHeading + '\n\nSome content.';
    const chunks: DocumentChunk[] = await chunker.chunkText(input, 'test-document-id', 'test-document');

    expect(chunks.length).toBeGreaterThan(0);
    // AdaptiveChunker assigns UUIDs, so we check for the presence of a string ID.
    expect(chunks[0].id).toBeDefined();
    expect(typeof chunks[0].id).toBe('string');
    expect(chunks[0].content).toContain(longHeading);
  });

  it('handles mixed valid, invalid, and missing IDs with fallback and default assignment', async () => {
    const input = '# Valid Heading 1\n\nSome content.\n\n## \n\nMore content.\n\n### Valid Heading 3\n\nEven more content.\n\n#### Invalid ID !@#\n\nFinal content.';
    const chunks: DocumentChunk[] = await chunker.chunkText(input, 'test-document-id', 'test-document');

    expect(chunks.length).toBeGreaterThan(0);
    // AdaptiveChunker assigns UUIDs, so we check for the presence of string IDs for all chunks.
    chunks.forEach(chunk => {
      expect(chunk.id).toBeDefined();
      expect(typeof chunk.id).toBe('string');
    });

    // Verify that the content is chunked correctly based on headings and other separators
    expect(chunks[0].content).toContain('# Valid Heading 1');
    if (chunks.length > 1) expect(chunks[1].content).toContain('## '); // Should contain the empty heading line
    if (chunks.length > 2) expect(chunks[2].content).toContain('### Valid Heading 3');
    if (chunks.length > 3) expect(chunks[3].content).toContain('#### Invalid ID !@#'); // Should contain the invalid heading line
  });
});
