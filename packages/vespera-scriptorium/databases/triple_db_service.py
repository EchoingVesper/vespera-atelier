"""
Triple Database Service for Vespera V2

Unified service layer providing coordinated access to SQLite, Chroma, and KuzuDB
with automatic synchronization and intelligent query distribution.
"""

import asyncio
import logging
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Union, Tuple
from contextlib import asynccontextmanager
from dataclasses import dataclass, field

# Core dependencies
from tasks.service import TaskService
from tasks.models import Task, TaskStatus, TaskPriority, TaskRelation

# Third-party database clients
try:
    import chromadb
    from chromadb.config import Settings
    CHROMA_AVAILABLE = True
except ImportError:
    CHROMA_AVAILABLE = False
    chromadb = None

try:
    import kuzu
    KUZU_AVAILABLE = True
except ImportError:
    KUZU_AVAILABLE = False
    kuzu = None

logger = logging.getLogger(__name__)


@dataclass
class DatabaseConfig:
    """Configuration for triple database setup."""
    data_dir: Path
    sqlite_enabled: bool = True
    chroma_enabled: bool = True
    kuzu_enabled: bool = True
    
    # Chroma settings
    chroma_persist_dir: Optional[Path] = None
    chroma_embedding_function: str = "sentence-transformers/all-MiniLM-L6-v2"
    
    # KuzuDB settings  
    kuzu_database_path: Optional[Path] = None
    kuzu_buffer_pool_size: int = 1024 * 1024 * 1024  # 1GB
    
    # Sync settings
    auto_sync_enabled: bool = True
    sync_batch_size: int = 50
    sync_timeout_seconds: int = 30
    
    def __post_init__(self):
        """Initialize derived paths."""
        if self.chroma_persist_dir is None:
            self.chroma_persist_dir = self.data_dir / "embeddings"
        if self.kuzu_database_path is None:
            self.kuzu_database_path = self.data_dir / "knowledge_graph"


@dataclass
class DatabaseStatus:
    """Status information for all databases."""
    sqlite_connected: bool = False
    chroma_connected: bool = False
    kuzu_connected: bool = False
    last_sync_time: Optional[datetime] = None
    sync_in_progress: bool = False
    error_message: Optional[str] = None


class TripleDBService:
    """
    Unified service for coordinated operations across SQLite, Chroma, and KuzuDB.
    
    This service provides:
    - Coordinated database lifecycle management
    - Automatic synchronization between databases
    - Graceful degradation when databases are unavailable
    - Unified query interface with intelligent routing
    """
    
    def __init__(self, config: DatabaseConfig):
        """Initialize the triple database service."""
        self.config = config
        self.config.data_dir.mkdir(parents=True, exist_ok=True)
        
        # Core service components
        self.task_service: Optional[TaskService] = None
        self.chroma_client: Optional[chromadb.Client] = None
        self.kuzu_database: Optional[kuzu.Database] = None
        
        # Service state
        self.status = DatabaseStatus()
        self._initialized = False
        self._sync_lock = asyncio.Lock()
        
        logger.info(f"Initialized TripleDBService with data directory: {config.data_dir}")
    
    async def initialize(self) -> bool:
        """Initialize all database connections."""
        if self._initialized:
            return True
        
        try:
            # Initialize SQLite (always required)
            if self.config.sqlite_enabled:
                await self._init_sqlite()
            
            # Initialize Chroma (optional)
            if self.config.chroma_enabled and CHROMA_AVAILABLE:
                await self._init_chroma()
            elif self.config.chroma_enabled:
                logger.warning("Chroma requested but not available. Install chromadb package.")
            
            # Initialize KuzuDB (optional)
            if self.config.kuzu_enabled and KUZU_AVAILABLE:
                await self._init_kuzu()
            elif self.config.kuzu_enabled:
                logger.warning("KuzuDB requested but not available. Install kuzu package.")
            
            self._initialized = True
            logger.info("Triple database service initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize triple database service: {e}")
            self.status.error_message = str(e)
            return False
    
    async def cleanup(self) -> None:
        """Clean up all database connections."""
        try:
            # SQLite cleanup
            if self.task_service:
                # TaskService doesn't need explicit cleanup for SQLite
                pass
            
            # Chroma cleanup
            if self.chroma_client:
                # Chroma client doesn't need explicit cleanup
                self.chroma_client = None
                self.status.chroma_connected = False
            
            # KuzuDB cleanup
            if self.kuzu_database:
                # KuzuDB handles cleanup automatically
                self.kuzu_database = None
                self.status.kuzu_connected = False
            
            self._initialized = False
            logger.info("Triple database service cleaned up successfully")
            
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
    
    # Database-specific initialization
    async def _init_sqlite(self) -> None:
        """Initialize SQLite task service."""
        try:
            db_path = self.config.data_dir / "tasks.db"
            self.task_service = TaskService(db_path)
            self.status.sqlite_connected = True
            logger.info(f"SQLite initialized at {db_path}")
        except Exception as e:
            logger.error(f"Failed to initialize SQLite: {e}")
            raise
    
    async def _init_chroma(self) -> None:
        """Initialize Chroma vector database."""
        try:
            if not CHROMA_AVAILABLE:
                raise ImportError("chromadb package not available")
            
            # Ensure directory exists
            self.config.chroma_persist_dir.mkdir(parents=True, exist_ok=True)
            
            # Initialize Chroma client
            settings = Settings(
                persist_directory=str(self.config.chroma_persist_dir),
                anonymized_telemetry=False,
                is_persistent=True
            )
            
            self.chroma_client = chromadb.Client(settings)
            
            # Initialize collections
            await self._init_chroma_collections()
            
            self.status.chroma_connected = True
            logger.info(f"Chroma initialized at {self.config.chroma_persist_dir}")
            
        except Exception as e:
            logger.error(f"Failed to initialize Chroma: {e}")
            # Don't raise - allow graceful degradation
            self.config.chroma_enabled = False
    
    async def _init_chroma_collections(self) -> None:
        """Initialize required Chroma collections."""
        if not self.chroma_client:
            return
        
        collections_config = {
            "tasks_content": {
                "metadata": {"hnsw:space": "cosine", "hnsw:M": 16}
            },
            "code_references": {
                "metadata": {"hnsw:space": "cosine", "hnsw:M": 16}
            },
            "project_context": {
                "metadata": {"hnsw:space": "cosine", "hnsw:M": 16}
            }
        }
        
        for collection_name, config in collections_config.items():
            try:
                # Try to get existing collection
                collection = self.chroma_client.get_collection(collection_name)
                logger.info(f"Found existing Chroma collection: {collection_name}")
            except Exception:
                # Create new collection
                collection = self.chroma_client.create_collection(
                    name=collection_name,
                    metadata=config.get("metadata", {})
                )
                logger.info(f"Created new Chroma collection: {collection_name}")
    
    async def _init_kuzu(self) -> None:
        """Initialize KuzuDB graph database."""
        try:
            if not KUZU_AVAILABLE:
                raise ImportError("kuzu package not available")
            
            # Ensure directory exists
            self.config.kuzu_database_path.mkdir(parents=True, exist_ok=True)
            
            # Initialize KuzuDB
            self.kuzu_database = kuzu.Database(
                str(self.config.kuzu_database_path),
                buffer_pool_size=self.config.kuzu_buffer_pool_size
            )
            
            # Initialize schema
            await self._init_kuzu_schema()
            
            self.status.kuzu_connected = True
            logger.info(f"KuzuDB initialized at {self.config.kuzu_database_path}")
            
        except Exception as e:
            logger.error(f"Failed to initialize KuzuDB: {e}")
            # Don't raise - allow graceful degradation
            self.config.kuzu_enabled = False
    
    async def _init_kuzu_schema(self) -> None:
        """Initialize KuzuDB schema."""
        if not self.kuzu_database:
            return
        
        connection = kuzu.Connection(self.kuzu_database)
        
        try:
            # Create Task node table
            connection.execute("""
                CREATE NODE TABLE IF NOT EXISTS Task (
                    id STRING,
                    title STRING,
                    description STRING,
                    status STRING,
                    priority STRING,
                    created_at TIMESTAMP,
                    updated_at TIMESTAMP,
                    due_date TIMESTAMP,
                    project_id STRING,
                    feature STRING,
                    assignee STRING,
                    creator STRING,
                    complexity STRING,
                    estimated_effort STRING,
                    tags STRING[],
                    sqlite_synced_at TIMESTAMP,
                    embedding_synced_at TIMESTAMP,
                    PRIMARY KEY (id)
                )
            """)
            
            # Create Project node table
            connection.execute("""
                CREATE NODE TABLE IF NOT EXISTS Project (
                    id STRING,
                    name STRING,
                    description STRING,
                    status STRING,
                    created_at TIMESTAMP,
                    team STRING,
                    technology_stack STRING[],
                    PRIMARY KEY (id)
                )
            """)
            
            # Create Role node table
            connection.execute("""
                CREATE NODE TABLE IF NOT EXISTS Role (
                    name STRING,
                    display_name STRING,
                    description STRING,
                    tool_groups STRING[],
                    PRIMARY KEY (name)
                )
            """)
            
            # Create relationship tables
            relationship_schemas = [
                "CREATE REL TABLE IF NOT EXISTS HAS_SUBTASK (FROM Task TO Task, order INT64, created_at TIMESTAMP)",
                "CREATE REL TABLE IF NOT EXISTS DEPENDS_ON (FROM Task TO Task, dependency_type STRING, created_at TIMESTAMP)",
                "CREATE REL TABLE IF NOT EXISTS BLOCKS (FROM Task TO Task, blocking_type STRING, created_at TIMESTAMP)",
                "CREATE REL TABLE IF NOT EXISTS ASSIGNED_TO (FROM Task TO Role, assigned_at TIMESTAMP)",
                "CREATE REL TABLE IF NOT EXISTS BELONGS_TO (FROM Task TO Project, added_at TIMESTAMP)",
                "CREATE REL TABLE IF NOT EXISTS RELATES_TO (FROM Task TO Task, relation_type STRING, strength DOUBLE)"
            ]
            
            for schema in relationship_schemas:
                connection.execute(schema)
            
            logger.info("KuzuDB schema initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize KuzuDB schema: {e}")
        finally:
            connection.close()
    
    # Task operations with triple-DB coordination
    async def create_task(self, task: Task) -> Tuple[bool, Dict[str, Any]]:
        """Create a task with coordination across all databases."""
        if not self._initialized:
            await self.initialize()
        
        try:
            # 1. Create in SQLite (primary database)
            success, result = await self.task_service.create_task(
                title=task.title,
                description=task.description,
                parent_id=task.parent_id,
                priority=task.priority,
                project_id=task.project_id,
                feature=task.feature,
                assignee=task.assignee,
                role_name=task.execution.assigned_role,
                due_date=task.due_date,
                metadata=task.metadata,
                task_order=task.task_order
            )
            
            if not success:
                return False, result
            
            created_task_dict = result["task"]
            created_task = Task.from_dict(created_task_dict)
            
            # 2. Generate content hash for change tracking
            content_hash = self._generate_content_hash(created_task)
            
            # 3. Schedule async synchronization with other databases
            if self.config.auto_sync_enabled:
                asyncio.create_task(self._sync_task_to_other_dbs(created_task, content_hash))
            
            return True, {"task": created_task_dict, "content_hash": content_hash}
            
        except Exception as e:
            logger.error(f"Failed to create task: {e}")
            return False, {"error": str(e)}
    
    async def get_task(self, task_id: str) -> Optional[Task]:
        """Get a task by ID."""
        if not self._initialized:
            await self.initialize()
        
        if self.task_service:
            return await self.task_service.get_task(task_id)
        return None
    
    async def update_task(self, task_id: str, updates: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
        """Update a task with coordination across all databases."""
        if not self._initialized:
            await self.initialize()
        
        try:
            # 1. Update in SQLite
            success, result = await self.task_service.update_task(task_id, updates)
            
            if not success:
                return False, result
            
            updated_task_dict = result["task"]
            updated_task = Task.from_dict(updated_task_dict)
            
            # 2. Generate new content hash
            content_hash = self._generate_content_hash(updated_task)
            
            # 3. Schedule async synchronization if content changed
            if self.config.auto_sync_enabled:
                asyncio.create_task(self._sync_task_to_other_dbs(updated_task, content_hash))
            
            return True, {"task": updated_task_dict, "content_hash": content_hash}
            
        except Exception as e:
            logger.error(f"Failed to update task: {e}")
            return False, {"error": str(e)}
    
    async def delete_task(self, task_id: str, recursive: bool = False) -> Tuple[bool, Dict[str, Any]]:
        """Delete a task with coordination across all databases."""
        if not self._initialized:
            await self.initialize()
        
        try:
            # 1. Get task before deletion for cleanup
            task = await self.get_task(task_id)
            if not task:
                return False, {"error": f"Task {task_id} not found"}
            
            # 2. Delete from SQLite
            success, result = await self.task_service.delete_task(task_id, recursive)
            
            if not success:
                return False, result
            
            # 3. Schedule async cleanup from other databases
            deleted_task_ids = result.get("deleted_tasks", [task_id])
            if self.config.auto_sync_enabled:
                asyncio.create_task(self._cleanup_deleted_tasks(deleted_task_ids))
            
            return True, result
            
        except Exception as e:
            logger.error(f"Failed to delete task: {e}")
            return False, {"error": str(e)}
    
    # Utility methods
    def _generate_content_hash(self, task: Task) -> str:
        """Generate a content hash for change detection."""
        content = f"{task.title}|{task.description}|{task.status.value}|{task.priority.value}|{task.updated_at.isoformat()}"
        return hashlib.sha256(content.encode()).hexdigest()
    
    async def _sync_task_to_other_dbs(self, task: Task, content_hash: str) -> None:
        """Synchronize task to Chroma and KuzuDB."""
        async with self._sync_lock:
            try:
                # Sync to Chroma
                if self.status.chroma_connected:
                    await self._sync_task_to_chroma(task, content_hash)
                
                # Sync to KuzuDB
                if self.status.kuzu_connected:
                    await self._sync_task_to_kuzu(task)
                
                self.status.last_sync_time = datetime.now()
                
            except Exception as e:
                logger.error(f"Failed to sync task {task.id} to other databases: {e}")
    
    async def _sync_task_to_chroma(self, task: Task, content_hash: str) -> None:
        """Synchronize task to Chroma collections."""
        if not self.chroma_client:
            return
        
        try:
            # Get tasks_content collection
            collection = self.chroma_client.get_collection("tasks_content")
            
            # Prepare document content
            document_content = f"{task.title}\n\n{task.description}"
            if task.metadata.source_references:
                document_content += f"\n\nReferences:\n" + "\n".join(task.metadata.source_references)
            
            # Prepare metadata
            metadata = {
                "task_id": task.id,
                "title": task.title,
                "content_hash": content_hash,
                "project_id": task.project_id or "",
                "parent_task_id": task.parent_id or "",
                "feature": task.feature or "",
                "status": task.status.value,
                "priority": task.priority.value,
                "created_at": task.created_at.isoformat(),
                "updated_at": task.updated_at.isoformat(),
                "complexity": task.metadata.complexity,
                "estimated_effort": task.metadata.estimated_effort or "",
                "tags": task.metadata.tags,
                "assignee": task.assignee,
                "assigned_role": task.execution.assigned_role or "",
                "embedding_version": 1,
                "embedded_at": datetime.now().isoformat()
            }
            
            # Add or update document
            doc_id = f"task_{task.id}_content"
            
            try:
                # Try to update existing document
                collection.update(
                    ids=[doc_id],
                    documents=[document_content],
                    metadatas=[metadata]
                )
                logger.debug(f"Updated Chroma document for task {task.id}")
            except Exception:
                # Document doesn't exist, create new one
                collection.add(
                    ids=[doc_id],
                    documents=[document_content],
                    metadatas=[metadata]
                )
                logger.debug(f"Added new Chroma document for task {task.id}")
                
        except Exception as e:
            logger.error(f"Failed to sync task {task.id} to Chroma: {e}")
    
    async def _sync_task_to_kuzu(self, task: Task) -> None:
        """Synchronize task to KuzuDB graph."""
        if not self.kuzu_database:
            return
        
        connection = kuzu.Connection(self.kuzu_database)
        
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
                    t.project_id = $project_id,
                    t.feature = $feature,
                    t.assignee = $assignee,
                    t.creator = $creator,
                    t.complexity = $complexity,
                    t.estimated_effort = $estimated_effort,
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
                "project_id": task.project_id or "",
                "feature": task.feature or "",
                "assignee": task.assignee,
                "creator": task.creator,
                "complexity": task.metadata.complexity,
                "estimated_effort": task.metadata.estimated_effort or "",
                "tags": task.metadata.tags,
                "sync_time": datetime.now()
            }
            
            connection.execute(query, parameters)
            logger.debug(f"Synced task {task.id} to KuzuDB")
            
        except Exception as e:
            logger.error(f"Failed to sync task {task.id} to KuzuDB: {e}")
        finally:
            connection.close()
    
    async def _cleanup_deleted_tasks(self, task_ids: List[str]) -> None:
        """Clean up deleted tasks from Chroma and KuzuDB."""
        try:
            # Clean up from Chroma
            if self.status.chroma_connected:
                await self._cleanup_chroma_documents(task_ids)
            
            # Clean up from KuzuDB
            if self.status.kuzu_connected:
                await self._cleanup_kuzu_nodes(task_ids)
                
        except Exception as e:
            logger.error(f"Failed to cleanup deleted tasks: {e}")
    
    async def _cleanup_chroma_documents(self, task_ids: List[str]) -> None:
        """Remove documents from Chroma collections."""
        if not self.chroma_client:
            return
        
        try:
            collection = self.chroma_client.get_collection("tasks_content")
            doc_ids = [f"task_{task_id}_content" for task_id in task_ids]
            
            # Delete documents (ignore if they don't exist)
            collection.delete(ids=doc_ids)
            logger.debug(f"Cleaned up {len(doc_ids)} documents from Chroma")
            
        except Exception as e:
            logger.error(f"Failed to cleanup Chroma documents: {e}")
    
    async def _cleanup_kuzu_nodes(self, task_ids: List[str]) -> None:
        """Remove nodes from KuzuDB graph."""
        if not self.kuzu_database:
            return
        
        connection = kuzu.Connection(self.kuzu_database)
        
        try:
            for task_id in task_ids:
                # Delete task node and all its relationships
                query = "MATCH (t:Task {id: $id}) DETACH DELETE t"
                connection.execute(query, {"id": task_id})
            
            logger.debug(f"Cleaned up {len(task_ids)} nodes from KuzuDB")
            
        except Exception as e:
            logger.error(f"Failed to cleanup KuzuDB nodes: {e}")
        finally:
            connection.close()
    
    # Status and health checking
    def get_status(self) -> DatabaseStatus:
        """Get current status of all databases."""
        return self.status
    
    async def health_check(self) -> Dict[str, Any]:
        """Comprehensive health check of all databases."""
        health = {
            "overall_status": "healthy",
            "initialized": self._initialized,
            "databases": {
                "sqlite": {
                    "enabled": self.config.sqlite_enabled,
                    "connected": self.status.sqlite_connected,
                    "available": self.task_service is not None
                },
                "chroma": {
                    "enabled": self.config.chroma_enabled,
                    "connected": self.status.chroma_connected,
                    "available": CHROMA_AVAILABLE and self.chroma_client is not None
                },
                "kuzu": {
                    "enabled": self.config.kuzu_enabled,
                    "connected": self.status.kuzu_connected,
                    "available": KUZU_AVAILABLE and self.kuzu_database is not None
                }
            },
            "sync": {
                "auto_sync_enabled": self.config.auto_sync_enabled,
                "last_sync_time": self.status.last_sync_time.isoformat() if self.status.last_sync_time else None,
                "sync_in_progress": self.status.sync_in_progress
            },
            "error_message": self.status.error_message
        }
        
        # Determine overall status
        if self.status.error_message:
            health["overall_status"] = "error"
        elif not self.status.sqlite_connected:
            health["overall_status"] = "degraded"
        elif not (self.status.chroma_connected or self.status.kuzu_connected):
            health["overall_status"] = "degraded"
        
        return health


# Context manager for easy lifecycle management
@asynccontextmanager
async def triple_db_lifespan(config: DatabaseConfig):
    """Context manager for TripleDBService lifecycle."""
    service = TripleDBService(config)
    try:
        await service.initialize()
        yield service
    finally:
        await service.cleanup()