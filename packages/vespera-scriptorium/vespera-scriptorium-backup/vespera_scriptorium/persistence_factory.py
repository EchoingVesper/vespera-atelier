"""
Factory for creating persistence managers.

This module provides a factory function to create the appropriate persistence manager
based on configuration settings, allowing for a smooth transition from file-based
to database-backed persistence.
"""

import logging
import os
from pathlib import Path
from typing import TYPE_CHECKING, Optional, Union

# Configure logging
logger = logging.getLogger("vespera_scriptorium.persistence_factory")

# Type hints for IDE support
if TYPE_CHECKING:
    from .db.persistence import DatabasePersistenceManager
    from .persistence import PersistenceManager


def create_persistence_manager(
    base_dir: Optional[str] = None,
    db_url: Optional[str] = None,
    use_database: Optional[bool] = None,
):
    """Create the database persistence manager.

    Args:
        base_dir: Base directory for the persistence storage.
                 If None, uses the current working directory.
        db_url: SQLAlchemy database URL for the database connection.
                If None, uses a SQLite database in the base directory.
        use_database: Ignored parameter kept for backward compatibility.

    Returns:
        A DatabasePersistenceManager instance
    """
    # Always use the database persistence manager
    # Import database persistence manager
    from .db.persistence import DatabasePersistenceManager

    logger.info("Using database-backed persistence manager")
    return DatabasePersistenceManager(base_dir, db_url)
