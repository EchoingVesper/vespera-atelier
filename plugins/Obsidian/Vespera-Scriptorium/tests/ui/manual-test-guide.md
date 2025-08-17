# Manual Testing Guide for VaultTreeView and MultiSelectModal

This guide provides step-by-step instructions for manually testing the VaultTreeView and MultiSelectModal components, focusing on accessibility, visual styling, interactions, and architecture.

## Prerequisites

1. Ensure the Vespera Scriptorium plugin is installed and enabled in Obsidian
2. Open a vault with a variety of files and folders for testing

## 1. Accessibility Testing

### VaultTreeView Accessibility

1. **ARIA Attributes**
   - Open the developer tools (F12)
   - Inspect the tree view element
   - Verify the following ARIA attributes are present:
     - `role="tree"` on the root container
     - `role="treeitem"` on folder and file items
     - `aria-expanded` on folder items
     - `aria-selected` on selectable items
     - `aria-label` with descriptive text on interactive elements

2. **Keyboard Navigation**
   - Tab to the tree view
   - Use arrow keys to navigate:
     - Up/Down: Move between items
     - Right: Expand folders or navigate into them
     - Left: Collapse folders or navigate to parent
   - Use Space/Enter to select items
   - Verify focus is visually indicated
   - Verify screen reader announces selections and expansions

3. **Screen Reader Compatibility**
   - Enable a screen reader (VoiceOver on Mac, NVDA or JAWS on Windows)
   - Navigate through the tree view
   - Verify announcements for:
     - Item type (file/folder)
     - Item name
     - Selection state
     - Expansion state for folders

### MultiSelectModal Accessibility

1. **ARIA Attributes**
   - Open the modal
   - Inspect the modal element
   - Verify ARIA attributes:
     - `role="dialog"` on the modal
     - `aria-labelledby` pointing to the title
     - `aria-describedby` if there's a description
     - Proper roles for interactive elements

2. **Keyboard Navigation**
   - Open the modal
   - Tab through all interactive elements
   - Verify all buttons, inputs, and the tree view are keyboard accessible
   - Test keyboard shortcuts (Esc to close, Enter to confirm)
   - Verify focus trap within the modal

3. **Screen Reader Compatibility**
   - Open the modal with a screen reader active
   - Verify the modal title and purpose are announced
   - Navigate through all elements
   - Verify form controls are properly labeled

## 2. Visual Styling Verification

### VaultTreeView Styling

1. **Obsidian Native Styling**
   - Compare the tree view to Obsidian's native file explorer
   - Verify similar styling for:
     - Folder and file icons
     - Indentation levels
     - Selection highlighting
     - Hover states
     - Font styles and sizes

2. **Selection States**
   - Select various items
   - Verify visual indication of:
     - Selected state
     - Focused state
     - Partial selection for folders

3. **Icon Display**
   - Verify folder icons are displayed correctly
   - Verify file icons are displayed correctly
   - Verify icons scale appropriately with text

4. **Theme Compatibility**
   - Switch between light and dark themes
   - Verify colors adapt appropriately
   - Test with a custom theme if available

### MultiSelectModal Styling

1. **Modal Appearance**
   - Verify the modal has proper:
     - Padding and margins
     - Border and shadow
     - Backdrop/overlay
     - Centered positioning

2. **Form Elements**
   - Verify styling of:
     - Input fields
     - Buttons
     - Dropdown menus
     - Checkboxes

3. **Responsive Design**
   - Resize the Obsidian window
   - Verify the modal adapts to different sizes
   - Check for text overflow or layout issues

## 3. Interaction Testing

### VaultTreeView Interactions

1. **Click Interactions**
   - Click on folders to expand/collapse
   - Click on files to select them
   - Right-click to test context menu (if implemented)
   - Verify selection state is maintained

2. **Keyboard Interactions**
   - Test all keyboard shortcuts
   - Verify keyboard and mouse interactions produce the same results

3. **Expand/Collapse Functionality**
   - Expand multiple nested folders
   - Collapse parent folders
   - Verify children visibility updates correctly

4. **Selection and Multi-Selection**
   - Select a single item
   - Use Ctrl/Cmd+click for multi-selection
   - Select a folder and verify child selection behavior
   - Deselect items

### MultiSelectModal Interactions

1. **Modal Controls**
   - Open and close the modal
   - Test the confirm button
   - Test the cancel button
   - Test any other buttons (clear, settings)

2. **Tree View Integration**
   - Select files in the tree view
   - Verify selection count updates
   - Verify selected items are tracked correctly

3. **Prompt Management**
   - Enter text in the prompt field
   - Test saved prompts dropdown
   - Test saving a new prompt
   - Test loading a saved prompt

4. **Form Validation**
   - Submit with no selection
   - Submit with no prompt text
   - Verify appropriate error messages

## 4. Architecture Verification

### Component Structure

1. **Class Hierarchy**
   - Verify VaultTreeView extends ItemView
   - Verify MultiSelectModal extends Modal
   - Check for proper inheritance and method overrides

2. **Interface Implementation**
   - Verify components implement required interfaces
   - Check for proper type definitions

3. **Event Handling**
   - Verify event listeners are properly attached
   - Check for memory leaks (listeners removed on cleanup)

### Integration Points

1. **VaultTreeView in MultiSelectModal**
   - Verify proper instantiation
   - Check data flow between components
   - Verify event handling between components

2. **Plugin Integration**
   - Verify components integrate with the main plugin
   - Check for proper lifecycle management

3. **Obsidian API Usage**
   - Verify proper use of Obsidian APIs
   - Check for compatibility with Obsidian updates

## Test Results Documentation

For each test section, document:

1. Pass/Fail status
2. Any issues encountered
3. Screenshots of issues
4. Recommendations for fixes

## Common Issues to Watch For

1. **Accessibility Issues**
   - Missing ARIA attributes
   - Keyboard traps
   - Insufficient color contrast
   - Missing text alternatives for icons

2. **Visual Issues**
   - Misaligned elements
   - Inconsistent spacing
   - Theme compatibility problems
   - Text overflow

3. **Interaction Issues**
   - Unresponsive controls
   - Inconsistent behavior
   - Missing feedback
   - Performance problems with large trees

4. **Architectural Issues**
   - Memory leaks
   - Unnecessary re-renders
   - Tight coupling between components
   - Inconsistent state management