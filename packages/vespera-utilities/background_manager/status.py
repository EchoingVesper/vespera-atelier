"""Status tracking and reporting for background processes."""

from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Any
from enum import Enum
import time
import threading

from .manager import BackgroundManager, ProcessState, BackgroundProcess


@dataclass
class ProcessInfo:
    """Process information for status reporting."""
    id: str
    name: str
    state: str
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    duration_seconds: Optional[float] = None
    error: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class SystemStats:
    """System-level statistics."""
    total_processes: int
    active_processes: int
    completed_processes: int
    failed_processes: int
    average_duration: Optional[float] = None
    uptime_seconds: float = 0.0


class BackgroundStatus:
    """Status reporting and monitoring for background processes."""
    
    def __init__(self, manager: BackgroundManager):
        self.manager = manager
        self._start_time = time.time()
        self._lock = threading.Lock()
    
    def get_process_info(self, process_id: str) -> Optional[ProcessInfo]:
        """Get detailed information about a specific process."""
        process = self.manager.get_process(process_id)
        if not process:
            return None
        
        return self._process_to_info(process)
    
    def list_process_info(self, state: Optional[ProcessState] = None) -> List[ProcessInfo]:
        """Get information about all processes, optionally filtered by state."""
        processes = self.manager.list_processes(state)
        return [self._process_to_info(p) for p in processes]
    
    def get_active_processes(self) -> List[ProcessInfo]:
        """Get information about currently active (running/paused) processes."""
        active_states = [ProcessState.RUNNING, ProcessState.PAUSED]
        all_processes = self.manager.list_processes()
        
        active_processes = [p for p in all_processes if p.state in active_states]
        return [self._process_to_info(p) for p in active_processes]
    
    def get_system_stats(self) -> SystemStats:
        """Get system-level statistics."""
        all_processes = self.manager.list_processes()
        
        total = len(all_processes)
        active = len([p for p in all_processes if p.state in [ProcessState.RUNNING, ProcessState.PAUSED]])
        completed = len([p for p in all_processes if p.state == ProcessState.COMPLETED])
        failed = len([p for p in all_processes if p.state == ProcessState.FAILED])
        
        # Calculate average duration for completed processes
        completed_processes = [p for p in all_processes if p.state == ProcessState.COMPLETED]
        avg_duration = None
        if completed_processes:
            durations = []
            for p in completed_processes:
                if p.started_at and p.completed_at:
                    durations.append(p.completed_at - p.started_at)
            
            if durations:
                avg_duration = sum(durations) / len(durations)
        
        uptime = time.time() - self._start_time
        
        return SystemStats(
            total_processes=total,
            active_processes=active,
            completed_processes=completed,
            failed_processes=failed,
            average_duration=avg_duration,
            uptime_seconds=uptime
        )
    
    def get_status_summary(self) -> Dict[str, Any]:
        """Get a comprehensive status summary."""
        stats = self.get_system_stats()
        active_processes = self.get_active_processes()
        
        return {
            "system_stats": asdict(stats),
            "active_processes": [asdict(p) for p in active_processes],
            "timestamp": time.time()
        }
    
    def _process_to_info(self, process: BackgroundProcess) -> ProcessInfo:
        """Convert a BackgroundProcess to ProcessInfo."""
        duration = None
        if process.started_at and process.completed_at:
            duration = process.completed_at - process.started_at
        elif process.started_at and process.state == ProcessState.RUNNING:
            duration = time.time() - process.started_at
        
        return ProcessInfo(
            id=process.id,
            name=process.name,
            state=process.state.value,
            created_at=self._format_timestamp(process.created_at),
            started_at=self._format_timestamp(process.started_at) if process.started_at else None,
            completed_at=self._format_timestamp(process.completed_at) if process.completed_at else None,
            duration_seconds=duration,
            error=process.error,
            metadata=process.metadata
        )
    
    def _format_timestamp(self, timestamp: float) -> str:
        """Format a timestamp for display."""
        return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(timestamp))


class PerformanceMonitor:
    """Monitor performance metrics of background processes."""
    
    def __init__(self, status: BackgroundStatus):
        self.status = status
    
    def get_throughput_metrics(self) -> Dict[str, float]:
        """Get process throughput metrics."""
        stats = self.status.get_system_stats()
        
        if stats.uptime_seconds == 0:
            return {"processes_per_second": 0.0, "completions_per_second": 0.0}
        
        return {
            "processes_per_second": stats.total_processes / stats.uptime_seconds,
            "completions_per_second": stats.completed_processes / stats.uptime_seconds
        }
    
    def get_failure_rate(self) -> float:
        """Get the failure rate as a percentage."""
        stats = self.status.get_system_stats()
        
        if stats.total_processes == 0:
            return 0.0
        
        return (stats.failed_processes / stats.total_processes) * 100.0
    
    def get_performance_summary(self) -> Dict[str, Any]:
        """Get a comprehensive performance summary."""
        stats = self.status.get_system_stats()
        throughput = self.get_throughput_metrics()
        failure_rate = self.get_failure_rate()
        
        return {
            "system_stats": asdict(stats),
            "throughput": throughput,
            "failure_rate_percent": failure_rate,
            "health_status": "healthy" if failure_rate < 5.0 else "degraded" if failure_rate < 20.0 else "unhealthy"
        }