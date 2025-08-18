import { LLMProviderConfig, LLMProviderStrategy, LLMRequestOptions } from '../types/llm';

/**
 * Get the default LLM provider from the configuration
 * @param providers Available LLM providers
 * @param defaultProviderId Default provider ID (optional)
 * @returns The default provider or undefined if not found
 */
export function getDefaultProvider(
  providers: Record<string, LLMProviderConfig> = {},
  defaultProviderId?: string
): LLMProviderConfig | undefined {
  if (!defaultProviderId || !providers[defaultProviderId]) {
    // Find the first enabled provider
    const enabledProviders = Object.entries(providers)
      .filter(([_, config]) => config.enabled)
      .sort((a, b) => (a[1].priority ?? 0) - (b[1].priority ?? 0));

    return enabledProviders[0]?.[1];
  }
  
  return providers[defaultProviderId];
}

/**
 * Select a provider based on the strategy
 * @param providers Available LLM providers
 * @param strategy Selection strategy
 * @param fallbackOrder Fallback order for 'fallback' strategy
 * @returns Selected provider or undefined if none available
 */
export function selectProvider(
  providers: Record<string, LLMProviderConfig> = {},
  strategy: LLMProviderStrategy = 'fallback',
  fallbackOrder: string[] = []
): LLMProviderConfig | undefined {
  const enabledProviders = Object.entries(providers)
    .filter(([_, config]) => config.enabled)
    .sort((a, b) => (a[1].priority ?? 0) - (b[1].priority ?? 0));

  if (enabledProviders.length === 0) {
    return undefined;
  }

  switch (strategy) {
    case 'priority':
      return enabledProviders[0]?.[1];
      
    case 'round-robin':
      // Simple round-robin implementation - in a real app, you'd want to track the last used provider
      const lastUsedIndex = 0; // This would be tracked in a real implementation
      const nextIndex = (lastUsedIndex + 1) % enabledProviders.length;
      return enabledProviders[nextIndex]?.[1];
      
    case 'fallback':
    default:
      // Try providers in fallback order, then by priority
      for (const providerId of fallbackOrder) {
        const provider = providers[providerId];
        if (provider?.enabled) {
          return provider;
        }
      }
      return enabledProviders[0]?.[1];
  }
}

/**
 * Merge request options with provider defaults
 * @param provider The LLM provider configuration
 * @param options Request options to merge
 * @returns Merged options
 */
export function mergeRequestOptions(
  provider: LLMProviderConfig,
  options: LLMRequestOptions = {}
): LLMRequestOptions {
  return {
    model: options.model ?? provider.model,
    temperature: options.temperature ?? provider.temperature,
    maxTokens: options.maxTokens ?? provider.maxTokens,
    topP: options.topP ?? provider.topP,
    frequencyPenalty: options.frequencyPenalty ?? provider.frequencyPenalty,
    presencePenalty: options.presencePenalty ?? provider.presencePenalty,
    timeout: options.timeout ?? provider.timeout,
    maxRetries: options.maxRetries ?? provider.maxRetries,
    retryDelay: options.retryDelay ?? provider.retryDelay,
    ...options
  };
}

/**
 * Validate provider configuration
 * @param provider Provider configuration to validate
 * @returns Array of validation errors, empty if valid
 */
export function validateProviderConfig(provider: LLMProviderConfig): string[] {
  const errors: string[] = [];

  if (!provider.name || typeof provider.name !== 'string') {
    errors.push('Provider name is required');
  }

  if (provider.type === 'openai' && !provider.apiKey) {
    errors.push('API key is required for OpenAI provider');
  }

  if (provider.type === 'ollama' && !provider.baseUrl) {
    errors.push('Base URL is required for Ollama provider');
  }

  if (provider.timeout !== undefined && (typeof provider.timeout !== 'number' || provider.timeout < 0)) {
    errors.push('Timeout must be a positive number');
  }

  if (provider.maxRetries !== undefined && (typeof provider.maxRetries !== 'number' || provider.maxRetries < 0)) {
    errors.push('Max retries must be a non-negative number');
  }

  if (provider.retryDelay !== undefined && (typeof provider.retryDelay !== 'number' || provider.retryDelay < 0)) {
    errors.push('Retry delay must be a non-negative number');
  }

  return errors;
}

/**
 * Get provider-specific configuration
 * @param provider Provider configuration
 * @returns Provider-specific configuration
 */
export function getProviderConfig(provider: LLMProviderConfig) {
  if (provider.type === 'openai') {
    const { type, enabled, name, priority, ...rest } = provider;
    return rest;
  } else if (provider.type === 'ollama') {
    const { type, enabled, name, priority, ...rest } = provider;
    return rest;
  }
  
  return {};
}
