"""
Domain value objects for the Vespera Scriptorium.

Value objects are immutable objects that represent domain concepts
without identity. They are compared by value rather than reference.
"""

from .artifact_reference import ArtifactReference
from .complexity_level import ComplexityLevel
from .execution_result import ExecutionResult, ExecutionStatus
from .flexible_specialist_type import (
    normalize_specialist_type,
    validate_specialist_type,
)
from .specialist_type import SpecialistCapability, SpecialistType
from .task_status import TaskComplexity, TaskPriority, TaskStatus
from .time_window import Duration, TimeWindow

__all__ = [
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
    "ComplexityLevel",
    "validate_specialist_type",
    "normalize_specialist_type",
]
