/**
 * Context Window Detector
 * Dynamically detects the maximum context window size for LLM models.
 * @module ContextWindowDetector
 */

import { ProviderType, LLMProvider, ErrorType } from '../LLMClient';

/**
 * Cache entry for context window sizes
 */
interface ContextWindowCacheEntry {
  size: number;
  timestamp: number;
  confidence: 'exact' | 'estimated';
}

/**
 * Options for context window detection
 */
export interface ContextWindowDetectionOptions {
  /**
   * Minimum window size to start probing from
   * @default 1024
   */
  minWindowSize?: number;

  /**
   * Maximum window size to probe up to
   * @default 131072 (128K)
   */
  maxWindowSize?: number;

  /**
   * Time-to-live for cache entries in milliseconds
   * @default 86400000 (24 hours)
   */
  cacheTTL?: number;

  /**
   * Whether to use API-based detection when available
   * @default true
   */
  useApiDetection?: boolean;

  /**
   * Whether to use binary search for probing
   * @default true
   */
  useBinarySearch?: boolean;

  /**
   * Timeout for each probe attempt in milliseconds
   * @default 10000 (10 seconds)
   */
  probeTimeout?: number;
}

/**
 * Default options for context window detection
 */
const DEFAULT_DETECTION_OPTIONS: ContextWindowDetectionOptions = {
  minWindowSize: 1024,
  maxWindowSize: 131072, // 128K
  cacheTTL: 86400000, // 24 hours
  useApiDetection: true,
  useBinarySearch: true,
  probeTimeout: 10000
};

/**
 * Context Window Detector class
 * Responsible for detecting the maximum context window size for LLM models
 */
export class ContextWindowDetector {
  private cache: Map<string, ContextWindowCacheEntry> = new Map();
  private options: ContextWindowDetectionOptions;

  /**
   * Create a new ContextWindowDetector instance
   * 
   * @param options Detection options
   */
  constructor(options: ContextWindowDetectionOptions = {}) {
    this.options = { ...DEFAULT_DETECTION_OPTIONS, ...options };
  }

  /**
   * Get a cached context window size
   * 
   * @param provider Provider type
   * @param model Model name
   * @returns Cached context window size or undefined if not cached or expired
   */
  public getCachedContextWindow(provider: ProviderType, model: string): number | undefined {
    const cacheKey = `${provider}:${model}`;
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      return undefined;
    }

    // Check if the entry has expired
    const now = Date.now();
    if (now - entry.timestamp > (this.options.cacheTTL || DEFAULT_DETECTION_OPTIONS.cacheTTL!)) {
      this.cache.delete(cacheKey);
      return undefined;
    }

    return entry.size;
  }

  /**
   * Update the context window size cache
   * 
   * @param provider Provider type
   * @param model Model name
   * @param size Context window size
   * @param confidence Whether the size is exact or estimated
   */
  public updateCache(provider: ProviderType, model: string, size: number, confidence: 'exact' | 'estimated' = 'exact'): void {
    const cacheKey = `${provider}:${model}`;
    this.cache.set(cacheKey, {
      size,
      timestamp: Date.now(),
      confidence
    });
  }

  /**
   * Detect the maximum context window size for a model
   * 
   * @param provider LLM provider instance
   * @param model Model name
   * @returns Promise resolving to the detected context window size
   */
  public async detectContextWindow(provider: LLMProvider, model: string): Promise<number> {
    const providerType = provider.getType();
    
    // Check cache first
    const cachedSize = this.getCachedContextWindow(providerType, model);
    if (cachedSize !== undefined) {
      console.log(`Using cached context window size for ${model}: ${cachedSize}`);
      return cachedSize;
    }

    // Try API-based detection first if enabled
    if (this.options.useApiDetection) {
      try {
        const apiSize = await this.detectViaApi(provider, model);
        if (apiSize > 0) {
          this.updateCache(providerType, model, apiSize, 'exact');
          return apiSize;
        }
      } catch (error) {
        console.warn(`API-based context window detection failed for ${model}:`, error);
        // Fall through to probing
      }
    }

    // Fall back to probing
    try {
      const probedSize = await this.probeWithBinarySearch(provider, model);
      this.updateCache(providerType, model, probedSize, 'estimated');
      return probedSize;
    } catch (error) {
      console.error(`Failed to detect context window size for ${model}:`, error);
      
      // Return a conservative estimate based on model name
      const conservativeSize = this.getConservativeEstimate(model);
      this.updateCache(providerType, model, conservativeSize, 'estimated');
      return conservativeSize;
    }
  }

  /**
   * Detect context window size via provider API
   * 
   * @param provider LLM provider instance
   * @param model Model name
   * @returns Promise resolving to the context window size or 0 if not available
   */
  private async detectViaApi(provider: LLMProvider, model: string): Promise<number> {
    try {
      // Get models from the provider
      const models = await provider.listModels();
      
      // Find the requested model
      const modelInfo = models.find(m => m.id === model || m.name === model);
      
      if (modelInfo && modelInfo.contextWindow) {
        console.log(`Detected context window via API for ${model}: ${modelInfo.contextWindow}`);
        return modelInfo.contextWindow;
      }
      
      return 0; // API detection not available
    } catch (error) {
      console.warn(`Error detecting context window via API:`, error);
      return 0;
    }
  }

  /**
   * Probe for context window size using binary search
   * 
   * @param provider LLM provider instance
   * @param model Model name
   * @returns Promise resolving to the detected context window size
   */
  private async probeWithBinarySearch(provider: LLMProvider, model: string): Promise<number> {
    console.log(`Probing context window size for ${model} using binary search...`);
    
    const minSize = this.options.minWindowSize || DEFAULT_DETECTION_OPTIONS.minWindowSize!;
    const maxSize = this.options.maxWindowSize || DEFAULT_DETECTION_OPTIONS.maxWindowSize!;
    
    // Start with binary search if enabled, otherwise use linear search
    if (this.options.useBinarySearch) {
      return this.binarySearchProbe(provider, model, minSize, maxSize);
    } else {
      return this.linearSearchProbe(provider, model, minSize, maxSize);
    }
  }

  /**
   * Probe for context window size using binary search
   * 
   * @param provider LLM provider instance
   * @param model Model name
   * @param min Minimum window size
   * @param max Maximum window size
   * @returns Promise resolving to the detected context window size
   */
  private async binarySearchProbe(provider: LLMProvider, model: string, min: number, max: number): Promise<number> {
    let low = min;
    let high = max;
    let lastSuccessful = min;
    
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      console.log(`Probing with size ${mid}...`);
      
      try {
        const success = await this.testContextSize(provider, model, mid);
        
        if (success) {
          lastSuccessful = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      } catch (error) {
        console.warn(`Error during probe with size ${mid}:`, error);
        high = mid - 1;
      }
    }
    
    // Apply a small safety margin (5%)
    const safeSize = Math.floor(lastSuccessful * 0.95);
    console.log(`Detected context window size for ${model}: ${lastSuccessful}, using safe size: ${safeSize}`);
    
    return safeSize;
  }

  /**
   * Probe for context window size using linear search
   * 
   * @param provider LLM provider instance
   * @param model Model name
   * @param min Minimum window size
   * @param max Maximum window size
   * @returns Promise resolving to the detected context window size
   */
  private async linearSearchProbe(provider: LLMProvider, model: string, min: number, max: number): Promise<number> {
    let size = min;
    let step = 1024; // Start with 1K steps
    let lastSuccessful = min;
    
    while (size <= max) {
      console.log(`Probing with size ${size}...`);
      
      try {
        const success = await this.testContextSize(provider, model, size);
        
        if (success) {
          lastSuccessful = size;
          
          // Increase step size as we go to speed up the process
          if (size >= 16384) { // 16K
            step = 4096; // 4K steps
          } else if (size >= 8192) { // 8K
            step = 2048; // 2K steps
          }
          
          size += step;
        } else {
          break;
        }
      } catch (error) {
        console.warn(`Error during probe with size ${size}:`, error);
        break;
      }
    }
    
    // Apply a small safety margin (5%)
    const safeSize = Math.floor(lastSuccessful * 0.95);
    console.log(`Detected context window size for ${model}: ${lastSuccessful}, using safe size: ${safeSize}`);
    
    return safeSize;
  }

  /**
   * Test if a specific context size works with the model
   * 
   * @param provider LLM provider instance
   * @param model Model name
   * @param size Context size to test
   * @returns Promise resolving to true if the size works, false otherwise
   */
  private async testContextSize(provider: LLMProvider, model: string, size: number): Promise<boolean> {
    // Generate a test prompt of the specified size
    // We use a simple repeating pattern to minimize token usage
    const testPrompt = this.generateTestPrompt(size);
    
    try {
      // Set a timeout for the test
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), this.options.probeTimeout || DEFAULT_DETECTION_OPTIONS.probeTimeout!);
      });
      
      // Try to generate a completion with the test prompt
      const completionPromise = provider.generateCompletion(testPrompt, {
        prompt: testPrompt,
        model,
        maxTokens: 10, // We only need a small completion
        temperature: 0.0, // Use deterministic output
        timeout: this.options.probeTimeout
      });
      
      // Race the completion against the timeout
      await Promise.race([completionPromise, timeoutPromise]);
      
      return true;
    } catch (error) {
      // Check if the error is related to context length
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        if (
          errorMessage.includes('context length') ||
          errorMessage.includes('maximum context') ||
          errorMessage.includes('too long') ||
          errorMessage.includes('exceeds') ||
          errorMessage.includes('token limit') ||
          errorMessage.includes('context window')
        ) {
          return false;
        }
        
        // If it's a timeout or connection error, we can't determine if the size works
        if (
          errorMessage.includes('timeout') ||
          errorMessage.includes('connection') ||
          'type' in error && (error as any).type === ErrorType.TIMEOUT ||
          'type' in error && (error as any).type === ErrorType.CONNECTION
        ) {
          throw new Error(`Timeout or connection error during context window detection: ${errorMessage}`);
        }
      }
      
      // For other errors, assume the size doesn't work
      return false;
    }
  }

  /**
   * Generate a test prompt of the specified size
   * 
   * @param tokenCount Approximate token count
   * @returns Test prompt
   */
  private generateTestPrompt(tokenCount: number): string {
    // We use a simple repeating pattern that's approximately 1 token per 4 characters
    // This is a rough approximation and may vary by tokenizer
    const charCount = tokenCount * 4;
    
    // Create a pattern that's easy to compress but still valid
    const pattern = 'The quick brown fox jumps over the lazy dog. ';
    const patternLength = pattern.length;
    
    // Calculate how many repetitions we need
    const repetitions = Math.ceil(charCount / patternLength);
    
    // Generate the prompt
    let prompt = '';
    for (let i = 0; i < repetitions; i++) {
      prompt += pattern;
    }
    
    // Trim to the desired length
    return prompt.substring(0, charCount);
  }

  /**
   * Get a conservative estimate of context window size based on model name
   * 
   * @param model Model name
   * @returns Conservative context window size estimate
   */
  private getConservativeEstimate(model: string): number {
    const modelLower = model.toLowerCase();
    
    // Try to infer context window from model name
    if (modelLower.includes('gemma-3-4b-it-qat')) {
      return 4096; // Gemma 3 4B has 4K context
    } else if (modelLower.includes('gemma-7b')) {
      return 8192; // Gemma 7B has 8K context
    } else if (modelLower.includes('llama-2-7b')) {
      return 4096; // Llama 2 7B has 4K context
    } else if (modelLower.includes('llama-2-13b')) {
      return 4096; // Llama 2 13B has 4K context
    } else if (modelLower.includes('llama-2-70b')) {
      return 4096; // Llama 2 70B has 4K context
    } else if (modelLower.includes('llama-3-8b')) {
      return 8192; // Llama 3 8B has 8K context
    } else if (modelLower.includes('llama-3-70b')) {
      return 8192; // Llama 3 70B has 8K context
    } else if (modelLower.includes('mistral-7b')) {
      return 8192; // Mistral 7B has 8K context
    } else if (modelLower.includes('mixtral-8x7b')) {
      return 32768; // Mixtral 8x7B has 32K context
    } else if (modelLower.includes('phi-2')) {
      return 2048; // Phi-2 has 2K context
    }
    
    // Default conservative estimate
    return 4096;
  }
}

/**
 * Create a context window detector instance
 * 
 * @param options Detection options
 * @returns Context window detector instance
 */
export function createContextWindowDetector(options: ContextWindowDetectionOptions = {}): ContextWindowDetector {
  return new ContextWindowDetector(options);
}