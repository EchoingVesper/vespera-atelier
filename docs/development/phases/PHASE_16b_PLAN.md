# Phase 16b: Project-Centric UI Integration

**Status**: Complete (Stages 1-3), Stage 4 deferred to Phase 17
**Duration**: 2025-10-24 (3 context windows / ~12-15 hours)
**Context Window**: Windows 1-3 (Oct 24, 2025)
**Completion Document**: [PHASE_16b_COMPLETE.md](./PHASE_16b_COMPLETE.md)
**Related ADRs**: [ADR-001](../decisions/ADR-001-projects-fundamental.md), [ADR-004](../decisions/ADR-004-dynamic-templates.md), [ADR-007](../decisions/ADR-007-codex-folders.md), [ADR-011](../decisions/ADR-011-surgical-cleanup-before-architecture.md)
**Previous Phase**: [Phase 16a: Surgical Cleanup & Foundation](./PHASE_16a_COMPLETE.md)

---

## Executive Summary

Phase 16b implements the complete project-centric user experience, transforming the foundation from Phase 16a into a fully functional system where projects are fundamental to all operations. This phase wires up the ProjectService to the UI, implements project creation/switching workflows, adds template filtering by project type, and enforces project context for all Codex operations. Users will experience a clear, project-first workflow with automatic context management and smart template filtering.

---

## Objectives

### Primary Goals

- [ ] **Wire Project UI to Service Layer**: Connect ProjectSelector component to ProjectService with real data
- [ ] **Implement Welcome Flow**: First-time user experience that guides project creation
- [ ] **Build Project Creation Wizard**: Multi-step form for creating new projects with type selection
- [ ] **Add Project Switcher**: Quick project switching in Navigator with active project indicator
- [ ] **Enforce Project Context**: Require project selection before Codex creation (no orphaned Codices)
- [ ] **Implement Template Filtering**: Filter templates by active project type using Hierarchical Template System
- [ ] **Add Project Status Indicator**: Status bar item showing current project
- [ ] **Create Project-Aware Navigation**: Filter Navigator tree by active project

### Secondary Goals

- [ ] Implement project settings editor (in-UI configuration)
- [ ] Add project statistics dashboard (Codex count, recent activity)
- [ ] Create command palette actions for project operations
- [ ] Add keyboard shortcuts for common project actions
- [ ] Implement project search/filter in selector

### Non-Goals

- Full project templates with pre-configured workflows (deferred to Phase 17)
- Project archival/export functionality (deferred to Phase 17)
- Cross-project Codex linking (deferred to Phase 17+)
- Project collaboration features (future)
- Advanced project permissions (future)

---

## Technical Approach

### Implementation Strategy

Phase 16b uses a **feature-by-feature incremental approach** rather than parallel orchestration. Each feature builds on the previous, allowing for testing and validation at each step.

#### Implementation Order

**Stage 1: Core Integration** (Session 1, first half)
1. Wire ProjectSelector to ProjectService
2. Implement active project state management
3. Add project context provider for React components
4. Create basic project switcher in Navigator

**Stage 2: Project Creation** (Session 1, second half)
5. Implement welcome screen for first-time users
6. Build project creation wizard UI
7. Add project type selection with descriptions
8. Wire creation wizard to ProjectService

**Stage 3: Template & Codex Integration** (Session 2)
9. Implement template filtering by project type
10. Update Codex creation to require project context
11. Add project ID to Codex frontmatter on creation
12. Filter Navigator tree by active project

**Stage 4: Polish & UX** (Session 3)
13. Add project status indicator to status bar
14. Implement command palette actions
15. Add keyboard shortcuts
16. Create project settings UI

### Architecture Integration Points

**Services**:
- `ProjectService` (existing) - CRUD operations, persistence
- `BinderyService` (to modify) - Add project context to Codex operations
- Template system (to modify) - Filter templates by project type

**UI Components**:
- `ProjectSelector` (existing scaffold) - Wire to service, add real data
- `Navigator` (existing) - Add project switcher, filter tree by project
- `CodexEditor` (existing) - Validate project context on creation
- New: `WelcomeScreen` - First-time user flow
- New: `ProjectCreationWizard` - Multi-step project setup
- New: `ProjectStatusBarItem` - Status bar indicator

**State Management**:
- Active project stored in workspace state (persistent across sessions)
- Project list cached in memory (reload on file changes)
- Template filtering uses active project type

---

## Prerequisites

Before starting Phase 16b:

- [x] Phase 16a complete (foundation ready)
- [x] ProjectService implemented with tests
- [x] Project type system defined
- [x] UI scaffolding ready
- [ ] User approval of Phase 16b plan
- [ ] Decision: Default project handling for legacy Codices?
- [ ] Decision: Project creation UX flow (modal vs sidebar)?

---

## Implementation Details

### Stage 1: Core Integration

**Task 1.1: Wire ProjectSelector to ProjectService**
- Remove mock data from ProjectSelector.tsx
- Add ProjectService integration
- Implement project list loading on component mount
- Add error handling and loading states

**Task 1.2: Active Project State Management**
- Create ProjectContext provider (React Context)
- Store active project ID in VS Code workspace state
- Persist across extension restarts
- Emit events on project change

**Task 1.3: Project Switcher in Navigator**
- Add project dropdown to Navigator header
- Show current project name and type icon
- Implement project switching logic
- Refresh Navigator tree on switch

### Stage 2: Project Creation

**Task 2.1: Welcome Screen**
- Create WelcomeScreen component
- Show on first launch (no projects detected)
- Display project type cards with descriptions
- "Get Started" CTA button

**Task 2.2: Project Creation Wizard**
- Multi-step form:
  1. Select project type (journalism, research, fiction, etc.)
  2. Enter project name and description
  3. Configure initial settings (optional)
  4. Review and create
- Use VS Code webview or QuickPick UI
- Validate inputs at each step
- Create project via ProjectService on completion

**Task 2.3: Project Type Selection**
- Show project type cards with:
  - Icon and name
  - Description
  - Available template count
  - Example use cases
- Use PROJECT_TYPE_METADATA for metadata

### Stage 3: Template & Codex Integration

**Task 3.1: Template Filtering**
- Modify template loading to check active project type
- Filter logic:
  - Show templates where `projectTypes` includes current type
  - **Always show universal templates** (where `projectTypes` includes `"*"` wildcard)
  - Examples: Task and Note templates are universal, show in all projects
- Show "No templates" message if filtered list empty (excluding universal templates)
- Document universal template pattern in template schema

**Task 3.2: Codex Creation with Project Context**
- Update Codex creation flow to check active project
- Add `project_id` to Codex frontmatter on creation
- Show error if no active project selected
- Prompt to create/select project if none active

**Task 3.3: Project-Aware Navigator**
- Filter Codex tree to only show current project's Codices
- Group by project (optional, if multi-project view enabled)
- Show Codex count per project
- Add "Show all projects" toggle

### Stage 4: Polish & UX

**Task 4.1: Status Bar Indicator**
- Create ProjectStatusBarItem
- Show: `$(project) Project Name`
- Click to open project switcher
- Update on project change

**Task 4.2: Command Palette Actions**
- `vespera.project.create` - Create new project
- `vespera.project.switch` - Switch project
- `vespera.project.settings` - Open project settings
- `vespera.project.stats` - Show project statistics

**Task 4.3: Keyboard Shortcuts**
- `Ctrl+Shift+P` → `vespera.project.switch` (project switcher)
- `Ctrl+Alt+N` → `vespera.project.create` (new project)
- `Ctrl+,` → `vespera.project.settings` (project settings)

**Task 4.4: Project Settings UI**
- Create settings webview panel
- Show project metadata (name, type, description)
- Edit project settings (default template, automation toggle)
- Save changes via ProjectService

---

## Success Criteria

Phase 16b is complete when:

### User Experience Criteria

1. **First-Time User Flow**:
   - Welcome screen appears on first launch
   - User can create project through wizard
   - Navigator opens with new project active
   - User can create Codex using project templates

2. **Existing User Flow**:
   - Extension remembers last active project
   - Navigator shows only current project's Codices
   - Templates filter by project type
   - Status bar shows current project

3. **Project Management**:
   - User can switch projects via Navigator dropdown
   - User can create additional projects via command palette
   - User can view/edit project settings
   - All operations respect project context

### Technical Criteria

1. **Integration**:
   - ProjectSelector uses real ProjectService data
   - All Codices have `project_id` in frontmatter
   - Template filtering respects project type
   - Navigator tree filters by active project

2. **State Management**:
   - Active project persists across sessions
   - Project changes trigger UI updates
   - No stale data in project list

3. **Quality**:
   - All new components have unit tests
   - Integration tests for critical flows
   - No TypeScript errors in new code
   - Documentation updated

---

## Design Decisions (FINALIZED)

Key decisions made for Phase 16b implementation:

### 1. Default Project for Legacy Codices ✅

**Decision**: No migration needed - project has no legacy Codices

**Rationale**: This is a fresh implementation with no existing user data. All Codices created going forward will have `project_id` from the start.

**Impact**: Simplifies implementation significantly - no migration UI or logic needed.

---

### 2. Project Creation UX Flow ✅

**Decision**: QuickPick multi-step for VS Code extension

**Rationale**:
- Native VS Code UX, keyboard-friendly
- Faster to implement than webview
- Sufficient for MVP functionality

**Future**: Will need richer UI (webview) for Obsidian plugin in later phase

---

### 3. Template Filtering Strictness ✅

**Decision**: Strict filtering with universal template exception

**Rationale**:
- Strict filtering for project-specific templates (articles, characters, etc.)
- **Universal templates** (Task, Note) show in ALL projects regardless of type
- Clearer UX, matches architecture intent

**Implementation Detail**: Templates mark themselves as universal via metadata:
```typescript
{
  template_id: "task",
  projectTypes: ["*"], // Wildcard = show in all projects
  // ...
}
```

**Future**: May add configurable filtering if users request it

---

### 4. Multi-Project Navigator View ✅

**Decision**: Single project view only for MVP

**Rationale**:
- Simpler implementation
- Matches "project context" mental model
- Reduces cognitive load

**Future**: May add multi-project grouped view in Phase 17 if needed

---

## Estimated Timeline

- **Stage 1 (Core Integration)**: 3-4 hours
- **Stage 2 (Project Creation)**: 4-5 hours
- **Stage 3 (Template & Codex)**: 4-5 hours
- **Stage 4 (Polish & UX)**: 3-4 hours
- **Testing & Validation**: 2-3 hours
- **Total**: 16-21 hours (~2-3 sessions)

---

## Risk Mitigation

### Risk 1: Template System Complexity

- **Risk**: Hierarchical Template System may have unforeseen integration complexity
- **Mitigation**: Review template loading code thoroughly before implementing filtering
- **Contingency**: Implement simple type-based filtering first, defer full hierarchical filtering to Phase 17

### Risk 2: State Management Bugs

- **Risk**: Active project state may become inconsistent across components
- **Mitigation**: Use React Context + VS Code workspace state as single source of truth
- **Contingency**: Add state debugging tools, comprehensive logging

### Risk 3: Breaking Existing Workflows

- **Risk**: Requiring projects may break existing user workflows
- **Mitigation**: Create clear migration path, auto-assign legacy Codices
- **Contingency**: Add "emergency bypass" command to create Codex without project (hidden, for support)

### Risk 4: Scope Creep

- **Risk**: Discovering additional integration points that expand scope
- **Mitigation**: Strict adherence to primary objectives, defer nice-to-haves
- **Contingency**: Document deferred items in Phase 17 plan

---

## Deliverables

### Code Artifacts

- [ ] `ProjectContext.tsx` - React context for active project
- [ ] `WelcomeScreen.tsx` - First-time user flow
- [ ] `ProjectCreationWizard.ts` - Multi-step project creation (QuickPick)
- [ ] `ProjectStatusBarItem.ts` - Status bar indicator
- [ ] Updated `ProjectSelector.tsx` - Wired to service
- [ ] Updated `Navigator.tsx` - Project switching, tree filtering
- [ ] Updated `BinderyService.ts` - Project-aware Codex operations
- [ ] Updated template loading - Filter by project type
- [ ] Integration tests for project flows
- [ ] Unit tests for new components

### Documentation

- [ ] Phase 16b completion report
- [ ] Updated user guide with project workflows
- [ ] Updated CLAUDE.md if patterns changed
- [ ] API documentation for new context/components

### Quality Assurance

- [ ] All primary objectives met
- [ ] No regressions in existing functionality
- [ ] TypeScript compilation clean (no new errors)
- [ ] All tests passing
- [ ] Manual testing of complete user flows

---

## Context for AI Assistant

### Quick Start for This Phase

**If picking up Phase 16b mid-execution:**

1. **Check current stage**: See which stage (1-4) is complete
2. **Read Stage outputs**: Review completed code for integration points
3. **Identify blockers**: Check if any open questions need decisions
4. **Continue from checkpoint**: Pick up at next incomplete task

### Key Files to Monitor

**Foundation (Phase 16a)**:
- `src/services/ProjectService.ts` - Service layer (do not modify unless necessary)
- `src/types/project.ts` - Type system (reference only)
- `src/vespera-forge/components/project/ProjectSelector.tsx` - Component to wire up

**Integration Points**:
- `src/webview/navigator.tsx` - Add project switcher, filter tree
- `src/services/bindery.ts` - Add project context to operations
- `src/services/templates/` - Implement filtering
- `src/extension.ts` - Register commands, status bar item

**New Files (to create)**:
- `src/contexts/ProjectContext.tsx` - Active project state
- `src/views/WelcomeScreen.tsx` - First-time flow
- `src/commands/project/` - Command implementations
- `src/ui/ProjectStatusBarItem.ts` - Status bar integration

### Commands for This Phase

```bash
# Build and test
cd plugins/VSCode/vespera-forge
pnpm compile
pnpm test

# Run specific tests
npx jest src/test/services/ProjectService.test.ts

# Launch extension for manual testing
# Use F5 in VS Code or Run > Start Debugging

# Check for TypeScript errors in new code
pnpm compile 2>&1 | grep "src/contexts\|src/views\|src/commands/project"
```

---

## Links

### Related Phases

- **Previous**: [Phase 16a: Surgical Cleanup & Foundation](./PHASE_16a_COMPLETE.md)
- **Current**: **Phase 16b: Project-Centric UI Integration** (this document)
- **Next**: Phase 17: Advanced Project Features (to be planned after 16b)

### Architecture Decision Records

- [ADR-001: Projects as Fundamental](../decisions/ADR-001-projects-fundamental.md) - Core architecture we're implementing
- [ADR-004: Dynamic Templates Over Hardcoded Types](../decisions/ADR-004-dynamic-templates.md) - Template filtering approach
- [ADR-007: Codex-Based Folders](../decisions/ADR-007-codex-folders.md) - Navigator tree structure
- [ADR-011: Surgical Cleanup Before Architecture](../decisions/ADR-011-surgical-cleanup-before-architecture.md) - Phase 16a rationale

### Architecture Documentation

- [Project-Centric Architecture](../../architecture/core/PROJECT_CENTRIC_ARCHITECTURE.md) - Complete specification
- [Hierarchical Template System](../../architecture/core/HIERARCHICAL_TEMPLATE_SYSTEM.md) - Template filtering design
- [Codex Nesting](../../architecture/core/CODEX_NESTING.md) - Navigator tree structure

---

*Phase plan created: 2025-10-24*
*Template version: 1.0.0*
