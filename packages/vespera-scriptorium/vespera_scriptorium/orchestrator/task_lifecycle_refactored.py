"""
Task Lifecycle Management for the Vespera Scriptorium (Refactored).

This module provides a simplified interface to the modular lifecycle management system.
The original 1,132-line file has been refactored into focused modules for maintainability
and Claude Code safety.

For backward compatibility, this module re-exports the main classes and maintains
the same API as the original task_lifecycle.py.
"""

import logging
from typing import Any, Dict, List, Optional

from ..db.persistence import DatabasePersistenceManager
from .artifacts import ArtifactManager
from .lifecycle import StaleTaskReason, TaskLifecycleManager, TaskLifecycleState

logger = logging.getLogger("mcp_task_orchestrator.lifecycle")

# Re-export main classes for backward compatibility
__all__ = ["TaskLifecycleManager", "TaskLifecycleState", "StaleTaskReason"]

# Backward compatibility aliases
TaskLifecycleState = TaskLifecycleState
StaleTaskReason = StaleTaskReason


def create_lifecycle_manager(
    state_manager: DatabasePersistenceManager, artifact_manager: ArtifactManager
) -> TaskLifecycleManager:
    """Factory function to create a TaskLifecycleManager instance.

    Args:
        state_manager: Database persistence manager
        artifact_manager: Artifact management instance

    Returns:
        Configured TaskLifecycleManager instance
    """
    return TaskLifecycleManager(state_manager, artifact_manager)


# For any modules that import directly from this file, provide the main class
TaskLifecycleManager = TaskLifecycleManager
