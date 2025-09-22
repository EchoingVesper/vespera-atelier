"""
KuzuDB Service for Graph-Based Relationship Management

Implements the third component of the triple database architecture:
- SQLite: Task data and metadata
- ChromaDB: Vector embeddings and semantic search
- KuzuDB: Graph relationships and complex queries

This service manages the graph layer, providing relationship tracking,
dependency analysis, and complex graph queries for the task system.
"""

import logging
import asyncio
from typing import Dict, List, Optional, Set, Tuple, Any, Union
from datetime import datetime
from pathlib import Path
import json

import kuzu

from tasks.models import Task, TaskRelation, TaskStatus, TaskPriority

logger = logging.getLogger(__name__)


class KuzuService:
    """
    Service class for KuzuDB graph database operations.
    
    Provides comprehensive graph database functionality including:
    - Schema initialization and management
    - Node and relationship CRUD operations
    - Complex graph queries and traversals
    - Integration with TaskService for triple database coordination
    """
    
    # Schema initialization commands from our design
    SCHEMA_COMMANDS = [
        # Node Tables
        """CREATE NODE TABLE IF NOT EXISTS Task(
            id STRING PRIMARY KEY, 
            title STRING, 
            description STRING, 
            status STRING, 
            priority STRING, 
            task_order INT64, 
            complexity STRING, 
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
            sync_status STRING, 
            content_hash STRING
        )""",
        
        """CREATE NODE TABLE IF NOT EXISTS User(
            username STRING PRIMARY KEY, 
            full_name STRING, 
            email STRING, 
            role STRING, 
            user_type STRING, 
            created_at STRING, 
            last_active STRING, 
            preferences STRING
        )""",
        
        """CREATE NODE TABLE IF NOT EXISTS Project(
            id STRING PRIMARY KEY, 
            name STRING, 
            description STRING, 
            status STRING, 
            created_at STRING, 
            updated_at STRING, 
            owner STRING, 
            visibility STRING
        )""",
        
        """CREATE NODE TABLE IF NOT EXISTS Document(
            id STRING PRIMARY KEY, 
            title STRING, 
            content STRING, 
            document_type STRING, 
            file_path STRING, 
            content_hash STRING, 
            size_bytes INT64, 
            created_at STRING, 
            updated_at STRING, 
            created_by STRING, 
            tags STRING
        )""",
        
        """CREATE NODE TABLE IF NOT EXISTS Knowledge(
            id STRING PRIMARY KEY, 
            concept STRING, 
            definition STRING, 
            category STRING, 
            confidence_score DOUBLE, 
            source_type STRING, 
            created_at STRING, 
            updated_at STRING, 
            validated_by STRING
        )""",
        
        """CREATE NODE TABLE IF NOT EXISTS Role(
            name STRING PRIMARY KEY, 
            description STRING, 
            capabilities STRING, 
            restrictions STRING, 
            tool_groups STRING, 
            created_at STRING, 
            updated_at STRING
        )""",
        
        """CREATE NODE TABLE IF NOT EXISTS Execution(
            id STRING PRIMARY KEY, 
            task_id STRING, 
            role_name STRING, 
            status STRING, 
            output STRING, 
            error_message STRING, 
            started_at STRING, 
            completed_at STRING, 
            duration_ms INT64, 
            retry_count INT64, 
            execution_context STRING
        )""",
        
        # Relationship Tables
        """CREATE REL TABLE IF NOT EXISTS ParentChild(
            FROM Task TO Task, 
            hierarchy_level INT64, 
            created_at STRING
        )""",
        
        """CREATE REL TABLE IF NOT EXISTS SubtaskOf(
            FROM Task TO Task, 
            depth INT64, 
            created_at STRING
        )""",
        
        """CREATE REL TABLE IF NOT EXISTS DependsOn(
            FROM Task TO Task, 
            dependency_type STRING, 
            created_at STRING, 
            resolved_at STRING
        )""",
        
        """CREATE REL TABLE IF NOT EXISTS Blocks(
            FROM Task TO Task, 
            blocking_reason STRING, 
            created_at STRING, 
            resolved_at STRING
        )""",
        
        """CREATE REL TABLE IF NOT EXISTS RelatesTo(
            FROM Task TO Task, 
            relationship_type STRING, 
            strength DOUBLE, 
            created_at STRING, 
            created_by STRING
        )""",
        
        """CREATE REL TABLE IF NOT EXISTS DuplicateOf(
            FROM Task TO Task, 
            confidence DOUBLE, 
            identified_at STRING, 
            identified_by STRING
        )""",
        
        """CREATE REL TABLE IF NOT EXISTS AssignedTo(
            FROM Task TO User, 
            assigned_at STRING, 
            assigned_by STRING, 
            role_context STRING
        )""",
        
        """CREATE REL TABLE IF NOT EXISTS ExecutedBy(
            FROM Task TO Role, 
            execution_id STRING, 
            executed_at STRING, 
            success BOOLEAN, 
            output_summary STRING
        )""",
        
        """CREATE REL TABLE IF NOT EXISTS BelongsTo(
            FROM Task TO Project, 
            added_at STRING, 
            added_by STRING, 
            feature_tag STRING
        )""",
        
        """CREATE REL TABLE IF NOT EXISTS Owns(
            FROM User TO Project, 
            ownership_type STRING, 
            granted_at STRING, 
            granted_by STRING
        )""",
        
        """CREATE REL TABLE IF NOT EXISTS References(
            FROM Task TO Document, 
            reference_type STRING, 
            relevance_score DOUBLE, 
            created_at STRING, 
            created_by STRING
        )""",
        
        """CREATE REL TABLE IF NOT EXISTS KnowledgeReference(
            FROM Task TO Knowledge, 
            application_context STRING, 
            relevance_score DOUBLE, 
            created_at STRING, 
            validated_by STRING
        )""",
        
        """CREATE REL TABLE IF NOT EXISTS Creates(
            FROM Task TO Document, 
            creation_type STRING, 
            created_at STRING, 
            file_path STRING
        )""",
        
        """CREATE REL TABLE IF NOT EXISTS Learns(
            FROM Task TO Knowledge, 
            learning_type STRING, 
            confidence DOUBLE, 
            learned_at STRING, 
            context STRING
        )""",
        
        """CREATE REL TABLE IF NOT EXISTS SimilarContent(
            FROM Task TO Task, 
            similarity_score DOUBLE, 
            content_type STRING, 
            computed_at STRING, 
            vector_model STRING
        )""",
        
        """CREATE REL TABLE IF NOT EXISTS SemanticCluster(
            FROM Task TO Task, 
            cluster_id STRING, 
            cluster_method STRING, 
            distance DOUBLE, 
            computed_at STRING
        )""",
        
        """CREATE REL TABLE IF NOT EXISTS Sequence(
            FROM Task TO Task, 
            sequence_type STRING, 
            order_index INT64, 
            created_at STRING, 
            workflow_id STRING
        )""",
        
        """CREATE REL TABLE IF NOT EXISTS Precedes(
            FROM Task TO Task, 
            time_gap_hours DOUBLE, 
            sequence_reason STRING, 
            created_at STRING
        )"""
    ]
    
    def __init__(self, db_path: Optional[Path] = None):
        """
        Initialize KuzuDB service.
        
        Args:
            db_path: Optional path to database directory
        """
        self.db_path = db_path or Path.cwd() / ".vespera_v2" / "graph.kuzu"
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Initialize database and connection
        self.database = kuzu.Database(str(self.db_path))
        self.connection = kuzu.Connection(self.database)
        
        # Initialize schema
        self._init_schema()
        
        logger.info(f"KuzuDB service initialized at {self.db_path}")
    
    def _init_schema(self) -> None:
        """Initialize the graph database schema."""
        try:
            for command in self.SCHEMA_COMMANDS:
                self.connection.execute(command)
            logger.info("KuzuDB schema initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize KuzuDB schema: {e}")
            raise
    
    # Node Operations
    
    async def add_task_node(self, task: Task) -> bool:
        """
        Add or update a task node in the graph.
        
        Args:
            task: Task object to add
            
        Returns:
            bool: Success status
        """
        try:
            # Prepare task data for insertion
            query = """
            MERGE (t:Task {id: $id})
            SET t.title = $title,
                t.description = $description,
                t.status = $status,
                t.priority = $priority,
                t.task_order = $task_order,
                t.complexity = $complexity,
                t.estimated_effort = $estimated_effort,
                t.actual_effort = $actual_effort,
                t.project_id = $project_id,
                t.feature = $feature,
                t.milestone = $milestone,
                t.assignee = $assignee,
                t.creator = $creator,
                t.created_at = $created_at,
                t.updated_at = $updated_at,
                t.due_date = $due_date,
                t.started_at = $started_at,
                t.completed_at = $completed_at,
                t.sync_status = $sync_status,
                t.content_hash = $content_hash
            """
            
            # Use CREATE syntax for KuzuDB
            kuzu_query = """
            CREATE (t:Task {
                id: $id,
                title: $title,
                description: $description,
                status: $status,
                priority: $priority,
                task_order: $task_order,
                complexity: $complexity,
                estimated_effort: $estimated_effort,
                actual_effort: $actual_effort,
                project_id: $project_id,
                feature: $feature,
                milestone: $milestone,
                assignee: $assignee,
                creator: $creator,
                created_at: $created_at,
                updated_at: $updated_at,
                due_date: $due_date,
                started_at: $started_at,
                completed_at: $completed_at,
                sync_status: $sync_status,
                content_hash: $content_hash
            })
            """
            
            # Simplified approach - use direct INSERT  
            insert_query = """CREATE (:Task {{id: '{}', title: '{}', description: '{}', status: '{}', priority: '{}', task_order: {}, complexity: '{}', estimated_effort: '{}', actual_effort: '{}', project_id: '{}', feature: '{}', milestone: '{}', assignee: '{}', creator: '{}', created_at: '{}', updated_at: '{}', due_date: '{}', started_at: '{}', completed_at: '{}', sync_status: '{}', content_hash: '{}'}})""".format(
                task.id,
                task.title.replace("'", "''"),  # Escape single quotes
                task.description.replace("'", "''") if task.description else "",
                task.status.value if hasattr(task.status, 'value') else task.status,
                task.priority.value if hasattr(task.priority, 'value') else task.priority,
                task.task_order,
                task.metadata.complexity if task.metadata else "moderate",
                task.metadata.estimated_effort if task.metadata and task.metadata.estimated_effort else "",
                task.metadata.actual_effort if task.metadata and task.metadata.actual_effort else "",
                task.project_id or "",
                task.feature or "",
                task.milestone or "",
                task.assignee,
                task.creator,
                task.created_at.isoformat(),
                task.updated_at.isoformat(),
                task.due_date.isoformat() if task.due_date else "",
                task.started_at.isoformat() if task.started_at else "",
                task.completed_at.isoformat() if task.completed_at else "",
                task.triple_db.sync_status.value if hasattr(task.triple_db.sync_status, 'value') else task.triple_db.sync_status,
                task.triple_db.content_hash or ""
            )
            
            try:
                # Try to create the node
                self.connection.execute(insert_query)
                logger.debug(f"Created new task node {task.id} in graph")
            except Exception as create_error:
                if "duplicated primary key" in str(create_error):
                    # Node exists, update it instead
                    update_query = """MATCH (t:Task {{id: '{}'}}) SET t.title = '{}', t.description = '{}', t.status = '{}', t.priority = '{}', t.task_order = {}, t.complexity = '{}', t.estimated_effort = '{}', t.actual_effort = '{}', t.project_id = '{}', t.feature = '{}', t.milestone = '{}', t.assignee = '{}', t.creator = '{}', t.updated_at = '{}', t.due_date = '{}', t.started_at = '{}', t.completed_at = '{}', t.sync_status = '{}', t.content_hash = '{}'""".format(
                        task.id,
                        task.title.replace("'", "''"),
                        task.description.replace("'", "''") if task.description else "",
                        task.status.value if hasattr(task.status, 'value') else task.status,
                        task.priority.value if hasattr(task.priority, 'value') else task.priority,
                        task.task_order,
                        task.metadata.complexity if task.metadata else "moderate",
                        task.metadata.estimated_effort if task.metadata and task.metadata.estimated_effort else "",
                        task.metadata.actual_effort if task.metadata and task.metadata.actual_effort else "",
                        task.project_id or "",
                        task.feature or "",
                        task.milestone or "",
                        task.assignee,
                        task.creator,
                        task.updated_at.isoformat(),
                        task.due_date.isoformat() if task.due_date else "",
                        task.started_at.isoformat() if task.started_at else "",
                        task.completed_at.isoformat() if task.completed_at else "",
                        task.triple_db.sync_status.value if hasattr(task.triple_db.sync_status, 'value') else task.triple_db.sync_status,
                        task.triple_db.content_hash or ""
                    )
                    self.connection.execute(update_query)
                    logger.debug(f"Updated existing task node {task.id} in graph")
                else:
                    raise create_error
            
            # Update triple_db coordination
            task.triple_db.graph_node_id = task.id
            task.triple_db.last_graph_sync = datetime.now()
            task.triple_db.kuzu_synced = True
            task.triple_db._update_overall_sync_status()
            
            logger.debug(f"Synced task node {task.id} to graph")
            return True
            
        except Exception as e:
            logger.error(f"Failed to add task node {task.id}: {e}")
            return False
    
    async def add_user_node(self, username: str, full_name: str = "", 
                          email: str = "", role: str = "user", 
                          user_type: str = "human") -> bool:
        """Add or update a user node."""
        try:
            query = """CREATE (:User {{username: '{}', full_name: '{}', email: '{}', role: '{}', user_type: '{}', created_at: '{}', last_active: '{}', preferences: '{}'}})""".format(
                username,
                full_name.replace("'", "''"),
                email,
                role,
                user_type,
                datetime.now().isoformat(),
                datetime.now().isoformat(),
                "{}"  # Empty JSON for preferences
            )
            
            self.connection.execute(query)
            logger.debug(f"Added user node {username}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to add user node {username}: {e}")
            return False
    
    # Relationship Operations
    
    async def add_task_relationship(self, source_task_id: str, target_task_id: str,
                                  relationship: TaskRelation, 
                                  properties: Optional[Dict[str, Any]] = None) -> bool:
        """
        Add a relationship between two tasks.
        
        Args:
            source_task_id: Source task ID
            target_task_id: Target task ID  
            relationship: Type of relationship
            properties: Additional relationship properties
            
        Returns:
            bool: Success status
        """
        try:
            now = datetime.now().isoformat()
            props = properties or {}
            
            if relationship == TaskRelation.PARENT_CHILD:
                query = """
                MATCH (s:Task {{id: '{}'}}), (t:Task {{id: '{}'}})
                CREATE (s)-[:ParentChild {{
                    hierarchy_level: {},
                    created_at: '{}'
                }}]->(t)
                """.format(
                    source_task_id, 
                    target_task_id,
                    props.get('hierarchy_level', 1),
                    now
                )
                
            elif relationship == TaskRelation.DEPENDS_ON:
                query = """
                MATCH (s:Task {{id: '{}'}}), (t:Task {{id: '{}'}})
                CREATE (s)-[:DependsOn {{
                    dependency_type: '{}',
                    created_at: '{}',
                    resolved_at: '{}'
                }}]->(t)
                """.format(
                    source_task_id,
                    target_task_id, 
                    props.get('dependency_type', 'hard'),
                    now,
                    props.get('resolved_at', '')
                )
                
            elif relationship == TaskRelation.BLOCKS:
                query = """
                MATCH (s:Task {{id: '{}'}}), (t:Task {{id: '{}'}})
                CREATE (s)-[:Blocks {{
                    blocking_reason: '{}',
                    created_at: '{}',
                    resolved_at: '{}'
                }}]->(t)
                """.format(
                    source_task_id,
                    target_task_id,
                    props.get('blocking_reason', ''),
                    now,
                    props.get('resolved_at', '')
                )
                
            elif relationship == TaskRelation.RELATES_TO:
                query = """
                MATCH (s:Task {{id: '{}'}}), (t:Task {{id: '{}'}})
                CREATE (s)-[:RelatesTo {{
                    relationship_type: '{}',
                    strength: {},
                    created_at: '{}',
                    created_by: '{}'
                }}]->(t)
                """.format(
                    source_task_id,
                    target_task_id,
                    props.get('relationship_type', 'reference'),
                    props.get('strength', 0.5),
                    now,
                    props.get('created_by', 'System')
                )
                
            elif relationship == TaskRelation.DUPLICATE_OF:
                query = """
                MATCH (s:Task {{id: '{}'}}), (t:Task {{id: '{}'}})
                CREATE (s)-[:DuplicateOf {{
                    confidence: {},
                    identified_at: '{}',
                    identified_by: '{}'
                }}]->(t)
                """.format(
                    source_task_id,
                    target_task_id,
                    props.get('confidence', 0.8),
                    now,
                    props.get('identified_by', 'System')
                )
                
            else:
                logger.warning(f"Unknown relationship type: {relationship}")
                return False
            
            self.connection.execute(query)
            logger.debug(f"Added {relationship.value} relationship: {source_task_id} -> {target_task_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to add task relationship {relationship.value}: {e}")
            return False
    
    async def add_similarity_relationship(self, task1_id: str, task2_id: str,
                                        similarity_score: float, content_type: str = "full_content",
                                        vector_model: str = "default") -> bool:
        """Add semantic similarity relationship between tasks."""
        try:
            query = """
            MATCH (t1:Task {{id: '{}'}}), (t2:Task {{id: '{}'}})
            CREATE (t1)-[:SimilarContent {{
                similarity_score: {},
                content_type: '{}',
                computed_at: '{}',
                vector_model: '{}'
            }}]->(t2)
            """.format(
                task1_id,
                task2_id,
                similarity_score,
                content_type,
                datetime.now().isoformat(),
                vector_model
            )
            
            self.connection.execute(query)
            logger.debug(f"Added similarity relationship: {task1_id} -> {task2_id} ({similarity_score:.3f})")
            return True
            
        except Exception as e:
            logger.error(f"Failed to add similarity relationship: {e}")
            return False
    
    # Query Operations
    
    async def get_task_dependencies(self, task_id: str) -> List[Dict[str, Any]]:
        """Get all tasks that the given task depends on."""
        try:
            query = """
            MATCH (t:Task {{id: '{}'}})-[r:DependsOn]->(dep:Task)
            RETURN dep.id AS id, dep.title AS title, dep.status AS status,
                   r.dependency_type AS dependency_type, r.created_at AS created_at
            """.format(task_id)
            
            result = self.connection.execute(query)
            dependencies = []
            
            # Process results
            while result.has_next():
                record = result.get_next()
                dependencies.append({
                    'id': record[0],
                    'title': record[1], 
                    'status': record[2],
                    'dependency_type': record[3],
                    'created_at': record[4]
                })
            
            logger.debug(f"Found {len(dependencies)} dependencies for task {task_id}")
            return dependencies
            
        except Exception as e:
            logger.error(f"Failed to get task dependencies for {task_id}: {e}")
            return []
    
    async def get_blocking_tasks(self, task_id: str) -> List[Dict[str, Any]]:
        """Get all tasks blocked by the given task."""
        try:
            query = """
            MATCH (t:Task {{id: '{}'}})-[r:Blocks]->(blocked:Task)
            RETURN blocked.id AS id, blocked.title AS title, blocked.status AS status,
                   r.blocking_reason AS blocking_reason, r.created_at AS created_at
            """.format(task_id)
            
            result = self.connection.execute(query)
            blocked_tasks = []
            
            while result.has_next():
                record = result.get_next()
                blocked_tasks.append({
                    'id': record[0],
                    'title': record[1],
                    'status': record[2], 
                    'blocking_reason': record[3],
                    'created_at': record[4]
                })
            
            logger.debug(f"Found {len(blocked_tasks)} tasks blocked by {task_id}")
            return blocked_tasks
            
        except Exception as e:
            logger.error(f"Failed to get blocking tasks for {task_id}: {e}")
            return []
    
    async def get_task_hierarchy(self, root_task_id: str, max_depth: int = 5) -> Dict[str, Any]:
        """
        Get the hierarchical structure of tasks starting from a root task.
        
        Args:
            root_task_id: Root task to start from
            max_depth: Maximum depth to traverse
            
        Returns:
            Dict representing the task hierarchy
        """
        try:
            # Get the root task and all its descendants
            query = """
            MATCH (root:Task {{id: '{}'}})
            OPTIONAL MATCH (root)-[:ParentChild*1..{}]->(child:Task)
            RETURN root.id AS id, root.title AS title, root.status AS status,
                   collect(child.id) AS child_ids,
                   collect(child.title) AS child_titles
            """.format(root_task_id, max_depth)
            
            result = self.connection.execute(query)
            
            if result.has_next():
                record = result.get_next()
                return {
                    'id': record[0],
                    'title': record[1],
                    'status': record[2],
                    'children': [
                        {'id': cid, 'title': ctitle} 
                        for cid, ctitle in zip(record[3], record[4])
                        if cid  # Filter out None values
                    ]
                }
            
            return {}
            
        except Exception as e:
            logger.error(f"Failed to get task hierarchy for {root_task_id}: {e}")
            return {}
    
    async def get_similar_tasks(self, task_id: str, min_similarity: float = 0.7,
                              limit: int = 10) -> List[Dict[str, Any]]:
        """Get tasks similar to the given task based on semantic similarity."""
        try:
            query = """
            MATCH (t:Task {{id: '{}'}})-[r:SimilarContent]->(similar:Task)
            WHERE r.similarity_score >= {}
            RETURN similar.id AS id, similar.title AS title, similar.status AS status,
                   r.similarity_score AS similarity_score, r.content_type AS content_type
            ORDER BY r.similarity_score DESC
            LIMIT {}
            """.format(task_id, min_similarity, limit)
            
            result = self.connection.execute(query)
            similar_tasks = []
            
            while result.has_next():
                record = result.get_next()
                similar_tasks.append({
                    'id': record[0],
                    'title': record[1],
                    'status': record[2],
                    'similarity_score': record[3],
                    'content_type': record[4]
                })
            
            logger.debug(f"Found {len(similar_tasks)} similar tasks for {task_id}")
            return similar_tasks
            
        except Exception as e:
            logger.error(f"Failed to get similar tasks for {task_id}: {e}")
            return []
    
    async def analyze_dependency_chain(self, task_id: str) -> Dict[str, Any]:
        """
        Analyze the complete dependency chain for a task.
        
        Returns information about dependencies, blocked tasks, and potential cycles.
        """
        try:
            # Get full dependency tree
            dependencies = await self.get_task_dependencies(task_id)
            blocked_tasks = await self.get_blocking_tasks(task_id)
            
            # Check for circular dependencies (simplified)
            circular_deps = await self._check_circular_dependencies(task_id)
            
            return {
                'task_id': task_id,
                'dependencies': dependencies,
                'blocks': blocked_tasks,
                'dependency_count': len(dependencies),
                'blocked_count': len(blocked_tasks),
                'has_circular_dependencies': len(circular_deps) > 0,
                'circular_dependencies': circular_deps,
                'analysis_timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to analyze dependency chain for {task_id}: {e}")
            return {}
    
    async def _check_circular_dependencies(self, task_id: str) -> List[str]:
        """Check for circular dependencies starting from a task."""
        try:
            # Use a simple path query to detect cycles - KuzuDB syntax
            query = """MATCH (start:Task {{id: '{}'}})-[:DependsOn*1..10]->(end:Task {{id: '{}'}}) RETURN count(*)""".format(task_id, task_id)
            
            result = self.connection.execute(query)
            cycles = []
            
            if result.has_next():
                # If we can reach the start task from itself via DependsOn, we have a cycle
                cycles.append(task_id)
            
            return cycles
            
        except Exception as e:
            logger.error(f"Failed to check circular dependencies for {task_id}: {e}")
            return []
    
    # Health and Statistics
    
    async def get_graph_stats(self) -> Dict[str, Any]:
        """Get statistics about the graph database."""
        try:
            stats = {}
            
            # Count nodes by type
            node_queries = [
                ("tasks", "MATCH (n:Task) RETURN count(n) AS count"),
                ("users", "MATCH (n:User) RETURN count(n) AS count"), 
                ("projects", "MATCH (n:Project) RETURN count(n) AS count"),
                ("documents", "MATCH (n:Document) RETURN count(n) AS count"),
                ("knowledge", "MATCH (n:Knowledge) RETURN count(n) AS count"),
                ("roles", "MATCH (n:Role) RETURN count(n) AS count"),
                ("executions", "MATCH (n:Execution) RETURN count(n) AS count"),
            ]
            
            for name, query in node_queries:
                try:
                    result = self.connection.execute(query)
                    if result.has_next():
                        count = result.get_next()[0]
                        stats[f"{name}_count"] = count
                    else:
                        stats[f"{name}_count"] = 0
                except Exception as e:
                    logger.warning(f"Failed to count {name}: {e}")
                    stats[f"{name}_count"] = 0
            
            # Count relationships
            rel_queries = [
                ("parent_child", "MATCH ()-[r:ParentChild]->() RETURN count(r) AS count"),
                ("dependencies", "MATCH ()-[r:DependsOn]->() RETURN count(r) AS count"),
                ("blocks", "MATCH ()-[r:Blocks]->() RETURN count(r) AS count"),
                ("relates_to", "MATCH ()-[r:RelatesTo]->() RETURN count(r) AS count"),
                ("similar_content", "MATCH ()-[r:SimilarContent]->() RETURN count(r) AS count"),
            ]
            
            for name, query in rel_queries:
                try:
                    result = self.connection.execute(query)
                    if result.has_next():
                        count = result.get_next()[0]
                        stats[f"{name}_relationships"] = count
                    else:
                        stats[f"{name}_relationships"] = 0
                except Exception as e:
                    logger.warning(f"Failed to count {name} relationships: {e}")
                    stats[f"{name}_relationships"] = 0
            
            stats['timestamp'] = datetime.now().isoformat()
            return stats
            
        except Exception as e:
            logger.error(f"Failed to get graph stats: {e}")
            return {'error': str(e)}
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform health check on the graph database."""
        try:
            # Test basic connectivity
            result = self.connection.execute("MATCH (n) RETURN count(n) LIMIT 1")
            total_nodes = result.get_next()[0] if result.has_next() else 0
            
            # Get basic stats
            stats = await self.get_graph_stats()
            
            return {
                'status': 'healthy',
                'total_nodes': total_nodes,
                'database_path': str(self.db_path),
                'schema_initialized': True,
                'statistics': stats,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Graph database health check failed: {e}")
            return {
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    # Integration Methods
    
    async def sync_task_from_sqlite(self, task: Task) -> bool:
        """Sync a task from SQLite to the graph database."""
        try:
            # Add/update the task node
            success = await self.add_task_node(task)
            
            if success:
                # Add relationships based on task's related_task_ids
                for relation_type, task_ids in task.related_task_ids.items():
                    for related_id in task_ids:
                        await self.add_task_relationship(
                            task.id, 
                            related_id, 
                            relation_type
                        )
                
                # Add project relationship if exists
                if task.project_id:
                    # Note: We would need to ensure the project node exists
                    # This is a simplified version
                    pass
            
            return success
            
        except Exception as e:
            logger.error(f"Failed to sync task {task.id} from SQLite: {e}")
            return False
    
    async def sync_similarity_from_chromadb(self, task_id: str, 
                                          similar_tasks: List[Dict[str, Any]]) -> bool:
        """Sync similarity relationships from ChromaDB vector search results."""
        try:
            for similar_task in similar_tasks:
                await self.add_similarity_relationship(
                    task_id,
                    similar_task['id'],
                    similar_task.get('similarity_score', 0.0),
                    similar_task.get('content_type', 'vector_embedding'),
                    similar_task.get('vector_model', 'chromadb_default')
                )
            
            logger.debug(f"Synced {len(similar_tasks)} similarity relationships for {task_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to sync similarity from ChromaDB for {task_id}: {e}")
            return False
    
    def close(self):
        """Close the database connection."""
        try:
            if hasattr(self, 'connection'):
                # KuzuDB connections are automatically managed
                pass
            logger.info("KuzuDB connection closed")
        except Exception as e:
            logger.error(f"Error closing KuzuDB connection: {e}")


# Async wrapper functions for easier integration

async def create_kuzu_service(db_path: Optional[Path] = None) -> KuzuService:
    """Create and initialize a KuzuService instance."""
    return KuzuService(db_path)


async def get_task_relationship_analysis(kuzu_service: KuzuService, 
                                       task_id: str) -> Dict[str, Any]:
    """Get comprehensive relationship analysis for a task."""
    return await kuzu_service.analyze_dependency_chain(task_id)


async def update_task_similarity_graph(kuzu_service: KuzuService,
                                     vector_search_results: List[Dict[str, Any]]) -> bool:
    """Update the graph with similarity relationships from vector search."""
    success_count = 0
    
    for result in vector_search_results:
        task_id = result.get('task_id')
        similar_tasks = result.get('similar_tasks', [])
        
        if task_id and similar_tasks:
            success = await kuzu_service.sync_similarity_from_chromadb(task_id, similar_tasks)
            if success:
                success_count += 1
    
    return success_count == len(vector_search_results)