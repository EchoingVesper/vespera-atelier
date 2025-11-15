-- Codex-Contexts join table for many-to-many relationships
-- Creates the connection between codices and contexts, allowing a codex
-- to appear in multiple organizational lenses while maintaining a single
-- canonical project membership.
--
-- Part of ADR-015: Workspace/Project/Context Hierarchy refactoring
--
-- Key Concept: Multi-Context Codices
-- - A codex belongs to ONE project (codices.project_id)
-- - A codex can appear in MULTIPLE contexts within that project
-- - Each codex has ONE primary context (is_primary = 1)
-- - Contexts provide different organizational views of the same content
--
-- Example: "Zeus Character" codex in "Mythological RPG Game" project:
--   - Primary context: "Story & Narrative" (is_primary = 1) - where Zeus was created
--   - Also in: "Mythology Research" (is_primary = 0) - for research reference
--   - Also in: "Art & Assets" (is_primary = 0) - for character design
--
-- The same codex, viewed through different organizational lenses:
--   - In Story context: Organized by narrative role, shows character arc
--   - In Research context: Organized by mythological category, shows citations
--   - In Art context: Organized by asset type, shows design references
--
-- Version: 7
-- Created: 2025-10-25 00:00:00 UTC

-- +migrate up
-- Codex-Contexts join table - many-to-many relationship
CREATE TABLE IF NOT EXISTS codex_contexts (
    codex_id TEXT NOT NULL,
    context_id TEXT NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0,  -- Boolean: 1 = primary context, 0 = secondary
    added_at TEXT NOT NULL,                 -- ISO 8601 timestamp when codex was added to context
    sort_order INTEGER,                      -- Custom sort order within context (NULL = default ordering)
    PRIMARY KEY (codex_id, context_id),
    FOREIGN KEY(codex_id) REFERENCES codices(id) ON DELETE CASCADE,
    FOREIGN KEY(context_id) REFERENCES contexts(id) ON DELETE CASCADE
);

-- Important Constraint (enforced at application level):
-- Each codex MUST have exactly ONE is_primary = 1 entry across all its contexts.
-- SQLite does not support partial unique indexes or CHECK constraints with subqueries,
-- so this constraint must be validated in the application layer:
--
-- Validation rules:
--   1. When adding a codex to its first context: is_primary MUST be 1
--   2. When adding a codex to additional contexts: is_primary MUST be 0
--   3. When changing primary context: Update old primary to 0, new primary to 1 (atomic operation)
--   4. When removing a context: If it's the primary context, promote another context to primary
--   5. Never allow a codex to have zero primary contexts (would be orphaned)
--   6. Never allow a codex to have multiple primary contexts (ambiguous)
--
-- Business logic enforcement:
--   - Rust backend validates primary constraint before INSERT/UPDATE
--   - API endpoints return error if primary constraint would be violated
--   - Migration tools ensure all existing codices have valid primary context

-- Indexes for performance
-- Critical: Find all contexts for a specific codex (most common query)
-- Example: "Show me all contexts where Zeus appears"
CREATE INDEX IF NOT EXISTS idx_codex_contexts_codex_id ON codex_contexts(codex_id);

-- Critical: Find all codices in a specific context (primary use case)
-- Example: "Show me all codices in Story & Narrative context"
CREATE INDEX IF NOT EXISTS idx_codex_contexts_context_id ON codex_contexts(context_id);

-- Important: Find primary context for codices quickly
-- Example: "What's the home context for Zeus?"
CREATE INDEX IF NOT EXISTS idx_codex_contexts_is_primary ON codex_contexts(is_primary);

-- Important: Ordered lists within contexts
-- Example: "Show codices in Story context, ordered by sort_order"
-- Composite index allows efficient "WHERE context_id = ? ORDER BY sort_order" queries
CREATE INDEX IF NOT EXISTS idx_codex_contexts_context_sort ON codex_contexts(context_id, sort_order);

-- Useful: Temporal queries for recently added codices to contexts
-- Example: "Show me codices added to Research context this week"
CREATE INDEX IF NOT EXISTS idx_codex_contexts_added_at ON codex_contexts(added_at);

-- Example Usage:
--
-- 1. Create a codex in its primary context:
--    INSERT INTO codex_contexts (codex_id, context_id, is_primary, added_at, sort_order)
--    VALUES ('zeus-001', 'story-ctx', 1, '2025-01-15T10:00:00Z', 1);
--
-- 2. Add same codex to additional contexts:
--    INSERT INTO codex_contexts (codex_id, context_id, is_primary, added_at, sort_order)
--    VALUES
--      ('zeus-001', 'research-ctx', 0, '2025-01-15T11:00:00Z', 5),
--      ('zeus-001', 'art-ctx', 0, '2025-01-15T12:00:00Z', 3);
--
-- 3. Query all contexts for a codex:
--    SELECT c.* FROM contexts c
--    JOIN codex_contexts cc ON cc.context_id = c.id
--    WHERE cc.codex_id = 'zeus-001'
--    ORDER BY cc.is_primary DESC, cc.added_at ASC;
--
-- 4. Query all codices in a context, ordered:
--    SELECT co.* FROM codices co
--    JOIN codex_contexts cc ON cc.codex_id = co.id
--    WHERE cc.context_id = 'story-ctx'
--    ORDER BY cc.sort_order ASC NULLS LAST, co.title ASC;
--
-- 5. Find primary context for a codex:
--    SELECT c.* FROM contexts c
--    JOIN codex_contexts cc ON cc.context_id = c.id
--    WHERE cc.codex_id = 'zeus-001' AND cc.is_primary = 1;
--
-- 6. Change primary context (atomic operation):
--    BEGIN TRANSACTION;
--    UPDATE codex_contexts SET is_primary = 0
--      WHERE codex_id = 'zeus-001' AND context_id = 'story-ctx';
--    UPDATE codex_contexts SET is_primary = 1
--      WHERE codex_id = 'zeus-001' AND context_id = 'research-ctx';
--    COMMIT;
--
-- Cascade Behavior:
-- - DELETE codex → Removes all codex_contexts entries (ON DELETE CASCADE)
-- - DELETE context → Removes all codex_contexts entries for that context (ON DELETE CASCADE)
--   - Application must handle orphaned codices if their primary context is deleted
--   - Recommendation: Promote another context to primary, or move to default context

-- +migrate down
-- Drop indexes first (in reverse order of creation)
DROP INDEX IF EXISTS idx_codex_contexts_added_at;
DROP INDEX IF EXISTS idx_codex_contexts_context_sort;
DROP INDEX IF EXISTS idx_codex_contexts_is_primary;
DROP INDEX IF EXISTS idx_codex_contexts_context_id;
DROP INDEX IF EXISTS idx_codex_contexts_codex_id;

-- Drop table
-- Note: This will orphan context associations for codices
-- Application should handle migration rollback by:
--   1. Storing context associations temporarily
--   2. Dropping table
--   3. Reverting to Phase 16b single-context model
DROP TABLE IF EXISTS codex_contexts;

-- Rollback Note:
-- This migration establishes the many-to-many relationship between codices and contexts.
-- Rolling back removes this relationship, reverting to the Phase 16b model where codices
-- had a direct single project_id (which becomes context_id in the old model).
--
-- If rolling back from Phase 17 to Phase 16b, application must:
--   1. Extract primary context for each codex (WHERE is_primary = 1)
--   2. Store as codices.project_id (actually context_id in 16b naming)
--   3. Drop codex_contexts table
--   4. Accept loss of multi-context functionality
