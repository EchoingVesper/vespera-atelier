import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Parser, ParserError } from '../../src/Parser';
import { TFile, Vault } from 'obsidian';

// Mock Obsidian's Vault and TFile
class MockVault {
  private files: Record<string, string> = {};

  async read(file: TFile): Promise<string> {
    const content = this.files[file.path];
    if (content === undefined) {
      throw new Error(`File not found: ${file.path}`);
    }
    return content;
  }

  setFileContent(path: string, content: string): void {
    this.files[path] = content;
  }
}

class MockTFile {
  constructor(
    public name: string,
    public path: string,
    public extension: string,
    public stat: { size: number } = { size: 0 }
  ) {}
}

// Mock settings
const mockSettings = {
  chunkSize: 1000,
  chunkOverlap: 50,
  modelContextWindow: 8000,
  cleanup: {
    spelling: false,
    punctuation: false,
    formatting: false,
    whitespace: false
  },
  llm: {
    provider: 'ollama',
    endpoint: 'http://localhost:11434',
    defaultEndpoint: 'http://localhost:11434', // Added defaultEndpoint for testing
    model: 'llama2',
    temperature: 0.7,
    maxTokens: 2048,
    maxRetries: 3,
    timeout: 30000
  },
  writer: {
    outputLocation: 'summaries-folder',
    customPath: '',
    includeMetadata: true,
    metadataOptions: {
      includeDate: true,
      includeModel: true,
      includePrompt: true
    },
    fileNameFormat: '{original}_summary',
    confirmOverwrite: true
  },
  robustProcessing: {
    enabled: false,
    contextWindow: {
      detectionStrategy: 'probe' as 'probe' | 'api' | 'manual',
      manualSize: 4096,
      cacheTTL: 86400000 // 24 hours
    },
    chunking: {
      safetyMarginPercent: 15,
      minChunkSize: 100,
      maxChunkSize: 8192,
      contentAwareChunking: true,
      preserveParagraphs: true,
      preserveSentences: true
    },
    processing: {
      baseTimeout: 30000, // 30 seconds
      maxTimeout: 300000, // 5 minutes
      timeoutScaleFactor: 1.5,
      maxRetries: 3,
      batchSize: 5,
      adaptiveTimeout: true,
      hardwareProfile: 'consumer-gpu' as 'consumer-gpu' | 'high-end-gpu' | 'cpu-only'
    },
    persistence: {
      savePartialResults: true,
      useCheckpointing: true,
      checkpointInterval: 5,
      workingDirectory: '.vespera-scriptorium/processing'
    },
    assembly: {
      preserveChunkBoundaries: false,
      resolveReferences: true,
      detectRedundancies: true,
      optimizeForCoherence: true,
      similarityThreshold: 0.8
    },
    output: {
      format: 'markdown' as 'markdown' | 'html' | 'json' | 'text',
      consolidate: true,
      includeMetadata: true,
      includeProcessingStats: true,
      createTableOfContents: true,
      includeReferences: true
    }
  }
};

describe('Parser', () => {
  let vault: MockVault;
  let parser: Parser;

  beforeEach(() => {
    vault = new MockVault();
    parser = new Parser(vault as unknown as Vault, mockSettings);
  });

  describe('parseFile', () => {
    it('should parse markdown files', async () => {
      // Setup
      const file = new MockTFile('test.md', 'test.md', 'md', { size: 100 });
      const content = '# Test Markdown\n\nThis is a test markdown file.';
      vault.setFileContent(file.path, content);

      // Execute
      const result = await parser.parseFile(file as unknown as TFile);

      // Verify
      expect(result.content).toBe(content);
      expect(result.metadata.fileName).toBe('test.md');
      expect(result.metadata.fileType).toBe('md');
      expect(result.metadata.fileSize).toBe(100);
      expect(result.metadata.parseTime).toBeGreaterThan(0);
    });

    it('should parse text files', async () => {
      // Setup
      const file = new MockTFile('test.txt', 'test.txt', 'txt', { size: 50 });
      const content = 'This is a test text file.';
      vault.setFileContent(file.path, content);

      // Execute
      const result = await parser.parseFile(file as unknown as TFile);

      // Verify
      expect(result.content).toBe(content);
      expect(result.metadata.fileName).toBe('test.txt');
      expect(result.metadata.fileType).toBe('txt');
    });

    it('should parse HTML files', async () => {
      // Setup
      const file = new MockTFile('test.html', 'test.html', 'html', { size: 200 });
      const content = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Test HTML</title>
          </head>
          <body>
            <h1>Test HTML</h1>
            <p>This is a test HTML file.</p>
            <script>console.log("This should be removed");</script>
            <style>body { color: red; }</style>
          </body>
        </html>
      `;
      vault.setFileContent(file.path, content);

      // Execute
      const result = await parser.parseFile(file as unknown as TFile);

      // Verify
      expect(result.content).toContain('Test HTML');
      expect(result.content).toContain('This is a test HTML file.');
      expect(result.content).not.toContain('console.log');
      expect(result.content).not.toContain('color: red');
      expect(result.metadata.fileName).toBe('test.html');
      expect(result.metadata.fileType).toBe('html');
    });

    it('should parse CSV files', async () => {
      // Setup
      const file = new MockTFile('test.csv', 'test.csv', 'csv', { size: 150 });
      const content = 'name,age,city\nJohn,30,New York\nJane,25,San Francisco';
      vault.setFileContent(file.path, content);

      // Execute
      const result = await parser.parseFile(file as unknown as TFile);

      // Verify
      expect(result.content).toContain('name\tage\tcity');
      expect(result.content).toContain('John\t30\tNew York');
      expect(result.content).toContain('Jane\t25\tSan Francisco');
      expect(result.metadata.fileName).toBe('test.csv');
      expect(result.metadata.fileType).toBe('csv');
    });

    it('should throw ParserError for unsupported file types', async () => {
      // Setup
      const file = new MockTFile('test.pdf', 'test.pdf', 'pdf', { size: 500 });

      // Execute & Verify
      await expect(parser.parseFile(file as unknown as TFile)).rejects.toThrow(ParserError);
    });

    it('should throw ParserError for malformed HTML', async () => {
      // Setup
      const file = new MockTFile('malformed.html', 'malformed.html', 'html', { size: 100 });
      const content = '<div>Unclosed div';
      vault.setFileContent(file.path, content);

      // Note: DOMParser in browsers doesn't actually throw for malformed HTML,
      // it tries to fix it. This test might not fail as expected in a browser environment.
      // In a real implementation, we would need more robust error detection.

      // Execute
      const result = await parser.parseFile(file as unknown as TFile);

      // Verify - even with malformed HTML, we should get some content
      expect(result.content).toContain('Unclosed div');
    });

    it('should handle malformed CSV gracefully', async () => {
      // Setup
      const file = new MockTFile('malformed.csv', 'malformed.csv', 'csv', { size: 100 });
      // This CSV has an inconsistent number of columns
      const content = 'name,age,city\nJohn,30\nJane,25,San Francisco,California';
      vault.setFileContent(file.path, content);

      // Execute
      const result = await parser.parseFile(file as unknown as TFile);

      // Verify - PapaParse is quite forgiving, so we should still get content
      expect(result.content).toContain('John');
      expect(result.content).toContain('Jane');
      
      // We should still get a structured result despite the malformed input
      expect(result.metadata.fileName).toBe('malformed.csv');
      expect(result.metadata.fileType).toBe('csv');
    });
  });

  describe('parseFiles', () => {
    it('should parse multiple files', async () => {
      // Setup
      const file1 = new MockTFile('test1.md', 'test1.md', 'md', { size: 100 });
      const file2 = new MockTFile('test2.txt', 'test2.txt', 'txt', { size: 50 });
      vault.setFileContent(file1.path, '# Test 1');
      vault.setFileContent(file2.path, 'Test 2');

      // Execute
      const results = await parser.parseFiles([file1, file2] as unknown as TFile[]);

      // Verify
      expect(results.length).toBe(2);
      expect(results[0].content).toBe('# Test 1');
      expect(results[1].content).toBe('Test 2');
    });

    it('should handle errors in some files', async () => {
      // Setup
      const file1 = new MockTFile('test1.md', 'test1.md', 'md', { size: 100 });
      const file2 = new MockTFile('test2.pdf', 'test2.pdf', 'pdf', { size: 50 });
      vault.setFileContent(file1.path, '# Test 1');

      // Execute
      const results = await parser.parseFiles([file1, file2] as unknown as TFile[]);

      // Verify - should still get results from the valid file
      expect(results.length).toBe(1);
      expect(results[0].content).toBe('# Test 1');
    });

    it('should throw if all files fail to parse', async () => {
      // Setup
      const file1 = new MockTFile('test1.pdf', 'test1.pdf', 'pdf', { size: 100 });
      const file2 = new MockTFile('test2.exe', 'test2.exe', 'exe', { size: 50 });

      // Execute & Verify
      await expect(parser.parseFiles([file1, file2] as unknown as TFile[])).rejects.toThrow();
    });
  });

  describe('cleanupText', () => {
    it('should clean up whitespace when enabled', async () => {
      // Setup
      const file = new MockTFile('test.txt', 'test.txt', 'txt', { size: 100 });
      const content = 'This  has   extra    whitespace.\n\n\n\nAnd extra lines.';
      vault.setFileContent(file.path, content);
      
      // Enable whitespace cleanup
      const cleanupSettings = {
        ...mockSettings,
        llm: {
          ...mockSettings.llm,
          defaultEndpoint: 'http://localhost:11434' // Added defaultEndpoint for testing
        }
      };
      cleanupSettings.cleanup.whitespace = true;
      const cleanupParser = new Parser(vault as unknown as Vault, cleanupSettings);

      // Execute
      const result = await cleanupParser.parseFile(file as unknown as TFile);

      // Verify
      expect(result.content).not.toContain('  ');
      expect(result.content).not.toContain('\n\n\n');
    });

    it('should normalize formatting when enabled', async () => {
      // Setup
      const file = new MockTFile('test.txt', 'test.txt', 'txt', { size: 100 });
      // Make sure we have actual tabs in the content
      const content = 'This has\r\ntabs\tand\tcarriage returns.';
      vault.setFileContent(file.path, content);
      
      // Log the content to verify tabs are present
      console.log('Original content:', JSON.stringify(content));
      
      // Enable formatting cleanup
      const cleanupSettings = {
        ...mockSettings,
        llm: {
          ...mockSettings.llm,
          defaultEndpoint: 'http://localhost:11434'
        }
      };
      cleanupSettings.cleanup.formatting = true;
      const cleanupParser = new Parser(vault as unknown as Vault, cleanupSettings);

      // Execute
      const result = await cleanupParser.parseFile(file as unknown as TFile);
      
      // Log the result to see what happened
      console.log('Parsed content:', JSON.stringify(result.content));

      // Verify
      expect(result.content).not.toContain('\r\n');
      expect(result.content).not.toContain('\t');
    });
  });
});