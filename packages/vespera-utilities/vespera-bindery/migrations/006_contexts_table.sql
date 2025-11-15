-- Contexts table for Workspace → Project → Context hierarchy
-- Creates the Contexts layer as organizational lenses within projects
-- Part of ADR-015: Workspace/Project/Context Hierarchy refactoring
--
-- Key Concept: Contexts are organizational modes within a project
-- - A project can have multiple contexts (story, research, code, art)
-- - Each context represents a different way of organizing the same project's content
-- - Contexts inherit their type from the parent project's project_type
-- - Codices belong to projects and can appear in multiple contexts
--
-- Example: "Mythological RPG Game" project might have:
--   - "Story & Narrative" context (fiction templates)
--   - "Mythology Research" context (research templates)
--   - "Game Mechanics" context (software templates)
--   - "Art & Assets" context (creative templates)
--
-- Version: 6
-- Created: 2025-10-25 00:00:00 UTC

-- +migrate up
-- Contexts table - organizational lenses within projects
CREATE TABLE IF NOT EXISTS contexts (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    context_type TEXT NOT NULL,  -- Inherits from project_type: 'fiction', 'research', 'journalism', 'software', etc.
    icon TEXT,                   -- Optional icon for visual identification (e.g., 'book', 'microscope', 'code')
    color TEXT,                  -- Optional color for visual identification (hex format: '#FF5733')
    sort_order INTEGER,          -- Display order within project (lower = higher priority)
    settings TEXT,               -- JSON blob for context-specific settings (view preferences, filters, etc.)
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Indexes for performance
-- Critical: Most queries filter contexts by project_id
CREATE INDEX IF NOT EXISTS idx_contexts_project_id ON contexts(project_id);

-- For filtering contexts by type (e.g., show all fiction contexts)
CREATE INDEX IF NOT EXISTS idx_contexts_context_type ON contexts(context_type);

-- For temporal queries (recently created contexts)
CREATE INDEX IF NOT EXISTS idx_contexts_created_at ON contexts(created_at);

-- For "recently updated" views
CREATE INDEX IF NOT EXISTS idx_contexts_updated_at ON contexts(updated_at);

-- For ordering contexts within a project
CREATE INDEX IF NOT EXISTS idx_contexts_sort_order ON contexts(sort_order);

-- Enable the bidirectional foreign key constraint from projects to contexts
-- This completes the relationship where:
--   - projects.active_context_id → contexts.id (which context is currently active)
--   - contexts.project_id → projects.id (which project owns this context)
--
-- SQLite doesn't support ALTER TABLE ADD CONSTRAINT directly, so we document this
-- relationship here. The constraint is already defined in 005_projects_table.sql
-- as a TODO comment. Future migrations or application-level validation should
-- enforce that projects.active_context_id references a valid context.id.
--
-- Note: The constraint will be enforced at the application level in the Rust backend:
--   1. When setting active_context_id, verify the context belongs to the project
--   2. When deleting a context, if it's the active context, set active_context_id to NULL or another context
--   3. Validate context_id references during project updates

-- +migrate down
-- Drop indexes first (in reverse order)
DROP INDEX IF EXISTS idx_contexts_sort_order;
DROP INDEX IF EXISTS idx_contexts_updated_at;
DROP INDEX IF EXISTS idx_contexts_created_at;
DROP INDEX IF EXISTS idx_contexts_context_type;
DROP INDEX IF EXISTS idx_contexts_project_id;

-- Drop table
-- Note: This will cascade delete all context references via ON DELETE CASCADE
-- but will NOT affect projects.active_context_id (application must handle orphaned references)
DROP TABLE IF EXISTS contexts;

-- Revert projects.active_context_id constraint note:
-- The foreign key constraint from projects(active_context_id) to contexts(id)
-- was documented but not enforced in SQLite. Rolling back this migration
-- returns to the state where projects.active_context_id is an unvalidated TEXT field.
