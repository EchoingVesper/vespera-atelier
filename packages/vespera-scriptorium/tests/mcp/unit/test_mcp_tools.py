"""
Unit tests for MCP server tools

Tests individual MCP tools in isolation using mocked Bindery client.
Focuses on input validation, error handling, and response formatting.
"""

import pytest
import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch, MagicMock
from typing import Dict, Any

from mcp_server import (
    create_task, get_task, update_task, list_tasks,
    create_project, get_dashboard_stats, search_entities,
    health_check, error_handler
)
from models import (
    TaskInput, TaskOutput, TaskUpdateInput,
    ProjectInput, ProjectOutput,
    SearchInput, SearchOutput, SearchResult,
    DashboardStats
)
from bindery_client import BinderyClient, BinderyClientError


class TestTaskManagement:
    """Test task management MCP tools"""

    @pytest.fixture
    def sample_task_input(self):
        """Sample task input for testing"""
        return TaskInput(
            title="Test Task",
            description="Test task description",
            priority="medium",
            tags=["test", "unit"]
        )

    @pytest.fixture
    def sample_task_output(self):
        """Sample task output for testing"""
        return TaskOutput(
            id="task-123",
            title="Test Task",
            description="Test task description",
            status="pending",
            priority="medium",
            tags=["test", "unit"],
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            parent_id=None,
            children=[]
        )

    @pytest.mark.asyncio
    async def test_create_task_success(self, sample_task_input, sample_task_output):
        """Test successful task creation"""
        with patch('mcp_server.BinderyClient') as mock_client_class:
            # Set up mock client
            mock_client = AsyncMock()
            mock_client.create_task.return_value = sample_task_output
            mock_client_class.return_value.__aenter__.return_value = mock_client

            # Call the MCP tool
            result = await create_task(sample_task_input)

            # Verify the call was made correctly
            mock_client.create_task.assert_called_once_with(sample_task_input)

            # Verify the result
            assert isinstance(result, dict)
            assert result["id"] == "task-123"
            assert result["title"] == "Test Task"
            assert result["status"] == "pending"

    @pytest.mark.asyncio
    async def test_create_task_bindery_error(self, sample_task_input):
        """Test task creation with Bindery client error"""
        with patch('mcp_server.BinderyClient') as mock_client_class:
            # Set up mock client to raise error
            mock_client = AsyncMock()
            mock_client.create_task.side_effect = BinderyClientError(
                message="Task creation failed",
                status_code=400,
                details={"validation": "Title too short"}
            )
            mock_client_class.return_value.__aenter__.return_value = mock_client

            # Call the MCP tool
            result = await create_task(sample_task_input)

            # Verify error handling
            assert isinstance(result, dict)
            assert "error" in result
            assert result["error"] == "Task creation failed"
            assert result["operation"] == "create_task"
            assert result["status_code"] == 400

    @pytest.mark.asyncio
    async def test_get_task_success(self, sample_task_output):
        """Test successful task retrieval"""
        with patch('mcp_server.BinderyClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get_task.return_value = sample_task_output
            mock_client_class.return_value.__aenter__.return_value = mock_client

            result = await get_task("task-123")

            mock_client.get_task.assert_called_once_with("task-123")
            assert result["id"] == "task-123"
            assert result["title"] == "Test Task"

    @pytest.mark.asyncio
    async def test_get_task_not_found(self):
        """Test task retrieval with not found error"""
        with patch('mcp_server.BinderyClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get_task.side_effect = BinderyClientError(
                message="Task not found",
                status_code=404
            )
            mock_client_class.return_value.__aenter__.return_value = mock_client

            result = await get_task("nonexistent-task")

            assert result["error"] == "Task not found"
            assert result["status_code"] == 404

    @pytest.mark.asyncio
    async def test_update_task_success(self, sample_task_output):
        """Test successful task update"""
        task_update = TaskUpdateInput(
            title="Updated Task",
            status="in_progress"
        )

        with patch('mcp_server.BinderyClient') as mock_client_class:
            mock_client = AsyncMock()
            updated_task = sample_task_output.model_copy()
            updated_task.title = "Updated Task"
            updated_task.status = "in_progress"
            mock_client.update_task.return_value = updated_task
            mock_client_class.return_value.__aenter__.return_value = mock_client

            result = await update_task("task-123", task_update)

            mock_client.update_task.assert_called_once_with("task-123", task_update)
            assert result["title"] == "Updated Task"
            assert result["status"] == "in_progress"

    @pytest.mark.asyncio
    async def test_list_tasks_no_filter(self):
        """Test listing tasks without filters"""
        mock_response = MagicMock()
        mock_response.model_dump.return_value = {
            "items": [{"id": "task-1"}, {"id": "task-2"}],
            "total": 2
        }

        with patch('mcp_server.BinderyClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.list_tasks.return_value = mock_response
            mock_client_class.return_value.__aenter__.return_value = mock_client

            result = await list_tasks()

            mock_client.list_tasks.assert_called_once_with(None, None)
            assert result["total"] == 2
            assert len(result["items"]) == 2

    @pytest.mark.asyncio
    async def test_list_tasks_with_filters(self):
        """Test listing tasks with project and status filters"""
        mock_response = MagicMock()
        mock_response.model_dump.return_value = {
            "items": [{"id": "task-1", "status": "pending"}],
            "total": 1
        }

        with patch('mcp_server.BinderyClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.list_tasks.return_value = mock_response
            mock_client_class.return_value.__aenter__.return_value = mock_client

            result = await list_tasks(project_id="proj-123", status="pending")

            mock_client.list_tasks.assert_called_once_with("proj-123", "pending")
            assert result["total"] == 1


class TestProjectManagement:
    """Test project management MCP tools"""

    @pytest.fixture
    def sample_project_input(self):
        """Sample project input for testing"""
        return ProjectInput(
            name="Test Project",
            description="Test project description",
            tags=["test", "project"]
        )

    @pytest.fixture
    def sample_project_output(self):
        """Sample project output for testing"""
        return ProjectOutput(
            id="proj-123",
            name="Test Project",
            description="Test project description",
            tags=["test", "project"],
            task_count=5,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )

    @pytest.mark.asyncio
    async def test_create_project_success(self, sample_project_input, sample_project_output):
        """Test successful project creation"""
        with patch('mcp_server.BinderyClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.create_project.return_value = sample_project_output
            mock_client_class.return_value.__aenter__.return_value = mock_client

            result = await create_project(sample_project_input)

            mock_client.create_project.assert_called_once_with(sample_project_input)
            assert result["id"] == "proj-123"
            assert result["name"] == "Test Project"
            assert result["task_count"] == 5


class TestSearch:
    """Test search functionality"""

    @pytest.fixture
    def sample_search_input(self):
        """Sample search input for testing"""
        return SearchInput(
            query="test query",
            entity_types=["task", "project"],
            limit=10,
            include_archived=False
        )

    @pytest.fixture
    def sample_search_output(self):
        """Sample search output for testing"""
        return SearchOutput(
            query="test query",
            total_results=2,
            results=[
                SearchResult(
                    id="task-1",
                    type="task",
                    title="Test Task",
                    description="Task description",
                    relevance_score=0.95,
                    tags=["test"]
                ),
                SearchResult(
                    id="proj-1",
                    type="project",
                    title="Test Project",
                    description="Project description",
                    relevance_score=0.87,
                    tags=["test"]
                )
            ]
        )

    @pytest.mark.asyncio
    async def test_search_entities_success(self, sample_search_input, sample_search_output):
        """Test successful search operation"""
        with patch('mcp_server.BinderyClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.search.return_value = sample_search_output
            mock_client_class.return_value.__aenter__.return_value = mock_client

            result = await search_entities(sample_search_input)

            mock_client.search.assert_called_once_with(sample_search_input)
            assert result["query"] == "test query"
            assert result["total_results"] == 2
            assert len(result["results"]) == 2


class TestDashboard:
    """Test dashboard statistics"""

    @pytest.fixture
    def sample_dashboard_stats(self):
        """Sample dashboard statistics for testing"""
        return DashboardStats(
            total_tasks=25,
            completed_tasks=10,
            active_projects=3,
            pending_tasks_by_priority={
                "low": 5,
                "medium": 8,
                "high": 2
            },
            recent_activity_count=12
        )

    @pytest.mark.asyncio
    async def test_get_dashboard_stats_success(self, sample_dashboard_stats):
        """Test successful dashboard stats retrieval"""
        with patch('mcp_server.BinderyClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get_dashboard_stats.return_value = sample_dashboard_stats
            mock_client_class.return_value.__aenter__.return_value = mock_client

            result = await get_dashboard_stats()

            assert result["total_tasks"] == 25
            assert result["completed_tasks"] == 10
            assert result["active_projects"] == 3
            assert result["recent_activity_count"] == 12


class TestHealthCheck:
    """Test health check functionality"""

    @pytest.mark.asyncio
    async def test_health_check_success(self):
        """Test successful health check"""
        mock_health_data = {"status": "healthy", "version": "1.0.0"}

        with patch('mcp_server.BinderyClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.health_check.return_value = mock_health_data
            mock_client_class.return_value.__aenter__.return_value = mock_client

            result = await health_check()

            assert result["status"] == "healthy"
            assert result["mcp_server"] == "running"
            assert result["backend_response"] == mock_health_data

    @pytest.mark.asyncio
    async def test_health_check_backend_error(self):
        """Test health check when backend is unreachable"""
        with patch('mcp_server.BinderyClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.health_check.side_effect = BinderyClientError(
                message="Connection refused",
                status_code=503
            )
            mock_client_class.return_value.__aenter__.return_value = mock_client

            result = await health_check()

            assert result["error"] == "Connection refused"
            assert result["operation"] == "health_check"


class TestErrorHandling:
    """Test the MCPErrorHandler class"""

    @pytest.mark.asyncio
    async def test_handle_tool_error_success(self):
        """Test error handler with successful operation"""
        async def successful_operation():
            return {"result": "success"}

        result = await error_handler.handle_tool_error(
            "test_operation",
            successful_operation
        )

        assert result == {"result": "success"}

    @pytest.mark.asyncio
    async def test_handle_tool_error_bindery_error(self):
        """Test error handler with BinderyClientError"""
        async def failing_operation():
            raise BinderyClientError(
                message="Test error",
                status_code=400,
                details={"field": "invalid"}
            )

        result = await error_handler.handle_tool_error(
            "test_operation",
            failing_operation
        )

        assert result["error"] == "Test error"
        assert result["operation"] == "test_operation"
        assert result["status_code"] == 400
        assert result["details"] == {"field": "invalid"}

    @pytest.mark.asyncio
    async def test_handle_tool_error_unexpected_error(self):
        """Test error handler with unexpected exception"""
        async def failing_operation():
            raise ValueError("Unexpected error")

        result = await error_handler.handle_tool_error(
            "test_operation",
            failing_operation
        )

        assert "Internal server error" in result["error"]
        assert result["operation"] == "test_operation"
        assert result["error_type"] == "ValueError"


class TestInputValidation:
    """Test input validation for MCP tools"""

    @pytest.mark.asyncio
    async def test_invalid_task_priority(self):
        """Test task creation with invalid priority"""
        # This would be caught by Pydantic validation before reaching the tool
        with pytest.raises(ValueError):
            TaskInput(
                title="Test Task",
                priority="invalid_priority"  # Not in allowed literals
            )

    @pytest.mark.asyncio
    async def test_empty_task_title(self):
        """Test task creation with empty title"""
        with pytest.raises(ValueError):
            TaskInput(title="")  # Required field cannot be empty

    @pytest.mark.asyncio
    async def test_invalid_task_status_update(self):
        """Test task update with invalid status"""
        with pytest.raises(ValueError):
            TaskUpdateInput(status="invalid_status")  # Not in allowed literals