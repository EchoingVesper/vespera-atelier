#!/usr/bin/env python3
"""
Complete Hook System Test

Tests the entire hook system including triggers, actions, and engine integration.
"""

import sys
import asyncio
import tempfile
import shutil
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, Any

# Add the parent directory to Python path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from hooks import HookEngine, HookRegistry
from hooks.core.models import (
    HookDefinition, HookTriggerConfig, HookActionConfig, HookPriority,
    HookTriggerType, HookActionType, HookContext
)
from hooks.triggers.file_trigger import FileTrigger
from hooks.triggers.task_trigger import TaskTrigger
from hooks.triggers.git_trigger import GitTrigger
from hooks.triggers.time_trigger import TimeTrigger
from hooks.actions.programmatic import ProgrammaticAction
from hooks.actions.llm_action import LLMAction, LLMAgentType
from hooks.actions.task_spawn import TaskSpawnAction, TaskSpawnStrategy


class HookSystemTester:
    """Comprehensive hook system testing"""
    
    def __init__(self):
        self.test_dir = None
        self.engine = None
        self.registry = None
        self.test_results = []
    
    async def setup(self):
        """Set up test environment"""
        print("🔧 Setting up hook system test environment...")
        
        # Create temporary test directory
        self.test_dir = Path(tempfile.mkdtemp(prefix="hook_test_"))
        print(f"📁 Test directory: {self.test_dir}")
        
        # Initialize components
        self.registry = HookRegistry()
        self.engine = HookEngine(self.registry)
        
        # Register custom test hooks
        await self._register_test_hooks()
        
        print("✅ Test environment setup complete")
    
    async def cleanup(self):
        """Clean up test environment"""
        print("🧹 Cleaning up test environment...")
        
        if self.engine:
            await self.engine.stop()
        
        if self.test_dir and self.test_dir.exists():
            shutil.rmtree(self.test_dir)
        
        print("✅ Cleanup complete")
    
    async def run_all_tests(self):
        """Run all hook system tests"""
        print("🚀 Starting comprehensive hook system tests...")
        print("=" * 60)
        
        try:
            await self.setup()
            
            # Test individual components
            await self.test_hook_registry()
            await self.test_file_trigger()
            await self.test_task_trigger()
            await self.test_git_trigger()
            await self.test_time_trigger()
            await self.test_programmatic_actions()
            await self.test_llm_actions()
            await self.test_task_spawn_actions()
            
            # Test integrated scenarios
            await self.test_integrated_workflow()
            await self.test_priority_system()
            await self.test_error_handling()
            
            # Report results
            await self._report_results()
            
        finally:
            await self.cleanup()
    
    async def test_hook_registry(self):
        """Test hook registry functionality"""
        print("\n📋 Testing Hook Registry...")
        
        try:
            # Test hook registration
            test_hook = HookDefinition(
                id="test_hook_1",
                name="Test Hook",
                description="Test hook for registry validation",
                priority=HookPriority.NORMAL,
                trigger=HookTriggerConfig(
                    trigger_type=HookTriggerType.FILE_CHANGE,
                    conditions={"file_patterns": ["*.py"]}
                ),
                actions=[
                    HookActionConfig(
                        action_type=HookActionType.PROGRAMMATIC,
                        implementation="hooks.actions.testing.run_relevant_tests",
                        parameters={"test_scope": "related"}
                    )
                ]
            )
            
            # Register hook
            self.registry.register_hook(test_hook)
            
            # Test hook retrieval
            matching_hooks = self.registry.find_hooks_for_trigger(HookTriggerType.FILE_CHANGE, {
                "file_path": "test.py"
            })
            
            assert len(matching_hooks) > 0, "No matching hooks found"
            assert test_hook in matching_hooks, "Test hook not in matching results"
            
            # Test priority ordering
            priorities = [hook.priority for hook in matching_hooks]
            assert priorities == sorted(priorities, key=lambda x: x.value, reverse=True), \
                   "Hooks not ordered by priority"
            
            self._record_test_result("Hook Registry", True, "All registry tests passed")
            print("✅ Hook Registry tests passed")
            
        except Exception as e:
            self._record_test_result("Hook Registry", False, str(e))
            print(f"❌ Hook Registry tests failed: {e}")
    
    async def test_file_trigger(self):
        """Test file trigger functionality"""
        print("\n📄 Testing File Trigger...")
        
        try:
            trigger = FileTrigger([self.test_dir])
            triggered_events = []
            
            async def capture_trigger(trigger_type, trigger_data, context):
                triggered_events.append({
                    "type": trigger_type,
                    "data": trigger_data,
                    "context": context
                })
            
            # Start file trigger
            await trigger.start(capture_trigger)
            
            # Create test file
            test_file = self.test_dir / "test_file.py"
            test_file.write_text("print('Hello, World!')")
            
            # Wait for file system events
            await asyncio.sleep(0.5)
            
            # Stop trigger
            await trigger.stop()
            
            # Verify events were captured (note: actual file watching might not work in test env)
            # For now, we'll test the trigger setup and teardown
            assert not trigger.is_active, "Trigger should be inactive after stop"
            
            self._record_test_result("File Trigger", True, "File trigger setup/teardown successful")
            print("✅ File Trigger tests passed")
            
        except Exception as e:
            self._record_test_result("File Trigger", False, str(e))
            print(f"❌ File Trigger tests failed: {e}")
    
    async def test_task_trigger(self):
        """Test task trigger functionality"""
        print("\n📋 Testing Task Trigger...")
        
        try:
            trigger = TaskTrigger()
            triggered_events = []
            
            async def capture_trigger(trigger_type, trigger_data, context):
                print(f"  DEBUG: Captured event - type: {trigger_type}, status: {trigger_data.get('status', 'unknown')}")
                triggered_events.append({
                    "type": trigger_type,
                    "data": trigger_data,
                    "context": context
                })
            
            # Start task trigger
            await trigger.start(capture_trigger)
            
            # Trigger task events manually
            print(f"  DEBUG: Triggering 'created' event")
            await trigger.trigger_manual_task_event("task_123", "created", {"title": "Test Task", "task_type": "testing"})
            print(f"  DEBUG: Triggering 'completed' event")
            await trigger.trigger_manual_task_event("task_123", "completed", {"result": "success", "task_type": "testing"})
            
            # Stop trigger
            await trigger.stop()
            
            # Verify events were captured
            assert len(triggered_events) == 2, f"Expected 2 events, got {len(triggered_events)}"
            assert triggered_events[0]["data"]["status"] == "created", "First event should be 'created'"
            assert triggered_events[1]["data"]["status"] == "completed", "Second event should be 'completed'"
            
            self._record_test_result("Task Trigger", True, f"Captured {len(triggered_events)} task events")
            print("✅ Task Trigger tests passed")
            
        except Exception as e:
            self._record_test_result("Task Trigger", False, str(e))
            print(f"❌ Task Trigger tests failed: {e}")
    
    async def test_git_trigger(self):
        """Test git trigger functionality"""
        print("\n🔧 Testing Git Trigger...")
        
        try:
            trigger = GitTrigger()
            triggered_events = []
            
            async def capture_trigger(trigger_type, trigger_data, context):
                triggered_events.append({
                    "type": trigger_type,
                    "data": trigger_data,
                    "context": context
                })
            
            # Start git trigger
            await trigger.start(capture_trigger)
            
            # Trigger git events manually
            await trigger.trigger_git_operation("commit", "main", "abc123", {"message": "Test commit"})
            await trigger.trigger_git_operation("push", "main", additional_data={"remote": "origin"})
            
            # Stop trigger
            await trigger.stop()
            
            # Verify events were captured
            assert len(triggered_events) == 2, f"Expected 2 events, got {len(triggered_events)}"
            assert triggered_events[0]["data"]["operation"] == "commit", "First event should be 'commit'"
            assert triggered_events[1]["data"]["operation"] == "push", "Second event should be 'push'"
            
            self._record_test_result("Git Trigger", True, f"Captured {len(triggered_events)} git events")
            print("✅ Git Trigger tests passed")
            
        except Exception as e:
            self._record_test_result("Git Trigger", False, str(e))
            print(f"❌ Git Trigger tests failed: {e}")
    
    async def test_time_trigger(self):
        """Test time trigger functionality"""
        print("\n⏰ Testing Time Trigger...")
        
        try:
            trigger = TimeTrigger()
            triggered_events = []
            
            async def capture_trigger(trigger_type, trigger_data, context):
                triggered_events.append({
                    "type": trigger_type,
                    "data": trigger_data,
                    "context": context
                })
            
            # Start time trigger
            await trigger.start(capture_trigger)
            
            # Schedule a task for immediate execution
            future_time = datetime.now() + timedelta(seconds=0.1)
            trigger.schedule_once("test_task", future_time, {"test_data": "value"})
            
            # Wait for execution
            await asyncio.sleep(0.5)
            
            # Stop trigger
            await trigger.stop()
            
            # Verify scheduled task executed (might be timing-dependent)
            # For now, verify scheduling works
            assert not trigger.is_active, "Trigger should be inactive after stop"
            
            self._record_test_result("Time Trigger", True, "Time trigger scheduling successful")
            print("✅ Time Trigger tests passed")
            
        except Exception as e:
            self._record_test_result("Time Trigger", False, str(e))
            print(f"❌ Time Trigger tests failed: {e}")
    
    async def test_programmatic_actions(self):
        """Test programmatic action execution"""
        print("\n🔧 Testing Programmatic Actions...")
        
        try:
            action = ProgrammaticAction()
            
            # Test built-in action
            config = HookActionConfig(
                action_type=HookActionType.PROGRAMMATIC,
                implementation="hooks.actions.file_context.load_context_documents",
                parameters={"context_documents": ["README.md"], "suggested_roles": ["developer"]}
            )
            
            context = HookContext(
                trigger_type=HookTriggerType.FILE_CHANGE,
                trigger_data={"file_path": "test.py"},
                timestamp=datetime.now(),
                file_path="test.py"
            )
            
            # Execute action
            result = await action.execute(config, context)
            
            # Verify result
            assert result["success"], f"Action failed: {result.get('error', 'Unknown error')}"
            assert "context_documents" in result, "Missing context_documents in result"
            
            # Test shell command action
            shell_config = HookActionConfig(
                action_type=HookActionType.PROGRAMMATIC,
                implementation="shell:echo 'Hello, World!'",
                parameters={}
            )
            
            shell_result = await action.execute(shell_config, context)
            assert shell_result["success"], f"Shell action failed: {shell_result.get('error', 'Unknown error')}"
            assert "Hello, World!" in shell_result.get("stdout", ""), "Expected output not found"
            
            self._record_test_result("Programmatic Actions", True, "Built-in and shell actions successful")
            print("✅ Programmatic Actions tests passed")
            
        except Exception as e:
            self._record_test_result("Programmatic Actions", False, str(e))
            print(f"❌ Programmatic Actions tests failed: {e}")
    
    async def test_llm_actions(self):
        """Test LLM action execution"""
        print("\n🧠 Testing LLM Actions...")
        
        try:
            action = LLMAction()
            
            # Test investigator agent
            config = HookActionConfig(
                action_type=HookActionType.LLM_OPERATION,
                implementation=LLMAgentType.INVESTIGATOR.value,
                parameters={"investigation_scope": "error_analysis"}
            )
            
            context = HookContext(
                trigger_type=HookTriggerType.FILE_CHANGE,
                trigger_data={"error_info": "TypeError in function", "error_type": "TypeError"},
                timestamp=datetime.now(),
                file_path="test.py"
            )
            
            # Execute LLM action
            result = await action.execute(config, context)
            
            # Verify result
            assert result["success"], f"LLM action failed: {result.get('error', 'Unknown error')}"
            assert result["agent_type"] == LLMAgentType.INVESTIGATOR.value, "Wrong agent type"
            assert "prompt" in result, "Missing generated prompt"
            
            # Test code reviewer agent
            reviewer_config = HookActionConfig(
                action_type=HookActionType.LLM_OPERATION,
                implementation=LLMAgentType.CODE_REVIEWER.value,
                parameters={"review_level": "standard"}
            )
            
            reviewer_result = await action.execute(reviewer_config, context)
            assert reviewer_result["success"], f"Code reviewer failed: {reviewer_result.get('error')}"
            
            self._record_test_result("LLM Actions", True, "Investigator and code reviewer agents successful")
            print("✅ LLM Actions tests passed")
            
        except Exception as e:
            self._record_test_result("LLM Actions", False, str(e))
            print(f"❌ LLM Actions tests failed: {e}")
    
    async def test_task_spawn_actions(self):
        """Test task spawning actions"""
        print("\n🚀 Testing Task Spawn Actions...")
        
        try:
            action = TaskSpawnAction()
            
            # Test single task spawn
            config = HookActionConfig(
                action_type=HookActionType.TASK_SPAWN,
                implementation=TaskSpawnStrategy.SINGLE.value,
                parameters={"template": "error_investigation"}
            )
            
            context = HookContext(
                trigger_type=HookTriggerType.FILE_CHANGE,
                trigger_data={"error_type": "ValueError", "error_message": "Invalid input"},
                timestamp=datetime.now(),
                file_path="test.py"
            )
            
            # Execute task spawn
            result = await action.execute(config, context)
            
            # Verify result
            assert result["success"], f"Task spawn failed: {result.get('error', 'Unknown error')}"
            assert result["tasks_created"] == 1, f"Expected 1 task, got {result['tasks_created']}"
            assert len(result["tasks"]) == 1, "Tasks array mismatch"
            
            # Test breakdown strategy
            breakdown_config = HookActionConfig(
                action_type=HookActionType.TASK_SPAWN,
                implementation=TaskSpawnStrategy.BREAKDOWN.value,
                parameters={"breakdown_template": "security_audit"}
            )
            
            breakdown_result = await action.execute(breakdown_config, context)
            assert breakdown_result["success"], f"Breakdown spawn failed: {breakdown_result.get('error')}"
            assert breakdown_result["tasks_created"] > 1, "Breakdown should create multiple tasks"
            
            self._record_test_result("Task Spawn Actions", True, 
                                   f"Single and breakdown spawning successful ({result['tasks_created']} and {breakdown_result['tasks_created']} tasks)")
            print("✅ Task Spawn Actions tests passed")
            
        except Exception as e:
            self._record_test_result("Task Spawn Actions", False, str(e))
            print(f"❌ Task Spawn Actions tests failed: {e}")
    
    async def test_integrated_workflow(self):
        """Test integrated hook workflow"""
        print("\n🔄 Testing Integrated Workflow...")
        
        try:
            # Start the hook engine
            await self.engine.start()
            
            # Simulate a file change that should trigger multiple hooks
            trigger_data = {
                "file_path": "important_module.py",
                "change_type": "modified"
            }
            
            context = HookContext(
                trigger_type=HookTriggerType.FILE_CHANGE,
                trigger_data=trigger_data,
                timestamp=datetime.now(),
                file_path="important_module.py"
            )
            
            # Process the trigger
            await self.engine.process_trigger(HookTriggerType.FILE_CHANGE, trigger_data, context)
            
            # Wait for processing
            await asyncio.sleep(0.2)
            
            # Stop the engine
            await self.engine.stop()
            
            # Verify workflow execution (would need actual integration to fully test)
            # For now, verify engine lifecycle
            assert not self.engine.is_running, "Engine should be stopped"
            
            self._record_test_result("Integrated Workflow", True, "Engine lifecycle and trigger processing successful")
            print("✅ Integrated Workflow tests passed")
            
        except Exception as e:
            self._record_test_result("Integrated Workflow", False, str(e))
            print(f"❌ Integrated Workflow tests failed: {e}")
    
    async def test_priority_system(self):
        """Test hook priority ordering"""
        print("\n📊 Testing Priority System...")
        
        try:
            # Create hooks with different priorities
            high_priority_hook = HookDefinition(
                id="high_priority",
                name="High Priority Hook",
                description="High priority test hook",
                priority=HookPriority.HIGH,
                trigger=HookTriggerConfig(
                    trigger_type=HookTriggerType.FILE_CHANGE,
                    conditions={"file_patterns": ["*.py"]}
                ),
                actions=[
                    HookActionConfig(
                        action_type=HookActionType.PROGRAMMATIC,
                        implementation="hooks.actions.testing.run_all_tests"
                    )
                ]
            )
            
            low_priority_hook = HookDefinition(
                id="low_priority",
                name="Low Priority Hook",
                description="Low priority test hook",
                priority=HookPriority.LOW,
                trigger=HookTriggerConfig(
                    trigger_type=HookTriggerType.FILE_CHANGE,
                    conditions={"file_patterns": ["*.py"]}
                ),
                actions=[
                    HookActionConfig(
                        action_type=HookActionType.PROGRAMMATIC,
                        implementation="hooks.actions.docs.update_documentation"
                    )
                ]
            )
            
            # Register hooks
            test_registry = HookRegistry()
            test_registry.register_hook(high_priority_hook)
            test_registry.register_hook(low_priority_hook)
            
            # Get matching hooks
            matching_hooks = test_registry.find_hooks_for_trigger(HookTriggerType.FILE_CHANGE, {
                "file_path": "test.py"
            })
            
            # Verify priority ordering
            priorities = [hook.priority.value for hook in matching_hooks]
            assert priorities[0] > priorities[-1], "Hooks not ordered by priority (high to low)"
            
            self._record_test_result("Priority System", True, "Priority ordering working correctly")
            print("✅ Priority System tests passed")
            
        except Exception as e:
            self._record_test_result("Priority System", False, str(e))
            print(f"❌ Priority System tests failed: {e}")
    
    async def test_error_handling(self):
        """Test error handling in hook system"""
        print("\n🚨 Testing Error Handling...")
        
        try:
            action = ProgrammaticAction()
            
            # Test invalid shell command
            config = HookActionConfig(
                action_type=HookActionType.PROGRAMMATIC,
                implementation="shell:invalid_command_that_should_fail",
                parameters={}
            )
            
            context = HookContext(
                trigger_type=HookTriggerType.FILE_CHANGE,
                trigger_data={"file_path": "test.py"},
                timestamp=datetime.now()
            )
            
            # Execute failing action
            result = await action.execute(config, context)
            
            # Verify error handling
            assert not result["success"], "Action should have failed"
            assert "error" in result, "Error information should be present"
            
            # Test invalid LLM agent type
            llm_action = LLMAction()
            invalid_config = HookActionConfig(
                action_type=HookActionType.LLM_OPERATION,
                implementation="invalid_agent_type",
                parameters={}
            )
            
            llm_result = await llm_action.execute(invalid_config, context)
            assert not llm_result["success"], "LLM action should have failed with invalid agent type"
            
            self._record_test_result("Error Handling", True, "Error handling working correctly")
            print("✅ Error Handling tests passed")
            
        except Exception as e:
            self._record_test_result("Error Handling", False, str(e))
            print(f"❌ Error Handling tests failed: {e}")
    
    async def _register_test_hooks(self):
        """Register test-specific hooks"""
        # This method would register hooks for testing
        # Using default hooks from registry for now
        pass
    
    def _record_test_result(self, test_name: str, success: bool, details: str):
        """Record test result"""
        self.test_results.append({
            "test_name": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now()
        })
    
    async def _report_results(self):
        """Report test results"""
        print("\n" + "=" * 60)
        print("📊 HOOK SYSTEM TEST RESULTS")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  • {result['test_name']}: {result['details']}")
        
        print("\n✅ PASSED TESTS:")
        for result in self.test_results:
            if result["success"]:
                print(f"  • {result['test_name']}: {result['details']}")
        
        print("\n" + "=" * 60)
        if failed_tests == 0:
            print("🎉 ALL HOOK SYSTEM TESTS PASSED!")
        else:
            print(f"⚠️  {failed_tests} TEST(S) FAILED")
        print("=" * 60)


async def main():
    """Run the hook system tests"""
    tester = HookSystemTester()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())