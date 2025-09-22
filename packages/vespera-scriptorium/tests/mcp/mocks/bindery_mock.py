"""
Mock Bindery service for testing

This module provides a mock implementation of the Rust Bindery backend
for isolated testing of the MCP server without needing the actual service running.
"""

import asyncio
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from unittest.mock import AsyncMock

import httpx


class MockBinderyError(Exception):
    """Mock Bindery service error for testing error conditions"""
    pass


class MockTask:
    """Mock task model matching Bindery backend schema"""

    def __init__(self, title: str, description: str = "", priority: str = "medium"):
        self.id = str(uuid.uuid4())
        self.title = title
        self.description = description
        self.priority = priority
        self.status = "pending"
        self.created_at = datetime.now(timezone.utc).isoformat()
        self.updated_at = self.created_at

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "priority": self.priority,
            "status": self.status,
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }

    def update(self, **kwargs) -> None:
        """Update task fields and timestamp"""
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)
        self.updated_at = datetime.now(timezone.utc).isoformat()


class MockBinderyService:
    """Mock Bindery service that simulates the Rust backend"""

    def __init__(self):
        self.tasks: Dict[str, MockTask] = {}
        self.health_status = "healthy"
        self.should_fail = False
        self.response_delay = 0.0  # Simulate network latency
        self.connection_errors = False
        self.http_errors = False

    def reset(self):
        """Reset mock state for clean tests"""
        self.tasks.clear()
        self.health_status = "healthy"
        self.should_fail = False
        self.response_delay = 0.0
        self.connection_errors = False
        self.http_errors = False

    def simulate_connection_error(self, enabled: bool = True):
        """Simulate connection errors for testing error handling"""
        self.connection_errors = enabled

    def simulate_http_error(self, enabled: bool = True):
        """Simulate HTTP errors for testing error handling"""
        self.http_errors = enabled

    def simulate_slow_response(self, delay_seconds: float = 1.0):
        """Simulate slow responses for testing timeouts"""
        self.response_delay = delay_seconds

    def set_unhealthy(self, unhealthy: bool = True):
        """Simulate unhealthy backend for testing health checks"""
        self.health_status = "unhealthy" if unhealthy else "healthy"

    async def _simulate_delay(self):
        """Simulate network delay if configured"""
        if self.response_delay > 0:
            await asyncio.sleep(self.response_delay)

    async def health_check(self) -> Dict[str, Any]:
        """Mock health check endpoint"""
        await self._simulate_delay()

        if self.connection_errors:
            raise httpx.ConnectError("Simulated connection error")

        if self.http_errors:
            raise httpx.HTTPStatusError(
                "Simulated HTTP error",
                request=None,
                response=httpx.Response(500)
            )

        return {
            "status": self.health_status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "version": "mock-1.0.0",
            "tasks_count": len(self.tasks)
        }

    async def create_task(self, title: str, description: str = "", priority: str = "medium") -> Dict[str, Any]:
        """Mock task creation endpoint"""
        await self._simulate_delay()

        if self.connection_errors:
            raise httpx.ConnectError("Simulated connection error")

        if self.http_errors:
            raise httpx.HTTPStatusError(
                "Simulated HTTP error",
                request=None,
                response=httpx.Response(400)
            )

        # Validate priority
        if priority not in ["low", "medium", "high"]:
            raise httpx.HTTPStatusError(
                "Invalid priority",
                request=None,
                response=httpx.Response(400)
            )

        task = MockTask(title=title, description=description, priority=priority)
        self.tasks[task.id] = task
        return task.to_dict()

    async def get_tasks(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """Mock get tasks endpoint"""
        await self._simulate_delay()

        if self.connection_errors:
            raise httpx.ConnectError("Simulated connection error")

        if self.http_errors:
            raise httpx.HTTPStatusError(
                "Simulated HTTP error",
                request=None,
                response=httpx.Response(500)
            )

        tasks = list(self.tasks.values())

        if status:
            tasks = [task for task in tasks if task.status == status]

        return [task.to_dict() for task in tasks]

    async def update_task(self, task_id: str, **updates) -> Dict[str, Any]:
        """Mock task update endpoint"""
        await self._simulate_delay()

        if self.connection_errors:
            raise httpx.ConnectError("Simulated connection error")

        if self.http_errors:
            raise httpx.HTTPStatusError(
                "Simulated HTTP error",
                request=None,
                response=httpx.Response(500)
            )

        if task_id not in self.tasks:
            raise httpx.HTTPStatusError(
                "Task not found",
                request=None,
                response=httpx.Response(404)
            )

        task = self.tasks[task_id]
        task.update(**updates)
        return task.to_dict()


class MockBinderyClient:
    """Mock version of BinderyClient for testing"""

    def __init__(self, mock_service: MockBinderyService):
        self.mock_service = mock_service
        self._shutdown = False

    async def health_check(self) -> Dict[str, Any]:
        """Mock health check method"""
        if self._shutdown:
            raise MockBinderyError("Client is shutting down")
        return await self.mock_service.health_check()

    async def create_task(self, title: str, description: str = "", priority: str = "medium") -> Dict[str, Any]:
        """Mock create task method"""
        if self._shutdown:
            raise MockBinderyError("Client is shutting down")
        try:
            return await self.mock_service.create_task(title, description, priority)
        except httpx.HTTPStatusError as e:
            raise MockBinderyError(f"Task creation failed: {e}")
        except httpx.ConnectError as e:
            raise MockBinderyError(f"Failed to connect to Bindery: {e}")

    async def get_tasks(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """Mock get tasks method"""
        if self._shutdown:
            raise MockBinderyError("Client is shutting down")
        try:
            return await self.mock_service.get_tasks(status)
        except httpx.HTTPStatusError as e:
            raise MockBinderyError(f"Get tasks failed: {e}")
        except httpx.ConnectError as e:
            raise MockBinderyError(f"Failed to connect to Bindery: {e}")

    async def update_task(self, task_id: str, **updates) -> Dict[str, Any]:
        """Mock update task method"""
        if self._shutdown:
            raise MockBinderyError("Client is shutting down")
        try:
            return await self.mock_service.update_task(task_id, **updates)
        except httpx.HTTPStatusError as e:
            raise MockBinderyError(f"Task update failed: {e}")
        except httpx.ConnectError as e:
            raise MockBinderyError(f"Failed to connect to Bindery: {e}")

    async def close(self):
        """Mock close method"""
        self._shutdown = True


# Global mock service instance for shared testing
_mock_service = MockBinderyService()


def get_mock_service() -> MockBinderyService:
    """Get the global mock service instance"""
    return _mock_service


def get_mock_client() -> MockBinderyClient:
    """Get a new mock client instance"""
    return MockBinderyClient(_mock_service)


async def create_test_tasks(count: int = 5) -> List[Dict[str, Any]]:
    """Create multiple test tasks for testing"""
    mock_service = get_mock_service()
    tasks = []

    priorities = ["low", "medium", "high"]
    statuses = ["pending", "in_progress", "completed"]

    for i in range(count):
        priority = priorities[i % len(priorities)]
        task = await mock_service.create_task(
            title=f"Test Task {i + 1}",
            description=f"Description for test task {i + 1}",
            priority=priority
        )

        # Vary task statuses
        if i % 3 == 1:
            await mock_service.update_task(task["id"], status="in_progress")
        elif i % 3 == 2:
            await mock_service.update_task(task["id"], status="completed")

        updated_task = await mock_service.get_tasks()
        task_data = next(t for t in updated_task if t["id"] == task["id"])
        tasks.append(task_data)

    return tasks