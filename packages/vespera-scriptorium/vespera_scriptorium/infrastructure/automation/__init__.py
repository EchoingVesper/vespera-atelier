"""
Infrastructure Automation Module

Provides background automation and validation systems for improved reliability.
"""

from .automation_manager import (
    AutomationManager,
    get_automation_manager,
    start_automation,
    stop_automation,
)
from .validation_hooks import (
    HookTrigger,
    ValidationHook,
    ValidationHooksManager,
    ValidationResult,
    get_validation_hooks_manager,
    run_validation_hooks,
)

__all__ = [
    "AutomationManager",
    "get_automation_manager", 
    "start_automation",
    "stop_automation",
    "HookTrigger",
    "ValidationHook",
    "ValidationHooksManager",
    "ValidationResult",
    "get_validation_hooks_manager",
    "run_validation_hooks",
]