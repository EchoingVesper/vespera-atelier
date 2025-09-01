#!/usr/bin/env python3
"""
Unified Vespera Server - Supports both MCP (stdio) and WebSocket protocols

This server can run in two modes:
1. MCP mode: stdio protocol for Claude Code integration  
2. WebSocket mode: WebSocket server for Obsidian plugin integration
3. Dual mode: Both protocols simultaneously (different ports/transports)

Supports project-specific database isolation for concurrent development.
"""

import sys
import os
import logging
import asyncio
import json
import signal
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime

# Add the package to path
sys.path.insert(0, str(Path(__file__).parent))

from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, Field

from tasks import TaskManager, TaskService, TaskStatus, TaskPriority, TaskRelation, TaskMetadata
from roles import RoleManager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global server instance
_server_instance: Optional['VesperaUnifiedServer'] = None

# Pydantic models for MCP tools
class TaskInput(BaseModel):
    """Input model for creating tasks."""
    title: str = Field(..., description="Task title")
    description: str = Field("", description="Task description")
    parent_id: Optional[str] = Field(None, description="Parent task ID")
    project_id: Optional[str] = Field(None, description="Project identifier")
    feature: Optional[str] = Field(None, description="Feature area")
    role: Optional[str] = Field(None, description="Assigned role")
    priority: Optional[str] = Field("normal", description="Task priority")
    order: Optional[int] = Field(None, description="Task order")
    subtasks: List['TaskInput'] = Field([], description="List of subtasks (recursive)")

# Enable forward references for recursive TaskInput
TaskInput.model_rebuild()

class TaskUpdateInput(BaseModel):
    """Input model for task updates."""
    task_id: str = Field(..., description="Task ID to update")
    title: Optional[str] = Field(None, description="New title")
    description: Optional[str] = Field(None, description="New description")
    status: Optional[str] = Field(None, description="New status")
    priority: Optional[str] = Field(None, description="New priority")
    role: Optional[str] = Field(None, description="New assigned role")

class VesperaUnifiedServer:
    def __init__(self, project_root: Optional[Path] = None, cwd: Optional[str] = None):
        """Initialize with project-specific isolation."""
        # Determine project root
        if cwd:
            self.project_root = Path(cwd)
        elif project_root:
            self.project_root = project_root
        else:
            self.project_root = Path.cwd()
            
        self.task_manager: Optional[TaskManager] = None
        self.role_manager: Optional[RoleManager] = None
        self.v2_data_dir: Optional[Path] = None
        self.mcp_server: Optional[FastMCP] = None
        self.websocket_server = None
        self.mode = "mcp"  # Default to MCP mode
        self.initialized = False
        
        logger.info(f"🎯 VesperaUnifiedServer initialized for project: {self.project_root}")
        
    def initialize_managers(self):
        """Initialize project-specific managers."""
        if not self.initialized:
            # Use project-specific data directory
            self.v2_data_dir = self.project_root / ".vespera_v2"
            self.v2_data_dir.mkdir(parents=True, exist_ok=True)
            
            self.role_manager = RoleManager(self.project_root)
            logger.info(f"✅ Role Manager initialized for {self.project_root}")
            
            task_service = TaskService(self.v2_data_dir / "tasks.db")
            self.task_manager = TaskManager(task_service, self.role_manager)
            logger.info(f"✅ Task Manager initialized for {self.project_root}")
            
            self.initialized = True
    
    def setup_mcp_server(self):
        """Setup MCP server with all comprehensive tools."""
        global _server_instance
        _server_instance = self
        
        self.mcp_server = FastMCP("vespera-v2-tasks")
        
        # Tool 1: Create Task (with hierarchical support)
        @self.mcp_server.tool()
        async def create_task(task_input: TaskInput) -> Dict[str, Any]:
            """Create a new task with optional subtasks (unified interface)."""
            self.initialize_managers()
            return await self._create_task_recursive(task_input)
        
        # Tool 2: List Tasks
        @self.mcp_server.tool()
        async def list_tasks(
            status_filter: Optional[str] = None,
            priority_filter: Optional[str] = None, 
            project_id: Optional[str] = None,
            assignee: Optional[str] = None,
            parent_id: Optional[str] = None,
            limit: int = 50
        ) -> Dict[str, Any]:
            """List tasks with optional filtering."""
            self.initialize_managers()
            return await self._list_tasks(status_filter, priority_filter, project_id, assignee, parent_id, limit)
        
        # Tool 3: Get Task
        @self.mcp_server.tool()
        async def get_task(task_id: str) -> Dict[str, Any]:
            """Get a specific task by ID with full details."""
            self.initialize_managers()
            return await self._get_task(task_id)
        
        # Tool 4: Update Task
        @self.mcp_server.tool()
        async def update_task(update_input: TaskUpdateInput) -> Dict[str, Any]:
            """Update task properties."""
            self.initialize_managers()
            return await self._update_task(update_input)
        
        # Tool 5: Delete Task
        @self.mcp_server.tool()
        async def delete_task(task_id: str, delete_subtasks: bool = False) -> Dict[str, Any]:
            """Delete a task and optionally its subtasks."""
            self.initialize_managers()
            return await self._delete_task(task_id, delete_subtasks)
        
        # Tool 6: Execute Task
        @self.mcp_server.tool()
        async def execute_task(
            task_id: Optional[str] = None,
            project_id: Optional[str] = None,
            dry_run: bool = False
        ) -> Dict[str, Any]:
            """Execute a specific task or find and execute next available task."""
            self.initialize_managers()
            return await self._execute_task(task_id, project_id, dry_run)
        
        # Tool 7: Complete Task
        @self.mcp_server.tool()
        async def complete_task(
            task_id: str,
            output: Optional[str] = None,
            artifacts: Optional[List[str]] = None
        ) -> Dict[str, Any]:
            """Mark a task as completed with output and artifacts."""
            self.initialize_managers()
            return await self._complete_task(task_id, output, artifacts)
        
        # Tool 8: Get Task Dashboard
        @self.mcp_server.tool()
        async def get_task_dashboard(project_id: Optional[str] = None) -> Dict[str, Any]:
            """Get comprehensive dashboard with task statistics and insights."""
            self.initialize_managers()
            return await self._get_task_dashboard(project_id)
        
        # Tool 9: Create Task Tree
        @self.mcp_server.tool()
        async def create_task_tree(
            tree_title: str,
            tree_description: str,
            subtasks: List[TaskInput],
            project_id: Optional[str] = None
        ) -> Dict[str, Any]:
            """Create a hierarchical task tree with root task and subtasks."""
            self.initialize_managers()
            return await self._create_task_tree(tree_title, tree_description, subtasks, project_id)
        
        # Tool 10: Get Task Tree
        @self.mcp_server.tool()
        async def get_task_tree(
            task_id: str,
            max_depth: int = 5
        ) -> Dict[str, Any]:
            """Get complete task tree structure starting from a root task."""
            self.initialize_managers()
            return await self._get_task_tree(task_id, max_depth)
        
        # Tool 11: List Roles
        @self.mcp_server.tool()
        async def list_roles() -> Dict[str, Any]:
            """List all available roles with their capabilities and restrictions."""
            self.initialize_managers()
            return await self._list_roles()
        
        # Tool 12: Assign Role to Task
        @self.mcp_server.tool()
        async def assign_role_to_task(task_id: str, role_name: str) -> Dict[str, Any]:
            """Assign or change the role for a specific task."""
            self.initialize_managers()
            return await self._assign_role_to_task(task_id, role_name)
        
        # Tool 13: Add Task Dependency
        @self.mcp_server.tool()
        async def add_task_dependency(
            task_id: str,
            depends_on_task_id: str,
            dependency_type: str = "blocks"
        ) -> Dict[str, Any]:
            """Add a dependency relationship between tasks."""
            self.initialize_managers()
            return await self._add_task_dependency(task_id, depends_on_task_id, dependency_type)
        
        # Tool 14: Analyze Task Dependencies
        @self.mcp_server.tool()
        async def analyze_task_dependencies(task_id: str) -> Dict[str, Any]:
            """Analyze task dependencies and provide insights."""
            self.initialize_managers()
            return await self._analyze_task_dependencies(task_id)
        
        logger.info("✅ All 14 MCP tools configured")
    
    # Implementation methods for MCP tools
    async def _create_task_recursive(self, task_input: TaskInput, parent_id: Optional[str] = None) -> Dict[str, Any]:
        """Recursively create a task and its subtasks."""
        try:
            # Convert priority string to enum
            priority = TaskPriority.NORMAL
            if task_input.priority:
                priority = TaskPriority(task_input.priority.lower())
            
            # Use parent_id from parameter if provided, otherwise from input
            actual_parent_id = parent_id or task_input.parent_id
            
            # Validate role if provided
            validated_role = None
            if task_input.role:
                role_names = self.role_manager.list_roles()
                if task_input.role not in role_names:
                    return {
                        "success": False, 
                        "error": f"Invalid role '{task_input.role}'. Available roles: {', '.join(role_names)}"
                    }
                validated_role = task_input.role
            
            # Create the main task
            success, result = await self.task_manager.task_service.create_task(
                title=task_input.title,
                description=task_input.description,
                parent_id=actual_parent_id,
                priority=priority,
                project_id=task_input.project_id,
                feature=task_input.feature,
                role_name=validated_role
            )
            
            if not success:
                return {"success": False, "error": result.get("message", "Failed to create task")}
            
            created_task = result["task"]
            task_id = created_task["id"]
            subtasks_created = []
            total_created = 1
            
            # Recursively create subtasks if any
            for subtask_input in task_input.subtasks:
                subtask_result = await self._create_task_recursive(subtask_input, parent_id=task_id)
                
                if subtask_result["success"]:
                    subtasks_created.append(subtask_result["task"])
                    total_created += subtask_result.get("total_created", 1)
                else:
                    logger.warning(f"Failed to create subtask: {subtask_result.get('error')}")
            
            return {
                "success": True,
                "task": created_task,
                "subtasks": subtasks_created,
                "total_created": total_created,
                "message": f"Task '{task_input.title}' created with {len(subtasks_created)} subtasks"
            }
            
        except Exception as e:
            logger.exception("Error in recursive task creation")
            return {"success": False, "error": str(e)}
    
    async def _list_tasks(self, status_filter, priority_filter, project_id, assignee, parent_id, limit):
        """List tasks with filtering."""
        try:
            # Convert string filters to enums
            status = None
            priority = None
            
            if status_filter:
                status = TaskStatus(status_filter.lower())
            if priority_filter:
                priority = TaskPriority(priority_filter.lower())
            
            tasks = await self.task_manager.task_service.list_tasks(
                status=status,
                priority=priority,
                project_id=project_id,
                assignee=assignee,
                parent_id=parent_id,
                limit=limit
            )
            
            return {
                "success": True,
                "tasks": tasks,
                "count": len(tasks),
                "message": f"Retrieved {len(tasks)} tasks"
            }
            
        except Exception as e:
            logger.exception("Error listing tasks")
            return {"success": False, "error": str(e)}
    
    async def _get_task(self, task_id: str):
        """Get task by ID."""
        try:
            task = await self.task_manager.task_service.get_task(task_id)
            if task:
                return {"success": True, "task": task}
            else:
                return {"success": False, "error": f"Task {task_id} not found"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _update_task(self, update_input: TaskUpdateInput):
        """Update task properties."""
        try:
            updates = {}
            if update_input.title is not None:
                updates["title"] = update_input.title
            if update_input.description is not None:
                updates["description"] = update_input.description
            if update_input.status is not None:
                updates["status"] = TaskStatus(update_input.status.lower())
            if update_input.priority is not None:
                updates["priority"] = TaskPriority(update_input.priority.lower())
            if update_input.role is not None:
                updates["role_name"] = update_input.role
            
            success, result = await self.task_manager.task_service.update_task(update_input.task_id, **updates)
            return {"success": success, "task": result.get("task") if success else None, "error": result.get("message") if not success else None}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _delete_task(self, task_id: str, delete_subtasks: bool):
        """Delete task."""
        try:
            success, result = await self.task_manager.task_service.delete_task(task_id, cascade=delete_subtasks)
            return {"success": success, "message": result.get("message", "Task deleted")}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _execute_task(self, task_id, project_id, dry_run):
        """Execute task."""
        try:
            if task_id:
                task = await self.task_manager.task_service.get_task(task_id)
                if not task:
                    return {"success": False, "error": f"Task {task_id} not found"}
            else:
                # Find next available task
                tasks = await self.task_manager.task_service.list_tasks(
                    status=TaskStatus.TODO,
                    project_id=project_id,
                    limit=1
                )
                if not tasks:
                    return {"success": False, "error": "No available tasks to execute"}
                task = tasks[0]
                task_id = task["id"]
            
            if dry_run:
                return {"success": True, "task": task, "message": "Dry run - task would be executed"}
            
            # Execute the task
            result = await self.task_manager.execute_task(task_id)
            return {"success": True, "execution_result": result}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _complete_task(self, task_id: str, output: Optional[str], artifacts: Optional[List[str]]):
        """Complete task."""
        try:
            success, result = await self.task_manager.task_service.update_task(
                task_id,
                status=TaskStatus.DONE,
                output=output,
                artifacts=artifacts or []
            )
            return {"success": success, "task": result.get("task") if success else None}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _get_task_dashboard(self, project_id: Optional[str]):
        """Get task dashboard."""
        try:
            dashboard = await self.task_manager.get_dashboard_data(project_id)
            return {"success": True, "dashboard": dashboard}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _create_task_tree(self, tree_title: str, tree_description: str, subtasks: List[TaskInput], project_id: Optional[str]):
        """Create task tree."""
        try:
            # Create root task
            root_task = TaskInput(
                title=tree_title,
                description=tree_description,
                project_id=project_id,
                subtasks=subtasks
            )
            
            result = await self._create_task_recursive(root_task)
            return result
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _get_task_tree(self, task_id: str, max_depth: int):
        """Get task tree structure."""
        try:
            tree = await self.task_manager.get_task_tree(task_id, max_depth=max_depth)
            return {"success": True, "tree": tree}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _list_roles(self):
        """List all roles."""
        try:
            roles = self.role_manager.list_roles()
            role_details = []
            for role_name in roles:
                role_info = self.role_manager.get_role_info(role_name)
                role_details.append(role_info)
            return {"success": True, "roles": role_details}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _assign_role_to_task(self, task_id: str, role_name: str):
        """Assign role to task."""
        try:
            success, result = await self.task_manager.task_service.update_task(task_id, role_name=role_name)
            return {"success": success, "task": result.get("task") if success else None}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _add_task_dependency(self, task_id: str, depends_on_task_id: str, dependency_type: str):
        """Add task dependency."""
        try:
            relation_type = TaskRelation(dependency_type.lower()) if dependency_type else TaskRelation.BLOCKS
            success, result = await self.task_manager.task_service.add_task_relation(
                task_id, depends_on_task_id, relation_type
            )
            return {"success": success, "message": result.get("message", "Dependency added")}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _analyze_task_dependencies(self, task_id: str):
        """Analyze task dependencies."""
        try:
            analysis = await self.task_manager.analyze_dependencies(task_id)
            return {"success": True, "analysis": analysis}
        except Exception as e:
            return {"success": False, "error": str(e)}
        
    async def handle_websocket_message(self, message: str) -> str:
        """Handle WebSocket messages using MCP protocol."""
        self.initialize_managers()
        try:
            request = json.loads(message)
            method = request.get('method')
            params = request.get('params', {})
            request_id = request.get('id')
            
            if method == 'initialize':
                return json.dumps({
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "result": {
                        "serverInfo": {"name": "vespera-v2-tasks", "version": "2.0.0"},
                        "capabilities": {"tools": True, "resources": False, "prompts": False}
                    }
                })
            
            elif method == 'tools/call':
                tool_name = params.get('name')
                tool_args = params.get('arguments', {})
                
                # Handle tool calls directly
                if tool_name == 'create_task':
                    result = self.task_manager.create_task(
                        title=tool_args.get('task_input', {}).get('title', ''),
                        description=tool_args.get('task_input', {}).get('description', ''),
                        priority=TaskPriority(tool_args.get('task_input', {}).get('priority', 'medium')),
                        project_id=tool_args.get('task_input', {}).get('project_id'),
                        feature=tool_args.get('task_input', {}).get('feature'),
                        metadata=tool_args.get('task_input', {}).get('metadata', {})
                    )
                    return json.dumps({
                        "jsonrpc": "2.0",
                        "id": request_id,
                        "result": {"success": True, "task": result}
                    })
                
                # Add more tool handlers...
                
            return json.dumps({
                "jsonrpc": "2.0",
                "id": request_id,
                "error": {"code": -32601, "message": f"Method not found: {method}"}
            })
            
        except Exception as e:
            logger.error(f"Error handling WebSocket message: {e}")
            return json.dumps({
                "jsonrpc": "2.0",
                "id": request.get('id') if 'request' in locals() else None,
                "error": {"code": -32603, "message": f"Internal error: {str(e)}"}
            })
    
    async def start_websocket_server(self, port: int = 8000):
        """Start WebSocket server on specified port."""
        try:
            import websockets
            
            async def websocket_handler(websocket):
                logger.info(f"New WebSocket connection from {websocket.remote_address}")
                try:
                    async for message in websocket:
                        response = await self.handle_websocket_message(message)
                        await websocket.send(response)
                except websockets.exceptions.ConnectionClosed:
                    logger.info("WebSocket connection closed")
                except Exception as e:
                    logger.error(f"WebSocket error: {e}")
            
            self.websocket_server = await websockets.serve(websocket_handler, "0.0.0.0", port)
            logger.info(f"🌐 WebSocket server running on ws://0.0.0.0:{port}")
            logger.info(f"   Accessible from Windows at: ws://localhost:{port}")
            return self.websocket_server
        
        except ImportError:
            logger.error("websockets library not installed. Run: pip install websockets")
            raise
    
    async def run_mcp_mode(self):
        """Run in pure MCP mode (stdio)."""
        logger.info("🚀 Starting Vespera Server in MCP mode...")
        self.setup_mcp_server()
        await self.mcp_server.run()
    
    async def run_websocket_mode(self, port: int = 8000):
        """Run in WebSocket mode only."""
        logger.info(f"🚀 Starting Vespera Server in WebSocket mode on port {port}...")
        self.initialize_managers()
        server = await self.start_websocket_server(port)
        await server.wait_closed()
    
    async def run_dual_mode(self, websocket_port: int = 8000):
        """Run both MCP (stdio) and WebSocket servers."""
        logger.info("🚀 Starting Vespera Server in DUAL mode...")
        self.setup_mcp_server()
        self.initialize_managers()
        
        # Start WebSocket server
        await self.start_websocket_server(websocket_port)
        
        # Run MCP server (this will handle stdio)
        await self.mcp_server.run()

async def main():
    """Main entry point with mode selection."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Vespera Unified Server')
    parser.add_argument('--mode', choices=['mcp', 'websocket', 'dual'], 
                        default='mcp', help='Server mode')
    parser.add_argument('--port', type=int, default=8000, 
                        help='WebSocket port (websocket/dual mode)')
    parser.add_argument('--cwd', type=str, default=None,
                        help='Working directory for project detection')
    
    args = parser.parse_args()
    
    # Create server with project root detection
    project_root = None
    if args.cwd:
        project_root = Path(args.cwd)
    
    server = VesperaUnifiedServer(project_root=project_root, cwd=args.cwd)
    server.mode = args.mode
    
    try:
        if args.mode == 'mcp':
            await server.run_mcp_mode()
        elif args.mode == 'websocket':
            await server.run_websocket_mode(args.port)
        elif args.mode == 'dual':
            await server.run_dual_mode(args.port)
    except KeyboardInterrupt:
        logger.info("Server shutdown requested")
    except Exception as e:
        logger.error(f"Server error: {e}")
        raise

if __name__ == "__main__":
    # For MCP stdio mode, we need to run directly without asyncio.run()
    # since Claude Code manages the event loop
    import sys
    
    # Check if running in MCP mode (no arguments or --mode mcp)
    if len(sys.argv) == 1 or (len(sys.argv) > 1 and '--mode' in sys.argv and 'mcp' in sys.argv):
        # MCP stdio mode - let Claude Code handle the event loop
        import argparse
        parser = argparse.ArgumentParser(description='Vespera Unified Server')
        parser.add_argument('--mode', choices=['mcp', 'websocket', 'dual'], 
                            default='mcp', help='Server mode')
        parser.add_argument('--cwd', type=str, default=None,
                            help='Working directory for project detection')
        
        args, _ = parser.parse_known_args()
        
        # Create and run server for MCP mode
        project_root = Path(args.cwd) if args.cwd else None
        server = VesperaUnifiedServer(project_root=project_root, cwd=args.cwd)
        
        # Setup MCP server and run via FastMCP (which handles the event loop properly)
        server.setup_mcp_server()
        server.mcp_server.run()
    else:
        # WebSocket or dual mode - use asyncio.run()
        asyncio.run(main())