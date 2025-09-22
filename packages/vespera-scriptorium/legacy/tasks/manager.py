"""
Task Manager for Hierarchical Task Management System

High-level interface for task management operations with role integration,
dependency resolution, and comprehensive task orchestration.
"""

import logging
from typing import Dict, List, Optional, Any, Tuple, Set
from datetime import datetime, timedelta
from pathlib import Path

from .models import Task, TaskStatus, TaskPriority, TaskRelation, TaskMetadata
from .service import TaskService
from roles import RoleManager, ToolGroup

logger = logging.getLogger(__name__)


class TaskManager:
    """
    High-level task management orchestrator.
    
    Provides comprehensive task management with role integration,
    dependency resolution, and intelligent task assignment.
    """
    
    def __init__(self, 
                 project_root: Optional[Path] = None,
                 role_manager: Optional[RoleManager] = None):
        """Initialize with optional project root and role manager."""
        self.project_root = project_root or Path.cwd()
        self.role_manager = role_manager or RoleManager(project_root)
        self.task_service = TaskService(
            db_path=project_root / ".vespera_scriptorium" / "tasks.db" if project_root else None
        )
        
        # Initialize task executor for real agent spawning
        from .executor import TaskExecutor
        self.task_executor = TaskExecutor(self.project_root, self.role_manager, self)
        
        # Task execution tracking
        self.active_executions: Dict[str, Dict[str, Any]] = {}
        
    # High-level task operations
    async def create_task_tree(self,
                              title: str,
                              description: str = "",
                              subtasks: List[Dict[str, Any]] = None,
                              project_id: Optional[str] = None,
                              feature: Optional[str] = None,
                              auto_assign_roles: bool = True) -> Tuple[bool, Dict[str, Any]]:
        """
        Create a task with optional subtasks in a single operation.
        
        Args:
            title: Root task title
            description: Root task description  
            subtasks: List of subtask definitions with title, description, role, etc.
            project_id: Project association
            feature: Feature association
            auto_assign_roles: Whether to automatically assign suitable roles
        """
        try:
            # Create root task
            success, result = await self.task_service.create_task(
                title=title,
                description=description,
                project_id=project_id,
                feature=feature
            )
            
            if not success:
                return False, result
            
            root_task_data = result["task"]
            root_task_id = root_task_data["id"]
            created_tasks = [root_task_data]
            
            # Create subtasks
            if subtasks:
                for subtask_def in subtasks:
                    subtask_title = subtask_def.get("title", "")
                    if not subtask_title:
                        continue
                    
                    # Determine role assignment
                    role_name = subtask_def.get("role")
                    if auto_assign_roles and not role_name:
                        role_name = await self._suggest_role_for_task(
                            subtask_title, 
                            subtask_def.get("description", "")
                        )
                    
                    # Create subtask
                    sub_success, sub_result = await self.task_service.create_task(
                        title=subtask_title,
                        description=subtask_def.get("description", ""),
                        parent_id=root_task_id,
                        priority=TaskPriority(subtask_def.get("priority", "normal")),
                        project_id=project_id,
                        feature=feature,
                        role_name=role_name,
                        task_order=subtask_def.get("order", 0)
                    )
                    
                    if sub_success:
                        created_tasks.append(sub_result["task"])
                    else:
                        logger.warning(f"Failed to create subtask '{subtask_title}': {sub_result}")
            
            logger.info(f"Created task tree with {len(created_tasks)} tasks")
            return True, {
                "root_task": root_task_data,
                "all_tasks": created_tasks,
                "total_created": len(created_tasks)
            }
            
        except Exception as e:
            logger.error(f"Failed to create task tree: {e}")
            return False, {"error": str(e)}
    
    async def execute_next_task(self, 
                               project_id: Optional[str] = None,
                               assignee: Optional[str] = None) -> Tuple[bool, Dict[str, Any]]:
        """
        Find and execute the next highest priority task.
        
        Returns the task that was selected for execution or explanation why none found.
        """
        try:
            # Find executable tasks
            executable_tasks = await self._find_executable_tasks(project_id, assignee)
            
            if not executable_tasks:
                return False, {
                    "message": "No executable tasks found",
                    "suggestion": "Check for blocked dependencies or ensure roles are assigned"
                }
            
            # Select highest priority task
            next_task = self._select_next_task(executable_tasks)
            
            # Update status to DOING
            success, result = await self.task_service.update_task(
                next_task.id, 
                {"status": TaskStatus.DOING.value}
            )
            
            if not success:
                return False, {"error": f"Failed to update task status: {result}"}
            
            # Track active execution
            self.active_executions[next_task.id] = {
                "started_at": datetime.now().isoformat(),
                "role": next_task.execution.assigned_role,
                "status": "in_progress"
            }
            
            logger.info(f"Selected task '{next_task.title}' for execution")
            return True, {
                "task": next_task.to_dict(),
                "message": f"Task '{next_task.title}' is ready for execution",
                "execution_context": self._build_execution_context(next_task)
            }
            
        except Exception as e:
            logger.error(f"Failed to execute next task: {e}")
            return False, {"error": str(e)}
    
    async def complete_task(self,
                           task_id: str,
                           output: str = "",
                           artifacts: List[str] = None,
                           mark_as_review: bool = True) -> Tuple[bool, Dict[str, Any]]:
        """
        Complete a task and update dependent tasks.
        
        Args:
            task_id: Task to complete
            output: Execution output/results
            artifacts: List of created artifacts (files, etc.)
            mark_as_review: If True, mark as REVIEW instead of DONE
        """
        try:
            task = await self.task_service.get_task(task_id)
            if not task:
                return False, {"error": f"Task {task_id} not found"}
            
            # Update task status
            new_status = TaskStatus.REVIEW if mark_as_review else TaskStatus.DONE
            
            # Record execution completion
            task.execution.add_execution_record(
                role_name=task.execution.assigned_role or "Unknown",
                status="completed",
                output=output,
                metadata={
                    "artifacts": artifacts or [],
                    "completion_time": datetime.now().isoformat()
                }
            )
            
            # Update task
            updates = {
                "status": new_status.value,
                "execution": {
                    "execution_history": task.execution.execution_history,
                    "assigned_role": task.execution.assigned_role,
                    "current_execution_id": task.execution.current_execution_id,
                    "retry_count": task.execution.retry_count,
                    "max_retries": task.execution.max_retries,
                    "last_error": task.execution.last_error,
                    "execution_context": task.execution.execution_context
                }
            }
            
            success, result = await self.task_service.update_task(task_id, updates)
            if not success:
                return False, {"error": f"Failed to update task: {result}"}
            
            # Clean up active execution tracking
            self.active_executions.pop(task_id, None)
            
            # Check for dependent tasks that can now be unblocked
            unblocked_tasks = await self._check_and_unblock_dependent_tasks(task_id)
            
            logger.info(f"Completed task '{task.title}', unblocked {len(unblocked_tasks)} tasks")
            return True, {
                "task": result["task"],
                "unblocked_tasks": [t.to_dict() for t in unblocked_tasks],
                "status": new_status.value
            }
            
        except Exception as e:
            logger.error(f"Failed to complete task {task_id}: {e}")
            return False, {"error": str(e)}
    
    # Task querying and analysis
    async def get_task_dashboard(self, 
                                project_id: Optional[str] = None) -> Dict[str, Any]:
        """Get comprehensive task dashboard with statistics and insights."""
        try:
            # Get all tasks for project
            all_tasks = await self.task_service.list_tasks(
                project_id=project_id,
                limit=1000
            )
            
            # Calculate statistics
            stats = self._calculate_task_statistics(all_tasks)
            
            # Get active/priority tasks
            todo_tasks = [t for t in all_tasks if t.status == TaskStatus.TODO]
            doing_tasks = [t for t in all_tasks if t.status == TaskStatus.DOING]
            review_tasks = [t for t in all_tasks if t.status == TaskStatus.REVIEW]
            blocked_tasks = [t for t in all_tasks if t.status == TaskStatus.BLOCKED]
            
            # Get overdue tasks
            overdue_tasks = [t for t in all_tasks if t.is_overdue()]
            
            # Role utilization
            role_stats = self._calculate_role_statistics(all_tasks)
            
            return {
                "statistics": stats,
                "task_lists": {
                    "todo": [t.to_dict() for t in todo_tasks[:10]],  # Top 10
                    "doing": [t.to_dict() for t in doing_tasks],
                    "review": [t.to_dict() for t in review_tasks],
                    "blocked": [t.to_dict() for t in blocked_tasks],
                    "overdue": [t.to_dict() for t in overdue_tasks]
                },
                "role_utilization": role_stats,
                "recommendations": await self._generate_recommendations(all_tasks)
            }
            
        except Exception as e:
            logger.error(f"Failed to get task dashboard: {e}")
            return {"error": str(e)}
    
    async def analyze_task_dependencies(self, 
                                      task_id: str) -> Dict[str, Any]:
        """Analyze task dependencies and potential issues."""
        try:
            task = await self.task_service.get_task(task_id)
            if not task:
                return {"error": f"Task {task_id} not found"}
            
            analysis = {
                "task_id": task_id,
                "task_title": task.title,
                "depends_on": [],
                "blocks": [],
                "dependency_chain": [],
                "issues": []
            }
            
            # Analyze dependencies
            depends_on_ids = task.get_related_tasks(TaskRelation.DEPENDS_ON)
            for dep_id in depends_on_ids:
                dep_task = await self.task_service.get_task(dep_id)
                if dep_task:
                    analysis["depends_on"].append({
                        "id": dep_id,
                        "title": dep_task.title,
                        "status": dep_task.status.value,
                        "blocking": dep_task.status not in [TaskStatus.DONE, TaskStatus.CANCELLED]
                    })
                    
                    if dep_task.status not in [TaskStatus.DONE, TaskStatus.CANCELLED]:
                        analysis["issues"].append(f"Blocked by incomplete task: {dep_task.title}")
            
            # Analyze what this task blocks
            blocks_ids = task.get_related_tasks(TaskRelation.BLOCKS)
            for blocked_id in blocks_ids:
                blocked_task = await self.task_service.get_task(blocked_id)
                if blocked_task:
                    analysis["blocks"].append({
                        "id": blocked_id,
                        "title": blocked_task.title,
                        "status": blocked_task.status.value
                    })
            
            # Build dependency chain
            analysis["dependency_chain"] = await self._build_dependency_chain(task_id)
            
            # Check for circular dependencies
            if await self._has_circular_dependency(task_id):
                analysis["issues"].append("Circular dependency detected")
            
            return analysis
            
        except Exception as e:
            logger.error(f"Failed to analyze dependencies for task {task_id}: {e}")
            return {"error": str(e)}
    
    # Role integration and assignment
    async def suggest_role_for_task(self, 
                                   task_id: str) -> Optional[str]:
        """Suggest the best role for a task based on content and requirements."""
        try:
            task = await self.task_service.get_task(task_id)
            if not task:
                return None
            
            return await self._suggest_role_for_task(task.title, task.description)
            
        except Exception as e:
            logger.error(f"Failed to suggest role for task {task_id}: {e}")
            return None
    
    async def assign_role_to_task(self, 
                                 task_id: str, 
                                 role_name: str,
                                 validate_capabilities: bool = True) -> Tuple[bool, Dict[str, Any]]:
        """Assign a role to a task with validation."""
        try:
            task = await self.task_service.get_task(task_id)
            if not task:
                return False, {"error": f"Task {task_id} not found"}
            
            role = self.role_manager.get_role(role_name)
            if not role:
                return False, {"error": f"Role '{role_name}' not found"}
            
            # Validate role capabilities if requested
            if validate_capabilities:
                validation_result = await self._validate_role_for_task(task, role)
                if not validation_result["suitable"]:
                    return False, {
                        "error": "Role not suitable for task",
                        "validation": validation_result
                    }
            
            # Assign role
            success, result = await self.task_service.update_task(
                task_id,
                {"execution": {**task.execution.__dict__, "assigned_role": role_name}}
            )
            
            if success:
                logger.info(f"Assigned role '{role_name}' to task '{task.title}'")
                
            return success, result
            
        except Exception as e:
            logger.error(f"Failed to assign role to task: {e}")
            return False, {"error": str(e)}
    
    # Private helper methods
    async def _find_executable_tasks(self, 
                                    project_id: Optional[str] = None,
                                    assignee: Optional[str] = None) -> List[Task]:
        """Find tasks that are ready for execution."""
        try:
            # Get TODO tasks
            todo_tasks = await self.task_service.list_tasks(
                status=TaskStatus.TODO,
                project_id=project_id,
                assignee=assignee
            )
            
            executable = []
            for task in todo_tasks:
                # Check if role is assigned
                if not task.execution.assigned_role:
                    continue
                
                # Check dependencies
                if await self._has_blocking_dependencies(task):
                    continue
                
                # Check if role is available/valid
                role = self.role_manager.get_role(task.execution.assigned_role)
                if not role:
                    continue
                
                executable.append(task)
            
            return executable
            
        except Exception as e:
            logger.error(f"Failed to find executable tasks: {e}")
            return []
    
    def _select_next_task(self, tasks: List[Task]) -> Task:
        """Select the next task to execute based on priority and ordering."""
        if not tasks:
            return None
        
        # Sort by priority (descending) then by task_order (ascending)
        sorted_tasks = sorted(
            tasks,
            key=lambda t: (-self._priority_to_number(t.priority), t.task_order)
        )
        
        return sorted_tasks[0]
    
    def _priority_to_number(self, priority: TaskPriority) -> int:
        """Convert priority to number for sorting."""
        priority_map = {
            TaskPriority.CRITICAL: 4,
            TaskPriority.HIGH: 3,
            TaskPriority.NORMAL: 2,
            TaskPriority.LOW: 1,
            TaskPriority.SOMEDAY: 0
        }
        return priority_map.get(priority, 2)
    
    def _build_execution_context(self, task: Task) -> Dict[str, Any]:
        """Build execution context for a task."""
        return {
            "task_id": task.id,
            "title": task.title,
            "description": task.description,
            "assigned_role": task.execution.assigned_role,
            "project_id": task.project_id,
            "feature": task.feature,
            "priority": task.priority.value,
            "metadata": task.metadata.__dict__,
            "parent_context": self._get_parent_context(task) if task.parent_id else None
        }
    
    def _get_parent_context(self, task: Task) -> Optional[str]:
        """Get context from parent task for inheritance."""
        # This would be implemented to provide parent task context
        # For now, return basic info
        if task.parent_id:
            return f"Child task of: {task.parent_id}"
        return None
    
    async def _has_blocking_dependencies(self, task: Task) -> bool:
        """Check if task has any blocking dependencies."""
        try:
            depends_on_ids = task.get_related_tasks(TaskRelation.DEPENDS_ON)
            
            for dep_id in depends_on_ids:
                dep_task = await self.task_service.get_task(dep_id)
                if dep_task and dep_task.status not in [TaskStatus.DONE, TaskStatus.CANCELLED]:
                    return True
            
            return False
            
        except Exception as e:
            logger.error(f"Failed to check blocking dependencies: {e}")
            return True  # Err on side of caution
    
    async def _check_and_unblock_dependent_tasks(self, completed_task_id: str) -> List[Task]:
        """Check for tasks that can be unblocked by task completion."""
        try:
            # Find tasks that depend on the completed task
            all_tasks = await self.task_service.list_tasks(limit=1000)
            unblocked = []
            
            for task in all_tasks:
                if (task.status == TaskStatus.BLOCKED and 
                    completed_task_id in task.get_related_tasks(TaskRelation.DEPENDS_ON)):
                    
                    # Check if all other dependencies are satisfied
                    if not await self._has_blocking_dependencies(task):
                        # Unblock the task
                        await self.task_service.update_task(
                            task.id, 
                            {"status": TaskStatus.TODO.value}
                        )
                        unblocked.append(task)
            
            return unblocked
            
        except Exception as e:
            logger.error(f"Failed to check dependent tasks: {e}")
            return []
    
    async def _suggest_role_for_task(self, title: str, description: str) -> Optional[str]:
        """Suggest best role based on task content."""
        try:
            content = f"{title} {description}".lower()
            
            # Simple keyword-based role suggestion
            role_keywords = {
                "coder": ["implement", "code", "function", "class", "api", "algorithm", "programming"],
                "tester": ["test", "validate", "verify", "check", "ensure", "quality"],
                "researcher": ["research", "investigate", "analyze", "study", "explore"],
                "documenter": ["document", "write", "readme", "guide", "explain"],
                "reviewer": ["review", "audit", "inspect", "evaluate", "assess"],
                "architect": ["design", "architecture", "structure", "plan", "schema"]
            }
            
            scores = {}
            for role_name, keywords in role_keywords.items():
                if self.role_manager.get_role(role_name):  # Check role exists
                    score = sum(1 for keyword in keywords if keyword in content)
                    if score > 0:
                        scores[role_name] = score
            
            if scores:
                best_role = max(scores, key=scores.get)
                logger.info(f"Suggested role '{best_role}' for task '{title}' (score: {scores[best_role]})")
                return best_role
            
            # Default fallback
            return "coder" if self.role_manager.get_role("coder") else None
            
        except Exception as e:
            logger.error(f"Failed to suggest role: {e}")
            return None
    
    async def _validate_role_for_task(self, task: Task, role) -> Dict[str, Any]:
        """Validate if a role is suitable for a task."""
        try:
            validation = {
                "suitable": True,
                "issues": [],
                "recommendations": []
            }
            
            # Check if role has required tool groups for task type
            content = f"{task.title} {task.description}".lower()
            
            required_groups = set()
            if any(word in content for word in ["file", "code", "implement", "write"]):
                required_groups.add(ToolGroup.EDIT)
            if any(word in content for word in ["test", "run", "execute", "command"]):
                required_groups.add(ToolGroup.COMMAND)
            if any(word in content for word in ["research", "web", "search", "browse"]):
                required_groups.add(ToolGroup.BROWSER)
            
            for group in required_groups:
                if not role.has_tool_group(group):
                    validation["suitable"] = False
                    validation["issues"].append(f"Role lacks required tool group: {group.value}")
            
            return validation
            
        except Exception as e:
            logger.error(f"Failed to validate role for task: {e}")
            return {"suitable": False, "issues": [f"Validation error: {str(e)}"]}
    
    def _calculate_task_statistics(self, tasks: List[Task]) -> Dict[str, Any]:
        """Calculate comprehensive task statistics."""
        total = len(tasks)
        if total == 0:
            return {"total": 0}
        
        status_counts = {}
        priority_counts = {}
        
        for task in tasks:
            status_counts[task.status.value] = status_counts.get(task.status.value, 0) + 1
            priority_counts[task.priority.value] = priority_counts.get(task.priority.value, 0) + 1
        
        completed = status_counts.get("done", 0)
        completion_rate = (completed / total) * 100 if total > 0 else 0
        
        return {
            "total": total,
            "by_status": status_counts,
            "by_priority": priority_counts,
            "completion_rate": round(completion_rate, 2),
            "active_tasks": status_counts.get("doing", 0),
            "pending_review": status_counts.get("review", 0),
            "blocked_tasks": status_counts.get("blocked", 0)
        }
    
    def _calculate_role_statistics(self, tasks: List[Task]) -> Dict[str, Any]:
        """Calculate role utilization statistics."""
        role_stats = {}
        
        for task in tasks:
            role = task.execution.assigned_role
            if role:
                if role not in role_stats:
                    role_stats[role] = {"total": 0, "completed": 0, "active": 0}
                
                role_stats[role]["total"] += 1
                
                if task.status == TaskStatus.DONE:
                    role_stats[role]["completed"] += 1
                elif task.status == TaskStatus.DOING:
                    role_stats[role]["active"] += 1
        
        # Calculate completion rates
        for role, stats in role_stats.items():
            if stats["total"] > 0:
                stats["completion_rate"] = round((stats["completed"] / stats["total"]) * 100, 2)
            else:
                stats["completion_rate"] = 0
        
        return role_stats
    
    async def _generate_recommendations(self, tasks: List[Task]) -> List[str]:
        """Generate actionable recommendations based on task analysis."""
        recommendations = []
        
        # Check for tasks without assigned roles
        unassigned = [t for t in tasks if not t.execution.assigned_role and t.status == TaskStatus.TODO]
        if unassigned:
            recommendations.append(f"{len(unassigned)} tasks need role assignments")
        
        # Check for blocked tasks
        blocked = [t for t in tasks if t.status == TaskStatus.BLOCKED]
        if blocked:
            recommendations.append(f"{len(blocked)} tasks are blocked - review dependencies")
        
        # Check for overdue tasks
        overdue = [t for t in tasks if t.is_overdue()]
        if overdue:
            recommendations.append(f"{len(overdue)} tasks are overdue - consider reprioritizing")
        
        # Check for tasks in review too long (>24 hours)
        review_tasks = [t for t in tasks if t.status == TaskStatus.REVIEW]
        stale_reviews = []
        for task in review_tasks:
            if task.updated_at and (datetime.now() - task.updated_at) > timedelta(days=1):
                stale_reviews.append(task)
        
        if stale_reviews:
            recommendations.append(f"{len(stale_reviews)} tasks in review need attention")
        
        return recommendations
    
    async def _build_dependency_chain(self, task_id: str, visited: Set[str] = None) -> List[str]:
        """Build the dependency chain for a task."""
        if visited is None:
            visited = set()
        
        if task_id in visited:
            return ["<circular dependency>"]
        
        visited.add(task_id)
        
        task = await self.task_service.get_task(task_id)
        if not task:
            return [task_id]
        
        chain = [task_id]
        depends_on_ids = task.get_related_tasks(TaskRelation.DEPENDS_ON)
        
        for dep_id in depends_on_ids:
            dep_chain = await self._build_dependency_chain(dep_id, visited.copy())
            chain.extend(dep_chain)
        
        return chain
    
    async def _has_circular_dependency(self, task_id: str) -> bool:
        """Check if task has circular dependencies."""
        try:
            chain = await self._build_dependency_chain(task_id)
            return "<circular dependency>" in chain
        except Exception as e:
            logger.error(f"Failed to check circular dependency: {e}")
            return False
    
    async def start_task_execution(self, task_id: str, 
                                  context: Optional[Dict[str, Any]] = None,
                                  timeout_minutes: int = 30) -> Dict[str, Any]:
        """
        Start task execution asynchronously and return execution_id immediately.
        
        Args:
            task_id: Task to execute
            context: Additional execution context  
            timeout_minutes: Execution timeout
            
        Returns:
            Dictionary with success status and execution_id
        """
        try:
            execution_id = await self.task_executor.start_task_execution(
                task_id, context, timeout_minutes
            )
            
            return {
                "success": True,
                "execution_id": execution_id,
                "task_id": task_id,
                "message": f"Task execution started with ID: {execution_id}"
            }
            
        except ValueError as e:
            logger.error(f"Validation error starting task {task_id}: {e}")
            return {
                "success": False,
                "error_message": str(e),
                "task_id": task_id
            }
            
        except Exception as e:
            logger.error(f"Failed to start task execution for {task_id}: {e}")
            return {
                "success": False,
                "error_message": f"Internal error: {str(e)}",
                "task_id": task_id
            }
    
    async def get_execution_status(self, execution_id: str) -> Dict[str, Any]:
        """
        Get the status of an ongoing or completed execution.
        
        Args:
            execution_id: Execution identifier
            
        Returns:
            Dictionary with execution status information
        """
        try:
            status = self.task_executor.get_execution_status(execution_id)
            
            if status is None:
                return {
                    "success": False,
                    "error_message": f"Execution {execution_id} not found",
                    "execution_id": execution_id
                }
            
            return {
                "success": True,
                "execution_id": execution_id,
                "status": status
            }
            
        except Exception as e:
            logger.error(f"Failed to get execution status for {execution_id}: {e}")
            return {
                "success": False,
                "error_message": str(e),
                "execution_id": execution_id
            }

    async def execute_task(self, task_id: str, 
                          context: Optional[Dict[str, Any]] = None,
                          dry_run: bool = False) -> Dict[str, Any]:
        """
        Execute a task using the assigned role through agent spawning.
        
        This is the core orchestration method that spawns Claude agents to execute tasks.
        
        Args:
            task_id: Task to execute
            context: Additional execution context
            dry_run: If True, validate but don't execute
            
        Returns:
            Dictionary with execution results
        """
        try:
            # Use TaskExecutor for real agent spawning
            result = await self.task_executor.execute_task(task_id, context, dry_run)
            
            # Convert TaskExecutionResult to dictionary format expected by MCP tools
            return {
                "success": result.success,
                "status": result.status.value,
                "output": result.output,
                "role_used": result.role_used,
                "execution_time": result.execution_time,
                "tool_groups_used": result.tool_groups_used or [],
                "artifacts_created": result.artifacts_created or [],
                "error_message": result.error,
                "timestamp": result.timestamp.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to execute task {task_id}: {e}")
            return {
                "success": False,
                "status": "failed",
                "error_message": str(e),
                "output": "",
                "execution_time": 0.0
            }