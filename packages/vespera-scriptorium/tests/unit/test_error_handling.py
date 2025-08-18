"""
Unit tests for error handling and recovery mechanisms.
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

from databases.error_handling import (
    TripleDatabaseError, DatabaseConnectionError, DatabaseSyncError,
    SchemaValidationError, EmbeddingError, GraphOperationError,
    ErrorRecoveryManager, DatabaseType, ErrorSeverity,
    with_database_error_handling, with_graceful_degradation,
    CircuitBreaker, DatabaseResourceManager
)


class TestTripleDatabaseError:
    """Test cases for custom exception classes."""
    
    def test_base_triple_database_error(self):
        """Test base TripleDatabaseError."""
        error = TripleDatabaseError(
            "Test error",
            database_type=DatabaseType.SQLITE,
            operation="test_op",
            severity=ErrorSeverity.HIGH
        )
        
        assert error.message == "Test error"
        assert error.database_type == DatabaseType.SQLITE
        assert error.operation == "test_op"
        assert error.severity == ErrorSeverity.HIGH
        assert isinstance(error.timestamp, datetime)
    
    def test_database_connection_error(self):
        """Test DatabaseConnectionError."""
        error = DatabaseConnectionError(DatabaseType.CHROMA)
        
        assert error.database_type == DatabaseType.CHROMA
        assert error.operation == "connect"
        assert error.severity == ErrorSeverity.HIGH
        assert "chroma" in error.message.lower()
    
    def test_database_sync_error(self):
        """Test DatabaseSyncError."""
        error = DatabaseSyncError(
            DatabaseType.SQLITE,
            DatabaseType.KUZU,
            task_id="test_task_123"
        )
        
        assert error.source_db == DatabaseType.SQLITE
        assert error.target_db == DatabaseType.KUZU
        assert error.task_id == "test_task_123"
        assert error.operation == "sync"
        assert "test_task_123" in error.message
    
    def test_schema_validation_error(self):
        """Test SchemaValidationError."""
        validation_errors = ["Missing column: embedding_id", "Invalid index: idx_test"]
        error = SchemaValidationError(DatabaseType.SQLITE, validation_errors)
        
        assert error.database_type == DatabaseType.SQLITE
        assert error.validation_errors == validation_errors
        assert error.severity == ErrorSeverity.HIGH
        assert "embedding_id" in error.message
    
    def test_embedding_error(self):
        """Test EmbeddingError."""
        error = EmbeddingError("task_456", "Failed to generate embedding")
        
        assert error.task_id == "task_456"
        assert error.database_type == DatabaseType.CHROMA
        assert error.operation == "embedding"
        assert "task_456" in error.message
    
    def test_graph_operation_error(self):
        """Test GraphOperationError."""
        error = GraphOperationError("dependency_analysis", "Cypher query failed")
        
        assert error.database_type == DatabaseType.KUZU
        assert error.operation == "dependency_analysis"
        assert error.severity == ErrorSeverity.MEDIUM


class TestErrorRecoveryManager:
    """Test cases for ErrorRecoveryManager."""
    
    @pytest.fixture
    def recovery_manager(self):
        """Create a fresh ErrorRecoveryManager for testing."""
        return ErrorRecoveryManager()
    
    def test_initial_state(self, recovery_manager):
        """Test initial state of recovery manager."""
        assert len(recovery_manager.error_history) == 0
        assert len(recovery_manager.recovery_strategies) == 0
        assert not recovery_manager.degradation_mode
    
    def test_register_recovery_strategy(self, recovery_manager):
        """Test registering recovery strategies."""
        def mock_recovery(db_error):
            return True
        
        recovery_manager.register_recovery_strategy("TestError", mock_recovery)
        
        assert "TestError" in recovery_manager.recovery_strategies
        assert recovery_manager.recovery_strategies["TestError"] == mock_recovery
    
    def test_handle_error_basic(self, recovery_manager):
        """Test basic error handling."""
        error = TripleDatabaseError(
            "Test error",
            database_type=DatabaseType.SQLITE,
            operation="test_op",
            severity=ErrorSeverity.MEDIUM
        )
        
        # Handle the error
        result = recovery_manager.handle_error(error, {"context": "test"})
        
        # Check error was recorded
        assert len(recovery_manager.error_history) == 1
        db_error = recovery_manager.error_history[0]
        
        assert db_error.database_type == DatabaseType.SQLITE
        assert db_error.operation == "test_op"
        assert db_error.error_type == "TripleDatabaseError"
        assert db_error.message == "Test error"
        assert db_error.severity == ErrorSeverity.MEDIUM
        assert db_error.context == {"context": "test"}
        assert db_error.recovery_attempted is True
    
    def test_handle_error_with_recovery_strategy(self, recovery_manager):
        """Test error handling with custom recovery strategy."""
        # Register a recovery strategy
        def successful_recovery(db_error):
            return True
        
        recovery_manager.register_recovery_strategy("TestError", successful_recovery)
        
        # Create and handle error
        error = TripleDatabaseError("Test error")
        error.__class__.__name__ = "TestError"  # Mock the class name
        
        result = recovery_manager.handle_error(error)
        
        # Recovery should have been attempted and succeeded
        db_error = recovery_manager.error_history[0]
        assert db_error.recovery_attempted is True
        assert db_error.recovery_successful is True
    
    def test_degradation_mode_activation(self, recovery_manager):
        """Test degradation mode activation after many errors."""
        # Generate many recent errors
        for i in range(12):  # More than threshold of 10
            error = TripleDatabaseError(
                f"Error {i}",
                severity=ErrorSeverity.HIGH
            )
            recovery_manager.handle_error(error)
        
        # Should activate degradation mode
        assert recovery_manager.degradation_mode
    
    def test_degradation_mode_critical_errors(self, recovery_manager):
        """Test degradation mode activation with critical errors."""
        # Generate a few critical errors
        for i in range(3):  # More than threshold of 2 critical
            error = TripleDatabaseError(
                f"Critical error {i}",
                severity=ErrorSeverity.CRITICAL
            )
            recovery_manager.handle_error(error)
        
        # Should activate degradation mode
        assert recovery_manager.degradation_mode
    
    def test_error_summary(self, recovery_manager):
        """Test error summary generation."""
        # Add various errors
        errors = [
            TripleDatabaseError("Error 1", database_type=DatabaseType.SQLITE, severity=ErrorSeverity.LOW),
            DatabaseConnectionError(DatabaseType.CHROMA),
            GraphOperationError("test_op", "Graph error")
        ]
        
        for error in errors:
            recovery_manager.handle_error(error)
        
        summary = recovery_manager.get_error_summary()
        
        assert summary["total_errors"] == 3
        assert "errors_by_type" in summary
        assert "errors_by_database" in summary
        assert "errors_by_severity" in summary
        assert isinstance(summary["recovery_success_rate"], float)


class TestDecorators:
    """Test cases for error handling decorators."""
    
    def test_with_database_error_handling_success(self):
        """Test decorator with successful operation."""
        
        @with_database_error_handling(DatabaseType.SQLITE, "test_op")
        def successful_function():
            return "success"
        
        result = successful_function()
        assert result == "success"
    
    def test_with_database_error_handling_triple_db_error(self):
        """Test decorator with TripleDatabaseError."""
        
        @with_database_error_handling(DatabaseType.SQLITE, "test_op")
        def failing_function():
            raise DatabaseConnectionError(DatabaseType.SQLITE)
        
        with pytest.raises(DatabaseConnectionError):
            failing_function()
    
    def test_with_database_error_handling_generic_error(self):
        """Test decorator with generic exception."""
        
        @with_database_error_handling(DatabaseType.SQLITE, "test_op")
        def failing_function():
            raise ValueError("Generic error")
        
        with pytest.raises(TripleDatabaseError) as exc_info:
            failing_function()
        
        assert exc_info.value.database_type == DatabaseType.SQLITE
        assert exc_info.value.operation == "test_op"
        assert "Generic error" in exc_info.value.message
    
    def test_with_graceful_degradation_success(self):
        """Test graceful degradation decorator with success."""
        
        @with_graceful_degradation(fallback_result="fallback")
        def successful_function():
            return "success"
        
        result = successful_function()
        assert result == "success"
    
    def test_with_graceful_degradation_failure(self):
        """Test graceful degradation decorator with failure."""
        
        @with_graceful_degradation(fallback_result="fallback")
        def failing_function():
            raise DatabaseConnectionError(DatabaseType.CHROMA)
        
        result = failing_function()
        assert result == "fallback"
    
    @pytest.mark.asyncio
    async def test_async_decorators(self):
        """Test decorators with async functions."""
        
        @with_database_error_handling(DatabaseType.CHROMA, "async_op")
        async def async_function():
            return "async_success"
        
        result = await async_function()
        assert result == "async_success"
        
        @with_graceful_degradation(fallback_result="async_fallback")
        async def async_failing_function():
            raise EmbeddingError("test_task", "Async error")
        
        result = await async_failing_function()
        assert result == "async_fallback"


class TestCircuitBreaker:
    """Test cases for CircuitBreaker."""
    
    def test_initial_state(self):
        """Test initial circuit breaker state."""
        breaker = CircuitBreaker(failure_threshold=3, recovery_timeout=30)
        
        assert breaker.failure_count == 0
        assert breaker.state == "closed"
        assert breaker.last_failure_time is None
    
    def test_successful_calls(self):
        """Test successful calls through circuit breaker."""
        breaker = CircuitBreaker(failure_threshold=3, recovery_timeout=30)
        
        def successful_function():
            return "success"
        
        result = breaker.call(successful_function)
        assert result == "success"
        assert breaker.state == "closed"
        assert breaker.failure_count == 0
    
    def test_failure_accumulation(self):
        """Test failure accumulation and circuit opening."""
        breaker = CircuitBreaker(failure_threshold=3, recovery_timeout=30)
        
        def failing_function():
            raise ValueError("Test failure")
        
        # Accumulate failures
        for i in range(2):
            with pytest.raises(ValueError):
                breaker.call(failing_function)
        
        assert breaker.state == "closed"
        assert breaker.failure_count == 2
        
        # Third failure should open circuit
        with pytest.raises(ValueError):
            breaker.call(failing_function)
        
        assert breaker.state == "open"
        assert breaker.failure_count == 3
    
    def test_open_circuit_behavior(self):
        """Test behavior when circuit is open."""
        breaker = CircuitBreaker(failure_threshold=1, recovery_timeout=30)
        
        def failing_function():
            raise ValueError("Test failure")
        
        # Open the circuit
        with pytest.raises(ValueError):
            breaker.call(failing_function)
        
        assert breaker.state == "open"
        
        # Subsequent calls should be rejected
        def any_function():
            return "should not execute"
        
        with pytest.raises(TripleDatabaseError) as exc_info:
            breaker.call(any_function)
        
        assert "Circuit breaker is open" in str(exc_info.value)
    
    def test_recovery_attempt(self):
        """Test recovery attempt after timeout."""
        breaker = CircuitBreaker(failure_threshold=1, recovery_timeout=0.1)  # Short timeout
        
        def failing_function():
            raise ValueError("Test failure")
        
        # Open the circuit
        with pytest.raises(ValueError):
            breaker.call(failing_function)
        
        assert breaker.state == "open"
        
        # Wait for recovery timeout
        import time
        time.sleep(0.2)
        
        def successful_function():
            return "recovered"
        
        # Should allow recovery attempt and succeed
        result = breaker.call(successful_function)
        assert result == "recovered"
        assert breaker.state == "closed"
        assert breaker.failure_count == 0


class TestDatabaseResourceManager:
    """Test cases for DatabaseResourceManager."""
    
    def test_initial_state(self):
        """Test initial resource manager state."""
        manager = DatabaseResourceManager()
        
        for db_type in DatabaseType:
            assert manager.active_connections[db_type] == 0
            assert manager.max_connections[db_type] > 0
    
    def test_connection_acquisition(self):
        """Test connection acquisition and release."""
        manager = DatabaseResourceManager()
        
        # Acquire connection
        success = manager.acquire_connection(DatabaseType.SQLITE)
        assert success
        assert manager.active_connections[DatabaseType.SQLITE] == 1
        
        # Release connection
        manager.release_connection(DatabaseType.SQLITE)
        assert manager.active_connections[DatabaseType.SQLITE] == 0
    
    def test_connection_limit(self):
        """Test connection limit enforcement."""
        manager = DatabaseResourceManager()
        manager.max_connections[DatabaseType.CHROMA] = 2  # Set low limit
        
        # Acquire up to limit
        assert manager.acquire_connection(DatabaseType.CHROMA)
        assert manager.acquire_connection(DatabaseType.CHROMA)
        
        # Should refuse additional connections
        assert not manager.acquire_connection(DatabaseType.CHROMA)
        assert manager.active_connections[DatabaseType.CHROMA] == 2
    
    def test_resource_status(self):
        """Test resource status reporting."""
        manager = DatabaseResourceManager()
        
        # Acquire some connections
        manager.acquire_connection(DatabaseType.SQLITE)
        manager.acquire_connection(DatabaseType.CHROMA)
        
        status = manager.get_resource_status()
        
        assert "active_connections" in status
        assert "max_connections" in status
        assert "utilization" in status
        
        assert status["active_connections"]["sqlite"] == 1
        assert status["active_connections"]["chroma"] == 1
        assert status["utilization"]["sqlite"] > 0
        assert status["utilization"]["chroma"] > 0


if __name__ == "__main__":
    pytest.main([__file__])