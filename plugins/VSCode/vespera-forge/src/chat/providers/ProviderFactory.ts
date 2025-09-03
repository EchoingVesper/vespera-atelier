/**
 * Provider Factory for creating and managing chat providers
 */
import { ChatProvider } from './BaseProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { LMStudioProvider } from './LMStudioProvider';
import { ClaudeCodeProvider } from './ClaudeCodeProvider';
import { ProviderTemplate, ProviderConfig } from '../types/provider';
import { ChatConfigurationManager } from '../core/ConfigurationManager';

export type ProviderType = 'openai' | 'anthropic' | 'lmstudio' | 'claude-code' | 'custom';

interface ProviderConstructor {
  new (template: ProviderTemplate, config: ProviderConfig, configManager?: ChatConfigurationManager): ChatProvider;
}

export class ProviderFactory {
  private static providerRegistry = new Map<string, ProviderConstructor>([
    ['openai', OpenAIProvider],
    ['anthropic', AnthropicProvider],
    ['lmstudio', LMStudioProvider],
    ['claude-code', ClaudeCodeProvider]
  ]);
  
  /**
   * Create a provider instance from a template
   */
  static createProvider(template: ProviderTemplate, config: ProviderConfig, configManager?: ChatConfigurationManager): ChatProvider {
    const providerType = template.provider_config.provider_type.toLowerCase();
    const ProviderClass = this.providerRegistry.get(providerType);
    
    if (!ProviderClass) {
      throw new Error(`Unknown provider type: ${providerType}`);
    }
    
    return new ProviderClass(template, config, configManager);
  }
  
  /**
   * Register a custom provider class
   */
  static registerProvider(type: string, providerClass: ProviderConstructor): void {
    this.providerRegistry.set(type.toLowerCase(), providerClass);
  }
  
  /**
   * Get list of supported provider types
   */
  static getSupportedProviders(): string[] {
    return Array.from(this.providerRegistry.keys());
  }
  
  /**
   * Check if a provider type is supported
   */
  static isProviderSupported(type: string): boolean {
    return this.providerRegistry.has(type.toLowerCase());
  }
  
  /**
   * Create multiple providers from templates
   */
  static createProviders(
    templates: ProviderTemplate[], 
    configs: Record<string, ProviderConfig>,
    configManager?: ChatConfigurationManager
  ): Map<string, ChatProvider> {
    const providers = new Map<string, ChatProvider>();
    
    for (const template of templates) {
      const config = configs[template.template_id];
      if (config) {
        try {
          const provider = this.createProvider(template, config, configManager);
          providers.set(template.template_id, provider);
        } catch (error) {
          console.error(`Failed to create provider ${template.template_id}:`, error);
        }
      }
    }
    
    return providers;
  }
  
  /**
   * Validate that a config is compatible with a template
   */
  static validateProviderConfig(template: ProviderTemplate, config: ProviderConfig, configManager?: ChatConfigurationManager): boolean {
    try {
      // Create a temporary provider to validate configuration
      const tempProvider = this.createProvider(template, config, configManager);
      const validation = tempProvider.validateConfig(config);
      tempProvider.dispose(); // Clean up
      
      return validation.valid;
    } catch (error) {
      console.error('Provider config validation failed:', error);
      return false;
    }
  }
}