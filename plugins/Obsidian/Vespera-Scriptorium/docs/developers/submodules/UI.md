# UI Module

**Responsibility:** Provides user interface components (modals, panes, progress feedback).

## Exports

- File selection modal
- Progress pane
- Settings tab
- UI Manager
- Style Manager
- Output Files View
- Checkpoint Manager Modal

## Architecture

The UI module follows a modular architecture with components organized in the `src/ui` directory. For detailed information about the modular architecture, export/import patterns, and best practices, see:

- [Modular Architecture Documentation](../ui/ModularArchitecture.md)
- [UI Components Documentation](../ui/README.md)

## Important Notes

- Always use lowercase `src/ui` in import paths (not uppercase `src/UI`)
- Import components from the module's index file when possible: `import { MultiSelectModal } from './ui'`
- Follow the guidelines in the modular architecture documentation to avoid common issues

## TODO

- Document UI/UX flows
- Describe Obsidian API usage for UI

---
