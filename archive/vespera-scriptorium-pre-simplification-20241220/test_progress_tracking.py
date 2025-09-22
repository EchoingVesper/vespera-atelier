#!/usr/bin/env python3
"""
Test progress tracking during Claude CLI execution phases.
"""
import asyncio
import logging
import sys
from pathlib import Path

# Setup logging to see progress messages
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Add project root to path
sys.path.append(str(Path(__file__).parent))

from roles.claude_executor import ClaudeExecutor, ClaudeExecutionConfig
from roles.definitions import Role, ToolGroup
from roles.execution import ExecutionContext


async def test_progress_tracking():
    """Test progress tracking during Claude CLI execution."""
    print("=== Testing Progress Tracking ===")
    
    # Create a test role
    test_role = Role(
        name="test-implementer",
        display_name="Test Implementer", 
        description="Test role for progress tracking",
        system_prompt="You are a test implementation specialist.",
        preferred_llm="claude-3-5-sonnet-20241022",
        tool_groups=[ToolGroup.READ, ToolGroup.EDIT]
    )
    
    # Create execution context
    context = ExecutionContext(
        role=test_role,
        task_prompt="Create a simple hello world Python script in test_hello.py",
        project_context="Testing progress tracking functionality",
        linked_documents=[],
        parent_context="",
        tool_group_restrictions=[],
        validation_requirements=[]
    )
    
    # Create Claude executor with short timeout for testing
    config = ClaudeExecutionConfig(
        claude_binary="echo",  # Use echo to simulate Claude CLI for testing
        timeout=10  # Short timeout for testing
    )
    
    executor = ClaudeExecutor(
        project_root=Path.cwd(),
        config=config
    )
    
    try:
        print("\n1. Testing with dry run (should show command preparation)...")
        result = await executor.execute_task_with_claude(
            context=context,
            task_id="test-task-001",
            dry_run=True
        )
        
        print(f"Dry run result: {result.status}")
        print(f"Output preview: {result.output[:200]}...")
        
        print("\n2. Testing actual execution (simulated with echo)...")
        # This will actually execute but with echo instead of claude
        result = await executor.execute_task_with_claude(
            context=context,
            task_id="test-task-002", 
            dry_run=False
        )
        
        print(f"Execution result: {result.status}")
        print(f"Execution time: {result.execution_time:.2f}s")
        
        print("\n3. Progress tracking test completed successfully!")
        return True
        
    except Exception as e:
        print(f"Error during testing: {e}")
        return False
    finally:
        executor.shutdown()


if __name__ == "__main__":
    success = asyncio.run(test_progress_tracking())
    sys.exit(0 if success else 1)