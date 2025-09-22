#!/usr/bin/env python3
"""
Test script to verify MCP server can register all 14 tools.

This script verifies that the MCP server can properly register and list
all 14 tools for complete task lifecycle management.
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

try:
    from bindery.tools import BinderyTools, get_tool_definitions
    print("✓ Successfully imported Bindery tools")
except ImportError as e:
    print(f"✗ Import error: {e}")
    sys.exit(1)


async def test_mcp_server_tools():
    """Test MCP server tool definitions and methods."""
    print("Testing MCP tool definitions and method availability...")
    print("=" * 60)

    try:
        # Get tool definitions
        tool_definitions = get_tool_definitions()
        print(f"✓ Retrieved {len(tool_definitions)} tool definitions")

        # Create Bindery tools instance
        bindery_tools = BinderyTools()
        print("✓ Created BinderyTools instance")

        # Verify each tool has corresponding method
        available_tools = []
        for tool_def in tool_definitions:
            tool_name = tool_def.name

            # Check if method exists in BinderyTools
            if hasattr(bindery_tools, tool_name):
                tool_method = getattr(bindery_tools, tool_name)

                # Verify it's callable
                if callable(tool_method):
                    available_tools.append(tool_name)
                    print(f"✓ Tool available: {tool_name}")
                else:
                    print(f"✗ Tool method not callable: {tool_name}")
            else:
                print(f"✗ Method not found for tool: {tool_name}")

        print("\n" + "=" * 60)
        print("TOOL AVAILABILITY SUMMARY")
        print("=" * 60)
        print(f"Total tools defined: {len(tool_definitions)}")
        print(f"Tools available: {len(available_tools)}")
        print(f"Availability rate: {len(available_tools)/len(tool_definitions)*100:.1f}%")

        # Verify we have all 14 tools
        expected_tools = {
            "create_task", "get_task", "update_task", "delete_task", "complete_task",
            "list_tasks", "execute_task", "create_task_tree", "get_task_tree",
            "assign_role_to_task", "list_roles", "search_rag", "index_document",
            "get_task_dashboard"
        }

        available_set = set(available_tools)
        missing_tools = expected_tools - available_set
        extra_tools = available_set - expected_tools

        if len(available_tools) == 14 and len(missing_tools) == 0:
            print("\n✅ SUCCESS: All 14 MCP tools are properly defined and available!")
            print("The complete task lifecycle management toolset is ready.")

            print("\nAvailable tools:")
            for i, tool_name in enumerate(sorted(available_tools), 1):
                print(f"  {i:2d}. {tool_name}")

            # Print tool categories
            print("\nTool Categories:")
            task_mgmt = [t for t in available_tools if t in {"create_task", "get_task", "update_task", "delete_task", "complete_task", "list_tasks", "execute_task"}]
            task_trees = [t for t in available_tools if t in {"create_task_tree", "get_task_tree"}]
            roles = [t for t in available_tools if t in {"assign_role_to_task", "list_roles"}]
            rag = [t for t in available_tools if t in {"search_rag", "index_document"}]
            dashboard = [t for t in available_tools if t in {"get_task_dashboard"}]

            print(f"  • Task Management: {len(task_mgmt)} tools")
            print(f"  • Task Trees: {len(task_trees)} tools")
            print(f"  • Role Management: {len(roles)} tools")
            print(f"  • RAG/Search: {len(rag)} tools")
            print(f"  • Dashboard: {len(dashboard)} tools")

            return True
        else:
            print(f"\n❌ FAILURE: Only {len(available_tools)}/14 tools available")
            if missing_tools:
                print(f"Missing tools: {', '.join(sorted(missing_tools))}")
            if extra_tools:
                print(f"Extra tools: {', '.join(sorted(extra_tools))}")
            return False

    except Exception as e:
        print(f"✗ Error during tool verification: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    # Run test without asyncio since we're just checking definitions
    success = asyncio.run(test_mcp_server_tools())
    sys.exit(0 if success else 1)