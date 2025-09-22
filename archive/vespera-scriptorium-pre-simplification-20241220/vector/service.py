"""
Vector Database Service for Vespera V2 Triple Database System

Provides Chroma vector database integration for semantic search and retrieval
across tasks, documents, and code artifacts. Integrates with the triple database
coordination system for synchronized updates.
"""

import logging
from typing import Dict, List, Optional, Any, Set, Tuple
from pathlib import Path
from datetime import datetime
import hashlib
import asyncio

import chromadb
from chromadb.config import Settings
from chromadb.utils import embedding_functions

logger = logging.getLogger(__name__)


class VectorService:
    """
    Vector database service using ChromaDB for semantic search and embeddings.
    
    Provides high-level interface for task and document vectorization with
    automatic embedding generation and similarity search capabilities.
    """
    
    def __init__(self, persist_directory: Optional[Path] = None):
        """Initialize vector service with ChromaDB."""
        self.persist_directory = persist_directory or Path.cwd() / ".vespera_v2" / "embeddings"
        self.persist_directory.mkdir(parents=True, exist_ok=True)
        
        # Initialize ChromaDB with persistent storage
        self.chroma_client = chromadb.PersistentClient(
            path=str(self.persist_directory),
            settings=Settings(
                anonymized_telemetry=False,
                allow_reset=True
            )
        )
        
        # Use default embedding function (sentence-transformers)
        # This can be upgraded to OpenAI embeddings or custom models later
        self.embedding_function = embedding_functions.DefaultEmbeddingFunction()
        
        # Collection names for different content types
        self.collections = {
            'tasks': 'vespera_tasks',
            'documents': 'vespera_documents',
            'code': 'vespera_code',
            'knowledge': 'vespera_knowledge'
        }
        
        # Initialize collections
        self._init_collections()
        
        logger.info(f"Vector service initialized with persist directory: {self.persist_directory}")
    
    def _init_collections(self) -> None:
        """Initialize ChromaDB collections for different content types."""
        for content_type, collection_name in self.collections.items():
            try:
                collection = self.chroma_client.get_or_create_collection(
                    name=collection_name,
                    embedding_function=self.embedding_function,
                    metadata={"content_type": content_type}
                )
                logger.info(f"Initialized {content_type} collection: {collection_name}")
            except Exception as e:
                logger.error(f"Failed to initialize {content_type} collection: {e}")
                raise
    
    def _generate_content_hash(self, content: str) -> str:
        """Generate SHA256 hash of content for change detection."""
        return hashlib.sha256(content.encode('utf-8')).hexdigest()
    
    async def embed_task(self, 
                        task_id: str, 
                        title: str, 
                        description: str, 
                        metadata: Optional[Dict[str, Any]] = None) -> str:
        """
        Embed a task in the vector database for semantic search.
        
        Args:
            task_id: Unique task identifier
            title: Task title
            description: Task description
            metadata: Additional task metadata
            
        Returns:
            Embedding ID for the task
        """
        try:
            # Combine title and description for embedding
            content = f"{title}\n\n{description}"
            content_hash = self._generate_content_hash(content)
            
            # Prepare metadata
            task_metadata = {
                "task_id": task_id,
                "title": title,
                "content_hash": content_hash,
                "embedded_at": datetime.utcnow().isoformat(),
                "content_type": "task",
                **(metadata or {})
            }
            
            # Get tasks collection
            collection = self.chroma_client.get_collection(self.collections['tasks'])
            
            # Check if task already exists
            existing = collection.get(ids=[task_id])
            if existing['ids']:
                # Update existing task
                collection.update(
                    ids=[task_id],
                    documents=[content],
                    metadatas=[task_metadata]
                )
                logger.debug(f"Updated task embedding: {task_id}")
            else:
                # Add new task
                collection.add(
                    ids=[task_id],
                    documents=[content],
                    metadatas=[task_metadata]
                )
                logger.debug(f"Added task embedding: {task_id}")
            
            return task_id
            
        except Exception as e:
            logger.error(f"Failed to embed task {task_id}: {e}")
            raise
    
    async def embed_document(self, 
                            document_id: str, 
                            content: str, 
                            metadata: Optional[Dict[str, Any]] = None) -> str:
        """
        Embed a document in the vector database.
        
        Args:
            document_id: Unique document identifier
            content: Document content
            metadata: Additional document metadata
            
        Returns:
            Embedding ID for the document
        """
        try:
            content_hash = self._generate_content_hash(content)
            
            # Prepare metadata
            doc_metadata = {
                "document_id": document_id,
                "content_hash": content_hash,
                "embedded_at": datetime.utcnow().isoformat(),
                "content_type": "document",
                **(metadata or {})
            }
            
            # Get documents collection
            collection = self.chroma_client.get_collection(self.collections['documents'])
            
            # Check if document already exists
            existing = collection.get(ids=[document_id])
            if existing['ids']:
                collection.update(
                    ids=[document_id],
                    documents=[content],
                    metadatas=[doc_metadata]
                )
                logger.debug(f"Updated document embedding: {document_id}")
            else:
                collection.add(
                    ids=[document_id],
                    documents=[content],
                    metadatas=[doc_metadata]
                )
                logger.debug(f"Added document embedding: {document_id}")
            
            return document_id
            
        except Exception as e:
            logger.error(f"Failed to embed document {document_id}: {e}")
            raise
    
    async def search_tasks(self, 
                          query: str, 
                          limit: int = 10,
                          filter_metadata: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Search for tasks using semantic similarity.
        
        Args:
            query: Search query text
            limit: Maximum number of results
            filter_metadata: Metadata filters for results
            
        Returns:
            List of matching tasks with similarity scores
        """
        try:
            collection = self.chroma_client.get_collection(self.collections['tasks'])
            
            # Perform similarity search
            results = collection.query(
                query_texts=[query],
                n_results=limit,
                where=filter_metadata
            )
            
            # Format results
            matches = []
            if results['ids'] and results['ids'][0]:
                for i, task_id in enumerate(results['ids'][0]):
                    matches.append({
                        'id': task_id,
                        'score': 1.0 - results['distances'][0][i],  # Convert distance to similarity
                        'metadata': results['metadatas'][0][i] if results['metadatas'] else {},
                        'content': results['documents'][0][i] if results['documents'] else ""
                    })
            
            logger.debug(f"Task search for '{query}' returned {len(matches)} results")
            return matches
            
        except Exception as e:
            logger.error(f"Failed to search tasks: {e}")
            raise
    
    async def search_documents(self, 
                              query: str, 
                              limit: int = 10,
                              filter_metadata: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Search for documents using semantic similarity.
        
        Args:
            query: Search query text
            limit: Maximum number of results
            filter_metadata: Metadata filters for results
            
        Returns:
            List of matching documents with similarity scores
        """
        try:
            collection = self.chroma_client.get_collection(self.collections['documents'])
            
            results = collection.query(
                query_texts=[query],
                n_results=limit,
                where=filter_metadata
            )
            
            # Format results
            matches = []
            if results['ids'] and results['ids'][0]:
                for i, doc_id in enumerate(results['ids'][0]):
                    matches.append({
                        'id': doc_id,
                        'score': 1.0 - results['distances'][0][i],
                        'metadata': results['metadatas'][0][i] if results['metadatas'] else {},
                        'content': results['documents'][0][i] if results['documents'] else ""
                    })
            
            logger.debug(f"Document search for '{query}' returned {len(matches)} results")
            return matches
            
        except Exception as e:
            logger.error(f"Failed to search documents: {e}")
            raise
    
    async def get_related_tasks(self, 
                               task_id: str, 
                               limit: int = 5) -> List[Dict[str, Any]]:
        """
        Find tasks related to a given task using vector similarity.
        
        Args:
            task_id: Source task ID
            limit: Maximum number of related tasks to return
            
        Returns:
            List of related tasks with similarity scores
        """
        try:
            collection = self.chroma_client.get_collection(self.collections['tasks'])
            
            # Get the source task content
            source_task = collection.get(ids=[task_id], include=['documents'])
            if not source_task['ids']:
                logger.warning(f"Task {task_id} not found in vector database")
                return []
            
            source_content = source_task['documents'][0]
            
            # Search for similar tasks, excluding the source task itself
            results = collection.query(
                query_texts=[source_content],
                n_results=limit + 1,  # Get one extra to account for self-match
                where={"task_id": {"$ne": task_id}}  # Exclude source task
            )
            
            # Format results
            related = []
            if results['ids'] and results['ids'][0]:
                for i, related_id in enumerate(results['ids'][0][:limit]):  # Limit results
                    related.append({
                        'id': related_id,
                        'score': 1.0 - results['distances'][0][i],
                        'metadata': results['metadatas'][0][i] if results['metadatas'] else {},
                        'content': results['documents'][0][i] if results['documents'] else ""
                    })
            
            logger.debug(f"Found {len(related)} related tasks for {task_id}")
            return related
            
        except Exception as e:
            logger.error(f"Failed to find related tasks for {task_id}: {e}")
            raise
    
    async def remove_task(self, task_id: str) -> bool:
        """
        Remove a task from the vector database.
        
        Args:
            task_id: Task ID to remove
            
        Returns:
            True if removed successfully
        """
        try:
            collection = self.chroma_client.get_collection(self.collections['tasks'])
            
            # Check if task exists
            existing = collection.get(ids=[task_id])
            if not existing['ids']:
                logger.warning(f"Task {task_id} not found in vector database")
                return False
            
            # Remove task
            collection.delete(ids=[task_id])
            logger.debug(f"Removed task embedding: {task_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to remove task {task_id}: {e}")
            raise
    
    async def remove_document(self, document_id: str) -> bool:
        """
        Remove a document from the vector database.
        
        Args:
            document_id: Document ID to remove
            
        Returns:
            True if removed successfully
        """
        try:
            collection = self.chroma_client.get_collection(self.collections['documents'])
            
            # Check if document exists
            existing = collection.get(ids=[document_id])
            if not existing['ids']:
                logger.warning(f"Document {document_id} not found in vector database")
                return False
            
            # Remove document
            collection.delete(ids=[document_id])
            logger.debug(f"Removed document embedding: {document_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to remove document {document_id}: {e}")
            raise
    
    async def get_collection_stats(self) -> Dict[str, Dict[str, Any]]:
        """
        Get statistics about all vector collections.
        
        Returns:
            Dictionary with collection names and their stats
        """
        try:
            stats = {}
            
            for content_type, collection_name in self.collections.items():
                collection = self.chroma_client.get_collection(collection_name)
                count = collection.count()
                
                stats[content_type] = {
                    'collection_name': collection_name,
                    'document_count': count,
                    'embedding_function': str(type(self.embedding_function).__name__)
                }
            
            logger.debug(f"Retrieved collection stats: {stats}")
            return stats
            
        except Exception as e:
            logger.error(f"Failed to get collection stats: {e}")
            raise
    
    async def health_check(self) -> Dict[str, Any]:
        """
        Perform health check on the vector database.
        
        Returns:
            Health status information
        """
        try:
            # Basic connectivity test
            heartbeat = self.chroma_client.heartbeat()
            
            # Get collection counts
            stats = await self.get_collection_stats()
            
            # Calculate total documents
            total_docs = sum(stat['document_count'] for stat in stats.values())
            
            return {
                'status': 'healthy',
                'heartbeat': heartbeat,
                'persist_directory': str(self.persist_directory),
                'collections': stats,
                'total_documents': total_docs,
                'embedding_function': str(type(self.embedding_function).__name__)
            }
            
        except Exception as e:
            logger.error(f"Vector database health check failed: {e}")
            return {
                'status': 'unhealthy',
                'error': str(e),
                'persist_directory': str(self.persist_directory)
            }
    
    def reset_database(self) -> bool:
        """
        Reset the entire vector database. Use with caution!
        
        Returns:
            True if reset successfully
        """
        try:
            logger.warning("Resetting vector database - all embeddings will be lost!")
            self.chroma_client.reset()
            self._init_collections()
            logger.info("Vector database reset completed")
            return True
            
        except Exception as e:
            logger.error(f"Failed to reset vector database: {e}")
            raise