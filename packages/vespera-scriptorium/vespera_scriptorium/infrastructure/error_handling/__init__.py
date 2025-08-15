"""
Error handling infrastructure for the Vespera Scriptorium.

This module provides centralized error handling, retry logic, and
recovery strategies for all system components.
"""

from .decorators import (
    ErrorContext,
    handle_errors,
    raise_on_error_response,
    safe_call,
    safe_call_async,
    suppress_errors,
    validate_input,
    with_error_context,
)
from .handlers import (
    DefaultErrorHandler,
    ErrorHandler,
    ErrorHandlerRegistry,
    InfrastructureErrorHandler,
    SpecialistErrorHandler,
    TaskErrorHandler,
)
from .logging_handlers import (
    ErrorAggregator,
    ErrorLogger,
    ErrorMetrics,
    StructuredErrorLogger,
)
from .recovery_strategies import (
    AutoRecoveryManager,
    InfrastructureRecoveryStrategy,
    RecoveryStrategy,
    SpecialistRecoveryStrategy,
    TaskRecoveryStrategy,
)
from .retry_coordinator import (
    ExponentialBackoffPolicy,
    FixedDelayPolicy,
    LinearBackoffPolicy,
    RetryCoordinator,
    RetryPolicy,
)

__all__ = [
    # Error handlers
    "ErrorHandler",
    "ErrorHandlerRegistry",
    "DefaultErrorHandler",
    "TaskErrorHandler",
    "SpecialistErrorHandler",
    "InfrastructureErrorHandler",
    # Retry coordination
    "RetryCoordinator",
    "RetryPolicy",
    "ExponentialBackoffPolicy",
    "LinearBackoffPolicy",
    "FixedDelayPolicy",
    # Logging
    "ErrorLogger",
    "StructuredErrorLogger",
    "ErrorAggregator",
    "ErrorMetrics",
    # Recovery
    "RecoveryStrategy",
    "AutoRecoveryManager",
    "TaskRecoveryStrategy",
    "SpecialistRecoveryStrategy",
    "InfrastructureRecoveryStrategy",
    # Decorators and utilities
    "handle_errors",
    "with_error_context",
    "suppress_errors",
    "raise_on_error_response",
    "ErrorContext",
    "safe_call",
    "safe_call_async",
    "validate_input",
]
