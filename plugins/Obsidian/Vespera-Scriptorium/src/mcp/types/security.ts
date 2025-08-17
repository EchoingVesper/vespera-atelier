/**
 * Security Configuration Types
 * 
 * Defines the interfaces for security-related configurations.
 */

/**
 * TLS/SSL Configuration
 */
export interface TlsConfig {
  /** Whether TLS/SSL is enabled */
  enabled: boolean;
  
  /** Path to the certificate file (PEM format) */
  certPath?: string;
  
  /** Path to the private key file (PEM format) */
  keyPath?: string;
  
  /** Path to the CA certificate file (PEM format, optional) */
  caPath?: string;
  
  /** Passphrase for the private key (if encrypted) */
  passphrase?: string;
  
  /** Minimum TLS version (default: 'TLSv1.2') */
  minVersion?: 'TLSv1' | 'TLSv1.1' | 'TLSv1.2' | 'TLSv1.3';
  
  /** Whether to reject unauthorized certificates (default: true) */
  rejectUnauthorized?: boolean;
  
  /** List of allowed ciphers (default: Node.js default) */
  ciphers?: string;
  
  /** Whether to request client certificates */
  requestCert?: boolean;
}

/**
 * Encryption Configuration
 */
export interface EncryptionConfig {
  /** Whether encryption is enabled */
  enabled: boolean;
  
  /** Encryption algorithm (e.g., 'aes-256-gcm') */
  algorithm: string;
  
  /** Encryption key (base64 encoded or hex) */
  key: string;
  
  /** Initialization Vector (IV) length in bytes */
  ivLength?: number;
  
  /** Authentication tag length in bytes */
  authTagLength?: number;
  
  /** Salt length in bytes (for key derivation) */
  saltLength?: number;
  
  /** Key derivation iterations (for PBKDF2) */
  iterations?: number;
  
  /** Key digest algorithm (for PBKDF2) */
  digest?: string;
}

/**
 * API Security Configuration
 */
export interface ApiSecurityConfig {
  /** Whether API security is enabled */
  enabled: boolean;
  
  /** API key for authentication */
  apiKey?: string;
  
  /** API key header name (default: 'X-API-Key') */
  apiKeyHeader?: string;
  
  /** Allowed IP addresses (CIDR notation) */
  allowedIps?: string[];
  
  /** Rate limiting configuration */
  rateLimit?: {
    /** Whether rate limiting is enabled */
    enabled: boolean;
    
    /** Maximum requests per window */
    max: number;
    
    /** Time window in milliseconds */
    windowMs: number;
  };
}

/**
 * CORS Configuration
 */
export interface CorsConfig {
  /** Whether CORS is enabled */
  enabled: boolean;
  
  /** Allowed origins (use '*' to allow all) */
  origin: string | string[] | ((origin: string | undefined) => boolean);
  
  /** Allowed HTTP methods */
  methods?: string[];
  
  /** Allowed headers */
  allowedHeaders?: string[];
  
  /** Exposed headers */
  exposedHeaders?: string[];
  
  /** Credentials */
  credentials?: boolean;
  
  /** Max age in seconds */
  maxAge?: number;
  
  /** Whether to enable preflight continue */
  preflightContinue?: boolean;
  
  /** Options success status code */
  optionsSuccessStatus?: number;
}
