# Background Services Architecture - Vespera V2

This document describes the background services architecture that separates user-facing MCP tools from automatic system maintenance operations.

## Overview

The background services system refactors key operations from manual MCP tools to automatic background processes:

1. **Embedding Generation** - Automatic on task creation/update
2. **Dependency Cycle Detection** - Automatic on relationship changes  
3. **Incremental Synchronization** - Real-time sync between databases
4. **Index Optimization** - Periodic performance maintenance

## Architecture Components

### Core Infrastructure

#### `BackgroundServiceManager`
- Central coordinator for all background services
- Manages operation queuing, scheduling, and worker pools
- Provides service lifecycle management and monitoring
- Handles error recovery with exponential backoff

#### `BackgroundService` (Base Class)
- Abstract base for all background services
- Provides common lifecycle methods and error handling
- Implements service enable/disable functionality
- Supports operation-specific processing

#### `ServiceConfiguration`
- Centralized configuration for all services
- Supports development, production, and low-resource profiles
- JSON file-based configuration with validation
- Service-specific settings and global parameters

### Service Implementations

#### 1. Auto-Embedding Service (`AutoEmbeddingService`)

**Purpose**: Automatically generate embeddings for tasks without user intervention.

**Triggers**:
- Task creation
- Task updates (title/description changes)
- Manual embedding requests

**Configuration**:
```json
{
  "embedding": {
    "enabled": true,
    "batch_size": 10,
    "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
    "max_content_length": 8192,
    "auto_embed_on_create": true,
    "auto_embed_on_update": true,
    "embed_delay_seconds": 1.0
  }
}
```

**Operations**:
- `embed_task`: Generate embedding for single task
- `batch_embed`: Process multiple tasks efficiently

#### 2. Cycle Detection Service (`CycleDependencyService`)

**Purpose**: Proactively detect dependency cycles to prevent invalid states.

**Triggers**:
- Dependency addition
- Manual cycle audits
- Periodic full scans

**Configuration**:
```json
{
  "cycle_detection": {
    "enabled": true,
    "check_on_dependency_add": true,
    "max_detection_depth": 50,
    "detection_timeout_seconds": 10,
    "check_delay_seconds": 2.0
  }
}
```

**Operations**:
- `check_cycles`: Detect cycles from specific tasks
- `full_cycle_check`: Comprehensive dependency audit

#### 3. Incremental Sync Service (`IncrementalSyncService`)

**Purpose**: Keep databases synchronized with minimal overhead.

**Triggers**:
- Task creation/updates
- Relationship changes
- Cleanup operations

**Configuration**:
```json
{
  "incremental_sync": {
    "enabled": true,
    "sync_on_task_create": true,
    "sync_on_task_update": true,
    "batch_size": 20,
    "sync_delay_seconds": 5.0
  }
}
```

**Operations**:
- `sync_task`: Sync single task to all databases
- `cleanup_task`: Remove deleted tasks
- `batch_sync`: Process multiple sync operations

#### 4. Index Optimization Service (`IndexOptimizationService`)

**Purpose**: Maintain database performance through automated optimization.

**Triggers**:
- Time-based intervals (daily/weekly)
- Operation count thresholds
- Manual triggers

**Configuration**:
```json
{
  "index_optimization": {
    "enabled": true,
    "optimize_interval_hours": 24,
    "large_change_threshold": 100,
    "vacuum_sqlite": true,
    "optimize_chroma_indices": true,
    "optimize_kuzu_indices": true
  }
}
```

**Operations**:
- `optimize_indices`: Full optimization cycle
- `vacuum_sqlite`: SQLite maintenance
- `optimize_chroma`: Vector database optimization
- `optimize_kuzu`: Graph database optimization

## Integration with Existing Systems

### TripleDBService Integration

The `TripleDBService` has been enhanced to automatically use background services:

```python
# Automatic embedding and sync on task creation
success, result = await triple_db_service.create_task(...)

# Background services automatically:
# 1. Schedule embedding generation
# 2. Schedule incremental sync
# 3. Update sync status
```

### MCP Tool Evolution

MCP tools now focus on user-facing operations while leveraging background services:

#### Before (Manual):
```python
@mcp.tool()
async def create_task(task_input: TaskCreateInput):
    # Manual embedding parameter
    if task_input.auto_embed:
        await generate_embedding(task)
```

#### After (Automatic):
```python
@mcp.tool()
async def create_task(task_input: TaskCreateInput):
    # Background services handle automatically
    success, result = await triple_db_service.create_task(...)
    # Embedding and sync scheduled automatically
```

### New MCP Tools for Service Management

```python
# Monitor background services
await get_background_service_status()

# Configure services
await configure_background_service("auto_embedding", enabled=True)

# Manual triggers when needed
await trigger_index_optimization()
await force_task_embedding(task_id)
```

## Configuration Profiles

### Development Profile
- Fast feedback with reduced delays
- Smaller batch sizes
- More frequent optimization
- Debug logging enabled

### Production Profile  
- Optimized for throughput
- Larger batch sizes
- Longer optimization intervals
- Error recovery emphasis

### Low-Resource Profile
- Single worker thread
- Minimal resource usage
- Extended delays between operations
- Reduced optimization frequency

## Operational Benefits

### For Users
- **Transparent Operation**: Embedding and sync happen automatically
- **Improved Performance**: Background optimization maintains speed
- **Reduced Errors**: Automatic cycle detection prevents invalid states
- **Simplified Interface**: No manual sync/embed parameters needed

### For System
- **Better Resource Utilization**: Batched operations and smart scheduling
- **Graceful Degradation**: System works even if services unavailable
- **Monitoring & Metrics**: Comprehensive service health tracking
- **Scalability**: Worker pools and queue management

### For Developers
- **Clean Separation**: User operations vs. system maintenance
- **Configurable Behavior**: Extensive configuration options
- **Error Handling**: Automatic retries with exponential backoff
- **Testing Support**: Service mocking and test configurations

## Monitoring and Health

### Service Metrics
```json
{
  "operations_completed": 150,
  "operations_failed": 2,
  "operations_retried": 5,
  "average_processing_time": 0.25,
  "last_operation_time": "2024-01-15T10:30:00Z",
  "errors_last_hour": 1
}
```

### Health Indicators
- Service status (running/stopped/error)
- Queue sizes and processing rates
- Error rates and retry counts
- Resource utilization metrics

### Alerting Points
- Service failures or crashes
- Queue size exceeding thresholds
- High error rates
- Performance degradation

## Error Handling Strategy

### Retry Logic
- Exponential backoff: 2^retries seconds (max 5 minutes)
- Maximum retry attempts: 3 (configurable)
- Different strategies per service type

### Graceful Degradation
- System continues working if background services fail
- Manual tools available as fallbacks
- Clear error reporting and logging

### Recovery Mechanisms
- Automatic service restart on crash
- Queue persistence for operation continuity
- Health checks and self-healing

## File Structure

```
databases/
├── background_services.py      # Core service infrastructure
├── service_config.py          # Configuration management
├── triple_db_service.py       # Enhanced with background services
└── test_background_services.py # Comprehensive testing

mcp_server_triple_db.py        # Updated MCP tools
```

## Usage Examples

### Basic Setup
```python
from databases.service_config import get_development_config
from databases.background_services import BackgroundServiceManager

config = get_development_config()
manager = BackgroundServiceManager(config)
await manager.initialize()
await manager.start()
```

### Service Configuration
```python
# Disable embedding service temporarily
await manager.configure_background_service(
    ServiceType.AUTO_EMBEDDING, 
    enabled=False
)

# Trigger manual optimization
result = await manager.schedule_operation(
    ServiceType.INDEX_OPTIMIZATION,
    "optimize_indices",
    "manual_trigger",
    priority=ServicePriority.HIGH
)
```

### Integration with TripleDB
```python
from databases.triple_db_service import triple_db_lifespan

async with triple_db_lifespan(db_config, enable_background_services=True) as service:
    # All operations automatically use background services
    success, result = await service.create_task(...)
    # Embedding and sync scheduled automatically
```

## Future Enhancements

### Planned Features
1. **Distributed Processing**: Support for multiple worker nodes
2. **Advanced Scheduling**: Priority queues and deadline scheduling
3. **Machine Learning**: Adaptive optimization based on usage patterns
4. **Integration Hooks**: Custom service plugins and extensions

### Performance Optimizations
1. **Smart Batching**: Dynamic batch sizing based on load
2. **Resource Monitoring**: CPU/memory-aware scheduling
3. **Predictive Optimization**: Optimize before performance degrades
4. **Caching Layers**: Reduce redundant operations

### Monitoring Enhancements
1. **Metrics Dashboard**: Real-time service monitoring
2. **Alerting System**: Proactive issue notification
3. **Performance Analytics**: Historical trend analysis
4. **Capacity Planning**: Resource usage predictions

This background services architecture provides a solid foundation for automatic system maintenance while maintaining clean separation between user operations and system internals.