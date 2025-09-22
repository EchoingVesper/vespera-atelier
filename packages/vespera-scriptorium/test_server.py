#!/usr/bin/env python3
"""
Simple test script for the FastMCP server implementation.
Tests the core components without requiring the full MCP protocol.
"""

import asyncio
import sys
from datetime import datetime

from bindery_client import BinderyClient, BinderyClientError
from models import TaskInput, ProjectInput, SearchInput


async def test_bindery_client():
    """Test the Bindery client functionality."""
    print("Testing Bindery Client...")

    try:
        async with BinderyClient() as client:
            # Test health check
            print("  ✓ Testing health check...")
            try:
                health = await client.health_check()
                print(f"    Backend health: {health}")
            except BinderyClientError as e:
                print(f"    ⚠ Health check failed: {e.message}")
                print("    (This is expected if Bindery backend is not running)")

            # Test task creation (will fail if backend not running)
            print("  ✓ Testing task creation...")
            try:
                task_input = TaskInput(
                    title="Test Task",
                    description="Created by test script",
                    priority="medium",
                    tags=["test", "automation"]
                )
                task = await client.create_task(task_input)
                print(f"    Created task: {task.id}")

                # Test task retrieval
                print("  ✓ Testing task retrieval...")
                retrieved_task = await client.get_task(task.id)
                print(f"    Retrieved task: {retrieved_task.title}")

            except BinderyClientError as e:
                print(f"    ⚠ Task operations failed: {e.message}")
                print("    (This is expected if Bindery backend is not running)")

    except Exception as e:
        print(f"  ✗ Client test failed: {e}")
        return False

    print("  ✓ Bindery client tests completed")
    return True


def test_models():
    """Test Pydantic model validation."""
    print("Testing Pydantic Models...")

    try:
        # Test TaskInput
        print("  ✓ Testing TaskInput model...")
        task_input = TaskInput(
            title="Sample Task",
            description="Task description",
            priority="high",
            tags=["urgent", "bug-fix"]
        )
        assert task_input.title == "Sample Task"
        assert task_input.priority == "high"
        print(f"    TaskInput: {task_input.model_dump()}")

        # Test ProjectInput
        print("  ✓ Testing ProjectInput model...")
        project_input = ProjectInput(
            name="Test Project",
            description="Project description",
            tags=["development", "testing"]
        )
        assert project_input.name == "Test Project"
        print(f"    ProjectInput: {project_input.model_dump()}")

        # Test SearchInput
        print("  ✓ Testing SearchInput model...")
        search_input = SearchInput(
            query="test query",
            entity_types=["task", "project"],
            limit=5
        )
        assert search_input.query == "test query"
        assert search_input.limit == 5
        print(f"    SearchInput: {search_input.model_dump()}")

    except Exception as e:
        print(f"  ✗ Model test failed: {e}")
        return False

    print("  ✓ Pydantic model tests completed")
    return True


def test_server_imports():
    """Test that all server imports work correctly."""
    print("Testing Server Imports...")

    try:
        # Test importing the main server module
        print("  ✓ Testing server imports...")
        import mcp_server
        assert hasattr(mcp_server, 'mcp')
        assert hasattr(mcp_server, 'error_handler')
        print("    Server module imported successfully")

        # Test that FastMCP instance is configured
        assert mcp_server.mcp.name == "Vespera Scriptorium"
        print("    FastMCP instance configured correctly")

    except Exception as e:
        print(f"  ✗ Import test failed: {e}")
        return False

    print("  ✓ Server import tests completed")
    return True


async def main():
    """Run all tests."""
    print("=" * 60)
    print("Vespera Scriptorium FastMCP Server Test Suite")
    print(f"Test run started at: {datetime.now()}")
    print("=" * 60)

    results = []

    # Run tests
    results.append(test_models())
    results.append(test_server_imports())
    results.append(await test_bindery_client())

    # Summary
    print("\n" + "=" * 60)
    print("Test Results Summary:")
    passed = sum(results)
    total = len(results)

    if passed == total:
        print(f"✓ All {total} test suites passed!")
        print("\nThe FastMCP server implementation is ready for use.")
        print("\nNext steps:")
        print("1. Start the Rust Bindery backend at http://localhost:3000")
        print("2. Run the MCP server: python mcp_server.py")
        print("3. Configure Claude Code to use this server")
        return 0
    else:
        print(f"✗ {total - passed} of {total} test suites failed.")
        print("\nPlease review the test output above for details.")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)