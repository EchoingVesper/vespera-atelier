import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaProvider } from '../../src/providers/OllamaProvider';
import { ProviderType } from '../../src/LLMClient';

// Mock the global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Security Tests for OllamaProvider', () => {
  const validConfig = {
    type: ProviderType.OLLAMA,
    endpoint: 'http://localhost:11434',
    timeout: 30000,
    maxRetries: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Input Validation', () => {
    it('should reject invalid endpoint URLs', () => {
      expect(
        () => new OllamaProvider({ ...validConfig, endpoint: 'not-a-url' })
      ).toThrow('Invalid endpoint URL');
    });

    it('should reject insecure HTTP endpoints in production', () => {
      process.env.NODE_ENV = 'production';
      
      expect(
        () => new OllamaProvider({ ...validConfig, endpoint: 'http://insecure.example.com' })
      ).toThrow('HTTPS is required in production');
      
      // Cleanup
      delete process.env.NODE_ENV;
    });
  });

  describe('Injection Prevention', () => {
    it('should sanitize prompt input to prevent injection', async () => {
      const maliciousPrompt = 'Hello\nREST OF PROMPT IGNORED; DROP TABLE users; --';
      const provider = new OllamaProvider(validConfig);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ response: 'Test response', done: true }),
      });
      
      await provider.generateCompletion(maliciousPrompt, { model: 'llama2' });
      
      // Verify the fetch was called with sanitized input
      const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(fetchBody.prompt).not.toContain(';');
      expect(fetchBody.prompt).not.toContain('DROP TABLE');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limiting', async () => {
      const provider = new OllamaProvider({
        ...validConfig,
        rateLimit: {
          requests: 5,
          interval: 60, // 60 seconds
        },
      });

      // Mock successful responses
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ response: 'Test response', done: true }),
      });

      // Make 5 requests (within rate limit)
      for (let i = 0; i < 5; i++) {
        await expect(
          provider.generateCompletion('test', { model: 'llama2' })
        ).resolves.toBeDefined();
      }

      // 6th request should be rate limited
      await expect(
        provider.generateCompletion('test', { model: 'llama2' })
      ).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('Authentication & Authorization', () => {
    it('should include API key in requests when provided', async () => {
      const provider = new OllamaProvider({
        ...validConfig,
        apiKey: 'test-api-key',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ models: [] }),
      });

      await provider.listModels();
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
          }),
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should not leak sensitive information in error messages', async () => {
      const provider = new OllamaProvider(validConfig);
      
      // Mock a failed request with sensitive information
      mockFetch.mockRejectedValueOnce({
        message: 'API key: abc123 is invalid',
        status: 401,
      });

      try {
        await provider.listModels();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).not.toContain('abc123');
        expect(error.message).toContain('Authentication failed');
      }
    });
  });

  describe('Secure Defaults', () => {
    it('should use secure defaults for TLS/SSL', () => {
      const provider = new OllamaProvider({
        ...validConfig,
        endpoint: 'https://secure.example.com',
      });

      // Verify TLS settings are properly configured
      // This is a simplified example - actual implementation would depend on your HTTP client
      expect(provider).toHaveProperty('tlsOptions');
      expect(provider.tlsOptions).toMatchObject({
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
      });
    });
  });
});
