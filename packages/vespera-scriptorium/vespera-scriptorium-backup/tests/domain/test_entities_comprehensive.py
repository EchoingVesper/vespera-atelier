"""
Comprehensive Domain Layer Tests - Entities

Tests for all domain entities focusing on business logic validation,
invariants, lifecycle transitions, and entity behavior.
"""

import json
import pytest
from datetime import datetime, timedelta
from typing import Any, Dict, List
from unittest.mock import Mock, patch

from vespera_scriptorium.domain.entities.task import (
    Task,
    TaskStatus,
    TaskType,
    LifecycleStage,
    LifecycleStateMachine,
    TaskAttribute,
    TaskDependency,
    TaskEvent,
    TaskArtifact,
    TaskTemplate,
    TemplateParameter,
    DependencyType,
    DependencyStatus,
    EventType,
    EventCategory,
    AttributeType,
    ArtifactType,
    QualityGateLevel,
)
from vespera_scriptorium.domain.value_objects.complexity_level import ComplexityLevel
from vespera_scriptorium.domain.exceptions.task_errors import TaskValidationError


@pytest.mark.domain
@pytest.mark.unit
class TestTaskEntity:
    """Comprehensive tests for Task entity."""

    def test_task_creation_with_minimal_data(self):
        """Test creating a task with only required fields."""
        task = Task(
            task_id="test_task_001",
            title="Test Task",
            description="A test task for validation",
            hierarchy_path="/test_task_001"
        )
        
        assert task.task_id == "test_task_001"
        assert task.title == "Test Task"
        assert task.description == "A test task for validation"
        assert task.hierarchy_path == "/test_task_001"
        assert task.task_type == TaskType.STANDARD
        assert task.status == TaskStatus.PENDING
        assert task.lifecycle_stage == LifecycleStage.CREATED
        assert task.complexity == ComplexityLevel.MODERATE
        assert task.hierarchy_level == 0
        assert task.position_in_parent == 0
        
    def test_task_creation_with_full_data(self):
        """Test creating a task with all optional fields."""
        due_date = datetime.now() + timedelta(days=7)
        context = {"project": "test", "priority": "high"}
        
        task = Task(
            task_id="test_task_002",
            parent_task_id="parent_001",
            title="Full Test Task",
            description="A comprehensive test task",
            task_type=TaskType.IMPLEMENTATION,
            hierarchy_path="/parent_001/test_task_002",
            hierarchy_level=1,
            position_in_parent=2,
            status=TaskStatus.ACTIVE,
            lifecycle_stage=LifecycleStage.ACTIVE,
            complexity=ComplexityLevel.COMPLEX,
            estimated_effort="4 hours",
            specialist_type="coder",
            assigned_to="agent_001",
            context=context,
            due_date=due_date,
            quality_gate_level=QualityGateLevel.COMPREHENSIVE
        )
        
        assert task.parent_task_id == "parent_001"
        assert task.task_type == TaskType.IMPLEMENTATION
        assert task.hierarchy_level == 1
        assert task.position_in_parent == 2
        assert task.status == TaskStatus.ACTIVE
        assert task.lifecycle_stage == LifecycleStage.ACTIVE
        assert task.complexity == ComplexityLevel.COMPLEX
        assert task.estimated_effort == "4 hours"
        assert task.specialist_type == "coder"
        assert task.assigned_to == "agent_001"
        assert task.context == context
        assert task.due_date == due_date
        assert task.quality_gate_level == QualityGateLevel.COMPREHENSIVE

    def test_task_validation_rules(self):
        """Test task validation rules and constraints."""
        # Test empty title validation
        with pytest.raises(ValueError, match="Task title cannot be empty"):
            Task(
                task_id="test_001",
                title="",
                description="Test description",
                hierarchy_path="/test_001"
            )
        
        # Test title length validation
        long_title = "x" * 300
        with pytest.raises(ValueError, match="String should have at most 255 characters"):
            Task(
                task_id="test_002",
                title=long_title,
                description="Test description",
                hierarchy_path="/test_002"
            )
        
        # Test description length validation
        long_description = "x" * 2100
        with pytest.raises(ValueError, match="String should have at most 2000 characters"):
            Task(
                task_id="test_003",
                title="Test Task",
                description=long_description,
                hierarchy_path="/test_003"
            )

    def test_hierarchy_path_validation(self):
        """Test hierarchy path validation logic."""
        # Valid hierarchy path
        task = Task(
            task_id="test_001",
            title="Test Task",
            description="Test description",
            hierarchy_path="/test_001"
        )
        assert task.hierarchy_path == "/test_001"
        
        # Test invalid hierarchy path (not starting with /)
        with pytest.raises(ValueError, match="Hierarchy path must start with /"):
            Task(
                task_id="test_002",
                title="Test Task",
                description="Test description",
                hierarchy_path="test_002"
            )

    def test_lifecycle_state_machine(self):
        """Test lifecycle state machine transitions."""
        # Test valid transitions
        assert LifecycleStateMachine.can_transition(
            LifecycleStage.CREATED, LifecycleStage.PLANNING
        )
        assert LifecycleStateMachine.can_transition(
            LifecycleStage.ACTIVE, LifecycleStage.COMPLETED
        )
        assert LifecycleStateMachine.can_transition(
            LifecycleStage.BLOCKED, LifecycleStage.ACTIVE
        )
        
        # Test invalid transitions
        assert not LifecycleStateMachine.can_transition(
            LifecycleStage.COMPLETED, LifecycleStage.CREATED
        )
        assert not LifecycleStateMachine.can_transition(
            LifecycleStage.ARCHIVED, LifecycleStage.ACTIVE
        )
        
        # Test get allowed transitions
        allowed = LifecycleStateMachine.get_allowed_transitions(LifecycleStage.CREATED)
        expected = [
            LifecycleStage.PLANNING,
            LifecycleStage.READY,
            LifecycleStage.ACTIVE,
            LifecycleStage.ARCHIVED,
        ]
        assert set(allowed) == set(expected)

    def test_task_lifecycle_transitions(self):
        """Test task lifecycle transition methods."""
        task = Task(
            task_id="test_001",
            title="Test Task",
            description="Test description",
            hierarchy_path="/test_001",
            lifecycle_stage=LifecycleStage.CREATED
        )
        
        # Test can_transition_to
        assert task.can_transition_to(LifecycleStage.PLANNING)
        assert task.can_transition_to(LifecycleStage.ACTIVE)
        assert not task.can_transition_to(LifecycleStage.COMPLETED)
        
        # Test get_allowed_transitions
        allowed = task.get_allowed_transitions()
        expected = [
            LifecycleStage.PLANNING,
            LifecycleStage.READY,
            LifecycleStage.ACTIVE,
            LifecycleStage.ARCHIVED,
        ]
        assert set(allowed) == set(expected)

    def test_lifecycle_status_consistency_validation(self):
        """Test lifecycle stage and status consistency validation."""
        # Test automatic lifecycle correction
        task = Task(
            task_id="test_001",
            title="Test Task",
            description="Test description",
            hierarchy_path="/test_001",
            status=TaskStatus.ACTIVE,
            lifecycle_stage=LifecycleStage.CREATED  # Inconsistent with status
        )
        
        # Should auto-correct to appropriate lifecycle
        assert task.lifecycle_stage == LifecycleStage.ACTIVE


@pytest.mark.domain
@pytest.mark.unit
class TestTaskAttributes:
    """Test custom task attributes functionality."""

    def test_add_string_attribute(self):
        """Test adding string attributes."""
        task = Task(
            task_id="test_001",
            title="Test Task",
            description="Test description",
            hierarchy_path="/test_001"
        )
        
        attr = task.add_attribute("priority", "high", AttributeType.STRING)
        
        assert len(task.attributes) == 1
        assert attr.attribute_name == "priority"
        assert attr.attribute_value == "high"
        assert attr.attribute_type == AttributeType.STRING
        assert task.get_attribute("priority") == "high"

    def test_add_number_attribute(self):
        """Test adding number attributes."""
        task = Task(
            task_id="test_001",
            title="Test Task",
            description="Test description",
            hierarchy_path="/test_001"
        )
        
        attr = task.add_attribute("score", 85.5, AttributeType.NUMBER)
        
        assert attr.attribute_value == "85.5"
        assert attr.attribute_type == AttributeType.NUMBER
        assert task.get_attribute("score") == 85.5

    def test_add_boolean_attribute(self):
        """Test adding boolean attributes."""
        task = Task(
            task_id="test_001",
            title="Test Task",
            description="Test description",
            hierarchy_path="/test_001"
        )
        
        attr = task.add_attribute("urgent", True, AttributeType.BOOLEAN)
        
        assert attr.attribute_value == "True"
        assert attr.attribute_type == AttributeType.BOOLEAN
        assert task.get_attribute("urgent") is True

    def test_add_json_attribute(self):
        """Test adding JSON attributes."""
        task = Task(
            task_id="test_001",
            title="Test Task",
            description="Test description",
            hierarchy_path="/test_001"
        )
        
        data = {"config": {"timeout": 30, "retries": 3}}
        attr = task.add_attribute("configuration", data, AttributeType.JSON)
        
        assert attr.attribute_type == AttributeType.JSON
        retrieved = task.get_attribute("configuration")
        assert retrieved == data

    def test_add_date_attribute(self):
        """Test adding date attributes."""
        task = Task(
            task_id="test_001",
            title="Test Task",
            description="Test description",
            hierarchy_path="/test_001"
        )
        
        test_date = datetime.now()
        attr = task.add_attribute("deadline", test_date, AttributeType.DATE)
        
        assert attr.attribute_type == AttributeType.DATE
        retrieved = task.get_attribute("deadline")
        assert isinstance(retrieved, datetime)
        assert abs((retrieved - test_date).total_seconds()) < 1

    def test_get_nonexistent_attribute(self):
        """Test getting an attribute that doesn't exist."""
        task = Task(
            task_id="test_001",
            title="Test Task",
            description="Test description",
            hierarchy_path="/test_001"
        )
        
        assert task.get_attribute("nonexistent") is None


@pytest.mark.domain
@pytest.mark.unit
class TestTaskDependencies:
    """Test task dependency management."""

    def test_add_completion_dependency(self):
        """Test adding completion dependencies."""
        task = Task(
            task_id="test_001",
            title="Test Task",
            description="Test description",
            hierarchy_path="/test_001"
        )
        
        dep = task.add_dependency(
            "prerequisite_001",
            DependencyType.COMPLETION,
            mandatory=True
        )
        
        assert len(task.dependencies) == 1
        assert dep.dependent_task_id == "test_001"
        assert dep.prerequisite_task_id == "prerequisite_001"
        assert dep.dependency_type == DependencyType.COMPLETION
        assert dep.is_mandatory is True
        assert dep.dependency_status == DependencyStatus.PENDING

    def test_add_data_dependency(self):
        """Test adding data dependencies."""
        task = Task(
            task_id="test_001",
            title="Test Task",
            description="Test description",
            hierarchy_path="/test_001"
        )
        
        # Data dependencies need additional configuration
        dep = TaskDependency(
            dependent_task_id=task.task_id,
            prerequisite_task_id="data_provider_001",
            dependency_type=DependencyType.DATA,
            output_artifact_ref="output_data",
            input_parameter_name="input_data"
        )
        task.dependencies.append(dep)
        
        assert len(task.dependencies) == 1
        assert dep.dependency_type == DependencyType.DATA
        assert dep.output_artifact_ref == "output_data"
        assert dep.input_parameter_name == "input_data"

    def test_check_dependencies_satisfied(self):
        """Test dependency satisfaction checking."""
        task = Task(
            task_id="test_001",
            title="Test Task",
            description="Test description",
            hierarchy_path="/test_001"
        )
        
        # Add satisfied dependency
        satisfied_dep = task.add_dependency("prereq_001", DependencyType.COMPLETION)
        satisfied_dep.dependency_status = DependencyStatus.SATISFIED
        
        # Add unsatisfied dependency
        unsatisfied_dep = task.add_dependency("prereq_002", DependencyType.COMPLETION)
        unsatisfied_dep.dependency_status = DependencyStatus.PENDING
        
        # Add waived dependency
        waived_dep = task.add_dependency("prereq_003", DependencyType.COMPLETION)
        waived_dep.dependency_status = DependencyStatus.WAIVED
        
        satisfied, unsatisfied_list = task.check_dependencies_satisfied()
        
        assert not satisfied  # Should be False due to pending dependency
        assert len(unsatisfied_list) == 1
        assert unsatisfied_list[0].prerequisite_task_id == "prereq_002"

    def test_dependency_can_satisfy(self):
        """Test dependency satisfaction logic."""
        dep = TaskDependency(
            dependent_task_id="test_001",
            prerequisite_task_id="prereq_001",
            dependency_type=DependencyType.COMPLETION
        )
        
        assert dep.can_satisfy(TaskStatus.COMPLETED)
        assert not dep.can_satisfy(TaskStatus.PENDING)
        assert not dep.can_satisfy(TaskStatus.ACTIVE)
        
        # Test approval dependency
        approval_dep = TaskDependency(
            dependent_task_id="test_001",
            prerequisite_task_id="prereq_002",
            dependency_type=DependencyType.APPROVAL
        )
        
        assert approval_dep.can_satisfy(TaskStatus.COMPLETED)
        assert approval_dep.can_satisfy(TaskStatus.ACTIVE)
        assert not approval_dep.can_satisfy(TaskStatus.PENDING)


@pytest.mark.domain
@pytest.mark.unit
class TestTaskEvents:
    """Test task event recording and management."""

    def test_record_event(self):
        """Test recording task events."""
        task = Task(
            task_id="test_001",
            title="Test Task",
            description="Test description",
            hierarchy_path="/test_001"
        )
        
        event_data = {"old_status": "pending", "new_status": "active"}
        event = task.record_event(
            EventType.STATUS_CHANGED,
            EventCategory.LIFECYCLE,
            triggered_by="user_001",
            data=event_data
        )
        
        assert len(task.events) == 1
        assert event.task_id == "test_001"
        assert event.event_type == EventType.STATUS_CHANGED
        assert event.event_category == EventCategory.LIFECYCLE
        assert event.triggered_by == "user_001"
        assert event.event_data == event_data


@pytest.mark.domain
@pytest.mark.unit
class TestTaskArtifacts:
    """Test task artifact management."""

    def test_task_artifact_creation_with_content(self):
        """Test creating artifacts with text content."""
        artifact = TaskArtifact(
            artifact_id="artifact_001",
            task_id="test_001",
            artifact_type=ArtifactType.CODE,
            artifact_name="Test Code",
            content="print('Hello, World!')",
            mime_type="text/python"
        )
        
        assert artifact.artifact_id == "artifact_001"
        assert artifact.task_id == "test_001"
        assert artifact.artifact_type == ArtifactType.CODE
        assert artifact.artifact_name == "Test Code"
        assert artifact.content == "print('Hello, World!')"
        assert artifact.mime_type == "text/python"

    def test_task_artifact_creation_with_file_reference(self):
        """Test creating artifacts with file references."""
        artifact = TaskArtifact(
            artifact_id="artifact_002",
            task_id="test_001",
            artifact_type=ArtifactType.DOCUMENTATION,
            artifact_name="API Documentation",
            file_reference="/path/to/docs.md",
            file_size=1024,
            mime_type="text/markdown"
        )
        
        assert artifact.file_reference == "/path/to/docs.md"
        assert artifact.file_size == 1024
        assert artifact.mime_type == "text/markdown"

    def test_task_artifact_validation_error(self):
        """Test artifact validation requires content or file reference."""
        with pytest.raises(ValueError, match="Artifact must have either content or file_reference"):
            TaskArtifact(
                artifact_id="artifact_003",
                task_id="test_001",
                artifact_type=ArtifactType.GENERAL,
                artifact_name="Invalid Artifact"
                # Missing both content and file_reference
            )


@pytest.mark.domain
@pytest.mark.unit
class TestTaskAttribute:
    """Test TaskAttribute value object."""

    def test_string_attribute_validation(self):
        """Test string attribute validation."""
        attr = TaskAttribute(
            attribute_name="test_string",
            attribute_value="test value",
            attribute_type=AttributeType.STRING
        )
        
        assert attr.get_typed_value() == "test value"

    def test_number_attribute_validation(self):
        """Test number attribute validation."""
        attr = TaskAttribute(
            attribute_name="test_number",
            attribute_value="42.5",
            attribute_type=AttributeType.NUMBER
        )
        
        assert attr.get_typed_value() == 42.5
        
        # Test invalid number
        with pytest.raises(ValueError, match="not a valid number"):
            TaskAttribute(
                attribute_name="test_invalid",
                attribute_value="not a number",
                attribute_type=AttributeType.NUMBER
            )

    def test_boolean_attribute_validation(self):
        """Test boolean attribute validation."""
        # Test valid boolean values
        for value in ["true", "True", "1", "yes", "YES"]:
            attr = TaskAttribute(
                attribute_name="test_bool",
                attribute_value=value,
                attribute_type=AttributeType.BOOLEAN
            )
            assert attr.get_typed_value() is True
        
        for value in ["false", "False", "0", "no", "NO"]:
            attr = TaskAttribute(
                attribute_name="test_bool",
                attribute_value=value,
                attribute_type=AttributeType.BOOLEAN
            )
            assert attr.get_typed_value() is False
        
        # Test invalid boolean
        with pytest.raises(ValueError, match="not a valid boolean"):
            TaskAttribute(
                attribute_name="test_invalid",
                attribute_value="maybe",
                attribute_type=AttributeType.BOOLEAN
            )

    def test_date_attribute_validation(self):
        """Test date attribute validation."""
        test_date = datetime.now().isoformat()
        attr = TaskAttribute(
            attribute_name="test_date",
            attribute_value=test_date,
            attribute_type=AttributeType.DATE
        )
        
        retrieved = attr.get_typed_value()
        assert isinstance(retrieved, datetime)
        
        # Test invalid date
        with pytest.raises(ValueError, match="not a valid ISO date"):
            TaskAttribute(
                attribute_name="test_invalid",
                attribute_value="not a date",
                attribute_type=AttributeType.DATE
            )

    def test_json_attribute_validation(self):
        """Test JSON attribute validation."""
        json_data = '{"key": "value", "number": 42}'
        attr = TaskAttribute(
            attribute_name="test_json",
            attribute_value=json_data,
            attribute_type=AttributeType.JSON
        )
        
        retrieved = attr.get_typed_value()
        assert retrieved == {"key": "value", "number": 42}
        
        # Test invalid JSON
        with pytest.raises(ValueError, match="not valid JSON"):
            TaskAttribute(
                attribute_name="test_invalid",
                attribute_value="not json",
                attribute_type=AttributeType.JSON
            )


@pytest.mark.domain
@pytest.mark.unit
class TestTaskTemplate:
    """Test task template functionality."""

    def test_template_creation(self):
        """Test creating a task template."""
        template = TaskTemplate(
            template_id="test_template_001",
            template_name="Test Template",
            template_category="testing",
            description="A template for testing",
            task_structure={
                "main_task": {
                    "title": "{{title}}",
                    "description": "{{description}}",
                    "type": "standard",
                    "specialist_type": "{{specialist}}"
                }
            }
        )
        
        assert template.template_id == "test_template_001"
        assert template.template_name == "Test Template"
        assert template.template_category == "testing"
        assert template.description == "A template for testing"

    def test_template_parameter_validation(self):
        """Test template parameter validation."""
        param = TemplateParameter(
            name="title",
            type="string",
            description="Task title",
            required=True
        )
        
        template = TaskTemplate(
            template_id="test_template_002",
            template_name="Parameterized Template",
            template_category="testing",
            description="A template with parameters",
            parameters=[param],
            task_structure={}
        )
        
        # Test validation with missing required parameter
        with pytest.raises(ValueError, match="Required parameter 'title' not provided"):
            template.validate_parameters({})
        
        # Test validation with provided parameter
        validated = template.validate_parameters({"title": "Test Task"})
        assert validated["title"] == "Test Task"

    def test_template_instantiation(self):
        """Test creating tasks from template."""
        template = TaskTemplate(
            template_id="test_template_003",
            template_name="Implementation Template",
            template_category="development",
            description="Template for implementation tasks",
            task_structure={
                "analysis": {
                    "title": "Analysis: {{feature_name}}",
                    "description": "Analyze requirements for {{feature_name}}",
                    "type": "research",
                    "specialist_type": "analyst"
                },
                "implementation": {
                    "title": "Implement: {{feature_name}}",
                    "description": "Implement the {{feature_name}} feature",
                    "type": "implementation",
                    "specialist_type": "coder"
                }
            }
        )
        
        parameters = {"feature_name": "User Authentication"}
        tasks = template.instantiate(parameters)
        
        assert len(tasks) == 2
        
        # Check analysis task
        analysis_task = next(t for t in tasks if "Analysis" in t.title)
        assert "User Authentication" in analysis_task.title
        assert "User Authentication" in analysis_task.description
        assert analysis_task.task_type == TaskType.RESEARCH
        assert analysis_task.specialist_type == "analyst"
        
        # Check implementation task
        impl_task = next(t for t in tasks if "Implement" in t.title)
        assert "User Authentication" in impl_task.title
        assert "User Authentication" in impl_task.description
        assert impl_task.task_type == TaskType.IMPLEMENTATION
        assert impl_task.specialist_type == "coder"


@pytest.mark.domain
@pytest.mark.unit
class TestTaskSecurityValidation:
    """Test task security validation and XSS prevention."""

    def test_xss_prevention_in_title(self):
        """Test XSS prevention in task title."""
        with pytest.raises(ValueError, match="Security validation failed"):
            Task(
                task_id="test_001",
                title="<script>alert('xss')</script>",
                description="Test description",
                hierarchy_path="/test_001"
            )

    def test_xss_prevention_in_description(self):
        """Test XSS prevention in task description."""
        with pytest.raises(ValueError, match="Security validation failed"):
            Task(
                task_id="test_001",
                title="Safe Title",
                description="<script>alert('xss')</script>",
                hierarchy_path="/test_001"
            )

    def test_sql_injection_prevention_in_task_id(self):
        """Test SQL injection prevention in task ID."""
        with pytest.raises(ValueError, match="Invalid task ID format"):
            Task(
                task_id="'; DROP TABLE tasks; --",
                title="Test Task",
                description="Test description",
                hierarchy_path="/test_001"
            )

    def test_safe_content_acceptance(self):
        """Test that safe content is accepted."""
        task = Task(
            task_id="safe_task_001",
            title="Safe Task Title",
            description="This is a safe description with normal text",
            hierarchy_path="/safe_task_001"
        )
        
        assert task.title == "Safe Task Title"
        assert task.description == "This is a safe description with normal text"


@pytest.mark.domain
@pytest.mark.unit
class TestTaskDataSerialization:
    """Test task data serialization for storage."""

    def test_to_dict_for_storage(self):
        """Test converting task to dictionary for storage."""
        now = datetime.now()
        task = Task(
            task_id="test_001",
            title="Test Task",
            description="Test description",
            hierarchy_path="/test_001",
            created_at=now,
            context={"key": "value"},
            configuration={"setting": "enabled"}
        )
        
        data = task.to_dict_for_storage()
        
        # Check basic fields
        assert data["task_id"] == "test_001"
        assert data["title"] == "Test Task"
        assert data["description"] == "Test description"
        
        # Check datetime serialization
        assert data["created_at"] == now.isoformat()
        
        # Check JSON serialization of dicts
        assert isinstance(data["context"], str)
        assert json.loads(data["context"]) == {"key": "value"}
        assert isinstance(data["configuration"], str)
        assert json.loads(data["configuration"]) == {"setting": "enabled"}
        
        # Check runtime collections are excluded
        assert "attributes" not in data
        assert "dependencies" not in data
        assert "artifacts" not in data
        assert "events" not in data
        assert "children" not in data