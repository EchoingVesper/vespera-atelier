"""
Database Integration Module for Vespera V2 Triple Database System

This module provides unified access to SQLite, Chroma, and KuzuDB databases
with coordinated synchronization, intelligent query distribution, and
comprehensive error handling with graceful degradation.
"""

from .triple_db_service import TripleDBService, DatabaseConfig
from .sync_coordinator import DatabaseSyncCoordinator
from .migration_manager import MigrationManager
from .chroma_service import ChromaService, ChromaConfig
from .kuzu_service import KuzuService, KuzuConfig
from .error_handling import (
    TripleDatabaseError, DatabaseConnectionError, DatabaseSyncError,
    SchemaValidationError, EmbeddingError, GraphOperationError,
    ErrorRecoveryManager, error_recovery_manager, DatabaseType, ErrorSeverity,
    with_database_error_handling, with_graceful_degradation,
    CircuitBreaker, DatabaseResourceManager, resource_manager
)

__all__ = [
    'TripleDBService', 'DatabaseConfig',
    'DatabaseSyncCoordinator',
    'MigrationManager',
    'ChromaService', 'ChromaConfig',
    'KuzuService', 'KuzuConfig',
    # Error handling
    'TripleDatabaseError', 'DatabaseConnectionError', 'DatabaseSyncError',
    'SchemaValidationError', 'EmbeddingError', 'GraphOperationError',
    'ErrorRecoveryManager', 'error_recovery_manager', 'DatabaseType', 'ErrorSeverity',
    'with_database_error_handling', 'with_graceful_degradation',
    'CircuitBreaker', 'DatabaseResourceManager', 'resource_manager'
]