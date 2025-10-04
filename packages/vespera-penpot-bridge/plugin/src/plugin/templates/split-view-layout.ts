/**
 * Split View Layout creation using Penpot API
 */

import type { SplitViewLayoutConfig, SplitPaneConfig } from '../../shared/templates';
import {
  LAYOUT_DIMENSIONS,
  LAYOUT_COLORS,
} from '../../shared/templates';

/**
 * Create a split view layout component in Penpot
 *
 * Creates a comprehensive split view with:
 * - Two resizable panes (left/right or top/bottom)
 * - Synchronized scrolling indicators
 * - Context relationship visualization
 * - Focus management and navigation
 * - Configurable orientation and pane properties
 *
 * @param config - Configuration for the split view layout
 * @returns The ID of the created board
 */
export function createSplitViewLayout(config: SplitViewLayoutConfig): string {
  const {
    leftPane = {},
    rightPane = {},
    orientation = 'horizontal',
    totalWidth = LAYOUT_DIMENSIONS.splitViewDefault.totalWidth,
    totalHeight = LAYOUT_DIMENSIONS.splitViewDefault.totalHeight,
    showDivider = true,
    dividerWidth = LAYOUT_DIMENSIONS.splitViewDefault.dividerWidth,
  } = config;

  const dims = LAYOUT_DIMENSIONS.splitViewDefault;
  const colors = LAYOUT_COLORS;

  // Pane configurations with defaults
  const leftConfig: Required<SplitPaneConfig> = {
    width: leftPane.width ?? dims.defaultPaneWidth,
    minWidth: leftPane.minWidth ?? dims.minPaneWidth,
    maxWidth: leftPane.maxWidth ?? dims.maxPaneWidth,
    title: leftPane.title ?? 'Source Document',
    showScrollSync: leftPane.showScrollSync ?? true,
  };

  const rightConfig: Required<SplitPaneConfig> = {
    width: rightPane.width ?? dims.defaultPaneWidth,
    minWidth: rightPane.minWidth ?? dims.minPaneWidth,
    maxWidth: rightPane.maxWidth ?? dims.maxPaneWidth,
    title: rightPane.title ?? 'Target Document',
    showScrollSync: rightPane.showScrollSync ?? true,
  };

  // Calculate actual dimensions based on orientation
  const isHorizontal = orientation === 'horizontal';
  const dividerSize = showDivider ? dividerWidth : 0;

  let leftWidth, leftHeight, rightWidth, rightHeight, dividerX, dividerY, dividerWidthPx, dividerHeightPx;

  if (isHorizontal) {
    leftWidth = leftConfig.width;
    leftHeight = totalHeight;
    rightWidth = totalWidth - leftWidth - dividerSize;
    rightHeight = totalHeight;
    dividerX = leftWidth;
    dividerY = 0;
    dividerWidthPx = dividerSize;
    dividerHeightPx = totalHeight;
  } else {
    leftWidth = totalWidth;
    leftHeight = leftConfig.width;
    rightWidth = totalWidth;
    rightHeight = totalHeight - leftHeight - dividerSize;
    dividerX = 0;
    dividerY = leftHeight;
    dividerWidthPx = totalWidth;
    dividerHeightPx = dividerSize;
  }

  // Create main board
  const board = penpot.createBoard();
  board.name = `${orientation === 'horizontal' ? 'Horizontal' : 'Vertical'} Split View`;
  board.resize(totalWidth, totalHeight);

  // Main background
  const background = penpot.createRectangle();
  background.name = 'Background';
  background.x = 0;
  background.y = 0;
  background.resize(totalWidth, totalHeight);
  background.fills = [{ fillColor: colors.background, fillOpacity: 1 }];
  background.borderRadius = dims.borderRadius;

  // 1. Left Pane
  // Left pane background
  const leftPaneBg = penpot.createRectangle();
  leftPaneBg.name = 'Left Pane Background';
  leftPaneBg.x = 0;
  leftPaneBg.y = 0;
  leftPaneBg.resize(leftWidth, leftHeight);
  leftPaneBg.fills = [{ fillColor: colors.panelBackground, fillOpacity: 1 }];
  leftPaneBg.borderRadius = dims.borderRadius;
  leftPaneBg.strokes = [{ strokeColor: colors.panelBorder, strokeAlignment: 'center', strokeWidth: dims.borderWidth }];

  // Left pane title
  const leftTitle = penpot.createText(leftConfig.title);
  if (leftTitle) {
    leftTitle.name = 'Left Pane Title';
    leftTitle.x = dims.panelPadding;
    leftTitle.y = dims.panelPadding;
    leftTitle.resize(leftWidth - dims.panelPadding * 2 - (leftConfig.showScrollSync ? 80 : 0), dims.titleHeight);
    leftTitle.fontFamily = 'Inter';
    leftTitle.fontSize = '14';
    leftTitle.fontWeight = '600';
    leftTitle.fills = [{ fillColor: colors.panelTitle, fillOpacity: 1 }];
    leftTitle.align = 'left';
    leftTitle.verticalAlign = 'center';
  }

  // Left pane sync indicator
  if (leftConfig.showScrollSync) {
    const syncBg = penpot.createRectangle();
    syncBg.name = 'Left Sync Background';
    syncBg.x = leftWidth - dims.panelPadding - 60;
    syncBg.y = dims.panelPadding;
    syncBg.resize(60, 24);
    syncBg.fills = [{ fillColor: colors.syncIndicator, fillOpacity: 0.1 }];
    syncBg.borderRadius = 12;
    syncBg.strokes = [{ strokeColor: colors.syncIndicator, strokeAlignment: 'center', strokeWidth: 1 }];

    const syncIcon = penpot.createText('🔗');
    if (syncIcon) {
      syncIcon.name = 'Left Sync Icon';
      syncIcon.x = leftWidth - dims.panelPadding - 60 + 4;
      syncIcon.y = dims.panelPadding;
      syncIcon.resize(16, 24);
      syncIcon.fontFamily = 'Inter';
      syncIcon.fontSize = '10';
      syncIcon.align = 'center';
      syncIcon.verticalAlign = 'center';
    }

    const syncText = penpot.createText('Synced');
    if (syncText) {
      syncText.name = 'Left Sync Text';
      syncText.x = leftWidth - dims.panelPadding - 60 + 20;
      syncText.y = dims.panelPadding;
      syncText.resize(36, 24);
      syncText.fontFamily = 'Inter';
      syncText.fontSize = '10';
      syncText.fontWeight = '600';
      syncText.fills = [{ fillColor: colors.syncIndicator, fillOpacity: 1 }];
      syncText.align = 'center';
      syncText.verticalAlign = 'center';
    }

    board.appendChild(syncBg);
    if (syncIcon) board.appendChild(syncIcon);
    if (syncText) board.appendChild(syncText);
  }

  // Sample content for left pane
  let contentY = dims.panelPadding + dims.titleHeight + dims.panelPadding;

  const leftContentItems = [
    { type: 'heading', content: 'Chapter 1: The Beginning', indent: 0 },
    { type: 'paragraph', content: 'It was a dark and stormy night when Sarah first discovered the mysterious letter...', indent: 1 },
    { type: 'heading', content: 'Chapter 2: The Discovery', indent: 0 },
    { type: 'paragraph', content: 'The letter contained coordinates to a place she had never heard of...', indent: 1 },
    { type: 'heading', content: 'Chapter 3: The Journey', indent: 0 },
    { type: 'paragraph', content: 'With the map in hand, Sarah embarked on an adventure that would change everything...', indent: 1 },
  ];

  leftContentItems.forEach((item, index) => {
    const indent = item.indent * 20;
    const itemX = dims.panelPadding + indent;
    const maxWidth = leftWidth - dims.panelPadding * 2 - indent;

    // Content background (subtle)
    const itemBg = penpot.createRectangle();
    itemBg.name = `Left Content ${index} Background`;
    itemBg.x = itemX - 4;
    itemBg.y = contentY - 2;
    itemBg.resize(maxWidth + 8, 24);
    itemBg.fills = [{ fillColor: index % 2 === 0 ? '#F9FAFB' : '#FFFFFF', fillOpacity: 1 }];

    // Content text
    const contentText = penpot.createText(
      item.type === 'heading' ? `📖 ${item.content}` : `   ${item.content}`
    );
    if (contentText) {
      contentText.name = `Left Content ${index} Text`;
      contentText.x = itemX;
      contentText.y = contentY;
      contentText.resize(maxWidth, 20);
      contentText.fontFamily = 'Inter';
      contentText.fontSize = item.type === 'heading' ? '11' : '10';
      contentText.fontWeight = item.type === 'heading' ? '600' : '400';
      contentText.fills = [{ fillColor: item.type === 'heading' ? colors.panelTitle : colors.panelSubtitle, fillOpacity: 1 }];
      contentText.align = 'left';
      contentText.verticalAlign = 'center';
    }

    board.appendChild(itemBg);
    if (contentText) board.appendChild(contentText);
    contentY += 26;
  });

  // Scroll markers for left pane
  if (leftConfig.showScrollSync) {
    const scrollMarker1 = penpot.createRectangle();
    scrollMarker1.name = 'Left Scroll Marker 1';
    scrollMarker1.x = leftWidth - dims.scrollMarkerWidth - 2;
    scrollMarker1.y = contentY + 20;
    scrollMarker1.resize(dims.scrollMarkerWidth, 40);
    scrollMarker1.fills = [{ fillColor: colors.scrollMarker, fillOpacity: 0.6 }];
    scrollMarker1.borderRadius = dims.scrollMarkerWidth / 2;

    const scrollMarker2 = penpot.createRectangle();
    scrollMarker2.name = 'Left Scroll Marker 2';
    scrollMarker2.x = leftWidth - dims.scrollMarkerWidth - 2;
    scrollMarker2.y = contentY + 80;
    scrollMarker2.resize(dims.scrollMarkerWidth, 30);
    scrollMarker2.fills = [{ fillColor: colors.scrollMarker, fillOpacity: 0.4 }];
    scrollMarker2.borderRadius = dims.scrollMarkerWidth / 2;

    const scrollMarker3 = penpot.createRectangle();
    scrollMarker3.name = 'Left Scroll Marker 3';
    scrollMarker3.x = leftWidth - dims.scrollMarkerWidth - 2;
    scrollMarker3.y = contentY + 130;
    scrollMarker3.resize(dims.scrollMarkerWidth, 25);
    scrollMarker3.fills = [{ fillColor: colors.scrollMarker, fillOpacity: 0.3 }];
    scrollMarker3.borderRadius = dims.scrollMarkerWidth / 2;

    board.appendChild(scrollMarker1);
    board.appendChild(scrollMarker2);
    board.appendChild(scrollMarker3);
  }

  board.appendChild(leftPaneBg);
  if (leftTitle) board.appendChild(leftTitle);

  // 2. Divider (if enabled)
  if (showDivider) {
    const divider = penpot.createRectangle();
    divider.name = 'Divider';
    divider.x = dividerX;
    divider.y = dividerY;
    divider.resize(dividerWidthPx, dividerHeightPx);
    divider.fills = [{ fillColor: colors.divider, fillOpacity: 1 }];

    // Resize handle (wider interactive area)
    const handleSize = isHorizontal ? dims.dividerWidth : dims.dividerWidth;
    const handleX = isHorizontal ? dividerX - handleSize / 2 + dividerWidthPx / 2 : dividerX;
    const handleY = isHorizontal ? dividerY : dividerY - handleSize / 2 + dividerHeightPx / 2;
    const handleWidth = isHorizontal ? handleSize : dividerWidthPx;
    const handleHeight = isHorizontal ? dividerHeightPx : handleSize;

    const resizeHandle = penpot.createRectangle();
    resizeHandle.name = 'Resize Handle';
    resizeHandle.x = handleX;
    resizeHandle.y = handleY;
    resizeHandle.resize(handleWidth, handleHeight);
    resizeHandle.fills = [{ fillColor: colors.resizeHandle, fillOpacity: 0.3 }];
    resizeHandle.strokes = [{ strokeColor: colors.resizeHandle, strokeAlignment: 'center', strokeWidth: 1 }];

    // Grip lines for visual affordance
    const gripLineCount = isHorizontal ? 3 : 3;
    for (let i = 0; i < gripLineCount; i++) {
      const gripSpacing = 8;
      const gripSize = 20;
      const gripX = isHorizontal ? dividerX + dividerWidthPx / 2 - 1 : dividerX + 40 + i * gripSpacing;
      const gripY = isHorizontal ? dividerY + 40 + i * gripSpacing : dividerY + dividerHeightPx / 2 - 1;
      const gripWidth = isHorizontal ? 2 : gripSize;
      const gripHeight = isHorizontal ? gripSize : 2;

      const gripLine = penpot.createRectangle();
      gripLine.name = `Grip Line ${i + 1}`;
      gripLine.x = gripX;
      gripLine.y = gripY;
      gripLine.resize(gripWidth, gripHeight);
      gripLine.fills = [{ fillColor: colors.resizeHandle, fillOpacity: 0.6 }];
      gripLine.borderRadius = 1;

      board.appendChild(gripLine);
    }

    board.appendChild(resizeHandle);
    board.appendChild(divider);
  }

  // 3. Right Pane
  const rightPaneX = isHorizontal ? leftWidth + dividerSize : 0;
  const rightPaneY = isHorizontal ? 0 : leftHeight + dividerSize;

  // Right pane background
  const rightPaneBg = penpot.createRectangle();
  rightPaneBg.name = 'Right Pane Background';
  rightPaneBg.x = rightPaneX;
  rightPaneBg.y = rightPaneY;
  rightPaneBg.resize(rightWidth, rightHeight);
  rightPaneBg.fills = [{ fillColor: colors.panelBackground, fillOpacity: 1 }];
  rightPaneBg.borderRadius = dims.borderRadius;
  rightPaneBg.strokes = [{ strokeColor: colors.panelBorder, strokeAlignment: 'center', strokeWidth: dims.borderWidth }];

  // Right pane title
  const rightTitle = penpot.createText(rightConfig.title);
  if (rightTitle) {
    rightTitle.name = 'Right Pane Title';
    rightTitle.x = rightPaneX + dims.panelPadding;
    rightTitle.y = rightPaneY + dims.panelPadding;
    rightTitle.resize(rightWidth - dims.panelPadding * 2 - (rightConfig.showScrollSync ? 80 : 0), dims.titleHeight);
    rightTitle.fontFamily = 'Inter';
    rightTitle.fontSize = '14';
    rightTitle.fontWeight = '600';
    rightTitle.fills = [{ fillColor: colors.panelTitle, fillOpacity: 1 }];
    rightTitle.align = 'left';
    rightTitle.verticalAlign = 'center';
  }

  // Right pane sync indicator
  if (rightConfig.showScrollSync) {
    const syncBg = penpot.createRectangle();
    syncBg.name = 'Right Sync Background';
    syncBg.x = rightPaneX + rightWidth - dims.panelPadding - 60;
    syncBg.y = rightPaneY + dims.panelPadding;
    syncBg.resize(60, 24);
    syncBg.fills = [{ fillColor: colors.syncIndicator, fillOpacity: 0.1 }];
    syncBg.borderRadius = 12;
    syncBg.strokes = [{ strokeColor: colors.syncIndicator, strokeAlignment: 'center', strokeWidth: 1 }];

    const syncIcon = penpot.createText('🔗');
    if (syncIcon) {
      syncIcon.name = 'Right Sync Icon';
      syncIcon.x = rightPaneX + rightWidth - dims.panelPadding - 60 + 4;
      syncIcon.y = rightPaneY + dims.panelPadding;
      syncIcon.resize(16, 24);
      syncIcon.fontFamily = 'Inter';
      syncIcon.fontSize = '10';
      syncIcon.align = 'center';
      syncIcon.verticalAlign = 'center';
    }

    const syncText = penpot.createText('Synced');
    if (syncText) {
      syncText.name = 'Right Sync Text';
      syncText.x = rightPaneX + rightWidth - dims.panelPadding - 60 + 20;
      syncText.y = rightPaneY + dims.panelPadding;
      syncText.resize(36, 24);
      syncText.fontFamily = 'Inter';
      syncText.fontSize = '10';
      syncText.fontWeight = '600';
      syncText.fills = [{ fillColor: colors.syncIndicator, fillOpacity: 1 }];
      syncText.align = 'center';
      syncText.verticalAlign = 'center';
    }

    board.appendChild(syncBg);
    if (syncIcon) board.appendChild(syncIcon);
    if (syncText) board.appendChild(syncText);
  }

  // Sample content for right pane
  let rightContentY = rightPaneY + dims.panelPadding + dims.titleHeight + dims.panelPadding;

  const rightContentItems = [
    { type: 'heading', content: 'Scene 1: Introduction', indent: 0, relation: 'matches' },
    { type: 'paragraph', content: 'Sarah opened the mysterious letter under the pale moonlight...', indent: 1, relation: 'related' },
    { type: 'heading', content: 'Scene 2: The Revelation', indent: 0, relation: 'matches' },
    { type: 'paragraph', content: 'The coordinates led to an abandoned lighthouse on the coast...', indent: 1, relation: 'related' },
    { type: 'heading', content: 'Scene 3: The Challenge', indent: 0, relation: 'matches' },
    { type: 'paragraph', content: 'Inside the lighthouse, she discovered maps dating back centuries...', indent: 1, relation: 'related' },
  ];

  rightContentItems.forEach((item, index) => {
    const indent = item.indent * 20;
    const itemX = rightPaneX + dims.panelPadding + indent;
    const maxWidth = rightWidth - dims.panelPadding * 2 - indent;

    // Content background with relationship indication
    const itemBg = penpot.createRectangle();
    itemBg.name = `Right Content ${index} Background`;
    itemBg.x = itemX - 4;
    itemBg.y = rightContentY - 2;
    itemBg.resize(maxWidth + 8, 24);

    if (item.relation === 'matches') {
      itemBg.fills = [{ fillColor: '#EFF6FF', fillOpacity: 1 }];
      itemBg.strokes = [{ strokeColor: colors.focusRing, strokeAlignment: 'center', strokeWidth: 1, strokeOpacity: 0.3 }];
    } else {
      itemBg.fills = [{ fillColor: index % 2 === 0 ? '#F9FAFB' : '#FFFFFF', fillOpacity: 1 }];
    }

    // Content text with relation indicator
    const contentText = penpot.createText(
      `${item.relation === 'matches' ? '🎯' : '📝'} ${item.content}`
    );
    if (contentText) {
      contentText.name = `Right Content ${index} Text`;
      contentText.x = itemX;
      contentText.y = rightContentY;
      contentText.resize(maxWidth, 20);
      contentText.fontFamily = 'Inter';
      contentText.fontSize = item.type === 'heading' ? '11' : '10';
      contentText.fontWeight = item.type === 'heading' ? '600' : '400';
      contentText.fills = [{ fillColor: item.relation === 'matches' ? '#1E40AF' : (item.type === 'heading' ? colors.panelTitle : colors.panelSubtitle), fillOpacity: 1 }];
      contentText.align = 'left';
      contentText.verticalAlign = 'center';
    }

    board.appendChild(itemBg);
    if (contentText) board.appendChild(contentText);
    rightContentY += 26;
  });

  // Scroll markers for right pane (synchronized with left)
  if (rightConfig.showScrollSync) {
    const scrollMarker1 = penpot.createRectangle();
    scrollMarker1.name = 'Right Scroll Marker 1';
    scrollMarker1.x = rightPaneX + rightWidth - dims.scrollMarkerWidth - 2;
    scrollMarker1.y = rightContentY + 20;
    scrollMarker1.resize(dims.scrollMarkerWidth, 40);
    scrollMarker1.fills = [{ fillColor: colors.scrollMarker, fillOpacity: 0.6 }];
    scrollMarker1.borderRadius = dims.scrollMarkerWidth / 2;

    const scrollMarker2 = penpot.createRectangle();
    scrollMarker2.name = 'Right Scroll Marker 2';
    scrollMarker2.x = rightPaneX + rightWidth - dims.scrollMarkerWidth - 2;
    scrollMarker2.y = rightContentY + 80;
    scrollMarker2.resize(dims.scrollMarkerWidth, 30);
    scrollMarker2.fills = [{ fillColor: colors.scrollMarker, fillOpacity: 0.4 }];
    scrollMarker2.borderRadius = dims.scrollMarkerWidth / 2;

    const scrollMarker3 = penpot.createRectangle();
    scrollMarker3.name = 'Right Scroll Marker 3';
    scrollMarker3.x = rightPaneX + rightWidth - dims.scrollMarkerWidth - 2;
    scrollMarker3.y = rightContentY + 130;
    scrollMarker3.resize(dims.scrollMarkerWidth, 25);
    scrollMarker3.fills = [{ fillColor: colors.scrollMarker, fillOpacity: 0.3 }];
    scrollMarker3.borderRadius = dims.scrollMarkerWidth / 2;

    board.appendChild(scrollMarker1);
    board.appendChild(scrollMarker2);
    board.appendChild(scrollMarker3);
  }

  board.appendChild(rightPaneBg);
  if (rightTitle) board.appendChild(rightTitle);

  // Add all elements to board (first appended = on top)
  board.appendChild(background);

  // Center on viewport
  const viewport = penpot.viewport;
  if (viewport) {
    board.x = viewport.center.x - totalWidth / 2;
    board.y = viewport.center.y - totalHeight / 2;
  }

  return board.id;
}