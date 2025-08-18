"""
Pytest Configuration for Clean Architecture Testing

Provides pytest configuration, markers, and plugins for comprehensive
testing across all architectural layers with proper isolation and validation.
"""

import asyncio
import logging
import pytest
from pathlib import Path
from typing import Any, Dict, List, Optional

from .validation_framework import ValidationFramework, ValidationLevel, create_architectural_validation_hook


# ==============================================
# Pytest Markers
# ==============================================

pytest_plugins = []

def pytest_configure(config):
    """Configure pytest with custom markers and settings."""
    
    # Register custom markers
    config.addinivalue_line(
        "markers", 
        "domain: mark test as domain layer test"
    )
    config.addinivalue_line(
        "markers", 
        "application: mark test as application layer test"
    )
    config.addinivalue_line(
        "markers", 
        "infrastructure: mark test as infrastructure layer test"
    )
    config.addinivalue_line(
        "markers", 
        "integration: mark test as integration test"
    )
    config.addinivalue_line(
        "markers", 
        "e2e: mark test as end-to-end test"
    )
    config.addinivalue_line(
        "markers", 
        "slow: mark test as slow running"
    )
    config.addinivalue_line(
        "markers", 
        "async_test: mark test as async test"
    )
    config.addinivalue_line(
        "markers", 
        "database: mark test as requiring database"
    )
    config.addinivalue_line(
        "markers", 
        "external_service: mark test as requiring external services"
    )
    config.addinivalue_line(
        "markers", 
        "performance: mark test as performance test"
    )
    config.addinivalue_line(
        "markers", 
        "validation: mark test as architectural validation test"
    )
    
    # Configure logging for tests
    logging.basicConfig(
        level=logging.WARNING,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Enable asyncio mode
    config.option.asyncio_mode = "auto"


def pytest_collection_modifyitems(config, items):
    """Modify test collection to add automatic markers."""
    
    for item in items:
        # Auto-mark tests based on file path
        test_path = Path(item.fspath)
        
        # Mark by layer
        if '/domain/' in str(test_path) or 'test_domain' in test_path.name:
            item.add_marker(pytest.mark.domain)
        elif '/application/' in str(test_path) or 'test_application' in test_path.name:
            item.add_marker(pytest.mark.application)
        elif '/infrastructure/' in str(test_path) or 'test_infrastructure' in test_path.name:
            item.add_marker(pytest.mark.infrastructure)
        elif 'integration' in test_path.name or 'test_integration' in test_path.name:
            item.add_marker(pytest.mark.integration)
        elif 'e2e' in test_path.name or 'end_to_end' in test_path.name:
            item.add_marker(pytest.mark.e2e)
        
        # Auto-mark async tests
        if asyncio.iscoroutinefunction(item.function):
            item.add_marker(pytest.mark.async_test)
        
        # Auto-mark database tests
        if 'database' in test_path.name or 'db' in test_path.name:
            item.add_marker(pytest.mark.database)
        
        # Auto-mark performance tests
        if 'performance' in test_path.name or 'perf' in test_path.name:
            item.add_marker(pytest.mark.performance)
            item.add_marker(pytest.mark.slow)


def pytest_addoption(parser):
    """Add custom command line options."""
    
    parser.addoption(
        "--layer",
        action="store",
        default=None,
        help="Run tests for specific architectural layer: domain, application, infrastructure, integration"
    )
    
    parser.addoption(
        "--validation-level",
        action="store", 
        default="standard",
        choices=["basic", "standard", "strict", "comprehensive"],
        help="Set architectural validation level"
    )
    
    parser.addoption(
        "--skip-validation",
        action="store_true",
        default=False,
        help="Skip architectural validation"
    )
    
    parser.addoption(
        "--performance",
        action="store_true",
        default=False,
        help="Run performance tests"
    )
    
    parser.addoption(
        "--integration-only",
        action="store_true",
        default=False,
        help="Run only integration and e2e tests"
    )
    
    parser.addoption(
        "--unit-only",
        action="store_true",
        default=False,
        help="Run only unit tests (domain, application, infrastructure layers)"
    )


def pytest_runtest_setup(item):
    """Setup for individual test runs."""
    
    # Skip tests based on command line options
    config = item.config
    
    # Layer filtering
    layer_option = config.getoption("--layer")
    if layer_option:
        layer_markers = [mark.name for mark in item.iter_markers()]
        if layer_option not in layer_markers:
            pytest.skip(f"Test not in requested layer: {layer_option}")
    
    # Performance test filtering
    if config.getoption("--performance"):
        if "performance" not in [mark.name for mark in item.iter_markers()]:
            pytest.skip("Not a performance test")
    else:
        if "performance" in [mark.name for mark in item.iter_markers()]:
            pytest.skip("Performance test skipped (use --performance to run)")
    
    # Integration/unit filtering
    if config.getoption("--integration-only"):
        markers = [mark.name for mark in item.iter_markers()]
        if not any(marker in markers for marker in ["integration", "e2e"]):
            pytest.skip("Not an integration test")
    
    if config.getoption("--unit-only"):
        markers = [mark.name for mark in item.iter_markers()]
        if any(marker in markers for marker in ["integration", "e2e"]):
            pytest.skip("Not a unit test")


@pytest.hookimpl(tryfirst=True)
def pytest_sessionstart(session):
    """Execute at the start of test session."""
    
    config = session.config
    
    # Run architectural validation if not skipped
    if not config.getoption("--skip-validation"):
        validation_level_str = config.getoption("--validation-level")
        validation_level = ValidationLevel(validation_level_str)
        
        # Create and run validation
        validation_hook = create_architectural_validation_hook(validation_level)
        validation_hook(session)


def pytest_sessionfinish(session, exitstatus):
    """Execute at the end of test session."""
    
    # Log test session summary
    if hasattr(session, 'testscollected'):
        total_tests = session.testscollected
        passed = len([r for r in session.testsfailed if r.passed])
        failed = len(session.testsfailed)
        
        print(f"\n=== Test Session Summary ===")
        print(f"Total tests: {total_tests}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Success rate: {(passed/total_tests)*100:.1f}%" if total_tests > 0 else "No tests")


# ==============================================
# Fixtures for Test Configuration
# ==============================================

@pytest.fixture(scope="session")
def test_session_config():
    """Provide test session configuration."""
    return {
        "session_id": "test_session_" + str(hash(str(Path.cwd()))),
        "project_root": Path.cwd(),
        "test_data_dir": Path.cwd() / "tests" / "test_data",
        "temp_dir": Path.cwd() / "tests" / "temp",
        "validation_enabled": True
    }


@pytest.fixture(scope="session", autouse=True)
async def setup_test_environment(test_session_config):
    """Setup test environment for entire session."""
    
    # Create test directories
    test_session_config["test_data_dir"].mkdir(parents=True, exist_ok=True)
    test_session_config["temp_dir"].mkdir(parents=True, exist_ok=True)
    
    yield
    
    # Cleanup test environment
    import shutil
    try:
        if test_session_config["temp_dir"].exists():
            shutil.rmtree(test_session_config["temp_dir"])
    except:
        pass


@pytest.fixture
def test_metadata(request):
    """Provide test metadata."""
    return {
        "test_name": request.node.name,
        "test_file": request.node.fspath.basename,
        "test_markers": [mark.name for mark in request.node.iter_markers()],
        "test_path": str(request.node.fspath),
        "is_async": asyncio.iscoroutinefunction(request.function),
    }


# ==============================================
# Performance Testing Configuration
# ==============================================

@pytest.fixture
def performance_config():
    """Provide performance test configuration."""
    return {
        "max_execution_time": 5.0,  # seconds
        "max_memory_usage": 100,    # MB
        "throughput_threshold": 100,  # operations per second
        "concurrent_users": 10,
        "load_test_duration": 30,   # seconds
    }


def pytest_benchmark_group_stats(config, benchmarks, group_by):
    """Configure benchmark grouping."""
    return {
        "layer": lambda benchmark: benchmark.get("layer", "unknown"),
        "operation": lambda benchmark: benchmark.get("operation", "unknown"),
    }


# ==============================================
# Async Testing Configuration
# ==============================================

@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def async_test_timeout():
    """Provide timeout for async tests."""
    return 30.0  # seconds


# ==============================================
# Error Handling and Reporting
# ==============================================

def pytest_runtest_makereport(item, call):
    """Customize test reporting."""
    
    if call.when == "call":
        # Add custom information to test reports
        if hasattr(item, "_test_metadata"):
            call.result.test_metadata = item._test_metadata


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_protocol(item, nextitem):
    """Wrap test execution with custom protocol."""
    
    # Store test start time
    import time
    start_time = time.time()
    
    # Execute test
    outcome = yield
    
    # Calculate execution time
    execution_time = time.time() - start_time
    
    # Store execution time on item for reporting
    item._execution_time = execution_time
    
    # Log slow tests
    if execution_time > 5.0 and "slow" not in [mark.name for mark in item.iter_markers()]:
        print(f"\nWarning: Test {item.name} took {execution_time:.2f}s (consider adding @pytest.mark.slow)")


# ==============================================
# Custom Test Utilities
# ==============================================

class TestContextManager:
    """Context manager for test execution."""
    
    def __init__(self, test_name: str):
        self.test_name = test_name
        self.start_time = None
        self.resources = []
    
    def __enter__(self):
        import time
        self.start_time = time.time()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        # Cleanup resources
        for resource in reversed(self.resources):
            try:
                if hasattr(resource, 'cleanup'):
                    resource.cleanup()
                elif hasattr(resource, 'close'):
                    resource.close()
            except:
                pass
    
    def add_resource(self, resource):
        """Add resource for cleanup."""
        self.resources.append(resource)


@pytest.fixture
def test_context(test_metadata):
    """Provide test context manager."""
    with TestContextManager(test_metadata["test_name"]) as context:
        yield context


# ==============================================
# Debugging and Development Utilities
# ==============================================

def pytest_exception_interact(node, call, report):
    """Called when test raises exception (useful for debugging)."""
    
    if call.when == "call":
        # Add debugging information
        print(f"\n=== Test Failed: {node.name} ===")
        print(f"File: {node.fspath}")
        print(f"Exception: {report.longrepr}")


@pytest.fixture
def debug_mode(request):
    """Enable debug mode for tests."""
    return request.config.getoption("--pdb") or request.config.getoption("--pdbcls")


# ==============================================
# Parallel Testing Configuration
# ==============================================

def pytest_configure_node(node):
    """Configure worker nodes for parallel execution."""
    # This would be used with pytest-xdist
    node.slaveinput["test_worker_id"] = node.slaveinput.get("workerid", "master")


@pytest.fixture
def worker_id(request):
    """Get worker ID for parallel testing."""
    return getattr(request.config, "slaveinput", {}).get("test_worker_id", "master")