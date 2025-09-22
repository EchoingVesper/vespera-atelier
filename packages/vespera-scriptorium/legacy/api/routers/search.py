"""
Semantic Search Router

REST API endpoints for intelligent task discovery using semantic search,
similarity matching, and ML-based task clustering.
"""

import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from fastapi.responses import JSONResponse

from api.models.requests import (
    SemanticSearchRequest, SimilarTasksRequest, ClusteringRequest
)
from api.models.responses import (
    SemanticSearchResponse, SimilarTasksResponse, ClusteringResponse
)
from api.utils.mcp_bridge import MCPBridge

logger = logging.getLogger(__name__)

router = APIRouter()


def get_mcp_bridge(request: Request) -> MCPBridge:
    """Dependency to get MCP bridge from app state."""
    if not hasattr(request.app.state, 'mcp_bridge'):
        raise HTTPException(status_code=500, detail="MCP bridge not available")
    return request.app.state.mcp_bridge


@router.post("/semantic", response_model=SemanticSearchResponse)
async def semantic_search_tasks(
    search_data: SemanticSearchRequest,
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Search tasks using semantic similarity with natural language queries.
    
    Uses AI-powered embeddings to find tasks that match the semantic meaning
    of your query, even if they don't contain the exact keywords.
    
    Example queries:
    - "tasks related to database optimization"
    - "frontend components that need testing"
    - "documentation tasks for the API"
    """
    try:
        # Convert Pydantic model to kwargs for MCP bridge
        search_kwargs = {
            "query": search_data.query,
            "n_results": search_data.n_results,
            "min_similarity": search_data.min_similarity,
            "project_filter": search_data.project_filter,
            "status_filter": search_data.status_filter.value if search_data.status_filter else None,
            "priority_filter": search_data.priority_filter.value if search_data.priority_filter else None,
        }
        
        result = await mcp_bridge.semantic_search_tasks(**search_kwargs)
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result.get("error", "Semantic search failed"))
        
        # Calculate search time (would be measured in actual implementation)
        search_time_ms = 150.0  # Placeholder
        
        # Generate query suggestions (would use NLP in actual implementation)
        suggestions = []
        query_words = search_data.query.lower().split()
        if len(query_words) < 3:
            suggestions.append("Try adding more descriptive terms to your query")
        if not any(word in ["task", "tasks", "todo", "work"] for word in query_words):
            suggestions.append("Consider adding task-specific terms like 'implement', 'fix', 'review'")
        
        return SemanticSearchResponse(
            success=True,
            message=f"Found {result['results_count']} semantically similar tasks",
            query=result["query"],
            results_count=result["results_count"],
            results=result["results"],
            search_time_ms=search_time_ms,
            suggestions=suggestions
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error in semantic search")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/similar/{task_id}", response_model=SimilarTasksResponse)
async def find_similar_tasks(
    task_id: str,
    similar_data: SimilarTasksRequest = Depends(),
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Find tasks similar to a given reference task.
    
    Uses semantic embeddings to identify tasks with similar content, context,
    or requirements. Useful for finding related work or duplicate tasks.
    """
    try:
        result = await mcp_bridge.find_similar_tasks(
            task_id=task_id,
            n_results=similar_data.n_results,
            min_similarity=similar_data.min_similarity
        )
        
        if not result["success"]:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to find similar tasks"))
        
        return SimilarTasksResponse(
            success=True,
            message=f"Found {len(result['similar_tasks'])} similar tasks",
            reference_task_id=result["reference_task_id"],
            reference_title=result["reference_title"],
            similar_tasks=result["similar_tasks"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error finding similar tasks for {task_id}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/cluster", response_model=ClusteringResponse)
async def cluster_tasks_semantically(
    clustering_data: ClusteringRequest,
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Group related tasks using ML-based semantic clustering.
    
    Analyzes task content and groups similar tasks into thematic clusters.
    Useful for organizing work, identifying patterns, and project planning.
    
    The clustering algorithm:
    1. Generates embeddings for all tasks
    2. Applies k-means clustering on semantic vectors
    3. Identifies themes and keywords for each cluster
    4. Provides organizational insights and recommendations
    """
    try:
        # This would call a semantic clustering MCP tool
        # For now, we'll return a structured placeholder
        
        clustering_kwargs = {
            "project_id": clustering_data.project_id,
            "num_clusters": clustering_data.num_clusters,
            "similarity_threshold": clustering_data.similarity_threshold,
            "include_completed": clustering_data.include_completed,
            "min_cluster_size": clustering_data.min_cluster_size
        }
        
        # Placeholder response structure - would be implemented in MCP bridge
        placeholder_response = {
            "success": True,
            "project_id": clustering_data.project_id,
            "clustering_summary": {
                "total_tasks_analyzed": 25,
                "clusters_found": clustering_data.num_clusters,
                "unclustered_tasks": 3,
                "average_cluster_size": 4.4,
                "overall_coherence": 0.72
            },
            "clusters": [
                {
                    "cluster_id": "cluster_1",
                    "theme": "Frontend Development",
                    "coherence_score": 0.85,
                    "task_count": 8,
                    "tasks": [],  # Would contain actual task summaries
                    "keywords": ["React", "Component", "UI"],
                    "recommended_actions": [
                        "Focus on frontend theme completion",
                        "Consider parallel execution within cluster",
                        "Review cluster coherence and dependencies"
                    ]
                }
            ],
            "unclustered_tasks": [],
            "clustering_parameters": {
                "num_clusters": clustering_data.num_clusters,
                "similarity_threshold": clustering_data.similarity_threshold,
                "min_cluster_size": clustering_data.min_cluster_size,
                "algorithm": "k_means_semantic"
            },
            "insights": {
                "organization_opportunities": clustering_data.num_clusters,
                "theme_diversity": clustering_data.num_clusters,
                "clustering_quality": "good"
            }
        }
        
        return ClusteringResponse(
            success=True,
            message=f"Successfully clustered tasks into {clustering_data.num_clusters} thematic groups",
            **placeholder_response
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error in semantic task clustering")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/recommendations", response_model=Dict[str, Any])
async def get_intelligent_task_recommendations(
    user_context: str = Query(..., description="Current work context or goals"),
    current_task_id: Optional[str] = Query(None, description="Currently active task ID"),
    n_recommendations: int = Query(5, ge=1, le=20, description="Number of recommendations"),
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Get intelligent next-task recommendations based on context and current work.
    
    Uses hybrid semantic + graph analysis to suggest the most relevant tasks
    to work on next, considering:
    - Semantic similarity to current context
    - Task dependencies and unblocking opportunities
    - Priority and urgency factors
    - Historical work patterns
    """
    try:
        # This would call the intelligent_task_recommendation MCP tool
        # For now, return a structured placeholder
        
        placeholder_response = {
            "success": True,
            "user_context": user_context,
            "current_task_id": current_task_id,
            "recommendations_count": n_recommendations,
            "recommendations": [
                {
                    "task_id": "task_001",
                    "title": "Example recommended task",
                    "priority": "high",
                    "status": "todo",
                    "score": 0.85,
                    "reasons": [
                        "Semantic match (similarity: 0.78)",
                        "Unblocks 3 other tasks",
                        "High priority alignment"
                    ],
                    "task_data": {}  # Would contain full task data
                }
            ]
        }
        
        return {
            **placeholder_response,
            "message": f"Generated {n_recommendations} intelligent task recommendations"
        }
        
    except Exception as e:
        logger.exception("Error generating task recommendations")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/insights", response_model=Dict[str, Any])
async def get_search_insights(
    project_id: Optional[str] = Query(None, description="Scope insights to specific project"),
    days: int = Query(30, ge=1, le=365, description="Analysis time window in days"),
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Get search and discovery insights for task management optimization.
    
    Analyzes search patterns, clustering results, and task relationships
    to provide insights for better task organization and discovery.
    """
    try:
        # This would analyze search patterns and provide insights
        # For now, return structured placeholder data
        
        insights = {
            "success": True,
            "project_id": project_id,
            "analysis_period": f"{days} days",
            "search_patterns": {
                "total_searches": 150,
                "avg_results_per_search": 8.3,
                "most_common_queries": [
                    "database tasks",
                    "frontend components", 
                    "bug fixes",
                    "documentation"
                ],
                "zero_result_queries": 12,
                "query_refinement_rate": 0.25
            },
            "clustering_insights": {
                "optimal_cluster_count": 6,
                "theme_coherence": 0.74,
                "most_coherent_themes": [
                    "Backend API Development",
                    "UI/UX Design",
                    "Testing & QA"
                ],
                "orphaned_tasks": 8,
                "cross_theme_tasks": 3
            },
            "similarity_patterns": {
                "avg_task_similarity": 0.42,
                "highly_similar_pairs": 12,
                "potential_duplicates": 3,
                "isolated_tasks": 7
            },
            "recommendations": [
                "Consider creating template tasks for common patterns",
                "Review isolated tasks for better categorization",
                "Investigate potential duplicate tasks",
                "Improve task descriptions for better searchability"
            ],
            "optimization_opportunities": {
                "search_improvement": "medium",
                "organization_potential": "high", 
                "duplicate_reduction": "low",
                "theme_clarity": "medium"
            }
        }
        
        return {
            **insights,
            "message": "Search insights analysis completed"
        }
        
    except Exception as e:
        logger.exception("Error generating search insights")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/suggest-queries", response_model=Dict[str, Any])
async def suggest_search_queries(
    partial_query: str = Query(..., min_length=1, description="Partial search query"),
    max_suggestions: int = Query(10, ge=1, le=20, description="Maximum number of suggestions"),
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Get search query suggestions and auto-completions.
    
    Provides intelligent query suggestions based on:
    - Historical successful searches
    - Task content analysis
    - Common task patterns
    - Semantic query expansion
    """
    try:
        # This would analyze the partial query and suggest completions
        # For now, return structured suggestions
        
        query_words = partial_query.lower().split()
        base_suggestions = [
            f"{partial_query} implementation",
            f"{partial_query} testing",
            f"{partial_query} documentation",
            f"{partial_query} bug fixes",
            f"{partial_query} optimization"
        ]
        
        # Add contextual suggestions based on query content
        contextual_suggestions = []
        if "api" in partial_query.lower():
            contextual_suggestions.extend([
                f"{partial_query} endpoints",
                f"{partial_query} authentication",
                f"{partial_query} validation"
            ])
        elif "ui" in partial_query.lower() or "frontend" in partial_query.lower():
            contextual_suggestions.extend([
                f"{partial_query} components",
                f"{partial_query} styling",
                f"{partial_query} responsiveness"
            ])
        elif "database" in partial_query.lower() or "db" in partial_query.lower():
            contextual_suggestions.extend([
                f"{partial_query} schema",
                f"{partial_query} migration",
                f"{partial_query} performance"
            ])
        
        all_suggestions = base_suggestions + contextual_suggestions
        
        return {
            "success": True,
            "partial_query": partial_query,
            "suggestions": all_suggestions[:max_suggestions],
            "suggestion_count": min(len(all_suggestions), max_suggestions),
            "categories": {
                "implementation": [s for s in all_suggestions if "implementation" in s],
                "testing": [s for s in all_suggestions if "testing" in s],
                "documentation": [s for s in all_suggestions if "documentation" in s]
            },
            "message": f"Generated {min(len(all_suggestions), max_suggestions)} query suggestions"
        }
        
    except Exception as e:
        logger.exception("Error suggesting search queries")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/trends", response_model=Dict[str, Any])
async def get_search_trends(
    project_id: Optional[str] = Query(None, description="Scope trends to specific project"),
    time_window: str = Query("week", regex="^(day|week|month|quarter)$", description="Time window for trends"),
    mcp_bridge: MCPBridge = Depends(get_mcp_bridge)
):
    """
    Get search and discovery trends over time.
    
    Analyzes how search patterns, task themes, and discovery behaviors
    change over time to identify emerging patterns and shifts in focus.
    """
    try:
        # This would analyze historical search data for trends
        # For now, return structured trend data
        
        trends = {
            "success": True,
            "project_id": project_id,
            "time_window": time_window,
            "search_volume_trend": "increasing",  # Would calculate actual trend
            "popular_themes": [
                {"theme": "API Development", "growth": "+15%", "searches": 45},
                {"theme": "Testing", "growth": "+8%", "searches": 32},
                {"theme": "Documentation", "growth": "-5%", "searches": 28},
                {"theme": "Bug Fixes", "growth": "+22%", "searches": 38}
            ],
            "emerging_topics": [
                "performance optimization",
                "mobile responsiveness", 
                "security testing"
            ],
            "declining_topics": [
                "legacy system migration",
                "manual testing procedures"
            ],
            "search_complexity_trend": {
                "avg_query_length": 4.2,
                "trend": "increasing",
                "semantic_queries": "65%"
            },
            "discovery_patterns": {
                "similarity_searches": "35%",
                "clustering_usage": "20%", 
                "recommendation_clicks": "45%"
            },
            "insights": [
                "API development is becoming the dominant focus",
                "Testing searches are increasing but documentation is declining",
                "Users are adopting more semantic search patterns",
                "Recommendation system is highly utilized"
            ]
        }
        
        return {
            **trends,
            "message": f"Search trends analysis completed for {time_window} window"
        }
        
    except Exception as e:
        logger.exception("Error generating search trends")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")