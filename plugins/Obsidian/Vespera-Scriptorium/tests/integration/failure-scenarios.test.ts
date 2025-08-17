import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaProvider } from '../../../src/providers/OllamaProvider';
import { ProviderType } from '../../../src/LLMClient';
import { 
  mockModel, 
  mockCompletionOptions, 
  createMockFetchResponse, 
  createMockStreamingResponse 
} from '../__mocks__/test-utils';

declare global {
  // eslint-disable-next-line no-var
  var fetch: typeof globalThis.fetch;
}

describe('Failure Scenarios - OllamaProvider', () => {
  let provider: OllamaProvider;
  const originalFetch = global.fetch;
  
  const mockConfig = {
    type: ProviderType.OLLAMA,
    endpoint: 'http://localhost:11434',
    timeout: 100, // Shorter timeout for testing
    maxRetries: 2,
  };

  beforeEach(() => {
    provider = new OllamaProvider(mockConfig);
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  describe('Network Failures', () => {
    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      
      await expect(provider.listModels()).rejects.toThrow('Network error');
    });

    it('should retry on network failures', async () => {
      // First two attempts fail, third succeeds
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(createMockFetchResponse({ models: [] }));
      
      await expect(provider.listModels()).resolves.toEqual([]);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        {
          method: 'GET',
          signal: expect.any(AbortSignal),
        }
      );
    });

    it('should respect max retries', async () => {
      // All attempts fail
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      await expect(provider.listModels()).rejects.toThrow('Failed after 2 retries: Network error');
      expect(global.fetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout slow requests', async () => {
      // Simulate a slow response that exceeds the timeout
      vi.mocked(global.fetch).mockImplementation(() => 
        new Promise((resolve) => 
          setTimeout(
            () => resolve(createMockFetchResponse({ models: [] }) as unknown as Response), 
            mockConfig.timeout + 100
          )
        )
      );
      
      await expect(provider.listModels()).rejects.toThrow('The operation was aborted');
    });
  });

  describe('Error Responses', () => {
    it('should handle 4xx errors', async () => {
      vi.mocked(global.fetch).mockResolvedValue(
        createMockFetchResponse({ error: 'Not found' }, false, 404) as unknown as Response
      );
      
      await expect(provider.listModels()).rejects.toThrow('Not found');
    });

    it('should handle 5xx errors', async () => {
      vi.mocked(global.fetch).mockResolvedValue(
        createMockFetchResponse(
          { error: 'Internal server error' }, 
          false, 
          500
        ) as unknown as Response
      );
      
      await expect(provider.listModels()).rejects.toThrow('Internal server error');
    });

    it('should handle malformed JSON responses', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Unexpected token')),
        text: () => Promise.resolve('not json'),
      } as Response);
      
      await expect(provider.listModels()).rejects.toThrow('Failed to parse response');
    });
  });

  describe('Resource Exhaustion', () => {
    it('should handle rate limiting (429)', async () => {
      // First request gets rate limited
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Headers({ 'retry-after': '1' }),
          json: () => Promise.resolve({ error: 'Rate limit exceeded' }),
        } as Response)
        // Second request after delay should succeed
        .mockResolvedValueOnce(createMockFetchResponse({ models: [] }) as unknown as Response);
      
      const models = await provider.listModels();
      expect(models).toEqual([]);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Concurrency Issues', () => {
    it('should handle concurrent requests', async () => {
      // Simulate slow responses to test concurrent handling
      let resolveFirst: (value: any) => void;
      const firstPromise = new Promise(resolve => {
        resolveFirst = resolve;
      });
      
      vi.mocked(global.fetch)
        .mockImplementationOnce(() => firstPromise as Promise<Response>)
        .mockResolvedValueOnce(createMockFetchResponse({ models: [] }) as unknown as Response);
      
      // Start two concurrent requests
      const promise1 = provider.listModels();
      const promise2 = provider.listModels();
      
      // Resolve the first request
      resolveFirst(createMockFetchResponse({ models: [{ id: 'model1' }] }));
      
      const [result1, result2] = await Promise.all([promise1, promise2]);
      
      expect(result1).toEqual([{ id: 'model1' }]);
      expect(result2).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty responses', async () => {
      vi.mocked(global.fetch).mockResolvedValue(
        createMockFetchResponse({}) as unknown as Response
      );
      
      await expect(provider.listModels()).rejects.toThrow('Invalid response format');
    });

    it('should handle very large responses', async () => {
      // Create a large response (1MB)
      const largeResponse = {
        response: 'a'.repeat(1024 * 1024), // 1MB string
        done: true,
      };
      
      vi.mocked(global.fetch).mockResolvedValue(
        createMockFetchResponse(largeResponse) as unknown as Response
      );
      
      const result = await provider.generateCompletion('test', { model: 'llama2' });
      expect(result.length).toBe(1024 * 1024);
    });
  });
});
