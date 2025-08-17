# Legacy Test Migration Guide

**Guide Version**: 1.0  
**Target Audience**: Future developers, test maintainers, architecture reviewers  
**Context**: Clean Architecture test suite replacement

## Purpose and Scope

This guide provides comprehensive reference for understanding the archived legacy tests and applying their valuable patterns in Clean Architecture-aligned test development.

## Understanding the Archive

### What Was Archived and Why

**6 Legacy Tests Archived (2025-08-17)**:
1. `test_simple_tools.py` - Tool enumeration validation
2. `test_server.py` - Server component initialization
3. `test_initialization.py` - System startup validation  
4. `test_file_tracking.py` - File operation tracking
5. `test_enhanced_integration.py` - Complex integration testing
6. `test_rebuilt_package.py` - Package installation validation

**Archival Reason**: Pre-Clean Architecture structure incompatibility with current domain/application/infrastructure separation.

### Archive Structure Navigation

```
legacy-archive/
├── preserved-tests/          # Exact copies of original failing tests
├── documentation/           # This guide + error catalog + process docs
├── patterns/               # Extracted valuable testing patterns
└── analysis/              # Architectural and pattern analysis
```

## Pre vs Post Architecture Comparison

### Legacy Architecture (Pre-Clean Architecture)
```
vespera_scriptorium/
├── server.py                    # Monolithic server (1407 lines)
├── orchestrator/               # Orchestration logic mixed with infrastructure
└── [various mixed concerns]    # Domain logic mixed with external systems
```

**Test Characteristics**:
- Direct component instantiation
- Mixed layer testing
- Hard-coded assumptions about component structure
- Tight coupling to implementation details

### Current Architecture (Clean Architecture)  
```
vespera_scriptorium/
├── domain/                     # Business logic and entities
├── application/               # Use cases and workflows  
├── infrastructure/            # External systems and frameworks
└── presentation/             # Interfaces (CLI, MCP server)
```

**Test Requirements**:
- Dependency injection usage
- Layer boundary respect
- Contract-based testing
- Loose coupling to implementations

## Pattern Migration Strategies

### 1. Tool Enumeration Pattern

#### Legacy Pattern (test_simple_tools.py)
```python
# LEGACY - Hard-coded expectations
from vespera_scriptorium.infrastructure.mcp.tool_definitions import get_all_tools
tools = get_all_tools()
if len(tools) == 17:
    print("🎉 All 17 tools are available!")
```

#### Clean Architecture Pattern
```python
# CLEAN ARCHITECTURE - Dynamic validation
from vespera_scriptorium.application.interfaces.tool_registry import ToolRegistry
from vespera_scriptorium.infrastructure.di.container import Container

def test_tool_availability():
    container = Container()
    tool_registry = container.get(ToolRegistry)
    
    tools = tool_registry.get_available_tools()
    
    # Test behavior, not specific count
    assert len(tools) > 0, "Should have tools available"
    assert all(tool.is_valid() for tool in tools), "All tools should be valid"
    
    # Test specific tools if required
    required_tools = ['orchestrator_create_task', 'template_create']
    available_tool_names = [tool.name for tool in tools]
    for required_tool in required_tools:
        assert required_tool in available_tool_names, f"Required tool {required_tool} missing"
```

### 2. Server Initialization Pattern

#### Legacy Pattern (test_server.py)
```python
# LEGACY - Direct attribute access
from vespera_scriptorium import server
self.assertIsNotNone(server.app)
self.assertIsNotNone(server.orchestrator)
```

#### Clean Architecture Pattern
```python
# CLEAN ARCHITECTURE - Interface contract testing
from vespera_scriptorium.presentation.mcp_server import MCPServer
from vespera_scriptorium.infrastructure.di.container import Container

def test_server_initialization():
    container = Container()
    server = container.get(MCPServer)
    
    # Test interface contract, not internal structure
    assert server.is_initialized(), "Server should be initialized"
    assert server.can_handle_requests(), "Server should handle requests"
    
    # Test core capabilities
    capabilities = server.get_capabilities()
    assert 'task_orchestration' in capabilities
    assert 'template_management' in capabilities
```

### 3. Async Testing Pattern

#### Legacy Pattern (test_file_tracking.py)
```python
# LEGACY - Direct orchestrator integration
async def test_file_tracking_system():
    file_tracking = await initialize_file_tracking(db_session, run_migration=False)
    tracker = create_file_tracker_for_subtask(test_subtask_id, file_tracking)
    await tracker.track_file_create(str(test_file), {"test": "creation"})
```

#### Clean Architecture Pattern
```python
# CLEAN ARCHITECTURE - Use case driven testing
import pytest
from vespera_scriptorium.application.usecases.track_file_operations import TrackFileOperationsUseCase
from vespera_scriptorium.infrastructure.di.container import Container

@pytest.mark.asyncio
async def test_file_operation_tracking():
    container = Container()
    use_case = container.get(TrackFileOperationsUseCase)
    
    # Test through application layer
    result = await use_case.track_file_creation(
        file_path="test_file.txt",
        operation_context={"test": "creation"},
        task_id="test_task_001"
    )
    
    assert result.success, f"File tracking failed: {result.error}"
    assert result.operation_id is not None, "Should return operation ID"
```

### 4. Integration Testing Pattern

#### Legacy Pattern (test_enhanced_integration.py)
```python
# LEGACY - Complex orchestrator integration
enhanced_orchestrator = await create_enhanced_orchestrator(
    state_manager=state_manager,
    specialist_manager=specialist_manager
)
```

#### Clean Architecture Pattern
```python
# CLEAN ARCHITECTURE - Application workflow testing
from vespera_scriptorium.application.workflows.task_execution_workflow import TaskExecutionWorkflow
from vespera_scriptorium.infrastructure.di.container import Container

@pytest.mark.asyncio
async def test_task_execution_workflow():
    container = Container()
    workflow = container.get(TaskExecutionWorkflow)
    
    # Test complete workflow through application layer
    task_request = {
        "title": "Test Task",
        "description": "Integration test task",
        "specialist_type": "coder"
    }
    
    result = await workflow.execute_complete_task_lifecycle(task_request)
    
    assert result.success, f"Workflow failed: {result.error}"
    assert result.task_id is not None, "Should return task ID"
    assert result.artifacts is not None, "Should return artifacts"
```

## Test Infrastructure Patterns

### 1. Dependency Injection Setup

```python
# Standard test setup for Clean Architecture
import pytest
from vespera_scriptorium.infrastructure.di.container import Container
from vespera_scriptorium.infrastructure.di.test_configuration import TestConfiguration

@pytest.fixture
def container():
    """Provide configured DI container for tests."""
    container = Container()
    container.configure(TestConfiguration())
    return container

@pytest.fixture
def use_case(container):
    """Provide specific use case for testing."""
    return container.get(YourUseCaseClass)
```

### 2. Database Test Patterns

```python
# Database testing with proper isolation
import pytest
from sqlalchemy import create_engine
from vespera_scriptorium.infrastructure.database.connection_manager import ConnectionManager

@pytest.fixture
async def test_db():
    """Provide isolated test database."""
    engine = create_engine("sqlite:///:memory:")
    connection_manager = ConnectionManager(engine)
    
    await connection_manager.create_schema()
    yield connection_manager
    await connection_manager.cleanup()
```

### 3. Mock External Dependencies

```python
# Proper mocking for Clean Architecture
from unittest.mock import Mock, AsyncMock
import pytest

@pytest.fixture
def mock_external_api():
    """Mock external API dependencies."""
    mock = AsyncMock()
    mock.call_external_service.return_value = {"status": "success"}
    return mock

def test_with_mocked_dependencies(container, mock_external_api):
    # Override external dependency
    container.override('external_api', mock_external_api)
    
    use_case = container.get(YourUseCase)
    result = use_case.execute()
    
    assert result.success
    mock_external_api.call_external_service.assert_called_once()
```

## Avoiding Legacy Patterns

### Don't: Direct Component Instantiation
```python
# AVOID - Direct instantiation breaks dependency injection
state_manager = StateManager()
orchestrator = TaskOrchestrator(state_manager, specialist_manager)
```

### Do: Use Dependency Injection
```python
# CORRECT - Use configured container
container = Container()
orchestrator = container.get(TaskOrchestrationService)
```

### Don't: Hard-coded Assumptions
```python
# AVOID - Hard-coded assumptions about implementation
assert len(tools) == 17, "Must have exactly 17 tools"
```

### Do: Behavioral Testing
```python
# CORRECT - Test behavior and contracts
assert len(tools) > 0, "Should have tools available"
assert all(tool.is_valid() for tool in tools), "All tools should be valid"
```

### Don't: Mixed Layer Testing
```python
# AVOID - Testing across layer boundaries
def test_database_and_domain_logic():
    # Tests both infrastructure and domain in same test
```

### Do: Layer-Specific Testing
```python
# CORRECT - Test each layer separately
def test_domain_logic():
    # Pure domain logic testing

def test_database_integration():
    # Infrastructure layer testing

def test_application_workflow():
    # Application layer coordination testing
```

## Migration Checklist

### Before Creating New Tests
- [ ] Identify which architectural layer you're testing
- [ ] Set up proper dependency injection configuration
- [ ] Mock external dependencies appropriately
- [ ] Design tests around interfaces, not implementations

### During Test Implementation
- [ ] Use application layer use cases for integration tests
- [ ] Test domain logic in isolation
- [ ] Mock infrastructure concerns in unit tests
- [ ] Follow async testing patterns properly

### After Test Implementation
- [ ] Verify tests pass in isolation
- [ ] Verify tests pass in CI/CD environment
- [ ] Document any special setup requirements
- [ ] Add tests to appropriate test categories

## Reference Resources

### Current Architecture Documentation
- **Clean Architecture Overview**: `/packages/vespera-scriptorium/vespera_scriptorium/CLAUDE.md`
- **Domain Layer**: `/packages/vespera-scriptorium/vespera_scriptorium/domain/`
- **Application Layer**: `/packages/vespera-scriptorium/vespera_scriptorium/application/`
- **Infrastructure Layer**: `/packages/vespera-scriptorium/vespera_scriptorium/infrastructure/`

### Testing Framework Documentation
- **Test Infrastructure**: `/packages/vespera-scriptorium/tests/`
- **Testing Utilities**: `/packages/vespera-scriptorium/testing_utils/`
- **CI/CD Integration**: `/.github/workflows/`

### Legacy Reference (Archived)
- **Original Tests**: `/packages/vespera-scriptorium/tests/legacy-archive/preserved-tests/`
- **Error Analysis**: `/packages/vespera-scriptorium/tests/legacy-archive/documentation/error-catalog.md`
- **Pattern Extraction**: `/packages/vespera-scriptorium/tests/legacy-archive/patterns/`

---

**Migration Guide Complete**: Comprehensive reference for Clean Architecture test development using legacy test patterns and avoiding common pitfalls.