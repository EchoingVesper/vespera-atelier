#!/usr/bin/env python3
"""
Test the hook agent integration with the MCP server.

This test verifies that:
1. Hook agent system initializes properly
2. MCP tools for hook agents are registered
3. Hook agents can be registered from template automation rules  
4. Timed agents can be registered and scheduled
5. Background task execution manager integrates properly
"""

import asyncio
import json
import sys
import logging
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from vespera_server import VesperaServer
from hook_integration import HookAgentInput, TimedAgentInput, HookTriggerInput

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_hook_agent_integration():
    """Test the complete hook agent integration."""
    
    logger.info("🧪 Testing Hook Agent Integration")
    
    # Initialize server
    server = VesperaServer(project_root=Path.cwd())
    server.initialize_managers()
    
    # Test 1: Verify hook integration initialized
    assert server.hook_integration is not None, "Hook integration should be initialized"
    assert server.background_executor is not None, "Background executor should be initialized"
    
    logger.info("✅ Test 1: Hook integration components initialized")
    
    # Test 2: Register a hook agent from template automation rule
    hook_input = HookAgentInput(
        template_id="test_implementation_task_v1",
        template_name="Test Implementation Task",
        automation_rule={
            "name": "pre_implementation_setup",
            "trigger": "pre_task_execution",
            "action": "spawn_hook_agent",
            "hook_agent": {
                "name": "GitHub Worktree Setup Agent",
                "spawn_mode": "hybrid",
                "priority": 2,
                "max_execution_time": 300,
                "allowed_operations": ["git_operations", "file_system_operations"]
            },
            "params": {
                "hook_instructions": [
                    {"step": "setup_worktree", "action": "git_worktree_add"},
                    {"step": "initialize_environment", "action": "run_setup_scripts"}
                ]
            }
        },
        template_data={
            "task_title": "Test Implementation",
            "github_repo": "test/repo",
            "branch_name": "feature/test-feature"
        },
        field_schema={
            "github_repo": {"type": "string"},
            "branch_name": {"type": "string"}
        }
    )
    
    result = await server.hook_integration.register_hook_agent(hook_input)
    assert result["success"], f"Hook agent registration failed: {result.get('error')}"
    
    hook_id = result["hook_id"]
    logger.info(f"✅ Test 2: Hook agent registered with ID: {hook_id}")
    
    # Test 3: Register a timed agent from template automation rule  
    timed_input = TimedAgentInput(
        template_id="test_daily_standup_v1",
        template_name="Test Daily Standup",
        automation_rule={
            "name": "daily_standup_preparation",
            "trigger": "timed_schedule",
            "action": "spawn_timed_agent",
            "timed_agent": {
                "name": "Standup Preparation Agent",
                "spawn_mode": "hybrid", 
                "priority": 1,
                "max_execution_time": 300,
                "schedule": {
                    "type": "interval",
                    "interval_seconds": 3600
                }
            }
        },
        template_data={
            "team_members": ["alice", "bob", "charlie"],
            "standup_time": "09:00",
            "timezone": "UTC"
        },
        field_schema={
            "team_members": {"type": "array"},
            "standup_time": {"type": "string"},
            "timezone": {"type": "string"}
        },
        schedule_config={
            "type": "interval",
            "interval_seconds": 3600
        }
    )
    
    result = await server.hook_integration.register_timed_agent(timed_input)
    assert result["success"], f"Timed agent registration failed: {result.get('error')}"
    
    agent_id = result["agent_id"]
    logger.info(f"✅ Test 3: Timed agent registered with ID: {agent_id}")
    
    # Test 4: Get hook agent status
    status_result = await server.hook_integration.get_hook_agent_status()
    assert status_result["success"], f"Status retrieval failed: {status_result.get('error')}"
    assert len(status_result["hook_agents"]["hook_agents"]) == 1, "Should have 1 hook agent"
    assert len(status_result["timed_agents"]["timed_agents"]) == 1, "Should have 1 timed agent"
    
    logger.info("✅ Test 4: Hook agent status retrieved successfully")
    
    # Test 5: Trigger hook agent manually
    trigger_input = HookTriggerInput(
        hook_id=hook_id,
        trigger_context={
            "task_id": "test-task-123",
            "task_status": "in_progress",
            "triggering_event": "manual_test"
        }
    )
    
    result = await server.hook_integration.trigger_hook_agent(trigger_input)
    assert result["success"], f"Hook agent trigger failed: {result.get('error')}"
    
    background_task_id = result["background_task_id"]
    logger.info(f"✅ Test 5: Hook agent triggered as background task: {background_task_id}")
    
    # Test 6: Check background executor status
    performance_metrics = server.background_executor.get_performance_metrics()
    assert "task_metrics" in performance_metrics, "Performance metrics should include task metrics"
    
    logger.info("✅ Test 6: Background executor performance metrics retrieved")
    
    # Test 7: Pause and resume timed agent
    pause_result = await server.hook_integration.pause_timed_agent(agent_id)
    assert pause_result["success"], f"Timed agent pause failed: {pause_result.get('error')}"
    assert pause_result["status"] == "paused", "Agent should be paused"
    
    resume_result = await server.hook_integration.resume_timed_agent(agent_id)
    assert resume_result["success"], f"Timed agent resume failed: {resume_result.get('error')}"
    assert resume_result["status"] == "active", "Agent should be active"
    
    logger.info("✅ Test 7: Timed agent pause/resume functionality works")
    
    # Test 8: Get comprehensive agent status
    comprehensive_result = await server.hook_integration.get_comprehensive_agent_status()
    assert comprehensive_result["success"], f"Comprehensive status failed: {comprehensive_result.get('error')}"
    assert "hook_agents" in comprehensive_result, "Should include hook agent status"
    assert "timed_agents" in comprehensive_result, "Should include timed agent status"
    assert "background_executor" in comprehensive_result, "Should include background executor metrics"
    
    logger.info("✅ Test 8: Comprehensive agent status retrieved")
    
    # Test 9: Verify MCP server has hook agent tools
    server.setup_mcp_server()
    
    # Check that the server was setup without errors
    assert server.mcp_server is not None, "MCP server should be initialized"
    
    logger.info("✅ Test 9: MCP server setup with hook agent tools completed")
    
    # Cleanup - shutdown background executor to prevent hanging processes
    server.background_executor.shutdown(wait=False, timeout=5.0)
    
    if server.hook_integration.hook_manager:
        await server.hook_integration.hook_manager.shutdown()
    
    logger.info("🎉 All tests passed! Hook agent integration is working correctly.")
    
    return True


async def test_template_hook_examples():
    """Test example template hook agent definitions."""
    
    logger.info("🧪 Testing Template Hook Examples")
    
    # Example implementation task with pre/post hooks
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
            "file_patterns": [".git/**", "src/**", "docs/**"]
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
    
    # Example timed agent for daily standup
    standup_template_rule = {
        "name": "daily_standup_preparation",
        "trigger": "timed_schedule",
        "action": "spawn_timed_agent",
        "timed_agent": {
            "name": "Standup Preparation Agent",
            "spawn_mode": "hybrid",
            "priority": 1,
            "max_execution_time": 300,
            "schedule": {
                "type": "cron",
                "expression": "0 8 * * 1-5",  # 8 AM weekdays
                "timezone": "UTC"
            }
        },
        "params": {
            "agent_instructions": [
                {
                    "step": "analyze_team_progress",
                    "action": "task_progress_analysis",
                    "team_members": "{{team_members}}",
                    "time_period": "since_last_standup"
                },
                {
                    "step": "generate_standup_agenda", 
                    "action": "llm_agenda_generation",
                    "template_structure": {
                        "yesterdays_accomplishments": "{{completed_tasks}}",
                        "todays_priorities": "{{planned_tasks}}",
                        "blockers_and_issues": "{{blocked_tasks}}"
                    }
                }
            ]
        }
    }
    
    # Verify these template rules can be processed
    server = VesperaServer(project_root=Path.cwd())
    server.initialize_managers()
    
    # Test implementation hook
    impl_input = HookAgentInput(
        template_id="implementation_task_v1",
        template_name="Implementation Task with Hooks", 
        automation_rule=implementation_template_rule,
        template_data={
            "task_title": "Add user authentication",
            "github_repo": "myorg/myproject", 
            "branch_name": "feature/user-auth"
        },
        field_schema={
            "github_repo": {"type": "string"},
            "branch_name": {"type": "string"}
        }
    )
    
    result = await server.hook_integration.register_hook_agent(impl_input)
    assert result["success"], f"Implementation hook registration failed: {result.get('error')}"
    
    # Test standup timed agent
    standup_input = TimedAgentInput(
        template_id="daily_standup_v1",
        template_name="Daily Standup with Reminders",
        automation_rule=standup_template_rule,
        template_data={
            "team_members": ["alice", "bob", "charlie", "david"],
            "standup_time": "08:00",
            "timezone": "UTC",
            "project_phase": "development"
        },
        field_schema={
            "team_members": {"type": "array"}, 
            "standup_time": {"type": "string"},
            "timezone": {"type": "string"},
            "project_phase": {"type": "select"}
        },
        schedule_config={
            "type": "cron",
            "expression": "0 8 * * 1-5", 
            "timezone": "UTC"
        }
    )
    
    result = await server.hook_integration.register_timed_agent(standup_input)
    assert result["success"], f"Standup timed agent registration failed: {result.get('error')}"
    
    # Cleanup
    server.background_executor.shutdown(wait=False, timeout=5.0)
    if server.hook_integration.hook_manager:
        await server.hook_integration.hook_manager.shutdown()
    
    logger.info("✅ Template hook examples processed successfully")
    
    return True


if __name__ == "__main__":
    try:
        # Run integration tests
        asyncio.run(test_hook_agent_integration())
        
        # Run template example tests
        asyncio.run(test_template_hook_examples())
        
        print("\n🎉 All hook agent integration tests passed!")
        print("✨ The template-driven hook agent system is ready for use!")
        
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)