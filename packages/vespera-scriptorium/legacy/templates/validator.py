"""
V2 Template Validator

Validates template configurations for security, correctness,
and compatibility with V2 system requirements.
"""

import re
from typing import List, Dict, Any, Set
import logging

from .models import TemplateConfig, TemplateValidationResult, TaskTemplate, RoleTemplate
from roles.definitions import ToolGroup
# Note: Will integrate with actual RoleManager when available

logger = logging.getLogger(__name__)


class TemplateValidator:
    """
    Validates V2 template configurations for:
    - Security (no malicious commands or file operations)
    - Structural correctness (valid dependencies, role assignments)
    - V2 system compatibility (valid roles, tool groups)
    """
    
    def __init__(self):
        # TODO: Integrate with actual RoleManager  
        self.role_manager = None
        
        # Security patterns to detect potentially dangerous content
        self.dangerous_patterns = [
            r'rm\s+-rf\s+/',  # Dangerous file deletion
            r'sudo\s+',       # Privilege escalation
            r'curl\s+.*\|\s*sh',  # Pipe to shell execution
            r'wget\s+.*\|\s*sh',  # Pipe to shell execution
            r'eval\s*\(',     # Code evaluation
            r'exec\s*\(',     # Code execution
            r'__import__',    # Dynamic imports
            r'subprocess\.call',  # Direct subprocess calls
            r'os\.system',    # OS command execution
            r'\.password',    # Potential credential access
            r'\.secret',      # Potential secret access
            r'\.token',       # Potential token access
        ]
        
    def validate_template(self, template_config: TemplateConfig) -> TemplateValidationResult:
        """
        Comprehensive template validation.
        
        Args:
            template_config: Template configuration to validate
            
        Returns:
            TemplateValidationResult with validation status and issues
        """
        result = TemplateValidationResult(valid=True)
        
        # Run all validation checks
        self._validate_basic_structure(template_config, result)
        self._validate_security(template_config, result)
        self._validate_roles(template_config, result)
        self._validate_dependencies(template_config, result)
        self._validate_variables(template_config, result)
        
        # Set overall validity
        result.valid = len(result.errors) == 0
        
        return result
    
    def _validate_basic_structure(self, config: TemplateConfig, result: TemplateValidationResult):
        """Validate basic template structure"""
        
        # Check required fields
        if not config.name:
            result.errors.append("Template name is required")
        
        if not config.description:
            result.warnings.append("Template description is recommended")
            
        if not config.root_task:
            result.errors.append("Root task is required")
            
        # Validate version format
        if config.version:
            if not re.match(r'^\d+\.\d+\.\d+', config.version):
                result.warnings.append("Version should follow semantic versioning (e.g., 1.0.0)")
        
        # Check for template ID uniqueness
        template_ids = set()
        if config.root_task:
            template_ids.add(config.root_task.template_id)
            
        for task in config.task_hierarchy:
            if task.template_id in template_ids:
                result.errors.append(f"Duplicate template ID: {task.template_id}")
            template_ids.add(task.template_id)
    
    def _validate_security(self, config: TemplateConfig, result: TemplateValidationResult):
        """Validate template for security issues"""
        
        # Check all task templates for dangerous patterns
        tasks_to_check = [config.root_task] + config.task_hierarchy
        
        for task in tasks_to_check:
            if task:
                self._check_text_for_security_issues(
                    task.title_template, 
                    f"Task {task.template_id} title",
                    result
                )
                self._check_text_for_security_issues(
                    task.description_template,
                    f"Task {task.template_id} description", 
                    result
                )
        
        # Check role definitions for unsafe file patterns
        for role in config.custom_roles:
            if role.file_pattern_restrictions:
                if '..' in role.file_pattern_restrictions:
                    result.errors.append(
                        f"Role {role.name} has unsafe file pattern (contains '..')"
                    )
    
    def _check_text_for_security_issues(self, text: str, context: str, result: TemplateValidationResult):
        """Check text for dangerous patterns"""
        if not text:
            return
            
        for pattern in self.dangerous_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                result.errors.append(
                    f"Potentially dangerous pattern found in {context}: {pattern}"
                )
    
    def _validate_roles(self, config: TemplateConfig, result: TemplateValidationResult):
        """Validate role assignments and definitions"""
        
        # Get available roles (built-in + custom) 
        # TODO: integrate with actual RoleManager
        available_roles = {
            "orchestrator", "researcher", "architect", "coder", 
            "tester", "reviewer", "debugger", "documenter",
            "creative_coordinator", "ask_mode"
        }
        for custom_role in config.custom_roles:
            available_roles.add(custom_role.name)
        
        # Check role assignments reference valid roles
        for template_id, role_name in config.role_assignments.items():
            if role_name not in available_roles:
                result.errors.append(
                    f"Unknown role '{role_name}' assigned to task {template_id}"
                )
        
        # Check task required_role references
        tasks_to_check = [config.root_task] + config.task_hierarchy
        for task in tasks_to_check:
            if task and task.required_role and task.required_role not in available_roles:
                result.errors.append(
                    f"Task {task.template_id} requires unknown role: {task.required_role}"
                )
        
        # Validate custom role definitions
        for role in config.custom_roles:
            self._validate_custom_role(role, result)
    
    def _validate_custom_role(self, role: RoleTemplate, result: TemplateValidationResult):
        """Validate a custom role definition"""
        
        # Check tool groups are valid
        valid_tool_groups = set(ToolGroup)
        for tool_group in role.required_tool_groups:
            if tool_group not in valid_tool_groups:
                result.errors.append(
                    f"Role {role.name} references invalid tool group: {tool_group}"
                )
        
        # Validate file pattern if present
        if role.file_pattern_restrictions:
            try:
                re.compile(role.file_pattern_restrictions)
            except re.error as e:
                result.errors.append(
                    f"Role {role.name} has invalid regex pattern: {e}"
                )
    
    def _validate_dependencies(self, config: TemplateConfig, result: TemplateValidationResult):
        """Validate task dependencies for cycles and references"""
        
        # Collect all template IDs
        all_template_ids = set()
        if config.root_task:
            all_template_ids.add(config.root_task.template_id)
        for task in config.task_hierarchy:
            all_template_ids.add(task.template_id)
        
        # Check dependency references
        for template_id, deps in config.dependencies.items():
            if template_id not in all_template_ids:
                result.errors.append(
                    f"Dependency references unknown task: {template_id}"
                )
            
            for dep_id in deps:
                if dep_id not in all_template_ids:
                    result.errors.append(
                        f"Dependency references unknown task: {dep_id}"
                    )
        
        # Check for circular dependencies
        circular_deps = self._detect_circular_dependencies(config.dependencies)
        for cycle in circular_deps:
            result.errors.append(
                f"Circular dependency detected: {' -> '.join(cycle)}"
            )
    
    def _detect_circular_dependencies(self, dependencies: Dict[str, List[str]]) -> List[List[str]]:
        """Detect circular dependencies using DFS"""
        
        def dfs(node, path, visited, rec_stack):
            visited.add(node)
            rec_stack.add(node)
            path.append(node)
            
            for neighbor in dependencies.get(node, []):
                if neighbor not in visited:
                    cycle = dfs(neighbor, path, visited, rec_stack)
                    if cycle:
                        return cycle
                elif neighbor in rec_stack:
                    # Found cycle
                    cycle_start = path.index(neighbor)
                    return path[cycle_start:] + [neighbor]
            
            path.pop()
            rec_stack.discard(node)
            return None
        
        cycles = []
        visited = set()
        
        for node in dependencies:
            if node not in visited:
                cycle = dfs(node, [], visited, set())
                if cycle:
                    cycles.append(cycle)
        
        return cycles
    
    def _validate_variables(self, config: TemplateConfig, result: TemplateValidationResult):
        """Validate template variables and usage"""
        
        # Collect all variables used in templates
        used_variables = set()
        
        # Check root task
        if config.root_task:
            used_variables.update(self._extract_variables(config.root_task.title_template))
            used_variables.update(self._extract_variables(config.root_task.description_template))
        
        # Check task hierarchy
        for task in config.task_hierarchy:
            used_variables.update(self._extract_variables(task.title_template))
            used_variables.update(self._extract_variables(task.description_template))
        
        # Check if all used variables are declared
        declared_variables = set(config.template_variables)
        
        undeclared = used_variables - declared_variables
        if undeclared:
            result.warnings.append(
                f"Variables used but not declared: {', '.join(undeclared)}"
            )
        
        unused = declared_variables - used_variables
        if unused:
            result.suggestions.append(
                f"Declared variables not used: {', '.join(unused)}"
            )
    
    def _extract_variables(self, template_string: str) -> Set[str]:
        """Extract Jinja2 variables from template string"""
        if not template_string:
            return set()
            
        # Simple regex to find {{ variable_name }}
        pattern = r'\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}'
        matches = re.findall(pattern, template_string)
        return set(matches)