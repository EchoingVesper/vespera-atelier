// src/error-handling/ErrorReporter.ts

import { Notice, WorkspaceLeaf, ItemView, setIcon } from 'obsidian';
import { ErrorSeverity, ErrorType, VesperaError } from './types';

/**
 * @interface ErrorReportingChannel
 * Represents a channel through which errors can be reported.
 */
export interface ErrorReportingChannel {
  /**
   * Report an error through this channel.
   * 
   * @param error The error to report.
   * @param options Optional configuration for how the error should be reported.
   */
  report(error: VesperaError, options?: Record<string, any>): void;

  /**
   * Enable or disable this reporting channel.
   * 
   * @param enabled Whether the channel should be enabled.
   */
  setEnabled(enabled: boolean): void;

  /**
   * Check if this reporting channel is enabled.
   * 
   * @returns Whether the channel is enabled.
   */
  isEnabled(): boolean;
}

/**
 * @class ConsoleReportingChannel
 * Reports errors to the browser console.
 */
export class ConsoleReportingChannel implements ErrorReportingChannel {
  private enabled: boolean = true;

  /**
   * Report an error to the console.
   * 
   * @param error The error to report.
   */
  public report(error: VesperaError): void {
    if (!this.enabled) return;

    const formattedMessage = this.formatErrorForConsole(error);
    
    switch (error.severity) {
      case ErrorSeverity.INFO:
        console.info(formattedMessage, error);
        break;
      case ErrorSeverity.WARNING:
        console.warn(formattedMessage, error);
        break;
      case ErrorSeverity.ERROR:
        console.error(formattedMessage, error);
        break;
      case ErrorSeverity.CRITICAL:
        console.error(`%c${formattedMessage}`, 'color: red; font-weight: bold', error);
        break;
    }
  }

  /**
   * Format an error for console output.
   * 
   * @param error The error to format.
   * @returns A formatted error message.
   */
  private formatErrorForConsole(error: VesperaError): string {
    return `[${error.severity.toUpperCase()}][${error.type}] ${error.message}`;
  }

  /**
   * Enable or disable console reporting.
   * 
   * @param enabled Whether console reporting should be enabled.
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if console reporting is enabled.
   * 
   * @returns Whether console reporting is enabled.
   */
  public isEnabled(): boolean {
    return this.enabled;
  }
}

/**
 * @class NoticeReportingChannel
 * Reports errors as Obsidian notices.
 */
export class NoticeReportingChannel implements ErrorReportingChannel {
  private enabled: boolean = true;
  private durationByType: Record<ErrorSeverity, number> = {
    [ErrorSeverity.INFO]: 3000,      // 3 seconds
    [ErrorSeverity.WARNING]: 5000,   // 5 seconds
    [ErrorSeverity.ERROR]: 8000,     // 8 seconds
    [ErrorSeverity.CRITICAL]: 10000, // 10 seconds
  };

  /**
   * Report an error as an Obsidian notice.
   * 
   * @param error The error to report.
   * @param options Optional configuration for the notice.
   */
  public report(error: VesperaError, options?: { duration?: number }): void {
    if (!this.enabled) return;

    const message = this.formatErrorForNotice(error);
    const duration = options?.duration ?? this.durationByType[error.severity];
    
    new Notice(message, duration);
  }

  /**
   * Format an error for notice display.
   * 
   * @param error The error to format.
   * @returns A formatted error message.
   */
  private formatErrorForNotice(error: VesperaError): string {
    let message = `[${error.severity.toUpperCase()}] ${error.message}`;
    
    // Add type for non-unknown errors
    if (error.type !== ErrorType.UNKNOWN) {
      message = `${message} (${error.type})`;
    }

    // Add source information if available
    if (error.details?.source) {
      const source = error.details.source;
      message = `${message}\nSource: ${source.component}.${source.operation}`;
    }
    
    return message;
  }

  /**
   * Enable or disable notice reporting.
   * 
   * @param enabled Whether notice reporting should be enabled.
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if notice reporting is enabled.
   * 
   * @returns Whether notice reporting is enabled.
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Set the duration for notices by severity.
   * 
   * @param severity The severity level.
   * @param duration The duration in milliseconds.
   */
  public setDuration(severity: ErrorSeverity, duration: number): void {
    this.durationByType[severity] = duration;
  }
}

/**
 * @class ErrorReporter
 * Centralized component for reporting errors through various channels.
 */
export class ErrorReporter {
  private static instance: ErrorReporter;
  private channels: Map<string, ErrorReportingChannel> = new Map();
  
  /**
   * Private constructor to enforce singleton pattern.
   */
  private constructor() {
    // Register default reporting channels
    this.registerChannel('console', new ConsoleReportingChannel());
    this.registerChannel('notice', new NoticeReportingChannel());
  }
  
  /**
   * Get the ErrorReporter instance.
   */
  public static getInstance(): ErrorReporter {
    if (!ErrorReporter.instance) {
      ErrorReporter.instance = new ErrorReporter();
    }
    return ErrorReporter.instance;
  }
  
  /**
   * Report an error through all enabled channels.
   * 
   * @param error The error to report.
   * @param channelOptions Optional configuration for specific channels.
   */
  public reportError(error: VesperaError, channelOptions?: Record<string, any>): void {
    this.channels.forEach((channel, channelName) => {
      try {
        channel.report(error, channelOptions?.[channelName]);
      } catch (err) {
        console.error(`Failed to report error through ${channelName} channel:`, err);
      }
    });
  }
  
  /**
   * Register a new reporting channel.
   * 
   * @param name The name of the channel.
   * @param channel The channel implementation.
   */
  public registerChannel(name: string, channel: ErrorReportingChannel): void {
    this.channels.set(name, channel);
  }
  
  /**
   * Get a reporting channel by name.
   * 
   * @param name The name of the channel.
   * @returns The channel, or undefined if not found.
   */
  public getChannel(name: string): ErrorReportingChannel | undefined {
    return this.channels.get(name);
  }
  
  /**
   * Enable or disable a reporting channel.
   * 
   * @param name The name of the channel.
   * @param enabled Whether the channel should be enabled.
   */
  public setChannelEnabled(name: string, enabled: boolean): void {
    const channel = this.channels.get(name);
    if (channel) {
      channel.setEnabled(enabled);
    }
  }
  
  /**
   * Check if a reporting channel is enabled.
   * 
   * @param name The name of the channel.
   * @returns Whether the channel is enabled, or false if the channel doesn't exist.
   */
  public isChannelEnabled(name: string): boolean {
    const channel = this.channels.get(name);
    return channel ? channel.isEnabled() : false;
  }
  
  /**
   * Get all registered channel names.
   * 
   * @returns An array of channel names.
   */
  public getChannelNames(): string[] {
    return Array.from(this.channels.keys());
  }
}

// Export a singleton instance for easy access
export const errorReporter = ErrorReporter.getInstance();