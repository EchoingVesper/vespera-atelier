"""Background process manager for coordinating and monitoring background tasks."""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum
import threading
import time
import uuid


class ProcessState(Enum):
    """Process execution states."""
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class BackgroundProcess:
    """Represents a background process."""
    id: str
    name: str
    state: ProcessState
    created_at: float
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    error: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class BackgroundManager:
    """Manages background processes and their lifecycle."""
    
    def __init__(self):
        self._processes: Dict[str, BackgroundProcess] = {}
        self._lock = threading.Lock()
        self._shutdown = False
    
    def register_process(self, name: str, metadata: Optional[Dict[str, Any]] = None) -> str:
        """Register a new background process."""
        process_id = str(uuid.uuid4())
        
        with self._lock:
            process = BackgroundProcess(
                id=process_id,
                name=name,
                state=ProcessState.IDLE,
                created_at=time.time(),
                metadata=metadata or {}
            )
            self._processes[process_id] = process
        
        return process_id
    
    def start_process(self, process_id: str) -> bool:
        """Start a registered process."""
        with self._lock:
            if process_id not in self._processes:
                return False
            
            process = self._processes[process_id]
            if process.state != ProcessState.IDLE:
                return False
            
            process.state = ProcessState.RUNNING
            process.started_at = time.time()
            return True
    
    def complete_process(self, process_id: str, error: Optional[str] = None) -> bool:
        """Mark a process as completed or failed."""
        with self._lock:
            if process_id not in self._processes:
                return False
            
            process = self._processes[process_id]
            process.completed_at = time.time()
            
            if error:
                process.state = ProcessState.FAILED
                process.error = error
            else:
                process.state = ProcessState.COMPLETED
            
            return True
    
    def pause_process(self, process_id: str) -> bool:
        """Pause a running process."""
        with self._lock:
            if process_id not in self._processes:
                return False
            
            process = self._processes[process_id]
            if process.state != ProcessState.RUNNING:
                return False
            
            process.state = ProcessState.PAUSED
            return True
    
    def resume_process(self, process_id: str) -> bool:
        """Resume a paused process."""
        with self._lock:
            if process_id not in self._processes:
                return False
            
            process = self._processes[process_id]
            if process.state != ProcessState.PAUSED:
                return False
            
            process.state = ProcessState.RUNNING
            return True
    
    def get_process(self, process_id: str) -> Optional[BackgroundProcess]:
        """Get process information by ID."""
        with self._lock:
            return self._processes.get(process_id)
    
    def list_processes(self, state: Optional[ProcessState] = None) -> List[BackgroundProcess]:
        """List all processes, optionally filtered by state."""
        with self._lock:
            processes = list(self._processes.values())
            
            if state:
                processes = [p for p in processes if p.state == state]
            
            return processes
    
    def cleanup_completed(self, max_age_hours: float = 24.0) -> int:
        """Remove completed/failed processes older than max_age_hours."""
        cutoff_time = time.time() - (max_age_hours * 3600)
        removed_count = 0
        
        with self._lock:
            to_remove = []
            for process_id, process in self._processes.items():
                if (process.state in [ProcessState.COMPLETED, ProcessState.FAILED] and
                    process.completed_at and process.completed_at < cutoff_time):
                    to_remove.append(process_id)
            
            for process_id in to_remove:
                del self._processes[process_id]
                removed_count += 1
        
        return removed_count
    
    def shutdown(self):
        """Shutdown the background manager."""
        self._shutdown = True