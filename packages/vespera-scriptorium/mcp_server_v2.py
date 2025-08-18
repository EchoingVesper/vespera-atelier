#!/usr/bin/env python3
"""
Vespera V2 MCP Server using Official Python SDK

FastMCP-based server for hierarchical task management system.
"""

import sys
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime

# Add the package to path
sys.path.insert(0, str(Path(__file__).parent))

from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, Field

from tasks import TaskManager, TaskStatus, TaskPriority, TaskRelation, TaskMetadata
from roles import RoleManager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize the MCP server
mcp = FastMCP("vespera-v2-tasks")

# Global managers (initialized on first use)
_task_manager: Optional[TaskManager] = None
_role_manager: Optional[RoleManager] = None
_v2_data_dir: Optional[Path] = None


def get_managers():
    """Get or initialize the task and role managers."""
    global _task_manager, _role_manager, _v2_data_dir
    
    if _task_manager is None:
        project_root = Path.cwd()
        _v2_data_dir = project_root / ".vespera_v2"
        _v2_data_dir.mkdir(parents=True, exist_ok=True)
        
        _role_manager = RoleManager(project_root)
        _task_manager = TaskManager(project_root, _role_manager)
        
        # Use V2 directory for database
        _task_manager.task_service.db_path = _v2_data_dir / "tasks.db"
        _task_manager.task_service._init_database()
        
        logger.info(f"Initialized Vespera V2 with data directory: {_v2_data_dir}")
    
    return _task_manager, _role_manager


# Pydantic models for structured input
class TaskCreateInput(BaseModel):
    """Input model for task creation."""
    title: str = Field(..., description="Task title")
    description: str = Field("", description="Task description")
    parent_id: Optional[str] = Field(None, description="Parent task ID")
    project_id: Optional[str] = Field(None, description="Project identifier")
    feature: Optional[str] = Field(None, description="Feature area")
    role: Optional[str] = Field(None, description="Assigned role")
    priority: Optional[str] = Field("normal", description="Task priority")


class SubtaskInput(BaseModel):
    """Input model for subtask definition."""
    title: str = Field(..., description="Subtask title")
    description: str = Field("", description="Subtask description")
    role: Optional[str] = Field(None, description="Assigned role")
    priority: Optional[str] = Field("normal", description="Task priority")
    order: Optional[int] = Field(None, description="Task order")


class TaskTreeInput(BaseModel):
    """Input model for task tree creation."""
    title: str = Field(..., description="Root task title")
    description: str = Field("", description="Root task description")
    project_id: Optional[str] = Field(None, description="Project identifier")
    feature: Optional[str] = Field(None, description="Feature area")
    subtasks: List[SubtaskInput] = Field([], description="List of subtasks")


class TaskUpdateInput(BaseModel):
    """Input model for task updates."""
    task_id: str = Field(..., description="Task ID to update")
    title: Optional[str] = Field(None, description="New title")
    description: Optional[str] = Field(None, description="New description")
    status: Optional[str] = Field(None, description="New status")
    priority: Optional[str] = Field(None, description="New priority")
    role: Optional[str] = Field(None, description="New assigned role")


# Core task management tools
@mcp.tool()
async def create_task(task_input: TaskCreateInput) -> Dict[str, Any]:
    """Create a new task."""
    task_manager, _ = get_managers()
    
    try:
        # Convert priority string to enum
        priority = TaskPriority.NORMAL
        if task_input.priority:
            priority = TaskPriority(task_input.priority.lower())
        
        success, result = await task_manager.task_service.create_task(
            title=task_input.title,
            description=task_input.description,
            parent_id=task_input.parent_id,
            priority=priority,
            project_id=task_input.project_id,
            feature=task_input.feature,
            role_name=task_input.role
        )
        
        return {
            "success": success,
            "task": result["task"] if success else None,  # task is already a dict from service
            "message": result.get("message", "Task created successfully" if success else "Failed to create task")
        }
        
    except Exception as e:
        logger.exception("Error creating task")
        return {"success": False, "error": str(e)}


@mcp.tool()
async def create_task_tree(tree_input: TaskTreeInput) -> Dict[str, Any]:
    """Create a hierarchical task tree with subtasks."""
    task_manager, _ = get_managers()
    
    try:
        # Convert subtasks to the format expected by create_task_tree
        subtasks_data = []
        for subtask in tree_input.subtasks:
            subtask_dict = {
                "title": subtask.title,
                "description": subtask.description,
                "role": subtask.role,
                "priority": subtask.priority or "normal"
            }
            if subtask.order is not None:
                subtask_dict["order"] = subtask.order
            subtasks_data.append(subtask_dict)
        
        success, result = await task_manager.create_task_tree(
            title=tree_input.title,
            description=tree_input.description,
            subtasks=subtasks_data,
            project_id=tree_input.project_id,
            feature=tree_input.feature,
            auto_assign_roles=True
        )
        
        return {
            "success": success,
            "root_task": result.get("root_task") if success and result.get("root_task") else None,
            "total_created": result.get("total_created", 0),
            "message": result.get("message", "Task tree created successfully" if success else "Failed to create task tree")
        }
        
    except Exception as e:
        logger.exception("Error creating task tree")
        return {"success": False, "error": str(e)}


@mcp.tool()
async def list_tasks(
    status_filter: Optional[str] = None,
    priority_filter: Optional[str] = None,
    project_id: Optional[str] = None,
    assignee: Optional[str] = None,
    parent_id: Optional[str] = None,
    limit: int = 50
) -> Dict[str, Any]:
    """List tasks with optional filtering."""
    task_manager, _ = get_managers()
    
    try:
        # Convert string filters to enums
        status = None
        priority = None
        
        if status_filter:
            status = TaskStatus(status_filter.lower())
        if priority_filter:
            priority = TaskPriority(priority_filter.lower())
        
        tasks = await task_manager.task_service.list_tasks(
            status=status,
            priority=priority,
            project_id=project_id,
            assignee=assignee,
            parent_id=parent_id,
            limit=limit
        )
        
        return {
            "success": True,
            "tasks": [task.to_dict() for task in tasks],  # This is correct - tasks are Task objects
            "count": len(tasks),
            "filters": {
                "status": status_filter,
                "priority": priority_filter,
                "project_id": project_id,
                "assignee": assignee,
                "parent_id": parent_id
            }
        }
        
    except Exception as e:
        logger.exception("Error listing tasks")
        return {"success": False, "error": str(e)}


@mcp.tool()
async def get_task(task_id: str) -> Dict[str, Any]:
    """Get detailed information about a specific task."""
    task_manager, _ = get_managers()
    
    try:
        task = await task_manager.task_service.get_task(task_id)
        
        if task:
            return {
                "success": True,
                "task": task.to_dict()  # This is correct - task is a Task object
            }
        else:
            return {
                "success": False,
                "error": f"Task {task_id} not found"
            }
            
    except Exception as e:
        logger.exception("Error getting task")
        return {"success": False, "error": str(e)}


@mcp.tool()
async def update_task(update_input: TaskUpdateInput) -> Dict[str, Any]:
    """Update an existing task."""
    task_manager, _ = get_managers()
    
    try:
        updates = {}
        
        if update_input.title is not None:
            updates["title"] = update_input.title
        if update_input.description is not None:
            updates["description"] = update_input.description
        if update_input.status is not None:
            updates["status"] = update_input.status
        if update_input.priority is not None:
            updates["priority"] = update_input.priority
        if update_input.role is not None:
            updates["execution"] = {"assigned_role": update_input.role}
        
        success, result = await task_manager.task_service.update_task(
            update_input.task_id, updates
        )
        
        return {
            "success": success,
            "task": result["task"] if success else None,  # task is already a dict from service
            "message": result.get("message", "Task updated successfully" if success else "Failed to update task")
        }
        
    except Exception as e:
        logger.exception("Error updating task")
        return {"success": False, "error": str(e)}


@mcp.tool()
async def delete_task(task_id: str, recursive: bool = True) -> Dict[str, Any]:
    """Delete a task and optionally its children."""
    task_manager, _ = get_managers()
    
    try:
        success, result = await task_manager.task_service.delete_task(
            task_id, recursive=recursive
        )
        
        return {
            "success": success,
            "deleted_tasks": result.get("deleted_tasks", []),
            "message": result.get("message", "Task deleted successfully" if success else "Failed to delete task")
        }
        
    except Exception as e:
        logger.exception("Error deleting task")
        return {"success": False, "error": str(e)}


@mcp.tool()
async def execute_task(task_id: str, dry_run: bool = False) -> Dict[str, Any]:
    """Execute a specific task using its assigned role."""
    task_manager, role_manager = get_managers()
    
    try:
        # Get the task
        task = await task_manager.task_service.get_task(task_id)
        if not task:
            return {"success": False, "error": f"Task {task_id} not found"}
        
        # Check if task has an assigned role
        assigned_role = task.execution.assigned_role
        if not assigned_role:
            return {"success": False, "error": "Task has no assigned role"}
        
        # Get role and execute (simplified for demo)
        role = role_manager.get_role(assigned_role)
        if not role:
            return {"success": False, "error": f"Role {assigned_role} not found"}
        
        # Simulate execution
        execution_result = {
            "task_id": task_id,
            "role_used": assigned_role,
            "status": "completed" if not dry_run else "simulated",
            "success": True,
            "execution_time": 0.1,
            "output": f"Executed task '{task.title}' with role '{assigned_role}'",
            "artifacts": [],
            "dry_run": dry_run
        }
        
        if not dry_run:
            # Update task status
            await task_manager.task_service.update_task(
                task_id, {"status": "doing"}
            )
        
        return {
            "success": True,
            "execution_result": execution_result
        }
        
    except Exception as e:
        logger.exception("Error executing task")
        return {"success": False, "error": str(e)}


@mcp.tool()
async def complete_task(
    task_id: str, 
    output: str = "", 
    artifacts: List[str] = None
) -> Dict[str, Any]:
    """Mark a task as completed with output and artifacts."""
    task_manager, _ = get_managers()
    
    try:
        if artifacts is None:
            artifacts = []
            
        success, result = await task_manager.complete_task(
            task_id,
            output=output,
            artifacts=artifacts,
            mark_as_review=True
        )
        
        return {
            "success": success,
            "task": result.get("task") if success and result.get("task") else None,
            "unblocked_tasks": result.get("unblocked_tasks", []),
            "message": result.get("message", "Task completed successfully" if success else "Failed to complete task")
        }
        
    except Exception as e:
        logger.exception("Error completing task")
        return {"success": False, "error": str(e)}


@mcp.tool()
async def get_task_dashboard(project_id: Optional[str] = None) -> Dict[str, Any]:
    """Get dashboard with task statistics and insights."""
    task_manager, _ = get_managers()
    
    try:
        dashboard = await task_manager.get_task_dashboard(project_id)
        
        return {
            "success": True,
            "dashboard": dashboard,
            "generated_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.exception("Error getting dashboard")
        return {"success": False, "error": str(e)}


@mcp.tool()
async def get_task_tree(task_id: str) -> Dict[str, Any]:
    """Get the hierarchical tree structure for a task."""
    task_manager, _ = get_managers()
    
    try:
        tree = await task_manager.task_service.get_task_tree(task_id)
        
        if tree:
            return {
                "success": True,
                "tree": tree
            }
        else:
            return {
                "success": False,
                "error": f"Task tree not found for {task_id}"
            }
            
    except Exception as e:
        logger.exception("Error getting task tree")
        return {"success": False, "error": str(e)}


@mcp.tool()
async def analyze_task_dependencies(task_id: str) -> Dict[str, Any]:
    """Analyze task dependencies and blocking relationships."""
    task_manager, _ = get_managers()
    
    try:
        analysis = await task_manager.analyze_task_dependencies(task_id)
        
        return {
            "success": True,
            "analysis": analysis
        }
        
    except Exception as e:
        logger.exception("Error analyzing task dependencies")
        return {"success": False, "error": str(e)}


@mcp.tool()
async def add_task_dependency(task_id: str, depends_on_task_id: str) -> Dict[str, Any]:
    """Add a dependency relationship between two tasks."""
    task_manager, _ = get_managers()
    
    try:
        success = await task_manager.task_service.add_task_relationship(
            task_id, depends_on_task_id, TaskRelation.DEPENDS_ON
        )
        
        return {
            "success": success,
            "message": f"Task {task_id} now depends on {depends_on_task_id}" if success else "Failed to add dependency"
        }
        
    except Exception as e:
        logger.exception("Error adding task dependency")
        return {"success": False, "error": str(e)}


@mcp.tool()
async def list_roles() -> Dict[str, Any]:
    """List all available roles with their capabilities."""
    _, role_manager = get_managers()
    
    try:
        roles = role_manager.list_roles()
        role_details = []
        
        for role_name in roles:
            role = role_manager.get_role(role_name)
            if role:
                role_details.append({
                    "name": role_name,
                    "description": role.description,
                    "tool_groups": [str(tg) for tg in role.tool_groups],
                    "restrictions": str(role.restrictions) if hasattr(role, 'restrictions') else "None"
                })
        
        return {
            "success": True,
            "roles": role_details,
            "count": len(role_details)
        }
        
    except Exception as e:
        logger.exception("Error listing roles")
        return {"success": False, "error": str(e)}


@mcp.tool()
async def assign_role_to_task(task_id: str, role_name: str) -> Dict[str, Any]:
    """Assign a role to a task with capability validation."""
    task_manager, _ = get_managers()
    
    try:
        success, result = await task_manager.assign_role_to_task(
            task_id, role_name, validate_capabilities=True
        )
        
        return {
            "success": success,
            "task": result.get("task") if success and result.get("task") else None,
            "validation": result.get("validation", {}),
            "message": result.get("message", "Role assigned successfully" if success else "Failed to assign role")
        }
        
    except Exception as e:
        logger.exception("Error assigning role to task")
        return {"success": False, "error": str(e)}


if __name__ == "__main__":
    # Initialize managers on startup
    logger.info("🚀 Starting Vespera V2 Task Management MCP Server")
    get_managers()
    logger.info("✅ Vespera V2 MCP Server ready!")
    
    # Run the FastMCP server
    mcp.run()