/**
 * Chat Window Layout creation using Penpot API
 */

import type { ChatWindowLayoutConfig } from '../../shared/templates';
import {
  LAYOUT_DIMENSIONS,
  LAYOUT_COLORS,
} from '../../shared/templates';

/**
 * Create a chat window layout component in Penpot
 *
 * Creates a comprehensive chat interface with:
 * - Message area with scroll indicators
 * - Input field with send button
 * - Provider selector integration
 * - Settings flyout panel
 * - Proper message flow and typing indicators
 *
 * @param config - Configuration for the chat window layout
 * @returns The ID of the created board
 */
export function createChatWindowLayout(config: ChatWindowLayoutConfig): string {
  const {
    inputAreaHeight = LAYOUT_DIMENSIONS.chatWindowDefault.inputAreaHeight,
    showProviderSelector = true,
    showSettingsPanel = true,
    totalWidth = LAYOUT_DIMENSIONS.chatWindowDefault.totalWidth,
    totalHeight = LAYOUT_DIMENSIONS.chatWindowDefault.totalHeight,
  } = config;

  const dims = LAYOUT_DIMENSIONS.chatWindowDefault;
  const colors = LAYOUT_COLORS;

  // Calculate dimensions
  const providerSelectorHeight = showProviderSelector ? dims.providerSelectorHeight : 0;
  const settingsPanelWidth = showSettingsPanel ? dims.settingsPanelWidth : 0;
  const chatAreaWidth = totalWidth - settingsPanelWidth;
  const actualMessageHeight = totalHeight - inputAreaHeight - providerSelectorHeight;

  // Create main board
  const board = penpot.createBoard();
  board.name = 'Chat Window Layout';
  board.resize(totalWidth, totalHeight);

  // Main background
  const background = penpot.createRectangle();
  background.name = 'Background';
  background.x = 0;
  background.y = 0;
  background.resize(totalWidth, totalHeight);
  background.fills = [{ fillColor: colors.background, fillOpacity: 1 }];
  background.borderRadius = dims.borderRadius;

  // Chat area background
  const chatAreaBg = penpot.createRectangle();
  chatAreaBg.name = 'Chat Area Background';
  chatAreaBg.x = 0;
  chatAreaBg.y = 0;
  chatAreaBg.resize(chatAreaWidth, totalHeight);
  chatAreaBg.fills = [{ fillColor: colors.panelBackground, fillOpacity: 1 }];
  chatAreaBg.borderRadius = dims.borderRadius;
  chatAreaBg.strokes = [{ strokeColor: colors.panelBorder, strokeAlignment: 'center', strokeWidth: dims.borderWidth }];

  let currentY = 0;

  // 1. Provider Selector (if enabled)
  if (showProviderSelector) {
    // Provider selector background
    const providerBg = penpot.createRectangle();
    providerBg.name = 'Provider Selector Background';
    providerBg.x = 0;
    providerBg.y = currentY;
    providerBg.resize(chatAreaWidth, dims.providerSelectorHeight);
    providerBg.fills = [{ fillColor: colors.panelBackground, fillOpacity: 1 }];
    providerBg.strokes = [{ strokeColor: colors.panelBorder, strokeAlignment: 'center', strokeWidth: dims.borderWidth }];

    // Provider icon (circle)
    const providerIcon = penpot.createEllipse();
    providerIcon.name = 'Provider Icon';
    providerIcon.x = dims.panelPadding;
    providerIcon.y = currentY + (dims.providerSelectorHeight - dims.providerSelectorHeight) / 2 + 12;
    providerIcon.resize(dims.providerSelectorHeight - 24, dims.providerSelectorHeight - 24);
    providerIcon.fills = [{ fillColor: '#3B82F6', fillOpacity: 1 }];

    // Provider initial
    const providerInitial = penpot.createText('C');
    if (providerInitial) {
      providerInitial.name = 'Provider Initial';
      providerInitial.x = dims.panelPadding;
      providerInitial.y = currentY + (dims.providerSelectorHeight - dims.providerSelectorHeight) / 2 + 12;
      providerInitial.resize(dims.providerSelectorHeight - 24, dims.providerSelectorHeight - 24);
      providerInitial.fontFamily = 'Inter';
      providerInitial.fontSize = '14';
      providerInitial.fontWeight = '700';
      providerInitial.fills = [{ fillColor: '#FFFFFF', fillOpacity: 1 }];
      providerInitial.align = 'center';
      providerInitial.verticalAlign = 'center';
    }

    // Provider name
    const providerName = penpot.createText('Claude');
    if (providerName) {
      providerName.name = 'Provider Name';
      providerName.x = dims.panelPadding + dims.providerSelectorHeight - 24 + dims.panelPadding;
      providerName.y = currentY;
      providerName.resize(100, dims.providerSelectorHeight);
      providerName.fontFamily = 'Inter';
      providerName.fontSize = '14';
      providerName.fontWeight = '600';
      providerName.fills = [{ fillColor: colors.panelTitle, fillOpacity: 1 }];
      providerName.align = 'left';
      providerName.verticalAlign = 'center';
    }

    // Status indicator (connected)
    const statusIndicator = penpot.createEllipse();
    statusIndicator.name = 'Status Indicator';
    statusIndicator.x = dims.panelPadding + dims.providerSelectorHeight - 24 + dims.panelPadding + 100 + dims.panelPadding;
    statusIndicator.y = currentY + (dims.providerSelectorHeight - 16) / 2;
    statusIndicator.resize(16, 16);
    statusIndicator.fills = [{ fillColor: '#10B981', fillOpacity: 1 }];

    // Status text
    const statusText = penpot.createText('Connected');
    if (statusText) {
      statusText.name = 'Status Text';
      statusText.x = dims.panelPadding + dims.providerSelectorHeight - 24 + dims.panelPadding + 100 + dims.panelPadding + 20 + dims.panelPadding;
      statusText.y = currentY;
      statusText.resize(80, dims.providerSelectorHeight);
      statusText.fontFamily = 'Inter';
      statusText.fontSize = '12';
      statusText.fontWeight = '400';
      statusText.fills = [{ fillColor: colors.panelSubtitle, fillOpacity: 1 }];
      statusText.align = 'left';
      statusText.verticalAlign = 'center';
    }

    // Dropdown chevron
    const chevron = penpot.createText('▼');
    if (chevron) {
      chevron.name = 'Dropdown Chevron';
      chevron.x = chatAreaWidth - dims.panelPadding - 16;
      chevron.y = currentY;
      chevron.resize(16, dims.providerSelectorHeight);
      chevron.fontFamily = 'Inter';
      chevron.fontSize = '10';
      chevron.fills = [{ fillColor: colors.panelSubtitle, fillOpacity: 1 }];
      chevron.align = 'center';
      chevron.verticalAlign = 'center';
    }

    board.appendChild(providerBg);
    board.appendChild(providerIcon);
    if (providerInitial) board.appendChild(providerInitial);
    if (providerName) board.appendChild(providerName);
    board.appendChild(statusIndicator);
    if (statusText) board.appendChild(statusText);
    if (chevron) board.appendChild(chevron);
  }

  currentY += providerSelectorHeight;

  // 2. Message Area
  // Message area background
  const messageAreaBg = penpot.createRectangle();
  messageAreaBg.name = 'Message Area Background';
  messageAreaBg.x = 0;
  messageAreaBg.y = currentY;
  messageAreaBg.resize(chatAreaWidth, actualMessageHeight);
  messageAreaBg.fills = [{ fillColor: colors.panelBackground, fillOpacity: 1 }];

  // Sample messages (for demonstration)
  const sampleMessages = [
    { role: 'user', content: 'Hello! Can you help me with something?' },
    { role: 'assistant', content: 'Of course! I\'m here to help you with your creative projects and tasks.' },
    { role: 'user', content: 'Great! I need some ideas for my next novel.' },
    { role: 'assistant', content: 'I\'d be happy to help you brainstorm ideas for your novel. What genre are you considering, and what themes interest you?' },
  ];

  let messageY = currentY + dims.panelPadding;

  sampleMessages.forEach((message) => {
    const isUser = message.role === 'user';
    const messageWidth = Math.min(chatAreaWidth - dims.panelPadding * 2 - 40, 400);

    // Calculate message position (user on right, assistant on left)
    const messageX = isUser
      ? chatAreaWidth - dims.panelPadding - messageWidth
      : dims.panelPadding + 40;

    // Avatar circle
    const avatar = penpot.createEllipse();
    avatar.name = `Avatar - ${message.role}`;
    avatar.x = isUser ? chatAreaWidth - dims.panelPadding - 32 : dims.panelPadding;
    avatar.y = messageY;
    avatar.resize(32, 32);
    avatar.fills = [{ fillColor: isUser ? '#3B82F6' : '#F3F4F6', fillOpacity: 1 }];

    // Avatar initial
    const avatarInitial = penpot.createText(isUser ? 'U' : 'A');
    if (avatarInitial) {
      avatarInitial.name = `Avatar Initial - ${message.role}`;
      avatarInitial.x = isUser ? chatAreaWidth - dims.panelPadding - 32 : dims.panelPadding;
      avatarInitial.y = messageY;
      avatarInitial.resize(32, 32);
      avatarInitial.fontFamily = 'Inter';
      avatarInitial.fontSize = '12';
      avatarInitial.fontWeight = '700';
      avatarInitial.fills = [{ fillColor: isUser ? '#FFFFFF' : '#6B7280', fillOpacity: 1 }];
      avatarInitial.align = 'center';
      avatarInitial.verticalAlign = 'center';
    }

    // Message bubble background
    const bubbleHeight = 60;
    const messageBubble = penpot.createRectangle();
    messageBubble.name = `Message Bubble - ${message.role}`;
    messageBubble.x = messageX;
    messageBubble.y = messageY;
    messageBubble.resize(messageWidth, bubbleHeight);
    messageBubble.fills = [{ fillColor: isUser ? '#3B82F6' : '#F3F4F6', fillOpacity: 1 }];
    messageBubble.borderRadius = 12;

    // Message text (truncated for demo)
    const messageText = penpot.createText(message.content.length > 40 ? message.content.substring(0, 40) + '...' : message.content);
    if (messageText) {
      messageText.name = `Message Text - ${message.role}`;
      messageText.x = messageX + dims.panelPadding;
      messageText.y = messageY + dims.panelPadding;
      messageText.resize(messageWidth - dims.panelPadding * 2, bubbleHeight - dims.panelPadding * 2);
      messageText.fontFamily = 'Inter';
      messageText.fontSize = '12';
      messageText.fontWeight = '400';
      messageText.fills = [{ fillColor: isUser ? '#FFFFFF' : '#111827', fillOpacity: 1 }];
      messageText.align = 'left';
      messageText.verticalAlign = 'top';
    }

    board.appendChild(messageBubble);
    if (messageText) board.appendChild(messageText);
    board.appendChild(avatar);
    if (avatarInitial) board.appendChild(avatarInitial);

    messageY += bubbleHeight + dims.panelPadding;
  });

  // Scroll indicator (dots at bottom)
  const scrollIndicator = penpot.createEllipse();
  scrollIndicator.name = 'Scroll Indicator';
  scrollIndicator.x = chatAreaWidth - dims.panelPadding - 8;
  scrollIndicator.y = currentY + actualMessageHeight - 20;
  scrollIndicator.resize(8, 8);
  scrollIndicator.fills = [{ fillColor: colors.scrollMarker, fillOpacity: 1 }];

  // Typing indicator (bottom of message area)
  const typingBg = penpot.createRectangle();
  typingBg.name = 'Typing Indicator Background';
  typingBg.x = dims.panelPadding + 40;
  typingBg.y = currentY + actualMessageHeight - 50;
  typingBg.resize(80, 30);
  typingBg.fills = [{ fillColor: '#F3F4F6', fillOpacity: 1 }];
  typingBg.borderRadius = 15;

  const typingDots = penpot.createText('...');
  if (typingDots) {
    typingDots.name = 'Typing Dots';
    typingDots.x = dims.panelPadding + 40;
    typingDots.y = currentY + actualMessageHeight - 50;
    typingDots.resize(80, 30);
    typingDots.fontFamily = 'Inter';
    typingDots.fontSize = '14';
    typingDots.fontWeight = '400';
    typingDots.fills = [{ fillColor: '#6B7280', fillOpacity: 1 }];
    typingDots.align = 'center';
    typingDots.verticalAlign = 'center';
  }

  board.appendChild(messageAreaBg);
  board.appendChild(typingBg);
  if (typingDots) board.appendChild(typingDots);
  board.appendChild(scrollIndicator);

  currentY += actualMessageHeight;

  // 3. Input Area
  // Input area background
  const inputAreaBg = penpot.createRectangle();
  inputAreaBg.name = 'Input Area Background';
  inputAreaBg.x = 0;
  inputAreaBg.y = currentY;
  inputAreaBg.resize(chatAreaWidth, inputAreaHeight);
  inputAreaBg.fills = [{ fillColor: colors.panelBackground, fillOpacity: 1 }];
  inputAreaBg.strokes = [{ strokeColor: colors.panelBorder, strokeAlignment: 'center', strokeWidth: dims.borderWidth }];

  // Input field background
  const inputFieldBg = penpot.createRectangle();
  inputFieldBg.name = 'Input Field Background';
  inputFieldBg.x = dims.panelPadding;
  inputFieldBg.y = currentY + (inputAreaHeight - dims.inputFieldHeight) / 2;
  inputFieldBg.resize(chatAreaWidth - dims.panelPadding * 2 - dims.sendButtonSize - dims.panelPadding, dims.inputFieldHeight);
  inputFieldBg.fills = [{ fillColor: colors.panelBackground, fillOpacity: 1 }];
  inputFieldBg.strokes = [{ strokeColor: colors.panelBorder, strokeAlignment: 'center', strokeWidth: 1 }];
  inputFieldBg.borderRadius = dims.inputFieldHeight / 2;

  // Placeholder text
  const placeholder = penpot.createText('Type your message...');
  if (placeholder) {
    placeholder.name = 'Input Placeholder';
    placeholder.x = dims.panelPadding + dims.panelPadding;
    placeholder.y = currentY + (inputAreaHeight - dims.inputFieldHeight) / 2;
    placeholder.resize(chatAreaWidth - dims.panelPadding * 4 - dims.sendButtonSize - dims.panelPadding, dims.inputFieldHeight);
    placeholder.fontFamily = 'Inter';
    placeholder.fontSize = '14';
    placeholder.fontWeight = '400';
    placeholder.fills = [{ fillColor: colors.panelSubtitle, fillOpacity: 1 }];
    placeholder.align = 'left';
    placeholder.verticalAlign = 'center';
  }

  // Send button
  const sendButtonX = chatAreaWidth - dims.sendButtonSize - dims.panelPadding;
  const sendButton = penpot.createEllipse();
  sendButton.name = 'Send Button';
  sendButton.x = sendButtonX;
  sendButton.y = currentY + (inputAreaHeight - dims.sendButtonSize) / 2;
  sendButton.resize(dims.sendButtonSize, dims.sendButtonSize);
  sendButton.fills = [{ fillColor: '#3B82F6', fillOpacity: 1 }];

  // Send arrow
  const sendArrow = penpot.createText('↑');
  if (sendArrow) {
    sendArrow.name = 'Send Arrow';
    sendArrow.x = sendButtonX;
    sendArrow.y = currentY + (inputAreaHeight - dims.sendButtonSize) / 2;
    sendArrow.resize(dims.sendButtonSize, dims.sendButtonSize);
    sendArrow.fontFamily = 'Inter';
    sendArrow.fontSize = '16';
    sendArrow.fontWeight = '600';
    sendArrow.fills = [{ fillColor: '#FFFFFF', fillOpacity: 1 }];
    sendArrow.align = 'center';
    sendArrow.verticalAlign = 'center';
  }

  board.appendChild(inputAreaBg);
  board.appendChild(inputFieldBg);
  if (placeholder) board.appendChild(placeholder);
  board.appendChild(sendButton);
  if (sendArrow) board.appendChild(sendArrow);

  // 4. Settings Panel (if enabled)
  if (showSettingsPanel) {
    const settingsX = chatAreaWidth;

    // Settings panel background
    const settingsBg = penpot.createRectangle();
    settingsBg.name = 'Settings Panel Background';
    settingsBg.x = settingsX;
    settingsBg.y = 0;
    settingsBg.resize(settingsPanelWidth, totalHeight);
    settingsBg.fills = [{ fillColor: colors.panelBackground, fillOpacity: 1 }];
    settingsBg.borderRadius = dims.borderRadius;
    settingsBg.strokes = [{ strokeColor: colors.panelBorder, strokeAlignment: 'center', strokeWidth: dims.borderWidth }];

    // Settings title
    const settingsTitle = penpot.createText('Settings');
    if (settingsTitle) {
      settingsTitle.name = 'Settings Title';
      settingsTitle.x = settingsX + dims.panelPadding;
      settingsTitle.y = dims.panelPadding;
      settingsTitle.resize(settingsPanelWidth - dims.panelPadding * 2, dims.titleHeight);
      settingsTitle.fontFamily = 'Inter';
      settingsTitle.fontSize = '14';
      settingsTitle.fontWeight = '600';
      settingsTitle.fills = [{ fillColor: colors.panelTitle, fillOpacity: 1 }];
      settingsTitle.align = 'center';
      settingsTitle.verticalAlign = 'center';
    }

    // Sample settings items
    const settingsItems = [
      { icon: '🔔', label: 'Notifications', value: 'On' },
      { icon: '🎨', label: 'Theme', value: 'Light' },
      { icon: '📝', label: 'Font Size', value: 'Medium' },
      { icon: '💾', label: 'Auto-save', value: 'On' },
    ];

    let itemY = dims.panelPadding + dims.titleHeight + dims.panelPadding;

    settingsItems.forEach(item => {
      // Item icon
      const itemIcon = penpot.createText(item.icon);
      if (itemIcon) {
        itemIcon.name = `Settings Icon - ${item.label}`;
        itemIcon.x = settingsX + dims.panelPadding;
        itemIcon.y = itemY;
        itemIcon.resize(20, 20);
        itemIcon.fontFamily = 'Inter';
        itemIcon.fontSize = '12';
        itemIcon.align = 'center';
        itemIcon.verticalAlign = 'center';
      }

      // Item label
      const itemLabel = penpot.createText(item.label);
      if (itemLabel) {
        itemLabel.name = `Settings Label - ${item.label}`;
        itemLabel.x = settingsX + dims.panelPadding + 24 + dims.panelPadding;
        itemLabel.y = itemY;
        itemLabel.resize(settingsPanelWidth - dims.panelPadding * 3 - 24 - 40, 20);
        itemLabel.fontFamily = 'Inter';
        itemLabel.fontSize = '12';
        itemLabel.fontWeight = '400';
        itemLabel.fills = [{ fillColor: colors.panelTitle, fillOpacity: 1 }];
        itemLabel.align = 'left';
        itemLabel.verticalAlign = 'center';
      }

      // Item value
      const itemValue = penpot.createText(item.value);
      if (itemValue) {
        itemValue.name = `Settings Value - ${item.label}`;
        itemValue.x = settingsX + settingsPanelWidth - dims.panelPadding - 40;
        itemValue.y = itemY;
        itemValue.resize(40, 20);
        itemValue.fontFamily = 'Inter';
        itemValue.fontSize = '11';
        itemValue.fontWeight = '600';
        itemValue.fills = [{ fillColor: colors.panelSubtitle, fillOpacity: 1 }];
        itemValue.align = 'right';
        itemValue.verticalAlign = 'center';
      }

      if (itemIcon) board.appendChild(itemIcon);
      if (itemLabel) board.appendChild(itemLabel);
      if (itemValue) board.appendChild(itemValue);

      itemY += 24 + dims.panelPadding;
    });

    board.appendChild(settingsBg);
    if (settingsTitle) board.appendChild(settingsTitle);
  }

  // Add all elements to board (first appended = on top)
  board.appendChild(background);
  board.appendChild(chatAreaBg);

  // Center on viewport
  const viewport = penpot.viewport;
  if (viewport) {
    board.x = viewport.center.x - totalWidth / 2;
    board.y = viewport.center.y - totalHeight / 2;
  }

  return board.id;
}