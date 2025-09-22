"""
Authentication Middleware

Plugin-based authentication system for Vespera REST API.
Handles token validation, plugin identification, and permission management.
"""

import logging
from typing import Optional, Dict, Any, List
from fastapi import Request, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import jwt
import time

logger = logging.getLogger(__name__)

# Simple in-memory token storage for demo (would use database in production)
PLUGIN_TOKENS = {}
PLUGIN_REGISTRY = {}

# Security configuration
SECRET_KEY = "vespera-api-secret-key-change-in-production"
ALGORITHM = "HS256"


class AuthenticationMiddleware(BaseHTTPMiddleware):
    """
    Authentication middleware for plugin-based access control.
    
    Validates plugin tokens and manages plugin permissions.
    Allows anonymous access to documentation and health endpoints.
    """
    
    def __init__(self, app):
        super().__init__(app)
        self.bearer = HTTPBearer(auto_error=False)
        
        # Endpoints that don't require authentication
        self.public_endpoints = {
            "/", "/health", "/metrics", "/docs", "/redoc", "/openapi.json",
            "/api/v1/plugins/register", "/api/v1/plugins/auth"
        }
        
        # Plugin type permissions
        self.plugin_permissions = {
            "vscode": [
                "read_tasks", "create_tasks", "update_tasks", "delete_tasks",
                "search_tasks", "manage_dependencies", "file_context",
                "git_integration", "real_time_updates"
            ],
            "obsidian": [
                "read_tasks", "create_tasks", "update_tasks", "search_tasks",
                "note_context", "knowledge_graph", "backlink_analysis",
                "template_integration"
            ],
            "custom": [
                "read_tasks", "search_tasks"
            ]
        }
    
    async def dispatch(self, request: Request, call_next) -> Response:
        """Process authentication for incoming requests."""
        
        # Skip authentication for public endpoints
        if self._is_public_endpoint(request.url.path):
            return await call_next(request)
        
        # Skip authentication for OPTIONS requests (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)
        
        try:
            # Extract and validate token
            plugin_context = await self._authenticate_request(request)
            
            # Add plugin context to request state
            request.state.plugin_context = plugin_context
            
            # Check permissions for the requested endpoint
            if not self._check_permissions(request, plugin_context):
                raise HTTPException(
                    status_code=403,
                    detail="Insufficient permissions for this operation"
                )
            
            # Update last seen timestamp
            self._update_plugin_activity(plugin_context["plugin_id"])
            
            response = await call_next(request)
            return response
            
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("Authentication error")
            raise HTTPException(
                status_code=500,
                detail="Authentication system error"
            )
    
    def _is_public_endpoint(self, path: str) -> bool:
        """Check if endpoint is publicly accessible."""
        # Exact match for public endpoints
        if path in self.public_endpoints:
            return True
        
        # Pattern matching for documentation endpoints
        if path.startswith("/docs") or path.startswith("/redoc"):
            return True
        
        # Static files and assets
        if path.startswith("/static") or path.endswith((".css", ".js", ".ico")):
            return True
        
        return False
    
    async def _authenticate_request(self, request: Request) -> Dict[str, Any]:
        """Authenticate the request and return plugin context."""
        
        # Extract token from Authorization header
        authorization = request.headers.get("Authorization")
        if not authorization:
            raise HTTPException(
                status_code=401,
                detail="Authorization header required"
            )
        
        if not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=401,
                detail="Invalid authorization format. Use 'Bearer <token>'"
            )
        
        token = authorization[7:]  # Remove "Bearer " prefix
        
        # Validate token
        plugin_context = self._validate_token(token)
        if not plugin_context:
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired token"
            )
        
        return plugin_context
    
    def _validate_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Validate plugin token and return plugin context."""
        
        try:
            # For demo purposes, using simple token validation
            # In production, would use JWT or database lookup
            
            if token.startswith("vsp_"):
                # Simple token format: vsp_<plugin_id>_<hash>
                # In production, would validate signature and expiry
                
                # Mock plugin context (would retrieve from database)
                plugin_context = {
                    "plugin_id": "demo_plugin_001",
                    "plugin_name": "Demo Plugin",
                    "plugin_type": "vscode",  # or "obsidian", "custom"
                    "version": "1.0.0",
                    "permissions": self.plugin_permissions.get("vscode", []),
                    "created_at": "2025-01-20T00:00:00Z",
                    "last_seen": "2025-01-20T00:00:00Z",
                    "status": "active"
                }
                
                return plugin_context
            
            # JWT token validation (alternative approach)
            try:
                payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                
                # Check token expiry
                if payload.get("exp", 0) < time.time():
                    return None
                
                plugin_id = payload.get("plugin_id")
                if not plugin_id:
                    return None
                
                # Retrieve plugin context (would be from database)
                return {
                    "plugin_id": plugin_id,
                    "plugin_name": payload.get("plugin_name", "Unknown"),
                    "plugin_type": payload.get("plugin_type", "custom"),
                    "version": payload.get("version", "1.0.0"),
                    "permissions": payload.get("permissions", []),
                    "created_at": payload.get("created_at"),
                    "last_seen": payload.get("last_seen"),
                    "status": "active"
                }
                
            except jwt.InvalidTokenError:
                return None
            
        except Exception as e:
            logger.warning(f"Token validation error: {e}")
            return None
        
        return None
    
    def _check_permissions(self, request: Request, plugin_context: Dict[str, Any]) -> bool:
        """Check if plugin has permission to access the requested endpoint."""
        
        path = request.url.path
        method = request.method
        plugin_permissions = plugin_context.get("permissions", [])
        
        # Define endpoint permission requirements
        permission_map = {
            # Task management endpoints
            "GET /api/v1/tasks": ["read_tasks"],
            "POST /api/v1/tasks": ["create_tasks"],
            "PUT /api/v1/tasks": ["update_tasks"],
            "DELETE /api/v1/tasks": ["delete_tasks"],
            
            # Search endpoints
            "GET /api/v1/search": ["search_tasks"],
            "POST /api/v1/search": ["search_tasks"],
            
            # Project endpoints
            "GET /api/v1/projects": ["read_tasks"],
            "POST /api/v1/projects": ["create_tasks"],
            
            # Role endpoints
            "GET /api/v1/roles": ["read_tasks"],
            "POST /api/v1/roles": ["update_tasks"],
            
            # Plugin-specific endpoints
            "POST /api/v1/plugins/vscode": ["file_context"],
            "POST /api/v1/plugins/obsidian": ["note_context"],
        }
        
        # Check specific endpoint permissions
        endpoint_key = f"{method} {path}"
        required_permissions = permission_map.get(endpoint_key)
        
        if required_permissions:
            return any(perm in plugin_permissions for perm in required_permissions)
        
        # Pattern-based permission checking
        if path.startswith("/api/v1/tasks"):
            if method == "GET":
                return "read_tasks" in plugin_permissions
            elif method == "POST":
                return "create_tasks" in plugin_permissions
            elif method in ["PUT", "PATCH"]:
                return "update_tasks" in plugin_permissions
            elif method == "DELETE":
                return "delete_tasks" in plugin_permissions
        
        elif path.startswith("/api/v1/search"):
            return "search_tasks" in plugin_permissions
        
        elif path.startswith("/api/v1/projects"):
            return "read_tasks" in plugin_permissions
        
        elif path.startswith("/api/v1/roles"):
            return "read_tasks" in plugin_permissions
        
        elif path.startswith("/api/v1/plugins/vscode"):
            # VS Code specific permissions
            plugin_type = plugin_context.get("plugin_type")
            if plugin_type != "vscode":
                return False
            return "file_context" in plugin_permissions
        
        elif path.startswith("/api/v1/plugins/obsidian"):
            # Obsidian specific permissions
            plugin_type = plugin_context.get("plugin_type")
            if plugin_type != "obsidian":
                return False
            return "note_context" in plugin_permissions
        
        # Default: allow if plugin has any permissions
        return len(plugin_permissions) > 0
    
    def _update_plugin_activity(self, plugin_id: str) -> None:
        """Update plugin's last seen timestamp."""
        # In production, would update database
        # For demo, just log the activity
        logger.debug(f"Plugin activity: {plugin_id}")


def create_plugin_token(plugin_data: Dict[str, Any], expires_in_days: int = 365) -> str:
    """
    Create a JWT token for plugin authentication.
    
    Args:
        plugin_data: Plugin information and permissions
        expires_in_days: Token expiration time in days
    
    Returns:
        JWT token string
    """
    
    import time
    from datetime import datetime, timedelta
    
    # Token payload
    payload = {
        "plugin_id": plugin_data["plugin_id"],
        "plugin_name": plugin_data["plugin_name"],
        "plugin_type": plugin_data["plugin_type"],
        "version": plugin_data.get("version", "1.0.0"),
        "permissions": plugin_data.get("permissions", []),
        "created_at": datetime.now().isoformat(),
        "last_seen": datetime.now().isoformat(),
        "iat": int(time.time()),  # Issued at
        "exp": int((datetime.now() + timedelta(days=expires_in_days)).timestamp())  # Expiry
    }
    
    # Generate JWT token
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    
    return token


def verify_plugin_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verify and decode a plugin JWT token.
    
    Args:
        token: JWT token string
    
    Returns:
        Plugin context if valid, None if invalid
    """
    
    try:
        # Decode and verify token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # Check if token is expired
        if payload.get("exp", 0) < time.time():
            return None
        
        # Return plugin context
        return {
            "plugin_id": payload.get("plugin_id"),
            "plugin_name": payload.get("plugin_name"),
            "plugin_type": payload.get("plugin_type"),
            "version": payload.get("version"),
            "permissions": payload.get("permissions", []),
            "created_at": payload.get("created_at"),
            "last_seen": payload.get("last_seen"),
            "status": "active"
        }
        
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token: {e}")
        return None
    except Exception as e:
        logger.error(f"Token verification error: {e}")
        return None


def get_plugin_permissions(plugin_type: str) -> List[str]:
    """
    Get default permissions for a plugin type.
    
    Args:
        plugin_type: Type of plugin (vscode, obsidian, custom)
    
    Returns:
        List of permission strings
    """
    
    permission_sets = {
        "vscode": [
            "read_tasks", "create_tasks", "update_tasks", "delete_tasks",
            "search_tasks", "manage_dependencies", "file_context",
            "git_integration", "real_time_updates"
        ],
        "obsidian": [
            "read_tasks", "create_tasks", "update_tasks", "search_tasks",
            "note_context", "knowledge_graph", "backlink_analysis",
            "template_integration"
        ],
        "custom": [
            "read_tasks", "search_tasks"
        ]
    }
    
    return permission_sets.get(plugin_type, permission_sets["custom"])


def revoke_plugin_token(plugin_id: str) -> bool:
    """
    Revoke a plugin token (add to blacklist).
    
    Args:
        plugin_id: Plugin identifier
    
    Returns:
        True if successfully revoked
    """
    
    # In production, would add to token blacklist in database
    # For demo, just log the revocation
    logger.info(f"Token revoked for plugin: {plugin_id}")
    return True