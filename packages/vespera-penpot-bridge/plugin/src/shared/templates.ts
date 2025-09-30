/**
 * Template definitions for UI components
 */

/**
 * Configuration for error dialog template
 */
export interface ErrorDialogConfig {
  title: string;
  message: string;
  severity: 'error' | 'warning' | 'info' | 'success';
  dismissible: boolean;
}

/**
 * Severity-based color mappings
 */
export const SEVERITY_COLORS = {
  error: {
    background: '#FEE2E2',
    border: '#EF4444',
    icon: '#DC2626',
    text: '#991B1B',
  },
  warning: {
    background: '#FEF3C7',
    border: '#F59E0B',
    icon: '#D97706',
    text: '#92400E',
  },
  info: {
    background: '#DBEAFE',
    border: '#3B82F6',
    icon: '#2563EB',
    text: '#1E40AF',
  },
  success: {
    background: '#D1FAE5',
    border: '#10B981',
    icon: '#059669',
    text: '#065F46',
  },
} as const;

/**
 * Error dialog template dimensions
 */
export const ERROR_DIALOG_DIMENSIONS = {
  width: 400,
  height: 250,
  padding: 20,
  borderRadius: 8,
  borderWidth: 2,
} as const;

/**
 * Error dialog component structure
 */
export interface ErrorDialogTemplate {
  id: 'error-dialog-v1';
  name: 'Error Dialog';
  category: 'dialog';
  dimensions: typeof ERROR_DIALOG_DIMENSIONS;
  colors: typeof SEVERITY_COLORS;
}

/**
 * The error dialog template definition
 */
export const ERROR_DIALOG_TEMPLATE: ErrorDialogTemplate = {
  id: 'error-dialog-v1',
  name: 'Error Dialog',
  category: 'dialog',
  dimensions: ERROR_DIALOG_DIMENSIONS,
  colors: SEVERITY_COLORS,
};