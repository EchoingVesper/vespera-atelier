/**
 * Base error class for Vespera-specific errors
 */
export class VesperaError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'VesperaError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when plugin operations fail
 */
export class PluginError extends VesperaError {
  constructor(
    message: string,
    public readonly pluginId: string,
    cause?: Error
  ) {
    super(message, 'PLUGIN_ERROR', cause);
    this.name = 'PluginError';
  }
}

/**
 * Error thrown when plugin is not found
 */
export class PluginNotFoundError extends PluginError {
  constructor(pluginId: string) {
    super(`Plugin '${pluginId}' not found`, pluginId);
    this.code = 'PLUGIN_NOT_FOUND';
    this.name = 'PluginNotFoundError';
  }
}

/**
 * Error thrown when plugin fails to load
 */
export class PluginLoadError extends PluginError {
  constructor(pluginId: string, cause?: Error) {
    super(`Failed to load plugin '${pluginId}'`, pluginId, cause);
    this.code = 'PLUGIN_LOAD_ERROR';
    this.name = 'PluginLoadError';
  }
}

/**
 * Error thrown when plugin has unmet dependencies
 */
export class PluginDependencyError extends PluginError {
  constructor(
    pluginId: string,
    public readonly missingDependencies: string[]
  ) {
    super(
      `Plugin '${pluginId}' has unmet dependencies: ${missingDependencies.join(', ')}`,
      pluginId
    );
    this.code = 'PLUGIN_DEPENDENCY_ERROR';
    this.name = 'PluginDependencyError';
  }
}

/**
 * Error thrown when circular dependency is detected
 */
export class CircularDependencyError extends VesperaError {
  constructor(public readonly cycle: string[]) {
    super(
      `Circular dependency detected: ${cycle.join(' -> ')}`,
      'CIRCULAR_DEPENDENCY'
    );
    this.name = 'CircularDependencyError';
  }
}