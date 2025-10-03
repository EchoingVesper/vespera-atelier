/**
 * Status indicator creation using Penpot API
 */

import type { StatusIndicatorConfig } from '../../shared/templates';
import {
  STATUS_INDICATOR_DIMENSIONS,
  CONNECTION_STATUS_COLORS,
} from '../../shared/templates';

/**
 * Create a status indicator component in Penpot
 *
 * Creates a status indicator with:
 * - Colored dot indicator
 * - Optional status text
 * - Size variants (small, medium, large)
 * - Status variants (connected, disconnected, error)
 *
 * @param config - Configuration for the status indicator
 * @returns The ID of the created board
 */
export function createStatusIndicator(config: StatusIndicatorConfig): string {
  const {
    status = 'connected',
    size = 'medium',
    showText = true,
    label,
  } = config;

  const dims = STATUS_INDICATOR_DIMENSIONS[size];
  const statusColors = CONNECTION_STATUS_COLORS[status];

  // Determine status text
  const statusText = label || status.charAt(0).toUpperCase() + status.slice(1);

  // Calculate width based on whether we show text
  const textWidth = showText ? statusText.length * 7 + 8 : 0; // Rough estimation
  const width = dims.indicatorSize + dims.spacing + textWidth;

  // Create board (frame) for the status indicator
  const board = penpot.createBoard();
  board.name = 'Status Indicator';
  board.resize(width, dims.height);
  board.fills = [];

  // 1. Status indicator (circle)
  const indicator = penpot.createEllipse();
  indicator.name = 'Status Indicator';
  indicator.x = 0;
  indicator.y = (dims.height - dims.indicatorSize) / 2;
  indicator.resize(dims.indicatorSize, dims.indicatorSize);
  indicator.fills = [{ fillColor: statusColors.indicator, fillOpacity: 1 }];

  // 2. Optional status text
  let statusTextElement = null;
  if (showText && textWidth > 0) {
    statusTextElement = penpot.createText(statusText);
    if (statusTextElement) {
      statusTextElement.name = 'Status Text';
      statusTextElement.x = dims.indicatorSize + dims.spacing;
      statusTextElement.y = 0;
      statusTextElement.resize(textWidth, dims.height);
      statusTextElement.fontFamily = 'Inter';
      statusTextElement.fontSize = dims.fontSize.toString();
      statusTextElement.fontWeight = '500';
      statusTextElement.fills = [{ fillColor: statusColors.text, fillOpacity: 1 }];
      statusTextElement.align = 'left';
      statusTextElement.verticalAlign = 'center';
    }
  }

  // Add shapes to board (first appended = on top in Penpot)
  if (statusTextElement) board.appendChild(statusTextElement);
  board.appendChild(indicator);

  // Center the status indicator on the viewport
  const viewport = penpot.viewport;
  if (viewport) {
    board.x = viewport.center.x - width / 2;
    board.y = viewport.center.y - dims.height / 2;
  }

  return board.id;
}