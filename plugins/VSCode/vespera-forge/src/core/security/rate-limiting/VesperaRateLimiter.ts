/**
 * Vespera Rate Limiter Service
 * 
 * Comprehensive rate limiting service with token bucket algorithm, circuit breakers,
 * and integration with VesperaContextManager for memory-safe resource management.
 */

import * as vscode from 'vscode';
import { VesperaLogger } from '../../logging/VesperaLogger';
import { VesperaErrorHandler } from '../../error-handling/VesperaErrorHandler';
import { VesperaContextManager } from '../../memory-management/VesperaContextManager';
import { TokenBucket } from './TokenBucket';
import { CircuitBreaker } from './CircuitBreaker';
import {
  RateLimitingConfiguration,
  RateLimitRule,
  RateLimitContext,
  RateLimitResult,
  RateLimitAction,
  TokenBucketConfig,
  CircuitBreakerConfig,
  VesperaRateLimiterInterface,
  TokenBucketState,
  CircuitBreakerState,
  VesperaSecurityEvent
} from '../../../types/security';
import { 
  VesperaRateLimitError, 
  VesperaCircuitBreakerError, 
  VesperaSecurityError 
} from '../VesperaSecurityErrors';

// Default configurations
export const DEFAULT_TOKEN_BUCKET_CONFIG: TokenBucketConfig = {
  capacity: 100,
  refillRate: 10, // 10 tokens per second
  refillInterval: 1000, // 1 second
  initialTokens: 100,
  burstAllowance: 20
};

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeout: 30000, // 30 seconds
  monitoringPeriod: 10000, // 10 seconds
  halfOpenMaxCalls: 3
};

/**
 * Rate limiter service with token buckets and circuit breakers
 */
export class VesperaRateLimiter implements VesperaRateLimiterInterface {
  private static instance: VesperaRateLimiter;
  
  private buckets = new Map<string, TokenBucket>();
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private rules: RateLimitRule[] = [];
  private disposed = false;
  
  // Statistics tracking
  private stats = {
    totalRequests: 0,
    totalRejections: 0,
    circuitBreakerActivations: 0,
    lastReset: Date.now()
  };

  private constructor(
    private contextManager: VesperaContextManager,
    private logger: VesperaLogger,
    private errorHandler: VesperaErrorHandler,
    private config: RateLimitingConfiguration
  ) {
    this.logger = logger.createChild('RateLimiter');
    this.initializeRules(config.rules);
    this.setupCleanupTimers();
    
    this.logger.info('VesperaRateLimiter initialized', {
      rulesCount: this.rules.length,
      globalDefaults: config.globalDefaults
    });
  }

  /**
   * Initialize the rate limiter service
   */
  public static async initialize(config: {
    contextManager: VesperaContextManager;
    logger: VesperaLogger;
    errorHandler: VesperaErrorHandler;
    rateLimitingConfig: RateLimitingConfiguration;
  }): Promise<VesperaRateLimiter> {
    if (!VesperaRateLimiter.instance) {
      VesperaRateLimiter.instance = new VesperaRateLimiter(
        config.contextManager,
        config.logger,
        config.errorHandler,
        config.rateLimitingConfig
      );
    }
    return VesperaRateLimiter.instance;
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): VesperaRateLimiter {
    if (!VesperaRateLimiter.instance) {
      throw new VesperaSecurityError('VesperaRateLimiter not initialized');
    }
    return VesperaRateLimiter.instance;
  }

  /**
   * Check rate limit for a resource
   */
  async checkRateLimit(context: RateLimitContext): Promise<RateLimitResult> {
    if (this.disposed) {
      throw new VesperaSecurityError('Rate limiter has been disposed');
    }

    this.stats.totalRequests++;

    // Find matching rule
    const rule = this.findMatchingRule(context.resourceId);
    if (!rule || !rule.enabled) {
      return { allowed: true, actions: [] };
    }

    this.logger.debug('Checking rate limit', {
      resourceId: context.resourceId,
      ruleId: rule.id,
      scope: rule.scope
    });

    try {
      // Check circuit breaker first
      const circuitBreaker = this.getOrCreateCircuitBreaker(rule.id);
      if (!circuitBreaker.isRequestAllowed()) {
        const retryAfter = circuitBreaker.getRetryAfter();
        
        this.logger.warn('Request blocked by circuit breaker', {
          ruleId: rule.id,
          resourceId: context.resourceId,
          retryAfter,
          circuitState: circuitBreaker.getState()
        });

        this.stats.totalRejections++;
        
        return {
          allowed: false,
          rule,
          retryAfter,
          actions: [{ type: 'circuit-break', threshold: 0 }]
        };
      }

      // Get or create token bucket
      const bucketKey = this.generateBucketKey(rule, context);
      const bucket = this.getOrCreateBucket(bucketKey, rule.bucket);

      // Attempt to consume token
      const allowed = bucket.consume(1);
      const bucketStats = bucket.getStats();

      if (!allowed) {
        // Handle rate limit exceeded
        await this.handleRateLimitExceeded(rule, context, bucketStats);
        circuitBreaker.recordFailure();
        
        const retryAfter = this.calculateRetryAfter(rule.bucket);
        this.stats.totalRejections++;
        
        return {
          allowed: false,
          rule,
          remainingTokens: bucketStats.tokens,
          retryAfter,
          actions: this.determineActions(rule, bucketStats)
        };
      }

      // Success - record it
      circuitBreaker.recordSuccess();
      
      return {
        allowed: true,
        rule,
        remainingTokens: bucketStats.tokens,
        actions: []
      };

    } catch (error) {
      this.logger.error('Rate limit check failed', error, { context, rule: rule.id });
      
      await this.errorHandler.handleError(new VesperaSecurityError(
        'Rate limit check failed',
        undefined,
        undefined,
        { context, rule: rule.id, error: error.message }
      ));

      // Fail open - allow request but log the error
      return { allowed: true, actions: [] };
    }
  }

  /**
   * Add a new rate limiting rule
   */
  addRule(rule: RateLimitRule): void {
    if (this.disposed) return;
    
    // Remove existing rule with same ID
    this.rules = this.rules.filter(r => r.id !== rule.id);
    
    // Add new rule and sort by priority
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
    
    this.logger.info('Rate limit rule added', { ruleId: rule.id, priority: rule.priority });
  }

  /**
   * Remove a rate limiting rule
   */
  removeRule(ruleId: string): void {
    if (this.disposed) return;
    
    const originalCount = this.rules.length;
    this.rules = this.rules.filter(r => r.id !== ruleId);
    
    if (this.rules.length < originalCount) {
      this.logger.info('Rate limit rule removed', { ruleId });
      
      // Clean up associated resources
      this.cleanupRuleResources(ruleId);
    }
  }

  /**
   * Update an existing rate limiting rule
   */
  updateRule(rule: RateLimitRule): void {
    if (this.disposed) return;
    
    const index = this.rules.findIndex(r => r.id === rule.id);
    if (index >= 0) {
      this.rules[index] = rule;
      this.rules.sort((a, b) => b.priority - a.priority);
      
      this.logger.info('Rate limit rule updated', { ruleId: rule.id });
    } else {
      this.addRule(rule);
    }
  }

  /**
   * Get comprehensive statistics
   */
  getStats(): {
    totalBuckets: number;
    totalRequests: number;
    totalRejections: number;
    bucketStats: Array<{ key: string; stats: TokenBucketState & { 
      capacity: number; 
      refillRate: number;
      rejectionRate: number;
    } }>;
    circuitBreakerStats: Array<{ key: string; stats: any }>;
    globalStats: typeof this.stats;
  } {
    let totalBucketRequests = 0;
    let totalBucketRejections = 0;
    const bucketStats: Array<{ key: string; stats: TokenBucketState & { 
      capacity: number; 
      refillRate: number;
      rejectionRate: number;
    } }> = [];

    // Collect bucket statistics
    for (const [key, bucket] of this.buckets.entries()) {
      const stats = bucket.getStats();
      totalBucketRequests += stats.totalRequests;
      totalBucketRejections += stats.rejectedRequests;
      bucketStats.push({ key, stats });
    }

    // Collect circuit breaker statistics
    const circuitBreakerStats: Array<{ key: string; stats: any }> = [];
    for (const [key, breaker] of this.circuitBreakers.entries()) {
      circuitBreakerStats.push({ key, stats: breaker.getStats() });
    }

    return {
      totalBuckets: this.buckets.size,
      totalRequests: this.stats.totalRequests,
      totalRejections: this.stats.totalRejections,
      bucketStats,
      circuitBreakerStats,
      globalStats: { ...this.stats }
    };
  }

  /**
   * Reset all statistics and buckets
   */
  reset(): void {
    if (this.disposed) return;
    
    // Reset statistics
    this.stats = {
      totalRequests: 0,
      totalRejections: 0,
      circuitBreakerActivations: 0,
      lastReset: Date.now()
    };

    // Reset all buckets
    for (const bucket of this.buckets.values()) {
      bucket.reset();
    }

    // Reset all circuit breakers
    for (const breaker of this.circuitBreakers.values()) {
      breaker.reset();
    }

    this.logger.info('VesperaRateLimiter reset completed');
  }

  /**
   * Get health status of the rate limiter
   */
  getHealth(): {
    healthy: boolean;
    issues: string[];
    bucketsCount: number;
    circuitBreakersCount: number;
    unhealthyBuckets: number;
    openCircuitBreakers: number;
  } {
    const issues: string[] = [];
    let unhealthyBuckets = 0;
    let openCircuitBreakers = 0;

    // Check buckets health
    for (const [key, bucket] of this.buckets.entries()) {
      const stats = bucket.getStats();
      if (!stats.isHealthy) {
        unhealthyBuckets++;
        issues.push(`Bucket ${key} is unhealthy (rejection rate: ${(stats.rejectionRate * 100).toFixed(1)}%)`);
      }
    }

    // Check circuit breakers health
    for (const [key, breaker] of this.circuitBreakers.entries()) {
      if (breaker.getState() === CircuitBreakerState.OPEN) {
        openCircuitBreakers++;
        issues.push(`Circuit breaker ${key} is open`);
      }
    }

    const healthy = !this.disposed && issues.length === 0;

    return {
      healthy,
      issues,
      bucketsCount: this.buckets.size,
      circuitBreakersCount: this.circuitBreakers.size,
      unhealthyBuckets,
      openCircuitBreakers
    };
  }

  /**
   * Find the best matching rule for a resource
   */
  private findMatchingRule(resourceId: string): RateLimitRule | undefined {
    return this.rules.find(rule => {
      if (typeof rule.pattern === 'string') {
        return resourceId.includes(rule.pattern);
      } else {
        return rule.pattern.test(resourceId);
      }
    });
  }

  /**
   * Generate a unique key for bucket storage
   */
  private generateBucketKey(rule: RateLimitRule, context: RateLimitContext): string {
    switch (rule.scope) {
      case 'global':
        return `global:${rule.id}`;
      case 'user':
        return `user:${context.userId || 'anonymous'}:${rule.id}`;
      case 'session':
        return `session:${context.sessionId || 'default'}:${rule.id}`;
      case 'resource':
        return `resource:${context.resourceId}:${rule.id}`;
      default:
        return `default:${rule.id}`;
    }
  }

  /**
   * Get or create a token bucket
   */
  private getOrCreateBucket(key: string, config: TokenBucketConfig): TokenBucket {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = new TokenBucket(config, this.logger);
      this.buckets.set(key, bucket);
      
      // Register with context manager for cleanup
      this.contextManager.registerResource(
        bucket,
        'TokenBucket',
        `rate-limit-bucket-${key}`
      );

      this.logger.debug('Token bucket created', { key, config });
    }
    return bucket;
  }

  /**
   * Get or create a circuit breaker
   */
  private getOrCreateCircuitBreaker(ruleId: string): CircuitBreaker {
    let breaker = this.circuitBreakers.get(ruleId);
    if (!breaker) {
      const config = this.config.circuitBreaker || DEFAULT_CIRCUIT_BREAKER_CONFIG;
      breaker = new CircuitBreaker(config, this.logger, ruleId);
      this.circuitBreakers.set(ruleId, breaker);
      
      // Register with context manager for cleanup
      this.contextManager.registerResource(
        breaker,
        'CircuitBreaker',
        `rate-limit-breaker-${ruleId}`
      );

      // Listen for state changes
      breaker.onStateChange((newState, oldState) => {
        if (newState === CircuitBreakerState.OPEN && oldState !== CircuitBreakerState.OPEN) {
          this.stats.circuitBreakerActivations++;
          this.logger.warn('Circuit breaker opened', { ruleId, newState, oldState });
        }
      });

      this.logger.debug('Circuit breaker created', { ruleId, config });
    }
    return breaker;
  }

  /**
   * Calculate retry after time
   */
  private calculateRetryAfter(config: TokenBucketConfig): number {
    return Math.ceil(1000 / config.refillRate); // Time to get one token in ms
  }

  /**
   * Determine actions based on rule and bucket state
   */
  private determineActions(rule: RateLimitRule, stats: TokenBucketState): RateLimitAction[] {
    const rejectionRate = stats.totalRequests > 0 
      ? stats.rejectedRequests / stats.totalRequests 
      : 0;
    
    return rule.actions.filter(action => {
      return rejectionRate >= (action.threshold / 100);
    });
  }

  /**
   * Handle rate limit exceeded event
   */
  private async handleRateLimitExceeded(
    rule: RateLimitRule, 
    context: RateLimitContext, 
    stats: TokenBucketState
  ): Promise<void> {
    const rejectionRate = stats.totalRequests > 0 
      ? stats.rejectedRequests / stats.totalRequests 
      : 0;

    this.logger.warn('Rate limit exceeded', {
      rule: rule.id,
      resource: context.resourceId,
      userId: context.userId,
      rejectionRate: rejectionRate.toFixed(3),
      remainingTokens: stats.tokens,
      totalRequests: stats.totalRequests
    });

    // Create and handle rate limit error
    const error = new VesperaRateLimitError(
      `Rate limit exceeded for ${context.resourceId}`,
      this.calculateRetryAfter(rule.bucket),
      stats.tokens,
      { 
        context, 
        rule: rule.id, 
        rejectionRate,
        bucketStats: stats
      }
    );

    await this.errorHandler.handleError(error);
  }

  /**
   * Initialize rules from configuration
   */
  private initializeRules(rules: RateLimitRule[]): void {
    this.rules = [...rules].sort((a, b) => b.priority - a.priority);
    this.logger.info('Rate limiting rules initialized', { 
      count: this.rules.length,
      ruleIds: this.rules.map(r => r.id)
    });
  }

  /**
   * Clean up resources for a specific rule
   */
  private cleanupRuleResources(ruleId: string): void {
    // Clean up circuit breaker
    const breaker = this.circuitBreakers.get(ruleId);
    if (breaker) {
      breaker.dispose();
      this.circuitBreakers.delete(ruleId);
    }

    // Clean up buckets that use this rule
    const bucketsToRemove: string[] = [];
    for (const [key, bucket] of this.buckets.entries()) {
      if (key.includes(ruleId)) {
        bucket.dispose();
        bucketsToRemove.push(key);
      }
    }
    
    for (const key of bucketsToRemove) {
      this.buckets.delete(key);
    }

    this.logger.debug('Rule resources cleaned up', { 
      ruleId, 
      bucketsRemoved: bucketsToRemove.length 
    });
  }

  /**
   * Setup cleanup timers for expired buckets and circuit breakers
   */
  private setupCleanupTimers(): void {
    // Run cleanup every 5 minutes
    const cleanupInterval = setInterval(() => {
      if (!this.disposed) {
        this.performCleanup();
      }
    }, 5 * 60 * 1000);

    // Register cleanup timer for disposal
    this.contextManager.registerResource(
      {
        dispose: () => clearInterval(cleanupInterval),
        isDisposed: false
      },
      'CleanupTimer',
      'rate-limiter-cleanup-timer'
    );
  }

  /**
   * Clean up unused buckets and circuit breakers
   */
  private performCleanup(): void {
    const now = Date.now();
    const CLEANUP_THRESHOLD = 10 * 60 * 1000; // 10 minutes
    
    let bucketsRemoved = 0;
    const bucketsToRemove: string[] = [];

    // Find buckets that haven't been used recently
    for (const [key, bucket] of this.buckets.entries()) {
      const stats = bucket.getStats();
      const lastActivity = Math.max(stats.lastRefill, now - 60000); // Assume recent if no specific last activity
      
      if (now - lastActivity > CLEANUP_THRESHOLD && stats.totalRequests === 0) {
        bucket.dispose();
        bucketsToRemove.push(key);
        bucketsRemoved++;
      }
    }

    for (const key of bucketsToRemove) {
      this.buckets.delete(key);
    }

    if (bucketsRemoved > 0) {
      this.logger.info('Cleanup completed', { 
        bucketsRemoved,
        remainingBuckets: this.buckets.size,
        circuitBreakers: this.circuitBreakers.size
      });
    }
  }

  /**
   * Dispose the rate limiter and cleanup all resources
   */
  dispose(): void {
    if (this.disposed) return;
    
    this.logger.info('Disposing VesperaRateLimiter');
    
    // Dispose all buckets
    for (const bucket of this.buckets.values()) {
      bucket.dispose();
    }
    this.buckets.clear();
    
    // Dispose all circuit breakers
    for (const breaker of this.circuitBreakers.values()) {
      breaker.dispose();
    }
    this.circuitBreakers.clear();
    
    this.disposed = true;
    this.logger.info('VesperaRateLimiter disposed');
  }
}