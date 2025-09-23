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
import os
import json
import time
from typing import Optional, List, Any, Dict, TypeVar, Type, Union
from contextlib import asynccontextmanager

import structlog
from fastmcp import FastMCP
from pydantic import BaseModel, Field, ValidationError

from bindery_client import BinderyClient, BinderyClientError, with_bindery_client
from security import (
    secure_deserialize_mcp_param,
    ErrorSanitizer,
    set_production_mode,
    schema_cache,
    validate_task_recursion_depth,
    MAX_TASK_DEPTH
)
from models import (
    TaskInput, TaskOutput, TaskUpdateInput, TaskStatus, TaskPriority,
    ProjectInput, ProjectOutput,
    SearchInput, SearchOutput,
    NoteInput, NoteOutput,
    DashboardStats,
    SuccessResponse, StandardErrorResponse,
    DeleteTaskResponse, CompleteTaskResponse, ExecuteTaskResponse,
    RoleDefinition, DocumentInput, DocumentType
)
from backend_manager import BinderyBackendManager

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

# Initialize security mode based on environment
PRODUCTION_MODE = os.getenv('MCP_PRODUCTION', 'false').lower() == 'true'
set_production_mode(PRODUCTION_MODE)

# Initialize metrics configuration
INCLUDE_METRICS = os.getenv('MCP_INCLUDE_METRICS', 'false').lower() == 'true'

if PRODUCTION_MODE:
    logger.info("Running in PRODUCTION mode - enhanced security enabled")
else:
    logger.info("Running in DEVELOPMENT mode - verbose errors enabled")

if INCLUDE_METRICS:
    logger.info("Performance metrics enabled in responses")
else:
    logger.info("Performance metrics disabled (set MCP_INCLUDE_METRICS=true to enable)")


class MCPErrorHandler:
    """
    Error handling middleware for MCP tool calls.
    Provides standardized error responses with consistent format across all tools.
    """

    @staticmethod
    def _map_exception_to_error_code(exception: Exception) -> str:
        """Map exception types to standardized error codes."""
        if isinstance(exception, ValidationError):
            return "validation_error"
        elif isinstance(exception, BinderyClientError):
            if exception.status_code == 404:
                return "not_found"
            elif exception.status_code == 403:
                return "permission_denied"
            elif exception.status_code in [500, 502, 503, 504]:
                return "internal_error"
            elif exception.status_code == 408:
                return "timeout_error"
            elif exception.status_code == 429:
                return "rate_limit_exceeded"
            elif "connect" in str(exception).lower() or "connection" in str(exception).lower():
                return "connection_error"
            else:
                return "client_error"
        elif "timeout" in str(exception).lower():
            return "timeout_error"
        elif "connection" in str(exception).lower() or "connect" in str(exception).lower():
            return "connection_error"
        elif "permission" in str(exception).lower() or "unauthorized" in str(exception).lower():
            return "permission_denied"
        elif "depth" in str(exception).lower() and "exceeded" in str(exception).lower():
            return "task_depth_exceeded"
        else:
            return "internal_error"

    @staticmethod
    def _get_error_suggestions(error_code: str, operation: str, exception: Exception) -> List[str]:
        """Get actionable suggestions based on error code and context."""
        suggestions = []

        if error_code == "connection_error":
            suggestions.extend([
                "Ensure the Bindery backend server is running on localhost:3000",
                "Check if the backend process is healthy using the health_check tool",
                "Verify network connectivity and firewall settings"
            ])
        elif error_code == "not_found":
            if "task" in operation:
                suggestions.extend([
                    "Verify the task ID exists using the list_tasks tool",
                    "Check if the task was deleted or moved to another project"
                ])
            elif "project" in operation:
                suggestions.extend([
                    "Verify the project ID exists",
                    "Check if the project was archived or deleted"
                ])
        elif error_code == "validation_error":
            suggestions.extend([
                "Check that all required fields are provided",
                "Verify field types match the expected schema",
                "Ensure string fields don't exceed maximum length limits"
            ])
        elif error_code == "timeout_error":
            suggestions.extend([
                "Retry the operation after a brief delay",
                "Check if the backend is under heavy load",
                "Consider breaking large operations into smaller chunks"
            ])
        elif error_code == "rate_limit_exceeded":
            suggestions.extend([
                "Wait before retrying the operation",
                "Reduce the frequency of API calls",
                "Check if there are concurrent operations running"
            ])
        elif error_code == "task_depth_exceeded":
            suggestions.extend([
                "Reduce the nesting depth of subtasks",
                "Create subtasks as separate operations instead of deeply nested structures",
                f"Maximum task depth is {MAX_TASK_DEPTH} levels"
            ])
        elif error_code == "permission_denied":
            suggestions.extend([
                "Verify you have the necessary permissions for this operation",
                "Check if the resource requires specific role assignments"
            ])
        elif error_code == "internal_error":
            suggestions.extend([
                "Try the operation again after a brief delay",
                "Check the backend logs for more details",
                "Contact support if the issue persists"
            ])

        return suggestions

    @staticmethod
    async def handle_tool_error(operation_name: str, operation_func, *args, **kwargs) -> Dict[str, Any]:
        """
        Wrap tool operations with standardized error handling and performance monitoring.

        Args:
            operation_name: Name of the operation for logging
            operation_func: The async function to execute
            *args, **kwargs: Arguments to pass to the operation

        Returns:
            Result of the operation or a standardized error response with metrics
        """
        start_time = time.perf_counter()

        try:
            logger.info(f"Starting {operation_name}")
            result = await operation_func(*args, **kwargs)

            # Calculate execution time
            execution_time = time.perf_counter() - start_time

            logger.info(f"Completed {operation_name} successfully",
                       execution_time_ms=execution_time * 1000)

            # Add metrics to successful responses if result is a dict and metrics are enabled
            if INCLUDE_METRICS and isinstance(result, dict) and not result.get('error'):
                result['metrics'] = {
                    'execution_time_ms': round(execution_time * 1000, 2),
                    'operation': operation_name
                }

            return result

        except Exception as e:
            # Map exception to error code
            error_code = MCPErrorHandler._map_exception_to_error_code(e)

            # Log the error with full details
            logger.error(
                f"Error in {operation_name}",
                error=str(e),
                error_type=type(e).__name__,
                error_code=error_code,
                status_code=getattr(e, 'status_code', None)
            )

            # Sanitize error message for external exposure
            error_info = ErrorSanitizer.sanitize_error_message(e, operation_name)

            # Build additional context
            context = {}
            if isinstance(e, BinderyClientError):
                context.update({
                    "status_code": e.status_code,
                    "backend_details": e.details
                })
            if hasattr(e, '__class__'):
                context["exception_type"] = e.__class__.__name__

            # Get suggestions for recovery
            suggestions = MCPErrorHandler._get_error_suggestions(error_code, operation_name, e)

            # Calculate execution time even for errors
            execution_time = time.perf_counter() - start_time

            # Add metrics to context if enabled
            if INCLUDE_METRICS:
                if not context:
                    context = {}
                context['metrics'] = {
                    'execution_time_ms': round(execution_time * 1000, 2),
                    'operation': operation_name,
                    'failed': True
                }

            # Create standardized error response
            error_response = StandardErrorResponse(
                success=False,
                error=error_info["error"],
                error_code=error_code,
                operation=operation_name,
                context=context,
                suggestions=suggestions if suggestions else None
            )

            return error_response.model_dump()


# Initialize FastMCP server
mcp = FastMCP("Vespera Scriptorium")

# Error handler instance
error_handler = MCPErrorHandler()


@mcp.tool()
async def create_task(task_input: Union[str, Dict, TaskInput]) -> Dict[str, Any]:
    """
    Create a new task in the Bindery backend.

    Args:
        task_input: Task creation data including title, description, priority, and tags
                   Can be a TaskInput object, dict, or JSON string

    Returns:
        Created task data or error information
    """
    async def operation():
        # Deserialize the input parameter with enhanced security
        task = secure_deserialize_mcp_param(task_input, TaskInput)

        # Validate task recursion depth before sending to backend
        try:
            max_depth = validate_task_recursion_depth(task)
            logger.info(f"Task recursion depth validated: max_depth={max_depth}")
        except ValueError as e:
            logger.warning(f"Task recursion depth validation failed: {e}")
            # Return standardized error response
            error_response = StandardErrorResponse(
                success=False,
                error=str(e),
                error_code="task_depth_exceeded",
                operation="create_task",
                context={"max_allowed_depth": MAX_TASK_DEPTH},
                suggestions=[
                    "Reduce the nesting depth of subtasks",
                    "Create subtasks as separate operations instead of deeply nested structures",
                    f"Maximum task depth is {MAX_TASK_DEPTH} levels"
                ]
            )
            return error_response.model_dump()

        async with BinderyClient() as client:
            return (await client.create_task(task)).model_dump()

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
async def update_task(task_id: str, task_update: Union[str, Dict, TaskUpdateInput]) -> Dict[str, Any]:
    """
    Update an existing task.

    Args:
        task_id: Unique identifier for the task
        task_update: Updated task data (only non-None fields will be updated)
                    Can be a TaskUpdateInput object, dict, or JSON string

    Returns:
        Updated task data or error information
    """
    async def operation():
        # Deserialize the update input with enhanced security
        update = secure_deserialize_mcp_param(task_update, TaskUpdateInput)

        async with BinderyClient() as client:
            return (await client.update_task(task_id, update)).model_dump()

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
async def create_project(project_input: Union[str, Dict, ProjectInput]) -> Dict[str, Any]:
    """
    Create a new project in the Bindery backend.

    Args:
        project_input: Project creation data including name, description, and tags
                      Can be a ProjectInput object, dict, or JSON string

    Returns:
        Created project data or error information
    """
    async def operation():
        # Deserialize the input parameter with enhanced security
        project = secure_deserialize_mcp_param(project_input, ProjectInput)

        async with BinderyClient() as client:
            return (await client.create_project(project)).model_dump()

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
async def search_entities(search_input: Union[str, Dict, SearchInput]) -> Dict[str, Any]:
    """
    Search across tasks, projects, and notes.

    Args:
        search_input: Search parameters including query string and entity types
                     Can be a SearchInput object, dict, or JSON string

    Returns:
        Search results or error information
    """
    async def operation():
        # Deserialize the input parameter with enhanced security
        search = secure_deserialize_mcp_param(search_input, SearchInput)

        async with BinderyClient() as client:
            return (await client.search(search)).model_dump()

    return await error_handler.handle_tool_error("search_entities", operation)


@mcp.tool()
async def delete_task(task_id: str) -> Dict[str, Any]:
    """
    Delete a task by its ID.

    Args:
        task_id: Unique identifier for the task to delete

    Returns:
        Deletion confirmation or error information
    """
    async def operation():
        async with BinderyClient() as client:
            result = await client.delete_task(task_id)
            return DeleteTaskResponse(
                success=True,
                task_id=task_id,
                message="Task deleted successfully"
            ).model_dump()

    return await error_handler.handle_tool_error("delete_task", operation)


@mcp.tool()
async def complete_task(
    task_id: str,
    completion_notes: Optional[str] = None
) -> Dict[str, Any]:
    """
    Mark a task as completed.

    Args:
        task_id: Unique identifier for the task
        completion_notes: Optional notes about the completion

    Returns:
        Completed task data or error information
    """
    async def operation():
        async with BinderyClient() as client:
            # Update task status to DONE
            update_data = TaskUpdateInput(status=TaskStatus.DONE)
            task = await client.update_task(task_id, update_data)

            return CompleteTaskResponse(
                success=True,
                task=task,
                completion_notes=completion_notes
            ).model_dump()

    return await error_handler.handle_tool_error("complete_task", operation)


@mcp.tool()
async def execute_task(
    task_id: str,
    role_name: str
) -> Dict[str, Any]:
    """
    Execute a task with a specific role assignment.

    Args:
        task_id: Unique identifier for the task
        role_name: Name of the role to use for execution

    Returns:
        Execution details or error information
    """
    async def operation():
        async with BinderyClient() as client:
            # Assign role and update status to in_progress
            result = await client.execute_task(task_id, role_name)

            return ExecuteTaskResponse(
                success=True,
                task_id=task_id,
                role_assigned=role_name,
                execution_id=result.get("execution_id")
            ).model_dump()

    return await error_handler.handle_tool_error("execute_task", operation)


@mcp.tool()
async def assign_role_to_task(
    task_id: str,
    role_name: str
) -> Dict[str, Any]:
    """
    Assign a role to a task for future execution.

    Args:
        task_id: Unique identifier for the task
        role_name: Name of the role to assign

    Returns:
        Assignment confirmation or error information
    """
    async def operation():
        async with BinderyClient() as client:
            result = await client.assign_role(task_id, role_name)
            return {
                "success": True,
                "task_id": task_id,
                "role_assigned": role_name,
                "message": f"Role '{role_name}' assigned to task {task_id}"
            }

    return await error_handler.handle_tool_error("assign_role_to_task", operation)


@mcp.tool()
async def list_roles() -> Dict[str, Any]:
    """
    List all available roles and their capabilities.

    Returns:
        List of roles with their configurations or error information
    """
    async def operation():
        async with BinderyClient() as client:
            roles_data = await client.list_roles()

            # Transform to RoleDefinition models
            roles = []
            for role_dict in roles_data.get("roles", []):
                roles.append(RoleDefinition(
                    name=role_dict.get("name", ""),
                    description=role_dict.get("description", ""),
                    capabilities=role_dict.get("capabilities", []),
                    file_patterns=role_dict.get("file_patterns", []),
                    restrictions=role_dict.get("restrictions", {}),
                    model_context_limit=role_dict.get("model_context_limit")
                ).model_dump())

            return {
                "success": True,
                "roles": roles,
                "total_roles": len(roles)
            }

    return await error_handler.handle_tool_error("list_roles", operation)


@mcp.tool()
async def index_document(document_input: Union[str, Dict, DocumentInput]) -> Dict[str, Any]:
    """
    Index a document for RAG search.

    Args:
        document_input: Document data including content, title, and type
                       Can be a DocumentInput object, dict, or JSON string

    Returns:
        Indexing confirmation or error information
    """
    async def operation():
        # Deserialize the input parameter with enhanced security
        document = secure_deserialize_mcp_param(document_input, DocumentInput)

        async with BinderyClient() as client:
            result = await client.index_document(document)
            return {
                "success": True,
                "document_id": result.get("document_id"),
                "message": "Document indexed successfully",
                "chunks_created": result.get("chunks_created", 0)
            }

    return await error_handler.handle_tool_error("index_document", operation)


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


def run_server():
    """
    Run the FastMCP server with proper error handling and graceful shutdown.
    FastMCP handles its own async loop internally.
    Automatically manages the Bindery backend lifecycle.
    """
    global shutdown_requested

    setup_signal_handlers()

    # Check if we should auto-manage the backend
    auto_launch_backend = os.environ.get("MCP_AUTO_LAUNCH_BACKEND", "true").lower() == "true"
    backend_manager = None

    try:
        logger.info("Starting Vespera Scriptorium FastMCP Server")

        if auto_launch_backend:
            logger.info("Auto-launching Bindery backend...")
            backend_manager = BinderyBackendManager()

            # Try to start the backend
            if asyncio.run(backend_manager.start_and_wait()):
                logger.info("Bindery backend started successfully")
            else:
                logger.warning(
                    "Failed to auto-launch Bindery backend",
                    note="Server will continue; tools will return errors until backend is manually started"
                )
                backend_manager = None  # Don't try to stop if we didn't start it
        else:
            logger.info("Auto-launch disabled, expecting external Bindery backend")

            # Test connection to existing Bindery (synchronous check)
            import httpx
            try:
                with httpx.Client(timeout=5.0) as client:
                    response = client.get("http://localhost:3000/health")
                    if response.status_code == 200:
                        logger.info("Successfully connected to existing Bindery backend")
            except Exception as e:
                logger.warning(
                    "Could not connect to Bindery backend on startup",
                    error=str(e),
                    note="Server will continue running; tools will return errors until backend is available"
                )

        logger.info("Starting MCP server on stdio transport")

        # Run the MCP server - FastMCP handles its own async loop
        mcp.run(transport="stdio")

    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt")
    except Exception as e:
        logger.error("Server error", error=str(e), error_type=type(e).__name__)
        raise
    finally:
        # Clean up backend if we started it
        if backend_manager:
            logger.info("Shutting down Bindery backend...")
            backend_manager.stop_backend()
            logger.info("Bindery backend stopped")

        logger.info("FastMCP server shutdown complete")


def main():
    """
    Entry point for the MCP server.
    Ensures all logging goes to stderr and handles startup/shutdown gracefully.
    """
    # Ensure stdout is reserved for MCP protocol
    logger.info("Initializing Vespera Scriptorium FastMCP Server")

    try:
        # FastMCP handles its own event loop, just call run_server directly
        run_server()
    except KeyboardInterrupt:
        logger.info("Server interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error("Fatal server error", error=str(e))
        sys.exit(1)


if __name__ == "__main__":
    main()