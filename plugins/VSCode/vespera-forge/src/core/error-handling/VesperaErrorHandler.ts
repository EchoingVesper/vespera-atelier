/**
 * Vespera Forge - Error Handler Service
 * 
 * Centralized error handling service with configurable strategies for different
 * error types, user notifications, logging, and retry mechanisms.
 */

import * as vscode from 'vscode';
import { VesperaError, VesperaErrorCode, VesperaSeverity } from './VesperaErrors';
import { VesperaLogger } from '../logging/VesperaLogger';
import { VesperaTelemetryService } from '../telemetry/VesperaTelemetryService';

export interface ErrorHandlingStrategy {
  shouldLog: boolean;
  shouldNotifyUser: boolean;
  shouldThrow: boolean;
  shouldRetry: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

export interface RetryMetadata {
  shouldRetry: boolean;
  maxRetries: number;
  retryDelay: number;
}

/**
 * Centralized error handling service with configurable strategies
 */
export class VesperaErrorHandler implements vscode.Disposable {
  private static instance: VesperaErrorHandler;
  private logger: VesperaLogger;
  private telemetryService: VesperaTelemetryService;
  private disposables: vscode.Disposable[] = [];
  
  private strategies = new Map<VesperaErrorCode, ErrorHandlingStrategy>();

  private constructor(
    context: vscode.ExtensionContext,
    logger: VesperaLogger,
    telemetryService: VesperaTelemetryService
  ) {
    this.logger = logger;
    this.telemetryService = telemetryService;
    
    // Log initialization with context info
    this.logger.info('VesperaErrorHandler initialized', { 
      extensionId: context.extension.id 
    });
    
    this.initializeStrategies();
    this.setupGlobalErrorHandling();
  }

  public static initialize(
    context: vscode.ExtensionContext,
    logger: VesperaLogger,
    telemetryService: VesperaTelemetryService
  ): VesperaErrorHandler {
    if (!VesperaErrorHandler.instance) {
      VesperaErrorHandler.instance = new VesperaErrorHandler(context, logger, telemetryService);
    }
    return VesperaErrorHandler.instance;
  }

  public static getInstance(): VesperaErrorHandler {
    if (!VesperaErrorHandler.instance) {
      throw new Error('VesperaErrorHandler not initialized');
    }
    return VesperaErrorHandler.instance;
  }

  private initializeStrategies(): void {
    // Configuration errors
    this.strategies.set(VesperaErrorCode.CONFIGURATION_LOAD_FAILED, {
      shouldLog: true,
      shouldNotifyUser: true,
      shouldThrow: false,
      shouldRetry: true,
      maxRetries: 3,
      retryDelay: 1000
    });

    this.strategies.set(VesperaErrorCode.CONFIGURATION_VALIDATION_FAILED, {
      shouldLog: true,
      shouldNotifyUser: true,
      shouldThrow: true,
      shouldRetry: false
    });

    this.strategies.set(VesperaErrorCode.CONFIGURATION_SAVE_FAILED, {
      shouldLog: true,
      shouldNotifyUser: true,
      shouldThrow: false,
      shouldRetry: true,
      maxRetries: 2,
      retryDelay: 500
    });

    this.strategies.set(VesperaErrorCode.CREDENTIAL_STORAGE_FAILED, {
      shouldLog: true,
      shouldNotifyUser: true,
      shouldThrow: true,
      shouldRetry: false
    });

    // Provider errors
    this.strategies.set(VesperaErrorCode.PROVIDER_INITIALIZATION_FAILED, {
      shouldLog: true,
      shouldNotifyUser: true,
      shouldThrow: true,
      shouldRetry: false
    });

    this.strategies.set(VesperaErrorCode.PROVIDER_CONNECTION_FAILED, {
      shouldLog: true,
      shouldNotifyUser: false, // Don't spam user with connection issues
      shouldThrow: false,
      shouldRetry: true,
      maxRetries: 3,
      retryDelay: 2000
    });

    this.strategies.set(VesperaErrorCode.PROVIDER_AUTHENTICATION_FAILED, {
      shouldLog: true,
      shouldNotifyUser: true,
      shouldThrow: false,
      shouldRetry: false
    });

    this.strategies.set(VesperaErrorCode.PROVIDER_REQUEST_FAILED, {
      shouldLog: true,
      shouldNotifyUser: false,
      shouldThrow: false,
      shouldRetry: true,
      maxRetries: 2,
      retryDelay: 1000
    });

    // View errors
    this.strategies.set(VesperaErrorCode.WEBVIEW_CREATION_FAILED, {
      shouldLog: true,
      shouldNotifyUser: true,
      shouldThrow: true,
      shouldRetry: false
    });

    this.strategies.set(VesperaErrorCode.WEBVIEW_MESSAGE_FAILED, {
      shouldLog: true,
      shouldNotifyUser: false,
      shouldThrow: false,
      shouldRetry: true,
      maxRetries: 1,
      retryDelay: 500
    });

    this.strategies.set(VesperaErrorCode.VIEW_CONTEXT_INVALID, {
      shouldLog: true,
      shouldNotifyUser: false,
      shouldThrow: true,
      shouldRetry: false
    });

    // Memory errors - always critical
    this.strategies.set(VesperaErrorCode.RESOURCE_DISPOSAL_FAILED, {
      shouldLog: true,
      shouldNotifyUser: false, // Internal issue
      shouldThrow: false,
      shouldRetry: false
    });

    this.strategies.set(VesperaErrorCode.MEMORY_LEAK_DETECTED, {
      shouldLog: true,
      shouldNotifyUser: false, // Internal monitoring
      shouldThrow: false,
      shouldRetry: false
    });

    this.strategies.set(VesperaErrorCode.CONTEXT_CLEANUP_FAILED, {
      shouldLog: true,
      shouldNotifyUser: false,
      shouldThrow: false,
      shouldRetry: false
    });

    // External service errors
    this.strategies.set(VesperaErrorCode.BINDERY_CONNECTION_FAILED, {
      shouldLog: true,
      shouldNotifyUser: false, // Let specific handlers decide
      shouldThrow: false,
      shouldRetry: true,
      maxRetries: 3,
      retryDelay: 2000
    });

    this.strategies.set(VesperaErrorCode.MCP_SERVER_ERROR, {
      shouldLog: true,
      shouldNotifyUser: false,
      shouldThrow: false,
      shouldRetry: true,
      maxRetries: 2,
      retryDelay: 1500
    });

    this.strategies.set(VesperaErrorCode.EXTERNAL_API_ERROR, {
      shouldLog: true,
      shouldNotifyUser: false,
      shouldThrow: false,
      shouldRetry: true,
      maxRetries: 2,
      retryDelay: 1000
    });

    // Default strategy for unknown errors
    this.strategies.set(VesperaErrorCode.UNKNOWN_ERROR, {
      shouldLog: true,
      shouldNotifyUser: false,
      shouldThrow: false,
      shouldRetry: false
    });
  }

  /**
   * Handle an error according to its configured strategy
   */
  public async handleError(error: Error | VesperaError): Promise<RetryMetadata | void> {
    const vesperaError = this.normalizeError(error);
    const strategy = this.getStrategy(vesperaError.code);

    // Always log errors
    if (strategy.shouldLog) {
      await this.logger.error(`${vesperaError.category}:${vesperaError.code}`, vesperaError, vesperaError.metadata);
    }

    // Send telemetry for error tracking
    this.telemetryService.trackError(vesperaError);

    // Notify user if necessary
    if (strategy.shouldNotifyUser) {
      await this.notifyUser(vesperaError);
    }

    // Return retry metadata if configured and error is retryable
    if (strategy.shouldRetry && vesperaError.isRetryable) {
      const retryMetadata: RetryMetadata = {
        shouldRetry: true,
        maxRetries: strategy.maxRetries || 1,
        retryDelay: strategy.retryDelay || 1000
      };
      return retryMetadata;
    }

    // Throw if strategy requires it
    if (strategy.shouldThrow) {
      throw vesperaError;
    }
  }

  /**
   * Handle an error with custom strategy override
   */
  public async handleErrorWithStrategy(
    error: Error | VesperaError, 
    strategyOverride: Partial<ErrorHandlingStrategy>
  ): Promise<RetryMetadata | void> {
    const vesperaError = this.normalizeError(error);
    const baseStrategy = this.getStrategy(vesperaError.code);
    const strategy = { ...baseStrategy, ...strategyOverride };

    if (strategy.shouldLog) {
      await this.logger.error(`${vesperaError.category}:${vesperaError.code}`, vesperaError, vesperaError.metadata);
    }

    this.telemetryService.trackError(vesperaError);

    if (strategy.shouldNotifyUser) {
      await this.notifyUser(vesperaError);
    }

    if (strategy.shouldRetry && vesperaError.isRetryable) {
      const retryMetadata: RetryMetadata = {
        shouldRetry: true,
        maxRetries: strategy.maxRetries || 1,
        retryDelay: strategy.retryDelay || 1000
      };
      return retryMetadata;
    }

    if (strategy.shouldThrow) {
      throw vesperaError;
    }
  }

  private normalizeError(error: Error | VesperaError): VesperaError {
    if (error instanceof VesperaError) {
      return error;
    }

    // Convert generic Error to VesperaError
    return new VesperaError(
      error.message,
      VesperaErrorCode.UNKNOWN_ERROR,
      VesperaSeverity.MEDIUM,
      { context: { originalError: error.name } },
      false,
      error
    );
  }


  private async notifyUser(error: VesperaError): Promise<void> {
    const action = error.isRetryable ? 'Retry' : 'OK';
    
    switch (error.severity) {
      case VesperaSeverity.CRITICAL:
      case VesperaSeverity.HIGH:
        await vscode.window.showErrorMessage(
          `Vespera Forge: ${error.message}`,
          action
        );
        break;
      case VesperaSeverity.MEDIUM:
        await vscode.window.showWarningMessage(
          `Vespera Forge: ${error.message}`,
          action
        );
        break;
      case VesperaSeverity.LOW:
        await vscode.window.showInformationMessage(
          `Vespera Forge: ${error.message}`,
          action
        );
        break;
    }
  }

  private setupGlobalErrorHandling(): void {
    // Handle unhandled promise rejections
    const _unhandledRejectionHandler = (reason: any, _promise?: Promise<any>) => {
      this.handleError(new VesperaError(
        `Unhandled promise rejection: ${reason}`,
        VesperaErrorCode.UNKNOWN_ERROR,
        VesperaSeverity.HIGH,
        { context: { reason: String(reason) } }
      ));
    };

    // Note: In Node.js context, we'd use process.on('unhandledRejection')
    // For VS Code extension context, we rely on proper try-catch blocks
    // But we can still set up some basic global handling
    process.on('uncaughtException', (error) => {
      this.handleError(new VesperaError(
        `Uncaught exception: ${error.message}`,
        VesperaErrorCode.UNKNOWN_ERROR,
        VesperaSeverity.CRITICAL,
        { context: { stack: error.stack } },
        false,
        error
      ));
    });

    // Use the extracted handler function for better code organization
    process.on('unhandledRejection', _unhandledRejectionHandler);
  }

  /**
   * Get the current error handling strategy for a specific error code
   */
  public getStrategy(code: VesperaErrorCode): ErrorHandlingStrategy {
    return this.strategies.get(code) || this.strategies.get(VesperaErrorCode.UNKNOWN_ERROR)!;
  }

  /**
   * Update the strategy for a specific error code
   */
  public setStrategy(code: VesperaErrorCode, strategy: ErrorHandlingStrategy): void {
    this.strategies.set(code, strategy);
  }

  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}