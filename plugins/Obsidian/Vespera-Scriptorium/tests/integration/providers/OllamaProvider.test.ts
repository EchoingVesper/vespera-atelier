import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaProvider } from '../../../src/providers/OllamaProvider';
import { ProviderType } from '../../../src/LLMClient';
import { 
  mockModel, 
  mockCompletionOptions, 
  createMockFetchResponse, 
  createMockStreamingResponse 
} from '../__mocks__/test-utils';

describe('OllamaProvider', () => {
  let provider: OllamaProvider;
  let originalFetch: typeof global.fetch;

  const mockConfig = {
    type: ProviderType.OLLAMA,
    endpoint: 'http://localhost:11434',
    timeout: 30000,
    maxRetries: 3,
  };

  const mockModelsResponse = {
    models: [
      {
        name: 'llama2',
        modified_at: '2023-01-01T00:00:00Z',
        size: 3826560329,
        digest: 'abc123',
        details: {
          parameter_size: '7B',
          quantization_level: 'Q4_0',
          format: 'gguf',
        },
      },
    ],
  };

  const mockCompletionResponse = {
    model: 'llama2',
    created_at: '2023-01-01T00:00:00Z',
    response: 'This is a test response',
    done: true,
    total_duration: 500,
    load_duration: 100,
    prompt_eval_count: 10,
    prompt_eval_duration: 200,
    eval_count: 20,
    eval_duration: 200,
  };

  beforeEach(() => {
    provider = new OllamaProvider(mockConfig);
    originalFetch = global.fetch;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  describe('constructor', () => {
    it('should create a new OllamaProvider instance', () => {
      expect(provider).toBeInstanceOf(OllamaProvider);
    });

    it('should throw an error for invalid provider type', () => {
      expect(
        () => new OllamaProvider({ ...mockConfig, type: 'invalid' as any })
      ).toThrow('Invalid provider type');
    });
  });

  describe('listModels', () => {
    it('should return a list of models', async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        createMockFetchResponse(mockModelsResponse)
      );

      const models = await provider.listModels();
      
      expect(models).toHaveLength(1);
      expect(models[0].id).toBe('llama2');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        {
          method: 'GET',
          signal: expect.any(AbortSignal),
        }
      );
    });

    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        createMockFetchResponse({ error: 'Not found' }, false, 404)
      );

      await expect(provider.listModels()).rejects.toThrow('Failed to fetch models');
    });
  });

  describe('generateCompletion', () => {
    it('should generate a completion', async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        createMockFetchResponse(mockCompletionResponse)
      );

      const prompt = 'Hello, world!';
      const completion = await provider.generateCompletion(prompt, mockCompletionOptions);
      
      expect(completion).toBe('This is a test response');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama2',
            prompt: 'Hello, world!',
            temperature: 0.7,
            top_p: 0.9,
            max_tokens: 100,
            stop: ['\n'],
          }),
          signal: expect.any(AbortSignal),
        })
      );
    });
  });

  describe('streamCompletion', () => {
    it('should stream completion chunks', async () => {
      const mockChunks = [
        JSON.stringify({ response: 'This ', done: false }) + '\n',
        JSON.stringify({ response: 'is a ', done: false }) + '\n',
        JSON.stringify({ response: 'test', done: true }) + '\n',
      ];

      (global.fetch as jest.Mock).mockResolvedValue(
        createMockStreamingResponse(mockChunks)
      );

      const prompt = 'Hello, world!';
      const mockCallback = vi.fn();
      
      await provider.streamCompletion(prompt, mockCompletionOptions, mockCallback);
      
      expect(mockCallback).toHaveBeenCalledTimes(3);
      expect(mockCallback).toHaveBeenNthCalledWith(1, 'This ', false);
      expect(mockCallback).toHaveBeenNthCalledWith(2, 'is a ', false);
      expect(mockCallback).toHaveBeenNthCalledWith(3, 'test', true);
    });
  });

  describe('getTokenUsage', () => {
    it('should return token usage', async () => {
      const prompt = 'Hello, world!';
      const completion = 'This is a test response';
      
      const usage = await provider.getTokenUsage(prompt, completion);
      
      // Note: This is a simplified test since the actual implementation
      // would depend on how token counting is implemented
      expect(usage).toHaveProperty('promptTokens');
      expect(usage).toHaveProperty('completionTokens');
      expect(usage).toHaveProperty('totalTokens');
    });
  });
});
