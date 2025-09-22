"""
WebSocket Support for Real-time Updates

Provides real-time task updates and notifications to connected plugins.
"""

import logging
import json
import asyncio
from typing import Dict, List, Any, Optional, Set
from datetime import datetime
from fastapi import WebSocket, WebSocketDisconnect, Depends, Query, HTTPException
from fastapi.routing import APIRouter

from api.middleware.auth import verify_plugin_token
from api.models.responses import WebSocketMessage

logger = logging.getLogger(__name__)

# WebSocket connection manager
class ConnectionManager:
    """Manages WebSocket connections for real-time updates."""
    
    def __init__(self):
        # Active connections: {plugin_id: websocket}
        self.active_connections: Dict[str, WebSocket] = {}
        
        # Plugin subscriptions: {plugin_id: set of event types}
        self.subscriptions: Dict[str, Set[str]] = {}
        
        # Connection metadata: {plugin_id: metadata}
        self.connection_metadata: Dict[str, Dict[str, Any]] = {}
    
    async def connect(self, websocket: WebSocket, plugin_id: str, plugin_context: Dict[str, Any]):
        """Accept a WebSocket connection and register the plugin."""
        await websocket.accept()
        
        # Store connection
        self.active_connections[plugin_id] = websocket
        self.connection_metadata[plugin_id] = {
            "plugin_type": plugin_context.get("plugin_type"),
            "plugin_name": plugin_context.get("plugin_name"),
            "connected_at": datetime.now().isoformat(),
            "last_ping": datetime.now().isoformat()
        }
        
        # Default subscriptions based on plugin type
        plugin_type = plugin_context.get("plugin_type", "custom")
        default_subscriptions = {
            "vscode": {"task.created", "task.updated", "task.completed", "file.changed"},
            "obsidian": {"task.created", "task.updated", "task.completed", "note.linked"},
            "custom": {"task.updated", "task.completed"}
        }
        
        self.subscriptions[plugin_id] = default_subscriptions.get(plugin_type, {"task.updated"})
        
        logger.info(f"WebSocket connected: {plugin_id} ({plugin_type})")
        
        # Send welcome message
        welcome_message = {
            "type": "connection.established",
            "timestamp": datetime.now().isoformat(),
            "data": {
                "plugin_id": plugin_id,
                "subscriptions": list(self.subscriptions[plugin_id]),
                "server_version": "2.0.0"
            }
        }
        await self.send_personal_message(welcome_message, plugin_id)
    
    def disconnect(self, plugin_id: str):
        """Disconnect and cleanup plugin connection."""
        if plugin_id in self.active_connections:
            del self.active_connections[plugin_id]
        if plugin_id in self.subscriptions:
            del self.subscriptions[plugin_id]
        if plugin_id in self.connection_metadata:
            del self.connection_metadata[plugin_id]
        
        logger.info(f"WebSocket disconnected: {plugin_id}")
    
    async def send_personal_message(self, message: Dict[str, Any], plugin_id: str):
        """Send a message to a specific plugin."""
        if plugin_id in self.active_connections:
            try:
                websocket = self.active_connections[plugin_id]
                await websocket.send_text(json.dumps(message))
                
                # Update last activity
                if plugin_id in self.connection_metadata:
                    self.connection_metadata[plugin_id]["last_ping"] = datetime.now().isoformat()
                    
            except Exception as e:
                logger.error(f"Error sending message to {plugin_id}: {e}")
                # Remove dead connection
                self.disconnect(plugin_id)
    
    async def broadcast_event(self, event_type: str, data: Dict[str, Any], exclude_plugin: Optional[str] = None):
        """Broadcast an event to all subscribed plugins."""
        message = {
            "type": event_type,
            "timestamp": datetime.now().isoformat(),
            "data": data
        }
        
        # Send to all subscribed plugins
        for plugin_id, subscriptions in self.subscriptions.items():
            if exclude_plugin and plugin_id == exclude_plugin:
                continue
                
            if event_type in subscriptions:
                await self.send_personal_message(message, plugin_id)
    
    async def send_to_plugin_type(self, message: Dict[str, Any], plugin_type: str):
        """Send message to all plugins of a specific type."""
        for plugin_id, metadata in self.connection_metadata.items():
            if metadata.get("plugin_type") == plugin_type:
                await self.send_personal_message(message, plugin_id)
    
    def get_connection_stats(self) -> Dict[str, Any]:
        """Get statistics about active connections."""
        plugin_types = {}
        for metadata in self.connection_metadata.values():
            plugin_type = metadata.get("plugin_type", "unknown")
            plugin_types[plugin_type] = plugin_types.get(plugin_type, 0) + 1
        
        return {
            "total_connections": len(self.active_connections),
            "connections_by_type": plugin_types,
            "active_plugins": list(self.active_connections.keys())
        }
    
    async def ping_all_connections(self):
        """Send ping to all connections to check health."""
        ping_message = {
            "type": "ping",
            "timestamp": datetime.now().isoformat(),
            "data": {"server_status": "healthy"}
        }
        
        # Send ping to all connections
        dead_connections = []
        for plugin_id in list(self.active_connections.keys()):
            try:
                await self.send_personal_message(ping_message, plugin_id)
            except Exception:
                dead_connections.append(plugin_id)
        
        # Clean up dead connections
        for plugin_id in dead_connections:
            self.disconnect(plugin_id)
        
        return len(dead_connections)


# Global connection manager
manager = ConnectionManager()

# WebSocket router
router = APIRouter()


async def get_plugin_from_token(token: Optional[str] = Query(None)) -> Dict[str, Any]:
    """Extract plugin context from WebSocket query parameter token."""
    if not token:
        raise HTTPException(status_code=401, detail="Token required for WebSocket connection")
    
    # Validate token (simplified - would use proper token validation)
    if token.startswith("vsp_"):
        return {
            "plugin_id": "demo_plugin_001",
            "plugin_name": "Demo Plugin",
            "plugin_type": "vscode",
            "version": "1.0.0",
            "permissions": ["real_time_updates"]
        }
    
    raise HTTPException(status_code=401, detail="Invalid token")


@router.websocket("/ws/plugins")
async def plugin_websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(..., description="Plugin authentication token")
):
    """
    WebSocket endpoint for plugin real-time updates.
    
    Provides real-time notifications about:
    - Task status changes
    - New task assignments
    - Project updates
    - System events
    
    Usage:
    - Connect: ws://localhost:8000/ws/plugins?token=<plugin_token>
    - Subscribe to events by sending subscription messages
    - Receive real-time updates as JSON messages
    """
    
    try:
        # Validate plugin token
        plugin_context = await get_plugin_from_token(token)
        plugin_id = plugin_context["plugin_id"]
        
        # Connect to WebSocket
        await manager.connect(websocket, plugin_id, plugin_context)
        
        try:
            while True:
                # Wait for messages from client
                data = await websocket.receive_text()
                
                try:
                    message = json.loads(data)
                    await handle_client_message(message, plugin_id)
                except json.JSONDecodeError:
                    error_response = {
                        "type": "error",
                        "timestamp": datetime.now().isoformat(),
                        "data": {"error": "Invalid JSON format"}
                    }
                    await manager.send_personal_message(error_response, plugin_id)
                
        except WebSocketDisconnect:
            manager.disconnect(plugin_id)
            logger.info(f"Plugin {plugin_id} disconnected")
            
    except HTTPException as e:
        await websocket.close(code=4001, reason=e.detail)
    except Exception as e:
        logger.exception(f"WebSocket error: {e}")
        await websocket.close(code=4000, reason="Internal server error")


async def handle_client_message(message: Dict[str, Any], plugin_id: str):
    """Handle messages sent by clients (plugins)."""
    
    message_type = message.get("type")
    
    if message_type == "subscribe":
        # Handle subscription changes
        events = message.get("events", [])
        if events:
            manager.subscriptions[plugin_id].update(events)
            response = {
                "type": "subscription.updated",
                "timestamp": datetime.now().isoformat(),
                "data": {
                    "subscribed_events": list(manager.subscriptions[plugin_id])
                }
            }
            await manager.send_personal_message(response, plugin_id)
    
    elif message_type == "unsubscribe":
        # Handle unsubscription
        events = message.get("events", [])
        if events:
            manager.subscriptions[plugin_id] -= set(events)
            response = {
                "type": "subscription.updated", 
                "timestamp": datetime.now().isoformat(),
                "data": {
                    "subscribed_events": list(manager.subscriptions[plugin_id])
                }
            }
            await manager.send_personal_message(response, plugin_id)
    
    elif message_type == "pong":
        # Handle pong response
        manager.connection_metadata[plugin_id]["last_ping"] = datetime.now().isoformat()
    
    elif message_type == "get_status":
        # Send status information
        stats = manager.get_connection_stats()
        response = {
            "type": "status.response",
            "timestamp": datetime.now().isoformat(),
            "data": stats
        }
        await manager.send_personal_message(response, plugin_id)
    
    else:
        # Unknown message type
        error_response = {
            "type": "error",
            "timestamp": datetime.now().isoformat(),
            "data": {"error": f"Unknown message type: {message_type}"}
        }
        await manager.send_personal_message(error_response, plugin_id)


# Event broadcasting functions (called by other parts of the API)

async def broadcast_task_created(task_data: Dict[str, Any]):
    """Broadcast task creation event."""
    await manager.broadcast_event("task.created", {
        "task_id": task_data.get("id"),
        "title": task_data.get("title"),
        "status": task_data.get("status"),
        "priority": task_data.get("priority"),
        "created_by": task_data.get("creator"),
        "project_id": task_data.get("project_id")
    })


async def broadcast_task_updated(task_data: Dict[str, Any], changes: Dict[str, Any]):
    """Broadcast task update event."""
    await manager.broadcast_event("task.updated", {
        "task_id": task_data.get("id"),
        "title": task_data.get("title"),
        "changes": changes,
        "updated_at": task_data.get("updated_at"),
        "status": task_data.get("status"),
        "priority": task_data.get("priority")
    })


async def broadcast_task_completed(task_data: Dict[str, Any]):
    """Broadcast task completion event."""
    await manager.broadcast_event("task.completed", {
        "task_id": task_data.get("id"),
        "title": task_data.get("title"),
        "completed_at": task_data.get("completed_at"),
        "completed_by": task_data.get("assignee"),
        "project_id": task_data.get("project_id")
    })


async def broadcast_project_update(project_id: str, update_type: str, data: Dict[str, Any]):
    """Broadcast project-level updates."""
    await manager.broadcast_event(f"project.{update_type}", {
        "project_id": project_id,
        "update_type": update_type,
        "data": data,
        "timestamp": datetime.now().isoformat()
    })


async def send_plugin_notification(plugin_id: str, notification_type: str, data: Dict[str, Any]):
    """Send a direct notification to a specific plugin."""
    message = {
        "type": f"notification.{notification_type}",
        "timestamp": datetime.now().isoformat(),
        "data": data
    }
    await manager.send_personal_message(message, plugin_id)


async def broadcast_to_vscode_plugins(message_type: str, data: Dict[str, Any]):
    """Send message specifically to VS Code plugins."""
    message = {
        "type": message_type,
        "timestamp": datetime.now().isoformat(),
        "data": data
    }
    await manager.send_to_plugin_type(message, "vscode")


async def broadcast_to_obsidian_plugins(message_type: str, data: Dict[str, Any]):
    """Send message specifically to Obsidian plugins."""
    message = {
        "type": message_type,
        "timestamp": datetime.now().isoformat(),
        "data": data
    }
    await manager.send_to_plugin_type(message, "obsidian")


# Background task for connection health monitoring
async def connection_health_monitor():
    """Background task to monitor connection health."""
    while True:
        try:
            dead_connections = await manager.ping_all_connections()
            if dead_connections > 0:
                logger.info(f"Cleaned up {dead_connections} dead WebSocket connections")
            
            # Wait 30 seconds before next health check
            await asyncio.sleep(30)
            
        except Exception as e:
            logger.error(f"Error in connection health monitor: {e}")
            await asyncio.sleep(60)  # Wait longer on error


# Utility functions for integration with other API components

def get_websocket_stats() -> Dict[str, Any]:
    """Get current WebSocket connection statistics."""
    return manager.get_connection_stats()


def get_connected_plugins() -> List[str]:
    """Get list of currently connected plugin IDs."""
    return list(manager.active_connections.keys())


def is_plugin_connected(plugin_id: str) -> bool:
    """Check if a specific plugin is currently connected."""
    return plugin_id in manager.active_connections