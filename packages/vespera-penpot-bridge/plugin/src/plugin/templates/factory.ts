/**
 * Component factory for creating templates dynamically
 */

import { TEMPLATE_REGISTRY } from '../../shared/templates';
import type {
  ErrorDialogConfig,
  SuccessDialogConfig,
  ButtonConfig,
  InputFieldConfig,
  CardConfig,
  MessageBubbleConfig,
  ProviderSelectorConfig,
  StatusIndicatorConfig,
  TreeNodeConfig,
  TagBadgeConfig,
  QuickActionCardConfig,
  MessageThreadConfig,
  ConfigPanelConfig,
  NavigationPaneConfig,
  ThreePanelLayoutConfig,
  ChatWindowLayoutConfig,
  SplitViewLayoutConfig,
} from '../../shared/templates';
import { createErrorDialog } from './error-dialog';
import { createSuccessDialog } from './success-dialog';
import { createButton } from './button';
import { createInputField } from './input-field';
import { createCard } from './card';
import { createMessageBubble } from './message-bubble';
import { createProviderSelector } from './provider-selector';
import { createStatusIndicator } from './status-indicator';
import { createTreeNode } from './tree-node';
import { createTagBadge } from './tag-badge';
import { createQuickActionCard } from './quick-action-card';
import { createMessageThread } from './message-thread';
import { createConfigPanel } from './config-panel';
import { createNavigationPane } from './navigation-pane';
import { createThreePanelLayout } from './three-panel-layout';
import { createChatWindowLayout } from './chat-window-layout';
import { createSplitViewLayout } from './split-view-layout';

/**
 * Create a component based on template ID and configuration
 *
 * @param templateId - The ID of the template to use
 * @param config - Configuration object for the template
 * @returns The ID of the created component
 * @throws Error if template ID is unknown or config is invalid
 */
export function createComponent(templateId: string, config: unknown): string {
  const template = TEMPLATE_REGISTRY[templateId];
  if (!template) {
    throw new Error(`Unknown template: ${templateId}`);
  }

  switch (templateId) {
    case 'error-dialog':
      return createErrorDialog(config as ErrorDialogConfig);

    case 'success-dialog':
      return createSuccessDialog(config as SuccessDialogConfig);

    case 'primary-button':
      return createButton(config as ButtonConfig);

    case 'input-field':
      return createInputField(config as InputFieldConfig);

    case 'info-card':
      return createCard(config as CardConfig);

    case 'message-bubble':
      return createMessageBubble(config as MessageBubbleConfig);

    case 'provider-selector':
      return createProviderSelector(config as ProviderSelectorConfig);

    case 'status-indicator':
      return createStatusIndicator(config as StatusIndicatorConfig);

    case 'tree-node':
      return createTreeNode(config as TreeNodeConfig);

    case 'tag-badge':
      return createTagBadge(config as TagBadgeConfig);

    case 'quick-action-card':
      return createQuickActionCard(config as QuickActionCardConfig);

    case 'message-thread':
      return createMessageThread(config as MessageThreadConfig);

    case 'config-panel':
      return createConfigPanel(config as ConfigPanelConfig);

    case 'navigation-pane':
      return createNavigationPane(config as NavigationPaneConfig);

    case 'three-panel-layout':
      return createThreePanelLayout(config as ThreePanelLayoutConfig);

    case 'chat-window-layout':
      return createChatWindowLayout(config as ChatWindowLayoutConfig);

    case 'split-view-layout':
      return createSplitViewLayout(config as SplitViewLayoutConfig);

    default:
      throw new Error(`Template not implemented: ${templateId}`);
  }
}

/**
 * Get list of all available templates
 *
 * @returns Array of template metadata
 */
export function getAvailableTemplates() {
  return Object.values(TEMPLATE_REGISTRY);
}

/**
 * Get template metadata by ID
 *
 * @param templateId - The ID of the template
 * @returns Template metadata or undefined if not found
 */
export function getTemplate(templateId: string) {
  return TEMPLATE_REGISTRY[templateId];
}
