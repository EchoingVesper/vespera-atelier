"""
Task Models for Hierarchical Task Management System

Defines the data structures for hierarchical tasks inspired by Archon's proven
task management patterns with enhanced tree structures, role integration,
and triple-database coordination (SQLite + Chroma + KuzuDB).
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any, Union, Set
from enum import Enum
from datetime import datetime, timedelta
import uuid
import hashlib


class TaskStatus(Enum):
    """Task status progression workflow (Archon-inspired)."""
    TODO = "todo"              # Ready to be worked on
    DOING = "doing"           # Currently in progress
    REVIEW = "review"         # Implementation complete, needs validation
    DONE = "done"             # Completed and validated
    BLOCKED = "blocked"       # Cannot proceed due to dependencies
    CANCELLED = "cancelled"   # No longer needed
    ARCHIVED = "archived"     # Completed but archived for cleanup


class TaskPriority(Enum):
    """Task priority levels for ordering."""
    CRITICAL = "critical"     # Must be done immediately
    HIGH = "high"            # Important, do soon
    NORMAL = "normal"        # Standard priority
    LOW = "low"              # Nice to have
    SOMEDAY = "someday"      # Future consideration


class TaskRelation(Enum):
    """Types of relationships between tasks."""
    PARENT_CHILD = "parent_child"       # Hierarchical relationship
    DEPENDS_ON = "depends_on"           # Dependency relationship
    BLOCKS = "blocks"                   # Blocking relationship
    RELATES_TO = "relates_to"           # General association
    DUPLICATE_OF = "duplicate_of"       # Duplicate task marker


class SyncStatus(Enum):
    """Synchronization status across triple databases."""
    PENDING = "pending"                 # Awaiting synchronization
    SYNCING = "syncing"                # Currently being synchronized
    SYNCED = "synced"                  # Successfully synchronized
    ERROR = "error"                    # Synchronization failed
    PARTIAL = "partial"                # Some databases synced, others failed


@dataclass
class TripleDBCoordination:
    """Triple database coordination metadata for task synchronization."""
    # Chroma Integration
    embedding_id: Optional[str] = None                    # Reference to Chroma document
    content_hash: Optional[str] = None                    # SHA256 of content for change detection
    last_embedded: Optional[datetime] = None              # Last embedding generation time
    embedding_version: int = 1                            # Embedding model version
    
    # KuzuDB Integration
    graph_node_id: Optional[str] = None                   # Reference to KuzuDB node
    last_graph_sync: Optional[datetime] = None            # Last graph synchronization
    graph_version: int = 1                                # Graph schema version
    
    # Synchronization Status
    sync_status: SyncStatus = SyncStatus.PENDING          # Overall sync status
    last_indexed: Optional[datetime] = None               # Last full indexing across all DBs
    sync_error: Optional[str] = None                      # Error message if sync failed
    
    # Sync flags for individual databases
    chroma_synced: bool = False
    kuzu_synced: bool = False
    
    def generate_content_hash(self, task_content: str) -> str:
        """Generate SHA256 hash of task content for change detection."""
        return hashlib.sha256(task_content.encode()).hexdigest()
    
    def mark_content_changed(self, task_content: str) -> None:
        """Mark content as changed and update hash."""
        self.content_hash = self.generate_content_hash(task_content)
        self.sync_status = SyncStatus.PENDING
        self.chroma_synced = False
        # Note: graph sync might not be needed for pure content changes
    
    def mark_structure_changed(self) -> None:
        """Mark task structure as changed (affects graph)."""
        self.sync_status = SyncStatus.PENDING
        self.kuzu_synced = False
    
    def mark_chroma_synced(self, embedding_id: str) -> None:
        """Mark as successfully synced to Chroma."""
        self.embedding_id = embedding_id
        self.last_embedded = datetime.now()
        self.chroma_synced = True
        self._update_overall_sync_status()
    
    def mark_kuzu_synced(self, node_id: str) -> None:
        """Mark as successfully synced to KuzuDB."""
        self.graph_node_id = node_id
        self.last_graph_sync = datetime.now()
        self.kuzu_synced = True
        self._update_overall_sync_status()
    
    def mark_sync_error(self, error_message: str) -> None:
        """Mark synchronization as failed."""
        self.sync_status = SyncStatus.ERROR
        self.sync_error = error_message
    
    def _update_overall_sync_status(self) -> None:
        """Update overall sync status based on individual database sync states."""
        if self.chroma_synced and self.kuzu_synced:
            self.sync_status = SyncStatus.SYNCED
            self.last_indexed = datetime.now()
            self.sync_error = None
        elif self.chroma_synced or self.kuzu_synced:
            self.sync_status = SyncStatus.PARTIAL
        # Otherwise keep current status (PENDING, SYNCING, or ERROR)


@dataclass
class TaskMetadata:
    """Metadata for enhanced task tracking."""
    tags: List[str] = field(default_factory=list)
    labels: Dict[str, str] = field(default_factory=dict)
    estimated_effort: Optional[str] = None  # e.g., "2 hours", "1 day"
    actual_effort: Optional[str] = None
    complexity: str = "moderate"  # trivial, simple, moderate, complex, very_complex
    source_references: List[str] = field(default_factory=list)  # Links to docs, issues, etc.
    code_references: List[str] = field(default_factory=list)    # File paths, functions
    
    def add_tag(self, tag: str) -> None:
        """Add a tag if not already present."""
        if tag not in self.tags:
            self.tags.append(tag)
    
    def remove_tag(self, tag: str) -> None:
        """Remove a tag if present."""
        if tag in self.tags:
            self.tags.remove(tag)
    
    def set_label(self, key: str, value: str) -> None:
        """Set a key-value label."""
        self.labels[key] = value
    
    def get_label(self, key: str, default: str = None) -> Optional[str]:
        """Get a label value."""
        return self.labels.get(key, default)


@dataclass
class TaskExecution:
    """Execution state and history for a task."""
    assigned_role: Optional[str] = None
    execution_history: List[Dict[str, Any]] = field(default_factory=list)
    current_execution_id: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3
    last_error: Optional[str] = None
    execution_context: Dict[str, Any] = field(default_factory=dict)
    
    def add_execution_record(self, 
                           role_name: str,
                           status: str,
                           output: str = "",
                           error: str = None,
                           metadata: Dict[str, Any] = None) -> None:
        """Add an execution record to history."""
        record = {
            "execution_id": str(uuid.uuid4()),
            "timestamp": datetime.now().isoformat(),
            "role_name": role_name,
            "status": status,
            "output": output,
            "error": error,
            "metadata": metadata or {}
        }
        self.execution_history.append(record)
        
        if status == "failed" and error:
            self.last_error = error
            self.retry_count += 1
    
    def can_retry(self) -> bool:
        """Check if task can be retried after failure."""
        return self.retry_count < self.max_retries
    
    def reset_retries(self) -> None:
        """Reset retry count after successful execution."""
        self.retry_count = 0
        self.last_error = None


@dataclass
class Task:
    """
    Hierarchical task with role-based execution and comprehensive tracking.
    
    Inspired by Archon's task management but enhanced with tree structures,
    role integration, and comprehensive metadata tracking.
    """
    
    # Core identification
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    title: str = ""
    description: str = ""
    
    # Hierarchy and relationships  
    parent_id: Optional[str] = None
    child_ids: Set[str] = field(default_factory=set)
    related_task_ids: Dict[TaskRelation, Set[str]] = field(default_factory=dict)
    
    # Status and priority
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.NORMAL
    task_order: int = 0  # For ordering within same priority/status
    
    # Temporal tracking
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    due_date: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # Enhanced metadata and execution
    metadata: TaskMetadata = field(default_factory=TaskMetadata)
    execution: TaskExecution = field(default_factory=TaskExecution)
    
    # Triple database coordination
    triple_db: TripleDBCoordination = field(default_factory=TripleDBCoordination)
    
    # Project and feature association
    project_id: Optional[str] = None
    feature: Optional[str] = None
    milestone: Optional[str] = None
    
    # User assignment
    assignee: str = "User"
    creator: str = "System"
    
    def __post_init__(self):
        """Initialize default related task collections."""
        if not self.related_task_ids:
            for relation in TaskRelation:
                self.related_task_ids[relation] = set()
    
    # Hierarchy management
    def add_child(self, child_task_id: str) -> None:
        """Add a child task."""
        self.child_ids.add(child_task_id)
        self.updated_at = datetime.now()
    
    def remove_child(self, child_task_id: str) -> None:
        """Remove a child task."""
        self.child_ids.discard(child_task_id)
        self.updated_at = datetime.now()
    
    def add_relation(self, relation: TaskRelation, task_id: str) -> None:
        """Add a relationship to another task."""
        if relation not in self.related_task_ids:
            self.related_task_ids[relation] = set()
        self.related_task_ids[relation].add(task_id)
        self.updated_at = datetime.now()
    
    def remove_relation(self, relation: TaskRelation, task_id: str) -> None:
        """Remove a relationship to another task."""
        if relation in self.related_task_ids:
            self.related_task_ids[relation].discard(task_id)
        self.updated_at = datetime.now()
    
    def get_related_tasks(self, relation: TaskRelation) -> Set[str]:
        """Get all tasks with a specific relationship."""
        return self.related_task_ids.get(relation, set())
    
    # Status management
    def update_status(self, new_status: TaskStatus, user: str = "System") -> None:
        """Update task status with timestamp tracking."""
        old_status = self.status
        self.status = new_status
        self.updated_at = datetime.now()
        
        # Track temporal milestones
        if new_status == TaskStatus.DOING and not self.started_at:
            self.started_at = datetime.now()
        elif new_status == TaskStatus.DONE and not self.completed_at:
            self.completed_at = datetime.now()
        
        # Add to execution history
        self.execution.add_execution_record(
            role_name=user,
            status=f"status_changed_{old_status.value}_to_{new_status.value}",
            metadata={"old_status": old_status.value, "new_status": new_status.value}
        )
    
    def update_priority(self, new_priority: TaskPriority) -> None:
        """Update task priority."""
        self.priority = new_priority
        self.updated_at = datetime.now()
    
    # Task tree queries
    def is_root_task(self) -> bool:
        """Check if this is a root task (no parent)."""
        return self.parent_id is None
    
    def is_leaf_task(self) -> bool:
        """Check if this is a leaf task (no children)."""
        return len(self.child_ids) == 0
    
    def has_children(self) -> bool:
        """Check if task has child tasks."""
        return len(self.child_ids) > 0
    
    def get_depth_estimate(self) -> int:
        """Estimate tree depth based on child count (for display purposes)."""
        return 1 + (1 if self.has_children() else 0)
    
    # Dependency checking
    def has_dependency_on(self, task_id: str) -> bool:
        """Check if this task depends on another task."""
        return task_id in self.get_related_tasks(TaskRelation.DEPENDS_ON)
    
    def blocks_task(self, task_id: str) -> bool:
        """Check if this task blocks another task."""
        return task_id in self.get_related_tasks(TaskRelation.BLOCKS)
    
    def is_blocked_by(self, task_id: str) -> bool:
        """Check if this task is blocked by another task."""
        # Would need to check the other task's blocks relationship
        # This is a helper that suggests the relationship check
        return False  # Placeholder - requires TaskManager to resolve
    
    # Role and execution management
    def assign_role(self, role_name: str) -> None:
        """Assign a role to execute this task."""
        self.execution.assigned_role = role_name
        self.updated_at = datetime.now()
    
    def can_be_executed(self) -> bool:
        """Check if task is ready for execution."""
        return (
            self.status == TaskStatus.TODO and
            self.execution.assigned_role is not None and
            (self.execution.can_retry() or self.execution.retry_count == 0)
        )
    
    def is_overdue(self) -> bool:
        """Check if task is past its due date."""
        if not self.due_date:
            return False
        return datetime.now() > self.due_date
    
    # Triple database coordination methods
    def mark_content_changed(self) -> None:
        """Mark task content as changed for re-synchronization."""
        content = f"{self.title}|{self.description}|{self.status.value}|{self.priority.value}"
        self.triple_db.mark_content_changed(content)
        self.updated_at = datetime.now()
    
    def mark_structure_changed(self) -> None:
        """Mark task structure as changed (relationships, hierarchy)."""
        self.triple_db.mark_structure_changed()
        self.updated_at = datetime.now()
    
    def is_sync_pending(self) -> bool:
        """Check if task needs synchronization."""
        return self.triple_db.sync_status in [SyncStatus.PENDING, SyncStatus.ERROR]
    
    def is_fully_synced(self) -> bool:
        """Check if task is fully synchronized across all databases."""
        return self.triple_db.sync_status == SyncStatus.SYNCED
    
    def get_sync_status_summary(self) -> Dict[str, Any]:
        """Get summary of synchronization status."""
        return {
            "overall_status": self.triple_db.sync_status.value,
            "chroma_synced": self.triple_db.chroma_synced,
            "kuzu_synced": self.triple_db.kuzu_synced,
            "last_indexed": self.triple_db.last_indexed.isoformat() if self.triple_db.last_indexed else None,
            "content_hash": self.triple_db.content_hash,
            "sync_error": self.triple_db.sync_error
        }
    
    # Serialization
    def to_dict(self) -> Dict[str, Any]:
        """Convert task to dictionary for serialization."""
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "parent_id": self.parent_id,
            "child_ids": list(self.child_ids),
            "related_task_ids": {
                relation.value: list(task_ids) 
                for relation, task_ids in self.related_task_ids.items()
            },
            "status": self.status.value,
            "priority": self.priority.value,
            "task_order": self.task_order,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "project_id": self.project_id,
            "feature": self.feature,
            "milestone": self.milestone,
            "assignee": self.assignee,
            "creator": self.creator,
            "metadata": {
                "tags": self.metadata.tags,
                "labels": self.metadata.labels,
                "estimated_effort": self.metadata.estimated_effort,
                "actual_effort": self.metadata.actual_effort,
                "complexity": self.metadata.complexity,
                "source_references": self.metadata.source_references,
                "code_references": self.metadata.code_references
            },
            "execution": {
                "assigned_role": self.execution.assigned_role,
                "execution_history": self.execution.execution_history,
                "current_execution_id": self.execution.current_execution_id,
                "retry_count": self.execution.retry_count,
                "max_retries": self.execution.max_retries,
                "last_error": self.execution.last_error,
                "execution_context": self.execution.execution_context
            },
            "triple_db": {
                "embedding_id": self.triple_db.embedding_id,
                "content_hash": self.triple_db.content_hash,
                "last_embedded": self.triple_db.last_embedded.isoformat() if self.triple_db.last_embedded else None,
                "embedding_version": self.triple_db.embedding_version,
                "graph_node_id": self.triple_db.graph_node_id,
                "last_graph_sync": self.triple_db.last_graph_sync.isoformat() if self.triple_db.last_graph_sync else None,
                "graph_version": self.triple_db.graph_version,
                "sync_status": self.triple_db.sync_status.value,
                "last_indexed": self.triple_db.last_indexed.isoformat() if self.triple_db.last_indexed else None,
                "sync_error": self.triple_db.sync_error,
                "chroma_synced": self.triple_db.chroma_synced,
                "kuzu_synced": self.triple_db.kuzu_synced
            }
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Task':
        """Create task from dictionary."""
        # Parse datetime fields
        created_at = datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now()
        updated_at = datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else datetime.now()
        due_date = datetime.fromisoformat(data["due_date"]) if data.get("due_date") else None
        started_at = datetime.fromisoformat(data["started_at"]) if data.get("started_at") else None
        completed_at = datetime.fromisoformat(data["completed_at"]) if data.get("completed_at") else None
        
        # Create metadata
        metadata_data = data.get("metadata", {})
        metadata = TaskMetadata(
            tags=metadata_data.get("tags", []),
            labels=metadata_data.get("labels", {}),
            estimated_effort=metadata_data.get("estimated_effort"),
            actual_effort=metadata_data.get("actual_effort"),
            complexity=metadata_data.get("complexity", "moderate"),
            source_references=metadata_data.get("source_references", []),
            code_references=metadata_data.get("code_references", [])
        )
        
        # Create execution state
        execution_data = data.get("execution", {})
        execution = TaskExecution(
            assigned_role=execution_data.get("assigned_role"),
            execution_history=execution_data.get("execution_history", []),
            current_execution_id=execution_data.get("current_execution_id"),
            retry_count=execution_data.get("retry_count", 0),
            max_retries=execution_data.get("max_retries", 3),
            last_error=execution_data.get("last_error"),
            execution_context=execution_data.get("execution_context", {})
        )
        
        # Create triple database coordination state
        triple_db_data = data.get("triple_db", {})
        last_embedded = datetime.fromisoformat(triple_db_data["last_embedded"]) if triple_db_data.get("last_embedded") else None
        last_graph_sync = datetime.fromisoformat(triple_db_data["last_graph_sync"]) if triple_db_data.get("last_graph_sync") else None
        last_indexed = datetime.fromisoformat(triple_db_data["last_indexed"]) if triple_db_data.get("last_indexed") else None
        
        triple_db = TripleDBCoordination(
            embedding_id=triple_db_data.get("embedding_id"),
            content_hash=triple_db_data.get("content_hash"),
            last_embedded=last_embedded,
            embedding_version=triple_db_data.get("embedding_version", 1),
            graph_node_id=triple_db_data.get("graph_node_id"),
            last_graph_sync=last_graph_sync,
            graph_version=triple_db_data.get("graph_version", 1),
            sync_status=SyncStatus(triple_db_data.get("sync_status", "pending")),
            last_indexed=last_indexed,
            sync_error=triple_db_data.get("sync_error"),
            chroma_synced=triple_db_data.get("chroma_synced", False),
            kuzu_synced=triple_db_data.get("kuzu_synced", False)
        )
        
        # Parse relationships
        related_task_ids = {}
        for relation_str, task_id_list in data.get("related_task_ids", {}).items():
            relation = TaskRelation(relation_str)
            related_task_ids[relation] = set(task_id_list)
        
        # Create task
        task = cls(
            id=data["id"],
            title=data["title"],
            description=data["description"],
            parent_id=data.get("parent_id"),
            child_ids=set(data.get("child_ids", [])),
            related_task_ids=related_task_ids,
            status=TaskStatus(data["status"]),
            priority=TaskPriority(data["priority"]),
            task_order=data.get("task_order", 0),
            created_at=created_at,
            updated_at=updated_at,
            due_date=due_date,
            started_at=started_at,
            completed_at=completed_at,
            project_id=data.get("project_id"),
            feature=data.get("feature"),
            milestone=data.get("milestone"),
            assignee=data.get("assignee", "User"),
            creator=data.get("creator", "System"),
            metadata=metadata,
            execution=execution,
            triple_db=triple_db
        )
        
        return task