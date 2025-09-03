# Integration Patterns for Code Quality Improvements

## Overview

This document provides proven integration patterns for incorporating the code quality improvements from Vespera Forge into existing VS Code extensions and new development projects. All patterns are based on real-world implementations and tested solutions.

## Table of Contents

1. [Core Services Integration](#core-services-integration)
2. [Memory Management Integration](#memory-management-integration)
3. [Error Handling Integration](#error-handling-integration)
4. [Provider Integration Patterns](#provider-integration-patterns)
5. [Service Layer Integration](#service-layer-integration)
6. [Configuration Management Integration](#configuration-management-integration)
7. [Testing Integration](#testing-integration)
8. [Cross-Extension Patterns](#cross-extension-patterns)
9. [Migration Strategies](#migration-strategies)
10. [Best Practices](#best-practices)

## Core Services Integration

### Pattern: Centralized Core Services

The foundation pattern for integrating all quality improvements.

#### Implementation Template

```typescript
// src/core/ExtensionCore.ts
import { VesperaCoreServices, VesperaCoreServicesConfig } from '@/core';
import * as vscode from 'vscode';

export class ExtensionCore {
  private static instance: ExtensionCore;
  private coreServices?: Awaited<ReturnType<typeof VesperaCoreServices.initialize>>;
  
  private constructor() {}
  
  public static getInstance(): ExtensionCore {
    if (!ExtensionCore.instance) {
      ExtensionCore.instance = new ExtensionCore();
    }
    return ExtensionCore.instance;
  }
  
  public async initialize(
    context: vscode.ExtensionContext,
    config?: Partial<VesperaCoreServicesConfig>
  ): Promise<void> {
    const defaultConfig: VesperaCoreServicesConfig = {
      logging: {
        level: this.isDevelopment() ? 1 : 2,
        enableConsole: true,
        enableVSCodeOutput: true,
        enableStructuredLogging: true
      },
      memoryMonitoring: {
        enabled: true,
        thresholdMB: 150,
        checkIntervalMs: 30000
      },
      telemetry: {
        enabled: !this.isDevelopment() // Disable in dev
      }
    };
    
    const mergedConfig = { ...defaultConfig, ...config };
    
    this.coreServices = await VesperaCoreServices.initialize(context, mergedConfig);
    
    // Set up global error handling
    this.setupGlobalErrorHandling();
  }
  
  public getServices(): Awaited<ReturnType<typeof VesperaCoreServices.initialize>> {
    if (!this.coreServices) {
      throw new Error('ExtensionCore not initialized. Call initialize() first.');
    }
    return this.coreServices;
  }
  
  public isInitialized(): boolean {
    return this.coreServices !== undefined;
  }
  
  private setupGlobalErrorHandling(): void {
    if (!this.coreServices) return;
    
    const { logger, errorHandler } = this.coreServices;
    
    // Handle uncaught exceptions
    const handleUncaughtException = async (error: Error) => {
      logger.fatal('Uncaught exception in extension', error);
      await errorHandler.handleError(error);
    };
    
    // Handle unhandled promise rejections
    const handleUnhandledRejection = async (reason: any) => {
      logger.error('Unhandled promise rejection', reason);
      const error = reason instanceof Error ? reason : new Error(String(reason));
      await errorHandler.handleError(error);
    };
    
    process.on('uncaughtException', handleUncaughtException);
    process.on('unhandledRejection', handleUnhandledRejection);
  }
  
  private isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development' || 
           vscode.env.appName.includes('Insiders');
  }
  
  public async dispose(): Promise<void> {
    if (this.coreServices) {
      await this.coreServices.disposalManager.dispose();
      this.coreServices = undefined;
    }
  }
}
```

#### Usage in Extension

```typescript
// src/extension.ts
import { ExtensionCore } from './core/ExtensionCore';

let extensionCore: ExtensionCore;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  extensionCore = ExtensionCore.getInstance();
  
  await extensionCore.initialize(context, {
    // Extension-specific configuration
    memoryMonitoring: {
      thresholdMB: 200 // Higher threshold for data-heavy extension
    }
  });
  
  const { logger, errorHandler, contextManager } = extensionCore.getServices();
  
  // Initialize extension components
  await initializeComponents(context, extensionCore);
  
  logger.info('Extension activated successfully');
}

export async function deactivate(): Promise<void> {
  if (extensionCore) {
    await extensionCore.dispose();
  }
}
```

### Pattern: Service Injection

For components that need access to core services.

```typescript
// src/base/ServiceAwareComponent.ts
import { ExtensionCore } from '@/core/ExtensionCore';
import { VesperaLogger, VesperaErrorHandler, VesperaContextManager } from '@/core';

export abstract class ServiceAwareComponent {
  protected logger: VesperaLogger;
  protected errorHandler: VesperaErrorHandler;
  protected contextManager: VesperaContextManager;
  
  constructor() {
    const services = ExtensionCore.getInstance().getServices();
    this.logger = services.logger;
    this.errorHandler = services.errorHandler;
    this.contextManager = services.contextManager;
  }
  
  protected async handleError(error: Error | unknown, context?: Record<string, any>): Promise<void> {
    const vesperaError = error instanceof Error ? 
      VesperaError.fromError(error, this.getDefaultErrorCode(), context) :
      new VesperaError(String(error), this.getDefaultErrorCode(), VesperaSeverity.MEDIUM, context);
    
    await this.errorHandler.handleError(vesperaError);
  }
  
  protected abstract getDefaultErrorCode(): VesperaErrorCode;
}
```

#### Service-Aware Component Usage

```typescript
// src/providers/MyProvider.ts
import { ServiceAwareComponent } from '@/base/ServiceAwareComponent';
import { VesperaErrorCode } from '@/core';

export class MyProvider extends ServiceAwareComponent implements vscode.TreeDataProvider<MyItem> {
  constructor() {
    super();
    
    // Register self for memory tracking
    this.contextManager.registerResource(
      this,
      'MyProvider',
      `provider-${Date.now()}`
    );
  }
  
  async getChildren(element?: MyItem): Promise<MyItem[]> {
    this.logger.debug('Getting children', { element: element?.id });
    
    try {
      const items = await this.fetchItems(element);
      this.logger.info(`Retrieved ${items.length} items`);
      return items;
    } catch (error) {
      await this.handleError(error, { 
        component: 'MyProvider', 
        operation: 'getChildren',
        element: element?.id 
      });
      return [];
    }
  }
  
  protected getDefaultErrorCode(): VesperaErrorCode {
    return VesperaErrorCode.PROVIDER_REQUEST_FAILED;
  }
  
  async dispose(): Promise<void> {
    this.logger.debug('Disposing MyProvider');
    // Cleanup logic
  }
}
```

## Memory Management Integration

### Pattern: Resource Lifecycle Management

Comprehensive resource tracking and cleanup pattern.

```typescript
// src/base/ManagedResource.ts
import { DisposableResource } from '@/core';
import { ExtensionCore } from '@/core/ExtensionCore';

export abstract class ManagedResource implements DisposableResource {
  private disposed = false;
  private resourceId: string;
  protected logger = ExtensionCore.getInstance().getServices().logger;
  
  public readonly disposalPriority: number = 5; // Override in subclasses
  
  constructor(resourceType: string, customId?: string) {
    const contextManager = ExtensionCore.getInstance().getServices().contextManager;
    
    this.resourceId = contextManager.registerResource(
      this,
      resourceType,
      customId,
      this.getResourceMetadata()
    );
    
    this.logger.debug(`ManagedResource created: ${resourceType}:${this.resourceId}`);
  }
  
  protected getResourceMetadata(): Record<string, any> {
    return {
      createdAt: Date.now(),
      type: this.constructor.name
    };
  }
  
  async dispose(): Promise<void> {
    if (this.disposed) return;
    
    this.logger.debug(`Disposing ManagedResource: ${this.resourceId}`);
    
    try {
      await this.performDisposal();
      this.disposed = true;
      this.logger.debug(`ManagedResource disposed successfully: ${this.resourceId}`);
    } catch (error) {
      this.logger.error(`Error disposing ManagedResource: ${this.resourceId}`, error);
      // Don't rethrow - disposal should be resilient
    }
  }
  
  get isDisposed(): boolean {
    return this.disposed;
  }
  
  protected abstract performDisposal(): Promise<void>;
  
  protected updateResourceMetadata(metadata: Record<string, any>): void {
    const contextManager = ExtensionCore.getInstance().getServices().contextManager;
    contextManager.updateResourceMetadata(this.resourceId, {
      lastAccessedAt: Date.now(),
      ...metadata
    });
  }
}
```

#### Using Managed Resources

```typescript
// src/services/DataService.ts
import { ManagedResource } from '@/base/ManagedResource';

export class DataService extends ManagedResource {
  private eventListeners: vscode.Disposable[] = [];
  private timers: NodeJS.Timeout[] = [];
  private cache = new Map<string, any>();
  
  public readonly disposalPriority = 8; // High priority
  
  constructor() {
    super('DataService', 'main-data-service');
    this.initialize();
  }
  
  private initialize(): void {
    // Set up event listeners
    const configChangeListener = vscode.workspace.onDidChangeConfiguration(
      this.onConfigurationChanged.bind(this)
    );
    this.eventListeners.push(configChangeListener);
    
    // Set up periodic tasks
    const cacheCleanupTimer = setInterval(() => {
      this.cleanupCache();
    }, 300000); // 5 minutes
    this.timers.push(cacheCleanupTimer);
    
    this.logger.info('DataService initialized');
  }
  
  protected async performDisposal(): Promise<void> {
    // Clear timers
    this.timers.forEach(timer => clearInterval(timer));
    this.timers.length = 0;
    
    // Dispose event listeners
    this.eventListeners.forEach(listener => listener.dispose());
    this.eventListeners.length = 0;
    
    // Clear cache
    this.cache.clear();
    
    this.updateResourceMetadata({
      disposedAt: Date.now(),
      cacheSize: 0
    });
  }
  
  private onConfigurationChanged(e: vscode.ConfigurationChangeEvent): void {
    if (e.affectsConfiguration('myExtension')) {
      this.cache.clear();
      this.updateResourceMetadata({ 
        lastConfigChange: Date.now(),
        cacheSize: this.cache.size 
      });
    }
  }
  
  private cleanupCache(): void {
    const beforeSize = this.cache.size;
    // Cleanup logic...
    const afterSize = this.cache.size;
    
    if (beforeSize !== afterSize) {
      this.updateResourceMetadata({ 
        cacheSize: afterSize,
        lastCacheCleanup: Date.now()
      });
    }
  }
}
```

### Pattern: Context-Aware Components

Components that work with extension contexts safely.

```typescript
// src/base/ContextAwareComponent.ts
import { ExtensionCore } from '@/core/ExtensionCore';
import * as vscode from 'vscode';

export abstract class ContextAwareComponent {
  protected contextManager = ExtensionCore.getInstance().getServices().contextManager;
  protected logger = ExtensionCore.getInstance().getServices().logger;
  
  constructor(protected extensionContext: vscode.ExtensionContext) {}
  
  protected setViewContext(viewContext: any): void {
    this.contextManager.setViewContext(this.extensionContext, viewContext);
    this.logger.debug('View context set for component', {
      component: this.constructor.name
    });
  }
  
  protected getViewContext(): any {
    return this.contextManager.getViewContext(this.extensionContext);
  }
  
  protected registerContextResource<T extends DisposableResource>(
    resource: T,
    type: string,
    id?: string
  ): string {
    const resourceId = this.contextManager.registerResource(resource, type, id);
    this.logger.debug(`Context resource registered: ${type}:${resourceId}`);
    return resourceId;
  }
}
```

## Error Handling Integration

### Pattern: Domain-Specific Error Handlers

Creating specialized error handlers for different domains.

```typescript
// src/errors/DomainErrorHandler.ts
import { ExtensionCore } from '@/core/ExtensionCore';
import { 
  VesperaError, 
  VesperaErrorCode, 
  VesperaSeverity,
  ErrorHandlingStrategy 
} from '@/core';

export class DomainErrorHandler {
  private errorHandler = ExtensionCore.getInstance().getServices().errorHandler;
  private logger = ExtensionCore.getInstance().getServices().logger;
  
  constructor(private domain: string) {
    this.configureDomainStrategies();
  }
  
  private configureDomainStrategies(): void {
    // Configure strategies specific to this domain
    this.configureNetworkErrorStrategies();
    this.configureValidationErrorStrategies();
    this.configureUserInteractionErrorStrategies();
  }
  
  private configureNetworkErrorStrategies(): void {
    // Network errors - retry with backoff
    this.errorHandler.setStrategy(VesperaErrorCode.EXTERNAL_API_ERROR, {
      shouldLog: true,
      shouldNotifyUser: false, // Don't spam user during retries
      shouldThrow: false,
      shouldRetry: true,
      maxRetries: 3,
      retryDelay: 1000
    });
    
    // Rate limiting - longer retry delay
    this.errorHandler.setStrategy(VesperaErrorCode.SERVICE_RATE_LIMITED, {
      shouldLog: true,
      shouldNotifyUser: false,
      shouldThrow: false,
      shouldRetry: true,
      maxRetries: 5,
      retryDelay: 5000
    });
  }
  
  private configureValidationErrorStrategies(): void {
    // Validation errors - notify user, don't retry
    this.errorHandler.setStrategy(VesperaErrorCode.CONFIGURATION_VALIDATION_FAILED, {
      shouldLog: true,
      shouldNotifyUser: true,
      shouldThrow: true,
      shouldRetry: false
    });
  }
  
  private configureUserInteractionErrorStrategies(): void {
    // UI errors - log but don't interrupt user
    this.errorHandler.setStrategy(VesperaErrorCode.WEBVIEW_MESSAGE_FAILED, {
      shouldLog: true,
      shouldNotifyUser: false,
      shouldThrow: false,
      shouldRetry: true,
      maxRetries: 1,
      retryDelay: 100
    });
  }
  
  async handleDomainError(
    error: Error | unknown,
    operation: string,
    context?: Record<string, any>
  ): Promise<void> {
    const domainContext = {
      domain: this.domain,
      operation,
      ...context
    };
    
    let vesperaError: VesperaError;
    
    if (error instanceof VesperaError) {
      // Add domain context to existing VesperaError
      vesperaError = new VesperaError(
        error.message,
        error.code,
        error.severity,
        { ...error.metadata.context, ...domainContext }
      );
    } else if (error instanceof Error) {
      vesperaError = VesperaError.fromError(
        error,
        this.classifyError(error),
        domainContext
      );
    } else {
      vesperaError = new VesperaError(
        String(error),
        VesperaErrorCode.UNKNOWN_ERROR,
        VesperaSeverity.MEDIUM,
        domainContext
      );
    }
    
    this.logger.debug(`Handling domain error: ${this.domain}`, {
      operation,
      errorCode: vesperaError.code,
      severity: vesperaError.severity
    });
    
    await this.errorHandler.handleError(vesperaError);
  }
  
  private classifyError(error: Error): VesperaErrorCode {
    // Domain-specific error classification logic
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return VesperaErrorCode.EXTERNAL_API_ERROR;
    }
    
    if (message.includes('validation') || message.includes('invalid')) {
      return VesperaErrorCode.CONFIGURATION_VALIDATION_FAILED;
    }
    
    if (message.includes('permission') || message.includes('unauthorized')) {
      return VesperaErrorCode.PROVIDER_AUTHENTICATION_FAILED;
    }
    
    return VesperaErrorCode.UNKNOWN_ERROR;
  }
  
  async executeWithDomainHandling<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: Record<string, any>
  ): Promise<T> {
    try {
      const result = await operation();
      this.logger.debug(`Domain operation succeeded: ${operationName}`, context);
      return result;
    } catch (error) {
      await this.handleDomainError(error, operationName, context);
      throw error; // Re-throw after handling
    }
  }
}
```

#### Using Domain Error Handler

```typescript
// src/services/ApiService.ts
import { DomainErrorHandler } from '@/errors/DomainErrorHandler';
import { ManagedResource } from '@/base/ManagedResource';

export class ApiService extends ManagedResource {
  private domainErrorHandler = new DomainErrorHandler('api-service');
  
  constructor() {
    super('ApiService');
  }
  
  async fetchUserData(userId: string): Promise<UserData> {
    return this.domainErrorHandler.executeWithDomainHandling(
      async () => {
        const response = await fetch(`/api/users/${userId}`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
      },
      'fetchUserData',
      { userId }
    );
  }
  
  async updateUserData(userId: string, data: Partial<UserData>): Promise<void> {
    await this.domainErrorHandler.executeWithDomainHandling(
      async () => {
        const response = await fetch(`/api/users/${userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        
        if (!response.ok) {
          throw new Error(`Update failed: ${response.status}`);
        }
      },
      'updateUserData',
      { userId, dataKeys: Object.keys(data) }
    );
  }
  
  protected async performDisposal(): Promise<void> {
    // Cleanup API service resources
    this.logger.info('ApiService disposed');
  }
}
```

## Provider Integration Patterns

### Pattern: Enhanced VS Code Providers

Integrating quality improvements into VS Code providers.

```typescript
// src/base/EnhancedProvider.ts
import { ServiceAwareComponent } from '@/base/ServiceAwareComponent';
import { ManagedResource } from '@/base/ManagedResource';
import { VesperaErrorCode } from '@/core';
import * as vscode from 'vscode';

export abstract class EnhancedProvider 
  extends ServiceAwareComponent 
  implements DisposableResource 
{
  private disposed = false;
  private subscriptions: vscode.Disposable[] = [];
  private resourceId: string;
  
  public readonly disposalPriority = 7; // High priority for providers
  
  constructor(resourceType: string) {
    super();
    
    // Register with context manager
    this.resourceId = this.contextManager.registerResource(
      this,
      resourceType,
      `${resourceType.toLowerCase()}-${Date.now()}`
    );
    
    this.logger.info(`Enhanced provider initialized: ${resourceType}`);
  }
  
  protected addSubscription(subscription: vscode.Disposable): void {
    this.subscriptions.push(subscription);
  }
  
  protected async safeExecute<T>(
    operation: () => Promise<T>,
    operationName: string,
    defaultValue?: T
  ): Promise<T | undefined> {
    try {
      this.logger.debug(`Executing provider operation: ${operationName}`);
      const result = await operation();
      this.logger.debug(`Provider operation completed: ${operationName}`);
      return result;
    } catch (error) {
      await this.handleError(error, {
        provider: this.constructor.name,
        operation: operationName
      });
      
      return defaultValue;
    }
  }
  
  protected getDefaultErrorCode(): VesperaErrorCode {
    return VesperaErrorCode.PROVIDER_REQUEST_FAILED;
  }
  
  async dispose(): Promise<void> {
    if (this.disposed) return;
    
    this.logger.info(`Disposing enhanced provider: ${this.constructor.name}`);
    
    try {
      // Dispose all subscriptions
      this.subscriptions.forEach(sub => {
        try {
          sub.dispose();
        } catch (error) {
          this.logger.warn('Error disposing subscription', error);
        }
      });
      this.subscriptions.length = 0;
      
      // Perform custom disposal logic
      await this.performCustomDisposal();
      
      this.disposed = true;
      this.logger.info(`Enhanced provider disposed: ${this.constructor.name}`);
      
    } catch (error) {
      this.logger.error(`Error disposing provider: ${this.constructor.name}`, error);
    }
  }
  
  get isDisposed(): boolean {
    return this.disposed;
  }
  
  protected abstract performCustomDisposal(): Promise<void>;
}
```

#### Tree Data Provider Implementation

```typescript
// src/providers/EnhancedTreeProvider.ts
import { EnhancedProvider } from '@/base/EnhancedProvider';
import * as vscode from 'vscode';

export abstract class EnhancedTreeProvider<T> 
  extends EnhancedProvider 
  implements vscode.TreeDataProvider<T> 
{
  private _onDidChangeTreeData = new vscode.EventEmitter<T | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  
  constructor(resourceType: string) {
    super(resourceType);
    
    // Add the event emitter to subscriptions for cleanup
    this.addSubscription(this._onDidChangeTreeData);
  }
  
  refresh(element?: T): void {
    this.logger.debug('Refreshing tree data', { 
      element: element ? String(element) : 'root' 
    });
    this._onDidChangeTreeData.fire(element);
  }
  
  async getTreeItem(element: T): Promise<vscode.TreeItem> {
    return this.safeExecute(
      () => this.createTreeItem(element),
      'getTreeItem',
      new vscode.TreeItem('Error', vscode.TreeItemCollapsibleState.None)
    ) || new vscode.TreeItem('Error', vscode.TreeItemCollapsibleState.None);
  }
  
  async getChildren(element?: T): Promise<T[]> {
    return this.safeExecute(
      () => this.loadChildren(element),
      'getChildren',
      []
    ) || [];
  }
  
  async getParent(element: T): Promise<T | undefined> {
    return this.safeExecute(
      () => this.findParent(element),
      'getParent'
    );
  }
  
  // Abstract methods for implementation
  protected abstract createTreeItem(element: T): Promise<vscode.TreeItem>;
  protected abstract loadChildren(element?: T): Promise<T[]>;
  protected abstract findParent(element: T): Promise<T | undefined>;
  
  protected async performCustomDisposal(): Promise<void> {
    // Tree provider specific cleanup
    this.logger.debug('Tree provider custom disposal completed');
  }
}
```

#### Concrete Tree Provider Example

```typescript
// src/providers/TaskTreeProvider.ts
import { EnhancedTreeProvider } from './EnhancedTreeProvider';
import * as vscode from 'vscode';

interface TaskItem {
  id: string;
  title: string;
  status: 'todo' | 'doing' | 'done';
  children?: TaskItem[];
}

export class TaskTreeProvider extends EnhancedTreeProvider<TaskItem> {
  private tasks: TaskItem[] = [];
  
  constructor() {
    super('TaskTreeProvider');
    this.loadInitialData();
  }
  
  private async loadInitialData(): Promise<void> {
    await this.safeExecute(
      async () => {
        this.tasks = await this.fetchTasks();
        this.refresh();
      },
      'loadInitialData'
    );
  }
  
  protected async createTreeItem(element: TaskItem): Promise<vscode.TreeItem> {
    const item = new vscode.TreeItem(
      element.title,
      element.children?.length ? 
        vscode.TreeItemCollapsibleState.Collapsed : 
        vscode.TreeItemCollapsibleState.None
    );
    
    item.id = element.id;
    item.contextValue = `task-${element.status}`;
    item.tooltip = `Status: ${element.status}`;
    item.iconPath = this.getStatusIcon(element.status);
    
    return item;
  }
  
  protected async loadChildren(element?: TaskItem): Promise<TaskItem[]> {
    if (!element) {
      // Root level
      return this.tasks;
    }
    
    return element.children || [];
  }
  
  protected async findParent(element: TaskItem): Promise<TaskItem | undefined> {
    // Implement parent finding logic
    return this.findTaskParent(element, this.tasks);
  }
  
  private findTaskParent(target: TaskItem, tasks: TaskItem[]): TaskItem | undefined {
    for (const task of tasks) {
      if (task.children?.some(child => child.id === target.id)) {
        return task;
      }
      if (task.children) {
        const parent = this.findTaskParent(target, task.children);
        if (parent) return parent;
      }
    }
    return undefined;
  }
  
  private async fetchTasks(): Promise<TaskItem[]> {
    // Implement task fetching logic
    return [
      {
        id: '1',
        title: 'Project Setup',
        status: 'done',
        children: [
          { id: '1.1', title: 'Initialize repository', status: 'done' },
          { id: '1.2', title: 'Configure build system', status: 'done' }
        ]
      },
      {
        id: '2',
        title: 'Feature Development',
        status: 'doing',
        children: [
          { id: '2.1', title: 'Implement core logic', status: 'doing' },
          { id: '2.2', title: 'Add error handling', status: 'todo' }
        ]
      }
    ];
  }
  
  private getStatusIcon(status: string): vscode.ThemeIcon {
    switch (status) {
      case 'done':
        return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
      case 'doing':
        return new vscode.ThemeIcon('sync', new vscode.ThemeColor('charts.yellow'));
      case 'todo':
        return new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('charts.blue'));
      default:
        return new vscode.ThemeIcon('question');
    }
  }
}
```

## Service Layer Integration

### Pattern: Enhanced Service Architecture

Building robust service layers with quality improvements.

```typescript
// src/base/EnhancedService.ts
import { ManagedResource } from '@/base/ManagedResource';
import { DomainErrorHandler } from '@/errors/DomainErrorHandler';

export abstract class EnhancedService extends ManagedResource {
  protected domainErrorHandler: DomainErrorHandler;
  protected isInitialized = false;
  
  constructor(serviceName: string) {
    super(serviceName, `${serviceName.toLowerCase()}-service`);
    this.domainErrorHandler = new DomainErrorHandler(serviceName.toLowerCase());
  }
  
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn(`Service already initialized: ${this.constructor.name}`);
      return;
    }
    
    await this.domainErrorHandler.executeWithDomainHandling(
      async () => {
        await this.performInitialization();
        this.isInitialized = true;
        this.logger.info(`Service initialized: ${this.constructor.name}`);
      },
      'initialize'
    );
  }
  
  protected async executeServiceOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: Record<string, any>
  ): Promise<T> {
    this.ensureInitialized();
    
    return this.domainErrorHandler.executeWithDomainHandling(
      operation,
      operationName,
      { service: this.constructor.name, ...context }
    );
  }
  
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error(`Service not initialized: ${this.constructor.name}`);
    }
  }
  
  protected abstract performInitialization(): Promise<void>;
}
```

#### HTTP Service Implementation

```typescript
// src/services/HttpService.ts
import { EnhancedService } from '@/base/EnhancedService';

export class HttpService extends EnhancedService {
  private baseUrl: string;
  private defaultHeaders: Record<string, string> = {};
  private timeout: number = 30000;
  
  constructor(baseUrl: string) {
    super('HttpService');
    this.baseUrl = baseUrl;
  }
  
  protected async performInitialization(): Promise<void> {
    // Set up default headers, authentication, etc.
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'MyVSCodeExtension/1.0.0'
    };
    
    // Test connectivity
    await this.testConnection();
  }
  
  private async testConnection(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: this.defaultHeaders,
        signal: AbortSignal.timeout(5000)
      });
      
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }
    } catch (error) {
      throw new Error(`Service unavailable: ${error.message}`);
    }
  }
  
  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.executeServiceOperation(
      async () => {
        const response = await this.makeRequest('GET', endpoint, undefined, options);
        return await response.json();
      },
      'get',
      { endpoint }
    );
  }
  
  async post<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.executeServiceOperation(
      async () => {
        const response = await this.makeRequest('POST', endpoint, data, options);
        return await response.json();
      },
      'post',
      { endpoint, hasData: !!data }
    );
  }
  
  async put<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.executeServiceOperation(
      async () => {
        const response = await this.makeRequest('PUT', endpoint, data, options);
        return await response.json();
      },
      'put',
      { endpoint, hasData: !!data }
    );
  }
  
  async delete(endpoint: string, options?: RequestOptions): Promise<void> {
    await this.executeServiceOperation(
      async () => {
        await this.makeRequest('DELETE', endpoint, undefined, options);
      },
      'delete',
      { endpoint }
    );
  }
  
  private async makeRequest(
    method: string,
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = { ...this.defaultHeaders, ...options?.headers };
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options?.timeout || this.timeout);
    
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  setAuthToken(token: string): void {
    this.defaultHeaders['Authorization'] = `Bearer ${token}`;
    this.logger.info('Authentication token updated');
  }
  
  protected async performDisposal(): Promise<void> {
    // Cleanup HTTP service resources
    this.defaultHeaders = {};
    this.logger.info('HttpService disposed');
  }
}

interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
}
```

### Pattern: Service Registry

Managing multiple services with dependencies.

```typescript
// src/services/ServiceRegistry.ts
import { ExtensionCore } from '@/core/ExtensionCore';
import { EnhancedService } from '@/base/EnhancedService';

export class ServiceRegistry {
  private static instance: ServiceRegistry;
  private services = new Map<string, EnhancedService>();
  private dependencies = new Map<string, string[]>();
  private logger = ExtensionCore.getInstance().getServices().logger;
  
  private constructor() {}
  
  public static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }
  
  register<T extends EnhancedService>(
    name: string,
    service: T,
    dependencies: string[] = []
  ): void {
    this.services.set(name, service);
    this.dependencies.set(name, dependencies);
    this.logger.info(`Service registered: ${name}`, { dependencies });
  }
  
  get<T extends EnhancedService>(name: string): T {
    const service = this.services.get(name) as T;
    if (!service) {
      throw new Error(`Service not found: ${name}`);
    }
    return service;
  }
  
  async initializeAll(): Promise<void> {
    const initOrder = this.getInitializationOrder();
    
    this.logger.info('Initializing services in order', { order: initOrder });
    
    for (const serviceName of initOrder) {
      const service = this.services.get(serviceName);
      if (service) {
        await service.initialize();
      }
    }
    
    this.logger.info('All services initialized');
  }
  
  private getInitializationOrder(): string[] {
    const visited = new Set<string>();
    const temp = new Set<string>();
    const result: string[] = [];
    
    const visit = (name: string) => {
      if (temp.has(name)) {
        throw new Error(`Circular dependency detected involving: ${name}`);
      }
      
      if (!visited.has(name)) {
        temp.add(name);
        
        const deps = this.dependencies.get(name) || [];
        for (const dep of deps) {
          visit(dep);
        }
        
        temp.delete(name);
        visited.add(name);
        result.push(name);
      }
    };
    
    for (const serviceName of this.services.keys()) {
      visit(serviceName);
    }
    
    return result;
  }
  
  async disposeAll(): Promise<void> {
    const disposeOrder = this.getInitializationOrder().reverse();
    
    this.logger.info('Disposing services in order', { order: disposeOrder });
    
    for (const serviceName of disposeOrder) {
      const service = this.services.get(serviceName);
      if (service) {
        try {
          await service.dispose();
        } catch (error) {
          this.logger.error(`Error disposing service: ${serviceName}`, error);
        }
      }
    }
    
    this.services.clear();
    this.dependencies.clear();
    this.logger.info('All services disposed');
  }
}
```

#### Using Service Registry

```typescript
// src/services/index.ts
import { ServiceRegistry } from './ServiceRegistry';
import { HttpService } from './HttpService';
import { ConfigurationService } from './ConfigurationService';
import { CacheService } from './CacheService';

export async function initializeServices(): Promise<void> {
  const registry = ServiceRegistry.getInstance();
  
  // Register services with dependencies
  registry.register('config', new ConfigurationService());
  registry.register('http', new HttpService('https://api.example.com'), ['config']);
  registry.register('cache', new CacheService(), ['config']);
  
  // Initialize all services in dependency order
  await registry.initializeAll();
}

export function getService<T extends EnhancedService>(name: string): T {
  return ServiceRegistry.getInstance().get<T>(name);
}

export async function disposeServices(): Promise<void> {
  await ServiceRegistry.getInstance().disposeAll();
}
```

## Configuration Management Integration

### Pattern: Type-Safe Configuration

Enhanced configuration management with validation and error handling.

```typescript
// src/configuration/ConfigurationManager.ts
import { EnhancedService } from '@/base/EnhancedService';
import { VesperaErrorCode } from '@/core';
import * as vscode from 'vscode';

export interface ExtensionConfiguration {
  api: {
    baseUrl: string;
    timeout: number;
    retryAttempts: number;
  };
  ui: {
    theme: 'light' | 'dark' | 'auto';
    enableAnimations: boolean;
    compactMode: boolean;
  };
  features: {
    enableAdvancedFeatures: boolean;
    debugMode: boolean;
    telemetryEnabled: boolean;
  };
}

export class ConfigurationManager extends EnhancedService {
  private configuration: ExtensionConfiguration;
  private configurationSchema: any; // JSON Schema for validation
  
  constructor() {
    super('ConfigurationManager');
  }
  
  protected async performInitialization(): Promise<void> {
    this.loadConfigurationSchema();
    await this.loadConfiguration();
    this.setupConfigurationWatcher();
  }
  
  private loadConfigurationSchema(): void {
    this.configurationSchema = {
      type: 'object',
      properties: {
        api: {
          type: 'object',
          properties: {
            baseUrl: { type: 'string', format: 'uri' },
            timeout: { type: 'number', minimum: 1000 },
            retryAttempts: { type: 'number', minimum: 0, maximum: 10 }
          },
          required: ['baseUrl', 'timeout', 'retryAttempts']
        },
        ui: {
          type: 'object',
          properties: {
            theme: { type: 'string', enum: ['light', 'dark', 'auto'] },
            enableAnimations: { type: 'boolean' },
            compactMode: { type: 'boolean' }
          },
          required: ['theme', 'enableAnimations', 'compactMode']
        },
        features: {
          type: 'object',
          properties: {
            enableAdvancedFeatures: { type: 'boolean' },
            debugMode: { type: 'boolean' },
            telemetryEnabled: { type: 'boolean' }
          },
          required: ['enableAdvancedFeatures', 'debugMode', 'telemetryEnabled']
        }
      },
      required: ['api', 'ui', 'features']
    };
  }
  
  private async loadConfiguration(): Promise<void> {
    await this.executeServiceOperation(
      async () => {
        const config = vscode.workspace.getConfiguration('myExtension');
        
        const rawConfig = {
          api: {
            baseUrl: config.get<string>('api.baseUrl', 'https://api.example.com'),
            timeout: config.get<number>('api.timeout', 30000),
            retryAttempts: config.get<number>('api.retryAttempts', 3)
          },
          ui: {
            theme: config.get<'light' | 'dark' | 'auto'>('ui.theme', 'auto'),
            enableAnimations: config.get<boolean>('ui.enableAnimations', true),
            compactMode: config.get<boolean>('ui.compactMode', false)
          },
          features: {
            enableAdvancedFeatures: config.get<boolean>('features.enableAdvancedFeatures', true),
            debugMode: config.get<boolean>('features.debugMode', false),
            telemetryEnabled: config.get<boolean>('features.telemetryEnabled', true)
          }
        };
        
        this.validateConfiguration(rawConfig);
        this.configuration = rawConfig;
        
        this.logger.info('Configuration loaded successfully', {
          configKeys: Object.keys(this.configuration)
        });
      },
      'loadConfiguration'
    );
  }
  
  private validateConfiguration(config: any): void {
    // In a real implementation, use a JSON Schema validator like Ajv
    if (!config.api || !config.ui || !config.features) {
      throw new Error('Configuration missing required sections');
    }
    
    if (!config.api.baseUrl || typeof config.api.baseUrl !== 'string') {
      throw new Error('Invalid API base URL configuration');
    }
    
    if (!config.api.timeout || config.api.timeout < 1000) {
      throw new Error('API timeout must be at least 1000ms');
    }
    
    if (!['light', 'dark', 'auto'].includes(config.ui.theme)) {
      throw new Error('Invalid UI theme configuration');
    }
  }
  
  private setupConfigurationWatcher(): void {
    const subscription = vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration('myExtension')) {
        this.logger.info('Configuration change detected, reloading...');
        
        try {
          await this.loadConfiguration();
          this.onConfigurationChanged();
        } catch (error) {
          await this.domainErrorHandler.handleDomainError(
            error,
            'configurationReload'
          );
        }
      }
    });
    
    // Add to managed subscriptions
    this.addSubscription(subscription);
  }
  
  private onConfigurationChanged(): void {
    // Emit configuration change event
    this.logger.info('Configuration reloaded successfully');
  }
  
  private addSubscription(subscription: vscode.Disposable): void {
    // This would be implemented in the base class or tracked separately
    ExtensionCore.getInstance().getServices().contextManager.registerResource(
      subscription,
      'ConfigurationSubscription'
    );
  }
  
  public get<K extends keyof ExtensionConfiguration>(
    key: K
  ): ExtensionConfiguration[K] {
    this.ensureInitialized();
    return this.configuration[key];
  }
  
  public getApiConfig(): ExtensionConfiguration['api'] {
    return this.get('api');
  }
  
  public getUiConfig(): ExtensionConfiguration['ui'] {
    return this.get('ui');
  }
  
  public getFeaturesConfig(): ExtensionConfiguration['features'] {
    return this.get('features');
  }
  
  public async updateConfiguration<K extends keyof ExtensionConfiguration>(
    key: K,
    value: Partial<ExtensionConfiguration[K]>
  ): Promise<void> {
    await this.executeServiceOperation(
      async () => {
        const config = vscode.workspace.getConfiguration('myExtension');
        
        // Update VS Code configuration
        for (const [subKey, subValue] of Object.entries(value)) {
          await config.update(`${key}.${subKey}`, subValue, vscode.ConfigurationTarget.Global);
        }
        
        this.logger.info(`Configuration updated: ${key}`, { value });
      },
      'updateConfiguration',
      { key, value }
    );
  }
  
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('ConfigurationManager not initialized');
    }
  }
  
  protected async performDisposal(): Promise<void> {
    // Configuration cleanup
    this.logger.info('ConfigurationManager disposed');
  }
}
```

## Testing Integration

### Pattern: Test Utilities for Quality Improvements

Utilities for testing code with quality improvements.

```typescript
// tests/utils/TestUtils.ts
import { ExtensionCore } from '@/core/ExtensionCore';
import { VesperaLogger } from '@/core/logging/VesperaLogger';
import * as vscode from 'vscode';

export class TestUtils {
  private static extensionCore: ExtensionCore;
  
  static async setupTestEnvironment(): Promise<void> {
    // Initialize extension core for testing
    TestUtils.extensionCore = ExtensionCore.getInstance();
    
    const mockContext = TestUtils.createMockExtensionContext();
    await TestUtils.extensionCore.initialize(mockContext, {
      logging: { level: 0 }, // TRACE level for detailed testing
      memoryMonitoring: { enabled: false }, // Disable for testing
      telemetry: { enabled: false } // Disable for testing
    });
  }
  
  static async teardownTestEnvironment(): Promise<void> {
    if (TestUtils.extensionCore) {
      await TestUtils.extensionCore.dispose();
    }
  }
  
  static getCoreServices() {
    return TestUtils.extensionCore.getServices();
  }
  
  static createMockExtensionContext(): vscode.ExtensionContext {
    return {
      subscriptions: [],
      workspaceState: {
        get: jest.fn(),
        update: jest.fn(),
        keys: jest.fn().mockReturnValue([])
      },
      globalState: {
        get: jest.fn(),
        update: jest.fn(),
        setKeysForSync: jest.fn(),
        keys: jest.fn().mockReturnValue([])
      },
      secrets: {
        get: jest.fn(),
        store: jest.fn(),
        delete: jest.fn(),
        onDidChange: jest.fn()
      },
      extensionUri: vscode.Uri.file('/test/extension'),
      extensionPath: '/test/extension',
      environmentVariableCollection: {
        persistent: true,
        get: jest.fn(),
        forEach: jest.fn(),
        replace: jest.fn(),
        append: jest.fn(),
        prepend: jest.fn(),
        delete: jest.fn(),
        clear: jest.fn()
      },
      asAbsolutePath: jest.fn((relativePath) => `/test/extension/${relativePath}`),
      storageUri: vscode.Uri.file('/test/storage'),
      storagePath: '/test/storage',
      globalStorageUri: vscode.Uri.file('/test/global-storage'),
      globalStoragePath: '/test/global-storage',
      logUri: vscode.Uri.file('/test/logs'),
      logPath: '/test/logs',
      extensionMode: 1 // Development
    } as vscode.ExtensionContext;
  }
  
  static async measurePerformance<T>(
    operation: () => Promise<T>,
    expectedMaxTime?: number
  ): Promise<{ result: T; duration: number }> {
    const startTime = performance.now();
    const result = await operation();
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    if (expectedMaxTime && duration > expectedMaxTime) {
      throw new Error(`Operation took ${duration}ms, expected max ${expectedMaxTime}ms`);
    }
    
    return { result, duration };
  }
  
  static createMockLogger(): VesperaLogger {
    return {
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      getLogStats: jest.fn().mockReturnValue({
        totalLogs: 0,
        logsByLevel: {},
        recentLogs: []
      }),
      dispose: jest.fn()
    } as any;
  }
  
  static async waitFor(
    condition: () => boolean | Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const result = await condition();
      if (result) {
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }
}
```

#### Using Test Utilities

```typescript
// tests/integration/MyService.test.ts
import { TestUtils } from '../utils/TestUtils';
import { MyService } from '@/services/MyService';

describe('MyService Integration', () => {
  beforeAll(async () => {
    await TestUtils.setupTestEnvironment();
  });
  
  afterAll(async () => {
    await TestUtils.teardownTestEnvironment();
  });
  
  test('service integrates with core services correctly', async () => {
    const coreServices = TestUtils.getCoreServices();
    const myService = new MyService();
    
    // Test initialization
    await myService.initialize();
    expect(myService.isInitialized).toBe(true);
    
    // Test error handling integration
    const errorHandler = coreServices.errorHandler;
    const errorSpy = jest.spyOn(errorHandler, 'handleError');
    
    // Trigger an error
    try {
      await myService.methodThatMightFail();
    } catch (error) {
      // Expected
    }
    
    expect(errorSpy).toHaveBeenCalled();
    
    // Test disposal
    await myService.dispose();
    expect(myService.isDisposed).toBe(true);
  });
  
  test('service performance meets requirements', async () => {
    const myService = new MyService();
    await myService.initialize();
    
    const { result, duration } = await TestUtils.measurePerformance(
      () => myService.performExpensiveOperation(),
      1000 // Max 1 second
    );
    
    expect(result).toBeDefined();
    expect(duration).toBeLessThan(1000);
    
    await myService.dispose();
  });
});
```

## Cross-Extension Patterns

### Pattern: Shared Core Services

Sharing core services across multiple extensions.

```typescript
// src/shared/SharedCoreServices.ts
export class SharedCoreServices {
  private static globalInstance: VesperaCoreServices;
  private static referenceCount = 0;
  
  static async acquire(
    context: vscode.ExtensionContext,
    config?: VesperaCoreServicesConfig
  ): Promise<VesperaCoreServices> {
    if (!SharedCoreServices.globalInstance) {
      SharedCoreServices.globalInstance = await VesperaCoreServices.initialize(
        context,
        config
      );
    }
    
    SharedCoreServices.referenceCount++;
    return SharedCoreServices.globalInstance;
  }
  
  static async release(): Promise<void> {
    SharedCoreServices.referenceCount--;
    
    if (SharedCoreServices.referenceCount <= 0) {
      if (SharedCoreServices.globalInstance) {
        await SharedCoreServices.globalInstance.disposalManager.dispose();
        SharedCoreServices.globalInstance = undefined;
      }
      SharedCoreServices.referenceCount = 0;
    }
  }
  
  static isAvailable(): boolean {
    return SharedCoreServices.globalInstance !== undefined;
  }
}
```

### Pattern: Extension Communication

Communication between extensions using quality improvements.

```typescript
// src/communication/ExtensionCommunication.ts
import { ExtensionCore } from '@/core/ExtensionCore';

export class ExtensionCommunication {
  private logger = ExtensionCore.getInstance().getServices().logger;
  private errorHandler = ExtensionCore.getInstance().getServices().errorHandler;
  
  async sendMessage<T>(
    targetExtensionId: string,
    command: string,
    data?: any
  ): Promise<T> {
    try {
      this.logger.debug('Sending inter-extension message', {
        target: targetExtensionId,
        command,
        hasData: !!data
      });
      
      const result = await vscode.commands.executeCommand(
        `${targetExtensionId}.${command}`,
        data
      );
      
      this.logger.debug('Inter-extension message sent successfully');
      return result;
      
    } catch (error) {
      await this.errorHandler.handleError(
        VesperaError.fromError(
          error,
          VesperaErrorCode.EXTERNAL_API_ERROR,
          { targetExtension: targetExtensionId, command }
        )
      );
      
      throw error;
    }
  }
  
  registerMessageHandler<T>(
    command: string,
    handler: (data: any) => Promise<T> | T
  ): vscode.Disposable {
    const fullCommand = `myExtension.${command}`;
    
    this.logger.info(`Registering message handler: ${fullCommand}`);
    
    return vscode.commands.registerCommand(fullCommand, async (data) => {
      try {
        this.logger.debug(`Handling inter-extension message: ${command}`, {
          hasData: !!data
        });
        
        const result = await handler(data);
        
        this.logger.debug(`Message handled successfully: ${command}`);
        return result;
        
      } catch (error) {
        await this.errorHandler.handleError(
          VesperaError.fromError(
            error,
            VesperaErrorCode.PROVIDER_REQUEST_FAILED,
            { command, data }
          )
        );
        
        throw error;
      }
    });
  }
}
```

## Migration Strategies

### Strategy: Incremental Adoption

Gradually adopting quality improvements in existing extensions.

```typescript
// src/migration/IncrementalMigration.ts
export class IncrementalMigration {
  private static migrationPhases = [
    'core-services',
    'memory-management',
    'error-handling',
    'provider-enhancement',
    'testing-integration'
  ];
  
  static async executeMigrationPhase(
    phase: string,
    context: vscode.ExtensionContext
  ): Promise<void> {
    switch (phase) {
      case 'core-services':
        await IncrementalMigration.migrateCoreServices(context);
        break;
      case 'memory-management':
        await IncrementalMigration.migrateMemoryManagement();
        break;
      case 'error-handling':
        await IncrementalMigration.migrateErrorHandling();
        break;
      case 'provider-enhancement':
        await IncrementalMigration.migrateProviders();
        break;
      case 'testing-integration':
        await IncrementalMigration.migrateTestingFramework();
        break;
      default:
        throw new Error(`Unknown migration phase: ${phase}`);
    }
  }
  
  private static async migrateCoreServices(
    context: vscode.ExtensionContext
  ): Promise<void> {
    // Initialize core services alongside existing systems
    const extensionCore = ExtensionCore.getInstance();
    await extensionCore.initialize(context);
    
    console.log('✅ Core services migration completed');
  }
  
  private static async migrateMemoryManagement(): Promise<void> {
    // Convert global variables to context manager storage
    // Register existing resources with context manager
    console.log('✅ Memory management migration completed');
  }
  
  private static async migrateErrorHandling(): Promise<void> {
    // Replace console.error with centralized error handler
    // Configure error strategies
    console.log('✅ Error handling migration completed');
  }
  
  private static async migrateProviders(): Promise<void> {
    // Enhance existing providers with base classes
    console.log('✅ Provider enhancement migration completed');
  }
  
  private static async migrateTestingFramework(): Promise<void> {
    // Integrate testing utilities
    console.log('✅ Testing integration migration completed');
  }
}
```

## Best Practices

### Best Practice: Component Architecture

```typescript
// Recommended component structure
export abstract class WellArchitectedComponent 
  extends ServiceAwareComponent 
  implements DisposableResource {
  
  // 1. Clear inheritance hierarchy
  // 2. Service injection via base class
  // 3. Memory management via DisposableResource
  // 4. Error handling via ServiceAwareComponent
  // 5. Logging integration
  
  protected async safeAsyncOperation<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T | undefined> {
    try {
      this.logger.debug(`Starting operation: ${operationName}`);
      const result = await operation();
      this.logger.debug(`Operation completed: ${operationName}`);
      return result;
    } catch (error) {
      await this.handleError(error, {
        component: this.constructor.name,
        operation: operationName
      });
      return undefined;
    }
  }
}
```

### Best Practice: Configuration

```typescript
// Type-safe configuration with validation
interface ComponentConfiguration {
  enabled: boolean;
  settings: {
    timeout: number;
    retries: number;
    advanced: {
      debugMode: boolean;
      performanceMonitoring: boolean;
    };
  };
}

class ConfigurableComponent {
  private config: ComponentConfiguration;
  
  constructor(config: ComponentConfiguration) {
    this.validateConfiguration(config);
    this.config = config;
  }
  
  private validateConfiguration(config: ComponentConfiguration): void {
    if (config.settings.timeout < 1000) {
      throw new Error('Timeout must be at least 1000ms');
    }
    
    if (config.settings.retries < 0 || config.settings.retries > 10) {
      throw new Error('Retries must be between 0 and 10');
    }
  }
}
```

### Best Practice: Error Boundaries

```typescript
// Create error boundaries for different subsystems
export class ErrorBoundary {
  constructor(private domainErrorHandler: DomainErrorHandler) {}
  
  async withErrorBoundary<T>(
    operation: () => Promise<T>,
    fallback: () => T,
    context?: Record<string, any>
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      await this.domainErrorHandler.handleDomainError(
        error,
        'boundaryOperation',
        context
      );
      
      return fallback();
    }
  }
}
```

### Best Practice: Resource Management

```typescript
// Use RAII pattern for resource management
export class ResourceManager {
  static async withResource<TResource extends DisposableResource, TResult>(
    resourceFactory: () => Promise<TResource>,
    operation: (resource: TResource) => Promise<TResult>
  ): Promise<TResult> {
    const resource = await resourceFactory();
    
    try {
      return await operation(resource);
    } finally {
      await resource.dispose();
    }
  }
}

// Usage
const result = await ResourceManager.withResource(
  () => Promise.resolve(new MyManagedResource()),
  async (resource) => {
    return await resource.performOperation();
  }
);
```

## Conclusion

These integration patterns provide a comprehensive framework for adopting the code quality improvements from Vespera Forge. The patterns are designed to be:

1. **Incremental**: Can be adopted gradually without breaking existing functionality
2. **Composable**: Different patterns can be combined as needed
3. **Type-Safe**: Full TypeScript support with strong typing
4. **Testable**: Built-in support for comprehensive testing
5. **Maintainable**: Clear separation of concerns and consistent architecture

Start with the core services integration pattern and gradually adopt additional patterns based on your extension's specific needs and complexity requirements.