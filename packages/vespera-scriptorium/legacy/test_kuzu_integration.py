#!/usr/bin/env python3
"""
Test KuzuDB Graph Database Integration

Simple test to verify that KuzuDB integration is working correctly
with the task management system and can create nodes and relationships.
"""

import asyncio
import logging
import tempfile
import shutil
from pathlib import Path

from graph.service import KuzuService
from tasks.models import Task, TaskPriority, TaskStatus, TaskRelation, TaskMetadata

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def test_kuzu_integration():
    """Test comprehensive KuzuDB integration."""
    # Create temporary directory for test
    temp_dir = Path(tempfile.mkdtemp())
    logger.info(f"Using temporary directory: {temp_dir}")
    
    try:
        # Initialize KuzuService
        graph_dir = temp_dir / "test_graph.kuzu"
        kuzu_service = KuzuService(db_path=graph_dir)
        
        logger.info("✓ Initialized KuzuService with schema")
        
        # Test 1: Create sample tasks
        task1 = Task(
            id="test-task-1",
            title="Implement Authentication System",
            description="Build OAuth 2.0 authentication for secure user access",
            priority=TaskPriority.HIGH,
            status=TaskStatus.TODO,
            project_id="auth-project",
            assignee="developer",
            creator="architect"
        )
        
        task2 = Task(
            id="test-task-2", 
            title="Design User Database Schema",
            description="Create database tables for user management and profiles",
            priority=TaskPriority.HIGH,
            status=TaskStatus.TODO,
            project_id="auth-project",
            assignee="architect",
            creator="product-manager"
        )
        
        task3 = Task(
            id="test-task-3",
            title="Implement Login UI Components", 
            description="Create responsive login forms and authentication UI",
            priority=TaskPriority.NORMAL,
            status=TaskStatus.TODO,
            project_id="auth-project", 
            assignee="frontend-dev",
            creator="ux-designer"
        )
        
        # Test 2: Add task nodes to graph
        logger.info("\n🔧 Adding task nodes to graph...")
        
        success1 = await kuzu_service.add_task_node(task1)
        success2 = await kuzu_service.add_task_node(task2) 
        success3 = await kuzu_service.add_task_node(task3)
        
        if success1 and success2 and success3:
            logger.info("✓ Successfully added 3 task nodes")
        else:
            logger.error("✗ Failed to add some task nodes")
            return False
        
        # Test 3: Add user nodes
        logger.info("\n👥 Adding user nodes...")
        
        user_success = await kuzu_service.add_user_node(
            username="developer",
            full_name="Jane Developer",
            email="jane@example.com",
            role="developer",
            user_type="human"
        )
        
        if user_success:
            logger.info("✓ Added user node successfully")
        else:
            logger.error("✗ Failed to add user node")
        
        # Test 4: Add task relationships
        logger.info("\n🔗 Adding task relationships...")
        
        # Task 1 depends on Task 2 (auth system depends on database schema)
        dep_success = await kuzu_service.add_task_relationship(
            "test-task-1", "test-task-2",
            TaskRelation.DEPENDS_ON,
            {"dependency_type": "hard"}
        )
        
        # Task 3 depends on Task 1 (UI depends on auth system)
        dep_success2 = await kuzu_service.add_task_relationship(
            "test-task-3", "test-task-1", 
            TaskRelation.DEPENDS_ON,
            {"dependency_type": "hard"}
        )
        
        # Task 1 and Task 3 are related (both part of auth feature)
        rel_success = await kuzu_service.add_task_relationship(
            "test-task-1", "test-task-3",
            TaskRelation.RELATES_TO,
            {"relationship_type": "complementary", "strength": 0.8}
        )
        
        if dep_success and dep_success2 and rel_success:
            logger.info("✓ Added task relationships successfully")
        else:
            logger.error("✗ Failed to add some relationships")
        
        # Test 5: Add similarity relationship
        logger.info("\n🎯 Adding semantic similarity...")
        
        sim_success = await kuzu_service.add_similarity_relationship(
            "test-task-1", "test-task-3",
            similarity_score=0.75,
            content_type="description",
            vector_model="test_model"
        )
        
        if sim_success:
            logger.info("✓ Added similarity relationship")
        else:
            logger.error("✗ Failed to add similarity relationship")
        
        # Test 6: Query task dependencies
        logger.info("\n🔍 Testing dependency queries...")
        
        deps = await kuzu_service.get_task_dependencies("test-task-1")
        logger.info(f"✓ Task 1 dependencies: {len(deps)} found")
        for dep in deps:
            logger.info(f"  - {dep['title']} ({dep['dependency_type']})")
        
        deps3 = await kuzu_service.get_task_dependencies("test-task-3")
        logger.info(f"✓ Task 3 dependencies: {len(deps3)} found") 
        for dep in deps3:
            logger.info(f"  - {dep['title']} ({dep['dependency_type']})")
        
        # Test 7: Query similar tasks
        logger.info("\n🔄 Testing similarity queries...")
        
        similar = await kuzu_service.get_similar_tasks("test-task-1", min_similarity=0.7)
        logger.info(f"✓ Similar tasks to Task 1: {len(similar)} found")
        for sim in similar:
            logger.info(f"  - {sim['title']} ({sim['similarity_score']:.3f})")
        
        # Test 8: Analyze dependency chain
        logger.info("\n📊 Testing dependency analysis...")
        
        analysis = await kuzu_service.analyze_dependency_chain("test-task-3")
        if analysis:
            logger.info("✓ Dependency chain analysis:")
            logger.info(f"  - Dependencies: {analysis['dependency_count']}")
            logger.info(f"  - Blocks: {analysis['blocked_count']}")
            logger.info(f"  - Circular deps: {analysis['has_circular_dependencies']}")
        
        # Test 9: Get graph statistics
        logger.info("\n📈 Getting graph statistics...")
        
        stats = await kuzu_service.get_graph_stats()
        if 'error' not in stats:
            logger.info("✓ Graph statistics:")
            logger.info(f"  - Tasks: {stats.get('tasks_count', 0)}")
            logger.info(f"  - Users: {stats.get('users_count', 0)}") 
            logger.info(f"  - Dependencies: {stats.get('dependencies_relationships', 0)}")
            logger.info(f"  - Relations: {stats.get('relates_to_relationships', 0)}")
            logger.info(f"  - Similarities: {stats.get('similar_content_relationships', 0)}")
        else:
            logger.error(f"✗ Failed to get stats: {stats['error']}")
        
        # Test 10: Health check
        logger.info("\n🏥 Testing health check...")
        
        health = await kuzu_service.health_check()
        if health['status'] == 'healthy':
            logger.info("✓ Graph database is healthy")
            logger.info(f"  - Total nodes: {health['total_nodes']}")
            logger.info(f"  - Database path: {health['database_path']}")
        else:
            logger.error(f"✗ Health check failed: {health.get('error', 'Unknown')}")
        
        logger.info(f"\n🎉 KuzuDB integration test completed successfully!")
        return True
        
    except Exception as e:
        logger.error(f"✗ KuzuDB integration test failed: {e}")
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
    """Run the KuzuDB integration test."""
    logger.info("🚀 Starting KuzuDB Graph Database Integration Test")
    logger.info("=" * 60)
    
    success = await test_kuzu_integration()
    
    logger.info("=" * 60)
    if success:
        logger.info("✅ All tests passed! KuzuDB integration is working correctly.")
        return 0
    else:
        logger.error("❌ Tests failed! Check the logs above for details.")
        return 1


if __name__ == "__main__":
    exit(asyncio.run(main()))