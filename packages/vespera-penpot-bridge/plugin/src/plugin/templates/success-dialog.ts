/**
 * Success dialog creation using Penpot API
 */

import type { SuccessDialogConfig } from '../../shared/templates';
import { SUCCESS_DIALOG_DIMENSIONS, SEVERITY_COLORS } from '../../shared/templates';

/**
 * Create a success dialog component in Penpot
 *
 * Creates a board with:
 * - Background rectangle with success theme
 * - Title text
 * - Message text
 * - Checkmark icon
 * - OK button (if dismissible)
 * - Close X button (if dismissible)
 *
 * @param config - Configuration for the success dialog
 * @returns The ID of the created board
 */
export function createSuccessDialog(config: SuccessDialogConfig): string {
  const { title, message, dismissible } = config;
  const colors = SEVERITY_COLORS.success;
  const dims = SUCCESS_DIALOG_DIMENSIONS;

  // Create board (frame) for the dialog
  const board = penpot.createBoard();
  board.name = `Success Dialog - ${title}`;
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

  // 2. Checkmark icon
  const checkmark = penpot.createText('✓');
  if (checkmark) {
    checkmark.name = 'Checkmark';
    checkmark.x = dims.padding;
    checkmark.y = dims.padding;
    checkmark.resize(32, 32);
    checkmark.fontFamily = 'Inter';
    checkmark.fontSize = '24';
    checkmark.fontWeight = '700';
    checkmark.fills = [{ fillColor: colors.icon, fillOpacity: 1 }];
    checkmark.align = 'center';
    checkmark.verticalAlign = 'center';
  }

  // 3. Title text (positioned to the right of checkmark)
  const titleText = penpot.createText(title);
  if (titleText) {
    titleText.name = 'Title';
    titleText.x = dims.padding + 40;
    titleText.y = dims.padding;
    titleText.resize(dims.width - dims.padding * 2 - 40, 30);
    titleText.fontFamily = 'Inter';
    titleText.fontSize = '18';
    titleText.fontWeight = '700';
    titleText.fills = [{ fillColor: colors.text, fillOpacity: 1 }];
  }

  // 4. Message text
  const messageText = penpot.createText(message);
  if (messageText) {
    messageText.name = 'Message';
    messageText.x = dims.padding;
    messageText.y = dims.padding + 50;
    messageText.resize(dims.width - dims.padding * 2, 80);
    messageText.fontFamily = 'Inter';
    messageText.fontSize = '14';
    messageText.fontWeight = '400';
    messageText.fills = [{ fillColor: colors.text, fillOpacity: 1 }];
  }

  // 5. Create button elements if dismissible
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
    const closeX = dims.width - dims.padding - 24;
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
  if (checkmark) board.appendChild(checkmark);

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
