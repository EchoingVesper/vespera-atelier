"""
Role Manager for hierarchical role loading, inheritance, and LLM validation.

Manages the complete role system including global defaults, project overrides,
and instance-specific customization with capability inheritance.
"""

import logging
from pathlib import Path
from typing import Dict, List, Optional, Set, Union
import yaml

from .definitions import Role, CapabilityType, RestrictionType, RoleCapability, RoleRestriction


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
                        self.roles[role_name] = role
                        logger.debug(f"Loaded role '{role_name}' from {source}: {file_path}")
                    except Exception as e:
                        logger.error(f"Failed to parse role '{role_name}' in {file_path}: {e}")
    
    def _create_default_roles(self) -> None:
        """Create default built-in roles if no templates exist."""
        default_roles = {
            "orchestrator": Role(
                name="orchestrator",
                display_name="Task Orchestrator",
                description="Coordinates task breakdown and agent assignment",
                system_prompt="You are a Task Orchestrator focused on breaking down complex tasks into manageable subtasks and coordinating their execution.",
                preferred_llm="local:ollama:llama3",
                fallback_llms=["claude-3-5-sonnet", "gpt-4"],
                capabilities=[
                    RoleCapability.from_string("spawn_tasks"),
                    RoleCapability.from_string("agent_coordination"),
                    RoleCapability.from_string("file_read"),
                    RoleCapability.from_string("database_read"),
                    RoleCapability.from_string("database_write")
                ],
                restrictions=[],
                task_types=["coordination", "planning", "breakdown"],
                tags=["management", "coordination"]
            ),
            
            "coder": Role(
                name="coder",
                display_name="Code Implementation Specialist",
                description="Implements code following specifications with capability restrictions",
                system_prompt="You are a Code Implementation Specialist focused on writing clean, efficient code following specifications.",
                preferred_llm="local:ollama:codellama",
                fallback_llms=["claude-3-5-sonnet", "gpt-4"],
                capabilities=[
                    RoleCapability.from_string("file_read"),
                    RoleCapability.from_string("file_write"),
                    RoleCapability.from_string("file_create"),
                    RoleCapability.from_string("code_execution")
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
                preferred_llm="claude-3-5-sonnet",
                fallback_llms=["gpt-4", "local:ollama:llama3"],
                capabilities=[
                    RoleCapability.from_string("file_read"),
                    RoleCapability.from_string("network_access"),
                    RoleCapability.from_string("database_read")
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
                capabilities=[
                    RoleCapability.from_string("file_read"),
                    RoleCapability.from_string("file_write"),
                    RoleCapability.from_string("code_execution")
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
                capabilities=[
                    RoleCapability.from_string("file_read"),
                    RoleCapability.from_string("database_read")
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
            
            # Merge capabilities from parent (child overrides parent)
            parent_cap_types = {cap.type for cap in parent_role.capabilities}
            child_cap_types = {cap.type for cap in role.capabilities}
            
            for parent_cap in parent_role.capabilities:
                if parent_cap.type not in child_cap_types:
                    role.capabilities.append(parent_cap)
            
            # Merge context requirements
            role.context_requirements = list(set(
                role.context_requirements + parent_role.context_requirements
            ))
            
            # Merge task types
            role.task_types = list(set(
                role.task_types + parent_role.task_types
            ))
        
        visited.remove(role_name)
    
    def get_role(self, role_name: str) -> Optional[Role]:
        """Get a role by name."""
        return self.roles.get(role_name)
    
    def list_roles(self) -> List[str]:
        """Get list of all available role names."""
        return list(self.roles.keys())
    
    def get_roles_by_capability(self, capability: Union[CapabilityType, str]) -> List[Role]:
        """Get all roles that have a specific capability."""
        if isinstance(capability, str):
            capability = CapabilityType(capability)
        
        return [role for role in self.roles.values() if role.has_capability(capability)]
    
    def get_roles_by_task_type(self, task_type: str) -> List[Role]:
        """Get all roles suitable for a specific task type."""
        return [
            role for role in self.roles.values() 
            if task_type in role.task_types
        ]
    
    def validate_role_assignment(self, role_name: str, required_capabilities: List[str]) -> bool:
        """Validate that a role has all required capabilities for a task."""
        role = self.get_role(role_name)
        if not role:
            return False
        
        for required_cap in required_capabilities:
            if not role.has_capability(required_cap):
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
                'capabilities': [cap.type.value for cap in role.capabilities],
                'restrictions': len(role.restrictions),
                'task_types': role.task_types,
                'tags': role.tags
            }
        return summary