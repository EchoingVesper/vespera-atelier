"""
Vespera V2 Template System

This module provides template creation and instantiation capabilities
using Copier as the underlying template engine, adapted for V2 task trees.
"""

from .engine import V2TemplateEngine
from .models import TemplateConfig, TaskTemplate, RoleTemplate
from .generator import TaskTreeGenerator

__all__ = [
    "V2TemplateEngine",
    "TemplateConfig", 
    "TaskTemplate",
    "RoleTemplate",
    "TaskTreeGenerator"
]