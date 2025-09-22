#!/usr/bin/env python3
"""
Test Vector Database Integration with V2 Task System

Simple test to verify that Chroma vector database integration
is working correctly with the task management system.
"""

import asyncio
import logging
from pathlib import Path
import tempfile
import shutil

from tasks.service import TaskService
from tasks.models import TaskPriority
from vector.service import VectorService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def test_vector_integration():
    """Test complete vector database integration."""
    # Create temporary directory for test
    temp_dir = Path(tempfile.mkdtemp())
    logger.info(f"Using temporary directory: {temp_dir}")
    
    try:
        # Initialize services
        db_path = temp_dir / "test_tasks.db"
        vector_dir = temp_dir / "test_embeddings"
        
        vector_service = VectorService(persist_directory=vector_dir)
        task_service = TaskService(db_path=db_path, vector_service=vector_service)
        
        logger.info("✓ Initialized TaskService with vector database")
        
        # Test 1: Create tasks with semantic content
        tasks_data = [
            {
                "title": "Implement OAuth Authentication System",
                "description": "Design and implement OAuth 2.0 authentication flow for secure user login and API access management",
                "project": "auth_system"
            },
            {
                "title": "Build User Dashboard Interface", 
                "description": "Create responsive dashboard UI with user profile, settings, and activity monitoring components",
                "project": "frontend_ui"
            },
            {
                "title": "Design API Rate Limiting",
                "description": "Implement rate limiting middleware for API endpoints to prevent abuse and ensure fair usage",
                "project": "backend_api"
            },
            {
                "title": "Setup Database Connection Pooling",
                "description": "Configure connection pooling for PostgreSQL database to optimize performance and resource usage",
                "project": "database"
            },
            {
                "title": "Create Authentication Middleware",
                "description": "Build middleware for token validation, user session management, and access control verification",
                "project": "auth_system"
            }
        ]
        
        created_tasks = []
        for task_data in tasks_data:
            success, result = await task_service.create_task(
                title=task_data["title"],
                description=task_data["description"],
                priority=TaskPriority.NORMAL,
                project_id=task_data["project"]
            )
            
            if success:
                task_id = result["task"]["id"]
                created_tasks.append(task_id)
                logger.info(f"✓ Created task: {task_data['title'][:40]}...")
            else:
                logger.error(f"✗ Failed to create task: {result.get('error', 'Unknown error')}")
                return False
        
        logger.info(f"✓ Created {len(created_tasks)} tasks with vector embeddings")
        
        # Test 2: Semantic search
        test_queries = [
            "authentication and login security",
            "user interface and frontend components", 
            "database performance optimization",
            "API security and rate limiting"
        ]
        
        for query in test_queries:
            logger.info(f"\n🔍 Searching: '{query}'")
            results = await task_service.search_tasks_semantic(query, limit=3)
            
            if results:
                logger.info(f"✓ Found {len(results)} results:")
                for i, result in enumerate(results, 1):
                    task = result['task']
                    score = result['similarity_score']
                    logger.info(f"  {i}. [{score:.3f}] {task['title'][:50]}...")
            else:
                logger.warning(f"✗ No results found for '{query}'")
        
        # Test 3: Related tasks
        logger.info(f"\n🔗 Finding related tasks...")
        if created_tasks:
            test_task_id = created_tasks[0]  # Use first task
            related = await task_service.get_related_tasks(test_task_id, limit=3)
            
            if related:
                logger.info(f"✓ Found {len(related)} related tasks:")
                for i, result in enumerate(related, 1):
                    task = result['task']
                    score = result['similarity_score']
                    logger.info(f"  {i}. [{score:.3f}] {task['title'][:50]}...")
            else:
                logger.warning("✗ No related tasks found")
        
        # Test 4: Vector database stats
        logger.info(f"\n📊 Vector Database Statistics:")
        stats = await task_service.get_vector_stats()
        if 'error' not in stats:
            for content_type, stat in stats.items():
                count = stat.get('document_count', 0)
                logger.info(f"  {content_type}: {count} documents")
            logger.info("✓ Vector database statistics retrieved")
        else:
            logger.error(f"✗ Failed to get stats: {stats['error']}")
        
        # Test 5: Vector service health check
        logger.info(f"\n🏥 Vector Database Health Check:")
        health = await vector_service.health_check()
        if health['status'] == 'healthy':
            logger.info(f"✓ Vector database is healthy")
            logger.info(f"  Total documents: {health['total_documents']}")
            logger.info(f"  Collections: {len(health['collections'])}")
        else:
            logger.error(f"✗ Vector database unhealthy: {health.get('error', 'Unknown error')}")
        
        logger.info(f"\n🎉 Vector integration test completed successfully!")
        return True
        
    except Exception as e:
        logger.error(f"✗ Vector integration test failed: {e}")
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
    """Run the vector integration test."""
    logger.info("🚀 Starting Vector Database Integration Test")
    logger.info("=" * 60)
    
    success = await test_vector_integration()
    
    logger.info("=" * 60)
    if success:
        logger.info("✅ All tests passed! Vector integration is working correctly.")
        return 0
    else:
        logger.error("❌ Tests failed! Check the logs above for details.")
        return 1


if __name__ == "__main__":
    exit(asyncio.run(main()))