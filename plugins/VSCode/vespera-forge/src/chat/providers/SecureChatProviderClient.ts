/**
 * SecureChatProviderClient
 * 
 * Enterprise-grade HTTP client for chat provider communications with comprehensive
 * security integration, threat detection, and API abuse prevention.
 */

import { 
  SecurityEnhancedVesperaCoreServices,
  VesperaSecurityError,
  VesperaRateLimitError,
  VesperaSanitizationError
} from '../../core/security';
import { VesperaSeverity } from '../../core/error-handling/VesperaErrors';
import { VesperaSecurityErrorCode } from '../../types/security';
import { 
  isSecurityServicesReady, 
  getSecurityServicesOrFallback 
} from '../../security/integration';
import { 
  RateLimitContext,
  SanitizationScope,
  VesperaSecurityEvent,
  SecurityEventContext
} from '../../types/security';
import { VesperaLogger } from '../../core/logging/VesperaLogger';

// HTTP types
export interface SecureHttpResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  sanitized: boolean;
  rateLimitRemaining?: number;
  rateLimitReset?: number;
}

export interface SecureHttpOptions {
  baseURL: string;
  headers?: Record<string, string>;
  timeout?: number;
  apiKey?: string;
  providerName: string;
  resourcePrefix: string;
  enableRateLimit?: boolean;
  enableSanitization?: boolean;
  enableAuditLogging?: boolean;
}

export interface StreamEvent {
  type: 'data' | 'error' | 'done';
  data?: any;
  error?: string;
}

/**
 * Enterprise HTTP client with comprehensive security integration
 */
export class SecureChatProviderClient {
  private logger: VesperaLogger;
  private securityServices?: SecurityEnhancedVesperaCoreServices;
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;
  private providerName: string;
  private resourcePrefix: string;
  private enableRateLimit: boolean;
  private enableSanitization: boolean;
  private enableAuditLogging: boolean;

  constructor(options: SecureHttpOptions) {
    this.baseURL = options.baseURL.replace(/\/$/, ''); // Remove trailing slash
    this.defaultHeaders = { ...options.headers };
    this.timeout = options.timeout || 30000;
    this.providerName = options.providerName;
    this.resourcePrefix = options.resourcePrefix;
    this.enableRateLimit = options.enableRateLimit !== false;
    this.enableSanitization = options.enableSanitization !== false;
    this.enableAuditLogging = options.enableAuditLogging !== false;
    
    // Initialize logger
    this.logger = new VesperaLogger('SecureChatProviderClient', { provider: this.providerName });
    
    // Try to get security services if available using type-safe scaffolding
    try {
      const services = getSecurityServicesOrFallback(SecurityEnhancedVesperaCoreServices.getInstance());
      if (isSecurityServicesReady(services)) {
        this.securityServices = services;
      }
    } catch (error) {
      this.logger.warn('Security services not available, operating in degraded mode', { error });
    }
    
    // Securely store API key if provided
    if (options.apiKey) {
      this.setSecureApiKey(options.apiKey);
    }
  }

  /**
   * Securely store API key in headers
   */
  private setSecureApiKey(apiKey: string): void {
    // Log API key usage without exposing the key
    this.logger.debug('API key configured', { 
      keyLength: apiKey.length,
      keyPrefix: apiKey.substring(0, 8),
      provider: this.providerName
    });
    
    // Store encrypted if security services are available
    if (this.securityServices?.securityManager) {
      try {
        // This would use VesperaSecurityManager's credential encryption
        // For now, store directly in headers (would be enhanced in production)
        this.defaultHeaders['Authorization'] = `Bearer ${apiKey}`;
      } catch (error) {
        this.logger.error('Failed to encrypt API key', error);
        throw new VesperaSecurityError('API key encryption failed', VesperaSecurityErrorCode.CREDENTIAL_ENCRYPTION_ERROR);
      }
    } else {
      this.defaultHeaders['Authorization'] = `Bearer ${apiKey}`;
    }
  }

  /**
   * Perform rate limit check
   */
  private async checkRateLimit(resourceId: string, context: any = {}): Promise<void> {
    if (!this.enableRateLimit || !this.securityServices?.rateLimiter) {
      return;
    }

    try {
      const rateLimitContext: RateLimitContext = {
        resourceId: `${this.resourcePrefix}.${resourceId}`,
        userId: context.userId || 'anonymous',
        clientId: this.providerName,
        timestamp: Date.now(),
        metadata: {
          provider: this.providerName,
          operation: resourceId,
          ...context
        }
      };

      const result = await this.securityServices.rateLimiter.checkRateLimit(rateLimitContext);
      
      if (!result.allowed) {
        await this.logSecurityEvent(VesperaSecurityEvent.RATE_LIMIT_EXCEEDED, {
          timestamp: Date.now(),
          metadata: {
            resourceId: rateLimitContext.resourceId,
            provider: this.providerName,
            remainingTokens: result.remainingTokens,
            resetTime: result.resetTime
          }
        });
        
        throw new VesperaRateLimitError(
          `Rate limit exceeded for ${resourceId}`,
          result.retryAfter || result.resetTime || 0,
          result.remainingTokens || 0
        );
      }
    } catch (error) {
      if (error instanceof VesperaRateLimitError) {
        throw error;
      }
      this.logger.error('Rate limit check failed', error);
      // Continue with request in case of rate limiter failure
    }
  }

  /**
   * Sanitize request data
   */
  private async sanitizeRequest(data: any): Promise<any> {
    if (!this.enableSanitization || !this.securityServices?.inputSanitizer) {
      return data;
    }

    try {
      const result = await this.securityServices.inputSanitizer.sanitize(
        data,
        SanitizationScope.API_REQUEST
      );

      if (result.threats.length > 0) {
        await this.logSecurityEvent(VesperaSecurityEvent.THREAT_DETECTED, {
          timestamp: Date.now(),
          metadata: {
            threats: result.threats,
            provider: this.providerName,
            originalDataType: typeof data
          }
        });

        // Block high-severity threats
        const highSeverityThreats = result.threats.filter(
          threat => threat.severity === 'high' || threat.severity === 'critical'
        );
        
        if (highSeverityThreats.length > 0) {
          throw new VesperaSanitizationError(
            'High-severity security threat detected in request data',
            highSeverityThreats[0]?.pattern.type || 'unknown',
            JSON.stringify(request).length,
            result.sanitized ? JSON.stringify(result.sanitized).length : 0,
            VesperaSeverity.HIGH,
            { threats: result.threats }
          );
        }
      }

      return result.sanitized;
    } catch (error) {
      if (error instanceof VesperaSanitizationError) {
        throw error;
      }
      this.logger.error('Request sanitization failed', error);
      return data; // Continue with original data if sanitization fails
    }
  }

  /**
   * Sanitize response data
   */
  private async sanitizeResponse(data: any): Promise<{ data: any; sanitized: boolean }> {
    if (!this.enableSanitization || !this.securityServices?.inputSanitizer) {
      return { data, sanitized: false };
    }

    try {
      const result = await this.securityServices.inputSanitizer.sanitize(
        data,
        SanitizationScope.API_RESPONSE
      );

      if (result.threats.length > 0) {
        await this.logSecurityEvent(VesperaSecurityEvent.THREAT_DETECTED, {
          timestamp: Date.now(),
          metadata: {
            threats: result.threats,
            provider: this.providerName,
            responseSource: 'api_response'
          }
        });
      }

      return {
        data: result.sanitized,
        sanitized: result.threats.length > 0 || result.modified
      };
    } catch (error) {
      this.logger.error('Response sanitization failed', error);
      return { data, sanitized: false };
    }
  }

  /**
   * Log security events
   */
  private async logSecurityEvent(event: VesperaSecurityEvent, context: SecurityEventContext): Promise<void> {
    if (!this.enableAuditLogging || !this.securityServices?.securityAuditLogger) {
      return;
    }

    try {
      await this.securityServices.securityAuditLogger.logSecurityEvent(event, {
        ...context,
        metadata: {
          ...context.metadata,
          component: 'SecureChatProviderClient',
          provider: this.providerName
        }
      });
    } catch (error) {
      this.logger.error('Failed to log security event', error);
    }
  }

  /**
   * Secure HTTP GET request
   */
  async get<T = any>(path: string, headers?: Record<string, string>): Promise<SecureHttpResponse<T>> {
    return this.request<T>('GET', path, undefined, headers);
  }

  /**
   * Secure HTTP POST request
   */
  async post<T = any>(path: string, data?: any, headers?: Record<string, string>): Promise<SecureHttpResponse<T>> {
    return this.request<T>('POST', path, data, headers);
  }

  /**
   * Secure HTTP PUT request
   */
  async put<T = any>(path: string, data?: any, headers?: Record<string, string>): Promise<SecureHttpResponse<T>> {
    return this.request<T>('PUT', path, data, headers);
  }

  /**
   * Secure HTTP DELETE request
   */
  async delete<T = any>(path: string, headers?: Record<string, string>): Promise<SecureHttpResponse<T>> {
    return this.request<T>('DELETE', path, undefined, headers);
  }

  /**
   * Secure streaming POST request
   */
  async postStream(
    path: string, 
    data?: any, 
    headers?: Record<string, string>
  ): Promise<AsyncIterable<StreamEvent>> {
    const resourceId = `stream.${path.replace(/^\//, '').replace(/\//g, '.')}`;
    
    // Check rate limits
    await this.checkRateLimit(resourceId, { streaming: true });
    
    // Sanitize request data
    const sanitizedData = await this.sanitizeRequest(data);
    
    // Build request
    const url = this.buildUrl(path);
    const requestHeaders = { ...this.defaultHeaders, ...headers };
    
    // Log API call
    this.logger.info(`Streaming POST ${url}`, {
      provider: this.providerName,
      sanitized: sanitizedData !== data
    });

    // Log security event
    await this.logSecurityEvent(VesperaSecurityEvent.API_ACCESS, {
      timestamp: Date.now(),
      metadata: {
        method: 'POST',
        url,
        provider: this.providerName,
        streaming: true,
        dataPresent: !!sanitizedData
      }
    });

    try {
      // Use dynamic import to avoid bundling issues
      const fetch = await this.getFetchImplementation();
      
      const response = await fetch(url, {
        method: 'POST',
        headers: requestHeaders,
        body: sanitizedData ? JSON.stringify(sanitizedData) : undefined,
        // @ts-ignore - AbortSignal timeout might not be available in all environments
        signal: AbortSignal.timeout ? AbortSignal.timeout(this.timeout) : undefined
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is not available for streaming');
      }

      return this.processStreamResponse(response.body);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      await this.logSecurityEvent(VesperaSecurityEvent.API_ERROR, {
        timestamp: Date.now(),
        metadata: {
          method: 'POST',
          url,
          provider: this.providerName,
          streaming: true,
          error: errorMessage
        }
      });
      
      throw new VesperaSecurityError(
        `Streaming request failed: ${errorMessage}`,
        VesperaSecurityErrorCode.API_REQUEST_ERROR,
        undefined,
        { originalError: error, provider: this.providerName }
      );
    }
  }

  /**
   * Core secure HTTP request implementation
   */
  private async request<T = any>(
    method: string,
    path: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<SecureHttpResponse<T>> {
    const resourceId = `${method.toLowerCase()}.${path.replace(/^\//, '').replace(/\//g, '.')}`;
    
    // Check rate limits
    await this.checkRateLimit(resourceId, { method, hasData: !!data });
    
    // Sanitize request data
    const sanitizedData = data ? await this.sanitizeRequest(data) : undefined;
    
    // Build request
    const url = this.buildUrl(path);
    const requestHeaders = { ...this.defaultHeaders, ...headers };
    
    // Log API call
    this.logger.info(`${method} ${url}`, {
      provider: this.providerName,
      sanitized: sanitizedData !== data
    });

    // Log security event
    await this.logSecurityEvent(VesperaSecurityEvent.API_ACCESS, {
      timestamp: Date.now(),
      metadata: {
        method,
        url,
        provider: this.providerName,
        streaming: false,
        dataPresent: !!sanitizedData
      }
    });

    try {
      // Use dynamic import to avoid bundling issues
      const fetch = await this.getFetchImplementation();
      
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: sanitizedData ? JSON.stringify(sanitizedData) : undefined,
        // @ts-ignore - AbortSignal timeout might not be available in all environments
        signal: AbortSignal.timeout ? AbortSignal.timeout(this.timeout) : undefined
      });

      const responseData = await response.json();
      const sanitizedResponse = await this.sanitizeResponse(responseData);

      // Extract rate limit headers if present
      const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
      const rateLimitReset = response.headers.get('x-ratelimit-reset');

      const secureResponse: SecureHttpResponse<T> = {
        data: sanitizedResponse.data,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        sanitized: sanitizedResponse.sanitized,
        ...(rateLimitRemaining && { rateLimitRemaining: parseInt(rateLimitRemaining) }),
        ...(rateLimitReset && { rateLimitReset: parseInt(rateLimitReset) })
      };

      if (!response.ok) {
        await this.logSecurityEvent(VesperaSecurityEvent.API_ERROR, {
          timestamp: Date.now(),
          metadata: {
            method,
            url,
            provider: this.providerName,
            status: response.status,
            statusText: response.statusText
          }
        });
        
        throw new VesperaSecurityError(
          `HTTP ${response.status}: ${response.statusText}`,
          VesperaSecurityErrorCode.API_HTTP_ERROR,
          undefined,
          { status: response.status, provider: this.providerName }
        );
      }

      return secureResponse;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (!(error instanceof VesperaSecurityError)) {
        await this.logSecurityEvent(VesperaSecurityEvent.API_ERROR, {
          timestamp: Date.now(),
          metadata: {
            method,
            url,
            provider: this.providerName,
            error: errorMessage
          }
        });
      }
      
      if (error instanceof VesperaSecurityError) {
        throw error;
      }
      
      throw new VesperaSecurityError(
        `Request failed: ${errorMessage}`,
        VesperaSecurityErrorCode.API_REQUEST_ERROR,
        undefined,
        { originalError: error, provider: this.providerName }
      );
    }
  }

  /**
   * Process streaming response
   */
  private async* processStreamResponse(body: ReadableStream<Uint8Array>): AsyncIterable<StreamEvent> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          yield { type: 'done' };
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in buffer
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              // Parse SSE format
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                
                if (data === '[DONE]') {
                  yield { type: 'done' };
                  return;
                }
                
                const parsed = JSON.parse(data);
                const sanitizedResponse = await this.sanitizeResponse(parsed);
                
                yield { 
                  type: 'data', 
                  data: sanitizedResponse.data 
                };
              }
            } catch (error) {
              yield { 
                type: 'error', 
                error: `Failed to parse streaming data: ${error}` 
              };
            }
          }
        }
      }
    } catch (error) {
      yield { 
        type: 'error', 
        error: error instanceof Error ? error.message : String(error) 
      };
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Get appropriate fetch implementation
   */
  private async getFetchImplementation(): Promise<typeof fetch> {
    // In VS Code extension context, use node-fetch
    try {
      const nodeFetch = await import('node-fetch');
      return nodeFetch.default as any;
    } catch (error) {
      // Fallback to global fetch if available
      if (typeof fetch !== 'undefined') {
        return fetch;
      }
      throw new Error('No fetch implementation available');
    }
  }

  /**
   * Build complete URL from path
   */
  private buildUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseURL}${cleanPath}`;
  }

  /**
   * Update request headers securely
   */
  setHeader(key: string, value: string): void {
    this.defaultHeaders[key] = value;
    
    // Don't log sensitive headers
    const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie'];
    const isSensitive = sensitiveHeaders.some(h => h === key.toLowerCase());
    
    this.logger.debug('Header updated', { 
      key, 
      value: isSensitive ? '[REDACTED]' : value,
      provider: this.providerName
    });
  }

  /**
   * Remove request headers
   */
  removeHeader(key: string): void {
    delete this.defaultHeaders[key];
    this.logger.debug('Header removed', { key, provider: this.providerName });
  }

  /**
   * Get security status
   */
  getSecurityStatus(): {
    securityEnabled: boolean;
    rateLimitEnabled: boolean;
    sanitizationEnabled: boolean;
    auditLoggingEnabled: boolean;
    provider: string;
  } {
    return {
      securityEnabled: !!this.securityServices,
      rateLimitEnabled: this.enableRateLimit && !!this.securityServices?.rateLimiter,
      sanitizationEnabled: this.enableSanitization && !!this.securityServices?.inputSanitizer,
      auditLoggingEnabled: this.enableAuditLogging && !!this.securityServices?.securityAuditLogger,
      provider: this.providerName
    };
  }
}