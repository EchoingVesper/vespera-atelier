"""
Vespera V2 REST API

A comprehensive REST API layer for Vespera's task management and intelligence capabilities.
Designed specifically for VS Code and Obsidian plugin integration.

Features:
- Task Management: Full CRUD operations for hierarchical tasks
- Semantic Search: AI-powered task discovery and similarity matching
- Project Intelligence: Graph analysis, dependency tracking, health metrics
- Role Management: Capability-based role assignments and permissions
- Plugin Integration: Specialized endpoints for VS Code and Obsidian
- Real-time Updates: WebSocket support for live notifications

Usage:
    from api.server import app
    
    # Or run the server directly:
    # python run_api_server.py
"""

from .server import app, create_app

__version__ = "2.0.0"
__all__ = ["app", "create_app"]