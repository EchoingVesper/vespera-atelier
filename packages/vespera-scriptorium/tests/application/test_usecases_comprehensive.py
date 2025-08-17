"""
Comprehensive Application Layer Tests - Use Cases

Tests for all application use cases focusing on orchestration logic,
business workflow coordination, and cross-domain integration.
"""

import pytest
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from unittest.mock import Mock, AsyncMock, patch, MagicMock

from vespera_scriptorium.application.usecases.manage_tasks import (
    CreateTaskUseCase,
    UpdateTaskUseCase,
    DeleteTaskUseCase,
    GetTaskUseCase,
    ListTasksUseCase
)
from vespera_scriptorium.application.usecases.execute_task import ExecuteTaskUseCase
from vespera_scriptorium.application.usecases.complete_task import CompleteTaskUseCase
from vespera_scriptorium.application.usecases.orchestrate_task import OrchestrationUseCase
from vespera_scriptorium.application.usecases.manage_specialists import (
    AssignSpecialistUseCase,
    ListSpecialistsUseCase
)
from vespera_scriptorium.application.usecases.track_progress import (
    TrackProgressUseCase,
    GetProgressUseCase
)

from vespera_scriptorium.application.dto.task_dtos import (
    CreateTaskRequest,
    UpdateTaskRequest,
    TaskResponse,
    TaskListResponse,
    TaskExecutionRequest,
    TaskCompletionRequest
)
from vespera_scriptorium.application.dto.progress_dtos import (
    ProgressTrackingRequest,
    ProgressResponse
)
from vespera_scriptorium.application.dto.error_responses import (
    ErrorResponse,
    ValidationErrorResponse
)

from vespera_scriptorium.domain.entities.task import Task, TaskStatus, TaskType, LifecycleStage
from vespera_scriptorium.domain.value_objects.complexity_level import ComplexityLevel
from vespera_scriptorium.domain.services.task_service import TaskService
from vespera_scriptorium.domain.services.orchestration_coordinator import OrchestrationCoordinator
from vespera_scriptorium.domain.services.specialist_assignment_service import SpecialistAssignmentService
from vespera_scriptorium.domain.services.progress_tracking_service import ProgressTrackingService
from vespera_scriptorium.domain.exceptions.task_errors import (
    TaskNotFoundError,
    TaskValidationError,
    TaskTransitionError
)


@pytest.mark.application
@pytest.mark.unit
@pytest.mark.async_test
class TestCreateTaskUseCase:
    """Test CreateTaskUseCase application use case."""

    @pytest.fixture
    def mock_task_service(self):
        """Create mock task service."""
        return AsyncMock(spec=TaskService)

    @pytest.fixture
    def create_task_use_case(self, mock_task_service):
        """Create CreateTaskUseCase with mocked dependencies."""
        return CreateTaskUseCase(task_service=mock_task_service)

    @pytest.fixture
    def valid_create_request(self):
        """Create valid task creation request."""
        return CreateTaskRequest(
            title="Test Task",
            description="A test task for validation",
            task_type=TaskType.STANDARD,
            complexity=ComplexityLevel.MODERATE,
            specialist_type="coder",
            estimated_effort="4 hours",
            parent_task_id=None,
            context={"project": "test"}
        )

    async def test_create_task_success(self, create_task_use_case, mock_task_service, valid_create_request):
        """Test successful task creation."""
        # Setup
        created_task = Task(
            task_id="generated_task_001",
            title=valid_create_request.title,
            description=valid_create_request.description,
            hierarchy_path="/generated_task_001",
            task_type=valid_create_request.task_type,
            complexity=valid_create_request.complexity,
            specialist_type=valid_create_request.specialist_type
        )
        
        mock_task_service.create_task.return_value = created_task
        
        # Execute
        result = await create_task_use_case.execute(valid_create_request)
        
        # Verify
        assert isinstance(result, TaskResponse)
        assert result.success is True
        assert result.task_id == "generated_task_001"
        assert result.title == "Test Task"
        assert result.status == TaskStatus.PENDING
        
        mock_task_service.create_task.assert_called_once()
        call_args = mock_task_service.create_task.call_args[0][0]
        assert isinstance(call_args, Task)
        assert call_args.title == valid_create_request.title

    async def test_create_task_validation_failure(self, create_task_use_case, mock_task_service):
        """Test task creation with validation failure."""
        # Invalid request - empty title
        invalid_request = CreateTaskRequest(
            title="",  # Invalid
            description="Test description",
            task_type=TaskType.STANDARD,
            complexity=ComplexityLevel.MODERATE
        )
        
        # Execute
        result = await create_task_use_case.execute(invalid_request)
        
        # Verify
        assert isinstance(result, ValidationErrorResponse)
        assert result.success is False
        assert "title" in result.validation_errors
        
        # Should not call service for invalid request
        mock_task_service.create_task.assert_not_called()

    async def test_create_task_service_failure(self, create_task_use_case, mock_task_service, valid_create_request):
        """Test task creation with service failure."""
        # Setup service to fail
        mock_task_service.create_task.side_effect = TaskValidationError("Task ID already exists")
        
        # Execute
        result = await create_task_use_case.execute(valid_create_request)
        
        # Verify
        assert isinstance(result, ErrorResponse)
        assert result.success is False
        assert "already exists" in result.error_message

    async def test_create_hierarchical_task(self, create_task_use_case, mock_task_service):
        """Test creating a child task with parent relationship."""
        child_request = CreateTaskRequest(
            title="Child Task",
            description="A child task",
            task_type=TaskType.STANDARD,
            complexity=ComplexityLevel.SIMPLE,
            parent_task_id="parent_001"
        )
        
        created_child = Task(
            task_id="child_001",
            title="Child Task",
            description="A child task",
            hierarchy_path="/parent_001/child_001",
            parent_task_id="parent_001",
            hierarchy_level=1
        )
        
        mock_task_service.create_task.return_value = created_child
        
        result = await create_task_use_case.execute(child_request)
        
        assert result.success is True
        assert result.parent_task_id == "parent_001"
        assert result.hierarchy_level == 1


@pytest.mark.application
@pytest.mark.unit
@pytest.mark.async_test
class TestUpdateTaskUseCase:
    """Test UpdateTaskUseCase application use case."""

    @pytest.fixture
    def mock_task_service(self):
        """Create mock task service."""
        return AsyncMock(spec=TaskService)

    @pytest.fixture
    def update_task_use_case(self, mock_task_service):
        """Create UpdateTaskUseCase with mocked dependencies."""
        return UpdateTaskUseCase(task_service=mock_task_service)

    async def test_update_task_success(self, update_task_use_case, mock_task_service):
        """Test successful task update."""
        update_request = UpdateTaskRequest(
            task_id="test_task_001",
            title="Updated Title",
            description="Updated description",
            status=TaskStatus.ACTIVE,
            estimated_effort="6 hours"
        )
        
        updated_task = Task(
            task_id="test_task_001",
            title="Updated Title",
            description="Updated description",
            hierarchy_path="/test_task_001",
            status=TaskStatus.ACTIVE,
            estimated_effort="6 hours"
        )
        
        mock_task_service.update_task.return_value = updated_task
        
        result = await update_task_use_case.execute(update_request)
        
        assert isinstance(result, TaskResponse)
        assert result.success is True
        assert result.title == "Updated Title"
        assert result.status == TaskStatus.ACTIVE
        assert result.estimated_effort == "6 hours"

    async def test_update_task_not_found(self, update_task_use_case, mock_task_service):
        """Test updating non-existent task."""
        update_request = UpdateTaskRequest(
            task_id="nonexistent_task",
            title="Updated Title"
        )
        
        mock_task_service.update_task.side_effect = TaskNotFoundError("Task not found")
        
        result = await update_task_use_case.execute(update_request)
        
        assert isinstance(result, ErrorResponse)
        assert result.success is False
        assert "not found" in result.error_message

    async def test_update_task_invalid_transition(self, update_task_use_case, mock_task_service):
        """Test updating task with invalid lifecycle transition."""
        update_request = UpdateTaskRequest(
            task_id="test_task_001",
            lifecycle_stage=LifecycleStage.CREATED  # Invalid if current is COMPLETED
        )
        
        mock_task_service.update_task.side_effect = TaskTransitionError("Invalid transition")
        
        result = await update_task_use_case.execute(update_request)
        
        assert isinstance(result, ErrorResponse)
        assert result.success is False
        assert "transition" in result.error_message


@pytest.mark.application
@pytest.mark.unit
@pytest.mark.async_test
class TestExecuteTaskUseCase:
    """Test ExecuteTaskUseCase application use case."""

    @pytest.fixture
    def mock_dependencies(self):
        """Create mock dependencies for execution use case."""
        return {
            'task_service': AsyncMock(spec=TaskService),
            'orchestration_coordinator': AsyncMock(spec=OrchestrationCoordinator),
            'specialist_service': AsyncMock(spec=SpecialistAssignmentService),
            'progress_service': AsyncMock(spec=ProgressTrackingService)
        }

    @pytest.fixture
    def execute_task_use_case(self, mock_dependencies):
        """Create ExecuteTaskUseCase with mocked dependencies."""
        return ExecuteTaskUseCase(**mock_dependencies)

    async def test_execute_task_success(self, execute_task_use_case, mock_dependencies):
        """Test successful task execution."""
        execution_request = TaskExecutionRequest(
            task_id="test_task_001",
            session_id="session_001",
            execution_context={"timeout": 300}
        )
        
        task = Task(
            task_id="test_task_001",
            title="Test Task",
            description="Test description",
            hierarchy_path="/test_task_001",
            status=TaskStatus.PENDING
        )
        
        # Setup mocks
        mock_dependencies['task_service'].get_by_id.return_value = task
        mock_dependencies['specialist_service'].assign_specialist.return_value = "coder"
        mock_dependencies['orchestration_coordinator'].execute_task.return_value = {
            "success": True,
            "result": "Task completed successfully",
            "artifacts": ["output.txt"]
        }
        mock_dependencies['progress_service'].track_execution.return_value = {"progress": 100}
        
        # Execute
        result = await execute_task_use_case.execute(execution_request)
        
        # Verify
        assert result.success is True
        assert result.task_id == "test_task_001"
        assert result.execution_result["success"] is True
        assert "output.txt" in result.execution_result["artifacts"]
        
        # Verify service calls
        mock_dependencies['task_service'].get_by_id.assert_called_once_with("test_task_001")
        mock_dependencies['specialist_service'].assign_specialist.assert_called_once()
        mock_dependencies['orchestration_coordinator'].execute_task.assert_called_once()

    async def test_execute_task_not_found(self, execute_task_use_case, mock_dependencies):
        """Test executing non-existent task."""
        execution_request = TaskExecutionRequest(
            task_id="nonexistent_task",
            session_id="session_001"
        )
        
        mock_dependencies['task_service'].get_by_id.return_value = None
        
        result = await execute_task_use_case.execute(execution_request)
        
        assert isinstance(result, ErrorResponse)
        assert result.success is False
        assert "not found" in result.error_message

    async def test_execute_task_specialist_assignment_failure(self, execute_task_use_case, mock_dependencies):
        """Test task execution with specialist assignment failure."""
        execution_request = TaskExecutionRequest(
            task_id="test_task_001",
            session_id="session_001"
        )
        
        task = Task(
            task_id="test_task_001",
            title="Test Task",
            description="Test description",
            hierarchy_path="/test_task_001"
        )
        
        mock_dependencies['task_service'].get_by_id.return_value = task
        mock_dependencies['specialist_service'].assign_specialist.side_effect = Exception("No available specialists")
        
        result = await execute_task_use_case.execute(execution_request)
        
        assert isinstance(result, ErrorResponse)
        assert result.success is False
        assert "No available specialists" in result.error_message

    async def test_execute_task_with_dependencies(self, execute_task_use_case, mock_dependencies):
        """Test executing task with dependencies."""
        task = Task(
            task_id="dependent_task",
            title="Dependent Task",
            description="Task with dependencies",
            hierarchy_path="/dependent_task"
        )
        
        # Add dependency
        task.add_dependency("prerequisite_task", DependencyType.COMPLETION)
        
        execution_request = TaskExecutionRequest(
            task_id="dependent_task",
            session_id="session_001"
        )
        
        mock_dependencies['task_service'].get_by_id.return_value = task
        mock_dependencies['orchestration_coordinator'].check_dependencies.return_value = False
        
        result = await execute_task_use_case.execute(execution_request)
        
        assert isinstance(result, ErrorResponse)
        assert result.success is False
        assert "dependencies not satisfied" in result.error_message


@pytest.mark.application
@pytest.mark.unit
@pytest.mark.async_test
class TestCompleteTaskUseCase:
    """Test CompleteTaskUseCase application use case."""

    @pytest.fixture
    def mock_dependencies(self):
        """Create mock dependencies for completion use case."""
        return {
            'task_service': AsyncMock(spec=TaskService),
            'progress_service': AsyncMock(spec=ProgressTrackingService)
        }

    @pytest.fixture
    def complete_task_use_case(self, mock_dependencies):
        """Create CompleteTaskUseCase with mocked dependencies."""
        return CompleteTaskUseCase(**mock_dependencies)

    async def test_complete_task_success(self, complete_task_use_case, mock_dependencies):
        """Test successful task completion."""
        completion_request = TaskCompletionRequest(
            task_id="test_task_001",
            results="Task completed successfully",
            artifacts=["output.txt", "report.pdf"],
            completion_notes="All requirements satisfied"
        )
        
        task = Task(
            task_id="test_task_001",
            title="Test Task",
            description="Test description",
            hierarchy_path="/test_task_001",
            status=TaskStatus.ACTIVE
        )
        
        completed_task = task.copy(update={
            "status": TaskStatus.COMPLETED,
            "lifecycle_stage": LifecycleStage.COMPLETED,
            "results": completion_request.results,
            "completed_at": datetime.now()
        })
        
        mock_dependencies['task_service'].get_by_id.return_value = task
        mock_dependencies['task_service'].complete_task.return_value = completed_task
        mock_dependencies['progress_service'].finalize_progress.return_value = {"final_progress": 100}
        
        result = await complete_task_use_case.execute(completion_request)
        
        assert result.success is True
        assert result.task_id == "test_task_001"
        assert result.status == TaskStatus.COMPLETED
        assert result.results == "Task completed successfully"
        assert len(result.artifacts) == 2

    async def test_complete_task_invalid_state(self, complete_task_use_case, mock_dependencies):
        """Test completing task in invalid state."""
        completion_request = TaskCompletionRequest(
            task_id="test_task_001",
            results="Attempted completion"
        )
        
        task = Task(
            task_id="test_task_001",
            title="Test Task",
            description="Test description",
            hierarchy_path="/test_task_001",
            status=TaskStatus.PENDING  # Can't complete pending task
        )
        
        mock_dependencies['task_service'].get_by_id.return_value = task
        mock_dependencies['task_service'].complete_task.side_effect = TaskTransitionError("Cannot complete pending task")
        
        result = await complete_task_use_case.execute(completion_request)
        
        assert isinstance(result, ErrorResponse)
        assert result.success is False
        assert "Cannot complete" in result.error_message

    async def test_complete_task_with_validation(self, complete_task_use_case, mock_dependencies):
        """Test task completion with validation checks."""
        completion_request = TaskCompletionRequest(
            task_id="test_task_001",
            results="Task completed",
            quality_checks=True,
            validation_criteria=["unit_tests_pass", "code_review_approved"]
        )
        
        task = Task(
            task_id="test_task_001",
            title="Test Task",
            description="Test description",
            hierarchy_path="/test_task_001",
            status=TaskStatus.ACTIVE,
            quality_gate_level=QualityGateLevel.COMPREHENSIVE
        )
        
        mock_dependencies['task_service'].get_by_id.return_value = task
        mock_dependencies['task_service'].validate_completion_criteria.return_value = {
            "valid": True,
            "passed_checks": ["unit_tests_pass", "code_review_approved"]
        }
        
        completed_task = task.copy(update={"status": TaskStatus.COMPLETED})
        mock_dependencies['task_service'].complete_task.return_value = completed_task
        
        result = await complete_task_use_case.execute(completion_request)
        
        assert result.success is True
        assert result.validation_passed is True
        assert len(result.quality_checks_passed) == 2


@pytest.mark.application
@pytest.mark.unit
@pytest.mark.async_test
class TestOrchestrationUseCase:
    """Test OrchestrationUseCase application use case."""

    @pytest.fixture
    def mock_orchestration_coordinator(self):
        """Create mock orchestration coordinator."""
        return AsyncMock(spec=OrchestrationCoordinator)

    @pytest.fixture
    def orchestration_use_case(self, mock_orchestration_coordinator):
        """Create OrchestrationUseCase with mocked dependencies."""
        return OrchestrationUseCase(
            orchestration_coordinator=mock_orchestration_coordinator
        )

    async def test_orchestrate_single_task(self, orchestration_use_case, mock_orchestration_coordinator):
        """Test orchestrating a single task."""
        task = Task(
            task_id="test_task_001",
            title="Test Task",
            description="Test description",
            hierarchy_path="/test_task_001"
        )
        
        mock_orchestration_coordinator.orchestrate_execution.return_value = {
            "success": True,
            "task_id": "test_task_001",
            "assigned_specialist": "coder",
            "execution_result": {"status": "completed"}
        }
        
        result = await orchestration_use_case.orchestrate_single_task(task, "session_001")
        
        assert result["success"] is True
        assert result["task_id"] == "test_task_001"
        assert result["assigned_specialist"] == "coder"

    async def test_orchestrate_task_hierarchy(self, orchestration_use_case, mock_orchestration_coordinator):
        """Test orchestrating a task hierarchy."""
        parent_task = Task(
            task_id="parent_001",
            title="Parent Task",
            description="Parent description",
            hierarchy_path="/parent_001",
            task_type=TaskType.BREAKDOWN
        )
        
        child_tasks = [
            Task(
                task_id=f"child_{i}",
                title=f"Child Task {i}",
                description=f"Child description {i}",
                hierarchy_path=f"/parent_001/child_{i}",
                parent_task_id="parent_001"
            )
            for i in range(3)
        ]
        
        mock_orchestration_coordinator.orchestrate_hierarchy.return_value = {
            "success": True,
            "parent_task_id": "parent_001",
            "child_results": [
                {"task_id": f"child_{i}", "success": True}
                for i in range(3)
            ],
            "overall_status": "completed"
        }
        
        result = await orchestration_use_case.orchestrate_hierarchy(
            parent_task, 
            child_tasks, 
            "session_001"
        )
        
        assert result["success"] is True
        assert result["parent_task_id"] == "parent_001"
        assert len(result["child_results"]) == 3
        assert all(child["success"] for child in result["child_results"])

    async def test_orchestrate_parallel_execution(self, orchestration_use_case, mock_orchestration_coordinator):
        """Test orchestrating parallel task execution."""
        tasks = [
            Task(
                task_id=f"parallel_task_{i}",
                title=f"Parallel Task {i}",
                description=f"Description {i}",
                hierarchy_path=f"/parallel_task_{i}"
            )
            for i in range(3)
        ]
        
        mock_orchestration_coordinator.coordinate_parallel_execution.return_value = [
            {"task_id": f"parallel_task_{i}", "success": True, "duration": 1.5}
            for i in range(3)
        ]
        
        result = await orchestration_use_case.orchestrate_parallel_execution(
            tasks, 
            "session_001",
            max_concurrency=2
        )
        
        assert len(result) == 3
        assert all(r["success"] for r in result)


@pytest.mark.application
@pytest.mark.unit
@pytest.mark.async_test
class TestTrackProgressUseCase:
    """Test TrackProgressUseCase application use case."""

    @pytest.fixture
    def mock_progress_service(self):
        """Create mock progress service."""
        return AsyncMock(spec=ProgressTrackingService)

    @pytest.fixture
    def track_progress_use_case(self, mock_progress_service):
        """Create TrackProgressUseCase with mocked dependencies."""
        return TrackProgressUseCase(progress_service=mock_progress_service)

    async def test_start_progress_tracking(self, track_progress_use_case, mock_progress_service):
        """Test starting progress tracking for a task."""
        tracking_request = ProgressTrackingRequest(
            task_id="test_task_001",
            session_id="session_001",
            milestones=[25, 50, 75, 100]
        )
        
        mock_progress_service.start_tracking.return_value = {
            "task_id": "test_task_001",
            "tracking_started": True,
            "initial_progress": 0
        }
        
        result = await track_progress_use_case.start_tracking(tracking_request)
        
        assert isinstance(result, ProgressResponse)
        assert result.success is True
        assert result.task_id == "test_task_001"
        assert result.current_progress == 0

    async def test_update_progress(self, track_progress_use_case, mock_progress_service):
        """Test updating task progress."""
        mock_progress_service.update_progress.return_value = {
            "task_id": "test_task_001",
            "progress": 65,
            "status_message": "Making good progress",
            "milestone_achieved": False
        }
        
        result = await track_progress_use_case.update_progress(
            "test_task_001",
            65,
            "Making good progress"
        )
        
        assert result.current_progress == 65
        assert result.status_message == "Making good progress"
        assert result.milestone_achieved is False

    async def test_get_hierarchical_progress(self, track_progress_use_case, mock_progress_service):
        """Test getting hierarchical progress for parent task."""
        mock_progress_service.get_hierarchical_progress.return_value = {
            "parent_task_id": "parent_001",
            "overall_progress": 75,
            "child_progress": [
                {"task_id": "child_1", "progress": 100},
                {"task_id": "child_2", "progress": 50},
                {"task_id": "child_3", "progress": 75}
            ]
        }
        
        result = await track_progress_use_case.get_hierarchical_progress("parent_001")
        
        assert result.parent_task_id == "parent_001"
        assert result.overall_progress == 75
        assert len(result.child_progress) == 3


@pytest.mark.application
@pytest.mark.integration
class TestUseCaseIntegration:
    """Integration tests for use case interactions."""

    async def test_complete_task_workflow(self):
        """Test complete task workflow from creation to completion."""
        # This would test the integration of:
        # 1. CreateTaskUseCase
        # 2. ExecuteTaskUseCase
        # 3. TrackProgressUseCase
        # 4. CompleteTaskUseCase
        
        # Create mocked services
        task_service = AsyncMock(spec=TaskService)
        orchestrator = AsyncMock(spec=OrchestrationCoordinator)
        specialist_service = AsyncMock(spec=SpecialistAssignmentService)
        progress_service = AsyncMock(spec=ProgressTrackingService)
        
        # Test workflow integration
        # 1. Create task
        create_use_case = CreateTaskUseCase(task_service=task_service)
        
        # 2. Execute task
        execute_use_case = ExecuteTaskUseCase(
            task_service=task_service,
            orchestration_coordinator=orchestrator,
            specialist_service=specialist_service,
            progress_service=progress_service
        )
        
        # 3. Track progress
        track_use_case = TrackProgressUseCase(progress_service=progress_service)
        
        # 4. Complete task
        complete_use_case = CompleteTaskUseCase(
            task_service=task_service,
            progress_service=progress_service
        )
        
        # Verify use cases can be instantiated and configured together
        assert create_use_case is not None
        assert execute_use_case is not None
        assert track_use_case is not None
        assert complete_use_case is not None

    async def test_error_propagation_across_use_cases(self):
        """Test error handling across multiple use cases."""
        # Test that errors from one use case are properly handled
        # by dependent use cases
        pass

    async def test_transaction_consistency_across_use_cases(self):
        """Test transaction consistency across use case boundaries."""
        # Test that use cases maintain data consistency
        # across service boundaries
        pass