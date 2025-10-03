/**
 * Tree node creation using Penpot API
 */

import type { TreeNodeConfig } from '../../shared/templates';
import {
  TREE_NODE_DIMENSIONS,
  TREE_NODE_COLORS,
} from '../../shared/templates';

/**
 * Create a tree node component in Penpot
 *
 * Creates a hierarchical tree node with:
 * - Optional icon
 * - Label text
 * - Expand/collapse chevron (for nodes with children)
 * - Indentation based on hierarchy level
 * - State variants (default, selected, hover, active)
 *
 * @param config - Configuration for the tree node
 * @returns The ID of the created board
 */
export function createTreeNode(config: TreeNodeConfig): string {
  const {
    label = 'Tree Node',
    icon = '',
    level = 0,
    expandState = 'leaf',
    state = 'default',
    hasChildren = false,
    width = TREE_NODE_DIMENSIONS.defaultWidth,
  } = config;

  const dims = TREE_NODE_DIMENSIONS;
  const colors = TREE_NODE_COLORS[state];

  // Calculate indent based on level
  const indent = level * dims.indentSize;

  // Determine if we need a chevron
  const needsChevron = hasChildren && expandState !== 'leaf';
  const chevronSymbol = expandState === 'expanded' ? '▼' : '▶';

  // Calculate available width for text
  const chevronWidth = needsChevron ? dims.chevronSize + dims.spacing : 0;
  const iconWidth = icon ? dims.iconSize + dims.spacing : 0;
  const textWidth = width - indent - chevronWidth - iconWidth - (dims.padding * 2);

  // Create board (frame) for the tree node
  const board = penpot.createBoard();
  board.name = `Tree Node - ${label}`;
  board.resize(width, dims.height);

  // Add background based on state
  if (state !== 'default') {
    board.fills = [{ fillColor: colors.background, fillOpacity: 1 }];
    board.borderRadius = dims.borderRadius;
  } else {
    board.fills = [];
  }

  let currentX = indent + dims.padding;

  // 1. Expand/collapse chevron (if needed)
  let chevronElement = null;
  if (needsChevron) {
    chevronElement = penpot.createText(chevronSymbol);
    if (chevronElement) {
      chevronElement.name = 'Expand/Collapse Chevron';
      chevronElement.x = currentX;
      chevronElement.y = 0;
      chevronElement.resize(dims.chevronSize, dims.height);
      chevronElement.fontFamily = 'Inter';
      chevronElement.fontSize = dims.fontSize.toString();
      chevronElement.fontWeight = '600';
      chevronElement.fills = [{ fillColor: colors.icon, fillOpacity: 1 }];
      chevronElement.align = 'center';
      chevronElement.verticalAlign = 'center';
      currentX += dims.chevronSize + dims.spacing;
    }
  }

  // 2. Icon (if provided)
  let iconElement = null;
  if (icon) {
    iconElement = penpot.createText(icon);
    if (iconElement) {
      iconElement.name = 'Node Icon';
      iconElement.x = currentX;
      iconElement.y = 0;
      iconElement.resize(dims.iconSize, dims.height);
      iconElement.fontFamily = 'Inter';
      iconElement.fontSize = dims.fontSize.toString();
      iconElement.fills = [{ fillColor: colors.icon, fillOpacity: 1 }];
      iconElement.align = 'center';
      iconElement.verticalAlign = 'center';
      currentX += dims.iconSize + dims.spacing;
    }
  }

  // 3. Label text
  const labelElement = penpot.createText(label);
  if (labelElement) {
    labelElement.name = 'Node Label';
    labelElement.x = currentX;
    labelElement.y = 0;
    labelElement.resize(textWidth, dims.height);
    labelElement.fontFamily = 'Inter';
    labelElement.fontSize = dims.fontSize.toString();
    labelElement.fills = [{ fillColor: colors.text, fillOpacity: 1 }];
    labelElement.align = 'left';
    labelElement.verticalAlign = 'center';
  }

  // 4. Selection border (for selected state)
  let borderElement = null;
  if (state === 'selected' || state === 'active') {
    borderElement = penpot.createRectangle();
    borderElement.name = 'Selection Border';
    borderElement.x = indent;
    borderElement.y = 0;
    borderElement.resize(width - indent, dims.height);
    borderElement.fills = [];
    borderElement.strokes = [{ strokeColor: colors.border, strokeOpacity: 1, strokeAlignment: 'center', strokeWidth: dims.borderWidth }];
    borderElement.borderRadius = dims.borderRadius;
  }

  // Add shapes to board (first appended = on top in Penpot)
  if (borderElement) board.appendChild(borderElement);
  if (labelElement) board.appendChild(labelElement);
  if (iconElement) board.appendChild(iconElement);
  if (chevronElement) board.appendChild(chevronElement);

  // Center the tree node on the viewport
  const viewport = penpot.viewport;
  if (viewport) {
    board.x = viewport.center.x - width / 2;
    board.y = viewport.center.y - dims.height / 2;
  }

  return board.id;
}