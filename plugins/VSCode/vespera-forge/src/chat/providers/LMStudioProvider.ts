/**
 * LM Studio provider implementation for local models
 */
import { ChatProvider } from './BaseProvider';
import { ProviderTemplate, ProviderConfig, ProviderStatus } from '../types/provider';
import { ChatMessage, ChatResponse, ChatChunk } from '../types/chat';
import { SecureChatProviderClient, StreamEvent } from './SecureChatProviderClient';
import { VesperaSecurityError, VesperaRateLimitError } from '../../core/security';

export class LMStudioProvider extends ChatProvider {
  private httpClient?: SecureChatProviderClient;
  
  constructor(template: ProviderTemplate, config: ProviderConfig) {
    super(template, config);
  }
  
  async connect(): Promise<void> {
    try {
      this.emitStatusChange(ProviderStatus.Connecting);
      
      // Initialize SecureChatProviderClient for local LM Studio server
      this.httpClient = new SecureChatProviderClient({
        baseURL: this.config.baseUrl || this.template.provider_config.api_endpoint,
        headers: {
          'Content-Type': 'application/json'
          // Note: LM Studio typically doesn't require authentication for local usage
        },
        timeout: 60000, // Longer timeout for local models
        providerName: 'lmstudio',
        resourcePrefix: 'lmstudio.api',
        enableRateLimit: false, // Typically not needed for local servers
        enableSanitization: true, // Still sanitize to prevent injection attacks
        enableAuditLogging: true // Log usage for debugging
      });
      
      // Test connection by checking available models
      await this.testConnection();
      
      this.emitStatusChange(ProviderStatus.Connected);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emitStatusChange(ProviderStatus.Error, errorMessage);
      
      if (error instanceof VesperaSecurityError || error instanceof VesperaRateLimitError) {
        throw error;
      }
      
      throw new VesperaSecurityError(
        `LM Studio connection failed: ${errorMessage}`,
        'LMSTUDIO_CONNECTION_ERROR',
        undefined,
        { originalError: error }
      );
    }
  }
  
  async sendMessage(message: ChatMessage): Promise<ChatResponse> {
    if (!this.httpClient) {
      throw new VesperaSecurityError('Provider not connected', 'PROVIDER_NOT_CONNECTED');
    }
    
    const requestBody = this.buildRequestBody(message, false);
    
    try {
      // Secure HTTP request to LM Studio (OpenAI-compatible API)
      const response = await this.httpClient.post('/v1/chat/completions', requestBody);
      
      if (!response.data) {
        throw new VesperaSecurityError('Empty response from LM Studio', 'EMPTY_API_RESPONSE');
      }
      
      return this.parseResponse(response.data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emitStatusChange(ProviderStatus.Error, errorMessage);
      
      if (error instanceof VesperaSecurityError || error instanceof VesperaRateLimitError) {
        throw error;
      }
      
      throw new VesperaSecurityError(
        `LM Studio API request failed: ${errorMessage}`,
        'LMSTUDIO_API_ERROR',
        undefined,
        { originalError: error }
      );
    }
  }
  
  async* streamMessage(message: ChatMessage): AsyncIterable<ChatChunk> {
    if (!this.httpClient) {
      throw new VesperaSecurityError('Provider not connected', 'PROVIDER_NOT_CONNECTED');
    }
    
    const requestBody = this.buildRequestBody(message, true);
    
    try {
      // Secure streaming request to LM Studio (OpenAI-compatible API)
      const streamResponse = this.httpClient.postStream('/v1/chat/completions', requestBody);
      
      for await (const event of streamResponse) {
        if (event.type === 'error') {
          throw new VesperaSecurityError(
            `Streaming error: ${event.error}`,
            'LMSTUDIO_STREAM_ERROR'
          );
        }
        
        if (event.type === 'done') {
          yield { content: '', done: true };
          break;
        }
        
        if (event.type === 'data' && event.data) {
          // Parse LM Studio streaming format (OpenAI-compatible)
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
                  finish_reason: choice.finish_reason,
                  local: true
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
                  finish_reason: choice.finish_reason,
                  local: true
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
        `LM Studio streaming failed: ${errorMessage}`,
        'LMSTUDIO_STREAM_ERROR',
        undefined,
        { originalError: error }
      );
    }
  }
  
  async listAvailableModels(): Promise<string[]> {
    if (!this.httpClient) {
      throw new VesperaSecurityError('Provider not connected', 'PROVIDER_NOT_CONNECTED');
    }
    
    try {
      // Fetch actual model listing from LM Studio models endpoint
      const response = await this.httpClient.get('/v1/models');
      
      if (!response.data || !response.data.data) {
        throw new VesperaSecurityError('Invalid models response from LM Studio', 'INVALID_MODELS_RESPONSE');
      }
      
      // Extract model IDs from the response
      const models = response.data.data
        .filter((model: any) => model && model.id)
        .map((model: any) => model.id);
      
      if (models.length === 0) {
        throw new VesperaSecurityError(
          'No models available in LM Studio. Please load a model in LM Studio first.',
          'NO_MODELS_AVAILABLE'
        );
      }
      
      return models;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (error instanceof VesperaSecurityError) {
        throw error;
      }
      
      // Handle connection errors specifically
      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
        throw new VesperaSecurityError(
          'Cannot connect to LM Studio server. Make sure LM Studio is running and the server is started.',
          'LMSTUDIO_CONNECTION_REFUSED'
        );
      }
      
      throw new VesperaSecurityError(
        `Failed to fetch available models: ${errorMessage}`,
        'LMSTUDIO_MODELS_FETCH_ERROR',
        undefined,
        { originalError: error }
      );
    }
  }
  
  private buildRequestBody(message: ChatMessage, stream: boolean): any {
    // Build proper request body for LM Studio (OpenAI-compatible API)
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
      throw new VesperaSecurityError('Model configuration is required', 'INVALID_MODEL_CONFIG');
    }
    
    if (!messages || messages.length === 0) {
      throw new VesperaSecurityError('At least one message is required', 'INVALID_MESSAGE_CONFIG');
    }
    
    const requestBody: any = {
      model,
      messages,
      stream
    };
    
    // Add optional parameters with validation for local model constraints
    if (maxTokens) {
      // Local models often have different token limits
      requestBody.max_tokens = Math.min(maxTokens, 8192); // Conservative limit for local models
    }
    
    if (this.config.temperature !== undefined) {
      // Ensure temperature is within valid range (0.0 to 2.0, but local models often work better with lower values)
      const temperature = Math.max(0.0, Math.min(1.5, this.config.temperature));
      requestBody.temperature = temperature;
    } else {
      requestBody.temperature = 0.7; // Default for local models
    }
    
    // Add other parameters if configured (LM Studio supports most OpenAI parameters)
    if (this.config.topP !== undefined) {
      requestBody.top_p = Math.max(0.0, Math.min(1.0, this.config.topP));
    }
    
    if (this.config.frequencyPenalty !== undefined) {
      requestBody.frequency_penalty = Math.max(-2.0, Math.min(2.0, this.config.frequencyPenalty));
    }
    
    if (this.config.presencePenalty !== undefined) {
      requestBody.presence_penalty = Math.max(-2.0, Math.min(2.0, this.config.presencePenalty));
    }
    
    if (this.config.stop && Array.isArray(this.config.stop)) {
      requestBody.stop = this.config.stop.slice(0, 4); // Limit stop sequences
    }
    
    return requestBody;
  }
  
  private parseResponse(data: any): ChatResponse {
    return this.createResponse(
      data.choices[0].message.content,
      {
        model: data.model,
        usage: data.usage,
        finish_reason: data.choices[0].finish_reason,
        local: true // Mark as local model response
      }
    );
  }
  
  private async testConnection(): Promise<void> {
    if (!this.httpClient) {
      throw new VesperaSecurityError('HTTP client not initialized', 'HTTP_CLIENT_NOT_INITIALIZED');
    }
    
    try {
      // Test connection by fetching available models first
      const models = await this.listAvailableModels();
      
      if (models.length === 0) {
        throw new VesperaSecurityError(
          'No models loaded in LM Studio. Please load a model first.',
          'NO_MODELS_LOADED'
        );
      }
      
      // Test with a minimal message using the first available model
      const testMessage: ChatMessage = {
        id: 'test-connection',
        role: 'user',
        content: 'Hi',
        timestamp: new Date()
      };
      
      // Override model to use first available model
      const originalModel = this.config.model;
      this.config.model = models[0];
      
      try {
        const testRequestBody = this.buildRequestBody(testMessage, false);
        
        // Override max_tokens for connection test to minimize processing time
        testRequestBody.max_tokens = 3;
        
        // Send test request to LM Studio Chat Completions API
        const response = await this.httpClient.post('/v1/chat/completions', testRequestBody);
        
        if (!response.data || !response.data.choices || response.data.choices.length === 0) {
          throw new VesperaSecurityError(
            'Invalid response format from LM Studio',
            'LMSTUDIO_INVALID_RESPONSE'
          );
        }
        
        // Verify the response has the expected structure
        const choice = response.data.choices[0];
        if (!choice.message || typeof choice.message.content !== 'string') {
          throw new VesperaSecurityError(
            'Unexpected response format from LM Studio',
            'LMSTUDIO_UNEXPECTED_RESPONSE'
          );
        }
        
      } finally {
        // Restore original model configuration
        this.config.model = originalModel;
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (error instanceof VesperaSecurityError) {
        throw error;
      }
      
      // Handle specific connection errors
      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
        throw new VesperaSecurityError(
          'Cannot connect to LM Studio server. Make sure LM Studio is running and the server is started.',
          'LMSTUDIO_CONNECTION_REFUSED'
        );
      }
      
      if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
        throw new VesperaSecurityError(
          'Connection timeout to LM Studio. The server may be overloaded or the model may be slow to respond.',
          'LMSTUDIO_CONNECTION_TIMEOUT'
        );
      }
      
      // Handle specific HTTP status codes if available
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as any).status;
        switch (status) {
          case 404:
            throw new VesperaSecurityError(
              'LM Studio API endpoint not found. Make sure you are using the correct server URL and that the server is properly configured.',
              'LMSTUDIO_ENDPOINT_NOT_FOUND'
            );
          case 500:
            throw new VesperaSecurityError(
              'LM Studio server error. The model may have failed to load or respond.',
              'LMSTUDIO_SERVER_ERROR'
            );
          default:
            throw new VesperaSecurityError(
              `LM Studio HTTP error: ${status}`,
              'LMSTUDIO_HTTP_ERROR',
              undefined,
              { status }
            );
        }
      }
      
      throw new VesperaSecurityError(
        `Connection test failed: ${errorMessage}`,
        'LMSTUDIO_CONNECTION_TEST_FAILED',
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