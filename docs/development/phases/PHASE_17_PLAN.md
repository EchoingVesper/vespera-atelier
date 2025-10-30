# Phase 17: Codex Editor Implementation & System Polish

**Status**: Part 1 Complete ✅ (Oct 23-29, 2025), Ready for Part 2
**Duration**: Part 1: Oct 23-29, 2025 | Part 2: Starting 2025-10-29
**Context Window**: [HANDOVER_2025-10-29-1830.md](../handovers/HANDOVER_2025-10-29-1830.md)
**Related ADRs**:
- [ADR-001](../decisions/ADR-001-projects-fundamental.md) - Projects as Fundamental (superseded by ADR-015)
- [ADR-004](../decisions/ADR-004-dynamic-templates.md) - Dynamic Templates
- [ADR-012](../decisions/ADR-012-codices-as-file-containers.md) - Codices as File Containers ✨
- [ADR-013](../decisions/ADR-013-template-composition.md) - Template Composition ✨
- [ADR-014](../decisions/ADR-014-content-chunking.md) - Content Chunking ✨
- [ADR-015](../decisions/ADR-015-workspace-project-context-hierarchy.md) - Workspace/Project/Context Hierarchy ⭐ NEW
- [ADR-016](../decisions/ADR-016-global-registry-storage.md) - Global Registry + Workspace Storage ⭐ NEW
**Previous Phase**: [Phase 16b: Project-Centric UI Integration](./PHASE_16b_COMPLETE.md)

---

## Executive Summary

Phase 17 refactors the architectural foundation established in Phase 16b and completes the core Vespera Forge editing workflow. This phase has two major components:

**Part 1: Architectural Refactoring** (NEW - Critical Foundation)
- Refactor Phase 16b's "Projects" to "Contexts" within a proper three-level hierarchy (Workspace → Project → Context)
- Implement global registry in OS user directory (~/.vespera/) for cross-workspace project tracking
- Add workspace discovery algorithm supporting flexible VS Code folder opening

**Part 2: Editor Implementation**
- Implement Codex Viewer/Editor with template-driven forms for editing content
- Fix critical bugs preventing editor from displaying codices
- Complete template filtering by project context
- Add status bar integration and UI polish

**Rationale for Refactoring**: During planning, we discovered that "Projects" in Phase 16b are actually "organizational contexts" within real-world projects. A game development project naturally spans story development, mythology research, code implementation, and art - all different contexts using different template types. Fixing this now prevents compounding confusion and technical debt.

**Key Achievement Goals**:
1. Clean Workspace → Project → Context architecture matching real-world usage
2. End-to-end workflow: Navigator click → Editor display → Content edit → Save back to Bindery

---

## Objectives

### Primary Goals

**Part 1: Architectural Refactoring** ✅ **COMPLETE** (Clusters A-F, Oct 23-29, 2025)

- [x] **Refactor Workspace/Project/Context Hierarchy** ✅
  - Rename "Project" entities to "Context" throughout codebase
  - Add new "Project" layer above Context
  - Update database schema with new three-level hierarchy
  - Codices belong to Projects, appear in Contexts (many-to-many)

- [x] **Implement Global Registry** ✅
  - Create global registry in OS user directory (~/.vespera/)
  - Store cross-workspace project tracking
  - Implement platform-specific paths (Windows/macOS/Linux)
  - Sync mechanism between global registry and workspace data

- [x] **Implement Workspace Discovery** ✅
  - Search for `.vespera/` in current workspace
  - Search up directory tree (max 5 levels)
  - Check global registry for projects in current path
  - Prompt to initialize if not found

- [x] **Create Migration Script** ✅
  - Verified no Phase 16b data exists in production
  - Migration verification script created for future-proofing
  - All Phase 17 schema migrations tested and validated
  - UI updated to show Project + Context selectors

**Part 2: Editor Implementation** (AFTER REFACTORING)

- [x] **Implement Codex Viewer/Editor** ✅ **PARTIAL** (2025-10-30)
  - [x] Display codex content when clicked in Navigator ✅
  - [x] Render template-driven form fields ✅
  - [ ] Load and display codex metadata (tags, relationships)
  - [ ] Show timestamps and project/context info

- [x] **Fix Editor Data Flow Issues** ✅ (2025-10-30)
  - [x] Resolve "No Codex Selected" error when clicking codices ✅
  - [ ] Fix "Missing codex_id parameter" errors in AI Assistant
  - [x] Ensure proper message passing from Navigator → EditorPanel → Webview ✅
  - [x] Fix JSON5 template parsing (Context7 verified) ✅
  - [x] Convert template fields object to array format ✅

- [ ] **Implement Edit and Save Functionality**
  - Enable editing of codex content fields
  - Validate field values according to template schema
  - Save changes to file system (for file-backed Codices) AND database (metadata)
  - Show save confirmation/error messages
  - Update Navigator display after save

- [ ] **Complete Template Filtering by Context Type**
  - Filter templates in creation UI by active context's template type
  - Implement universal template pattern (`projectTypes: ["*"]`)
  - Show appropriate templates for current context

### Secondary Goals

- [ ] Add Status Bar Integration
  - Project status bar item showing current project
  - Click to switch projects
  - Update on project change

- [ ] Implement Command Palette Actions
  - Project commands (create, switch, settings)
  - Keyboard shortcuts for common operations

- [ ] Add UI Polish Features
  - Loading states for async operations
  - Error recovery and retry logic
  - Improved visual feedback

### Non-Goals

- Advanced rich text editing (TipTap/Monaco integration) - deferred to Phase 18
- Codex relationships graph visualization - deferred to Phase 18
- Automation rule UI - future phase
- Multi-codex bulk operations - future phase
- Project archival/export - future phase

---

## Current State Analysis

### What Works (Phase 16b Completion)

✅ **Project Management**:
- Projects can be created via wizard
- Project switching works in Navigator dropdown
- Active project persists across extension reloads
- Codices are created with `project_id` and persisted to SQLite

✅ **Navigator Display**:
- Codices display in tree view filtered by active project
- Project selector dropdown shows all projects
- Create/delete project actions functional

✅ **Bindery Integration**:
- JSON-RPC server communication working
- `list_codices` returns full objects with `project_id`
- `create_codex` persists to database successfully
- No timeout errors or deadlocks

### What's Broken (Current Issues)

❌ **Editor Display**:
- Clicking a codex in Navigator opens Editor panel
- Editor panel only shows "No Codex Selected" message
- Codex data is being fetched from Bindery successfully
- Message is being sent to webview correctly
- **Problem**: CodexEditor component not receiving/processing the codex data

❌ **AI Assistant Panel**:
- Errors: "Missing codex_id parameter" when loading channels
- AI Assistant tries to call `get_codex` without proper parameters
- **Problem**: AI Assistant is trying to use codices as channels but not passing codex_id correctly

❌ **Chat Feature Currently Disabled**:
- Chat responds with placeholder message: "Chat moved to Rust backend"
- Backend chat functions exist but haven't been tested yet
- **Problem**: Need to wire in backend chat functions and replace placeholder response
- **Priority**: Low (AI Assistant errors are higher priority)

### Log Evidence

From user's console logs:
```
[EditorPanelProvider] getCodex result: {...}
[EditorPanelProvider] Codex data from Bindery: {...}
[EditorPanelProvider] Sending message to webview: {type: 'setActiveCodex', payload: {...}}
[Editor] Received setActiveCodex message: {...}
[Editor] Setting active codex: {...}
```

The data flow IS working up to the webview. The issue is likely in the `CodexEditor` component itself not displaying the content when `codex` prop is set.

---

## Technical Approach

### Implementation Strategy

Phase 17 uses a **refactor-first, then-build approach**:

0. **Architectural Refactoring** (Stage 0): Fix foundational model before building more on it
1. **Diagnostic & Fix** (Stage 1): Fix editor data flow issues
2. **Implement Core Features** (Stage 2): Build out editing functionality
3. **Polish & Test** (Stage 3): Add template filtering and UI polish
4. **Validation** (Stage 4): End-to-end testing

#### Implementation Order

**Stage 0: Architectural Refactoring** (12-16 hours estimated) - **CRITICAL FOUNDATION**

**Why First**: Phase 16b's "Project" model doesn't match real-world usage. Refactoring now prevents building more code on flawed architecture.

**Strategy**: Use subagent orchestration with 26 discrete tasks organized into 7 clusters. Tasks within clusters can often run in parallel.

---

### ✅ Cluster 0: Architecture Documentation (DONE)
- ✅ **Task 0.1**: Create ADR-015 (Workspace/Project/Context Hierarchy)
- ✅ **Task 0.2**: Create ADR-016 (Global Registry + Workspace Storage)
- ✅ **Task 0.3**: Update Phase 17 plan with granular task breakdown

---

### ✅ Stage 0.5b: TypeScript Error Cleanup (COMPLETE)

**Duration**: 2025-10-29, ~2.5 hours
**Status**: ✅ COMPLETE
**Handover**: [HANDOVER_2025-10-29-1830.md](../handovers/HANDOVER_2025-10-29-1830.md)

**Objective**: Reduce VSCode extension TypeScript compilation errors from 211 to 0 before starting Part 1 architectural refactoring.

**Why Critical**: The 211 TypeScript errors were:
- Creating noise that made development difficult
- Consuming context tokens in every compilation check
- Masking real issues with type safety violations
- Blocking clean compilation needed for extension packaging

**Achievement**: ✅ 100% Error Reduction (211 → 0 errors)

**Files Fixed (45 total)**:
- **Test Files** (20 errors): ChatStateValidation.test.ts (13), ChatSessionPersistence.test.ts (7)
- **UI Components** (25 errors): chart.tsx (8), VesperaForge.tsx (9), ContextSelector.tsx (2), CodexNavigator.tsx (2), ProjectSelector.tsx (3), ai-assistant.tsx (1)
- **Core Files**: commands/index.ts (3), ChatManager.ts (unreachable code), contexts/index.ts (wrong export), lib/db.ts (index signature), MessageInput.tsx (ref init), NotificationConfigManager.ts (unused param), WorkspaceDiscovery.ts (2), critical-integration.test.ts (3)

**Key Techniques Applied**:
- Mock type casting with `as any` for test fixtures
- Null-safety guards (`if (array[0])`) before property access
- Enum usage (`FieldType.TEXT`) instead of string literals
- Type annotations for implicit `any` types
- `as unknown as Type` for incompatible conversions
- Index signature access (`process.env['NODE_ENV']`)

**Git Commits**:
- `65d1bcd` - "fix(typescript): Reduce TypeScript errors from 211 to 13 (94% reduction)"
- `1a5c6f6` - "fix(typescript): Complete TypeScript error cleanup - 0 errors! 🎉"

**Next Up**: Begin Phase 17 Part 1 - Architectural Refactoring (Cluster A: Database Schema)

---

### Cluster A: Database Schema (Rust Backend) - 5 tasks
**Estimated**: 3-4 hours | **Dependencies**: None | **Parallelization**: High

**Task A1: Create Projects Table Migration**
- Create new migration file `005_projects_table.sql`
- Define `projects` table schema per ADR-015
- Add indexes for `workspace_id`, `active_context_id`
- Include rollback SQL
- **Deliverable**: Migration file in `packages/vespera-utilities/vespera-bindery/migrations/`

**Task A2: Rename Projects → Contexts Migration**
- Create migration `006_rename_projects_to_contexts.sql`
- Rename `projects` table to `contexts`
- Add `project_id` column to contexts
- Update foreign key references
- Preserve all existing data
- **Deliverable**: Migration file with data preservation

**Task A3: Create Codex-Contexts Join Table**
- Create migration `007_codex_contexts_join.sql`
- Define `codex_contexts` many-to-many table
- Add primary key `(codex_id, context_id)`
- Add foreign keys with CASCADE delete
- Add `is_primary` boolean flag
- Add indexes for performance
- **Deliverable**: Migration file with indexes

**Task A4: Update Codices Table Schema**
- Create migration `008_update_codices_project_ref.sql`
- Modify `codices.project_id` to reference `projects` table
- Update foreign key constraints
- Ensure cascading deletes work correctly
- **Deliverable**: Migration file with constraint updates

**Task A5: Test All Migrations**
- Run migrations on test database in order
- Verify rollback works for each migration
- Test with sample Phase 16b data
- Document migration order and dependencies
- **Deliverable**: Test results, migration order documentation

---

### Cluster B: Global Registry (TypeScript/VS Code) - 4 tasks
**Estimated**: 3-4 hours | **Dependencies**: None | **Parallelization**: Medium

**Task B1: Platform-Specific Path Detection**
- Implement `getGlobalVesperaPath()` in new `src/services/GlobalRegistry.ts`
- Handle Windows (`%APPDATA%/Vespera`)
- Handle macOS (`~/Library/Application Support/Vespera`)
- Handle Linux (`~/.local/share/vespera` or `~/.vespera`)
- Add `VESPERA_REGISTRY_PATH` environment variable override
- **Deliverable**: Platform path utility with tests

**Task B2: Registry Schema & Persistence**
- Define `ProjectsRegistry` TypeScript interface
- Implement `loadRegistry()` and `saveRegistry()` functions
- Create JSON schema validation
- Handle corrupted registry (rebuild or reset)
- Add version field for future migrations
- **Deliverable**: Registry persistence module

**Task B3: Registry Sync Mechanism**
- Implement `syncProjectToRegistry()` function
- Update registry on project create/update/delete
- Handle registry vs workspace conflicts (last-write-wins)
- Add `last_opened` timestamp tracking
- **Deliverable**: Sync functions with conflict handling

**Task B4: Registry Initialization**
- Create `~/.vespera/` directory structure on first run
- Initialize empty `projects-registry.json` if not exists
- Create `templates/` and `cache/` subdirectories
- Log registry location for debugging
- **Deliverable**: Initialization logic in extension activation

---

### Cluster C: Discovery Algorithm (TypeScript/VS Code) - 3 tasks
**Estimated**: 2-3 hours | **Dependencies**: Cluster B complete | **Parallelization**: Low

**Task C1: Workspace .vespera/ Search**
- Implement `findWorkspaceVespera()` function
- Check current workspace root for `.vespera/`
- Load `workspace.json` metadata if found
- Handle permission errors gracefully
- **Deliverable**: Workspace search function

**Task C2: Directory Tree Traversal**
- Implement `searchUpForVespera(startPath, maxLevels=5)`
- Traverse up directory tree looking for `.vespera/`
- Stop at filesystem root
- Return closest match or null
- **Deliverable**: Tree traversal function

**Task C3: Discovery Orchestration & UI**
- Create `discoverVesperaWorkspace()` orchestration function
- Flow: workspace → tree → registry → init prompt
- Show initialization dialog if no workspace found
- Handle "No workspace" state gracefully
- Wire into `extension.ts` activation
- **Deliverable**: Complete discovery system integrated

---

### Cluster D: Service Refactoring (TypeScript/VS Code) - 5 tasks
**Estimated**: 4-5 hours | **Dependencies**: Cluster A complete | **Parallelization**: High

**Task D1: Rename ProjectService → ContextService**
- Copy `src/services/ProjectService.ts` → `src/services/ContextService.ts`
- Rename class `ProjectService` → `ContextService`
- Update file paths: `.vespera/contexts/` (was `.vespera/projects/`)
- Rename all internal references (methods, variables, comments)
- Keep functionality identical (just rename)
- **Deliverable**: `ContextService.ts` with renamed types

**Task D2: Create New ProjectService**
- Create new `src/services/ProjectService.ts` for real-world projects
- Implement CRUD operations (create, get, update, delete, list)
- Add project ↔ contexts relationship management
- Integrate with global registry (sync on changes)
- Add `active_context_id` tracking
- **Deliverable**: New `ProjectService.ts` managing real projects

**Task D3: Update Type Definitions**
- Create `src/types/context.ts` with `IContext` type (renamed from `IProject`)
- Update `src/types/project.ts` with new `IProject` type (real-world projects)
- Add `IWorkspace` type for workspace metadata
- Ensure backward compatibility where possible
- **Deliverable**: Updated type definitions

**Task D4: Update Navigator Integration**
- Add Project selector dropdown to Navigator header
- Convert existing dropdown to Context switcher
- Update Navigator tree filtering to use `activeContextId`
- Show Project > Context hierarchy in UI
- **Deliverable**: Updated Navigator UI components

**Task D5: Update All Service References**
- Find all `import { ProjectService }` statements
- Update to `import { ContextService }` where appropriate
- Update variable names (`activeProjectId` → `activeContextId`)
- Update webview message types
- Verify no broken imports
- **Deliverable**: Codebase-wide refactoring complete

---

### Cluster E: Migration & Data Preservation - 3 tasks
**Estimated**: 2-3 hours | **Dependencies**: Clusters A, D complete | **Parallelization**: Low

**Task E1: Create Migration Script**
- Create `src/migration/migratePhase16bToPhase17.ts`
- Implement `migratePhase16bToPhase17()` function
- Convert old "projects" JSON files → new "contexts"
- Create default Project for workspace
- Link existing Codices to new Project
- **Deliverable**: Migration script

**Task E2: Codex-Context Linking**
- Populate `codex_contexts` join table during migration
- Set `is_primary = true` for each codex's original context
- Update `codices.project_id` to point to new default Project
- Verify all codices have valid project + context relationships
- **Deliverable**: Join table population logic

**Task E3: Test Migration with Sample Data**
- Create test workspace with Phase 16b projects and codices
- Run migration script
- Verify all data preserved correctly (no data loss)
- Test Navigator displays migrated data
- Test rollback capability
- **Deliverable**: Migration test suite

---

### Cluster F: Integration & Validation - 4 tasks
**Estimated**: 3-4 hours | **Dependencies**: All previous clusters | **Parallelization**: Low

**Task F1: Update Bindery JSON-RPC Calls**
- Update `src/services/bindery.ts` for new schema
- Add `getContext()`, `listContexts()` methods
- Update `createCodex()` to accept `project_id` + `context_ids[]`
- Add `linkCodexToContext()` for many-to-many
- Test all CRUD operations
- **Deliverable**: Updated Bindery service layer

**Task F2: End-to-End CRUD Testing**
- Test: Create project → create context → create codex
- Test: Codex appears in multiple contexts
- Test: Project/context deletion cascades correctly
- Test: UI updates after CRUD operations
- **Deliverable**: Integration test suite

**Task F3: Discovery Algorithm Testing**
- Test opening VS Code at workspace root
- Test opening VS Code 3 levels deep in project
- Test global registry lookup
- Test initialization flow on fresh system
- Test on Windows/macOS/Linux (if possible)
- **Deliverable**: Discovery test results

**Task F4: Performance & Data Integrity**
- Test with 50+ projects, 200+ contexts, 1000+ codices
- Verify no data loss during migration
- Check database constraints enforced (foreign keys, cascades)
- Profile query performance (should be <100ms)
- **Deliverable**: Performance benchmarks

---

### Cluster G: Documentation - 2 tasks
**Estimated**: 1-2 hours | **Dependencies**: All implementation complete | **Parallelization**: High

**Task G1: Update Architecture Docs**
- Update `docs/architecture/core/PROJECT_CENTRIC_ARCHITECTURE.md`
- Add migration guide in `docs/guides/MIGRATION_PHASE_16B_TO_17.md`
- Document new API surface in architecture docs
- Update code examples to use new hierarchy
- **Deliverable**: Updated architecture documentation

**Task G2: Create Migration Runbook**
- Document step-by-step migration process for users
- Add troubleshooting section (common errors)
- Create rollback instructions
- Include testing checklist
- **Deliverable**: `docs/guides/PHASE_17_MIGRATION_RUNBOOK.md`

---

### Execution Strategy

**Total Tasks**: 26 discrete subagent tasks across 7 clusters

**Recommended Execution Order**:
1. **Cluster 0** (✅ DONE) - Architecture documentation
2. **Cluster A** - Database schema (foundation)
3. **Cluster B** - Global registry (needed for discovery)
4. **Cluster C** - Discovery algorithm
5. **Cluster E** - Migration script (critical for data preservation)
6. **Cluster D** - Service refactoring (after backend ready)
7. **Cluster F** - Integration testing
8. **Cluster G** - Documentation

**Parallelization Opportunities**:
- **Cluster A**: All 5 tasks can run in parallel (independent migrations)
- **Cluster B**: Tasks B1-B2 can run in parallel, B3-B4 depend on B2
- **Cluster D**: Tasks D1, D2, D3 can run in parallel (separate files)
- **Cluster G**: Both tasks can run in parallel

**Time Estimates**:
- Cluster A: 3-4 hours
- Cluster B: 3-4 hours
- Cluster C: 2-3 hours
- Cluster D: 4-5 hours
- Cluster E: 2-3 hours
- Cluster F: 3-4 hours
- Cluster G: 1-2 hours
- **Total**: 18-25 hours (~3-4 context windows)

**Stage 1: Diagnostic & Bug Fixes** (2-3 hours)
1. Investigate CodexEditor component - why isn't it displaying the codex?
2. Check if `codex` and `template` props are being passed correctly
3. Look for conditional rendering that might hide content
4. Fix the "No Codex Selected" issue
5. Fix AI Assistant "Missing codex_id parameter" errors

**Stage 2: Core Editor Implementation** (6-8 hours)
6. Implement template-driven field rendering
7. Add form state management for editing
8. Implement save functionality (call `updateCodex` via Bindery)
9. Add validation for field values
10. Display metadata (tags, relationships, timestamps)
11. Show project info in editor header

**Stage 3: Template Filtering & Polish** (3-4 hours)
12. Implement template filtering by project type
13. Add universal template support (`projectTypes: ["*"]`)
14. Create status bar indicator
15. Add command palette actions
16. Implement loading states and error handling

**Stage 4: End-to-End Testing & Validation** (2-3 hours)
17. Test complete workflow: Create → Edit → Save → Navigator update
18. Test project switching with editor open
19. Test error cases (save failures, invalid data)
20. Performance testing (large codices, many templates)

### Architecture Integration Points

**Components to Modify**:
- `CodexEditor.tsx` (PRIMARY) - Fix display, implement editing
- `EditorPanelProvider.ts` - Verify message passing logic
- `AIAssistantPanel.ts` - Fix get_codex parameter passing
- `NavigatorWebviewProvider.ts` - Add editor refresh on save
- Template loading system - Add project type filtering

**New Components to Create**:
- `ProjectStatusBarItem.ts` - Status bar integration
- `TemplateFieldRenderer.tsx` - Template-driven form fields (if not exists)
- Command handlers for project operations

---

## Prerequisites

Before starting Phase 17:

- [x] Phase 16b complete (Stages 1-3)
- [x] Bindery server operational and tested
- [x] Navigator displaying codices correctly
- [x] Project-aware codex creation working
- [ ] User approval of Phase 17 plan
- [ ] Decision: Should editor be full-screen or keep three-panel layout?
- [ ] Decision: What fields should be editable in MVP? (all template fields vs subset)

---

## Implementation Details

### Stage 1: Diagnostic & Bug Fixes

**Task 1.1: Investigate CodexEditor Component**
- Read `CodexEditor.tsx` component implementation
- Check conditional rendering logic (why "No Codex Selected"?)
- Verify prop types match what EditorPanelProvider sends
- Look for console errors in browser dev tools
- **Expected outcome**: Identify root cause of display issue

**Task 1.2: Fix Editor Display**
- Fix whatever is preventing codex from rendering
- Ensure template data is being used correctly
- Add debug logging to track data flow
- **Expected outcome**: Clicking codex shows its data in editor

**Task 1.3: Fix AI Assistant get_codex Errors**
- Find where AI Assistant calls `get_codex`
- Ensure `codex_id` parameter is passed correctly
- May need to change how AI Assistant loads channels
- **Expected outcome**: No more "Missing codex_id parameter" errors

### Stage 2: Core Editor Implementation

**Task 2.1: Template-Driven Field Rendering**
- Render form fields based on template schema
- Support field types: text, textarea, select, number, date, tags
- Use template field metadata (label, description, validation)
- Implement readonly vs editable fields
- **Expected outcome**: Template fields display in editor

**Task 2.2: Form State Management**
- Track edited field values in component state
- Detect unsaved changes
- Show "unsaved changes" indicator
- Prevent accidental navigation with unsaved changes
- **Expected outcome**: Editing fields updates local state

**Task 2.3: Save Functionality**
- Add "Save" button to editor toolbar
- Call `Bindery.updateCodex(id, updatedData)` on save
- Transform UI format back to Bindery format
- Show success/error toast notifications
- Update Navigator after successful save
- **Expected outcome**: Save button persists changes to database

**Task 2.4: Metadata Display**
- Show codex title (editable)
- Display tags (editable tag list)
- Show relationships (read-only for MVP)
- Display created_at and updated_at timestamps
- Show project name and type
- **Expected outcome**: Full codex metadata visible

### Stage 3: Template Filtering & Polish

**Task 3.1: Template Filtering by Project Type**
- Modify template loading in codex creation
- Filter templates where `projectTypes` includes current project type
- Always include universal templates (`projectTypes: ["*"]`)
- Show template count in creation UI
- **Expected outcome**: Only relevant templates shown when creating codices

**Task 3.2: Status Bar Integration**
- Create `ProjectStatusBarItem` class
- Show: `$(project) {projectName}` in status bar
- Click to open project switcher QuickPick
- Update on project change events
- Position in left section of status bar
- **Expected outcome**: Status bar shows current project

**Task 3.3: Command Palette Actions**
- Register commands:
  - `vespera.project.create` → Show project creation wizard
  - `vespera.project.switch` → Show project switcher QuickPick
  - `vespera.project.settings` → Open project settings (placeholder for MVP)
- Add keyboard shortcuts in package.json
- **Expected outcome**: Commands available in palette

**Task 3.4: UI Polish**
- Add loading spinners for async operations
- Improve error messages (user-friendly)
- Add retry logic for failed saves
- Implement auto-save (optional)
- Add "Revert changes" button
- **Expected outcome**: Professional, polished UX

---

## Success Criteria

Phase 17 is complete when:

### User Experience Criteria

1. **Complete Editing Workflow**:
   - User clicks codex in Navigator → Editor opens with content loaded
   - User edits fields → Changes tracked in UI
   - User clicks Save → Changes persist to database
   - Navigator reflects updates (if title changed)

2. **Project Integration**:
   - Status bar shows current project
   - Template list filters by project type
   - Universal templates always available
   - Project switching works smoothly

3. **Error Handling**:
   - Clear error messages for save failures
   - Retry options for transient errors
   - Unsaved changes warning
   - No "Missing codex_id" errors

### Technical Criteria

1. **Data Flow**:
   - Navigator click → EditorPanel.setActiveCodex() → Bindery.getCodex() → WebView message → CodexEditor render
   - Editor save → Bindery.updateCodex() → Database persist → Navigator refresh

2. **Template System**:
   - Templates filter by `projectTypes` metadata
   - Universal templates (`projectTypes: ["*"]`) always show
   - Template fields render correctly in editor

3. **Quality**:
   - No console errors during normal operation
   - All new code has TypeScript types
   - Critical paths have error handling
   - Manual testing of full workflow passes

---

## Known Issues to Fix

From Phase 16b completion document:

1. **Codex Viewer Not Loading Content** (HIGH PRIORITY - Phase 17 Stage 1)
   - **Severity**: High (blocks editing workflow)
   - **Description**: Editor panel shows "No Codex Selected" instead of loading content
   - **Root Cause**: CodexEditor component not processing received codex data
   - **Fix**: Stage 1 diagnostic and fix

2. **Missing codex_id Parameter Errors** (HIGH PRIORITY - Phase 17 Stage 1)
   - **Severity**: High (blocks AI Assistant)
   - **Description**: AI Assistant panel calls `get_codex` without proper parameters
   - **Root Cause**: AI Assistant loading channels using codices incorrectly
   - **Fix**: Correct parameter passing in AI Assistant channel loading

3. **Template Filtering Not Implemented** (MEDIUM PRIORITY - Phase 17 Stage 3)
   - **Severity**: Medium (UX issue, not blocking)
   - **Description**: All templates show regardless of project type
   - **Root Cause**: Infrastructure exists but filtering not yet implemented
   - **Fix**: Stage 3 template filtering task

---

## Design Decisions

### 1. Editor Layout: Full-Screen vs Three-Panel?

**Question**: Should editor take full screen when editing a codex, or maintain three-panel layout?

- **Option B**: Three-panel layout (Navigator | Editor | AI Assistant)
  - Pros: Maintains context, can reference other codices, AI Assistant available
  - Cons: Less space for editor, more complex layout

**Recommendation**: Option B (three-panel) for MVP, Option A as toggle in future
- Matches architecture document's three-panel design
- Users can close AI Assistant panel if they need more space
- Future: Add "Focus Mode" toggle for full-screen editing

**User Answer**: Option B, with toggle for "focus mode" in the future, as suggested.

---

### 2. What Fields Are Editable in MVP?

**Question**: Should all template fields be editable, or start with a subset?

**Recommendation**: Option A (all fields) with progressive enhancement
- Text, textarea, tags: Implement fully in Stage 2
- Select, number, date: Simple implementations in Stage 2
- References, rich text: Basic display + edit in Stage 3, full UX in Phase 18
- Rationale: Template system is core to architecture, should work end-to-end

**User Answer**: This sounds fine for now, but I need to reiterate something here. Many Codex types are intended to be containers for other file types, including documents of many sorts (.md most important), but also sound and video files, images, and even code files. Codices are, in essence, a way for me to attempt to link all files into the database such that they can be managed by both the task system and the RAG (vector and graph) system for automated context management for LLMs and users alike.

The user will need to be able to import and index outside data into Codices automatically, to aid with organization. Codices are in many ways effectively a way for me to add specialized metadata to any file for use in managing them.

These files will eventually need editors of their own, because the ultimate goal here is to make a single, comprehensive, management system for any sort of project, whether a novel, a video game, a journalistic magazine, a tabletop RPG, an art book, and so on and on. This is why there's such a huge emphasis on templates; because this thing is intended to be a chameleon that transforms based on an individual user and project's needs and desires.

Now, we don't need most of those editors for the MVP. The MVP needs to deal with Codices embedded with .md and code files, primarily, both of which can likely use the built-in VS Code Editor which is already well-equipped for such tasks. Stuff like rich text and other editor types can wait until later, .md can be put into view mode and works well enough for a "rich text experience" for now.

---

### 3. Auto-Save vs Manual Save?

**Question**: Should changes auto-save as user types, or require manual save action?

**Options**:
- **Option A**: Auto-save (debounced, like Google Docs)
  - Pros: Never lose work, familiar UX, no "save" anxiety
  - Cons: More complex state management, potential for partial saves

- **Option B**: Manual save with unsaved changes tracking
  - Pros: User controls when changes persist, simpler implementation
  - Cons: Risk of losing work if extension crashes

**Recommendation**: Option B (manual save) for MVP, Option A in future
- Manual save is simpler and matches VS Code patterns
- Add "unsaved changes" indicator + navigation warning
- Add keyboard shortcut (Ctrl+S) for quick save
- Future: Add auto-save preference in project settings

**User Answer**: We'll go with your recommendation for now, but I absolutely plan on making your Option A the default eventually. Programs that auto-save have spoiled me and I really much prefer that method.

---

## Estimated Timeline

- **Stage 0 (Architectural Refactoring)**: 3-5 hours
- **Stage 1 (Diagnostic & Fixes)**: 2-3 hours
- **Stage 2 (Core Editor)**: 6-8 hours
- **Stage 3 (Template Filtering & Polish)**: 3-4 hours
- **Stage 4 (Testing & Validation)**: 2-3 hours
- **Total**: 16-23 hours (~3 context windows)

**Note**: Stage 0 is critical foundation work that refactors Phase 16b's Project/Context model. Attempting to build the editor before this refactoring risks building on flawed architecture.

---

## Risk Mitigation

### Risk 1: CodexEditor Component Complexity

- **Risk**: CodexEditor may have unexpected complexity or dependencies
- **Mitigation**: Read component thoroughly before making changes, understand existing patterns
- **Contingency**: Create new simplified editor component if existing one is too complex

**User Note**: **DO NOT** create simplified versions of components if existing one is too complex. Instead, modularize the complex one into smaller pieces. Simplified versions tend to end up cluttering the repo with orphaned files that confuse later agents.

### Risk 2: Template Schema Inconsistencies

- **Risk**: Templates may have inconsistent schemas, breaking field rendering
- **Mitigation**: Validate template schemas on load, add fallback rendering for unknown field types
- **Contingency**: Document template schema requirements, fix templates rather than code if needed

**User Note**: Standardize template schemas *first* and then add validation and fallbacks. Templates are the very core of the system and need to be as carefully constructed as possible. Recommend creating defined subcomponents templates are allowed to contain. Just as with Codices themselves, templates should also be able to contain links to *other templates* for creation of pre-designed nested Codices. This is important to the Task automation system.

### Risk 3: Save Conflicts with Multiple Editors

- **Risk**: Opening same codex in multiple editor panels could cause save conflicts
- **Mitigation**: Use singleton EditorPanelProvider pattern (already implemented)
- **Contingency**: Add last-write-wins strategy with conflict notification

**User Note**: The Bindery has CRDT infrastructure in place. The eventual plan is to allow multi-user simultaneous editing like Google Docs. Consider using the Bindery's CRDT infrastructure to assist.

### Risk 4: Performance with Large Codices

- **Risk**: Large codices (>10k characters) may slow down editor
- **Mitigation**: Profile rendering performance, add virtualization if needed
- **Contingency**: Add pagination or "expand" sections for large content fields

**User Note**: Add virtualization from the start. That said, I want templates to have optional(?) fields like "max size of content" for users to create templates to force themselves to break up their ideas into better organization. (Or for forcing modular code creation, by preventing files from growing too big.) These will also be helpful for the RAG system, by breaking content into defined chunks.

---

## Deliverables

### Stage 0: Architectural Refactoring ✅ **COMPLETE**

- [x] ADR-015: Workspace/Project/Context Hierarchy ✅
- [x] ADR-016: Global Registry + Workspace Storage ✅
- [x] Updated ADR README.md ✅
- [x] Updated Phase 17 plan with new architecture ✅
- [x] **Stage 0.5b: TypeScript Error Cleanup (211 → 0 errors)** ✅
- [x] Refactored database schema (projects/contexts split) ✅
- [x] Global registry implementation (~/.vespera/) ✅
- [x] Discovery algorithm (workspace → tree → registry) ✅
- [x] UI updates (Project selector + Context switcher) ✅
- [x] Phase 16b migration verification ✅
- [x] Updated Bindery integration for new schema ✅

### Stage 1-4: Editor Implementation

- [ ] Fixed `CodexEditor.tsx` - Displays codex content
- [ ] Fixed AI Assistant channel loading - Correct get_codex parameters
- [ ] Updated `EditorPanelProvider.ts` - Any necessary message passing fixes
- [ ] `TemplateFieldRenderer.tsx` - Template-driven form fields (if new)
- [ ] `ProjectStatusBarItem.ts` - Status bar integration
- [ ] Updated template loading - Context type filtering (renamed from project type)
- [ ] Updated command registration - Project and Context commands
- [ ] Integration tests for editor workflow
- [ ] Manual testing checklist

### Documentation

- [x] ADR-015: Workspace/Project/Context Hierarchy ✅
- [x] ADR-016: Global Registry + Workspace Storage ✅
- [ ] Phase 17 completion report (PHASE_17_COMPLETE.md)
- [ ] Updated user guide with editing workflows
- [ ] Updated CLAUDE.md if new patterns emerged
- [ ] API documentation for new components

### Quality Assurance

- [ ] All primary objectives met
- [ ] No regressions in Phase 16b features
- [x] **TypeScript compilation clean (0 errors)** ✅
- [ ] Manual testing of complete workflow passes
- [ ] Error handling tested (save failures, invalid data)

---

## Context for AI Assistant

### Quick Start for This Phase

**If picking up Phase 17 mid-execution:**

1. **Read these files first** (in order):
   - [HANDOVER_2025-10-29-1830.md](../handovers/HANDOVER_2025-10-29-1830.md) - ✨ Most recent context (Stage 0.5b complete)
   - [PHASE_16b_COMPLETE.md](./PHASE_16b_COMPLETE.md) - Previous phase completion
   - **This file** - Phase 17 plan
   - [CLAUDE.md](../../../CLAUDE.md) - Development instructions

2. **Key mental models to understand**:
   - **Data flow**: Navigator → EditorPanel → Bindery → WebView → CodexEditor
   - **Template-driven UI**: All forms rendered from template schemas, no hardcoded fields
   - **Workspace → Project → Context hierarchy**: Three-level architecture (ADR-015)

3. **Current focus area**: Ready to begin Part 1 - Architectural Refactoring (Cluster A: Database Schema)

### System Architecture Overview

```
Vespera Forge Extension (VS Code)
├── Views
│   ├── Navigator (✅ WORKING - Phase 16b)
│   │   ├── Project selector dropdown
│   │   ├── Codex tree (filtered by project)
│   │   └── Click codex → Opens EditorPanel
│   │
│   ├── EditorPanel (🚧 BROKEN - Phase 17 Stage 1)
│   │   ├── Fetches codex from Bindery ✅
│   │   ├── Sends message to webview ✅
│   │   └── Webview displays content ❌
│   │
│   └── AI Assistant (🚧 BROKEN - Phase 17 Stage 1)
│       └── get_codex parameter errors ❌
│
├── Webview (React)
│   ├── editor.tsx (✅ Receives messages)
│   └── CodexEditor.tsx (❌ Doesn't display)
│
└── Bindery Backend (✅ WORKING)
    ├── JSON-RPC server
    ├── SQLite database
    └── CRUD operations
```

### Common Pitfalls & Gotchas

1. **Message Format Mismatch**
   - **What**: Webview expects different message format than extension sends
   - **Why**: EditorPanel transforms Bindery format to UI format
   - **How to handle**: Check message payloads match expected structure

2. **Template ID vs Template Object**
   - **What**: Codex has `template_id` string, but editor needs full Template object
   - **Why**: Template data needed for field rendering
   - **How to handle**: EditorPanel loads templates and sends both codex + templates

3. **Project Filtering Happens Client-Side**
   - **What**: Bindery returns all codices, extension filters by project_id
   - **Why**: Simpler server implementation
   - **How to handle**: Always check projectId when filtering

4. **Extension Must Be Reloaded After Code Changes**
   - **What**: TypeScript changes don't hot-reload
   - **Why**: Standard VS Code extension behavior
   - **How to handle**: `F1 → Developer: Reload Window` after `npm run compile`

### Important File Locations

**Editor Implementation**:
- **Panel provider**: `plugins/VSCode/vespera-forge/src/views/EditorPanelProvider.ts`
- **React webview**: `plugins/VSCode/vespera-forge/src/webview/editor.tsx`
- **Editor component**: `plugins/VSCode/vespera-forge/src/vespera-forge/components/editor/CodexEditor.tsx` (TO INVESTIGATE)

**Supporting Files**:
- **Navigator**: `plugins/VSCode/vespera-forge/src/views/NavigatorWebviewProvider.ts`
- **Bindery Service**: `plugins/VSCode/vespera-forge/src/services/bindery.ts`
- **Template System**: `plugins/VSCode/vespera-forge/src/services/template-initializer.ts`

**Backend**:
- **Bindery server**: `packages/vespera-utilities/vespera-bindery/src/bin/server.rs`
- **Database**: `packages/vespera-utilities/vespera-bindery/src/database.rs`

### Commands to Run

```bash
# Navigate to extension directory
cd plugins/VSCode/vespera-forge

# Build extension
npm run compile

# Watch mode (auto-compile on changes)
npm run watch

# Run tests (when added)
npm test

# Check TypeScript errors only (ignore warnings)
npm run compile 2>&1 | grep "error TS"

# In VS Code:
# - F5: Launch extension in debug mode
# - F1 → Developer: Reload Window: Reload after code changes
# - F1 → Developer: Toggle Developer Tools: View console logs (webview)
# - Ctrl+Shift+I: Extension host console logs
```

---

## References

### Phase Tracking
- **Previous**: [Phase 16b: Project-Centric UI Integration](./PHASE_16b_COMPLETE.md)
- **Current**: **Phase 17: Codex Editor Implementation & System Polish** (this document)
- **Next**: Phase 18: Advanced Editing Features (to be planned)

### Architecture Decision Records
- [ADR-001: Projects as Fundamental](../decisions/ADR-001-projects-fundamental.md) - Core architecture
- [ADR-004: Dynamic Templates Over Hardcoded Types](../decisions/ADR-004-dynamic-templates.md) - Template system
- [ADR-007: Codex-Based Folders](../decisions/ADR-007-codex-folders.md) - Navigator structure

### Architecture Documentation
- [Template System Architecture](../../architecture/core/TEMPLATE_SYSTEM_ARCHITECTURE.md) - Template field rendering
- [UI Architecture Three-Panel Design](../../architecture/core/UI-Architecture-Three-Panel-Design.md) - Layout design
- [Project-Centric Architecture](../../architecture/core/PROJECT_CENTRIC_ARCHITECTURE.md) - Project context

### Git Commits (Phase 16b)
- `5f62763` - "docs: Phase 16b completion"
- `080dfff` - "fix(vespera-forge): Fix Navigator to process full codex objects"
- `81707ac` - "fix(bindery): Include project_id in list_codices results"

---

## Appendix

### Current Error Logs

From user's console (truncated in original message):

```javascript
console.ts:137 [Extension Host] [BinderyService] Response contains error for request 3 - Error: {"code":-32603,"message":"Internal error","data":{"details":"Missing codex_id parameter"}}
console.ts:137 [Extension Host] [BinderyService] Response contains error for request 4 - Error: {"code":-32603,"message":"Internal error","data":{"details":"Missing codex_id parameter"}}
```

These errors occur when AI Assistant tries to load channels. Need to investigate AI Assistant channel loading logic.

### Team Notes

**For Future Developers**:
- The editor infrastructure exists, it's just not displaying content
- Don't rebuild the editor from scratch - fix the existing components
- The Bindery integration is solid, trust the data flow
- Template system is well-architected, use it as designed

**Success Factors from Phase 16b**:
- Incremental approach prevented scope creep
- Focus on critical path (Navigator first) provided visible progress
- Excellent error diagnostics made debugging faster
- Phase-by-phase documentation helps context preservation

**Apply to Phase 17**:
- Start with diagnostic investigation before writing code
- Fix one issue at a time, test thoroughly
- Keep focus on core editing workflow
- Document any gotchas discovered for next phase

---

*Phase plan created: 2025-10-25*
*Template version: 1.0.0*
*Documentation by: Claude Code (Sonnet 4.5)*
