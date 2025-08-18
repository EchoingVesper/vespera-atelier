"""
Dependency Injection infrastructure.

This package provides a complete dependency injection system with
lifetime management, service registration, and automatic resolution.
"""

from .container import (
    CircularDependencyError,
    ServiceContainer,
    ServiceResolutionError,
    auto_register_repositories,
    get_container,
    get_service,
    register_services,
    reset_container,
    set_container,
)
from .lifetime_managers import (
    LifetimeManager,
    LifetimeScope,
    ScopedLifetimeManager,
    ServiceScope,
    SingletonLifetimeManager,
    TransientLifetimeManager,
)
from .registration import (
    AutoRegistration,
    ServiceFactory,
    ServiceRegistrar,
    ServiceRegistration,
)

__all__ = [
    # Container
    "ServiceContainer",
    "ServiceResolutionError",
    "CircularDependencyError",
    "get_container",
    "set_container",
    "reset_container",
    "register_services",
    "get_service",
    "auto_register_repositories",
    # Registration
    "ServiceRegistration",
    "ServiceRegistrar",
    "AutoRegistration",
    "ServiceFactory",
    # Lifetime Management
    "LifetimeScope",
    "LifetimeManager",
    "SingletonLifetimeManager",
    "TransientLifetimeManager",
    "ScopedLifetimeManager",
    "ServiceScope",
]
