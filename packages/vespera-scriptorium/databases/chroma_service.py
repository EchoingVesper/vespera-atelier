"""
Chroma Vector Database Service for Semantic Search

Specialized service for managing task embeddings and semantic search
using ChromaDB vector database.
"""

import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass

from tasks.models import Task

try:
    import chromadb
    from chromadb.config import Settings
    CHROMA_AVAILABLE = True
except ImportError:
    CHROMA_AVAILABLE = False
    chromadb = None

logger = logging.getLogger(__name__)


@dataclass
class SemanticSearchResult:
    """Result from semantic search query."""
    task_id: str
    title: str
    content: str
    distance: float
    metadata: Dict[str, Any]
    
    @property
    def similarity_score(self) -> float:
        """Convert distance to similarity score (0-1, higher is more similar)."""
        return max(0, 1 - self.distance)


@dataclass
class ChromaConfig:
    """Configuration for Chroma vector database."""
    persist_directory: Path
    embedding_function: str = "sentence-transformers/all-MiniLM-L6-v2"
    distance_metric: str = "cosine"
    
    # HNSW parameters for performance tuning
    hnsw_m: int = 16
    hnsw_ef_construction: int = 200
    hnsw_ef_search: int = 100
    
    # Collection settings
    max_elements: int = 100000
    anonymized_telemetry: bool = False


class ChromaService:
    """
    Service for semantic search and embedding management using ChromaDB.
    
    Provides:
    - Task content embedding and storage
    - Semantic similarity search
    - Code reference embedding
    - Project context embedding
    - Metadata filtering and querying
    """
    
    def __init__(self, config: ChromaConfig):
        """Initialize ChromaDB service."""
        self.config = config
        self.client: Optional[chromadb.Client] = None
        self.collections: Dict[str, Any] = {}
        
        if not CHROMA_AVAILABLE:
            logger.warning("ChromaDB not available. Install chromadb package for semantic search.")
            return
        
        self._initialized = False
        logger.info(f"ChromaService initialized with config: {config}")
    
    async def initialize(self) -> bool:
        """Initialize ChromaDB client and collections."""
        if not CHROMA_AVAILABLE:
            logger.error("ChromaDB package not available")
            return False
        
        try:
            # Ensure directory exists
            self.config.persist_directory.mkdir(parents=True, exist_ok=True)
            
            # Configure ChromaDB settings
            settings = Settings(
                persist_directory=str(self.config.persist_directory),
                anonymized_telemetry=self.config.anonymized_telemetry,
                is_persistent=True
            )
            
            # Initialize client
            self.client = chromadb.Client(settings)
            
            # Initialize collections
            await self._initialize_collections()
            
            self._initialized = True
            logger.info("ChromaDB service initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize ChromaDB service: {e}")
            return False
    
    async def _initialize_collections(self) -> None:
        """Initialize required collections with proper configuration."""
        collections_config = {
            "tasks_content": {
                "description": "Task descriptions and requirement embeddings",
                "metadata": {
                    "hnsw:space": self.config.distance_metric,
                    "hnsw:M": self.config.hnsw_m,
                    "hnsw:ef_construction": self.config.hnsw_ef_construction,
                    "hnsw:ef_search": self.config.hnsw_ef_search,
                    "hnsw:max_elements": self.config.max_elements
                }
            },
            "code_references": {
                "description": "Code snippets and technical documentation embeddings", 
                "metadata": {
                    "hnsw:space": self.config.distance_metric,
                    "hnsw:M": self.config.hnsw_m
                }
            },
            "project_context": {
                "description": "Project-level semantic information and documentation",
                "metadata": {
                    "hnsw:space": self.config.distance_metric,
                    "hnsw:M": self.config.hnsw_m
                }
            }
        }
        
        for collection_name, config in collections_config.items():
            try:
                # Try to get existing collection
                collection = self.client.get_collection(collection_name)
                logger.info(f"Found existing collection: {collection_name}")
            except Exception:
                # Create new collection
                collection = self.client.create_collection(
                    name=collection_name,
                    metadata=config["metadata"]
                )
                logger.info(f"Created new collection: {collection_name}")
            
            self.collections[collection_name] = collection
    
    async def embed_task(self, task: Task) -> bool:
        """Embed task content in vector database."""
        if not self._initialized or "tasks_content" not in self.collections:
            return False
        
        try:
            collection = self.collections["tasks_content"]
            
            # Prepare document content for embedding
            document_content = self._prepare_task_content(task)
            
            # Prepare metadata
            metadata = self._prepare_task_metadata(task)
            
            # Document ID
            doc_id = f"task_{task.id}_content"
            
            # Add or update document
            try:
                # Try to update existing document
                collection.update(
                    ids=[doc_id],
                    documents=[document_content],
                    metadatas=[metadata]
                )
                logger.debug(f"Updated embedding for task {task.id}")
            except Exception:
                # Document doesn't exist, create new one
                collection.add(
                    ids=[doc_id],
                    documents=[document_content],
                    metadatas=[metadata]
                )
                logger.debug(f"Created new embedding for task {task.id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to embed task {task.id}: {e}")
            return False
    
    async def remove_task_embedding(self, task_id: str) -> bool:
        """Remove task embedding from vector database."""
        if not self._initialized or "tasks_content" not in self.collections:
            return False
        
        try:
            collection = self.collections["tasks_content"]
            doc_id = f"task_{task_id}_content"
            
            collection.delete(ids=[doc_id])
            logger.debug(f"Removed embedding for task {task_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to remove embedding for task {task_id}: {e}")
            return False
    
    async def semantic_search(self, 
                            query: str,
                            n_results: int = 10,
                            filters: Optional[Dict[str, Any]] = None,
                            min_similarity: float = 0.0) -> List[SemanticSearchResult]:
        """
        Perform semantic search on task content.
        
        Args:
            query: Search query text
            n_results: Maximum number of results to return
            filters: Metadata filters (e.g., {"status": "todo", "priority": "high"})
            min_similarity: Minimum similarity score (0-1)
        
        Returns:
            List of semantic search results sorted by similarity
        """
        if not self._initialized or "tasks_content" not in self.collections:
            return []
        
        try:
            collection = self.collections["tasks_content"]
            
            # Perform vector search
            results = collection.query(
                query_texts=[query],
                n_results=n_results,
                where=filters,
                include=["documents", "metadatas", "distances"]
            )
            
            # Process results
            search_results = []
            
            if results["ids"] and len(results["ids"]) > 0:
                ids = results["ids"][0]
                documents = results["documents"][0] if results["documents"] else []
                metadatas = results["metadatas"][0] if results["metadatas"] else []
                distances = results["distances"][0] if results["distances"] else []
                
                for i in range(len(ids)):
                    # Extract task ID from document ID
                    doc_id = ids[i]
                    if not doc_id.startswith("task_") or not doc_id.endswith("_content"):
                        continue
                    
                    task_id = doc_id[5:-8]  # Remove "task_" prefix and "_content" suffix
                    
                    # Check minimum similarity
                    distance = distances[i] if i < len(distances) else 1.0
                    similarity = max(0, 1 - distance)
                    
                    if similarity < min_similarity:
                        continue
                    
                    # Create result object
                    result = SemanticSearchResult(
                        task_id=task_id,
                        title=metadatas[i].get("title", "") if i < len(metadatas) else "",
                        content=documents[i] if i < len(documents) else "",
                        distance=distance,
                        metadata=metadatas[i] if i < len(metadatas) else {}
                    )
                    
                    search_results.append(result)
            
            # Sort by similarity (highest first)
            search_results.sort(key=lambda r: r.similarity_score, reverse=True)
            
            logger.debug(f"Semantic search for '{query}' returned {len(search_results)} results")
            return search_results
            
        except Exception as e:
            logger.error(f"Semantic search failed: {e}")
            return []
    
    async def find_similar_tasks(self, 
                               task_id: str, 
                               n_results: int = 5,
                               min_similarity: float = 0.5) -> List[SemanticSearchResult]:
        """
        Find tasks similar to a given task using its embedding.
        
        Args:
            task_id: ID of the reference task
            n_results: Maximum number of similar tasks to return
            min_similarity: Minimum similarity score (0-1)
        
        Returns:
            List of similar tasks sorted by similarity
        """
        if not self._initialized or "tasks_content" not in self.collections:
            return []
        
        try:
            collection = self.collections["tasks_content"]
            doc_id = f"task_{task_id}_content"
            
            # Get the reference task's document
            reference_doc = collection.get(ids=[doc_id], include=["documents"])
            
            if not reference_doc["documents"] or not reference_doc["documents"][0]:
                logger.warning(f"No embedding found for task {task_id}")
                return []
            
            reference_content = reference_doc["documents"][0][0]
            
            # Search for similar documents
            results = await self.semantic_search(
                query=reference_content,
                n_results=n_results + 1,  # +1 because result will include the reference task
                min_similarity=min_similarity
            )
            
            # Filter out the reference task itself
            similar_tasks = [r for r in results if r.task_id != task_id]
            
            logger.debug(f"Found {len(similar_tasks)} tasks similar to {task_id}")
            return similar_tasks[:n_results]
            
        except Exception as e:
            logger.error(f"Failed to find similar tasks for {task_id}: {e}")
            return []
    
    async def embed_code_reference(self, 
                                 task_id: str,
                                 file_path: str,
                                 code_content: str,
                                 function_name: Optional[str] = None,
                                 language: str = "python") -> bool:
        """Embed code reference for task."""
        if not self._initialized or "code_references" not in self.collections:
            return False
        
        try:
            collection = self.collections["code_references"]
            
            # Prepare document content
            document_content = f"File: {file_path}\n"
            if function_name:
                document_content += f"Function: {function_name}\n"
            document_content += f"\n{code_content}"
            
            # Prepare metadata
            metadata = {
                "task_id": task_id,
                "file_path": file_path,
                "language": language,
                "function_name": function_name or "",
                "embedded_at": datetime.now().isoformat()
            }
            
            # Document ID (support multiple code refs per task)
            import hashlib
            content_hash = hashlib.md5(f"{file_path}_{function_name}".encode()).hexdigest()[:8]
            doc_id = f"task_{task_id}_code_{content_hash}"
            
            # Add document
            collection.add(
                ids=[doc_id],
                documents=[document_content],
                metadatas=[metadata]
            )
            
            logger.debug(f"Embedded code reference for task {task_id}: {file_path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to embed code reference for task {task_id}: {e}")
            return False
    
    def _prepare_task_content(self, task: Task) -> str:
        """Prepare task content for embedding."""
        content_parts = [task.title]
        
        if task.description:
            content_parts.append(task.description)
        
        # Add relevant metadata
        if task.metadata.tags:
            content_parts.append(f"Tags: {', '.join(task.metadata.tags)}")
        
        if task.metadata.source_references:
            content_parts.append(f"References: {', '.join(task.metadata.source_references)}")
        
        if task.metadata.estimated_effort:
            content_parts.append(f"Effort: {task.metadata.estimated_effort}")
        
        return "\n\n".join(content_parts)
    
    def _prepare_task_metadata(self, task: Task) -> Dict[str, Any]:
        """Prepare task metadata for Chroma storage."""
        metadata = {
            "task_id": task.id,
            "title": task.title,
            "project_id": task.project_id or "",
            "parent_task_id": task.parent_id or "",
            "feature": task.feature or "",
            "status": task.status.value,
            "priority": task.priority.value,
            "created_at": task.created_at.isoformat(),
            "updated_at": task.updated_at.isoformat(),
            "complexity": task.metadata.complexity,
            "estimated_effort": task.metadata.estimated_effort or "",
            "assignee": task.assignee,
            "assigned_role": task.execution.assigned_role or "",
            "embedding_version": task.triple_db.embedding_version,
            "embedded_at": datetime.now().isoformat()
        }
        
        # Add tags as separate fields for filtering
        for i, tag in enumerate(task.metadata.tags[:5]):  # Limit to 5 tags
            metadata[f"tag_{i}"] = tag
        
        # Add due date if exists
        if task.due_date:
            metadata["due_date"] = task.due_date.isoformat()
        
        return metadata
    
    async def get_collection_stats(self) -> Dict[str, Any]:
        """Get statistics about Chroma collections."""
        if not self._initialized:
            return {"error": "Service not initialized"}
        
        stats = {
            "initialized": self._initialized,
            "collections": {}
        }
        
        for name, collection in self.collections.items():
            try:
                count = collection.count()
                stats["collections"][name] = {
                    "document_count": count,
                    "name": name
                }
            except Exception as e:
                stats["collections"][name] = {"error": str(e)}
        
        return stats
    
    async def cleanup(self) -> None:
        """Clean up ChromaDB resources."""
        self.collections.clear()
        self.client = None
        self._initialized = False
        logger.info("ChromaDB service cleaned up")