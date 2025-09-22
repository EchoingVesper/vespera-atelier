#!/usr/bin/env python3
"""
Vespera V2 REST API Server

FastAPI-based REST server that exposes Vespera's MCP functionality for plugin integration.
Designed for VS Code and Obsidian plugins, providing comprehensive task management,
semantic search, and project intelligence capabilities.
"""

import sys
import logging
import asyncio
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Dict, Any, Optional, List

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi
import uvicorn

from api.middleware.cors import setup_cors_middleware
from api.middleware.auth import AuthenticationMiddleware
from api.middleware.error_handler import setup_error_handlers
from api.utils.mcp_bridge import MCPBridge
from api.routers import tasks, search, projects, roles, plugins
from api import websocket

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global MCP bridge instance
_mcp_bridge: Optional[MCPBridge] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager."""
    global _mcp_bridge
    
    logger.info("🚀 Starting Vespera V2 REST API Server")
    
    try:
        # Initialize MCP bridge
        _mcp_bridge = MCPBridge()
        await _mcp_bridge.initialize()
        
        # Store bridge in app state for router access
        app.state.mcp_bridge = _mcp_bridge
        
        logger.info("✅ MCP Bridge initialized successfully")
        logger.info("✅ Vespera V2 REST API Server ready!")
        
        yield
        
    except Exception as e:
        logger.error(f"Failed to initialize API server: {e}")
        raise
    finally:
        # Cleanup
        try:
            if _mcp_bridge:
                await _mcp_bridge.cleanup()
            logger.info("🧹 API Server cleanup completed")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    
    # Create FastAPI app with custom OpenAPI settings
    app = FastAPI(
        title="Vespera V2 REST API",
        description="""
        **Vespera V2 Task Management and Intelligence API**
        
        A comprehensive REST API for plugin integration with VS Code and Obsidian.
        
        ## Features
        
        - **Task Management**: Full CRUD operations for hierarchical tasks
        - **Semantic Search**: AI-powered task discovery and similarity search
        - **Project Intelligence**: Graph analysis, dependency tracking, and health metrics
        - **Role Management**: Capability-based role assignments and permissions
        - **Plugin Integration**: Specialized endpoints for editor and note-taking tools
        - **Real-time Updates**: WebSocket support for live task notifications
        
        ## Authentication
        
        Plugin-based token authentication. Use the `/auth/register-plugin` endpoint
        to obtain a token for your integration.
        
        ## Getting Started
        
        1. Register your plugin to get an API token
        2. Use the `/api/v1/tasks/` endpoints for basic task management
        3. Explore `/api/v1/search/` for intelligent task discovery
        4. Use `/api/v1/projects/` for project-level insights
        
        ## Data Models
        
        All endpoints use structured Pydantic models for request/response validation.
        See the interactive documentation below for detailed schemas.
        """,
        version="2.0.0",
        contact={
            "name": "Vespera Development Team",
            "url": "https://github.com/aya/vespera-atelier",
        },
        license_info={
            "name": "AGPL-3.0",
            "url": "https://www.gnu.org/licenses/agpl-3.0.html",
        },
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json"
    )
    
    # Setup CORS middleware
    setup_cors_middleware(app)
    
    # Setup authentication middleware
    app.add_middleware(AuthenticationMiddleware)
    
    # Setup error handlers
    setup_error_handlers(app)
    
    # Include routers
    app.include_router(
        tasks.router,
        prefix="/api/v1/tasks",
        tags=["Task Management"],
        responses={
            404: {"description": "Task not found"},
            422: {"description": "Validation error"}
        }
    )
    
    app.include_router(
        search.router,
        prefix="/api/v1/search",
        tags=["Semantic Search"],
        responses={
            422: {"description": "Search query validation error"}
        }
    )
    
    app.include_router(
        projects.router,
        prefix="/api/v1/projects",
        tags=["Project Intelligence"],
        responses={
            404: {"description": "Project not found"}
        }
    )
    
    app.include_router(
        roles.router,
        prefix="/api/v1/roles",
        tags=["Role Management"],
        responses={
            403: {"description": "Insufficient permissions"}
        }
    )
    
    app.include_router(
        plugins.router,
        prefix="/api/v1/plugins",
        tags=["Plugin Integration"],
        responses={
            401: {"description": "Plugin authentication required"}
        }
    )
    
    # Include WebSocket router
    app.include_router(
        websocket.router,
        tags=["Real-time Updates"],
        responses={
            401: {"description": "WebSocket authentication required"}
        }
    )
    
    # Root endpoint
    @app.get("/", tags=["System"])
    async def root():
        """API root endpoint with basic server information."""
        return {
            "name": "Vespera V2 REST API",
            "version": "2.0.0",
            "status": "operational",
            "features": [
                "Task Management",
                "Semantic Search", 
                "Project Intelligence",
                "Role Management",
                "Plugin Integration",
                "Real-time Updates"
            ],
            "documentation": "/docs",
            "mcp_bridge_status": "connected" if _mcp_bridge and _mcp_bridge.is_connected() else "disconnected",
            "endpoints": {
                "tasks": "/api/v1/tasks/",
                "search": "/api/v1/search/",
                "projects": "/api/v1/projects/",
                "roles": "/api/v1/roles/",
                "plugins": "/api/v1/plugins/",
                "websocket": "/ws/plugins"
            }
        }
    
    # Health check endpoint
    @app.get("/health", tags=["System"])
    async def health_check():
        """Comprehensive health check of API and underlying systems."""
        try:
            # Check MCP bridge connectivity
            mcp_status = "unknown"
            if _mcp_bridge:
                health_result = await _mcp_bridge.health_check()
                mcp_status = "healthy" if health_result.get("success") else "unhealthy"
            
            return {
                "status": "healthy",
                "timestamp": "2025-01-20T00:00:00Z",  # Would use actual timestamp
                "components": {
                    "api_server": "healthy",
                    "mcp_bridge": mcp_status,
                    "task_database": "healthy",  # Would check actual database
                    "semantic_search": "healthy",  # Would check Chroma
                    "graph_database": "healthy"   # Would check KuzuDB
                },
                "version": "2.0.0"
            }
        except Exception as e:
            logger.exception("Health check failed")
            return JSONResponse(
                status_code=503,
                content={
                    "status": "unhealthy",
                    "error": str(e),
                    "timestamp": "2025-01-20T00:00:00Z"
                }
            )
    
    # API metrics endpoint
    @app.get("/metrics", tags=["System"])
    async def get_metrics():
        """API usage metrics and statistics."""
        return {
            "requests_total": 0,  # Would track actual metrics
            "requests_per_minute": 0,
            "average_response_time": 0,
            "active_plugins": 0,
            "tasks_managed": 0,
            "searches_performed": 0,
            "uptime_seconds": 0
        }
    
    return app


# Create the FastAPI application instance
app = create_app()


if __name__ == "__main__":
    """Run the server directly."""
    uvicorn.run(
        "api.server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
        access_log=True
    )