"""
Domain layer for Vespera Scriptorium.

This layer contains the core business logic and abstractions that are
independent of any infrastructure concerns. It defines the business
entities, repository interfaces, and domain services.
"""

# Import entities
from .entities import (
    LifecycleStage,
    OrchestrationSession,
    Specialist,
    SpecialistContext,
    Task,
    TaskType,
    WorkItem,
)

# Import exceptions
from .exceptions import (
    ArtifactError,
    ArtifactNotFoundError,
    ConcurrencyError,
    OrchestrationError,
    ResourceExhaustedError,
    SessionNotFoundError,
    SessionStateError,
    SpecialistAssignmentError,
    SpecialistNotFoundError,
    TaskDependencyError,
    TaskNotFoundError,
    TaskStateError,
    TaskValidationError,
    WorkflowError,
)

# Import repository interfaces
from .repositories import SpecialistRepository, StateRepository, TaskRepository

# Import domain services
from .services import (
    ProgressTrackingService,
    ResultSynthesisService,
    SpecialistAssignmentService,
    TaskBreakdownService,
)

# Import value objects
from .value_objects import (
    ArtifactReference,
    Duration,
    ExecutionResult,
    ExecutionStatus,
    SpecialistCapability,
    SpecialistType,
    TaskComplexity,
    TaskPriority,
    TaskStatus,
    TimeWindow,
)

__all__ = [
    # Entities
    "Task",
    "TaskType",
    "LifecycleStage",
    "Specialist",
    "SpecialistContext",
    "OrchestrationSession",
    "WorkItem",
    # Value Objects
    "TaskStatus",
    "TaskComplexity",
    "TaskPriority",
    "SpecialistType",
    "SpecialistCapability",
    "ExecutionResult",
    "ExecutionStatus",
    "ArtifactReference",
    "TimeWindow",
    "Duration",
    # Exceptions
    "OrchestrationError",
    "TaskNotFoundError",
    "TaskStateError",
    "TaskDependencyError",
    "TaskValidationError",
    "SessionNotFoundError",
    "SessionStateError",
    "SpecialistNotFoundError",
    "SpecialistAssignmentError",
    "ArtifactError",
    "ArtifactNotFoundError",
    "WorkflowError",
    "ConcurrencyError",
    "ResourceExhaustedError",
    # Repository Interfaces
    "TaskRepository",
    "StateRepository",
    "SpecialistRepository",
    # Domain Services
    "TaskBreakdownService",
    "SpecialistAssignmentService",
    "ProgressTrackingService",
    "ResultSynthesisService",
]
