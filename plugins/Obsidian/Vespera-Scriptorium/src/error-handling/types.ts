// src/error-handling/types.ts

/**
 * Error types for the plugin
 */
export enum ErrorType {
  INITIALIZATION = 'initialization',
  PARSING = 'parsing',
  PROCESSING = 'processing',
  LLM = 'llm',
  FILE_SYSTEM = 'file_system',
  UI = 'ui',
  SETTINGS = 'settings',
  UNKNOWN = 'unknown'
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Custom error class for the plugin
 */
export class VesperaError extends Error {
  type: ErrorType;
  severity: ErrorSeverity;
  details?: Record<string, any>;
  timestamp: Date;

  /**
   * Create a new VesperaError
   *
   * @param message Error message
   * @param type Error type
   * @param severity Error severity
   * @param details Additional error details
   */
  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'VesperaError';
    this.type = type;
    this.severity = severity;
    this.details = details;
    this.timestamp = new Date();
    // Ensure the prototype chain is correctly set up for custom errors
    Object.setPrototypeOf(this, VesperaError.prototype);
  }
}