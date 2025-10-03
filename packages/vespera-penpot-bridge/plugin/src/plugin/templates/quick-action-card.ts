/**
 * Quick Action Card creation using Penpot API
 */

import type { QuickActionCardConfig } from '../../shared/templates';
import {
  QUICK_ACTION_CARD_DIMENSIONS,
  QUICK_ACTION_CARD_COLORS,
} from '../../shared/templates';

/**
 * Create a quick action card component in Penpot
 *
 * Creates a card layout with:
 * - Large icon
 * - Title text
 * - Optional description text
 * - Optional keyboard shortcut indicator
 * - Hover/active states
 * - Grid-friendly design
 *
 * @param config - Configuration for the quick action card
 * @returns The ID of the created board
 */
export function createQuickActionCard(config: QuickActionCardConfig): string {
  const {
    icon = '⚡',
    title = 'Quick Action',
    description = '',
    shortcut = '',
    width = QUICK_ACTION_CARD_DIMENSIONS.defaultWidth,
    height = QUICK_ACTION_CARD_DIMENSIONS.defaultHeight,
  } = config;

  const dims = QUICK_ACTION_CARD_DIMENSIONS;
  const colors = QUICK_ACTION_CARD_COLORS;

  // Create board (frame) for the quick action card
  const board = penpot.createBoard();
  board.name = `Quick Action - ${title}`;
  board.resize(width, height);

  // Create background card
  const background = penpot.createRectangle();
  background.name = 'Card Background';
  background.x = 0;
  background.y = 0;
  background.resize(width, height);
  background.fills = [{ fillColor: colors.background, fillOpacity: 1 }];
  background.borderRadius = dims.borderRadius;
  background.strokes = [{ strokeColor: colors.border, strokeOpacity: 1, strokeAlignment: 'center', strokeWidth: dims.borderWidth }];

  // 1. Icon (centered at top)
  const iconElement = penpot.createText(icon);
  if (iconElement) {
    iconElement.name = 'Action Icon';
    iconElement.x = (width - dims.iconSize) / 2;
    iconElement.y = dims.padding;
    iconElement.resize(dims.iconSize, dims.iconSize);
    iconElement.fontFamily = 'Inter';
    iconElement.fontSize = (dims.iconSize * 0.8).toString(); // Scale font to icon size
    iconElement.fills = [{ fillColor: colors.icon, fillOpacity: 1 }];
    iconElement.align = 'center';
    iconElement.verticalAlign = 'center';
  }

  // Calculate vertical positioning
  let currentY = dims.padding + dims.iconSize + dims.spacing;

  // 2. Title text
  const titleElement = penpot.createText(title);
  if (titleElement) {
    titleElement.name = 'Action Title';
    titleElement.x = dims.padding;
    titleElement.y = currentY;
    titleElement.resize(width - (dims.padding * 2), dims.titleFontSize + 4);
    titleElement.fontFamily = 'Inter';
    titleElement.fontSize = dims.titleFontSize.toString();
    titleElement.fontWeight = '600';
    titleElement.fills = [{ fillColor: colors.title, fillOpacity: 1 }];
    titleElement.align = 'center';
    titleElement.verticalAlign = 'center';
  }

  currentY += dims.titleFontSize + dims.spacing;

  // 3. Description text (if provided)
  let descriptionElement = null;
  if (description) {
    // Estimate description height based on character count
    const descHeight = Math.ceil(description.length / 25) * (dims.descriptionFontSize + 2);
    descriptionElement = penpot.createText(description);
    if (descriptionElement) {
      descriptionElement.name = 'Action Description';
      descriptionElement.x = dims.padding;
      descriptionElement.y = currentY;
      descriptionElement.resize(width - (dims.padding * 2), descHeight);
      descriptionElement.fontFamily = 'Inter';
      descriptionElement.fontSize = dims.descriptionFontSize.toString();
      descriptionElement.fills = [{ fillColor: colors.description, fillOpacity: 1 }];
      descriptionElement.align = 'center';
      descriptionElement.verticalAlign = 'top';
    }
    currentY += descHeight + dims.spacing;
  }

  // 4. Shortcut indicator (if provided)
  let shortcutElement = null;
  if (shortcut) {
    const shortcutText = `[${shortcut}]`;
    const shortcutWidth = shortcutText.length * (dims.shortcutFontSize * 0.6) + 8;

    shortcutElement = penpot.createText(shortcutText);
    if (shortcutElement) {
      shortcutElement.name = 'Keyboard Shortcut';
      shortcutElement.x = width - dims.padding - shortcutWidth;
      shortcutElement.y = currentY;
      shortcutElement.resize(shortcutWidth, dims.shortcutFontSize + 4);
      shortcutElement.fontFamily = 'Inter';
      shortcutElement.fontSize = dims.shortcutFontSize.toString();
      shortcutElement.fontWeight = '500';
      shortcutElement.fills = [{ fillColor: colors.shortcut, fillOpacity: 1 }];
      shortcutElement.align = 'center';
      shortcutElement.verticalAlign = 'center';
    }
  }

  // Add shapes to board (first appended = on top in Penpot)
  if (shortcutElement) board.appendChild(shortcutElement);
  if (descriptionElement) board.appendChild(descriptionElement);
  if (titleElement) board.appendChild(titleElement);
  if (iconElement) board.appendChild(iconElement);
  board.appendChild(background);

  // Center the quick action card on the viewport
  const viewport = penpot.viewport;
  if (viewport) {
    board.x = viewport.center.x - width / 2;
    board.y = viewport.center.y - height / 2;
  }

  return board.id;
}