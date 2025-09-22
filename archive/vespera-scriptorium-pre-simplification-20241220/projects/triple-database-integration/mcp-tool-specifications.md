# MCP Tool Specifications

**Triple Database Integration - Enhanced MCP Tool Design**  
**Date**: August 18, 2025  
**Version**: 1.0

## Overview

This document defines the enhanced MCP tool specifications for the triple-database integration (SQLite + Chroma + KuzuDB) in Vespera V2. The tools are organized into functional categories while maintaining backward compatibility with existing V2 MCP tools.

## Tool Organization Strategy

### Existing V2 Tools (Enhanced)
All current V2 MCP tools will be enhanced to leverage the triple-database system while maintaining full backward compatibility.

### New Tool Categories
1. **Semantic Search Tools** - Chroma vector operations
2. **Graph Analysis Tools** - KuzuDB relationship queries  
3. **Hybrid Intelligence Tools** - Cross-database analytics
4. **Database Management Tools** - System administration
5. **Synchronization Tools** - Data consistency management

## Enhanced Existing Tools

### 1. create_task (Enhanced)

```python
@mcp.tool()
async def create_task(task_input: TaskCreateInput) -> Dict[str, Any]:
    """Create a new task with automatic triple-database integration."""
    
    # Enhanced input validation
    task_manager, role_manager = get_managers()
    
    # Create task in SQLite (existing logic preserved)
    task = await task_manager.create_task(
        title=task_input.title,
        description=task_input.description,
        parent_id=task_input.parent_id,
        project_id=task_input.project_id,
        feature=task_input.feature,
        priority=task_input.priority
    )
    
    # NEW: Automatic embedding generation
    embedding_result = await task_manager.triple_db_service.generate_task_embedding(task)
    
    # NEW: Automatic graph node creation
    graph_result = await task_manager.triple_db_service.create_graph_node(task)
    
    # Enhanced response with triple-DB references
    return {
        "task": task.to_dict(),
        "embedding_id": embedding_result.embedding_id,
        "graph_node_id": graph_result.node_id,
        "sync_status": "synced",
        "message": f"Task '{task.title}' created with semantic and graph integration"
    }
```

### 2. get_task_dashboard (Enhanced)

```python
@mcp.tool()
async def get_task_dashboard(
    project_id: Optional[str] = None,
    include_semantic_insights: bool = True,
    include_graph_metrics: bool = True
) -> Dict[str, Any]:
    """Enhanced dashboard with semantic and graph intelligence."""
    
    task_manager, _ = get_managers()
    
    # Existing dashboard data (preserved)
    base_dashboard = await task_manager.get_task_dashboard(project_id)
    
    if include_semantic_insights:
        # NEW: Semantic insights from Chroma
        semantic_insights = await task_manager.triple_db_service.get_semantic_insights(project_id)
        base_dashboard["semantic_insights"] = semantic_insights
    
    if include_graph_metrics:
        # NEW: Graph metrics from KuzuDB  
        graph_metrics = await task_manager.triple_db_service.get_graph_metrics(project_id)
        base_dashboard["graph_metrics"] = graph_metrics
    
    # NEW: Synchronization health
    sync_health = await task_manager.triple_db_service.get_sync_health()
    base_dashboard["sync_health"] = sync_health
    
    return base_dashboard
```

## New Semantic Search Tools

### 1. semantic_search_tasks

```python
class SemanticSearchInput(BaseModel):
    """Input for semantic task search."""
    query: str = Field(..., description="Natural language search query")
    project_filter: Optional[str] = Field(None, description="Filter by project ID")
    status_filter: Optional[List[str]] = Field(None, description="Filter by task status")
    priority_filter: Optional[List[str]] = Field(None, description="Filter by priority")
    limit: int = Field(10, description="Maximum number of results", ge=1, le=50)
    similarity_threshold: float = Field(0.5, description="Minimum similarity score", ge=0.0, le=1.0)
    include_code_references: bool = Field(False, description="Include code reference matches")

@mcp.tool()
async def semantic_search_tasks(search_input: SemanticSearchInput) -> Dict[str, Any]:
    """Search tasks using semantic similarity with advanced filtering."""
    
    task_manager, _ = get_managers()
    
    # Perform semantic search via Chroma
    search_results = await task_manager.triple_db_service.semantic_search(
        query=search_input.query,
        collection="tasks_content",
        limit=search_input.limit,
        similarity_threshold=search_input.similarity_threshold,
        metadata_filters={
            "project_id": search_input.project_filter,
            "status": search_input.status_filter,
            "priority": search_input.priority_filter
        }
    )
    
    # Enhance with SQLite task data
    enhanced_results = []
    for result in search_results:
        task = await task_manager.get_task(result.task_id)
        enhanced_results.append({
            "task": task.to_dict(),
            "similarity_score": result.similarity_score,
            "matched_content": result.matched_content,
            "relevance_explanation": result.relevance_explanation
        })
    
    # Optional: Include code reference matches
    code_matches = []
    if search_input.include_code_references:
        code_matches = await task_manager.triple_db_service.semantic_search(
            query=search_input.query,
            collection="code_references",
            limit=search_input.limit // 2
        )
    
    return {
        "query": search_input.query,
        "total_matches": len(enhanced_results),
        "task_matches": enhanced_results,
        "code_matches": code_matches,
        "search_metadata": {
            "similarity_threshold": search_input.similarity_threshold,
            "collections_searched": ["tasks_content"] + (["code_references"] if search_input.include_code_references else []),
            "filters_applied": {
                "project": search_input.project_filter,
                "status": search_input.status_filter, 
                "priority": search_input.priority_filter
            }
        }
    }
```

### 2. find_similar_tasks

```python
class SimilarTasksInput(BaseModel):
    """Input for finding similar tasks."""
    task_id: str = Field(..., description="Reference task ID")
    similarity_threshold: float = Field(0.7, description="Minimum similarity score")
    limit: int = Field(5, description="Maximum number of similar tasks")
    exclude_completed: bool = Field(True, description="Exclude completed tasks")
    same_project_only: bool = Field(False, description="Limit to same project")

@mcp.tool()
async def find_similar_tasks(similar_input: SimilarTasksInput) -> Dict[str, Any]:
    """Find tasks similar to a reference task using semantic analysis."""
    
    task_manager, _ = get_managers()
    
    # Get reference task
    reference_task = await task_manager.get_task(similar_input.task_id)
    if not reference_task:
        return {"error": f"Task {similar_input.task_id} not found"}
    
    # Find similar tasks using embedding similarity
    similar_results = await task_manager.triple_db_service.find_similar_tasks(
        reference_task_id=similar_input.task_id,
        similarity_threshold=similar_input.similarity_threshold,
        limit=similar_input.limit,
        exclude_completed=similar_input.exclude_completed,
        same_project_only=similar_input.same_project_only
    )
    
    # Enhance with relationship analysis from graph
    relationship_context = await task_manager.triple_db_service.analyze_task_relationships(
        similar_input.task_id
    )
    
    return {
        "reference_task": {
            "id": reference_task.id,
            "title": reference_task.title,
            "description": reference_task.description[:200] + "..."
        },
        "similar_tasks": similar_results,
        "relationship_context": relationship_context,
        "similarity_analysis": {
            "threshold_used": similar_input.similarity_threshold,
            "semantic_factors": ["title", "description", "requirements", "context"],
            "relationship_factors": ["project", "feature", "dependencies", "assignee"]
        }
    }
```

### 3. semantic_task_clustering

```python
class ClusteringInput(BaseModel):
    """Input for semantic task clustering."""
    project_id: Optional[str] = Field(None, description="Project to cluster tasks for")
    status_filter: Optional[List[str]] = Field(None, description="Task statuses to include")
    min_cluster_size: int = Field(3, description="Minimum tasks per cluster")
    max_clusters: int = Field(10, description="Maximum number of clusters")
    similarity_threshold: float = Field(0.6, description="Clustering similarity threshold")

@mcp.tool()
async def semantic_task_clustering(cluster_input: ClusteringInput) -> Dict[str, Any]:
    """Group related tasks using semantic clustering analysis."""
    
    task_manager, _ = get_managers()
    
    # Perform semantic clustering
    clustering_results = await task_manager.triple_db_service.cluster_tasks_semantically(
        project_id=cluster_input.project_id,
        status_filter=cluster_input.status_filter,
        min_cluster_size=cluster_input.min_cluster_size,
        max_clusters=cluster_input.max_clusters,
        similarity_threshold=cluster_input.similarity_threshold
    )
    
    # Enhance clusters with graph relationship analysis
    enhanced_clusters = []
    for cluster in clustering_results.clusters:
        # Analyze graph relationships within cluster
        internal_relationships = await task_manager.triple_db_service.analyze_cluster_relationships(
            [task.id for task in cluster.tasks]
        )
        
        enhanced_clusters.append({
            "cluster_id": cluster.cluster_id,
            "theme": cluster.theme,
            "confidence_score": cluster.confidence_score,
            "task_count": len(cluster.tasks),
            "tasks": [task.to_dict() for task in cluster.tasks],
            "semantic_keywords": cluster.semantic_keywords,
            "internal_relationships": internal_relationships,
            "recommended_actions": cluster.recommended_actions
        })
    
    return {
        "project_id": cluster_input.project_id,
        "clustering_summary": {
            "total_tasks_analyzed": clustering_results.total_tasks,
            "clusters_found": len(enhanced_clusters),
            "unclustered_tasks": clustering_results.unclustered_count,
            "average_cluster_size": sum(len(c["tasks"]) for c in enhanced_clusters) / len(enhanced_clusters) if enhanced_clusters else 0
        },
        "clusters": enhanced_clusters,
        "clustering_parameters": {
            "min_cluster_size": cluster_input.min_cluster_size,
            "similarity_threshold": cluster_input.similarity_threshold,
            "algorithm": "semantic_embedding_clustering"
        }
    }
```

## New Graph Analysis Tools

### 1. analyze_task_dependencies_graph

```python
class GraphAnalysisInput(BaseModel):
    """Input for graph dependency analysis."""
    task_id: str = Field(..., description="Root task ID for analysis")
    max_depth: int = Field(3, description="Maximum traversal depth")
    include_blocked_paths: bool = Field(True, description="Include analysis of blocked dependency paths")
    analysis_direction: str = Field("both", description="Analysis direction: forward, backward, both")

@mcp.tool()
async def analyze_task_dependencies_graph(analysis_input: GraphAnalysisInput) -> Dict[str, Any]:
    """Perform deep dependency analysis using graph traversal."""
    
    task_manager, _ = get_managers()
    
    # Perform comprehensive graph analysis
    dependency_analysis = await task_manager.triple_db_service.analyze_dependencies_deep(
        root_task_id=analysis_input.task_id,
        max_depth=analysis_input.max_depth,
        direction=analysis_input.analysis_direction,
        include_blocked_paths=analysis_input.include_blocked_paths
    )
    
    # Calculate impact metrics
    impact_metrics = await task_manager.triple_db_service.calculate_task_impact(
        analysis_input.task_id
    )
    
    # Identify critical paths
    critical_paths = await task_manager.triple_db_service.find_critical_paths(
        analysis_input.task_id, 
        analysis_input.max_depth
    )
    
    return {
        "root_task_id": analysis_input.task_id,
        "dependency_tree": dependency_analysis.dependency_tree,
        "impact_metrics": {
            "total_dependent_tasks": impact_metrics.dependent_task_count,
            "critical_path_length": impact_metrics.critical_path_length,
            "blocking_impact_score": impact_metrics.blocking_impact_score,
            "completion_impact_estimate": impact_metrics.completion_impact_estimate
        },
        "critical_paths": critical_paths,
        "bottleneck_analysis": {
            "identified_bottlenecks": dependency_analysis.bottlenecks,
            "blocked_task_chains": dependency_analysis.blocked_chains,
            "recommendations": dependency_analysis.optimization_recommendations
        },
        "analysis_metadata": {
            "max_depth_analyzed": analysis_input.max_depth,
            "analysis_direction": analysis_input.analysis_direction,
            "total_relationships_traversed": dependency_analysis.relationships_count,
            "analysis_timestamp": datetime.now().isoformat()
        }
    }
```

### 2. find_dependency_cycles

```python
class CycleDetectionInput(BaseModel):
    """Input for cycle detection."""
    project_id: Optional[str] = Field(None, description="Limit analysis to specific project")
    max_cycle_length: int = Field(10, description="Maximum cycle length to detect")
    include_soft_dependencies: bool = Field(False, description="Include soft dependency relationships")

@mcp.tool()
async def find_dependency_cycles(cycle_input: CycleDetectionInput) -> Dict[str, Any]:
    """Detect circular dependencies in task graphs."""
    
    task_manager, _ = get_managers()
    
    # Detect cycles using graph algorithms
    cycle_detection_results = await task_manager.triple_db_service.detect_dependency_cycles(
        project_id=cycle_input.project_id,
        max_cycle_length=cycle_input.max_cycle_length,
        include_soft_dependencies=cycle_input.include_soft_dependencies
    )
    
    # Analyze impact of each cycle
    cycle_analysis = []
    for cycle in cycle_detection_results.cycles:
        impact_analysis = await task_manager.triple_db_service.analyze_cycle_impact(cycle)
        
        cycle_analysis.append({
            "cycle_id": cycle.cycle_id,
            "cycle_path": cycle.task_path,
            "cycle_length": len(cycle.task_path),
            "cycle_type": cycle.dependency_types,
            "impact_severity": impact_analysis.severity,
            "affected_task_count": impact_analysis.affected_tasks,
            "resolution_suggestions": impact_analysis.resolution_suggestions,
            "priority_recommendation": impact_analysis.priority
        })
    
    return {
        "project_id": cycle_input.project_id,
        "cycle_detection_summary": {
            "cycles_found": len(cycle_analysis),
            "total_tasks_in_cycles": sum(c["cycle_length"] for c in cycle_analysis),
            "high_severity_cycles": len([c for c in cycle_analysis if c["impact_severity"] == "high"]),
            "resolution_priority": "high" if any(c["impact_severity"] == "high" for c in cycle_analysis) else "medium"
        },
        "cycles": cycle_analysis,
        "resolution_roadmap": cycle_detection_results.resolution_roadmap,
        "analysis_parameters": {
            "max_cycle_length": cycle_input.max_cycle_length,
            "included_soft_dependencies": cycle_input.include_soft_dependencies,
            "detection_algorithm": "strongly_connected_components"
        }
    }
```

### 3. get_task_impact_analysis

```python
class ImpactAnalysisInput(BaseModel):
    """Input for task impact analysis."""
    task_id: str = Field(..., description="Task ID to analyze impact for")
    impact_type: str = Field("completion", description="Impact type: completion, delay, blocking, deletion")
    time_horizon_days: int = Field(30, description="Time horizon for impact analysis")
    include_resource_impact: bool = Field(True, description="Include resource allocation impact")

@mcp.tool()
async def get_task_impact_analysis(impact_input: ImpactAnalysisInput) -> Dict[str, Any]:
    """Analyze the comprehensive impact of task changes on related tasks."""
    
    task_manager, _ = get_managers()
    
    # Get base task information
    base_task = await task_manager.get_task(impact_input.task_id)
    if not base_task:
        return {"error": f"Task {impact_input.task_id} not found"}
    
    # Perform impact analysis based on type
    if impact_input.impact_type == "completion":
        impact_analysis = await task_manager.triple_db_service.analyze_completion_impact(
            impact_input.task_id, impact_input.time_horizon_days
        )
    elif impact_input.impact_type == "delay":
        impact_analysis = await task_manager.triple_db_service.analyze_delay_impact(
            impact_input.task_id, impact_input.time_horizon_days
        )
    elif impact_input.impact_type == "blocking":
        impact_analysis = await task_manager.triple_db_service.analyze_blocking_impact(
            impact_input.task_id
        )
    else:  # deletion
        impact_analysis = await task_manager.triple_db_service.analyze_deletion_impact(
            impact_input.task_id
        )
    
    # Resource impact analysis
    resource_impact = None
    if impact_input.include_resource_impact:
        resource_impact = await task_manager.triple_db_service.analyze_resource_impact(
            impact_input.task_id, impact_input.impact_type
        )
    
    return {
        "task": {
            "id": base_task.id,
            "title": base_task.title,
            "status": base_task.status.value,
            "priority": base_task.priority.value
        },
        "impact_analysis": {
            "impact_type": impact_input.impact_type,
            "direct_impact": impact_analysis.direct_impact,
            "indirect_impact": impact_analysis.indirect_impact,
            "cascade_effects": impact_analysis.cascade_effects,
            "timeline_impact": impact_analysis.timeline_impact
        },
        "affected_tasks": impact_analysis.affected_tasks,
        "resource_impact": resource_impact,
        "recommendations": {
            "immediate_actions": impact_analysis.immediate_actions,
            "mitigation_strategies": impact_analysis.mitigation_strategies,
            "alternative_approaches": impact_analysis.alternatives
        },
        "analysis_confidence": {
            "confidence_score": impact_analysis.confidence_score,
            "data_quality": impact_analysis.data_quality,
            "assumptions": impact_analysis.assumptions
        }
    }
```

## New Hybrid Intelligence Tools

### 1. intelligent_task_recommendation

```python
class RecommendationInput(BaseModel):
    """Input for intelligent task recommendations."""
    user_context: str = Field(..., description="Current user context or goal")
    current_task_id: Optional[str] = Field(None, description="Currently active task")
    project_focus: Optional[str] = Field(None, description="Focus on specific project")
    skill_level: str = Field("intermediate", description="User skill level: beginner, intermediate, advanced")
    time_available: Optional[int] = Field(None, description="Available time in minutes")
    preferred_task_types: Optional[List[str]] = Field(None, description="Preferred task types")

@mcp.tool()
async def intelligent_task_recommendation(rec_input: RecommendationInput) -> Dict[str, Any]:
    """Generate intelligent task recommendations using multi-database analysis."""
    
    task_manager, role_manager = get_managers()
    
    # Semantic analysis of user context
    semantic_matches = await task_manager.triple_db_service.find_contextually_relevant_tasks(
        context=rec_input.user_context,
        project_focus=rec_input.project_focus,
        skill_level=rec_input.skill_level
    )
    
    # Graph analysis for workflow optimization
    workflow_analysis = None
    if rec_input.current_task_id:
        workflow_analysis = await task_manager.triple_db_service.analyze_workflow_continuation(
            current_task_id=rec_input.current_task_id,
            available_time=rec_input.time_available
        )
    
    # Priority and dependency analysis from SQLite
    priority_analysis = await task_manager.get_prioritized_tasks(
        project_id=rec_input.project_focus,
        assignee="User",
        limit=20
    )
    
    # Combine all intelligence sources
    hybrid_recommendations = await task_manager.triple_db_service.generate_hybrid_recommendations(
        semantic_matches=semantic_matches,
        workflow_analysis=workflow_analysis,
        priority_analysis=priority_analysis,
        user_preferences={
            "skill_level": rec_input.skill_level,
            "time_available": rec_input.time_available,
            "preferred_types": rec_input.preferred_task_types
        }
    )
    
    return {
        "user_context": rec_input.user_context,
        "recommendations": [
            {
                "task": rec.task.to_dict(),
                "recommendation_score": rec.score,
                "reasoning": rec.reasoning,
                "estimated_time": rec.estimated_time,
                "prerequisite_status": rec.prerequisite_status,
                "learning_opportunity": rec.learning_opportunity,
                "urgency_factors": rec.urgency_factors
            }
            for rec in hybrid_recommendations
        ],
        "recommendation_strategy": {
            "semantic_weight": 0.4,
            "workflow_weight": 0.3,
            "priority_weight": 0.3,
            "personalization_factors": ["skill_level", "time_available", "preferences"]
        },
        "next_steps": {
            "immediate_action": hybrid_recommendations[0].task.title if hybrid_recommendations else None,
            "preparation_needed": hybrid_recommendations[0].preparation_needed if hybrid_recommendations else None,
            "alternative_options": len(hybrid_recommendations)
        }
    }
```

### 2. project_health_analysis

```python
class ProjectHealthInput(BaseModel):
    """Input for project health analysis."""
    project_id: str = Field(..., description="Project ID to analyze")
    include_predictions: bool = Field(True, description="Include predictive analysis")
    analysis_depth: str = Field("standard", description="Analysis depth: quick, standard, comprehensive")
    focus_areas: Optional[List[str]] = Field(None, description="Specific areas to focus on")

@mcp.tool()
async def project_health_analysis(health_input: ProjectHealthInput) -> Dict[str, Any]:
    """Comprehensive project health analysis using all three databases."""
    
    task_manager, _ = get_managers()
    
    # SQLite: Basic project metrics
    project_metrics = await task_manager.get_project_metrics(health_input.project_id)
    
    # Chroma: Semantic coherence analysis
    semantic_health = await task_manager.triple_db_service.analyze_project_semantic_health(
        health_input.project_id
    )
    
    # KuzuDB: Relationship and workflow analysis
    workflow_health = await task_manager.triple_db_service.analyze_project_workflow_health(
        health_input.project_id
    )
    
    # Predictive analysis
    predictions = None
    if health_input.include_predictions:
        predictions = await task_manager.triple_db_service.predict_project_outcomes(
            health_input.project_id
        )
    
    # Calculate overall health score
    health_score = await task_manager.triple_db_service.calculate_project_health_score(
        project_metrics, semantic_health, workflow_health
    )
    
    return {
        "project_id": health_input.project_id,
        "overall_health": {
            "score": health_score.overall_score,
            "grade": health_score.letter_grade,
            "trend": health_score.trend,
            "key_indicators": health_score.key_indicators
        },
        "detailed_analysis": {
            "task_management": {
                "total_tasks": project_metrics.total_tasks,
                "completion_rate": project_metrics.completion_rate,
                "overdue_tasks": project_metrics.overdue_tasks,
                "blocked_tasks": project_metrics.blocked_tasks,
                "average_task_age": project_metrics.average_task_age
            },
            "semantic_coherence": {
                "theme_consistency": semantic_health.theme_consistency,
                "requirement_clarity": semantic_health.requirement_clarity,
                "documentation_coverage": semantic_health.documentation_coverage,
                "semantic_drift": semantic_health.semantic_drift
            },
            "workflow_efficiency": {
                "dependency_health": workflow_health.dependency_health,
                "bottleneck_count": workflow_health.bottleneck_count,
                "parallel_work_opportunities": workflow_health.parallel_opportunities,
                "resource_utilization": workflow_health.resource_utilization,
                "cycle_time_average": workflow_health.cycle_time_average
            }
        },
        "risk_factors": {
            "high_risk": health_score.high_risk_factors,
            "medium_risk": health_score.medium_risk_factors,
            "mitigation_suggestions": health_score.mitigation_suggestions
        },
        "predictions": predictions,
        "action_recommendations": {
            "immediate": health_score.immediate_actions,
            "short_term": health_score.short_term_actions,
            "strategic": health_score.strategic_actions
        }
    }
```

## Database Management Tools

### 1. triple_db_health_check

```python
@mcp.tool()
async def triple_db_health_check() -> Dict[str, Any]:
    """Comprehensive health check across all three databases."""
    
    task_manager, _ = get_managers()
    
    # Check each database individually
    sqlite_health = await task_manager.triple_db_service.check_sqlite_health()
    chroma_health = await task_manager.triple_db_service.check_chroma_health()
    kuzu_health = await task_manager.triple_db_service.check_kuzu_health()
    
    # Check synchronization health
    sync_health = await task_manager.triple_db_service.check_sync_health()
    
    # Performance metrics
    performance_metrics = await task_manager.triple_db_service.get_performance_metrics()
    
    # Calculate overall system health
    overall_health = "healthy"
    if any(db["status"] != "healthy" for db in [sqlite_health, chroma_health, kuzu_health]):
        overall_health = "degraded"
    if sync_health["consistency_score"] < 0.95:
        overall_health = "needs_attention"
    
    return {
        "overall_status": overall_health,
        "databases": {
            "sqlite": sqlite_health,
            "chroma": chroma_health,
            "kuzu": kuzu_health
        },
        "synchronization": sync_health,
        "performance": performance_metrics,
        "recommendations": await task_manager.triple_db_service.generate_health_recommendations(
            sqlite_health, chroma_health, kuzu_health, sync_health
        ),
        "last_check": datetime.now().isoformat()
    }
```

### 2. sync_database_consistency

```python
class SyncInput(BaseModel):
    """Input for database synchronization."""
    force_full_sync: bool = Field(False, description="Force complete resync")
    target_databases: Optional[List[str]] = Field(None, description="Specific databases to sync")
    dry_run: bool = Field(False, description="Show what would be synced without making changes")
    max_tasks_per_batch: int = Field(100, description="Maximum tasks to sync per batch")

@mcp.tool()
async def sync_database_consistency(sync_input: SyncInput) -> Dict[str, Any]:
    """Synchronize data consistency across all databases."""
    
    task_manager, _ = get_managers()
    
    if sync_input.dry_run:
        # Show what would be synchronized
        sync_plan = await task_manager.triple_db_service.generate_sync_plan(
            force_full=sync_input.force_full_sync,
            target_databases=sync_input.target_databases
        )
        return {
            "dry_run": True,
            "sync_plan": sync_plan,
            "estimated_duration": sync_plan.estimated_duration,
            "tasks_to_sync": sync_plan.task_count
        }
    
    # Perform actual synchronization
    sync_results = await task_manager.triple_db_service.execute_synchronization(
        force_full=sync_input.force_full_sync,
        target_databases=sync_input.target_databases or ["chroma", "kuzu"],
        batch_size=sync_input.max_tasks_per_batch
    )
    
    return {
        "sync_completed": True,
        "results": {
            "tasks_synced": sync_results.tasks_synced,
            "embeddings_updated": sync_results.embeddings_updated,
            "graph_nodes_updated": sync_results.graph_nodes_updated,
            "relationships_synced": sync_results.relationships_synced
        },
        "duration": sync_results.duration_seconds,
        "errors": sync_results.errors,
        "consistency_score": sync_results.final_consistency_score
    }
```

## Tool Permission Matrix

### Role-Based Tool Access

| Tool Category | basic_helper | semantic_researcher | graph_analyst | data_architect | coordination_specialist |
|---------------|--------------|-------------------|---------------|----------------|----------------------|
| **Enhanced Existing** | | | | | |
| `create_task` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `get_task_dashboard` | ✅ (basic) | ✅ (+ semantic) | ✅ (+ graph) | ✅ (full) | ✅ (full) |
| **Semantic Search** | | | | | |
| `semantic_search_tasks` | ❌ | ✅ | ✅ (read-only) | ✅ | ✅ |
| `find_similar_tasks` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `semantic_task_clustering` | ❌ | ✅ | ❌ | ✅ | ✅ |
| **Graph Analysis** | | | | | |
| `analyze_task_dependencies_graph` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `find_dependency_cycles` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `get_task_impact_analysis` | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Hybrid Intelligence** | | | | | |
| `intelligent_task_recommendation` | ❌ | ✅ (limited) | ✅ (limited) | ✅ | ✅ |
| `project_health_analysis` | ❌ | ❌ | ✅ (limited) | ✅ | ✅ |
| **Database Management** | | | | | |
| `triple_db_health_check` | ✅ (read-only) | ✅ (read-only) | ✅ (read-only) | ✅ | ✅ |
| `sync_database_consistency` | ❌ | ❌ | ❌ | ✅ | ✅ (dry-run only) |

## Implementation Roadmap

### Phase 1: Enhanced Existing Tools
- [ ] Upgrade `create_task` with automatic embedding generation
- [ ] Enhance `get_task_dashboard` with semantic insights
- [ ] Update `update_task` with sync coordination
- [ ] Modify `delete_task` with cleanup across databases

### Phase 2: Semantic Search Tools
- [ ] Implement `semantic_search_tasks` with Chroma integration
- [ ] Create `find_similar_tasks` with advanced similarity scoring
- [ ] Develop `semantic_task_clustering` with ML-based grouping

### Phase 3: Graph Analysis Tools
- [ ] Build `analyze_task_dependencies_graph` with deep traversal
- [ ] Implement `find_dependency_cycles` with cycle detection algorithms
- [ ] Create `get_task_impact_analysis` with impact modeling

### Phase 4: Hybrid Intelligence Tools
- [ ] Develop `intelligent_task_recommendation` with multi-DB intelligence
- [ ] Implement `project_health_analysis` with comprehensive metrics

### Phase 5: Database Management Tools
- [ ] Create `triple_db_health_check` with monitoring capabilities
- [ ] Implement `sync_database_consistency` with batch processing

## Testing Strategy

### Unit Tests
- Individual tool input/output validation
- Database integration mocking
- Error handling verification

### Integration Tests
- Cross-database operation validation
- Synchronization consistency testing
- Performance benchmarking

### User Experience Tests
- Role permission validation
- Tool response time verification
- Result relevance scoring

This comprehensive MCP tool specification provides the blueprint for implementing enhanced task orchestration capabilities while maintaining the proven FastMCP architecture and role-based security model.