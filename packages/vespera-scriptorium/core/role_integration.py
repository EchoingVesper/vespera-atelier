"""
Integration layer between the role system and orchestrator.

Provides orchestrator-compatible interface for role-based task execution
while maintaining the capability restrictions and validation from the role system.
"""

import logging
from typing import Dict, List, Optional, Any, Union
from pathlib import Path
from dataclasses import dataclass

from ..roles import RoleManager, RoleValidator, RoleExecutor, Role
from ..roles.execution import ExecutionResult, ExecutionStatus


logger = logging.getLogger(__name__)


@dataclass
class OrchestrationTask:
    """
    Task representation for orchestrator integration.
    
    Maps to orchestrator task structure while preserving role system capabilities.
    """
    task_id: str
    title: str
    description: str
    assigned_role: Optional[str] = None
    required_capabilities: List[str] = None
    context_documents: List[str] = None
    parent_task_id: Optional[str] = None
    status: str = "pending"
    
    def __post_init__(self):
        if self.required_capabilities is None:
            self.required_capabilities = []
        if self.context_documents is None:
            self.context_documents = []


class RoleOrchestrator:
    """
    Integration layer that connects the V2 role system with orchestrator functionality.
    
    Provides orchestrator-compatible methods while leveraging the new role system
    for capability-based task execution and LLM management.
    """
    
    def __init__(self, project_root: Optional[Path] = None):
        self.project_root = project_root or Path.cwd()
        
        # Initialize role system components
        self.role_manager = RoleManager(project_root=self.project_root)
        self.role_executor = RoleExecutor(self.role_manager, project_root=self.project_root)
        self.validator = RoleValidator()
        
        # Track active tasks
        self.active_tasks: Dict[str, OrchestrationTask] = {}
        self.task_results: Dict[str, ExecutionResult] = {}
        
        logger.info(f"Role orchestrator initialized with {len(self.role_manager.roles)} roles")
    
    def assign_role_to_task(
        self,
        task_id: str,
        task_description: str,
        required_capabilities: Optional[List[str]] = None,
        preferred_role: Optional[str] = None,
        task_type: Optional[str] = None
    ) -> Optional[str]:
        """
        Assign an appropriate role to a task based on requirements.
        
        Args:
            task_id: Unique task identifier
            task_description: Description of the task
            required_capabilities: List of required capabilities
            preferred_role: Preferred role name (if specified)
            task_type: Type of task (e.g., 'implementation', 'research')
            
        Returns:
            Assigned role name or None if no suitable role found
        """
        # If preferred role specified, validate it
        if preferred_role:
            role = self.role_manager.get_role(preferred_role)
            if role and self._validate_role_for_task(role, required_capabilities or []):
                logger.info(f"Assigned preferred role '{preferred_role}' to task {task_id}")
                return preferred_role
            else:
                logger.warning(f"Preferred role '{preferred_role}' not suitable for task {task_id}")
        
        # Find suitable roles automatically
        suitable_roles = self.role_executor.list_suitable_roles(
            required_capabilities or [],
            task_type
        )
        
        if not suitable_roles:
            logger.error(f"No suitable roles found for task {task_id} with capabilities: {required_capabilities}")
            return None
        
        # Select best role (prioritize by capability match and restrictions)
        best_role = self._select_best_role(suitable_roles, required_capabilities or [], task_type)
        
        if best_role:
            logger.info(f"Auto-assigned role '{best_role.name}' to task {task_id}")
            return best_role.name
        
        return None
    
    def execute_task_with_role(
        self,
        task_id: str,
        role_name: str,
        task_prompt: str,
        context_documents: Optional[List[str]] = None,
        parent_context: Optional[str] = None,
        dry_run: bool = False
    ) -> ExecutionResult:
        """
        Execute a task using a specific role.
        
        Args:
            task_id: Task identifier
            role_name: Role to use for execution
            task_prompt: Task description/prompt
            context_documents: Relevant documents
            parent_context: Context from parent task
            dry_run: If True, validate but don't execute
            
        Returns:
            ExecutionResult with status and output
        """
        # Get project context
        project_context = self._build_project_context()
        
        # Execute task
        result = self.role_executor.execute_task(
            role_name=role_name,
            task_prompt=task_prompt,
            linked_documents=context_documents,
            project_context=project_context,
            parent_context=parent_context,
            dry_run=dry_run
        )
        
        # Store result
        self.task_results[task_id] = result
        
        # Update task status based on result
        if task_id in self.active_tasks:
            task = self.active_tasks[task_id]
            if result.status == ExecutionStatus.COMPLETED:
                task.status = "completed"
            elif result.status == ExecutionStatus.FAILED:
                task.status = "failed"
            elif result.status == ExecutionStatus.RESTRICTED:
                task.status = "blocked"
        
        return result
    
    def create_orchestration_task(
        self,
        title: str,
        description: str,
        required_capabilities: Optional[List[str]] = None,
        preferred_role: Optional[str] = None,
        context_documents: Optional[List[str]] = None,
        parent_task_id: Optional[str] = None
    ) -> OrchestrationTask:
        """Create a new orchestration task."""
        import uuid
        task_id = str(uuid.uuid4())[:8]
        
        task = OrchestrationTask(
            task_id=task_id,
            title=title,
            description=description,
            required_capabilities=required_capabilities or [],
            context_documents=context_documents or [],
            parent_task_id=parent_task_id
        )
        
        # Assign role
        assigned_role = self.assign_role_to_task(
            task_id=task_id,
            task_description=description,
            required_capabilities=required_capabilities,
            preferred_role=preferred_role
        )
        
        task.assigned_role = assigned_role
        self.active_tasks[task_id] = task
        
        return task
    
    def get_role_capabilities_summary(self) -> Dict[str, Dict[str, Any]]:
        """Get summary of all role capabilities for orchestrator planning."""
        summary = {}
        for name, role in self.role_manager.roles.items():
            summary[name] = {
                'display_name': role.display_name,
                'description': role.description,
                'capabilities': [cap.type.value for cap in role.capabilities],
                'restrictions': [
                    f"{rest.type.value}: {rest.value}" 
                    for rest in role.restrictions
                ],
                'task_types': role.task_types,
                'preferred_llm': role.preferred_llm,
                'max_file_changes': role.get_max_file_changes()
            }
        return summary
    
    def validate_role_assignment(self, role_name: str, task_requirements: Dict[str, Any]) -> bool:
        """Validate that a role can handle specific task requirements."""
        role = self.role_manager.get_role(role_name)
        if not role:
            return False
        
        # Check required capabilities
        required_caps = task_requirements.get('capabilities', [])
        if not self._validate_role_for_task(role, required_caps):
            return False
        
        # Check task type compatibility
        task_type = task_requirements.get('task_type')
        if task_type and task_type not in role.task_types:
            return False
        
        # Validate role itself
        is_valid, errors, warnings = self.validator.validate_role(role)
        return is_valid
    
    def get_orchestrator_integration_status(self) -> Dict[str, Any]:
        """Get status for orchestrator integration."""
        return {
            'roles_loaded': len(self.role_manager.roles),
            'active_tasks': len(self.active_tasks),
            'completed_tasks': len([t for t in self.active_tasks.values() if t.status == 'completed']),
            'failed_tasks': len([t for t in self.active_tasks.values() if t.status == 'failed']),
            'available_role_names': list(self.role_manager.roles.keys()),
            'system_status': 'operational'
        }
    
    def _validate_role_for_task(self, role: Role, required_capabilities: List[str]) -> bool:
        """Validate that a role has all required capabilities."""
        for cap in required_capabilities:
            if not role.has_capability(cap):
                return False
        return True
    
    def _select_best_role(
        self,
        suitable_roles: List[Role],
        required_capabilities: List[str],
        task_type: Optional[str] = None
    ) -> Optional[Role]:
        """Select the best role from suitable candidates."""
        if not suitable_roles:
            return None
        
        # Score roles based on fit
        scored_roles = []
        for role in suitable_roles:
            score = 0
            
            # Higher score for exact capability match
            role_caps = [cap.type.value for cap in role.capabilities]
            capability_overlap = len(set(required_capabilities) & set(role_caps))
            score += capability_overlap * 10
            
            # Higher score for task type match
            if task_type and task_type in role.task_types:
                score += 20
            
            # Lower score for more restrictions (prefer less restricted roles for complex tasks)
            score -= len(role.restrictions) * 2
            
            # Prefer roles with fewer total capabilities (more specialized)
            score -= len(role.capabilities)
            
            scored_roles.append((score, role))
        
        # Return highest scoring role
        scored_roles.sort(key=lambda x: x[0], reverse=True)
        return scored_roles[0][1]
    
    def _build_project_context(self) -> str:
        """Build project context string."""
        context_parts = [
            f"Project Root: {self.project_root}",
            f"Available Roles: {', '.join(self.role_manager.list_roles())}",
            "Architecture: Vespera Scriptorium V2 with Clean Architecture",
            "Role System: Roo Code-inspired capability restrictions"
        ]
        return "\n".join(context_parts)