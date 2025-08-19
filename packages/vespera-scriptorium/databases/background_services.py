"""
Background Services for Vespera V2 Triple Database System

Provides automatic background services for:
- Embedding generation on task creation/update
- Dependency cycle detection on relationship changes
- Incremental synchronization between databases
- Index optimization for performance maintenance

This separates user-facing MCP tools from system maintenance operations.
"""

import asyncio
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Set, Callable, Awaitable
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
import hashlib
import json

from tasks.models import Task, TaskStatus
from .service_config import BackgroundServiceConfig, ServiceStatus, ServiceType, ServicePriority

# Import database dependencies if available
try:
    import kuzu
    KUZU_AVAILABLE = True
except ImportError:
    KUZU_AVAILABLE = False
    kuzu = None

logger = logging.getLogger(__name__)


@dataclass
class ServiceOperation:
    """Represents a background service operation."""
    id: str
    service_type: ServiceType
    priority: ServicePriority
    operation_type: str
    target_id: str
    payload: Dict[str, Any]
    created_at: datetime
    scheduled_for: Optional[datetime] = None
    retries: int = 0
    max_retries: int = 3
    last_error: Optional[str] = None
    
    def should_retry(self) -> bool:
        """Check if operation should be retried."""
        return self.retries < self.max_retries
    
    def get_retry_delay(self) -> float:
        """Get exponential backoff delay for retries."""
        return min(2 ** self.retries, 300)  # Max 5 minutes


@dataclass
class ServiceMetrics:
    """Metrics for background service monitoring."""
    operations_completed: int = 0
    operations_failed: int = 0
    operations_retried: int = 0
    average_processing_time: float = 0.0
    last_operation_time: Optional[datetime] = None
    errors_last_hour: int = 0
    processing_times: List[float] = field(default_factory=list)
    
    def record_operation(self, duration: float, success: bool):
        """Record an operation result."""
        if success:
            self.operations_completed += 1
        else:
            self.operations_failed += 1
            
        # Update processing time average
        self.processing_times.append(duration)
        if len(self.processing_times) > 100:  # Keep last 100 operations
            self.processing_times.pop(0)
        
        self.average_processing_time = sum(self.processing_times) / len(self.processing_times)
        self.last_operation_time = datetime.now()


class BackgroundServiceManager:
    """
    Manages all background services for the triple database system.
    
    Provides:
    - Service lifecycle management
    - Operation queuing and scheduling
    - Error handling and retries
    - Performance monitoring
    - Graceful shutdown
    """
    
    def __init__(self, config: BackgroundServiceConfig):
        """Initialize the background service manager."""
        self.config = config
        
        # Service state
        self.services: Dict[ServiceType, 'BackgroundService'] = {}
        self.operation_queue: asyncio.Queue = asyncio.Queue()
        self.operation_history: List[ServiceOperation] = []
        self.metrics: Dict[ServiceType, ServiceMetrics] = {}
        
        # Control flags
        self.running = False
        self.shutdown_event = asyncio.Event()
        
        # Worker tasks
        self.worker_tasks: List[asyncio.Task] = []
        self.scheduler_task: Optional[asyncio.Task] = None
        
        logger.info(f"Initialized BackgroundServiceManager with {len(ServiceType)} service types")
    
    async def initialize(self) -> bool:
        """Initialize all background services."""
        try:
            # Initialize metrics for all service types
            for service_type in ServiceType:
                self.metrics[service_type] = ServiceMetrics()
            
            # Register core services
            await self._register_core_services()
            
            logger.info("Background service manager initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize background service manager: {e}")
            return False
    
    async def start(self) -> None:
        """Start all background services."""
        if self.running:
            logger.warning("Background services already running")
            return
        
        try:
            self.running = True
            self.shutdown_event.clear()
            
            # Start worker tasks
            for i in range(self.config.worker_count):
                task = asyncio.create_task(self._worker_loop(i))
                self.worker_tasks.append(task)
            
            # Start scheduler task
            self.scheduler_task = asyncio.create_task(self._scheduler_loop())
            
            # Start individual services
            for service in self.services.values():
                await service.start()
            
            logger.info(f"Started background services with {len(self.worker_tasks)} workers")
            
        except Exception as e:
            logger.error(f"Failed to start background services: {e}")
            await self.stop()
            raise
    
    async def stop(self) -> None:
        """Stop all background services gracefully."""
        if not self.running:
            return
        
        logger.info("Stopping background services...")
        
        try:
            # Signal shutdown
            self.running = False
            self.shutdown_event.set()
            
            # Stop individual services
            for service in self.services.values():
                await service.stop()
            
            # Cancel worker tasks
            for task in self.worker_tasks:
                task.cancel()
            
            if self.scheduler_task:
                self.scheduler_task.cancel()
            
            # Wait for all tasks to complete
            tasks_to_wait = self.worker_tasks.copy()
            if self.scheduler_task:
                tasks_to_wait.append(self.scheduler_task)
            
            if tasks_to_wait:
                await asyncio.gather(*tasks_to_wait, return_exceptions=True)
            
            # Clear task lists
            self.worker_tasks.clear()
            self.scheduler_task = None
            
            logger.info("Background services stopped successfully")
            
        except Exception as e:
            logger.error(f"Error stopping background services: {e}")
    
    async def register_service(self, service: 'BackgroundService') -> None:
        """Register a background service."""
        self.services[service.service_type] = service
        logger.info(f"Registered background service: {service.service_type.value}")
    
    async def schedule_operation(self, 
                               service_type: ServiceType,
                               operation_type: str,
                               target_id: str,
                               payload: Dict[str, Any] = None,
                               priority: ServicePriority = ServicePriority.NORMAL,
                               delay_seconds: float = 0) -> str:
        """Schedule a background operation."""
        if payload is None:
            payload = {}
        
        # Generate operation ID
        operation_id = hashlib.sha256(
            f"{service_type.value}:{operation_type}:{target_id}:{time.time()}".encode()
        ).hexdigest()[:16]
        
        # Create operation
        operation = ServiceOperation(
            id=operation_id,
            service_type=service_type,
            priority=priority,
            operation_type=operation_type,
            target_id=target_id,
            payload=payload,
            created_at=datetime.now(),
            scheduled_for=datetime.now() + timedelta(seconds=delay_seconds) if delay_seconds > 0 else None
        )
        
        # Add to queue or schedule for later
        if delay_seconds > 0:
            # Schedule for later execution
            asyncio.create_task(self._delayed_schedule(operation, delay_seconds))
        else:
            # Add to immediate queue
            await self.operation_queue.put(operation)
        
        logger.debug(f"Scheduled {service_type.value} operation {operation_type} for {target_id}")
        return operation_id
    
    async def get_service_status(self, service_type: ServiceType) -> Dict[str, Any]:
        """Get status of a specific service."""
        service = self.services.get(service_type)
        metrics = self.metrics.get(service_type, ServiceMetrics())
        
        return {
            "service_type": service_type.value,
            "enabled": service.enabled if service else False,
            "status": service.status.value if service else ServiceStatus.STOPPED.value,
            "metrics": {
                "operations_completed": metrics.operations_completed,
                "operations_failed": metrics.operations_failed,
                "operations_retried": metrics.operations_retried,
                "average_processing_time": metrics.average_processing_time,
                "last_operation_time": metrics.last_operation_time.isoformat() if metrics.last_operation_time else None,
                "errors_last_hour": metrics.errors_last_hour
            }
        }
    
    async def get_overall_status(self) -> Dict[str, Any]:
        """Get overall status of all background services."""
        service_statuses = {}
        for service_type in ServiceType:
            service_statuses[service_type.value] = await self.get_service_status(service_type)
        
        total_metrics = ServiceMetrics()
        for metrics in self.metrics.values():
            total_metrics.operations_completed += metrics.operations_completed
            total_metrics.operations_failed += metrics.operations_failed
            total_metrics.operations_retried += metrics.operations_retried
        
        return {
            "manager_running": self.running,
            "worker_count": len(self.worker_tasks),
            "queue_size": self.operation_queue.qsize(),
            "total_operations_completed": total_metrics.operations_completed,
            "total_operations_failed": total_metrics.operations_failed,
            "services": service_statuses
        }
    
    async def _register_core_services(self) -> None:
        """Register the core background services."""
        # Auto-embedding service
        auto_embed_service = AutoEmbeddingService(self.config)
        await self.register_service(auto_embed_service)
        
        # Dependency cycle detection service
        cycle_detection_service = CycleDependencyService(self.config)
        await self.register_service(cycle_detection_service)
        
        # Incremental sync service
        incremental_sync_service = IncrementalSyncService(self.config)
        await self.register_service(incremental_sync_service)
        
        # Index optimization service
        index_optimization_service = IndexOptimizationService(self.config)
        await self.register_service(index_optimization_service)
    
    async def _worker_loop(self, worker_id: int) -> None:
        """Main worker loop for processing operations."""
        logger.debug(f"Started background worker {worker_id}")
        
        try:
            while self.running:
                try:
                    # Get next operation with timeout
                    operation = await asyncio.wait_for(
                        self.operation_queue.get(),
                        timeout=1.0
                    )
                    
                    # Process the operation
                    await self._process_operation(operation)
                    
                except asyncio.TimeoutError:
                    # Normal timeout, continue loop
                    continue
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.error(f"Worker {worker_id} error: {e}")
                    
        except asyncio.CancelledError:
            logger.debug(f"Background worker {worker_id} cancelled")
        except Exception as e:
            logger.error(f"Background worker {worker_id} crashed: {e}")
        finally:
            logger.debug(f"Background worker {worker_id} stopped")
    
    async def _scheduler_loop(self) -> None:
        """Scheduler loop for delayed operations."""
        logger.debug("Started background scheduler")
        
        try:
            while self.running:
                try:
                    # Check for scheduled operations every 10 seconds
                    await asyncio.sleep(10)
                    
                    # TODO: Implement scheduled operation processing
                    # This would check a persistent store for delayed operations
                    # and add them to the queue when their time comes
                    
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.error(f"Scheduler error: {e}")
                    
        except asyncio.CancelledError:
            logger.debug("Background scheduler cancelled")
        except Exception as e:
            logger.error(f"Background scheduler crashed: {e}")
        finally:
            logger.debug("Background scheduler stopped")
    
    async def _process_operation(self, operation: ServiceOperation) -> None:
        """Process a single background operation."""
        start_time = time.time()
        success = False
        
        try:
            # Get the service for this operation
            service = self.services.get(operation.service_type)
            if not service or not service.enabled:
                logger.warning(f"Service {operation.service_type.value} not available or disabled")
                return
            
            # Process the operation
            await service.process_operation(operation)
            success = True
            
            logger.debug(f"Completed {operation.service_type.value} operation {operation.operation_type}")
            
        except Exception as e:
            logger.error(f"Failed to process operation {operation.id}: {e}")
            operation.last_error = str(e)
            operation.retries += 1
            
            # Retry if possible
            if operation.should_retry():
                delay = operation.get_retry_delay()
                logger.info(f"Retrying operation {operation.id} in {delay} seconds")
                asyncio.create_task(self._delayed_schedule(operation, delay))
                self.metrics[operation.service_type].operations_retried += 1
        
        finally:
            # Record metrics
            duration = time.time() - start_time
            self.metrics[operation.service_type].record_operation(duration, success)
            
            # Add to history (keep last 1000 operations)
            self.operation_history.append(operation)
            if len(self.operation_history) > 1000:
                self.operation_history.pop(0)
    
    async def _delayed_schedule(self, operation: ServiceOperation, delay_seconds: float) -> None:
        """Schedule an operation with delay."""
        await asyncio.sleep(delay_seconds)
        if self.running:
            await self.operation_queue.put(operation)


class BackgroundService:
    """
    Base class for background services.
    
    Each service implements specific background operations like embedding
    generation, cycle detection, sync operations, etc.
    """
    
    def __init__(self, service_type: ServiceType, config: BackgroundServiceConfig):
        """Initialize the background service."""
        self.service_type = service_type
        self.config = config
        self.enabled = True
        self.status = ServiceStatus.STOPPED
        
        logger.debug(f"Initialized {service_type.value} background service")
    
    async def start(self) -> None:
        """Start the background service."""
        if self.status == ServiceStatus.RUNNING:
            return
        
        try:
            await self._initialize_service()
            self.status = ServiceStatus.RUNNING
            logger.info(f"Started {self.service_type.value} background service")
        except Exception as e:
            self.status = ServiceStatus.ERROR
            logger.error(f"Failed to start {self.service_type.value} service: {e}")
            raise
    
    async def stop(self) -> None:
        """Stop the background service."""
        if self.status == ServiceStatus.STOPPED:
            return
        
        try:
            await self._cleanup_service()
            self.status = ServiceStatus.STOPPED
            logger.info(f"Stopped {self.service_type.value} background service")
        except Exception as e:
            logger.error(f"Error stopping {self.service_type.value} service: {e}")
    
    async def process_operation(self, operation: ServiceOperation) -> None:
        """Process a background operation."""
        if not self.enabled or self.status != ServiceStatus.RUNNING:
            raise RuntimeError(f"Service {self.service_type.value} not available")
        
        # Delegate to specific service implementation
        await self._process_operation_impl(operation)
    
    async def _initialize_service(self) -> None:
        """Initialize service-specific resources."""
        pass
    
    async def _cleanup_service(self) -> None:
        """Clean up service-specific resources."""
        pass
    
    async def _process_operation_impl(self, operation: ServiceOperation) -> None:
        """Process operation - must be implemented by subclasses."""
        raise NotImplementedError(f"Service {self.service_type.value} must implement _process_operation_impl")


# Specific service implementations with full functionality
class AutoEmbeddingService(BackgroundService):
    """Automatic embedding generation service."""
    
    def __init__(self, config: BackgroundServiceConfig):
        super().__init__(ServiceType.AUTO_EMBEDDING, config)
        self.chroma_client = None
        self.task_service = None
        self.embedding_batch = []
        self.last_batch_time = time.time()
    
    async def _initialize_service(self) -> None:
        """Initialize service for embeddings."""
        # Services will be injected by manager
        if not self.chroma_client:
            logger.warning("Chroma client not available for embedding service")
    
    async def _process_operation_impl(self, operation: ServiceOperation) -> None:
        """Generate embeddings for tasks."""
        if operation.operation_type == "embed_task":
            await self._generate_task_embedding(operation)
        elif operation.operation_type == "batch_embed":
            await self._process_embedding_batch()
        else:
            raise ValueError(f"Unknown operation type: {operation.operation_type}")
    
    async def _generate_task_embedding(self, operation: ServiceOperation) -> None:
        """Generate embedding for a single task."""
        task_id = operation.target_id
        payload = operation.payload
        
        try:
            if not self.chroma_client or not self.task_service:
                logger.warning(f"Services not available for embedding task {task_id}")
                return
            
            # Get task data
            task_data = payload.get("task_data")
            if not task_data:
                # Fetch task from database
                task = await self.task_service.get_task(task_id)
                if not task:
                    logger.error(f"Task {task_id} not found for embedding")
                    return
                task_data = task.to_dict()
            
            # Prepare content for embedding
            content = f"{task_data['title']}\n\n{task_data['description']}"
            if task_data.get('metadata', {}).get('source_references'):
                content += "\n\nReferences:\n" + "\n".join(task_data['metadata']['source_references'])
            
            # Limit content length
            embedding_config = self.config.get_service_config(ServiceType.AUTO_EMBEDDING)
            if len(content) > embedding_config.max_content_length:
                content = content[:embedding_config.max_content_length] + "..."
            
            # Get tasks_content collection
            collection = self.chroma_client.get_collection("tasks_content")
            
            # Prepare metadata
            metadata = {
                "task_id": task_id,
                "title": task_data['title'],
                "project_id": task_data.get('project_id', ''),
                "status": task_data['status'],
                "priority": task_data['priority'],
                "created_at": task_data['created_at'],
                "updated_at": task_data['updated_at'],
                "embedding_version": 1,
                "embedded_at": datetime.now().isoformat()
            }
            
            # Add or update document
            doc_id = f"task_{task_id}_content"
            
            try:
                # Try to update existing document
                collection.update(
                    ids=[doc_id],
                    documents=[content],
                    metadatas=[metadata]
                )
                logger.debug(f"Updated embedding for task {task_id}")
            except Exception:
                # Document doesn't exist, create new one
                collection.add(
                    ids=[doc_id],
                    documents=[content],
                    metadatas=[metadata]
                )
                logger.debug(f"Created new embedding for task {task_id}")
            
            # Update task sync status if possible
            if self.task_service:
                try:
                    await self.task_service.update_task(task_id, {
                        "triple_db.last_embedded": datetime.now(),
                        "triple_db.chroma_synced": True
                    })
                except Exception as e:
                    logger.warning(f"Failed to update task sync status: {e}")
                    
        except Exception as e:
            logger.error(f"Failed to generate embedding for task {task_id}: {e}")
            raise
    
    async def _process_embedding_batch(self) -> None:
        """Process a batch of embedding operations."""
        if not self.embedding_batch:
            return
        
        try:
            # Process all tasks in batch
            for task_data in self.embedding_batch:
                operation = ServiceOperation(
                    id=f"batch_{task_data['id']}",
                    service_type=ServiceType.AUTO_EMBEDDING,
                    priority=ServicePriority.NORMAL,
                    operation_type="embed_task",
                    target_id=task_data['id'],
                    payload={"task_data": task_data},
                    created_at=datetime.now()
                )
                await self._generate_task_embedding(operation)
            
            logger.info(f"Processed embedding batch of {len(self.embedding_batch)} tasks")
            
        finally:
            # Clear batch
            self.embedding_batch.clear()
            self.last_batch_time = time.time()


class CycleDependencyService(BackgroundService):
    """Automatic dependency cycle detection service."""
    
    def __init__(self, config: BackgroundServiceConfig):
        super().__init__(ServiceType.CYCLE_DETECTION, config)
        self.kuzu_database = None
        self.last_cycle_check = {}
    
    async def _initialize_service(self) -> None:
        """Initialize cycle detection service."""
        if not self.kuzu_database:
            logger.warning("KuzuDB not available for cycle detection service")
    
    async def _process_operation_impl(self, operation: ServiceOperation) -> None:
        """Detect dependency cycles."""
        if operation.operation_type == "check_cycles":
            await self._detect_cycles(operation)
        elif operation.operation_type == "full_cycle_check":
            await self._full_dependency_audit()
        else:
            raise ValueError(f"Unknown operation type: {operation.operation_type}")
    
    async def _detect_cycles(self, operation: ServiceOperation) -> None:
        """Detect cycles starting from affected tasks."""
        if not self.kuzu_database:
            logger.warning("KuzuDB not available for cycle detection")
            return
        
        task_id = operation.target_id
        payload = operation.payload
        affected_tasks = payload.get("affected_tasks", [task_id])
        
        try:
            connection = kuzu.Connection(self.kuzu_database)
            cycles_found = []
            
            # Check for cycles from each affected task
            for start_task_id in affected_tasks:
                cycles = await self._find_cycles_from_task(connection, start_task_id)
                cycles_found.extend(cycles)
            
            if cycles_found:
                logger.warning(f"Found {len(cycles_found)} dependency cycles involving task {task_id}")
                
                # Log cycle details
                for i, cycle in enumerate(cycles_found[:5]):  # Log first 5 cycles
                    cycle_path = " -> ".join([node['id'] for node in cycle['path']])
                    logger.warning(f"Cycle {i+1}: {cycle_path}")
                
                # TODO: Implement cycle resolution strategies:
                # 1. Notify users about cycles
                # 2. Suggest dependency modifications
                # 3. Auto-break cycles based on priority
                
            else:
                logger.debug(f"No dependency cycles found for task {task_id}")
            
            # Update last check time
            self.last_cycle_check[task_id] = datetime.now()
                
        except Exception as e:
            logger.error(f"Failed to detect cycles for task {task_id}: {e}")
            raise
        finally:
            connection.close()
    
    async def _find_cycles_from_task(self, connection, start_task_id: str) -> List[Dict[str, Any]]:
        """Find all cycles starting from a specific task."""
        cycles = []
        
        try:
            # Use KuzuDB to find cycles
            query = """
                MATCH path = (start:Task {id: $start_id})-[:DEPENDS_ON*1..10]->(start)
                RETURN path
                LIMIT 100
            """
            
            result = connection.execute(query, {"start_id": start_task_id})
            
            while result.hasNext():
                row = result.getNext()
                path_data = row[0]
                
                # Extract cycle information
                cycle = {
                    "start_task_id": start_task_id,
                    "length": len(path_data.get("nodes", [])),
                    "path": path_data.get("nodes", []),
                    "detected_at": datetime.now().isoformat()
                }
                cycles.append(cycle)
            
        except Exception as e:
            logger.error(f"Failed to find cycles from task {start_task_id}: {e}")
        
        return cycles
    
    async def _full_dependency_audit(self) -> None:
        """Perform a full audit of all dependencies for cycles."""
        if not self.kuzu_database:
            return
        
        try:
            connection = kuzu.Connection(self.kuzu_database)
            
            # Get all tasks with dependencies
            query = """
                MATCH (t:Task)-[:DEPENDS_ON]->()
                RETURN DISTINCT t.id as task_id
            """
            
            result = connection.execute(query)
            task_ids = []
            
            while result.hasNext():
                row = result.getNext()
                task_ids.append(row[0])
            
            logger.info(f"Starting full dependency audit for {len(task_ids)} tasks")
            
            total_cycles = 0
            for task_id in task_ids:
                cycles = await self._find_cycles_from_task(connection, task_id)
                total_cycles += len(cycles)
                
                # Rate limit to avoid overwhelming the system
                await asyncio.sleep(0.1)
            
            logger.info(f"Full dependency audit completed. Found {total_cycles} total cycle instances")
            
        except Exception as e:
            logger.error(f"Failed to perform full dependency audit: {e}")
        finally:
            connection.close()


class IncrementalSyncService(BackgroundService):
    """Incremental synchronization service."""
    
    def __init__(self, config: BackgroundServiceConfig):
        super().__init__(ServiceType.INCREMENTAL_SYNC, config)
        self.task_service = None
        self.chroma_client = None
        self.kuzu_database = None
        self.sync_queue = []
        self.last_sync_time = time.time()
    
    async def _initialize_service(self) -> None:
        """Initialize incremental sync service."""
        # Services will be injected by manager
        pass
    
    async def _process_operation_impl(self, operation: ServiceOperation) -> None:
        """Perform incremental sync operations."""
        if operation.operation_type == "sync_task":
            await self._sync_single_task(operation)
        elif operation.operation_type == "cleanup_task":
            await self._cleanup_deleted_task(operation)
        elif operation.operation_type == "batch_sync":
            await self._process_sync_batch()
        else:
            raise ValueError(f"Unknown operation type: {operation.operation_type}")
    
    async def _sync_single_task(self, operation: ServiceOperation) -> None:
        """Sync a single task to all databases."""
        task_id = operation.target_id
        payload = operation.payload
        
        try:
            # Get task data
            task_data = payload.get("task_data")
            if not task_data and self.task_service:
                task = await self.task_service.get_task(task_id)
                if task:
                    task_data = task.to_dict()
            
            if not task_data:
                logger.error(f"No task data available for sync: {task_id}")
                return
            
            # Sync to Chroma
            if self.chroma_client:
                await self._sync_task_to_chroma(task_data)
            
            # Sync to KuzuDB
            if self.kuzu_database:
                await self._sync_task_to_kuzu(task_data)
            
            logger.debug(f"Incrementally synced task {task_id}")
            
        except Exception as e:
            logger.error(f"Failed to sync task {task_id}: {e}")
            raise
    
    async def _sync_task_to_chroma(self, task_data: Dict[str, Any]) -> None:
        """Sync task to Chroma vector database."""
        try:
            collection = self.chroma_client.get_collection("tasks_content")
            
            # Prepare document content
            content = f"{task_data['title']}\n\n{task_data['description']}"
            
            # Prepare metadata
            metadata = {
                "task_id": task_data['id'],
                "title": task_data['title'],
                "status": task_data['status'],
                "priority": task_data['priority'],
                "project_id": task_data.get('project_id', ''),
                "updated_at": task_data['updated_at'],
                "synced_at": datetime.now().isoformat()
            }
            
            doc_id = f"task_{task_data['id']}_content"
            
            try:
                collection.update(
                    ids=[doc_id],
                    documents=[content],
                    metadatas=[metadata]
                )
            except Exception:
                collection.add(
                    ids=[doc_id],
                    documents=[content],
                    metadatas=[metadata]
                )
            
        except Exception as e:
            logger.error(f"Failed to sync task {task_data['id']} to Chroma: {e}")
    
    async def _sync_task_to_kuzu(self, task_data: Dict[str, Any]) -> None:
        """Sync task to KuzuDB graph database."""
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
                    t.updated_at = $updated_at,
                    t.project_id = $project_id,
                    t.synced_at = $sync_time
            """
            
            parameters = {
                "id": task_data['id'],
                "title": task_data['title'],
                "description": task_data['description'],
                "status": task_data['status'],
                "priority": task_data['priority'],
                "updated_at": task_data['updated_at'],
                "project_id": task_data.get('project_id', ''),
                "sync_time": datetime.now()
            }
            
            connection.execute(query, parameters)
            
        except Exception as e:
            logger.error(f"Failed to sync task {task_data['id']} to KuzuDB: {e}")
        finally:
            connection.close()
    
    async def _cleanup_deleted_task(self, operation: ServiceOperation) -> None:
        """Clean up a deleted task from all databases."""
        task_id = operation.target_id
        
        try:
            # Clean up from Chroma
            if self.chroma_client:
                collection = self.chroma_client.get_collection("tasks_content")
                doc_id = f"task_{task_id}_content"
                try:
                    collection.delete(ids=[doc_id])
                except Exception as e:
                    logger.debug(f"Task {task_id} not found in Chroma: {e}")
            
            # Clean up from KuzuDB
            if self.kuzu_database:
                connection = kuzu.Connection(self.kuzu_database)
                try:
                    query = "MATCH (t:Task {id: $id}) DETACH DELETE t"
                    connection.execute(query, {"id": task_id})
                except Exception as e:
                    logger.debug(f"Task {task_id} not found in KuzuDB: {e}")
                finally:
                    connection.close()
            
            logger.debug(f"Cleaned up deleted task {task_id} from all databases")
            
        except Exception as e:
            logger.error(f"Failed to cleanup deleted task {task_id}: {e}")
    
    async def _process_sync_batch(self) -> None:
        """Process a batch of sync operations."""
        if not self.sync_queue:
            return
        
        try:
            # Process all queued sync operations
            for sync_data in self.sync_queue:
                operation = ServiceOperation(
                    id=f"batch_{sync_data['id']}",
                    service_type=ServiceType.INCREMENTAL_SYNC,
                    priority=ServicePriority.NORMAL,
                    operation_type="sync_task",
                    target_id=sync_data['id'],
                    payload={"task_data": sync_data},
                    created_at=datetime.now()
                )
                await self._sync_single_task(operation)
            
            logger.info(f"Processed sync batch of {len(self.sync_queue)} tasks")
            
        finally:
            # Clear queue
            self.sync_queue.clear()
            self.last_sync_time = time.time()


class IndexOptimizationService(BackgroundService):
    """Database index optimization service."""
    
    def __init__(self, config: BackgroundServiceConfig):
        super().__init__(ServiceType.INDEX_OPTIMIZATION, config)
        self.task_service = None
        self.chroma_client = None
        self.kuzu_database = None
        self.last_optimization = None
        self.operation_count = 0
    
    async def _initialize_service(self) -> None:
        """Initialize index optimization service."""
        self.last_optimization = datetime.now()
    
    async def _process_operation_impl(self, operation: ServiceOperation) -> None:
        """Optimize database indices."""
        if operation.operation_type == "optimize_indices":
            await self._optimize_all_indices(operation)
        elif operation.operation_type == "vacuum_sqlite":
            await self._vacuum_sqlite()
        elif operation.operation_type == "optimize_chroma":
            await self._optimize_chroma_indices()
        elif operation.operation_type == "optimize_kuzu":
            await self._optimize_kuzu_indices()
        else:
            raise ValueError(f"Unknown operation type: {operation.operation_type}")
    
    async def _optimize_all_indices(self, operation: ServiceOperation) -> None:
        """Optimize all database indices."""
        optimization_start = time.time()
        optimizations_performed = []
        
        try:
            config = self.config.get_service_config(ServiceType.INDEX_OPTIMIZATION)
            
            # SQLite optimization
            if config.vacuum_sqlite and self.task_service:
                await self._vacuum_sqlite()
                optimizations_performed.append("SQLite VACUUM")
            
            # Chroma optimization
            if config.optimize_chroma_indices and self.chroma_client:
                await self._optimize_chroma_indices()
                optimizations_performed.append("Chroma indices")
            
            # KuzuDB optimization
            if config.optimize_kuzu_indices and self.kuzu_database:
                await self._optimize_kuzu_indices()
                optimizations_performed.append("KuzuDB indices")
            
            optimization_duration = time.time() - optimization_start
            self.last_optimization = datetime.now()
            self.operation_count = 0
            
            logger.info(
                f"Index optimization completed in {optimization_duration:.2f}s. "
                f"Optimized: {', '.join(optimizations_performed)}"
            )
            
        except Exception as e:
            logger.error(f"Failed to optimize indices: {e}")
            raise
    
    async def _vacuum_sqlite(self) -> None:
        """Vacuum SQLite database to reclaim space and optimize indices."""
        if not self.task_service:
            return
        
        try:
            # Get database connection
            db_path = self.task_service.db_path
            
            # Run VACUUM and ANALYZE
            import sqlite3
            conn = sqlite3.connect(db_path)
            
            try:
                conn.execute("VACUUM")
                conn.execute("ANALYZE")
                conn.commit()
                logger.debug("SQLite VACUUM and ANALYZE completed")
            finally:
                conn.close()
                
        except Exception as e:
            logger.error(f"Failed to vacuum SQLite database: {e}")
    
    async def _optimize_chroma_indices(self) -> None:
        """Optimize Chroma vector database indices."""
        if not self.chroma_client:
            return
        
        try:
            # Get all collections
            collections = self.chroma_client.list_collections()
            
            for collection in collections:
                try:
                    # Get collection info
                    collection_obj = self.chroma_client.get_collection(collection.name)
                    count = collection_obj.count()
                    
                    logger.debug(f"Chroma collection '{collection.name}' has {count} documents")
                    
                    # Note: Chroma handles index optimization automatically
                    # This is mainly for monitoring and logging
                    
                except Exception as e:
                    logger.warning(f"Failed to check Chroma collection {collection.name}: {e}")
            
            logger.debug("Chroma index optimization check completed")
            
        except Exception as e:
            logger.error(f"Failed to optimize Chroma indices: {e}")
    
    async def _optimize_kuzu_indices(self) -> None:
        """Optimize KuzuDB graph database indices."""
        if not self.kuzu_database:
            return
        
        connection = kuzu.Connection(self.kuzu_database)
        
        try:
            # Get statistics about the graph
            queries = [
                "MATCH (t:Task) RETURN count(t) as task_count",
                "MATCH ()-[r:DEPENDS_ON]->() RETURN count(r) as dependency_count",
                "MATCH ()-[r:HAS_SUBTASK]->() RETURN count(r) as subtask_count"
            ]
            
            stats = {}
            for query in queries:
                try:
                    result = connection.execute(query)
                    if result.hasNext():
                        row = result.getNext()
                        key = query.split("as ")[1].split()[0]
                        stats[key] = row[0]
                except Exception as e:
                    logger.warning(f"Failed to execute stats query: {e}")
            
            logger.debug(f"KuzuDB statistics: {stats}")
            
            # Note: KuzuDB handles index optimization automatically
            # This is mainly for monitoring and statistics
            
        except Exception as e:
            logger.error(f"Failed to optimize KuzuDB indices: {e}")
        finally:
            connection.close()
    
    def should_optimize(self) -> bool:
        """Check if optimization should be triggered."""
        if not self.last_optimization:
            return True
        
        config = self.config.get_service_config(ServiceType.INDEX_OPTIMIZATION)
        
        # Check time-based optimization
        hours_since_last = (datetime.now() - self.last_optimization).total_seconds() / 3600
        if hours_since_last >= config.optimize_interval_hours:
            return True
        
        # Check operation count-based optimization
        if (config.optimize_on_large_changes and 
            self.operation_count >= config.large_change_threshold):
            return True
        
        return False
    
    def record_operation(self) -> None:
        """Record that an operation occurred (for threshold-based optimization)."""
        self.operation_count += 1