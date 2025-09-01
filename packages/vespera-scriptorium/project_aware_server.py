#!/usr/bin/env python3
"""
Project-Aware Vespera Server

This server detects and uses per-project databases and configurations,
allowing multiple instances to run simultaneously for different projects.
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

from tasks import TaskManager, TaskService, TaskStatus, TaskPriority, TaskRelation, TaskMetadata
from roles import RoleManager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ProjectDetector:
    """Detects project root and configuration based on context."""
    
    @staticmethod
    def find_project_root(start_path: Path = None) -> Path:
        """
        Find project root by looking for project markers.
        
        Searches upward from start_path for:
        1. .git directory
        2. .vespera_v2 directory  
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

class ProjectAwareServer:
    """Server that initializes based on detected project context."""
    
    def __init__(self, project_root: Path = None, server_mode: str = "mcp"):
        self.project_root = project_root or ProjectDetector.find_project_root()
        self.vespera_dir = ProjectDetector.get_vespera_dir(self.project_root)
        self.server_mode = server_mode
        
        self.task_manager: Optional[TaskManager] = None
        self.role_manager: Optional[RoleManager] = None
        self.mcp_server: Optional[FastMCP] = None
        self.websocket_server = None
        
        logger.info(f"🎯 Project-aware server initialized:")
        logger.info(f"   Project root: {self.project_root}")
        logger.info(f"   Vespera dir: {self.vespera_dir}")
        logger.info(f"   Server mode: {self.server_mode}")
    
    def initialize_managers(self):
        """Initialize project-specific managers."""
        if self.task_manager is None:
            # Use project-specific paths
            self.role_manager = RoleManager(self.project_root)
            logger.info(f"✅ Role Manager initialized for project: {self.project_root.name}")
            
            # Create project-specific database
            task_db_path = self.vespera_dir / "tasks.db"
            task_service = TaskService(task_db_path)
            self.task_manager = TaskManager(self.project_root, self.role_manager)
            self.task_manager.task_service = task_service
            
            logger.info(f"✅ Task Manager initialized with database: {task_db_path}")
            logger.info(f"   Project: {self.project_root.name}")
            logger.info(f"   Database: {task_db_path}")
    
    def setup_mcp_server(self):
        """Setup MCP server with project context."""
        server_name = f"vespera-{self.project_root.name}"
        self.mcp_server = FastMCP(server_name)
        
        # Simple task creation tool (we can expand this later)
        @self.mcp_server.tool()
        def create_task(title: str, description: str = "", priority: str = "medium") -> dict:
            """Create a new task in the current project."""
            self.initialize_managers()
            try:
                priority_enum = TaskPriority(priority.lower())
                result = asyncio.run(self.task_manager.task_service.create_task(
                    title=title,
                    description=description,
                    priority=priority_enum,
                    project_id=self.project_root.name
                ))
                
                if result[0]:  # success
                    return {"success": True, "task": result[1]["task"]}
                else:
                    return {"success": False, "error": result[1].get("message", "Failed to create task")}
            except Exception as e:
                logger.error(f"Error creating task: {e}")
                return {"success": False, "error": str(e)}
        
        @self.mcp_server.tool()
        def list_tasks() -> dict:
            """List tasks in the current project."""
            self.initialize_managers()
            try:
                result = asyncio.run(self.task_manager.task_service.list_tasks(
                    project_id=self.project_root.name
                ))
                return {"success": True, "tasks": result}
            except Exception as e:
                logger.error(f"Error listing tasks: {e}")
                return {"success": False, "error": str(e)}
        
        @self.mcp_server.tool()
        def get_project_info() -> dict:
            """Get information about the current project."""
            return {
                "project_name": self.project_root.name,
                "project_path": str(self.project_root),
                "vespera_dir": str(self.vespera_dir),
                "database_path": str(self.vespera_dir / "tasks.db")
            }
        
        logger.info(f"✅ MCP Server '{server_name}' configured")
    
    async def handle_websocket_message(self, message: str) -> str:
        """Handle WebSocket messages for Obsidian integration."""
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
                tool_name = params.get('name')
                tool_args = params.get('arguments', {})
                
                if tool_name == 'create_task':
                    task_input = tool_args.get('task_input', {})
                    try:
                        priority_enum = TaskPriority(task_input.get('priority', 'medium').lower())
                        result = await self.task_manager.task_service.create_task(
                            title=task_input.get('title', ''),
                            description=task_input.get('description', ''),
                            priority=priority_enum,
                            project_id=self.project_root.name
                        )
                        
                        if result[0]:  # success
                            return json.dumps({
                                "jsonrpc": "2.0",
                                "id": request_id,
                                "result": {"success": True, "task": result[1]["task"]}
                            })
                        else:
                            return json.dumps({
                                "jsonrpc": "2.0",
                                "id": request_id,
                                "result": {"success": False, "error": result[1].get("message")}
                            })
                    except Exception as e:
                        return json.dumps({
                            "jsonrpc": "2.0",
                            "id": request_id,
                            "result": {"success": False, "error": str(e)}
                        })
                
                elif tool_name == 'list_tasks':
                    try:
                        tasks = await self.task_manager.task_service.list_tasks(
                            project_id=self.project_root.name
                        )
                        return json.dumps({
                            "jsonrpc": "2.0",
                            "id": request_id,
                            "result": {"success": True, "tasks": tasks}
                        })
                    except Exception as e:
                        return json.dumps({
                            "jsonrpc": "2.0",
                            "id": request_id,
                            "result": {"success": False, "error": str(e)}
                        })
                
                elif tool_name == 'get_project_info':
                    return json.dumps({
                        "jsonrpc": "2.0",
                        "id": request_id,
                        "result": {
                            "project_name": self.project_root.name,
                            "project_path": str(self.project_root),
                            "vespera_dir": str(self.vespera_dir),
                            "database_path": str(self.vespera_dir / "tasks.db")
                        }
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
        """Start WebSocket server for Obsidian integration."""
        try:
            import websockets
            
            async def websocket_handler(websocket):
                logger.info(f"New WebSocket connection from {websocket.remote_address}")
                logger.info(f"   Project: {self.project_root.name}")
                logger.info(f"   Database: {self.vespera_dir / 'tasks.db'}")
                
                try:
                    async for message in websocket:
                        response = await self.handle_websocket_message(message)
                        await websocket.send(response)
                except websockets.exceptions.ConnectionClosed:
                    logger.info(f"WebSocket connection closed for project: {self.project_root.name}")
                except Exception as e:
                    logger.error(f"WebSocket error: {e}")
            
            self.websocket_server = await websockets.serve(websocket_handler, "0.0.0.0", port)
            logger.info(f"🌐 Project WebSocket server running on ws://0.0.0.0:{port}")
            logger.info(f"   Project: {self.project_root.name}")
            logger.info(f"   Database: {self.vespera_dir / 'tasks.db'}")
            return self.websocket_server
        
        except ImportError:
            logger.error("websockets library not installed. Run: pip install websockets")
            raise
    
    async def run_mcp_mode(self):
        """Run in MCP mode (stdio) for Claude Code."""
        logger.info(f"🚀 Starting project-aware MCP server...")
        logger.info(f"   Project: {self.project_root.name}")
        logger.info(f"   Database: {self.vespera_dir / 'tasks.db'}")
        
        self.setup_mcp_server()
        await self.mcp_server.run()
    
    async def run_websocket_mode(self, port: int = 8000):
        """Run in WebSocket mode for Obsidian."""
        logger.info(f"🚀 Starting project-aware WebSocket server...")
        logger.info(f"   Project: {self.project_root.name}")
        logger.info(f"   Database: {self.vespera_dir / 'tasks.db'}")
        logger.info(f"   Port: {port}")
        
        self.initialize_managers()
        server = await self.start_websocket_server(port)
        await server.wait_closed()

def main():
    """Main entry point with project detection."""
    parser = argparse.ArgumentParser(description='Project-Aware Vespera Server')
    parser.add_argument('--mode', choices=['mcp', 'websocket'], 
                        default='mcp', help='Server mode')
    parser.add_argument('--port', type=int, default=8000, 
                        help='WebSocket port (websocket mode)')
    parser.add_argument('--project', type=str, 
                        help='Project root path (auto-detected if not specified)')
    parser.add_argument('--vault', type=str, 
                        help='Obsidian vault path for project detection')
    parser.add_argument('--cwd', type=str,
                        help='Working directory for project detection')
    
    args = parser.parse_args()
    
    # Determine project root based on context
    if args.project:
        project_root = Path(args.project).resolve()
    elif args.vault:
        project_root = ProjectDetector.detect_from_obsidian_vault(args.vault)
    elif args.cwd:
        project_root = ProjectDetector.detect_from_working_dir(args.cwd)
    else:
        project_root = ProjectDetector.find_project_root()
    
    # Create project-aware server
    server = ProjectAwareServer(project_root, args.mode)
    
    try:
        if args.mode == 'mcp':
            asyncio.run(server.run_mcp_mode())
        elif args.mode == 'websocket':
            asyncio.run(server.run_websocket_mode(args.port))
    except KeyboardInterrupt:
        logger.info(f"Server shutdown requested for project: {project_root.name}")
    except Exception as e:
        logger.error(f"Server error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()