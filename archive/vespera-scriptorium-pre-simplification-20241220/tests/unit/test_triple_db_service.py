"""
Unit tests for TripleDBService and database coordination.
"""

import pytest
import asyncio
import tempfile
from pathlib import Path
from datetime import datetime
from unittest.mock import Mock, AsyncMock, patch

# Import our modules
from databases import TripleDBService, DatabaseConfig, DatabaseConnectionError
from tasks.models import Task, TaskStatus, TaskPriority, TripleDBCoordination, SyncStatus


class TestTripleDBService:
    """Test cases for TripleDBService."""
    
    @pytest.fixture
    async def temp_dir(self):
        """Create a temporary directory for testing."""
        with tempfile.TemporaryDirectory() as temp_dir:
            yield Path(temp_dir)
    
    @pytest.fixture
    async def db_config(self, temp_dir):
        """Create test database configuration."""
        return DatabaseConfig(
            data_dir=temp_dir,
            sqlite_enabled=True,
            chroma_enabled=False,  # Disable external deps for unit tests
            kuzu_enabled=False
        )
    
    @pytest.fixture
    async def triple_db_service(self, db_config):
        """Create TripleDBService instance for testing."""
        service = TripleDBService(db_config)
        await service.initialize()
        yield service
        await service.cleanup()
    
    @pytest.mark.asyncio
    async def test_initialization(self, db_config):
        """Test service initialization."""
        service = TripleDBService(db_config)
        
        # Should not be initialized yet
        assert not service._initialized
        
        # Initialize
        success = await service.initialize()
        assert success
        assert service._initialized
        assert service.task_service is not None
        
        # Cleanup
        await service.cleanup()
        assert not service._initialized
    
    @pytest.mark.asyncio
    async def test_create_task(self, triple_db_service):
        """Test task creation with coordination metadata."""
        # Create a test task
        task = Task(
            title="Test Task",
            description="Test description",
            priority=TaskPriority.HIGH,
            project_id="test-project"
        )
        
        success, result = await triple_db_service.create_task(task)
        
        assert success
        assert "task" in result
        created_task_dict = result["task"]
        
        # Verify task was created with proper structure
        assert created_task_dict["title"] == "Test Task"
        assert created_task_dict["priority"] == "high"
        assert created_task_dict["project_id"] == "test-project"
        
        # Verify triple-DB coordination metadata
        assert "triple_db" in created_task_dict
        triple_db_data = created_task_dict["triple_db"]
        assert triple_db_data["sync_status"] == "pending"
        assert triple_db_data["embedding_version"] == 1
        assert triple_db_data["graph_version"] == 1
    
    @pytest.mark.asyncio
    async def test_get_task(self, triple_db_service):
        """Test task retrieval."""
        # Create a test task first
        task = Task(
            title="Retrieve Test",
            description="Test retrieval",
            priority=TaskPriority.NORMAL
        )
        
        success, result = await triple_db_service.create_task(task)
        assert success
        
        task_id = result["task"]["id"]
        
        # Retrieve the task
        retrieved_task = await triple_db_service.get_task(task_id)
        
        assert retrieved_task is not None
        assert retrieved_task.title == "Retrieve Test"
        assert retrieved_task.priority == TaskPriority.NORMAL
        assert isinstance(retrieved_task.triple_db, TripleDBCoordination)
    
    @pytest.mark.asyncio
    async def test_update_task(self, triple_db_service):
        """Test task updates with sync coordination."""
        # Create a test task first
        task = Task(
            title="Update Test",
            description="Original description",
            priority=TaskPriority.LOW
        )
        
        success, result = await triple_db_service.create_task(task)
        assert success
        
        task_id = result["task"]["id"]
        
        # Update the task
        updates = {
            "title": "Updated Test",
            "description": "Updated description",
            "priority": "high"
        }
        
        success, result = await triple_db_service.update_task(task_id, updates)
        
        assert success
        updated_task_dict = result["task"]
        
        # Verify updates
        assert updated_task_dict["title"] == "Updated Test"
        assert updated_task_dict["description"] == "Updated description"
        assert updated_task_dict["priority"] == "high"
        
        # Verify content hash was updated
        assert "content_hash" in result
    
    @pytest.mark.asyncio
    async def test_delete_task(self, triple_db_service):
        """Test task deletion."""
        # Create a test task first
        task = Task(
            title="Delete Test",
            description="Test deletion"
        )
        
        success, result = await triple_db_service.create_task(task)
        assert success
        
        task_id = result["task"]["id"]
        
        # Delete the task
        success, result = await triple_db_service.delete_task(task_id)
        
        assert success
        assert task_id in result["deleted_tasks"]
        
        # Verify task is gone
        retrieved_task = await triple_db_service.get_task(task_id)
        assert retrieved_task is None
    
    @pytest.mark.asyncio
    async def test_health_check(self, triple_db_service):
        """Test health check functionality."""
        health = await triple_db_service.health_check()
        
        assert "overall_status" in health
        assert health["initialized"] is True
        assert "databases" in health
        assert health["databases"]["sqlite"]["connected"] is True
    
    @pytest.mark.asyncio
    async def test_content_hash_generation(self, triple_db_service):
        """Test content hash generation for change detection."""
        task1 = Task(title="Task 1", description="Description 1")
        task2 = Task(title="Task 1", description="Description 1")
        task3 = Task(title="Task 1", description="Description 2")
        
        hash1 = triple_db_service._generate_content_hash(task1)
        hash2 = triple_db_service._generate_content_hash(task2)
        hash3 = triple_db_service._generate_content_hash(task3)
        
        # Same content should produce same hash
        assert hash1 == hash2
        
        # Different content should produce different hash
        assert hash1 != hash3
    
    @pytest.mark.asyncio
    async def test_graceful_degradation_chroma_disabled(self, temp_dir):
        """Test graceful degradation when Chroma is disabled."""
        config = DatabaseConfig(
            data_dir=temp_dir,
            sqlite_enabled=True,
            chroma_enabled=False,  # Disabled
            kuzu_enabled=False
        )
        
        service = TripleDBService(config)
        success = await service.initialize()
        
        assert success
        assert service.status.sqlite_connected is True
        assert service.status.chroma_connected is False
        
        # Should still be able to create tasks
        task = Task(title="Degraded Test", description="Test degradation")
        success, result = await service.create_task(task)
        
        assert success
        await service.cleanup()
    
    @pytest.mark.asyncio
    async def test_sync_status_tracking(self, triple_db_service):
        """Test sync status tracking in tasks."""
        # Create task
        task = Task(title="Sync Test", description="Test sync status")
        success, result = await triple_db_service.create_task(task)
        assert success
        
        # Get task and check initial sync status
        task_id = result["task"]["id"]
        retrieved_task = await triple_db_service.get_task(task_id)
        
        assert retrieved_task.triple_db.sync_status == SyncStatus.PENDING
        assert retrieved_task.is_sync_pending()
        assert not retrieved_task.is_fully_synced()
        
        # Test sync status summary
        sync_summary = retrieved_task.get_sync_status_summary()
        assert sync_summary["overall_status"] == "pending"
        assert not sync_summary["chroma_synced"]
        assert not sync_summary["kuzu_synced"]


class TestDatabaseConfig:
    """Test cases for DatabaseConfig."""
    
    def test_default_config(self):
        """Test default configuration values."""
        temp_dir = Path("/tmp/test")
        config = DatabaseConfig(data_dir=temp_dir)
        
        assert config.data_dir == temp_dir
        assert config.sqlite_enabled is True
        assert config.chroma_enabled is True
        assert config.kuzu_enabled is True
        assert config.auto_sync_enabled is True
    
    def test_derived_paths(self):
        """Test automatic path derivation."""
        temp_dir = Path("/tmp/test")
        config = DatabaseConfig(data_dir=temp_dir)
        
        assert config.chroma_persist_dir == temp_dir / "embeddings"
        assert config.kuzu_database_path == temp_dir / "knowledge_graph"
    
    def test_custom_paths(self):
        """Test custom path configuration."""
        temp_dir = Path("/tmp/test")
        custom_chroma = Path("/custom/chroma")
        custom_kuzu = Path("/custom/kuzu")
        
        config = DatabaseConfig(
            data_dir=temp_dir,
            chroma_persist_dir=custom_chroma,
            kuzu_database_path=custom_kuzu
        )
        
        assert config.chroma_persist_dir == custom_chroma
        assert config.kuzu_database_path == custom_kuzu


class TestTripleDBCoordination:
    """Test cases for TripleDBCoordination model."""
    
    def test_initial_state(self):
        """Test initial coordination state."""
        coord = TripleDBCoordination()
        
        assert coord.sync_status == SyncStatus.PENDING
        assert coord.embedding_id is None
        assert coord.graph_node_id is None
        assert not coord.chroma_synced
        assert not coord.kuzu_synced
        assert coord.embedding_version == 1
        assert coord.graph_version == 1
    
    def test_content_hash_generation(self):
        """Test content hash generation."""
        coord = TripleDBCoordination()
        
        content1 = "Test content 1"
        content2 = "Test content 1"  # Same
        content3 = "Test content 2"  # Different
        
        hash1 = coord.generate_content_hash(content1)
        hash2 = coord.generate_content_hash(content2)
        hash3 = coord.generate_content_hash(content3)
        
        assert hash1 == hash2
        assert hash1 != hash3
        assert len(hash1) == 64  # SHA256 hex length
    
    def test_content_change_tracking(self):
        """Test content change tracking."""
        coord = TripleDBCoordination()
        
        # Initial state
        assert coord.sync_status == SyncStatus.PENDING
        
        # Mark content changed
        coord.mark_content_changed("New content")
        
        assert coord.sync_status == SyncStatus.PENDING
        assert not coord.chroma_synced
        assert coord.content_hash is not None
    
    def test_structure_change_tracking(self):
        """Test structure change tracking."""
        coord = TripleDBCoordination()
        coord.sync_status = SyncStatus.SYNCED  # Start synced
        coord.kuzu_synced = True
        
        # Mark structure changed
        coord.mark_structure_changed()
        
        assert coord.sync_status == SyncStatus.PENDING
        assert not coord.kuzu_synced
    
    def test_sync_status_updates(self):
        """Test sync status update logic."""
        coord = TripleDBCoordination()
        
        # Mark Chroma synced
        coord.mark_chroma_synced("embedding_123")
        
        assert coord.embedding_id == "embedding_123"
        assert coord.chroma_synced
        assert coord.last_embedded is not None
        assert coord.sync_status == SyncStatus.PARTIAL  # Only Chroma synced
        
        # Mark KuzuDB synced
        coord.mark_kuzu_synced("node_456")
        
        assert coord.graph_node_id == "node_456"
        assert coord.kuzu_synced
        assert coord.last_graph_sync is not None
        assert coord.sync_status == SyncStatus.SYNCED  # Both synced
        assert coord.last_indexed is not None
        assert coord.sync_error is None
    
    def test_sync_error_handling(self):
        """Test sync error handling."""
        coord = TripleDBCoordination()
        
        error_message = "Failed to sync to database"
        coord.mark_sync_error(error_message)
        
        assert coord.sync_status == SyncStatus.ERROR
        assert coord.sync_error == error_message


@pytest.mark.asyncio
async def test_lifespan_context_manager(temp_dir):
    """Test the lifespan context manager."""
    from databases.triple_db_service import triple_db_lifespan
    
    config = DatabaseConfig(
        data_dir=temp_dir,
        chroma_enabled=False,  # Disable for testing
        kuzu_enabled=False
    )
    
    # Test context manager
    async with triple_db_lifespan(config) as service:
        assert service._initialized
        assert service.task_service is not None
        
        # Should be able to use the service
        task = Task(title="Context Test", description="Test context manager")
        success, result = await service.create_task(task)
        assert success
    
    # Service should be cleaned up after context
    assert not service._initialized


if __name__ == "__main__":
    pytest.main([__file__])