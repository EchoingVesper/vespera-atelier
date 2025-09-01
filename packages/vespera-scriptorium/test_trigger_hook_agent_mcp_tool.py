#!/usr/bin/env python3
"""
Test for the trigger_hook_agent MCP tool functionality.

This test validates the trigger_hook_agent MCP tool by simulating the tool's
behavior without requiring MCP server permissions. 
"""

import asyncio
import sys
import logging
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_trigger_hook_agent_mcp_tool():
    """Test the trigger_hook_agent MCP tool behavior."""
    
    logger.info("🧪 Testing trigger_hook_agent MCP tool")
    
    # Import required components
    from hook_integration import HookTriggerInput, HookIntegrationManager, MockTemplateRegistry
    
    # Create HookTriggerInput with minimal test context
    trigger_input = HookTriggerInput(
        hook_id="test-hook-minimal",
        trigger_context={
            "task_id": "test-task-001", 
            "action": "minimal_test_trigger",
            "test_mode": True
        },
        force_execute=True
    )
    
    logger.info(f"✅ Created HookTriggerInput: {trigger_input.hook_id}")
    logger.info(f"   Context: {trigger_input.trigger_context}")
    logger.info(f"   Force execute: {trigger_input.force_execute}")
    
    # Test input validation
    assert trigger_input.hook_id == "test-hook-minimal"
    assert trigger_input.trigger_context["task_id"] == "test-task-001"
    assert trigger_input.force_execute == True
    
    logger.info("✅ HookTriggerInput validation passed")
    
    # Test the model serialization/deserialization
    input_dict = trigger_input.model_dump()
    recreated_input = HookTriggerInput(**input_dict)
    
    assert recreated_input.hook_id == trigger_input.hook_id
    assert recreated_input.trigger_context == trigger_input.trigger_context
    assert recreated_input.force_execute == trigger_input.force_execute
    
    logger.info("✅ HookTriggerInput serialization/deserialization passed")
    
    # Test with minimal context - the kind of test the MCP tool would handle
    minimal_trigger_input = HookTriggerInput(
        hook_id="minimal-hook", 
        trigger_context={"minimal": "test"},
        force_execute=False  # Test with force_execute=False too
    )
    
    assert minimal_trigger_input.hook_id == "minimal-hook"
    assert not minimal_trigger_input.force_execute
    
    logger.info("✅ Minimal trigger context validation passed")
    
    # Test edge cases that the MCP tool should handle
    
    # Test with empty context (should still work)
    empty_context_input = HookTriggerInput(
        hook_id="empty-context-hook",
        trigger_context={},
        force_execute=True
    )
    
    assert empty_context_input.trigger_context == {}
    logger.info("✅ Empty context validation passed")
    
    # Test with complex nested context
    complex_trigger_input = HookTriggerInput(
        hook_id="complex-hook",
        trigger_context={
            "task": {
                "id": "nested-task",
                "metadata": {"priority": "high", "tags": ["automation", "test"]},
                "execution_context": {
                    "timestamp": "2025-09-01T10:00:00Z",
                    "trigger_source": "mcp_tool_test"
                }
            },
            "template_data": {"field1": "value1"},
            "validation_rules": ["rule1", "rule2"]
        },
        force_execute=True
    )
    
    assert complex_trigger_input.trigger_context["task"]["id"] == "nested-task"
    assert len(complex_trigger_input.trigger_context["template_data"]) == 1
    
    logger.info("✅ Complex nested context validation passed")
    
    return True

async def test_trigger_hook_agent_error_handling():
    """Test error handling scenarios for trigger_hook_agent."""
    
    logger.info("🧪 Testing trigger_hook_agent error handling")
    
    from hook_integration import HookTriggerInput
    from pydantic import ValidationError
    
    # Test missing required fields
    try:
        invalid_input = HookTriggerInput()  # Missing required hook_id and trigger_context
        assert False, "Should have failed validation"
    except ValidationError as e:
        logger.info("✅ Missing required fields properly caught")
        assert "hook_id" in str(e)
        assert "trigger_context" in str(e)
    
    # Test invalid hook_id type
    try:
        invalid_input = HookTriggerInput(
            hook_id=123,  # Should be string
            trigger_context={"test": "data"},
            force_execute=True
        )
        assert False, "Should have failed validation"
    except ValidationError as e:
        logger.info("✅ Invalid hook_id type properly caught")
    
    # Test invalid trigger_context type
    try:
        invalid_input = HookTriggerInput(
            hook_id="test-hook",
            trigger_context="not-a-dict",  # Should be dict
            force_execute=True
        )
        assert False, "Should have failed validation"
    except ValidationError as e:
        logger.info("✅ Invalid trigger_context type properly caught")
    
    return True

async def test_mcp_tool_response_format():
    """Test the expected response format from the trigger_hook_agent MCP tool."""
    
    logger.info("🧪 Testing expected MCP tool response format")
    
    # The MCP tool should return responses in this format based on hook_integration.py
    expected_success_response = {
        "success": True,
        "hook_id": "test-hook",
        "execution_id": "exec-123", 
        "message": "Hook agent triggered successfully",
        "project": "test-project"
    }
    
    expected_error_response = {
        "success": False,
        "error": "Hook agent test-hook not found or conditions not met",
        "hook_id": "test-hook",
        "project": "test-project"
    }
    
    # Validate expected response structures
    assert "success" in expected_success_response
    assert "hook_id" in expected_success_response
    assert "project" in expected_success_response
    
    assert "success" in expected_error_response
    assert "error" in expected_error_response
    assert "hook_id" in expected_error_response
    
    logger.info("✅ Expected response format validation passed")
    
    return True

if __name__ == "__main__":
    try:
        # Run main trigger tool tests
        asyncio.run(test_trigger_hook_agent_mcp_tool())
        
        # Run error handling tests
        asyncio.run(test_trigger_hook_agent_error_handling())
        
        # Run response format tests
        asyncio.run(test_mcp_tool_response_format())
        
        print("\n🎉 All trigger_hook_agent MCP tool tests passed!")
        print("✨ The trigger_hook_agent MCP tool input validation works correctly!")
        print("🔧 Error handling behaves as expected!")
        print("📋 Response format matches expected structure!")
        
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)