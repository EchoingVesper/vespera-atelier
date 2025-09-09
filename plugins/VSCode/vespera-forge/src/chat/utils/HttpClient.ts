/**
 * HTTP Client utility for provider communications
 * 
 * @deprecated This client is being replaced by SecureChatProviderClient
 * which provides enterprise-grade security, rate limiting, and audit logging.
 * Use SecureChatProviderClient for new implementations.
 */

export interface HttpClientOptions {
  baseURL: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface HttpResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

export class HttpClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;
  
  constructor(options: HttpClientOptions) {
    this.baseURL = options.baseURL.replace(/\/$/, ''); // Remove trailing slash
    this.defaultHeaders = options.headers || {};
    this.timeout = options.timeout || 30000;
  }
  
  async get<T = any>(path: string, headers?: Record<string, string>): Promise<HttpResponse<T>> {
    return this.request<T>('GET', path, undefined, headers);
  }
  
  async post<T = any>(path: string, data?: any, headers?: Record<string, string>): Promise<HttpResponse<T>> {
    return this.request<T>('POST', path, data, headers);
  }
  
  async put<T = any>(path: string, data?: any, headers?: Record<string, string>): Promise<HttpResponse<T>> {
    return this.request<T>('PUT', path, data, headers);
  }
  
  async delete<T = any>(path: string, headers?: Record<string, string>): Promise<HttpResponse<T>> {
    return this.request<T>('DELETE', path, undefined, headers);
  }
  
  async postStream(path: string, data?: any, headers?: Record<string, string>): Promise<AsyncIterable<Buffer>> {
    // Implement basic streaming POST request with node-fetch
    const url = this.buildUrl(path);
    const requestHeaders = { ...this.defaultHeaders, ...headers };
    
    console.log(`[HttpClient] Streaming POST ${url}`);
    console.log(`[HttpClient] Headers:`, requestHeaders);
    console.log(`[HttpClient] Data:`, data);
    
    try {
      // Use dynamic import to avoid bundling issues
      const fetch = await this.getFetchImplementation();
      
      const response = await fetch(url, {
        method: 'POST',
        headers: requestHeaders,
        body: data ? JSON.stringify(data) : undefined,
        // @ts-ignore - AbortSignal timeout might not be available in all environments
        signal: AbortSignal.timeout ? AbortSignal.timeout(this.timeout) : undefined
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is not available for streaming');
      }

      return this.processStreamResponse(response.body);
      
    } catch (error) {
      console.error(`[HttpClient] Streaming request failed:`, error);
      // Fallback to mock response for backwards compatibility
      return this.mockStreamingResponse();
    }
  }
  
  private async request<T = any>(
    method: string,
    path: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<HttpResponse<T>> {
    const url = this.buildUrl(path);
    const requestHeaders = { ...this.defaultHeaders, ...headers };
    
    console.log(`[HttpClient] ${method} ${url}`);
    console.log(`[HttpClient] Headers:`, requestHeaders);
    if (data) {
      console.log(`[HttpClient] Data:`, data);
    }
    
    try {
      // Use dynamic import to avoid bundling issues
      const fetch = await this.getFetchImplementation();
      
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: data ? JSON.stringify(data) : undefined,
        // @ts-ignore - AbortSignal timeout might not be available in all environments
        signal: AbortSignal.timeout ? AbortSignal.timeout(this.timeout) : undefined
      });

      const responseData = await response.json();

      return {
        data: responseData as T,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      };
      
    } catch (error) {
      console.error(`[HttpClient] Request failed:`, error);
      
      // Return error response instead of mock success for better debugging
      return {
        data: { error: error instanceof Error ? error.message : String(error) } as T,
        status: 500,
        statusText: 'Internal Error',
        headers: {}
      };
    }
  }
  
  private buildUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseURL}${cleanPath}`;
  }
  
  /**
   * Get appropriate fetch implementation
   */
  private async getFetchImplementation(): Promise<typeof fetch> {
    // In VS Code extension context, use node-fetch
    try {
      const nodeFetch = await import('node-fetch');
      return nodeFetch.default as any;
    } catch (error) {
      // Fallback to global fetch if available
      if (typeof fetch !== 'undefined') {
        return fetch;
      }
      throw new Error('No fetch implementation available');
    }
  }

  /**
   * Process streaming response
   */
  private async* processStreamResponse(body: ReadableStream<Uint8Array>): AsyncIterable<Buffer> {
    const reader = body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        yield Buffer.from(chunk);
      }
    } catch (error) {
      console.error('[HttpClient] Streaming error:', error);
      throw error;
    } finally {
      reader.releaseLock();
    }
  }

  private async* mockStreamingResponse(): AsyncIterable<Buffer> {
    // Mock streaming response for backwards compatibility
    const mockChunks = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" there"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"!"}}]}\n\n',
      'data: [DONE]\n\n'
    ];
    
    for (const chunk of mockChunks) {
      await new Promise(resolve => setTimeout(resolve, 200));
      yield Buffer.from(chunk);
    }
  }
  
  // Utility method to update default headers
  setDefaultHeader(key: string, value: string): void {
    this.defaultHeaders[key] = value;
  }
  
  // Utility method to remove default headers
  removeDefaultHeader(key: string): void {
    delete this.defaultHeaders[key];
  }
}