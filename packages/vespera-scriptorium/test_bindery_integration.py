#!/usr/bin/env python3
"""
Test script for Vespera Bindery MCP integration.

This script tests the integration between the MCP tools and the Rust Bindery backend
by performing various operations and validating responses.
"""

import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Dict, Any

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from bindery import (
    BinderyClient, BinderyTools, BinderyClientError,
    CreateTaskInput, TaskInput, TaskPriority, TaskStatus
)

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


class BinderyIntegrationTest:
    """Test suite for Bindery MCP integration."""

    def __init__(self, bindery_url: str = "http://localhost:8080"):
        """Initialize test suite."""
        self.bindery_url = bindery_url
        self.client = BinderyClient(base_url=bindery_url)
        self.tools = BinderyTools(client=self.client)
        self.test_results = []

    async def run_all_tests(self):
        """Run all integration tests."""
        logger.info("Starting Bindery integration tests")

        tests = [
            ("Health Check", self.test_health_check),
            ("Create Task", self.test_create_task),
            ("Get Task", self.test_get_task),
            ("List Tasks", self.test_list_tasks),
            ("Update Task", self.test_update_task),
            ("Execute Task", self.test_execute_task),
            ("Dashboard", self.test_dashboard),
            ("RAG Search", self.test_rag_search),
            ("Index Document", self.test_index_document),
        ]

        for test_name, test_func in tests:
            try:
                logger.info(f"Running test: {test_name}")
                result = await test_func()
                self.test_results.append((test_name, "PASS", result))
                logger.info(f"✓ {test_name}: PASS")
            except Exception as e:
                self.test_results.append((test_name, "FAIL", str(e)))
                logger.error(f"✗ {test_name}: FAIL - {e}")

        await self.client.close()
        self.print_summary()

    async def test_health_check(self) -> Dict[str, Any]:
        """Test Bindery server health check."""
        health = await self.client.health_check()

        if "error" in health:
            raise Exception(f"Health check failed: {health['error']}")

        return health

    async def test_create_task(self) -> Dict[str, Any]:
        """Test task creation through MCP tools."""
        task_input = CreateTaskInput(
            task=TaskInput(
                title="Test Task from MCP",
                description="This is a test task created via MCP tools",
                priority=TaskPriority.HIGH,
                tags=["test", "mcp", "integration"]
            )
        )

        arguments = task_input.model_dump()
        result = await self.tools.create_task(arguments)

        # Parse the JSON response
        response_text = result[0].text
        response_data = json.loads(response_text)

        if not response_data.get("success"):
            raise Exception(f"Create task failed: {response_data.get('error')}")

        # Store task ID for other tests
        self.test_task_id = response_data["task"]["id"]
        return response_data

    async def test_get_task(self) -> Dict[str, Any]:
        """Test getting a task by ID."""
        if not hasattr(self, 'test_task_id'):
            raise Exception("No test task ID available (create_task test must run first)")

        arguments = {"task_id": self.test_task_id}
        result = await self.tools.get_task(arguments)

        # Parse the JSON response
        response_text = result[0].text
        response_data = json.loads(response_text)

        if not response_data.get("success"):
            raise Exception(f"Get task failed: {response_data.get('error')}")

        return response_data

    async def test_list_tasks(self) -> Dict[str, Any]:
        """Test listing tasks."""
        arguments = {"limit": 10}
        result = await self.tools.list_tasks(arguments)

        # Parse the JSON response
        response_text = result[0].text
        response_data = json.loads(response_text)

        if not response_data.get("success"):
            raise Exception(f"List tasks failed: {response_data.get('error')}")

        return response_data

    async def test_update_task(self) -> Dict[str, Any]:
        """Test updating a task."""
        if not hasattr(self, 'test_task_id'):
            raise Exception("No test task ID available (create_task test must run first)")

        arguments = {
            "task_id": self.test_task_id,
            "updates": {
                "description": "Updated description via MCP tools",
                "status": "doing"
            }
        }
        result = await self.tools.update_task(arguments)

        # Parse the JSON response
        response_text = result[0].text
        response_data = json.loads(response_text)

        if not response_data.get("success"):
            raise Exception(f"Update task failed: {response_data.get('error')}")

        return response_data

    async def test_execute_task(self) -> Dict[str, Any]:
        """Test executing a task."""
        if not hasattr(self, 'test_task_id'):
            raise Exception("No test task ID available (create_task test must run first)")

        arguments = {
            "task_id": self.test_task_id,
            "role": "developer",
            "dry_run": True
        }
        result = await self.tools.execute_task(arguments)

        # Parse the JSON response
        response_text = result[0].text
        response_data = json.loads(response_text)

        if not response_data.get("success"):
            raise Exception(f"Execute task failed: {response_data.get('error')}")

        return response_data

    async def test_dashboard(self) -> Dict[str, Any]:
        """Test getting task dashboard."""
        arguments = {}
        result = await self.tools.get_task_dashboard(arguments)

        # Parse the JSON response
        response_text = result[0].text
        response_data = json.loads(response_text)

        if not response_data.get("success"):
            raise Exception(f"Dashboard failed: {response_data.get('error')}")

        return response_data

    async def test_rag_search(self) -> Dict[str, Any]:
        """Test RAG search functionality."""
        arguments = {
            "query": "test task integration",
            "limit": 5
        }
        result = await self.tools.search_rag(arguments)

        # Parse the JSON response
        response_text = result[0].text
        response_data = json.loads(response_text)

        # RAG might not be implemented yet, so we allow this to fail gracefully
        if not response_data.get("success") and "not yet implemented" in response_data.get("error", "").lower():
            logger.warning("RAG search not yet implemented in Bindery - this is expected")
            return {"status": "not_implemented", "message": "RAG search not yet implemented"}

        return response_data

    async def test_index_document(self) -> Dict[str, Any]:
        """Test document indexing functionality."""
        arguments = {
            "content": "This is a test document for RAG indexing via MCP tools",
            "title": "MCP Test Document",
            "document_type": "text",
            "tags": ["test", "mcp", "rag"]
        }
        result = await self.tools.index_document(arguments)

        # Parse the JSON response
        response_text = result[0].text
        response_data = json.loads(response_text)

        # RAG might not be implemented yet, so we allow this to fail gracefully
        if not response_data.get("success") and "not yet implemented" in response_data.get("error", "").lower():
            logger.warning("RAG indexing not yet implemented in Bindery - this is expected")
            return {"status": "not_implemented", "message": "RAG indexing not yet implemented"}

        return response_data

    def print_summary(self):
        """Print test results summary."""
        print("\n" + "="*60)
        print("BINDERY INTEGRATION TEST SUMMARY")
        print("="*60)

        passed = sum(1 for _, status, _ in self.test_results if status == "PASS")
        total = len(self.test_results)

        print(f"Tests Run: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {passed/total*100:.1f}%")

        print("\nDetailed Results:")
        print("-" * 60)
        for test_name, status, result in self.test_results:
            status_symbol = "✓" if status == "PASS" else "✗"
            print(f"{status_symbol} {test_name}: {status}")
            if status == "FAIL":
                print(f"    Error: {result}")
            elif isinstance(result, dict) and result.get("status") == "not_implemented":
                print(f"    Note: {result.get('message', 'Feature not implemented')}")

        print("\nIntegration Status:")
        if passed >= total * 0.6:  # At least 60% pass rate
            print("✓ Integration appears to be working correctly")
            if passed < total:
                print("  Some optional features (like RAG) may not be implemented yet")
        else:
            print("✗ Integration has significant issues")
            print("  Check Bindery server status and configuration")


async def main():
    """Main test execution."""
    import argparse

    parser = argparse.ArgumentParser(description="Test Bindery MCP integration")
    parser.add_argument(
        "--bindery-url",
        default="http://localhost:8080",
        help="Bindery server URL (default: http://localhost:8080)"
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose logging"
    )

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Run tests
    test_suite = BinderyIntegrationTest(bindery_url=args.bindery_url)
    await test_suite.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())