# KuzuDB Graph Schema Design for Vespera Scriptorium

## Overview

This document defines the graph schema for KuzuDB integration in the Vespera V2 triple database architecture (SQLite + ChromaDB + KuzuDB). The schema supports hierarchical task management, complex relationships, and integration with document/knowledge systems.

## Node Types

### 1. Task Node
Primary entity representing individual tasks in the system.

```cypher
CREATE NODE TABLE Task(
    id STRING PRIMARY KEY,
    title STRING,
    description STRING,
    status STRING,  -- todo, doing, review, done, blocked, cancelled, archived
    priority STRING, -- critical, high, normal, low, someday
    task_order INT64,
    complexity STRING, -- trivial, simple, moderate, complex, very_complex
    estimated_effort STRING,
    actual_effort STRING,
    project_id STRING,
    feature STRING,
    milestone STRING,
    assignee STRING,
    creator STRING,
    created_at STRING,
    updated_at STRING,
    due_date STRING,
    started_at STRING,
    completed_at STRING,
    sync_status STRING, -- pending, syncing, synced, error, partial
    content_hash STRING
)
```

### 2. User Node
Represents users and agents in the system.

```cypher
CREATE NODE TABLE User(
    username STRING PRIMARY KEY,
    full_name STRING,
    email STRING,
    role STRING, -- user, admin, system, agent
    user_type STRING, -- human, ai_agent, automation
    created_at STRING,
    last_active STRING,
    preferences STRING -- JSON blob for user preferences
)
```

### 3. Project Node
Represents projects that group related tasks.

```cypher
CREATE NODE TABLE Project(
    id STRING PRIMARY KEY,
    name STRING,
    description STRING,
    status STRING, -- active, paused, completed, archived
    created_at STRING,
    updated_at STRING,
    owner STRING,
    visibility STRING -- public, private, team
)
```

### 4. Document Node
Represents documents, files, and knowledge artifacts.

```cypher
CREATE NODE TABLE Document(
    id STRING PRIMARY KEY,
    title STRING,
    content STRING,
    document_type STRING, -- markdown, pdf, code, image, url, note
    file_path STRING,
    content_hash STRING,
    size_bytes INT64,
    created_at STRING,
    updated_at STRING,
    created_by STRING,
    tags STRING -- JSON array of tags
)
```

### 5. Knowledge Node
Represents structured knowledge entities and concepts.

```cypher
CREATE NODE TABLE Knowledge(
    id STRING PRIMARY KEY,
    concept STRING,
    definition STRING,
    category STRING, -- technology, methodology, domain_knowledge, best_practice
    confidence_score DOUBLE, -- 0.0 to 1.0 confidence in the knowledge
    source_type STRING, -- research, experience, documentation, inference
    created_at STRING,
    updated_at STRING,
    validated_by STRING
)
```

### 6. Role Node
Represents execution roles for task assignment.

```cypher
CREATE NODE TABLE Role(
    name STRING PRIMARY KEY,
    description STRING,
    capabilities STRING, -- JSON array of capabilities
    restrictions STRING, -- JSON array of file pattern restrictions
    tool_groups STRING, -- JSON array of allowed tool groups
    created_at STRING,
    updated_at STRING
)
```

### 7. Execution Node
Represents individual task execution attempts.

```cypher
CREATE NODE TABLE Execution(
    id STRING PRIMARY KEY,
    task_id STRING,
    role_name STRING,
    status STRING, -- started, running, completed, failed, timeout
    output STRING,
    error_message STRING,
    started_at STRING,
    completed_at STRING,
    duration_ms INT64,
    retry_count INT64,
    execution_context STRING -- JSON blob
)
```

## Relationship Types

### 1. Hierarchical Relationships

#### PARENT_CHILD
Task hierarchy relationship.

```cypher
CREATE REL TABLE ParentChild(
    FROM Task TO Task,
    hierarchy_level INT64,
    created_at STRING
)
```

#### SUBTASK_OF
Alternative hierarchy representation.

```cypher
CREATE REL TABLE SubtaskOf(
    FROM Task TO Task,
    depth INT64,
    created_at STRING
)
```

### 2. Dependency Relationships

#### DEPENDS_ON
Task dependency relationship.

```cypher
CREATE REL TABLE DependsOn(
    FROM Task TO Task,
    dependency_type STRING, -- hard, soft, preference
    created_at STRING,
    resolved_at STRING
)
```

#### BLOCKS
Task blocking relationship.

```cypher
CREATE REL TABLE Blocks(
    FROM Task TO Task,
    blocking_reason STRING,
    created_at STRING,
    resolved_at STRING
)
```

### 3. Association Relationships

#### RELATES_TO
General task relationship.

```cypher
CREATE REL TABLE RelatesTo(
    FROM Task TO Task,
    relationship_type STRING, -- similar, complementary, alternative, reference
    strength DOUBLE, -- 0.0 to 1.0 relationship strength
    created_at STRING,
    created_by STRING
)
```

#### DUPLICATE_OF
Duplicate task relationship.

```cypher
CREATE REL TABLE DuplicateOf(
    FROM Task TO Task,
    confidence DOUBLE, -- 0.0 to 1.0 confidence it's a duplicate
    identified_at STRING,
    identified_by STRING
)
```

### 4. Assignment Relationships

#### ASSIGNED_TO
Task assignment to users.

```cypher
CREATE REL TABLE AssignedTo(
    FROM Task TO User,
    assigned_at STRING,
    assigned_by STRING,
    role_context STRING -- JSON blob with role-specific context
)
```

#### EXECUTED_BY
Task execution by roles.

```cypher
CREATE REL TABLE ExecutedBy(
    FROM Task TO Role,
    execution_id STRING,
    executed_at STRING,
    success BOOLEAN,
    output_summary STRING
)
```

### 5. Project Relationships

#### BELONGS_TO
Task-Project membership.

```cypher
CREATE REL TABLE BelongsTo(
    FROM Task TO Project,
    added_at STRING,
    added_by STRING,
    feature_tag STRING
)
```

#### OWNS
User-Project ownership.

```cypher
CREATE REL TABLE Owns(
    FROM User TO Project,
    ownership_type STRING, -- creator, maintainer, collaborator
    granted_at STRING,
    granted_by STRING
)
```

### 6. Knowledge Relationships

#### REFERENCES
Task-Document/Knowledge references.

```cypher
CREATE REL TABLE References(
    FROM Task TO Document,
    reference_type STRING, -- requirement, solution, example, inspiration
    relevance_score DOUBLE, -- 0.0 to 1.0 relevance
    created_at STRING,
    created_by STRING
)
```

```cypher
CREATE REL TABLE KnowledgeReference(
    FROM Task TO Knowledge,
    application_context STRING,
    relevance_score DOUBLE,
    created_at STRING,
    validated_by STRING
)
```

#### CREATES
Task-Document creation relationship.

```cypher
CREATE REL TABLE Creates(
    FROM Task TO Document,
    creation_type STRING, -- output, artifact, documentation, code
    created_at STRING,
    file_path STRING
)
```

#### LEARNS
Knowledge extraction from tasks.

```cypher
CREATE REL TABLE Learns(
    FROM Task TO Knowledge,
    learning_type STRING, -- discovery, validation, application, refinement
    confidence DOUBLE,
    learned_at STRING,
    context STRING
)
```

### 7. Semantic Relationships

#### SIMILAR_CONTENT
Content similarity between tasks (from vector analysis).

```cypher
CREATE REL TABLE SimilarContent(
    FROM Task TO Task,
    similarity_score DOUBLE, -- cosine similarity from vector database
    content_type STRING, -- title, description, full_content
    computed_at STRING,
    vector_model STRING -- embedding model used
)
```

#### SEMANTIC_CLUSTER
Task clustering based on semantic similarity.

```cypher
CREATE REL TABLE SemanticCluster(
    FROM Task TO Task,
    cluster_id STRING,
    cluster_method STRING, -- kmeans, hierarchical, dbscan
    distance DOUBLE,
    computed_at STRING
)
```

### 8. Temporal Relationships

#### SEQUENCE
Task sequence relationships.

```cypher
CREATE REL TABLE Sequence(
    FROM Task TO Task,
    sequence_type STRING, -- workflow, pipeline, dependency_chain
    order_index INT64,
    created_at STRING,
    workflow_id STRING
)
```

#### PRECEDES
Temporal precedence.

```cypher
CREATE REL TABLE Precedes(
    FROM Task TO Task,
    time_gap_hours DOUBLE,
    sequence_reason STRING,
    created_at STRING
)
```

## Schema Initialization Script

```python
# KuzuDB Schema Initialization
SCHEMA_COMMANDS = [
    # Node Tables
    "CREATE NODE TABLE Task(id STRING PRIMARY KEY, title STRING, description STRING, status STRING, priority STRING, task_order INT64, complexity STRING, estimated_effort STRING, actual_effort STRING, project_id STRING, feature STRING, milestone STRING, assignee STRING, creator STRING, created_at STRING, updated_at STRING, due_date STRING, started_at STRING, completed_at STRING, sync_status STRING, content_hash STRING)",
    
    "CREATE NODE TABLE User(username STRING PRIMARY KEY, full_name STRING, email STRING, role STRING, user_type STRING, created_at STRING, last_active STRING, preferences STRING)",
    
    "CREATE NODE TABLE Project(id STRING PRIMARY KEY, name STRING, description STRING, status STRING, created_at STRING, updated_at STRING, owner STRING, visibility STRING)",
    
    "CREATE NODE TABLE Document(id STRING PRIMARY KEY, title STRING, content STRING, document_type STRING, file_path STRING, content_hash STRING, size_bytes INT64, created_at STRING, updated_at STRING, created_by STRING, tags STRING)",
    
    "CREATE NODE TABLE Knowledge(id STRING PRIMARY KEY, concept STRING, definition STRING, category STRING, confidence_score DOUBLE, source_type STRING, created_at STRING, updated_at STRING, validated_by STRING)",
    
    "CREATE NODE TABLE Role(name STRING PRIMARY KEY, description STRING, capabilities STRING, restrictions STRING, tool_groups STRING, created_at STRING, updated_at STRING)",
    
    "CREATE NODE TABLE Execution(id STRING PRIMARY KEY, task_id STRING, role_name STRING, status STRING, output STRING, error_message STRING, started_at STRING, completed_at STRING, duration_ms INT64, retry_count INT64, execution_context STRING)",
    
    # Relationship Tables
    "CREATE REL TABLE ParentChild(FROM Task TO Task, hierarchy_level INT64, created_at STRING)",
    "CREATE REL TABLE SubtaskOf(FROM Task TO Task, depth INT64, created_at STRING)",
    "CREATE REL TABLE DependsOn(FROM Task TO Task, dependency_type STRING, created_at STRING, resolved_at STRING)",
    "CREATE REL TABLE Blocks(FROM Task TO Task, blocking_reason STRING, created_at STRING, resolved_at STRING)",
    "CREATE REL TABLE RelatesTo(FROM Task TO Task, relationship_type STRING, strength DOUBLE, created_at STRING, created_by STRING)",
    "CREATE REL TABLE DuplicateOf(FROM Task TO Task, confidence DOUBLE, identified_at STRING, identified_by STRING)",
    "CREATE REL TABLE AssignedTo(FROM Task TO User, assigned_at STRING, assigned_by STRING, role_context STRING)",
    "CREATE REL TABLE ExecutedBy(FROM Task TO Role, execution_id STRING, executed_at STRING, success BOOLEAN, output_summary STRING)",
    "CREATE REL TABLE BelongsTo(FROM Task TO Project, added_at STRING, added_by STRING, feature_tag STRING)",
    "CREATE REL TABLE Owns(FROM User TO Project, ownership_type STRING, granted_at STRING, granted_by STRING)",
    "CREATE REL TABLE References(FROM Task TO Document, reference_type STRING, relevance_score DOUBLE, created_at STRING, created_by STRING)",
    "CREATE REL TABLE KnowledgeReference(FROM Task TO Knowledge, application_context STRING, relevance_score DOUBLE, created_at STRING, validated_by STRING)",
    "CREATE REL TABLE Creates(FROM Task TO Document, creation_type STRING, created_at STRING, file_path STRING)",
    "CREATE REL TABLE Learns(FROM Task TO Knowledge, learning_type STRING, confidence DOUBLE, learned_at STRING, context STRING)",
    "CREATE REL TABLE SimilarContent(FROM Task TO Task, similarity_score DOUBLE, content_type STRING, computed_at STRING, vector_model STRING)",
    "CREATE REL TABLE SemanticCluster(FROM Task TO Task, cluster_id STRING, cluster_method STRING, distance DOUBLE, computed_at STRING)",
    "CREATE REL TABLE Sequence(FROM Task TO Task, sequence_type STRING, order_index INT64, created_at STRING, workflow_id STRING)",
    "CREATE REL TABLE Precedes(FROM Task TO Task, time_gap_hours DOUBLE, sequence_reason STRING, created_at STRING)"
]
```

## Usage Examples

### Query Examples

#### Find all tasks that depend on a specific task:
```cypher
MATCH (t:Task {id: 'task-123'})<-[:DependsOn]-(dependent:Task)
RETURN dependent.title, dependent.status, dependent.priority
```

#### Find task execution history:
```cypher
MATCH (t:Task {id: 'task-456'})-[:ExecutedBy]->(r:Role)
RETURN r.name, t.status, t.started_at, t.completed_at
```

#### Find semantically similar tasks:
```cypher
MATCH (t1:Task {id: 'task-789'})-[s:SimilarContent]->(t2:Task)
WHERE s.similarity_score > 0.8
RETURN t2.title, t2.description, s.similarity_score
ORDER BY s.similarity_score DESC
```

#### Find project task hierarchy:
```cypher
MATCH (p:Project {id: 'vespera-v2'})<-[:BelongsTo]-(root:Task)
WHERE NOT EXISTS((root)-[:SubtaskOf]->(:Task))
MATCH (root)-[:ParentChild*]->(subtask:Task)
RETURN root.title, subtask.title, subtask.hierarchy_level
ORDER BY subtask.hierarchy_level
```

## Integration Points

1. **SQLite Integration**: Task CRUD operations sync to graph
2. **ChromaDB Integration**: Vector similarity updates SimilarContent relationships
3. **Role System Integration**: ExecutedBy relationships track role-based execution
4. **Knowledge System**: Document and Knowledge nodes support RAG functionality

## Performance Considerations

1. **Indexing**: Primary keys automatically indexed
2. **Query Optimization**: Limit relationship depth in traversals
3. **Batch Operations**: Use batch inserts for large relationship updates
4. **Memory Management**: Consider async operations for large graph queries

## Future Extensions

1. **Temporal Queries**: Time-based relationship queries
2. **Graph Algorithms**: PageRank, community detection for task clustering
3. **ML Integration**: Graph embeddings for task recommendation
4. **Workflow Engine**: Sequence relationships for automated workflows