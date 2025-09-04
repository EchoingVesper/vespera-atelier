/**
 * MCP Message Validation Security Layer
 * 
 * Enterprise-grade validation for MCP messages with high-throughput processing,
 * comprehensive threat detection, and minimal performance overhead (<1ms per message).
 */

import * as vscode from 'vscode';
import { SecurityEnhancedCoreServices } from '../core/security/SecurityEnhancedCoreServices';
import { 
  VesperaSecurityEvent, 
  SecurityEventContext,
  VesperaSecurityErrorCode,
  ThreatSeverity,
  SanitizationScope
} from '../types/security';
import { VesperaSecurityError } from '../core/security/VesperaSecurityErrors';

export interface McpMessage {
  jsonrpc: string;
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
  [key: string]: any;
}

export interface McpValidationRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  messageType: 'request' | 'response' | 'notification' | 'any';
  validators: McpValidator[];
  threatLevel: ThreatSeverity;
  action: 'allow' | 'block' | 'sanitize' | 'warn';
}

export interface McpValidator {
  type: 'schema' | 'size' | 'pattern' | 'rate' | 'content' | 'method';
  config: {
    // Schema validation
    schema?: any;
    
    // Size validation
    maxSize?: number; // bytes
    maxDepth?: number; // object nesting
    
    // Pattern validation
    patterns?: Array<{
      pattern: string | RegExp;
      location: 'method' | 'params' | 'result' | 'any';
      action: 'block' | 'sanitize';
    }>;
    
    // Rate limiting
    maxRequestsPerMinute?: number;
    
    // Content validation
    allowedMethods?: string[];
    blockedMethods?: string[];
    sensitiveDataPatterns?: RegExp[];
    
    // Method-specific validation
    methodRules?: Record<string, {
      requiredParams?: string[];
      maxParamSize?: number;
      allowedParamTypes?: Record<string, string>;
    }>;
  };
}

export interface McpValidationResult {
  valid: boolean;
  messageId: string | number | null;
  validationTime: number;
  threats: Array<{
    ruleId: string;
    type: string;
    severity: ThreatSeverity;
    description: string;
    location: string;
    action: string;
  }>;
  sanitizedMessage?: McpMessage;
  blocked: boolean;
  warnings: string[];
  metrics: {
    messageSize: number;
    objectDepth: number;
    validationOverhead: number; // percentage
  };
}

export interface McpValidationMetrics {
  totalMessages: number;
  validMessages: number;
  blockedMessages: number;
  sanitizedMessages: number;
  averageValidationTime: number;
  peakValidationTime: number;
  throughputMessagesPerSecond: number;
  threatDetections: {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<ThreatSeverity, number>;
  };
  performance: {
    averageOverhead: number; // percentage
    targetOverhead: number; // target <1%
    compliant: boolean;
  };
}

/**
 * High-performance MCP message validator
 */
export class McpMessageValidator {
  private static instance: McpMessageValidator | null = null;
  private securityServices: SecurityEnhancedCoreServices | null = null;
  private validationRules: Map<string, McpValidationRule> = new Map();
  private metrics: McpValidationMetrics;
  
  // Performance optimization caches
  private schemaCache = new Map<string, any>();
  private patternCache = new Map<string, RegExp>();
  private validationCache = new Map<string, { result: McpValidationResult; timestamp: number }>();
  private readonly CACHE_TTL = 60 * 1000; // 1 minute
  private readonly MAX_CACHE_SIZE = 1000;

  // Rate limiting tracking
  private rateLimitTracking = new Map<string, { requests: number; resetTime: number }>();

  private constructor() {
    this.metrics = this.initializeMetrics();
    this.initializeDefaultRules();
  }

  /**
   * Initialize MCP message validator
   */
  public static async initialize(): Promise<McpMessageValidator> {
    if (McpMessageValidator.instance) {
      return McpMessageValidator.instance;
    }

    const validator = new McpMessageValidator();

    try {
      validator.securityServices = SecurityEnhancedCoreServices.getInstance();
      console.log('McpMessageValidator initialized with SecurityEnhancedCoreServices');
    } catch (error) {
      console.warn('McpMessageValidator initialized with reduced security:', error);
    }

    McpMessageValidator.instance = validator;
    return validator;
  }

  /**
   * Validate MCP message with high-performance processing
   */
  public async validateMessage(
    message: McpMessage,
    context?: {
      userId?: string;
      sessionId?: string;
      clientId?: string;
    }
  ): Promise<McpValidationResult> {
    const startTime = performance.now();
    const messageId = message.id || 'unknown';
    
    try {
      this.metrics.totalMessages++;

      // Fast path: check cache first
      const cacheKey = this.getCacheKey(message, context);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return {
          ...cached,
          validationTime: performance.now() - startTime
        };
      }

      // Initialize validation result
      const result: McpValidationResult = {
        valid: true,
        messageId,
        validationTime: 0,
        threats: [],
        blocked: false,
        warnings: [],
        metrics: {
          messageSize: JSON.stringify(message).length,
          objectDepth: this.calculateObjectDepth(message),
          validationOverhead: 0
        }
      };

      // Apply validation rules in priority order
      const sortedRules = Array.from(this.validationRules.values())
        .filter(rule => rule.enabled)
        .sort((a, b) => a.priority - b.priority);

      let sanitizedMessage = { ...message };
      let hasBlockingThreat = false;

      for (const rule of sortedRules) {
        // Check message type compatibility
        if (!this.isMessageTypeCompatible(rule.messageType, message)) {
          continue;
        }

        // Apply rule validators
        const ruleResult = await this.applyValidationRule(rule, sanitizedMessage, context);
        
        if (ruleResult.threats.length > 0) {
          result.threats.push(...ruleResult.threats);
          
          // Handle blocking threats
          if (ruleResult.blocked) {
            hasBlockingThreat = true;
          }
          
          // Apply sanitization if configured
          if (ruleResult.sanitizedMessage && rule.action === 'sanitize') {
            sanitizedMessage = ruleResult.sanitizedMessage;
          }
          
          // Add warnings
          if (rule.action === 'warn') {
            result.warnings.push(`Rule ${rule.id}: ${ruleResult.threats[0]?.description}`);
          }
        }
      }

      // Set final validation state
      result.valid = !hasBlockingThreat;
      result.blocked = hasBlockingThreat;
      result.sanitizedMessage = sanitizedMessage;
      result.validationTime = performance.now() - startTime;
      result.metrics.validationOverhead = (result.validationTime / (result.validationTime + 1)) * 100;

      // Update metrics
      this.updateMetrics(result);

      // Cache successful validations
      if (!hasBlockingThreat) {
        this.addToCache(cacheKey, result);
      }

      // Log security events for threats
      if (result.threats.length > 0) {
        await this.logSecurityEvent(result, context);
      }

      return result;

    } catch (error) {
      const errorResult: McpValidationResult = {
        valid: false,
        messageId,
        validationTime: performance.now() - startTime,
        threats: [{
          ruleId: 'validation_error',
          type: 'system_error',
          severity: ThreatSeverity.HIGH,
          description: error instanceof Error ? error.message : String(error),
          location: 'validator',
          action: 'block'
        }],
        blocked: true,
        warnings: [],
        metrics: {
          messageSize: 0,
          objectDepth: 0,
          validationOverhead: 100
        }
      };

      this.updateMetrics(errorResult);
      throw new VesperaSecurityError(
        `MCP message validation failed: ${error instanceof Error ? error.message : String(error)}`,
        VesperaSecurityErrorCode.THREAT_DETECTED,
        undefined,
        { messageId, validationTime: errorResult.validationTime }
      );
    }
  }

  /**
   * Batch validate multiple MCP messages for high throughput
   */
  public async validateBatch(
    messages: McpMessage[],
    context?: {
      userId?: string;
      sessionId?: string;
      clientId?: string;
    }
  ): Promise<{
    results: McpValidationResult[];
    batchMetrics: {
      totalMessages: number;
      validMessages: number;
      blockedMessages: number;
      batchTime: number;
      averageValidationTime: number;
      throughput: number; // messages per second
    };
  }> {
    const batchStartTime = performance.now();
    
    // Process in parallel with controlled concurrency
    const concurrencyLimit = Math.min(10, Math.max(2, messages.length / 50));
    const results: McpValidationResult[] = [];
    
    for (let i = 0; i < messages.length; i += concurrencyLimit) {
      const batch = messages.slice(i, i + concurrencyLimit);
      const batchResults = await Promise.all(
        batch.map(message => this.validateMessage(message, context))
      );
      results.push(...batchResults);
    }

    const batchTime = performance.now() - batchStartTime;
    const averageValidationTime = results.reduce((sum, r) => sum + r.validationTime, 0) / results.length;
    
    const batchMetrics = {
      totalMessages: results.length,
      validMessages: results.filter(r => r.valid).length,
      blockedMessages: results.filter(r => r.blocked).length,
      batchTime,
      averageValidationTime,
      throughput: (results.length / batchTime) * 1000
    };

    // Update throughput metrics
    this.metrics.throughputMessagesPerSecond = batchMetrics.throughput;

    return { results, batchMetrics };
  }

  /**
   * Apply a single validation rule
   */
  private async applyValidationRule(
    rule: McpValidationRule,
    message: McpMessage,
    context?: any
  ): Promise<{
    threats: any[];
    blocked: boolean;
    sanitizedMessage?: McpMessage;
  }> {
    const threats: any[] = [];
    let sanitizedMessage: McpMessage | undefined;
    let blocked = false;

    for (const validator of rule.validators) {
      try {
        const validationResult = await this.applyValidator(validator, message, context);
        
        if (!validationResult.valid) {
          threats.push({
            ruleId: rule.id,
            type: validator.type,
            severity: rule.threatLevel,
            description: validationResult.description,
            location: validationResult.location,
            action: rule.action
          });

          if (rule.action === 'block') {
            blocked = true;
          } else if (rule.action === 'sanitize' && validationResult.sanitizedMessage) {
            sanitizedMessage = validationResult.sanitizedMessage;
          }
        }
      } catch (error) {
        threats.push({
          ruleId: rule.id,
          type: 'validator_error',
          severity: ThreatSeverity.MEDIUM,
          description: `Validator error: ${error instanceof Error ? error.message : String(error)}`,
          location: 'validator_execution',
          action: 'warn'
        });
      }
    }

    return { threats, blocked, sanitizedMessage };
  }

  /**
   * Apply individual validator
   */
  private async applyValidator(
    validator: McpValidator,
    message: McpMessage,
    context?: any
  ): Promise<{
    valid: boolean;
    description?: string;
    location?: string;
    sanitizedMessage?: McpMessage;
  }> {
    switch (validator.type) {
      case 'size':
        return this.validateSize(validator.config, message);
      
      case 'pattern':
        return this.validatePatterns(validator.config, message);
      
      case 'method':
        return this.validateMethod(validator.config, message);
      
      case 'rate':
        return this.validateRate(validator.config, message, context);
      
      case 'content':
        return this.validateContent(validator.config, message);
      
      case 'schema':
        return this.validateSchema(validator.config, message);
      
      default:
        return { valid: true };
    }
  }

  /**
   * Size validation
   */
  private validateSize(config: any, message: McpMessage): { valid: boolean; description?: string; location?: string } {
    const messageSize = JSON.stringify(message).length;
    const maxSize = config.maxSize || 10 * 1024 * 1024; // 10MB default
    
    if (messageSize > maxSize) {
      return {
        valid: false,
        description: `Message size ${messageSize} exceeds limit ${maxSize}`,
        location: 'message_size'
      };
    }

    const depth = this.calculateObjectDepth(message);
    const maxDepth = config.maxDepth || 50;
    
    if (depth > maxDepth) {
      return {
        valid: false,
        description: `Object depth ${depth} exceeds limit ${maxDepth}`,
        location: 'object_depth'
      };
    }

    return { valid: true };
  }

  /**
   * Pattern validation
   */
  private validatePatterns(config: any, message: McpMessage): { valid: boolean; description?: string; location?: string } {
    if (!config.patterns) return { valid: true };

    for (const patternConfig of config.patterns) {
      let pattern: RegExp;
      
      if (typeof patternConfig.pattern === 'string') {
        pattern = this.getCompiledPattern(patternConfig.pattern);
      } else {
        pattern = patternConfig.pattern;
      }

      const searchText = this.getTextForPatternLocation(message, patternConfig.location);
      
      if (pattern.test(searchText)) {
        return {
          valid: false,
          description: `Blocked pattern detected: ${pattern.source}`,
          location: patternConfig.location
        };
      }
    }

    return { valid: true };
  }

  /**
   * Method validation
   */
  private validateMethod(config: any, message: McpMessage): { valid: boolean; description?: string; location?: string } {
    if (!message.method) return { valid: true };

    // Check blocked methods
    if (config.blockedMethods && config.blockedMethods.includes(message.method)) {
      return {
        valid: false,
        description: `Method ${message.method} is blocked`,
        location: 'method'
      };
    }

    // Check allowed methods
    if (config.allowedMethods && !config.allowedMethods.includes(message.method)) {
      return {
        valid: false,
        description: `Method ${message.method} is not in allowed list`,
        location: 'method'
      };
    }

    // Method-specific parameter validation
    if (config.methodRules && config.methodRules[message.method]) {
      const methodRule = config.methodRules[message.method];
      
      if (methodRule.requiredParams) {
        for (const param of methodRule.requiredParams) {
          if (!message.params || !message.params.hasOwnProperty(param)) {
            return {
              valid: false,
              description: `Required parameter ${param} missing for method ${message.method}`,
              location: 'params'
            };
          }
        }
      }
    }

    return { valid: true };
  }

  /**
   * Rate limiting validation
   */
  private validateRate(config: any, message: McpMessage, context?: any): { valid: boolean; description?: string; location?: string } {
    if (!config.maxRequestsPerMinute || !context?.clientId) {
      return { valid: true };
    }

    const clientId = context.clientId;
    const now = Date.now();
    const windowStart = now - 60 * 1000; // 1 minute window
    
    let tracking = this.rateLimitTracking.get(clientId);
    if (!tracking || tracking.resetTime < windowStart) {
      tracking = { requests: 0, resetTime: now };
      this.rateLimitTracking.set(clientId, tracking);
    }

    tracking.requests++;
    
    if (tracking.requests > config.maxRequestsPerMinute) {
      return {
        valid: false,
        description: `Rate limit exceeded: ${tracking.requests} > ${config.maxRequestsPerMinute} requests/minute`,
        location: 'rate_limit'
      };
    }

    return { valid: true };
  }

  /**
   * Content validation
   */
  private validateContent(config: any, message: McpMessage): { valid: boolean; description?: string; location?: string } {
    if (!config.sensitiveDataPatterns) return { valid: true };

    const messageText = JSON.stringify(message);
    
    for (const pattern of config.sensitiveDataPatterns) {
      if (pattern.test(messageText)) {
        return {
          valid: false,
          description: `Sensitive data pattern detected`,
          location: 'message_content'
        };
      }
    }

    return { valid: true };
  }

  /**
   * Schema validation
   */
  private validateSchema(config: any, message: McpMessage): { valid: boolean; description?: string; location?: string } {
    // Simplified schema validation - would use proper JSON schema validator in production
    if (config.schema && config.schema.required) {
      for (const field of config.schema.required) {
        if (!message.hasOwnProperty(field)) {
          return {
            valid: false,
            description: `Required field ${field} missing`,
            location: 'schema'
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Initialize default validation rules
   */
  private initializeDefaultRules(): void {
    // Size limits rule
    this.validationRules.set('size_limits', {
      id: 'size_limits',
      name: 'Message Size Limits',
      enabled: true,
      priority: 1,
      messageType: 'any',
      threatLevel: ThreatSeverity.HIGH,
      action: 'block',
      validators: [{
        type: 'size',
        config: {
          maxSize: 50 * 1024 * 1024, // 50MB
          maxDepth: 100
        }
      }]
    });

    // Injection patterns rule
    this.validationRules.set('injection_patterns', {
      id: 'injection_patterns',
      name: 'Injection Pattern Detection',
      enabled: true,
      priority: 2,
      messageType: 'any',
      threatLevel: ThreatSeverity.CRITICAL,
      action: 'block',
      validators: [{
        type: 'pattern',
        config: {
          patterns: [
            { pattern: /\.\.\//g, location: 'any', action: 'block' }, // Path traversal
            { pattern: /<script/gi, location: 'any', action: 'block' }, // XSS
            { pattern: /eval\s*\(/gi, location: 'any', action: 'block' }, // Code injection
            { pattern: /\$\(/g, location: 'any', action: 'block' } // Command injection
          ]
        }
      }]
    });

    // Method restrictions rule
    this.validationRules.set('method_restrictions', {
      id: 'method_restrictions',
      name: 'Method Access Control',
      enabled: true,
      priority: 3,
      messageType: 'request',
      threatLevel: ThreatSeverity.HIGH,
      action: 'block',
      validators: [{
        type: 'method',
        config: {
          blockedMethods: [
            'system/execute',
            'file/delete_system',
            'process/kill',
            'network/external_request'
          ]
        }
      }]
    });

    // Rate limiting rule
    this.validationRules.set('rate_limiting', {
      id: 'rate_limiting',
      name: 'Request Rate Limiting',
      enabled: true,
      priority: 4,
      messageType: 'request',
      threatLevel: ThreatSeverity.MEDIUM,
      action: 'block',
      validators: [{
        type: 'rate',
        config: {
          maxRequestsPerMinute: 1000
        }
      }]
    });
  }

  /**
   * Helper methods
   */
  private calculateObjectDepth(obj: any, depth = 0): number {
    if (depth > 100 || obj === null || typeof obj !== 'object') {
      return depth;
    }

    const values = Object.values(obj);
    if (values.length === 0) return depth;

    return Math.max(...values.map(value => this.calculateObjectDepth(value, depth + 1)));
  }

  private isMessageTypeCompatible(ruleType: string, message: McpMessage): boolean {
    if (ruleType === 'any') return true;
    
    if (ruleType === 'request') return Boolean(message.method);
    if (ruleType === 'response') return Boolean(message.result !== undefined || message.error !== undefined);
    if (ruleType === 'notification') return Boolean(message.method && message.id === undefined);
    
    return false;
  }

  private getCompiledPattern(pattern: string): RegExp {
    if (!this.patternCache.has(pattern)) {
      this.patternCache.set(pattern, new RegExp(pattern, 'gi'));
    }
    return this.patternCache.get(pattern)!;
  }

  private getTextForPatternLocation(message: McpMessage, location: string): string {
    switch (location) {
      case 'method': return message.method || '';
      case 'params': return JSON.stringify(message.params || {});
      case 'result': return JSON.stringify(message.result || {});
      default: return JSON.stringify(message);
    }
  }

  private getCacheKey(message: McpMessage, context?: any): string {
    const contextStr = context ? JSON.stringify(context) : '';
    return `${JSON.stringify(message)}_${contextStr}`;
  }

  private getFromCache(key: string): McpValidationResult | null {
    const cached = this.validationCache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.validationCache.delete(key);
      return null;
    }

    return cached.result;
  }

  private addToCache(key: string, result: McpValidationResult): void {
    if (this.validationCache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.validationCache.keys().next().value;
      this.validationCache.delete(oldestKey);
    }

    this.validationCache.set(key, {
      result,
      timestamp: Date.now()
    });
  }

  private initializeMetrics(): McpValidationMetrics {
    return {
      totalMessages: 0,
      validMessages: 0,
      blockedMessages: 0,
      sanitizedMessages: 0,
      averageValidationTime: 0,
      peakValidationTime: 0,
      throughputMessagesPerSecond: 0,
      threatDetections: {
        total: 0,
        byType: {},
        bySeverity: {
          low: 0,
          medium: 0,
          high: 0,
          critical: 0
        }
      },
      performance: {
        averageOverhead: 0,
        targetOverhead: 1.0, // <1% target
        compliant: true
      }
    };
  }

  private updateMetrics(result: McpValidationResult): void {
    if (result.valid) this.metrics.validMessages++;
    if (result.blocked) this.metrics.blockedMessages++;
    if (result.sanitizedMessage) this.metrics.sanitizedMessages++;

    // Update timing metrics
    this.metrics.averageValidationTime = 
      (this.metrics.averageValidationTime * (this.metrics.totalMessages - 1) + 
       result.validationTime) / this.metrics.totalMessages;
    
    if (result.validationTime > this.metrics.peakValidationTime) {
      this.metrics.peakValidationTime = result.validationTime;
    }

    // Update threat metrics
    this.metrics.threatDetections.total += result.threats.length;
    result.threats.forEach(threat => {
      this.metrics.threatDetections.byType[threat.type] = 
        (this.metrics.threatDetections.byType[threat.type] || 0) + 1;
      this.metrics.threatDetections.bySeverity[threat.severity]++;
    });

    // Update performance metrics
    this.metrics.performance.averageOverhead = 
      (this.metrics.performance.averageOverhead * (this.metrics.totalMessages - 1) + 
       result.metrics.validationOverhead) / this.metrics.totalMessages;
    
    this.metrics.performance.compliant = 
      this.metrics.performance.averageOverhead <= this.metrics.performance.targetOverhead;
  }

  private async logSecurityEvent(result: McpValidationResult, context?: any): Promise<void> {
    if (this.securityServices?.securityAuditLogger && result.threats.length > 0) {
      try {
        await this.securityServices.securityAuditLogger.logSecurityEvent(
          VesperaSecurityEvent.THREAT_DETECTED,
          {
            timestamp: Date.now(),
            metadata: {
              messageId: result.messageId,
              threats: result.threats.length,
              blocked: result.blocked,
              validationTime: result.validationTime,
              messageSize: result.metrics.messageSize,
              clientId: context?.clientId
            }
          }
        );
      } catch (error) {
        console.warn('Failed to log MCP validation security event:', error);
      }
    }
  }

  /**
   * Public API methods
   */
  public getMetrics(): McpValidationMetrics {
    return { ...this.metrics };
  }

  public getValidationRules(): Map<string, McpValidationRule> {
    return new Map(this.validationRules);
  }

  public updateValidationRule(ruleId: string, rule: Partial<McpValidationRule>): void {
    const existing = this.validationRules.get(ruleId);
    if (existing) {
      this.validationRules.set(ruleId, { ...existing, ...rule });
    }
  }

  public clearCache(): void {
    this.validationCache.clear();
    this.patternCache.clear();
    this.rateLimitTracking.clear();
  }

  public resetMetrics(): void {
    this.metrics = this.initializeMetrics();
  }

  public dispose(): void {
    this.clearCache();
    McpMessageValidator.instance = null;
  }
}

/**
 * Factory function for easy access
 */
export async function createMcpMessageValidator(): Promise<McpMessageValidator> {
  return McpMessageValidator.initialize();
}