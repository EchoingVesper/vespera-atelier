/**
 * OpenAI provider implementation for GPT models
 */
import { ChatProvider } from './BaseProvider';
import { ProviderTemplate, ProviderConfig, ProviderStatus } from '../types/provider';
import { ChatMessage, ChatResponse, ChatChunk } from '../types/chat';
import { SecureChatProviderClient } from './SecureChatProviderClient';
import { VesperaSecurityError, VesperaRateLimitError } from '../../core/security';
import { VesperaSecurityErrorCode } from '../../types/security';

export class OpenAIProvider extends ChatProvider {
  private httpClient?: SecureChatProviderClient;
  
  constructor(template: ProviderTemplate, config: ProviderConfig) {
    super(template, config);
  }
  
  async connect(): Promise<void> {
    try {
      this.emitStatusChange(ProviderStatus.Connecting);
      
      // Initialize SecureChatProviderClient with OpenAI-specific configuration
      this.httpClient = new SecureChatProviderClient({
        baseURL: this.template.provider_config.api_endpoint,
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000,
        apiKey: this.config.apiKey,
        providerName: 'openai',
        resourcePrefix: 'openai.api',
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
        `OpenAI connection failed: ${errorMessage}`,
        VesperaSecurityErrorCode.OPENAI_CONNECTION_ERROR,
        undefined,
        { originalError: error }
      );
    }
  }
  
  async sendMessage(message: ChatMessage): Promise<ChatResponse> {
    if (!this.httpClient) {
      throw new VesperaSecurityError('Provider not connected', VesperaSecurityErrorCode.PROVIDER_NOT_CONNECTED);
    }
    
    const requestBody = this.buildRequestBody(message, false);
    
    try {
      // Secure HTTP request to OpenAI Chat Completions API
      const response = await this.httpClient.post('/v1/chat/completions', requestBody);
      
      if (!response.data) {
        throw new VesperaSecurityError('Empty response from OpenAI API', VesperaSecurityErrorCode.EMPTY_API_RESPONSE);
      }
      
      return this.parseResponse(response.data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emitStatusChange(ProviderStatus.Error, errorMessage);
      
      if (error instanceof VesperaSecurityError || error instanceof VesperaRateLimitError) {
        throw error;
      }
      
      throw new VesperaSecurityError(
        `OpenAI API request failed: ${errorMessage}`,
        VesperaSecurityErrorCode.OPENAI_API_ERROR,
        undefined,
        { originalError: error }
      );
    }
  }
  
  async* streamMessage(message: ChatMessage): AsyncIterable<ChatChunk> {
    if (!this.httpClient) {
      throw new VesperaSecurityError('Provider not connected', VesperaSecurityErrorCode.PROVIDER_NOT_CONNECTED);
    }
    
    const requestBody = this.buildRequestBody(message, true);
    
    try {
      // Secure streaming request to OpenAI Chat Completions API
      const streamResponse = this.httpClient.postStream('/v1/chat/completions', requestBody);
      
      for await (const event of streamResponse) {
        if (event.type === 'error') {
          throw new VesperaSecurityError(
            `Streaming error: ${event.error}`,
            VesperaSecurityErrorCode.OPENAI_STREAM_ERROR
          );
        }
        
        if (event.type === 'done') {
          yield { content: '', done: true };
          break;
        }
        
        if (event.type === 'data' && event.data) {
          // Parse OpenAI streaming format
          if (event.data.choices && event.data.choices[0]) {
            const choice = event.data.choices[0];
            
            if (choice.delta?.content) {
              const content = choice.delta.content;
              yield { 
                content, 
                done: false,
                metadata: {
                  model: event.data.model,
                  usage: event.data.usage,
                  finish_reason: choice.finish_reason
                }
              };
            }
            
            if (choice.finish_reason) {
              yield { 
                content: '', 
                done: true, 
                metadata: {
                  model: event.data.model,
                  usage: event.data.usage,
                  finish_reason: choice.finish_reason
                }
              };
              break;
            }
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
        `OpenAI streaming failed: ${errorMessage}`,
        VesperaSecurityErrorCode.OPENAI_STREAM_ERROR,
        undefined,
        { originalError: error }
      );
    }
  }
  
  private buildRequestBody(message: ChatMessage, stream: boolean): any {
    // Build proper OpenAI Chat Completions API request body
    const thread = [message]; // For now, just use single message (would be enhanced for conversation history)
    let messages = this.formatMessages(thread);
    
    // Add system message if provided
    if (this.config.systemPrompt) {
      messages = [
        { role: 'system', content: this.config.systemPrompt },
        ...messages
      ];
    }
    
    // Validate required parameters
    const model = this.config.model || this.template.provider_config.model;
    const maxTokens = this.config.maxTokens || this.template.provider_config.max_tokens;
    
    if (!model) {
      throw new VesperaSecurityError('Model configuration is required', VesperaSecurityErrorCode.INVALID_MODEL_CONFIG);
    }
    
    if (!messages || messages.length === 0) {
      throw new VesperaSecurityError('At least one message is required', VesperaSecurityErrorCode.INVALID_MESSAGE_CONFIG);
    }
    
    const requestBody: any = {
      model,
      messages,
      stream
    };
    
    // Add optional parameters with validation
    if (maxTokens) {
      requestBody.max_tokens = Math.min(maxTokens, 4000); // OpenAI limit for most models
    }
    
    if (this.config.temperature !== undefined) {
      // Ensure temperature is within valid range for OpenAI (0.0 to 2.0)
      const temperature = Math.max(0.0, Math.min(2.0, this.config.temperature));
      requestBody.temperature = temperature;
    } else {
      requestBody.temperature = 0.7; // Default for OpenAI
    }
    
    // Add other OpenAI-specific parameters if configured
    if (this.config['topP'] !== undefined) {
      requestBody.top_p = Math.max(0.0, Math.min(1.0, this.config['topP']));
    }
    
    if (this.config['frequencyPenalty'] !== undefined) {
      requestBody.frequency_penalty = Math.max(-2.0, Math.min(2.0, this.config['frequencyPenalty']));
    }
    
    if (this.config['presencePenalty'] !== undefined) {
      requestBody.presence_penalty = Math.max(-2.0, Math.min(2.0, this.config['presencePenalty']));
    }
    
    if (this.config['stop'] && Array.isArray(this.config['stop'])) {
      requestBody.stop = this.config['stop'].slice(0, 4); // OpenAI allows up to 4 stop sequences
    }
    
    return requestBody;
  }
  
  private parseResponse(data: any): ChatResponse {
    return this.createResponse(
      data.choices[0].message.content,
      {
        model: data.model,
        usage: data.usage,
        finish_reason: data.choices[0].finish_reason
      }
    );
  }
  
  private async testConnection(): Promise<void> {
    if (!this.httpClient) {
      throw new VesperaSecurityError('HTTP client not initialized', VesperaSecurityErrorCode.HTTP_CLIENT_NOT_INITIALIZED);
    }
    
    try {
      // Test connection with a minimal message to verify API key and connectivity
      const testMessage: ChatMessage = {
        id: 'test-connection',
        role: 'user',
        content: 'Hi',
        timestamp: new Date(),
        threadId: 'test-thread',
        sessionId: 'test-session'
      };
      
      const testRequestBody = this.buildRequestBody(testMessage, false);
      
      // Override max_tokens for connection test to minimize cost
      testRequestBody.max_tokens = 5;
      
      // Send test request to OpenAI Chat Completions API
      const response = await this.httpClient.post('/v1/chat/completions', testRequestBody);
      
      if (!response.data || !response.data.choices || response.data.choices.length === 0) {
        throw new VesperaSecurityError(
          'Invalid response format from OpenAI API',
          VesperaSecurityErrorCode.OPENAI_INVALID_RESPONSE
        );
      }
      
      // Verify the response has the expected structure
      const choice = response.data.choices[0];
      if (!choice.message || typeof choice.message.content !== 'string') {
        throw new VesperaSecurityError(
          'Unexpected response format from OpenAI API',
          VesperaSecurityErrorCode.OPENAI_UNEXPECTED_RESPONSE
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
              'Invalid API key for OpenAI',
              VesperaSecurityErrorCode.OPENAI_INVALID_API_KEY
            );
          case 403:
            throw new VesperaSecurityError(
              'Access denied to OpenAI API',
              VesperaSecurityErrorCode.OPENAI_ACCESS_DENIED
            );
          case 429:
            throw new VesperaSecurityError(
              'Rate limit exceeded during connection test',
              VesperaSecurityErrorCode.OPENAI_RATE_LIMIT_EXCEEDED
            );
          case 500:
          case 502:
          case 503:
          case 504:
            throw new VesperaSecurityError(
              'OpenAI API server error',
              VesperaSecurityErrorCode.OPENAI_SERVER_ERROR
            );
          default:
            throw new VesperaSecurityError(
              `OpenAI API HTTP error: ${status}`,
              VesperaSecurityErrorCode.OPENAI_HTTP_ERROR,
              undefined,
              { status }
            );
        }
      }
      
      throw new VesperaSecurityError(
        `Connection test failed: ${errorMessage}`,
        VesperaSecurityErrorCode.OPENAI_CONNECTION_TEST_FAILED,
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