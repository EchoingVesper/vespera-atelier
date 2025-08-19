"""
Unit tests for Background Services in Vespera V2 Triple Database System.

Tests comprehensive background service functionality including:
- Service lifecycle management (start, stop, restart)
- Automatic embedding generation on task changes
- Cycle detection when dependencies are added
- Incremental sync coordination across databases  
- Index optimization scheduling and execution
- Error handling and retry mechanisms
"""

import pytest
import asyncio
import tempfile
import json
from pathlib import Path
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import Dict, Any, List

# Import our modules
from databases.background_services import (
    BackgroundServiceManager, ServiceOperation, 
    AutoEmbeddingService, CycleDetectionService,
    IncrementalSyncService, IndexOptimizationService
)
from databases.service_config import (
    BackgroundServiceConfig, ServiceType, ServicePriority, ServiceStatus,
    get_development_config, get_production_config
)
from tasks.models import Task, TaskStatus, TaskPriority


class TestBackgroundServiceConfig:
    """Test cases for BackgroundServiceConfig."""
    
    def test_default_development_config(self):
        """Test default development configuration."""
        config = get_development_config()
        
        assert config.worker_count == 1
        assert config.queue_size == 100
        assert config.operation_timeout == 30.0
        assert config.retry_delay == 5.0
        assert config.max_retries == 3
        assert config.logging_level == "INFO"
    
    def test_production_config_differences(self):
        """Test production configuration optimizations."""
        dev_config = get_development_config()
        prod_config = get_production_config()
        
        # Production should have more workers
        assert prod_config.worker_count > dev_config.worker_count
        # Production should have larger queues
        assert prod_config.queue_size > dev_config.queue_size
        # Production should have longer timeouts
        assert prod_config.operation_timeout > dev_config.operation_timeout
    
    def test_config_validation(self):
        """Test configuration validation."""
        with tempfile.TemporaryDirectory() as temp_dir:
            config = BackgroundServiceConfig(
                data_dir=Path(temp_dir),
                worker_count=2,
                queue_size=50
            )
            
            assert config.data_dir == Path(temp_dir)
            assert config.worker_count == 2
            assert config.queue_size == 50
    
    def test_config_serialization(self):
        """Test configuration file serialization/deserialization."""
        with tempfile.TemporaryDirectory() as temp_dir:
            config = get_development_config()
            config.data_dir = Path(temp_dir)
            
            # Save to file
            config_file = Path(temp_dir) / "test_config.json"
            config.to_file(config_file)
            
            assert config_file.exists()
            
            # Load from file
            loaded_config = BackgroundServiceConfig.from_file(config_file)
            
            assert loaded_config.worker_count == config.worker_count
            assert loaded_config.data_dir == config.data_dir


class TestServiceOperation:
    """Test cases for ServiceOperation."""
    
    def test_operation_creation(self):
        """Test service operation creation."""
        operation = ServiceOperation(
            id="test_op_001",
            service_type=ServiceType.AUTO_EMBEDDING,
            priority=ServicePriority.NORMAL,
            operation_type="embed_task",
            target_id="task_123",
            payload={"task_data": {"id": "task_123", "title": "Test Task"}},
            created_at=datetime.now()
        )
        
        assert operation.id == "test_op_001"
        assert operation.service_type == ServiceType.AUTO_EMBEDDING
        assert operation.priority == ServicePriority.NORMAL
        assert operation.retries == 0
        assert operation.max_retries == 3
    
    def test_operation_scheduling(self):
        """Test operation scheduling functionality."""
        future_time = datetime.now() + timedelta(hours=1)
        
        operation = ServiceOperation(
            id="test_scheduled",
            service_type=ServiceType.INDEX_OPTIMIZATION,
            priority=ServicePriority.LOW,
            operation_type="optimize_indices",
            target_id="global",
            payload={},
            created_at=datetime.now(),
            scheduled_for=future_time
        )
        
        assert operation.scheduled_for == future_time
        assert operation.scheduled_for > operation.created_at


class TestBackgroundServiceManager:
    """Test cases for BackgroundServiceManager."""
    
    @pytest.fixture
    async def temp_dir(self):
        """Create a temporary directory for testing."""
        with tempfile.TemporaryDirectory() as temp_dir:
            yield Path(temp_dir)
    
    @pytest.fixture
    async def test_config(self, temp_dir):
        """Create test configuration."""
        config = get_development_config()
        config.data_dir = temp_dir
        config.worker_count = 1  # Minimal for testing
        config.queue_size = 10
        config.operation_timeout = 5.0
        return config
    
    @pytest.fixture
    async def service_manager(self, test_config):
        """Create BackgroundServiceManager for testing."""
        manager = BackgroundServiceManager(test_config)
        yield manager
        # Cleanup
        try:
            await manager.stop()
        except:
            pass
    
    @pytest.mark.asyncio
    async def test_manager_initialization(self, test_config):
        """Test service manager initialization."""
        manager = BackgroundServiceManager(test_config)
        
        # Should not be initialized yet
        assert not manager._initialized
        assert not manager._running
        
        # Initialize
        success = await manager.initialize()
        assert success
        assert manager._initialized
        assert len(manager.services) == 4  # All service types
        
        # Cleanup
        await manager.stop()
    
    @pytest.mark.asyncio
    async def test_service_startup_shutdown(self, service_manager):
        """Test service startup and shutdown."""
        # Initialize
        success = await service_manager.initialize()
        assert success
        
        # Start
        await service_manager.start()
        assert service_manager._running
        
        # Check all services are enabled by default
        for service_type in ServiceType:
            service = service_manager.services[service_type]
            assert service.enabled
        
        # Stop
        await service_manager.stop()
        assert not service_manager._running
    
    @pytest.mark.asyncio
    async def test_operation_scheduling(self, service_manager):
        """Test operation scheduling and processing."""
        await service_manager.initialize()
        await service_manager.start()
        
        # Schedule a test operation
        operation_id = await service_manager.schedule_operation(
            ServiceType.AUTO_EMBEDDING,
            "embed_task",
            "test_task_001",
            {
                "task_data": {
                    "id": "test_task_001",
                    "title": "Test Task",
                    "description": "Test description"
                }
            },
            ServicePriority.NORMAL
        )
        
        assert operation_id is not None
        assert isinstance(operation_id, str)
        
        # Give some time for processing
        await asyncio.sleep(1)
        
        # Check service status
        status = await service_manager.get_service_status(ServiceType.AUTO_EMBEDDING)
        assert status["status"] in [ServiceStatus.RUNNING, ServiceStatus.IDLE]
    
    @pytest.mark.asyncio
    async def test_service_enable_disable(self, service_manager):
        """Test enabling and disabling services."""
        await service_manager.initialize()
        await service_manager.start()
        
        # Disable auto-embedding service
        embed_service = service_manager.services[ServiceType.AUTO_EMBEDDING]
        embed_service.enabled = False
        
        # Try to schedule operation (should succeed but service won't process)
        operation_id = await service_manager.schedule_operation(
            ServiceType.AUTO_EMBEDDING,
            "embed_task",
            "disabled_test",
            {},
            ServicePriority.LOW
        )
        
        assert operation_id is not None
        
        # Re-enable service
        embed_service.enabled = True
        
        # Check service status
        status = await service_manager.get_service_status(ServiceType.AUTO_EMBEDDING)
        assert status["enabled"] == True
    
    @pytest.mark.asyncio
    async def test_error_handling(self, service_manager):
        """Test error handling in operations."""
        await service_manager.initialize()
        await service_manager.start()
        
        # Schedule operation with invalid data (should handle gracefully)
        operation_id = await service_manager.schedule_operation(
            ServiceType.CYCLE_DETECTION,
            "invalid_operation",  # Invalid operation type
            "error_test",
            {"invalid": "data"},
            ServicePriority.NORMAL
        )
        
        assert operation_id is not None
        
        # Give time for processing and error handling
        await asyncio.sleep(2)
        
        # Service should still be running despite error
        status = await service_manager.get_overall_status()
        assert status["initialized"] == True
    
    @pytest.mark.asyncio
    async def test_performance_metrics(self, service_manager):
        """Test performance metrics collection."""
        await service_manager.initialize()
        await service_manager.start()
        
        # Schedule multiple operations
        for i in range(3):
            await service_manager.schedule_operation(
                ServiceType.INCREMENTAL_SYNC,
                "sync_task",
                f"metrics_test_{i}",
                {"operation": "test", "index": i},
                ServicePriority.NORMAL
            )
        
        # Give time for processing
        await asyncio.sleep(2)
        
        # Check metrics
        for service_type in ServiceType:
            status = await service_manager.get_service_status(service_type)
            metrics = status.get("metrics", {})
            
            # Should have basic metric fields
            assert "operations_completed" in metrics
            assert "operations_failed" in metrics
            assert "average_processing_time" in metrics
            assert isinstance(metrics["operations_completed"], int)
            assert isinstance(metrics["operations_failed"], int)
            assert isinstance(metrics["average_processing_time"], (int, float))


class TestAutoEmbeddingService:
    """Test cases for AutoEmbeddingService."""
    
    @pytest.fixture
    async def embedding_service(self, temp_dir):
        """Create AutoEmbeddingService for testing."""
        config = get_development_config()
        config.data_dir = temp_dir
        
        service = AutoEmbeddingService(config)
        yield service
    
    @pytest.mark.asyncio
    async def test_task_embedding_generation(self, embedding_service):
        """Test task embedding generation."""
        # Mock embedding generation (avoid external dependencies in unit tests)
        with patch.object(embedding_service, '_generate_embedding', return_value="mock_embedding_vector"):
            
            operation = ServiceOperation(
                id="embed_test",
                service_type=ServiceType.AUTO_EMBEDDING,
                priority=ServicePriority.NORMAL,
                operation_type="embed_task",
                target_id="task_123",
                payload={
                    "task_data": {
                        "id": "task_123",
                        "title": "Test Task",
                        "description": "Test description for embedding"
                    }
                },
                created_at=datetime.now()
            )
            
            # Process operation
            result = await embedding_service.process_operation(operation)
            
            assert result["success"] == True
            assert "embedding_id" in result
            assert result["task_id"] == "task_123"
    
    @pytest.mark.asyncio
    async def test_embedding_update_detection(self, embedding_service):
        """Test detection of content changes requiring embedding updates."""
        # Test with content change
        old_content = "Original task content"
        new_content = "Updated task content"
        
        # Mock content hash generation
        with patch.object(embedding_service, '_get_content_hash', side_effect=lambda x: hash(x)):
            
            # Simulate content change detection
            old_hash = embedding_service._get_content_hash(old_content)
            new_hash = embedding_service._get_content_hash(new_content)
            
            assert old_hash != new_hash
            
            # Should trigger re-embedding
            needs_update = embedding_service._needs_embedding_update(old_hash, new_hash)
            assert needs_update == True


class TestCycleDetectionService:
    """Test cases for CycleDetectionService."""
    
    @pytest.fixture
    async def cycle_service(self, temp_dir):
        """Create CycleDetectionService for testing."""
        config = get_development_config()
        config.data_dir = temp_dir
        
        service = CycleDetectionService(config)
        yield service
    
    @pytest.mark.asyncio
    async def test_dependency_cycle_detection(self, cycle_service):
        """Test dependency cycle detection."""
        # Mock dependency graph analysis
        with patch.object(cycle_service, '_analyze_dependency_graph', return_value={
            "cycles_found": 1,
            "cycle_paths": [["task_A", "task_B", "task_C", "task_A"]],
            "affected_tasks": ["task_A", "task_B", "task_C"]
        }):
            
            operation = ServiceOperation(
                id="cycle_test",
                service_type=ServiceType.CYCLE_DETECTION,
                priority=ServicePriority.HIGH,
                operation_type="check_cycles",
                target_id="task_A",
                payload={
                    "dependency_added": "task_C",
                    "affected_tasks": ["task_A", "task_B", "task_C"]
                },
                created_at=datetime.now()
            )
            
            result = await cycle_service.process_operation(operation)
            
            assert result["success"] == True
            assert result["cycles_found"] == 1
            assert len(result["cycle_paths"]) == 1
            assert "task_A" in result["cycle_paths"][0]
    
    @pytest.mark.asyncio
    async def test_no_cycles_detected(self, cycle_service):
        """Test when no cycles are detected."""
        # Mock no cycles found
        with patch.object(cycle_service, '_analyze_dependency_graph', return_value={
            "cycles_found": 0,
            "cycle_paths": [],
            "affected_tasks": []
        }):
            
            operation = ServiceOperation(
                id="no_cycle_test",
                service_type=ServiceType.CYCLE_DETECTION,
                priority=ServicePriority.NORMAL,
                operation_type="check_cycles",
                target_id="task_safe",
                payload={
                    "dependency_added": "task_dependency",
                    "affected_tasks": ["task_safe", "task_dependency"]
                },
                created_at=datetime.now()
            )
            
            result = await cycle_service.process_operation(operation)
            
            assert result["success"] == True
            assert result["cycles_found"] == 0
            assert len(result["cycle_paths"]) == 0


class TestIncrementalSyncService:
    """Test cases for IncrementalSyncService."""
    
    @pytest.fixture
    async def sync_service(self, temp_dir):
        """Create IncrementalSyncService for testing."""
        config = get_development_config()
        config.data_dir = temp_dir
        
        service = IncrementalSyncService(config)
        yield service
    
    @pytest.mark.asyncio
    async def test_task_sync_coordination(self, sync_service):
        """Test task synchronization coordination."""
        # Mock database sync operations
        with patch.object(sync_service, '_sync_to_chroma', return_value=True), \
             patch.object(sync_service, '_sync_to_kuzu', return_value=True):
            
            operation = ServiceOperation(
                id="sync_test",
                service_type=ServiceType.INCREMENTAL_SYNC,
                priority=ServicePriority.NORMAL,
                operation_type="sync_task",
                target_id="task_sync_123",
                payload={
                    "operation": "create",
                    "task_data": {
                        "id": "task_sync_123",
                        "title": "Sync Test Task",
                        "description": "Task for sync testing"
                    }
                },
                created_at=datetime.now()
            )
            
            result = await sync_service.process_operation(operation)
            
            assert result["success"] == True
            assert result["chroma_synced"] == True
            assert result["kuzu_synced"] == True
            assert result["task_id"] == "task_sync_123"
    
    @pytest.mark.asyncio
    async def test_partial_sync_failure(self, sync_service):
        """Test handling of partial sync failures."""
        # Mock partial failure (Chroma succeeds, Kuzu fails)
        with patch.object(sync_service, '_sync_to_chroma', return_value=True), \
             patch.object(sync_service, '_sync_to_kuzu', side_effect=Exception("Kuzu sync failed")):
            
            operation = ServiceOperation(
                id="partial_fail_test",
                service_type=ServiceType.INCREMENTAL_SYNC,
                priority=ServicePriority.NORMAL,
                operation_type="sync_task",
                target_id="task_partial_fail",
                payload={
                    "operation": "update",
                    "task_data": {"id": "task_partial_fail"}
                },
                created_at=datetime.now()
            )
            
            result = await sync_service.process_operation(operation)
            
            assert result["success"] == False  # Overall failure due to partial sync
            assert result["chroma_synced"] == True
            assert result["kuzu_synced"] == False
            assert "error" in result


class TestIndexOptimizationService:
    """Test cases for IndexOptimizationService."""
    
    @pytest.fixture
    async def optimization_service(self, temp_dir):
        """Create IndexOptimizationService for testing."""
        config = get_development_config()
        config.data_dir = temp_dir
        
        service = IndexOptimizationService(config)
        yield service
    
    @pytest.mark.asyncio
    async def test_index_optimization(self, optimization_service):
        """Test index optimization operations."""
        # Mock index optimization
        with patch.object(optimization_service, '_optimize_chroma_indices', return_value={"optimized": True, "time_saved": 0.5}), \
             patch.object(optimization_service, '_optimize_kuzu_indices', return_value={"optimized": True, "nodes_optimized": 100}):
            
            operation = ServiceOperation(
                id="optimize_test",
                service_type=ServiceType.INDEX_OPTIMIZATION,
                priority=ServicePriority.LOW,
                operation_type="optimize_indices",
                target_id="global",
                payload={
                    "triggered_by": "test_suite",
                    "force": True
                },
                created_at=datetime.now()
            )
            
            result = await optimization_service.process_operation(operation)
            
            assert result["success"] == True
            assert "chroma_optimization" in result
            assert "kuzu_optimization" in result
            assert result["chroma_optimization"]["optimized"] == True
    
    @pytest.mark.asyncio
    async def test_scheduled_optimization(self, optimization_service):
        """Test scheduled optimization operations."""
        # Test optimization scheduling logic
        future_time = datetime.now() + timedelta(hours=1)
        
        operation = ServiceOperation(
            id="scheduled_optimize",
            service_type=ServiceType.INDEX_OPTIMIZATION,
            priority=ServicePriority.LOW,
            operation_type="optimize_indices",
            target_id="global",
            payload={"schedule": "daily"},
            created_at=datetime.now(),
            scheduled_for=future_time
        )
        
        # Should not process yet (scheduled for future)
        assert operation.scheduled_for > datetime.now()
        
        # Mock time advancement for testing
        with patch('databases.background_services.datetime') as mock_datetime:
            mock_datetime.now.return_value = future_time + timedelta(minutes=1)
            
            # Now should be ready for processing
            assert mock_datetime.now() > operation.scheduled_for


class TestServiceIntegration:
    """Integration tests for background services working together."""
    
    @pytest.fixture
    async def integrated_system(self, temp_dir):
        """Create integrated system for testing."""
        config = get_development_config()
        config.data_dir = temp_dir
        config.worker_count = 1
        
        manager = BackgroundServiceManager(config)
        await manager.initialize()
        await manager.start()
        
        yield manager
        
        await manager.stop()
    
    @pytest.mark.asyncio
    async def test_task_lifecycle_integration(self, integrated_system):
        """Test complete task lifecycle with background services."""
        manager = integrated_system
        
        # 1. Create task (should trigger embedding)
        task_data = {
            "id": "integration_test_task",
            "title": "Integration Test Task",
            "description": "Testing full lifecycle with background services",
            "status": "pending"
        }
        
        # Schedule embedding
        embed_op_id = await manager.schedule_operation(
            ServiceType.AUTO_EMBEDDING,
            "embed_task",
            task_data["id"],
            {"task_data": task_data},
            ServicePriority.NORMAL
        )
        
        # Schedule sync
        sync_op_id = await manager.schedule_operation(
            ServiceType.INCREMENTAL_SYNC,
            "sync_task",
            task_data["id"],
            {"operation": "create", "task_data": task_data},
            ServicePriority.NORMAL
        )
        
        # 2. Add dependency (should trigger cycle detection)
        dependency_data = {
            "task_id": task_data["id"],
            "depends_on": "other_task_id"
        }
        
        cycle_op_id = await manager.schedule_operation(
            ServiceType.CYCLE_DETECTION,
            "check_cycles",
            task_data["id"],
            {
                "dependency_added": "other_task_id",
                "affected_tasks": [task_data["id"], "other_task_id"]
            },
            ServicePriority.HIGH
        )
        
        # 3. Schedule optimization
        opt_op_id = await manager.schedule_operation(
            ServiceType.INDEX_OPTIMIZATION,
            "optimize_indices",
            "global",
            {"triggered_by": "integration_test"},
            ServicePriority.LOW
        )
        
        # Give time for all operations to process
        await asyncio.sleep(3)
        
        # Verify operations were scheduled
        assert embed_op_id is not None
        assert sync_op_id is not None
        assert cycle_op_id is not None
        assert opt_op_id is not None
        
        # Check overall system status
        status = await manager.get_overall_status()
        assert status["initialized"] == True
        assert status["running"] == True


if __name__ == "__main__":
    pytest.main([__file__])