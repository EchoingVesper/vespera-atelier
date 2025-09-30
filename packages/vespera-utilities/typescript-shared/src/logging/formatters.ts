/**
 * Log formatters for different output styles
 *
 * @example
 * ```typescript
 * import { JSONFormatter, PrettyFormatter } from './formatters';
 *
 * const jsonFormatter = new JSONFormatter();
 * const prettyFormatter = new PrettyFormatter({ colors: true });
 *
 * console.log(jsonFormatter.format(logEntry));
 * console.log(prettyFormatter.format(logEntry));
 * ```
 */

import { LogEntry, LogLevel, getLogLevelName } from './logger';

/**
 * Log formatter interface
 */
export interface LogFormatter {
  /**
   * Format a log entry to a string
   * @param entry - Log entry to format
   * @returns Formatted log string
   */
  format(entry: LogEntry): string;
}

/**
 * ANSI color codes for terminal output
 */
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

/**
 * JSON formatter for structured logging
 *
 * @example
 * ```typescript
 * const formatter = new JSONFormatter({ pretty: true });
 * console.log(formatter.format(logEntry));
 * // Output: { "timestamp": "2024-01-01T00:00:00.000Z", ... }
 * ```
 */
export class JSONFormatter implements LogFormatter {
  constructor(private options: { pretty?: boolean } = {}) {}

  format(entry: LogEntry): string {
    const logObject: Record<string, any> = {
      timestamp: entry.timestamp.toISOString(),
      level: getLogLevelName(entry.level),
      category: entry.category,
      message: entry.message,
    };

    if (entry.context) {
      logObject.context = entry.context;
    }

    if (entry.error) {
      logObject.error = {
        message: entry.error.message,
        stack: entry.error.stack,
        name: entry.error.name,
      };
    }

    return this.options.pretty
      ? JSON.stringify(logObject, null, 2)
      : JSON.stringify(logObject);
  }
}

/**
 * Pretty formatter configuration
 */
export interface PrettyFormatterOptions {
  colors?: boolean;
  showTimestamp?: boolean;
  showCategory?: boolean;
  timestampFormat?: 'iso' | 'time' | 'full';
}

/**
 * Human-readable log formatter
 *
 * @example
 * ```typescript
 * const formatter = new PrettyFormatter({
 *   colors: true,
 *   timestampFormat: 'time'
 * });
 *
 * console.log(formatter.format(logEntry));
 * // Output: 12:34:56 [INFO] MyComponent: Service started { port: 3000 }
 * ```
 */
export class PrettyFormatter implements LogFormatter {
  private options: Required<PrettyFormatterOptions>;

  constructor(options: PrettyFormatterOptions = {}) {
    this.options = {
      colors: options.colors ?? true,
      showTimestamp: options.showTimestamp ?? true,
      showCategory: options.showCategory ?? true,
      timestampFormat: options.timestampFormat ?? 'time',
    };
  }

  format(entry: LogEntry): string {
    const parts: string[] = [];

    // Timestamp
    if (this.options.showTimestamp) {
      const timestamp = this.formatTimestamp(entry.timestamp);
      parts.push(this.colorize(timestamp, COLORS.gray));
    }

    // Level
    const level = this.formatLevel(entry.level);
    parts.push(level);

    // Category
    if (this.options.showCategory) {
      const category = this.colorize(entry.category, COLORS.cyan);
      parts.push(category);
    }

    // Message
    parts.push(entry.message);

    // Build main line
    let output = parts.join(' ');

    // Context
    if (entry.context && Object.keys(entry.context).length > 0) {
      const contextStr = JSON.stringify(entry.context);
      output += ' ' + this.colorize(contextStr, COLORS.dim);
    }

    // Error
    if (entry.error) {
      output += '\n' + this.formatError(entry.error);
    }

    return output;
  }

  private formatTimestamp(timestamp: Date): string {
    switch (this.options.timestampFormat) {
      case 'iso':
        return timestamp.toISOString();
      case 'time':
        return timestamp.toTimeString().split(' ')[0]; // HH:MM:SS
      case 'full':
        return timestamp.toString();
      default:
        return timestamp.toTimeString().split(' ')[0];
    }
  }

  private formatLevel(level: LogLevel): string {
    const levelName = getLogLevelName(level);
    const paddedLevel = `[${levelName}]`.padEnd(7);

    switch (level) {
      case LogLevel.DEBUG:
        return this.colorize(paddedLevel, COLORS.blue);
      case LogLevel.INFO:
        return this.colorize(paddedLevel, COLORS.cyan);
      case LogLevel.WARN:
        return this.colorize(paddedLevel, COLORS.yellow);
      case LogLevel.ERROR:
        return this.colorize(paddedLevel, COLORS.red);
      default:
        return paddedLevel;
    }
  }

  private formatError(error: Error): string {
    const errorMessage = this.colorize(`Error: ${error.message}`, COLORS.red);
    const stack = error.stack
      ? this.colorize(error.stack, COLORS.dim)
      : '';

    return stack ? `${errorMessage}\n${stack}` : errorMessage;
  }

  private colorize(text: string, color: string): string {
    if (!this.options.colors) {
      return text;
    }

    return `${color}${text}${COLORS.reset}`;
  }
}

/**
 * Compact formatter for minimal output
 *
 * @example
 * ```typescript
 * const formatter = new CompactFormatter();
 * console.log(formatter.format(logEntry));
 * // Output: INFO MyComponent: Service started
 * ```
 */
export class CompactFormatter implements LogFormatter {
  format(entry: LogEntry): string {
    const level = getLogLevelName(entry.level);
    return `${level} ${entry.category}: ${entry.message}`;
  }
}