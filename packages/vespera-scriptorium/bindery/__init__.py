"""
Vespera Bindery MCP Tools Module.

This module provides MCP tools for integrating with the Rust Vespera Bindery backend.
It acts as a pure translation layer between MCP protocol and Bindery JSON-RPC API.
"""

from .client import BinderyClient, BinderyClientError, BinderyConnectionError, BinderyRpcError
from .models import (
    # Task Management
    CreateTaskInput, CreateTaskOutput,
    GetTaskInput, GetTaskOutput,
    UpdateTaskInput, UpdateTaskOutput,
    ListTasksInput, ListTasksOutput,
    ExecuteTaskInput, ExecuteTaskOutput,

    # RAG/Search
    IndexDocumentInput, IndexDocumentOutput,
    SearchRagInput, SearchRagOutput,

    # Dashboard
    GetTaskDashboardInput, GetTaskDashboardOutput,

    # Enums
    TaskStatus, TaskPriority, DocumentType, HealthStatus,

    # Base Models
    BinderyResponse, TaskInput, TaskOutput, SearchResult, DocumentMetadata
)
from .tools import BinderyTools, get_tool_definitions

__all__ = [
    # Client
    "BinderyClient",
    "BinderyClientError",
    "BinderyConnectionError",
    "BinderyRpcError",

    # Models - Task Management
    "CreateTaskInput",
    "CreateTaskOutput",
    "GetTaskInput",
    "GetTaskOutput",
    "UpdateTaskInput",
    "UpdateTaskOutput",
    "ListTasksInput",
    "ListTasksOutput",
    "ExecuteTaskInput",
    "ExecuteTaskOutput",

    # Models - RAG/Search
    "IndexDocumentInput",
    "IndexDocumentOutput",
    "SearchRagInput",
    "SearchRagOutput",

    # Models - Dashboard
    "GetTaskDashboardInput",
    "GetTaskDashboardOutput",

    # Models - Enums
    "TaskStatus",
    "TaskPriority",
    "DocumentType",
    "HealthStatus",

    # Models - Base
    "BinderyResponse",
    "TaskInput",
    "TaskOutput",
    "SearchResult",
    "DocumentMetadata",

    # Tools
    "BinderyTools",
    "get_tool_definitions",
]