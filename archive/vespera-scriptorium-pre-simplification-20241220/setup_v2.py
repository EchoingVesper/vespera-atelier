#!/usr/bin/env python3
"""
Setup script for Vespera V2 Task Management System

Quick setup and validation for the new hierarchical task system.
"""

import sys
import asyncio
from pathlib import Path

# Add the package to path
sys.path.insert(0, str(Path(__file__).parent))

from tasks import TaskManager
from roles import RoleManager


async def setup_v2_system():
    """Set up and validate the V2 system."""
    print("🚀 Setting up Vespera V2 Task Management System")
    print("=" * 60)
    
    # Initialize system
    print("\n1. Initializing System...")
    project_root = Path.cwd()
    role_manager = RoleManager(project_root)
    task_manager = TaskManager(project_root, role_manager)
    
    print(f"   ✓ Project root: {project_root}")
    print(f"   ✓ Roles loaded: {len(role_manager.list_roles())}")
    print(f"   ✓ Database: {task_manager.task_service.db_path}")
    
    # Check role system
    print("\n2. Validating Role System...")
    roles = role_manager.list_roles()
    for role_name in roles[:5]:  # Show first 5
        role = role_manager.get_role(role_name)
        if role:
            tool_groups = [str(tg) for tg in role.tool_groups]
            print(f"   ✓ {role_name}: {', '.join(tool_groups)}")
    
    # Create sample task
    print("\n3. Creating Sample Task...")
    success, result = await task_manager.task_service.create_task(
        title="V2 System Setup Complete",
        description="Vespera V2 hierarchical task management system is ready",
        project_id="v2-setup",
        role_name="orchestrator"
    )
    
    if success:
        task = result["task"]
        print(f"   ✓ Sample task created: {task['title']}")
        print(f"   ✓ Task ID: {task['id']}")
    else:
        print(f"   ✗ Failed to create sample task: {result}")
        return False
    
    # Test dashboard
    print("\n4. Testing Dashboard...")
    dashboard = await task_manager.get_task_dashboard(project_id="v2-setup")
    if "statistics" in dashboard:
        stats = dashboard["statistics"]
        print(f"   ✓ Total tasks: {stats['total']}")
        print(f"   ✓ System ready for use")
    else:
        print(f"   ✗ Dashboard error: {dashboard}")
        return False
    
    print("\n" + "=" * 60)
    print("✅ V2 System Setup Complete!")
    print("\nNext steps:")
    print("1. Run MCP server: python __main__.py --server")
    print("2. Configure Claude Code MCP integration")
    print("3. Start using the new task system!")
    
    return True


if __name__ == "__main__":
    try:
        success = asyncio.run(setup_v2_system())
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Setup failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)