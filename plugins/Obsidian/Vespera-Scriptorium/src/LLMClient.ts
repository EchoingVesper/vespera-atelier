/**
 * LLMClient module
 * Orchestrates local LLM (Ollama/LM Studio) calls via CLI or HTTP.
 * @module LLMClient
 */

import { PromptTemplateManager, createPromptTemplateManager } from './templates';
import type { TemplateVariables } from './templates';
// Langchain imports
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { ChatOllama } from "@langchain/community/chat_models/ollama";
import { ChatOpenAI } from "@langchain/openai";
import { StringOutputParser } from "@langchain/core/output_parsers";


/**
 * Enum for supported LLM provider types
 */
export enum ProviderType {
  OLLAMA = 'ollama', // Kept for potential direct use or legacy
  LM_STUDIO = 'lm_studio', // Kept for potential direct use or legacy
  OLLAMA_LANGCHAIN = 'ollama_langchain',
  OPENAI_LANGCHAIN = 'openai_langchain',
  // Add other Langchain providers as needed
}

/**
 * Enum for error types that can occur during LLM operations
 */
export enum ErrorType {
  CONNECTION = 'connection',
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit',
  INVALID_REQUEST = 'invalid_request',
  PROVIDER_ERROR = 'provider_error',
  UNKNOWN = 'unknown',
}

/**
 * Interface for LLM errors
 */
export interface LLMError extends Error {
  type: ErrorType;
  provider: ProviderType;
  statusCode?: number;
  retryable: boolean;
  partialResponse?: string; // Optional property for partial responses in timeout errors
}

/**
 * Interface for token usage tracking
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Interface for a model provided by an LLM provider
 */
export interface Model {
  id: string;
  name: string;
  provider: ProviderType;
  contextWindow: number;
  maxTokens?: number;
  supportedFeatures?: {
    streaming: boolean;
    functionCalling: boolean;
    vision: boolean;
  };
}

/**
 * Interface for completion options
 */
export interface CompletionOptions {
  model: string;
  prompt: string; // Add prompt property
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  stream?: boolean;
  /**
   * Timeout in milliseconds for this specific completion request.
   * If not provided, the default timeout from the provider config will be used.
   * The timeout is enforced per-chunk, ensuring that slow chunks don't block the entire batch.
   */
  timeout?: number;
}

/**
 * Type for streaming callback function
 */
export type StreamingCallback = (chunk: string, done: boolean) => void;

/**
 * Interface for prompt templates
 */
export interface PromptTemplate {
  id: string;
  name: string;
  template: string;
  variables: string[];
  description?: string;
  tags?: string[];
}

/**
 * Interface for provider configuration
 */
export interface ProviderConfig {
  type: ProviderType;
  endpoint?: string; // For Ollama, LM_Studio (Langchain might use it too)
  apiKey?: string; // For OpenAI, Anthropic etc.
  modelName?: string; // Specific model identifier for Langchain (e.g., "gpt-3.5-turbo", "ollama/llama2")
  temperature?: number; // Default temperature for the provider
  timeout?: number; // Default request timeout
  maxRetries?: number; // Default max retries
  // cliPath?: string; // Less relevant with Langchain HTTP/SDK based providers
}

/**
 * Simplified interface for LLM operations, to be backed by Langchain
 * This interface might be further reduced or removed if LLMClient directly uses BaseChatModel.
 */
export interface LangchainCompatibleProvider {
  generateCompletion(prompt: string, options: CompletionOptions): Promise<string>;
  streamCompletion(prompt: string, options: CompletionOptions, callback: StreamingCallback): Promise<void>;
  testConnection(): Promise<boolean>;
  // listModels might be provider-specific and not easily standardized here with Langchain model instances
  // getTokenUsage is also handled differently, often part of the response or via callbacks
}


/**
 * LLMClient class for interacting with LLM providers via Langchain
 */
export class LLMClient {
  private langchainModel: BaseChatModel;
  private config: ProviderConfig;
  private templateManager: PromptTemplateManager;

  /**
   * Create a new LLMClient instance
   *
   * @param config Provider configuration
   */
  constructor(config: ProviderConfig) {
    this.config = config;
    this.langchainModel = this.createLangchainModel(config);
    this.templateManager = createPromptTemplateManager();
  }

  /**
   * Get the provider type
   * @returns The provider type
   */
  getProviderType(): string {
    return this.config.type;
  }

  /**
   * Get the provider endpoint
   * @returns The provider endpoint or empty string if not set
   */
  getEndpoint(): string {
    return this.config.endpoint || '';
  }
  
  /**
   * Create a Langchain model instance based on the configuration
   *
   * @param config Provider configuration
   * @returns Langchain BaseChatModel instance
   */
  private createLangchainModel(config: ProviderConfig): BaseChatModel {
    const temperature = config.temperature ?? 0.7; // Configured default temperature
    const modelName = config.modelName || "default-model"; // Ensure modelName is available

    switch (config.type) {
      case ProviderType.OLLAMA_LANGCHAIN:
        if (!config.endpoint) {
          throw new Error("Ollama endpoint must be configured for OLLAMA_LANGCHAIN provider.");
        }
        return new ChatOllama({
          baseUrl: config.endpoint,
          model: modelName,
          temperature: temperature,
        });
      case ProviderType.OPENAI_LANGCHAIN:
        if (!config.apiKey) {
          throw new Error("OpenAI API key must be configured for OPENAI_LANGCHAIN provider.");
        }
        return new ChatOpenAI({
          apiKey: config.apiKey,
          modelName: modelName, // For OpenAI, this is like "gpt-3.5-turbo"
          temperature: temperature,
        });
      // Add cases for other Langchain providers
      default:
        // Fallback or error for legacy or unsupported types if strict Langchain usage is enforced
        // For now, let's throw an error if it's not a known Langchain type.
        // If you need to support old providers, you'd have a different branching logic.
        throw new Error(`Unsupported Langchain provider type: ${config.type}`);
    }
  }

  /**
   * List available models - This is more complex with Langchain as models are often
   * instantiated directly. This method might need to be re-thought or made provider-specific.
   * For now, it's a placeholder or could be removed if not generally applicable.
   * @returns Promise resolving to an array of available models
   */
  async listModels(): Promise<Model[]> {
    // Langchain doesn't have a universal "listModels" for an arbitrary BaseChatModel.
    // This would typically be implemented by calling a specific method on the
    // Langchain provider instance if it supports it (e.g., some providers might have a helper).
    // Or, this information might come from a configuration service.
    console.warn("listModels() is not generically implemented for all Langchain providers and may return an empty list or throw an error.");
    // Example: If using Ollama directly (not through Langchain's ChatOllama), you might fetch /api/tags
    // If this.langchainModel is ChatOllama, it doesn't expose listModels directly.
    // This method needs a more robust, provider-aware implementation or be removed.
    return []; // Placeholder
  }

  /**
   * Generate completion for a prompt
   * 
   * @param prompt The prompt to generate completion for
   * @param options Completion options
   * @returns Promise resolving to the generated completion
   */
  async generateCompletion(prompt: string, options: CompletionOptions): Promise<string> {
    const timeoutMs = options.timeout || this.config.timeout || 30000;
    const modelOptions = {
      temperature: options.temperature ?? this.config.temperature ?? 0.7,
      maxTokens: options.maxTokens,
      topP: options.topP,
      frequencyPenalty: options.frequencyPenalty,
      presencePenalty: options.presencePenalty,
      stop: options.stop,
      // Langchain models might have different ways to pass these,
      // often directly in the constructor or via .bind()
    };

    // Update the langchainModel with per-request options if possible
    // This is a simplified approach; actual binding might be more complex
    // or require re-instantiation for some parameters if not supported by .bind()
    const configuredModel = this.langchainModel.bind({
        ...modelOptions, // Spread options that are bindable
        // Note: some options like `model` itself if it's part of `options.model`
        // and different from `this.config.modelName` would require re-instantiating
        // or having a factory method that takes full options.
        // For now, assuming `options.model` refers to the model already configured
        // in `this.langchainModel` via `this.config.modelName`.
    });


    return this.withRetry(async () => {
      try {
        const response = await this.withTimeout(
          () => configuredModel.invoke([new HumanMessage(prompt)]),
          timeoutMs
        );
        if (typeof response.content === 'string') {
          return response.content;
        } else if (Array.isArray(response.content)) {
            // Handle cases where content is an array of text/image parts
            return response.content
                .filter(part => part.type === "text")
                .map(part => (part as any).text)
                .join("\n");
        }
        throw new Error("Unexpected response format from Langchain model.");
      } catch (error) {
        throw this.handleLangchainError(error);
      }
    });
  }

  /**
   * Stream completion for a prompt
   *
   * @param prompt The prompt to generate completion for
   * @param options Completion options
   * @param callback Callback function to receive streaming chunks
   */
  async streamCompletion(prompt: string, options: CompletionOptions, callback: StreamingCallback): Promise<void> {
    const timeoutMs = options.timeout || this.config.timeout || 30000; // Per-chunk timeout for streaming
     const modelOptions = {
      temperature: options.temperature ?? this.config.temperature ?? 0.7,
      maxTokens: options.maxTokens,
      topP: options.topP,
      frequencyPenalty: options.frequencyPenalty,
      presencePenalty: options.presencePenalty,
      stop: options.stop,
    };

    const configuredModel = this.langchainModel.bind({ ...modelOptions });

    let fullResponse = "";
    let lastChunkTime = Date.now();

    const streamTimeout = (reject: (reason?: any) => void) => {
        const error = new Error(`Streaming chunk timed out after ${timeoutMs}ms`) as LLMError;
        error.type = ErrorType.TIMEOUT;
        error.provider = this.config.type;
        error.retryable = true; // Individual chunk timeouts might be retryable
        error.partialResponse = fullResponse;
        reject(error);
    };

    return this.withRetry(async () => {
        fullResponse = ""; // Reset for retry
        lastChunkTime = Date.now(); // Reset for retry

        try {
            const stream = await configuredModel.stream([new HumanMessage(prompt)]);
            let streamDone = false;

            for await (const chunk of stream) {
                if (Date.now() - lastChunkTime > timeoutMs) {
                    throw new Error("Streaming chunk timeout"); // Custom error to be caught by withTimeout logic
                }
                lastChunkTime = Date.now();

                const content = chunk.content;
                if (typeof content === 'string') {
                    fullResponse += content;
                    callback(content, false);
                } else if (Array.isArray(content)) {
                    const textContent = content
                        .filter(part => part.type === "text")
                        .map(part => (part as any).text)
                        .join("");
                    if (textContent) {
                        fullResponse += textContent;
                        callback(textContent, false);
                    }
                }
                // If other content types are expected, handle them here.
            }
            streamDone = true;
            callback("", true); // Signal completion
        } catch (error) {
            const wrappedError = this.handleLangchainError(error);
            // If any error occurs during streaming and we have some response, capture it.
            if (fullResponse) {
                 wrappedError.partialResponse = fullResponse;
            }
            // Ensure TIMEOUT type is correctly set if the internal "Streaming chunk timeout" is thrown
            if (error instanceof Error && error.message === "Streaming chunk timeout" && wrappedError.type !== ErrorType.TIMEOUT) {
                wrappedError.type = ErrorType.TIMEOUT;
                // Timeout errors are typically retryable
                if (wrappedError.retryable === undefined) {
                    wrappedError.retryable = true;
                }
            }
            throw wrappedError;
        }
    });
  }


  /**
   * Apply a prompt template with variables
   *
   * @param templateId ID of the template to use
   * @param variables Variables to substitute in the template
   * @returns The formatted prompt
   */
  applyTemplate(templateId: string, variables: TemplateVariables): string {
    return this.templateManager.applyTemplate(templateId, variables);
  }
  
  /**
   * Register a prompt template
   *
   * @param template The prompt template to register
   */
  registerTemplate(template: PromptTemplate): void {
    this.templateManager.registerTemplate(template);
  }
  
  /**
   * Get a registered template by ID
   *
   * @param id Template ID
   * @returns The prompt template or undefined if not found
   */
  getTemplate(id: string): PromptTemplate | undefined {
    return this.templateManager.getTemplate(id);
  }
  
  /**
   * Get all registered templates
   *
   * @returns Array of all registered templates
   */
  getAllTemplates(): PromptTemplate[] {
    return this.templateManager.getAllTemplates();
  }
  
  /**
   * Get token usage for a prompt and completion
   * 
   * @param prompt The prompt
   * @param completion The completion
   * @returns Promise resolving to token usage information
   */
  async getTokenUsage(prompt: string, completion: string): Promise<TokenUsage> {
    // Langchain's `invoke` or `stream` methods might return usage information
    // directly in the response or through callbacks, depending on the model.
    // This method might need to be re-thought.
    // For example, some models return `tokenUsage` in the AIMessage object's `response_metadata`.
    console.warn("getTokenUsage() is not generically implemented for all Langchain providers. It may require inspecting response_metadata or using specific callbacks.");
    // Placeholder implementation
    return {
      promptTokens: prompt.length / 4, // Rough estimate
      completionTokens: completion.length / 4, // Rough estimate
      totalTokens: (prompt.length + completion.length) / 4, // Rough estimate
    };
  }

  /**
   * Test the connection to the provider by sending a simple prompt.
   * @returns Promise resolving to true if the connection and a basic call are successful, false otherwise.
   */
  async testConnection(): Promise<boolean> {
    try {
      // A simple invoke can test the connection and model availability.
      const response = await this.langchainModel.invoke([new HumanMessage("Hello")]);
      return !!response.content; // True if content is received
    } catch (error) {
      console.error('LLMClient connection test (Langchain) failed:', this.handleLangchainError(error));
      return false;
    }
  }

  private handleLangchainError(error: any): LLMError {
    let newError: LLMError;

    if (error instanceof Error && 'type' in error && 'provider' in error && 'retryable' in error) {
      // If it already looks like an LLMError, use it as a base
      newError = { ...error, name: error.name, message: error.message } as LLMError;
    } else {
      newError = (error instanceof Error ? error : new Error(String(error))) as LLMError;
    }

    // Preserve original type if it exists and is valid, otherwise classify
    const originalType = (error as LLMError).type;
    const isValidOriginalType = originalType && Object.values(ErrorType).includes(originalType);

    if (isValidOriginalType && !newError.type) {
        newError.type = originalType;
    } else {
        // Basic error mapping, can be expanded
        if (error.code === 'ECONNREFUSED' || error.message?.includes('fetch failed')) {
          newError.type = ErrorType.CONNECTION;
        } else if (error.status === 429) {
          newError.type = ErrorType.RATE_LIMIT;
        } else if (error.status && error.status >= 400 && error.status < 500 && newError.type !== ErrorType.INVALID_REQUEST) {
          // Only override if not already set to INVALID_REQUEST by the original error
          newError.type = ErrorType.INVALID_REQUEST;
        } else if (error.message?.toLowerCase().includes('timeout') && newError.type !== ErrorType.TIMEOUT) {
            newError.type = ErrorType.TIMEOUT;
        } else if (!newError.type) { // If no type has been assigned yet
          newError.type = ErrorType.PROVIDER_ERROR; // Or UNKNOWN if truly unidentifiable
        }
    }
    
    newError.provider = this.config.type;
    newError.statusCode = error.status || newError.statusCode || undefined;
    
    // Set retryable based on the final error type, but respect if error explicitly set it
    if (newError.retryable === undefined) {
        newError.retryable = (newError.type === ErrorType.RATE_LIMIT || newError.type === ErrorType.TIMEOUT);
    }

    return newError;
  }


  /**
   * Execute a function with retry logic
   *
   * @param fn The function to execute
   * @param delayFn Optional function to handle delay between retries (for testing)
   * @returns Promise resolving to the function result
   * @throws The last error encountered if all retries fail
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    delayFn?: (ms: number) => Promise<void>
  ): Promise<T> {
    const maxRetries = this.config.maxRetries || 3;
    let lastError: Error | null = null;
    
    // Use provided delay function or default to setTimeout
    const delay = delayFn || ((ms: number) => new Promise(resolve => setTimeout(resolve, ms)));
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        // Check if the error is retryable
        if (error instanceof Error && 'retryable' in error && !(error as LLMError).retryable) {
          throw error;
        }
        
        // Exponential backoff
        const delayMs = Math.pow(2, attempt) * 1000;
        await delay(delayMs);
      }
    }
    
    throw lastError || new Error('Max retries exceeded');
  }
  
  /**
   * Execute a function with timeout
   *
   * @param fn The function to execute
   * @param timeoutMs Timeout in milliseconds
   * @returns Promise resolving to the function result
   * @throws LLMError with type ErrorType.TIMEOUT if the operation times out
   */
  private async withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const error = new Error(`Operation timed out after ${timeoutMs}ms`) as LLMError;
        error.type = ErrorType.TIMEOUT;
        error.provider = this.config.type;
        error.retryable = true;
        reject(error);
      }, timeoutMs);
      
      fn()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }
}

/**
 * Factory function to create an LLMClient instance
 * 
 * @param config Provider configuration
 * @returns LLMClient instance
 */
export function createLLMClient(config: ProviderConfig): LLMClient {
  return new LLMClient(config);
}

/**
 * Get a reference to the PromptTemplateManager from an LLMClient instance
 *
 * @param client LLMClient instance
 * @returns The PromptTemplateManager used by the client
 */
export function getTemplateManager(client: LLMClient): PromptTemplateManager {
  return (client as any).templateManager;
}
