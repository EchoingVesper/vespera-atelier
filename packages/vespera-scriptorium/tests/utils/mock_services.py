"""
Mock services for Vespera V2 testing.

Provides comprehensive mock implementations of all major system components
for isolated testing without external dependencies.
"""

import asyncio
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Union
from unittest.mock import AsyncMock, Mock
from pathlib import Path
import uuid

from tasks.models import Task, TaskStatus, TaskPriority, TripleDBCoordination, SyncStatus
from databases.service_config import ServiceType, ServicePriority, ServiceStatus
from databases.background_services import ServiceOperation


class MockTripleDBService:
    """Mock implementation of TripleDBService for testing."""
    
    def __init__(self, config=None):
        self.config = config
        self._initialized = False
        self._tasks: Dict[str, Task] = {}
        self._projects: Dict[str, Dict[str, Any]] = {}
        self._task_counter = 0
        
    async def initialize(self) -> bool:
        """Mock initialization."""
        self._initialized = True
        return True
    
    async def cleanup(self):
        """Mock cleanup."""
        self._initialized = False
        self._tasks.clear()
        self._projects.clear()
    
    async def create_task(self, task: Task) -> tuple[bool, Dict[str, Any]]:
        """Mock task creation."""
        if not self._initialized:
            return False, {"error": "Service not initialized"}
        
        # Generate ID if not present
        if not task.id:
            self._task_counter += 1
            task.id = f"mock_task_{self._task_counter}"
        
        # Add triple-DB coordination metadata
        task.triple_db = TripleDBCoordination()
        task.triple_db.content_hash = f"hash_{task.id}"
        
        # Store task
        self._tasks[task.id] = task
        
        # Convert to dict for response
        task_dict = {
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "status": task.status.value if isinstance(task.status, TaskStatus) else task.status,
            "priority": task.priority.value if isinstance(task.priority, TaskPriority) else task.priority,
            "project_id": task.project_id,
            "created_at": task.created_at.isoformat() if task.created_at else datetime.now().isoformat(),
            "triple_db": {
                "sync_status": task.triple_db.sync_status.value,
                "embedding_version": task.triple_db.embedding_version,
                "graph_version": task.triple_db.graph_version,
                "content_hash": task.triple_db.content_hash
            }
        }
        
        return True, {
            "task": task_dict,
            "content_hash": task.triple_db.content_hash
        }
    
    async def get_task(self, task_id: str) -> Optional[Task]:
        """Mock task retrieval."""
        return self._tasks.get(task_id)
    
    async def update_task(self, task_id: str, updates: Dict[str, Any]) -> tuple[bool, Dict[str, Any]]:
        """Mock task update."""
        if task_id not in self._tasks:
            return False, {"error": "Task not found"}
        
        task = self._tasks[task_id]
        
        # Apply updates
        for key, value in updates.items():
            if hasattr(task, key):
                if key == "status" and isinstance(value, str):
                    setattr(task, key, TaskStatus(value))
                elif key == "priority" and isinstance(value, str):
                    setattr(task, key, TaskPriority(value))
                else:
                    setattr(task, key, value)
        
        # Update content hash
        task.triple_db.content_hash = f"hash_{task_id}_updated"
        task.triple_db.mark_content_changed(f"{task.title} {task.description}")
        
        # Convert to dict
        task_dict = {
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "status": task.status.value if isinstance(task.status, TaskStatus) else task.status,
            "priority": task.priority.value if isinstance(task.priority, TaskPriority) else task.priority,
            "project_id": task.project_id,
            "updated_at": datetime.now().isoformat()
        }
        
        return True, {
            "task": task_dict,
            "content_hash": task.triple_db.content_hash
        }
    
    async def delete_task(self, task_id: str, recursive: bool = True) -> tuple[bool, Dict[str, Any]]:
        """Mock task deletion."""
        if task_id not in self._tasks:
            return False, {"error": "Task not found"}
        
        deleted_tasks = [task_id]
        del self._tasks[task_id]
        
        return True, {"deleted_tasks": deleted_tasks}
    
    async def list_tasks(self, project_id: Optional[str] = None, limit: int = 100) -> List[Task]:
        """Mock task listing."""
        tasks = list(self._tasks.values())
        
        if project_id:
            tasks = [t for t in tasks if t.project_id == project_id]
        
        return tasks[:limit]
    
    async def health_check(self) -> Dict[str, Any]:
        """Mock health check."""
        return {
            "overall_status": "healthy",
            "initialized": self._initialized,
            "databases": {
                "sqlite": {"connected": True},
                "chroma": {"connected": False},  # Disabled in tests
                "kuzu": {"connected": False}     # Disabled in tests
            },
            "task_count": len(self._tasks)
        }
    
    def _generate_content_hash(self, task: Task) -> str:
        """Mock content hash generation."""
        return f"hash_{task.title}_{task.description}"


class MockBackgroundServiceManager:
    """Mock implementation of BackgroundServiceManager for testing."""
    
    def __init__(self, config=None):
        self.config = config
        self._initialized = False
        self._running = False
        self._operations: Dict[str, ServiceOperation] = {}
        self._operation_counter = 0
        self._service_metrics = {
            service_type: {
                "operations_completed": 0,
                "operations_failed": 0,
                "average_processing_time": 0.1
            }
            for service_type in ServiceType
        }
        
    async def initialize(self) -> bool:
        """Mock initialization."""
        self._initialized = True
        return True
    
    async def start(self):
        """Mock service start."""
        if not self._initialized:
            raise RuntimeError("Not initialized")
        self._running = True
    
    async def stop(self):
        """Mock service stop."""
        self._running = False
        self._operations.clear()
    
    async def schedule_operation(
        self,
        service_type: ServiceType,
        operation_type: str,
        target_id: str,
        payload: Dict[str, Any],
        priority: ServicePriority = ServicePriority.NORMAL
    ) -> str:
        """Mock operation scheduling."""
        if not self._running:
            raise RuntimeError("Service not running")
        
        self._operation_counter += 1
        operation_id = f"mock_op_{self._operation_counter}"
        
        operation = ServiceOperation(
            id=operation_id,
            service_type=service_type,
            priority=priority,
            operation_type=operation_type,
            target_id=target_id,
            payload=payload,
            created_at=datetime.now()
        )
        
        self._operations[operation_id] = operation
        
        # Simulate processing (immediate completion in mock)
        asyncio.create_task(self._process_operation(operation))
        
        return operation_id
    
    async def _process_operation(self, operation: ServiceOperation):
        """Mock operation processing."""
        # Simulate processing delay
        await asyncio.sleep(0.1)
        
        # Update metrics
        metrics = self._service_metrics[operation.service_type]
        
        # Simulate occasional failures
        if operation.operation_type.startswith("invalid") or operation.operation_type.startswith("failing"):
            metrics["operations_failed"] += 1
        else:
            metrics["operations_completed"] += 1
    
    async def get_overall_status(self) -> Dict[str, Any]:
        """Mock overall status."""
        total_completed = sum(m["operations_completed"] for m in self._service_metrics.values())
        total_failed = sum(m["operations_failed"] for m in self._service_metrics.values())
        
        return {
            "initialized": self._initialized,
            "running": self._running,
            "total_operations_completed": total_completed,
            "total_operations_failed": total_failed,
            "active_operations": len(self._operations)
        }
    
    async def get_service_status(self, service_type: ServiceType) -> Dict[str, Any]:
        """Mock service status."""
        metrics = self._service_metrics[service_type]
        
        return {
            "service_type": service_type.value,
            "status": ServiceStatus.RUNNING.value if self._running else ServiceStatus.STOPPED.value,
            "enabled": True,
            "metrics": metrics
        }


class MockMCPBridge:
    """Mock implementation of MCPBridge for testing."""
    
    def __init__(self):
        self._initialized = False
        self._mock_responses = {}
        
    async def initialize(self) -> bool:
        """Mock initialization."""
        self._initialized = True
        return True
    
    async def cleanup(self):
        """Mock cleanup."""
        self._initialized = False
        self._mock_responses.clear()
    
    def set_mock_response(self, tool_name: str, response: Dict[str, Any]):
        """Set mock response for a specific tool."""
        self._mock_responses[tool_name] = response
    
    async def call_mcp_tool(self, tool_name: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Mock MCP tool call."""
        if not self._initialized:
            return {"success": False, "error": "Bridge not initialized"}
        
        # Return pre-configured mock response if available
        if tool_name in self._mock_responses:
            return self._mock_responses[tool_name]
        
        # Default mock responses
        if tool_name == "create_task":
            return {
                "success": True,
                "task": {
                    "id": f"mock_task_{uuid.uuid4().hex[:8]}",
                    "title": parameters.get("task_input", {}).get("title", "Mock Task"),
                    "status": "pending",
                    "created_at": datetime.now().isoformat()
                }
            }
        
        elif tool_name == "get_task":
            return {
                "success": True,
                "task": {
                    "id": parameters.get("task_id", "mock_task"),
                    "title": "Mock Retrieved Task",
                    "status": "pending"
                }
            }
        
        elif tool_name == "list_tasks":
            return {
                "success": True,
                "tasks": [],
                "pagination": {"total": 0, "page": 1, "per_page": 10}
            }
        
        elif tool_name == "semantic_task_clustering":
            return {
                "success": True,
                "clusters": [],
                "clustering_summary": {
                    "clusters_found": 0,
                    "total_tasks_analyzed": 0
                }
            }
        
        elif tool_name == "get_task_impact_analysis":
            return {
                "success": True,
                "task": {"id": parameters.get("task_id"), "title": "Mock Task"},
                "summary": {
                    "total_affected_tasks": 0,
                    "impact_severity": "low"
                },
                "impact_analysis": {
                    "direct_impact": 0,
                    "cascade_impact": 0
                }
            }
        
        elif tool_name == "project_health_analysis":
            return {
                "success": True,
                "overall_health": {
                    "score": 80,
                    "letter_grade": "B",
                    "status": "good"
                },
                "detailed_analysis": {
                    "task_management": {
                        "total_tasks": 0,
                        "completion_rate": 0
                    }
                }
            }
        
        else:
            return {
                "success": False,
                "error": f"Unknown tool: {tool_name}"
            }


class MockChromaService:
    """Mock implementation of ChromaService for testing."""
    
    def __init__(self, config=None):
        self.config = config
        self._initialized = False
        self._embeddings: Dict[str, List[float]] = {}
        
    async def initialize(self) -> bool:
        """Mock initialization."""
        self._initialized = True
        return True
    
    async def cleanup(self):
        """Mock cleanup."""
        self._initialized = False
        self._embeddings.clear()
    
    async def store_task_embedding(self, task_id: str, embedding: List[float], metadata: Dict[str, Any] = None) -> str:
        """Mock embedding storage."""
        self._embeddings[task_id] = embedding
        return f"embedding_{task_id}"
    
    async def get_task_embeddings(self, task_ids: List[str] = None) -> Dict[str, List[float]]:
        """Mock embedding retrieval."""
        if task_ids:
            return {tid: self._embeddings.get(tid, []) for tid in task_ids}
        return self._embeddings.copy()
    
    async def semantic_search(self, query_embedding: List[float], limit: int = 10, threshold: float = 0.7) -> List[Dict[str, Any]]:
        """Mock semantic search."""
        # Return mock search results
        return [
            {
                "task_id": f"result_{i}",
                "similarity_score": 0.9 - (i * 0.1),
                "metadata": {"title": f"Mock Result {i+1}"}
            }
            for i in range(min(limit, 3))
        ]
    
    async def health_check(self) -> Dict[str, Any]:
        """Mock health check."""
        return {
            "connected": self._initialized,
            "collection_count": 1 if self._embeddings else 0,
            "embedding_count": len(self._embeddings)
        }


class MockKuzuService:
    """Mock implementation of KuzuService for testing."""
    
    def __init__(self, config=None):
        self.config = config
        self._initialized = False
        self._nodes: Dict[str, Dict[str, Any]] = {}
        self._relationships: List[Dict[str, Any]] = []
        
    async def initialize(self) -> bool:
        """Mock initialization."""
        self._initialized = True
        return True
    
    async def cleanup(self):
        """Mock cleanup."""
        self._initialized = False
        self._nodes.clear()
        self._relationships.clear()
    
    async def create_task_node(self, task: Task) -> str:
        """Mock task node creation."""
        node_id = f"node_{task.id}"
        self._nodes[node_id] = {
            "id": node_id,
            "task_id": task.id,
            "title": task.title,
            "status": task.status.value if isinstance(task.status, TaskStatus) else task.status
        }
        return node_id
    
    async def create_dependency_relationship(self, from_task_id: str, to_task_id: str, relationship_type: str = "depends_on") -> bool:
        """Mock dependency relationship creation."""
        self._relationships.append({
            "from": from_task_id,
            "to": to_task_id,
            "type": relationship_type,
            "created_at": datetime.now().isoformat()
        })
        return True
    
    async def query_task_relationships(self, task_id: str) -> List[Dict[str, Any]]:
        """Mock relationship querying."""
        return [
            rel for rel in self._relationships
            if rel["from"] == task_id or rel["to"] == task_id
        ]
    
    async def detect_cycles(self, task_ids: List[str] = None) -> Dict[str, Any]:
        """Mock cycle detection."""
        # Return mock cycle detection result
        return {
            "cycles_found": 0,
            "cycle_paths": [],
            "affected_tasks": []
        }
    
    async def health_check(self) -> Dict[str, Any]:
        """Mock health check."""
        return {
            "connected": self._initialized,
            "node_count": len(self._nodes),
            "relationship_count": len(self._relationships)
        }


class MockAuthenticationMiddleware:
    """Mock authentication middleware for API testing."""
    
    def __init__(self):
        self._valid_tokens = {
            "test_token": {
                "plugin_id": "test_plugin",
                "permissions": ["read", "write"],
                "user_id": "test_user"
            },
            "vscode_token": {
                "plugin_id": "vscode_vespera",
                "permissions": ["read", "write", "admin"],
                "user_id": "vscode_user"
            },
            "readonly_token": {
                "plugin_id": "readonly_plugin",
                "permissions": ["read"],
                "user_id": "readonly_user"
            }
        }
    
    def verify_token(self, token: str) -> Dict[str, Any]:
        """Mock token verification."""
        return self._valid_tokens.get(token)
    
    def add_token(self, token: str, user_info: Dict[str, Any]):
        """Add a token for testing."""
        self._valid_tokens[token] = user_info
    
    def remove_token(self, token: str):
        """Remove a token."""
        if token in self._valid_tokens:
            del self._valid_tokens[token]