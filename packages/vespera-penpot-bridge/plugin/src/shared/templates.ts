/**
 * Template definitions for UI components
 */

/**
 * Template categories
 */
export type TemplateCategory = 'dialog' | 'button' | 'form' | 'card' | 'panel' | 'chat';

/**
 * Base template interface
 */
export interface ComponentTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  config: Record<string, unknown>;
}

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
 * Configuration for success dialog template
 */
export interface SuccessDialogConfig {
  title: string;
  message: string;
  dismissible: boolean;
}

/**
 * Button style variants
 */
export type ButtonStyle = 'primary' | 'secondary' | 'outlined' | 'text';

/**
 * Configuration for button template
 */
export interface ButtonConfig {
  label: string;
  style: ButtonStyle;
  width?: number;
  height?: number;
}

/**
 * Configuration for input field template
 */
export interface InputFieldConfig {
  label: string;
  placeholder?: string;
  errorMessage?: string;
  width?: number;
}

/**
 * Configuration for info card template
 */
export interface CardConfig {
  header: string;
  body: string;
  footer?: string;
  width?: number;
  padding?: number;
}

/**
 * Message bubble role variants
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Configuration for message bubble template
 */
export interface MessageBubbleConfig {
  role: MessageRole;
  content: string;
  timestamp?: string;
  avatarInitial?: string;
  width?: number;
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
 * Button style colors
 */
export const BUTTON_COLORS = {
  primary: {
    background: '#3B82F6',
    text: '#FFFFFF',
    border: '#3B82F6',
  },
  secondary: {
    background: '#6B7280',
    text: '#FFFFFF',
    border: '#6B7280',
  },
  outlined: {
    background: 'transparent',
    text: '#3B82F6',
    border: '#3B82F6',
  },
  text: {
    background: 'transparent',
    text: '#3B82F6',
    border: 'transparent',
  },
} as const;

/**
 * Message bubble role colors
 */
export const MESSAGE_BUBBLE_COLORS = {
  user: {
    background: '#3B82F6',
    text: '#FFFFFF',
    avatar: '#2563EB',
    timestamp: '#93C5FD',
  },
  assistant: {
    background: '#F3F4F6',
    text: '#111827',
    avatar: '#6B7280',
    timestamp: '#9CA3AF',
  },
  system: {
    background: '#FEF3C7',
    text: '#92400E',
    avatar: '#F59E0B',
    timestamp: '#D97706',
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
 * Success dialog template dimensions
 */
export const SUCCESS_DIALOG_DIMENSIONS = {
  width: 400,
  height: 200,
  padding: 20,
  borderRadius: 8,
  borderWidth: 2,
} as const;

/**
 * Button template dimensions
 */
export const BUTTON_DIMENSIONS = {
  defaultWidth: 120,
  defaultHeight: 40,
  borderRadius: 6,
  borderWidth: 2,
} as const;

/**
 * Input field template dimensions
 */
export const INPUT_FIELD_DIMENSIONS = {
  defaultWidth: 300,
  inputHeight: 40,
  labelHeight: 20,
  spacing: 8,
  borderRadius: 4,
  borderWidth: 1,
} as const;

/**
 * Card template dimensions
 */
export const CARD_DIMENSIONS = {
  defaultWidth: 350,
  defaultPadding: 16,
  headerHeight: 30,
  borderRadius: 8,
  borderWidth: 1,
} as const;

/**
 * Message bubble template dimensions
 */
export const MESSAGE_BUBBLE_DIMENSIONS = {
  defaultWidth: 400,
  avatarSize: 32,
  padding: 12,
  spacing: 8,
  borderRadius: 12,
  timestampHeight: 14,
} as const;

/**
 * Template registry
 */
export const TEMPLATE_REGISTRY: Record<string, ComponentTemplate> = {
  'error-dialog': {
    id: 'error-dialog',
    name: 'Error Dialog',
    category: 'dialog',
    description: 'A dialog for displaying error, warning, info, or success messages',
    config: ERROR_DIALOG_DIMENSIONS,
  },
  'success-dialog': {
    id: 'success-dialog',
    name: 'Success Dialog',
    category: 'dialog',
    description: 'A dialog for displaying success messages with checkmark',
    config: SUCCESS_DIALOG_DIMENSIONS,
  },
  'primary-button': {
    id: 'primary-button',
    name: 'Button',
    category: 'button',
    description: 'A configurable button with multiple style variants',
    config: BUTTON_DIMENSIONS,
  },
  'input-field': {
    id: 'input-field',
    name: 'Input Field',
    category: 'form',
    description: 'A labeled input field with optional placeholder and error state',
    config: INPUT_FIELD_DIMENSIONS,
  },
  'info-card': {
    id: 'info-card',
    name: 'Info Card',
    category: 'card',
    description: 'A card with header, body, and optional footer',
    config: CARD_DIMENSIONS,
  },
  'message-bubble': {
    id: 'message-bubble',
    name: 'Message Bubble',
    category: 'chat',
    description: 'A chat message bubble with avatar, content, and timestamp',
    config: MESSAGE_BUBBLE_DIMENSIONS,
  },
};