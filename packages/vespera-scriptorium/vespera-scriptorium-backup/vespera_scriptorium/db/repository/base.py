"""
Base Repository Module - Core setup and configuration for Generic Task Repository

This module contains the base repository class, database connection setup,
and core configuration needed by all other repository modules.
"""

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy import and_, create_engine, delete, event, func, or_, select, update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import joinedload, selectinload, sessionmaker
from sqlalchemy.sql import text

from ...domain.entities.task import (
    ArtifactType,
    AttributeType,
    DependencyStatus,
    DependencyType,
    EventCategory,
    EventType,
    LifecycleStage,
    Task,
    TaskArtifact,
    TaskAttribute,
    TaskDependency,
    TaskEvent,
    TaskStatus,
    TaskTemplate,
    TaskType,
    TemplateParameter,
)
from ..models import Base

logger = logging.getLogger(__name__)


class CycleDetectedError(Exception):
    """Raised when a cycle is detected in task dependencies."""

    pass


class TaskRepository:
    """Repository for Generic Task database operations with async support."""

    def __init__(self, db_url: str, sync_mode: bool = False):
        """Initialize the repository with database connection.

        Args:
            db_url: Database connection URL
            sync_mode: If True, use synchronous operations (for migration)
        """
        self.db_url = db_url
        self.sync_mode = sync_mode

        if sync_mode:
            # Synchronous engine for migrations
            self.engine = create_engine(db_url)
            self.Session = sessionmaker(bind=self.engine)
        else:
            # Async engine for normal operations
            # Convert sqlite:// to sqlite+aiosqlite://
            if db_url.startswith("sqlite://"):
                async_url = db_url.replace("sqlite://", "sqlite+aiosqlite://")
            else:
                async_url = db_url

            self.async_engine = create_async_engine(
                async_url, pool_pre_ping=True, pool_recycle=3600, echo=False
            )
            self.async_session_maker = async_sessionmaker(
                self.async_engine, class_=AsyncSession, expire_on_commit=False
            )

    @asynccontextmanager
    async def get_session(self):
        """Get an async database session."""
        if self.sync_mode:
            raise RuntimeError("Cannot use async session in sync mode")

        async with self.async_session_maker() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()
