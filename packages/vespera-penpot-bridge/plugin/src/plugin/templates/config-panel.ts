/**
 * Config Panel template - Grouped form fields with collapsible sections and validation states
 */

import type { ConfigPanelConfig } from '../../shared/templates';
import { CONFIG_PANEL_COLORS, CONFIG_PANEL_DIMENSIONS } from '../../shared/templates';

/**
 * Creates a config panel with collapsible sections and form fields
 */
export function createConfigPanel(config: ConfigPanelConfig = {}): string {
  const {
    sections = [
      {
        title: 'General Settings',
        collapsed: false,
        fields: [
          {
            label: 'Project Name',
            type: 'text',
            placeholder: 'Enter project name...',
            required: true,
          },
          {
            label: 'Description',
            type: 'textarea',
            placeholder: 'Enter project description...',
          },
        ],
      },
      {
        title: 'Advanced Options',
        collapsed: true,
        fields: [
          {
            label: 'Enable Notifications',
            type: 'toggle',
            value: true,
          },
          {
            label: 'Priority Level',
            type: 'select',
            options: ['Low', 'Medium', 'High'],
            value: 'Medium',
          },
        ],
      },
    ],
    showActionBar = true,
    saveLabel = 'Save',
    cancelLabel = 'Cancel',
    width = CONFIG_PANEL_DIMENSIONS.defaultWidth,
    height = CONFIG_PANEL_DIMENSIONS.defaultHeight,
  } = config;

  // Create board (container)
  const board = penpot.createBoard();
  board.name = 'Config Panel';
  board.resize(width, height);

  // Create main background
  const background = penpot.createRectangle();
  background.name = 'Background';
  background.resize(width, height);
  background.fills = [{
    fillColor: CONFIG_PANEL_COLORS.background,
    fillOpacity: 1
  }];
  background.strokes = [{
    strokeColor: CONFIG_PANEL_COLORS.border,
    strokeOpacity: 1,
    strokeWidth: CONFIG_PANEL_DIMENSIONS.borderWidth
  }];
  background.borderRadius = CONFIG_PANEL_DIMENSIONS.borderRadius;

  // Calculate positions
  let currentY = CONFIG_PANEL_DIMENSIONS.padding;
  const contentX = CONFIG_PANEL_DIMENSIONS.padding;
  const contentWidth = width - (CONFIG_PANEL_DIMENSIONS.padding * 2);

  // Create sections
  sections.forEach((section, sectionIndex) => {
    // Section header
    const headerHeight = CONFIG_PANEL_DIMENSIONS.sectionHeaderHeight;
    const header = penpot.createRectangle();
    header.name = `Section Header ${sectionIndex + 1}`;
    header.resize(contentWidth, headerHeight);
    header.x = contentX;
    header.y = currentY;
    header.fills = [{
      fillColor: CONFIG_PANEL_COLORS.background,
      fillOpacity: 1
    }];
    header.strokes = [{
      strokeColor: CONFIG_PANEL_COLORS.sectionBorder,
      strokeOpacity: 1,
      strokeWidth: CONFIG_PANEL_DIMENSIONS.borderWidth
    }];
    header.borderRadius = CONFIG_PANEL_DIMENSIONS.borderRadius;

    // Header text
    const headerText = penpot.createText(section.title);
    if (headerText) {
      headerText.name = `Section Title ${sectionIndex + 1}`;
      headerText.x = contentX + CONFIG_PANEL_DIMENSIONS.padding;
      headerText.y = currentY + (headerHeight - 14) / 2; // Center text vertically
      headerText.fontFamily = 'Inter';
      headerText.fontSize = '14';
      headerText.fontWeight = '600';
      headerText.fills = [{
        fillColor: CONFIG_PANEL_COLORS.sectionHeader,
        fillOpacity: 1
      }];
    }

    // Expand/collapse chevron
    const chevron = penpot.createText(section.collapsed ? '▶' : '▼');
    if (chevron) {
      chevron.name = `Section Chevron ${sectionIndex + 1}`;
      chevron.x = contentX + contentWidth - CONFIG_PANEL_DIMENSIONS.chevronSize - CONFIG_PANEL_DIMENSIONS.padding;
      chevron.y = currentY + (headerHeight - CONFIG_PANEL_DIMENSIONS.chevronSize) / 2;
      chevron.fontFamily = 'Inter';
      chevron.fontSize = '12';
      chevron.fills = [{
        fillColor: CONFIG_PANEL_COLORS.chevron,
        fillOpacity: 1
      }];
    }

    // Add header elements to board (first appended = top layer)
    if (chevron) board.appendChild(chevron);
    if (headerText) board.appendChild(headerText);
    board.appendChild(header);

    currentY += headerHeight;

    // Section fields (if not collapsed)
    if (!section.collapsed) {
      section.fields.forEach((field, fieldIndex) => {
        const fieldY = currentY + CONFIG_PANEL_DIMENSIONS.fieldSpacing;

        // Field label
        const labelText = penpot.createText(field.label + (field.required ? ' *' : ''));
        if (labelText) {
          labelText.name = `Field Label ${sectionIndex + 1}-${fieldIndex + 1}`;
          labelText.x = contentX;
          labelText.y = fieldY;
          labelText.fontFamily = 'Inter';
          labelText.fontSize = '12';
          labelText.fontWeight = '500';
          labelText.fills = [{
            fillColor: CONFIG_PANEL_COLORS.fieldLabel,
            fillOpacity: 1
          }];
        }

        let inputHeight: number = CONFIG_PANEL_DIMENSIONS.inputHeight;

        // Create input based on field type
        let inputShape;
        const inputY = fieldY + CONFIG_PANEL_DIMENSIONS.labelHeight + 4;

        switch (field.type) {
          case 'text':
          case 'number':
            inputShape = createTextInput(contentWidth, inputHeight, inputY, field);
            break;
          case 'textarea':
            const textareaHeight = CONFIG_PANEL_DIMENSIONS.textareaHeight;
            inputShape = createTextInput(contentWidth, textareaHeight, inputY, field, true);
            inputHeight = textareaHeight;
            break;
          case 'select':
            inputShape = createSelectInput(contentWidth, inputHeight, inputY, field);
            break;
          case 'toggle':
            inputShape = createToggleInput(contentWidth, inputHeight, inputY, field);
            break;
        }

        // Error message (if present)
        if (field.error) {
          const errorText = penpot.createText(field.error);
          if (errorText) {
            errorText.name = `Field Error ${sectionIndex + 1}-${fieldIndex + 1}`;
            errorText.x = contentX;
            errorText.y = inputY + inputHeight + 4;
            errorText.fontFamily = 'Inter';
            errorText.fontSize = '11';
            errorText.fills = [{
              fillColor: CONFIG_PANEL_COLORS.errorText,
              fillOpacity: 1
            }];
            board.appendChild(errorText);
          }
        }

        // Add field elements to board
        if (inputShape) {
          if (typeof inputShape === 'object' && inputShape.input) {
            board.appendChild(inputShape.input);
            if (inputShape.text) board.appendChild(inputShape.text);
            if (inputShape.arrow) board.appendChild(inputShape.arrow);
            if (inputShape.track) board.appendChild(inputShape.track);
            if (inputShape.thumb) board.appendChild(inputShape.thumb);
            if (inputShape.labelText) board.appendChild(inputShape.labelText);
          } else {
            board.appendChild(inputShape);
          }
        }
        if (labelText) board.appendChild(labelText);

        currentY = inputY + inputHeight + CONFIG_PANEL_DIMENSIONS.fieldSpacing;
      });
    }

    currentY += CONFIG_PANEL_DIMENSIONS.sectionSpacing;
  });

  // Action bar (if enabled)
  if (showActionBar) {
    const actionBarY = height - CONFIG_PANEL_DIMENSIONS.actionButtonHeight - CONFIG_PANEL_DIMENSIONS.padding;
    const buttonSpacing = 12;
    const totalButtonWidth = CONFIG_PANEL_DIMENSIONS.actionButtonWidth * 2 + buttonSpacing;
    const startX = contentX + (contentWidth - totalButtonWidth) / 2;

    // Cancel button
    const cancelButton = penpot.createRectangle();
    cancelButton.name = 'Cancel Button';
    cancelButton.resize(CONFIG_PANEL_DIMENSIONS.actionButtonWidth, CONFIG_PANEL_DIMENSIONS.actionButtonHeight);
    cancelButton.x = startX;
    cancelButton.y = actionBarY;
    cancelButton.fills = [{
      fillColor: CONFIG_PANEL_COLORS.background,
      fillOpacity: 1
    }];
    cancelButton.strokes = [{
      strokeColor: CONFIG_PANEL_COLORS.cancelButton,
      strokeOpacity: 1,
      strokeWidth: CONFIG_PANEL_DIMENSIONS.borderWidth
    }];
    cancelButton.borderRadius = CONFIG_PANEL_DIMENSIONS.borderRadius;

    const cancelText = penpot.createText(cancelLabel);
    if (cancelText) {
      cancelText.name = 'Cancel Text';
      cancelText.x = startX;
      cancelText.y = actionBarY + (CONFIG_PANEL_DIMENSIONS.actionButtonHeight - 16) / 2;
      cancelText.fontFamily = 'Inter';
      cancelText.fontSize = '14';
      cancelText.fontWeight = '500';
      cancelText.fills = [{
        fillColor: CONFIG_PANEL_COLORS.cancelButton,
        fillOpacity: 1
      }];
    }

    // Save button
    const saveButton = penpot.createRectangle();
    saveButton.name = 'Save Button';
    saveButton.resize(CONFIG_PANEL_DIMENSIONS.actionButtonWidth, CONFIG_PANEL_DIMENSIONS.actionButtonHeight);
    saveButton.x = startX + CONFIG_PANEL_DIMENSIONS.actionButtonWidth + buttonSpacing;
    saveButton.y = actionBarY;
    saveButton.fills = [{
      fillColor: CONFIG_PANEL_COLORS.saveButton,
      fillOpacity: 1
    }];
    saveButton.borderRadius = CONFIG_PANEL_DIMENSIONS.borderRadius;

    const saveText = penpot.createText(saveLabel);
    if (saveText) {
      saveText.name = 'Save Text';
      saveText.x = startX + CONFIG_PANEL_DIMENSIONS.actionButtonWidth + buttonSpacing;
      saveText.y = actionBarY + (CONFIG_PANEL_DIMENSIONS.actionButtonHeight - 16) / 2;
      saveText.fontFamily = 'Inter';
      saveText.fontSize = '14';
      saveText.fontWeight = '500';
      saveText.fills = [{
        fillColor: '#FFFFFF',
        fillOpacity: 1
      }];
    }

    // Add action bar elements to board
    if (saveText) board.appendChild(saveText);
    board.appendChild(saveButton);
    if (cancelText) board.appendChild(cancelText);
    board.appendChild(cancelButton);
  }

  // Center on viewport
  const viewport = penpot.viewport;
  if (viewport) {
    board.x = viewport.center.x - width / 2;
    board.y = viewport.center.y - height / 2;
  }

  return board.id;
}

/**
 * Creates a text input field
 */
function createTextInput(width: number, height: number, y: number, field: any, isTextarea = false): any {
  const input = penpot.createRectangle();
  input.name = isTextarea ? 'Textarea Input' : 'Text Input';
  input.resize(width, height);
  input.y = y;
  input.fills = [{
    fillColor: CONFIG_PANEL_COLORS.background,
    fillOpacity: 1
  }];

  // Use error border if field has error
  const borderColor = field.error ? CONFIG_PANEL_COLORS.fieldBorderError : CONFIG_PANEL_COLORS.fieldBorder;
  input.strokes = [{
    strokeColor: borderColor,
    strokeOpacity: 1,
    strokeWidth: CONFIG_PANEL_DIMENSIONS.borderWidth
  }];
  input.borderRadius = CONFIG_PANEL_DIMENSIONS.borderRadius;

  // Add placeholder text or value
  const displayText = field.value ? String(field.value) : (field.placeholder || '');
  if (displayText) {
    const text = penpot.createText(displayText);
    if (text) {
      text.name = 'Input Text';
      text.x = CONFIG_PANEL_DIMENSIONS.padding;
      text.y = y + (height - 16) / 2; // Center text vertically
      text.fontFamily = 'Inter';
      text.fontSize = '14';
      text.fills = [{
        fillColor: field.value ? CONFIG_PANEL_COLORS.fieldText : CONFIG_PANEL_COLORS.fieldPlaceholder,
        fillOpacity: 1
      }];

      return { input, text };
    }
  }

  return input;
}

/**
 * Creates a select dropdown input
 */
function createSelectInput(width: number, height: number, y: number, field: any): any {
  const input = penpot.createRectangle();
  input.name = 'Select Input';
  input.resize(width, height);
  input.y = y;
  input.fills = [{
    fillColor: CONFIG_PANEL_COLORS.background,
    fillOpacity: 1
  }];
  input.strokes = [{
    strokeColor: CONFIG_PANEL_COLORS.fieldBorder,
    strokeOpacity: 1,
    strokeWidth: CONFIG_PANEL_DIMENSIONS.borderWidth
  }];
  input.borderRadius = CONFIG_PANEL_DIMENSIONS.borderRadius;

  // Display selected value or first option
  const displayValue = field.value || (field.options && field.options[0]) || '';
  const text = penpot.createText(displayValue);
  if (text) {
    text.name = 'Select Text';
    text.x = CONFIG_PANEL_DIMENSIONS.padding;
    text.y = y + (height - 16) / 2;
    text.fontFamily = 'Inter';
    text.fontSize = '14';
    text.fills = [{
      fillColor: CONFIG_PANEL_COLORS.fieldText,
      fillOpacity: 1
    }];
  }

  // Dropdown arrow
  const arrow = penpot.createText('▼');
  if (arrow) {
    arrow.name = 'Dropdown Arrow';
    arrow.x = width - 20;
    arrow.y = y + (height - 12) / 2;
    arrow.fontFamily = 'Inter';
    arrow.fontSize = '10';
    arrow.fills = [{
      fillColor: CONFIG_PANEL_COLORS.chevron,
      fillOpacity: 1
    }];
  }

  return { input, text, arrow };
}

/**
 * Creates a toggle switch input
 */
function createToggleInput(width: number, height: number, y: number, field: any): any {
  const toggleSize = CONFIG_PANEL_DIMENSIONS.toggleSize;
  const toggleX = width - toggleSize - CONFIG_PANEL_DIMENSIONS.padding;

  // Toggle track
  const track = penpot.createRectangle();
  track.name = 'Toggle Track';
  track.resize(toggleSize * 2, toggleSize);
  track.x = toggleX - toggleSize;
  track.y = y + (height - toggleSize) / 2;
  track.fills = [{
    fillColor: field.value ? CONFIG_PANEL_COLORS.toggleActive : CONFIG_PANEL_COLORS.toggleBackground,
    fillOpacity: 1
  }];
  track.borderRadius = toggleSize / 2;

  // Toggle thumb
  const thumb = penpot.createRectangle();
  thumb.name = 'Toggle Thumb';
  thumb.resize(toggleSize - 4, toggleSize - 4);
  thumb.x = field.value ? toggleX - 2 : toggleX - toggleSize + 2;
  thumb.y = y + (height - (toggleSize - 4)) / 2;
  thumb.fills = [{
    fillColor: '#FFFFFF',
    fillOpacity: 1
  }];
  thumb.borderRadius = (toggleSize - 4) / 2;

  // Label text
  const labelText = penpot.createText(field.label);
  if (labelText) {
    labelText.name = 'Toggle Label';
    labelText.x = CONFIG_PANEL_DIMENSIONS.padding;
    labelText.y = y + (height - 16) / 2;
    labelText.fontFamily = 'Inter';
    labelText.fontSize = '14';
    labelText.fills = [{
      fillColor: CONFIG_PANEL_COLORS.fieldText,
      fillOpacity: 1
    }];
  }

  return { track, thumb, labelText };
}