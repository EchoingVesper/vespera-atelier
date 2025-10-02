/**
 * Provider selector creation using Penpot API
 */

import type { ProviderSelectorConfig } from '../../shared/templates';
import {
  PROVIDER_SELECTOR_DIMENSIONS,
  CONNECTION_STATUS_COLORS,
  PROVIDER_COLORS,
} from '../../shared/templates';

/**
 * Create a provider selector component in Penpot
 *
 * Creates a board with:
 * - Provider icon/label
 * - Model name display
 * - Connection status indicator
 * - Dropdown affordance
 *
 * Supports providers: claude, gpt-4, gemini, custom
 * Supports status: connected, disconnected, error
 *
 * @param config - Configuration for the provider selector
 * @returns The ID of the created board
 */
export function createProviderSelector(config: ProviderSelectorConfig): string {
  const {
    provider = 'claude',
    modelName = 'Claude 3.5 Sonnet',
    status = 'connected',
    width = PROVIDER_SELECTOR_DIMENSIONS.defaultWidth,
  } = config;

  const dims = PROVIDER_SELECTOR_DIMENSIONS;
  const statusColors = CONNECTION_STATUS_COLORS[status];
  const providerColor = PROVIDER_COLORS[provider];

  // Create board (frame) for the provider selector
  const board = penpot.createBoard();
  board.name = 'Provider Selector';
  board.resize(width, dims.height);
  board.fills = [];

  // 1. Background container
  const background = penpot.createRectangle();
  background.name = 'Background';
  background.x = 0;
  background.y = 0;
  background.resize(width, dims.height);
  background.fills = [{ fillColor: '#FFFFFF', fillOpacity: 1 }];
  background.strokes = [{ strokeColor: '#E5E7EB', strokeWidth: 1 }];
  background.borderRadius = dims.borderRadius;

  // 2. Provider icon (circle with initial)
  const icon = penpot.createEllipse();
  icon.name = 'Provider Icon';
  icon.x = dims.padding;
  icon.y = (dims.height - dims.iconSize) / 2;
  icon.resize(dims.iconSize, dims.iconSize);
  icon.fills = [{ fillColor: providerColor, fillOpacity: 1 }];

  // 3. Provider icon letter
  const iconText = penpot.createText(provider.charAt(0).toUpperCase());
  if (iconText) {
    iconText.name = 'Provider Icon Letter';
    iconText.x = dims.padding;
    iconText.y = (dims.height - dims.iconSize) / 2;
    iconText.resize(dims.iconSize, dims.iconSize);
    iconText.fontFamily = 'Inter';
    iconText.fontSize = '12';
    iconText.fontWeight = '700';
    iconText.fills = [{ fillColor: '#FFFFFF', fillOpacity: 1 }];
    iconText.align = 'center';
    iconText.verticalAlign = 'center';
  }

  // 4. Provider name label
  const providerLabel = penpot.createText(provider.toUpperCase());
  if (providerLabel) {
    providerLabel.name = 'Provider Name';
    providerLabel.x = dims.padding + dims.iconSize + dims.spacing;
    providerLabel.y = dims.padding;
    providerLabel.resize(width - dims.padding * 3 - dims.iconSize - dims.spacing - 40, 16);
    providerLabel.fontFamily = 'Inter';
    providerLabel.fontSize = '11';
    providerLabel.fontWeight = '600';
    providerLabel.fills = [{ fillColor: '#6B7280', fillOpacity: 1 }];
    providerLabel.verticalAlign = 'top';
  }

  // 5. Model name display
  const modelLabel = penpot.createText(modelName);
  if (modelLabel) {
    modelLabel.name = 'Model Name';
    modelLabel.x = dims.padding + dims.iconSize + dims.spacing;
    modelLabel.y = dims.padding + 18;
    modelLabel.resize(width - dims.padding * 3 - dims.iconSize - dims.spacing - 40, 18);
    modelLabel.fontFamily = 'Inter';
    modelLabel.fontSize = '14';
    modelLabel.fontWeight = '400';
    modelLabel.fills = [{ fillColor: '#111827', fillOpacity: 1 }];
    modelLabel.verticalAlign = 'top';
  }

  // 6. Connection status indicator (dot)
  const statusIndicator = penpot.createEllipse();
  statusIndicator.name = 'Status Indicator';
  statusIndicator.x = width - dims.padding - dims.indicatorSize - 24;
  statusIndicator.y = (dims.height - dims.indicatorSize) / 2;
  statusIndicator.resize(dims.indicatorSize, dims.indicatorSize);
  statusIndicator.fills = [{ fillColor: statusColors.indicator, fillOpacity: 1 }];

  // 7. Dropdown chevron
  const chevronText = penpot.createText('▼');
  if (chevronText) {
    chevronText.name = 'Dropdown Chevron';
    chevronText.x = width - dims.padding - 16;
    chevronText.y = (dims.height - 16) / 2;
    chevronText.resize(16, 16);
    chevronText.fontFamily = 'Inter';
    chevronText.fontSize = '10';
    chevronText.fontWeight = '400';
    chevronText.fills = [{ fillColor: '#9CA3AF', fillOpacity: 1 }];
    chevronText.align = 'center';
    chevronText.verticalAlign = 'center';
  }

  // Add shapes to board (first appended = on top in Penpot)
  if (chevronText) board.appendChild(chevronText);
  board.appendChild(statusIndicator);
  if (modelLabel) board.appendChild(modelLabel);
  if (providerLabel) board.appendChild(providerLabel);
  if (iconText) board.appendChild(iconText);
  board.appendChild(icon);
  board.appendChild(background);

  // Center the provider selector on the viewport
  const viewport = penpot.viewport;
  if (viewport) {
    board.x = viewport.center.x - width / 2;
    board.y = viewport.center.y - dims.height / 2;
  }

  return board.id;
}
