"""Core BackgroundTaskExecutionManager with task queuing, execution tracking, and result storage."""

import time
import threading
import pickle
import json
from typing import Dict, List, Optional, Any, Callable, Union
from dataclasses import dataclass, asdict
from enum import Enum
from pathlib import Path
from concurrent.futures import Future
import queue
import logging

from .manager import BackgroundManager, ProcessState
from .execution import BackgroundExecutor
from .status import BackgroundStatus, PerformanceMonitor


class TaskPriority(Enum):
    """Task priority levels."""
    LOW = 0
    NORMAL = 1
    HIGH = 2
    CRITICAL = 3


class TaskStatus(Enum):
    """Extended task status."""
    QUEUED = "queued"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class TaskResult:
    """Container for task execution results."""
    task_id: str
    status: TaskStatus
    result: Any = None
    error: Optional[str] = None
    execution_time: Optional[float] = None
    created_at: float = 0.0
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class QueuedTask:
    """Represents a queued task."""
    task_id: str
    name: str
    func: Callable[..., Any]
    args: tuple
    kwargs: dict
    priority: TaskPriority
    metadata: Optional[Dict[str, Any]]
    created_at: float
    max_retries: int = 0
    retry_count: int = 0


class BackgroundTaskExecutionManager:
    """
    Core manager with task queuing, execution tracking, and result storage.
    
    Provides a unified interface for:
    - Priority-based task queuing
    - Thread-safe execution tracking
    - Persistent result storage
    - Performance monitoring
    - Task retry mechanisms
    """
    
    def __init__(self, 
                 max_workers: int = 4,
                 result_storage_path: Optional[Path] = None,
                 max_queue_size: int = 1000,
                 enable_persistence: bool = True):
        """
        Initialize the task execution manager.
        
        Args:
            max_workers: Maximum number of worker threads
            result_storage_path: Path for persistent result storage
            max_queue_size: Maximum number of tasks in queue
            enable_persistence: Enable persistent result storage
        """
        # Core components
        self._manager = BackgroundManager()
        self._executor = BackgroundExecutor(self._manager, max_workers)
        self._status = BackgroundStatus(self._manager)
        self._performance = PerformanceMonitor(self._status)
        
        # Task queue with priority support
        self._task_queue = queue.PriorityQueue(maxsize=max_queue_size)
        self._queued_tasks: Dict[str, QueuedTask] = {}
        
        # Result storage
        self._results: Dict[str, TaskResult] = {}
        self._storage_path = result_storage_path or Path.cwd() / ".vespera_task_results"
        self._enable_persistence = enable_persistence
        
        # Threading
        self._lock = threading.RLock()
        self._queue_worker_thread: Optional[threading.Thread] = None
        self._shutdown = False
        
        # Initialize storage
        if self._enable_persistence:
            self._init_storage()
            self._load_results()
        
        # Start queue processing
        self._start_queue_worker()
        
        # Logging
        self._logger = logging.getLogger(__name__)
    
    def submit_task(self, 
                   name: str,
                   func: Callable[..., Any],
                   *args,
                   priority: TaskPriority = TaskPriority.NORMAL,
                   metadata: Optional[Dict[str, Any]] = None,
                   max_retries: int = 0,
                   **kwargs) -> str:
        """
        Submit a task for background execution.
        
        Args:
            name: Human-readable task name
            func: Function to execute
            *args: Positional arguments for the function
            priority: Task priority level
            metadata: Optional metadata dictionary
            max_retries: Maximum number of retry attempts
            **kwargs: Keyword arguments for the function
            
        Returns:
            Task ID for tracking
        """
        if self._shutdown:
            raise RuntimeError("Task execution manager is shutting down")
        
        # Generate unique task ID
        task_id = f"task_{int(time.time() * 1000000)}"
        
        # Create queued task
        queued_task = QueuedTask(
            task_id=task_id,
            name=name,
            func=func,
            args=args,
            kwargs=kwargs,
            priority=priority,
            metadata=metadata or {},
            created_at=time.time(),
            max_retries=max_retries
        )
        
        with self._lock:
            # Store queued task
            self._queued_tasks[task_id] = queued_task
            
            # Create initial result entry
            self._results[task_id] = TaskResult(
                task_id=task_id,
                status=TaskStatus.QUEUED,
                created_at=time.time(),
                metadata=metadata
            )
        
        # Add to priority queue (lower priority number = higher priority)
        try:
            self._task_queue.put((-priority.value, time.time(), task_id), timeout=1.0)
            self._logger.info(f"Task {task_id} ({name}) queued with priority {priority.name}")
        except queue.Full:
            # Remove from tracking if queue is full
            with self._lock:
                del self._queued_tasks[task_id]
                del self._results[task_id]
            raise RuntimeError("Task queue is full")
        
        return task_id
    
    def get_task_result(self, task_id: str, timeout: Optional[float] = None) -> Optional[TaskResult]:
        """
        Get the result of a task.
        
        Args:
            task_id: Task identifier
            timeout: Optional timeout for waiting
            
        Returns:
            TaskResult if available, None otherwise
        """
        with self._lock:
            result = self._results.get(task_id)
            if not result:
                return None
            
            # If task is still running and timeout is specified, wait for completion
            if result.status in [TaskStatus.QUEUED, TaskStatus.RUNNING] and timeout:
                # Release lock while waiting
                pass
        
        # Wait for completion if requested
        if timeout and result and result.status in [TaskStatus.QUEUED, TaskStatus.RUNNING]:
            start_time = time.time()
            while time.time() - start_time < timeout:
                with self._lock:
                    updated_result = self._results.get(task_id)
                    if updated_result and updated_result.status not in [TaskStatus.QUEUED, TaskStatus.RUNNING]:
                        return updated_result
                time.sleep(0.1)
        
        return result
    
    def cancel_task(self, task_id: str) -> bool:
        """
        Cancel a queued or running task.
        
        Args:
            task_id: Task identifier
            
        Returns:
            True if cancellation was successful
        """
        with self._lock:
            # Check if task exists
            if task_id not in self._results:
                return False
            
            result = self._results[task_id]
            
            # Cancel queued task
            if result.status == TaskStatus.QUEUED:
                result.status = TaskStatus.CANCELLED
                result.completed_at = time.time()
                if task_id in self._queued_tasks:
                    del self._queued_tasks[task_id]
                self._save_result(result)
                return True
            
            # Cancel running task
            if result.status == TaskStatus.RUNNING:
                cancelled = self._executor.cancel_task(task_id)
                if cancelled:
                    result.status = TaskStatus.CANCELLED
                    result.completed_at = time.time()
                    self._save_result(result)
                return cancelled
        
        return False
    
    def pause_task(self, task_id: str) -> bool:
        """
        Pause a running task.
        
        Args:
            task_id: Task identifier
            
        Returns:
            True if pause was successful
        """
        return self._manager.pause_process(task_id)
    
    def resume_task(self, task_id: str) -> bool:
        """
        Resume a paused task.
        
        Args:
            task_id: Task identifier
            
        Returns:
            True if resume was successful
        """
        return self._manager.resume_process(task_id)
    
    def list_tasks(self, status: Optional[TaskStatus] = None) -> List[TaskResult]:
        """
        List all tasks, optionally filtered by status.
        
        Args:
            status: Optional status filter
            
        Returns:
            List of TaskResult objects
        """
        with self._lock:
            results = list(self._results.values())
            
            if status:
                results = [r for r in results if r.status == status]
            
            # Sort by creation time
            results.sort(key=lambda x: x.created_at, reverse=True)
            return results
    
    def get_queue_info(self) -> Dict[str, Any]:
        """
        Get information about the current task queue.
        
        Returns:
            Dictionary with queue statistics
        """
        with self._lock:
            queued_count = len(self._queued_tasks)
            queue_size = self._task_queue.qsize()
            
            # Count by priority
            priority_counts = {p.name: 0 for p in TaskPriority}
            for task in self._queued_tasks.values():
                priority_counts[task.priority.name] += 1
        
        return {
            "queued_tasks": queued_count,
            "queue_size": queue_size,
            "max_queue_size": self._task_queue.maxsize,
            "priority_breakdown": priority_counts,
            "worker_threads": self._executor.executor._max_workers,
            "is_processing": not self._shutdown
        }
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """
        Get comprehensive performance metrics.
        
        Returns:
            Dictionary with performance data
        """
        base_metrics = self._performance.get_performance_summary()
        queue_info = self.get_queue_info()
        
        # Add task-specific metrics
        with self._lock:
            completed_tasks = [r for r in self._results.values() if r.status == TaskStatus.COMPLETED]
            failed_tasks = [r for r in self._results.values() if r.status == TaskStatus.FAILED]
            
            # Calculate average execution time
            avg_execution_time = None
            if completed_tasks:
                execution_times = [t.execution_time for t in completed_tasks if t.execution_time]
                if execution_times:
                    avg_execution_time = sum(execution_times) / len(execution_times)
        
        return {
            **base_metrics,
            "queue_info": queue_info,
            "task_metrics": {
                "completed_tasks": len(completed_tasks),
                "failed_tasks": len(failed_tasks),
                "average_execution_time": avg_execution_time,
                "total_stored_results": len(self._results)
            }
        }
    
    def cleanup_completed(self, max_age_hours: float = 24.0) -> int:
        """
        Clean up old completed/failed task results.
        
        Args:
            max_age_hours: Maximum age in hours for task results
            
        Returns:
            Number of results cleaned up
        """
        cutoff_time = time.time() - (max_age_hours * 3600)
        removed_count = 0
        
        with self._lock:
            to_remove = []
            for task_id, result in self._results.items():
                if (result.status in [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED] and
                    result.completed_at and result.completed_at < cutoff_time):
                    to_remove.append(task_id)
            
            for task_id in to_remove:
                del self._results[task_id]
                if self._enable_persistence:
                    self._delete_result_file(task_id)
                removed_count += 1
        
        # Also cleanup the underlying manager
        manager_cleanup = self._manager.cleanup_completed(max_age_hours)
        
        self._logger.info(f"Cleaned up {removed_count} task results and {manager_cleanup} processes")
        return removed_count
    
    def shutdown(self, wait: bool = True, timeout: float = 30.0):
        """
        Shutdown the task execution manager.
        
        Args:
            wait: Whether to wait for running tasks to complete
            timeout: Maximum time to wait for shutdown
        """
        self._logger.info("Shutting down BackgroundTaskExecutionManager")
        self._shutdown = True
        
        # Stop accepting new tasks
        with self._lock:
            # Cancel all queued tasks
            for task_id in list(self._queued_tasks.keys()):
                self.cancel_task(task_id)
        
        # Stop queue worker
        if self._queue_worker_thread:
            self._queue_worker_thread.join(timeout=5.0)
        
        # Shutdown executor
        self._executor.shutdown(wait=wait)
        
        # Final result save
        if self._enable_persistence:
            self._save_all_results()
        
        self._logger.info("BackgroundTaskExecutionManager shutdown complete")
    
    # Private methods
    
    def _start_queue_worker(self):
        """Start the background queue processing thread."""
        self._queue_worker_thread = threading.Thread(
            target=self._queue_worker,
            daemon=True,
            name="TaskExecutionManager-QueueWorker"
        )
        self._queue_worker_thread.start()
    
    def _queue_worker(self):
        """Process tasks from the priority queue."""
        while not self._shutdown:
            try:
                # Get next task from queue with timeout
                _, _, task_id = self._task_queue.get(timeout=1.0)
                
                with self._lock:
                    if task_id not in self._queued_tasks:
                        continue
                    
                    queued_task = self._queued_tasks[task_id]
                    del self._queued_tasks[task_id]
                    
                    # Update result status
                    if task_id in self._results:
                        self._results[task_id].status = TaskStatus.RUNNING
                        self._results[task_id].started_at = time.time()
                
                # Execute task
                self._execute_task(queued_task)
                
            except queue.Empty:
                continue
            except Exception as e:
                self._logger.error(f"Error in queue worker: {e}")
    
    def _execute_task(self, queued_task: QueuedTask):
        """Execute a queued task with result tracking."""
        task_id = queued_task.task_id
        start_time = time.time()
        
        try:
            # Execute the task function
            result_value = queued_task.func(*queued_task.args, **queued_task.kwargs)
            
            # Record successful completion
            with self._lock:
                if task_id in self._results:
                    result = self._results[task_id]
                    result.status = TaskStatus.COMPLETED
                    result.result = result_value
                    result.completed_at = time.time()
                    result.execution_time = time.time() - start_time
                    self._save_result(result)
            
            self._logger.info(f"Task {task_id} completed successfully")
            
        except Exception as e:
            error_msg = f"{type(e).__name__}: {str(e)}"
            
            # Check for retry
            if queued_task.retry_count < queued_task.max_retries:
                queued_task.retry_count += 1
                self._logger.warning(f"Task {task_id} failed (attempt {queued_task.retry_count}), retrying: {error_msg}")
                
                # Re-queue for retry
                with self._lock:
                    self._queued_tasks[task_id] = queued_task
                    if task_id in self._results:
                        self._results[task_id].status = TaskStatus.QUEUED
                
                self._task_queue.put((-queued_task.priority.value, time.time(), task_id))
                return
            
            # Record failure
            with self._lock:
                if task_id in self._results:
                    result = self._results[task_id]
                    result.status = TaskStatus.FAILED
                    result.error = error_msg
                    result.completed_at = time.time()
                    result.execution_time = time.time() - start_time
                    self._save_result(result)
            
            self._logger.error(f"Task {task_id} failed after {queued_task.retry_count} retries: {error_msg}")
    
    def _init_storage(self):
        """Initialize persistent storage."""
        self._storage_path.mkdir(parents=True, exist_ok=True)
    
    def _load_results(self):
        """Load results from persistent storage."""
        if not self._storage_path.exists():
            return
        
        loaded_count = 0
        for result_file in self._storage_path.glob("task_*.json"):
            try:
                with open(result_file, 'r') as f:
                    data = json.load(f)
                
                result = TaskResult(**data)
                self._results[result.task_id] = result
                loaded_count += 1
                
            except Exception as e:
                self._logger.warning(f"Failed to load result from {result_file}: {e}")
        
        if loaded_count > 0:
            self._logger.info(f"Loaded {loaded_count} task results from storage")
    
    def _save_result(self, result: TaskResult):
        """Save a single result to persistent storage."""
        if not self._enable_persistence:
            return
        
        try:
            result_file = self._storage_path / f"task_{result.task_id}.json"
            
            # Convert result to dict, handling non-serializable objects
            data = asdict(result)
            data['status'] = result.status.value
            
            # Handle non-serializable result values
            if result.result is not None:
                try:
                    json.dumps(result.result)  # Test serializability
                    data['result'] = result.result
                except (TypeError, ValueError):
                    # Store as string representation if not serializable
                    data['result'] = f"<non-serializable: {type(result.result).__name__}>"
            
            with open(result_file, 'w') as f:
                json.dump(data, f, indent=2)
                
        except Exception as e:
            self._logger.warning(f"Failed to save result for task {result.task_id}: {e}")
    
    def _save_all_results(self):
        """Save all current results to persistent storage."""
        if not self._enable_persistence:
            return
        
        saved_count = 0
        with self._lock:
            for result in self._results.values():
                self._save_result(result)
                saved_count += 1
        
        self._logger.info(f"Saved {saved_count} task results to storage")
    
    def _delete_result_file(self, task_id: str):
        """Delete a result file from persistent storage."""
        try:
            result_file = self._storage_path / f"task_{task_id}.json"
            if result_file.exists():
                result_file.unlink()
        except Exception as e:
            self._logger.warning(f"Failed to delete result file for task {task_id}: {e}")