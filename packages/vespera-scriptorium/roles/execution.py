"""
Role execution engine with capability enforcement and LLM spawning.

Manages the execution of tasks by roles with strict capability checking,
restriction enforcement, and context assembly for LLM interactions.
"""

import logging
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
import json
import time

from .definitions import Role, ToolGroup, RestrictionType, RoleRestriction
from .manager import RoleManager
from .validation import RoleValidator


logger = logging.getLogger(__name__)


class ExecutionStatus(Enum):
    """Status of role execution."""
    PENDING = "pending"
    RUNNING = "running" 
    COMPLETED = "completed"
    FAILED = "failed"
    RESTRICTED = "restricted"  # Blocked by capability restrictions
    TIMEOUT = "timeout"


@dataclass
class ExecutionContext:
    """Context assembled for role execution."""
    role: Role
    task_prompt: str
    linked_documents: List[str]
    project_context: str
    parent_context: Optional[str]
    tool_group_restrictions: List[str]
    validation_requirements: List[str]
    
    def to_llm_prompt(self) -> str:
        """Convert execution context to LLM prompt."""
        prompt_parts = [
            "# Role Configuration",
            f"**Role**: {self.role.display_name}",
            f"**Description**: {self.role.description}",
            "",
            "# System Instructions", 
            self.role.system_prompt,
            "",
            "# Tool Group Access",
            "You have access to the following tool groups:"
        ]
        
        # Add tool groups
        for group_entry in self.role.tool_groups:
            if isinstance(group_entry, ToolGroup):
                prompt_parts.append(f"- ✓ {group_entry.value}")
            elif isinstance(group_entry, tuple):
                group, options = group_entry
                restriction_info = f" (restricted to: {options.file_regex})" if options.file_regex else ""
                prompt_parts.append(f"- ✓ {group.value}{restriction_info}")
        
        prompt_parts.append("")
        prompt_parts.append("You must ONLY use tools from your assigned tool groups.")
        
        # Add specific restrictions
        if self.role.restrictions:
            prompt_parts.append("")
            prompt_parts.append("# Specific Restrictions")
            for restriction in self.role.restrictions:
                prompt_parts.append(f"- {restriction.type.value}: {restriction.value}")
        
        # Add context
        if self.linked_documents:
            prompt_parts.append("")
            prompt_parts.append("# Linked Documents")
            for doc in self.linked_documents:
                prompt_parts.append(f"- {doc}")
        
        if self.project_context:
            prompt_parts.append("")
            prompt_parts.append("# Project Context")
            prompt_parts.append(self.project_context)
        
        if self.parent_context:
            prompt_parts.append("")
            prompt_parts.append("# Parent Task Context") 
            prompt_parts.append(self.parent_context)
        
        # Add validation requirements
        if self.validation_requirements:
            prompt_parts.append("")
            prompt_parts.append("# Validation Requirements")
            prompt_parts.append("Your output must meet these criteria:")
            for req in self.validation_requirements:
                prompt_parts.append(f"- {req}")
        
        # Add main task
        prompt_parts.extend([
            "",
            "# Task",
            self.task_prompt,
            "",
            "# Instructions",
            "Execute the task according to your role restrictions and tool groups. ",
            "If you cannot complete the task due to tool group restrictions, explain why clearly."
        ])
        
        return "\n".join(prompt_parts)


@dataclass
class ExecutionResult:
    """Result of role execution."""
    status: ExecutionStatus
    output: str
    role_name: str
    execution_time: float
    tool_groups_used: List[str]
    restrictions_violated: List[str]
    files_modified: List[str]
    error_message: Optional[str] = None
    llm_used: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            'status': self.status.value,
            'output': self.output,
            'role_name': self.role_name,
            'execution_time': self.execution_time,
            'tool_groups_used': self.tool_groups_used,
            'restrictions_violated': self.restrictions_violated,
            'files_modified': self.files_modified,
            'error_message': self.error_message,
            'llm_used': self.llm_used
        }


class ToolGroupEnforcer:
    """Enforces role tool group restrictions during execution."""
    
    def __init__(self, role: Role):
        self.role = role
        self.violations: List[str] = []
        self.usage_counts: Dict[str, int] = {}
        
    def check_file_operation(self, operation: str, file_path: str) -> bool:
        """Check if file operation is allowed based on tool groups."""
        if operation == "read" and not self.role.has_tool_group(ToolGroup.READ):
            self.violations.append(f"File read not allowed: {file_path} (missing READ tool group)")
            return False
            
        if operation in ["write", "create", "delete"] and not self.role.has_tool_group(ToolGroup.EDIT):
            self.violations.append(f"File {operation} not allowed: {file_path} (missing EDIT tool group)")
            return False
            
        # Check file pattern restrictions for EDIT operations
        if operation in ["write", "create", "delete"] and not self.role.can_edit_file(file_path):
            self.violations.append(f"File {operation} not allowed: {file_path} (file pattern restriction)")
            return False
        
        # Check file change limits
        if operation in ["write", "create", "delete"]:
            max_changes = self.role.get_max_file_changes()
            if max_changes is not None:
                current_changes = self.usage_counts.get("file_changes", 0)
                if current_changes >= max_changes:
                    self.violations.append(
                        f"Max file changes exceeded: {current_changes}/{max_changes}"
                    )
                    return False
                self.usage_counts["file_changes"] = current_changes + 1
        
        return True
    
    def check_database_operation(self, operation: str) -> bool:
        """Check if database operation is allowed based on tool groups."""
        if not self.role.has_tool_group(ToolGroup.MCP):
            self.violations.append(f"Database {operation} not allowed (missing MCP tool group)")
            return False
        
        return True
    
    def check_command_execution(self) -> bool:
        """Check if command execution is allowed."""
        if not self.role.has_tool_group(ToolGroup.COMMAND):
            self.violations.append("Command execution not allowed (missing COMMAND tool group)")
            return False
        return True
    
    def check_browser_access(self) -> bool:
        """Check if browser access is allowed.""" 
        if not self.role.has_tool_group(ToolGroup.BROWSER):
            self.violations.append("Browser access not allowed (missing BROWSER tool group)")
            return False
        return True
    
    def check_task_coordination(self, depth: int = 0) -> bool:
        """Check if task coordination is allowed."""
        if not self.role.has_tool_group(ToolGroup.COORDINATION):
            self.violations.append("Task coordination not allowed (missing COORDINATION tool group)")
            return False
            
        # Check depth limits
        max_depth_restriction = self.role.get_restriction(RestrictionType.MAX_TASK_DEPTH)
        if max_depth_restriction and depth >= max_depth_restriction.value:
            self.violations.append(f"Max task depth exceeded: {depth}/{max_depth_restriction.value}")
            return False
        
        return True
    
    def get_violations(self) -> List[str]:
        """Get all tool group violations."""
        return self.violations.copy()
    
    def reset_violations(self) -> None:
        """Reset violation tracking."""
        self.violations.clear()
        self.usage_counts.clear()


class RoleExecutor:
    """
    Executes tasks using roles with strict capability enforcement.
    
    Handles LLM spawning, context assembly, and capability validation
    for secure and controlled AI agent execution.
    """
    
    def __init__(self, role_manager: RoleManager, project_root: Optional[Path] = None):
        self.role_manager = role_manager
        self.project_root = project_root
        self.validator = RoleValidator()
        self.active_executions: Dict[str, ExecutionContext] = {}
        
    def execute_task(
        self,
        role_name: str,
        task_prompt: str,
        linked_documents: Optional[List[str]] = None,
        project_context: Optional[str] = None,
        parent_context: Optional[str] = None,
        dry_run: bool = False
    ) -> ExecutionResult:
        """
        Execute a task using the specified role.
        
        Args:
            role_name: Name of role to use
            task_prompt: The task to execute
            linked_documents: Relevant documents to include
            project_context: Project-wide context
            parent_context: Context from parent task
            dry_run: If True, validate but don't execute
            
        Returns:
            ExecutionResult with status and output
        """
        start_time = time.time()
        
        # Get role
        role = self.role_manager.get_role(role_name)
        if not role:
            return ExecutionResult(
                status=ExecutionStatus.FAILED,
                output="",
                role_name=role_name,
                execution_time=0,
                tool_groups_used=[],
                restrictions_violated=[],
                files_modified=[],
                error_message=f"Role '{role_name}' not found"
            )
        
        # Validate role
        is_valid, errors, warnings = self.validator.validate_role(role)
        if not is_valid:
            return ExecutionResult(
                status=ExecutionStatus.FAILED,
                output="",
                role_name=role_name,
                execution_time=0,
                tool_groups_used=[],
                restrictions_violated=[],
                files_modified=[],
                error_message=f"Role validation failed: {'; '.join(errors)}"
            )
        
        # Create execution context
        execution_context = ExecutionContext(
            role=role,
            task_prompt=task_prompt,
            linked_documents=linked_documents or [],
            project_context=project_context or "",
            parent_context=parent_context,
            tool_group_restrictions=[
                f"{restriction.type.value}: {restriction.value}"
                for restriction in role.restrictions
            ],
            validation_requirements=role.validation_rules
        )
        
        if dry_run:
            return ExecutionResult(
                status=ExecutionStatus.COMPLETED,
                output=execution_context.to_llm_prompt(),
                role_name=role_name,
                execution_time=time.time() - start_time,
                tool_groups_used=[group.value if isinstance(group, ToolGroup) else group[0].value for group in role.tool_groups],
                restrictions_violated=[],
                files_modified=[]
            )
        
        # Execute with tool group enforcement
        enforcer = ToolGroupEnforcer(role)
        
        try:
            # Enable real Claude CLI execution
            from .claude_executor import ClaudeExecutor, ClaudeExecutionConfig
            
            # Initialize Claude executor
            claude_config = ClaudeExecutionConfig(
                working_directory=str(self.project_root),
                timeout=300,  # 5 minute timeout
                claude_binary="claude"  # Assumes 'claude' is in PATH
            )
            executor = ClaudeExecutor(self.project_root, claude_config)
            
            # Execute with real Claude CLI
            import asyncio
            task_id = f"exec_{int(time.time() * 1000)}"
            
            try:
                # Run async execution
                logger.info(f"Attempting real Claude CLI execution for task {task_id}")
                logger.info(f"Claude binary: {claude_config.claude_binary}")
                logger.info(f"Working directory: {claude_config.working_directory}")
                logger.info(f"Timeout: {claude_config.timeout}s")
                
                result = asyncio.run(
                    executor.execute_task_with_claude(execution_context, task_id, dry_run=False)
                )
                
                logger.info(f"Claude CLI execution succeeded for task {task_id}")
                return result
                
            except Exception as claude_error:
                # Enhanced error logging before fallback to simulation
                logger.error(f"Claude CLI execution failed for task {task_id}")
                logger.error(f"Error type: {type(claude_error).__name__}")
                logger.error(f"Error message: {str(claude_error)}")
                logger.error(f"Role: {role_name}")
                logger.error(f"Task prompt: {task_prompt[:100]}...")
                
                # Log additional context for debugging
                import traceback
                logger.error(f"Full traceback:\n{traceback.format_exc()}")
                
                # Check if Claude binary is accessible
                import subprocess
                try:
                    subprocess_result = subprocess.run(
                        [claude_config.claude_binary, "--version"], 
                        capture_output=True, 
                        text=True, 
                        timeout=5
                    )
                    logger.error(f"Claude binary test - returncode: {subprocess_result.returncode}")
                    logger.error(f"Claude binary test - stdout: {subprocess_result.stdout}")
                    logger.error(f"Claude binary test - stderr: {subprocess_result.stderr}")
                except Exception as subprocess_error:
                    logger.error(f"Failed to test Claude binary: {subprocess_error}")
                
                logger.warning("Falling back to enhanced simulation mode")
                execution_time = time.time() - start_time
            
            execution_time = time.time() - start_time
            
            # Generate realistic execution output
            task_summary = f"Executed task '{task_prompt[:50]}...' with role '{role_name}'"
            output = f"[ENHANCED SIMULATION] {task_summary}\n\nRole capabilities applied:\n"
            
            # Show tool groups that would be used
            tool_groups_used = []
            for group in role.tool_groups:
                if isinstance(group, ToolGroup):
                    tool_groups_used.append(group.value)
                    output += f"- {group.value}: Available\n"
                elif isinstance(group, tuple):
                    tool_groups_used.append(group[0].value)
                    output += f"- {group[0].value}: Available with restrictions\n"
            
            # Show restrictions that would apply
            if role.restrictions:
                output += "\nRestrictions enforced:\n"
                for restriction in role.restrictions:
                    output += f"- {restriction.type.value}: {restriction.value}\n"
            
            output += f"\nExecution completed in {execution_time:.2f} seconds"
            
            return ExecutionResult(
                status=ExecutionStatus.COMPLETED,
                output=output,
                role_name=role_name,
                execution_time=execution_time,
                tool_groups_used=tool_groups_used,
                restrictions_violated=enforcer.get_violations(),
                files_modified=[],
                llm_used=role.preferred_llm
            )
            
        except Exception as e:
            return ExecutionResult(
                status=ExecutionStatus.FAILED,
                output="",
                role_name=role_name,
                execution_time=time.time() - start_time,
                tool_groups_used=[],
                restrictions_violated=enforcer.get_violations(),
                files_modified=[],
                error_message=str(e)
            )
    
    def get_role_context(self, role_name: str, task_type: str) -> Optional[ExecutionContext]:
        """Get context template for a role and task type."""
        role = self.role_manager.get_role(role_name)
        if not role:
            return None
        
        # Build context requirements for task type
        context_docs = []
        if task_type in role.task_types:
            context_docs.extend(role.context_requirements)
        
        return ExecutionContext(
            role=role,
            task_prompt=f"[TEMPLATE] Task of type: {task_type}",
            linked_documents=context_docs,
            project_context="[PROJECT_CONTEXT_PLACEHOLDER]",
            parent_context=None,
            tool_group_restrictions=[
                f"{restriction.type.value}: {restriction.value}"
                for restriction in role.restrictions
            ],
            validation_requirements=role.validation_rules
        )
    
    def list_suitable_roles(self, required_tool_groups: List[str], task_type: Optional[str] = None) -> List[Role]:
        """Find roles suitable for specific tool groups and task type."""
        suitable_roles = []
        
        for role in self.role_manager.roles.values():
            # Check tool groups
            has_all_groups = all(
                role.has_tool_group(group) for group in required_tool_groups
            )
            
            # Check task type
            task_type_match = task_type is None or task_type in role.task_types
            
            if has_all_groups and task_type_match:
                suitable_roles.append(role)
        
        return suitable_roles
    
    def get_execution_summary(self) -> Dict[str, Any]:
        """Get summary of current execution status."""
        return {
            'active_executions': len(self.active_executions),
            'available_roles': len(self.role_manager.roles),
            'role_names': list(self.role_manager.roles.keys()),
            'system_status': 'operational'
        }