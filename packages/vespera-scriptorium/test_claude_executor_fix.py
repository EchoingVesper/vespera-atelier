#!/usr/bin/env python3
"""
Test the fixed Claude executor with proper command format.
"""

import asyncio
import sys
import tempfile
from pathlib import Path

# Add the current directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

from roles.definitions import Role, ToolGroup
from roles.execution import ExecutionContext
from roles.claude_executor import ClaudeExecutor, ClaudeExecutionConfig

async def test_claude_executor():
    print("Testing fixed Claude executor...")
    
    # Create a simple test role
    test_role = Role(
        name="test_role",
        display_name="Test Role",
        description="Simple test role",
        system_prompt="You are a helpful test assistant.",
        preferred_llm="claude",
        tool_groups=[ToolGroup.READ],
        restrictions=[],
        context_requirements=[],
        task_types=["testing"],
        validation_rules=[]
    )
    
    # Create execution context
    context = ExecutionContext(
        role=test_role,
        task_prompt="Just respond with: Hello, I am a real Claude agent!",
        linked_documents=[],
        project_context="Test project context",
        parent_context=None,
        tool_group_restrictions=[],
        validation_requirements=[]
    )
    
    # Create executor with config
    config = ClaudeExecutionConfig(
        claude_binary="claude",
        working_directory=str(Path.cwd()),
        timeout=30
    )
    
    executor = ClaudeExecutor(Path.cwd(), config)
    
    try:
        # Test the execution
        print("Executing task with Claude CLI...")
        result = await executor.execute_task_with_claude(context, "test_task_123", dry_run=False)
        
        print(f"Execution completed!")
        print(f"Status: {result.status}")
        print(f"Execution time: {result.execution_time:.2f}s")
        print(f"Output length: {len(result.output)}")
        print(f"Output: {result.output}")
        
        if result.error_message:
            print(f"Error: {result.error_message}")
            
        return result.status.value == "completed"
        
    except Exception as e:
        print(f"Exception during execution: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_claude_executor())
    print(f"\nTest {'PASSED' if success else 'FAILED'}")
    sys.exit(0 if success else 1)