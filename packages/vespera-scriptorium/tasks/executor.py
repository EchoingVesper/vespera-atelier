"""
Task Executor for Hierarchical Task Management System

Integrates task execution with the role system, providing role-based task execution
with comprehensive tracking and real-time updates.
"""

import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
import asyncio
from pathlib import Path

from .models import Task, TaskStatus, TaskExecution
from .service import TaskService
from .manager import TaskManager
from roles import RoleManager, RoleExecutor
from roles.execution import ExecutionStatus

logger = logging.getLogger(__name__)


class TaskExecutionResult:
    """Result of task execution with comprehensive tracking."""
    
    def __init__(self,
                 task_id: str,
                 success: bool,
                 status: ExecutionStatus,
                 output: str = "",
                 error: Optional[str] = None,
                 role_used: Optional[str] = None,
                 execution_time: float = 0.0,
                 artifacts_created: List[str] = None,
                 tool_groups_used: List[str] = None,
                 metadata: Dict[str, Any] = None):
        self.task_id = task_id
        self.success = success
        self.status = status
        self.output = output
        self.error = error
        self.role_used = role_used
        self.execution_time = execution_time
        self.artifacts_created = artifacts_created or []
        self.tool_groups_used = tool_groups_used or []
        self.metadata = metadata or {}
        self.timestamp = datetime.now()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "task_id": self.task_id,
            "success": self.success,
            "status": self.status.value if self.status else None,
            "output": self.output,
            "error": self.error,
            "role_used": self.role_used,
            "execution_time": self.execution_time,
            "artifacts_created": self.artifacts_created,
            "tool_groups_used": self.tool_groups_used,
            "metadata": self.metadata,
            "timestamp": self.timestamp.isoformat()
        }


class TaskExecutor:
    """
    Executes tasks using the role system with comprehensive tracking.
    
    Integrates hierarchical task management with role-based execution,
    providing real-time updates, artifact tracking, and execution history.
    """
    
    def __init__(self,
                 project_root: Optional[Path] = None,
                 role_manager: Optional[RoleManager] = None,
                 task_manager: Optional[TaskManager] = None):
        """Initialize with project context and managers."""
        self.project_root = project_root or Path.cwd()
        self.role_manager = role_manager or RoleManager(project_root)
        self.task_manager = task_manager or TaskManager(project_root, self.role_manager)
        self.role_executor = RoleExecutor(self.role_manager, project_root)
        
        # Execution tracking
        self.active_executions: Dict[str, Dict[str, Any]] = {}
        self.execution_history: List[TaskExecutionResult] = []
        
    # Core execution methods
    async def execute_task(self,
                          task_id: str,
                          context: Optional[Dict[str, Any]] = None,
                          dry_run: bool = False,
                          timeout_minutes: int = 30) -> TaskExecutionResult:
        """
        Execute a specific task using its assigned role.
        
        Args:
            task_id: Task to execute
            context: Additional execution context
            dry_run: If True, validate but don't execute
            timeout_minutes: Execution timeout
            
        Returns:
            TaskExecutionResult with execution details
        """
        start_time = datetime.now()
        
        try:
            # Get task
            task = await self.task_manager.task_service.get_task(task_id)
            if not task:
                return TaskExecutionResult(
                    task_id=task_id,
                    success=False,
                    status=ExecutionStatus.FAILED,
                    error=f"Task {task_id} not found"
                )
            
            # Validate task is ready for execution
            if not task.can_be_executed():
                return TaskExecutionResult(
                    task_id=task_id,
                    success=False,
                    status=ExecutionStatus.RESTRICTED,
                    error="Task is not ready for execution (no role assigned or blocked)",
                    role_used=task.execution.assigned_role
                )
            
            # Get assigned role
            role_name = task.execution.assigned_role
            role = self.role_manager.get_role(role_name)
            if not role:
                return TaskExecutionResult(
                    task_id=task_id,
                    success=False,
                    status=ExecutionStatus.FAILED,
                    error=f"Assigned role '{role_name}' not found",
                    role_used=role_name
                )
            
            # Build execution context
            execution_context = self._build_execution_context(task, context)
            
            # Track active execution
            if not dry_run:
                self.active_executions[task_id] = {
                    "started_at": start_time.isoformat(),
                    "role": role_name,
                    "status": "executing",
                    "context": execution_context
                }
                
                # Update task status to DOING
                await self.task_manager.task_service.update_task(
                    task_id, 
                    {"status": TaskStatus.DOING.value}
                )
            
            # Execute using role executor (synchronous call)
            role_result = self.role_executor.execute_task(
                role_name=role_name,
                task_prompt=self._build_task_prompt(task, execution_context),
                linked_documents=execution_context.get("linked_documents", []),
                project_context=execution_context.get("project_context", ""),
                dry_run=dry_run
            )
            
            # Calculate execution time
            execution_time = (datetime.now() - start_time).total_seconds()
            
            # Create result
            result = TaskExecutionResult(
                task_id=task_id,
                success=role_result.status == ExecutionStatus.COMPLETED,
                status=role_result.status,
                output=role_result.output,
                error=role_result.error_message,
                role_used=role_name,
                execution_time=execution_time,
                artifacts_created=role_result.files_modified,
                tool_groups_used=role_result.tool_groups_used,
                metadata={
                    "llm_used": role_result.llm_used,
                    "restrictions_violated": role_result.restrictions_violated,
                    "execution_context": execution_context
                }
            )
            
            # Update task with execution results
            if not dry_run:
                await self._update_task_after_execution(task, result)
            
            # Clean up active execution tracking
            self.active_executions.pop(task_id, None)
            
            # Add to execution history
            self.execution_history.append(result)
            
            logger.info(f"Executed task '{task.title}' with result: {result.status.value}")
            return result
            
        except asyncio.TimeoutError:
            execution_time = (datetime.now() - start_time).total_seconds()
            result = TaskExecutionResult(
                task_id=task_id,
                success=False,
                status=ExecutionStatus.TIMEOUT,
                error=f"Task execution timed out after {timeout_minutes} minutes",
                execution_time=execution_time,
                role_used=task.execution.assigned_role if 'task' in locals() else None
            )
            
            # Clean up
            self.active_executions.pop(task_id, None)
            self.execution_history.append(result)
            
            return result
            
        except Exception as e:
            execution_time = (datetime.now() - start_time).total_seconds()
            result = TaskExecutionResult(
                task_id=task_id,
                success=False,
                status=ExecutionStatus.FAILED,
                error=str(e),
                execution_time=execution_time,
                role_used=task.execution.assigned_role if 'task' in locals() else None
            )
            
            # Clean up
            self.active_executions.pop(task_id, None)
            self.execution_history.append(result)
            
            logger.error(f"Failed to execute task {task_id}: {e}")
            return result
    
    async def execute_task_sequence(self,
                                   task_ids: List[str],
                                   stop_on_failure: bool = True,
                                   max_parallel: int = 1) -> List[TaskExecutionResult]:
        """
        Execute a sequence of tasks, optionally in parallel.
        
        Args:
            task_ids: Tasks to execute in order
            stop_on_failure: Stop sequence if any task fails
            max_parallel: Maximum parallel executions (1 = sequential)
            
        Returns:
            List of execution results
        """
        try:
            results = []
            
            if max_parallel == 1:
                # Sequential execution
                for task_id in task_ids:
                    result = await self.execute_task(task_id)
                    results.append(result)
                    
                    if stop_on_failure and not result.success:
                        logger.warning(f"Task sequence stopped at {task_id} due to failure")
                        break
            else:
                # Parallel execution with semaphore
                semaphore = asyncio.Semaphore(max_parallel)
                
                async def execute_with_semaphore(task_id: str) -> TaskExecutionResult:
                    async with semaphore:
                        return await self.execute_task(task_id)
                
                # Execute all tasks concurrently
                tasks = [execute_with_semaphore(task_id) for task_id in task_ids]
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                # Convert exceptions to failed results
                for i, result in enumerate(results):
                    if isinstance(result, Exception):
                        results[i] = TaskExecutionResult(
                            task_id=task_ids[i],
                            success=False,
                            status=ExecutionStatus.FAILED,
                            error=str(result)
                        )
            
            logger.info(f"Executed {len(results)} tasks, {sum(1 for r in results if r.success)} succeeded")
            return results
            
        except Exception as e:
            logger.error(f"Failed to execute task sequence: {e}")
            return []
    
    async def execute_next_available_task(self,
                                         project_id: Optional[str] = None,
                                         role_filter: Optional[List[str]] = None) -> Optional[TaskExecutionResult]:
        """
        Find and execute the next available task.
        
        Args:
            project_id: Limit to specific project
            role_filter: Only consider tasks for specific roles
            
        Returns:
            Execution result or None if no tasks available
        """
        try:
            # Find next executable task
            success, result = await self.task_manager.execute_next_task(project_id)
            
            if not success:
                logger.info(f"No executable tasks found: {result.get('message', 'Unknown reason')}")
                return None
            
            task_data = result["task"]
            task_id = task_data["id"]
            
            # Check role filter
            if role_filter and task_data["execution"]["assigned_role"] not in role_filter:
                logger.info(f"Task {task_id} role not in filter, skipping")
                return None
            
            # Execute the task
            return await self.execute_task(task_id)
            
        except Exception as e:
            logger.error(f"Failed to execute next available task: {e}")
            return None
    
    # Execution context and prompt building
    def _build_execution_context(self, task: Task, additional_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Build comprehensive execution context for a task."""
        context = {
            "task_id": task.id,
            "title": task.title,
            "description": task.description,
            "priority": task.priority.value,
            "project_id": task.project_id,
            "feature": task.feature,
            "milestone": task.milestone,
            "metadata": task.metadata.__dict__,
            "linked_documents": [],
            "project_context": "",
            "parent_context": None
        }
        
        # Add source references from metadata
        if task.metadata.source_references:
            context["linked_documents"].extend(task.metadata.source_references)
        
        # Add code references
        if task.metadata.code_references:
            context["code_references"] = task.metadata.code_references
        
        # Build project context
        if task.project_id:
            context["project_context"] = f"Project: {task.project_id}"
            if task.feature:
                context["project_context"] += f", Feature: {task.feature}"
        
        # Add parent context if this is a subtask
        if task.parent_id:
            context["parent_context"] = f"This is a subtask of: {task.parent_id}"
        
        # Add execution history for context
        if task.execution.execution_history:
            context["previous_attempts"] = len(task.execution.execution_history)
            if task.execution.last_error:
                context["last_error"] = task.execution.last_error
        
        # Merge additional context
        if additional_context:
            context.update(additional_context)
        
        return context
    
    def _build_task_prompt(self, task: Task, context: Dict[str, Any]) -> str:
        """Build the task prompt for role execution."""
        prompt_parts = [
            f"# Task: {task.title}",
            "",
            f"**Description**: {task.description}",
            f"**Priority**: {task.priority.value}",
            f"**Complexity**: {task.metadata.complexity}",
        ]
        
        if task.metadata.estimated_effort:
            prompt_parts.append(f"**Estimated Effort**: {task.metadata.estimated_effort}")
        
        if context.get("project_context"):
            prompt_parts.extend([
                "",
                "## Project Context",
                context["project_context"]
            ])
        
        if context.get("parent_context"):
            prompt_parts.extend([
                "",
                "## Parent Task Context", 
                context["parent_context"]
            ])
        
        if task.metadata.tags:
            prompt_parts.extend([
                "",
                f"**Tags**: {', '.join(task.metadata.tags)}"
            ])
        
        if task.metadata.source_references:
            prompt_parts.extend([
                "",
                "## Reference Materials",
                *[f"- {ref}" for ref in task.metadata.source_references]
            ])
        
        if task.metadata.code_references:
            prompt_parts.extend([
                "",
                "## Code References",
                *[f"- {ref}" for ref in task.metadata.code_references]
            ])
        
        if context.get("previous_attempts", 0) > 0:
            prompt_parts.extend([
                "",
                f"## Previous Attempts",
                f"This task has been attempted {context['previous_attempts']} times before.",
            ])
            
            if context.get("last_error"):
                prompt_parts.extend([
                    f"Last error encountered: {context['last_error']}",
                    "Please learn from this error and avoid the same issue."
                ])
        
        prompt_parts.extend([
            "",
            "## Instructions",
            "Please complete this task according to your role's capabilities and restrictions.",
            "Focus on delivering high-quality results that meet the task requirements.",
            "If you encounter issues, explain them clearly and suggest next steps."
        ])
        
        return "\n".join(prompt_parts)
    
    async def _update_task_after_execution(self, task: Task, result: TaskExecutionResult) -> None:
        """Update task after execution completes."""
        try:
            # Update execution record
            task.execution.add_execution_record(
                role_name=result.role_used or "Unknown",
                status=result.status.value,
                output=result.output,
                error=result.error,
                metadata={
                    "execution_time": result.execution_time,
                    "artifacts_created": result.artifacts_created,
                    "tool_groups_used": result.tool_groups_used,
                    "llm_used": result.metadata.get("llm_used"),
                    "restrictions_violated": result.metadata.get("restrictions_violated", [])
                }
            )
            
            # Update task status based on result
            if result.success:
                new_status = TaskStatus.REVIEW  # Mark for review by default
                if task.metadata.get_label("auto_complete") == "true":
                    new_status = TaskStatus.DONE  # Skip review if configured
            else:
                new_status = TaskStatus.TODO  # Return to TODO for retry
                if not task.execution.can_retry():
                    new_status = TaskStatus.BLOCKED  # Block if max retries exceeded
            
            # Save updates
            updates = {
                "status": new_status.value,
                "execution": task.execution.__dict__
            }
            
            # Add actual effort if execution was successful
            if result.success and result.execution_time > 0:
                effort_minutes = int(result.execution_time / 60)
                if effort_minutes > 0:
                    task.metadata.actual_effort = f"{effort_minutes} minutes"
                    updates["metadata"] = task.metadata.__dict__
            
            await self.task_manager.task_service.update_task(task.id, updates)
            
        except Exception as e:
            logger.error(f"Failed to update task after execution: {e}")
    
    # Monitoring and status methods
    def get_active_executions(self) -> Dict[str, Dict[str, Any]]:
        """Get currently active task executions."""
        return self.active_executions.copy()
    
    def get_execution_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent execution history."""
        recent_history = self.execution_history[-limit:] if limit > 0 else self.execution_history
        return [result.to_dict() for result in recent_history]
    
    def get_execution_statistics(self) -> Dict[str, Any]:
        """Get execution statistics."""
        if not self.execution_history:
            return {"total_executions": 0}
        
        total = len(self.execution_history)
        successful = sum(1 for r in self.execution_history if r.success)
        
        # Calculate average execution time
        times = [r.execution_time for r in self.execution_history if r.execution_time > 0]
        avg_time = sum(times) / len(times) if times else 0
        
        # Count by status
        status_counts = {}
        for result in self.execution_history:
            status = result.status.value if result.status else "unknown"
            status_counts[status] = status_counts.get(status, 0) + 1
        
        # Count by role
        role_counts = {}
        for result in self.execution_history:
            role = result.role_used or "unknown"
            role_counts[role] = role_counts.get(role, 0) + 1
        
        return {
            "total_executions": total,
            "successful_executions": successful,
            "success_rate": (successful / total * 100) if total > 0 else 0,
            "average_execution_time": round(avg_time, 2),
            "active_executions": len(self.active_executions),
            "by_status": status_counts,
            "by_role": role_counts
        }
    
    async def cancel_execution(self, task_id: str) -> bool:
        """Cancel an active task execution."""
        try:
            if task_id not in self.active_executions:
                return False
            
            # Remove from active executions
            self.active_executions.pop(task_id, None)
            
            # Update task status back to TODO
            await self.task_manager.task_service.update_task(
                task_id, 
                {"status": TaskStatus.TODO.value}
            )
            
            logger.info(f"Cancelled execution of task {task_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to cancel task execution {task_id}: {e}")
            return False