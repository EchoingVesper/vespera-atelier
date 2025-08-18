#!/usr/bin/env python3
"""
Test script for Hierarchical Task Management System

Comprehensive testing of the task management system with role integration,
dependency resolution, and execution workflows.
"""

import sys
import asyncio
from pathlib import Path
from datetime import datetime, timedelta

# Add the package to path for testing
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tasks import TaskManager, TaskExecutor, Task, TaskStatus, TaskPriority, TaskRelation, TaskMetadata
from roles import RoleManager


async def test_task_system():
    """Test the complete hierarchical task management system."""
    print("🧪 Testing Vespera V2 Hierarchical Task Management System")
    print("=" * 60)
    
    # Initialize managers
    print("\n1. Initializing Task Management System...")
    project_root = Path.cwd()
    role_manager = RoleManager(project_root)
    task_manager = TaskManager(project_root, role_manager)
    task_executor = TaskExecutor(project_root, role_manager, task_manager)
    
    print(f"   ✓ Initialized with project root: {project_root}")
    print(f"   ✓ Loaded {len(role_manager.list_roles())} roles")
    
    # Test basic task creation
    print("\n2. Testing Task Creation...")
    success, result = await task_manager.create_task_tree(
        title="Implement Authentication System",
        description="Create a secure authentication system with JWT tokens",
        project_id="test-project-1",
        feature="authentication",
        subtasks=[
            {
                "title": "Design authentication schema",
                "description": "Design database schema for users and authentication",
                "role": "architect",
                "priority": "high",
                "order": 1
            },
            {
                "title": "Implement JWT token generation",
                "description": "Create JWT token generation and validation logic",
                "role": "coder", 
                "priority": "normal",
                "order": 2
            },
            {
                "title": "Write authentication tests",
                "description": "Create comprehensive test suite for authentication",
                "role": "tester",
                "priority": "normal", 
                "order": 3
            },
            {
                "title": "Document authentication API",
                "description": "Create API documentation for authentication endpoints",
                "role": "documenter",
                "priority": "low",
                "order": 4
            }
        ]
    )
    
    if success:
        root_task = result["root_task"]
        all_tasks = result["all_tasks"]
        print(f"   ✓ Created task tree with {result['total_created']} tasks")
        print(f"   ✓ Root task: {root_task['title']}")
        print(f"   ✓ Subtasks: {len(all_tasks) - 1}")
        
        # Show subtask assignments
        for task_data in all_tasks[1:]:  # Skip root task
            role = task_data["execution"]["assigned_role"]
            print(f"      - {task_data['title']} → {role}")
    else:
        print(f"   ✗ Failed to create task tree: {result}")
        return False
    
    # Test task querying
    print("\n3. Testing Task Querying...")
    todo_tasks = await task_manager.task_service.list_tasks(
        status=TaskStatus.TODO,
        project_id="test-project-1"
    )
    print(f"   ✓ Found {len(todo_tasks)} TODO tasks")
    
    # Test role suggestions
    print("\n4. Testing Role Assignment...")
    if todo_tasks:
        first_task = todo_tasks[0]
        suggested_role = await task_manager.suggest_role_for_task(first_task.id)
        print(f"   ✓ Suggested role for '{first_task.title}': {suggested_role}")
        
        # Test role validation
        if suggested_role:
            success, result = await task_manager.assign_role_to_task(
                first_task.id, 
                suggested_role,
                validate_capabilities=True
            )
            if success:
                print(f"   ✓ Successfully assigned role '{suggested_role}'")
            else:
                print(f"   ⚠ Role assignment validation: {result}")
    
    # Test dependency management
    print("\n5. Testing Task Dependencies...")
    if len(all_tasks) >= 3:
        task1_id = all_tasks[1]["id"]  # Design schema
        task2_id = all_tasks[2]["id"]  # Implement JWT
        
        # Add dependency: JWT implementation depends on schema design
        success = await task_manager.task_service.add_task_relationship(
            task2_id, task1_id, TaskRelation.DEPENDS_ON
        )
        
        if success:
            print(f"   ✓ Added dependency: Task 2 depends on Task 1")
            
            # Analyze dependencies
            analysis = await task_manager.analyze_task_dependencies(task2_id)
            print(f"   ✓ Dependency analysis for '{analysis['task_title']}':")
            for dep in analysis["depends_on"]:
                status = "blocking" if dep["blocking"] else "satisfied"
                print(f"      - Depends on: {dep['title']} ({dep['status']}) - {status}")
        else:
            print("   ✗ Failed to add task dependency")
    
    # Test task dashboard
    print("\n6. Testing Task Dashboard...")
    dashboard = await task_manager.get_task_dashboard(project_id="test-project-1")
    if "statistics" in dashboard:
        stats = dashboard["statistics"]
        print(f"   ✓ Task Statistics:")
        print(f"      - Total tasks: {stats['total']}")
        print(f"      - By status: {stats['by_status']}")
        print(f"      - By priority: {stats['by_priority']}")
        print(f"      - Completion rate: {stats['completion_rate']}%")
        
        if dashboard.get("recommendations"):
            print(f"   ✓ Recommendations:")
            for rec in dashboard["recommendations"]:
                print(f"      - {rec}")
    else:
        print(f"   ✗ Dashboard error: {dashboard}")
    
    # Test task execution (dry run)
    print("\n7. Testing Task Execution (Dry Run)...")
    executable_tasks = await task_manager._find_executable_tasks(project_id="test-project-1")
    
    if executable_tasks:
        test_task = executable_tasks[0]
        print(f"   ✓ Found executable task: {test_task.title}")
        print(f"   ✓ Assigned role: {test_task.execution.assigned_role}")
        
        # Execute in dry run mode
        execution_result = await task_executor.execute_task(
            test_task.id,
            dry_run=True
        )
        
        print(f"   ✓ Dry run execution:")
        print(f"      - Status: {execution_result.status.value}")
        print(f"      - Success: {execution_result.success}")
        print(f"      - Role used: {execution_result.role_used}")
        print(f"      - Execution time: {execution_result.execution_time:.3f}s")
        print(f"      - Tool groups used: {execution_result.tool_groups_used}")
        
        if execution_result.output:
            print(f"      - Output preview: {execution_result.output[:200]}...")
    else:
        print("   ⚠ No executable tasks found (may need role assignments)")
    
    # Test task tree visualization
    print("\n8. Testing Task Tree Structure...")
    if success:
        tree = await task_manager.task_service.get_task_tree(root_task["id"])
        if tree:
            print(f"   ✓ Task tree for '{tree['title']}':")
            print(f"      - Root: {tree['title']} ({tree['status']})")
            for child in tree.get("children", []):
                role = child["execution"]["assigned_role"] or "unassigned"
                print(f"        └─ {child['title']} ({child['status']}) → {role}")
        else:
            print("   ✗ Failed to retrieve task tree")
    
    # Test task ordering
    print("\n9. Testing Task Reordering...")
    if todo_tasks and len(todo_tasks) >= 2:
        task_to_reorder = todo_tasks[0]
        original_order = task_to_reorder.task_order
        new_order = original_order + 10
        
        success = await task_manager.task_service.reorder_task(
            task_to_reorder.id, 
            new_order
        )
        
        if success:
            updated_task = await task_manager.task_service.get_task(task_to_reorder.id)
            print(f"   ✓ Reordered task from position {original_order} to {updated_task.task_order}")
        else:
            print("   ✗ Failed to reorder task")
    
    # Test execution statistics
    print("\n10. Testing Execution Statistics...")
    exec_stats = task_executor.get_execution_statistics()
    print(f"   ✓ Execution Statistics:")
    print(f"      - Total executions: {exec_stats['total_executions']}")
    print(f"      - Success rate: {exec_stats['success_rate']:.1f}%")
    print(f"      - Active executions: {exec_stats['active_executions']}")
    print(f"      - Average execution time: {exec_stats['average_execution_time']}s")
    
    if exec_stats.get('by_role'):
        print(f"      - By role: {exec_stats['by_role']}")
    
    # Test task completion workflow
    print("\n11. Testing Task Completion Workflow...")
    if executable_tasks:
        test_task = executable_tasks[0]
        
        # Simulate task completion
        success, result = await task_manager.complete_task(
            test_task.id,
            output="Task completed successfully in test mode",
            artifacts=["test_output.txt", "updated_config.json"],
            mark_as_review=True
        )
        
        if success:
            completed_task_data = result["task"]
            print(f"   ✓ Task completion:")
            print(f"      - Status: {completed_task_data['status']}")
            print(f"      - Unblocked tasks: {len(result['unblocked_tasks'])}")
            
            # Check execution history
            updated_task = await task_manager.task_service.get_task(test_task.id)
            history_count = len(updated_task.execution.execution_history)
            print(f"      - Execution history entries: {history_count}")
        else:
            print(f"   ✗ Task completion failed: {result}")
    
    # Test cleanup and final statistics
    print("\n12. Final System State...")
    final_dashboard = await task_manager.get_task_dashboard(project_id="test-project-1")
    if "statistics" in final_dashboard:
        final_stats = final_dashboard["statistics"]
        print(f"   ✓ Final Statistics:")
        print(f"      - Total tasks: {final_stats['total']}")
        print(f"      - Status breakdown: {final_stats['by_status']}")
        print(f"      - Completion rate: {final_stats['completion_rate']}%")
        print(f"      - Tasks in review: {final_stats['pending_review']}")
        print(f"      - Blocked tasks: {final_stats['blocked_tasks']}")
    
    print("\n" + "=" * 60)
    print("✅ Hierarchical Task Management System Test Complete!")
    
    return True


async def test_advanced_scenarios():
    """Test advanced task management scenarios."""
    print("\n🔬 Testing Advanced Task Management Scenarios")
    print("=" * 50)
    
    project_root = Path.cwd()
    task_manager = TaskManager(project_root)
    
    # Test circular dependency detection
    print("\n1. Testing Circular Dependency Detection...")
    
    # Create tasks with potential circular dependency
    success1, result1 = await task_manager.task_service.create_task(
        "Task A", "First task", project_id="circular-test"
    )
    success2, result2 = await task_manager.task_service.create_task(
        "Task B", "Second task", project_id="circular-test"
    )
    
    if success1 and success2:
        task_a_id = result1["task"]["id"]
        task_b_id = result2["task"]["id"]
        
        # Create circular dependency: A depends on B, B depends on A
        await task_manager.task_service.add_task_relationship(
            task_a_id, task_b_id, TaskRelation.DEPENDS_ON
        )
        await task_manager.task_service.add_task_relationship(
            task_b_id, task_a_id, TaskRelation.DEPENDS_ON
        )
        
        # Check for circular dependency
        has_circular = await task_manager._has_circular_dependency(task_a_id)
        print(f"   ✓ Circular dependency detected: {has_circular}")
    
    # Test task metadata and labels
    print("\n2. Testing Task Metadata and Labels...")
    metadata = TaskMetadata(
        tags=["backend", "security", "api"],
        estimated_effort="4 hours",
        complexity="complex",
        source_references=["auth_requirements.md", "security_guidelines.md"]
    )
    metadata.set_label("sprint", "sprint-1")
    metadata.set_label("epic", "user-management")
    
    success, result = await task_manager.task_service.create_task(
        "Enhanced Authentication Task",
        "Task with comprehensive metadata",
        metadata=metadata,
        project_id="metadata-test"
    )
    
    if success:
        task_data = result["task"]
        print(f"   ✓ Created task with metadata:")
        print(f"      - Tags: {task_data['metadata']['tags']}")
        print(f"      - Labels: {task_data['metadata']['labels']}")
        print(f"      - Complexity: {task_data['metadata']['complexity']}")
        print(f"      - Estimated effort: {task_data['metadata']['estimated_effort']}")
    
    # Test batch task operations
    print("\n3. Testing Batch Task Operations...")
    batch_tasks = []
    for i in range(5):
        success, result = await task_manager.task_service.create_task(
            f"Batch Task {i+1}",
            f"Task number {i+1} in batch",
            priority=TaskPriority.NORMAL,
            project_id="batch-test"
        )
        if success:
            batch_tasks.append(result["task"]["id"])
    
    print(f"   ✓ Created {len(batch_tasks)} tasks in batch")
    
    # Test bulk status update
    updated_count = 0
    for task_id in batch_tasks[:3]:  # Update first 3
        success, _ = await task_manager.task_service.update_task(
            task_id, {"status": TaskStatus.DOING.value}
        )
        if success:
            updated_count += 1
    
    print(f"   ✓ Updated {updated_count} tasks to DOING status")
    
    print("\n" + "=" * 50)
    print("✅ Advanced Scenarios Test Complete!")


if __name__ == "__main__":
    try:
        # Run basic tests
        success = asyncio.run(test_task_system())
        
        if success:
            # Run advanced tests
            asyncio.run(test_advanced_scenarios())
            
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)