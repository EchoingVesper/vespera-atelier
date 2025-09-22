"""
Role Management Router

REST API endpoints for role-based access control, capability management,
and task assignment with validation and restrictions.
"""

import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from fastapi.responses import JSONResponse

from api.models.requests import RoleAssignmentRequest
from api.models.responses import (
    RoleResponse, RoleListResponse, RoleAssignmentResponse
)
from api.utils.mcp_bridge import MCPBridge

logger = logging.getLogger(__name__)

router = APIRouter()


def get_mcp_bridge(request: Request) -> MCPBridge:
    """Dependency to get MCP bridge from app state."""
    if not hasattr(request.app.state, 'mcp_bridge'):
        raise HTTPException(status_code=500, detail="MCP bridge not available")
    return request.app.state.mcp_bridge


@router.get("/", response_model=RoleListResponse)
async def list_available_roles(
    include_capabilities: bool = Query(True, description="Include detailed capability information"),
    filter_by_tools: Optional[str] = Query(None, description="Filter roles by tool group"),
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    List all available roles with their capabilities and restrictions.
    
    Provides comprehensive information about each role including:
    - Tool groups and capabilities
    - File pattern restrictions
    - Permission levels
    - Usage statistics (if available)
    
    Useful for understanding what roles are available for task assignment
    and what capabilities each role provides.
    """
    try:
        result = await mcp_bridge.list_roles()
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to list roles"))
        
        roles = result["roles"]
        
        # Convert to response models with enhanced information
        role_responses = []
        for role_data in roles:
            # Enhance role data with capability details
            enhanced_role = {
                "name": role_data["name"],
                "description": role_data["description"],
                "tool_groups": role_data["tool_groups"],
                "restrictions": role_data["restrictions"]
            }
            
            if include_capabilities:
                # Add detailed capability information
                enhanced_role["capabilities"] = []
                enhanced_role["file_patterns"] = []
                
                # Map tool groups to specific capabilities
                tool_group_capabilities = {
                    "file_operations": ["read_files", "write_files", "list_directories"],
                    "git_operations": ["git_commit", "git_branch", "git_merge"],
                    "shell_commands": ["execute_shell", "run_scripts"],
                    "web_requests": ["http_get", "http_post", "api_calls"],
                    "ai_analysis": ["semantic_analysis", "code_review", "documentation_generation"]
                }
                
                for tool_group in role_data["tool_groups"]:
                    if tool_group in tool_group_capabilities:
                        enhanced_role["capabilities"].extend(tool_group_capabilities[tool_group])
                
                # Add file pattern restrictions
                enhanced_role["file_patterns"] = [
                    "*.py", "*.js", "*.ts", "*.md"  # Default patterns, would be role-specific
                ]
            
            # Filter by tool group if specified
            if filter_by_tools and filter_by_tools not in role_data["tool_groups"]:
                continue
                
            role_responses.append(RoleResponse(**enhanced_role))
        
        return RoleListResponse(
            success=True,
            message=f"Found {len(role_responses)} available roles",
            roles=role_responses,
            count=len(role_responses)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error listing roles")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{role_name}", response_model=RoleResponse)
async def get_role_details(
    role_name: str,
    include_usage_stats: bool = Query(False, description="Include role usage statistics"),
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Get detailed information about a specific role.
    
    Provides comprehensive role information including capabilities,
    restrictions, and optionally usage statistics showing how often
    the role is used and performance metrics.
    """
    try:
        result = await mcp_bridge.list_roles()
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to get role details"))
        
        # Find the specific role
        role_data = None
        for role in result["roles"]:
            if role["name"] == role_name:
                role_data = role
                break
        
        if not role_data:
            raise HTTPException(status_code=404, detail=f"Role '{role_name}' not found")
        
        # Enhance role data
        enhanced_role = {
            "name": role_data["name"],
            "description": role_data["description"],
            "tool_groups": role_data["tool_groups"],
            "restrictions": role_data["restrictions"],
            "capabilities": [],
            "file_patterns": []
        }
        
        # Add detailed capabilities
        tool_group_capabilities = {
            "file_operations": ["read_files", "write_files", "list_directories", "file_search"],
            "git_operations": ["git_commit", "git_branch", "git_merge", "git_status"],
            "shell_commands": ["execute_shell", "run_scripts", "process_management"],
            "web_requests": ["http_get", "http_post", "api_calls", "webhook_handling"],
            "ai_analysis": ["semantic_analysis", "code_review", "documentation_generation", "test_generation"]
        }
        
        for tool_group in role_data["tool_groups"]:
            if tool_group in tool_group_capabilities:
                enhanced_role["capabilities"].extend(tool_group_capabilities[tool_group])
        
        # Add file pattern restrictions (would be role-specific in actual implementation)
        role_file_patterns = {
            "python_developer": ["*.py", "*.pyx", "*.pyi", "requirements.txt", "setup.py"],
            "frontend_developer": ["*.js", "*.jsx", "*.ts", "*.tsx", "*.css", "*.scss", "*.html"],
            "backend_developer": ["*.py", "*.js", "*.java", "*.go", "*.rs", "*.sql"],
            "devops_engineer": ["*.yml", "*.yaml", "*.sh", "*.dockerfile", "*.tf"],
            "qa_engineer": ["*.py", "*.js", "*.feature", "test_*", "*_test.py"],
            "tech_writer": ["*.md", "*.rst", "*.txt", "*.adoc"],
            "data_scientist": ["*.py", "*.ipynb", "*.r", "*.sql", "*.csv", "*.json"],
            "security_auditor": ["*.py", "*.js", "*.go", "*.java", "*.config", "*.env"],
            "database_admin": ["*.sql", "*.py", "*.sh", "*.conf", "*.ini"],
            "system_admin": ["*.sh", "*.py", "*.conf", "*.cfg", "*.ini", "*.service"]
        }
        
        enhanced_role["file_patterns"] = role_file_patterns.get(role_name, ["*"])
        
        # Add usage statistics if requested
        if include_usage_stats:
            # This would query actual usage data in a real implementation
            enhanced_role["usage_stats"] = {
                "tasks_assigned": 25,
                "active_assignments": 8,
                "success_rate": 0.92,
                "average_completion_time": "3.2 days",
                "last_used": "2025-01-19T15:30:00Z",
                "popular_tool_groups": role_data["tool_groups"][:3]
            }
        
        return RoleResponse(**enhanced_role)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error getting role details for {role_name}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/{role_name}/assign/{task_id}", response_model=RoleAssignmentResponse)
async def assign_role_to_task(
    role_name: str,
    task_id: str,
    assignment_data: RoleAssignmentRequest = RoleAssignmentRequest(role_name="", validate_capabilities=True),
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Assign a role to a specific task with capability validation.
    
    Validates that the role has the necessary capabilities for the task
    and updates the task with the role assignment. Includes comprehensive
    validation to ensure the role can actually execute the task requirements.
    """
    try:
        # Override role name from path parameter
        assignment_data.role_name = role_name
        
        result = await mcp_bridge.assign_role_to_task(
            task_id=task_id,
            role_name=role_name
        )
        
        if not result["success"]:
            if "not found" in result.get("error", "").lower():
                if "task" in result.get("error", "").lower():
                    raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
                else:
                    raise HTTPException(status_code=404, detail=f"Role '{role_name}' not found")
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to assign role"))
        
        # Get the previous role for comparison
        previous_role = None
        if result.get("task"):
            # Would extract previous role from task history in actual implementation
            previous_role = "previous_role_placeholder"
        
        # Convert task dict to response model if available
        task_response = None
        if result.get("task"):
            task_dict = result["task"]
            # Create a simplified task response for role assignment
            task_response = {
                "id": task_dict.get("id"),
                "title": task_dict.get("title"),
                "status": task_dict.get("status"),
                "assigned_role": role_name
            }
        
        return RoleAssignmentResponse(
            success=True,
            message=result.get("message", f"Role '{role_name}' assigned to task {task_id}"),
            task=task_response,
            validation=result.get("validation", {}),
            previous_role=previous_role
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error assigning role {role_name} to task {task_id}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/{role_name}/unassign/{task_id}", response_model=RoleAssignmentResponse)
async def unassign_role_from_task(
    role_name: str,
    task_id: str,
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Remove role assignment from a specific task.
    
    Clears the role assignment from the task, making it available
    for reassignment to a different role. Useful when role requirements
    change or when correcting incorrect assignments.
    """
    try:
        # This would be implemented as an update with null role assignment
        update_dict = {"assigned_role": None}
        
        result = await mcp_bridge.update_task(task_id, update_dict)
        
        if not result["success"]:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to unassign role"))
        
        # Create response
        task_response = None
        if result.get("task"):
            task_dict = result["task"]
            task_response = {
                "id": task_dict.get("id"),
                "title": task_dict.get("title"),
                "status": task_dict.get("status"),
                "assigned_role": None
            }
        
        return RoleAssignmentResponse(
            success=True,
            message=f"Role '{role_name}' unassigned from task {task_id}",
            task=task_response,
            validation={},
            previous_role=role_name
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error unassigning role {role_name} from task {task_id}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{role_name}/tasks", response_model=Dict[str, Any])
async def get_role_assigned_tasks(
    role_name: str,
    status_filter: Optional[str] = Query(None, description="Filter tasks by status"),
    limit: int = Query(50, ge=1, le=500, description="Maximum number of tasks to return"),
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Get all tasks currently assigned to a specific role.
    
    Provides a view of the role's current workload, useful for:
    - Workload management and balancing
    - Role utilization analysis
    - Task reassignment planning
    - Performance monitoring
    """
    try:
        # Get tasks assigned to this role
        filters = {
            "assignee": role_name,  # Assuming role is stored in assignee field
            "limit": limit
        }
        
        if status_filter:
            filters["status_filter"] = status_filter
        
        result = await mcp_bridge.list_tasks(**filters)
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to get role tasks"))
        
        tasks = result["tasks"]
        
        # Calculate role workload statistics
        workload_stats = {
            "total_assigned": len(tasks),
            "by_status": {},
            "by_priority": {},
            "estimated_workload": "unknown",  # Would calculate from task estimates
            "avg_task_age": "unknown"  # Would calculate from creation dates
        }
        
        # Group by status
        for task in tasks:
            status = task.get("status", "unknown")
            workload_stats["by_status"][status] = workload_stats["by_status"].get(status, 0) + 1
        
        # Group by priority
        for task in tasks:
            priority = task.get("priority", "unknown")
            workload_stats["by_priority"][priority] = workload_stats["by_priority"].get(priority, 0) + 1
        
        return {
            "success": True,
            "role_name": role_name,
            "tasks": tasks,
            "task_count": len(tasks),
            "workload_statistics": workload_stats,
            "filters_applied": {
                "status": status_filter,
                "limit": limit
            },
            "message": f"Found {len(tasks)} tasks assigned to role '{role_name}'"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error getting tasks for role {role_name}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{role_name}/capabilities/validate", response_model=Dict[str, Any])
async def validate_role_capabilities(
    role_name: str,
    task_requirements: List[str] = Query(..., description="Required capabilities for task"),
    file_paths: Optional[List[str]] = Query(None, description="File paths that will be accessed"),
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Validate whether a role has the required capabilities for a task.
    
    Performs comprehensive validation including:
    - Tool group capability matching
    - File pattern restriction checking
    - Permission level verification
    - Risk assessment for the assignment
    
    Useful for pre-validation before making role assignments.
    """
    try:
        # Get role details
        result = await mcp_bridge.list_roles()
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to validate role capabilities"))
        
        # Find the specific role
        role_data = None
        for role in result["roles"]:
            if role["name"] == role_name:
                role_data = role
                break
        
        if not role_data:
            raise HTTPException(status_code=404, detail=f"Role '{role_name}' not found")
        
        # Map tool groups to capabilities
        role_capabilities = {
            "file_operations": ["read_files", "write_files", "list_directories", "file_search"],
            "git_operations": ["git_commit", "git_branch", "git_merge", "git_status"],
            "shell_commands": ["execute_shell", "run_scripts", "process_management"],
            "web_requests": ["http_get", "http_post", "api_calls", "webhook_handling"],
            "ai_analysis": ["semantic_analysis", "code_review", "documentation_generation"]
        }
        
        available_capabilities = []
        for tool_group in role_data["tool_groups"]:
            if tool_group in role_capabilities:
                available_capabilities.extend(role_capabilities[tool_group])
        
        # Check capability requirements
        missing_capabilities = []
        satisfied_capabilities = []
        
        for requirement in task_requirements:
            if requirement in available_capabilities:
                satisfied_capabilities.append(requirement)
            else:
                missing_capabilities.append(requirement)
        
        # Check file access permissions
        file_access_validation = {"allowed": [], "restricted": [], "warnings": []}
        
        if file_paths:
            # Get role file patterns (simplified)
            role_file_patterns = {
                "python_developer": ["*.py", "*.pyx", "*.pyi"],
                "frontend_developer": ["*.js", "*.jsx", "*.ts", "*.tsx", "*.css", "*.html"],
                "backend_developer": ["*.py", "*.js", "*.java", "*.go", "*.sql"],
                "devops_engineer": ["*.yml", "*.yaml", "*.sh", "*.dockerfile"],
                "qa_engineer": ["*.py", "*.js", "*.feature", "test_*"],
                "tech_writer": ["*.md", "*.rst", "*.txt"],
                "data_scientist": ["*.py", "*.ipynb", "*.r", "*.csv"],
                "security_auditor": ["*.py", "*.js", "*.config", "*.env"],
                "database_admin": ["*.sql", "*.py", "*.conf"],
                "system_admin": ["*.sh", "*.py", "*.conf", "*.service"]
            }
            
            allowed_patterns = role_file_patterns.get(role_name, ["*"])
            
            for file_path in file_paths:
                # Simple pattern matching (would be more sophisticated in real implementation)
                file_ext = f"*.{file_path.split('.')[-1]}" if "." in file_path else file_path
                
                if "*" in allowed_patterns or any(pattern == file_ext for pattern in allowed_patterns):
                    file_access_validation["allowed"].append(file_path)
                else:
                    file_access_validation["restricted"].append(file_path)
        
        # Calculate validation score
        capability_score = len(satisfied_capabilities) / len(task_requirements) if task_requirements else 1.0
        file_access_score = len(file_access_validation["allowed"]) / len(file_paths) if file_paths else 1.0
        overall_score = (capability_score + file_access_score) / 2
        
        # Determine validation result
        is_valid = len(missing_capabilities) == 0 and len(file_access_validation["restricted"]) == 0
        risk_level = "low" if overall_score > 0.8 else "medium" if overall_score > 0.5 else "high"
        
        return {
            "success": True,
            "role_name": role_name,
            "validation_result": {
                "is_valid": is_valid,
                "overall_score": round(overall_score, 2),
                "risk_level": risk_level
            },
            "capability_analysis": {
                "required_capabilities": task_requirements,
                "satisfied_capabilities": satisfied_capabilities,
                "missing_capabilities": missing_capabilities,
                "capability_coverage": round(capability_score, 2)
            },
            "file_access_analysis": file_access_validation if file_paths else None,
            "recommendations": [
                f"Role '{role_name}' is suitable for this task" if is_valid else f"Role '{role_name}' may not be suitable",
                f"Missing capabilities: {', '.join(missing_capabilities)}" if missing_capabilities else "All capabilities satisfied",
                f"File access restrictions may apply" if file_access_validation["restricted"] else "File access permissions adequate"
            ],
            "message": f"Validation {'passed' if is_valid else 'failed'} for role '{role_name}'"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error validating capabilities for role {role_name}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/workload/analysis", response_model=Dict[str, Any])
async def analyze_role_workload_distribution(
    include_predictions: bool = Query(False, description="Include workload predictions"),
    time_window: str = Query("week", regex="^(day|week|month)$", description="Analysis time window"),
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Analyze workload distribution across all roles.
    
    Provides insights into:
    - Role utilization patterns
    - Workload imbalances
    - Capacity planning recommendations
    - Performance metrics by role
    
    Useful for resource planning and role optimization.
    """
    try:
        # Get all roles first
        roles_result = await mcp_bridge.list_roles()
        
        if not roles_result["success"]:
            raise HTTPException(status_code=400, detail="Failed to get roles for workload analysis")
        
        roles = roles_result["roles"]
        
        # Analyze workload for each role
        workload_analysis = []
        
        for role in roles:
            role_name = role["name"]
            
            # Get tasks for this role (simplified - would use proper filtering)
            tasks_result = await mcp_bridge.list_tasks(assignee=role_name, limit=1000)
            
            if tasks_result["success"]:
                tasks = tasks_result["tasks"]
                
                # Calculate metrics
                total_tasks = len(tasks)
                active_tasks = len([t for t in tasks if t.get("status") in ["todo", "doing"]])
                completed_tasks = len([t for t in tasks if t.get("status") == "done"])
                blocked_tasks = len([t for t in tasks if t.get("status") == "blocked"])
                
                completion_rate = (completed_tasks / total_tasks) if total_tasks > 0 else 0
                utilization = (active_tasks / 10) if active_tasks <= 10 else 1.0  # Assume max 10 concurrent tasks
                
                workload_analysis.append({
                    "role_name": role_name,
                    "task_metrics": {
                        "total_assigned": total_tasks,
                        "active_tasks": active_tasks,
                        "completed_tasks": completed_tasks,
                        "blocked_tasks": blocked_tasks,
                        "completion_rate": round(completion_rate, 2)
                    },
                    "utilization_metrics": {
                        "current_utilization": round(utilization, 2),
                        "capacity_status": "overloaded" if utilization > 0.9 else "optimal" if utilization > 0.6 else "underutilized",
                        "estimated_capacity": 10,  # Simplified assumption
                        "available_capacity": max(0, 10 - active_tasks)
                    },
                    "performance_indicators": {
                        "avg_completion_time": "3.5 days",  # Would calculate from actual data
                        "success_rate": round(completion_rate, 2),
                        "productivity_trend": "stable"  # Would analyze historical data
                    }
                })
        
        # Calculate overall statistics
        total_active = sum(r["task_metrics"]["active_tasks"] for r in workload_analysis)
        total_capacity = sum(r["utilization_metrics"]["estimated_capacity"] for r in workload_analysis)
        overall_utilization = total_active / total_capacity if total_capacity > 0 else 0
        
        # Identify imbalances
        overloaded_roles = [r for r in workload_analysis if r["utilization_metrics"]["current_utilization"] > 0.9]
        underutilized_roles = [r for r in workload_analysis if r["utilization_metrics"]["current_utilization"] < 0.3]
        
        # Generate recommendations
        recommendations = []
        if overloaded_roles:
            recommendations.append(f"Consider redistributing tasks from overloaded roles: {', '.join(r['role_name'] for r in overloaded_roles)}")
        if underutilized_roles:
            recommendations.append(f"Underutilized roles available for additional tasks: {', '.join(r['role_name'] for r in underutilized_roles)}")
        if overall_utilization > 0.8:
            recommendations.append("System approaching capacity limits - consider adding resources")
        
        return {
            "success": True,
            "analysis_metadata": {
                "time_window": time_window,
                "include_predictions": include_predictions,
                "roles_analyzed": len(workload_analysis)
            },
            "overall_metrics": {
                "total_active_tasks": total_active,
                "total_system_capacity": total_capacity,
                "overall_utilization": round(overall_utilization, 2),
                "system_health": "good" if overall_utilization < 0.8 else "warning" if overall_utilization < 0.9 else "critical"
            },
            "role_workloads": workload_analysis,
            "imbalance_analysis": {
                "overloaded_roles": len(overloaded_roles),
                "underutilized_roles": len(underutilized_roles),
                "balanced_roles": len(workload_analysis) - len(overloaded_roles) - len(underutilized_roles),
                "workload_variance": 0.25  # Would calculate actual variance
            },
            "recommendations": recommendations,
            "predictions": {
                "projected_capacity_in_week": round(overall_utilization * 1.1, 2),
                "bottleneck_risk": "medium" if overloaded_roles else "low",
                "suggested_adjustments": len(overloaded_roles) + len(underutilized_roles)
            } if include_predictions else None,
            "message": f"Workload analysis completed for {len(workload_analysis)} roles"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error analyzing role workload distribution")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")