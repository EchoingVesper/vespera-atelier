"""
Domain exceptions for the Vespera Scriptorium.

These exceptions represent domain-specific errors and violations
of business rules, organized by category with comprehensive error handling.
"""

# Base exceptions
from .base_exceptions import (
    BaseOrchestrationError,
    ConfigurationError,
    ErrorSeverity,
    ExternalServiceError,
    InfrastructureError,
    PerformanceError,
    RecoveryStrategy,
    SecurityError,
    ValidationError,
)

# Orchestration exceptions
from .orchestration_errors import (
    ArtifactError,
    ArtifactNotFoundError,
    ConcurrencyError,
    OrchestrationError,
    ResourceExhaustedError,
    SessionNotFoundError,
    SessionStateError,
    SpecialistAssignmentError,
    SpecialistNotFoundError,
    TaskDependencyError,
    TaskNotFoundError,
    TaskStateError,
    TaskValidationError,
    WorkflowError,
)

# Specialist-specific exceptions
from .specialist_errors import (
    SpecialistCapabilityError,
    SpecialistConfigurationError,
    SpecialistContextError,
    SpecialistError,
    SpecialistLoadError,
    SpecialistOverloadError,
    SpecialistRoleConflictError,
    SpecialistUnavailableError,
)

# Task-specific exceptions
from .task_errors import (
    TaskBreakdownError,
    TaskCancellationError,
    TaskCorruptionError,
    TaskDeadlockError,
    TaskError,
    TaskExecutionError,
    TaskPriorityError,
    TaskResourceError,
    TaskSynthesisError,
    TaskTimeoutError,
)

__all__ = [
    # Base exceptions
    "BaseOrchestrationError",
    "ErrorSeverity",
    "RecoveryStrategy",
    "ConfigurationError",
    "InfrastructureError",
    "ValidationError",
    "ExternalServiceError",
    "SecurityError",
    "PerformanceError",
    # Orchestration exceptions
    "OrchestrationError",
    "TaskNotFoundError",
    "TaskStateError",
    "TaskDependencyError",
    "TaskValidationError",
    "SessionNotFoundError",
    "SessionStateError",
    "SpecialistNotFoundError",
    "SpecialistAssignmentError",
    "ArtifactError",
    "ArtifactNotFoundError",
    "WorkflowError",
    "ConcurrencyError",
    "ResourceExhaustedError",
    # Task exceptions
    "TaskError",
    "TaskExecutionError",
    "TaskTimeoutError",
    "TaskCancellationError",
    "TaskResourceError",
    "TaskDeadlockError",
    "TaskCorruptionError",
    "TaskPriorityError",
    "TaskBreakdownError",
    "TaskSynthesisError",
    # Specialist exceptions
    "SpecialistError",
    "SpecialistConfigurationError",
    "SpecialistCapabilityError",
    "SpecialistLoadError",
    "SpecialistRoleConflictError",
    "SpecialistContextError",
    "SpecialistUnavailableError",
    "SpecialistOverloadError",
]


def get_error_metrics() -> dict:
    """Get error metrics for diagnostic purposes."""
    return {
        "total_errors": 0,
        "error_rates": {},
        "severity_breakdown": {"low": 0, "medium": 0, "high": 0, "critical": 0},
        "recovery_success_rate": 0.0,
        "common_error_types": [],
    }
