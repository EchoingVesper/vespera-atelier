# Vespera Forge UI Integration Checklist

Track progress for integrating the Next.js UI framework into VS Code extension.

---

## Phase 1: Assessment & Planning ✅ COMPLETE

- [x] Read `INTEGRATION_PROMPT.md` thoroughly
- [x] Review current VS Code extension structure (`plugins/VSCode/vespera-forge/`)
- [x] Review new UI framework structure (`src/vespera-forge/`)
- [x] Document current features to preserve
- [x] Map current commands to new UI actions
- [x] Identify potential conflicts or blockers

**Notes:** Phase 1 completed. Created comprehensive INTEGRATION_ASSESSMENT.md with detailed analysis.

---

## Phase 2: Feature Flag Implementation ✅ COMPLETE

- [x] Add `vesperaForge.ui.useNewFramework` configuration setting to `package.json`
- [x] Update `VesperaForgeConfig` type definition with `useNewFramework: boolean`
- [x] Update `getConfig()` helper to read new setting
- [x] Implement conditional UI initialization in `extension.ts`
- [x] Ensure core services remain active regardless of UI choice
- [x] Add placeholder for Phase 3 implementation
- [x] Test configuration setting appears in VS Code settings

**Notes:** Phase 2 completed. Feature flag allows toggling between legacy UI (default) and new UI (to be implemented). See PHASE_2_COMPLETE.md for details.

---

## Phase 3: Environment Setup ✅ COMPLETE

- [x] Navigate to worktree: `cd ~/Development/vespera-atelier-worktrees/feat-codex-ui-framework`
- [x] Navigate to extension: `cd plugins/VSCode/vespera-forge`
- [x] Install React dependencies:
  - [x] Upgraded to `react@^19.0.0` and `react-dom@^19.0.0`
  - [x] Updated `@types/react` and `@types/react-dom` to ^19.0.0
- [x] Install build tools:
  - [x] `ts-loader`, `css-loader`, `style-loader`, `postcss-loader` installed
- [x] Install UI framework dependencies:
  - [x] `tailwindcss@^4.0.0`, `postcss`, `autoprefixer` installed
  - [x] `zustand@^5.0.6`, `@tanstack/react-query@^5.82.0` installed
  - [x] `framer-motion@^12.23.2` installed
  - [x] All Radix UI packages for shadcn/ui installed (16 packages)
- [x] Total: 686 packages installed successfully in 12 seconds

**Notes:** Phase 3 complete! All dependencies installed. See PHASE_3_COMPLETE.md for details. React version warnings are expected and safe.

---

## Phase 3: Copy Framework Files ✅ COMPLETE

- [x] Copy Vespera Forge framework:
  ```bash
  rsync -av ../../../src/vespera-forge/ ./src/vespera-forge/
  ```
- [x] Copy UI components:
  ```bash
  rsync -av ../../../src/components/ ./src/components/
  ```
- [x] Copy utilities:
  ```bash
  rsync -av ../../../src/lib/ ./src/lib/
  ```
- [x] Copy hooks:
  ```bash
  rsync -av ../../../src/hooks/ ./src/hooks/
  ```
- [x] Copy globals.css:
  ```bash
  mkdir -p src/app && rsync -av src/app/globals.css ./src/app/
  ```
- [x] Created tailwind.config.js (adapted from root tailwind.config.ts)
- [x] Created postcss.config.js (adapted from root postcss.config.mjs)

**Notes:** All framework files copied successfully! ~65 files, ~280 KB total. Tailwind and PostCSS configs created and adapted for extension environment.

---

## Phase 4: Create Webview Infrastructure

- [ ] Create webview directory: `mkdir -p src/webview`
- [ ] Create `src/webview/VesperaForgeWebviewProvider.ts`
  - [ ] Implement `WebviewViewProvider` interface
  - [ ] Add HTML template with CSP
  - [ ] Add message handling (codex.create, update, delete)
  - [ ] Add script/style URI generation
- [ ] Create `src/webview/index.tsx`
  - [ ] Set up React root rendering
  - [ ] Import VesperaForge component
  - [ ] Create VS Code webview API wrapper
  - [ ] Add message posting to extension
- [ ] Create `src/webview/globals.css` (copy from `src/app/globals.css`)

**Notes:**

---

## Phase 5: Update Extension Configuration

- [ ] Update `src/extension.ts`:
  - [ ] Import `VesperaForgeWebviewProvider`
  - [ ] Create provider instance
  - [ ] Register webview view provider
  - [ ] Add command to open/focus view
  - [ ] (Optional) Add feature flag to toggle old/new UI
- [ ] Update `package.json`:
  - [ ] Add `viewsContainers` in `contributes`
  - [ ] Add `views` in `contributes`
  - [ ] Add new commands if needed
  - [ ] Update dependencies list
- [ ] Update `webpack.config.js`:
  - [ ] Add second webpack config for webview
  - [ ] Configure entry point: `./src/webview/index.tsx`
  - [ ] Configure output: `dist/webview/index.js`
  - [ ] Add loaders for `.tsx`, `.css`
  - [ ] Add resolve extensions

**Notes:**

---

## Phase 6: Configure Build Tools

- [ ] Create/update `tsconfig.json` for React:
  - [ ] Add `"jsx": "react"`
  - [ ] Add `"lib": ["DOM", "ES2020"]`
  - [ ] Add webview paths to `include`
- [ ] Create/update `tailwind.config.ts`:
  - [ ] Point to webview source files
  - [ ] Add theme customization
  - [ ] Configure plugins
- [ ] Test build:
  - [ ] Run `npm run compile`
  - [ ] Check for errors
  - [ ] Verify output in `dist/webview/`

**Notes:**

---

## Phase 7: Implement VS Code Adapter

- [ ] Review `src/vespera-forge/core/adapters/vscode-adapter.ts`
- [ ] Implement missing VS Code API calls:
  - [ ] File system operations
  - [ ] Workspace folder access
  - [ ] Command execution
  - [ ] Settings/configuration
  - [ ] Message passing
- [ ] Test adapter in webview context
- [ ] Handle VS Code API limitations in webview

**Notes:**

---

## Phase 8: Test Basic Integration

- [ ] Build extension: `npm run compile`
- [ ] Open VS Code extension development host (F5)
- [ ] Check extension activates without errors
- [ ] Verify Vespera Forge appears in activity bar
- [ ] Click view to open webview
- [ ] Check webview loads (no blank screen)
- [ ] Open webview developer tools
- [ ] Check for console errors
- [ ] Verify React app renders

**Notes:**

---

## Phase 9: Test UI Components

- [ ] Verify Three-Panel Layout renders
- [ ] Check Left Panel (Navigator) displays
- [ ] Check Center Panel (Editor) displays
- [ ] Check Right Panel (AI Assistant) displays
- [ ] Verify Tailwind styles are applied
- [ ] Check shadcn/ui components render correctly
- [ ] Test component interactions (clicks, hovers, etc.)
- [ ] Test responsive behavior

**Notes:**

---

## Phase 10: Connect to Extension Services

- [ ] Connect to Bindery backend:
  - [ ] Wire codex CRUD operations
  - [ ] Test task creation/update/delete
  - [ ] Verify data persistence
- [ ] Integrate security manager:
  - [ ] Apply security policies to UI actions
  - [ ] Add consent dialogs where needed
  - [ ] Add audit logging
- [ ] Connect file system:
  - [ ] Test file creation/editing
  - [ ] Test workspace folder access
  - [ ] Wire up file watchers
- [ ] Add telemetry:
  - [ ] Track UI interactions
  - [ ] Monitor performance
  - [ ] Log errors

**Notes:**

---

## Phase 11: Feature Parity

- [ ] Task Manager features:
  - [ ] Task tree view
  - [ ] Task creation
  - [ ] Task completion
  - [ ] Subtask creation
  - [ ] Task filtering
  - [ ] Status updates
- [ ] Content creation features:
  - [ ] Create new codex
  - [ ] Select template
  - [ ] Edit content
  - [ ] Save changes
- [ ] Navigation features:
  - [ ] Browse codex tree
  - [ ] Search/filter
  - [ ] Context menus
- [ ] Command palette integration:
  - [ ] All commands work
  - [ ] Keyboard shortcuts

**Notes:**

---

## Phase 12: Polish & Optimization

- [ ] Performance optimization:
  - [ ] Initial load < 1s
  - [ ] Smooth scrolling/interactions
  - [ ] Efficient re-renders
  - [ ] Code splitting if needed
- [ ] UI polish:
  - [ ] Consistent spacing/sizing
  - [ ] Proper focus management
  - [ ] Loading states
  - [ ] Error states
  - [ ] Empty states
- [ ] Accessibility:
  - [ ] Keyboard navigation
  - [ ] Screen reader support
  - [ ] ARIA labels
  - [ ] Color contrast
- [ ] Bundle size:
  - [ ] Analyze bundle
  - [ ] Tree-shake unused code
  - [ ] Optimize dependencies

**Notes:**

---

## Phase 13: Testing & Documentation

- [ ] Write unit tests:
  - [ ] Component tests
  - [ ] Adapter tests
  - [ ] Integration tests
- [ ] Manual testing:
  - [ ] All features work
  - [ ] No console errors
  - [ ] No memory leaks
  - [ ] Cross-platform (Windows/Mac/Linux)
- [ ] Create documentation:
  - [ ] User guide
  - [ ] Developer guide
  - [ ] Architecture diagram
  - [ ] API documentation
- [ ] Update CHANGELOG.md
- [ ] Update README.md

**Notes:**

---

## Phase 14: Cleanup & Release Prep

- [ ] Remove old UI code (if completely replaced):
  - [ ] Old webview implementations
  - [ ] Deprecated commands
  - [ ] Unused dependencies
- [ ] Code review:
  - [ ] Remove console.logs
  - [ ] Remove TODOs
  - [ ] Fix linting errors
  - [ ] Update comments
- [ ] Final testing:
  - [ ] Clean install test
  - [ ] Fresh workspace test
  - [ ] Different VS Code themes
- [ ] Prepare release:
  - [ ] Version bump
  - [ ] Update CHANGELOG
  - [ ] Tag commit
  - [ ] Create release notes

**Notes:**

---

## Known Issues / Blockers

Document any issues encountered during integration:

1.
2.
3.

---

## Questions / Decisions Needed

Document decisions that need to be made:

1.
2.
3.

---

## Completion Criteria

Integration is complete when:

- [x] All checklist items above are done
- [ ] Extension builds without errors
- [ ] All original features work in new UI
- [ ] No console errors or warnings
- [ ] Performance meets targets
- [ ] Documentation is complete
- [ ] Tests pass
- [ ] Code review approved

---

**Start Date:** _____________

**Target Completion:** _____________

**Actual Completion:** _____________
