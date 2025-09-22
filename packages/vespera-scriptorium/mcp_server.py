#!/usr/bin/env python3
"""
FastMCP Server - Translation Layer to Rust Bindery Backend

A minimal FastMCP server that translates MCP tool calls to HTTP requests
to the Rust Bindery backend. Implements proper error handling to prevent
"Interrupted by user" errors and graceful shutdown handling.

All logging goes to stderr only to avoid interfering with MCP protocol on stdout.
"""

import asyncio
import signal
import sys
from typing import Optional, List, Any, Dict
from contextlib import asynccontextmanager

import structlog
from fastmcp import FastMCP
from pydantic import BaseModel, Field

from bindery_client import BinderyClient, BinderyClientError, with_bindery_client
from models import (
    TaskInput, TaskOutput, TaskUpdateInput,
    ProjectInput, ProjectOutput,
    SearchInput, SearchOutput,
    NoteInput, NoteOutput,
    DashboardStats,
    SuccessResponse
)

# Configure structured logging to stderr only
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

# Ensure all logging goes to stderr
logger = structlog.get_logger()

# Global shutdown flag
shutdown_requested = False


class MCPErrorHandler:
    """
    Error handling middleware for MCP tool calls.
    Prevents "Interrupted by user" errors by ensuring proper error responses.
    """

    @staticmethod
    async def handle_tool_error(operation_name: str, operation_func, *args, **kwargs):
        """
        Wrap tool operations with proper error handling.

        Args:
            operation_name: Name of the operation for logging
            operation_func: The async function to execute
            *args, **kwargs: Arguments to pass to the operation

        Returns:
            Result of the operation or a structured error response
        """
        try:
            logger.info(f"Starting {operation_name}")
            result = await operation_func(*args, **kwargs)
            logger.info(f"Completed {operation_name} successfully")
            return result

        except BinderyClientError as e:
            logger.error(
                f"Bindery client error in {operation_name}",
                error=e.message,
                status_code=e.status_code,
                details=e.details
            )
            # Return structured error response instead of raising
            return {
                "error": e.message,
                "operation": operation_name,
                "status_code": e.status_code,
                "details": e.details
            }

        except Exception as e:
            logger.error(
                f"Unexpected error in {operation_name}",
                error=str(e),
                error_type=type(e).__name__
            )
            # Return structured error response instead of raising
            return {
                "error": f"Internal server error: {str(e)}",
                "operation": operation_name,
                "error_type": type(e).__name__
            }


# Initialize FastMCP server
mcp = FastMCP("Vespera Scriptorium")

# Error handler instance
error_handler = MCPErrorHandler()


@mcp.tool()
async def create_task(task_input: TaskInput) -> Dict[str, Any]:
    """
    Create a new task in the Bindery backend.

    Args:
        task_input: Task creation data including title, description, priority, and tags

    Returns:
        Created task data or error information
    """
    async def operation():
        async with BinderyClient() as client:
            return (await client.create_task(task_input)).model_dump()

    return await error_handler.handle_tool_error("create_task", operation)


@mcp.tool()
async def get_task(task_id: str) -> Dict[str, Any]:
    """
    Retrieve a task by its ID.

    Args:
        task_id: Unique identifier for the task

    Returns:
        Task data or error information
    """
    async def operation():
        async with BinderyClient() as client:
            return (await client.get_task(task_id)).model_dump()

    return await error_handler.handle_tool_error("get_task", operation)


@mcp.tool()
async def update_task(task_id: str, task_update: TaskUpdateInput) -> Dict[str, Any]:
    """
    Update an existing task.

    Args:
        task_id: Unique identifier for the task
        task_update: Updated task data (only non-None fields will be updated)

    Returns:
        Updated task data or error information
    """
    async def operation():
        async with BinderyClient() as client:
            return (await client.update_task(task_id, task_update)).model_dump()

    return await error_handler.handle_tool_error("update_task", operation)


@mcp.tool()
async def list_tasks(
    project_id: Optional[str] = None,
    status: Optional[str] = None
) -> Dict[str, Any]:
    """
    List tasks with optional filtering.

    Args:
        project_id: Optional project ID to filter tasks
        status: Optional status to filter tasks (pending, in_progress, completed, cancelled)

    Returns:
        List of tasks or error information
    """
    async def operation():
        async with BinderyClient() as client:
            return (await client.list_tasks(project_id, status)).model_dump()

    return await error_handler.handle_tool_error("list_tasks", operation)


@mcp.tool()
async def create_project(project_input: ProjectInput) -> Dict[str, Any]:
    """
    Create a new project in the Bindery backend.

    Args:
        project_input: Project creation data including name, description, and tags

    Returns:
        Created project data or error information
    """
    async def operation():
        async with BinderyClient() as client:
            return (await client.create_project(project_input)).model_dump()

    return await error_handler.handle_tool_error("create_project", operation)


@mcp.tool()
async def get_dashboard_stats() -> Dict[str, Any]:
    """
    Get dashboard statistics from the Bindery backend.

    Returns:
        Dashboard statistics or error information
    """
    async def operation():
        async with BinderyClient() as client:
            return (await client.get_dashboard_stats()).model_dump()

    return await error_handler.handle_tool_error("get_dashboard_stats", operation)


@mcp.tool()
async def search_entities(search_input: SearchInput) -> Dict[str, Any]:
    """
    Search across tasks, projects, and notes.

    Args:
        search_input: Search parameters including query string and entity types

    Returns:
        Search results or error information
    """
    async def operation():
        async with BinderyClient() as client:
            return (await client.search(search_input)).model_dump()

    return await error_handler.handle_tool_error("search_entities", operation)


@mcp.tool()
async def health_check() -> Dict[str, Any]:
    """
    Check the health of the Bindery backend.

    Returns:
        Health status or error information
    """
    async def operation():
        async with BinderyClient() as client:
            health_data = await client.health_check()
            return {
                "status": "healthy",
                "backend_response": health_data,
                "mcp_server": "running"
            }

    return await error_handler.handle_tool_error("health_check", operation)


def setup_signal_handlers():
    """Set up signal handlers for graceful shutdown."""
    global shutdown_requested

    def signal_handler(signum, frame):
        global shutdown_requested
        logger.info(f"Received signal {signum}, initiating graceful shutdown")
        shutdown_requested = True

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)


async def run_server():
    """
    Run the FastMCP server with proper error handling and graceful shutdown.
    """
    global shutdown_requested

    setup_signal_handlers()

    try:
        logger.info("Starting Vespera Scriptorium FastMCP Server")
        logger.info("Configured as translation layer to Rust Bindery backend at http://localhost:3000")

        # Test connection to Bindery on startup
        try:
            async with BinderyClient() as client:
                await client.health_check()
                logger.info("Successfully connected to Bindery backend")
        except BinderyClientError as e:
            logger.warning(
                "Could not connect to Bindery backend on startup",
                error=e.message,
                note="Server will continue running; tools will return errors until backend is available"
            )

        # Run the MCP server
        await mcp.run(transport="stdio")

    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt")
    except Exception as e:
        logger.error("Server error", error=str(e), error_type=type(e).__name__)
        raise
    finally:
        logger.info("FastMCP server shutdown complete")


def main():
    """
    Entry point for the MCP server.
    Ensures all logging goes to stderr and handles startup/shutdown gracefully.
    """
    # Ensure stdout is reserved for MCP protocol
    logger.info("Initializing Vespera Scriptorium FastMCP Server")

    try:
        # Run the async server
        asyncio.run(run_server())
    except KeyboardInterrupt:
        logger.info("Server interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error("Fatal server error", error=str(e))
        sys.exit(1)


if __name__ == "__main__":
    main()