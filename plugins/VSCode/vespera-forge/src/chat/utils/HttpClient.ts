/**
 * HTTP Client utility for provider communications
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
    // TODO: Implement streaming POST request
    const url = this.buildUrl(path);
    const requestHeaders = { ...this.defaultHeaders, ...headers };
    
    console.log(`[HttpClient] Streaming POST ${url}`);
    console.log(`[HttpClient] Headers:`, requestHeaders);
    console.log(`[HttpClient] Data:`, data);
    
    // Mock streaming response for now
    return this.mockStreamingResponse();
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
    
    // TODO: Implement actual HTTP request using node-fetch or similar
    // For now, return a mock response
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network delay
    
    return {
      data: {} as T,
      status: 200,
      statusText: 'OK',
      headers: {}
    };
  }
  
  private buildUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseURL}${cleanPath}`;
  }
  
  private async* mockStreamingResponse(): AsyncIterable<Buffer> {
    // Mock streaming response
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