"""
Vespera Scriptorium V2 Core Components

Core orchestration layer that integrates all V2 components including
the role system, task management, and database abstraction.
"""

from .role_integration import RoleOrchestrator
from .database import DatabaseManager
from .config import SystemConfiguration

__all__ = [
    'RoleOrchestrator',
    'DatabaseManager', 
    'SystemConfiguration'
]