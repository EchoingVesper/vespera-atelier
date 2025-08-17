/**
 * Server configuration interface
 */
export interface ServerConfig {
  server: ServerSettings;
  plugins: PluginSettings;
  logging: LoggingSettings;
}

/**
 * Server-specific settings
 */
export interface ServerSettings {
  name: string;
  version: string;
  port: number;
  host?: string;
  transport: 'streamable-http' | 'stdio';
  sessionTimeout?: number;
}

/**
 * Plugin system settings
 */
export interface PluginSettings {
  enabled: string[];
  directory: string;
  autoload: boolean;
  watchForChanges?: boolean;
  configs?: Record<string, Record<string, unknown>>;
}

/**
 * Logging configuration
 */
export interface LoggingSettings {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'pretty';
  file?: string;
  maxFiles?: number;
  maxSize?: string;
}

/**
 * Plugin manifest file structure
 */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  main: string;
  author?: string;
  license?: string;
  repository?: string;
  dependencies?: string[];
  peerDependencies?: Record<string, string>;
  vesperaPlugin: {
    capabilities: string[];
    configSchema?: Record<string, unknown>;
  };
}