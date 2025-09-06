/**
 * Anthropic provider implementation for Claude models
 */
import { ChatProvider } from './BaseProvider';
import { ProviderTemplate, ProviderConfig, ProviderStatus } from '../types/provider';
import { ChatMessage, ChatResponse, ChatChunk } from '../types/chat';
import { SecureChatProviderClient } from './SecureChatProviderClient';
import { VesperaSecurityError, VesperaRateLimitError } from '../../core/security';
import { VesperaSecurityErrorCode } from '../../types/security';

export class AnthropicProvider extends ChatProvider {
  private httpClient?: SecureChatProviderClient;
  
  constructor(template: ProviderTemplate, config: ProviderConfig) {
    super(template, config);
  }
  
  async connect(): Promise<void> {
    try {
      this.emitStatusChange(ProviderStatus.Connecting);
      
      // Initialize SecureChatProviderClient with Anthropic-specific configuration
      this.httpClient = new SecureChatProviderClient({
        baseURL: this.template.provider_config.api_endpoint,
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01' // Anthropic API version
        },
        timeout: 30000,
        apiKey: this.config.apiKey,
        providerName: 'anthropic',
        resourcePrefix: 'anthropic.api',
        enableRateLimit: true,
        enableSanitization: true,
        enableAuditLogging: true
      });
      
      // Test connection with a minimal request
      await this.testConnection();
      
      this.emitStatusChange(ProviderStatus.Connected);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emitStatusChange(ProviderStatus.Error, errorMessage);
      
      if (error instanceof VesperaSecurityError || error instanceof VesperaRateLimitError) {
        throw error;
      }
      
      throw new VesperaSecurityError(
        `Anthropic connection failed: ${errorMessage}`,
        VesperaSecurityErrorCode.UNAUTHORIZED_ACCESS,
        undefined,
        { originalError: error }
      );
    }
  }
  
  async sendMessage(message: ChatMessage): Promise<ChatResponse> {
    if (!this.httpClient) {
      throw new VesperaSecurityError('Provider not connected', VesperaSecurityErrorCode.UNAUTHORIZED_ACCESS);
    }
    
    const requestBody = this.buildRequestBody(message, false);
    
    try {
      // Secure HTTP request to Anthropic Messages API
      const response = await this.httpClient.post('/v1/messages', requestBody);
      
      if (!response.data) {
        throw new VesperaSecurityError('Empty response from Anthropic API', VesperaSecurityErrorCode.THREAT_DETECTED);
      }
      
      return this.parseResponse(response.data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emitStatusChange(ProviderStatus.Error, errorMessage);
      
      if (error instanceof VesperaSecurityError || error instanceof VesperaRateLimitError) {
        throw error;
      }
      
      throw new VesperaSecurityError(
        `Anthropic API request failed: ${errorMessage}`,
        VesperaSecurityErrorCode.UNAUTHORIZED_ACCESS,
        undefined,
        { originalError: error }
      );
    }
  }
  
  async* streamMessage(message: ChatMessage): AsyncIterable<ChatChunk> {
    if (!this.httpClient) {
      throw new VesperaSecurityError('Provider not connected', VesperaSecurityErrorCode.UNAUTHORIZED_ACCESS);
    }
    
    const requestBody = this.buildRequestBody(message, true);
    
    try {
      // Secure streaming request to Anthropic Messages API
      const streamResponse = this.httpClient.postStream('/v1/messages', requestBody);
      
      for await (const event of streamResponse) {
        if (event.type === 'error') {
          throw new VesperaSecurityError(
            `Streaming error: ${event.error}`,
            VesperaSecurityErrorCode.THREAT_DETECTED
          );
        }
        
        if (event.type === 'done') {
          yield { content: '', done: true };
          break;
        }
        
        if (event.type === 'data' && event.data) {
          // Parse Anthropic streaming format
          if (event.data.type === 'content_block_delta' && event.data.delta) {
            const content = event.data.delta.text || '';
            if (content) {
              yield { 
                content, 
                done: false,
                metadata: {
                  model: event.data.model,
                  usage: event.data.usage
                }
              };
            }
          } else if (event.data.type === 'message_stop') {
            yield { content: '', done: true, metadata: event.data.usage };
            break;
          }
        }
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emitStatusChange(ProviderStatus.Error, errorMessage);
      
      if (error instanceof VesperaSecurityError || error instanceof VesperaRateLimitError) {
        throw error;
      }
      
      throw new VesperaSecurityError(
        `Anthropic streaming failed: ${errorMessage}`,
        VesperaSecurityErrorCode.THREAT_DETECTED,
        undefined,
        { originalError: error }
      );
    }
  }
  
  private buildRequestBody(message: ChatMessage, stream: boolean): any {
    // Build proper Anthropic Messages API request body
    const thread = [message]; // For now, just use single message (would be enhanced for conversation history)
    const messages = this.formatMessagesForAnthropic(thread);
    
    // Validate required parameters
    const model = this.config.model || this.template.provider_config.model;
    const maxTokens = this.config.maxTokens || this.template.provider_config.max_tokens || 4000;
    
    if (!model) {
      throw new VesperaSecurityError('Model configuration is required', VesperaSecurityErrorCode.THREAT_DETECTED);
    }
    
    if (!messages || messages.length === 0) {
      throw new VesperaSecurityError('At least one message is required', VesperaSecurityErrorCode.THREAT_DETECTED);
    }
    
    const requestBody: any = {
      model,
      max_tokens: maxTokens,
      messages,
      stream
    };
    
    // Add system prompt if provided
    if (this.config.systemPrompt) {
      requestBody.system = this.config.systemPrompt;
    }
    
    // Add temperature if configured
    if (this.config.temperature !== undefined) {
      // Ensure temperature is within valid range for Anthropic (0.0 to 1.0)
      const temperature = Math.max(0.0, Math.min(1.0, this.config.temperature));
      requestBody.temperature = temperature;
    }
    
    // Add other Anthropic-specific parameters if configured
    if (this.config['topP'] !== undefined) {
      requestBody.top_p = Math.max(0.0, Math.min(1.0, this.config['topP']));
    }
    
    if (this.config['topK'] !== undefined) {
      requestBody.top_k = Math.max(1, Math.floor(this.config['topK']));
    }
    
    return requestBody;
  }
  
  private formatMessagesForAnthropic(thread: ChatMessage[]): any[] {
    // Anthropic has specific message format requirements
    return thread
      .filter(msg => msg.role !== 'system') // System messages go in separate field
      .map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }));
  }
  
  private parseResponse(data: any): ChatResponse {
    const content = data.content[0]?.text || '';
    
    return this.createResponse(
      content,
      {
        model: data.model,
        usage: {
          prompt_tokens: data.usage.input_tokens,
          completion_tokens: data.usage.output_tokens,
          total_tokens: data.usage.input_tokens + data.usage.output_tokens
        },
        finish_reason: data.stop_reason
      }
    );
  }
  
  private async testConnection(): Promise<void> {
    if (!this.httpClient) {
      throw new VesperaSecurityError('HTTP client not initialized', VesperaSecurityErrorCode.UNAUTHORIZED_ACCESS);
    }
    
    try {
      // Test connection with a minimal message to verify API key and connectivity
      const testMessage: ChatMessage = {
        id: 'test-connection',
        role: 'user',
        content: 'Hello',
        timestamp: new Date(),
        threadId: 'test-thread',
        sessionId: 'test-session'
      };
      
      const testRequestBody = this.buildRequestBody(testMessage, false);
      
      // Override max_tokens for connection test to minimize cost
      testRequestBody.max_tokens = 5;
      
      // Send test request to Anthropic Messages API
      const response = await this.httpClient.post('/v1/messages', testRequestBody);
      
      if (!response.data || !response.data.content) {
        throw new VesperaSecurityError(
          'Invalid response format from Anthropic API',
          VesperaSecurityErrorCode.THREAT_DETECTED
        );
      }
      
      // Verify the response has the expected structure
      if (response.data.type !== 'message' || response.data.role !== 'assistant') {
        throw new VesperaSecurityError(
          'Unexpected response format from Anthropic API',
          VesperaSecurityErrorCode.THREAT_DETECTED
        );
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (error instanceof VesperaSecurityError) {
        throw error;
      }
      
      // Handle specific HTTP status codes
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as any).status;
        switch (status) {
          case 401:
            throw new VesperaSecurityError(
              'Invalid API key for Anthropic',
              VesperaSecurityErrorCode.UNAUTHORIZED_ACCESS
            );
          case 403:
            throw new VesperaSecurityError(
              'Access denied to Anthropic API',
              VesperaSecurityErrorCode.UNAUTHORIZED_ACCESS
            );
          case 429:
            throw new VesperaSecurityError(
              'Rate limit exceeded during connection test',
              VesperaSecurityErrorCode.RATE_LIMIT_EXCEEDED
            );
          case 500:
          case 502:
          case 503:
          case 504:
            throw new VesperaSecurityError(
              'Anthropic API server error',
              VesperaSecurityErrorCode.CIRCUIT_BREAKER_OPEN
            );
          default:
            throw new VesperaSecurityError(
              `Anthropic API HTTP error: ${status}`,
              VesperaSecurityErrorCode.CIRCUIT_BREAKER_OPEN,
              undefined,
              { status }
            );
        }
      }
      
      throw new VesperaSecurityError(
        `Connection test failed: ${errorMessage}`,
        VesperaSecurityErrorCode.UNAUTHORIZED_ACCESS,
        undefined,
        { originalError: error }
      );
    }
  }
  
  async disconnect(): Promise<void> {
    this.httpClient = undefined;
    this.emitStatusChange(ProviderStatus.Disconnected);
  }
}