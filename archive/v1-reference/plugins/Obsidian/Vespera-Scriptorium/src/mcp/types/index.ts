/**
 * MCP Configuration Types
 * 
 * Defines the core types and interfaces for MCP configuration.
 */

// First import the types
import type { 
  TlsConfig, 
  EncryptionConfig, 
  ApiSecurityConfig, 
  CorsConfig 
} from './security';

import type { 
  LLMProviderConfig, 
  LLMProviderStrategy 
} from './llm';

// Then export everything from sub-modules
export * from './llm';
export * from './security';

// Re-export all types for backward compatibility
export type { 
  TlsConfig, 
  EncryptionConfig, 
  ApiSecurityConfig, 
  CorsConfig,
  LLMProviderConfig,
  LLMProviderStrategy 
};

/**
 * MCP Server configuration options
 */
export interface MCPServerConfig {
  /** Server hostname or IP address */
  host: string;
  
  /** Server port number */
  port: number;
  
  /** Whether the server uses HTTPS */
  secure?: boolean;
  
  /** API key for authentication */
  apiKey?: string;
  
  /** TLS/SSL configuration */
  tls?: TlsConfig;
  
  /** Encryption configuration */
  encryption?: EncryptionConfig;
  
  /** API security configuration */
  apiSecurity?: ApiSecurityConfig;
  
  /** CORS configuration */
  cors?: CorsConfig;
  
  /** Connection timeout in milliseconds */
  timeout?: number;
  
  /** Maximum number of retry attempts */
  maxRetries?: number;
  
  /** Retry delay in milliseconds */
  retryDelay?: number;
}

/**
 * MCP Client configuration options
 */
export interface MCPClientConfig extends MCPServerConfig {
  /** Whether the client is enabled */
  enabled: boolean;
  
  /** Path to the Obsidian vault */
  vaultPath: string;
  
  /** Logging level */
  logLevel?: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  
  /** Cache configuration */
  cache: {
    /** Whether caching is enabled */
    enabled: boolean;
    
    /** Cache TTL in milliseconds */
    ttl: number;
  };
  
  /** Rate limiting configuration */
  rateLimit: {
    /** Whether rate limiting is enabled */
    enabled: boolean;
    
    /** Maximum number of requests per interval */
    maxRequests: number;
    
    /** Time window in milliseconds */
    interval: number;
  };
  
  /** LLM provider configurations */
  llmProviders?: {
    /** Default provider ID */
    defaultProvider?: string;
    
    /** Provider selection strategy */
    strategy?: LLMProviderStrategy;
    
    /** Available LLM providers */
    providers: Record<string, LLMProviderConfig>;
  };
}

/**
 * MCP Operation result
 */
export interface MCPResult<T = unknown> {
  /** Whether the operation was successful */
  success: boolean;
  
  /** Result data */
  data?: T;
  
  /** Error message if the operation failed */
  error?: string;
  
  /** Metadata about the operation */
  meta?: {
    /** Operation duration in milliseconds */
    duration: number;
    
    /** Timestamp when the operation completed */
    timestamp: number;
  };
}

/**
 * MCP Request options
 */
export interface MCPRequestOptions {
  /** Request timeout in milliseconds */
  timeout?: number;
  
  /** Headers to include in the request */
  headers?: Record<string, string>;
  
  /** Query parameters */
  params?: Record<string, string | number | boolean>;
  
  /** Whether to retry failed requests */
  retry?: boolean;
}

/**
 * MCP File information
 */
export interface MCPFileInfo {
  /** File path relative to the vault root */
  path: string;
  
  /** File name */
  name: string;
  
  /** File extension */
  extension: string;
  
  /** File size in bytes */
  size: number;
  
  /** Last modified timestamp */
  modified: number;
  
  /** File content (if included) */
  content?: string;
}

/**
 * MCP Search options
 */
export interface MCPSearchOptions {
  /** Search query */
  query: string;
  
  /** Maximum number of results to return */
  limit?: number;
  
  /** Offset for pagination */
  offset?: number;
  
  /** Whether to include file content in results */
  includeContent?: boolean;
  
  /** File extensions to include (e.g., ['md', 'txt']) */
  extensions?: string[];
  
  /** Paths to include in the search */
  includePaths?: string[];
  
  /** Paths to exclude from the search */
  excludePaths?: string[];
}
