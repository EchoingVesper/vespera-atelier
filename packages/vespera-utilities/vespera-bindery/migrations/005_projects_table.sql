-- Projects table for Workspace → Project → Context hierarchy
-- Creates the Projects layer as real-world creative endeavors containing multiple organizational contexts
-- Part of ADR-015: Workspace/Project/Context Hierarchy refactoring
-- Version: 5
-- Created: 2025-10-25 00:00:00 UTC

-- +migrate up
-- Projects table - real-world creative/professional endeavors
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    project_type TEXT NOT NULL, -- 'fiction', 'research', 'journalism', 'software', etc.
    active_context_id TEXT,
    settings TEXT, -- JSON blob for project-specific settings
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
    -- TODO: Enable this foreign key constraint in migration 006_contexts_table.sql after contexts table is created
    -- FOREIGN KEY(active_context_id) REFERENCES contexts(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_workspace_id ON projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_active_context_id ON projects(active_context_id);
CREATE INDEX IF NOT EXISTS idx_projects_project_type ON projects(project_type);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at);

-- +migrate down
-- Drop indexes first
DROP INDEX IF EXISTS idx_projects_updated_at;
DROP INDEX IF EXISTS idx_projects_created_at;
DROP INDEX IF EXISTS idx_projects_project_type;
DROP INDEX IF EXISTS idx_projects_active_context_id;
DROP INDEX IF EXISTS idx_projects_workspace_id;

-- Drop table
DROP TABLE IF EXISTS projects;
