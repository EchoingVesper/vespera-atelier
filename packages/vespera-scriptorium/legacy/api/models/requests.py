"""
API Request Models

Pydantic models for API request payloads.
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from .common import StatusEnum, PriorityEnum, PluginInfo


class TaskCreateRequest(BaseModel):
    """Request model for creating a new task."""
    title: str = Field(..., min_length=1, max_length=500, description="Task title")
    description: str = Field("", max_length=10000, description="Task description")
    parent_id: Optional[str] = Field(None, description="Parent task ID for subtasks")
    project_id: Optional[str] = Field(None, description="Project identifier")
    feature: Optional[str] = Field(None, description="Feature area")
    priority: PriorityEnum = Field(PriorityEnum.NORMAL, description="Task priority")
    due_date: Optional[datetime] = Field(None, description="Task due date")
    assignee: Optional[str] = Field(None, description="Assigned user")
    tags: List[str] = Field(default_factory=list, description="Task tags")
    labels: Dict[str, str] = Field(default_factory=dict, description="Key-value labels")
    estimated_effort: Optional[str] = Field(None, description="Estimated effort (e.g., '2 hours')")
    complexity: str = Field("moderate", pattern="^(trivial|simple|moderate|complex|very_complex)$", description="Task complexity")
    
    @validator('tags')
    def validate_tags(cls, v):
        """Validate tags are non-empty and unique."""
        if v:
            v = [tag.strip() for tag in v if tag.strip()]
            v = list(set(v))  # Remove duplicates
        return v


class TaskUpdateRequest(BaseModel):
    """Request model for updating an existing task."""
    title: Optional[str] = Field(None, min_length=1, max_length=500, description="New task title")
    description: Optional[str] = Field(None, max_length=10000, description="New task description")
    status: Optional[StatusEnum] = Field(None, description="New task status")
    priority: Optional[PriorityEnum] = Field(None, description="New task priority")
    due_date: Optional[datetime] = Field(None, description="New due date")
    assignee: Optional[str] = Field(None, description="New assigned user")
    tags: Optional[List[str]] = Field(None, description="New task tags")
    labels: Optional[Dict[str, str]] = Field(None, description="New key-value labels")
    estimated_effort: Optional[str] = Field(None, description="New estimated effort")
    actual_effort: Optional[str] = Field(None, description="Actual effort spent")
    complexity: Optional[str] = Field(None, pattern="^(trivial|simple|moderate|complex|very_complex)$", description="New task complexity")
    
    @validator('tags')
    def validate_tags(cls, v):
        """Validate tags are non-empty and unique."""
        if v is not None:
            v = [tag.strip() for tag in v if tag.strip()]
            v = list(set(v))  # Remove duplicates
        return v


class SubtaskRequest(BaseModel):
    """Request model for defining a subtask in a task tree."""
    title: str = Field(..., min_length=1, max_length=500, description="Subtask title")
    description: str = Field("", max_length=10000, description="Subtask description")
    priority: PriorityEnum = Field(PriorityEnum.NORMAL, description="Subtask priority")
    assignee: Optional[str] = Field(None, description="Assigned user")
    order: Optional[int] = Field(None, description="Order within parent task")
    estimated_effort: Optional[str] = Field(None, description="Estimated effort")
    tags: List[str] = Field(default_factory=list, description="Subtask tags")


class TaskTreeCreateRequest(BaseModel):
    """Request model for creating a hierarchical task tree."""
    title: str = Field(..., min_length=1, max_length=500, description="Root task title")
    description: str = Field("", max_length=10000, description="Root task description")
    project_id: Optional[str] = Field(None, description="Project identifier")
    feature: Optional[str] = Field(None, description="Feature area")
    priority: PriorityEnum = Field(PriorityEnum.NORMAL, description="Root task priority")
    subtasks: List[SubtaskRequest] = Field(..., min_items=1, description="List of subtasks")
    
    @validator('subtasks')
    def validate_subtasks(cls, v):
        """Validate subtasks have unique titles."""
        if v:
            titles = [subtask.title for subtask in v]
            if len(titles) != len(set(titles)):
                raise ValueError("Subtask titles must be unique")
        return v


class TaskCompleteRequest(BaseModel):
    """Request model for completing a task."""
    output: str = Field("", max_length=10000, description="Task completion output")
    artifacts: List[str] = Field(default_factory=list, description="Generated artifacts (file paths, URLs, etc.)")
    actual_effort: Optional[str] = Field(None, description="Actual effort spent")
    notes: Optional[str] = Field(None, max_length=5000, description="Completion notes")


class TaskDependencyRequest(BaseModel):
    """Request model for adding task dependencies."""
    depends_on_task_id: str = Field(..., description="ID of the task that this task depends on")
    dependency_type: str = Field("depends_on", pattern="^(depends_on|blocks|relates_to)$", description="Type of dependency")


class SemanticSearchRequest(BaseModel):
    """Request model for semantic task search."""
    query: str = Field(..., min_length=1, max_length=1000, description="Search query")
    n_results: int = Field(10, ge=1, le=100, description="Maximum number of results")
    min_similarity: float = Field(0.0, ge=0.0, le=1.0, description="Minimum similarity score")
    project_filter: Optional[str] = Field(None, description="Filter by project ID")
    status_filter: Optional[StatusEnum] = Field(None, description="Filter by status")
    priority_filter: Optional[PriorityEnum] = Field(None, description="Filter by priority")
    include_completed: bool = Field(True, description="Include completed tasks in search")


class SimilarTasksRequest(BaseModel):
    """Request model for finding similar tasks."""
    n_results: int = Field(5, ge=1, le=20, description="Maximum number of similar tasks")
    min_similarity: float = Field(0.5, ge=0.0, le=1.0, description="Minimum similarity score")
    same_project_only: bool = Field(False, description="Only find tasks in the same project")


class ClusteringRequest(BaseModel):
    """Request model for semantic task clustering."""
    project_id: Optional[str] = Field(None, description="Project to cluster (all projects if None)")
    num_clusters: int = Field(5, ge=2, le=20, description="Number of clusters to create")
    similarity_threshold: float = Field(0.7, ge=0.1, le=1.0, description="Minimum similarity threshold")
    include_completed: bool = Field(True, description="Include completed tasks in clustering")
    min_cluster_size: int = Field(2, ge=2, le=10, description="Minimum tasks per cluster")


class ImpactAnalysisRequest(BaseModel):
    """Request model for task impact analysis."""
    change_type: str = Field(..., pattern="^(complete|delay|delete|update)$", description="Type of change to analyze")
    delay_days: Optional[int] = Field(None, ge=1, le=365, description="Days of delay (for delay analysis)")
    include_dependencies: bool = Field(True, description="Include dependency analysis")
    include_resource_impact: bool = Field(True, description="Include resource allocation impact")


class ProjectHealthRequest(BaseModel):
    """Request model for project health analysis."""
    analysis_depth: str = Field("standard", pattern="^(basic|standard|comprehensive)$", description="Analysis depth")
    include_predictions: bool = Field(False, description="Include predictive analytics")
    focus_areas: Optional[List[str]] = Field(None, description="Specific areas to focus on")
    
    @validator('focus_areas')
    def validate_focus_areas(cls, v):
        """Validate focus areas are valid."""
        valid_areas = ["completion", "dependencies", "resources", "quality", "timeline"]
        if v:
            invalid_areas = [area for area in v if area not in valid_areas]
            if invalid_areas:
                raise ValueError(f"Invalid focus areas: {invalid_areas}. Valid areas: {valid_areas}")
        return v


class RoleAssignmentRequest(BaseModel):
    """Request model for assigning roles to tasks."""
    role_name: str = Field(..., description="Name of the role to assign")
    validate_capabilities: bool = Field(True, description="Whether to validate role capabilities")


class PluginRegistrationRequest(BaseModel):
    """Request model for plugin registration."""
    plugin_info: PluginInfo = Field(..., description="Plugin information")
    notification_preferences: Optional[Dict[str, bool]] = Field(None, description="Notification preferences")


class PluginAuthRequest(BaseModel):
    """Request model for plugin authentication."""
    plugin_name: str = Field(..., description="Plugin name")
    api_key: Optional[str] = Field(None, description="Optional API key for enhanced access")


class WebhookRequest(BaseModel):
    """Request model for webhook registration."""
    url: str = Field(..., description="Webhook URL")
    events: List[str] = Field(..., description="Events to subscribe to")
    secret: Optional[str] = Field(None, description="Webhook secret for verification")
    
    @validator('events')
    def validate_events(cls, v):
        """Validate webhook events are valid."""
        valid_events = [
            "task.created", "task.updated", "task.completed", "task.deleted",
            "project.created", "project.updated", "dependency.added", "dependency.removed"
        ]
        if v:
            invalid_events = [event for event in v if event not in valid_events]
            if invalid_events:
                raise ValueError(f"Invalid events: {invalid_events}. Valid events: {valid_events}")
        return v


class BulkTaskUpdateRequest(BaseModel):
    """Request model for bulk task updates."""
    task_ids: List[str] = Field(..., min_items=1, max_items=100, description="List of task IDs to update")
    updates: TaskUpdateRequest = Field(..., description="Updates to apply to all tasks")
    
    @validator('task_ids')
    def validate_task_ids(cls, v):
        """Validate task IDs are unique."""
        if len(v) != len(set(v)):
            raise ValueError("Task IDs must be unique")
        return v


class FileContextRequest(BaseModel):
    """Request model for VS Code file context integration."""
    file_path: str = Field(..., description="File path relative to workspace")
    language: Optional[str] = Field(None, description="Programming language")
    line_number: Optional[int] = Field(None, description="Specific line number")
    function_name: Optional[str] = Field(None, description="Function or method name")
    selection_start: Optional[int] = Field(None, description="Selection start line")
    selection_end: Optional[int] = Field(None, description="Selection end line")
    content_preview: Optional[str] = Field(None, max_length=1000, description="Preview of the code content")


class NoteContextRequest(BaseModel):
    """Request model for Obsidian note context integration."""
    note_path: str = Field(..., description="Note path relative to vault")
    note_title: Optional[str] = Field(None, description="Note title")
    section: Optional[str] = Field(None, description="Specific section/heading")
    tags: List[str] = Field(default_factory=list, description="Note tags")
    backlinks: List[str] = Field(default_factory=list, description="Backlinked notes")
    content_preview: Optional[str] = Field(None, max_length=1000, description="Preview of the note content")