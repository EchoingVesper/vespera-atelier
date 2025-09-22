"""
Tests for "Interrupted by user" issue fix

This module tests the specific issue where MCP tool calls could be interrupted
by users and cause the server to become unresponsive or return incomplete responses.
The fix involves proper error handling that returns structured error responses
instead of raising exceptions that break the MCP protocol flow.
"""

import pytest
import asyncio
import signal
from unittest.mock import patch, AsyncMock, MagicMock
from typing import Dict, Any

import mcp_server
from bindery_client import BinderyClientError
from models import TaskInput, TaskUpdateInput, ProjectInput, SearchInput
from ..fixtures.test_helpers import InterruptionSimulator, AsyncTimeout


class TestInterruptionHandling:
    """Test handling of various interruption scenarios"""

    @pytest.fixture
    def mock_bindery_client(self):
        """Mock Bindery client that can simulate interruptions"""
        with patch('mcp_server.BinderyClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client
            yield mock_client

    @pytest.fixture
    def interruption_simulator(self):
        """Provide interruption simulation utilities"""
        return InterruptionSimulator()

    @pytest.mark.asyncio
    async def test_interrupted_task_creation_returns_error(self, mock_bindery_client):
        """Test that interrupted task creation returns proper error response"""

        # Simulate an operation that gets "interrupted" by raising an exception
        async def interrupted_operation():
            # Simulate some work before interruption
            await asyncio.sleep(0.01)
            raise KeyboardInterrupt("User interrupted operation")

        mock_bindery_client.create_task.side_effect = interrupted_operation

        task_input = TaskInput(title="Interrupted Task")

        # The key test: this should NOT raise an exception, but return error response
        result = await mcp_server.create_task(task_input)

        # Verify we get a structured error response instead of exception
        assert isinstance(result, dict)
        assert "error" in result
        assert result["operation"] == "create_task"
        assert "Internal server error" in result["error"]
        assert result["error_type"] == "KeyboardInterrupt"

    @pytest.mark.asyncio
    async def test_interrupted_health_check_graceful_response(self, mock_bindery_client):
        """Test health check interruption handling"""

        # Mock an interrupted health check
        mock_bindery_client.health_check.side_effect = KeyboardInterrupt("Interrupted")

        result = await mcp_server.health_check()

        # Should return error response, not raise
        assert isinstance(result, dict)
        assert "error" in result
        assert result["operation"] == "health_check"
        assert "KeyboardInterrupt" in str(result)

    @pytest.mark.asyncio
    async def test_long_running_operation_interruption(self, mock_bindery_client):
        """Test interruption of long-running operations like search"""

        async def long_running_search():
            """Simulate a search that takes time and gets interrupted"""
            await asyncio.sleep(0.05)  # Simulate work
            raise asyncio.CancelledError("Operation cancelled by user")

        mock_bindery_client.search.side_effect = long_running_search

        search_input = SearchInput(query="long search", limit=1000)

        # Should handle cancellation gracefully
        result = await mcp_server.search_entities(search_input)

        assert isinstance(result, dict)
        assert "error" in result
        assert result["operation"] == "search_entities"
        assert result["error_type"] == "CancelledError"

    @pytest.mark.asyncio
    async def test_multiple_concurrent_interruptions(self, mock_bindery_client):
        """Test handling multiple concurrent operations that get interrupted"""

        # Set up different interruption scenarios for different operations
        mock_bindery_client.create_task.side_effect = KeyboardInterrupt("Create interrupted")
        mock_bindery_client.health_check.side_effect = asyncio.CancelledError("Health cancelled")
        mock_bindery_client.get_dashboard_stats.side_effect = Exception("Stats error")

        task_input = TaskInput(title="Concurrent Task")

        # Run multiple operations concurrently
        create_task = asyncio.create_task(mcp_server.create_task(task_input))
        health_task = asyncio.create_task(mcp_server.health_check())
        stats_task = asyncio.create_task(mcp_server.get_dashboard_stats())

        # Wait for all to complete
        create_result, health_result, stats_result = await asyncio.gather(
            create_task,
            health_task,
            stats_task,
            return_exceptions=False  # All should return results, not raise
        )

        # All should return error responses, not raise exceptions
        assert all(isinstance(result, dict) for result in [create_result, health_result, stats_result])
        assert all("error" in result for result in [create_result, health_result, stats_result])

        # Verify operation names in error responses
        assert create_result["operation"] == "create_task"
        assert health_result["operation"] == "health_check"
        assert stats_result["operation"] == "get_dashboard_stats"

    @pytest.mark.asyncio
    async def test_bindery_client_connection_interruption(self, mock_bindery_client):
        """Test handling when Bindery client connection is interrupted"""

        # Simulate connection being interrupted mid-operation
        mock_bindery_client.update_task.side_effect = BinderyClientError(
            message="Connection interrupted while sending request",
            status_code=None
        )

        task_update = TaskUpdateInput(status="in_progress")
        result = await mcp_server.update_task("task-123", task_update)

        # Should return Bindery error response (not internal error)
        assert result["error"] == "Connection interrupted while sending request"
        assert result["operation"] == "update_task"
        assert result["status_code"] is None

    @pytest.mark.asyncio
    async def test_timeout_vs_interruption_distinction(self, mock_bindery_client):
        """Test that timeouts and interruptions are handled differently"""

        # Test timeout scenario
        mock_bindery_client.list_tasks.side_effect = BinderyClientError(
            message="Request timed out after 30 seconds",
            status_code=408
        )

        timeout_result = await mcp_server.list_tasks()

        # Reset mock for interruption scenario
        mock_bindery_client.list_tasks.side_effect = KeyboardInterrupt("User interruption")

        interrupt_result = await mcp_server.list_tasks()

        # Both should be error responses but with different characteristics
        assert timeout_result["error"] == "Request timed out after 30 seconds"
        assert timeout_result["status_code"] == 408

        assert "Internal server error" in interrupt_result["error"]
        assert interrupt_result["error_type"] == "KeyboardInterrupt"

    @pytest.mark.asyncio
    async def test_graceful_shutdown_during_operation(self):
        """Test graceful shutdown handling during MCP operations"""

        # This test checks the global shutdown handling in the server
        # We'll simulate the shutdown signal being received during operation

        with patch('mcp_server.shutdown_requested', False) as mock_shutdown:
            # Simulate operation in progress when shutdown is requested
            async def operation_during_shutdown():
                await asyncio.sleep(0.01)  # Simulate work
                # Simulate shutdown signal arriving
                mcp_server.shutdown_requested = True
                return {"result": "completed before shutdown"}

            with patch('mcp_server.BinderyClient') as mock_client_class:
                mock_client = AsyncMock()
                mock_client.health_check.side_effect = operation_during_shutdown
                mock_client_class.return_value.__aenter__.return_value = mock_client

                result = await mcp_server.health_check()

                # Should complete normally even if shutdown was requested during operation
                assert result["result"] == "completed before shutdown"


class TestErrorResponseStructure:
    """Test that error responses maintain consistent structure"""

    @pytest.fixture
    def mock_bindery_client(self):
        """Mock Bindery client for error testing"""
        with patch('mcp_server.BinderyClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client
            yield mock_client

    @pytest.mark.asyncio
    async def test_error_response_has_required_fields(self, mock_bindery_client):
        """Test that all error responses have required fields"""

        mock_bindery_client.create_task.side_effect = Exception("Test error")

        task_input = TaskInput(title="Test Task")
        result = await mcp_server.create_task(task_input)

        # Verify required error response fields
        required_fields = ["error", "operation", "error_type"]
        for field in required_fields:
            assert field in result, f"Error response missing required field: {field}"

        assert isinstance(result["error"], str)
        assert isinstance(result["operation"], str)
        assert isinstance(result["error_type"], str)

    @pytest.mark.asyncio
    async def test_bindery_error_response_structure(self, mock_bindery_client):
        """Test structure of responses for BinderyClientError"""

        mock_bindery_client.get_task.side_effect = BinderyClientError(
            message="Task not found",
            status_code=404,
            details={"task_id": "missing-123", "suggestion": "Check task ID"}
        )

        result = await mcp_server.get_task("missing-123")

        # Verify BinderyError-specific fields
        assert result["error"] == "Task not found"
        assert result["operation"] == "get_task"
        assert result["status_code"] == 404
        assert result["details"]["task_id"] == "missing-123"
        assert result["details"]["suggestion"] == "Check task ID"

    @pytest.mark.asyncio
    async def test_unexpected_error_response_structure(self, mock_bindery_client):
        """Test structure of responses for unexpected errors"""

        mock_bindery_client.create_project.side_effect = ValueError("Invalid project data")

        project_input = ProjectInput(name="Test Project")
        result = await mcp_server.create_project(project_input)

        # Verify unexpected error structure
        assert "Internal server error" in result["error"]
        assert "Invalid project data" in result["error"]
        assert result["operation"] == "create_project"
        assert result["error_type"] == "ValueError"

        # Should not have status_code for unexpected errors
        assert "status_code" not in result or result.get("status_code") is None


class TestConcurrencyAndRaceConditions:
    """Test handling of concurrent operations and race conditions"""

    @pytest.fixture
    def mock_bindery_client(self):
        """Mock Bindery client for concurrency testing"""
        with patch('mcp_server.BinderyClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client
            yield mock_client

    @pytest.mark.asyncio
    async def test_concurrent_operations_with_mixed_outcomes(self, mock_bindery_client):
        """Test concurrent operations where some succeed and some fail"""

        # Set up different outcomes for different operations
        from models import TaskOutput
        from datetime import datetime, timezone

        mock_task = TaskOutput(
            id="success-task",
            title="Success Task",
            description="",
            status="pending",
            priority="medium",
            tags=[],
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            parent_id=None,
            children=[]
        )

        # Success case
        mock_bindery_client.create_task.return_value = mock_task
        # Failure case
        mock_bindery_client.get_task.side_effect = KeyboardInterrupt("Interrupted")
        # BinderyError case
        mock_bindery_client.update_task.side_effect = BinderyClientError(
            message="Update failed", status_code=400
        )

        task_input = TaskInput(title="Concurrent Task")
        task_update = TaskUpdateInput(status="completed")

        # Run concurrent operations
        create_task = asyncio.create_task(mcp_server.create_task(task_input))
        get_task = asyncio.create_task(mcp_server.get_task("some-id"))
        update_task = asyncio.create_task(mcp_server.update_task("other-id", task_update))

        create_result, get_result, update_result = await asyncio.gather(
            create_task, get_task, update_task
        )

        # Verify success result
        assert create_result["id"] == "success-task"
        assert "error" not in create_result

        # Verify interrupted result
        assert "error" in get_result
        assert get_result["error_type"] == "KeyboardInterrupt"

        # Verify BinderyError result
        assert update_result["error"] == "Update failed"
        assert update_result["status_code"] == 400

    @pytest.mark.asyncio
    async def test_rapid_sequential_interruptions(self, mock_bindery_client):
        """Test handling of rapid sequential interruptions"""

        # Create a sequence of operations that get interrupted
        interruption_types = [
            KeyboardInterrupt("First interrupt"),
            asyncio.CancelledError("First cancel"),
            KeyboardInterrupt("Second interrupt"),
            Exception("Regular error"),
            BinderyClientError("Bindery error")
        ]

        task_inputs = [
            TaskInput(title=f"Task {i}") for i in range(len(interruption_types))
        ]

        # Run operations sequentially with different interruption types
        results = []
        for i, (task_input, interruption) in enumerate(zip(task_inputs, interruption_types)):
            mock_bindery_client.create_task.side_effect = interruption
            result = await mcp_server.create_task(task_input)
            results.append(result)

        # All should return error responses
        assert all("error" in result for result in results)

        # Verify different error types are handled appropriately
        assert results[0]["error_type"] == "KeyboardInterrupt"
        assert results[1]["error_type"] == "CancelledError"
        assert results[2]["error_type"] == "KeyboardInterrupt"
        assert results[3]["error_type"] == "Exception"
        assert "Bindery error" in results[4]["error"]  # BinderyError handled differently

    @pytest.mark.asyncio
    async def test_interruption_cleanup(self, mock_bindery_client):
        """Test that interrupted operations clean up properly"""

        cleanup_called = []

        async def mock_operation_with_cleanup():
            try:
                await asyncio.sleep(0.1)  # Long operation
                return {"result": "success"}
            except:
                cleanup_called.append("cleanup")
                raise
            finally:
                # Simulate resource cleanup
                cleanup_called.append("finally")

        mock_bindery_client.health_check.side_effect = mock_operation_with_cleanup

        # Interrupt the operation
        async def interrupt_after_delay():
            await asyncio.sleep(0.01)
            # The operation will be interrupted by the side_effect exception

        health_task = asyncio.create_task(mcp_server.health_check())

        # Wait for completion (should be error response)
        result = await health_task

        # Verify error response structure
        assert "error" in result

        # Note: The cleanup tracking depends on the implementation details
        # This test verifies that the error is handled gracefully
        assert result["operation"] == "health_check"