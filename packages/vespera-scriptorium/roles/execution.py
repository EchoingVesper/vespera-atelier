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

from .definitions import Role, CapabilityType, RestrictionType, RoleCapability, RoleRestriction
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
    capability_restrictions: List[str]
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
            "# Capability Restrictions",
            "You are restricted to the following capabilities:"
        ]
        
        # Add capabilities
        for cap in self.role.capabilities:
            prompt_parts.append(f"- ✓ {cap.type.value}")
        
        prompt_parts.append("")
        prompt_parts.append("You must NOT perform actions outside these capabilities.")
        
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
            "Execute the task according to your role restrictions and capabilities. ",
            "If you cannot complete the task due to capability restrictions, explain why clearly."
        ])
        
        return "\n".join(prompt_parts)


@dataclass
class ExecutionResult:
    """Result of role execution."""
    status: ExecutionStatus
    output: str
    role_name: str
    execution_time: float
    capabilities_used: List[str]
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
            'capabilities_used': self.capabilities_used,
            'restrictions_violated': self.restrictions_violated,
            'files_modified': self.files_modified,
            'error_message': self.error_message,
            'llm_used': self.llm_used
        }


class CapabilityEnforcer:
    """Enforces role capability restrictions during execution."""
    
    def __init__(self, role: Role):
        self.role = role
        self.violations: List[str] = []
        self.usage_counts: Dict[str, int] = {}
        
    def check_file_operation(self, operation: str, file_path: str) -> bool:
        """Check if file operation is allowed."""
        if operation == "read" and not self.role.has_capability(CapabilityType.FILE_READ):
            self.violations.append(f"File read not allowed: {file_path}")
            return False
            
        if operation == "write" and not self.role.has_capability(CapabilityType.FILE_WRITE):
            self.violations.append(f"File write not allowed: {file_path}")
            return False
            
        if operation == "create" and not self.role.has_capability(CapabilityType.FILE_CREATE):
            self.violations.append(f"File create not allowed: {file_path}")
            return False
            
        if operation == "delete" and not self.role.has_capability(CapabilityType.FILE_DELETE):
            self.violations.append(f"File delete not allowed: {file_path}")
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
        """Check if database operation is allowed."""
        if operation == "read" and not self.role.has_capability(CapabilityType.DATABASE_READ):
            self.violations.append("Database read not allowed")
            return False
            
        if operation == "write" and not self.role.has_capability(CapabilityType.DATABASE_WRITE):
            self.violations.append("Database write not allowed")
            return False
            
        # Check read-only restriction
        if operation == "write" and self.role.is_restricted(RestrictionType.READ_ONLY_DATABASE):
            self.violations.append("Database is read-only for this role")
            return False
        
        return True
    
    def check_code_execution(self) -> bool:
        """Check if code execution is allowed."""
        if not self.role.has_capability(CapabilityType.CODE_EXECUTION):
            self.violations.append("Code execution not allowed")
            return False
        return True
    
    def check_network_access(self) -> bool:
        """Check if network access is allowed.""" 
        if not self.role.has_capability(CapabilityType.NETWORK_ACCESS):
            self.violations.append("Network access not allowed")
            return False
        return True
    
    def check_task_spawning(self, depth: int = 0) -> bool:
        """Check if task spawning is allowed."""
        if not self.role.has_capability(CapabilityType.SPAWN_TASKS):
            self.violations.append("Task spawning not allowed")
            return False
            
        # Check depth limits
        max_depth_restriction = self.role.get_restriction(RestrictionType.MAX_TASK_DEPTH)
        if max_depth_restriction and depth >= max_depth_restriction.value:
            self.violations.append(f"Max task depth exceeded: {depth}/{max_depth_restriction.value}")
            return False
        
        return True
    
    def get_violations(self) -> List[str]:
        """Get all capability violations."""
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
                capabilities_used=[],
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
                capabilities_used=[],
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
            capability_restrictions=[
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
                capabilities_used=[cap.type.value for cap in role.capabilities],
                restrictions_violated=[],
                files_modified=[]
            )
        
        # Execute with capability enforcement
        enforcer = CapabilityEnforcer(role)
        
        try:
            # This is where we would spawn the actual LLM
            # For now, return a simulation
            execution_time = time.time() - start_time
            
            return ExecutionResult(
                status=ExecutionStatus.COMPLETED,
                output="[SIMULATION] Task would be executed with role capabilities",
                role_name=role_name,
                execution_time=execution_time,
                capabilities_used=[cap.type.value for cap in role.capabilities],
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
                capabilities_used=[],
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
            capability_restrictions=[
                f"{restriction.type.value}: {restriction.value}"
                for restriction in role.restrictions
            ],
            validation_requirements=role.validation_rules
        )
    
    def list_suitable_roles(self, required_capabilities: List[str], task_type: Optional[str] = None) -> List[Role]:
        """Find roles suitable for specific capabilities and task type."""
        suitable_roles = []
        
        for role in self.role_manager.roles.values():
            # Check capabilities
            has_all_capabilities = all(
                role.has_capability(cap) for cap in required_capabilities
            )
            
            # Check task type
            task_type_match = task_type is None or task_type in role.task_types
            
            if has_all_capabilities and task_type_match:
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