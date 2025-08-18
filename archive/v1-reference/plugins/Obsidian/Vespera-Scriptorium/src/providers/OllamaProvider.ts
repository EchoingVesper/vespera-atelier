/**
 * Ollama Provider for LLMClient
 * Handles communication with the Ollama API
 */

import { 
  LLMProvider, 
  ProviderType, 
  Model, 
  CompletionOptions, 
  StreamingCallback, 
  TokenUsage,
  ErrorType,
  LLMError,
  ProviderConfig
} from '../LLMClient';

/**
 * Interface for Ollama API responses
 */
interface OllamaModelResponse {
  models: {
    name: string;
    modified_at: string;
    size: number;
    digest: string;
    details: {
      parameter_size?: string;
      quantization_level?: string;
      format?: string;
    };
  }[];
}

/**
 * Interface for Ollama generation response
 */
interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

/**
 * Ollama Provider implementation
 */
export class OllamaProvider implements LLMProvider {
  private endpoint: string;
  private timeout: number;
  private maxRetries: number;

  /**
   * Create a new OllamaProvider instance
   * 
   * @param config Provider configuration
   */
  constructor(config: ProviderConfig) {
    if (config.type !== ProviderType.OLLAMA) {
      throw new Error(`Invalid provider type: ${config.type}`);
    }

    this.endpoint = config.endpoint || 'http://localhost:11434';
    this.timeout = config.timeout || 30000;
    this.maxRetries = config.maxRetries || 3;
  }

  /**
   * Get the provider type
   */
  getType(): ProviderType {
    return ProviderType.OLLAMA;
  }

  /**
   * List available models from Ollama
   */
  async listModels(): Promise<Model[]> {
    try {
      const response = await this.fetchWithTimeout(`${this.endpoint}/api/tags`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }

      const data = await response.json() as OllamaModelResponse;
      return data.models.map(model => this.convertOllamaModel(model));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Generate completion for a prompt
   */
  async generateCompletion(prompt: string, options: CompletionOptions): Promise<string> {
    try {
      const requestBody = this.createRequestBody(prompt, options);
      const response = await this.fetchWithTimeout(`${this.endpoint}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }

      const data = await response.json() as OllamaGenerateResponse;
      return data.response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Stream completion for a prompt
   */
  async streamCompletion(prompt: string, options: CompletionOptions, callback: StreamingCallback): Promise<void> {
    try {
      const requestBody = this.createRequestBody(prompt, options);
      const response = await this.fetchWithTimeout(`${this.endpoint}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }

      // Ensure we have a ReadableStream
      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // Call callback one last time if there's any remaining text
          if (buffer.length > 0) {
            callback(buffer, true);
          }
          break;
        }

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete JSON objects from the buffer
        let jsonStart = 0;
        let jsonEnd = buffer.indexOf('\n', jsonStart);
        
        while (jsonEnd !== -1) {
          const jsonStr = buffer.substring(jsonStart, jsonEnd).trim();
          if (jsonStr) {
            try {
              const chunk = JSON.parse(jsonStr) as OllamaGenerateResponse;
              callback(chunk.response, chunk.done);
              
              // If the model signals completion, we're done
              if (chunk.done) {
                return;
              }
            } catch (e) {
              console.error('Error parsing JSON chunk:', e);
            }
          }
          
          jsonStart = jsonEnd + 1;
          jsonEnd = buffer.indexOf('\n', jsonStart);
        }
        
        // Keep any incomplete data in the buffer
        buffer = buffer.substring(jsonStart);
      }
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get token usage for a prompt and completion
   */
  async getTokenUsage(prompt: string, completion: string): Promise<TokenUsage> {
    try {
      // For Ollama, we need to make a tokenize request to get token counts
      const promptTokens = await this.countTokens(prompt);
      const completionTokens = await this.countTokens(completion);
      
      return {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Test the connection to the Ollama API
   * @returns Promise resolving to true if the connection is successful, false otherwise
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(`${this.endpoint}/api/tags`, {
        method: 'GET',
      });
      // Consider any 2xx status code as a successful connection
      return response.ok;
    } catch (error) {
      console.error('Ollama connection test failed:', error);
      // Return false on any error during the test
      return false;
    }
  }

  /**
   * Count tokens in a text string
   * 
   * @param text Text to count tokens for
   * @returns Number of tokens
   */
  private async countTokens(text: string): Promise<number> {
    try {
      const response = await this.fetchWithTimeout(`${this.endpoint}/api/tokenize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: text
        }),
      });

      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }

      const data = await response.json();
      return data.tokens?.length || 0;
    } catch (error) {
      console.error('Error counting tokens:', error);
      // Fallback to rough estimation if tokenize endpoint fails
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * Convert Ollama model to our Model interface
   * 
   * @param ollamaModel Ollama model object
   * @returns Model object
   */
  private convertOllamaModel(ollamaModel: OllamaModelResponse['models'][0]): Model {
    // Extract context window size from model name if possible
    // Many models include context window in their name like "llama2:7b-chat"
    let contextWindow = 4096; // Default context window
    
    // Try to determine context window from parameter size
    const paramSizeStr = ollamaModel.details?.parameter_size;
    if (paramSizeStr) {
      if (paramSizeStr.includes('7b')) {
        contextWindow = 4096;
      } else if (paramSizeStr.includes('13b')) {
        contextWindow = 8192;
      } else if (paramSizeStr.includes('70b')) {
        contextWindow = 32768;
      }
    }

    return {
      id: ollamaModel.name,
      name: ollamaModel.name,
      provider: ProviderType.OLLAMA,
      contextWindow,
      supportedFeatures: {
        streaming: true,
        functionCalling: false,
        vision: false
      }
    };
  }

  /**
   * Create request body for Ollama API
   * 
   * @param prompt Prompt text
   * @param options Completion options
   * @returns Request body object
   */
  private createRequestBody(prompt: string, options: CompletionOptions): Record<string, any> {
    return {
      model: options.model,
      prompt,
      stream: options.stream === true,
      options: {
        temperature: options.temperature,
        top_p: options.topP,
        frequency_penalty: options.frequencyPenalty,
        presence_penalty: options.presencePenalty,
        stop: options.stop,
        num_predict: options.maxTokens
      }
    };
  }

  /**
   * Fetch with timeout
   * 
   * @param url URL to fetch
   * @param options Fetch options
   * @returns Response
   */
  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new Error(`Request timed out after ${this.timeout}ms`) as LLMError;
        timeoutError.type = ErrorType.TIMEOUT;
        timeoutError.provider = ProviderType.OLLAMA;
        timeoutError.retryable = true;
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Handle error response from Ollama API
   * 
   * @param response HTTP response
   * @returns LLMError
   */
  private async handleErrorResponse(response: Response): Promise<LLMError> {
    let errorMessage = `Ollama API error: ${response.status} ${response.statusText}`;
    let errorType = ErrorType.PROVIDER_ERROR;
    let retryable = false;

    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = `Ollama API error: ${errorData.error}`;
      }
    } catch (e) {
      // Ignore JSON parsing errors
    }

    // Map HTTP status codes to error types
    switch (response.status) {
      case 400:
        errorType = ErrorType.INVALID_REQUEST;
        retryable = false;
        break;
      case 404:
        errorType = ErrorType.PROVIDER_ERROR;
        errorMessage = 'Model not found or Ollama API endpoint incorrect';
        retryable = false;
        break;
      case 408:
        errorType = ErrorType.TIMEOUT;
        retryable = true;
        break;
      case 429:
        errorType = ErrorType.RATE_LIMIT;
        retryable = true;
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        errorType = ErrorType.PROVIDER_ERROR;
        retryable = true;
        break;
      default:
        if (response.status >= 500) {
          errorType = ErrorType.PROVIDER_ERROR;
          retryable = true;
        } else if (response.status >= 400) {
          errorType = ErrorType.INVALID_REQUEST;
          retryable = false;
        }
    }

    const error = new Error(errorMessage) as LLMError;
    error.type = errorType;
    error.provider = ProviderType.OLLAMA;
    error.statusCode = response.status;
    error.retryable = retryable;
    
    return error;
  }

  /**
   * Handle general errors
   * 
   * @param error Error object
   * @returns LLMError
   */
  private handleError(error: unknown): LLMError {
    // If it's already an LLMError, just return it
    if (error instanceof Error && 'type' in error && 'provider' in error && 'retryable' in error) {
      return error as LLMError;
    }

    let errorMessage = 'Unknown error';
    let errorType = ErrorType.UNKNOWN;
    let retryable = false;

    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Determine error type from error message
      if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        errorType = ErrorType.CONNECTION;
        errorMessage = 'Could not connect to Ollama API. Is Ollama running?';
        retryable = true;
      } else if (error.message.includes('timed out')) {
        errorType = ErrorType.TIMEOUT;
        retryable = true;
      } else if (error.name === 'AbortError') {
        errorType = ErrorType.TIMEOUT;
        retryable = true;
      }
    }

    const llmError = new Error(errorMessage) as LLMError;
    llmError.type = errorType;
    llmError.provider = ProviderType.OLLAMA;
    llmError.retryable = retryable;
    
    return llmError;
  }

  /**
   * Explicitly load a model into memory using the Ollama /api/pull endpoint.
   * This method will stream the pull progress and resolve when the model is ready.
   * @param modelName The name of the model to load.
   */
  async loadModel(modelName: string): Promise<void> {
    try {
      const response = await this.fetchWithTimeout(`${this.endpoint}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: modelName, stream: true }),
      });

      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }

      // Stream the response to monitor pull progress
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Process complete lines (each line is a JSON object)
          let lineEnd = buffer.indexOf('\n');
          while (lineEnd !== -1) {
            const line = buffer.substring(0, lineEnd).trim();
            if (line) {
              try {
                const progress = JSON.parse(line);
                // You could add logging or progress reporting here
                // console.log(`Ollama pull progress: ${JSON.stringify(progress)}`);
                if (progress.status === 'success') {
                  console.log(`Ollama model '${modelName}' pulled successfully.`);
                }
              } catch (e) {
                console.error('Error parsing Ollama pull progress:', e);
              }
            }
            buffer = buffer.substring(lineEnd + 1);
            lineEnd = buffer.indexOf('\n');
          }
        }
      }

      // After pulling, verify the model is ready
      const isReady = await this.isModelReady(modelName);
      if (!isReady) {
        throw new Error(`Model '${modelName}' pulled but not listed as ready.`);
      }

    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Check if a specific model is available locally in Ollama.
   * @param modelName The name of the model to check.
   * @returns Promise resolving to true if the model is available, false otherwise.
   */
  async isModelReady(modelName: string): Promise<boolean> {
    try {
      const models = await this.listModels();
      return models.some(model => model.name === modelName);
    } catch (error) {
      console.error(`Error checking if Ollama model '${modelName}' is ready:`, error);
      return false;
    }
  }
}