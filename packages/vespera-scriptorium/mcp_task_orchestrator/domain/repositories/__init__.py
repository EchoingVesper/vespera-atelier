"""
Repository interfaces for the domain layer.

These interfaces define the contracts that infrastructure implementations
must follow, enabling the domain layer to remain independent of specific
data storage technologies.
"""

from .task_repository import TaskRepository
from .async_task_repository import AsyncTaskRepository
from .state_repository import StateRepository
from .specialist_repository import SpecialistRepository

__all__ = [
    'TaskRepository',
    'AsyncTaskRepository',
    'StateRepository', 
    'SpecialistRepository'
]