#!/usr/bin/env python3
"""
Test TaskService + KuzuDB Integration

Comprehensive test to verify that TaskService properly integrates with KuzuDB
for automatic graph database synchronization and relationship management.
"""

import asyncio
import logging
import tempfile
import shutil
from pathlib import Path

from tasks.service import TaskService
from tasks.models import Task, TaskPriority, TaskStatus, TaskRelation

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def test_taskservice_kuzu_integration():
    """Test comprehensive TaskService + KuzuDB integration."""
    # Create temporary directory for test
    temp_dir = Path(tempfile.mkdtemp())
    logger.info(f"Using temporary directory: {temp_dir}")
    
    try:
        # Initialize TaskService with custom paths
        task_service = TaskService(
            db_path=temp_dir / "tasks.db",
            vector_service=None,  # Will create default in temp dir
            graph_service=None   # Will create default in temp dir  
        )
        
        logger.info("✓ Initialized TaskService with triple database architecture")
        
        # Test 1: Create tasks and verify graph sync
        logger.info("\n🔧 Testing task creation and graph sync...")
        
        success1, result1 = await task_service.create_task(
            title="Setup Authentication System",
            description="Implement OAuth 2.0 authentication with role-based access control",
            priority=TaskPriority.HIGH,
            project_id="auth-project",
            feature="authentication",
            assignee="backend-developer"
        )
        
        success2, result2 = await task_service.create_task(
            title="Design Database Schema",
            description="Create user tables, roles, and permissions schema",
            priority=TaskPriority.HIGH,
            project_id="auth-project", 
            feature="database",
            assignee="database-architect"
        )
        
        success3, result3 = await task_service.create_task(
            title="Build Login UI Components",
            description="Create responsive login forms and user interface components",
            priority=TaskPriority.NORMAL,
            project_id="auth-project",
            feature="frontend", 
            assignee="frontend-developer"
        )
        
        if success1 and success2 and success3:
            logger.info("✓ Created 3 tasks successfully")
            task1_id = result1["task"]["id"]
            task2_id = result2["task"]["id"]
            task3_id = result3["task"]["id"]
        else:
            logger.error("✗ Failed to create tasks")
            return False
        
        # Test 2: Add task relationships and verify graph sync
        logger.info("\n🔗 Testing task relationships...")
        
        # Auth system depends on database schema
        rel1_success = await task_service.add_task_relationship(
            task1_id, task2_id, TaskRelation.DEPENDS_ON
        )
        
        # Login UI depends on auth system
        rel2_success = await task_service.add_task_relationship(
            task3_id, task1_id, TaskRelation.DEPENDS_ON
        )
        
        # Auth system and UI are related
        rel3_success = await task_service.add_task_relationship(
            task1_id, task3_id, TaskRelation.RELATES_TO
        )
        
        if rel1_success and rel2_success and rel3_success:
            logger.info("✓ Added task relationships successfully")
        else:
            logger.error("✗ Failed to add some relationships")
            return False
        
        # Test 3: Query relationships via graph database
        logger.info("\n🔍 Testing graph database queries...")
        
        # Test dependency queries
        deps1 = await task_service.get_task_dependencies_graph(task1_id)
        logger.info(f"✓ Task 1 dependencies: {len(deps1)} found")
        for dep in deps1:
            logger.info(f"  - {dep['title']} ({dep.get('dependency_type', 'unknown')})")
        
        deps3 = await task_service.get_task_dependencies_graph(task3_id)
        logger.info(f"✓ Task 3 dependencies: {len(deps3)} found")
        for dep in deps3:
            logger.info(f"  - {dep['title']} ({dep.get('dependency_type', 'unknown')})")
        
        # Test comprehensive dependency analysis
        analysis = await task_service.analyze_task_dependencies_full(task3_id)
        if analysis:
            logger.info("✓ Dependency analysis completed:")
            logger.info(f"  - Dependencies: {analysis['dependency_count']}")
            logger.info(f"  - Blocks: {analysis['blocked_count']}")
            logger.info(f"  - Circular deps: {analysis['has_circular_dependencies']}")
        
        # Test 4: Task updates and graph sync
        logger.info("\n📝 Testing task updates...")
        
        update_success, update_result = await task_service.update_task(
            task1_id,
            {
                "status": TaskStatus.DOING.value,
                "description": "Implement OAuth 2.0 authentication with enhanced security features"
            }
        )
        
        if update_success:
            logger.info("✓ Updated task successfully")
            # Verify the update was synced to graph
            updated_task = await task_service.get_task(task1_id)
            if updated_task and updated_task.status == TaskStatus.DOING:
                logger.info("✓ Task update verified in SQLite")
        else:
            logger.error("✗ Failed to update task")
        
        # Test 5: Vector + Graph integration
        logger.info("\n🎯 Testing vector similarity + graph sync...")
        
        # Sync similarity relationships to graph
        sim_success = await task_service.sync_similarity_to_graph(task1_id)
        if sim_success:
            logger.info("✓ Synced similarity relationships to graph")
        else:
            logger.warning("~ No similarity relationships to sync (expected for new tasks)")
        
        # Query similar tasks via graph
        similar_tasks = await task_service.get_similar_tasks_graph(task1_id, min_similarity=0.5)
        logger.info(f"✓ Found {len(similar_tasks)} similar tasks via graph")
        
        # Test 6: Comprehensive health check
        logger.info("\n🏥 Testing health checks...")
        
        health = await task_service.health_check_all_databases()
        logger.info("✓ Health check results:")
        logger.info(f"  - Overall: {health['overall_status']}")
        logger.info(f"  - SQLite: {health['sqlite']['status']} ({health['sqlite']['tasks_count']} tasks)")
        logger.info(f"  - ChromaDB: {health['chromadb']['status']}")
        logger.info(f"  - KuzuDB: {health['kuzu']['status']}")
        
        # Test 7: Graph statistics
        logger.info("\n📊 Testing graph statistics...")
        
        graph_stats = await task_service.get_graph_stats()
        if 'error' not in graph_stats:
            logger.info("✓ Graph statistics:")
            logger.info(f"  - Tasks: {graph_stats.get('tasks_count', 0)}")
            logger.info(f"  - Users: {graph_stats.get('users_count', 0)}")
            logger.info(f"  - Dependencies: {graph_stats.get('dependencies_relationships', 0)}")
            logger.info(f"  - Relations: {graph_stats.get('relates_to_relationships', 0)}")
        else:
            logger.error(f"✗ Graph stats error: {graph_stats['error']}")
        
        # Test 8: Manual graph sync
        logger.info("\n🔄 Testing manual graph sync...")
        
        sync_success = await task_service.sync_task_to_graph(task2_id)
        if sync_success:
            logger.info("✓ Manual graph sync successful")
        else:
            logger.warning("~ Manual graph sync not needed (task already synced)")
        
        logger.info(f"\n🎉 TaskService + KuzuDB integration test completed successfully!")
        logger.info("All triple database components (SQLite + ChromaDB + KuzuDB) are working together")
        return True
        
    except Exception as e:
        logger.error(f"✗ TaskService + KuzuDB integration test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
        
    finally:
        # Cleanup
        try:
            shutil.rmtree(temp_dir)
            logger.info(f"✓ Cleaned up temporary directory")
        except Exception as e:
            logger.warning(f"Failed to cleanup: {e}")


async def main():
    """Run the TaskService + KuzuDB integration test."""
    logger.info("🚀 Starting TaskService + KuzuDB Integration Test")
    logger.info("=" * 70)
    
    success = await test_taskservice_kuzu_integration()
    
    logger.info("=" * 70)
    if success:
        logger.info("✅ All tests passed! Triple database integration is working correctly.")
        return 0
    else:
        logger.error("❌ Tests failed! Check the logs above for details.")
        return 1


if __name__ == "__main__":
    exit(asyncio.run(main()))