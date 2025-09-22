"""
Test helper utilities for MCP server testing

This module provides utility functions and helper classes to make
testing more convenient and maintainable.
"""

import asyncio
import contextlib
import json
import signal
import time
from typing import Any, AsyncGenerator, Dict, Optional
from unittest.mock import patch, AsyncMock

import pytest
import structlog

from ..mocks.bindery_mock import MockBinderyService, get_mock_service


class AsyncTimeout:
    """Context manager for testing async operations with timeout"""

    def __init__(self, timeout_seconds: float = 5.0):
        self.timeout_seconds = timeout_seconds
        self.task = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.task and not self.task.done():
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass

    async def run(self, coro):
        """Run coroutine with timeout"""
        self.task = asyncio.create_task(coro)
        return await asyncio.wait_for(self.task, timeout=self.timeout_seconds)


class MockMCPServer:
    """Mock MCP server for testing client interactions"""

    def __init__(self):
        self.tools_called = []
        self.responses = {}

    def add_tool_response(self, tool_name: str, response: Any):
        """Add a mock response for a specific tool"""
        self.responses[tool_name] = response

    async def call_tool(self, name: str, arguments: Dict[str, Any]) -> Any:
        """Mock tool call"""
        self.tools_called.append({"name": name, "arguments": arguments})

        if name in self.responses:
            return self.responses[name]

        # Default responses for testing
        if name == "health_check":
            return {"mcp_server": "healthy", "bindery_backend": "healthy"}
        elif name == "create_task":
            return {"id": "test-id", "title": arguments.get("request", {}).get("title", "Test")}

        raise ValueError(f"No mock response for tool: {name}")


@contextlib.asynccontextmanager
async def mock_bindery_service(initial_tasks: Optional[int] = None) -> AsyncGenerator[MockBinderyService, None]:
    """Context manager that provides a clean mock Bindery service"""
    mock_service = get_mock_service()
    mock_service.reset()

    # Pre-populate with test tasks if requested
    if initial_tasks:
        for i in range(initial_tasks):
            await mock_service.create_task(f"Initial Task {i + 1}", f"Description {i + 1}")

    try:
        yield mock_service
    finally:
        mock_service.reset()


@contextlib.asynccontextmanager
async def patch_bindery_client(mock_service: MockBinderyService):
    """Context manager to patch the global Bindery client with mock"""
    from mcp_server import get_bindery_client, bindery_client
    from ..mocks.bindery_mock import MockBinderyClient

    # Create mock client using the provided service
    mock_client = MockBinderyClient(mock_service)

    # Patch the global client getter
    with patch('mcp_server.get_bindery_client', return_value=mock_client), \
         patch('mcp_server.bindery_client', mock_client):
        yield mock_client


def capture_logs():
    """Capture structured logs for testing"""
    captured_logs = []

    def capture_processor(logger, method_name, event_dict):
        captured_logs.append(event_dict)
        return event_dict

    # Add capture processor to structlog
    structlog.configure(
        processors=[
            capture_processor,
            structlog.dev.ConsoleRenderer()
        ]
    )

    return captured_logs


class InterruptionSimulator:
    """Simulate user interruptions for testing graceful handling"""

    def __init__(self):
        self.interruption_delay = 0.1  # Delay before sending interruption
        self.interrupted = False

    async def simulate_sigint(self, target_task: asyncio.Task, delay: float = None):
        """Simulate SIGINT (Ctrl+C) during task execution"""
        if delay is None:
            delay = self.interruption_delay

        await asyncio.sleep(delay)

        # Send SIGINT to the current process
        import os
        os.kill(os.getpid(), signal.SIGINT)
        self.interrupted = True

    async def simulate_cancellation(self, target_task: asyncio.Task, delay: float = None):
        """Simulate task cancellation"""
        if delay is None:
            delay = self.interruption_delay

        await asyncio.sleep(delay)
        target_task.cancel()
        self.interrupted = True

    @contextlib.asynccontextmanager
    async def with_interruption(self, interruption_type: str = "sigint", delay: float = 0.1):
        """Context manager for testing with interruptions"""
        self.interruption_delay = delay
        self.interrupted = False

        if interruption_type == "sigint":
            # Set up signal handler for testing
            original_handler = signal.signal(signal.SIGINT, signal.default_int_handler)

        try:
            yield self
        finally:
            if interruption_type == "sigint":
                # Restore original signal handler
                signal.signal(signal.SIGINT, original_handler)


def measure_performance(func):
    """Decorator to measure function execution time"""
    async def wrapper(*args, **kwargs):
        start_time = time.perf_counter()

        if asyncio.iscoroutinefunction(func):
            result = await func(*args, **kwargs)
        else:
            result = func(*args, **kwargs)

        end_time = time.perf_counter()
        execution_time = end_time - start_time

        # Attach timing info to result if it's a dict
        if isinstance(result, dict):
            result["_execution_time"] = execution_time
        else:
            # Store timing in a global for test assertions
            wrapper.last_execution_time = execution_time

        return result

    wrapper.last_execution_time = 0.0
    return wrapper


async def wait_for_condition(condition_func, timeout: float = 5.0, interval: float = 0.1):
    """Wait for a condition to become true with timeout"""
    start_time = time.time()

    while time.time() - start_time < timeout:
        if await condition_func() if asyncio.iscoroutinefunction(condition_func) else condition_func():
            return True

        await asyncio.sleep(interval)

    return False


class NetworkSimulator:
    """Simulate various network conditions for testing"""

    def __init__(self):
        self.latency = 0.0
        self.packet_loss_rate = 0.0
        self.bandwidth_limit = None

    def set_latency(self, seconds: float):
        """Set network latency simulation"""
        self.latency = seconds

    def set_packet_loss(self, rate: float):
        """Set packet loss rate (0.0 to 1.0)"""
        self.packet_loss_rate = max(0.0, min(1.0, rate))

    async def simulate_network_delay(self):
        """Simulate network latency"""
        if self.latency > 0:
            await asyncio.sleep(self.latency)

    def should_drop_packet(self) -> bool:
        """Determine if packet should be dropped based on loss rate"""
        if self.packet_loss_rate <= 0:
            return False

        import random
        return random.random() < self.packet_loss_rate


# Pytest fixtures for common test utilities

@pytest.fixture
async def mock_service():
    """Fixture providing a clean mock Bindery service"""
    async with mock_bindery_service() as service:
        yield service


@pytest.fixture
async def populated_mock_service():
    """Fixture providing a mock service with test data"""
    async with mock_bindery_service(initial_tasks=5) as service:
        yield service


@pytest.fixture
def interruption_simulator():
    """Fixture providing interruption simulation utilities"""
    return InterruptionSimulator()


@pytest.fixture
def network_simulator():
    """Fixture providing network condition simulation"""
    return NetworkSimulator()


@pytest.fixture
def captured_logs():
    """Fixture for capturing structured logs during tests"""
    return capture_logs()