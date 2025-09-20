-- Codex and template system tables
-- Creates tables for the universal Codex content management system
-- Version: 2
-- Created: 2024-09-20 12:00:00 UTC

-- +migrate up
-- Codex entries table - universal content storage
CREATE TABLE IF NOT EXISTS codices (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL, -- JSON content following template schema
    metadata TEXT NOT NULL, -- JSON metadata (tags, references, etc.)
    crdt_state TEXT, -- CRDT state for collaborative editing
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    created_by TEXT,
    project_id TEXT,
    parent_id TEXT,
    FOREIGN KEY(parent_id) REFERENCES codices(id) ON DELETE SET NULL
);

-- Template definitions table
CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    codex_type TEXT NOT NULL,
    schema_definition TEXT NOT NULL, -- JSON schema for template fields
    ui_config TEXT, -- JSON UI configuration
    automation_rules TEXT, -- JSON automation rules
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    created_by TEXT,
    is_active BOOLEAN NOT NULL DEFAULT 1
);

-- Codex references table - for managing relationships between codices
CREATE TABLE IF NOT EXISTS codex_references (
    id TEXT PRIMARY KEY,
    source_codex_id TEXT NOT NULL,
    target_codex_id TEXT NOT NULL,
    reference_type TEXT NOT NULL, -- 'child', 'link', 'embed', 'dependency', etc.
    reference_metadata TEXT, -- JSON metadata about the reference
    created_at TEXT NOT NULL,
    created_by TEXT,
    FOREIGN KEY(source_codex_id) REFERENCES codices(id) ON DELETE CASCADE,
    FOREIGN KEY(target_codex_id) REFERENCES codices(id) ON DELETE CASCADE,
    UNIQUE(source_codex_id, target_codex_id, reference_type)
);

-- Codex tags table - for flexible tagging system
CREATE TABLE IF NOT EXISTS codex_tags (
    id TEXT PRIMARY KEY,
    codex_id TEXT NOT NULL,
    tag_name TEXT NOT NULL,
    tag_value TEXT, -- Optional tag value for key-value tags
    created_at TEXT NOT NULL,
    FOREIGN KEY(codex_id) REFERENCES codices(id) ON DELETE CASCADE,
    UNIQUE(codex_id, tag_name, tag_value)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_codices_template_id ON codices(template_id);
CREATE INDEX IF NOT EXISTS idx_codices_project_id ON codices(project_id);
CREATE INDEX IF NOT EXISTS idx_codices_parent_id ON codices(parent_id);
CREATE INDEX IF NOT EXISTS idx_codices_created_at ON codices(created_at);
CREATE INDEX IF NOT EXISTS idx_codices_updated_at ON codices(updated_at);
CREATE INDEX IF NOT EXISTS idx_codices_created_by ON codices(created_by);

CREATE INDEX IF NOT EXISTS idx_templates_codex_type ON templates(codex_type);
CREATE INDEX IF NOT EXISTS idx_templates_is_active ON templates(is_active);
CREATE INDEX IF NOT EXISTS idx_templates_created_at ON templates(created_at);

CREATE INDEX IF NOT EXISTS idx_references_source ON codex_references(source_codex_id);
CREATE INDEX IF NOT EXISTS idx_references_target ON codex_references(target_codex_id);
CREATE INDEX IF NOT EXISTS idx_references_type ON codex_references(reference_type);

CREATE INDEX IF NOT EXISTS idx_tags_codex_id ON codex_tags(codex_id);
CREATE INDEX IF NOT EXISTS idx_tags_name ON codex_tags(tag_name);
CREATE INDEX IF NOT EXISTS idx_tags_value ON codex_tags(tag_value);

-- +migrate down
-- Drop indexes first
DROP INDEX IF EXISTS idx_tags_value;
DROP INDEX IF EXISTS idx_tags_name;
DROP INDEX IF EXISTS idx_tags_codex_id;

DROP INDEX IF EXISTS idx_references_type;
DROP INDEX IF EXISTS idx_references_target;
DROP INDEX IF EXISTS idx_references_source;

DROP INDEX IF EXISTS idx_templates_created_at;
DROP INDEX IF EXISTS idx_templates_is_active;
DROP INDEX IF EXISTS idx_templates_codex_type;

DROP INDEX IF EXISTS idx_codices_created_by;
DROP INDEX IF EXISTS idx_codices_updated_at;
DROP INDEX IF EXISTS idx_codices_created_at;
DROP INDEX IF EXISTS idx_codices_parent_id;
DROP INDEX IF EXISTS idx_codices_project_id;
DROP INDEX IF EXISTS idx_codices_template_id;

-- Drop tables in reverse order
DROP TABLE IF EXISTS codex_tags;
DROP TABLE IF EXISTS codex_references;
DROP TABLE IF EXISTS templates;
DROP TABLE IF EXISTS codices;