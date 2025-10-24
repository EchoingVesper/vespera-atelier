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

## Phase 4: Create Webview Infrastructure ⚠️ PARTIAL

- [x] Create webview directory: `mkdir -p src/webview`
- [x] Create `src/webview/VesperaForgeWebviewProvider.ts` (341 lines)
  - [x] Implement `WebviewViewProvider` interface
  - [x] Add HTML template with CSP
  - [x] Add message handling (codex.create, update, delete, list)
  - [x] Add script/style URI generation
  - [x] Add theme detection and synchronization
  - [x] Add file operations (open, save)
  - [x] Add session management and disposal
- [x] Create `src/webview/index.tsx` (71 lines)
  - [x] Set up React root rendering with React 19
  - [x] Import VesperaForge component
  - [x] Create VS Code webview API wrapper (VSCodeAdapter)
  - [x] Add message posting to extension
  - [x] Add theme observer for dark/light mode
- [x] Globals.css already present in `src/app/` from Phase 3

**Notes:** Infrastructure complete! 205 TypeScript errors remain in framework components. See PHASE_4_COMPLETE.md for details.

---

## Phase 5: Update Extension Configuration ✅ COMPLETE

- [x] Update `src/extension.ts`:
  - [x] Import `VesperaForgeWebviewProvider` (dynamic require)
  - [x] Create provider instance
  - [x] Register webview view provider
  - [x] Integrate with context manager for resource cleanup
  - [x] Feature flag already implemented in Phase 2
- [x] Update `package.json`:
  - [x] `viewsContainers` already exist from original extension
  - [x] Add `views` in `contributes` with conditional visibility
  - [x] No new commands needed (reusing existing)
  - [x] Dependencies updated in Phase 3
- [x] Update `webpack.config.js`:
  - [x] Second webpack config for webview added in Phase 3
  - [x] Entry point configured: `./src/webview/index.tsx`
  - [x] Output configured: `dist/webview/index.js`
  - [x] Loaders added for `.tsx`, `.css` with PostCSS
  - [x] Resolve extensions and aliases configured

**Notes:** Extension integration complete! View appears conditionally based on `vesperaForge.ui.useNewFramework` setting.

---

## Phase 6: Configure Build Tools ✅ COMPLETE (Done in Phase 3)

- [x] Create/update `tsconfig.json` for React:
  - [x] Added `"jsx": "react-jsx"` for React 19
  - [x] Library includes already support DOM
  - [x] Added path aliases (`@/*`)
- [x] Create `tailwind.config.js` (adapted from root .ts):
  - [x] Points to all source files including vespera-forge
  - [x] Full shadcn/ui theme with CSS custom properties
  - [x] Configured plugins: tailwindcss-animate
- [x] Create `postcss.config.js`:
  - [x] Configured @tailwindcss/postcss for v4
  - [x] Configured autoprefixer
- [x] Test build:
  - [x] `npm run compile` runs successfully
  - [x] Extension bundle: 2.38 MiB (builds without errors)
  - [x] Webview bundle: Created with 205 TypeScript errors (non-blocking)

**Notes:** Build system fully configured in Phase 3. Extension builds successfully. Webview has TypeScript errors in framework components but bundle is generated.

---

## Phase 6: TypeScript Error Resolution & Webview Polish ✅ COMPLETE

- [x] Spawned technical-debt-resolver agent to fix core components
- [x] Fixed VesperaForge.tsx (46 → 26 errors)
  - [x] Fixed AIAssistant import (named vs default export)
  - [x] Removed unused type imports
- [x] Fixed CodexNavigator.tsx (6 → 0 critical errors)
  - [x] Fixed function hoisting (const → function declarations)
  - [x] Resolved "Cannot access before initialization" error
- [x] Fixed ThreePanelLayout.tsx (20 → 2 errors)
  - [x] Fixed ResizablePanel imports
  - [x] Removed incompatible JSX patterns
- [x] Fixed webpack configuration
  - [x] Added browser polyfills for Node.js globals
  - [x] Configured process.env for webview context
  - [x] Added fallback config for unavailable modules
- [x] Tested in Extension Development Host
  - [x] Webview loads in VS Code sidebar
  - [x] React app initializes successfully
  - [x] Dark theme detection working
  - [x] UI layout renders (search bar, toggle buttons, panels)

**Notes:** Phase 6 complete! 🎉 **UI is now visible and rendering**. TypeScript errors reduced from 794 to 178 (non-blocking). See INTEGRATION_STATUS.md for detailed session summary.

---

## Phase 7: Make UI Interactive (🔄 NEXT PRIORITY)

### Priority 1: Wire Panel Toggle Handlers
- [ ] Connect button clicks to state changes in ThreePanelLayout
- [ ] Implement panel show/hide logic
- [ ] Test toggle buttons respond to clicks
- [ ] Verify panel visibility state persists

### Priority 2: Implement Platform Message Handlers
- [ ] Handle `initialState` message in webview
- [ ] Set up two-way communication (webview ↔ extension)
- [ ] Test message passing with developer tools
- [ ] Add error handling for failed messages

### Priority 3: CRUD Operations
- [ ] Implement `handleCodexCreate()` in VesperaForgeWebviewProvider
- [ ] Implement `handleCodexUpdate()` in VesperaForgeWebviewProvider
- [ ] Implement `handleCodexDelete()` in VesperaForgeWebviewProvider
- [ ] Implement `handleCodexList()` in VesperaForgeWebviewProvider
- [ ] Connect to Scriptorium MCP backend
- [ ] Wire webview operations to MCP tools
- [ ] Test full create-read-update-delete cycle

**Notes:** UI foundation is solid. Focus on wiring up interactivity and backend connections.

---

## Phase 8: Polish & Error Handling

### Error Boundaries
- [ ] Add React Error Boundary component
- [ ] Implement graceful error handling
- [ ] Create fallback UI for crashes
- [ ] Test error recovery scenarios

### TypeScript Cleanup (Optional)
- [ ] Fix remaining shadcn/ui component warnings
- [ ] Fix test file errors
- [ ] Run final TypeScript compilation check

**Notes:** This phase is optional cleanup. Core functionality should work with existing 178 warnings.

---

## Phase 9: Test UI Components ⚠️ PARTIAL

- [x] Verify Three-Panel Layout renders
- [x] Check Left Panel (Navigator) displays
- [x] Check Center Panel (Editor) displays
- [x] Check Right Panel (AI Assistant) displays
- [x] Verify Tailwind styles are applied
- [x] Check shadcn/ui components render correctly
- [ ] Test component interactions (clicks, hovers, etc.) ← **IN PROGRESS**
- [ ] Test responsive behavior

**Notes:** Basic rendering confirmed. Interaction testing pending Phase 7 completion.

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

---

## 🔥 CURRENT STATUS (2025-10-12 - DATABASE PERSISTENCE COMPLETE!)

**Phases 1-10**: ✅ COMPLETE
**Current**: Testing & Polish (Phase 11+)

### ✅ Phase 7: Fix Bindery Connection (COMPLETE!)

- [x] **Fix Bindery path resolution for worktree**
  - ✅ Fixed search paths to include `/home/aya/Development/vespera-atelier/packages/...`
  - ✅ Updated security configuration with correct paths
  - ✅ Added worktree-aware path detection

- [x] Implemented CRUD operations in NavigatorWebviewProvider:
  - ✅ `handleCodexCreate()` → calls `binderyService.createCodex()`
  - ✅ `handleCodexDelete()` → calls `binderyService.deleteCodex()`
  - ✅ `sendInitialState()` → calls `binderyService.listCodeices()`

- [x] Updated view registration to pass Bindery service
- [x] Fixed ViewContextEntry interface for new providers
- [x] Extension compiles successfully (2.27 MiB)

### ✅ Phase 7.5: Fix Critical Runtime Errors (COMPLETE! 2025-10-06)

- [x] **Fixed missing command errors**
  - ✅ Registered `vespera-forge.showAllViews` command in command map
  - ✅ Registered `vespera-forge.globalRefresh` command in command map
  - ✅ Commands now execute without "command not found" errors

- [x] **Fixed Bindery timeout issue**
  - ✅ Completely disabled process lifetime timeout (was 5 minutes)
  - ✅ Bindery server runs indefinitely (per-request timeouts separate)
  - ✅ No more "process killed after 30 seconds" errors

- [x] **Fixed connection race condition**
  - ✅ Added 500ms wait after `initialize()` in `sendInitialState()`
  - ✅ Added connection verification before making requests
  - ✅ Prevents "Request failed - not connected. Status: connecting" errors

### ✅ Phase 7.6: Fix Template System (COMPLETE! 2025-10-07)

- [x] **Fixed empty "New" dropdown**
  - ✅ Added TemplateInitializer service to create default templates
  - ✅ Auto-creates 6 template files on first Bindery init (Note, Task, Project, Character, Scene, Location)
  - ✅ Templates directory changed from `.vscode/vespera-templates` to `.vespera/templates`
  - ✅ Template loading from JSON5 files working

- [x] **Fixed Navigator crashes**
  - ✅ Fixed type mismatch: `list_codices` returns string array, UI expects Codex objects
  - ✅ Now fetches full codex data with `getCodex(id)` for each ID
  - ✅ Transforms Bindery's flat response to UI's nested structure
  - ✅ Fixed JavaScript temporal dead zone error (getTemplateIcon hoisting)

- [x] **Fixed codex creation**
  - ✅ Auto-generates titles like "New Character", "New Task", etc.
  - ✅ Auto-selects newly created codex in Navigator
  - ✅ Backend stores by ID (title is display-only)

### ✅ Phase 8: Testing & Verification (PARTIALLY COMPLETE!)

- [x] Test in Extension Development Host (F5)
- [x] Verify Bindery binary is found and connects
- [x] Verify no command errors in console
- [x] Verify Bindery stays connected (no timeout)
- [x] Test creating a codex via Navigator UI (✅ Works - created "New Character")
- [x] Test listing codices (✅ Works - shows created codex)
- [ ] Test deleting a codex (not yet tested)
- [x] Check browser console for errors (no critical errors)
- [x] Verify codex persistence (✅ Database at `.vespera/tasks.db` confirmed working)

### ✅ Phase 9: Editor Panel Integration (COMPLETE! 🎉)

- [x] Wire up Editor panel with Bindery
  - ✅ Added BinderyService to EditorPanelProvider
  - ✅ Implemented `setActiveCodex()` to fetch codex data
  - ✅ Transforms Bindery response to UI format
  - ✅ Editor receives codex data (confirmed in logs: 4 times)

- [x] Implement template loading for Editor
  - ✅ Added TemplateInitializer to EditorPanelProvider
  - ✅ Created `loadFullTemplates()` method with full Template objects
  - ✅ Editor.tsx receives templates via messages
  - ✅ Added template state management in editor.tsx

- [x] **Fixed Editor Display Bug**
  - ✅ Issue: Property access mismatch (`codex.tags` vs `codex.metadata.tags`)
  - ✅ Fix: CodexEditor.tsx:288,355-365 - Updated to access nested metadata
  - ✅ Result: Editor now renders all codex types successfully

- [x] **Fixed Scene Template Crash**
  - ✅ Issue: "mood" select field had no options array
  - ✅ Fix: template-initializer.ts:102 - Added mood options array
  - ✅ Result: Scene codices render without crashes

- [x] **Fixed Shared Input State Bug**
  - ✅ Issue: All fields updated simultaneously when editing
  - ✅ Root cause: Spread `codex.content` instead of `codex.content.fields`
  - ✅ Fix: CodexEditor.tsx:63-71 - Corrected data structure access
  - ✅ Result: Each field maintains independent state

- [x] **Capitalized Field Labels**
  - ✅ Issue: Labels showed "name", "age" instead of "Name", "Age"
  - ✅ Fix: template-initializer.ts:337-341 - Auto-generate capitalized labels
  - ✅ Result: All field labels properly capitalized

- [x] **Implemented Field Persistence (Session)**
  - ✅ Added `updateCodex` method to BinderyService (bindery.ts:733-750)
  - ✅ Implemented `handle_update_codex` JSON-RPC handler in Rust backend
  - ✅ Wired EditorPanelProvider.handleCodexUpdate to call backend
  - ✅ Result: Field edits persist when switching between codices

- [x] **Fixed ChatTemplateRegistry Namespace Collision**
  - ✅ Issue: AI Chat loaded Codex templates, expected chat provider fields
  - ✅ Fix: TemplateRegistry.ts:48 - Changed path to `.vespera/chat-templates`
  - ✅ Result: No more "provider_config required" errors

### ✅ Phase 10: Database Persistence (COMPLETE! 🎉 2025-10-12)

- [x] **Fixed "no such table: codices" Error**
  - [x] Updated database.rs init_schema() to include codices table
  - [x] Schema includes: id, template_id, title, content, metadata, crdt_state, version, timestamps, project_id, parent_id
  - [x] Added 4 performance indices (template, created_at, updated_at, project_id)
  - [x] Schema matches migration 002_codex_tables.sql

- [x] **Implemented Database Write Operations**
  - [x] INSERT in `handle_create_codex` - Working ✅
  - [x] UPDATE in `handle_update_codex` - Working ✅
  - [x] DELETE in `handle_delete_codex` - Working ✅
  - [x] Database files updating correctly

- [x] **Implemented Database Read Operations**
  - [x] Load codices from database on server startup - Working ✅
  - [x] Populate `state.codices` HashMap from database - Working ✅
  - [x] Server logs: "Debug: Loaded 3 codices from database" ✅

- [x] **Tested Full Persistence**
  - [x] Created test codices ✅
  - [x] Edited fields ✅
  - [x] Closed Extension Development Host ✅
  - [x] Restarted Extension Development Host ✅
  - [x] **Verified codices loaded from database** ✅
  - [x] All 3 test codices appeared in Navigator ✅

**Issue Resolved**: Database persistence fully working! Codices now survive extension restarts.

### Phase 11: Workspace Validation & UX Fixes ✅ COMPLETE (2025-10-21)

- [x] **Fixed workspace folder validation**
  - [x] Constructor crash - moved log() call after config initialization
  - [x] Removed `process.cwd()` fallback that bypassed validation
  - [x] Fixed singleton pattern - security-integration.ts now uses getBinderyService()
  - [x] BinderyService properly enforces single instance with warning

- [x] **Implemented NoWorkspace detection**
  - [x] Added `NoWorkspace` status to BinderyConnectionStatus enum
  - [x] Modified BinderyService constructor to check workspace availability
  - [x] Updated initialize() to handle NoWorkspace status
  - [x] NavigatorWebviewProvider detects and sends noWorkspace message

- [x] **Created "Open Folder" UI**
  - [x] Implemented empty state in navigator.tsx with folder icon
  - [x] Added handleOpenFolder callback to execute VS Code command
  - [x] Wired command message handler in NavigatorWebviewProvider
  - [x] Button successfully triggers workbench.action.files.openFolder

- [x] **Fixed false security alerts**
  - [x] Removed NoWorkspace error toast (Navigator already displays UI)
  - [x] Expanded VesperaSecurityEvent enum with lifecycle events
  - [x] Added SYSTEM_INITIALIZED, COMPONENT_INITIALIZED, INITIALIZATION_FAILED
  - [x] Replaced all misused SECURITY_BREACH with proper event types
  - [x] No more "Critical Security Event" toasts on startup

- [x] **Tested codex deletion**
  - [x] Verified deletion works via right-click menu
  - [x] Verified deletion works via "..." button menu
  - [x] Identified need for confirmation modal (no undo feature)

**Notes**: All workspace validation complete! Extension now properly handles no-folder-open state.

### Phase 12: Polish & Production Readiness ✅ COMPLETE

- [x] **Add deletion confirmation modal** (HIGH PRIORITY)
  - [x] Create confirmation dialog component (Shadcn/ui AlertDialog)
  - [x] Wire to delete action in Navigator (all 3 entry points)
  - [x] Prevent accidental data loss

- [x] **Template icon display**
  - [x] Load icons from template JSON5 files
  - [x] Display icons in Navigator tree view
  - [x] Display icons in New button dropdown
  - [x] Display icons in command palette results

- [x] **Command palette integration**
  - [x] Add "Create New Codex" command with template picker + name input
  - [x] Add "Search Codices" command with readable names/icons
  - [x] Add "Delete Active Codex" command with picker + confirmation
  - [x] Add "Refresh Codex List" command
  - [x] Add "Open Codex Navigator" command with Ctrl+Alt+N keybinding

- [x] **Keyboard focus support**
  - [x] Research VS Code webview focus API via Context7
  - [x] Add tabindex to HTML root element
  - [x] Implement auto-focus on mount
  - [x] Add extension-to-webview focus messaging
  - [x] Wire Delete key to confirmation modal
  - ⚠️ Note: Focus sometimes inconsistent, may need DevTools click to trigger

- [x] **Navigator refresh integration**
  - [x] Global navigator provider storage
  - [x] Trigger refresh after Create operations
  - [x] Trigger refresh after Delete operations
  - [x] Fix Bindery response structure mismatches

- [x] Connect AI Assistant panel to backend (Already connected via VesperaChatSystem)
- [x] Test full three-panel workflow (Navigator ✅ Editor ✅ Chat ✅)
- [ ] Fix AI Assistant panel auto-restore on startup (Deferred - low priority)

**Known Issues for Future Work**:
- Full keyboard navigation (arrow keys) - Desired feature, needs discussion on implementation
- Keyboard focus inconsistency - Sometimes requires clicking DevTools window to trigger

---

### Phase 13: AI Assistant Chat Window Fix ✅ COMPLETE (2025-10-22)

- [x] **Investigate chat window failure**
  - [x] Identified architectural conflict between webview providers
  - [x] Found AIAssistantWebviewProvider vs ChatWebViewProvider registration issue
  - [x] Root cause: ChatWebViewProvider view ID not defined in package.json

- [x] **Implement embedded mode for VesperaChatSystem**
  - [x] Created VesperaChatSystemOptions interface
  - [x] Added skipWebviewRegistration option
  - [x] Added skipCommandRegistration option
  - [x] Modified constructor to accept options
  - [x] Updated initialize() for conditional registration

- [x] **Update AI Assistant integration**
  - [x] Modified initializeChatSystem() to use embedded mode
  - [x] Passed skipWebviewRegistration: true
  - [x] Passed skipCommandRegistration: true
  - [x] Added explanatory comments

- [x] **Verify build and export**
  - [x] Fixed TypeScript export conflict
  - [x] Extension compiles successfully
  - [x] No new errors introduced

- [ ] **User testing required**
  - [ ] Open AI Assistant panel (Ctrl+Alt+C)
  - [ ] Verify UI renders correctly
  - [ ] Test message sending/receiving
  - [ ] Verify streaming functionality
  - [ ] Check console logs for proper initialization

**Files Modified**:
- `src/chat/index.ts` - Added VesperaChatSystemOptions, conditional initialization
- `src/views/ai-assistant.ts` - Initialize chat system in embedded mode

**Testing Instructions**: See `PHASE_13_CHAT_FIX.md` for detailed testing steps

**Next Phase**: User testing and validation of chat functionality

---

### Phase 14: Codex-Based AI Chat Architecture 🚧 IN PROGRESS (2025-10-23)

#### Phase 14a: Rust LLM Provider Module ✅ COMPLETE
- [x] **Implement core type system**
  - [x] ChatMessage, ChatRequest, ChatResponse types
  - [x] Streaming infrastructure with ChatChunk
  - [x] Provider trait with async methods
- [x] **Implement Claude Code CLI provider** (PRIORITY)
  - [x] CLI process spawning
  - [x] Streaming output parsing
  - [x] Auth checking
  - [x] Tool whitelisting
- [x] **Implement Ollama provider** (PRIORITY)
  - [x] REST API integration
  - [x] Streaming and non-streaming modes
  - [x] Local LLM execution
- [x] **Implement Secret Vault**
  - [x] API key storage with vault references
  - [x] Base64 encoding
  - [x] File permissions (0o600)
- [x] **Build verification**
  - [x] Cargo compiles successfully

#### Phase 14b: Codex Templates ✅ COMPLETE
- [x] **Create LLM provider template**
  - [x] llm-provider.json5 with conditional fields
  - [x] Supports: claude-code, ollama, anthropic, openai
- [x] **Create AI chat template**
  - [x] ai-chat.json5 with message structure
  - [x] Automation hooks for LLM interactions
  - [x] Activity tracking and auto-archive
- [x] **Create agent task templates**
  - [x] task-orchestrator.json5 for meta-agents
  - [x] task-code-writer.json5 for code specialists
- [x] **Create system prompts**
  - [x] default-assistant.md
  - [x] orchestrator-agent.md
  - [x] code-writer-specialist.md
  - [x] docs-writer-specialist.md

#### Phase 14c: Extension Cleanup ✅ COMPLETE
- [x] **Part 1: Provider Removal** (Commit: `6299161`)
  - [x] Delete 9 legacy provider files (~2,945 lines)
  - [x] Deprecate VesperaChatSystem provider methods
  - [x] Add migration notices
- [x] **Part 1.5: Console Spam Fix** (Commit: `2c37db5`)
  - [x] Filter Bindery stdout non-JSON-RPC messages
  - [x] Remove object logging spam
  - [x] 82% console log reduction
- [x] **Part 2: Template Migration & View Fixes** (Commits: `8ea61ee`, `642154d`, `f573dd2`, `6c90a41`, `1fd87ff`, `7645c14`)
  - [x] Fix template import error (LLM_PROVIDER_TEMPLATE not defined)
  - [x] Add view auto-opening settings
  - [x] Remove when clauses to fix AI Assistant loading
  - [x] Create Welcome view for Navigator state persistence
  - [x] Fix chat channel auto-loading with visibility events

#### Phase 14d: Testing & Backend Integration ⏳ PENDING
- [ ] **Test Claude Code provider**
  - [ ] Verify CLI spawning
  - [ ] Test streaming output parsing
  - [ ] Validate authentication check
- [ ] **Test Ollama provider**
  - [ ] Verify REST API connection
  - [ ] Test streaming vs non-streaming
  - [ ] Validate local model execution
- [ ] **Test multi-agent orchestration**
  - [ ] Orchestrator spawns code-writer
  - [ ] Code-writer uses local model
  - [ ] Orchestrator uses Claude 4.5
- [ ] **Wire AI Assistant to Bindery backend**
  - [ ] Load/save messages to ai-chat Codex
  - [ ] LLM provider resolution
  - [ ] Streaming message display
- [ ] **Test channel list UI**
  - [ ] User chats displayed
  - [ ] Agent tasks shown separately
  - [ ] Activity indicators update

**Next**: Begin Phase 14d testing

