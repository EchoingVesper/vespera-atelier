# Testing Chunking Process

This document outlines the testing procedures for verifying that the refactored chunking process is working correctly and reliably. Comprehensive testing is essential to ensure that the chunking process is robust and properly handles all edge cases.

## Unit Testing

### 1. Chunker Class Tests

```typescript
describe('Chunker', () => {
  let chunker: Chunker;
  
  beforeEach(() => {
    chunker = new Chunker();
  });
  
  describe('chunkDocument', () => {
    it('should split document into chunks with correct IDs', () => {
      const document = 'This is a test document.\nIt has multiple lines.\nAnd paragraphs.\n\nThis is another paragraph.';
      
      const chunks = chunker.chunkDocument(document);
      
      // Check number of chunks
      expect(chunks.length).toBeGreaterThan(0);
      
      // Check that all chunks have IDs
      expect(chunks.every(chunk => !!chunk.id)).toBe(true);
      
      // Check that all chunks have content
      expect(chunks.every(chunk => !!chunk.content)).toBe(true);
      
      // Check that all chunks have positions
      expect(chunks.every(chunk => chunk.position !== undefined)).toBe(true);
    });
    
    it('should handle empty documents', () => {
      const document = '';
      
      const chunks = chunker.chunkDocument(document);
      
      // Should return a single empty chunk
      expect(chunks.length).toBe(1);
      expect(chunks[0].content).toBe('');
      expect(chunks[0].id).toBeTruthy();
    });
    
    it('should respect chunk size settings', () => {
      const document = 'A'.repeat(5000);
      const smallChunker = new Chunker({
        defaultOptions: {
          chunkSize: 1000,
          chunkOverlap: 0,
          strategy: 'fixed',
          preserveHeaders: true,
          respectCodeBlocks: true,
          minChunkSize: 100
        }
      });
      
      const largeChunker = new Chunker({
        defaultOptions: {
          chunkSize: 2000,
          chunkOverlap: 0,
          strategy: 'fixed',
          preserveHeaders: true,
          respectCodeBlocks: true,
          minChunkSize: 100
        }
      });
      
      const smallChunks = smallChunker.chunkDocument(document);
      const largeChunks = largeChunker.chunkDocument(document);
      
      // Small chunker should create more chunks than large chunker
      expect(smallChunks.length).toBeGreaterThan(largeChunks.length);
      
      // Verify chunk sizes
      expect(smallChunks.every(chunk => chunk.content.length <= 1000)).toBe(true);
      expect(largeChunks.every(chunk => chunk.content.length <= 2000)).toBe(true);
    });
  });
  
  describe('ensureChunkIds', () => {
    it('should add IDs to chunks that are missing them', () => {
      const chunks = [
        { content: 'Chunk 1', position: 0 },
        { id: 'existing-id', content: 'Chunk 2', position: 1 },
        { content: 'Chunk 3', position: 2 }
      ] as any[];
      
      const updatedChunks = chunker.ensureChunkIds(chunks);
      
      // All chunks should have IDs
      expect(updatedChunks.every(chunk => !!chunk.id)).toBe(true);
      
      // Existing ID should be preserved
      expect(updatedChunks[1].id).toBe('existing-id');
    });
  });
  
  describe('verifyChunkIds', () => {
    it('should detect missing and invalid IDs', () => {
      const chunks = [
        { id: 'valid-id-1', content: 'Chunk 1', position: 0 },
        { content: 'Chunk 2', position: 1 }, // Missing ID
        { id: 'invalid-format', content: 'Chunk 3', position: 2 } // Invalid format
      ] as any[];
      
      const result = chunker.verifyChunkIds(chunks);
      
      expect(result.isValid).toBe(false);
      expect(result.missingIds).toContain(1);
      expect(result.invalidIds.length).toBeGreaterThan(0);
    });
  });
});
```

### 2. ChunkIdGenerator Tests

```typescript
describe('ChunkIdGenerator', () => {
  let idGenerator: ChunkIdGenerator;
  
  beforeEach(() => {
    idGenerator = new ChunkIdGenerator();
  });
  
  describe('generateId', () => {
    it('should generate unique IDs for different content', () => {
      const id1 = idGenerator.generateId('Content 1', 0);
      const id2 = idGenerator.generateId('Content 2', 0);
      
      expect(id1).not.toBe(id2);
    });
    
    it('should generate unique IDs for the same content at different positions', () => {
      const id1 = idGenerator.generateId('Same content', 0);
      const id2 = idGenerator.generateId('Same content', 1);
      
      expect(id1).not.toBe(id2);
    });
    
    it('should include position information in the ID', () => {
      const id = idGenerator.generateId('Content', 42);
      
      // Position should be included in the ID
      expect(id).toContain('42');
    });
  });
  
  describe('generateDeterministicId', () => {
    it('should generate the same ID for the same content and position', () => {
      const id1 = idGenerator.generateDeterministicId('Content', 0);
      const id2 = idGenerator.generateDeterministicId('Content', 0);
      
      expect(id1).toBe(id2);
    });
    
    it('should generate different IDs for different content', () => {
      const id1 = idGenerator.generateDeterministicId('Content 1', 0);
      const id2 = idGenerator.generateDeterministicId('Content 2', 0);
      
      expect(id1).not.toBe(id2);
    });
  });
  
  describe('parsePosition', () => {
    it('should extract position information from ID', () => {
      const id = idGenerator.generateId('Content', 42);
      const position = idGenerator.parsePosition(id);
      
      expect(position).toBe(42);
    });
    
    it('should return -1 for invalid IDs', () => {
      const position = idGenerator.parsePosition('invalid-id');
      
      expect(position).toBe(-1);
    });
  });
  
  describe('isValidId', () => {
    it('should validate correct IDs', () => {
      const id = idGenerator.generateId('Content', 0);
      
      expect(idGenerator.isValidId(id)).toBe(true);
    });
    
    it('should reject invalid IDs', () => {
      expect(idGenerator.isValidId('invalid')).toBe(false);
      expect(idGenerator.isValidId('')).toBe(false);
      expect(idGenerator.isValidId('invalid-id')).toBe(false);
    });
  });
});
```

### 3. ChunkMetadataGenerator Tests

```typescript
describe('ChunkMetadataGenerator', () => {
  let metadataGenerator: ChunkMetadataGenerator;
  
  beforeEach(() => {
    metadataGenerator = new ChunkMetadataGenerator();
  });
  
  describe('generateMetadata', () => {
    it('should generate basic metadata fields', () => {
      const content = 'Test content';
      const metadata = metadataGenerator.generateMetadata(content, 0, 1);
      
      expect(metadata.chunkIndex).toBe(0);
      expect(metadata.totalChunks).toBe(1);
      expect(metadata.chunkLength).toBe(content.length);
      expect(metadata.contentHash).toBeTruthy();
      expect(metadata.timestamp).toBeTruthy();
      expect(metadata.processingStatus).toBe('pending');
    });
    
    it('should properly analyze content types', () => {
      const textContent = 'Plain text content';
      const codeContent = '```javascript\nfunction test() {\n  return true;\n}\n```';
      const headerContent = '# Header\n\nContent';
      const mixedContent = '# Header\n\n```javascript\nfunction test() {}\n```';
      
      const textMetadata = metadataGenerator.generateMetadata(textContent, 0, 1);
      const codeMetadata = metadataGenerator.generateMetadata(codeContent, 0, 1);
      const headerMetadata = metadataGenerator.generateMetadata(headerContent, 0, 1);
      const mixedMetadata = metadataGenerator.generateMetadata(mixedContent, 0, 1);
      
      // Check content type detection
      expect(textMetadata.containsCode).toBe(false);
      expect(textMetadata.containsHeaders).toBe(false);
      expect(textMetadata.contentType).toBe('text');
      
      expect(codeMetadata.containsCode).toBe(true);
      expect(codeMetadata.containsHeaders).toBe(false);
      expect(codeMetadata.contentType).toBe('code');
      
      expect(headerMetadata.containsCode).toBe(false);
      expect(headerMetadata.containsHeaders).toBe(true);
      expect(headerMetadata.contentType).toBe('headers');
      
      expect(mixedMetadata.containsCode).toBe(true);
      expect(mixedMetadata.containsHeaders).toBe(true);
      expect(mixedMetadata.contentType).toBe('mixed');
    });
    
    it('should add chunk relationships', () => {
      const getChunkId = (index: number) => `test-chunk-${index}`;
      
      const metadata = metadataGenerator.generateMetadata('Content', 1, 3, {
        getChunkId
      });
      
      expect(metadata.previousChunkId).toBe('test-chunk-0');
      expect(metadata.nextChunkId).toBe('test-chunk-2');
    });
    
    it('should not add previousChunkId for first chunk', () => {
      const metadata = metadataGenerator.generateMetadata('Content', 0, 3);
      
      expect(metadata.previousChunkId).toBeUndefined();
      expect(metadata.nextChunkId).toBeDefined();
    });
    
    it('should not add nextChunkId for last chunk', () => {
      const metadata = metadataGenerator.generateMetadata('Content', 2, 3);
      
      expect(metadata.previousChunkId).toBeDefined();
      expect(metadata.nextChunkId).toBeUndefined();
    });
  });
  
  describe('updateMetadata', () => {
    it('should update processing status', () => {
      const metadata = metadataGenerator.generateMetadata('Content', 0, 1);
      const updatedMetadata = metadataGenerator.updateMetadata(metadata, {
        processingStatus: 'completed'
      });
      
      expect(updatedMetadata.processingStatus).toBe('completed');
    });
    
    it('should update processing time', () => {
      const metadata = metadataGenerator.generateMetadata('Content', 0, 1);
      const updatedMetadata = metadataGenerator.updateMetadata(metadata, {
        processingTime: 1000
      });
      
      expect(updatedMetadata.processingTime).toBe(1000);
    });
    
    it('should update custom properties', () => {
      const metadata = metadataGenerator.generateMetadata('Content', 0, 1);
      const updatedMetadata = metadataGenerator.updateMetadata(metadata, {
        customProperties: {
          customField: 'value'
        }
      });
      
      expect(updatedMetadata.customField).toBe('value');
    });
  });
});
```

### 4. Chunking Strategies Tests

```typescript
describe('ChunkingStrategies', () => {
  describe('RecursiveChunkingStrategy', () => {
    const strategy = new RecursiveChunkingStrategy();
    
    it('should split documents by paragraphs when possible', () => {
      const document = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
      const options = { chunkSize: 100, chunkOverlap: 0 } as ChunkerOptions;
      
      const chunks = strategy.splitDocument(document, options);
      
      expect(chunks.length).toBe(3);
      expect(chunks[0]).toBe('First paragraph.');
      expect(chunks[1]).toBe('Second paragraph.');
      expect(chunks[2]).toBe('Third paragraph.');
    });
    
    it('should split large paragraphs', () => {
      const document = 'A'.repeat(1000);
      const options = { chunkSize: 500, chunkOverlap: 0 } as ChunkerOptions;
      
      const chunks = strategy.splitDocument(document, options);
      
      expect(chunks.length).toBe(2);
      expect(chunks[0].length).toBe(500);
      expect(chunks[1].length).toBe(500);
    });
    
    it('should handle chunk overlap correctly', () => {
      const document = 'A'.repeat(1000);
      const options = { chunkSize: 500, chunkOverlap: 100 } as ChunkerOptions;
      
      const chunks = strategy.splitDocument(document, options);
      
      expect(chunks.length).toBe(3);
      
      // Check overlaps
      const last100ofFirst = chunks[0].substring(chunks[0].length - 100);
      const first100ofSecond = chunks[1].substring(0, 100);
      
      expect(last100ofFirst).toBe(first100ofSecond);
    });
  });
  
  describe('LangChainChunkingStrategy', () => {
    const strategy = new LangChainChunkingStrategy();
    
    // Mock LangChain for testing
    beforeEach(() => {
      jest.mock('langchain/text_splitter', () => ({
        RecursiveCharacterTextSplitter: jest.fn().mockImplementation(() => ({
          splitText: (text: string) => [
            text.substring(0, Math.floor(text.length / 2)),
            text.substring(Math.floor(text.length / 2))
          ]
        }))
      }));
    });
    
    it('should delegate to LangChain splitter', () => {
      const document = 'Text for LangChain splitter';
      const options = { chunkSize: 100, chunkOverlap: 0 } as ChunkerOptions;
      
      const chunks = strategy.splitDocument(document, options);
      
      expect(chunks.length).toBe(2);
      expect(chunks[0].length + chunks[1].length).toBe(document.length);
    });
    
    it('should fall back to recursive strategy on error', () => {
      // Make LangChain throw an error
      jest.mock('langchain/text_splitter', () => ({
        RecursiveCharacterTextSplitter: jest.fn().mockImplementation(() => ({
          splitText: () => { throw new Error('LangChain error'); }
        }))
      }));
      
      const document = 'Text for fallback';
      const options = { chunkSize: 100, chunkOverlap: 0 } as ChunkerOptions;
      
      const chunks = strategy.splitDocument(document, options);
      
      // Should still return chunks despite error
      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});
```

## Integration Testing

### 1. End-to-End Chunking Process Test

```typescript
describe('ChunkingProcess', () => {
  let plugin: VesperaScriptoriumPlugin;
  
  beforeEach(() => {
    plugin = new VesperaScriptoriumPlugin();
    // Initialize plugin...
  });
  
  it('should process a document from start to finish', async () => {
    // Create a test document
    const document = '# Test Document\n\nThis is a test document with multiple paragraphs.\n\n## Second Section\n\nSecond paragraph.';
    
    // Mock file
    const file = {
      path: 'test.md',
      name: 'test.md',
      basename: 'test',
      extension: 'md'
    } as TFile;
    
    // Mock vault read
    jest.spyOn(plugin.app.vault, 'read').mockResolvedValue(document);
    
    // Process the file
    await plugin.processFile(file);
    
    // Verify that chunks were created
    expect(plugin.processedChunks.length).toBeGreaterThan(0);
    
    // Verify that all chunks have valid IDs
    expect(plugin.processedChunks.every(chunk => !!chunk.id)).toBe(true);
    
    // Verify that all chunks have metadata
    expect(plugin.processedChunks.every(chunk => !!chunk.metadata)).toBe(true);
    
    // Verify that the assembled document was created
    expect(plugin.assembledDocument).toBeTruthy();
    
    // Verify that the assembled document contains all original content
    expect(plugin.assembledDocument.includes('Test Document')).toBe(true);
    expect(plugin.assembledDocument.includes('Second Section')).toBe(true);
  });
  
  it('should handle large documents without memory issues', async () => {
    // Create a large test document
    const document = 'A'.repeat(100000);
    
    // Mock file
    const file = {
      path: 'large.md',
      name: 'large.md',
      basename: 'large',
      extension: 'md'
    } as TFile;
    
    // Mock vault read
    jest.spyOn(plugin.app.vault, 'read').mockResolvedValue(document);
    
    // Process the file
    await plugin.processFile(file);
    
    // Verify that chunks were created
    expect(plugin.processedChunks.length).toBeGreaterThan(0);
    
    // Verify that all chunks have valid IDs
    expect(plugin.processedChunks.every(chunk => !!chunk.id)).toBe(true);
    
    // Check memory usage (this is a basic check, more sophisticated memory profiling may be needed)
    const memoryUsage = process.memoryUsage().heapUsed;
    expect(memoryUsage).toBeLessThan(200 * 1024 * 1024); // Less than 200MB
  });
  
  it('should handle documents with special Markdown content', async () => {
    // Create a document with code blocks, headers, lists, tables, etc.
    const document = `
# Test Document with Special Content

## Code Blocks

\`\`\`javascript
function test() {
  return true;
}
\`\`\`

## Lists

- Item 1
- Item 2
  - Sub-item

## Tables

| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |
`;
    
    // Mock file
    const file = {
      path: 'special.md',
      name: 'special.md',
      basename: 'special',
      extension: 'md'
    } as TFile;
    
    // Mock vault read
    jest.spyOn(plugin.app.vault, 'read').mockResolvedValue(document);
    
    // Process the file
    await plugin.processFile(file);
    
    // Verify that chunks were created
    expect(plugin.processedChunks.length).toBeGreaterThan(0);
    
    // Verify that special content was preserved
    const assembledContent = plugin.assembledDocument;
    
    expect(assembledContent.includes('```javascript')).toBe(true);
    expect(assembledContent.includes('function test()')).toBe(true);
    expect(assembledContent.includes('- Item 1')).toBe(true);
    expect(assembledContent.includes('| Header 1 | Header 2 |')).toBe(true);
  });
});
```

### 2. Memory Usage Testing

```typescript
describe('MemoryUsage', () => {
  let chunker: Chunker;
  
  beforeEach(() => {
    chunker = new Chunker();
  });
  
  it('should handle very large documents without excessive memory usage', () => {
    // Create a very large document
    const document = 'A'.repeat(1000000);
    
    // Record starting memory
    const startMemory = process.memoryUsage().heapUsed;
    
    // Process the document
    const chunks = chunker.chunkDocument(document);
    
    // Record ending memory
    const endMemory = process.memoryUsage().heapUsed;
    
    // Calculate memory usage
    const memoryUsage = endMemory - startMemory;
    
    // Memory usage should be less than 10x the document size
    expect(memoryUsage).toBeLessThan(document.length * 10);
    
    // Chunks should be created
    expect(chunks.length).toBeGreaterThan(0);
    
    // All content should be preserved
    const reassembled = chunks.map(chunk => chunk.content).join('');
    expect(reassembled.length).toBe(document.length);
  });
  
  it('should clean up resources after processing', () => {
    // Create a document
    const document = 'A'.repeat(100000);
    
    // Process multiple times to check for memory leaks
    for (let i = 0; i < 10; i++) {
      const chunks = chunker.chunkDocument(document);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }
    
    // Memory usage should remain stable
    const memoryUsage = process.memoryUsage().heapUsed;
    expect(memoryUsage).toBeLessThan(200 * 1024 * 1024); // Less than 200MB
  });
});
```

## Manual Testing

### 1. Test with Various Document Types

Test the chunking process with the following document types:

1. **Simple Text Documents** - Basic markdown with paragraphs, headers, and lists
2. **Complex Markdown Documents** - Documents with tables, code blocks, and nested structures
3. **Large Documents** - Documents over 100KB to test performance and memory usage
4. **Special Character Documents** - Documents with non-ASCII characters, emojis, etc.
5. **Code-heavy Documents** - Documents with multiple code blocks and technical content
6. **Mixed Content Documents** - Documents with a mix of text, code, headers, tables, etc.

### 2. Test with Edge Cases

Test the chunking process with the following edge cases:

1. **Empty Documents** - Documents with no content
2. **Single-Character Documents** - Documents with just one character
3. **Line Break Documents** - Documents consisting mostly of line breaks
4. **Repeated Content Documents** - Documents with the same content repeated many times
5. **Malformed Markdown Documents** - Documents with incomplete markdown syntax
6. **Very Long Lines** - Documents with very long lines without breaks

### 3. Test with Real-World Scenarios

Test the chunking process in the following real-world scenarios:

1. **User Workflow Testing** - Process documents as a user would, from selection to final output
2. **Interrupt and Resume** - Interrupt processing and resume to test recovery
3. **Mixed Document Processing** - Process multiple documents of different types in succession
4. **Repeated Processing** - Process the same document multiple times to check for stability
5. **Concurrent Processing** - Process multiple documents concurrently to check for isolation

## Performance Testing

### 1. Chunking Speed Benchmarks

```typescript
// Benchmark test
describe('Performance', () => {
  let chunker: Chunker;
  
  beforeEach(() => {
    chunker = new Chunker();
  });
  
  it('should chunk documents within reasonable time', () => {
    // Document sizes to test
    const sizes = [1000, 10000, 100000, 1000000];
    
    // Run benchmarks
    const results = sizes.map(size => {
      const document = 'A'.repeat(size);
      
      const startTime = performance.now();
      const chunks = chunker.chunkDocument(document);
      const endTime = performance.now();
      
      return {
        size,
        time: endTime - startTime,
        chunks: chunks.length
      };
    });
    
    // Log results
    console.table(results);
    
    // Check that processing time scales linearly with document size
    const timePerChar = results.map(r => r.time / r.size);
    
    // Calculate standard deviation
    const mean = timePerChar.reduce((sum, val) => sum + val, 0) / timePerChar.length;
    const variance = timePerChar.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / timePerChar.length;
    const stdDev = Math.sqrt(variance);
    
    // Standard deviation should be low (consistent time per character)
    expect(stdDev / mean).toBeLessThan(0.5);
  });
  
  it('should compare different chunking strategies', () => {
    // Document to test
    const document = 'A'.repeat(100000);
    
    // Strategies to test
    const strategies = ['recursive', 'langchain', 'fixed', 'paragraph', 'sentence'];
    
    // Run benchmarks
    const results = strategies.map(strategy => {
      const customChunker = new Chunker({
        defaultOptions: {
          chunkSize: 1000,
          chunkOverlap: 100,
          strategy,
          preserveHeaders: true,
          respectCodeBlocks: true,
          minChunkSize: 100
        }
      });
      
      const startTime = performance.now();
      const chunks = customChunker.chunkDocument(document);
      const endTime = performance.now();
      
      return {
        strategy,
        time: endTime - startTime,
        chunks: chunks.length
      };
    });
    
    // Log results
    console.table(results);
    
    // All strategies should complete within a reasonable time
    results.forEach(result => {
      expect(result.time).toBeLessThan(5000); // Less than 5 seconds
    });
  });
});
```

### 2. Memory Usage Profiling

To effectively profile memory usage, use a memory profiling tool like Node.js's built-in heap profiler or a third-party tool like `clinic.js`. Here's a basic approach for manual profiling:

1. Create a test script that processes documents of increasing size
2. Run the script with Node.js's `--inspect` flag
3. Open Chrome DevTools and connect to the Node.js process
4. Take heap snapshots before and after processing
5. Analyze the memory allocation and look for leaks

## Documentation Updates

After testing, update the following documentation:

1. **Chunker API Documentation**: Document the new Chunker class and its methods
2. **ChunkIdGenerator Documentation**: Document the ID generation strategies
3. **ChunkMetadataGenerator Documentation**: Document the metadata fields and usage
4. **Testing Guide**: Create a testing guide for future developers
5. **Performance Guide**: Document performance characteristics and optimization tips

## Return to [Chunking Process](./README.md)
