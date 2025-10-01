/**
 * Input field creation using Penpot API
 */

import type { InputFieldConfig } from '../../shared/templates';
import { INPUT_FIELD_DIMENSIONS } from '../../shared/templates';

/**
 * Create an input field component in Penpot
 *
 * Creates a board with:
 * - Label text
 * - Input box (rectangle with optional placeholder)
 * - Optional error message
 *
 * @param config - Configuration for the input field
 * @returns The ID of the created board
 */
export function createInputField(config: InputFieldConfig): string {
  const {
    label,
    placeholder = '',
    errorMessage,
    width = INPUT_FIELD_DIMENSIONS.defaultWidth,
  } = config;

  const dims = INPUT_FIELD_DIMENSIONS;
  const hasError = !!errorMessage;

  // Calculate total height
  const errorHeight = hasError ? 20 : 0;
  const totalHeight =
    dims.labelHeight + dims.spacing + dims.inputHeight + (hasError ? dims.spacing + errorHeight : 0);

  // Create board (frame) for the input field
  const board = penpot.createBoard();
  board.name = `Input - ${label}`;
  board.resize(width, totalHeight);

  // 1. Label text
  const labelText = penpot.createText(label);
  if (labelText) {
    labelText.name = 'Label';
    labelText.x = 0;
    labelText.y = 0;
    labelText.resize(width, dims.labelHeight);
    labelText.fontFamily = 'Inter';
    labelText.fontSize = '14';
    labelText.fontWeight = '600';
    labelText.fills = [{ fillColor: '#374151', fillOpacity: 1 }];
  }

  // 2. Input box background
  const inputBg = penpot.createRectangle();
  inputBg.name = 'Input Background';
  inputBg.x = 0;
  inputBg.y = dims.labelHeight + dims.spacing;
  inputBg.resize(width, dims.inputHeight);
  inputBg.fills = [{ fillColor: '#FFFFFF', fillOpacity: 1 }];
  inputBg.strokes = [
    {
      strokeColor: hasError ? '#EF4444' : '#D1D5DB',
      strokeWidth: dims.borderWidth,
      strokeAlignment: 'inner',
    },
  ];
  inputBg.borderRadius = dims.borderRadius;

  // 3. Placeholder text (if provided)
  let placeholderText = null;
  if (placeholder) {
    placeholderText = penpot.createText(placeholder);
    if (placeholderText) {
      placeholderText.name = 'Placeholder';
      placeholderText.x = 12;
      placeholderText.y = dims.labelHeight + dims.spacing;
      placeholderText.resize(width - 24, dims.inputHeight);
      placeholderText.fontFamily = 'Inter';
      placeholderText.fontSize = '14';
      placeholderText.fontWeight = '400';
      placeholderText.fills = [{ fillColor: '#9CA3AF', fillOpacity: 1 }];
      placeholderText.verticalAlign = 'center';
    }
  }

  // 4. Error message text (if provided)
  let errorText = null;
  if (hasError) {
    errorText = penpot.createText(errorMessage);
    if (errorText) {
      errorText.name = 'Error Message';
      errorText.x = 0;
      errorText.y = dims.labelHeight + dims.spacing + dims.inputHeight + dims.spacing;
      errorText.resize(width, errorHeight);
      errorText.fontFamily = 'Inter';
      errorText.fontSize = '12';
      errorText.fontWeight = '400';
      errorText.fills = [{ fillColor: '#EF4444', fillOpacity: 1 }];
    }
  }

  // Append in REVERSE order (Penpot: first appended = on top)
  if (errorText) board.appendChild(errorText);
  if (placeholderText) board.appendChild(placeholderText);
  board.appendChild(inputBg);
  if (labelText) board.appendChild(labelText);

  // Center the input on the viewport
  const viewport = penpot.viewport;
  if (viewport) {
    board.x = viewport.center.x - width / 2;
    board.y = viewport.center.y - totalHeight / 2;
  }

  return board.id;
}
