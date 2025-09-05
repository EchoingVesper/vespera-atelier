/**
 * Vespera Input Sanitizer
 * 
 * Multi-layer defense system for input sanitization with DOMPurify integration,
 * schema validation, threat detection, and CSP management.
 */

import * as vscode from 'vscode';
import { VesperaLogger } from '../../logging/VesperaLogger';
import { VesperaErrorHandler } from '../../error-handling/VesperaErrorHandler';
import {
  SanitizationConfiguration,
  SanitizationRule,
  SanitizationScope,
  SanitizationProcessor,
  SanitizationResult,
  ThreatPattern,
  DetectedThreat,
  ThreatType,
  ThreatSeverity,
  ThreatAction,
  ProcessorConfig,
  VesperaInputSanitizerInterface,
  CSPConfiguration,
  ThreatDetectionConfig
} from '../../../types/security';
import { VesperaSanitizationError, VesperaThreatError } from '../VesperaSecurityErrors';
import { VesperaSecurityErrorCode } from '../../../types/security';
import { VesperaSeverity } from '../../error-handling/VesperaErrors';

// Default configurations
export const DEFAULT_CSP_CONFIG: CSPConfiguration = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", "data:", "https:"],
  connectSrc: ["'self'"],
  fontSrc: ["'self'"],
  mediaSrc: ["'self'"],
  objectSrc: ["'none'"],
  childSrc: ["'self'"],
  frameAncestors: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  upgradeInsecureRequests: true
};

export const DEFAULT_THREAT_DETECTION_CONFIG: ThreatDetectionConfig = {
  patterns: [
    {
      id: 'xss-script-tag',
      type: ThreatType.XSS,
      pattern: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      severity: ThreatSeverity.CRITICAL,
      action: ThreatAction.BLOCK
    },
    {
      id: 'xss-javascript-protocol',
      type: ThreatType.XSS,
      pattern: /javascript:/gi,
      severity: ThreatSeverity.HIGH,
      action: ThreatAction.SANITIZE
    },
    {
      id: 'xss-event-handlers',
      type: ThreatType.XSS,
      pattern: /on\w+\s*=/gi,
      severity: ThreatSeverity.HIGH,
      action: ThreatAction.SANITIZE
    },
    {
      id: 'path-traversal',
      type: ThreatType.PATH_TRAVERSAL,
      pattern: /\.\.[\/\\]/g,
      severity: ThreatSeverity.HIGH,
      action: ThreatAction.BLOCK
    },
    {
      id: 'command-injection',
      type: ThreatType.COMMAND_INJECTION,
      pattern: /[;&|`$(){}]/g,
      severity: ThreatSeverity.CRITICAL,
      action: ThreatAction.BLOCK
    }
  ],
  enableRealTimeDetection: true,
  alertThresholds: {
    low: 10,
    medium: 5,
    high: 2,
    critical: 1
  }
};

/**
 * Input sanitization service with comprehensive threat detection
 */
export class VesperaInputSanitizer implements VesperaInputSanitizerInterface {
  private static instance: VesperaInputSanitizer;
  
  private rules: Map<SanitizationScope, SanitizationRule[]> = new Map();
  private threatPatterns: ThreatPattern[] = [];
  private disposed = false;
  
  /**
   * Check if service is disposed
   */
  public get isDisposed(): boolean {
    return this.disposed;
  }
  
  // Statistics tracking
  private stats = {
    totalSanitizations: 0,
    threatsDetected: 0,
    threatsBlocked: 0,
    processingTimeTotal: 0,
    lastReset: Date.now()
  };

  // Threat detection counters for alerting
  private threatCounters = new Map<ThreatSeverity, number>();

  constructor(
    private logger: VesperaLogger,
    private errorHandler: VesperaErrorHandler,
    private config: SanitizationConfiguration
  ) {
    this.logger = logger.createChild('InputSanitizer');
    this.initializeRules(config.rules);
    this.initializeThreatPatterns(config.threatDetection.patterns);
    this.initializeThreatCounters();
    
    this.logger.info('VesperaInputSanitizer initialized', {
      rulesCount: config.rules.length,
      threatPatternsCount: config.threatDetection.patterns.length,
      strictMode: config.strictMode
    });
  }

  /**
   * Initialize the input sanitizer service
   */
  public static async initialize(config: {
    logger: VesperaLogger;
    errorHandler: VesperaErrorHandler;
    rules: SanitizationRule[];
    configuration?: Partial<SanitizationConfiguration>;
  }): Promise<VesperaInputSanitizer> {
    if (!VesperaInputSanitizer.instance) {
      const sanitizationConfig: SanitizationConfiguration = {
        enabled: true,
        rules: config.rules,
        strictMode: true,
        csp: DEFAULT_CSP_CONFIG,
        threatDetection: DEFAULT_THREAT_DETECTION_CONFIG,
        ...config.configuration
      };
      
      VesperaInputSanitizer.instance = new VesperaInputSanitizer(
        config.logger,
        config.errorHandler,
        sanitizationConfig
      );
    }
    return VesperaInputSanitizer.instance;
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): VesperaInputSanitizer {
    if (!VesperaInputSanitizer.instance) {
      throw new VesperaSanitizationError(
        'InputSanitizer not initialized',
        'unknown',
        0,
        0
      );
    }
    return VesperaInputSanitizer.instance;
  }

  /**
   * Sanitize input based on scope and rules
   */
  async sanitize(
    input: any,
    scope: SanitizationScope,
    context?: Record<string, any>
  ): Promise<SanitizationResult> {
    if (this.disposed) {
      throw new VesperaSanitizationError(
        'InputSanitizer has been disposed',
        'unknown',
        0,
        0
      );
    }

    const startTime = Date.now();
    this.stats.totalSanitizations++;

    const inputString = typeof input === 'string' ? input : JSON.stringify(input);
    const rules = this.getRulesForScope(scope);
    
    let sanitized = input;
    const threats: DetectedThreat[] = [];
    const applied: string[] = [];
    let blocked = false;

    this.logger.debug('Starting sanitization', { 
      scope, 
      inputLength: inputString.length,
      rulesCount: rules.length 
    });

    try {
      // Apply rules in priority order
      for (const rule of rules) {
        if (!rule.enabled) continue;

        // Detect threats first
        const detectedThreats = this.detectThreats(sanitized, rule.threatPatterns, scope.toString());
        threats.push(...detectedThreats);

        // Update threat statistics
        for (const threat of detectedThreats) {
          this.stats.threatsDetected++;
          this.updateThreatCounters(threat.severity);
        }

        // Check if we should block based on threats
        const criticalThreats = detectedThreats.filter(t => t.severity === ThreatSeverity.CRITICAL);
        if (criticalThreats.length > 0 && this.config.strictMode) {
          blocked = true;
          this.stats.threatsBlocked++;
          
          this.logger.warn('Input blocked due to critical threats', { 
            threatCount: criticalThreats.length,
            rule: rule.id,
            scope
          });
          break;
        }

        // Apply processors
        for (const processor of rule.processors) {
          const beforeLength = JSON.stringify(sanitized).length;
          sanitized = await this.applyProcessor(sanitized, processor, scope, context);
          const afterLength = JSON.stringify(sanitized).length;
          
          applied.push(`${rule.id}:${processor.type}`);
          
          this.logger.debug('Processor applied', {
            rule: rule.id,
            processor: processor.type,
            beforeLength,
            afterLength,
            reduction: beforeLength - afterLength
          });
        }
      }

      const result: SanitizationResult = {
        original: input,
        sanitized: blocked ? null : sanitized,
        threats,
        applied,
        blocked
      };

      const processingTime = Date.now() - startTime;
      this.stats.processingTimeTotal += processingTime;

      // Log sanitization event
      await this.logSanitizationEvent(scope, result, processingTime);

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error('Sanitization failed', error, { scope, inputLength: inputString.length });
      
      throw new VesperaSanitizationError(
        'Input sanitization failed',
        'processing_error',
        inputString.length,
        0,
        VesperaSeverity.HIGH,
        { originalError: error, scope, processingTime }
      );
    }
  }

  /**
   * Generate Content Security Policy for WebView
   */
  generateCSPPolicy(options: {
    context: string;
    allowedSources?: string[];
    strictMode?: boolean;
  }): string {
    const csp = { ...this.config.csp };
    
    // Add allowed sources if provided
    if (options.allowedSources) {
      csp.scriptSrc = [...csp.scriptSrc, ...options.allowedSources];
      csp.connectSrc = [...csp.connectSrc, ...options.allowedSources];
    }
    
    // Apply strict mode restrictions
    if (options.strictMode) {
      csp.scriptSrc = csp.scriptSrc.filter(src => src !== "'unsafe-inline'");
      csp.styleSrc = csp.styleSrc.filter(src => src !== "'unsafe-inline'");
    }

    const policy = [
      `default-src ${csp.defaultSrc.join(' ')}`,
      `script-src ${csp.scriptSrc.join(' ')}`,
      `style-src ${csp.styleSrc.join(' ')}`,
      `img-src ${csp.imgSrc.join(' ')}`,
      `connect-src ${csp.connectSrc.join(' ')}`,
      `font-src ${csp.fontSrc.join(' ')}`,
      `media-src ${csp.mediaSrc.join(' ')}`,
      `object-src ${csp.objectSrc.join(' ')}`,
      `child-src ${csp.childSrc.join(' ')}`,
      `frame-ancestors ${csp.frameAncestors.join(' ')}`,
      `base-uri ${csp.baseUri.join(' ')}`,
      `form-action ${csp.formAction.join(' ')}`
    ];

    if (csp.upgradeInsecureRequests) {
      policy.push('upgrade-insecure-requests');
    }

    if (csp.reportUri) {
      policy.push(`report-uri ${csp.reportUri}`);
    }

    const policyString = policy.join('; ');
    
    this.logger.debug('CSP policy generated', { 
      context: options.context,
      policyLength: policyString.length,
      strictMode: options.strictMode 
    });

    return policyString;
  }

  /**
   * Validate message against schema (placeholder for full schema validation)
   */
  async validateMessage(message: any, schemaId: string): Promise<boolean> {
    try {
      // This would integrate with a proper schema validation library
      // For now, basic validation
      if (typeof message !== 'object' || message === null) {
        return false;
      }

      // Check for required fields based on schemaId
      switch (schemaId) {
        case 'chat-message':
          return typeof message.content === 'string' && message.content.length > 0;
        case 'configuration':
          return typeof message.settings === 'object';
        default:
          this.logger.warn('Unknown schema ID for validation', { schemaId });
          return true; // Fail open for unknown schemas
      }

    } catch (error) {
      this.logger.error('Message validation failed', error, { schemaId });
      return false;
    }
  }

  /**
   * Add a sanitization rule
   */
  addRule(rule: SanitizationRule): void {
    if (this.disposed) return;

    const scopeRules = this.rules.get(rule.scope) || [];
    
    // Remove existing rule with same ID
    const filteredRules = scopeRules.filter(r => r.id !== rule.id);
    filteredRules.push(rule);
    filteredRules.sort((a, b) => b.priority - a.priority);
    
    this.rules.set(rule.scope, filteredRules);
    
    this.logger.info('Sanitization rule added', { 
      ruleId: rule.id, 
      scope: rule.scope,
      priority: rule.priority 
    });
  }

  /**
   * Remove a sanitization rule
   */
  removeRule(ruleId: string): void {
    if (this.disposed) return;

    let removed = false;
    for (const [scope, rules] of this.rules.entries()) {
      const filteredRules = rules.filter(r => r.id !== ruleId);
      if (filteredRules.length !== rules.length) {
        this.rules.set(scope, filteredRules);
        removed = true;
      }
    }

    if (removed) {
      this.logger.info('Sanitization rule removed', { ruleId });
    }
  }

  /**
   * Get comprehensive statistics
   */
  getStats(): {
    totalSanitizations: number;
    threatsDetected: number;
    threatsBlocked: number;
    averageProcessingTime: number;
    threatBreakdown: Record<ThreatSeverity, number>;
    rulesCount: number;
    scopesCount: number;
  } {
    const averageProcessingTime = this.stats.totalSanitizations > 0 
      ? this.stats.processingTimeTotal / this.stats.totalSanitizations 
      : 0;

    const threatBreakdown: Record<ThreatSeverity, number> = {
      [ThreatSeverity.LOW]: this.threatCounters.get(ThreatSeverity.LOW) || 0,
      [ThreatSeverity.MEDIUM]: this.threatCounters.get(ThreatSeverity.MEDIUM) || 0,
      [ThreatSeverity.HIGH]: this.threatCounters.get(ThreatSeverity.HIGH) || 0,
      [ThreatSeverity.CRITICAL]: this.threatCounters.get(ThreatSeverity.CRITICAL) || 0,
    };

    let totalRules = 0;
    for (const rules of this.rules.values()) {
      totalRules += rules.length;
    }

    return {
      totalSanitizations: this.stats.totalSanitizations,
      threatsDetected: this.stats.threatsDetected,
      threatsBlocked: this.stats.threatsBlocked,
      averageProcessingTime,
      threatBreakdown,
      rulesCount: totalRules,
      scopesCount: this.rules.size
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    if (this.disposed) return;

    this.stats = {
      totalSanitizations: 0,
      threatsDetected: 0,
      threatsBlocked: 0,
      processingTimeTotal: 0,
      lastReset: Date.now()
    };

    this.initializeThreatCounters();
    this.logger.info('InputSanitizer statistics reset');
  }

  /**
   * Initialize rules from configuration
   */
  private initializeRules(rules: SanitizationRule[]): void {
    for (const rule of rules) {
      const scopeRules = this.rules.get(rule.scope) || [];
      scopeRules.push(rule);
      scopeRules.sort((a, b) => b.priority - a.priority);
      this.rules.set(rule.scope, scopeRules);
    }
    
    this.logger.info('Sanitization rules initialized', { 
      totalRules: rules.length,
      scopes: Array.from(this.rules.keys())
    });
  }

  /**
   * Initialize threat patterns
   */
  private initializeThreatPatterns(patterns: ThreatPattern[]): void {
    this.threatPatterns = [...patterns];
    this.logger.debug('Threat patterns initialized', { count: patterns.length });
  }

  /**
   * Initialize threat counters
   */
  private initializeThreatCounters(): void {
    this.threatCounters.clear();
    for (const severity of Object.values(ThreatSeverity)) {
      this.threatCounters.set(severity, 0);
    }
  }

  /**
   * Get rules for a specific scope
   */
  private getRulesForScope(scope: SanitizationScope): SanitizationRule[] {
    return this.rules.get(scope) || [];
  }

  /**
   * Detect threats in input
   */
  private detectThreats(
    input: any, 
    patterns: ThreatPattern[], 
    location: string
  ): DetectedThreat[] {
    const threats: DetectedThreat[] = [];
    const inputString = typeof input === 'string' ? input : JSON.stringify(input);

    // Check rule-specific patterns
    for (const pattern of patterns) {
      const matches = this.findMatches(inputString, pattern.pattern);
      if (matches.length > 0) {
        threats.push({
          pattern,
          matches,
          severity: pattern.severity,
          location
        });
      }
    }

    // Check global threat patterns
    for (const pattern of this.threatPatterns) {
      const matches = this.findMatches(inputString, pattern.pattern);
      if (matches.length > 0) {
        threats.push({
          pattern,
          matches,
          severity: pattern.severity,
          location
        });
      }
    }

    return threats;
  }

  /**
   * Find pattern matches in input
   */
  private findMatches(input: string, pattern: string | RegExp): string[] {
    if (typeof pattern === 'string') {
      return input.includes(pattern) ? [pattern] : [];
    } else {
      const matches = input.match(pattern);
      return matches ? Array.from(new Set(matches)) : [];
    }
  }

  /**
   * Apply a sanitization processor
   */
  private async applyProcessor(
    input: any,
    processor: SanitizationProcessor,
    scope: SanitizationScope,
    context?: Record<string, any>
  ): Promise<any> {
    switch (processor.type) {
      case 'dompurify':
        return this.applyDOMPurify(input, processor.config.domPurify);
        
      case 'schema-validation':
        if (processor.config.schema) {
          const isValid = await this.validateMessage(input, processor.config.schema.type);
          if (!isValid) {
            throw new Error('Schema validation failed');
          }
        }
        return input;
        
      case 'regex-replace':
        return this.applyRegexReplace(input, processor.config.regexReplace);
        
      case 'encoding':
        return this.applyEncoding(input, processor.config.encoding);
        
      case 'custom':
        return this.applyCustomProcessor(input, processor.config.custom, context);
        
      default:
        this.logger.warn('Unknown processor type', { type: processor.type });
        return input;
    }
  }

  /**
   * Apply DOMPurify sanitization (placeholder - would need actual DOMPurify integration)
   */
  private applyDOMPurify(input: any, config?: ProcessorConfig['domPurify']): any {
    if (typeof input !== 'string') return input;

    // This is a placeholder implementation
    // In a real implementation, you would integrate with DOMPurify library
    let sanitized = input;

    // Remove script tags
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Remove javascript: protocols
    sanitized = sanitized.replace(/javascript:/gi, '');
    
    // Remove event handlers
    sanitized = sanitized.replace(/on\w+\s*=/gi, '');

    this.logger.debug('DOMPurify applied (placeholder)', {
      originalLength: input.length,
      sanitizedLength: sanitized.length
    });

    return sanitized;
  }

  /**
   * Apply regex replacement
   */
  private applyRegexReplace(input: any, config?: ProcessorConfig['regexReplace']): any {
    if (!config || typeof input !== 'string') return input;

    let result = input;
    for (const { pattern, replacement, flags } of config.patterns) {
      const regex = typeof pattern === 'string' ? new RegExp(pattern, flags) : pattern;
      result = result.replace(regex, replacement);
    }
    return result;
  }

  /**
   * Apply encoding/decoding
   */
  private applyEncoding(input: any, config?: ProcessorConfig['encoding']): any {
    if (!config || typeof input !== 'string') return input;

    switch (config.type) {
      case 'html':
        return config.decode ? this.htmlDecode(input) : this.htmlEncode(input);
      case 'url':
        return config.decode ? decodeURIComponent(input) : encodeURIComponent(input);
      case 'base64':
        return config.decode ? 
          Buffer.from(input, 'base64').toString('utf8') : 
          Buffer.from(input, 'utf8').toString('base64');
      default:
        return input;
    }
  }

  /**
   * HTML encode
   */
  private htmlEncode(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /**
   * HTML decode
   */
  private htmlDecode(input: string): string {
    return input
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'");
  }

  /**
   * Apply custom processor (placeholder)
   */
  private async applyCustomProcessor(
    input: any, 
    config?: ProcessorConfig['custom'], 
    context?: Record<string, any>
  ): Promise<any> {
    if (!config) return input;

    this.logger.warn('Custom processor not implemented', { 
      functionName: config.functionName,
      parameters: Object.keys(config.parameters || {})
    });
    
    return input;
  }

  /**
   * Update threat counters for alerting
   */
  private updateThreatCounters(severity: ThreatSeverity): void {
    const current = this.threatCounters.get(severity) || 0;
    this.threatCounters.set(severity, current + 1);

    // Check if we should trigger alerts
    const threshold = this.config.threatDetection.alertThresholds[severity];
    if (current + 1 >= threshold) {
      this.logger.warn('Threat alert threshold reached', {
        severity,
        count: current + 1,
        threshold
      });
    }
  }

  /**
   * Log sanitization event
   */
  private async logSanitizationEvent(
    scope: SanitizationScope,
    result: SanitizationResult,
    processingTime: number
  ): Promise<void> {
    const logLevel = result.threats.length > 0 ? 'warn' : 'debug';
    
    this.logger[logLevel]('Sanitization completed', {
      scope,
      threatsDetected: result.threats.length,
      processorsApplied: result.applied.length,
      blocked: result.blocked,
      processingTime
    });

    if (result.threats.length > 0) {
      const maxSeverity = this.getMaxThreatSeverity(result.threats);
      
      await this.errorHandler.handleError(new VesperaThreatError(
        `Threats detected during sanitization`,
        result.threats[0]?.pattern.type || 'unknown',
        result.threats.flatMap(t => t.matches),
        result.blocked,
        this.mapThreatSeverityToVesperaSeverity(maxSeverity),
        {
          scope,
          threatCount: result.threats.length,
          threats: result.threats.map(t => ({
            type: t.pattern.type,
            severity: t.severity,
            matchCount: t.matches.length
          }))
        }
      ));
    }
  }

  /**
   * Get maximum threat severity from detected threats
   */
  private getMaxThreatSeverity(threats: DetectedThreat[]): ThreatSeverity {
    const severityOrder = [ThreatSeverity.LOW, ThreatSeverity.MEDIUM, ThreatSeverity.HIGH, ThreatSeverity.CRITICAL];
    let maxSeverity = ThreatSeverity.LOW;
    
    for (const threat of threats) {
      if (severityOrder.indexOf(threat.severity) > severityOrder.indexOf(maxSeverity)) {
        maxSeverity = threat.severity;
      }
    }
    
    return maxSeverity;
  }

  /**
   * Map threat severity to Vespera severity
   */
  private mapThreatSeverityToVesperaSeverity(threatSeverity: ThreatSeverity): VesperaSeverity {
    switch (threatSeverity) {
      case ThreatSeverity.CRITICAL: return VesperaSeverity.CRITICAL;
      case ThreatSeverity.HIGH: return VesperaSeverity.HIGH;
      case ThreatSeverity.MEDIUM: return VesperaSeverity.MEDIUM;
      case ThreatSeverity.LOW: return VesperaSeverity.LOW;
      default: return VesperaSeverity.LOW;
    }
  }

  /**
   * Dispose the input sanitizer
   */
  dispose(): void {
    if (this.disposed) return;
    
    this.rules.clear();
    this.threatPatterns.length = 0;
    this.threatCounters.clear();
    
    this.disposed = true;
    this.logger.info('VesperaInputSanitizer disposed', { 
      finalStats: this.getStats() 
    });
  }
}