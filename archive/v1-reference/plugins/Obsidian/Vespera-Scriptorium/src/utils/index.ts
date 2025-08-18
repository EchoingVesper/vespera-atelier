/**
 * Utility module exports
 */

export { ErrorHandler, VesperaError, ErrorType, ErrorSeverity } from './ErrorHandler';
export { Logger, LogLevel, getLogger } from './Logger';

/**
 * Format a date as a string
 * 
 * @param date Date to format
 * @param includeTime Whether to include the time
 * @returns Formatted date string
 */
export function formatDate(date: Date, includeTime: boolean = false): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  let result = `${year}-${month}-${day}`;
  
  if (includeTime) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    result += ` ${hours}:${minutes}:${seconds}`;
  }
  
  return result;
}

/**
 * Generate a unique ID
 * 
 * @param prefix Prefix for the ID
 * @returns Unique ID
 */
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  
  return `${prefix}${timestamp}-${random}`;
}

/**
 * Truncate a string to a maximum length
 * 
 * @param str String to truncate
 * @param maxLength Maximum length
 * @param suffix Suffix to add if truncated
 * @returns Truncated string
 */
export function truncateString(str: string, maxLength: number, suffix: string = '...'): string {
  if (str.length <= maxLength) {
    return str;
  }
  
  return str.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Estimate the number of tokens in a string
 * 
 * @param str String to estimate tokens for
 * @returns Estimated number of tokens
 */
export function estimateTokens(str: string): number {
  // A rough estimation: 4 characters per token is a common approximation
  return Math.ceil(str.length / 4);
}

/**
 * Debounce a function
 * 
 * @param func Function to debounce
 * @param wait Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function(...args: Parameters<T>): void {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(later, wait);
  };
}