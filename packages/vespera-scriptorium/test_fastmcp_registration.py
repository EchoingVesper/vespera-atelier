#!/usr/bin/env python3
"""
Simple test to verify FastMCP tool registration.
This tests that all 14 MCP tools are properly registered with FastMCP.
"""

import asyncio
import sys


async def test_fastmcp_tools():
    """Test that all 14 tools are registered in FastMCP"""
    print("\n" + "="*60)
    print("FASTMCP TOOL REGISTRATION TEST")
    print("="*60)

    # Import the FastMCP instance
    from mcp_server import mcp

    # Get all registered tools
    registered_tools = await mcp.get_tools()

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

    print(f"\nExpected tools: {len(expected_tools)}")
    print(f"Registered tools: {len(registered_tools)}")

    # Check each expected tool
    missing_tools = []
    found_tools = []

    for tool_name in expected_tools:
        if tool_name in registered_tools:
            found_tools.append(tool_name)
            print(f"✅ {tool_name}: REGISTERED")
        else:
            missing_tools.append(tool_name)
            print(f"❌ {tool_name}: MISSING")

    # Check for extra tools
    extra_tools = set(registered_tools.keys()) - set(expected_tools)
    if extra_tools:
        print(f"\n⚠️ Extra tools found: {extra_tools}")

    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"Found: {len(found_tools)}/{len(expected_tools)} tools")

    if missing_tools:
        print(f"Missing tools: {', '.join(missing_tools)}")
        return False
    else:
        print("✅ ALL 14 MCP TOOLS ARE PROPERLY REGISTERED!")

        # Show tool details
        print("\nTool Details:")
        for name, tool in registered_tools.items():
            print(f"\n{name}:")
            print(f"  - Description: {tool.description[:50]}..." if len(tool.description) > 50 else f"  - Description: {tool.description}")
            print(f"  - Enabled: {tool.enabled}")

        return True


if __name__ == "__main__":
    success = asyncio.run(test_fastmcp_tools())
    sys.exit(0 if success else 1)