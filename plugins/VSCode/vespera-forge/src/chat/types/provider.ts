/**
 * Provider type definitions for the chat system
 */

export interface ProviderConfig {
  [key: string]: any;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export enum ProviderStatus {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Error = 'error'
}

export interface ProviderCapabilities {
  streaming: boolean;
  function_calling: boolean;
  image_analysis: boolean;
  code_execution: boolean;
  web_search: boolean;
}

export interface ProviderTemplate {
  template_id: string;
  name: string;
  description: string;
  version: string;
  category: 'llm_provider' | 'chat_ui' | 'chat_config';
  
  provider_config: {
    provider_type: string;
    model: string;
    api_endpoint: string;
    supports_streaming: boolean;
    supports_functions: boolean;
    max_tokens: number;
    context_window: number;
  };
  
  authentication: {
    type: 'api_key' | 'oauth' | 'bearer' | 'custom';
    key_name: string;
    header: string;
    format: string;
  };
  
  ui_schema: {
    config_fields: ConfigField[];
  };
  
  capabilities: ProviderCapabilities;
  
  // JSON Schema for configuration validation
  config_schema?: ConfigSchema;
  
  // Template inheritance
  extends?: string;
  overrides?: Partial<ProviderTemplate>;
}

export interface ConfigField {
  name: string;
  type: 'text' | 'password' | 'number' | 'textarea' | 'select' | 'checkbox';
  required: boolean;
  label: string;
  placeholder?: string;
  description?: string;
  validation?: {
    min?: number;
    max?: number;
    step?: number;
    pattern?: string;
    options?: string[];
    message?: string;
  };
  default?: any;
}

export interface JsonSchemaProperty {
  type: string;
  pattern?: string;
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  enum?: string[];
  description?: string;
}

export interface ConfigSchema {
  type: 'object';
  required?: string[];
  properties: Record<string, JsonSchemaProperty>;
}

export type ProviderEventType = 
  | 'statusChanged'
  | 'configUpdated'
  | 'messageReceived'
  | 'streamChunk'
  | 'error';

export interface EventHandler {
  (...args: any[]): void;
}