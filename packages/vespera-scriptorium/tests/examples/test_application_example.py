"""
Example Application Layer Test

Demonstrates testing patterns for use cases, DTOs, and application services
using the test infrastructure.
"""

import pytest
from unittest.mock import AsyncMock

from tests.infrastructure import ApplicationTestWithMocking
from tests.infrastructure.application_test_helpers import (
    DTOTestBuilder,
    UseCaseTestHelper,
    ApplicationTestScenarios,
    ApplicationAssertions,
    PerformanceTestHelper
)

from vespera_scriptorium.application.dto.task_dtos import (
    CreateTaskRequest,
    UpdateTaskRequest,
    CompleteTaskRequest,
    TaskResponse
)


@pytest.mark.application
class TestTaskCreationUseCase(ApplicationTestWithMocking):
    """Test task creation use case."""
    
    async def setup_test_configuration(self):
        """Configure for application testing."""
        self.test_config.mock_external_services = True
        self.test_config.use_in_memory_storage = True
    
    async def register_mock_infrastructure(self, registrar):
        """Register mocked infrastructure services."""
        # Mock task repository
        task_repo_mock = self.create_repository_mock(type("TaskRepository"))
        task_repo_mock.save.return_value = True
        task_repo_mock.get_by_id.return_value = None
        task_repo_mock.exists.return_value = False
        
        registrar.singleton(type("TaskRepository"), lambda: task_repo_mock)
        
        # Mock notification service
        notification_mock = self.create_external_service_mock(type("NotificationService"))
        notification_mock.send_notification.return_value = True
        
        registrar.singleton(type("NotificationService"), lambda: notification_mock)
    
    async def register_application_services(self, registrar):
        """Register application services."""
        # This would register actual use cases
        # For example purposes, we'll use mock use cases
        create_task_use_case = AsyncMock()
        create_task_use_case.execute.return_value = type('Result', (), {
            'success': True,
            'task_id': 'test_task_123',
            'data': {'task_id': 'test_task_123'}
        })()
        
        registrar.singleton(type("CreateTaskUseCase"), lambda: create_task_use_case)
    
    async def test_create_task_success(self, dto_builder):
        """Test successful task creation."""
        # Arrange
        create_request = dto_builder.create_create_task_request(
            title="Test Task",
            description="A test task for application testing",
            specialist_type="coder"
        )
        
        # Act
        async with self.use_case_context(type("CreateTaskUseCase")) as use_case:
            result = await use_case.execute(create_request)
        
        # Assert
        assert result.success
        assert result.task_id == 'test_task_123'
        
        # Verify repository was called
        task_repo = self.get_service(type("TaskRepository"))
        task_repo.save.assert_called_once()
    
    async def test_create_task_with_invalid_data(self, dto_builder):
        """Test task creation with invalid data."""
        # Arrange - Create invalid request
        create_request = dto_builder.create_create_task_request(
            title="",  # Empty title should be invalid
            description="Invalid task test"
        )
        
        # Mock use case to return failure
        use_case = self.get_service(type("CreateTaskUseCase"))
        use_case.execute.return_value = type('Result', (), {
            'success': False,
            'error': 'Task title cannot be empty',
            'error_code': 'VALIDATION_ERROR'
        })()
        
        # Act
        result = await self.execute_use_case(
            type("CreateTaskUseCase"),
            create_request,
            expected_success=False
        )
        
        # Assert
        assert not result.success
        assert "title" in result.error.lower()
    
    async def test_create_task_workflow_helper(self):
        """Test task creation using workflow helper."""
        # Arrange
        helper = UseCaseTestHelper(self.container)
        
        # Execute workflow
        workflow_steps = [
            (
                type("CreateTaskUseCase"),
                DTOTestBuilder.create_create_task_request(
                    title="Workflow Test Task",
                    description="Testing workflow execution"
                ),
                True  # Expected success
            )
        ]
        
        results = await helper.execute_workflow(workflow_steps)
        
        # Assert
        assert len(results) == 1
        assert results[0].success
        
        # Check execution history
        history = helper.get_execution_history()
        assert len(history) == 1
        assert history[0]["use_case"] == "CreateTaskUseCase"


@pytest.mark.application
class TestTaskUpdateUseCase(ApplicationTestWithMocking):
    """Test task update use case."""
    
    async def register_mock_infrastructure(self, registrar):
        """Register mocked services for update testing."""
        # Mock repository with existing task
        task_repo_mock = self.create_repository_mock(type("TaskRepository"))
        
        # Mock existing task
        existing_task = type('Task', (), {
            'task_id': 'existing_task_123',
            'title': 'Original Title',
            'description': 'Original Description',
            'status': 'pending'
        })()
        
        task_repo_mock.get_by_id.return_value = existing_task
        task_repo_mock.save.return_value = True
        
        registrar.singleton(type("TaskRepository"), lambda: task_repo_mock)
    
    async def register_application_services(self, registrar):
        """Register update use case."""
        update_use_case = AsyncMock()
        update_use_case.execute.return_value = type('Result', (), {
            'success': True,
            'task_id': 'existing_task_123',
            'updated_fields': ['title', 'description']
        })()
        
        registrar.singleton(type("UpdateTaskUseCase"), lambda: update_use_case)
    
    async def test_update_existing_task(self, dto_builder):
        """Test updating existing task."""
        # Arrange
        update_request = dto_builder.create_update_task_request(
            task_id="existing_task_123",
            title="Updated Title",
            description="Updated Description"
        )
        
        # Act
        result = await self.execute_use_case(
            type("UpdateTaskUseCase"),
            update_request
        )
        
        # Assert
        assert result.success
        assert result.data['task_id'] == 'existing_task_123'
        
        # Verify repository interactions
        task_repo = self.get_service(type("TaskRepository"))
        task_repo.get_by_id.assert_called_with("existing_task_123")
        task_repo.save.assert_called_once()
    
    async def test_update_nonexistent_task(self, dto_builder):
        """Test updating non-existent task."""
        # Arrange - Mock repository to return None
        task_repo = self.get_service(type("TaskRepository"))
        task_repo.get_by_id.return_value = None
        
        # Mock use case to return failure
        use_case = self.get_service(type("UpdateTaskUseCase"))
        use_case.execute.return_value = type('Result', (), {
            'success': False,
            'error': 'Task not found',
            'error_code': 'NOT_FOUND'
        })()
        
        update_request = dto_builder.create_update_task_request(
            task_id="nonexistent_task",
            title="Updated Title"
        )
        
        # Act
        result = await self.execute_use_case(
            type("UpdateTaskUseCase"),
            update_request,
            expected_success=False
        )
        
        # Assert
        assert not result.success
        assert "not found" in result.error.lower()


@pytest.mark.application
class TestTaskCompletionUseCase(ApplicationTestWithMocking):
    """Test task completion use case."""
    
    async def register_mock_infrastructure(self, registrar):
        """Register mocked services for completion testing."""
        # Mock repository
        task_repo_mock = self.create_repository_mock(type("TaskRepository"))
        
        # Mock task in progress
        task_in_progress = type('Task', (), {
            'task_id': 'in_progress_task',
            'title': 'Task In Progress',
            'status': 'in_progress',
            'artifacts': []
        })()
        
        task_repo_mock.get_by_id.return_value = task_in_progress
        task_repo_mock.save.return_value = True
        
        registrar.singleton(type("TaskRepository"), lambda: task_repo_mock)
        
        # Mock artifact storage
        artifact_storage_mock = self.create_external_service_mock(type("ArtifactStorage"))
        artifact_storage_mock.store_artifact.return_value = "artifact_123"
        
        registrar.singleton(type("ArtifactStorage"), lambda: artifact_storage_mock)
    
    async def register_application_services(self, registrar):
        """Register completion use case."""
        complete_use_case = AsyncMock()
        complete_use_case.execute.return_value = type('Result', (), {
            'success': True,
            'task_id': 'in_progress_task',
            'status': 'completed',
            'artifacts_created': ['artifact_123']
        })()
        
        registrar.singleton(type("CompleteTaskUseCase"), lambda: complete_use_case)
    
    async def test_complete_task_success(self, dto_builder):
        """Test successful task completion."""
        # Arrange
        complete_request = dto_builder.create_complete_task_request(
            task_id="in_progress_task",
            summary="Task completed successfully",
            detailed_work="All work has been completed as specified"
        )
        
        # Act
        result = await self.execute_use_case(
            type("CompleteTaskUseCase"),
            complete_request
        )
        
        # Assert
        assert result.success
        assert result.data['status'] == 'completed'
        assert 'artifacts_created' in result.data
        
        # Verify services were called
        task_repo = self.get_service(type("TaskRepository"))
        task_repo.save.assert_called_once()
        
        artifact_storage = self.get_service(type("ArtifactStorage"))
        artifact_storage.store_artifact.assert_called_once()
    
    async def test_complete_already_completed_task(self, dto_builder):
        """Test completing already completed task."""
        # Arrange - Mock task as already completed
        task_repo = self.get_service(type("TaskRepository"))
        completed_task = type('Task', (), {
            'task_id': 'completed_task',
            'status': 'completed'
        })()
        task_repo.get_by_id.return_value = completed_task
        
        # Mock use case to return failure
        use_case = self.get_service(type("CompleteTaskUseCase"))
        use_case.execute.return_value = type('Result', (), {
            'success': False,
            'error': 'Task is already completed',
            'error_code': 'INVALID_STATE'
        })()
        
        complete_request = dto_builder.create_complete_task_request(
            task_id="completed_task",
            summary="Attempting to complete again"
        )
        
        # Act
        result = await self.execute_use_case(
            type("CompleteTaskUseCase"),
            complete_request,
            expected_success=False
        )
        
        # Assert
        assert not result.success
        assert "already completed" in result.error.lower()


@pytest.mark.application
class TestDTOValidation(ApplicationTestWithMocking):
    """Test DTO validation and serialization."""
    
    def test_create_task_request_validation(self, dto_builder):
        """Test CreateTaskRequest DTO validation."""
        # Valid DTO
        valid_dto = dto_builder.create_create_task_request(
            title="Valid Task",
            description="Valid description"
        )
        
        ApplicationAssertions.assert_dto_valid(valid_dto, CreateTaskRequest)
        
        # Test required fields
        assert valid_dto.title == "Valid Task"
        assert valid_dto.description == "Valid description"
        assert hasattr(valid_dto, 'specialist_type')
    
    def test_update_task_request_validation(self, dto_builder):
        """Test UpdateTaskRequest DTO validation."""
        update_dto = dto_builder.create_update_task_request(
            task_id="test_task_123",
            title="Updated Title"
        )
        
        ApplicationAssertions.assert_dto_valid(update_dto, UpdateTaskRequest)
        assert update_dto.task_id == "test_task_123"
        assert update_dto.title == "Updated Title"
    
    def test_complete_task_request_validation(self, dto_builder):
        """Test CompleteTaskRequest DTO validation."""
        complete_dto = dto_builder.create_complete_task_request(
            task_id="test_task_123",
            summary="Completion summary"
        )
        
        ApplicationAssertions.assert_dto_valid(complete_dto, CompleteTaskRequest)
        assert complete_dto.task_id == "test_task_123"
        assert complete_dto.summary == "Completion summary"
    
    def test_task_response_dto(self, dto_builder):
        """Test TaskResponse DTO."""
        response_dto = dto_builder.create_task_response(
            task_id="response_test_123",
            title="Response Test Task"
        )
        
        ApplicationAssertions.assert_dto_valid(response_dto, TaskResponse)
        assert response_dto.task_id == "response_test_123"
        assert response_dto.title == "Response Test Task"


@pytest.mark.application
class TestApplicationScenarios(ApplicationTestWithMocking):
    """Test pre-built application scenarios."""
    
    async def register_mock_infrastructure(self, registrar):
        """Setup mocks for scenario testing."""
        # Mock all required services
        task_repo_mock = self.create_repository_mock(type("TaskRepository"))
        task_repo_mock.save.return_value = True
        task_repo_mock.get_by_id.return_value = None
        
        registrar.singleton(type("TaskRepository"), lambda: task_repo_mock)
    
    async def register_application_services(self, registrar):
        """Register use cases for scenarios."""
        # Create task use case
        create_use_case = AsyncMock()
        create_use_case.execute.return_value = type('Result', (), {
            'success': True,
            'task_id': 'scenario_task_123'
        })()
        
        # Execute task use case
        execute_use_case = AsyncMock()
        execute_use_case.execute.return_value = type('Result', (), {
            'success': True,
            'task_id': 'scenario_task_123',
            'status': 'in_progress'
        })()
        
        # Complete task use case
        complete_use_case = AsyncMock()
        complete_use_case.execute.return_value = type('Result', (), {
            'success': True,
            'task_id': 'scenario_task_123',
            'status': 'completed'
        })()
        
        registrar.singleton(type("CreateTaskUseCase"), lambda: create_use_case)
        registrar.singleton(type("ExecuteTaskUseCase"), lambda: execute_use_case)
        registrar.singleton(type("CompleteTaskUseCase"), lambda: complete_use_case)
    
    async def test_task_creation_workflow_scenario(self):
        """Test task creation workflow scenario."""
        # Arrange
        helper = UseCaseTestHelper(self.container)
        workflow_steps = ApplicationTestScenarios.create_task_creation_workflow()
        
        # Act
        results = await helper.execute_workflow(workflow_steps)
        
        # Assert
        ApplicationAssertions.assert_workflow_result_valid(results)
        assert all(result.success for result in results)
    
    async def test_task_execution_workflow_scenario(self):
        """Test task execution workflow scenario."""
        # Arrange
        helper = UseCaseTestHelper(self.container)
        task_id = "scenario_task_123"
        workflow_steps = ApplicationTestScenarios.create_task_execution_workflow(task_id)
        
        # Act
        results = await helper.execute_workflow(workflow_steps)
        
        # Assert
        ApplicationAssertions.assert_workflow_result_valid(results)
        assert len(results) == 2  # Execute and Complete
        assert all(result.success for result in results)
    
    async def test_error_handling_scenario(self):
        """Test error handling scenario."""
        # Arrange
        helper = UseCaseTestHelper(self.container)
        
        # Override create use case to fail
        create_use_case = self.get_service(type("CreateTaskUseCase"))
        create_use_case.execute.return_value = type('Result', (), {
            'success': False,
            'error': 'Task title cannot be empty',
            'error_code': 'VALIDATION_ERROR'
        })()
        
        workflow_steps = ApplicationTestScenarios.create_error_handling_scenario()
        
        # Act
        results = await helper.execute_workflow(workflow_steps, continue_on_failure=True)
        
        # Assert
        assert len(results) >= 1
        assert not results[0].success  # First step should fail
        assert "title" in results[0].error.lower()


@pytest.mark.application
@pytest.mark.performance
class TestApplicationPerformance(ApplicationTestWithMocking):
    """Test application layer performance."""
    
    async def register_mock_infrastructure(self, registrar):
        """Setup fast mocks for performance testing."""
        # Fast repository mock
        task_repo_mock = AsyncMock()
        task_repo_mock.save.return_value = True
        task_repo_mock.get_by_id.return_value = None
        
        registrar.singleton(type("TaskRepository"), lambda: task_repo_mock)
    
    async def register_application_services(self, registrar):
        """Register fast use cases for performance testing."""
        # Fast create use case
        create_use_case = AsyncMock()
        create_use_case.execute.return_value = type('Result', (), {
            'success': True,
            'task_id': 'perf_task'
        })()
        
        registrar.singleton(type("CreateTaskUseCase"), lambda: create_use_case)
    
    async def test_use_case_execution_performance(self, performance_config):
        """Test use case execution performance."""
        # Arrange
        helper = PerformanceTestHelper()
        input_data = DTOTestBuilder.create_create_task_request(
            title="Performance Test Task"
        )
        
        # Act
        performance_data = await helper.measure_use_case_performance(
            type("CreateTaskUseCase"),
            input_data,
            self.container,
            iterations=100
        )
        
        # Assert
        max_time = performance_config["max_execution_time"] / 100  # Per operation
        assert performance_data["average_time"] < max_time
        assert performance_data["success_rate"] == 1.0  # All operations should succeed
    
    async def test_concurrent_use_case_execution(self, performance_config):
        """Test concurrent use case execution."""
        # Arrange
        concurrent_operations = []
        for i in range(performance_config["concurrent_operations"]):
            async def create_task():
                use_case = self.get_service(type("CreateTaskUseCase"))
                input_data = DTOTestBuilder.create_create_task_request(
                    title=f"Concurrent Task {i}"
                )
                return await use_case.execute(input_data)
            
            concurrent_operations.append(create_task)
        
        # Act
        results = await self.run_concurrent_operations(
            concurrent_operations,
            timeout=performance_config["max_execution_time"]
        )
        
        # Assert
        assert len(results) == performance_config["concurrent_operations"]
        successful_results = [r for r in results if hasattr(r, 'success') and r.success]
        
        success_rate = len(successful_results) / len(results)
        assert success_rate >= performance_config["performance_threshold"]


@pytest.mark.application
class TestInterfaceContracts(ApplicationTestWithMocking):
    """Test interface contracts and dependency injection."""
    
    async def test_repository_interface_contract(self):
        """Test repository interface contracts."""
        # Get repository from container
        task_repo = self.get_service(type("TaskRepository"))
        
        # Test interface contract
        from tests.infrastructure.application_test_helpers import InterfaceContractTester
        InterfaceContractTester.test_repository_interface(task_repo, type("Task"))
    
    async def test_use_case_interface_contract(self):
        """Test use case interface contracts."""
        # Get use case from container
        create_use_case = self.get_service(type("CreateTaskUseCase"))
        
        # Test interface contract
        from tests.infrastructure.application_test_helpers import InterfaceContractTester
        InterfaceContractTester.test_use_case_interface(create_use_case)
    
    async def test_dependency_injection_working(self):
        """Test dependency injection is working correctly."""
        ApplicationAssertions.assert_dependency_injection_working(self.container)
        
        # Test service resolution
        task_repo = self.get_service(type("TaskRepository"))
        assert task_repo is not None
        
        create_use_case = self.get_service(type("CreateTaskUseCase"))
        assert create_use_case is not None
        
        # Test singleton behavior (if applicable)
        task_repo2 = self.get_service(type("TaskRepository"))
        assert task_repo is task_repo2  # Should be same instance for singleton