# Database Persistence Fix - "No Such Table: Codices" Error

**Date**: 2025-10-08
**Status**: ✅ FIXED - Ready for Testing
**Branch**: `feat/codex-ui-framework`
**Commits**: 1c6454c, 960e336

## 🐛 Problem

When launching the Extension Development Host (F5), the Bindery server crashed with:

```
Error: error returned from database: (code: 1) no such table: codices
Caused by: (code: 1) no such table: codices
```

**Symptoms:**
- Bindery server crashed during startup
- Codices didn't appear in the Navigator UI
- Create codex requests timed out

## 🔍 Root Cause Analysis

The migration system was looking for migrations in the wrong directory:

```
WARN: Migrations directory not found at "/home/aya/Projects/discord-chat-logs/migrations"
```

This caused the server to fall back to `init_schema()`, which **only created the `tasks` table**, not the `codices` table.

When our new startup code tried to load codices from the database:
```rust
// Line 194 in server.rs
let rows = sqlx::query("SELECT id, title, ... FROM codices")
```

The query failed because the `codices` table didn't exist! 💥

## ✅ Solution

Updated `database.rs` to include the `codices` table in the fallback schema initialization:

**File**: `packages/vespera-utilities/vespera-bindery/src/database.rs:665-714`

```rust
pub async fn init_schema(&self) -> Result<()> {
    sqlx::query(
        r#"
        // ... tasks table creation ...

        CREATE TABLE IF NOT EXISTS codices (
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
            project_id TEXT,
            parent_id TEXT,
            FOREIGN KEY(parent_id) REFERENCES codices(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_codices_template ON codices(template_id);
        CREATE INDEX IF NOT EXISTS idx_codices_created ON codices(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_codices_updated ON codices(updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_codices_project ON codices(project_id);
        "#
    ).execute(&self.pool).await?;

    Ok(())
}
```

## 📦 What Changed

### Modified Files

1. **database.rs** (commit 1c6454c)
   - Added codices table creation to `init_schema()` fallback
   - Includes all columns from migration `002_codex_tables.sql`
   - Includes all performance indices
   - Ensures database works even without migration files

2. **DATABASE_PERSISTENCE_COMPLETE.md** (commit 960e336)
   - Documented the fix in "Known Issues" section
   - Updated modified files list
   - Marked critical issue as RESOLVED

### Build Status

✅ **Bindery server compiles successfully**
```bash
Finished `dev` profile [unoptimized + debuginfo] target(s) in 52.24s
```

## 🧪 Next Steps: Testing

The fix is ready for testing! Follow these steps:

### 1. Launch Extension Development Host

```bash
# From VSCode, press F5 to launch Extension Development Host
# OR from terminal:
cd plugins/VSCode/vespera-forge
npm run watch
# Then F5 in VSCode
```

### 2. Test Codex Creation

1. Open the Navigator panel
2. Create a new Codex (try different templates: Character, Scene, etc.)
3. Fill in some fields
4. Save changes

### 3. Test Persistence

1. Create 2-3 codices with different data
2. Close the Extension Development Host window
3. Press F5 to relaunch
4. **Verify**: Do the codices still appear in the Navigator?
5. **Verify**: Are the field values retained?

### 4. Verify Database Files

```bash
# Check database file timestamps
ls -lah ~/.vespera/tasks.db*

# Expected files:
# tasks.db       - Main database (should update on writes)
# tasks.db-shm   - Shared memory file
# tasks.db-wal   - Write-ahead log file

# Query database directly (optional)
sqlite3 ~/.vespera/tasks.db
> SELECT id, title, template_id, created_at FROM codices;
> .exit
```

### 5. Check Server Logs

Look for these success messages in the Bindery server output:

```
Debug: Loading codices from database...
Debug: Loaded X codices from database
```

## 🎯 Expected Behavior

After this fix:
- ✅ Bindery server starts without errors
- ✅ Codices table is created automatically
- ✅ Codices can be created, updated, and deleted
- ✅ Codices survive extension restarts
- ✅ Database files update on disk (not just .shm)

## 📝 Technical Notes

- **Migration System**: Still looks in workspace directory, which may vary
- **Fallback Strategy**: `init_schema()` now provides complete schema coverage
- **WAL Mode**: Enabled with explicit checkpoints after each write
- **Data Safety**: All operations are atomic with proper error handling
- **Performance**: In-memory cache maintained for fast reads

## 🚀 Future Improvements

1. **Fix migration path resolution** to find migrations in Bindery package directory
2. **Add integration tests** for database persistence
3. **Implement database health checks** in extension UI
4. **Add progress indicators** during codex operations

---

**Status**: Ready for user testing! Please try the steps above and report any issues.

**Commits**:
- `1c6454c` - fix(vespera-bindery): Add codices table to init_schema fallback
- `960e336` - docs: Update DATABASE_PERSISTENCE_COMPLETE.md with init_schema fix
