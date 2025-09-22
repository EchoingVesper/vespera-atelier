"""
MCP Bridge Utility

Provides a bridge between REST API endpoints and existing MCP tools.
This allows the API to leverage all the sophisticated task management
and intelligence features without reimplementing functionality.
"""

import sys
import logging
import asyncio
from pathlib import Path
from typing import Dict, Any, Optional, List, Union
from datetime import datetime

# Add parent directory for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# Import existing MCP server functionality
from tasks import TaskManager, TaskStatus, TaskPriority, TaskRelation, TaskMetadata
from roles import RoleManager
from databases import TripleDBService, DatabaseSyncCoordinator, MigrationManager
from databases.triple_db_service import DatabaseConfig
from databases.chroma_service import ChromaService, ChromaConfig
from databases.kuzu_service import KuzuService, KuzuConfig

logger = logging.getLogger(__name__)


class MCPBridge:
    """
    Bridge between REST API and MCP tools.
    
    Provides a clean interface for calling existing MCP functionality
    from REST endpoints while maintaining proper error handling and
    response formatting.
    """
    
    def __init__(self):
        """Initialize the MCP bridge."""
        self.task_manager: Optional[TaskManager] = None
        self.role_manager: Optional[RoleManager] = None
        self.triple_db_service: Optional[TripleDBService] = None
        self.chroma_service: Optional[ChromaService] = None
        self.kuzu_service: Optional[KuzuService] = None
        self.sync_coordinator: Optional[DatabaseSyncCoordinator] = None
        self.v2_data_dir: Optional[Path] = None
        self._initialized = False
    
    async def initialize(self) -> None:
        """Initialize all MCP services."""
        try:
            if self._initialized:
                return
            
            # Initialize data directory
            project_root = Path.cwd()
            self.v2_data_dir = project_root / ".vespera_v2"
            self.v2_data_dir.mkdir(parents=True, exist_ok=True)
            
            logger.info(f"Initializing MCP bridge with data directory: {self.v2_data_dir}")
            
            # Check if migration is needed
            migration_manager = MigrationManager(self.v2_data_dir / "tasks.db")
            needs_migration = await migration_manager.needs_migration()
            
            if needs_migration:
                logger.info("Database migration required, performing migration...")
                migration_result = await migration_manager.migrate_to_triple_db()
                
                if migration_result.success:
                    logger.info(f"Migration successful: {migration_result.tasks_migrated} tasks migrated")
                else:
                    logger.error(f"Migration failed: {migration_result.errors}")
                    raise Exception("Database migration failed")
            
            # Initialize role manager
            self.role_manager = RoleManager(project_root)
            
            # Initialize task manager
            self.task_manager = TaskManager(project_root, self.role_manager)
            self.task_manager.task_service.db_path = self.v2_data_dir / "tasks.db"
            self.task_manager.task_service._init_database()
            
            # Configure triple database service
            db_config = DatabaseConfig(
                data_dir=self.v2_data_dir,
                sqlite_enabled=True,
                chroma_enabled=True,
                kuzu_enabled=True
            )
            
            # Initialize triple database service
            self.triple_db_service = TripleDBService(db_config)
            await self.triple_db_service.initialize()
            
            # Initialize specialized services
            chroma_config = ChromaConfig(persist_directory=self.v2_data_dir / "embeddings")
            self.chroma_service = ChromaService(chroma_config)
            await self.chroma_service.initialize()
            
            kuzu_config = KuzuConfig(database_path=self.v2_data_dir / "tasks.kuzu")
            self.kuzu_service = KuzuService(kuzu_config)
            await self.kuzu_service.initialize()
            
            # Initialize sync coordinator
            self.sync_coordinator = DatabaseSyncCoordinator(self.triple_db_service.task_service)
            self.sync_coordinator.set_external_clients(
                self.triple_db_service.chroma_client,
                self.triple_db_service.kuzu_database
            )
            await self.sync_coordinator.start()
            
            self._initialized = True
            logger.info("MCP bridge initialized successfully")
            
        except Exception as e:
            logger.exception("Failed to initialize MCP bridge")
            raise
    
    async def cleanup(self) -> None:
        """Cleanup all MCP services."""
        try:
            if self.sync_coordinator:
                await self.sync_coordinator.stop()
            if self.triple_db_service:
                await self.triple_db_service.cleanup()
            if self.chroma_service:
                await self.chroma_service.cleanup()
            if self.kuzu_service:
                await self.kuzu_service.cleanup()
            
            self._initialized = False
            logger.info("MCP bridge cleaned up")
        except Exception as e:
            logger.error(f"Error during MCP bridge cleanup: {e}")
    
    def is_connected(self) -> bool:
        """Check if the bridge is properly initialized and connected."""
        return self._initialized and self.task_manager is not None
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform health check on all MCP services."""
        try:
            if not self._initialized:
                return {"success": False, "error": "MCP bridge not initialized"}
            
            # Check triple database service health
            health = await self.triple_db_service.health_check()
            
            # Add sync statistics
            if self.sync_coordinator:
                sync_stats = await self.sync_coordinator.get_sync_statistics()
                health["sync_statistics"] = sync_stats
            
            # Add database-specific statistics
            if self.chroma_service:
                chroma_stats = await self.chroma_service.get_collection_stats()
                health["chroma_statistics"] = chroma_stats
            
            if self.kuzu_service:
                kuzu_stats = await self.kuzu_service.get_graph_statistics()
                health["kuzu_statistics"] = kuzu_stats
            
            return {"success": True, "health": health}
            
        except Exception as e:
            logger.exception("Health check failed")
            return {"success": False, "error": str(e)}
    
    # Task Management Bridge Methods
    
    async def create_task(self, **kwargs) -> Dict[str, Any]:
        """Bridge to create_task MCP tool."""
        try:
            if not self._initialized:
                return {"success": False, "error": "MCP bridge not initialized"}
            
            # Use triple database service for enhanced functionality
            success, result = await self.triple_db_service.create_task(**kwargs)
            
            return {
                "success": success,
                "task": result.get("task") if success else None,
                "message": result.get("message", "Task created successfully" if success else "Failed to create task")
            }
            
        except Exception as e:
            logger.exception("Error in create_task bridge")
            return {"success": False, "error": str(e)}
    
    async def get_task(self, task_id: str) -> Dict[str, Any]:
        """Bridge to get_task MCP tool."""
        try:
            if not self._initialized:
                return {"success": False, "error": "MCP bridge not initialized"}
            
            task = await self.triple_db_service.get_task(task_id)
            
            if task:
                sync_summary = task.get_sync_status_summary()
                return {
                    "success": True,
                    "task": task.to_dict(),
                    "sync_status": sync_summary
                }
            else:
                return {
                    "success": False,
                    "error": f"Task {task_id} not found"
                }
                
        except Exception as e:
            logger.exception("Error in get_task bridge")
            return {"success": False, "error": str(e)}
    
    async def update_task(self, task_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Bridge to update_task MCP tool."""
        try:
            if not self._initialized:
                return {"success": False, "error": "MCP bridge not initialized"}
            
            success, result = await self.task_manager.task_service.update_task(task_id, updates)
            
            return {
                "success": success,
                "task": result.get("task") if success else None,
                "message": result.get("message", "Task updated successfully" if success else "Failed to update task")
            }
            
        except Exception as e:
            logger.exception("Error in update_task bridge")
            return {"success": False, "error": str(e)}
    
    async def delete_task(self, task_id: str, recursive: bool = True) -> Dict[str, Any]:
        """Bridge to delete_task MCP tool."""
        try:
            if not self._initialized:
                return {"success": False, "error": "MCP bridge not initialized"}
            
            success, result = await self.task_manager.task_service.delete_task(task_id, recursive=recursive)
            
            return {
                "success": success,
                "deleted_tasks": result.get("deleted_tasks", []),
                "message": result.get("message", "Task deleted successfully" if success else "Failed to delete task")
            }
            
        except Exception as e:
            logger.exception("Error in delete_task bridge")
            return {"success": False, "error": str(e)}
    
    async def list_tasks(self, **filters) -> Dict[str, Any]:
        """Bridge to list_tasks MCP tool."""
        try:
            if not self._initialized:
                return {"success": False, "error": "MCP bridge not initialized"}
            
            # Convert string filters to enums
            if "status_filter" in filters and filters["status_filter"]:
                filters["status"] = TaskStatus(filters.pop("status_filter").lower())
            if "priority_filter" in filters and filters["priority_filter"]:
                filters["priority"] = TaskPriority(filters.pop("priority_filter").lower())
            
            tasks = await self.triple_db_service.task_service.list_tasks(**filters)
            
            # Include sync status for each task
            task_list = []
            for task in tasks:
                task_dict = task.to_dict()
                task_dict["sync_status"] = task.get_sync_status_summary()
                task_list.append(task_dict)
            
            return {
                "success": True,
                "tasks": task_list,
                "count": len(task_list)
            }
            
        except Exception as e:
            logger.exception("Error in list_tasks bridge")
            return {"success": False, "error": str(e)}
    
    async def create_task_tree(self, **kwargs) -> Dict[str, Any]:
        """Bridge to create_task_tree MCP tool (DEPRECATED - use create_task with subtasks)."""
        try:
            if not self._initialized:
                return {"success": False, "error": "MCP bridge not initialized"}
            
            # Convert to unified create_task format
            subtasks_data = kwargs.get("subtasks", [])
            converted_subtasks = []
            for subtask in subtasks_data:
                converted_subtasks.append({
                    "title": subtask.get("title", ""),
                    "description": subtask.get("description", ""),
                    "role": subtask.get("role"),
                    "priority": subtask.get("priority", "normal"),
                    "order": subtask.get("order"),
                    "subtasks": []  # No nested subtasks in legacy format
                })
            
            # Use the unified create_task with the TaskManager's create_task_tree for now
            success, result = await self.task_manager.create_task_tree(**kwargs)
            
            return {
                "success": success,
                "root_task": result.get("root_task") if success else None,
                "total_created": result.get("total_created", 0),
                "message": result.get("message", "Task tree created successfully" if success else "Failed to create task tree")
            }
            
        except Exception as e:
            logger.exception("Error in create_task_tree bridge")
            return {"success": False, "error": str(e)}
    
    async def get_task_tree(self, task_id: str) -> Dict[str, Any]:
        """Bridge to get_task_tree MCP tool."""
        try:
            if not self._initialized:
                return {"success": False, "error": "MCP bridge not initialized"}
            
            tree = await self.task_manager.task_service.get_task_tree(task_id)
            
            if tree:
                return {"success": True, "tree": tree}
            else:
                return {"success": False, "error": f"Task tree not found for {task_id}"}
                
        except Exception as e:
            logger.exception("Error in get_task_tree bridge")
            return {"success": False, "error": str(e)}
    
    async def get_task_dashboard(self, project_id: Optional[str] = None) -> Dict[str, Any]:
        """Bridge to get_task_dashboard MCP tool."""
        try:
            if not self._initialized:
                return {"success": False, "error": "MCP bridge not initialized"}
            
            dashboard = await self.task_manager.get_task_dashboard(project_id)
            
            return {
                "success": True,
                "dashboard": dashboard,
                "generated_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.exception("Error in get_task_dashboard bridge")
            return {"success": False, "error": str(e)}
    
    # Search Bridge Methods
    
    async def semantic_search_tasks(self, **kwargs) -> Dict[str, Any]:
        """Bridge to semantic_search_tasks MCP tool."""
        try:
            if not self._initialized:
                return {"success": False, "error": "MCP bridge not initialized"}
            
            # Build metadata filters
            filters = {}
            
            if kwargs.get("project_filter"):
                filters["project_id"] = {"$eq": kwargs["project_filter"]}
            
            if kwargs.get("status_filter"):
                filters["status"] = {"$eq": kwargs["status_filter"].lower()}
            
            if kwargs.get("priority_filter"):
                filters["priority"] = {"$eq": kwargs["priority_filter"].lower()}
            
            # Combine filters with AND logic if multiple
            if len(filters) > 1:
                filters = {"$and": list(filters.values())}
            elif len(filters) == 1:
                filters = list(filters.values())[0]
            else:
                filters = None
            
            # Perform semantic search
            results = await self.chroma_service.semantic_search(
                query=kwargs["query"],
                n_results=kwargs.get("n_results", 10),
                filters=filters,
                min_similarity=kwargs.get("min_similarity", 0.0)
            )
            
            # Enrich with full task data
            enriched_results = []
            for result in results:
                task = await self.triple_db_service.get_task(result.task_id)
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
                "query": kwargs["query"],
                "results_count": len(enriched_results),
                "results": enriched_results
            }
            
        except Exception as e:
            logger.exception("Error in semantic_search_tasks bridge")
            return {"success": False, "error": str(e)}
    
    async def find_similar_tasks(self, task_id: str, n_results: int = 5, min_similarity: float = 0.5) -> Dict[str, Any]:
        """Bridge to find_similar_tasks MCP tool."""
        try:
            if not self._initialized:
                return {"success": False, "error": "MCP bridge not initialized"}
            
            # Get the reference task
            reference_task = await self.triple_db_service.get_task(task_id)
            if not reference_task:
                return {"success": False, "error": f"Task {task_id} not found"}
            
            # Find similar tasks
            similar_results = await self.chroma_service.find_similar_tasks(
                task_id=task_id,
                n_results=n_results,
                min_similarity=min_similarity
            )
            
            # Enrich with full task data
            enriched_results = []
            for result in similar_results:
                task = await self.triple_db_service.get_task(result.task_id)
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
                "similar_tasks": enriched_results
            }
            
        except Exception as e:
            logger.exception("Error in find_similar_tasks bridge")
            return {"success": False, "error": str(e)}
    
    # Project Intelligence Bridge Methods
    
    async def analyze_task_dependencies(self, task_id: str, max_depth: int = 5) -> Dict[str, Any]:
        """Bridge to analyze_task_dependencies MCP tool."""
        try:
            if not self._initialized:
                return {"success": False, "error": "MCP bridge not initialized"}
            
            # Get the task
            task = await self.triple_db_service.get_task(task_id)
            if not task:
                return {"success": False, "error": f"Task {task_id} not found"}
            
            # Perform graph analysis
            dependency_analysis = await self.kuzu_service.analyze_dependencies(
                task_id=task_id,
                max_depth=max_depth
            )
            
            if "error" in dependency_analysis:
                return {"success": False, "error": dependency_analysis["error"]}
            
            return {
                "success": True,
                "task_id": task_id,
                "task_title": task.title,
                "analysis": dependency_analysis
            }
            
        except Exception as e:
            logger.exception("Error in analyze_task_dependencies bridge")
            return {"success": False, "error": str(e)}
    
    async def detect_dependency_cycles(self) -> Dict[str, Any]:
        """Bridge to detect_dependency_cycles MCP tool."""
        try:
            if not self._initialized:
                return {"success": False, "error": "MCP bridge not initialized"}
            
            cycles = await self.kuzu_service.detect_circular_dependencies()
            
            return {
                "success": True,
                "cycles_found": len(cycles),
                "cycles": cycles
            }
            
        except Exception as e:
            logger.exception("Error in detect_dependency_cycles bridge")
            return {"success": False, "error": str(e)}
    
    async def project_health_analysis(self, **kwargs) -> Dict[str, Any]:
        """Bridge to project_health_analysis MCP tool."""
        try:
            if not self._initialized:
                return {"success": False, "error": "MCP bridge not initialized"}
            
            # Get basic project metrics from SQLite
            tasks = await self.triple_db_service.task_service.list_tasks(
                project_id=kwargs.get("project_id"),
                limit=1000  # Get comprehensive task list
            )
            
            if not tasks and kwargs.get("project_id"):
                return {"success": False, "error": f"No tasks found for project {kwargs['project_id']}"}
            
            # This would implement the full project health analysis logic
            # For now, return a simplified structure
            total_tasks = len(tasks)
            completed_tasks = len([t for t in tasks if t.status.value in ["done", "completed"]])
            completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
            
            return {
                "success": True,
                "project_id": kwargs.get("project_id", "all_projects"),
                "overall_health": {
                    "score": completion_rate,
                    "letter_grade": "A" if completion_rate >= 90 else "B" if completion_rate >= 80 else "C",
                    "trend": "stable"
                },
                "detailed_analysis": {
                    "task_management": {
                        "total_tasks": total_tasks,
                        "completion_rate": completion_rate,
                        "blocked_tasks": 0,
                        "in_progress_tasks": len([t for t in tasks if t.status.value in ["doing", "in_progress"]])
                    }
                }
            }
            
        except Exception as e:
            logger.exception("Error in project_health_analysis bridge")
            return {"success": False, "error": str(e)}
    
    # Role Management Bridge Methods
    
    async def list_roles(self) -> Dict[str, Any]:
        """Bridge to list_roles MCP tool."""
        try:
            if not self._initialized:
                return {"success": False, "error": "MCP bridge not initialized"}
            
            roles = self.role_manager.list_roles()
            role_details = []
            
            for role_name in roles:
                role = self.role_manager.get_role(role_name)
                if role:
                    role_details.append({
                        "name": role_name,
                        "description": role.description,
                        "tool_groups": [str(tg) for tg in role.tool_groups],
                        "restrictions": str(role.restrictions) if hasattr(role, 'restrictions') else "None"
                    })
            
            return {
                "success": True,
                "roles": role_details,
                "count": len(role_details)
            }
            
        except Exception as e:
            logger.exception("Error in list_roles bridge")
            return {"success": False, "error": str(e)}
    
    async def assign_role_to_task(self, task_id: str, role_name: str) -> Dict[str, Any]:
        """Bridge to assign_role_to_task MCP tool."""
        try:
            if not self._initialized:
                return {"success": False, "error": "MCP bridge not initialized"}
            
            success, result = await self.task_manager.assign_role_to_task(
                task_id, role_name, validate_capabilities=True
            )
            
            return {
                "success": success,
                "task": result.get("task") if success else None,
                "validation": result.get("validation", {}),
                "message": result.get("message", "Role assigned successfully" if success else "Failed to assign role")
            }
            
        except Exception as e:
            logger.exception("Error in assign_role_to_task bridge")
            return {"success": False, "error": str(e)}