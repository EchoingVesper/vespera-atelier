# Phase 22: Backend/Navigator & Deletion

**Status**: Proposed
**Duration**: 4-6 days
**Related ADRs**: [ADR-026](../decisions/ADR-026-deletion-archive-system.md), [ADR-027](../decisions/ADR-027-multi-context-array-implementation.md)

---

## Executive Summary

Phase 22 completes deferred features from earlier phases, focusing on multi-context support, robust deletion systems, and Navigator UI improvements. This phase implements the context_ids array for Codices appearing in multiple contexts, creates a three-tier deletion system (archive/soft delete/hard delete) with appropriate safety measures, adds Navigator tooltips and "Show All Codices" toggle, and implements drag-drop reparenting. The work delivers the complete UI feature set deferred from Phases 17-18, creating a polished, production-ready user experience.

---

## Objectives

### Primary Goals
- [ ] **Multi-Context Support** - Codices can appear in multiple organizational contexts
- [ ] **Archive Flag System** - Reversible hiding of Codices (always accessible)
- [ ] **Soft Delete (Trash Bin)** - Safe deletion with 30-day auto-purge
- [ ] **Hard Delete (Permanent)** - Irreversible deletion with strong confirmation
- [ ] **"Show All Codices" Toggle** - View Codices across all contexts
- [ ] **Navigator Tooltips** - Mouseover labels for Codex metadata
- [ ] **Drag-Drop Reparenting** - Reorganize Navigator hierarchy visually

### Secondary Goals
- [ ] **"YOLO Mode" Setting** - Skip confirmations for experienced users
- [ ] **Bulk Operations** - Archive/delete multiple Codices at once
- [ ] **Context Badges** - Show which contexts a Codex belongs to
- [ ] **Trash Auto-Purge Job** - Background job to clean old deletions
- [ ] **Deletion Log** - Track deletions for potential recovery

### Non-Goals
- **Advanced Graph Features** - Complex graph queries deferred to future
- **Template-Level Context Rules** - Context validation deferred
- **Multi-User Permissions** - Single-user system for now
- **Real-Time Collaboration** - Deferred to post-MVP

---

## Prerequisites

Before starting Phase 22:

- [ ] Phase 21 complete (file integration, media Codices)
- [ ] User approval of this phase plan
- [ ] Decision: Multi-context implementation (array vs. join table - ADR-027 recommends array)
- [ ] Decision: Deletion confirmation style (dialog, inline, typed confirmation)
- [ ] Decision: Auto-purge interval (30 days recommended)
- [ ] Decision: YOLO mode default (off recommended for safety)

---

## Technical Approach

### Architecture Patterns

**1. Multi-Context Array Implementation**

Codices can belong to multiple contexts using array field:

```typescript
// Database schema
interface CodexMetadata {
  id: string;
  template_id: string;
  context_ids: string[];        // ["ctx-001", "ctx-002"]
  primary_context: string;       // "ctx-001" (default/main context)
  // ... other metadata
}

// SQL query for Codices in context
SELECT * FROM codices
WHERE context_ids @> ARRAY['ctx-chapter-1']::text[]
  AND archived = false
  AND deleted_at IS NULL;

// GIN index for performance
CREATE INDEX idx_codices_context_ids ON codices USING GIN (context_ids);
```

**2. Three-Tier Deletion System**

Graduated levels of removal with increasing safety:

```typescript
// Tier 1: Archive (reversible hiding)
async function archiveCodex(codexId: string) {
  await db.update('codices', {
    where: { id: codexId },
    data: {
      archived: true,
      archived_at: new Date()
    }
  });
}

// Tier 2: Soft Delete (trash bin)
async function softDeleteCodex(codexId: string) {
  const purgeAt = new Date();
  purgeAt.setDate(purgeAt.getDate() + 30);  // 30 days from now

  await db.update('codices', {
    where: { id: codexId },
    data: {
      deleted_at: new Date(),
      purge_at: purgeAt
    }
  });
}

// Tier 3: Hard Delete (permanent)
async function hardDeleteCodex(codexId: string) {
  // Require typed confirmation
  const confirmed = await showTypedConfirmDialog(
    'Permanently Delete Codex',
    'Type CONFIRM to delete permanently.',
    'CONFIRM'
  );

  if (!confirmed) return false;

  // Log deletion for recovery
  await logDeletion(codexId, 'hard_delete');

  // Delete relationships and Codex
  await db.delete('relationships', {
    where: { or: [{ source_id: codexId }, { target_id: codexId }] }
  });
  await db.delete('codices', { where: { id: codexId } });

  return true;
}
```

**3. Archive/Delete Database Schema**

```sql
ALTER TABLE codices ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;
ALTER TABLE codices ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;
ALTER TABLE codices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE codices ADD COLUMN IF NOT EXISTS purge_at TIMESTAMP;

-- Indexes for filtering
CREATE INDEX idx_codices_archived ON codices(archived) WHERE archived = false;
CREATE INDEX idx_codices_deleted ON codices(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_codices_purge ON codices(purge_at) WHERE purge_at IS NOT NULL;
```

**4. Show All Codices Toggle**

View Codices across all contexts:

```typescript
async function listCodexes(options: {
  showAll: boolean;         // Show all contexts vs. current only
  showArchived: boolean;    // Include archived
  currentContext?: string;  // Filter to this context (unless showAll)
}): Promise<Codex[]> {
  let query = `
    SELECT * FROM codices
    WHERE deleted_at IS NULL
  `;

  if (!options.showArchived) {
    query += ` AND archived = false`;
  }

  if (!options.showAll && options.currentContext) {
    query += ` AND context_ids @> ARRAY[$1]::text[]`;
  }

  query += ` ORDER BY updated_at DESC`;

  return db.query(query, options.showAll ? [] : [options.currentContext]);
}
```

**5. Navigator Tooltips**

Rich metadata on mouseover:

```typescript
function CodexTreeItem({ codex }: CodexTreeItemProps) {
  const tooltip = `
    ${codex.metadata.title}
    Template: ${codex.templateId}
    Created: ${formatDate(codex.created_at)}
    Updated: ${formatDate(codex.updated_at)}
    Contexts: ${codex.metadata.context_ids.join(', ')}
  `;

  return (
    <div className="codex-tree-item" title={tooltip}>
      <span>{codex.metadata.title}</span>
    </div>
  );
}
```

**6. Drag-Drop Reparenting**

Visual hierarchy reorganization:

```typescript
import { DndContext, closestCenter } from '@dnd-kit/core';

function Navigator() {
  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    // Get dragged Codex and new parent
    const draggedCodexId = active.id;
    const newParentId = over.id;

    // Update parent_id in database
    await updateCodexParent(draggedCodexId, newParentId);

    // Refresh Navigator tree
    await refreshNavigatorTree();
  };

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <NavigatorTree codices={codices} />
    </DndContext>
  );
}
```

---

## Task Breakdown

### Backend Tasks (Database & API)

**Task 1: Multi-Context Schema** (3 hours)
- Add context_ids array column to codices table
- Add primary_context column
- Create GIN index on context_ids
- Implement context add/remove operations
- Tests: Multi-context storage, queries, indexes

**Task 2: Archive/Delete Schema** (2 hours)
- Add archived, archived_at, deleted_at, purge_at columns
- Create indexes for filtering archived/deleted
- Implement archive/unarchive operations
- Implement soft delete/undelete operations
- Tests: Archive/delete flags, filtering, operations

**Task 3: Deletion Log** (3 hours)
- Create deletion_log table with Codex snapshots
- Implement logging on hard delete
- Add 90-day retention policy
- Create recovery query (for support/debugging)
- Tests: Logging, retention, recovery

**Task 4: Auto-Purge Job** (4 hours)
- Implement cron job for purging old deletions
- Run daily at 2 AM (configurable)
- Log purge operations
- Add dry-run mode for testing
- Tests: Purge logic, scheduling, logging

**Task 5: Context Query Optimization** (2 hours)
- Optimize "show all" queries (no context filter)
- Implement batch context queries
- Add context caching
- Profile query performance with 10k+ Codices
- Tests: Performance benchmarks, caching

### Frontend Tasks (UI Components)

**Task 6: Multi-Context Picker** (5 hours)
- Create context picker modal
- Show checkboxes for all available contexts
- Display primary context designation
- Implement "Set as Primary" button
- Show context badges on Codex items
- Tests: Picker display, selection, badges

**Task 7: Show All Codices Toggle** (4 hours)
- Add toggle switch to Navigator toolbar
- Implement context filtering on toggle
- Show/hide context badges based on toggle
- Persist toggle state in user settings
- Tests: Toggle functionality, state persistence

**Task 8: Archive UI** (5 hours)
- Add "Archive" button to Codex context menu
- Create "Show Archived" toggle in Navigator
- Implement archive/unarchive actions
- Display archived items with distinct styling (greyed out)
- Tests: Archive actions, toggle, styling

**Task 9: Trash View** (6 hours)
- Create "Trash" section in Navigator (collapsible)
- Display soft-deleted Codices with purge countdown
- Add "Restore" and "Delete Permanently" buttons
- Implement "Empty Trash" action with confirmation
- Show trash item count in section header
- Tests: Trash display, actions, countdown

**Task 10: Deletion Confirmation Dialogs** (4 hours)
- Create soft delete confirmation (simple dialog)
- Create hard delete typed confirmation ("Type CONFIRM")
- Implement "Empty Trash" bulk confirmation
- Add YOLO mode setting (skip confirmations)
- Tests: Dialog display, typed confirmation, YOLO mode

**Task 11: Navigator Tooltips** (3 hours)
- Add HTML title attribute to Navigator items
- Format tooltip with metadata (template, dates, contexts)
- Implement tooltip delay (500ms hover)
- Style tooltips consistently
- Tests: Tooltip display, formatting, delay

**Task 12: Drag-Drop Reparenting** (5 hours)
- Integrate @dnd-kit for drag-drop
- Implement drag handle on Navigator items
- Add dropzone highlighting during drag
- Update parent_id on drop
- Prevent circular parent relationships
- Tests: Drag events, drop validation, parent update

---

## Task Dependencies

```
Backend Foundation:
  Task 1 (Multi-Context) → Independent
  Task 2 (Archive/Delete) → Independent
  Task 3 (Deletion Log) → Task 2
  Task 2 → Task 4 (Auto-Purge)
  Task 1 → Task 5 (Query Optimization)

Frontend Implementation:
  Task 1 → Task 6 (Context Picker)
  Task 1 + Task 6 → Task 7 (Show All Toggle)
  Task 2 → Task 8 (Archive UI)
  Task 2 → Task 9 (Trash View)
  Task 2 + Task 3 → Task 10 (Confirmations)
  Independent → Task 11 (Tooltips)
  Independent → Task 12 (Drag-Drop)

Integration:
  All → Final testing and integration
```

**Parallelization Strategy**:
1. **Days 1-2**: Tasks 1-2 (schemas) + Task 11-12 (tooltips, drag-drop)
2. **Days 3-4**: Tasks 3-5 (deletion log, purge, optimization) + Tasks 6-7 (context picker, toggle)
3. **Days 5-6**: Tasks 8-10 (archive UI, trash view, confirmations) + integration

---

## Open Questions

**Decisions Needed Before Starting**:

1. **Multi-Context Implementation?**
   - **Options**: Array field (ADR-027), join table, both
   - **Recommendation**: Array field for MVP (simpler, sufficient)
   - **Impact**: Query complexity, scalability

2. **Deletion Confirmation Style?**
   - **Options**: Simple dialog, typed "CONFIRM", both
   - **Recommendation**: Simple for soft delete, typed for hard delete
   - **Impact**: User experience vs. safety

3. **Auto-Purge Interval?**
   - **Options**: 7 days, 30 days, 90 days, configurable
   - **Recommendation**: 30 days (balance safety and cleanup)
   - **Impact**: Storage usage vs. recovery window

4. **YOLO Mode Default?**
   - **Options**: On by default, off by default, no YOLO mode
   - **Recommendation**: Off by default (safety first)
   - **Impact**: User convenience vs. accidental deletion

5. **Drag-Drop Circular Prevention?**
   - **Options**: Prevent before drop, allow and warn, no prevention
   - **Recommendation**: Prevent before drop (show error message)
   - **Impact**: UX smoothness vs. error prevention

---

## Risk Assessment

### High Risk

1. **Multi-Context Migration** (Backend)
   - **Risk**: Existing Codices need context_ids populated from old single context_id
   - **Mitigation**: Write careful migration script, test on copy of database
   - **Contingency**: Rollback migration, dual support for old/new schema

2. **Drag-Drop Parent Loops** (Frontend)
   - **Risk**: User drags parent into its own child, creating circular hierarchy
   - **Mitigation**: Detect and prevent circular parent relationships
   - **Contingency**: Add "Fix Hierarchy" tool to repair broken structures

### Medium Risk

3. **Auto-Purge Job Reliability** (Backend)
   - **Risk**: Cron job fails silently, trash never purges
   - **Mitigation**: Log all purge operations, monitor logs
   - **Contingency**: Manual "Run Purge Now" command

4. **Deletion Confirmation Fatigue** (UX)
   - **Risk**: Users frustrated by multiple confirmations
   - **Mitigation**: Single confirmation for soft delete, strong for hard delete only
   - **Contingency**: Add YOLO mode for power users

### Low Risk

5. **Tooltip Performance** (Frontend)
   - **Risk**: 10k+ tooltips in Navigator slow down rendering
   - **Mitigation**: Lazy tooltip generation (only on hover)
   - **Contingency**: Disable tooltips in large workspaces

---

## Success Criteria

**Must-Have (MVP)**:
- ✅ Codices support multiple contexts (context_ids array)
- ✅ Archive flag hides Codices reversibly
- ✅ Soft delete moves to trash with 30-day purge
- ✅ Hard delete requires typed "CONFIRM"
- ✅ "Show All Codices" toggle works
- ✅ Drag-drop reparenting functional
- ✅ Navigator tooltips show metadata

**Should-Have**:
- ✅ Context badges on Codex items
- ✅ Trash view with countdown
- ✅ Bulk archive/delete operations
- ✅ Auto-purge background job
- ✅ Deletion log for recovery
- ✅ YOLO mode setting

**Nice-to-Have**:
- ✅ Context picker with search
- ✅ Trash size warnings
- ✅ Drag-drop undo/redo
- ✅ Keyboard shortcuts for archive/delete
- ✅ Deletion statistics (items purged, restored)

---

## Timeline Estimate

**Optimistic**: 4 days (clean schemas, no migration issues)
**Realistic**: 6 days (accounting for migration complexity and drag-drop tuning)
**Pessimistic**: 9 days (if multi-context migration has issues or drag-drop bugs)

**Week 1**:
- Days 1-2: Schemas + tooltips/drag-drop
- Days 3-4: Deletion features + context UI
- Days 5-6: Integration and polish

---

## Context for AI Assistant

### Quick Start for Next Session

**If you're picking up Phase 22 work:**

1. **Read these files first** (in order):
   - [ADR-026: Deletion and Archive System](../decisions/ADR-026-deletion-archive-system.md) - Deletion architecture
   - [ADR-027: Multi-Context Array Implementation](../decisions/ADR-027-multi-context-array-implementation.md) - Multi-context design
   - [Phase 17.5 Completion](./PHASE_17.5_COMPLETE.md) - Deferred features context
   - This file (PHASE_22_PLAN.md) - Current plan

2. **Key mental models to understand**:
   - **Three-Tier Deletion**: Archive (hide) → Soft Delete (trash) → Hard Delete (permanent)
   - **Multi-Context Array**: Simple array field, GIN indexed, portable
   - **YOLO Mode**: Power user feature, off by default for safety
   - **Deferred UI Features**: This phase completes work from Phases 17-18

3. **Current focus area**: Completing deferred UI features with robust deletion safety

### System Architecture Overview

```
Multi-Context System:
Codex:
  context_ids: ["ctx-world-building", "ctx-chapter-1"]  // Array field
  primary_context: "ctx-world-building"                  // Main context

Query:
  WHERE context_ids @> ARRAY['ctx-chapter-1']  // PostgreSQL array operator
  INDEX: GIN index on context_ids               // Fast array searches

Deletion Tiers:
1. Archive:
   - Flag: archived = true
   - Reversible: One-click unarchive
   - Visibility: Show with "Show Archived" toggle

2. Soft Delete (Trash):
   - Flag: deleted_at = timestamp
   - Auto-purge: purge_at = deleted_at + 30 days
   - Reversible: Restore from trash

3. Hard Delete:
   - Permanent: DELETE FROM codices
   - Logged: Snapshot in deletion_log
   - Confirmation: Type "CONFIRM"

Navigator Features:
├── Multi-Context Toggle (show all vs. current)
├── Archive Toggle (show archived)
├── Trash Section (soft-deleted items)
├── Tooltips (metadata on hover)
└── Drag-Drop Reparenting (visual hierarchy)
```

### Common Pitfalls & Gotchas

1. **Multi-Context Migration**
   - **What**: Old Codices have single context_id, need array
   - **Why**: Schema change from single to multi-context
   - **How to handle**: Careful migration: context_ids = [old_context_id]

2. **Drag-Drop Circular Parents**
   - **What**: User drags folder into its own descendant
   - **Why**: No validation on drop target
   - **How to handle**: Check ancestry before allowing drop

3. **Auto-Purge Timing**
   - **What**: Cron runs at 2 AM user's time, but which timezone?
   - **Why**: Server timezone may differ from user
   - **How to handle**: Use UTC for consistency

4. **YOLO Mode Accidents**
   - **What**: User enables YOLO, accidentally deletes permanently
   - **Why**: No confirmation dialogs with YOLO on
   - **How to handle**: Deletion log still captures, can recover

### Important File Locations

Quick reference for key files:

- **Multi-Context Schema**: `src/database/migrations/add_context_ids_array.sql`
- **Archive/Delete Schema**: `src/database/migrations/add_archive_delete_flags.sql`
- **Deletion Log**: `src/database/schema/deletion_log.sql`
- **Auto-Purge Job**: `src/jobs/AutoPurgeJob.ts`
- **Context Picker**: `src/components/ContextPicker.tsx`
- **Show All Toggle**: `src/components/Navigator/ShowAllToggle.tsx`
- **Archive UI**: `src/components/ArchiveButton.tsx`
- **Trash View**: `src/components/TrashView.tsx`
- **Drag-Drop**: `src/components/Navigator/DraggableCodexItem.tsx`
- **Tests**: `tests/deletion/`, `tests/multi-context/`

### Commands to Run

```bash
# Run multi-context migration
npm run migrate:multi-context

# Run archive/delete migration
npm run migrate:archive-delete

# Test auto-purge job (dry run)
npm run purge:dry-run

# Run deletion tests
npm test -- --grep="Deletion"

# Check for circular hierarchies
npm run check-circular-parents

# Bulk archive all Codices in context
npm run archive-context ctx-old-project
```

---

## References

### Phase Tracking
- **Previous**: [Phase 21: File Integration & Media Codices](./PHASE_21_PLAN.md)
- **Current**: **Phase 22: Backend/Navigator & Deletion** (this document)
- **Next**: Phase 23+ (Future phases TBD)

### Architecture Decision Records
- [ADR-026: Deletion and Archive System](../decisions/ADR-026-deletion-archive-system.md) - Three-tier deletion
- [ADR-027: Multi-Context Array Implementation](../decisions/ADR-027-multi-context-array-implementation.md) - Multi-context design

### Architecture Documentation
- [Codex Architecture](../../architecture/core/CODEX_ARCHITECTURE.md) - Universal content system
- [Project-Centric Architecture](../../architecture/core/PROJECT_CENTRIC_ARCHITECTURE.md) - Project boundaries

### Deferred Features From
- [Phase 17.5 Completion](./PHASE_17.5_COMPLETE.md) - "What's Still Planned" section
- [Phase 18 Completion](./PHASE_18_COMPLETE.md) - Deferred UI features

---

*Phase Plan Version: 1.0.0*
*Created: 2025-01-17*
*Template: PHASE_TEMPLATE.md v1.0.0*
