"""
Vector Database Module for Vespera V2

Provides ChromaDB-based vector database services for semantic search and 
retrieval across tasks, documents, and code artifacts.
"""

from .service import VectorService

__all__ = ['VectorService']