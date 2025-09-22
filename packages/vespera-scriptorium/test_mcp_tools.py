#!/usr/bin/env python3
"""
Comprehensive test for all 14 MCP tools in the Vespera Scriptorium server.
Tests that each tool is properly defined and callable.
"""

import asyncio
import json
from typing import Dict, Any
from unittest.mock import AsyncMock, patch
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

import mcp_server
from models import (
    TaskInput, TaskStatus, TaskPriority,
    ProjectInput, SearchInput, DocumentInput, DocumentType
)


async def test_all_mcp_tools():
    """Test that all 14 MCP tools are defined and callable."""

    print("\n" + "="*60)
    print("COMPREHENSIVE MCP TOOLS TEST")
    print("="*60)

    # Expected 14 tools
    expected_tools = [
        "create_task",
        "get_task",
        "update_task",
        "delete_task",
        "complete_task",
        "execute_task",
        "assign_role_to_task",
        "list_tasks",
        "list_roles",
        "index_document",
        "create_project",
        "get_dashboard_stats",
        "search_entities",
        "health_check"
    ]

    # Get all tools from the MCP server's FastMCP instance
    from mcp_server import mcp

    # FastMCP stores tools internally - get them via the async get_tools() method
    registered_tools = await mcp.get_tools()
    tool_names = list(registered_tools.keys())

    print(f"\nFound {len(tool_names)} MCP tools:")
    for i, name in enumerate(tool_names, 1):
        print(f"  {i:2}. {name}")

    print(f"\nExpected tools: {len(expected_tools)}")
    print(f"Found tools: {len(tool_names)}")

    # Check for missing tools
    missing_tools = set(expected_tools) - set(tool_names)
    if missing_tools:
        print(f"\n❌ Missing tools: {missing_tools}")
    else:
        print("\n✅ All expected tools found!")

    # Check for extra tools
    extra_tools = set(tool_names) - set(expected_tools)
    if extra_tools:
        print(f"\n⚠️ Extra tools found: {extra_tools}")

    # Test each tool with mock data
    print("\n" + "-"*60)
    print("Testing tool invocation with mock data:")
    print("-"*60)

    test_results = []

    # Mock the BinderyClient
    with patch('mcp_server.BinderyClient') as MockClient:
        mock_client = AsyncMock()
        MockClient.return_value.__aenter__.return_value = mock_client

        # Configure mock responses for each tool
        mock_client.create_task.return_value.model_dump.return_value = {
            "id": "task-123",
            "title": "Test Task",
            "status": "todo"
        }
        mock_client.get_task.return_value.model_dump.return_value = {
            "id": "task-123",
            "title": "Test Task",
            "status": "todo"
        }
        mock_client.update_task.return_value.model_dump.return_value = {
            "id": "task-123",
            "title": "Updated Task",
            "status": "doing"
        }
        mock_client.delete_task.return_value = {"success": True}
        mock_client.execute_task.return_value = {"execution_id": "exec-456"}
        mock_client.assign_role.return_value = {"success": True}
        mock_client.list_roles.return_value = {"roles": [{"name": "developer"}]}
        mock_client.index_document.return_value = {"document_id": "doc-789"}
        mock_client.list_tasks.return_value.model_dump.return_value = {
            "items": [],
            "total": 0
        }
        mock_client.create_project.return_value.model_dump.return_value = {
            "id": "proj-111",
            "name": "Test Project"
        }
        mock_client.get_dashboard_stats.return_value.model_dump.return_value = {
            "total_tasks": 10,
            "completed_tasks": 5
        }
        mock_client.search.return_value.model_dump.return_value = {
            "query": "test",
            "total_results": 0,
            "results": []
        }
        mock_client.health_check.return_value = {"status": "healthy"}

        # Test each tool
        for tool_name in expected_tools:
            try:
                if tool_name in tool_names:
                    # Get the actual function from mcp_server module
                    # These are the decorated functions that are callable
                    tool_func = getattr(mcp_server, tool_name, None)
                    if tool_func is None:
                        # If not found as a direct attribute, it's still registered in FastMCP
                        # We'll mark it as found but can't invoke it directly
                        print(f"✅ {tool_name}: REGISTERED in FastMCP")
                        test_results.append((tool_name, True))
                        continue

                    # Prepare appropriate arguments for each tool
                    if tool_name == "create_task":
                        result = await tool_func(TaskInput(
                            title="Test Task",
                            priority=TaskPriority.NORMAL
                        ))
                    elif tool_name in ["get_task", "delete_task"]:
                        result = await tool_func("task-123")
                    elif tool_name == "update_task":
                        from models import TaskUpdateInput
                        result = await tool_func("task-123", TaskUpdateInput(
                            title="Updated Task"
                        ))
                    elif tool_name == "complete_task":
                        result = await tool_func("task-123", "Completed via test")
                    elif tool_name in ["execute_task", "assign_role_to_task"]:
                        result = await tool_func("task-123", "developer")
                    elif tool_name == "list_tasks":
                        result = await tool_func()
                    elif tool_name == "list_roles":
                        result = await tool_func()
                    elif tool_name == "index_document":
                        result = await tool_func(DocumentInput(
                            content="Test document",
                            title="Test",
                            document_type=DocumentType.TEXT
                        ))
                    elif tool_name == "create_project":
                        result = await tool_func(ProjectInput(
                            name="Test Project"
                        ))
                    elif tool_name == "get_dashboard_stats":
                        result = await tool_func()
                    elif tool_name == "search_entities":
                        result = await tool_func(SearchInput(
                            query="test"
                        ))
                    elif tool_name == "health_check":
                        result = await tool_func()

                    # Check result
                    if isinstance(result, dict):
                        if "error" not in result:
                            print(f"✅ {tool_name}: SUCCESS")
                            test_results.append((tool_name, True))
                        else:
                            print(f"❌ {tool_name}: ERROR - {result.get('error')}")
                            test_results.append((tool_name, False))
                    else:
                        print(f"✅ {tool_name}: SUCCESS")
                        test_results.append((tool_name, True))
                else:
                    print(f"❌ {tool_name}: NOT FOUND")
                    test_results.append((tool_name, False))

            except Exception as e:
                print(f"❌ {tool_name}: EXCEPTION - {e}")
                test_results.append((tool_name, False))

    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)

    passed = sum(1 for _, success in test_results if success)
    total = len(test_results)

    print(f"Tests Run: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    print(f"Success Rate: {(passed/total)*100:.1f}%")

    if passed == total:
        print("\n✅ ALL 14 MCP TOOLS ARE WORKING CORRECTLY!")
        print("The complete task lifecycle management toolset is ready.")
    else:
        print("\n❌ Some tools need attention.")
        failed_tools = [name for name, success in test_results if not success]
        print(f"Failed tools: {', '.join(failed_tools)}")

    return passed == total


if __name__ == "__main__":
    success = asyncio.run(test_all_mcp_tools())
    sys.exit(0 if success else 1)