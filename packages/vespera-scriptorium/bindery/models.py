"""
Pydantic models for Vespera Bindery MCP tools.

This module defines the input/output models for MCP tools that communicate
with the Rust Bindery backend via JSON-RPC 2.0 protocol.
"""

from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict


# Enums
class TaskStatus(str, Enum):
    """Task status enumeration matching Bindery backend."""
    TODO = "todo"
    DOING = "doing"
    DONE = "done"
    BLOCKED = "blocked"
    CANCELLED = "cancelled"


class TaskPriority(str, Enum):
    """Task priority enumeration matching Bindery backend."""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class DocumentType(str, Enum):
    """Document type enumeration for RAG indexing."""
    TEXT = "text"
    CODE = "code"
    MARKDOWN = "markdown"
    DOCUMENTATION = "documentation"
    CONFIGURATION = "configuration"
    DATA = "data"


class HealthStatus(str, Enum):
    """Health status enumeration."""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


# Base Models
class BinderyResponse(BaseModel):
    """Base response model from Bindery backend."""
    model_config = ConfigDict(extra="allow")

    success: bool = Field(description="Whether the operation was successful")
    error: Optional[str] = Field(None, description="Error message if operation failed")
    message: Optional[str] = Field(None, description="Additional information")


# Task Management Models
class TaskInput(BaseModel):
    """Input model for creating/updating tasks."""
    title: str = Field(description="Task title")
    description: Optional[str] = Field(None, description="Task description")
    priority: Optional[TaskPriority] = Field(TaskPriority.NORMAL, description="Task priority")
    status: Optional[TaskStatus] = Field(TaskStatus.TODO, description="Task status")
    project_id: Optional[str] = Field(None, description="Project ID")
    parent_id: Optional[str] = Field(None, description="Parent task ID")
    tags: Optional[List[str]] = Field(None, description="Task tags")
    labels: Optional[Dict[str, Any]] = Field(None, description="Task labels")
    subtasks: Optional[List["TaskInput"]] = Field(None, description="Subtasks")


class TaskOutput(BaseModel):
    """Output model for task data."""
    id: str = Field(description="Task ID")
    title: str = Field(description="Task title")
    description: Optional[str] = Field(None, description="Task description")
    priority: TaskPriority = Field(description="Task priority")
    status: TaskStatus = Field(description="Task status")
    project_id: Optional[str] = Field(None, description="Project ID")
    parent_id: Optional[str] = Field(None, description="Parent task ID")
    tags: List[str] = Field(default_factory=list, description="Task tags")
    labels: Dict[str, Any] = Field(default_factory=dict, description="Task labels")
    created_at: datetime = Field(description="Creation timestamp")
    updated_at: datetime = Field(description="Last update timestamp")
    completed_at: Optional[datetime] = Field(None, description="Completion timestamp")


class CreateTaskInput(BaseModel):
    """Input for create_task MCP tool."""
    task: TaskInput = Field(description="Task data to create")


class CreateTaskOutput(BinderyResponse):
    """Output for create_task MCP tool."""
    task: Optional[TaskOutput] = Field(None, description="Created task data")


class GetTaskInput(BaseModel):
    """Input for get_task MCP tool."""
    task_id: str = Field(description="Task ID to retrieve")


class GetTaskOutput(BinderyResponse):
    """Output for get_task MCP tool."""
    task: Optional[TaskOutput] = Field(None, description="Task data")


class UpdateTaskInput(BaseModel):
    """Input for update_task MCP tool."""
    task_id: str = Field(description="Task ID to update")
    updates: Dict[str, Any] = Field(description="Fields to update")


class UpdateTaskOutput(BinderyResponse):
    """Output for update_task MCP tool."""
    task: Optional[TaskOutput] = Field(None, description="Updated task data")


class ListTasksInput(BaseModel):
    """Input for list_tasks MCP tool."""
    project_id: Optional[str] = Field(None, description="Filter by project ID")
    status: Optional[TaskStatus] = Field(None, description="Filter by status")
    priority: Optional[TaskPriority] = Field(None, description="Filter by priority")
    parent_id: Optional[str] = Field(None, description="Filter by parent task ID")
    limit: Optional[int] = Field(100, description="Maximum number of tasks to return")
    offset: Optional[int] = Field(0, description="Number of tasks to skip")


class ListTasksOutput(BinderyResponse):
    """Output for list_tasks MCP tool."""
    tasks: List[TaskOutput] = Field(default_factory=list, description="List of tasks")
    total: int = Field(0, description="Total number of tasks")
    has_more: bool = Field(False, description="Whether there are more tasks")


class ExecuteTaskInput(BaseModel):
    """Input for execute_task MCP tool."""
    task_id: str = Field(description="Task ID to execute")
    role: Optional[str] = Field(None, description="Role to execute task with")
    dry_run: bool = Field(False, description="Whether to perform a dry run")


class ExecuteTaskOutput(BinderyResponse):
    """Output for execute_task MCP tool."""
    task: Optional[TaskOutput] = Field(None, description="Updated task data")
    execution_log: Optional[str] = Field(None, description="Execution log")
    role_used: Optional[str] = Field(None, description="Role used for execution")


class DeleteTaskInput(BaseModel):
    """Input for delete_task MCP tool."""
    task_id: str = Field(description="Task ID to delete")


class DeleteTaskOutput(BinderyResponse):
    """Output for delete_task MCP tool."""
    task_id: Optional[str] = Field(None, description="Deleted task ID")


class CompleteTaskInput(BaseModel):
    """Input for complete_task MCP tool."""
    task_id: str = Field(description="Task ID to mark as completed")
    completion_notes: Optional[str] = Field(None, description="Optional completion notes")


class CompleteTaskOutput(BinderyResponse):
    """Output for complete_task MCP tool."""
    task: Optional[TaskOutput] = Field(None, description="Completed task data")


class TaskTreeNode(BaseModel):
    """Task tree node model for hierarchical task structures."""
    task: TaskOutput = Field(description="Task data")
    children: List["TaskTreeNode"] = Field(default_factory=list, description="Child tasks")
    depth: int = Field(0, description="Depth in the tree")


class CreateTaskTreeInput(BaseModel):
    """Input for create_task_tree MCP tool."""
    root_task: TaskInput = Field(description="Root task data")
    children: Optional[List["CreateTaskTreeInput"]] = Field(None, description="Child task trees")


class CreateTaskTreeOutput(BinderyResponse):
    """Output for create_task_tree MCP tool."""
    task_tree: Optional[TaskTreeNode] = Field(None, description="Created task tree")
    total_tasks_created: int = Field(0, description="Total number of tasks created")


class GetTaskTreeInput(BaseModel):
    """Input for get_task_tree MCP tool."""
    root_task_id: str = Field(description="Root task ID")
    max_depth: Optional[int] = Field(None, description="Maximum depth to retrieve")
    include_completed: bool = Field(True, description="Whether to include completed tasks")


class GetTaskTreeOutput(BinderyResponse):
    """Output for get_task_tree MCP tool."""
    task_tree: Optional[TaskTreeNode] = Field(None, description="Task tree")
    total_tasks: int = Field(0, description="Total number of tasks in tree")


class AssignRoleToTaskInput(BaseModel):
    """Input for assign_role_to_task MCP tool."""
    task_id: str = Field(description="Task ID")
    role_name: str = Field(description="Role name to assign")


class AssignRoleToTaskOutput(BinderyResponse):
    """Output for assign_role_to_task MCP tool."""
    task_id: Optional[str] = Field(None, description="Task ID")
    role_assigned: Optional[str] = Field(None, description="Role that was assigned")


class RoleDefinition(BaseModel):
    """Role definition model."""
    name: str = Field(description="Role name")
    description: str = Field(description="Role description")
    capabilities: List[str] = Field(default_factory=list, description="Role capabilities")
    file_patterns: List[str] = Field(default_factory=list, description="File patterns this role can access")
    restrictions: Dict[str, Any] = Field(default_factory=dict, description="Role restrictions")


class ListRolesInput(BaseModel):
    """Input for list_roles MCP tool."""
    include_capabilities: bool = Field(True, description="Whether to include role capabilities")


class ListRolesOutput(BinderyResponse):
    """Output for list_roles MCP tool."""
    roles: List[RoleDefinition] = Field(default_factory=list, description="Available roles")
    total_roles: int = Field(0, description="Total number of roles")


# RAG/Search Models
class IndexDocumentInput(BaseModel):
    """Input for index_document MCP tool."""
    content: str = Field(description="Document content to index")
    title: str = Field(description="Document title")
    document_type: Optional[DocumentType] = Field(DocumentType.TEXT, description="Document type")
    source_path: Optional[str] = Field(None, description="Source file path")
    tags: Optional[List[str]] = Field(None, description="Document tags")
    project_id: Optional[str] = Field(None, description="Project ID")


class DocumentMetadata(BaseModel):
    """Document metadata model."""
    id: str = Field(description="Document ID")
    title: str = Field(description="Document title")
    document_type: DocumentType = Field(description="Document type")
    source_path: Optional[str] = Field(None, description="Source file path")
    content_hash: str = Field(description="Content hash")
    indexed_at: datetime = Field(description="Indexing timestamp")
    updated_at: datetime = Field(description="Last update timestamp")
    tags: List[str] = Field(default_factory=list, description="Document tags")
    project_id: Optional[str] = Field(None, description="Project ID")


class IndexDocumentOutput(BinderyResponse):
    """Output for index_document MCP tool."""
    document: Optional[DocumentMetadata] = Field(None, description="Indexed document metadata")


class SearchRagInput(BaseModel):
    """Input for search_rag MCP tool."""
    query: str = Field(description="Search query")
    limit: Optional[int] = Field(10, description="Maximum number of results")
    project_id: Optional[str] = Field(None, description="Filter by project ID")
    document_type: Optional[DocumentType] = Field(None, description="Filter by document type")
    min_score: Optional[float] = Field(0.0, description="Minimum similarity score")


class SearchResult(BaseModel):
    """Search result model."""
    document_id: str = Field(description="Document ID")
    chunk_id: str = Field(description="Chunk ID")
    content: str = Field(description="Content chunk")
    score: float = Field(description="Similarity score")
    metadata: DocumentMetadata = Field(description="Document metadata")


class SearchRagOutput(BinderyResponse):
    """Output for search_rag MCP tool."""
    query: str = Field(description="Original search query")
    results: List[SearchResult] = Field(default_factory=list, description="Search results")
    total_results: int = Field(0, description="Total number of results found")


# Dashboard Models
class TaskStatistics(BaseModel):
    """Task statistics for dashboard."""
    total: int = Field(description="Total number of tasks")
    by_status: Dict[str, int] = Field(default_factory=dict, description="Tasks by status")
    by_priority: Dict[str, int] = Field(default_factory=dict, description="Tasks by priority")
    completion_rate: float = Field(description="Task completion rate")
    overdue: int = Field(0, description="Number of overdue tasks")


class ProjectStatistics(BaseModel):
    """Project statistics for dashboard."""
    total_projects: int = Field(description="Total number of projects")
    active_projects: int = Field(description="Number of active projects")
    project_health: Dict[str, str] = Field(default_factory=dict, description="Project health scores")


class RAGStatistics(BaseModel):
    """RAG system statistics for dashboard."""
    total_documents: int = Field(description="Total number of indexed documents")
    total_chunks: int = Field(description="Total number of document chunks")
    index_size_bytes: int = Field(description="Index size in bytes")
    last_indexed: Optional[datetime] = Field(None, description="Last indexing timestamp")


class GetTaskDashboardInput(BaseModel):
    """Input for get_task_dashboard MCP tool."""
    project_id: Optional[str] = Field(None, description="Filter by project ID")


class GetTaskDashboardOutput(BinderyResponse):
    """Output for get_task_dashboard MCP tool."""
    task_stats: TaskStatistics = Field(description="Task statistics")
    project_stats: ProjectStatistics = Field(description="Project statistics")
    rag_stats: RAGStatistics = Field(description="RAG system statistics")
    generated_at: datetime = Field(description="Dashboard generation timestamp")


# JSON-RPC Models for internal communication
class JsonRpcRequest(BaseModel):
    """JSON-RPC 2.0 request model."""
    jsonrpc: str = Field("2.0", description="JSON-RPC version")
    method: str = Field(description="Method name")
    params: Optional[Dict[str, Any]] = Field(None, description="Method parameters")
    id: Union[str, int, None] = Field(None, description="Request ID")


class JsonRpcResponse(BaseModel):
    """JSON-RPC 2.0 response model."""
    jsonrpc: str = Field("2.0", description="JSON-RPC version")
    id: Union[str, int, None] = Field(None, description="Request ID")
    result: Optional[Any] = Field(None, description="Method result")
    error: Optional[Dict[str, Any]] = Field(None, description="Error information")


class JsonRpcError(BaseModel):
    """JSON-RPC 2.0 error model."""
    code: int = Field(description="Error code")
    message: str = Field(description="Error message")
    data: Optional[Any] = Field(None, description="Additional error data")


# Fix forward references
TaskInput.model_rebuild()
TaskTreeNode.model_rebuild()
CreateTaskTreeInput.model_rebuild()