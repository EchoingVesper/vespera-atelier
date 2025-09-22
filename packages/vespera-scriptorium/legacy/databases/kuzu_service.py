"""
KuzuDB Graph Database Service for Relationship Analysis

Specialized service for managing task relationships and dependency graphs
using KuzuDB graph database.
"""

import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple, Set
from dataclasses import dataclass

from tasks.models import Task, TaskRelation

try:
    import kuzu
    KUZU_AVAILABLE = True
except ImportError:
    KUZU_AVAILABLE = False
    kuzu = None

logger = logging.getLogger(__name__)


@dataclass
class GraphNode:
    """Represents a node in the task graph."""
    id: str
    node_type: str  # 'task', 'project', 'role', 'user'
    properties: Dict[str, Any]


@dataclass 
class GraphRelationship:
    """Represents a relationship in the task graph."""
    source_id: str
    target_id: str
    relationship_type: str
    properties: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.properties is None:
            self.properties = {}


@dataclass
class DependencyPath:
    """Represents a dependency path between tasks."""
    from_task_id: str
    to_task_id: str
    path_length: int
    path_nodes: List[str]
    is_circular: bool = False


@dataclass
class KuzuConfig:
    """Configuration for KuzuDB graph database."""
    database_path: Path
    buffer_pool_size: int = 1024 * 1024 * 1024  # 1GB default


class KuzuService:
    """
    Service for graph operations and relationship analysis using KuzuDB.
    
    Provides:
    - Task node management
    - Relationship creation and querying
    - Dependency analysis and cycle detection
    - Project hierarchy management
    - Role assignment tracking
    - Performance analytics
    """
    
    def __init__(self, config: KuzuConfig):
        """Initialize KuzuDB service."""
        self.config = config
        self.database: Optional[kuzu.Database] = None
        
        if not KUZU_AVAILABLE:
            logger.warning("KuzuDB not available. Install kuzu package for graph analysis.")
            return
        
        self._initialized = False
        logger.info(f"KuzuService initialized with config: {config}")
    
    async def initialize(self) -> bool:
        """Initialize KuzuDB database and schema."""
        if not KUZU_AVAILABLE:
            logger.error("KuzuDB package not available")
            return False
        
        try:
            # Ensure directory exists
            self.config.database_path.mkdir(parents=True, exist_ok=True)
            
            # Initialize database
            self.database = kuzu.Database(
                str(self.config.database_path),
                buffer_pool_size=self.config.buffer_pool_size
            )
            
            # Initialize schema
            await self._initialize_schema()
            
            self._initialized = True
            logger.info("KuzuDB service initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize KuzuDB service: {e}")
            return False
    
    async def _initialize_schema(self) -> None:
        """Initialize KuzuDB schema with node and relationship tables."""
        connection = kuzu.Connection(self.database)
        
        try:
            # Create node tables
            node_schemas = [
                # Task nodes (primary entity)
                """CREATE NODE TABLE IF NOT EXISTS Task (
                    id STRING,
                    title STRING,
                    description STRING,
                    status STRING,
                    priority STRING,
                    created_at TIMESTAMP,
                    updated_at TIMESTAMP,
                    due_date TIMESTAMP,
                    started_at TIMESTAMP,
                    completed_at TIMESTAMP,
                    project_id STRING,
                    feature STRING,
                    milestone STRING,
                    assignee STRING,
                    creator STRING,
                    complexity STRING,
                    estimated_effort STRING,
                    actual_effort STRING,
                    tags STRING[],
                    sqlite_synced_at TIMESTAMP,
                    embedding_synced_at TIMESTAMP,
                    PRIMARY KEY (id)
                )""",
                
                # Project nodes
                """CREATE NODE TABLE IF NOT EXISTS Project (
                    id STRING,
                    name STRING,
                    description STRING,
                    status STRING,
                    created_at TIMESTAMP,
                    team STRING,
                    technology_stack STRING[],
                    repository_url STRING,
                    PRIMARY KEY (id)
                )""",
                
                # Role nodes
                """CREATE NODE TABLE IF NOT EXISTS Role (
                    name STRING,
                    display_name STRING,
                    description STRING,
                    tool_groups STRING[],
                    restrictions STRING[],
                    preferred_llm STRING,
                    PRIMARY KEY (name)
                )""",
                
                # User nodes
                """CREATE NODE TABLE IF NOT EXISTS User (
                    id STRING,
                    name STRING,
                    email STRING,
                    preferred_roles STRING[],
                    active BOOLEAN,
                    PRIMARY KEY (id)
                )""",
                
                # Artifact nodes (files, documents, resources)
                """CREATE NODE TABLE IF NOT EXISTS Artifact (
                    id STRING,
                    path STRING,
                    type STRING,
                    name STRING,
                    content_hash STRING,
                    created_at TIMESTAMP,
                    updated_at TIMESTAMP,
                    PRIMARY KEY (id)
                )""",
                
                # Milestone nodes
                """CREATE NODE TABLE IF NOT EXISTS Milestone (
                    id STRING,
                    name STRING,
                    description STRING,
                    due_date TIMESTAMP,
                    status STRING,
                    PRIMARY KEY (id)
                )"""
            ]
            
            for schema in node_schemas:
                connection.execute(schema)
                logger.debug(f"Created node schema: {schema.split()[3]}")
            
            # Create relationship tables
            relationship_schemas = [
                # Task hierarchy
                "CREATE REL TABLE IF NOT EXISTS HAS_SUBTASK (FROM Task TO Task, order INT64, created_at TIMESTAMP)",
                "CREATE REL TABLE IF NOT EXISTS PARENT_OF (FROM Task TO Task, depth INT64, path STRING)",
                
                # Dependencies
                "CREATE REL TABLE IF NOT EXISTS DEPENDS_ON (FROM Task TO Task, dependency_type STRING, created_at TIMESTAMP, created_by STRING, description STRING)",
                "CREATE REL TABLE IF NOT EXISTS BLOCKS (FROM Task TO Task, blocking_type STRING, created_at TIMESTAMP, priority STRING, estimated_blocking_time STRING)",
                
                # Assignments
                "CREATE REL TABLE IF NOT EXISTS ASSIGNED_TO (FROM Task TO Role, assigned_at TIMESTAMP, assigned_by STRING, assignment_type STRING)",
                "CREATE REL TABLE IF NOT EXISTS WORKED_ON_BY (FROM Task TO User, work_started TIMESTAMP, work_ended TIMESTAMP, hours_worked DOUBLE, work_type STRING)",
                
                # Project relationships
                "CREATE REL TABLE IF NOT EXISTS BELONGS_TO (FROM Task TO Project, added_at TIMESTAMP)",
                "CREATE REL TABLE IF NOT EXISTS PROJECT_MILESTONE (FROM Project TO Milestone, milestone_order INT64)",
                "CREATE REL TABLE IF NOT EXISTS MILESTONE_TASK (FROM Milestone TO Task, task_priority STRING)",
                
                # References
                "CREATE REL TABLE IF NOT EXISTS REFERENCES (FROM Task TO Artifact, reference_type STRING, created_at TIMESTAMP, description STRING)",
                "CREATE REL TABLE IF NOT EXISTS RELATES_TO (FROM Task TO Task, relation_type STRING, strength DOUBLE, created_at TIMESTAMP, description STRING)",
                
                # Execution
                "CREATE REL TABLE IF NOT EXISTS EXECUTED_BY (FROM Task TO Role, execution_id STRING, started_at TIMESTAMP, completed_at TIMESTAMP, status STRING, retry_count INT64)"
            ]
            
            for schema in relationship_schemas:
                connection.execute(schema)
                logger.debug(f"Created relationship schema: {schema.split()[5]}")
            
            logger.info("KuzuDB schema initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize KuzuDB schema: {e}")
            raise
        finally:
            connection.close()
    
    async def sync_task_node(self, task: Task) -> bool:
        """Synchronize task node in graph database."""
        if not self._initialized:
            return False
        
        connection = kuzu.Connection(self.database)
        
        try:
            # Create or update Task node
            query = """
                MERGE (t:Task {id: $id})
                SET t.title = $title,
                    t.description = $description,
                    t.status = $status,
                    t.priority = $priority,
                    t.created_at = $created_at,
                    t.updated_at = $updated_at,
                    t.due_date = $due_date,
                    t.started_at = $started_at,
                    t.completed_at = $completed_at,
                    t.project_id = $project_id,
                    t.feature = $feature,
                    t.milestone = $milestone,
                    t.assignee = $assignee,
                    t.creator = $creator,
                    t.complexity = $complexity,
                    t.estimated_effort = $estimated_effort,
                    t.actual_effort = $actual_effort,
                    t.tags = $tags,
                    t.sqlite_synced_at = $sync_time
            """
            
            parameters = {
                "id": task.id,
                "title": task.title,
                "description": task.description,
                "status": task.status.value,
                "priority": task.priority.value,
                "created_at": task.created_at,
                "updated_at": task.updated_at,
                "due_date": task.due_date,
                "started_at": task.started_at,
                "completed_at": task.completed_at,
                "project_id": task.project_id or "",
                "feature": task.feature or "",
                "milestone": task.milestone or "",
                "assignee": task.assignee,
                "creator": task.creator,
                "complexity": task.metadata.complexity,
                "estimated_effort": task.metadata.estimated_effort or "",
                "actual_effort": task.metadata.actual_effort or "",
                "tags": task.metadata.tags,
                "sync_time": datetime.now()
            }
            
            connection.execute(query, parameters)
            
            # Sync relationships
            await self._sync_task_relationships(connection, task)
            
            logger.debug(f"Synced task node {task.id} to KuzuDB")
            return True
            
        except Exception as e:
            logger.error(f"Failed to sync task node {task.id}: {e}")
            return False
        finally:
            connection.close()
    
    async def _sync_task_relationships(self, connection, task: Task) -> None:
        """Sync task relationships to graph database."""
        try:
            # Clear existing relationships for this task
            connection.execute("MATCH (t:Task {id: $id})-[r]-() DELETE r", {"id": task.id})
            
            # Sync parent-child relationships
            if task.parent_id:
                query = """
                    MATCH (parent:Task {id: $parent_id}), (child:Task {id: $child_id})
                    CREATE (parent)-[:HAS_SUBTASK {order: $order, created_at: $created_at}]->(child)
                """
                connection.execute(query, {
                    "parent_id": task.parent_id,
                    "child_id": task.id,
                    "order": task.task_order,
                    "created_at": datetime.now()
                })
            
            # Sync other relationships
            for relation_type, related_ids in task.related_task_ids.items():
                if relation_type == TaskRelation.DEPENDS_ON:
                    for related_id in related_ids:
                        query = """
                            MATCH (source:Task {id: $source_id}), (target:Task {id: $target_id})
                            CREATE (source)-[:DEPENDS_ON {
                                dependency_type: $dep_type,
                                created_at: $created_at,
                                created_by: $created_by,
                                description: $description
                            }]->(target)
                        """
                        connection.execute(query, {
                            "source_id": task.id,
                            "target_id": related_id,
                            "dep_type": "hard",
                            "created_at": datetime.now(),
                            "created_by": "system",
                            "description": f"Task {task.id} depends on {related_id}"
                        })
                
                elif relation_type == TaskRelation.BLOCKS:
                    for related_id in related_ids:
                        query = """
                            MATCH (source:Task {id: $source_id}), (target:Task {id: $target_id})
                            CREATE (source)-[:BLOCKS {
                                blocking_type: $blocking_type,
                                created_at: $created_at,
                                priority: $priority
                            }]->(target)
                        """
                        connection.execute(query, {
                            "source_id": task.id,
                            "target_id": related_id,
                            "blocking_type": "technical",
                            "created_at": datetime.now(),
                            "priority": task.priority.value
                        })
            
            # Sync project relationship
            if task.project_id:
                # Create project node if it doesn't exist
                query = """
                    MERGE (p:Project {id: $project_id})
                    SET p.name = $project_name,
                        p.status = $project_status
                """
                connection.execute(query, {
                    "project_id": task.project_id,
                    "project_name": task.project_id.replace("-", " ").title(),
                    "project_status": "active"
                })
                
                # Create belongs-to relationship
                query = """
                    MATCH (t:Task {id: $task_id}), (p:Project {id: $project_id})
                    CREATE (t)-[:BELONGS_TO {added_at: $added_at}]->(p)
                """
                connection.execute(query, {
                    "task_id": task.id,
                    "project_id": task.project_id,
                    "added_at": datetime.now()
                })
            
            # Sync role assignment
            if task.execution.assigned_role:
                # Create role node if it doesn't exist
                query = """
                    MERGE (r:Role {name: $role_name})
                    SET r.display_name = $display_name
                """
                connection.execute(query, {
                    "role_name": task.execution.assigned_role,
                    "display_name": task.execution.assigned_role.replace("_", " ").title()
                })
                
                # Create assignment relationship
                query = """
                    MATCH (t:Task {id: $task_id}), (r:Role {name: $role_name})
                    CREATE (t)-[:ASSIGNED_TO {
                        assigned_at: $assigned_at,
                        assigned_by: $assigned_by,
                        assignment_type: $assignment_type
                    }]->(r)
                """
                connection.execute(query, {
                    "task_id": task.id,
                    "role_name": task.execution.assigned_role,
                    "assigned_at": datetime.now(),
                    "assigned_by": "system",
                    "assignment_type": "primary"
                })
            
        except Exception as e:
            logger.error(f"Failed to sync relationships for task {task.id}: {e}")
    
    async def remove_task_node(self, task_id: str) -> bool:
        """Remove task node and all its relationships."""
        if not self._initialized:
            return False
        
        connection = kuzu.Connection(self.database)
        
        try:
            query = "MATCH (t:Task {id: $id}) DETACH DELETE t"
            connection.execute(query, {"id": task_id})
            
            logger.debug(f"Removed task node {task_id} from KuzuDB")
            return True
            
        except Exception as e:
            logger.error(f"Failed to remove task node {task_id}: {e}")
            return False
        finally:
            connection.close()
    
    async def analyze_dependencies(self, task_id: str, max_depth: int = 5) -> Dict[str, Any]:
        """Analyze task dependencies and return dependency tree."""
        if not self._initialized:
            return {"error": "Service not initialized"}
        
        connection = kuzu.Connection(self.database)
        
        try:
            # Find all dependencies (tasks this task depends on)
            dependencies_query = """
                MATCH path = (t:Task {id: $task_id})-[:DEPENDS_ON*1..$max_depth]->(dep:Task)
                RETURN 
                    t.title as root_task,
                    dep.id as dependency_id,
                    dep.title as dependency_title,
                    dep.status as dependency_status,
                    dep.priority as dependency_priority,
                    LENGTH(path) as depth
                ORDER BY depth, dep.priority DESC
            """
            
            result = connection.execute(dependencies_query, {
                "task_id": task_id,
                "max_depth": max_depth
            })
            
            dependencies = []
            while result.has_next():
                row = result.get_next()
                dependencies.append({
                    "task_id": row[1],
                    "title": row[2],
                    "status": row[3],
                    "priority": row[4],
                    "depth": row[5]
                })
            
            # Find all dependents (tasks that depend on this task)
            dependents_query = """
                MATCH path = (dependent:Task)-[:DEPENDS_ON*1..$max_depth]->(t:Task {id: $task_id})
                RETURN 
                    dependent.id as dependent_id,
                    dependent.title as dependent_title,
                    dependent.status as dependent_status,
                    dependent.priority as dependent_priority,
                    LENGTH(path) as depth
                ORDER BY depth, dependent.priority DESC
            """
            
            result = connection.execute(dependents_query, {
                "task_id": task_id,
                "max_depth": max_depth
            })
            
            dependents = []
            while result.has_next():
                row = result.get_next()
                dependents.append({
                    "task_id": row[0],
                    "title": row[1],
                    "status": row[2],
                    "priority": row[3],
                    "depth": row[4]
                })
            
            return {
                "task_id": task_id,
                "dependencies": dependencies,
                "dependents": dependents,
                "dependency_count": len(dependencies),
                "dependent_count": len(dependents),
                "analysis_depth": max_depth
            }
            
        except Exception as e:
            logger.error(f"Failed to analyze dependencies for task {task_id}: {e}")
            return {"error": str(e)}
        finally:
            connection.close()
    
    async def detect_circular_dependencies(self) -> List[Dict[str, Any]]:
        """Detect circular dependencies in the task graph."""
        if not self._initialized:
            return []
        
        connection = kuzu.Connection(self.database)
        
        try:
            # Find circular dependencies
            circular_query = """
                MATCH (t1:Task)-[:DEPENDS_ON*1..10]->(t2:Task)-[:DEPENDS_ON*1..10]->(t1)
                RETURN DISTINCT 
                    t1.id as task1_id,
                    t1.title as task1_title,
                    t2.id as task2_id,
                    t2.title as task2_title
            """
            
            result = connection.execute(circular_query)
            
            cycles = []
            while result.has_next():
                row = result.get_next()
                cycles.append({
                    "task1_id": row[0],
                    "task1_title": row[1],
                    "task2_id": row[2],
                    "task2_title": row[3],
                    "type": "circular_dependency"
                })
            
            logger.debug(f"Found {len(cycles)} circular dependencies")
            return cycles
            
        except Exception as e:
            logger.error(f"Failed to detect circular dependencies: {e}")
            return []
        finally:
            connection.close()
    
    async def find_blocking_bottlenecks(self) -> List[Dict[str, Any]]:
        """Find tasks that are blocking multiple other tasks."""
        if not self._initialized:
            return []
        
        connection = kuzu.Connection(self.database)
        
        try:
            bottlenecks_query = """
                MATCH (blocker:Task)-[b:BLOCKS]->(blocked:Task)
                WHERE blocker.status IN ['todo', 'doing']
                  AND blocked.status = 'blocked'
                RETURN 
                    blocker.id as blocking_task_id,
                    blocker.title as blocking_task_title,
                    blocker.assignee as blocking_assignee,
                    blocker.status as blocking_status,
                    COUNT(blocked) as tasks_blocked,
                    COLLECT(blocked.title) as blocked_task_titles
                ORDER BY tasks_blocked DESC
            """
            
            result = connection.execute(bottlenecks_query)
            
            bottlenecks = []
            while result.has_next():
                row = result.get_next()
                bottlenecks.append({
                    "blocking_task_id": row[0],
                    "blocking_task_title": row[1],
                    "blocking_assignee": row[2],
                    "blocking_status": row[3],
                    "tasks_blocked": row[4],
                    "blocked_task_titles": row[5]
                })
            
            logger.debug(f"Found {len(bottlenecks)} blocking bottlenecks")
            return bottlenecks
            
        except Exception as e:
            logger.error(f"Failed to find blocking bottlenecks: {e}")
            return []
        finally:
            connection.close()
    
    async def get_project_hierarchy(self, project_id: str) -> Dict[str, Any]:
        """Get hierarchical structure of tasks in a project."""
        if not self._initialized:
            return {"error": "Service not initialized"}
        
        connection = kuzu.Connection(self.database)
        
        try:
            hierarchy_query = """
                MATCH (p:Project {id: $project_id})<-[:BELONGS_TO]-(root:Task)
                WHERE NOT EXISTS { (parent:Task)-[:HAS_SUBTASK]->(root) }
                OPTIONAL MATCH (root)-[:HAS_SUBTASK*1..3]->(subtask:Task)
                RETURN 
                    p.name as project_name,
                    root.id as root_task_id,
                    root.title as root_task_title,
                    root.status as root_status,
                    COLLECT(DISTINCT subtask.status) as subtask_statuses,
                    COUNT(subtask) as subtask_count
            """
            
            result = connection.execute(hierarchy_query, {"project_id": project_id})
            
            project_hierarchy = {
                "project_id": project_id,
                "root_tasks": []
            }
            
            while result.has_next():
                row = result.get_next()
                project_hierarchy["project_name"] = row[0]
                project_hierarchy["root_tasks"].append({
                    "task_id": row[1],
                    "title": row[2],
                    "status": row[3],
                    "subtask_statuses": row[4],
                    "subtask_count": row[5]
                })
            
            return project_hierarchy
            
        except Exception as e:
            logger.error(f"Failed to get project hierarchy for {project_id}: {e}")
            return {"error": str(e)}
        finally:
            connection.close()
    
    async def get_role_workload_analysis(self) -> List[Dict[str, Any]]:
        """Analyze workload distribution across roles."""
        if not self._initialized:
            return []
        
        connection = kuzu.Connection(self.database)
        
        try:
            workload_query = """
                MATCH (r:Role)<-[a:ASSIGNED_TO]-(t:Task)
                WHERE t.status IN ['todo', 'doing']
                RETURN 
                    r.name as role_name,
                    r.display_name as role_display,
                    COUNT(t) as active_tasks,
                    COLLECT(DISTINCT t.priority) as task_priorities,
                    AVG(CASE t.priority 
                        WHEN 'critical' THEN 5
                        WHEN 'high' THEN 4  
                        WHEN 'normal' THEN 3
                        WHEN 'low' THEN 2
                        WHEN 'someday' THEN 1
                        ELSE 3 END) as avg_priority_score
                ORDER BY avg_priority_score DESC
            """
            
            result = connection.execute(workload_query)
            
            workload_analysis = []
            while result.has_next():
                row = result.get_next()
                workload_analysis.append({
                    "role_name": row[0],
                    "role_display": row[1],
                    "active_tasks": row[2],
                    "task_priorities": row[3],
                    "avg_priority_score": row[4]
                })
            
            return workload_analysis
            
        except Exception as e:
            logger.error(f"Failed to analyze role workload: {e}")
            return []
        finally:
            connection.close()
    
    async def get_graph_statistics(self) -> Dict[str, Any]:
        """Get statistics about the graph database."""
        if not self._initialized:
            return {"error": "Service not initialized"}
        
        connection = kuzu.Connection(self.database)
        
        try:
            stats = {}
            
            # Node counts
            node_types = ["Task", "Project", "Role", "User", "Artifact", "Milestone"]
            for node_type in node_types:
                count_query = f"MATCH (n:{node_type}) RETURN COUNT(n) as count"
                result = connection.execute(count_query)
                row = result.get_next()
                stats[f"{node_type.lower()}_count"] = row[0]
            
            # Relationship counts
            relationship_types = ["HAS_SUBTASK", "DEPENDS_ON", "BLOCKS", "ASSIGNED_TO", "BELONGS_TO"]
            for rel_type in relationship_types:
                count_query = f"MATCH ()-[r:{rel_type}]-() RETURN COUNT(r) as count"
                result = connection.execute(count_query)
                row = result.get_next()
                stats[f"{rel_type.lower()}_count"] = row[0]
            
            return stats
            
        except Exception as e:
            logger.error(f"Failed to get graph statistics: {e}")
            return {"error": str(e)}
        finally:
            connection.close()
    
    async def cleanup(self) -> None:
        """Clean up KuzuDB resources."""
        self.database = None
        self._initialized = False
        logger.info("KuzuDB service cleaned up")