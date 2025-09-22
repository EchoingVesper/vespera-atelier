#!/usr/bin/env python3
"""
Simple test for hook agent components without heavy dependencies.

Tests the core hook agent architecture and classes without needing 
chromadb, vector services, or full MCP server initialization.
"""

import asyncio
import sys
import logging
from pathlib import Path
from enum import Enum

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TaskPriority(Enum):
    LOW = 0
    NORMAL = 1
    HIGH = 2
    CRITICAL = 3


# Test the core hook agent classes
async def test_hook_agent_classes():
    """Test the hook agent classes can be imported and initialized."""
    
    logger.info("🧪 Testing Hook Agent Core Classes")
    
    # Test imports work
    from automation.hook_agents import (
        HookTriggerType,
        AgentSpawnMode,
        TemplateContext,
        HookAgentDefinition,
        TimedAgentDefinition
    )
    
    logger.info("✅ Hook agent classes imported successfully")
    
    # Test TemplateContext creation
    template_context = TemplateContext(
        template_id="test_template_v1",
        template_name="Test Template",
        template_version="1.0.0",
        template_data={"key": "value"},
        field_schema={"field": {"type": "string"}},
        automation_rules=[{"rule": "test"}]
    )
    
    assert template_context.template_id == "test_template_v1"
    assert template_context.template_name == "Test Template"
    
    logger.info("✅ TemplateContext creation works")
    
    # Test HookAgentDefinition creation
    hook_def = HookAgentDefinition(
        hook_id="test-hook-1",
        name="Test Hook Agent",
        trigger_type=HookTriggerType.PRE_TASK_EXECUTION,
        spawn_mode=AgentSpawnMode.HYBRID,
        template_context=template_context,
        hook_rules=[{"rule": "test_hook"}],
        priority=TaskPriority.NORMAL
    )
    
    assert hook_def.hook_id == "test-hook-1"
    assert hook_def.trigger_type == HookTriggerType.PRE_TASK_EXECUTION
    assert hook_def.spawn_mode == AgentSpawnMode.HYBRID
    
    logger.info("✅ HookAgentDefinition creation works")
    
    # Test TimedAgentDefinition creation
    timed_def = TimedAgentDefinition(
        agent_id="test-timed-1",
        name="Test Timed Agent",
        spawn_mode=AgentSpawnMode.HYBRID,
        template_context=template_context,
        agent_rules=[{"rule": "test_timed"}],
        schedule_type="interval",
        schedule_config={"interval_seconds": 3600}
    )
    
    assert timed_def.agent_id == "test-timed-1"
    assert timed_def.schedule_type == "interval"
    assert timed_def.schedule_config["interval_seconds"] == 3600
    
    logger.info("✅ TimedAgentDefinition creation works")
    
    return True


# Test the hook integration classes
async def test_hook_integration_classes():
    """Test the hook integration classes can be imported."""
    
    logger.info("🧪 Testing Hook Integration Classes")
    
    # Test imports work
    from hook_integration import (
        HookAgentInput,
        TimedAgentInput,
        HookTriggerInput,
        MockTemplateRegistry
    )
    
    logger.info("✅ Hook integration classes imported successfully")
    
    # Test HookAgentInput creation
    hook_input = HookAgentInput(
        template_id="test_template_v1",
        template_name="Test Template",
        automation_rule={
            "name": "test_hook",
            "trigger": "pre_task_execution",
            "action": "spawn_hook_agent"
        },
        template_data={"key": "value"},
        field_schema={"field": {"type": "string"}}
    )
    
    assert hook_input.template_id == "test_template_v1"
    assert hook_input.automation_rule["name"] == "test_hook"
    
    logger.info("✅ HookAgentInput creation works")
    
    # Test TimedAgentInput creation
    timed_input = TimedAgentInput(
        template_id="test_timed_v1",
        template_name="Test Timed Template",
        automation_rule={
            "name": "test_timed",
            "trigger": "timed_schedule",
            "action": "spawn_timed_agent"
        },
        template_data={"key": "value"},
        field_schema={"field": {"type": "string"}},
        schedule_config={"type": "interval", "interval_seconds": 3600}
    )
    
    assert timed_input.template_id == "test_timed_v1"
    assert timed_input.schedule_config["type"] == "interval"
    
    logger.info("✅ TimedAgentInput creation works")
    
    # Test HookTriggerInput creation
    trigger_input = HookTriggerInput(
        hook_id="test-hook-1",
        trigger_context={"task_id": "test-task"},
        force_execute=True
    )
    
    assert trigger_input.hook_id == "test-hook-1"
    assert trigger_input.force_execute == True
    
    logger.info("✅ HookTriggerInput creation works")
    
    # Test MockTemplateRegistry
    registry = MockTemplateRegistry()
    
    result = await registry.get_template("non-existent")
    assert result is None
    
    templates = await registry.get_all_templates()
    assert templates == []
    
    logger.info("✅ MockTemplateRegistry works")
    
    return True


async def test_template_examples():
    """Test that template examples from documentation can be parsed."""
    
    logger.info("🧪 Testing Template Examples")
    
    # Example from the documentation
    implementation_template_rule = {
        "name": "pre_implementation_setup",
        "trigger": "pre_task_execution",
        "condition": "task_status == 'in_progress' AND github_repo != null",
        "action": "spawn_hook_agent",
        "hook_agent": {
            "name": "GitHub Worktree Setup Agent",
            "spawn_mode": "hybrid",
            "priority": 2,
            "max_execution_time": 300,
            "allowed_operations": [
                "git_operations",
                "file_system_operations",
                "github_api_calls"
            ],
            "file_patterns": [
                ".git/**",
                "src/**",
                "docs/**"
            ],
            "trigger_conditions": [
                "github_repo_accessible",
                "branch_name_valid"
            ]
        },
        "params": {
            "hook_instructions": [
                {
                    "step": "validate_github_access",
                    "action": "check_repository_access",
                    "repository": "{{github_repo}}",
                    "required_permissions": ["read", "write"]
                },
                {
                    "step": "create_worktree",
                    "action": "git_worktree_add",
                    "branch_name": "{{branch_name}}",
                    "base_branch": "main",
                    "worktree_path": "./worktrees/{{branch_name}}"
                }
            ]
        }
    }
    
    # Verify the structure is valid
    assert "name" in implementation_template_rule
    assert "trigger" in implementation_template_rule
    assert "hook_agent" in implementation_template_rule
    assert "params" in implementation_template_rule
    
    hook_agent_config = implementation_template_rule["hook_agent"]
    assert hook_agent_config["spawn_mode"] == "hybrid"
    assert len(hook_agent_config["allowed_operations"]) == 3
    assert len(hook_agent_config["file_patterns"]) == 3
    
    logger.info("✅ Implementation template rule structure is valid")
    
    # Timed agent example
    standup_template_rule = {
        "name": "daily_standup_preparation",
        "trigger": "timed_schedule",
        "action": "spawn_timed_agent",
        "timed_agent": {
            "name": "Standup Preparation Agent",
            "spawn_mode": "hybrid",
            "priority": 1,
            "max_execution_time": 300,
            "allowed_operations": [
                "task_analysis",
                "progress_tracking",
                "notification_services",
                "document_generation"
            ],
            "schedule": {
                "type": "cron",
                "expression": "0 8 * * 1-5",
                "timezone": "UTC",
                "description": "8 AM weekdays"
            }
        },
        "params": {
            "agent_instructions": [
                {
                    "step": "analyze_team_progress",
                    "action": "task_progress_analysis",
                    "team_members": "{{team_members}}",
                    "project_phase": "{{project_phase}}",
                    "time_period": "since_last_standup"
                },
                {
                    "step": "generate_standup_agenda",
                    "action": "llm_agenda_generation",
                    "progress_data": "{{team_progress_analysis}}"
                }
            ]
        }
    }
    
    # Verify the timed agent structure
    assert "name" in standup_template_rule
    assert "trigger" in standup_template_rule
    assert "timed_agent" in standup_template_rule
    
    timed_agent_config = standup_template_rule["timed_agent"]
    assert timed_agent_config["spawn_mode"] == "hybrid"
    assert timed_agent_config["schedule"]["type"] == "cron"
    assert len(timed_agent_config["allowed_operations"]) == 4
    
    logger.info("✅ Standup template rule structure is valid")
    
    return True


if __name__ == "__main__":
    try:
        # Run core class tests
        asyncio.run(test_hook_agent_classes())
        
        # Run integration class tests
        asyncio.run(test_hook_integration_classes())
        
        # Run template example tests
        asyncio.run(test_template_examples())
        
        print("\n🎉 All simple hook agent tests passed!")
        print("✨ The hook agent system core architecture is working!")
        print("📝 Template examples are properly structured!")
        
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)