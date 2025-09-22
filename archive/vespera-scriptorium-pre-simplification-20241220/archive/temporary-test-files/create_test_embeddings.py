#!/usr/bin/env python3
"""
Script to create test embeddings for MCP tool testing.
"""

import asyncio
import sys
import logging
from pathlib import Path

# Add the package to path
sys.path.insert(0, str(Path(__file__).parent))

from databases.triple_db_service import TripleDBService, DatabaseConfig
from databases.chroma_service import ChromaService, ChromaConfig

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def create_test_embeddings():
    """Create embeddings for the first few tasks for testing."""
    project_root = Path.cwd()
    v2_data_dir = project_root / ".vespera_v2"
    
    try:
        # Initialize services
        db_config = DatabaseConfig(
            data_dir=v2_data_dir,
            sqlite_enabled=True,
            chroma_enabled=True,
            kuzu_enabled=False  # Skip KuzuDB for now
        )
        
        triple_db_service = TripleDBService(db_config)
        await triple_db_service.initialize()
        
        # Get first 10 tasks
        tasks = await triple_db_service.task_service.list_tasks(limit=10)
        logger.info(f"Found {len(tasks)} tasks to embed")
        
        if not tasks:
            logger.warning("No tasks found to embed")
            return
        
        # Initialize ChromaService separately
        chroma_config = ChromaConfig(persist_directory=v2_data_dir / "embeddings")
        chroma_service = ChromaService(chroma_config)
        await chroma_service.initialize()
        
        # Create embeddings for each task
        embedded_count = 0
        for task in tasks:
            try:
                # Use the chroma service to embed the task
                success = await chroma_service.embed_task(task)
                if success:
                    embedded_count += 1
                    logger.info(f"Embedded task: {task.title}")
                else:
                    logger.warning(f"Failed to embed task: {task.title}")
            except Exception as e:
                logger.error(f"Error embedding task {task.title}: {e}")
        
        # Cleanup ChromaService
        await chroma_service.cleanup()
        
        logger.info(f"Successfully embedded {embedded_count} tasks")
        
        # Cleanup
        await triple_db_service.cleanup()
        
    except Exception as e:
        logger.error(f"Error creating test embeddings: {e}")


if __name__ == "__main__":
    asyncio.run(create_test_embeddings())