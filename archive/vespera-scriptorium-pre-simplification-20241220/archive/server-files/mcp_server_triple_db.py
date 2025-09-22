#!/usr/bin/env python3
"""
Vespera V2 Enhanced MCP Server with Triple Database Integration

FastMCP-based server with SQLite + Chroma + KuzuDB integration for
hierarchical task management, semantic search, and graph analysis.
"""

import sys
import logging
import asyncio
from pathlib import Path
from typing import Dict, List, Any, Optional, Union
from datetime import datetime
from contextlib import asynccontextmanager

# Add the package to path
sys.path.insert(0, str(Path(__file__).parent))

from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, Field

# Core components
from tasks import TaskManager, TaskStatus, TaskPriority, TaskRelation, TaskMetadata
from roles import RoleManager

# Triple database components
from databases import TripleDBService, DatabaseSyncCoordinator, MigrationManager
from databases.triple_db_service import DatabaseConfig, triple_db_lifespan
from databases.chroma_service import ChromaService, ChromaConfig, SemanticSearchResult
from databases.kuzu_service import KuzuService, KuzuConfig

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize the MCP server
mcp = FastMCP("vespera-v2-triple-db")

# Global services (initialized via context manager)
_triple_db_service: Optional[TripleDBService] = None
_chroma_service: Optional[ChromaService] = None
_kuzu_service: Optional[KuzuService] = None
_sync_coordinator: Optional[DatabaseSyncCoordinator] = None
_v2_data_dir: Optional[Path] = None


@asynccontextmanager
async def lifespan(server: FastMCP):
    """Manage triple database service lifecycle."""
    global _triple_db_service, _chroma_service, _kuzu_service, _sync_coordinator, _v2_data_dir
    
    # Initialize data directory
    project_root = Path.cwd()
    _v2_data_dir = project_root / ".vespera_v2"
    _v2_data_dir.mkdir(parents=True, exist_ok=True)
    
    logger.info(f"Initializing triple database system in {_v2_data_dir}")
    
    try:
        # Check if migration is needed
        migration_manager = MigrationManager(_v2_data_dir / "tasks.db")
        needs_migration = await migration_manager.needs_migration()
        
        if needs_migration:
            logger.info("Database migration required, performing migration...")
            migration_result = await migration_manager.migrate_to_triple_db()
            
            if migration_result.success:
                logger.info(f"Migration successful: {migration_result.tasks_migrated} tasks migrated")
            else:
                logger.error(f"Migration failed: {migration_result.errors}")
                raise Exception("Database migration failed")
        
        # Configure triple database service
        db_config = DatabaseConfig(
            data_dir=_v2_data_dir,
            sqlite_enabled=True,
            chroma_enabled=True,
            kuzu_enabled=True
        )
        
        # Initialize triple database service
        _triple_db_service = TripleDBService(db_config)
        await _triple_db_service.initialize()
        
        # Initialize specialized services
        chroma_config = ChromaConfig(persist_directory=_v2_data_dir / "embeddings")
        _chroma_service = ChromaService(chroma_config)
        await _chroma_service.initialize()
        
        kuzu_config = KuzuConfig(database_path=_v2_data_dir / "tasks.kuzu")
        _kuzu_service = KuzuService(kuzu_config)
        await _kuzu_service.initialize()
        
        # Initialize sync coordinator
        _sync_coordinator = DatabaseSyncCoordinator(_triple_db_service.task_service)
        _sync_coordinator.set_external_clients(
            _triple_db_service.chroma_client,
            _triple_db_service.kuzu_database
        )
        await _sync_coordinator.start()
        
        logger.info("Triple database system initialized successfully")
        
        yield
        
    except Exception as e:
        logger.error(f"Failed to initialize triple database system: {e}")
        raise
    finally:
        # Cleanup
        try:
            if _sync_coordinator:
                await _sync_coordinator.stop()
            if _triple_db_service:
                await _triple_db_service.cleanup()
            if _chroma_service:
                await _chroma_service.cleanup()
            if _kuzu_service:
                await _kuzu_service.cleanup()
            
            logger.info("Triple database system cleaned up")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")


# Apply lifespan to server
mcp.dependencies.append(lifespan)


def get_services():
    """Get initialized services."""
    if not _triple_db_service:
        raise RuntimeError("Services not initialized")
    return _triple_db_service, _chroma_service, _kuzu_service, _sync_coordinator


# Enhanced Pydantic models
class TaskCreateInput(BaseModel):
    """Input model for task creation."""
    title: str = Field(..., description="Task title")
    description: str = Field("", description="Task description")
    parent_id: Optional[str] = Field(None, description="Parent task ID")
    project_id: Optional[str] = Field(None, description="Project identifier")
    feature: Optional[str] = Field(None, description="Feature area")
    role: Optional[str] = Field(None, description="Assigned role")
    priority: Optional[str] = Field("normal", description="Task priority")


class SemanticSearchInput(BaseModel):
    """Input model for semantic search."""
    query: str = Field(..., description="Search query")
    n_results: int = Field(10, description="Maximum number of results")
    min_similarity: float = Field(0.0, description="Minimum similarity score (0-1)")
    project_filter: Optional[str] = Field(None, description="Filter by project ID")
    status_filter: Optional[str] = Field(None, description="Filter by status")
    priority_filter: Optional[str] = Field(None, description="Filter by priority")


class GraphAnalysisInput(BaseModel):
    """Input model for graph analysis."""
    task_id: str = Field(..., description="Task ID to analyze")
    max_depth: int = Field(5, description="Maximum analysis depth")


# Core task management tools (enhanced with triple-DB)
@mcp.tool()
async def create_task(task_input: TaskCreateInput) -> Dict[str, Any]:
    """Create a new task with automatic background processing.
    
    The task will be automatically processed by background services for:
    - Embedding generation (if enabled)
    - Graph synchronization (if enabled)
    - Dependency cycle detection (if dependencies exist)
    """
    triple_db_service, chroma_service, kuzu_service, sync_coordinator = get_services()
    
    try:
        # Convert priority string to enum
        priority = TaskPriority.NORMAL
        if task_input.priority:
            priority = TaskPriority(task_input.priority.lower())
        
        # Create task in triple database service
        # Background services will automatically handle embedding and sync
        success, result = await triple_db_service.create_task(
            title=task_input.title,
            description=task_input.description,
            parent_id=task_input.parent_id,
            priority=priority,
            project_id=task_input.project_id,
            feature=task_input.feature,
            role_name=task_input.role
        )
        
        if success:
            task_dict = result["task"]
            logger.info(f"Created task with automatic background processing: {task_dict['id']}")
            
            message = "Task created successfully. Background services will handle embedding and synchronization."
            
            # Check if background services are available
            if triple_db_service.background_service_manager:
                message += " Background services are active."
            else:
                message += " Background services not available - manual sync may be required."
        
        return {
            "success": success,
            "task": result.get("task") if success else None,
            "message": message if success else result.get("error", "Failed to create task")
        }
        
    except Exception as e:
        logger.exception("Error creating task")
        return {"success": False, "error": str(e)}


@mcp.tool()
async def semantic_search_tasks(search_input: SemanticSearchInput) -> Dict[str, Any]:
    """Search tasks using semantic similarity."""
    triple_db_service, chroma_service, kuzu_service, sync_coordinator = get_services()
    
    try:
        # Build metadata filters
        filters = {}
        
        if search_input.project_filter:
            filters["project_id"] = {"$eq": search_input.project_filter}
        
        if search_input.status_filter:
            if "status" not in filters:
                filters["status"] = {"$eq": search_input.status_filter.lower()}
        
        if search_input.priority_filter:
            if "priority" not in filters:
                filters["priority"] = {"$eq": search_input.priority_filter.lower()}
        
        # Combine filters with AND logic if multiple
        if len(filters) > 1:
            filters = {"$and": [f for f in filters.values()]}
        elif len(filters) == 1:
            filters = list(filters.values())[0]
        else:
            filters = None
        
        # Perform semantic search
        results = await chroma_service.semantic_search(
            query=search_input.query,
            n_results=search_input.n_results,
            filters=filters,
            min_similarity=search_input.min_similarity
        )
        
        # Enrich with full task data
        enriched_results = []
        for result in results:
            task = await triple_db_service.get_task(result.task_id)
            if task:
                enriched_results.append({
                    "task_id": result.task_id,
                    "title": result.title,
                    "similarity_score": result.similarity_score,
                    "task_data": task.to_dict(),
                    "match_content": result.content[:200] + "..." if len(result.content) > 200 else result.content
                })
        
        return {
            "success": True,
            "query": search_input.query,
            "results_count": len(enriched_results),
            "results": enriched_results,
            "message": f"Found {len(enriched_results)} semantically similar tasks"
        }
        
    except Exception as e:
        logger.exception("Error in semantic search")
        return {"success": False, "error": str(e)}


@mcp.tool()
async def find_similar_tasks(task_id: str, n_results: int = 5, min_similarity: float = 0.5) -> Dict[str, Any]:
    """Find tasks similar to a given task."""
    triple_db_service, chroma_service, kuzu_service, sync_coordinator = get_services()
    
    try:
        # Get the reference task
        reference_task = await triple_db_service.get_task(task_id)
        if not reference_task:
            return {"success": False, "error": f"Task {task_id} not found"}
        
        # Find similar tasks
        similar_results = await chroma_service.find_similar_tasks(
            task_id=task_id,
            n_results=n_results,
            min_similarity=min_similarity
        )
        
        # Enrich with full task data
        enriched_results = []
        for result in similar_results:
            task = await triple_db_service.get_task(result.task_id)
            if task:
                enriched_results.append({
                    "task_id": result.task_id,
                    "title": result.title,
                    "similarity_score": result.similarity_score,
                    "task_data": task.to_dict()
                })
        
        return {
            "success": True,
            "reference_task_id": task_id,
            "reference_title": reference_task.title,
            "similar_tasks_count": len(enriched_results),
            "similar_tasks": enriched_results,
            "message": f"Found {len(enriched_results)} similar tasks"
        }
        
    except Exception as e:
        logger.exception("Error finding similar tasks")
        return {"success": False, "error": str(e)}


@mcp.tool()
async def analyze_task_dependencies_graph(analysis_input: GraphAnalysisInput) -> Dict[str, Any]:
    """Analyze task dependencies using graph database."""
    triple_db_service, chroma_service, kuzu_service, sync_coordinator = get_services()
    
    try:
        # Get the task
        task = await triple_db_service.get_task(analysis_input.task_id)
        if not task:
            return {"success": False, "error": f"Task {analysis_input.task_id} not found"}
        
        # Perform graph analysis
        dependency_analysis = await kuzu_service.analyze_dependencies(
            task_id=analysis_input.task_id,
            max_depth=analysis_input.max_depth
        )
        
        if "error" in dependency_analysis:
            return {"success": False, "error": dependency_analysis["error"]}
        
        return {
            "success": True,
            "task_id": analysis_input.task_id,
            "task_title": task.title,
            "analysis": dependency_analysis,
            "message": f"Analyzed dependencies for task {task.title}"
        }
        
    except Exception as e:
        logger.exception("Error analyzing task dependencies")
        return {"success": False, "error": str(e)}


@mcp.tool()
async def detect_dependency_cycles() -> Dict[str, Any]:
    """Manually trigger dependency cycle detection.
    
    Note: Cycle detection now runs automatically when dependencies are added.
    Use this tool for manual audits or when automatic detection is disabled.
    """
    triple_db_service, chroma_service, kuzu_service, sync_coordinator = get_services()
    
    try:
        # Try background service first
        if triple_db_service.background_service_manager:
            from .service_config import ServiceType, ServicePriority
            
            operation_id = await triple_db_service.background_service_manager.schedule_operation(
                ServiceType.CYCLE_DETECTION,
                "full_cycle_check",
                "manual_audit",
                {"triggered_by": "user", "timestamp": datetime.now().isoformat()},
                ServicePriority.HIGH
            )
            
            return {
                "success": True,
                "operation_id": operation_id,
                "message": "Dependency cycle detection scheduled via background services",
                "method": "background_service"
            }
        
        # Fallback to direct KuzuDB query
        cycles = await kuzu_service.detect_circular_dependencies()
        
        return {
            "success": True,
            "cycles_found": len(cycles),
            "cycles": cycles,
            "message": f"Found {len(cycles)} circular dependencies" if cycles else "No circular dependencies detected",
            "method": "direct_query"
        }
        
    except Exception as e:
        logger.exception("Error detecting dependency cycles")
        return {"success": False, "error": str(e)}


@mcp.tool()
async def find_blocking_bottlenecks() -> Dict[str, Any]:
    """Find tasks that are blocking multiple other tasks."""
    triple_db_service, chroma_service, kuzu_service, sync_coordinator = get_services()
    
    try:
        bottlenecks = await kuzu_service.find_blocking_bottlenecks()
        
        return {
            "success": True,
            "bottlenecks_found": len(bottlenecks),
            "bottlenecks": bottlenecks,
            "message": f"Found {len(bottlenecks)} blocking bottlenecks" if bottlenecks else "No blocking bottlenecks detected"
        }
        
    except Exception as e:
        logger.exception("Error finding blocking bottlenecks")
        return {"success": False, "error": str(e)}


@mcp.tool()
async def get_project_hierarchy(project_id: str) -> Dict[str, Any]:
    """Get hierarchical structure of tasks in a project."""
    triple_db_service, chroma_service, kuzu_service, sync_coordinator = get_services()
    
    try:
        hierarchy = await kuzu_service.get_project_hierarchy(project_id)
        
        if "error" in hierarchy:
            return {"success": False, "error": hierarchy["error"]}
        
        return {
            "success": True,
            "project_id": project_id,
            "hierarchy": hierarchy,
            "message": f"Retrieved hierarchy for project {project_id}"
        }
        
    except Exception as e:
        logger.exception("Error getting project hierarchy")
        return {"success": False, "error": str(e)}


@mcp.tool()
async def get_role_workload_analysis() -> Dict[str, Any]:
    """Analyze workload distribution across roles."""
    triple_db_service, chroma_service, kuzu_service, sync_coordinator = get_services()
    
    try:
        workload_analysis = await kuzu_service.get_role_workload_analysis()
        
        return {
            "success": True,
            "analysis": workload_analysis,
            "roles_analyzed": len(workload_analysis),
            "message": f"Analyzed workload for {len(workload_analysis)} roles"
        }
        
    except Exception as e:
        logger.exception("Error analyzing role workload")
        return {"success": False, "error": str(e)}


@mcp.tool()
async def intelligent_task_recommendation(
    user_context: str,
    current_task_id: Optional[str] = None,
    n_recommendations: int = 5
) -> Dict[str, Any]:
    """Recommend next tasks using hybrid semantic + graph analysis."""
    triple_db_service, chroma_service, kuzu_service, sync_coordinator = get_services()
    
    try:
        recommendations = []
        
        # 1. Semantic search for relevant tasks
        semantic_results = await chroma_service.semantic_search(
            query=user_context,
            n_results=10,
            filters={"status": {"$in": ["todo", "doing"]}},
            min_similarity=0.3
        )
        
        # 2. If current task provided, find related and dependent tasks
        related_tasks = []
        if current_task_id:
            # Find similar tasks
            similar_tasks = await chroma_service.find_similar_tasks(
                task_id=current_task_id,
                n_results=5,
                min_similarity=0.4
            )
            related_tasks.extend([t.task_id for t in similar_tasks])
            
            # Find dependency-related tasks
            dependency_analysis = await kuzu_service.analyze_dependencies(current_task_id)
            if "dependencies" in dependency_analysis:
                for dep in dependency_analysis["dependencies"]:
                    if dep["status"] in ["todo", "doing"] and dep["task_id"] not in related_tasks:
                        related_tasks.append(dep["task_id"])
        
        # 3. Combine and score recommendations
        recommendation_scores = {}
        
        # Score semantic matches
        for result in semantic_results:
            score = result.similarity_score * 0.7  # Weight semantic similarity
            recommendation_scores[result.task_id] = {
                "task_id": result.task_id,
                "score": score,
                "reasons": [f"Semantic match (similarity: {result.similarity_score:.2f})"]
            }
        
        # Boost scores for related tasks
        for task_id in related_tasks:
            if task_id in recommendation_scores:
                recommendation_scores[task_id]["score"] += 0.3
                recommendation_scores[task_id]["reasons"].append("Related to current task")
            else:
                recommendation_scores[task_id] = {
                    "task_id": task_id,
                    "score": 0.5,
                    "reasons": ["Related to current task"]
                }
        
        # 4. Get top recommendations with full task data
        sorted_recommendations = sorted(
            recommendation_scores.values(),
            key=lambda x: x["score"],
            reverse=True
        )[:n_recommendations]
        
        for rec in sorted_recommendations:
            task = await triple_db_service.get_task(rec["task_id"])
            if task:
                recommendations.append({
                    "task_id": rec["task_id"],
                    "title": task.title,
                    "priority": task.priority.value,
                    "status": task.status.value,
                    "score": rec["score"],
                    "reasons": rec["reasons"],
                    "task_data": task.to_dict()
                })
        
        return {
            "success": True,
            "user_context": user_context,
            "current_task_id": current_task_id,
            "recommendations_count": len(recommendations),
            "recommendations": recommendations,
            "message": f"Generated {len(recommendations)} intelligent task recommendations"
        }
        
    except Exception as e:
        logger.exception("Error generating task recommendations")
        return {"success": False, "error": str(e)}


# System management and monitoring tools
@mcp.tool()
async def triple_db_health_check() -> Dict[str, Any]:
    """Comprehensive health check of all databases."""
    try:
        if not _triple_db_service:
            return {"success": False, "error": "Triple database service not initialized"}
        
        health = await _triple_db_service.health_check()
        
        # Add sync statistics
        if _sync_coordinator:
            sync_stats = await _sync_coordinator.get_sync_statistics()
            health["sync_statistics"] = sync_stats
        
        # Add database-specific statistics
        if _chroma_service:
            chroma_stats = await _chroma_service.get_collection_stats()
            health["chroma_statistics"] = chroma_stats
        
        if _kuzu_service:
            kuzu_stats = await _kuzu_service.get_graph_statistics()
            health["kuzu_statistics"] = kuzu_stats
        
        return {
            "success": True,
            "health_check": health,
            "message": f"System status: {health.get('overall_status', 'unknown')}"
        }
        
    except Exception as e:
        logger.exception("Error in health check")
        return {"success": False, "error": str(e)}


@mcp.tool()
async def force_full_resync() -> Dict[str, Any]:
    """Force full resynchronization of all tasks across databases.
    
    Note: This operation is now primarily handled by background services.
    Use get_background_service_status() to monitor automatic sync operations.
    """
    try:
        # Try background service first
        triple_db_service = get_services()[0]
        
        if triple_db_service.background_service_manager:
            # Schedule high-priority full sync via background services
            from .service_config import ServiceType, ServicePriority
            
            operation_id = await triple_db_service.background_service_manager.schedule_operation(
                ServiceType.INCREMENTAL_SYNC,
                "full_resync",
                "all_tasks",
                {"triggered_by": "user", "force": True},
                ServicePriority.HIGH
            )
            
            return {
                "success": True,
                "operation_id": operation_id,
                "message": "Full resync scheduled via background services",
                "method": "background_service"
            }
        
        # Fallback to legacy sync coordinator
        if not _sync_coordinator:
            return {"success": False, "error": "Neither background services nor sync coordinator available"}
        
        result = await _sync_coordinator.force_full_resync()
        result["method"] = "legacy_sync_coordinator"
        return result
        
    except Exception as e:
        logger.exception("Error in full resync")
        return {"success": False, "error": str(e)}


# Background service management tools
@mcp.tool()
async def get_background_service_status() -> Dict[str, Any]:
    """Get status and metrics for all background services."""
    triple_db_service = get_services()[0]
    
    try:
        status = await triple_db_service.get_background_service_status()
        return {
            "success": True,
            "background_services": status
        }
        
    except Exception as e:
        logger.exception("Error getting background service status")
        return {"success": False, "error": str(e)}


@mcp.tool()
async def configure_background_service(
    service_type: str,
    enabled: bool
) -> Dict[str, Any]:
    """Enable or disable a specific background service.
    
    Args:
        service_type: One of 'auto_embedding', 'cycle_detection', 'incremental_sync', 'index_optimization'
        enabled: True to enable, False to disable
    """
    triple_db_service = get_services()[0]
    
    try:
        from .service_config import ServiceType
        
        # Convert string to ServiceType enum
        service_type_map = {
            "auto_embedding": ServiceType.AUTO_EMBEDDING,
            "cycle_detection": ServiceType.CYCLE_DETECTION,
            "incremental_sync": ServiceType.INCREMENTAL_SYNC,
            "index_optimization": ServiceType.INDEX_OPTIMIZATION
        }
        
        if service_type not in service_type_map:
            return {
                "success": False,
                "error": f"Invalid service type. Must be one of: {list(service_type_map.keys())}"
            }
        
        service_enum = service_type_map[service_type]
        result = await triple_db_service.configure_background_service(service_enum, enabled)
        
        return result
        
    except Exception as e:
        logger.exception("Error configuring background service")
        return {"success": False, "error": str(e)}


@mcp.tool()
async def trigger_index_optimization() -> Dict[str, Any]:
    """Manually trigger database index optimization.
    
    This operation normally runs automatically based on configuration,
    but can be triggered manually for maintenance purposes.
    """
    triple_db_service = get_services()[0]
    
    try:
        result = await triple_db_service.trigger_index_optimization()
        return result
        
    except Exception as e:
        logger.exception("Error triggering index optimization")
        return {"success": False, "error": str(e)}


@mcp.tool()
async def force_task_embedding(task_id: str) -> Dict[str, Any]:
    """Manually force embedding generation for a specific task.
    
    Args:
        task_id: ID of the task to embed
    """
    triple_db_service = get_services()[0]
    
    try:
        if not triple_db_service.background_service_manager:
            return {"success": False, "error": "Background services not available"}
        
        from .service_config import ServiceType, ServicePriority
        
        operation_id = await triple_db_service.background_service_manager.schedule_operation(
            ServiceType.AUTO_EMBEDDING,
            "embed_task",
            task_id,
            {"triggered_by": "user", "force": True},
            ServicePriority.HIGH
        )
        
        return {
            "success": True,
            "operation_id": operation_id,
            "task_id": task_id,
            "message": f"Embedding generation scheduled for task {task_id}"
        }
        
    except Exception as e:
        logger.exception("Error forcing task embedding")
        return {"success": False, "error": str(e)}


# High-value MCP tools for comprehensive project insights

# Pydantic models for the new tools
class ClusteringInput(BaseModel):
    """Input model for semantic task clustering."""
    project_id: Optional[str] = Field(None, description="Project to cluster (all projects if None)")
    num_clusters: int = Field(5, ge=2, le=20, description="Number of clusters to create")
    similarity_threshold: float = Field(0.7, ge=0.1, le=1.0, description="Minimum similarity threshold")
    include_completed: bool = Field(True, description="Include completed tasks in clustering")
    min_cluster_size: int = Field(2, ge=2, le=10, description="Minimum tasks per cluster")


class ImpactAnalysisInput(BaseModel):
    """Input model for task impact analysis."""
    task_id: str = Field(..., description="Task ID to analyze")
    change_type: str = Field(..., pattern="^(complete|delay|delete|update)$", description="Type of change to analyze")
    delay_days: Optional[int] = Field(None, ge=1, le=365, description="Days of delay (for delay analysis)")
    include_dependencies: bool = Field(True, description="Include dependency analysis")
    include_resource_impact: bool = Field(True, description="Include resource allocation impact")


class ProjectHealthInput(BaseModel):
    """Input model for project health analysis."""
    project_id: Optional[str] = Field(None, description="Project to analyze (all projects if None)")
    analysis_depth: str = Field("standard", pattern="^(basic|standard|comprehensive)$", description="Analysis depth")
    include_predictions: bool = Field(False, description="Include predictive analytics")
    focus_areas: Optional[List[str]] = Field(None, description="Specific areas to focus on")


@mcp.tool()
async def semantic_task_clustering(clustering_input: ClusteringInput) -> Dict[str, Any]:
    """Group related tasks using ML-based semantic clustering for project organization insights."""
    triple_db_service, chroma_service, kuzu_service, sync_coordinator = get_services()
    
    try:
        # Get tasks for clustering
        filters = {}
        if clustering_input.project_id:
            filters["project_id"] = {"$eq": clustering_input.project_id}
        if not clustering_input.include_completed:
            filters["status"] = {"$nin": ["done", "completed"]}
            
        # Combine filters with AND logic if multiple
        if len(filters) > 1:
            final_filters = {"$and": list(filters.values())}
        elif len(filters) == 1:
            final_filters = list(filters.values())[0]
        else:
            final_filters = None
        
        # Get all task embeddings from Chroma
        all_embeddings = await chroma_service.get_all_embeddings(
            filters=final_filters,
            min_tasks=clustering_input.num_clusters * clustering_input.min_cluster_size
        )
        
        if len(all_embeddings) < clustering_input.min_cluster_size:
            return {
                "success": False,
                "error": f"Insufficient tasks for clustering. Found {len(all_embeddings)}, need at least {clustering_input.min_cluster_size}"
            }
        
        # Perform clustering using available embeddings
        import numpy as np
        
        # Extract embeddings and task IDs
        embeddings_array = np.array([emb["embedding"] for emb in all_embeddings])
        task_ids = [emb["task_id"] for emb in all_embeddings]
        
        # Simple k-means clustering implementation
        from random import sample
        
        # Initialize cluster centers randomly
        n_clusters = min(clustering_input.num_clusters, len(all_embeddings) // clustering_input.min_cluster_size)
        if n_clusters < 2:
            n_clusters = 2
            
        # Random initialization of centroids
        centroid_indices = sample(range(len(embeddings_array)), n_clusters)
        centroids = embeddings_array[centroid_indices]
        
        # K-means iterations
        max_iterations = 20
        clusters = [[] for _ in range(n_clusters)]
        
        for iteration in range(max_iterations):
            # Clear previous clusters
            clusters = [[] for _ in range(n_clusters)]
            
            # Assign each point to nearest centroid
            for i, embedding in enumerate(embeddings_array):
                distances = [np.linalg.norm(embedding - centroid) for centroid in centroids]
                closest_cluster = distances.index(min(distances))
                
                # Check similarity threshold
                similarity = 1 - (min(distances) / 2)  # Convert distance to similarity
                if similarity >= clustering_input.similarity_threshold:
                    clusters[closest_cluster].append(i)
            
            # Update centroids
            new_centroids = []
            for cluster_indices in clusters:
                if cluster_indices:
                    cluster_embeddings = embeddings_array[cluster_indices]
                    new_centroid = np.mean(cluster_embeddings, axis=0)
                    new_centroids.append(new_centroid)
                else:
                    # Keep old centroid if cluster is empty
                    new_centroids.append(centroids[len(new_centroids)])
            
            centroids = np.array(new_centroids)
        
        # Filter out clusters that are too small
        valid_clusters = []
        unclustered_tasks = []
        
        for cluster_idx, cluster_indices in enumerate(clusters):
            if len(cluster_indices) >= clustering_input.min_cluster_size:
                cluster_tasks = []
                for task_idx in cluster_indices:
                    task_id = task_ids[task_idx]
                    task = await triple_db_service.get_task(task_id)
                    if task:
                        cluster_tasks.append(task)
                
                # Generate cluster theme using task titles
                cluster_titles = [task.title for task in cluster_tasks]
                common_words = []
                for title in cluster_titles:
                    words = [word.lower() for word in title.split() if len(word) > 3]
                    common_words.extend(words)
                
                # Find most common words
                from collections import Counter
                word_counts = Counter(common_words)
                top_words = [word for word, count in word_counts.most_common(3)]
                theme = " + ".join(top_words) if top_words else f"Cluster {cluster_idx + 1}"
                
                # Calculate cluster coherence
                cluster_embeddings = embeddings_array[cluster_indices]
                if len(cluster_embeddings) > 1:
                    # Calculate average pairwise similarity
                    similarities = []
                    for i in range(len(cluster_embeddings)):
                        for j in range(i + 1, len(cluster_embeddings)):
                            sim = 1 - np.linalg.norm(cluster_embeddings[i] - cluster_embeddings[j]) / 2
                            similarities.append(sim)
                    coherence_score = np.mean(similarities) if similarities else 0.0
                else:
                    coherence_score = 1.0
                
                valid_clusters.append({
                    "cluster_id": f"cluster_{cluster_idx + 1}",
                    "theme": theme,
                    "coherence_score": float(coherence_score),
                    "task_count": len(cluster_tasks),
                    "tasks": [task.to_dict() for task in cluster_tasks],
                    "keywords": top_words,
                    "recommended_actions": [
                        f"Focus on {theme} theme completion",
                        "Consider parallel execution within cluster",
                        "Review cluster coherence and dependencies"
                    ]
                })
            else:
                # Tasks that don't fit in any cluster
                for task_idx in cluster_indices:
                    task_id = task_ids[task_idx]
                    task = await triple_db_service.get_task(task_id)
                    if task:
                        unclustered_tasks.append(task.to_dict())
        
        return {
            "success": True,
            "project_id": clustering_input.project_id,
            "clustering_summary": {
                "total_tasks_analyzed": len(all_embeddings),
                "clusters_found": len(valid_clusters),
                "unclustered_tasks": len(unclustered_tasks),
                "average_cluster_size": sum(c["task_count"] for c in valid_clusters) / len(valid_clusters) if valid_clusters else 0,
                "overall_coherence": sum(c["coherence_score"] for c in valid_clusters) / len(valid_clusters) if valid_clusters else 0
            },
            "clusters": valid_clusters,
            "unclustered_tasks": unclustered_tasks,
            "clustering_parameters": {
                "num_clusters": n_clusters,
                "similarity_threshold": clustering_input.similarity_threshold,
                "min_cluster_size": clustering_input.min_cluster_size,
                "algorithm": "k_means_semantic"
            },
            "insights": {
                "organization_opportunities": len(valid_clusters),
                "theme_diversity": len(set(c["theme"] for c in valid_clusters)),
                "clustering_quality": "good" if len(valid_clusters) > 0 else "poor"
            },
            "message": f"Successfully clustered {len(all_embeddings)} tasks into {len(valid_clusters)} thematic groups"
        }
        
    except Exception as e:
        logger.exception("Error in semantic task clustering")
        return {"success": False, "error": str(e)}


@mcp.tool()
async def get_task_impact_analysis(impact_input: ImpactAnalysisInput) -> Dict[str, Any]:
    """Analyze comprehensive impact of task changes using graph analysis and dependency mapping."""
    triple_db_service, chroma_service, kuzu_service, sync_coordinator = get_services()
    
    try:
        # Get the target task
        target_task = await triple_db_service.get_task(impact_input.task_id)
        if not target_task:
            return {"success": False, "error": f"Task {impact_input.task_id} not found"}
        
        # Get dependency analysis from graph database
        dependency_analysis = await kuzu_service.analyze_dependencies(
            task_id=impact_input.task_id,
            max_depth=5
        )
        
        if "error" in dependency_analysis:
            return {"success": False, "error": dependency_analysis["error"]}
        
        # Extract affected tasks from dependency analysis
        affected_tasks = []
        direct_impact = {"blocked_tasks": 0, "dependent_tasks": 0, "related_tasks": 0}
        indirect_impact = {"cascade_depth": 0, "total_affected": 0}
        
        # Count direct dependencies and dependents
        if "dependencies" in dependency_analysis:
            for dep in dependency_analysis["dependencies"]:
                if dep.get("relationship_type") == "blocks":
                    direct_impact["blocked_tasks"] += 1
                elif dep.get("relationship_type") == "depends_on":
                    direct_impact["dependent_tasks"] += 1
                else:
                    direct_impact["related_tasks"] += 1
                
                affected_tasks.append({
                    "task_id": dep["task_id"],
                    "title": dep.get("title", "Unknown"),
                    "relationship": dep.get("relationship_type", "unknown"),
                    "status": dep.get("status", "unknown"),
                    "impact_level": "direct"
                })
        
        # Calculate cascade effects
        cascade_effects = []
        if impact_input.change_type == "complete":
            # Completion unblocks dependent tasks
            cascade_effects.append({
                "effect_type": "unblock_dependents",
                "affected_count": direct_impact["blocked_tasks"],
                "description": f"Completing this task would unblock {direct_impact['blocked_tasks']} dependent tasks"
            })
        elif impact_input.change_type == "delay":
            # Delay affects all dependent tasks
            delay_days = impact_input.delay_days or 7
            cascade_effects.append({
                "effect_type": "delay_cascade",
                "affected_count": direct_impact["blocked_tasks"],
                "delay_magnitude": delay_days,
                "description": f"Delaying this task by {delay_days} days would delay {direct_impact['blocked_tasks']} dependent tasks"
            })
        elif impact_input.change_type == "delete":
            # Deletion creates orphaned tasks
            cascade_effects.append({
                "effect_type": "orphan_creation",
                "affected_count": direct_impact["blocked_tasks"],
                "description": f"Deleting this task would orphan {direct_impact['blocked_tasks']} dependent tasks"
            })
        
        # Calculate indirect impact using graph traversal depth
        max_depth = max((dep.get("depth", 0) for dep in dependency_analysis.get("dependencies", [])), default=0)
        indirect_impact["cascade_depth"] = max_depth
        indirect_impact["total_affected"] = len(affected_tasks)
        
        # Timeline impact analysis
        timeline_impact = {
            "immediate": direct_impact["blocked_tasks"],
            "short_term": max(0, indirect_impact["total_affected"] - direct_impact["blocked_tasks"]),
            "estimated_duration_impact": (impact_input.delay_days or 0) if impact_input.change_type == "delay" else 0
        }
        
        # Resource impact analysis (if requested)
        resource_impact = None
        if impact_input.include_resource_impact:
            # Get role assignments and workload
            role_analysis = await kuzu_service.get_role_workload_analysis()
            
            task_role = target_task.role if hasattr(target_task, 'role') and target_task.role else "unassigned"
            role_workload = next((r for r in role_analysis if r.get("role") == task_role), None)
            
            resource_impact = {
                "assigned_role": task_role,
                "role_current_workload": role_workload.get("task_count", 0) if role_workload else 0,
                "resource_availability_impact": "high" if role_workload and role_workload.get("task_count", 0) > 10 else "medium",
                "reallocation_needed": impact_input.change_type in ["delete", "delay"]
            }
        
        # Generate recommendations based on impact analysis
        immediate_actions = []
        mitigation_strategies = []
        alternatives = []
        
        if impact_input.change_type == "complete":
            immediate_actions.append("Prioritize completion to unblock dependent tasks")
            if direct_impact["blocked_tasks"] > 3:
                immediate_actions.append("Coordinate with teams working on dependent tasks")
        elif impact_input.change_type == "delay":
            mitigation_strategies.append("Communicate delay to affected task owners")
            mitigation_strategies.append("Identify parallel work opportunities in dependent tasks")
            if impact_input.delay_days and impact_input.delay_days > 7:
                alternatives.append("Consider task decomposition to deliver partial value")
        elif impact_input.change_type == "delete":
            immediate_actions.append("Review dependent tasks for orphaning")
            mitigation_strategies.append("Reassign or merge dependent task requirements")
            alternatives.append("Archive rather than delete to preserve dependency context")
        
        # Calculate confidence metrics
        confidence_score = 0.8  # Base confidence
        if dependency_analysis.get("dependencies"):
            confidence_score += 0.1  # Higher confidence with more dependency data
        if resource_impact:
            confidence_score += 0.1  # Higher confidence with resource data
        confidence_score = min(1.0, confidence_score)
        
        return {
            "success": True,
            "task": {
                "id": target_task.id,
                "title": target_task.title,
                "status": target_task.status.value,
                "priority": target_task.priority.value
            },
            "impact_analysis": {
                "change_type": impact_input.change_type,
                "direct_impact": direct_impact,
                "indirect_impact": indirect_impact,
                "cascade_effects": cascade_effects,
                "timeline_impact": timeline_impact
            },
            "affected_tasks": affected_tasks,
            "resource_impact": resource_impact,
            "recommendations": {
                "immediate_actions": immediate_actions,
                "mitigation_strategies": mitigation_strategies,
                "alternative_approaches": alternatives
            },
            "analysis_confidence": {
                "confidence_score": confidence_score,
                "data_quality": "high" if len(affected_tasks) > 0 else "medium",
                "assumptions": [
                    "Dependency relationships are accurately captured",
                    "Task statuses are up to date",
                    "Resource assignments are current"
                ]
            },
            "summary": {
                "total_affected_tasks": len(affected_tasks),
                "impact_severity": "high" if len(affected_tasks) > 5 else "medium" if len(affected_tasks) > 2 else "low",
                "recommendation_priority": "urgent" if impact_input.change_type == "delete" and len(affected_tasks) > 3 else "normal"
            },
            "message": f"Impact analysis complete: {impact_input.change_type} action on '{target_task.title}' affects {len(affected_tasks)} tasks"
        }
        
    except Exception as e:
        logger.exception("Error in task impact analysis")
        return {"success": False, "error": str(e)}


@mcp.tool()
async def project_health_analysis(health_input: ProjectHealthInput) -> Dict[str, Any]:
    """Comprehensive project health analysis using all three databases for executive insights."""
    triple_db_service, chroma_service, kuzu_service, sync_coordinator = get_services()
    
    try:
        # Get basic project metrics from SQLite
        tasks = await triple_db_service.task_service.list_tasks(
            project_id=health_input.project_id,
            limit=1000  # Get comprehensive task list
        )
        
        if not tasks and health_input.project_id:
            return {"success": False, "error": f"No tasks found for project {health_input.project_id}"}
        
        # Basic task metrics
        total_tasks = len(tasks)
        completed_tasks = len([t for t in tasks if t.status.value in ["done", "completed"]])
        blocked_tasks = len([t for t in tasks if t.status.value == "blocked"])
        in_progress_tasks = len([t for t in tasks if t.status.value in ["doing", "in_progress"]])
        overdue_tasks = 0  # Would need deadline field to calculate
        
        completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
        
        # Get graph analysis for workflow health
        try:
            if health_input.project_id:
                hierarchy = await kuzu_service.get_project_hierarchy(health_input.project_id)
            else:
                # For all projects, get role workload as a proxy
                hierarchy = {"total_nodes": total_tasks, "relationships": []}
            
            bottlenecks = await kuzu_service.find_blocking_bottlenecks()
            cycles = await kuzu_service.detect_circular_dependencies()
            
            workflow_health = {
                "dependency_health": "good" if len(cycles) == 0 else "poor",
                "bottleneck_count": len(bottlenecks),
                "parallel_opportunities": max(0, total_tasks - blocked_tasks - len(bottlenecks)),
                "resource_utilization": "optimal" if completion_rate > 70 else "suboptimal",
                "cycle_time_average": "unknown"  # Would need task duration tracking
            }
        except Exception as e:
            logger.warning(f"Graph analysis failed: {e}")
            workflow_health = {
                "dependency_health": "unknown",
                "bottleneck_count": 0,
                "parallel_opportunities": 0,
                "resource_utilization": "unknown",
                "cycle_time_average": "unknown"
            }
        
        # Get semantic coherence analysis from Chroma
        semantic_health = {
            "theme_consistency": "unknown",
            "requirement_clarity": "unknown", 
            "documentation_coverage": "unknown",
            "semantic_drift": "unknown"
        }
        
        try:
            if total_tasks > 5:
                # Try to analyze semantic coherence using clustering
                filters = {}
                if health_input.project_id:
                    filters["project_id"] = {"$eq": health_input.project_id}
                
                embeddings = await chroma_service.get_all_embeddings(filters=filters, min_tasks=5)
                
                if len(embeddings) >= 5:
                    # Calculate semantic coherence by measuring embedding similarity
                    import numpy as np
                    embeddings_array = np.array([emb["embedding"] for emb in embeddings])
                    
                    # Calculate pairwise similarities
                    similarities = []
                    for i in range(len(embeddings_array)):
                        for j in range(i + 1, len(embeddings_array)):
                            sim = 1 - np.linalg.norm(embeddings_array[i] - embeddings_array[j]) / 2
                            similarities.append(sim)
                    
                    avg_similarity = np.mean(similarities) if similarities else 0
                    
                    semantic_health = {
                        "theme_consistency": "high" if avg_similarity > 0.7 else "medium" if avg_similarity > 0.5 else "low",
                        "requirement_clarity": "high" if avg_similarity > 0.6 else "medium",
                        "documentation_coverage": f"{min(100, len(embeddings) / total_tasks * 100):.0f}%",
                        "semantic_drift": "low" if avg_similarity > 0.6 else "medium"
                    }
        except Exception as e:
            logger.warning(f"Semantic analysis failed: {e}")
        
        # Calculate overall health score
        health_factors = []
        
        # Task completion factor (0-40 points)
        completion_points = min(40, completion_rate * 0.4)
        health_factors.append(("Task Completion", completion_points, 40))
        
        # Workflow health factor (0-30 points)
        workflow_points = 30
        if workflow_health["dependency_health"] == "poor":
            workflow_points -= 10
        if workflow_health["bottleneck_count"] > 3:
            workflow_points -= 10
        if blocked_tasks > total_tasks * 0.2:  # More than 20% blocked
            workflow_points -= 10
        workflow_points = max(0, workflow_points)
        health_factors.append(("Workflow Health", workflow_points, 30))
        
        # Resource utilization factor (0-20 points)
        resource_points = 20 if workflow_health["resource_utilization"] == "optimal" else 10
        health_factors.append(("Resource Utilization", resource_points, 20))
        
        # Semantic coherence factor (0-10 points)
        semantic_points = 10
        if semantic_health["theme_consistency"] == "low":
            semantic_points = 3
        elif semantic_health["theme_consistency"] == "medium":
            semantic_points = 7
        health_factors.append(("Semantic Coherence", semantic_points, 10))
        
        total_score = sum(factor[1] for factor in health_factors)
        max_score = sum(factor[2] for factor in health_factors)
        overall_percentage = (total_score / max_score * 100) if max_score > 0 else 0
        
        # Assign letter grade
        if overall_percentage >= 90:
            letter_grade = "A"
        elif overall_percentage >= 80:
            letter_grade = "B"
        elif overall_percentage >= 70:
            letter_grade = "C"
        elif overall_percentage >= 60:
            letter_grade = "D"
        else:
            letter_grade = "F"
        
        # Determine trend (would need historical data for accurate trend)
        trend = "stable"  # Default since we don't have historical data
        
        # Identify risk factors
        high_risk_factors = []
        medium_risk_factors = []
        
        if completion_rate < 50:
            high_risk_factors.append("Low completion rate")
        if blocked_tasks > total_tasks * 0.3:
            high_risk_factors.append("High number of blocked tasks")
        if len(cycles) > 0:
            high_risk_factors.append("Circular dependencies detected")
        if workflow_health["bottleneck_count"] > 5:
            medium_risk_factors.append("Multiple bottlenecks")
        if semantic_health["theme_consistency"] == "low":
            medium_risk_factors.append("Low thematic coherence")
        
        # Generate recommendations
        immediate_actions = []
        short_term_actions = []
        strategic_actions = []
        
        if completion_rate < 70:
            immediate_actions.append("Focus on completing in-progress tasks")
        if blocked_tasks > 0:
            immediate_actions.append("Resolve blocking issues")
        if len(cycles) > 0:
            immediate_actions.append("Break circular dependencies")
        
        if workflow_health["bottleneck_count"] > 2:
            short_term_actions.append("Address workflow bottlenecks")
        if semantic_health["theme_consistency"] == "low":
            short_term_actions.append("Improve task description clarity")
        
        strategic_actions.append("Implement regular health monitoring")
        if health_input.project_id:
            strategic_actions.append("Consider project scope adjustment")
        
        # Predictive analysis (if requested)
        predictions = None
        if health_input.include_predictions:
            # Simple prediction based on current metrics
            predicted_completion_date = "unknown"
            if in_progress_tasks > 0 and completion_rate > 0:
                # Very rough estimate
                avg_completion_time = 7  # Assume 7 days average per task
                remaining_tasks = total_tasks - completed_tasks
                estimated_days = remaining_tasks * avg_completion_time
                predicted_completion_date = f"~{estimated_days} days"
            
            predictions = {
                "completion_probability": min(100, completion_rate + 20),  # Optimistic estimate
                "predicted_completion_date": predicted_completion_date,
                "risk_of_delays": "high" if len(high_risk_factors) > 2 else "medium" if len(high_risk_factors) > 0 else "low",
                "success_probability": overall_percentage
            }
        
        return {
            "success": True,
            "project_id": health_input.project_id or "all_projects",
            "overall_health": {
                "score": round(overall_percentage, 1),
                "letter_grade": letter_grade,
                "trend": trend,
                "key_indicators": [f"{factor[0]}: {factor[1]}/{factor[2]}" for factor in health_factors]
            },
            "detailed_analysis": {
                "task_management": {
                    "total_tasks": total_tasks,
                    "completion_rate": round(completion_rate, 1),
                    "overdue_tasks": overdue_tasks,
                    "blocked_tasks": blocked_tasks,
                    "in_progress_tasks": in_progress_tasks,
                    "average_task_age": "unknown"  # Would need creation date tracking
                },
                "semantic_coherence": semantic_health,
                "workflow_efficiency": workflow_health
            },
            "risk_factors": {
                "high_risk": high_risk_factors,
                "medium_risk": medium_risk_factors,
                "mitigation_suggestions": [
                    "Regular dependency review meetings",
                    "Improved task breakdown and estimation",
                    "Enhanced communication protocols"
                ]
            },
            "predictions": predictions,
            "action_recommendations": {
                "immediate": immediate_actions,
                "short_term": short_term_actions,
                "strategic": strategic_actions
            },
            "analysis_metadata": {
                "analysis_depth": health_input.analysis_depth,
                "databases_analyzed": ["sqlite", "chroma", "kuzu"],
                "analysis_timestamp": datetime.now().isoformat(),
                "data_freshness": "current"
            },
            "executive_summary": {
                "status": letter_grade,
                "primary_concern": high_risk_factors[0] if high_risk_factors else "No major concerns",
                "next_milestone": immediate_actions[0] if immediate_actions else "Continue current progress",
                "confidence_level": "high" if total_tasks > 10 else "medium"
            },
            "message": f"Project health analysis complete: {letter_grade} grade with {len(high_risk_factors)} high-risk factors identified"
        }
        
    except Exception as e:
        logger.exception("Error in project health analysis")
        return {"success": False, "error": str(e)}


# Include existing basic task management tools from original server
@mcp.tool()
async def get_task(task_id: str) -> Dict[str, Any]:
    """Get detailed information about a specific task."""
    triple_db_service, chroma_service, kuzu_service, sync_coordinator = get_services()
    
    try:
        task = await triple_db_service.get_task(task_id)
        if not task:
            return {"success": False, "error": f"Task {task_id} not found"}
        
        # Include sync status information
        sync_summary = task.get_sync_status_summary()
        
        return {
            "success": True,
            "task": task.to_dict(),
            "sync_status": sync_summary,
            "message": f"Retrieved task {task.title}"
        }
        
    except Exception as e:
        logger.exception("Error getting task")
        return {"success": False, "error": str(e)}


@mcp.tool()
async def list_tasks(
    status_filter: Optional[str] = None,
    priority_filter: Optional[str] = None,
    project_id: Optional[str] = None,
    assignee: Optional[str] = None,
    parent_id: Optional[str] = None,
    limit: int = 50
) -> Dict[str, Any]:
    """List tasks with optional filtering."""
    triple_db_service, chroma_service, kuzu_service, sync_coordinator = get_services()
    
    try:
        # Convert string filters to enums
        status = None
        priority = None
        
        if status_filter:
            status = TaskStatus(status_filter.lower())
        if priority_filter:
            priority = TaskPriority(priority_filter.lower())
        
        tasks = await triple_db_service.task_service.list_tasks(
            status=status,
            priority=priority,
            project_id=project_id,
            assignee=assignee,
            parent_id=parent_id,
            limit=limit
        )
        
        # Include sync status for each task
        task_list = []
        for task in tasks:
            task_dict = task.to_dict()
            task_dict["sync_status"] = task.get_sync_status_summary()
            task_list.append(task_dict)
        
        return {
            "success": True,
            "tasks": task_list,
            "count": len(task_list),
            "message": f"Found {len(task_list)} tasks"
        }
        
    except Exception as e:
        logger.exception("Error listing tasks")
        return {"success": False, "error": str(e)}


if __name__ == "__main__":
    # Run the server
    logger.info("Starting Vespera V2 Triple Database MCP Server...")
    mcp.run()