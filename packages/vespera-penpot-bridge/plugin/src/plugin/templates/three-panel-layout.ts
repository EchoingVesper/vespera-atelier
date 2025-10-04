/**
 * Three-Panel Layout creation using Penpot API
 */

import type { ThreePanelLayoutConfig, PanelConfig } from '../../shared/templates';
import {
  LAYOUT_DIMENSIONS,
  LAYOUT_COLORS,
} from '../../shared/templates';

/**
 * Create a three-panel layout component in Penpot
 *
 * Creates a comprehensive three-panel layout with:
 * - Left panel (navigation/codex explorer)
 * - Center panel (main content/editor)
 * - Right panel (AI chat/context)
 * - Resizable dividers with drag handles
 * - Collapsible panels with min/max width constraints
 * - Focus management and visual feedback
 *
 * @param config - Configuration for the three-panel layout
 * @returns The ID of the created board
 */
export function createThreePanelLayout(config: ThreePanelLayoutConfig): string {
  const {
    leftPanel = {},
    centerPanel = {},
    rightPanel = {},
    totalWidth = LAYOUT_DIMENSIONS.threePanelDefault.totalWidth,
    totalHeight = LAYOUT_DIMENSIONS.threePanelDefault.totalHeight,
    showDividers = true,
    dividerWidth = LAYOUT_DIMENSIONS.threePanelDefault.dividerWidth,
  } = config;

  const dims = LAYOUT_DIMENSIONS.threePanelDefault;
  const colors = LAYOUT_COLORS;

  // Panel configurations with defaults
  const leftConfig: Required<PanelConfig> = {
    width: leftPanel.width ?? dims.leftPanelWidth,
    minWidth: leftPanel.minWidth ?? dims.minPanelWidth,
    maxWidth: leftPanel.maxWidth ?? dims.maxPanelWidth,
    collapsible: leftPanel.collapsible ?? true,
    collapsed: leftPanel.collapsed ?? false,
    title: leftPanel.title ?? 'Navigator',
  };

  const centerConfig: Required<PanelConfig> = {
    width: centerPanel.width ?? dims.centerPanelWidth,
    minWidth: centerPanel.minWidth ?? dims.minPanelWidth,
    maxWidth: centerPanel.maxWidth ?? dims.maxPanelWidth,
    collapsible: centerPanel.collapsible ?? false,
    collapsed: centerPanel.collapsed ?? false,
    title: centerPanel.title ?? 'Editor',
  };

  const rightConfig: Required<PanelConfig> = {
    width: rightPanel.width ?? dims.rightPanelWidth,
    minWidth: rightPanel.minWidth ?? dims.minPanelWidth,
    maxWidth: rightPanel.maxWidth ?? dims.maxPanelWidth,
    collapsible: rightPanel.collapsible ?? true,
    collapsed: rightPanel.collapsed ?? false,
    title: rightPanel.title ?? 'AI Assistant',
  };

  // Calculate actual widths accounting for collapsed states
  const leftActualWidth = leftConfig.collapsed ? 0 : leftConfig.width;
  const rightActualWidth = rightConfig.collapsed ? 0 : rightConfig.width;
  const dividerTotalWidth = showDividers ? dividerWidth * 2 : 0;
  const centerActualWidth = totalWidth - leftActualWidth - rightActualWidth - dividerTotalWidth;

  // Create main board
  const board = penpot.createBoard();
  board.name = 'Three-Panel Layout';
  board.resize(totalWidth, totalHeight);

  // Main background
  const background = penpot.createRectangle();
  background.name = 'Background';
  background.x = 0;
  background.y = 0;
  background.resize(totalWidth, totalHeight);
  background.fills = [{ fillColor: colors.background, fillOpacity: 1 }];
  background.borderRadius = dims.borderRadius;

  let currentX = 0;

  // 1. Left Panel
  if (!leftConfig.collapsed) {
    // Left panel background
    const leftPanelBg = penpot.createRectangle();
    leftPanelBg.name = 'Left Panel Background';
    leftPanelBg.x = currentX;
    leftPanelBg.y = 0;
    leftPanelBg.resize(leftActualWidth, totalHeight);
    leftPanelBg.fills = [{ fillColor: colors.panelBackground, fillOpacity: 1 }];
    leftPanelBg.borderRadius = dims.borderRadius;
    leftPanelBg.strokes = [{ strokeColor: colors.panelBorder, strokeAlignment: 'center', strokeWidth: dims.borderWidth }];

    // Left panel title
    const leftTitle = penpot.createText(leftConfig.title);
    if (leftTitle) {
      leftTitle.name = 'Left Panel Title';
      leftTitle.x = currentX + dims.panelPadding;
      leftTitle.y = dims.panelPadding;
      leftTitle.resize(leftActualWidth - dims.panelPadding * 2, dims.titleHeight);
      leftTitle.fontFamily = 'Inter';
      leftTitle.fontSize = '16';
      leftTitle.fontWeight = '600';
      leftTitle.fills = [{ fillColor: colors.panelTitle, fillOpacity: 1 }];
      leftTitle.align = 'left';
      leftTitle.verticalAlign = 'center';
    }

    // Left panel subtitle (content hint)
    const leftSubtitle = penpot.createText('📁 Codex Explorer');
    if (leftSubtitle) {
      leftSubtitle.name = 'Left Panel Subtitle';
      leftSubtitle.x = currentX + dims.panelPadding;
      leftSubtitle.y = dims.panelPadding + dims.titleHeight;
      leftSubtitle.resize(leftActualWidth - dims.panelPadding * 2, 20);
      leftSubtitle.fontFamily = 'Inter';
      leftSubtitle.fontSize = '12';
      leftSubtitle.fontWeight = '400';
      leftSubtitle.fills = [{ fillColor: colors.panelSubtitle, fillOpacity: 1 }];
      leftSubtitle.align = 'left';
      leftSubtitle.verticalAlign = 'center';
    }

    // Left panel collapse button
    if (leftConfig.collapsible) {
      const collapseButton = penpot.createRectangle();
      collapseButton.name = 'Left Panel Collapse Button';
      collapseButton.x = currentX + leftActualWidth - dims.collapseButtonSize - dims.panelPadding;
      collapseButton.y = dims.panelPadding;
      collapseButton.resize(dims.collapseButtonSize, dims.collapseButtonSize);
      collapseButton.fills = [{ fillColor: colors.collapseButton, fillOpacity: 0.1 }];
      collapseButton.borderRadius = dims.collapseButtonSize / 2;

      const collapseIcon = penpot.createText('◀');
      if (collapseIcon) {
        collapseIcon.name = 'Left Panel Collapse Icon';
        collapseIcon.x = currentX + leftActualWidth - dims.collapseButtonSize - dims.panelPadding;
        collapseIcon.y = dims.panelPadding;
        collapseIcon.resize(dims.collapseButtonSize, dims.collapseButtonSize);
        collapseIcon.fontFamily = 'Inter';
        collapseIcon.fontSize = '10';
        collapseIcon.fills = [{ fillColor: colors.collapseButton, fillOpacity: 1 }];
        collapseIcon.align = 'center';
        collapseIcon.verticalAlign = 'center';
      }
    }

    board.appendChild(leftPanelBg);
    if (leftTitle) board.appendChild(leftTitle);
    if (leftSubtitle) board.appendChild(leftSubtitle);
  }

  currentX += leftActualWidth;

  // 2. Left Divider
  if (showDividers && !leftConfig.collapsed) {
    const leftDivider = penpot.createRectangle();
    leftDivider.name = 'Left Divider';
    leftDivider.x = currentX;
    leftDivider.y = 0;
    leftDivider.resize(dividerWidth, totalHeight);
    leftDivider.fills = [{ fillColor: colors.divider, fillOpacity: 1 }];

    // Resize handle (wider interactive area)
    const resizeHandle = penpot.createRectangle();
    resizeHandle.name = 'Left Resize Handle';
    resizeHandle.x = currentX - dims.resizeHandleWidth / 2 + dividerWidth / 2;
    resizeHandle.y = 0;
    resizeHandle.resize(dims.resizeHandleWidth, totalHeight);
    resizeHandle.fills = [{ fillColor: colors.resizeHandle, fillOpacity: 0.3 }];
    resizeHandle.strokes = [{ strokeColor: colors.resizeHandle, strokeAlignment: 'center', strokeWidth: 1 }];

    board.appendChild(resizeHandle);
    board.appendChild(leftDivider);
  }

  currentX += showDividers && !leftConfig.collapsed ? dividerWidth : 0;

  // 3. Center Panel
  // Center panel background
  const centerPanelBg = penpot.createRectangle();
  centerPanelBg.name = 'Center Panel Background';
  centerPanelBg.x = currentX;
  centerPanelBg.y = 0;
  centerPanelBg.resize(centerActualWidth, totalHeight);
  centerPanelBg.fills = [{ fillColor: colors.panelBackground, fillOpacity: 1 }];
  centerPanelBg.strokes = [{ strokeColor: colors.panelBorder, strokeAlignment: 'center', strokeWidth: dims.borderWidth }];

  // Center panel title
  const centerTitle = penpot.createText(centerConfig.title);
  if (centerTitle) {
    centerTitle.name = 'Center Panel Title';
    centerTitle.x = currentX + dims.panelPadding;
    centerTitle.y = dims.panelPadding;
    centerTitle.resize(centerActualWidth - dims.panelPadding * 2, dims.titleHeight);
    centerTitle.fontFamily = 'Inter';
    centerTitle.fontSize = '16';
    centerTitle.fontWeight = '600';
    centerTitle.fills = [{ fillColor: colors.panelTitle, fillOpacity: 1 }];
    centerTitle.align = 'center';
    centerTitle.verticalAlign = 'center';
  }

  // Center panel subtitle
  const centerSubtitle = penpot.createText('📝 Main Content Area');
  if (centerSubtitle) {
    centerSubtitle.name = 'Center Panel Subtitle';
    centerSubtitle.x = currentX + dims.panelPadding;
    centerSubtitle.y = dims.panelPadding + dims.titleHeight;
    centerSubtitle.resize(centerActualWidth - dims.panelPadding * 2, 20);
    centerSubtitle.fontFamily = 'Inter';
    centerSubtitle.fontSize = '12';
    centerSubtitle.fontWeight = '400';
    centerSubtitle.fills = [{ fillColor: colors.panelSubtitle, fillOpacity: 1 }];
    centerSubtitle.align = 'center';
    centerSubtitle.verticalAlign = 'center';
  }

  // Focus ring for center panel (indicates active editing area)
  const focusRing = penpot.createRectangle();
  focusRing.name = 'Center Panel Focus Ring';
  focusRing.x = currentX + 2;
  focusRing.y = 2;
  focusRing.resize(centerActualWidth - 4, totalHeight - 4);
  focusRing.fills = [];
  focusRing.strokes = [{ strokeColor: colors.focusRing, strokeAlignment: 'center', strokeWidth: 2, strokeOpacity: 0.3 }];
  focusRing.borderRadius = dims.borderRadius;

  board.appendChild(centerPanelBg);
  if (centerTitle) board.appendChild(centerTitle);
  if (centerSubtitle) board.appendChild(centerSubtitle);
  board.appendChild(focusRing);

  currentX += centerActualWidth;

  // 4. Right Divider
  if (showDividers && !rightConfig.collapsed) {
    const rightDivider = penpot.createRectangle();
    rightDivider.name = 'Right Divider';
    rightDivider.x = currentX;
    rightDivider.y = 0;
    rightDivider.resize(dividerWidth, totalHeight);
    rightDivider.fills = [{ fillColor: colors.divider, fillOpacity: 1 }];

    // Resize handle
    const resizeHandle = penpot.createRectangle();
    resizeHandle.name = 'Right Resize Handle';
    resizeHandle.x = currentX - dims.resizeHandleWidth / 2 + dividerWidth / 2;
    resizeHandle.y = 0;
    resizeHandle.resize(dims.resizeHandleWidth, totalHeight);
    resizeHandle.fills = [{ fillColor: colors.resizeHandle, fillOpacity: 0.3 }];
    resizeHandle.strokes = [{ strokeColor: colors.resizeHandle, strokeAlignment: 'center', strokeWidth: 1 }];

    board.appendChild(resizeHandle);
    board.appendChild(rightDivider);
  }

  currentX += showDividers && !rightConfig.collapsed ? dividerWidth : 0;

  // 5. Right Panel
  if (!rightConfig.collapsed) {
    // Right panel background
    const rightPanelBg = penpot.createRectangle();
    rightPanelBg.name = 'Right Panel Background';
    rightPanelBg.x = currentX;
    rightPanelBg.y = 0;
    rightPanelBg.resize(rightActualWidth, totalHeight);
    rightPanelBg.fills = [{ fillColor: colors.panelBackground, fillOpacity: 1 }];
    rightPanelBg.borderRadius = dims.borderRadius;
    rightPanelBg.strokes = [{ strokeColor: colors.panelBorder, strokeAlignment: 'center', strokeWidth: dims.borderWidth }];

    // Right panel title
    const rightTitle = penpot.createText(rightConfig.title);
    if (rightTitle) {
      rightTitle.name = 'Right Panel Title';
      rightTitle.x = currentX + dims.panelPadding;
      rightTitle.y = dims.panelPadding;
      rightTitle.resize(rightActualWidth - dims.panelPadding * 2, dims.titleHeight);
      rightTitle.fontFamily = 'Inter';
      rightTitle.fontSize = '16';
      rightTitle.fontWeight = '600';
      rightTitle.fills = [{ fillColor: colors.panelTitle, fillOpacity: 1 }];
      rightTitle.align = 'right';
      rightTitle.verticalAlign = 'center';
    }

    // Right panel subtitle
    const rightSubtitle = penpot.createText('💬 AI Chat Interface');
    if (rightSubtitle) {
      rightSubtitle.name = 'Right Panel Subtitle';
      rightSubtitle.x = currentX + dims.panelPadding;
      rightSubtitle.y = dims.panelPadding + dims.titleHeight;
      rightSubtitle.resize(rightActualWidth - dims.panelPadding * 2, 20);
      rightSubtitle.fontFamily = 'Inter';
      rightSubtitle.fontSize = '12';
      rightSubtitle.fontWeight = '400';
      rightSubtitle.fills = [{ fillColor: colors.panelSubtitle, fillOpacity: 1 }];
      rightSubtitle.align = 'right';
      rightSubtitle.verticalAlign = 'center';
    }

    // Right panel collapse button
    if (rightConfig.collapsible) {
      const collapseButton = penpot.createRectangle();
      collapseButton.name = 'Right Panel Collapse Button';
      collapseButton.x = currentX + dims.panelPadding;
      collapseButton.y = dims.panelPadding;
      collapseButton.resize(dims.collapseButtonSize, dims.collapseButtonSize);
      collapseButton.fills = [{ fillColor: colors.collapseButton, fillOpacity: 0.1 }];
      collapseButton.borderRadius = dims.collapseButtonSize / 2;

      const collapseIcon = penpot.createText('▶');
      if (collapseIcon) {
        collapseIcon.name = 'Right Panel Collapse Icon';
        collapseIcon.x = currentX + dims.panelPadding;
        collapseIcon.y = dims.panelPadding;
        collapseIcon.resize(dims.collapseButtonSize, dims.collapseButtonSize);
        collapseIcon.fontFamily = 'Inter';
        collapseIcon.fontSize = '10';
        collapseIcon.fills = [{ fillColor: colors.collapseButton, fillOpacity: 1 }];
        collapseIcon.align = 'center';
        collapseIcon.verticalAlign = 'center';
      }
    }

    board.appendChild(rightPanelBg);
    if (rightTitle) board.appendChild(rightTitle);
    if (rightSubtitle) board.appendChild(rightSubtitle);
  }

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