/**
 * Logger module
 * Provides centralized logging functionality with configurable log levels
 * @module Logger
 */

/**
 * Log levels in order of increasing verbosity
 */
export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  TRACE = 5
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level: LogLevel;
  includeTimestamp: boolean;
  includeLogLevel: boolean;
}

/**
 * Logger class for centralized logging
 */
export class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  
  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.config = {
      level: LogLevel.INFO,
      includeTimestamp: true,
      includeLogLevel: true
    };
  }
  
  /**
   * Get the Logger instance
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }
  
  /**
   * Set the log level
   * @param level The log level to set
   */
  public setLogLevel(level: LogLevel): void {
    this.config.level = level;
    this.info(`Log level set to ${LogLevel[level]}`);
  }
  
  /**
   * Get the current log level
   * @returns The current log level
   */
  public getLogLevel(): LogLevel {
    return this.config.level;
  }
  
  /**
   * Configure the logger
   * @param config Logger configuration
   */
  public configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
    this.info(`Logger configured: ${JSON.stringify(this.config)}`);
  }
  
  /**
   * Format a log message
   * @param level Log level
   * @param message Message to log
   * @param data Additional data to log
   * @returns Formatted log message
   */
  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const parts: string[] = [];
    
    // Add timestamp if enabled
    if (this.config.includeTimestamp) {
      parts.push(`[${new Date().toISOString()}]`);
    }
    
    // Add log level if enabled
    if (this.config.includeLogLevel) {
      parts.push(`[${LogLevel[level]}]`);
    }
    
    // Add message
    parts.push(message);
    
    return parts.join(' ');
  }
  
  /**
   * Log an error message
   * @param message Message to log
   * @param data Additional data to log
   */
  public error(message: string, data?: any): void {
    if (this.config.level >= LogLevel.ERROR) {
      console.error(this.formatMessage(LogLevel.ERROR, message), data || '');
    }
  }
  
  /**
   * Log a warning message
   * @param message Message to log
   * @param data Additional data to log
   */
  public warn(message: string, data?: any): void {
    if (this.config.level >= LogLevel.WARN) {
      console.warn(this.formatMessage(LogLevel.WARN, message), data || '');
    }
  }
  
  /**
   * Log an info message
   * @param message Message to log
   * @param data Additional data to log
   */
  public info(message: string, data?: any): void {
    if (this.config.level >= LogLevel.INFO) {
      console.info(this.formatMessage(LogLevel.INFO, message), data || '');
    }
  }
  
  /**
   * Log a debug message
   * @param message Message to log
   * @param data Additional data to log
   */
  public debug(message: string, data?: any): void {
    if (this.config.level >= LogLevel.DEBUG) {
      console.debug(this.formatMessage(LogLevel.DEBUG, message), data || '');
    }
  }
  
  /**
   * Log a trace message
   * @param message Message to log
   * @param data Additional data to log
   */
  public trace(message: string, data?: any): void {
    if (this.config.level >= LogLevel.TRACE) {
      console.log(this.formatMessage(LogLevel.TRACE, message), data || '');
    }
  }
  
  /**
   * Log a message with a specific level
   * @param level Log level
   * @param message Message to log
   * @param data Additional data to log
   */
  public log(level: LogLevel, message: string, data?: any): void {
    switch (level) {
      case LogLevel.ERROR:
        this.error(message, data);
        break;
      case LogLevel.WARN:
        this.warn(message, data);
        break;
      case LogLevel.INFO:
        this.info(message, data);
        break;
      case LogLevel.DEBUG:
        this.debug(message, data);
        break;
      case LogLevel.TRACE:
        this.trace(message, data);
        break;
    }
  }
}

/**
 * Get the logger instance
 * @returns Logger instance
 */
export function getLogger(): Logger {
  return Logger.getInstance();
}