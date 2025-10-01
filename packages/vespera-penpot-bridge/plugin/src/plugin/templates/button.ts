/**
 * Button creation using Penpot API
 */

import type { ButtonConfig } from '../../shared/templates';
import { BUTTON_DIMENSIONS, BUTTON_COLORS } from '../../shared/templates';

/**
 * Create a button component in Penpot
 *
 * Creates a board with:
 * - Background rectangle (styled based on variant)
 * - Label text
 *
 * Supports multiple styles: primary, secondary, outlined, text
 *
 * @param config - Configuration for the button
 * @returns The ID of the created board
 */
export function createButton(config: ButtonConfig): string {
  const {
    label,
    style = 'primary',
    width = BUTTON_DIMENSIONS.defaultWidth,
    height = BUTTON_DIMENSIONS.defaultHeight,
  } = config;

  const colors = BUTTON_COLORS[style];

  // Create board (frame) for the button
  const board = penpot.createBoard();
  board.name = `Button - ${label}`;
  board.resize(width, height);

  // 1. Background rectangle
  const background = penpot.createRectangle();
  background.name = 'Background';
  background.resize(width, height);
  background.x = 0;
  background.y = 0;

  // Apply fills based on style
  if (colors.background !== 'transparent') {
    background.fills = [{ fillColor: colors.background, fillOpacity: 1 }];
  } else {
    background.fills = [];
  }

  // Apply border based on style
  if (colors.border !== 'transparent') {
    background.strokes = [
      {
        strokeColor: colors.border,
        strokeWidth: style === 'outlined' ? BUTTON_DIMENSIONS.borderWidth : 0,
        strokeAlignment: 'inner',
      },
    ];
  }

  background.borderRadius = BUTTON_DIMENSIONS.borderRadius;

  // 2. Label text
  const labelText = penpot.createText(label);
  if (labelText) {
    labelText.name = 'Label';
    labelText.x = 0;
    labelText.y = 0;
    labelText.resize(width, height);
    labelText.fontFamily = 'Inter';
    labelText.fontSize = '14';
    labelText.fontWeight = '600';
    labelText.fills = [{ fillColor: colors.text, fillOpacity: 1 }];
    labelText.align = 'center';
    labelText.verticalAlign = 'center';
  }

  // Collect all shapes in an array (in reverse z-order for correct stacking)
  const shapes = [];

  if (labelText) shapes.push(labelText);
  shapes.push(background);

  // Group all shapes together first (for single-undo support)
  const group = penpot.group(shapes);

  if (group) {
    // Add the group to the board
    board.appendChild(group);
    group.name = 'Button Content';
  }

  // Center the button on the viewport
  const viewport = penpot.viewport;
  if (viewport) {
    board.x = viewport.center.x - width / 2;
    board.y = viewport.center.y - height / 2;
  }

  return board.id;
}
