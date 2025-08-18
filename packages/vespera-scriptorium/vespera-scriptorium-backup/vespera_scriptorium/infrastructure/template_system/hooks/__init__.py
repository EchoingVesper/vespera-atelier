"""
Template System Hooks - Intelligent automation framework for templates.

This module provides the hook system that enables templates to automatically
spawn agents, coordinate workflows, and manage execution lifecycles.
"""

from .base import Hook, HookContext, HookExecutionError, HookResult, HookType
from .builtin_hooks import (
    AgentSpawningHook,
    CheckpointHook,
    CommitHook,
    DocumentAssociationHook,
    GitBranchHook,
    NotificationHook,
    ValidationHook,
    WorkspaceSetupHook,
)
from .context import ContextBuilder, ContextManager, ExecutionContext
from .executor import DependencyGraph, ExecutionPlan, HookExecutor
from .registry import HookRegistry, get_hook, list_hooks, register_hook

__all__ = [
    # Base classes
    "Hook",
    "HookType",
    "HookContext",
    "HookResult",
    "HookExecutionError",
    # Execution framework
    "HookExecutor",
    "DependencyGraph",
    "ExecutionPlan",
    # Context management
    "ContextManager",
    "ContextBuilder",
    "ExecutionContext",
    # Built-in hooks
    "GitBranchHook",
    "WorkspaceSetupHook",
    "AgentSpawningHook",
    "DocumentAssociationHook",
    "CheckpointHook",
    "ValidationHook",
    "CommitHook",
    "NotificationHook",
    # Registry functions
    "HookRegistry",
    "register_hook",
    "get_hook",
    "list_hooks",
]
