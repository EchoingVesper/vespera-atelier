# Test Infrastructure - Clean Architecture Foundation

This directory contains the foundational test infrastructure for the Vespera Scriptorium project, designed to support comprehensive testing across all Clean Architecture layers.

## 🏗️ Architecture Overview

The test infrastructure follows Clean Architecture principles and provides:

- **Layer-specific test base classes** for domain, application, and infrastructure testing
- **Comprehensive fixture system** with automatic dependency injection
- **Validation framework** to prevent architectural drift
- **Integration test helpers** for cross-layer testing
- **Performance and async testing utilities**

## 📁 Directory Structure

```
tests/infrastructure/
├── __init__.py                     # Package exports
├── README.md                       # This documentation
├── base_test_classes.py           # Core test base classes
├── domain_test_helpers.py         # Domain layer testing utilities
├── application_test_helpers.py    # Application layer testing utilities
├── infrastructure_test_helpers.py # Infrastructure layer testing utilities
├── integration_test_helpers.py    # Integration testing utilities
├── test_fixtures.py              # Pytest fixtures for all layers
├── validation_framework.py       # Architectural validation system
└── pytest_config.py              # Pytest configuration and markers
```

## 🎯 Core Components

### Base Test Classes

The infrastructure provides base classes for each architectural layer:

```python
from tests.infrastructure import (
    DomainTestBase,           # For domain entities and business logic
    ApplicationTestBase,      # For use cases and DTOs
    InfrastructureTestBase,   # For repositories and external services
    IntegrationTestBase       # For cross-layer integration
)

# Example domain test
class TestTaskEntity(DomainTestBase):
    async def test_task_creation(self):
        task = self.create_test_entity(Task, title="Test Task")
        self.assert_invariant(task.task_id is not None, "Task must have ID")
```

### Layer-Specific Helpers

Each layer has specialized helpers and factories:

```python
# Domain layer helpers
from tests.infrastructure.domain_test_helpers import (
    TaskTestBuilder,        # Builder pattern for test tasks
    DomainTestDataFactory, # Factory for domain objects
    DomainAssertions       # Specialized domain assertions
)

# Application layer helpers  
from tests.infrastructure.application_test_helpers import (
    DTOTestBuilder,        # Builder for DTOs
    UseCaseTestHelper,     # Use case execution utilities
    MockRepositoryFactory  # Repository mocks
)

# Infrastructure layer helpers
from tests.infrastructure.infrastructure_test_helpers import (
    DatabaseTestHelper,    # Database testing utilities
    MCPProtocolTestHelper, # MCP protocol compliance testing
    FileSystemTestHelper   # File system testing utilities
)
```

### Fixtures System

Comprehensive pytest fixtures for dependency injection and resource management:

```python
# Automatic fixtures based on test layer
def test_domain_logic(domain_container, sample_task):
    # domain_container: DI container for domain testing
    # sample_task: Pre-built task entity
    
def test_use_case(application_container, mock_repository_factory):
    # application_container: DI container with mocked dependencies
    # mock_repository_factory: Factory for repository mocks

def test_database_operations(test_database, database_helper):
    # test_database: In-memory database with schema
    # database_helper: Database testing utilities
```

### Validation Framework

Automated validation to prevent architectural violations:

```python
from tests.infrastructure.validation_framework import (
    ValidationFramework,
    ValidationLevel,
    validate_clean_architecture
)

# Validate entire project
report = validate_clean_architecture(
    project_path=".",
    level=ValidationLevel.STRICT
)

# Validate specific file
report = validate_file_architecture("src/domain/entities/task.py")
```

## 🧪 Testing Patterns

### Domain Layer Testing

Focus on business logic and domain rules:

```python
class TestTaskBusinessLogic(DomainTestBase):
    def test_task_lifecycle_transitions(self):
        task = self.domain_test_data.create_task()
        
        # Test valid transition
        assert task.can_transition_to(LifecycleStage.ACTIVE)
        
        # Test business invariants
        self.assert_domain_rule(
            task, 
            lambda t: t.hierarchy_path.startswith("/"),
            "Hierarchy path must start with /"
        )
```

### Application Layer Testing

Focus on use case orchestration and DTO validation:

```python
class TestTaskCreationUseCase(ApplicationTestBase):
    async def test_create_task_workflow(self):
        # Mock dependencies
        task_repo = self.mock_repository_factory.create_task_repository_mock()
        self.container.override('TaskRepository', task_repo)
        
        # Execute use case
        result = await self.execute_use_case(
            CreateTaskUseCase,
            self.dto_builder.create_create_task_request()
        )
        
        assert result.success
        task_repo.save.assert_called_once()
```

### Infrastructure Layer Testing

Focus on external integrations and repository implementations:

```python
class TestTaskRepository(InfrastructureTestBase):
    async def test_crud_operations(self):
        async with self.database_context() as db:
            repository = TaskRepository(db)
            
            # Test save
            task = self.create_test_entity(Task)
            result = await repository.save(task)
            assert result
            
            # Test retrieve
            retrieved = await repository.get_by_id(task.task_id)
            assert retrieved.task_id == task.task_id
```

### Integration Testing

Focus on cross-layer workflows and end-to-end scenarios:

```python
class TestCompleteTaskWorkflow(IntegrationTestFull):
    async def test_end_to_end_task_lifecycle(self):
        # Execute complete workflow
        result = await self.e2e_helper.execute_complete_task_lifecycle(
            task_title="Integration Test Task"
        )
        
        assert result["success"]
        assert result["task_id"] is not None
        
        # Verify all phases completed
        assert result["phases"]["creation"]["success"]
        assert result["phases"]["execution"]["success"]
        assert result["phases"]["completion"]["success"]
```

## 🎛️ Pytest Configuration

The infrastructure includes comprehensive pytest configuration:

### Markers

Automatic test marking based on file location and content:

```bash
# Run only domain tests
pytest -m domain

# Run integration tests
pytest -m integration

# Run tests for specific layer
pytest --layer=application

# Run with architectural validation
pytest --validation-level=strict
```

### Available Markers

- `@pytest.mark.domain` - Domain layer tests
- `@pytest.mark.application` - Application layer tests  
- `@pytest.mark.infrastructure` - Infrastructure layer tests
- `@pytest.mark.integration` - Integration tests
- `@pytest.mark.e2e` - End-to-end tests
- `@pytest.mark.async_test` - Async tests
- `@pytest.mark.database` - Tests requiring database
- `@pytest.mark.slow` - Slow-running tests
- `@pytest.mark.performance` - Performance tests

### Command Line Options

```bash
# Layer filtering
pytest --layer=domain
pytest --unit-only
pytest --integration-only

# Validation control
pytest --validation-level=comprehensive
pytest --skip-validation

# Performance testing
pytest --performance
```

## 🔧 Configuration

### Test Configuration

```python
# tests/conftest.py
from tests.infrastructure.pytest_config import *
from tests.infrastructure.test_fixtures import *

# Custom configuration
@pytest.fixture
def custom_test_config():
    return {
        "database_url": "sqlite:///:memory:",
        "mock_external_services": True,
        "validation_level": "standard"
    }
```

### Validation Configuration

```python
# Custom validation rules
from tests.infrastructure.validation_framework import ValidationFramework, ValidationRule

class CustomValidationRule(ValidationRule):
    def validate(self, target, context=None):
        # Custom validation logic
        return []

framework = ValidationFramework()
framework.add_rule(CustomValidationRule())
```

## 📊 Performance Testing

The infrastructure includes performance testing utilities:

```python
from tests.infrastructure.application_test_helpers import PerformanceTestHelper

async def test_use_case_performance():
    helper = PerformanceTestHelper()
    
    performance_data = await helper.measure_use_case_performance(
        CreateTaskUseCase,
        input_data,
        container,
        iterations=100
    )
    
    assert performance_data["average_time"] < 0.1  # 100ms threshold
```

## 🛡️ Architectural Validation

Prevent architectural drift with automated validation:

```python
# Validate layer dependencies
def test_architectural_compliance():
    report = validate_clean_architecture(".")
    
    assert not report.has_failures, \
        f"Architectural violations found: {report.failures}"
    
    # Check specific rules
    layer_violations = [
        issue for issue in report.issues 
        if issue.rule_name == "architectural_layer_separation"
    ]
    assert len(layer_violations) == 0
```

## 🚀 Getting Started

1. **Import base classes** for your test layer:

```python
from tests.infrastructure import DomainTestBase

class MyDomainTest(DomainTestBase):
    pass
```

2. **Use fixtures** for dependency injection:

```python
def test_something(domain_container, sample_task):
    # Test implementation
    pass
```

3. **Apply markers** for test organization:

```python
@pytest.mark.domain
@pytest.mark.async_test
async def test_async_domain_logic():
    pass
```

4. **Run tests** with appropriate filters:

```bash
pytest --layer=domain --validation-level=strict
```

## 🔄 Development Workflow

1. **Write layer-specific tests** using appropriate base classes
2. **Use fixtures and helpers** for consistent test setup
3. **Run validation** to ensure architectural compliance
4. **Check coverage** across all architectural layers
5. **Run integration tests** to verify cross-layer functionality

## 📈 Best Practices

1. **Follow layer separation** - test each layer in isolation
2. **Use dependency injection** - avoid direct instantiation in tests
3. **Mock external dependencies** - focus on testing your code
4. **Validate architecture** - run validation regularly
5. **Test async code properly** - use async fixtures and assertions
6. **Measure performance** - establish performance baselines
7. **Document test scenarios** - use descriptive test names and docstrings

## 🤝 Contributing

When adding new test infrastructure:

1. Follow the established patterns for each layer
2. Add appropriate fixtures to `test_fixtures.py`
3. Include validation rules if adding new architectural constraints
4. Update this documentation with new patterns
5. Ensure backward compatibility with existing tests

---

This test infrastructure provides a solid foundation for maintaining code quality and architectural integrity as the project evolves.