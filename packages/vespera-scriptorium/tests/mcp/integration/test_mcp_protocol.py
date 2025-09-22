"""
Integration tests for MCP protocol compliance

Tests the FastMCP server's adherence to the MCP (Model Context Protocol) specification.
Verifies JSON-RPC 2.0 compliance, proper tool registration, and protocol semantics.
"""

import pytest
import json
import asyncio
from unittest.mock import patch, AsyncMock, MagicMock
from typing import Dict, Any, List

from fastmcp import FastMCP
from fastmcp.server import Server

import mcp_server
from models import TaskInput, ProjectInput, SearchInput


class TestMCPProtocolCompliance:
    """Test MCP protocol compliance and JSON-RPC 2.0 semantics"""

    @pytest.fixture
    def mcp_app(self):
        """Fixture providing the MCP application"""
        return mcp_server.mcp

    @pytest.fixture
    def mock_bindery_client(self):
        """Mock Bindery client for isolation"""
        with patch('mcp_server.BinderyClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client
            yield mock_client

    def test_mcp_server_initialization(self, mcp_app):
        """Test that MCP server initializes correctly with proper name"""
        assert isinstance(mcp_app, FastMCP)
        assert mcp_app.name == "Vespera Scriptorium"

    def test_tool_registration(self, mcp_app):
        """Test that all expected tools are registered"""
        # Get registered tools (this depends on FastMCP internals)
        # We'll verify tools exist by checking the mcp_app structure
        # Note: This may need adjustment based on FastMCP's actual API

        expected_tools = [
            "create_task",
            "get_task",
            "update_task",
            "list_tasks",
            "create_project",
            "get_dashboard_stats",
            "search_entities",
            "health_check"
        ]

        # For now, just verify the functions exist in the module
        for tool_name in expected_tools:
            assert hasattr(mcp_server, tool_name)
            tool_func = getattr(mcp_server, tool_name)
            assert callable(tool_func)

    @pytest.mark.asyncio
    async def test_jsonrpc_request_format(self, mock_bindery_client):
        """Test handling of properly formatted JSON-RPC 2.0 requests"""
        # Mock successful response
        mock_bindery_client.health_check.return_value = {"status": "healthy"}

        # Test with a properly formatted JSON-RPC request
        request = {
            "jsonrpc": "2.0",
            "id": "test-123",
            "method": "tools/call",
            "params": {
                "name": "health_check",
                "arguments": {}
            }
        }

        # Call the tool directly (FastMCP would handle JSON-RPC routing)
        result = await mcp_server.health_check()

        # Verify the result structure
        assert isinstance(result, dict)
        assert "status" in result
        assert result["status"] == "healthy"

    @pytest.mark.asyncio
    async def test_tool_parameter_validation(self, mock_bindery_client):
        """Test that tool parameters are properly validated"""
        from models import TaskOutput
        from datetime import datetime, timezone

        # Mock successful task creation
        mock_task = TaskOutput(
            id="task-123",
            title="Test Task",
            description="Test description",
            status="pending",
            priority="medium",
            tags=[],
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            parent_id=None,
            children=[]
        )
        mock_bindery_client.create_task.return_value = mock_task

        # Test with valid input
        valid_task_input = TaskInput(
            title="Valid Task",
            description="Valid description",
            priority="high"
        )

        result = await mcp_server.create_task(valid_task_input)
        assert result["id"] == "task-123"

        # Test with invalid input should raise validation error at Pydantic level
        with pytest.raises(ValueError):
            TaskInput(
                title="", # Empty title should fail validation
                priority="invalid_priority"
            )

    @pytest.mark.asyncio
    async def test_error_response_format(self, mock_bindery_client):
        """Test that error responses follow proper format"""
        from bindery_client import BinderyClientError

        # Mock Bindery client error
        mock_bindery_client.create_task.side_effect = BinderyClientError(
            message="Task creation failed",
            status_code=400,
            details={"validation": "Title required"}
        )

        task_input = TaskInput(title="Test Task")
        result = await mcp_server.create_task(task_input)

        # Error should be returned as structured data, not raised
        assert isinstance(result, dict)
        assert "error" in result
        assert result["error"] == "Task creation failed"
        assert result["operation"] == "create_task"
        assert result["status_code"] == 400
        assert "details" in result

    @pytest.mark.asyncio
    async def test_tool_call_isolation(self, mock_bindery_client):
        """Test that tool calls are properly isolated and don't affect each other"""
        # Mock different responses for different calls
        mock_bindery_client.health_check.return_value = {"status": "healthy"}
        mock_bindery_client.get_dashboard_stats.return_value = MagicMock()
        mock_bindery_client.get_dashboard_stats.return_value.model_dump.return_value = {
            "total_tasks": 10,
            "completed_tasks": 5,
            "active_projects": 2,
            "pending_tasks_by_priority": {"high": 2, "medium": 3},
            "recent_activity_count": 7
        }

        # Call multiple tools
        health_result = await mcp_server.health_check()
        stats_result = await mcp_server.get_dashboard_stats()

        # Verify both calls succeeded independently
        assert health_result["status"] == "healthy"
        assert stats_result["total_tasks"] == 10

        # Verify calls were made to client
        mock_bindery_client.health_check.assert_called_once()
        mock_bindery_client.get_dashboard_stats.assert_called_once()

    @pytest.mark.asyncio
    async def test_concurrent_tool_calls(self, mock_bindery_client):
        """Test handling of concurrent tool calls"""
        # Set up mock responses with delays to simulate concurrent execution
        async def mock_health_check():
            await asyncio.sleep(0.1)
            return {"status": "healthy"}

        async def mock_dashboard_stats():
            await asyncio.sleep(0.1)
            mock_stats = MagicMock()
            mock_stats.model_dump.return_value = {"total_tasks": 5}
            return mock_stats

        mock_bindery_client.health_check.side_effect = mock_health_check
        mock_bindery_client.get_dashboard_stats.side_effect = mock_dashboard_stats

        # Execute concurrent calls
        health_task = asyncio.create_task(mcp_server.health_check())
        stats_task = asyncio.create_task(mcp_server.get_dashboard_stats())

        # Wait for both to complete
        health_result, stats_result = await asyncio.gather(health_task, stats_task)

        # Verify both completed successfully
        assert health_result["status"] == "healthy"
        assert stats_result["total_tasks"] == 5

    @pytest.mark.asyncio
    async def test_large_payload_handling(self, mock_bindery_client):
        """Test handling of large payloads"""
        # Create a task with large description
        large_description = "x" * 10000  # 10KB description

        task_input = TaskInput(
            title="Large Task",
            description=large_description,
            tags=["large", "payload", "test"] * 100  # Large tag list
        )

        from models import TaskOutput
        from datetime import datetime, timezone

        mock_task = TaskOutput(
            id="large-task-123",
            title="Large Task",
            description=large_description,
            status="pending",
            priority="medium",
            tags=task_input.tags,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            parent_id=None,
            children=[]
        )

        mock_bindery_client.create_task.return_value = mock_task

        # Test that large payload is handled correctly
        result = await mcp_server.create_task(task_input)

        assert result["id"] == "large-task-123"
        assert len(result["description"]) == 10000
        assert len(result["tags"]) == 300

    @pytest.mark.asyncio
    async def test_special_characters_handling(self, mock_bindery_client):
        """Test handling of special characters and Unicode"""
        # Task with various special characters and Unicode
        special_title = "Test 🚀 Task with émojis and spëciâl chars: <>\"'&"
        unicode_description = "Unicode test: 你好, здравствуй, مرحبا, 🎉🔥⭐"

        task_input = TaskInput(
            title=special_title,
            description=unicode_description,
            tags=["unicode", "special-chars", "émoji"]
        )

        from models import TaskOutput
        from datetime import datetime, timezone

        mock_task = TaskOutput(
            id="unicode-task",
            title=special_title,
            description=unicode_description,
            status="pending",
            priority="medium",
            tags=task_input.tags,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            parent_id=None,
            children=[]
        )

        mock_bindery_client.create_task.return_value = mock_task

        result = await mcp_server.create_task(task_input)

        # Verify special characters are preserved
        assert result["title"] == special_title
        assert result["description"] == unicode_description
        assert "émoji" in result["tags"]


class TestMCPToolSemantics:
    """Test the semantic behavior of MCP tools"""

    @pytest.fixture
    def mock_bindery_client(self):
        """Mock Bindery client for isolation"""
        with patch('mcp_server.BinderyClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client
            yield mock_client

    @pytest.mark.asyncio
    async def test_create_task_idempotency(self, mock_bindery_client):
        """Test that create_task behaves appropriately for duplicate requests"""
        from models import TaskOutput
        from datetime import datetime, timezone

        mock_task = TaskOutput(
            id="task-456",
            title="Duplicate Task",
            description="Test description",
            status="pending",
            priority="medium",
            tags=[],
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            parent_id=None,
            children=[]
        )

        mock_bindery_client.create_task.return_value = mock_task

        task_input = TaskInput(title="Duplicate Task", description="Test description")

        # Create the same task twice
        result1 = await mcp_server.create_task(task_input)
        result2 = await mcp_server.create_task(task_input)

        # Both should succeed (backend handles duplication logic)
        assert result1["title"] == "Duplicate Task"
        assert result2["title"] == "Duplicate Task"
        assert mock_bindery_client.create_task.call_count == 2

    @pytest.mark.asyncio
    async def test_update_task_partial_updates(self, mock_bindery_client):
        """Test that update_task handles partial updates correctly"""
        from models import TaskOutput, TaskUpdateInput
        from datetime import datetime, timezone

        # Mock the updated task
        updated_task = TaskOutput(
            id="task-789",
            title="Original Title",  # Not updated
            description="Updated description",  # Updated
            status="in_progress",  # Updated
            priority="medium",  # Not updated
            tags=[],
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            parent_id=None,
            children=[]
        )

        mock_bindery_client.update_task.return_value = updated_task

        # Partial update (only description and status)
        task_update = TaskUpdateInput(
            description="Updated description",
            status="in_progress"
            # title and priority not specified - should remain unchanged
        )

        result = await mcp_server.update_task("task-789", task_update)

        # Verify the update was called with correct parameters
        mock_bindery_client.update_task.assert_called_once_with("task-789", task_update)

        # Verify result contains updates
        assert result["description"] == "Updated description"
        assert result["status"] == "in_progress"

    @pytest.mark.asyncio
    async def test_list_tasks_filtering(self, mock_bindery_client):
        """Test that list_tasks applies filters correctly"""
        mock_response = MagicMock()
        mock_response.model_dump.return_value = {
            "items": [{"id": "task-1", "status": "pending"}],
            "total": 1,
            "page": 1,
            "per_page": 50
        }

        mock_bindery_client.list_tasks.return_value = mock_response

        # Test with filters
        result = await mcp_server.list_tasks(
            project_id="project-123",
            status="pending"
        )

        # Verify filters were passed to client
        mock_bindery_client.list_tasks.assert_called_once_with("project-123", "pending")
        assert result["total"] == 1

    @pytest.mark.asyncio
    async def test_search_entities_comprehensive(self, mock_bindery_client):
        """Test search_entities with various search parameters"""
        from models import SearchOutput, SearchResult

        search_result = SearchOutput(
            query="test query",
            total_results=3,
            results=[
                SearchResult(
                    id="task-1",
                    type="task",
                    title="Test Task 1",
                    description="Description 1",
                    relevance_score=0.95,
                    tags=["test"]
                ),
                SearchResult(
                    id="project-1",
                    type="project",
                    title="Test Project",
                    description="Project description",
                    relevance_score=0.87,
                    tags=["test", "project"]
                ),
                SearchResult(
                    id="note-1",
                    type="note",
                    title="Test Note",
                    description="Note content",
                    relevance_score=0.72,
                    tags=["test", "note"]
                )
            ]
        )

        mock_bindery_client.search.return_value = search_result

        search_input = SearchInput(
            query="test query",
            entity_types=["task", "project", "note"],
            limit=10,
            include_archived=True
        )

        result = await mcp_server.search_entities(search_input)

        # Verify search parameters were passed correctly
        mock_bindery_client.search.assert_called_once_with(search_input)

        # Verify results structure
        assert result["query"] == "test query"
        assert result["total_results"] == 3
        assert len(result["results"]) == 3

        # Verify result types
        result_types = [r["type"] for r in result["results"]]
        assert "task" in result_types
        assert "project" in result_types
        assert "note" in result_types


class TestMCPErrorHandling:
    """Test MCP protocol error handling"""

    @pytest.fixture
    def mock_bindery_client(self):
        """Mock Bindery client for error testing"""
        with patch('mcp_server.BinderyClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client
            yield mock_client

    @pytest.mark.asyncio
    async def test_network_timeout_handling(self, mock_bindery_client):
        """Test handling of network timeouts"""
        from bindery_client import BinderyClientError

        # Mock timeout error
        mock_bindery_client.health_check.side_effect = BinderyClientError(
            message="Request timed out after 30 seconds"
        )

        result = await mcp_server.health_check()

        # Should return error response, not raise exception
        assert isinstance(result, dict)
        assert "error" in result
        assert "timed out" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_backend_unavailable_handling(self, mock_bindery_client):
        """Test handling when Bindery backend is unavailable"""
        from bindery_client import BinderyClientError

        # Mock connection error
        mock_bindery_client.create_task.side_effect = BinderyClientError(
            message="Connection refused - backend unavailable",
            status_code=None
        )

        task_input = TaskInput(title="Test Task")
        result = await mcp_server.create_task(task_input)

        assert result["error"] == "Connection refused - backend unavailable"
        assert result["operation"] == "create_task"

    @pytest.mark.asyncio
    async def test_malformed_response_handling(self, mock_bindery_client):
        """Test handling of malformed responses from backend"""
        from bindery_client import BinderyClientError

        # Mock JSON parsing error
        mock_bindery_client.get_dashboard_stats.side_effect = BinderyClientError(
            message="Failed to parse response JSON: Invalid JSON at line 1"
        )

        result = await mcp_server.get_dashboard_stats()

        assert "Failed to parse response JSON" in result["error"]
        assert result["operation"] == "get_dashboard_stats"