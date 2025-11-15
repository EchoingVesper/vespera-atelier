# TaskExecution Data Model Architecture
## Real-time Status Tracking and Progress Monitoring

**Document Version**: 1.0  
**Date**: 2025-01-09  
**Status**: Design Phase  
**Target**: Vespera Scriptorium V2 Task Orchestrator

## Executive Summary

This document specifies the enhanced TaskExecution data model that provides comprehensive real-time status tracking, progress monitoring, and time estimation capabilities. The design extends the existing TaskExecution class while maintaining backwards compatibility and integrating seamlessly with the current role-based task management system.

### Key Enhancements
- **Real-time Status Streaming**: Event-driven status updates with sub-second granularity
- **Multi-dimensional Progress Tracking**: Support for percentage, steps, bytes, and custom metrics
- **Predictive Time Estimation**: ETA calculations based on historical performance data
- **Execution Phase Management**: Granular tracking of task execution stages
- **Resource Utilization Monitoring**: CPU, memory, and I/O metrics collection
- **Graceful Cancellation**: Thread-safe cancellation with cleanup support

## Current State Analysis

### Existing TaskExecution Class Capabilities
The current TaskExecution class (lines 155-195 in `tasks/models.py`) provides:

```python
@dataclass
class TaskExecution:
    assigned_role: Optional[str] = None
    execution_history: List[Dict[str, Any]] = field(default_factory=list)
    current_execution_id: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3
    last_error: Optional[str] = None
    execution_context: Dict[str, Any] = field(default_factory=dict)
```

### Current Limitations
1. **Historical Focus**: Designed for post-execution analysis rather than real-time monitoring
2. **Binary Status**: No granular execution status beyond "running" or "completed"
3. **No Progress Tracking**: Cannot report completion percentage or intermediate progress
4. **Limited Time Tracking**: No ETA calculation or performance profiling
5. **No Cancellation Support**: Cannot gracefully interrupt long-running tasks
6. **No Resource Monitoring**: No visibility into system resource utilization

## Enhanced Architecture Overview

### Core Design Principles
1. **Backwards Compatibility**: Existing TaskExecution functionality preserved
2. **Event-Driven**: Real-time status updates through event streaming
3. **Multi-layered Progress**: Support for overall and phase-specific progress tracking
4. **Performance-Aware**: Minimal overhead for simple tasks, rich features for complex ones
5. **Thread-Safe**: Safe for concurrent access and updates
6. **Extensible**: Plugin architecture for custom progress metrics

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Enhanced TaskExecution                   │
├─────────────────────────────────────────────────────────────┤
│  Execution Control        │  Real-time Tracking            │
│  ├─ ExecutionSession      │  ├─ StatusEventStream          │
│  ├─ CancellationToken     │  ├─ ProgressTracker           │
│  └─ PhaseManager          │  └─ MetricsCollector          │
├─────────────────────────────────────────────────────────────┤
│  Time & Performance       │  Resource Management           │
│  ├─ TimeTracker           │  ├─ ResourceMonitor           │
│  ├─ ETACalculator         │  ├─ MemoryTracker             │
│  └─ PerformanceProfiler   │  └─ IOTracker                 │
├─────────────────────────────────────────────────────────────┤
│             Legacy TaskExecution (Preserved)                │
└─────────────────────────────────────────────────────────────┘
```

## Data Model Specifications

### Core Enumerations

```python
class ExecutionStatus(Enum):
    """Granular execution status for real-time tracking."""
    IDLE = "idle"                    # Not executing
    PREPARING = "preparing"          # Initializing execution context
    VALIDATING = "validating"        # Pre-execution validation
    RUNNING = "running"             # Actively executing
    PAUSED = "paused"               # Temporarily suspended
    CANCELLING = "cancelling"       # Cancellation in progress
    CANCELLED = "cancelled"         # Successfully cancelled
    COMPLETING = "completing"       # Finalizing execution
    COMPLETED = "completed"         # Successfully completed
    FAILED = "failed"               # Execution failed
    RECOVERING = "recovering"       # Attempting recovery from failure

class ExecutionPhase(Enum):
    """Execution phases for granular progress tracking."""
    INITIALIZATION = "initialization"
    VALIDATION = "validation"
    SETUP = "setup"
    EXECUTION = "execution"
    CLEANUP = "cleanup"
    FINALIZATION = "finalization"
    ERROR_HANDLING = "error_handling"
    RECOVERY = "recovery"

class ProgressType(Enum):
    """Types of progress metrics supported."""
    PERCENTAGE = "percentage"       # 0-100% completion
    STEPS = "steps"                 # N of M steps completed
    BYTES = "bytes"                 # Bytes processed/total
    ITEMS = "items"                 # Items processed/total
    TIME_BASED = "time_based"       # Time elapsed/estimated
    CUSTOM = "custom"               # User-defined metric

class ResourceType(Enum):
    """System resource types for monitoring."""
    CPU_USAGE = "cpu_usage"
    MEMORY_RSS = "memory_rss"
    MEMORY_VMS = "memory_vms"
    DISK_READ = "disk_read"
    DISK_WRITE = "disk_write"
    NETWORK_IN = "network_in"
    NETWORK_OUT = "network_out"
    CUSTOM = "custom"
```

### Core Data Structures

#### ProgressState
```python
@dataclass
class ProgressState:
    """Real-time progress tracking state."""
    progress_type: ProgressType
    current: float = 0.0
    total: Optional[float] = None
    unit: str = ""
    message: str = ""
    details: Dict[str, Any] = field(default_factory=dict)
    updated_at: datetime = field(default_factory=datetime.now)
    
    def get_percentage(self) -> Optional[float]:
        """Calculate completion percentage if possible."""
        if self.total and self.total > 0:
            return min(100.0, (self.current / self.total) * 100.0)
        elif self.progress_type == ProgressType.PERCENTAGE:
            return min(100.0, self.current)
        return None
    
    def is_complete(self) -> bool:
        """Check if progress indicates completion."""
        percentage = self.get_percentage()
        return percentage is not None and percentage >= 100.0
```

#### TimeTracking
```python
@dataclass
class TimeTracking:
    """Comprehensive time tracking and estimation."""
    started_at: Optional[datetime] = None
    paused_at: Optional[datetime] = None
    resumed_at: Optional[datetime] = None
    estimated_duration: Optional[timedelta] = None
    elapsed_time: timedelta = field(default_factory=lambda: timedelta(0))
    paused_duration: timedelta = field(default_factory=lambda: timedelta(0))
    
    # ETA calculation fields
    eta_calculated_at: Optional[datetime] = None
    estimated_completion: Optional[datetime] = None
    confidence_level: float = 0.0  # 0.0 to 1.0
    
    # Historical performance data
    historical_durations: List[timedelta] = field(default_factory=list)
    performance_baseline: Optional[timedelta] = None
    
    def get_elapsed_time(self) -> timedelta:
        """Get total elapsed time excluding pauses."""
        if not self.started_at:
            return timedelta(0)
        
        current_time = datetime.now()
        if self.paused_at and not self.resumed_at:
            # Currently paused
            return (self.paused_at - self.started_at) - self.paused_duration
        else:
            # Running or completed
            total_elapsed = current_time - self.started_at
            return total_elapsed - self.paused_duration
    
    def calculate_eta(self, progress_percentage: Optional[float]) -> Optional[datetime]:
        """Calculate estimated completion time."""
        if not progress_percentage or progress_percentage <= 0:
            return None
        
        elapsed = self.get_elapsed_time()
        if elapsed.total_seconds() < 1:  # Need some execution time for estimation
            return None
        
        # Calculate based on current progress rate
        completion_ratio = progress_percentage / 100.0
        estimated_total = elapsed / completion_ratio
        remaining = estimated_total - elapsed
        
        eta = datetime.now() + remaining
        
        # Update tracking fields
        self.eta_calculated_at = datetime.now()
        self.estimated_completion = eta
        self.confidence_level = min(0.95, progress_percentage / 100.0)  # Higher confidence as progress increases
        
        return eta
    
    def update_historical_data(self, duration: timedelta) -> None:
        """Add completed execution duration to historical data."""
        self.historical_durations.append(duration)
        
        # Keep only last 10 executions for baseline calculation
        if len(self.historical_durations) > 10:
            self.historical_durations = self.historical_durations[-10:]
        
        # Update performance baseline (median of historical durations)
        if self.historical_durations:
            sorted_durations = sorted(self.historical_durations)
            mid_index = len(sorted_durations) // 2
            self.performance_baseline = sorted_durations[mid_index]
```

#### StatusEvent
```python
@dataclass
class StatusEvent:
    """Individual status change event for real-time streaming."""
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = field(default_factory=datetime.now)
    event_type: str = ""  # status_change, progress_update, error, warning, info
    old_status: Optional[ExecutionStatus] = None
    new_status: Optional[ExecutionStatus] = None
    message: str = ""
    details: Dict[str, Any] = field(default_factory=dict)
    phase: Optional[ExecutionPhase] = None
    progress_data: Optional[Dict[str, Any]] = None
    
    def to_stream_message(self) -> Dict[str, Any]:
        """Convert to streamable message format."""
        return {
            "event_id": self.event_id,
            "timestamp": self.timestamp.isoformat(),
            "type": self.event_type,
            "status": {
                "old": self.old_status.value if self.old_status else None,
                "new": self.new_status.value if self.new_status else None
            },
            "message": self.message,
            "phase": self.phase.value if self.phase else None,
            "progress": self.progress_data,
            "details": self.details
        }
```

#### ExecutionSession
```python
@dataclass
class ExecutionSession:
    """Represents a single execution attempt with comprehensive tracking."""
    session_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    task_id: str = ""
    role_name: Optional[str] = None
    
    # Status and phase tracking
    status: ExecutionStatus = ExecutionStatus.IDLE
    current_phase: Optional[ExecutionPhase] = None
    phase_history: List[Tuple[ExecutionPhase, datetime]] = field(default_factory=list)
    
    # Progress tracking
    overall_progress: ProgressState = field(default_factory=lambda: ProgressState(ProgressType.PERCENTAGE))
    phase_progress: Dict[ExecutionPhase, ProgressState] = field(default_factory=dict)
    custom_progress: Dict[str, ProgressState] = field(default_factory=dict)
    
    # Time and performance tracking
    time_tracking: TimeTracking = field(default_factory=TimeTracking)
    
    # Event streaming
    status_events: List[StatusEvent] = field(default_factory=list)
    event_callbacks: List[callable] = field(default_factory=list)
    
    # Resource monitoring
    resource_metrics: Dict[ResourceType, List[Tuple[datetime, float]]] = field(default_factory=dict)
    peak_resource_usage: Dict[ResourceType, float] = field(default_factory=dict)
    
    # Cancellation support
    cancellation_token: Optional['CancellationToken'] = None
    is_cancellation_requested: bool = False
    
    # Error handling
    error_context: Dict[str, Any] = field(default_factory=dict)
    recovery_attempts: int = 0
    max_recovery_attempts: int = 3
    
    def start_execution(self, role_name: Optional[str] = None) -> None:
        """Initialize execution session."""
        self.role_name = role_name
        self.status = ExecutionStatus.PREPARING
        self.time_tracking.started_at = datetime.now()
        self.emit_status_event("execution_started", "Execution session started")
    
    def update_status(self, new_status: ExecutionStatus, message: str = "") -> None:
        """Update execution status with event emission."""
        old_status = self.status
        self.status = new_status
        
        event = StatusEvent(
            event_type="status_change",
            old_status=old_status,
            new_status=new_status,
            message=message,
            phase=self.current_phase
        )
        
        self.status_events.append(event)
        self.emit_to_callbacks(event)
    
    def enter_phase(self, phase: ExecutionPhase) -> None:
        """Enter a new execution phase."""
        if self.current_phase:
            self.phase_history.append((self.current_phase, datetime.now()))
        
        self.current_phase = phase
        if phase not in self.phase_progress:
            self.phase_progress[phase] = ProgressState(ProgressType.PERCENTAGE)
        
        self.emit_status_event("phase_change", f"Entered phase: {phase.value}")
    
    def update_progress(self, 
                       progress_value: float, 
                       total: Optional[float] = None,
                       message: str = "",
                       phase: Optional[ExecutionPhase] = None) -> None:
        """Update progress for overall or specific phase."""
        target_progress = self.overall_progress
        if phase:
            if phase not in self.phase_progress:
                self.phase_progress[phase] = ProgressState(ProgressType.PERCENTAGE)
            target_progress = self.phase_progress[phase]
        
        target_progress.current = progress_value
        if total is not None:
            target_progress.total = total
        if message:
            target_progress.message = message
        target_progress.updated_at = datetime.now()
        
        # Calculate ETA based on overall progress
        if not phase:  # Overall progress update
            percentage = target_progress.get_percentage()
            if percentage:
                eta = self.time_tracking.calculate_eta(percentage)
        
        # Emit progress event
        event = StatusEvent(
            event_type="progress_update",
            message=f"Progress: {progress_value}" + (f"/{total}" if total else ""),
            phase=phase or self.current_phase,
            progress_data={
                "current": progress_value,
                "total": total,
                "percentage": target_progress.get_percentage(),
                "message": message
            }
        )
        
        self.status_events.append(event)
        self.emit_to_callbacks(event)
    
    def record_resource_usage(self, resource_type: ResourceType, value: float) -> None:
        """Record resource usage metric."""
        timestamp = datetime.now()
        
        if resource_type not in self.resource_metrics:
            self.resource_metrics[resource_type] = []
        
        self.resource_metrics[resource_type].append((timestamp, value))
        
        # Update peak usage
        current_peak = self.peak_resource_usage.get(resource_type, 0.0)
        self.peak_resource_usage[resource_type] = max(current_peak, value)
        
        # Keep only last 1000 measurements per resource type
        if len(self.resource_metrics[resource_type]) > 1000:
            self.resource_metrics[resource_type] = self.resource_metrics[resource_type][-1000:]
    
    def request_cancellation(self, reason: str = "") -> None:
        """Request graceful cancellation of execution."""
        self.is_cancellation_requested = True
        if self.cancellation_token:
            self.cancellation_token.cancel(reason)
        
        self.update_status(ExecutionStatus.CANCELLING, f"Cancellation requested: {reason}")
    
    def emit_status_event(self, event_type: str, message: str, **kwargs) -> None:
        """Emit a status event."""
        event = StatusEvent(
            event_type=event_type,
            new_status=self.status,
            message=message,
            phase=self.current_phase,
            details=kwargs
        )
        
        self.status_events.append(event)
        self.emit_to_callbacks(event)
    
    def emit_to_callbacks(self, event: StatusEvent) -> None:
        """Emit event to registered callbacks."""
        for callback in self.event_callbacks:
            try:
                callback(event)
            except Exception as e:
                # Log callback error but don't fail execution
                pass
    
    def add_event_callback(self, callback: callable) -> None:
        """Register a callback for status events."""
        self.event_callbacks.append(callback)
    
    def get_execution_summary(self) -> Dict[str, Any]:
        """Get comprehensive execution summary."""
        elapsed = self.time_tracking.get_elapsed_time()
        overall_percentage = self.overall_progress.get_percentage()
        
        return {
            "session_id": self.session_id,
            "task_id": self.task_id,
            "status": self.status.value,
            "current_phase": self.current_phase.value if self.current_phase else None,
            "overall_progress": {
                "percentage": overall_percentage,
                "message": self.overall_progress.message
            },
            "time_tracking": {
                "elapsed_seconds": elapsed.total_seconds(),
                "estimated_completion": self.time_tracking.estimated_completion.isoformat() if self.time_tracking.estimated_completion else None,
                "eta_confidence": self.time_tracking.confidence_level
            },
            "resource_usage": {
                resource_type.value: {
                    "current": metrics[-1][1] if metrics else 0.0,
                    "peak": self.peak_resource_usage.get(resource_type, 0.0)
                }
                for resource_type, metrics in self.resource_metrics.items()
            },
            "error_context": self.error_context if self.status == ExecutionStatus.FAILED else None
        }
```

#### CancellationToken
```python
@dataclass
class CancellationToken:
    """Thread-safe cancellation token for graceful task termination."""
    token_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    is_cancelled: bool = False
    cancellation_reason: str = ""
    cancelled_at: Optional[datetime] = None
    timeout_seconds: Optional[float] = None
    
    _lock: threading.Lock = field(default_factory=threading.Lock, init=False)
    
    def cancel(self, reason: str = "") -> None:
        """Request cancellation with thread safety."""
        with self._lock:
            if not self.is_cancelled:
                self.is_cancelled = True
                self.cancellation_reason = reason
                self.cancelled_at = datetime.now()
    
    def is_cancellation_requested(self) -> bool:
        """Check if cancellation has been requested (thread-safe)."""
        with self._lock:
            return self.is_cancelled
    
    def throw_if_cancelled(self) -> None:
        """Raise CancellationException if cancellation requested."""
        if self.is_cancellation_requested():
            raise CancellationException(self.cancellation_reason)
    
    def with_timeout(self, seconds: float) -> 'CancellationToken':
        """Create a copy with timeout."""
        new_token = CancellationToken(
            token_id=self.token_id,
            is_cancelled=self.is_cancelled,
            cancellation_reason=self.cancellation_reason,
            cancelled_at=self.cancelled_at,
            timeout_seconds=seconds
        )
        
        # Set up timeout
        if seconds and not self.is_cancelled:
            def timeout_callback():
                time.sleep(seconds)
                if not new_token.is_cancellation_requested():
                    new_token.cancel(f"Timeout after {seconds} seconds")
            
            threading.Thread(target=timeout_callback, daemon=True).start()
        
        return new_token

class CancellationException(Exception):
    """Exception raised when execution is cancelled."""
    pass
```

### Enhanced TaskExecution Class

```python
@dataclass
class EnhancedTaskExecution:
    """Enhanced TaskExecution with real-time status tracking and progress monitoring."""
    
    # Legacy fields (preserved for backwards compatibility)
    assigned_role: Optional[str] = None
    execution_history: List[Dict[str, Any]] = field(default_factory=list)
    current_execution_id: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3
    last_error: Optional[str] = None
    execution_context: Dict[str, Any] = field(default_factory=dict)
    
    # Enhanced real-time tracking
    current_session: Optional[ExecutionSession] = None
    session_history: List[ExecutionSession] = field(default_factory=list)
    
    # Global execution state
    is_executing: bool = False
    global_cancellation_token: Optional[CancellationToken] = None
    
    # Performance and monitoring
    performance_profile: Dict[str, Any] = field(default_factory=dict)
    monitoring_enabled: bool = True
    
    # Event streaming configuration
    enable_event_streaming: bool = True
    max_events_in_memory: int = 1000
    
    def start_new_session(self, 
                         task_id: str,
                         role_name: Optional[str] = None,
                         enable_monitoring: bool = True) -> ExecutionSession:
        """Start a new execution session with comprehensive tracking."""
        
        # Archive current session if exists
        if self.current_session:
            self.session_history.append(self.current_session)
            
        # Limit session history size
        if len(self.session_history) > 10:
            self.session_history = self.session_history[-10:]
        
        # Create new session
        session = ExecutionSession(task_id=task_id, role_name=role_name)
        session.cancellation_token = CancellationToken()
        
        # Set up resource monitoring if enabled
        if enable_monitoring and self.monitoring_enabled:
            self._setup_resource_monitoring(session)
        
        # Start session
        session.start_execution(role_name)
        self.current_session = session
        self.is_executing = True
        self.current_execution_id = session.session_id
        
        # Update legacy fields
        self.assigned_role = role_name
        
        return session
    
    def get_current_status(self) -> Dict[str, Any]:
        """Get comprehensive current execution status."""
        if not self.current_session:
            return {
                "executing": False,
                "status": "idle",
                "session_id": None
            }
        
        return {
            "executing": self.is_executing,
            "session": self.current_session.get_execution_summary(),
            "legacy_compatibility": {
                "assigned_role": self.assigned_role,
                "execution_id": self.current_execution_id,
                "retry_count": self.retry_count,
                "last_error": self.last_error
            }
        }
    
    def update_progress(self, 
                       progress: float, 
                       message: str = "",
                       phase: Optional[ExecutionPhase] = None) -> None:
        """Update execution progress with real-time tracking."""
        if not self.current_session:
            return
        
        self.current_session.update_progress(progress, message=message, phase=phase)
    
    def complete_execution(self, 
                          success: bool = True,
                          output: str = "",
                          error: Optional[str] = None) -> None:
        """Complete current execution session."""
        if not self.current_session:
            return
        
        # Update session status
        final_status = ExecutionStatus.COMPLETED if success else ExecutionStatus.FAILED
        self.current_session.update_status(final_status, output or error or "")
        
        # Update time tracking
        if self.current_session.time_tracking.started_at:
            elapsed = datetime.now() - self.current_session.time_tracking.started_at
            self.current_session.time_tracking.update_historical_data(elapsed)
        
        # Update legacy execution history
        legacy_record = {
            "execution_id": self.current_session.session_id,
            "timestamp": datetime.now().isoformat(),
            "role_name": self.assigned_role,
            "status": "completed" if success else "failed",
            "output": output,
            "error": error,
            "session_summary": self.current_session.get_execution_summary()
        }
        self.execution_history.append(legacy_record)
        
        # Update legacy fields
        if not success:
            self.last_error = error
            self.retry_count += 1
        else:
            self.retry_count = 0
            self.last_error = None
        
        # Archive session and reset state
        self.session_history.append(self.current_session)
        self.current_session = None
        self.is_executing = False
    
    def request_cancellation(self, reason: str = "User requested") -> bool:
        """Request cancellation of current execution."""
        if not self.current_session:
            return False
        
        self.current_session.request_cancellation(reason)
        return True
    
    def add_status_callback(self, callback: callable) -> None:
        """Add callback for real-time status updates."""
        if self.current_session:
            self.current_session.add_event_callback(callback)
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get performance metrics across all sessions."""
        if not self.session_history:
            return {}
        
        # Aggregate metrics from session history
        total_sessions = len(self.session_history)
        successful_sessions = sum(1 for s in self.session_history if s.status == ExecutionStatus.COMPLETED)
        
        durations = []
        for session in self.session_history:
            if session.time_tracking.started_at and session.status == ExecutionStatus.COMPLETED:
                elapsed = session.time_tracking.get_elapsed_time()
                durations.append(elapsed.total_seconds())
        
        avg_duration = sum(durations) / len(durations) if durations else 0
        
        return {
            "total_executions": total_sessions,
            "success_rate": successful_sessions / total_sessions if total_sessions > 0 else 0,
            "average_duration_seconds": avg_duration,
            "retry_count": self.retry_count,
            "last_error": self.last_error
        }
    
    def _setup_resource_monitoring(self, session: ExecutionSession) -> None:
        """Set up background resource monitoring for session."""
        import psutil
        import threading
        
        def monitor_resources():
            process = psutil.Process()
            while session.status in [ExecutionStatus.RUNNING, ExecutionStatus.PREPARING]:
                try:
                    # CPU usage
                    cpu_percent = process.cpu_percent()
                    session.record_resource_usage(ResourceType.CPU_USAGE, cpu_percent)
                    
                    # Memory usage
                    memory_info = process.memory_info()
                    session.record_resource_usage(ResourceType.MEMORY_RSS, memory_info.rss / 1024 / 1024)  # MB
                    session.record_resource_usage(ResourceType.MEMORY_VMS, memory_info.vms / 1024 / 1024)  # MB
                    
                    # I/O usage
                    io_counters = process.io_counters()
                    session.record_resource_usage(ResourceType.DISK_READ, io_counters.read_bytes)
                    session.record_resource_usage(ResourceType.DISK_WRITE, io_counters.write_bytes)
                    
                    time.sleep(1)  # Sample every second
                    
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    break
        
        # Start monitoring in background thread
        monitor_thread = threading.Thread(target=monitor_resources, daemon=True)
        monitor_thread.start()
    
    # Legacy compatibility methods
    def add_execution_record(self, role_name: str, status: str, output: str = "", error: str = None, metadata: Dict[str, Any] = None) -> None:
        """Legacy method - maintained for backwards compatibility."""
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
        """Legacy method - check if task can be retried after failure."""
        return self.retry_count < self.max_retries
    
    def reset_retries(self) -> None:
        """Legacy method - reset retry count after successful execution."""
        self.retry_count = 0
        self.last_error = None
```

## Integration with Existing Systems

### Task Model Integration

The enhanced TaskExecution will replace the existing TaskExecution class in the Task model:

```python
@dataclass
class Task:
    # ... existing fields ...
    
    # Replace existing execution field
    execution: EnhancedTaskExecution = field(default_factory=EnhancedTaskExecution)
    
    # ... existing methods ...
    
    def start_execution(self, role_name: Optional[str] = None) -> ExecutionSession:
        """Start task execution with real-time tracking."""
        session = self.execution.start_new_session(
            task_id=self.id,
            role_name=role_name or self.execution.assigned_role
        )
        
        # Update task status
        self.update_status(TaskStatus.DOING)
        
        return session
    
    def update_execution_progress(self, progress: float, message: str = "") -> None:
        """Update task execution progress."""
        self.execution.update_progress(progress, message)
        self.updated_at = datetime.now()
    
    def complete_execution(self, success: bool = True, output: str = "", error: Optional[str] = None) -> None:
        """Complete task execution."""
        self.execution.complete_execution(success, output, error)
        
        # Update task status based on execution result
        if success:
            self.update_status(TaskStatus.DONE)
        else:
            self.update_status(TaskStatus.TODO)  # Reset for retry
    
    def get_execution_status(self) -> Dict[str, Any]:
        """Get comprehensive execution status."""
        return self.execution.get_current_status()
```

### MCP Server Integration

The MCP server will expose new tools for real-time execution monitoring:

```python
# New MCP tools for enhanced execution tracking
@server.tool()
async def get_task_execution_status(task_id: str) -> Dict[str, Any]:
    """Get real-time execution status for a task."""
    task = task_service.get_task(task_id)
    if task and task.execution.current_session:
        return task.execution.get_current_status()
    return {"executing": False, "task_found": task is not None}

@server.tool()  
async def stream_task_execution_events(task_id: str) -> AsyncGenerator[Dict[str, Any], None]:
    """Stream real-time execution events for a task."""
    task = task_service.get_task(task_id)
    if not task or not task.execution.current_session:
        return
    
    # Set up event streaming
    event_queue = asyncio.Queue()
    
    def event_callback(event: StatusEvent):
        asyncio.create_task(event_queue.put(event.to_stream_message()))
    
    task.execution.add_status_callback(event_callback)
    
    try:
        while task.execution.is_executing:
            event = await event_queue.get()
            yield event
    finally:
        # Clean up callback
        pass

@server.tool()
async def cancel_task_execution(task_id: str, reason: str = "User requested") -> Dict[str, Any]:
    """Cancel ongoing task execution."""
    task = task_service.get_task(task_id)
    if not task:
        return {"success": False, "error": "Task not found"}
    
    success = task.execution.request_cancellation(reason)
    return {"success": success, "message": f"Cancellation {'requested' if success else 'not possible'}"}

@server.tool()
async def get_task_performance_metrics(task_id: str) -> Dict[str, Any]:
    """Get performance metrics for a task."""
    task = task_service.get_task(task_id)
    if not task:
        return {"error": "Task not found"}
    
    return task.execution.get_performance_metrics()
```

### Role System Integration

Enhanced execution integrates with the existing role system:

```python
# In roles/execution.py
class RoleExecutor:
    async def execute_task_with_tracking(self, task: Task, role: Role) -> ExecutionResult:
        """Execute task with enhanced real-time tracking."""
        
        # Start execution session
        session = task.start_execution(role.name)
        
        try:
            # Phase 1: Validation
            session.enter_phase(ExecutionPhase.VALIDATION)
            session.update_progress(10, message="Validating task requirements")
            
            validation_result = await self.validate_task_for_role(task, role)
            if not validation_result.valid:
                raise ExecutionError(validation_result.error)
            
            # Phase 2: Setup
            session.enter_phase(ExecutionPhase.SETUP)
            session.update_progress(25, message="Setting up execution environment")
            
            execution_context = await self.setup_execution_environment(task, role)
            
            # Phase 3: Execution
            session.enter_phase(ExecutionPhase.EXECUTION)
            session.update_progress(30, message="Beginning task execution")
            
            # Execute with progress callbacks
            def progress_callback(progress: float, message: str = ""):
                # Map execution progress to 30-90% range
                mapped_progress = 30 + (progress * 0.6)
                session.update_progress(mapped_progress, message)
            
            result = await role.execute_task(task, execution_context, progress_callback)
            
            # Phase 4: Cleanup
            session.enter_phase(ExecutionPhase.CLEANUP)
            session.update_progress(95, message="Cleaning up")
            
            await self.cleanup_execution_environment(execution_context)
            
            # Complete successfully
            session.update_progress(100, message="Execution completed successfully")
            task.complete_execution(True, result.output)
            
            return result
            
        except CancellationException as e:
            session.update_status(ExecutionStatus.CANCELLED, str(e))
            task.complete_execution(False, error=f"Execution cancelled: {e}")
            raise
            
        except Exception as e:
            session.update_status(ExecutionStatus.FAILED, str(e))
            task.complete_execution(False, error=str(e))
            raise
```

## Performance Considerations

### Memory Management
- **Event Queue Limits**: Maximum 1000 events in memory per session
- **Session History**: Maximum 10 sessions retained per task
- **Resource Metrics**: Maximum 1000 data points per resource type
- **Automatic Cleanup**: Completed sessions archived and cleaned periodically

### CPU Efficiency  
- **Background Monitoring**: Resource monitoring in separate daemon threads
- **Event Batching**: Status events can be batched for high-frequency updates
- **Lazy Calculation**: ETA and performance metrics calculated on-demand
- **Conditional Monitoring**: Resource monitoring can be disabled for lightweight tasks

### Thread Safety
- **Lock-Free Design**: Most operations use immutable data structures
- **CancellationToken**: Thread-safe cancellation coordination
- **Event Callbacks**: Isolated callback execution with error handling
- **Atomic Updates**: Status and progress updates are atomic operations

### Scalability
- **Per-Task Isolation**: Each task's execution tracking is independent
- **Configurable Features**: Monitoring and tracking can be selectively enabled
- **Database Optimization**: Execution data can be persisted asynchronously
- **Resource Limits**: Configurable limits prevent memory and CPU runaway

## Implementation Roadmap

### Phase 1: Core Data Structures (Week 1-2)
- [ ] Implement core enums (ExecutionStatus, ExecutionPhase, ProgressType, ResourceType)
- [ ] Create ProgressState and TimeTracking data classes
- [ ] Implement StatusEvent and event streaming infrastructure
- [ ] Create CancellationToken with thread-safe operations
- [ ] Build ExecutionSession with basic tracking
- [ ] Unit tests for all core components

### Phase 2: Enhanced TaskExecution (Week 3-4)
- [ ] Implement EnhancedTaskExecution class
- [ ] Integrate with existing TaskExecution (backwards compatibility)
- [ ] Add session management and history tracking
- [ ] Implement progress update mechanisms
- [ ] Add performance metrics collection
- [ ] Integration tests with existing Task model

### Phase 3: Real-time Features (Week 5-6)
- [ ] Implement event streaming infrastructure
- [ ] Add resource monitoring with psutil integration
- [ ] Create ETA calculation algorithms
- [ ] Build cancellation token integration
- [ ] Add callback system for real-time updates
- [ ] Performance testing and optimization

### Phase 4: System Integration (Week 7-8)
- [ ] Update Task model to use EnhancedTaskExecution
- [ ] Create new MCP tools for execution monitoring
- [ ] Integrate with role-based execution system
- [ ] Add execution tracking to task manager
- [ ] Update task service for execution queries
- [ ] End-to-end testing

### Phase 5: Dashboard and UI (Week 9-10)
- [ ] Create execution status dashboard
- [ ] Implement real-time progress visualization
- [ ] Add performance metrics display
- [ ] Build execution history viewer
- [ ] Create cancellation controls
- [ ] User experience testing

### Phase 6: Production Readiness (Week 11-12)
- [ ] Performance optimization and profiling
- [ ] Memory leak detection and fixes
- [ ] Error handling and resilience testing
- [ ] Documentation and API reference
- [ ] Migration scripts for existing data
- [ ] Production deployment and monitoring

## Success Metrics

### Functional Requirements
- ✅ Real-time progress updates with <1 second latency
- ✅ Accurate ETA predictions with >80% confidence after 25% progress
- ✅ Graceful cancellation within 5 seconds for all task types
- ✅ Resource usage monitoring with minimal overhead (<5% CPU)
- ✅ 100% backwards compatibility with existing TaskExecution API

### Performance Requirements
- ✅ Memory overhead <50MB per concurrent execution session
- ✅ Event streaming throughput >1000 events/second
- ✅ Progress update latency <100ms
- ✅ Cancellation response time <5 seconds
- ✅ No impact on non-enhanced task execution performance

### Quality Requirements
- ✅ Unit test coverage >95% for all new components
- ✅ Integration test coverage for all execution scenarios
- ✅ Thread safety verification under concurrent load
- ✅ Memory leak testing for long-running executions
- ✅ Error recovery testing for all failure modes

## Conclusion

This enhanced TaskExecution architecture provides comprehensive real-time status tracking, progress monitoring, and time estimation capabilities while maintaining full backwards compatibility with the existing system. The modular design allows for gradual adoption and provides a solid foundation for future enhancements to the Vespera Scriptorium task orchestration system.

The implementation roadmap provides a clear path to delivery over 12 weeks, with each phase building upon previous work and delivering incremental value. Success metrics ensure the enhanced system meets both functional and performance requirements while maintaining system reliability and user experience.