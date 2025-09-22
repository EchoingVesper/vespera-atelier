"""
Comprehensive Error Handling for Triple Database System

Provides specialized exception classes, error recovery mechanisms,
and graceful degradation patterns for the triple database integration.
"""

import logging
import traceback
from typing import Dict, List, Any, Optional, Union, Callable
from datetime import datetime
from enum import Enum
from dataclasses import dataclass
from functools import wraps

logger = logging.getLogger(__name__)


class DatabaseType(Enum):
    """Database type identifiers."""
    SQLITE = "sqlite"
    CHROMA = "chroma"
    KUZU = "kuzu"


class ErrorSeverity(Enum):
    """Error severity levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class DatabaseError:
    """Structured error information."""
    database_type: DatabaseType
    operation: str
    error_type: str
    message: str
    severity: ErrorSeverity
    timestamp: datetime
    traceback: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
    recovery_attempted: bool = False
    recovery_successful: bool = False


# Custom exception classes
class TripleDatabaseError(Exception):
    """Base exception for triple database operations."""
    
    def __init__(self, message: str, database_type: DatabaseType = None, 
                 operation: str = None, severity: ErrorSeverity = ErrorSeverity.MEDIUM):
        super().__init__(message)
        self.message = message
        self.database_type = database_type
        self.operation = operation
        self.severity = severity
        self.timestamp = datetime.now()


class DatabaseConnectionError(TripleDatabaseError):
    """Database connection failures."""
    
    def __init__(self, database_type: DatabaseType, message: str = None):
        default_message = f"Failed to connect to {database_type.value} database"
        super().__init__(
            message or default_message,
            database_type=database_type,
            operation="connect",
            severity=ErrorSeverity.HIGH
        )


class DatabaseSyncError(TripleDatabaseError):
    """Synchronization failures between databases."""
    
    def __init__(self, source_db: DatabaseType, target_db: DatabaseType, 
                 task_id: str = None, message: str = None):
        default_message = f"Failed to sync from {source_db.value} to {target_db.value}"
        if task_id:
            default_message += f" for task {task_id}"
        
        super().__init__(
            message or default_message,
            operation="sync",
            severity=ErrorSeverity.MEDIUM
        )
        
        self.source_db = source_db
        self.target_db = target_db
        self.task_id = task_id


class SchemaValidationError(TripleDatabaseError):
    """Database schema validation failures."""
    
    def __init__(self, database_type: DatabaseType, validation_errors: List[str]):
        message = f"Schema validation failed for {database_type.value}: {'; '.join(validation_errors)}"
        super().__init__(
            message,
            database_type=database_type,
            operation="schema_validation",
            severity=ErrorSeverity.HIGH
        )
        self.validation_errors = validation_errors


class EmbeddingError(TripleDatabaseError):
    """Vector embedding generation or storage failures."""
    
    def __init__(self, task_id: str, message: str = None):
        default_message = f"Failed to generate or store embedding for task {task_id}"
        super().__init__(
            message or default_message,
            database_type=DatabaseType.CHROMA,
            operation="embedding",
            severity=ErrorSeverity.MEDIUM
        )
        self.task_id = task_id


class GraphOperationError(TripleDatabaseError):
    """Graph database operation failures."""
    
    def __init__(self, operation: str, message: str = None):
        default_message = f"Graph operation '{operation}' failed"
        super().__init__(
            message or default_message,
            database_type=DatabaseType.KUZU,
            operation=operation,
            severity=ErrorSeverity.MEDIUM
        )


class ErrorRecoveryManager:
    """
    Manages error recovery and graceful degradation strategies.
    """
    
    def __init__(self):
        self.error_history: List[DatabaseError] = []
        self.recovery_strategies: Dict[str, Callable] = {}
        self.degradation_mode = False
        
    def register_recovery_strategy(self, error_type: str, strategy: Callable) -> None:
        """Register a recovery strategy for a specific error type."""
        self.recovery_strategies[error_type] = strategy
        logger.debug(f"Registered recovery strategy for {error_type}")
    
    def handle_error(self, error: TripleDatabaseError, context: Dict[str, Any] = None) -> bool:
        """
        Handle an error and attempt recovery.
        
        Returns:
            True if error was handled successfully, False otherwise
        """
        db_error = DatabaseError(
            database_type=error.database_type or DatabaseType.SQLITE,
            operation=error.operation or "unknown",
            error_type=error.__class__.__name__,
            message=error.message,
            severity=error.severity,
            timestamp=error.timestamp,
            traceback=traceback.format_exc(),
            context=context
        )
        
        self.error_history.append(db_error)
        
        # Log the error
        log_level = self._get_log_level(error.severity)
        logger.log(log_level, f"Database error: {error.message}", extra={
            "database_type": error.database_type.value if error.database_type else None,
            "operation": error.operation,
            "severity": error.severity.value
        })
        
        # Attempt recovery
        recovery_success = self._attempt_recovery(db_error)
        db_error.recovery_attempted = True
        db_error.recovery_successful = recovery_success
        
        # Check if degradation mode should be enabled
        self._check_degradation_mode()
        
        return recovery_success
    
    def _get_log_level(self, severity: ErrorSeverity) -> int:
        """Get logging level based on error severity."""
        level_map = {
            ErrorSeverity.LOW: logging.DEBUG,
            ErrorSeverity.MEDIUM: logging.WARNING,
            ErrorSeverity.HIGH: logging.ERROR,
            ErrorSeverity.CRITICAL: logging.CRITICAL
        }
        return level_map.get(severity, logging.WARNING)
    
    def _attempt_recovery(self, db_error: DatabaseError) -> bool:
        """Attempt to recover from the error using registered strategies."""
        strategy = self.recovery_strategies.get(db_error.error_type)
        
        if strategy:
            try:
                logger.info(f"Attempting recovery for {db_error.error_type}")
                return strategy(db_error)
            except Exception as e:
                logger.error(f"Recovery strategy failed: {e}")
                return False
        
        # Try generic recovery strategies
        return self._generic_recovery(db_error)
    
    def _generic_recovery(self, db_error: DatabaseError) -> bool:
        """Generic recovery strategies based on database type and operation."""
        
        if db_error.database_type == DatabaseType.CHROMA:
            # For Chroma errors, try to reinitialize connection
            if db_error.operation in ["embedding", "search"]:
                logger.info("Attempting to recover Chroma connection")
                # This would need to be implemented by the calling service
                return False
        
        elif db_error.database_type == DatabaseType.KUZU:
            # For KuzuDB errors, try to reconnect
            if db_error.operation in ["graph_query", "sync"]:
                logger.info("Attempting to recover KuzuDB connection")
                return False
        
        elif db_error.database_type == DatabaseType.SQLITE:
            # For SQLite errors, ensure database file integrity
            if db_error.operation in ["create", "update", "delete"]:
                logger.info("Attempting to recover SQLite connection")
                return False
        
        return False
    
    def _check_degradation_mode(self) -> None:
        """Check if system should enter degradation mode."""
        recent_errors = [
            error for error in self.error_history
            if (datetime.now() - error.timestamp).total_seconds() < 300  # Last 5 minutes
        ]
        
        critical_errors = [
            error for error in recent_errors
            if error.severity == ErrorSeverity.CRITICAL
        ]
        
        high_error_rate = len(recent_errors) > 10
        multiple_critical = len(critical_errors) > 2
        
        if (high_error_rate or multiple_critical) and not self.degradation_mode:
            self.degradation_mode = True
            logger.warning("Entering degradation mode due to high error rate")
        elif not recent_errors and self.degradation_mode:
            self.degradation_mode = False
            logger.info("Exiting degradation mode - errors resolved")
    
    def get_error_summary(self) -> Dict[str, Any]:
        """Get summary of recent errors."""
        recent_errors = [
            error for error in self.error_history
            if (datetime.now() - error.timestamp).total_seconds() < 3600  # Last hour
        ]
        
        summary = {
            "total_errors": len(recent_errors),
            "degradation_mode": self.degradation_mode,
            "errors_by_type": {},
            "errors_by_database": {},
            "errors_by_severity": {},
            "recovery_success_rate": 0.0
        }
        
        if recent_errors:
            # Count by type
            for error in recent_errors:
                summary["errors_by_type"][error.error_type] = \
                    summary["errors_by_type"].get(error.error_type, 0) + 1
                
                summary["errors_by_database"][error.database_type.value] = \
                    summary["errors_by_database"].get(error.database_type.value, 0) + 1
                
                summary["errors_by_severity"][error.severity.value] = \
                    summary["errors_by_severity"].get(error.severity.value, 0) + 1
            
            # Calculate recovery success rate
            recovery_attempts = [e for e in recent_errors if e.recovery_attempted]
            if recovery_attempts:
                successful_recoveries = [e for e in recovery_attempts if e.recovery_successful]
                summary["recovery_success_rate"] = len(successful_recoveries) / len(recovery_attempts)
        
        return summary


# Global error recovery manager instance
error_recovery_manager = ErrorRecoveryManager()


# Decorators for error handling
def with_database_error_handling(database_type: DatabaseType = None, operation: str = None):
    """Decorator to add comprehensive error handling to database operations."""
    
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except TripleDatabaseError as e:
                error_recovery_manager.handle_error(e, {
                    "function": func.__name__,
                    "args": str(args)[:200],
                    "kwargs": str(kwargs)[:200]
                })
                raise
            except Exception as e:
                # Convert generic exceptions to TripleDatabaseError
                triple_db_error = TripleDatabaseError(
                    message=str(e),
                    database_type=database_type,
                    operation=operation or func.__name__,
                    severity=ErrorSeverity.MEDIUM
                )
                error_recovery_manager.handle_error(triple_db_error, {
                    "function": func.__name__,
                    "original_exception": e.__class__.__name__
                })
                raise triple_db_error from e
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except TripleDatabaseError as e:
                error_recovery_manager.handle_error(e, {
                    "function": func.__name__,
                    "args": str(args)[:200],
                    "kwargs": str(kwargs)[:200]
                })
                raise
            except Exception as e:
                triple_db_error = TripleDatabaseError(
                    message=str(e),
                    database_type=database_type,
                    operation=operation or func.__name__,
                    severity=ErrorSeverity.MEDIUM
                )
                error_recovery_manager.handle_error(triple_db_error, {
                    "function": func.__name__,
                    "original_exception": e.__class__.__name__
                })
                raise triple_db_error from e
        
        # Return appropriate wrapper based on function type
        if hasattr(func, '__code__') and func.__code__.co_flags & 0x80:  # CO_COROUTINE
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


def with_graceful_degradation(fallback_result=None, log_fallback=True):
    """Decorator to provide graceful degradation on errors."""
    
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except TripleDatabaseError as e:
                if log_fallback:
                    logger.warning(f"Function {func.__name__} failed, using fallback: {e.message}")
                return fallback_result
            except Exception as e:
                if log_fallback:
                    logger.warning(f"Function {func.__name__} failed with unexpected error, using fallback: {e}")
                return fallback_result
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except TripleDatabaseError as e:
                if log_fallback:
                    logger.warning(f"Function {func.__name__} failed, using fallback: {e.message}")
                return fallback_result
            except Exception as e:
                if log_fallback:
                    logger.warning(f"Function {func.__name__} failed with unexpected error, using fallback: {e}")
                return fallback_result
        
        # Return appropriate wrapper
        if hasattr(func, '__code__') and func.__code__.co_flags & 0x80:
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


class CircuitBreaker:
    """
    Circuit breaker pattern for database operations.
    
    Prevents cascade failures by stopping operations to a failing service
    and allowing it time to recover.
    """
    
    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = "closed"  # closed, open, half-open
    
    def call(self, func, *args, **kwargs):
        """Execute function with circuit breaker protection."""
        
        if self.state == "open":
            if self._should_attempt_reset():
                self.state = "half-open"
            else:
                raise TripleDatabaseError(
                    "Circuit breaker is open - service unavailable",
                    severity=ErrorSeverity.HIGH
                )
        
        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise
    
    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt reset."""
        if self.last_failure_time is None:
            return True
        
        time_since_failure = (datetime.now() - self.last_failure_time).total_seconds()
        return time_since_failure >= self.recovery_timeout
    
    def _on_success(self) -> None:
        """Handle successful operation."""
        self.failure_count = 0
        self.state = "closed"
    
    def _on_failure(self) -> None:
        """Handle failed operation."""
        self.failure_count += 1
        self.last_failure_time = datetime.now()
        
        if self.failure_count >= self.failure_threshold:
            self.state = "open"
            logger.warning(f"Circuit breaker opened after {self.failure_count} failures")


# Resource management utilities
class DatabaseResourceManager:
    """Manages database resources and enforces limits."""
    
    def __init__(self):
        self.active_connections = {
            DatabaseType.SQLITE: 0,
            DatabaseType.CHROMA: 0,
            DatabaseType.KUZU: 0
        }
        self.max_connections = {
            DatabaseType.SQLITE: 10,
            DatabaseType.CHROMA: 5,
            DatabaseType.KUZU: 5
        }
        self.connection_timeouts = {
            DatabaseType.SQLITE: 30,
            DatabaseType.CHROMA: 60,
            DatabaseType.KUZU: 45
        }
    
    def acquire_connection(self, database_type: DatabaseType) -> bool:
        """Attempt to acquire a database connection."""
        if self.active_connections[database_type] >= self.max_connections[database_type]:
            logger.warning(f"Connection limit reached for {database_type.value}")
            return False
        
        self.active_connections[database_type] += 1
        return True
    
    def release_connection(self, database_type: DatabaseType) -> None:
        """Release a database connection."""
        if self.active_connections[database_type] > 0:
            self.active_connections[database_type] -= 1
    
    def get_resource_status(self) -> Dict[str, Any]:
        """Get current resource utilization status."""
        return {
            "active_connections": {db.value: count for db, count in self.active_connections.items()},
            "max_connections": {db.value: count for db, count in self.max_connections.items()},
            "utilization": {
                db.value: (self.active_connections[db] / self.max_connections[db] * 100)
                for db in DatabaseType
            }
        }


# Global resource manager instance
resource_manager = DatabaseResourceManager()