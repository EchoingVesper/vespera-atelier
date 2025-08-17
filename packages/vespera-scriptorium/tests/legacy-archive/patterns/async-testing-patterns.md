# Async Testing Patterns

**Extracted From**: test_file_tracking.py, test_enhanced_integration.py  
**Pattern Type**: Asynchronous operation testing and workflow validation  
**Applicability**: Async use cases, database operations, complex workflows

## Legacy Pattern Analysis

### Original Implementation (test_file_tracking.py)
```python
async def test_file_tracking_system():
    """Test the complete file tracking system."""
    print("🧪 Testing File Tracking System...")
    
    # Create temporary database for testing
    test_db_path = ":memory:"  # In-memory database for testing
    engine = create_engine(f"sqlite:///{test_db_path}")
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    # Create session
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db_session = SessionLocal()
    
    try:
        # Initialize file tracking
        file_tracking = await initialize_file_tracking(db_session, run_migration=False)
        
        # Create test subtask tracker
        test_subtask_id = "test_subtask_001"
        tracker = create_file_tracker_for_subtask(test_subtask_id, file_tracking)
        
        # Test file operations with verification
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            test_file = temp_path / "test_file.txt"
            
            # Test file creation tracking
            await tracker.track_file_create(str(test_file), {"test": "creation"})
            test_file.write_text("Hello, file tracking system!")
            
            # Test file modification tracking
            await tracker.track_file_modify(str(test_file), {"test": "modification"})
            test_file.write_text("Hello, modified file tracking system!")
            
            # Test verification
            verification_summary = await tracker.verify_all_operations()
            
            return verification_summary['all_verified']
            
    finally:
        db_session.close()
```

### Pattern Strengths
1. **Comprehensive Async Testing**: Full async workflow with proper await handling
2. **Resource Management**: Proper setup/teardown with try/finally blocks
3. **Temporary Resource Creation**: In-memory database and temporary directories
4. **Operation Verification**: Multi-step operations with verification
5. **Real File System Integration**: Actual file operations for integration testing

### Pattern Weaknesses
1. **Direct Infrastructure Access**: Bypasses application layer abstractions
2. **Complex Setup**: Manual database and session management
3. **Mixed Concerns**: File system and database operations in same test
4. **No Dependency Injection**: Manual component instantiation

## Clean Architecture Adaptations

### Pattern 1: Use Case Async Testing
```python
import pytest
from vespera_scriptorium.application.usecases.track_file_operations import TrackFileOperationsUseCase
from vespera_scriptorium.infrastructure.di.container import Container

@pytest.mark.asyncio
async def test_file_operation_tracking_use_case():
    """Test file tracking through application layer use case."""
    # Setup
    container = Container()
    use_case = container.get(TrackFileOperationsUseCase)
    
    # Execute async use case
    result = await use_case.track_file_creation(
        file_path="test_file.txt",
        operation_context={"test": "creation", "task_id": "test_001"},
        metadata={"created_by": "test_user"}
    )
    
    # Verify result
    assert result.success, f"Use case failed: {result.error}"
    assert result.operation_id is not None, "Should return operation ID"
    assert result.file_path == "test_file.txt", "Should track correct file path"
    
    # Test verification
    verification_result = await use_case.verify_operation(result.operation_id)
    assert verification_result.success, "Operation verification should succeed"
```

### Pattern 2: Async Workflow Testing
```python
@pytest.mark.asyncio
async def test_complete_task_workflow():
    """Test complete async workflow from task creation to completion."""
    container = Container()
    workflow = container.get(TaskExecutionWorkflow)
    
    # Create task
    task_data = {
        "title": "Test Async Task",
        "description": "Test async workflow execution",
        "specialist_type": "coder"
    }
    
    task_result = await workflow.create_task(task_data)
    assert task_result.success, f"Task creation failed: {task_result.error}"
    
    task_id = task_result.task_id
    
    # Execute task
    execution_result = await workflow.execute_task(task_id)
    assert execution_result.success, f"Task execution failed: {execution_result.error}"
    
    # Complete task
    completion_data = {
        "summary": "Task completed successfully",
        "artifacts": ["result.txt"],
        "next_action": "continue"
    }
    
    completion_result = await workflow.complete_task(task_id, completion_data)
    assert completion_result.success, f"Task completion failed: {completion_result.error}"
    
    # Verify final state
    final_state = await workflow.get_task_status(task_id)
    assert final_state.status == "completed", "Task should be completed"
```

### Pattern 3: Async Resource Management
```python
@pytest.mark.asyncio
async def test_async_resource_lifecycle():
    """Test async resource creation, usage, and cleanup."""
    container = Container()
    resource_manager = container.get(AsyncResourceManager)
    
    async with resource_manager.create_session() as session:
        # Create resource
        resource = await session.create_resource(
            resource_type="test_resource",
            configuration={"timeout": 30}
        )
        assert resource.id is not None, "Resource should have ID"
        
        # Use resource
        operation_result = await session.execute_operation(
            resource.id,
            operation="test_operation",
            parameters={"test": True}
        )
        assert operation_result.success, "Operation should succeed"
        
        # Resource automatically cleaned up by context manager
    
    # Verify cleanup
    cleanup_status = await resource_manager.verify_cleanup(resource.id)
    assert cleanup_status.cleaned_up, "Resource should be cleaned up"
```

## Advanced Async Patterns

### Pattern 1: Concurrent Operation Testing
```python
@pytest.mark.asyncio
async def test_concurrent_operations():
    """Test multiple async operations running concurrently."""
    container = Container()
    orchestrator = container.get(TaskOrchestrator)
    
    # Create multiple tasks concurrently
    task_data_list = [
        {"title": f"Task {i}", "description": f"Concurrent task {i}"}
        for i in range(5)
    ]
    
    # Execute task creation concurrently
    create_tasks = [
        orchestrator.create_task(task_data)
        for task_data in task_data_list
    ]
    
    creation_results = await asyncio.gather(*create_tasks, return_exceptions=True)
    
    # Verify all tasks created successfully
    successful_tasks = [
        result for result in creation_results
        if not isinstance(result, Exception) and result.success
    ]
    
    assert len(successful_tasks) == 5, f"Expected 5 tasks, got {len(successful_tasks)}"
    
    # Execute tasks concurrently
    task_ids = [result.task_id for result in successful_tasks]
    execute_tasks = [
        orchestrator.execute_task(task_id)
        for task_id in task_ids
    ]
    
    execution_results = await asyncio.gather(*execute_tasks, return_exceptions=True)
    
    # Verify concurrent execution
    successful_executions = [
        result for result in execution_results
        if not isinstance(result, Exception) and result.success
    ]
    
    assert len(successful_executions) == 5, "All concurrent executions should succeed"
```

### Pattern 2: Async Error Handling
```python
@pytest.mark.asyncio
async def test_async_error_handling():
    """Test proper async error handling and recovery."""
    container = Container()
    service = container.get(AsyncService)
    
    # Test error propagation
    with pytest.raises(AsyncServiceError) as exc_info:
        await service.operation_that_fails()
    
    assert "Expected error message" in str(exc_info.value)
    
    # Test error recovery
    recovery_result = await service.recover_from_error()
    assert recovery_result.success, "Error recovery should succeed"
    
    # Test service is functional after recovery
    normal_result = await service.normal_operation()
    assert normal_result.success, "Service should work after recovery"
```

### Pattern 3: Async Timeout Testing
```python
@pytest.mark.asyncio
async def test_async_timeout_handling():
    """Test async operations with timeout handling."""
    container = Container()
    service = container.get(TimeoutAwareService)
    
    # Test operation within timeout
    start_time = time.time()
    result = await service.quick_operation(timeout=5.0)
    elapsed = time.time() - start_time
    
    assert result.success, "Quick operation should succeed"
    assert elapsed < 5.0, f"Operation took too long: {elapsed}s"
    
    # Test timeout handling
    with pytest.raises(asyncio.TimeoutError):
        await service.slow_operation(timeout=1.0)
    
    # Test service remains functional after timeout
    post_timeout_result = await service.quick_operation(timeout=5.0)
    assert post_timeout_result.success, "Service should work after timeout"
```

## Testing Infrastructure Patterns

### Async Test Fixtures
```python
@pytest.fixture
async def async_container():
    """Provide async-configured container."""
    container = Container()
    await container.initialize_async_services()
    yield container
    await container.cleanup_async_services()

@pytest.fixture
async def async_database_session(async_container):
    """Provide async database session."""
    db_manager = async_container.get(AsyncDatabaseManager)
    async with db_manager.session() as session:
        yield session

@pytest.fixture
async def async_task_orchestrator(async_container):
    """Provide async task orchestrator."""
    return async_container.get(AsyncTaskOrchestrator)
```

### Async Mock Patterns
```python
from unittest.mock import AsyncMock

@pytest.fixture
def async_external_service():
    """Mock async external service."""
    mock = AsyncMock()
    mock.call_api.return_value = {"status": "success", "data": {}}
    mock.upload_file.return_value = {"file_id": "test_file_123"}
    return mock

@pytest.mark.asyncio
async def test_with_async_mocks(async_container, async_external_service):
    """Test using async mocks."""
    # Override external service
    async_container.override('external_service', async_external_service)
    
    use_case = async_container.get(ExternalServiceUseCase)
    result = await use_case.process_data({"test": "data"})
    
    assert result.success
    async_external_service.call_api.assert_called_once()
```

### Async Parametrized Tests
```python
@pytest.mark.asyncio
@pytest.mark.parametrize("operation_type,expected_duration", [
    ("quick", 1.0),
    ("medium", 3.0),
    ("slow", 5.0),
])
async def test_operation_durations(async_container, operation_type, expected_duration):
    """Test different async operation durations."""
    service = async_container.get(AsyncOperationService)
    
    start_time = time.time()
    result = await service.execute_operation(operation_type)
    elapsed = time.time() - start_time
    
    assert result.success, f"{operation_type} operation should succeed"
    assert elapsed <= expected_duration, f"{operation_type} took too long: {elapsed}s"
```

## Best Practices

### 1. Proper Async Test Decoration
```python
# DON'T: Missing async decoration
def test_async_operation():
    result = await some_async_operation()  # This will fail

# DO: Proper async test decoration
@pytest.mark.asyncio
async def test_async_operation():
    result = await some_async_operation()
    assert result.success
```

### 2. Resource Cleanup
```python
# DON'T: Manual cleanup prone to leaks
async def test_with_resources():
    resource = await create_resource()
    # Test logic...
    await cleanup_resource(resource)  # Might not run if test fails

# DO: Automatic cleanup with context managers
@pytest.mark.asyncio
async def test_with_resources():
    async with resource_manager.create_resource() as resource:
        # Test logic...
        pass  # Automatic cleanup
```

### 3. Async Exception Handling
```python
# DON'T: Ignoring async exceptions
@pytest.mark.asyncio
async def test_error_case():
    try:
        await operation_that_fails()
    except:
        pass  # Silent failure

# DO: Explicit async exception testing
@pytest.mark.asyncio
async def test_error_case():
    with pytest.raises(SpecificAsyncError) as exc_info:
        await operation_that_fails()
    
    assert "expected error" in str(exc_info.value)
```

### 4. Concurrent Operation Safety
```python
# DON'T: Sequential execution of concurrent operations
@pytest.mark.asyncio
async def test_concurrent_operations():
    result1 = await operation1()
    result2 = await operation2()  # Sequential, not concurrent

# DO: Actual concurrent execution
@pytest.mark.asyncio
async def test_concurrent_operations():
    results = await asyncio.gather(
        operation1(),
        operation2()
    )
    assert all(result.success for result in results)
```

## Reusable Async Test Components

### Async Test Base Class
```python
class AsyncTestBase:
    """Base class for async tests with common setup."""
    
    @pytest.fixture(autouse=True)
    async def setup_async_environment(self):
        """Automatic async environment setup."""
        self.container = Container()
        await self.container.initialize_async_services()
        yield
        await self.container.cleanup_async_services()
    
    async def create_test_task(self, **kwargs):
        """Helper to create test tasks."""
        orchestrator = self.container.get(AsyncTaskOrchestrator)
        default_data = {
            "title": "Test Task",
            "description": "Test task description",
            "specialist_type": "generic"
        }
        default_data.update(kwargs)
        return await orchestrator.create_task(default_data)
    
    async def wait_for_completion(self, task_id, timeout=30.0):
        """Helper to wait for task completion."""
        orchestrator = self.container.get(AsyncTaskOrchestrator)
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            status = await orchestrator.get_task_status(task_id)
            if status.completed:
                return status
            await asyncio.sleep(0.1)
        
        raise TimeoutError(f"Task {task_id} did not complete within {timeout}s")
```

---

**Pattern Documentation Complete**: Comprehensive async testing patterns with Clean Architecture adaptations, error handling, and concurrent operation testing.