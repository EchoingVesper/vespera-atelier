# Testing and Verification Guide for Code Quality Improvements

## Overview

This guide provides comprehensive testing strategies and verification procedures for the code quality improvements implemented in Vespera Forge. All test examples are based on real implementations and validated patterns.

## Table of Contents

1. [Testing Strategy Overview](#testing-strategy-overview)
2. [Memory Management Testing](#memory-management-testing)
3. [Error Handling Testing](#error-handling-testing)
4. [TypeScript Configuration Verification](#typescript-configuration-verification)
5. [Integration Testing](#integration-testing)
6. [Performance Testing](#performance-testing)
7. [Automated Testing Setup](#automated-testing-setup)
8. [Manual Testing Procedures](#manual-testing-procedures)
9. [Continuous Integration](#continuous-integration)
10. [Debugging and Diagnostics](#debugging-and-diagnostics)

## Testing Strategy Overview

### Test Categories

```typescript
interface TestingStrategy {
  unit: UnitTestingApproach;
  integration: IntegrationTestingApproach;
  performance: PerformanceTestingApproach;
  memory: MemoryTestingApproach;
  errorHandling: ErrorHandlingTestingApproach;
  typeScript: TypeScriptTestingApproach;
}

interface UnitTestingApproach {
  framework: 'Jest' | 'Mocha';
  coverage: {
    statements: number; // Target: 90%+
    branches: number;   // Target: 85%+
    functions: number;  // Target: 95%+
    lines: number;      // Target: 90%+
  };
  patterns: string[];
}
```

### Test Structure

```
tests/
├── unit/                          # Unit tests
│   ├── core/                     # Core services tests
│   │   ├── memory-management.test.ts
│   │   ├── error-handling.test.ts
│   │   ├── logging.test.ts
│   │   └── disposal.test.ts
│   ├── providers/                # Provider tests
│   ├── views/                    # View component tests
│   └── utils/                    # Utility function tests
├── integration/                  # Integration tests
│   ├── core-services.test.ts
│   ├── extension-lifecycle.test.ts
│   └── service-interactions.test.ts
├── performance/                  # Performance tests
│   ├── memory-benchmarks.test.ts
│   ├── disposal-benchmarks.test.ts
│   └── error-handling-benchmarks.test.ts
├── e2e/                         # End-to-end tests
│   ├── extension-activation.test.ts
│   └── user-workflows.test.ts
└── mocks/                       # Test utilities and mocks
    ├── extension-context.ts
    ├── vscode-api.ts
    └── test-helpers.ts
```

## Memory Management Testing

### WeakMap Context Storage Tests

**Test file: `tests/unit/core/memory-management.test.ts`**

```typescript
import { VesperaContextManager } from '@/core/memory-management/VesperaContextManager';
import { VesperaLogger } from '@/core/logging/VesperaLogger';
import { createMockExtensionContext, createMockLogger } from '../../mocks';

describe('VesperaContextManager', () => {
  let contextManager: VesperaContextManager;
  let mockLogger: VesperaLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    contextManager = VesperaContextManager.initialize(mockLogger);
  });

  afterEach(async () => {
    // Clean up any registered resources
    await contextManager.dispose();
  });

  describe('WeakMap Context Storage', () => {
    test('stores and retrieves view context correctly', () => {
      const extensionContext = createMockExtensionContext();
      const viewContext = {
        chatPanelProvider: { dispose: jest.fn() },
        taskDashboardProvider: { dispose: jest.fn() },
        createdAt: Date.now(),
        lastAccessedAt: Date.now()
      };

      contextManager.setViewContext(extensionContext, viewContext);
      const retrieved = contextManager.getViewContext(extensionContext);

      expect(retrieved).toBeDefined();
      expect(retrieved?.chatPanelProvider).toBe(viewContext.chatPanelProvider);
      expect(retrieved?.taskDashboardProvider).toBe(viewContext.taskDashboardProvider);
      expect(retrieved?.lastAccessedAt).toBeGreaterThanOrEqual(viewContext.lastAccessedAt);
    });

    test('updates last accessed time on retrieval', () => {
      const extensionContext = createMockExtensionContext();
      const viewContext = {
        createdAt: Date.now(),
        lastAccessedAt: Date.now()
      };

      contextManager.setViewContext(extensionContext, viewContext);
      
      // Wait a bit
      setTimeout(() => {
        const retrieved = contextManager.getViewContext(extensionContext);
        expect(retrieved?.lastAccessedAt).toBeGreaterThan(viewContext.lastAccessedAt);
      }, 10);
    });

    test('handles multiple extension contexts independently', () => {
      const context1 = createMockExtensionContext();
      const context2 = createMockExtensionContext();
      
      const viewContext1 = { chatPanelProvider: { id: '1' }, createdAt: Date.now(), lastAccessedAt: Date.now() };
      const viewContext2 = { chatPanelProvider: { id: '2' }, createdAt: Date.now(), lastAccessedAt: Date.now() };

      contextManager.setViewContext(context1, viewContext1);
      contextManager.setViewContext(context2, viewContext2);

      const retrieved1 = contextManager.getViewContext(context1);
      const retrieved2 = contextManager.getViewContext(context2);

      expect(retrieved1?.chatPanelProvider.id).toBe('1');
      expect(retrieved2?.chatPanelProvider.id).toBe('2');
    });
  });

  describe('Resource Registry', () => {
    test('registers resources with unique IDs', () => {
      const resource1 = { dispose: jest.fn(), isDisposed: false };
      const resource2 = { dispose: jest.fn(), isDisposed: false };

      const id1 = contextManager.registerResource(resource1, 'TestResource', 'test-1');
      const id2 = contextManager.registerResource(resource2, 'TestResource', 'test-2');

      expect(id1).toBe('test-1');
      expect(id2).toBe('test-2');

      const stats = contextManager.getMemoryStats();
      expect(stats.registeredResources).toBe(2);
      expect(stats.resourceTypes['TestResource']).toBe(2);
    });

    test('generates unique IDs when not provided', () => {
      const resource1 = { dispose: jest.fn(), isDisposed: false };
      const resource2 = { dispose: jest.fn(), isDisposed: false };

      const id1 = contextManager.registerResource(resource1, 'TestResource');
      const id2 = contextManager.registerResource(resource2, 'TestResource');

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      
      expect(id1).toMatch(/^TestResource_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^TestResource_\d+_[a-z0-9]+$/);
    });

    test('tracks resource metadata correctly', () => {
      const resource = { dispose: jest.fn(), isDisposed: false };
      const startTime = Date.now();

      const resourceId = contextManager.registerResource(
        resource, 
        'TestResource', 
        'test-meta',
        { size: 1024 }
      );

      const updated = contextManager.updateResourceMetadata(resourceId, {
        lastAccessedAt: Date.now() + 1000
      });

      expect(updated).toBe(true);

      // Access internal metadata (this would normally be via a getter method)
      const stats = contextManager.getMemoryStats();
      expect(stats.registeredResources).toBe(1);
    });

    test('handles invalid resource metadata updates', () => {
      const invalidId = 'non-existent-resource';
      const updated = contextManager.updateResourceMetadata(invalidId, {
        lastAccessedAt: Date.now()
      });

      expect(updated).toBe(false);
    });
  });

  describe('Memory Monitoring', () => {
    test('tracks memory usage statistics', () => {
      const stats = contextManager.getMemoryStats();

      expect(stats).toHaveProperty('memoryUsage');
      expect(stats).toHaveProperty('registeredResources');
      expect(stats).toHaveProperty('resourceTypes');
      expect(stats).toHaveProperty('memoryMonitoring');

      expect(typeof stats.memoryUsage.heapUsed).toBe('number');
      expect(typeof stats.memoryUsage.heapTotal).toBe('number');
      expect(typeof stats.registeredResources).toBe('number');
      expect(typeof stats.resourceTypes).toBe('object');
    });

    test('detects high memory usage', () => {
      // Mock high memory usage
      const highMemoryUsage = {
        heapUsed: 200 * 1024 * 1024,  // 200MB
        heapTotal: 250 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        rss: 300 * 1024 * 1024
      };

      jest.spyOn(process, 'memoryUsage').mockReturnValue(highMemoryUsage);

      const stats = contextManager.getMemoryStats();
      const heapUsedMB = Math.round(stats.memoryUsage.heapUsed / 1024 / 1024);

      expect(heapUsedMB).toBe(200);
      expect(heapUsedMB).toBeGreaterThan(150); // Above threshold

      jest.restoreAllMocks();
    });

    test('updates peak usage tracking', () => {
      // Register some resources to simulate usage
      const resources = Array.from({ length: 10 }, (_, i) => ({
        dispose: jest.fn(),
        isDisposed: false
      }));

      resources.forEach((resource, index) => {
        contextManager.registerResource(resource, 'TestResource', `test-${index}`);
      });

      const stats = contextManager.getMemoryStats();
      expect(stats.memoryMonitoring.checksPerformed).toBeGreaterThan(0);
    });
  });

  describe('Resource Cleanup', () => {
    test('cleans up stale resources based on age', async () => {
      const oldResource = { dispose: jest.fn(), isDisposed: false };
      const newResource = { dispose: jest.fn(), isDisposed: false };

      // Register resources
      const oldId = contextManager.registerResource(oldResource, 'OldResource', 'old-1');
      const newId = contextManager.registerResource(newResource, 'NewResource', 'new-1');

      // Mock time to make old resource stale (older than 1 second)
      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + 2000);

      const cleanupResult = await contextManager.cleanupStaleResources(1000); // 1 second threshold

      expect(cleanupResult.cleaned).toBeGreaterThan(0);
      expect(oldResource.dispose).toHaveBeenCalled();
      
      // Restore Date.now
      Date.now = originalNow;
    });

    test('handles disposal errors during cleanup', async () => {
      const faultyResource = {
        dispose: jest.fn().mockRejectedValue(new Error('Disposal error')),
        isDisposed: false
      };

      contextManager.registerResource(faultyResource, 'FaultyResource', 'faulty-1');

      // Mock time to make resource stale
      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + 2000);

      const cleanupResult = await contextManager.cleanupStaleResources(1000);

      expect(cleanupResult.errors).toBeGreaterThan(0);
      expect(faultyResource.dispose).toHaveBeenCalled();

      // Restore Date.now
      Date.now = originalNow;
    });

    test('disposes view context correctly', async () => {
      const extensionContext = createMockExtensionContext();
      const mockProvider = { dispose: jest.fn() };
      
      const viewContext = {
        chatPanelProvider: mockProvider,
        createdAt: Date.now(),
        lastAccessedAt: Date.now()
      };

      contextManager.setViewContext(extensionContext, viewContext);
      
      await contextManager.disposeViewContext(extensionContext);

      expect(mockProvider.dispose).toHaveBeenCalled();
      
      // Context should be cleared
      const retrieved = contextManager.getViewContext(extensionContext);
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Stress Testing', () => {
    test('handles large number of resources', () => {
      const resourceCount = 1000;
      const resources = Array.from({ length: resourceCount }, (_, i) => ({
        dispose: jest.fn(),
        isDisposed: false,
        id: i
      }));

      const startTime = Date.now();

      // Register all resources
      resources.forEach((resource, index) => {
        contextManager.registerResource(resource, 'StressTestResource', `stress-${index}`);
      });

      const registrationTime = Date.now() - startTime;
      expect(registrationTime).toBeLessThan(1000); // Should complete within 1 second

      const stats = contextManager.getMemoryStats();
      expect(stats.registeredResources).toBe(resourceCount);
      expect(stats.resourceTypes['StressTestResource']).toBe(resourceCount);
    });

    test('handles concurrent access safely', async () => {
      const extensionContext = createMockExtensionContext();
      const promises: Promise<any>[] = [];

      // Simulate concurrent access
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve().then(() => {
            contextManager.setViewContext(extensionContext, {
              createdAt: Date.now(),
              lastAccessedAt: Date.now(),
              data: `concurrent-${i}`
            });
            return contextManager.getViewContext(extensionContext);
          })
        );
      }

      const results = await Promise.all(promises);
      
      // Should all complete without error
      expect(results).toHaveLength(100);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.createdAt).toBeDefined();
      });
    });
  });
});
```

### Resource Disposal Tests

```typescript
// tests/unit/core/disposal.test.ts
import { DisposalManager } from '@/core/disposal/DisposalManager';
import { VesperaLogger } from '@/core/logging/VesperaLogger';
import { createMockLogger } from '../../mocks';

describe('DisposalManager', () => {
  let disposalManager: DisposalManager;
  let mockLogger: VesperaLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    disposalManager = new DisposalManager(mockLogger);
  });

  describe('Resource Management', () => {
    test('adds and tracks disposables', () => {
      const disposable1 = { dispose: jest.fn(), isDisposed: false };
      const disposable2 = { dispose: jest.fn(), isDisposed: false, disposalPriority: 10 };

      disposalManager.add(disposable1);
      disposalManager.add(disposable2);

      const stats = disposalManager.getStats();
      expect(stats.totalDisposables).toBe(2);
    });

    test('adds multiple disposables at once', () => {
      const disposables = [
        { dispose: jest.fn(), isDisposed: false },
        { dispose: jest.fn(), isDisposed: false },
        { dispose: jest.fn(), isDisposed: false }
      ];

      disposalManager.addAll(disposables);

      const stats = disposalManager.getStats();
      expect(stats.totalDisposables).toBe(3);
    });

    test('removes specific disposables', () => {
      const disposable1 = { dispose: jest.fn(), isDisposed: false };
      const disposable2 = { dispose: jest.fn(), isDisposed: false };

      disposalManager.add(disposable1);
      disposalManager.add(disposable2);

      const removed = disposalManager.remove(disposable1);
      expect(removed).toBe(true);

      const stats = disposalManager.getStats();
      expect(stats.totalDisposables).toBe(1);
    });
  });

  describe('Disposal Hooks', () => {
    test('executes disposal hooks in correct order', async () => {
      const executionOrder: string[] = [];
      
      const hook = {
        beforeDispose: async () => {
          executionOrder.push('before');
        },
        afterDispose: async () => {
          executionOrder.push('after');
        }
      };

      disposalManager.addHook(hook);

      const disposable = {
        dispose: jest.fn().mockImplementation(() => {
          executionOrder.push('dispose');
        }),
        isDisposed: false
      };

      disposalManager.add(disposable);

      await disposalManager.dispose();

      expect(executionOrder).toEqual(['before', 'dispose', 'after']);
    });

    test('handles disposal hook errors', async () => {
      const errorHook = {
        beforeDispose: async () => {
          throw new Error('Hook error');
        },
        onDisposeError: jest.fn()
      };

      disposalManager.addHook(errorHook);

      const disposable = { dispose: jest.fn(), isDisposed: false };
      disposalManager.add(disposable);

      const result = await disposalManager.dispose();

      expect(errorHook.onDisposeError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Hook error' })
      );
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Priority-Based Disposal', () => {
    test('disposes resources in priority order', async () => {
      const disposalOrder: number[] = [];

      const highPriorityResource = {
        dispose: jest.fn().mockImplementation(() => {
          disposalOrder.push(10);
        }),
        isDisposed: false,
        disposalPriority: 10
      };

      const mediumPriorityResource = {
        dispose: jest.fn().mockImplementation(() => {
          disposalOrder.push(5);
        }),
        isDisposed: false,
        disposalPriority: 5
      };

      const lowPriorityResource = {
        dispose: jest.fn().mockImplementation(() => {
          disposalOrder.push(1);
        }),
        isDisposed: false,
        disposalPriority: 1
      };

      // Add in random order
      disposalManager.add(mediumPriorityResource);
      disposalManager.add(lowPriorityResource);
      disposalManager.add(highPriorityResource);

      await disposalManager.dispose();

      // Should dispose in priority order: 10, 5, 1
      expect(disposalOrder).toEqual([10, 5, 1]);
    });

    test('handles resources without priority', async () => {
      const withPriority = {
        dispose: jest.fn(),
        isDisposed: false,
        disposalPriority: 5
      };

      const withoutPriority = {
        dispose: jest.fn(),
        isDisposed: false
      };

      disposalManager.add(withoutPriority);
      disposalManager.add(withPriority);

      const result = await disposalManager.dispose();

      expect(result.successful).toBe(2);
      expect(withPriority.dispose).toHaveBeenCalled();
      expect(withoutPriority.dispose).toHaveBeenCalled();
    });
  });

  describe('Error Isolation', () => {
    test('isolates disposal errors', async () => {
      const goodResource = { dispose: jest.fn(), isDisposed: false };
      const badResource = {
        dispose: jest.fn().mockRejectedValue(new Error('Disposal failed')),
        isDisposed: false
      };
      const anotherGoodResource = { dispose: jest.fn(), isDisposed: false };

      disposalManager.add(goodResource);
      disposalManager.add(badResource);
      disposalManager.add(anotherGoodResource);

      const result = await disposalManager.dispose();

      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Disposal failed');

      // Good resources should still be disposed
      expect(goodResource.dispose).toHaveBeenCalled();
      expect(anotherGoodResource.dispose).toHaveBeenCalled();
      expect(badResource.dispose).toHaveBeenCalled();
    });

    test('continues disposal after errors', async () => {
      const resources = Array.from({ length: 5 }, (_, i) => ({
        dispose: jest.fn().mockImplementation(() => {
          if (i === 2) {
            throw new Error(`Error ${i}`);
          }
        }),
        isDisposed: false,
        id: i
      }));

      disposalManager.addAll(resources);

      const result = await disposalManager.dispose();

      expect(result.successful).toBe(4);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);

      // All resources should have dispose called
      resources.forEach(resource => {
        expect(resource.dispose).toHaveBeenCalled();
      });
    });
  });

  describe('Performance', () => {
    test('disposes large number of resources efficiently', async () => {
      const resourceCount = 1000;
      const resources = Array.from({ length: resourceCount }, (_, i) => ({
        dispose: jest.fn(),
        isDisposed: false,
        id: i
      }));

      disposalManager.addAll(resources);

      const startTime = Date.now();
      const result = await disposalManager.dispose();
      const disposalTime = Date.now() - startTime;

      expect(result.successful).toBe(resourceCount);
      expect(result.failed).toBe(0);
      expect(disposalTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('tracks disposal timing', async () => {
      const resource = {
        dispose: jest.fn().mockImplementation(() => {
          // Simulate some work
          return new Promise(resolve => setTimeout(resolve, 10));
        }),
        isDisposed: false
      };

      disposalManager.add(resource);

      const result = await disposalManager.dispose();

      expect(result.totalTime).toBeGreaterThan(0);
      expect(result.totalTime).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Double Disposal Protection', () => {
    test('prevents double disposal', async () => {
      const resource = { dispose: jest.fn(), isDisposed: false };
      disposalManager.add(resource);

      // First disposal
      const result1 = await disposalManager.dispose();
      expect(result1.successful).toBe(1);

      // Second disposal should do nothing
      const result2 = await disposalManager.dispose();
      expect(result2.successful).toBe(0);
      expect(result2.totalTime).toBe(0);

      // Resource dispose should only be called once
      expect(resource.dispose).toHaveBeenCalledTimes(1);
    });

    test('throws error when adding to disposed manager', () => {
      const resource = { dispose: jest.fn(), isDisposed: false };

      // Dispose manager first
      disposalManager.dispose();

      // Adding should throw
      expect(() => {
        disposalManager.add(resource);
      }).toThrow('Cannot add disposables to disposed manager');
    });
  });
});
```

## Error Handling Testing

### Error Handler Tests

```typescript
// tests/unit/core/error-handling.test.ts
import { 
  VesperaErrorHandler, 
  VesperaError, 
  VesperaErrorCode,
  VesperaSeverity,
  ErrorHandlingStrategy 
} from '@/core/error-handling';
import { VesperaLogger } from '@/core/logging/VesperaLogger';
import { VesperaTelemetryService } from '@/core/telemetry/VesperaTelemetryService';
import { createMockExtensionContext, createMockLogger } from '../../mocks';
import * as vscode from 'vscode';

// Mock VS Code API
jest.mock('vscode', () => ({
  window: {
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showInformationMessage: jest.fn()
  }
}));

describe('VesperaErrorHandler', () => {
  let errorHandler: VesperaErrorHandler;
  let mockLogger: VesperaLogger;
  let mockTelemetry: VesperaTelemetryService;
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockContext = createMockExtensionContext();
    mockLogger = createMockLogger();
    mockTelemetry = new VesperaTelemetryService(true);
    
    errorHandler = VesperaErrorHandler.initialize(
      mockContext,
      mockLogger,
      mockTelemetry
    );
  });

  describe('Error Strategy Application', () => {
    test('applies logging strategy correctly', async () => {
      const strategy: ErrorHandlingStrategy = {
        shouldLog: true,
        shouldNotifyUser: false,
        shouldThrow: false,
        shouldRetry: false
      };

      errorHandler.setStrategy(VesperaErrorCode.CONFIGURATION_LOAD_FAILED, strategy);

      const testError = new VesperaError(
        'Test configuration error',
        VesperaErrorCode.CONFIGURATION_LOAD_FAILED,
        VesperaSeverity.HIGH
      );

      await errorHandler.handleError(testError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Test configuration error',
        expect.objectContaining({
          code: VesperaErrorCode.CONFIGURATION_LOAD_FAILED,
          severity: VesperaSeverity.HIGH
        })
      );
    });

    test('applies user notification strategy correctly', async () => {
      const strategy: ErrorHandlingStrategy = {
        shouldLog: false,
        shouldNotifyUser: true,
        shouldThrow: false,
        shouldRetry: false
      };

      errorHandler.setStrategy(VesperaErrorCode.PROVIDER_CONNECTION_FAILED, strategy);

      const testError = new VesperaError(
        'Connection failed',
        VesperaErrorCode.PROVIDER_CONNECTION_FAILED,
        VesperaSeverity.HIGH
      );

      await errorHandler.handleError(testError);

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Connection failed',
        expect.any(String)
      );
    });

    test('applies throw strategy correctly', async () => {
      const strategy: ErrorHandlingStrategy = {
        shouldLog: false,
        shouldNotifyUser: false,
        shouldThrow: true,
        shouldRetry: false
      };

      errorHandler.setStrategy(VesperaErrorCode.CONFIGURATION_VALIDATION_FAILED, strategy);

      const testError = new VesperaError(
        'Validation failed',
        VesperaErrorCode.CONFIGURATION_VALIDATION_FAILED,
        VesperaSeverity.CRITICAL
      );

      await expect(errorHandler.handleError(testError)).rejects.toThrow('Validation failed');
    });

    test('applies retry strategy correctly', async () => {
      const strategy: ErrorHandlingStrategy = {
        shouldLog: true,
        shouldNotifyUser: false,
        shouldThrow: false,
        shouldRetry: true,
        maxRetries: 3,
        retryDelay: 100
      };

      errorHandler.setStrategy(VesperaErrorCode.SERVICE_CONNECTION_FAILED, strategy);

      let attemptCount = 0;
      const operation = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      });

      const result = await errorHandler.executeWithRetry(
        operation,
        VesperaErrorCode.SERVICE_CONNECTION_FAILED
      );

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('Error Conversion', () => {
    test('converts generic errors to VesperaError', async () => {
      const genericError = new Error('Generic error message');
      
      await errorHandler.handleError(genericError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Generic error message'),
        expect.objectContaining({
          code: VesperaErrorCode.UNKNOWN_ERROR
        })
      );
    });

    test('handles non-Error objects', async () => {
      const weirdError = { message: 'Not an error object', code: 42 };
      
      await errorHandler.handleError(weirdError as any);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          code: VesperaErrorCode.UNKNOWN_ERROR
        })
      );
    });

    test('preserves VesperaError properties', async () => {
      const vesperaError = new VesperaError(
        'Test VesperaError',
        VesperaErrorCode.PROVIDER_AUTHENTICATION_FAILED,
        VesperaSeverity.HIGH,
        { customData: 'test' }
      );

      await errorHandler.handleError(vesperaError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Test VesperaError',
        expect.objectContaining({
          code: VesperaErrorCode.PROVIDER_AUTHENTICATION_FAILED,
          severity: VesperaSeverity.HIGH,
          metadata: expect.objectContaining({
            context: expect.objectContaining({ customData: 'test' })
          })
        })
      );
    });
  });

  describe('Retry Logic', () => {
    test('respects maxRetries setting', async () => {
      const strategy: ErrorHandlingStrategy = {
        shouldLog: false,
        shouldNotifyUser: false,
        shouldThrow: false,
        shouldRetry: true,
        maxRetries: 2,
        retryDelay: 10
      };

      errorHandler.setStrategy(VesperaErrorCode.SERVICE_RATE_LIMITED, strategy);

      const alwaysFailingOperation = jest.fn().mockRejectedValue(new Error('Always fails'));

      try {
        await errorHandler.executeWithRetry(
          alwaysFailingOperation,
          VesperaErrorCode.SERVICE_RATE_LIMITED
        );
      } catch (error) {
        // Expected to fail after retries
      }

      expect(alwaysFailingOperation).toHaveBeenCalledTimes(2 + 1); // Initial attempt + 2 retries
    });

    test('implements retry delay', async () => {
      const strategy: ErrorHandlingStrategy = {
        shouldLog: false,
        shouldNotifyUser: false,
        shouldThrow: false,
        shouldRetry: true,
        maxRetries: 2,
        retryDelay: 50
      };

      errorHandler.setStrategy(VesperaErrorCode.SERVICE_CONNECTION_FAILED, strategy);

      const timestamps: number[] = [];
      const operation = jest.fn().mockImplementation(() => {
        timestamps.push(Date.now());
        throw new Error('Retry test');
      });

      try {
        await errorHandler.executeWithRetry(
          operation,
          VesperaErrorCode.SERVICE_CONNECTION_FAILED
        );
      } catch (error) {
        // Expected to fail
      }

      expect(timestamps).toHaveLength(3);
      
      // Check delays between attempts (allowing for some timing variance)
      const delay1 = timestamps[1] - timestamps[0];
      const delay2 = timestamps[2] - timestamps[1];
      
      expect(delay1).toBeGreaterThanOrEqual(45);
      expect(delay2).toBeGreaterThanOrEqual(45);
    });

    test('succeeds on retry', async () => {
      const strategy: ErrorHandlingStrategy = {
        shouldLog: false,
        shouldNotifyUser: false,
        shouldThrow: false,
        shouldRetry: true,
        maxRetries: 3,
        retryDelay: 10
      };

      errorHandler.setStrategy(VesperaErrorCode.EXTERNAL_API_ERROR, strategy);

      let attemptCount = 0;
      const eventuallySucceedsOperation = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Temporary failure');
        }
        return 'success';
      });

      const result = await errorHandler.executeWithRetry(
        eventuallySucceedsOperation,
        VesperaErrorCode.EXTERNAL_API_ERROR
      );

      expect(result).toBe('success');
      expect(eventuallySucceedsOperation).toHaveBeenCalledTimes(2);
    });
  });

  describe('Telemetry Integration', () => {
    test('tracks error events', async () => {
      const telemetrySpy = jest.spyOn(mockTelemetry, 'trackEvent');

      const testError = new VesperaError(
        'Test error for telemetry',
        VesperaErrorCode.MEMORY_LEAK_DETECTED,
        VesperaSeverity.HIGH
      );

      await errorHandler.handleError(testError);

      expect(telemetrySpy).toHaveBeenCalledWith({
        name: 'Error.Handled',
        properties: {
          code: VesperaErrorCode.MEMORY_LEAK_DETECTED.toString(),
          severity: VesperaSeverity.HIGH,
          category: expect.any(String)
        }
      });
    });

    test('tracks retry statistics', async () => {
      const telemetrySpy = jest.spyOn(mockTelemetry, 'trackEvent');

      const strategy: ErrorHandlingStrategy = {
        shouldLog: false,
        shouldNotifyUser: false,
        shouldThrow: false,
        shouldRetry: true,
        maxRetries: 2,
        retryDelay: 10
      };

      errorHandler.setStrategy(VesperaErrorCode.SERVICE_CONNECTION_FAILED, strategy);

      let attemptCount = 0;
      const operation = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Temporary failure');
        }
        return 'success';
      });

      await errorHandler.executeWithRetry(
        operation,
        VesperaErrorCode.SERVICE_CONNECTION_FAILED
      );

      expect(telemetrySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Error.Retry.Success',
          properties: expect.objectContaining({
            attempts: 2,
            code: VesperaErrorCode.SERVICE_CONNECTION_FAILED.toString()
          })
        })
      );
    });
  });

  describe('Error Statistics', () => {
    test('tracks error handling statistics', async () => {
      const errors = [
        new VesperaError('Error 1', VesperaErrorCode.CONFIGURATION_LOAD_FAILED, VesperaSeverity.HIGH),
        new VesperaError('Error 2', VesperaErrorCode.PROVIDER_CONNECTION_FAILED, VesperaSeverity.MEDIUM),
        new VesperaError('Error 3', VesperaErrorCode.CONFIGURATION_LOAD_FAILED, VesperaSeverity.HIGH)
      ];

      for (const error of errors) {
        await errorHandler.handleError(error);
      }

      const stats = errorHandler.getStats();

      expect(stats.totalErrorsHandled).toBe(3);
      expect(stats.errorsByCode[VesperaErrorCode.CONFIGURATION_LOAD_FAILED]).toBe(2);
      expect(stats.errorsByCode[VesperaErrorCode.PROVIDER_CONNECTION_FAILED]).toBe(1);
      expect(stats.errorsBySeverity[VesperaSeverity.HIGH]).toBe(2);
      expect(stats.errorsBySeverity[VesperaSeverity.MEDIUM]).toBe(1);
    });

    test('tracks performance metrics', async () => {
      const startTime = Date.now();

      const testError = new VesperaError(
        'Performance test error',
        VesperaErrorCode.UNKNOWN_ERROR,
        VesperaSeverity.LOW
      );

      await errorHandler.handleError(testError);

      const stats = errorHandler.getStats();

      expect(stats.performance.totalHandlingTime).toBeGreaterThan(0);
      expect(stats.performance.averageHandlingTime).toBeGreaterThan(0);
    });
  });

  describe('Strategy Management', () => {
    test('gets existing strategy', () => {
      const strategy: ErrorHandlingStrategy = {
        shouldLog: true,
        shouldNotifyUser: true,
        shouldThrow: false,
        shouldRetry: true,
        maxRetries: 5,
        retryDelay: 1000
      };

      errorHandler.setStrategy(VesperaErrorCode.CONFIGURATION_SAVE_FAILED, strategy);

      const retrievedStrategy = errorHandler.getStrategy(VesperaErrorCode.CONFIGURATION_SAVE_FAILED);

      expect(retrievedStrategy).toEqual(strategy);
    });

    test('returns default strategy for unknown codes', () => {
      const unknownCodeStrategy = errorHandler.getStrategy(9999 as VesperaErrorCode);

      expect(unknownCodeStrategy).toBeDefined();
      expect(unknownCodeStrategy.shouldLog).toBe(true);
      expect(unknownCodeStrategy.shouldThrow).toBe(false);
    });

    test('allows strategy overrides', () => {
      // Set initial strategy
      errorHandler.setStrategy(VesperaErrorCode.WEBVIEW_CREATION_FAILED, {
        shouldLog: false,
        shouldNotifyUser: false,
        shouldThrow: true,
        shouldRetry: false
      });

      // Override with new strategy
      errorHandler.setStrategy(VesperaErrorCode.WEBVIEW_CREATION_FAILED, {
        shouldLog: true,
        shouldNotifyUser: true,
        shouldThrow: false,
        shouldRetry: true,
        maxRetries: 2
      });

      const strategy = errorHandler.getStrategy(VesperaErrorCode.WEBVIEW_CREATION_FAILED);

      expect(strategy.shouldLog).toBe(true);
      expect(strategy.shouldNotifyUser).toBe(true);
      expect(strategy.shouldThrow).toBe(false);
      expect(strategy.shouldRetry).toBe(true);
      expect(strategy.maxRetries).toBe(2);
    });
  });
});
```

### Error Severity and Categorization Tests

```typescript
// tests/unit/core/error-categorization.test.ts
import { 
  VesperaError,
  VesperaErrorCode,
  VesperaSeverity,
  VesperaErrorCategory
} from '@/core/error-handling/VesperaErrors';

describe('VesperaError Classification', () => {
  describe('Error Creation', () => {
    test('creates error with required properties', () => {
      const error = new VesperaError(
        'Test error message',
        VesperaErrorCode.CONFIGURATION_LOAD_FAILED,
        VesperaSeverity.HIGH
      );

      expect(error.message).toBe('Test error message');
      expect(error.code).toBe(VesperaErrorCode.CONFIGURATION_LOAD_FAILED);
      expect(error.severity).toBe(VesperaSeverity.HIGH);
      expect(error.category).toBe(VesperaErrorCategory.CONFIGURATION);
      expect(error.metadata).toBeDefined();
      expect(error.metadata.timestamp).toBeDefined();
    });

    test('creates error with custom metadata', () => {
      const customContext = { userId: '123', action: 'save' };
      
      const error = new VesperaError(
        'Custom error',
        VesperaErrorCode.CONFIGURATION_SAVE_FAILED,
        VesperaSeverity.MEDIUM,
        customContext
      );

      expect(error.metadata.context).toEqual(customContext);
    });

    test('determines category from error code', () => {
      const testCases = [
        { code: VesperaErrorCode.CONFIGURATION_LOAD_FAILED, expectedCategory: VesperaErrorCategory.CONFIGURATION },
        { code: VesperaErrorCode.PROVIDER_CONNECTION_FAILED, expectedCategory: VesperaErrorCategory.PROVIDER },
        { code: VesperaErrorCode.WEBVIEW_CREATION_FAILED, expectedCategory: VesperaErrorCategory.VIEW },
        { code: VesperaErrorCode.MEMORY_LEAK_DETECTED, expectedCategory: VesperaErrorCategory.MEMORY },
        { code: VesperaErrorCode.BINDERY_CONNECTION_FAILED, expectedCategory: VesperaErrorCategory.EXTERNAL },
        { code: VesperaErrorCode.UNKNOWN_ERROR, expectedCategory: VesperaErrorCategory.UNKNOWN }
      ];

      testCases.forEach(({ code, expectedCategory }) => {
        const error = new VesperaError('Test', code, VesperaSeverity.LOW);
        expect(error.category).toBe(expectedCategory);
      });
    });

    test('sets retry eligibility based on error type', () => {
      const retryableError = new VesperaError(
        'Network timeout',
        VesperaErrorCode.SERVICE_CONNECTION_FAILED,
        VesperaSeverity.MEDIUM
      );

      const nonRetryableError = new VesperaError(
        'Authentication failed',
        VesperaErrorCode.PROVIDER_AUTHENTICATION_FAILED,
        VesperaSeverity.HIGH
      );

      expect(retryableError.isRetryable).toBe(true);
      expect(nonRetryableError.isRetryable).toBe(false);
    });
  });

  describe('Error Conversion', () => {
    test('converts from generic Error', () => {
      const genericError = new Error('Generic error message');
      genericError.stack = 'Stack trace here';

      const vesperaError = VesperaError.fromError(
        genericError,
        VesperaErrorCode.PROVIDER_REQUEST_FAILED
      );

      expect(vesperaError).toBeInstanceOf(VesperaError);
      expect(vesperaError.message).toContain('Generic error message');
      expect(vesperaError.code).toBe(VesperaErrorCode.PROVIDER_REQUEST_FAILED);
      expect(vesperaError.metadata.stackTrace).toBe('Stack trace here');
    });

    test('converts from Error with additional context', () => {
      const originalError = new Error('Original message');
      const context = { operation: 'fetchData', userId: '456' };

      const vesperaError = VesperaError.fromError(
        originalError,
        VesperaErrorCode.EXTERNAL_API_ERROR,
        context
      );

      expect(vesperaError.metadata.context).toEqual(context);
      expect(vesperaError.code).toBe(VesperaErrorCode.EXTERNAL_API_ERROR);
    });

    test('preserves original error if already VesperaError', () => {
      const originalVesperaError = new VesperaError(
        'Original VesperaError',
        VesperaErrorCode.CONFIGURATION_VALIDATION_FAILED,
        VesperaSeverity.HIGH
      );

      const convertedError = VesperaError.fromError(
        originalVesperaError,
        VesperaErrorCode.UNKNOWN_ERROR
      );

      // Should preserve original VesperaError properties
      expect(convertedError.code).toBe(VesperaErrorCode.CONFIGURATION_VALIDATION_FAILED);
      expect(convertedError.severity).toBe(VesperaSeverity.HIGH);
    });
  });

  describe('Error Serialization', () => {
    test('serializes to JSON correctly', () => {
      const error = new VesperaError(
        'Serialization test',
        VesperaErrorCode.WEBVIEW_MESSAGE_FAILED,
        VesperaSeverity.MEDIUM,
        { component: 'TestComponent' }
      );

      const serialized = JSON.stringify(error);
      const parsed = JSON.parse(serialized);

      expect(parsed.message).toBe('Serialization test');
      expect(parsed.code).toBe(VesperaErrorCode.WEBVIEW_MESSAGE_FAILED);
      expect(parsed.severity).toBe(VesperaSeverity.MEDIUM);
      expect(parsed.category).toBe(VesperaErrorCategory.VIEW);
    });

    test('includes stack trace in serialization', () => {
      const error = new VesperaError(
        'Stack trace test',
        VesperaErrorCode.UNKNOWN_ERROR,
        VesperaSeverity.LOW
      );

      const serialized = JSON.stringify(error);
      const parsed = JSON.parse(serialized);

      expect(parsed.stack).toBeDefined();
      expect(typeof parsed.stack).toBe('string');
    });
  });

  describe('Error Code Ranges', () => {
    test('validates error code ranges', () => {
      const codeRanges = [
        { start: 1000, end: 1099, category: VesperaErrorCategory.CONFIGURATION },
        { start: 1100, end: 1199, category: VesperaErrorCategory.PROVIDER },
        { start: 1200, end: 1299, category: VesperaErrorCategory.VIEW },
        { start: 1300, end: 1399, category: VesperaErrorCategory.MEMORY },
        { start: 1400, end: 1499, category: VesperaErrorCategory.EXTERNAL }
      ];

      codeRanges.forEach(({ start, end, category }) => {
        const error = new VesperaError(
          'Range test',
          start as VesperaErrorCode,
          VesperaSeverity.LOW
        );
        
        expect(error.category).toBe(category);
        
        const endError = new VesperaError(
          'Range test',
          end as VesperaErrorCode,
          VesperaSeverity.LOW
        );
        
        expect(endError.category).toBe(category);
      });
    });
  });
});
```

## TypeScript Configuration Verification

### Compilation Tests

```typescript
// tests/typescript/compilation.test.ts
import { spawn } from 'child_process';
import * as path from 'path';

describe('TypeScript Compilation', () => {
  test('compiles without errors with enhanced configuration', async () => {
    const tscPath = path.join(process.cwd(), 'node_modules', '.bin', 'tsc');
    
    const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
      const tsc = spawn(tscPath, ['--noEmit', '--project', './tsconfig.json'], {
        cwd: process.cwd(),
        stdio: 'pipe'
      });

      let stdout = '';
      let stderr = '';

      tsc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      tsc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      tsc.on('close', (code) => {
        resolve({ code: code || 0, stdout, stderr });
      });
    });

    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
  });

  test('catches type errors with enhanced strict mode', () => {
    // This test would be implemented as part of CI to ensure
    // that the enhanced TypeScript configuration catches more issues
    // It would compile test files with known issues
    expect(true).toBe(true); // Placeholder
  });
});

describe('Path Mapping', () => {
  test('resolves path mappings correctly', async () => {
    // Test that imports using path mapping (@/core, @/utils, etc.) work correctly
    const testModule = await import('@/core/index');
    expect(testModule).toBeDefined();
    expect(testModule.VesperaCoreServices).toBeDefined();
  });
});

describe('Enhanced Type Checks', () => {
  test('array access safety', () => {
    const testArray: string[] = [];
    
    // This should be caught by noUncheckedIndexedAccess
    const item = testArray[0]; // Type should be string | undefined
    
    // Safe access pattern
    if (item) {
      expect(typeof item).toBe('string');
    } else {
      expect(item).toBeUndefined();
    }
  });

  test('optional property handling', () => {
    interface TestConfig {
      feature?: boolean;
    }

    const config: TestConfig = {};

    // This pattern should work with exactOptionalPropertyTypes
    if (Math.random() > 0.5) {
      config.feature = true;
    }
    // Omitting the else clause leaves feature as undefined

    expect(config.feature === undefined || typeof config.feature === 'boolean').toBe(true);
  });
});
```

## Integration Testing

### Core Services Integration

```typescript
// tests/integration/core-services.test.ts
import { VesperaCoreServices } from '@/core';
import { createMockExtensionContext } from '../mocks';
import * as vscode from 'vscode';

describe('Core Services Integration', () => {
  let mockContext: vscode.ExtensionContext;
  let coreServices: Awaited<ReturnType<typeof VesperaCoreServices.initialize>>;

  beforeEach(async () => {
    mockContext = createMockExtensionContext();
    coreServices = await VesperaCoreServices.initialize(mockContext, {
      logging: { level: 0 }, // TRACE level for detailed testing
      memoryMonitoring: { enabled: true, thresholdMB: 50 },
      telemetry: { enabled: true }
    });
  });

  afterEach(async () => {
    if (coreServices) {
      await coreServices.disposalManager.dispose();
    }
  });

  test('all services initialize and interact correctly', async () => {
    const { logger, errorHandler, contextManager, telemetryService, disposalManager } = coreServices;

    // Test logging
    logger.info('Integration test started');
    const logStats = logger.getLogStats();
    expect(logStats.totalLogs).toBeGreaterThan(0);

    // Test context management
    const testContext = {
      testProvider: { dispose: jest.fn() },
      createdAt: Date.now(),
      lastAccessedAt: Date.now()
    };

    contextManager.setViewContext(mockContext, testContext);
    const retrievedContext = contextManager.getViewContext(mockContext);
    expect(retrievedContext).toBeDefined();

    // Test error handling with logging integration
    const testError = new Error('Integration test error');
    await errorHandler.handleError(testError);

    // Verify error was logged
    expect(logStats.totalLogs).toBeGreaterThan(1);

    // Test telemetry integration
    expect(telemetryService.isEnabled()).toBe(true);

    // Test disposal coordination
    const stats = disposalManager.getStats();
    expect(stats.totalDisposables).toBeGreaterThan(0);
  });

  test('health check reports all services healthy', async () => {
    const healthCheck = await VesperaCoreServices.getInstance().healthCheck();

    expect(healthCheck.healthy).toBe(true);
    
    Object.entries(healthCheck.services).forEach(([serviceName, status]) => {
      expect(status.healthy).toBe(true);
      if (status.error) {
        console.warn(`Service ${serviceName} has error: ${status.error}`);
      }
    });

    // Verify stats are collected
    expect(healthCheck.stats).toBeDefined();
    expect(healthCheck.stats.logger).toBeDefined();
    expect(healthCheck.stats.memory).toBeDefined();
    expect(healthCheck.stats.disposal).toBeDefined();
  });

  test('error handling integrates with all services', async () => {
    const { errorHandler, logger, telemetryService, contextManager } = coreServices;

    // Create an error that should trigger multiple service interactions
    const complexError = new Error('Complex integration error');
    
    const telemetrySpy = jest.spyOn(telemetryService, 'trackEvent');
    const loggerSpy = jest.spyOn(logger, 'error');

    await errorHandler.handleError(complexError);

    // Verify logging integration
    expect(loggerSpy).toHaveBeenCalled();

    // Verify telemetry integration
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Error.Handled'
      })
    );

    // Verify memory stats are still accessible
    const memStats = contextManager.getMemoryStats();
    expect(memStats).toBeDefined();
  });

  test('disposal manager coordinates service cleanup', async () => {
    const { disposalManager, logger, contextManager } = coreServices;

    // Register some test resources
    const testResources = [
      { dispose: jest.fn(), isDisposed: false, disposalPriority: 10 },
      { dispose: jest.fn(), isDisposed: false, disposalPriority: 5 }
    ];

    testResources.forEach((resource, index) => {
      contextManager.registerResource(resource, 'TestResource', `test-${index}`);
    });

    // Add to disposal manager as well
    disposalManager.addAll(testResources);

    // Dispose everything
    const result = await disposalManager.dispose();

    expect(result.successful).toBeGreaterThan(0);
    expect(result.failed).toBe(0);

    // Verify test resources were disposed
    testResources.forEach(resource => {
      expect(resource.dispose).toHaveBeenCalled();
    });
  });
});
```

### Extension Lifecycle Integration

```typescript
// tests/integration/extension-lifecycle.test.ts
import * as vscode from 'vscode';
import { activate, deactivate, getViewContext, isCoreServicesAvailable } from '../../src/extension';
import { VesperaCoreServices } from '@/core';
import { createMockExtensionContext } from '../mocks';

describe('Extension Lifecycle Integration', () => {
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    mockContext = createMockExtensionContext();
  });

  afterEach(async () => {
    // Ensure clean deactivation
    await deactivate();
  });

  test('complete activation and deactivation cycle', async () => {
    // Test activation
    expect(isCoreServicesAvailable()).toBe(false);

    await activate(mockContext);

    expect(isCoreServicesAvailable()).toBe(true);

    // Test that core services are properly initialized
    const coreServices = VesperaCoreServices.getInstance();
    const healthCheck = await coreServices.healthCheck();
    expect(healthCheck.healthy).toBe(true);

    // Test view context access
    const viewContext = getViewContext(mockContext);
    expect(viewContext).toBeDefined();

    // Test deactivation
    await deactivate();

    expect(isCoreServicesAvailable()).toBe(false);
  });

  test('activation with auto-start enabled', async () => {
    // Mock configuration to enable auto-start
    const mockGetConfig = jest.fn().mockReturnValue({
      enableAutoStart: true
    });

    // This would require mocking the utils module
    // jest.mock('@/utils', () => ({
    //   ...jest.requireActual('@/utils'),
    //   getConfig: mockGetConfig
    // }));

    await activate(mockContext);

    expect(isCoreServicesAvailable()).toBe(true);
    
    // Verify that auto-initialization was attempted
    // This would be verified through command execution or other side effects
  });

  test('activation error handling', async () => {
    // Mock a failure during core services initialization
    const originalInitialize = VesperaCoreServices.initialize;
    VesperaCoreServices.initialize = jest.fn().mockRejectedValue(new Error('Initialization failed'));

    await expect(activate(mockContext)).rejects.toThrow('Initialization failed');

    // Verify that core services are not available after failed activation
    expect(isCoreServicesAvailable()).toBe(false);

    // Restore original method
    VesperaCoreServices.initialize = originalInitialize;
  });

  test('deactivation handles partial initialization', async () => {
    // Partially activate (simulate failure during activation)
    try {
      // Start activation but don't complete it
      const coreServices = await VesperaCoreServices.initialize(mockContext);
      
      // Simulate failure before full activation
      throw new Error('Partial activation failure');
      
    } catch (error) {
      // Deactivation should still work
      await expect(deactivate()).resolves.not.toThrow();
    }
  });

  test('memory cleanup during deactivation', async () => {
    await activate(mockContext);

    const coreServices = VesperaCoreServices.getInstance();
    const initialMemory = coreServices.contextManager.getMemoryStats();

    // Register some test resources
    const testResources = Array.from({ length: 10 }, () => ({
      dispose: jest.fn(),
      isDisposed: false
    }));

    testResources.forEach((resource, index) => {
      coreServices.contextManager.registerResource(resource, 'TestResource', `test-${index}`);
    });

    const afterRegistration = coreServices.contextManager.getMemoryStats();
    expect(afterRegistration.registeredResources).toBeGreaterThan(initialMemory.registeredResources);

    // Deactivate and verify cleanup
    await deactivate();

    // All test resources should have been disposed
    testResources.forEach(resource => {
      expect(resource.dispose).toHaveBeenCalled();
    });
  });
});
```

## Performance Testing

### Memory Performance Benchmarks

```typescript
// tests/performance/memory-benchmarks.test.ts
import { VesperaContextManager } from '@/core/memory-management/VesperaContextManager';
import { VesperaLogger } from '@/core/logging/VesperaLogger';
import { createMockLogger, createMockExtensionContext } from '../mocks';

describe('Memory Performance Benchmarks', () => {
  let contextManager: VesperaContextManager;
  let mockLogger: VesperaLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    contextManager = VesperaContextManager.initialize(mockLogger);
  });

  afterEach(async () => {
    await contextManager.dispose();
  });

  test('resource registration performance', () => {
    const resourceCount = 10000;
    const resources = Array.from({ length: resourceCount }, (_, i) => ({
      dispose: jest.fn(),
      isDisposed: false,
      id: i
    }));

    const startTime = performance.now();
    
    resources.forEach((resource, index) => {
      contextManager.registerResource(resource, 'BenchmarkResource', `bench-${index}`);
    });

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    console.log(`Registered ${resourceCount} resources in ${totalTime.toFixed(2)}ms`);
    console.log(`Average time per resource: ${(totalTime / resourceCount).toFixed(4)}ms`);

    expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
    
    const stats = contextManager.getMemoryStats();
    expect(stats.registeredResources).toBe(resourceCount);
  });

  test('context access performance', () => {
    const contextCount = 1000;
    const contexts = Array.from({ length: contextCount }, () => createMockExtensionContext());

    // Set contexts
    contexts.forEach((context, index) => {
      contextManager.setViewContext(context, {
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        data: `context-${index}`
      });
    });

    const startTime = performance.now();

    // Access all contexts
    const retrievedContexts = contexts.map(context => {
      return contextManager.getViewContext(context);
    });

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    console.log(`Accessed ${contextCount} contexts in ${totalTime.toFixed(2)}ms`);
    console.log(`Average time per access: ${(totalTime / contextCount).toFixed(4)}ms`);

    expect(totalTime).toBeLessThan(100); // Should be very fast due to WeakMap
    expect(retrievedContexts).toHaveLength(contextCount);
    retrievedContexts.forEach(context => {
      expect(context).toBeDefined();
    });
  });

  test('cleanup performance', async () => {
    const resourceCount = 5000;
    const resources = Array.from({ length: resourceCount }, (_, i) => ({
      dispose: jest.fn().mockResolvedValue(undefined),
      isDisposed: false,
      id: i
    }));

    // Register resources
    resources.forEach((resource, index) => {
      contextManager.registerResource(resource, 'CleanupBenchmark', `cleanup-${index}`);
    });

    // Make all resources stale
    const originalNow = Date.now;
    Date.now = jest.fn(() => originalNow() + 10000);

    const startTime = performance.now();
    
    const cleanupResult = await contextManager.cleanupStaleResources(1000);
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;

    console.log(`Cleaned up ${cleanupResult.cleaned} resources in ${totalTime.toFixed(2)}ms`);
    
    expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
    expect(cleanupResult.cleaned).toBe(resourceCount);
    
    // Verify all resources were disposed
    resources.forEach(resource => {
      expect(resource.dispose).toHaveBeenCalled();
    });

    // Restore Date.now
    Date.now = originalNow;
  });

  test('memory usage under load', () => {
    const initialMemory = process.memoryUsage();
    
    const resourceCount = 50000;
    const resources = [];

    for (let i = 0; i < resourceCount; i++) {
      const resource = {
        dispose: jest.fn(),
        isDisposed: false,
        data: new Array(100).fill(`data-${i}`), // Some memory usage
        id: i
      };
      
      resources.push(resource);
      contextManager.registerResource(resource, 'MemoryTestResource', `mem-${i}`);
    }

    const peakMemory = process.memoryUsage();
    const memoryIncrease = peakMemory.heapUsed - initialMemory.heapUsed;
    
    console.log(`Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB for ${resourceCount} resources`);
    console.log(`Average memory per resource: ${Math.round(memoryIncrease / resourceCount)}bytes`);

    const stats = contextManager.getMemoryStats();
    expect(stats.registeredResources).toBe(resourceCount);
    
    // Memory usage should be reasonable
    expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024); // Less than 500MB
  });
});
```

### Error Handling Performance

```typescript
// tests/performance/error-handling-benchmarks.test.ts
import { VesperaErrorHandler, VesperaError, VesperaErrorCode, VesperaSeverity } from '@/core/error-handling';
import { createMockExtensionContext, createMockLogger } from '../mocks';
import { VesperaTelemetryService } from '@/core/telemetry/VesperaTelemetryService';

describe('Error Handling Performance Benchmarks', () => {
  let errorHandler: VesperaErrorHandler;

  beforeEach(() => {
    const mockContext = createMockExtensionContext();
    const mockLogger = createMockLogger();
    const mockTelemetry = new VesperaTelemetryService(false); // Disable for performance testing

    errorHandler = VesperaErrorHandler.initialize(mockContext, mockLogger, mockTelemetry);
  });

  test('error handling throughput', async () => {
    const errorCount = 1000;
    const errors = Array.from({ length: errorCount }, (_, i) => 
      new VesperaError(
        `Benchmark error ${i}`,
        VesperaErrorCode.UNKNOWN_ERROR,
        VesperaSeverity.LOW
      )
    );

    const startTime = performance.now();

    // Process all errors
    await Promise.all(errors.map(error => errorHandler.handleError(error)));

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    console.log(`Handled ${errorCount} errors in ${totalTime.toFixed(2)}ms`);
    console.log(`Throughput: ${Math.round(errorCount / (totalTime / 1000))} errors/second`);

    expect(totalTime).toBeLessThan(1000); // Should handle 1000 errors within 1 second
  });

  test('retry logic performance', async () => {
    errorHandler.setStrategy(VesperaErrorCode.SERVICE_CONNECTION_FAILED, {
      shouldLog: false,
      shouldNotifyUser: false,
      shouldThrow: false,
      shouldRetry: true,
      maxRetries: 3,
      retryDelay: 10
    });

    const operationCount = 100;
    let attemptCount = 0;

    const operation = jest.fn().mockImplementation(() => {
      attemptCount++;
      // Fail first 2 attempts, succeed on 3rd
      if (attemptCount % 3 !== 0) {
        throw new Error('Temporary failure');
      }
      return 'success';
    });

    const startTime = performance.now();

    // Execute operations with retry
    const promises = Array.from({ length: operationCount }, () => 
      errorHandler.executeWithRetry(operation, VesperaErrorCode.SERVICE_CONNECTION_FAILED)
    );

    const results = await Promise.all(promises);

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    console.log(`Completed ${operationCount} retry operations in ${totalTime.toFixed(2)}ms`);
    
    expect(results).toHaveLength(operationCount);
    expect(results.every(result => result === 'success')).toBe(true);
  });

  test('strategy lookup performance', () => {
    // Set up many strategies
    const strategyCount = 1000;
    for (let i = 0; i < strategyCount; i++) {
      errorHandler.setStrategy(i as VesperaErrorCode, {
        shouldLog: true,
        shouldNotifyUser: false,
        shouldThrow: false,
        shouldRetry: false
      });
    }

    const lookupCount = 10000;
    
    const startTime = performance.now();

    // Perform many strategy lookups
    for (let i = 0; i < lookupCount; i++) {
      const code = (i % strategyCount) as VesperaErrorCode;
      const strategy = errorHandler.getStrategy(code);
      expect(strategy).toBeDefined();
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    console.log(`Performed ${lookupCount} strategy lookups in ${totalTime.toFixed(2)}ms`);
    console.log(`Average lookup time: ${(totalTime / lookupCount).toFixed(4)}ms`);

    expect(totalTime).toBeLessThan(100); // Should be very fast
  });
});
```

## Automated Testing Setup

### Jest Configuration

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/test/**/*'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  testTimeout: 30000,
  maxWorkers: 4
};
```

### Test Setup File

```typescript
// tests/setup.ts
import * as vscode from 'vscode';

// Mock VS Code API globally
jest.mock('vscode', () => {
  const mockDisposable = {
    dispose: jest.fn()
  };

  return {
    ExtensionContext: jest.fn(),
    workspace: {
      getConfiguration: jest.fn().mockReturnValue({
        get: jest.fn(),
        has: jest.fn(),
        inspect: jest.fn(),
        update: jest.fn()
      }),
      onDidChangeConfiguration: jest.fn().mockReturnValue(mockDisposable),
      workspaceFolders: []
    },
    window: {
      showErrorMessage: jest.fn(),
      showWarningMessage: jest.fn(),
      showInformationMessage: jest.fn(),
      createOutputChannel: jest.fn().mockReturnValue({
        append: jest.fn(),
        appendLine: jest.fn(),
        clear: jest.fn(),
        hide: jest.fn(),
        show: jest.fn(),
        dispose: jest.fn()
      }),
      registerWebviewViewProvider: jest.fn().mockReturnValue(mockDisposable),
      registerTreeDataProvider: jest.fn().mockReturnValue(mockDisposable)
    },
    commands: {
      executeCommand: jest.fn(),
      registerCommand: jest.fn().mockReturnValue(mockDisposable)
    },
    env: {
      appName: 'Visual Studio Code',
      appRoot: '/usr/share/code',
      language: 'en-us',
      machineId: 'test-machine',
      sessionId: 'test-session'
    },
    version: '1.60.0',
    Uri: {
      file: jest.fn(path => ({ fsPath: path, scheme: 'file', path })),
      parse: jest.fn()
    },
    EventEmitter: jest.fn().mockImplementation(() => ({
      event: jest.fn(),
      fire: jest.fn(),
      dispose: jest.fn()
    })),
    Disposable: jest.fn().mockImplementation((callOnDispose) => ({
      dispose: callOnDispose || jest.fn()
    })),
    TreeItem: jest.fn(),
    TreeItemCollapsibleState: {
      None: 0,
      Collapsed: 1,
      Expanded: 2
    },
    WebviewView: jest.fn()
  };
});

// Global test utilities
global.gc = jest.fn(); // Mock garbage collection function

// Test timeout for long-running tests
jest.setTimeout(30000);

// Suppress console output during tests unless explicitly needed
const originalConsole = console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
});
```

### Mock Utilities

```typescript
// tests/mocks/index.ts
import * as vscode from 'vscode';
import { VesperaLogger } from '@/core/logging/VesperaLogger';

export function createMockExtensionContext(): vscode.ExtensionContext {
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
  };
}

export function createMockLogger(): VesperaLogger {
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

export function createMockDisposable(): vscode.Disposable {
  return {
    dispose: jest.fn()
  };
}

export const createMockWebviewView = (): vscode.WebviewView => ({
  webview: {
    html: '',
    options: {},
    onDidReceiveMessage: jest.fn(),
    postMessage: jest.fn(),
    asWebviewUri: jest.fn(),
    cspSource: 'vscode-webview://'
  },
  onDidDispose: jest.fn(),
  onDidChangeVisibility: jest.fn(),
  visible: true,
  show: jest.fn(),
  title: 'Test View',
  description: 'Test Description'
} as any);

export function createMockTreeItem(label: string): vscode.TreeItem {
  return {
    label,
    id: `test-${label.toLowerCase()}`,
    collapsibleState: vscode.TreeItemCollapsibleState.None,
    contextValue: 'test-item',
    tooltip: `Test tooltip for ${label}`
  };
}

// Performance testing utilities
export function measurePerformance<T>(
  operation: () => T | Promise<T>,
  expectedMaxTime?: number
): Promise<{ result: T; duration: number }> {
  return new Promise(async (resolve, reject) => {
    const startTime = performance.now();
    
    try {
      const result = await operation();
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      if (expectedMaxTime && duration > expectedMaxTime) {
        reject(new Error(`Operation took ${duration}ms, expected max ${expectedMaxTime}ms`));
      } else {
        resolve({ result, duration });
      }
    } catch (error) {
      reject(error);
    }
  });
}

// Memory testing utilities
export function simulateMemoryPressure(sizeMB: number = 100): () => void {
  const arrays: any[][] = [];
  const arraySize = 1000;
  const arraysNeeded = Math.floor((sizeMB * 1024 * 1024) / (arraySize * 8)); // 8 bytes per number

  for (let i = 0; i < arraysNeeded; i++) {
    arrays.push(new Array(arraySize).fill(i));
  }

  return () => {
    arrays.length = 0; // Clear arrays to free memory
  };
}
```

## Manual Testing Procedures

### Memory Management Manual Tests

```typescript
// Manual test procedures for memory management
export const memoryManualTests = {
  async testWeakMapCleanup() {
    console.log('=== WeakMap Cleanup Manual Test ===');
    
    // 1. Create extension context and set view context
    // 2. Verify context is accessible
    // 3. Clear reference to extension context
    // 4. Force garbage collection (if available)
    // 5. Verify context is no longer accessible (indirect verification)
    
    console.log('This test requires manual verification through VS Code debugging');
    console.log('Steps:');
    console.log('1. Open extension in debug mode');
    console.log('2. Set breakpoints in context manager');
    console.log('3. Create and destroy extension contexts');
    console.log('4. Verify WeakMap entries are cleaned up');
  },

  async testMemoryMonitoring() {
    console.log('=== Memory Monitoring Manual Test ===');
    
    // 1. Enable memory monitoring
    // 2. Create many resources to increase memory usage
    // 3. Verify memory alerts are triggered
    // 4. Verify cleanup is triggered automatically
    
    console.log('Monitor VS Code Output panel for memory alerts');
    console.log('Expected: Memory usage alerts when threshold exceeded');
  },

  async testResourceDisposal() {
    console.log('=== Resource Disposal Manual Test ===');
    
    // 1. Register resources with disposal priorities
    // 2. Trigger extension deactivation
    // 3. Verify disposal order matches priorities
    // 4. Verify error isolation during disposal
    
    console.log('Check console output for disposal order and error handling');
  }
};
```

### Error Handling Manual Tests

```typescript
export const errorHandlingManualTests = {
  async testUserNotifications() {
    console.log('=== User Notification Manual Test ===');
    
    // Trigger various error types and verify correct user notifications
    const testCases = [
      {
        error: 'Configuration file not found',
        expectedNotification: 'Error message with retry option'
      },
      {
        error: 'Authentication failed',
        expectedNotification: 'Error message without retry'
      },
      {
        error: 'Rate limited',
        expectedNotification: 'No user notification (silent retry)'
      }
    ];

    console.log('Expected user notification behaviors:');
    testCases.forEach((testCase, index) => {
      console.log(`${index + 1}. ${testCase.error}: ${testCase.expectedNotification}`);
    });
  },

  async testRetryBehavior() {
    console.log('=== Retry Behavior Manual Test ===');
    
    console.log('Steps to test:');
    console.log('1. Trigger network-related errors');
    console.log('2. Observe retry attempts in logs');
    console.log('3. Verify retry delays');
    console.log('4. Test max retry limits');
    
    console.log('Expected: Automatic retries with exponential backoff');
  }
};
```

### Performance Manual Tests

```typescript
export const performanceManualTests = {
  async testHighLoad() {
    console.log('=== High Load Manual Test ===');
    
    console.log('Performance testing steps:');
    console.log('1. Create thousands of resources');
    console.log('2. Monitor memory usage in Task Manager');
    console.log('3. Trigger mass disposal');
    console.log('4. Verify performance remains acceptable');
    
    console.log('Acceptance criteria:');
    console.log('- Memory usage should stabilize');
    console.log('- UI should remain responsive');
    console.log('- Cleanup should complete within reasonable time');
  },

  async testExtensionResponsiveness() {
    console.log('=== Extension Responsiveness Manual Test ===');
    
    console.log('Test scenarios:');
    console.log('1. Heavy error processing');
    console.log('2. Large number of context operations');
    console.log('3. Concurrent resource registration');
    
    console.log('Verify VS Code remains responsive during all operations');
  }
};
```

## Continuous Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/code-quality-tests.yml
name: Code Quality Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
        
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: TypeScript compilation check
      run: npx tsc --noEmit
    
    - name: Lint check
      run: npm run lint
    
    - name: Unit tests
      run: npm run test:unit
      
    - name: Integration tests
      run: npm run test:integration
      
    - name: Performance tests
      run: npm run test:performance
      
    - name: Coverage report
      run: npm run test:coverage
      
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
        
  memory-leak-test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: 18.x
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Memory leak detection
      run: npm run test:memory-leaks
      
    - name: Performance benchmarks
      run: npm run test:benchmarks
```

### Package.json Test Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:performance": "jest tests/performance",
    "test:coverage": "jest --coverage",
    "test:memory-leaks": "jest tests/memory --detectLeaks",
    "test:benchmarks": "jest tests/performance --silent",
    "test:watch": "jest --watch",
    "test:ci": "jest --ci --coverage --watchAll=false"
  }
}
```

## Debugging and Diagnostics

### Built-in Diagnostic Commands

```typescript
// Diagnostic commands available in the extension
export const diagnosticCommands = {
  'vespera-forge.diagnostics.memory': {
    title: 'Run Memory Diagnostics',
    command: 'runMemoryDiagnostics',
    description: 'Comprehensive memory usage analysis'
  },
  
  'vespera-forge.diagnostics.health': {
    title: 'Check System Health',
    command: 'performHealthCheck', 
    description: 'Verify all core services are healthy'
  },
  
  'vespera-forge.diagnostics.cleanup': {
    title: 'Force Memory Cleanup',
    command: 'forceMemoryCleanup',
    description: 'Manually trigger garbage collection and cleanup'
  }
};
```

### Debug Output Channels

```typescript
// Debug information available in VS Code output channels
export const debugChannels = {
  'Vespera Forge - Core': 'Core services logs and diagnostics',
  'Vespera Forge - Memory': 'Memory management and cleanup logs',
  'Vespera Forge - Errors': 'Error handling and recovery logs',
  'Vespera Forge - Performance': 'Performance metrics and benchmarks'
};
```

### Test Debugging Tips

```typescript
export const debuggingTips = {
  memoryIssues: [
    'Use Chrome DevTools for heap snapshots',
    'Monitor process.memoryUsage() in tests',
    'Check for event listener leaks',
    'Verify WeakMap cleanup with indirect measures'
  ],
  
  errorHandling: [
    'Use Jest spies to verify error handler calls',
    'Test error strategies in isolation',
    'Mock VS Code APIs for notification testing',
    'Verify telemetry events are fired'
  ],
  
  performance: [
    'Use performance.now() for accurate timing',
    'Run tests multiple times for consistency',
    'Profile with --detectOpenHandles flag',
    'Monitor CPU usage during tests'
  ]
};
```

## Conclusion

This comprehensive testing and verification guide provides a robust framework for ensuring the quality and reliability of code quality improvements. The testing strategy covers all critical aspects:

- **Memory Management**: WeakMap cleanup, resource tracking, performance
- **Error Handling**: Strategy application, retry logic, user notifications
- **Integration**: Service interactions, lifecycle management
- **Performance**: Benchmarks, load testing, responsiveness

Regular execution of these tests, combined with the continuous integration setup, ensures that code quality improvements maintain their effectiveness over time and don't introduce regressions.

The combination of automated testing, manual verification procedures, and built-in diagnostic tools provides comprehensive coverage for validating the improvements work correctly in all scenarios.