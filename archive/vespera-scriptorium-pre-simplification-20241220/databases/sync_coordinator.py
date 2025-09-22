"""
Database Synchronization Coordinator for Triple Database System

Coordinates data synchronization between SQLite, Chroma, and KuzuDB,
ensuring consistency and handling partial failures gracefully.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple, Set
from dataclasses import dataclass, field
from pathlib import Path

from tasks.models import Task, SyncStatus, TripleDBCoordination
from tasks.service import TaskService

logger = logging.getLogger(__name__)


@dataclass
class SyncOperation:
    """Represents a synchronization operation."""
    task_id: str
    operation_type: str  # 'create', 'update', 'delete'
    target_databases: Set[str] = field(default_factory=lambda: {"chroma", "kuzu"})
    priority: int = 1  # 1=high, 2=normal, 3=low
    created_at: datetime = field(default_factory=datetime.now)
    retry_count: int = 0
    max_retries: int = 3
    last_error: Optional[str] = None


@dataclass
class SyncResult:
    """Result of a synchronization operation."""
    success: bool
    task_id: str
    databases_synced: Set[str] = field(default_factory=set)
    databases_failed: Set[str] = field(default_factory=set)
    errors: List[str] = field(default_factory=list)
    duration: Optional[timedelta] = None


class DatabaseSyncCoordinator:
    """
    Coordinates synchronization between SQLite, Chroma, and KuzuDB.
    
    Features:
    - Async queue-based synchronization
    - Retry logic with exponential backoff
    - Partial failure handling
    - Priority-based operation ordering
    - Batch synchronization for performance
    """
    
    def __init__(self, task_service: TaskService):
        """Initialize the sync coordinator."""
        self.task_service = task_service
        
        # External database clients (set by TripleDBService)
        self.chroma_client = None
        self.kuzu_database = None
        
        # Sync queue and processing
        self.sync_queue: asyncio.Queue = asyncio.Queue()
        self.sync_in_progress: Set[str] = set()
        self.batch_size = 10
        self.batch_timeout = 30  # seconds
        
        # Background processing
        self._sync_task: Optional[asyncio.Task] = None
        self._shutdown = False
        
        logger.info("Database sync coordinator initialized")
    
    def set_external_clients(self, chroma_client, kuzu_database) -> None:
        """Set external database clients."""
        self.chroma_client = chroma_client
        self.kuzu_database = kuzu_database
        logger.info("External database clients configured")
    
    async def start(self) -> None:
        """Start background synchronization processing."""
        if self._sync_task is None or self._sync_task.done():
            self._shutdown = False
            self._sync_task = asyncio.create_task(self._process_sync_queue())
            logger.info("Sync coordinator background processing started")
    
    async def stop(self) -> None:
        """Stop background synchronization processing."""
        self._shutdown = True
        if self._sync_task:
            self._sync_task.cancel()
            try:
                await self._sync_task
            except asyncio.CancelledError:
                pass
        logger.info("Sync coordinator background processing stopped")
    
    async def schedule_sync(self, task_id: str, operation_type: str, 
                          target_databases: Optional[Set[str]] = None,
                          priority: int = 1) -> None:
        """Schedule a task for synchronization."""
        if task_id in self.sync_in_progress:
            logger.debug(f"Sync already in progress for task {task_id}")
            return
        
        operation = SyncOperation(
            task_id=task_id,
            operation_type=operation_type,
            target_databases=target_databases or {"chroma", "kuzu"},
            priority=priority
        )
        
        await self.sync_queue.put(operation)
        logger.debug(f"Scheduled {operation_type} sync for task {task_id}")
    
    async def sync_task_immediate(self, task: Task, operation_type: str) -> SyncResult:
        """Synchronize a task immediately (bypass queue)."""
        start_time = datetime.now()
        result = SyncResult(success=False, task_id=task.id)
        
        try:
            self.sync_in_progress.add(task.id)
            
            # Update sync status
            task.triple_db.sync_status = SyncStatus.SYNCING
            await self._update_task_sync_status(task)
            
            # Sync to Chroma
            if self.chroma_client and "chroma" in {"chroma", "kuzu"}:
                chroma_success = await self._sync_to_chroma(task, operation_type)
                if chroma_success:
                    result.databases_synced.add("chroma")
                    task.triple_db.mark_chroma_synced(f"task_{task.id}_content")
                else:
                    result.databases_failed.add("chroma")
                    result.errors.append("Failed to sync to Chroma")
            
            # Sync to KuzuDB
            if self.kuzu_database and "kuzu" in {"chroma", "kuzu"}:
                kuzu_success = await self._sync_to_kuzu(task, operation_type)
                if kuzu_success:
                    result.databases_synced.add("kuzu")
                    task.triple_db.mark_kuzu_synced(task.id)
                else:
                    result.databases_failed.add("kuzu")
                    result.errors.append("Failed to sync to KuzuDB")
            
            # Update final sync status
            if result.databases_failed:
                if result.databases_synced:
                    task.triple_db.sync_status = SyncStatus.PARTIAL
                else:
                    task.triple_db.mark_sync_error("; ".join(result.errors))
            else:
                task.triple_db.sync_status = SyncStatus.SYNCED
                task.triple_db.last_indexed = datetime.now()
            
            await self._update_task_sync_status(task)
            
            result.success = bool(result.databases_synced)
            result.duration = datetime.now() - start_time
            
            logger.info(f"Immediate sync completed for task {task.id}: "
                       f"synced={list(result.databases_synced)}, "
                       f"failed={list(result.databases_failed)}")
            
        except Exception as e:
            logger.error(f"Immediate sync failed for task {task.id}: {e}")
            result.errors.append(str(e))
            task.triple_db.mark_sync_error(str(e))
            await self._update_task_sync_status(task)
        
        finally:
            self.sync_in_progress.discard(task.id)
        
        return result
    
    async def _process_sync_queue(self) -> None:
        """Background processing of sync queue."""
        while not self._shutdown:
            try:
                # Collect operations for batch processing
                operations = []
                deadline = datetime.now() + timedelta(seconds=self.batch_timeout)
                
                # Get first operation (wait for it)
                try:
                    operation = await asyncio.wait_for(
                        self.sync_queue.get(),
                        timeout=self.batch_timeout
                    )
                    operations.append(operation)
                except asyncio.TimeoutError:
                    continue
                
                # Collect additional operations up to batch size or timeout
                while (len(operations) < self.batch_size and 
                       datetime.now() < deadline and 
                       not self.sync_queue.empty()):
                    try:
                        operation = await asyncio.wait_for(
                            self.sync_queue.get(),
                            timeout=1.0
                        )
                        operations.append(operation)
                    except asyncio.TimeoutError:
                        break
                
                if operations:
                    await self._process_sync_batch(operations)
                
            except Exception as e:
                logger.error(f"Error in sync queue processing: {e}")
                await asyncio.sleep(1)  # Brief pause before retrying
    
    async def _process_sync_batch(self, operations: List[SyncOperation]) -> None:
        """Process a batch of sync operations."""
        logger.debug(f"Processing sync batch of {len(operations)} operations")
        
        # Sort by priority (1=high priority first)
        operations.sort(key=lambda op: (op.priority, op.created_at))
        
        for operation in operations:
            if operation.task_id in self.sync_in_progress:
                continue
            
            try:
                # Get the task
                task = await self.task_service.get_task(operation.task_id)
                if not task:
                    logger.warning(f"Task {operation.task_id} not found for sync")
                    continue
                
                # Process the operation
                result = await self.sync_task_immediate(task, operation.operation_type)
                
                # Handle retry logic
                if not result.success and operation.retry_count < operation.max_retries:
                    operation.retry_count += 1
                    operation.last_error = "; ".join(result.errors)
                    
                    # Exponential backoff
                    delay = min(2 ** operation.retry_count, 60)
                    await asyncio.sleep(delay)
                    
                    # Re-queue for retry
                    await self.sync_queue.put(operation)
                    logger.debug(f"Retrying sync for task {operation.task_id} "
                               f"(attempt {operation.retry_count + 1})")
                
            except Exception as e:
                logger.error(f"Error processing sync operation for task {operation.task_id}: {e}")
    
    async def _sync_to_chroma(self, task: Task, operation_type: str) -> bool:
        """Synchronize task to Chroma vector database."""
        if not self.chroma_client:
            return False
        
        try:
            collection = self.chroma_client.get_collection("tasks_content")
            
            if operation_type == "delete":
                # Remove document from collection
                doc_id = f"task_{task.id}_content"
                collection.delete(ids=[doc_id])
                logger.debug(f"Deleted Chroma document {doc_id}")
                return True
            
            # Create or update document
            document_content = f"{task.title}\n\n{task.description}"
            if task.metadata.source_references:
                document_content += "\n\nReferences:\n" + "\n".join(task.metadata.source_references)
            
            metadata = {
                "task_id": task.id,
                "title": task.title,
                "content_hash": task.triple_db.content_hash or "",
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
                "embedding_version": task.triple_db.embedding_version,
                "embedded_at": datetime.now().isoformat()
            }
            
            doc_id = f"task_{task.id}_content"
            
            # Try to update first, then add if not exists
            try:
                collection.update(
                    ids=[doc_id],
                    documents=[document_content],
                    metadatas=[metadata]
                )
                logger.debug(f"Updated Chroma document {doc_id}")
            except Exception:
                collection.add(
                    ids=[doc_id],
                    documents=[document_content],
                    metadatas=[metadata]
                )
                logger.debug(f"Added new Chroma document {doc_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to sync task {task.id} to Chroma: {e}")
            return False
    
    async def _sync_to_kuzu(self, task: Task, operation_type: str) -> bool:
        """Synchronize task to KuzuDB graph database."""
        if not self.kuzu_database:
            return False
        
        try:
            import kuzu
            connection = kuzu.Connection(self.kuzu_database)
            
            try:
                if operation_type == "delete":
                    # Delete task node and all relationships
                    query = "MATCH (t:Task {id: $id}) DETACH DELETE t"
                    connection.execute(query, {"id": task.id})
                    logger.debug(f"Deleted KuzuDB node for task {task.id}")
                    return True
                
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
                
                # Sync relationships if this is an update operation
                if operation_type == "update":
                    await self._sync_task_relationships_to_kuzu(connection, task)
                
                logger.debug(f"Synced task {task.id} to KuzuDB")
                return True
                
            finally:
                connection.close()
            
        except Exception as e:
            logger.error(f"Failed to sync task {task.id} to KuzuDB: {e}")
            return False
    
    async def _sync_task_relationships_to_kuzu(self, connection, task: Task) -> None:
        """Sync task relationships to KuzuDB."""
        try:
            # Sync parent-child relationships
            if task.parent_id:
                query = """
                    MATCH (parent:Task {id: $parent_id}), (child:Task {id: $child_id})
                    MERGE (parent)-[:HAS_SUBTASK]->(child)
                """
                connection.execute(query, {"parent_id": task.parent_id, "child_id": task.id})
            
            # Sync dependency relationships
            for relation_type, related_ids in task.related_task_ids.items():
                if relation_type.value == "depends_on":
                    for related_id in related_ids:
                        query = """
                            MATCH (source:Task {id: $source_id}), (target:Task {id: $target_id})
                            MERGE (source)-[:DEPENDS_ON]->(target)
                        """
                        connection.execute(query, {"source_id": task.id, "target_id": related_id})
                
                elif relation_type.value == "blocks":
                    for related_id in related_ids:
                        query = """
                            MATCH (source:Task {id: $source_id}), (target:Task {id: $target_id})
                            MERGE (source)-[:BLOCKS]->(target)
                        """
                        connection.execute(query, {"source_id": task.id, "target_id": related_id})
            
        except Exception as e:
            logger.error(f"Failed to sync relationships for task {task.id}: {e}")
    
    async def _update_task_sync_status(self, task: Task) -> None:
        """Update task sync status in SQLite."""
        try:
            updates = {
                "triple_db": {
                    "sync_status": task.triple_db.sync_status.value,
                    "chroma_synced": task.triple_db.chroma_synced,
                    "kuzu_synced": task.triple_db.kuzu_synced,
                    "last_indexed": task.triple_db.last_indexed,
                    "sync_error": task.triple_db.sync_error,
                    "content_hash": task.triple_db.content_hash,
                    "embedding_id": task.triple_db.embedding_id,
                    "graph_node_id": task.triple_db.graph_node_id
                }
            }
            
            success, result = await self.task_service.update_task(task.id, updates)
            if not success:
                logger.error(f"Failed to update sync status for task {task.id}: {result}")
            
        except Exception as e:
            logger.error(f"Failed to update sync status for task {task.id}: {e}")
    
    async def get_sync_statistics(self) -> Dict[str, Any]:
        """Get synchronization statistics."""
        try:
            tasks = await self.task_service.list_tasks(limit=1000)
            
            stats = {
                "total_tasks": len(tasks),
                "sync_status": {
                    "synced": 0,
                    "pending": 0,
                    "error": 0,
                    "partial": 0
                },
                "database_sync": {
                    "chroma_synced": 0,
                    "kuzu_synced": 0,
                    "both_synced": 0,
                    "none_synced": 0
                },
                "queue_size": self.sync_queue.qsize(),
                "active_syncs": len(self.sync_in_progress)
            }
            
            for task in tasks:
                # Count by overall sync status
                status = task.triple_db.sync_status.value
                if status in stats["sync_status"]:
                    stats["sync_status"][status] += 1
                
                # Count by individual database sync
                chroma_synced = task.triple_db.chroma_synced
                kuzu_synced = task.triple_db.kuzu_synced
                
                if chroma_synced and kuzu_synced:
                    stats["database_sync"]["both_synced"] += 1
                elif chroma_synced:
                    stats["database_sync"]["chroma_synced"] += 1
                elif kuzu_synced:
                    stats["database_sync"]["kuzu_synced"] += 1
                else:
                    stats["database_sync"]["none_synced"] += 1
            
            return stats
            
        except Exception as e:
            logger.error(f"Failed to get sync statistics: {e}")
            return {"error": str(e)}
    
    async def force_full_resync(self) -> Dict[str, Any]:
        """Force full resynchronization of all tasks."""
        logger.info("Starting full resynchronization of all tasks")
        
        try:
            tasks = await self.task_service.list_tasks(limit=1000)
            
            for task in tasks:
                # Reset sync status
                task.triple_db.sync_status = SyncStatus.PENDING
                task.triple_db.chroma_synced = False
                task.triple_db.kuzu_synced = False
                task.triple_db.sync_error = None
                
                # Schedule for sync
                await self.schedule_sync(task.id, "update", priority=2)
            
            return {
                "success": True,
                "tasks_scheduled": len(tasks),
                "message": f"Scheduled {len(tasks)} tasks for full resynchronization"
            }
            
        except Exception as e:
            logger.error(f"Failed to start full resync: {e}")
            return {"success": False, "error": str(e)}