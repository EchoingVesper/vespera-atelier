/**
 * Vespera Forge - Comprehensive Logging Framework
 *
 * VS Code integrated logger with structured logging, multiple output channels,
 * and development/production mode configuration.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EnhancedDisposable } from '../disposal/DisposalManager';
import { LoggingConfigurationManager } from './LoggingConfigurationManager';
import { LogLevel, LogRotationStrategy } from './LoggingConfiguration';
import { VesperaEvents } from '../../utils/events';

// Re-export LogLevel for backward compatibility
export { LogLevel };

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
  private configManager?: LoggingConfigurationManager;
  private logDirectory: string = '';
  private currentLogFile: string = '';
  private currentLogFileSize: number = 0;
  private componentName: string = 'global';
  private bufferOverflowCount: number = 0;
  private fileLoggingEnabled: boolean = true;
  private isLogDirectoryInitialized: boolean = false;
  // TODO: Async file writing support
  // private writeQueue: Promise<void> = Promise.resolve();
  // private isFlushInProgress = false;

  private constructor(private context: vscode.ExtensionContext, config: Partial<LoggerConfiguration> = {}) {
    this.sessionId = this.generateSessionId();
    this.config = this.mergeConfiguration(config);

    this.outputChannel = vscode.window.createOutputChannel('Vespera Forge', 'log');
    this.disposables.push(this.outputChannel);

    if (this.config.enableVSCodeOutput) {
      // Don't show automatically - let user choose when to view logs
      // this.outputChannel.show(true);
    }

    // Initialize configuration manager
    this.initializeConfigManager();

    // Set up log directory
    this.initializeLogDirectory();

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
    // Check against configuration manager's log level if available
    const config = this.configManager?.getConfiguration();
    const componentLevel = config && this.configManager ? this.configManager.getLogLevel(this.componentName) : this.config.level;

    if (this.getLevelPriority(level) < this.getLevelPriority(componentLevel)) {
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

    // Check buffer size and handle overflow BEFORE adding entry
    const bufferConfig = config?.outputs.file.bufferConfig;
    const maxBufferSize = bufferConfig?.maxBufferSize || 1000;

    if (this.logBuffer.length >= maxBufferSize) {
      this.handleBufferOverflow(bufferConfig?.overflowStrategy || 'drop-oldest');
    }

    this.logBuffer.push(entry);

    // Immediate output for console and VS Code
    this.outputToChannels(entry);

    // Emit log event to event bus if enabled
    if (config?.outputs.events.enabled) {
      const eventMinLevel = config.outputs.events.minLevel;
      const shouldEmit = eventMinLevel
        ? this.getLevelPriority(eventMinLevel) <= this.getLevelPriority(level)
        : this.getLevelPriority(level) >= this.getLevelPriority(LogLevel.WARN); // Default: warn and above

      if (shouldEmit) {
        VesperaEvents.logEntryCreated(
          level, // LogLevel is already a string enum matching the expected type
          this.componentName,
          message,
          metadata,
          entry.source
        );
      }
    }

    // Buffer for file logging (flushed based on threshold)
    const flushThreshold = bufferConfig?.flushThreshold || 100;
    if (this.logBuffer.length >= flushThreshold) {
      this.flushLogs();
    }
  }

  /**
   * Get numeric priority for log level comparison
   */
  private getLevelPriority(level: LogLevel): number {
    const priorities: Record<LogLevel, number> = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 1,
      [LogLevel.WARN]: 2,
      [LogLevel.ERROR]: 3,
      [LogLevel.FATAL]: 4
    };
    return priorities[level];
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
    const levelName = entry.level.toUpperCase().padEnd(5);

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
    const levelName = entry.level.toUpperCase();
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

  /**
   * Handle buffer overflow based on configured strategy
   */
  private handleBufferOverflow(strategy: 'drop-oldest' | 'drop-newest' | 'force-flush'): void {
    this.bufferOverflowCount++;

    switch (strategy) {
      case 'drop-oldest':
        // Remove oldest entry (first in buffer)
        this.logBuffer.shift();
        break;

      case 'drop-newest':
        // Remove newest entry (last in buffer)
        this.logBuffer.pop();
        break;

      case 'force-flush':
        // Force flush to make room
        this.flushLogs();
        break;
    }

    // Emit buffer overflow event
    VesperaEvents.logBufferOverflow(this.componentName, this.bufferOverflowCount);
  }

  private startLogFlushing(): void {
    const config = this.configManager?.getConfiguration();
    const flushInterval = config?.outputs.file.bufferConfig?.flushIntervalMs || 10000;

    this.flushInterval = setInterval(() => {
      this.flushLogs();
    }, flushInterval);
  }

  private flushLogs(): void {
    if (this.logBuffer.length === 0) {
      return;
    }

    // If file logging is disabled, just clear the buffer
    if (!this.fileLoggingEnabled) {
      this.logBuffer = [];
      return;
    }

    // Write to file if enabled
    const config = this.configManager?.getConfiguration();
    if (config?.outputs.file.enabled && this.currentLogFile) {
      try {
        // Check if rotation is needed before writing
        this.rotateLogFileIfNeeded();

        // Format entries for file output
        const logLines = this.logBuffer.map(entry => this.formatLogEntry(entry)).join('\n') + '\n';

        // Append to log file
        fs.appendFileSync(this.currentLogFile, logLines, 'utf-8');

        // Update current file size
        this.currentLogFileSize += Buffer.byteLength(logLines, 'utf-8');

        // Reset failure count on successful write
        this.fileLoggingFailureCount = 0;
      } catch (error) {
        const errorCode = (error as NodeJS.ErrnoException).code;
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Provide specific error messages for different failure modes
        if (errorCode === 'EACCES') {
          console.error('Permission denied when writing to log file:', errorMessage);
          this.handleFileLoggingFailure('Permission denied. Check file permissions.');
        } else if (errorCode === 'ENOSPC') {
          console.error('No space left on device when writing to log file:', errorMessage);
          this.handleFileLoggingFailure('Disk full. Free up space or logging will be disabled.');
        } else if (errorCode === 'EROFS') {
          console.error('Read-only file system when writing to log file:', errorMessage);
          this.handleFileLoggingFailure('File system is read-only.');
        } else {
          console.error('Failed to write logs to file:', error);
          this.handleFileLoggingFailure('Unknown error writing logs.');
        }
      }
    }

    // Clear the buffer
    this.logBuffer = [];
  }

  /**
   * Handle persistent file logging failures
   */
  private fileLoggingFailureCount: number = 0;
  private readonly MAX_FILE_LOGGING_FAILURES = 3;

  private handleFileLoggingFailure(reason: string): void {
    this.fileLoggingFailureCount++;

    if (this.fileLoggingFailureCount >= this.MAX_FILE_LOGGING_FAILURES) {
      console.error(`File logging disabled after ${this.MAX_FILE_LOGGING_FAILURES} consecutive failures.`);
      this.fileLoggingEnabled = false;

      vscode.window.showErrorMessage(
        `Vespera Forge: File logging disabled due to persistent errors. ${reason}`,
        'Retry'
      ).then(selection => {
        if (selection === 'Retry') {
          this.retryFileLogging().then(success => {
            if (success) {
              vscode.window.showInformationMessage('File logging re-enabled successfully.');
              this.fileLoggingFailureCount = 0;
            } else {
              vscode.window.showErrorMessage('Failed to re-enable file logging.');
            }
          });
        }
      });
    }
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
   * Initialize configuration manager
   */
  private initializeConfigManager(): void {
    try {
      this.configManager = LoggingConfigurationManager.getInstance(this.context);
      // Don't await - let it initialize in background
      this.configManager.initialize().catch(error => {
        console.error('Failed to initialize logging configuration:', error);
      });
    } catch (error) {
      console.error('Failed to create logging configuration manager:', error);
    }
  }

  /**
   * Initialize log directory structure with fallback chain
   */
  private initializeLogDirectory(): void {
    // Use async initialization in background
    this.ensureLogDirectoryInitialized().catch(error => {
      console.error('Failed to initialize log directory:', error);
    });
  }

  /**
   * Ensure log directory is initialized with graceful fallback
   */
  private async ensureLogDirectoryInitialized(): Promise<void> {
    if (this.isLogDirectoryInitialized) {
      return;
    }

    // Try workspace-level logs first
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const directories: string[] = [];

    if (workspaceFolder) {
      directories.push(
        path.join(workspaceFolder.uri.fsPath, '.vespera', 'logs', 'frontend')
      );
    }

    // Fallback to user-level logs
    const homeDir = process.env['HOME'] || process.env['USERPROFILE'] || '';
    if (homeDir) {
      directories.push(
        path.join(homeDir, '.vespera', 'logs', 'frontend')
      );
    }

    // Last resort: temp directory
    const tmpDir = os.tmpdir();
    directories.push(
      path.join(tmpDir, 'vespera-forge-logs')
    );

    // Try each directory in order
    for (const dir of directories) {
      try {
        await fsPromises.mkdir(dir, { recursive: true });

        // Verify we can write to the directory
        const canWrite = await this.checkDirectoryPermissions(dir);
        if (!canWrite) {
          console.warn(`Cannot write to directory ${dir}, trying next location...`);
          continue;
        }

        this.logDirectory = dir;
        this.isLogDirectoryInitialized = true;

        // Initialize current log file
        this.rotateLogFileIfNeeded();
        return;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorCode = (error as NodeJS.ErrnoException).code;

        // Provide specific error messages for common failure modes
        if (errorCode === 'EACCES') {
          console.warn(`Permission denied for log directory ${dir}:`, errorMessage);
        } else if (errorCode === 'ENOSPC') {
          console.warn(`No space left on device for log directory ${dir}:`, errorMessage);
        } else {
          console.warn(`Failed to create log directory ${dir}:`, errorMessage);
        }
        continue; // Try next directory
      }
    }

    // If all fail, disable file logging
    console.error('Failed to create any log directory. File logging disabled.');
    vscode.window.showWarningMessage(
      'Vespera Forge: Unable to create log directory. Logging to console only.',
      'More Info'
    ).then(selection => {
      if (selection === 'More Info') {
        vscode.window.showInformationMessage(
          'Attempted locations:\n' + directories.join('\n')
        );
      }
    });

    this.fileLoggingEnabled = false;
    this.isLogDirectoryInitialized = true;
  }

  /**
   * Check if directory has write permissions
   */
  private async checkDirectoryPermissions(dirPath: string): Promise<boolean> {
    try {
      await fsPromises.access(dirPath, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Retry file logging after it has been disabled
   */
  public async retryFileLogging(): Promise<boolean> {
    this.fileLoggingEnabled = true;
    this.isLogDirectoryInitialized = false;
    try {
      await this.ensureLogDirectoryInitialized();
      return this.fileLoggingEnabled;
    } catch {
      return false;
    }
  }

  /**
   * Get the current log file path based on rotation strategy
   */
  private getLogFilePath(): string {
    const now = new Date();
    const config = this.configManager?.getConfiguration();
    const rotation = config?.outputs.file.rotation || LogRotationStrategy.DAILY;

    let dateStr: string;
    switch (rotation) {
      case LogRotationStrategy.HOURLY:
        dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}`;
        break;
      case LogRotationStrategy.DAILY:
      default:
        dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        break;
    }

    const componentSuffix = config?.outputs.file.separateByComponent && this.componentName !== 'global'
      ? `-${this.componentName}`
      : '';

    return path.join(this.logDirectory, `vespera-forge${componentSuffix}-${dateStr}.log`);
  }

  /**
   * Rotate log file if needed
   */
  private rotateLogFileIfNeeded(): void {
    if (!this.fileLoggingEnabled) {
      return;
    }

    const newLogFile = this.getLogFilePath();
    const config = this.configManager?.getConfiguration();

    // Check if rotation is needed
    if (this.currentLogFile !== newLogFile) {
      const oldFile = this.currentLogFile;
      this.currentLogFile = newLogFile;

      try {
        this.currentLogFileSize = fs.existsSync(newLogFile) ? fs.statSync(newLogFile).size : 0;

        // Emit rotation event if not first initialization
        if (oldFile) {
          VesperaEvents.logFileRotated('frontend', oldFile, newLogFile);
        }
      } catch (error) {
        const errorCode = (error as NodeJS.ErrnoException).code;
        if (errorCode === 'EACCES') {
          console.error('Permission denied when accessing log file:', error);
          this.handleFileLoggingFailure('Cannot access log file due to permissions.');
        } else {
          console.error('Failed to check log file:', error);
        }
      }
    }

    // Size-based rotation
    if (config?.outputs.file.rotation === LogRotationStrategy.SIZE_BASED) {
      const maxSize = config.outputs.file.maxSizeBytes || 10 * 1024 * 1024;
      if (this.currentLogFileSize >= maxSize) {
        // Rename current file with timestamp suffix
        const timestamp = Date.now();
        const archiveFile = this.currentLogFile.replace('.log', `.${timestamp}.log`);
        try {
          fs.renameSync(this.currentLogFile, archiveFile);
          this.currentLogFileSize = 0;
          VesperaEvents.logFileRotated('frontend', this.currentLogFile, archiveFile);
        } catch (error) {
          const errorCode = (error as NodeJS.ErrnoException).code;
          if (errorCode === 'EACCES') {
            console.error('Permission denied when rotating log file:', error);
            this.handleFileLoggingFailure('Cannot rotate log file due to permissions.');
          } else {
            console.error('Failed to rotate log file:', error);
            this.handleFileLoggingFailure('Failed to rotate log file.');
          }
        }
      }
    }

    // Clean up old log files
    this.cleanupOldLogFiles();
  }

  /**
   * Clean up old log files based on retention policy
   */
  private cleanupOldLogFiles(): void {
    try {
      const config = this.configManager?.getConfiguration();
      const maxFiles = config?.outputs.file.maxFiles || 30;

      if (!fs.existsSync(this.logDirectory)) {
        return;
      }

      // Get all log files sorted by modification time
      const files = fs.readdirSync(this.logDirectory)
        .filter(file => file.startsWith('vespera-forge') && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.logDirectory, file),
          mtime: fs.statSync(path.join(this.logDirectory, file)).mtime.getTime()
        }))
        .sort((a, b) => b.mtime - a.mtime); // Newest first

      // Delete files beyond retention limit
      if (files.length > maxFiles) {
        for (let i = maxFiles; i < files.length; i++) {
          const file = files[i];
          if (!file) continue;
          try {
            fs.unlinkSync(file.path);
          } catch (error) {
            console.error(`Failed to delete old log file ${file.name}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old log files:', error);
    }
  }

  /**
   * Get current logging statistics
   */
  public getLogStats(): {
    sessionId: string;
    level: LogLevel;
    bufferSize: number;
    configuration: LoggerConfiguration;
    fileLoggingEnabled: boolean;
    currentLogFile: string;
    logDirectory: string;
  } {
    return {
      sessionId: this.sessionId,
      level: this.config.level,
      bufferSize: this.logBuffer.length,
      configuration: this.config,
      fileLoggingEnabled: this.fileLoggingEnabled,
      currentLogFile: this.currentLogFile,
      logDirectory: this.logDirectory
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
  public createChild(componentName: string): VesperaLogger {
    // Create a shallow copy with modified component name
    const childLogger = Object.create(this);
    childLogger.componentName = componentName;
    return childLogger;
  }

  /**
   * Get memory statistics for buffer management
   */
  public getMemoryStats(): {
    bufferSize: number;
    bufferByteSize: number;
    overflowCount: number;
    maxBufferSize: number;
  } {
    const config = this.configManager?.getConfiguration();
    const maxBufferSize = config?.outputs.file.bufferConfig?.maxBufferSize || 1000;

    // Calculate approximate byte size of buffer
    const bufferByteSize = this.logBuffer.reduce((total, entry) => {
      const entrySize = JSON.stringify(entry).length;
      return total + entrySize;
    }, 0);

    return {
      bufferSize: this.logBuffer.length,
      bufferByteSize,
      overflowCount: this.bufferOverflowCount,
      maxBufferSize
    };
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