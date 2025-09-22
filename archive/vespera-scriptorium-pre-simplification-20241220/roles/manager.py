"""
Role Manager for hierarchical role loading, inheritance, and LLM validation.

Manages the complete role system including global defaults, project overrides,
and instance-specific customization with capability inheritance.
"""

import logging
from pathlib import Path
from typing import Dict, List, Optional, Set, Union
import yaml

from .definitions import Role, ToolGroup, ToolGroupOptions, ToolGroupEntry, RestrictionType, RoleRestriction


logger = logging.getLogger(__name__)


class RoleManager:
    """
    Manages role definitions with hierarchical loading and inheritance.
    
    Role Resolution Order:
    1. Global defaults (built-in roles)
    2. Project-level overrides 
    3. Instance-specific customizations
    
    Supports role inheritance and capability merging.
    """
    
    def __init__(self, project_root: Optional[Path] = None):
        self.project_root = project_root
        self.roles: Dict[str, Role] = {}
        self.role_hierarchy: Dict[str, Set[str]] = {}  # parent -> children
        
        # Standard role paths
        self.global_roles_path = Path(__file__).parent / "templates"
        self.project_roles_path = project_root / ".vespera_scriptorium" / "roles" if project_root else None
        
        # Initialize template-driven model configuration
        try:
            from .model_config import ModelConfigManager
            self.model_config_manager = ModelConfigManager()
            logger.info(f"Template-driven model configuration loaded with {len(self.model_config_manager.validator.registry)} models")
        except Exception as e:
            logger.warning(f"Failed to load model configuration, using defaults: {e}")
            self.model_config_manager = None
        
        self._load_all_roles()
    
    def _load_all_roles(self) -> None:
        """Load roles in hierarchical order: global -> project -> instance."""
        # Load global/built-in roles first
        self._load_global_roles()
        
        # Load project-specific roles (override globals)
        if self.project_roles_path and self.project_roles_path.exists():
            self._load_project_roles()
        
        # Resolve inheritance after all roles are loaded
        self._resolve_inheritance()
        
        logger.info(f"Loaded {len(self.roles)} roles: {list(self.roles.keys())}")
    
    def _load_global_roles(self) -> None:
        """Load built-in role templates."""
        # Try to load the enhanced roles file first
        enhanced_roles_file = self.global_roles_path / "enhanced_roles.yaml"
        if enhanced_roles_file.exists():
            try:
                self._load_role_file(enhanced_roles_file, source="global")
                return
            except Exception as e:
                logger.error(f"Failed to load enhanced roles: {e}")
        
        # Fall back to other YAML files or create defaults
        if not self.global_roles_path.exists():
            logger.warning(f"Global roles path not found: {self.global_roles_path}")
            self._create_default_roles()
            return
        
        for yaml_file in self.global_roles_path.glob("*.yaml"):
            try:
                self._load_role_file(yaml_file, source="global")
            except Exception as e:
                logger.error(f"Failed to load global role {yaml_file}: {e}")
    
    def _load_project_roles(self) -> None:
        """Load project-specific role overrides."""
        for yaml_file in self.project_roles_path.glob("*.yaml"):
            try:
                self._load_role_file(yaml_file, source="project")
            except Exception as e:
                logger.error(f"Failed to load project role {yaml_file}: {e}")
    
    def _load_role_file(self, file_path: Path, source: str) -> None:
        """Load role(s) from a YAML file."""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        if not data:
            logger.warning(f"Empty role file: {file_path}")
            return
        
        # Handle multiple roles in one file
        if isinstance(data, dict):
            for role_name, role_data in data.items():
                if isinstance(role_data, dict):
                    try:
                        role_data['name'] = role_name
                        role = Role.from_dict(role_data)
                        
                        # Apply template-driven model configuration
                        if self.model_config_manager:
                            model_config = self.model_config_manager.get_role_model_config(role_name)
                            role.preferred_llm = model_config["preferred_llm"]
                            role.fallback_llms = model_config["fallback_llms"]
                            logger.debug(f"Applied template model config to '{role_name}': {model_config}")
                        
                        self.roles[role_name] = role
                        logger.debug(f"Loaded role '{role_name}' from {source}: {file_path}")
                    except Exception as e:
                        logger.error(f"Failed to parse role '{role_name}' in {file_path}: {e}")
    
    def _create_default_roles(self) -> None:
        """Create default built-in roles if no templates exist."""
        # Get template model configuration
        orchestrator_models = self.model_config_manager.get_role_model_config("orchestrator") if self.model_config_manager else {"preferred_llm": "sonnet", "fallback_llms": ["gpt-4"]}
        coder_models = self.model_config_manager.get_role_model_config("coder") if self.model_config_manager else {"preferred_llm": "sonnet", "fallback_llms": ["gpt-4"]}
        researcher_models = self.model_config_manager.get_role_model_config("researcher") if self.model_config_manager else {"preferred_llm": "sonnet", "fallback_llms": ["gpt-4"]}
        
        default_roles = {
            "orchestrator": Role(
                name="orchestrator",
                display_name="Task Orchestrator",
                description="Coordinates task breakdown and agent assignment",
                system_prompt="You are a Task Orchestrator focused on breaking down complex tasks into manageable subtasks and coordinating their execution.",
                preferred_llm=orchestrator_models["preferred_llm"],
                fallback_llms=orchestrator_models["fallback_llms"],
                tool_groups=[
                    ToolGroup.READ,
                    ToolGroup.COORDINATION,
                    ToolGroup.MCP
                ],
                restrictions=[
                    RoleRestriction.from_string("max_task_depth: 5")
                ],
                task_types=["coordination", "planning", "breakdown"],
                tags=["management", "coordination"]
            ),
            
            "coder": Role(
                name="coder",
                display_name="Code Implementation Specialist",
                description="Implements code following specifications with capability restrictions",
                system_prompt="You are a Code Implementation Specialist focused on writing clean, efficient code following specifications.",
                preferred_llm=coder_models["preferred_llm"],
                fallback_llms=coder_models["fallback_llms"],
                tool_groups=[
                    ToolGroup.READ,
                    ToolGroup.EDIT,
                    ToolGroup.COMMAND
                ],
                restrictions=[
                    RoleRestriction.from_string("max_file_changes: 5"),
                    RoleRestriction.from_string("single_codeblock_only: true")
                ],
                context_requirements=["coding_standards", "api_documentation"],
                task_types=["implementation", "coding"],
                validation_rules=["code_compiles", "tests_pass"],
                tags=["development", "implementation"]
            ),
            
            "researcher": Role(
                name="researcher", 
                display_name="Research and Analysis Specialist",
                description="Conducts research and gathers information for informed decisions",
                system_prompt="You are a Research and Analysis Specialist focused on gathering and synthesizing information.",
                preferred_llm=researcher_models["preferred_llm"],
                fallback_llms=researcher_models["fallback_llms"],
                tool_groups=[
                    ToolGroup.READ,
                    ToolGroup.BROWSER,
                    ToolGroup.MCP
                ],
                restrictions=[
                    RoleRestriction.from_string("read_only_database: true"),
                    RoleRestriction.from_string("no_destructive_operations: true")
                ],
                task_types=["research", "analysis", "investigation"],
                tags=["research", "analysis"]
            ),
            
            "tester": Role(
                name="tester",
                display_name="Testing and Validation Specialist", 
                description="Validates implementations and ensures quality",
                system_prompt="You are a Testing and Validation Specialist focused on ensuring code quality and correctness.",
                preferred_llm="local:ollama:llama3",
                fallback_llms=["claude-3-5-sonnet", "gpt-4"],
                tool_groups=[
                    ToolGroup.READ,
                    (ToolGroup.EDIT, ToolGroupOptions(file_regex=r".*test.*\.py$", description="Test files only")),
                    ToolGroup.COMMAND
                ],
                restrictions=[
                    RoleRestriction.from_string("max_file_changes: 3")
                ],
                context_requirements=["testing_guidelines", "test_patterns"],
                task_types=["testing", "validation", "quality_assurance"],
                validation_rules=["tests_pass", "coverage_adequate"],
                tags=["testing", "quality"]
            ),
            
            "reviewer": Role(
                name="reviewer",
                display_name="Code Review and Quality Specialist",
                description="Reviews code for quality, security, and best practices",
                system_prompt="You are a Code Review and Quality Specialist focused on ensuring code quality and security.",
                preferred_llm="claude-3-5-sonnet",
                fallback_llms=["gpt-4", "local:ollama:llama3"],
                tool_groups=[
                    ToolGroup.READ,
                    ToolGroup.MCP
                ],
                restrictions=[
                    RoleRestriction.from_string("read_only_database: true"),
                    RoleRestriction.from_string("no_destructive_operations: true")
                ],
                task_types=["review", "quality_assurance", "security_audit"],
                validation_rules=["follows_standards", "security_compliant"],
                tags=["review", "quality", "security"]
            )
        }
        
        self.roles.update(default_roles)
        logger.info("Created default role set")
    
    def _resolve_inheritance(self) -> None:
        """Resolve role inheritance and merge capabilities."""
        # Build inheritance hierarchy
        for role in self.roles.values():
            if role.parent_role:
                if role.parent_role not in self.role_hierarchy:
                    self.role_hierarchy[role.parent_role] = set()
                self.role_hierarchy[role.parent_role].add(role.name)
        
        # Apply inheritance (depth-first)
        for role_name in list(self.roles.keys()):
            self._apply_inheritance(role_name, set())
    
    def _apply_inheritance(self, role_name: str, visited: Set[str]) -> None:
        """Apply inheritance for a role (recursive)."""
        if role_name in visited:
            logger.warning(f"Circular inheritance detected for role: {role_name}")
            return
        
        visited.add(role_name)
        role = self.roles.get(role_name)
        if not role:
            return
        
        # Process parent role first
        if role.parent_role and role.parent_role in self.roles:
            parent_role = self.roles[role.parent_role]
            self._apply_inheritance(role.parent_role, visited.copy())
            
            # Merge tool groups from parent (child overrides parent)
            parent_groups = {self._get_tool_group_key(tg) for tg in parent_role.tool_groups}
            child_groups = {self._get_tool_group_key(tg) for tg in role.tool_groups}
            
            for parent_group in parent_role.tool_groups:
                parent_key = self._get_tool_group_key(parent_group)
                if parent_key not in child_groups:
                    role.tool_groups.append(parent_group)
            
            # Merge context requirements
            role.context_requirements = list(set(
                role.context_requirements + parent_role.context_requirements
            ))
            
            # Merge task types
            role.task_types = list(set(
                role.task_types + parent_role.task_types
            ))
        
        visited.remove(role_name)
    
    def _get_tool_group_key(self, tool_group_entry: ToolGroupEntry) -> str:
        """Get a unique key for a tool group entry for comparison."""
        if isinstance(tool_group_entry, ToolGroup):
            return tool_group_entry.value
        elif isinstance(tool_group_entry, tuple):
            return tool_group_entry[0].value
        return str(tool_group_entry)
    
    def get_role(self, role_name: str) -> Optional[Role]:
        """Get a role by name."""
        return self.roles.get(role_name)
    
    def list_roles(self) -> List[str]:
        """Get list of all available role names."""
        return list(self.roles.keys())
    
    def get_roles_by_tool_group(self, tool_group: Union[ToolGroup, str]) -> List[Role]:
        """Get all roles that have access to a specific tool group."""
        if isinstance(tool_group, str):
            tool_group = ToolGroup(tool_group)
        
        return [role for role in self.roles.values() if role.has_tool_group(tool_group)]
    
    def get_roles_by_task_type(self, task_type: str) -> List[Role]:
        """Get all roles suitable for a specific task type."""
        return [
            role for role in self.roles.values() 
            if task_type in role.task_types
        ]
    
    def validate_role_assignment(self, role_name: str, required_tool_groups: List[str]) -> bool:
        """Validate that a role has all required tool groups for a task."""
        role = self.get_role(role_name)
        if not role:
            return False
        
        for required_group in required_tool_groups:
            if not role.has_tool_group(required_group):
                return False
        
        return True
    
    def create_custom_role(self, role: Role, save_to_project: bool = True) -> bool:
        """Create a new custom role."""
        try:
            self.roles[role.name] = role
            
            if save_to_project and self.project_roles_path:
                self.project_roles_path.mkdir(parents=True, exist_ok=True)
                role_file = self.project_roles_path / f"{role.name}.yaml"
                role.save_yaml(role_file)
                logger.info(f"Saved custom role '{role.name}' to {role_file}")
            
            return True
        except Exception as e:
            logger.error(f"Failed to create custom role '{role.name}': {e}")
            return False
    
    def get_role_hierarchy(self) -> Dict[str, Set[str]]:
        """Get the complete role hierarchy."""
        return self.role_hierarchy.copy()
    
    def get_role_summary(self) -> Dict[str, Dict[str, any]]:
        """Get a summary of all roles with their key properties."""
        summary = {}
        for name, role in self.roles.items():
            summary[name] = {
                'display_name': role.display_name,
                'description': role.description,
                'preferred_llm': role.preferred_llm,
                'tool_groups': [group.value if isinstance(group, ToolGroup) else (group[0].value if isinstance(group, tuple) else str(group)) for group in role.tool_groups],
                'restrictions': len(role.restrictions),
                'task_types': role.task_types,
                'tags': role.tags
            }
        return summary