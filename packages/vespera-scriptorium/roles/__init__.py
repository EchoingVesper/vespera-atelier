"""
Vespera Scriptorium V2 Role System

Roo Code-inspired role system with capability restrictions for AI agent management.
Provides hierarchical role definitions, LLM associations, and fine-grained permissions.
"""

from .definitions import Role, RoleCapability, RoleRestriction
from .manager import RoleManager
from .validation import RoleValidator
from .execution import RoleExecutor

__all__ = [
    'Role',
    'RoleCapability', 
    'RoleRestriction',
    'RoleManager',
    'RoleValidator',
    'RoleExecutor'
]