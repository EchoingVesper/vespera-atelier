/**
 * Navigation pane creation using Penpot API
 */

import type { NavigationPaneConfig } from '../../shared/templates';
import {
  NAVIGATION_PANE_DIMENSIONS,
  NAVIGATION_PANE_COLORS,
} from '../../shared/templates';

/**
 * Create a navigation pane component in Penpot
 *
 * Creates a comprehensive navigation pane with:
 * - Search/filter bar at the top
 * - View mode toggle (list/grid/tree)
 * - Tree structure container with items
 * - Breadcrumb navigation
 * - Collapsible sections
 *
 * @param config - Configuration for the navigation pane
 * @returns The ID of the created board
 */
export function createNavigationPane(config: NavigationPaneConfig): string {
  const {
    title = 'Navigation',
    viewMode = 'tree',
    searchPlaceholder = 'Search...',
    items = [
      {
        label: '📁 Projects',
        level: 0,
        expandState: 'expanded',
        hasChildren: true,
        children: [
          {
            label: '📝 Novel',
            level: 1,
            expandState: 'leaf',
            hasChildren: false,
          },
          {
            label: '📋 Tasks',
            level: 1,
            expandState: 'expanded',
            hasChildren: true,
            children: [
              {
                label: 'Chapter 1',
                level: 2,
                expandState: 'leaf',
                hasChildren: false,
              },
              {
                label: 'Chapter 2',
                level: 2,
                expandState: 'leaf',
                hasChildren: false,
              },
            ],
          },
          {
            label: '🎵 Music',
            level: 1,
            expandState: 'leaf',
            hasChildren: false,
          },
        ],
      },
    ],
    width = NAVIGATION_PANE_DIMENSIONS.defaultWidth,
  } = config;

  const dims = NAVIGATION_PANE_DIMENSIONS;
  const colors = NAVIGATION_PANE_COLORS;

  // Calculate total height
  let totalHeight = dims.padding + dims.titleHeight + dims.padding;
  totalHeight += dims.searchHeight + dims.padding;
  totalHeight += dims.viewToggleHeight + dims.padding;
  totalHeight += dims.breadcrumbHeight + dims.padding;

  // Calculate tree items height
  const itemHeight = dims.itemHeight;
  let itemCount = 0;
  const countItems = (items: any[]) => {
    items.forEach(item => {
      itemCount++;
      if (item.children && item.expandState === 'expanded') {
        countItems(item.children);
      }
    });
  };
  countItems(items);

  totalHeight += itemHeight * itemCount + dims.padding;
  totalHeight += dims.padding; // Bottom padding

  // Create main board
  const board = penpot.createBoard();
  board.name = `Navigation Pane - ${title}`;
  board.resize(width, totalHeight);

  // Background
  const background = penpot.createRectangle();
  background.name = 'Background';
  background.x = 0;
  background.y = 0;
  background.resize(width, totalHeight);
  background.fills = [{ fillColor: colors.background, fillOpacity: 1 }];
  background.borderRadius = dims.borderRadius;
  background.strokes = [{ strokeColor: colors.border, strokeAlignment: 'center', strokeWidth: dims.borderWidth }];

  let currentY: number = dims.padding;

  // 1. Title
  const titleElement = penpot.createText(title);
  if (titleElement) {
    titleElement.name = 'Title';
    titleElement.x = dims.padding;
    titleElement.y = currentY;
    titleElement.resize(width - dims.padding * 2, dims.titleHeight);
    titleElement.fontFamily = 'Inter';
    titleElement.fontSize = dims.titleFontSize.toString();
    titleElement.fontWeight = '700';
    titleElement.fills = [{ fillColor: colors.titleText, fillOpacity: 1 }];
    titleElement.align = 'left';
    titleElement.verticalAlign = 'center';
  }
  currentY += dims.titleHeight + dims.padding;

  // 2. Search bar
  const searchBackground = penpot.createRectangle();
  searchBackground.name = 'Search Background';
  searchBackground.x = dims.padding;
  searchBackground.y = currentY;
  searchBackground.resize(width - dims.padding * 2, dims.searchHeight);
  searchBackground.fills = [{ fillColor: colors.searchBackground, fillOpacity: 1 }];
  searchBackground.borderRadius = dims.searchBorderRadius;

  const searchIcon = penpot.createText('🔍');
  if (searchIcon) {
    searchIcon.name = 'Search Icon';
    searchIcon.x = dims.padding + dims.searchPadding;
    searchIcon.y = currentY;
    searchIcon.resize(dims.searchIconSize, dims.searchHeight);
    searchIcon.fontFamily = 'Inter';
    searchIcon.fontSize = dims.searchIconSize.toString();
    searchIcon.align = 'center';
    searchIcon.verticalAlign = 'center';
    searchIcon.fills = [{ fillColor: colors.searchIcon, fillOpacity: 1 }];
  }

  const searchPlaceholderElement = penpot.createText(searchPlaceholder);
  if (searchPlaceholderElement) {
    searchPlaceholderElement.name = 'Search Placeholder';
    searchPlaceholderElement.x = dims.padding + dims.searchPadding + dims.searchIconSize + dims.searchPadding;
    searchPlaceholderElement.y = currentY;
    searchPlaceholderElement.resize(
      width - dims.padding * 2 - (dims.searchPadding * 2 + dims.searchIconSize + dims.searchPadding),
      dims.searchHeight
    );
    searchPlaceholderElement.fontFamily = 'Inter';
    searchPlaceholderElement.fontSize = dims.searchFontSize.toString();
    searchPlaceholderElement.fills = [{ fillColor: colors.searchPlaceholder, fillOpacity: 1 }];
    searchPlaceholderElement.align = 'left';
    searchPlaceholderElement.verticalAlign = 'center';
  }
  currentY += dims.searchHeight + dims.padding;

  // 3. View mode toggle
  const toggleBackground = penpot.createRectangle();
  toggleBackground.name = 'View Toggle Background';
  toggleBackground.x = dims.padding;
  toggleBackground.y = currentY;
  toggleBackground.resize(width - dims.padding * 2, dims.viewToggleHeight);
  toggleBackground.fills = [{ fillColor: colors.toggleBackground, fillOpacity: 1 }];
  toggleBackground.borderRadius = dims.toggleBorderRadius;

  const viewModes = ['List', 'Grid', 'Tree'];
  const toggleWidth = (width - dims.padding * 2 - dims.toggleSpacing * (viewModes.length - 1)) / viewModes.length;
  let toggleX = dims.padding;

  viewModes.forEach((mode) => {
    const isActive = mode.toLowerCase() === viewMode.toLowerCase();

    const toggleButton = penpot.createRectangle();
    toggleButton.name = `View Toggle - ${mode}`;
    toggleButton.x = toggleX;
    toggleButton.y = currentY;
    toggleButton.resize(toggleWidth, dims.viewToggleHeight);
    toggleButton.fills = [{
      fillColor: isActive ? colors.toggleActive : colors.toggleInactive,
      fillOpacity: 1
    }];
    toggleButton.borderRadius = dims.toggleBorderRadius;

    const toggleText = penpot.createText(mode);
    if (toggleText) {
      toggleText.name = `Toggle Text - ${mode}`;
      toggleText.x = toggleX;
      toggleText.y = currentY;
      toggleText.resize(toggleWidth, dims.viewToggleHeight);
      toggleText.fontFamily = 'Inter';
      toggleText.fontSize = dims.toggleFontSize.toString();
      toggleText.fontWeight = isActive ? '600' : '400';
      toggleText.fills = [{
        fillColor: isActive ? colors.toggleActiveText : colors.toggleInactiveText,
        fillOpacity: 1
      }];
      toggleText.align = 'center';
      toggleText.verticalAlign = 'center';
    }

    board.appendChild(toggleButton);
    if (toggleText) board.appendChild(toggleText);

    toggleX += toggleWidth + dims.toggleSpacing;
  });

  currentY += dims.viewToggleHeight + dims.padding;

  // 4. Breadcrumb navigation
  const breadcrumbText = penpot.createText('Home > Projects > Current');
  if (breadcrumbText) {
    breadcrumbText.name = 'Breadcrumb';
    breadcrumbText.x = dims.padding;
    breadcrumbText.y = currentY;
    breadcrumbText.resize(width - dims.padding * 2, dims.breadcrumbHeight);
    breadcrumbText.fontFamily = 'Inter';
    breadcrumbText.fontSize = dims.breadcrumbFontSize.toString();
    breadcrumbText.fills = [{ fillColor: colors.breadcrumbText, fillOpacity: 1 }];
    breadcrumbText.align = 'left';
    breadcrumbText.verticalAlign = 'center';
  }
  currentY += dims.breadcrumbHeight + dims.padding;

  // 5. Tree structure
  const renderTreeItems = (items: any[], parentY: number): number => {
    let currentY: number = parentY;

    items.forEach(item => {
      const indent = item.level * dims.indentSize;
      const needsChevron = item.hasChildren && item.expandState !== 'leaf';
      const chevronSymbol = item.expandState === 'expanded' ? '▼' : '▶';

      // Item background
      const itemBackground = penpot.createRectangle();
      itemBackground.name = `Item Background - ${item.label}`;
      itemBackground.x = dims.padding;
      itemBackground.y = currentY;
      itemBackground.resize(width - dims.padding * 2, itemHeight);
      itemBackground.fills = [{ fillColor: colors.itemBackground, fillOpacity: 1 }];
      itemBackground.borderRadius = dims.itemBorderRadius;

      let currentX = dims.padding + dims.itemPadding;

      // Chevron
      if (needsChevron) {
        const chevronElement = penpot.createText(chevronSymbol);
        if (chevronElement) {
          chevronElement.name = 'Item Chevron';
          chevronElement.x = currentX + indent;
          chevronElement.y = currentY;
          chevronElement.resize(dims.chevronSize, itemHeight);
          chevronElement.fontFamily = 'Inter';
          chevronElement.fontSize = (dims.itemFontSize - 2).toString();
          chevronElement.fills = [{ fillColor: colors.chevron, fillOpacity: 1 }];
          chevronElement.align = 'center';
          chevronElement.verticalAlign = 'center';
        }
        currentX += dims.chevronSize + dims.itemSpacing;
      } else {
        currentX += indent;
      }

      // Item label
      const labelElement = penpot.createText(item.label);
      if (labelElement) {
        labelElement.name = 'Item Label';
        labelElement.x = currentX;
        labelElement.y = currentY;
        labelElement.resize(width - dims.padding * 2 - currentX - dims.itemPadding, itemHeight);
        labelElement.fontFamily = 'Inter';
        labelElement.fontSize = dims.itemFontSize.toString();
        labelElement.fills = [{ fillColor: colors.itemText, fillOpacity: 1 }];
        labelElement.align = 'left';
        labelElement.verticalAlign = 'center';
      }

      // Hover border (subtle)
      const hoverBorder = penpot.createRectangle();
      hoverBorder.name = 'Item Hover Border';
      hoverBorder.x = dims.padding;
      hoverBorder.y = currentY;
      hoverBorder.resize(width - dims.padding * 2, itemHeight);
      hoverBorder.fills = [];
      hoverBorder.strokes = [{
        strokeColor: colors.itemHoverBorder,
        strokeAlignment: 'center',
        strokeWidth: dims.itemBorderWidth
      }];
      hoverBorder.borderRadius = dims.itemBorderRadius;

      board.appendChild(hoverBorder);
      board.appendChild(itemBackground);
      if (labelElement) board.appendChild(labelElement);
      if (needsChevron) {
        const chevronElement = penpot.createText(chevronSymbol);
        if (chevronElement) {
          chevronElement.name = 'Item Chevron';
          chevronElement.x = dims.padding + dims.itemPadding + indent;
          chevronElement.y = currentY;
          chevronElement.resize(dims.chevronSize, itemHeight);
          chevronElement.fontFamily = 'Inter';
          chevronElement.fontSize = (dims.itemFontSize - 2).toString();
          chevronElement.fills = [{ fillColor: colors.chevron, fillOpacity: 1 }];
          chevronElement.align = 'center';
          chevronElement.verticalAlign = 'center';
        }
      }

      currentY += itemHeight;

      // Render children if expanded
      if (item.children && item.expandState === 'expanded') {
        currentY = renderTreeItems(item.children, currentY);
      }
    });

    return currentY;
  };

  currentY = renderTreeItems(items, currentY);

  // Add all shapes to board (first appended = on top)
  board.appendChild(background);
  if (titleElement) board.appendChild(titleElement);
  board.appendChild(searchBackground);
  if (searchIcon) board.appendChild(searchIcon);
  if (searchPlaceholderElement) board.appendChild(searchPlaceholderElement);
  if (breadcrumbText) board.appendChild(breadcrumbText);

  // Center on viewport
  const viewport = penpot.viewport;
  if (viewport) {
    board.x = viewport.center.x - width / 2;
    board.y = viewport.center.y - totalHeight / 2;
  }

  return board.id;
}