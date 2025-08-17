"""
Comprehensive Application Layer Tests - DTOs

Tests for all Data Transfer Objects focusing on validation,
serialization, deserialization, and boundary protection.
"""

import pytest
import json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from pydantic import ValidationError

from vespera_scriptorium.application.dto.task_dtos import (
    CreateTaskRequest,
    UpdateTaskRequest,
    TaskResponse,
    TaskListResponse,
    TaskExecutionRequest,
    TaskCompletionRequest,
    TaskSearchRequest,
    TaskFilterRequest,
    TaskStatsResponse
)
from vespera_scriptorium.application.dto.progress_dtos import (
    ProgressTrackingRequest,
    ProgressResponse,
    ProgressUpdateRequest,
    MilestoneResponse,
    ProgressSummaryResponse
)
from vespera_scriptorium.application.dto.error_responses import (
    ErrorResponse,
    ValidationErrorResponse,
    BusinessRuleViolationResponse
)

from vespera_scriptorium.domain.entities.task import TaskStatus, TaskType, LifecycleStage
from vespera_scriptorium.domain.value_objects.complexity_level import ComplexityLevel


@pytest.mark.application
@pytest.mark.unit
class TestTaskDTOs:
    """Test Task-related Data Transfer Objects."""

    def test_create_task_request_valid(self):
        """Test valid CreateTaskRequest creation."""
        request = CreateTaskRequest(
            title="Test Task",
            description="A test task for validation",
            task_type=TaskType.STANDARD,
            complexity=ComplexityLevel.MODERATE,
            specialist_type="coder",
            estimated_effort="4 hours",
            context={"project": "test", "priority": "high"},
            due_date=datetime.now() + timedelta(days=7)
        )
        
        assert request.title == "Test Task"
        assert request.description == "A test task for validation"
        assert request.task_type == TaskType.STANDARD
        assert request.complexity == ComplexityLevel.MODERATE
        assert request.specialist_type == "coder"
        assert request.estimated_effort == "4 hours"
        assert request.context["project"] == "test"
        assert request.due_date is not None

    def test_create_task_request_minimal(self):
        """Test CreateTaskRequest with minimal required fields."""
        request = CreateTaskRequest(
            title="Minimal Task",
            description="Minimal description"
        )
        
        assert request.title == "Minimal Task"
        assert request.description == "Minimal description"
        assert request.task_type == TaskType.STANDARD  # Default value
        assert request.complexity == ComplexityLevel.MODERATE  # Default value
        assert request.specialist_type is None
        assert request.context == {}  # Default empty dict

    def test_create_task_request_validation_empty_title(self):
        """Test CreateTaskRequest validation fails for empty title."""
        with pytest.raises(ValidationError) as exc_info:
            CreateTaskRequest(
                title="",  # Empty title should fail
                description="Test description"
            )
        
        errors = exc_info.value.errors()
        assert any(error["loc"] == ("title",) for error in errors)

    def test_create_task_request_validation_title_length(self):
        """Test CreateTaskRequest validation fails for overly long title."""
        long_title = "x" * 256  # Exceeds max length
        
        with pytest.raises(ValidationError) as exc_info:
            CreateTaskRequest(
                title=long_title,
                description="Test description"
            )
        
        errors = exc_info.value.errors()
        assert any(error["loc"] == ("title",) for error in errors)

    def test_create_task_request_validation_description_length(self):
        """Test CreateTaskRequest validation fails for overly long description."""
        long_description = "x" * 2001  # Exceeds max length
        
        with pytest.raises(ValidationError) as exc_info:
            CreateTaskRequest(
                title="Test Task",
                description=long_description
            )
        
        errors = exc_info.value.errors()
        assert any(error["loc"] == ("description",) for error in errors)

    def test_create_task_request_xss_prevention(self):
        """Test CreateTaskRequest prevents XSS in text fields."""
        with pytest.raises(ValidationError) as exc_info:
            CreateTaskRequest(
                title="<script>alert('xss')</script>",
                description="Safe description"
            )
        
        # Should fail validation due to security checks
        errors = exc_info.value.errors()
        assert len(errors) > 0

    def test_update_task_request_partial(self):
        """Test UpdateTaskRequest with partial updates."""
        request = UpdateTaskRequest(
            task_id="test_task_001",
            title="Updated Title",
            status=TaskStatus.ACTIVE
            # Only updating title and status, other fields remain None
        )
        
        assert request.task_id == "test_task_001"
        assert request.title == "Updated Title"
        assert request.status == TaskStatus.ACTIVE
        assert request.description is None
        assert request.complexity is None

    def test_update_task_request_validation_task_id(self):
        """Test UpdateTaskRequest validation for task ID."""
        with pytest.raises(ValidationError) as exc_info:
            UpdateTaskRequest(
                task_id="",  # Empty task ID should fail
                title="Updated Title"
            )
        
        errors = exc_info.value.errors()
        assert any(error["loc"] == ("task_id",) for error in errors)

    def test_task_response_complete(self):
        """Test complete TaskResponse creation."""
        response = TaskResponse(
            success=True,
            task_id="task_001",
            title="Test Task",
            description="Test description",
            status=TaskStatus.COMPLETED,
            lifecycle_stage=LifecycleStage.COMPLETED,
            complexity=ComplexityLevel.MODERATE,
            specialist_type="coder",
            results="Task completed successfully",
            artifacts=["output.txt", "report.pdf"],
            created_at=datetime.now(),
            completed_at=datetime.now(),
            execution_duration=120.5
        )
        
        assert response.success is True
        assert response.task_id == "task_001"
        assert response.title == "Test Task"
        assert response.status == TaskStatus.COMPLETED
        assert response.results == "Task completed successfully"
        assert len(response.artifacts) == 2
        assert response.execution_duration == 120.5

    def test_task_list_response(self):
        """Test TaskListResponse with multiple tasks."""
        tasks = [
            TaskResponse(
                success=True,
                task_id=f"task_{i}",
                title=f"Task {i}",
                description=f"Description {i}",
                status=TaskStatus.PENDING
            )
            for i in range(5)
        ]
        
        response = TaskListResponse(
            success=True,
            tasks=tasks,
            total_count=5,
            page=1,
            page_size=10,
            has_more=False
        )
        
        assert response.success is True
        assert len(response.tasks) == 5
        assert response.total_count == 5
        assert response.page == 1
        assert response.has_more is False

    def test_task_execution_request(self):
        """Test TaskExecutionRequest validation."""
        request = TaskExecutionRequest(
            task_id="exec_task_001",
            session_id="session_001",
            execution_context={
                "timeout": 300,
                "max_memory": "1GB",
                "environment": "development"
            },
            force_execution=False,
            dry_run=False
        )
        
        assert request.task_id == "exec_task_001"
        assert request.session_id == "session_001"
        assert request.execution_context["timeout"] == 300
        assert request.force_execution is False
        assert request.dry_run is False

    def test_task_completion_request(self):
        """Test TaskCompletionRequest validation."""
        request = TaskCompletionRequest(
            task_id="complete_task_001",
            results="Task completed successfully",
            artifacts=["output.txt", "documentation.md"],
            completion_notes="All requirements satisfied",
            quality_checks=True,
            validation_criteria=["unit_tests_pass", "code_review_approved"]
        )
        
        assert request.task_id == "complete_task_001"
        assert request.results == "Task completed successfully"
        assert len(request.artifacts) == 2
        assert request.quality_checks is True
        assert len(request.validation_criteria) == 2

    def test_task_search_request(self):
        """Test TaskSearchRequest validation."""
        request = TaskSearchRequest(
            query="implementation tasks",
            filters={
                "status": [TaskStatus.ACTIVE, TaskStatus.COMPLETED],
                "complexity": [ComplexityLevel.MODERATE, ComplexityLevel.COMPLEX],
                "specialist_type": ["coder", "architect"]
            },
            sort_by="created_at",
            sort_order="desc",
            page=1,
            page_size=20
        )
        
        assert request.query == "implementation tasks"
        assert TaskStatus.ACTIVE in request.filters["status"]
        assert request.sort_by == "created_at"
        assert request.sort_order == "desc"
        assert request.page == 1
        assert request.page_size == 20

    def test_task_filter_request(self):
        """Test TaskFilterRequest validation."""
        request = TaskFilterRequest(
            status_filter=[TaskStatus.ACTIVE, TaskStatus.IN_PROGRESS],
            complexity_filter=[ComplexityLevel.MODERATE],
            specialist_filter=["coder"],
            date_range_start=datetime.now() - timedelta(days=30),
            date_range_end=datetime.now(),
            parent_task_id="parent_001",
            has_artifacts=True
        )
        
        assert len(request.status_filter) == 2
        assert ComplexityLevel.MODERATE in request.complexity_filter
        assert "coder" in request.specialist_filter
        assert request.parent_task_id == "parent_001"
        assert request.has_artifacts is True

    def test_task_stats_response(self):
        """Test TaskStatsResponse validation."""
        response = TaskStatsResponse(
            success=True,
            total_tasks=100,
            status_distribution={
                TaskStatus.PENDING: 25,
                TaskStatus.ACTIVE: 15,
                TaskStatus.COMPLETED: 50,
                TaskStatus.FAILED: 10
            },
            complexity_distribution={
                ComplexityLevel.SIMPLE: 30,
                ComplexityLevel.MODERATE: 45,
                ComplexityLevel.COMPLEX: 25
            },
            average_completion_time=timedelta(hours=6, minutes=30),
            success_rate=0.83
        )
        
        assert response.success is True
        assert response.total_tasks == 100
        assert response.status_distribution[TaskStatus.COMPLETED] == 50
        assert response.complexity_distribution[ComplexityLevel.MODERATE] == 45
        assert response.success_rate == 0.83


@pytest.mark.application
@pytest.mark.unit
class TestProgressDTOs:
    """Test Progress-related Data Transfer Objects."""

    def test_progress_tracking_request(self):
        """Test ProgressTrackingRequest validation."""
        request = ProgressTrackingRequest(
            task_id="track_task_001",
            session_id="session_001",
            milestones=[10, 25, 50, 75, 90, 100],
            tracking_interval=timedelta(seconds=30),
            auto_update=True
        )
        
        assert request.task_id == "track_task_001"
        assert request.session_id == "session_001"
        assert len(request.milestones) == 6
        assert request.tracking_interval == timedelta(seconds=30)
        assert request.auto_update is True

    def test_progress_tracking_request_validation_milestones(self):
        """Test ProgressTrackingRequest milestone validation."""
        with pytest.raises(ValidationError) as exc_info:
            ProgressTrackingRequest(
                task_id="track_task_001",
                session_id="session_001",
                milestones=[25, 150, 75]  # 150 is invalid (> 100)
            )
        
        errors = exc_info.value.errors()
        assert any(error["loc"] == ("milestones",) for error in errors)

    def test_progress_response(self):
        """Test ProgressResponse validation."""
        response = ProgressResponse(
            success=True,
            task_id="track_task_001",
            current_progress=65,
            status_message="Making steady progress",
            milestone_achieved=True,
            last_milestone=50,
            next_milestone=75,
            estimated_completion=datetime.now() + timedelta(hours=2),
            elapsed_time=timedelta(hours=3, minutes=15)
        )
        
        assert response.success is True
        assert response.task_id == "track_task_001"
        assert response.current_progress == 65
        assert response.milestone_achieved is True
        assert response.last_milestone == 50
        assert response.next_milestone == 75

    def test_progress_update_request(self):
        """Test ProgressUpdateRequest validation."""
        request = ProgressUpdateRequest(
            task_id="update_task_001",
            progress_percentage=45,
            status_message="Halfway through implementation",
            current_phase="implementation",
            completion_estimate=datetime.now() + timedelta(hours=4)
        )
        
        assert request.task_id == "update_task_001"
        assert request.progress_percentage == 45
        assert request.status_message == "Halfway through implementation"
        assert request.current_phase == "implementation"

    def test_progress_update_request_validation_percentage(self):
        """Test ProgressUpdateRequest percentage validation."""
        with pytest.raises(ValidationError) as exc_info:
            ProgressUpdateRequest(
                task_id="update_task_001",
                progress_percentage=150  # Invalid percentage > 100
            )
        
        errors = exc_info.value.errors()
        assert any(error["loc"] == ("progress_percentage",) for error in errors)

    def test_milestone_response(self):
        """Test MilestoneResponse validation."""
        response = MilestoneResponse(
            milestone_id="milestone_001",
            task_id="task_001",
            milestone_percentage=25,
            achieved=True,
            achieved_at=datetime.now(),
            description="First quarter completed",
            auto_generated=True
        )
        
        assert response.milestone_id == "milestone_001"
        assert response.task_id == "task_001"
        assert response.milestone_percentage == 25
        assert response.achieved is True
        assert response.auto_generated is True

    def test_progress_summary_response(self):
        """Test ProgressSummaryResponse validation."""
        response = ProgressSummaryResponse(
            success=True,
            task_id="summary_task_001",
            overall_progress=78,
            child_task_progress=[
                {"task_id": "child_1", "progress": 100},
                {"task_id": "child_2", "progress": 65},
                {"task_id": "child_3", "progress": 70}
            ],
            milestones_achieved=3,
            total_milestones=4,
            estimated_completion=datetime.now() + timedelta(hours=1, minutes=30),
            performance_metrics={
                "velocity": 12.5,
                "efficiency": 0.85,
                "quality_score": 8.7
            }
        )
        
        assert response.success is True
        assert response.task_id == "summary_task_001"
        assert response.overall_progress == 78
        assert len(response.child_task_progress) == 3
        assert response.milestones_achieved == 3
        assert response.performance_metrics["velocity"] == 12.5


@pytest.mark.application
@pytest.mark.unit
class TestErrorResponseDTOs:
    """Test Error Response Data Transfer Objects."""

    def test_error_response_basic(self):
        """Test basic ErrorResponse creation."""
        response = ErrorResponse(
            success=False,
            error_code="TASK_001",
            error_message="Task not found",
            error_details="The specified task ID does not exist in the system",
            timestamp=datetime.now()
        )
        
        assert response.success is False
        assert response.error_code == "TASK_001"
        assert response.error_message == "Task not found"
        assert response.error_details == "The specified task ID does not exist in the system"
        assert response.timestamp is not None

    def test_error_response_with_context(self):
        """Test ErrorResponse with additional context."""
        response = ErrorResponse(
            success=False,
            error_code="VALIDATION_001",
            error_message="Validation failed",
            error_context={
                "field": "title",
                "value": "",
                "constraint": "min_length",
                "requirement": 1
            },
            recoverable=True,
            suggested_action="Provide a non-empty title"
        )
        
        assert response.error_code == "VALIDATION_001"
        assert response.error_context["field"] == "title"
        assert response.recoverable is True
        assert response.suggested_action == "Provide a non-empty title"

    def test_validation_error_response(self):
        """Test ValidationErrorResponse with field-specific errors."""
        response = ValidationErrorResponse(
            success=False,
            error_code="VALIDATION_FAILED",
            error_message="Request validation failed",
            validation_errors={
                "title": ["Title cannot be empty", "Title must be less than 256 characters"],
                "complexity": ["Invalid complexity level"],
                "due_date": ["Due date must be in the future"]
            },
            total_errors=4
        )
        
        assert response.success is False
        assert response.error_code == "VALIDATION_FAILED"
        assert len(response.validation_errors["title"]) == 2
        assert response.total_errors == 4

    def test_business_rule_violation_response(self):
        """Test BusinessRuleViolationResponse."""
        response = BusinessRuleViolationResponse(
            success=False,
            error_code="BUSINESS_RULE_001",
            error_message="Business rule violation",
            violated_rules=[
                {
                    "rule_name": "task_dependency_cycle",
                    "description": "Task cannot depend on itself",
                    "severity": "error"
                },
                {
                    "rule_name": "specialist_availability",
                    "description": "No available specialists for this task type",
                    "severity": "warning"
                }
            ],
            rule_context={
                "task_id": "problematic_task_001",
                "dependency_chain": ["task_001", "task_002", "task_001"]
            }
        )
        
        assert response.error_code == "BUSINESS_RULE_001"
        assert len(response.violated_rules) == 2
        assert response.violated_rules[0]["rule_name"] == "task_dependency_cycle"
        assert response.rule_context["task_id"] == "problematic_task_001"


@pytest.mark.application
@pytest.mark.unit
class TestDTOSerialization:
    """Test DTO serialization and deserialization."""

    def test_create_task_request_json_serialization(self):
        """Test CreateTaskRequest JSON serialization."""
        request = CreateTaskRequest(
            title="Test Task",
            description="Test description",
            task_type=TaskType.IMPLEMENTATION,
            complexity=ComplexityLevel.COMPLEX,
            context={"project": "test"},
            due_date=datetime(2024, 12, 31, 23, 59, 59)
        )
        
        # Serialize to JSON
        json_data = request.model_dump_json()
        assert isinstance(json_data, str)
        
        # Deserialize from JSON
        parsed_data = json.loads(json_data)
        reconstructed = CreateTaskRequest.model_validate(parsed_data)
        
        assert reconstructed.title == request.title
        assert reconstructed.task_type == request.task_type
        assert reconstructed.complexity == request.complexity
        assert reconstructed.context == request.context

    def test_task_response_json_serialization(self):
        """Test TaskResponse JSON serialization."""
        response = TaskResponse(
            success=True,
            task_id="task_001",
            title="Test Task",
            description="Test description",
            status=TaskStatus.COMPLETED,
            created_at=datetime.now(),
            completed_at=datetime.now()
        )
        
        # Serialize to JSON
        json_data = response.model_dump_json()
        assert isinstance(json_data, str)
        
        # Deserialize from JSON
        parsed_data = json.loads(json_data)
        reconstructed = TaskResponse.model_validate(parsed_data)
        
        assert reconstructed.task_id == response.task_id
        assert reconstructed.status == response.status

    def test_error_response_json_serialization(self):
        """Test ErrorResponse JSON serialization."""
        response = ErrorResponse(
            success=False,
            error_code="TEST_001",
            error_message="Test error",
            timestamp=datetime.now()
        )
        
        # Serialize to JSON
        json_data = response.model_dump_json()
        assert isinstance(json_data, str)
        
        # Deserialize from JSON
        parsed_data = json.loads(json_data)
        reconstructed = ErrorResponse.model_validate(parsed_data)
        
        assert reconstructed.error_code == response.error_code
        assert reconstructed.error_message == response.error_message

    def test_complex_dto_serialization(self):
        """Test serialization of DTOs with nested objects."""
        response = TaskListResponse(
            success=True,
            tasks=[
                TaskResponse(
                    success=True,
                    task_id=f"task_{i}",
                    title=f"Task {i}",
                    description=f"Description {i}",
                    status=TaskStatus.ACTIVE
                )
                for i in range(3)
            ],
            total_count=3,
            page=1,
            page_size=10
        )
        
        # Serialize to JSON
        json_data = response.model_dump_json()
        assert isinstance(json_data, str)
        
        # Deserialize from JSON
        parsed_data = json.loads(json_data)
        reconstructed = TaskListResponse.model_validate(parsed_data)
        
        assert len(reconstructed.tasks) == 3
        assert reconstructed.total_count == 3
        assert all(task.success for task in reconstructed.tasks)


@pytest.mark.application
@pytest.mark.unit
class TestDTOSecurityValidation:
    """Test DTO security validation features."""

    def test_xss_prevention_in_text_fields(self):
        """Test XSS prevention in DTO text fields."""
        # Test script injection
        with pytest.raises(ValidationError):
            CreateTaskRequest(
                title="<script>alert('xss')</script>",
                description="Safe description"
            )
        
        # Test HTML injection
        with pytest.raises(ValidationError):
            CreateTaskRequest(
                title="<img src=x onerror=alert('xss')>",
                description="Safe description"
            )

    def test_sql_injection_prevention(self):
        """Test SQL injection prevention in DTO fields."""
        with pytest.raises(ValidationError):
            UpdateTaskRequest(
                task_id="'; DROP TABLE tasks; --",
                title="Updated Title"
            )

    def test_path_traversal_prevention(self):
        """Test path traversal prevention in file paths."""
        with pytest.raises(ValidationError):
            TaskCompletionRequest(
                task_id="task_001",
                results="Completed",
                artifacts=["../../../etc/passwd", "legitimate_file.txt"]
            )

    def test_content_length_limits(self):
        """Test content length limits for security."""
        # Very long description should be rejected
        long_content = "x" * 10000  # Exceeds reasonable limits
        
        with pytest.raises(ValidationError):
            CreateTaskRequest(
                title="Test Task",
                description=long_content
            )

    def test_safe_content_acceptance(self):
        """Test that legitimate content is accepted."""
        # This should pass validation
        request = CreateTaskRequest(
            title="Legitimate Task Title",
            description="This is a legitimate task description with normal text",
            context={"project": "legitimate_project", "team": "development"}
        )
        
        assert request.title == "Legitimate Task Title"
        assert request.context["project"] == "legitimate_project"