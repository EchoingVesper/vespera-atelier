"""
Role validation and LLM availability checking.

Validates role configurations, checks LLM availability, and provides
automatic remapping with user confirmation for missing LLMs.
"""

import logging
from typing import Dict, List, Optional, Set, Tuple, Union
import subprocess
import requests
from pathlib import Path

from .definitions import Role, ToolGroup, RestrictionType


logger = logging.getLogger(__name__)


class LLMProvider:
    """Represents an available LLM provider and model."""
    def __init__(self, provider: str, model: str, available: bool = False, reason: str = ""):
        self.provider = provider
        self.model = model
        self.available = available
        self.reason = reason
        
    @property
    def full_name(self) -> str:
        """Get full LLM identifier like 'local:ollama:llama3'."""
        return f"{self.provider}:{self.model}"
    
    def __str__(self) -> str:
        return f"{self.full_name} ({'✓' if self.available else '✗'} {self.reason})"


class RoleValidator:
    """
    Validates role configurations and LLM availability.
    
    Provides comprehensive validation including:
    - Role definition completeness
    - Capability/restriction consistency  
    - LLM availability checking
    - Automatic fallback suggestions
    """
    
    def __init__(self):
        self.llm_providers: Dict[str, LLMProvider] = {}
        self.validation_errors: List[str] = []
        self.validation_warnings: List[str] = []
        
    def validate_role(self, role: Role) -> Tuple[bool, List[str], List[str]]:
        """
        Validate a role definition completely.
        
        Returns:
            (is_valid, errors, warnings)
        """
        self.validation_errors.clear()
        self.validation_warnings.clear()
        
        # Basic structure validation
        self._validate_basic_structure(role)
        
        # Tool group/restriction consistency
        self._validate_tool_groups_and_restrictions(role)
        
        # LLM availability
        self._validate_llm_configuration(role)
        
        # Context and task type validation
        self._validate_context_requirements(role)
        
        return (
            len(self.validation_errors) == 0,
            self.validation_errors.copy(),
            self.validation_warnings.copy()
        )
    
    def _validate_basic_structure(self, role: Role) -> None:
        """Validate basic role structure and required fields."""
        if not role.name or not role.name.strip():
            self.validation_errors.append("Role name is required")
        
        if not role.display_name or not role.display_name.strip():
            self.validation_errors.append("Role display_name is required")
        
        if not role.description or not role.description.strip():
            self.validation_errors.append("Role description is required")
        
        if not role.system_prompt or not role.system_prompt.strip():
            self.validation_errors.append("Role system_prompt is required")
        
        if not role.preferred_llm or not role.preferred_llm.strip():
            self.validation_errors.append("Role preferred_llm is required")
        
        # Validate name format (alphanumeric, underscore, hyphen only)
        if role.name and not all(c.isalnum() or c in '_-' for c in role.name):
            self.validation_errors.append(
                "Role name must contain only alphanumeric characters, underscores, and hyphens"
            )
    
    def _validate_tool_groups_and_restrictions(self, role: Role) -> None:
        """Validate tool group and restriction consistency."""
        # Check for conflicting tool groups/restrictions
        if role.has_tool_group(ToolGroup.EDIT):
            max_changes = role.get_restriction(RestrictionType.MAX_FILE_CHANGES)
            if not max_changes:
                self.validation_warnings.append(
                    "Role has EDIT tool group but no max_file_changes restriction. "
                    "Consider adding max_file_changes restriction for safety."
                )
        
        # Check for command execution without restrictions
        if role.has_tool_group(ToolGroup.COMMAND):
            if not role.is_restricted(RestrictionType.REQUIRE_APPROVAL):
                self.validation_warnings.append(
                    "Role has COMMAND tool group without require_approval restriction. "
                    "Consider adding approval requirements for command execution safety."
                )
        
        # Check for coordination without depth restriction
        if role.has_tool_group(ToolGroup.COORDINATION):
            if not role.is_restricted(RestrictionType.MAX_TASK_DEPTH):
                self.validation_warnings.append(
                    "Role has COORDINATION tool group without max_task_depth restriction. "
                    "Consider adding task depth limits to prevent infinite recursion."
                )
    
    def _validate_llm_configuration(self, role: Role) -> None:
        """Validate LLM configuration and availability."""
        # Check preferred LLM format
        if not self._is_valid_llm_identifier(role.preferred_llm):
            self.validation_errors.append(
                f"Invalid preferred_llm format: '{role.preferred_llm}'. "
                "Expected format: 'provider:model' or 'local:ollama:model'"
            )
        
        # Check fallback LLMs format
        for fallback in role.fallback_llms:
            if not self._is_valid_llm_identifier(fallback):
                self.validation_errors.append(
                    f"Invalid fallback_llm format: '{fallback}'. "
                    "Expected format: 'provider:model' or 'local:ollama:model'"
                )
        
        # Check availability if no format errors
        if not self.validation_errors:
            self._check_llm_availability(role)
    
    def _validate_context_requirements(self, role: Role) -> None:
        """Validate context requirements and task types."""
        # Check for empty task types
        if not role.task_types:
            self.validation_warnings.append(
                "Role has no task_types specified. Consider adding relevant task types."
            )
        
        # Check for reasonable context requirements
        if role.context_requirements and len(role.context_requirements) > 10:
            self.validation_warnings.append(
                "Role has many context requirements (>10). Consider consolidating."
            )
    
    def _is_valid_llm_identifier(self, llm_id: str) -> bool:
        """Check if LLM identifier has valid format."""
        parts = llm_id.split(':')
        
        # Local format: local:ollama:model
        if len(parts) >= 3 and parts[0] == 'local':
            return True
        
        # API format: provider:model
        if len(parts) == 2:
            return True
        
        # Single model names (common API models)
        if len(parts) == 1 and llm_id in [
            'claude-3-5-sonnet', 'claude-3-haiku', 'claude-3-opus',
            'gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'
        ]:
            return True
        
        return False
    
    def _check_llm_availability(self, role: Role) -> None:
        """Check availability of role's LLMs and suggest alternatives."""
        all_llms = [role.preferred_llm] + role.fallback_llms
        available_llms = []
        unavailable_llms = []
        
        for llm_id in all_llms:
            provider = self._check_single_llm_availability(llm_id)
            if provider.available:
                available_llms.append(llm_id)
            else:
                unavailable_llms.append((llm_id, provider.reason))
        
        if unavailable_llms:
            if not available_llms:
                self.validation_errors.append(
                    f"No available LLMs found for role '{role.name}'. "
                    f"Unavailable: {[llm for llm, _ in unavailable_llms]}"
                )
            else:
                self.validation_warnings.append(
                    f"Some LLMs unavailable for role '{role.name}': "
                    f"{[f'{llm} ({reason})' for llm, reason in unavailable_llms]}. "
                    f"Available: {available_llms}"
                )
    
    def _check_single_llm_availability(self, llm_id: str) -> LLMProvider:
        """Check if a single LLM is available."""
        parts = llm_id.split(':')
        
        if parts[0] == 'local':
            # Check local LLM (Ollama)
            if len(parts) >= 3 and parts[1] == 'ollama':
                return self._check_ollama_model(parts[2])
            else:
                return LLMProvider("local", llm_id, False, "Unknown local provider")
        
        elif parts[0] in ['claude', 'claude-3', 'claude-3-5']:
            # Check Claude availability (basic check)
            return LLMProvider("claude", parts[1] if len(parts) > 1 else "unknown", True, "API model")
        
        elif parts[0] in ['gpt', 'gpt-4', 'gpt-3.5']:
            # Check OpenAI availability (basic check)
            return LLMProvider("openai", parts[1] if len(parts) > 1 else "unknown", True, "API model")
        
        else:
            return LLMProvider(parts[0], parts[1] if len(parts) > 1 else "unknown", False, "Unknown provider")
    
    def _check_ollama_model(self, model_name: str) -> LLMProvider:
        """Check if an Ollama model is available locally."""
        try:
            # Try to list Ollama models
            result = subprocess.run(
                ['ollama', 'list'],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                # Check if model is in the list
                if model_name in result.stdout:
                    return LLMProvider("ollama", model_name, True, "Available locally")
                else:
                    return LLMProvider("ollama", model_name, False, "Model not installed")
            else:
                return LLMProvider("ollama", model_name, False, "Ollama command failed")
        
        except subprocess.TimeoutExpired:
            return LLMProvider("ollama", model_name, False, "Ollama command timeout")
        except FileNotFoundError:
            return LLMProvider("ollama", model_name, False, "Ollama not installed")
        except Exception as e:
            return LLMProvider("ollama", model_name, False, f"Error: {str(e)}")
    
    def suggest_llm_alternatives(self, role: Role) -> List[str]:
        """Suggest alternative LLMs for a role based on availability."""
        suggestions = []
        
        # Common alternatives by category
        if role.has_tool_group(ToolGroup.COMMAND):
            suggestions.extend([
                "local:ollama:codellama",
                "local:ollama:deepseek-coder", 
                "claude-3-5-sonnet",
                "gpt-4"
            ])
        
        if "research" in role.task_types:
            suggestions.extend([
                "claude-3-5-sonnet",
                "gpt-4",
                "local:ollama:llama3"
            ])
        
        if "review" in role.task_types or "quality" in role.tags:
            suggestions.extend([
                "claude-3-5-sonnet",
                "gpt-4",
                "local:ollama:llama3"
            ])
        
        # Remove duplicates and current LLMs
        current_llms = {role.preferred_llm} | set(role.fallback_llms)
        suggestions = [llm for llm in suggestions if llm not in current_llms]
        
        return list(dict.fromkeys(suggestions))  # Remove duplicates while preserving order
    
    def validate_all_roles(self, roles: Dict[str, Role]) -> Dict[str, Tuple[bool, List[str], List[str]]]:
        """Validate all roles and return results."""
        results = {}
        for name, role in roles.items():
            results[name] = self.validate_role(role)
        return results
    
    def get_system_llm_summary(self) -> Dict[str, Dict[str, str]]:
        """Get summary of system LLM availability."""
        summary = {
            "local": {},
            "api": {}
        }
        
        # Check common local models
        common_ollama_models = ["llama3", "codellama", "deepseek-coder", "mistral"]
        for model in common_ollama_models:
            provider = self._check_ollama_model(model)
            summary["local"][f"ollama:{model}"] = "✓" if provider.available else f"✗ {provider.reason}"
        
        # API models are assumed available (requires API keys)
        summary["api"]["claude-3-5-sonnet"] = "✓ (requires API key)"
        summary["api"]["gpt-4"] = "✓ (requires API key)"
        
        return summary