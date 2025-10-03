/**
 * Template definitions for UI components
 */

/**
 * Template categories
 */
export type TemplateCategory = 'dialog' | 'button' | 'form' | 'card' | 'panel' | 'chat' | 'navigation';

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
  role?: MessageRole;
  content?: string;
  timestamp?: string;
  avatarInitial?: string;
  width?: number;
}

/**
 * Provider names for LLM provider selector
 */
export type ProviderName = 'claude' | 'gpt-4' | 'gemini' | 'custom';

/**
 * Connection status variants
 */
export type ConnectionStatus = 'connected' | 'disconnected' | 'error';

/**
 * Configuration for provider selector template
 */
export interface ProviderSelectorConfig {
  provider?: ProviderName;
  modelName?: string;
  status?: ConnectionStatus;
  width?: number;
}

/**
 * Configuration for status indicator template
 */
export interface StatusIndicatorConfig {
  status?: ConnectionStatus;
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  label?: string;
}

/**
 * Tree node states
 */
export type TreeNodeState = 'default' | 'selected' | 'hover' | 'active';

/**
 * Tree node expand/collapse states
 */
export type TreeNodeExpandState = 'expanded' | 'collapsed' | 'leaf';

/**
 * Configuration for tree node template
 */
export interface TreeNodeConfig {
  label?: string;
  icon?: string;
  level?: number;
  expandState?: TreeNodeExpandState;
  state?: TreeNodeState;
  hasChildren?: boolean;
  width?: number;
}

/**
 * Tag/Badge types
 */
export type TagType = 'status' | 'category' | 'priority' | 'custom';

/**
 * Tag/Badge sizes
 */
export type TagSize = 'small' | 'medium' | 'large';

/**
 * Configuration for tag/badge template
 */
export interface TagBadgeConfig {
  label?: string;
  type?: TagType;
  size?: TagSize;
  removable?: boolean;
  color?: string; // Custom color for 'custom' type
}

/**
 * Configuration for quick action card template
 */
export interface QuickActionCardConfig {
  icon?: string;
  title?: string;
  description?: string;
  shortcut?: string;
  width?: number;
  height?: number;
}

/**
 * Message entry for thread template
 */
export interface MessageEntry {
  role: MessageRole;
  content: string;
  timestamp?: string;
  avatarInitial?: string;
}

/**
 * Configuration for message thread template
 */
export interface MessageThreadConfig {
  messages?: MessageEntry[];
  showDateSeparator?: boolean;
  dateLabel?: string;
  showTypingIndicator?: boolean;
  showScrollButton?: boolean;
  width?: number;
  height?: number;
}

/**
 * Form field configuration for config panel
 */
export interface ConfigField {
  label: string;
  type: 'text' | 'number' | 'select' | 'toggle' | 'textarea';
  value?: string | number | boolean;
  placeholder?: string;
  required?: boolean;
  error?: string;
  options?: string[]; // For select type
}

/**
 * Configuration section for config panel
 */
export interface ConfigSection {
  title: string;
  collapsed?: boolean;
  fields: ConfigField[];
}

/**
 * Configuration for config panel template
 */
export interface ConfigPanelConfig {
  sections?: ConfigSection[];
  showActionBar?: boolean;
  saveLabel?: string;
  cancelLabel?: string;
  width?: number;
  height?: number;
}

/**
 * View mode types for navigation pane
 */
export type ViewMode = 'list' | 'grid' | 'tree';

/**
 * Tree item structure for navigation pane
 */
export interface TreeItem {
  label: string;
  level?: number;
  expandState?: TreeNodeExpandState;
  hasChildren?: boolean;
  children?: TreeItem[];
}

/**
 * Configuration for navigation pane template
 */
export interface NavigationPaneConfig {
  title?: string;
  viewMode?: ViewMode;
  searchPlaceholder?: string;
  items?: TreeItem[];
  width?: number;
  height?: number;
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
 * Connection status colors
 */
export const CONNECTION_STATUS_COLORS = {
  connected: {
    indicator: '#10B981',
    background: '#D1FAE5',
    text: '#065F46',
  },
  disconnected: {
    indicator: '#F59E0B',
    background: '#FEF3C7',
    text: '#92400E',
  },
  error: {
    indicator: '#EF4444',
    background: '#FEE2E2',
    text: '#991B1B',
  },
} as const;

/**
 * Provider brand colors
 */
export const PROVIDER_COLORS = {
  claude: '#D97706',
  'gpt-4': '#10B981',
  gemini: '#3B82F6',
  custom: '#6B7280',
} as const;

/**
 * Tree node state colors
 */
export const TREE_NODE_COLORS = {
  default: {
    background: '#FFFFFF',
    text: '#374151',
    icon: '#6B7280',
    border: '#E5E7EB',
  },
  selected: {
    background: '#EBF5FF',
    text: '#1E40AF',
    icon: '#3B82F6',
    border: '#3B82F6',
  },
  hover: {
    background: '#F9FAFB',
    text: '#374151',
    icon: '#6B7280',
    border: '#E5E7EB',
  },
  active: {
    background: '#EFF6FF',
    text: '#1D4ED8',
    icon: '#2563EB',
    border: '#3B82F6',
  },
} as const;

/**
 * Tag/Badge type colors
 */
export const TAG_BADGE_COLORS = {
  status: {
    background: '#F3F4F6',
    text: '#374151',
    border: '#D1D5DB',
  },
  category: {
    background: '#EBF5FF',
    text: '#1E40AF',
    border: '#BFDBFE',
  },
  priority: {
    background: '#FEF3C7',
    text: '#92400E',
    border: '#FCD34D',
  },
  custom: {
    background: '#F3E8FF',
    text: '#6B21A8',
    border: '#E9D5FF',
  },
} as const;

/**
 * Quick action card colors
 */
export const QUICK_ACTION_CARD_COLORS = {
  background: '#FFFFFF',
  border: '#E5E7EB',
  icon: '#6B7280',
  title: '#111827',
  description: '#6B7280',
  shortcut: '#9CA3AF',
  hoverBackground: '#F9FAFB',
  activeBackground: '#F3F4F6',
} as const;

/**
 * Message thread colors
 */
export const MESSAGE_THREAD_COLORS = {
  background: '#FFFFFF',
  border: '#E5E7EB',
  dateSeparator: '#6B7280',
  dateBackground: '#F3F4F6',
  typingIndicator: '#9CA3AF',
  scrollButton: '#3B82F6',
  scrollButtonHover: '#2563EB',
} as const;

/**
 * Config panel colors
 */
export const CONFIG_PANEL_COLORS = {
  background: '#FFFFFF',
  border: '#E5E7EB',
  sectionHeader: '#111827',
  sectionBorder: '#E5E7EB',
  fieldLabel: '#374151',
  fieldBorder: '#D1D5DB',
  fieldBorderError: '#EF4444',
  fieldText: '#111827',
  fieldPlaceholder: '#9CA3AF',
  toggleBackground: '#D1D5DB',
  toggleActive: '#3B82F6',
  errorText: '#EF4444',
  saveButton: '#3B82F6',
  cancelButton: '#6B7280',
  chevron: '#6B7280',
} as const;

/**
 * Navigation pane colors
 */
export const NAVIGATION_PANE_COLORS = {
  background: '#FFFFFF',
  border: '#E5E7EB',
  titleText: '#111827',
  searchBackground: '#F9FAFB',
  searchIcon: '#6B7280',
  searchPlaceholder: '#9CA3AF',
  toggleBackground: '#F3F4F6',
  toggleActive: '#3B82F6',
  toggleActiveText: '#FFFFFF',
  toggleInactive: 'transparent',
  toggleInactiveText: '#6B7280',
  breadcrumbText: '#6B7280',
  itemBackground: '#FFFFFF',
  itemText: '#374151',
  chevron: '#6B7280',
  itemHoverBorder: '#E5E7EB',
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
 * Provider selector template dimensions
 */
export const PROVIDER_SELECTOR_DIMENSIONS = {
  defaultWidth: 280,
  height: 60,
  padding: 12,
  spacing: 8,
  borderRadius: 8,
  indicatorSize: 8,
  iconSize: 24,
} as const;

/**
 * Status indicator template dimensions
 */
export const STATUS_INDICATOR_DIMENSIONS = {
  small: {
    indicatorSize: 8,
    fontSize: 10,
    height: 20,
    spacing: 4,
  },
  medium: {
    indicatorSize: 12,
    fontSize: 12,
    height: 24,
    spacing: 6,
  },
  large: {
    indicatorSize: 16,
    fontSize: 14,
    height: 32,
    spacing: 8,
  },
} as const;

/**
 * Tree node template dimensions
 */
export const TREE_NODE_DIMENSIONS = {
  defaultWidth: 300,
  height: 32,
  padding: 8,
  spacing: 6,
  iconSize: 16,
  fontSize: 14,
  borderRadius: 4,
  borderWidth: 1,
  indentSize: 20,
  chevronSize: 12,
} as const;

/**
 * Tag/Badge template dimensions
 */
export const TAG_BADGE_DIMENSIONS = {
  small: {
    fontSize: 10,
    padding: 4,
    spacing: 4,
    borderRadius: 12,
    borderWidth: 1,
    removeIconSize: 10,
  },
  medium: {
    fontSize: 12,
    padding: 6,
    spacing: 6,
    borderRadius: 16,
    borderWidth: 1,
    removeIconSize: 12,
  },
  large: {
    fontSize: 14,
    padding: 8,
    spacing: 8,
    borderRadius: 20,
    borderWidth: 1,
    removeIconSize: 14,
  },
} as const;

/**
 * Quick action card template dimensions
 */
export const QUICK_ACTION_CARD_DIMENSIONS = {
  defaultWidth: 200,
  defaultHeight: 120,
  padding: 16,
  spacing: 8,
  iconSize: 32,
  titleFontSize: 14,
  descriptionFontSize: 12,
  shortcutFontSize: 10,
  borderRadius: 8,
  borderWidth: 1,
} as const;

/**
 * Message thread template dimensions
 */
export const MESSAGE_THREAD_DIMENSIONS = {
  defaultWidth: 500,
  defaultHeight: 600,
  padding: 16,
  spacing: 12,
  messageSpacing: 8,
  borderRadius: 8,
  borderWidth: 1,
  dateSeparatorHeight: 32,
  typingIndicatorHeight: 40,
  scrollButtonSize: 36,
  scrollButtonMargin: 8,
} as const;

/**
 * Config panel template dimensions
 */
export const CONFIG_PANEL_DIMENSIONS = {
  defaultWidth: 500,
  defaultHeight: 600,
  padding: 20,
  sectionSpacing: 24,
  fieldSpacing: 16,
  labelHeight: 20,
  inputHeight: 40,
  textareaHeight: 80,
  sectionHeaderHeight: 48,
  actionButtonHeight: 36,
  actionButtonWidth: 80,
  borderRadius: 8,
  borderWidth: 1,
  toggleSize: 20,
  chevronSize: 16,
} as const;

/**
 * Navigation pane template dimensions
 */
export const NAVIGATION_PANE_DIMENSIONS = {
  defaultWidth: 320,
  padding: 16,
  borderRadius: 8,
  borderWidth: 1,
  titleHeight: 32,
  titleFontSize: 18,
  searchHeight: 36,
  searchPadding: 12,
  searchBorderRadius: 6,
  searchIconSize: 16,
  searchFontSize: 14,
  viewToggleHeight: 32,
  toggleBorderRadius: 4,
  toggleFontSize: 12,
  toggleSpacing: 4,
  breadcrumbHeight: 20,
  breadcrumbFontSize: 12,
  itemHeight: 32,
  itemPadding: 12,
  itemSpacing: 6,
  itemFontSize: 14,
  itemBorderRadius: 4,
  itemBorderWidth: 1,
  chevronSize: 12,
  indentSize: 20,
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
  'provider-selector': {
    id: 'provider-selector',
    name: 'Provider Selector',
    category: 'chat',
    description: 'LLM provider selector with connection status indicator',
    config: PROVIDER_SELECTOR_DIMENSIONS,
  },
  'status-indicator': {
    id: 'status-indicator',
    name: 'Status Indicator',
    category: 'chat',
    description: 'Connection status indicator with optional text label',
    config: STATUS_INDICATOR_DIMENSIONS,
  },
  'tree-node': {
    id: 'tree-node',
    name: 'Tree Node',
    category: 'navigation',
    description: 'Hierarchical tree node with icon, label, and expand/collapse indicator',
    config: TREE_NODE_DIMENSIONS,
  },
  'tag-badge': {
    id: 'tag-badge',
    name: 'Tag/Badge',
    category: 'navigation',
    description: 'Rounded pill design with color variants and removable option',
    config: TAG_BADGE_DIMENSIONS,
  },
  'quick-action-card': {
    id: 'quick-action-card',
    name: 'Quick Action Card',
    category: 'navigation',
    description: 'Icon + title + description layout with keyboard shortcut indicator',
    config: QUICK_ACTION_CARD_DIMENSIONS,
  },
  'message-thread': {
    id: 'message-thread',
    name: 'Message Thread',
    category: 'chat',
    description: 'Stack of message bubbles with date separator and typing indicator',
    config: MESSAGE_THREAD_DIMENSIONS,
  },
  'config-panel': {
    id: 'config-panel',
    name: 'Config Panel',
    category: 'form',
    description: 'Grouped form fields with collapsible sections and validation states',
    config: CONFIG_PANEL_DIMENSIONS,
  },
  'navigation-pane': {
    id: 'navigation-pane',
    name: 'Navigation Pane',
    category: 'navigation',
    description: 'Tree structure container with search bar and view mode toggle',
    config: NAVIGATION_PANE_DIMENSIONS,
  },
};