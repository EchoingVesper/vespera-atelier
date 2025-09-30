/**
 * Logging module for structured, extensible logging
 *
 * Features:
 * - Structured logging with context support
 * - Multiple log levels (DEBUG, INFO, WARN, ERROR)
 * - Extensible transport system (Console, File, Buffered, etc.)
 * - Multiple formatters (JSON, Pretty, Compact)
 * - Category-based logging
 * - Child loggers with inherited context
 *
 * @example Basic usage
 * ```typescript
 * import { createDefaultLogger } from '@vespera/typescript-shared/logging';
 *
 * const logger = createDefaultLogger('MyService');
 *
 * logger.info('Service started', { port: 3000, env: 'production' });
 * logger.warn('High memory usage', { usage: '85%' });
 * logger.error('Database connection failed', new Error('Timeout'), { db: 'postgres' });
 * ```
 *
 * @example Advanced configuration
 * ```typescript
 * import {
 *   StructuredLogger,
 *   LogLevel,
 *   ConsoleTransport,
 *   FileTransport,
 *   MultiTransport,
 *   PrettyFormatter,
 *   JSONFormatter
 * } from '@vespera/typescript-shared/logging';
 *
 * const logger = new StructuredLogger({
 *   level: LogLevel.DEBUG,
 *   category: 'API',
 *   transports: new MultiTransport([
 *     new ConsoleTransport(new PrettyFormatter({ colors: true })),
 *     new FileTransport('./logs/api.log', new JSONFormatter())
 *   ]),
 *   defaultContext: { service: 'backend', version: '1.0.0' }
 * });
 *
 * // Create child logger with additional context
 * const requestLogger = logger.child('Request', { requestId: 'abc123' });
 * requestLogger.info('Processing request', { method: 'GET', path: '/api/users' });
 * ```
 *
 * @example Testing with buffered transport
 * ```typescript
 * import { BufferedTransport } from '@vespera/typescript-shared/logging';
 *
 * const buffer = new BufferedTransport();
 * const logger = new StructuredLogger({
 *   level: LogLevel.DEBUG,
 *   category: 'Test',
 *   transports: [buffer]
 * });
 *
 * logger.info('Test message');
 * const entries = buffer.getEntries();
 * assert(entries.length === 1);
 * ```
 *
 * @module logging
 */

// Core logging - types
export type {
  Logger,
  LogContext,
  LogEntry,
  LogTransport,
  LoggerConfig,
} from './logger';

// Core logging - values
export {
  LogLevel,
  StructuredLogger,
  createLogger,
  getLogLevelName,
  parseLogLevel,
} from './logger';

// Formatters - types
export type {
  LogFormatter,
  PrettyFormatterOptions,
} from './formatters';

// Formatters - values
export {
  JSONFormatter,
  PrettyFormatter,
  CompactFormatter,
} from './formatters';

// Transports - types
export type {
  FileTransportOptions,
  BufferedTransportOptions,
} from './transports';

// Transports - values
export {
  ConsoleTransport,
  FileTransport,
  BufferedTransport,
  MultiTransport,
  FilterTransport,
} from './transports';

// Factory functions
import {
  Logger,
  LogLevel,
  StructuredLogger,
  parseLogLevel,
} from './logger';
import { ConsoleTransport } from './transports';
import { PrettyFormatter, JSONFormatter } from './formatters';

/**
 * Create a logger with default console output
 *
 * Uses environment variables:
 * - LOG_LEVEL: Set log level (DEBUG, INFO, WARN, ERROR)
 * - LOG_FORMAT: Set format (json, pretty, compact) - defaults to pretty
 * - NO_COLOR: Disable colors in pretty format
 *
 * @param category - Logger category
 * @param level - Optional log level override
 *
 * @example
 * ```typescript
 * const logger = createDefaultLogger('Database');
 * logger.info('Connected to database', { host: 'localhost', port: 5432 });
 * ```
 */
export function createDefaultLogger(
  category: string,
  level?: LogLevel
): Logger {
  // Determine log level
  const logLevel = level ?? (process.env.LOG_LEVEL
    ? parseLogLevel(process.env.LOG_LEVEL)
    : LogLevel.INFO);

  // Determine formatter
  const format = process.env.LOG_FORMAT?.toLowerCase() ?? 'pretty';
  const useColors = !process.env.NO_COLOR;

  const formatter =
    format === 'json'
      ? new JSONFormatter()
      : new PrettyFormatter({ colors: useColors });

  // Create transport
  const transport = new ConsoleTransport(formatter);

  return new StructuredLogger({
    level: logLevel,
    category,
    transports: [transport],
  });
}

/**
 * Create a logger with JSON output (useful for production)
 *
 * @param category - Logger category
 * @param level - Optional log level override
 *
 * @example
 * ```typescript
 * const logger = createJSONLogger('API', LogLevel.INFO);
 * logger.info('Request received', { method: 'POST', path: '/api/users' });
 * // Output: {"timestamp":"2024-01-01T00:00:00.000Z","level":"INFO",...}
 * ```
 */
export function createJSONLogger(
  category: string,
  level?: LogLevel
): Logger {
  const logLevel = level ?? LogLevel.INFO;
  const formatter = new JSONFormatter();
  const transport = new ConsoleTransport(formatter);

  return new StructuredLogger({
    level: logLevel,
    category,
    transports: [transport],
  });
}
