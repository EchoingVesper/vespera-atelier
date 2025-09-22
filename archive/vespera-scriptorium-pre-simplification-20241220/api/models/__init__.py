"""
API Models Package

Contains all Pydantic models for request/response validation.
"""

from .common import *
from .requests import *
from .responses import *

__all__ = [
    # Common models
    "StatusEnum", "PriorityEnum", "APIResponse", "PaginationParams", 
    "PaginatedResponse", "FilterParams", "SortParams", "TaskSummary",
    "HealthStatus", "ErrorDetail", "ValidationErrorResponse", "PluginInfo",
    "NotificationPreferences", "APIMetrics",
    
    # Request models
    "TaskCreateRequest", "TaskUpdateRequest", "SubtaskRequest", "TaskTreeCreateRequest",
    "TaskCompleteRequest", "TaskDependencyRequest", "SemanticSearchRequest",
    "SimilarTasksRequest", "ClusteringRequest", "ImpactAnalysisRequest",
    "ProjectHealthRequest", "RoleAssignmentRequest", "PluginRegistrationRequest",
    "PluginAuthRequest", "WebhookRequest", "BulkTaskUpdateRequest",
    "FileContextRequest", "NoteContextRequest",
    
    # Response models
    "TaskResponse", "TaskCreateResponse", "TaskUpdateResponse", "TaskDeleteResponse",
    "TaskTreeResponse", "TaskListResponse", "TaskDashboardResponse",
    "SemanticSearchResult", "SemanticSearchResponse", "SimilarTasksResponse",
    "TaskCluster", "ClusteringResponse", "DependencyAnalysisResult",
    "DependencyAnalysisResponse", "ImpactAnalysisResponse", "ProjectHealthResponse",
    "RoleResponse", "RoleListResponse", "RoleAssignmentResponse",
    "PluginTokenResponse", "PluginStatusResponse", "FileContextResponse",
    "NoteContextResponse", "WebSocketMessage", "NotificationResponse",
    "BulkOperationResponse"
]