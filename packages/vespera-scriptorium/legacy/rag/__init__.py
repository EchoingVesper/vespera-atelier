"""
RAG (Retrieval-Augmented Generation) Module for Vespera V2

Provides document indexing, semantic search, and knowledge graph integration
for enhanced AI capabilities with hallucination detection and code analysis.
"""

from .service import RAGService
from .code_analyzer import CodeAnalyzer

__all__ = [
    'RAGService', 
    'CodeAnalyzer'
]