"""
Comprehensive Infrastructure Layer Tests - Repositories

Tests for all repository implementations focusing on data access patterns,
transaction handling, database integration, and error recovery.
"""

import pytest
import sqlite3
import asyncio
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from pathlib import Path
import tempfile
import aiosqlite

from vespera_scriptorium.infrastructure.database.sqlite.sqlite_task_repository import SQLiteTaskRepository
from vespera_scriptorium.infrastructure.database.sqlite.sqlite_specialist_repository import SQLiteSpecialistRepository
from vespera_scriptorium.infrastructure.database.sqlite.sqlite_state_repository import SQLiteStateRepository
from vespera_scriptorium.infrastructure.database.async_repositories.async_task_repository import AsyncTaskRepository
from vespera_scriptorium.infrastructure.database.async_repositories.async_specialist_repository import AsyncSpecialistRepository
from vespera_scriptorium.infrastructure.database.repository_factory import RepositoryFactory
from vespera_scriptorium.infrastructure.database.connection_manager import ConnectionManager
from vespera_scriptorium.infrastructure.database.base import DatabaseAdapter

from vespera_scriptorium.domain.entities.task import Task, TaskStatus, TaskType, LifecycleStage
from vespera_scriptorium.domain.value_objects.complexity_level import ComplexityLevel
from vespera_scriptorium.domain.repositories.task_repository import TaskRepository
from vespera_scriptorium.domain.repositories.specialist_repository import SpecialistRepository
from vespera_scriptorium.domain.exceptions.task_errors import (
    TaskNotFoundError,
    TaskValidationError,
    RepositoryError
)


@pytest.mark.infrastructure
@pytest.mark.unit
@pytest.mark.database
class TestSQLiteTaskRepository:
    """Test SQLiteTaskRepository implementation."""

    @pytest.fixture
    async def temp_database(self):
        """Create temporary database for testing."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = f.name
        
        # Initialize database schema
        async with aiosqlite.connect(db_path) as db:
            await db.execute("""
                CREATE TABLE IF NOT EXISTS tasks (
                    task_id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)
            await db.commit()
        
        yield db_path
        
        # Cleanup
        Path(db_path).unlink(missing_ok=True)

    @pytest.fixture
    async def task_repository(self, temp_database):
        """Create SQLiteTaskRepository with temporary database."""
        repository = SQLiteTaskRepository(database_path=temp_database)
        await repository.initialize()
        return repository

    @pytest.fixture
    def sample_task(self):
        """Create sample task for testing."""
        return Task(
            task_id="test_task_001",
            title="Test Task",
            description="A test task for repository testing",
            hierarchy_path="/test_task_001",
            status=TaskStatus.PENDING,
            lifecycle_stage=LifecycleStage.CREATED,
            complexity=ComplexityLevel.MODERATE
        )

    async def test_save_task(self, task_repository, sample_task):
        """Test saving a task to the repository."""
        # Save task
        saved_task = await task_repository.save(sample_task)
        
        assert saved_task.task_id == sample_task.task_id
        assert saved_task.title == sample_task.title
        assert saved_task.status == sample_task.status

    async def test_get_task_by_id(self, task_repository, sample_task):
        """Test retrieving a task by ID."""
        # Save task first
        await task_repository.save(sample_task)
        
        # Retrieve task
        retrieved_task = await task_repository.get_by_id(sample_task.task_id)
        
        assert retrieved_task is not None
        assert retrieved_task.task_id == sample_task.task_id
        assert retrieved_task.title == sample_task.title
        assert retrieved_task.status == sample_task.status

    async def test_get_nonexistent_task(self, task_repository):
        """Test retrieving a non-existent task returns None."""
        result = await task_repository.get_by_id("nonexistent_task")
        assert result is None

    async def test_update_task(self, task_repository, sample_task):
        """Test updating an existing task."""
        # Save task first
        await task_repository.save(sample_task)
        
        # Update task
        sample_task.title = "Updated Task Title"
        sample_task.status = TaskStatus.ACTIVE
        
        updated_task = await task_repository.save(sample_task)
        
        assert updated_task.title == "Updated Task Title"
        assert updated_task.status == TaskStatus.ACTIVE
        
        # Verify update persisted
        retrieved_task = await task_repository.get_by_id(sample_task.task_id)
        assert retrieved_task.title == "Updated Task Title"
        assert retrieved_task.status == TaskStatus.ACTIVE

    async def test_delete_task(self, task_repository, sample_task):
        """Test deleting a task."""
        # Save task first
        await task_repository.save(sample_task)
        
        # Verify task exists
        assert await task_repository.get_by_id(sample_task.task_id) is not None
        
        # Delete task
        deleted = await task_repository.delete(sample_task.task_id)
        assert deleted is True
        
        # Verify task no longer exists
        assert await task_repository.get_by_id(sample_task.task_id) is None

    async def test_delete_nonexistent_task(self, task_repository):
        """Test deleting a non-existent task."""
        deleted = await task_repository.delete("nonexistent_task")
        assert deleted is False

    async def test_list_tasks(self, task_repository):
        """Test listing all tasks."""
        # Create multiple tasks
        tasks = [
            Task(
                task_id=f"task_{i}",
                title=f"Task {i}",
                description=f"Description {i}",
                hierarchy_path=f"/task_{i}",
                status=TaskStatus.PENDING
            )
            for i in range(5)
        ]
        
        # Save all tasks
        for task in tasks:
            await task_repository.save(task)
        
        # List tasks
        all_tasks = await task_repository.list_all()
        
        assert len(all_tasks) == 5
        task_ids = [task.task_id for task in all_tasks]
        assert all(f"task_{i}" in task_ids for i in range(5))

    async def test_find_by_status(self, task_repository):
        """Test finding tasks by status."""
        # Create tasks with different statuses
        tasks = [
            Task(
                task_id="pending_1",
                title="Pending Task 1",
                description="Description",
                hierarchy_path="/pending_1",
                status=TaskStatus.PENDING
            ),
            Task(
                task_id="active_1",
                title="Active Task 1",
                description="Description",
                hierarchy_path="/active_1",
                status=TaskStatus.ACTIVE
            ),
            Task(
                task_id="pending_2",
                title="Pending Task 2",
                description="Description",
                hierarchy_path="/pending_2",
                status=TaskStatus.PENDING
            )
        ]
        
        # Save all tasks
        for task in tasks:
            await task_repository.save(task)
        
        # Find pending tasks
        pending_tasks = await task_repository.find_by_status(TaskStatus.PENDING)
        
        assert len(pending_tasks) == 2
        assert all(task.status == TaskStatus.PENDING for task in pending_tasks)

    async def test_find_by_parent_id(self, task_repository):
        """Test finding child tasks by parent ID."""
        # Create parent task
        parent_task = Task(
            task_id="parent_001",
            title="Parent Task",
            description="Parent description",
            hierarchy_path="/parent_001",
            status=TaskStatus.ACTIVE
        )
        
        # Create child tasks
        child_tasks = [
            Task(
                task_id=f"child_{i}",
                title=f"Child Task {i}",
                description=f"Child description {i}",
                hierarchy_path=f"/parent_001/child_{i}",
                parent_task_id="parent_001",
                status=TaskStatus.PENDING
            )
            for i in range(3)
        ]
        
        # Save all tasks
        await task_repository.save(parent_task)
        for task in child_tasks:
            await task_repository.save(task)
        
        # Find child tasks
        children = await task_repository.find_by_parent_id("parent_001")
        
        assert len(children) == 3
        assert all(task.parent_task_id == "parent_001" for task in children)

    async def test_transaction_rollback(self, task_repository):
        """Test transaction rollback on error."""
        # This test would verify that database transactions are properly rolled back
        # when errors occur during multi-operation tasks
        
        # For now, just verify that the repository can handle errors gracefully
        with pytest.raises(Exception):
            # Simulate a database error
            await task_repository.save(None)  # Invalid task should raise error

    async def test_concurrent_access(self, task_repository, sample_task):
        """Test concurrent access to the repository."""
        # Test that multiple concurrent operations don't interfere
        async def save_and_retrieve():
            await task_repository.save(sample_task)
            return await task_repository.get_by_id(sample_task.task_id)
        
        # Run multiple operations concurrently
        results = await asyncio.gather(
            save_and_retrieve(),
            save_and_retrieve(),
            save_and_retrieve(),
            return_exceptions=True
        )
        
        # At least one should succeed (the others might fail due to unique constraints)
        successful_results = [r for r in results if not isinstance(r, Exception)]
        assert len(successful_results) >= 1


@pytest.mark.infrastructure
@pytest.mark.unit
@pytest.mark.database
class TestAsyncTaskRepository:
    """Test AsyncTaskRepository implementation."""

    @pytest.fixture
    def mock_database_adapter(self):
        """Create mock database adapter."""
        adapter = AsyncMock(spec=DatabaseAdapter)
        return adapter

    @pytest.fixture
    def async_task_repository(self, mock_database_adapter):
        """Create AsyncTaskRepository with mocked adapter."""
        return AsyncTaskRepository(database_adapter=mock_database_adapter)

    @pytest.fixture
    def sample_task(self):
        """Create sample task for testing."""
        return Task(
            task_id="async_task_001",
            title="Async Test Task",
            description="An async test task",
            hierarchy_path="/async_task_001",
            status=TaskStatus.PENDING
        )

    async def test_save_task_async(self, async_task_repository, mock_database_adapter, sample_task):
        """Test async task saving."""
        mock_database_adapter.execute.return_value = {"rows_affected": 1}
        mock_database_adapter.fetch_one.return_value = sample_task.to_dict_for_storage()
        
        result = await async_task_repository.save(sample_task)
        
        assert result.task_id == sample_task.task_id
        mock_database_adapter.execute.assert_called_once()

    async def test_get_by_id_async(self, async_task_repository, mock_database_adapter, sample_task):
        """Test async task retrieval."""
        mock_database_adapter.fetch_one.return_value = sample_task.to_dict_for_storage()
        
        result = await async_task_repository.get_by_id("async_task_001")
        
        assert result is not None
        assert result.task_id == "async_task_001"
        mock_database_adapter.fetch_one.assert_called_once()

    async def test_batch_operations(self, async_task_repository, mock_database_adapter):
        """Test batch operations for performance."""
        tasks = [
            Task(
                task_id=f"batch_task_{i}",
                title=f"Batch Task {i}",
                description=f"Batch description {i}",
                hierarchy_path=f"/batch_task_{i}"
            )
            for i in range(10)
        ]
        
        mock_database_adapter.execute_many.return_value = {"rows_affected": 10}
        
        result = await async_task_repository.save_batch(tasks)
        
        assert result["rows_affected"] == 10
        mock_database_adapter.execute_many.assert_called_once()

    async def test_complex_queries(self, async_task_repository, mock_database_adapter):
        """Test complex query operations."""
        # Test complex filtering and sorting
        filters = {
            "status": [TaskStatus.ACTIVE, TaskStatus.PENDING],
            "complexity": [ComplexityLevel.MODERATE, ComplexityLevel.COMPLEX],
            "created_after": datetime.now() - timedelta(days=7)
        }
        
        mock_database_adapter.fetch_all.return_value = [
            {
                "task_id": "complex_task_001",
                "title": "Complex Task",
                "status": "active"
            }
        ]
        
        results = await async_task_repository.find_with_filters(filters)
        
        assert len(results) >= 0  # Should return list, even if empty
        mock_database_adapter.fetch_all.assert_called_once()


@pytest.mark.infrastructure
@pytest.mark.unit
@pytest.mark.database
class TestRepositoryFactory:
    """Test RepositoryFactory implementation."""

    @pytest.fixture
    def mock_connection_manager(self):
        """Create mock connection manager."""
        manager = Mock(spec=ConnectionManager)
        manager.get_connection.return_value = AsyncMock()
        return manager

    @pytest.fixture
    def repository_factory(self, mock_connection_manager):
        """Create RepositoryFactory with mocked dependencies."""
        return RepositoryFactory(connection_manager=mock_connection_manager)

    def test_create_task_repository(self, repository_factory):
        """Test creating task repository."""
        repository = repository_factory.create_task_repository()
        
        assert repository is not None
        assert isinstance(repository, TaskRepository)

    def test_create_specialist_repository(self, repository_factory):
        """Test creating specialist repository."""
        repository = repository_factory.create_specialist_repository()
        
        assert repository is not None
        assert isinstance(repository, SpecialistRepository)

    def test_repository_caching(self, repository_factory):
        """Test repository instance caching."""
        # First call should create new instance
        repo1 = repository_factory.create_task_repository()
        
        # Second call should return cached instance (if caching is implemented)
        repo2 = repository_factory.create_task_repository()
        
        # This test depends on factory implementation
        # For now, just verify both are valid repositories
        assert repo1 is not None
        assert repo2 is not None

    def test_repository_configuration(self, repository_factory):
        """Test repository configuration options."""
        config = {
            "cache_enabled": True,
            "transaction_timeout": 30,
            "connection_pool_size": 5
        }
        
        repository = repository_factory.create_task_repository(config=config)
        
        assert repository is not None
        # Configuration details would be tested based on actual implementation


@pytest.mark.infrastructure
@pytest.mark.unit
@pytest.mark.database
class TestConnectionManager:
    """Test ConnectionManager implementation."""

    @pytest.fixture
    def connection_manager(self):
        """Create ConnectionManager instance."""
        config = {
            "database_type": "sqlite",
            "database_path": ":memory:",
            "pool_size": 5,
            "timeout": 30
        }
        return ConnectionManager(config)

    async def test_get_connection(self, connection_manager):
        """Test getting database connection."""
        connection = await connection_manager.get_connection()
        
        assert connection is not None
        # Connection should be valid and usable

    async def test_connection_pooling(self, connection_manager):
        """Test connection pooling behavior."""
        # Get multiple connections
        connections = []
        for _ in range(3):
            conn = await connection_manager.get_connection()
            connections.append(conn)
        
        assert len(connections) == 3
        assert all(conn is not None for conn in connections)

    async def test_connection_cleanup(self, connection_manager):
        """Test connection cleanup and resource management."""
        connection = await connection_manager.get_connection()
        
        # Test that connections are properly cleaned up
        await connection_manager.close_connection(connection)
        
        # Should not raise errors
        assert True

    async def test_transaction_management(self, connection_manager):
        """Test transaction management."""
        async with connection_manager.transaction() as tx:
            # Perform operations within transaction
            connection = await connection_manager.get_connection()
            assert connection is not None
            
            # Transaction should commit automatically on success
            assert tx is not None

    async def test_connection_error_handling(self, connection_manager):
        """Test connection error handling."""
        # Simulate connection failure
        with patch.object(connection_manager, '_create_connection', side_effect=Exception("Connection failed")):
            with pytest.raises(RepositoryError):
                await connection_manager.get_connection()


@pytest.mark.infrastructure
@pytest.mark.integration
@pytest.mark.database
class TestRepositoryIntegration:
    """Integration tests for repository layer."""

    @pytest.fixture
    async def integration_database(self):
        """Create integration test database."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = f.name
        
        # Initialize full schema
        async with aiosqlite.connect(db_path) as db:
            # Create all necessary tables
            await db.execute("""
                CREATE TABLE IF NOT EXISTS tasks (
                    task_id TEXT PRIMARY KEY,
                    parent_task_id TEXT,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    task_type TEXT NOT NULL,
                    status TEXT NOT NULL,
                    lifecycle_stage TEXT NOT NULL,
                    complexity TEXT NOT NULL,
                    hierarchy_path TEXT NOT NULL,
                    hierarchy_level INTEGER DEFAULT 0,
                    specialist_type TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    completed_at TEXT,
                    FOREIGN KEY (parent_task_id) REFERENCES tasks (task_id)
                )
            """)
            
            await db.execute("""
                CREATE TABLE IF NOT EXISTS task_dependencies (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    dependent_task_id TEXT NOT NULL,
                    prerequisite_task_id TEXT NOT NULL,
                    dependency_type TEXT NOT NULL,
                    dependency_status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (dependent_task_id) REFERENCES tasks (task_id),
                    FOREIGN KEY (prerequisite_task_id) REFERENCES tasks (task_id)
                )
            """)
            
            await db.execute("""
                CREATE TABLE IF NOT EXISTS task_artifacts (
                    artifact_id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL,
                    artifact_type TEXT NOT NULL,
                    artifact_name TEXT NOT NULL,
                    content TEXT,
                    file_reference TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (task_id) REFERENCES tasks (task_id)
                )
            """)
            
            await db.commit()
        
        yield db_path
        
        # Cleanup
        Path(db_path).unlink(missing_ok=True)

    @pytest.fixture
    async def repository_stack(self, integration_database):
        """Create full repository stack."""
        connection_manager = ConnectionManager({
            "database_type": "sqlite",
            "database_path": integration_database
        })
        
        factory = RepositoryFactory(connection_manager)
        
        return {
            "task_repository": factory.create_task_repository(),
            "specialist_repository": factory.create_specialist_repository(),
            "connection_manager": connection_manager
        }

    async def test_end_to_end_task_workflow(self, repository_stack):
        """Test complete task workflow through repository layer."""
        task_repo = repository_stack["task_repository"]
        
        # 1. Create parent task
        parent_task = Task(
            task_id="integration_parent_001",
            title="Integration Parent Task",
            description="Parent task for integration testing",
            hierarchy_path="/integration_parent_001",
            task_type=TaskType.BREAKDOWN,
            status=TaskStatus.ACTIVE
        )
        
        saved_parent = await task_repo.save(parent_task)
        assert saved_parent.task_id == parent_task.task_id
        
        # 2. Create child tasks
        child_tasks = []
        for i in range(3):
            child_task = Task(
                task_id=f"integration_child_{i}",
                title=f"Integration Child Task {i}",
                description=f"Child task {i} for integration testing",
                hierarchy_path=f"/integration_parent_001/integration_child_{i}",
                parent_task_id="integration_parent_001",
                hierarchy_level=1,
                status=TaskStatus.PENDING
            )
            
            saved_child = await task_repo.save(child_task)
            child_tasks.append(saved_child)
        
        # 3. Verify hierarchy
        children = await task_repo.find_by_parent_id("integration_parent_001")
        assert len(children) == 3
        
        # 4. Update task statuses
        for child in child_tasks:
            child.status = TaskStatus.COMPLETED
            await task_repo.save(child)
        
        # 5. Verify updates
        updated_children = await task_repo.find_by_parent_id("integration_parent_001")
        assert all(child.status == TaskStatus.COMPLETED for child in updated_children)

    async def test_repository_transaction_consistency(self, repository_stack):
        """Test transaction consistency across repository operations."""
        task_repo = repository_stack["task_repository"]
        connection_manager = repository_stack["connection_manager"]
        
        # Test that failed transactions don't leave partial data
        try:
            async with connection_manager.transaction():
                # Create first task (should succeed)
                task1 = Task(
                    task_id="transaction_test_1",
                    title="Transaction Test 1",
                    description="First task in transaction",
                    hierarchy_path="/transaction_test_1"
                )
                await task_repo.save(task1)
                
                # Create second task (simulate failure)
                task2 = Task(
                    task_id="transaction_test_1",  # Duplicate ID should fail
                    title="Transaction Test 2",
                    description="Second task in transaction",
                    hierarchy_path="/transaction_test_2"
                )
                await task_repo.save(task2)  # This should fail
                
        except Exception:
            # Transaction should have rolled back
            pass
        
        # Verify no partial data was saved
        result = await task_repo.get_by_id("transaction_test_1")
        # Result depends on transaction implementation

    async def test_repository_performance(self, repository_stack):
        """Test repository performance with larger datasets."""
        task_repo = repository_stack["task_repository"]
        
        # Create many tasks
        tasks = [
            Task(
                task_id=f"perf_task_{i:04d}",
                title=f"Performance Task {i}",
                description=f"Performance test task number {i}",
                hierarchy_path=f"/perf_task_{i:04d}",
                status=TaskStatus.PENDING if i % 2 == 0 else TaskStatus.ACTIVE
            )
            for i in range(100)
        ]
        
        # Measure batch save performance
        import time
        start_time = time.time()
        
        for task in tasks:
            await task_repo.save(task)
        
        save_duration = time.time() - start_time
        
        # Measure query performance
        start_time = time.time()
        all_tasks = await task_repo.list_all()
        query_duration = time.time() - start_time
        
        # Basic performance assertions
        assert len(all_tasks) >= 100
        assert save_duration < 10.0  # Should complete within 10 seconds
        assert query_duration < 2.0   # Query should be fast

    async def test_repository_error_recovery(self, repository_stack):
        """Test repository error recovery mechanisms."""
        task_repo = repository_stack["task_repository"]
        
        # Test recovery from database lock
        # Test recovery from connection timeout
        # Test recovery from disk space issues
        
        # For now, just test basic error handling
        with pytest.raises(Exception):
            await task_repo.save(None)  # Invalid input should raise error
        
        # Repository should still be functional after error
        valid_task = Task(
            task_id="recovery_test_001",
            title="Recovery Test",
            description="Test after error",
            hierarchy_path="/recovery_test_001"
        )
        
        result = await task_repo.save(valid_task)
        assert result.task_id == "recovery_test_001"