# Database Schemas & Relationship Diagrams

**Triple Database Integration - Detailed Schema Design**  
**Date**: August 18, 2025  
**Version**: 1.0

## Overview

This document provides detailed database schemas and relationship diagrams for the triple-database integration (SQLite + Chroma + KuzuDB) in Vespera V2. Each database serves a specialized purpose while maintaining coordinated references for unified intelligence.

## SQLite Schema (Enhanced)

### Primary Task Storage with Triple-DB Coordination

```sql
-- Enhanced Tasks Table (preserves all existing V2 fields)
CREATE TABLE tasks (
    -- Core Task Identity
    id TEXT PRIMARY KEY,                    -- UUID for task
    title TEXT NOT NULL,                    -- Task title
    description TEXT,                       -- Detailed description
    
    -- Task Hierarchy  
    parent_id TEXT,                         -- Parent task reference
    task_order INTEGER DEFAULT 0,          -- Order within siblings
    
    -- Status & Priority Management
    status TEXT NOT NULL DEFAULT 'todo',   -- TaskStatus enum
    priority TEXT NOT NULL DEFAULT 'normal', -- TaskPriority enum
    
    -- Temporal Tracking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_date TIMESTAMP,                     -- Optional deadline
    started_at TIMESTAMP,                   -- When work began
    completed_at TIMESTAMP,                 -- When work finished
    
    -- Project & Feature Association
    project_id TEXT,                        -- Project identifier
    feature TEXT,                           -- Feature area
    milestone TEXT,                         -- Milestone tracking
    
    -- User Management
    assignee TEXT DEFAULT 'User',           -- Assigned user
    creator TEXT DEFAULT 'System',          -- Task creator
    
    -- Metadata Storage (JSON)
    metadata_json TEXT,                     -- TaskMetadata serialized
    execution_json TEXT,                    -- TaskExecution serialized
    
    -- TRIPLE DATABASE INTEGRATION FIELDS
    -- Chroma Integration
    embedding_id TEXT,                      -- Reference to Chroma document
    content_hash TEXT,                      -- SHA256 of content for change detection
    last_embedded TIMESTAMP,                -- Last embedding generation time
    embedding_version INTEGER DEFAULT 1,    -- Embedding model version
    
    -- KuzuDB Integration  
    graph_node_id TEXT,                     -- Reference to KuzuDB node
    last_graph_sync TIMESTAMP,              -- Last graph synchronization
    graph_version INTEGER DEFAULT 1,        -- Graph schema version
    
    -- Synchronization Metadata
    last_indexed TIMESTAMP,                 -- Last full indexing across all DBs
    sync_status TEXT DEFAULT 'pending',     -- sync_pending, synced, error
    sync_error TEXT,                        -- Error message if sync failed
    
    FOREIGN KEY (parent_id) REFERENCES tasks (id) ON DELETE SET NULL
);

-- Enhanced Task Relationships Table
CREATE TABLE task_relationships (
    id TEXT PRIMARY KEY,
    source_task_id TEXT NOT NULL,          -- Source task
    target_task_id TEXT NOT NULL,          -- Target task  
    relationship_type TEXT NOT NULL,        -- DEPENDS_ON, BLOCKS, RELATES_TO, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT DEFAULT 'System',
    metadata TEXT,                          -- Additional relationship data (JSON)
    
    -- Triple DB Integration
    graph_edge_id TEXT,                     -- Reference to KuzuDB relationship
    last_graph_sync TIMESTAMP,              -- Last sync to graph DB
    
    FOREIGN KEY (source_task_id) REFERENCES tasks (id) ON DELETE CASCADE,
    FOREIGN KEY (target_task_id) REFERENCES tasks (id) ON DELETE CASCADE,
    UNIQUE(source_task_id, target_task_id, relationship_type)
);

-- Execution History Table (Enhanced)
CREATE TABLE task_execution_history (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    execution_id TEXT NOT NULL,            -- Unique execution identifier
    role_name TEXT,                         -- Executing role
    status TEXT NOT NULL,                   -- succeeded, failed, cancelled
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    output TEXT,                            -- Execution output
    error_message TEXT,                     -- Error details if failed
    metadata TEXT,                          -- Execution context (JSON)
    
    -- Performance Tracking
    duration_seconds REAL,                  -- Execution duration
    memory_usage_mb REAL,                   -- Peak memory usage
    
    FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
);

-- Database Synchronization Log
CREATE TABLE sync_log (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    database_name TEXT NOT NULL,           -- 'chroma' or 'kuzu'
    operation TEXT NOT NULL,               -- 'create', 'update', 'delete'
    status TEXT NOT NULL,                  -- 'success', 'failed', 'pending'
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
);
```

### Optimized Indexing Strategy

```sql
-- Existing V2 Indexes (Preserved)
CREATE INDEX idx_tasks_status ON tasks (status);
CREATE INDEX idx_tasks_priority ON tasks (priority);
CREATE INDEX idx_tasks_parent_id ON tasks (parent_id);
CREATE INDEX idx_tasks_project_created ON tasks (project_id, created_at);
CREATE INDEX idx_tasks_status_priority ON tasks (status, priority);
CREATE INDEX idx_tasks_assignee ON tasks (assignee);

-- New Triple-DB Coordination Indexes
CREATE INDEX idx_tasks_sync_status ON tasks (sync_status, last_indexed);
CREATE INDEX idx_tasks_content_hash ON tasks (content_hash, last_embedded);
CREATE INDEX idx_tasks_embedding_ref ON tasks (embedding_id) WHERE embedding_id IS NOT NULL;
CREATE INDEX idx_tasks_graph_ref ON tasks (graph_node_id) WHERE graph_node_id IS NOT NULL;
CREATE INDEX idx_tasks_embedding_version ON tasks (embedding_version, last_embedded);
CREATE INDEX idx_tasks_graph_version ON tasks (graph_version, last_graph_sync);

-- Relationship Indexes
CREATE INDEX idx_relationships_source ON task_relationships (source_task_id, relationship_type);
CREATE INDEX idx_relationships_target ON task_relationships (target_task_id, relationship_type);
CREATE INDEX idx_relationships_type ON task_relationships (relationship_type);
CREATE INDEX idx_relationships_graph_sync ON task_relationships (graph_edge_id, last_graph_sync);

-- Execution History Indexes
CREATE INDEX idx_execution_task_id ON task_execution_history (task_id, started_at);
CREATE INDEX idx_execution_role ON task_execution_history (role_name, status);
CREATE INDEX idx_execution_status ON task_execution_history (status, completed_at);

-- Sync Log Indexes
CREATE INDEX idx_sync_log_task_db ON sync_log (task_id, database_name);
CREATE INDEX idx_sync_log_status ON sync_log (status, timestamp);
```

## Chroma Schema Design

### Collection Architecture

```python
# Chroma Collections Configuration
CHROMA_COLLECTIONS = {
    "tasks_content": {
        "description": "Task descriptions and requirement embeddings",
        "embedding_function": "sentence-transformers/all-MiniLM-L6-v2",
        "distance_metric": "cosine",
        "hnsw_config": {
            "M": 16,                    # Graph connectivity
            "ef_construction": 200,      # Build quality
            "ef_search": 100,           # Search quality
            "max_elements": 100000      # Scale planning
        }
    },
    "code_references": {
        "description": "Code snippets and technical documentation embeddings",
        "embedding_function": "sentence-transformers/all-MiniLM-L6-v2",
        "distance_metric": "cosine"
    },
    "project_context": {
        "description": "Project-level semantic information and documentation",
        "embedding_function": "sentence-transformers/all-MiniLM-L6-v2",
        "distance_metric": "cosine"
    }
}
```

### Document Structure

#### tasks_content Collection
```python
{
    "ids": ["task_uuid_content"],           # Unique document identifier
    "documents": [
        # Combined content for embedding
        "{title}\n\n{description}\n\nRequirements:\n{requirements}\n\nContext:\n{context}"
    ],
    "metadatas": [{
        # Task Identity
        "task_id": "uuid-string",           # Reference to SQLite
        "title": "Task Title",
        "content_hash": "sha256-hash",      # Content change detection
        
        # Hierarchical Context
        "project_id": "project-identifier",
        "parent_task_id": "parent-uuid",
        "feature": "feature-name",
        
        # Status & Priority
        "status": "todo|doing|review|done|blocked|cancelled",
        "priority": "critical|high|normal|low|someday",
        
        # Temporal Information
        "created_at": "2025-08-18T10:00:00Z",
        "updated_at": "2025-08-18T10:00:00Z",
        "due_date": "2025-08-25T17:00:00Z",
        
        # Classification
        "complexity": "trivial|simple|moderate|complex|very_complex",
        "estimated_effort": "2 hours",
        "task_type": "feature|bugfix|research|documentation",
        
        # Tags & Labels  
        "tags": ["backend", "api", "authentication"],
        "labels": {
            "component": "user-management",
            "team": "backend-team"
        },
        
        # Role Information
        "assignee": "User",
        "assigned_role": "backend_developer",
        
        # Embedding Metadata
        "embedding_version": 1,
        "embedded_at": "2025-08-18T10:05:00Z",
        "embedding_model": "sentence-transformers/all-MiniLM-L6-v2"
    }]
}
```

#### code_references Collection
```python
{
    "ids": ["task_uuid_code_N"],           # N for multiple code refs per task
    "documents": [
        # Code content with context
        "File: {file_path}\nFunction: {function_name}\n\n{code_content}\n\nDocumentation:\n{docs}"
    ],
    "metadatas": [{
        "task_id": "uuid-string",
        "reference_type": "file|function|class|module",
        "file_path": "src/auth/user_service.py",
        "language": "python",
        "function_name": "authenticate_user",
        "class_name": "UserService", 
        "line_start": 45,
        "line_end": 78,
        "code_hash": "sha256-hash",
        "embedded_at": "2025-08-18T10:05:00Z"
    }]
}
```

#### project_context Collection
```python
{
    "ids": ["project_uuid_context"],
    "documents": [
        # Project documentation and context
        "{project_description}\n\nArchitecture:\n{architecture_notes}\n\nGoals:\n{project_goals}"
    ],
    "metadatas": [{
        "project_id": "project-identifier",
        "project_name": "User Authentication System",
        "project_status": "active|completed|archived",
        "team": "backend-team",
        "technology_stack": ["python", "fastapi", "postgresql"],
        "documentation_type": "overview|architecture|requirements",
        "embedded_at": "2025-08-18T10:05:00Z"
    }]
}
```

## KuzuDB Schema Design

### Node Types

```cypher
-- Task Node (Primary Entity)
CREATE NODE TABLE Task (
    id STRING,                              -- UUID from SQLite
    title STRING,                           -- Task title
    description STRING,                     -- Task description
    
    -- Status Information
    status STRING,                          -- Current status
    priority STRING,                        -- Task priority
    
    -- Temporal Data
    created_at TIMESTAMP,                   -- Creation time
    updated_at TIMESTAMP,                   -- Last modification
    due_date TIMESTAMP,                     -- Deadline (optional)
    started_at TIMESTAMP,                   -- Work start time
    completed_at TIMESTAMP,                -- Completion time
    
    -- Classification
    complexity STRING,                      -- Task complexity level
    estimated_effort STRING,               -- Time estimate
    actual_effort STRING,                  -- Actual time taken
    task_type STRING,                      -- feature|bugfix|research|etc.
    
    -- Project Association
    project_id STRING,                     -- Project identifier
    feature STRING,                        -- Feature area
    milestone STRING,                      -- Milestone tracking
    
    -- User Information
    assignee STRING,                       -- Assigned user
    creator STRING,                        -- Task creator
    
    -- Metadata
    tags STRING[],                         -- Tag array
    
    -- Synchronization
    sqlite_synced_at TIMESTAMP,            -- Last SQLite sync
    embedding_synced_at TIMESTAMP,         -- Last Chroma sync
    
    PRIMARY KEY (id)
);

-- Project Node
CREATE NODE TABLE Project (
    id STRING,                             -- Project identifier
    name STRING,                           -- Project name
    description STRING,                    -- Project description
    status STRING,                         -- active|completed|archived
    created_at TIMESTAMP,                  -- Creation time
    
    -- Project Metadata
    team STRING,                           -- Owning team
    technology_stack STRING[],             -- Technologies used
    repository_url STRING,                 -- Code repository
    
    PRIMARY KEY (id)
);

-- Role Node
CREATE NODE TABLE Role (
    name STRING,                           -- Role identifier
    display_name STRING,                   -- Human-readable name
    description STRING,                    -- Role description
    tool_groups STRING[],                  -- Available tool groups
    restrictions STRING[],                 -- Role restrictions
    preferred_llm STRING,                  -- Preferred LLM model
    
    PRIMARY KEY (name)
);

-- User Node
CREATE NODE TABLE User (
    id STRING,                             -- User identifier
    name STRING,                           -- Display name
    email STRING,                          -- Contact email
    preferred_roles STRING[],              -- Preferred roles
    active BOOLEAN,                        -- Account status
    
    PRIMARY KEY (id)
);

-- Artifact Node (Files, Documents, Resources)
CREATE NODE TABLE Artifact (
    id STRING,                             -- Artifact identifier
    path STRING,                           -- File path or URL
    type STRING,                           -- file|document|url|image
    name STRING,                           -- Display name
    content_hash STRING,                   -- Content fingerprint
    created_at TIMESTAMP,                  -- Creation time
    updated_at TIMESTAMP,                  -- Last modification
    
    PRIMARY KEY (id)
);

-- Milestone Node
CREATE NODE TABLE Milestone (
    id STRING,                             -- Milestone identifier
    name STRING,                           -- Milestone name
    description STRING,                    -- Description
    due_date TIMESTAMP,                    -- Target completion
    status STRING,                         -- planned|active|completed
    
    PRIMARY KEY (id)
);
```

### Relationship Types

```cypher
-- Task Hierarchy Relationships
CREATE REL TABLE HAS_SUBTASK (
    FROM Task TO Task,
    order INT64,                           -- Subtask ordering
    created_at TIMESTAMP DEFAULT current_timestamp()
);

CREATE REL TABLE PARENT_OF (
    FROM Task TO Task,
    depth INT64,                           -- Hierarchy depth
    path STRING                            -- Full hierarchy path
);

-- Dependency Relationships
CREATE REL TABLE DEPENDS_ON (
    FROM Task TO Task,
    dependency_type STRING,                -- hard|soft|informational
    created_at TIMESTAMP DEFAULT current_timestamp(),
    created_by STRING,                     -- Who created the dependency
    description STRING                     -- Why this dependency exists
);

CREATE REL TABLE BLOCKS (
    FROM Task TO Task,
    blocking_type STRING,                  -- technical|resource|approval
    created_at TIMESTAMP DEFAULT current_timestamp(),
    priority STRING,                       -- critical|high|normal|low
    estimated_blocking_time STRING         -- How long the block lasts
);

-- Assignment Relationships
CREATE REL TABLE ASSIGNED_TO (
    FROM Task TO Role,
    assigned_at TIMESTAMP DEFAULT current_timestamp(),
    assigned_by STRING,                    -- Who made the assignment
    assignment_type STRING                 -- primary|secondary|collaborative
);

CREATE REL TABLE WORKED_ON_BY (
    FROM Task TO User,
    work_started TIMESTAMP,
    work_ended TIMESTAMP,
    hours_worked DOUBLE,
    work_type STRING                       -- development|testing|review
);

-- Project Relationships
CREATE REL TABLE BELONGS_TO (
    FROM Task TO Project,
    added_at TIMESTAMP DEFAULT current_timestamp()
);

CREATE REL TABLE PROJECT_MILESTONE (
    FROM Project TO Milestone,
    milestone_order INT64
);

CREATE REL TABLE MILESTONE_TASK (
    FROM Milestone TO Task,
    task_priority STRING
);

-- Reference Relationships
CREATE REL TABLE REFERENCES (
    FROM Task TO Artifact,
    reference_type STRING,                 -- code|documentation|design|test
    created_at TIMESTAMP DEFAULT current_timestamp(),
    description STRING                     -- How this artifact relates
);

CREATE REL TABLE RELATES_TO (
    FROM Task TO Task,
    relation_type STRING,                  -- similar|alternative|duplicate
    strength DOUBLE,                       -- Relationship strength 0-1
    created_at TIMESTAMP DEFAULT current_timestamp(),
    description STRING
);

-- Execution Relationships  
CREATE REL TABLE EXECUTED_BY (
    FROM Task TO Role,
    execution_id STRING,                   -- Reference to execution record
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    status STRING,                         -- succeeded|failed|cancelled
    retry_count INT64
);
```

### Graph Indexes for Performance

```cypher
-- Primary lookup indexes
CREATE INDEX ON Task (status);
CREATE INDEX ON Task (priority);
CREATE INDEX ON Task (project_id);
CREATE INDEX ON Task (assignee);
CREATE INDEX ON Task (created_at);
CREATE INDEX ON Task (due_date);

-- Relationship indexes
CREATE INDEX ON DEPENDS_ON (dependency_type);
CREATE INDEX ON HAS_SUBTASK (order);
CREATE INDEX ON ASSIGNED_TO (assigned_at);
CREATE INDEX ON BELONGS_TO ();

-- Composite indexes for common queries
CREATE INDEX ON Task (status, priority);
CREATE INDEX ON Task (project_id, status);
```

## Cross-Database Reference Architecture

### Reference Mapping Strategy

```
SQLite (Master)     Chroma (Semantic)    KuzuDB (Graph)
┌─────────────┐    ┌─────────────────┐   ┌─────────────────┐
│ tasks.id    │◄──►│ metadata.task_id │◄─►│ Task.id         │
│             │    │                 │   │                 │
│ embedding_id│───►│ document.id     │   │                 │
│ graph_node_id│───┼─────────────────┼──►│ Task.id         │
│ content_hash│───►│ metadata.       │   │                 │
│             │    │  content_hash   │   │                 │
└─────────────┘    └─────────────────┘   └─────────────────┘
```

### Synchronization State Machine

```
Task Update Workflow:
┌─────────────┐
│   Created   │
└─────┬───────┘
      ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   SQLite    │────►│   Embed     │────►│   Graph     │
│   Updated   │     │  Generated  │     │   Synced    │
└─────────────┘     └─────────────┘     └─────────────┘
      │                     │                     │
      ▼                     ▼                     ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ sync_status │     │ sync_status │     │ sync_status │
│ = pending   │     │ = embedding │     │ = synced    │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Query Pattern Examples

### SQLite Queries (Enhanced)

```sql
-- Find tasks ready for embedding sync
SELECT t.id, t.title, t.description, t.content_hash
FROM tasks t 
WHERE t.sync_status = 'pending' 
   OR (t.content_hash IS NOT NULL 
       AND t.last_embedded < t.updated_at)
ORDER BY t.updated_at DESC
LIMIT 50;

-- Get synchronization health report
SELECT 
    sync_status,
    COUNT(*) as task_count,
    AVG(julianday('now') - julianday(last_indexed)) * 24 as avg_hours_since_sync
FROM tasks 
GROUP BY sync_status;

-- Find tasks with sync errors
SELECT t.id, t.title, t.sync_error, s.error_message, s.retry_count
FROM tasks t
LEFT JOIN sync_log s ON t.id = s.task_id
WHERE t.sync_status = 'error'
ORDER BY s.timestamp DESC;
```

### Chroma Query Patterns

```python
# Semantic similarity search with metadata filtering
results = collection.query(
    query_texts=["user authentication and security"],
    n_results=10,
    where={
        "$and": [
            {"project_id": {"$eq": "auth-service"}},
            {"status": {"$in": ["todo", "doing"]}},
            {"priority": {"$in": ["high", "critical"]}}
        ]
    },
    include=["documents", "metadatas", "distances"]
)

# Multi-collection semantic search
auth_tasks = tasks_content.query(
    query_texts=["authentication implementation"],
    where={"project_id": {"$eq": "auth-service"}},
    n_results=5
)

code_refs = code_references.query(
    query_texts=["authentication implementation"],
    where={"task_id": {"$in": [task["task_id"] for task in auth_tasks]}},
    n_results=10
)
```

### KuzuDB Query Patterns

```cypher
-- Find all dependencies for a task (recursive)
MATCH path = (t:Task {id: $task_id})-[:DEPENDS_ON*1..5]->(dep:Task)
RETURN 
    t.title as root_task,
    dep.title as dependency,
    length(path) as depth,
    dep.status as dep_status,
    dep.priority as dep_priority
ORDER BY depth, dep.priority;

-- Identify circular dependencies
MATCH (t1:Task)-[:DEPENDS_ON*1..10]->(t2:Task)-[:DEPENDS_ON*1..10]->(t1)
RETURN DISTINCT 
    t1.id as task1_id,
    t1.title as task1_title, 
    t2.id as task2_id,
    t2.title as task2_title;

-- Project task hierarchy with status rollup
MATCH (p:Project)-[:BELONGS_TO]-(root:Task)
WHERE NOT EXISTS { (parent:Task)-[:HAS_SUBTASK]->(root) }
OPTIONAL MATCH (root)-[:HAS_SUBTASK*1..3]->(subtask:Task)
RETURN 
    p.name as project_name,
    root.title as root_task,
    collect(DISTINCT subtask.status) as subtask_statuses,
    count(subtask) as subtask_count;

-- Find blocking bottlenecks
MATCH (blocker:Task)-[b:BLOCKS]->(blocked:Task)
WHERE blocker.status IN ['todo', 'doing']
  AND blocked.status = 'blocked'
RETURN 
    blocker.title as blocking_task,
    blocker.assignee as blocking_assignee,
    count(blocked) as tasks_blocked,
    collect(blocked.title) as blocked_tasks
ORDER BY tasks_blocked DESC;

-- Task assignment workload analysis
MATCH (r:Role)<-[a:ASSIGNED_TO]-(t:Task)
WHERE t.status IN ['todo', 'doing']
RETURN 
    r.name as role_name,
    r.display_name as role_display,
    count(t) as active_tasks,
    collect(DISTINCT t.priority) as task_priorities,
    avg(CASE t.priority 
        WHEN 'critical' THEN 5
        WHEN 'high' THEN 4  
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 2
        WHEN 'someday' THEN 1
        ELSE 3 END) as avg_priority_score
ORDER BY avg_priority_score DESC;
```

## Data Consistency & Validation

### Consistency Checking Queries

```sql
-- SQLite: Find orphaned references
-- Tasks referencing non-existent embeddings
SELECT t.id, t.title, t.embedding_id
FROM tasks t
WHERE t.embedding_id IS NOT NULL
  AND t.embedding_id NOT IN (
    SELECT DISTINCT embedding_id 
    FROM sync_log 
    WHERE database_name = 'chroma' 
      AND status = 'success'
  );

-- Tasks referencing non-existent graph nodes
SELECT t.id, t.title, t.graph_node_id  
FROM tasks t
WHERE t.graph_node_id IS NOT NULL
  AND t.graph_node_id NOT IN (
    SELECT DISTINCT task_id
    FROM sync_log
    WHERE database_name = 'kuzu'
      AND status = 'success'
  );
```

```python
# Chroma: Find documents without SQLite references
def find_orphaned_embeddings():
    all_collections = client.list_collections()
    orphaned_docs = []
    
    for collection in all_collections:
        docs = collection.get()
        for i, metadata in enumerate(docs['metadatas']):
            task_id = metadata.get('task_id')
            if task_id and not sqlite_service.task_exists(task_id):
                orphaned_docs.append({
                    'collection': collection.name,
                    'doc_id': docs['ids'][i],
                    'task_id': task_id
                })
    
    return orphaned_docs
```

```cypher
-- KuzuDB: Find nodes without SQLite references
MATCH (t:Task)
WHERE NOT EXISTS {
    // This would be implemented with a user-defined function
    // to check SQLite existence
    CALL custom.sqlite_task_exists(t.id)
}
RETURN t.id, t.title, 'orphaned_graph_node' as issue;
```

### Automated Consistency Repair

```python
class ConsistencyManager:
    async def repair_database_consistency(self) -> RepairReport:
        """Comprehensive consistency repair across all databases."""
        
        repair_report = RepairReport()
        
        # 1. Remove orphaned Chroma documents
        orphaned_embeddings = await self.find_orphaned_embeddings()
        for doc in orphaned_embeddings:
            await self.remove_chroma_document(doc)
        repair_report.orphaned_embeddings_removed = len(orphaned_embeddings)
        
        # 2. Remove orphaned KuzuDB nodes
        orphaned_nodes = await self.find_orphaned_graph_nodes() 
        for node in orphaned_nodes:
            await self.remove_kuzu_node(node)
        repair_report.orphaned_nodes_removed = len(orphaned_nodes)
        
        # 3. Rebuild missing embeddings
        missing_embeddings = await self.find_missing_embeddings()
        for task in missing_embeddings:
            await self.generate_task_embedding(task)
        repair_report.missing_embeddings_created = len(missing_embeddings)
        
        # 4. Rebuild missing graph relationships
        missing_relationships = await self.find_missing_graph_relationships()
        for rel in missing_relationships:
            await self.create_graph_relationship(rel)
        repair_report.missing_relationships_created = len(missing_relationships)
        
        return repair_report
```

## Backup & Recovery Strategy

### Coordinated Backup Process

```python
class TripleDBBackupManager:
    async def create_coordinated_backup(self, backup_name: str) -> BackupManifest:
        """Create consistent backup across all three databases."""
        
        timestamp = datetime.now().isoformat()
        backup_dir = self.backup_path / f"{backup_name}_{timestamp}"
        backup_dir.mkdir(parents=True, exist_ok=True)
        
        # 1. Create consistent snapshot point
        checkpoint_time = datetime.now()
        await self.create_checkpoint_marker(checkpoint_time)
        
        # 2. Backup SQLite (with transaction consistency)
        sqlite_backup = backup_dir / "tasks.db"
        await self.backup_sqlite_database(sqlite_backup, checkpoint_time)
        
        # 3. Backup Chroma collections
        chroma_backup = backup_dir / "embeddings"
        await self.backup_chroma_collections(chroma_backup, checkpoint_time)
        
        # 4. Backup KuzuDB graph
        kuzu_backup = backup_dir / "knowledge_graph"
        await self.backup_kuzu_database(kuzu_backup, checkpoint_time)
        
        # 5. Create backup manifest
        manifest = BackupManifest(
            name=backup_name,
            timestamp=timestamp,
            checkpoint_time=checkpoint_time,
            sqlite_file=str(sqlite_backup),
            chroma_directory=str(chroma_backup),
            kuzu_directory=str(kuzu_backup),
            consistency_verified=await self.verify_backup_consistency(backup_dir)
        )
        
        await self.save_backup_manifest(backup_dir / "manifest.json", manifest)
        return manifest
```

This comprehensive schema design provides the foundation for implementing the triple-database integration while maintaining data consistency, performance, and reliability across all three systems. The schemas are designed to work together seamlessly while allowing each database to excel at its specialized function.