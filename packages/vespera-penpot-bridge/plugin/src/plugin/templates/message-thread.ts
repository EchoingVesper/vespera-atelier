/**
 * Message Thread creation using Penpot API
 */

import type { MessageThreadConfig, MessageEntry } from '../../shared/templates';
import {
  MESSAGE_THREAD_DIMENSIONS,
  MESSAGE_THREAD_COLORS,
  MESSAGE_BUBBLE_DIMENSIONS,
  MESSAGE_BUBBLE_COLORS,
} from '../../shared/templates';

/**
 * Create a message thread component in Penpot
 *
 * Creates a thread with:
 * - Stacked message bubbles (user/assistant/system)
 * - Optional date separator
 * - Optional typing indicator
 * - Optional scroll-to-bottom button
 * - Proper spacing and alignment
 *
 * @param config - Configuration for the message thread
 * @returns The ID of the created board
 */
export function createMessageThread(config: MessageThreadConfig): string {
  const {
    messages = [
      { role: 'user', content: 'How can I help you today?' },
      { role: 'assistant', content: 'I\'m here to assist you with your creative projects and tasks.' },
      { role: 'user', content: 'Great! I need some ideas for my next novel.' },
    ],
    showDateSeparator = true,
    dateLabel = 'Today',
    showTypingIndicator = false,
    showScrollButton = true,
    width = MESSAGE_THREAD_DIMENSIONS.defaultWidth,
    height = MESSAGE_THREAD_DIMENSIONS.defaultHeight,
  } = config;

  const dims = MESSAGE_THREAD_DIMENSIONS;
  const colors = MESSAGE_THREAD_COLORS;

  // Create board (frame) for the message thread
  const board = penpot.createBoard();
  board.name = 'Message Thread';
  board.resize(width, height);

  // Create background
  const background = penpot.createRectangle();
  background.name = 'Thread Background';
  background.x = 0;
  background.y = 0;
  background.resize(width, height);
  background.fills = [{ fillColor: colors.background, fillOpacity: 1 }];
  background.borderRadius = dims.borderRadius;
  background.strokes = [{ strokeColor: colors.border, strokeOpacity: 1, strokeAlignment: 'center', strokeWidth: dims.borderWidth }];

  let currentY = dims.padding;

  // 1. Date separator (if enabled)
  let dateSeparatorElement = null;
  if (showDateSeparator) {
    // Date background
    const dateBg = penpot.createRectangle();
    dateBg.name = 'Date Separator Background';
    dateBg.x = (width - 120) / 2; // Center the date separator
    dateBg.y = currentY;
    dateBg.resize(120, dims.dateSeparatorHeight);
    dateBg.fills = [{ fillColor: colors.dateBackground, fillOpacity: 1 }];
    dateBg.borderRadius = dims.dateSeparatorHeight / 2;

    // Date text
    dateSeparatorElement = penpot.createText(dateLabel);
    if (dateSeparatorElement) {
      dateSeparatorElement.name = 'Date Label';
      dateSeparatorElement.x = (width - 120) / 2;
      dateSeparatorElement.y = currentY;
      dateSeparatorElement.resize(120, dims.dateSeparatorHeight);
      dateSeparatorElement.fontFamily = 'Inter';
      dateSeparatorElement.fontSize = '12';
      dateSeparatorElement.fontWeight = '600';
      dateSeparatorElement.fills = [{ fillColor: colors.dateSeparator, fillOpacity: 1 }];
      dateSeparatorElement.align = 'center';
      dateSeparatorElement.verticalAlign = 'center';
    }

    currentY += dims.dateSeparatorHeight + dims.spacing;
  }

  // 2. Message bubbles
  const messageBubbles: any[] = [];
  const availableMessageWidth = width - dims.padding * 2;

  messages.forEach((message: MessageEntry) => {
    const messageWidth = Math.min(availableMessageWidth, MESSAGE_BUBBLE_DIMENSIONS.defaultWidth);

    // Calculate message height based on content length
    const charsPerLine = Math.floor((messageWidth - MESSAGE_BUBBLE_DIMENSIONS.avatarSize - dims.spacing - dims.padding * 3) / 6);
    const contentLines = Math.ceil(message.content.length / charsPerLine);
    const contentHeight = Math.max(40, contentLines * 20);
    const hasTimestamp = !!message.timestamp;
    const timestampHeight = hasTimestamp ? MESSAGE_BUBBLE_DIMENSIONS.timestampHeight + dims.spacing / 2 : 0;
    const messageHeight = Math.max(
      MESSAGE_BUBBLE_DIMENSIONS.avatarSize + dims.padding * 2,
      contentHeight + timestampHeight + dims.padding * 2
    );

    // Create message bubble board
    const messageBoard = penpot.createBoard();
    messageBoard.name = `Message - ${message.role}`;
    messageBoard.resize(messageWidth, messageHeight);
    messageBoard.x = dims.padding;
    messageBoard.y = currentY;

    const bubbleColors = MESSAGE_BUBBLE_COLORS[message.role];
    const bubbleDims = MESSAGE_BUBBLE_DIMENSIONS;

    // Avatar
    const avatar = penpot.createEllipse();
    avatar.name = 'Avatar';
    avatar.x = dims.padding;
    avatar.y = dims.padding;
    avatar.resize(bubbleDims.avatarSize, bubbleDims.avatarSize);
    avatar.fills = [{ fillColor: bubbleColors.avatar, fillOpacity: 1 }];

    const initial = message.avatarInitial ?? message.role.charAt(0).toUpperCase();
    const avatarText = penpot.createText(initial);
    if (avatarText) {
      avatarText.name = 'Avatar Initial';
      avatarText.x = dims.padding;
      avatarText.y = dims.padding;
      avatarText.resize(bubbleDims.avatarSize, bubbleDims.avatarSize);
      avatarText.fontFamily = 'Inter';
      avatarText.fontSize = '14';
      avatarText.fontWeight = '700';
      avatarText.fills = [{ fillColor: '#FFFFFF', fillOpacity: 1 }];
      avatarText.align = 'center';
      avatarText.verticalAlign = 'center';
    }

    // Content background
    const availableTextWidth = messageWidth - bubbleDims.avatarSize - dims.spacing - dims.padding * 3;
    const contentBg = penpot.createRectangle();
    contentBg.name = 'Content Background';
    contentBg.x = dims.padding + bubbleDims.avatarSize + dims.spacing;
    contentBg.y = dims.padding;
    contentBg.resize(availableTextWidth + dims.padding * 2, contentHeight + timestampHeight);
    contentBg.fills = [{ fillColor: bubbleColors.background, fillOpacity: 1 }];
    contentBg.borderRadius = dims.borderRadius;

    // Content text
    const contentText = penpot.createText(message.content);
    if (contentText) {
      contentText.name = 'Content';
      contentText.x = dims.padding + bubbleDims.avatarSize + dims.spacing + dims.padding;
      contentText.y = dims.padding + dims.padding / 2;
      contentText.resize(availableTextWidth - dims.padding, contentHeight - dims.padding);
      contentText.fontFamily = 'Inter';
      contentText.fontSize = '14';
      contentText.fontWeight = '400';
      contentText.fills = [{ fillColor: bubbleColors.text, fillOpacity: 1 }];
      contentText.verticalAlign = 'top';
    }

    // Timestamp (if provided)
    let timestampElement = null;
    if (hasTimestamp) {
      timestampElement = penpot.createText(message.timestamp!);
      if (timestampElement) {
        timestampElement.name = 'Timestamp';
        timestampElement.x = dims.padding + bubbleDims.avatarSize + dims.spacing + dims.padding;
        timestampElement.y = dims.padding + contentHeight - dims.padding / 2;
        timestampElement.resize(availableTextWidth - dims.padding, bubbleDims.timestampHeight);
        timestampElement.fontFamily = 'Inter';
        timestampElement.fontSize = '11';
        timestampElement.fontWeight = '400';
        timestampElement.fills = [{ fillColor: bubbleColors.timestamp, fillOpacity: 1 }];
      }
    }

    // Add elements to message board (first appended = on top)
    if (timestampElement) messageBoard.appendChild(timestampElement);
    if (contentText) messageBoard.appendChild(contentText);
    messageBoard.appendChild(contentBg);
    if (avatarText) messageBoard.appendChild(avatarText);
    messageBoard.appendChild(avatar);

    messageBubbles.push(messageBoard);
    currentY += messageHeight + dims.messageSpacing;
  });

  // 3. Typing indicator (if enabled)
  let typingIndicatorElement = null;
  if (showTypingIndicator) {
    const typingY = height - dims.padding - dims.typingIndicatorHeight - (showScrollButton ? dims.scrollButtonSize + dims.scrollButtonMargin : 0);

    // Typing background
    const typingBg = penpot.createRectangle();
    typingBg.name = 'Typing Indicator Background';
    typingBg.x = dims.padding + MESSAGE_BUBBLE_DIMENSIONS.avatarSize + dims.spacing;
    typingBg.y = typingY;
    typingBg.resize(60, dims.typingIndicatorHeight);
    typingBg.fills = [{ fillColor: MESSAGE_BUBBLE_COLORS.assistant.background, fillOpacity: 1 }];
    typingBg.borderRadius = dims.borderRadius;

    // Typing dots animation (static dots for now)
    const typingDots = penpot.createText('...');
    if (typingDots) {
      typingDots.name = 'Typing Dots';
      typingDots.x = dims.padding + MESSAGE_BUBBLE_DIMENSIONS.avatarSize + dims.spacing + dims.padding;
      typingDots.y = typingY;
      typingDots.resize(60, dims.typingIndicatorHeight);
      typingDots.fontFamily = 'Inter';
      typingDots.fontSize = '14';
      typingDots.fontWeight = '400';
      typingDots.fills = [{ fillColor: MESSAGE_BUBBLE_COLORS.assistant.text, fillOpacity: 1 }];
      typingDots.align = 'center';
      typingDots.verticalAlign = 'center';
    }

    typingIndicatorElement = { background: typingBg, dots: typingDots };
  }

  // 4. Scroll-to-bottom button (if enabled)
  let scrollButtonElement = null;
  if (showScrollButton) {
    const scrollX = width - dims.padding - dims.scrollButtonSize - dims.scrollButtonMargin;
    const scrollY = height - dims.padding - dims.scrollButtonSize - dims.scrollButtonMargin;

    // Scroll button background
    const scrollBg = penpot.createEllipse();
    scrollBg.name = 'Scroll Button Background';
    scrollBg.x = scrollX;
    scrollBg.y = scrollY;
    scrollBg.resize(dims.scrollButtonSize, dims.scrollButtonSize);
    scrollBg.fills = [{ fillColor: colors.scrollButton, fillOpacity: 1 }];
    scrollBg.strokes = [{ strokeColor: colors.scrollButton, strokeOpacity: 0.3, strokeAlignment: 'center', strokeWidth: 1 }];

    // Scroll arrow
    const scrollArrow = penpot.createText('↓');
    if (scrollArrow) {
      scrollArrow.name = 'Scroll Arrow';
      scrollArrow.x = scrollX;
      scrollArrow.y = scrollY;
      scrollArrow.resize(dims.scrollButtonSize, dims.scrollButtonSize);
      scrollArrow.fontFamily = 'Inter';
      scrollArrow.fontSize = '16';
      scrollArrow.fontWeight = '600';
      scrollArrow.fills = [{ fillColor: '#FFFFFF', fillOpacity: 1 }];
      scrollArrow.align = 'center';
      scrollArrow.verticalAlign = 'center';
    }

    scrollButtonElement = { background: scrollBg, arrow: scrollArrow };
  }

  // Add all elements to main board (first appended = on top)
  if (scrollButtonElement) {
    if (scrollButtonElement.arrow) board.appendChild(scrollButtonElement.arrow);
    board.appendChild(scrollButtonElement.background);
  }

  if (typingIndicatorElement) {
    if (typingIndicatorElement.dots) board.appendChild(typingIndicatorElement.dots);
    board.appendChild(typingIndicatorElement.background);
  }

  // Add message bubbles (in reverse order so first message is on top)
  messageBubbles.reverse().forEach(messageBoard => {
    board.appendChild(messageBoard);
  });

  if (dateSeparatorElement) board.appendChild(dateSeparatorElement);
  board.appendChild(background);

  // Center the message thread on the viewport
  const viewport = penpot.viewport;
  if (viewport) {
    board.x = viewport.center.x - width / 2;
    board.y = viewport.center.y - height / 2;
  }

  return board.id;
}