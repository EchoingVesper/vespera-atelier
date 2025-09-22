"""
Pydantic models for MCP tool inputs and outputs.
Serves as the contract between the FastMCP server and Rust Bindery backend.
"""

from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from enum import Enum


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


# Task Management Models
class TaskInput(BaseModel):
    """Input model for creating a new task."""
    title: str = Field(..., description="Task title")
    description: Optional[str] = Field(None, description="Task description")
    priority: Optional[TaskPriority] = Field(
        TaskPriority.NORMAL, description="Task priority level"
    )
    status: Optional[TaskStatus] = Field(TaskStatus.TODO, description="Task status")
    tags: Optional[List[str]] = Field(default_factory=list, description="Task tags")
    parent_id: Optional[str] = Field(None, description="Parent task ID for subtasks")
    project_id: Optional[str] = Field(None, description="Associated project ID")
    labels: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Task labels")
    subtasks: Optional[List["TaskInput"]] = Field(None, description="Nested subtasks")


class TaskOutput(BaseModel):
    """Output model for task operations."""
    id: str = Field(..., description="Task ID")
    title: str = Field(..., description="Task title")
    description: Optional[str] = Field(None, description="Task description")
    status: TaskStatus = Field(..., description="Task status")
    priority: TaskPriority = Field(..., description="Task priority")
    tags: List[str] = Field(default_factory=list, description="Task tags")
    labels: Dict[str, Any] = Field(default_factory=dict, description="Task labels")
    created_at: datetime = Field(..., description="Task creation timestamp")
    updated_at: datetime = Field(..., description="Task update timestamp")
    completed_at: Optional[datetime] = Field(None, description="Task completion timestamp")
    parent_id: Optional[str] = Field(None, description="Parent task ID")
    project_id: Optional[str] = Field(None, description="Associated project ID")
    children: List[str] = Field(default_factory=list, description="Child task IDs")


class TaskUpdateInput(BaseModel):
    """Input model for updating an existing task."""
    title: Optional[str] = Field(None, description="Updated task title")
    description: Optional[str] = Field(None, description="Updated task description")
    status: Optional[TaskStatus] = Field(
        None, description="Updated task status"
    )
    priority: Optional[TaskPriority] = Field(
        None, description="Updated task priority"
    )
    tags: Optional[List[str]] = Field(None, description="Updated task tags")
    labels: Optional[Dict[str, Any]] = Field(None, description="Updated task labels")
    project_id: Optional[str] = Field(None, description="Updated project ID")


# Project Management Models
class ProjectInput(BaseModel):
    """Input model for creating a new project."""
    name: str = Field(..., description="Project name")
    description: Optional[str] = Field(None, description="Project description")
    tags: Optional[List[str]] = Field(default_factory=list, description="Project tags")


class ProjectOutput(BaseModel):
    """Output model for project operations."""
    id: str = Field(..., description="Project ID")
    name: str = Field(..., description="Project name")
    description: Optional[str] = Field(None, description="Project description")
    tags: List[str] = Field(default_factory=list, description="Project tags")
    task_count: int = Field(0, description="Number of tasks in project")
    created_at: datetime = Field(..., description="Project creation timestamp")
    updated_at: datetime = Field(..., description="Project update timestamp")


# Search and Query Models
class SearchInput(BaseModel):
    """Input model for search operations."""
    query: str = Field(..., description="Search query string")
    entity_types: Optional[List[Literal["task", "project", "note"]]] = Field(
        default_factory=lambda: ["task", "project", "note"],
        description="Types of entities to search"
    )
    limit: Optional[int] = Field(10, description="Maximum number of results")
    include_archived: Optional[bool] = Field(False, description="Include archived items")


class SearchResult(BaseModel):
    """Single search result item."""
    id: str = Field(..., description="Entity ID")
    type: str = Field(..., description="Entity type")
    title: str = Field(..., description="Entity title")
    description: Optional[str] = Field(None, description="Entity description")
    relevance_score: float = Field(..., description="Search relevance score")
    tags: List[str] = Field(default_factory=list, description="Entity tags")


class SearchOutput(BaseModel):
    """Output model for search operations."""
    query: str = Field(..., description="Original search query")
    total_results: int = Field(..., description="Total number of results")
    results: List[SearchResult] = Field(..., description="Search results")


# Analytics and Dashboard Models
class DashboardStats(BaseModel):
    """Dashboard statistics model."""
    total_tasks: int = Field(0, description="Total number of tasks")
    completed_tasks: int = Field(0, description="Number of completed tasks")
    active_projects: int = Field(0, description="Number of active projects")
    pending_tasks_by_priority: Dict[str, int] = Field(
        default_factory=dict, description="Pending tasks grouped by priority"
    )
    recent_activity_count: int = Field(0, description="Recent activity items")


# Note Management Models
class NoteInput(BaseModel):
    """Input model for creating a new note."""
    title: str = Field(..., description="Note title")
    content: str = Field(..., description="Note content")
    tags: Optional[List[str]] = Field(default_factory=list, description="Note tags")
    project_id: Optional[str] = Field(None, description="Associated project ID")


class NoteOutput(BaseModel):
    """Output model for note operations."""
    id: str = Field(..., description="Note ID")
    title: str = Field(..., description="Note title")
    content: str = Field(..., description="Note content")
    tags: List[str] = Field(default_factory=list, description="Note tags")
    project_id: Optional[str] = Field(None, description="Associated project ID")
    created_at: datetime = Field(..., description="Note creation timestamp")
    updated_at: datetime = Field(..., description="Note update timestamp")


# Error Models
class BinderyError(BaseModel):
    """Error response from Bindery backend."""
    error: str = Field(..., description="Error message")
    code: Optional[str] = Field(None, description="Error code")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")


# Generic Response Models
class SuccessResponse(BaseModel):
    """Generic success response."""
    success: bool = Field(True, description="Operation success status")
    message: Optional[str] = Field(None, description="Success message")


class ListResponse(BaseModel):
    """Generic list response wrapper."""
    items: List[Dict[str, Any]] = Field(..., description="List of items")
    total: int = Field(..., description="Total number of items")
    page: Optional[int] = Field(None, description="Current page number")
    per_page: Optional[int] = Field(None, description="Items per page")


# Role Management Models
class RoleDefinition(BaseModel):
    """Role definition model."""
    name: str = Field(..., description="Role name")
    description: str = Field(..., description="Role description")
    capabilities: List[str] = Field(default_factory=list, description="Role capabilities")
    file_patterns: List[str] = Field(default_factory=list, description="Allowed file patterns")
    restrictions: Dict[str, Any] = Field(default_factory=dict, description="Role restrictions")
    model_context_limit: Optional[int] = Field(None, description="Model context limit in tokens")


# Document/RAG Models
class DocumentInput(BaseModel):
    """Input model for document indexing."""
    content: str = Field(..., description="Document content")
    title: str = Field(..., description="Document title")
    document_type: DocumentType = Field(DocumentType.TEXT, description="Document type")
    source_path: Optional[str] = Field(None, description="Source file path")
    tags: Optional[List[str]] = Field(default_factory=list, description="Document tags")
    project_id: Optional[str] = Field(None, description="Associated project ID")


# Additional Response Models
class DeleteTaskResponse(BaseModel):
    """Response for delete task operation."""
    success: bool = Field(..., description="Operation success status")
    task_id: str = Field(..., description="Deleted task ID")
    message: Optional[str] = Field(None, description="Additional message")


class CompleteTaskResponse(BaseModel):
    """Response for complete task operation."""
    success: bool = Field(..., description="Operation success status")
    task: TaskOutput = Field(..., description="Completed task data")
    completion_notes: Optional[str] = Field(None, description="Completion notes")


class ExecuteTaskResponse(BaseModel):
    """Response for execute task operation."""
    success: bool = Field(..., description="Operation success status")
    task_id: str = Field(..., description="Task ID")
    role_assigned: str = Field(..., description="Assigned role")
    execution_id: Optional[str] = Field(None, description="Execution ID for tracking")