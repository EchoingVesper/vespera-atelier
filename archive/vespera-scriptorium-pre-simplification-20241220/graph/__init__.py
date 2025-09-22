"""
Graph Database Module for Vespera V2

Provides KuzuDB-based graph database services for relationship management
and complex queries across tasks, documents, and knowledge entities.
"""

from .service import KuzuService

__all__ = ['KuzuService']