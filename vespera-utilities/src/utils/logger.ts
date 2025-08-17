import type { Logger as ILogger } from '../interfaces/index.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogFormat = 'json' | 'pretty';

interface LoggerOptions {
  level: LogLevel;
  format: LogFormat;
  prefix?: string;
}

/**
 * Simple logger implementation
 */
export class Logger implements ILogger {
  private readonly levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  constructor(private readonly options: LoggerOptions) {}

  debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log('info', message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, ...args);
  }

  error(message: string, error?: Error, ...args: unknown[]): void {
    if (error) {
      this.log('error', message, { error: error.message, stack: error.stack }, ...args);
    } else {
      this.log('error', message, ...args);
    }
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (this.levels[level] < this.levels[this.options.level]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = this.options.prefix ? `[${this.options.prefix}] ` : '';

    if (this.options.format === 'json') {
      const logEntry = {
        timestamp,
        level,
        message: `${prefix}${message}`,
        ...(args.length > 0 && { data: args })
      };
      console.log(JSON.stringify(logEntry));
    } else {
      const levelStr = `[${level.toUpperCase()}]`.padEnd(7);
      const formattedArgs = args.length > 0 ? ` ${JSON.stringify(args)}` : '';
      console.log(`${timestamp} ${levelStr} ${prefix}${message}${formattedArgs}`);
    }
  }
}

/**
 * Create a logger instance with a specific prefix
 */
export function createLogger(prefix: string, options: Omit<LoggerOptions, 'prefix'>): ILogger {
  return new Logger({ ...options, prefix });
}