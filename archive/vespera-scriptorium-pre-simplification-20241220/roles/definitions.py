"""
Core role definitions and data structures for the Roo Code-inspired role system.

This module defines the fundamental types and structures for managing AI agent roles
with capability restrictions, LLM associations, and hierarchical inheritance.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any, Union
from enum import Enum
import yaml
import re
from pathlib import Path


# Always available tools (inspired by Roo Code)
ALWAYS_AVAILABLE_TOOLS = [
    "ask_followup_question",
    "attempt_completion", 
    "switch_mode",
    "user_interaction",
    "status_check"
]


class ToolGroup(Enum):
    """Tool groups that define sets of related capabilities (Roo Code-inspired)."""
    READ = "read"           # File reading, searching, listing
    EDIT = "edit"           # File writing, content manipulation
    COMMAND = "command"     # Terminal command execution
    BROWSER = "browser"     # Web browsing actions
    MCP = "mcp"            # Model Context Protocol tools
    COORDINATION = "coordination"  # Agent coordination and task spawning


class RestrictionType(Enum):
    """Types of restrictions that can be applied to roles."""
    MAX_FILE_CHANGES = "max_file_changes"
    MAX_TASK_DEPTH = "max_task_depth"
    SINGLE_CODEBLOCK_ONLY = "single_codeblock_only"
    TIME_LIMIT_MINUTES = "time_limit_minutes"
    MAX_TOKEN_USAGE = "max_token_usage"
    REQUIRE_APPROVAL = "require_approval"


@dataclass
class ToolGroupOptions:
    """Options that can be applied to a tool group (Roo Code-inspired)."""
    file_regex: Optional[str] = None
    description: Optional[str] = None
    
    def __post_init__(self):
        """Validate regex pattern if provided."""
        if self.file_regex:
            try:
                re.compile(self.file_regex)
            except re.error as e:
                raise ValueError(f"Invalid regex pattern '{self.file_regex}': {e}")
    
    def matches_file(self, file_path: str) -> bool:
        """Check if a file path matches the regex pattern."""
        if not self.file_regex:
            return True
        try:
            return bool(re.match(self.file_regex, file_path))
        except re.error:
            return False


# Tool group entry can be just the group or group with options
ToolGroupEntry = Union[ToolGroup, tuple[ToolGroup, ToolGroupOptions]]




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
    A role definition with tool groups, restrictions, and LLM associations.
    
    Enhanced with Roo Code's tool group approach for better capability management.
    """
    name: str
    display_name: str
    description: str
    system_prompt: str
    
    # LLM Configuration
    preferred_llm: str  # e.g., "local:ollama:llama3"
    fallback_llms: List[str] = field(default_factory=list)
    
    # Tool Group System (Roo Code-inspired)
    tool_groups: List[ToolGroupEntry] = field(default_factory=list)
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
    
    def has_tool_group(self, tool_group: Union[ToolGroup, str]) -> bool:
        """Check if role has access to a specific tool group."""
        if isinstance(tool_group, str):
            tool_group = ToolGroup(tool_group)
        
        for group_entry in self.tool_groups:
            if isinstance(group_entry, ToolGroup):
                if group_entry == tool_group:
                    return True
            elif isinstance(group_entry, tuple):
                if group_entry[0] == tool_group:
                    return True
        return False
    
    def get_tool_group_options(self, tool_group: Union[ToolGroup, str]) -> Optional[ToolGroupOptions]:
        """Get options for a specific tool group."""
        if isinstance(tool_group, str):
            tool_group = ToolGroup(tool_group)
        
        for group_entry in self.tool_groups:
            if isinstance(group_entry, tuple) and group_entry[0] == tool_group:
                return group_entry[1]
        return None
    
    def can_edit_file(self, file_path: str) -> bool:
        """Check if role can edit a specific file based on tool group restrictions."""
        if not self.has_tool_group(ToolGroup.EDIT):
            return False
        
        options = self.get_tool_group_options(ToolGroup.EDIT)
        if options:
            return options.matches_file(file_path)
        return True
    
    
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
        # Convert tool groups to serializable format
        tool_groups_data = []
        for group_entry in self.tool_groups:
            if isinstance(group_entry, ToolGroup):
                tool_groups_data.append(group_entry.value)
            elif isinstance(group_entry, tuple):
                group, options = group_entry
                tool_groups_data.append([
                    group.value,
                    {
                        "file_regex": options.file_regex,
                        "description": options.description
                    }
                ])
        
        return {
            'name': self.name,
            'display_name': self.display_name,
            'description': self.description,
            'system_prompt': self.system_prompt,
            'preferred_llm': self.preferred_llm,
            'fallback_llms': self.fallback_llms,
            'tool_groups': tool_groups_data,
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
        # Parse tool groups
        tool_groups = []
        for group_data in data.get('tool_groups', []):
            if isinstance(group_data, str):
                tool_groups.append(ToolGroup(group_data))
            elif isinstance(group_data, list) and len(group_data) == 2:
                group_name, options_data = group_data
                options = ToolGroupOptions(
                    file_regex=options_data.get('file_regex'),
                    description=options_data.get('description')
                )
                tool_groups.append((ToolGroup(group_name), options))
        
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
            tool_groups=tool_groups,
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