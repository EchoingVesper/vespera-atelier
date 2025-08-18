"""
Server reboot functionality for Vespera Scriptorium.

This package provides graceful shutdown, state serialization, restart
coordination, and client connection management for seamless server updates.
"""

from .connection_manager import (
    ConnectionInfo,
    ConnectionManager,
    ConnectionState,
    ReconnectionManager,
    RequestBuffer,
)
from .reboot_integration import (
    RebootManager,
    get_reboot_manager,
    initialize_reboot_system,
)
from .restart_manager import (
    ProcessManager,
    RestartCoordinator,
    RestartPhase,
    RestartStatus,
    StateRestorer,
)
from .shutdown_coordinator import (
    ShutdownCoordinator,
    ShutdownManager,
    ShutdownPhase,
    ShutdownStatus,
)
from .state_serializer import (
    ClientSession,
    DatabaseState,
    RestartReason,
    ServerStateSnapshot,
    StateSerializer,
)

# Server package initialization - no entry points here
# Entry points are handled by __main__.py to avoid import conflicts

__all__ = [
    # State serialization
    "StateSerializer",
    "ServerStateSnapshot",
    "RestartReason",
    "ClientSession",
    "DatabaseState",
    # Shutdown coordination
    "ShutdownCoordinator",
    "ShutdownManager",
    "ShutdownPhase",
    "ShutdownStatus",
    # Restart management
    "RestartCoordinator",
    "ProcessManager",
    "StateRestorer",
    "RestartPhase",
    "RestartStatus",
    # Connection management
    "ConnectionManager",
    "ConnectionInfo",
    "ConnectionState",
    "RequestBuffer",
    "ReconnectionManager",
    # Integration
    "RebootManager",
    "get_reboot_manager",
    "initialize_reboot_system",
]
