"""
Presentation layer for Vespera Scriptorium.

This layer contains all entry points and user interfaces for the system:
- MCP server setup and configuration
- Command-line interfaces
- API endpoints (if any)

The presentation layer coordinates application use cases but contains
no business logic itself.
"""

from .cli import CLIInterface
from .mcp_server import MCPServerEntryPoint

__all__ = ["MCPServerEntryPoint", "CLIInterface"]
