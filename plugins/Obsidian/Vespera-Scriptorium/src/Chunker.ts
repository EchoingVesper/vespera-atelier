/**
 * Chunker module
 * Splits text into manageable chunks for LLM processing.
 * @module Chunker
 */

import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

/**
 * Configuration options for text chunking
 */
export interface ChunkingOptions {
  /**
   * The size of each chunk in tokens (approximate)
   * @default 1000
   */
  chunkSize: number;
  
  /**
   * The number of tokens to overlap between chunks
   * @default 50
   */
  chunkOverlap: number;
  
  /**
   * The separators to use for splitting text
   * Default separators prioritize splitting at paragraph breaks, then sentences, etc.
   */
  separators?: string[];

  /**
   * The maximum context window size of the model
   * This is used to ensure chunks don't exceed the model's capacity
   * @default 4096
   */
  modelContextWindow?: number;

  /**
   * Estimated token overhead for prompts and system messages
   * This is subtracted from the modelContextWindow to determine the effective max chunk size
   * @default 500
   */
  promptOverhead?: number;
}

/**
 * Default chunking options
 */
export const DEFAULT_CHUNKING_OPTIONS: ChunkingOptions = {
  chunkSize: 1000,
  chunkOverlap: 50,
  modelContextWindow: 4096,
  promptOverhead: 500,
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
 * Splits text into chunks using LangChain's RecursiveCharacterTextSplitter.
 * This provides more intelligent chunking that respects natural text boundaries.
 *
 * @param text The input text to split into chunks
 * @param options Chunking options (size, overlap, separators)
 * @returns Promise resolving to an array of text chunks
 */
export async function splitTextIntoChunks(
  text: string,
  options: Partial<ChunkingOptions> = {}
): Promise<string[]> {
  // Merge provided options with defaults
  const mergedOptions = {
    ...DEFAULT_CHUNKING_OPTIONS,
    ...options
  };
  
  // Calculate the maximum safe chunk size based on model context window
  // This ensures chunks won't exceed the model's capacity when combined with prompts
  const maxSafeChunkSize = mergedOptions.modelContextWindow
    ? Math.min(mergedOptions.chunkSize, mergedOptions.modelContextWindow - (mergedOptions.promptOverhead || 500))
    : mergedOptions.chunkSize;
  
  // Create text splitter with specified options, ensuring chunk size is safe
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: maxSafeChunkSize,
    chunkOverlap: mergedOptions.chunkOverlap,
    separators: mergedOptions.separators
  });
  
  // Split the text into chunks
  const chunks = await splitter.splitText(text);
  
  return chunks;
}

/**
 * Simple character-based text chunker (legacy version).
 * Splits a string into chunks of a given character length without respecting text boundaries.
 *
 * @param text The input string to split
 * @param chunkSize The size of each chunk in characters
 * @returns Array of string chunks
 * @deprecated Use splitTextIntoChunks instead for more intelligent chunking
 */
export function chunkText(text: string, chunkSize: number): string[] {
  if (chunkSize <= 0) throw new Error('chunkSize must be positive');
  const result: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    result.push(text.slice(i, i + chunkSize));
  }
  return result;
}
