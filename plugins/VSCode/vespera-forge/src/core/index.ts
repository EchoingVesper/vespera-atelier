/**
 * Vespera Forge - Core Services Initialization
 * 
 * Centralized initialization and management of all core infrastructure services
 * including logging, error handling, memory management, and disposal coordination.
 */

import * as vscode from 'vscode';
import { VesperaLogger, LoggerConfiguration } from './logging/VesperaLogger';
import { VesperaErrorHandler } from './error-handling/VesperaErrorHandler';
import { VesperaContextManager } from './memory-management/VesperaContextManager';
import { VesperaTelemetryService } from './telemetry/VesperaTelemetryService';
import { DisposalManager } from './disposal/DisposalManager';

export interface VesperaCoreServicesConfig {
  logging?: Partial<LoggerConfiguration>;
  telemetry?: {
    enabled?: boolean;
  };
  memoryMonitoring?: {
    enabled?: boolean;
    thresholdMB?: number;
    checkIntervalMs?: number;
  };
}

export interface VesperaCoreServices {
  logger: VesperaLogger;
  errorHandler: VesperaErrorHandler;
  contextManager: VesperaContextManager;
  telemetryService: VesperaTelemetryService;
  disposalManager: DisposalManager;
}

export interface VesperaCoreStats {
  logger: ReturnType<VesperaLogger['getLogStats']>;
  memory: ReturnType<VesperaContextManager['getMemoryStats']>;
  disposal: ReturnType<DisposalManager['getStats']>;
  uptime: number;
  environment: {
    isDevelopment: boolean;
    vsCodeVersion: string;
    extensionVersion: string;
    platform: string;
  };
}

/**
 * Core services management and initialization
 */
export class VesperaCoreServices implements vscode.Disposable {
  private static instance: VesperaCoreServices;
  private services!: VesperaCoreServices;
  private initialized = false;
  private initializeTime = 0;
  private masterDisposalManager: DisposalManager;

  private constructor(
    private context: vscode.ExtensionContext,
    private config: VesperaCoreServicesConfig = {}
  ) {
    // Create a master disposal manager first (it needs a logger, so we'll set it up properly during initialization)
    this.masterDisposalManager = new DisposalManager(
      // Temporary logger until proper initialization
      {
        debug: console.debug.bind(console),
        info: console.info.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console)
      } as any
    );
  }

  /**
   * Initialize all core services
   */
  public static async initialize(
    context: vscode.ExtensionContext,
    config: VesperaCoreServicesConfig = {}
  ): Promise<VesperaCoreServices> {
    if (VesperaCoreServices.instance) {
      return VesperaCoreServices.instance.services;
    }

    const coreManager = new VesperaCoreServices(context, config);
    await coreManager.initializeServices();
    
    VesperaCoreServices.instance = coreManager;
    return coreManager.services;
  }

  /**
   * Get the initialized core services
   */
  public static getInstance(): VesperaCoreServices {
    if (!VesperaCoreServices.instance?.initialized) {
      throw new Error('VesperaCoreServices not initialized. Call initialize() first.');
    }
    return VesperaCoreServices.instance.services;
  }

  /**
   * Check if core services are initialized
   */
  public static isInitialized(): boolean {
    return VesperaCoreServices.instance?.initialized === true;
  }

  private async initializeServices(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const startTime = Date.now();
    console.log('[Vespera Core] Initializing core services...');

    try {
      // 1. Initialize Logger first (everything else depends on it)
      const logger = VesperaLogger.initialize(this.context, this.config.logging);
      
      // Update master disposal manager with proper logger
      this.masterDisposalManager = new DisposalManager(logger);
      
      logger.info('VesperaCoreServices initialization started', {
        vsCodeVersion: vscode.version,
        platform: process.platform,
        config: this.config
      });

      // 2. Initialize Telemetry Service
      const telemetryService = new VesperaTelemetryService(
        this.config.telemetry?.enabled ?? true
      );

      // 3. Initialize Error Handler (depends on logger and telemetry)
      const errorHandler = VesperaErrorHandler.initialize(
        this.context,
        logger,
        telemetryService
      );

      // 4. Initialize Context Manager (depends on logger)
      const contextManager = VesperaContextManager.initialize(logger);

      // 5. Create service disposal manager
      const disposalManager = new DisposalManager(logger);

      // 6. Register all services for cleanup (except disposal manager itself)
      this.masterDisposalManager.addAll([
        logger,
        errorHandler,
        contextManager
      ]);

      // 7. Register master disposal manager with VS Code
      this.context.subscriptions.push(this.masterDisposalManager);

      // Set up the services object
      this.services = {
        logger,
        errorHandler,
        contextManager,
        telemetryService,
        disposalManager
      };

      // Setup global error handling
      this.setupGlobalErrorHandling();

      this.initialized = true;
      this.initializeTime = Date.now() - startTime;

      logger.info('VesperaCoreServices initialization completed', {
        initializationTime: this.initializeTime,
        services: Object.keys(this.services)
      });

      // Track initialization success
      telemetryService.trackEvent({
        name: 'VesperaCoreServices.Initialize.Success',
        measurements: { initializationTime: this.initializeTime }
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Vespera Core] Failed to initialize core services:', error);

      // Try to report error if possible
      if (this.services?.telemetryService) {
        this.services.telemetryService.trackEvent({
          name: 'VesperaCoreServices.Initialize.Error',
          properties: { error: errorMessage }
        });
      }

      throw new Error(`VesperaCoreServices initialization failed: ${errorMessage}`);
    }
  }

  private setupGlobalErrorHandling(): void {
    const { logger, errorHandler } = this.services;

    // Setup process-level error handlers
    const handleUncaughtException = (error: Error) => {
      logger.fatal('Uncaught exception detected', error);
      errorHandler.handleError(error).catch(handlerError => {
        console.error('Error handler itself failed:', handlerError);
      });
    };

    const handleUnhandledRejection = (reason: any) => {
      logger.error('Unhandled promise rejection detected', reason);
      const error = reason instanceof Error ? reason : new Error(String(reason));
      errorHandler.handleError(error).catch(handlerError => {
        console.error('Error handler itself failed:', handlerError);
      });
    };

    process.on('uncaughtException', handleUncaughtException);
    process.on('unhandledRejection', handleUnhandledRejection);

    // Register cleanup for process handlers
    this.masterDisposalManager.add({
      dispose: () => {
        process.off('uncaughtException', handleUncaughtException);
        process.off('unhandledRejection', handleUnhandledRejection);
      },
      isDisposed: false
    });

    logger.debug('Global error handling configured');
  }

  /**
   * Get comprehensive statistics about all core services
   */
  public getStats(): VesperaCoreStats {
    if (!this.initialized) {
      throw new Error('Cannot get stats before initialization');
    }

    const extensionVersion = vscode.extensions.getExtension('vespera-atelier.vespera-forge')?.packageJSON.version || 'unknown';
    const isDevelopment = vscode.env.appName.includes('Insiders') || process.env['NODE_ENV'] === 'development';

    return {
      logger: this.services.logger.getLogStats(),
      memory: this.services.contextManager.getMemoryStats(),
      disposal: this.services.disposalManager.getStats(),
      uptime: Date.now() - this.initializeTime,
      environment: {
        isDevelopment,
        vsCodeVersion: vscode.version,
        extensionVersion,
        platform: process.platform
      }
    };
  }

  /**
   * Perform health check on all core services
   */
  public async healthCheck(): Promise<{
    healthy: boolean;
    services: Record<string, { healthy: boolean; error?: string }>;
    stats: VesperaCoreStats;
  }> {
    if (!this.initialized) {
      return {
        healthy: false,
        services: { core: { healthy: false, error: 'Not initialized' } },
        stats: {} as VesperaCoreStats
      };
    }

    const { logger, errorHandler, contextManager, telemetryService, disposalManager } = this.services;
    const serviceChecks: Record<string, { healthy: boolean; error?: string }> = {};

    // Check logger
    try {
      logger.debug('Health check: Logger test');
      serviceChecks['logger'] = { healthy: true };
    } catch (error) {
      serviceChecks['logger'] = { healthy: false, error: String(error) };
    }

    // Check error handler
    try {
      // Test that error handler exists and has strategies
      const unknownStrategy = errorHandler.getStrategy(9000); // UNKNOWN_ERROR
      serviceChecks['errorHandler'] = { healthy: !!unknownStrategy };
    } catch (error) {
      serviceChecks['errorHandler'] = { healthy: false, error: String(error) };
    }

    // Check context manager
    try {
      const memStats = contextManager.getMemoryStats();
      serviceChecks['contextManager'] = { healthy: !!memStats };
    } catch (error) {
      serviceChecks['contextManager'] = { healthy: false, error: String(error) };
    }

    // Check telemetry service
    try {
      const isEnabled = telemetryService.isEnabled();
      serviceChecks['telemetryService'] = { healthy: typeof isEnabled === 'boolean' };
    } catch (error) {
      serviceChecks['telemetryService'] = { healthy: false, error: String(error) };
    }

    // Check disposal manager
    try {
      const stats = disposalManager.getStats();
      serviceChecks['disposalManager'] = { healthy: !!stats };
    } catch (error) {
      serviceChecks['disposalManager'] = { healthy: false, error: String(error) };
    }

    const allHealthy = Object.values(serviceChecks).every(check => check.healthy);

    logger.debug('Core services health check completed', { 
      healthy: allHealthy, 
      serviceChecks 
    });

    return {
      healthy: allHealthy,
      services: serviceChecks,
      stats: this.getStats()
    };
  }

  /**
   * Gracefully shutdown all core services
   */
  public async dispose(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    const { logger } = this.services;
    logger.info('VesperaCoreServices shutdown initiated');

    try {
      // Dispose master disposal manager (which will dispose all registered services)
      await this.masterDisposalManager.dispose();
      
      this.initialized = false;
      logger.info('VesperaCoreServices shutdown completed');
    } catch (error) {
      console.error('[Vespera Core] Error during shutdown:', error);
      throw error;
    }
  }
}

// Re-export all core components for easy access
export * from './error-handling/VesperaErrors';
export * from './error-handling/VesperaErrorHandler';
export * from './logging/VesperaLogger';
export * from './memory-management/VesperaContextManager';
export * from './disposal/DisposalManager';
export * from './disposal/BaseDisposable';
export * from './telemetry/VesperaTelemetryService';