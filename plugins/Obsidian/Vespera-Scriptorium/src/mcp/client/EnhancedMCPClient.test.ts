import { EnhancedMCPClient, getEnhancedMCPClient, resetEnhancedMCPClient } from './EnhancedMCPClient';
import { MCPClient } from './MCPClient';
import { mcpConfig } from '../config';

describe('EnhancedMCPClient', () => {
  let mockClient: jest.Mocked<MCPClient>;
  let enhancedClient: EnhancedMCPClient;

  beforeEach(() => {
    // Reset the singleton instance before each test
    resetEnhancedMCPClient();
    
    // Create a mock MCPClient
    mockClient = {
      ping: jest.fn(),
      getServerInfo: jest.fn(),
      readFile: jest.fn(),
      writeFile: jest.fn(),
      deleteFile: jest.fn(),
      searchFiles: jest.fn(),
      executeCommand: jest.fn(),
    } as unknown as jest.Mocked<MCPClient>;

    // Initialize with default config
    mcpConfig.initialize({
      cache: { enabled: true, ttl: 300000 },
      batching: { enabled: true, maxBatchSize: 10 },
    });

    enhancedClient = getEnhancedMCPClient(mockClient);
  });

  describe('Circuit Breaker', () => {
    it('should open the circuit after multiple failures', async () => {
      // Mock a failing request
      mockClient.ping.mockRejectedValue(new Error('Connection failed'));

      // Make requests up to the failure threshold
      const failureThreshold = 5;
      for (let i = 0; i < failureThreshold; i++) {
        try {
          await enhancedClient.ping();
        } catch (error) {
          // Expected error
        }
      }

      // Next request should fail fast with circuit open
      const result = await enhancedClient.ping();
      expect(result.success).toBe(false);
      expect(result.error).toContain('circuit breaker open');
    });

    it('should reset the circuit after timeout', async () => {
      // Mock a failing request
      mockClient.ping.mockRejectedValue(new Error('Connection failed'));

      // Make requests to open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await enhancedClient.ping();
        } catch (error) {
          // Expected error
        }
      }

      // Fast-forward time past the reset timeout
      jest.advanceTimersByTime(31000);

      // Mock a successful response
      mockClient.ping.mockResolvedValue({ success: true, data: { version: '1.0.0' } });

      // Should now attempt the request again
      const result = await enhancedClient.ping();
      expect(result.success).toBe(true);
    });
  });

  describe('Batching', () => {
    it('should batch multiple readFile requests', async () => {
      // Enable batching
      mcpConfig.updateConfig({ batching: { enabled: true } });

      // Mock the batch response
      mockClient.executeCommand.mockResolvedValue({
        success: true,
        data: [
          { success: true, data: { path: 'file1.md', content: 'Content 1' } },
          { success: true, data: { path: 'file2.md', content: 'Content 2' } },
        ],
      });

      // Make multiple requests that should be batched
      const [result1, result2] = await Promise.all([
        enhancedClient.readFile('file1.md'),
        enhancedClient.readFile('file2.md'),
      ]);

      // Should have made a single batch request
      expect(mockClient.executeCommand).toHaveBeenCalledTimes(1);
      expect(mockClient.executeCommand).toHaveBeenCalledWith('batch', {
        requests: [
          { method: 'readFile', params: ['file1.md', {}] },
          { method: 'readFile', params: ['file2.md', {}] },
        ],
      });

      // Should return the correct results
      expect(result1.success).toBe(true);
      expect(result1.data.path).toBe('file1.md');
      expect(result2.success).toBe(true);
      expect(result2.data.path).toBe('file2.md');
    });
  });

  describe('Caching', () => {
    it('should cache readFile responses', async () => {
      // Enable caching
      mcpConfig.updateConfig({ cache: { enabled: true, ttl: 300000 } });

      // Mock the response
      const mockFile = { path: 'test.md', content: 'Test content' };
      mockClient.readFile.mockResolvedValue({
        success: true,
        data: mockFile,
      });

      // First request - should call the server
      const result1 = await enhancedClient.readFile('test.md');
      expect(mockClient.readFile).toHaveBeenCalledTimes(1);

      // Second request - should be served from cache
      mockClient.readFile.mockClear();
      const result2 = await enhancedClient.readFile('test.md');
      expect(mockClient.readFile).toHaveBeenCalledTimes(0);
      expect(result2.data).toEqual(mockFile);

      // Clear cache and verify it's called again
      enhancedClient.clearCache();
      await enhancedClient.readFile('test.md');
      expect(mockClient.readFile).toHaveBeenCalledTimes(1);
    });

    it('should respect cache TTL', async () => {
      // Set a short TTL
      mcpConfig.updateConfig({ cache: { enabled: true, ttl: 100 } });

      // Mock the response
      mockClient.readFile.mockResolvedValue({
        success: true,
        data: { path: 'test.md', content: 'Test content' },
      });

      // First request - should call the server
      await enhancedClient.readFile('test.md');
      expect(mockClient.readFile).toHaveBeenCalledTimes(1);

      // Fast-forward time past TTL
      jest.advanceTimersByTime(101);

      // Second request - should call the server again
      mockClient.readFile.mockClear();
      await enhancedClient.readFile('test.md');
      expect(mockClient.readFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('Deduplication', () => {
    it('should deduplicate concurrent identical requests', async () => {
      // Mock a slow response
      let resolveRequest: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolveRequest = resolve;
      });
      
      mockClient.readFile.mockImplementation(() => promise);

      // Start multiple identical requests
      const request1 = enhancedClient.readFile('test.md');
      const request2 = enhancedClient.readFile('test.md');
      const request3 = enhancedClient.readFile('test.md');

      // Resolve the mock
      resolveRequest!({ success: true, data: { path: 'test.md', content: 'Test' } });
      
      // Wait for all requests to complete
      const [result1, result2, result3] = await Promise.all([request1, request2, request3]);

      // Should have made only one actual request
      expect(mockClient.readFile).toHaveBeenCalledTimes(1);
      
      // All requests should have the same result
      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Mock a network error
      mockClient.ping.mockRejectedValue(new Error('Network error'));

      const result = await enhancedClient.ping();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle server errors', async () => {
      // Mock a server error response
      mockClient.ping.mockResolvedValue({
        success: false,
        error: 'Internal server error',
      });

      const result = await enhancedClient.ping();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal server error');
    });
  });
});
