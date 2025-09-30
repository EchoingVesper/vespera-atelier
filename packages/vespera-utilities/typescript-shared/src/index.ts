/**
 * @vespera/typescript-shared
 *
 * Shared TypeScript utilities for Vespera Atelier projects.
 * Provides error handling, validation, lifecycle management, and more.
 */

// Error handling
export * from './error-handling/index.js';

// Validation (Zod schemas)
export * from './validation/index.js';

// Lifecycle management
export * from './lifecycle/index.js';

// Logging (re-export with explicit naming to avoid conflicts)
export type {
  Logger as StructuredLoggerInterface,
  LogContext,
  LogEntry,
  LogTransport,
  LoggerConfig,
  LogFormatter,
  PrettyFormatterOptions,
  FileTransportOptions,
  BufferedTransportOptions,
} from './logging/index.js';

export {
  LogLevel,
  StructuredLogger,
  createLogger,
  getLogLevelName,
  parseLogLevel,
  JSONFormatter,
  PrettyFormatter,
  CompactFormatter,
  ConsoleTransport,
  FileTransport,
  BufferedTransport,
  MultiTransport,
  FilterTransport,
  createDefaultLogger,
  createJSONLogger,
} from './logging/index.js';

// Circuit breaker
export * from './circuit-breaker/index.js';

// Performance metrics
export * from './metrics/index.js';

// Shared types
export * from './types/index.js';