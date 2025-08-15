"""
Task-related MCP Protocol DTOs with type safety and validation.

These Pydantic models replace dictionary-based request/response patterns
with strongly-typed, validated models that ensure type safety across
the MCP protocol boundary.
"""

from datetime import datetime
from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, Field, validator, ConfigDict, field_validator
from enum import Enum

# Import domain value objects
from ....domain.value_objects.task_status import TaskStatus
from ....domain.value_objects.complexity_level import ComplexityLevel
from ....domain.value_objects.specialist_type import SpecialistType

# Import security framework for input validation
from ...security.validators import (
    validate_string_input,
    validate_task_id,
    ValidationError as SecurityValidationError
)


class ErrorDetail(BaseModel):
    """Detailed error information for responses."""
    error: str
    error_type: Optional[str] = None
    details: Optional[str] = None
    component: Optional[str] = None
    operation: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class NextStep(BaseModel):
    """Represents a suggested next step in a workflow."""
    action: str
    description: Optional[str] = None
    tool_name: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None


# Task Creation/Planning DTOs
class CreateTaskRequest(BaseModel):
    """Request model for creating a new task with comprehensive security validation."""
    title: str = Field(..., min_length=1, max_length=255, description="Task title")
    description: str = Field(..., min_length=1, max_length=2000, description="Task description")
    task_type: str = Field(default="STANDARD", description="Type of task")
    complexity: Optional[str] = Field(default="moderate", description="Task complexity level")
    specialist_type: Optional[str] = Field(default="generalist", description="Required specialist type")
    parent_task_id: Optional[str] = Field(None, description="Parent task identifier")
    dependencies: Optional[List[str]] = Field(default_factory=list, description="Task dependencies")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional metadata")
    due_date: Optional[datetime] = Field(None, description="Task due date")
    priority: Optional[int] = Field(default=5, ge=1, le=10, description="Task priority")
    
    # Security validators for XSS prevention and input sanitization
    @field_validator('title', 'description')
    @classmethod
    def prevent_xss_and_sanitize(cls, v: str, info) -> str:
        """Prevent XSS attacks and sanitize input in text fields."""
        if not v:
            return v
        
        try:
            field_name = info.field_name if info else "text_field"
            sanitized_value = validate_string_input(v, field_name, max_length=2000)
            return sanitized_value.strip()
        except SecurityValidationError as e:
            raise ValueError(f"Security validation failed for {info.field_name if info else 'field'}: {str(e)}")
    
    @field_validator('parent_task_id')
    @classmethod
    def validate_parent_task_identifier(cls, v: Optional[str]) -> Optional[str]:
        """Validate parent task ID if provided."""
        if v is None:
            return v
        
        try:
            return validate_task_id(v)
        except SecurityValidationError as e:
            raise ValueError(f"Invalid parent task ID format: {str(e)}")
    
    @field_validator('dependencies')
    @classmethod
    def validate_dependency_identifiers(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        """Validate all dependency task IDs."""
        if not v:
            return v
        
        validated_deps = []
        for dep_id in v:
            try:
                validated_deps.append(validate_task_id(dep_id))
            except SecurityValidationError as e:
                raise ValueError(f"Invalid dependency task ID '{dep_id}': {str(e)}")
        
        return validated_deps

    model_config = ConfigDict(
        extra='forbid',                    # Reject unknown fields
        validate_assignment=True,          # Runtime validation
        str_strip_whitespace=True,        # Auto-sanitization
        use_enum_values=True
    )
    tags: Optional[List[str]] = Field(default_factory=list)
    
    @validator('complexity')
    def validate_complexity(cls, v):
        """Validate complexity level."""
        valid_levels = [c.value for c in ComplexityLevel]
        if v and v not in valid_levels:
            raise ValueError(f"Invalid complexity level. Must be one of: {valid_levels}")
        return v
    
    @validator('specialist_type')
    def validate_specialist_type(cls, v):
        """Validate specialist type."""
        # Allow flexible specialist types
        return v or "generalist"


class CreateTaskResponse(BaseModel):
    """Response model for task creation."""
    status: str = Field(default="success")
    message: str
    task_id: str
    task_title: str
    task_type: str
    created_at: datetime
    next_steps: List[NextStep] = Field(default_factory=list)
    warnings: Optional[List[str]] = Field(default_factory=list)


# Task Update DTOs
class UpdateTaskRequest(BaseModel):
    """Request model for updating a task with comprehensive security validation."""
    task_id: str = Field(..., min_length=1, description="Task identifier to update")
    title: Optional[str] = Field(None, min_length=1, max_length=255, description="Updated task title")
    description: Optional[str] = Field(None, min_length=1, max_length=2000, description="Updated task description")
    status: Optional[str] = Field(None, description="Updated task status")
    complexity: Optional[str] = Field(None, description="Updated task complexity")
    specialist_type: Optional[str] = Field(None, description="Updated specialist type")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Updated metadata")
    due_date: Optional[datetime] = Field(None, description="Updated due date")
    priority: Optional[int] = Field(None, ge=1, le=10, description="Updated priority")
    tags: Optional[List[str]] = Field(None, description="Updated tags")
    
    # Security validators for XSS prevention and input sanitization
    @field_validator('title', 'description')
    @classmethod
    def prevent_xss_and_sanitize(cls, v: Optional[str], info) -> Optional[str]:
        """Prevent XSS attacks and sanitize input in text fields."""
        if v is None:
            return v
        
        try:
            field_name = info.field_name if info else "text_field"
            sanitized_value = validate_string_input(v, field_name, max_length=2000)
            return sanitized_value.strip()
        except SecurityValidationError as e:
            raise ValueError(f"Security validation failed for {info.field_name if info else 'field'}: {str(e)}")
    
    @field_validator('task_id')
    @classmethod
    def validate_task_identifier(cls, v: str) -> str:
        """Validate task ID for security and format compliance."""
        try:
            return validate_task_id(v)
        except SecurityValidationError as e:
            raise ValueError(f"Invalid task ID format: {str(e)}")
    
    @validator('status')
    def validate_status(cls, v):
        """Validate task status."""
        if v:
            valid_statuses = [s.value for s in TaskStatus]
            if v not in valid_statuses:
                raise ValueError(f"Invalid status. Must be one of: {valid_statuses}")
        return v

    model_config = ConfigDict(
        extra='forbid',                    # Reject unknown fields
        validate_assignment=True,          # Runtime validation
        str_strip_whitespace=True,        # Auto-sanitization
        use_enum_values=True
    )


class UpdateTaskResponse(BaseModel):
    """Response model for task update."""
    status: str = Field(default="success")
    message: str
    task_id: str
    updated_fields: List[str]
    updated_at: datetime
    task_status: str
    next_steps: List[NextStep] = Field(default_factory=list)


# Task Deletion DTOs
class DeleteTaskRequest(BaseModel):
    """Request model for deleting a task."""
    task_id: str = Field(..., min_length=1)
    force: bool = Field(default=False)
    archive_instead: bool = Field(default=True)
    cascade_delete: bool = Field(default=False)
    reason: Optional[str] = None


class DeleteTaskResponse(BaseModel):
    """Response model for task deletion."""
    status: str = Field(default="success")
    message: str
    task_id: str
    action_taken: str  # "deleted", "archived", "marked_deleted"
    affected_tasks: List[str] = Field(default_factory=list)
    deletion_time: datetime
    next_steps: List[NextStep] = Field(default_factory=list)


# Task Cancellation DTOs
class CancelTaskRequest(BaseModel):
    """Request model for cancelling a task."""
    task_id: str = Field(..., min_length=1)
    reason: str = Field(default="No reason provided")
    preserve_work: bool = Field(default=True)
    notify_dependents: bool = Field(default=True)


class CancelTaskResponse(BaseModel):
    """Response model for task cancellation."""
    status: str = Field(default="cancelled")
    message: str
    task_id: str
    preserved_artifacts: List[str] = Field(default_factory=list)
    affected_dependents: List[str] = Field(default_factory=list)
    cancellation_time: datetime
    next_steps: List[NextStep] = Field(default_factory=list)


# Task Query DTOs
class TaskQueryResult(BaseModel):
    """Individual task result in query response."""
    task_id: str
    title: str
    description: str
    status: str
    task_type: str
    complexity: str
    specialist_type: str
    created_at: datetime
    updated_at: datetime
    progress: Optional[float] = Field(None, ge=0, le=100)
    parent_task_id: Optional[str] = None
    subtask_ids: List[str] = Field(default_factory=list)
    dependency_ids: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class QueryTasksRequest(BaseModel):
    """Request model for querying tasks."""
    # Filtering criteria
    status: Optional[Union[str, List[str]]] = None
    task_type: Optional[Union[str, List[str]]] = None
    specialist_type: Optional[Union[str, List[str]]] = None
    parent_task_id: Optional[str] = None
    tags: Optional[List[str]] = None
    
    # Search parameters
    search_text: Optional[str] = None
    search_fields: Optional[List[str]] = Field(
        default_factory=lambda: ["title", "description"]
    )
    
    # Time-based filters
    created_after: Optional[datetime] = None
    created_before: Optional[datetime] = None
    updated_after: Optional[datetime] = None
    updated_before: Optional[datetime] = None
    
    # Pagination
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    
    # Sorting
    sort_by: str = Field(default="updated_at")
    sort_order: str = Field(default="desc", pattern="^(asc|desc)$")
    
    # Additional options
    include_archived: bool = Field(default=False)
    include_metadata: bool = Field(default=True)
    include_subtasks: bool = Field(default=False)


class QueryTasksResponse(BaseModel):
    """Response model for task queries."""
    status: str = Field(default="success")
    message: str
    query_summary: Dict[str, Any]
    tasks: List[TaskQueryResult]
    pagination: Dict[str, Any] = Field(default_factory=dict)
    filters_applied: List[str] = Field(default_factory=list)
    total_count: int
    page_count: int
    next_steps: List[NextStep] = Field(default_factory=list)


# Task Execution DTOs
class ExecuteTaskRequest(BaseModel):
    """Request model for executing a task."""
    task_id: str = Field(..., min_length=1)
    execution_context: Optional[Dict[str, Any]] = Field(default_factory=dict)
    override_specialist: Optional[str] = None
    max_execution_time: Optional[int] = Field(None, gt=0)  # seconds
    
    
class ExecuteTaskResponse(BaseModel):
    """Response model for task execution."""
    status: str = Field(default="ready_for_execution")
    task_id: str
    task_title: str
    task_description: str
    specialist_type: str
    specialist_context: str
    specialist_prompts: List[str]
    execution_instructions: List[str]
    dependencies_completed: bool
    estimated_effort: str
    execution_warnings: Optional[List[str]] = Field(default_factory=list)
    next_steps: List[NextStep] = Field(default_factory=list)


# Task Completion DTOs
class CompleteTaskRequest(BaseModel):
    """Request model for completing a task."""
    task_id: str = Field(..., min_length=1)
    summary: str = Field(..., min_length=1)
    detailed_work: str = Field(..., min_length=1)
    next_action: str = Field(..., min_length=1)
    
    # Optional completion details
    artifacts: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    metrics: Optional[Dict[str, Any]] = Field(default_factory=dict)
    issues_encountered: Optional[List[str]] = Field(default_factory=list)
    recommendations: Optional[List[str]] = Field(default_factory=list)
    
    # Completion metadata
    completion_quality: Optional[float] = Field(None, ge=0, le=1)
    actual_effort: Optional[str] = None
    
    
class CompleteTaskResponse(BaseModel):
    """Response model for task completion."""
    status: str = Field(default="success")
    task_id: str
    message: str
    summary: str
    artifact_count: int
    artifact_references: List[str] = Field(default_factory=list)
    next_action: str
    completion_time: datetime
    task_duration_minutes: Optional[float] = None
    parent_task_progress: Optional[Dict[str, Any]] = None
    triggered_tasks: List[str] = Field(default_factory=list)
    next_steps: List[NextStep] = Field(default_factory=list)


# Status Checking DTOs
class StatusSummary(BaseModel):
    """Summary of system or task status."""
    total_tasks: int
    active_tasks: int
    completed_tasks: int
    failed_tasks: int
    pending_tasks: int
    avg_completion_time_minutes: Optional[float] = None
    system_health: str = Field(default="healthy")
    warnings: List[str] = Field(default_factory=list)


class GetStatusRequest(BaseModel):
    """Request model for getting status."""
    scope: str = Field(default="session", pattern="^(session|task|system)$")
    task_id: Optional[str] = None  # Required if scope is "task"
    include_details: bool = Field(default=True)
    include_metrics: bool = Field(default=False)
    time_range_hours: Optional[int] = Field(None, gt=0)
    
    @validator('task_id')
    def validate_task_id(cls, v, values):
        """Ensure task_id is provided when scope is 'task'."""
        if values.get('scope') == 'task' and not v:
            raise ValueError("task_id is required when scope is 'task'")
        return v


class GetStatusResponse(BaseModel):
    """Response model for status requests."""
    status: str = Field(default="success")
    scope: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    summary: StatusSummary
    active_tasks: Optional[List[TaskQueryResult]] = None
    completed_tasks: Optional[List[TaskQueryResult]] = None
    session_info: Optional[Dict[str, Any]] = None
    metrics: Optional[Dict[str, Any]] = None
    next_steps: List[NextStep] = Field(default_factory=list)


# Error Response DTOs (unified)
class MCPErrorResponse(BaseModel):
    """Unified error response for all MCP operations."""
    status: str = Field(default="error")
    error: ErrorDetail
    tool: str
    request_id: Optional[str] = None
    recovery_suggestions: List[str] = Field(default_factory=list)
    partial_result: Optional[Dict[str, Any]] = None
    
    @classmethod
    def from_exception(
        cls, 
        exception: Exception, 
        tool: str,
        component: Optional[str] = None,
        operation: Optional[str] = None,
        **kwargs
    ) -> "MCPErrorResponse":
        """Create error response from exception."""
        error_detail = ErrorDetail(
            error=str(exception),
            error_type=type(exception).__name__,
            component=component,
            operation=operation
        )
        
        return cls(
            error=error_detail,
            tool=tool,
            **kwargs
        )