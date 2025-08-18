/**
 * LLM Provider Types
 * 
 * Defines the interfaces for LLM provider configurations.
 */

/**
 * Base LLM provider configuration
 */
export interface BaseLLMProviderConfig {
  /** Whether this provider is enabled */
  enabled: boolean;
  
  /** Provider name/identifier */
  name: string;
  
  /** Priority order (lower numbers are higher priority) */
  priority: number;
  
  /** Maximum tokens per request */
  maxTokens?: number;
  
  /** Temperature setting */
  temperature?: number;
  
  /** Top-p sampling */
  topP?: number;
  
  /** Frequency penalty */
  frequencyPenalty?: number;
  
  /** Presence penalty */
  presencePenalty?: number;
  
  /** Timeout in milliseconds */
  timeout?: number;
  
  /** Maximum retry attempts */
  maxRetries?: number;
  
  /** Retry delay in milliseconds */
  retryDelay?: number;
}

/**
 * OpenAI provider configuration
 */
export interface OpenAIConfig extends BaseLLMProviderConfig {
  type: 'openai';
  
  /** OpenAI API key */
  apiKey: string;
  
  /** Model name (e.g., 'gpt-4', 'gpt-3.5-turbo') */
  model: string;
  
  /** Organization ID (optional) */
  organization?: string;
  
  /** Project ID (optional) */
  project?: string;
  
  /** Base URL for custom endpoints */
  baseUrl?: string;
}

/**
 * Ollama provider configuration
 */
export interface OllamaConfig extends BaseLLMProviderConfig {
  type: 'ollama';
  
  /** Ollama server URL */
  baseUrl: string;
  
  /** Model name */
  model: string;
  
  /** Whether to use GPU acceleration */
  useGpu?: boolean;
  
  /** Number of GPU layers to use (if useGpu is true) */
  gpuLayers?: number;
  
  /** Context window size */
  contextWindow?: number;
  
  /** Number of parallel requests */
  numParallel?: number;
}

/**
 * Union type of all supported LLM providers
 */
export type LLMProviderConfig = OpenAIConfig | OllamaConfig;

/**
 * LLM provider selection strategy
 */
export type LLMProviderStrategy = 'priority' | 'round-robin' | 'fallback';

/**
 * LLM provider selection options
 */
export interface LLMProviderSelection {
  /** Provider ID to use */
  providerId?: string;
  
  /** Provider type to use */
  providerType?: 'openai' | 'ollama';
  
  /** Selection strategy */
  strategy?: LLMProviderStrategy;
  
  /** Fallback providers in order of preference */
  fallbackOrder?: string[];
}

/**
 * LLM request options that can override provider settings
 */
export interface LLMRequestOptions {
  /** Override provider model */
  model?: string;
  
  /** Override temperature */
  temperature?: number;
  
  /** Override max tokens */
  maxTokens?: number;
  
  /** Override top-p */
  topP?: number;
  
  /** Override frequency penalty */
  frequencyPenalty?: number;
  
  /** Override presence penalty */
  presencePenalty?: number;
  
  /** Override timeout */
  timeout?: number;
  
  /** Override max retries */
  maxRetries?: number;
  
  /** Override retry delay */
  retryDelay?: number;
  
  /** Additional provider-specific options */
  [key: string]: any;
}
