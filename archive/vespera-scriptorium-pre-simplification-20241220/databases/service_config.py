"""
Configuration and control for background services in Vespera V2.

Provides centralized configuration for all background services including
embedding generation, sync operations, cycle detection, and index optimization.
"""

import logging
from enum import Enum
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Any, Optional, List
import json

logger = logging.getLogger(__name__)


class ServiceType(Enum):
    """Types of background services."""
    AUTO_EMBEDDING = "auto_embedding"
    CYCLE_DETECTION = "cycle_detection"
    INCREMENTAL_SYNC = "incremental_sync"
    INDEX_OPTIMIZATION = "index_optimization"


class ServiceStatus(Enum):
    """Status of a background service."""
    STOPPED = "stopped"
    STARTING = "starting"
    RUNNING = "running"
    STOPPING = "stopping"
    ERROR = "error"


class ServicePriority(Enum):
    """Priority levels for background service operations."""
    LOW = 1
    NORMAL = 2
    HIGH = 3
    CRITICAL = 4


@dataclass
class EmbeddingServiceConfig:
    """Configuration for automatic embedding service."""
    enabled: bool = True
    batch_size: int = 10
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    max_content_length: int = 8192
    embedding_timeout_seconds: int = 30
    auto_embed_on_create: bool = True
    auto_embed_on_update: bool = True
    embed_delay_seconds: float = 1.0  # Delay before embedding to batch operations


@dataclass
class CycleDetectionConfig:
    """Configuration for dependency cycle detection service."""
    enabled: bool = True
    check_on_dependency_add: bool = True
    check_on_dependency_remove: bool = False
    max_detection_depth: int = 50
    detection_timeout_seconds: int = 10
    check_delay_seconds: float = 2.0  # Delay before checking to batch operations


@dataclass
class IncrementalSyncConfig:
    """Configuration for incremental sync service."""
    enabled: bool = True
    sync_on_task_create: bool = True
    sync_on_task_update: bool = True
    sync_on_relationship_change: bool = True
    batch_size: int = 20
    sync_timeout_seconds: int = 60
    sync_delay_seconds: float = 5.0  # Delay before syncing to batch operations
    max_pending_operations: int = 1000


@dataclass
class IndexOptimizationConfig:
    """Configuration for database index optimization service."""
    enabled: bool = True
    optimize_interval_hours: int = 24  # Run daily
    optimize_on_large_changes: bool = True
    large_change_threshold: int = 100  # Operations before optimization
    optimization_timeout_seconds: int = 300  # 5 minutes max
    vacuum_sqlite: bool = True
    optimize_chroma_indices: bool = True
    optimize_kuzu_indices: bool = True


@dataclass
class BackgroundServiceConfig:
    """Master configuration for all background services."""
    # Global settings
    enabled: bool = True
    worker_count: int = 3
    max_queue_size: int = 10000
    operation_timeout_seconds: int = 300
    error_retry_limit: int = 3
    error_retry_backoff: float = 2.0
    
    # Data directory
    data_dir: Path = field(default_factory=lambda: Path("data"))
    
    # Service-specific configurations
    embedding: EmbeddingServiceConfig = field(default_factory=EmbeddingServiceConfig)
    cycle_detection: CycleDetectionConfig = field(default_factory=CycleDetectionConfig)
    incremental_sync: IncrementalSyncConfig = field(default_factory=IncrementalSyncConfig)
    index_optimization: IndexOptimizationConfig = field(default_factory=IndexOptimizationConfig)
    
    # Monitoring and logging
    log_level: str = "INFO"
    metrics_enabled: bool = True
    metrics_retention_hours: int = 168  # 1 week
    
    def __post_init__(self):
        """Initialize derived settings."""
        self.data_dir = Path(self.data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
    
    @classmethod
    def from_file(cls, config_path: Path) -> 'BackgroundServiceConfig':
        """Load configuration from JSON file."""
        try:
            with open(config_path, 'r') as f:
                data = json.load(f)
            
            # Convert nested dictionaries to config objects
            config = cls()
            
            # Update global settings
            for key, value in data.items():
                if hasattr(config, key) and not isinstance(getattr(config, key), (EmbeddingServiceConfig, CycleDetectionConfig, IncrementalSyncConfig, IndexOptimizationConfig)):
                    setattr(config, key, value)
            
            # Update service-specific settings
            if 'embedding' in data:
                for key, value in data['embedding'].items():
                    if hasattr(config.embedding, key):
                        setattr(config.embedding, key, value)
            
            if 'cycle_detection' in data:
                for key, value in data['cycle_detection'].items():
                    if hasattr(config.cycle_detection, key):
                        setattr(config.cycle_detection, key, value)
            
            if 'incremental_sync' in data:
                for key, value in data['incremental_sync'].items():
                    if hasattr(config.incremental_sync, key):
                        setattr(config.incremental_sync, key, value)
            
            if 'index_optimization' in data:
                for key, value in data['index_optimization'].items():
                    if hasattr(config.index_optimization, key):
                        setattr(config.index_optimization, key, value)
            
            logger.info(f"Loaded background service configuration from {config_path}")
            return config
            
        except FileNotFoundError:
            logger.info(f"Configuration file {config_path} not found, using defaults")
            return cls()
        except Exception as e:
            logger.error(f"Failed to load configuration from {config_path}: {e}")
            return cls()
    
    def to_file(self, config_path: Path) -> None:
        """Save configuration to JSON file."""
        try:
            # Convert to dictionary
            data = {
                'enabled': self.enabled,
                'worker_count': self.worker_count,
                'max_queue_size': self.max_queue_size,
                'operation_timeout_seconds': self.operation_timeout_seconds,
                'error_retry_limit': self.error_retry_limit,
                'error_retry_backoff': self.error_retry_backoff,
                'data_dir': str(self.data_dir),
                'log_level': self.log_level,
                'metrics_enabled': self.metrics_enabled,
                'metrics_retention_hours': self.metrics_retention_hours,
                
                'embedding': {
                    'enabled': self.embedding.enabled,
                    'batch_size': self.embedding.batch_size,
                    'embedding_model': self.embedding.embedding_model,
                    'max_content_length': self.embedding.max_content_length,
                    'embedding_timeout_seconds': self.embedding.embedding_timeout_seconds,
                    'auto_embed_on_create': self.embedding.auto_embed_on_create,
                    'auto_embed_on_update': self.embedding.auto_embed_on_update,
                    'embed_delay_seconds': self.embedding.embed_delay_seconds
                },
                
                'cycle_detection': {
                    'enabled': self.cycle_detection.enabled,
                    'check_on_dependency_add': self.cycle_detection.check_on_dependency_add,
                    'check_on_dependency_remove': self.cycle_detection.check_on_dependency_remove,
                    'max_detection_depth': self.cycle_detection.max_detection_depth,
                    'detection_timeout_seconds': self.cycle_detection.detection_timeout_seconds,
                    'check_delay_seconds': self.cycle_detection.check_delay_seconds
                },
                
                'incremental_sync': {
                    'enabled': self.incremental_sync.enabled,
                    'sync_on_task_create': self.incremental_sync.sync_on_task_create,
                    'sync_on_task_update': self.incremental_sync.sync_on_task_update,
                    'sync_on_relationship_change': self.incremental_sync.sync_on_relationship_change,
                    'batch_size': self.incremental_sync.batch_size,
                    'sync_timeout_seconds': self.incremental_sync.sync_timeout_seconds,
                    'sync_delay_seconds': self.incremental_sync.sync_delay_seconds,
                    'max_pending_operations': self.incremental_sync.max_pending_operations
                },
                
                'index_optimization': {
                    'enabled': self.index_optimization.enabled,
                    'optimize_interval_hours': self.index_optimization.optimize_interval_hours,
                    'optimize_on_large_changes': self.index_optimization.optimize_on_large_changes,
                    'large_change_threshold': self.index_optimization.large_change_threshold,
                    'optimization_timeout_seconds': self.index_optimization.optimization_timeout_seconds,
                    'vacuum_sqlite': self.index_optimization.vacuum_sqlite,
                    'optimize_chroma_indices': self.index_optimization.optimize_chroma_indices,
                    'optimize_kuzu_indices': self.index_optimization.optimize_kuzu_indices
                }
            }
            
            # Ensure directory exists
            config_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Write configuration
            with open(config_path, 'w') as f:
                json.dump(data, f, indent=2)
            
            logger.info(f"Saved background service configuration to {config_path}")
            
        except Exception as e:
            logger.error(f"Failed to save configuration to {config_path}: {e}")
            raise
    
    def get_service_config(self, service_type: ServiceType) -> Any:
        """Get configuration for a specific service type."""
        if service_type == ServiceType.AUTO_EMBEDDING:
            return self.embedding
        elif service_type == ServiceType.CYCLE_DETECTION:
            return self.cycle_detection
        elif service_type == ServiceType.INCREMENTAL_SYNC:
            return self.incremental_sync
        elif service_type == ServiceType.INDEX_OPTIMIZATION:
            return self.index_optimization
        else:
            raise ValueError(f"Unknown service type: {service_type}")
    
    def is_service_enabled(self, service_type: ServiceType) -> bool:
        """Check if a specific service is enabled."""
        if not self.enabled:
            return False
        
        service_config = self.get_service_config(service_type)
        return service_config.enabled
    
    def get_service_delay(self, service_type: ServiceType) -> float:
        """Get the delay setting for a specific service."""
        service_config = self.get_service_config(service_type)
        
        if service_type == ServiceType.AUTO_EMBEDDING:
            return service_config.embed_delay_seconds
        elif service_type == ServiceType.CYCLE_DETECTION:
            return service_config.check_delay_seconds
        elif service_type == ServiceType.INCREMENTAL_SYNC:
            return service_config.sync_delay_seconds
        else:
            return 0.0
    
    def validate(self) -> List[str]:
        """Validate configuration and return list of issues."""
        issues = []
        
        # Validate global settings
        if self.worker_count < 1:
            issues.append("worker_count must be at least 1")
        if self.max_queue_size < 100:
            issues.append("max_queue_size should be at least 100")
        if self.operation_timeout_seconds < 10:
            issues.append("operation_timeout_seconds should be at least 10")
        
        # Validate embedding settings
        if self.embedding.batch_size < 1:
            issues.append("embedding.batch_size must be at least 1")
        if self.embedding.max_content_length < 100:
            issues.append("embedding.max_content_length should be at least 100")
        
        # Validate cycle detection settings
        if self.cycle_detection.max_detection_depth < 5:
            issues.append("cycle_detection.max_detection_depth should be at least 5")
        
        # Validate sync settings
        if self.incremental_sync.batch_size < 1:
            issues.append("incremental_sync.batch_size must be at least 1")
        if self.incremental_sync.max_pending_operations < 10:
            issues.append("incremental_sync.max_pending_operations should be at least 10")
        
        # Validate optimization settings
        if self.index_optimization.optimize_interval_hours < 1:
            issues.append("index_optimization.optimize_interval_hours must be at least 1")
        
        return issues


def get_default_config_path() -> Path:
    """Get the default configuration file path."""
    return Path("data/background_services_config.json")


def load_config(config_path: Optional[Path] = None) -> BackgroundServiceConfig:
    """Load background service configuration."""
    if config_path is None:
        config_path = get_default_config_path()
    
    return BackgroundServiceConfig.from_file(config_path)


def save_config(config: BackgroundServiceConfig, config_path: Optional[Path] = None) -> None:
    """Save background service configuration."""
    if config_path is None:
        config_path = get_default_config_path()
    
    config.to_file(config_path)


# Predefined configuration profiles
def get_development_config() -> BackgroundServiceConfig:
    """Get configuration optimized for development."""
    config = BackgroundServiceConfig()
    
    # Reduce delays for faster development feedback
    config.embedding.embed_delay_seconds = 0.5
    config.cycle_detection.check_delay_seconds = 1.0
    config.incremental_sync.sync_delay_seconds = 2.0
    
    # Smaller batch sizes for faster processing
    config.embedding.batch_size = 5
    config.incremental_sync.batch_size = 10
    
    # More frequent optimization
    config.index_optimization.optimize_interval_hours = 6
    config.index_optimization.large_change_threshold = 20
    
    return config


def get_production_config() -> BackgroundServiceConfig:
    """Get configuration optimized for production."""
    config = BackgroundServiceConfig()
    
    # Larger batch sizes for efficiency
    config.embedding.batch_size = 20
    config.incremental_sync.batch_size = 50
    
    # More workers for higher throughput
    config.worker_count = 5
    
    # Longer optimization intervals
    config.index_optimization.optimize_interval_hours = 24
    config.index_optimization.large_change_threshold = 500
    
    # Longer retry delays
    config.error_retry_backoff = 5.0
    
    return config


def get_low_resource_config() -> BackgroundServiceConfig:
    """Get configuration for low-resource environments."""
    config = BackgroundServiceConfig()
    
    # Single worker to minimize resource usage
    config.worker_count = 1
    
    # Smaller batch sizes
    config.embedding.batch_size = 3
    config.incremental_sync.batch_size = 5
    
    # Longer delays to reduce CPU usage
    config.embedding.embed_delay_seconds = 5.0
    config.cycle_detection.check_delay_seconds = 10.0
    config.incremental_sync.sync_delay_seconds = 15.0
    
    # Less frequent optimization
    config.index_optimization.optimize_interval_hours = 72
    config.index_optimization.large_change_threshold = 1000
    
    return config