#!/usr/bin/env python3
"""
Vespera Server - The single source of truth for all Vespera Scriptorium server functionality

Supports both MCP (stdio) and WebSocket protocols with intelligent project detection.
This consolidated server replaces all other server files for clarity and maintainability.

Features:
- Intelligent project root detection via ProjectDetector
- 14 comprehensive MCP tools for complete task lifecycle management
- Project-specific database isolation
- Dual-mode operation (MCP + WebSocket)
- Proper async handling without event loop conflicts
"""

import sys
import os
import logging
import asyncio
import json
import signal
import argparse
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime

# Add the package to path
sys.path.insert(0, str(Path(__file__).parent))

from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, Field

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from tasks import TaskManager, TaskService, TaskStatus, TaskPriority, TaskRelation, TaskMetadata
from roles import RoleManager
from hook_integration import HookIntegrationManager, HookAgentInput, TimedAgentInput, HookTriggerInput

# Try importing BackgroundTaskExecutionManager with fallback
try:
    from vespera_utilities.background_manager.task_execution_manager import BackgroundTaskExecutionManager
except ImportError:
    try:
        import sys
        from pathlib import Path
        utilities_path = Path(__file__).parent.parent.parent / "vespera-utilities"
        sys.path.insert(0, str(utilities_path))
        from background_manager.task_execution_manager import BackgroundTaskExecutionManager
    except ImportError:
        # If still can't import, create a mock for testing
        class BackgroundTaskExecutionManager:
            def __init__(self, *args, **kwargs):
                pass
            def shutdown(self, *args, **kwargs):
                pass
            def get_performance_metrics(self):
                return {"mock": True}

# Import the high-performance Rust file operations module
try:
    import vespera_file_ops
    RUST_FILE_OPS_AVAILABLE = True
    logger.info("✅ High-performance Rust file operations module loaded")
except ImportError as e:
    RUST_FILE_OPS_AVAILABLE = False
    logger.warning(f"⚠️  Rust file operations module not available, falling back to Python: {e}")

# Global server instance for MCP tool access
_server_instance: Optional['VesperaServer'] = None


class ProjectDetector:
    """Intelligent project root detection and configuration management."""
    
    @staticmethod
    def find_project_root(start_path: Path = None) -> Path:
        """
        Find project root by looking for project markers.
        
        Searches upward from start_path for:
        1. .git directory
        2. .vespera_* directories  
        3. package.json, pyproject.toml, etc.
        4. Falls back to start_path if nothing found
        """
        if start_path is None:
            start_path = Path.cwd()
        
        current = start_path.resolve()
        
        # Project markers in order of preference
        markers = [
            '.git',
            '.vespera_scriptorium', 
            '.vespera_v2',
            '.vespera',
            'package.json',
            'pyproject.toml',
            'Cargo.toml',
            'pom.xml'
        ]
        
        while current != current.parent:  # Not at filesystem root
            for marker in markers:
                if (current / marker).exists():
                    logger.info(f"📁 Found project root: {current} (marker: {marker})")
                    return current
            current = current.parent
            
        # No markers found, use start_path
        logger.info(f"📁 Using fallback project root: {start_path}")
        return start_path
    
    @staticmethod
    def get_vespera_dir(project_root: Path) -> Path:
        """Get the .vespera_scriptorium directory for this project."""
        vespera_dir = project_root / ".vespera_scriptorium"
        vespera_dir.mkdir(parents=True, exist_ok=True)
        return vespera_dir
    
    @staticmethod
    def detect_from_obsidian_vault(vault_path: str = None) -> Path:
        """Detect project root from Obsidian vault path."""
        if not vault_path:
            return ProjectDetector.find_project_root()
            
        vault_path = Path(vault_path)
        if vault_path.exists():
            return ProjectDetector.find_project_root(vault_path)
        return ProjectDetector.find_project_root()
    
    @staticmethod
    def detect_from_working_dir(cwd: str = None) -> Path:
        """Detect project root from specified working directory."""
        if cwd:
            return ProjectDetector.find_project_root(Path(cwd))
        return ProjectDetector.find_project_root()


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


class VesperaServer:
    """
    The unified Vespera server - single source of truth for all server functionality.
    
    Supports:
    - Intelligent project detection
    - Project-specific database isolation
    - MCP (stdio) protocol for Claude Code integration
    - WebSocket protocol for Obsidian plugin integration
    - 14 comprehensive MCP tools
    """
    
    def __init__(self, project_root: Path = None, cwd: str = None, vault_path: str = None):
        """Initialize with intelligent project detection."""
        global _server_instance
        _server_instance = self
        
        # Intelligent project root detection
        if cwd:
            self.project_root = ProjectDetector.detect_from_working_dir(cwd)
        elif vault_path:
            self.project_root = ProjectDetector.detect_from_obsidian_vault(vault_path)
        elif project_root:
            self.project_root = project_root
        else:
            self.project_root = ProjectDetector.find_project_root()
        
        self.vespera_dir = ProjectDetector.get_vespera_dir(self.project_root)
        
        # Initialize server components
        self.task_manager: Optional[TaskManager] = None
        self.role_manager: Optional[RoleManager] = None
        self.background_executor: Optional[BackgroundTaskExecutionManager] = None
        self.hook_integration: Optional[HookIntegrationManager] = None
        self.mcp_server: Optional[FastMCP] = None
        self.websocket_server = None
        self.initialized = False
        
        logger.info(f"🎯 Vespera Server initialized:")
        logger.info(f"   Project root: {self.project_root}")
        logger.info(f"   Vespera dir: {self.vespera_dir}")
        logger.info(f"   Project name: {self.project_root.name}")
    
    def initialize_managers(self):
        """Initialize project-specific managers with lazy loading."""
        if not self.initialized:
            # Initialize role manager
            self.role_manager = RoleManager(self.project_root)
            logger.info(f"✅ Role Manager initialized for project: {self.project_root.name}")
            
            # Initialize task service with project-specific database
            task_db_path = self.vespera_dir / "tasks.db"
            task_service = TaskService(task_db_path)
            self.task_manager = TaskManager(self.project_root, self.role_manager)
            self.task_manager.task_service = task_service
            
            logger.info(f"✅ Task Manager initialized:")
            logger.info(f"   Project: {self.project_root.name}")
            logger.info(f"   Database: {task_db_path}")
            
            # Initialize background task execution manager  
            results_path = self.vespera_dir / "background_results"
            self.background_executor = BackgroundTaskExecutionManager(
                max_workers=4,
                result_storage_path=results_path,
                enable_persistence=True
            )
            logger.info(f"✅ Background Task Executor initialized")
            
            # Initialize hook agent integration
            self.hook_integration = HookIntegrationManager(
                task_manager=self.task_manager,
                background_executor=self.background_executor,
                project_root=self.project_root
            )
            logger.info(f"✅ Hook Agent Integration initialized")
            
            self.initialized = True
    
    def setup_mcp_server(self):
        """Setup MCP server with all 14 comprehensive tools."""
        server_name = f"vespera-{self.project_root.name}"
        self.mcp_server = FastMCP(server_name)
        
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
        
        # Tool 6.5: Start Task Execution (Async)
        @self.mcp_server.tool()
        async def start_task_execution(
            task_id: str,
            timeout_minutes: int = 30
        ) -> Dict[str, Any]:
            """Start task execution asynchronously and return execution_id immediately."""
            self.initialize_managers()
            return await self._start_task_execution(task_id, timeout_minutes)
        
        # Tool 6.6: Get Execution Status  
        @self.mcp_server.tool()
        async def get_execution_status(
            execution_id: str
        ) -> Dict[str, Any]:
            """Get the status of an ongoing or completed execution."""
            self.initialize_managers()
            return await self._get_execution_status(execution_id)
        
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
        
        # Tool 15: Get Project Info (bonus tool for project awareness)
        @self.mcp_server.tool()
        async def get_project_info() -> Dict[str, Any]:
            """Get information about the current project context."""
            return {
                "success": True,
                "project": {
                    "name": self.project_root.name,
                    "path": str(self.project_root),
                    "vespera_dir": str(self.vespera_dir),
                    "database_path": str(self.vespera_dir / "tasks.db")
                }
            }
        
        # Rust-powered file operation tools (Tools 16-21)
        if RUST_FILE_OPS_AVAILABLE:
            
            # Tool 16: MCP Read File (Rust-powered)
            @self.mcp_server.tool()
            async def mcp_read_file(path: str) -> Dict[str, Any]:
                """High-performance file reading with automatic artifact creation for RAG system."""
                try:
                    content = vespera_file_ops.read_file_string(path)
                    
                    # Create artifact for RAG system integration
                    artifact_info = {
                        "path": path,
                        "content_length": len(content),
                        "created_at": datetime.now().isoformat(),
                        "source": "rust_file_ops"
                    }
                    
                    return {
                        "success": True,
                        "content": content,
                        "artifact": artifact_info,
                        "message": f"Successfully read {len(content)} characters from {path}"
                    }
                except Exception as e:
                    return {"success": False, "error": str(e), "path": path}
            
            # Tool 17: MCP Write File (Rust-powered)
            @self.mcp_server.tool()
            async def mcp_write_file(path: str, content: str, atomic: bool = True) -> Dict[str, Any]:
                """High-performance file writing with atomic operations."""
                try:
                    if atomic:
                        vespera_file_ops.write_file_atomic(path, content)
                    else:
                        vespera_file_ops.write_file_string(path, content)
                    
                    # Create artifact for the written file
                    artifact_info = {
                        "path": path,
                        "content_length": len(content),
                        "atomic": atomic,
                        "created_at": datetime.now().isoformat(),
                        "source": "rust_file_ops"
                    }
                    
                    return {
                        "success": True,
                        "path": path,
                        "bytes_written": len(content.encode('utf-8')),
                        "atomic": atomic,
                        "artifact": artifact_info,
                        "message": f"Successfully wrote {len(content)} characters to {path}"
                    }
                except Exception as e:
                    return {"success": False, "error": str(e), "path": path}
            
            # Tool 18: MCP Append File (Rust-powered)
            @self.mcp_server.tool()
            async def mcp_append_file(path: str, content: str) -> Dict[str, Any]:
                """High-performance file appending."""
                try:
                    vespera_file_ops.append_file(path, content)
                    
                    artifact_info = {
                        "path": path,
                        "content_length": len(content),
                        "operation": "append",
                        "created_at": datetime.now().isoformat(),
                        "source": "rust_file_ops"
                    }
                    
                    return {
                        "success": True,
                        "path": path,
                        "bytes_appended": len(content.encode('utf-8')),
                        "artifact": artifact_info,
                        "message": f"Successfully appended {len(content)} characters to {path}"
                    }
                except Exception as e:
                    return {"success": False, "error": str(e), "path": path}
            
            # Tool 19: MCP List Files (Rust-powered)
            @self.mcp_server.tool()
            async def mcp_list_files(directory: str, pattern: str = "*") -> Dict[str, Any]:
                """High-performance file listing with glob patterns."""
                try:
                    files = vespera_file_ops.glob_files(directory, pattern)
                    
                    artifact_info = {
                        "directory": directory,
                        "pattern": pattern,
                        "file_count": len(files),
                        "created_at": datetime.now().isoformat(),
                        "source": "rust_file_ops"
                    }
                    
                    return {
                        "success": True,
                        "directory": directory,
                        "pattern": pattern,
                        "files": files,
                        "count": len(files),
                        "artifact": artifact_info,
                        "message": f"Found {len(files)} files matching '{pattern}' in {directory}"
                    }
                except Exception as e:
                    return {"success": False, "error": str(e), "directory": directory, "pattern": pattern}
            
            # Tool 20: MCP File Info (Rust-powered)
            @self.mcp_server.tool()
            async def mcp_file_info(path: str) -> Dict[str, Any]:
                """Get detailed file information with high performance."""
                try:
                    size, is_file, is_dir = vespera_file_ops.get_file_info(path)
                    
                    artifact_info = {
                        "path": path,
                        "size": size,
                        "is_file": is_file,
                        "is_dir": is_dir,
                        "created_at": datetime.now().isoformat(),
                        "source": "rust_file_ops"
                    }
                    
                    return {
                        "success": True,
                        "path": path,
                        "size": size,
                        "is_file": is_file,
                        "is_dir": is_dir,
                        "artifact": artifact_info,
                        "message": f"File info for {path}: {size} bytes, file={is_file}, dir={is_dir}"
                    }
                except Exception as e:
                    return {"success": False, "error": str(e), "path": path}
            
            # Tool 21: MCP Read File Lines (Rust-powered)
            @self.mcp_server.tool()
            async def mcp_read_file_lines(path: str) -> Dict[str, Any]:
                """High-performance line-by-line file reading with automatic artifact creation."""
                try:
                    lines = vespera_file_ops.read_file_lines(path)
                    
                    artifact_info = {
                        "path": path,
                        "line_count": len(lines),
                        "total_characters": sum(len(line) for line in lines),
                        "created_at": datetime.now().isoformat(),
                        "source": "rust_file_ops"
                    }
                    
                    return {
                        "success": True,
                        "path": path,
                        "lines": lines,
                        "line_count": len(lines),
                        "artifact": artifact_info,
                        "message": f"Successfully read {len(lines)} lines from {path}"
                    }
                except Exception as e:
                    return {"success": False, "error": str(e), "path": path}
            
            hook_tool_count = 23 + 7  # 23 existing + 7 hook agent tools
            logger.info(f"✅ MCP Server '{server_name}' configured with {hook_tool_count} tools (17 task management + 6 Rust file operations + 7 hook agent tools)")
        else:
            hook_tool_count = 17 + 7  # 17 existing + 7 hook agent tools
            logger.info(f"✅ MCP Server '{server_name}' configured with {hook_tool_count} tools (17 task management + 7 hook agent tools)")
        
        # Hook Agent Tools (Tools 24-30 or 18-24 depending on Rust availability)
        
        # Hook Agent Tool 1: Register Hook Agent
        @self.mcp_server.tool()
        async def register_hook_agent(input_data: HookAgentInput) -> Dict[str, Any]:
            """Register a hook agent from template automation rules."""
            self.initialize_managers()
            return await self.hook_integration.register_hook_agent(input_data)
        
        # Hook Agent Tool 2: Register Timed Agent
        @self.mcp_server.tool()
        async def register_timed_agent(input_data: TimedAgentInput) -> Dict[str, Any]:
            """Register a timed agent from template automation rules."""
            self.initialize_managers()
            return await self.hook_integration.register_timed_agent(input_data)
        
        # Hook Agent Tool 3: Trigger Hook Agent
        @self.mcp_server.tool()
        async def trigger_hook_agent(input_data: HookTriggerInput) -> Dict[str, Any]:
            """Manually trigger a hook agent execution."""
            self.initialize_managers()
            return await self.hook_integration.trigger_hook_agent(input_data)
        
        # Hook Agent Tool 4: Get Hook Agent Status
        @self.mcp_server.tool()
        async def get_hook_agent_status() -> Dict[str, Any]:
            """Get status of all hook agents and timed agents."""
            self.initialize_managers()
            return await self.hook_integration.get_hook_agent_status()
        
        # Hook Agent Tool 5: Pause Timed Agent
        @self.mcp_server.tool()
        async def pause_timed_agent(agent_id: str) -> Dict[str, Any]:
            """Pause a timed agent."""
            self.initialize_managers()
            return await self.hook_integration.pause_timed_agent(agent_id)
        
        # Hook Agent Tool 6: Resume Timed Agent
        @self.mcp_server.tool()
        async def resume_timed_agent(agent_id: str) -> Dict[str, Any]:
            """Resume a paused timed agent."""
            self.initialize_managers()
            return await self.hook_integration.resume_timed_agent(agent_id)
        
        # Hook Agent Tool 7: Get Comprehensive Agent Status
        @self.mcp_server.tool()
        async def get_comprehensive_agent_status() -> Dict[str, Any]:
            """Get comprehensive status including performance metrics for all agents."""
            self.initialize_managers()
            return await self.hook_integration.get_comprehensive_agent_status()
    
    # Implementation methods for MCP tools (comprehensive implementations)
    async def _create_task_recursive(self, task_input: TaskInput, parent_id: Optional[str] = None) -> Dict[str, Any]:
        """Recursively create a task and its subtasks."""
        try:
            # Convert priority string to enum
            priority = TaskPriority.NORMAL
            if task_input.priority:
                priority = TaskPriority(task_input.priority.lower())
            
            # Use parent_id from parameter if provided, otherwise from input
            actual_parent_id = parent_id or task_input.parent_id
            
            # Use project name if no project_id specified
            project_id = task_input.project_id or self.project_root.name
            
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
                project_id=project_id,
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
                    if "task" in subtask_result:
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
            
            # Use current project if no project_id specified
            if not project_id:
                project_id = self.project_root.name
            
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
                "project": self.project_root.name,
                "message": f"Retrieved {len(tasks)} tasks for project {self.project_root.name}"
            }
            
        except Exception as e:
            logger.exception("Error listing tasks")
            return {"success": False, "error": str(e)}
    
    async def _get_task(self, task_id: str):
        """Get task by ID."""
        try:
            task = await self.task_manager.task_service.get_task(task_id)
            if task:
                return {"success": True, "task": task, "project": self.project_root.name}
            else:
                return {"success": False, "error": f"Task {task_id} not found in project {self.project_root.name}"}
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
                updates["status"] = update_input.status.lower()  # TaskService handles string conversion
            if update_input.priority is not None:
                updates["priority"] = update_input.priority.lower()  # TaskService handles string conversion
            if update_input.role is not None:
                updates["execution"] = {"assigned_role": update_input.role}
            
            success, result = await self.task_manager.task_service.update_task(update_input.task_id, updates)
            return {
                "success": success, 
                "task": result.get("task") if success else None, 
                "error": result.get("message") if not success else None,
                "project": self.project_root.name
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _delete_task(self, task_id: str, delete_subtasks: bool):
        """Delete task."""
        try:
            success, result = await self.task_manager.task_service.delete_task(task_id, recursive=delete_subtasks)
            return {
                "success": success, 
                "message": result.get("message", "Task deleted"),
                "project": self.project_root.name
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _execute_task(self, task_id, project_id, dry_run):
        """Execute task."""
        try:
            # Use current project if no project_id specified
            if not project_id:
                project_id = self.project_root.name
                
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
                    return {"success": False, "error": f"No available tasks to execute in project {project_id}"}
                task = tasks[0]
                task_id = task["id"]
            
            if dry_run:
                return {
                    "success": True, 
                    "task": task, 
                    "message": f"Dry run - task would be executed in project {project_id}",
                    "project": self.project_root.name
                }
            
            # Execute the task
            result = await self.task_manager.execute_task(task_id)
            return {
                "success": True, 
                "execution_result": result,
                "project": self.project_root.name
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _start_task_execution(self, task_id: str, timeout_minutes: int):
        """Start task execution asynchronously and return execution_id immediately."""
        try:
            result = await self.task_manager.start_task_execution(
                task_id=task_id, 
                timeout_minutes=timeout_minutes
            )
            
            # Add project context to response
            result["project"] = self.project_root.name
            return result
            
        except Exception as e:
            logger.error(f"Failed to start task execution: {e}")
            return {
                "success": False,
                "error": str(e),
                "task_id": task_id,
                "project": self.project_root.name
            }
    
    async def _get_execution_status(self, execution_id: str):
        """Get the status of an ongoing or completed execution."""
        try:
            result = await self.task_manager.get_execution_status(execution_id)
            
            # Add project context to response
            result["project"] = self.project_root.name
            return result
            
        except Exception as e:
            logger.error(f"Failed to get execution status: {e}")
            return {
                "success": False,
                "error": str(e),
                "execution_id": execution_id,
                "project": self.project_root.name
            }

    async def _complete_task(self, task_id: str, output: Optional[str], artifacts: Optional[List[str]]):
        """Complete task."""
        try:
            from datetime import datetime
            
            # First verify task exists (like get_task does)
            task = await self.task_manager.task_service.get_task(task_id)
            if not task:
                return {"success": False, "error": f"Task {task_id} not found in project {self.project_root.name}"}
            
            # Prepare updates  
            updates = {
                "status": "done", 
                "completed_at": datetime.now()
            }
            
            # Call update_task and get detailed error info
            success, result = await self.task_manager.task_service.update_task(task_id, updates)
            
            if success:
                updated_task = result.get("task")
                return {
                    "success": True,
                    "task": updated_task,
                    "message": f"Task '{task.title}' completed successfully",
                    "project": self.project_root.name
                }
            else:
                error_msg = result.get("error", "Unknown error during task update")
                return {
                    "success": False,
                    "error": f"Failed to complete task {task_id}: {error_msg}",
                    "project": self.project_root.name
                }
                
        except Exception as e:
            return {
                "success": False, 
                "error": f"Exception in complete_task: {str(e)}", 
                "project": self.project_root.name
            }
    
    async def _get_task_dashboard(self, project_id: Optional[str]):
        """Get task dashboard."""
        try:
            # Use current project if no project_id specified
            if not project_id:
                project_id = self.project_root.name
                
            # Get basic dashboard data
            all_tasks = await self.task_manager.task_service.list_tasks(project_id=project_id)
            
            status_counts = {}
            priority_counts = {}
            for task in all_tasks:
                status = task.get('status', 'unknown') if isinstance(task, dict) else task.status.value
                priority = task.get('priority', 'unknown') if isinstance(task, dict) else task.priority.value
                status_counts[status] = status_counts.get(status, 0) + 1
                priority_counts[priority] = priority_counts.get(priority, 0) + 1
            
            dashboard = {
                "total_tasks": len(all_tasks),
                "status_breakdown": status_counts,
                "priority_breakdown": priority_counts,
                "project_id": project_id,
                "generated_at": datetime.now().isoformat()
            }
            
            return {
                "success": True, 
                "dashboard": dashboard,
                "project": self.project_root.name
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _create_task_tree(self, tree_title: str, tree_description: str, subtasks: List[TaskInput], project_id: Optional[str]):
        """Create task tree."""
        try:
            # Use current project if no project_id specified
            if not project_id:
                project_id = self.project_root.name
                
            # Create root task
            root_task = TaskInput(
                title=tree_title,
                description=tree_description,
                project_id=project_id,
                subtasks=subtasks
            )
            
            result = await self._create_task_recursive(root_task)
            if result["success"]:
                result["project"] = self.project_root.name
            return result
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _get_task_tree(self, task_id: str, max_depth: int):
        """Get task tree structure."""
        try:
            tree = await self.task_manager.task_service.get_task_tree(task_id)
            return {
                "success": True, 
                "tree": tree,
                "project": self.project_root.name
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _list_roles(self):
        """List all roles."""
        try:
            roles = self.role_manager.list_roles()
            role_details = []
            for role_name in roles:
                # Get basic role info since get_role_info doesn't exist
                role_details.append({
                    "name": role_name,
                    "description": f"Role: {role_name}",
                    "capabilities": "Standard role capabilities"
                })
            return {
                "success": True, 
                "roles": role_details,
                "count": len(roles),
                "project": self.project_root.name
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _assign_role_to_task(self, task_id: str, role_name: str):
        """Assign role to task."""
        try:
            updates = {"execution": {"assigned_role": role_name}}
            success, result = await self.task_manager.task_service.update_task(task_id, updates)
            return {
                "success": success, 
                "task": result.get("task") if success else None,
                "project": self.project_root.name
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _add_task_dependency(self, task_id: str, depends_on_task_id: str, dependency_type: str):
        """Add task dependency."""
        try:
            relation_type = TaskRelation(dependency_type.lower()) if dependency_type else TaskRelation.BLOCKS
            success = await self.task_manager.task_service.add_task_relationship(
                task_id, depends_on_task_id, relation_type
            )
            return {
                "success": success, 
                "message": "Dependency added" if success else "Failed to add dependency",
                "project": self.project_root.name
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _analyze_task_dependencies(self, task_id: str):
        """Analyze task dependencies."""
        try:
            task = await self.task_manager.task_service.get_task(task_id)
            if not task:
                return {"success": False, "error": f"Task {task_id} not found"}
            
            # Basic dependency analysis
            analysis = {
                "task_id": task_id,
                "task_title": task.title,
                "dependencies": {
                    "blocks": len(task.related_task_ids.get("blocks", [])),
                    "depends_on": len(task.related_task_ids.get("depends_on", [])),
                    "relates_to": len(task.related_task_ids.get("relates_to", [])),
                },
                "related_tasks": task.related_task_ids,
                "can_execute": len(task.related_task_ids.get("depends_on", [])) == 0
            }
            
            return {
                "success": True, 
                "analysis": analysis,
                "project": self.project_root.name
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def handle_websocket_message(self, message: str) -> str:
        """Handle WebSocket messages for Obsidian plugin integration."""
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
                        "serverInfo": {
                            "name": f"vespera-{self.project_root.name}", 
                            "version": "2.0.0"
                        },
                        "capabilities": {"tools": True, "resources": False, "prompts": False},
                        "projectInfo": {
                            "name": self.project_root.name,
                            "path": str(self.project_root),
                            "vesperaDir": str(self.vespera_dir)
                        }
                    }
                })
            
            elif method == 'tools/call':
                # Handle WebSocket tool calls by routing to MCP tool implementations
                tool_name = params.get('name')
                tool_args = params.get('arguments', {})
                
                # Route to appropriate tool implementation
                if tool_name == 'create_task':
                    task_input_data = tool_args.get('task_input', tool_args)
                    task_input = TaskInput(**task_input_data)
                    result = await self._create_task_recursive(task_input)
                elif tool_name == 'list_tasks':
                    result = await self._list_tasks(
                        tool_args.get('status_filter'),
                        tool_args.get('priority_filter'),
                        tool_args.get('project_id'),
                        tool_args.get('assignee'),
                        tool_args.get('parent_id'),
                        tool_args.get('limit', 50)
                    )
                elif tool_name == 'get_task_dashboard':
                    result = await self._get_task_dashboard(tool_args.get('project_id'))
                else:
                    result = {"success": False, "error": f"Unknown tool: {tool_name}"}
                
                return json.dumps({
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "result": result
                })
            
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
        """Start WebSocket server for Obsidian plugin integration."""
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
            logger.info(f"   Project: {self.project_root.name}")
            return self.websocket_server
        
        except ImportError:
            logger.error("websockets library not installed. Run: pip install websockets")
            raise
    
    async def run_mcp_mode(self):
        """Run in pure MCP mode (stdio) for Claude Code integration."""
        logger.info(f"🚀 Starting Vespera Server in MCP mode for project: {self.project_root.name}")
        self.setup_mcp_server()
        await self.mcp_server.run()
    
    async def run_websocket_mode(self, port: int = 8000):
        """Run in WebSocket mode for Obsidian plugin integration."""
        logger.info(f"🚀 Starting Vespera Server in WebSocket mode for project: {self.project_root.name}")
        self.initialize_managers()
        server = await self.start_websocket_server(port)
        await server.wait_closed()
    
    async def run_dual_mode(self, websocket_port: int = 8000):
        """Run both MCP (stdio) and WebSocket servers simultaneously."""
        logger.info(f"🚀 Starting Vespera Server in DUAL mode for project: {self.project_root.name}")
        self.setup_mcp_server()
        self.initialize_managers()
        
        # Start WebSocket server in background
        await self.start_websocket_server(websocket_port)
        
        # Run MCP server (handles stdio)
        await self.mcp_server.run()


async def main():
    """Main entry point with intelligent project detection."""
    parser = argparse.ArgumentParser(description='Vespera Server - Unified task orchestration')
    parser.add_argument('--mode', choices=['mcp', 'websocket', 'dual'], 
                        default='mcp', help='Server mode')
    parser.add_argument('--port', type=int, default=8000, 
                        help='WebSocket port (websocket/dual mode)')
    parser.add_argument('--cwd', type=str, default=None,
                        help='Working directory for project detection')
    parser.add_argument('--vault', type=str, default=None,
                        help='Obsidian vault path for project detection')
    
    args = parser.parse_args()
    
    # Create server with intelligent project detection
    server = VesperaServer(cwd=args.cwd, vault_path=args.vault)
    
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
    # Handle MCP stdio mode properly for Claude Code integration
    import sys
    
    # Check if running in MCP mode (default behavior for Claude Code)
    if len(sys.argv) == 1 or (len(sys.argv) > 1 and ('--mode' not in sys.argv or 'mcp' in sys.argv)):
        # MCP stdio mode - let Claude Code handle the event loop
        parser = argparse.ArgumentParser(description='Vespera Server - Unified task orchestration')
        parser.add_argument('--mode', choices=['mcp', 'websocket', 'dual'], 
                            default='mcp', help='Server mode')
        parser.add_argument('--cwd', type=str, default=None,
                            help='Working directory for project detection')
        parser.add_argument('--vault', type=str, default=None,
                            help='Obsidian vault path for project detection')
        
        args, _ = parser.parse_known_args()
        
        # Create server with intelligent project detection
        server = VesperaServer(cwd=args.cwd, vault_path=args.vault)
        
        # Setup and run MCP server (FastMCP handles event loop properly)
        server.setup_mcp_server()
        server.mcp_server.run()
    else:
        # WebSocket or dual mode - use asyncio.run()
        asyncio.run(main())