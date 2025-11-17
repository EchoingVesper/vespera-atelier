# ADR-026: Deletion and Archive System

**Status**: Accepted
**Date**: 2025-01-17
**Deciders**: User (Aya), Claude Code AI Assistant
**Technical Story**: Phase 19 Planning - Codex Lifecycle Management

---

## Context and Problem Statement

Users need to remove Codices from their workspace, either temporarily (hide but keep) or permanently (delete). However, accidental deletion is a serious concern, especially given:

**Risk Factors**:
1. **Valuable content**: Creative writing, research notes, code references
2. **Relationships**: Deleting one Codex may orphan related Codices
3. **Irreversibility**: Hard deletion is permanent (no recovery)
4. **User error**: Easy to click wrong button, select wrong item
5. **Regret**: Users often change their minds ("I need that again")

**User Needs**:
- **Hide temporarily**: "Not relevant right now, but might need later"
- **Delete reversibly**: "Pretty sure I don't need this, but just in case"
- **Delete permanently**: "Never need this again, free up space"
- **Bulk operations**: Archive/delete multiple Codices at once
- **Safety**: Multi-step protection against accidents

**Question**: What is the optimal deletion/archival system balancing safety with usability?

## Decision Drivers

* **Safety first**: Prevent accidental data loss
* **Reversibility**: Easy to undo deletion/archival
* **User control**: Clear understanding of what each action does
* **Performance**: Soft-deleted items shouldn't slow down queries
* **Storage**: Eventually purge truly unwanted data
* **Power users**: Optional "YOLO mode" for experienced users
* **Clarity**: Obvious distinction between archive, soft delete, hard delete

## Considered Options

**Option 1**: **Immediate Deletion with Confirmation**
- Single "Delete" action with confirmation dialog
- Permanently deletes immediately
- Simple but risky

**Option 2**: **Soft Delete Only (Trash Bin)**
- "Delete" moves to trash, "Empty Trash" for permanent deletion
- No archive concept, just deleted or not
- Good but incomplete

**Option 3**: **Three-Tier System: Archive + Soft Delete + Hard Delete** (Chosen)
- Archive: Reversible hiding (always visible in "Show Archived")
- Soft Delete: Trash bin with auto-purge after 30 days
- Hard Delete: Permanent removal with strong confirmation
- Comprehensive safety

## Decision Outcome

Chosen option: **"Option 3: Three-Tier System"**, because it provides graduated levels of removal with increasing safety measures. Users can hide, soft-delete, or hard-delete based on their certainty, with appropriate protections at each level.

### Positive Consequences

* **Graduated safety**: More destructive = more protection
* **Flexible workflow**: Archive for hiding, soft-delete for likely removal
* **Easy recovery**: Unarchive or undelete with one click
* **Storage management**: Auto-purge after 30 days frees space
* **Power user mode**: Optional skip of confirmations
* **Clear semantics**: Users understand difference between archive/delete
* **Relationship preservation**: Archived/soft-deleted items remain in database

### Negative Consequences

* **UI complexity**: More buttons and modes (Archive, Delete, Empty Trash)
* **User confusion**: Must learn three concepts instead of one
* **Implementation effort**: Three separate systems to build
* **Storage overhead**: Soft-deleted items take space until purged
* **Query complexity**: Must filter archived/deleted in queries

## Pros and Cons of the Options

### Option 1: Immediate Deletion with Confirmation

**Example**:
```typescript
async function deleteCodex(codexId: string) {
  const confirmed = await showConfirmDialog(
    'Delete Codex',
    'This action cannot be undone. Delete anyway?'
  );

  if (confirmed) {
    await db.delete('codices', { id: codexId });
  }
}
```

* Good, because **simple** (one action, one dialog)
* Good, because **immediate** (space freed right away)
* Good, because **no ongoing storage cost** (deleted = gone)
* Bad, because **risky** (confirmation dialog easy to click through)
* Bad, because **irreversible** (no way to recover)
* Bad, because **no hiding** (can't temporarily hide without deleting)
* Bad, because **stressful** (users afraid to delete anything)

### Option 2: Soft Delete Only (Trash Bin)

**Example**:
```typescript
// Soft delete (move to trash)
async function deleteCodex(codexId: string) {
  await db.update('codices', {
    where: { id: codexId },
    data: { deleted_at: new Date() }
  });
}

// Hard delete (empty trash)
async function emptyTrash() {
  await db.delete('codices', {
    where: { deleted_at: { not: null } }
  });
}
```

**UI**:
```
┌─────────────────────────────────────┐
│ Codex Navigator                     │
├─────────────────────────────────────┤
│ 📁 Characters                       │
│ 📁 Scenes                           │
│ 🗑 Trash (5 items)                  │  ← Trash section
│   ├─ Alice (deleted 2 days ago)    │
│   ├─ Bob (deleted 1 hour ago)      │
│   └─ [Empty Trash]                 │
└─────────────────────────────────────┘
```

* Good, because **safe** (can recover from trash)
* Good, because **familiar** (like OS trash bins)
* Good, because **easy to understand** (deleted = in trash)
* Good, because **reversible** (undelete with one click)
* Bad, because **no hiding** (can't hide without "deleting")
* Bad, because **trash clutter** (trash fills up with items not truly unwanted)
* Bad, because **storage overhead** (deleted items take space)

### Option 3: Three-Tier System (Chosen)

**Tier 1: Archive Flag**:
```typescript
// Archive (hide but keep easily accessible)
async function archiveCodex(codexId: string) {
  await db.update('codices', {
    where: { id: codexId },
    data: { archived: true, archived_at: new Date() }
  });
}

// Unarchive
async function unarchiveCodex(codexId: string) {
  await db.update('codices', {
    where: { id: codexId },
    data: { archived: false, archived_at: null }
  });
}
```

**Tier 2: Soft Delete (Trash)**:
```typescript
// Soft delete (move to trash)
async function softDeleteCodex(codexId: string) {
  await db.update('codices', {
    where: { id: codexId },
    data: {
      deleted_at: new Date(),
      purge_at: addDays(new Date(), 30)  // Auto-purge in 30 days
    }
  });
}

// Undelete (restore from trash)
async function undeleteCodex(codexId: string) {
  await db.update('codices', {
    where: { id: codexId },
    data: {
      deleted_at: null,
      purge_at: null
    }
  });
}
```

**Tier 3: Hard Delete (Permanent)**:
```typescript
// Hard delete (permanent, requires strong confirmation)
async function hardDeleteCodex(codexId: string) {
  const confirmed = await showConfirmDialog(
    'Permanently Delete Codex',
    'This action CANNOT be undone. Type CONFIRM to delete.',
    { requireTypedConfirmation: 'CONFIRM' }
  );

  if (confirmed) {
    // Delete Codex and all relationships
    await db.delete('relationships', { source_id: codexId });
    await db.delete('relationships', { target_id: codexId });
    await db.delete('codices', { id: codexId });

    // Log for potential recovery (Git-like)
    await logDeletion(codexId, 'hard_delete');
  }
}
```

**UI**:
```
┌─────────────────────────────────────┐
│ Codex Navigator                     │
├─────────────────────────────────────┤
│ 📁 Characters (3)                   │
│ 📁 Scenes (12)                      │
│                                     │
│ [v] Show Archived (2)               │  ← Toggle to show archived
│   ├─ Alice (archived)               │
│   └─ Bob (archived)                 │
│                                     │
│ 🗑 Trash (5 items)                  │  ← Soft-deleted items
│   ├─ Carol (purge in 28 days)      │
│   ├─ Dave (purge in 15 days)       │
│   └─ [Empty Trash]                 │  ← Hard delete all
└─────────────────────────────────────┘
```

* Good, because **graduated safety** (archive → soft delete → hard delete)
* Good, because **reversible** (easy to unarchive/undelete)
* Good, because **hiding** (archive keeps Codex but hides from main view)
* Good, because **auto-cleanup** (auto-purge after 30 days)
* Good, because **clear semantics** (distinct concepts for different needs)
* Good, because **flexible** (users choose appropriate level)
* Bad, because **complex** (three systems to understand)
* Bad, because **more UI** (more buttons, toggles, sections)
* Bad, because **storage overhead** (archived + soft-deleted items)

**YOLO Mode** (Optional):
```typescript
// User setting to skip confirmations
interface UserSettings {
  deletion: {
    confirmations: boolean;  // false = YOLO mode (skip confirmations)
    autoArchive: boolean;    // true = "Delete" archives instead of soft-deleting
  };
}

// With YOLO mode enabled
async function deleteCodexYOLO(codexId: string) {
  // No confirmation, directly soft-delete
  await softDeleteCodex(codexId);
}
```

## Implementation Details

### Database Schema

**Codex Table with Archive and Soft Delete**:
```sql
CREATE TABLE codices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id TEXT NOT NULL,
  metadata JSONB NOT NULL,

  -- Archive flags
  archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMP,

  -- Soft delete flags
  deleted_at TIMESTAMP,
  purge_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for filtering out archived/deleted
CREATE INDEX idx_codices_archived ON codices(archived) WHERE archived = false;
CREATE INDEX idx_codices_deleted ON codices(deleted_at) WHERE deleted_at IS NULL;

-- Index for auto-purge job
CREATE INDEX idx_codices_purge ON codices(purge_at) WHERE purge_at IS NOT NULL;
```

**Deletion Log Table** (for potential recovery):
```sql
CREATE TABLE deletion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codex_id UUID NOT NULL,
  codex_data JSONB NOT NULL,  -- Full Codex snapshot before deletion
  deletion_type TEXT NOT NULL,  -- 'soft_delete', 'hard_delete'
  deleted_by TEXT,  -- User who deleted (if multi-user)
  deleted_at TIMESTAMP DEFAULT NOW()
);

-- Retention: Keep deletion log for 90 days, then purge
CREATE INDEX idx_deletion_log_purge ON deletion_log(deleted_at);
```

### Query Filtering

**Default Query (Exclude Archived and Deleted)**:
```typescript
async function listCodexes(templateId?: string): Promise<Codex[]> {
  return db.query(`
    SELECT * FROM codices
    WHERE archived = false
      AND deleted_at IS NULL
      ${templateId ? 'AND template_id = $1' : ''}
    ORDER BY updated_at DESC
  `, templateId ? [templateId] : []);
}
```

**Show Archived**:
```typescript
async function listArchivedCodexes(): Promise<Codex[]> {
  return db.query(`
    SELECT * FROM codices
    WHERE archived = true
      AND deleted_at IS NULL
    ORDER BY archived_at DESC
  `);
}
```

**Show Trash**:
```typescript
async function listDeletedCodexes(): Promise<Codex[]> {
  return db.query(`
    SELECT *, (purge_at - NOW()) AS days_until_purge
    FROM codices
    WHERE deleted_at IS NOT NULL
    ORDER BY deleted_at DESC
  `);
}
```

### Archive Operations

**Archive Codex**:
```typescript
async function archiveCodex(codexId: string): Promise<void> {
  await db.update('codices', {
    where: { id: codexId },
    data: {
      archived: true,
      archived_at: new Date()
    }
  });

  eventBus.emit('codex:archived', { codexId });
}
```

**Bulk Archive**:
```typescript
async function bulkArchiveCodexes(codexIds: string[]): Promise<void> {
  await db.update('codices', {
    where: { id: { in: codexIds } },
    data: {
      archived: true,
      archived_at: new Date()
    }
  });

  eventBus.emit('codex:bulk_archived', { codexIds });
}
```

### Soft Delete Operations

**Soft Delete Codex**:
```typescript
async function softDeleteCodex(codexId: string): Promise<void> {
  const purgeAt = new Date();
  purgeAt.setDate(purgeAt.getDate() + 30);  // 30 days from now

  await db.update('codices', {
    where: { id: codexId },
    data: {
      deleted_at: new Date(),
      purge_at: purgeAt
    }
  });

  eventBus.emit('codex:soft_deleted', { codexId, purgeAt });
}
```

**Undelete Codex**:
```typescript
async function undeleteCodex(codexId: string): Promise<void> {
  await db.update('codices', {
    where: { id: codexId },
    data: {
      deleted_at: null,
      purge_at: null
    }
  });

  eventBus.emit('codex:undeleted', { codexId });
}
```

### Hard Delete Operations

**Hard Delete with Confirmation**:
```typescript
async function hardDeleteCodex(codexId: string): Promise<boolean> {
  // Load Codex for deletion log
  const codex = await loadCodex(codexId);

  // Show strong confirmation dialog
  const confirmed = await showTypedConfirmDialog(
    'Permanently Delete Codex',
    `This will PERMANENTLY delete "${codex.metadata.title}". This action CANNOT be undone.\n\nType CONFIRM to proceed.`,
    'CONFIRM'
  );

  if (!confirmed) {
    return false;
  }

  // Log deletion for potential recovery
  await db.insert('deletion_log', {
    codex_id: codexId,
    codex_data: codex,
    deletion_type: 'hard_delete',
    deleted_at: new Date()
  });

  // Delete relationships
  await db.delete('relationships', {
    where: {
      or: [
        { source_id: codexId },
        { target_id: codexId }
      ]
    }
  });

  // Delete Codex
  await db.delete('codices', { where: { id: codexId } });

  eventBus.emit('codex:hard_deleted', { codexId });
  return true;
}
```

**Empty Trash (Bulk Hard Delete)**:
```typescript
async function emptyTrash(): Promise<boolean> {
  const trashedCodexes = await listDeletedCodexes();

  // Show confirmation with count
  const confirmed = await showConfirmDialog(
    'Empty Trash',
    `This will PERMANENTLY delete ${trashedCodexes.length} Codex(es). Type CONFIRM to proceed.`,
    { requireTypedConfirmation: 'CONFIRM' }
  );

  if (!confirmed) {
    return false;
  }

  // Hard delete all trashed Codices
  for (const codex of trashedCodexes) {
    await hardDeleteCodexWithoutConfirm(codex.id);
  }

  return true;
}
```

### Auto-Purge Job

**Background Job to Purge Old Deletions**:
```typescript
import cron from 'node-cron';

// Run every day at 2 AM
cron.schedule('0 2 * * *', async () => {
  const now = new Date();

  // Find Codices past purge_at date
  const toPurge = await db.query(`
    SELECT id FROM codices
    WHERE purge_at IS NOT NULL
      AND purge_at < $1
  `, [now]);

  for (const codex of toPurge) {
    await hardDeleteCodexWithoutConfirm(codex.id);
  }

  console.log(`Auto-purged ${toPurge.length} Codex(es)`);
});
```

### UI Components

**Archive Toggle**:
```typescript
function ArchiveButton({ codexId, archived }: ArchiveButtonProps) {
  const [isArchived, setIsArchived] = useState(archived);

  const handleToggle = async () => {
    if (isArchived) {
      await unarchiveCodex(codexId);
      setIsArchived(false);
    } else {
      await archiveCodex(codexId);
      setIsArchived(true);
    }
  };

  return (
    <button onClick={handleToggle}>
      {isArchived ? '📂 Unarchive' : '📦 Archive'}
    </button>
  );
}
```

**Delete Button**:
```typescript
function DeleteButton({ codexId }: DeleteButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await softDeleteCodex(codexId);
      // Codex moves to Trash
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleDelete} disabled={loading}>
      🗑 Delete
    </button>
  );
}
```

**Trash View**:
```typescript
function TrashView() {
  const [trashedCodexes, setTrashedCodexes] = useState<Codex[]>([]);

  useEffect(() => {
    listDeletedCodexes().then(setTrashedCodexes);
  }, []);

  const handleUndelete = async (codexId: string) => {
    await undeleteCodex(codexId);
    setTrashedCodexes(prev => prev.filter(c => c.id !== codexId));
  };

  const handleEmptyTrash = async () => {
    const success = await emptyTrash();
    if (success) {
      setTrashedCodexes([]);
    }
  };

  return (
    <div className="trash-view">
      <h2>🗑 Trash ({trashedCodexes.length})</h2>

      {trashedCodexes.map(codex => (
        <div key={codex.id} className="trash-item">
          <span>{codex.metadata.title}</span>
          <span className="purge-countdown">
            Purge in {daysUntil(codex.purge_at)} days
          </span>
          <button onClick={() => handleUndelete(codex.id)}>
            ↩ Restore
          </button>
        </div>
      ))}

      {trashedCodexes.length > 0 && (
        <button onClick={handleEmptyTrash} className="danger">
          🗑 Empty Trash (Permanent)
        </button>
      )}
    </div>
  );
}
```

**Confirmation Dialog**:
```typescript
async function showTypedConfirmDialog(
  title: string,
  message: string,
  confirmText: string
): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog = vscode.window.createInputBox();
    dialog.title = title;
    dialog.prompt = message;
    dialog.placeholder = `Type "${confirmText}" to confirm`;
    dialog.ignoreFocusOut = true;

    dialog.onDidAccept(() => {
      const valid = dialog.value === confirmText;
      dialog.dispose();
      resolve(valid);
    });

    dialog.onDidHide(() => {
      dialog.dispose();
      resolve(false);
    });

    dialog.show();
  });
}
```

## User Settings

**Deletion Behavior Settings**:
```json5
{
  "vespera.deletion": {
    "confirmations": true,        // Show confirmation dialogs (disable for YOLO mode)
    "autoArchive": false,         // "Delete" archives instead of soft-deleting
    "trashRetention": 30,         // Days before auto-purge (default: 30)
    "showArchiveToggle": true,    // Show "Show Archived" toggle in Navigator
    "warnOnRelatedDelete": true   // Warn if deleting Codex with relationships
  }
}
```

## Migration Path

**Phase 19**: Implement archive flag and soft delete (trash)
**Phase 20**: Add hard delete with confirmation and deletion log
**Phase 21**: Implement auto-purge background job
**Phase 22**: Add YOLO mode and bulk operations

## User Guidance

**For End Users**:
- **Archive**: Hide temporarily, easy to unarchive (no data loss risk)
- **Delete**: Move to trash, can restore within 30 days
- **Empty Trash**: Permanent deletion, requires typing "CONFIRM"
- **YOLO Mode**: Skip confirmations (use with caution)

**Workflow Example**:
1. User creates Character "Alice" for story idea
2. Later: Story doesn't work out → Archive "Alice" (might reuse later)
3. Months later: Definitely not using → Delete "Alice" (moves to trash)
4. 30 days later: Auto-purged from trash (permanent)

## Links

* Related to [ADR-020: Extreme Atomic Codex Architecture](./ADR-020-extreme-atomic-architecture.md)
* Related to [Codex Architecture](../../architecture/core/CODEX_ARCHITECTURE.md)
