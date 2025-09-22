"""
Test fixtures and data for MCP server testing

This module provides reusable test data, fixtures, and utilities
for consistent testing across the MCP server test suite.
"""

import pytest
from datetime import datetime, timezone
from typing import Dict, Any, List

# Test task data
VALID_TASK_DATA = {
    "basic": {
        "title": "Basic Test Task",
        "description": "A basic test task for validation",
        "priority": "medium"
    },
    "minimal": {
        "title": "Minimal Task",
        "description": "",
        "priority": "low"
    },
    "complex": {
        "title": "Complex Project Task",
        "description": "This is a more complex task with detailed requirements and specifications",
        "priority": "high"
    }
}

# Invalid task data for testing validation
INVALID_TASK_DATA = {
    "empty_title": {
        "title": "",
        "description": "Task with empty title",
        "priority": "medium"
    },
    "invalid_priority": {
        "title": "Invalid Priority Task",
        "description": "Task with invalid priority",
        "priority": "critical"  # Not in [low, medium, high]
    },
    "missing_title": {
        "description": "Task missing title field",
        "priority": "low"
    }
}

# Task update scenarios
TASK_UPDATE_SCENARIOS = {
    "status_change": {"status": "in_progress"},
    "priority_change": {"priority": "high"},
    "description_update": {"description": "Updated description"},
    "multiple_fields": {
        "status": "completed",
        "priority": "low",
        "description": "Task completed successfully"
    }
}

# Health check response templates
HEALTH_RESPONSES = {
    "healthy": {
        "mcp_server": "healthy",
        "bindery_backend": {
            "status": "healthy",
            "timestamp": "2024-01-01T00:00:00Z",
            "version": "1.0.0",
            "tasks_count": 0
        },
        "timestamp": 1640995200.0
    },
    "backend_unhealthy": {
        "mcp_server": "healthy",
        "bindery_backend": "unhealthy",
        "error": "Failed to connect to Bindery: Connection refused",
        "timestamp": 1640995200.0
    }
}

# MCP protocol test data
MCP_PROTOCOL_DATA = {
    "valid_requests": [
        {
            "jsonrpc": "2.0",
            "id": "1",
            "method": "tools/call",
            "params": {
                "name": "health_check",
                "arguments": {}
            }
        },
        {
            "jsonrpc": "2.0",
            "id": "2",
            "method": "tools/call",
            "params": {
                "name": "create_task",
                "arguments": {
                    "request": {
                        "title": "MCP Test Task",
                        "description": "Task created via MCP protocol",
                        "priority": "medium"
                    }
                }
            }
        }
    ],
    "invalid_requests": [
        {
            # Missing jsonrpc version
            "id": "1",
            "method": "tools/call",
            "params": {"name": "health_check", "arguments": {}}
        },
        {
            # Invalid method name
            "jsonrpc": "2.0",
            "id": "2",
            "method": "invalid_method",
            "params": {"name": "health_check", "arguments": {}}
        }
    ]
}

# Error simulation scenarios
ERROR_SCENARIOS = {
    "connection_timeout": {
        "error_type": "connection_error",
        "delay": 35.0,  # Exceeds 30s timeout
        "description": "Simulates connection timeout"
    },
    "backend_500": {
        "error_type": "http_error",
        "status_code": 500,
        "description": "Simulates backend internal server error"
    },
    "backend_404": {
        "error_type": "http_error",
        "status_code": 404,
        "description": "Simulates resource not found"
    },
    "slow_response": {
        "error_type": "slow_response",
        "delay": 2.0,
        "description": "Simulates slow backend response"
    }
}

# Interrupted by user test scenarios
INTERRUPTION_SCENARIOS = {
    "during_task_creation": {
        "operation": "create_task",
        "interrupt_timing": "during_request",
        "expected_behavior": "graceful_cancellation"
    },
    "during_health_check": {
        "operation": "health_check",
        "interrupt_timing": "during_request",
        "expected_behavior": "immediate_response"
    },
    "during_bulk_operations": {
        "operation": "get_tasks",
        "interrupt_timing": "after_partial_response",
        "expected_behavior": "partial_results_returned"
    }
}


@pytest.fixture
def basic_task_data():
    """Fixture providing basic valid task data"""
    return VALID_TASK_DATA["basic"].copy()


@pytest.fixture
def invalid_task_data():
    """Fixture providing invalid task data for validation testing"""
    return INVALID_TASK_DATA.copy()


@pytest.fixture
def task_update_scenarios():
    """Fixture providing task update test scenarios"""
    return TASK_UPDATE_SCENARIOS.copy()


@pytest.fixture
def mcp_protocol_requests():
    """Fixture providing MCP protocol test requests"""
    return MCP_PROTOCOL_DATA.copy()


@pytest.fixture
def error_scenarios():
    """Fixture providing error simulation scenarios"""
    return ERROR_SCENARIOS.copy()


@pytest.fixture
def interruption_scenarios():
    """Fixture providing interruption test scenarios"""
    return INTERRUPTION_SCENARIOS.copy()


def generate_task_batch(count: int, prefix: str = "Batch Task") -> List[Dict[str, Any]]:
    """Generate a batch of test tasks"""
    tasks = []
    priorities = ["low", "medium", "high"]

    for i in range(count):
        tasks.append({
            "title": f"{prefix} {i + 1}",
            "description": f"Generated test task {i + 1} for batch operations",
            "priority": priorities[i % len(priorities)]
        })

    return tasks


def create_mock_response(status_code: int = 200, data: Any = None, error: str = None) -> Dict[str, Any]:
    """Create a mock HTTP response for testing"""
    response = {
        "status_code": status_code,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

    if data is not None:
        response["data"] = data

    if error is not None:
        response["error"] = error

    return response


def validate_task_structure(task_data: Dict[str, Any]) -> bool:
    """Validate that task data has the expected structure"""
    required_fields = ["id", "title", "description", "priority", "status", "created_at", "updated_at"]

    return all(field in task_data for field in required_fields)


def validate_mcp_response(response: Dict[str, Any]) -> bool:
    """Validate MCP JSON-RPC 2.0 response structure"""
    if "jsonrpc" not in response or response["jsonrpc"] != "2.0":
        return False

    if "id" not in response:
        return False

    # Must have either 'result' or 'error', but not both
    has_result = "result" in response
    has_error = "error" in response

    return has_result != has_error  # XOR - exactly one should be true