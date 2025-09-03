/**
 * Token Bucket Rate Limiter
 * 
 * Memory-safe token bucket implementation for rate limiting with burst allowance
 * and integration with VesperaContextManager for resource cleanup.
 */

import * as vscode from 'vscode';
import { VesperaLogger } from '../../logging/VesperaLogger';
import { TokenBucketConfig, TokenBucketState } from '../../../types/security';

/**
 * Token bucket implementation with memory-safe cleanup
 */
export class TokenBucket implements vscode.Disposable {
  private state: TokenBucketState;
  private refillTimer?: NodeJS.Timeout;
  private readonly logger: VesperaLogger;
  private disposed = false;

  constructor(
    private config: TokenBucketConfig,
    logger: VesperaLogger
  ) {
    this.logger = logger.createChild('TokenBucket');
    this.state = {
      tokens: config.initialTokens ?? config.capacity,
      lastRefill: Date.now(),
      totalRequests: 0,
      rejectedRequests: 0,
      burstTokensUsed: 0
    };

    this.startRefillTimer();
    this.logger.debug('TokenBucket initialized', { config, initialState: this.state });
  }

  /**
   * Attempt to consume tokens from the bucket
   * @param tokens Number of tokens to consume (default: 1)
   * @returns true if tokens were consumed, false if insufficient
   */
  consume(tokens: number = 1): boolean {
    if (this.disposed) {
      this.logger.warn('Attempted to consume tokens from disposed bucket');
      return false;
    }

    this.state.totalRequests++;
    
    // Refill tokens if necessary
    this.refill();

    // Check if we have enough tokens (including burst allowance)
    const burstAllowance = this.config.burstAllowance || 0;
    const availableBurstTokens = Math.max(0, burstAllowance - this.state.burstTokensUsed);
    const totalAvailableTokens = this.state.tokens + availableBurstTokens;

    if (totalAvailableTokens >= tokens) {
      // Consume from main bucket first, then from burst allowance
      const mainTokensUsed = Math.min(tokens, this.state.tokens);
      const burstTokensUsed = tokens - mainTokensUsed;

      this.state.tokens -= mainTokensUsed;
      this.state.burstTokensUsed += burstTokensUsed;

      this.logger.debug('Tokens consumed successfully', { 
        requested: tokens, 
        mainUsed: mainTokensUsed,
        burstUsed: burstTokensUsed,
        remaining: this.state.tokens,
        burstRemaining: availableBurstTokens - burstTokensUsed
      });

      return true;
    }

    // Insufficient tokens
    this.state.rejectedRequests++;
    const rejectionRate = this.state.rejectedRequests / this.state.totalRequests;
    
    this.logger.debug('Token consumption rejected', { 
      requested: tokens, 
      available: totalAvailableTokens,
      rejectionRate: rejectionRate.toFixed(3)
    });

    // Log warning if rejection rate is high
    if (rejectionRate > 0.5) {
      this.logger.warn('High rejection rate detected', { 
        rejectionRate: rejectionRate.toFixed(3),
        totalRequests: this.state.totalRequests,
        rejectedRequests: this.state.rejectedRequests
      });
    }

    return false;
  }

  /**
   * Get current bucket statistics
   */
  getStats(): TokenBucketState & { 
    capacity: number; 
    refillRate: number;
    rejectionRate: number;
    burstAvailable: number;
    isHealthy: boolean;
  } {
    const rejectionRate = this.state.totalRequests > 0 
      ? this.state.rejectedRequests / this.state.totalRequests 
      : 0;

    const burstAllowance = this.config.burstAllowance || 0;
    const burstAvailable = Math.max(0, burstAllowance - this.state.burstTokensUsed);

    return {
      ...this.state,
      capacity: this.config.capacity,
      refillRate: this.config.refillRate,
      rejectionRate,
      burstAvailable,
      isHealthy: rejectionRate < 0.9 && !this.disposed // Consider healthy if < 90% rejection rate
    };
  }

  /**
   * Get time until next token is available
   */
  getTimeToNextToken(): number {
    if (this.disposed) return Infinity;
    
    if (this.state.tokens > 0) return 0;
    
    // Calculate time based on refill rate
    return Math.ceil(1000 / this.config.refillRate);
  }

  /**
   * Manually add tokens (for testing or special cases)
   */
  addTokens(count: number): void {
    if (this.disposed) return;
    
    this.state.tokens = Math.min(
      this.config.capacity, 
      this.state.tokens + count
    );
    
    this.logger.debug('Tokens manually added', { 
      added: count, 
      current: this.state.tokens 
    });
  }

  /**
   * Reset bucket to initial state
   */
  reset(): void {
    if (this.disposed) return;
    
    const oldState = { ...this.state };
    this.state = {
      tokens: this.config.initialTokens ?? this.config.capacity,
      lastRefill: Date.now(),
      totalRequests: 0,
      rejectedRequests: 0,
      burstTokensUsed: 0
    };
    
    this.logger.info('TokenBucket reset', { oldState, newState: this.state });
  }

  /**
   * Update bucket configuration (capacity, refill rate, etc.)
   */
  updateConfig(newConfig: Partial<TokenBucketConfig>): void {
    if (this.disposed) return;
    
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    
    // Adjust current tokens if capacity changed
    if (newConfig.capacity !== undefined) {
      this.state.tokens = Math.min(this.state.tokens, newConfig.capacity);
    }
    
    // Restart timer if refill interval changed
    if (newConfig.refillInterval !== undefined) {
      this.stopRefillTimer();
      this.startRefillTimer();
    }
    
    this.logger.info('TokenBucket configuration updated', { oldConfig, newConfig });
  }

  /**
   * Check if bucket is disposed
   */
  get isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Refill tokens based on time elapsed
   */
  private refill(): void {
    const now = Date.now();
    const timeSinceRefill = now - this.state.lastRefill;
    const tokensToAdd = Math.floor((timeSinceRefill / 1000) * this.config.refillRate);

    if (tokensToAdd > 0) {
      const oldTokens = this.state.tokens;
      this.state.tokens = Math.min(
        this.config.capacity, 
        this.state.tokens + tokensToAdd
      );
      
      // Recover burst allowance gradually (10% of refill goes to burst recovery)
      const burstRecovery = Math.floor(tokensToAdd * 0.1);
      this.state.burstTokensUsed = Math.max(0, this.state.burstTokensUsed - burstRecovery);
      
      this.state.lastRefill = now;
      
      this.logger.debug('Tokens refilled', {
        tokensAdded: tokensToAdd,
        oldTokens,
        newTokens: this.state.tokens,
        burstRecovery,
        burstTokensUsed: this.state.burstTokensUsed
      });
    }
  }

  /**
   * Start the automatic refill timer
   */
  private startRefillTimer(): void {
    if (this.disposed || this.refillTimer) return;
    
    this.refillTimer = setInterval(() => {
      if (!this.disposed) {
        this.refill();
      }
    }, this.config.refillInterval);
    
    this.logger.debug('Refill timer started', { interval: this.config.refillInterval });
  }

  /**
   * Stop the automatic refill timer
   */
  private stopRefillTimer(): void {
    if (this.refillTimer) {
      clearInterval(this.refillTimer);
      this.refillTimer = undefined;
      this.logger.debug('Refill timer stopped');
    }
  }

  /**
   * Dispose the token bucket and cleanup resources
   */
  dispose(): void {
    if (this.disposed) return;
    
    this.stopRefillTimer();
    this.disposed = true;
    
    this.logger.info('TokenBucket disposed', { 
      finalStats: this.getStats() 
    });
  }
}