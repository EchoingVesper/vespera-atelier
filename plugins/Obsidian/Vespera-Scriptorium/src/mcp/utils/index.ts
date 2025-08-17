/**
 * MCP Utility Functions
 * 
 * Collection of helper functions for MCP operations.
 */

/**
 * Normalize a file path to ensure consistent formatting
 * @param path Path to normalize
 * @returns Normalized path
 */
export function normalizePath(path: string): string {
  // Remove leading/trailing slashes and normalize path separators
  return path
    .replace(/^[\/\\]+/, '') // Remove leading slashes
    .replace(/[\/\\]+$/, '')  // Remove trailing slashes
    .replace(/[\\\/]+/g, '/'); // Normalize path separators to forward slashes
}

/**
 * Check if a path is within the vault directory
 * @param vaultPath Path to the vault root
 * @param targetPath Path to check
 * @returns True if the path is within the vault
 */
export function isPathInVault(vaultPath: string, targetPath: string): boolean {
  const normalizedVault = normalizePath(vaultPath).toLowerCase();
  const normalizedTarget = normalizePath(targetPath).toLowerCase();
  
  return normalizedTarget.startsWith(normalizedVault);
}

/**
 * Generate a unique request ID for tracking
 */
export function generateRequestId(prefix: string = 'req'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a delay promise
 * @param ms Delay in milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * @param fn Function to retry
 * @param maxRetries Maximum number of retry attempts
 * @param initialDelay Initial delay in milliseconds
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 100
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delayTime = initialDelay * Math.pow(2, attempt);
        await delay(delayTime);
      }
    }
  }
  
  throw lastError || new Error('Unknown error in withRetry');
}

/**
 * Deep merge two objects
 */
export function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(
        target[key] as object,
        source[key] as object
      ) as T[Extract<keyof T, string>];
    } else {
      result[key] = source[key] as T[Extract<keyof T, string>];
    }
  }
  
  return result;
}

/**
 * Validate a file path
 * @param path Path to validate
 * @returns Error message if invalid, undefined if valid
 */
export function validateFilePath(path: string): string | undefined {
  if (!path) {
    return 'Path is required';
  }
  
  // Check for invalid characters
  const invalidChars = /[<>:"|?*\x00-\x1F]/g;
  if (invalidChars.test(path)) {
    return 'Path contains invalid characters';
  }
  
  // Check for reserved names (Windows)
  const reservedNames = [
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
  ];
  
  const fileName = path.split(/[\\/]/).pop()?.split('.')[0].toUpperCase();
  if (fileName && reservedNames.includes(fileName)) {
    return 'Path contains a reserved name';
  }
  
  return undefined;
}
