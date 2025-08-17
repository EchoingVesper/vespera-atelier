"""
Test Infrastructure Base Classes - Clean Architecture Foundation

This module provides the foundational test base classes for each architectural layer,
supporting dependency injection, proper test isolation, and comprehensive coverage.

Design Principles:
- Layer-specific test isolation 
- Dependency injection integration
- Async/await support throughout
- Clean Architecture boundary respect
- Resource lifecycle management
"""

import asyncio
import logging
import pytest
import tempfile
import uuid
from abc import ABC, abstractmethod
from contextlib import asynccontextmanager, contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Type, TypeVar, Union
from unittest.mock import AsyncMock, MagicMock

from vespera_scriptorium.infrastructure.di.container import ServiceContainer
from vespera_scriptorium.infrastructure.di.registration import ServiceRegistrar
from vespera_scriptorium.infrastructure.di.lifetime_managers import LifetimeScope

T = TypeVar("T")
logger = logging.getLogger(__name__)


class TestResourceManager:
    """Manages test resources and cleanup."""
    
    def __init__(self):
        self._temp_dirs: List[tempfile.TemporaryDirectory] = []
        self._temp_files: List[Path] = []
        self._async_resources: List[Any] = []
        self._cleanup_callbacks: List[callable] = []
    
    def create_temp_dir(self) -> Path:
        """Create temporary directory for test use."""
        temp_dir = tempfile.TemporaryDirectory()
        self._temp_dirs.append(temp_dir)
        return Path(temp_dir.name)
    
    def create_temp_file(self, content: str = "", suffix: str = ".txt") -> Path:
        """Create temporary file with optional content."""
        temp_dir = self.create_temp_dir()
        temp_file = temp_dir / f"test_file_{uuid.uuid4().hex[:8]}{suffix}"
        temp_file.write_text(content)
        self._temp_files.append(temp_file)
        return temp_file
    
    def track_async_resource(self, resource: Any):
        """Track async resource for cleanup."""
        self._async_resources.append(resource)
    
    def add_cleanup_callback(self, callback: callable):
        """Add cleanup callback."""
        self._cleanup_callbacks.append(callback)
    
    async def cleanup_all(self):
        """Clean up all test resources."""
        # Run cleanup callbacks
        for callback in reversed(self._cleanup_callbacks):
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback()
                else:
                    callback()
            except Exception as e:
                logger.warning(f"Cleanup callback failed: {e}")
        
        # Clean up async resources
        for resource in reversed(self._async_resources):
            try:
                if hasattr(resource, 'cleanup'):
                    await resource.cleanup()
                elif hasattr(resource, 'close'):
                    if asyncio.iscoroutinefunction(resource.close):
                        await resource.close()
                    else:
                        resource.close()
            except Exception as e:
                logger.warning(f"Async resource cleanup failed: {e}")
        
        # Clean up temp directories
        for temp_dir in reversed(self._temp_dirs):
            try:
                temp_dir.cleanup()
            except Exception as e:
                logger.warning(f"Temp directory cleanup failed: {e}")
        
        self._temp_dirs.clear()
        self._temp_files.clear()
        self._async_resources.clear()
        self._cleanup_callbacks.clear()


class TestConfiguration:
    """Test configuration and environment setup."""
    
    def __init__(self):
        self.test_db_url = ":memory:"
        self.enable_logging = False
        self.log_level = logging.WARNING
        self.mock_external_services = True
        self.use_in_memory_storage = True
        self.test_timeout = 30.0
    
    def configure_logging(self):
        """Configure logging for tests."""
        if self.enable_logging:
            logging.basicConfig(level=self.log_level)
        else:
            logging.disable(logging.CRITICAL)


class BaseTestClass(ABC):
    """
    Abstract base class for all test classes.
    Provides common test infrastructure and resource management.
    """
    
    def __init__(self):
        self.test_config = TestConfiguration()
        self.resource_manager = TestResourceManager()
        self._container: Optional[ServiceContainer] = None
    
    @pytest.fixture(autouse=True)
    async def setup_base_test_environment(self):
        """Automatic setup for all test classes."""
        # Configure test environment
        self.test_config.configure_logging()
        
        # Setup test-specific configuration
        await self.setup_test_configuration()
        
        # Setup container
        await self.setup_container()
        
        yield
        
        # Cleanup
        await self.cleanup_test_environment()
    
    async def setup_test_configuration(self):
        """Override to customize test configuration."""
        pass
    
    async def setup_container(self):
        """Setup dependency injection container for tests."""
        self._container = ServiceContainer()
        await self.configure_container(self._container)
    
    async def configure_container(self, container: ServiceContainer):
        """Override to configure the DI container."""
        pass
    
    async def cleanup_test_environment(self):
        """Clean up test environment."""
        try:
            await self.resource_manager.cleanup_all()
            if self._container:
                self._container.dispose()
        except Exception as e:
            logger.warning(f"Test cleanup failed: {e}")
    
    @property
    def container(self) -> ServiceContainer:
        """Get the DI container."""
        if not self._container:
            raise RuntimeError("Container not initialized")
        return self._container
    
    def get_service(self, service_type: Type[T]) -> T:
        """Get service from container."""
        return self.container.get_service(service_type)
    
    def create_test_id(self, prefix: str = "test") -> str:
        """Create unique test ID."""
        return f"{prefix}_{uuid.uuid4().hex[:8]}"


class DomainTestBase(BaseTestClass):
    """
    Base class for domain layer tests.
    
    Focuses on:
    - Entity validation and business logic
    - Value object behavior
    - Domain service functionality
    - Invariant enforcement
    """
    
    async def setup_test_configuration(self):
        """Configure for domain testing."""
        self.test_config.mock_external_services = True
        self.test_config.use_in_memory_storage = True
    
    async def configure_container(self, container: ServiceContainer):
        """Configure container for domain testing."""
        # Domain layer should have minimal dependencies
        # Register domain services only
        registrar = container.register()
        await self.register_domain_services(registrar)
        registrar.build()
    
    async def register_domain_services(self, registrar: ServiceRegistrar):
        """Override to register domain services."""
        pass
    
    def create_test_entity(self, entity_type: Type[T], **kwargs) -> T:
        """Helper to create test entities with default values."""
        defaults = self.get_entity_defaults(entity_type)
        defaults.update(kwargs)
        return entity_type(**defaults)
    
    def get_entity_defaults(self, entity_type: Type) -> Dict[str, Any]:
        """Override to provide default values for entities."""
        return {}
    
    def assert_invariant(self, condition: bool, message: str):
        """Assert business invariant."""
        assert condition, f"Business invariant violated: {message}"
    
    def assert_domain_rule(self, entity: Any, rule_checker: callable, message: str):
        """Assert domain rule compliance."""
        assert rule_checker(entity), f"Domain rule violated: {message}"


class ApplicationTestBase(BaseTestClass):
    """
    Base class for application layer tests.
    
    Focuses on:
    - Use case orchestration
    - DTO validation
    - Interface contract testing
    - Cross-cutting concerns (logging, validation, etc.)
    """
    
    async def setup_test_configuration(self):
        """Configure for application testing."""
        self.test_config.mock_external_services = True
        self.test_config.use_in_memory_storage = True
    
    async def configure_container(self, container: ServiceContainer):
        """Configure container for application testing."""
        registrar = container.register()
        
        # Register mocked infrastructure services
        await self.register_mock_infrastructure(registrar)
        
        # Register real application services
        await self.register_application_services(registrar)
        
        # Register real domain services
        await self.register_domain_services(registrar)
        
        registrar.build()
    
    async def register_mock_infrastructure(self, registrar: ServiceRegistrar):
        """Register mocked infrastructure services."""
        pass
    
    async def register_application_services(self, registrar: ServiceRegistrar):
        """Register application services."""
        pass
    
    async def register_domain_services(self, registrar: ServiceRegistrar):
        """Register domain services."""
        pass
    
    @asynccontextmanager
    async def use_case_context(self, use_case_type: Type[T]) -> T:
        """Context manager for use case testing."""
        use_case = self.get_service(use_case_type)
        try:
            yield use_case
        finally:
            # Clean up use case resources if needed
            if hasattr(use_case, 'cleanup'):
                await use_case.cleanup()
    
    async def execute_use_case(self, use_case_type: Type[T], input_data: Any) -> Any:
        """Execute use case with input validation."""
        async with self.use_case_context(use_case_type) as use_case:
            result = await use_case.execute(input_data)
            self.assert_use_case_result(result)
            return result
    
    def assert_use_case_result(self, result: Any):
        """Assert use case result validity."""
        assert hasattr(result, 'success'), "Use case result must have success attribute"
        if not result.success:
            error_msg = getattr(result, 'error', 'Unknown error')
            pytest.fail(f"Use case failed: {error_msg}")
    
    def create_test_dto(self, dto_type: Type[T], **kwargs) -> T:
        """Helper to create test DTOs."""
        defaults = self.get_dto_defaults(dto_type)
        defaults.update(kwargs)
        return dto_type(**defaults)
    
    def get_dto_defaults(self, dto_type: Type) -> Dict[str, Any]:
        """Override to provide DTO defaults."""
        return {}


class InfrastructureTestBase(BaseTestClass):
    """
    Base class for infrastructure layer tests.
    
    Focuses on:
    - Repository implementation testing
    - External service integration
    - MCP protocol compliance
    - Database operations
    - File system operations
    """
    
    async def setup_test_configuration(self):
        """Configure for infrastructure testing."""
        self.test_config.use_in_memory_storage = True
        self.test_config.mock_external_services = False  # Test real integrations
    
    async def configure_container(self, container: ServiceContainer):
        """Configure container for infrastructure testing."""
        registrar = container.register()
        
        # Register test infrastructure services
        await self.register_test_infrastructure(registrar)
        
        # Register mocked external dependencies
        await self.register_mock_externals(registrar)
        
        registrar.build()
    
    async def register_test_infrastructure(self, registrar: ServiceRegistrar):
        """Register infrastructure services for testing."""
        pass
    
    async def register_mock_externals(self, registrar: ServiceRegistrar):
        """Register mocked external services."""
        pass
    
    @asynccontextmanager
    async def database_context(self):
        """Context manager for database testing."""
        # Setup test database
        db_manager = self.get_service(type("DatabaseManager"))
        async with db_manager.transaction() as transaction:
            try:
                yield transaction
            finally:
                # Rollback transaction for test isolation
                await transaction.rollback()
    
    @asynccontextmanager
    async def file_system_context(self):
        """Context manager for file system testing."""
        test_dir = self.resource_manager.create_temp_dir()
        try:
            yield test_dir
        finally:
            # Cleanup handled by resource manager
            pass
    
    def create_mock_external_service(self, service_type: Type[T]) -> T:
        """Create mock for external service."""
        if hasattr(service_type, '__annotations__'):
            # Create async mock for async methods
            mock = AsyncMock(spec=service_type)
        else:
            mock = MagicMock(spec=service_type)
        
        # Configure common mock behaviors
        self.configure_mock_service(mock, service_type)
        return mock
    
    def configure_mock_service(self, mock: Union[AsyncMock, MagicMock], service_type: Type):
        """Configure mock service behavior."""
        pass
    
    async def assert_database_state(self, checker: callable):
        """Assert database state after operations."""
        async with self.database_context() as db:
            result = await checker(db)
            assert result, "Database state assertion failed"
    
    def assert_file_system_state(self, path: Path, checker: callable):
        """Assert file system state."""
        result = checker(path)
        assert result, f"File system state assertion failed for {path}"


class IntegrationTestBase(BaseTestClass):
    """
    Base class for integration tests.
    
    Focuses on:
    - Cross-layer integration
    - Workflow testing
    - End-to-end scenarios
    - System behavior validation
    """
    
    async def setup_test_configuration(self):
        """Configure for integration testing."""
        self.test_config.mock_external_services = True  # Mock externals, test internals
        self.test_config.use_in_memory_storage = False  # Use real storage
        self.test_config.test_timeout = 60.0  # Longer timeout for integration
    
    async def configure_container(self, container: ServiceContainer):
        """Configure container for integration testing."""
        registrar = container.register()
        
        # Register real services across all layers
        await self.register_all_services(registrar)
        
        # Override external services with mocks
        await self.register_mock_externals(registrar)
        
        registrar.build()
    
    async def register_all_services(self, registrar: ServiceRegistrar):
        """Register services from all layers."""
        await self.register_domain_services(registrar)
        await self.register_application_services(registrar)
        await self.register_infrastructure_services(registrar)
    
    async def register_domain_services(self, registrar: ServiceRegistrar):
        """Register domain services."""
        pass
    
    async def register_application_services(self, registrar: ServiceRegistrar):
        """Register application services."""
        pass
    
    async def register_infrastructure_services(self, registrar: ServiceRegistrar):
        """Register infrastructure services."""
        pass
    
    async def register_mock_externals(self, registrar: ServiceRegistrar):
        """Register mocked external services."""
        pass
    
    @asynccontextmanager
    async def integration_workflow_context(self):
        """Context manager for integration workflow testing."""
        # Setup complete environment
        workflow_manager = self.get_service(type("WorkflowManager"))
        async with workflow_manager.create_session() as session:
            try:
                yield session
            finally:
                # Cleanup session
                await session.cleanup()
    
    async def execute_workflow(self, workflow_definition: Dict[str, Any]) -> Any:
        """Execute complete workflow for testing."""
        async with self.integration_workflow_context() as session:
            result = await session.execute_workflow(workflow_definition)
            self.assert_workflow_result(result)
            return result
    
    def assert_workflow_result(self, result: Any):
        """Assert workflow execution result."""
        assert hasattr(result, 'success'), "Workflow result must have success attribute"
        if not result.success:
            error_msg = getattr(result, 'error', 'Unknown workflow error')
            pytest.fail(f"Workflow failed: {error_msg}")
    
    async def verify_cross_layer_integration(self, integration_checker: callable):
        """Verify integration across architectural layers."""
        result = await integration_checker(self.container)
        assert result, "Cross-layer integration verification failed"


class AsyncTestMixin:
    """
    Mixin for async testing capabilities.
    Provides utilities for async operation testing, timeout handling, and concurrency.
    """
    
    async def assert_async_result(self, coro, expected_result=None, timeout=30.0):
        """Assert async operation result with timeout."""
        try:
            result = await asyncio.wait_for(coro, timeout=timeout)
            if expected_result is not None:
                assert result == expected_result
            return result
        except asyncio.TimeoutError:
            pytest.fail(f"Async operation timed out after {timeout}s")
    
    async def assert_async_exception(self, coro, expected_exception: Type[Exception], timeout=30.0):
        """Assert async operation raises expected exception."""
        with pytest.raises(expected_exception):
            await asyncio.wait_for(coro, timeout=timeout)
    
    async def run_concurrent_operations(self, operations: List[callable], timeout=30.0):
        """Run multiple async operations concurrently."""
        tasks = [asyncio.create_task(op()) for op in operations]
        try:
            results = await asyncio.wait_for(asyncio.gather(*tasks), timeout=timeout)
            return results
        except asyncio.TimeoutError:
            # Cancel remaining tasks
            for task in tasks:
                if not task.done():
                    task.cancel()
            pytest.fail(f"Concurrent operations timed out after {timeout}s")
    
    async def wait_for_condition(self, condition_checker: callable, timeout=30.0, interval=0.1):
        """Wait for condition to become true."""
        start_time = asyncio.get_event_loop().time()
        while asyncio.get_event_loop().time() - start_time < timeout:
            if await condition_checker():
                return True
            await asyncio.sleep(interval)
        pytest.fail(f"Condition not met within {timeout}s")


class MockingMixin:
    """
    Mixin for advanced mocking capabilities.
    Provides utilities for creating and managing mocks across architectural layers.
    """
    
    def create_domain_entity_mock(self, entity_type: Type[T]) -> T:
        """Create mock for domain entity."""
        mock = MagicMock(spec=entity_type)
        # Configure domain-specific behaviors
        self.configure_entity_mock(mock, entity_type)
        return mock
    
    def create_repository_mock(self, repository_type: Type[T]) -> T:
        """Create async mock for repository."""
        mock = AsyncMock(spec=repository_type)
        # Configure repository-specific behaviors
        self.configure_repository_mock(mock, repository_type)
        return mock
    
    def create_use_case_mock(self, use_case_type: Type[T]) -> T:
        """Create async mock for use case."""
        mock = AsyncMock(spec=use_case_type)
        # Configure use case-specific behaviors
        self.configure_use_case_mock(mock, use_case_type)
        return mock
    
    def configure_entity_mock(self, mock: MagicMock, entity_type: Type):
        """Configure entity mock behavior."""
        # Default entity behaviors
        mock.id = self.create_test_id()
        mock.created_at = datetime.now()
        mock.updated_at = datetime.now()
    
    def configure_repository_mock(self, mock: AsyncMock, repository_type: Type):
        """Configure repository mock behavior."""
        # Default repository behaviors
        mock.get_by_id.return_value = None
        mock.save.return_value = True
        mock.delete.return_value = True
    
    def configure_use_case_mock(self, mock: AsyncMock, use_case_type: Type):
        """Configure use case mock behavior."""
        # Default use case behaviors
        mock.execute.return_value = type('Result', (), {'success': True, 'data': {}})()


# Combined base classes for common scenarios
class DomainTestWithAsync(DomainTestBase, AsyncTestMixin):
    """Domain tests with async capabilities."""
    pass


class ApplicationTestWithMocking(ApplicationTestBase, MockingMixin):
    """Application tests with mocking capabilities."""
    pass


class InfrastructureTestWithAsync(InfrastructureTestBase, AsyncTestMixin):
    """Infrastructure tests with async capabilities."""
    pass


class IntegrationTestFull(IntegrationTestBase, AsyncTestMixin, MockingMixin):
    """Full-featured integration tests."""
    pass