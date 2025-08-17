# UI Components User Guide

This guide provides detailed information on how to use the UI components in the Vespera Scriptorium plugin, focusing on the VaultTreeView and MultiSelectModal components.

## VaultTreeView Component

The VaultTreeView component displays a hierarchical tree of files and folders from your Obsidian vault, allowing for navigation, selection, and interaction.

### Basic Usage

The VaultTreeView appears in several places throughout the plugin:

1. In the file selection modal when processing documents
2. In dedicated views for browsing vault content
3. In various dialogs that require file selection

### Navigation

#### Mouse Navigation

- **Click on folders**: Expand or collapse folders
- **Click on files**: Select individual files
- **Right-click on folders**: Select all files within the folder
- **Ctrl/Cmd+click**: Multi-select files and folders

#### Keyboard Navigation

| Key Combination | Action |
|----------------|--------|
| Arrow Up/Down | Navigate between items |
| Arrow Right | Expand folders or navigate into them |
| Arrow Left | Collapse folders or navigate to parent |
| Space | Select/deselect the focused item |
| Enter | Select files or expand/collapse folders |
| Shift+Enter | Select all files within a folder |
| Home | Navigate to the first item |
| End | Navigate to the last item |
| Numpad 8 | Navigate up (alternative to Arrow Up) |
| Numpad 2 | Navigate down (alternative to Arrow Down) |
| Numpad 4 | Navigate left (alternative to Arrow Left) |
| Numpad 6 | Navigate right (alternative to Arrow Right) |

### Selection States

The VaultTreeView displays different selection states:

- **Unselected**: No highlight
- **Selected**: Fully highlighted
- **Partially Selected**: Folders with some (but not all) selected files
- **Focused**: Outlined with a focus indicator (when using keyboard navigation)

### Example: Navigating and Selecting Files

1. Use Arrow keys to navigate to a folder
2. Press Arrow Right to expand the folder
3. Navigate to a file using Arrow Down
4. Press Space to select the file
5. Hold Ctrl/Cmd and press Space on another file for multi-selection
6. Navigate to a folder and press Shift+Enter to select all files within it

## MultiSelectModal Component

The MultiSelectModal provides a dialog interface for selecting multiple files and configuring processing options.

### Opening the Modal

The MultiSelectModal appears when:

1. Using the "Process Documents" command
2. Clicking the "Process" button in the plugin sidebar
3. Using the "Process Selection" command on selected text

### Modal Sections

The modal consists of several sections:

1. **File Selection Tree**: A VaultTreeView for selecting files
2. **Prompt Management**: Text area for entering processing instructions
3. **Saved Prompts**: Dropdown for selecting previously saved prompts
4. **Action Buttons**: Confirm, Cancel, and other action buttons

### Using the Modal

#### File Selection

1. Navigate the tree view as described in the VaultTreeView section
2. Select one or more files for processing
3. The selection count updates automatically at the bottom of the modal

#### Prompt Configuration

1. Enter processing instructions in the prompt text area
2. Select a saved prompt from the dropdown (if available)
3. Save the current prompt for future use by entering a title and clicking "Save"

#### Modal Actions

| Button | Action |
|--------|--------|
| Confirm | Process the selected files with the configured prompt |
| Cancel | Close the modal without processing |
| Clear | Clear all selections |
| Settings | Open settings for additional configuration |

### Keyboard Shortcuts

| Key Combination | Action |
|----------------|--------|
| Tab | Navigate between modal sections |
| Esc | Cancel and close the modal |
| Ctrl+Enter | Confirm and process selected files |
| Arrow keys | Navigate within button groups |
| Enter | Activate the focused button |

### Example: Processing Multiple Files

1. Open the MultiSelectModal using the "Process Documents" command
2. Navigate the tree view to find relevant files
3. Select multiple files using Space or mouse clicks
4. Enter processing instructions in the prompt text area
5. Click "Confirm" or press Ctrl+Enter to process the files

## Saved Prompts Feature

The MultiSelectModal includes a saved prompts feature that allows you to save and reuse processing instructions.

### Saving a Prompt

1. Enter your processing instructions in the prompt text area
2. Enter a title for the prompt in the title field
3. Click the "Save" button
4. The prompt is now saved for future use

### Using Saved Prompts

1. Click on the saved prompts dropdown
2. Select a previously saved prompt
3. The prompt text area is automatically populated with the saved content
4. Modify the prompt if needed before processing

### Managing Saved Prompts

1. Click the "Edit" button to enter edit mode
2. In edit mode, you can:
   - Delete saved prompts
   - Sort prompts by different criteria
   - View prompt details
3. Click "Back" to return to normal mode

## Accessibility Features

Both components include comprehensive accessibility features:

### VaultTreeView Accessibility

- Full keyboard navigation
- ARIA roles and attributes for screen readers
- Clear focus indicators
- Announcements for selection and expansion states

### MultiSelectModal Accessibility

- Keyboard navigation between all controls
- Focus trap within the modal
- ARIA labels and roles
- Screen reader announcements for modal content and actions

## Tips and Best Practices

1. **Efficient Navigation**: Use keyboard shortcuts for faster navigation in large vaults
2. **Folder Selection**: Use Shift+Enter on folders to quickly select all contained files
3. **Saved Prompts**: Create a library of prompts for different processing tasks
4. **Keyboard Focus**: Press Tab to move between major sections of the modal
5. **Selection Feedback**: Watch the selection counter at the bottom to confirm your selections

## Troubleshooting

### Common Issues

1. **Tree Not Expanding**: Ensure you're pressing Arrow Right (not Enter) to expand folders
2. **Selection Not Working**: Check if the file is selectable in the current context
3. **Modal Not Responding**: Try tabbing to ensure focus is within the modal
4. **Prompt Not Saving**: Ensure you've entered both a title and content

### Getting Help

If you encounter issues with the UI components:

1. Check the plugin documentation for updated information
2. Look for error messages in the developer console (Ctrl+Shift+I)
3. Report issues on the plugin's GitHub repository with detailed steps to reproduce