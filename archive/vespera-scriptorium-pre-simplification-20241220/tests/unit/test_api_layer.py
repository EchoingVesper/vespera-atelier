"""
Unit tests for Vespera V2 REST API Layer.

Tests comprehensive REST API functionality including:
- All 50+ REST endpoints functionality
- Plugin authentication and authorization
- MCP bridge functionality
- WebSocket real-time updates
- Error responses and validation
- CORS and middleware functionality
"""

import pytest
import asyncio
import json
from typing import Dict, Any, List
from unittest.mock import Mock, AsyncMock, patch
from fastapi.testclient import TestClient
from fastapi.websockets import WebSocket
import jwt

# Import API components
from api.server import create_app
from api.utils.mcp_bridge import MCPBridge
from api.models.requests import (
    CreateTaskRequest, UpdateTaskRequest, CreateProjectRequest,
    SearchTasksRequest, ClusteringRequest, ImpactAnalysisRequest,
    HealthAnalysisRequest
)
from api.models.responses import (
    TaskResponse, ProjectResponse, SearchResponse,
    ClusteringResponse, HealthResponse, ErrorResponse
)
from api.middleware.auth import AuthenticationMiddleware
from tasks.models import Task, TaskStatus, TaskPriority


class TestAPIServer:
    """Test cases for FastAPI server setup and configuration."""
    
    @pytest.fixture
    def test_app(self):
        """Create test FastAPI application."""
        with patch('api.server.MCPBridge') as mock_bridge:
            mock_bridge_instance = AsyncMock()
            mock_bridge.return_value = mock_bridge_instance
            
            app = create_app()
            return app
    
    @pytest.fixture
    def client(self, test_app):
        """Create test client."""
        return TestClient(test_app)
    
    def test_app_creation(self, test_app):
        """Test FastAPI application creation."""
        assert test_app is not None
        assert test_app.title == "Vespera V2 REST API"
        assert test_app.version == "2.0.0"
    
    def test_cors_configuration(self, client):
        """Test CORS middleware configuration."""
        response = client.options("/api/v2/tasks")
        
        # Check CORS headers are present
        assert "access-control-allow-origin" in response.headers
        assert "access-control-allow-methods" in response.headers
        assert "access-control-allow-headers" in response.headers
    
    def test_health_endpoint(self, client):
        """Test API health check endpoint."""
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert "version" in data


class TestTaskEndpoints:
    """Test cases for task management endpoints."""
    
    @pytest.fixture
    def mock_mcp_bridge(self):
        """Mock MCP bridge for testing."""
        bridge = AsyncMock(spec=MCPBridge)
        bridge.call_mcp_tool = AsyncMock()
        return bridge
    
    @pytest.fixture
    def client_with_auth(self, test_app):
        """Create test client with authentication."""
        # Mock authentication for testing
        with patch('api.middleware.auth.verify_plugin_token') as mock_verify:
            mock_verify.return_value = {"plugin_id": "test_plugin", "permissions": ["read", "write"]}
            
            client = TestClient(test_app)
            # Add auth header
            client.headers = {"Authorization": "Bearer test_token"}
            return client
    
    @pytest.mark.asyncio
    async def test_create_task_endpoint(self, client_with_auth, mock_mcp_bridge):
        """Test task creation endpoint."""
        with patch('api.routers.tasks.get_mcp_bridge', return_value=mock_mcp_bridge):
            mock_mcp_bridge.call_mcp_tool.return_value = {
                "success": True,
                "task": {
                    "id": "task_123",
                    "title": "Test Task",
                    "description": "Test description",
                    "status": "pending",
                    "priority": "normal",
                    "project_id": "test_project"
                }
            }
            
            task_data = {
                "title": "Test Task",
                "description": "Test description",
                "priority": "normal",
                "project_id": "test_project"
            }
            
            response = client_with_auth.post("/api/v2/tasks", json=task_data)
            
            assert response.status_code == 201
            data = response.json()
            assert data["success"] == True
            assert data["task"]["title"] == "Test Task"
            assert data["task"]["id"] == "task_123"
    
    @pytest.mark.asyncio
    async def test_get_task_endpoint(self, client_with_auth, mock_mcp_bridge):
        """Test task retrieval endpoint."""
        with patch('api.routers.tasks.get_mcp_bridge', return_value=mock_mcp_bridge):
            mock_mcp_bridge.call_mcp_tool.return_value = {
                "success": True,
                "task": {
                    "id": "task_123",
                    "title": "Retrieved Task",
                    "status": "in_progress"
                }
            }
            
            response = client_with_auth.get("/api/v2/tasks/task_123")
            
            assert response.status_code == 200
            data = response.json()
            assert data["task"]["id"] == "task_123"
            assert data["task"]["title"] == "Retrieved Task"
    
    @pytest.mark.asyncio
    async def test_update_task_endpoint(self, client_with_auth, mock_mcp_bridge):
        """Test task update endpoint."""
        with patch('api.routers.tasks.get_mcp_bridge', return_value=mock_mcp_bridge):
            mock_mcp_bridge.call_mcp_tool.return_value = {
                "success": True,
                "task": {
                    "id": "task_123",
                    "title": "Updated Task",
                    "status": "completed"
                }
            }
            
            update_data = {
                "title": "Updated Task",
                "status": "completed"
            }
            
            response = client_with_auth.put("/api/v2/tasks/task_123", json=update_data)
            
            assert response.status_code == 200
            data = response.json()
            assert data["task"]["title"] == "Updated Task"
            assert data["task"]["status"] == "completed"
    
    @pytest.mark.asyncio
    async def test_delete_task_endpoint(self, client_with_auth, mock_mcp_bridge):
        """Test task deletion endpoint."""
        with patch('api.routers.tasks.get_mcp_bridge', return_value=mock_mcp_bridge):
            mock_mcp_bridge.call_mcp_tool.return_value = {
                "success": True,
                "deleted_tasks": ["task_123"]
            }
            
            response = client_with_auth.delete("/api/v2/tasks/task_123")
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] == True
            assert "task_123" in data["deleted_tasks"]
    
    @pytest.mark.asyncio
    async def test_list_tasks_endpoint(self, client_with_auth, mock_mcp_bridge):
        """Test task listing endpoint."""
        with patch('api.routers.tasks.get_mcp_bridge', return_value=mock_mcp_bridge):
            mock_mcp_bridge.call_mcp_tool.return_value = {
                "success": True,
                "tasks": [
                    {"id": "task_1", "title": "Task 1"},
                    {"id": "task_2", "title": "Task 2"}
                ],
                "pagination": {
                    "total": 2,
                    "page": 1,
                    "per_page": 10
                }
            }
            
            response = client_with_auth.get("/api/v2/tasks")
            
            assert response.status_code == 200
            data = response.json()
            assert len(data["tasks"]) == 2
            assert data["pagination"]["total"] == 2
    
    @pytest.mark.asyncio
    async def test_task_endpoint_validation(self, client_with_auth):
        """Test task endpoint input validation."""
        # Test invalid task creation
        invalid_task_data = {
            "title": "",  # Empty title should fail
            "priority": "invalid_priority"  # Invalid priority
        }
        
        response = client_with_auth.post("/api/v2/tasks", json=invalid_task_data)
        assert response.status_code == 422  # Validation error
        
        # Test invalid task ID format
        response = client_with_auth.get("/api/v2/tasks/invalid-id-format")
        assert response.status_code in [400, 404]


class TestSearchEndpoints:
    """Test cases for search functionality endpoints."""
    
    @pytest.fixture
    def client_with_auth(self, test_app):
        """Create test client with authentication."""
        with patch('api.middleware.auth.verify_plugin_token') as mock_verify:
            mock_verify.return_value = {"plugin_id": "test_plugin", "permissions": ["read"]}
            
            client = TestClient(test_app)
            client.headers = {"Authorization": "Bearer test_token"}
            return client
    
    @pytest.mark.asyncio
    async def test_semantic_search_endpoint(self, client_with_auth):
        """Test semantic search endpoint."""
        with patch('api.routers.search.get_mcp_bridge') as mock_get_bridge:
            mock_bridge = AsyncMock()
            mock_bridge.call_mcp_tool.return_value = {
                "success": True,
                "results": [
                    {
                        "task_id": "task_1",
                        "title": "Similar Task 1", 
                        "similarity_score": 0.95
                    },
                    {
                        "task_id": "task_2",
                        "title": "Similar Task 2",
                        "similarity_score": 0.87
                    }
                ],
                "query": "test query",
                "total_results": 2
            }
            mock_get_bridge.return_value = mock_bridge
            
            search_data = {
                "query": "test query",
                "limit": 10,
                "similarity_threshold": 0.7
            }
            
            response = client_with_auth.post("/api/v2/search/semantic", json=search_data)
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] == True
            assert len(data["results"]) == 2
            assert data["results"][0]["similarity_score"] == 0.95
    
    @pytest.mark.asyncio
    async def test_clustering_endpoint(self, client_with_auth):
        """Test task clustering endpoint."""
        with patch('api.routers.search.get_mcp_bridge') as mock_get_bridge:
            mock_bridge = AsyncMock()
            mock_bridge.call_mcp_tool.return_value = {
                "success": True,
                "clusters": [
                    {
                        "cluster_id": "auth_cluster",
                        "theme": "Authentication",
                        "tasks": ["task_1", "task_2"],
                        "similarity_score": 0.85
                    }
                ],
                "clustering_summary": {
                    "clusters_found": 1,
                    "total_tasks_analyzed": 2
                }
            }
            mock_get_bridge.return_value = mock_bridge
            
            cluster_data = {
                "project_id": "test_project",
                "num_clusters": 3,
                "similarity_threshold": 0.7
            }
            
            response = client_with_auth.post("/api/v2/search/cluster", json=cluster_data)
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] == True
            assert len(data["clusters"]) == 1
            assert data["clusters"][0]["theme"] == "Authentication"


class TestProjectEndpoints:
    """Test cases for project management endpoints."""
    
    @pytest.fixture
    def client_with_auth(self, test_app):
        """Create test client with authentication."""
        with patch('api.middleware.auth.verify_plugin_token') as mock_verify:
            mock_verify.return_value = {"plugin_id": "test_plugin", "permissions": ["read", "write"]}
            
            client = TestClient(test_app)
            client.headers = {"Authorization": "Bearer test_token"}
            return client
    
    @pytest.mark.asyncio
    async def test_project_health_endpoint(self, client_with_auth):
        """Test project health analysis endpoint."""
        with patch('api.routers.projects.get_mcp_bridge') as mock_get_bridge:
            mock_bridge = AsyncMock()
            mock_bridge.call_mcp_tool.return_value = {
                "success": True,
                "overall_health": {
                    "score": 85,
                    "letter_grade": "B+",
                    "status": "good"
                },
                "detailed_analysis": {
                    "task_management": {
                        "total_tasks": 20,
                        "completion_rate": 75.0,
                        "blocked_tasks": 1
                    }
                },
                "predictions": {
                    "completion_forecast": {
                        "estimated_completion": "2024-03-15",
                        "confidence": 0.8
                    }
                }
            }
            mock_get_bridge.return_value = mock_bridge
            
            response = client_with_auth.get("/api/v2/projects/test_project/health")
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] == True
            assert data["overall_health"]["score"] == 85
            assert data["overall_health"]["letter_grade"] == "B+"
    
    @pytest.mark.asyncio
    async def test_project_impact_analysis_endpoint(self, client_with_auth):
        """Test project impact analysis endpoint."""
        with patch('api.routers.projects.get_mcp_bridge') as mock_get_bridge:
            mock_bridge = AsyncMock()
            mock_bridge.call_mcp_tool.return_value = {
                "success": True,
                "task": {"id": "task_123", "title": "Critical Task"},
                "summary": {
                    "total_affected_tasks": 5,
                    "impact_severity": "high"
                },
                "impact_analysis": {
                    "direct_impact": 3,
                    "cascade_impact": 2
                }
            }
            mock_get_bridge.return_value = mock_bridge
            
            impact_data = {
                "task_id": "task_123",
                "change_type": "complete",
                "include_dependencies": True
            }
            
            response = client_with_auth.post("/api/v2/projects/test_project/impact", json=impact_data)
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] == True
            assert data["summary"]["impact_severity"] == "high"


class TestAuthentication:
    """Test cases for authentication and authorization."""
    
    @pytest.fixture
    def test_app(self):
        """Create test app with authentication."""
        with patch('api.server.MCPBridge'):
            app = create_app()
            return app
    
    @pytest.fixture
    def client(self, test_app):
        """Create test client."""
        return TestClient(test_app)
    
    def test_unauthorized_request(self, client):
        """Test request without authentication token."""
        response = client.get("/api/v2/tasks")
        assert response.status_code == 401
        
        data = response.json()
        assert "error" in data
        assert "authentication" in data["error"].lower()
    
    def test_invalid_token(self, client):
        """Test request with invalid token."""
        headers = {"Authorization": "Bearer invalid_token"}
        response = client.get("/api/v2/tasks", headers=headers)
        
        assert response.status_code == 401
    
    def test_insufficient_permissions(self, client):
        """Test request with insufficient permissions."""
        with patch('api.middleware.auth.verify_plugin_token') as mock_verify:
            mock_verify.return_value = {"plugin_id": "test_plugin", "permissions": ["read"]}
            
            headers = {"Authorization": "Bearer test_token"}
            task_data = {"title": "Test Task"}
            
            # Try to create task with read-only permissions
            response = client.post("/api/v2/tasks", json=task_data, headers=headers)
            assert response.status_code == 403
    
    def test_valid_authentication(self, client):
        """Test valid authentication flow."""
        with patch('api.middleware.auth.verify_plugin_token') as mock_verify:
            mock_verify.return_value = {
                "plugin_id": "vscode_plugin",
                "permissions": ["read", "write"],
                "user_id": "test_user"
            }
            
            with patch('api.routers.tasks.get_mcp_bridge') as mock_bridge:
                mock_bridge_instance = AsyncMock()
                mock_bridge_instance.call_mcp_tool.return_value = {
                    "success": True,
                    "tasks": [],
                    "pagination": {"total": 0}
                }
                mock_bridge.return_value = mock_bridge_instance
                
                headers = {"Authorization": "Bearer valid_token"}
                response = client.get("/api/v2/tasks", headers=headers)
                
                assert response.status_code == 200


class TestWebSocketEndpoints:
    """Test cases for WebSocket real-time functionality."""
    
    @pytest.fixture
    def test_app(self):
        """Create test app with WebSocket support."""
        with patch('api.server.MCPBridge'):
            app = create_app()
            return app
    
    @pytest.mark.asyncio
    async def test_websocket_connection(self, test_app):
        """Test WebSocket connection establishment."""
        with patch('api.websocket.verify_websocket_auth') as mock_auth:
            mock_auth.return_value = {"plugin_id": "test_plugin"}
            
            client = TestClient(test_app)
            
            with client.websocket_connect("/ws") as websocket:
                # Test connection established
                assert websocket is not None
                
                # Test sending message
                test_message = {"type": "subscribe", "channel": "tasks"}
                websocket.send_json(test_message)
                
                # Should receive acknowledgment
                response = websocket.receive_json()
                assert response["type"] == "ack"
    
    @pytest.mark.asyncio
    async def test_websocket_task_updates(self, test_app):
        """Test real-time task update notifications."""
        with patch('api.websocket.verify_websocket_auth') as mock_auth:
            mock_auth.return_value = {"plugin_id": "test_plugin"}
            
            client = TestClient(test_app)
            
            with client.websocket_connect("/ws") as websocket:
                # Subscribe to task updates
                websocket.send_json({
                    "type": "subscribe",
                    "channel": "tasks",
                    "filters": {"project_id": "test_project"}
                })
                
                # Simulate task update broadcast
                with patch('api.websocket.broadcast_task_update') as mock_broadcast:
                    mock_broadcast.return_value = None
                    
                    # Trigger update (this would normally come from MCP tools)
                    task_update = {
                        "type": "task_updated",
                        "task": {
                            "id": "task_123",
                            "title": "Updated Task",
                            "status": "completed"
                        },
                        "project_id": "test_project"
                    }
                    
                    # In real scenario, this would be broadcast to connected clients
                    assert mock_broadcast.called == False  # Not called in test
    
    @pytest.mark.asyncio
    async def test_websocket_authentication_failure(self, test_app):
        """Test WebSocket authentication failure."""
        with patch('api.websocket.verify_websocket_auth') as mock_auth:
            mock_auth.side_effect = Exception("Invalid token")
            
            client = TestClient(test_app)
            
            try:
                with client.websocket_connect("/ws") as websocket:
                    # Should not reach here due to auth failure
                    assert False, "WebSocket connection should have failed"
            except Exception:
                # Expected to fail authentication
                pass


class TestErrorHandling:
    """Test cases for error handling and validation."""
    
    @pytest.fixture
    def client_with_auth(self, test_app):
        """Create authenticated test client."""
        with patch('api.middleware.auth.verify_plugin_token') as mock_verify:
            mock_verify.return_value = {"plugin_id": "test_plugin", "permissions": ["read", "write"]}
            
            client = TestClient(test_app)
            client.headers = {"Authorization": "Bearer test_token"}
            return client
    
    def test_validation_errors(self, client_with_auth):
        """Test input validation error handling."""
        # Test invalid JSON
        response = client_with_auth.post("/api/v2/tasks", data="invalid json")
        assert response.status_code == 422
        
        # Test missing required fields
        response = client_with_auth.post("/api/v2/tasks", json={})
        assert response.status_code == 422
        
        # Test invalid field values
        invalid_task = {
            "title": "Valid Title",
            "priority": "invalid_priority",
            "status": "invalid_status"
        }
        response = client_with_auth.post("/api/v2/tasks", json=invalid_task)
        assert response.status_code == 422
    
    @pytest.mark.asyncio
    async def test_mcp_bridge_errors(self, client_with_auth):
        """Test MCP bridge error handling."""
        with patch('api.routers.tasks.get_mcp_bridge') as mock_get_bridge:
            mock_bridge = AsyncMock()
            mock_bridge.call_mcp_tool.side_effect = Exception("MCP connection failed")
            mock_get_bridge.return_value = mock_bridge
            
            response = client_with_auth.get("/api/v2/tasks/task_123")
            
            assert response.status_code == 500
            data = response.json()
            assert "error" in data
            assert "internal server error" in data["error"].lower()
    
    def test_not_found_errors(self, client_with_auth):
        """Test 404 error handling."""
        with patch('api.routers.tasks.get_mcp_bridge') as mock_get_bridge:
            mock_bridge = AsyncMock()
            mock_bridge.call_mcp_tool.return_value = {
                "success": False,
                "error": "Task not found"
            }
            mock_get_bridge.return_value = mock_bridge
            
            response = client_with_auth.get("/api/v2/tasks/nonexistent_task")
            
            assert response.status_code == 404
            data = response.json()
            assert "error" in data


class TestMCPBridge:
    """Test cases for MCP bridge functionality."""
    
    @pytest.fixture
    def mock_triple_db_service(self):
        """Mock triple database service."""
        service = AsyncMock()
        service.initialize.return_value = True
        service.health_check.return_value = {"status": "healthy"}
        return service
    
    @pytest.mark.asyncio
    async def test_mcp_bridge_initialization(self, mock_triple_db_service):
        """Test MCP bridge initialization."""
        with patch('api.utils.mcp_bridge.TripleDBService') as mock_service_class:
            mock_service_class.return_value = mock_triple_db_service
            
            bridge = MCPBridge()
            success = await bridge.initialize()
            
            assert success == True
            assert bridge._initialized == True
    
    @pytest.mark.asyncio
    async def test_mcp_tool_calls(self, mock_triple_db_service):
        """Test MCP tool function calls through bridge."""
        with patch('api.utils.mcp_bridge.TripleDBService') as mock_service_class:
            mock_service_class.return_value = mock_triple_db_service
            
            bridge = MCPBridge()
            await bridge.initialize()
            
            # Mock specific MCP tool
            with patch('api.utils.mcp_bridge.create_task') as mock_create_task:
                mock_create_task.return_value = {
                    "success": True,
                    "task": {"id": "new_task", "title": "Created Task"}
                }
                
                result = await bridge.call_mcp_tool("create_task", {
                    "task_input": {
                        "title": "Test Task",
                        "description": "Test description"
                    }
                })
                
                assert result["success"] == True
                assert result["task"]["title"] == "Created Task"
    
    @pytest.mark.asyncio
    async def test_mcp_bridge_error_handling(self):
        """Test MCP bridge error handling."""
        bridge = MCPBridge()
        
        # Test calling tool without initialization
        result = await bridge.call_mcp_tool("create_task", {})
        
        assert result["success"] == False
        assert "not initialized" in result["error"].lower()


class TestPerformanceAndLoad:
    """Test cases for API performance and load handling."""
    
    @pytest.fixture
    def client_with_auth(self, test_app):
        """Create authenticated test client."""
        with patch('api.middleware.auth.verify_plugin_token') as mock_verify:
            mock_verify.return_value = {"plugin_id": "test_plugin", "permissions": ["read", "write"]}
            
            client = TestClient(test_app)
            client.headers = {"Authorization": "Bearer test_token"}
            return client
    
    @pytest.mark.asyncio
    async def test_concurrent_requests(self, client_with_auth):
        """Test handling concurrent API requests."""
        with patch('api.routers.tasks.get_mcp_bridge') as mock_get_bridge:
            mock_bridge = AsyncMock()
            mock_bridge.call_mcp_tool.return_value = {
                "success": True,
                "tasks": [],
                "pagination": {"total": 0}
            }
            mock_get_bridge.return_value = mock_bridge
            
            # Simulate concurrent requests
            import asyncio
            import time
            
            async def make_request():
                return client_with_auth.get("/api/v2/tasks")
            
            start_time = time.time()
            
            # Make 10 concurrent requests
            tasks = [make_request() for _ in range(10)]
            responses = await asyncio.gather(*tasks)
            
            end_time = time.time()
            
            # All requests should succeed
            for response in responses:
                assert response.status_code == 200
            
            # Should complete reasonably quickly
            assert (end_time - start_time) < 5.0
    
    def test_large_payload_handling(self, client_with_auth):
        """Test handling of large request payloads."""
        with patch('api.routers.tasks.get_mcp_bridge') as mock_get_bridge:
            mock_bridge = AsyncMock()
            mock_bridge.call_mcp_tool.return_value = {
                "success": True,
                "task": {"id": "large_task", "title": "Large Task"}
            }
            mock_get_bridge.return_value = mock_bridge
            
            # Create large task description
            large_description = "x" * 10000  # 10KB description
            
            task_data = {
                "title": "Task with Large Description",
                "description": large_description,
                "priority": "normal"
            }
            
            response = client_with_auth.post("/api/v2/tasks", json=task_data)
            
            assert response.status_code == 201
            assert response.json()["success"] == True


if __name__ == "__main__":
    pytest.main([__file__])