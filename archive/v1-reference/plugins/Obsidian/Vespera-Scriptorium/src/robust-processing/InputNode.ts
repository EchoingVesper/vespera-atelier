/**
 * Input Node
 * Orchestrates document loading, text extraction, and chunking.
 * @module InputNode
 */

import { DocumentChunk, ChunkMetadata, AdaptiveChunker, AdaptiveChunkingOptions } from './AdaptiveChunker';
import { v4 as uuidv4 } from 'uuid';

// Placeholder for different document type handling
// This might involve libraries like 'mammoth' for docx, 'pdf-parse' for pdf, etc.
// For now, we'll assume plain text or markdown.

export interface InputNodeOptions {
  // Options related to document loading, e.g., encoding
  // Options related to text extraction, e.g., OCR settings for PDFs (if applicable)
  chunkingOptions: Partial<AdaptiveChunkingOptions>;
}

export interface RawDocument {
  id: string;
  filePath?: string; // Optional, if content is directly provided
  content: string;   // Raw content, could be binary for some types before extraction
  sourceType: 'markdown' | 'pdf' | 'docx' | 'text' | 'html'; // Add more as needed
}

/**
 * Represents the output of the Input Node, which is an array of document chunks.
 */
export type InputNodeOutput = DocumentChunk[];

/**
 * The InputNode class is responsible for the initial stage of the document processing workflow.
 * It ingests raw document content, extracts text, and transforms it into structured DocumentChunk objects.
 */
export class InputNode {
  private options: InputNodeOptions;
  private adaptiveChunker: AdaptiveChunker;

  constructor(options: Partial<InputNodeOptions> = {}) {
    this.options = {
      chunkingOptions: {},
      ...options,
    };
    this.adaptiveChunker = new AdaptiveChunker(this.options.chunkingOptions);
  }

  /**
   * Loads a document from a given path or content.
   * This is a placeholder and would need actual implementation for different file types.
   * @param source - The path to the document file or the raw document content.
   * @returns A promise that resolves to the raw document content as a string.
   */
  private async loadDocument(source: string | Buffer, sourceType: RawDocument['sourceType']): Promise<string> {
    // Placeholder: In a real implementation, this would handle file reading
    // and potentially initial parsing based on sourceType.
    if (typeof source === 'string') {
      // If source is a file path, read it (e.g., using fs.readFile)
      // For now, assume it's already content if string
      console.log(`[InputNode] Loading document of type: ${sourceType}`);
      return source;
    } else if (Buffer.isBuffer(source)) {
      // If source is a buffer, convert to string (assuming UTF-8 or handle encoding)
      console.log(`[InputNode] Loading document from buffer of type: ${sourceType}`);
      return source.toString('utf-8');
    }
    throw new Error('Invalid document source provided.');
  }

  /**
   * Extracts text from the loaded document content.
   * This is a placeholder and would need specific extractors for PDF, DOCX, etc.
   * @param rawContent - The raw content of the document.
   * @param sourceType - The type of the source document.
   * @returns A promise that resolves to the extracted plain text.
   */
  private async extractText(rawContent: string, sourceType: RawDocument['sourceType']): Promise<string> {
    // Placeholder: Implement text extraction logic based on sourceType.
    // For 'markdown' or 'text', it might be a direct return.
    // For 'pdf', use pdf-parse.
    // For 'docx', use mammoth.
    console.log(`[InputNode] Extracting text from document of type: ${sourceType}`);
    switch (sourceType) {
      case 'markdown':
      case 'text':
      case 'html': // Basic HTML stripping, more robust parsing might be needed
        // For HTML, you might want to use a library to strip tags properly
        return rawContent.replace(/<[^>]*>?/gm, ''); // Simplistic HTML tag removal
      // Add cases for 'pdf', 'docx' with actual extraction logic
      default:
        console.warn(`[InputNode] Text extraction for ${sourceType} not yet implemented. Returning raw content.`);
        return rawContent;
    }
  }

  /**
   * Processes a raw document: loads, extracts text, and chunks it.
   * @param document - The raw document to process.
   * @returns A promise that resolves to an array of DocumentChunk objects.
   */
  public async processDocument(document: RawDocument): Promise<InputNodeOutput> {
    try {
      const loadedContent = await this.loadDocument(document.content, document.sourceType);
      const extractedText = await this.extractText(loadedContent, document.sourceType);
      
      // Use AdaptiveChunker for chunking
      // The documentId for chunking could be the rawDocument.id or a newly generated one if needed.
      // The sourceName could be document.filePath or a descriptive name.
      const chunks = await this.adaptiveChunker.chunkText(
        extractedText,
        document.id, // Using raw document ID as documentId for chunking
        document.filePath || `raw_input_${document.id}`, // Using filePath or a generated name as sourceName
        this.options.chunkingOptions
      );
      
      console.log(`[InputNode] Document ${document.id} processed into ${chunks.length} chunks.`);
      return chunks;
    } catch (error) {
      console.error(`[InputNode] Error processing document ${document.id}:`, error);
      // Implement robust error handling, e.g., return an empty array or throw a custom error
      throw error; 
    }
  }
}

// Example Usage (for testing purposes, can be removed or moved to an example file):
async function testInputNode() {
  const inputNode = new InputNode({
    chunkingOptions: {
      contextWindow: 4096,
      safetyMarginPercent: 10,
      minChunkSize: 100,
      maxChunkSize: 1000,
      promptOverhead: 200,
      contentAwareChunking: true,
    }
  });

  const sampleMarkdownDocument: RawDocument = {
    id: uuidv4(),
    filePath: 'sample.md',
    content: '# Title\n\nThis is a sample markdown document with multiple paragraphs.\n\nIt also has some **bold** text and *italic* text.\n\nAnother paragraph to ensure we have enough content for chunking. This paragraph is a bit longer to see how the chunker handles it. We need to make sure that the content is substantial enough to be split into multiple chunks if the chunk size is small enough. Let us add more sentences. And one more for good measure.',
    sourceType: 'markdown',
  };

  try {
    const chunks = await inputNode.processDocument(sampleMarkdownDocument);
    console.log('Generated Chunks:', JSON.stringify(chunks, null, 2));
  } catch (error) {
    console.error('Error during InputNode test:', error);
  }
}

// To run the test if this file is executed directly (e.g., node InputNode.js if compiled to JS)
// if (require.main === module) {
//   testInputNode();
// }