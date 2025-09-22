"""
Vespera V2 Hook System

Provides automated workflow orchestration with event-driven triggers
that can spawn both programmatic actions and LLM-based operations.

Based on VESPERA_VISION_PLANNING_WORKSHEET.md Section 5: Workflow Automation & Hooks
"""

from .core.engine import HookEngine
from .core.registry import HookRegistry
from .triggers import HookTrigger, FileTrigger, TaskTrigger, GitTrigger, TimeTrigger
from .actions import HookAction, ProgrammaticAction, LLMAction, TaskSpawnAction
# from .templates.factory import HookTemplateFactory  # TODO: Implement hook templates

__all__ = [
    "HookEngine",
    "HookRegistry", 
    "HookTrigger",
    "FileTrigger",
    "TaskTrigger", 
    "GitTrigger",
    "TimeTrigger",
    "HookAction",
    "ProgrammaticAction",
    "LLMAction",
    "TaskSpawnAction",
    # "HookTemplateFactory"  # TODO: Implement hook templates
]