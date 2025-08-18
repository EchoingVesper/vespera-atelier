"""
Comprehensive monitoring and diagnostics infrastructure.

This module provides health checks, system monitoring, performance metrics,
and diagnostic tools for the Vespera Scriptorium.
"""

from .diagnostics import DiagnosticResult, DiagnosticRunner, SystemInfo
from .health_checks import HealthChecker, HealthCheckResult
from .metrics import (
    MetricPoint,
    MetricsCollector,
    MetricSummary,
    PerformanceTracker,
    get_metrics_collector,
    increment_counter,
    record_metric,
    record_timing,
    timed_operation,
    track_performance,
)
from .system_monitor import AlertRule, SystemMonitor, SystemSnapshot, get_system_monitor

__all__ = [
    # Health checks
    "HealthCheckResult",
    "HealthChecker",
    # Metrics
    "MetricPoint",
    "MetricSummary",
    "MetricsCollector",
    "PerformanceTracker",
    "timed_operation",
    "get_metrics_collector",
    "record_metric",
    "increment_counter",
    "record_timing",
    "track_performance",
    # System monitoring
    "SystemSnapshot",
    "AlertRule",
    "SystemMonitor",
    "get_system_monitor",
    # Diagnostics
    "DiagnosticResult",
    "SystemInfo",
    "DiagnosticRunner",
]
