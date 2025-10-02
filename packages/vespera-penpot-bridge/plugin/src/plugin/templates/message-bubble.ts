/**
 * Message bubble creation using Penpot API
 */

import type { MessageBubbleConfig } from '../../shared/templates';
import { MESSAGE_BUBBLE_DIMENSIONS, MESSAGE_BUBBLE_COLORS } from '../../shared/templates';

/**
 * Create a message bubble component in Penpot
 *
 * Creates a board with:
 * - Avatar circle with initial letter
 * - Content area with message text
 * - Optional timestamp
 *
 * Supports role variants: user, assistant, system
 *
 * @param config - Configuration for the message bubble
 * @returns The ID of the created board
 */
export function createMessageBubble(config: MessageBubbleConfig): string {
  const {
    role,
    content,
    timestamp,
    avatarInitial = role.charAt(0).toUpperCase(),
    width = MESSAGE_BUBBLE_DIMENSIONS.defaultWidth,
  } = config;

  const dims = MESSAGE_BUBBLE_DIMENSIONS;
  const colors = MESSAGE_BUBBLE_COLORS[role];

  // Calculate content height (estimate based on character count and width)
  const charsPerLine = Math.floor((width - dims.avatarSize - dims.spacing * 3) / 8);
  const contentLines = Math.ceil(content.length / charsPerLine);
  const contentHeight = Math.max(32, contentLines * 18);

  // Calculate total height
  const hasTimestamp = !!timestamp;
  const timestampHeight = hasTimestamp ? dims.timestampHeight + dims.spacing / 2 : 0;
  const totalHeight = Math.max(
    dims.avatarSize + dims.padding * 2,
    contentHeight + timestampHeight + dims.padding * 2
  );

  // Create board (frame) for the message bubble
  const board = penpot.createBoard();
  board.name = `Message - ${role}`;
  board.resize(width, totalHeight);
  board.fills = [];

  // 1. Avatar circle
  const avatar = penpot.createEllipse();
  avatar.name = 'Avatar';
  avatar.x = dims.padding;
  avatar.y = dims.padding;
  avatar.resize(dims.avatarSize, dims.avatarSize);
  avatar.fills = [{ fillColor: colors.avatar, fillOpacity: 1 }];

  // 2. Avatar initial text
  const avatarText = penpot.createText(avatarInitial);
  if (avatarText) {
    avatarText.name = 'Avatar Initial';
    avatarText.x = dims.padding;
    avatarText.y = dims.padding;
    avatarText.resize(dims.avatarSize, dims.avatarSize);
    avatarText.fontFamily = 'Inter';
    avatarText.fontSize = '14';
    avatarText.fontWeight = '700';
    avatarText.fills = [{ fillColor: '#FFFFFF', fillOpacity: 1 }];
    avatarText.align = 'center';
    avatarText.verticalAlign = 'center';
  }

  // 3. Content background
  const contentBg = penpot.createRectangle();
  contentBg.name = 'Content Background';
  contentBg.x = dims.padding + dims.avatarSize + dims.spacing;
  contentBg.y = dims.padding;
  contentBg.resize(width - dims.padding * 2 - dims.avatarSize - dims.spacing, contentHeight + timestampHeight);
  contentBg.fills = [{ fillColor: colors.background, fillOpacity: 1 }];
  contentBg.borderRadius = dims.borderRadius;

  // 4. Message content text
  const contentText = penpot.createText(content);
  if (contentText) {
    contentText.name = 'Content';
    contentText.x = dims.padding + dims.avatarSize + dims.spacing + dims.padding;
    contentText.y = dims.padding + dims.padding / 2;
    contentText.resize(
      width - dims.padding * 3 - dims.avatarSize - dims.spacing,
      contentHeight - dims.padding
    );
    contentText.fontFamily = 'Inter';
    contentText.fontSize = '14';
    contentText.fontWeight = '400';
    contentText.fills = [{ fillColor: colors.text, fillOpacity: 1 }];
    contentText.verticalAlign = 'top';
  }

  // 5. Timestamp text (if provided)
  let timestampText = null;
  if (hasTimestamp) {
    timestampText = penpot.createText(timestamp);
    if (timestampText) {
      timestampText.name = 'Timestamp';
      timestampText.x = dims.padding + dims.avatarSize + dims.spacing + dims.padding;
      timestampText.y = dims.padding + contentHeight - dims.padding / 2;
      timestampText.resize(
        width - dims.padding * 3 - dims.avatarSize - dims.spacing,
        dims.timestampHeight
      );
      timestampText.fontFamily = 'Inter';
      timestampText.fontSize = '11';
      timestampText.fontWeight = '400';
      timestampText.fills = [{ fillColor: colors.timestamp, fillOpacity: 1 }];
    }
  }

  // Add shapes to board (first appended = on top in Penpot)
  if (timestampText) board.appendChild(timestampText);
  if (contentText) board.appendChild(contentText);
  board.appendChild(contentBg);
  if (avatarText) board.appendChild(avatarText);
  board.appendChild(avatar);

  // Center the message bubble on the viewport
  const viewport = penpot.viewport;
  if (viewport) {
    board.x = viewport.center.x - width / 2;
    board.y = viewport.center.y - totalHeight / 2;
  }

  return board.id;
}
