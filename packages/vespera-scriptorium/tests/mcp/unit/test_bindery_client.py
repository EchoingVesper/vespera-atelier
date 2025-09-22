"""
Unit tests for Bindery HTTP client

Tests the HTTP client that communicates with the Rust Bindery backend.
Focuses on HTTP request/response handling, error mapping, and timeout handling.
"""

import pytest
import json
import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch, MagicMock
from typing import Dict, Any

import httpx

from bindery_client import BinderyClient, BinderyClientError
from models import (
    TaskInput, TaskOutput, TaskUpdateInput,
    ProjectInput, ProjectOutput,
    SearchInput, SearchOutput,
    DashboardStats
)


class TestBinderyClient:
    """Test the BinderyClient HTTP client"""

    @pytest.fixture
    def client(self):
        """Fixture providing a BinderyClient instance"""
        return BinderyClient(base_url="http://test-backend:3000", timeout=10.0)

    @pytest.fixture
    def sample_task_input(self):
        """Sample task input for testing"""
        return TaskInput(
            title="Test Task",
            description="Test description",
            priority="high",
            tags=["test", "client"]
        )

    @pytest.fixture
    def sample_task_response(self):
        """Sample HTTP response for task creation"""
        return {
            "id": "task-456",
            "title": "Test Task",
            "description": "Test description",
            "status": "pending",
            "priority": "high",
            "tags": ["test", "client"],
            "created_at": "2024-01-15T10:00:00Z",
            "updated_at": "2024-01-15T10:00:00Z",
            "parent_id": None,
            "children": []
        }

    @pytest.mark.asyncio
    async def test_context_manager_lifecycle(self, client):
        """Test client context manager properly initializes and cleans up"""
        with patch('httpx.AsyncClient') as mock_async_client:
            mock_client_instance = AsyncMock()
            mock_async_client.return_value = mock_client_instance

            # Test context manager entry
            async with client as c:
                assert c is client
                assert client._client == mock_client_instance

            # Test context manager exit
            mock_client_instance.aclose.assert_called_once()
            assert client._client is None

    @pytest.mark.asyncio
    async def test_create_task_success(self, client, sample_task_input, sample_task_response):
        """Test successful task creation"""
        with patch('httpx.AsyncClient') as mock_async_client:
            mock_client_instance = AsyncMock()
            mock_async_client.return_value = mock_client_instance

            # Mock successful HTTP response
            mock_response = MagicMock()
            mock_response.status_code = 201
            mock_response.json.return_value = sample_task_response
            mock_client_instance.post.return_value = mock_response

            async with client as c:
                result = await c.create_task(sample_task_input)

                # Verify HTTP call
                mock_client_instance.post.assert_called_once_with(
                    "/api/tasks",
                    json=sample_task_input.model_dump()
                )

                # Verify response parsing
                assert isinstance(result, TaskOutput)
                assert result.id == "task-456"
                assert result.title == "Test Task"
                assert result.priority == "high"

    @pytest.mark.asyncio
    async def test_create_task_http_error(self, client, sample_task_input):
        """Test task creation with HTTP error response"""
        with patch('httpx.AsyncClient') as mock_async_client:
            mock_client_instance = AsyncMock()
            mock_async_client.return_value = mock_client_instance

            # Mock HTTP error response
            mock_response = MagicMock()
            mock_response.status_code = 400
            mock_response.text = "Bad Request: Invalid task data"
            mock_response.json.return_value = {
                "error": "Validation failed",
                "details": {"title": "Title too short"}
            }

            mock_client_instance.post.side_effect = httpx.HTTPStatusError(
                "Bad Request",
                request=MagicMock(),
                response=mock_response
            )

            async with client as c:
                with pytest.raises(BinderyClientError) as exc_info:
                    await c.create_task(sample_task_input)

                error = exc_info.value
                assert "HTTP 400" in error.message
                assert error.status_code == 400
                assert "Validation failed" in str(error.details)

    @pytest.mark.asyncio
    async def test_create_task_connection_error(self, client, sample_task_input):
        """Test task creation with connection error"""
        with patch('httpx.AsyncClient') as mock_async_client:
            mock_client_instance = AsyncMock()
            mock_async_client.return_value = mock_client_instance

            # Mock connection error
            mock_client_instance.post.side_effect = httpx.ConnectError(
                "Connection failed"
            )

            async with client as c:
                with pytest.raises(BinderyClientError) as exc_info:
                    await c.create_task(sample_task_input)

                error = exc_info.value
                assert "Connection failed" in error.message
                assert error.status_code is None

    @pytest.mark.asyncio
    async def test_create_task_timeout(self, client, sample_task_input):
        """Test task creation with timeout"""
        with patch('httpx.AsyncClient') as mock_async_client:
            mock_client_instance = AsyncMock()
            mock_async_client.return_value = mock_client_instance

            # Mock timeout error
            mock_client_instance.post.side_effect = httpx.TimeoutException(
                "Request timed out"
            )

            async with client as c:
                with pytest.raises(BinderyClientError) as exc_info:
                    await c.create_task(sample_task_input)

                error = exc_info.value
                assert "timed out" in error.message.lower()

    @pytest.mark.asyncio
    async def test_get_task_success(self, client):
        """Test successful task retrieval"""
        task_response = {
            "id": "task-789",
            "title": "Retrieved Task",
            "description": "Task description",
            "status": "in_progress",
            "priority": "medium",
            "tags": [],
            "created_at": "2024-01-15T09:00:00Z",
            "updated_at": "2024-01-15T10:30:00Z",
            "parent_id": None,
            "children": []
        }

        with patch('httpx.AsyncClient') as mock_async_client:
            mock_client_instance = AsyncMock()
            mock_async_client.return_value = mock_client_instance

            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = task_response
            mock_client_instance.get.return_value = mock_response

            async with client as c:
                result = await c.get_task("task-789")

                mock_client_instance.get.assert_called_once_with("/api/tasks/task-789")
                assert isinstance(result, TaskOutput)
                assert result.id == "task-789"
                assert result.status == "in_progress"

    @pytest.mark.asyncio
    async def test_get_task_not_found(self, client):
        """Test task retrieval with 404 error"""
        with patch('httpx.AsyncClient') as mock_async_client:
            mock_client_instance = AsyncMock()
            mock_async_client.return_value = mock_client_instance

            mock_response = MagicMock()
            mock_response.status_code = 404
            mock_response.text = "Task not found"

            mock_client_instance.get.side_effect = httpx.HTTPStatusError(
                "Not Found",
                request=MagicMock(),
                response=mock_response
            )

            async with client as c:
                with pytest.raises(BinderyClientError) as exc_info:
                    await c.get_task("nonexistent-task")

                error = exc_info.value
                assert error.status_code == 404
                assert "HTTP 404" in error.message

    @pytest.mark.asyncio
    async def test_update_task_success(self, client):
        """Test successful task update"""
        task_update = TaskUpdateInput(
            title="Updated Task",
            status="completed"
        )

        updated_response = {
            "id": "task-123",
            "title": "Updated Task",
            "description": "Original description",
            "status": "completed",
            "priority": "medium",
            "tags": [],
            "created_at": "2024-01-15T09:00:00Z",
            "updated_at": "2024-01-15T11:00:00Z",
            "parent_id": None,
            "children": []
        }

        with patch('httpx.AsyncClient') as mock_async_client:
            mock_client_instance = AsyncMock()
            mock_async_client.return_value = mock_client_instance

            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = updated_response
            mock_client_instance.patch.return_value = mock_response

            async with client as c:
                result = await c.update_task("task-123", task_update)

                mock_client_instance.patch.assert_called_once_with(
                    "/api/tasks/task-123",
                    json=task_update.model_dump(exclude_none=True)
                )

                assert isinstance(result, TaskOutput)
                assert result.title == "Updated Task"
                assert result.status == "completed"

    @pytest.mark.asyncio
    async def test_list_tasks_no_filters(self, client):
        """Test listing tasks without filters"""
        tasks_response = {
            "items": [
                {
                    "id": "task-1",
                    "title": "Task 1",
                    "description": "",
                    "status": "pending",
                    "priority": "medium",
                    "tags": [],
                    "created_at": "2024-01-15T09:00:00Z",
                    "updated_at": "2024-01-15T09:00:00Z",
                    "parent_id": None,
                    "children": []
                }
            ],
            "total": 1,
            "page": 1,
            "per_page": 50
        }

        with patch('httpx.AsyncClient') as mock_async_client:
            mock_client_instance = AsyncMock()
            mock_async_client.return_value = mock_client_instance

            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = tasks_response
            mock_client_instance.get.return_value = mock_response

            async with client as c:
                result = await c.list_tasks()

                mock_client_instance.get.assert_called_once_with(
                    "/api/tasks",
                    params={}
                )

                assert result.total == 1
                assert len(result.items) == 1

    @pytest.mark.asyncio
    async def test_list_tasks_with_filters(self, client):
        """Test listing tasks with project and status filters"""
        with patch('httpx.AsyncClient') as mock_async_client:
            mock_client_instance = AsyncMock()
            mock_async_client.return_value = mock_client_instance

            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"items": [], "total": 0}
            mock_client_instance.get.return_value = mock_response

            async with client as c:
                await c.list_tasks(project_id="proj-123", status="completed")

                mock_client_instance.get.assert_called_once_with(
                    "/api/tasks",
                    params={"project_id": "proj-123", "status": "completed"}
                )

    @pytest.mark.asyncio
    async def test_create_project_success(self, client):
        """Test successful project creation"""
        project_input = ProjectInput(
            name="Test Project",
            description="Project description",
            tags=["test"]
        )

        project_response = {
            "id": "proj-456",
            "name": "Test Project",
            "description": "Project description",
            "tags": ["test"],
            "task_count": 0,
            "created_at": "2024-01-15T10:00:00Z",
            "updated_at": "2024-01-15T10:00:00Z"
        }

        with patch('httpx.AsyncClient') as mock_async_client:
            mock_client_instance = AsyncMock()
            mock_async_client.return_value = mock_client_instance

            mock_response = MagicMock()
            mock_response.status_code = 201
            mock_response.json.return_value = project_response
            mock_client_instance.post.return_value = mock_response

            async with client as c:
                result = await c.create_project(project_input)

                mock_client_instance.post.assert_called_once_with(
                    "/api/projects",
                    json=project_input.model_dump()
                )

                assert isinstance(result, ProjectOutput)
                assert result.id == "proj-456"
                assert result.name == "Test Project"

    @pytest.mark.asyncio
    async def test_search_success(self, client):
        """Test successful search operation"""
        search_input = SearchInput(
            query="test search",
            entity_types=["task"],
            limit=5
        )

        search_response = {
            "query": "test search",
            "total_results": 2,
            "results": [
                {
                    "id": "task-1",
                    "type": "task",
                    "title": "Test Task 1",
                    "description": "Description 1",
                    "relevance_score": 0.95,
                    "tags": ["test"]
                },
                {
                    "id": "task-2",
                    "type": "task",
                    "title": "Test Task 2",
                    "description": "Description 2",
                    "relevance_score": 0.87,
                    "tags": ["search"]
                }
            ]
        }

        with patch('httpx.AsyncClient') as mock_async_client:
            mock_client_instance = AsyncMock()
            mock_async_client.return_value = mock_client_instance

            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = search_response
            mock_client_instance.post.return_value = mock_response

            async with client as c:
                result = await c.search(search_input)

                mock_client_instance.post.assert_called_once_with(
                    "/api/search",
                    json=search_input.model_dump()
                )

                assert isinstance(result, SearchOutput)
                assert result.query == "test search"
                assert result.total_results == 2
                assert len(result.results) == 2

    @pytest.mark.asyncio
    async def test_get_dashboard_stats_success(self, client):
        """Test successful dashboard stats retrieval"""
        stats_response = {
            "total_tasks": 50,
            "completed_tasks": 20,
            "active_projects": 5,
            "pending_tasks_by_priority": {
                "low": 10,
                "medium": 15,
                "high": 5
            },
            "recent_activity_count": 8
        }

        with patch('httpx.AsyncClient') as mock_async_client:
            mock_client_instance = AsyncMock()
            mock_async_client.return_value = mock_client_instance

            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = stats_response
            mock_client_instance.get.return_value = mock_response

            async with client as c:
                result = await c.get_dashboard_stats()

                mock_client_instance.get.assert_called_once_with("/api/dashboard/stats")

                assert isinstance(result, DashboardStats)
                assert result.total_tasks == 50
                assert result.completed_tasks == 20
                assert result.active_projects == 5

    @pytest.mark.asyncio
    async def test_health_check_success(self, client):
        """Test successful health check"""
        health_response = {
            "status": "healthy",
            "version": "1.2.0",
            "database": "connected",
            "timestamp": "2024-01-15T12:00:00Z"
        }

        with patch('httpx.AsyncClient') as mock_async_client:
            mock_client_instance = AsyncMock()
            mock_async_client.return_value = mock_client_instance

            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = health_response
            mock_client_instance.get.return_value = mock_response

            async with client as c:
                result = await c.health_check()

                mock_client_instance.get.assert_called_once_with("/health")
                assert result == health_response

    @pytest.mark.asyncio
    async def test_client_configuration(self):
        """Test client configuration options"""
        client = BinderyClient(
            base_url="https://custom.bindery.example.com:8443/",
            timeout=60.0
        )

        # URL should be normalized (trailing slash removed)
        assert client.base_url == "https://custom.bindery.example.com:8443"
        assert client.timeout == 60.0

    @pytest.mark.asyncio
    async def test_malformed_json_response(self, client, sample_task_input):
        """Test handling of malformed JSON response"""
        with patch('httpx.AsyncClient') as mock_async_client:
            mock_client_instance = AsyncMock()
            mock_async_client.return_value = mock_client_instance

            # Mock response with malformed JSON
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.side_effect = json.JSONDecodeError(
                "Invalid JSON", "", 0
            )
            mock_response.text = "Invalid JSON response"
            mock_client_instance.post.return_value = mock_response

            async with client as c:
                with pytest.raises(BinderyClientError) as exc_info:
                    await c.create_task(sample_task_input)

                error = exc_info.value
                assert "Failed to parse response JSON" in error.message


class TestBinderyClientError:
    """Test the BinderyClientError exception class"""

    def test_basic_error_creation(self):
        """Test basic error creation"""
        error = BinderyClientError("Test error")
        assert error.message == "Test error"
        assert error.status_code is None
        assert error.details == {}
        assert str(error) == "Test error"

    def test_error_with_status_code(self):
        """Test error with HTTP status code"""
        error = BinderyClientError("Bad request", status_code=400)
        assert error.message == "Bad request"
        assert error.status_code == 400

    def test_error_with_details(self):
        """Test error with additional details"""
        details = {"field": "title", "reason": "too short"}
        error = BinderyClientError("Validation error", details=details)
        assert error.details == details

    def test_full_error(self):
        """Test error with all fields"""
        error = BinderyClientError(
            message="Complete error",
            status_code=422,
            details={"validation": {"title": "required"}}
        )
        assert error.message == "Complete error"
        assert error.status_code == 422
        assert error.details["validation"]["title"] == "required"