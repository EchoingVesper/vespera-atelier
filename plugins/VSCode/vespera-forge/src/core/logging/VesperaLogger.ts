/**
 * Vespera Forge - Comprehensive Logging Framework
 * 
 * VS Code integrated logger with structured logging, multiple output channels,
 * and development/production mode configuration.
 */

import * as vscode from 'vscode';
import { EnhancedDisposable } from '../disposal/DisposalManager';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
  source: string;
  sessionId: string;
}

export interface LoggerConfiguration {
  level: LogLevel;
  enableConsole: boolean;
  enableVSCodeOutput: boolean;
  enableFile: boolean;
  filePath?: string;
  maxFileSize?: number;
  maxFiles?: number;
  enableStructuredLogging: boolean;
  enableTelemetry: boolean;
}

/**
 * Comprehensive logging service with VS Code integration and structured logging
 */
export class VesperaLogger implements vscode.Disposable, EnhancedDisposable {
  private static instance: VesperaLogger;
  private outputChannel: vscode.OutputChannel;
  private config: LoggerConfiguration;
  private sessionId: string;
  private logBuffer: LogEntry[] = [];
  private flushInterval?: NodeJS.Timeout;
  private disposables: vscode.Disposable[] = [];
  private _isDisposed = false;

  private constructor(_context: vscode.ExtensionContext, config: Partial<LoggerConfiguration> = {}) {
    this.sessionId = this.generateSessionId();
    this.config = this.mergeConfiguration(config);
    
    this.outputChannel = vscode.window.createOutputChannel('Vespera Forge', 'log');
    this.disposables.push(this.outputChannel);

    if (this.config.enableVSCodeOutput) {
      // Don't show automatically - let user choose when to view logs
      // this.outputChannel.show(true);
    }

    this.startLogFlushing();
    this.setupDevelopmentLogging();
  }

  public static initialize(
    context: vscode.ExtensionContext, 
    config?: Partial<LoggerConfiguration>
  ): VesperaLogger {
    if (!VesperaLogger.instance) {
      VesperaLogger.instance = new VesperaLogger(context, config);
    }
    return VesperaLogger.instance;
  }

  public static getInstance(): VesperaLogger {
    if (!VesperaLogger.instance) {
      throw new Error('VesperaLogger not initialized');
    }
    return VesperaLogger.instance;
  }

  private mergeConfiguration(config: Partial<LoggerConfiguration>): LoggerConfiguration {
    const isDevelopment = vscode.env.appName.includes('Insiders') || process.env['NODE_ENV'] === 'development';
    
    return {
      level: config.level ?? (isDevelopment ? LogLevel.DEBUG : LogLevel.INFO),
      enableConsole: config.enableConsole ?? isDevelopment,
      enableVSCodeOutput: config.enableVSCodeOutput ?? true,
      enableFile: config.enableFile ?? false,
      maxFileSize: config.maxFileSize ?? 10 * 1024 * 1024, // 10MB
      maxFiles: config.maxFiles ?? 5,
      enableStructuredLogging: config.enableStructuredLogging ?? true,
      enableTelemetry: config.enableTelemetry ?? true,
      ...config
    };
  }

  public debug(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  public info(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  public warn(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  public error(message: string, error?: Error | any, metadata?: Record<string, any>): void {
    const enhancedMetadata = {
      ...metadata,
      ...(error && {
        error: {
          name: error.name || 'Error',
          message: error.message || String(error),
          stack: error.stack
        }
      })
    };

    this.log(LogLevel.ERROR, message, enhancedMetadata);
  }

  public fatal(message: string, error?: Error | any, metadata?: Record<string, any>): void {
    const enhancedMetadata = {
      ...metadata,
      ...(error && {
        error: {
          name: error.name || 'Error',
          message: error.message || String(error),
          stack: error.stack
        }
      })
    };

    this.log(LogLevel.FATAL, message, enhancedMetadata);
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, any>): void {
    if (level < this.config.level) {
      return; // Skip logging below configured level
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      metadata,
      source: this.getCallerSource(),
      sessionId: this.sessionId
    };

    this.logBuffer.push(entry);

    // Immediate output for console and VS Code
    this.outputToChannels(entry);

    // Buffer for file logging (flushed periodically)
    if (this.logBuffer.length > 100) {
      this.flushLogs();
    }
  }

  private outputToChannels(entry: LogEntry): void {
    const formattedMessage = this.formatLogEntry(entry);
    const consoleMessage = this.formatConsoleMessage(entry);

    // Console logging (development)
    if (this.config.enableConsole) {
      switch (entry.level) {
        case LogLevel.DEBUG:
          console.debug(consoleMessage);
          break;
        case LogLevel.INFO:
          console.info(consoleMessage);
          break;
        case LogLevel.WARN:
          console.warn(consoleMessage);
          break;
        case LogLevel.ERROR:
        case LogLevel.FATAL:
          console.error(consoleMessage);
          break;
      }
    }

    // VS Code Output Channel
    if (this.config.enableVSCodeOutput) {
      this.outputChannel.appendLine(formattedMessage);
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const levelName = LogLevel[entry.level].padEnd(5);
    
    let formatted = `[${timestamp}] ${levelName} ${entry.message}`;
    
    if (entry.source) {
      formatted += ` (${entry.source})`;
    }

    if (entry.metadata && this.config.enableStructuredLogging) {
      formatted += `\n  Metadata: ${JSON.stringify(entry.metadata, null, 2)}`;
    }

    return formatted;
  }

  private formatConsoleMessage(entry: LogEntry): string {
    const levelName = LogLevel[entry.level];
    let message = `[Vespera:${levelName}] ${entry.message}`;
    
    if (entry.metadata) {
      message += ` | ${JSON.stringify(entry.metadata)}`;
    }
    
    return message;
  }

  private getCallerSource(): string {
    const stack = new Error().stack;
    const stackLines = stack?.split('\n') || [];
    
    // Find the first stack line that's not from the logger itself
    const relevantLine = stackLines.find((line, index) => 
      index > 2 && // Skip Error constructor and this method
      line.includes('.ts:') && 
      !line.includes('VesperaLogger') &&
      !line.includes('log(')
    );
    
    if (relevantLine) {
      // Extract file and line number
      const match = relevantLine.match(/([^/\\]+\.ts):(\d+):\d+/);
      if (match) {
        return `${match[1]}:${match[2]}`;
      }
    }
    
    return 'unknown';
  }

  private startLogFlushing(): void {
    this.flushInterval = setInterval(() => {
      this.flushLogs();
    }, 10000); // Flush every 10 seconds
  }

  private flushLogs(): void {
    if (this.logBuffer.length === 0) {
      return;
    }

    // For file logging, we would write buffered entries
    // For now, we just clear the buffer since we're doing immediate output
    this.logBuffer = [];
  }

  private setupDevelopmentLogging(): void {
    if (this.config.enableConsole) {
      // Add context to all console logs in development
      const originalLog = console.log;
      const originalError = console.error;
      const originalWarn = console.warn;

      console.log = (...args) => originalLog('[Vespera:Dev]', ...args);
      console.error = (...args) => originalError('[Vespera:Dev:Error]', ...args);
      console.warn = (...args) => originalWarn('[Vespera:Dev:Warn]', ...args);
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current logging statistics
   */
  public getLogStats(): {
    sessionId: string;
    level: LogLevel;
    bufferSize: number;
    configuration: LoggerConfiguration;
  } {
    return {
      sessionId: this.sessionId,
      level: this.config.level,
      bufferSize: this.logBuffer.length,
      configuration: this.config
    };
  }

  /**
   * Show the VS Code output channel for debugging
   */
  public showOutputChannel(): void {
    this.outputChannel.show(true);
  }

  /**
   * Clear the VS Code output channel
   */
  public clearOutput(): void {
    this.outputChannel.clear();
  }

  /**
   * Create a child logger with additional context
   */
  public createChild(_context: string): VesperaLogger {
    // For now, return the same instance with context
    // In a full implementation, this would create a new instance with context
    return this;
  }

  public get isDisposed(): boolean {
    return this._isDisposed;
  }

  public dispose(): void {
    if (this._isDisposed) return;
    
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    
    this.flushLogs();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    this._isDisposed = true;
  }
}