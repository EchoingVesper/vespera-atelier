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
  
  constructor(template: ProviderTemplate, config: ProviderConfig, configManager?: any) {
    this.template = template;
    this.config = config;
    // Subclasses can override this constructor to use configManager if needed
  }
  
  // Abstract methods that must be implemented by concrete providers
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract sendMessage(message: ChatMessage): Promise<ChatResponse>;
  abstract streamMessage(message: ChatMessage): AsyncIterable<ChatChunk>;
  
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
    // TODO: Implement message formatting based on provider requirements
    return thread.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
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