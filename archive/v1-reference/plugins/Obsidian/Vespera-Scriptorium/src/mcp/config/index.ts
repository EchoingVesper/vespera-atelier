import { 
  MCPClientConfig, 
  TlsConfig, 
  EncryptionConfig, 
  ApiSecurityConfig, 
  CorsConfig,
  LLMProviderConfig,
  LLMProviderStrategy
} from '../types';

/**
 * Recursive partial type for deep merging
 */
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Default MCP Configuration
 * 
 * These are the default values used when no configuration is provided.
 */
/**
 * Default TLS configuration
 */
const DEFAULT_TLS_CONFIG: TlsConfig = {
  enabled: false,
  minVersion: 'TLSv1.2',
  rejectUnauthorized: true,
  requestCert: false,
};

/**
 * Default encryption configuration
 */
const DEFAULT_ENCRYPTION_CONFIG: EncryptionConfig = {
  enabled: false,
  algorithm: 'aes-256-gcm',
  key: '', // Should be overridden in production
  ivLength: 16,
  authTagLength: 16,
  saltLength: 16,
  iterations: 10000,
  digest: 'sha256',
};

/**
 * Default API security configuration
 */
const DEFAULT_API_SECURITY_CONFIG: ApiSecurityConfig = {
  enabled: true,
  apiKeyHeader: 'X-API-Key',
  allowedIps: ['127.0.0.1', '::1'],
  rateLimit: {
    enabled: true,
    max: 100,
    windowMs: 60 * 1000, // 1 minute
  },
};

/**
 * Default CORS configuration
 */
const DEFAULT_CORS_CONFIG: CorsConfig = {
  enabled: true,
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  exposedHeaders: [],
  credentials: true,
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

/**
 * Default LLM providers configuration
 */
const DEFAULT_LLM_PROVIDERS = {
  defaultProvider: 'openai',
  strategy: 'fallback',
  providers: {
    openai: {
      type: 'openai',
      enabled: false,
      name: 'OpenAI',
      priority: 1,
      apiKey: '',
      model: 'gpt-4',
      maxTokens: 2000,
      temperature: 0.7,
      timeout: 30000, // 30 seconds
      maxRetries: 3,
      retryDelay: 1000, // 1 second
    } as const,
    ollama: {
      type: 'ollama',
      enabled: false,
      name: 'Ollama',
      priority: 2,
      baseUrl: 'http://localhost:11434',
      model: 'llama2',
      useGpu: true,
      contextWindow: 4096,
      timeout: 60000, // 60 seconds
      maxRetries: 2,
      retryDelay: 2000, // 2 seconds
    } as const,
  },
};

/**
 * Default MCP configuration
 */
const DEFAULT_CONFIG: MCPClientConfig = {
  enabled: false,
  host: 'localhost',
  port: 3000,
  secure: false,
  vaultPath: '',
  logLevel: 'info',
  timeout: 10000, // 10 seconds
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  tls: { ...DEFAULT_TLS_CONFIG },
  encryption: { ...DEFAULT_ENCRYPTION_CONFIG },
  apiSecurity: { ...DEFAULT_API_SECURITY_CONFIG },
  cors: { ...DEFAULT_CORS_CONFIG },
  cache: {
    enabled: true,
    ttl: 5 * 60 * 1000, // 5 minutes
  },
  rateLimit: {
    enabled: true,
    maxRequests: 100,
    interval: 60 * 1000, // 1 minute
  },
  llmProviders: { ...DEFAULT_LLM_PROVIDERS },
  apiKey: '',
};

/**
 * MCP Configuration Manager
 * 
 * Handles loading, validating, and accessing MCP configuration.
 */
class MCPConfigManager {
  private config: MCPClientConfig;
  private static instance: MCPConfigManager;

  private constructor() {
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Get the singleton instance of MCPConfigManager
   */
  public static getInstance(): MCPConfigManager {
    if (!MCPConfigManager.instance) {
      MCPConfigManager.instance = new MCPConfigManager();
    }
    return MCPConfigManager.instance;
  }

  /**
   * Initialize the configuration with user settings
   * @param userConfig Partial configuration to override defaults
   */
  public initialize(userConfig: Partial<MCPClientConfig> = {}): void {
    // Create a deep clone of the default config to avoid mutating it
    const defaultConfig = { ...DEFAULT_CONFIG };
    
    // Deep merge function for nested objects
    const deepMerge = <T extends object>(target: T, source: DeepPartial<T>): T => {
      const result = { ...target } as any;
      
      for (const key in source) {
        if (source[key] === undefined) continue;
        
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = deepMerge(target[key] || {}, source[key] || {});
        } else {
          result[key] = source[key];
        }
      }
      
      return result as T;
    };

    // Create a new config with proper deep merging of all nested objects
    const mergedConfig: MCPClientConfig = {
      ...defaultConfig,
      ...userConfig,
      tls: deepMerge(
        { ...DEFAULT_TLS_CONFIG },
        userConfig.tls || {}
      ),
      encryption: deepMerge(
        { ...DEFAULT_ENCRYPTION_CONFIG },
        userConfig.encryption || {}
      ),
      apiSecurity: deepMerge(
        { ...DEFAULT_API_SECURITY_CONFIG },
        userConfig.apiSecurity || {}
      ),
      cors: deepMerge(
        { ...DEFAULT_CORS_CONFIG },
        userConfig.cors || {}
      ),
      cache: {
        enabled: userConfig.cache?.enabled ?? defaultConfig.cache.enabled,
        ttl: userConfig.cache?.ttl ?? defaultConfig.cache.ttl,
      },
      rateLimit: {
        enabled: userConfig.rateLimit?.enabled ?? defaultConfig.rateLimit.enabled,
        maxRequests: userConfig.rateLimit?.maxRequests ?? defaultConfig.rateLimit.maxRequests,
        interval: userConfig.rateLimit?.interval ?? defaultConfig.rateLimit.interval,
      },
      llmProviders: userConfig.llmProviders || defaultConfig.llmProviders
        ? {
            ...defaultConfig.llmProviders,
            ...(userConfig.llmProviders || {}),
            providers: {
              ...(defaultConfig.llmProviders?.providers || {}),
              ...(userConfig.llmProviders?.providers || {})
            }
          }
        : undefined
    };
    
    this.config = mergedConfig;

    // Validate the final configuration
    this.validateConfig();
  }

  /**
   * Validate the current configuration
   * @throws {Error} If configuration is invalid
   */
  private validateConfig(): void {
    const { host, port, vaultPath, tls, encryption, llmProviders } = this.config;

    if (!host || typeof host !== 'string') {
      throw new Error('Invalid MCP server host configuration');
    }

    if (typeof port !== 'number' || port < 1 || port > 65535) {
      throw new Error('Invalid MCP server port configuration');
    }

    if (!vaultPath || typeof vaultPath !== 'string') {
      throw new Error('Vault path is required for MCP configuration');
    }

    // Validate TLS configuration if enabled
    if (tls?.enabled) {
      if (tls.certPath && typeof tls.certPath !== 'string') {
        throw new Error('Invalid TLS certificate path');
      }
      if (tls.keyPath && typeof tls.keyPath !== 'string') {
        throw new Error('Invalid TLS key path');
      }
    }

    // Validate encryption configuration if enabled
    if (encryption?.enabled) {
      if (!encryption.key || typeof encryption.key !== 'string') {
        throw new Error('Encryption key is required when encryption is enabled');
      }
      if (encryption.key.length < 32) {
        console.warn('Encryption key is shorter than recommended 32 bytes');
      }
    }

    // Validate LLM providers if they exist
    if (llmProviders) {
      const { defaultProvider, providers } = llmProviders;
      
      if (defaultProvider && providers && !providers[defaultProvider]) {
        throw new Error(`Default LLM provider '${defaultProvider}' not found in providers`);
      }

      // Validate each provider if providers exist
      if (providers) {
        for (const [id, provider] of Object.entries(providers)) {
          if (!provider?.name || typeof provider.name !== 'string') {
            throw new Error(`LLM provider '${id}' is missing a valid name`);
          }

          if (provider.type === 'openai' && !provider.apiKey) {
            console.warn(`LLM provider '${id}' (OpenAI) is missing an API key`);
          }

          if (provider.type === 'ollama' && !provider.baseUrl) {
            throw new Error(`LLM provider '${id}' (Ollama) is missing a base URL`);
          }
        }
      }
    }
  }

  /**
   * Get the current configuration
   */
  public getConfig(): Readonly<MCPClientConfig> {
    return Object.freeze({ ...this.config });
  }

  /**
   * Update configuration at runtime
   * @param updates Partial configuration to update
   */
  public updateConfig(updates: Partial<MCPClientConfig>): void {
    // Create a deep clone of current config
    const currentConfig = { ...this.config };
    
    // Deep merge function for nested objects
    const deepMerge = <T extends object>(target: T, source: DeepPartial<T>): T => {
      const result = { ...target } as any;
      
      for (const key in source) {
        if (source[key] === undefined) continue;
        
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = deepMerge(target[key] || {}, source[key] || {});
        } else {
          result[key] = source[key];
        }
      }
      
      return result as T;
    };
    
    // Create a new config with proper deep merging of nested objects
    const newConfig: MCPClientConfig = {
      ...currentConfig,
      ...updates,
      tls: deepMerge(
        { ...currentConfig.tls },
        updates.tls || {}
      ),
      encryption: deepMerge(
        { ...currentConfig.encryption },
        updates.encryption || {}
      ),
      apiSecurity: deepMerge(
        { ...currentConfig.apiSecurity },
        updates.apiSecurity || {}
      ),
      cors: deepMerge(
        { ...currentConfig.cors },
        updates.cors || {}
      ),
      cache: {
        enabled: updates.cache?.enabled ?? currentConfig.cache.enabled,
        ttl: updates.cache?.ttl ?? currentConfig.cache.ttl,
      },
      rateLimit: {
        enabled: updates.rateLimit?.enabled ?? currentConfig.rateLimit.enabled,
        maxRequests: updates.rateLimit?.maxRequests ?? currentConfig.rateLimit.maxRequests,
        interval: updates.rateLimit?.interval ?? currentConfig.rateLimit.interval,
      },
      llmProviders: updates.llmProviders || currentConfig.llmProviders
        ? {
            ...(currentConfig.llmProviders || {}),
            ...(updates.llmProviders || {}),
            providers: {
              ...(currentConfig.llmProviders?.providers || {}),
              ...(updates.llmProviders?.providers || {})
            }
          }
        : undefined
    };

    // Validate before applying
    const originalConfig = { ...this.config };
    try {
      this.config = newConfig;
      this.validateConfig();
    } catch (error) {
      // Revert on validation error
      this.config = originalConfig;
      throw error;
    }
  }

  /**
   * Reset configuration to defaults
   */
  public resetConfig(): void {
    this.config = { ...DEFAULT_CONFIG };
  }
}

// Export a singleton instance
export const mcpConfig = MCPConfigManager.getInstance();

/**
 * Type-safe configuration accessor
 */
export function getMCPConfig(): Readonly<MCPClientConfig> {
  return mcpConfig.getConfig();
}

/**
 * Initialize MCP configuration
 * @param config Partial configuration to override defaults
 */
export function initializeMCPConfig(config: Partial<MCPClientConfig> = {}): void {
  mcpConfig.initialize(config);
}

/**
 * Update MCP configuration at runtime
 * @param updates Partial configuration to update
 */
export function updateMCPConfig(updates: Partial<MCPClientConfig>): void {
  mcpConfig.updateConfig(updates);
}

/**
 * Reset MCP configuration to defaults
 */
export function resetMCPConfig(): void {
  mcpConfig.resetConfig();
}
