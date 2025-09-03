# Troubleshooting Guide for Code Quality Improvements

## Overview

This guide provides comprehensive troubleshooting procedures for issues that may arise when implementing or using the code quality improvements from Vespera Forge. All solutions are based on real-world scenarios and tested fixes.

## Table of Contents

1. [Common Issues Quick Reference](#common-issues-quick-reference)
2. [Memory Management Issues](#memory-management-issues)
3. [Error Handling Issues](#error-handling-issues)
4. [TypeScript Configuration Issues](#typescript-configuration-issues)
5. [Core Services Issues](#core-services-issues)
6. [Performance Issues](#performance-issues)
7. [Integration Issues](#integration-issues)
8. [Testing Issues](#testing-issues)
9. [Debug Tools and Diagnostics](#debug-tools-and-diagnostics)
10. [Emergency Procedures](#emergency-procedures)

## Common Issues Quick Reference

| Symptom | Most Likely Cause | Quick Fix | Section |
|---------|------------------|-----------|---------|
| "VesperaCoreServices not initialized" | Missing initialization call | Add `VesperaCoreServices.initialize()` in activate() | [Core Services](#core-services-issues) |
| Memory usage keeps growing | Resources not being disposed | Check disposal patterns and WeakMap usage | [Memory Management](#memory-management-issues) |
| TypeScript compilation errors | Enhanced strict mode issues | Fix array access and optional properties | [TypeScript](#typescript-configuration-issues) |
| Errors not being handled | Missing error handler integration | Configure error strategies and use handleError() | [Error Handling](#error-handling-issues) |
| Extension activation fails | Service dependency issues | Check initialization order | [Core Services](#core-services-issues) |
| Tests failing after migration | Mock incompatibility | Update test mocks and setup | [Testing](#testing-issues) |

## Memory Management Issues

### Issue: Memory Usage Continuously Growing

**Symptoms:**
- Extension memory usage increases over time
- VS Code becomes sluggish
- Memory diagnostic shows growing resource count

**Diagnosis Steps:**
```typescript
// 1. Check memory statistics
import { getMemoryStats } from './extension';

const memStats = getMemoryStats();
if (memStats) {
  console.log('Memory Usage:', {
    heapUsedMB: Math.round(memStats.memoryUsage.heapUsed / 1024 / 1024),
    registeredResources: memStats.registeredResources,
    resourceTypes: memStats.resourceTypes
  });
}

// 2. Run memory diagnostics
import { runMemoryDiagnostics } from './extension';
await runMemoryDiagnostics();
```

**Common Causes and Fixes:**

#### 1. Resources Not Implementing DisposableResource

**Problem:**
```typescript
// Resource not properly implementing disposal
class MyProvider {
  private timers: NodeJS.Timeout[] = [];
  
  constructor() {
    this.timers.push(setInterval(() => {
      // Some periodic work
    }, 1000));
  }
  
  // Missing dispose method!
}
```

**Fix:**
```typescript
import { DisposableResource } from '@/core';

class MyProvider implements DisposableResource {
  private timers: NodeJS.Timeout[] = [];
  private disposed = false;
  
  constructor() {
    this.timers.push(setInterval(() => {
      // Some periodic work
    }, 1000));
  }
  
  async dispose(): Promise<void> {
    if (this.disposed) return;
    
    // Clear all timers
    this.timers.forEach(timer => clearInterval(timer));
    this.timers.length = 0;
    
    this.disposed = true;
  }
  
  get isDisposed(): boolean {
    return this.disposed;
  }
}
```

#### 2. Event Listeners Not Being Removed

**Problem:**
```typescript
class MyService {
  constructor() {
    // Event listeners added but never removed
    vscode.workspace.onDidChangeConfiguration(this.onConfigChange);
    vscode.window.onDidChangeActiveTextEditor(this.onEditorChange);
  }
}
```

**Fix:**
```typescript
import { ManagedResource } from '@/base/ManagedResource';

class MyService extends ManagedResource {
  private subscriptions: vscode.Disposable[] = [];
  
  constructor() {
    super('MyService');
    
    // Track subscriptions for disposal
    this.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(this.onConfigChange.bind(this)),
      vscode.window.onDidChangeActiveTextEditor(this.onEditorChange.bind(this))
    );
  }
  
  protected async performDisposal(): Promise<void> {
    // Dispose all subscriptions
    this.subscriptions.forEach(sub => sub.dispose());
    this.subscriptions.length = 0;
  }
}
```

#### 3. WeakMap Context Not Being Used

**Problem:**
```typescript
// Global context storage - memory leak risk
let globalContext: any = {};

export function setGlobalContext(context: any) {
  globalContext = context;
}
```

**Fix:**
```typescript
import { VesperaContextManager } from '@/core';

// Use WeakMap-based context manager
const contextManager = VesperaContextManager.getInstance();

export function setViewContext(
  extensionContext: vscode.ExtensionContext, 
  viewContext: any
) {
  contextManager.setViewContext(extensionContext, viewContext);
}

export function getViewContext(extensionContext: vscode.ExtensionContext) {
  return contextManager.getViewContext(extensionContext);
}
```

### Issue: "Resource registry shows stale resources"

**Diagnosis:**
```typescript
// Check for stale resources
const contextManager = VesperaCoreServices.getInstance().contextManager;
const cleanup = await contextManager.cleanupStaleResources(5 * 60 * 1000); // 5 minutes

console.log('Stale resources cleanup:', {
  cleaned: cleanup.cleaned,
  errors: cleanup.errors
});
```

**Fix:**
```typescript
// Ensure resources update their access time
class MyResource implements DisposableResource {
  private contextManager = VesperaCoreServices.getInstance().contextManager;
  private resourceId: string;
  
  constructor() {
    this.resourceId = this.contextManager.registerResource(
      this,
      'MyResource',
      `my-resource-${Date.now()}`
    );
  }
  
  public performOperation(): void {
    // Update access time when resource is used
    this.contextManager.updateResourceMetadata(this.resourceId, {
      lastAccessedAt: Date.now()
    });
    
    // Perform operation...
  }
  
  async dispose(): Promise<void> {
    // Disposal logic...
  }
  
  get isDisposed(): boolean {
    return this.disposed;
  }
}
```

### Issue: Memory Monitoring Not Working

**Symptoms:**
- No memory alerts despite high usage
- Memory monitoring statistics show 0 checks

**Diagnosis:**
```typescript
// Check if memory monitoring is enabled
const coreServices = VesperaCoreServices.getInstance();
const healthCheck = await coreServices.healthCheck();

console.log('Memory monitoring status:', {
  contextManagerHealthy: healthCheck.services.contextManager.healthy,
  memoryStats: healthCheck.stats.memory
});
```

**Fix:**
```typescript
// Ensure memory monitoring is enabled in configuration
const coreConfig: VesperaCoreServicesConfig = {
  memoryMonitoring: {
    enabled: true,        // Must be true
    thresholdMB: 150,     // Appropriate threshold
    checkIntervalMs: 30000 // Check interval
  }
};

const coreServices = await VesperaCoreServices.initialize(context, coreConfig);
```

## Error Handling Issues

### Issue: Errors Not Being Caught by Central Handler

**Symptoms:**
- Console shows unhandled errors
- VS Code error notifications appear instead of custom handling
- Error statistics show no errors processed

**Diagnosis Steps:**
```typescript
// 1. Check if error handler is configured
const errorHandler = VesperaCoreServices.getInstance().errorHandler;
const stats = errorHandler.getStats();

console.log('Error handler stats:', {
  totalErrorsHandled: stats.totalErrorsHandled,
  errorsByCode: stats.errorsByCode
});

// 2. Test error handling
try {
  throw new Error('Test error');
} catch (error) {
  await errorHandler.handleError(error);
}
```

**Common Causes and Fixes:**

#### 1. Not Using handleError in Async Operations

**Problem:**
```typescript
class MyService {
  async performOperation(): Promise<void> {
    try {
      await riskyOperation();
    } catch (error) {
      console.error('Operation failed:', error); // Not using central handler
      throw error;
    }
  }
}
```

**Fix:**
```typescript
import { ServiceAwareComponent } from '@/base/ServiceAwareComponent';

class MyService extends ServiceAwareComponent {
  async performOperation(): Promise<void> {
    try {
      await riskyOperation();
    } catch (error) {
      await this.handleError(error, {
        operation: 'performOperation',
        service: 'MyService'
      });
      throw error; // Re-throw if needed
    }
  }
  
  protected getDefaultErrorCode(): VesperaErrorCode {
    return VesperaErrorCode.PROVIDER_REQUEST_FAILED;
  }
}
```

#### 2. Promise Rejections Not Handled

**Problem:**
```typescript
// Unhandled promise rejection
async function problemFunction() {
  someAsyncOperation(); // Not awaited - rejection not caught
  return 'success';
}
```

**Fix:**
```typescript
async function fixedFunction() {
  try {
    await someAsyncOperation(); // Properly awaited
    return 'success';
  } catch (error) {
    const errorHandler = VesperaCoreServices.getInstance().errorHandler;
    await errorHandler.handleError(error);
    throw error;
  }
}
```

#### 3. Error Strategies Not Configured

**Problem:**
```typescript
// Custom error code without strategy
const customError = new VesperaError(
  'Custom operation failed',
  9999 as VesperaErrorCode, // No strategy configured
  VesperaSeverity.HIGH
);

await errorHandler.handleError(customError); // Uses default strategy
```

**Fix:**
```typescript
// Configure strategy for custom error codes
const errorHandler = VesperaCoreServices.getInstance().errorHandler;

errorHandler.setStrategy(9999 as VesperaErrorCode, {
  shouldLog: true,
  shouldNotifyUser: true,
  shouldThrow: false,
  shouldRetry: true,
  maxRetries: 3,
  retryDelay: 1000
});

// Now the error will use the custom strategy
await errorHandler.handleError(customError);
```

### Issue: Retry Logic Not Working

**Diagnosis:**
```typescript
// Test retry functionality
const errorHandler = VesperaCoreServices.getInstance().errorHandler;

let attemptCount = 0;
const operation = jest.fn().mockImplementation(() => {
  attemptCount++;
  if (attemptCount < 3) {
    throw new Error('Temporary failure');
  }
  return 'success';
});

try {
  const result = await errorHandler.executeWithRetry(
    operation,
    VesperaErrorCode.SERVICE_CONNECTION_FAILED
  );
  console.log(`Succeeded after ${attemptCount} attempts:`, result);
} catch (error) {
  console.log(`Failed after ${attemptCount} attempts:`, error.message);
}
```

**Common Fixes:**

#### 1. Error Not Marked as Retryable

**Problem:**
```typescript
// Error not configured as retryable
errorHandler.setStrategy(VesperaErrorCode.CONFIGURATION_VALIDATION_FAILED, {
  shouldRetry: false // Should not retry validation errors
});
```

**Fix:**
```typescript
// Configure retryable errors appropriately
errorHandler.setStrategy(VesperaErrorCode.SERVICE_CONNECTION_FAILED, {
  shouldLog: true,
  shouldNotifyUser: false,
  shouldThrow: false,
  shouldRetry: true,      // Enable retry
  maxRetries: 3,          // Set max attempts
  retryDelay: 1000        // Set delay between attempts
});
```

#### 2. Wrong Error Code Used

**Problem:**
```typescript
// Using wrong error code for retry
await errorHandler.executeWithRetry(
  operation,
  VesperaErrorCode.CONFIGURATION_VALIDATION_FAILED // This shouldn't retry
);
```

**Fix:**
```typescript
// Use appropriate error code for retryable operations
await errorHandler.executeWithRetry(
  operation,
  VesperaErrorCode.SERVICE_CONNECTION_FAILED // This should retry
);
```

### Issue: User Notifications Not Appearing

**Diagnosis:**
```typescript
// Check if notifications are configured
const strategy = errorHandler.getStrategy(VesperaErrorCode.CONFIGURATION_LOAD_FAILED);
console.log('Notification strategy:', {
  shouldNotifyUser: strategy.shouldNotifyUser,
  shouldLog: strategy.shouldLog
});

// Test notification manually
vscode.window.showErrorMessage('Test notification');
```

**Fix:**
```typescript
// Ensure error strategy enables user notifications
errorHandler.setStrategy(VesperaErrorCode.CONFIGURATION_LOAD_FAILED, {
  shouldLog: true,
  shouldNotifyUser: true, // Must be true for notifications
  shouldThrow: false,
  shouldRetry: true
});
```

## TypeScript Configuration Issues

### Issue: Compilation Errors After Enhanced Configuration

**Common TypeScript errors and fixes:**

#### 1. Array Access Safety Errors

**Error:**
```
Object is possibly 'undefined'. TS2532
```

**Problem Code:**
```typescript
const items = ['a', 'b', 'c'];
const firstItem = items[0]; // Type: string | undefined
console.log(firstItem.toUpperCase()); // Error: possibly undefined
```

**Fix:**
```typescript
const items = ['a', 'b', 'c'];
const firstItem = items[0];

// Option 1: Safe access with conditional
if (firstItem) {
  console.log(firstItem.toUpperCase());
}

// Option 2: Use optional chaining
console.log(firstItem?.toUpperCase() ?? 'DEFAULT');

// Option 3: Use non-null assertion (if you're certain)
console.log(firstItem!.toUpperCase());

// Option 4: Use .at() method with fallback
console.log((items.at(0) ?? 'default').toUpperCase());
```

#### 2. Optional Property Errors

**Error:**
```
Type 'undefined' is not assignable to type 'boolean' with 'exactOptionalPropertyTypes'. TS2375
```

**Problem Code:**
```typescript
interface Config {
  feature?: boolean;
}

const config: Config = {};
config.feature = undefined; // Error with exactOptionalPropertyTypes
```

**Fix:**
```typescript
interface Config {
  feature?: boolean;
}

const config: Config = {};

// Option 1: Conditional assignment
if (shouldEnable) {
  config.feature = true;
} else {
  delete config.feature; // Remove property instead of setting undefined
}

// Option 2: Use Partial for updates
function updateConfig(updates: Partial<Config>) {
  // Only assign defined values
  Object.keys(updates).forEach(key => {
    const value = updates[key as keyof Config];
    if (value !== undefined) {
      config[key as keyof Config] = value as any;
    }
  });
}
```

#### 3. Function Return Type Errors

**Error:**
```
Not all code paths return a value. TS7030
```

**Problem Code:**
```typescript
function processData(data: string[]): string {
  if (data.length > 0) {
    return data[0];
  }
  // Missing return statement
}
```

**Fix:**
```typescript
function processData(data: string[]): string {
  if (data.length > 0) {
    return data[0];
  }
  return ''; // Explicit return for all code paths
}

// Or use explicit return type for clarity
function processDataSafe(data: string[]): string | null {
  if (data.length > 0) {
    return data[0];
  }
  return null; // Explicit null return
}
```

#### 4. Switch Case Fallthrough Errors

**Error:**
```
Fallthrough case in switch. TS7029
```

**Problem Code:**
```typescript
function handleStatus(status: string): string {
  switch (status) {
    case 'pending':
    case 'processing': // Fallthrough without explicit intent
      return 'In Progress';
    case 'complete':
      return 'Done';
    default:
      return 'Unknown';
  }
}
```

**Fix:**
```typescript
function handleStatus(status: string): string {
  switch (status) {
    case 'pending':
    case 'processing': // Explicit fallthrough is allowed
      return 'In Progress';
    case 'complete':
      return 'Done';
    case 'error':
      // Add explicit break or return for non-fallthrough cases
      return 'Failed';
    default:
      return 'Unknown';
  }
}
```

### Issue: Path Mapping Not Working

**Symptoms:**
- Import statements using `@/` prefix not resolving
- Module not found errors

**Diagnosis:**
```typescript
// Try importing from path mapping
try {
  const { VesperaCoreServices } = require('@/core');
  console.log('Path mapping working');
} catch (error) {
  console.log('Path mapping failed:', error.message);
}
```

**Fix:**
```json
// Ensure tsconfig.json has correct path mapping
{
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"],
      "@/core/*": ["core/*"],
      "@/utils/*": ["utils/*"]
    }
  }
}
```

**Also check:**
```json
// package.json - ensure ts-node supports path mapping
{
  "ts-node": {
    "require": ["tsconfig-paths/register"]
  }
}
```

## Core Services Issues

### Issue: "VesperaCoreServices not initialized"

**Symptoms:**
- Error when trying to access core services
- Extension functionality not working

**Diagnosis:**
```typescript
// Check initialization status
import { VesperaCoreServices } from '@/core';

console.log('Core services initialized:', VesperaCoreServices.isInitialized());

if (VesperaCoreServices.isInitialized()) {
  const services = VesperaCoreServices.getInstance();
  const healthCheck = await services.healthCheck();
  console.log('Health check:', healthCheck);
}
```

**Fix:**
```typescript
// Ensure initialization in activate function
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  try {
    // Initialize core services FIRST
    const coreServices = await VesperaCoreServices.initialize(context, {
      logging: { level: isDevelopment() ? 1 : 2 },
      memoryMonitoring: { enabled: true },
      telemetry: { enabled: true }
    });

    // Initialize other components AFTER core services
    await initializeComponents(context, coreServices);

    console.log('Extension activated successfully');
  } catch (error) {
    console.error('Extension activation failed:', error);
    throw error;
  }
}
```

### Issue: Service Health Check Failures

**Diagnosis:**
```typescript
// Detailed health check
const coreServices = VesperaCoreServices.getInstance();
const healthCheck = await coreServices.healthCheck();

console.log('Health check results:', {
  overall: healthCheck.healthy,
  services: Object.entries(healthCheck.services).map(([name, status]) => ({
    name,
    healthy: status.healthy,
    error: status.error
  }))
});
```

**Common Service Issues and Fixes:**

#### 1. Logger Service Unhealthy

**Fix:**
```typescript
// Check logger configuration
const loggerConfig = {
  level: 1, // Ensure valid log level (0-4)
  enableConsole: true,
  enableVSCodeOutput: true
};

// Reinitialize if needed
const coreServices = await VesperaCoreServices.initialize(context, {
  logging: loggerConfig
});
```

#### 2. Context Manager Unhealthy

**Fix:**
```typescript
// Check context manager state
const contextManager = coreServices.contextManager;
const memStats = contextManager.getMemoryStats();

if (memStats.registeredResources < 0) {
  // Corrupted state - reinitialize
  await coreServices.dispose();
  const newCoreServices = await VesperaCoreServices.initialize(context);
}
```

### Issue: Service Initialization Order Problems

**Symptoms:**
- Dependencies not available when needed
- Circular dependency errors

**Fix:**
```typescript
// Use proper initialization order
export class ExtensionInitializer {
  static async initialize(context: vscode.ExtensionContext): Promise<void> {
    // 1. Core services first
    const coreServices = await VesperaCoreServices.initialize(context);
    
    // 2. Configuration services (depend on core)
    const configService = new ConfigurationService();
    await configService.initialize();
    
    // 3. Business services (depend on config)
    const apiService = new ApiService(configService.getApiConfig());
    await apiService.initialize();
    
    // 4. UI components (depend on business services)
    const providers = initializeProviders(context, apiService);
    
    // 5. Register everything for cleanup
    const { disposalManager } = coreServices;
    disposalManager.addAll([
      configService,
      apiService,
      ...providers
    ]);
  }
}
```

## Performance Issues

### Issue: Slow Extension Activation

**Diagnosis:**
```typescript
// Measure activation time
const startTime = Date.now();

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const initStart = Date.now();
  
  await VesperaCoreServices.initialize(context);
  console.log(`Core services initialized in ${Date.now() - initStart}ms`);
  
  const providersStart = Date.now();
  await initializeProviders(context);
  console.log(`Providers initialized in ${Date.now() - providersStart}ms`);
  
  console.log(`Total activation time: ${Date.now() - startTime}ms`);
}
```

**Common Causes and Fixes:**

#### 1. Synchronous Operations in Activation

**Problem:**
```typescript
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Blocking operations during activation
  const heavyData = await loadHeavyDataSynchronously();
  const apiCheck = await checkApiAvailability();
  
  await initializeComponents(heavyData, apiCheck);
}
```

**Fix:**
```typescript
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Initialize core services first
  await VesperaCoreServices.initialize(context);
  
  // Initialize lightweight components
  await initializeLightweightComponents(context);
  
  // Defer heavy operations
  setImmediate(async () => {
    try {
      const heavyData = await loadHeavyDataAsynchronously();
      await initializeHeavyComponents(heavyData);
    } catch (error) {
      const errorHandler = VesperaCoreServices.getInstance().errorHandler;
      await errorHandler.handleError(error);
    }
  });
}
```

#### 2. Memory Monitoring Overhead

**Problem:**
```typescript
// Too frequent memory checks
const coreConfig = {
  memoryMonitoring: {
    enabled: true,
    checkIntervalMs: 1000 // Too frequent - every second
  }
};
```

**Fix:**
```typescript
// Reasonable monitoring frequency
const coreConfig = {
  memoryMonitoring: {
    enabled: true,
    checkIntervalMs: 30000, // Every 30 seconds
    thresholdMB: 200        // Higher threshold for less frequent alerts
  }
};
```

### Issue: High Memory Usage During Error Handling

**Diagnosis:**
```typescript
// Monitor error handling performance
const errorHandler = VesperaCoreServices.getInstance().errorHandler;

const startMemory = process.memoryUsage();
const startTime = Date.now();

// Generate test errors
for (let i = 0; i < 100; i++) {
  await errorHandler.handleError(new Error(`Test error ${i}`));
}

const endMemory = process.memoryUsage();
const endTime = Date.now();

console.log('Error handling performance:', {
  memoryIncrease: Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024),
  timePerError: (endTime - startTime) / 100,
  stats: errorHandler.getStats()
});
```

**Fix:**
```typescript
// Configure error handling for performance
const errorHandler = VesperaCoreServices.getInstance().errorHandler;

// Disable telemetry for high-frequency errors
errorHandler.setStrategy(VesperaErrorCode.COMPONENT_RENDER_FAILED, {
  shouldLog: false,     // Reduce logging overhead
  shouldNotifyUser: false,
  shouldThrow: false,
  shouldRetry: false    // Avoid retry overhead
});

// Enable batching for similar errors
const batchedErrors = new Map<string, { count: number; lastSeen: number }>();

function handleBatchedError(error: Error): void {
  const key = `${error.name}:${error.message}`;
  const now = Date.now();
  
  const existing = batchedErrors.get(key);
  if (existing && (now - existing.lastSeen) < 5000) { // 5 second window
    existing.count++;
    existing.lastSeen = now;
    return; // Don't handle duplicate errors
  }
  
  batchedErrors.set(key, { count: 1, lastSeen: now });
  errorHandler.handleError(error);
}
```

### Issue: Slow Disposal Performance

**Diagnosis:**
```typescript
// Measure disposal performance
const disposalManager = VesperaCoreServices.getInstance().disposalManager;

const startTime = Date.now();
const result = await disposalManager.dispose();
const endTime = Date.now();

console.log('Disposal performance:', {
  totalTime: result.totalTime,
  successful: result.successful,
  failed: result.failed,
  averageTimePerResource: result.totalTime / (result.successful + result.failed),
  measuredTotalTime: endTime - startTime
});
```

**Fix:**
```typescript
// Optimize disposal with priorities and batching
class OptimizedResource implements DisposableResource {
  public readonly disposalPriority = 5; // Set appropriate priority
  
  async dispose(): Promise<void> {
    // Batch disposal operations
    const disposalPromises = [
      this.cleanupSubscriptions(),
      this.clearTimers(),
      this.clearCache()
    ];
    
    // Use Promise.allSettled to avoid blocking on failures
    const results = await Promise.allSettled(disposalPromises);
    
    // Log failures but don't throw
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.warn(`Disposal step ${index} failed:`, result.reason);
      }
    });
  }
  
  private async cleanupSubscriptions(): Promise<void> {
    // Fast batch cleanup
    this.subscriptions.forEach(sub => {
      try { sub.dispose(); } catch (e) { /* ignore */ }
    });
    this.subscriptions.length = 0;
  }
}
```

## Integration Issues

### Issue: Existing Code Conflicts with New Patterns

**Problem:**
```typescript
// Existing global state conflicts with new patterns
let globalState = {
  currentUser: null,
  settings: {}
};

// New memory-managed approach conflicts
const contextManager = VesperaCoreServices.getInstance().contextManager;
```

**Fix - Gradual Migration:**
```typescript
// Create bridge between old and new patterns
class LegacyBridge {
  private static contextManager = VesperaCoreServices.getInstance().contextManager;
  
  // Gradually migrate global state
  static setGlobalState(key: string, value: any, context: vscode.ExtensionContext): void {
    // Store in new pattern
    const existingContext = this.contextManager.getViewContext(context) || {};
    existingContext[key] = value;
    this.contextManager.setViewContext(context, existingContext);
    
    // Keep old pattern for compatibility (temporarily)
    (globalState as any)[key] = value;
  }
  
  static getGlobalState(key: string, context: vscode.ExtensionContext): any {
    // Prefer new pattern
    const viewContext = this.contextManager.getViewContext(context);
    if (viewContext && key in viewContext) {
      return viewContext[key];
    }
    
    // Fall back to old pattern
    return (globalState as any)[key];
  }
}
```

### Issue: Service Dependency Loops

**Problem:**
```typescript
// Circular dependency
class ServiceA {
  constructor(private serviceB: ServiceB) {}
}

class ServiceB {
  constructor(private serviceA: ServiceA) {} // Circular!
}
```

**Fix:**
```typescript
// Use dependency injection with interfaces
interface IServiceA {
  doSomething(): void;
}

interface IServiceB {
  doSomethingElse(): void;
}

class ServiceA implements IServiceA {
  private serviceB?: IServiceB;
  
  setServiceB(serviceB: IServiceB): void {
    this.serviceB = serviceB;
  }
  
  doSomething(): void {
    this.serviceB?.doSomethingElse();
  }
}

class ServiceB implements IServiceB {
  private serviceA?: IServiceA;
  
  setServiceA(serviceA: IServiceA): void {
    this.serviceA = serviceA;
  }
  
  doSomethingElse(): void {
    this.serviceA?.doSomething();
  }
}

// Initialize with dependency injection
const serviceA = new ServiceA();
const serviceB = new ServiceB();

serviceA.setServiceB(serviceB);
serviceB.setServiceA(serviceA);
```

### Issue: Mock Conflicts in Tests

**Problem:**
```typescript
// Old mocks conflict with new service structure
jest.mock('vscode', () => ({
  window: {
    showErrorMessage: jest.fn()
  }
}));

// New error handler bypasses mock
const errorHandler = VesperaCoreServices.getInstance().errorHandler;
```

**Fix:**
```typescript
// Update mocks for new architecture
import { TestUtils } from '../utils/TestUtils';

describe('Service Tests', () => {
  beforeAll(async () => {
    await TestUtils.setupTestEnvironment();
  });
  
  afterAll(async () => {
    await TestUtils.teardownTestEnvironment();
  });
  
  test('error handling works correctly', async () => {
    const coreServices = TestUtils.getCoreServices();
    const errorHandler = coreServices.errorHandler;
    
    // Mock at the service level instead of VS Code level
    const handleErrorSpy = jest.spyOn(errorHandler, 'handleError');
    
    // Test error handling
    await errorHandler.handleError(new Error('Test error'));
    
    expect(handleErrorSpy).toHaveBeenCalled();
  });
});
```

## Testing Issues

### Issue: Tests Failing After Migration

**Common causes and fixes:**

#### 1. Async Initialization Not Awaited

**Problem:**
```typescript
describe('My Extension', () => {
  test('should work', async () => {
    // Not awaiting initialization
    VesperaCoreServices.initialize(mockContext);
    
    const services = VesperaCoreServices.getInstance(); // May fail
  });
});
```

**Fix:**
```typescript
describe('My Extension', () => {
  beforeEach(async () => {
    await TestUtils.setupTestEnvironment();
  });
  
  afterEach(async () => {
    await TestUtils.teardownTestEnvironment();
  });
  
  test('should work', async () => {
    const services = TestUtils.getCoreServices();
    // Services are now properly initialized
  });
});
```

#### 2. Memory Management in Tests

**Problem:**
```typescript
// Resources not cleaned up between tests
test('test 1', async () => {
  const resource = new ManagedResource();
  // Resource not disposed
});

test('test 2', async () => {
  // Previous test's resources still in memory
});
```

**Fix:**
```typescript
describe('Resource Tests', () => {
  const testResources: DisposableResource[] = [];
  
  afterEach(async () => {
    // Clean up all test resources
    await Promise.all(
      testResources.map(resource => 
        resource.dispose().catch(console.warn)
      )
    );
    testResources.length = 0;
  });
  
  function createTestResource<T extends DisposableResource>(
    factory: () => T
  ): T {
    const resource = factory();
    testResources.push(resource);
    return resource;
  }
  
  test('test with managed resource', async () => {
    const resource = createTestResource(() => new ManagedResource());
    // Resource will be cleaned up automatically
  });
});
```

#### 3. VS Code API Mocking Issues

**Problem:**
```typescript
// Incomplete VS Code API mocking
jest.mock('vscode', () => ({
  window: {
    showErrorMessage: jest.fn()
  }
  // Missing other required APIs
}));
```

**Fix:**
```typescript
// Complete VS Code API mock
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn(),
      has: jest.fn(),
      inspect: jest.fn(),
      update: jest.fn()
    }),
    onDidChangeConfiguration: jest.fn().mockReturnValue({
      dispose: jest.fn()
    })
  },
  window: {
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    createOutputChannel: jest.fn().mockReturnValue({
      append: jest.fn(),
      appendLine: jest.fn(),
      show: jest.fn(),
      dispose: jest.fn()
    })
  },
  commands: {
    executeCommand: jest.fn(),
    registerCommand: jest.fn().mockReturnValue({
      dispose: jest.fn()
    })
  },
  Uri: {
    file: jest.fn(path => ({ fsPath: path, scheme: 'file' }))
  },
  // Add other required APIs...
}));
```

## Debug Tools and Diagnostics

### Built-in Diagnostic Commands

Use these commands in VS Code Command Palette:

1. **"Vespera Forge: Run Memory Diagnostics"**
   - Shows comprehensive memory usage
   - Lists registered resources
   - Displays memory monitoring statistics

2. **"Vespera Forge: Check System Health"**
   - Verifies all core services are healthy
   - Shows service status and errors
   - Provides system statistics

3. **"Vespera Forge: Force Memory Cleanup"**
   - Triggers manual garbage collection
   - Cleans up stale resources
   - Shows memory freed

### Programmatic Diagnostics

```typescript
// Memory diagnostics
import { getMemoryStats, runMemoryDiagnostics } from './extension';

const memStats = getMemoryStats();
console.log('Current memory state:', memStats);

await runMemoryDiagnostics(); // Shows detailed UI

// Health check
import { performHealthCheck } from './extension';

const health = await performHealthCheck();
console.log('System health:', health);

// Error handler diagnostics
const errorHandler = VesperaCoreServices.getInstance().errorHandler;
const errorStats = errorHandler.getStats();
console.log('Error handling statistics:', errorStats);
```

### Debug Logging

```typescript
// Enable debug logging
const coreServices = await VesperaCoreServices.initialize(context, {
  logging: {
    level: 0, // TRACE level - most verbose
    enableConsole: true,
    enableVSCodeOutput: true
  }
});

// Check logs in:
// - VS Code Output panel > "Vespera Forge - Core"
// - Browser Developer Tools console (F12)
```

### Performance Profiling

```typescript
// Profile specific operations
async function profileOperation<T>(
  name: string, 
  operation: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();
  const startMemory = process.memoryUsage();
  
  try {
    const result = await operation();
    
    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    
    console.log(`[PROFILE] ${name}:`, {
      duration: `${(endTime - startTime).toFixed(2)}ms`,
      memoryDelta: `${Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024)}KB`
    });
    
    return result;
  } catch (error) {
    const endTime = performance.now();
    console.log(`[PROFILE] ${name} FAILED:`, {
      duration: `${(endTime - startTime).toFixed(2)}ms`,
      error: error.message
    });
    throw error;
  }
}

// Usage
const result = await profileOperation('Heavy Operation', async () => {
  return await performHeavyOperation();
});
```

## Emergency Procedures

### Emergency: Extension Completely Broken

**Immediate Steps:**
1. **Disable Extension**: In VS Code Extensions panel, disable your extension
2. **Check Output Logs**: View Output > Select your extension channel
3. **Clear Extension State**: 
   ```bash
   # Close VS Code
   # Clear extension storage (varies by OS)
   # Windows: %APPDATA%\Code\User\workspaceStorage\
   # macOS: ~/Library/Application Support/Code/User/workspaceStorage/
   # Linux: ~/.config/Code/User/workspaceStorage/
   ```

**Recovery Code:**
```typescript
// Add to activate() function for emergency recovery
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  try {
    // Normal activation
    await normalActivation(context);
  } catch (error) {
    console.error('Normal activation failed, entering recovery mode:', error);
    
    // Emergency recovery mode
    try {
      await emergencyRecovery(context);
      vscode.window.showWarningMessage(
        'Extension activated in recovery mode. Some features may be limited.'
      );
    } catch (recoveryError) {
      console.error('Recovery mode failed:', recoveryError);
      
      // Last resort - minimal activation
      await minimalActivation(context);
      vscode.window.showErrorMessage(
        'Extension activated with minimal features only. Please restart VS Code.'
      );
    }
  }
}

async function emergencyRecovery(context: vscode.ExtensionContext): Promise<void> {
  // Initialize only core services with minimal config
  const coreServices = await VesperaCoreServices.initialize(context, {
    logging: { level: 2, enableConsole: true },
    memoryMonitoring: { enabled: false },
    telemetry: { enabled: false }
  });
  
  // Register only essential commands
  context.subscriptions.push(
    vscode.commands.registerCommand('myExtension.emergencyCleanup', async () => {
      await coreServices.disposalManager.dispose();
      vscode.window.showInformationMessage('Emergency cleanup completed');
    })
  );
}

async function minimalActivation(context: vscode.ExtensionContext): Promise<void> {
  // Absolute minimal activation - just register a help command
  context.subscriptions.push(
    vscode.commands.registerCommand('myExtension.showHelp', () => {
      vscode.window.showInformationMessage(
        'Extension is in minimal mode. Please check Output logs and restart VS Code.'
      );
    })
  );
}
```

### Emergency: Memory Leak Crisis

**Immediate Action:**
```typescript
// Emergency memory cleanup command
vscode.commands.registerCommand('myExtension.emergencyMemoryCleanup', async () => {
  try {
    // Force cleanup all resources
    if (VesperaCoreServices.isInitialized()) {
      const { contextManager } = VesperaCoreServices.getInstance();
      
      // Clean all stale resources (0ms = everything)
      const cleanup = await contextManager.cleanupStaleResources(0);
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      
      vscode.window.showInformationMessage(
        `Emergency cleanup: ${cleanup.cleaned} resources cleaned, ${cleanup.errors} errors`
      );
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Emergency cleanup failed: ${error.message}`);
  }
});
```

### Emergency: Error Handler Loop

**Problem:** Error handler causes more errors, creating infinite loop.

**Fix:**
```typescript
// Circuit breaker for error handler
class ErrorHandlerCircuitBreaker {
  private errorCount = 0;
  private lastErrorTime = 0;
  private readonly maxErrors = 5;
  private readonly timeWindow = 10000; // 10 seconds
  
  canHandleError(): boolean {
    const now = Date.now();
    
    if (now - this.lastErrorTime > this.timeWindow) {
      // Reset counter after time window
      this.errorCount = 0;
    }
    
    if (this.errorCount >= this.maxErrors) {
      console.error('[CIRCUIT BREAKER] Error handler temporarily disabled');
      return false;
    }
    
    this.errorCount++;
    this.lastErrorTime = now;
    return true;
  }
}

const circuitBreaker = new ErrorHandlerCircuitBreaker();

// Wrap error handler
const originalHandleError = errorHandler.handleError.bind(errorHandler);
errorHandler.handleError = async (error: Error) => {
  if (circuitBreaker.canHandleError()) {
    try {
      await originalHandleError(error);
    } catch (handlerError) {
      // Log but don't re-throw to break the loop
      console.error('Error handler itself failed:', handlerError);
    }
  } else {
    // Fallback to basic console logging
    console.error('[FALLBACK] Error handler circuit breaker active:', error);
  }
};
```

### Getting Help

**When to Seek Help:**
1. Memory usage > 500MB consistently
2. Extension activation > 10 seconds
3. More than 10 errors per minute
4. Any error containing "VesperaCoreServices"

**Information to Include:**
```typescript
// Generate debug report
async function generateDebugReport(): Promise<string> {
  const report = {
    timestamp: new Date().toISOString(),
    vsCodeVersion: vscode.version,
    extensionVersion: vscode.extensions.getExtension('your-extension-id')?.packageJSON.version,
    platform: process.platform,
    nodeVersion: process.version
  };
  
  if (VesperaCoreServices.isInitialized()) {
    const services = VesperaCoreServices.getInstance();
    const healthCheck = await services.healthCheck();
    const memStats = services.contextManager.getMemoryStats();
    const errorStats = services.errorHandler.getStats();
    
    Object.assign(report, {
      coreServicesHealthy: healthCheck.healthy,
      serviceIssues: Object.entries(healthCheck.services)
        .filter(([_, status]) => !status.healthy)
        .map(([name, status]) => ({ name, error: status.error })),
      memoryUsageMB: Math.round(memStats.memoryUsage.heapUsed / 1024 / 1024),
      registeredResources: memStats.registeredResources,
      totalErrorsHandled: errorStats.totalErrorsHandled,
      recentErrors: errorStats.recentErrors?.slice(-5)
    });
  }
  
  return JSON.stringify(report, null, 2);
}
```

## Conclusion

This troubleshooting guide covers the most common issues encountered when implementing code quality improvements. The key principles for troubleshooting are:

1. **Use Built-in Diagnostics**: Always start with the diagnostic commands
2. **Check Logs**: Review VS Code Output panel and console logs
3. **Isolate Issues**: Test individual components separately
4. **Follow Patterns**: Stick to the established patterns for consistency
5. **Monitor Resources**: Keep an eye on memory usage and disposal patterns

For issues not covered here, check the other documentation files or create a minimal reproduction case to isolate the problem.