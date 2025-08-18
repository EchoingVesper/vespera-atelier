#!/usr/bin/env python3
"""
Test script for the V2 MCP Task Management Server

Tests the MCP server integration for the new hierarchical task management system.
"""

import sys
import asyncio
import json
from pathlib import Path
from typing import Dict, Any

# Add the package to path for testing
sys.path.insert(0, str(Path(__file__).parent))

from mcp_task_server import VesperaTaskMCPServer


async def test_mcp_server():
    """Test the MCP server functionality."""
    print("🧪 Testing Vespera V2 MCP Task Server")
    print("=" * 60)
    
    # Initialize server
    print("\n1. Initializing MCP Server...")
    server = VesperaTaskMCPServer()
    print(f"   ✓ Server initialized with data directory: {server.v2_data_dir}")
    
    # Test task creation
    print("\n2. Testing Task Creation...")
    result = await server.manage_task(
        action="create",
        title="Test MCP Integration",
        description="Verify MCP server functionality",
        project_id="mcp-test",
        feature="testing",
        role="tester",
        priority="high"
    )
    
    if result.get("success"):
        created_task = result["task"]
        task_id = created_task["id"]
        print(f"   ✓ Created task: {created_task['title']}")
        print(f"   ✓ Task ID: {task_id}")
    else:
        print(f"   ✗ Failed to create task: {result}")
        return False
    
    # Test task tree creation
    print("\n3. Testing Task Tree Creation...")
    tree_result = await server.manage_task(
        action="create",
        title="Build Feature X",
        description="Complete feature implementation",
        project_id="mcp-test",
        subtasks=[
            {
                "title": "Design architecture",
                "description": "Create system design",
                "role": "architect",
                "priority": "high",
                "order": 1
            },
            {
                "title": "Implement backend",
                "description": "Code the backend services",
                "role": "coder",
                "priority": "normal",
                "order": 2
            },
            {
                "title": "Write tests",
                "description": "Create test suite",
                "role": "tester",
                "priority": "normal",
                "order": 3
            }
        ]
    )
    
    if tree_result.get("success"):
        root_task = tree_result["root_task"]
        print(f"   ✓ Created task tree: {root_task['title']}")
        print(f"   ✓ Total tasks created: {tree_result['total_created']}")
        root_task_id = root_task["id"]
    else:
        print(f"   ✗ Failed to create task tree: {tree_result}")
        return False
    
    # Test task listing
    print("\n4. Testing Task Listing...")
    list_result = await server.manage_task(
        action="list",
        project_id="mcp-test",
        limit=10
    )
    
    if list_result.get("success"):
        print(f"   ✓ Found {list_result['count']} tasks")
        for task in list_result["tasks"][:3]:  # Show first 3
            role = task["execution"]["assigned_role"] or "unassigned"
            print(f"      - {task['title']} ({task['status']}) → {role}")
    else:
        print(f"   ✗ Failed to list tasks: {list_result}")
    
    # Test getting specific task
    print("\n5. Testing Get Task...")
    get_result = await server.manage_task(
        action="get",
        task_id=task_id
    )
    
    if get_result.get("success"):
        task_data = get_result["task"]
        print(f"   ✓ Retrieved task: {task_data['title']}")
        print(f"      - Status: {task_data['status']}")
        print(f"      - Priority: {task_data['priority']}")
        print(f"      - Role: {task_data['execution']['assigned_role']}")
    else:
        print(f"   ✗ Failed to get task: {get_result}")
    
    # Test task update
    print("\n6. Testing Task Update...")
    update_result = await server.manage_task(
        action="update",
        task_id=task_id,
        title="Updated Test Task",
        status="doing",
        priority="critical"
    )
    
    if update_result.get("success"):
        updated_task = update_result["task"]
        print(f"   ✓ Updated task: {updated_task['title']}")
        print(f"      - New status: {updated_task['status']}")
        print(f"      - New priority: {updated_task['priority']}")
    else:
        print(f"   ✗ Failed to update task: {update_result}")
    
    # Test role assignment
    print("\n7. Testing Role Assignment...")
    assign_result = await server.manage_task(
        action="assign_role",
        task_id=task_id,
        role="reviewer"
    )
    
    if assign_result.get("success"):
        print(f"   ✓ Assigned role 'reviewer' to task")
    else:
        print(f"   ✗ Failed to assign role: {assign_result}")
    
    # Test dependency addition
    print("\n8. Testing Dependency Management...")
    # Create another task to depend on
    dep_task_result = await server.manage_task(
        action="create",
        title="Prerequisite Task",
        description="This must be completed first",
        project_id="mcp-test",
        role="architect"
    )
    
    if dep_task_result.get("success"):
        dep_task_id = dep_task_result["task"]["id"]
        
        # Add dependency
        dep_result = await server.manage_task(
            action="add_dependency",
            task_id=task_id,
            filter_value=dep_task_id  # Using filter_value as target_id
        )
        
        if dep_result.get("success"):
            print(f"   ✓ Added dependency: task depends on prerequisite")
        else:
            print(f"   ✗ Failed to add dependency: {dep_result}")
    
    # Test dependency analysis
    print("\n9. Testing Dependency Analysis...")
    analysis_result = await server.manage_task(
        action="analyze",
        task_id=task_id
    )
    
    if analysis_result.get("success"):
        analysis = analysis_result["analysis"]
        print(f"   ✓ Analyzed task: {analysis['task_title']}")
        print(f"      - Depends on: {len(analysis['depends_on'])} tasks")
        print(f"      - Blocks: {len(analysis['blocks'])} tasks")
        if analysis["issues"]:
            print(f"      - Issues: {', '.join(analysis['issues'])}")
    else:
        print(f"   ✗ Failed to analyze dependencies: {analysis_result}")
    
    # Test task execution (dry run)
    print("\n10. Testing Task Execution (Dry Run)...")
    exec_result = await server.manage_task(
        action="execute",
        task_id=task_id,
        dry_run=True
    )
    
    if exec_result.get("success"):
        exec_data = exec_result["execution_result"]
        print(f"   ✓ Dry run execution:")
        print(f"      - Status: {exec_data['status']}")
        print(f"      - Role used: {exec_data['role_used']}")
        print(f"      - Execution time: {exec_data['execution_time']:.3f}s")
    else:
        print(f"   ✗ Execution result: {exec_result.get('error', 'Unknown error')}")
    
    # Test task completion
    print("\n11. Testing Task Completion...")
    complete_result = await server.manage_task(
        action="complete",
        task_id=task_id,
        output="Task completed successfully via MCP",
        artifacts=["test_output.txt", "results.json"]
    )
    
    if complete_result.get("success"):
        completed_task = complete_result["task"]
        print(f"   ✓ Completed task: {completed_task['title']}")
        print(f"      - Status: {completed_task['status']}")
        print(f"      - Unblocked tasks: {len(complete_result['unblocked_tasks'])}")
    else:
        print(f"   ✗ Failed to complete task: {complete_result}")
    
    # Test dashboard
    print("\n12. Testing Dashboard...")
    dashboard_result = await server.manage_task(
        action="dashboard",
        project_id="mcp-test"
    )
    
    if dashboard_result.get("success"):
        dashboard = dashboard_result["dashboard"]
        stats = dashboard["statistics"]
        print(f"   ✓ Dashboard Statistics:")
        print(f"      - Total tasks: {stats['total']}")
        print(f"      - By status: {stats['by_status']}")
        print(f"      - Completion rate: {stats['completion_rate']}%")
        
        if dashboard.get("recommendations"):
            print(f"   ✓ Recommendations:")
            for rec in dashboard["recommendations"]:
                print(f"      - {rec}")
    else:
        print(f"   ✗ Failed to get dashboard: {dashboard_result}")
    
    # Test task tree
    print("\n13. Testing Task Tree...")
    tree_result = await server.manage_task(
        action="tree",
        task_id=root_task_id
    )
    
    if tree_result.get("success"):
        tree = tree_result["tree"]
        print(f"   ✓ Task tree for: {tree['title']}")
        print(f"      - Status: {tree['status']}")
        print(f"      - Children: {len(tree.get('children', []))}")
        for child in tree.get("children", []):
            role = child["execution"]["assigned_role"] or "unassigned"
            print(f"        └─ {child['title']} → {role}")
    else:
        print(f"   ✗ Failed to get task tree: {tree_result}")
    
    # Test filtering by status
    print("\n14. Testing Status Filtering...")
    todo_result = await server.manage_task(
        action="list",
        filter_by="status",
        filter_value="todo",
        project_id="mcp-test"
    )
    
    if todo_result.get("success"):
        print(f"   ✓ Found {todo_result['count']} TODO tasks")
    
    # Test cleanup (delete test task)
    print("\n15. Testing Task Deletion...")
    delete_result = await server.manage_task(
        action="delete",
        task_id=task_id
    )
    
    if delete_result.get("success"):
        print(f"   ✓ Deleted task and {len(delete_result['deleted_tasks'])} total tasks")
    else:
        print(f"   ✗ Failed to delete task: {delete_result}")
    
    print("\n" + "=" * 60)
    print("✅ MCP Server Test Complete!")
    
    return True


async def test_error_handling():
    """Test error handling in the MCP server."""
    print("\n🔬 Testing Error Handling")
    print("=" * 50)
    
    server = VesperaTaskMCPServer()
    
    # Test invalid action
    print("\n1. Testing Invalid Action...")
    result = await server.manage_task(action="invalid_action")
    if "error" in result:
        print(f"   ✓ Correctly handled invalid action: {result['error']}")
    
    # Test missing required parameters
    print("\n2. Testing Missing Parameters...")
    result = await server.manage_task(action="get")  # Missing task_id
    if "error" in result:
        print(f"   ✓ Correctly handled missing parameter: {result['error']}")
    
    # Test non-existent task
    print("\n3. Testing Non-existent Task...")
    result = await server.manage_task(
        action="get",
        task_id="non-existent-task-id"
    )
    if not result.get("success"):
        print(f"   ✓ Correctly handled non-existent task: {result.get('error', 'Task not found')}")
    
    # Test invalid status value
    print("\n4. Testing Invalid Status Value...")
    result = await server.manage_task(
        action="create",
        title="Test Task"
    )
    if result.get("success"):
        task_id = result["task"]["id"]
        
        # Try to update with invalid status
        try:
            update_result = await server.manage_task(
                action="update",
                task_id=task_id,
                status="invalid_status"
            )
            if "error" in update_result or not update_result.get("success"):
                print(f"   ✓ Correctly handled invalid status")
        except Exception as e:
            print(f"   ✓ Correctly raised exception for invalid status: {e}")
    
    print("\n" + "=" * 50)
    print("✅ Error Handling Test Complete!")


if __name__ == "__main__":
    try:
        # Run main tests
        success = asyncio.run(test_mcp_server())
        
        if success:
            # Run error handling tests
            asyncio.run(test_error_handling())
        
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)