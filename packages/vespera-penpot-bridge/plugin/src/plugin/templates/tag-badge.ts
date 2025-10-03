/**
 * Tag/Badge creation using Penpot API
 */

import type { TagBadgeConfig } from '../../shared/templates';
import {
  TAG_BADGE_DIMENSIONS,
  TAG_BADGE_COLORS,
} from '../../shared/templates';

/**
 * Create a tag/badge component in Penpot
 *
 * Creates a rounded pill design with:
 * - Label text
 * - Color variants (status, category, priority, custom)
 * - Size variants (small, medium, large)
 * - Optional remove button (X)
 *
 * @param config - Configuration for the tag/badge
 * @returns The ID of the created board
 */
export function createTagBadge(config: TagBadgeConfig): string {
  const {
    label = 'Tag',
    type = 'status',
    size = 'medium',
    removable = false,
    color,
  } = config;

  const dims = TAG_BADGE_DIMENSIONS[size];
  const colors = color
    ? { background: color + '20', text: color, border: color }
    : TAG_BADGE_COLORS[type];

  // Calculate dimensions
  const textWidth = label.length * (dims.fontSize * 0.6) + 4; // Rough character width estimation
  const removeIconWidth = removable ? dims.removeIconSize + dims.spacing : 0;
  const width = textWidth + (dims.padding * 2) + removeIconWidth;
  const height = dims.fontSize + (dims.padding * 2);

  // Create board (frame) for the tag/badge
  const board = penpot.createBoard();
  board.name = `Tag/Badge - ${label}`;
  board.resize(width, height);

  // Create background (pill shape)
  const background = penpot.createRectangle();
  background.name = 'Tag Background';
  background.x = 0;
  background.y = 0;
  background.resize(width, height);
  background.fills = [{ fillColor: colors.background, fillOpacity: 1 }];
  background.borderRadius = dims.borderRadius;
  background.strokes = [{ strokeColor: colors.border, strokeOpacity: 1, strokeAlignment: 'center', strokeWidth: dims.borderWidth }];

  // Create label text
  const labelElement = penpot.createText(label);
  if (labelElement) {
    labelElement.name = 'Tag Label';
    labelElement.x = dims.padding;
    labelElement.y = 0;
    labelElement.resize(textWidth, height);
    labelElement.fontFamily = 'Inter';
    labelElement.fontSize = dims.fontSize.toString();
    labelElement.fontWeight = '500';
    labelElement.fills = [{ fillColor: colors.text, fillOpacity: 1 }];
    labelElement.align = 'center';
    labelElement.verticalAlign = 'center';
  }

  // Create remove button (if removable)
  let removeButton = null;
  if (removable) {
    removeButton = penpot.createText('×');
    if (removeButton) {
      removeButton.name = 'Remove Button';
      removeButton.x = width - dims.padding - dims.removeIconSize;
      removeButton.y = 0;
      removeButton.resize(dims.removeIconSize, height);
      removeButton.fontFamily = 'Inter';
      removeButton.fontSize = dims.fontSize.toString();
      removeButton.fontWeight = '600';
      removeButton.fills = [{ fillColor: colors.text, fillOpacity: 0.7 }];
      removeButton.align = 'center';
      removeButton.verticalAlign = 'center';
    }
  }

  // Add shapes to board (first appended = on top in Penpot)
  if (removeButton) board.appendChild(removeButton);
  if (labelElement) board.appendChild(labelElement);
  board.appendChild(background);

  // Center the tag/badge on the viewport
  const viewport = penpot.viewport;
  if (viewport) {
    board.x = viewport.center.x - width / 2;
    board.y = viewport.center.y - height / 2;
  }

  return board.id;
}