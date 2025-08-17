// src/error-handling/ErrorDetector.ts

import { VesperaError, ErrorType, ErrorSeverity } from '../utils/ErrorHandler';

/**
 * @interface ErrorSource
 * Represents a source from which an error might originate, along with context.
 */
export interface ErrorSource {
  operation: string; // e.g., 'LLMClient.generateCompletion', 'FileSystem.readFile'
  component: string; // e.g., 'ProcessingNode', 'WorkflowOrchestrator'
  details?: unknown;  // Any additional context specific to the error source
}

/**
 * @class ErrorDetector
 * Responsible for identifying and capturing errors from various parts of the application
 * and transforming them into a standardized VesperaError format.
 */
export class ErrorDetector {
  /**
   * Detects and standardizes an error from a given source.
   *
   * @param error The raw error object or string.
   * @param source Information about where the error originated.
   * @param defaultType The default ErrorType to assign if not determinable from the error itself.
   * @param defaultSeverity The default ErrorSeverity to assign.
   * @returns A VesperaError object representing the standardized error.
   */
  public detect(error: unknown, source: ErrorSource, defaultType: ErrorType = ErrorType.UNKNOWN, defaultSeverity: ErrorSeverity = ErrorSeverity.ERROR): VesperaError {
    if (error instanceof VesperaError) {
      // If it's already a VesperaError, ensure source details are added or updated if necessary
      error.details = { ...(error.details || {}), detectedIn: source };
      return error;
    }

    let message = 'An unknown error occurred.';
    let type = defaultType;
    let severity = defaultSeverity;
    let originalError: unknown = error;

    if (error instanceof Error) {
      message = error.message;
      // Basic type inference (can be expanded)
      if (error.name === 'TimeoutError') {
        type = ErrorType.LLM; // Using LLM instead of TIMEOUT
      } else if (error.name === 'NetworkError') {
        type = ErrorType.LLM; // Using LLM instead of NETWORK
      }
      // Potentially infer severity based on error name or type
    } else if (typeof error === 'string') {
      message = error;
    }

    return new VesperaError(message, type, severity, {
      originalError,
      source,
    });
  }

  /**
   * A utility function to wrap a potentially error-throwing function call
   * with error detection.
   *
   * @template T The expected return type of the function.
   * @param fn The function to execute.
   * @param source Information about the operation being performed.
   * @param defaultType The default ErrorType for errors from this function.
   * @param defaultSeverity The default ErrorSeverity for errors from this function.
   * @returns The result of the function if successful.
   * @throws VesperaError if the function throws an error.
   */
  public async tryDetect<T>(
    fn: () => Promise<T> | T,
    source: ErrorSource,
    defaultType: ErrorType = ErrorType.UNKNOWN, // Using UNKNOWN instead of COMPONENT_ERROR
    defaultSeverity: ErrorSeverity = ErrorSeverity.ERROR
  ): Promise<T> {
    try {
      const result = fn();
      return result instanceof Promise ? await result : result;
    } catch (err) {
      throw this.detect(err, source, defaultType, defaultSeverity);
    }
  }
}

// Example Usage (conceptual - to be integrated into actual components):
/*
async function someProcessingTask(detector: ErrorDetector) {
  const source: ErrorSource = { component: 'MyComponent', operation: 'doSomethingCritical' };
  try {
    // const result = await someApiCall();
    // return result;
    throw new Error('Something went wrong during API call!');
  } catch (error) {
    const vesperaError = detector.detect(error, source, ErrorType.API_ERROR);
    console.error('Detected error:', vesperaError.toString());
    // Pass to ErrorReporter / ErrorHandler
    throw vesperaError; // Re-throw standardized error
  }
}

async function anotherTask(detector: ErrorDetector) {
  const source: ErrorSource = { component: 'AnotherComponent', operation: 'performOperation' };
  return detector.tryDetect(async () => {
    // Potentially error-throwing code
    if (Math.random() < 0.5) {
      throw new Error('Random failure in anotherTask');
    }
    return 'Success!';
  }, source);
}*/