"""
Plugin Integration Router

REST API endpoints specifically designed for VS Code and Obsidian plugin integration.
Provides specialized features for editor and note-taking tool workflows.
"""

import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query, Request, Header
from fastapi.responses import JSONResponse

from api.models.requests import (
    PluginRegistrationRequest, PluginAuthRequest, WebhookRequest,
    FileContextRequest, NoteContextRequest, TaskCreateRequest
)
from api.models.responses import (
    PluginTokenResponse, PluginStatusResponse, FileContextResponse,
    NoteContextResponse, NotificationResponse, TaskCreateResponse
)
from api.utils.mcp_bridge import MCPBridge

logger = logging.getLogger(__name__)

router = APIRouter()


def get_mcp_bridge(request: Request) -> MCPBridge:
    """Dependency to get MCP bridge from app state."""
    if not hasattr(request.app.state, 'mcp_bridge'):
        raise HTTPException(status_code=500, detail="MCP bridge not available")
    return request.app.state.mcp_bridge


def get_plugin_token(authorization: str = Header(None)) -> Optional[str]:
    """Extract plugin token from Authorization header."""
    if authorization and authorization.startswith("Bearer "):
        return authorization[7:]
    return None


def verify_plugin_auth(token: Optional[str] = Depends(get_plugin_token)) -> Dict[str, Any]:
    """Verify plugin authentication token."""
    if not token:
        raise HTTPException(status_code=401, detail="Plugin authentication required")
    
    # In a real implementation, this would validate the token
    # For now, return a simple plugin context
    return {
        "plugin_id": "example_plugin",
        "plugin_type": "vscode",
        "permissions": ["read_tasks", "create_tasks", "search_tasks"]
    }


@router.post("/register", response_model=PluginTokenResponse)
async def register_plugin(
    registration_data: PluginRegistrationRequest,
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Register a new plugin and obtain authentication token.
    
    Registers VS Code or Obsidian plugins with the system and provides
    an authentication token for subsequent API calls. Each plugin type
    has specific capabilities and permissions.
    """
    try:
        plugin_info = registration_data.plugin_info
        
        # Validate plugin type and capabilities
        valid_types = ["vscode", "obsidian", "custom"]
        if plugin_info.type not in valid_types:
            raise HTTPException(status_code=400, detail=f"Invalid plugin type. Must be one of: {valid_types}")
        
        # Generate plugin token (in real implementation, this would be secure)
        import uuid
        from datetime import datetime, timedelta
        
        plugin_id = f"{plugin_info.type}_{plugin_info.name}_{str(uuid.uuid4())[:8]}"
        token = f"vsp_{str(uuid.uuid4()).replace('-', '')}"
        expires_at = datetime.now() + timedelta(days=365)  # 1 year expiry
        
        # Set permissions based on plugin type
        permissions_by_type = {
            "vscode": [
                "read_tasks", "create_tasks", "update_tasks", "search_tasks",
                "file_context", "git_integration", "real_time_updates"
            ],
            "obsidian": [
                "read_tasks", "create_tasks", "update_tasks", "search_tasks",
                "note_context", "knowledge_graph", "backlink_analysis"
            ],
            "custom": [
                "read_tasks", "search_tasks"  # Limited permissions for custom plugins
            ]
        }
        
        permissions = permissions_by_type.get(plugin_info.type, ["read_tasks"])
        
        # Store plugin registration (would persist in database)
        plugin_registry = {
            "plugin_id": plugin_id,
            "name": plugin_info.name,
            "type": plugin_info.type,
            "version": plugin_info.version,
            "capabilities": plugin_info.capabilities,
            "permissions": permissions,
            "webhook_url": plugin_info.webhook_url,
            "registered_at": datetime.now().isoformat(),
            "last_seen": datetime.now().isoformat(),
            "status": "active"
        }
        
        logger.info(f"Registered plugin: {plugin_info.name} ({plugin_info.type})")
        
        return PluginTokenResponse(
            success=True,
            message=f"Plugin '{plugin_info.name}' registered successfully",
            token=token,
            expires_at=expires_at,
            plugin_id=plugin_id,
            permissions=permissions
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error registering plugin")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/auth", response_model=PluginTokenResponse)
async def authenticate_plugin(
    auth_data: PluginAuthRequest
):
    """
    Authenticate an existing plugin and refresh token.
    
    Allows existing plugins to re-authenticate and obtain new tokens
    when their current tokens expire or are compromised.
    """
    try:
        # In real implementation, would validate plugin credentials
        # For now, return a new token
        
        import uuid
        from datetime import datetime, timedelta
        
        plugin_id = f"auth_{auth_data.plugin_name}_{str(uuid.uuid4())[:8]}"
        token = f"vsp_{str(uuid.uuid4()).replace('-', '')}"
        expires_at = datetime.now() + timedelta(days=365)
        
        # Default permissions (would be retrieved from plugin registry)
        permissions = ["read_tasks", "create_tasks", "search_tasks"]
        
        return PluginTokenResponse(
            success=True,
            message=f"Plugin '{auth_data.plugin_name}' authenticated successfully",
            token=token,
            expires_at=expires_at,
            plugin_id=plugin_id,
            permissions=permissions
        )
        
    except Exception as e:
        logger.exception("Error authenticating plugin")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/status", response_model=PluginStatusResponse)
async def get_plugin_status(
    plugin_context: Dict[str, Any] = Depends(verify_plugin_auth)
):
    """
    Get current plugin status and activity metrics.
    
    Provides information about plugin health, usage statistics,
    and connection status for monitoring and debugging.
    """
    try:
        from datetime import datetime
        
        # Mock status data (would be retrieved from plugin registry)
        status_data = {
            "plugin_id": plugin_context["plugin_id"],
            "status": "active",
            "last_seen": datetime.now(),
            "requests_count": 150,  # Would track actual request count
            "error_count": 2,       # Would track actual error count
        }
        
        return PluginStatusResponse(
            success=True,
            message="Plugin status retrieved successfully",
            **status_data
        )
        
    except Exception as e:
        logger.exception("Error getting plugin status")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# VS Code Specific Endpoints

@router.post("/vscode/context/file", response_model=FileContextResponse)
async def analyze_file_context(
    file_context: FileContextRequest,
    plugin_context: Dict[str, Any] = Depends(verify_plugin_auth),
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Analyze file context for task-related insights (VS Code specific).
    
    Analyzes code files to:
    - Find related tasks
    - Suggest new tasks based on code content
    - Identify potential issues or improvements
    - Provide code-aware task recommendations
    """
    try:
        # Verify this is a VS Code plugin
        if plugin_context.get("plugin_type") != "vscode":
            raise HTTPException(status_code=403, detail="This endpoint is only available for VS Code plugins")
        
        # Analyze the file context using semantic search
        search_query = f"file:{file_context.file_path}"
        if file_context.function_name:
            search_query += f" function:{file_context.function_name}"
        if file_context.content_preview:
            search_query += f" {file_context.content_preview[:200]}"
        
        # Search for related tasks
        search_result = await mcp_bridge.semantic_search_tasks(
            query=search_query,
            n_results=10,
            min_similarity=0.3
        )
        
        related_tasks = []
        if search_result["success"]:
            for result in search_result["results"]:
                related_tasks.append({
                    "id": result["task_id"],
                    "title": result["title"],
                    "similarity_score": result["similarity_score"],
                    "status": result["task_data"]["status"],
                    "priority": result["task_data"]["priority"]
                })
        
        # Generate code analysis insights
        code_analysis = {
            "language": file_context.language or "unknown",
            "complexity": "moderate",  # Would analyze actual complexity
            "test_coverage": "unknown",
            "documentation_status": "needs_improvement" if not file_context.content_preview or len(file_context.content_preview) < 100 else "adequate",
            "potential_issues": []
        }
        
        # Add language-specific analysis
        if file_context.language:
            if file_context.language.lower() in ["python", "javascript", "typescript"]:
                code_analysis["potential_issues"].extend([
                    "Consider adding type hints" if file_context.language.lower() == "python" else "Type safety could be improved",
                    "Function complexity may need review"
                ])
        
        # Suggest actions based on context
        suggested_actions = [
            f"Review tasks related to {file_context.file_path}",
            "Consider creating documentation task for this file"
        ]
        
        if file_context.function_name:
            suggested_actions.append(f"Add unit tests for {file_context.function_name}")
        
        if file_context.language and file_context.language.lower() in ["python", "javascript"]:
            suggested_actions.append("Consider refactoring for better maintainability")
        
        return FileContextResponse(
            success=True,
            message=f"File context analyzed for {file_context.file_path}",
            file_path=file_context.file_path,
            related_tasks=related_tasks,
            suggested_actions=suggested_actions,
            code_analysis=code_analysis
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error analyzing file context for {file_context.file_path}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/vscode/tasks/from-selection", response_model=TaskCreateResponse)
async def create_task_from_code_selection(
    file_context: FileContextRequest,
    suggested_title: Optional[str] = Query(None, description="Suggested task title"),
    plugin_context: Dict[str, Any] = Depends(verify_plugin_auth),
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Create a task from selected code in VS Code.
    
    Automatically creates a task based on code selection with:
    - Smart title generation
    - Code context in description
    - Appropriate role assignment
    - File references
    """
    try:
        # Verify this is a VS Code plugin
        if plugin_context.get("plugin_type") != "vscode":
            raise HTTPException(status_code=403, detail="This endpoint is only available for VS Code plugins")
        
        # Generate task title and description
        title = suggested_title or f"Code task for {file_context.file_path}"
        if file_context.function_name:
            title = suggested_title or f"Review/improve {file_context.function_name} function"
        
        description = f"Task created from code selection in {file_context.file_path}\n\n"
        
        if file_context.function_name:
            description += f"Function: {file_context.function_name}\n"
        
        if file_context.line_number:
            description += f"Line: {file_context.line_number}\n"
        
        if file_context.selection_start and file_context.selection_end:
            description += f"Selection: lines {file_context.selection_start}-{file_context.selection_end}\n"
        
        if file_context.content_preview:
            description += f"\nCode context:\n```{file_context.language or ''}\n{file_context.content_preview}\n```"
        
        # Determine appropriate role based on file type
        role_mapping = {
            "python": "python_developer",
            "javascript": "frontend_developer",
            "typescript": "frontend_developer",
            "java": "backend_developer",
            "go": "backend_developer",
            "rust": "backend_developer",
            "html": "frontend_developer",
            "css": "frontend_developer",
            "sql": "database_admin",
            "yaml": "devops_engineer",
            "dockerfile": "devops_engineer"
        }
        
        suggested_role = None
        if file_context.language:
            suggested_role = role_mapping.get(file_context.language.lower())
        
        # Create task
        task_data = TaskCreateRequest(
            title=title,
            description=description,
            project_id=None,  # Could infer from workspace
            feature=f"code_improvement_{file_context.language}" if file_context.language else "code_improvement",
            priority="normal",
            tags=["code", "vscode", file_context.language or "unknown"],
            labels={
                "source": "vscode",
                "file_path": file_context.file_path,
                "language": file_context.language or "unknown"
            },
            code_references=[file_context.file_path]
        )
        
        # Create the task using the MCP bridge
        result = await mcp_bridge.create_task(
            title=task_data.title,
            description=task_data.description,
            project_id=task_data.project_id,
            feature=task_data.feature,
            priority=task_data.priority.value
        )
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to create task"))
        
        # Assign role if determined
        if suggested_role and result.get("task"):
            task_id = result["task"]["id"]
            try:
                await mcp_bridge.assign_role_to_task(task_id, suggested_role)
            except Exception as e:
                logger.warning(f"Failed to assign role {suggested_role} to task {task_id}: {e}")
        
        # Convert task dict to response model
        task_response = None
        if result.get("task"):
            task_dict = result["task"]
            # Add additional VS Code specific metadata
            task_dict["source_context"] = {
                "source": "vscode",
                "file_path": file_context.file_path,
                "language": file_context.language,
                "function_name": file_context.function_name,
                "line_number": file_context.line_number
            }
        
        return TaskCreateResponse(
            success=True,
            message=f"Task created from VS Code selection in {file_context.file_path}",
            task=task_dict
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error creating task from code selection")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# Obsidian Specific Endpoints

@router.post("/obsidian/context/note", response_model=NoteContextResponse)
async def analyze_note_context(
    note_context: NoteContextRequest,
    plugin_context: Dict[str, Any] = Depends(verify_plugin_auth),
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Analyze note context for task-related insights (Obsidian specific).
    
    Analyzes markdown notes to:
    - Find related tasks
    - Extract action items and TODOs
    - Analyze knowledge connections
    - Suggest new tasks from note content
    """
    try:
        # Verify this is an Obsidian plugin
        if plugin_context.get("plugin_type") != "obsidian":
            raise HTTPException(status_code=403, detail="This endpoint is only available for Obsidian plugins")
        
        # Build search query from note context
        search_query = f"note:{note_context.note_title or note_context.note_path}"
        if note_context.section:
            search_query += f" section:{note_context.section}"
        if note_context.content_preview:
            search_query += f" {note_context.content_preview[:200]}"
        if note_context.tags:
            search_query += f" tags:{' '.join(note_context.tags)}"
        
        # Search for related tasks
        search_result = await mcp_bridge.semantic_search_tasks(
            query=search_query,
            n_results=10,
            min_similarity=0.3
        )
        
        related_tasks = []
        if search_result["success"]:
            for result in search_result["results"]:
                related_tasks.append({
                    "id": result["task_id"],
                    "title": result["title"],
                    "similarity_score": result["similarity_score"],
                    "status": result["task_data"]["status"],
                    "priority": result["task_data"]["priority"]
                })
        
        # Analyze knowledge connections
        knowledge_connections = []
        if note_context.backlinks:
            knowledge_connections.extend([f"Backlinked: {link}" for link in note_context.backlinks])
        if note_context.tags:
            knowledge_connections.extend([f"Tagged: {tag}" for tag in note_context.tags])
        
        # Extract potential tasks from note content
        suggested_tasks = []
        if note_context.content_preview:
            content = note_context.content_preview.lower()
            
            # Look for action items and TODOs
            if "todo" in content or "- [ ]" in content:
                suggested_tasks.append("Extract and create tasks from TODO items in note")
            
            if "research" in content:
                suggested_tasks.append(f"Research task based on {note_context.note_title or 'note content'}")
            
            if "implement" in content or "develop" in content:
                suggested_tasks.append(f"Implementation task from {note_context.note_title or 'note'}")
            
            if "review" in content or "analyze" in content:
                suggested_tasks.append(f"Review/analysis task from {note_context.note_title or 'note'}")
        
        # Add section-specific suggestions
        if note_context.section:
            suggested_tasks.append(f"Task for '{note_context.section}' section")
        
        return NoteContextResponse(
            success=True,
            message=f"Note context analyzed for {note_context.note_path}",
            note_path=note_context.note_path,
            related_tasks=related_tasks,
            knowledge_connections=knowledge_connections,
            suggested_tasks=suggested_tasks
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error analyzing note context for {note_context.note_path}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/obsidian/tasks/from-note", response_model=TaskCreateResponse)
async def create_task_from_note(
    note_context: NoteContextRequest,
    suggested_title: Optional[str] = Query(None, description="Suggested task title"),
    plugin_context: Dict[str, Any] = Depends(verify_plugin_auth),
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Create a task from Obsidian note content.
    
    Creates a task with note context, backlinks, and knowledge connections.
    Maintains bidirectional linking between tasks and notes.
    """
    try:
        # Verify this is an Obsidian plugin
        if plugin_context.get("plugin_type") != "obsidian":
            raise HTTPException(status_code=403, detail="This endpoint is only available for Obsidian plugins")
        
        # Generate task title and description
        note_title = note_context.note_title or note_context.note_path.split('/')[-1]
        title = suggested_title or f"Task from note: {note_title}"
        
        description = f"Task created from Obsidian note: {note_context.note_path}\n\n"
        
        if note_context.note_title:
            description += f"Note: [[{note_context.note_title}]]\n"
        
        if note_context.section:
            description += f"Section: {note_context.section}\n"
        
        if note_context.tags:
            description += f"Tags: {', '.join(note_context.tags)}\n"
        
        if note_context.backlinks:
            description += f"Connected notes: {', '.join([f'[[{link}]]' for link in note_context.backlinks])}\n"
        
        if note_context.content_preview:
            description += f"\nNote content:\n{note_context.content_preview}"
        
        # Create task with Obsidian-specific metadata
        task_data = TaskCreateRequest(
            title=title,
            description=description,
            project_id=None,  # Could infer from vault structure
            feature="knowledge_management",
            priority="normal",
            tags=["obsidian", "note"] + (note_context.tags or []),
            labels={
                "source": "obsidian",
                "note_path": note_context.note_path,
                "note_title": note_context.note_title or "",
                "vault": "default"  # Could be extracted from plugin context
            },
            source_references=[note_context.note_path]
        )
        
        # Create the task
        result = await mcp_bridge.create_task(
            title=task_data.title,
            description=task_data.description,
            project_id=task_data.project_id,
            feature=task_data.feature,
            priority=task_data.priority.value
        )
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to create task"))
        
        # Add Obsidian-specific context to response
        task_response = None
        if result.get("task"):
            task_dict = result["task"]
            task_dict["source_context"] = {
                "source": "obsidian",
                "note_path": note_context.note_path,
                "note_title": note_context.note_title,
                "section": note_context.section,
                "tags": note_context.tags,
                "backlinks": note_context.backlinks
            }
        
        return TaskCreateResponse(
            success=True,
            message=f"Task created from Obsidian note: {note_title}",
            task=task_dict
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error creating task from note")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# Webhook and Notification Endpoints

@router.post("/webhooks/register", response_model=NotificationResponse)
async def register_webhook(
    webhook_data: WebhookRequest,
    plugin_context: Dict[str, Any] = Depends(verify_plugin_auth)
):
    """
    Register a webhook for real-time plugin notifications.
    
    Allows plugins to receive real-time updates about:
    - Task status changes
    - New task assignments
    - Project updates
    - System events
    """
    try:
        import uuid
        from datetime import datetime
        
        # Validate webhook URL
        if not webhook_data.url.startswith(("http://", "https://")):
            raise HTTPException(status_code=400, detail="Invalid webhook URL")
        
        # Store webhook registration (would persist in database)
        webhook_id = str(uuid.uuid4())
        webhook_registry = {
            "webhook_id": webhook_id,
            "plugin_id": plugin_context["plugin_id"],
            "url": webhook_data.url,
            "events": webhook_data.events,
            "secret": webhook_data.secret,
            "registered_at": datetime.now().isoformat(),
            "status": "active"
        }
        
        logger.info(f"Registered webhook for plugin {plugin_context['plugin_id']}: {webhook_data.url}")
        
        return NotificationResponse(
            success=True,
            message="Webhook registered successfully",
            notification_id=webhook_id,
            delivered_at=datetime.now(),
            delivery_method="webhook"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error registering webhook")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/notifications/test")
async def test_plugin_notification(
    plugin_context: Dict[str, Any] = Depends(verify_plugin_auth)
):
    """
    Send a test notification to verify plugin connectivity.
    
    Useful for testing webhook endpoints and notification delivery
    during plugin development and debugging.
    """
    try:
        from datetime import datetime
        
        # This would send a test notification to registered webhooks
        test_notification = {
            "type": "test",
            "timestamp": datetime.now().isoformat(),
            "plugin_id": plugin_context["plugin_id"],
            "message": "Test notification from Vespera API",
            "data": {
                "test": True,
                "plugin_type": plugin_context.get("plugin_type", "unknown")
            }
        }
        
        logger.info(f"Sent test notification to plugin {plugin_context['plugin_id']}")
        
        return {
            "success": True,
            "message": "Test notification sent",
            "notification": test_notification
        }
        
    except Exception as e:
        logger.exception("Error sending test notification")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/integrations/available")
async def list_available_integrations(
    plugin_type: Optional[str] = Query(None, description="Filter by plugin type"),
    plugin_context: Dict[str, Any] = Depends(verify_plugin_auth)
):
    """
    List available integrations and features for the plugin type.
    
    Provides information about what features and integrations are
    available for the specific plugin type (VS Code vs Obsidian).
    """
    try:
        # Define available integrations by plugin type
        integrations = {
            "vscode": {
                "file_context_analysis": {
                    "description": "Analyze code files for task relationships",
                    "endpoint": "/api/v1/plugins/vscode/context/file",
                    "capabilities": ["semantic_analysis", "code_insights", "task_suggestions"]
                },
                "task_from_selection": {
                    "description": "Create tasks from code selections",
                    "endpoint": "/api/v1/plugins/vscode/tasks/from-selection",
                    "capabilities": ["task_creation", "code_context", "role_assignment"]
                },
                "git_integration": {
                    "description": "Git-aware task management",
                    "endpoint": "/api/v1/plugins/vscode/git/*",
                    "capabilities": ["branch_tracking", "commit_linking", "pr_integration"]
                },
                "real_time_updates": {
                    "description": "Live task status updates",
                    "endpoint": "WebSocket: /ws/plugins/vscode",
                    "capabilities": ["live_updates", "notifications", "collaboration"]
                }
            },
            "obsidian": {
                "note_context_analysis": {
                    "description": "Analyze notes for task relationships",
                    "endpoint": "/api/v1/plugins/obsidian/context/note",
                    "capabilities": ["semantic_analysis", "knowledge_graph", "backlink_analysis"]
                },
                "task_from_note": {
                    "description": "Create tasks from note content",
                    "endpoint": "/api/v1/plugins/obsidian/tasks/from-note",
                    "capabilities": ["task_creation", "note_linking", "bidirectional_refs"]
                },
                "knowledge_graph": {
                    "description": "Task-knowledge graph integration",
                    "endpoint": "/api/v1/plugins/obsidian/graph/*",
                    "capabilities": ["graph_visualization", "connection_mapping", "insight_discovery"]
                },
                "template_integration": {
                    "description": "Task template generation",
                    "endpoint": "/api/v1/plugins/obsidian/templates/*",
                    "capabilities": ["template_creation", "standardization", "automation"]
                }
            },
            "custom": {
                "basic_api": {
                    "description": "Basic task management operations",
                    "endpoint": "/api/v1/tasks/*",
                    "capabilities": ["read_tasks", "search_tasks"]
                }
            }
        }
        
        # Filter by plugin type
        current_plugin_type = plugin_context.get("plugin_type", "custom")
        if plugin_type and plugin_type != current_plugin_type:
            raise HTTPException(status_code=403, detail=f"Access denied. Plugin type mismatch.")
        
        available_integrations = integrations.get(current_plugin_type, integrations["custom"])
        
        return {
            "success": True,
            "plugin_type": current_plugin_type,
            "available_integrations": available_integrations,
            "integration_count": len(available_integrations),
            "permissions": plugin_context.get("permissions", []),
            "message": f"Available integrations for {current_plugin_type} plugin"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error listing available integrations")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")