"""
Task Service for Hierarchical Task Management System

Core business logic for task operations inspired by Archon's TaskService with
enhanced hierarchical capabilities and role integration.
"""

import logging
from typing import Dict, List, Optional, Set, Tuple, Any
from datetime import datetime, timedelta
import sqlite3
import json
from pathlib import Path

from .models import Task, TaskStatus, TaskPriority, TaskRelation, TaskMetadata, TaskExecution
from vector import VectorService

logger = logging.getLogger(__name__)


class TaskService:
    """
    Service class for hierarchical task operations.
    
    Provides comprehensive task management with automatic relationship tracking,
    dependency resolution, and role-based execution coordination.
    """
    
    VALID_STATUSES = [status.value for status in TaskStatus]
    VALID_PRIORITIES = [priority.value for priority in TaskPriority]
    
    def __init__(self, db_path: Optional[Path] = None, vector_service: Optional[VectorService] = None):
        """Initialize with optional database path and vector service."""
        self.db_path = db_path or Path.cwd() / ".vespera_scriptorium" / "tasks.db"
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_database()
        
        # Initialize vector service for semantic search
        if vector_service:
            self.vector_service = vector_service
        else:
            vector_dir = self.db_path.parent / "embeddings"
            self.vector_service = VectorService(persist_directory=vector_dir)
        
        logger.info("TaskService initialized with vector database support")
    
    def _init_database(self) -> None:
        """Initialize the task database with schema."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Tasks table with comprehensive fields
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT,
                    parent_id TEXT,
                    status TEXT NOT NULL,
                    priority TEXT NOT NULL,
                    task_order INTEGER DEFAULT 0,
                    project_id TEXT,
                    feature TEXT,
                    milestone TEXT,
                    assignee TEXT DEFAULT 'User',
                    creator TEXT DEFAULT 'System',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    due_date TEXT,
                    started_at TEXT,
                    completed_at TEXT,
                    metadata_json TEXT,
                    execution_json TEXT,
                    FOREIGN KEY (parent_id) REFERENCES tasks (id)
                )
            """)
            
            # Task relationships table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS task_relationships (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_task_id TEXT NOT NULL,
                    target_task_id TEXT NOT NULL,
                    relationship_type TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (source_task_id) REFERENCES tasks (id),
                    FOREIGN KEY (target_task_id) REFERENCES tasks (id),
                    UNIQUE(source_task_id, target_task_id, relationship_type)
                )
            """)
            
            # Indexes for performance
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks (priority)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks (parent_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks (project_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks (assignee)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_relationships_source ON task_relationships (source_task_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_relationships_target ON task_relationships (target_task_id)")
            
            conn.commit()
            logger.info(f"Task database initialized at {self.db_path}")
    
    # Task CRUD operations
    async def create_task(self,
                         title: str,
                         description: str = "",
                         parent_id: Optional[str] = None,
                         priority: TaskPriority = TaskPriority.NORMAL,
                         project_id: Optional[str] = None,
                         feature: Optional[str] = None,
                         assignee: str = "User",
                         role_name: Optional[str] = None,
                         due_date: Optional[datetime] = None,
                         metadata: Optional[TaskMetadata] = None,
                         task_order: Optional[int] = None) -> Tuple[bool, Dict[str, Any]]:
        """
        Create a new task with automatic ordering and relationship management.
        
        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Validate inputs
            if not title or not title.strip():
                return False, {"error": "Task title is required"}
            
            # Create task object
            task = Task(
                title=title.strip(),
                description=description.strip(),
                parent_id=parent_id,
                priority=priority,
                project_id=project_id,
                feature=feature,
                assignee=assignee,
                due_date=due_date,
                metadata=metadata or TaskMetadata()
            )
            
            # Assign role if provided
            if role_name:
                task.assign_role(role_name)
            
            # Handle task ordering
            if task_order is not None:
                task.task_order = task_order
                # Reorder existing tasks if necessary
                await self._reorder_tasks_on_insert(task, task_order)
            else:
                # Auto-assign order as last in priority group
                task.task_order = await self._get_next_task_order(task.status, task.priority)
            
            # Store in database
            success = await self._save_task_to_db(task)
            if not success:
                return False, {"error": "Failed to save task to database"}
            
            # Update parent-child relationship
            if parent_id:
                parent_updated = await self._add_parent_child_relationship(parent_id, task.id)
                if not parent_updated:
                    logger.warning(f"Failed to update parent relationship for task {task.id}")
            
            # Add to vector database for semantic search
            try:
                # Filter out None values for Chroma compatibility
                metadata = {}
                if task.status:
                    metadata['status'] = task.status.value
                if task.priority:
                    metadata['priority'] = task.priority.value
                if task.project_id:
                    metadata['project_id'] = task.project_id
                if task.feature:
                    metadata['feature'] = task.feature
                if task.assignee:
                    metadata['assignee'] = task.assignee
                if task.created_at:
                    metadata['created_at'] = task.created_at.isoformat()
                
                await self.vector_service.embed_task(
                    task_id=task.id,
                    title=task.title,
                    description=task.description,
                    metadata=metadata
                )
                # Update triple DB coordination
                task.triple_db.embedding_id = task.id
                task.triple_db.last_embedded = datetime.utcnow()
                task.triple_db.chroma_synced = True
                logger.debug(f"Task {task.id} embedded in vector database")
            except Exception as e:
                logger.warning(f"Failed to embed task {task.id} in vector database: {e}")
                # Don't fail the entire operation for vector embedding issues
            
            logger.info(f"Created task '{task.title}' with ID {task.id}")
            return True, {"task": task.to_dict()}
            
        except Exception as e:
            logger.error(f"Failed to create task: {e}")
            return False, {"error": str(e)}
    
    async def get_task(self, task_id: str) -> Optional[Task]:
        """Retrieve a task by ID."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
                row = cursor.fetchone()
                
                if not row:
                    return None
                
                task = self._row_to_task(row)
                
                # Load relationships
                await self._load_task_relationships(task)
                
                return task
                
        except Exception as e:
            logger.error(f"Failed to get task {task_id}: {e}")
            return None
    
    async def update_task(self,
                         task_id: str,
                         updates: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
        """Update task fields."""
        try:
            task = await self.get_task(task_id)
            if not task:
                return False, {"error": f"Task {task_id} not found"}
            
            # Apply updates
            for field, value in updates.items():
                if hasattr(task, field):
                    # Handle special field types
                    if field == "status" and isinstance(value, str):
                        setattr(task, field, TaskStatus(value))
                    elif field == "priority" and isinstance(value, str):
                        setattr(task, field, TaskPriority(value))
                    elif field == "execution" and isinstance(value, dict):
                        # Update execution fields individually
                        for exec_field, exec_value in value.items():
                            if hasattr(task.execution, exec_field):
                                setattr(task.execution, exec_field, exec_value)
                    elif field == "metadata" and isinstance(value, dict):
                        # Update metadata fields individually
                        for meta_field, meta_value in value.items():
                            if hasattr(task.metadata, meta_field):
                                setattr(task.metadata, meta_field, meta_value)
                    else:
                        setattr(task, field, value)
            
            task.updated_at = datetime.now()
            
            # Handle status changes
            if "status" in updates:
                new_status = TaskStatus(updates["status"])
                task.update_status(new_status)
            
            # Save to database
            success = await self._save_task_to_db(task)
            if success:
                logger.info(f"Updated task {task_id}")
                return True, {"task": task.to_dict()}
            else:
                return False, {"error": "Failed to save task updates"}
                
        except Exception as e:
            logger.error(f"Failed to update task {task_id}: {e}")
            return False, {"error": str(e)}
    
    async def delete_task(self, task_id: str, 
                         recursive: bool = False) -> Tuple[bool, Dict[str, Any]]:
        """
        Delete a task, optionally with all children.
        
        Args:
            task_id: Task to delete
            recursive: If True, delete all child tasks as well
        """
        try:
            task = await self.get_task(task_id)
            if not task:
                return False, {"error": f"Task {task_id} not found"}
            
            deleted_tasks = []
            
            # Handle child tasks
            if task.has_children():
                if not recursive:
                    return False, {
                        "error": f"Task has {len(task.child_ids)} children. Use recursive=True to delete all."
                    }
                
                # Delete children first
                for child_id in list(task.child_ids):
                    child_success, child_result = await self.delete_task(child_id, recursive=True)
                    if child_success:
                        deleted_tasks.extend(child_result.get("deleted_tasks", [child_id]))
            
            # Delete relationships
            await self._delete_task_relationships(task_id)
            
            # Delete the task itself
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
                conn.commit()
            
            deleted_tasks.append(task_id)
            
            # Update parent task's child list
            if task.parent_id:
                await self._remove_parent_child_relationship(task.parent_id, task_id)
            
            logger.info(f"Deleted task {task_id} and {len(deleted_tasks)} total tasks")
            return True, {"deleted_tasks": deleted_tasks}
            
        except Exception as e:
            logger.error(f"Failed to delete task {task_id}: {e}")
            return False, {"error": str(e)}
    
    # Task querying and filtering
    async def list_tasks(self,
                        status: Optional[TaskStatus] = None,
                        priority: Optional[TaskPriority] = None,
                        project_id: Optional[str] = None,
                        assignee: Optional[str] = None,
                        parent_id: Optional[str] = None,
                        include_children: bool = True,
                        limit: int = 100,
                        offset: int = 0) -> List[Task]:
        """List tasks with filtering and pagination."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Build query
                conditions = []
                params = []
                
                if status:
                    conditions.append("status = ?")
                    params.append(status.value)
                
                if priority:
                    conditions.append("priority = ?")
                    params.append(priority.value)
                
                if project_id:
                    conditions.append("project_id = ?")
                    params.append(project_id)
                
                if assignee:
                    conditions.append("assignee = ?")
                    params.append(assignee)
                
                if parent_id is not None:
                    conditions.append("parent_id = ?" if parent_id else "parent_id IS NULL")
                    if parent_id:
                        params.append(parent_id)
                
                where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
                
                query = f"""
                    SELECT * FROM tasks 
                    {where_clause}
                    ORDER BY priority DESC, task_order ASC, created_at ASC
                    LIMIT ? OFFSET ?
                """
                params.extend([limit, offset])
                
                cursor.execute(query, params)
                rows = cursor.fetchall()
                
                tasks = []
                for row in rows:
                    task = self._row_to_task(row)
                    if include_children:
                        await self._load_task_relationships(task)
                    tasks.append(task)
                
                return tasks
                
        except Exception as e:
            logger.error(f"Failed to list tasks: {e}")
            return []
    
    # Hierarchical operations
    async def get_task_tree(self, root_task_id: str) -> Optional[Dict[str, Any]]:
        """Get complete task tree starting from root."""
        try:
            root_task = await self.get_task(root_task_id)
            if not root_task:
                return None
            
            async def build_tree(task: Task) -> Dict[str, Any]:
                tree_node = task.to_dict()
                tree_node["children"] = []
                
                for child_id in task.child_ids:
                    child_task = await self.get_task(child_id)
                    if child_task:
                        child_tree = await build_tree(child_task)
                        tree_node["children"].append(child_tree)
                
                return tree_node
            
            return await build_tree(root_task)
            
        except Exception as e:
            logger.error(f"Failed to get task tree for {root_task_id}: {e}")
            return None
    
    async def get_root_tasks(self, project_id: Optional[str] = None) -> List[Task]:
        """Get all root tasks (tasks without parents)."""
        return await self.list_tasks(parent_id=None, project_id=project_id)
    
    async def get_task_children(self, parent_id: str, recursive: bool = False) -> List[Task]:
        """Get all children of a task, optionally recursive."""
        try:
            children = await self.list_tasks(parent_id=parent_id)
            
            if recursive:
                all_descendants = list(children)
                for child in children:
                    descendants = await self.get_task_children(child.id, recursive=True)
                    all_descendants.extend(descendants)
                return all_descendants
            
            return children
            
        except Exception as e:
            logger.error(f"Failed to get children for task {parent_id}: {e}")
            return []
    
    # Task relationship management
    async def add_task_relationship(self,
                                  source_task_id: str,
                                  target_task_id: str,
                                  relationship: TaskRelation) -> bool:
        """Add a relationship between two tasks."""
        try:
            if source_task_id == target_task_id:
                logger.warning("Cannot create self-referential task relationship")
                return False
            
            # Check if tasks exist
            source_task = await self.get_task(source_task_id)
            target_task = await self.get_task(target_task_id)
            
            if not source_task or not target_task:
                logger.error("One or both tasks not found for relationship")
                return False
            
            # Add to database
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT OR IGNORE INTO task_relationships 
                    (source_task_id, target_task_id, relationship_type, created_at)
                    VALUES (?, ?, ?, ?)
                """, (source_task_id, target_task_id, relationship.value, datetime.now().isoformat()))
                conn.commit()
            
            # Update task objects
            source_task.add_relation(relationship, target_task_id)
            await self._save_task_to_db(source_task)
            
            logger.info(f"Added {relationship.value} relationship: {source_task_id} -> {target_task_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to add task relationship: {e}")
            return False
    
    async def remove_task_relationship(self,
                                     source_task_id: str,
                                     target_task_id: str,
                                     relationship: TaskRelation) -> bool:
        """Remove a relationship between two tasks."""
        try:
            # Remove from database
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    DELETE FROM task_relationships 
                    WHERE source_task_id = ? AND target_task_id = ? AND relationship_type = ?
                """, (source_task_id, target_task_id, relationship.value))
                conn.commit()
            
            # Update source task object
            source_task = await self.get_task(source_task_id)
            if source_task:
                source_task.remove_relation(relationship, target_task_id)
                await self._save_task_to_db(source_task)
            
            logger.info(f"Removed {relationship.value} relationship: {source_task_id} -> {target_task_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to remove task relationship: {e}")
            return False
    
    # Task ordering and reordering (Archon-inspired)
    async def reorder_task(self, task_id: str, new_order: int) -> bool:
        """Reorder a task within its status/priority group."""
        try:
            task = await self.get_task(task_id)
            if not task:
                return False
            
            # Get current order
            old_order = task.task_order
            
            if old_order == new_order:
                return True  # No change needed
            
            # Update other tasks in the same group
            await self._reorder_tasks_on_move(task, old_order, new_order)
            
            # Update the task itself
            task.task_order = new_order
            task.updated_at = datetime.now()
            await self._save_task_to_db(task)
            
            logger.info(f"Reordered task {task_id} from {old_order} to {new_order}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to reorder task {task_id}: {e}")
            return False
    
    # Helper methods
    async def _save_task_to_db(self, task: Task) -> bool:
        """Save task to database."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Serialize complex fields
                metadata_json = json.dumps(task.metadata.__dict__)
                execution_json = json.dumps(task.execution.__dict__, default=str)
                
                cursor.execute("""
                    INSERT OR REPLACE INTO tasks (
                        id, title, description, parent_id, status, priority, task_order,
                        project_id, feature, milestone, assignee, creator,
                        created_at, updated_at, due_date, started_at, completed_at,
                        metadata_json, execution_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    task.id, task.title, task.description, task.parent_id,
                    task.status.value, task.priority.value, task.task_order,
                    task.project_id, task.feature, task.milestone, task.assignee, task.creator,
                    task.created_at.isoformat(), task.updated_at.isoformat(),
                    task.due_date.isoformat() if task.due_date else None,
                    task.started_at.isoformat() if task.started_at else None,
                    task.completed_at.isoformat() if task.completed_at else None,
                    metadata_json, execution_json
                ))
                
                conn.commit()
                return True
                
        except Exception as e:
            logger.error(f"Failed to save task to database: {e}")
            return False
    
    def _row_to_task(self, row: tuple) -> Task:
        """Convert database row to Task object."""
        # Handle both old (19 columns) and new (31 columns) schema
        if len(row) == 19:
            # Old schema
            (id, title, description, parent_id, status, priority, task_order,
             project_id, feature, milestone, assignee, creator,
             created_at, updated_at, due_date, started_at, completed_at,
             metadata_json, execution_json) = row
            
            # Initialize triple-DB fields with defaults
            triple_db_dict = {
                "embedding_id": None,
                "content_hash": None,
                "last_embedded": None,
                "embedding_version": 1,
                "graph_node_id": None,
                "last_graph_sync": None,
                "graph_version": 1,
                "sync_status": "pending",
                "last_indexed": None,
                "sync_error": None,
                "chroma_synced": False,
                "kuzu_synced": False
            }
        else:
            # New schema with triple-DB fields
            (id, title, description, parent_id, status, priority, task_order,
             project_id, feature, milestone, assignee, creator,
             created_at, updated_at, due_date, started_at, completed_at,
             metadata_json, execution_json,
             embedding_id, content_hash, last_embedded, embedding_version,
             graph_node_id, last_graph_sync, graph_version,
             sync_status, last_indexed, sync_error, chroma_synced, kuzu_synced) = row
            
            triple_db_dict = {
                "embedding_id": embedding_id,
                "content_hash": content_hash,
                "last_embedded": datetime.fromisoformat(last_embedded) if last_embedded else None,
                "embedding_version": embedding_version or 1,
                "graph_node_id": graph_node_id,
                "last_graph_sync": datetime.fromisoformat(last_graph_sync) if last_graph_sync else None,
                "graph_version": graph_version or 1,
                "sync_status": sync_status or "pending",
                "last_indexed": datetime.fromisoformat(last_indexed) if last_indexed else None,
                "sync_error": sync_error,
                "chroma_synced": bool(chroma_synced),
                "kuzu_synced": bool(kuzu_synced)
            }
        
        # Parse datetime fields
        created_at = datetime.fromisoformat(created_at)
        updated_at = datetime.fromisoformat(updated_at)
        due_date = datetime.fromisoformat(due_date) if due_date else None
        started_at = datetime.fromisoformat(started_at) if started_at else None
        completed_at = datetime.fromisoformat(completed_at) if completed_at else None
        
        # Parse complex fields
        metadata_dict = json.loads(metadata_json) if metadata_json else {}
        execution_dict = json.loads(execution_json) if execution_json else {}
        
        # Create objects
        metadata = TaskMetadata(**metadata_dict)
        execution = TaskExecution(**execution_dict)
        
        # Create triple_db coordination object
        from tasks.models import TripleDBCoordination
        triple_db = TripleDBCoordination(**triple_db_dict)
        
        task = Task(
            id=id,
            title=title,
            description=description or "",
            parent_id=parent_id,
            status=TaskStatus(status),
            priority=TaskPriority(priority),
            task_order=task_order,
            project_id=project_id,
            feature=feature,
            milestone=milestone,
            assignee=assignee,
            creator=creator,
            created_at=created_at,
            updated_at=updated_at,
            due_date=due_date,
            started_at=started_at,
            completed_at=completed_at,
            metadata=metadata,
            execution=execution,
            triple_db=triple_db
        )
        
        return task
    
    async def _load_task_relationships(self, task: Task) -> None:
        """Load task relationships from database."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Load relationships where this task is the source
                cursor.execute("""
                    SELECT target_task_id, relationship_type 
                    FROM task_relationships 
                    WHERE source_task_id = ?
                """, (task.id,))
                
                for target_id, relationship_type in cursor.fetchall():
                    relation = TaskRelation(relationship_type)
                    task.add_relation(relation, target_id)
                
                # Load child relationships from tasks table
                cursor.execute("SELECT id FROM tasks WHERE parent_id = ?", (task.id,))
                child_ids = [row[0] for row in cursor.fetchall()]
                task.child_ids = set(child_ids)
                
        except Exception as e:
            logger.error(f"Failed to load relationships for task {task.id}: {e}")
    
    async def _reorder_tasks_on_insert(self, new_task: Task, insert_order: int) -> None:
        """Reorder existing tasks when inserting at specific position."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Increment task_order for all tasks >= insert_order in same group
                cursor.execute("""
                    UPDATE tasks 
                    SET task_order = task_order + 1, updated_at = ?
                    WHERE status = ? AND priority = ? AND task_order >= ?
                """, (
                    datetime.now().isoformat(),
                    new_task.status.value,
                    new_task.priority.value,
                    insert_order
                ))
                
                conn.commit()
                
        except Exception as e:
            logger.error(f"Failed to reorder tasks on insert: {e}")
    
    async def _reorder_tasks_on_move(self, task: Task, old_order: int, new_order: int) -> None:
        """Reorder tasks when moving a task to new position."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                now = datetime.now().isoformat()
                
                if new_order > old_order:
                    # Moving down - decrease order of tasks in between
                    cursor.execute("""
                        UPDATE tasks 
                        SET task_order = task_order - 1, updated_at = ?
                        WHERE status = ? AND priority = ? 
                        AND task_order > ? AND task_order <= ?
                        AND id != ?
                    """, (now, task.status.value, task.priority.value, old_order, new_order, task.id))
                else:
                    # Moving up - increase order of tasks in between
                    cursor.execute("""
                        UPDATE tasks 
                        SET task_order = task_order + 1, updated_at = ?
                        WHERE status = ? AND priority = ? 
                        AND task_order >= ? AND task_order < ?
                        AND id != ?
                    """, (now, task.status.value, task.priority.value, new_order, old_order, task.id))
                
                conn.commit()
                
        except Exception as e:
            logger.error(f"Failed to reorder tasks on move: {e}")
    
    async def _get_next_task_order(self, status: TaskStatus, priority: TaskPriority) -> int:
        """Get the next task order for a status/priority group."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT MAX(task_order) FROM tasks 
                    WHERE status = ? AND priority = ?
                """, (status.value, priority.value))
                
                result = cursor.fetchone()
                max_order = result[0] if result[0] is not None else -1
                return max_order + 1
                
        except Exception as e:
            logger.error(f"Failed to get next task order: {e}")
            return 0
    
    async def _add_parent_child_relationship(self, parent_id: str, child_id: str) -> bool:
        """Update parent task to include child."""
        try:
            parent_task = await self.get_task(parent_id)
            if parent_task:
                parent_task.add_child(child_id)
                return await self._save_task_to_db(parent_task)
            return False
        except Exception as e:
            logger.error(f"Failed to add parent-child relationship: {e}")
            return False
    
    async def _remove_parent_child_relationship(self, parent_id: str, child_id: str) -> bool:
        """Update parent task to remove child."""
        try:
            parent_task = await self.get_task(parent_id)
            if parent_task:
                parent_task.remove_child(child_id)
                return await self._save_task_to_db(parent_task)
            return False
        except Exception as e:
            logger.error(f"Failed to remove parent-child relationship: {e}")
            return False
    
    async def _delete_task_relationships(self, task_id: str) -> None:
        """Delete all relationships for a task."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    DELETE FROM task_relationships 
                    WHERE source_task_id = ? OR target_task_id = ?
                """, (task_id, task_id))
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to delete relationships for task {task_id}: {e}")
    
    # Vector Database Integration Methods
    
    async def search_tasks_semantic(self, 
                                   query: str, 
                                   limit: int = 10,
                                   filter_metadata: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Search for tasks using semantic similarity via vector database.
        
        Args:
            query: Natural language search query
            limit: Maximum number of results
            filter_metadata: Optional metadata filters
            
        Returns:
            List of matching tasks with similarity scores and full task data
        """
        try:
            # Get semantic matches from vector database
            matches = await self.vector_service.search_tasks(
                query=query, 
                limit=limit, 
                filter_metadata=filter_metadata
            )
            
            # Enrich with full task data from SQLite
            enriched_results = []
            for match in matches:
                task_id = match['id']
                task = await self.get_task(task_id)
                if task:
                    try:
                        enriched_results.append({
                            'task': task.to_dict(),
                            'similarity_score': match['score'],
                            'matched_content': match['content'],
                            'vector_metadata': match['metadata']
                        })
                    except Exception as e:
                        logger.error(f"Failed to convert task {task_id} to dict: {e}")
                        continue
            
            logger.info(f"Semantic search '{query}' returned {len(enriched_results)} results")
            return enriched_results
            
        except Exception as e:
            logger.error(f"Semantic task search failed: {e}")
            return []
    
    async def get_related_tasks(self, task_id: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Find tasks semantically related to the given task.
        
        Args:
            task_id: Source task ID
            limit: Maximum number of related tasks
            
        Returns:
            List of related tasks with similarity scores
        """
        try:
            # Get related tasks from vector database
            related = await self.vector_service.get_related_tasks(task_id, limit)
            
            # Enrich with full task data
            enriched_results = []
            for match in related:
                related_task_id = match['id']
                task = await self.get_task(related_task_id)
                if task:
                    try:
                        enriched_results.append({
                            'task': task.to_dict(),
                            'similarity_score': match['score'],
                            'matched_content': match['content']
                        })
                    except Exception as e:
                        logger.error(f"Failed to convert related task {related_task_id} to dict: {e}")
                        continue
            
            logger.debug(f"Found {len(enriched_results)} related tasks for {task_id}")
            return enriched_results
            
        except Exception as e:
            logger.error(f"Failed to find related tasks: {e}")
            return []
    
    async def get_vector_stats(self) -> Dict[str, Any]:
        """Get vector database statistics and health info."""
        try:
            return await self.vector_service.get_collection_stats()
        except Exception as e:
            logger.error(f"Failed to get vector stats: {e}")
            return {"error": str(e)}