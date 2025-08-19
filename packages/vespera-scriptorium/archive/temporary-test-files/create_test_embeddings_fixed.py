#!/usr/bin/env python3
"""
Fixed script to create test embeddings for MCP tool testing.
"""

import asyncio
import sys
import logging
from pathlib import Path

# Add the package to path
sys.path.insert(0, str(Path(__file__).parent))

from databases.chroma_service import ChromaService, ChromaConfig
from databases.triple_db_service import TripleDBService, DatabaseConfig

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def create_embeddings_fixed():
    """Create embeddings properly without premature cleanup."""
    project_root = Path.cwd()
    v2_data_dir = project_root / ".vespera_v2"
    
    try:
        # Initialize services WITHOUT cleanup issues
        db_config = DatabaseConfig(
            data_dir=v2_data_dir,
            sqlite_enabled=True,
            chroma_enabled=False,  # Initialize separately
            kuzu_enabled=False
        )
        
        service = TripleDBService(db_config)
        await service.initialize()
        
        # Get tasks
        tasks = await service.task_service.list_tasks(limit=10)
        logger.info(f"Found {len(tasks)} tasks to embed")
        
        if not tasks:
            logger.warning("No tasks found")
            return
        
        # Initialize Chroma separately
        chroma_config = ChromaConfig(persist_directory=v2_data_dir / "embeddings")
        chroma_service = ChromaService(chroma_config)
        await chroma_service.initialize()
        
        # Create embeddings
        collection = chroma_service.collections["tasks_content"]
        logger.info(f"Collection before embedding: {collection.count()} documents")
        
        embedded_count = 0
        for task in tasks:
            try:
                doc_id = f"task_{task.id}_content"
                document_content = chroma_service._prepare_task_content(task)
                metadata = chroma_service._prepare_task_metadata(task)
                
                # Add to collection
                collection.add(
                    ids=[doc_id],
                    documents=[document_content],
                    metadatas=[metadata]
                )
                embedded_count += 1
                logger.info(f"Embedded task: {task.title}")
                
            except Exception as e:
                logger.error(f"Error embedding task {task.title}: {e}")
        
        logger.info(f"Collection after embedding: {collection.count()} documents")
        logger.info(f"Successfully embedded {embedded_count} tasks")
        
        # Clean up properly
        await chroma_service.cleanup()
        await service.cleanup()
        
    except Exception as e:
        logger.error(f"Error creating embeddings: {e}")


if __name__ == "__main__":
    asyncio.run(create_embeddings_fixed())