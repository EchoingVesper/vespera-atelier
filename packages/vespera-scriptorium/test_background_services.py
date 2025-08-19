#!/usr/bin/env python3
"""
Test script for background services in Vespera V2 Triple Database System.

This script demonstrates:
1. Background service initialization
2. Automatic embedding generation
3. Dependency cycle detection
4. Incremental synchronization
5. Index optimization

Run this script to verify that background services are working correctly.
"""

import asyncio
import logging
import time
from pathlib import Path
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import background services
from databases.background_services import BackgroundServiceManager
from databases.service_config import (
    BackgroundServiceConfig, ServiceType, ServicePriority,
    get_development_config
)


async def test_background_services():
    """Test background services functionality."""
    logger.info("Starting background services test")
    
    # Create test data directory
    test_data_dir = Path("test_data/background_services")
    test_data_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        # 1. Initialize background service configuration
        logger.info("1. Initializing background service configuration")
        
        bg_config = get_development_config()
        bg_config.data_dir = test_data_dir
        bg_config.worker_count = 2  # Reduced for testing
        
        # Save configuration for inspection
        config_path = test_data_dir / "background_config.json"
        bg_config.to_file(config_path)
        logger.info(f"Configuration saved to: {config_path}")
        
        # 2. Create and start background service manager
        logger.info("2. Creating background service manager")
        
        manager = BackgroundServiceManager(bg_config)
        success = await manager.initialize()
        
        if not success:
            logger.error("Failed to initialize background service manager")
            return False
        
        await manager.start()
        logger.info("Background service manager started successfully")
        
        # 3. Test service status
        logger.info("3. Testing service status")
        
        status = await manager.get_overall_status()
        logger.info(f"Overall status: {status}")
        
        for service_type in ServiceType:
            service_status = await manager.get_service_status(service_type)
            logger.info(f"Service {service_type.value}: {service_status['status']}")
        
        # 4. Test operation scheduling
        logger.info("4. Testing operation scheduling")
        
        test_operations = [
            {
                "service_type": ServiceType.AUTO_EMBEDDING,
                "operation_type": "embed_task",
                "target_id": "test_task_001",
                "payload": {
                    "task_data": {
                        "id": "test_task_001",
                        "title": "Test Task for Embedding",
                        "description": "This is a test task for background embedding generation.",
                        "status": "pending",
                        "priority": "normal"
                    }
                }
            },
            {
                "service_type": ServiceType.CYCLE_DETECTION,
                "operation_type": "check_cycles",
                "target_id": "test_task_002",
                "payload": {
                    "dependency_added": "test_task_001",
                    "affected_tasks": ["test_task_001", "test_task_002"]
                }
            },
            {
                "service_type": ServiceType.INCREMENTAL_SYNC,
                "operation_type": "sync_task",
                "target_id": "test_task_003",
                "payload": {
                    "operation": "create",
                    "task_data": {
                        "id": "test_task_003",
                        "title": "Test Sync Task",
                        "description": "Test task for sync operations."
                    }
                }
            },
            {
                "service_type": ServiceType.INDEX_OPTIMIZATION,
                "operation_type": "optimize_indices",
                "target_id": "manual_trigger",
                "payload": {
                    "triggered_by": "test_script"
                }
            }
        ]
        
        operation_ids = []
        for op in test_operations:
            op_id = await manager.schedule_operation(
                op["service_type"],
                op["operation_type"],
                op["target_id"],
                op["payload"],
                ServicePriority.NORMAL
            )
            operation_ids.append(op_id)
            logger.info(f"Scheduled operation {op['operation_type']} with ID: {op_id}")
        
        # 5. Wait for operations to process
        logger.info("5. Waiting for operations to process")
        
        await asyncio.sleep(5)  # Give operations time to process
        
        # 6. Check final status
        logger.info("6. Checking final status")
        
        final_status = await manager.get_overall_status()
        logger.info(f"Final operations completed: {final_status.get('total_operations_completed', 0)}")
        logger.info(f"Final operations failed: {final_status.get('total_operations_failed', 0)}")
        
        # 7. Test service configuration changes
        logger.info("7. Testing service configuration changes")
        
        # Disable embedding service
        auto_embed_service = manager.services.get(ServiceType.AUTO_EMBEDDING)
        if auto_embed_service:
            auto_embed_service.enabled = False
            logger.info("Disabled auto-embedding service")
        
        # Try to schedule an embedding operation (should log warning)
        await manager.schedule_operation(
            ServiceType.AUTO_EMBEDDING,
            "embed_task",
            "disabled_test",
            {},
            ServicePriority.LOW
        )
        
        await asyncio.sleep(2)
        
        # Re-enable service
        if auto_embed_service:
            auto_embed_service.enabled = True
            logger.info("Re-enabled auto-embedding service")
        
        # 8. Test error handling
        logger.info("8. Testing error handling")
        
        # Schedule an operation with invalid data
        try:
            await manager.schedule_operation(
                ServiceType.AUTO_EMBEDDING,
                "invalid_operation",
                "error_test",
                {"invalid": "data"},
                ServicePriority.NORMAL
            )
            await asyncio.sleep(2)
        except Exception as e:
            logger.info(f"Error handling test completed: {e}")
        
        # 9. Performance metrics
        logger.info("9. Checking performance metrics")
        
        for service_type in ServiceType:
            service_status = await manager.get_service_status(service_type)
            metrics = service_status.get('metrics', {})
            logger.info(
                f"Service {service_type.value}: "
                f"completed={metrics.get('operations_completed', 0)}, "
                f"failed={metrics.get('operations_failed', 0)}, "
                f"avg_time={metrics.get('average_processing_time', 0):.3f}s"
            )
        
        logger.info("Background services test completed successfully")
        return True
        
    except Exception as e:
        logger.error(f"Background services test failed: {e}")
        return False
        
    finally:
        # Clean up
        try:
            await manager.stop()
            logger.info("Background service manager stopped")
        except Exception as e:
            logger.error(f"Error stopping manager: {e}")


async def main():
    """Run all background service tests."""
    logger.info("=" * 60)
    logger.info("VESPERA V2 BACKGROUND SERVICES TEST")
    logger.info("=" * 60)
    
    start_time = time.time()
    
    # Test 1: Basic background services
    logger.info("\n" + "=" * 40)
    logger.info("TEST 1: Basic Background Services")
    logger.info("=" * 40)
    
    test1_success = await test_background_services()
    
    # Summary
    total_time = time.time() - start_time
    
    logger.info("\n" + "=" * 60)
    logger.info("TEST SUMMARY")
    logger.info("=" * 60)
    logger.info(f"Basic Background Services: {'PASS' if test1_success else 'FAIL'}")
    logger.info(f"Total execution time: {total_time:.2f} seconds")
    
    overall_success = test1_success
    logger.info(f"Overall result: {'PASS' if overall_success else 'FAIL'}")
    
    return overall_success


if __name__ == "__main__":
    import sys
    
    try:
        success = asyncio.run(main())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        logger.info("Test interrupted by user")
        sys.exit(130)
    except Exception as e:
        logger.error(f"Test crashed: {e}")
        sys.exit(1)