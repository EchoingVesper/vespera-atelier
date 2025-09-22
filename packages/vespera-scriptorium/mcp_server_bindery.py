#!/usr/bin/env python3
"""
Vespera Scriptorium MCP Server with Bindery Integration

This MCP server provides integration with the Rust Vespera Bindery backend,
offering task management, RAG search, and dashboard functionality through
a pure translation layer.

The server acts as a bridge between MCP protocol and Bindery's JSON-RPC API,
with no business logic - just format conversion and error handling.
"""

import asyncio
import logging
import os
import sys
from pathlib import Path
from typing import Any, Sequence

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from mcp.server import Server
from mcp.server.models import InitializationOptions
import mcp.server.stdio
import mcp.types as types

from bindery import BinderyTools, BinderyClient, get_tool_definitions
from bindery.client import BinderyClientError

# Configure logging to stderr only (stdout is reserved for MCP communication)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stderr),  # Explicitly use stderr
        logging.FileHandler("mcp_server_bindery.log")
    ]
)

logger = logging.getLogger("vespera-scriptorium-bindery")

# Server configuration
SERVER_NAME = "vespera-scriptorium-bindery"
SERVER_VERSION = "1.0.0"
BINDERY_DEFAULT_URL = "http://localhost:8080"


class VesperaBinderyMCPServer:
    """
    MCP Server for Vespera Bindery integration.

    Provides task management, RAG search, and dashboard tools by translating
    MCP calls to Bindery JSON-RPC API calls.
    """

    def __init__(self, bindery_url: str = BINDERY_DEFAULT_URL):
        """
        Initialize the MCP server.

        Args:
            bindery_url: URL of the Bindery JSON-RPC server
        """
        self.bindery_url = bindery_url
        self.server = Server(SERVER_NAME)
        self.bindery_client: BinderyClient = None
        self.bindery_tools: BinderyTools = None

        # Register server handlers
        self._register_handlers()

    def _register_handlers(self):
        """Register MCP server handlers."""

        @self.server.list_tools()
        async def handle_list_tools() -> list[types.Tool]:
            """List available tools."""
            logger.info("Listing available Bindery tools")
            return get_tool_definitions()

        @self.server.call_tool()
        async def handle_call_tool(
            name: str, arguments: dict[str, Any] | None
        ) -> list[types.TextContent | types.ImageContent | types.EmbeddedResource]:
            """Handle tool calls by delegating to Bindery tools."""
            if arguments is None:
                arguments = {}

            logger.info(f"Calling tool: {name} with arguments: {arguments}")

            try:
                # Ensure Bindery tools are initialized
                if self.bindery_tools is None:
                    await self._initialize_bindery()

                # Map tool names to methods - All 14 tools for complete task lifecycle management
                tool_methods = {
                    # Core Task Management (7 tools)
                    "create_task": self.bindery_tools.create_task,
                    "get_task": self.bindery_tools.get_task,
                    "update_task": self.bindery_tools.update_task,
                    "delete_task": self.bindery_tools.delete_task,
                    "complete_task": self.bindery_tools.complete_task,
                    "list_tasks": self.bindery_tools.list_tasks,
                    "execute_task": self.bindery_tools.execute_task,

                    # Task Trees (2 tools)
                    "create_task_tree": self.bindery_tools.create_task_tree,
                    "get_task_tree": self.bindery_tools.get_task_tree,

                    # Role Management (2 tools)
                    "assign_role_to_task": self.bindery_tools.assign_role_to_task,
                    "list_roles": self.bindery_tools.list_roles,

                    # RAG/Search (2 tools)
                    "search_rag": self.bindery_tools.search_rag,
                    "index_document": self.bindery_tools.index_document,

                    # Dashboard (1 tool)
                    "get_task_dashboard": self.bindery_tools.get_task_dashboard,
                }

                if name not in tool_methods:
                    logger.error(f"Unknown tool: {name}")
                    return [
                        types.TextContent(
                            type="text",
                            text=f"Error: Unknown tool '{name}'"
                        )
                    ]

                # Call the appropriate tool method
                return await tool_methods[name](arguments)

            except BinderyClientError as e:
                logger.error(f"Bindery client error in {name}: {e}")
                return [
                    types.TextContent(
                        type="text",
                        text=f"Bindery backend error: {e}"
                    )
                ]

            except Exception as e:
                logger.exception(f"Unexpected error in {name}: {e}")
                return [
                    types.TextContent(
                        type="text",
                        text=f"Unexpected error: {e}"
                    )
                ]

    async def _initialize_bindery(self):
        """Initialize Bindery client and tools."""
        if self.bindery_client is None:
            logger.info(f"Initializing Bindery client for {self.bindery_url}")
            self.bindery_client = BinderyClient(base_url=self.bindery_url)

        if self.bindery_tools is None:
            logger.info("Initializing Bindery tools")
            self.bindery_tools = BinderyTools(client=self.bindery_client)

        # Test connectivity
        try:
            health = await self.bindery_client.health_check()
            if health.get("status") == "unhealthy":
                logger.warning(f"Bindery server health check failed: {health}")
            else:
                logger.info("Bindery server connection verified")
        except Exception as e:
            logger.warning(f"Failed to verify Bindery server connection: {e}")

    async def run_stdio(self):
        """Run the MCP server using stdio transport."""
        logger.info(f"Starting {SERVER_NAME} v{SERVER_VERSION}")
        logger.info(f"Bindery backend URL: {self.bindery_url}")
        logger.info("Providing 14 MCP tools for complete task lifecycle management")

        # Initialize Bindery connection
        try:
            await self._initialize_bindery()
        except Exception as e:
            logger.error(f"Failed to initialize Bindery connection: {e}")
            logger.warning("Server will start but Bindery operations may fail")

        # Run server
        async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
            await self.server.run(
                read_stream,
                write_stream,
                InitializationOptions(
                    server_name=SERVER_NAME,
                    server_version=SERVER_VERSION,
                    capabilities=self.server.get_capabilities(
                        notification_options=None,
                        experimental_capabilities={},
                    ),
                ),
            )

    async def cleanup(self):
        """Cleanup server resources."""
        logger.info("Cleaning up server resources")
        if self.bindery_client:
            await self.bindery_client.close()


async def main():
    """Main entry point."""
    # Get Bindery URL from environment or use default
    bindery_url = os.getenv("BINDERY_URL", BINDERY_DEFAULT_URL)

    # Create and run server
    server = VesperaBinderyMCPServer(bindery_url=bindery_url)

    try:
        await server.run_stdio()
    except KeyboardInterrupt:
        logger.info("Server interrupted by user")
    except Exception as e:
        logger.exception(f"Server error: {e}")
    finally:
        await server.cleanup()


if __name__ == "__main__":
    asyncio.run(main())