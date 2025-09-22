"""
RAG Service for Vespera V2

Main orchestrator for Retrieval-Augmented Generation capabilities,
integrating document indexing, semantic search, and hallucination detection.
"""

import logging
import asyncio
from typing import Dict, List, Optional, Any, Union, Tuple
from datetime import datetime
from pathlib import Path
import json
import hashlib

from tasks.service import TaskService
from vector.service import VectorService
from graph.service import KuzuService

logger = logging.getLogger(__name__)


class RAGService:
    """
    Main RAG service integrating document indexing, semantic search, and code analysis.
    
    Builds on the triple database architecture (SQLite + ChromaDB + KuzuDB) to provide
    comprehensive knowledge management and retrieval capabilities.
    """
    
    def __init__(self, 
                 task_service: Optional[TaskService] = None,
                 vector_service: Optional[VectorService] = None,
                 graph_service: Optional[KuzuService] = None,
                 rag_data_path: Optional[Path] = None):
        """Initialize RAG service with database services."""
        
        self.rag_data_path = rag_data_path or Path.cwd() / ".vespera_v2" / "rag"
        self.rag_data_path.mkdir(parents=True, exist_ok=True)
        
        # Use existing services or create new ones
        if task_service:
            self.task_service = task_service
            self.vector_service = task_service.vector_service
            self.graph_service = task_service.graph_service
        else:
            # Initialize services independently
            db_dir = self.rag_data_path.parent
            
            if vector_service:
                self.vector_service = vector_service
            else:
                self.vector_service = VectorService(persist_directory=db_dir / "embeddings")
            
            if graph_service:
                self.graph_service = graph_service
            else:
                self.graph_service = KuzuService(db_path=db_dir / "graph.kuzu")
            
            self.task_service = None
        
        # Initialize document tracking
        self.documents_index = self.rag_data_path / "documents.json"
        self.documents = self._load_documents_index()
        
        logger.info(f"RAG service initialized with data path: {self.rag_data_path}")
    
    def _load_documents_index(self) -> Dict[str, Dict[str, Any]]:
        """Load document index from storage."""
        if self.documents_index.exists():
            try:
                with open(self.documents_index, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Failed to load documents index: {e}")
        return {}
    
    def _save_documents_index(self) -> bool:
        """Save document index to storage."""
        try:
            with open(self.documents_index, 'w', encoding='utf-8') as f:
                json.dump(self.documents, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            logger.error(f"Failed to save documents index: {e}")
            return False
    
    def _calculate_content_hash(self, content: str) -> str:
        """Calculate SHA256 hash of content."""
        return hashlib.sha256(content.encode('utf-8')).hexdigest()
    
    # Document Management
    
    async def index_document(self,
                           document_id: str,
                           title: str,
                           content: str,
                           document_type: str = "text",
                           source_path: Optional[str] = None,
                           metadata: Optional[Dict[str, Any]] = None) -> Tuple[bool, Dict[str, Any]]:
        """
        Index a document into the RAG system.
        
        Args:
            document_id: Unique identifier for the document
            title: Document title
            content: Document content
            document_type: Type (text, code, markdown, etc.)
            source_path: Original file path if applicable
            metadata: Additional metadata
            
        Returns:
            Tuple of (success, result_dict)
        """
        try:
            if not document_id or not content.strip():
                return False, {"error": "Document ID and content are required"}
            
            content_hash = self._calculate_content_hash(content)
            now = datetime.now()
            
            # Check if document exists and hasn't changed
            if document_id in self.documents:
                existing_doc = self.documents[document_id]
                if existing_doc.get('content_hash') == content_hash:
                    logger.info(f"Document {document_id} unchanged, skipping reindex")
                    return True, {"document_id": document_id, "status": "unchanged"}
            
            # Chunk content for better retrieval
            chunks = await self._chunk_document(content, title, document_type)
            
            # Store in vector database
            vector_success = True
            chunk_ids = []
            
            for i, chunk in enumerate(chunks):
                chunk_id = f"{document_id}_chunk_{i}"
                chunk_metadata = {
                    "document_id": document_id,
                    "title": title,
                    "document_type": document_type,
                    "chunk_index": i,
                    "total_chunks": len(chunks),
                    "source_path": source_path or "",
                    "content_hash": content_hash,
                    "indexed_at": now.isoformat()
                }
                
                if metadata:
                    chunk_metadata.update(metadata)
                
                try:
                    await self.vector_service.embed_document(
                        document_id=chunk_id,
                        content=chunk['content'],
                        metadata=chunk_metadata
                    )
                    chunk_ids.append(chunk_id)
                except Exception as e:
                    logger.warning(f"Failed to embed chunk {chunk_id}: {e}")
                    vector_success = False
            
            # Store in graph database
            graph_success = True
            try:
                await self._add_document_to_graph(
                    document_id, title, content, document_type, 
                    source_path, metadata, content_hash
                )
            except Exception as e:
                logger.warning(f"Failed to add document to graph: {e}")
                graph_success = False
            
            # Update document index
            self.documents[document_id] = {
                "title": title,
                "document_type": document_type,
                "source_path": source_path,
                "content_hash": content_hash,
                "chunk_count": len(chunks),
                "chunk_ids": chunk_ids,
                "indexed_at": now.isoformat(),
                "updated_at": now.isoformat(),
                "metadata": metadata or {},
                "vector_indexed": vector_success,
                "graph_indexed": graph_success
            }
            
            self._save_documents_index()
            
            status = "indexed"
            if not vector_success and not graph_success:
                status = "failed"
            elif not vector_success or not graph_success:
                status = "partial"
            
            logger.info(f"Indexed document {document_id} with {len(chunks)} chunks")
            return True, {
                "document_id": document_id,
                "status": status,
                "chunks": len(chunks),
                "vector_indexed": vector_success,
                "graph_indexed": graph_success
            }
            
        except Exception as e:
            logger.error(f"Failed to index document {document_id}: {e}")
            return False, {"error": str(e)}
    
    async def _chunk_document(self, content: str, title: str, document_type: str) -> List[Dict[str, Any]]:
        """
        Intelligent document chunking based on content type and structure.
        
        Inspired by crawl4ai-rag's Context 7 approach for meaningful chunks.
        """
        chunks = []
        
        if document_type == "code":
            # Code-specific chunking
            chunks = await self._chunk_code_content(content, title)
        elif document_type == "markdown":
            # Markdown-specific chunking by headers
            chunks = await self._chunk_markdown_content(content, title)
        else:
            # General text chunking
            chunks = await self._chunk_text_content(content, title)
        
        return chunks if chunks else [{"content": content, "context": title}]
    
    async def _chunk_code_content(self, content: str, title: str) -> List[Dict[str, Any]]:
        """Chunk code content by functions, classes, and logical blocks."""
        chunks = []
        lines = content.split('\n')
        current_chunk = []
        current_context = title
        chunk_size = 0
        max_chunk_size = 1000  # characters
        
        for line in lines:
            line_stripped = line.strip()
            
            # Detect function/class definitions
            if (line_stripped.startswith('def ') or 
                line_stripped.startswith('class ') or
                line_stripped.startswith('async def ')):
                
                # Save previous chunk if it exists
                if current_chunk and chunk_size > 100:
                    chunks.append({
                        "content": '\n'.join(current_chunk),
                        "context": current_context,
                        "type": "code_block"
                    })
                
                # Start new chunk
                current_chunk = [line]
                current_context = f"{title} - {line_stripped.split('(')[0]}"
                chunk_size = len(line)
            else:
                current_chunk.append(line)
                chunk_size += len(line) + 1  # +1 for newline
                
                # Split if chunk gets too large
                if chunk_size > max_chunk_size:
                    chunks.append({
                        "content": '\n'.join(current_chunk),
                        "context": current_context,
                        "type": "code_block"
                    })
                    current_chunk = []
                    chunk_size = 0
        
        # Add final chunk
        if current_chunk:
            chunks.append({
                "content": '\n'.join(current_chunk),
                "context": current_context,
                "type": "code_block"
            })
        
        return chunks
    
    async def _chunk_markdown_content(self, content: str, title: str) -> List[Dict[str, Any]]:
        """Chunk markdown content by headers and sections."""
        chunks = []
        lines = content.split('\n')
        current_chunk = []
        current_context = title
        
        for line in lines:
            if line.startswith('#'):
                # Save previous section
                if current_chunk:
                    chunks.append({
                        "content": '\n'.join(current_chunk),
                        "context": current_context,
                        "type": "markdown_section"
                    })
                
                # Start new section
                header_text = line.lstrip('#').strip()
                current_context = f"{title} - {header_text}"
                current_chunk = [line]
            else:
                current_chunk.append(line)
        
        # Add final chunk
        if current_chunk:
            chunks.append({
                "content": '\n'.join(current_chunk),
                "context": current_context,
                "type": "markdown_section"
            })
        
        return chunks
    
    async def _chunk_text_content(self, content: str, title: str) -> List[Dict[str, Any]]:
        """Chunk general text content by paragraphs and size."""
        chunks = []
        paragraphs = content.split('\n\n')
        current_chunk = []
        chunk_size = 0
        max_chunk_size = 800  # characters
        
        for para in paragraphs:
            para_size = len(para)
            
            if chunk_size + para_size > max_chunk_size and current_chunk:
                # Save current chunk
                chunks.append({
                    "content": '\n\n'.join(current_chunk),
                    "context": title,
                    "type": "text_block"
                })
                current_chunk = [para]
                chunk_size = para_size
            else:
                current_chunk.append(para)
                chunk_size += para_size + 2  # +2 for \n\n
        
        # Add final chunk
        if current_chunk:
            chunks.append({
                "content": '\n\n'.join(current_chunk),
                "context": title,
                "type": "text_block"
            })
        
        return chunks
    
    async def _add_document_to_graph(self, document_id: str, title: str, content: str, 
                                   document_type: str, source_path: Optional[str],
                                   metadata: Optional[Dict[str, Any]], content_hash: str):
        """Add document node to knowledge graph."""
        try:
            # Create document node query
            query = """CREATE (:Document {{
                id: '{}',
                title: '{}',
                content: '{}',
                document_type: '{}',
                file_path: '{}',
                content_hash: '{}',
                size_bytes: {},
                created_at: '{}',
                updated_at: '{}',
                created_by: '{}',
                tags: '{}'
            }})""".format(
                document_id,
                title.replace("'", "''"),
                content[:500].replace("'", "''") + ("..." if len(content) > 500 else ""),  # Truncate for graph storage
                document_type,
                source_path or "",
                content_hash,
                len(content),
                datetime.now().isoformat(),
                datetime.now().isoformat(),
                "RAGService",
                json.dumps(metadata.get('tags', []) if metadata else [])
            )
            
            self.graph_service.connection.execute(query)
            logger.debug(f"Added document {document_id} to graph database")
            
        except Exception as e:
            if "duplicated primary key" in str(e):
                # Document exists, update it
                logger.debug(f"Updating existing document {document_id} in graph")
            else:
                raise e
    
    # Search and Retrieval
    
    async def search_documents(self, 
                             query: str,
                             limit: int = 10,
                             document_types: Optional[List[str]] = None,
                             metadata_filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Search for documents using semantic similarity.
        
        Args:
            query: Search query
            limit: Maximum number of results
            document_types: Filter by document types
            metadata_filters: Additional metadata filters
            
        Returns:
            List of matching documents with relevance scores
        """
        try:
            # Build metadata filter
            search_filters = {}
            if document_types:
                search_filters['document_type'] = {'$in': document_types}
            
            if metadata_filters:
                search_filters.update(metadata_filters)
            
            # Search vector database
            results = await self.vector_service.search_documents(
                query=query,
                limit=limit,
                filter_metadata=search_filters if search_filters else None
            )
            
            # Enrich with document metadata
            enriched_results = []
            for result in results:
                doc_id = result.get('metadata', {}).get('document_id')
                if doc_id and doc_id in self.documents:
                    doc_info = self.documents[doc_id].copy()
                    doc_info.update({
                        'relevance_score': result.get('score', 0.0),
                        'matched_chunk': result.get('content', ''),
                        'chunk_metadata': result.get('metadata', {})
                    })
                    enriched_results.append(doc_info)
            
            logger.info(f"Found {len(enriched_results)} documents for query: {query[:50]}...")
            return enriched_results
            
        except Exception as e:
            logger.error(f"Failed to search documents: {e}")
            return []
    
    async def get_document_context(self, document_id: str, 
                                 query: Optional[str] = None,
                                 max_chunks: int = 5) -> Dict[str, Any]:
        """
        Get relevant context from a specific document.
        
        Args:
            document_id: Target document ID
            query: Optional query to find relevant chunks
            max_chunks: Maximum number of chunks to return
            
        Returns:
            Document context with relevant chunks
        """
        try:
            if document_id not in self.documents:
                return {"error": f"Document {document_id} not found"}
            
            doc_info = self.documents[document_id]
            
            if not query:
                # Return basic document info
                return {
                    "document_id": document_id,
                    "title": doc_info["title"],
                    "document_type": doc_info["document_type"],
                    "chunk_count": doc_info["chunk_count"],
                    "indexed_at": doc_info["indexed_at"],
                    "metadata": doc_info.get("metadata", {})
                }
            
            # Search within specific document chunks
            chunk_ids = doc_info.get("chunk_ids", [])
            if not chunk_ids:
                return {"error": f"No chunks found for document {document_id}"}
            
            # Filter search to this document's chunks
            metadata_filter = {"document_id": document_id}
            
            results = await self.vector_service.search_documents(
                query=query,
                limit=max_chunks,
                filter_metadata=metadata_filter
            )
            
            return {
                "document_id": document_id,
                "title": doc_info["title"],
                "document_type": doc_info["document_type"],
                "query": query,
                "relevant_chunks": results,
                "total_chunks": doc_info["chunk_count"]
            }
            
        except Exception as e:
            logger.error(f"Failed to get document context for {document_id}: {e}")
            return {"error": str(e)}
    
    # File System Integration
    
    async def index_file(self, file_path: Path, 
                       document_id: Optional[str] = None,
                       metadata: Optional[Dict[str, Any]] = None) -> Tuple[bool, Dict[str, Any]]:
        """
        Index a file from the filesystem.
        
        Args:
            file_path: Path to file
            document_id: Custom document ID (defaults to relative path)
            metadata: Additional metadata
            
        Returns:
            Tuple of (success, result_dict)
        """
        try:
            if not file_path.exists():
                return False, {"error": f"File not found: {file_path}"}
            
            # Read file content
            try:
                content = file_path.read_text(encoding='utf-8')
            except UnicodeDecodeError:
                # Try with different encoding or skip binary files
                try:
                    content = file_path.read_text(encoding='latin-1')
                except:
                    return False, {"error": f"Cannot read file (binary?): {file_path}"}
            
            # Determine document type from extension
            suffix = file_path.suffix.lower()
            document_type = {
                '.py': 'code',
                '.js': 'code',
                '.ts': 'code',
                '.java': 'code',
                '.cpp': 'code',
                '.c': 'code',
                '.md': 'markdown',
                '.txt': 'text',
                '.rst': 'text',
                '.json': 'data',
                '.yaml': 'data',
                '.yml': 'data',
                '.toml': 'data',
            }.get(suffix, 'text')
            
            # Use relative path as document ID if not provided
            if not document_id:
                try:
                    document_id = str(file_path.relative_to(Path.cwd()))
                except ValueError:
                    document_id = str(file_path)
            
            # Prepare metadata
            file_metadata = {
                "file_size": file_path.stat().st_size,
                "file_extension": suffix,
                "file_modified": datetime.fromtimestamp(file_path.stat().st_mtime).isoformat(),
            }
            if metadata:
                file_metadata.update(metadata)
            
            # Index the document
            return await self.index_document(
                document_id=document_id,
                title=file_path.name,
                content=content,
                document_type=document_type,
                source_path=str(file_path),
                metadata=file_metadata
            )
            
        except Exception as e:
            logger.error(f"Failed to index file {file_path}: {e}")
            return False, {"error": str(e)}
    
    async def index_directory(self, directory_path: Path,
                            file_patterns: Optional[List[str]] = None,
                            recursive: bool = True,
                            max_files: int = 1000) -> Dict[str, Any]:
        """
        Index all files in a directory.
        
        Args:
            directory_path: Path to directory
            file_patterns: File patterns to include (e.g., ['*.py', '*.md'])
            recursive: Whether to recurse into subdirectories
            max_files: Maximum files to process
            
        Returns:
            Summary of indexing results
        """
        try:
            if not directory_path.exists() or not directory_path.is_dir():
                return {"error": f"Directory not found: {directory_path}"}
            
            # Default patterns for common file types
            if not file_patterns:
                file_patterns = ['*.py', '*.js', '*.ts', '*.md', '*.txt', '*.json', '*.yaml', '*.yml']
            
            # Find files
            files_to_index = []
            for pattern in file_patterns:
                if recursive:
                    files_to_index.extend(directory_path.rglob(pattern))
                else:
                    files_to_index.extend(directory_path.glob(pattern))
            
            # Limit number of files
            if len(files_to_index) > max_files:
                logger.warning(f"Found {len(files_to_index)} files, limiting to {max_files}")
                files_to_index = files_to_index[:max_files]
            
            # Index files
            results = {
                "directory": str(directory_path),
                "total_files": len(files_to_index),
                "indexed": 0,
                "failed": 0,
                "skipped": 0,
                "errors": []
            }
            
            for file_path in files_to_index:
                try:
                    success, result = await self.index_file(file_path)
                    if success:
                        status = result.get("status", "indexed")
                        if status == "unchanged":
                            results["skipped"] += 1
                        else:
                            results["indexed"] += 1
                    else:
                        results["failed"] += 1
                        results["errors"].append({
                            "file": str(file_path),
                            "error": result.get("error", "Unknown error")
                        })
                except Exception as e:
                    results["failed"] += 1
                    results["errors"].append({
                        "file": str(file_path),
                        "error": str(e)
                    })
            
            logger.info(f"Indexed directory {directory_path}: {results['indexed']} indexed, "
                       f"{results['skipped']} skipped, {results['failed']} failed")
            return results
            
        except Exception as e:
            logger.error(f"Failed to index directory {directory_path}: {e}")
            return {"error": str(e)}
    
    # System Integration
    
    async def health_check(self) -> Dict[str, Any]:
        """Comprehensive health check of RAG system."""
        try:
            health = {
                "status": "healthy",
                "components": {},
                "documents": {
                    "total": len(self.documents),
                    "indexed": len([d for d in self.documents.values() if d.get("vector_indexed", False)]),
                    "graph_indexed": len([d for d in self.documents.values() if d.get("graph_indexed", False)])
                },
                "timestamp": datetime.now().isoformat()
            }
            
            # Check vector service
            try:
                vector_stats = await self.vector_service.get_collection_stats()
                health["components"]["vector"] = {"status": "healthy", "stats": vector_stats}
            except Exception as e:
                health["components"]["vector"] = {"status": "unhealthy", "error": str(e)}
                health["status"] = "degraded"
            
            # Check graph service  
            try:
                graph_health = await self.graph_service.health_check()
                health["components"]["graph"] = graph_health
                if graph_health.get("status") != "healthy":
                    health["status"] = "degraded"
            except Exception as e:
                health["components"]["graph"] = {"status": "unhealthy", "error": str(e)}
                health["status"] = "degraded"
            
            return health
            
        except Exception as e:
            logger.error(f"RAG health check failed: {e}")
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get comprehensive RAG system statistics."""
        try:
            stats = {
                "documents": {
                    "total": len(self.documents),
                    "by_type": {},
                    "vector_indexed": 0,
                    "graph_indexed": 0,
                    "total_chunks": 0
                },
                "storage": {
                    "index_size": self.documents_index.stat().st_size if self.documents_index.exists() else 0,
                    "data_path": str(self.rag_data_path)
                },
                "timestamp": datetime.now().isoformat()
            }
            
            # Analyze documents
            for doc in self.documents.values():
                doc_type = doc.get("document_type", "unknown")
                stats["documents"]["by_type"][doc_type] = stats["documents"]["by_type"].get(doc_type, 0) + 1
                
                if doc.get("vector_indexed", False):
                    stats["documents"]["vector_indexed"] += 1
                if doc.get("graph_indexed", False):
                    stats["documents"]["graph_indexed"] += 1
                
                stats["documents"]["total_chunks"] += doc.get("chunk_count", 0)
            
            # Get component stats
            try:
                stats["vector_stats"] = await self.vector_service.get_collection_stats()
            except Exception as e:
                stats["vector_error"] = str(e)
            
            try:
                stats["graph_stats"] = await self.graph_service.get_graph_stats()
            except Exception as e:
                stats["graph_error"] = str(e)
            
            return stats
            
        except Exception as e:
            logger.error(f"Failed to get RAG stats: {e}")
            return {"error": str(e)}