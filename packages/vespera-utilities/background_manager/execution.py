"""Background execution engine for running tasks in separate threads."""

import threading
import traceback
import time
from typing import Callable, Any, Optional, Dict
from concurrent.futures import ThreadPoolExecutor, Future
from .manager import BackgroundManager, ProcessState


class BackgroundExecutor:
    """Executes background tasks with process tracking."""
    
    def __init__(self, manager: BackgroundManager, max_workers: int = 4):
        self.manager = manager
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self._futures: Dict[str, Future] = {}
        self._lock = threading.Lock()
    
    def submit_task(self, 
                   name: str, 
                   task_func: Callable[..., Any], 
                   *args, 
                   metadata: Optional[Dict[str, Any]] = None,
                   **kwargs) -> str:
        """Submit a task for background execution."""
        
        # Register the process
        process_id = self.manager.register_process(name, metadata)
        
        # Wrap the task function with process tracking
        def wrapped_task():
            try:
                # Start the process
                self.manager.start_process(process_id)
                
                # Execute the actual task
                result = task_func(*args, **kwargs)
                
                # Mark as completed
                self.manager.complete_process(process_id)
                return result
                
            except Exception as e:
                # Mark as failed with error
                error_msg = f"{type(e).__name__}: {str(e)}"
                self.manager.complete_process(process_id, error_msg)
                raise
        
        # Submit to thread pool
        future = self.executor.submit(wrapped_task)
        
        with self._lock:
            self._futures[process_id] = future
        
        return process_id
    
    def get_result(self, process_id: str, timeout: Optional[float] = None) -> Any:
        """Get the result of a background task."""
        with self._lock:
            future = self._futures.get(process_id)
        
        if not future:
            raise ValueError(f"No task found for process ID: {process_id}")
        
        return future.result(timeout=timeout)
    
    def cancel_task(self, process_id: str) -> bool:
        """Cancel a background task if it hasn't started yet."""
        with self._lock:
            future = self._futures.get(process_id)
        
        if not future:
            return False
        
        cancelled = future.cancel()
        if cancelled:
            self.manager.complete_process(process_id, "Task cancelled")
        
        return cancelled
    
    def is_task_done(self, process_id: str) -> bool:
        """Check if a background task is completed."""
        with self._lock:
            future = self._futures.get(process_id)
        
        if not future:
            return True  # If no future exists, consider it done
        
        return future.done()
    
    def cleanup_completed(self):
        """Clean up completed futures."""
        with self._lock:
            completed_ids = []
            for process_id, future in self._futures.items():
                if future.done():
                    completed_ids.append(process_id)
            
            for process_id in completed_ids:
                del self._futures[process_id]
    
    def shutdown(self, wait: bool = True):
        """Shutdown the executor."""
        self.executor.shutdown(wait=wait)
        with self._lock:
            self._futures.clear()


class TaskRunner:
    """Simple task runner for fire-and-forget background tasks."""
    
    @staticmethod
    def run_background(task_func: Callable[..., Any], *args, **kwargs) -> threading.Thread:
        """Run a function in the background without tracking."""
        
        def wrapper():
            try:
                task_func(*args, **kwargs)
            except Exception:
                # Log error but don't propagate
                traceback.print_exc()
        
        thread = threading.Thread(target=wrapper, daemon=True)
        thread.start()
        return thread
    
    @staticmethod
    def run_delayed(delay_seconds: float, task_func: Callable[..., Any], *args, **kwargs) -> threading.Thread:
        """Run a function after a delay."""
        
        def wrapper():
            try:
                time.sleep(delay_seconds)
                task_func(*args, **kwargs)
            except Exception:
                traceback.print_exc()
        
        thread = threading.Thread(target=wrapper, daemon=True)
        thread.start()
        return thread