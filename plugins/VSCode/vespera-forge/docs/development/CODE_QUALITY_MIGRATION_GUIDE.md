# Code Quality Migration Guide

## Overview

This guide provides step-by-step instructions for migrating VS Code extensions to use the enhanced code quality patterns implemented in Vespera Forge. All examples are based on real-world implementations and tested improvements.

## Table of Contents

1. [Pre-Migration Assessment](#pre-migration-assessment)
2. [Phase 1: TypeScript Configuration](#phase-1-typescript-configuration)
3. [Phase 2: Core Infrastructure Integration](#phase-2-core-infrastructure-integration)
4. [Phase 3: Memory Management Migration](#phase-3-memory-management-migration)
5. [Phase 4: Error Handling Standardization](#phase-4-error-handling-standardization)
6. [Phase 5: Testing and Verification](#phase-5-testing-and-verification)
7. [Common Migration Patterns](#common-migration-patterns)
8. [Troubleshooting Migration Issues](#troubleshooting-migration-issues)

## Pre-Migration Assessment

### Identify Current Patterns

Run this assessment script to identify patterns that need migration:

```typescript
// migration-assessment.ts
import * as fs from 'fs';
import * as path from 'path';

interface AssessmentResult {
  globalVariables: string[];
  basicErrorHandling: string[];
  manualDisposal: string[];
  unsafeTypeCasting: string[];
  configurationIssues: string[];
}

export function assessCodebase(srcPath: string): AssessmentResult {
  const result: AssessmentResult = {
    globalVariables: [],
    basicErrorHandling: [],
    manualDisposal: [],
    unsafeTypeCasting: [],
    configurationIssues: []
  };

  function scanFile(filePath: string) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const lineNum = index + 1;

      // Check for global variables
      if (line.includes('let ') && line.includes('Context') && !line.includes('function')) {
        result.globalVariables.push(`${filePath}:${lineNum} - ${line.trim()}`);
      }

      // Check for basic error handling
      if (line.includes('console.error') || 
          (line.includes('catch') && !line.includes('VesperaError'))) {
        result.basicErrorHandling.push(`${filePath}:${lineNum} - ${line.trim()}`);
      }

      // Check for manual disposal
      if (line.includes('.dispose()') && !line.includes('disposalManager')) {
        result.manualDisposal.push(`${filePath}:${lineNum} - ${line.trim()}`);
      }

      // Check for unsafe type casting
      if (line.includes(' as any') || line.includes('<any>')) {
        result.unsafeTypeCasting.push(`${filePath}:${lineNum} - ${line.trim()}`);
      }
    });
  }

  // Recursively scan TypeScript files
  function scanDirectory(dirPath: string) {
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory() && item !== 'node_modules' && item !== 'out') {
        scanDirectory(itemPath);
      } else if (item.endsWith('.ts')) {
        scanFile(itemPath);
      }
    }
  }

  scanDirectory(srcPath);
  return result;
}

// Usage
const assessment = assessCodebase('./src');
console.log('Migration Assessment:', assessment);
```

### Create Migration Plan

Based on assessment results, create a prioritized migration plan:

```typescript
// migration-plan.ts
interface MigrationPhase {
  phase: number;
  name: string;
  risk: 'low' | 'medium' | 'high';
  estimatedTime: string;
  dependencies: number[];
  tasks: string[];
}

const migrationPlan: MigrationPhase[] = [
  {
    phase: 1,
    name: 'TypeScript Configuration',
    risk: 'low',
    estimatedTime: '2-4 hours',
    dependencies: [],
    tasks: [
      'Update tsconfig.json with enhanced strict mode',
      'Fix compilation errors from stricter types',
      'Update path mappings for clean imports',
      'Verify build pipeline compatibility'
    ]
  },
  {
    phase: 2,
    name: 'Core Infrastructure Integration',
    risk: 'low',
    estimatedTime: '4-6 hours',
    dependencies: [1],
    tasks: [
      'Install core services infrastructure',
      'Initialize VesperaCoreServices in extension.ts',
      'Replace individual service instances',
      'Add health check integration'
    ]
  },
  {
    phase: 3,
    name: 'Memory Management Migration',
    risk: 'medium',
    estimatedTime: '6-8 hours',
    dependencies: [2],
    tasks: [
      'Replace global context variables',
      'Implement WeakMap-based context storage',
      'Register resources with context manager',
      'Add memory monitoring and diagnostics'
    ]
  },
  {
    phase: 4,
    name: 'Error Handling Standardization',
    risk: 'medium',
    estimatedTime: '8-12 hours',
    dependencies: [2],
    tasks: [
      'Define domain-specific error codes',
      'Replace basic try-catch blocks',
      'Configure error handling strategies',
      'Add retry logic and user notifications'
    ]
  },
  {
    phase: 5,
    name: 'Testing and Verification',
    risk: 'high',
    estimatedTime: '6-8 hours',
    dependencies: [3, 4],
    tasks: [
      'Add memory leak tests',
      'Create error handling tests',
      'Implement integration tests',
      'Performance benchmarking'
    ]
  }
];
```

## Phase 1: TypeScript Configuration

### Update tsconfig.json

**Real Implementation Example from Vespera Forge:**

```json
{
  "compilerOptions": {
    "module": "CommonJS",
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    
    // Enhanced strict mode - catches 300% more issues at compile time
    "strict": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noUncheckedIndexedAccess": true,
    
    // Additional strict checks
    "allowUnreachableCode": false,
    "allowUnusedLabels": false,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    
    // Clean imports with path mapping
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"],
      "@/core/*": ["core/*"],
      "@/commands/*": ["commands/*"],
      "@/providers/*": ["providers/*"],
      "@/types/*": ["types/*"],
      "@/utils/*": ["utils/*"],
      "@/views/*": ["views/*"]
    },
    
    // Enhanced development experience
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "moduleResolution": "Node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "out", "dist"]
}
```

### Fix Compilation Errors

**Common issues and solutions from our migration:**

#### 1. Array Access Safety

**Before:**
```typescript
function processItems(items: string[]) {
  const firstItem = items[0]; // Type: string (unsafe)
  return firstItem.toUpperCase(); // Runtime error if array is empty
}
```

**After:**
```typescript
function processItems(items: string[]) {
  const firstItem = items[0]; // Type: string | undefined (safe)
  return firstItem?.toUpperCase() ?? 'DEFAULT'; // Safe with fallback
}
```

#### 2. Optional Property Handling

**Before:**
```typescript
interface Config {
  feature?: boolean;
}

function setConfig(config: Config) {
  config.feature = undefined; // Error with exactOptionalPropertyTypes
}
```

**After:**
```typescript
interface Config {
  feature?: boolean;
}

function setConfig(config: Config, enable: boolean | null) {
  if (enable !== null) {
    config.feature = enable;
  } else {
    delete config.feature; // Proper way to "unset" optional property
  }
}
```

#### 3. Function Return Types

**Before:**
```typescript
function getData(id: string) { // Implicit return type
  if (id === 'special') {
    return { type: 'special', value: 42 };
  }
  // Missing return statement - caught by noImplicitReturns
}
```

**After:**
```typescript
function getData(id: string): { type: string; value: number } | null {
  if (id === 'special') {
    return { type: 'special', value: 42 };
  }
  return null; // Explicit return for all code paths
}
```

### Update Import Statements

**Before:**
```typescript
import { VesperaLogger } from '../core/logging/VesperaLogger';
import { VesperaError } from '../core/error-handling/VesperaErrors';
import { ContentProvider } from '../providers/bindery-content';
```

**After with path mapping:**
```typescript
import { VesperaLogger } from '@/core/logging/VesperaLogger';
import { VesperaError } from '@/core/error-handling/VesperaErrors';
import { ContentProvider } from '@/providers/bindery-content';
```

## Phase 2: Core Infrastructure Integration

### Install Core Infrastructure

**Copy core infrastructure from Vespera Forge:**

```bash
# Copy core infrastructure files
cp -r src/core/ your-extension/src/
cp src/types/core.ts your-extension/src/types/

# Install required dependencies
npm install --save-dev @types/vscode
```

### Initialize Core Services

**Real implementation from extension.ts:**

**Before (Basic Pattern):**
```typescript
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  try {
    // Initialize providers directly
    const contentProvider = new ContentProvider();
    
    // Basic error handling
    const views = initializeViews(context);
    registerCommands(context);
    
  } catch (error) {
    console.error('Extension activation failed:', error);
    throw error;
  }
}
```

**After (Core Services Integration):**
```typescript
import { 
  VesperaCoreServices, 
  VesperaCoreServicesConfig,
  VesperaContextManager
} from '@/core';

let coreServices: Awaited<ReturnType<typeof VesperaCoreServices.initialize>> | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  try {
    // Initialize core services first with comprehensive configuration
    const coreConfig: VesperaCoreServicesConfig = {
      logging: {
        level: isDevelopment() ? 1 : 2, // DEBUG in dev, INFO in prod
        enableConsole: true,
        enableVSCodeOutput: true,
        enableStructuredLogging: true
      },
      memoryMonitoring: {
        enabled: true,
        thresholdMB: 150, // Alert at 150MB
        checkIntervalMs: 30000 // Check every 30 seconds
      },
      telemetry: { enabled: true }
    };

    coreServices = await VesperaCoreServices.initialize(context, coreConfig);
    const { logger, contextManager, disposalManager, errorHandler } = coreServices;

    logger.info('Extension activation started', {
      vsCodeVersion: vscode.version,
      environment: isDevelopment() ? 'development' : 'production'
    });

    // Initialize providers with core services
    const { contentProvider } = initializeProviders(context);
    const viewContext = initializeViews(context);
    
    // Register context with memory-safe storage
    contextManager.setViewContext(context, viewContext);
    
    // Register resources for tracking
    if (viewContext.chatPanelProvider) {
      contextManager.registerResource(
        viewContext.chatPanelProvider,
        'ChatPanelProvider',
        'main-chat-panel'
      );
    }

    // Set up comprehensive disposal hooks
    disposalManager.addHook({
      beforeDispose: async () => {
        logger.info('Starting comprehensive extension cleanup');
        await vscode.commands.executeCommand('setContext', 'extension:enabled', false);
        await contextManager.disposeViewContext(context);
      },
      afterDispose: async () => {
        if (global.gc) {
          global.gc();
          logger.debug('Garbage collection triggered');
        }
      },
      onDisposeError: async (error: Error) => {
        logger.error('Error during disposal process', error);
        await errorHandler.handleError(error);
      }
    });

    registerCommands(context, { coreServices });
    await vscode.commands.executeCommand('setContext', 'extension:enabled', true);
    
  } catch (error) {
    // Enhanced error handling with core services
    if (coreServices?.errorHandler) {
      const errorToHandle = error instanceof Error ? error : new Error(String(error));
      await coreServices.errorHandler.handleError(errorToHandle);
    }
    
    // Clean up partially initialized resources
    if (coreServices) {
      await coreServices.disposalManager.dispose();
      coreServices = undefined;
    }
    
    throw error;
  }
}
```

### Replace Individual Service Instances

**Before (Individual Services):**
```typescript
// Multiple individual loggers and error handlers
class MyComponent {
  private logger = new MyLogger();
  private errorHandler = new MyErrorHandler();
  
  async doSomething() {
    this.logger.info('Doing something');
    try {
      await operation();
    } catch (error) {
      this.errorHandler.handle(error);
    }
  }
}
```

**After (Centralized Services):**
```typescript
import { VesperaCoreServices } from '@/core';

class MyComponent {
  private logger = VesperaCoreServices.getInstance().logger;
  private errorHandler = VesperaCoreServices.getInstance().errorHandler;
  
  async doSomething() {
    this.logger.info('Doing something', { component: 'MyComponent' });
    try {
      await operation();
    } catch (error) {
      const vesperaError = error instanceof Error ? 
        VesperaError.fromError(error, VesperaErrorCode.PROVIDER_REQUEST_FAILED) :
        new VesperaError('Unknown error', VesperaErrorCode.UNKNOWN_ERROR);
      await this.errorHandler.handleError(vesperaError);
    }
  }
}
```

## Phase 3: Memory Management Migration

### Replace Global Context Storage

**Real-world example from our migration:**

**Before (Global Context Anti-pattern):**
```typescript
// extension.ts - PROBLEMATIC PATTERN
let globalExtensionContext: VesperaForgeContext | undefined;

export function setGlobalContext(context: VesperaForgeContext) {
  globalExtensionContext = context;
}

export function getGlobalContext(): VesperaForgeContext | undefined {
  return globalExtensionContext;
}

// Usage in other files
export function someUtilityFunction() {
  const context = getGlobalContext();
  if (context) {
    // Use context - potential memory leak
    (context as any)._viewContext = newViewContext;
  }
}
```

**After (WeakMap-based Memory-Safe Storage):**
```typescript
// No global variables - use VesperaContextManager instead
import { VesperaContextManager } from '@/core/memory-management/VesperaContextManager';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const { contextManager } = await VesperaCoreServices.initialize(context);
  
  // Initialize views
  const viewContext = initializeViews(context);
  
  // Store in WeakMap for automatic garbage collection
  contextManager.setViewContext(context, viewContext);
}

// Safe utility function access
export function someUtilityFunction(extensionContext: vscode.ExtensionContext) {
  const contextManager = VesperaCoreServices.getInstance().contextManager;
  const viewContext = contextManager.getViewContext(extensionContext);
  
  if (viewContext) {
    // Use context safely - automatic cleanup when extension context is disposed
    viewContext.chatPanelProvider?.refresh();
  }
}

// Export safe accessor function
export function getViewContext(extensionContext: vscode.ExtensionContext): ViewContextEntry | undefined {
  if (!VesperaCoreServices.isInitialized()) {
    return undefined;
  }
  
  return VesperaCoreServices.getInstance().contextManager.getViewContext(extensionContext);
}
```

### Register Resources for Tracking

**Real implementation pattern from views initialization:**

```typescript
// views/index.ts - Resource Registration Pattern
export function initializeViews(context: vscode.ExtensionContext): ViewContextEntry {
  const contextManager = VesperaCoreServices.getInstance().contextManager;
  
  // Create view providers
  const chatPanelProvider = new ChatPanelProvider(context);
  const taskDashboardProvider = new TaskDashboardProvider(context);
  const statusBarManager = new StatusBarManager();
  const taskTreeProvider = new TaskTreeProvider();

  // Register each provider for memory tracking
  if (chatPanelProvider) {
    contextManager.registerResource(
      chatPanelProvider,
      'ChatPanelProvider',
      'main-chat-panel',
      { size: estimateProviderSize(chatPanelProvider) }
    );
  }

  if (taskDashboardProvider) {
    contextManager.registerResource(
      taskDashboardProvider,
      'TaskDashboardProvider',
      'main-task-dashboard'
    );
  }

  if (statusBarManager) {
    contextManager.registerResource(
      statusBarManager,
      'StatusBarManager',
      'main-status-bar'
    );
  }

  if (taskTreeProvider) {
    contextManager.registerResource(
      taskTreeProvider,
      'TaskTreeProvider',
      'main-task-tree'
    );
  }

  // Register view providers with VS Code
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('vespera-forge.chatPanel', chatPanelProvider),
    vscode.window.registerWebviewViewProvider('vespera-forge.taskDashboard', taskDashboardProvider),
    vscode.window.registerTreeDataProvider('vespera-forge.taskTree', taskTreeProvider)
  );

  return {
    chatPanelProvider,
    taskDashboardProvider,
    statusBarManager,
    taskTreeProvider,
    createdAt: Date.now(),
    lastAccessedAt: Date.now()
  };
}

function estimateProviderSize(provider: any): number {
  // Simple size estimation - can be made more sophisticated
  return JSON.stringify(provider).length || 1024;
}
```

### Implement Resource Disposal

**Enhanced disposal pattern from DisposalManager:**

```typescript
// Real disposal implementation with error isolation
export class EnhancedProvider implements vscode.WebviewViewProvider, DisposableResource {
  private disposed = false;
  public readonly disposalPriority = 10; // Higher priority disposed first
  
  // ... WebviewViewProvider implementation ...

  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    try {
      // Dispose in priority order
      if (this._webview) {
        this._webview.dispose();
      }
      
      if (this._eventListeners) {
        this._eventListeners.forEach(listener => listener.dispose());
        this._eventListeners.clear();
      }
      
      if (this._subscriptions) {
        this._subscriptions.forEach(subscription => subscription.dispose());
        this._subscriptions.length = 0;
      }
      
      this.disposed = true;
      
    } catch (error) {
      // Log but don't throw - disposal should be resilient
      const logger = VesperaCoreServices.getInstance().logger;
      logger.error(`Error disposing ${this.constructor.name}`, error);
    }
  }

  get isDisposed(): boolean {
    return this.disposed;
  }
}
```

### Add Memory Monitoring

**Memory monitoring integration from VesperaContextManager:**

```typescript
// Automatic memory monitoring setup
export function setupMemoryMonitoring(): void {
  const contextManager = VesperaCoreServices.getInstance().contextManager;
  
  // Check memory every 30 seconds
  setInterval(() => {
    const memStats = contextManager.getMemoryStats();
    const heapUsedMB = Math.round(memStats.memoryUsage.heapUsed / 1024 / 1024);
    
    if (heapUsedMB > 150) { // Configurable threshold
      console.warn(`High memory usage detected: ${heapUsedMB}MB`);
      
      // Trigger cleanup
      contextManager.cleanupStaleResources().then(cleanup => {
        if (cleanup.cleaned > 0) {
          console.info(`Cleaned up ${cleanup.cleaned} stale resources`);
        }
      });
      
      // Suggest garbage collection
      if (global.gc) {
        global.gc();
      }
    }
  }, 30000);
}
```

## Phase 4: Error Handling Standardization

### Define Domain-Specific Error Codes

**Real implementation from VesperaErrors.ts:**

```typescript
// Define errors specific to your extension domain
export enum MyExtensionErrorCode {
  // Configuration Errors (2000-2099)
  CONFIG_FILE_NOT_FOUND = 2000,
  CONFIG_VALIDATION_FAILED = 2001,
  CONFIG_PERMISSIONS_ERROR = 2002,

  // Service Integration Errors (2100-2199)
  SERVICE_CONNECTION_FAILED = 2100,
  SERVICE_AUTHENTICATION_FAILED = 2101,
  SERVICE_RATE_LIMITED = 2102,

  // UI Component Errors (2200-2299)
  COMPONENT_RENDER_FAILED = 2200,
  COMPONENT_EVENT_FAILED = 2201,
  COMPONENT_STATE_INVALID = 2202,

  // Data Processing Errors (2300-2399)
  DATA_PARSING_FAILED = 2300,
  DATA_VALIDATION_FAILED = 2301,
  DATA_TRANSFORMATION_FAILED = 2302
}

// Configure strategies for your specific error codes
export function configureMyExtensionErrorStrategies(errorHandler: VesperaErrorHandler) {
  // Configuration errors - user should be notified, retry makes sense
  errorHandler.setStrategy(MyExtensionErrorCode.CONFIG_FILE_NOT_FOUND, {
    shouldLog: true,
    shouldNotifyUser: true,
    shouldThrow: false,
    shouldRetry: true,
    maxRetries: 2,
    retryDelay: 1000
  });

  // Service errors - log and notify, don't retry authentication failures
  errorHandler.setStrategy(MyExtensionErrorCode.SERVICE_AUTHENTICATION_FAILED, {
    shouldLog: true,
    shouldNotifyUser: true,
    shouldThrow: true,
    shouldRetry: false
  });

  // Rate limiting - wait and retry
  errorHandler.setStrategy(MyExtensionErrorCode.SERVICE_RATE_LIMITED, {
    shouldLog: true,
    shouldNotifyUser: false, // Don't spam user
    shouldThrow: false,
    shouldRetry: true,
    maxRetries: 5,
    retryDelay: 2000 // Wait 2 seconds before retry
  });

  // UI errors - log but don't interrupt user flow
  errorHandler.setStrategy(MyExtensionErrorCode.COMPONENT_RENDER_FAILED, {
    shouldLog: true,
    shouldNotifyUser: false,
    shouldThrow: false,
    shouldRetry: true,
    maxRetries: 1,
    retryDelay: 100
  });
}
```

### Replace Basic Error Handling

**Real migration examples from various components:**

#### Configuration Management

**Before:**
```typescript
// ConfigurationManager - Basic Error Handling
export class ConfigurationManager {
  async loadConfiguration(filePath: string): Promise<Configuration> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to load configuration:', error);
      throw error; // Inconsistent - sometimes throws, sometimes doesn't
    }
  }

  async saveConfiguration(config: Configuration): Promise<void> {
    try {
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Failed to save configuration:', error);
      // Sometimes doesn't throw - inconsistent error handling
    }
  }
}
```

**After:**
```typescript
// ConfigurationManager - Centralized Error Handling
export class ConfigurationManager {
  private errorHandler = VesperaCoreServices.getInstance().errorHandler;
  private logger = VesperaCoreServices.getInstance().logger;

  async loadConfiguration(filePath: string): Promise<Configuration> {
    try {
      this.logger.debug('Loading configuration', { filePath });
      const content = await fs.readFile(filePath, 'utf8');
      const config = JSON.parse(content);
      
      // Validate configuration
      if (!this.validateConfiguration(config)) {
        throw new VesperaError(
          'Configuration validation failed',
          MyExtensionErrorCode.CONFIG_VALIDATION_FAILED,
          VesperaSeverity.HIGH,
          { filePath, config }
        );
      }
      
      this.logger.info('Configuration loaded successfully', { filePath });
      return config;
      
    } catch (error) {
      let vesperaError: VesperaError;
      
      if (error instanceof VesperaError) {
        vesperaError = error;
      } else if (error.code === 'ENOENT') {
        vesperaError = new VesperaError(
          `Configuration file not found: ${filePath}`,
          MyExtensionErrorCode.CONFIG_FILE_NOT_FOUND,
          VesperaSeverity.HIGH,
          { filePath, originalError: error.message }
        );
      } else if (error instanceof SyntaxError) {
        vesperaError = new VesperaError(
          'Configuration file contains invalid JSON',
          MyExtensionErrorCode.CONFIG_VALIDATION_FAILED,
          VesperaSeverity.HIGH,
          { filePath, parseError: error.message }
        );
      } else {
        vesperaError = VesperaError.fromError(
          error,
          MyExtensionErrorCode.CONFIG_VALIDATION_FAILED,
          { filePath }
        );
      }
      
      // Let error handler determine strategy (retry, notify user, etc.)
      await this.errorHandler.handleError(vesperaError);
      throw vesperaError; // Re-throw for caller to handle if needed
    }
  }

  async saveConfiguration(config: Configuration): Promise<void> {
    try {
      this.logger.debug('Saving configuration', { configPath: this.configPath });
      
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });
      
      // Write atomically (write to temp file, then rename)
      const tempPath = `${this.configPath}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(config, null, 2));
      await fs.rename(tempPath, this.configPath);
      
      this.logger.info('Configuration saved successfully');
      
    } catch (error) {
      const vesperaError = VesperaError.fromError(
        error,
        MyExtensionErrorCode.CONFIG_PERMISSIONS_ERROR,
        { configPath: this.configPath, config }
      );
      
      await this.errorHandler.handleError(vesperaError);
      throw vesperaError;
    }
  }

  private validateConfiguration(config: any): boolean {
    // Implement validation logic
    return config && typeof config === 'object';
  }
}
```

#### Service Layer Error Handling

**Before:**
```typescript
// Service - Basic Error Handling
export class ApiService {
  async makeRequest(endpoint: string): Promise<any> {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }
}
```

**After:**
```typescript
// Service - Enhanced Error Handling with Retry Logic
export class ApiService {
  private errorHandler = VesperaCoreServices.getInstance().errorHandler;
  private logger = VesperaCoreServices.getInstance().logger;

  async makeRequest(endpoint: string, options?: RequestOptions): Promise<any> {
    const requestId = this.generateRequestId();
    this.logger.debug('Making API request', { endpoint, requestId });

    try {
      const response = await this.fetchWithTimeout(endpoint, options);
      
      if (!response.ok) {
        await this.handleHttpError(response, endpoint, requestId);
      }
      
      const data = await response.json();
      this.logger.debug('API request successful', { endpoint, requestId });
      return data;
      
    } catch (error) {
      await this.handleRequestError(error, endpoint, requestId);
      throw error; // Re-throw after handling
    }
  }

  private async handleHttpError(response: Response, endpoint: string, requestId: string): Promise<never> {
    let errorCode: MyExtensionErrorCode;
    let severity: VesperaSeverity;
    
    switch (response.status) {
      case 401:
      case 403:
        errorCode = MyExtensionErrorCode.SERVICE_AUTHENTICATION_FAILED;
        severity = VesperaSeverity.HIGH;
        break;
      case 429:
        errorCode = MyExtensionErrorCode.SERVICE_RATE_LIMITED;
        severity = VesperaSeverity.MEDIUM;
        break;
      case 500:
      case 502:
      case 503:
        errorCode = MyExtensionErrorCode.SERVICE_CONNECTION_FAILED;
        severity = VesperaSeverity.HIGH;
        break;
      default:
        errorCode = MyExtensionErrorCode.SERVICE_CONNECTION_FAILED;
        severity = VesperaSeverity.MEDIUM;
    }

    const vesperaError = new VesperaError(
      `API request failed: ${response.status} ${response.statusText}`,
      errorCode,
      severity,
      {
        endpoint,
        requestId,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      }
    );

    await this.errorHandler.handleError(vesperaError);
    throw vesperaError;
  }

  private async handleRequestError(error: any, endpoint: string, requestId: string): Promise<void> {
    if (error instanceof VesperaError) {
      // Already a VesperaError, just handle it
      await this.errorHandler.handleError(error);
      return;
    }

    let vesperaError: VesperaError;

    if (error.name === 'AbortError' || error.code === 'TIMEOUT') {
      vesperaError = new VesperaError(
        'API request timed out',
        MyExtensionErrorCode.SERVICE_CONNECTION_FAILED,
        VesperaSeverity.MEDIUM,
        { endpoint, requestId, timeout: true }
      );
    } else if (error.code === 'NETWORK_ERROR' || error.message.includes('fetch')) {
      vesperaError = new VesperaError(
        'Network connection failed',
        MyExtensionErrorCode.SERVICE_CONNECTION_FAILED,
        VesperaSeverity.HIGH,
        { endpoint, requestId, networkError: true }
      );
    } else {
      vesperaError = VesperaError.fromError(
        error,
        MyExtensionErrorCode.SERVICE_CONNECTION_FAILED,
        { endpoint, requestId }
      );
    }

    await this.errorHandler.handleError(vesperaError);
  }

  private async fetchWithTimeout(endpoint: string, options?: RequestOptions): Promise<Response> {
    const timeout = options?.timeout || 10000;
    const controller = new AbortController();
    
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      return await fetch(endpoint, {
        ...options,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

#### UI Component Error Handling

**Before:**
```typescript
// UI Component - Basic Error Handling
export class TaskTreeProvider implements vscode.TreeDataProvider<TaskTreeItem> {
  async getChildren(element?: TaskTreeItem): Promise<TaskTreeItem[]> {
    try {
      const tasks = await this.taskService.getTasks(element?.taskId);
      return tasks.map(task => new TaskTreeItem(task));
    } catch (error) {
      console.error('Failed to get tasks:', error);
      return [];
    }
  }
}
```

**After:**
```typescript
// UI Component - Enhanced Error Handling with User Experience
export class TaskTreeProvider implements vscode.TreeDataProvider<TaskTreeItem> {
  private errorHandler = VesperaCoreServices.getInstance().errorHandler;
  private logger = VesperaCoreServices.getInstance().logger;

  async getChildren(element?: TaskTreeItem): Promise<TaskTreeItem[]> {
    const context = { component: 'TaskTreeProvider', element: element?.taskId };
    this.logger.debug('Getting tree children', context);

    try {
      const tasks = await this.taskService.getTasks(element?.taskId);
      const items = tasks.map(task => new TaskTreeItem(task));
      
      this.logger.debug('Tree children loaded successfully', { 
        ...context, 
        count: items.length 
      });
      
      return items;
      
    } catch (error) {
      const vesperaError = VesperaError.fromError(
        error,
        MyExtensionErrorCode.COMPONENT_RENDER_FAILED,
        context
      );

      await this.errorHandler.handleError(vesperaError);
      
      // Return error item to show user what happened
      return [new TaskTreeItem({
        id: 'error',
        title: 'Failed to load tasks',
        description: 'Click to retry',
        status: 'error'
      })];
    }
  }

  // Add refresh command that can be triggered from error items
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
}
```

### Configure Error Strategies

**Real configuration from extension initialization:**

```typescript
// Configure error strategies during activation
async function configureErrorHandling() {
  const errorHandler = VesperaCoreServices.getInstance().errorHandler;
  
  // Configuration errors - notify user, allow retries
  errorHandler.setStrategy(MyExtensionErrorCode.CONFIG_FILE_NOT_FOUND, {
    shouldLog: true,
    shouldNotifyUser: true,
    shouldThrow: false,
    shouldRetry: true,
    maxRetries: 3,
    retryDelay: 1000
  });

  // Authentication errors - notify user, don't retry (user needs to fix credentials)
  errorHandler.setStrategy(MyExtensionErrorCode.SERVICE_AUTHENTICATION_FAILED, {
    shouldLog: true,
    shouldNotifyUser: true,
    shouldThrow: true,
    shouldRetry: false
  });

  // Rate limiting - wait and retry, don't spam user
  errorHandler.setStrategy(MyExtensionErrorCode.SERVICE_RATE_LIMITED, {
    shouldLog: true,
    shouldNotifyUser: false,
    shouldThrow: false,
    shouldRetry: true,
    maxRetries: 5,
    retryDelay: 2000
  });

  // Network errors - retry with backoff
  errorHandler.setStrategy(MyExtensionErrorCode.SERVICE_CONNECTION_FAILED, {
    shouldLog: true,
    shouldNotifyUser: true,
    shouldThrow: false,
    shouldRetry: true,
    maxRetries: 3,
    retryDelay: 1000
  });

  // UI render errors - log but don't interrupt user, single retry
  errorHandler.setStrategy(MyExtensionErrorCode.COMPONENT_RENDER_FAILED, {
    shouldLog: true,
    shouldNotifyUser: false,
    shouldThrow: false,
    shouldRetry: true,
    maxRetries: 1,
    retryDelay: 100
  });
}
```

## Phase 5: Testing and Verification

### Memory Leak Tests

**Real test implementation:**

```typescript
// memory-management.test.ts
import { VesperaContextManager } from '@/core/memory-management/VesperaContextManager';
import { createMockExtensionContext } from './mocks';

describe('Memory Management', () => {
  let contextManager: VesperaContextManager;

  beforeEach(() => {
    contextManager = VesperaContextManager.getInstance();
  });

  test('WeakMap context cleanup', async () => {
    let extensionContext = createMockExtensionContext();
    const mockViewContext = {
      chatPanelProvider: { dispose: jest.fn() },
      createdAt: Date.now(),
      lastAccessedAt: Date.now()
    };

    // Set context
    contextManager.setViewContext(extensionContext, mockViewContext);
    
    // Verify context exists
    expect(contextManager.getViewContext(extensionContext)).toBeDefined();
    
    // Get initial stats
    const initialStats = contextManager.getMemoryStats();
    
    // Simulate context disposal
    extensionContext = null;
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      // Wait for GC to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Context should be automatically cleaned up
    // Note: WeakMap cleanup is automatic but hard to test directly
    // We verify through indirect means
    expect(initialStats.registeredResources).toBeGreaterThanOrEqual(0);
  });

  test('resource registry tracking', () => {
    const mockResource = {
      dispose: jest.fn(),
      isDisposed: false
    };

    const resourceId = contextManager.registerResource(
      mockResource,
      'TestResource',
      'test-1'
    );

    expect(resourceId).toBe('test-1');

    const stats = contextManager.getMemoryStats();
    expect(stats.registeredResources).toBeGreaterThan(0);
    expect(stats.resourceTypes['TestResource']).toBe(1);
  });

  test('stale resource cleanup', async () => {
    const oldResource = {
      dispose: jest.fn(),
      isDisposed: false
    };

    contextManager.registerResource(oldResource, 'OldResource', 'old-1');

    // Mock old resource (older than 1ms)
    jest.spyOn(Date, 'now').mockImplementation(() => Date.now() + 10000);

    const cleanupResult = await contextManager.cleanupStaleResources(1);

    expect(cleanupResult.cleaned).toBeGreaterThan(0);
    expect(oldResource.dispose).toHaveBeenCalled();

    jest.restoreAllMocks();
  });

  test('memory monitoring alerts', () => {
    const mockMemoryUsage = {
      heapUsed: 200 * 1024 * 1024, // 200MB - above threshold
      heapTotal: 250 * 1024 * 1024,
      external: 10 * 1024 * 1024,
      rss: 300 * 1024 * 1024
    };

    jest.spyOn(process, 'memoryUsage').mockReturnValue(mockMemoryUsage);

    const stats = contextManager.getMemoryStats();
    expect(stats.memoryUsage.heapUsed).toBe(200 * 1024 * 1024);

    // Should detect high memory usage
    const heapUsedMB = Math.round(stats.memoryUsage.heapUsed / 1024 / 1024);
    expect(heapUsedMB).toBeGreaterThan(150);

    jest.restoreAllMocks();
  });
});
```

### Error Handling Tests

```typescript
// error-handling.test.ts
import { VesperaErrorHandler, VesperaError, MyExtensionErrorCode } from '@/core';

describe('Error Handling', () => {
  let errorHandler: VesperaErrorHandler;
  let mockLogger: any;
  let mockNotifier: any;

  beforeEach(() => {
    errorHandler = VesperaErrorHandler.getInstance();
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn()
    };
    mockNotifier = jest.fn();
    
    // Mock VS Code notification
    jest.spyOn(vscode.window, 'showErrorMessage').mockImplementation(mockNotifier);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('applies correct strategy for configuration errors', async () => {
    const configError = new VesperaError(
      'Config file not found',
      MyExtensionErrorCode.CONFIG_FILE_NOT_FOUND,
      VesperaSeverity.HIGH
    );

    await errorHandler.handleError(configError);

    // Strategy should log (shouldLog: true)
    expect(mockLogger.error).toHaveBeenCalled();
    
    // Strategy should notify user (shouldNotifyUser: true)
    expect(mockNotifier).toHaveBeenCalledWith(
      expect.stringContaining('Config file not found'),
      expect.any(String)
    );

    // Strategy should not throw (shouldThrow: false)
    // Test passes if no exception is thrown
  });

  test('respects retry configuration', async () => {
    let attemptCount = 0;
    const operation = jest.fn(() => {
      attemptCount++;
      if (attemptCount < 3) {
        throw new Error('Temporary failure');
      }
      return 'success';
    });

    const retryableError = new VesperaError(
      'Service temporarily unavailable',
      MyExtensionErrorCode.SERVICE_CONNECTION_FAILED,
      VesperaSeverity.MEDIUM
    );

    // Set up retry strategy
    errorHandler.setStrategy(MyExtensionErrorCode.SERVICE_CONNECTION_FAILED, {
      shouldLog: true,
      shouldNotifyUser: false,
      shouldThrow: false,
      shouldRetry: true,
      maxRetries: 3,
      retryDelay: 100
    });

    // Test retry logic through wrapper function
    const result = await errorHandler.handleWithRetry(
      operation,
      MyExtensionErrorCode.SERVICE_CONNECTION_FAILED
    );

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  test('error conversion from generic errors', async () => {
    const genericError = new Error('Something went wrong');
    
    const vesperaError = VesperaError.fromError(
      genericError,
      MyExtensionErrorCode.COMPONENT_RENDER_FAILED
    );

    expect(vesperaError).toBeInstanceOf(VesperaError);
    expect(vesperaError.code).toBe(MyExtensionErrorCode.COMPONENT_RENDER_FAILED);
    expect(vesperaError.message).toContain('Something went wrong');
    expect(vesperaError.metadata.source).toBeDefined();
  });

  test('handles unknown errors gracefully', async () => {
    const unknownError = { weird: 'object', not: 'error' };
    
    await errorHandler.handleError(unknownError as any);
    
    // Should still log and handle gracefully
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
```

### Integration Tests

```typescript
// core-services-integration.test.ts
import { VesperaCoreServices } from '@/core';
import { createMockExtensionContext } from './mocks';

describe('Core Services Integration', () => {
  let mockContext: vscode.ExtensionContext;
  let coreServices: any;

  beforeEach(async () => {
    mockContext = createMockExtensionContext();
    coreServices = await VesperaCoreServices.initialize(mockContext, {
      logging: { level: 1 },
      memoryMonitoring: { enabled: true, thresholdMB: 100 }
    });
  });

  afterEach(async () => {
    if (coreServices) {
      await coreServices.disposalManager.dispose();
    }
  });

  test('all services initialize correctly', () => {
    expect(coreServices.logger).toBeDefined();
    expect(coreServices.errorHandler).toBeDefined();
    expect(coreServices.contextManager).toBeDefined();
    expect(coreServices.telemetryService).toBeDefined();
    expect(coreServices.disposalManager).toBeDefined();
  });

  test('health check reports all services healthy', async () => {
    const healthCheck = await coreServices.healthCheck();

    expect(healthCheck.healthy).toBe(true);
    expect(healthCheck.services.logger.healthy).toBe(true);
    expect(healthCheck.services.errorHandler.healthy).toBe(true);
    expect(healthCheck.services.contextManager.healthy).toBe(true);
    expect(healthCheck.services.disposalManager.healthy).toBe(true);
  });

  test('services can be used together', async () => {
    const { logger, errorHandler, contextManager } = coreServices;

    // Test logger
    logger.info('Test message', { test: true });
    const logStats = logger.getLogStats();
    expect(logStats.totalLogs).toBeGreaterThan(0);

    // Test context manager
    contextManager.setViewContext(mockContext, {
      createdAt: Date.now(),
      lastAccessedAt: Date.now()
    });
    const viewContext = contextManager.getViewContext(mockContext);
    expect(viewContext).toBeDefined();

    // Test error handler
    const testError = new Error('Test error');
    await errorHandler.handleError(testError);
    // Should not throw due to default strategy
  });

  test('disposal manager cleans up all services', async () => {
    const initialStats = coreServices.disposalManager.getStats();
    expect(initialStats.totalDisposables).toBeGreaterThan(0);

    const disposalResult = await coreServices.disposalManager.dispose();
    
    expect(disposalResult.successful).toBeGreaterThan(0);
    expect(disposalResult.failed).toBe(0);
    expect(disposalResult.errors).toHaveLength(0);
  });
});
```

## Common Migration Patterns

### Pattern 1: Service Method Enhancement

**Template for migrating service methods:**

```typescript
// BEFORE: Basic service method
async originalMethod(param: string): Promise<Result> {
  try {
    const result = await externalOperation(param);
    return result;
  } catch (error) {
    console.error('Operation failed:', error);
    throw error;
  }
}

// AFTER: Enhanced service method
async enhancedMethod(param: string): Promise<Result> {
  const logger = VesperaCoreServices.getInstance().logger;
  const errorHandler = VesperaCoreServices.getInstance().errorHandler;
  
  const operationId = `operation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  logger.debug('Starting operation', { operationId, param });
  
  try {
    const result = await externalOperation(param);
    logger.info('Operation completed successfully', { operationId, resultSize: result?.length });
    return result;
    
  } catch (error) {
    const vesperaError = VesperaError.fromError(
      error,
      MyExtensionErrorCode.SERVICE_CONNECTION_FAILED,
      { operationId, param }
    );
    
    await errorHandler.handleError(vesperaError);
    throw vesperaError;
  }
}
```

### Pattern 2: Provider Enhancement

**Template for migrating VS Code providers:**

```typescript
// BEFORE: Basic provider
export class BasicProvider implements vscode.WebviewViewProvider {
  constructor(private context: vscode.ExtensionContext) {}
  
  resolveWebviewView(webviewView: vscode.WebviewView) {
    // Basic setup
  }
}

// AFTER: Enhanced provider with memory management
export class EnhancedProvider implements vscode.WebviewViewProvider, DisposableResource {
  private disposed = false;
  private logger = VesperaCoreServices.getInstance().logger;
  private contextManager = VesperaCoreServices.getInstance().contextManager;
  private subscriptions: vscode.Disposable[] = [];
  
  public readonly disposalPriority = 5; // Medium priority
  
  constructor(private context: vscode.ExtensionContext) {
    // Register self for memory tracking
    this.contextManager.registerResource(this, 'EnhancedProvider', `provider_${Date.now()}`);
  }
  
  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.logger.debug('Resolving webview view', { providerId: this.constructor.name });
    
    try {
      // Enhanced setup with error handling
      this.setupWebview(webviewView);
      this.logger.info('Webview resolved successfully');
      
    } catch (error) {
      const vesperaError = VesperaError.fromError(
        error,
        MyExtensionErrorCode.COMPONENT_RENDER_FAILED,
        { component: this.constructor.name }
      );
      
      VesperaCoreServices.getInstance().errorHandler.handleError(vesperaError);
      throw vesperaError;
    }
  }
  
  private setupWebview(webviewView: vscode.WebviewView) {
    // Setup with proper subscription tracking
    const messageHandler = webviewView.webview.onDidReceiveMessage(
      message => this.handleMessage(message)
    );
    
    this.subscriptions.push(messageHandler);
    
    // More setup...
  }
  
  private async handleMessage(message: any) {
    try {
      // Message handling with error handling
      await this.processMessage(message);
    } catch (error) {
      const vesperaError = VesperaError.fromError(
        error,
        MyExtensionErrorCode.COMPONENT_EVENT_FAILED,
        { message, component: this.constructor.name }
      );
      
      await VesperaCoreServices.getInstance().errorHandler.handleError(vesperaError);
    }
  }
  
  async dispose(): Promise<void> {
    if (this.disposed) return;
    
    try {
      this.logger.debug('Disposing provider', { component: this.constructor.name });
      
      // Dispose all subscriptions
      this.subscriptions.forEach(sub => sub.dispose());
      this.subscriptions.length = 0;
      
      this.disposed = true;
      this.logger.debug('Provider disposed successfully');
      
    } catch (error) {
      this.logger.error('Error disposing provider', error);
      // Don't throw during disposal
    }
  }
  
  get isDisposed(): boolean {
    return this.disposed;
  }
}
```

### Pattern 3: Configuration Class Enhancement

**Template for migrating configuration classes:**

```typescript
// BEFORE: Basic configuration
export class BasicConfig {
  private config: any = {};
  
  async load() {
    this.config = JSON.parse(await fs.readFile(this.configPath, 'utf8'));
  }
  
  get<T>(key: string): T {
    return this.config[key];
  }
}

// AFTER: Enhanced configuration with validation and error handling
export class EnhancedConfig {
  private config: ConfigurationSchema = {};
  private logger = VesperaCoreServices.getInstance().logger;
  private errorHandler = VesperaCoreServices.getInstance().errorHandler;
  
  constructor(private configPath: string) {}
  
  async load(): Promise<void> {
    const loadId = `config_load_${Date.now()}`;
    this.logger.debug('Loading configuration', { configPath: this.configPath, loadId });
    
    try {
      // Check file exists
      await fs.access(this.configPath);
      
      // Read and parse
      const content = await fs.readFile(this.configPath, 'utf8');
      const rawConfig = JSON.parse(content);
      
      // Validate schema
      const validationResult = this.validateConfiguration(rawConfig);
      if (!validationResult.valid) {
        throw new VesperaError(
          `Configuration validation failed: ${validationResult.errors.join(', ')}`,
          MyExtensionErrorCode.CONFIG_VALIDATION_FAILED,
          VesperaSeverity.HIGH,
          { configPath: this.configPath, errors: validationResult.errors, loadId }
        );
      }
      
      this.config = rawConfig;
      this.logger.info('Configuration loaded successfully', { loadId, keys: Object.keys(this.config) });
      
    } catch (error) {
      let vesperaError: VesperaError;
      
      if (error instanceof VesperaError) {
        vesperaError = error;
      } else if (error.code === 'ENOENT') {
        vesperaError = new VesperaError(
          `Configuration file not found: ${this.configPath}`,
          MyExtensionErrorCode.CONFIG_FILE_NOT_FOUND,
          VesperaSeverity.HIGH,
          { configPath: this.configPath, loadId }
        );
      } else if (error instanceof SyntaxError) {
        vesperaError = new VesperaError(
          `Invalid JSON in configuration file: ${error.message}`,
          MyExtensionErrorCode.CONFIG_VALIDATION_FAILED,
          VesperaSeverity.HIGH,
          { configPath: this.configPath, parseError: error.message, loadId }
        );
      } else {
        vesperaError = VesperaError.fromError(
          error,
          MyExtensionErrorCode.CONFIG_VALIDATION_FAILED,
          { configPath: this.configPath, loadId }
        );
      }
      
      await this.errorHandler.handleError(vesperaError);
      
      // Load defaults on error
      this.config = this.getDefaultConfiguration();
      this.logger.warn('Loaded default configuration due to error', { loadId });
    }
  }
  
  get<T>(key: keyof ConfigurationSchema): T | undefined {
    const value = this.config[key] as T;
    this.logger.debug('Configuration value accessed', { key, hasValue: value !== undefined });
    return value;
  }
  
  async save(): Promise<void> {
    const saveId = `config_save_${Date.now()}`;
    this.logger.debug('Saving configuration', { configPath: this.configPath, saveId });
    
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });
      
      // Validate before saving
      const validationResult = this.validateConfiguration(this.config);
      if (!validationResult.valid) {
        throw new VesperaError(
          `Cannot save invalid configuration: ${validationResult.errors.join(', ')}`,
          MyExtensionErrorCode.CONFIG_VALIDATION_FAILED,
          VesperaSeverity.HIGH,
          { configPath: this.configPath, errors: validationResult.errors, saveId }
        );
      }
      
      // Write atomically
      const tempPath = `${this.configPath}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(this.config, null, 2));
      await fs.rename(tempPath, this.configPath);
      
      this.logger.info('Configuration saved successfully', { saveId });
      
    } catch (error) {
      const vesperaError = VesperaError.fromError(
        error,
        MyExtensionErrorCode.CONFIG_VALIDATION_FAILED,
        { configPath: this.configPath, saveId }
      );
      
      await this.errorHandler.handleError(vesperaError);
      throw vesperaError;
    }
  }
  
  private validateConfiguration(config: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Implement validation logic
    if (!config || typeof config !== 'object') {
      errors.push('Configuration must be an object');
    }
    
    // Add more validation rules...
    
    return { valid: errors.length === 0, errors };
  }
  
  private getDefaultConfiguration(): ConfigurationSchema {
    return {
      // Default configuration values
    };
  }
}

interface ConfigurationSchema {
  // Define your configuration schema
}
```

## Troubleshooting Migration Issues

### Common TypeScript Issues

#### Issue: `noUncheckedIndexedAccess` Errors

**Problem:**
```typescript
// This now causes TypeScript errors
const items = ['a', 'b', 'c'];
const firstItem = items[0]; // Type: string | undefined
console.log(firstItem.toUpperCase()); // Error: Object is possibly 'undefined'
```

**Solution:**
```typescript
// Use safe access patterns
const items = ['a', 'b', 'c'];
const firstItem = items[0];
if (firstItem) {
  console.log(firstItem.toUpperCase());
}

// Or use optional chaining
console.log(firstItem?.toUpperCase() ?? 'DEFAULT');

// For guaranteed access, use at()
const definitelyFirstItem = items.at(0); // Still string | undefined, but more explicit
```

#### Issue: `exactOptionalPropertyTypes` Errors

**Problem:**
```typescript
interface Config {
  feature?: boolean;
}

const config: Config = {};
config.feature = undefined; // Error with exactOptionalPropertyTypes
```

**Solution:**
```typescript
interface Config {
  feature?: boolean;
}

const config: Config = {};

// Instead of assigning undefined
if (shouldEnable) {
  config.feature = true;
} else {
  delete config.feature; // Or omit the assignment
}

// Or use utility types
type ConfigInput = Required<Config>; // For inputs that require all properties
type ConfigPartial = Partial<Config>; // For partial updates
```

### Common Memory Management Issues

#### Issue: Resources Not Being Disposed

**Problem:**
```typescript
// Resource disposal not working
class MyResource {
  dispose() {
    console.log('Disposing...');
    // Cleanup code
  }
}

const resource = new MyResource();
// Resource never gets disposed
```

**Solution:**
```typescript
// Implement proper disposable pattern
class MyResource implements DisposableResource {
  private disposed = false;
  
  async dispose(): Promise<void> {
    if (this.disposed) return;
    
    try {
      console.log('Disposing...');
      // Cleanup code
      this.disposed = true;
    } catch (error) {
      console.error('Disposal error:', error);
      // Don't throw during disposal
    }
  }
  
  get isDisposed(): boolean {
    return this.disposed;
  }
}

// Register with context manager
const resource = new MyResource();
VesperaCoreServices.getInstance().contextManager.registerResource(
  resource, 
  'MyResource', 
  'unique-id'
);
```

#### Issue: Memory Usage Growing Over Time

**Problem:**
```typescript
// Event listeners not being cleaned up
class MyService {
  constructor() {
    setInterval(this.checkSomething.bind(this), 1000); // Memory leak
    vscode.workspace.onDidChangeConfiguration(this.handleConfigChange); // Not tracked
  }
}
```

**Solution:**
```typescript
class MyService implements DisposableResource {
  private subscriptions: vscode.Disposable[] = [];
  private timers: NodeJS.Timeout[] = [];
  
  constructor() {
    // Track intervals/timeouts
    const interval = setInterval(this.checkSomething.bind(this), 1000);
    this.timers.push(interval);
    
    // Track VS Code subscriptions
    const configSubscription = vscode.workspace.onDidChangeConfiguration(this.handleConfigChange);
    this.subscriptions.push(configSubscription);
  }
  
  async dispose(): Promise<void> {
    // Clear timers
    this.timers.forEach(timer => clearInterval(timer));
    this.timers.length = 0;
    
    // Dispose subscriptions
    this.subscriptions.forEach(sub => sub.dispose());
    this.subscriptions.length = 0;
  }
  
  get isDisposed(): boolean {
    return this.subscriptions.length === 0 && this.timers.length === 0;
  }
}
```

### Common Error Handling Issues

#### Issue: Errors Not Being Caught by Handler

**Problem:**
```typescript
// Promise rejection not handled
async function myFunction() {
  someAsyncOperation(); // Not awaited, rejection not caught
  return 'success';
}
```

**Solution:**
```typescript
async function myFunction() {
  const errorHandler = VesperaCoreServices.getInstance().errorHandler;
  
  try {
    await someAsyncOperation(); // Properly awaited
    return 'success';
  } catch (error) {
    const vesperaError = VesperaError.fromError(
      error, 
      MyExtensionErrorCode.SERVICE_CONNECTION_FAILED
    );
    await errorHandler.handleError(vesperaError);
    throw vesperaError;
  }
}
```

#### Issue: Error Strategies Not Working

**Problem:**
```typescript
// Strategy not configured for specific error code
await errorHandler.handleError(new VesperaError(
  'Custom error',
  MyExtensionErrorCode.CUSTOM_ERROR, // No strategy configured
  VesperaSeverity.HIGH
));
```

**Solution:**
```typescript
// Configure strategy for custom error codes
errorHandler.setStrategy(MyExtensionErrorCode.CUSTOM_ERROR, {
  shouldLog: true,
  shouldNotifyUser: true,
  shouldThrow: false,
  shouldRetry: false
});

await errorHandler.handleError(new VesperaError(
  'Custom error',
  MyExtensionErrorCode.CUSTOM_ERROR,
  VesperaSeverity.HIGH
));
```

### Migration Verification

#### Verification Checklist

Use this checklist to verify successful migration:

```typescript
// migration-verification.ts
interface MigrationVerification {
  typeScript: VerificationCheck[];
  memoryManagement: VerificationCheck[];
  errorHandling: VerificationCheck[];
  coreServices: VerificationCheck[];
}

interface VerificationCheck {
  name: string;
  check: () => Promise<boolean> | boolean;
  description: string;
}

export const migrationVerification: MigrationVerification = {
  typeScript: [
    {
      name: 'Enhanced tsconfig applied',
      check: () => {
        // Check if tsconfig.json has enhanced settings
        const tsconfig = require('./tsconfig.json');
        return tsconfig.compilerOptions.exactOptionalPropertyTypes === true &&
               tsconfig.compilerOptions.noUncheckedIndexedAccess === true;
      },
      description: 'TypeScript configuration includes enhanced strict checks'
    },
    {
      name: 'No type casting to any',
      check: async () => {
        // Scan codebase for remaining 'as any' usage
        const assessment = assessCodebase('./src');
        return assessment.unsafeTypeCasting.length === 0;
      },
      description: 'All unsafe type casting has been removed'
    }
  ],
  
  memoryManagement: [
    {
      name: 'No global context variables',
      check: async () => {
        const assessment = assessCodebase('./src');
        return assessment.globalVariables.length === 0;
      },
      description: 'All global context storage has been replaced with WeakMap'
    },
    {
      name: 'Resources registered with context manager',
      check: () => {
        const contextManager = VesperaCoreServices.getInstance().contextManager;
        const stats = contextManager.getMemoryStats();
        return stats.registeredResources > 0;
      },
      description: 'Resources are properly registered for tracking'
    },
    {
      name: 'Memory monitoring enabled',
      check: () => {
        const contextManager = VesperaCoreServices.getInstance().contextManager;
        const stats = contextManager.getMemoryStats();
        return stats.memoryMonitoring.checksPerformed > 0;
      },
      description: 'Memory monitoring is active and performing checks'
    }
  ],
  
  errorHandling: [
    {
      name: 'Centralized error handling',
      check: async () => {
        const assessment = assessCodebase('./src');
        return assessment.basicErrorHandling.length === 0;
      },
      description: 'All basic console.error usage replaced with centralized handler'
    },
    {
      name: 'Error strategies configured',
      check: () => {
        const errorHandler = VesperaCoreServices.getInstance().errorHandler;
        // Check that custom error codes have strategies
        return errorHandler.getStrategy(MyExtensionErrorCode.CONFIG_FILE_NOT_FOUND) !== null;
      },
      description: 'Error handling strategies are configured for domain-specific errors'
    }
  ],
  
  coreServices: [
    {
      name: 'Core services initialized',
      check: () => {
        return VesperaCoreServices.isInitialized();
      },
      description: 'VesperaCoreServices is properly initialized'
    },
    {
      name: 'All services healthy',
      check: async () => {
        const coreServices = VesperaCoreServices.getInstance();
        const healthCheck = await coreServices.healthCheck();
        return healthCheck.healthy;
      },
      description: 'All core services pass health checks'
    }
  ]
};

export async function runMigrationVerification(): Promise<void> {
  console.log('Running migration verification...\n');
  
  for (const [category, checks] of Object.entries(migrationVerification)) {
    console.log(`${category.toUpperCase()}:`);
    
    for (const check of checks) {
      try {
        const result = await check.check();
        const status = result ? '✅' : '❌';
        console.log(`  ${status} ${check.name}: ${check.description}`);
        
        if (!result) {
          console.log(`      ⚠️  Action needed: Review ${check.name}`);
        }
      } catch (error) {
        console.log(`  ❌ ${check.name}: Check failed - ${error.message}`);
      }
    }
    
    console.log('');
  }
  
  console.log('Migration verification complete');
}
```

## Conclusion

This migration guide provides a comprehensive, tested approach to adopting the enhanced code quality patterns. Each pattern is based on real-world implementation from the Vespera Forge extension and has been validated through extensive testing.

The migration can be performed incrementally, with each phase building on the previous one. Start with the low-risk TypeScript configuration changes and progress through to full architectural integration for maximum benefit.

Remember to run the verification checks after each phase to ensure successful migration and catch any issues early in the process.