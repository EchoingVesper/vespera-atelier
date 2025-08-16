"""
SQLite implementation of TaskRepository.

This module provides a concrete SQLite implementation of the TaskRepository
interface defined in the domain layer.
"""

import json
import logging
import sqlite3
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

from ....domain.repositories.task_repository import TaskRepository
from ..connection_manager import DatabaseConnectionManager

logger = logging.getLogger(__name__)


class SQLiteTaskRepository(TaskRepository):
    """SQLite implementation of the TaskRepository interface."""

    def __init__(self, connection_manager: DatabaseConnectionManager):
        """
        Initialize the SQLite task repository.

        Args:
            connection_manager: Database connection manager instance
        """
        self.connection_manager = connection_manager
        self._ensure_tables()

    def _ensure_tables(self):
        """Ensure required tables exist."""
        with self.connection_manager.transaction() as conn:
            # Create tasks table
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    session_id TEXT,
                    parent_task_id TEXT,
                    type TEXT NOT NULL,
                    status TEXT NOT NULL,
                    title TEXT,
                    description TEXT,
                    metadata TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    completed_at TEXT,
                    FOREIGN KEY (parent_task_id) REFERENCES tasks(id)
                )
            """
            )

            # Create artifacts table
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS task_artifacts (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL,
                    type TEXT NOT NULL,
                    name TEXT,
                    content TEXT,
                    metadata TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
                )
            """
            )

            # Create dependencies table
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS task_dependencies (
                    task_id TEXT NOT NULL,
                    dependency_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY (task_id, dependency_id),
                    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                    FOREIGN KEY (dependency_id) REFERENCES tasks(id) ON DELETE CASCADE
                )
            """
            )

            # Create indexes
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_tasks_session ON tasks(session_id)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id)"
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)")
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_artifacts_task ON task_artifacts(task_id)"
            )

    def _serialize_datetime(self, dt):
        """Safely serialize datetime objects."""
        if dt is None:
            return None
        if isinstance(dt, str):
            return dt  # Already a string
        if hasattr(dt, 'isoformat'):
            return dt.isoformat()
        return str(dt)

    def create_task(self, task_data: Dict[str, Any]) -> str:
        """Create a new task."""
        task_id = task_data.get("id", str(uuid.uuid4()))
        now = datetime.utcnow().isoformat()

        with self.connection_manager.transaction() as conn:
            conn.execute(
                """
                INSERT INTO tasks (
                    id, session_id, parent_task_id, type, status,
                    title, description, metadata, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    task_id,
                    task_data.get("session_id"),
                    task_data.get("parent_task_id"),
                    task_data.get("type", "generic"),
                    task_data.get("status", "pending"),
                    task_data.get("title"),
                    task_data.get("description"),
                    json.dumps(task_data.get("metadata", {})),
                    now,
                    now,
                ),
            )

        return task_id

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a task by ID."""
        row = self.connection_manager.execute_one(
            "SELECT * FROM tasks WHERE id = ?", (task_id,)
        )

        if row:
            task = dict(row)
            task["metadata"] = json.loads(task["metadata"]) if task["metadata"] else {}
            return task
        return None

    def update_task(self, task_id: str, updates: Dict[str, Any]) -> bool:
        """Update an existing task."""
        # Build update query dynamically
        allowed_fields = {"title", "description", "status", "metadata", "completed_at"}
        update_fields = []
        values = []

        for field, value in updates.items():
            if field in allowed_fields:
                update_fields.append(f"{field} = ?")
                if field == "metadata":
                    values.append(json.dumps(value))
                else:
                    values.append(value)

        if not update_fields:
            return False

        # Always update updated_at
        update_fields.append("updated_at = ?")
        values.append(datetime.utcnow().isoformat())
        values.append(task_id)

        query = f"UPDATE tasks SET {', '.join(update_fields)} WHERE id = ?"

        with self.connection_manager.transaction() as conn:
            cursor = conn.execute(query, values)
            return cursor.rowcount > 0

    def delete_task(self, task_id: str) -> bool:
        """Delete a task."""
        with self.connection_manager.transaction() as conn:
            cursor = conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
            return cursor.rowcount > 0

    def list_tasks(
        self,
        session_id: Optional[str] = None,
        parent_task_id: Optional[str] = None,
        status: Optional[Union[str, List[str]]] = None,
        specialist_type: Optional[Union[str, List[str]]] = None,
        complexity: Optional[Union[str, List[str]]] = None,
        task_type: Optional[Union[str, List[str]]] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """List tasks with optional filtering including array support."""
        query = "SELECT * FROM tasks WHERE 1=1"
        params = []

        if session_id:
            query += " AND session_id = ?"
            params.append(session_id)

        if parent_task_id:
            query += " AND parent_task_id = ?"
            params.append(parent_task_id)

        # Handle status filter (can be single value or list)
        if status:
            if isinstance(status, list):
                placeholders = ",".join("?" * len(status))
                query += f" AND status IN ({placeholders})"
                params.extend(status)
            else:
                query += " AND status = ?"
                params.append(status)
        
        # Handle filters that are stored in metadata JSON
        # Note: SQLite JSON functions require JSON1 extension
        if specialist_type:
            if isinstance(specialist_type, list):
                conditions = []
                for st in specialist_type:
                    conditions.append("json_extract(metadata, '$.specialist_type') = ?")
                    params.append(st)
                query += f" AND ({' OR '.join(conditions)})"
            else:
                query += " AND json_extract(metadata, '$.specialist_type') = ?"
                params.append(specialist_type)
        
        if complexity:
            if isinstance(complexity, list):
                conditions = []
                for c in complexity:
                    conditions.append("json_extract(metadata, '$.complexity') = ?")
                    params.append(c)
                query += f" AND ({' OR '.join(conditions)})"
            else:
                query += " AND json_extract(metadata, '$.complexity') = ?"
                params.append(complexity)
        
        if task_type:
            if isinstance(task_type, list):
                placeholders = ",".join("?" * len(task_type))
                query += f" AND type IN ({placeholders})"
                params.extend(task_type)
            else:
                query += " AND type = ?"
                params.append(task_type)

        query += " ORDER BY created_at DESC"

        if limit:
            query += " LIMIT ?"
            params.append(limit)

        if offset:
            query += " OFFSET ?"
            params.append(offset)

        rows = self.connection_manager.execute(query, params)

        tasks = []
        for row in rows:
            task = dict(row)
            task["metadata"] = json.loads(task["metadata"]) if task["metadata"] else {}
            
            # Fix datetime fields in results
            task["created_at"] = self._serialize_datetime(task.get("created_at"))
            task["updated_at"] = self._serialize_datetime(task.get("updated_at"))
            task["completed_at"] = self._serialize_datetime(task.get("completed_at"))
            
            tasks.append(task)

        return tasks

    def get_subtasks(self, parent_task_id: str) -> List[Dict[str, Any]]:
        """Get all subtasks of a parent task."""
        return self.list_tasks(parent_task_id=parent_task_id)

    def update_task_status(self, task_id: str, status: str) -> bool:
        """Update the status of a task."""
        updates = {"status": status}
        if status in ("completed", "failed", "cancelled"):
            updates["completed_at"] = datetime.utcnow().isoformat()
        return self.update_task(task_id, updates)

    def add_task_artifact(self, task_id: str, artifact: Dict[str, Any]) -> bool:
        """Add an artifact to a task."""
        artifact_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()

        with self.connection_manager.transaction() as conn:
            conn.execute(
                """
                INSERT INTO task_artifacts (
                    id, task_id, type, name, content, metadata, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    artifact_id,
                    task_id,
                    artifact.get("type", "generic"),
                    artifact.get("name"),
                    artifact.get("content"),
                    json.dumps(artifact.get("metadata", {})),
                    now,
                ),
            )

        return True

    def get_task_artifacts(self, task_id: str) -> List[Dict[str, Any]]:
        """Get all artifacts for a task."""
        rows = self.connection_manager.execute(
            "SELECT * FROM task_artifacts WHERE task_id = ? ORDER BY created_at",
            (task_id,),
        )

        artifacts = []
        for row in rows:
            artifact = dict(row)
            artifact["metadata"] = (
                json.loads(artifact["metadata"]) if artifact["metadata"] else {}
            )
            artifacts.append(artifact)

        return artifacts

    def search_tasks(
        self, query: str, fields: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Search tasks by text query."""
        if not fields:
            fields = ["title", "description"]

        # Build search query
        search_conditions = [f"{field} LIKE ?" for field in fields]
        search_query = f"SELECT * FROM tasks WHERE {' OR '.join(search_conditions)}"
        search_pattern = f"%{query}%"
        params = [search_pattern] * len(fields)

        rows = self.connection_manager.execute(search_query, params)

        tasks = []
        for row in rows:
            task = dict(row)
            task["metadata"] = json.loads(task["metadata"]) if task["metadata"] else {}
            tasks.append(task)

        return tasks

    def get_task_dependencies(self, task_id: str) -> List[str]:
        """Get task IDs that this task depends on."""
        rows = self.connection_manager.execute(
            "SELECT dependency_id FROM task_dependencies WHERE task_id = ?", (task_id,)
        )
        return [row["dependency_id"] for row in rows]

    def add_task_dependency(self, task_id: str, dependency_id: str) -> bool:
        """Add a dependency between tasks."""
        now = datetime.utcnow().isoformat()

        try:
            with self.connection_manager.transaction() as conn:
                conn.execute(
                    """
                    INSERT INTO task_dependencies (task_id, dependency_id, created_at)
                    VALUES (?, ?, ?)
                """,
                    (task_id, dependency_id, now),
                )
            return True
        except sqlite3.IntegrityError:
            # Dependency already exists or invalid task IDs
            return False

    def cleanup_old_tasks(
        self, older_than: datetime, exclude_sessions: Optional[List[str]] = None
    ) -> int:
        """Clean up tasks older than a specified date."""
        query = "DELETE FROM tasks WHERE created_at < ?"
        params = [older_than.isoformat()]

        if exclude_sessions:
            placeholders = ",".join("?" * len(exclude_sessions))
            query += f" AND session_id NOT IN ({placeholders})"
            params.extend(exclude_sessions)

        with self.connection_manager.transaction() as conn:
            cursor = conn.execute(query, params)
            return cursor.rowcount

    async def query_tasks(self, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Query tasks with filters - wraps list_tasks for compatibility."""
        # Extract filter parameters
        session_id = filters.get("session_id")
        parent_task_id = filters.get("parent_task_id")
        status = filters.get("status")
        specialist_type = filters.get("specialist_type")
        complexity = filters.get("complexity")
        task_type = filters.get("task_type")
        limit = filters.get("limit")
        offset = filters.get("offset")

        # Handle array parameters - convert to list if single value
        if status and not isinstance(status, list):
            status = [status]
        if specialist_type and not isinstance(specialist_type, list):
            specialist_type = [specialist_type]
        if complexity and not isinstance(complexity, list):
            complexity = [complexity]
        if task_type and not isinstance(task_type, list):
            task_type = [task_type]

        # Call enhanced list_tasks method
        return self.list_tasks(
            session_id=session_id,
            parent_task_id=parent_task_id,
            status=status,
            specialist_type=specialist_type,
            complexity=complexity,
            task_type=task_type,
            limit=limit,
            offset=offset,
        )

    def get_task_metrics(self, session_id: Optional[str] = None) -> Dict[str, Any]:
        """Get metrics about tasks."""
        base_query = "FROM tasks"
        params = []

        if session_id:
            base_query += " WHERE session_id = ?"
            params.append(session_id)

        # Get count by status
        status_query = f"""
            SELECT status, COUNT(*) as count 
            {base_query}
            GROUP BY status
        """

        if params:
            status_rows = self.connection_manager.execute(status_query, params)
        else:
            status_rows = self.connection_manager.execute(status_query)

        status_counts = {row["status"]: row["count"] for row in status_rows}

        # Get total count
        total_query = f"SELECT COUNT(*) as count {base_query}"
        if params:
            total_row = self.connection_manager.execute_one(total_query, params)
        else:
            total_row = self.connection_manager.execute_one(total_query)

        return {
            "total_count": total_row["count"] if total_row else 0,
            "status_breakdown": status_counts,
            "session_id": session_id,
        }
