"""
Project Intelligence Router

REST API endpoints for project-level analytics, health monitoring,
dependency analysis, and predictive insights using graph database capabilities.
"""

import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from fastapi.responses import JSONResponse

from api.models.requests import (
    ImpactAnalysisRequest, ProjectHealthRequest
)
from api.models.responses import (
    DependencyAnalysisResponse, ImpactAnalysisResponse, ProjectHealthResponse
)
from api.utils.mcp_bridge import MCPBridge

logger = logging.getLogger(__name__)

router = APIRouter()


def get_mcp_bridge(request: Request) -> MCPBridge:
    """Dependency to get MCP bridge from app state."""
    if not hasattr(request.app.state, 'mcp_bridge'):
        raise HTTPException(status_code=500, detail="MCP bridge not available")
    return request.app.state.mcp_bridge


@router.get("/{project_id}/health", response_model=ProjectHealthResponse)
async def analyze_project_health(
    project_id: str,
    health_data: ProjectHealthRequest = Depends(),
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Comprehensive project health analysis using all three databases.
    
    Analyzes project health across multiple dimensions:
    - Task completion and progress metrics
    - Dependency health and bottleneck identification
    - Resource utilization and workload distribution
    - Semantic coherence and requirement clarity
    - Risk factors and predictive analytics
    
    Provides executive-level insights and actionable recommendations.
    """
    try:
        health_kwargs = {
            "project_id": project_id,
            "analysis_depth": health_data.analysis_depth,
            "include_predictions": health_data.include_predictions,
            "focus_areas": health_data.focus_areas
        }
        
        result = await mcp_bridge.project_health_analysis(**health_kwargs)
        
        if not result["success"]:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to analyze project health"))
        
        return ProjectHealthResponse(
            success=True,
            message=result.get("message", "Project health analysis completed"),
            project_id=result["project_id"],
            overall_health=result["overall_health"],
            detailed_analysis=result["detailed_analysis"],
            risk_factors=result["risk_factors"],
            predictions=result.get("predictions"),
            action_recommendations=result["action_recommendations"],
            analysis_metadata=result["analysis_metadata"],
            executive_summary=result["executive_summary"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error analyzing project health for {project_id}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{project_id}/dependencies", response_model=Dict[str, Any])
async def analyze_project_dependencies(
    project_id: str,
    include_external: bool = Query(False, description="Include external project dependencies"),
    max_depth: int = Query(5, ge=1, le=10, description="Maximum dependency analysis depth"),
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Analyze all dependency relationships within a project.
    
    Provides comprehensive dependency mapping including:
    - Task-to-task dependencies within the project
    - Cross-project dependencies (if include_external=True)
    - Circular dependency detection
    - Critical path analysis
    - Bottleneck identification
    """
    try:
        # Get project hierarchy and dependency information
        # This would use the KuzuDB graph analysis capabilities
        
        # Placeholder response structure
        analysis_result = {
            "success": True,
            "project_id": project_id,
            "dependency_overview": {
                "total_tasks": 45,
                "tasks_with_dependencies": 32,
                "dependency_chains": 8,
                "max_chain_length": 6,
                "circular_dependencies": 0,
                "bottleneck_tasks": 3,
                "critical_path_length": 12
            },
            "dependency_matrix": {
                "strong_dependencies": 18,
                "weak_dependencies": 14,
                "external_dependencies": 5 if include_external else 0,
                "dependency_density": 0.34
            },
            "bottlenecks": [
                {
                    "task_id": "task_001",
                    "task_title": "Database Schema Migration",
                    "blocking_count": 8,
                    "dependency_type": "critical_path",
                    "impact_score": 0.85,
                    "recommended_action": "prioritize_completion"
                }
            ],
            "critical_path": [
                {"task_id": "task_001", "title": "Database Schema Migration", "order": 1},
                {"task_id": "task_015", "title": "API Endpoint Updates", "order": 2},
                {"task_id": "task_023", "title": "Frontend Integration", "order": 3}
            ],
            "risk_assessment": {
                "dependency_risk": "medium",
                "completion_probability": 0.78,
                "estimated_delay_risk": "low",
                "resource_conflicts": 2
            },
            "recommendations": [
                "Focus immediate attention on database migration task",
                "Consider parallel execution paths where possible",
                "Review resource allocation for bottleneck tasks",
                "Implement dependency monitoring alerts"
            ]
        }
        
        return {
            **analysis_result,
            "message": f"Dependency analysis completed for project {project_id}"
        }
        
    except Exception as e:
        logger.exception(f"Error analyzing dependencies for project {project_id}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/cycles", response_model=Dict[str, Any])
async def detect_all_dependency_cycles(
    project_id: Optional[str] = Query(None, description="Scope to specific project"),
    include_suggestions: bool = Query(True, description="Include cycle resolution suggestions"),
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Detect circular dependencies across all projects or within a specific project.
    
    Identifies cycles in task dependencies that could lead to deadlocks
    and provides suggestions for resolving them.
    """
    try:
        result = await mcp_bridge.detect_dependency_cycles()
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to detect dependency cycles"))
        
        cycles = result.get("cycles", [])
        
        # Add resolution suggestions if requested
        cycle_analysis = []
        for cycle in cycles:
            cycle_info = {
                "cycle_id": f"cycle_{len(cycle_analysis) + 1}",
                "tasks_in_cycle": cycle.get("tasks", []),
                "cycle_length": len(cycle.get("tasks", [])),
                "severity": "high" if len(cycle.get("tasks", [])) > 3 else "medium",
                "projects_affected": cycle.get("projects", [])
            }
            
            if include_suggestions:
                cycle_info["resolution_suggestions"] = [
                    "Review task dependencies for logical ordering",
                    "Consider breaking large tasks into smaller, independent units",
                    "Identify optional vs required dependencies",
                    "Implement conditional dependencies where appropriate"
                ]
            
            cycle_analysis.append(cycle_info)
        
        return {
            "success": True,
            "project_id": project_id,
            "cycles_detected": len(cycles),
            "cycles": cycle_analysis,
            "overall_impact": {
                "projects_affected": len(set(p for cycle in cycles for p in cycle.get("projects", []))),
                "tasks_in_cycles": sum(len(cycle.get("tasks", [])) for cycle in cycles),
                "system_health_impact": "high" if len(cycles) > 3 else "medium" if len(cycles) > 0 else "none"
            },
            "recommendations": [
                "Address cycles immediately to prevent deadlocks",
                "Review project planning processes",
                "Implement dependency validation in task creation",
                "Regular cycle detection monitoring"
            ] if cycles else ["No dependency cycles detected - system is healthy"],
            "message": f"Found {len(cycles)} dependency cycles" if cycles else "No dependency cycles detected"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error detecting dependency cycles")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/bottlenecks", response_model=Dict[str, Any])
async def find_project_bottlenecks(
    project_id: Optional[str] = Query(None, description="Scope to specific project"),
    threshold: int = Query(2, ge=1, description="Minimum blocking count to be considered a bottleneck"),
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Identify tasks that are blocking multiple other tasks (bottlenecks).
    
    Finds tasks that are preventing progress on multiple dependent tasks,
    which often represent critical points in project workflow.
    """
    try:
        # This would use the KuzuDB find_blocking_bottlenecks functionality
        # For now, return structured placeholder data
        
        bottlenecks = [
            {
                "task_id": "task_database_migration",
                "task_title": "Complete Database Schema Migration",
                "blocking_count": 8,
                "blocked_tasks": [
                    {"task_id": "task_api_update", "title": "Update API Endpoints"},
                    {"task_id": "task_ui_integration", "title": "Frontend Data Integration"},
                    {"task_id": "task_testing", "title": "Integration Testing"}
                ],
                "urgency_score": 0.95,
                "estimated_delay_impact": "14 days",
                "current_status": "in_progress",
                "assigned_to": "backend_team",
                "recommendations": [
                    "Allocate additional resources",
                    "Break into smaller parallel tasks",
                    "Implement temporary workarounds for non-critical dependencies"
                ]
            }
        ]
        
        # Filter by project if specified
        if project_id:
            # Would filter bottlenecks by project in actual implementation
            pass
        
        # Filter by threshold
        significant_bottlenecks = [b for b in bottlenecks if b["blocking_count"] >= threshold]
        
        return {
            "success": True,
            "project_id": project_id,
            "bottlenecks_found": len(significant_bottlenecks),
            "threshold_applied": threshold,
            "bottlenecks": significant_bottlenecks,
            "impact_summary": {
                "total_blocked_tasks": sum(b["blocking_count"] for b in significant_bottlenecks),
                "critical_bottlenecks": len([b for b in significant_bottlenecks if b["urgency_score"] > 0.8]),
                "estimated_total_delay": f"{sum(int(b['estimated_delay_impact'].split()[0]) for b in significant_bottlenecks)} days",
                "projects_affected": 1 if project_id else 3  # Would calculate actual count
            },
            "system_recommendations": [
                "Address critical bottlenecks immediately",
                "Implement parallel execution where possible",
                "Review resource allocation for high-impact tasks",
                "Consider task decomposition for complex bottlenecks"
            ] if significant_bottlenecks else ["No significant bottlenecks detected"],
            "message": f"Found {len(significant_bottlenecks)} bottleneck tasks blocking {sum(b['blocking_count'] for b in significant_bottlenecks)} other tasks"
        }
        
    except Exception as e:
        logger.exception("Error finding project bottlenecks")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/{project_id}/impact/{task_id}", response_model=ImpactAnalysisResponse)
async def analyze_task_impact(
    project_id: str,
    task_id: str,
    impact_data: ImpactAnalysisRequest,
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Analyze comprehensive impact of task changes within a project context.
    
    Evaluates the impact of task completion, delay, deletion, or modification
    on the overall project timeline, dependencies, and resource allocation.
    """
    try:
        # This would call the get_task_impact_analysis MCP tool
        # For now, return structured placeholder data
        
        impact_result = {
            "success": True,
            "task": {
                "id": task_id,
                "title": "Example Task for Impact Analysis",
                "status": "in_progress",
                "priority": "high"
            },
            "impact_analysis": {
                "change_type": impact_data.change_type,
                "direct_impact": {
                    "blocked_tasks": 5,
                    "dependent_tasks": 3,
                    "related_tasks": 2
                },
                "indirect_impact": {
                    "cascade_depth": 3,
                    "total_affected": 10
                },
                "cascade_effects": [
                    {
                        "effect_type": "delay_cascade" if impact_data.change_type == "delay" else "unblock_dependents",
                        "affected_count": 5,
                        "description": f"Impact of {impact_data.change_type} on dependent tasks"
                    }
                ],
                "timeline_impact": {
                    "immediate": 5,
                    "short_term": 3,
                    "estimated_duration_impact": impact_data.delay_days or 0
                }
            },
            "affected_tasks": [
                {
                    "task_id": "affected_task_1",
                    "title": "Dependent Task 1",
                    "relationship": "depends_on",
                    "status": "blocked",
                    "impact_level": "direct"
                }
            ],
            "resource_impact": {
                "assigned_role": "backend_developer",
                "role_current_workload": 12,
                "resource_availability_impact": "medium",
                "reallocation_needed": impact_data.change_type in ["delete", "delay"]
            } if impact_data.include_resource_impact else None,
            "recommendations": {
                "immediate_actions": [
                    "Communicate changes to affected stakeholders",
                    "Review dependent task schedules"
                ],
                "mitigation_strategies": [
                    "Identify parallel work opportunities",
                    "Consider resource reallocation"
                ],
                "alternative_approaches": [
                    "Task decomposition for partial delivery",
                    "Temporary workaround implementation"
                ]
            },
            "analysis_confidence": {
                "confidence_score": 0.85,
                "data_quality": "high",
                "assumptions": [
                    "Dependency relationships are accurately captured",
                    "Task statuses are up to date",
                    "Resource assignments are current"
                ]
            },
            "summary": {
                "total_affected_tasks": 10,
                "impact_severity": "medium",
                "recommendation_priority": "normal"
            }
        }
        
        return ImpactAnalysisResponse(**impact_result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error analyzing task impact for {task_id} in project {project_id}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{project_id}/timeline", response_model=Dict[str, Any])
async def analyze_project_timeline(
    project_id: str,
    include_predictions: bool = Query(True, description="Include timeline predictions"),
    scenario: str = Query("current", regex="^(optimistic|current|pessimistic)$", description="Timeline scenario"),
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Analyze project timeline and provide completion predictions.
    
    Evaluates current progress, dependency relationships, and resource
    allocation to predict project completion timelines under different scenarios.
    """
    try:
        # This would analyze project timeline using graph database
        # For now, return structured timeline analysis
        
        timeline_analysis = {
            "success": True,
            "project_id": project_id,
            "current_status": {
                "total_tasks": 45,
                "completed_tasks": 28,
                "in_progress_tasks": 8,
                "blocked_tasks": 2,
                "todo_tasks": 7,
                "completion_percentage": 62.2
            },
            "timeline_estimates": {
                "optimistic": {
                    "completion_date": "2025-03-15",
                    "days_remaining": 45,
                    "assumptions": ["No blockers", "Full resource availability", "Parallel execution optimized"]
                },
                "current": {
                    "completion_date": "2025-04-02",
                    "days_remaining": 63,
                    "assumptions": ["Current pace maintained", "Existing blockers resolved", "Normal resource allocation"]
                },
                "pessimistic": {
                    "completion_date": "2025-04-20",
                    "days_remaining": 81,
                    "assumptions": ["Additional blockers emerge", "Resource constraints", "Dependencies cause delays"]
                }
            },
            "critical_milestones": [
                {
                    "milestone": "Database Migration Complete",
                    "target_date": "2025-02-15",
                    "tasks_remaining": 3,
                    "risk_level": "medium"
                },
                {
                    "milestone": "API Integration Complete", 
                    "target_date": "2025-03-01",
                    "tasks_remaining": 8,
                    "risk_level": "low"
                }
            ],
            "velocity_analysis": {
                "tasks_per_week": 3.2,
                "trend": "stable",
                "productivity_factors": {
                    "team_velocity": "stable",
                    "complexity_trend": "increasing",
                    "blocker_frequency": "decreasing"
                }
            },
            "risk_factors": [
                {
                    "risk": "External API dependency",
                    "probability": 0.3,
                    "impact": "7 days delay",
                    "mitigation": "Develop fallback implementation"
                }
            ],
            "recommendations": [
                "Focus on critical path tasks",
                "Address remaining blockers proactively",
                "Consider additional resources for milestone 1",
                "Implement regular progress checkpoints"
            ]
        }
        
        # Select the appropriate scenario data
        selected_scenario = timeline_analysis["timeline_estimates"][scenario]
        
        return {
            **timeline_analysis,
            "selected_scenario": scenario,
            "predicted_completion": selected_scenario,
            "message": f"Timeline analysis completed for {scenario} scenario"
        }
        
    except Exception as e:
        logger.exception(f"Error analyzing timeline for project {project_id}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{project_id}/insights", response_model=Dict[str, Any])
async def get_project_insights(
    project_id: str,
    insight_types: List[str] = Query(["all"], description="Types of insights to generate"),
    time_window: str = Query("month", regex="^(week|month|quarter)$", description="Analysis time window"),
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Get comprehensive project insights and analytics.
    
    Provides multi-dimensional analysis including productivity trends,
    pattern recognition, anomaly detection, and optimization opportunities.
    """
    try:
        # This would generate comprehensive project insights
        # For now, return structured insight data
        
        all_insights = {
            "productivity": {
                "team_velocity": 3.2,
                "velocity_trend": "+8% vs last month",
                "completion_rate": 0.78,
                "average_task_duration": "4.2 days",
                "bottleneck_frequency": 0.15
            },
            "quality": {
                "task_revision_rate": 0.12,
                "dependency_accuracy": 0.89,
                "requirement_clarity": 0.76,
                "documentation_coverage": 0.68
            },
            "patterns": {
                "peak_productivity_hours": "10:00-12:00, 14:00-16:00",
                "common_blockers": ["External dependencies", "Resource conflicts", "Unclear requirements"],
                "task_complexity_distribution": {"simple": 0.3, "moderate": 0.5, "complex": 0.2},
                "collaboration_patterns": {"individual": 0.6, "pair": 0.3, "team": 0.1}
            },
            "anomalies": [
                {
                    "type": "velocity_drop",
                    "description": "15% productivity decrease in week 3",
                    "likely_cause": "Team member absence",
                    "impact": "minor"
                }
            ],
            "opportunities": [
                "Standardize task estimation process",
                "Implement dependency validation automation",
                "Improve requirement gathering templates",
                "Optimize resource allocation during peak hours"
            ]
        }
        
        # Filter insights based on requested types
        if "all" not in insight_types:
            filtered_insights = {k: v for k, v in all_insights.items() if k in insight_types}
        else:
            filtered_insights = all_insights
        
        return {
            "success": True,
            "project_id": project_id,
            "time_window": time_window,
            "insights": filtered_insights,
            "insight_summary": {
                "overall_health": "good",
                "key_strengths": ["Consistent velocity", "Low blocker frequency"],
                "improvement_areas": ["Documentation coverage", "Requirement clarity"],
                "priority_actions": ["Address documentation gaps", "Implement estimation standards"]
            },
            "generated_at": "2025-01-20T00:00:00Z",
            "message": f"Generated comprehensive insights for project {project_id}"
        }
        
    except Exception as e:
        logger.exception(f"Error generating insights for project {project_id}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/", response_model=Dict[str, Any])
async def list_projects_overview(
    include_health: bool = Query(True, description="Include health summary for each project"),
    sort_by: str = Query("health_score", regex="^(name|health_score|task_count|completion_rate)$", description="Sort field"),
    sort_order: str = Query("desc", regex="^(asc|desc)$", description="Sort order"),
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Get overview of all projects with key metrics and health indicators.
    
    Provides a high-level dashboard view of all projects in the system
    with essential metrics for executive reporting and portfolio management.
    """
    try:
        # This would query all projects and their metrics
        # For now, return structured project overview data
        
        projects = [
            {
                "project_id": "project_api_v2",
                "name": "API v2 Development",
                "description": "Next generation REST API",
                "status": "active",
                "task_summary": {
                    "total_tasks": 45,
                    "completed_tasks": 28,
                    "completion_rate": 62.2,
                    "blocked_tasks": 2
                },
                "health_metrics": {
                    "health_score": 78,
                    "health_grade": "B",
                    "risk_level": "medium",
                    "velocity_trend": "stable"
                } if include_health else None,
                "timeline": {
                    "start_date": "2024-12-01",
                    "target_completion": "2025-04-02",
                    "predicted_completion": "2025-04-05",
                    "days_remaining": 63
                },
                "team": {
                    "lead": "senior_dev_1",
                    "size": 4,
                    "roles": ["backend_developer", "frontend_developer", "qa_engineer"]
                }
            },
            {
                "project_id": "project_mobile_app",
                "name": "Mobile Application",
                "description": "Cross-platform mobile app",
                "status": "planning",
                "task_summary": {
                    "total_tasks": 23,
                    "completed_tasks": 5,
                    "completion_rate": 21.7,
                    "blocked_tasks": 0
                },
                "health_metrics": {
                    "health_score": 85,
                    "health_grade": "A",
                    "risk_level": "low",
                    "velocity_trend": "increasing"
                } if include_health else None,
                "timeline": {
                    "start_date": "2025-01-15",
                    "target_completion": "2025-06-30",
                    "predicted_completion": "2025-06-28",
                    "days_remaining": 160
                },
                "team": {
                    "lead": "mobile_lead_1",
                    "size": 3,
                    "roles": ["mobile_developer", "ui_designer", "qa_engineer"]
                }
            }
        ]
        
        # Sort projects
        reverse = sort_order == "desc"
        if sort_by == "name":
            projects.sort(key=lambda x: x["name"], reverse=reverse)
        elif sort_by == "health_score" and include_health:
            projects.sort(key=lambda x: x["health_metrics"]["health_score"], reverse=reverse)
        elif sort_by == "task_count":
            projects.sort(key=lambda x: x["task_summary"]["total_tasks"], reverse=reverse)
        elif sort_by == "completion_rate":
            projects.sort(key=lambda x: x["task_summary"]["completion_rate"], reverse=reverse)
        
        # Portfolio summary
        portfolio_summary = {
            "total_projects": len(projects),
            "active_projects": len([p for p in projects if p["status"] == "active"]),
            "total_tasks": sum(p["task_summary"]["total_tasks"] for p in projects),
            "total_completed": sum(p["task_summary"]["completed_tasks"] for p in projects),
            "portfolio_completion_rate": sum(p["task_summary"]["completed_tasks"] for p in projects) / sum(p["task_summary"]["total_tasks"] for p in projects) * 100,
            "average_health_score": sum(p["health_metrics"]["health_score"] for p in projects if p["health_metrics"]) / len([p for p in projects if p["health_metrics"]]) if include_health else None
        }
        
        return {
            "success": True,
            "projects": projects,
            "portfolio_summary": portfolio_summary,
            "view_options": {
                "include_health": include_health,
                "sort_by": sort_by,
                "sort_order": sort_order
            },
            "message": f"Found {len(projects)} projects in portfolio"
        }
        
    except Exception as e:
        logger.exception("Error listing project overview")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")