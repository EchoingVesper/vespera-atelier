"""
Domain entities for the Vespera Scriptorium.

Entities are the core business objects with unique identities.
They encapsulate business logic and maintain state.
"""

from .orchestration import OrchestrationSession, WorkItem
from .specialist import Specialist, SpecialistContext
from .task import LifecycleStage, Task, TaskStatus, TaskType

__all__ = [
    "Task",
    "TaskType",
    "TaskStatus",
    "LifecycleStage",
    "Specialist",
    "SpecialistContext",
    "OrchestrationSession",
    "WorkItem",
]
