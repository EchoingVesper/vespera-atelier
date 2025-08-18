"""
Hook System Data Models

Defines the core data structures for the Vespera V2 hook system,
implementing the priorities from VESPERA_VISION_PLANNING_WORKSHEET.md.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Any, Optional, Union
from datetime import datetime


class HookTriggerType(Enum):
    """Types of triggers that can activate hooks"""
    FILE_CHANGE = "file_change"           # File creation, modification, deletion
    TASK_STATUS = "task_status"           # Task created, started, completed, failed
    GIT_OPERATION = "git_operation"       # Branch, commit, PR operations
    TIME_BASED = "time_based"            # Scheduled or recurring triggers  
    USER_ACTION = "user_action"          # Manual user-initiated triggers
    DEPENDENCY = "dependency"             # Task dependency resolution


class HookActionType(Enum):
    """Types of actions hooks can perform"""
    PROGRAMMATIC = "programmatic"         # Pure code execution (tests, git ops)
    LLM_OPERATION = "llm_operation"      # Spawn LLM for investigation/work
    TASK_SPAWN = "task_spawn"            # Create new tasks in the system
    NOTIFICATION = "notification"         # Alert user or external systems
    FILE_OPERATION = "file_operation"    # Create, modify, delete files
    EXTERNAL_CALL = "external_call"      # Call external APIs or services


class HookPriority(Enum):
    """Hook execution priority levels from VESPERA_VISION_PLANNING_WORKSHEET.md"""
    CRITICAL = 10      # File type-based context loading, automatic task breakdown
    HIGH = 9          # Git operations, dependency tracking
    NORMAL = 8        # Test execution, progress summarization
    LOW = 7           # Documentation updates
    BACKGROUND = 6    # Code review spawning
    OPTIONAL = 5      # CI/CD integration
    DEFERRED = 4      # Security/compliance (can be delayed)


@dataclass
class HookContext:
    """Context information passed to hook actions"""
    trigger_type: HookTriggerType
    trigger_data: Dict[str, Any]
    timestamp: datetime
    user_id: Optional[str] = None
    task_id: Optional[str] = None
    file_path: Optional[str] = None
    additional_context: Dict[str, Any] = field(default_factory=dict)


@dataclass
class HookTriggerConfig:
    """Configuration for when a hook should trigger"""
    trigger_type: HookTriggerType
    conditions: Dict[str, Any]  # Type-specific conditions
    debounce_seconds: float = 0.5  # Prevent rapid re-triggering
    enabled: bool = True


@dataclass 
class HookActionConfig:
    """Configuration for what a hook should do"""
    action_type: HookActionType
    implementation: str  # Python module path or LLM role name
    parameters: Dict[str, Any] = field(default_factory=dict)
    timeout_seconds: int = 300  # 5 minute default timeout
    retry_count: int = 3
    require_approval: bool = False  # For dangerous operations


@dataclass
class HookDefinition:
    """Complete hook definition combining trigger and actions"""
    id: str
    name: str
    description: str
    priority: HookPriority
    trigger: HookTriggerConfig
    actions: List[HookActionConfig]
    enabled: bool = True
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    execution_count: int = 0
    last_execution: Optional[datetime] = None
    tags: List[str] = field(default_factory=list)


@dataclass
class HookExecution:
    """Record of a hook execution"""
    id: str
    hook_id: str
    context: HookContext
    started_at: datetime
    completed_at: Optional[datetime] = None
    status: str = "running"  # running, completed, failed, cancelled
    results: List[Dict[str, Any]] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    spawned_tasks: List[str] = field(default_factory=list)


@dataclass
class FileTypeHook:
    """File type-based hook configuration from worksheet Section 4.1"""
    file_extensions: List[str]
    context_documents: List[str]  # Documents to auto-link
    roles: List[str]  # Preferred roles for this file type
    template_patterns: List[str]  # Task templates to suggest
    validation_rules: List[str]  # File-specific validation
    

# Pre-configured file type hooks from VESPERA_VISION_PLANNING_WORKSHEET.md
FILE_TYPE_HOOKS = {
    ".py": FileTypeHook(
        file_extensions=[".py"],
        context_documents=["project_python_docs", "coding_standards", "api_docs", "roo_code_patterns"],
        roles=["coder", "tester", "reviewer"],
        template_patterns=["implementation", "testing", "refactoring"],
        validation_rules=["python_syntax", "import_validation", "pep8_compliance"]
    ),
    ".md": FileTypeHook(
        file_extensions=[".md"],
        context_documents=["writing_guidelines", "project_overview", "prp_templates"],
        roles=["documenter", "researcher", "reviewer"],
        template_patterns=["documentation", "research", "planning"],
        validation_rules=["markdown_syntax", "link_validation", "spell_check"]
    ),
    ".test.py": FileTypeHook(
        file_extensions=[".test.py", "_test.py", "test_*.py"],
        context_documents=["testing_guidelines", "test_patterns"],
        roles=["tester", "coder"],
        template_patterns=["testing", "test_automation"],
        validation_rules=["test_structure", "assertion_coverage", "mock_usage"]
    ),
    ".sql": FileTypeHook(
        file_extensions=[".sql"],
        context_documents=["database_schema", "migration_docs"],
        roles=["architect", "coder"],
        template_patterns=["database_design", "migration"],
        validation_rules=["sql_syntax", "migration_safety", "data_integrity"]
    ),
    ".js": FileTypeHook(
        file_extensions=[".js", ".jsx", ".ts", ".tsx"],
        context_documents=["javascript_standards", "framework_docs"],
        roles=["coder", "tester"],
        template_patterns=["implementation", "component_design"],
        validation_rules=["javascript_syntax", "eslint_rules", "type_safety"]
    ),
    ".vue": FileTypeHook(
        file_extensions=[".vue"],
        context_documents=["component_patterns", "ui_guidelines"],
        roles=["coder", "designer"],
        template_patterns=["component_design", "ui_implementation"],
        validation_rules=["vue_syntax", "component_structure", "style_guide"]
    )
}