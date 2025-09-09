/**
 * Security Enhanced Core Services
 * 
 * Extends the existing VesperaCoreServices to include comprehensive security
 * services while maintaining backward compatibility and seamless integration.
 */

import * as vscode from 'vscode';
import { 
  VesperaCoreServices, 
  VesperaCoreServicesConfig,
  VesperaCoreStats
} from '../index';
import { VesperaLogger } from '../logging/VesperaLogger';
import { VesperaErrorHandler } from '../error-handling/VesperaErrorHandler';
import { VesperaContextManager } from '../memory-management/VesperaContextManager';
import { VesperaTelemetryService } from '../telemetry/VesperaTelemetryService';
import { DisposalManager, EnhancedDisposable } from '../disposal/DisposalManager';

// Security services
import { VesperaSecurityManager, SecurityEnhancedCoreServices } from './VesperaSecurityManager';
import { VesperaRateLimiter } from './rate-limiting/VesperaRateLimiter';
import { VesperaConsentManager } from './consent/VesperaConsentManager';
import { VesperaInputSanitizer } from './sanitization/VesperaInputSanitizer';
import { VesperaSecurityAuditLogger } from './audit/VesperaSecurityAuditLogger';

// Types
import {
  SecurityConfiguration,
  SecurityMetrics,
  VesperaSecurityEvent,
  SecurityEventContext,
  VesperaSecurityErrorCode
} from '../../types/security';
import { VesperaSecurityError } from './VesperaSecurityErrors';

export interface SecurityEnhancedCoreServicesConfig extends VesperaCoreServicesConfig {
  security: SecurityConfiguration;
}

export interface SecurityEnhancedCoreStats extends VesperaCoreStats {
  security: {
    enabled: boolean;
    servicesCount: number;
    healthStatus: {
      healthy: boolean;
      services: Record<string, { healthy: boolean; error?: string }>;
    };
    metrics: SecurityMetrics;
    eventsLast24h: number;
    unacknowledgedAlerts: number;
  };
}

/**
 * Enhanced core services with integrated security infrastructure
 */
export class SecurityEnhancedVesperaCoreServices implements vscode.Disposable {
  private static instance: SecurityEnhancedVesperaCoreServices;
  
  // Base services
  public readonly logger: VesperaLogger;
  public readonly errorHandler: VesperaErrorHandler;
  public readonly contextManager: VesperaContextManager;
  public readonly telemetryService: VesperaTelemetryService;
  public readonly disposalManager: DisposalManager;
  
  // Security services
  public readonly securityManager: VesperaSecurityManager;
  public readonly rateLimiter: VesperaRateLimiter;
  public readonly consentManager: VesperaConsentManager;
  public readonly inputSanitizer: VesperaInputSanitizer;
  public readonly securityAuditLogger: VesperaSecurityAuditLogger;
  
  private baseCoreServices: VesperaCoreServices;
  private baseCoreServicesInstance: any; // Actual class instance for methods like getStats/healthCheck
  private initialized = false;
  private initializeTime = 0;

  private constructor(
    baseServices: VesperaCoreServices,
    private context: vscode.ExtensionContext,
    private config: SecurityEnhancedCoreServicesConfig
  ) {
    // Store base services - we need to keep a reference to the class instance for proper disposal
    this.baseCoreServices = baseServices as any; // Type assertion needed due to interface/class mismatch
    this.logger = baseServices.logger.createChild('SecurityEnhanced');
    this.errorHandler = baseServices.errorHandler;
    this.contextManager = baseServices.contextManager;
    this.telemetryService = baseServices.telemetryService;
    this.disposalManager = baseServices.disposalManager;

    // Security services will be initialized in initializeSecurityServices
    this.securityManager = null as any;
    this.rateLimiter = null as any;
    this.consentManager = null as any;
    this.inputSanitizer = null as any;
    this.securityAuditLogger = null as any;
  }

  /**
   * Initialize security-enhanced core services
   */
  public static async initialize(
    context: vscode.ExtensionContext,
    config: SecurityEnhancedCoreServicesConfig
  ): Promise<SecurityEnhancedCoreServices> {
    if (SecurityEnhancedVesperaCoreServices.instance) {
      return SecurityEnhancedVesperaCoreServices.instance;
    }

    // First initialize base core services
    const baseServices = await VesperaCoreServices.initialize(context, config);
    
    // Create enhanced instance
    const enhancedServices = new SecurityEnhancedVesperaCoreServices(
      baseServices as unknown as VesperaCoreServices,
      context,
      config
    );
    
    // Store reference to actual class instance for method access
    enhancedServices.baseCoreServicesInstance = VesperaCoreServices['instance'];
    
    // Initialize security services
    await enhancedServices.initializeSecurityServices();
    
    SecurityEnhancedVesperaCoreServices.instance = enhancedServices;
    return enhancedServices;
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): SecurityEnhancedVesperaCoreServices {
    if (!SecurityEnhancedVesperaCoreServices.instance?.initialized) {
      throw new VesperaSecurityError('SecurityEnhancedCoreServices not initialized', VesperaSecurityErrorCode.UNAUTHORIZED_ACCESS);
    }
    return SecurityEnhancedVesperaCoreServices.instance;
  }

  /**
   * Check if services are initialized
   */
  public static isInitialized(): boolean {
    return SecurityEnhancedVesperaCoreServices.instance?.initialized === true;
  }

  /**
   * Initialize security services
   */
  private async initializeSecurityServices(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const startTime = Date.now();
    this.logger.info('Initializing security services', {
      securityEnabled: this.config.security.enabled,
      rateLimitingEnabled: this.config.security.rateLimiting?.enabled,
      consentEnabled: this.config.security.consent?.enabled,
      sanitizationEnabled: this.config.security.sanitization?.enabled,
      auditEnabled: this.config.security.audit?.enabled
    });

    try {
      if (!this.config.security.enabled) {
        this.logger.warn('Security services disabled in configuration');
        this.initialized = true;
        return;
      }

      // Initialize security audit logger first (other services may need it)
      (this as any).securityAuditLogger = new VesperaSecurityAuditLogger(
        this.logger,
        this.telemetryService,
        this.config.security.audit
      );

      // Initialize security manager
      (this as any).securityManager = await VesperaSecurityManager.initialize(
        this.logger,
        this.errorHandler,
        this.contextManager,
        this.config.security
      );

      // Initialize rate limiter if enabled
      if (this.config.security.rateLimiting?.enabled) {
        (this as any).rateLimiter = await VesperaRateLimiter.initialize({
          contextManager: this.contextManager,
          logger: this.logger,
          errorHandler: this.errorHandler,
          rateLimitingConfig: this.config.security.rateLimiting
        });
        
        this.securityManager.registerService('rateLimiter', this.rateLimiter);
      }

      // Initialize consent manager if enabled
      if (this.config.security.consent?.enabled) {
        (this as any).consentManager = await VesperaConsentManager.initialize({
          storage: this.context.globalState,
          logger: this.logger,
          purposes: this.config.security.consent.purposes,
          configuration: this.config.security.consent
        });
        
        this.securityManager.registerService('consentManager', this.consentManager);
      }

      // Initialize input sanitizer if enabled
      if (this.config.security.sanitization?.enabled) {
        (this as any).inputSanitizer = await VesperaInputSanitizer.initialize({
          logger: this.logger,
          errorHandler: this.errorHandler,
          rules: this.config.security.sanitization.rules,
          configuration: this.config.security.sanitization
        });
        
        this.securityManager.registerService('inputSanitizer', this.inputSanitizer);
      }

      // Register security audit logger
      this.securityManager.registerService('securityAuditLogger', this.securityAuditLogger);

      // Setup security event listeners
      this.setupSecurityEventHandling();

      // Register all security services with disposal manager
      this.disposalManager.addAll([
        this.securityManager,
        ...(this.rateLimiter ? [this.rateLimiter] : []),
        ...(this.consentManager ? [this.consentManager] : []),
        ...(this.inputSanitizer ? [this.inputSanitizer] : []),
        this.securityAuditLogger
      ]);

      this.initialized = true;
      this.initializeTime = Date.now() - startTime;

      this.logger.info('Security services initialization completed', {
        initializationTime: this.initializeTime,
        servicesInitialized: this.getInitializedServiceNames()
      });

      // Track successful initialization
      this.telemetryService.trackEvent({
        name: 'SecurityEnhancedCoreServices.Initialize.Success',
        measurements: { initializationTime: this.initializeTime },
        properties: {
          rateLimitingEnabled: String(this.config.security.rateLimiting?.enabled),
          consentEnabled: String(this.config.security.consent?.enabled),
          sanitizationEnabled: String(this.config.security.sanitization?.enabled),
          auditEnabled: String(this.config.security.audit?.enabled)
        }
      });

      // Log initial security event
      await this.securityAuditLogger.logSecurityEvent(
        VesperaSecurityEvent.SECURITY_BREACH, // Using as generic security event
        {
          timestamp: Date.now(),
          metadata: { 
            action: 'security_services_initialized',
            servicesCount: this.getInitializedServiceNames().length
          }
        }
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to initialize security services', error);

      // Track initialization failure
      this.telemetryService.trackEvent({
        name: 'SecurityEnhancedCoreServices.Initialize.Error',
        properties: { error: errorMessage }
      });

      throw new VesperaSecurityError(
        `Security services initialization failed: ${errorMessage}`,
        VesperaSecurityErrorCode.UNAUTHORIZED_ACCESS,
        undefined,
        { originalError: error }
      );
    }
  }

  /**
   * Wrap a vscode.Disposable to make it compatible with EnhancedDisposable
   */
  private wrapDisposable(disposable: vscode.Disposable): EnhancedDisposable {
    return {
      dispose: () => disposable.dispose(),
      get isDisposed() { return false; }, // VS Code disposables don't track this
      disposalPriority: 1
    };
  }

  /**
   * Setup security event handling
   */
  private setupSecurityEventHandling(): void {
    const eventBus = this.securityManager.getEventBus();
    
    // Listen for security events and forward to audit logger
    this.disposalManager.add(this.wrapDisposable(
      eventBus.onSecurityEvent(async (event: VesperaSecurityEvent, context: SecurityEventContext) => {
        try {
          await this.securityAuditLogger.logSecurityEvent(event, context);
        } catch (error) {
          this.logger.error('Failed to log security event to audit logger', error);
        }
      })
    ));

    // Listen for rate limit events
    this.disposalManager.add(this.wrapDisposable(
      eventBus.onRateLimitExceeded((resourceId: string, context: any) => {
        this.logger.warn('Rate limit exceeded', { resourceId, context });
      })
    ));

    // Listen for consent changes
    this.disposalManager.add(this.wrapDisposable(
      eventBus.onConsentChanged((userId: string, purposeIds: string[], granted: boolean) => {
        this.logger.info('Consent changed', { userId, purposeIds: purposeIds.length, granted });
      })
    ));

    // Listen for threat detection
    this.disposalManager.add(this.wrapDisposable(
      eventBus.onThreatDetected((threatType: string, context: any) => {
        this.logger.warn('Threat detected', { threatType, context });
      })
    ));

    this.logger.debug('Security event handling configured');
  }

  /**
   * Get names of initialized security services
   */
  private getInitializedServiceNames(): string[] {
    const services: string[] = ['securityManager', 'securityAuditLogger'];
    
    if (this.rateLimiter) services.push('rateLimiter');
    if (this.consentManager) services.push('consentManager');
    if (this.inputSanitizer) services.push('inputSanitizer');
    
    return services;
  }

  /**
   * Get comprehensive statistics including security metrics
   */
  public async getStats(): Promise<SecurityEnhancedCoreStats> {
    const baseStats = this.baseCoreServicesInstance.getStats();
    
    let securityStats = {
      enabled: this.config.security.enabled,
      servicesCount: 0,
      healthStatus: {
        healthy: true,
        services: {} as Record<string, { healthy: boolean; error?: string }>
      },
      metrics: {
        rateLimiting: { requestsBlocked: 0, circuitBreakerActivations: 0, averageTokenConsumption: 0 },
        consent: { activeConsents: 0, withdrawalEvents: 0, complianceScore: 1.0 },
        sanitization: { threatsBlocked: 0, cspViolations: 0, sanitizationEvents: 0 }
      } as SecurityMetrics,
      eventsLast24h: 0,
      unacknowledgedAlerts: 0
    };

    if (this.initialized && this.config.security.enabled) {
      try {
        // Get security health status
        const healthCheck = await this.securityManager.performHealthCheck();
        securityStats.healthStatus = healthCheck;
        securityStats.servicesCount = Object.keys(healthCheck.services).length;

        // Get security metrics
        securityStats.metrics = healthCheck.metrics;

        // Get audit statistics
        if (this.securityAuditLogger) {
          const auditStats = this.securityAuditLogger.getAuditStats();
          securityStats.eventsLast24h = auditStats.eventsLast24h;
          securityStats.unacknowledgedAlerts = auditStats.unacknowledgedAlerts;
        }

      } catch (error) {
        this.logger.error('Failed to get security statistics', error);
        securityStats.healthStatus.healthy = false;
        securityStats.healthStatus.services['error'] = {
          healthy: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }

    return {
      ...baseStats,
      security: securityStats
    };
  }

  /**
   * Perform comprehensive health check including security services
   */
  public async healthCheck(): Promise<{
    healthy: boolean;
    services: Record<string, { healthy: boolean; error?: string }>;
    security: {
      enabled: boolean;
      healthy: boolean;
      services: Record<string, { healthy: boolean; error?: string }>;
      metrics: SecurityMetrics;
    };
    stats: SecurityEnhancedCoreStats;
  }> {
    // Get base health check
    const baseHealth = await this.baseCoreServicesInstance.healthCheck();
    
    // Get security health check
    let securityHealth = {
      enabled: this.config.security.enabled,
      healthy: true,
      services: {} as Record<string, { healthy: boolean; error?: string }>,
      metrics: {
        rateLimiting: { requestsBlocked: 0, circuitBreakerActivations: 0, averageTokenConsumption: 0 },
        consent: { activeConsents: 0, withdrawalEvents: 0, complianceScore: 1.0 },
        sanitization: { threatsBlocked: 0, cspViolations: 0, sanitizationEvents: 0 }
      } as SecurityMetrics
    };

    if (this.initialized && this.config.security.enabled) {
      try {
        const securityHealthCheck = await this.securityManager.performHealthCheck();
        securityHealth.healthy = securityHealthCheck.healthy;
        securityHealth.services = securityHealthCheck.services;
        securityHealth.metrics = securityHealthCheck.metrics;
      } catch (error) {
        securityHealth.healthy = false;
        securityHealth.services['error'] = {
          healthy: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }

    const overallHealthy = baseHealth.healthy && securityHealth.healthy;
    
    return {
      healthy: overallHealthy,
      services: {
        ...baseHealth.services,
        ...securityHealth.services
      },
      security: securityHealth,
      stats: await this.getStats()
    };
  }

  /**
   * Enable or disable security features at runtime
   */
  public async setSecurityEnabled(enabled: boolean): Promise<void> {
    if (this.securityManager) {
      await this.securityManager.setSecurityEnabled(enabled);
      this.config.security.enabled = enabled;
      
      this.logger.info('Security features toggled', { enabled });
    }
  }

  /**
   * Get direct access to base core services for compatibility
   */
  public getBaseCoreServices(): VesperaCoreServices {
    return this.baseCoreServices;
  }

  /**
   * Gracefully shutdown all services
   */
  public async dispose(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.logger.info('SecurityEnhancedCoreServices shutdown initiated');

    try {
      // Dispose security services first
      if (this.securityManager) {
        await this.securityManager.dispose();
      }

      // Dispose base services
      await this.baseCoreServicesInstance.dispose();
      
      this.initialized = false;
      this.logger.info('SecurityEnhancedCoreServices shutdown completed');

    } catch (error) {
      this.logger.error('Error during SecurityEnhancedCoreServices shutdown', error);
      throw error;
    }
  }
}