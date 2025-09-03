/**
 * OpenAI provider implementation for GPT models
 */
import { ChatProvider } from './BaseProvider';
import { ProviderTemplate, ProviderConfig, ProviderStatus } from '../types/provider';
import { ChatMessage, ChatResponse, ChatChunk } from '../types/chat';
import { HttpClient } from '../utils/HttpClient';

export class OpenAIProvider extends ChatProvider {
  private httpClient?: HttpClient;
  
  constructor(template: ProviderTemplate, config: ProviderConfig) {
    super(template, config);
  }
  
  async connect(): Promise<void> {
    try {
      this.emitStatusChange(ProviderStatus.Connecting);
      
      // Initialize HTTP client with template configuration
      this.httpClient = new HttpClient({
        baseURL: this.template.provider_config.api_endpoint,
        headers: {
          [this.template.authentication.header]: 
            this.template.authentication.format.replace('{key}', this.config.apiKey || ''),
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
      
      // Test connection with a minimal request
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
      // TODO: Implement actual HTTP request
      console.log('Sending request to OpenAI:', requestBody);
      
      // Mock response for now
      const mockResponse = {
        id: 'chatcmpl-123',
        model: this.template.provider_config.model,
        choices: [{
          message: {
            content: `This is a mock response to: "${message.content}"`
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30
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
      // TODO: Implement actual streaming request
      console.log('Streaming request to OpenAI:', requestBody);
      
      // Mock streaming response
      const mockContent = `This is a streaming mock response to: "${message.content}"`;
      const words = mockContent.split(' ');
      
      for (let i = 0; i < words.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate delay
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
  
  private buildRequestBody(message: ChatMessage, stream: boolean): any {
    // TODO: Implement proper request body construction
    const thread = [message]; // For now, just use single message
    
    return {
      model: this.template.provider_config.model,
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
        finish_reason: data.choices[0].finish_reason
      }
    );
  }
  
  private async testConnection(): Promise<void> {
    // TODO: Implement actual connection test
    // Send a minimal test request to verify connection
    console.log('Testing OpenAI connection...');
    
    // For now, just simulate success
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('OpenAI connection test successful');
  }
  
  async disconnect(): Promise<void> {
    this.httpClient = undefined;
    this.emitStatusChange(ProviderStatus.Disconnected);
  }
}