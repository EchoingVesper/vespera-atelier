"""
Common test fixtures for Vespera V2 testing.

Provides reusable pytest fixtures for database configurations,
authentication setups, and other common testing infrastructure.
"""

import pytest
import tempfile
import asyncio
from pathlib import Path
from typing import Dict, Any, List
from unittest.mock import Mock, AsyncMock, patch
from fastapi.testclient import TestClient

from databases.triple_db_service import DatabaseConfig
from databases.service_config import get_development_config
from .mock_services import (
    MockTripleDBService, MockBackgroundServiceManager, MockMCPBridge,
    MockChromaService, MockKuzuService, MockAuthenticationMiddleware
)
from .test_data import create_test_task, create_task_batch


@pytest.fixture
async def temp_directory():
    """Create a temporary directory for testing."""
    with tempfile.TemporaryDirectory() as temp_dir:
        yield Path(temp_dir)


@pytest.fixture
async def test_database_config(temp_directory):
    """Create a test database configuration."""
    return DatabaseConfig(
        data_dir=temp_directory,
        sqlite_enabled=True,
        chroma_enabled=False,  # Disabled for unit tests
        kuzu_enabled=False,    # Disabled for unit tests
        auto_sync_enabled=True,
        chroma_persist_dir=temp_directory / "test_embeddings",
        kuzu_database_path=temp_directory / "test_graph"
    )


@pytest.fixture
async def test_background_config(temp_directory):
    """Create a test background service configuration."""
    config = get_development_config()
    config.data_dir = temp_directory
    config.worker_count = 1  # Minimal for testing
    config.queue_size = 10
    config.operation_timeout = 5.0
    return config


@pytest.fixture
async def mock_triple_db_service(test_database_config):
    """Create a mock triple database service."""
    service = MockTripleDBService(test_database_config)
    await service.initialize()
    yield service
    await service.cleanup()


@pytest.fixture
async def mock_background_manager(test_background_config):
    """Create a mock background service manager."""
    manager = MockBackgroundServiceManager(test_background_config)
    await manager.initialize()
    await manager.start()
    yield manager
    await manager.stop()


@pytest.fixture
async def mock_mcp_bridge():
    """Create a mock MCP bridge."""
    bridge = MockMCPBridge()
    await bridge.initialize()
    yield bridge
    await bridge.cleanup()


@pytest.fixture
async def mock_chroma_service(test_database_config):
    """Create a mock Chroma service."""
    service = MockChromaService(test_database_config)
    await service.initialize()
    yield service
    await service.cleanup()


@pytest.fixture
async def mock_kuzu_service(test_database_config):
    """Create a mock Kuzu service."""
    service = MockKuzuService(test_database_config)
    await service.initialize()
    yield service
    await service.cleanup()


@pytest.fixture
def mock_auth_middleware():
    """Create a mock authentication middleware."""
    return MockAuthenticationMiddleware()


@pytest.fixture
def authenticated_api_client(mock_auth_middleware):
    """Create an authenticated API test client."""
    from api.server import create_app
    
    # Mock authentication
    with patch('api.middleware.auth.verify_plugin_token') as mock_verify:
        mock_verify.return_value = {
            "plugin_id": "test_plugin",
            "permissions": ["read", "write"],
            "user_id": "test_user"
        }
        
        app = create_app()
        client = TestClient(app)
        
        # Add default auth header
        client.headers = {"Authorization": "Bearer test_token"}
        
        yield client


@pytest.fixture
def readonly_api_client():
    """Create a read-only API test client."""
    from api.server import create_app
    
    with patch('api.middleware.auth.verify_plugin_token') as mock_verify:
        mock_verify.return_value = {
            "plugin_id": "readonly_plugin", 
            "permissions": ["read"],
            "user_id": "readonly_user"
        }
        
        app = create_app()
        client = TestClient(app)
        client.headers = {"Authorization": "Bearer readonly_token"}
        
        yield client


@pytest.fixture
def admin_api_client():
    """Create an admin API test client."""
    from api.server import create_app
    
    with patch('api.middleware.auth.verify_plugin_token') as mock_verify:
        mock_verify.return_value = {
            "plugin_id": "admin_plugin",
            "permissions": ["read", "write", "admin"],
            "user_id": "admin_user"
        }
        
        app = create_app()
        client = TestClient(app)
        client.headers = {"Authorization": "Bearer admin_token"}
        
        yield client


@pytest.fixture
async def sample_tasks():
    """Create a sample set of tasks for testing."""
    return [
        create_test_task(
            title="Implement authentication",
            description="Add JWT-based authentication system",
            project_id="web_project"
        ),
        create_test_task(
            title="Design user interface",
            description="Create responsive UI components",
            project_id="web_project"
        ),
        create_test_task(
            title="Setup database",
            description="Initialize database schema",
            project_id="web_project"
        ),
        create_test_task(
            title="Write documentation",
            description="Document API endpoints",
            project_id="web_project"
        ),
        create_test_task(
            title="Deploy application",
            description="Deploy to production environment",
            project_id="web_project"
        )
    ]


@pytest.fixture
async def large_task_batch():
    """Create a large batch of tasks for performance testing."""
    return create_task_batch(100, "performance_project")


@pytest.fixture
async def multi_project_tasks():
    """Create tasks across multiple projects."""
    projects = ["web_project", "mobile_project", "devops_project"]
    all_tasks = []
    
    for project in projects:
        tasks = create_task_batch(10, project)
        all_tasks.extend(tasks)
    
    return all_tasks


@pytest.fixture
async def populated_triple_db_service(mock_triple_db_service, sample_tasks):
    """Create a triple DB service populated with sample tasks."""
    service = mock_triple_db_service
    
    for task in sample_tasks:
        await service.create_task(task)
    
    return service


@pytest.fixture
async def populated_background_manager(mock_background_manager, sample_tasks):
    """Create a background manager with pre-scheduled operations."""
    manager = mock_background_manager
    
    # Schedule various operations for sample tasks
    from databases.service_config import ServiceType, ServicePriority
    
    for i, task in enumerate(sample_tasks):
        # Schedule embedding for each task
        await manager.schedule_operation(
            ServiceType.AUTO_EMBEDDING,
            "embed_task",
            task.id,
            {"task_data": {"id": task.id, "title": task.title}},
            ServicePriority.NORMAL
        )
        
        # Schedule sync for every other task
        if i % 2 == 0:
            await manager.schedule_operation(
                ServiceType.INCREMENTAL_SYNC,
                "sync_task",
                task.id,
                {"operation": "create", "task_data": {"id": task.id}},
                ServicePriority.NORMAL
            )
    
    return manager


@pytest.fixture
def mock_mcp_responses():
    """Create a collection of mock MCP responses for testing."""
    return {
        "create_task": {
            "success": True,
            "task": {
                "id": "mock_task_123",
                "title": "Mock Created Task",
                "status": "pending",
                "priority": "normal"
            }
        },
        
        "get_task": {
            "success": True,
            "task": {
                "id": "mock_task_123", 
                "title": "Mock Retrieved Task",
                "status": "in_progress",
                "priority": "high"
            }
        },
        
        "semantic_clustering": {
            "success": True,
            "clusters": [
                {
                    "cluster_id": "auth_cluster",
                    "theme": "Authentication & Security",
                    "tasks": ["task_1", "task_2"],
                    "similarity_score": 0.85
                }
            ],
            "clustering_summary": {
                "clusters_found": 1,
                "total_tasks_analyzed": 5
            }
        },
        
        "impact_analysis": {
            "success": True,
            "task": {"id": "test_task", "title": "Test Task"},
            "summary": {
                "total_affected_tasks": 3,
                "impact_severity": "medium"
            },
            "impact_analysis": {
                "direct_impact": 2,
                "cascade_impact": 1
            }
        },
        
        "health_analysis": {
            "success": True,
            "overall_health": {
                "score": 75,
                "letter_grade": "B",
                "status": "good"
            },
            "detailed_analysis": {
                "task_management": {
                    "total_tasks": 10,
                    "completion_rate": 60.0
                }
            }
        }
    }


@pytest.fixture
async def integrated_test_system(
    temp_directory,
    mock_triple_db_service,
    mock_background_manager,
    mock_mcp_bridge
):
    """Create a fully integrated test system."""
    return {
        "temp_dir": temp_directory,
        "triple_db": mock_triple_db_service,
        "background_manager": mock_background_manager,
        "mcp_bridge": mock_mcp_bridge
    }


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for the test session."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
    
    yield loop
    loop.close()


@pytest.fixture
async def websocket_test_client():
    """Create a WebSocket test client."""
    from api.server import create_app
    
    with patch('api.websocket.verify_websocket_auth') as mock_auth:
        mock_auth.return_value = {"plugin_id": "test_plugin", "user_id": "test_user"}
        
        app = create_app()
        client = TestClient(app)
        
        yield client


@pytest.fixture
def performance_test_config():
    """Configuration for performance testing."""
    return {
        "small_load": {
            "task_count": 10,
            "concurrent_requests": 5,
            "max_execution_time": 2.0
        },
        "medium_load": {
            "task_count": 50,
            "concurrent_requests": 10,
            "max_execution_time": 5.0
        },
        "large_load": {
            "task_count": 200,
            "concurrent_requests": 20,
            "max_execution_time": 15.0
        }
    }


@pytest.fixture
async def error_injection_service(mock_triple_db_service):
    """Create a service that can inject errors for testing."""
    service = mock_triple_db_service
    
    # Add error injection capabilities
    service._error_modes = {
        "database_error": False,
        "timeout_error": False,
        "validation_error": False
    }
    
    def enable_error(error_type: str):
        service._error_modes[error_type] = True
    
    def disable_error(error_type: str):
        service._error_modes[error_type] = False
    
    service.enable_error = enable_error
    service.disable_error = disable_error
    
    return service


# Pytest configuration
@pytest.fixture(autouse=True)
async def cleanup_async_tasks():
    """Automatically cleanup async tasks after each test."""
    yield
    
    # Cancel any remaining tasks
    tasks = [task for task in asyncio.all_tasks() if not task.done()]
    for task in tasks:
        task.cancel()
    
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


@pytest.fixture(autouse=True)
def reset_global_state():
    """Reset global state before each test."""
    # Reset any global caches or state
    yield
    # Cleanup after test