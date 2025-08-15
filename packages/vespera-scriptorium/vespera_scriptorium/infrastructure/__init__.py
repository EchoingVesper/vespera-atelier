"""
Infrastructure layer for Vespera Scriptorium.

This layer contains all the technical implementation details including:
- Database implementations
- External service integrations
- Framework-specific code
- Technical utilities

The infrastructure layer implements the interfaces defined in the domain layer.
"""

# Configuration infrastructure
from .config import (
    ConfigurationManager,
    ConfigValidator,
    DefaultConfigLoader,
    EnvironmentConfigLoader,
    FileConfigLoader,
)

# Database infrastructure
from .database import (
    DatabaseAdapter,
    DatabaseAdapterFactory,
    DatabaseConnectionManager,
    DatabaseType,
    GraphDatabaseAdapter,
    OperationalDatabaseAdapter,
    RepositoryFactory,
    UnifiedDatabaseManager,
    VectorDatabaseAdapter,
    create_repository_factory,
    create_unified_manager,
)

# Dependency injection infrastructure
from .di import (
    ServiceContainer,
    ServiceRegistrar,
    get_container,
    get_service,
    set_container,
)

# External services infrastructure
from .external import (
    EmailNotificationService,
    FileSystemArtifactStorage,
    HTTPApiClient,
    WebhookNotificationService,
)

# MCP protocol infrastructure
from .mcp import (  # Note: MCPToolHandler and MCPResourceHandler temporarily disabled due to import conflicts
    MCPErrorAdapter,
    MCPRequestAdapter,
    MCPResponseAdapter,
    MCPServerAdapter,
)

# Monitoring infrastructure
from .monitoring import (
    DiagnosticRunner,
    HealthChecker,
    MetricsCollector,
    PerformanceTracker,
    SystemMonitor,
)

__all__ = [
    # Database infrastructure
    "DatabaseType",
    "DatabaseAdapter",
    "OperationalDatabaseAdapter",
    "VectorDatabaseAdapter",
    "GraphDatabaseAdapter",
    "DatabaseAdapterFactory",
    "UnifiedDatabaseManager",
    "create_unified_manager",
    "DatabaseConnectionManager",
    "RepositoryFactory",
    "create_repository_factory",
    # Dependency Injection
    "ServiceContainer",
    "ServiceRegistrar",
    "get_container",
    "set_container",
    "get_service",
    # MCP protocol infrastructure
    "MCPServerAdapter",
    "MCPRequestAdapter",
    "MCPResponseAdapter",
    "MCPErrorAdapter",
    # Configuration infrastructure
    "ConfigurationManager",
    "ConfigValidator",
    "EnvironmentConfigLoader",
    "FileConfigLoader",
    "DefaultConfigLoader",
    # Monitoring infrastructure
    "HealthChecker",
    "MetricsCollector",
    "PerformanceTracker",
    "SystemMonitor",
    "DiagnosticRunner",
    # External services infrastructure
    "WebhookNotificationService",
    "EmailNotificationService",
    "HTTPApiClient",
    "FileSystemArtifactStorage",
]
