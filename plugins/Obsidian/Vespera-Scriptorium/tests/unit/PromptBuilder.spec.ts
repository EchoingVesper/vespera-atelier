import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PromptBuilder,
  PromptConfig,
  PromptBuilderInput,
} from '../../src/PromptBuilder'; // Adjust path as necessary
import { DocumentChunk } from '../../src/robust-processing/AdaptiveChunker'; // Adjust path
import { StringOutputParser } from '@langchain/core/output_parsers';

describe('PromptBuilder', () => {
  let promptBuilder: PromptBuilder;

  const mockDocumentChunk: DocumentChunk = {
    id: 'mock-chunk-id-123',
    content: 'This is a test document chunk.',
    metadata: {
      id: 'mock-chunk-metadata-id-456', // Matches DocumentChunk.id for consistency if needed
      deterministicId: 'deterministic-mock-id-789',
      chunkNumber: 1, // Typically 1-based for user display
      index: 0, // Typically 0-based for array indexing
      totalChunks: 1,
      sourceDocument: 'test.md',
      startPosition: 0,
      endPosition: 30, // Length of 'This is a test document chunk.'
      precedingContext: 'Previous context.',
      followingContext: 'Following context.',
      estimatedTokens: 7, // Rough estimate for the content
      timestamp: Date.now(),
      custom: { testKey: 'testValue' },
    },
  };

  const stringPromptConfig: PromptConfig = {
    id: 'testStringPrompt',
    name: 'Test String Prompt',
    description: 'A test prompt that outputs a string.',
    templateType: 'string',
    templateString:
      'Summarize this: {document_chunk}\nInstructions: {user_instructions}\nFormat: {format_instructions}',
    inputVariables: ['document_chunk', 'user_instructions', 'format_instructions'],
    outputParser: new StringOutputParser(),
  };

  const chatPromptConfig: PromptConfig = {
    id: 'testChatPrompt',
    name: 'Test Chat Prompt',
    description: 'A test prompt that outputs chat messages.',
    templateType: 'chat',
    messages: [
      { role: 'system', content: 'You are a helpful assistant. Format: {format_instructions}' },
      { role: 'user', content: 'Document: {document_chunk}\nUser needs: {user_instructions}' },
    ],
    inputVariables: ['document_chunk', 'user_instructions', 'format_instructions'],
    outputParser: new StringOutputParser(), // For format_instructions
  };
  
  const fewShotPromptConfig: PromptConfig = {
    id: 'testFewShotPrompt',
    name: 'Test Few Shot Prompt',
    description: 'A test few-shot prompt.',
    templateType: 'string',
    templateString: 'Based on the examples, complete the task for: {query}.',
    inputVariables: ['query', 'format_instructions'], // format_instructions might be part of the prefix
    fewShotExamples: [
      { query: 'example1', answer: 'result1' },
      { query: 'example2', answer: 'result2' },
    ],
    outputParser: new StringOutputParser(),
  };

  beforeEach(() => {
    promptBuilder = new PromptBuilder([stringPromptConfig, chatPromptConfig, fewShotPromptConfig]);
  });

  it('should register a prompt config', () => {
    const newConfig: PromptConfig = {
      id: 'newTestPrompt',
      name: 'New Test Prompt',
      description: 'Another test prompt.',
      templateType: 'string',
      templateString: 'Content: {content}',
      inputVariables: ['content'],
    };
    promptBuilder.registerPromptConfig(newConfig);
    expect(promptBuilder.getPromptConfig('newTestPrompt')).toEqual(newConfig);
  });

  it('should build a string prompt correctly', async () => {
    const input: PromptBuilderInput = {
      documentChunk: mockDocumentChunk,
      userInstructions: 'Be concise.',
    };
    const result = await promptBuilder.buildPrompt('testStringPrompt', input);
    
    const formatInstructions = await stringPromptConfig.outputParser!.getFormatInstructions();

    expect(typeof result.prompt).toBe('string');
    expect(result.prompt).toContain(mockDocumentChunk.content);
    expect(result.prompt).toContain('Be concise.');
    expect(result.prompt).toContain(formatInstructions);
    expect(result.inputVariables.document_chunk).toBe(mockDocumentChunk.content);
    expect(result.inputVariables.user_instructions).toBe('Be concise.');
  });

  it('should build a chat prompt correctly', async () => {
    const input: PromptBuilderInput = {
      documentChunk: mockDocumentChunk,
      userInstructions: 'Provide a bullet list.',
    };
    const result = await promptBuilder.buildPrompt('testChatPrompt', input);

    expect(typeof result.prompt).toBe('string');
    // Check that the string prompt contains parts of the template and inputs
    expect(result.prompt).toContain('You are a helpful assistant.'); // System message part
    expect(result.prompt).toContain(mockDocumentChunk.content); // User message part with document
    expect(result.prompt).toContain('Provide a bullet list.'); // User message part with instructions
    expect(result.inputVariables.document_chunk).toBe(mockDocumentChunk.content);
    expect(result.inputVariables.user_instructions).toBe('Provide a bullet list.');
    expect(result.inputVariables.format_instructions).toBeDefined();
  });
  
  it('should build a few-shot prompt correctly', async () => {
    const input: PromptBuilderInput = {
      query: 'main_query',
    };
    const result = await promptBuilder.buildPrompt('testFewShotPrompt', input);
    const formatInstructions = await fewShotPromptConfig.outputParser!.getFormatInstructions();

    expect(typeof result.prompt).toBe('string');
    expect(result.prompt).toContain('example1: result1');
    expect(result.prompt).toContain('example2: result2');
    expect(result.prompt).toContain('Based on the examples, complete the task for: main_query.');
    expect(result.prompt).toContain(formatInstructions);
    expect(result.inputVariables.query).toBe('main_query');
  });

  it('should throw an error if prompt config is not found', async () => {
    const input: PromptBuilderInput = { userInstructions: 'test' };
    await expect(
      promptBuilder.buildPrompt('nonExistentPrompt', input)
    ).rejects.toThrow("Prompt config with ID 'nonExistentPrompt' not found.");
  });
  
  it('should handle missing non-critical input variables gracefully', async () => {
    const config: PromptConfig = {
      id: 'partialInputTest',
      name: 'Partial Input Test',
      description: 'Tests handling of missing optional inputs.',
      templateType: 'string',
      templateString: 'Required: {required_var}, Optional: {optional_var}',
      inputVariables: ['required_var', 'optional_var', 'format_instructions'], // format_instructions is often implicitly handled
      outputParser: new StringOutputParser(),
    };
    promptBuilder.registerPromptConfig(config);
    
    const input: PromptBuilderInput = {
      required_var: 'This is required.',
      // optional_var is missing
    };
    
    // Suppress console.warn for this test
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    const result = await promptBuilder.buildPrompt('partialInputTest', input);
    const formatInstructions = await config.outputParser!.getFormatInstructions();

    expect(result.prompt).toContain('Required: This is required.');
    expect(result.prompt).toContain('Optional: {optional_var}'); // Unfilled variable remains
    expect(result.prompt).toContain(formatInstructions);
    expect(result.inputVariables.required_var).toBe('This is required.');
    expect(result.inputVariables.optional_var).toBeUndefined(); // Or handle as empty string depending on PromptBuilder logic
    
    warnSpy.mockRestore(); // Restore console.warn
  });

  it('should include format_instructions from outputParser', async () => {
    const input: PromptBuilderInput = {
      documentChunk: mockDocumentChunk,
      userInstructions: 'Test instructions',
    };
    const result = await promptBuilder.buildPrompt('testStringPrompt', input);
    const expectedFormatInstructions = await stringPromptConfig.outputParser!.getFormatInstructions();
    
    expect(result.prompt).toContain(expectedFormatInstructions);
    expect(result.inputVariables.format_instructions).toBe(expectedFormatInstructions);
  });

  it('should use default format_instructions if outputParser is not present but variable is expected', async () => {
     const noParserConfig: PromptConfig = {
      id: 'noParserConfig',
      name: 'No Parser Config',
      description: 'A test prompt without an output parser but expects format_instructions.',
      templateType: 'string',
      templateString: 'Content: {content}\nFormat: {format_instructions}',
      inputVariables: ['content', 'format_instructions'],
      // No outputParser
    };
    promptBuilder.registerPromptConfig(noParserConfig);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const input: PromptBuilderInput = { content: 'Test content' };
    const result = await promptBuilder.buildPrompt('noParserConfig', input);

    expect(result.prompt).toContain('Format: Please format your response clearly.');
    expect(result.inputVariables.format_instructions).toBe('Please format your response clearly.');
    expect(warnSpy).toHaveBeenCalledWith("Prompt 'noParserConfig' expects 'format_instructions' but no outputParser is configured.");
    warnSpy.mockRestore();
  });

});