/**
 * Logging Configuration System
 *
 * Defines the structure for .vespera/config/logging-config.json5
 * and provides type-safe configuration management.
 */

/**
 * Log level enumeration
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

/**
 * Log rotation strategy
 */
export enum LogRotationStrategy {
  NONE = 'none',
  DAILY = 'daily',
  HOURLY = 'hourly',
  SIZE_BASED = 'size-based'
}

/**
 * Per-component log level configuration
 */
export interface ComponentLogLevels {
  global: LogLevel;
  components: {
    [componentName: string]: LogLevel;
  };
}

/**
 * Console output configuration
 */
export interface ConsoleOutputConfig {
  enabled: boolean;
  userFacingOnly: boolean; // Only show user-facing messages in console
  colorize?: boolean;
  timestamp?: boolean;
}

/**
 * Buffer configuration for log flushing
 */
export interface BufferConfig {
  maxBufferSize?: number; // Maximum buffer size before forcing flush (default: 1000)
  flushIntervalMs?: number; // Interval to flush logs (default: 10000ms)
  flushThreshold?: number; // Size threshold to trigger flush (default: 100)
  overflowStrategy?: 'drop-oldest' | 'drop-newest' | 'force-flush'; // Strategy when buffer is full (default: 'drop-oldest')
}

/**
 * File output configuration
 */
export interface FileOutputConfig {
  enabled: boolean;
  rotation: LogRotationStrategy;
  maxFiles: number; // Maximum number of rotated files to keep
  maxSizeBytes?: number; // For size-based rotation
  directory?: string; // Custom log directory (defaults to .vespera/logs)
  separateByComponent?: boolean; // Create separate files per component
  bufferConfig?: BufferConfig; // Buffer management configuration
}

/**
 * Event bus output configuration
 */
export interface EventBusOutputConfig {
  enabled: boolean;
  logToEventBus: boolean;
  minLevel?: LogLevel; // Minimum level to emit as events
}

/**
 * Development mode configuration
 */
export interface DevelopmentModeConfig {
  autoEnable: boolean; // Auto-detect development mode
  verboseLogging: boolean; // Enable verbose logging in dev mode
  showSourceLocation: boolean; // Show file:line in logs
  enablePerformanceLogging?: boolean;
}

/**
 * Production mode configuration
 */
export interface ProductionModeConfig {
  suppressNotifications: boolean; // Suppress toast notifications
  enableTelemetry?: boolean;
  samplingRate?: number; // Log sampling rate (0-1)
}

/**
 * Main logging configuration structure
 */
export interface LoggingConfiguration {
  version: string; // Configuration schema version
  levels: ComponentLogLevels;
  outputs: {
    console: ConsoleOutputConfig;
    file: FileOutputConfig;
    events: EventBusOutputConfig;
  };
  development: DevelopmentModeConfig;
  production: ProductionModeConfig;
  filters?: {
    excludePatterns?: string[]; // Regex patterns to exclude from logs
    includePatterns?: string[]; // Only log matching patterns
  };
}

/**
 * Default logging configuration
 */
export const DEFAULT_LOGGING_CONFIG: LoggingConfiguration = {
  version: '1.0.0',
  levels: {
    global: LogLevel.INFO,
    components: {
      bindery: LogLevel.DEBUG,
      security: LogLevel.WARN,
      aiAssistant: LogLevel.INFO,
      events: LogLevel.DEBUG,
      navigator: LogLevel.INFO,
      editor: LogLevel.INFO,
      templates: LogLevel.INFO
    }
  },
  outputs: {
    console: {
      enabled: true,
      userFacingOnly: true,
      colorize: true,
      timestamp: false
    },
    file: {
      enabled: true,
      rotation: LogRotationStrategy.DAILY,
      maxFiles: 30,
      maxSizeBytes: 10 * 1024 * 1024, // 10MB per file
      separateByComponent: true,
      bufferConfig: {
        maxBufferSize: 1000,
        flushIntervalMs: 10000,
        flushThreshold: 100,
        overflowStrategy: 'drop-oldest'
      }
    },
    events: {
      enabled: true,
      logToEventBus: true,
      minLevel: LogLevel.WARN
    }
  },
  development: {
    autoEnable: true,
    verboseLogging: true,
    showSourceLocation: true,
    enablePerformanceLogging: true
  },
  production: {
    suppressNotifications: true,
    enableTelemetry: false,
    samplingRate: 0.1 // Log 10% of debug messages
  },
  filters: {
    excludePatterns: [],
    includePatterns: []
  }
};

/**
 * Validate logging configuration
 */
export function validateLoggingConfiguration(config: any): LoggingConfiguration {
  // Type guard and validation
  if (!config || typeof config !== 'object') {
    throw new Error('Invalid logging configuration: must be an object');
  }

  if (!config.version || typeof config.version !== 'string') {
    throw new Error('Invalid logging configuration: missing or invalid version');
  }

  if (!config.levels || !config.levels.global) {
    throw new Error('Invalid logging configuration: missing global log level');
  }

  if (!config.outputs || !config.outputs.console || !config.outputs.file) {
    throw new Error('Invalid logging configuration: missing output configuration');
  }

  // Validate log levels
  const validLevels = Object.values(LogLevel);
  if (!validLevels.includes(config.levels.global)) {
    throw new Error(`Invalid global log level: ${config.levels.global}`);
  }

  if (config.levels.components) {
    for (const [component, level] of Object.entries(config.levels.components)) {
      if (!validLevels.includes(level as LogLevel)) {
        throw new Error(`Invalid log level for component ${component}: ${level}`);
      }
    }
  }

  // Return validated config (with defaults for missing optional fields)
  return {
    ...DEFAULT_LOGGING_CONFIG,
    ...config,
    levels: {
      ...DEFAULT_LOGGING_CONFIG.levels,
      ...config.levels,
      components: {
        ...DEFAULT_LOGGING_CONFIG.levels.components,
        ...(config.levels?.components || {})
      }
    },
    outputs: {
      console: { ...DEFAULT_LOGGING_CONFIG.outputs.console, ...(config.outputs?.console || {}) },
      file: { ...DEFAULT_LOGGING_CONFIG.outputs.file, ...(config.outputs?.file || {}) },
      events: { ...DEFAULT_LOGGING_CONFIG.outputs.events, ...(config.outputs?.events || {}) }
    },
    development: { ...DEFAULT_LOGGING_CONFIG.development, ...(config.development || {}) },
    production: { ...DEFAULT_LOGGING_CONFIG.production, ...(config.production || {}) }
  };
}

/**
 * Serialize logging configuration to JSON5 format
 */
export function serializeLoggingConfiguration(config: LoggingConfiguration): string {
  return `{
  // Logging Configuration v${config.version}
  // This file controls logging behavior for Vespera Forge

  version: "${config.version}",

  // Log levels per component
  levels: {
    global: "${config.levels.global}",
    components: ${JSON.stringify(config.levels.components, null, 6).replace(/"/g, "'")}
  },

  // Output destinations
  outputs: {
    console: ${JSON.stringify(config.outputs.console, null, 6)},
    file: ${JSON.stringify(config.outputs.file, null, 6)},
    events: ${JSON.stringify(config.outputs.events, null, 6)}
  },

  // Development mode settings
  development: ${JSON.stringify(config.development, null, 4)},

  // Production mode settings
  production: ${JSON.stringify(config.production, null, 4)},

  // Optional filters
  filters: ${JSON.stringify(config.filters, null, 4)}
}`;
}
