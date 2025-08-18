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
        
        kuzu_config = KuzuConfig(database_path=_v2_data_dir / "knowledge_graph")
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
    auto_embed: bool = Field(True, description="Automatically create embeddings")


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
    """Create a new task with automatic embedding and graph sync."""
    triple_db_service, chroma_service, kuzu_service, sync_coordinator = get_services()
    
    try:
        # Convert priority string to enum
        priority = TaskPriority.NORMAL
        if task_input.priority:
            priority = TaskPriority(task_input.priority.lower())
        
        # Create task in triple database service
        success, result = await triple_db_service.create_task(
            title=task_input.title,
            description=task_input.description,
            parent_id=task_input.parent_id,
            priority=priority,
            project_id=task_input.project_id,
            feature=task_input.feature,
            role_name=task_input.role
        )
        
        if success and task_input.auto_embed:
            # Task is automatically synced via TripleDBService
            task_dict = result["task"]
            logger.info(f"Created task with auto-sync: {task_dict['id']}")
        
        return {
            "success": success,
            "task": result.get("task") if success else None,
            "message": "Task created with semantic embedding and graph sync" if success else result.get("error", "Failed to create task")
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
    """Detect circular dependencies in the task graph."""
    triple_db_service, chroma_service, kuzu_service, sync_coordinator = get_services()
    
    try:
        cycles = await kuzu_service.detect_circular_dependencies()
        
        return {
            "success": True,
            "cycles_found": len(cycles),
            "cycles": cycles,
            "message": f"Found {len(cycles)} circular dependencies" if cycles else "No circular dependencies detected"
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
    """Force full resynchronization of all tasks across databases."""
    try:
        if not _sync_coordinator:
            return {"success": False, "error": "Sync coordinator not initialized"}
        
        result = await _sync_coordinator.force_full_resync()
        return result
        
    except Exception as e:
        logger.exception("Error in full resync")
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