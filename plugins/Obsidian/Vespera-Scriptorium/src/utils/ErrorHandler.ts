import { Notice } from 'obsidian';
import { ErrorReporter } from '../error-handling/ErrorReporter';
import { ErrorType, ErrorSeverity, VesperaError } from '../error-handling/types';

// Re-export types for backward compatibility
export { ErrorType, ErrorSeverity, VesperaError } from '../error-handling/types';

/**
 * ErrorHandler provides centralized error handling for the plugin
 * 
 * Note: Error reporting functionality has been moved to the ErrorReporter class.
 * This class maintains backward compatibility while delegating reporting to ErrorReporter.
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errors: VesperaError[] = [];
  private maxErrors: number = 100;
  private showNotices: boolean = true;
  private errorReporter: ErrorReporter;
  
  /**
   * Get the ErrorHandler instance
   */
  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }
  
  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.errorReporter = ErrorReporter.getInstance();
  }
  
  /**
   * Handle an error
   * 
   * @param error Error to handle
   * @param showNotice Whether to show a notice for the error
   * @returns The handled error
   */
  public handleError(error: Error | string, showNotice: boolean = true): VesperaError {
    // Convert string to error
    if (typeof error === 'string') {
      error = new Error(error);
    }
    
    // Convert to VesperaError if needed
    const vesperaError = error instanceof VesperaError
      ? error
      : new VesperaError(error.message);
    
    // Add to error history
    this.addToErrorHistory(vesperaError);
    
    // Report the error through the ErrorReporter
    // For backward compatibility, we'll only use notice channel if showNotice is true
    const channelOptions = {
      notice: { enabled: showNotice && this.showNotices }
    };
    
    this.errorReporter.reportError(vesperaError, channelOptions);
    
    return vesperaError;
  }
  
  /**
   * Create and handle a new error
   * 
   * @param message Error message
   * @param type Error type
   * @param severity Error severity
   * @param details Additional error details
   * @param showNotice Whether to show a notice for the error
   * @returns The created and handled error
   */
  public createError(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    details?: Record<string, any>,
    showNotice: boolean = true
  ): VesperaError {
    const error = new VesperaError(message, type, severity, details);
    return this.handleError(error, showNotice);
  }
  
  /**
   * Add an error to the error history
   * 
   * @param error Error to add
   */
  private addToErrorHistory(error: VesperaError): void {
    this.errors.push(error);
    
    // Trim error history if needed
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }
  }
  
  /**
   * Show a notice for an error
   * 
   * @param error Error to show a notice for
   * @deprecated Use ErrorReporter.reportError() instead
   */
  private showErrorNotice(error: VesperaError): void {
    // This method is kept for backward compatibility
    // Delegate to the ErrorReporter
    this.errorReporter.getChannel('notice')?.report(error);
  }
  
  /**
   * Get the error history
   * 
   * @returns Array of errors
   */
  public getErrorHistory(): VesperaError[] {
    return [...this.errors];
  }
  
  /**
   * Clear the error history
   */
  public clearErrorHistory(): void {
    this.errors = [];
  }
  
  /**
   * Set whether to show notices for errors
   * 
   * @param show Whether to show notices
   */
  public setShowNotices(show: boolean): void {
    this.showNotices = show;
    // Also update the notice channel in ErrorReporter
    this.errorReporter.setChannelEnabled('notice', show);
  }
  
  /**
   * Set the maximum number of errors to keep in history
   * 
   * @param max Maximum number of errors
   */
  public setMaxErrors(max: number): void {
    this.maxErrors = max;
    
    // Trim error history if needed
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }
  }
}