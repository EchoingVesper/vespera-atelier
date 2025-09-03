/**
 * Vespera Forge - Core Error Handling Infrastructure
 * 
 * Standardized error types, codes, and metadata for consistent error handling
 * across all components of the Vespera Forge VS Code extension.
 */

import * as vscode from 'vscode';

export enum VesperaErrorCode {
  // Configuration Errors (1000-1099)
  CONFIGURATION_LOAD_FAILED = 1000,
  CONFIGURATION_VALIDATION_FAILED = 1001,
  CONFIGURATION_SAVE_FAILED = 1002,
  CREDENTIAL_STORAGE_FAILED = 1003,

  // Provider Errors (1100-1199)
  PROVIDER_INITIALIZATION_FAILED = 1100,
  PROVIDER_CONNECTION_FAILED = 1101,
  PROVIDER_AUTHENTICATION_FAILED = 1102,
  PROVIDER_REQUEST_FAILED = 1103,

  // View Errors (1200-1299)
  WEBVIEW_CREATION_FAILED = 1200,
  WEBVIEW_MESSAGE_FAILED = 1201,
  VIEW_CONTEXT_INVALID = 1202,

  // Memory Management Errors (1300-1399)
  RESOURCE_DISPOSAL_FAILED = 1300,
  MEMORY_LEAK_DETECTED = 1301,
  CONTEXT_CLEANUP_FAILED = 1302,

  // External Service Errors (1400-1499)
  BINDERY_CONNECTION_FAILED = 1400,
  MCP_SERVER_ERROR = 1401,
  EXTERNAL_API_ERROR = 1402,

  // Unknown/Generic Errors (9000-9999)
  UNKNOWN_ERROR = 9000
}

export enum VesperaSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum VesperaErrorCategory {
  CONFIGURATION = 'configuration',
  PROVIDER = 'provider',
  VIEW = 'view',
  MEMORY = 'memory',
  EXTERNAL = 'external',
  UNKNOWN = 'unknown'
}

export interface VesperaErrorMetadata {
  timestamp: number;
  source: string;
  context?: Record<string, any>;
  stackTrace?: string;
  userId?: string;
  sessionId?: string;
  extension?: {
    version: string;
    vsCodeVersion: string;
    platform: string;
  };
}

/**
 * Base VesperaError class with comprehensive metadata and categorization
 */
export class VesperaError extends Error {
  public readonly code: VesperaErrorCode;
  public readonly severity: VesperaSeverity;
  public readonly category: VesperaErrorCategory;
  public readonly metadata: VesperaErrorMetadata;
  public readonly isRetryable: boolean;

  constructor(
    message: string,
    code: VesperaErrorCode,
    severity: VesperaSeverity = VesperaSeverity.MEDIUM,
    metadata: Partial<VesperaErrorMetadata> = {},
    isRetryable: boolean = false,
    cause?: Error
  ) {
    super(message);
    this.name = 'VesperaError';
    this.code = code;
    this.severity = severity;
    this.category = this.getCategoryFromCode(code);
    this.isRetryable = isRetryable;
    this.cause = cause;

    this.metadata = {
      timestamp: Date.now(),
      source: this.getSourceFromStack(),
      stackTrace: this.stack,
      extension: {
        version: vscode.extensions.getExtension('vespera-atelier.vespera-forge')?.packageJSON.version || 'unknown',
        vsCodeVersion: vscode.version,
        platform: process.platform
      },
      ...metadata
    };
  }

  private getCategoryFromCode(code: VesperaErrorCode): VesperaErrorCategory {
    if (code >= 1000 && code < 1100) return VesperaErrorCategory.CONFIGURATION;
    if (code >= 1100 && code < 1200) return VesperaErrorCategory.PROVIDER;
    if (code >= 1200 && code < 1300) return VesperaErrorCategory.VIEW;
    if (code >= 1300 && code < 1400) return VesperaErrorCategory.MEMORY;
    if (code >= 1400 && code < 1500) return VesperaErrorCategory.EXTERNAL;
    return VesperaErrorCategory.UNKNOWN;
  }

  private getSourceFromStack(): string {
    const stack = new Error().stack;
    const stackLines = stack?.split('\n') || [];
    const relevantLine = stackLines.find(line => 
      line.includes('.ts:') && !line.includes('VesperaError')
    );
    return relevantLine?.trim().replace(/^\s*at\s+/, '') || 'unknown';
  }

  public toJSON(): object {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      category: this.category,
      metadata: this.metadata,
      isRetryable: this.isRetryable,
      cause: this.cause ? {
        name: this.cause.name,
        message: this.cause.message,
        stack: this.cause.stack
      } : undefined
    };
  }
}

/**
 * Configuration-specific error class
 */
export class VesperaConfigurationError extends VesperaError {
  constructor(message: string, code: VesperaErrorCode, metadata?: Partial<VesperaErrorMetadata>, cause?: Error) {
    super(message, code, VesperaSeverity.MEDIUM, metadata, false, cause);
  }
}

/**
 * Provider-specific error class with retry capabilities
 */
export class VesperaProviderError extends VesperaError {
  constructor(message: string, code: VesperaErrorCode, metadata?: Partial<VesperaErrorMetadata>, isRetryable: boolean = true, cause?: Error) {
    super(message, code, VesperaSeverity.MEDIUM, metadata, isRetryable, cause);
  }
}

/**
 * Memory management error class - always high severity
 */
export class VesperaMemoryError extends VesperaError {
  constructor(message: string, code: VesperaErrorCode, metadata?: Partial<VesperaErrorMetadata>, cause?: Error) {
    super(message, code, VesperaSeverity.HIGH, metadata, false, cause);
  }
}

/**
 * View/WebView error class
 */
export class VesperaViewError extends VesperaError {
  constructor(message: string, code: VesperaErrorCode, metadata?: Partial<VesperaErrorMetadata>, isRetryable: boolean = false, cause?: Error) {
    super(message, code, VesperaSeverity.MEDIUM, metadata, isRetryable, cause);
  }
}

/**
 * External service error class with retry capabilities
 */
export class VesperaExternalError extends VesperaError {
  constructor(message: string, code: VesperaErrorCode, metadata?: Partial<VesperaErrorMetadata>, isRetryable: boolean = true, cause?: Error) {
    super(message, code, VesperaSeverity.MEDIUM, metadata, isRetryable, cause);
  }
}