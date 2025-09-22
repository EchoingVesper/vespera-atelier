"""
Common API Models

Shared Pydantic models used across multiple API endpoints.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from enum import Enum


class StatusEnum(str, Enum):
    """Task status enumeration."""
    TODO = "todo"
    DOING = "doing"
    REVIEW = "review"
    DONE = "done"
    BLOCKED = "blocked"
    CANCELLED = "cancelled"
    ARCHIVED = "archived"


class PriorityEnum(str, Enum):
    """Task priority enumeration."""
    CRITICAL = "critical"
    HIGH = "high"
    NORMAL = "normal"
    LOW = "low"
    SOMEDAY = "someday"


class APIResponse(BaseModel):
    """Standard API response wrapper."""
    success: bool = Field(..., description="Whether the operation was successful")
    message: Optional[str] = Field(None, description="Human-readable message about the operation")
    error: Optional[str] = Field(None, description="Error message if operation failed")
    data: Optional[Dict[str, Any]] = Field(None, description="Response data payload")


class PaginationParams(BaseModel):
    """Pagination parameters for list endpoints."""
    page: int = Field(1, ge=1, description="Page number (1-based)")
    size: int = Field(50, ge=1, le=1000, description="Number of items per page")
    
    @property
    def offset(self) -> int:
        """Calculate offset for database queries."""
        return (self.page - 1) * self.size


class PaginatedResponse(BaseModel):
    """Paginated response wrapper."""
    success: bool = Field(..., description="Whether the operation was successful")
    data: List[Any] = Field(..., description="List of items")
    pagination: Dict[str, Any] = Field(..., description="Pagination metadata")
    message: Optional[str] = Field(None, description="Optional message")
    
    @classmethod
    def create(cls, items: List[Any], page: int, size: int, total: int, message: str = None):
        """Create a paginated response."""
        total_pages = (total + size - 1) // size  # Ceiling division
        
        return cls(
            success=True,
            data=items,
            pagination={
                "page": page,
                "size": size,
                "total": total,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_prev": page > 1
            },
            message=message
        )


class FilterParams(BaseModel):
    """Common filtering parameters."""
    project_id: Optional[str] = Field(None, description="Filter by project ID")
    status: Optional[StatusEnum] = Field(None, description="Filter by status")
    priority: Optional[PriorityEnum] = Field(None, description="Filter by priority")
    assignee: Optional[str] = Field(None, description="Filter by assignee")
    created_after: Optional[datetime] = Field(None, description="Filter by creation date (after)")
    created_before: Optional[datetime] = Field(None, description="Filter by creation date (before)")
    tags: Optional[List[str]] = Field(None, description="Filter by tags (any match)")


class SortParams(BaseModel):
    """Sorting parameters."""
    sort_by: str = Field("created_at", description="Field to sort by")
    sort_order: str = Field("desc", pattern="^(asc|desc)$", description="Sort order")


class TaskSummary(BaseModel):
    """Lightweight task summary for list views."""
    id: str = Field(..., description="Task ID")
    title: str = Field(..., description="Task title")
    status: StatusEnum = Field(..., description="Current status")
    priority: PriorityEnum = Field(..., description="Task priority")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    project_id: Optional[str] = Field(None, description="Associated project ID")
    assignee: Optional[str] = Field(None, description="Assigned user")
    has_children: bool = Field(False, description="Whether task has subtasks")
    parent_id: Optional[str] = Field(None, description="Parent task ID if this is a subtask")


class HealthStatus(BaseModel):
    """System health status."""
    status: str = Field(..., description="Overall health status")
    timestamp: datetime = Field(..., description="Health check timestamp")
    components: Dict[str, str] = Field(..., description="Individual component statuses")
    version: str = Field(..., description="API version")


class ErrorDetail(BaseModel):
    """Detailed error information."""
    code: str = Field(..., description="Error code")
    message: str = Field(..., description="Error message")
    field: Optional[str] = Field(None, description="Field that caused the error")
    context: Optional[Dict[str, Any]] = Field(None, description="Additional error context")


class ValidationErrorResponse(BaseModel):
    """Validation error response."""
    success: bool = Field(False, description="Always false for errors")
    error: str = Field(..., description="Main error message")
    details: List[ErrorDetail] = Field(..., description="Detailed validation errors")


class PluginInfo(BaseModel):
    """Plugin registration information."""
    name: str = Field(..., description="Plugin name")
    version: str = Field(..., description="Plugin version")
    type: str = Field(..., pattern="^(vscode|obsidian|custom)$", description="Plugin type")
    capabilities: List[str] = Field(..., description="Plugin capabilities")
    webhook_url: Optional[str] = Field(None, description="Webhook URL for notifications")


class NotificationPreferences(BaseModel):
    """User notification preferences."""
    email_notifications: bool = Field(True, description="Enable email notifications")
    webhook_notifications: bool = Field(False, description="Enable webhook notifications")
    task_updates: bool = Field(True, description="Notify on task updates")
    project_updates: bool = Field(True, description="Notify on project updates")
    dependency_changes: bool = Field(True, description="Notify on dependency changes")


class APIMetrics(BaseModel):
    """API usage metrics."""
    requests_total: int = Field(..., description="Total number of requests")
    requests_per_minute: float = Field(..., description="Average requests per minute")
    average_response_time: float = Field(..., description="Average response time in ms")
    active_plugins: int = Field(..., description="Number of active plugins")
    tasks_managed: int = Field(..., description="Total tasks in system")
    searches_performed: int = Field(..., description="Total semantic searches performed")
    uptime_seconds: int = Field(..., description="Server uptime in seconds")