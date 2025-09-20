-- Automation and rule management system
-- Creates tables for the dynamic automation and event-driven architecture
-- Version: 3
-- Created: 2024-09-20 12:00:00 UTC

-- +migrate up
-- Automation rules table
CREATE TABLE IF NOT EXISTS automation_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL, -- 'tag_change', 'status_change', 'time_based', 'event', etc.
    trigger_conditions TEXT NOT NULL, -- JSON conditions for rule activation
    actions TEXT NOT NULL, -- JSON array of actions to execute
    target_codex_types TEXT, -- JSON array of codex types this rule applies to
    project_id TEXT, -- NULL for global rules
    is_active BOOLEAN NOT NULL DEFAULT 1,
    priority INTEGER NOT NULL DEFAULT 0, -- Higher priority rules run first
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    created_by TEXT,
    last_executed_at TEXT,
    execution_count INTEGER NOT NULL DEFAULT 0
);

-- Automation execution log table
CREATE TABLE IF NOT EXISTS automation_executions (
    id TEXT PRIMARY KEY,
    rule_id TEXT NOT NULL,
    codex_id TEXT NOT NULL, -- The codex that triggered the rule
    trigger_event TEXT NOT NULL, -- JSON description of the triggering event
    actions_executed TEXT NOT NULL, -- JSON array of actions that were executed
    execution_status TEXT NOT NULL DEFAULT 'success', -- 'success', 'failed', 'partial'
    execution_time_ms INTEGER,
    error_message TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE,
    FOREIGN KEY(codex_id) REFERENCES codices(id) ON DELETE CASCADE
);

-- Event queue table for async processing
CREATE TABLE IF NOT EXISTS event_queue (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    event_data TEXT NOT NULL, -- JSON event payload
    codex_id TEXT,
    scheduled_for TEXT NOT NULL, -- When to process this event
    priority INTEGER NOT NULL DEFAULT 0,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    error_message TEXT,
    created_at TEXT NOT NULL,
    processed_at TEXT,
    FOREIGN KEY(codex_id) REFERENCES codices(id) ON DELETE CASCADE
);

-- Hooks table for extensible processing
CREATE TABLE IF NOT EXISTS hooks (
    id TEXT PRIMARY KEY,
    hook_type TEXT NOT NULL, -- 'pre_create', 'post_update', 'pre_delete', etc.
    codex_type TEXT, -- NULL for global hooks
    handler_name TEXT NOT NULL,
    handler_config TEXT, -- JSON configuration for the handler
    is_active BOOLEAN NOT NULL DEFAULT 1,
    priority INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    created_by TEXT
);

-- Role assignments table for capability-based execution
CREATE TABLE IF NOT EXISTS role_assignments (
    id TEXT PRIMARY KEY,
    role_name TEXT NOT NULL,
    codex_id TEXT,
    user_id TEXT,
    capabilities TEXT NOT NULL, -- JSON array of capabilities
    file_patterns TEXT, -- JSON array of file patterns this role can access
    restrictions TEXT, -- JSON object with role restrictions
    assigned_at TEXT NOT NULL,
    assigned_by TEXT,
    expires_at TEXT,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    FOREIGN KEY(codex_id) REFERENCES codices(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger_type ON automation_rules(trigger_type);
CREATE INDEX IF NOT EXISTS idx_automation_rules_project_id ON automation_rules(project_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_is_active ON automation_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_automation_rules_priority ON automation_rules(priority);

CREATE INDEX IF NOT EXISTS idx_automation_executions_rule_id ON automation_executions(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_codex_id ON automation_executions(codex_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_status ON automation_executions(execution_status);
CREATE INDEX IF NOT EXISTS idx_automation_executions_created_at ON automation_executions(created_at);

CREATE INDEX IF NOT EXISTS idx_event_queue_status ON event_queue(status);
CREATE INDEX IF NOT EXISTS idx_event_queue_scheduled_for ON event_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_event_queue_priority ON event_queue(priority);
CREATE INDEX IF NOT EXISTS idx_event_queue_event_type ON event_queue(event_type);

CREATE INDEX IF NOT EXISTS idx_hooks_hook_type ON hooks(hook_type);
CREATE INDEX IF NOT EXISTS idx_hooks_codex_type ON hooks(codex_type);
CREATE INDEX IF NOT EXISTS idx_hooks_is_active ON hooks(is_active);
CREATE INDEX IF NOT EXISTS idx_hooks_priority ON hooks(priority);

CREATE INDEX IF NOT EXISTS idx_role_assignments_role_name ON role_assignments(role_name);
CREATE INDEX IF NOT EXISTS idx_role_assignments_codex_id ON role_assignments(codex_id);
CREATE INDEX IF NOT EXISTS idx_role_assignments_user_id ON role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_role_assignments_is_active ON role_assignments(is_active);

-- +migrate down
-- Drop indexes first
DROP INDEX IF EXISTS idx_role_assignments_is_active;
DROP INDEX IF EXISTS idx_role_assignments_user_id;
DROP INDEX IF EXISTS idx_role_assignments_codex_id;
DROP INDEX IF EXISTS idx_role_assignments_role_name;

DROP INDEX IF EXISTS idx_hooks_priority;
DROP INDEX IF EXISTS idx_hooks_is_active;
DROP INDEX IF EXISTS idx_hooks_codex_type;
DROP INDEX IF EXISTS idx_hooks_hook_type;

DROP INDEX IF EXISTS idx_event_queue_event_type;
DROP INDEX IF EXISTS idx_event_queue_priority;
DROP INDEX IF EXISTS idx_event_queue_scheduled_for;
DROP INDEX IF EXISTS idx_event_queue_status;

DROP INDEX IF EXISTS idx_automation_executions_created_at;
DROP INDEX IF EXISTS idx_automation_executions_status;
DROP INDEX IF EXISTS idx_automation_executions_codex_id;
DROP INDEX IF EXISTS idx_automation_executions_rule_id;

DROP INDEX IF EXISTS idx_automation_rules_priority;
DROP INDEX IF EXISTS idx_automation_rules_is_active;
DROP INDEX IF EXISTS idx_automation_rules_project_id;
DROP INDEX IF EXISTS idx_automation_rules_trigger_type;

-- Drop tables in reverse order
DROP TABLE IF EXISTS role_assignments;
DROP TABLE IF EXISTS hooks;
DROP TABLE IF EXISTS event_queue;
DROP TABLE IF EXISTS automation_executions;
DROP TABLE IF EXISTS automation_rules;