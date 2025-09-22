#!/usr/bin/env python3
"""
Test ClaudeExecutor in isolation to identify the failure point.
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add the current directory to the path so we can import our modules
sys.path.insert(0, str(Path(__file__).parent))

from roles.claude_executor import ClaudeExecutor, ClaudeExecutionConfig
from roles.execution import ExecutionContext
from roles.definitions import Role, ToolGroup
from roles.manager import RoleManager

# Set up detailed logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def create_test_role() -> Role:
    """Create a simple test role for testing."""
    return Role(
        name="test_role",
        display_name="Test Role",
        description="A simple test role for debugging",
        system_prompt="You are a test assistant. Follow instructions precisely.",
        preferred_llm="sonnet",
        fallback_llms=["gpt-4"],
        tool_groups=[ToolGroup.READ, ToolGroup.EDIT],
        restrictions=[],
        context_requirements=[],
        task_types=["test"],
        validation_rules=[],
        parent_role=None,
        inherits_from=[],
        version="1.0",
        created_by="debug_test",
        tags=["test"]
    )

def create_test_context() -> ExecutionContext:
    """Create a test execution context."""
    role = create_test_role()
    
    return ExecutionContext(
        role=role,
        task_prompt="Please respond with: 'ClaudeExecutor test successful'",
        linked_documents=[],
        project_context="This is a debug test",
        parent_context=None,
        tool_group_restrictions=[],
        validation_requirements=[]
    )

async def test_claude_executor_direct():
    """Test ClaudeExecutor directly."""
    logger.info("=== Testing ClaudeExecutor Directly ===")
    
    try:
        # Set up project root
        project_root = Path.cwd()
        logger.info(f"Project root: {project_root}")
        
        # Create Claude executor config
        config = ClaudeExecutionConfig(
            claude_binary="claude",
            working_directory=str(project_root),
            timeout=60,
            model=None
        )
        logger.info(f"Config: {config.__dict__}")
        
        # Create executor
        executor = ClaudeExecutor(project_root=project_root, config=config)
        logger.info("ClaudeExecutor created successfully")
        
        # Create test context
        context = create_test_context()
        logger.info(f"Test context created for role: {context.role.name}")
        
        # Generate unique task ID
        import time
        task_id = f"test_{int(time.time() * 1000)}"
        logger.info(f"Task ID: {task_id}")
        
        # Execute the task
        logger.info("=== CALLING execute_task_with_claude ===")
        result = await executor.execute_task_with_claude(
            context=context,
            task_id=task_id,
            dry_run=False
        )
        
        logger.info("=== CLAUDE EXECUTOR RESULT ===")
        logger.info(f"Status: {result.status}")
        logger.info(f"Output length: {len(result.output)}")
        logger.info(f"Output preview: {result.output[:200]}...")
        logger.info(f"Error message: {result.error_message}")
        logger.info(f"Execution time: {result.execution_time:.2f}s")
        
        return result
        
    except Exception as e:
        logger.error(f"ClaudeExecutor direct test failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return None

async def test_role_executor_integration():
    """Test the full RoleExecutor integration."""
    logger.info("=== Testing RoleExecutor Integration ===")
    
    try:
        # Create role manager with test role
        role_manager = RoleManager()
        test_role = create_test_role()
        role_manager.roles[test_role.name] = test_role
        logger.info(f"Added test role: {test_role.name}")
        
        # Import and create RoleExecutor
        from roles.execution import RoleExecutor
        
        project_root = Path.cwd()
        executor = RoleExecutor(
            role_manager=role_manager,
            project_root=project_root
        )
        logger.info("RoleExecutor created")
        
        # Execute task
        logger.info("=== CALLING RoleExecutor.execute_task ===")
        result = executor.execute_task(
            role_name="test_role",
            task_prompt="Please respond with: 'RoleExecutor integration test successful'",
            linked_documents=[],
            project_context="Integration test context",
            parent_context=None,
            dry_run=False
        )
        
        logger.info("=== ROLE EXECUTOR RESULT ===")
        logger.info(f"Status: {result.status}")
        logger.info(f"Output length: {len(result.output)}")
        logger.info(f"Output preview: {result.output[:300]}...")
        logger.info(f"Error message: {result.error_message}")
        logger.info(f"Execution time: {result.execution_time:.2f}s")
        
        return result
        
    except Exception as e:
        logger.error(f"RoleExecutor integration test failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return None

async def main():
    """Run all ClaudeExecutor tests."""
    logger.info("Starting ClaudeExecutor isolation tests...")
    
    # Test 1: Direct ClaudeExecutor test
    direct_result = await test_claude_executor_direct()
    
    # Test 2: RoleExecutor integration
    integration_result = await test_role_executor_integration()
    
    logger.info("=== SUMMARY ===")
    logger.info(f"Direct ClaudeExecutor: {'SUCCESS' if direct_result and direct_result.status.value == 'completed' else 'FAILED'}")
    logger.info(f"RoleExecutor Integration: {'SUCCESS' if integration_result and integration_result.status.value == 'completed' else 'FAILED'}")
    
    logger.info("ClaudeExecutor isolation tests completed!")

if __name__ == "__main__":
    asyncio.run(main())