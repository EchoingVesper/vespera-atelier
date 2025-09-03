/**
 * WebView Security Manager
 * 
 * Dedicated security manager for WebView contexts providing comprehensive
 * input sanitization, message validation, and threat detection specifically
 * designed for VS Code WebView environments.
 */

import * as vscode from 'vscode';
import { VesperaInputSanitizer } from '../../../core/security/sanitization/VesperaInputSanitizer';
import { VesperaSecurityAuditLogger } from '../../../core/security/audit/VesperaSecurityAuditLogger';
import { VesperaLogger } from '../../../core/logging/VesperaLogger';
import { VesperaErrorHandler } from '../../../core/error-handling/VesperaErrorHandler';
import {
  WebViewMessage,
  WebViewResponse,
  WebViewMessageType,
  SendMessageRequest,
  ConfigureProviderRequest,
  TestProviderConnectionRequest
} from '../../types/webview';
import {
  SanitizationScope,
  SanitizationResult,
  VesperaSecurityEvent,
  ThreatInfo,
  ThreatType,
  ThreatSeverity
} from '../../../types/security';
import { VesperaSanitizationError, VesperaThreatError } from '../../../core/security/VesperaSecurityErrors';

export interface WebViewSecurityConfiguration {
  strictMode: boolean;
  enableRealTimeValidation: boolean;
  allowedOrigins: string[];
  maxMessageSize: number;
  rateLimitPerSecond: number;
  enableContentSanitization: boolean;
  cspStrictMode: boolean;
}

export interface MessageValidationResult {
  isValid: boolean;
  sanitizedMessage?: WebViewMessage;
  threats: ThreatInfo[];
  errors: string[];
  blocked: boolean;
}

export interface WebViewSecurityContext {
  sessionId: string;
  origin: string;
  messageCount: number;
  lastActivity: number;
  trustLevel: 'low' | 'medium' | 'high';
}

/**
 * Security manager for WebView message handling and content protection
 */
export class WebViewSecurityManager {
  private static instance: WebViewSecurityManager;
  
  private securityContexts = new Map<string, WebViewSecurityContext>();
  private messageQueue = new Map<string, { timestamp: number; count: number }>();
  private disposed = false;

  // Message schemas for validation
  private messageSchemas = new Map<WebViewMessageType, any>();

  // Statistics
  private stats = {
    messagesProcessed: 0,
    messagesBlocked: 0,
    threatsDetected: 0,
    sanitizationsApplied: 0,
    validationErrors: 0
  };

  constructor(
    private sanitizer: VesperaInputSanitizer,
    private auditLogger: VesperaSecurityAuditLogger,
    private logger: VesperaLogger,
    private errorHandler: VesperaErrorHandler,
    private config: WebViewSecurityConfiguration
  ) {
    this.logger = logger.createChild('WebViewSecurityManager');
    this.initializeMessageSchemas();
    
    this.logger.info('WebViewSecurityManager initialized', {
      strictMode: config.strictMode,
      maxMessageSize: config.maxMessageSize,
      enableRealTimeValidation: config.enableRealTimeValidation
    });
  }

  /**
   * Initialize the WebView security manager
   */
  public static async initialize(config: {
    sanitizer: VesperaInputSanitizer;
    auditLogger: VesperaSecurityAuditLogger;
    logger: VesperaLogger;
    errorHandler: VesperaErrorHandler;
    securityConfig?: Partial<WebViewSecurityConfiguration>;
  }): Promise<WebViewSecurityManager> {
    if (!WebViewSecurityManager.instance) {
      const defaultConfig: WebViewSecurityConfiguration = {
        strictMode: true,
        enableRealTimeValidation: true,
        allowedOrigins: ['vscode-webview://*'],
        maxMessageSize: 1048576, // 1MB
        rateLimitPerSecond: 10,
        enableContentSanitization: true,
        cspStrictMode: true,
        ...config.securityConfig
      };

      WebViewSecurityManager.instance = new WebViewSecurityManager(
        config.sanitizer,
        config.auditLogger,
        config.logger,
        config.errorHandler,
        defaultConfig
      );
    }
    return WebViewSecurityManager.instance;
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): WebViewSecurityManager {
    if (!WebViewSecurityManager.instance) {
      throw new Error('WebViewSecurityManager not initialized');
    }
    return WebViewSecurityManager.instance;
  }

  /**
   * Validate and sanitize incoming WebView message
   */
  async validateMessage(
    message: WebViewMessage,
    context: Partial<WebViewSecurityContext>
  ): Promise<MessageValidationResult> {
    if (this.disposed) {
      throw new Error('WebViewSecurityManager has been disposed');
    }

    const startTime = Date.now();
    this.stats.messagesProcessed++;

    try {
      const fullContext = await this.getOrCreateSecurityContext(context);
      const result: MessageValidationResult = {
        isValid: true,
        threats: [],
        errors: [],
        blocked: false
      };

      // 1. Basic message structure validation
      if (!this.validateMessageStructure(message)) {
        result.isValid = false;
        result.errors.push('Invalid message structure');
        this.stats.validationErrors++;
      }

      // 2. Message size validation
      const messageSize = JSON.stringify(message).length;
      if (messageSize > this.config.maxMessageSize) {
        result.isValid = false;
        result.errors.push(`Message size ${messageSize} exceeds maximum ${this.config.maxMessageSize}`);
        result.blocked = true;
        this.stats.messagesBlocked++;
      }

      // 3. Rate limiting check
      if (!this.checkRateLimit(fullContext.sessionId)) {
        result.isValid = false;
        result.errors.push('Rate limit exceeded');
        result.blocked = true;
        this.stats.messagesBlocked++;
      }

      // 4. Schema validation
      const schemaValidation = await this.validateMessageSchema(message);
      if (!schemaValidation.isValid) {
        result.isValid = false;
        result.errors.push(...schemaValidation.errors);
        this.stats.validationErrors++;
      }

      // 5. Content sanitization
      if (this.config.enableContentSanitization && result.isValid) {
        const sanitizationResult = await this.sanitizeMessageContent(message, fullContext);
        result.sanitizedMessage = sanitizationResult.sanitizedMessage;
        result.threats.push(...sanitizationResult.threats);
        
        if (sanitizationResult.blocked) {
          result.isValid = false;
          result.blocked = true;
          this.stats.messagesBlocked++;
        }

        if (sanitizationResult.threats.length > 0) {
          this.stats.threatsDetected++;
        }

        if (sanitizationResult.sanitized) {
          this.stats.sanitizationsApplied++;
        }
      }

      // 6. Critical threat blocking
      const criticalThreats = result.threats.filter(t => t.severity === 'critical');
      if (criticalThreats.length > 0 && this.config.strictMode) {
        result.isValid = false;
        result.blocked = true;
        result.errors.push(`Critical security threats detected: ${criticalThreats.length}`);
      }

      // 7. Update security context
      this.updateSecurityContext(fullContext, result);

      // 8. Log security events
      await this.logSecurityEvents(message, result, fullContext, Date.now() - startTime);

      return result;

    } catch (error) {
      this.logger.error('Message validation failed', error, {
        messageType: message.type,
        sessionId: context.sessionId
      });

      await this.errorHandler.handleError(error as Error);

      return {
        isValid: false,
        threats: [],
        errors: ['Validation system error'],
        blocked: true
      };
    }
  }

  /**
   * Generate secure Content Security Policy for WebView
   */
  generateCSP(options: {
    context: string;
    nonce?: string;
    allowInlineScripts?: boolean;
    allowInlineStyles?: boolean;
    additionalSources?: string[];
  }): string {
    const policy = this.sanitizer.generateCSPPolicy({
      context: options.context,
      allowedSources: options.additionalSources,
      strictMode: this.config.cspStrictMode
    });

    // Add nonce if provided
    if (options.nonce) {
      const withNonce = policy.replace(
        /script-src ([^;]+)/,
        `script-src $1 'nonce-${options.nonce}'`
      );
      return withNonce;
    }

    return policy;
  }

  /**
   * Sanitize HTML content for WebView injection
   */
  async sanitizeHtmlContent(html: string, context: {
    allowedTags?: string[];
    allowedAttributes?: string[];
    removeScripts?: boolean;
  }): Promise<{
    sanitizedHtml: string;
    threats: ThreatInfo[];
    modified: boolean;
  }> {
    const sanitizationResult = await this.sanitizer.sanitize(
      html,
      SanitizationScope.HTML_CONTENT,
      context
    );

    const threats: ThreatInfo[] = sanitizationResult.threats.map(threat => ({
      type: this.mapThreatType(threat.pattern.type),
      severity: this.mapThreatSeverity(threat.severity),
      patterns: threat.matches,
      blocked: sanitizationResult.blocked
    }));

    return {
      sanitizedHtml: sanitizationResult.sanitized || '',
      threats,
      modified: sanitizationResult.sanitized !== html
    };
  }

  /**
   * Validate WebView postMessage calls
   */
  async validatePostMessage(
    message: any,
    targetOrigin: string,
    source?: string
  ): Promise<{
    allowed: boolean;
    sanitizedMessage?: any;
    reason?: string;
  }> {
    // Check origin allowlist
    const isAllowedOrigin = this.config.allowedOrigins.some(pattern => 
      this.matchesPattern(targetOrigin, pattern)
    );

    if (!isAllowedOrigin) {
      await this.auditLogger.logSecurityEvent(
        VesperaSecurityEvent.CSP_VIOLATION,
        {
          timestamp: Date.now(),
          resourceId: targetOrigin,
          metadata: { source, messageType: 'postMessage', reason: 'disallowed_origin' }
        }
      );

      return {
        allowed: false,
        reason: `Origin not allowed: ${targetOrigin}`
      };
    }

    // Sanitize message content
    const sanitizationResult = await this.sanitizer.sanitize(
      message,
      SanitizationScope.MESSAGE_DATA
    );

    if (sanitizationResult.blocked) {
      return {
        allowed: false,
        reason: 'Message blocked due to security threats'
      };
    }

    return {
      allowed: true,
      sanitizedMessage: sanitizationResult.sanitized
    };
  }

  /**
   * Get security statistics
   */
  getSecurityStats(): {
    messagesProcessed: number;
    messagesBlocked: number;
    blockRate: number;
    threatsDetected: number;
    sanitizationsApplied: number;
    validationErrors: number;
    activeContexts: number;
  } {
    return {
      ...this.stats,
      blockRate: this.stats.messagesProcessed > 0 
        ? this.stats.messagesBlocked / this.stats.messagesProcessed
        : 0,
      activeContexts: this.securityContexts.size
    };
  }

  /**
   * Reset security statistics
   */
  resetStats(): void {
    if (this.disposed) return;

    this.stats = {
      messagesProcessed: 0,
      messagesBlocked: 0,
      threatsDetected: 0,
      sanitizationsApplied: 0,
      validationErrors: 0
    };

    this.logger.info('WebView security statistics reset');
  }

  // Private helper methods

  /**
   * Initialize message validation schemas
   */
  private initializeMessageSchemas(): void {
    this.messageSchemas.set('sendMessage', {
      required: ['content'],
      properties: {
        content: { type: 'string', maxLength: 50000 },
        threadId: { type: 'string', optional: true },
        providerId: { type: 'string', optional: true }
      }
    });

    this.messageSchemas.set('configureProvider', {
      required: ['providerId', 'config'],
      properties: {
        providerId: { type: 'string', pattern: /^[a-zA-Z0-9_-]+$/ },
        config: { type: 'object' },
        scope: { type: 'string', enum: ['global', 'workspace', 'user'], optional: true }
      }
    });

    this.messageSchemas.set('testProviderConnection', {
      required: ['providerId', 'config'],
      properties: {
        providerId: { type: 'string', pattern: /^[a-zA-Z0-9_-]+$/ },
        config: { type: 'object' }
      }
    });

    // Add more schemas as needed for other message types
  }

  /**
   * Get or create security context for session
   */
  private async getOrCreateSecurityContext(
    context: Partial<WebViewSecurityContext>
  ): Promise<WebViewSecurityContext> {
    const sessionId = context.sessionId || 'default';
    
    if (!this.securityContexts.has(sessionId)) {
      const newContext: WebViewSecurityContext = {
        sessionId,
        origin: context.origin || 'vscode-webview://unknown',
        messageCount: 0,
        lastActivity: Date.now(),
        trustLevel: 'low'
      };
      
      this.securityContexts.set(sessionId, newContext);
      this.logger.debug('Created new security context', { sessionId, origin: newContext.origin });
    }

    return this.securityContexts.get(sessionId)!;
  }

  /**
   * Validate basic message structure
   */
  private validateMessageStructure(message: WebViewMessage): boolean {
    return (
      typeof message === 'object' &&
      message !== null &&
      typeof message.type === 'string' &&
      message.type.length > 0 &&
      (message.requestId === undefined || typeof message.requestId === 'string')
    );
  }

  /**
   * Check rate limiting for session
   */
  private checkRateLimit(sessionId: string): boolean {
    const now = Date.now();
    const key = `${sessionId}_${Math.floor(now / 1000)}`; // Per-second bucket
    
    const existing = this.messageQueue.get(key);
    if (existing) {
      if (existing.count >= this.config.rateLimitPerSecond) {
        return false;
      }
      existing.count++;
    } else {
      this.messageQueue.set(key, { timestamp: now, count: 1 });
    }

    // Cleanup old entries
    for (const [k, v] of this.messageQueue.entries()) {
      if (now - v.timestamp > 60000) { // Remove entries older than 1 minute
        this.messageQueue.delete(k);
      }
    }

    return true;
  }

  /**
   * Validate message against schema
   */
  private async validateMessageSchema(message: WebViewMessage): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const schema = this.messageSchemas.get(message.type);
    if (!schema) {
      // No schema defined, pass validation
      return { isValid: true, errors: [] };
    }

    const errors: string[] = [];
    
    // Check required fields
    for (const required of schema.required || []) {
      if (!(required in (message.data || {}))) {
        errors.push(`Missing required field: ${required}`);
      }
    }

    // Validate properties
    if (message.data && schema.properties) {
      for (const [prop, config] of Object.entries(schema.properties)) {
        const value = message.data[prop];
        
        if (value !== undefined) {
          if (!this.validatePropertyValue(value, config)) {
            errors.push(`Invalid value for field: ${prop}`);
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate individual property value
   */
  private validatePropertyValue(value: any, config: any): boolean {
    if (config.type && typeof value !== config.type) {
      return false;
    }

    if (config.maxLength && typeof value === 'string' && value.length > config.maxLength) {
      return false;
    }

    if (config.pattern && typeof value === 'string' && !config.pattern.test(value)) {
      return false;
    }

    if (config.enum && !config.enum.includes(value)) {
      return false;
    }

    return true;
  }

  /**
   * Sanitize message content
   */
  private async sanitizeMessageContent(
    message: WebViewMessage,
    context: WebViewSecurityContext
  ): Promise<{
    sanitizedMessage: WebViewMessage;
    threats: ThreatInfo[];
    blocked: boolean;
    sanitized: boolean;
  }> {
    const originalMessage = JSON.stringify(message);
    let sanitizedData = message.data;
    let allThreats: ThreatInfo[] = [];
    let blocked = false;
    let sanitized = false;

    // Sanitize based on message type
    switch (message.type) {
      case 'sendMessage':
        if (message.data?.content) {
          const result = await this.sanitizer.sanitize(
            message.data.content,
            SanitizationScope.USER_INPUT
          );
          
          if (result.blocked) {
            blocked = true;
          } else {
            sanitizedData = { ...message.data, content: result.sanitized };
            sanitized = result.original !== result.sanitized;
          }

          allThreats.push(...result.threats.map(t => this.convertToThreatInfo(t)));
        }
        break;

      case 'configureProvider':
      case 'testProviderConnection':
        if (message.data?.config) {
          const result = await this.sanitizer.sanitize(
            message.data.config,
            SanitizationScope.CONFIG_DATA
          );
          
          if (result.blocked) {
            blocked = true;
          } else {
            sanitizedData = { ...message.data, config: result.sanitized };
            sanitized = JSON.stringify(result.original) !== JSON.stringify(result.sanitized);
          }

          allThreats.push(...result.threats.map(t => this.convertToThreatInfo(t)));
        }
        break;

      default:
        // For other message types, sanitize the entire data object
        if (message.data) {
          const result = await this.sanitizer.sanitize(
            message.data,
            SanitizationScope.MESSAGE_DATA
          );
          
          if (result.blocked) {
            blocked = true;
          } else {
            sanitizedData = result.sanitized;
            sanitized = JSON.stringify(result.original) !== JSON.stringify(result.sanitized);
          }

          allThreats.push(...result.threats.map(t => this.convertToThreatInfo(t)));
        }
        break;
    }

    return {
      sanitizedMessage: {
        ...message,
        data: sanitizedData
      },
      threats: allThreats,
      blocked,
      sanitized
    };
  }

  /**
   * Convert sanitizer threat to ThreatInfo
   */
  private convertToThreatInfo(threat: any): ThreatInfo {
    return {
      type: this.mapThreatType(threat.pattern.type),
      severity: this.mapThreatSeverity(threat.severity),
      patterns: threat.matches,
      blocked: false // This is set at the message level
    };
  }

  /**
   * Map threat type to ThreatInfo type
   */
  private mapThreatType(type: ThreatType): ThreatInfo['type'] {
    switch (type) {
      case ThreatType.XSS: return 'xss';
      case ThreatType.COMMAND_INJECTION: return 'injection';
      case ThreatType.PATH_TRAVERSAL: return 'path_traversal';
      default: return 'unknown';
    }
  }

  /**
   * Map threat severity
   */
  private mapThreatSeverity(severity: ThreatSeverity): ThreatInfo['severity'] {
    switch (severity) {
      case ThreatSeverity.LOW: return 'low';
      case ThreatSeverity.MEDIUM: return 'medium';
      case ThreatSeverity.HIGH: return 'high';
      case ThreatSeverity.CRITICAL: return 'critical';
      default: return 'low';
    }
  }

  /**
   * Update security context based on validation result
   */
  private updateSecurityContext(
    context: WebViewSecurityContext,
    result: MessageValidationResult
  ): void {
    context.messageCount++;
    context.lastActivity = Date.now();

    // Adjust trust level based on security events
    if (result.blocked || result.threats.some(t => t.severity === 'critical')) {
      context.trustLevel = 'low';
    } else if (result.threats.length === 0 && context.messageCount > 100) {
      context.trustLevel = context.trustLevel === 'low' ? 'medium' : 'high';
    }

    this.securityContexts.set(context.sessionId, context);
  }

  /**
   * Log security events
   */
  private async logSecurityEvents(
    message: WebViewMessage,
    result: MessageValidationResult,
    context: WebViewSecurityContext,
    processingTime: number
  ): Promise<void> {
    // Log threats
    for (const threat of result.threats) {
      await this.auditLogger.logSecurityEvent(
        VesperaSecurityEvent.THREAT_DETECTED,
        {
          timestamp: Date.now(),
          userId: context.sessionId,
          resourceId: message.type,
          threat,
          metadata: {
            messageType: message.type,
            processingTime,
            trustLevel: context.trustLevel,
            blocked: result.blocked
          }
        }
      );
    }

    // Log sanitization if applied
    if (result.sanitizedMessage && result.sanitizedMessage !== message) {
      await this.auditLogger.logSecurityEvent(
        VesperaSecurityEvent.SANITIZATION_APPLIED,
        {
          timestamp: Date.now(),
          userId: context.sessionId,
          resourceId: message.type,
          metadata: {
            messageType: message.type,
            threatsCount: result.threats.length,
            processingTime
          }
        }
      );
    }

    // Log validation errors
    if (result.errors.length > 0) {
      this.logger.warn('Message validation errors', {
        messageType: message.type,
        sessionId: context.sessionId,
        errors: result.errors,
        blocked: result.blocked
      });
    }
  }

  /**
   * Check if string matches pattern (supports wildcards)
   */
  private matchesPattern(value: string, pattern: string): boolean {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(value);
    }
    return value === pattern;
  }

  /**
   * Dispose the security manager
   */
  dispose(): void {
    if (this.disposed) return;

    this.securityContexts.clear();
    this.messageQueue.clear();
    this.messageSchemas.clear();

    this.disposed = true;
    this.logger.info('WebViewSecurityManager disposed', { 
      finalStats: this.getSecurityStats() 
    });
  }
}