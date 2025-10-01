/**
 * Card creation using Penpot API
 */

import type { CardConfig } from '../../shared/templates';
import { CARD_DIMENSIONS } from '../../shared/templates';

/**
 * Create an info card component in Penpot
 *
 * Creates a board with:
 * - Background rectangle with border
 * - Header text (bold)
 * - Body text (regular)
 * - Optional footer text
 *
 * @param config - Configuration for the card
 * @returns The ID of the created board
 */
export function createCard(config: CardConfig): string {
  const {
    header,
    body,
    footer,
    width = CARD_DIMENSIONS.defaultWidth,
    padding = CARD_DIMENSIONS.defaultPadding,
  } = config;

  const dims = CARD_DIMENSIONS;
  const hasFooter = !!footer;

  // Calculate body text height (estimate based on character count)
  const bodyLines = Math.ceil(body.length / 40);
  const bodyHeight = Math.max(60, bodyLines * 20);

  // Calculate total height
  const footerHeight = hasFooter ? 30 : 0;
  const totalHeight = padding * 2 + dims.headerHeight + padding + bodyHeight + (hasFooter ? padding + footerHeight : 0);

  // Create board (frame) for the card
  const board = penpot.createBoard();
  board.name = `Card - ${header}`;
  board.resize(width, totalHeight);

  // 1. Background rectangle
  const background = penpot.createRectangle();
  background.name = 'Background';
  background.resize(width, totalHeight);
  background.x = 0;
  background.y = 0;
  background.fills = [{ fillColor: '#FFFFFF', fillOpacity: 1 }];
  background.strokes = [
    {
      strokeColor: '#E5E7EB',
      strokeWidth: dims.borderWidth,
      strokeAlignment: 'inner',
    },
  ];
  background.borderRadius = dims.borderRadius;

  // 2. Header text
  const headerText = penpot.createText(header);
  if (headerText) {
    headerText.name = 'Header';
    headerText.x = padding;
    headerText.y = padding;
    headerText.resize(width - padding * 2, dims.headerHeight);
    headerText.fontFamily = 'Inter';
    headerText.fontSize = '18';
    headerText.fontWeight = '700';
    headerText.fills = [{ fillColor: '#111827', fillOpacity: 1 }];
  }

  // 3. Body text
  const bodyText = penpot.createText(body);
  if (bodyText) {
    bodyText.name = 'Body';
    bodyText.x = padding;
    bodyText.y = padding + dims.headerHeight + padding;
    bodyText.resize(width - padding * 2, bodyHeight);
    bodyText.fontFamily = 'Inter';
    bodyText.fontSize = '14';
    bodyText.fontWeight = '400';
    bodyText.fills = [{ fillColor: '#374151', fillOpacity: 1 }];
  }

  // 4. Footer text (if provided)
  let footerText = null;
  if (hasFooter) {
    footerText = penpot.createText(footer);
    if (footerText) {
      footerText.name = 'Footer';
      footerText.x = padding;
      footerText.y = padding + dims.headerHeight + padding + bodyHeight + padding;
      footerText.resize(width - padding * 2, footerHeight);
      footerText.fontFamily = 'Inter';
      footerText.fontSize = '12';
      footerText.fontWeight = '400';
      footerText.fills = [{ fillColor: '#6B7280', fillOpacity: 1 }];
    }
  }

  // Add shapes to board FIRST (in reverse z-order for correct stacking)
  const shapes = [];

  if (footerText) {
    board.appendChild(footerText);
    shapes.push(footerText);
  }
  if (bodyText) {
    board.appendChild(bodyText);
    shapes.push(bodyText);
  }
  if (headerText) {
    board.appendChild(headerText);
    shapes.push(headerText);
  }
  board.appendChild(background);
  shapes.push(background);

  // NOW group all shapes together (for single-undo support)
  const group = penpot.group(shapes);
  if (group) {
    group.name = 'Card Content';
  }

  // Center the card on the viewport
  const viewport = penpot.viewport;
  if (viewport) {
    board.x = viewport.center.x - width / 2;
    board.y = viewport.center.y - totalHeight / 2;
  }

  return board.id;
}
