/**
 * Error dialog creation using Penpot API
 */

import type { ErrorDialogConfig } from '../../shared/templates';
import { ERROR_DIALOG_DIMENSIONS, SEVERITY_COLORS } from '../../shared/templates';

/**
 * Create an error dialog component in Penpot
 *
 * Creates a board with:
 * - Background rectangle with border
 * - Title text
 * - Message text
 * - OK button (if dismissible)
 * - Close X button (if dismissible)
 *
 * @param config - Configuration for the error dialog
 * @returns The ID of the created board
 */
export function createErrorDialog(config: ErrorDialogConfig): string {
  const { title, message, severity, dismissible } = config;
  const colors = SEVERITY_COLORS[severity];
  const dims = ERROR_DIALOG_DIMENSIONS;

  // Create board (frame) for the dialog
  const board = penpot.createBoard();
  board.name = `Error Dialog - ${title}`;
  board.resize(dims.width, dims.height);

  // Create all elements first (don't append yet)

  // 1. Background rectangle
  const background = penpot.createRectangle();
  background.name = 'Background';
  background.resize(dims.width, dims.height);
  background.x = 0;
  background.y = 0;
  background.fills = [{ fillColor: colors.background, fillOpacity: 1 }];
  background.strokes = [
    {
      strokeColor: colors.border,
      strokeWidth: dims.borderWidth,
      strokeAlignment: 'inner',
    },
  ];
  background.borderRadius = dims.borderRadius;

  // 2. Title text
  const titleText = penpot.createText(title);
  if (titleText) {
    titleText.name = 'Title';
    titleText.x = dims.padding;
    titleText.y = dims.padding;
    titleText.resize(dims.width - dims.padding * 2, 30);
    titleText.fontFamily = 'Inter';
    titleText.fontSize = '18';
    titleText.fontWeight = '700';
    titleText.fills = [{ fillColor: colors.text, fillOpacity: 1 }];
  }

  // 3. Message text
  const messageText = penpot.createText(message);
  if (messageText) {
    messageText.name = 'Message';
    messageText.x = dims.padding;
    messageText.y = dims.padding + 40;
    messageText.resize(dims.width - dims.padding * 2, 120);
    messageText.fontFamily = 'Inter';
    messageText.fontSize = '14';
    messageText.fontWeight = '400';
    messageText.fills = [{ fillColor: colors.text, fillOpacity: 1 }];
  }

  // 4. Create button elements if dismissible
  let buttonBg = null;
  let buttonText = null;
  let closeButton = null;

  if (dismissible) {
    const buttonWidth = 80;
    const buttonHeight = 36;
    const buttonY = dims.height - dims.padding - buttonHeight;
    const buttonX = dims.width - dims.padding - buttonWidth;

    // Button background
    buttonBg = penpot.createRectangle();
    buttonBg.name = 'OK Button Background';
    buttonBg.x = buttonX;
    buttonBg.y = buttonY;
    buttonBg.resize(buttonWidth, buttonHeight);
    buttonBg.fills = [{ fillColor: colors.border, fillOpacity: 1 }];
    buttonBg.borderRadius = 4;

    // Button text
    buttonText = penpot.createText('OK');
    if (buttonText) {
      buttonText.name = 'OK Button Text';
      buttonText.x = buttonX;
      buttonText.y = buttonY;
      buttonText.resize(buttonWidth, buttonHeight);
      buttonText.fontFamily = 'Inter';
      buttonText.fontSize = '14';
      buttonText.fontWeight = '600';
      buttonText.fills = [{ fillColor: '#FFFFFF', fillOpacity: 1 }];
      buttonText.align = 'center';
      buttonText.verticalAlign = 'center';
    }

    // Close X button in top-right corner
    const closeX = dims.width - dims.padding - 24; // Right edge minus padding minus button width
    const closeY = dims.padding;

    closeButton = penpot.createText('✕');
    if (closeButton) {
      closeButton.name = 'Close Button';
      closeButton.x = closeX;
      closeButton.y = closeY;
      closeButton.resize(24, 24);
      closeButton.fontFamily = 'Inter';
      closeButton.fontSize = '18';
      closeButton.fontWeight = '400';
      closeButton.fills = [{ fillColor: colors.text, fillOpacity: 0.6 }];
      closeButton.align = 'center';
      closeButton.verticalAlign = 'center';
    }
  }

  // Append in REVERSE order (Penpot: first appended = on top)
  // We want: background at back, then text, then buttons on top

  // Append buttons first (so they're on top)
  if (closeButton) board.appendChild(closeButton);
  if (buttonText) board.appendChild(buttonText);
  if (buttonBg) board.appendChild(buttonBg);

  // Then message and title
  if (messageText) board.appendChild(messageText);
  if (titleText) board.appendChild(titleText);

  // Background last (so it's at the back)
  board.appendChild(background);

  // Center the dialog on the viewport
  const viewport = penpot.viewport;
  if (viewport) {
    board.x = viewport.center.x - dims.width / 2;
    board.y = viewport.center.y - dims.height / 2;
  }

  return board.id;
}

/**
 * Validate error dialog configuration
 *
 * @param config - Configuration to validate
 * @returns Error message if invalid, null if valid
 */
export function validateErrorDialogConfig(
  config: Partial<ErrorDialogConfig>
): string | null {
  if (!config.title || config.title.trim().length === 0) {
    return 'Title is required';
  }

  if (!config.message || config.message.trim().length === 0) {
    return 'Message is required';
  }

  if (!config.severity || !['error', 'warning', 'info', 'success'].includes(config.severity)) {
    return 'Invalid severity (must be error, warning, info, or success)';
  }

  if (config.title.length > 50) {
    return 'Title must be 50 characters or less';
  }

  if (config.message.length > 200) {
    return 'Message must be 200 characters or less';
  }

  return null;
}