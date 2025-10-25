-- Update codices table to add project_id foreign key constraint
-- and remove parent_id column (replaced by codex_contexts many-to-many)
--
-- Part of ADR-015: Workspace/Project/Context Hierarchy refactoring
--
-- Context:
-- - Migration 002 created codices table with project_id as TEXT (no FK)
-- - Migration 005 created projects table with proper schema
-- - Migration 007 created codex_contexts for many-to-many relationships
-- - Now we formalize project_id FK and remove legacy parent_id column
--
-- Changes:
-- 1. Add FOREIGN KEY constraint on codices.project_id → projects.id
-- 2. Make project_id NOT NULL (every codex must belong to a project)
-- 3. Remove parent_id column (replaced by codex_contexts many-to-many)
--
-- SQLite Limitation:
-- SQLite does NOT support ALTER TABLE ADD CONSTRAINT for foreign keys.
-- The only way to add a FK constraint is to recreate the table entirely.
-- This is a destructive operation requiring table recreation.
--
-- Migration Strategy:
-- 1. Create new table with FK constraints
-- 2. Copy all data from old table
-- 3. Drop old table
-- 4. Rename new table to original name
-- 5. Recreate all indexes
--
-- IMPORTANT: This is a DESTRUCTIVE migration. Backup your database before running!
--
-- Version: 8
-- Created: 2025-10-25 00:00:00 UTC

-- +migrate up
-- Step 1: Create new codices table with proper foreign key constraints
CREATE TABLE IF NOT EXISTS codices_new (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,           -- JSON content following template schema
    metadata TEXT NOT NULL,           -- JSON metadata (tags, references, etc.)
    crdt_state TEXT,                  -- CRDT state for collaborative editing
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    created_by TEXT,
    project_id TEXT NOT NULL,         -- ✅ NOW: NOT NULL with FK constraint
    -- ❌ REMOVED: parent_id (replaced by codex_contexts many-to-many)
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Step 2: Copy all data from old codices table to new one
-- Note: parent_id column is dropped and not copied
-- Warning: Any codices with NULL project_id will cause this migration to fail
--          All codices MUST have a valid project_id before running this migration
INSERT INTO codices_new (
    id,
    template_id,
    title,
    content,
    metadata,
    crdt_state,
    version,
    created_at,
    updated_at,
    created_by,
    project_id
)
SELECT
    id,
    template_id,
    title,
    content,
    metadata,
    crdt_state,
    version,
    created_at,
    updated_at,
    created_by,
    COALESCE(project_id, 'default-project-id')  -- Fallback for NULL project_id
FROM codices;

-- Important Migration Note:
-- If any codices have NULL project_id, they will be assigned to 'default-project-id'.
-- The application should ensure this default project exists before running this migration,
-- or update the COALESCE value to a valid project ID from your database.
--
-- To check for orphaned codices before migration:
--   SELECT COUNT(*) FROM codices WHERE project_id IS NULL;
--
-- To assign orphaned codices to a specific project before migration:
--   UPDATE codices SET project_id = 'your-project-id' WHERE project_id IS NULL;

-- Step 3: Drop old codices table
DROP TABLE codices;

-- Step 4: Rename new table to original name
ALTER TABLE codices_new RENAME TO codices;

-- Step 5: Recreate all indexes (from migration 002, minus parent_id index)
CREATE INDEX IF NOT EXISTS idx_codices_template_id ON codices(template_id);
CREATE INDEX IF NOT EXISTS idx_codices_project_id ON codices(project_id);
-- ❌ REMOVED: idx_codices_parent_id (parent_id column removed)
CREATE INDEX IF NOT EXISTS idx_codices_created_at ON codices(created_at);
CREATE INDEX IF NOT EXISTS idx_codices_updated_at ON codices(updated_at);
CREATE INDEX IF NOT EXISTS idx_codices_created_by ON codices(created_by);

-- Verification Queries (run after migration):
--
-- 1. Verify all codices have valid project_id:
--    SELECT COUNT(*) FROM codices WHERE project_id IS NULL;
--    -- Expected: 0
--
-- 2. Verify foreign key constraint works:
--    INSERT INTO codices (id, template_id, title, content, metadata, created_at, updated_at, project_id)
--    VALUES ('test', 'tpl', 'Test', '{}', '{}', datetime('now'), datetime('now'), 'invalid-project-id');
--    -- Expected: FOREIGN KEY constraint failed
--
-- 3. Verify cascade delete works:
--    DELETE FROM projects WHERE id = 'some-project-id';
--    SELECT COUNT(*) FROM codices WHERE project_id = 'some-project-id';
--    -- Expected: 0 (all codices in that project were deleted)
--
-- 4. Verify parent_id column is gone:
--    PRAGMA table_info(codices);
--    -- Expected: No parent_id column in output

-- Migration Impact:
-- - ✅ Codices now MUST belong to a valid project (referential integrity enforced)
-- - ✅ Deleting a project automatically deletes all its codices (ON DELETE CASCADE)
-- - ✅ Database enforces data consistency (cannot insert codex with invalid project_id)
-- - ❌ Parent-child relationships now handled by codex_contexts table (many-to-many)
-- - ⚠️  Orphaned codices (NULL project_id) assigned to default project or migration fails

-- +migrate down
-- Rollback: Recreate original codices table (with parent_id, without FK)
-- Warning: This rollback will LOSE the foreign key constraint and cascade behavior
-- Data loss risk: If projects were deleted after this migration, their codices are also gone

-- Step 1: Create old codices table structure (from migration 002)
CREATE TABLE IF NOT EXISTS codices_old (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata TEXT NOT NULL,
    crdt_state TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    created_by TEXT,
    project_id TEXT,                  -- Back to nullable, no FK
    parent_id TEXT,                   -- Restored (but will be NULL for all rows)
    FOREIGN KEY(parent_id) REFERENCES codices(id) ON DELETE SET NULL
);

-- Step 2: Copy data back from current codices table
-- Note: parent_id will be NULL for all rows (data was not preserved)
INSERT INTO codices_old (
    id,
    template_id,
    title,
    content,
    metadata,
    crdt_state,
    version,
    created_at,
    updated_at,
    created_by,
    project_id,
    parent_id
)
SELECT
    id,
    template_id,
    title,
    content,
    metadata,
    crdt_state,
    version,
    created_at,
    updated_at,
    created_by,
    project_id,
    NULL  -- parent_id data was not preserved during upgrade
FROM codices;

-- Step 3: Drop current table
DROP TABLE codices;

-- Step 4: Rename old table back to original name
ALTER TABLE codices_old RENAME TO codices;

-- Step 5: Recreate original indexes (including parent_id index)
CREATE INDEX IF NOT EXISTS idx_codices_template_id ON codices(template_id);
CREATE INDEX IF NOT EXISTS idx_codices_project_id ON codices(project_id);
CREATE INDEX IF NOT EXISTS idx_codices_parent_id ON codices(parent_id);
CREATE INDEX IF NOT EXISTS idx_codices_created_at ON codices(created_at);
CREATE INDEX IF NOT EXISTS idx_codices_updated_at ON codices(updated_at);
CREATE INDEX IF NOT EXISTS idx_codices_created_by ON codices(created_by);

-- Rollback Notes:
-- - ❌ Foreign key constraint removed (no referential integrity enforcement)
-- - ❌ Cascade delete behavior lost (orphaned codices possible)
-- - ❌ parent_id column restored but ALL values are NULL (data lost)
-- - ⚠️  Any codices deleted by cascade (from project deletion) are permanently lost
-- - ⚠️  Application must handle NULL project_id values again
--
-- Data Loss Scenarios:
-- 1. If any projects were deleted after migration 008, their codices are gone forever
-- 2. parent_id relationships were not preserved (intentionally, as codex_contexts replaces them)
-- 3. Multi-context associations (from codex_contexts) are not rolled back here
--
-- Recommendation:
-- - Only rollback if migration 008 caused critical issues immediately after running
-- - Do NOT rollback if system has been running with migration 008 for any length of time
-- - Always backup database before running migrations OR rollbacks
