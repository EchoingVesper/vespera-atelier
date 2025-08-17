import { MCPClientConfig, MCPResult, MCPRequestOptions, MCPFileInfo, MCPSearchOptions } from '../types';
import { mcpConfig } from '../config';

/**
 * MCP Client for interacting with the MCP server
 */
export class MCPClient {
  private readonly baseUrl: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly config: MCPClientConfig;
  private requestQueue: Array<() => Promise<void>> = [];
  private isProcessingQueue = false;
  private activeRequests = 0;
  private readonly MAX_CONCURRENT_REQUESTS = 5;

  /**
   * Create a new MCP client
   * @param config Optional configuration (uses global config if not provided)
   */
  constructor(config?: MCPClientConfig) {
    this.config = config || mcpConfig.getConfig();
    this.baseUrl = `${this.config.secure ? 'https' : 'http'}://${this.config.host}:${this.config.port}`;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'X-API-Key': this.config.apiKey || '',
    };
  }

  /**
   * Make an HTTP request to the MCP server
   */
  private async request<T = any>(
    method: string,
    endpoint: string,
    data?: any,
    options: MCPRequestOptions = {}
  ): Promise<MCPResult<T>> {
    const startTime = Date.now();
    const url = new URL(endpoint, this.baseUrl);
    
    // Add query parameters
    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const headers = {
      ...this.defaultHeaders,
      ...(options.headers || {}),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || this.config.timeout);

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await this.parseResponse<{ message?: string }>(response);
        return {
          success: false,
          error: errorData?.message || `HTTP error ${response.status}`,
          meta: {
            duration: Date.now() - startTime,
            timestamp: Date.now(),
          },
        };
      }

      const result = await this.parseResponse<T>(response);
      
      return {
        success: true,
        data: result,
        meta: {
          duration: Date.now() - startTime,
          timestamp: Date.now(),
        },
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        meta: {
          duration: Date.now() - startTime,
          timestamp: Date.now(),
        },
      };
    }
  }

  /**
   * Parse the response based on content type
   */
  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      return response.json();
    }
    
    if (contentType.includes('text/')) {
      return (await response.text()) as unknown as T;
    }
    
    return (await response.blob()) as unknown as T;
  }

  /**
   * Queue a request to respect rate limiting
   */
  private async queueRequest<T>(
    fn: () => Promise<MCPResult<T>>
  ): Promise<MCPResult<T>> {
    if (!this.config.rateLimit?.enabled) {
      return fn();
    }

    return new Promise((resolve, reject) => {
      const execute = async () => {
        try {
          this.activeRequests++;
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeRequests--;
          this.processQueue();
        }
      };

      this.requestQueue.push(execute);
      this.processQueue();
    });
  }

  /**
   * Process the request queue respecting concurrency limits
   */
  private processQueue(): void {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    if (this.activeRequests >= this.MAX_CONCURRENT_REQUESTS) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.activeRequests < this.MAX_CONCURRENT_REQUESTS && this.requestQueue.length > 0) {
      const task = this.requestQueue.shift();
      if (task) {
        task();
      }
    }

    this.isProcessingQueue = false;
  }

  // Public API Methods

  /**
   * Check if the MCP server is reachable
   */
  public async ping(): Promise<MCPResult<{ version: string }>> {
    return this.queueRequest(() => this.request('GET', '/api/ping'));
  }

  /**
   * Get server information
   */
  public async getServerInfo(): Promise<MCPResult<{
    name: string;
    version: string;
    capabilities: string[];
  }>> {
    return this.queueRequest(() => this.request('GET', '/api/info'));
  }

  /**
   * Read a file from the vault
   * @param path Path to the file relative to the vault root
   * @param options Request options
   */
  public async readFile(
    path: string,
    options: MCPRequestOptions = {}
  ): Promise<MCPResult<MCPFileInfo>> {
    return this.queueRequest(() =>
      this.request('GET', `/api/files/${encodeURIComponent(path)}`, undefined, options)
    );
  }

  /**
   * Write content to a file in the vault
   * @param path Path to the file relative to the vault root
   * @param content File content
   * @param options Request options
   */
  public async writeFile(
    path: string,
    content: string,
    options: MCPRequestOptions = {}
  ): Promise<MCPResult<MCPFileInfo>> {
    return this.queueRequest(() =>
      this.request('PUT', `/api/files/${encodeURIComponent(path)}`, { content }, options)
    );
  }

  /**
   * Delete a file from the vault
   * @param path Path to the file relative to the vault root
   * @param options Request options
   */
  public async deleteFile(
    path: string,
    options: MCPRequestOptions = {}
  ): Promise<MCPResult<{ path: string }>> {
    return this.queueRequest(() =>
      this.request('DELETE', `/api/files/${encodeURIComponent(path)}`, undefined, options)
    );
  }

  /**
   * Search for files in the vault
   * @param options Search options
   */
  public async searchFiles(
    options: MCPSearchOptions
  ): Promise<MCPResult<{ results: MCPFileInfo[]; total: number }>> {
    return this.queueRequest(() =>
      this.request('POST', '/api/search', options)
    );
  }

  /**
   * Execute a custom MCP command
   * @param command Command name
   * @param data Command data
   * @param options Request options
   */
  public async executeCommand<T = any>(
    command: string,
    data: Record<string, any> = {},
    options: MCPRequestOptions = {}
  ): Promise<MCPResult<T>> {
    return this.queueRequest(() =>
      this.request('POST', `/api/commands/${command}`, data, options)
    );
  }
}

// Export a singleton instance
let mcpClientInstance: MCPClient | null = null;

/**
 * Get or create the MCP client instance
 * @param config Optional configuration (only used on first call)
 */
export function getMCPClient(config?: MCPClientConfig): MCPClient {
  if (!mcpClientInstance) {
    mcpClientInstance = new MCPClient(config);
  }
  return mcpClientInstance;
}

/**
 * Reset the MCP client instance (for testing)
 */
export function resetMCPClient(): void {
  mcpClientInstance = null;
}
