# Vespera Forge Core Infrastructure

This directory contains the foundational infrastructure components for the Vespera Forge VS Code extension, implementing standardized error handling, memory management, logging, and resource disposal patterns.

## Architecture Overview

The core infrastructure provides enterprise-grade patterns for:

- **Error Handling**: Standardized error types with configurable strategies
- **Memory Management**: WeakMap-based context storage with leak detection
- **Logging**: Structured logging with VS Code integration
- **Resource Disposal**: Coordinated cleanup with priorities and hooks
- **Type Safety**: Comprehensive TypeScript definitions and type guards

## Directory Structure

```
src/core/
├── disposal/                    # Enhanced disposal system
│   ├── DisposalManager.ts      # Coordinated resource cleanup
│   └── BaseDisposable.ts       # Base classes with disposal patterns
├── error-handling/             # Standardized error handling
│   ├── VesperaErrors.ts        # Error types and hierarchy
│   └── VesperaErrorHandler.ts  # Error handling service
├── logging/                    # Comprehensive logging framework
│   └── VesperaLogger.ts        # VS Code integrated logger
├── memory-management/          # Memory-safe context management
│   └── VesperaContextManager.ts # WeakMap-based storage
├── telemetry/                  # Basic telemetry service
│   └── VesperaTelemetryService.ts # Error tracking placeholder
├── index.ts                    # Core services initialization
└── README.md                   # This file
```

## Quick Start

### 1. Initialize Core Services

```typescript
import { VesperaCoreServices } from '@/core';

// In your extension activation
const coreServices = await VesperaCoreServices.initialize(context, {
  logging: {
    level: LogLevel.DEBUG,
    enableVSCodeOutput: true
  },
  memoryMonitoring: {
    enabled: true,
    thresholdMB: 100
  }
});
```

### 2. Use Standardized Error Handling

```typescript
import { VesperaConfigurationError, VesperaErrorCode } from '@/core';

try {
  // Your operation
} catch (error) {
  const vesperaError = new VesperaConfigurationError(
    'Failed to load configuration',
    VesperaErrorCode.CONFIGURATION_LOAD_FAILED,
    { context: { configPath: '/path/to/config' } },
    error
  );
  
  await VesperaErrorHandler.getInstance().handleError(vesperaError);
}
```

### 3. Extend Base Classes

```typescript
import { BaseWebViewProvider } from '@/core';

export class MyWebViewProvider extends BaseWebViewProvider {
  constructor(context: vscode.ExtensionContext) {
    super(context, undefined, 90); // High disposal priority
  }

  protected setupWebview(webviewView: vscode.WebviewView): void {
    this.registerMessageHandler(async (message) => {
      await this.handleMessage(message);
    });
  }
}
```

### 4. Register Resources

```typescript
import { VesperaContextManager } from '@/core';

const contextManager = VesperaContextManager.getInstance();
const resourceId = contextManager.registerResource(myResource, 'MyResourceType');
```

## Key Components

### Error Handling System

- **VesperaError**: Base error class with metadata and categorization
- **VesperaErrorHandler**: Singleton service with configurable strategies
- **Error Codes**: Categorized error codes for different components
- **Specialized Errors**: Configuration, Provider, Memory, View, and External error types

### Memory Management

- **VesperaContextManager**: WeakMap-based context storage
- **Resource Registry**: Tracked disposal with metadata
- **Memory Monitoring**: Automatic memory usage tracking and leak detection
- **Safe Disposal**: Error-resistant resource cleanup

### Logging Framework

- **VesperaLogger**: VS Code integrated logger with structured logging
- **Multiple Outputs**: Console, VS Code Output Channel, and file logging
- **Environment Aware**: Development vs production configuration
- **Performance Optimized**: Buffered logging with configurable levels

### Disposal System

- **DisposalManager**: Coordinated cleanup with priorities
- **BaseDisposable**: Abstract base class for disposable resources
- **BaseWebViewProvider**: Enhanced webview provider with disposal management
- **BaseService**: Service base class with lifecycle management

## Development

### Building

The core infrastructure is part of the main TypeScript compilation:

```bash
npm run compile
```

### Testing

Run the test suite to verify core infrastructure:

```bash
npm test
```

### Type Checking

Strict TypeScript configuration ensures type safety:

```bash
npm run type-check
```

## Configuration

### Logging Configuration

```typescript
const logConfig: Partial<LoggerConfiguration> = {
  level: LogLevel.INFO,
  enableConsole: true,
  enableVSCodeOutput: true,
  enableStructuredLogging: true
};
```

### Error Handling Configuration

```typescript
const errorConfig = {
  strategies: {
    [VesperaErrorCode.CONFIGURATION_LOAD_FAILED]: {
      shouldLog: true,
      shouldNotifyUser: true,
      shouldRetry: true,
      maxRetries: 3
    }
  }
};
```

### Memory Monitoring Configuration

```typescript
const memoryConfig = {
  enabled: true,
  thresholdMB: 100,
  checkIntervalMs: 30000
};
```

## Best Practices

1. **Always initialize core services first** before other extension components
2. **Use the provided base classes** for consistent patterns
3. **Handle errors through the VesperaErrorHandler** for consistent behavior
4. **Register all disposable resources** with appropriate metadata
5. **Use structured logging** with meaningful context
6. **Test disposal behavior** to prevent memory leaks

## Troubleshooting

### Common Issues

1. **Core services not initialized**: Call `VesperaCoreServices.initialize()` in extension activation
2. **Memory leaks**: Ensure all providers extend base classes and register resources
3. **Error handling not working**: Check that VesperaErrorHandler is properly initialized
4. **Logging not appearing**: Verify logger configuration and VS Code output channel

### Debug Commands

```typescript
// Get comprehensive stats
const stats = await VesperaCoreServices.getInstance().getStats();

// Health check
const health = await VesperaCoreServices.getInstance().healthCheck();

// Memory statistics
const memStats = VesperaContextManager.getInstance().getMemoryStats();
```

## License

This infrastructure is part of the Vespera Forge VS Code extension and follows the same licensing terms.