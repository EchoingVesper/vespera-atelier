"""
Example Domain Layer Test

Demonstrates testing patterns for domain entities, value objects,
and business logic using the test infrastructure.
"""

import pytest
from datetime import datetime, timedelta

from tests.infrastructure import DomainTestWithAsync
from tests.infrastructure.domain_test_helpers import (
    TaskTestBuilder,
    DomainTestDataFactory,
    DomainAssertions,
    DomainTestScenarios,
    ValueObjectTestHelpers
)

from vespera_scriptorium.domain.entities.task import (
    Task, TaskType, TaskStatus, LifecycleStage,
    TaskDependency, DependencyType, DependencyStatus,
    LifecycleStateMachine
)
from vespera_scriptorium.domain.value_objects.complexity_level import ComplexityLevel


@pytest.mark.domain
class TestTaskEntity(DomainTestWithAsync):
    """Test Task domain entity."""
    
    def test_task_creation_with_valid_data(self):
        """Test task creation with valid data."""
        # Arrange
        task_data = {
            "task_id": "test_task_001",
            "title": "Test Task",
            "description": "A test task for domain testing",
            "task_type": TaskType.STANDARD,
            "hierarchy_path": "/test_task_001"
        }
        
        # Act
        task = Task(**task_data)
        
        # Assert
        assert task.task_id == "test_task_001"
        assert task.title == "Test Task"
        assert task.status == TaskStatus.PENDING
        assert task.lifecycle_stage == LifecycleStage.CREATED
        DomainAssertions.assert_task_valid(task)
    
    def test_task_creation_with_builder(self, task_builder):
        """Test task creation using builder pattern."""
        # Arrange & Act
        task = (task_builder
                .with_title("Builder Test Task")
                .with_description("Created using builder pattern")
                .with_complexity(ComplexityLevel.SIMPLE)
                .with_specialist_type("coder")
                .build())
        
        # Assert
        assert task.title == "Builder Test Task"
        assert task.complexity == ComplexityLevel.SIMPLE
        assert task.specialist_type == "coder"
        DomainAssertions.assert_task_valid(task)
    
    def test_task_hierarchy_path_validation(self):
        """Test task hierarchy path validation."""
        # Valid hierarchy path
        task = Task(
            task_id="child_task",
            title="Child Task",
            description="Test hierarchy",
            parent_task_id="parent_task",
            hierarchy_path="/parent_task/child_task",
            hierarchy_level=1
        )
        
        DomainAssertions.assert_task_valid(task)
        assert task.hierarchy_path.startswith("/")
        assert task.hierarchy_path.endswith("/child_task")
    
    def test_task_lifecycle_transitions(self):
        """Test valid lifecycle transitions."""
        # Arrange
        task = Task(
            task_id="lifecycle_test",
            title="Lifecycle Test",
            description="Test lifecycle transitions",
            hierarchy_path="/lifecycle_test"
        )
        
        # Test valid transitions
        assert task.can_transition_to(LifecycleStage.PLANNING)
        assert task.can_transition_to(LifecycleStage.ACTIVE)
        
        # Test invalid transitions
        assert not task.can_transition_to(LifecycleStage.COMPLETED)  # Can't go directly to completed
        
        # Test state machine directly
        DomainAssertions.assert_lifecycle_transition_valid(
            LifecycleStage.CREATED, 
            LifecycleStage.PLANNING
        )
    
    def test_task_business_invariants(self):
        """Test business invariants are maintained."""
        task = Task(
            task_id="invariant_test",
            title="Invariant Test",
            description="Test business invariants",
            hierarchy_path="/invariant_test"
        )
        
        # Test invariants
        DomainAssertions.assert_business_invariant(
            task.created_at <= task.updated_at,
            "Created date must be <= updated date"
        )
        
        DomainAssertions.assert_business_invariant(
            len(task.title.strip()) > 0,
            "Task title cannot be empty"
        )
        
        DomainAssertions.assert_business_invariant(
            task.hierarchy_level >= 0,
            "Hierarchy level must be non-negative"
        )
    
    async def test_task_custom_attributes(self):
        """Test custom attributes functionality."""
        # Arrange
        task = Task(
            task_id="attributes_test",
            title="Attributes Test",
            description="Test custom attributes",
            hierarchy_path="/attributes_test"
        )
        
        # Act - Add various attribute types
        task.add_attribute("priority", "high")
        task.add_attribute("score", 95.5, attr_type="number")
        task.add_attribute("automated", True, attr_type="boolean")
        task.add_attribute("metadata", {"key": "value"}, attr_type="json")
        
        # Assert
        assert task.get_attribute("priority") == "high"
        assert task.get_attribute("score") == 95.5
        assert task.get_attribute("automated") is True
        assert task.get_attribute("metadata")["key"] == "value"
        assert task.get_attribute("nonexistent") is None


@pytest.mark.domain
class TestTaskDependencies(DomainTestWithAsync):
    """Test task dependency domain logic."""
    
    def test_dependency_creation(self):
        """Test dependency creation and validation."""
        # Arrange & Act
        dependency = TaskDependency(
            dependent_task_id="task_b",
            prerequisite_task_id="task_a",
            dependency_type=DependencyType.COMPLETION,
            is_mandatory=True
        )
        
        # Assert
        DomainAssertions.assert_dependency_valid(dependency)
        assert dependency.dependency_status == DependencyStatus.PENDING
        assert dependency.is_mandatory
    
    def test_dependency_satisfaction_logic(self):
        """Test dependency satisfaction logic."""
        # Arrange
        dependency = TaskDependency(
            dependent_task_id="task_b",
            prerequisite_task_id="task_a",
            dependency_type=DependencyType.COMPLETION
        )
        
        # Test satisfaction conditions
        assert not dependency.can_satisfy(TaskStatus.PENDING)
        assert not dependency.can_satisfy(TaskStatus.IN_PROGRESS)
        assert dependency.can_satisfy(TaskStatus.COMPLETED)
    
    def test_dependency_waiver(self):
        """Test dependency waiver functionality."""
        # Arrange
        dependency = TaskDependency(
            dependent_task_id="task_b",
            prerequisite_task_id="task_a",
            dependency_type=DependencyType.COMPLETION,
            waived_at=datetime.now(),
            waived_by="test_user",
            waiver_reason="Testing purposes"
        )
        
        # Assert
        assert dependency.dependency_status == DependencyStatus.WAIVED
        assert dependency.can_satisfy(TaskStatus.PENDING)  # Waived dependencies are always satisfied
    
    def test_task_dependency_checking(self, domain_test_data):
        """Test task dependency checking."""
        # Arrange - Create tasks with dependencies
        dependent_tasks = domain_test_data.create_dependent_tasks(3, dependency_chain=True)
        
        # Act & Assert
        for i, task in enumerate(dependent_tasks):
            if i == 0:
                # First task has no dependencies
                satisfied, unsatisfied = task.check_dependencies_satisfied()
                assert satisfied
                assert len(unsatisfied) == 0
            else:
                # Other tasks have dependencies
                satisfied, unsatisfied = task.check_dependencies_satisfied()
                assert not satisfied  # Dependencies not yet satisfied
                assert len(unsatisfied) > 0


@pytest.mark.domain
class TestDomainScenarios(DomainTestWithAsync):
    """Test pre-built domain scenarios."""
    
    def test_simple_task_workflow_scenario(self):
        """Test simple workflow scenario."""
        # Arrange & Act
        workflow_tasks = DomainTestScenarios.create_simple_task_workflow()
        
        # Assert
        assert len(workflow_tasks) == 3
        
        planning_task = workflow_tasks[0]
        implementation_task = workflow_tasks[1]
        testing_task = workflow_tasks[2]
        
        assert planning_task.task_type == TaskType.RESEARCH
        assert implementation_task.task_type == TaskType.IMPLEMENTATION
        assert testing_task.task_type == TaskType.TESTING
        
        # Verify hierarchy
        assert implementation_task.parent_task_id == planning_task.task_id
        assert testing_task.parent_task_id == implementation_task.task_id
    
    def test_complex_dependency_scenario(self):
        """Test complex dependency scenario."""
        # Arrange & Act
        complex_tasks = DomainTestScenarios.create_complex_dependency_scenario()
        
        # Assert
        assert len(complex_tasks) == 5
        
        # Verify dependency structure
        DomainAssertions.assert_task_hierarchy_valid(complex_tasks)
        
        # Check that last task depends on all others
        last_task = complex_tasks[-1]
        assert len(last_task.dependencies) == 4  # Depends on all previous tasks
    
    def test_task_with_full_lifecycle_events(self):
        """Test task with complete lifecycle events."""
        # Arrange & Act
        task_with_events = DomainTestScenarios.create_task_lifecycle_scenario()
        
        # Assert
        assert len(task_with_events.events) == 5
        
        event_types = [event.event_type for event in task_with_events.events]
        expected_events = ["created", "status_changed", "started", "updated", "completed"]
        
        for expected_event in expected_events:
            assert expected_event in [e.value for e in event_types]
    
    def test_task_with_artifacts(self):
        """Test task with various artifacts."""
        # Arrange & Act
        task_with_artifacts = DomainTestScenarios.create_task_with_artifacts()
        
        # Assert
        assert len(task_with_artifacts.artifacts) == 4
        
        artifact_types = [artifact.artifact_type for artifact in task_with_artifacts.artifacts]
        expected_types = ["code", "documentation", "test", "config"]
        
        for expected_type in expected_types:
            assert expected_type in [t.value for t in artifact_types]
    
    def test_task_with_custom_attributes(self):
        """Test task with custom attributes."""
        # Arrange & Act
        task_with_attrs = DomainTestScenarios.create_task_with_attributes()
        
        # Assert
        assert len(task_with_attrs.attributes) == 5
        
        # Verify different attribute types
        assert task_with_attrs.get_attribute("priority") == "high"
        assert task_with_attrs.get_attribute("score") == 95.5
        assert task_with_attrs.get_attribute("automated") is True
        assert isinstance(task_with_attrs.get_attribute("due_date"), datetime)
        assert isinstance(task_with_attrs.get_attribute("metadata"), dict)


@pytest.mark.domain
class TestValueObjects(DomainTestWithAsync):
    """Test value objects."""
    
    def test_complexity_level_value_object(self):
        """Test ComplexityLevel value object."""
        # Test equality
        complexity1 = ComplexityLevel.MODERATE
        complexity2 = ComplexityLevel.MODERATE
        
        ValueObjectTestHelpers.assert_value_object_equality(complexity1, complexity2)
        
        # Test different values
        complexity3 = ComplexityLevel.SIMPLE
        assert complexity1 != complexity3
    
    def test_value_object_immutability(self):
        """Test value object immutability."""
        complexity = ComplexityLevel.MODERATE
        
        # Value objects should be immutable
        ValueObjectTestHelpers.assert_value_object_immutability(complexity)
    
    def test_value_object_validation(self):
        """Test value object validation."""
        # This would test custom value objects with validation
        # For example, if we had a custom TaskId value object
        
        # Invalid values should be rejected
        invalid_values = [None, "", "   ", "invalid-chars!@#"]
        
        # This is a placeholder - would test actual value object validation
        for invalid_value in invalid_values:
            with pytest.raises((ValueError, TypeError)):
                # Assuming TaskId value object with validation
                # TaskId(invalid_value)
                pass


@pytest.mark.domain
@pytest.mark.performance
class TestDomainPerformance(DomainTestWithAsync):
    """Test domain layer performance."""
    
    async def test_task_creation_performance(self, performance_config):
        """Test task creation performance."""
        import time
        
        # Arrange
        iterations = 1000
        max_time = performance_config["max_execution_time"]
        
        # Act
        start_time = time.time()
        
        for i in range(iterations):
            task = Task(
                task_id=f"perf_test_{i}",
                title=f"Performance Test Task {i}",
                description="Performance testing task",
                hierarchy_path=f"/perf_test_{i}"
            )
            # Simulate some operations
            task.add_attribute("iteration", i)
        
        execution_time = time.time() - start_time
        
        # Assert
        assert execution_time < max_time, f"Task creation took {execution_time:.2f}s, expected < {max_time}s"
        
        # Performance metrics
        tasks_per_second = iterations / execution_time
        assert tasks_per_second > 100, f"Performance too slow: {tasks_per_second:.1f} tasks/second"
    
    async def test_dependency_checking_performance(self, domain_test_data, performance_config):
        """Test dependency checking performance."""
        import time
        
        # Arrange - Create complex dependency structure
        tasks = domain_test_data.create_dependent_tasks(50, dependency_chain=False)
        
        # Add complex dependencies
        for i, task in enumerate(tasks):
            for j in range(min(i, 5)):  # Each task depends on up to 5 previous tasks
                dependency = TaskDependency(
                    dependent_task_id=task.task_id,
                    prerequisite_task_id=tasks[j].task_id,
                    dependency_type=DependencyType.COMPLETION
                )
                task.dependencies.append(dependency)
        
        # Act
        start_time = time.time()
        
        for task in tasks:
            satisfied, unsatisfied = task.check_dependencies_satisfied()
        
        execution_time = time.time() - start_time
        
        # Assert
        max_time = performance_config["max_execution_time"]
        assert execution_time < max_time, f"Dependency checking took {execution_time:.2f}s, expected < {max_time}s"