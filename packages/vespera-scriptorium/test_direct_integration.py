#!/usr/bin/env python3
"""Direct integration test for Bindery backend."""

import asyncio
import json
from bindery_client import BinderyClient
from models import TaskInput, TaskPriority, TaskStatus

async def test_direct_integration():
    """Test direct communication with Bindery backend."""

    print("Testing direct Bindery integration...")

    async with BinderyClient() as client:
        # Test 1: Health check
        print("\n1. Testing health check...")
        try:
            health = await client.health_check()
            print(f"   ✓ Health check passed: {health}")
        except Exception as e:
            print(f"   ✗ Health check failed: {e}")

        # Test 2: List roles
        print("\n2. Testing list roles...")
        try:
            roles = await client.list_roles()
            print(f"   ✓ Found {roles.get('total_roles', 0)} roles")
            for role in roles.get('roles', []):
                print(f"      - {role['name']}: {role['description']}")
        except Exception as e:
            print(f"   ✗ List roles failed: {e}")

        # Test 3: Create a task
        print("\n3. Testing task creation...")
        try:
            task_input = TaskInput(
                title="Integration Test Task",
                description="Testing direct backend integration",
                priority=TaskPriority.NORMAL,
                status=TaskStatus.TODO,
                tags=["test", "integration", "direct"]
            )

            created_task = await client.create_task(task_input)
            print(f"   ✓ Task created with ID: {created_task.id}")
            print(f"      Title: {created_task.title}")
            print(f"      Status: {created_task.status}")

            # Test 4: Get the task
            print("\n4. Testing get task...")
            retrieved_task = await client.get_task(created_task.id)
            print(f"   ✓ Task retrieved: {retrieved_task.title}")

            # Test 5: List tasks
            print("\n5. Testing list tasks...")
            task_list = await client.list_tasks()
            print(f"   ✓ Found {task_list.total} tasks")

            # Test 6: Delete the test task
            print("\n6. Testing task deletion...")
            delete_result = await client.delete_task(created_task.id)
            print(f"   ✓ Task deleted: {delete_result}")

        except Exception as e:
            print(f"   ✗ Task operations failed: {e}")
            import traceback
            traceback.print_exc()

        # Test 7: Dashboard stats
        print("\n7. Testing dashboard stats...")
        try:
            stats = await client.get_dashboard_stats()
            print(f"   ✓ Dashboard stats retrieved:")
            print(f"      Total tasks: {stats.get('total_tasks', 0)}")
            print(f"      Completed: {stats.get('completed_tasks', 0)}")
            print(f"      In progress: {stats.get('in_progress_tasks', 0)}")
        except Exception as e:
            print(f"   ✗ Dashboard stats failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_direct_integration())