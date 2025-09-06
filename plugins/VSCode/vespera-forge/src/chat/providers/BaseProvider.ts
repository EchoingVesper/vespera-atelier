/**
 * Abstract base provider class for all chat providers
 */
import { EventEmitter } from 'events';
import { ProviderTemplate, ProviderConfig, ProviderStatus, ProviderCapabilities, ProviderEventType, EventHandler } from '../types/provider';
import { ChatMessage, ChatResponse, ChatChunk, ValidationResult } from '../types/chat';

export abstract class ChatProvider {
  protected readonly template: ProviderTemplate;
  protected config: ProviderConfig;
  protected status: ProviderStatus = ProviderStatus.Disconnected;
  protected eventEmitter = new EventEmitter();
  
  constructor(template: ProviderTemplate, config: ProviderConfig) {
    this.template = template;
    this.config = config;
  }
  
  // Abstract methods that must be implemented by concrete providers
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract sendMessage(message: ChatMessage): Promise<ChatResponse>;
  abstract streamMessage(message: ChatMessage): AsyncIterable<ChatChunk>;
  
  // Streaming support methods
  supportsStreaming(): boolean {
    return this.template.capabilities.streaming;
  }
  
  async sendStreamingMessage(message: ChatMessage, onChunk?: (chunk: ChatChunk) => void): Promise<ChatResponse> {
    if (!this.supportsStreaming()) {
      throw new Error('Streaming is not supported by this provider');
    }
    
    let fullContent = '';
    let lastMetadata: any = {};
    
    for await (const chunk of this.streamMessage(message)) {
      fullContent += chunk.content;
      if (chunk.metadata) {
        lastMetadata = chunk.metadata;
      }
      onChunk?.(chunk);
    }
    
    return this.createResponse(fullContent, lastMetadata);
  }
  
  // Configuration management
  async configure(newConfig: Partial<ProviderConfig>): Promise<void> {
    const validation = this.validateConfig({ ...this.config, ...newConfig });
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }
    
    this.config = { ...this.config, ...newConfig };
    this.eventEmitter.emit('configUpdated', this.config);
  }
  
  validateConfig(config: ProviderConfig): ValidationResult {
    const errors: string[] = [];
    
    // Validate using template UI schema
    for (const field of this.template.ui_schema.config_fields) {
      if (field.required && !config[field.name]) {
        errors.push(`${field.label} is required`);
      }
      
      if (field.validation && config[field.name]) {
        const value = config[field.name];
        
        // Pattern validation
        if (field.validation.pattern) {
          const regex = new RegExp(field.validation.pattern);
          if (!regex.test(value)) {
            errors.push(`${field.label} format is invalid`);
          }
        }
        
        // Number validation
        if (field.type === 'number') {
          const num = Number(value);
          if (isNaN(num)) {
            errors.push(`${field.label} must be a valid number`);
          }
          if (field.validation.min !== undefined && num < field.validation.min) {
            errors.push(`${field.label} must be at least ${field.validation.min}`);
          }
          if (field.validation.max !== undefined && num > field.validation.max) {
            errors.push(`${field.label} must be at most ${field.validation.max}`);
          }
        }
        
        // Select validation
        if (field.type === 'select' && field.validation.options) {
          if (!field.validation.options.includes(value)) {
            errors.push(`${field.label} must be one of: ${field.validation.options.join(', ')}`);
          }
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  // Status and capabilities
  getStatus(): ProviderStatus { 
    return this.status; 
  }
  
  getCapabilities(): ProviderCapabilities { 
    return this.template.capabilities; 
  }
  
  getTemplate(): ProviderTemplate { 
    return this.template; 
  }
  
  getConfig(): ProviderConfig { 
    return { ...this.config }; 
  }
  
  // Event handling
  on(event: ProviderEventType, handler: EventHandler): void {
    this.eventEmitter.on(event, handler);
  }
  
  off(event: ProviderEventType, handler: EventHandler): void {
    this.eventEmitter.off(event, handler);
  }
  
  protected emitStatusChange(status: ProviderStatus, error?: string): void {
    this.status = status;
    this.eventEmitter.emit('statusChanged', { status, error });
  }
  
  protected emitError(error: Error): void {
    this.eventEmitter.emit('error', error);
  }
  
  // Helper methods for concrete implementations
  protected formatMessages(thread: ChatMessage[]): any[] {
    // Format messages with proper validation and sanitization
    return thread
      .filter(msg => {
        // Filter out invalid messages
        if (!msg || typeof msg !== 'object') {
          console.warn('Invalid message object filtered out:', msg);
          return false;
        }
        
        if (!msg.role || !msg.content) {
          console.warn('Message missing required fields filtered out:', msg);
          return false;
        }
        
        if (!['user', 'assistant', 'system'].includes(msg.role)) {
          console.warn('Message with invalid role filtered out:', msg.role);
          return false;
        }
        
        return true;
      })
      .map(msg => {
        // Sanitize and format message content
        let content = msg.content;
        
        // Basic content sanitization
        if (typeof content === 'string') {
          // Trim whitespace
          content = content.trim();
          
          // Remove potentially dangerous content patterns
          content = content.replace(/javascript:/gi, ''); // Remove javascript: URLs
          content = content.replace(/<script[^>]*>.*?<\/script>/gis, ''); // Remove script tags
          content = content.replace(/on\w+\s*=/gi, ''); // Remove event handlers
        }
        
        // Ensure content is not empty after sanitization
        if (!content || content.length === 0) {
          content = '[Empty message]';
        }
        
        // Return standardized message format
        const formattedMessage: any = {
          role: msg.role,
          content: content
        };
        
        // Add timestamp if available (for debugging/audit purposes)
        if (msg.timestamp) {
          formattedMessage.timestamp = msg.timestamp.toISOString();
        }
        
        // Add message ID if available (for conversation tracking)
        if (msg.id) {
          formattedMessage.id = msg.id;
        }
        
        // Add metadata if available (for provider-specific features)
        if (msg.metadata && typeof msg.metadata === 'object') {
          // Only include safe metadata properties
          const safeMetadata: any = {};
          const allowedKeys = ['model', 'temperature', 'max_tokens', 'usage', 'finish_reason'];
          
          for (const key of allowedKeys) {
            if (key in msg.metadata) {
              safeMetadata[key] = msg.metadata[key];
            }
          }
          
          if (Object.keys(safeMetadata).length > 0) {
            formattedMessage.metadata = safeMetadata;
          }
        }
        
        return formattedMessage;
      });
  }
  
  protected generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  protected createResponse(content: string, metadata?: any): ChatResponse {
    return {
      id: this.generateMessageId(),
      content,
      role: 'assistant',
      timestamp: new Date(),
      metadata
    };
  }
  
  // Cleanup
  dispose(): void {
    this.eventEmitter.removeAllListeners();
    if (this.status === ProviderStatus.Connected) {
      this.disconnect().catch(console.error);
    }
  }
}