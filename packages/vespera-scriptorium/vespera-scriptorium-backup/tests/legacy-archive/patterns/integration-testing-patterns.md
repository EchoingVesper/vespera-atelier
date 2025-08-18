# Integration Testing Patterns

**Extracted From**: test_enhanced_integration.py, test_server.py  
**Pattern Type**: Complex system integration and workflow coordination  
**Applicability**: Multi-component testing, workflow validation, system integration

## Legacy Pattern Analysis

### Original Implementation (test_enhanced_integration.py)
```python
async def test_enhanced_orchestrator_integration():
    """Test the complete enhanced orchestrator integration."""
    # Create temporary database for testing
    test_db_path = ":memory:"
    engine = create_engine(f"sqlite:///{test_db_path}")
    Base.metadata.create_all(bind=engine)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db_session = SessionLocal()
    
    try:
        # Set up persistence and state management
        persistence_manager = DatabasePersistenceManager(db_session=db_session)
        state_manager = StateManager(persistence_manager)
        specialist_manager = SpecialistManager()
        
        # Create enhanced orchestrator
        enhanced_orchestrator = await create_enhanced_orchestrator(
            state_manager=state_manager,
            specialist_manager=specialist_manager,
            project_dir=None,
            db_url=None
        )
        
        # Test session initialization
        session_info = await enhanced_orchestrator.initialize_session()
        
        # Test task planning with subtasks
        test_subtasks = [
            {
                "title": "Create Documentation Files",
                "description": "Create comprehensive documentation with context tracking",
                "specialist_type": "documenter",
                "task_id": "doc_task_001"
            }
        ]
        
        breakdown = await enhanced_orchestrator.plan_task(
            description="Integration test with enhanced orchestrator",
            complexity="moderate",
            subtasks_json=json.dumps(test_subtasks),
            context="Testing enhanced orchestrator integration"
        )
        
        # Test work stream preparation
        doc_preparation = await prepare_documentation_work_stream(enhanced_orchestrator, ["doc_task_001"])
        
        # Test enhanced completion workflow
        completion_result = await enhanced_orchestrator.complete_subtask_enhanced(
            task_id="doc_task_001",
            results="Successfully created documentation with context tracking",
            artifacts=["README.md", "API_DOCS.md"],
            next_action="continue",
            specialist_type="documenter"
        )
        
        return completion_result.get('enhanced_completion', False)
        
    finally:
        db_session.close()
```

### Pattern Strengths
1. **End-to-End Integration**: Tests complete workflows from setup to completion
2. **Multi-Component Coordination**: Orchestrates multiple system components
3. **Workflow State Management**: Tracks state throughout complex operations
4. **Resource Lifecycle Management**: Proper setup and teardown
5. **Realistic Test Scenarios**: Tests real-world usage patterns

### Pattern Weaknesses
1. **Complex Test Setup**: Extensive manual component initialization
2. **Monolithic Test Design**: Single large test covering multiple concerns
3. **Infrastructure Coupling**: Direct database and component management
4. **Hard to Debug**: Complex failure scenarios difficult to isolate
5. **Maintenance Overhead**: Changes to any component break the test

## Clean Architecture Adaptations

### Pattern 1: Use Case Integration Testing
```python
@pytest.mark.asyncio
async def test_task_creation_workflow_integration():
    """Test complete task creation workflow through application layer."""
    container = Container()
    workflow = container.get(TaskCreationWorkflow)
    
    # Test workflow input
    workflow_input = {
        "title": "Integration Test Task",
        "description": "Test complete task creation workflow",
        "specialist_type": "coder",
        "complexity": "moderate",
        "subtasks": [
            {
                "title": "Subtask 1",
                "description": "First subtask",
                "specialist_type": "analyst"
            }
        ]
    }
    
    # Execute complete workflow
    result = await workflow.execute(workflow_input)
    
    # Verify workflow results
    assert result.success, f"Workflow failed: {result.error}"
    assert result.parent_task_id is not None, "Should create parent task"
    assert len(result.subtask_ids) == 1, "Should create one subtask"
    
    # Verify task state in system
    task_service = container.get(TaskService)
    parent_task = await task_service.get_task(result.parent_task_id)
    
    assert parent_task.status == "pending", "Parent task should be pending"
    assert parent_task.title == workflow_input["title"], "Task title should match"
    
    # Verify subtask creation
    subtask = await task_service.get_task(result.subtask_ids[0])
    assert subtask.parent_task_id == result.parent_task_id, "Subtask should reference parent"
```

### Pattern 2: Multi-Layer Integration Testing
```python
@pytest.mark.asyncio
async def test_multi_layer_integration():
    """Test integration across domain, application, and infrastructure layers."""
    container = Container()
    
    # Domain layer
    task_entity = Task(
        title="Multi-layer Test",
        description="Test cross-layer integration",
        specialist_type=SpecialistType.CODER
    )
    
    # Application layer
    create_task_use_case = container.get(CreateTaskUseCase)
    task_result = await create_task_use_case.execute(task_entity)
    
    assert task_result.success, "Task creation should succeed"
    task_id = task_result.task_id
    
    # Infrastructure layer verification
    task_repository = container.get(TaskRepository)
    persisted_task = await task_repository.get_by_id(task_id)
    
    assert persisted_task is not None, "Task should be persisted"
    assert persisted_task.title == task_entity.title, "Persisted data should match"
    
    # Application layer execution
    execute_task_use_case = container.get(ExecuteTaskUseCase)
    execution_result = await execute_task_use_case.execute(task_id)
    
    assert execution_result.success, "Task execution should succeed"
    
    # Domain layer state verification
    updated_task = await task_repository.get_by_id(task_id)
    assert updated_task.status == TaskStatus.IN_PROGRESS, "Task should be in progress"
```

### Pattern 3: Workflow State Integration Testing
```python
@pytest.mark.asyncio
async def test_workflow_state_integration():
    """Test workflow state management across components."""
    container = Container()
    orchestrator = container.get(WorkflowOrchestrator)
    
    # Initialize workflow
    workflow_id = await orchestrator.create_workflow("test_workflow")
    
    # Add workflow steps
    steps = [
        {"name": "analyze", "handler": "analysis_service"},
        {"name": "implement", "handler": "implementation_service"},
        {"name": "test", "handler": "testing_service"}
    ]
    
    for step in steps:
        await orchestrator.add_step(workflow_id, step)
    
    # Execute workflow
    execution_result = await orchestrator.execute_workflow(workflow_id)
    assert execution_result.success, "Workflow execution should succeed"
    
    # Verify step execution order
    execution_history = await orchestrator.get_execution_history(workflow_id)
    executed_steps = [step["name"] for step in execution_history]
    
    assert executed_steps == ["analyze", "implement", "test"], "Steps should execute in order"
    
    # Verify final workflow state
    workflow_state = await orchestrator.get_workflow_state(workflow_id)
    assert workflow_state.status == "completed", "Workflow should be completed"
    assert workflow_state.all_steps_successful(), "All steps should succeed"
```

## Advanced Integration Patterns

### Pattern 1: External System Integration
```python
@pytest.mark.asyncio
async def test_external_system_integration():
    """Test integration with external systems through adapters."""
    container = Container()
    
    # Mock external systems for testing
    github_mock = AsyncMock()
    github_mock.create_repository.return_value = {"id": "repo_123", "url": "https://github.com/test/repo"}
    
    container.override('github_client', github_mock)
    
    # Test integration workflow
    integration_service = container.get(ExternalIntegrationService)
    
    result = await integration_service.create_project_with_github_repo({
        "project_name": "Test Project",
        "github_org": "test-org",
        "repository_name": "test-repo"
    })
    
    assert result.success, f"Integration failed: {result.error}"
    assert result.github_repo_id == "repo_123", "Should return GitHub repo ID"
    
    # Verify external system calls
    github_mock.create_repository.assert_called_once_with(
        org="test-org",
        name="test-repo",
        description="Repository for Test Project"
    )
    
    # Verify internal state
    project_service = container.get(ProjectService)
    project = await project_service.get_project(result.project_id)
    
    assert project.github_repo_id == "repo_123", "Project should link to GitHub repo"
```

### Pattern 2: Event-Driven Integration Testing
```python
@pytest.mark.asyncio
async def test_event_driven_integration():
    """Test event-driven integration between components."""
    container = Container()
    event_bus = container.get(EventBus)
    
    # Set up event handlers
    events_received = []
    
    async def task_created_handler(event):
        events_received.append(("task_created", event.task_id))
    
    async def task_completed_handler(event):
        events_received.append(("task_completed", event.task_id))
    
    event_bus.subscribe("task_created", task_created_handler)
    event_bus.subscribe("task_completed", task_completed_handler)
    
    # Execute workflow that triggers events
    task_service = container.get(TaskService)
    
    # Create task (should trigger task_created event)
    task_result = await task_service.create_task({
        "title": "Event Test Task",
        "description": "Test event-driven integration"
    })
    
    # Complete task (should trigger task_completed event)
    await task_service.complete_task(task_result.task_id, {
        "summary": "Task completed",
        "artifacts": []
    })
    
    # Verify events received
    assert len(events_received) == 2, "Should receive 2 events"
    assert events_received[0][0] == "task_created", "First event should be task_created"
    assert events_received[1][0] == "task_completed", "Second event should be task_completed"
    assert events_received[0][1] == task_result.task_id, "Events should reference correct task"
    assert events_received[1][1] == task_result.task_id, "Events should reference correct task"
```

### Pattern 3: Transactional Integration Testing
```python
@pytest.mark.asyncio
async def test_transactional_integration():
    """Test transactional behavior across multiple components."""
    container = Container()
    transaction_manager = container.get(TransactionManager)
    
    async with transaction_manager.begin() as transaction:
        # Multiple operations within same transaction
        task_service = container.get(TaskService)
        artifact_service = container.get(ArtifactService)
        
        # Create task
        task_result = await task_service.create_task({
            "title": "Transactional Test",
            "description": "Test transactional integration"
        })
        
        # Create artifacts
        artifact_result = await artifact_service.create_artifact({
            "task_id": task_result.task_id,
            "name": "test_artifact.txt",
            "content": "Test content"
        })
        
        # Link task and artifact
        await task_service.add_artifact(task_result.task_id, artifact_result.artifact_id)
        
        # Verify within transaction
        task = await task_service.get_task(task_result.task_id)
        assert len(task.artifacts) == 1, "Task should have artifact within transaction"
        
        # Commit transaction
        await transaction.commit()
    
    # Verify after transaction commit
    task_service = container.get(TaskService)
    task = await task_service.get_task(task_result.task_id)
    
    assert task is not None, "Task should persist after commit"
    assert len(task.artifacts) == 1, "Artifact relationship should persist"
```

## Testing Infrastructure Patterns

### Integration Test Base Class
```python
class IntegrationTestBase:
    """Base class for integration tests with common setup."""
    
    @pytest.fixture(autouse=True)
    async def setup_integration_environment(self):
        """Setup integration test environment."""
        self.container = Container()
        self.container.configure(IntegrationTestConfiguration())
        
        await self.container.initialize()
        yield
        await self.container.cleanup()
    
    async def create_test_workflow(self, steps):
        """Helper to create test workflows."""
        orchestrator = self.container.get(WorkflowOrchestrator)
        workflow_id = await orchestrator.create_workflow("test_workflow")
        
        for step in steps:
            await orchestrator.add_step(workflow_id, step)
        
        return workflow_id
    
    async def execute_and_verify_workflow(self, workflow_id):
        """Helper to execute and verify workflow completion."""
        orchestrator = self.container.get(WorkflowOrchestrator)
        
        result = await orchestrator.execute_workflow(workflow_id)
        assert result.success, f"Workflow execution failed: {result.error}"
        
        state = await orchestrator.get_workflow_state(workflow_id)
        assert state.status == "completed", "Workflow should be completed"
        
        return state
```

### Mock External Systems
```python
@pytest.fixture
def mock_external_systems():
    """Provide mocked external systems for integration testing."""
    return {
        'github': AsyncMock(),
        'email_service': AsyncMock(),
        'file_storage': AsyncMock(),
        'analytics': AsyncMock()
    }

@pytest.fixture
async def integration_container(mock_external_systems):
    """Provide container configured with mocked external systems."""
    container = Container()
    
    # Override external systems with mocks
    for service_name, mock in mock_external_systems.items():
        container.override(service_name, mock)
    
    await container.initialize()
    yield container
    await container.cleanup()
```

## Best Practices

### 1. Isolate Integration Concerns
```python
# DON'T: Test everything in one integration test
async def test_everything_integration():
    # Tests database, external APIs, workflows, events, etc.
    pass

# DO: Focused integration tests
async def test_task_creation_integration():
    # Only tests task creation workflow
    pass

async def test_github_integration():
    # Only tests GitHub integration
    pass
```

### 2. Use Appropriate Test Doubles
```python
# DON'T: Use real external systems in integration tests
async def test_workflow_with_real_github():
    github_client = RealGitHubClient()  # Creates real repositories

# DO: Mock external systems
async def test_workflow_with_mocked_github(mock_github):
    # Test integration logic without external dependencies
    pass
```

### 3. Test Error Propagation
```python
# DON'T: Only test happy path integration
async def test_successful_workflow():
    # Only tests when everything works

# DO: Test error scenarios
async def test_workflow_with_external_failure():
    # Test how system handles external system failures
    mock_github.create_repository.side_effect = GitHubError("API rate limit")
    
    result = await workflow.execute()
    assert not result.success
    assert "GitHub" in result.error_message
```

### 4. Verify Side Effects
```python
# DON'T: Only verify return values
async def test_task_completion():
    result = await task_service.complete_task(task_id)
    assert result.success

# DO: Verify all side effects
async def test_task_completion():
    result = await task_service.complete_task(task_id)
    assert result.success
    
    # Verify database state
    task = await task_repository.get_by_id(task_id)
    assert task.status == "completed"
    
    # Verify events fired
    assert len(event_handler.received_events) == 1
    
    # Verify external system calls
    mock_notification.send.assert_called_once()
```

---

**Pattern Documentation Complete**: Comprehensive integration testing patterns with Clean Architecture workflows, multi-layer testing, and proper isolation strategies.