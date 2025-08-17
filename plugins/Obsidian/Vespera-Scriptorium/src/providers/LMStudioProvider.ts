/**
 * LM Studio Provider for LLMClient
 * Handles communication with the LM Studio API (OpenAI-compatible)
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
 * Interface for LM Studio API model response (OpenAI format)
 */
interface LMStudioModelResponse {
  data: {
    id: string;
    object: string;
    created: number;
    owned_by: string;
  }[];
  object: string;
}

/**
 * Interface for LM Studio API completion response (OpenAI format)
 */
interface LMStudioCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    text: string;
    index: number;
    logprobs: null;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Interface for LM Studio API streaming completion response (OpenAI format)
 */
interface LMStudioStreamingResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    text: string;
    index: number;
    logprobs: null;
    finish_reason: string | null;
  }[];
}

/**
 * LM Studio Provider implementation
 */
export class LMStudioProvider implements LLMProvider {
  private endpoint: string;
  private timeout: number;
  private maxRetries: number;

  /**
   * Create a new LMStudioProvider instance
   *
   * @param config Provider configuration
   */
  constructor(config: ProviderConfig) {
    if (config.type !== ProviderType.LM_STUDIO) {
      throw new Error(`Invalid provider type: ${config.type}`);
    }

    this.endpoint = config.endpoint || 'http://localhost:1234/v1';
    this.timeout = config.timeout || 30000;
    this.maxRetries = config.maxRetries || 3;
  }

  /**
   * Get the provider type
   */
  getType(): ProviderType {
    return ProviderType.LM_STUDIO;
  }

  /**
   * List available models from LM Studio
   */
  async listModels(): Promise<Model[]> {
    try {
      const response = await this.fetchWithTimeout(`${this.endpoint}/v1/models`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }

      const data = await response.json() as LMStudioModelResponse;
      return data.data.map(model => this.convertLMStudioModel(model));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Generate completion for a prompt
   */
  async generateCompletion(prompt: string, options: CompletionOptions): Promise<string> {
    try {
      // Rough estimation of token count (4 chars per token is a common approximation)
      const estimatedTokens = Math.ceil(prompt.length / 4);

      // Get model info to check context window
      let models: Model[] = [];
      try {
        models = await this.listModels();
      } catch (e) {
        console.warn("Could not fetch models to check context window:", e);
      }

      // Find the selected model
      const selectedModel = models.find(m => m.id === options.model);
      const contextWindow = selectedModel?.contextWindow || 4096;

      // Check if the estimated token count exceeds the model's context window
      if (estimatedTokens > contextWindow) {
        throw new Error(`Estimated token count (${estimatedTokens}) exceeds model context window (${contextWindow})`);
      }

      const requestBody = this.createRequestBody(prompt, options);
      // Use the timeout from options if provided, otherwise use the default timeout
      const requestTimeout = options.timeout || this.timeout;
      const response = await this.fetchWithTimeout(`${this.endpoint}/v1/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }, requestTimeout);

      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }

      const data = await response.json() as LMStudioCompletionResponse;

      // Return the text from the first choice
      if (data.choices && data.choices.length > 0) {
        return data.choices[0].text || '';
      }

      return '';
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Stream completion for a prompt
   */
  async streamCompletion(prompt: string, options: CompletionOptions, callback: StreamingCallback): Promise<void> {
    try {
      // Ensure stream option is set to true
      const requestBody = this.createRequestBody(prompt, { ...options, stream: true });

      // Use the timeout from options if provided, otherwise use the default timeout
      const requestTimeout = options.timeout || this.timeout;
      const response = await this.fetchWithTimeout(`${this.endpoint}/v1/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }, requestTimeout);

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
      let isDone = false;
      let accumulatedText = '';
      
      // Add a flag to track if we've seen the [DONE] marker
      let seenDoneMarker = false;

      while (!isDone) {
        const { done, value } = await reader.read();

        if (done) {
          // Send the final accumulated text
          if (accumulatedText) {
            callback(accumulatedText, true);
          } else {
            callback('', true);
          }
          break;
        }

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines from the buffer (SSE format)
        let lineStart = 0;
        let lineEnd = buffer.indexOf('\n', lineStart);

        while (lineEnd !== -1) {
          const line = buffer.substring(lineStart, lineEnd).trim();

          // SSE data lines start with "data: "
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6).trim();

            // Check for the "[DONE]" marker that indicates the end of the stream
            if (dataStr === '[DONE]') {
              if (!seenDoneMarker) {
                seenDoneMarker = true;
                isDone = true;
                
                // Send the final accumulated text
                if (accumulatedText) {
                  callback(accumulatedText, true);
                } else {
                  callback('', true);
                }
              }
              break;
            }

            if (dataStr) {
              try {
                const chunk = JSON.parse(dataStr) as LMStudioStreamingResponse;

                if (chunk.choices && chunk.choices.length > 0) {
                  const text = chunk.choices[0].text || '';  // Ensure text is never undefined
                  const finishReason = chunk.choices[0].finish_reason !== null;

                  // Simply accumulate the text
                  accumulatedText += text;

                  // For streaming UI updates, call the callback with each token
                  if (text) {
                    callback(text, finishReason);
                  }

                  // If the model signals completion, mark as done
                  if (finishReason) {
                    isDone = true;
                    break;
                  }
                }
              } catch (e) {
                console.error('Error parsing JSON chunk:', e);
                // Continue processing even if one chunk fails to parse
              }
            }
          }

          lineStart = lineEnd + 1;
          lineEnd = buffer.indexOf('\n', lineStart);
        }

        // Keep any incomplete data in the buffer, but clear processed data
        buffer = buffer.substring(lineStart);

        // Emergency break if we've seen done marker
        if (seenDoneMarker) {
          break;
        }
      }
      
      // No need for an additional final check as we've already sent the complete response
      // in the processAccumulatedJson function when we received the [DONE] marker or
      // when the reader indicated it was done
      
      // Log completion of streaming
      console.log(`LM Studio streaming completed`);
      
    } catch (error) {
      console.error('Error in streamCompletion:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get token usage for a prompt and completion
   */
  async getTokenUsage(prompt: string, completion: string): Promise<TokenUsage> {
    try {
      // For LM Studio, we'll make a non-streaming completion request to get token counts
      // from the usage field in the response
      const options: CompletionOptions = {
        model: 'default', // Use any available model
        prompt: 'token usage estimation', // Placeholder prompt
        maxTokens: 1, // Minimize token usage for this request
        stream: false
      };

      const requestBody = this.createRequestBody(prompt, options);
      // Use a short timeout for token usage requests
      const response = await this.fetchWithTimeout(`${this.endpoint}/v1/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }, 10000); // Use a shorter timeout for token usage requests

      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }

      const data = await response.json() as LMStudioCompletionResponse;

      // If we have usage information, use it
      if (data.usage) {
        return {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        };
      }

      // Fallback to rough estimation if usage information is not available
      return this.estimateTokenUsage(prompt, completion);
    } catch (error) {
      // Fallback to estimation if the API call fails
      return this.estimateTokenUsage(prompt, completion);
    }
  }

  /**
   * Test the connection to the LM Studio API
   * @returns Promise resolving to true if the connection is successful, false otherwise
   */
  async testConnection(): Promise<boolean> {
    try {
      // Use a short timeout for the connection test
      const response = await this.fetchWithTimeout(`${this.endpoint}/v1/models`, {
        method: 'GET',
      }, 5000); // 5 seconds timeout for connection test

      // Consider any 2xx status code as a successful connection
      return response.ok;
    } catch (error) {
      console.error('LM Studio connection test failed:', error);
      // Return false on any error during the test
      return false;
    }
  }

  /**
   * Estimate token usage based on text length
   *
   * @param prompt Prompt text
   * @param completion Completion text
   * @returns Estimated token usage
   */
  private estimateTokenUsage(prompt: string, completion: string): TokenUsage {
    // Rough estimation: ~4 characters per token for English text
    const promptTokens = Math.ceil(prompt.length / 4);
    const completionTokens = Math.ceil(completion.length / 4);

    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens
    };
  }

  /**
   * Convert LM Studio model to our Model interface
   *
   * @param lmStudioModel LM Studio model object
   * @returns Model object
   */
  private convertLMStudioModel(lmStudioModel: LMStudioModelResponse['data'][0]): Model {
    // Extract model name from ID
    const name = lmStudioModel.id;

    // Default context window size
    // LM Studio doesn't provide context window info in the API response directly
    // We can infer from model name for known models or use a conservative default
    let contextWindow = 4096; // Default conservative value

    // Try to infer context window from model name
    if (name.includes('gemma-3-4b-it-qat')) {
      contextWindow = 4096; // Gemma 3 4B has 4K context
    } else if (name.includes('gemma-7b')) {
      contextWindow = 8192; // Gemma 7B has 8K context
    } else if (name.includes('llama-2-7b')) {
      contextWindow = 4096; // Llama 2 7B has 4K context
    } else if (name.includes('llama-2-13b')) {
      contextWindow = 4096; // Llama 2 13B has 4K context
    } else if (name.includes('llama-2-70b')) {
      contextWindow = 4096; // Llama 2 70B has 4K context
    } else if (name.includes('llama-3-8b')) {
      contextWindow = 8192; // Llama 3 8B has 8K context
    } else if (name.includes('llama-3-70b')) {
      contextWindow = 8192; // Llama 3 70B has 8K context
    } else if (name.includes('mistral-7b')) {
      contextWindow = 8192; // Mistral 7B has 8K context
    } else if (name.includes('mixtral-8x7b')) {
      contextWindow = 32768; // Mixtral 8x7B has 32K context
    } else if (name.includes('phi-2')) {
      contextWindow = 2048; // Phi-2 has 2K context
    }

    return {
      id: lmStudioModel.id,
      name,
      provider: ProviderType.LM_STUDIO,
      contextWindow,
      supportedFeatures: {
        streaming: true,
        functionCalling: false,
        vision: false
      }
    };
  }

  /**
   * Create request body for LM Studio API (OpenAI format)
   *
   * @param prompt Prompt text
   * @param options Completion options
   * @returns Request body object
   */
  private createRequestBody(prompt: string, options: CompletionOptions): Record<string, any> {
    // Use the standard completions format for LM Studio
    return {
      model: options.model,
      prompt: prompt,
      max_tokens: options.maxTokens || 2048,
      temperature: options.temperature,
      top_p: options.topP,
      frequency_penalty: options.frequencyPenalty,
      presence_penalty: options.presencePenalty,
      stop: options.stop,
      stream: options.stream === true
    };
  }

  /**
   * Fetch with timeout
   *
   * @param url URL to fetch
   * @param options Fetch options
   * @param customTimeout Optional custom timeout in milliseconds
   * @returns Promise resolving to the Response
   */
  private async fetchWithTimeout(url: string, options: RequestInit, customTimeout?: number): Promise<Response> {
    const controller = new AbortController();
    const timeout = customTimeout !== undefined ? customTimeout : this.timeout;
    let timeoutId: NodeJS.Timeout | null = null;

    const timeoutPromise = new Promise<Response>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        const timeoutError = new Error(`Request timed out after ${timeout}ms`) as LLMError;
        timeoutError.type = ErrorType.TIMEOUT;
        timeoutError.provider = ProviderType.LM_STUDIO;
        timeoutError.retryable = true;
        // Note: Capturing partial response for streaming is complex with standard fetch and AbortController.
        // For now, we won't attempt to capture partial responses on timeout for streaming.
        reject(timeoutError);
      }, timeout);
    });

    try {
      const fetchPromise = fetch(url, {
        ...options,
        signal: controller.signal
      });

      return await Promise.race([fetchPromise, timeoutPromise]);

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new Error(`Request timed out after ${timeout}ms`) as LLMError;
        timeoutError.type = ErrorType.TIMEOUT;
        timeoutError.provider = ProviderType.LM_STUDIO;
        timeoutError.retryable = true;
        throw timeoutError;
      }
      throw error;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  /**
   * Handle error response from LM Studio API
   *
   * @param response HTTP response
   * @returns LLMError
   */
  private async handleErrorResponse(response: Response): Promise<LLMError> {
    let errorMessage = `LM Studio API error: ${response.status} ${response.statusText}`;
    let errorType = ErrorType.PROVIDER_ERROR;
    let retryable = false;
    let errorData: any = null;

    try {
      errorData = await response.json();
      if (errorData.error) {
        errorMessage = `LM Studio API error: ${errorData.error.message || errorData.error}`;

        // Check for specific LM Studio errors indicating model not loaded
        if (errorData.error.message && errorData.error.message.includes('model not loaded')) {
          errorType = ErrorType.PROVIDER_ERROR; // Using PROVIDER_ERROR for now, could add MODEL_NOT_LOADED
          errorMessage = `LM Studio error: Model '${errorData.model}' not loaded.`;
          retryable = false; // Not retryable until loaded
        }
      }
    } catch (e) {
      // Ignore JSON parsing errors if the response is not JSON
    }

    // Map HTTP status codes to error types
    switch (response.status) {
      case 400:
        errorType = ErrorType.INVALID_REQUEST;
        retryable = false;
        break;
      case 404:
        errorType = ErrorType.PROVIDER_ERROR;
        errorMessage = 'LM Studio API endpoint incorrect or resource not found.';
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
    error.provider = ProviderType.LM_STUDIO;
    error.statusCode = response.status;
    error.retryable = retryable;
    // Attach original error data if available
    if (errorData) {
      (error as any).originalErrorData = errorData;
    }

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
        errorMessage = 'Could not connect to LM Studio API. Is LM Studio running?';
        retryable = true;
      } else if (error.message.includes('timed out') || error.name === 'AbortError') {
        errorType = ErrorType.TIMEOUT;
        retryable = true;
      }
    }

    const llmError = new Error(errorMessage) as LLMError;
    llmError.type = errorType;
    llmError.provider = ProviderType.LM_STUDIO;
    llmError.retryable = retryable;

    return llmError;
  }

  /**
   * Explicitly load a model in LM Studio by making a small request.
   * LM Studio loads models on first use. This simulates that first use.
   * @param modelName The name of the model to load.
   */
  async loadModel(modelName: string): Promise<void> {
    console.log(`Attempting to load LM Studio model: ${modelName}`);
    try {
      // Make a minimal completion request to trigger loading
      const options: CompletionOptions = {
        model: modelName,
        maxTokens: 1,
        prompt: 'hello', // Minimal prompt
        stream: false
      };
      const requestBody = this.createRequestBody(options.prompt, options);

      // Use a short timeout for the loading attempt
      const response = await this.fetchWithTimeout(`${this.endpoint}/v1/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }, 15000); // 15 seconds timeout for loading attempt

      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }
      console.log(`LM Studio model '${modelName}' loading attempt successful.`);
    } catch (error) {
      const llmError = this.handleError(error);
      // If the error is a 'model not loaded' error, it means the model exists but needs loading,
      // which is expected during the loading phase. We can potentially ignore this specific error
      // or handle it by waiting and retrying isModelReady. For now, we'll re-throw other errors.
      if (llmError.type === ErrorType.PROVIDER_ERROR && llmError.message.includes('model not loaded')) {
        console.log(`LM Studio model '${modelName}' is not loaded, which is expected during loadModel call.`);
        // We don't re-throw here, as the subsequent isModelReady check will confirm readiness.
      } else {
        console.error(`Error attempting to load LM Studio model '${modelName}':`, llmError);
        throw llmError;
      }
    }
  }

  /**
   * Check if a specific model is loaded and ready for inference in LM Studio.
   * @param modelName The name of the model to check.
   * @returns Promise resolving to true if the model is ready, false otherwise.
   */
  async isModelReady(modelName: string): Promise<boolean> {
    console.log(`Checking if LM Studio model '${modelName}' is ready...`);
    try {
      // Attempt a minimal completion request. If it succeeds, the model is likely loaded.
      const options: CompletionOptions = {
        model: modelName,
        maxTokens: 1,
        prompt: 'test', // Minimal prompt
        stream: false
      };
      const requestBody = this.createRequestBody(options.prompt, options);

      // Use a short timeout for the readiness check
      const response = await this.fetchWithTimeout(`${this.endpoint}/v1/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }, 5000); // 5 seconds timeout for readiness check

      if (response.ok) {
        console.log(`LM Studio model '${modelName}' is ready.`);
        return true;
      } else {
        const error = await this.handleErrorResponse(response);
        // If the error is 'model not loaded', the model is not ready.
        if (error.type === ErrorType.PROVIDER_ERROR && error.message.includes('model not loaded')) {
          console.log(`LM Studio model '${modelName}' is not ready (model not loaded error).`);
          return false;
        }
        // For any other error, re-throw
        throw error;
      }
    } catch (error) {
      const llmError = this.handleError(error);
      // If the error is 'model not loaded', the model is not ready.
      if (llmError.type === ErrorType.PROVIDER_ERROR && llmError.message.includes('model not loaded')) {
        console.log(`LM Studio model '${modelName}' is not ready (caught model not loaded error).`);
        return false;
      }
      console.error(`Error checking if LM Studio model '${modelName}' is ready:`, llmError);
      // For any other error, assume not ready or a connection issue
      return false;
    }
  }
}