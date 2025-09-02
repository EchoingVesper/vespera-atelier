/**
 * Anthropic provider implementation for Claude models
 */
import { ChatProvider } from './BaseProvider';
import { ProviderTemplate, ProviderConfig, ProviderStatus } from '../types/provider';
import { ChatMessage, ChatResponse, ChatChunk } from '../types/chat';
import { HttpClient } from '../utils/HttpClient';

export class AnthropicProvider extends ChatProvider {
  private httpClient?: HttpClient;
  
  constructor(template: ProviderTemplate, config: ProviderConfig) {
    super(template, config);
  }
  
  async connect(): Promise<void> {
    try {
      this.emitStatusChange(ProviderStatus.Connecting);
      
      // Initialize HTTP client with Anthropic-specific configuration
      this.httpClient = new HttpClient({
        baseURL: this.template.provider_config.api_endpoint,
        headers: {
          [this.template.authentication.header]: 
            this.template.authentication.format.replace('{key}', this.config.apiKey || ''),
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01' // Anthropic API version
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
      // TODO: Implement actual HTTP request to Anthropic Messages API
      console.log('Sending request to Anthropic:', requestBody);
      
      // Mock response for now
      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{
          type: 'text',
          text: `This is a mock Claude response to: "${message.content}"`
        }],
        model: this.template.provider_config.model,
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 10,
          output_tokens: 20
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
      // TODO: Implement actual streaming request to Anthropic
      console.log('Streaming request to Anthropic:', requestBody);
      
      // Mock streaming response
      const mockContent = `This is a streaming mock Claude response to: "${message.content}"`;
      const words = mockContent.split(' ');
      
      for (let i = 0; i < words.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 120)); // Slightly slower than OpenAI
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
    // TODO: Implement proper Anthropic Messages API request body
    const thread = [message]; // For now, just use single message
    const messages = this.formatMessagesForAnthropic(thread);
    
    return {
      model: this.template.provider_config.model,
      max_tokens: this.config.maxTokens || this.template.provider_config.max_tokens,
      messages,
      stream,
      ...(this.config.systemPrompt && {
        system: this.config.systemPrompt
      }),
      ...(this.config.temperature && {
        temperature: this.config.temperature
      })
    };
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
    // TODO: Implement actual connection test for Anthropic
    console.log('Testing Anthropic connection...');
    
    // For now, just simulate success
    await new Promise(resolve => setTimeout(resolve, 600));
    
    console.log('Anthropic connection test successful');
  }
  
  async disconnect(): Promise<void> {
    this.httpClient = undefined;
    this.emitStatusChange(ProviderStatus.Disconnected);
  }
}