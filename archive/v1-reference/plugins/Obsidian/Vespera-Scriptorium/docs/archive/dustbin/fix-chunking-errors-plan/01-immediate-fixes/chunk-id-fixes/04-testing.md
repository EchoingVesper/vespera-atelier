# Testing Chunk ID Fixes

This document outlines the testing procedures for verifying that the chunk ID fixes have been implemented correctly and are working as expected.

## Manual Testing

### Test 1: Basic Chunk ID Assignment

1. **Setup**:
   - Open the Vespera Scriptorium plugin in development mode
   - Enable debug logging in the developer console

2. **Action**:
   - Process a small document (1-2 pages)
   - Monitor the debug console for chunk creation logs

3. **Expected Result**:
   - No "Chunk ID missing during sorting" warnings should appear
   - Debug logs should show each chunk being assigned a unique ID
   - Document processing should complete successfully

### Test 2: Large Document Processing

1. **Setup**:
   - Prepare a large document (10+ pages) with complex formatting
   - Enable debug logging in the developer console

2. **Action**:
   - Process the large document
   - Monitor memory usage during processing

3. **Expected Result**:
   - No "Chunk ID missing during sorting" warnings should appear
   - Memory usage should remain stable during processing
   - Document should be processed successfully

### Test 3: Edge Case - Empty Document

1. **Setup**:
   - Prepare an empty document
   - Enable debug logging in the developer console

2. **Action**:
   - Process the empty document
   - Monitor the debug console for errors

3. **Expected Result**:
   - No errors or warnings should appear
   - Plugin should handle the empty document gracefully
   - Appropriate user feedback should be provided

## Automated Testing

If the project has a test suite, add the following tests:

### Unit Tests for sortChunksByPosition

```typescript
describe('sortChunksByPosition', () => {
  it('should sort chunks by position', () => {
    const chunks = [
      { id: 'chunk-2', position: 2, content: 'C' },
      { id: 'chunk-0', position: 0, content: 'A' },
      { id: 'chunk-1', position: 1, content: 'B' }
    ];
    
    const sorted = sortChunksByPosition(chunks);
    
    expect(sorted[0].content).toBe('A');
    expect(sorted[1].content).toBe('B');
    expect(sorted[2].content).toBe('C');
  });
  
  it('should handle chunks with missing IDs', () => {
    const chunks = [
      { position: 2, content: 'C' },
      { id: 'chunk-0', position: 0, content: 'A' },
      { position: 1, content: 'B' }
    ];
    
    const sorted = sortChunksByPosition(chunks);
    
    // Check that all chunks have IDs now
    expect(sorted.every(chunk => !!chunk.id)).toBe(true);
    
    // Check that the order is correct
    expect(sorted[0].content).toBe('A');
    expect(sorted[1].content).toBe('B');
    expect(sorted[2].content).toBe('C');
  });
  
  it('should handle chunks with missing positions', () => {
    const chunks = [
      { id: 'chunk-2', content: 'C' },
      { id: 'chunk-0', position: 0, content: 'A' },
      { id: 'chunk-1', content: 'B' }
    ];
    
    const sorted = sortChunksByPosition(chunks);
    
    // Chunks without positions should be treated as position 0
    // So the order should be determined by ID comparison as a tiebreaker
    expect(sorted[0].content).toBe('A'); // Has position 0
    // The exact order of B and C depends on how the tiebreaker works
  });
});
```

### Unit Tests for createChunks

```typescript
describe('createChunks', () => {
  it('should create chunks with unique IDs', () => {
    const text = 'This is a test document that should be split into chunks.';
    const options = { chunkSize: 5 }; // Or whatever options are appropriate
    
    const chunks = createChunks(text, options);
    
    // Check that all chunks have IDs
    expect(chunks.every(chunk => !!chunk.id)).toBe(true);
    
    // Check that IDs are unique
    const ids = chunks.map(chunk => chunk.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
  
  it('should handle empty text', () => {
    const text = '';
    const options = { chunkSize: 5 };
    
    const chunks = createChunks(text, options);
    
    // Should return an empty array or a single empty chunk
    if (chunks.length === 0) {
      expect(chunks).toEqual([]);
    } else {
      expect(chunks.length).toBe(1);
      expect(chunks[0].content).toBe('');
      expect(!!chunks[0].id).toBe(true);
    }
  });
  
  it('should assign sequential positions', () => {
    const text = 'This is a longer test document that should be split into multiple chunks.';
    const options = { chunkSize: 10 };
    
    const chunks = createChunks(text, options);
    
    // Check that positions are sequential
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].position).toBe(i);
    }
  });
});
```

## Integration Testing

For complete validation, perform the following integration tests:

1. **End-to-End Processing**:
   - Process a document from start to finish
   - Verify that the final output contains all the content from the original document
   - Check that no content is duplicated or missing

2. **Memory Usage Monitoring**:
   - Process several documents of increasing size
   - Monitor memory usage throughout processing
   - Verify that memory usage doesn't grow excessively with document size

3. **Plugin Restart Test**:
   - Process a document
   - Restart the plugin
   - Process the same document again
   - Verify that both processes produce identical results

## Documentation Updates

After testing, update the following documentation:

1. **Chunk Interface Documentation**: Document the `id` field as required
2. **Developer Guidelines**: Add a note about the importance of chunk IDs
3. **Troubleshooting Guide**: Add information about how to diagnose and fix chunk ID issues

## Return to [Chunk ID Fixes](./README.md)
