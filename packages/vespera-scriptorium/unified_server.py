#!/usr/bin/env python3
"""
Unified Vespera Server - Supports both MCP (stdio) and WebSocket protocols

This server can run in two modes:
1. MCP mode: stdio protocol for Claude Code integration
2. WebSocket mode: WebSocket server for Obsidian plugin integration
3. Dual mode: Both protocols simultaneously (different ports/transports)
"""

import sys
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

class VesperaUnifiedServer:
    def __init__(self):
        self.task_manager: Optional[TaskManager] = None
        self.role_manager: Optional[RoleManager] = None
        self.v2_data_dir: Optional[Path] = None
        self.mcp_server: Optional[FastMCP] = None
        self.websocket_server = None
        self.mode = "mcp"  # Default to MCP mode
        
    def initialize_managers(self):
        """Initialize shared managers used by both protocols."""
        if self.task_manager is None:
            project_root = Path.cwd()
            self.v2_data_dir = project_root / ".vespera_v2"
            self.v2_data_dir.mkdir(parents=True, exist_ok=True)
            
            self.role_manager = RoleManager(project_root)
            logger.info("✅ Role Manager initialized")
            
            task_service = TaskService(self.v2_data_dir / "tasks.db")
            self.task_manager = TaskManager(task_service, self.role_manager)
            logger.info("✅ Task Manager initialized")
    
    def setup_mcp_server(self):
        """Setup MCP server with all tools."""
        self.mcp_server = FastMCP("vespera-v2-tasks")
        
        # Add all the MCP tools here (copied from mcp_server_v2.py)
        @self.mcp_server.tool()
        def create_task(task_input: dict) -> dict:
            """Create a new task in the system."""
            self.initialize_managers()
            try:
                result = self.task_manager.create_task(
                    title=task_input.get('title', ''),
                    description=task_input.get('description', ''),
                    priority=TaskPriority(task_input.get('priority', 'medium')),
                    project_id=task_input.get('project_id'),
                    feature=task_input.get('feature'),
                    metadata=task_input.get('metadata', {})
                )
                return {"success": True, "task": result}
            except Exception as e:
                logger.error(f"Error creating task: {e}")
                return {"success": False, "error": str(e)}
        
        # Add more tools as needed...
        
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

def main():
    """Main entry point with mode selection."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Vespera Unified Server')
    parser.add_argument('--mode', choices=['mcp', 'websocket', 'dual'], 
                        default='mcp', help='Server mode')
    parser.add_argument('--port', type=int, default=8000, 
                        help='WebSocket port (websocket/dual mode)')
    
    args = parser.parse_args()
    
    server = VesperaUnifiedServer()
    server.mode = args.mode
    
    try:
        if args.mode == 'mcp':
            asyncio.run(server.run_mcp_mode())
        elif args.mode == 'websocket':
            asyncio.run(server.run_websocket_mode(args.port))
        elif args.mode == 'dual':
            asyncio.run(server.run_dual_mode(args.port))
    except KeyboardInterrupt:
        logger.info("Server shutdown requested")
    except Exception as e:
        logger.error(f"Server error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()