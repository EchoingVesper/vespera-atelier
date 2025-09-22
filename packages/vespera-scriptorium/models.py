"""
Pydantic models for MCP tool inputs and outputs.
Serves as the contract between the FastMCP server and Rust Bindery backend.
"""

from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field
from datetime import datetime


# Task Management Models
class TaskInput(BaseModel):
    """Input model for creating a new task."""
    title: str = Field(..., description="Task title")
    description: Optional[str] = Field(None, description="Task description")
    priority: Optional[Literal["low", "medium", "high", "urgent"]] = Field(
        "medium", description="Task priority level"
    )
    tags: Optional[List[str]] = Field(default_factory=list, description="Task tags")
    parent_id: Optional[str] = Field(None, description="Parent task ID for subtasks")


class TaskOutput(BaseModel):
    """Output model for task operations."""
    id: str = Field(..., description="Task ID")
    title: str = Field(..., description="Task title")
    description: Optional[str] = Field(None, description="Task description")
    status: str = Field(..., description="Task status")
    priority: str = Field(..., description="Task priority")
    tags: List[str] = Field(default_factory=list, description="Task tags")
    created_at: datetime = Field(..., description="Task creation timestamp")
    updated_at: datetime = Field(..., description="Task update timestamp")
    parent_id: Optional[str] = Field(None, description="Parent task ID")
    children: List[str] = Field(default_factory=list, description="Child task IDs")


class TaskUpdateInput(BaseModel):
    """Input model for updating an existing task."""
    title: Optional[str] = Field(None, description="Updated task title")
    description: Optional[str] = Field(None, description="Updated task description")
    status: Optional[Literal["pending", "in_progress", "completed", "cancelled"]] = Field(
        None, description="Updated task status"
    )
    priority: Optional[Literal["low", "medium", "high", "urgent"]] = Field(
        None, description="Updated task priority"
    )
    tags: Optional[List[str]] = Field(None, description="Updated task tags")


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