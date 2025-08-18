# MultiSelectModal – UI/UX Spec & Tracking

**Purpose:**
A robust, accessible modal for selecting multiple files from the Vault, configuring the summarization prompt, and launching the summarization workflow.

---

## Core Features (MVP)

- [ ] **Vault Tree View**
  - [ ] Hierarchical folders/files (expand/collapse)
  - [ ] Only supported file types shown (.md, .txt, .html, .csv)
  - [ ] File rows: checkbox + metadata (name, path, modified date, size)
  - [ ] Clicking anywhere on row toggles selection (not just checkbox)
  - [ ] Selected row: green background; unselected: red (theme-aware)
- [ ] **Multi-Select & Folder Logic**
  - [ ] Folder checkbox selects/deselects all eligible files inside
  - [ ] Partial selection (indeterminate) for folders if not all children selected
  - [ ] Deselecting individual files after folder select keeps folder partial
- [ ] **Keyboard Accessibility**
  - [ ] Arrow keys move focus up/down
  - [ ] Space/Enter toggles selection
  - [ ] Tab cycles controls
  - [ ] Esc closes modal
- [ ] **Selection Feedback**
  - [ ] Show count of selected files
  - [ ] Clear Selection button
- [ ] **Prompt Settings Inline**
  - [ ] Editable prompt textarea
  - [ ] Dropdown for saved prompts
  - [ ] Save current prompt button
- [ ] **Modal Actions**
  - [ ] Start/Confirm button
  - [ ] Cancel/Close button
  - [ ] Settings shortcut (gear icon)
- [ ] **Empty State**
  - [ ] Friendly message if no eligible files found
- [ ] **Accessibility**
  - [ ] ARIA roles/labels for all controls
  - [ ] Large click targets for toggles
  - [ ] Color contrast (theme variables)

---

## Nice-to-Have / Future Features

- [ ] Search/filter bar for files
- [ ] Folder selection remembers manual exclusions/inclusions
- [ ] File metadata: tags, custom icons
- [ ] Recent/starred files section
- [ ] Drag-to-select
- [ ] Batch actions (select all in search, etc)
- [ ] Remember last selections or open state
- [ ] Max selection limit
- [ ] Manage saved prompts (full UI)

---

## UI Structure (Wireframe)

```text
+------------------------------------------------------+
| [X]  Summarize Files (Modal Title)                   |
+------------------------------------------------------+
| [Filter/Search bar]                                  |
+------------------------------------------------------+
| [Vault tree: folders & files, checkboxes, metadata]  |
|   [ ] Aya's Stories/                                 |
|     [x] Bonds of Steel.md   (12 KB, 2024-01-01)      |
|     [ ] Characters.txt      (3 KB, 2024-01-02)       |
|     ...                                              |
+------------------------------------------------------+
| [N files selected]                                   |
+------------------------------------------------------+
| Prompt: [textarea]                                   |
| [dropdown: saved prompts] [Save prompt button]       |
+------------------------------------------------------+
| [Start]   [Cancel]   [Clear Selection] [Settings⚙️]  |
+------------------------------------------------------+
```

---

## Open Questions & Design Decisions

- **Persistent Exclusions:**
  - [ ] Modal will provide UI for editing a hidden `.vesperaignore`-style file (not visible in Vault, but present in file system). Users can exclude files/folders using patterns, similar to `.gitignore`. UI will allow editing and previewing exclusions directly from the modal.
- **Prompt Settings Placement:**
  - [ ] Prompt settings accessed via a gear icon at the top-right of the prompt input. Clicking opens a second modal layer for editing prompt settings. Gear is semi-transparent, overlays prompt input, and becomes opaque on hover.
- **File Metadata Visibility:**
  - [ ] File metadata (size, modified date, tags) shown by default, with a toggle in settings to hide if desired.
- **Remembering Last Selections:**
  - [ ] Modal will have a toggle to remember last selection/settings state. Optionally, a reset button to revert to previous or default state (potential for templates in future).

---

> This document tracks design, implementation, and future enhancements for the file selection modal in Vespera Scriptorium. Update checkboxes as features are implemented.

---

## Actionable Dev Tasks

### 1. Vault Tree View

- [ ] Render hierarchical tree of Vault folders/files
  - [ ] Use Obsidian Vault API to get folder/file structure
  - [ ] Only display supported file types (.md, .txt, .html, .csv)
  - [ ] Expand/collapse folders with toggle
- [ ] File row UI
  - [ ] Add checkbox to each file row
  - [ ] Show file metadata (name, path, modified date, size)
  - [ ] Make entire row clickable (not just checkbox)
  - [ ] Style: selected row = green, unselected = red (theme-aware)
- [ ] Folder selection logic
  - [ ] Folder checkbox selects/deselects all eligible files inside
  - [ ] Indeterminate (partial) state if not all children selected
  - [ ] Deselecting individual files after folder select keeps folder partial

### 2. Selection State & Feedback

- [ ] Track selected files and folders in component state
- [ ] Show count of selected files
- [ ] Clear Selection button

### 3. Keyboard Accessibility

- [ ] Arrow keys move focus up/down
- [ ] Space/Enter toggles selection on focused row
- [ ] Tab cycles through modal controls
- [ ] Esc closes modal
- [ ] ARIA roles/labels for all controls

### 4. Prompt Settings Inline

- [ ] Prompt textarea for user input
- [ ] Dropdown for saved prompts
- [ ] Save current prompt button
- [ ] Gear icon at top-right of prompt input
  - [ ] Opens secondary modal for prompt settings (scaffold only for now)
  - [ ] Gear is semi-transparent, overlays prompt input, becomes opaque on hover

### 5. Modal Actions

- [ ] Start/Confirm button (runs summarization on selected files)
- [ ] Cancel/Close button
- [ ] Settings shortcut (gear icon)
- [ ] Empty state message if no eligible files found

### 6. Persistent Exclusions (.vesperaignore)

- [ ] UI for editing exclusion patterns (scaffold only for now)
  - [ ] Save/load patterns to hidden file (not shown in Vault)
  - [ ] Preview excluded files in modal

### 7. Settings & Toggles

- [ ] Toggle to show/hide file metadata
- [ ] Toggle to remember last selection/settings state
- [ ] Reset button to revert to previous/default state

---
