/**
 * Utility functions for Vespera Forge extension
 */

import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { VesperaForgeConfig } from '@/types';

/**
 * Get extension configuration
 */
export function getConfig(): VesperaForgeConfig {
  const config = vscode.workspace.getConfiguration('vesperaForge');
  return {
    enableAutoStart: config.get('enableAutoStart', true),
    rustBinderyPath: config.get('rustBinderyPath', '')
  };
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Show information message with error handling
 */
export async function showInfo(message: string): Promise<void> {
  await vscode.window.showInformationMessage(`Vespera Forge: ${message}`);
}

/**
 * Show error message with error handling
 */
export async function showError(message: string, error?: Error): Promise<void> {
  const fullMessage = error 
    ? `Vespera Forge Error: ${message} - ${error.message}`
    : `Vespera Forge Error: ${message}`;
  
  await vscode.window.showErrorMessage(fullMessage);
  
  if (error) {
    console.error('Vespera Forge Error:', error);
  }
}

/**
 * Show warning message
 */
export async function showWarning(message: string): Promise<void> {
  await vscode.window.showWarningMessage(`Vespera Forge: ${message}`);
}

/**
 * Validate file path
 */
export function isValidPath(path: string): boolean {
  if (!path || typeof path !== 'string') {
    return false;
  }
  
  // Basic path validation (can be enhanced)
  const invalidChars = /[<>:"|?*]/;
  return !invalidChars.test(path);
}

/**
 * Format date for display
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Debounce function for handling rapid events
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | undefined;
  
  return (...args: Parameters<T>) => {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Async sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Safe JSON parse with error handling
 */
export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    console.warn('Failed to parse JSON:', error);
    return defaultValue;
  }
}

/**
 * Get workspace root path
 */
export function getWorkspaceRoot(): string | undefined {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  return workspaceFolders && workspaceFolders.length > 0 
    ? workspaceFolders[0]?.uri.fsPath 
    : undefined;
}

/**
 * Check if extension is in development mode
 */
export function isDevelopment(): boolean {
  return process.env['NODE_ENV'] === 'development' || 
         vscode.env.appName.includes('Insiders');
}

/**
 * Log function with development/production awareness
 */
export function log(message: string, ...args: any[]): void {
  // Always log for debugging - will revert to isDevelopment() check later
  console.log(`[Vespera] ${message}`, ...args);
}