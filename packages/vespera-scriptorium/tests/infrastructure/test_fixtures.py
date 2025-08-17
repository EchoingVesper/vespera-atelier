"""
Test Fixtures - Clean Architecture Foundation

Provides reusable pytest fixtures for all architectural layers,
supporting dependency injection, database setup, and mock configurations.
"""

import asyncio
import pytest
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional
from unittest.mock import AsyncMock, MagicMock

from vespera_scriptorium.infrastructure.di.container import ServiceContainer
from vespera_scriptorium.infrastructure.di.registration import ServiceRegistrar
from vespera_scriptorium.infrastructure.di.lifetime_managers import LifetimeScope

from .base_test_classes import TestConfiguration, TestResourceManager
from .domain_test_helpers import DomainTestDataFactory, TaskTestBuilder
from .application_test_helpers import DTOTestBuilder, MockRepositoryFactory, MockServiceFactory
from .infrastructure_test_helpers import DatabaseTestHelper, MCPProtocolTestHelper, FileSystemTestHelper
from .integration_test_helpers import WorkflowTestHelper, EndToEndTestHelper


# ==============================================
# Core Infrastructure Fixtures
# ==============================================

@pytest.fixture
def test_config():
    """Provide test configuration."""
    config = TestConfiguration()
    config.test_db_url = ":memory:"
    config.enable_logging = False
    config.mock_external_services = True
    config.use_in_memory_storage = True
    return config


@pytest.fixture
async def resource_manager():
    """Provide test resource manager with automatic cleanup."""
    manager = TestResourceManager()
    yield manager
    await manager.cleanup_all()


@pytest.fixture
async def test_container(test_config):
    """Provide clean service container for testing."""
    container = ServiceContainer()
    
    # Configure container for testing
    registrar = container.register()
    
    # Register test configuration
    registrar.singleton(TestConfiguration, lambda: test_config)
    
    # Build container
    registrar.build()
    
    yield container
    
    # Cleanup
    container.dispose()


# ==============================================
# Domain Layer Fixtures
# ==============================================

@pytest.fixture
def task_builder():
    """Provide task builder for domain testing."""
    return TaskTestBuilder()


@pytest.fixture
def domain_test_data():
    """Provide domain test data factory."""
    return DomainTestDataFactory()


@pytest.fixture
async def domain_container(test_container):
    """Provide container configured for domain testing."""
    # Domain layer should have minimal dependencies
    # Add any domain services registration here
    yield test_container


@pytest.fixture
def sample_task(task_builder):
    """Provide sample task for testing."""
    return task_builder.with_title("Sample Test Task").with_description("Sample task for testing").build()


@pytest.fixture
def task_hierarchy(domain_test_data):
    """Provide task hierarchy for testing."""
    return domain_test_data.create_task_hierarchy([
        "Parent Task",
        "Child Task 1", 
        "Child Task 2",
        "Grandchild Task"
    ])


@pytest.fixture
def dependent_tasks(domain_test_data):
    """Provide tasks with dependencies for testing."""
    return domain_test_data.create_dependent_tasks(3, dependency_chain=True)


# ==============================================
# Application Layer Fixtures
# ==============================================

@pytest.fixture
def dto_builder():
    """Provide DTO builder for application testing."""
    return DTOTestBuilder()


@pytest.fixture
def mock_repository_factory():
    """Provide mock repository factory."""
    return MockRepositoryFactory()


@pytest.fixture
def mock_service_factory():
    """Provide mock service factory."""
    return MockServiceFactory()


@pytest.fixture
async def application_container(test_container, mock_repository_factory, mock_service_factory):
    """Provide container configured for application testing."""
    registrar = test_container.register()
    
    # Register mock repositories
    task_repo_mock = mock_repository_factory.create_task_repository_mock()
    registrar.singleton(type("TaskRepository"), lambda: task_repo_mock)
    
    specialist_repo_mock = mock_repository_factory.create_specialist_repository_mock()
    registrar.singleton(type("SpecialistRepository"), lambda: specialist_repo_mock)
    
    state_repo_mock = mock_repository_factory.create_state_repository_mock()
    registrar.singleton(type("StateRepository"), lambda: state_repo_mock)
    
    # Register mock external services
    api_client_mock = mock_service_factory.create_external_api_client_mock()
    registrar.singleton(type("ExternalApiClient"), lambda: api_client_mock)
    
    notification_mock = mock_service_factory.create_notification_service_mock()
    registrar.singleton(type("NotificationService"), lambda: notification_mock)
    
    artifact_storage_mock = mock_service_factory.create_artifact_storage_mock()
    registrar.singleton(type("ArtifactStorage"), lambda: artifact_storage_mock)
    
    # Build updated container
    registrar.build()
    
    yield test_container


@pytest.fixture
def sample_create_task_dto(dto_builder):
    """Provide sample CreateTaskRequest DTO."""
    return dto_builder.create_create_task_request(
        title="Sample Task",
        description="Sample task for testing"
    )


@pytest.fixture
def sample_complete_task_dto(dto_builder):
    """Provide sample CompleteTaskRequest DTO."""
    return dto_builder.create_complete_task_request(
        task_id="sample_task_123",
        summary="Task completed successfully"
    )


# ==============================================
# Infrastructure Layer Fixtures
# ==============================================

@pytest.fixture
async def database_helper(resource_manager):
    """Provide database test helper."""
    helper = DatabaseTestHelper()
    resource_manager.add_cleanup_callback(helper.cleanup)
    yield helper
    # Cleanup handled by resource manager


@pytest.fixture
def mcp_protocol_helper():
    """Provide MCP protocol test helper."""
    return MCPProtocolTestHelper()


@pytest.fixture
async def file_system_helper(resource_manager):
    """Provide file system test helper."""
    helper = FileSystemTestHelper()
    resource_manager.add_cleanup_callback(helper.cleanup)
    yield helper
    # Cleanup handled by resource manager


@pytest.fixture
async def test_database(database_helper):
    """Provide test database with schema."""
    schema_sql = """
        CREATE TABLE tasks (
            task_id TEXT PRIMARY KEY,
            parent_task_id TEXT,
            title TEXT NOT NULL,
            description TEXT,
            task_type TEXT DEFAULT 'standard',
            hierarchy_path TEXT,
            hierarchy_level INTEGER DEFAULT 0,
            position_in_parent INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending',
            lifecycle_stage TEXT DEFAULT 'created',
            complexity TEXT DEFAULT 'moderate',
            specialist_type TEXT,
            assigned_to TEXT,
            context TEXT,
            configuration TEXT,
            results TEXT,
            summary TEXT,
            quality_gate_level TEXT DEFAULT 'standard',
            verification_status TEXT DEFAULT 'pending',
            auto_maintenance_enabled BOOLEAN DEFAULT 1,
            is_template BOOLEAN DEFAULT 0,
            template_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            started_at TIMESTAMP,
            completed_at TIMESTAMP,
            due_date TIMESTAMP,
            deleted_at TIMESTAMP,
            estimated_effort TEXT,
            actual_effort TEXT
        );
        
        CREATE TABLE task_dependencies (
            dependency_id INTEGER PRIMARY KEY AUTOINCREMENT,
            dependent_task_id TEXT NOT NULL,
            prerequisite_task_id TEXT NOT NULL,
            dependency_type TEXT NOT NULL,
            dependency_status TEXT DEFAULT 'pending',
            is_mandatory BOOLEAN DEFAULT 1,
            auto_satisfy BOOLEAN DEFAULT 0,
            satisfaction_criteria TEXT,
            output_artifact_ref TEXT,
            input_parameter_name TEXT,
            waived_at TIMESTAMP,
            waived_by TEXT,
            waiver_reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            satisfied_at TIMESTAMP
        );
        
        CREATE TABLE task_attributes (
            attribute_id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id TEXT NOT NULL,
            attribute_name TEXT NOT NULL,
            attribute_value TEXT NOT NULL,
            attribute_type TEXT NOT NULL,
            attribute_category TEXT,
            is_indexed BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE task_artifacts (
            artifact_id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            artifact_type TEXT NOT NULL,
            artifact_name TEXT NOT NULL,
            content TEXT,
            content_hash TEXT,
            file_reference TEXT,
            file_size INTEGER,
            mime_type TEXT,
            encoding TEXT DEFAULT 'utf-8',
            is_primary BOOLEAN DEFAULT 0,
            visibility TEXT DEFAULT 'private',
            version INTEGER DEFAULT 1,
            previous_version_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE task_events (
            event_id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            event_category TEXT NOT NULL,
            event_data TEXT,
            previous_value TEXT,
            new_value TEXT,
            triggered_by TEXT NOT NULL,
            actor_id TEXT,
            session_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """
    
    db_path = database_helper.create_test_database(schema_sql)
    yield db_path


@pytest.fixture
async def populated_test_database(test_database, database_helper):
    """Provide test database with sample data."""
    test_data = {
        "tasks": [
            {
                "task_id": "task_001",
                "title": "Test Task 1",
                "description": "First test task",
                "status": "pending",
                "hierarchy_path": "/task_001",
                "hierarchy_level": 0
            },
            {
                "task_id": "task_002",
                "title": "Test Task 2", 
                "description": "Second test task",
                "status": "completed",
                "parent_task_id": "task_001",
                "hierarchy_path": "/task_001/task_002",
                "hierarchy_level": 1
            }
        ],
        "task_dependencies": [
            {
                "dependent_task_id": "task_002",
                "prerequisite_task_id": "task_001",
                "dependency_type": "completion",
                "dependency_status": "satisfied"
            }
        ]
    }
    
    database_helper.populate_test_data(test_database, test_data)
    yield test_database


@pytest.fixture
async def infrastructure_container(test_container, test_database):
    """Provide container configured for infrastructure testing."""
    registrar = test_container.register()
    
    # Register real infrastructure services with test database
    registrar.singleton(str, lambda: test_database, name="database_url")
    
    # Add other infrastructure service registrations here
    
    registrar.build()
    yield test_container


@pytest.fixture
def test_file_structure(file_system_helper):
    """Provide test file structure."""
    structure = {
        "src": {
            "main.py": "print('Hello, World!')",
            "utils": {
                "__init__.py": "",
                "helpers.py": "def helper(): pass"
            }
        },
        "tests": {
            "test_main.py": "def test_main(): assert True"
        },
        "README.md": "# Test Project"
    }
    
    root_path = file_system_helper.create_test_file_structure(structure)
    yield root_path


@pytest.fixture
def mcp_tools_definition(mcp_protocol_helper):
    """Provide MCP tools definition for testing."""
    return [
        mcp_protocol_helper.create_test_tool_definition("create_task"),
        mcp_protocol_helper.create_test_tool_definition("get_task"),
        mcp_protocol_helper.create_test_tool_definition("update_task"),
        mcp_protocol_helper.create_test_tool_definition("delete_task")
    ]


# ==============================================
# Integration Layer Fixtures
# ==============================================

@pytest.fixture
async def integration_container(test_container, test_database):
    """Provide container configured for integration testing."""
    registrar = test_container.register()
    
    # Register services from all layers for integration testing
    # Domain services
    # Application services  
    # Infrastructure services with test database
    registrar.singleton(str, lambda: test_database, name="database_url")
    
    # Mock external services
    external_api_mock = AsyncMock()
    registrar.singleton(type("ExternalApiClient"), lambda: external_api_mock)
    
    registrar.build()
    yield test_container


@pytest.fixture
async def workflow_helper(integration_container):
    """Provide workflow test helper."""
    return WorkflowTestHelper(integration_container)


@pytest.fixture
async def e2e_helper(integration_container):
    """Provide end-to-end test helper."""
    return EndToEndTestHelper(integration_container)


@pytest.fixture
def simple_workflow_definition():
    """Provide simple workflow definition for testing."""
    return {
        "id": "test_workflow",
        "description": "Simple test workflow",
        "steps": [
            {
                "type": "use_case",
                "use_case": "create_task",
                "input": {
                    "title": "Workflow Test Task",
                    "description": "Task created by workflow test"
                }
            },
            {
                "type": "validation",
                "validator": "task_state",
                "data": {
                    "task_id": "${previous_result.task_id}",
                    "expected_status": "pending"
                }
            }
        ]
    }


@pytest.fixture
def complex_workflow_definition():
    """Provide complex workflow definition for testing."""
    return {
        "id": "complex_test_workflow",
        "description": "Complex test workflow with parallel steps",
        "steps": [
            {
                "type": "parallel",
                "steps": [
                    {
                        "type": "use_case",
                        "use_case": "create_task",
                        "input": {"title": "Parallel Task 1"}
                    },
                    {
                        "type": "use_case",
                        "use_case": "create_task", 
                        "input": {"title": "Parallel Task 2"}
                    }
                ]
            },
            {
                "type": "wait",
                "duration": 0.1
            },
            {
                "type": "validation",
                "validator": "system_state",
                "data": {"expected_task_count": 2}
            }
        ]
    }


# ==============================================
# Async Testing Fixtures
# ==============================================

@pytest.fixture
def event_loop():
    """Provide event loop for async testing."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def async_test_session():
    """Provide async test session."""
    session_data = {
        "session_id": "test_session_123",
        "start_time": "2024-01-01T00:00:00Z",
        "test_metadata": {}
    }
    yield session_data


# ==============================================
# Performance Testing Fixtures
# ==============================================

@pytest.fixture
def performance_config():
    """Provide performance test configuration."""
    return {
        "max_execution_time": 5.0,  # seconds
        "max_memory_usage": 100,   # MB
        "concurrent_operations": 10,
        "load_test_duration": 30,  # seconds
        "performance_threshold": 0.95  # 95% success rate
    }


# ==============================================
# Mock Configuration Fixtures
# ==============================================

@pytest.fixture
def external_service_mocks():
    """Provide configured external service mocks."""
    return {
        "github_client": AsyncMock(),
        "email_service": AsyncMock(),
        "file_storage": AsyncMock(),
        "analytics_service": AsyncMock()
    }


@pytest.fixture
async def configured_mocks(external_service_mocks):
    """Provide configured mocks with standard behaviors."""
    # Configure GitHub client mock
    github_mock = external_service_mocks["github_client"]
    github_mock.create_repository.return_value = {"id": "repo_123", "url": "https://github.com/test/repo"}
    github_mock.get_repository.return_value = {"id": "repo_123", "name": "test-repo"}
    
    # Configure email service mock
    email_mock = external_service_mocks["email_service"]
    email_mock.send_email.return_value = {"status": "sent", "message_id": "msg_123"}
    
    # Configure file storage mock
    storage_mock = external_service_mocks["file_storage"]
    storage_mock.upload_file.return_value = {"file_id": "file_123", "url": "https://storage.test/file_123"}
    storage_mock.download_file.return_value = b"test file content"
    
    # Configure analytics mock
    analytics_mock = external_service_mocks["analytics_service"]
    analytics_mock.track_event.return_value = True
    analytics_mock.get_metrics.return_value = {"events": 100, "users": 10}
    
    yield external_service_mocks


# ==============================================
# Error Testing Fixtures
# ==============================================

@pytest.fixture
def error_scenarios():
    """Provide error scenarios for testing."""
    return {
        "database_error": Exception("Database connection failed"),
        "validation_error": ValueError("Invalid input data"),
        "external_service_error": ConnectionError("External service unavailable"),
        "timeout_error": TimeoutError("Operation timed out"),
        "permission_error": PermissionError("Access denied")
    }


@pytest.fixture
def failing_mocks():
    """Provide mocks configured to fail for error testing."""
    failing_repository = AsyncMock()
    failing_repository.save.side_effect = Exception("Database save failed")
    failing_repository.get_by_id.side_effect = Exception("Database read failed")
    
    failing_external_service = AsyncMock()
    failing_external_service.call_api.side_effect = ConnectionError("Service unavailable")
    
    return {
        "repository": failing_repository,
        "external_service": failing_external_service
    }


# ==============================================
# Cleanup Fixtures
# ==============================================

@pytest.fixture(autouse=True)
async def cleanup_test_environment():
    """Automatic cleanup for all tests."""
    # Setup phase
    yield
    
    # Cleanup phase
    # This fixture runs after each test automatically
    # Add any global cleanup logic here
    pass