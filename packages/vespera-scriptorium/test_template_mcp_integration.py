#!/usr/bin/env python3
"""
Test V2 Template System with REAL MCP Tool Integration

This script demonstrates the template system actually calling
the MCP vespera-scriptorium tools available in Claude Code.
"""

import sys
import os
from pathlib import Path
import logging

# Add the package to Python path
sys.path.insert(0, str(Path(__file__).parent))

from templates import V2TemplateEngine

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


def test_template_with_real_mcp():
    """Test template system with actual MCP tool calls"""
    
    print("🚀 Testing V2 Template System with REAL MCP Integration")
    print("=" * 60)
    
    # Initialize the template engine
    engine = V2TemplateEngine()
    
    # Path to our sample template
    template_path = Path(__file__).parent / "templates/examples/meta-prp-basic"
    
    if not template_path.exists():
        print(f"❌ Template not found: {template_path}")
        return False
    
    print(f"📁 Using template: {template_path}")
    
    # Test variables
    sample_variables = {
        "project_name": "Real MCP Integration Demo",
        "project_description": "Demonstration of V2 template system with actual MCP tool calls",
        "feature_area": "mcp_integration",
        "assignee": "Claude Code",
        "priority_level": "high",
        "include_security_review": True
    }
    
    print(f"📝 Variables: {sample_variables}")
    
    # Create the task tree using the template system
    print("\n🏗️  Creating task tree with REAL MCP tools...")
    
    result = engine.create_from_template(
        template_source=template_path,
        variables=sample_variables,
        project_id="mcp-integration-demo",
        dry_run=False
    )
    
    if not result.success:
        print("❌ Task tree creation failed:")
        for error in result.errors:
            print(f"  - {error}")
        return False
    
    print("✅ Task tree created successfully!")
    
    # Display results
    print(f"\n📊 Results:")
    print(f"  Root Task ID: {result.root_task_id}")
    print(f"  Total Tasks Created: {len(result.created_task_ids)}")
    print(f"  Dependencies Created: {len(result.created_dependencies)}")
    print(f"  Role Assignments: {len(result.role_assignments)}")
    
    print(f"\n📋 Created Task IDs:")
    for i, task_id in enumerate(result.created_task_ids, 1):
        print(f"  {i}. {task_id}")
    
    print(f"\n🔗 Dependencies:")
    for dep in result.created_dependencies:
        status = dep.get('status', 'unknown')
        print(f"  {dep['task_id']} depends on {dep['depends_on']} [{status}]")
    
    print(f"\n👤 Role Assignments:")
    for task_id, role in result.role_assignments.items():
        print(f"  {task_id} → {role}")
    
    if result.warnings:
        print(f"\n⚠️  Warnings:")
        for warning in result.warnings:
            print(f"  - {warning}")
    
    print("\n🎉 Real MCP integration test completed successfully!")
    return True


if __name__ == "__main__":
    try:
        success = test_template_with_real_mcp()
        
        if success:
            print("\n✨ Template system with MCP integration is working!")
            print("🔧 Ready to integrate with actual MCP tools in Claude Code environment")
            sys.exit(0)
        else:
            print("\n💥 Test failed. Check the output above for details.")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"Test execution failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)