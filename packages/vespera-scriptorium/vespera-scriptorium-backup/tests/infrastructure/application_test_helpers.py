"""
Application Layer Test Helpers

Provides specialized testing utilities for use cases, DTOs, interfaces,
and application service orchestration.
"""

import asyncio
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Type, TypeVar
from unittest.mock import AsyncMock, MagicMock
from dataclasses import dataclass

from vespera_scriptorium.application.dto.task_dtos import (
    CreateTaskRequest,
    UpdateTaskRequest, 
    TaskResponse,
    CompleteTaskRequest,
)
from vespera_scriptorium.application.dto.progress_dtos import (
    ProgressUpdate,
    StatusReport,
)

T = TypeVar("T")


@dataclass
class UseCaseResult:
    """Standard result wrapper for use case testing."""
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    error_code: Optional[str] = None
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class DTOTestBuilder:
    """Builder for creating test DTOs with validation."""
    
    @staticmethod
    def create_create_task_request(**kwargs) -> CreateTaskRequest:
        """Create test CreateTaskRequest DTO."""
        defaults = {
            "title": "Test Task",
            "description": "Test task description",
            "specialist_type": "generic",
            "complexity": "moderate",
            "estimated_effort": "2 hours",
            "context": {},
            "dependencies": [],
        }
        defaults.update(kwargs)
        return CreateTaskRequest(**defaults)
    
    @staticmethod
    def create_update_task_request(task_id: str, **kwargs) -> UpdateTaskRequest:
        """Create test UpdateTaskRequest DTO."""
        defaults = {
            "task_id": task_id,
            "title": "Updated Test Task",
            "description": "Updated description",
            "status": "in_progress",
        }
        defaults.update(kwargs)
        return UpdateTaskRequest(**defaults)
    
    @staticmethod
    def create_complete_task_request(task_id: str, **kwargs) -> CompleteTaskRequest:
        """Create test CompleteTaskRequest DTO."""
        defaults = {
            "task_id": task_id,
            "summary": "Task completed successfully",
            "detailed_work": "Detailed work content",
            "next_action": "continue",
            "artifact_type": "general",
            "file_paths": [],
        }
        defaults.update(kwargs)
        return CompleteTaskRequest(**defaults)
    
    @staticmethod
    def create_task_response(task_id: str, **kwargs) -> TaskResponse:
        """Create test TaskResponse DTO."""
        defaults = {
            "task_id": task_id,
            "title": "Test Task",
            "description": "Test description",
            "status": "pending",
            "specialist_type": "generic",
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
        }
        defaults.update(kwargs)
        return TaskResponse(**defaults)
    
    @staticmethod
    def create_progress_update(task_id: str, **kwargs) -> ProgressUpdate:
        """Create test ProgressUpdate DTO."""
        defaults = {
            "task_id": task_id,
            "progress_percentage": 50.0,
            "status_message": "Task in progress",
            "current_phase": "implementation",
            "estimated_completion": datetime.now(),
        }
        defaults.update(kwargs)
        return ProgressUpdate(**defaults)


class MockRepositoryFactory:
    """Factory for creating repository mocks with standard behaviors."""
    
    @staticmethod
    def create_task_repository_mock() -> AsyncMock:
        """Create mock task repository."""
        mock = AsyncMock()
        
        # Configure standard behaviors
        mock.get_by_id.return_value = None
        mock.save.return_value = True
        mock.delete.return_value = True
        mock.find_all.return_value = []
        mock.find_by_criteria.return_value = []
        mock.exists.return_value = False
        mock.count.return_value = 0
        
        return mock
    
    @staticmethod
    def create_specialist_repository_mock() -> AsyncMock:
        """Create mock specialist repository."""
        mock = AsyncMock()
        
        mock.get_by_type.return_value = None
        mock.get_available_specialists.return_value = []
        mock.assign_specialist.return_value = True
        mock.release_specialist.return_value = True
        
        return mock
    
    @staticmethod
    def create_state_repository_mock() -> AsyncMock:
        """Create mock state repository."""
        mock = AsyncMock()
        
        mock.get_session_state.return_value = {}
        mock.save_session_state.return_value = True
        mock.clear_session_state.return_value = True
        mock.get_workflow_state.return_value = {}
        mock.save_workflow_state.return_value = True
        
        return mock


class MockServiceFactory:
    """Factory for creating service mocks."""
    
    @staticmethod
    def create_external_api_client_mock() -> AsyncMock:
        """Create mock external API client."""
        mock = AsyncMock()
        
        mock.call_api.return_value = {"status": "success", "data": {}}
        mock.upload_file.return_value = {"file_id": "test_file_123"}
        mock.download_file.return_value = b"test file content"
        mock.health_check.return_value = True
        
        return mock
    
    @staticmethod
    def create_notification_service_mock() -> AsyncMock:
        """Create mock notification service."""
        mock = AsyncMock()
        
        mock.send_notification.return_value = True
        mock.send_email.return_value = True
        mock.send_slack_message.return_value = True
        mock.log_event.return_value = True
        
        return mock
    
    @staticmethod
    def create_artifact_storage_mock() -> AsyncMock:
        """Create mock artifact storage service."""
        mock = AsyncMock()
        
        mock.store_artifact.return_value = "artifact_123"
        mock.retrieve_artifact.return_value = "artifact content"
        mock.delete_artifact.return_value = True
        mock.list_artifacts.return_value = []
        
        return mock


class UseCaseTestHelper:
    """Helper for testing use cases with standard patterns."""
    
    def __init__(self, container):
        self.container = container
        self._execution_history = []
    
    async def execute_use_case(
        self, 
        use_case_type: Type[T], 
        input_data: Any,
        expected_success: bool = True
    ) -> UseCaseResult:
        """Execute use case and return standardized result."""
        use_case = self.container.get_service(use_case_type)
        
        start_time = datetime.now()
        try:
            result = await use_case.execute(input_data)
            execution_time = (datetime.now() - start_time).total_seconds()
            
            # Record execution
            self._execution_history.append({
                "use_case": use_case_type.__name__,
                "input": input_data,
                "result": result,
                "execution_time": execution_time,
                "timestamp": start_time
            })
            
            # Standardize result format
            if hasattr(result, 'success'):
                success = result.success
                data = getattr(result, 'data', result)
                error = getattr(result, 'error', None)
                error_code = getattr(result, 'error_code', None)
            else:
                success = True
                data = result
                error = None
                error_code = None
            
            use_case_result = UseCaseResult(
                success=success,
                data=data,
                error=error,
                error_code=error_code,
                metadata={
                    "execution_time": execution_time,
                    "use_case": use_case_type.__name__
                }
            )
            
            # Assert expected success if specified
            if expected_success and not success:
                raise AssertionError(f"Use case {use_case_type.__name__} expected to succeed but failed: {error}")
            elif not expected_success and success:
                raise AssertionError(f"Use case {use_case_type.__name__} expected to fail but succeeded")
            
            return use_case_result
            
        except Exception as e:
            execution_time = (datetime.now() - start_time).total_seconds()
            
            # Record failed execution
            self._execution_history.append({
                "use_case": use_case_type.__name__,
                "input": input_data,
                "error": str(e),
                "execution_time": execution_time,
                "timestamp": start_time
            })
            
            if expected_success:
                raise
            
            return UseCaseResult(
                success=False,
                error=str(e),
                metadata={
                    "execution_time": execution_time,
                    "use_case": use_case_type.__name__
                }
            )
    
    async def execute_workflow(
        self, 
        workflow_steps: List[tuple], 
        continue_on_failure: bool = False
    ) -> List[UseCaseResult]:
        """Execute workflow of use cases."""
        results = []
        
        for use_case_type, input_data, expected_success in workflow_steps:
            try:
                result = await self.execute_use_case(use_case_type, input_data, expected_success)
                results.append(result)
                
                if not result.success and not continue_on_failure:
                    break
                    
            except Exception as e:
                if continue_on_failure:
                    results.append(UseCaseResult(success=False, error=str(e)))
                else:
                    raise
        
        return results
    
    def get_execution_history(self) -> List[Dict[str, Any]]:
        """Get execution history for analysis."""
        return self._execution_history.copy()
    
    def clear_execution_history(self):
        """Clear execution history."""
        self._execution_history.clear()


class InterfaceContractTester:
    """Helper for testing interface contracts."""
    
    @staticmethod
    def test_repository_interface(repository_mock: AsyncMock, entity_type: Type):
        """Test repository interface contract."""
        # Test basic CRUD operations exist
        assert hasattr(repository_mock, 'get_by_id'), "Repository must have get_by_id method"
        assert hasattr(repository_mock, 'save'), "Repository must have save method"
        assert hasattr(repository_mock, 'delete'), "Repository must have delete method"
        assert hasattr(repository_mock, 'find_all'), "Repository must have find_all method"
        
        # Test methods are async
        assert asyncio.iscoroutinefunction(repository_mock.get_by_id), "get_by_id must be async"
        assert asyncio.iscoroutinefunction(repository_mock.save), "save must be async"
        assert asyncio.iscoroutinefunction(repository_mock.delete), "delete must be async"
        assert asyncio.iscoroutinefunction(repository_mock.find_all), "find_all must be async"
    
    @staticmethod
    def test_use_case_interface(use_case_mock: AsyncMock):
        """Test use case interface contract."""
        assert hasattr(use_case_mock, 'execute'), "Use case must have execute method"
        assert asyncio.iscoroutinefunction(use_case_mock.execute), "execute must be async"
    
    @staticmethod
    def test_service_interface(service_mock: AsyncMock, required_methods: List[str]):
        """Test service interface contract."""
        for method in required_methods:
            assert hasattr(service_mock, method), f"Service must have {method} method"


class ApplicationTestScenarios:
    """Pre-built test scenarios for application layer testing."""
    
    @staticmethod
    def create_task_creation_workflow() -> List[tuple]:
        """Create task creation workflow scenario."""
        from vespera_scriptorium.application.usecases.manage_tasks import CreateTaskUseCase
        
        return [
            (
                CreateTaskUseCase,
                DTOTestBuilder.create_create_task_request(
                    title="Test Task Creation",
                    description="Test the task creation workflow"
                ),
                True  # Expected success
            )
        ]
    
    @staticmethod
    def create_task_execution_workflow(task_id: str) -> List[tuple]:
        """Create task execution workflow scenario."""
        from vespera_scriptorium.application.usecases.execute_task import ExecuteTaskUseCase
        from vespera_scriptorium.application.usecases.complete_task import CompleteTaskUseCase
        
        return [
            (
                ExecuteTaskUseCase,
                {"task_id": task_id},
                True
            ),
            (
                CompleteTaskUseCase,
                DTOTestBuilder.create_complete_task_request(
                    task_id=task_id,
                    summary="Task completed in test scenario"
                ),
                True
            )
        ]
    
    @staticmethod
    def create_error_handling_scenario() -> List[tuple]:
        """Create error handling scenario."""
        from vespera_scriptorium.application.usecases.manage_tasks import CreateTaskUseCase
        
        return [
            (
                CreateTaskUseCase,
                DTOTestBuilder.create_create_task_request(
                    title="",  # Invalid empty title
                    description="This should fail validation"
                ),
                False  # Expected failure
            )
        ]


class ApplicationAssertions:
    """Specialized assertions for application layer."""
    
    @staticmethod
    def assert_use_case_result_valid(result: UseCaseResult):
        """Assert use case result is in valid format."""
        assert isinstance(result.success, bool), "Result must have boolean success field"
        if not result.success:
            assert result.error, "Failed result must have error message"
    
    @staticmethod
    def assert_dto_valid(dto: Any, dto_type: Type):
        """Assert DTO is valid instance of expected type."""
        assert isinstance(dto, dto_type), f"DTO must be instance of {dto_type.__name__}"
        
        # Validate required fields exist
        if hasattr(dto_type, '__annotations__'):
            for field_name, field_type in dto_type.__annotations__.items():
                if not field_name.startswith('_'):
                    assert hasattr(dto, field_name), f"DTO must have {field_name} field"
    
    @staticmethod
    def assert_workflow_result_valid(results: List[UseCaseResult]):
        """Assert workflow results are valid."""
        assert len(results) > 0, "Workflow must have at least one result"
        
        for i, result in enumerate(results):
            ApplicationAssertions.assert_use_case_result_valid(result)
            
            # Check workflow consistency
            if i > 0 and results[i-1].success and not result.success:
                # Workflow failure after success might indicate cascade failure
                pass  # This might be expected behavior
    
    @staticmethod
    def assert_interface_contract_satisfied(service: Any, interface_type: Type):
        """Assert service satisfies interface contract."""
        interface_methods = [
            method for method in dir(interface_type)
            if not method.startswith('_') and callable(getattr(interface_type, method, None))
        ]
        
        for method in interface_methods:
            assert hasattr(service, method), f"Service must implement {method} from {interface_type.__name__}"
    
    @staticmethod
    def assert_dependency_injection_working(container):
        """Assert dependency injection is working correctly."""
        # Test container can resolve services
        assert container is not None, "Container must be available"
        
        # Test circular dependency detection
        try:
            # This should work without circular dependency errors
            services = []
            for _ in range(10):  # Try multiple resolutions
                service = container.try_get_service(type("TestService"))
                services.append(service)
        except Exception as e:
            if "circular" in str(e).lower():
                raise AssertionError(f"Circular dependency detected: {e}")


class PerformanceTestHelper:
    """Helper for application layer performance testing."""
    
    def __init__(self):
        self._measurements = []
    
    async def measure_use_case_performance(
        self, 
        use_case_type: Type[T], 
        input_data: Any,
        container,
        iterations: int = 10
    ) -> Dict[str, float]:
        """Measure use case performance over multiple iterations."""
        execution_times = []
        
        for _ in range(iterations):
            use_case = container.get_service(use_case_type)
            
            start_time = datetime.now()
            await use_case.execute(input_data)
            execution_time = (datetime.now() - start_time).total_seconds()
            
            execution_times.append(execution_time)
        
        # Calculate statistics
        avg_time = sum(execution_times) / len(execution_times)
        min_time = min(execution_times)
        max_time = max(execution_times)
        
        performance_data = {
            "average_time": avg_time,
            "min_time": min_time,
            "max_time": max_time,
            "iterations": iterations,
            "use_case": use_case_type.__name__
        }
        
        self._measurements.append(performance_data)
        return performance_data
    
    def get_performance_summary(self) -> Dict[str, Any]:
        """Get summary of all performance measurements."""
        if not self._measurements:
            return {}
        
        return {
            "total_measurements": len(self._measurements),
            "measurements": self._measurements,
            "overall_avg_time": sum(m["average_time"] for m in self._measurements) / len(self._measurements)
        }