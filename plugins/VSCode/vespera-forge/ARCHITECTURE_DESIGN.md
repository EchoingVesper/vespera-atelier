# VS Code Extension - Error Handling and Memory Management Architecture

## Overview

This document specifies the comprehensive architecture for standardized error handling and memory management in the Vespera Forge VS Code extension, addressing identified code quality issues and establishing consistent patterns across all 61+ TypeScript files.

## Current Issues Analysis

### 1. Inconsistent Error Handling

- **ConfigurationManager.ts:756-762**: Mixed logging and throwing strategies
- **Extension.ts**: Basic try-catch with console.error
- **Utility functions**: Inconsistent error propagation
- **Provider classes**: Various error handling approaches

### 2. Memory Management Concerns

- **Extension.ts:86-100**: View context stored in global variable with type casting
- **WeakMap opportunities**: Not utilized for automatic garbage collection
- **Resource cleanup**: Inconsistent disposal patterns
- **Provider lifecycle**: Manual disposal tracking

## Architecture Components

## 1. Standardized Error Handling System

### 1.1 Error Type Hierarchy

```typescript
// src/core/error-handling/VesperaErrors.ts

export enum VesperaErrorCode {
  // Configuration Errors (1000-1099)
  CONFIGURATION_LOAD_FAILED = 1000,
  CONFIGURATION_VALIDATION_FAILED = 1001,
  CONFIGURATION_SAVE_FAILED = 1002,
  CREDENTIAL_STORAGE_FAILED = 1003,

  // Provider Errors (1100-1199)
  PROVIDER_INITIALIZATION_FAILED = 1100,
  PROVIDER_CONNECTION_FAILED = 1101,
  PROVIDER_AUTHENTICATION_FAILED = 1102,
  PROVIDER_REQUEST_FAILED = 1103,

  // View Errors (1200-1299)
  WEBVIEW_CREATION_FAILED = 1200,
  WEBVIEW_MESSAGE_FAILED = 1201,
  VIEW_CONTEXT_INVALID = 1202,

  // Memory Management Errors (1300-1399)
  RESOURCE_DISPOSAL_FAILED = 1300,
  MEMORY_LEAK_DETECTED = 1301,
  CONTEXT_CLEANUP_FAILED = 1302,

  // External Service Errors (1400-1499)
  BINDERY_CONNECTION_FAILED = 1400,
  MCP_SERVER_ERROR = 1401,
  EXTERNAL_API_ERROR = 1402,

  // Unknown/Generic Errors (9000-9999)
  UNKNOWN_ERROR = 9000
}

export enum VesperaSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum VesperaErrorCategory {
  CONFIGURATION = 'configuration',
  PROVIDER = 'provider',
  VIEW = 'view',
  MEMORY = 'memory',
  EXTERNAL = 'external',
  UNKNOWN = 'unknown'
}

export interface VesperaErrorMetadata {
  timestamp: number;
  source: string;
  context?: Record<string, any>;
  stackTrace?: string;
  userId?: string;
  sessionId?: string;
  extension?: {
    version: string;
    vsCodeVersion: string;
    platform: string;
  };
}

export class VesperaError extends Error {
  public readonly code: VesperaErrorCode;
  public readonly severity: VesperaSeverity;
  public readonly category: VesperaErrorCategory;
  public readonly metadata: VesperaErrorMetadata;
  public readonly isRetryable: boolean;

  constructor(
    message: string,
    code: VesperaErrorCode,
    severity: VesperaSeverity = VesperaSeverity.MEDIUM,
    metadata: Partial<VesperaErrorMetadata> = {},
    isRetryable: boolean = false,
    cause?: Error
  ) {
    super(message);
    this.name = 'VesperaError';
    this.code = code;
    this.severity = severity;
    this.category = this.getCategoryFromCode(code);
    this.isRetryable = isRetryable;
    this.cause = cause;

    this.metadata = {
      timestamp: Date.now(),
      source: this.getSourceFromStack(),
      stackTrace: this.stack,
      extension: {
        version: vscode.extensions.getExtension('vespera-atelier.vespera-forge')?.packageJSON.version || 'unknown',
        vsCodeVersion: vscode.version,
        platform: process.platform
      },
      ...metadata
    };
  }

  private getCategoryFromCode(code: VesperaErrorCode): VesperaErrorCategory {
    if (code >= 1000 && code < 1100) return VesperaErrorCategory.CONFIGURATION;
    if (code >= 1100 && code < 1200) return VesperaErrorCategory.PROVIDER;
    if (code >= 1200 && code < 1300) return VesperaErrorCategory.VIEW;
    if (code >= 1300 && code < 1400) return VesperaErrorCategory.MEMORY;
    if (code >= 1400 && code < 1500) return VesperaErrorCategory.EXTERNAL;
    return VesperaErrorCategory.UNKNOWN;
  }

  private getSourceFromStack(): string {
    const stack = new Error().stack;
    const stackLines = stack?.split('\n') || [];
    const relevantLine = stackLines.find(line => 
      line.includes('.ts:') && !line.includes('VesperaError')
    );
    return relevantLine?.trim().replace(/^\s*at\s+/, '') || 'unknown';
  }

  public toJSON(): object {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      category: this.category,
      metadata: this.metadata,
      isRetryable: this.isRetryable,
      cause: this.cause ? {
        name: this.cause.name,
        message: this.cause.message,
        stack: this.cause.stack
      } : undefined
    };
  }
}

// Specialized Error Classes
export class VesperaConfigurationError extends VesperaError {
  constructor(message: string, code: VesperaErrorCode, metadata?: Partial<VesperaErrorMetadata>, cause?: Error) {
    super(message, code, VesperaSeverity.MEDIUM, metadata, false, cause);
  }
}

export class VesperaProviderError extends VesperaError {
  constructor(message: string, code: VesperaErrorCode, metadata?: Partial<VesperaErrorMetadata>, isRetryable: boolean = true, cause?: Error) {
    super(message, code, VesperaSeverity.MEDIUM, metadata, isRetryable, cause);
  }
}

export class VesperaMemoryError extends VesperaError {
  constructor(message: string, code: VesperaErrorCode, metadata?: Partial<VesperaErrorMetadata>, cause?: Error) {
    super(message, code, VesperaSeverity.HIGH, metadata, false, cause);
  }
}
```

### 1.2 Error Handler Service

```typescript
// src/core/error-handling/VesperaErrorHandler.ts

export interface ErrorHandlingStrategy {
  shouldLog: boolean;
  shouldNotifyUser: boolean;
  shouldThrow: boolean;
  shouldRetry: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

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

    this.strategies.set(VesperaErrorCode.CREDENTIAL_STORAGE_FAILED, {
      shouldLog: true,
      shouldNotifyUser: true,
      shouldThrow: true,
      shouldRetry: false
    });

    // Provider errors
    this.strategies.set(VesperaErrorCode.PROVIDER_CONNECTION_FAILED, {
      shouldLog: true,
      shouldNotifyUser: false, // Don't spam user with connection issues
      shouldThrow: false,
      shouldRetry: true,
      maxRetries: 3,
      retryDelay: 2000
    });

    // Memory errors - always critical
    this.strategies.set(VesperaErrorCode.RESOURCE_DISPOSAL_FAILED, {
      shouldLog: true,
      shouldNotifyUser: false, // Internal issue
      shouldThrow: false,
      shouldRetry: false
    });

    // Default strategy for unknown errors
    this.strategies.set(VesperaErrorCode.UNKNOWN_ERROR, {
      shouldLog: true,
      shouldNotifyUser: false,
      shouldThrow: false,
      shouldRetry: false
    });
  }

  public async handleError(error: Error | VesperaError): Promise<void> {
    const vesperaError = this.normalizeError(error);
    const strategy = this.getStrategy(vesperaError.code);

    // Always log errors
    if (strategy.shouldLog) {
      await this.logger.error(`${vesperaError.category}:${vesperaError.code}`, vesperaError.message, vesperaError.metadata);
    }

    // Send telemetry for error tracking
    this.telemetryService.trackError(vesperaError);

    // Notify user if necessary
    if (strategy.shouldNotifyUser) {
      await this.notifyUser(vesperaError);
    }

    // Attempt retry if configured
    if (strategy.shouldRetry && vesperaError.isRetryable) {
      // Return retry metadata for caller to handle
      // This would be implemented based on specific retry needs
    }

    // Throw if strategy requires it
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

  private getStrategy(code: VesperaErrorCode): ErrorHandlingStrategy {
    return this.strategies.get(code) || this.strategies.get(VesperaErrorCode.UNKNOWN_ERROR)!;
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
    const unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
      this.handleError(new VesperaError(
        `Unhandled promise rejection: ${event.reason}`,
        VesperaErrorCode.UNKNOWN_ERROR,
        VesperaSeverity.HIGH,
        { context: { reason: event.reason } }
      ));
    };

    // Note: In Node.js context, we'd use process.on('unhandledRejection')
    // For VS Code extension context, we rely on proper try-catch blocks
  }

  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}
```

## 2. Memory-Safe Context Management

### 2.1 WeakMap-based Context Storage

```typescript
// src/core/memory-management/VesperaContextManager.ts

export interface ViewContextEntry {
  chatPanelProvider?: ChatWebViewProvider;
  taskDashboardProvider?: TaskDashboardProvider;
  statusBarManager?: StatusBarManager;
  taskTreeProvider?: TaskTreeProvider;
  createdAt: number;
  lastAccessedAt: number;
}

export interface DisposableResource {
  dispose(): void | Promise<void>;
}

export class VesperaContextManager implements vscode.Disposable {
  private static instance: VesperaContextManager;
  
  // WeakMap automatically handles garbage collection when extension context is disposed
  private readonly viewContexts = new WeakMap<vscode.ExtensionContext, ViewContextEntry>();
  
  // Track disposables by unique ID for cleanup
  private readonly resourceRegistry = new Map<string, DisposableResource>();
  private readonly resourceMetadata = new Map<string, { type: string; createdAt: number; }>();
  
  // Memory usage tracking
  private memoryCheckInterval?: NodeJS.Timeout;
  private readonly memoryThreshold = 100 * 1024 * 1024; // 100MB threshold
  
  private constructor(private logger: VesperaLogger) {
    this.startMemoryMonitoring();
  }

  public static initialize(logger: VesperaLogger): VesperaContextManager {
    if (!VesperaContextManager.instance) {
      VesperaContextManager.instance = new VesperaContextManager(logger);
    }
    return VesperaContextManager.instance;
  }

  public static getInstance(): VesperaContextManager {
    if (!VesperaContextManager.instance) {
      throw new Error('VesperaContextManager not initialized');
    }
    return VesperaContextManager.instance;
  }

  public setViewContext(extensionContext: vscode.ExtensionContext, viewContext: Partial<ViewContextEntry>): void {
    const existing = this.viewContexts.get(extensionContext) || {
      createdAt: Date.now(),
      lastAccessedAt: Date.now()
    };

    const updated: ViewContextEntry = {
      ...existing,
      ...viewContext,
      lastAccessedAt: Date.now()
    };

    this.viewContexts.set(extensionContext, updated);
    
    this.logger.debug('ViewContext updated', {
      hasChat: !!updated.chatPanelProvider,
      hasTaskDashboard: !!updated.taskDashboardProvider,
      hasStatusBar: !!updated.statusBarManager,
      hasTaskTree: !!updated.taskTreeProvider
    });
  }

  public getViewContext(extensionContext: vscode.ExtensionContext): ViewContextEntry | undefined {
    const context = this.viewContexts.get(extensionContext);
    if (context) {
      context.lastAccessedAt = Date.now();
    }
    return context;
  }

  public registerResource<T extends DisposableResource>(
    resource: T,
    type: string,
    id?: string
  ): string {
    const resourceId = id || this.generateResourceId(type);
    
    this.resourceRegistry.set(resourceId, resource);
    this.resourceMetadata.set(resourceId, {
      type,
      createdAt: Date.now()
    });

    this.logger.debug(`Resource registered: ${type}:${resourceId}`);
    return resourceId;
  }

  public async disposeResource(resourceId: string): Promise<boolean> {
    const resource = this.resourceRegistry.get(resourceId);
    const metadata = this.resourceMetadata.get(resourceId);

    if (!resource || !metadata) {
      this.logger.warn(`Resource not found for disposal: ${resourceId}`);
      return false;
    }

    try {
      await resource.dispose();
      
      this.resourceRegistry.delete(resourceId);
      this.resourceMetadata.delete(resourceId);
      
      this.logger.debug(`Resource disposed: ${metadata.type}:${resourceId}`);
      return true;
    } catch (error) {
      const vesperaError = new VesperaMemoryError(
        `Failed to dispose resource ${metadata.type}:${resourceId}`,
        VesperaErrorCode.RESOURCE_DISPOSAL_FAILED,
        { context: { resourceId, resourceType: metadata.type } },
        error instanceof Error ? error : new Error(String(error))
      );

      await VesperaErrorHandler.getInstance().handleError(vesperaError);
      return false;
    }
  }

  public async disposeViewContext(extensionContext: vscode.ExtensionContext): Promise<void> {
    const viewContext = this.viewContexts.get(extensionContext);
    
    if (!viewContext) {
      this.logger.debug('No view context found for disposal');
      return;
    }

    const disposalPromises: Promise<void>[] = [];

    // Dispose each provider safely
    if (viewContext.chatPanelProvider) {
      disposalPromises.push(this.safeDispose(viewContext.chatPanelProvider, 'ChatPanelProvider'));
    }

    if (viewContext.taskDashboardProvider) {
      disposalPromises.push(this.safeDispose(viewContext.taskDashboardProvider, 'TaskDashboardProvider'));
    }

    if (viewContext.statusBarManager) {
      disposalPromises.push(this.safeDispose(viewContext.statusBarManager, 'StatusBarManager'));
    }

    if (viewContext.taskTreeProvider) {
      disposalPromises.push(this.safeDispose(viewContext.taskTreeProvider, 'TaskTreeProvider'));
    }

    // Wait for all disposals to complete
    await Promise.allSettled(disposalPromises);

    // Remove from WeakMap (though it would be garbage collected anyway)
    this.viewContexts.delete(extensionContext);
    
    this.logger.info('View context disposed successfully');
  }

  private async safeDispose(resource: DisposableResource, resourceType: string): Promise<void> {
    try {
      await resource.dispose();
      this.logger.debug(`${resourceType} disposed successfully`);
    } catch (error) {
      const vesperaError = new VesperaMemoryError(
        `Failed to dispose ${resourceType}`,
        VesperaErrorCode.RESOURCE_DISPOSAL_FAILED,
        { context: { resourceType } },
        error instanceof Error ? error : new Error(String(error))
      );

      await VesperaErrorHandler.getInstance().handleError(vesperaError);
    }
  }

  private startMemoryMonitoring(): void {
    this.memoryCheckInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, 30000); // Check every 30 seconds
  }

  private checkMemoryUsage(): void {
    const memUsage = process.memoryUsage();
    
    if (memUsage.heapUsed > this.memoryThreshold) {
      this.logger.warn('High memory usage detected', {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024)
      });

      // Suggest garbage collection
      if (global.gc) {
        global.gc();
        this.logger.debug('Garbage collection triggered');
      }
    }

    this.logger.debug('Memory usage check', {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
      registeredResources: this.resourceRegistry.size
    });
  }

  private generateResourceId(type: string): string {
    return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public getMemoryStats(): {
    viewContexts: number;
    registeredResources: number;
    memoryUsage: NodeJS.MemoryUsage;
    resourceTypes: Record<string, number>;
  } {
    const resourceTypes: Record<string, number> = {};
    
    for (const metadata of this.resourceMetadata.values()) {
      resourceTypes[metadata.type] = (resourceTypes[metadata.type] || 0) + 1;
    }

    return {
      viewContexts: 0, // WeakMap size is not accessible
      registeredResources: this.resourceRegistry.size,
      memoryUsage: process.memoryUsage(),
      resourceTypes
    };
  }

  public dispose(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = undefined;
    }

    // Dispose all registered resources
    const disposalPromises = Array.from(this.resourceRegistry.entries()).map(
      async ([id, resource]) => {
        try {
          await resource.dispose();
        } catch (error) {
          this.logger.error(`Failed to dispose resource ${id}`, error);
        }
      }
    );

    Promise.allSettled(disposalPromises).then(() => {
      this.logger.info('All resources disposed during context manager cleanup');
    });

    this.resourceRegistry.clear();
    this.resourceMetadata.clear();
  }
}
```

## 3. Comprehensive Logging Framework

### 3.1 VS Code Integrated Logger

```typescript
// src/core/logging/VesperaLogger.ts

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
  source: string;
  sessionId: string;
}

export interface LoggerConfiguration {
  level: LogLevel;
  enableConsole: boolean;
  enableVSCodeOutput: boolean;
  enableFile: boolean;
  filePath?: string;
  maxFileSize?: number;
  maxFiles?: number;
  enableStructuredLogging: boolean;
  enableTelemetry: boolean;
}

export class VesperaLogger implements vscode.Disposable {
  private static instance: VesperaLogger;
  private outputChannel: vscode.OutputChannel;
  private config: LoggerConfiguration;
  private sessionId: string;
  private logBuffer: LogEntry[] = [];
  private flushInterval?: NodeJS.Timeout;
  private disposables: vscode.Disposable[] = [];

  private constructor(context: vscode.ExtensionContext, config: Partial<LoggerConfiguration> = {}) {
    this.sessionId = this.generateSessionId();
    this.config = this.mergeConfiguration(config);
    
    this.outputChannel = vscode.window.createOutputChannel('Vespera Forge', 'log');
    this.disposables.push(this.outputChannel);

    if (this.config.enableVSCodeOutput) {
      this.outputChannel.show(true);
    }

    this.startLogFlushing();
    this.setupDevelopmentLogging();
  }

  public static initialize(
    context: vscode.ExtensionContext, 
    config?: Partial<LoggerConfiguration>
  ): VesperaLogger {
    if (!VesperaLogger.instance) {
      VesperaLogger.instance = new VesperaLogger(context, config);
    }
    return VesperaLogger.instance;
  }

  public static getInstance(): VesperaLogger {
    if (!VesperaLogger.instance) {
      throw new Error('VesperaLogger not initialized');
    }
    return VesperaLogger.instance;
  }

  private mergeConfiguration(config: Partial<LoggerConfiguration>): LoggerConfiguration {
    const isDevelopment = vscode.env.appName.includes('Insiders') || process.env.NODE_ENV === 'development';
    
    return {
      level: config.level ?? (isDevelopment ? LogLevel.DEBUG : LogLevel.INFO),
      enableConsole: config.enableConsole ?? isDevelopment,
      enableVSCodeOutput: config.enableVSCodeOutput ?? true,
      enableFile: config.enableFile ?? false,
      maxFileSize: config.maxFileSize ?? 10 * 1024 * 1024, // 10MB
      maxFiles: config.maxFiles ?? 5,
      enableStructuredLogging: config.enableStructuredLogging ?? true,
      enableTelemetry: config.enableTelemetry ?? true,
      ...config
    };
  }

  public debug(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  public info(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  public warn(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  public error(message: string, error?: Error | any, metadata?: Record<string, any>): void {
    const enhancedMetadata = {
      ...metadata,
      ...(error && {
        error: {
          name: error.name || 'Error',
          message: error.message || String(error),
          stack: error.stack
        }
      })
    };

    this.log(LogLevel.ERROR, message, enhancedMetadata);
  }

  public fatal(message: string, error?: Error | any, metadata?: Record<string, any>): void {
    const enhancedMetadata = {
      ...metadata,
      ...(error && {
        error: {
          name: error.name || 'Error',
          message: error.message || String(error),
          stack: error.stack
        }
      })
    };

    this.log(LogLevel.FATAL, message, enhancedMetadata);
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, any>): void {
    if (level < this.config.level) {
      return; // Skip logging below configured level
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      metadata,
      source: this.getCallerSource(),
      sessionId: this.sessionId
    };

    this.logBuffer.push(entry);

    // Immediate output for console and VS Code
    this.outputToChannels(entry);

    // Buffer for file logging (flushed periodically)
    if (this.logBuffer.length > 100) {
      this.flushLogs();
    }
  }

  private outputToChannels(entry: LogEntry): void {
    const formattedMessage = this.formatLogEntry(entry);
    const consoleMessage = this.formatConsoleMessage(entry);

    // Console logging (development)
    if (this.config.enableConsole) {
      switch (entry.level) {
        case LogLevel.DEBUG:
          console.debug(consoleMessage);
          break;
        case LogLevel.INFO:
          console.info(consoleMessage);
          break;
        case LogLevel.WARN:
          console.warn(consoleMessage);
          break;
        case LogLevel.ERROR:
        case LogLevel.FATAL:
          console.error(consoleMessage);
          break;
      }
    }

    // VS Code Output Channel
    if (this.config.enableVSCodeOutput) {
      this.outputChannel.appendLine(formattedMessage);
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const levelName = LogLevel[entry.level].padEnd(5);
    
    let formatted = `[${timestamp}] ${levelName} ${entry.message}`;
    
    if (entry.source) {
      formatted += ` (${entry.source})`;
    }

    if (entry.metadata && this.config.enableStructuredLogging) {
      formatted += `\n  Metadata: ${JSON.stringify(entry.metadata, null, 2)}`;
    }

    return formatted;
  }

  private formatConsoleMessage(entry: LogEntry): string {
    const levelName = LogLevel[entry.level];
    let message = `[Vespera:${levelName}] ${entry.message}`;
    
    if (entry.metadata) {
      message += ` | ${JSON.stringify(entry.metadata)}`;
    }
    
    return message;
  }

  private getCallerSource(): string {
    const stack = new Error().stack;
    const stackLines = stack?.split('\n') || [];
    
    // Find the first stack line that's not from the logger itself
    const relevantLine = stackLines.find((line, index) => 
      index > 2 && // Skip Error constructor and this method
      line.includes('.ts:') && 
      !line.includes('VesperaLogger') &&
      !line.includes('log(')
    );
    
    if (relevantLine) {
      // Extract file and line number
      const match = relevantLine.match(/([^/\\]+\.ts):(\d+):\d+/);
      if (match) {
        return `${match[1]}:${match[2]}`;
      }
    }
    
    return 'unknown';
  }

  private startLogFlushing(): void {
    this.flushInterval = setInterval(() => {
      this.flushLogs();
    }, 10000); // Flush every 10 seconds
  }

  private flushLogs(): void {
    if (this.logBuffer.length === 0) {
      return;
    }

    // For file logging, we would write buffered entries
    // For now, we just clear the buffer since we're doing immediate output
    this.logBuffer = [];
  }

  private setupDevelopmentLogging(): void {
    if (this.config.enableConsole) {
      // Add context to all console logs
      const originalLog = console.log;
      const originalError = console.error;
      const originalWarn = console.warn;

      console.log = (...args) => originalLog('[Vespera:Dev]', ...args);
      console.error = (...args) => originalError('[Vespera:Dev:Error]', ...args);
      console.warn = (...args) => originalWarn('[Vespera:Dev:Warn]', ...args);
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public getLogStats(): {
    sessionId: string;
    level: LogLevel;
    bufferSize: number;
    configuration: LoggerConfiguration;
  } {
    return {
      sessionId: this.sessionId,
      level: this.config.level,
      bufferSize: this.logBuffer.length,
      configuration: this.config
    };
  }

  public dispose(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    
    this.flushLogs();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}
```

## 4. Enhanced Disposal System

### 4.1 Disposal Pattern Interface

```typescript
// src/core/disposal/DisposalManager.ts

export interface EnhancedDisposable {
  dispose(): void | Promise<void>;
  readonly isDisposed: boolean;
  readonly disposalPriority?: number; // Higher numbers disposed first
}

export interface DisposalHook {
  beforeDispose?(): void | Promise<void>;
  afterDispose?(): void | Promise<void>;
  onDisposeError?(error: Error): void | Promise<void>;
}

export class DisposalManager implements vscode.Disposable {
  private disposed = false;
  private disposables: EnhancedDisposable[] = [];
  private hooks: DisposalHook[] = [];
  private logger: VesperaLogger;

  constructor(logger: VesperaLogger) {
    this.logger = logger;
  }

  public add<T extends EnhancedDisposable>(disposable: T): T {
    if (this.disposed) {
      throw new Error('Cannot add disposables to disposed manager');
    }

    this.disposables.push(disposable);
    this.logger.debug(`Added disposable: ${disposable.constructor.name}`);
    return disposable;
  }

  public addHook(hook: DisposalHook): void {
    if (this.disposed) {
      throw new Error('Cannot add hooks to disposed manager');
    }

    this.hooks.push(hook);
  }

  public async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.logger.info('Starting disposal process', { 
      disposableCount: this.disposables.length,
      hookCount: this.hooks.length 
    });

    // Execute before disposal hooks
    for (const hook of this.hooks) {
      if (hook.beforeDispose) {
        try {
          await hook.beforeDispose();
        } catch (error) {
          this.logger.error('Error in beforeDispose hook', error);
          if (hook.onDisposeError) {
            await hook.onDisposeError(error instanceof Error ? error : new Error(String(error)));
          }
        }
      }
    }

    // Sort disposables by priority (higher priority disposed first)
    const sortedDisposables = [...this.disposables].sort((a, b) => 
      (b.disposalPriority || 0) - (a.disposalPriority || 0)
    );

    // Dispose all disposables
    const disposalResults = await Promise.allSettled(
      sortedDisposables.map(async (disposable) => {
        try {
          if (!disposable.isDisposed) {
            await disposable.dispose();
            this.logger.debug(`Disposed: ${disposable.constructor.name}`);
          }
        } catch (error) {
          this.logger.error(`Failed to dispose ${disposable.constructor.name}`, error);
          throw error;
        }
      })
    );

    // Check for disposal failures
    const failures = disposalResults.filter(result => result.status === 'rejected');
    if (failures.length > 0) {
      this.logger.warn(`${failures.length} disposables failed to dispose properly`);
    }

    // Execute after disposal hooks
    for (const hook of this.hooks) {
      if (hook.afterDispose) {
        try {
          await hook.afterDispose();
        } catch (error) {
          this.logger.error('Error in afterDispose hook', error);
        }
      }
    }

    this.disposables = [];
    this.hooks = [];
    
    this.logger.info('Disposal process completed', { 
      successful: disposalResults.length - failures.length,
      failed: failures.length 
    });
  }

  public get isDisposed(): boolean {
    return this.disposed;
  }
}
```

### 4.2 Enhanced Base Classes

```typescript
// src/core/disposal/BaseDisposable.ts

export abstract class BaseDisposable implements EnhancedDisposable {
  private _disposed = false;
  protected logger: VesperaLogger;
  public readonly disposalPriority: number = 0;

  constructor(logger?: VesperaLogger, disposalPriority?: number) {
    this.logger = logger || VesperaLogger.getInstance();
    this.disposalPriority = disposalPriority || 0;
  }

  public async dispose(): Promise<void> {
    if (this._disposed) {
      return;
    }

    this._disposed = true;
    
    try {
      await this.onDispose();
      this.logger.debug(`${this.constructor.name} disposed successfully`);
    } catch (error) {
      const vesperaError = new VesperaMemoryError(
        `Failed to dispose ${this.constructor.name}`,
        VesperaErrorCode.RESOURCE_DISPOSAL_FAILED,
        { context: { className: this.constructor.name } },
        error instanceof Error ? error : new Error(String(error))
      );
      
      await VesperaErrorHandler.getInstance().handleError(vesperaError);
      throw vesperaError;
    }
  }

  protected abstract onDispose(): void | Promise<void>;

  public get isDisposed(): boolean {
    return this._disposed;
  }
}

// Enhanced WebView Provider Base
export abstract class BaseWebViewProvider extends BaseDisposable implements vscode.WebviewViewProvider {
  protected webviewView?: vscode.WebviewView;
  protected disposalManager: DisposalManager;

  constructor(
    protected context: vscode.ExtensionContext,
    logger?: VesperaLogger,
    disposalPriority: number = 100
  ) {
    super(logger, disposalPriority);
    this.disposalManager = new DisposalManager(this.logger);
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): void | Thenable<void> {
    this.webviewView = webviewView;
    
    // Setup webview
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

    // Add message listener to disposal manager
    this.disposalManager.add({
      dispose: () => {
        if (this.webviewView) {
          // Remove all listeners
          this.webviewView.webview.onDidReceiveMessage(() => {}, undefined, []);
          this.webviewView = undefined;
        }
      },
      isDisposed: false
    } as EnhancedDisposable);

    this.setupWebview(webviewView, context, token);
  }

  protected abstract setupWebview(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): void | Thenable<void>;

  protected async onDispose(): Promise<void> {
    await this.disposalManager.dispose();
    this.webviewView = undefined;
  }
}
```

## 5. TypeScript Configuration Improvements

### 5.1 Enhanced tsconfig.json

```json
{
  "compilerOptions": {
    "module": "CommonJS",
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    
    "outDir": "out",
    "rootDir": "src",
    "sourceMap": true,
    "declaration": true,
    "declarationMap": true,
    
    // Enhanced Type Safety
    "strict": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noUncheckedIndexedAccess": true,
    
    // Additional Strict Checks
    "allowUnreachableCode": false,
    "allowUnusedLabels": false,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "moduleResolution": "Node",
    
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"],
      "@/core/*": ["core/*"],
      "@/commands/*": ["commands/*"],
      "@/providers/*": ["providers/*"],
      "@/types/*": ["types/*"],
      "@/utils/*": ["utils/*"],
      "@/views/*": ["views/*"],
      "@/chat/*": ["chat/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "out", "dist", "**/*.test.ts"],
  "ts-node": {
    "esm": true
  }
}
```

## 6. Migration Strategy

### 6.1 Phase 1: Core Infrastructure Setup

1. **Install Core Components**:

   ```typescript
   // src/core/index.ts
   import { VesperaLogger } from './logging/VesperaLogger';
   import { VesperaErrorHandler } from './error-handling/VesperaErrorHandler';
   import { VesperaContextManager } from './memory-management/VesperaContextManager';
   import { DisposalManager } from './disposal/DisposalManager';

   export class VesperaCoreServices {
     public static async initialize(context: vscode.ExtensionContext) {
       const logger = VesperaLogger.initialize(context);
       const telemetryService = new VesperaTelemetryService();
       const errorHandler = VesperaErrorHandler.initialize(context, logger, telemetryService);
       const contextManager = VesperaContextManager.initialize(logger);
       
       return {
         logger,
         errorHandler,
         contextManager,
         telemetryService
       };
     }
   }
   ```

2. **Update extension.ts**:

   ```typescript
   // Replace current activation with core services initialization
   export async function activate(context: vscode.ExtensionContext): Promise<void> {
     const coreServices = await VesperaCoreServices.initialize(context);
     
     // Use memory-safe context management
     const contextManager = coreServices.contextManager;
     
     // Initialize providers with proper error handling
     try {
       const { contentProvider, treeDataProvider } = initializeProviders(context);
       const viewContext = initializeViews(context);
       
       // Register view context safely
       contextManager.setViewContext(context, viewContext);
       
       // Rest of initialization...
     } catch (error) {
       await coreServices.errorHandler.handleError(error);
     }
   }
   ```

### 6.2 Phase 2: Provider Migration

1. **Update ConfigurationManager.ts** (Lines 756-762):

   ```typescript
   // BEFORE (inconsistent error handling)
   } catch (error) {
     console.error(`Failed to store sensitive field ${field.name} securely:`, error);
     throw new Error(`Failed to store ${field.name} securely: ${error instanceof Error ? error.message : 'Unknown error'}`);
   }

   // AFTER (standardized error handling)
   } catch (error) {
     const vesperaError = new VesperaConfigurationError(
       `Failed to store sensitive field ${field.name} securely`,
       VesperaErrorCode.CREDENTIAL_STORAGE_FAILED,
       { 
         context: { 
           providerId, 
           fieldName: field.name,
           originalError: error instanceof Error ? error.message : String(error)
         } 
       },
       error instanceof Error ? error : new Error(String(error))
     );
     
     await VesperaErrorHandler.getInstance().handleError(vesperaError);
     // Error handler will decide whether to throw based on strategy
   }
   ```

2. **Convert Providers to Enhanced Base Classes**:

   ```typescript
   // Example: ChatWebViewProvider migration
   export class ChatWebViewProvider extends BaseWebViewProvider {
     constructor(context: vscode.ExtensionContext) {
       super(context, undefined, 90); // High disposal priority
     }

     protected setupWebview(webviewView: vscode.WebviewView): void {
       // Register message handler with disposal manager
       const messageDisposable = webviewView.webview.onDidReceiveMessage(
         this.handleMessage.bind(this)
       );
       
       this.disposalManager.add({
         dispose: () => messageDisposable.dispose(),
         isDisposed: false
       } as EnhancedDisposable);
     }

     private async handleMessage(message: any): Promise<void> {
       try {
         // Process message
       } catch (error) {
         const vesperaError = new VesperaProviderError(
           'Failed to process webview message',
           VesperaErrorCode.WEBVIEW_MESSAGE_FAILED,
           { context: { messageType: message.type } },
           true, // retryable
           error instanceof Error ? error : new Error(String(error))
         );
         
         await VesperaErrorHandler.getInstance().handleError(vesperaError);
       }
     }
   }
   ```

### 6.3 Phase 3: Memory Management Upgrade

1. **Replace Global Context Storage**:

   ```typescript
   // BEFORE (extension.ts lines 86-100)
   if (globalExtensionContext && (globalExtensionContext as any)._viewContext) {
     const viewContext = (globalExtensionContext as any)._viewContext;
     // Manual disposal with type casting
   }

   // AFTER
   export async function deactivate(): Promise<void> {
     try {
       const contextManager = VesperaContextManager.getInstance();
       await contextManager.disposeViewContext(vscode.extensions.getExtension('vespera-atelier.vespera-forge')?.extensionContext!);
       
       contextManager.dispose();
     } catch (error) {
       const errorHandler = VesperaErrorHandler.getInstance();
       await errorHandler.handleError(error);
     }
   }
   ```

### 6.4 Phase 4: Testing and Validation

1. **Error Handling Tests**:

   ```typescript
   // test/error-handling.test.ts
   suite('VesperaErrorHandler', () => {
     test('handles configuration errors correctly', async () => {
       const error = new VesperaConfigurationError(
         'Test config error',
         VesperaErrorCode.CONFIGURATION_LOAD_FAILED
       );
       
       const handler = VesperaErrorHandler.getInstance();
       await handler.handleError(error);
       
       // Verify logging, user notification, etc.
     });
   });
   ```

2. **Memory Management Tests**:

   ```typescript
   // test/memory-management.test.ts
   suite('VesperaContextManager', () => {
     test('properly disposes view contexts', async () => {
       const contextManager = VesperaContextManager.getInstance();
       const mockContext = {} as vscode.ExtensionContext;
       
       const mockProvider = {
         dispose: sinon.spy(),
         isDisposed: false
       };
       
       contextManager.setViewContext(mockContext, { chatPanelProvider: mockProvider });
       await contextManager.disposeViewContext(mockContext);
       
       assert(mockProvider.dispose.calledOnce);
     });
   });
   ```

## 7. Integration Points

### 7.1 VS Code Extension Lifecycle

```typescript
// Integration with VS Code extension lifecycle
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Initialize core services
  const { logger, errorHandler, contextManager } = await VesperaCoreServices.initialize(context);
  
  // Register for proper cleanup
  context.subscriptions.push(
    logger,
    errorHandler,
    contextManager
  );
  
  // Set up global error boundary
  process.on('uncaughtException', async (error) => {
    await errorHandler.handleError(error);
  });
  
  process.on('unhandledRejection', async (reason) => {
    await errorHandler.handleError(
      new VesperaError(
        `Unhandled promise rejection: ${reason}`,
        VesperaErrorCode.UNKNOWN_ERROR,
        VesperaSeverity.HIGH
      )
    );
  });
}
```

### 7.2 Development vs Production Configuration

```typescript
// Automatic environment detection and configuration
const isDevelopment = vscode.env.appName.includes('Insiders') || 
                     process.env.NODE_ENV === 'development';

const loggerConfig: Partial<LoggerConfiguration> = {
  level: isDevelopment ? LogLevel.DEBUG : LogLevel.INFO,
  enableConsole: isDevelopment,
  enableVSCodeOutput: true,
  enableStructuredLogging: isDevelopment
};

const logger = VesperaLogger.initialize(context, loggerConfig);
```

## Success Criteria

1. **Standardized Error Handling**: All 61+ TypeScript files use VesperaError hierarchy
2. **Memory Safety**: WeakMap-based context management eliminates global variable type casting
3. **Comprehensive Logging**: VS Code integrated logging with structured metadata
4. **Resource Cleanup**: Enhanced disposal patterns prevent memory leaks
5. **Type Safety**: Improved TypeScript configuration catches more potential issues
6. **Development Experience**: Clear error messages and debugging information
7. **Performance**: Memory usage monitoring and optimization

## Next Steps

The scaffolding agent can now implement this architecture by:

1. Creating the core infrastructure files
2. Migrating existing providers to use the new base classes
3. Updating error handling throughout the codebase
4. Implementing memory-safe context management
5. Setting up comprehensive testing for all components

This architecture provides a solid foundation for maintainable, reliable VS Code extension code with enterprise-grade error handling and memory management.
