# Server Initialization Testing Patterns

**Extracted From**: test_server.py, test_initialization.py, test_rebuilt_package.py  
**Pattern Type**: System startup validation and component initialization  
**Applicability**: Server startup testing, component validation, system health checks

## Legacy Pattern Analysis

### Original Implementation (test_server.py)
```python
class TestServer(unittest.TestCase):
    """Test cases for the Vespera Scriptorium server."""

    def test_imports(self):
        """Test that all required modules can be imported."""
        try:
            from vespera_scriptorium import server
            self.assertTrue(True, "All imports successful")
        except ImportError as e:
            self.fail(f"Import error: {e}")

    def test_server_initialization(self):
        """Test that the server can be initialized."""
        try:
            from vespera_scriptorium import server
            self.assertIsNotNone(server.app, "Server app is initialized")
            self.assertIsNotNone(server.orchestrator, "Orchestrator is initialized")
            self.assertIsNotNone(server.state_manager, "State manager is initialized")
            self.assertIsNotNone(server.specialist_manager, "Specialist manager is initialized")
        except Exception as e:
            self.fail(f"Server initialization error: {e}")
```

### Legacy Pattern (test_initialization.py)
```python
try:
    # Set environment variables
    os.environ["MCP_TASK_ORCHESTRATOR_DB_PATH"] = r"E:\My Work\Programming\Vespera Scriptorium\vespera_scriptorium.db"
    os.environ["MCP_TASK_ORCHESTRATOR_BASE_DIR"] = r"E:\My Work\Programming\Vespera Scriptorium"
    
    from vespera_scriptorium.orchestrator.orchestration_state_manager import StateManager
    from vespera_scriptorium.orchestrator.task_orchestration_service import TaskOrchestrator
    from vespera_scriptorium.orchestrator.specialist_management_service import SpecialistManager
    
    # Initialize components
    state_manager = StateManager()
    specialist_manager = SpecialistManager()
    orchestrator = TaskOrchestrator(state_manager, specialist_manager)
    
    print("SUCCESS: Orchestrator initialization works correctly!")
    
except AttributeError as e:
    if "_get_parent_task_id" in str(e):
        print("CRITICAL FAILURE: StateManager issue still exists!")
        print("DO NOT RELEASE - Fix required")
```

### Pattern Strengths
1. **Import Validation**: Verifies modules can be imported successfully
2. **Component Availability**: Checks required components are initialized
3. **Environment Setup**: Tests with specific environment configuration
4. **Error Detection**: Identifies specific failure scenarios
5. **Release Readiness**: Validates system readiness for deployment

### Pattern Weaknesses
1. **Hard-coded Paths**: Windows-specific absolute paths in tests
2. **Direct Component Access**: Bypasses dependency injection
3. **Implementation Coupling**: Tests internal component structure
4. **Environment Pollution**: Sets global environment variables
5. **Legacy Architecture**: Assumes monolithic server structure

## Clean Architecture Adaptations

### Pattern 1: Container Initialization Testing
```python
import pytest
from vespera_scriptorium.infrastructure.di.container import Container
from vespera_scriptorium.infrastructure.di.service_configuration import ServiceConfiguration

def test_container_initialization():
    """Test dependency injection container initialization."""
    container = Container()
    
    # Test container can be configured
    configuration = ServiceConfiguration()
    container.configure(configuration)
    
    assert container.is_configured(), "Container should be configured"
    
    # Test core services can be resolved
    core_services = [
        'task_service',
        'orchestration_service',
        'template_service',
        'mcp_server'
    ]
    
    for service_name in core_services:
        service = container.get(service_name)
        assert service is not None, f"Service {service_name} should be available"
        
    print(f"✅ Container initialized with {len(core_services)} core services")
```

### Pattern 2: MCP Server Startup Testing
```python
@pytest.mark.asyncio
async def test_mcp_server_startup():
    """Test MCP server startup and readiness."""
    container = Container()
    container.configure(ServiceConfiguration())
    
    # Get MCP server
    mcp_server = container.get('mcp_server')
    
    # Test server can be initialized
    await mcp_server.initialize()
    assert mcp_server.is_initialized(), "MCP server should be initialized"
    
    # Test server capabilities
    capabilities = await mcp_server.get_capabilities()
    expected_capabilities = {
        'task_orchestration',
        'template_management',
        'tool_execution'
    }
    
    for capability in expected_capabilities:
        assert capability in capabilities, f"Server should have {capability} capability"
    
    # Test server can handle basic requests
    health_status = await mcp_server.health_check()
    assert health_status.healthy, f"Server should be healthy: {health_status.message}"
    
    # Cleanup
    await mcp_server.shutdown()
    assert not mcp_server.is_running(), "Server should be shutdown"
```

### Pattern 3: Environment-Independent Initialization
```python
@pytest.mark.asyncio
async def test_environment_independent_initialization():
    """Test initialization works across different environments."""
    test_environments = [
        {'ENV': 'test', 'DB_TYPE': 'memory'},
        {'ENV': 'development', 'DB_TYPE': 'sqlite'},
        {'ENV': 'production', 'DB_TYPE': 'postgresql'}
    ]
    
    for env_config in test_environments:
        # Create isolated container for each environment
        container = Container()
        
        # Configure environment
        config = ServiceConfiguration()
        for key, value in env_config.items():
            config.set_environment_variable(key, value)
        
        container.configure(config)
        
        try:
            # Test initialization
            await container.initialize_async_services()
            
            # Verify core services work
            task_service = container.get('task_service')
            assert task_service.is_ready(), f"Task service should be ready in {env_config['ENV']}"
            
            # Test basic operations
            health_check = await task_service.health_check()
            assert health_check.success, f"Health check should pass in {env_config['ENV']}"
            
        finally:
            await container.cleanup_async_services()
        
        print(f"✅ Initialization successful for environment: {env_config['ENV']}")
```

### Pattern 4: Progressive Service Initialization Testing
```python
@pytest.mark.asyncio
async def test_progressive_service_initialization():
    """Test services initialize in correct dependency order."""
    container = Container()
    initialization_order = []
    
    # Mock service initialization to track order
    class InitializationTracker:
        def __init__(self, service_name):
            self.service_name = service_name
            
        async def initialize(self):
            initialization_order.append(self.service_name)
            await asyncio.sleep(0.01)  # Simulate initialization time
    
    # Register services with dependencies
    services_config = {
        'database_service': {'dependencies': []},
        'repository_service': {'dependencies': ['database_service']},
        'domain_service': {'dependencies': ['repository_service']},
        'application_service': {'dependencies': ['domain_service']},
        'mcp_server': {'dependencies': ['application_service']}
    }
    
    # Test initialization order
    await container.initialize_services_with_dependencies(services_config)
    
    # Verify initialization order respects dependencies
    expected_order = ['database_service', 'repository_service', 'domain_service', 'application_service', 'mcp_server']
    assert initialization_order == expected_order, f"Expected {expected_order}, got {initialization_order}"
    
    print(f"✅ Services initialized in correct order: {' -> '.join(initialization_order)}")
```

## Advanced Initialization Patterns

### Pattern 1: Health Check Integration
```python
@pytest.mark.asyncio
async def test_comprehensive_health_checks():
    """Test comprehensive system health validation."""
    container = Container()
    await container.initialize()
    
    health_monitor = container.get('health_monitor')
    
    # Test individual component health
    component_health = await health_monitor.check_all_components()
    
    required_components = [
        'database_connection',
        'task_orchestrator',
        'template_engine',
        'mcp_protocol_handler'
    ]
    
    for component in required_components:
        assert component in component_health, f"Health check missing for {component}"
        assert component_health[component]['status'] == 'healthy', f"{component} should be healthy"
    
    # Test system-wide health
    system_health = await health_monitor.check_system_health()
    assert system_health.overall_status == 'healthy', "System should be healthy"
    assert system_health.ready_for_requests, "System should be ready for requests"
    
    print(f"✅ All {len(required_components)} components healthy")
```

### Pattern 2: Graceful Degradation Testing
```python
@pytest.mark.asyncio
async def test_graceful_degradation():
    """Test system behavior when optional components fail."""
    container = Container()
    
    # Simulate optional service failure
    mock_analytics = Mock()
    mock_analytics.initialize.side_effect = Exception("Analytics service unavailable")
    container.override('analytics_service', mock_analytics)
    
    # System should still initialize
    await container.initialize()
    
    # Core functionality should work
    task_service = container.get('task_service')
    result = await task_service.create_task({
        'title': 'Test Task',
        'description': 'Test graceful degradation'
    })
    
    assert result.success, "Core functionality should work without analytics"
    
    # Verify degraded mode is reported
    health_monitor = container.get('health_monitor')
    health = await health_monitor.check_system_health()
    
    assert health.overall_status == 'degraded', "System should report degraded status"
    assert 'analytics_service' in health.failed_components, "Should report analytics failure"
    
    print("✅ System operates gracefully with failed optional components")
```

### Pattern 3: Configuration Validation Testing
```python
def test_configuration_validation():
    """Test configuration validation during initialization."""
    # Test with valid configuration
    valid_config = ServiceConfiguration()
    valid_config.set('database.url', 'sqlite:///:memory:')
    valid_config.set('server.port', 8080)
    valid_config.set('logging.level', 'INFO')
    
    container = Container()
    container.configure(valid_config)
    
    assert container.is_configured(), "Should accept valid configuration"
    
    # Test with invalid configuration
    invalid_config = ServiceConfiguration()
    invalid_config.set('database.url', '')  # Empty database URL
    invalid_config.set('server.port', 'invalid')  # Invalid port
    
    with pytest.raises(ConfigurationError) as exc_info:
        container.configure(invalid_config)
    
    assert "database.url" in str(exc_info.value), "Should report database URL error"
    assert "server.port" in str(exc_info.value), "Should report port error"
    
    print("✅ Configuration validation prevents invalid setup")
```

## Testing Infrastructure Patterns

### Initialization Test Fixtures
```python
@pytest.fixture
async def initialized_container():
    """Provide fully initialized container for tests."""
    container = Container()
    config = ServiceConfiguration()
    config.configure_for_testing()
    
    container.configure(config)
    await container.initialize()
    
    yield container
    
    await container.cleanup()

@pytest.fixture
async def mcp_server(initialized_container):
    """Provide initialized MCP server."""
    server = initialized_container.get('mcp_server')
    await server.start()
    
    yield server
    
    await server.stop()

@pytest.fixture
def health_monitor(initialized_container):
    """Provide health monitor for testing."""
    return initialized_container.get('health_monitor')
```

### Environment Setup Utilities
```python
class TestEnvironment:
    """Utility for setting up test environments."""
    
    @staticmethod
    def create_test_configuration():
        """Create configuration for testing."""
        config = ServiceConfiguration()
        config.set('database.url', 'sqlite:///:memory:')
        config.set('environment', 'test')
        config.set('logging.level', 'DEBUG')
        config.set('external_services.enabled', False)
        return config
    
    @staticmethod
    async def create_initialized_container():
        """Create and initialize container for testing."""
        container = Container()
        config = TestEnvironment.create_test_configuration()
        
        container.configure(config)
        await container.initialize()
        
        return container
    
    @staticmethod
    async def verify_initialization(container):
        """Verify container is properly initialized."""
        health_monitor = container.get('health_monitor')
        health = await health_monitor.check_system_health()
        
        assert health.overall_status in ['healthy', 'degraded'], f"System status: {health.overall_status}"
        assert health.ready_for_requests, "System should be ready"
        
        return health
```

## Best Practices

### 1. Test Initialization, Not Implementation
```python
# DON'T: Test internal component structure
def test_server_attributes():
    from vespera_scriptorium import server
    assert hasattr(server, 'app')
    assert hasattr(server, 'orchestrator')

# DO: Test initialization contracts
@pytest.mark.asyncio
async def test_server_initialization():
    container = Container()
    await container.initialize()
    
    server = container.get('mcp_server')
    assert server.is_initialized()
    assert server.can_handle_requests()
```

### 2. Use Environment-Independent Tests
```python
# DON'T: Hard-code environment paths
os.environ["DB_PATH"] = r"E:\My Work\Programming\database.db"

# DO: Use test-specific configuration
config = ServiceConfiguration()
config.configure_for_testing()
container.configure(config)
```

### 3. Test Error Scenarios
```python
# DON'T: Only test successful initialization
async def test_initialization():
    container = Container()
    await container.initialize()
    assert container.is_ready()

# DO: Test failure scenarios
async def test_initialization_with_database_failure():
    container = Container()
    
    # Mock database failure
    mock_db = Mock()
    mock_db.connect.side_effect = DatabaseError("Connection failed")
    container.override('database', mock_db)
    
    with pytest.raises(InitializationError):
        await container.initialize()
```

### 4. Verify Cleanup
```python
# DON'T: Ignore cleanup
async def test_server_startup():
    server = create_server()
    await server.start()
    # Missing cleanup

# DO: Ensure proper cleanup
async def test_server_startup():
    server = create_server()
    try:
        await server.start()
        assert server.is_running()
    finally:
        await server.stop()
        assert not server.is_running()
```

## Reusable Initialization Components

### Server Test Suite
```python
class ServerInitializationTestSuite:
    """Reusable test suite for server initialization."""
    
    @pytest.mark.asyncio
    async def test_basic_initialization(self):
        """Test basic server initialization."""
        container = await TestEnvironment.create_initialized_container()
        health = await TestEnvironment.verify_initialization(container)
        assert health.overall_status == 'healthy'
        await container.cleanup()
    
    @pytest.mark.asyncio
    async def test_service_dependencies(self):
        """Test service dependency resolution."""
        container = Container()
        config = TestEnvironment.create_test_configuration()
        
        container.configure(config)
        await container.initialize()
        
        # Verify all services are available
        required_services = [
            'task_service',
            'template_service',
            'mcp_server',
            'health_monitor'
        ]
        
        for service_name in required_services:
            service = container.get(service_name)
            assert service is not None, f"Service {service_name} should be available"
        
        await container.cleanup()
    
    @pytest.mark.asyncio
    async def test_health_monitoring(self):
        """Test health monitoring during initialization."""
        container = await TestEnvironment.create_initialized_container()
        
        health_monitor = container.get('health_monitor')
        health = await health_monitor.check_system_health()
        
        assert health.ready_for_requests, "System should be ready"
        assert len(health.healthy_components) > 0, "Should have healthy components"
        
        await container.cleanup()
```

---

**Pattern Documentation Complete**: Comprehensive server initialization patterns with Clean Architecture dependency injection, health monitoring, and environment-independent testing strategies.