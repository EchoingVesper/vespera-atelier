/**
 * LM Studio provider implementation for local models
 */
import { ChatProvider } from './BaseProvider';
import { ProviderTemplate, ProviderConfig, ProviderStatus } from '../types/provider';
import { ChatMessage, ChatResponse, ChatChunk } from '../types/chat';
import { HttpClient } from '../utils/HttpClient';

export class LMStudioProvider extends ChatProvider {
  private httpClient?: HttpClient;
  
  constructor(template: ProviderTemplate, config: ProviderConfig) {
    super(template, config);
  }
  
  async connect(): Promise<void> {
    try {
      this.emitStatusChange(ProviderStatus.Connecting);
      
      // Initialize HTTP client for local LM Studio server
      this.httpClient = new HttpClient({
        baseURL: this.config.baseUrl || this.template.provider_config.api_endpoint,
        headers: {
          'Content-Type': 'application/json'
          // Note: LM Studio typically doesn't require authentication for local usage
        },
        timeout: 60000 // Longer timeout for local models
      });
      
      // Test connection by checking available models
      await this.testConnection();
      
      this.emitStatusChange(ProviderStatus.Connected);
    } catch (error) {
      this.emitStatusChange(ProviderStatus.Error, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }
  
  async sendMessage(message: ChatMessage): Promise<ChatResponse> {
    if (!this.httpClient) {
      throw new Error('Provider not connected');
    }
    
    const requestBody = this.buildRequestBody(message, false);
    
    try {
      // TODO: Implement actual HTTP request to LM Studio
      console.log('Sending request to LM Studio:', requestBody);
      
      // Mock response for now
      const mockResponse = {
        id: 'chatcmpl-local-123',
        object: 'chat.completion',
        created: Date.now(),
        model: this.config.model || this.template.provider_config.model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: `This is a mock local model response to: "${message.content}"`
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 25,
          total_tokens: 40
        }
      };
      
      return this.parseResponse(mockResponse);
    } catch (error) {
      this.emitStatusChange(ProviderStatus.Error, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }
  
  async* streamMessage(message: ChatMessage): AsyncIterable<ChatChunk> {
    if (!this.httpClient) {
      throw new Error('Provider not connected');
    }
    
    const requestBody = this.buildRequestBody(message, true);
    
    try {
      // TODO: Implement actual streaming request to LM Studio
      console.log('Streaming request to LM Studio:', requestBody);
      
      // Mock streaming response (slower to simulate local processing)
      const mockContent = `This is a streaming mock local model response to: "${message.content}"`;
      const words = mockContent.split(' ');
      
      for (let i = 0; i < words.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 200)); // Slower for local models
        yield { 
          content: words[i] + (i < words.length - 1 ? ' ' : ''), 
          done: i === words.length - 1 
        };
      }
      
    } catch (error) {
      this.emitStatusChange(ProviderStatus.Error, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }
  
  async listAvailableModels(): Promise<string[]> {
    if (!this.httpClient) {
      throw new Error('Provider not connected');
    }
    
    try {
      // TODO: Implement actual model listing from LM Studio
      console.log('Fetching available models from LM Studio...');
      
      // Mock available models
      return [
        'llama-2-7b-chat',
        'llama-2-13b-chat',
        'codellama-7b-instruct',
        'mistral-7b-instruct'
      ];
    } catch (error) {
      console.error('Failed to fetch available models:', error);
      return [];
    }
  }
  
  private buildRequestBody(message: ChatMessage, stream: boolean): any {
    // TODO: Implement proper request body for LM Studio (OpenAI-compatible)
    const thread = [message]; // For now, just use single message
    
    return {
      model: this.config.model || this.template.provider_config.model,
      messages: this.formatMessages(thread),
      temperature: this.config.temperature || 0.7,
      max_tokens: this.config.maxTokens || this.template.provider_config.max_tokens,
      stream,
      ...(this.config.systemPrompt && {
        messages: [
          { role: 'system', content: this.config.systemPrompt },
          ...this.formatMessages(thread)
        ]
      })
    };
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
    // TODO: Implement actual connection test for LM Studio
    console.log('Testing LM Studio connection...');
    
    try {
      // Try to fetch available models as a connection test
      await this.listAvailableModels();
      console.log('LM Studio connection test successful');
    } catch (error) {
      console.error('LM Studio connection test failed:', error);
      throw new Error('Cannot connect to LM Studio server. Make sure LM Studio is running and the server is started.');
    }
  }
  
  async disconnect(): Promise<void> {
    this.httpClient = undefined;
    this.emitStatusChange(ProviderStatus.Disconnected);
  }
}