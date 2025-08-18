"""
V2 Task Tree Generator

Converts template configurations into actual V2 task trees
using the MCP task management tools.
"""

from typing import Dict, List, Optional, Any
import logging
from jinja2 import Environment, Template

from .models import TemplateConfig, TemplateInstantiationResult, TaskTemplate
from tasks.models import Task, TaskPriority, TaskStatus
# Note: Will integrate with actual TaskManager and RoleManager when available

logger = logging.getLogger(__name__)


class TaskTreeGenerator:
    """
    Generates V2 task trees from template configurations.
    
    Handles:
    - Variable substitution in task titles/descriptions
    - Hierarchical task creation with proper parent-child relationships
    - Dependency management
    - Role assignment with capability validation
    """
    
    def __init__(self):
        self.jinja_env = Environment()
        # TODO: Integrate with actual TaskManager and RoleManager
        self.task_manager = None
        self.role_manager = None
        
    def create_hierarchical_tasks(
        self,
        template_config: TemplateConfig,
        variables: Dict[str, Any],
        project_id: Optional[str] = None
    ) -> TemplateInstantiationResult:
        """
        Create complete task tree from template configuration.
        
        Args:
            template_config: Parsed template configuration
            variables: User-provided template variables
            project_id: Project ID for task grouping
            
        Returns:
            TemplateInstantiationResult with created task details
        """
        result = TemplateInstantiationResult(success=True)
        
        try:
            # Step 1: Create root task
            root_task_id = self._create_task_from_template(
                template_config.root_task,
                variables,
                project_id,
                parent_id=None
            )
            
            if not root_task_id:
                return TemplateInstantiationResult(
                    success=False,
                    errors=["Failed to create root task"]
                )
                
            result.root_task_id = root_task_id
            result.created_task_ids.append(root_task_id)
            
            # Step 2: Create child tasks
            task_id_mapping = {template_config.root_task.template_id: root_task_id}
            
            for task_template in template_config.task_hierarchy:
                # Determine parent task ID
                parent_id = root_task_id  # Default to root
                
                # Check if this task has a specific parent in the hierarchy
                for template_id, deps in template_config.dependencies.items():
                    if task_template.template_id in deps:
                        if template_id in task_id_mapping:
                            parent_id = task_id_mapping[template_id]
                        break
                
                # Create the task
                task_id = self._create_task_from_template(
                    task_template,
                    variables,
                    project_id,
                    parent_id
                )
                
                if task_id:
                    task_id_mapping[task_template.template_id] = task_id
                    result.created_task_ids.append(task_id)
                else:
                    result.warnings.append(f"Failed to create task: {task_template.template_id}")
            
            # Step 3: Apply dependencies
            dependency_results = self._apply_dependencies(
                template_config.dependencies,
                task_id_mapping
            )
            result.created_dependencies.extend(dependency_results)
            
            # Step 4: Apply role assignments
            role_results = self._apply_role_assignments(
                template_config.role_assignments,
                task_id_mapping
            )
            result.role_assignments.update(role_results)
            
            logger.info(f"Successfully created task tree with {len(result.created_task_ids)} tasks")
            
        except Exception as e:
            logger.error(f"Task tree generation failed: {e}")
            result.success = False
            result.errors.append(f"Task tree generation failed: {str(e)}")
            
        return result
    
    def _create_task_from_template(
        self,
        task_template: TaskTemplate,
        variables: Dict[str, Any],
        project_id: Optional[str],
        parent_id: Optional[str]
    ) -> Optional[str]:
        """Create a single task from template with variable substitution"""
        
        try:
            # Substitute variables in title and description
            title = self._substitute_variables(task_template.title_template, variables)
            description = self._substitute_variables(task_template.description_template, variables)
            
            # For now, simulate task creation (TODO: integrate with actual MCP tools)
            import uuid
            task_id = str(uuid.uuid4())[:8]
            
            logger.info(f"[MOCK] Created task {task_id}: {title}")
            logger.info(f"  Description: {description}")
            logger.info(f"  Priority: {task_template.priority}")
            logger.info(f"  Parent: {parent_id}")
            logger.info(f"  Project: {project_id}")
            
            return task_id
                
        except Exception as e:
            logger.error(f"Error creating task from template {task_template.template_id}: {e}")
            return None
    
    def _substitute_variables(self, template_string: str, variables: Dict[str, Any]) -> str:
        """Substitute Jinja2 variables in template string"""
        try:
            template = self.jinja_env.from_string(template_string)
            return template.render(**variables)
        except Exception as e:
            logger.warning(f"Variable substitution failed for '{template_string}': {e}")
            return template_string  # Return original if substitution fails
    
    def _apply_dependencies(
        self,
        dependencies: Dict[str, List[str]],
        task_id_mapping: Dict[str, str]
    ) -> List[Dict[str, str]]:
        """Apply task dependencies using the task manager"""
        
        dependency_results = []
        
        for template_id, dep_template_ids in dependencies.items():
            if template_id not in task_id_mapping:
                logger.warning(f"Unknown task template ID: {template_id}")
                continue
                
            task_id = task_id_mapping[template_id]
            
            for dep_template_id in dep_template_ids:
                if dep_template_id not in task_id_mapping:
                    logger.warning(f"Unknown dependency template ID: {dep_template_id}")
                    continue
                    
                dep_task_id = task_id_mapping[dep_template_id]
                
                try:
                    # Mock dependency creation (TODO: integrate with actual MCP tools)
                    logger.info(f"[MOCK] Added dependency: {task_id} depends on {dep_task_id}")
                    dependency_results.append({
                        "task_id": task_id,
                        "depends_on": dep_task_id,
                        "status": "created"
                    })
                        
                except Exception as e:
                    logger.error(f"Error adding dependency {task_id} -> {dep_task_id}: {e}")
        
        return dependency_results
    
    def _apply_role_assignments(
        self,
        role_assignments: Dict[str, str],
        task_id_mapping: Dict[str, str]
    ) -> Dict[str, str]:
        """Apply role assignments to tasks"""
        
        successful_assignments = {}
        
        for template_id, role_name in role_assignments.items():
            if template_id not in task_id_mapping:
                logger.warning(f"Unknown task template ID for role assignment: {template_id}")
                continue
                
            task_id = task_id_mapping[template_id]
            
            try:
                # Mock role assignment (TODO: integrate with actual MCP tools)
                logger.info(f"[MOCK] Assigned role '{role_name}' to task {task_id}")
                successful_assignments[task_id] = role_name
                    
            except Exception as e:
                logger.error(f"Error assigning role '{role_name}' to task {task_id}: {e}")
        
        return successful_assignments
    
    def preview_task_tree(
        self,
        template_config: TemplateConfig,
        variables: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate preview of task tree without creating actual tasks"""
        
        preview = {
            "root_task": self._preview_task(template_config.root_task, variables),
            "child_tasks": [],
            "dependencies": template_config.dependencies,
            "role_assignments": template_config.role_assignments
        }
        
        for task_template in template_config.task_hierarchy:
            preview["child_tasks"].append(
                self._preview_task(task_template, variables)
            )
        
        return preview
    
    def _preview_task(self, task_template: TaskTemplate, variables: Dict[str, Any]) -> Dict[str, Any]:
        """Generate preview of a single task"""
        return {
            "template_id": task_template.template_id,
            "title": self._substitute_variables(task_template.title_template, variables),
            "description": self._substitute_variables(task_template.description_template, variables),
            "priority": task_template.priority.value,
            "required_role": task_template.required_role,
            "estimated_effort": task_template.estimated_effort
        }