#!/usr/bin/env python3
"""
Quick test script for the Vespera V2 role system.
Tests role loading, validation, and execution context generation.
"""

import sys
from pathlib import Path

# Add the package to path for testing
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from roles import RoleManager, RoleValidator, RoleExecutor, ToolGroup


def test_role_system():
    """Test the complete role system functionality."""
    print("🧪 Testing Vespera V2 Role System")
    print("=" * 50)
    
    # Initialize role manager
    print("\n1. Initializing Role Manager...")
    role_manager = RoleManager(project_root=Path.cwd())
    
    roles = role_manager.list_roles()
    print(f"   ✓ Loaded {len(roles)} roles: {', '.join(roles)}")
    
    # Test role retrieval
    print("\n2. Testing Role Retrieval...")
    coder_role = role_manager.get_role("coder")
    if coder_role:
        print(f"   ✓ Coder role: {coder_role.display_name}")
        print(f"   ✓ Tool groups: {[group.value if hasattr(group, 'value') else str(group) for group in coder_role.tool_groups]}")
        print(f"   ✓ Has EDIT group: {coder_role.has_tool_group(ToolGroup.EDIT)}")
        print(f"   ✓ Can edit Python file: {coder_role.can_edit_file('test.py')}")
        print(f"   ✓ Restrictions: {len(coder_role.restrictions)}")
        print(f"   ✓ Max file changes: {coder_role.get_max_file_changes()}")
    else:
        print("   ✗ Failed to load coder role")
    
    # Test role validation
    print("\n3. Testing Role Validation...")
    validator = RoleValidator()
    
    if coder_role:
        is_valid, errors, warnings = validator.validate_role(coder_role)
        print(f"   ✓ Role validation: {'VALID' if is_valid else 'INVALID'}")
        if errors:
            print(f"   ⚠ Errors: {errors}")
        if warnings:
            print(f"   ⚠ Warnings: {warnings}")
    
    # Test execution context
    print("\n4. Testing Role Execution...")
    executor = RoleExecutor(role_manager)
    
    # Test dry run execution
    result = executor.execute_task(
        role_name="coder",
        task_prompt="Implement a simple function that adds two numbers",
        linked_documents=["coding_standards.md", "api_docs.md"],
        project_context="Python project using Clean Architecture",
        dry_run=True
    )
    
    print(f"   ✓ Execution status: {result.status.value}")
    print(f"   ✓ Role used: {result.role_name}")
    print(f"   ✓ Tool groups: {result.tool_groups_used}")
    print(f"   ✓ Execution time: {result.execution_time:.3f}s")
    
    # Test context generation
    print("\n5. Testing Context Generation...")
    context = executor.get_role_context("coder", "implementation")
    if context:
        prompt = context.to_llm_prompt()
        print(f"   ✓ Generated LLM prompt ({len(prompt)} chars)")
        print(f"   ✓ Tool group restrictions: {len(context.tool_group_restrictions)}")
        print(f"   ✓ Validation requirements: {len(context.validation_requirements)}")
    
    # Test role finding
    print("\n6. Testing Role Finding...")
    suitable_roles = role_manager.get_roles_by_tool_group(ToolGroup.EDIT)
    print(f"   ✓ Found {len(suitable_roles)} suitable roles with EDIT tool group:")
    for role in suitable_roles:
        print(f"      - {role.name}: {role.display_name}")
    
    # System summary
    print("\n7. System Summary...")
    summary = role_manager.get_role_summary()
    print(f"   ✓ Total roles loaded: {len(summary)}")
    for name, info in summary.items():
        groups = len(info['tool_groups'])
        restrictions = info['restrictions']
        print(f"      - {name}: {groups} tool groups, {restrictions} restrictions")
    
    print("\n" + "=" * 50)
    print("✅ Role System Test Complete!")
    
    return True


if __name__ == "__main__":
    try:
        success = test_role_system()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)