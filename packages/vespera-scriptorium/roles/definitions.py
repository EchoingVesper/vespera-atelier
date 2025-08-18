"""
Core role definitions and data structures for the Roo Code-inspired role system.

This module defines the fundamental types and structures for managing AI agent roles
with capability restrictions, LLM associations, and hierarchical inheritance.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any, Union
from enum import Enum
import yaml
from pathlib import Path


class CapabilityType(Enum):
    """Types of capabilities that roles can have."""
    FILE_READ = "file_read"
    FILE_WRITE = "file_write"
    FILE_CREATE = "file_create"
    FILE_DELETE = "file_delete"
    CODE_EXECUTION = "code_execution"
    SPAWN_TASKS = "spawn_tasks"
    DATABASE_READ = "database_read"
    DATABASE_WRITE = "database_write"
    NETWORK_ACCESS = "network_access"
    SYSTEM_COMMANDS = "system_commands"
    USER_INTERACTION = "user_interaction"
    AGENT_COORDINATION = "agent_coordination"
    

class RestrictionType(Enum):
    """Types of restrictions that can be applied to roles."""
    MAX_FILE_CHANGES = "max_file_changes"
    MAX_TASK_DEPTH = "max_task_depth"
    SINGLE_CODEBLOCK_ONLY = "single_codeblock_only"
    NO_DESTRUCTIVE_OPERATIONS = "no_destructive_operations"
    READ_ONLY_DATABASE = "read_only_database"
    TIME_LIMIT_MINUTES = "time_limit_minutes"
    MAX_TOKEN_USAGE = "max_token_usage"
    REQUIRE_APPROVAL = "require_approval"


@dataclass
class RoleCapability:
    """A specific capability that a role possesses."""
    type: CapabilityType
    parameters: Dict[str, Any] = field(default_factory=dict)
    description: Optional[str] = None
    
    @classmethod
    def from_string(cls, capability_str: str) -> 'RoleCapability':
        """Create capability from string like 'file_read' or 'spawn_tasks:max_depth=3'."""
        if ':' in capability_str:
            cap_type, params_str = capability_str.split(':', 1)
            params = {}
            for param in params_str.split(','):
                key, value = param.split('=', 1)
                # Try to convert to appropriate type
                try:
                    params[key] = int(value)
                except ValueError:
                    try:
                        params[key] = float(value)
                    except ValueError:
                        params[key] = value
        else:
            cap_type = capability_str
            params = {}
            
        return cls(
            type=CapabilityType(cap_type),
            parameters=params
        )


@dataclass 
class RoleRestriction:
    """A restriction that limits role behavior."""
    type: RestrictionType
    value: Union[str, int, float, bool]
    description: Optional[str] = None
    
    @classmethod
    def from_string(cls, restriction_str: str) -> 'RoleRestriction':
        """Create restriction from string like 'max_file_changes: 5'."""
        if ':' in restriction_str:
            rest_type, value_str = restriction_str.split(':', 1)
            value_str = value_str.strip()
            
            # Convert value to appropriate type
            if value_str.lower() in ('true', 'false'):
                value = value_str.lower() == 'true'
            else:
                try:
                    value = int(value_str)
                except ValueError:
                    try:
                        value = float(value_str)
                    except ValueError:
                        value = value_str
        else:
            rest_type = restriction_str
            value = True
            
        return cls(
            type=RestrictionType(rest_type),
            value=value
        )


@dataclass
class Role:
    """
    A role definition with capabilities, restrictions, and LLM associations.
    
    Inspired by Roo Code's role system but enhanced for the Vespera architecture.
    """
    name: str
    display_name: str
    description: str
    system_prompt: str
    
    # LLM Configuration
    preferred_llm: str  # e.g., "local:ollama:llama3"
    fallback_llms: List[str] = field(default_factory=list)
    
    # Capability System (Roo Code-inspired)
    capabilities: List[RoleCapability] = field(default_factory=list)
    restrictions: List[RoleRestriction] = field(default_factory=list)
    
    # Context Requirements
    context_requirements: List[str] = field(default_factory=list)
    task_types: List[str] = field(default_factory=list)
    validation_rules: List[str] = field(default_factory=list)
    
    # Hierarchy
    parent_role: Optional[str] = None
    inherits_from: List[str] = field(default_factory=list)
    
    # Metadata
    version: str = "1.0"
    created_by: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    
    def has_capability(self, capability: Union[CapabilityType, str]) -> bool:
        """Check if role has a specific capability."""
        if isinstance(capability, str):
            capability = CapabilityType(capability)
        return any(cap.type == capability for cap in self.capabilities)
    
    def get_restriction(self, restriction_type: Union[RestrictionType, str]) -> Optional[RoleRestriction]:
        """Get a specific restriction by type."""
        if isinstance(restriction_type, str):
            restriction_type = RestrictionType(restriction_type)
        for restriction in self.restrictions:
            if restriction.type == restriction_type:
                return restriction
        return None
    
    def is_restricted(self, restriction_type: Union[RestrictionType, str]) -> bool:
        """Check if role has a specific restriction."""
        return self.get_restriction(restriction_type) is not None
    
    def get_max_file_changes(self) -> Optional[int]:
        """Get maximum file changes allowed, if restricted."""
        restriction = self.get_restriction(RestrictionType.MAX_FILE_CHANGES)
        return restriction.value if restriction else None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert role to dictionary for serialization."""
        return {
            'name': self.name,
            'display_name': self.display_name,
            'description': self.description,
            'system_prompt': self.system_prompt,
            'preferred_llm': self.preferred_llm,
            'fallback_llms': self.fallback_llms,
            'capabilities': [cap.type.value for cap in self.capabilities],
            'restrictions': [
                f"{rest.type.value}: {rest.value}" 
                for rest in self.restrictions
            ],
            'context_requirements': self.context_requirements,
            'task_types': self.task_types,
            'validation_rules': self.validation_rules,
            'parent_role': self.parent_role,
            'inherits_from': self.inherits_from,
            'version': self.version,
            'created_by': self.created_by,
            'tags': self.tags
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Role':
        """Create role from dictionary."""
        capabilities = [
            RoleCapability.from_string(cap) 
            for cap in data.get('capabilities', [])
        ]
        restrictions = [
            RoleRestriction.from_string(rest)
            for rest in data.get('restrictions', [])
        ]
        
        return cls(
            name=data['name'],
            display_name=data['display_name'],
            description=data['description'],
            system_prompt=data['system_prompt'],
            preferred_llm=data['preferred_llm'],
            fallback_llms=data.get('fallback_llms', []),
            capabilities=capabilities,
            restrictions=restrictions,
            context_requirements=data.get('context_requirements', []),
            task_types=data.get('task_types', []),
            validation_rules=data.get('validation_rules', []),
            parent_role=data.get('parent_role'),
            inherits_from=data.get('inherits_from', []),
            version=data.get('version', '1.0'),
            created_by=data.get('created_by'),
            tags=data.get('tags', [])
        )
    
    @classmethod
    def from_yaml_file(cls, file_path: Path) -> 'Role':
        """Load role from YAML file."""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        # Handle single role file vs multiple roles
        if isinstance(data, dict) and 'name' in data:
            return cls.from_dict(data)
        elif isinstance(data, dict) and len(data) == 1:
            # Single role with name as key
            role_name, role_data = next(iter(data.items()))
            role_data['name'] = role_name
            return cls.from_dict(role_data)
        else:
            raise ValueError(f"Invalid role file format: {file_path}")
    
    def save_yaml(self, file_path: Path) -> None:
        """Save role to YAML file."""
        with open(file_path, 'w', encoding='utf-8') as f:
            yaml.dump(
                {self.name: self.to_dict()}, 
                f, 
                default_flow_style=False,
                allow_unicode=True
            )