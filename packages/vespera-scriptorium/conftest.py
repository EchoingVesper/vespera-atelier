"""
Pytest configuration and fixtures for Vespera Scriptorium MCP server tests

This module provides shared pytest fixtures, configuration, and utilities
that are available to all test modules.
"""

import pytest
import asyncio
import os
import tempfile
from unittest.mock import patch, AsyncMock, MagicMock
from typing import Dict, Any, Generator
from pathlib import Path

# Import test utilities and mocks
from tests.mcp.mocks.bindery_mock import MockBinderyService, get_mock_service
from tests.mcp.fixtures.test_helpers import (
    mock_bindery_service,
    InterruptionSimulator,
    NetworkSimulator,
    capture_logs
)

# Configure pytest-asyncio
pytest_plugins = ['pytest_asyncio']


def pytest_configure(config):
    """Configure pytest with custom settings"""
    # Ensure coverage directory exists
    coverage_dir = Path("coverage_html")
    coverage_dir.mkdir(exist_ok=True)

    # Set up test environment variables
    os.environ["VESPERA_TEST_MODE"] = "true"
    os.environ["VESPERA_BINDERY_URL"] = "http://test-backend:3000"


def pytest_collection_modifyitems(config, items):
    """Modify test collection to add markers and organize tests"""

    # Add markers based on test path and name
    for item in items:
        # Add markers based on file path
        if "unit" in str(item.fspath):
            item.add_marker(pytest.mark.unit)
        elif "integration" in str(item.fspath):
            item.add_marker(pytest.mark.integration)

        # Add markers based on test name
        if "mcp" in item.name.lower():
            item.add_marker(pytest.mark.mcp)
        if "interrupt" in item.name.lower():
            item.add_marker(pytest.mark.interruption)
        if "error" in item.name.lower() or "fail" in item.name.lower():
            item.add_marker(pytest.mark.error_handling)
        if "slow" in item.name.lower() or "long" in item.name.lower():
            item.add_marker(pytest.mark.slow)
        if "bindery" in item.name.lower():
            item.add_marker(pytest.mark.bindery)
        if "network" in item.name.lower() or "connection" in item.name.lower():
            item.add_marker(pytest.mark.network)


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for the entire test session"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    yield loop
    loop.close()


@pytest.fixture
def temp_dir():
    """Provide a temporary directory for test files"""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def mock_env_vars():
    """Mock environment variables for testing"""
    test_env = {
        "VESPERA_BINDERY_URL": "http://test-bindery:3000",
        "VESPERA_LOG_LEVEL": "DEBUG",
        "VESPERA_TEST_MODE": "true"
    }

    with patch.dict(os.environ, test_env, clear=False):
        yield test_env


@pytest.fixture
async def clean_mock_bindery():
    """Provide a clean mock Bindery service for each test"""
    async with mock_bindery_service() as service:
        yield service


@pytest.fixture
async def populated_mock_bindery():
    """Provide a mock Bindery service with sample data"""
    async with mock_bindery_service(initial_tasks=5) as service:
        yield service


@pytest.fixture
def mock_bindery_client():
    """Mock the BinderyClient for isolation testing"""
    with patch('mcp_server.BinderyClient') as mock_client_class:
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_client_class.return_value.__aexit__.return_value = None
        yield mock_client


@pytest.fixture
def mock_structlog():
    """Mock structlog for capturing log messages"""
    with patch('structlog.get_logger') as mock_logger:
        logger_instance = MagicMock()
        mock_logger.return_value = logger_instance
        yield logger_instance


@pytest.fixture
def interruption_simulator():
    """Provide interruption simulation utilities"""
    return InterruptionSimulator()


@pytest.fixture
def network_simulator():
    """Provide network simulation utilities"""
    return NetworkSimulator()


@pytest.fixture
def captured_logs():
    """Capture structured logs during tests"""
    return capture_logs()


# Sample data fixtures
@pytest.fixture
def sample_task_data():
    """Sample task data for testing"""
    return {
        "id": "test-task-123",
        "title": "Sample Test Task",
        "description": "This is a sample task for testing purposes",
        "status": "pending",
        "priority": "medium",
        "tags": ["test", "sample"],
        "created_at": "2024-01-15T10:00:00Z",
        "updated_at": "2024-01-15T10:00:00Z",
        "parent_id": None,
        "children": []
    }


@pytest.fixture
def sample_project_data():
    """Sample project data for testing"""
    return {
        "id": "test-project-456",
        "name": "Sample Test Project",
        "description": "This is a sample project for testing purposes",
        "tags": ["test", "sample", "project"],
        "task_count": 3,
        "created_at": "2024-01-15T09:00:00Z",
        "updated_at": "2024-01-15T10:30:00Z"
    }


@pytest.fixture
def sample_search_results():
    """Sample search results for testing"""
    return {
        "query": "test query",
        "total_results": 3,
        "results": [
            {
                "id": "task-1",
                "type": "task",
                "title": "Test Task 1",
                "description": "First test task",
                "relevance_score": 0.95,
                "tags": ["test", "task"]
            },
            {
                "id": "project-1",
                "type": "project",
                "title": "Test Project 1",
                "description": "First test project",
                "relevance_score": 0.87,
                "tags": ["test", "project"]
            },
            {
                "id": "note-1",
                "type": "note",
                "title": "Test Note 1",
                "description": "First test note",
                "relevance_score": 0.72,
                "tags": ["test", "note"]
            }
        ]
    }


@pytest.fixture
def sample_dashboard_stats():
    """Sample dashboard statistics for testing"""
    return {
        "total_tasks": 25,
        "completed_tasks": 10,
        "active_projects": 3,
        "pending_tasks_by_priority": {
            "low": 5,
            "medium": 8,
            "high": 2
        },
        "recent_activity_count": 12
    }


# Error scenarios fixtures
@pytest.fixture
def bindery_error_scenarios():
    """Various BinderyClientError scenarios for testing"""
    from bindery_client import BinderyClientError

    return {
        "not_found": BinderyClientError("Resource not found", status_code=404),
        "bad_request": BinderyClientError(
            "Invalid request data",
            status_code=400,
            details={"field": "title", "message": "Title is required"}
        ),
        "server_error": BinderyClientError("Internal server error", status_code=500),
        "connection_error": BinderyClientError("Connection refused", status_code=None),
        "timeout_error": BinderyClientError("Request timed out after 30 seconds"),
        "auth_error": BinderyClientError("Authentication failed", status_code=401)
    }


@pytest.fixture
def interruption_scenarios():
    """Various interruption scenarios for testing"""
    return {
        "keyboard_interrupt": KeyboardInterrupt("User pressed Ctrl+C"),
        "cancelled_error": asyncio.CancelledError("Operation was cancelled"),
        "system_exit": SystemExit("System shutdown requested"),
        "generic_exception": Exception("Unexpected error occurred"),
        "runtime_error": RuntimeError("Runtime error during operation")
    }


# Parametrized fixtures for comprehensive testing
@pytest.fixture(params=["low", "medium", "high", "urgent"])
def task_priority(request):
    """Parametrized fixture for task priorities"""
    return request.param


@pytest.fixture(params=["pending", "in_progress", "completed", "cancelled"])
def task_status(request):
    """Parametrized fixture for task statuses"""
    return request.param


@pytest.fixture(params=["task", "project", "note"])
def entity_type(request):
    """Parametrized fixture for entity types"""
    return request.param


# Performance testing fixtures
@pytest.fixture
def performance_timer():
    """Fixture for measuring test performance"""
    import time

    times = {}

    def start_timer(name: str):
        times[name] = time.perf_counter()

    def stop_timer(name: str) -> float:
        if name not in times:
            raise ValueError(f"Timer '{name}' was not started")
        return time.perf_counter() - times[name]

    timer = type('Timer', (), {
        'start': start_timer,
        'stop': stop_timer,
        'times': times
    })()

    return timer


# Cleanup fixtures
@pytest.fixture(autouse=True)
def cleanup_after_test():
    """Automatic cleanup after each test"""
    yield
    # Reset any global state if needed
    # Clear caches, reset singletons, etc.
    pass


@pytest.fixture(scope="session", autouse=True)
def cleanup_after_session():
    """Automatic cleanup after test session"""
    yield
    # Clean up session-wide resources
    # Remove temporary files, close connections, etc.

    # Clean up coverage files if they exist
    import shutil
    coverage_dirs = [".coverage", "coverage_html", "htmlcov"]
    for coverage_dir in coverage_dirs:
        if os.path.exists(coverage_dir):
            try:
                if os.path.isdir(coverage_dir):
                    shutil.rmtree(coverage_dir, ignore_errors=True)
                else:
                    os.remove(coverage_dir)
            except:
                pass  # Ignore cleanup errors