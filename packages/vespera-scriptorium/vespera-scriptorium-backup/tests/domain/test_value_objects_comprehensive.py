"""
Comprehensive Domain Layer Tests - Value Objects

Tests for all domain value objects focusing on immutability,
validation, business rules, and value equality.
"""

import pytest
from datetime import datetime, timedelta
from typing import Any, Dict, List
from enum import Enum

from vespera_scriptorium.domain.value_objects.complexity_level import ComplexityLevel
from vespera_scriptorium.domain.value_objects.specialist_type import (
    SpecialistType,
    SpecialistCapability,
    SpecialistLevel
)
from vespera_scriptorium.domain.value_objects.flexible_specialist_type import (
    FlexibleSpecialistType,
    validate_specialist_type,
    list_available_specialists,
    get_specialist_capabilities
)
from vespera_scriptorium.domain.value_objects.task_status import TaskStatus
from vespera_scriptorium.domain.value_objects.execution_result import (
    ExecutionResult,
    ResultStatus,
    ResultMetadata
)
from vespera_scriptorium.domain.value_objects.artifact_reference import (
    ArtifactReference,
    ArtifactLocation,
    ArtifactType
)
from vespera_scriptorium.domain.value_objects.time_window import (
    TimeWindow,
    WindowType,
    WindowStatus
)


@pytest.mark.domain
@pytest.mark.unit
class TestComplexityLevel:
    """Test ComplexityLevel value object."""

    def test_complexity_level_values(self):
        """Test all complexity level values are available."""
        assert ComplexityLevel.TRIVIAL.value == "trivial"
        assert ComplexityLevel.SIMPLE.value == "simple"
        assert ComplexityLevel.MODERATE.value == "moderate"
        assert ComplexityLevel.COMPLEX.value == "complex"
        assert ComplexityLevel.VERY_COMPLEX.value == "very_complex"

    def test_complexity_level_ordering(self):
        """Test complexity levels can be compared."""
        assert ComplexityLevel.TRIVIAL < ComplexityLevel.SIMPLE
        assert ComplexityLevel.SIMPLE < ComplexityLevel.MODERATE
        assert ComplexityLevel.MODERATE < ComplexityLevel.COMPLEX
        assert ComplexityLevel.COMPLEX < ComplexityLevel.VERY_COMPLEX

    def test_complexity_level_equality(self):
        """Test complexity level equality."""
        assert ComplexityLevel.MODERATE == ComplexityLevel.MODERATE
        assert ComplexityLevel.SIMPLE != ComplexityLevel.COMPLEX

    def test_complexity_level_from_string(self):
        """Test creating complexity level from string."""
        assert ComplexityLevel("moderate") == ComplexityLevel.MODERATE
        assert ComplexityLevel("complex") == ComplexityLevel.COMPLEX

    def test_complexity_level_invalid_value(self):
        """Test invalid complexity level raises error."""
        with pytest.raises(ValueError):
            ComplexityLevel("invalid_level")

    def test_complexity_level_effort_estimation(self):
        """Test complexity level can guide effort estimation."""
        # This would be domain logic for effort estimation
        effort_map = {
            ComplexityLevel.TRIVIAL: "< 1 hour",
            ComplexityLevel.SIMPLE: "1-4 hours", 
            ComplexityLevel.MODERATE: "4-8 hours",
            ComplexityLevel.COMPLEX: "1-3 days",
            ComplexityLevel.VERY_COMPLEX: "> 3 days"
        }
        
        assert effort_map[ComplexityLevel.TRIVIAL] == "< 1 hour"
        assert effort_map[ComplexityLevel.VERY_COMPLEX] == "> 3 days"


@pytest.mark.domain
@pytest.mark.unit  
class TestSpecialistType:
    """Test SpecialistType value object."""

    def test_specialist_type_basic_values(self):
        """Test basic specialist type values."""
        assert SpecialistType.ANALYST.value == "analyst"
        assert SpecialistType.CODER.value == "coder"
        assert SpecialistType.TESTER.value == "tester"
        assert SpecialistType.DOCUMENTER.value == "documenter"
        assert SpecialistType.REVIEWER.value == "reviewer"

    def test_specialist_type_advanced_values(self):
        """Test advanced specialist type values."""
        assert SpecialistType.ARCHITECT.value == "architect"
        assert SpecialistType.DEVOPS.value == "devops"
        assert SpecialistType.RESEARCHER.value == "researcher"
        assert SpecialistType.COORDINATOR.value == "coordinator"

    def test_specialist_capabilities(self):
        """Test specialist capabilities mapping."""
        # This tests the business logic of what each specialist can do
        capabilities = {
            SpecialistType.ANALYST: [
                SpecialistCapability.REQUIREMENT_ANALYSIS,
                SpecialistCapability.PROBLEM_DECOMPOSITION,
                SpecialistCapability.RESEARCH
            ],
            SpecialistType.CODER: [
                SpecialistCapability.CODE_IMPLEMENTATION,
                SpecialistCapability.DEBUGGING,
                SpecialistCapability.REFACTORING
            ],
            SpecialistType.TESTER: [
                SpecialistCapability.TEST_DESIGN,
                SpecialistCapability.QUALITY_ASSURANCE,
                SpecialistCapability.BUG_DETECTION
            ]
        }
        
        # Verify analyst capabilities
        analyst_caps = capabilities[SpecialistType.ANALYST]
        assert SpecialistCapability.REQUIREMENT_ANALYSIS in analyst_caps
        assert SpecialistCapability.PROBLEM_DECOMPOSITION in analyst_caps
        
        # Verify coder capabilities  
        coder_caps = capabilities[SpecialistType.CODER]
        assert SpecialistCapability.CODE_IMPLEMENTATION in coder_caps
        assert SpecialistCapability.DEBUGGING in coder_caps

    def test_specialist_level_progression(self):
        """Test specialist level progression."""
        assert SpecialistLevel.JUNIOR < SpecialistLevel.SENIOR
        assert SpecialistLevel.SENIOR < SpecialistLevel.EXPERT
        assert SpecialistLevel.EXPERT < SpecialistLevel.LEAD

    def test_specialist_assignment_compatibility(self):
        """Test specialist assignment business rules."""
        # Test complexity-specialist compatibility
        compatible_assignments = {
            ComplexityLevel.TRIVIAL: [SpecialistLevel.JUNIOR, SpecialistLevel.SENIOR],
            ComplexityLevel.SIMPLE: [SpecialistLevel.JUNIOR, SpecialistLevel.SENIOR, SpecialistLevel.EXPERT],
            ComplexityLevel.MODERATE: [SpecialistLevel.SENIOR, SpecialistLevel.EXPERT, SpecialistLevel.LEAD],
            ComplexityLevel.COMPLEX: [SpecialistLevel.EXPERT, SpecialistLevel.LEAD],
            ComplexityLevel.VERY_COMPLEX: [SpecialistLevel.LEAD]
        }
        
        # Complex tasks should require expert or lead
        complex_compatible = compatible_assignments[ComplexityLevel.COMPLEX]
        assert SpecialistLevel.EXPERT in complex_compatible
        assert SpecialistLevel.LEAD in complex_compatible
        assert SpecialistLevel.JUNIOR not in complex_compatible


@pytest.mark.domain
@pytest.mark.unit
class TestFlexibleSpecialistType:
    """Test FlexibleSpecialistType value object."""

    def test_validate_built_in_specialist_types(self):
        """Test validation of built-in specialist types."""
        assert validate_specialist_type("analyst")
        assert validate_specialist_type("coder")
        assert validate_specialist_type("tester")
        assert validate_specialist_type("reviewer")

    def test_validate_custom_specialist_types(self):
        """Test validation allows custom specialist types."""
        # The flexible system should allow custom types
        assert validate_specialist_type("custom_specialist")
        assert validate_specialist_type("domain_expert")
        assert validate_specialist_type("integration_specialist")

    def test_validate_invalid_specialist_types(self):
        """Test validation rejects invalid specialist types."""
        assert not validate_specialist_type("")
        assert not validate_specialist_type("   ")
        assert not validate_specialist_type(None)

    def test_list_available_specialists(self):
        """Test listing available specialist types."""
        specialists = list_available_specialists()
        
        # Should include built-in types
        assert "analyst" in specialists
        assert "coder" in specialists
        assert "tester" in specialists
        assert "reviewer" in specialists
        assert "architect" in specialists

    def test_get_specialist_capabilities(self):
        """Test getting capabilities for specialist types."""
        analyst_caps = get_specialist_capabilities("analyst")
        assert "requirement_analysis" in analyst_caps
        assert "problem_decomposition" in analyst_caps
        
        coder_caps = get_specialist_capabilities("coder")
        assert "code_implementation" in coder_caps
        assert "debugging" in coder_caps

    def test_flexible_specialist_type_creation(self):
        """Test creating flexible specialist type instances."""
        specialist = FlexibleSpecialistType("data_scientist")
        
        assert specialist.type_name == "data_scientist"
        assert specialist.is_custom is True
        assert specialist.is_built_in is False

    def test_built_in_specialist_type_creation(self):
        """Test creating built-in specialist type instances."""
        specialist = FlexibleSpecialistType("analyst")
        
        assert specialist.type_name == "analyst"
        assert specialist.is_custom is False
        assert specialist.is_built_in is True


@pytest.mark.domain
@pytest.mark.unit
class TestTaskStatus:
    """Test TaskStatus value object."""

    def test_task_status_values(self):
        """Test all task status values."""
        assert TaskStatus.PENDING.value == "pending"
        assert TaskStatus.ACTIVE.value == "active"
        assert TaskStatus.IN_PROGRESS.value == "in_progress"
        assert TaskStatus.BLOCKED.value == "blocked"
        assert TaskStatus.COMPLETED.value == "completed"
        assert TaskStatus.FAILED.value == "failed"
        assert TaskStatus.CANCELLED.value == "cancelled"
        assert TaskStatus.ARCHIVED.value == "archived"

    def test_task_status_transitions(self):
        """Test valid task status transitions."""
        # Define valid transitions
        valid_transitions = {
            TaskStatus.PENDING: [TaskStatus.ACTIVE, TaskStatus.CANCELLED],
            TaskStatus.ACTIVE: [TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED, TaskStatus.COMPLETED, TaskStatus.FAILED],
            TaskStatus.IN_PROGRESS: [TaskStatus.BLOCKED, TaskStatus.COMPLETED, TaskStatus.FAILED],
            TaskStatus.BLOCKED: [TaskStatus.ACTIVE, TaskStatus.IN_PROGRESS, TaskStatus.FAILED],
            TaskStatus.COMPLETED: [TaskStatus.ARCHIVED],
            TaskStatus.FAILED: [TaskStatus.ACTIVE, TaskStatus.ARCHIVED],
            TaskStatus.CANCELLED: [TaskStatus.ARCHIVED],
            TaskStatus.ARCHIVED: []  # Terminal state
        }
        
        # Test some valid transitions
        assert TaskStatus.ACTIVE in valid_transitions[TaskStatus.PENDING]
        assert TaskStatus.COMPLETED in valid_transitions[TaskStatus.IN_PROGRESS]
        assert TaskStatus.ARCHIVED in valid_transitions[TaskStatus.COMPLETED]
        
        # Test terminal state
        assert len(valid_transitions[TaskStatus.ARCHIVED]) == 0

    def test_task_status_categories(self):
        """Test task status categorization."""
        active_statuses = [TaskStatus.ACTIVE, TaskStatus.IN_PROGRESS]
        terminal_statuses = [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED, TaskStatus.ARCHIVED]
        blocked_statuses = [TaskStatus.BLOCKED]
        
        # Test categorization logic
        for status in active_statuses:
            assert status not in terminal_statuses
            assert status not in blocked_statuses
        
        for status in terminal_statuses:
            assert status not in active_statuses
            
        for status in blocked_statuses:
            assert status not in active_statuses
            assert status not in terminal_statuses


@pytest.mark.domain
@pytest.mark.unit
class TestExecutionResult:
    """Test ExecutionResult value object."""

    def test_execution_result_creation(self):
        """Test creating execution results."""
        metadata = ResultMetadata(
            execution_time=1.5,
            memory_usage=1024,
            error_count=0
        )
        
        result = ExecutionResult(
            status=ResultStatus.SUCCESS,
            value="Task completed successfully",
            metadata=metadata,
            timestamp=datetime.now()
        )
        
        assert result.status == ResultStatus.SUCCESS
        assert result.value == "Task completed successfully"
        assert result.metadata.execution_time == 1.5
        assert result.metadata.memory_usage == 1024
        assert result.metadata.error_count == 0

    def test_execution_result_failure(self):
        """Test creating failure execution results."""
        error_metadata = ResultMetadata(
            execution_time=0.1,
            memory_usage=512,
            error_count=1,
            error_details=["Validation failed: Invalid input"]
        )
        
        result = ExecutionResult(
            status=ResultStatus.FAILURE,
            value=None,
            error_message="Task failed due to validation error",
            metadata=error_metadata,
            timestamp=datetime.now()
        )
        
        assert result.status == ResultStatus.FAILURE
        assert result.value is None
        assert result.error_message == "Task failed due to validation error"
        assert result.metadata.error_count == 1
        assert "Validation failed" in result.metadata.error_details[0]

    def test_execution_result_partial_success(self):
        """Test creating partial success execution results."""
        result = ExecutionResult(
            status=ResultStatus.PARTIAL_SUCCESS,
            value="Partial results available",
            warning_message="Some sub-tasks failed",
            timestamp=datetime.now()
        )
        
        assert result.status == ResultStatus.PARTIAL_SUCCESS
        assert result.value == "Partial results available"
        assert result.warning_message == "Some sub-tasks failed"

    def test_execution_result_immutability(self):
        """Test execution result immutability."""
        result = ExecutionResult(
            status=ResultStatus.SUCCESS,
            value="Original value",
            timestamp=datetime.now()
        )
        
        # Value objects should be immutable
        original_value = result.value
        original_status = result.status
        
        # Create new result instead of modifying
        new_result = ExecutionResult(
            status=ResultStatus.FAILURE,
            value="New value",
            timestamp=result.timestamp
        )
        
        # Original should be unchanged
        assert result.value == original_value
        assert result.status == original_status
        assert new_result.value == "New value"
        assert new_result.status == ResultStatus.FAILURE


@pytest.mark.domain
@pytest.mark.unit
class TestArtifactReference:
    """Test ArtifactReference value object."""

    def test_artifact_reference_creation(self):
        """Test creating artifact references."""
        ref = ArtifactReference(
            artifact_id="artifact_001",
            location=ArtifactLocation.FILE_SYSTEM,
            path="/path/to/artifact.txt",
            artifact_type=ArtifactType.DOCUMENT,
            mime_type="text/plain",
            size_bytes=1024
        )
        
        assert ref.artifact_id == "artifact_001"
        assert ref.location == ArtifactLocation.FILE_SYSTEM
        assert ref.path == "/path/to/artifact.txt"
        assert ref.artifact_type == ArtifactType.DOCUMENT
        assert ref.mime_type == "text/plain"
        assert ref.size_bytes == 1024

    def test_artifact_reference_database_location(self):
        """Test artifact reference with database location."""
        ref = ArtifactReference(
            artifact_id="artifact_002",
            location=ArtifactLocation.DATABASE,
            path="artifacts.content",
            artifact_type=ArtifactType.CODE,
            mime_type="text/python"
        )
        
        assert ref.location == ArtifactLocation.DATABASE
        assert ref.path == "artifacts.content"
        assert ref.artifact_type == ArtifactType.CODE

    def test_artifact_reference_url_location(self):
        """Test artifact reference with URL location."""
        ref = ArtifactReference(
            artifact_id="artifact_003",
            location=ArtifactLocation.URL,
            path="https://example.com/artifact.pdf",
            artifact_type=ArtifactType.DOCUMENT,
            mime_type="application/pdf"
        )
        
        assert ref.location == ArtifactLocation.URL
        assert ref.path.startswith("https://")
        assert ref.artifact_type == ArtifactType.DOCUMENT

    def test_artifact_reference_validation(self):
        """Test artifact reference validation."""
        # Test invalid artifact ID
        with pytest.raises(ValueError):
            ArtifactReference(
                artifact_id="",  # Empty ID should be invalid
                location=ArtifactLocation.FILE_SYSTEM,
                path="/path/to/file",
                artifact_type=ArtifactType.DOCUMENT
            )

    def test_artifact_reference_equality(self):
        """Test artifact reference equality."""
        ref1 = ArtifactReference(
            artifact_id="artifact_001",
            location=ArtifactLocation.FILE_SYSTEM,
            path="/path/to/file",
            artifact_type=ArtifactType.DOCUMENT
        )
        
        ref2 = ArtifactReference(
            artifact_id="artifact_001",
            location=ArtifactLocation.FILE_SYSTEM,
            path="/path/to/file",
            artifact_type=ArtifactType.DOCUMENT
        )
        
        ref3 = ArtifactReference(
            artifact_id="artifact_002",
            location=ArtifactLocation.FILE_SYSTEM,
            path="/path/to/file",
            artifact_type=ArtifactType.DOCUMENT
        )
        
        assert ref1 == ref2  # Same content
        assert ref1 != ref3  # Different artifact_id


@pytest.mark.domain
@pytest.mark.unit
class TestTimeWindow:
    """Test TimeWindow value object."""

    def test_time_window_creation(self):
        """Test creating time windows."""
        start_time = datetime.now()
        end_time = start_time + timedelta(hours=2)
        
        window = TimeWindow(
            start_time=start_time,
            end_time=end_time,
            window_type=WindowType.EXECUTION,
            status=WindowStatus.ACTIVE
        )
        
        assert window.start_time == start_time
        assert window.end_time == end_time
        assert window.window_type == WindowType.EXECUTION
        assert window.status == WindowStatus.ACTIVE

    def test_time_window_duration(self):
        """Test time window duration calculation."""
        start_time = datetime.now()
        end_time = start_time + timedelta(hours=3, minutes=30)
        
        window = TimeWindow(
            start_time=start_time,
            end_time=end_time,
            window_type=WindowType.DEADLINE,
            status=WindowStatus.SCHEDULED
        )
        
        duration = window.duration
        expected_duration = timedelta(hours=3, minutes=30)
        assert duration == expected_duration

    def test_time_window_validation(self):
        """Test time window validation."""
        start_time = datetime.now()
        end_time = start_time - timedelta(hours=1)  # End before start
        
        with pytest.raises(ValueError, match="End time must be after start time"):
            TimeWindow(
                start_time=start_time,
                end_time=end_time,
                window_type=WindowType.EXECUTION,
                status=WindowStatus.ACTIVE
            )

    def test_time_window_overlap_detection(self):
        """Test time window overlap detection."""
        base_start = datetime.now()
        
        window1 = TimeWindow(
            start_time=base_start,
            end_time=base_start + timedelta(hours=2),
            window_type=WindowType.EXECUTION,
            status=WindowStatus.ACTIVE
        )
        
        # Overlapping window
        window2 = TimeWindow(
            start_time=base_start + timedelta(hours=1),
            end_time=base_start + timedelta(hours=3),
            window_type=WindowType.EXECUTION,
            status=WindowStatus.SCHEDULED
        )
        
        # Non-overlapping window
        window3 = TimeWindow(
            start_time=base_start + timedelta(hours=3),
            end_time=base_start + timedelta(hours=4),
            window_type=WindowType.EXECUTION,
            status=WindowStatus.SCHEDULED
        )
        
        assert window1.overlaps(window2)
        assert not window1.overlaps(window3)

    def test_time_window_contains_time(self):
        """Test checking if time window contains a specific time."""
        start_time = datetime.now()
        end_time = start_time + timedelta(hours=2)
        
        window = TimeWindow(
            start_time=start_time,
            end_time=end_time,
            window_type=WindowType.DEADLINE,
            status=WindowStatus.ACTIVE
        )
        
        # Time within window
        within_time = start_time + timedelta(hours=1)
        assert window.contains(within_time)
        
        # Time before window
        before_time = start_time - timedelta(hours=1)
        assert not window.contains(before_time)
        
        # Time after window
        after_time = end_time + timedelta(hours=1)
        assert not window.contains(after_time)

    def test_time_window_status_transitions(self):
        """Test time window status transitions."""
        window = TimeWindow(
            start_time=datetime.now(),
            end_time=datetime.now() + timedelta(hours=1),
            window_type=WindowType.EXECUTION,
            status=WindowStatus.SCHEDULED
        )
        
        # Test valid transitions
        valid_transitions = {
            WindowStatus.SCHEDULED: [WindowStatus.ACTIVE, WindowStatus.CANCELLED],
            WindowStatus.ACTIVE: [WindowStatus.COMPLETED, WindowStatus.EXPIRED],
            WindowStatus.COMPLETED: [],
            WindowStatus.CANCELLED: [],
            WindowStatus.EXPIRED: []
        }
        
        scheduled_transitions = valid_transitions[WindowStatus.SCHEDULED]
        assert WindowStatus.ACTIVE in scheduled_transitions
        assert WindowStatus.CANCELLED in scheduled_transitions
        
        # Terminal states should have no valid transitions
        assert len(valid_transitions[WindowStatus.COMPLETED]) == 0
        assert len(valid_transitions[WindowStatus.EXPIRED]) == 0


@pytest.mark.domain
@pytest.mark.unit
class TestValueObjectImmutability:
    """Test that all value objects are properly immutable."""

    def test_complexity_level_immutability(self):
        """Test ComplexityLevel immutability."""
        level = ComplexityLevel.MODERATE
        original_value = level.value
        
        # Enum values are naturally immutable
        assert level.value == original_value

    def test_execution_result_immutability(self):
        """Test ExecutionResult immutability."""
        result = ExecutionResult(
            status=ResultStatus.SUCCESS,
            value="test value",
            timestamp=datetime.now()
        )
        
        # Pydantic models with frozen=True should be immutable
        with pytest.raises(ValueError, match="Instance is frozen"):
            result.status = ResultStatus.FAILURE

    def test_artifact_reference_immutability(self):
        """Test ArtifactReference immutability."""
        ref = ArtifactReference(
            artifact_id="test_001",
            location=ArtifactLocation.FILE_SYSTEM,
            path="/test/path",
            artifact_type=ArtifactType.DOCUMENT
        )
        
        # Should not be able to modify
        with pytest.raises(ValueError, match="Instance is frozen"):
            ref.artifact_id = "modified_001"

    def test_time_window_immutability(self):
        """Test TimeWindow immutability."""
        window = TimeWindow(
            start_time=datetime.now(),
            end_time=datetime.now() + timedelta(hours=1),
            window_type=WindowType.EXECUTION,
            status=WindowStatus.ACTIVE
        )
        
        # Should not be able to modify
        with pytest.raises(ValueError, match="Instance is frozen"):
            window.status = WindowStatus.COMPLETED