#!/usr/bin/env python3
"""
WebSocket Bridge for MCP Server

This creates a WebSocket server that bridges to the MCP server,
allowing the Obsidian plugin to connect using WebSocket as originally designed.
"""

import asyncio
import json
import logging
import signal
import sys
import websockets
from pathlib import Path

# Add the package to path
sys.path.insert(0, str(Path(__file__).parent))

from tasks import TaskManager
from roles import RoleManager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global managers
task_manager = None
role_manager = None

async def initialize_managers():
    """Initialize the task and role managers"""
    global task_manager, role_manager
    
    if not task_manager:
        task_manager = TaskManager()
        logger.info("✅ Task Manager initialized")
    
    if not role_manager:
        role_manager = RoleManager()
        logger.info("✅ Role Manager initialized")

async def handle_mcp_request(method: str, params: dict) -> dict:
    """Handle MCP requests and return responses"""
    try:
        if method == "initialize":
            return {
                "serverInfo": {
                    "name": "vespera-v2-tasks",
                    "version": "2.0.0"
                },
                "capabilities": {
                    "tools": True,
                    "resources": False,
                    "prompts": False
                }
            }
        
        elif method == "tools/list":
            return {
                "tools": [
                    {"name": "create_task", "description": "Create a new task"},
                    {"name": "list_tasks", "description": "List existing tasks"},
                    {"name": "update_task", "description": "Update a task"},
                    {"name": "delete_task", "description": "Delete a task"},
                    {"name": "get_task_dashboard", "description": "Get task dashboard"}
                ]
            }
        
        elif method == "tools/call":
            tool_name = params.get("name")
            arguments = params.get("arguments", {})
            
            if tool_name == "create_task":
                task_input = arguments.get("task_input", {})
                task = await task_manager.create_task(
                    title=task_input.get("title", "Untitled"),
                    description=task_input.get("description", ""),
                    status=task_input.get("status", "todo"),
                    priority=task_input.get("priority", "normal"),
                    project_id=task_input.get("project_id"),
                    metadata=task_input.get("metadata", {})
                )
                return {
                    "content": [{"type": "text", "text": f"Created task: {task.title}"}],
                    "task": {
                        "id": task.id,
                        "title": task.title,
                        "description": task.description,
                        "status": task.status.value,
                        "priority": task.priority.value,
                        "created_at": task.created_at.isoformat(),
                        "updated_at": task.updated_at.isoformat()
                    }
                }
            
            elif tool_name == "list_tasks":
                tasks = await task_manager.get_all_tasks()
                task_list = []
                for task in tasks:
                    task_list.append({
                        "id": task.id,
                        "title": task.title,
                        "description": task.description,
                        "status": task.status.value,
                        "priority": task.priority.value,
                        "created_at": task.created_at.isoformat(),
                        "updated_at": task.updated_at.isoformat()
                    })
                
                return {
                    "content": [{"type": "text", "text": f"Found {len(task_list)} tasks"}],
                    "tasks": task_list
                }
            
            elif tool_name == "get_task_dashboard":
                tasks = await task_manager.get_all_tasks()
                dashboard = {
                    "total_tasks": len(tasks),
                    "status_breakdown": {},
                    "recent_tasks": []
                }
                
                # Count by status
                for task in tasks:
                    status = task.status.value
                    dashboard["status_breakdown"][status] = dashboard["status_breakdown"].get(status, 0) + 1
                
                # Recent tasks (last 5)
                recent_tasks = sorted(tasks, key=lambda t: t.updated_at, reverse=True)[:5]
                for task in recent_tasks:
                    dashboard["recent_tasks"].append({
                        "id": task.id,
                        "title": task.title,
                        "status": task.status.value,
                        "updated_at": task.updated_at.isoformat()
                    })
                
                return {
                    "content": [{"type": "text", "text": "Dashboard data retrieved"}],
                    "dashboard": dashboard
                }
            
            else:
                return {
                    "content": [{"type": "text", "text": f"Unknown tool: {tool_name}"}],
                    "isError": True
                }
        
        else:
            return {
                "error": {
                    "code": -32601,
                    "message": f"Method not found: {method}"
                }
            }
    
    except Exception as e:
        logger.error(f"Error handling request {method}: {e}")
        return {
            "error": {
                "code": -32603,
                "message": f"Internal error: {str(e)}"
            }
        }

async def handle_websocket(websocket):
    """Handle WebSocket connections"""
    logger.info(f"New WebSocket connection from {websocket.remote_address}")
    
    try:
        await initialize_managers()
        
        async for message in websocket:
            try:
                # Parse JSON-RPC message
                data = json.loads(message)
                logger.info(f"Received request: {data.get('method', 'unknown')}")
                
                # Handle the request
                result = await handle_mcp_request(data.get("method"), data.get("params", {}))
                
                # Create response
                response = {
                    "jsonrpc": "2.0",
                    "id": data.get("id")
                }
                
                if "error" in result:
                    response["error"] = result["error"]
                else:
                    response["result"] = result
                
                # Send response
                await websocket.send(json.dumps(response))
                logger.info(f"Sent response for request {data.get('id')}")
                
            except json.JSONDecodeError:
                error_response = {
                    "jsonrpc": "2.0",
                    "id": None,
                    "error": {
                        "code": -32700,
                        "message": "Parse error"
                    }
                }
                await websocket.send(json.dumps(error_response))
            
            except Exception as e:
                logger.error(f"Error processing message: {e}")
                error_response = {
                    "jsonrpc": "2.0",
                    "id": data.get("id") if 'data' in locals() else None,
                    "error": {
                        "code": -32603,
                        "message": f"Internal error: {str(e)}"
                    }
                }
                await websocket.send(json.dumps(error_response))
    
    except websockets.exceptions.ConnectionClosed:
        logger.info(f"WebSocket connection closed: {websocket.remote_address}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")

async def main():
    """Main server function"""
    logger.info("🚀 Starting Vespera WebSocket Bridge Server...")
    
    # Initialize managers
    await initialize_managers()
    
    # Start WebSocket server
    server = await websockets.serve(
        handle_websocket,
        "0.0.0.0",  # Bind to all interfaces for WSL->Windows access
        8000,
        ping_interval=20,
        ping_timeout=10
    )
    
    logger.info("🌐 WebSocket server running on ws://0.0.0.0:8000")
    logger.info("   Accessible from Windows at: ws://localhost:8000")
    logger.info("   Ready for Obsidian plugin connections!")
    
    # Set up graceful shutdown
    def signal_handler():
        logger.info("🛑 Shutting down server...")
        server.close()
    
    # Handle shutdown signals
    for sig in [signal.SIGTERM, signal.SIGINT]:
        signal.signal(sig, lambda s, f: signal_handler())
    
    # Wait for server to close
    await server.wait_closed()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("🛑 Server stopped by user")
    except Exception as e:
        logger.error(f"❌ Server error: {e}")
        sys.exit(1)