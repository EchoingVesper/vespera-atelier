"""
V2 Template System Data Models

Defines the structure for V2 templates that integrate with Copier
while supporting our task tree and role system architecture.
"""

from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, field
from enum import Enum

from tasks.models import TaskPriority, TaskStatus
from roles.definitions import ToolGroup


class TemplateCategory(Enum):
    """Categories for organizing templates"""
    META_PRP = "meta_prp"
    WORKFLOW = "workflow"  
    EXECUTIVE_DYSFUNCTION = "executive_dysfunction"
    PROJECT_SETUP = "project_setup"
    VALIDATION = "validation"
    CUSTOM = "custom"


@dataclass
class RoleTemplate:
    """Template for role assignment with capability validation"""
    name: str
    description: str
    required_tool_groups: List[ToolGroup]
    file_pattern_restrictions: Optional[str] = None
    max_file_changes: Optional[int] = None
    max_task_depth: Optional[int] = None


@dataclass 
class TaskTemplate:
    """Template for individual task creation"""
    template_id: str
    title_template: str  # e.g., "{PROJECT_NAME} Architecture Design"
    description_template: str
    priority: TaskPriority = TaskPriority.NORMAL
    estimated_effort: Optional[str] = None
    required_role: Optional[str] = None
    file_pattern_restrictions: Optional[str] = None
    
    # Lists with default factories
    required_tool_groups: List[ToolGroup] = field(default_factory=list)
    template_variables: List[str] = field(default_factory=list)
    context_references: List[str] = field(default_factory=list)
    depends_on: List[str] = field(default_factory=list)
    blocks: List[str] = field(default_factory=list)


@dataclass
class ValidationGate:
    """Quality validation milestone"""
    milestone: str
    required_artifacts: List[str]
    quality_targets: Dict[str, int]  # metric -> target_score
    assigned_role: str = "reviewer"


@dataclass
class ExecutiveDysfunctionSupport:
    """Support for executive dysfunction patterns"""
    decision_elimination: List[Dict[str, str]]  # choice -> predefined_value
    progress_tracking: Dict[str, Any]
    auto_preservation: str = "git_commits_every_completion"


@dataclass
class TemplateConfig:
    """Complete V2 template configuration"""
    name: str
    description: str
    category: TemplateCategory
    root_task: TaskTemplate
    version: str = "1.0.0"
    
    # Template structure
    task_hierarchy: List[TaskTemplate] = field(default_factory=list)
    dependencies: Dict[str, List[str]] = field(default_factory=dict)
    
    # Role distribution
    role_assignments: Dict[str, str] = field(default_factory=dict)  # task_id -> role_name
    custom_roles: List[RoleTemplate] = field(default_factory=list)
    
    # Executive dysfunction support
    executive_dysfunction_support: Optional[ExecutiveDysfunctionSupport] = None
    
    # Validation framework
    validation_gates: List[ValidationGate] = field(default_factory=list)
    
    # Template metadata
    template_variables: List[str] = field(default_factory=list)
    copier_config: Dict[str, Any] = field(default_factory=dict)
    
    # Migration support
    min_copier_version: str = "9.0.0"
    update_instructions: Optional[str] = None


@dataclass
class TemplateInstantiationResult:
    """Result of template instantiation"""
    success: bool
    root_task_id: Optional[str] = None
    created_task_ids: List[str] = field(default_factory=list)
    created_dependencies: List[Dict[str, str]] = field(default_factory=list)
    role_assignments: Dict[str, str] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    
    
@dataclass
class TemplateValidationResult:
    """Result of template validation"""
    valid: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)