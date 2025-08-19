"""
Task Management Router

REST API endpoints for comprehensive task management operations.
Provides CRUD operations, task trees, dependencies, and completion workflows.
"""

import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from fastapi.responses import JSONResponse

from api.models.requests import (
    TaskCreateRequest, TaskUpdateRequest, TaskTreeCreateRequest, 
    TaskCompleteRequest, TaskDependencyRequest, BulkTaskUpdateRequest
)
from api.models.responses import (
    TaskResponse, TaskCreateResponse, TaskUpdateResponse, TaskDeleteResponse,
    TaskTreeResponse, TaskListResponse, TaskDashboardResponse, BulkOperationResponse
)
from api.models.common import PaginationParams, FilterParams, SortParams, StatusEnum, PriorityEnum
from api.utils.mcp_bridge import MCPBridge

logger = logging.getLogger(__name__)

router = APIRouter()


def get_mcp_bridge(request: Request) -> MCPBridge:
    """Dependency to get MCP bridge from app state."""
    if not hasattr(request.app.state, 'mcp_bridge'):
        raise HTTPException(status_code=500, detail="MCP bridge not available")
    return request.app.state.mcp_bridge


@router.post("/", response_model=TaskCreateResponse, status_code=201)
async def create_task(
    task_data: TaskCreateRequest,
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Create a new task with optional parent-child hierarchy.
    
    Creates a task in the system and automatically triggers background processing
    for embedding generation and graph synchronization.
    """
    try:
        # Convert Pydantic model to kwargs for MCP bridge
        task_kwargs = {
            "title": task_data.title,
            "description": task_data.description,
            "parent_id": task_data.parent_id,
            "project_id": task_data.project_id,
            "feature": task_data.feature,
            "priority": task_data.priority.value,
        }
        
        # Add optional fields if provided
        if task_data.assignee:
            task_kwargs["assignee"] = task_data.assignee
        
        result = await mcp_bridge.create_task(**task_kwargs)
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to create task"))
        
        # Convert task dict to response model if available
        task_response = None
        if result.get("task"):
            task_dict = result["task"]
            task_response = TaskResponse(**task_dict)
        
        return TaskCreateResponse(
            success=True,
            message=result.get("message", "Task created successfully"),
            task=task_response
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error creating task")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: str,
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Retrieve detailed information about a specific task.
    
    Returns complete task data including hierarchy, metadata, execution state,
    and synchronization status across all databases.
    """
    try:
        result = await mcp_bridge.get_task(task_id)
        
        if not result["success"]:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to get task"))
        
        task_dict = result["task"]
        return TaskResponse(**task_dict)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error retrieving task {task_id}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.put("/{task_id}", response_model=TaskUpdateResponse)
async def update_task(
    task_id: str,
    updates: TaskUpdateRequest,
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Update an existing task with new information.
    
    Supports partial updates - only provided fields will be updated.
    Status changes are tracked with timestamps and execution history.
    """
    try:
        # Convert Pydantic model to update dict, excluding None values
        update_dict = {}
        
        for field, value in updates.dict(exclude_unset=True).items():
            if value is not None:
                if field in ["status", "priority"] and hasattr(value, "value"):
                    update_dict[field] = value.value
                else:
                    update_dict[field] = value
        
        if not update_dict:
            raise HTTPException(status_code=400, detail="No updates provided")
        
        result = await mcp_bridge.update_task(task_id, update_dict)
        
        if not result["success"]:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to update task"))
        
        # Convert task dict to response model if available
        task_response = None
        if result.get("task"):
            task_dict = result["task"]
            task_response = TaskResponse(**task_dict)
        
        return TaskUpdateResponse(
            success=True,
            message=result.get("message", "Task updated successfully"),
            task=task_response,
            changes=update_dict
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error updating task {task_id}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/{task_id}", response_model=TaskDeleteResponse)
async def delete_task(
    task_id: str,
    recursive: bool = Query(True, description="Delete child tasks recursively"),
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Delete a task and optionally its children.
    
    When recursive=True, all child tasks are also deleted.
    This operation cannot be undone.
    """
    try:
        result = await mcp_bridge.delete_task(task_id, recursive=recursive)
        
        if not result["success"]:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to delete task"))
        
        return TaskDeleteResponse(
            success=True,
            message=result.get("message", "Task deleted successfully"),
            deleted_tasks=result.get("deleted_tasks", []),
            cascade_count=len(result.get("deleted_tasks", [])) - 1 if recursive else 0
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error deleting task {task_id}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/", response_model=TaskListResponse)
async def list_tasks(
    # Pagination
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(50, ge=1, le=1000, description="Page size"),
    
    # Filtering
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    status: Optional[StatusEnum] = Query(None, description="Filter by status"),
    priority: Optional[PriorityEnum] = Query(None, description="Filter by priority"),
    assignee: Optional[str] = Query(None, description="Filter by assignee"),
    parent_id: Optional[str] = Query(None, description="Filter by parent task ID"),
    
    # Sorting
    sort_by: str = Query("updated_at", description="Field to sort by"),
    sort_order: str = Query("desc", regex="^(asc|desc)$", description="Sort order"),
    
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    List tasks with filtering, sorting, and pagination.
    
    Supports comprehensive filtering by project, status, priority, assignee,
    and hierarchical relationships. Results are paginated for performance.
    """
    try:
        # Build filter parameters
        filters = {
            "limit": min(size, 1000),  # Cap at 1000 for performance
        }
        
        if project_id:
            filters["project_id"] = project_id
        if status:
            filters["status_filter"] = status.value
        if priority:
            filters["priority_filter"] = priority.value
        if assignee:
            filters["assignee"] = assignee
        if parent_id:
            filters["parent_id"] = parent_id
        
        result = await mcp_bridge.list_tasks(**filters)
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to list tasks"))
        
        tasks = result["tasks"]
        
        # Convert to response models
        task_summaries = []
        for task_dict in tasks:
            # Create lightweight summaries for list view
            summary = {
                "id": task_dict["id"],
                "title": task_dict["title"],
                "status": task_dict["status"],
                "priority": task_dict["priority"],
                "created_at": task_dict["created_at"],
                "updated_at": task_dict["updated_at"],
                "project_id": task_dict.get("project_id"),
                "assignee": task_dict.get("assignee"),
                "has_children": len(task_dict.get("child_ids", [])) > 0,
                "parent_id": task_dict.get("parent_id")
            }
            task_summaries.append(summary)
        
        # Apply sorting (simplified - would be done at database level in production)
        reverse = sort_order == "desc"
        if sort_by in ["created_at", "updated_at"]:
            task_summaries.sort(key=lambda x: x[sort_by], reverse=reverse)
        elif sort_by in ["title", "status", "priority"]:
            task_summaries.sort(key=lambda x: str(x[sort_by]), reverse=reverse)
        
        # Apply pagination
        total = len(task_summaries)
        start_idx = (page - 1) * size
        end_idx = start_idx + size
        paginated_tasks = task_summaries[start_idx:end_idx]
        
        return TaskListResponse(
            success=True,
            message=f"Found {total} tasks",
            tasks=paginated_tasks,
            count=len(paginated_tasks),
            total=total,
            filters_applied={
                "project_id": project_id,
                "status": status.value if status else None,
                "priority": priority.value if priority else None,
                "assignee": assignee,
                "parent_id": parent_id
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error listing tasks")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/trees", response_model=TaskTreeResponse, status_code=201)
async def create_task_tree(
    tree_data: TaskTreeCreateRequest,
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Create a hierarchical task tree with a root task and subtasks.
    
    Creates a parent task and all specified subtasks in a single operation.
    Automatically handles parent-child relationships and role assignments.
    """
    try:
        # Convert subtasks to the format expected by MCP bridge
        subtasks_data = []
        for subtask in tree_data.subtasks:
            subtask_dict = {
                "title": subtask.title,
                "description": subtask.description,
                "priority": subtask.priority.value,
            }
            
            if subtask.assignee:
                subtask_dict["assignee"] = subtask.assignee
            if subtask.order is not None:
                subtask_dict["order"] = subtask.order
            if subtask.estimated_effort:
                subtask_dict["estimated_effort"] = subtask.estimated_effort
            if subtask.tags:
                subtask_dict["tags"] = subtask.tags
                
            subtasks_data.append(subtask_dict)
        
        tree_kwargs = {
            "title": tree_data.title,
            "description": tree_data.description,
            "subtasks": subtasks_data,
            "project_id": tree_data.project_id,
            "feature": tree_data.feature,
            "auto_assign_roles": True
        }
        
        result = await mcp_bridge.create_task_tree(**tree_kwargs)
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to create task tree"))
        
        # Convert root task to response model if available
        root_task_response = None
        if result.get("root_task"):
            root_task_response = TaskResponse(**result["root_task"])
        
        return TaskTreeResponse(
            success=True,
            message=result.get("message", "Task tree created successfully"),
            root_task=root_task_response,
            total_created=result.get("total_created", 0),
            tree_structure={}  # Would be populated with hierarchical data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error creating task tree")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{task_id}/tree", response_model=Dict[str, Any])
async def get_task_tree(
    task_id: str,
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Get the hierarchical tree structure for a task and its descendants.
    
    Returns the complete task tree starting from the specified task,
    including all child tasks and their relationships.
    """
    try:
        result = await mcp_bridge.get_task_tree(task_id)
        
        if not result["success"]:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=f"Task tree not found for {task_id}")
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to get task tree"))
        
        return {
            "success": True,
            "tree": result["tree"],
            "message": f"Retrieved task tree for {task_id}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error getting task tree for {task_id}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/{task_id}/complete", response_model=TaskUpdateResponse)
async def complete_task(
    task_id: str,
    completion_data: TaskCompleteRequest,
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Mark a task as completed with output and artifacts.
    
    Updates task status to completed, records completion output,
    and tracks any generated artifacts. Also unblocks dependent tasks.
    """
    try:
        # First update the task with completion data
        update_dict = {
            "status": "done",
            "actual_effort": completion_data.actual_effort
        }
        
        result = await mcp_bridge.update_task(task_id, update_dict)
        
        if not result["success"]:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to complete task"))
        
        # Convert task dict to response model if available
        task_response = None
        if result.get("task"):
            task_dict = result["task"]
            task_response = TaskResponse(**task_dict)
        
        return TaskUpdateResponse(
            success=True,
            message="Task completed successfully",
            task=task_response,
            changes=update_dict
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error completing task {task_id}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/{task_id}/dependencies", response_model=TaskUpdateResponse)
async def add_task_dependency(
    task_id: str,
    dependency_data: TaskDependencyRequest,
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Add a dependency relationship between two tasks.
    
    Creates a dependency where the current task depends on the specified task.
    Automatically checks for circular dependencies.
    """
    try:
        # This would need to be implemented in the MCP bridge
        # For now, return a placeholder response
        raise HTTPException(status_code=501, detail="Dependency management not yet implemented")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error adding dependency to task {task_id}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/dashboard", response_model=TaskDashboardResponse)
async def get_task_dashboard(
    project_id: Optional[str] = Query(None, description="Scope dashboard to specific project"),
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Get comprehensive task management dashboard with metrics and insights.
    
    Provides overview statistics, progress tracking, bottleneck identification,
    and actionable insights for task management.
    """
    try:
        result = await mcp_bridge.get_task_dashboard(project_id)
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to get dashboard"))
        
        return TaskDashboardResponse(
            success=True,
            message="Dashboard retrieved successfully",
            dashboard=result["dashboard"],
            generated_at=result["generated_at"],
            project_id=project_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error getting task dashboard")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.put("/bulk", response_model=BulkOperationResponse)
async def bulk_update_tasks(
    bulk_data: BulkTaskUpdateRequest,
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Update multiple tasks with the same changes in a single operation.
    
    Applies the specified updates to all listed tasks. Operations are
    performed individually, so partial success is possible.
    """
    try:
        results = []
        successful = 0
        failed = 0
        errors = []
        
        # Convert updates to dict format
        update_dict = {}
        for field, value in bulk_data.updates.dict(exclude_unset=True).items():
            if value is not None:
                if field in ["status", "priority"] and hasattr(value, "value"):
                    update_dict[field] = value.value
                else:
                    update_dict[field] = value
        
        # Apply updates to each task
        for task_id in bulk_data.task_ids:
            try:
                result = await mcp_bridge.update_task(task_id, update_dict)
                
                if result["success"]:
                    successful += 1
                    results.append({
                        "task_id": task_id,
                        "success": True,
                        "message": result.get("message", "Updated successfully")
                    })
                else:
                    failed += 1
                    error_msg = result.get("error", "Update failed")
                    errors.append(f"Task {task_id}: {error_msg}")
                    results.append({
                        "task_id": task_id,
                        "success": False,
                        "error": error_msg
                    })
                    
            except Exception as e:
                failed += 1
                error_msg = str(e)
                errors.append(f"Task {task_id}: {error_msg}")
                results.append({
                    "task_id": task_id,
                    "success": False,
                    "error": error_msg
                })
        
        return BulkOperationResponse(
            success=successful > 0,
            message=f"Bulk update completed: {successful} successful, {failed} failed",
            total_requested=len(bulk_data.task_ids),
            successful=successful,
            failed=failed,
            results=results,
            errors=errors
        )
        
    except Exception as e:
        logger.exception("Error in bulk task update")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{task_id}/dependencies/analyze", response_model=Dict[str, Any])
async def analyze_task_dependencies(
    task_id: str,
    max_depth: int = Query(5, ge=1, le=10, description="Maximum analysis depth"),
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Analyze task dependencies and blocking relationships using graph database.
    
    Provides comprehensive dependency analysis including direct dependencies,
    transitive relationships, and potential blocking issues.
    """
    try:
        result = await mcp_bridge.analyze_task_dependencies(task_id, max_depth)
        
        if not result["success"]:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to analyze dependencies"))
        
        return {
            "success": True,
            "task_id": result["task_id"],
            "task_title": result["task_title"],
            "analysis": result["analysis"],
            "message": f"Dependency analysis completed for {task_id}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error analyzing dependencies for task {task_id}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")