# Database Persistence Implementation Plan

**Status**: Planning Phase
**Priority**: CRITICAL (Next immediate task)
**Estimated Time**: 4-5 hours total

## Problem Statement

Currently, codices are stored only in RAM (`state.codices` RwLock HashMap in Bindery backend). This causes:

1. **Data loss on restart**: Codices disappear when Extension Development Host closes
2. **No database writes**: Only `tasks.db-shm` updated (Oct 7 18:47), main database from Oct 6
3. **Session-only persistence**: Edits work during session but don't survive

## Current State

**What Works** ✅
- Session persistence (edits persist when switching between codices)
- Create, update, delete operations work in-memory
- JSON-RPC communication functional

**What's Missing** ⚠️
- SQLite INSERT/UPDATE/DELETE operations
- Database loading on startup
- WAL checkpoint to flush changes to disk

## Database Schema Design

### Codices Table

```sql
CREATE TABLE IF NOT EXISTS codices (
    id TEXT PRIMARY KEY,              -- UUID string
    title TEXT NOT NULL,              -- Display title
    template_id TEXT NOT NULL,        -- Template type (character, scene, etc.)
    content TEXT,                     -- JSON: { fields: {...} }
    tags TEXT,                        -- JSON: ["tag1", "tag2"]
    references TEXT,                  -- JSON: [{id, type, context}]
    project_id TEXT,                  -- Optional project grouping
    created_at TEXT NOT NULL,         -- RFC3339 timestamp
    updated_at TEXT NOT NULL,         -- RFC3339 timestamp

    -- Indexes for common queries
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_codices_template ON codices(template_id);
CREATE INDEX IF NOT EXISTS idx_codices_project ON codices(project_id);
CREATE INDEX IF NOT EXISTS idx_codices_created ON codices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_codices_updated ON codices(updated_at DESC);
```

**JSON Field Examples:**
```json
// content
{
  "fields": {
    "name": "Alice",
    "age": "25",
    "description": "Protagonist...",
    "background": "Born in..."
  }
}

// tags
["character", "creative-writing", "protagonist"]

// references
[
  {
    "id": "scene-123",
    "type": "appears_in",
    "context": "Chapter 1"
  }
]
```

## Implementation Steps

### Step 1: Database Migration (30 minutes)

**File**: `vespera-bindery/migrations/YYYYMMDD_create_codices_table.sql`

Create migration SQL with table and indexes.

**File**: `vespera-bindery/src/bin/server.rs` (startup)

Add migration execution on server startup:
```rust
// Run migrations
database.run_migrations().await?;
```

### Step 2: Database Write Operations (2 hours)

**File**: `vespera-bindery/src/bin/server.rs`

#### handle_create_codex (lines 749-777)
```rust
async fn handle_create_codex(state: &AppState, params: &Option<Value>) -> Result<Value, String> {
    // ... existing parameter extraction ...

    let codex_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let codex = json!({
        "id": codex_id,
        "title": title,
        "template_id": template_id,
        "created_at": now,
        "updated_at": now,
        "content": {"fields": {}},
        "tags": [],
        "references": []
    });

    // INSERT into database
    state.database.execute(
        "INSERT INTO codices (id, title, template_id, content, tags, references, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        &[
            &codex_id,
            title,
            template_id,
            &serde_json::to_string(&codex["content"]).unwrap(),
            &serde_json::to_string(&codex["tags"]).unwrap(),
            &serde_json::to_string(&codex["references"]).unwrap(),
            &now,
            &now
        ]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    // Also update in-memory cache
    let mut codices = state.codices.write().await;
    codices.insert(codex_id.clone(), codex);

    Ok(json!(codex_id))
}
```

#### handle_update_codex (lines 794-846)
```rust
async fn handle_update_codex(state: &AppState, params: &Option<Value>) -> Result<Value, String> {
    // ... existing parameter extraction and update logic ...

    // UPDATE database
    let now = chrono::Utc::now().to_rfc3339();
    state.database.execute(
        "UPDATE codices
         SET title = COALESCE(?, title),
             content = COALESCE(?, content),
             template_id = COALESCE(?, template_id),
             tags = COALESCE(?, tags),
             references = COALESCE(?, references),
             updated_at = ?
         WHERE id = ?",
        &[
            params_obj.get("title").map(|v| v.as_str().unwrap()),
            params_obj.get("content").map(|v| serde_json::to_string(v).unwrap()),
            params_obj.get("template_id").map(|v| v.as_str().unwrap()),
            params_obj.get("tags").map(|v| serde_json::to_string(v).unwrap()),
            params_obj.get("references").map(|v| serde_json::to_string(v).unwrap()),
            &now,
            codex_id
        ]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    // Update in-memory cache
    let mut codices = state.codices.write().await;
    codices.insert(codex_id.to_string(), codex.clone());

    Ok(codex)
}
```

#### handle_delete_codex (lines 848-856)
```rust
async fn handle_delete_codex(state: &AppState, params: &Option<Value>) -> Result<Value, String> {
    let codex_id = params
        .as_ref()
        .and_then(|p| p.get("codex_id"))
        .and_then(|v| v.as_str())
        .ok_or("Missing codex_id parameter")?;

    // DELETE from database
    state.database.execute(
        "DELETE FROM codices WHERE id = ?",
        &[codex_id]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    // Remove from in-memory cache
    let mut codices = state.codices.write().await;
    match codices.remove(codex_id) {
        Some(_) => Ok(json!(true)),
        None => Err("Codex not found".to_string()),
    }
}
```

### Step 3: Database Read Operations (1 hour)

**File**: `vespera-bindery/src/bin/server.rs`

#### Server Startup (in main())
```rust
async fn main() -> Result<()> {
    // ... existing initialization ...

    // Load codices from database into memory
    let rows = database.query("SELECT * FROM codices", &[]).await?;
    let mut codices_map = HashMap::new();

    for row in rows {
        let id: String = row.get("id")?;
        let title: String = row.get("title")?;
        let template_id: String = row.get("template_id")?;
        let content: String = row.get("content")?;
        let tags: String = row.get("tags")?;
        let references: String = row.get("references")?;
        let created_at: String = row.get("created_at")?;
        let updated_at: String = row.get("updated_at")?;

        let codex = json!({
            "id": id,
            "title": title,
            "template_id": template_id,
            "content": serde_json::from_str::<Value>(&content)?,
            "tags": serde_json::from_str::<Value>(&tags)?,
            "references": serde_json::from_str::<Value>(&references)?,
            "created_at": created_at,
            "updated_at": updated_at
        });

        codices_map.insert(id, codex);
    }

    let state = Arc::new(AppState {
        database,
        codices: RwLock::new(codices_map),
        // ... other state fields ...
    });

    info!("Loaded {} codices from database", state.codices.read().await.len());

    // ... rest of startup ...
}
```

#### handle_list_codices
```rust
async fn handle_list_codices(state: &AppState) -> Result<Value, String> {
    // Option 1: Use in-memory cache (fast)
    let codices = state.codices.read().await;
    let ids: Vec<String> = codices.keys().cloned().collect();
    Ok(json!(ids))

    // Option 2: Query database (always fresh)
    // let rows = state.database.query("SELECT id FROM codices ORDER BY created_at DESC", &[])
    //     .await.map_err(|e| format!("Database error: {}", e))?;
    // let ids: Vec<String> = rows.iter().map(|r| r.get("id").unwrap()).collect();
    // Ok(json!(ids))
}
```

### Step 4: WAL Checkpoint (30 minutes)

Add periodic WAL checkpoint to flush changes to main database file:

```rust
// In server startup or periodic task
state.database.execute("PRAGMA wal_checkpoint(TRUNCATE)", &[]).await?;
```

Or configure SQLite to checkpoint more frequently:
```rust
// On database connection
database.execute("PRAGMA wal_autocheckpoint=1000", &[]).await?;
```

## Testing Plan

### Unit Tests
1. Test codex INSERT with valid data
2. Test codex UPDATE with partial fields
3. Test codex DELETE removes from both DB and cache
4. Test codex load on startup populates cache

### Integration Tests
1. Create codex via UI → verify in database
2. Edit codex fields → verify UPDATE in database
3. Close extension → reopen → verify codices loaded
4. Check `tasks.db` file timestamp updated

### Manual Testing Checklist
- [ ] Create Character codex, verify in database
- [ ] Edit fields, verify UPDATE query executed
- [ ] Close Extension Development Host
- [ ] Reopen Extension Development Host
- [ ] Verify codices appear in Navigator
- [ ] Verify field values retained
- [ ] Check `ls -lah .vespera/tasks.db*` shows updated timestamps

## Files to Modify

1. `vespera-bindery/migrations/YYYYMMDD_create_codices_table.sql` - NEW
2. `vespera-bindery/src/bin/server.rs` - MODIFY
   - Add migration execution
   - Update `handle_create_codex` (INSERT)
   - Update `handle_update_codex` (UPDATE)
   - Update `handle_delete_codex` (DELETE)
   - Update `handle_list_codices` (SELECT)
   - Load codices on startup
3. `vespera-bindery/src/database.rs` - VERIFY (may need helper methods)

## Rollback Plan

If database persistence fails:
1. Keep in-memory storage working
2. Add feature flag for database writes
3. Fall back to file-based storage (JSON files)

## Success Criteria

✅ All criteria must pass:
- [ ] Codices survive extension restart
- [ ] `tasks.db` file timestamp updates on create/update/delete
- [ ] WAL file checkpoints to main database
- [ ] No data loss during normal operation
- [ ] Performance: < 50ms for CRUD operations
- [ ] Memory: Cache size reasonable (< 10MB for 1000 codices)

## Timeline

- **Day 1 (2-3 hours)**: Schema design + migration + write operations
- **Day 1 (1-2 hours)**: Read operations + startup loading
- **Day 1 (30 min)**: WAL checkpoint + testing
- **Day 2 (1 hour)**: Bug fixes + edge cases + documentation

**Total Estimated**: 4-5 hours of focused development

## Next Session Agenda

1. Review this plan with user
2. Create migration SQL file
3. Implement database write operations
4. Test create/update/delete in Extension Development Host
5. Implement startup loading
6. Test full persistence cycle
