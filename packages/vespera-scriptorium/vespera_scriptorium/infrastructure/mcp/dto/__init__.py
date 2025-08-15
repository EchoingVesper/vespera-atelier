"""
MCP Protocol Data Transfer Objects (DTOs).

This module contains Pydantic models for type-safe request/response handling
in the MCP protocol layer. These DTOs ensure proper validation and serialization
between the MCP protocol and the application layer.
"""

from .task_dtos import (  # Task creation/planning; Task updates; Task deletion; Task cancellation; Task queries; Task execution; Task completion; Status checking; Common response components
    CancelTaskRequest,
    CancelTaskResponse,
    CompleteTaskRequest,
    CompleteTaskResponse,
    CreateTaskRequest,
    CreateTaskResponse,
    DeleteTaskRequest,
    DeleteTaskResponse,
    ErrorDetail,
    ExecuteTaskRequest,
    ExecuteTaskResponse,
    GetStatusRequest,
    GetStatusResponse,
    MCPErrorResponse,
    NextStep,
    QueryTasksRequest,
    QueryTasksResponse,
    StatusSummary,
    TaskQueryResult,
    UpdateTaskRequest,
    UpdateTaskResponse,
)

__all__ = [
    # Task operations
    "CreateTaskRequest",
    "CreateTaskResponse",
    "UpdateTaskRequest",
    "UpdateTaskResponse",
    "DeleteTaskRequest",
    "DeleteTaskResponse",
    "CancelTaskRequest",
    "CancelTaskResponse",
    "QueryTasksRequest",
    "QueryTasksResponse",
    "TaskQueryResult",
    "ExecuteTaskRequest",
    "ExecuteTaskResponse",
    "CompleteTaskRequest",
    "CompleteTaskResponse",
    # Status operations
    "GetStatusRequest",
    "GetStatusResponse",
    "StatusSummary",
    # Common components
    "ErrorDetail",
    "NextStep",
    "MCPErrorResponse",
]
