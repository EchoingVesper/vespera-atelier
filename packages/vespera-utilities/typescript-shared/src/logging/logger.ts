/**
 * Core logging interfaces and implementation
 *
 * @example
 * ```typescript
 * import { createLogger, LogLevel } from './logging';
 *
 * const logger = createLogger('MyComponent', LogLevel.DEBUG);
 *
 * logger.info('Service started', { port: 3000 });
 * logger.warn('High memory usage', { usage: '85%' });
 * logger.error('Connection failed', { error: new Error('Timeout') });
 * ```
 */

/**
 * Log severity levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Structured logging context
 */
export type LogContext = Record<string, any>;

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  category: string;
  message: string;
  context?: LogContext;
  error?: Error;
}

/**
 * Logger interface
 */
export interface Logger {
  /**
   * Log debug message
   * @param message - Log message
   * @param context - Optional structured context
   */
  debug(message: string, context?: LogContext): void;

  /**
   * Log info message
   * @param message - Log message
   * @param context - Optional structured context
   */
  info(message: string, context?: LogContext): void;

  /**
   * Log warning message
   * @param message - Log message
   * @param context - Optional structured context
   */
  warn(message: string, context?: LogContext): void;

  /**
   * Log error message
   * @param message - Log message
   * @param error - Optional error object
   * @param context - Optional structured context
   */
  error(message: string, error?: Error, context?: LogContext): void;

  /**
   * Create a child logger with additional context
   * @param childCategory - Child category name
   * @param childContext - Additional context to merge
   */
  child(childCategory: string, childContext?: LogContext): Logger;
}

/**
 * Log transport interface
 */
export interface LogTransport {
  /**
   * Handle a log entry
   * @param entry - Log entry to transport
   */
  log(entry: LogEntry): void | Promise<void>;

  /**
   * Flush any buffered logs
   */
  flush?(): void | Promise<void>;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level: LogLevel;
  category: string;
  transports: LogTransport[];
  defaultContext?: LogContext;
}

/**
 * Structured logger implementation
 *
 * @example
 * ```typescript
 * const logger = new StructuredLogger({
 *   level: LogLevel.INFO,
 *   category: 'API',
 *   transports: [new ConsoleTransport()],
 *   defaultContext: { service: 'backend' }
 * });
 *
 * logger.info('Request received', { method: 'GET', path: '/api/users' });
 * ```
 */
export class StructuredLogger implements Logger {
  private config: LoggerConfig;

  constructor(config: LoggerConfig) {
    this.config = config;
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.ERROR,
      category: this.config.category,
      message,
      context: this.mergeContext(context),
      error,
    };

    this.emit(entry);
  }

  child(childCategory: string, childContext?: LogContext): Logger {
    return new StructuredLogger({
      ...this.config,
      category: `${this.config.category}:${childCategory}`,
      defaultContext: this.mergeContext(childContext),
    });
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (level < this.config.level) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      category: this.config.category,
      message,
      context: this.mergeContext(context),
    };

    this.emit(entry);
  }

  private mergeContext(context?: LogContext): LogContext | undefined {
    if (!this.config.defaultContext && !context) {
      return undefined;
    }

    return {
      ...this.config.defaultContext,
      ...context,
    };
  }

  private emit(entry: LogEntry): void {
    for (const transport of this.config.transports) {
      try {
        const result = transport.log(entry);
        if (result instanceof Promise) {
          result.catch((error) => {
            console.error('Transport error:', error);
          });
        }
      } catch (error) {
        console.error('Transport error:', error);
      }
    }
  }
}

/**
 * Get log level name
 */
export function getLogLevelName(level: LogLevel): string {
  return LogLevel[level];
}

/**
 * Parse log level from string
 */
export function parseLogLevel(level: string): LogLevel {
  const upperLevel = level.toUpperCase();
  return LogLevel[upperLevel as keyof typeof LogLevel] ?? LogLevel.INFO;
}

/**
 * Create a logger with the given category
 *
 * @param category - Logger category
 * @param level - Log level (defaults to INFO or LOG_LEVEL env var)
 * @param transports - Log transports (defaults to console transport)
 *
 * @example
 * ```typescript
 * const logger = createLogger('Database', LogLevel.DEBUG);
 * logger.debug('Query executed', { sql: 'SELECT * FROM users', duration: 42 });
 * ```
 */
export function createLogger(
  category: string,
  level?: LogLevel,
  transports?: LogTransport[]
): Logger {
  // Default to environment variable or INFO
  const defaultLevel = process.env.LOG_LEVEL
    ? parseLogLevel(process.env.LOG_LEVEL)
    : LogLevel.INFO;

  return new StructuredLogger({
    level: level ?? defaultLevel,
    category,
    transports: transports ?? [], // Transports will be added by factory
  });
}