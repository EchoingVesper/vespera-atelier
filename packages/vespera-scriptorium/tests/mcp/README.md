# MCP Server Testing Framework

Comprehensive testing framework for the Vespera Scriptorium MCP Server v3.0. This framework provides unit tests, integration tests, and end-to-end testing capabilities for the FastMCP translation layer to the Rust Bindery backend.

## Framework Structure

```
tests/mcp/
├── __init__.py                     # Package initialization
├── README.md                       # This documentation
├── unit/                           # Unit tests for individual components
│   ├── __init__.py
│   ├── test_mcp_tools.py          # Tests for individual MCP tools
│   └── test_bindery_client.py     # Tests for HTTP client
├── integration/                    # Integration and protocol compliance tests
│   ├── __init__.py
│   ├── test_mcp_protocol.py       # MCP protocol compliance tests
│   └── test_interruption_handling.py # "Interrupted by user" fix tests
├── fixtures/                       # Test data and fixtures
│   ├── __init__.py
│   ├── test_data.py               # Sample data and fixtures
│   └── test_helpers.py            # Test utilities and helpers
└── mocks/                          # Mock services and utilities
    ├── __init__.py
    └── bindery_mock.py            # Mock Bindery service
```

## Key Features

### 1. Comprehensive Test Coverage

- **Unit Tests**: Test individual MCP tools, HTTP client, and error handling
- **Integration Tests**: Test MCP protocol compliance and end-to-end workflows
- **Mock Services**: Complete mock Bindery backend for isolated testing
- **Error Scenarios**: Extensive error condition and edge case testing

### 2. "Interrupted by User" Issue Testing

Special focus on testing the fix for MCP tool interruption issues:

```python
# Example test for interruption handling
@pytest.mark.asyncio
async def test_interrupted_task_creation_returns_error():
    """Test that interrupted operations return structured error responses"""
    # Simulate interruption during operation
    mock_client.create_task.side_effect = KeyboardInterrupt("User interrupted")

    result = await create_task(task_input)

    # Should return error response, not raise exception
    assert isinstance(result, dict)
    assert "error" in result
    assert result["operation"] == "create_task"
```

### 3. Mock Bindery Service

Comprehensive mock implementation that simulates the Rust Bindery backend:

```python
# Use mock service for testing
async with mock_bindery_service() as service:
    # Configure service behavior
    service.simulate_connection_error(True)
    service.simulate_slow_response(2.0)

    # Run tests against mock service
    result = await mcp_tool_function()
```

### 4. Protocol Compliance Testing

Ensures adherence to MCP (Model Context Protocol) and JSON-RPC 2.0 specifications:

- Request/response format validation
- Tool parameter validation
- Error response structure compliance
- Concurrent operation handling

## Running Tests

### Quick Start

```bash
# Run all tests with coverage
python run_mcp_tests.py

# Run specific test categories
python run_mcp_tests.py --unit           # Unit tests only
python run_mcp_tests.py --integration    # Integration tests only
python run_mcp_tests.py --interruption   # Interruption handling tests
```

### Advanced Testing

```bash
# Fast testing without coverage
python run_mcp_tests.py --fast

# Parallel test execution
python run_mcp_tests.py --parallel

# Test specific component
python run_mcp_tests.py --path tests/mcp/unit/test_mcp_tools.py

# Run with debugging output
python run_mcp_tests.py --no-capture --fail-fast
```

### Using Pytest Directly

```bash
# Basic pytest usage
pytest tests/mcp/

# Run with specific markers
pytest -m "unit and not slow"
pytest -m "interruption"
pytest -m "mcp"

# Generate coverage report
pytest --cov=mcp_server --cov-report=html

# Run specific test
pytest tests/mcp/integration/test_interruption_handling.py::TestInterruptionHandling::test_interrupted_task_creation_returns_error
```

## Test Categories and Markers

Tests are organized with pytest markers for easy selection:

- `@pytest.mark.unit` - Unit tests for individual components
- `@pytest.mark.integration` - Integration tests
- `@pytest.mark.mcp` - MCP protocol compliance tests
- `@pytest.mark.interruption` - Interruption handling tests
- `@pytest.mark.error_handling` - Error scenario tests
- `@pytest.mark.slow` - Long-running tests (excluded by default)
- `@pytest.mark.network` - Tests requiring network connectivity
- `@pytest.mark.bindery` - Tests interacting with Bindery backend

## Key Test Scenarios

### 1. MCP Tool Testing

```python
# Test successful tool execution
result = await create_task(task_input)
assert result["id"] == "task-123"
assert result["title"] == "Test Task"

# Test error handling
mock_client.create_task.side_effect = BinderyClientError("Creation failed")
result = await create_task(task_input)
assert result["error"] == "Creation failed"
```

### 2. Protocol Compliance

```python
# Test JSON-RPC 2.0 format compliance
request = {
    "jsonrpc": "2.0",
    "id": "test-123",
    "method": "tools/call",
    "params": {"name": "health_check", "arguments": {}}
}
# Verify proper handling and response structure
```

### 3. Interruption Scenarios

```python
# Test various interruption types
interruption_types = [
    KeyboardInterrupt("User pressed Ctrl+C"),
    asyncio.CancelledError("Operation cancelled"),
    SystemExit("System shutdown")
]

for interruption in interruption_types:
    mock_client.operation.side_effect = interruption
    result = await mcp_tool()
    assert "error" in result  # Should return error, not raise
```

### 4. Concurrent Operations

```python
# Test concurrent tool calls with mixed outcomes
tasks = [
    asyncio.create_task(create_task(input1)),
    asyncio.create_task(health_check()),
    asyncio.create_task(get_task("id"))
]

results = await asyncio.gather(*tasks)
# Verify all return proper responses
```

## Coverage Goals

The testing framework aims for:

- **Line Coverage**: > 80% (enforced by pytest configuration)
- **Branch Coverage**: > 75%
- **Function Coverage**: > 85%
- **Critical Paths**: 100% (error handling, interruption scenarios)

## Mock Service Features

The `MockBinderyService` provides comprehensive backend simulation:

```python
# Configure mock service behavior
mock_service.simulate_connection_error(True)      # Connection failures
mock_service.simulate_http_error(True)            # HTTP errors
mock_service.simulate_slow_response(2.0)          # Network latency
mock_service.set_unhealthy(True)                  # Unhealthy backend
```

Supported operations:
- Task management (create, read, update, list)
- Project management
- Search operations
- Dashboard statistics
- Health checks

## Test Utilities

### InterruptionSimulator

```python
simulator = InterruptionSimulator()

# Simulate various interruption types
await simulator.simulate_sigint(target_task, delay=0.1)
await simulator.simulate_cancellation(target_task)

# Use context manager for clean testing
async with simulator.with_interruption("sigint", delay=0.5):
    result = await long_running_operation()
```

### NetworkSimulator

```python
network = NetworkSimulator()
network.set_latency(1.0)           # Add 1 second latency
network.set_packet_loss(0.1)       # 10% packet loss
```

### Performance Timer

```python
timer = performance_timer  # From fixture
timer.start("operation")
await some_operation()
duration = timer.stop("operation")
assert duration < 1.0  # Should complete in under 1 second
```

## Debugging Tests

### Enable Debug Output

```bash
# Show all output during tests
python run_mcp_tests.py --no-capture

# Enable detailed logging
VESPERA_LOG_LEVEL=DEBUG python run_mcp_tests.py
```

### Test Specific Scenarios

```bash
# Test only error handling
pytest -m error_handling -v

# Test with maximum verbosity
pytest tests/mcp/unit/test_mcp_tools.py -vvv

# Debug specific test
pytest tests/mcp/integration/test_interruption_handling.py::TestInterruptionHandling::test_interrupted_task_creation_returns_error -vv -s
```

## Best Practices

### 1. Test Isolation

- Each test uses fresh mock services
- No shared state between tests
- Proper cleanup after test completion

### 2. Realistic Scenarios

- Tests mirror real-world usage patterns
- Error conditions based on actual backend behaviors
- Performance testing under realistic loads

### 3. Maintainable Tests

- Clear test names describing the scenario
- Comprehensive docstrings explaining test purpose
- Reusable fixtures and utilities

### 4. Fast Execution

- Tests complete in under 30 seconds total
- Parallel execution support
- Mock services avoid real network calls

## Continuous Integration

The framework is designed for CI/CD integration:

```yaml
# Example CI configuration
- name: Run MCP Server Tests
  run: python run_mcp_tests.py --parallel --fail-fast

- name: Check Coverage
  run: python run_mcp_tests.py --fast && coverage report --fail-under=80

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    file: ./coverage.xml
```

## Troubleshooting

### Common Issues

1. **Import Errors**: Ensure all dependencies are installed with `pip install -r requirements.txt`

2. **Async Test Failures**: Check that `pytest-asyncio` is installed and `asyncio_mode = auto` is set

3. **Coverage Issues**: Verify all source files are included in coverage configuration

4. **Mock Service Issues**: Ensure mock service is properly reset between tests using fixtures

### Debug Mode

Run tests with maximum debug information:

```bash
PYTHONDONTWRITEBYTECODE=1 VESPERA_LOG_LEVEL=DEBUG python -m pytest tests/mcp/ -vvv -s --tb=long
```

## Contributing

When adding new tests:

1. Follow the existing test structure and naming conventions
2. Use appropriate pytest markers
3. Include comprehensive docstrings
4. Test both success and failure scenarios
5. Use mock services for external dependencies
6. Ensure tests run quickly and independently

## Performance Benchmarks

The test suite should maintain these performance characteristics:

- **Unit Tests**: < 10 seconds total
- **Integration Tests**: < 20 seconds total
- **Full Suite**: < 30 seconds total
- **Individual Test**: < 1 second each
- **Mock Service Operations**: < 10ms each

Run performance analysis:

```bash
pytest tests/mcp/ --durations=10  # Show 10 slowest tests
```

This comprehensive testing framework ensures the reliability, robustness, and maintainability of the Vespera Scriptorium MCP server.