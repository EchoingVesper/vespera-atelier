/**
 * Vespera Security Manager
 * 
 * Central orchestration point for all security services including rate limiting,
 * consent management, input sanitization, and security audit logging.
 */

import * as vscode from 'vscode';
import { VesperaLogger } from '../logging/VesperaLogger';
import { VesperaErrorHandler } from '../error-handling/VesperaErrorHandler';
import { VesperaContextManager } from '../memory-management/VesperaContextManager';
import { 
  SecurityConfiguration,
  VesperaRateLimiterInterface,
  VesperaConsentManagerInterface,
  VesperaInputSanitizerInterface,
  SecurityAuditLoggerInterface,
  SecurityMetrics,
  VesperaSecurityEvent,
  SecurityEventContext,
  VesperaSecurityErrorCode
} from '../../types/security';
import { VesperaSecurityError } from './VesperaSecurityErrors';

export interface SecurityEnhancedCoreServices {
  logger: VesperaLogger;
  errorHandler: VesperaErrorHandler;
  contextManager: VesperaContextManager;
  rateLimiter: VesperaRateLimiterInterface;
  consentManager: VesperaConsentManagerInterface;
  inputSanitizer: VesperaInputSanitizerInterface;
  securityAuditLogger: SecurityAuditLoggerInterface;
}

/**
 * Event bus for security-related events
 */
export class SecurityEventBus extends vscode.EventEmitter<{
  'securityEvent': [VesperaSecurityEvent, SecurityEventContext];
  'rateLimitExceeded': [string, any];
  'consentChanged': [string, string[], boolean];
  'threatDetected': [string, any];
  'cspViolation': [string, any];
}> implements vscode.Disposable {
  
  constructor(private logger: VesperaLogger) {
    super();
    this.logger = logger.createChild('SecurityEventBus');
  }

  /**
   * Emit a security event to all listeners
   */
  emitSecurityEvent(event: VesperaSecurityEvent, context: SecurityEventContext): void {
    this.logger.debug('Emitting security event', { event, context });
    (this as any).fire('securityEvent', event, context);
  }
  
  /**
   * Add listener for security events
   */
  onSecurityEvent(listener: (event: VesperaSecurityEvent, context: SecurityEventContext) => void): vscode.Disposable {
    return (this as any).event('securityEvent', listener);
  }
  
  /**
   * Add listener for rate limit events
   */
  onRateLimitExceeded(listener: (resourceId: string, context: any) => void): vscode.Disposable {
    return (this as any).event('rateLimitExceeded', listener);
  }
  
  /**
   * Add listener for consent changes
   */
  onConsentChanged(listener: (userId: string, purposeIds: string[], granted: boolean) => void): vscode.Disposable {
    return (this as any).event('consentChanged', listener);
  }
  
  /**
   * Add listener for threat detection
   */
  onThreatDetected(listener: (threatType: string, context: any) => void): vscode.Disposable {
    return (this as any).event('threatDetected', listener);
  }

  override dispose(): void {
    this.logger.debug('SecurityEventBus disposed');
    super.dispose();
  }
}

/**
 * Main security manager coordinating all security services
 */
export class VesperaSecurityManager implements vscode.Disposable {
  private static instance: VesperaSecurityManager;
  
  private eventBus: SecurityEventBus;
  private initialized = false;
  private _isDisposed = false;
  private readonly securityServices: Map<string, vscode.Disposable> = new Map();
  
  /**
   * Check if manager is disposed
   */
  public get isDisposed(): boolean {
    return this._isDisposed;
  }

  private constructor(
    private logger: VesperaLogger,
    _errorHandler: VesperaErrorHandler,
    private contextManager: VesperaContextManager,
    private config: SecurityConfiguration
  ) {
    this.logger = logger.createChild('SecurityManager');
    this.eventBus = new SecurityEventBus(logger);
    
    // Register event bus with context manager for cleanup
    this.contextManager.registerResource(
      this.eventBus,
      'SecurityEventBus',
      'security-event-bus'
    );
  }

  /**
   * Initialize the security manager and all security services
   */
  public static async initialize(
    logger: VesperaLogger,
    errorHandler: VesperaErrorHandler,
    contextManager: VesperaContextManager,
    config: SecurityConfiguration
  ): Promise<VesperaSecurityManager> {
    if (!VesperaSecurityManager.instance) {
      VesperaSecurityManager.instance = new VesperaSecurityManager(
        logger,
        errorHandler,
        contextManager,
        config
      );
      
      await VesperaSecurityManager.instance.initializeServices();
    }
    
    return VesperaSecurityManager.instance;
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): VesperaSecurityManager {
    if (!VesperaSecurityManager.instance) {
      throw new VesperaSecurityError('SecurityManager not initialized', VesperaSecurityErrorCode.UNAUTHORIZED_ACCESS);
    }
    return VesperaSecurityManager.instance;
  }

  /**
   * Get the security event bus for cross-component communication
   */
  public getEventBus(): SecurityEventBus {
    return this.eventBus;
  }

  /**
   * Check if security manager is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Register a security service with the manager
   */
  public registerService(name: string, service: vscode.Disposable): void {
    if (this.securityServices.has(name)) {
      this.logger.warn('Security service already registered, replacing', { name });
      const existingService = this.securityServices.get(name);
      existingService?.dispose();
    }
    
    this.securityServices.set(name, service);
    this.contextManager.registerResource(service, name, `security-${name.toLowerCase()}`);
    this.logger.info('Security service registered', { name });
  }

  /**
   * Get a registered security service
   */
  public getService<T extends vscode.Disposable>(name: string): T | undefined {
    return this.securityServices.get(name) as T;
  }

  /**
   * Get comprehensive security metrics from all services
   */
  public async getSecurityMetrics(): Promise<SecurityMetrics> {
    const rateLimiter = this.getService<VesperaRateLimiterInterface>('rateLimiter');
    const consentManager = this.getService<VesperaConsentManagerInterface>('consentManager');
    const auditLogger = this.getService<SecurityAuditLoggerInterface>('securityAuditLogger');

    const defaultMetrics: SecurityMetrics = {
      rateLimiting: {
        requestsBlocked: 0,
        circuitBreakerActivations: 0,
        averageTokenConsumption: 0,
      },
      consent: {
        activeConsents: 0,
        withdrawalEvents: 0,
        complianceScore: 0,
      },
      sanitization: {
        threatsBlocked: 0,
        cspViolations: 0,
        sanitizationEvents: 0,
      },
    };

    try {
      // Get metrics from rate limiter
      if (rateLimiter) {
        const rateLimitStats = rateLimiter.getStats();
        defaultMetrics.rateLimiting.requestsBlocked = rateLimitStats.totalRejections;
        defaultMetrics.rateLimiting.averageTokenConsumption = rateLimitStats.totalRequests > 0
          ? (rateLimitStats.totalRequests - rateLimitStats.totalRejections) / rateLimitStats.totalRequests
          : 0;
      }

      // Get metrics from consent manager  
      if (consentManager) {
        // Note: Implementation would depend on the specific consent manager interface
        // For now, we'll use placeholder values
        defaultMetrics.consent.activeConsents = 0;
        defaultMetrics.consent.complianceScore = 1.0;
      }

      // Get metrics from audit logger
      if (auditLogger) {
        const auditMetrics = await auditLogger.getSecurityMetrics();
        defaultMetrics.sanitization = auditMetrics.sanitization;
      }

    } catch (error) {
      this.logger.error('Failed to collect security metrics', error);
    }

    return defaultMetrics;
  }

  /**
   * Perform comprehensive security health check
   */
  public async performHealthCheck(): Promise<{
    healthy: boolean;
    services: Record<string, { healthy: boolean; error?: string }>;
    metrics: SecurityMetrics;
  }> {
    const serviceChecks: Record<string, { healthy: boolean; error?: string }> = {};
    
    // Check each registered service
    for (const [name, service] of this.securityServices) {
      try {
        // Basic health check - ensure service exists and isn't disposed
        serviceChecks[name] = { healthy: !!service };
      } catch (error) {
        serviceChecks[name] = { 
          healthy: false, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    }

    // Check event bus
    try {
      serviceChecks['eventBus'] = { healthy: !!this.eventBus };
    } catch (error) {
      serviceChecks['eventBus'] = { 
        healthy: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }

    const allHealthy = Object.values(serviceChecks).every(check => check.healthy);
    const metrics = await this.getSecurityMetrics();

    this.logger.info('Security health check completed', { 
      healthy: allHealthy, 
      servicesChecked: Object.keys(serviceChecks).length 
    });

    return {
      healthy: allHealthy,
      services: serviceChecks,
      metrics
    };
  }

  /**
   * Enable or disable security features at runtime
   */
  public async setSecurityEnabled(enabled: boolean): Promise<void> {
    this.config.enabled = enabled;
    
    if (enabled) {
      this.logger.info('Security features enabled');
      this.eventBus.emitSecurityEvent(VesperaSecurityEvent.SECURITY_BREACH, {
        timestamp: Date.now(),
        metadata: { action: 'security_enabled' }
      });
    } else {
      this.logger.warn('Security features disabled');
      this.eventBus.emitSecurityEvent(VesperaSecurityEvent.SECURITY_BREACH, {
        timestamp: Date.now(),
        metadata: { action: 'security_disabled' }
      });
    }
  }

  /**
   * Initialize all security services based on configuration
   */
  private async initializeServices(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.logger.info('Initializing security services', { 
      enabled: this.config.enabled,
      rateLimitingEnabled: this.config.rateLimiting?.enabled,
      consentEnabled: this.config.consent?.enabled,
      sanitizationEnabled: this.config.sanitization?.enabled,
      auditEnabled: this.config.audit?.enabled
    });

    try {
      // Services will be initialized by specialized implementation agents
      // This scaffolding provides the integration points
      
      if (!this.config.enabled) {
        this.logger.warn('Security is disabled in configuration');
        this.initialized = true;
        return;
      }

      // Initialize rate limiting service if enabled
      if (this.config.rateLimiting?.enabled) {
        this.logger.debug('Rate limiting service will be initialized by specialized agent');
      }

      // Initialize consent management service if enabled
      if (this.config.consent?.enabled) {
        this.logger.debug('Consent management service will be initialized by specialized agent');
      }

      // Initialize input sanitization service if enabled
      if (this.config.sanitization?.enabled) {
        this.logger.debug('Input sanitization service will be initialized by specialized agent');
      }

      // Initialize audit logging service if enabled
      if (this.config.audit?.enabled) {
        this.logger.debug('Security audit logger will be initialized by specialized agent');
      }

      this.initialized = true;
      this.logger.info('Security services initialization completed');

    } catch (error) {
      this.logger.error('Failed to initialize security services', error);
      throw new VesperaSecurityError('Security services initialization failed', VesperaSecurityErrorCode.UNAUTHORIZED_ACCESS, undefined, {
        originalError: error
      });
    }
  }

  /**
   * Gracefully shutdown all security services
   */
  public async dispose(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.logger.info('Shutting down security manager');

    try {
      // Dispose all registered services
      for (const [name, service] of this.securityServices) {
        try {
          await service.dispose();
          this.logger.debug('Security service disposed', { name });
        } catch (error) {
          this.logger.error('Error disposing security service', error, { name });
        }
      }
      this.securityServices.clear();

      // Dispose event bus
      this.eventBus.dispose();

      this.initialized = false;
      this._isDisposed = true;
      this.logger.info('Security manager shutdown completed');

    } catch (error) {
      this.logger.error('Error during security manager shutdown', error);
      this._isDisposed = true;
      throw error;
    }
  }
}