# Phase 17 Migration Runbook

**Document Version**: 1.0.0
**Last Updated**: 2025-10-29
**Migration**: Phase 16b → Phase 17 (Two-Level → Three-Level Hierarchy)

---

## Overview

This runbook guides users and developers through migrating from Phase 16b's two-level architecture to Phase 17's three-level hierarchy.

**What Changed**:
- **Before**: `Workspace → Project → Codex`
- **After**: `Workspace → Project → Context → Codex`

**Key Changes**:
1. Old "Projects" renamed to "Contexts"
2. New "Projects" represent real-world creative endeavors
3. Global registry added in `~/.vespera/`
4. Workspace discovery algorithm
5. Codex-Context many-to-many relationships

**Migration Status**: As of October 2025, **no user data migration required** because Phase 16b was never deployed with user data. This runbook documents the process for future reference.

---

## Prerequisites

### Before You Begin

1. **Backup Your Workspace**:
   ```bash
   # Create a backup of your entire workspace
   cp -r /path/to/workspace /path/to/workspace-backup-$(date +%Y%m%d)
   ```

2. **Check Vespera Forge Version**:
   - Open VS Code
   - `Ctrl+Shift+P` → "Extensions: Show Installed Extensions"
   - Verify "Vespera Forge" is v0.17.0 or later

3. **Verify Bindery Backend Version**:
   ```bash
   cd packages/vespera-utilities/vespera-bindery
   cargo --version
   # Should be 1.70+ (Rust)
   ```

4. **Close All Vespera-Related VS Code Windows**:
   - Ensures clean migration without file locks

### System Requirements

- **VS Code**: 1.80.0 or later
- **Node.js**: 18.x or later
- **Rust**: 1.70.0 or later (for Bindery backend)
- **SQLite**: 3.45.0 or later
- **Disk Space**: ~50MB for global registry and migrations

---

## Migration Steps

### Step 1: Detect Phase 16b Data

Run the migration verification script to detect existing Phase 16b data:

```bash
cd plugins/VSCode/vespera-forge
npx tsx scripts/migration/verify-phase16b-migration.ts
```

**Possible Outcomes**:

1. **Exit Code 0**: No Phase 16b data found (most common)
   - **Action**: Skip to Step 4 (Initialize Phase 17)

2. **Exit Code 2**: Phase 16b data detected
   - **Action**: Continue to Step 2 (backup and migration)

3. **Exit Code 1**: Error during detection
   - **Action**: Check error message, fix issue, retry

### Step 2: Backup Phase 16b Data (If Detected)

If the verification script found Phase 16b data:

```bash
# Create timestamped backup
mkdir -p .vespera/backups/phase16b-$(date +%Y%m%d-%H%M%S)
cp -r .vespera/projects .vespera/backups/phase16b-$(date +%Y%m%d-%H%M%S)/
```

**What Gets Backed Up**:
- `.vespera/projects/` directory (old project files)
- All `.codex.md` files with `project_id` in frontmatter

### Step 3: Run Database Migrations

The Bindery backend migrations run automatically on server start, but you can verify:

```bash
cd packages/vespera-utilities/vespera-bindery

# Check current migration version
sqlite3 .vespera/bindery.db "SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 1;"

# Should show version 008 or higher for Phase 17
```

**Phase 17 Migrations** (automatically applied):
- `005_projects_table.sql` - Creates projects table
- `006_contexts_table.sql` - Creates contexts table (renamed from old projects)
- `007_codex_contexts_join.sql` - Many-to-many codex-context relationships
- `008_update_codices_project_fk.sql` - Update codices foreign keys

**Manual Migration** (if needed):
```bash
# Navigate to migrations directory
cd migrations

# Apply migrations manually (in order)
sqlite3 ../.vespera/bindery.db < 005_projects_table.sql
sqlite3 ../.vespera/bindery.db < 006_contexts_table.sql
sqlite3 ../.vespera/bindery.db < 007_codex_contexts_join.sql
sqlite3 ../.vespera/bindery.db < 008_update_codices_project_fk.sql
```

### Step 4: Initialize Global Registry

On first run, Vespera Forge automatically creates the global registry:

**Location** (platform-specific):
- **Windows**: `%APPDATA%\Vespera\`
- **macOS**: `~/Library/Application Support/Vespera/`
- **Linux**: `~/.local/share/vespera/`

**Manual Initialization** (if needed):
```bash
# macOS/Linux
mkdir -p ~/.local/share/vespera/{templates,cache,logs}
touch ~/.local/share/vespera/projects-registry.json

# Windows (PowerShell)
New-Item -ItemType Directory -Force -Path "$env:APPDATA\Vespera\templates"
New-Item -ItemType Directory -Force -Path "$env:APPDATA\Vespera\cache"
New-Item -ItemType Directory -Force -Path "$env:APPDATA\Vespera\logs"
New-Item -ItemType File -Force -Path "$env:APPDATA\Vespera\projects-registry.json"
```

**Verify Initialization**:
```bash
# macOS/Linux
ls -la ~/.local/share/vespera/

# Windows (PowerShell)
Get-ChildItem "$env:APPDATA\Vespera"
```

Expected structure:
```
.vespera/
├── projects-registry.json
├── templates/
├── cache/
└── logs/
```

### Step 5: Initialize Workspace Metadata

Create workspace metadata file (if not exists):

```bash
cat > .vespera/workspace.json << 'EOF'
{
  "id": "ws-$(uuidgen)",
  "name": "My Workspace",
  "version": "1.0.0",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "settings": {
    "default_project_id": null,
    "auto_sync": true,
    "template_path": null,
    "enable_rag": false,
    "enable_graph": false
  }
}
EOF
```

**Edit the file** to customize:
- `id`: Generate a UUID (or leave as-is)
- `name`: Your workspace display name

### Step 6: Create Default Project

If migrating from Phase 16b with existing contexts:

1. Open VS Code in your workspace
2. `Ctrl+Shift+P` → "Vespera: Create Project"
3. **Project Name**: "Default Project" (or your workspace name)
4. **Project Type**: Select appropriate type (general, fiction, research, etc.)
5. **Description**: Optional

The new project will be:
- Stored in Bindery database (`projects` table)
- Registered in global registry
- Set as default project in workspace metadata

### Step 7: Migrate Contexts

**Automatic Migration**: If you have old `.vespera/projects/` files, they're automatically treated as contexts:

1. Old project files → New context files (`.vespera/contexts/`)
2. Old `project_id` in codices → Migrated to new `project_id` (default project)
3. New `codex_contexts` join table → Populated with primary context links

**Manual Verification**:
```bash
# Check contexts directory
ls -la .vespera/contexts/

# Each context should have a .json file:
# - context-1.json (formerly project-1)
# - context-2.json (formerly project-2)
```

**Context File Structure**:
```json
{
  "id": "ctx-uuid",
  "project_id": "proj-default-uuid",
  "name": "Story & Narrative",
  "description": "Main story development context",
  "context_type": "fiction",
  "icon": "book",
  "color": "#4A90E2",
  "sort_order": 1,
  "settings": {},
  "created_at": "2025-10-29T12:00:00Z",
  "updated_at": "2025-10-29T12:00:00Z",
  "metadata": {
    "createdAt": "2025-10-29T12:00:00Z",
    "updatedAt": "2025-10-29T12:00:00Z",
    "tags": []
  }
}
```

### Step 8: Verify Migration

Run verification checks:

```bash
# 1. Check database schema
sqlite3 .vespera/bindery.db "PRAGMA table_info(projects);"
sqlite3 .vespera/bindery.db "PRAGMA table_info(contexts);"
sqlite3 .vespera/bindery.db "PRAGMA table_info(codex_contexts);"

# 2. Count entities
sqlite3 .vespera/bindery.db "SELECT COUNT(*) as project_count FROM projects;"
sqlite3 .vespera/bindery.db "SELECT COUNT(*) as context_count FROM contexts;"
sqlite3 .vespera/bindery.db "SELECT COUNT(*) as codex_count FROM codices;"

# 3. Verify codex-context links
sqlite3 .vespera/bindery.db "SELECT COUNT(*) as link_count FROM codex_contexts;"

# 4. Check global registry
cat ~/.local/share/vespera/projects-registry.json | jq '.projects | length'
```

**Expected Results**:
- ✅ Projects table exists with 1+ projects
- ✅ Contexts table exists with 1+ contexts
- ✅ Codex_contexts table exists with links
- ✅ All codices have `is_primary = 1` entry
- ✅ Global registry has project entries

### Step 9: Test in VS Code

1. **Open Workspace**: File → Open Folder → Select workspace
2. **Verify Discovery**: Check VS Code Output panel for discovery logs
3. **Check Navigator**:
   - Top dropdown: Project selector (should show your project)
   - Second dropdown: Context selector (should show contexts)
   - Tree view: Codices filtered by active context
4. **Test Context Switching**:
   - Switch contexts via dropdown
   - Verify codices update in Navigator
5. **Test Codex Creation**:
   - Create new codex
   - Verify it has `project_id` in frontmatter
   - Verify it appears in active context
6. **Test Cross-Context Links**:
   - Right-click a codex → "Add to Context"
   - Select a different context
   - Verify codex appears in both contexts

---

## Rollback Procedure

If migration fails or you need to rollback to Phase 16b:

### Step 1: Stop Bindery Server

```bash
# Find Bindery process
ps aux | grep bindery-server

# Kill process
kill <PID>
```

### Step 2: Restore Database Backup

```bash
# Restore from backup
cp .vespera/backups/phase16b-YYYYMMDD-HHMMSS/bindery.db .vespera/bindery.db
```

### Step 3: Restore Project Files

```bash
# Remove Phase 17 contexts
rm -rf .vespera/contexts/

# Restore Phase 16b projects
cp -r .vespera/backups/phase16b-YYYYMMDD-HHMMSS/projects/ .vespera/projects/
```

### Step 4: Downgrade Extension

1. Open VS Code Extensions
2. Right-click "Vespera Forge" → "Install Another Version"
3. Select Phase 16b version (v0.16.x)
4. Reload VS Code

### Step 5: Clean Global Registry

```bash
# macOS/Linux
rm -rf ~/.local/share/vespera/

# Windows (PowerShell)
Remove-Item -Recurse -Force "$env:APPDATA\Vespera"
```

### Step 6: Verify Rollback

```bash
# Check database schema reverted
sqlite3 .vespera/bindery.db ".tables"
# Should NOT show: projects, contexts, codex_contexts

# Check projects directory restored
ls -la .vespera/projects/
```

---

## Troubleshooting

### Issue 1: Extension Won't Activate

**Symptoms**:
- "Vespera Forge activation failed" error
- No Navigator or panels visible

**Causes**:
- Global registry initialization failed
- Workspace discovery failed
- Database migration failed

**Solutions**:

```bash
# Check VS Code Output panel
Ctrl+Shift+P → "Developer: Show Logs" → Extension Host

# Look for errors from Vespera Forge
# Common errors:
# - "Permission denied" → Check file permissions
# - "Failed to initialize global registry" → Check disk space
# - "Database migration failed" → Check SQLite version

# Fix permission issues (Linux/macOS)
chmod -R 755 .vespera/
chmod -R 755 ~/.local/share/vespera/

# Fix permission issues (Windows PowerShell)
icacls ".vespera" /grant:r "$env:USERNAME:(OI)(CI)F" /T
icacls "$env:APPDATA\Vespera" /grant:r "$env:USERNAME:(OI)(CI)F" /T
```

### Issue 2: Navigator Shows No Codices

**Symptoms**:
- Navigator panel opens but tree is empty
- "No codices in this context" message

**Causes**:
- Context selector shows wrong context
- Codex-context links not populated
- Project_id mismatch

**Solutions**:

```bash
# Check codex-context links
sqlite3 .vespera/bindery.db << 'EOF'
SELECT c.title, ctx.name, cc.is_primary
FROM codices c
LEFT JOIN codex_contexts cc ON cc.codex_id = c.id
LEFT JOIN contexts ctx ON ctx.id = cc.context_id;
EOF

# If no links, populate manually
sqlite3 .vespera/bindery.db << 'EOF'
INSERT INTO codex_contexts (codex_id, context_id, is_primary, added_at)
SELECT c.id, ctx.id, 1, datetime('now')
FROM codices c
CROSS JOIN (SELECT id FROM contexts LIMIT 1) ctx
WHERE NOT EXISTS (
  SELECT 1 FROM codex_contexts WHERE codex_id = c.id
);
EOF
```

### Issue 3: "Missing codex_id parameter" Errors

**Symptoms**:
- Errors in console: "Missing codex_id parameter"
- AI Assistant panel shows errors

**Cause**:
- Old AI Assistant code trying to use codices as channels

**Solution**:
- This is a known Phase 16b residual issue
- Will be fixed in Phase 17 Part 2 (Editor Implementation)
- **Workaround**: Ignore AI Assistant errors for now

### Issue 4: Duplicate Projects in Navigator

**Symptoms**:
- Same project appears multiple times in project selector
- Project IDs don't match

**Cause**:
- Global registry out of sync with workspace

**Solution**:

```bash
# Rebuild global registry
# 1. Delete registry
rm ~/.local/share/vespera/projects-registry.json

# 2. Restart VS Code
# Extension will rebuild registry automatically

# 3. Verify rebuild
cat ~/.local/share/vespera/projects-registry.json | jq '.projects'
```

### Issue 5: Context Selector Empty

**Symptoms**:
- Project selector works, but context selector shows no contexts
- "No contexts in this project" message

**Cause**:
- Contexts not created for project
- Context foreign key mismatch

**Solution**:

```bash
# Check contexts for current project
sqlite3 .vespera/bindery.db << 'EOF'
SELECT id, name, project_id FROM contexts;
EOF

# Create default context manually
sqlite3 .vespera/bindery.db << 'EOF'
INSERT INTO contexts (id, project_id, name, description, context_type, created_at, updated_at)
VALUES (
  'ctx-' || hex(randomblob(16)),
  '<YOUR_PROJECT_ID>',
  'Default Context',
  'Main organizational context',
  'general',
  datetime('now'),
  datetime('now')
);
EOF
```

### Issue 6: Database Migration Stuck

**Symptoms**:
- Bindery server won't start
- "Migration failed" errors
- Database locked

**Cause**:
- Multiple Bindery instances running
- Corrupted migration state

**Solution**:

```bash
# Kill all Bindery processes
pkill -f bindery-server

# Check migration state
sqlite3 .vespera/bindery.db "SELECT * FROM schema_migrations;"

# If stuck at old version, run migrations manually
cd packages/vespera-utilities/vespera-bindery/migrations
for f in 005*.sql 006*.sql 007*.sql 008*.sql; do
  echo "Applying $f..."
  sqlite3 ../../.vespera/bindery.db < "$f"
done

# Verify migrations applied
sqlite3 .vespera/bindery.db "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;"
# Should show: 008
```

---

## Validation Checklist

After migration, verify the following:

### Database Schema

- [ ] `projects` table exists
- [ ] `contexts` table exists
- [ ] `codex_contexts` table exists
- [ ] `codices.project_id` has foreign key to `projects.id`
- [ ] `contexts.project_id` has foreign key to `projects.id`
- [ ] All foreign keys have CASCADE delete

### Global Registry

- [ ] Global directory exists (`~/.vespera/` or equivalent)
- [ ] `projects-registry.json` exists and is valid JSON
- [ ] Registry contains at least one project entry
- [ ] Registry `workspace_path` matches current workspace

### Workspace

- [ ] `.vespera/workspace.json` exists
- [ ] `workspace.json` has valid UUID
- [ ] `.vespera/contexts/` directory exists
- [ ] At least one context file exists

### Data Integrity

- [ ] All codices have valid `project_id` in frontmatter
- [ ] All codices have at least one `codex_contexts` link
- [ ] All codices have exactly one `is_primary = 1` link
- [ ] No orphaned codices (project_id pointing to non-existent project)

### UI Functionality

- [ ] Navigator shows project selector dropdown
- [ ] Navigator shows context selector dropdown
- [ ] Codices display in Navigator tree
- [ ] Context switching updates codex list
- [ ] Codex creation assigns correct project_id
- [ ] Codex creation appears in active context

### Performance

- [ ] Navigator loads in < 2 seconds
- [ ] Context switching in < 500ms
- [ ] Codex list query in < 100ms (for <1000 codices)

---

## Support

### Getting Help

1. **Check Logs**:
   ```bash
   # VS Code Extension Host logs
   Ctrl+Shift+P → "Developer: Show Logs" → Extension Host

   # Bindery server logs
   tail -f ~/.local/share/vespera/logs/bindery-*.log
   ```

2. **GitHub Issues**:
   - [Vespera Atelier Issues](https://github.com/yourusername/vespera-atelier/issues)
   - Search existing issues before creating new one
   - Include logs and error messages

3. **Documentation**:
   - [ADR-015: Workspace/Project/Context Hierarchy](../development/decisions/ADR-015-workspace-project-context-hierarchy.md)
   - [ADR-016: Global Registry + Workspace Storage](../development/decisions/ADR-016-global-registry-storage.md)
   - [Phase 17 Stage 0 Complete](../development/phases/PHASE_17_STAGE_0_COMPLETE.md)

---

## Appendix: Manual Migration Script

If automatic migration fails, use this manual SQL migration script:

```sql
-- Phase 17 Manual Migration Script
-- Run in SQLite: sqlite3 .vespera/bindery.db < this-script.sql

-- 1. Create default project (if not exists)
INSERT OR IGNORE INTO projects (id, workspace_id, name, description, project_type, created_at, updated_at)
VALUES (
  'proj-default',
  'ws-default',
  'Default Project',
  'Migrated from Phase 16b',
  'general',
  datetime('now'),
  datetime('now')
);

-- 2. Create contexts from old projects
INSERT INTO contexts (id, project_id, name, description, context_type, created_at, updated_at)
SELECT
  'ctx-' || id as id,
  'proj-default' as project_id,
  name,
  description,
  type as context_type,
  created_at,
  updated_at
FROM legacy_projects;  -- Replace with actual old table name

-- 3. Update codices to point to default project
UPDATE codices
SET project_id = 'proj-default'
WHERE project_id IS NULL OR project_id = '';

-- 4. Create codex-context primary links
INSERT INTO codex_contexts (codex_id, context_id, is_primary, added_at)
SELECT
  c.id as codex_id,
  ctx.id as context_id,
  1 as is_primary,
  datetime('now') as added_at
FROM codices c
CROSS JOIN contexts ctx
WHERE ctx.project_id = c.project_id
AND NOT EXISTS (
  SELECT 1 FROM codex_contexts WHERE codex_id = c.id
);

-- 5. Verify data integrity
SELECT
  'Projects: ' || COUNT(*) as result FROM projects
UNION ALL
SELECT 'Contexts: ' || COUNT(*) FROM contexts
UNION ALL
SELECT 'Codices: ' || COUNT(*) FROM codices
UNION ALL
SELECT 'Links: ' || COUNT(*) FROM codex_contexts;
```

---

**Document End**

*Last Updated: 2025-10-29*
*Version: 1.0.0*
*Author: Claude Code (Sonnet 4.5)*
