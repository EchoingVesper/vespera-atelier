"""
Unit tests for DatabaseSyncCoordinator.
"""

import pytest
import asyncio
import tempfile
from pathlib import Path
from unittest.mock import Mock, AsyncMock, patch

from tasks.service import TaskService
from tasks.models import Task, TaskStatus, TaskPriority, SyncStatus
from databases.sync_coordinator import DatabaseSyncCoordinator, SyncOperation, SyncResult


class TestSyncOperation:
    """Test cases for SyncOperation dataclass."""
    
    def test_default_values(self):
        """Test default values for SyncOperation."""
        op = SyncOperation(task_id="test_task", operation_type="create")
        
        assert op.task_id == "test_task"
        assert op.operation_type == "create"
        assert op.target_databases == {"chroma", "kuzu"}
        assert op.priority == 1
        assert op.retry_count == 0
        assert op.max_retries == 3
        assert op.last_error is None
    
    def test_custom_values(self):
        """Test custom values for SyncOperation."""
        op = SyncOperation(
            task_id="test_task",
            operation_type="update",
            target_databases={"chroma"},
            priority=2
        )
        
        assert op.target_databases == {"chroma"}
        assert op.priority == 2


class TestSyncResult:
    """Test cases for SyncResult dataclass."""
    
    def test_default_values(self):
        """Test default values for SyncResult."""
        result = SyncResult(success=True, task_id="test_task")
        
        assert result.success is True
        assert result.task_id == "test_task"
        assert len(result.databases_synced) == 0
        assert len(result.databases_failed) == 0
        assert len(result.errors) == 0
        assert result.duration is None
    
    def test_with_data(self):
        """Test SyncResult with data."""
        result = SyncResult(
            success=False,
            task_id="test_task",
            databases_synced={"chroma"},
            databases_failed={"kuzu"},
            errors=["Connection failed"]
        )
        
        assert result.success is False
        assert result.databases_synced == {"chroma"}
        assert result.databases_failed == {"kuzu"}
        assert result.errors == ["Connection failed"]


class TestDatabaseSyncCoordinator:
    """Test cases for DatabaseSyncCoordinator."""
    
    @pytest.fixture
    async def temp_db(self):
        """Create a temporary database for testing."""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "test.db"
            service = TaskService(db_path)
            yield service
    
    @pytest.fixture
    async def sync_coordinator(self, temp_db):
        """Create a sync coordinator for testing."""
        coordinator = DatabaseSyncCoordinator(temp_db)
        yield coordinator
        await coordinator.stop()
    
    @pytest.fixture
    def mock_task(self):
        """Create a mock task for testing."""
        task = Task(
            id="test_task_123",
            title="Test Task",
            description="Test description",
            status=TaskStatus.TODO,
            priority=TaskPriority.NORMAL
        )
        return task
    
    def test_initialization(self, sync_coordinator):
        """Test sync coordinator initialization."""
        assert sync_coordinator.task_service is not None
        assert sync_coordinator.chroma_client is None
        assert sync_coordinator.kuzu_database is None
        assert sync_coordinator.sync_queue is not None
        assert len(sync_coordinator.sync_in_progress) == 0
    
    def test_set_external_clients(self, sync_coordinator):
        """Test setting external database clients."""
        mock_chroma = Mock()
        mock_kuzu = Mock()
        
        sync_coordinator.set_external_clients(mock_chroma, mock_kuzu)
        
        assert sync_coordinator.chroma_client == mock_chroma
        assert sync_coordinator.kuzu_database == mock_kuzu
    
    @pytest.mark.asyncio
    async def test_start_stop(self, sync_coordinator):
        """Test starting and stopping the coordinator."""
        # Should not be running initially
        assert sync_coordinator._sync_task is None or sync_coordinator._sync_task.done()
        
        # Start
        await sync_coordinator.start()
        assert sync_coordinator._sync_task is not None
        assert not sync_coordinator._sync_task.done()
        
        # Stop
        await sync_coordinator.stop()
        assert sync_coordinator._shutdown is True
    
    @pytest.mark.asyncio
    async def test_schedule_sync(self, sync_coordinator):
        """Test scheduling sync operations."""
        # Schedule a sync operation
        await sync_coordinator.schedule_sync("test_task", "create")
        
        # Queue should not be empty
        assert not sync_coordinator.sync_queue.empty()
    
    @pytest.mark.asyncio
    async def test_schedule_sync_duplicate_in_progress(self, sync_coordinator):
        """Test that duplicate syncs for same task are ignored."""
        # Mark task as in progress
        sync_coordinator.sync_in_progress.add("test_task")
        
        # Try to schedule sync
        await sync_coordinator.schedule_sync("test_task", "update")
        
        # Queue should be empty (operation was ignored)
        assert sync_coordinator.sync_queue.empty()
    
    @pytest.mark.asyncio
    async def test_sync_task_immediate_no_clients(self, sync_coordinator, mock_task):
        """Test immediate sync with no external clients configured."""
        result = await sync_coordinator.sync_task_immediate(mock_task, "create")
        
        assert not result.success
        assert len(result.errors) > 0
        assert result.task_id == mock_task.id
    
    @pytest.mark.asyncio
    async def test_sync_task_immediate_with_mocked_clients(self, sync_coordinator, mock_task):
        """Test immediate sync with mocked external clients."""
        # Set up mock clients
        mock_chroma = Mock()
        mock_kuzu = Mock()
        
        sync_coordinator.set_external_clients(mock_chroma, mock_kuzu)
        
        # Mock the sync methods to return success
        with patch.object(sync_coordinator, '_sync_to_chroma', return_value=True), \
             patch.object(sync_coordinator, '_sync_to_kuzu', return_value=True), \
             patch.object(sync_coordinator, '_update_task_sync_status', return_value=None):
            
            result = await sync_coordinator.sync_task_immediate(mock_task, "create")
            
            assert result.success
            assert "chroma" in result.databases_synced
            assert "kuzu" in result.databases_synced
            assert len(result.databases_failed) == 0
    
    @pytest.mark.asyncio
    async def test_sync_task_immediate_partial_failure(self, sync_coordinator, mock_task):
        """Test immediate sync with partial failure."""
        # Set up mock clients
        mock_chroma = Mock()
        mock_kuzu = Mock()
        
        sync_coordinator.set_external_clients(mock_chroma, mock_kuzu)
        
        # Mock Chroma success, KuzuDB failure
        with patch.object(sync_coordinator, '_sync_to_chroma', return_value=True), \
             patch.object(sync_coordinator, '_sync_to_kuzu', return_value=False), \
             patch.object(sync_coordinator, '_update_task_sync_status', return_value=None):
            
            result = await sync_coordinator.sync_task_immediate(mock_task, "create")
            
            assert result.success  # Success if any database synced
            assert "chroma" in result.databases_synced
            assert "kuzu" in result.databases_failed
            assert len(result.errors) == 1
    
    @pytest.mark.asyncio
    async def test_sync_to_chroma_no_client(self, sync_coordinator, mock_task):
        """Test Chroma sync with no client."""
        result = await sync_coordinator._sync_to_chroma(mock_task, "create")
        assert result is False
    
    @pytest.mark.asyncio
    async def test_sync_to_kuzu_no_client(self, sync_coordinator, mock_task):
        """Test KuzuDB sync with no client."""
        result = await sync_coordinator._sync_to_kuzu(mock_task, "create")
        assert result is False
    
    @pytest.mark.asyncio
    async def test_cleanup_deleted_tasks(self, sync_coordinator):
        """Test cleanup of deleted tasks."""
        task_ids = ["task1", "task2", "task3"]
        
        with patch.object(sync_coordinator, '_cleanup_chroma_documents', return_value=None), \
             patch.object(sync_coordinator, '_cleanup_kuzu_nodes', return_value=None):
            
            # Should not raise exception
            await sync_coordinator._cleanup_deleted_tasks(task_ids)
    
    @pytest.mark.asyncio
    async def test_get_sync_statistics(self, sync_coordinator):
        """Test sync statistics retrieval."""
        # Add some mock data
        sync_coordinator.sync_in_progress.add("task1")
        sync_coordinator.sync_in_progress.add("task2")
        
        # Mock the task service to return some tasks
        mock_tasks = [
            Mock(triple_db=Mock(sync_status=SyncStatus.SYNCED, chroma_synced=True, kuzu_synced=True)),
            Mock(triple_db=Mock(sync_status=SyncStatus.PENDING, chroma_synced=False, kuzu_synced=False)),
            Mock(triple_db=Mock(sync_status=SyncStatus.PARTIAL, chroma_synced=True, kuzu_synced=False))
        ]
        
        with patch.object(sync_coordinator.task_service, 'list_tasks', return_value=mock_tasks):
            stats = await sync_coordinator.get_sync_statistics()
            
            assert stats["total_tasks"] == 3
            assert stats["sync_status"]["synced"] == 1
            assert stats["sync_status"]["pending"] == 1
            assert stats["sync_status"]["partial"] == 1
            assert stats["database_sync"]["both_synced"] == 1
            assert stats["database_sync"]["none_synced"] == 1
            assert stats["database_sync"]["chroma_synced"] == 1
            assert stats["active_syncs"] == 2
    
    @pytest.mark.asyncio
    async def test_force_full_resync(self, sync_coordinator):
        """Test forcing full resynchronization."""
        # Mock tasks
        mock_tasks = [
            Mock(id="task1", triple_db=Mock(sync_status=SyncStatus.SYNCED)),
            Mock(id="task2", triple_db=Mock(sync_status=SyncStatus.ERROR))
        ]
        
        with patch.object(sync_coordinator.task_service, 'list_tasks', return_value=mock_tasks), \
             patch.object(sync_coordinator, 'schedule_sync', return_value=None) as mock_schedule:
            
            result = await sync_coordinator.force_full_resync()
            
            assert result["success"] is True
            assert result["tasks_scheduled"] == 2
            
            # Should have scheduled sync for each task
            assert mock_schedule.call_count == 2
            
            # Check that task sync status was reset
            for task in mock_tasks:
                assert task.triple_db.sync_status == SyncStatus.PENDING
                assert task.triple_db.chroma_synced is False
                assert task.triple_db.kuzu_synced is False


class TestSyncQueueProcessing:
    """Test cases for sync queue processing."""
    
    @pytest.fixture
    async def coordinator_with_mock_task_service(self):
        """Create coordinator with mocked task service."""
        mock_service = Mock()
        coordinator = DatabaseSyncCoordinator(mock_service)
        yield coordinator
        await coordinator.stop()
    
    @pytest.mark.asyncio
    async def test_process_sync_batch_empty(self, coordinator_with_mock_task_service):
        """Test processing empty batch."""
        coordinator = coordinator_with_mock_task_service
        
        # Should handle empty batch gracefully
        await coordinator._process_sync_batch([])
    
    @pytest.mark.asyncio
    async def test_process_sync_batch_with_operations(self, coordinator_with_mock_task_service):
        """Test processing batch with operations."""
        coordinator = coordinator_with_mock_task_service
        
        # Create mock operations
        operations = [
            SyncOperation(task_id="task1", operation_type="create", priority=2),
            SyncOperation(task_id="task2", operation_type="update", priority=1),
            SyncOperation(task_id="task3", operation_type="delete", priority=1)
        ]
        
        # Mock task retrieval and sync
        mock_task = Mock(id="task1")
        coordinator.task_service.get_task = AsyncMock(return_value=mock_task)
        
        with patch.object(coordinator, 'sync_task_immediate', 
                         return_value=SyncResult(success=True, task_id="task1")):
            
            # Should process operations in priority order
            await coordinator._process_sync_batch(operations)
    
    @pytest.mark.asyncio
    async def test_process_sync_batch_with_retry(self, coordinator_with_mock_task_service):
        """Test processing batch with retry logic."""
        coordinator = coordinator_with_mock_task_service
        
        # Create operation that will fail
        operation = SyncOperation(task_id="task1", operation_type="create", max_retries=2)
        
        mock_task = Mock(id="task1")
        coordinator.task_service.get_task = AsyncMock(return_value=mock_task)
        
        # Mock sync to fail first time, then succeed
        sync_results = [
            SyncResult(success=False, task_id="task1", errors=["Connection failed"]),
            SyncResult(success=True, task_id="task1")
        ]
        
        with patch.object(coordinator, 'sync_task_immediate', side_effect=sync_results), \
             patch('asyncio.sleep', return_value=None):  # Speed up test
            
            await coordinator._process_sync_batch([operation])
            
            # Operation should have been retried
            assert operation.retry_count == 1


if __name__ == "__main__":
    pytest.main([__file__])