"""
API Response Models

Pydantic models for API response payloads.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from .common import StatusEnum, PriorityEnum, TaskSummary, APIResponse


class TaskResponse(BaseModel):
    """Complete task response model."""
    id: str = Field(..., description="Task ID")
    title: str = Field(..., description="Task title")
    description: str = Field(..., description="Task description")
    status: StatusEnum = Field(..., description="Current status")
    priority: PriorityEnum = Field(..., description="Task priority")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    due_date: Optional[datetime] = Field(None, description="Due date")
    started_at: Optional[datetime] = Field(None, description="Start timestamp")
    completed_at: Optional[datetime] = Field(None, description="Completion timestamp")
    
    # Hierarchy
    parent_id: Optional[str] = Field(None, description="Parent task ID")
    child_ids: List[str] = Field(default_factory=list, description="List of child task IDs")
    
    # Assignment and project
    assignee: str = Field(..., description="Assigned user")
    creator: str = Field(..., description="Task creator")
    project_id: Optional[str] = Field(None, description="Associated project ID")
    feature: Optional[str] = Field(None, description="Feature area")
    milestone: Optional[str] = Field(None, description="Milestone")
    
    # Metadata
    tags: List[str] = Field(default_factory=list, description="Task tags")
    labels: Dict[str, str] = Field(default_factory=dict, description="Key-value labels")
    estimated_effort: Optional[str] = Field(None, description="Estimated effort")
    actual_effort: Optional[str] = Field(None, description="Actual effort spent")
    complexity: str = Field(..., description="Task complexity")
    source_references: List[str] = Field(default_factory=list, description="Links to docs, issues, etc.")
    code_references: List[str] = Field(default_factory=list, description="File paths, functions")
    
    # Execution state
    assigned_role: Optional[str] = Field(None, description="Assigned role for execution")
    execution_history: List[Dict[str, Any]] = Field(default_factory=list, description="Execution history")
    retry_count: int = Field(0, description="Number of retry attempts")
    last_error: Optional[str] = Field(None, description="Last error message")
    
    # Synchronization status
    sync_status: Dict[str, Any] = Field(default_factory=dict, description="Cross-database sync status")
    
    # Relationships
    dependencies: List[str] = Field(default_factory=list, description="Tasks this depends on")
    dependents: List[str] = Field(default_factory=list, description="Tasks that depend on this")
    related_tasks: List[str] = Field(default_factory=list, description="Related tasks")


class TaskCreateResponse(APIResponse):
    """Response for task creation."""
    task: Optional[TaskResponse] = Field(None, description="Created task details")


class TaskUpdateResponse(APIResponse):
    """Response for task updates."""
    task: Optional[TaskResponse] = Field(None, description="Updated task details")
    changes: Dict[str, Any] = Field(default_factory=dict, description="Changes made to the task")


class TaskDeleteResponse(APIResponse):
    """Response for task deletion."""
    deleted_tasks: List[str] = Field(default_factory=list, description="IDs of deleted tasks")
    cascade_count: int = Field(0, description="Number of tasks deleted due to cascade")


class TaskTreeResponse(APIResponse):
    """Response for task tree operations."""
    root_task: Optional[TaskResponse] = Field(None, description="Root task of the tree")
    total_created: int = Field(0, description="Total number of tasks created")
    tree_structure: Dict[str, Any] = Field(default_factory=dict, description="Hierarchical tree structure")


class TaskListResponse(APIResponse):
    """Response for task listing."""
    tasks: List[TaskSummary] = Field(..., description="List of task summaries")
    count: int = Field(..., description="Number of tasks returned")
    total: int = Field(..., description="Total number of tasks matching filters")
    filters_applied: Dict[str, Any] = Field(default_factory=dict, description="Applied filters")


class TaskDashboardResponse(APIResponse):
    """Response for task dashboard."""
    dashboard: Dict[str, Any] = Field(..., description="Dashboard data")
    generated_at: datetime = Field(..., description="Dashboard generation timestamp")
    project_id: Optional[str] = Field(None, description="Project ID for scoped dashboard")


class SemanticSearchResult(BaseModel):
    """Individual semantic search result."""
    task_id: str = Field(..., description="Task ID")
    title: str = Field(..., description="Task title")
    similarity_score: float = Field(..., description="Similarity score (0-1)")
    task_data: TaskResponse = Field(..., description="Complete task data")
    match_content: str = Field(..., description="Matching content snippet")
    match_explanation: Optional[str] = Field(None, description="Why this task matched")


class SemanticSearchResponse(APIResponse):
    """Response for semantic search."""
    query: str = Field(..., description="Original search query")
    results_count: int = Field(..., description="Number of results returned")
    results: List[SemanticSearchResult] = Field(..., description="Search results")
    search_time_ms: float = Field(..., description="Search execution time in milliseconds")
    suggestions: List[str] = Field(default_factory=list, description="Query improvement suggestions")


class SimilarTasksResponse(APIResponse):
    """Response for similar tasks."""
    reference_task_id: str = Field(..., description="Reference task ID")
    reference_title: str = Field(..., description="Reference task title")
    similar_tasks: List[SemanticSearchResult] = Field(..., description="Similar tasks found")


class TaskCluster(BaseModel):
    """Task cluster information."""
    cluster_id: str = Field(..., description="Cluster identifier")
    theme: str = Field(..., description="Cluster theme or topic")
    coherence_score: float = Field(..., description="Cluster coherence score (0-1)")
    task_count: int = Field(..., description="Number of tasks in cluster")
    tasks: List[TaskSummary] = Field(..., description="Tasks in this cluster")
    keywords: List[str] = Field(..., description="Key terms for this cluster")
    recommended_actions: List[str] = Field(..., description="Recommended actions for this cluster")


class ClusteringResponse(APIResponse):
    """Response for task clustering."""
    project_id: Optional[str] = Field(None, description="Project ID for scoped clustering")
    clustering_summary: Dict[str, Any] = Field(..., description="Clustering summary statistics")
    clusters: List[TaskCluster] = Field(..., description="Identified task clusters")
    unclustered_tasks: List[TaskSummary] = Field(..., description="Tasks that didn't fit in any cluster")
    clustering_parameters: Dict[str, Any] = Field(..., description="Clustering algorithm parameters")
    insights: Dict[str, Any] = Field(..., description="Insights from clustering analysis")


class DependencyAnalysisResult(BaseModel):
    """Dependency analysis result."""
    task_id: str = Field(..., description="Task ID")
    title: str = Field(..., description="Task title")
    relationship_type: str = Field(..., description="Type of relationship")
    status: str = Field(..., description="Task status")
    depth: int = Field(..., description="Depth in dependency chain")
    impact_level: str = Field(..., description="Impact level (direct/indirect)")


class DependencyAnalysisResponse(APIResponse):
    """Response for dependency analysis."""
    task_id: str = Field(..., description="Analyzed task ID")
    task_title: str = Field(..., description="Analyzed task title")
    analysis: Dict[str, Any] = Field(..., description="Dependency analysis results")
    dependencies: List[DependencyAnalysisResult] = Field(..., description="Task dependencies")
    dependents: List[DependencyAnalysisResult] = Field(..., description="Tasks that depend on this one")
    cycle_detection: Dict[str, Any] = Field(..., description="Circular dependency information")


class ImpactAnalysisResponse(APIResponse):
    """Response for task impact analysis."""
    task: Dict[str, str] = Field(..., description="Basic task information")
    impact_analysis: Dict[str, Any] = Field(..., description="Impact analysis results")
    affected_tasks: List[DependencyAnalysisResult] = Field(..., description="Tasks affected by the change")
    resource_impact: Optional[Dict[str, Any]] = Field(None, description="Resource allocation impact")
    recommendations: Dict[str, List[str]] = Field(..., description="Recommended actions by category")
    analysis_confidence: Dict[str, Any] = Field(..., description="Confidence metrics for analysis")
    summary: Dict[str, Any] = Field(..., description="Executive summary of impact")


class ProjectHealthResponse(APIResponse):
    """Response for project health analysis."""
    project_id: str = Field(..., description="Analyzed project ID")
    overall_health: Dict[str, Any] = Field(..., description="Overall health score and grade")
    detailed_analysis: Dict[str, Any] = Field(..., description="Detailed analysis by category")
    risk_factors: Dict[str, List[str]] = Field(..., description="Identified risk factors")
    predictions: Optional[Dict[str, Any]] = Field(None, description="Predictive analysis results")
    action_recommendations: Dict[str, List[str]] = Field(..., description="Recommended actions by timeline")
    analysis_metadata: Dict[str, Any] = Field(..., description="Analysis metadata and parameters")
    executive_summary: Dict[str, str] = Field(..., description="Executive summary for stakeholders")


class RoleResponse(BaseModel):
    """Role information response."""
    name: str = Field(..., description="Role name")
    description: str = Field(..., description="Role description")
    tool_groups: List[str] = Field(..., description="Available tool groups")
    restrictions: str = Field(..., description="Role restrictions")
    capabilities: List[str] = Field(default_factory=list, description="Role capabilities")
    file_patterns: List[str] = Field(default_factory=list, description="Allowed file patterns")


class RoleListResponse(APIResponse):
    """Response for role listing."""
    roles: List[RoleResponse] = Field(..., description="Available roles")
    count: int = Field(..., description="Number of roles")


class RoleAssignmentResponse(APIResponse):
    """Response for role assignment."""
    task: Optional[TaskResponse] = Field(None, description="Updated task with role assignment")
    validation: Dict[str, Any] = Field(default_factory=dict, description="Role validation results")
    previous_role: Optional[str] = Field(None, description="Previously assigned role")


class PluginTokenResponse(APIResponse):
    """Response for plugin authentication."""
    token: str = Field(..., description="Authentication token")
    expires_at: datetime = Field(..., description="Token expiration timestamp")
    plugin_id: str = Field(..., description="Plugin identifier")
    permissions: List[str] = Field(..., description="Granted permissions")


class PluginStatusResponse(APIResponse):
    """Response for plugin status."""
    plugin_id: str = Field(..., description="Plugin identifier")
    status: str = Field(..., description="Plugin status")
    last_seen: datetime = Field(..., description="Last activity timestamp")
    requests_count: int = Field(..., description="Number of API requests made")
    error_count: int = Field(..., description="Number of errors encountered")


class FileContextResponse(APIResponse):
    """Response for file context analysis."""
    file_path: str = Field(..., description="Analyzed file path")
    related_tasks: List[TaskSummary] = Field(..., description="Tasks related to this file")
    suggested_actions: List[str] = Field(..., description="Suggested actions for this file")
    code_analysis: Dict[str, Any] = Field(default_factory=dict, description="Code analysis results")


class NoteContextResponse(APIResponse):
    """Response for note context analysis."""
    note_path: str = Field(..., description="Analyzed note path")
    related_tasks: List[TaskSummary] = Field(..., description="Tasks related to this note")
    knowledge_connections: List[str] = Field(..., description="Connected knowledge concepts")
    suggested_tasks: List[str] = Field(..., description="Suggested task titles based on note content")


class WebSocketMessage(BaseModel):
    """WebSocket message format."""
    type: str = Field(..., description="Message type")
    timestamp: datetime = Field(..., description="Message timestamp")
    data: Dict[str, Any] = Field(..., description="Message payload")
    plugin_id: Optional[str] = Field(None, description="Target plugin ID")


class NotificationResponse(APIResponse):
    """Response for notification operations."""
    notification_id: str = Field(..., description="Notification identifier")
    delivered_at: datetime = Field(..., description="Delivery timestamp")
    delivery_method: str = Field(..., description="Delivery method (webhook, email, etc.)")


class BulkOperationResponse(APIResponse):
    """Response for bulk operations."""
    total_requested: int = Field(..., description="Total number of items requested")
    successful: int = Field(..., description="Number of successful operations")
    failed: int = Field(..., description="Number of failed operations")
    results: List[Dict[str, Any]] = Field(..., description="Individual operation results")
    errors: List[str] = Field(default_factory=list, description="Error messages for failed operations")