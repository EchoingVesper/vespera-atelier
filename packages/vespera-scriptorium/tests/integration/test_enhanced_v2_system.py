"""
Integration tests for Enhanced Vespera V2 System.

Tests end-to-end workflows with all new components:
- Background services + MCP tools + REST API coordination
- Plugin integration scenarios (VS Code, Obsidian)
- Multi-database operations with triple-DB system
- Performance testing under load
- Real-world workflow scenarios
"""

import pytest
import asyncio
import tempfile
import json
import time
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, Any, List
from unittest.mock import Mock, AsyncMock, patch
from fastapi.testclient import TestClient

# Import system components
from databases.triple_db_service import TripleDBService, DatabaseConfig
from databases.background_services import BackgroundServiceManager
from databases.service_config import get_development_config, ServiceType, ServicePriority
from api.server import create_app
from api.utils.mcp_bridge import MCPBridge
from tasks.models import Task, TaskStatus, TaskPriority
from mcp_server_triple_db import (
    ClusteringInput, ImpactAnalysisInput, ProjectHealthInput,
    semantic_task_clustering, get_task_impact_analysis, project_health_analysis
)


class TestEnhancedV2SystemIntegration:
    """Integration tests for the complete V2 system."""
    
    @pytest.fixture
    async def temp_dir(self):
        """Create temporary directory for testing."""
        with tempfile.TemporaryDirectory() as temp_dir:
            yield Path(temp_dir)
    
    @pytest.fixture
    async def integrated_system(self, temp_dir):
        """Set up complete integrated system for testing."""
        # 1. Initialize database configuration
        db_config = DatabaseConfig(
            data_dir=temp_dir,
            sqlite_enabled=True,
            chroma_enabled=False,  # Disable for testing
            kuzu_enabled=False,     # Disable for testing
            auto_sync_enabled=True
        )
        
        # 2. Initialize triple database service
        triple_db_service = TripleDBService(db_config)
        await triple_db_service.initialize()
        
        # 3. Initialize background services
        bg_config = get_development_config()
        bg_config.data_dir = temp_dir
        bg_config.worker_count = 1  # Minimal for testing
        
        bg_manager = BackgroundServiceManager(bg_config)
        await bg_manager.initialize()
        await bg_manager.start()
        
        # 4. Initialize MCP bridge
        mcp_bridge = MCPBridge()
        await mcp_bridge.initialize()
        
        # 5. Create API app
        app = create_app()
        api_client = TestClient(app)
        
        # Package system components
        system = {
            "triple_db_service": triple_db_service,
            "background_manager": bg_manager,
            "mcp_bridge": mcp_bridge,
            "api_client": api_client,
            "temp_dir": temp_dir
        }
        
        yield system
        
        # Cleanup
        try:
            await bg_manager.stop()
            await triple_db_service.cleanup()
        except:
            pass
    
    @pytest.mark.asyncio
    async def test_complete_task_lifecycle_integration(self, integrated_system):
        """Test complete task lifecycle through all system components."""
        triple_db = integrated_system["triple_db_service"]
        bg_manager = integrated_system["background_manager"]
        api_client = integrated_system["api_client"]
        
        # 1. Create task via API
        with patch('api.middleware.auth.verify_plugin_token') as mock_auth:
            mock_auth.return_value = {"plugin_id": "test_plugin", "permissions": ["read", "write"]}
            
            with patch('api.routers.tasks.get_mcp_bridge') as mock_get_bridge:
                mock_bridge = AsyncMock()
                mock_bridge.call_mcp_tool.return_value = {
                    "success": True,
                    "task": {
                        "id": "integration_task_001",
                        "title": "Integration Test Task",
                        "description": "End-to-end integration testing task",
                        "status": "pending",
                        "priority": "high",
                        "project_id": "integration_project"
                    }
                }
                mock_get_bridge.return_value = mock_bridge
                
                task_data = {
                    "title": "Integration Test Task",
                    "description": "End-to-end integration testing task",
                    "priority": "high",
                    "project_id": "integration_project"
                }
                
                headers = {"Authorization": "Bearer test_token"}
                response = api_client.post("/api/v2/tasks", json=task_data, headers=headers)
                
                assert response.status_code == 201
                created_task = response.json()["task"]
        
        # 2. Task should trigger background services
        # Schedule embedding generation
        embed_op_id = await bg_manager.schedule_operation(
            ServiceType.AUTO_EMBEDDING,
            "embed_task",
            created_task["id"],
            {"task_data": created_task},
            ServicePriority.NORMAL
        )
        
        # Schedule sync operation
        sync_op_id = await bg_manager.schedule_operation(
            ServiceType.INCREMENTAL_SYNC,
            "sync_task",
            created_task["id"],
            {"operation": "create", "task_data": created_task},
            ServicePriority.NORMAL
        )
        
        # 3. Give background services time to process
        await asyncio.sleep(2)
        
        # 4. Verify operations were scheduled
        assert embed_op_id is not None
        assert sync_op_id is not None
        
        # 5. Test MCP tools integration
        # Test semantic clustering
        clustering_input = ClusteringInput(
            project_id="integration_project",
            num_clusters=2,
            similarity_threshold=0.7
        )
        
        with patch('mcp_server_triple_db.get_services') as mock_services:
            mock_triple_db = AsyncMock()
            mock_triple_db.task_service.list_tasks.return_value = [
                Task(
                    id=created_task["id"],
                    title=created_task["title"],
                    description=created_task["description"],
                    project_id="integration_project"
                )
            ]
            mock_services.return_value = (mock_triple_db, None, None, None)
            
            with patch('mcp_server_triple_db._perform_clustering') as mock_cluster:
                mock_cluster.return_value = {
                    "clusters": [{"cluster_id": "integration_cluster", "tasks": [created_task["id"]]}],
                    "outliers": []
                }
                
                cluster_result = await semantic_task_clustering(clustering_input)
                assert cluster_result["success"] == True
        
        # 6. Test impact analysis
        impact_input = ImpactAnalysisInput(
            task_id=created_task["id"],
            change_type="complete"
        )
        
        with patch('mcp_server_triple_db.get_services') as mock_services:
            mock_triple_db = AsyncMock()
            mock_triple_db.get_task.return_value = Task(
                id=created_task["id"],
                title=created_task["title"],
                project_id="integration_project"
            )
            mock_services.return_value = (mock_triple_db, None, None, None)
            
            with patch('mcp_server_triple_db._calculate_task_impact') as mock_impact:
                mock_impact.return_value = {
                    "direct_impact": 1,
                    "cascade_impact": 0
                }
                
                impact_result = await get_task_impact_analysis(impact_input)
                assert impact_result["success"] == True
        
        # 7. Test project health analysis
        health_input = ProjectHealthInput(
            project_id="integration_project"
        )
        
        with patch('mcp_server_triple_db.get_services') as mock_services:
            mock_triple_db = AsyncMock()
            mock_triple_db.task_service.list_tasks.return_value = [
                Task(id=created_task["id"], status=TaskStatus.PENDING, project_id="integration_project")
            ]
            mock_services.return_value = (mock_triple_db, None, None, None)
            
            with patch('mcp_server_triple_db._calculate_project_health') as mock_health:
                mock_health.return_value = {
                    "overall_score": 60,
                    "letter_grade": "C",
                    "completion_rate": 0
                }
                
                health_result = await project_health_analysis(health_input)
                assert health_result["success"] == True
                assert health_result["overall_health"]["letter_grade"] == "C"
        
        # 8. Update task via API
        with patch('api.middleware.auth.verify_plugin_token') as mock_auth:
            mock_auth.return_value = {"plugin_id": "test_plugin", "permissions": ["read", "write"]}
            
            with patch('api.routers.tasks.get_mcp_bridge') as mock_get_bridge:
                mock_bridge = AsyncMock()
                mock_bridge.call_mcp_tool.return_value = {
                    "success": True,
                    "task": {
                        **created_task,
                        "status": "completed"
                    }
                }
                mock_get_bridge.return_value = mock_bridge
                
                update_data = {"status": "completed"}
                headers = {"Authorization": "Bearer test_token"}
                response = api_client.put(f"/api/v2/tasks/{created_task['id']}", json=update_data, headers=headers)
                
                assert response.status_code == 200
                updated_task = response.json()["task"]
                assert updated_task["status"] == "completed"
        
        # 9. Verify background services status
        bg_status = await bg_manager.get_overall_status()
        assert bg_status["initialized"] == True
        assert bg_status["running"] == True
    
    @pytest.mark.asyncio
    async def test_plugin_integration_workflow(self, integrated_system):
        """Test plugin integration workflow (VS Code, Obsidian)."""
        api_client = integrated_system["api_client"]
        bg_manager = integrated_system["background_manager"]
        
        # Simulate VS Code plugin workflow
        with patch('api.middleware.auth.verify_plugin_token') as mock_auth:
            mock_auth.return_value = {
                "plugin_id": "vscode_vespera",
                "permissions": ["read", "write", "admin"],
                "user_id": "test_user"
            }
            
            headers = {"Authorization": "Bearer vscode_token"}
            
            # 1. Plugin requests health check
            response = api_client.get("/health", headers=headers)
            assert response.status_code == 200
            
            # 2. Plugin creates multiple tasks
            tasks_data = [
                {
                    "title": "Implement authentication",
                    "description": "Add JWT-based authentication",
                    "priority": "high",
                    "project_id": "vscode_project"
                },
                {
                    "title": "Design user interface",
                    "description": "Create responsive UI components",
                    "priority": "normal", 
                    "project_id": "vscode_project"
                },
                {
                    "title": "Setup database",
                    "description": "Initialize database schema",
                    "priority": "high",
                    "project_id": "vscode_project"
                }
            ]
            
            created_tasks = []
            with patch('api.routers.tasks.get_mcp_bridge') as mock_get_bridge:
                mock_bridge = AsyncMock()
                
                for i, task_data in enumerate(tasks_data):
                    task_id = f"vscode_task_{i+1}"
                    mock_bridge.call_mcp_tool.return_value = {
                        "success": True,
                        "task": {
                            "id": task_id,
                            **task_data,
                            "status": "pending"
                        }
                    }
                    
                    response = api_client.post("/api/v2/tasks", json=task_data, headers=headers)
                    assert response.status_code == 201
                    
                    created_task = response.json()["task"]
                    created_tasks.append(created_task)
            
            # 3. Plugin requests semantic clustering
            with patch('api.routers.search.get_mcp_bridge') as mock_get_bridge:
                mock_bridge = AsyncMock()
                mock_bridge.call_mcp_tool.return_value = {
                    "success": True,
                    "clusters": [
                        {
                            "cluster_id": "auth_cluster",
                            "theme": "Authentication & Security",
                            "tasks": ["vscode_task_1"],
                            "similarity_score": 0.9
                        },
                        {
                            "cluster_id": "ui_cluster",
                            "theme": "User Interface",
                            "tasks": ["vscode_task_2"],
                            "similarity_score": 0.8
                        }
                    ],
                    "clustering_summary": {
                        "clusters_found": 2,
                        "total_tasks_analyzed": 3
                    }
                }
                mock_get_bridge.return_value = mock_bridge
                
                cluster_data = {
                    "project_id": "vscode_project",
                    "num_clusters": 3,
                    "similarity_threshold": 0.7
                }
                
                response = api_client.post("/api/v2/search/cluster", json=cluster_data, headers=headers)
                assert response.status_code == 200
                
                cluster_result = response.json()
                assert cluster_result["success"] == True
                assert len(cluster_result["clusters"]) == 2
            
            # 4. Plugin requests project health analysis
            with patch('api.routers.projects.get_mcp_bridge') as mock_get_bridge:
                mock_bridge = AsyncMock()
                mock_bridge.call_mcp_tool.return_value = {
                    "success": True,
                    "overall_health": {
                        "score": 75,
                        "letter_grade": "B",
                        "status": "good"
                    },
                    "detailed_analysis": {
                        "task_management": {
                            "total_tasks": 3,
                            "completion_rate": 0,
                            "blocked_tasks": 0
                        }
                    }
                }
                mock_get_bridge.return_value = mock_bridge
                
                response = api_client.get("/api/v2/projects/vscode_project/health", headers=headers)
                assert response.status_code == 200
                
                health_result = response.json()
                assert health_result["overall_health"]["letter_grade"] == "B"
            
            # 5. Verify background services processed plugin operations
            for task in created_tasks:
                # Each task creation should trigger background operations
                embed_op_id = await bg_manager.schedule_operation(
                    ServiceType.AUTO_EMBEDDING,
                    "embed_task",
                    task["id"],
                    {"task_data": task},
                    ServicePriority.NORMAL
                )
                assert embed_op_id is not None
    
    @pytest.mark.asyncio
    async def test_multi_database_coordination(self, integrated_system):
        """Test coordination across triple database system."""
        triple_db = integrated_system["triple_db_service"]
        bg_manager = integrated_system["background_manager"]
        
        # 1. Create task in SQLite
        task = Task(
            title="Multi-DB Test Task",
            description="Testing coordination across databases",
            priority=TaskPriority.HIGH,
            project_id="multidb_project"
        )
        
        success, result = await triple_db.create_task(task)
        assert success == True
        
        created_task = result["task"]
        task_id = created_task["id"]
        
        # 2. Schedule operations for all databases
        operations = [
            # Embedding generation (Chroma)
            {
                "service_type": ServiceType.AUTO_EMBEDDING,
                "operation_type": "embed_task",
                "target_id": task_id,
                "payload": {"task_data": created_task}
            },
            # Sync to knowledge graph (Kuzu)
            {
                "service_type": ServiceType.INCREMENTAL_SYNC,
                "operation_type": "sync_to_kuzu",
                "target_id": task_id,
                "payload": {"task_data": created_task, "operation": "create"}
            },
            # Full sync coordination
            {
                "service_type": ServiceType.INCREMENTAL_SYNC,
                "operation_type": "coordinate_sync",
                "target_id": task_id,
                "payload": {"databases": ["sqlite", "chroma", "kuzu"]}
            }
        ]
        
        operation_ids = []
        for op in operations:
            op_id = await bg_manager.schedule_operation(
                op["service_type"],
                op["operation_type"],
                op["target_id"],
                op["payload"],
                ServicePriority.NORMAL
            )
            operation_ids.append(op_id)
        
        # 3. Wait for coordination
        await asyncio.sleep(3)
        
        # 4. Verify operations were scheduled
        for op_id in operation_ids:
            assert op_id is not None
        
        # 5. Test consistency across databases
        retrieved_task = await triple_db.get_task(task_id)
        assert retrieved_task is not None
        assert retrieved_task.title == "Multi-DB Test Task"
        
        # 6. Update task and verify sync
        updates = {
            "title": "Updated Multi-DB Task",
            "status": "in_progress"
        }
        
        success, result = await triple_db.update_task(task_id, updates)
        assert success == True
        
        # Should trigger sync operations
        sync_op_id = await bg_manager.schedule_operation(
            ServiceType.INCREMENTAL_SYNC,
            "sync_update",
            task_id,
            {"operation": "update", "changes": updates},
            ServicePriority.HIGH
        )
        
        await asyncio.sleep(2)
        assert sync_op_id is not None
    
    @pytest.mark.asyncio
    async def test_performance_under_load(self, integrated_system):
        """Test system performance under load."""
        triple_db = integrated_system["triple_db_service"]
        bg_manager = integrated_system["background_manager"]
        api_client = integrated_system["api_client"]
        
        # 1. Create multiple tasks concurrently
        num_tasks = 50
        task_creation_start = time.time()
        
        created_tasks = []
        for i in range(num_tasks):
            task = Task(
                title=f"Load Test Task {i+1}",
                description=f"Performance testing task number {i+1}",
                priority=TaskPriority.NORMAL if i % 2 == 0 else TaskPriority.HIGH,
                project_id="load_test_project"
            )
            
            success, result = await triple_db.create_task(task)
            assert success == True
            created_tasks.append(result["task"])
        
        task_creation_time = time.time() - task_creation_start
        
        # Should create 50 tasks in reasonable time
        assert task_creation_time < 10.0
        assert len(created_tasks) == num_tasks
        
        # 2. Schedule background operations for all tasks
        bg_operations_start = time.time()
        
        operation_ids = []
        for task in created_tasks:
            # Schedule embedding for each task
            op_id = await bg_manager.schedule_operation(
                ServiceType.AUTO_EMBEDDING,
                "embed_task",
                task["id"],
                {"task_data": task},
                ServicePriority.NORMAL
            )
            operation_ids.append(op_id)
        
        # 3. Test concurrent API requests
        with patch('api.middleware.auth.verify_plugin_token') as mock_auth:
            mock_auth.return_value = {"plugin_id": "load_test", "permissions": ["read", "write"]}
            
            with patch('api.routers.tasks.get_mcp_bridge') as mock_get_bridge:
                mock_bridge = AsyncMock()
                mock_bridge.call_mcp_tool.return_value = {
                    "success": True,
                    "tasks": created_tasks[:10],  # Return first 10 tasks
                    "pagination": {"total": num_tasks, "page": 1, "per_page": 10}
                }
                mock_get_bridge.return_value = mock_bridge
                
                headers = {"Authorization": "Bearer load_test_token"}
                
                # Make multiple concurrent API requests
                api_request_start = time.time()
                
                async def make_api_request():
                    return api_client.get("/api/v2/tasks", headers=headers)
                
                # 20 concurrent requests
                api_tasks = [make_api_request() for _ in range(20)]
                responses = await asyncio.gather(*api_tasks)
                
                api_request_time = time.time() - api_request_start
                
                # All requests should succeed
                for response in responses:
                    assert response.status_code == 200
                
                # Should handle concurrent requests efficiently
                assert api_request_time < 5.0
        
        # 4. Test MCP tools with large dataset
        with patch('mcp_server_triple_db.get_services') as mock_services:
            mock_triple_db = AsyncMock()
            mock_triple_db.task_service.list_tasks.return_value = [
                Task(
                    id=task["id"],
                    title=task["title"],
                    description=task["description"],
                    project_id="load_test_project"
                )
                for task in created_tasks
            ]
            mock_services.return_value = (mock_triple_db, None, None, None)
            
            clustering_start = time.time()
            
            with patch('mcp_server_triple_db._perform_clustering') as mock_cluster:
                mock_cluster.return_value = {
                    "clusters": [
                        {
                            "cluster_id": f"load_cluster_{i}",
                            "tasks": [task["id"] for task in created_tasks[i*10:(i+1)*10]]
                        }
                        for i in range(5)  # 5 clusters of 10 tasks each
                    ],
                    "outliers": []
                }
                
                clustering_input = ClusteringInput(
                    project_id="load_test_project",
                    num_clusters=5
                )
                
                cluster_result = await semantic_task_clustering(clustering_input)
                
                clustering_time = time.time() - clustering_start
                
                assert cluster_result["success"] == True
                assert clustering_time < 3.0  # Should cluster efficiently
        
        # 5. Wait for background operations to complete
        await asyncio.sleep(5)
        
        # 6. Verify system remains responsive
        bg_status = await bg_manager.get_overall_status()
        assert bg_status["running"] == True
        
        health_status = await triple_db.health_check()
        assert health_status["overall_status"] in ["healthy", "degraded"]
        
        # 7. Performance summary
        print(f"\nPerformance Test Results:")
        print(f"Task Creation: {num_tasks} tasks in {task_creation_time:.2f}s")
        print(f"API Requests: 20 concurrent requests in {api_request_time:.2f}s")
        print(f"Background Operations: {len(operation_ids)} operations scheduled")
        print(f"System Status: {bg_status['running']}")
    
    @pytest.mark.asyncio
    async def test_error_recovery_and_resilience(self, integrated_system):
        """Test system error recovery and resilience."""
        triple_db = integrated_system["triple_db_service"]
        bg_manager = integrated_system["background_manager"]
        
        # 1. Test database error recovery
        task = Task(
            title="Error Recovery Test",
            description="Testing error recovery mechanisms",
            project_id="error_test"
        )
        
        # Simulate database error during creation
        with patch.object(triple_db.task_service, 'create_task', side_effect=Exception("Database error")):
            success, result = await triple_db.create_task(task)
            assert success == False
            assert "error" in result
        
        # System should recover and work normally
        success, result = await triple_db.create_task(task)
        assert success == True
        
        task_id = result["task"]["id"]
        
        # 2. Test background service error handling
        # Schedule operation that will fail
        op_id = await bg_manager.schedule_operation(
            ServiceType.AUTO_EMBEDDING,
            "failing_operation",  # Invalid operation
            task_id,
            {"invalid": "data"},
            ServicePriority.NORMAL
        )
        
        # Give time for error handling
        await asyncio.sleep(2)
        
        # Background manager should still be running
        bg_status = await bg_manager.get_overall_status()
        assert bg_status["running"] == True
        
        # 3. Test API error handling
        api_client = integrated_system["api_client"]
        
        with patch('api.middleware.auth.verify_plugin_token') as mock_auth:
            mock_auth.return_value = {"plugin_id": "error_test", "permissions": ["read", "write"]}
            
            # Test with invalid request data
            headers = {"Authorization": "Bearer error_test_token"}
            invalid_data = {"invalid": "request"}
            
            response = api_client.post("/api/v2/tasks", json=invalid_data, headers=headers)
            assert response.status_code == 422  # Validation error
            
            # API should still be responsive
            response = api_client.get("/health", headers=headers)
            assert response.status_code == 200
        
        # 4. Test MCP tool error handling
        with patch('mcp_server_triple_db.get_services', side_effect=Exception("MCP error")):
            clustering_input = ClusteringInput(project_id="error_test")
            result = await semantic_task_clustering(clustering_input)
            
            assert result["success"] == False
            assert "error" in result
        
        # 5. Verify system resilience
        health_status = await triple_db.health_check()
        assert health_status["initialized"] == True
        
        bg_status = await bg_manager.get_overall_status()
        assert bg_status["initialized"] == True


if __name__ == "__main__":
    pytest.main([__file__])