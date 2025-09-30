/**
 * Message protocol for communication between plugin backend and React UI
 */

/**
 * Message types for plugin-to-UI communication
 */
export type PluginToUIMessage =
  | ThemeChangeMessage
  | OperationResultMessage
  | ErrorMessage
  | StatusMessage;

/**
 * Message types for UI-to-plugin communication
 */
export type UIToPluginMessage =
  | CreateErrorDialogMessage
  | CreateComponentMessage
  | PreviewComponentMessage;

/**
 * Theme change notification from plugin
 */
export interface ThemeChangeMessage {
  type: 'theme-change';
  theme: 'light' | 'dark';
}

/**
 * Result of an operation performed by the plugin
 */
export interface OperationResultMessage {
  type: 'operation-result';
  success: boolean;
  operation: string;
  message?: string;
  componentId?: string;
}

/**
 * Error notification from plugin
 */
export interface ErrorMessage {
  type: 'error';
  error: string;
  operation?: string;
  details?: Record<string, unknown>;
}

/**
 * Status update from plugin (for progress indication)
 */
export interface StatusMessage {
  type: 'status';
  status: 'idle' | 'working' | 'success' | 'error';
  message?: string;
}

/**
 * Request to create an error dialog
 */
export interface CreateErrorDialogMessage {
  type: 'create-error-dialog';
  config: {
    title: string;
    message: string;
    severity: 'error' | 'warning' | 'info' | 'success';
    dismissible?: boolean;
  };
}

/**
 * Request to create a generic component
 */
export interface CreateComponentMessage {
  type: 'create-component';
  templateId: string;
  config: Record<string, unknown>;
}

/**
 * Request to preview a component (Phase 2)
 */
export interface PreviewComponentMessage {
  type: 'preview-component';
  templateId: string;
  config: Record<string, unknown>;
}

/**
 * Type guard for plugin-to-UI messages
 */
export function isPluginToUIMessage(message: unknown): message is PluginToUIMessage {
  if (typeof message !== 'object' || message === null) return false;
  const msg = message as { type: string };
  return ['theme-change', 'operation-result', 'error', 'status'].includes(msg.type);
}

/**
 * Type guard for UI-to-plugin messages
 */
export function isUIToPluginMessage(message: unknown): message is UIToPluginMessage {
  if (typeof message !== 'object' || message === null) return false;
  const msg = message as { type: string };
  return ['create-error-dialog', 'create-component', 'preview-component'].includes(msg.type);
}