# Vespera Bindery Database Migrations

This directory contains SQL migrations for the Vespera Bindery database schema evolution.

---

## Migration Files

Migrations are numbered sequentially and should be applied in order:

| Migration | Description | Phase | Status |
|-----------|-------------|-------|--------|
| `001_initial.sql` | Initial schema - Tasks table with hierarchical support | Phase 1 | ✅ Baseline |
| `002_codex_tables.sql` | Codex and template system tables | Phase 2 | ✅ Baseline |
| `003_automation_system.sql` | Automation and tag-driven event system | Phase 3 | ✅ Baseline |
| `004_rag_system.sql` | RAG (Retrieval-Augmented Generation) system | Phase 4 | ✅ Baseline |
| `005_projects_table.sql` | Projects table for workspace hierarchy | **Phase 17** | ✅ Tested |
| `006_contexts_table.sql` | Contexts table for organizational lenses | **Phase 17** | ✅ Tested |
| `007_codex_contexts_join.sql` | Many-to-many codex-context relationships | **Phase 17** | ✅ Tested |
| `008_update_codices_project_fk.sql` | Add project FK to codices, remove parent_id | **Phase 17** | ✅ Tested |

---

## Schema Versions

### Phase 16b (Baseline): Migrations 001-004

**Baseline schema** for Vespera Bindery before Phase 17 refactoring.

**Tables**:
- `tasks`: Task management with hierarchical support
- `codices`: Universal content storage (with nullable project_id, parent_id)
- `templates`: Template definitions for codex types
- `codex_references`: Relationships between codices
- `codex_tags`: Flexible tagging system
- `automation_rules`: Tag-driven automation rules
- `event_queue`: Event processing queue
- `rag_*`: RAG system tables (embeddings, chunks, etc.)

**Key Characteristics**:
- Codices use `parent_id` for hierarchical relationships (simple tree)
- `project_id` is nullable and has no FK constraint
- Single organizational hierarchy per codex

---

### Phase 17: Migrations 005-008

**New schema** implementing the Workspace → Project → Context → Codex hierarchy per ADR-015.

**New Tables**:
- `projects`: Real-world creative endeavors (novels, games, research papers)
- `contexts`: Organizational lenses within projects (multiple views of same content)
- `codex_contexts`: Many-to-many join table (codex can appear in multiple contexts)

**Key Changes**:
- `codices.project_id`: Now **NOT NULL** with **FK constraint** to `projects.id`
- `codices.parent_id`: **REMOVED** (replaced by `codex_contexts` many-to-many)
- **Multi-context support**: Same codex can appear in multiple organizational views
- **Primary context**: Each codex has one primary context (where it was created)

**Migration Strategy**:
- Migration 008 performs full table recreation (SQLite limitation)
- Data is preserved during migration via `INSERT ... SELECT`
- Orphaned codices assigned to `'default-project-id'` (configurable)

**See**: [`TEST_RESULTS_PHASE17.md`](./TEST_RESULTS_PHASE17.md) for comprehensive test results

---

## Architecture Decision Records

**Phase 17 migrations implement the following ADRs**:

- **[ADR-015: Workspace/Project/Context Hierarchy](../../../docs/development/decisions/ADR-015-workspace-project-context-hierarchy.md)**
  - Establishes three-tier organizational hierarchy
  - Replaces simple project_id with full hierarchy
  - Enables multi-context content organization

---

## Migration Order and Dependencies

### Correct Migration Order

**ALWAYS apply migrations in this order**:

```bash
001 → 002 → 003 → 004 → 005 → 006 → 007 → 008
```

### Dependencies

**Migration 005 (projects table)**:
- No dependencies (creates new table)

**Migration 006 (contexts table)**:
- Depends on: 005 (references `projects.id`)

**Migration 007 (codex_contexts join table)**:
- Depends on: 002 (references `codices.id`)
- Depends on: 006 (references `contexts.id`)

**Migration 008 (codices table update)**:
- Depends on: 005 (adds FK to `projects.id`)
- Depends on: 007 (replaces parent_id with codex_contexts)

**Critical**: Migrations 005-008 MUST be applied together as a unit. Partial application will leave database in inconsistent state.

---

## Running Migrations

### Prerequisites

- SQLite 3.6.19+ (for foreign key support)
- Backup of production database

### Manual Migration (Development)

```bash
# Navigate to migrations directory
cd packages/vespera-utilities/vespera-bindery/migrations

# Apply migrations in order (example: Phase 17)
sqlite3 your_database.db < 005_projects_table.sql
sqlite3 your_database.db < 006_contexts_table.sql
sqlite3 your_database.db < 007_codex_contexts_join.sql
sqlite3 your_database.db < 008_update_codices_project_fk.sql

# Verify foreign key constraints are enabled
sqlite3 your_database.db "PRAGMA foreign_keys = ON; SELECT * FROM PRAGMA_foreign_keys();"
```

**⚠️ IMPORTANT**: Migration files use `+migrate up/down` comment markers for future migration tool integration. When running with raw SQLite, you must extract only the `+migrate up` section to avoid running the down migration immediately.

**Solution**: Use the test script approach:

```bash
# Extract and apply only the +migrate up section
awk '/-- \+migrate up/,/-- \+migrate down/ {if (/-- \+migrate down/) exit; print}' \
    005_projects_table.sql | tail -n +2 | sqlite3 your_database.db
```

Or use the automated test script (see Testing section below).

---

### Production Migration (Recommended)

**🚧 TODO**: Integrate migration tool (e.g., `sql-migrate`, `diesel`) in Rust backend

**Recommended Tool**: `sql-migrate` (https://github.com/rubenv/sql-migrate)
- Supports `+migrate up/down` comment syntax
- Tracks applied migrations in database
- Supports rollback

**Future Integration**:
```bash
# Example with sql-migrate (not yet integrated)
sql-migrate up -env="production"
sql-migrate status -env="production"
```

---

## Rollback Procedures

### Phase 17 Rollback (Migrations 008 → 005)

**⚠️ CRITICAL WARNING**: Rollback WILL cause data loss!

**Data Loss Scenarios**:
1. All `parent_id` values will be **NULL** (not preserved in Phase 17)
2. Multi-context associations will be **lost** (only primary context preserved)
3. Codices deleted via cascade (from project deletion) are **permanently lost**

**When to Rollback**:
- ✅ Immediately after migration if critical issues found
- ❌ NEVER after system has been running with Phase 17 schema
- ❌ NEVER after any projects have been deleted (cascade delete = permanent loss)

**Rollback Order** (REVERSE of migration order):

```bash
# Rollback in reverse order: 008 → 007 → 006 → 005
awk '/-- \+migrate down/,0' 008_update_codices_project_fk.sql | tail -n +2 | sqlite3 your_database.db
awk '/-- \+migrate down/,0' 007_codex_contexts_join.sql | tail -n +2 | sqlite3 your_database.db
awk '/-- \+migrate down/,0' 006_contexts_table.sql | tail -n +2 | sqlite3 your_database.db
awk '/-- \+migrate down/,0' 005_projects_table.sql | tail -n +2 | sqlite3 your_database.db

# Verify rollback
sqlite3 your_database.db "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('projects', 'contexts', 'codex_contexts');"
# Expected: No rows (tables dropped)

sqlite3 your_database.db "PRAGMA table_info(codices);" | grep parent_id
# Expected: parent_id column restored
```

**Post-Rollback State**:
- ✅ Projects table removed
- ✅ Contexts table removed
- ✅ Codex_contexts table removed
- ✅ Codices table restored with `parent_id` column (all NULL values)
- ✅ Codices.project_id reverted to nullable (no FK constraint)

---

## Testing

### Automated Test Suite

**Test Script**: [`test_phase17_migrations.sh`](./test_phase17_migrations.sh)

**What it tests**:
1. ✅ Sequential migration application (001-008)
2. ✅ Schema structure verification
3. ✅ Foreign key constraint enforcement
4. ✅ Cascade delete behavior
5. ✅ Multi-context codex functionality
6. ✅ Query performance with indexes
7. ⚠️ Rollback procedures (partial)

**Running Tests**:
```bash
# Run complete test suite
cd packages/vespera-utilities/vespera-bindery/migrations
./test_phase17_migrations.sh

# Expected output: All tests PASS
# Test database: test_phase17.db (preserved for inspection)
# Test log: test_output.log (detailed execution log)
```

**Test Duration**: ~15-30 seconds

**Test Results**: See [`TEST_RESULTS_PHASE17.md`](./TEST_RESULTS_PHASE17.md)

---

### Integration Test SQL

**Test File**: [`test_phase17_schema.sql`](./test_phase17_schema.sql)

**Coverage**:
- Complete hierarchy creation (workspace → project → contexts → codices)
- FK constraint validation (reject invalid references)
- Primary context uniqueness (application-level constraint)
- Cascade delete verification (project, context, codex)
- Query performance (index usage verification)
- Schema integrity (PRAGMA table_info checks)

**Running Manually**:
```bash
# Run integration tests on existing database
sqlite3 test_database.db < test_phase17_schema.sql

# Check for success message
grep "All Phase 17 integration tests completed successfully" test_output.log
```

---

## Common Issues and Solutions

### Issue 1: Foreign Keys Not Enforced

**Symptoms**: Invalid foreign key references are accepted

**Cause**: SQLite foreign key constraints disabled by default

**Solution**:
```sql
-- Enable foreign keys at connection time
PRAGMA foreign_keys = ON;

-- Verify enabled
SELECT * FROM PRAGMA_foreign_keys();
-- Expected: 1
```

**Rust Backend**: Ensure connection pragma is set:
```rust
conn.execute("PRAGMA foreign_keys = ON", [])?;
```

---

### Issue 2: Migration Fails with "no such table: codices"

**Symptoms**: Migration 008 fails with "no such table: codices"

**Cause**: Migration files executed with raw SQLite run BOTH up and down migrations

**Solution**: Extract only `+migrate up` section:
```bash
awk '/-- \+migrate up/,/-- \+migrate down/ {if (/-- \+migrate down/) exit; print}' \
    migration_file.sql | tail -n +2 | sqlite3 database.db
```

Or use the test script which handles this automatically.

---

### Issue 3: Orphaned Codices After Migration 008

**Symptoms**: Codices exist with NULL project_id after Phase 17 migration

**Cause**: Existing codices had NULL project_id before migration

**Solution (Before Migration)**:
```sql
-- Check for orphaned codices
SELECT COUNT(*) FROM codices WHERE project_id IS NULL;

-- Assign to default project
INSERT INTO projects (id, workspace_id, name, project_type, created_at, updated_at)
VALUES ('default-project-id', 'default-workspace', 'Default Project', 'general',
        datetime('now'), datetime('now'));

UPDATE codices SET project_id = 'default-project-id' WHERE project_id IS NULL;
```

**Solution (After Migration - Already Handled)**:
Migration 008 uses `COALESCE(project_id, 'default-project-id')` to handle this automatically.

---

### Issue 4: Multiple Primary Contexts for Same Codex

**Symptoms**: Codex has more than one `is_primary = 1` entry in codex_contexts

**Cause**: Application-level constraint not enforced (SQLite limitation)

**Detection**:
```sql
-- Find codices with multiple primary contexts
SELECT codex_id, COUNT(*) as primary_count
FROM codex_contexts
WHERE is_primary = 1
GROUP BY codex_id
HAVING primary_count > 1;
```

**Solution**: Implement validation in Rust backend:
```rust
// Before INSERT/UPDATE on codex_contexts
if is_primary && existing_primary_for_codex(codex_id)? {
    return Err("Codex already has a primary context");
}
```

---

## Schema Differences: Phase 16b vs Phase 17

### Codices Table

**Phase 16b (Migration 002)**:
```sql
CREATE TABLE codices (
    id TEXT PRIMARY KEY,
    -- ... other columns ...
    project_id TEXT,              -- Nullable, no FK
    parent_id TEXT,                -- For hierarchical relationships
    FOREIGN KEY(parent_id) REFERENCES codices(id) ON DELETE SET NULL
);
```

**Phase 17 (Migration 008)**:
```sql
CREATE TABLE codices (
    id TEXT PRIMARY KEY,
    -- ... other columns ...
    project_id TEXT NOT NULL,      -- NOT NULL with FK constraint
    -- parent_id REMOVED (replaced by codex_contexts many-to-many)
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

**Key Differences**:
- ❌ `parent_id` column removed
- ✅ `project_id` now NOT NULL
- ✅ `project_id` now has FK constraint to projects.id
- ✅ ON DELETE CASCADE behavior added

---

### New Tables (Phase 17)

**Projects Table** (Migration 005):
```sql
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    project_type TEXT NOT NULL,
    active_context_id TEXT,
    settings TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

**Contexts Table** (Migration 006):
```sql
CREATE TABLE contexts (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    context_type TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    sort_order INTEGER,
    settings TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

**Codex_Contexts Table** (Migration 007):
```sql
CREATE TABLE codex_contexts (
    codex_id TEXT NOT NULL,
    context_id TEXT NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0,
    added_at TEXT NOT NULL,
    sort_order INTEGER,
    PRIMARY KEY (codex_id, context_id),
    FOREIGN KEY(codex_id) REFERENCES codices(id) ON DELETE CASCADE,
    FOREIGN KEY(context_id) REFERENCES contexts(id) ON DELETE CASCADE
);
```

---

## Migration File Format

### Comment Markers

Migration files use `+migrate up/down` markers for future migration tool compatibility:

```sql
-- +migrate up
-- SQL for applying migration
CREATE TABLE example (...);

-- +migrate down
-- SQL for rolling back migration
DROP TABLE example;
```

**Important**: These are just comments for migration tools. Raw SQLite will execute BOTH sections!

**Best Practice**: Use migration tool or extract sections manually (see test script).

---

### File Naming Convention

**Pattern**: `NNN_description.sql`

- `NNN`: Three-digit sequential number (001, 002, ..., 010, 011, ...)
- `description`: Snake_case description of migration (e.g., `projects_table`)
- Extension: `.sql`

**Examples**:
- `001_initial.sql`
- `005_projects_table.sql`
- `008_update_codices_project_fk.sql`

---

## Development Workflow

### Creating a New Migration

1. **Determine Migration Number**:
   ```bash
   ls -1 migrations/*.sql | tail -1  # Get last migration number
   # Example output: 008_update_codices_project_fk.sql
   # Next number: 009
   ```

2. **Create Migration File**:
   ```bash
   touch 009_new_feature.sql
   ```

3. **Write Migration SQL**:
   ```sql
   -- Description of migration
   -- Part of ADR-XXX: ...
   -- Version: 9
   -- Created: 2025-XX-XX 00:00:00 UTC

   -- +migrate up
   -- SQL for applying migration
   CREATE TABLE new_table (...);

   -- +migrate down
   -- SQL for rolling back migration
   DROP TABLE new_table;
   ```

4. **Test Migration**:
   ```bash
   # Create test database
   sqlite3 test.db < 001_initial.sql
   # ... apply previous migrations ...
   sqlite3 test.db < 009_new_feature.sql

   # Verify schema
   sqlite3 test.db ".schema new_table"

   # Test rollback
   awk '/-- \+migrate down/,0' 009_new_feature.sql | tail -n +2 | sqlite3 test.db
   sqlite3 test.db ".schema new_table"  # Should be empty
   ```

5. **Update This README**:
   - Add migration to table in "Migration Files" section
   - Document schema changes in "Schema Differences" section
   - Add any new common issues to "Common Issues and Solutions" section

6. **Create Integration Tests**:
   - Add test scenarios to `test_phase17_schema.sql` (or create new test file)
   - Update `test_phase17_migrations.sh` if needed

---

## Additional Resources

### Documentation

- **ADR-015**: [Workspace/Project/Context Hierarchy](../../../docs/development/decisions/ADR-015-workspace-project-context-hierarchy.md)
- **Test Results**: [TEST_RESULTS_PHASE17.md](./TEST_RESULTS_PHASE17.md)
- **Project Architecture**: [PROJECT_CENTRIC_ARCHITECTURE.md](../../../docs/architecture/core/PROJECT_CENTRIC_ARCHITECTURE.md)
- **Codex Architecture**: [CODEX_ARCHITECTURE.md](../../../docs/architecture/core/CODEX_ARCHITECTURE.md)

### Tools

- **SQLite Documentation**: https://www.sqlite.org/docs.html
- **Foreign Keys**: https://www.sqlite.org/foreignkeys.html
- **sql-migrate**: https://github.com/rubenv/sql-migrate (recommended migration tool)

---

## Changelog

### 2025-10-25: Phase 17 Migrations (005-008)

**Added**:
- Migration 005: Projects table
- Migration 006: Contexts table
- Migration 007: Codex-contexts join table
- Migration 008: Update codices with project FK, remove parent_id

**Tests**:
- Created `test_phase17_migrations.sh` (automated test script)
- Created `test_phase17_schema.sql` (630+ line integration test suite)
- Created `TEST_RESULTS_PHASE17.md` (comprehensive test results)

**Status**: ✅ All tests PASSING, ready for production

---

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).

---

**Generated**: 2025-10-25
**Last Updated**: 2025-10-25
**Maintainer**: Vespera Atelier Development Team
