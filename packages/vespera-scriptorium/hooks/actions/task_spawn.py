"""
Task Spawn Hook Actions

Creates new tasks in the Vespera task management system when triggered.
"""

import asyncio
import logging
from typing import Dict, Any, List, Optional
from enum import Enum

from .base import HookAction
from ..core.models import HookActionConfig, HookContext

logger = logging.getLogger(__name__)


class TaskSpawnStrategy(Enum):
    """Strategies for spawning new tasks"""
    SINGLE = "single"  # Create a single task
    BREAKDOWN = "breakdown"  # Break down into subtasks
    PARALLEL = "parallel"  # Create parallel tasks
    SEQUENTIAL = "sequential"  # Create sequential dependent tasks
    CONDITIONAL = "conditional"  # Create tasks based on conditions


class TaskPriority(Enum):
    """Task priority levels"""
    CRITICAL = "critical"
    HIGH = "high"
    NORMAL = "normal"
    LOW = "low"


class TaskSpawnAction(HookAction):
    """
    Spawns new tasks in the Vespera task management system.
    
    Used for:
    - Breaking down complex operations into manageable tasks
    - Creating follow-up tasks based on trigger conditions
    - Orchestrating multi-step workflows
    - Handling error recovery through task creation
    """
    
    def __init__(self):
        # Task spawn templates for common patterns
        self.spawn_templates = {
            # Error handling tasks
            "error_investigation": {
                "title_template": "Investigate error: {error_type}",
                "description_template": "Investigate and resolve error in {file_path}: {error_message}",
                "suggested_role": "developer",
                "priority": TaskPriority.HIGH,
                "subtasks": [
                    {"title": "Analyze error logs", "role": "developer"},
                    {"title": "Identify root cause", "role": "developer"},
                    {"title": "Implement fix", "role": "developer"},
                    {"title": "Test fix", "role": "tester"}
                ]
            },
            
            # File change handling
            "file_change_review": {
                "title_template": "Review changes to {filename}",
                "description_template": "Review and validate changes made to {file_path}",
                "suggested_role": "code_reviewer",
                "priority": TaskPriority.NORMAL,
                "subtasks": [
                    {"title": "Code review", "role": "code_reviewer"},
                    {"title": "Run tests", "role": "tester"},
                    {"title": "Update documentation", "role": "technical_writer"}
                ]
            },
            
            # Security tasks
            "security_audit": {
                "title_template": "Security audit: {audit_scope}",
                "description_template": "Perform security audit of {audit_scope}",
                "suggested_role": "security_auditor",
                "priority": TaskPriority.HIGH,
                "subtasks": [
                    {"title": "Vulnerability scan", "role": "security_auditor"},
                    {"title": "Code security review", "role": "security_auditor"},
                    {"title": "Dependency audit", "role": "security_auditor"},
                    {"title": "Generate security report", "role": "technical_writer"}
                ]
            },
            
            # Performance optimization
            "performance_optimization": {
                "title_template": "Optimize performance: {component}",
                "description_template": "Analyze and optimize performance of {component}",
                "suggested_role": "performance_engineer",
                "priority": TaskPriority.NORMAL,
                "subtasks": [
                    {"title": "Performance profiling", "role": "performance_engineer"},
                    {"title": "Identify bottlenecks", "role": "performance_engineer"},
                    {"title": "Implement optimizations", "role": "developer"},
                    {"title": "Benchmark improvements", "role": "performance_engineer"}
                ]
            },
            
            # Documentation tasks
            "documentation_update": {
                "title_template": "Update documentation: {doc_type}",
                "description_template": "Update {doc_type} documentation based on recent changes",
                "suggested_role": "technical_writer",
                "priority": TaskPriority.LOW,
                "subtasks": [
                    {"title": "Review code changes", "role": "technical_writer"},
                    {"title": "Update API documentation", "role": "technical_writer"},
                    {"title": "Update user guides", "role": "technical_writer"},
                    {"title": "Review and publish", "role": "technical_writer"}
                ]
            }
        }
    
    async def execute(self, config: HookActionConfig, context: HookContext) -> Dict[str, Any]:
        """Execute task spawning action"""
        if not await self.pre_execute(config, context):
            return {"success": False, "error": "Pre-execution failed"}
        
        try:
            parameters = self._extract_parameters(config)
            spawn_strategy = TaskSpawnStrategy(config.implementation)
            
            # Generate task specifications
            task_specs = await self._generate_task_specs(spawn_strategy, parameters, context)
            
            # Spawn tasks (mock implementation - would integrate with actual task system)
            spawned_tasks = await self._spawn_tasks(task_specs, parameters, context)
            
            result = {
                "success": True,
                "spawn_strategy": spawn_strategy.value,
                "tasks_created": len(spawned_tasks),
                "task_ids": [task["id"] for task in spawned_tasks],
                "tasks": spawned_tasks,
                "message": f"Successfully spawned {len(spawned_tasks)} tasks using {spawn_strategy.value} strategy"
            }
            
            await self.post_execute(config, context, result)
            return result
            
        except Exception as e:
            error_result = {"success": False, "error": str(e)}
            await self.post_execute(config, context, error_result)
            return error_result
    
    def validate_config(self, config: HookActionConfig) -> tuple[bool, list[str]]:
        """Validate task spawn action configuration"""
        errors = []
        
        if not config.implementation:
            errors.append("Spawn strategy is required for task spawn actions")
            return False, errors
        
        # Validate spawn strategy
        try:
            spawn_strategy = TaskSpawnStrategy(config.implementation)
        except ValueError:
            valid_strategies = [s.value for s in TaskSpawnStrategy]
            errors.append(f"Invalid spawn strategy '{config.implementation}'. Valid strategies: {valid_strategies}")
            return False, errors
        
        # Validate parameters based on strategy
        parameters = config.parameters or {}
        
        if spawn_strategy == TaskSpawnStrategy.BREAKDOWN:
            if not parameters.get("breakdown_template"):
                errors.append("BREAKDOWN strategy requires 'breakdown_template' parameter")
        
        elif spawn_strategy == TaskSpawnStrategy.CONDITIONAL:
            if not parameters.get("conditions"):
                errors.append("CONDITIONAL strategy requires 'conditions' parameter")
        
        elif spawn_strategy == TaskSpawnStrategy.SEQUENTIAL:
            if not parameters.get("task_sequence"):
                errors.append("SEQUENTIAL strategy requires 'task_sequence' parameter")
        
        elif spawn_strategy == TaskSpawnStrategy.PARALLEL:
            if not parameters.get("parallel_tasks"):
                errors.append("PARALLEL strategy requires 'parallel_tasks' parameter")
        
        return len(errors) == 0, errors
    
    async def _generate_task_specs(self, spawn_strategy: TaskSpawnStrategy, 
                                 parameters: Dict[str, Any], 
                                 context: HookContext) -> List[Dict[str, Any]]:
        """Generate task specifications based on strategy and context"""
        
        if spawn_strategy == TaskSpawnStrategy.SINGLE:
            return await self._generate_single_task(parameters, context)
        
        elif spawn_strategy == TaskSpawnStrategy.BREAKDOWN:
            return await self._generate_breakdown_tasks(parameters, context)
        
        elif spawn_strategy == TaskSpawnStrategy.PARALLEL:
            return await self._generate_parallel_tasks(parameters, context)
        
        elif spawn_strategy == TaskSpawnStrategy.SEQUENTIAL:
            return await self._generate_sequential_tasks(parameters, context)
        
        elif spawn_strategy == TaskSpawnStrategy.CONDITIONAL:
            return await self._generate_conditional_tasks(parameters, context)
        
        else:
            raise ValueError(f"Unsupported spawn strategy: {spawn_strategy}")
    
    async def _generate_single_task(self, parameters: Dict[str, Any], 
                                  context: HookContext) -> List[Dict[str, Any]]:
        """Generate a single task based on context"""
        template_name = parameters.get("template", "file_change_review")
        task_spec = await self._apply_template(template_name, parameters, context)
        return [task_spec]
    
    async def _generate_breakdown_tasks(self, parameters: Dict[str, Any], 
                                      context: HookContext) -> List[Dict[str, Any]]:
        """Generate breakdown tasks from a template"""
        template_name = parameters.get("breakdown_template", "error_investigation")
        template = self.spawn_templates.get(template_name, {})
        
        # Create parent task
        parent_task = await self._apply_template(template_name, parameters, context)
        tasks = [parent_task]
        
        # Create subtasks
        subtasks = template.get("subtasks", [])
        for i, subtask_template in enumerate(subtasks):
            subtask = {
                "id": f"{parent_task['id']}_subtask_{i+1}",
                "title": subtask_template.get("title", f"Subtask {i+1}"),
                "description": f"Subtask of: {parent_task['title']}",
                "role": subtask_template.get("role", "developer"),
                "priority": TaskPriority.NORMAL.value,
                "parent_id": parent_task["id"],
                "depends_on": [parent_task["id"]] if i == 0 else [f"{parent_task['id']}_subtask_{i}"],
                "context": self._build_task_context(context),
                "type": "subtask"
            }
            tasks.append(subtask)
        
        return tasks
    
    async def _generate_parallel_tasks(self, parameters: Dict[str, Any], 
                                     context: HookContext) -> List[Dict[str, Any]]:
        """Generate parallel independent tasks"""
        parallel_specs = parameters.get("parallel_tasks", [])
        tasks = []
        
        for i, spec in enumerate(parallel_specs):
            task = {
                "id": f"parallel_task_{i+1}_{context.timestamp.strftime('%Y%m%d_%H%M%S') if context.timestamp else 'unknown'}",
                "title": spec.get("title", f"Parallel Task {i+1}"),
                "description": spec.get("description", "Parallel task execution"),
                "role": spec.get("role", "developer"),
                "priority": spec.get("priority", TaskPriority.NORMAL.value),
                "context": self._build_task_context(context),
                "type": "parallel"
            }
            tasks.append(task)
        
        return tasks
    
    async def _generate_sequential_tasks(self, parameters: Dict[str, Any], 
                                       context: HookContext) -> List[Dict[str, Any]]:
        """Generate sequential dependent tasks"""
        sequence_specs = parameters.get("task_sequence", [])
        tasks = []
        previous_task_id = None
        
        for i, spec in enumerate(sequence_specs):
            task_id = f"sequential_task_{i+1}_{context.timestamp.strftime('%Y%m%d_%H%M%S') if context.timestamp else 'unknown'}"
            task = {
                "id": task_id,
                "title": spec.get("title", f"Sequential Task {i+1}"),
                "description": spec.get("description", "Sequential task execution"),
                "role": spec.get("role", "developer"),
                "priority": spec.get("priority", TaskPriority.NORMAL.value),
                "depends_on": [previous_task_id] if previous_task_id else [],
                "context": self._build_task_context(context),
                "type": "sequential"
            }
            tasks.append(task)
            previous_task_id = task_id
        
        return tasks
    
    async def _generate_conditional_tasks(self, parameters: Dict[str, Any], 
                                        context: HookContext) -> List[Dict[str, Any]]:
        """Generate tasks based on conditions"""
        conditions = parameters.get("conditions", {})
        tasks = []
        
        # Evaluate conditions based on context
        for condition_name, condition_spec in conditions.items():
            if await self._evaluate_condition(condition_spec, context):
                task_specs = condition_spec.get("tasks", [])
                for spec in task_specs:
                    task = {
                        "id": f"conditional_{condition_name}_{len(tasks)+1}_{context.timestamp.strftime('%Y%m%d_%H%M%S') if context.timestamp else 'unknown'}",
                        "title": spec.get("title", f"Conditional Task: {condition_name}"),
                        "description": spec.get("description", f"Task triggered by condition: {condition_name}"),
                        "role": spec.get("role", "developer"),
                        "priority": spec.get("priority", TaskPriority.NORMAL.value),
                        "context": self._build_task_context(context),
                        "condition": condition_name,
                        "type": "conditional"
                    }
                    tasks.append(task)
        
        return tasks
    
    async def _apply_template(self, template_name: str, parameters: Dict[str, Any], 
                            context: HookContext) -> Dict[str, Any]:
        """Apply a spawn template to generate task specification"""
        template = self.spawn_templates.get(template_name, {})
        
        # Build template variables from context and parameters
        template_vars = {
            "error_type": context.trigger_data.get("error_type", "unknown"),
            "error_message": context.trigger_data.get("error_message", ""),
            "file_path": context.file_path or "unknown",
            "filename": context.file_path.split("/")[-1] if context.file_path else "unknown",
            "audit_scope": parameters.get("audit_scope", "code"),
            "component": parameters.get("component", "system"),
            "doc_type": parameters.get("doc_type", "API"),
            **parameters  # Allow override of any template variable
        }
        
        # Generate task specification
        task_id = f"{template_name}_{context.timestamp.strftime('%Y%m%d_%H%M%S') if context.timestamp else 'unknown'}"
        
        return {
            "id": task_id,
            "title": template.get("title_template", "Task: {template_name}").format(**template_vars),
            "description": template.get("description_template", "Generated task").format(**template_vars),
            "role": template.get("suggested_role", "developer"),
            "priority": template.get("priority", TaskPriority.NORMAL).value,
            "template": template_name,
            "context": self._build_task_context(context),
            "type": "template_generated"
        }
    
    async def _evaluate_condition(self, condition_spec: Dict[str, Any], 
                                context: HookContext) -> bool:
        """Evaluate whether a condition is met"""
        condition_type = condition_spec.get("type", "simple")
        
        if condition_type == "simple":
            # Simple key-value conditions
            required_keys = condition_spec.get("required_keys", [])
            for key in required_keys:
                if key not in context.trigger_data:
                    return False
            
            # Value checks
            value_checks = condition_spec.get("value_checks", {})
            for key, expected_value in value_checks.items():
                if context.trigger_data.get(key) != expected_value:
                    return False
            
            return True
        
        elif condition_type == "error":
            # Error-specific conditions
            return bool(context.trigger_data.get("error_info"))
        
        elif condition_type == "file_type":
            # File type conditions
            if not context.file_path:
                return False
            
            allowed_extensions = condition_spec.get("extensions", [])
            file_ext = context.file_path.split(".")[-1] if "." in context.file_path else ""
            return file_ext in allowed_extensions
        
        else:
            logger.warning(f"Unknown condition type: {condition_type}")
            return False
    
    def _build_task_context(self, hook_context: HookContext) -> Dict[str, Any]:
        """Build task context from hook context"""
        return {
            "hook_trigger": hook_context.trigger_type.value if hook_context.trigger_type else None,
            "source_file": hook_context.file_path,
            "source_task": hook_context.task_id,
            "trigger_timestamp": hook_context.timestamp.isoformat() if hook_context.timestamp else None,
            "trigger_data": hook_context.trigger_data
        }
    
    async def _spawn_tasks(self, task_specs: List[Dict[str, Any]], 
                         parameters: Dict[str, Any], 
                         context: HookContext) -> List[Dict[str, Any]]:
        """Actually spawn the tasks in the system (mock implementation)"""
        spawned_tasks = []
        
        for task_spec in task_specs:
            # This would integrate with the actual Vespera task management system
            # For now, simulate task creation
            
            logger.info(f"Spawning task: {task_spec['title']}")
            
            # Simulate task creation delay
            await asyncio.sleep(0.01)
            
            # Create task record
            spawned_task = {
                **task_spec,
                "status": "pending",
                "created_at": context.timestamp.isoformat() if context.timestamp else None,
                "created_by": "hook_system",
                "spawn_context": {
                    "hook_trigger": context.trigger_type.value if context.trigger_type else None,
                    "parameters": parameters
                }
            }
            
            spawned_tasks.append(spawned_task)
            
            logger.info(f"Task spawned successfully: {spawned_task['id']}")
        
        return spawned_tasks