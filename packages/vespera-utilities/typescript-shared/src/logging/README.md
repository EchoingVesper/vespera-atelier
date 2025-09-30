# Logging Module

Comprehensive structured logging system for TypeScript applications.

## Features

- **Structured Logging**: Log with rich contextual data
- **Multiple Log Levels**: DEBUG, INFO, WARN, ERROR
- **Extensible Transports**: Console, File, Buffered, Multi, Filter
- **Multiple Formatters**: JSON, Pretty (colored), Compact
- **Category-based Logging**: Organize logs by component/module
- **Child Loggers**: Inherit context and category hierarchy
- **Environment Configuration**: Control via LOG_LEVEL, LOG_FORMAT, NO_COLOR

## Quick Start

### Basic Usage

```typescript
import { createDefaultLogger } from '@vespera/typescript-shared/logging';

const logger = createDefaultLogger('MyService');

logger.info('Service started', { port: 3000 });
logger.warn('High memory usage', { usage: '85%' });
logger.error('Connection failed', new Error('Timeout'));
```

### Child Loggers

```typescript
const logger = createDefaultLogger('API');
const requestLogger = logger.child('Request', { requestId: 'abc123' });

requestLogger.info('Processing request', { method: 'GET', path: '/users' });
// Output includes inherited requestId context
```

### Multiple Transports

```typescript
import {
  StructuredLogger,
  LogLevel,
  ConsoleTransport,
  FileTransport,
  MultiTransport,
  PrettyFormatter,
  JSONFormatter
} from '@vespera/typescript-shared/logging';

const logger = new StructuredLogger({
  level: LogLevel.DEBUG,
  category: 'API',
  transports: [
    new MultiTransport([
      new ConsoleTransport(new PrettyFormatter({ colors: true })),
      new FileTransport('./logs/api.log', new JSONFormatter())
    ])
  ]
});
```

## Components

### Core

- **Logger**: Interface defining log methods (debug, info, warn, error)
- **StructuredLogger**: Main implementation with transport support
- **LogLevel**: Enum for log severity (DEBUG=0, INFO=1, WARN=2, ERROR=3)
- **LogContext**: Type for structured context data
- **LogEntry**: Complete log entry structure

### Formatters

- **JSONFormatter**: Structured JSON output
- **PrettyFormatter**: Human-readable colored output
- **CompactFormatter**: Minimal single-line output

### Transports

- **ConsoleTransport**: Output to stdout/stderr
- **FileTransport**: Write to log files with rotation
- **BufferedTransport**: Buffer logs for batching or testing
- **MultiTransport**: Combine multiple transports
- **FilterTransport**: Conditional logging based on criteria

## Environment Variables

- `LOG_LEVEL`: Set minimum log level (DEBUG, INFO, WARN, ERROR)
- `LOG_FORMAT`: Choose format (json, pretty, compact)
- `NO_COLOR`: Disable colors in pretty format

## Examples

See `examples.ts` for comprehensive usage examples including:

1. Basic logging
2. Child loggers with context
3. Multiple transports
4. Filtered transports
5. Buffered transport for testing
6. Different formatter styles
7. Production JSON logging
8. Category-based logging
9. Environment configuration
10. Advanced structured logging

## Testing

Use `BufferedTransport` to capture logs in tests:

```typescript
import { BufferedTransport, StructuredLogger, LogLevel } from './logging';

const buffer = new BufferedTransport();
const logger = new StructuredLogger({
  level: LogLevel.DEBUG,
  category: 'Test',
  transports: [buffer]
});

logger.info('Test message');
const entries = buffer.getEntries();
expect(entries).toHaveLength(1);
expect(entries[0].message).toBe('Test message');
```

## Migration from Simple Logger

If migrating from the Penpot bridge logger:

```typescript
// Old (Penpot bridge style)
import { logger } from './utils/logger';
logger.info('Message');

// New (structured logging)
import { createDefaultLogger } from '@vespera/typescript-shared/logging';
const logger = createDefaultLogger('MyComponent');
logger.info('Message', { context: 'data' });
```

## Best Practices

1. **Use Categories**: Create separate loggers for different modules
2. **Add Context**: Include relevant data in the context parameter
3. **Child Loggers**: Use for request-scoped or operation-scoped logging
4. **Error Objects**: Always pass Error objects to error() method
5. **Appropriate Levels**: Use DEBUG for verbose, INFO for normal, WARN for issues, ERROR for failures
6. **Structured Data**: Log objects in context rather than string concatenation

## Architecture

The logging module follows a layered architecture:

```
Logger Interface
       ↓
StructuredLogger Implementation
       ↓
LogTransport(s) → Formatter → Output Destination
```

This design allows:
- Easy testing via BufferedTransport
- Multiple output destinations
- Custom formatters
- Transport filtering and routing