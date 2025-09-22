#!/usr/bin/env python3
"""
Test the V2 Template System with the meta-PRP basic template.

This script demonstrates:
1. Template validation
2. Template instantiation with variables
3. Task tree generation via MCP tools
4. Role assignment and dependency creation
"""

import sys
import os
from pathlib import Path
import logging

# Add the package to Python path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from templates import V2TemplateEngine

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


def test_template_system():
    """Test the complete V2 template system"""
    
    print("🚀 Testing Vespera V2 Template System")
    print("=" * 50)
    
    # Initialize the template engine
    engine = V2TemplateEngine()
    
    # Path to our sample template
    template_path = Path(__file__).parent.parent.parent / "templates/examples/meta-prp-basic"
    
    if not template_path.exists():
        print(f"❌ Template not found: {template_path}")
        return False
    
    print(f"📁 Using template: {template_path}")
    
    # Step 1: Validate template
    print("\n🔍 Step 1: Validating template...")
    validation_result = engine.validate_template_source(template_path)
    
    if not validation_result.valid:
        print("❌ Template validation failed:")
        for error in validation_result.errors:
            print(f"  - {error}")
        return False
    
    print("✅ Template validation passed!")
    if validation_result.warnings:
        print("⚠️  Warnings:")
        for warning in validation_result.warnings:
            print(f"  - {warning}")
    
    # Step 2: Test with sample variables
    print("\n📝 Step 2: Testing template instantiation...")
    
    sample_variables = {
        "project_name": "AI Task Orchestrator",
        "project_description": "An intelligent task management system with AI-powered workflow optimization",
        "feature_area": "orchestration",
        "assignee": "Development Team",
        "priority_level": "high",
        "include_security_review": True
    }
    
    print(f"Variables: {sample_variables}")
    
    # Step 3: Create tasks (dry run first)
    print("\n🎭 Step 3: Dry run (preview tasks)...")
    
    dry_result = engine.create_from_template(
        template_source=template_path,
        variables=sample_variables,
        project_id="template-test",
        dry_run=True
    )
    
    if not dry_result.success:
        print("❌ Dry run failed:")
        for error in dry_result.errors:
            print(f"  - {error}")
        return False
    
    print("✅ Dry run successful!")
    
    # Step 4: Actually create the task tree
    print("\n🏗️  Step 4: Creating actual task tree...")
    
    result = engine.create_from_template(
        template_source=template_path,
        variables=sample_variables,
        project_id="ai-orchestrator-demo",
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
    
    if result.created_task_ids:
        print(f"\n📋 Created Task IDs:")
        for i, task_id in enumerate(result.created_task_ids, 1):
            print(f"  {i}. {task_id}")
    
    if result.created_dependencies:
        print(f"\n🔗 Created Dependencies:")
        for dep in result.created_dependencies:
            print(f"  {dep['task_id']} depends on {dep['depends_on']}")
    
    if result.role_assignments:
        print(f"\n👤 Role Assignments:")
        for task_id, role in result.role_assignments.items():
            print(f"  {task_id} → {role}")
    
    if result.warnings:
        print(f"\n⚠️  Warnings:")
        for warning in result.warnings:
            print(f"  - {warning}")
    
    print("\n🎉 Template system test completed successfully!")
    return True


def test_template_listing():
    """Test template discovery"""
    print("\n📚 Testing template discovery...")
    
    engine = V2TemplateEngine()
    examples_dir = Path(__file__).parent.parent.parent / "templates/examples"
    
    templates = engine.list_available_templates(examples_dir)
    
    print(f"Found {len(templates)} templates:")
    for template in templates:
        print(f"  - {template['name']} ({template['category']}) v{template['version']}")
        print(f"    {template['description']}")
        print(f"    Path: {template['path']}")


if __name__ == "__main__":
    try:
        # Test template discovery first
        test_template_listing()
        
        # Then test the main template system
        success = test_template_system()
        
        if success:
            print("\n✨ All tests passed! Template system is ready for use.")
            sys.exit(0)
        else:
            print("\n💥 Tests failed. Check the output above for details.")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"Test execution failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)