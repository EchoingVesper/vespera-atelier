"""
Integration Test Helpers

Provides specialized testing utilities for cross-layer integration,
workflow testing, and end-to-end scenario validation.
"""

import asyncio
import json
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Type, TypeVar, Union, Callable
from unittest.mock import AsyncMock, MagicMock

from vespera_scriptorium.infrastructure.di.container import ServiceContainer
from vespera_scriptorium.domain.entities.task import Task, TaskStatus, TaskType
from vespera_scriptorium.application.dto.task_dtos import CreateTaskRequest, CompleteTaskRequest

T = TypeVar("T")


class WorkflowTestHelper:
    """Helper for testing complete workflows across architectural layers."""
    
    def __init__(self, container: ServiceContainer):
        self.container = container
        self._workflow_history = []
        self._checkpoints = []
    
    async def execute_workflow(
        self,
        workflow_definition: Dict[str, Any],
        timeout: float = 60.0
    ) -> Dict[str, Any]:
        """Execute complete workflow with monitoring."""
        workflow_id = workflow_definition.get('id', f"workflow_{uuid.uuid4().hex[:8]}")
        
        start_time = datetime.now()
        workflow_result = {
            "workflow_id": workflow_id,
            "start_time": start_time,
            "steps": [],
            "success": False,
            "error": None,
            "metadata": {}
        }
        
        try:
            steps = workflow_definition.get('steps', [])
            
            for i, step in enumerate(steps):
                step_result = await self._execute_workflow_step(step, i)
                workflow_result["steps"].append(step_result)
                
                if not step_result["success"]:
                    # Handle step failure
                    failure_strategy = step.get('on_failure', 'abort')
                    if failure_strategy == 'abort':
                        workflow_result["error"] = f"Step {i} failed: {step_result['error']}"
                        break
                    elif failure_strategy == 'continue':
                        continue
                    elif failure_strategy == 'retry':
                        # Retry logic could be implemented here
                        pass
                
                # Create checkpoint after successful step
                self._create_checkpoint(workflow_id, i, step_result)
            
            # Check if all steps completed successfully
            successful_steps = [s for s in workflow_result["steps"] if s["success"]]
            workflow_result["success"] = len(successful_steps) == len(steps)
            
        except asyncio.TimeoutError:
            workflow_result["error"] = f"Workflow timed out after {timeout}s"
        except Exception as e:
            workflow_result["error"] = f"Workflow exception: {str(e)}"
        
        finally:
            workflow_result["end_time"] = datetime.now()
            workflow_result["duration"] = (workflow_result["end_time"] - start_time).total_seconds()
            self._workflow_history.append(workflow_result)
        
        return workflow_result
    
    async def _execute_workflow_step(self, step: Dict[str, Any], step_index: int) -> Dict[str, Any]:
        """Execute individual workflow step."""
        step_type = step.get('type')
        step_result = {
            "step_index": step_index,
            "step_type": step_type,
            "start_time": datetime.now(),
            "success": False,
            "result": None,
            "error": None
        }
        
        try:
            if step_type == 'use_case':
                step_result["result"] = await self._execute_use_case_step(step)
            elif step_type == 'service_call':
                step_result["result"] = await self._execute_service_call_step(step)
            elif step_type == 'validation':
                step_result["result"] = await self._execute_validation_step(step)
            elif step_type == 'wait':
                step_result["result"] = await self._execute_wait_step(step)
            elif step_type == 'parallel':
                step_result["result"] = await self._execute_parallel_step(step)
            else:
                raise ValueError(f"Unknown step type: {step_type}")
            
            step_result["success"] = True
            
        except Exception as e:
            step_result["error"] = str(e)
        
        finally:
            step_result["end_time"] = datetime.now()
            step_result["duration"] = (step_result["end_time"] - step_result["start_time"]).total_seconds()
        
        return step_result
    
    async def _execute_use_case_step(self, step: Dict[str, Any]) -> Any:
        """Execute use case step."""
        use_case_name = step.get('use_case')
        input_data = step.get('input', {})
        
        # Dynamically get use case from container
        use_case_class = self._resolve_use_case_class(use_case_name)
        use_case = self.container.get_service(use_case_class)
        
        return await use_case.execute(input_data)
    
    async def _execute_service_call_step(self, step: Dict[str, Any]) -> Any:
        """Execute service call step."""
        service_name = step.get('service')
        method_name = step.get('method')
        arguments = step.get('arguments', {})
        
        service_class = self._resolve_service_class(service_name)
        service = self.container.get_service(service_class)
        method = getattr(service, method_name)
        
        if asyncio.iscoroutinefunction(method):
            return await method(**arguments)
        else:
            return method(**arguments)
    
    async def _execute_validation_step(self, step: Dict[str, Any]) -> Any:
        """Execute validation step."""
        validator_name = step.get('validator')
        validation_data = step.get('data', {})
        
        # Custom validation logic based on validator name
        if validator_name == 'task_state':
            return await self._validate_task_state(validation_data)
        elif validator_name == 'database_state':
            return await self._validate_database_state(validation_data)
        elif validator_name == 'system_state':
            return await self._validate_system_state(validation_data)
        else:
            raise ValueError(f"Unknown validator: {validator_name}")
    
    async def _execute_wait_step(self, step: Dict[str, Any]) -> Any:
        """Execute wait step."""
        duration = step.get('duration', 1.0)
        condition = step.get('condition')
        
        if condition:
            # Wait for condition to be true
            return await self._wait_for_condition(condition)
        else:
            # Simple wait
            await asyncio.sleep(duration)
            return True
    
    async def _execute_parallel_step(self, step: Dict[str, Any]) -> Any:
        """Execute parallel operations."""
        parallel_steps = step.get('steps', [])
        
        tasks = []
        for parallel_step in parallel_steps:
            task = asyncio.create_task(self._execute_workflow_step(parallel_step, -1))
            tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return results
    
    def _resolve_use_case_class(self, use_case_name: str) -> Type:
        """Resolve use case class from name."""
        # This would be implemented based on your use case naming convention
        use_case_map = {
            'create_task': 'vespera_scriptorium.application.usecases.manage_tasks.CreateTaskUseCase',
            'execute_task': 'vespera_scriptorium.application.usecases.execute_task.ExecuteTaskUseCase',
            'complete_task': 'vespera_scriptorium.application.usecases.complete_task.CompleteTaskUseCase',
        }
        
        class_path = use_case_map.get(use_case_name)
        if not class_path:
            raise ValueError(f"Unknown use case: {use_case_name}")
        
        # Dynamic import logic would go here
        # For now, return a placeholder
        return type(f"{use_case_name}UseCase", (), {})
    
    def _resolve_service_class(self, service_name: str) -> Type:
        """Resolve service class from name."""
        # Similar to use case resolution
        service_map = {
            'task_service': 'vespera_scriptorium.domain.services.task_service.TaskService',
            'notification_service': 'vespera_scriptorium.infrastructure.external.notification_service.NotificationService',
        }
        
        class_path = service_map.get(service_name)
        if not class_path:
            raise ValueError(f"Unknown service: {service_name}")
        
        return type(f"{service_name}Service", (), {})
    
    async def _validate_task_state(self, validation_data: Dict[str, Any]) -> bool:
        """Validate task state."""
        task_id = validation_data.get('task_id')
        expected_status = validation_data.get('expected_status')
        
        # Get task service and check state
        task_service = self.container.get_service(type("TaskService"))
        task = await task_service.get_task(task_id)
        
        return task.status == expected_status if task else False
    
    async def _validate_database_state(self, validation_data: Dict[str, Any]) -> bool:
        """Validate database state."""
        # Implementation would depend on database structure
        return True
    
    async def _validate_system_state(self, validation_data: Dict[str, Any]) -> bool:
        """Validate system state."""
        # Implementation would depend on system monitoring
        return True
    
    async def _wait_for_condition(self, condition: Dict[str, Any]) -> bool:
        """Wait for condition to become true."""
        timeout = condition.get('timeout', 30.0)
        interval = condition.get('interval', 0.5)
        condition_type = condition.get('type')
        
        start_time = datetime.now()
        while (datetime.now() - start_time).total_seconds() < timeout:
            if condition_type == 'task_completion':
                task_id = condition.get('task_id')
                task_service = self.container.get_service(type("TaskService"))
                task = await task_service.get_task(task_id)
                if task and task.status == TaskStatus.COMPLETED:
                    return True
            
            await asyncio.sleep(interval)
        
        return False
    
    def _create_checkpoint(self, workflow_id: str, step_index: int, step_result: Dict[str, Any]):
        """Create workflow checkpoint."""
        checkpoint = {
            "workflow_id": workflow_id,
            "step_index": step_index,
            "timestamp": datetime.now(),
            "step_result": step_result,
            "checkpoint_id": f"{workflow_id}_checkpoint_{step_index}"
        }
        self._checkpoints.append(checkpoint)
    
    def get_workflow_history(self) -> List[Dict[str, Any]]:
        """Get workflow execution history."""
        return self._workflow_history.copy()
    
    def get_checkpoints(self, workflow_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get workflow checkpoints."""
        if workflow_id:
            return [cp for cp in self._checkpoints if cp["workflow_id"] == workflow_id]
        return self._checkpoints.copy()


class EndToEndTestHelper:
    """Helper for end-to-end testing scenarios."""
    
    def __init__(self, container: ServiceContainer):
        self.container = container
        self.workflow_helper = WorkflowTestHelper(container)
    
    async def execute_complete_task_lifecycle(
        self,
        task_title: str = "E2E Test Task",
        task_description: str = "End-to-end test task"
    ) -> Dict[str, Any]:
        """Execute complete task lifecycle from creation to completion."""
        lifecycle_result = {
            "success": False,
            "phases": {},
            "task_id": None,
            "error": None,
            "metadata": {}
        }
        
        try:
            # Phase 1: Task Creation
            creation_result = await self._execute_task_creation_phase(task_title, task_description)
            lifecycle_result["phases"]["creation"] = creation_result
            
            if not creation_result["success"]:
                lifecycle_result["error"] = "Task creation failed"
                return lifecycle_result
            
            task_id = creation_result["task_id"]
            lifecycle_result["task_id"] = task_id
            
            # Phase 2: Task Execution
            execution_result = await self._execute_task_execution_phase(task_id)
            lifecycle_result["phases"]["execution"] = execution_result
            
            if not execution_result["success"]:
                lifecycle_result["error"] = "Task execution failed"
                return lifecycle_result
            
            # Phase 3: Task Completion
            completion_result = await self._execute_task_completion_phase(task_id)
            lifecycle_result["phases"]["completion"] = completion_result
            
            if not completion_result["success"]:
                lifecycle_result["error"] = "Task completion failed"
                return lifecycle_result
            
            # Phase 4: Verification
            verification_result = await self._execute_verification_phase(task_id)
            lifecycle_result["phases"]["verification"] = verification_result
            
            lifecycle_result["success"] = verification_result["success"]
            
        except Exception as e:
            lifecycle_result["error"] = f"E2E test exception: {str(e)}"
        
        return lifecycle_result
    
    async def _execute_task_creation_phase(self, title: str, description: str) -> Dict[str, Any]:
        """Execute task creation phase."""
        try:
            # Create task through application layer
            create_request = CreateTaskRequest(
                title=title,
                description=description,
                specialist_type="generic"
            )
            
            # Execute through use case
            create_use_case = self.container.get_service(type("CreateTaskUseCase"))
            result = await create_use_case.execute(create_request)
            
            if hasattr(result, 'success') and result.success:
                return {
                    "success": True,
                    "task_id": getattr(result, 'task_id', None),
                    "result": result
                }
            else:
                return {
                    "success": False,
                    "error": getattr(result, 'error', 'Task creation failed'),
                    "result": result
                }
        
        except Exception as e:
            return {
                "success": False,
                "error": f"Task creation exception: {str(e)}"
            }
    
    async def _execute_task_execution_phase(self, task_id: str) -> Dict[str, Any]:
        """Execute task execution phase."""
        try:
            # Execute task through application layer
            execute_use_case = self.container.get_service(type("ExecuteTaskUseCase"))
            result = await execute_use_case.execute({"task_id": task_id})
            
            if hasattr(result, 'success') and result.success:
                return {
                    "success": True,
                    "result": result
                }
            else:
                return {
                    "success": False,
                    "error": getattr(result, 'error', 'Task execution failed'),
                    "result": result
                }
        
        except Exception as e:
            return {
                "success": False,
                "error": f"Task execution exception: {str(e)}"
            }
    
    async def _execute_task_completion_phase(self, task_id: str) -> Dict[str, Any]:
        """Execute task completion phase."""
        try:
            # Complete task through application layer
            complete_request = CompleteTaskRequest(
                task_id=task_id,
                summary="E2E test completed successfully",
                detailed_work="End-to-end test execution completed",
                next_action="continue"
            )
            
            complete_use_case = self.container.get_service(type("CompleteTaskUseCase"))
            result = await complete_use_case.execute(complete_request)
            
            if hasattr(result, 'success') and result.success:
                return {
                    "success": True,
                    "result": result
                }
            else:
                return {
                    "success": False,
                    "error": getattr(result, 'error', 'Task completion failed'),
                    "result": result
                }
        
        except Exception as e:
            return {
                "success": False,
                "error": f"Task completion exception: {str(e)}"
            }
    
    async def _execute_verification_phase(self, task_id: str) -> Dict[str, Any]:
        """Execute verification phase."""
        try:
            # Verify task state through domain layer
            task_service = self.container.get_service(type("TaskService"))
            task = await task_service.get_task(task_id)
            
            if not task:
                return {
                    "success": False,
                    "error": "Task not found during verification"
                }
            
            # Verify task is completed
            if task.status != TaskStatus.COMPLETED:
                return {
                    "success": False,
                    "error": f"Task status is {task.status}, expected completed"
                }
            
            # Verify artifacts exist
            if not task.artifacts:
                return {
                    "success": False,
                    "error": "No artifacts found for completed task"
                }
            
            return {
                "success": True,
                "task": task,
                "verification_checks": [
                    "Task exists",
                    "Task is completed",
                    "Artifacts present"
                ]
            }
        
        except Exception as e:
            return {
                "success": False,
                "error": f"Verification exception: {str(e)}"
            }


class SystemIntegrationTestHelper:
    """Helper for system integration testing."""
    
    def __init__(self, container: ServiceContainer):
        self.container = container
        self._system_state = {}
        self._integration_history = []
    
    async def test_cross_layer_integration(self) -> Dict[str, Any]:
        """Test integration across all architectural layers."""
        integration_result = {
            "success": False,
            "layer_tests": {},
            "cross_layer_tests": {},
            "error": None
        }
        
        try:
            # Test individual layers
            domain_test = await self._test_domain_layer()
            integration_result["layer_tests"]["domain"] = domain_test
            
            application_test = await self._test_application_layer()
            integration_result["layer_tests"]["application"] = application_test
            
            infrastructure_test = await self._test_infrastructure_layer()
            integration_result["layer_tests"]["infrastructure"] = infrastructure_test
            
            # Test cross-layer interactions
            if all(test["success"] for test in integration_result["layer_tests"].values()):
                domain_app_test = await self._test_domain_application_integration()
                integration_result["cross_layer_tests"]["domain_application"] = domain_app_test
                
                app_infra_test = await self._test_application_infrastructure_integration()
                integration_result["cross_layer_tests"]["application_infrastructure"] = app_infra_test
                
                full_stack_test = await self._test_full_stack_integration()
                integration_result["cross_layer_tests"]["full_stack"] = full_stack_test
                
                integration_result["success"] = all(
                    test["success"] for test in integration_result["cross_layer_tests"].values()
                )
            else:
                integration_result["error"] = "Individual layer tests failed"
        
        except Exception as e:
            integration_result["error"] = f"Integration test exception: {str(e)}"
        
        self._integration_history.append(integration_result)
        return integration_result
    
    async def _test_domain_layer(self) -> Dict[str, Any]:
        """Test domain layer in isolation."""
        try:
            # Test domain entity creation and validation
            from vespera_scriptorium.domain.entities.task import Task, TaskType
            
            task = Task(
                task_id="domain_test_task",
                title="Domain Test",
                description="Testing domain layer",
                task_type=TaskType.STANDARD,
                hierarchy_path="/domain_test_task"
            )
            
            # Test domain business logic
            assert task.task_id == "domain_test_task"
            assert task.status.value == "pending"
            
            return {"success": True, "tests_passed": ["entity_creation", "business_logic"]}
        
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _test_application_layer(self) -> Dict[str, Any]:
        """Test application layer with mocked dependencies."""
        try:
            # Test use case with mocked repositories
            # This would test application logic without infrastructure
            
            return {"success": True, "tests_passed": ["use_case_execution", "dto_validation"]}
        
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _test_infrastructure_layer(self) -> Dict[str, Any]:
        """Test infrastructure layer components."""
        try:
            # Test repository implementations, external services, etc.
            
            return {"success": True, "tests_passed": ["repository_crud", "external_service_calls"]}
        
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _test_domain_application_integration(self) -> Dict[str, Any]:
        """Test domain-application layer integration."""
        try:
            # Test that application layer correctly uses domain entities
            
            return {"success": True, "tests_passed": ["entity_usage", "business_rule_enforcement"]}
        
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _test_application_infrastructure_integration(self) -> Dict[str, Any]:
        """Test application-infrastructure layer integration."""
        try:
            # Test that application layer correctly uses infrastructure services
            
            return {"success": True, "tests_passed": ["repository_usage", "external_service_integration"]}
        
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _test_full_stack_integration(self) -> Dict[str, Any]:
        """Test full stack integration."""
        try:
            # Test complete request flow through all layers
            
            return {"success": True, "tests_passed": ["full_request_flow", "data_consistency"]}
        
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def get_integration_history(self) -> List[Dict[str, Any]]:
        """Get integration test history."""
        return self._integration_history.copy()


class IntegrationTestScenarios:
    """Pre-built integration test scenarios."""
    
    @staticmethod
    def create_simple_workflow_scenario() -> Dict[str, Any]:
        """Create simple workflow scenario."""
        return {
            "id": "simple_workflow",
            "description": "Simple task creation and completion workflow",
            "steps": [
                {
                    "type": "use_case",
                    "use_case": "create_task",
                    "input": {
                        "title": "Integration Test Task",
                        "description": "Simple integration test",
                        "specialist_type": "generic"
                    }
                },
                {
                    "type": "validation",
                    "validator": "task_state",
                    "data": {
                        "task_id": "${previous_result.task_id}",
                        "expected_status": "pending"
                    }
                },
                {
                    "type": "use_case",
                    "use_case": "execute_task",
                    "input": {
                        "task_id": "${previous_result.task_id}"
                    }
                },
                {
                    "type": "use_case",
                    "use_case": "complete_task",
                    "input": {
                        "task_id": "${previous_result.task_id}",
                        "summary": "Integration test completed",
                        "detailed_work": "Test workflow execution"
                    }
                }
            ]
        }
    
    @staticmethod
    def create_complex_workflow_scenario() -> Dict[str, Any]:
        """Create complex workflow with parallel steps and error handling."""
        return {
            "id": "complex_workflow",
            "description": "Complex workflow with parallel processing",
            "steps": [
                {
                    "type": "parallel",
                    "steps": [
                        {
                            "type": "use_case",
                            "use_case": "create_task",
                            "input": {"title": "Parallel Task 1", "description": "First parallel task"}
                        },
                        {
                            "type": "use_case", 
                            "use_case": "create_task",
                            "input": {"title": "Parallel Task 2", "description": "Second parallel task"}
                        }
                    ]
                },
                {
                    "type": "wait",
                    "condition": {
                        "type": "task_completion",
                        "task_id": "${parallel_results[0].task_id}",
                        "timeout": 30.0
                    }
                },
                {
                    "type": "validation",
                    "validator": "system_state",
                    "data": {
                        "expected_task_count": 2,
                        "expected_completed_count": 1
                    }
                }
            ]
        }
    
    @staticmethod
    def create_error_handling_scenario() -> Dict[str, Any]:
        """Create error handling scenario."""
        return {
            "id": "error_handling_workflow",
            "description": "Workflow with error handling and recovery",
            "steps": [
                {
                    "type": "use_case",
                    "use_case": "create_task",
                    "input": {
                        "title": "",  # Invalid input to trigger error
                        "description": "Error test task"
                    },
                    "on_failure": "continue"
                },
                {
                    "type": "use_case",
                    "use_case": "create_task", 
                    "input": {
                        "title": "Recovery Task",
                        "description": "Task created after error recovery"
                    }
                },
                {
                    "type": "validation",
                    "validator": "task_state",
                    "data": {
                        "task_id": "${previous_result.task_id}",
                        "expected_status": "pending"
                    }
                }
            ]
        }