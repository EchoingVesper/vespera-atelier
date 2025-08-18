#!/usr/bin/env python3
"""
Test the FastMCP server tools directly.
"""

import asyncio
import sys
from pathlib import Path

# Add the package to path
sys.path.insert(0, str(Path(__file__).parent))

from mcp_server_v2 import mcp


async def test_fastmcp_tools():
    """Test the FastMCP tools directly."""
    print("🧪 Testing FastMCP Tools")
    print("=" * 40)
    
    # Test creating a task
    print("\n1. Testing create_task...")
    from mcp_server_v2 import TaskCreateInput
    
    task_input = TaskCreateInput(
        title="Test FastMCP Integration",
        description="Testing the FastMCP server implementation",
        project_id="fastmcp-test",
        role="tester",
        priority="high"
    )
    
    result = await mcp.call_tool("create_task", {"task_input": task_input.model_dump()})
    print(f"   Result: {result}")
    
    # Test listing tasks
    print("\n2. Testing list_tasks...")
    result = await mcp.call_tool("list_tasks", {"project_id": "fastmcp-test"})
    print(f"   Result: {result}")
    
    # Test listing roles
    print("\n3. Testing list_roles...")
    result = await mcp.call_tool("list_roles", {})
    # FastMCP returns (content_blocks, metadata) tuple
    content_data = result[1]['result'] if len(result) > 1 else result[0]
    print(f"   Found {len(content_data.get('roles', []))} roles")
    
    print("\n✅ FastMCP Tools Test Complete!")


if __name__ == "__main__":
    asyncio.run(test_fastmcp_tools())