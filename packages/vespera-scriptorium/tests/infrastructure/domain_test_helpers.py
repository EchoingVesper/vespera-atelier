"""
Domain Layer Test Helpers

Provides specialized testing utilities for domain entities, value objects,
domain services, and business logic validation.
"""

import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Type, TypeVar
from unittest.mock import MagicMock

from vespera_scriptorium.domain.entities.task import (
    Task,
    TaskStatus,
    TaskType,
    LifecycleStage,
    TaskDependency,
    DependencyType,
    DependencyStatus,
    TaskAttribute,
    AttributeType,
    TaskArtifact,
    ArtifactType,
    TaskEvent,
    EventType,
    EventCategory,
)
from vespera_scriptorium.domain.value_objects.complexity_level import ComplexityLevel
from vespera_scriptorium.domain.value_objects.specialist_type import SpecialistType

T = TypeVar("T")


class TaskTestBuilder:
    """Builder pattern for creating test tasks with default values."""
    
    def __init__(self):
        self._task_data = {
            "task_id": f"test_task_{uuid.uuid4().hex[:8]}",
            "title": "Test Task",
            "description": "Test task description",
            "task_type": TaskType.STANDARD,
            "hierarchy_path": "",
            "hierarchy_level": 0,
            "position_in_parent": 0,
            "status": TaskStatus.PENDING,
            "lifecycle_stage": LifecycleStage.CREATED,
            "complexity": ComplexityLevel.MODERATE,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
        }
    
    def with_id(self, task_id: str) -> "TaskTestBuilder":
        """Set task ID."""
        self._task_data["task_id"] = task_id
        return self
    
    def with_title(self, title: str) -> "TaskTestBuilder":
        """Set task title."""
        self._task_data["title"] = title
        return self
    
    def with_description(self, description: str) -> "TaskTestBuilder":
        """Set task description."""
        self._task_data["description"] = description
        return self
    
    def with_type(self, task_type: TaskType) -> "TaskTestBuilder":
        """Set task type."""
        self._task_data["task_type"] = task_type
        return self
    
    def with_status(self, status: TaskStatus) -> "TaskTestBuilder":
        """Set task status."""
        self._task_data["status"] = status
        return self
    
    def with_lifecycle_stage(self, stage: LifecycleStage) -> "TaskTestBuilder":
        """Set lifecycle stage."""
        self._task_data["lifecycle_stage"] = stage
        return self
    
    def with_complexity(self, complexity: ComplexityLevel) -> "TaskTestBuilder":
        """Set complexity level."""
        self._task_data["complexity"] = complexity
        return self
    
    def with_specialist_type(self, specialist_type: str) -> "TaskTestBuilder":
        """Set specialist type."""
        self._task_data["specialist_type"] = specialist_type
        return self
    
    def with_parent(self, parent_task_id: str) -> "TaskTestBuilder":
        """Set parent task ID and hierarchy."""
        self._task_data["parent_task_id"] = parent_task_id
        self._task_data["hierarchy_level"] = 1
        return self
    
    def with_hierarchy(self, path: str, level: int) -> "TaskTestBuilder":
        """Set hierarchy path and level."""
        self._task_data["hierarchy_path"] = path
        self._task_data["hierarchy_level"] = level
        return self
    
    def with_estimated_effort(self, effort: str) -> "TaskTestBuilder":
        """Set estimated effort."""
        self._task_data["estimated_effort"] = effort
        return self
    
    def with_context(self, context: Dict[str, Any]) -> "TaskTestBuilder":
        """Set task context."""
        self._task_data["context"] = context
        return self
    
    def with_configuration(self, config: Dict[str, Any]) -> "TaskTestBuilder":
        """Set task configuration."""
        self._task_data["configuration"] = config
        return self
    
    def completed(self) -> "TaskTestBuilder":
        """Set task as completed."""
        self._task_data["status"] = TaskStatus.COMPLETED
        self._task_data["lifecycle_stage"] = LifecycleStage.COMPLETED
        self._task_data["completed_at"] = datetime.now()
        return self
    
    def failed(self) -> "TaskTestBuilder":
        """Set task as failed."""
        self._task_data["status"] = TaskStatus.FAILED
        self._task_data["lifecycle_stage"] = LifecycleStage.FAILED
        return self
    
    def active(self) -> "TaskTestBuilder":
        """Set task as active."""
        self._task_data["status"] = TaskStatus.IN_PROGRESS
        self._task_data["lifecycle_stage"] = LifecycleStage.ACTIVE
        self._task_data["started_at"] = datetime.now()
        return self
    
    def build(self) -> Task:
        """Build the task."""
        # Auto-set hierarchy path if not set
        if not self._task_data["hierarchy_path"]:
            task_id = self._task_data["task_id"]
            parent_id = self._task_data.get("parent_task_id")
            if parent_id:
                self._task_data["hierarchy_path"] = f"/{parent_id}/{task_id}"
            else:
                self._task_data["hierarchy_path"] = f"/{task_id}"
        
        return Task(**self._task_data)


class DomainTestDataFactory:
    """Factory for creating test domain objects."""
    
    @staticmethod
    def create_task(task_id: Optional[str] = None, **kwargs) -> Task:
        """Create a test task with default values."""
        builder = TaskTestBuilder()
        if task_id:
            builder.with_id(task_id)
        
        for key, value in kwargs.items():
            if hasattr(builder, f"with_{key}"):
                getattr(builder, f"with_{key}")(value)
        
        return builder.build()
    
    @staticmethod
    def create_task_dependency(
        dependent_task_id: str,
        prerequisite_task_id: str,
        dep_type: DependencyType = DependencyType.COMPLETION,
        **kwargs
    ) -> TaskDependency:
        """Create a test task dependency."""
        defaults = {
            "dependent_task_id": dependent_task_id,
            "prerequisite_task_id": prerequisite_task_id,
            "dependency_type": dep_type,
            "dependency_status": DependencyStatus.PENDING,
            "is_mandatory": True,
            "auto_satisfy": False,
            "created_at": datetime.now(),
        }
        defaults.update(kwargs)
        return TaskDependency(**defaults)
    
    @staticmethod
    def create_task_attribute(
        name: str,
        value: Any,
        attr_type: AttributeType = AttributeType.STRING,
        **kwargs
    ) -> TaskAttribute:
        """Create a test task attribute."""
        if attr_type == AttributeType.JSON:
            import json
            str_value = json.dumps(value)
        elif attr_type == AttributeType.DATE and isinstance(value, datetime):
            str_value = value.isoformat()
        else:
            str_value = str(value)
        
        defaults = {
            "attribute_name": name,
            "attribute_value": str_value,
            "attribute_type": attr_type,
            "is_indexed": False,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
        }
        defaults.update(kwargs)
        return TaskAttribute(**defaults)
    
    @staticmethod
    def create_task_artifact(
        task_id: str,
        artifact_name: str,
        content: Optional[str] = None,
        artifact_type: ArtifactType = ArtifactType.GENERAL,
        **kwargs
    ) -> TaskArtifact:
        """Create a test task artifact."""
        defaults = {
            "artifact_id": f"artifact_{uuid.uuid4().hex[:8]}",
            "task_id": task_id,
            "artifact_type": artifact_type,
            "artifact_name": artifact_name,
            "content": content or f"Test content for {artifact_name}",
            "encoding": "utf-8",
            "is_primary": False,
            "visibility": "private",
            "version": 1,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
        }
        defaults.update(kwargs)
        return TaskArtifact(**defaults)
    
    @staticmethod
    def create_task_event(
        task_id: str,
        event_type: EventType,
        category: EventCategory = EventCategory.SYSTEM,
        **kwargs
    ) -> TaskEvent:
        """Create a test task event."""
        defaults = {
            "task_id": task_id,
            "event_type": event_type,
            "event_category": category,
            "event_data": {},
            "triggered_by": "test_system",
            "created_at": datetime.now(),
        }
        defaults.update(kwargs)
        return TaskEvent(**defaults)
    
    @staticmethod
    def create_task_hierarchy(levels: List[str]) -> List[Task]:
        """Create a hierarchy of tasks."""
        tasks = []
        parent_id = None
        
        for i, title in enumerate(levels):
            task_id = f"task_{i}_{uuid.uuid4().hex[:8]}"
            
            builder = TaskTestBuilder().with_id(task_id).with_title(title)
            
            if parent_id:
                builder.with_parent(parent_id)
            
            task = builder.build()
            tasks.append(task)
            parent_id = task_id
        
        return tasks
    
    @staticmethod
    def create_dependent_tasks(count: int, dependency_chain: bool = True) -> List[Task]:
        """Create multiple tasks with dependencies."""
        tasks = []
        
        for i in range(count):
            task_id = f"dep_task_{i}_{uuid.uuid4().hex[:8]}"
            task = DomainTestDataFactory.create_task(task_id=task_id, title=f"Dependent Task {i}")
            
            # Add dependency to previous task if in chain
            if dependency_chain and i > 0:
                previous_task_id = tasks[i-1].task_id
                dependency = DomainTestDataFactory.create_task_dependency(
                    dependent_task_id=task_id,
                    prerequisite_task_id=previous_task_id
                )
                task.dependencies.append(dependency)
            
            tasks.append(task)
        
        return tasks


class DomainAssertions:
    """Specialized assertions for domain objects."""
    
    @staticmethod
    def assert_task_valid(task: Task):
        """Assert task is in valid state."""
        assert task.task_id, "Task must have ID"
        assert task.title, "Task must have title"
        assert task.description, "Task must have description"
        assert task.hierarchy_path.startswith("/"), "Hierarchy path must start with /"
        assert task.created_at <= task.updated_at, "Created at must be <= updated at"
    
    @staticmethod
    def assert_task_hierarchy_valid(tasks: List[Task]):
        """Assert task hierarchy is valid."""
        for task in tasks:
            DomainAssertions.assert_task_valid(task)
            
            if task.parent_task_id:
                # Find parent task
                parent = next((t for t in tasks if t.task_id == task.parent_task_id), None)
                assert parent, f"Parent task {task.parent_task_id} not found"
                assert task.hierarchy_level == parent.hierarchy_level + 1, \
                    "Child task level must be parent level + 1"
    
    @staticmethod
    def assert_dependency_valid(dependency: TaskDependency):
        """Assert dependency is valid."""
        assert dependency.dependent_task_id, "Dependency must have dependent task ID"
        assert dependency.prerequisite_task_id, "Dependency must have prerequisite task ID"
        assert dependency.dependent_task_id != dependency.prerequisite_task_id, \
            "Task cannot depend on itself"
    
    @staticmethod
    def assert_lifecycle_transition_valid(from_stage: LifecycleStage, to_stage: LifecycleStage):
        """Assert lifecycle transition is valid."""
        from vespera_scriptorium.domain.entities.task import LifecycleStateMachine
        assert LifecycleStateMachine.can_transition(from_stage, to_stage), \
            f"Invalid lifecycle transition: {from_stage} -> {to_stage}"
    
    @staticmethod
    def assert_business_invariant(condition: bool, message: str):
        """Assert business invariant holds."""
        assert condition, f"Business invariant violated: {message}"
    
    @staticmethod
    def assert_domain_rule(entity: Any, rule_checker: callable, message: str):
        """Assert domain rule is satisfied."""
        assert rule_checker(entity), f"Domain rule violated: {message}"


class DomainTestScenarios:
    """Pre-built test scenarios for common domain testing patterns."""
    
    @staticmethod
    def create_simple_task_workflow() -> List[Task]:
        """Create simple task workflow scenario."""
        return [
            DomainTestDataFactory.create_task(
                task_id="planning_task",
                title="Planning Task",
                task_type=TaskType.RESEARCH
            ),
            DomainTestDataFactory.create_task(
                task_id="implementation_task", 
                title="Implementation Task",
                task_type=TaskType.IMPLEMENTATION,
                parent_task_id="planning_task"
            ),
            DomainTestDataFactory.create_task(
                task_id="testing_task",
                title="Testing Task", 
                task_type=TaskType.TESTING,
                parent_task_id="implementation_task"
            )
        ]
    
    @staticmethod
    def create_complex_dependency_scenario() -> List[Task]:
        """Create complex dependency scenario."""
        tasks = DomainTestDataFactory.create_dependent_tasks(5, dependency_chain=False)
        
        # Create complex dependency web
        # Task 1 depends on nothing
        # Task 2 depends on Task 1
        # Task 3 depends on Task 1 and Task 2
        # Task 4 depends on Task 2 and Task 3
        # Task 5 depends on all previous tasks
        
        dependencies = [
            (1, 0),  # Task 2 depends on Task 1
            (2, 0),  # Task 3 depends on Task 1
            (2, 1),  # Task 3 depends on Task 2
            (3, 1),  # Task 4 depends on Task 2
            (3, 2),  # Task 4 depends on Task 3
            (4, 0),  # Task 5 depends on Task 1
            (4, 1),  # Task 5 depends on Task 2
            (4, 2),  # Task 5 depends on Task 3
            (4, 3),  # Task 5 depends on Task 4
        ]
        
        for dependent_idx, prerequisite_idx in dependencies:
            dependency = DomainTestDataFactory.create_task_dependency(
                dependent_task_id=tasks[dependent_idx].task_id,
                prerequisite_task_id=tasks[prerequisite_idx].task_id
            )
            tasks[dependent_idx].dependencies.append(dependency)
        
        return tasks
    
    @staticmethod
    def create_task_lifecycle_scenario() -> Task:
        """Create task with full lifecycle events."""
        task = DomainTestDataFactory.create_task()
        
        # Add lifecycle events
        events = [
            (EventType.CREATED, EventCategory.LIFECYCLE),
            (EventType.STATUS_CHANGED, EventCategory.SYSTEM),
            (EventType.STARTED, EventCategory.USER),
            (EventType.UPDATED, EventCategory.DATA),
            (EventType.COMPLETED, EventCategory.LIFECYCLE),
        ]
        
        for event_type, category in events:
            event = DomainTestDataFactory.create_task_event(
                task_id=task.task_id,
                event_type=event_type,
                category=category
            )
            task.events.append(event)
        
        return task
    
    @staticmethod
    def create_task_with_artifacts() -> Task:
        """Create task with various artifacts."""
        task = DomainTestDataFactory.create_task()
        
        # Add different types of artifacts
        artifact_types = [
            (ArtifactType.CODE, "main.py", "print('Hello, World!')"),
            (ArtifactType.DOCUMENTATION, "README.md", "# Project Documentation"),
            (ArtifactType.TEST, "test_main.py", "def test_hello(): pass"),
            (ArtifactType.CONFIG, "config.json", '{"setting": "value"}'),
        ]
        
        for artifact_type, name, content in artifact_types:
            artifact = DomainTestDataFactory.create_task_artifact(
                task_id=task.task_id,
                artifact_name=name,
                content=content,
                artifact_type=artifact_type
            )
            task.artifacts.append(artifact)
        
        return task
    
    @staticmethod
    def create_task_with_attributes() -> Task:
        """Create task with custom attributes."""
        task = DomainTestDataFactory.create_task()
        
        # Add various attribute types
        attributes = [
            ("priority", "high", AttributeType.STRING),
            ("score", 95.5, AttributeType.NUMBER),
            ("automated", True, AttributeType.BOOLEAN),
            ("due_date", datetime.now() + timedelta(days=7), AttributeType.DATE),
            ("metadata", {"key": "value", "count": 10}, AttributeType.JSON),
        ]
        
        for name, value, attr_type in attributes:
            attribute = DomainTestDataFactory.create_task_attribute(
                name=name,
                value=value,
                attr_type=attr_type
            )
            task.attributes.append(attribute)
        
        return task


class ValueObjectTestHelpers:
    """Helpers for testing value objects."""
    
    @staticmethod
    def assert_value_object_equality(vo1: Any, vo2: Any):
        """Assert value objects are equal."""
        assert vo1 == vo2, f"Value objects should be equal: {vo1} != {vo2}"
        assert hash(vo1) == hash(vo2), f"Value object hashes should be equal"
    
    @staticmethod
    def assert_value_object_immutability(value_object: Any):
        """Assert value object is immutable."""
        # Try to modify attributes (should fail)
        for attr_name in dir(value_object):
            if not attr_name.startswith('_') and hasattr(value_object, attr_name):
                attr_value = getattr(value_object, attr_name)
                if not callable(attr_value):
                    try:
                        setattr(value_object, attr_name, "modified")
                        assert False, f"Value object attribute {attr_name} should be immutable"
                    except (AttributeError, TypeError):
                        # Expected behavior for immutable objects
                        pass
    
    @staticmethod
    def test_value_object_validation(value_object_class: Type, invalid_values: List[Any]):
        """Test value object validation with invalid values."""
        for invalid_value in invalid_values:
            try:
                value_object_class(invalid_value)
                assert False, f"Value object should reject invalid value: {invalid_value}"
            except (ValueError, TypeError, AttributeError):
                # Expected behavior for invalid values
                pass