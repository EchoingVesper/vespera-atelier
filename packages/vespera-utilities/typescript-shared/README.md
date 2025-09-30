# @vespera/typescript-shared

Shared TypeScript utilities for Vespera Atelier projects.

## Overview

This package provides production-ready utilities extracted from multiple Vespera plugins (Obsidian, VS Code, Penpot) and converted from Rust implementations (vespera-bindery). The utilities follow proven patterns and best practices for error handling, validation, lifecycle management, and resilience.

## Features

- **Error Handling**: Categorized errors with retry logic and recovery patterns
- **Validation**: Zod schemas for Penpot types, templates, and MCP messages
- **Lifecycle Management**: Resource tracking, disposal hooks, and cleanup utilities
- **Logging**: Structured logging with context support
- **Circuit Breaker**: Resilient API calls with failure handling
- **Performance Metrics**: Operation timing and health monitoring
- **Type Definitions**: Shared types for tasks, MCP, and Penpot objects

## Installation

```bash
npm install @vespera/typescript-shared
```

## Usage

### Error Handling

```typescript
import { VesperaError, ErrorHandler } from '@vespera/typescript-shared/error-handling';

// Define custom error
class TemplateNotFoundError extends VesperaError {
  category() { return 'template'; }
  isRecoverable() { return false; }
  userMessage() { return `Template "${this.templateId}" not found`; }
}

// Use error handler
const handler = new ErrorHandler();
await handler.handleError(error);
```

### Validation

```typescript
import { PenpotObjectSchema } from '@vespera/typescript-shared/validation';

// Validate Penpot object
const result = PenpotObjectSchema.safeParse(data);
if (result.success) {
  const obj = result.data; // Fully typed
}
```

### Circuit Breaker

```typescript
import { CircuitBreaker } from '@vespera/typescript-shared/circuit-breaker';

const breaker = new CircuitBreaker({
  failureThreshold: 5,
  recoveryTimeout: 30000,
  requestTimeout: 5000
});

const result = await breaker.execute(() =>
  fetch('https://api.penpot.app/...')
);
```

## Package Structure

```
typescript-shared/
├── src/
│   ├── error-handling/       # Error classes and handler
│   ├── validation/           # Zod schemas
│   │   └── schemas/
│   │       ├── penpot.ts     # Penpot types
│   │       ├── templates.ts  # Template definitions
│   │       └── mcp.ts        # MCP messages
│   ├── lifecycle/            # Resource management
│   ├── logging/              # Structured logging
│   ├── circuit-breaker/      # Resilient API calls
│   ├── metrics/              # Performance tracking
│   ├── types/                # Shared type definitions
│   └── index.ts
└── docs/                     # Usage documentation
```

## Documentation

Detailed documentation is available in the `docs/` directory:

- [Error Handling Guide](./docs/ERROR_HANDLING.md)
- [Validation Guide](./docs/VALIDATION.md)
- [Lifecycle Management](./docs/LIFECYCLE.md)
- [Circuit Breaker](./docs/CIRCUIT_BREAKER.md)
- [Metrics](./docs/METRICS.md)

## Development

```bash
# Install dependencies
npm install

# Build package
npm run build

# Watch mode
npm run watch

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## Conversion Notes

Many utilities in this package were converted from Rust implementations in `vespera-bindery`. The conversion maintains the same design patterns and error handling strategies while adapting to TypeScript idioms.

**Source References**:
- Error handling: `vespera-bindery/src/error.rs`
- Type definitions: `vespera-bindery/src/types.rs`
- Circuit breaker: `vespera-bindery/src/rag/circuit_breaker.rs`
- VS Code error handling: `plugins/VSCode/vespera-forge/src/core/error-handling/`
- Obsidian MCP client: `plugins/Obsidian/vespera-scriptorium/src/mcp/`

## License

AGPL-3.0 - See LICENSE file for details