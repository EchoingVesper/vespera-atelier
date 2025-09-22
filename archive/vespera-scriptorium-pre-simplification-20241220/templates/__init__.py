"""
Vespera V2 Template System

This module provides template creation and instantiation capabilities
using Copier as the underlying template engine, adapted for V2 task trees.
"""

from .engine import V2TemplateEngine
from .models import TemplateConfig, TaskTemplate, RoleTemplate, TemplateInstantiationResult, TemplateValidationResult, TemplateCategory
from .generator import TaskTreeGenerator
from .validator import TemplateValidator
from .mcp_integration import MCPTemplateClient, template_mcp_client

__all__ = [
    "V2TemplateEngine",
    "TemplateConfig", 
    "TaskTemplate",
    "RoleTemplate",
    "TemplateInstantiationResult",
    "TemplateValidationResult", 
    "TemplateCategory",
    "TaskTreeGenerator",
    "TemplateValidator",
    "MCPTemplateClient",
    "template_mcp_client"
]