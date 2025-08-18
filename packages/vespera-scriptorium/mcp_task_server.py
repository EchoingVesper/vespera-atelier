#!/usr/bin/env python3
"""
MCP Server for Vespera V2 Hierarchical Task Management System

Exposes the new task management system as MCP tools, replacing the V1 orchestrator
with a superior hierarchical task management system.

Inspired by Archon's unified tool approach with action-based operations.
"""

import asyncio
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List
from datetime import datetime

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

from tasks import TaskManager, TaskExecutor, TaskStatus, TaskPriority, TaskRelation, TaskMetadata
from roles import RoleManager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class VesperaTaskMCPServer:
    """MCP Server for Vespera V2 Task Management System."""
    
    def __init__(self, project_root: Optional[Path] = None):
        """Initialize the MCP server with task management system."""
        self.project_root = project_root or Path.cwd()
        
        # Use a separate V2 directory to avoid conflicts with V1
        self.v2_data_dir = self.project_root / ".vespera_v2"
        self.v2_data_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize managers with V2 paths
        self.role_manager = RoleManager(self.project_root)
        self.task_manager = TaskManager(self.project_root, self.role_manager)
        self.task_executor = TaskExecutor(self.project_root, self.role_manager, self.task_manager)
        
        # Override task service database path to use V2 directory
        self.task_manager.task_service.db_path = self.v2_data_dir / "tasks.db"
        self.task_manager.task_service._init_database()
        
        logger.info(f"Initialized Vespera V2 MCP Server with data directory: {self.v2_data_dir}")
    
    async def manage_task(self, 
                         action: str,
                         task_id: Optional[str] = None,
                         title: Optional[str] = None,
                         description: Optional[str] = None,
                         parent_id: Optional[str] = None,
                         project_id: Optional[str] = None,
                         feature: Optional[str] = None,
                         role: Optional[str] = None,
                         priority: Optional[str] = None,
                         status: Optional[str] = None,
                         subtasks: Optional[List[Dict[str, Any]]] = None,
                         output: Optional[str] = None,
                         artifacts: Optional[List[str]] = None,
                         filter_by: Optional[str] = None,
                         filter_value: Optional[str] = None,
                         include_children: bool = True,
                         limit: int = 50,
                         dry_run: bool = False) -> Dict[str, Any]:
        """
        Unified task management tool for all task operations.
        
        Actions:
        - create: Create a new task or task tree
        - list: List tasks with filtering
        - get: Get a specific task by ID
        - update: Update task properties
        - delete: Delete a task (and optionally children)
        - execute: Execute a task using assigned role
        - complete: Mark task as complete/review
        - assign_role: Assign or change task role
        - add_dependency: Add task dependency
        - analyze: Analyze task dependencies
        - dashboard: Get task dashboard and statistics
        - tree: Get task tree structure
        
        Returns:
            Dictionary with operation results
        """
        try:
            # Route to appropriate handler based on action
            if action == "create":
                return await self._handle_create(
                    title, description, parent_id, project_id, 
                    feature, role, priority, subtasks
                )
            
            elif action == "list":
                return await self._handle_list(
                    filter_by, filter_value, project_id, 
                    include_children, limit
                )
            
            elif action == "get":
                if not task_id:
                    return {"error": "task_id required for get action"}
                return await self._handle_get(task_id)
            
            elif action == "update":
                if not task_id:
                    return {"error": "task_id required for update action"}
                return await self._handle_update(
                    task_id, title, description, status, 
                    priority, role
                )
            
            elif action == "delete":
                if not task_id:
                    return {"error": "task_id required for delete action"}
                return await self._handle_delete(task_id, recursive=True)
            
            elif action == "execute":
                if task_id:
                    return await self._handle_execute_specific(task_id, dry_run)
                else:
                    return await self._handle_execute_next(project_id)
            
            elif action == "complete":
                if not task_id:
                    return {"error": "task_id required for complete action"}
                return await self._handle_complete(task_id, output, artifacts)
            
            elif action == "assign_role":
                if not task_id or not role:
                    return {"error": "task_id and role required for assign_role action"}
                return await self._handle_assign_role(task_id, role)
            
            elif action == "add_dependency":
                if not task_id or not filter_value:  # filter_value used as target_id
                    return {"error": "task_id and filter_value (target_id) required"}
                return await self._handle_add_dependency(task_id, filter_value)
            
            elif action == "analyze":
                if not task_id:
                    return {"error": "task_id required for analyze action"}
                return await self._handle_analyze(task_id)
            
            elif action == "dashboard":
                return await self._handle_dashboard(project_id)
            
            elif action == "tree":
                if not task_id:
                    return {"error": "task_id required for tree action"}
                return await self._handle_tree(task_id)
            
            else:
                return {"error": f"Unknown action: {action}"}
                
        except Exception as e:
            logger.error(f"Error in manage_task: {e}")
            return {"error": str(e)}
    
    # Handler methods for each action
    async def _handle_create(self, title, description, parent_id, project_id, 
                            feature, role, priority, subtasks):
        """Handle task creation."""
        if not title:
            return {"error": "title required for create action"}
        
        if subtasks:
            # Create task tree
            success, result = await self.task_manager.create_task_tree(
                title=title,
                description=description or "",
                subtasks=subtasks,
                project_id=project_id,
                feature=feature,
                auto_assign_roles=True
            )
        else:
            # Create single task
            task_priority = TaskPriority(priority) if priority else TaskPriority.NORMAL
            success, result = await self.task_manager.task_service.create_task(
                title=title,
                description=description or "",
                parent_id=parent_id,
                priority=task_priority,
                project_id=project_id,
                feature=feature,
                role_name=role
            )
        
        return {"success": success, **result}
    
    async def _handle_list(self, filter_by, filter_value, project_id, 
                          include_children, limit):
        """Handle task listing with filters."""
        # Parse filter options
        status = None
        priority = None
        assignee = None
        parent_id = None
        
        if filter_by == "status" and filter_value:
            status = TaskStatus(filter_value)
        elif filter_by == "priority" and filter_value:
            priority = TaskPriority(filter_value)
        elif filter_by == "assignee":
            assignee = filter_value
        elif filter_by == "parent":
            parent_id = filter_value
        elif filter_by == "root":
            parent_id = None  # Explicitly get root tasks
        
        tasks = await self.task_manager.task_service.list_tasks(
            status=status,
            priority=priority,
            project_id=project_id,
            assignee=assignee,
            parent_id=parent_id,
            include_children=include_children,
            limit=limit
        )
        
        return {
            "success": True,
            "tasks": [task.to_dict() for task in tasks],
            "count": len(tasks)
        }
    
    async def _handle_get(self, task_id):
        """Handle getting a specific task."""
        task = await self.task_manager.task_service.get_task(task_id)
        if task:
            return {"success": True, "task": task.to_dict()}
        else:
            return {"success": False, "error": f"Task {task_id} not found"}
    
    async def _handle_update(self, task_id, title, description, status, 
                            priority, role):
        """Handle task updates."""
        updates = {}
        if title is not None:
            updates["title"] = title
        if description is not None:
            updates["description"] = description
        if status is not None:
            updates["status"] = status
        if priority is not None:
            updates["priority"] = priority
        if role is not None:
            updates["execution"] = {"assigned_role": role}
        
        success, result = await self.task_manager.task_service.update_task(
            task_id, updates
        )
        
        return {"success": success, **result}
    
    async def _handle_delete(self, task_id, recursive):
        """Handle task deletion."""
        success, result = await self.task_manager.task_service.delete_task(
            task_id, recursive=recursive
        )
        return {"success": success, **result}
    
    async def _handle_execute_specific(self, task_id, dry_run):
        """Handle executing a specific task."""
        result = await self.task_executor.execute_task(task_id, dry_run=dry_run)
        return {
            "success": result.success,
            "execution_result": result.to_dict()
        }
    
    async def _handle_execute_next(self, project_id):
        """Handle executing next available task."""
        success, result = await self.task_manager.execute_next_task(project_id)
        return {"success": success, **result}
    
    async def _handle_complete(self, task_id, output, artifacts):
        """Handle task completion."""
        success, result = await self.task_manager.complete_task(
            task_id,
            output=output or "",
            artifacts=artifacts or [],
            mark_as_review=True
        )
        return {"success": success, **result}
    
    async def _handle_assign_role(self, task_id, role):
        """Handle role assignment."""
        success, result = await self.task_manager.assign_role_to_task(
            task_id, role, validate_capabilities=True
        )
        return {"success": success, **result}
    
    async def _handle_add_dependency(self, task_id, target_id):
        """Handle adding task dependency."""
        success = await self.task_manager.task_service.add_task_relationship(
            task_id, target_id, TaskRelation.DEPENDS_ON
        )
        return {
            "success": success,
            "message": f"Task {task_id} now depends on {target_id}" if success else "Failed to add dependency"
        }
    
    async def _handle_analyze(self, task_id):
        """Handle task dependency analysis."""
        analysis = await self.task_manager.analyze_task_dependencies(task_id)
        return {"success": True, "analysis": analysis}
    
    async def _handle_dashboard(self, project_id):
        """Handle dashboard request."""
        dashboard = await self.task_manager.get_task_dashboard(project_id)
        return {"success": True, "dashboard": dashboard}
    
    async def _handle_tree(self, task_id):
        """Handle task tree request."""
        tree = await self.task_manager.task_service.get_task_tree(task_id)
        if tree:
            return {"success": True, "tree": tree}
        else:
            return {"success": False, "error": f"Task tree not found for {task_id}"}


async def main():
    """Main entry point for MCP server."""
    logger.info("Starting Vespera V2 Task Management MCP Server...")
    
    # Initialize server
    server = Server("vespera-v2-tasks")
    vespera_server = VesperaTaskMCPServer()
    
    # Register the unified manage_task tool
    @server.list_tools()
    async def list_tools() -> list[Tool]:
        """List available MCP tools."""
        return [
            Tool(
                name="manage_task",
                description="""Comprehensive task management for Vespera V2.

Actions:
- create: Create task/tree (requires: title; optional: description, subtasks, project_id, feature, role)
- list: List tasks (optional: filter_by, filter_value, project_id, limit)
- get: Get task details (requires: task_id)
- update: Update task (requires: task_id; optional: title, description, status, priority, role)
- delete: Delete task (requires: task_id)
- execute: Execute task (optional: task_id for specific, project_id for next)
- complete: Mark complete (requires: task_id; optional: output, artifacts)
- assign_role: Assign role (requires: task_id, role)
- add_dependency: Add dependency (requires: task_id, filter_value as target_id)
- analyze: Analyze dependencies (requires: task_id)
- dashboard: Get dashboard (optional: project_id)
- tree: Get task tree (requires: task_id)

Examples:
- Create: action="create", title="Implement feature", description="Details", role="coder"
- List TODO: action="list", filter_by="status", filter_value="todo"
- Execute next: action="execute", project_id="my-project"
- Complete: action="complete", task_id="abc123", output="Done!"
""",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "action": {"type": "string", "enum": [
                            "create", "list", "get", "update", "delete",
                            "execute", "complete", "assign_role", "add_dependency",
                            "analyze", "dashboard", "tree"
                        ]},
                        "task_id": {"type": "string"},
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "parent_id": {"type": "string"},
                        "project_id": {"type": "string"},
                        "feature": {"type": "string"},
                        "role": {"type": "string"},
                        "priority": {"type": "string", "enum": ["critical", "high", "normal", "low", "someday"]},
                        "status": {"type": "string", "enum": ["todo", "doing", "review", "done", "blocked", "cancelled"]},
                        "subtasks": {"type": "array", "items": {"type": "object"}},
                        "output": {"type": "string"},
                        "artifacts": {"type": "array", "items": {"type": "string"}},
                        "filter_by": {"type": "string"},
                        "filter_value": {"type": "string"},
                        "include_children": {"type": "boolean", "default": True},
                        "limit": {"type": "integer", "default": 50},
                        "dry_run": {"type": "boolean", "default": False}
                    },
                    "required": ["action"]
                }
            )
        ]
    
    @server.call_tool()
    async def call_tool(name: str, arguments: dict) -> list[TextContent]:
        """Handle tool calls."""
        if name == "manage_task":
            result = await vespera_server.manage_task(**arguments)
            return [TextContent(
                type="text",
                text=json.dumps(result, indent=2, default=str)
            )]
        else:
            return [TextContent(
                type="text",
                text=f"Unknown tool: {name}"
            )]
    
    # Run the server
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream)


if __name__ == "__main__":
    asyncio.run(main())