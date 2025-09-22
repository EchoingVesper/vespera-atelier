# Triple Database Integration - System Architecture

**Phase 2: Architecture & Design**  
**Date**: August 18, 2025  
**Objective**: Define comprehensive system architecture for SQLite + Chroma + KuzuDB integration in Vespera V2

## Executive Summary

This document defines the system architecture for integrating three embedded databases (SQLite, Chroma, KuzuDB) into the existing Vespera V2 task orchestration system. The architecture maintains FastMCP performance characteristics while adding semantic search and knowledge graph capabilities to the hierarchical task management system.

**Key Architectural Principles:**
- 🏗️ **Modular Integration**: Build on existing V2 foundation without disruption
- ⚡ **Performance First**: Maintain FastMCP responsiveness with async coordination
- 🔒 **Role-Aware Security**: Extend existing tool group system for database-specific permissions
- 🔄 **Graceful Degradation**: System functions with any subset of databases available

## Current V2 Architecture Foundation

### Component Overview

```
Vespera V2 Current Architecture
┌─────────────────────────────────────────────────────────────┐
│                    FastMCP Server                           │
│                 (mcp_server_v2.py)                         │
├─────────────────────────────────────────────────────────────┤
│     Task Manager           │         Role Manager           │
│   (tasks/manager.py)       │      (roles/manager.py)       │
├─────────────────────────────────────────────────────────────┤
│           Task Service            │    Role Definitions      │
│        (tasks/service.py)         │  (roles/definitions.py)  │
├─────────────────────────────────────────────────────────────┤
│               SQLite Database (.vespera_v2/tasks.db)        │
│          Tasks │ Task_Relationships │ Execution History      │
└─────────────────────────────────────────────────────────────┘
```

### Strengths to Leverage

1. **Task Models** (`tasks/models.py`):
   - Comprehensive `Task` class with hierarchical relationships
   - Rich `TaskMetadata` for semantic content
   - `TaskExecution` tracking for performance analysis
   - Proper serialization for cross-database coordination

2. **Service Layer** (`tasks/service.py`):
   - Async/await database operations
   - Transaction support with error handling
   - Comprehensive indexing strategy
   - Clean separation from business logic

3. **Role System** (`roles/definitions.py`):
   - `ToolGroup` enum for capability management
   - File pattern restrictions via regex
   - Hierarchical role inheritance
   - Runtime validation system

4. **MCP Integration** (`mcp_server_v2.py`):
   - FastMCP with 14 comprehensive tools
   - Proper resource lifecycle management
   - Structured Pydantic input validation
   - Async context managers for cleanup

## Triple Database Integration Architecture

### High-Level System Design

```
Enhanced Vespera V2 with Triple Database Integration
┌─────────────────────────────────────────────────────────────┐
│                    FastMCP Server                           │
│              (Enhanced mcp_server_v2.py)                   │
├─────────────────────────────────────────────────────────────┤
│       Task Manager (Enhanced)     │    Role Manager +       │
│      Enhanced with semantic       │   Database Permissions  │
│        and graph queries          │                         │
├─────────────────────────────────────────────────────────────┤
│                Triple Database Service Layer                │
│                 (New Integration Component)                 │
├─────────────────────────────────────────────────────────────┤
│    SQLite DB    │   Chroma DB     │     KuzuDB             │
│   (Task Data)   │  (Embeddings)   │  (Knowledge Graph)     │
│                 │                 │                        │
│ • Task records  │ • Task content  │ • Task relationships   │
│ • Relationships │ • Search index  │ • Project hierarchy    │
│ • Execution log │ • Metadata      │ • Dependency graph     │
│ • Status/Priority│ • Semantic      │ • Role assignments     │
│                 │   similarity    │ • Artifact references  │
└─────────────────────────────────────────────────────────────┘
```

### Database Specialization Strategy

#### 1. SQLite - Primary Data Store & ACID Compliance
**Responsibility**: Core task data, relationships, and execution state
- **Current Schema**: Preserved and extended
- **New Fields**: 
  - `embedding_id` for Chroma references
  - `graph_node_id` for KuzuDB coordination
  - `last_indexed` timestamp for sync tracking

```sql
-- Enhanced Task Table
CREATE TABLE tasks (
    -- Existing fields preserved
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL,
    priority TEXT NOT NULL,
    parent_id TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    
    -- New triple-database integration fields
    embedding_id TEXT,           -- Reference to Chroma collection
    graph_node_id TEXT,          -- Reference to KuzuDB node
    last_indexed TIMESTAMP,      -- Last sync to other databases
    content_hash TEXT,           -- Content change detection
    semantic_version INTEGER DEFAULT 1,  -- Embedding versioning
    
    FOREIGN KEY (parent_id) REFERENCES tasks (id)
);

-- Enhanced indexing for cross-database operations
CREATE INDEX idx_tasks_embedding_sync ON tasks (last_indexed, content_hash);
CREATE INDEX idx_tasks_graph_sync ON tasks (graph_node_id, updated_at);
```

#### 2. Chroma - Vector Embeddings & Semantic Search
**Responsibility**: Task content embeddings and semantic similarity search
- **Collections Strategy**: 
  - `tasks_content` - Task descriptions and documentation
  - `code_references` - Code snippets and technical content
  - `project_context` - Project-level semantic information

```python
# Chroma Collection Schema
collections = {
    "tasks_content": {
        "documents": ["task_description", "task_details", "requirements"],
        "metadatas": [
            {
                "task_id": "uuid",
                "project_id": "string", 
                "status": "string",
                "priority": "string",
                "created_at": "timestamp",
                "updated_at": "timestamp",
                "tags": ["list", "of", "tags"],
                "complexity": "string"
            }
        ],
        "ids": ["task_uuid_content"]
    },
    "code_references": {
        "documents": ["code_content", "file_paths", "function_names"],
        "metadatas": [
            {
                "task_id": "uuid",
                "file_path": "string",
                "language": "string", 
                "function_name": "string"
            }
        ],
        "ids": ["task_uuid_code_ref"]
    }
}
```

#### 3. KuzuDB - Knowledge Graph & Complex Relationships
**Responsibility**: Complex task relationships, project hierarchies, and dependency graphs
- **Node Types**: `Task`, `Project`, `Role`, `Artifact`, `User`
- **Relationship Types**: `DEPENDS_ON`, `HAS_SUBTASK`, `ASSIGNED_TO`, `REFERENCES`, `BLOCKS`

```cypher
-- KuzuDB Schema Definition
CREATE NODE TABLE Task (
    id STRING,
    title STRING,
    status STRING,
    priority STRING,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    complexity STRING,
    estimated_effort STRING,
    PRIMARY KEY (id)
);

CREATE NODE TABLE Project (
    id STRING,
    name STRING,
    description STRING,
    status STRING,
    PRIMARY KEY (id)
);

CREATE NODE TABLE Role (
    name STRING,
    display_name STRING,
    tool_groups STRING[],
    PRIMARY KEY (name)
);

-- Relationship definitions
CREATE REL TABLE DEPENDS_ON (FROM Task TO Task, dependency_type STRING);
CREATE REL TABLE HAS_SUBTASK (FROM Task TO Task, order INT);
CREATE REL TABLE ASSIGNED_TO (FROM Task TO Role, assigned_at TIMESTAMP);
CREATE REL TABLE BELONGS_TO (FROM Task TO Project);
CREATE REL TABLE REFERENCES (FROM Task TO Task, reference_type STRING);
```

## Data Flow & Synchronization Architecture

### Async Coordination Pattern

```python
@dataclass
class TripleDBContext:
    """Resource context for all three databases."""
    sqlite_service: TaskService
    chroma_client: chromadb.Client
    kuzu_db: kuzu.Database
    sync_coordinator: DatabaseSyncCoordinator

@asynccontextmanager
async def triple_db_lifespan(server: FastMCP) -> AsyncIterator[TripleDBContext]:
    """Manage lifecycle of all three databases."""
    db_path = Path.cwd() / ".vespera_v2"
    
    # Initialize databases
    sqlite_service = await init_sqlite_service(db_path / "tasks.db")
    chroma_client = await init_chroma_client(db_path / "embeddings")
    kuzu_db = await init_kuzu_db(db_path / "knowledge_graph")
    
    sync_coordinator = DatabaseSyncCoordinator(sqlite_service, chroma_client, kuzu_db)
    
    try:
        yield TripleDBContext(sqlite_service, chroma_client, kuzu_db, sync_coordinator)
    finally:
        await cleanup_all_databases(sqlite_service, chroma_client, kuzu_db)
```

### Data Synchronization Strategy

#### 1. Write Operations (SQLite → Chroma/KuzuDB)
```
Task Creation/Update Flow:
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   SQLite    │    │   Chroma    │    │   KuzuDB    │
│   (Master)  │    │ (Semantic)  │    │  (Graph)    │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
1. Write to SQLite ────► 2. Extract content ──► 3. Update relationships
2. Generate embedding      Add to collection      Sync node properties
3. Update sync metadata    Update metadata        Update edges
```

#### 2. Read Operations (Unified Query Interface)
```python
class UnifiedQueryInterface:
    """Unified interface for querying across all three databases."""
    
    async def search_tasks(
        self,
        query: str,
        query_type: QueryType = QueryType.HYBRID,
        filters: Dict[str, Any] = None,
        limit: int = 10
    ) -> List[TaskSearchResult]:
        """Execute unified search across databases."""
        
        if query_type == QueryType.SEMANTIC:
            # Chroma vector similarity search
            results = await self._chroma_search(query, filters, limit)
        elif query_type == QueryType.GRAPH:
            # KuzuDB relationship queries  
            results = await self._kuzu_search(query, filters, limit)
        elif query_type == QueryType.STRUCTURED:
            # SQLite traditional search
            results = await self._sqlite_search(query, filters, limit)
        else:  # HYBRID
            # Combine all three approaches
            results = await self._hybrid_search(query, filters, limit)
        
        return results
```

## Enhanced MCP Tool Architecture

### New Tool Categories

#### 1. Semantic Search Tools
```python
@mcp.tool()
async def semantic_search_tasks(
    query: str,
    project_filter: Optional[str] = None,
    status_filter: Optional[str] = None,
    limit: int = 10
) -> Dict[str, Any]:
    """Search tasks using semantic similarity."""
    
@mcp.tool()  
async def find_similar_tasks(
    task_id: str,
    similarity_threshold: float = 0.7,
    limit: int = 5
) -> Dict[str, Any]:
    """Find tasks similar to a given task."""

@mcp.tool()
async def semantic_task_clustering(
    project_id: Optional[str] = None
) -> Dict[str, Any]:
    """Group related tasks using semantic clustering."""
```

#### 2. Graph Query Tools  
```python
@mcp.tool()
async def analyze_task_dependencies_graph(
    task_id: str,
    max_depth: int = 3
) -> Dict[str, Any]:
    """Analyze deep dependency chains using graph traversal."""

@mcp.tool()
async def find_dependency_cycles(
    project_id: Optional[str] = None
) -> Dict[str, Any]:
    """Detect circular dependencies in task graphs."""

@mcp.tool()
async def get_task_impact_analysis(
    task_id: str,
    impact_type: str = "blocking"
) -> Dict[str, Any]:
    """Analyze the impact of task changes on related tasks."""
```

#### 3. Hybrid Intelligence Tools
```python
@mcp.tool()
async def intelligent_task_recommendation(
    user_context: str,
    current_task_id: Optional[str] = None
) -> Dict[str, Any]:
    """Recommend next tasks using hybrid semantic + graph analysis."""

@mcp.tool()
async def project_health_analysis(
    project_id: str
) -> Dict[str, Any]:
    """Comprehensive project analysis using all three databases."""
```

### Tool Integration Matrix

| Tool | SQLite | Chroma | KuzuDB | Description |
|------|--------|---------|---------|-------------|
| `create_task` | ✅ Primary | ✅ Embed | ✅ Node | Enhanced with auto-embedding |
| `semantic_search_tasks` | 🔍 Filter | ✅ Primary | 🔍 Validate | Vector similarity search |
| `analyze_task_dependencies_graph` | 🔍 Metadata | ❌ | ✅ Primary | Deep relationship analysis |
| `intelligent_task_recommendation` | 🔍 Context | ✅ Similarity | ✅ Relations | Multi-DB intelligence |
| `get_task_dashboard` | ✅ Primary | 📊 Insights | 📊 Metrics | Enhanced with semantic metrics |

## Role System Extensions

### New Tool Groups for Database Operations

```python
class ToolGroup(Enum):
    # Existing tool groups
    READ = "read"
    EDIT = "edit" 
    COMMAND = "command"
    BROWSER = "browser"
    MCP = "mcp"
    COORDINATION = "coordination"
    
    # New database-specific tool groups
    SEMANTIC_SEARCH = "semantic_search"      # Chroma vector operations
    GRAPH_QUERY = "graph_query"             # KuzuDB relationship queries
    DATABASE_ADMIN = "database_admin"        # Schema management
    DATA_ANALYTICS = "data_analytics"        # Cross-database analytics
```

### Enhanced Role Definitions

```yaml
# roles/templates/enhanced_roles.yaml - New roles

data_architect:
  display_name: "Data Architect"
  description: "Database schema design and optimization specialist"
  system_prompt: |
    You are a database architect specializing in multi-database coordination.
    Design schemas and optimize queries across SQLite, Chroma, and KuzuDB.
  preferred_llm: "anthropic:claude-3-sonnet"
  tool_groups:
    - ["read", {"file_regex": ".*\\.sql$|.*\\.cypher$|.*schema.*"}]
    - "database_admin"
    - "data_analytics"
  restrictions:
    - "max_schema_changes: 3"
    - "require_approval: true"
  task_types:
    - "database_design"
    - "schema_migration" 
    - "performance_optimization"

semantic_researcher:
  display_name: "Semantic Research Specialist" 
  description: "Advanced task research using semantic similarity"
  system_prompt: |
    You specialize in semantic task analysis and intelligent recommendations.
    Use vector embeddings to find patterns and connections in task data.
  preferred_llm: "anthropic:claude-3-sonnet"
  tool_groups:
    - "read"
    - "semantic_search"
    - "data_analytics"
  restrictions:
    - "max_search_results: 50"
    - "time_limit_minutes: 15"
  task_types:
    - "task_research"
    - "pattern_analysis"
    - "recommendation_generation"

graph_analyst:
  display_name: "Knowledge Graph Analyst"
  description: "Complex relationship analysis using graph queries"
  system_prompt: |
    You analyze complex task relationships and dependencies using graph theory.
    Identify bottlenecks, cycles, and optimization opportunities.
  preferred_llm: "anthropic:claude-3-sonnet"
  tool_groups:
    - "read" 
    - "graph_query"
    - "data_analytics"
  restrictions:
    - "max_graph_depth: 10"
    - "max_relationship_queries: 20"
  task_types:
    - "dependency_analysis"
    - "bottleneck_identification"
    - "project_optimization"
```

### Permission Matrix by Role

| Role | SQLite | Chroma | KuzuDB | Capabilities |
|------|--------|---------|---------|--------------|
| **basic_helper** | Read | ❌ | ❌ | Standard task operations |
| **semantic_researcher** | Read | Read/Search | Read | Advanced task research |
| **graph_analyst** | Read | Read | Read/Query | Dependency analysis |
| **data_architect** | Admin | Admin | Admin | Schema design & migration |
| **coordination_specialist** | Read/Write | Read/Search | Read/Query | Full task orchestration |

## Performance & Resource Management

### Memory Management Strategy

```python
class PerformanceOptimizer:
    """Manage performance across three database systems."""
    
    def __init__(self):
        self.sqlite_pool_size = 10
        self.chroma_cache_size = "500MB"
        self.kuzu_buffer_pool_size = "1GB"
        self.embedding_batch_size = 32
        
    async def optimize_memory_usage(self):
        """Dynamic memory optimization based on workload."""
        # Monitor database memory usage
        # Adjust cache sizes and connection pools
        # Batch operations for efficiency
```

### Query Performance Optimization

#### 1. SQLite Optimizations (Preserved & Enhanced)
```sql
-- Existing optimizations maintained
CREATE INDEX idx_tasks_status_priority ON tasks (status, priority);
CREATE INDEX idx_tasks_parent_id ON tasks (parent_id);
CREATE INDEX idx_tasks_project_created ON tasks (project_id, created_at);

-- New indexes for triple-database coordination
CREATE INDEX idx_tasks_sync_status ON tasks (last_indexed, content_hash);
CREATE INDEX idx_tasks_embedding_ref ON tasks (embedding_id) WHERE embedding_id IS NOT NULL;
CREATE INDEX idx_tasks_graph_ref ON tasks (graph_node_id) WHERE graph_node_id IS NOT NULL;
```

#### 2. Chroma Performance Tuning
```python
# Collection configuration for optimal performance
chroma_config = {
    "hnsw:space": "cosine",           # Optimized similarity metric
    "hnsw:construction_ef": 200,      # Build quality vs speed
    "hnsw:search_ef": 100,            # Search quality vs speed  
    "hnsw:M": 16,                     # Graph connectivity
    "persist_directory": db_path / "embeddings",
    "anonymized_telemetry": False
}
```

#### 3. KuzuDB Optimization
```cypher
-- Optimized index creation for common queries
CREATE INDEX ON Task (status);
CREATE INDEX ON Task (priority); 
CREATE INDEX ON Task (created_at);

-- Composite indexes for complex queries
CREATE INDEX ON DEPENDS_ON (dependency_type);
CREATE INDEX ON HAS_SUBTASK (order);
```

### Resource Coordination Patterns

```python
class DatabaseSyncCoordinator:
    """Coordinate operations across three databases."""
    
    async def sync_task_update(self, task: Task) -> None:
        """Coordinate task updates across all databases."""
        
        # 1. Update SQLite (source of truth)
        await self.sqlite_service.update_task(task)
        
        # 2. Update Chroma embeddings (if content changed)
        if self._content_changed(task):
            await self._update_embeddings(task)
        
        # 3. Update KuzuDB graph (if relationships changed)  
        if self._relationships_changed(task):
            await self._update_graph_node(task)
        
        # 4. Update sync metadata
        task.last_indexed = datetime.now()
        await self.sqlite_service.update_sync_metadata(task.id, task.last_indexed)
```

## Security & Access Control Architecture

### Database-Level Security

#### 1. SQLite Security (Existing + Enhanced)
```python
# Current file-based permissions preserved
# Enhanced with audit logging for database operations
class SecureTaskService(TaskService):
    async def audit_database_operation(
        self,
        operation: str,
        task_id: str, 
        user_role: str,
        details: Dict[str, Any]
    ):
        """Log all database operations for security auditing."""
```

#### 2. Chroma Security  
```python
# Local-only deployment (no network exposure)
chroma_client = chromadb.Client(
    Settings(
        is_persistent=True,
        persist_directory=str(db_path / "embeddings"),
        allow_reset=False,  # Prevent accidental data loss
        anonymized_telemetry=False
    )
)
```

#### 3. KuzuDB Security
```python
# File-based access control with proper permissions
kuzu_db = kuzu.Database(
    str(db_path / "knowledge_graph"),
    access_mode=kuzu.AccessMode.READ_WRITE,
    buffer_pool_size=1024 * 1024 * 1024  # 1GB buffer
)
```

### Role-Based Access Control Extensions

```python
class DatabasePermissionValidator:
    """Validate database operations based on role permissions."""
    
    def __init__(self, role_manager: RoleManager):
        self.role_manager = role_manager
        
    async def validate_operation(
        self,
        role_name: str,
        operation: DatabaseOperation,
        resource: str
    ) -> bool:
        """Validate if role can perform database operation."""
        
        role = await self.role_manager.get_role(role_name)
        
        # Check tool group permissions
        if operation.requires_semantic_search():
            if not role.has_tool_group(ToolGroup.SEMANTIC_SEARCH):
                return False
                
        if operation.requires_graph_query():
            if not role.has_tool_group(ToolGroup.GRAPH_QUERY):
                return False
                
        if operation.requires_database_admin():
            if not role.has_tool_group(ToolGroup.DATABASE_ADMIN):
                return False
        
        return True
```

## Migration & Deployment Strategy

### Phase 1: Foundation (Week 1-2)
**Goal**: Implement triple database service layer without breaking existing functionality

```python
# 1. Create TripleDBService alongside existing TaskService
class TripleDBService:
    def __init__(self, task_service: TaskService):
        self.task_service = task_service  # Preserve existing functionality
        self.chroma_client = None         # Initialize later
        self.kuzu_db = None              # Initialize later
        
    async def create_task(self, task: Task) -> Task:
        # Delegate to existing TaskService for now
        return await self.task_service.create_task(task)
```

**Deliverables**:
- [ ] `services/triple_db_service.py` - New service layer
- [ ] Enhanced `tasks/models.py` - Add embedding and graph references  
- [ ] Database initialization scripts
- [ ] Unit tests for new service layer

### Phase 2: Chroma Integration (Week 3-4)
**Goal**: Add semantic search capabilities

```python
# 2. Implement Chroma embedding generation and search
class ChromaIntegration:
    async def embed_task_content(self, task: Task) -> str:
        # Generate embeddings for task content
        # Store in Chroma collection
        # Return embedding_id for SQLite reference
        
    async def semantic_search(self, query: str, filters: Dict) -> List[Task]:
        # Vector similarity search
        # Combine with SQLite metadata
```

**Deliverables**:
- [ ] Chroma collection management
- [ ] Embedding generation pipeline
- [ ] Semantic search MCP tools
- [ ] Integration tests with existing task system

### Phase 3: KuzuDB Graph Integration (Week 5-6)  
**Goal**: Add knowledge graph capabilities

```python
# 3. Implement KuzuDB graph operations
class KuzuIntegration:
    async def sync_task_graph(self, task: Task) -> None:
        # Create/update graph nodes
        # Manage relationships
        # Update graph_node_id in SQLite
        
    async def analyze_dependencies(self, task_id: str) -> DependencyAnalysis:
        # Deep graph traversal
        # Cycle detection
        # Impact analysis
```

**Deliverables**:
- [ ] KuzuDB schema definition and migration
- [ ] Graph synchronization logic
- [ ] Graph query MCP tools  
- [ ] Complex relationship analysis features

### Phase 4: Unified Intelligence (Week 7-8)
**Goal**: Hybrid query interface and advanced analytics

```python
# 4. Implement hybrid query intelligence
class UnifiedIntelligence:
    async def intelligent_task_recommendation(
        self, 
        context: str, 
        current_task: Optional[Task]
    ) -> List[TaskRecommendation]:
        # Combine semantic similarity (Chroma)
        # With relationship analysis (KuzuDB)  
        # And execution history (SQLite)
```

**Deliverables**:
- [ ] Hybrid query interface
- [ ] Intelligent recommendation system
- [ ] Advanced analytics dashboard
- [ ] Performance optimization and monitoring

### Database Migration Scripts

```python
# Database migration coordinator
class DatabaseMigrator:
    async def migrate_v2_to_triple_db(self) -> None:
        """Migrate existing V2 SQLite data to triple database system."""
        
        # 1. Backup existing database
        await self._backup_existing_database()
        
        # 2. Add new columns to SQLite
        await self._add_triple_db_columns()
        
        # 3. Initialize Chroma and KuzuDB
        await self._initialize_new_databases()
        
        # 4. Backfill embeddings and graph data
        await self._backfill_semantic_data()
        await self._backfill_graph_data()
        
        # 5. Validate data consistency
        await self._validate_migration()
```

## Monitoring & Observability

### Performance Metrics Dashboard

```python
class TripleDBMetrics:
    """Comprehensive metrics across all three databases."""
    
    async def get_performance_dashboard(self) -> Dict[str, Any]:
        return {
            "sqlite_metrics": {
                "query_latency_p95": await self._sqlite_latency(),
                "active_connections": await self._sqlite_connections(),
                "database_size": await self._sqlite_size()
            },
            "chroma_metrics": {
                "embedding_generation_time": await self._embedding_latency(),
                "search_latency_p95": await self._chroma_search_latency(),
                "collection_sizes": await self._chroma_collection_sizes()
            },
            "kuzu_metrics": {
                "graph_query_latency": await self._kuzu_query_latency(),
                "node_count": await self._kuzu_node_count(),
                "relationship_count": await self._kuzu_relationship_count()
            },
            "sync_metrics": {
                "sync_lag_seconds": await self._sync_lag(),
                "failed_syncs": await self._failed_sync_count(),
                "consistency_score": await self._consistency_check()
            }
        }
```

### Health Check System

```python
@mcp.tool()
async def triple_db_health_check() -> Dict[str, Any]:
    """Comprehensive health check across all databases."""
    
    health_status = {
        "overall_status": "healthy",
        "databases": {
            "sqlite": await check_sqlite_health(),
            "chroma": await check_chroma_health(), 
            "kuzu": await check_kuzu_health()
        },
        "sync_status": await check_sync_consistency(),
        "performance_summary": await get_performance_summary()
    }
    
    return health_status
```

## Risk Mitigation & Contingency Planning

### Failure Modes & Recovery

#### 1. Database Unavailability
```python
class GracefulDegradation:
    """Handle partial database failures gracefully."""
    
    async def handle_chroma_failure(self) -> None:
        # Fall back to SQLite text search
        # Log degraded capability warning
        # Continue with basic functionality
        
    async def handle_kuzu_failure(self) -> None:
        # Use SQLite relationship table
        # Disable advanced graph features
        # Maintain core task operations
```

#### 2. Data Consistency Issues
```python
class ConsistencyManager:
    """Monitor and repair data consistency."""
    
    async def detect_inconsistencies(self) -> List[ConsistencyIssue]:
        # Compare data across databases
        # Identify missing or mismatched records
        # Generate repair recommendations
        
    async def auto_repair_minor_issues(self) -> RepairReport:
        # Fix missing embeddings
        # Sync outdated graph nodes
        # Update reference IDs
```

#### 3. Performance Degradation  
```python
class PerformanceGuardian:
    """Monitor and maintain performance standards."""
    
    async def monitor_query_performance(self) -> None:
        # Track query latencies
        # Identify slow operations
        # Trigger optimization routines
        
    async def emergency_performance_mode(self) -> None:
        # Disable non-essential features
        # Reduce cache sizes if needed
        # Prioritize core operations
```

## Success Metrics & Validation

### Technical Metrics
- **Query Performance**: <100ms for semantic search, <50ms for graph queries
- **Data Consistency**: 99.9% consistency across all databases
- **Memory Usage**: <2GB total for typical workloads
- **Availability**: 99.9% uptime with graceful degradation

### User Experience Metrics  
- **Task Discovery**: 50% improvement in finding relevant tasks
- **Dependency Analysis**: Complex relationships resolved in <5 seconds
- **Intelligent Recommendations**: 80% relevance score for suggested tasks
- **System Responsiveness**: No degradation in core task operations

### Integration Success Criteria
- [ ] All existing V2 MCP tools maintain functionality
- [ ] New semantic search capabilities demonstrate clear value
- [ ] Graph analysis provides actionable dependency insights
- [ ] Role system successfully controls database access
- [ ] Migration completes without data loss
- [ ] Performance remains within acceptable bounds

## Conclusion

This system architecture provides a comprehensive foundation for integrating SQLite, Chroma, and KuzuDB into the existing Vespera V2 task orchestration system. The design prioritizes:

1. **Minimal Disruption**: Building on the solid V2 foundation
2. **Performance**: Maintaining FastMCP responsiveness characteristics
3. **Flexibility**: Graceful degradation and modular capabilities
4. **Security**: Role-based access control with database-specific permissions
5. **Maintainability**: Clear separation of concerns and comprehensive monitoring

The phased implementation approach ensures steady progress while validating each integration step. The enhanced capabilities will transform Vespera from a task orchestrator into an intelligent project coordination system with semantic understanding and graph-based relationship analysis.

**Next Phase**: Begin implementation with Phase 1 foundation work, establishing the triple database service layer while preserving all existing V2 functionality.